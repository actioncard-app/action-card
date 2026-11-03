// Free Core limits (Benji, 3 Nov 2026; was 2 per calendar month): 4 scans per 30-day period (photo or PDF; the built-in
// sample letter does not count) and 1 saved letter. LetterScan Pro removes both.
// Reset rule: a 30-day period starts with the first scan made while no period is running; all 4 free scans come back
// together exactly 30 days after that first scan (shown to the user as "Resets on <date>"). The counter lives on this
// device only (localStorage), so reinstalling the app resets it; that was accepted.
// When the build has Pro switched off (VITE_PRO_ENABLED not 'true') nothing is limited: nobody is gated without a way
// to buy Pro.
import { PRO_ENABLED } from './pro';

export const FREE_SCANS = 4;
/** @deprecated name kept for callers; the limit is per 30-day period, not per month. */
export const FREE_SCANS_PER_MONTH = FREE_SCANS;
export const FREE_PERIOD_DAYS = 30;
export const FREE_SAVED_LETTERS = 1;
const KEY = 'letterscan.scans.v2';
const DAY = 86_400_000;

/** Core limits apply: Pro exists in this build and is not owned. */
export const coreLimited = (owned: boolean, proEnabled = PRO_ENABLED) => proEnabled && !owned;

interface Store { getItem(k: string): string | null; setItem(k: string, v: string): void }
const store = (): Store | null => { try { return localStorage; } catch { return null; } };

/** The running period, or null when none is running (never scanned, or 30 days have passed). */
function period(now: Date, s: Store | null): { start: number; n: number } | null {
  try {
    const v = JSON.parse(s?.getItem(KEY) ?? 'null') as { start?: number; n?: number } | null;
    if (!v || !Number.isFinite(v.start) || !Number.isFinite(v.n)) return null;
    if (now.getTime() >= v.start! + FREE_PERIOD_DAYS * DAY || now.getTime() < v.start! - DAY) return null; // ended (or clock moved back a lot)
    return { start: v.start!, n: Math.max(0, v.n!) };
  } catch { return null; }
}

export const scansUsed = (now = new Date(), s: Store | null = store()) => period(now, s)?.n ?? 0;
export const scansLeft = (now = new Date(), s: Store | null = store()) => Math.max(0, FREE_SCANS - scansUsed(now, s));
/** When the free scans come back (30 days after the period's first scan), or null if no period is running. */
export function resetDate(now = new Date(), s: Store | null = store()): Date | null {
  const p = period(now, s);
  return p ? new Date(p.start + FREE_PERIOD_DAYS * DAY) : null;
}

/** May a new (non-sample) scan start? Always true with Pro or when Pro is off in this build. */
export const canScan = (owned: boolean, now = new Date(), s: Store | null = store(), proEnabled = PRO_ENABLED) =>
  !coreLimited(owned, proEnabled) || scansLeft(now, s) > 0;

/** Count one finished scan (call only for real, non-sample scans by a Core user). Starts a period if none is running. */
export function countScan(now = new Date(), s: Store | null = store()): number {
  const p = period(now, s) ?? { start: now.getTime(), n: 0 };
  const n = p.n + 1;
  try { s?.setItem(KEY, JSON.stringify({ start: p.start, n })); } catch { /* private mode */ }
  return n;
}

/** Saving one more letter is allowed (Pro, Pro off, or fewer than the free number saved). */
export const canSaveAnother = (owned: boolean, savedCount: number, proEnabled = PRO_ENABLED) =>
  !coreLimited(owned, proEnabled) || savedCount < FREE_SAVED_LETTERS;
