// Generates the PWA icons (PNG) and favicon.ico into public/ with no dependencies (Node zlib only), so the
// repository holds no binary files and CI produces identical icons. Design: a white card with three grey lines
// and an amber check badge on deep teal. Run: node scripts/make-icons.mjs (also part of `npm run prepare-assets`).
import { deflateSync } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const OUT = join(new URL('..', import.meta.url).pathname, 'public');
const TEAL = [15, 76, 92], AMBER = [242, 169, 59], WHITE = [255, 255, 255], GREY = [190, 200, 205];

// signed distances (negative = inside), coordinates in 0..1 units
const sdRoundRect = (x, y, x0, y0, x1, y1, r) => {
  const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2, hw = (x1 - x0) / 2 - r, hh = (y1 - y0) / 2 - r;
  const dx = Math.abs(x - cx) - hw, dy = Math.abs(y - cy) - hh;
  return Math.hypot(Math.max(dx, 0), Math.max(dy, 0)) + Math.min(Math.max(dx, dy), 0) - r;
};
const sdCircle = (x, y, cx, cy, r) => Math.hypot(x - cx, y - cy) - r;
const sdSegment = (x, y, ax, ay, bx, by, w) => {
  const px = x - ax, py = y - ay, vx = bx - ax, vy = by - ay;
  const h = Math.max(0, Math.min(1, (px * vx + py * vy) / (vx * vx + vy * vy)));
  return Math.hypot(px - vx * h, py - vy * h) - w / 2;
};

function shapes(maskable) {
  const pad = maskable ? 0.22 : 0.16;
  const x0 = pad, y0 = pad + 0.04, x1 = 1 - pad, y1 = 1 - pad - 0.04;
  const list = [{ d: (x, y) => sdRoundRect(x, y, x0, y0, x1, y1, 0.06), c: WHITE }];
  const lw = 0.035, lx = x0 + (x1 - x0) * 0.14;
  [0.62, 0.45, 0.52].forEach((frac, i) => {
    const ly = y0 + (y1 - y0) * (0.22 + i * 0.17);
    list.push({ d: (x, y) => sdRoundRect(x, y, lx, ly, lx + (x1 - x0) * frac, ly + lw, lw / 2), c: GREY });
  });
  const r = 0.15, cx = x1 - r * 0.9, cy = y1 - r * 0.9;
  list.push({ d: (x, y) => sdCircle(x, y, cx, cy, r), c: AMBER });
  const w = 0.03, p = [[cx - r * 0.45, cy], [cx - r * 0.1, cy + r * 0.38], [cx + r * 0.5, cy - r * 0.35]];
  list.push({ d: (x, y) => Math.min(sdSegment(x, y, ...p[0], ...p[1], w), sdSegment(x, y, ...p[1], ...p[2], w)), c: WHITE });
  return list;
}

function render(size, maskable = false) {
  const ss = 4, list = shapes(maskable), px = new Uint8Array(size * size * 4);
  for (let j = 0; j < size; j++) for (let i = 0; i < size; i++) {
    let r = 0, g = 0, b = 0;
    for (let sj = 0; sj < ss; sj++) for (let si = 0; si < ss; si++) {
      const x = (i + (si + 0.5) / ss) / size, y = (j + (sj + 0.5) / ss) / size;
      let c = TEAL;
      for (const s of list) if (s.d(x, y) <= 0) c = s.c;
      r += c[0]; g += c[1]; b += c[2];
    }
    const k = (j * size + i) * 4, n = ss * ss;
    px[k] = Math.round(r / n); px[k + 1] = Math.round(g / n); px[k + 2] = Math.round(b / n); px[k + 3] = 255;
  }
  return png(size, size, px);
}

const CRC = new Int32Array(256).map((_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c; });
const crc32 = (buf) => { let c = -1; for (const v of buf) c = CRC[(c ^ v) & 255] ^ (c >>> 8); return (c ^ -1) >>> 0; };
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
function png(w, h, rgba) {
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) { raw[y * (w * 4 + 1)] = 0; Buffer.from(rgba.buffer, y * w * 4, w * 4).copy(raw, y * (w * 4 + 1) + 1); }
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
}
// ICO container with embedded PNG images (supported by all current browsers)
function ico(images) {
  const head = Buffer.alloc(6); head.writeUInt16LE(0, 0); head.writeUInt16LE(1, 2); head.writeUInt16LE(images.length, 4);
  let offset = 6 + 16 * images.length; const dir = [], data = [];
  for (const { size, buf } of images) {
    const e = Buffer.alloc(16); e[0] = size >= 256 ? 0 : size; e[1] = size >= 256 ? 0 : size; e.writeUInt16LE(1, 4); e.writeUInt16LE(32, 6);
    e.writeUInt32LE(buf.length, 8); e.writeUInt32LE(offset, 12); offset += buf.length; dir.push(e); data.push(buf);
  }
  return Buffer.concat([head, ...dir, ...data]);
}

mkdirSync(OUT, { recursive: true });
writeFileSync(join(OUT, 'pwa-192x192.png'), render(192));
writeFileSync(join(OUT, 'pwa-512x512.png'), render(512));
writeFileSync(join(OUT, 'maskable-512x512.png'), render(512, true));
writeFileSync(join(OUT, 'apple-touch-icon.png'), render(180));
writeFileSync(join(OUT, 'favicon.png'), render(64));
writeFileSync(join(OUT, 'favicon.ico'), ico([16, 32, 48].map((s) => ({ size: s, buf: render(s) }))));
console.log('icons written to', OUT);
