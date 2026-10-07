/** Image loading + preprocessing for OCR (runs in the browser, on-device). */

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

function dims(src: ImageBitmap | HTMLImageElement) {
  return 'naturalWidth' in src ? { w: src.naturalWidth, h: src.naturalHeight } : { w: src.width, h: src.height };
}

export function drawScaled(src: ImageBitmap | HTMLImageElement, maxSide: number, minSide = 0): HTMLCanvasElement {
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

/**
 * OCR preprocessing: downscale (or upscale tiny images), grayscale, flatten uneven lighting /
 * shadows by dividing by an estimated paper-brightness map, then stretch contrast.
 * Binarisation is left to Tesseract (Otsu), which does it better on a clean gray image.
 */
export function preprocessForOcr(src: ImageBitmap | HTMLImageElement, maxSide = 2000): HTMLCanvasElement {
  const c = drawScaled(src, maxSide, 1200);
  const ctx = c.getContext('2d', { willReadFrequently: true })!;
  const { width: W, height: H } = c;
  const img = ctx.getImageData(0, 0, W, H);
  const d = img.data;
  const gray = new Float32Array(W * H);
  for (let i = 0, p = 0; p < W * H; i += 4, p++) gray[p] = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];

  // paper brightness per cell = 90th percentile of the cell (text is a minority of pixels)
  const cell = Math.max(24, Math.round(Math.max(W, H) / 40));
  const gw = Math.ceil(W / cell), gh = Math.ceil(H / cell);
  const bg = new Float32Array(gw * gh);
  const hist = new Uint32Array(256);
  for (let gy = 0; gy < gh; gy++) {
    for (let gx = 0; gx < gw; gx++) {
      hist.fill(0);
      let n = 0;
      const x1 = Math.min(W, (gx + 1) * cell), y1 = Math.min(H, (gy + 1) * cell);
      for (let y = gy * cell; y < y1; y += 2) for (let x = gx * cell; x < x1; x += 2) { hist[gray[y * W + x] | 0]++; n++; }
      let acc = 0, v = 255;
      for (let k = 0; k < 256; k++) { acc += hist[k]; if (acc >= n * 0.9) { v = k; break; } }
      bg[gy * gw + gx] = Math.max(v, 40);
    }
  }
  // normalise: v = gray / bilinear(bg)
  const norm = new Float32Array(W * H);
  const nh = new Uint32Array(1001);
  for (let y = 0; y < H; y++) {
    const fy = Math.min(gh - 1, Math.max(0, y / cell - 0.5));
    const y0 = Math.floor(fy), y1 = Math.min(gh - 1, y0 + 1), ty = fy - y0;
    for (let x = 0; x < W; x++) {
      const fx = Math.min(gw - 1, Math.max(0, x / cell - 0.5));
      const x0 = Math.floor(fx), x1 = Math.min(gw - 1, x0 + 1), tx = fx - x0;
      const b = (bg[y0 * gw + x0] * (1 - tx) + bg[y0 * gw + x1] * tx) * (1 - ty) + (bg[y1 * gw + x0] * (1 - tx) + bg[y1 * gw + x1] * tx) * ty;
      const v = Math.min(1, gray[y * W + x] / b);
      norm[y * W + x] = v;
      nh[Math.round(v * 1000)]++;
    }
  }
  // contrast stretch between the 1st percentile and the paper level
  let acc = 0, lo = 0;
  for (let k = 0; k <= 1000; k++) { acc += nh[k]; if (acc >= W * H * 0.01) { lo = k / 1000; break; } }
  lo = Math.min(lo, 0.6);
  const hi = 0.92;
  for (let i = 0, p = 0; p < W * H; i += 4, p++) {
    const v = Math.max(0, Math.min(1, (norm[p] - lo) / (hi - lo)));
    const g = Math.round(255 * v);
    d[i] = d[i + 1] = d[i + 2] = g;
    d[i + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  return c;
}
