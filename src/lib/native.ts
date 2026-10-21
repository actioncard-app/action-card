// Native (iOS app via Capacitor) features. The web/PWA build is unchanged: every function checks isNative() first
// and the plugin code is only imported (dynamic import) inside the native app. Everything stays on the device.
import { Capacitor } from '@capacitor/core';
import type { ActionCard } from './types';

export const isNative = (): boolean => Capacitor.isNativePlatform();

/** Native camera (the photo library goes through the web view's own picker). Returns null if the user cancels. */
export async function nativePhoto(from: 'camera'): Promise<File | null> {
  const { Camera, CameraResultType, CameraSource } = await import('@capacitor/camera');
  try {
    const p = await Camera.getPhoto({ source: from === 'camera' ? CameraSource.Camera : CameraSource.Photos, resultType: CameraResultType.DataUrl, quality: 90, width: 3000, height: 3000, correctOrientation: true, saveToGallery: false });
    if (!p.dataUrl) return null;
    const blob = await (await fetch(p.dataUrl)).blob();
    return new File([blob], `photo.${p.format || 'jpeg'}`, { type: blob.type || 'image/jpeg' });
  } catch (e) {
    if (/cancel/i.test((e as Error).message)) return null;
    throw e;
  }
}

const notifId = (card: ActionCard, k: number) => (Math.abs([...card.id].reduce((h, c) => (h * 31 + c.charCodeAt(0)) | 0, 7)) % 1_000_000) * 10 + k;

/** On-device reminders for the deadline: by default 3 days before and on the day (Pro: own schedule), at 09:00 local time. No server involved.
 *  Returns how many were scheduled (0 if permission was refused or both times are in the past). */
export async function scheduleDeadlineReminders(card: ActionCard, title: string, body: string, bodyToday: string, daysBefore: readonly number[] = [3, 0]): Promise<number> {
  if (!card.deadline.value) return 0;
  const { LocalNotifications } = await import('@capacitor/local-notifications');
  let perm = await LocalNotifications.checkPermissions();
  if (perm.display !== 'granted') perm = await LocalNotifications.requestPermissions();
  if (perm.display !== 'granted') return 0;
  const [y, m, d] = card.deadline.value.split('-').map(Number);
  const at = (daysBefore: number) => new Date(y, m - 1, d - daysBefore, 9, 0, 0);
  const list = daysBefore.slice(0, 5).map((n, i) => ({ k: i + 1, when: at(n), body: n === 0 ? bodyToday : body })).filter((x) => x.when.getTime() > Date.now());
  await LocalNotifications.cancel({ notifications: [1, 2, 3, 4, 5].map((k) => ({ id: notifId(card, k) })) }).catch(() => {});
  if (!list.length) return 0;
  await LocalNotifications.schedule({ notifications: list.map((x) => ({ id: notifId(card, x.k), title, body: x.body, schedule: { at: x.when, allowWhileIdle: true } })) });
  return list.length;
}

export async function nativeShareText(title: string, text: string): Promise<'shared' | 'failed'> {
  const { Share } = await import('@capacitor/share');
  try { await Share.share({ title, text, dialogTitle: title }); return 'shared'; } catch { return 'failed'; }
}

/** Save the PDF in the app's cache folder and open the iOS share sheet (Save to Files, Mail, Print...). */
export async function nativeSharePdf(blob: Blob, name: string): Promise<'shared' | 'cancelled'> {
  const [{ Filesystem, Directory }, { Share }] = await Promise.all([import('@capacitor/filesystem'), import('@capacitor/share')]);
  const data = await new Promise<string>((ok, bad) => { const r = new FileReader(); r.onload = () => ok(String(r.result).split(',')[1]); r.onerror = () => bad(r.error); r.readAsDataURL(blob); });
  const res = await Filesystem.writeFile({ path: name, data, directory: Directory.Cache });
  try { await Share.share({ title: 'LetterScan', files: [res.uri] }); return 'shared'; } catch { return 'cancelled'; }
}

export async function tapFeedback() {
  if (!isNative()) return;
  try { const { Haptics, ImpactStyle } = await import('@capacitor/haptics'); await Haptics.impact({ style: ImpactStyle.Light }); } catch { /* optional */ }
}

/** Copy text to the clipboard: native clipboard in the iOS app, else the web Clipboard API, else a hidden textarea. */
export async function copyText(text: string): Promise<boolean> {
  try {
    if (isNative()) { const { Clipboard } = await import('@capacitor/clipboard'); await Clipboard.write({ string: text }); return true; }
    if (navigator.clipboard?.writeText) { await navigator.clipboard.writeText(text); return true; }
  } catch { /* fall through */ }
  try {
    const ta = document.createElement('textarea'); ta.value = text; ta.setAttribute('readonly', ''); ta.style.position = 'fixed'; ta.style.opacity = '0';
    document.body.appendChild(ta); ta.select(); const ok = document.execCommand('copy'); ta.remove(); return ok;
  } catch { return false; }
}

/** iOS: open the system "New Event" sheet (EventKitUI) prefilled with the deadline as an all-day event with two alerts.
 *  The user confirms in the system sheet, so no full calendar access is needed. Returns false if cancelled/unavailable. */
export async function addToCalendarNative(title: string, iso: string, notes: string): Promise<'added' | 'cancelled' | 'failed'> {
  try {
    const { CapacitorCalendar } = await import('@ebarooni/capacitor-calendar');
    const [y, m, d] = iso.split('-').map(Number);
    const start = new Date(y, m - 1, d, 9, 0, 0).getTime();
    const res = await CapacitorCalendar.createEventWithPrompt({ title, startDate: start, endDate: start + 3600_000, isAllDay: true, description: notes, alerts: [-3 * 1440, 0] });
    return res?.id ? 'added' : 'cancelled';
  } catch { return 'failed'; }
}

/** iOS "Open in LetterScan" / share from Files or Mail (CFBundleDocumentTypes in Info.plist): the system passes a
 *  file:// URL (copied into the app's Inbox). Read it and hand it to the normal pipeline. NOT VERIFIED on a device. */
export async function listenOpenFile(onFile: (f: File) => void): Promise<void> {
  if (!isNative()) return;
  const [{ App }, { Filesystem }] = await Promise.all([import('@capacitor/app'), import('@capacitor/filesystem')]);
  const open = async (url: string | undefined) => {
    if (!url || !/^file:/i.test(url)) return;
    try {
      const res = await Filesystem.readFile({ path: url });
      const name = decodeURIComponent(url.split('/').pop() || 'document');
      const type = /\.pdf$/i.test(name) ? 'application/pdf' : /\.png$/i.test(name) ? 'image/png' : /\.(heic|heif)$/i.test(name) ? 'image/heic' : 'image/jpeg';
      const blob = typeof res.data === 'string' ? new Blob([Uint8Array.from(atob(res.data), (c) => c.charCodeAt(0))], { type }) : res.data;
      onFile(new File([blob], name, { type }));
    } catch (e) { console.warn('[open-in] could not read', url, e); }
  };
  App.addListener('appUrlOpen', (e) => { open(e.url); });
  const launch = await App.getLaunchUrl().catch(() => undefined);
  open(launch?.url);
}
