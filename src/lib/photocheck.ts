// Quick photo check BEFORE OCR (pure, DOM-free, unit-tested): too dark, blurry, page cut off at the frame edge, or
// strongly tilted. Runs on a small copy (long side ~600 px) in a few milliseconds. It only WARNS (retake or continue);
// thresholds were set on the repository's test photos so that none of the good ones trigger a warning.
import { estimateSkew } from './geometry';

export type PhotoIssue = 'dark' | 'blurry' | 'cut' | 'tilted';
export interface PhotoCheck { issues: PhotoIssue[]; paper: number; sharpness: number; edgeInk: number; skew: number }

export const LIMITS = { paper: 85, sharpness: 0.17, edgeInk: 0.004, skew: 12 };

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
  // sharpness: mean of the strongest 2 % gradients, relative to the contrast (blur spreads edges over many pixels)
  const grads: number[] = [];
  for (let y = 1; y < h - 1; y += 1) for (let x = 1; x < w - 1; x += 1) {
    const i = y * w + x;
    const gx = g[i + 1] - g[i - 1], gy = g[i + w] - g[i - w];
    grads.push(Math.abs(gx) + Math.abs(gy));
  }
  grads.sort((a, b) => b - a);
  const top = grads.slice(0, Math.max(1, Math.round(grads.length * 0.02)));
  const sharpness = top.reduce((s, v) => s + v, 0) / top.length / contrast / 2;
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
  if (inkN > n * 0.002 && sharpness < LIMITS.sharpness) issues.push('blurry');
  if (edgeInk > LIMITS.edgeInk) issues.push('cut');
  if (Math.abs(skew) >= LIMITS.skew) issues.push('tilted');
  return { issues, paper, sharpness: Math.round(sharpness * 1000) / 1000, edgeInk: Math.round(edgeInk * 1000) / 1000, skew };
}
