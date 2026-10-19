// Quick photo check BEFORE OCR (pure, DOM-free, unit-tested): too dark, blurry, page cut off at the frame edge, or
// strongly tilted. Runs on a small copy (long side ~600 px) in a few milliseconds. It only WARNS (retake or continue);
// thresholds were set on the repository's 177 test photos: only the deliberately blurry / tiny ones trigger the blur
// warning, and a 5x5 box blur (at 600 px) of 172 of them does.
import { estimateSkew } from './geometry';

export type PhotoIssue = 'dark' | 'blurry' | 'cut' | 'tilted';
export interface PhotoCheck { issues: PhotoIssue[]; paper: number; sharpness: number; edgeInk: number; skew: number }

export const LIMITS = { paper: 85, sharpness: 0.53, edgeInk: 0.004, skew: 12 };

export function checkPhoto(rgba: Uint8ClampedArray, w: number, h: number): PhotoCheck {
  const n = w * h;
  const g = new Float32Array(n);
  const hist = new Uint32Array(256);
  for (let p = 0; p < n; p++) { const v = 0.299 * rgba[p * 4] + 0.587 * rgba[p * 4 + 1] + 0.114 * rgba[p * 4 + 2]; g[p] = v; hist[v | 0]++; }
  const pct = (q: number) => { let a = 0; for (let k = 0; k < 256; k++) { a += hist[k]; if (a >= n * q) return k; } return 255; };
  const paper = pct(0.9), dark = pct(0.003);
  const contrast = Math.max(1, paper - dark);
  // ink: clearly darker than the paper
  const thr = dark + contrast * 0.5;
  const ink = new Uint8Array(n);
  let inkN = 0;
  for (let p = 0; p < n; p++) if (g[p] < thr) { ink[p] = 1; inkN++; }
  // sharpness: how steep the strongest edges are compared with the contrast right around them (7x7 window).
  // Independent of overall brightness/contrast; blur spreads every edge over more pixels and lowers it.
  const sharpness = edgeSteepness(g, w, h);
  // cut off: text running into the frame edge (share of the ink inside a 1.5 % border band, thin strokes only)
  const bw = Math.max(2, Math.round(Math.min(w, h) * 0.015));
  let edge = 0;
  const sides = [0, 0, 0, 0];
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (!ink[y * w + x]) continue;
    const s = x < bw ? 0 : x >= w - bw ? 1 : y < bw ? 2 : y >= h - bw ? 3 : -1;
    if (s >= 0) { edge++; sides[s]++; }
  }
  // a solid dark band along the edge is the table/background, not text: only count sides whose band is mostly light
  const bandShare = (s: number) => sides[s] / ((s < 2 ? h : w) * bw);
  const textSides = sides.map((c, s) => (c > 0 && bandShare(s) < 0.35 ? c : 0));
  const edgeInk = inkN ? textSides.reduce((a, b) => a + b, 0) / inkN : 0;
  const skew = inkN > 200 ? estimateSkew(ink, w, h, 20) : 0;
  const issues: PhotoIssue[] = [];
  if (paper < LIMITS.paper) issues.push('dark');
  if (sharpness < LIMITS.sharpness) issues.push('blurry');
  if (edgeInk > LIMITS.edgeInk) issues.push('cut');
  if (Math.abs(skew) >= LIMITS.skew) issues.push('tilted');
  return { issues, paper, sharpness, edgeInk: Math.round(edgeInk * 1000) / 1000, skew };
}

/** Sliding max/min over a (2r+1) window, separable. */
function range7(g: Float32Array, w: number, h: number, r = 3): Float32Array {
  const mx = new Float32Array(w * h), mn = new Float32Array(w * h), tx = new Float32Array(w * h), tn = new Float32Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    let a = -1, b = 256;
    for (let k = Math.max(0, x - r); k <= Math.min(w - 1, x + r); k++) { const v = g[y * w + k]; if (v > a) a = v; if (v < b) b = v; }
    tx[y * w + x] = a; tn[y * w + x] = b;
  }
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    let a = -1, b = 256;
    for (let k = Math.max(0, y - r); k <= Math.min(h - 1, y + r); k++) { const i = k * w + x; if (tx[i] > a) a = tx[i]; if (tn[i] < b) b = tn[i]; }
    mx[y * w + x] = a; mn[y * w + x] = b;
  }
  for (let i = 0; i < w * h; i++) mx[i] -= mn[i];
  return mx;
}

/** Mean of grad / local range over the 5 % steepest pixels that sit at a real edge (local range > 40). 1 = no text. */
export function edgeSteepness(g: Float32Array, w: number, h: number): number {
  const rng = range7(g, w, h);
  const grads: number[] = [], ratios: number[] = [];
  for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
    const i = y * w + x;
    if (rng[i] <= 40) continue;
    const gr = Math.max(Math.abs(g[i + 1] - g[i - 1]), Math.abs(g[i + w] - g[i - w]));
    grads.push(gr); ratios.push(gr / rng[i]);
  }
  if (grads.length < 200) return 1;
  const k = Math.max(1, Math.round(grads.length * 0.05));
  const idx = grads.map((_, i) => i).sort((a, b) => grads[b] - grads[a]).slice(0, k);
  return Math.round((idx.reduce((s, i) => s + ratios[i], 0) / k) * 1000) / 1000;
}
