// Dev helper: run the app's real preprocessing (src/lib/image.ts) in Chromium on given images and save the
// result PNGs + info. Needs the Vite dev server: npx vite --port 4181 --strictPort
// Usage: node tests/debug-preprocess.mjs out-dir img1 img2 ...
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { basename } from 'node:path';
import { launch } from './browser.mjs';
const [out, ...files] = process.argv.slice(2);
mkdirSync(out, { recursive: true });
const browser = await launch('chromium');
const page = await browser.newPage();
await page.goto((process.env.DEV_URL ?? 'http://127.0.0.1:4181/') + 'robots.txt', { waitUntil: 'commit' });
const info = {};
for (const f of files) {
  const b64 = readFileSync(f).toString('base64');
  const r = await page.evaluate(async (b64) => {
    const { loadBitmap, preprocessForOcr } = await import('/src/lib/image.ts');
    const blob = await (await fetch('data:image/jpeg;base64,' + b64)).blob();
    const bmp = await loadBitmap(blob);
    const c = preprocessForOcr(bmp, 2000);
    return { info: c.ocrInfo, png: c.toDataURL('image/png').split(',')[1] };
  }, b64);
  writeFileSync(`${out}/${basename(f).replace(/\.\w+$/, '')}.png`, Buffer.from(r.png, 'base64'));
  info[basename(f)] = r.info;
  console.log(basename(f), JSON.stringify(r.info));
}
writeFileSync(`${out}/info.json`, JSON.stringify(info, null, 1));
await browser.close();
