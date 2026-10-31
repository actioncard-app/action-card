// Free Core limits (approved by Benji, 31 Oct 2026): 2 scans per calendar month (photo or PDF; the built-in sample
// letter does not count) and 1 saved letter. LetterScan Pro removes both. The counter lives on this device only
// (localStorage), so reinstalling the app resets it; that was accepted.
// When the build has Pro switched off (VITE_PRO_ENABLED not 'true') nothing is limited: nobody is gated without a way
// to buy Pro.
import { PRO_ENABLED } from './pro';

export const FREE_SCANS_PER_MONTH = 2;
export const FREE_SAVED_LETTERS = 1;
const KEY = 'letterscan.scans.v1';

/** Core limits apply: Pro exists in this build and is not owned. */
export const coreLimited = (owned: boolean, proEnabled = PRO_ENABLED) => proEnabled && !owned;

/** Local calendar month, e.g. "2026-10". */
export const monthKey = (now = new Date()) => `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
/** First day of the next calendar month (when the free scans come back). */
export const nextMonthStart = (now = new Date()) => new Date(now.getFullYear(), now.getMonth() + 1, 1);

interface Store { getItem(k: string): string | null; setItem(k: string, v: string): void }
const store = (): Store | null => { try { return localStorage; } catch { return null; } };

export function scansUsed(now = new Date(), s: Store | null = store()): number {
  try {
    const v = JSON.parse(s?.getItem(KEY) ?? 'null') as { month?: string; n?: number } | null;
    return v && v.month === monthKey(now) && Number.isFinite(v.n) ? Math.max(0, v.n!) : 0;
  } catch { return 0; }
}
export const scansLeft = (now = new Date(), s: Store | null = store()) => Math.max(0, FREE_SCANS_PER_MONTH - scansUsed(now, s));

/** May a new (non-sample) scan start? Always true with Pro or when Pro is off in this build. */
export const canScan = (owned: boolean, now = new Date(), s: Store | null = store(), proEnabled = PRO_ENABLED) =>
  !coreLimited(owned, proEnabled) || scansLeft(now, s) > 0;

/** Count one finished scan for this month (call only for real, non-sample scans by a Core user). */
export function countScan(now = new Date(), s: Store | null = store()): number {
  const n = scansUsed(now, s) + 1;
  try { s?.setItem(KEY, JSON.stringify({ month: monthKey(now), n })); } catch { /* private mode */ }
  return n;
}

/** Saving one more letter is allowed (Pro, Pro off, or fewer than the free number saved). */
export const canSaveAnother = (owned: boolean, savedCount: number, proEnabled = PRO_ENABLED) =>
  !coreLimited(owned, proEnabled) || savedCount < FREE_SAVED_LETTERS;
