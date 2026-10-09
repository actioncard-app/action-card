/**
 * Pure (DOM-free) image geometry for OCR preprocessing, so it can be unit-tested in Node:
 *  - findDocumentQuad: find the sheet of paper / screen in a phone photo (background flood-fill from the frame edges)
 *  - warpQuadToGray:   perspective-correct ("flatten") that quadrilateral into an upright rectangle
 *  - estimateSkew / rotateGray: detect and undo the remaining text-line rotation (projection-profile method)
 * Everything works on plain typed arrays; callers convert to/from canvas ImageData.
 */

export type Pt = { x: number; y: number };
export type Quad = [Pt, Pt, Pt, Pt]; // top-left, top-right, bottom-right, bottom-left

export interface QuadResult { quad: Quad | null; reason: string }

/**
 * rgba: RGBA bytes of a SMALL copy of the photo (long side ~300-500 px), w x h.
 * Returns the document corners in that small image's coordinates, or null with a reason (then the caller
 * keeps the whole photo). Deliberately conservative: when in doubt, no crop.
 */
export function findDocumentQuad(rgba: Uint8ClampedArray, w: number, h: number): QuadResult {
  // Try a permissive background colour tolerance first, then stricter ones (a shadowed page edge can let the
  // permissive flood leak into the page; the shape checks below then reject that attempt).
  const reasons: string[] = [];
  for (const [globalTol, stepTol] of [[60, 14], [40, 9], [25, 6]]) {
    const r = attempt(rgba, w, h, globalTol, stepTol);
    if (r.quad) return r;
    reasons.push(r.reason);
    if (r.final) break;
  }
  return { quad: null, reason: reasons.join('; ') };
}

function attempt(rgba: Uint8ClampedArray, w: number, h: number, GLOBAL: number, STEP: number): QuadResult & { final?: boolean } {
  const n = w * h;
  const r = new Float32Array(n), g = new Float32Array(n), b = new Float32Array(n);
  for (let i = 0, p = 0; p < n; i += 4, p++) { r[p] = rgba[i]; g[p] = rgba[i + 1]; b[p] = rgba[i + 2]; }
  // Background colour = median of a 2px ring along the frame edges.
  const ring: number[] = [];
  for (let x = 0; x < w; x++) for (const y of [0, 1, h - 2, h - 1]) ring.push(y * w + x);
  for (let y = 2; y < h - 2; y++) for (const x of [0, 1, w - 2, w - 1]) ring.push(y * w + x);
  const med = (a: Float32Array) => { const v = ring.map((p) => a[p]).sort((m, k) => m - k); return v[v.length >> 1]; };
  const bg = [med(r), med(g), med(b)];
  const lum = (p: number) => 0.299 * r[p] + 0.587 * g[p] + 0.114 * b[p];
  const dist = (p: number, c: number[]) => Math.max(Math.abs(r[p] - c[0]), Math.abs(g[p] - c[1]), Math.abs(b[p] - c[2]));
  const ringNear = ring.filter((p) => dist(p, bg) < GLOBAL).length / ring.length;
  if (ringNear < 0.6) return { quad: null, reason: 'frame edges are not a uniform background (document may fill the photo)', final: true };
  const bgLum = 0.299 * bg[0] + 0.587 * bg[1] + 0.114 * bg[2];
  const bgSat = Math.max(...bg) - Math.min(...bg);

  // Region-grow the background from the frame edges: small steps between neighbours, close to the edge colour.
  const isBg = new Uint8Array(n);
  const stack: number[] = [];
  for (const p of ring) if (dist(p, bg) < GLOBAL && !isBg[p]) { isBg[p] = 1; stack.push(p); }
  while (stack.length) {
    const p = stack.pop()!;
    const x = p % w, y = (p / w) | 0;
    const nb = [x > 0 ? p - 1 : -1, x < w - 1 ? p + 1 : -1, y > 0 ? p - w : -1, y < h - 1 ? p + w : -1];
    for (const q of nb) {
      if (q < 0 || isBg[q]) continue;
      if (dist(q, [r[p], g[p], b[p]]) < STEP && dist(q, bg) < GLOBAL) { isBg[q] = 1; stack.push(q); }
    }
  }
  // Largest connected non-background component = the document (its text/holes are included automatically,
  // because they are not reachable from the frame edges).
  const label = new Int32Array(n).fill(-1);
  let bestId = -1, bestSize = 0;
  for (let s = 0, id = 0; s < n; s++) {
    if (isBg[s] || label[s] >= 0) continue;
    let size = 0; stack.push(s); label[s] = id;
    while (stack.length) {
      const p = stack.pop()!; size++;
      const x = p % w, y = (p / w) | 0;
      const nb = [x > 0 ? p - 1 : -1, x < w - 1 ? p + 1 : -1, y > 0 ? p - w : -1, y < h - 1 ? p + w : -1];
      for (const q of nb) if (q >= 0 && !isBg[q] && label[q] < 0) { label[q] = id; stack.push(q); }
    }
    if (size > bestSize) { bestSize = size; bestId = id; }
    id++;
  }
  if (bestSize < n * 0.15) return { quad: null, reason: `no large document region (${Math.round((100 * bestSize) / n)}% of photo)` };
  // Corners = extremes of x+y and x-y over the component (valid for rotations well below 45 degrees).
  let tl = 0, br = 0, tr = 0, bl = 0, minS = Infinity, maxS = -Infinity, minD = Infinity, maxD = -Infinity;
  let docLum = 0;
  for (let p = 0; p < n; p++) {
    if (label[p] !== bestId) continue;
    const x = p % w, y = (p / w) | 0, s = x + y, d = x - y;
    if (s < minS) { minS = s; tl = p; } if (s > maxS) { maxS = s; br = p; }
    if (d > maxD) { maxD = d; tr = p; } if (d < minD) { minD = d; bl = p; }
    docLum += lum(p);
  }
  docLum /= bestSize;
  const P = (p: number): Pt => ({ x: (p % w) + 0.5, y: ((p / w) | 0) + 0.5 });
  let quad: Quad = [P(tl), P(tr), P(br), P(bl)];
  const fill0 = bestSize / Math.max(1, quadArea(quad));
  if (fill0 < 0.9 || fill0 > 1.06) return { quad: null, reason: `document region is not a quadrilateral (fill ${fill0.toFixed(2)})` };
  // Corner extremes can sit slightly inside a page whose edges bulge (curl, shadows, lens distortion).
  // Never cut the page: grow the quad about its centre until it holds >= 99.5% of the page pixels (max +5%, else no crop).
  const cx = (quad[0].x + quad[1].x + quad[2].x + quad[3].x) / 4, cy = (quad[0].y + quad[1].y + quad[2].y + quad[3].y) / 4;
  const base = quad;
  let grown = false;
  for (let k = 0; k <= 5; k++) {
    const sc = 1 + k * 0.01;
    const q = base.map((p) => ({ x: cx + (p.x - cx) * sc, y: cy + (p.y - cy) * sc })) as Quad;
    let outside = 0;
    for (let p = 0; p < n; p += 2) if (label[p] === bestId && !insideQuad(q, (p % w) + 0.5, ((p / w) | 0) + 0.5)) outside++;
    quad = q;
    if (outside * 2 <= bestSize * 0.005) { grown = true; break; }
  }
  if (!grown) return { quad: null, reason: 'page outline is not a clean quadrilateral' };
  const area = quadArea(quad);
  if (area < n * 0.15) return { quad: null, reason: 'corner quad too small' };
  const fill = bestSize / area;
  for (let i = 0; i < 4; i++) {
    const a = quad[(i + 3) % 4], o = quad[i], c = quad[(i + 1) % 4];
    const ang = (Math.acos(((a.x - o.x) * (c.x - o.x) + (a.y - o.y) * (c.y - o.y)) / (Math.hypot(a.x - o.x, a.y - o.y) * Math.hypot(c.x - o.x, c.y - o.y) + 1e-9)) * 180) / Math.PI;
    if (ang < 60 || ang > 120) return { quad: null, reason: `corner angle ${ang.toFixed(0)} deg is implausible` };
  }
  // The found region must look like a page compared with its surroundings (brighter or clearly different colour).
  if (docLum < bgLum + 12 && bgSat < 40) return { quad: null, reason: 'document is not brighter than the background' };
  // Nothing to gain if the quad is (almost) the whole frame and axis-aligned.
  const nearFrame = quad.every((q, i) => Math.abs(q.x - [0, w, w, 0][i]) < w * 0.02 && Math.abs(q.y - [0, 0, h, h][i]) < h * 0.02);
  if (nearFrame) return { quad: null, reason: 'document already fills the frame' };
  return { quad, reason: `document found (fill ${fill.toFixed(2)}, ${Math.round((100 * area) / n)}% of photo)` };
}

function insideQuad(q: Quad, x: number, y: number): boolean {
  let sgn = 0;
  for (let i = 0; i < 4; i++) {
    const a = q[i], b = q[(i + 1) % 4];
    const c = Math.sign((b.x - a.x) * (y - a.y) - (b.y - a.y) * (x - a.x));
    if (c === 0) continue;
    if (sgn === 0) sgn = c; else if (c !== sgn) return false;
  }
  return true;
}

export function quadArea(q: Quad): number {
  let a = 0;
  for (let i = 0; i < 4; i++) { const p = q[i], c = q[(i + 1) % 4]; a += p.x * c.y - c.x * p.y; }
  return Math.abs(a) / 2;
}

/** Output size of the flattened page: average opposite edge lengths, aspect kept. */
export function quadSize(q: Quad): { w: number; h: number } {
  const d = (a: Pt, b: Pt) => Math.hypot(a.x - b.x, a.y - b.y);
  return { w: (d(q[0], q[1]) + d(q[3], q[2])) / 2, h: (d(q[0], q[3]) + d(q[1], q[2])) / 2 };
}

/** Homography mapping the unit rectangle (0,0)-(W,H) onto quad (solve 8x8 by Gaussian elimination). */
export function homography(W: number, H: number, q: Quad): number[] {
  const src = [[0, 0], [W, 0], [W, H], [0, H]];
  const A: number[][] = [];
  for (let i = 0; i < 4; i++) {
    const [x, y] = src[i], { x: u, y: v } = q[i];
    A.push([x, y, 1, 0, 0, 0, -u * x, -u * y, u]);
    A.push([0, 0, 0, x, y, 1, -v * x, -v * y, v]);
  }
  for (let c = 0; c < 8; c++) {
    let piv = c;
    for (let k = c + 1; k < 8; k++) if (Math.abs(A[k][c]) > Math.abs(A[piv][c])) piv = k;
    [A[c], A[piv]] = [A[piv], A[c]];
    for (let k = 0; k < 8; k++) {
      if (k === c) continue;
      const f = A[k][c] / A[c][c];
      for (let j = c; j < 9; j++) A[k][j] -= f * A[c][j];
    }
  }
  const hm = A.map((row, i) => row[8] / A[i][i]);
  return [...hm, 1];
}

/** Bilinear sample of a gray image, out-of-range -> fill. */
function sample(gray: Float32Array, w: number, h: number, x: number, y: number, fill: number): number {
  if (x < 0 || y < 0 || x > w - 1 || y > h - 1) return fill;
  const x0 = Math.floor(x), y0 = Math.floor(y), x1 = Math.min(w - 1, x0 + 1), y1 = Math.min(h - 1, y0 + 1);
  const tx = x - x0, ty = y - y0;
  return (gray[y0 * w + x0] * (1 - tx) + gray[y0 * w + x1] * tx) * (1 - ty) + (gray[y1 * w + x0] * (1 - tx) + gray[y1 * w + x1] * tx) * ty;
}

/** Flatten quad (in gray-image coordinates) into an outW x outH upright gray image. */
export function warpQuadToGray(gray: Float32Array, w: number, h: number, q: Quad, outW: number, outH: number): Float32Array {
  const m = homography(outW, outH, q);
  const out = new Float32Array(outW * outH);
  for (let y = 0; y < outH; y++) {
    for (let x = 0; x < outW; x++) {
      const X = x + 0.5, Y = y + 0.5;
      const z = m[6] * X + m[7] * Y + m[8];
      out[y * outW + x] = sample(gray, w, h, (m[0] * X + m[1] * Y + m[2]) / z - 0.5, (m[3] * X + m[4] * Y + m[5]) / z - 0.5, 255);
    }
  }
  return out;
}

/**
 * Text-line skew in degrees (positive = text rises to the right... i.e. rotate by -angle to fix), from the
 * projection profile of dark pixels. `ink` = 1 for text pixels. Returns 0 when there is too little text.
 */
export function estimateSkew(ink: Uint8Array, w: number, h: number, maxDeg = 20): number {
  const xs: number[] = [], ys: number[] = [];
  const step = Math.max(1, Math.round(Math.sqrt((w * h) / 400000)));
  // Ignore solid dark areas (shadows, table showing at the page edge, photos): only thin strokes count as text.
  const R = Math.max(4, Math.round(Math.max(w, h) / 200));
  const S = new Uint32Array((w + 1) * (h + 1));
  for (let y = 0; y < h; y++) { let row = 0; for (let x = 0; x < w; x++) { row += ink[y * w + x]; S[(y + 1) * (w + 1) + x + 1] = S[y * (w + 1) + x + 1] + row; } }
  const dens = (x: number, y: number) => {
    const x0 = Math.max(0, x - R), y0 = Math.max(0, y - R), x1 = Math.min(w, x + R + 1), y1 = Math.min(h, y + R + 1);
    return (S[y1 * (w + 1) + x1] - S[y0 * (w + 1) + x1] - S[y1 * (w + 1) + x0] + S[y0 * (w + 1) + x0]) / ((x1 - x0) * (y1 - y0));
  };
  for (let y = 0; y < h; y += step) for (let x = 0; x < w; x += step) if (ink[y * w + x] && dens(x, y) < 0.6) { xs.push(x); ys.push(y); }
  if (xs.length < 200) return 0;
  const diag = Math.ceil(Math.hypot(w, h)) + 2;
  const bins = new Float64Array(diag * 2);
  const score = (deg: number) => {
    const a = (deg * Math.PI) / 180, c = Math.cos(a), s = Math.sin(a);
    bins.fill(0);
    for (let i = 0; i < xs.length; i++) bins[Math.round(ys[i] * c - xs[i] * s) + diag]++;
    let v = 0;
    for (let i = 0; i < bins.length; i++) v += bins[i] * bins[i];
    return v;
  };
  let best = 0, bestV = -1;
  for (let d = -maxDeg; d <= maxDeg + 1e-9; d += 0.5) { const v = score(d); if (v > bestV) { bestV = v; best = d; } }
  const coarse = best;
  for (let d = coarse - 0.5; d <= coarse + 0.5 + 1e-9; d += 0.1) { const v = score(d); if (v > bestV) { bestV = v; best = d; } }
  // a peak only marginally better than 0 deg is noise
  if (Math.abs(best) > 0 && bestV < score(0) * 1.03) return 0;
  return Math.round(best * 10) / 10;
}

/** Rotate a gray image by `deg` (same sign convention as estimateSkew's result, i.e. pass -skew to fix). */
export function rotateGray(gray: Float32Array, w: number, h: number, deg: number, fill: number): { data: Float32Array; w: number; h: number } {
  const a = (deg * Math.PI) / 180, c = Math.cos(a), s = Math.sin(a);
  const W = Math.ceil(Math.abs(w * c) + Math.abs(h * s)), H = Math.ceil(Math.abs(w * s) + Math.abs(h * c));
  const out = new Float32Array(W * H);
  const cx = w / 2, cy = h / 2, CX = W / 2, CY = H / 2;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const dx = x - CX, dy = y - CY;
      // inverse rotation
      out[y * W + x] = sample(gray, w, h, c * dx + s * dy + cx, -s * dx + c * dy + cy, fill);
    }
  }
  return { data: out, w: W, h: H };
}
