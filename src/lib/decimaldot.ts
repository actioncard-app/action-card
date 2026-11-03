// Recovering a decimal point that OCR dropped ("$84.50" read as "$8450"). Small print often has a 1-2 pixel dot that
// the recogniser skips. Instead of guessing cents, look at the pixels of that word: a small blob sitting on the
// baseline between two digits is a decimal point. Only accepted when the glyph count matches the OCR text exactly and
// the dot leaves exactly two digits after it; anything else returns null and the card shows both readings instead.

export interface Box { x0: number; y0: number; x1: number; y1: number }
interface Comp { x0: number; y0: number; x1: number; y1: number; n: number }

/** Connected dark blobs of a grayscale crop (8- or 4-connected: bold print can touch a dot to the next digit diagonally). */
function components(gray: ArrayLike<number>, w: number, h: number, eight: boolean): Comp[] {
  let lo = 255, hi = 0;
  for (let i = 0; i < w * h; i++) { const v = gray[i]; if (v < lo) lo = v; if (v > hi) hi = v; }
  if (hi - lo < 60) return [];
  const thr = lo + (hi - lo) * 0.55;
  const dark = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) dark[i] = gray[i] < thr ? 1 : 0;
  const seen = new Uint8Array(w * h);
  const out: Comp[] = [];
  const stack: number[] = [];
  for (let s = 0; s < w * h; s++) {
    if (!dark[s] || seen[s]) continue;
    const c: Comp = { x0: w, y0: h, x1: -1, y1: -1, n: 0 };
    seen[s] = 1; stack.push(s);
    while (stack.length) {
      const i = stack.pop()!, x = i % w, y = (i - x) / w;
      c.n++; if (x < c.x0) c.x0 = x; if (x > c.x1) c.x1 = x; if (y < c.y0) c.y0 = y; if (y > c.y1) c.y1 = y;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        if (!eight && dx && dy) continue;
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
        const j = ny * w + nx;
        if (dark[j] && !seen[j]) { seen[j] = 1; stack.push(j); }
      }
    }
    out.push(c);
  }
  return out;
}

/**
 * gray: the crop of one OCR word (w x h), word: its OCR text ("$8450"). Returns the corrected word ("$84.50") when a
 * decimal point is visible between the digits, else null.
 */
export function recoverDecimal(gray: ArrayLike<number>, w: number, h: number, word: string): string | null {
  return recoverWith(gray, w, h, word, true) ?? recoverWith(gray, w, h, word, false);
}

function recoverWith(gray: ArrayLike<number>, w: number, h: number, word: string, eight: boolean): string | null {
  const m = /^([$€£]?)(\d{3,6})$/.exec(word);
  if (!m) return null;
  const digits = m[2];
  const comps = components(gray, w, h, eight);
  if (!comps.length) return null;
  const maxH = Math.max(...comps.map((c) => c.y1 - c.y0 + 1));
  if (maxH < 6) return null;
  const tall = comps.filter((c) => c.y1 - c.y0 + 1 >= maxH * 0.5).sort((a, b) => a.x0 - b.x0);
  const glyphs = tall.length - (m[1] ? 1 : 0);
  if (glyphs !== digits.length) return null; // merged or broken glyphs: no reliable position
  const tallDigits = m[1] ? tall.slice(1) : tall;
  const bottoms = tallDigits.map((c) => c.y1).sort((a, b) => a - b);
  const base = bottoms[Math.floor(bottoms.length / 2)];
  const digitH = Math.max(...tallDigits.map((c) => c.y1 - c.y0 + 1));
  const dots = comps.filter((c) => {
    const ch = c.y1 - c.y0 + 1, cw = c.x1 - c.x0 + 1;
    if (ch > digitH * 0.3 || cw > digitH * 0.35) return false;
    if (Math.abs(c.y1 - base) > Math.max(1, digitH * 0.2)) return false; // sits on the baseline
    const cx = (c.x0 + c.x1) / 2;
    return !tall.some((t) => cx >= t.x0 && cx <= t.x1); // in a gap between glyphs, not part of one
  });
  if (dots.length !== 1) return null;
  const cx = (dots[0].x0 + dots[0].x1) / 2;
  const before = tallDigits.filter((t) => t.x1 < cx).length;
  if (before < 1 || digits.length - before !== 2) return null; // only a cents point
  return `${m[1]}${digits.slice(0, before)}.${digits.slice(before)}`;
}

/** Words that may have lost a decimal point: currency symbol + 3-6 digits, not ending in 00. */
export const suspectAmountWord = (t: string) => /^[$€£]\d{3,6}$/.test(t) && !/00$/.test(t);
