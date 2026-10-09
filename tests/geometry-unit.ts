// Unit tests for the DOM-free geometry used by OCR preprocessing (src/lib/geometry.ts).
// Usage: npx tsx tests/geometry-unit.ts
import { estimateSkew, rotateGray, findDocumentQuad, homography, type Quad } from '../src/lib/geometry.ts';

let fails = 0;
const check = (name: string, ok: boolean, extra = '') => { console.log(`${ok ? 'PASS' : 'FAIL'} ${name} ${extra}`); if (!ok) fails++; };

// Synthetic "text": dashed horizontal lines on white, then rotated by a known angle.
function page(w: number, h: number): Float32Array {
  const g = new Float32Array(w * h).fill(1);
  for (let y = 60; y < h - 60; y += 28) for (let x = 60; x < w - 60; x++) if ((x >> 4) % 3 !== 0) for (let t = 0; t < 6; t++) g[(y + t) * w + x] = 0;
  return g;
}
const ink = (g: Float32Array) => Uint8Array.from(g, (v) => (v < 0.55 ? 1 : 0));
for (const deg of [-12, -7, -3, 0, 2.5, 6, 11]) {
  const base = page(800, 1000);
  const rot = rotateGray(base, 800, 1000, deg, 1);
  const est = estimateSkew(ink(rot.data), rot.w, rot.h);
  // estimateSkew returns the angle to undo with rotateGray(-est); rotating by `deg` should give est == deg
  check(`skew estimate for ${deg} deg`, Math.abs(est - deg) <= 0.3, `(got ${est})`);
  const fixed = rotateGray(rot.data, rot.w, rot.h, -est, 1);
  const again = estimateSkew(ink(fixed.data), fixed.w, fixed.h);
  check(`after straightening ${deg} deg`, Math.abs(again) <= 0.3, `(residual ${again})`);
}
check('no text -> 0', estimateSkew(new Uint8Array(500 * 500), 500, 500) === 0);

// Homography maps rectangle corners onto the quad
const q: Quad = [{ x: 10, y: 20 }, { x: 300, y: 5 }, { x: 320, y: 410 }, { x: 0, y: 400 }];
const m = homography(200, 300, q);
const map = (x: number, y: number) => { const z = m[6] * x + m[7] * y + m[8]; return [(m[0] * x + m[1] * y + m[2]) / z, (m[3] * x + m[4] * y + m[5]) / z]; };
const corners = [[0, 0], [200, 0], [200, 300], [0, 300]].map(([x, y]) => map(x, y));
check('homography corners', corners.every(([x, y], i) => Math.abs(x - q[i].x) < 1e-6 && Math.abs(y - q[i].y) < 1e-6));

// Document detection: a light tilted page on a darker table is found; a page filling the frame is left alone.
function rgbaScene(w: number, h: number, quad: Quad | null): Uint8ClampedArray {
  const d = new Uint8ClampedArray(w * h * 4);
  const inside = (x: number, y: number) => {
    if (!quad) return true;
    let s = 0;
    for (let i = 0; i < 4; i++) { const a = quad[i], b = quad[(i + 1) % 4]; s += Math.sign((b.x - a.x) * (y - a.y) - (b.y - a.y) * (x - a.x)); }
    return Math.abs(s) === 4;
  };
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = (y * w + x) * 4, p = inside(x, y);
    const text = p && y % 12 < 3 && x % 7 < 5 && x > 0.3 * w && x < 0.7 * w && y > 0.3 * h && y < 0.7 * h;
    const v = text ? 30 : p ? 235 - y * 0.05 : 0;
    d[i] = p ? v : 120 + (x % 3); d[i + 1] = p ? v : 95; d[i + 2] = p ? v - 5 : 70; d[i + 3] = 255;
  }
  return d;
}
const tq: Quad = [{ x: 70, y: 40 }, { x: 300, y: 60 }, { x: 290, y: 370 }, { x: 50, y: 350 }];
const found = findDocumentQuad(rgbaScene(360, 400, tq), 360, 400);
check('page on table found', !!found.quad && found.quad.every((p, i) => Math.hypot(p.x - tq[i].x, p.y - tq[i].y) < 4), found.reason);
const full = findDocumentQuad(rgbaScene(360, 400, null), 360, 400);
check('page filling the frame -> no crop', full.quad === null, full.reason);

if (fails) { console.error(`${fails} geometry test(s) failed`); process.exit(1); }
console.log('All geometry tests passed');
