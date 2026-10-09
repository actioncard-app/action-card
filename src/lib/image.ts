/** Image loading + preprocessing for OCR (runs in the browser, on-device). */
import { findDocumentQuad, quadSize, warpQuadToGray, estimateSkew, rotateGray, type Quad } from './geometry';

export async function loadBitmap(file: Blob): Promise<ImageBitmap | HTMLImageElement> {
  try {
    return await createImageBitmap(file, { imageOrientation: 'from-image' });
  } catch {
    const url = URL.createObjectURL(file);
    try {
      const img = new Image();
      img.src = url;
      await img.decode();
      return img;
    } finally {
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    }
  }
}

function dims(src: ImageBitmap | HTMLImageElement | HTMLCanvasElement) {
  return 'naturalWidth' in src ? { w: src.naturalWidth, h: src.naturalHeight } : { w: src.width, h: src.height };
}

export function drawScaled(src: ImageBitmap | HTMLImageElement | HTMLCanvasElement, maxSide: number, minSide = 0): HTMLCanvasElement {
  const { w, h } = dims(src);
  const long = Math.max(w, h);
  let scale = Math.min(1, maxSide / long);
  if (minSide && long * scale < minSide) scale = minSide / long;
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(w * scale));
  c.height = Math.max(1, Math.round(h * scale));
  const ctx = c.getContext('2d')!;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(src, 0, 0, c.width, c.height);
  return c;
}

export function canvasToBlob(c: HTMLCanvasElement, type = 'image/jpeg', q = 0.82): Promise<Blob> {
  return new Promise((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error('toBlob failed'))), type, q));
}

export interface PreprocessInfo { quad: string; skew: number; outW: number; outH: number; ms: number }

/** Grayscale copy of an RGBA buffer. */
function toGray(d: Uint8ClampedArray, n: number): Float32Array {
  const g = new Float32Array(n);
  for (let i = 0, p = 0; p < n; i += 4, p++) g[p] = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
  return g;
}

/**
 * OCR preprocessing, all on-device:
 *  1. find the page (or screen) in the photo and flatten it (perspective correction) - phone photos are rarely
 *     taken straight on; when no clear page outline is found the whole photo is used, as before;
 *  2. scale so text is large enough for Tesseract (small / far-away pages are upscaled, huge photos downscaled);
 *  3. grayscale + flatten uneven lighting / shadows (divide by an estimated paper-brightness map);
 *  4. measure the remaining text-line rotation and straighten it (up to +-15 degrees);
 *  5. stretch contrast. Binarisation is left to Tesseract (Otsu), which does it better on a clean gray image.
 */
export function preprocessForOcr(src: ImageBitmap | HTMLImageElement | HTMLCanvasElement, maxSide = 2000): HTMLCanvasElement & { ocrInfo?: PreprocessInfo } {
  const t0 = performance.now();
  // working copy: big enough to keep detail, small enough for phone memory
  const work = drawScaled(src, 2600);
  const W0 = work.width, H0 = work.height;
  const wctx = work.getContext('2d', { willReadFrequently: true })!;
  const gray0 = toGray(wctx.getImageData(0, 0, W0, H0).data, W0 * H0);

  // 1. page detection on a ~400 px copy
  const small = drawScaled(work, 400);
  const sd = small.getContext('2d', { willReadFrequently: true })!.getImageData(0, 0, small.width, small.height);
  const found = findDocumentQuad(sd.data, small.width, small.height);
  let gray: Float32Array, W: number, H: number;
  const minLong = Math.min(1400, maxSide);
  if (found.quad) {
    const k = W0 / small.width;
    const q = found.quad.map((p) => ({ x: p.x * k, y: p.y * k })) as Quad;
    const size = quadSize(q);
    const long = Math.max(size.w, size.h);
    // flattened pages from phone photos are often small: upscale up to 1.6x (Tesseract wants ~20-30 px letters)
    const scale = Math.min(maxSide, Math.max(minLong, long * 1.6)) / long;
    W = Math.max(1, Math.round(size.w * scale)); H = Math.max(1, Math.round(size.h * scale));
    gray = warpQuadToGray(gray0, W0, H0, q, W, H);
  } else {
    const long = Math.max(W0, H0);
    const scale = Math.min(maxSide, Math.max(Math.min(1200, maxSide), long)) / long;
    W = Math.max(1, Math.round(W0 * scale)); H = Math.max(1, Math.round(H0 * scale));
    if (scale === 1) gray = gray0;
    else {
      const c = drawScaled(work, Math.max(W, H), Math.max(W, H));
      W = c.width; H = c.height;
      gray = toGray(c.getContext('2d', { willReadFrequently: true })!.getImageData(0, 0, W, H).data, W * H);
    }
  }

  // 3. lighting normalisation
  let norm = flattenLighting(gray, W, H);
  // 4. deskew
  const ink = new Uint8Array(W * H);
  for (let p = 0; p < W * H; p++) ink[p] = norm[p] < 0.55 ? 1 : 0;
  const skew = estimateSkew(ink, W, H);
  if (Math.abs(skew) >= 0.5) {
    const r = rotateGray(norm, W, H, -skew, 1);
    norm = r.data; W = r.w; H = r.h;
  }
  // 5. contrast stretch between the 1st percentile and the paper level
  const nh = new Uint32Array(1001);
  for (let p = 0; p < W * H; p++) nh[Math.round(Math.max(0, Math.min(1, norm[p])) * 1000)]++;
  let acc = 0, lo = 0;
  for (let k = 0; k <= 1000; k++) { acc += nh[k]; if (acc >= W * H * 0.01) { lo = k / 1000; break; } }
  lo = Math.min(lo, 0.6);
  const hi = 0.92;
  const c = document.createElement('canvas') as HTMLCanvasElement & { ocrInfo?: PreprocessInfo };
  c.width = W; c.height = H;
  const ctx = c.getContext('2d', { willReadFrequently: true })!;
  const img = ctx.createImageData(W, H);
  const d = img.data;
  for (let i = 0, p = 0; p < W * H; i += 4, p++) {
    const v = Math.max(0, Math.min(1, (norm[p] - lo) / (hi - lo)));
    const g = Math.round(255 * v);
    d[i] = d[i + 1] = d[i + 2] = g;
    d[i + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  c.ocrInfo = { quad: found.reason, skew, outW: W, outH: H, ms: Math.round(performance.now() - t0) };
  c.dataset.quad = found.quad ? 'found' : 'none';
  c.dataset.skew = String(skew);
  return c;
}

/** v = gray / paper brightness, where paper brightness per cell = 90th percentile of the cell (text is a minority). */
function flattenLighting(gray: Float32Array, W: number, H: number): Float32Array {
  const cell = Math.max(24, Math.round(Math.max(W, H) / 40));
  const gw = Math.ceil(W / cell), gh = Math.ceil(H / cell);
  const bg = new Float32Array(gw * gh);
  const hist = new Uint32Array(256);
  for (let gy = 0; gy < gh; gy++) {
    for (let gx = 0; gx < gw; gx++) {
      hist.fill(0);
      let n = 0;
      const x1 = Math.min(W, (gx + 1) * cell), y1 = Math.min(H, (gy + 1) * cell);
      for (let y = gy * cell; y < y1; y += 2) for (let x = gx * cell; x < x1; x += 2) { hist[Math.max(0, Math.min(255, gray[y * W + x] | 0))]++; n++; }
      let acc = 0, v = 255;
      for (let k = 0; k < 256; k++) { acc += hist[k]; if (acc >= n * 0.9) { v = k; break; } }
      bg[gy * gw + gx] = Math.max(v, 40);
    }
  }
  const norm = new Float32Array(W * H);
  for (let y = 0; y < H; y++) {
    const fy = Math.min(gh - 1, Math.max(0, y / cell - 0.5));
    const y0 = Math.floor(fy), y1 = Math.min(gh - 1, y0 + 1), ty = fy - y0;
    for (let x = 0; x < W; x++) {
      const fx = Math.min(gw - 1, Math.max(0, x / cell - 0.5));
      const x0 = Math.floor(fx), x1 = Math.min(gw - 1, x0 + 1), tx = fx - x0;
      const b = (bg[y0 * gw + x0] * (1 - tx) + bg[y0 * gw + x1] * tx) * (1 - ty) + (bg[y1 * gw + x0] * (1 - tx) + bg[y1 * gw + x1] * tx) * ty;
      norm[y * W + x] = Math.min(1, gray[y * W + x] / b);
    }
  }
  return norm;
}
