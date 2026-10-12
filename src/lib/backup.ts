// Backup / restore of all saved cards + settings as ONE versioned JSON file the user keeps (Files / iCloud Drive / Downloads).
// Export is a Pro extra; restore is always free (someone who reinstalls must get their data back). No server involved.
// The xAI API key is never written into a backup file (it is a secret; the user can paste it again).
import type { SavedCard } from './types';
import type { Settings } from './settings';
import { isNative } from './native';

export const BACKUP_KIND = 'letterscan-backup';
export const BACKUP_VERSION = 1;

interface BackupPhoto { type: string; data: string } // base64
export interface BackupCard { id: string; createdAt: number; card: SavedCard['card']; thumbnail: string; photo?: BackupPhoto; morePhotos?: BackupPhoto[] }
export interface BackupFile { kind: typeof BACKUP_KIND; version: number; app: 'LetterScan'; exportedAt: string; settings: Partial<Settings>; cards: BackupCard[] }
export type BackupError = 'err_backup_json' | 'err_backup_kind' | 'err_backup_version' | 'err_backup_cards';
export class BackupParseError extends Error { constructor(public code: BackupError) { super(code); } }

const b64 = async (b: Blob): Promise<BackupPhoto> => {
  const bytes = new Uint8Array(await b.arrayBuffer());
  let s = ''; for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return { type: b.type || 'image/jpeg', data: btoa(s) };
};
const unb64 = (p: BackupPhoto): Blob => new Blob([Uint8Array.from(atob(p.data), (c) => c.charCodeAt(0))], { type: p.type });

export async function buildBackup(cards: SavedCard[], settings: Settings, now = new Date()): Promise<BackupFile> {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { xaiKey, ...safe } = settings;
  return {
    kind: BACKUP_KIND, version: BACKUP_VERSION, app: 'LetterScan', exportedAt: now.toISOString(), settings: safe,
    cards: await Promise.all(cards.map(async (c) => ({
      id: c.id, createdAt: c.createdAt, card: c.card, thumbnail: c.thumbnail,
      photo: c.photo ? await b64(c.photo) : undefined,
      morePhotos: c.morePhotos?.length ? await Promise.all(c.morePhotos.map(b64)) : undefined,
    }))),
  };
}

const isObj = (x: unknown): x is Record<string, unknown> => !!x && typeof x === 'object' && !Array.isArray(x);
const okPhoto = (p: unknown) => p === undefined || (isObj(p) && typeof p.data === 'string' && typeof p.type === 'string');
function okCard(c: unknown): c is BackupCard {
  if (!isObj(c) || typeof c.id !== 'string' || !c.id || typeof c.createdAt !== 'number' || !isObj(c.card)) return false;
  const k = c.card;
  return isObj(k.docType) && isObj(k.deadline) && isObj(k.amount) && isObj(k.reference) && isObj(k.nextAction) && isObj(k.reply)
    && (c.thumbnail === undefined || typeof c.thumbnail === 'string') && okPhoto(c.photo)
    && (c.morePhotos === undefined || (Array.isArray(c.morePhotos) && c.morePhotos.every(okPhoto)));
}

/** Validate a backup file's text. Throws BackupParseError with an i18n key for a clear message. */
export function parseBackup(text: string): BackupFile {
  let j: unknown;
  try { j = JSON.parse(text); } catch { throw new BackupParseError('err_backup_json'); }
  if (!isObj(j) || j.kind !== BACKUP_KIND) throw new BackupParseError('err_backup_kind');
  if (typeof j.version !== 'number' || j.version < 1 || j.version > BACKUP_VERSION) throw new BackupParseError('err_backup_version');
  if (!Array.isArray(j.cards) || !j.cards.every(okCard)) throw new BackupParseError('err_backup_cards');
  return { ...(j as unknown as BackupFile), settings: isObj(j.settings) ? (j.settings as Partial<Settings>) : {} };
}

/** Cards in the backup that are not on this device yet (by card id; existing cards are never overwritten). */
export function newCards(file: BackupFile, existingIds: Iterable<string>): SavedCard[] {
  const have = new Set(existingIds);
  const seen = new Set<string>();
  const out: SavedCard[] = [];
  for (const c of file.cards) {
    if (have.has(c.id) || seen.has(c.id)) continue;
    seen.add(c.id);
    let photo: Blob | undefined, morePhotos: Blob[] | undefined;
    try { photo = c.photo ? unb64(c.photo) : undefined; morePhotos = c.morePhotos?.map(unb64); } catch { photo = undefined; morePhotos = undefined; }
    out.push({ id: c.id, createdAt: c.createdAt, card: c.card, thumbnail: c.thumbnail ?? '', photo, morePhotos });
  }
  return out;
}

/** Settings from a backup applied on top of the current ones (the API key on this device is kept). */
export function mergeSettings(cur: Settings, file: BackupFile): Settings {
  const s = file.settings;
  const pick: Partial<Settings> = {};
  if (typeof s.userLanguage === 'string') pick.userLanguage = s.userLanguage;
  if (typeof s.docLanguage === 'string') pick.docLanguage = s.docLanguage;
  if (typeof s.theme === 'string') pick.theme = s.theme;
  if (Array.isArray(s.reminderDays) && s.reminderDays.every((n) => typeof n === 'number')) pick.reminderDays = s.reminderDays;
  return { ...cur, ...pick, xaiKey: cur.xaiKey };
}

export const backupName = (now = new Date()) => {
  const d = new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
  return `LetterScan-backup-${d}.json`;
};

/** Hand a file to the user: iOS app = write to the cache folder + share sheet (Save to Files / iCloud Drive); web = download. */
export async function deliverFile(blob: Blob, name: string): Promise<'shared' | 'cancelled' | 'downloaded'> {
  if (isNative()) {
    const [{ Filesystem, Directory, Encoding }, { Share }] = await Promise.all([import('@capacitor/filesystem'), import('@capacitor/share')]);
    let res;
    if (blob.type.startsWith('application/json')) res = await Filesystem.writeFile({ path: name, data: await blob.text(), directory: Directory.Cache, encoding: Encoding.UTF8 });
    else {
      const data = await new Promise<string>((ok, bad) => { const r = new FileReader(); r.onload = () => ok(String(r.result).split(',')[1]); r.onerror = () => bad(r.error); r.readAsDataURL(blob); });
      res = await Filesystem.writeFile({ path: name, data, directory: Directory.Cache });
    }
    try { await Share.share({ title: 'LetterScan', files: [res.uri] }); return 'shared'; } catch { return 'cancelled'; }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60000); // WebKit reads the blob late; revoking early breaks the download
  return 'downloaded';
}

export async function exportBackup(cards: SavedCard[], settings: Settings) {
  const file = await buildBackup(cards, settings);
  return deliverFile(new Blob([JSON.stringify(file)], { type: 'application/json' }), backupName());
}
