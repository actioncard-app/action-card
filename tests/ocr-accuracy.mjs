// Real end-to-end accuracy test: drives the BUILT app in headless Chromium, uploads each
// sample image through the gallery file input, waits for the card, and reads the extracted
// values from the DOM. Uses the app's real preprocessing + Tesseract.js (WASM) + rule extractor.
// Usage: node tests/ocr-accuracy.mjs [filter]   (app must be served at APP_URL, default http://localhost:4173/)
// DOCS=test-docs/phone OUT=phone-before node tests/ocr-accuracy.mjs   -> simulated phone photos, reports named by OUT
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { launch, BASE, MOBILE } from './browser.mjs';

const DOCS = process.env.DOCS ?? 'test-docs';
const OUT = process.env.OUT ? `-${process.env.OUT}` : '';
const expected = JSON.parse(readFileSync(`${DOCS}/expected.json`, 'utf8'));
const only = process.argv[2];
mkdirSync('test-results', { recursive: true });
const browser = await launch();
const ctx = await browser.newContext({ ...MOBILE });
let ocrLog = null;
let page;
// a fresh tab; also used to recover when the shared box runs out of memory and the renderer crashes
async function newPage() {
  if (page) await page.close().catch(() => {});
  page = await ctx.newPage();
  page.on('pageerror', (e) => console.log('PAGE ERROR', e.message));
  page.on('console', (m) => { if (m.text().startsWith('[ocr]')) ocrLog = m.text(); });
}
await newPage();
await page.goto(BASE);
await page.evaluate(() => localStorage.clear());
const texts = {}, rows = [];
// the box is shared and sometimes busy: retry a slow navigation instead of aborting the whole run
async function open() {
  for (let i = 0; ; i++) {
    try { await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 60000 }); await page.waitForSelector('[data-testid=file-input]', { state: 'attached', timeout: 60000 }); return; }
    catch (e) { if (i >= 2) throw e; console.log('navigation retry', i + 1, e.message.split('\n')[0]); }
  }
}
for (const [file, e] of Object.entries(expected)) {
  if (only && !file.includes(only)) continue;
  if (process.env.SET && (e.set ?? 'dev') !== process.env.SET) continue; // e.g. SET=phone-seen while tuning
  let ms, retried = 0;
  for (;; retried++) {
    try {
      await open();
      ocrLog = null;
      const t0 = Date.now();
      await page.setInputFiles('[data-testid=file-input]', `${DOCS}/${file}`);
      await page.waitForSelector('[data-testid=action-card]', { timeout: 180000 });
      ms = Date.now() - t0;
      break;
    } catch (err) {
      // only infrastructure failures (renderer crash / timeout) are retried; the result itself is never re-rolled
      if (retried >= 2) throw err;
      console.log(`${file}: retry after ${err.message.split('\n')[0]}`);
      await newPage();
    }
  }
  const got = await page.evaluate(() => {
    const v = (n) => document.querySelector(`[data-field=${n}]`)?.getAttribute('data-value') || null;
    const conf = (n) => document.querySelector(`[data-field=${n}] .conf`)?.textContent || null;
    const snip = (n) => document.querySelector(`[data-testid=snippet-${n}]`)?.textContent || null;
    const amt = v('amount');
    return {
      docLanguage: v('docLanguage'), docType: v('docType'), deadline: v('deadline'),
      amount: amt ? Number(amt.split(' ')[0]) : null, currency: amt ? amt.split(' ')[1] : null, reference: v('reference'),
      conf: { docType: conf('docType'), deadline: conf('deadline'), amount: conf('amount') },
      snippets: { deadline: snip('deadline'), amount: snip('amount') },
      ocr: document.querySelector('[data-testid=ocr-text] pre')?.textContent ?? '',
      next: document.querySelector('[data-testid=next-action]')?.innerText ?? '',
    };
  });
  texts[file] = got.ocr;
  rows.push({ file, set: e.set ?? 'dev', ms, retried, expected: e, got, ocrLog });
  console.log(`${file}: ${ms} ms${retried ? ` (after ${retried} crash retry)` : ''}`);
}
await browser.close();
writeFileSync(`test-results/ocr-text${OUT}.json`, JSON.stringify(texts, null, 2));
writeFileSync(`test-results/browser-run${OUT}.json`, JSON.stringify(rows, null, 2));

// score
const F = ['docLanguage', 'docType', 'deadline', 'amount', 'currency', 'reference'];
const CORE = ['docType', 'deadline', 'amount', 'currency'];
const same = (f, exp, g) => f === 'amount' ? (exp === null ? g === null : g !== null && Math.abs(g - exp) < 0.005)
  : f === 'reference' ? (exp === null ? g === null : g !== null && g.replace(/\s/g, '') === exp) : (exp ?? null) === (g ?? null);
const tally = {};
const perField = {}; // set -> field -> {ok, n}
const lines = [];
for (const r of rows) {
  const parts = [];
  for (const f of F) {
    const ok = same(f, r.expected[f] ?? null, r.got[f] ?? null);
    perField[r.set] ??= {}; perField[r.set][f] ??= { ok: 0, n: 0 }; perField[r.set][f].n++; if (ok) perField[r.set][f].ok++;
    for (const k of r.set === 'stress' ? ['stress'] : [r.set, 'all (excl. stress)']) {
      tally[k] ??= { ok: 0, n: 0, cok: 0, cn: 0 };
      tally[k].n++; if (ok) tally[k].ok++;
      if (CORE.includes(f)) { tally[k].cn++; if (ok) tally[k].cok++; }
    }
    parts.push(ok ? `${f}: OK` : `${f}: WRONG (expected ${JSON.stringify(r.expected[f] ?? null)}, got ${JSON.stringify(r.got[f] ?? null)})`);
  }
  lines.push(`[${r.set}] ${r.file}  (${(r.ms / 1000).toFixed(1)} s)\n    ${parts.join('\n    ')}\n    confidence: ${JSON.stringify(r.got.conf)}`);
}
lines.push('');
for (const [k, t] of Object.entries(tally)) lines.push(`${k.padEnd(8)} core fields (type, deadline, amount, currency): ${t.cok}/${t.cn} = ${(100 * t.cok / t.cn).toFixed(1)}%   all 6 fields: ${t.ok}/${t.n} = ${(100 * t.ok / t.n).toFixed(1)}%`);
for (const [k, pf] of Object.entries(perField)) lines.push(`${k.padEnd(14)} per field: ` + F.map((f) => `${f} ${pf[f].ok}/${pf[f].n}`).join(', '));
const times = rows.map((r) => r.ms).sort((a, b) => a - b);
lines.push(`time per document (headless desktop Chromium, includes language detection pass): median ${(times[times.length >> 1] / 1000).toFixed(1)} s, max ${(times[times.length - 1] / 1000).toFixed(1)} s`);
const report = lines.join('\n');
console.log('\n' + report);
writeFileSync(`test-results/accuracy-report${OUT}.txt`, report + '\n');
