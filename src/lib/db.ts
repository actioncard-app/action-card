import { openDB, type IDBPDatabase } from 'idb';
import type { SavedCard } from './types';

let dbp: Promise<IDBPDatabase> | null = null;
function db() {
  dbp ??= openDB('action-card', 1, {
    upgrade(d) {
      const s = d.createObjectStore('cards', { keyPath: 'id' });
      s.createIndex('createdAt', 'createdAt');
    },
  });
  return dbp;
}
// Photos are stored as ArrayBuffer + MIME type, not as Blob: WebKit refuses Blobs in IndexedDB in ephemeral /
// private-browsing contexts ("Error preparing Blob/File data to be stored in object store"), which made Save fail
// in Playwright WebKit and would fail in Safari private tabs. ArrayBuffers work in every engine.
interface StoredPhoto { buf: ArrayBuffer; type: string }
type Stored = Omit<SavedCard, 'photo' | 'morePhotos'> & { photo?: StoredPhoto | Blob; morePhotos?: (StoredPhoto | Blob)[] };
const put = async (b: Blob): Promise<StoredPhoto> => ({ buf: await b.arrayBuffer(), type: b.type });
const get = (p: StoredPhoto | Blob): Blob => (p instanceof Blob ? p : new Blob([p.buf], { type: p.type }));
async function toStored(c: SavedCard): Promise<Stored> {
  return { ...c, photo: c.photo ? await put(c.photo) : undefined, morePhotos: c.morePhotos ? await Promise.all(c.morePhotos.map(put)) : undefined };
}
function fromStored(s: Stored): SavedCard {
  return { ...s, photo: s.photo ? get(s.photo) : undefined, morePhotos: s.morePhotos?.map(get) };
}
export async function saveCard(c: SavedCard) { await (await db()).put('cards', await toStored(c)); }
export async function listCards(): Promise<SavedCard[]> {
  const all = (await (await db()).getAllFromIndex('cards', 'createdAt')) as Stored[];
  return all.map(fromStored).reverse();
}
export async function getCard(id: string): Promise<SavedCard | undefined> {
  const s = (await (await db()).get('cards', id)) as Stored | undefined;
  return s && fromStored(s);
}
export async function deleteCard(id: string) { await (await db()).delete('cards', id); }
export async function clearAll() { await (await db()).clear('cards'); }
