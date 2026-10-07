// Diagnostic: does context.route intercept the app's fetch to api.x.ai in WebKit, with and without the service worker?
import { launch, deviceProfile } from './browser.mjs';
const engine = process.argv[2] ?? 'webkit';
for (const sw of ['allow', 'block']) {
  const b = await launch(engine);
  const { name, ...dev } = deviceProfile(engine);
  const ctx = await b.newContext({ ...dev, serviceWorkers: sw });
  const seen = [];
  await ctx.route('https://api.x.ai/**', (r) => { seen.push(`${r.request().method()} ${r.request().url()}`); return r.fulfill({ status: 401, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: '{"error":"x"}' }); });
  const p = await ctx.newPage();
  const net = [];
  p.on('request', (q) => { if (q.url().includes('x.ai')) net.push(`req ${q.method()} ${q.url()} sw=${!!q.serviceWorker?.()}`); });
  p.on('requestfailed', (q) => { if (q.url().includes('x.ai')) net.push(`failed ${q.failure()?.errorText}`); });
  p.on('response', (q) => { if (q.url().includes('x.ai')) net.push(`resp ${q.status()} fromSW=${q.fromServiceWorker()}`); });
  await p.goto('http://localhost:4173/');
  if (sw === 'allow') { await p.evaluate(async () => { await navigator.serviceWorker.ready; }); await p.reload(); }
  const controlled = await p.evaluate(() => !!navigator.serviceWorker?.controller);
  const res = await p.evaluate(async () => {
    try { const r = await fetch('https://api.x.ai/v1/chat/completions', { method: 'POST', headers: { 'content-type': 'application/json', authorization: 'Bearer fake' }, body: '{"model":"m"}' }); return `status ${r.status}`; }
    catch (e) { return `error ${e.message}`; }
  });
  console.log(engine, `sw=${sw}`, `controlled=${controlled}`, '->', res, '| routed:', JSON.stringify(seen), '| net:', JSON.stringify(net));
  await b.close();
}
