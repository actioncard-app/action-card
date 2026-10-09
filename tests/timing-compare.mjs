// Interleaved timing of two builds on the same images (the box is shared, so A and B alternate to cancel load swings).
// Usage: A_URL=http://127.0.0.1:4180/ B_URL=http://127.0.0.1:4182/ node tests/timing-compare.mjs img1 img2 ...
import { launch, MOBILE } from './browser.mjs';
const A = process.env.A_URL, B = process.env.B_URL;
const browser = await launch();
const page = await (await browser.newContext({ ...MOBILE })).newPage();
let log = null;
page.on('console', (m) => { if (m.text().startsWith('[ocr]')) log = m.text(); });
async function run(base, img) {
  await page.goto(base, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForSelector('[data-testid=file-input]', { state: 'attached', timeout: 60000 });
  log = null;
  const t0 = Date.now();
  await page.setInputFiles('[data-testid=file-input]', img);
  await page.waitForSelector('[data-testid=action-card]', { timeout: 300000 });
  return { ms: Date.now() - t0, log };
}
// warm up both (first load of OCR engine + language data)
await run(A, process.argv[2]); await run(B, process.argv[2]);
const rows = [];
for (const img of process.argv.slice(2)) {
  const a = await run(A, img), b = await run(B, img);
  const pre = b.log && JSON.parse(b.log.slice(b.log.indexOf('{'))).ms;
  const passes = b.log && b.log.match(/(\d) pass/)[1];
  rows.push({ img, before: a.ms, after: b.ms, preprocessMs: pre, passes });
  console.log(`${img.split('/').pop()}: before ${a.ms} ms, after ${b.ms} ms (preprocessing ${pre} ms, ${passes} OCR passes)`);
}
const med = (k) => { const v = rows.map((r) => r[k]).sort((x, y) => x - y); return v[v.length >> 1]; };
console.log(`median: before ${med('before')} ms, after ${med('after')} ms, preprocessing ${med('preprocessMs')} ms`);
await browser.close();
