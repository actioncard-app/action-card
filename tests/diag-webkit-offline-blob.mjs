import { launch } from './browser.mjs';
import { readFileSync } from 'node:fs';
const engine = process.argv[2] ?? 'webkit';
const b = await launch(engine); const ctx = await b.newContext(); const p = await ctx.newPage();
await p.goto('http://localhost:4173/');
const b64 = readFileSync('test-docs/it_hotel_cancellation.jpg').toString('base64');
const run = () => p.evaluate(async (b64) => {
  const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0)); const blob = new Blob([bytes], { type: 'image/jpeg' });
  const out = {};
  try { const bm = await createImageBitmap(blob, { imageOrientation: 'from-image' }); out.cibOpts = `ok ${bm.width}`; } catch (e) { out.cibOpts = 'fail ' + e.name + ' ' + e.message; }
  try { const bm = await createImageBitmap(blob); out.cib = `ok ${bm.width}`; } catch (e) { out.cib = 'fail ' + e.name + ' ' + e.message; }
  try { const u = URL.createObjectURL(blob); const i = new Image(); i.src = u; await i.decode(); out.blobUrl = `ok ${i.naturalWidth}`; } catch (e) { out.blobUrl = 'fail ' + e.message; }
  try { const d = await new Promise((r, j) => { const fr = new FileReader(); fr.onload = () => r(fr.result); fr.onerror = () => j(fr.error); fr.readAsDataURL(blob); }); const i = new Image(); i.src = d; await i.decode(); out.dataUrl = `ok ${i.naturalWidth}`; } catch (e) { out.dataUrl = 'fail ' + e.message; }
  return out;
}, b64);
console.log(engine, 'online ', JSON.stringify(await run()));
await ctx.setOffline(true);
console.log(engine, 'offline', JSON.stringify(await run()));
await b.close();
