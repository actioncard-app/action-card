// Keeps the card on screen across a reload (app update, iOS tab discard) for this browser tab only (sessionStorage).
// Cleared when a new scan starts. Photos are stored as data URLs when they fit; otherwise only the thumbnail is kept.
import type { ActionCard } from './types';

const KEY = 'action-card-current';
export interface SessionCard { card: ActionCard; thumbnail: string; photo?: Blob; morePhotos?: Blob[]; saved: boolean }

const toDataUrl = (b: Blob) => new Promise<string>((ok, bad) => { const r = new FileReader(); r.onload = () => ok(String(r.result)); r.onerror = () => bad(r.error); r.readAsDataURL(b); });
function fromDataUrl(u: unknown): Blob | undefined {
  if (typeof u !== 'string' || !u.startsWith('data:')) return undefined;
  const [head, b64] = u.split(',');
  const bin = atob(b64); const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type: head.slice(5).split(';')[0] || 'image/jpeg' });
}

export async function rememberCurrent(c: SessionCard | null): Promise<void> {
  try {
    if (!c) { sessionStorage.removeItem(KEY); return; }
    const base = { card: c.card, thumbnail: c.thumbnail, saved: c.saved };
    let photo: string | undefined, morePhotos: string[] | undefined;
    try {
      photo = c.photo ? await toDataUrl(c.photo) : undefined;
      morePhotos = c.morePhotos ? await Promise.all(c.morePhotos.map(toDataUrl)) : undefined;
    } catch { photo = undefined; morePhotos = undefined; }
    try { sessionStorage.setItem(KEY, JSON.stringify({ ...base, photo, morePhotos })); }
    catch { sessionStorage.setItem(KEY, JSON.stringify(base)); } // quota: keep the card without the big photos
  } catch { /* storage unavailable (private mode quirks): nothing to restore later */ }
}

export function restoreCurrent(): SessionCard | null {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return null;
    const v = JSON.parse(raw);
    if (!v?.card?.id) return null;
    const more = Array.isArray(v.morePhotos) ? v.morePhotos.map(fromDataUrl).filter(Boolean) as Blob[] : undefined;
    return { card: v.card, thumbnail: v.thumbnail, photo: fromDataUrl(v.photo), morePhotos: more?.length ? more : undefined, saved: !!v.saved };
  } catch { return null; }
}

/** Ask the browser not to evict IndexedDB (saved cards). Safari may still evict for non-installed sites. */
export async function requestPersistentStorage(): Promise<boolean | null> {
  try { return navigator.storage?.persist ? await navigator.storage.persist() : null; } catch { return null; }
}
export async function isStoragePersisted(): Promise<boolean | null> {
  try { return navigator.storage?.persisted ? await navigator.storage.persisted() : null; } catch { return null; }
}
export const isInstalled = () =>
  window.matchMedia?.('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
