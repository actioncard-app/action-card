// Real end-to-end accuracy test: drives the BUILT app in headless Chromium, uploads each
// sample image through the gallery file input, waits for the card, and reads the extracted
// values from the DOM. Uses the app's real preprocessing + Tesseract.js (WASM) + rule extractor.
// Usage: node tests/ocr-accuracy.mjs   (app must be served at APP_URL, default http://localhost:4173/)
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { launch, BASE, MOBILE } from './browser.mjs';

const expected = JSON.parse(readFileSync('test-docs/expected.json', 'utf8'));
const only = process.argv[2];
mkdirSync('test-results', { recursive: true });
const browser = await launch();
const ctx = await browser.newContext({ ...MOBILE });
const page = await ctx.newPage();
page.on('pageerror', (e) => console.log('PAGE ERROR', e.message));
await page.goto(BASE);
await page.evaluate(() => localStorage.clear());
const texts = {}, rows = [];
for (const [file, e] of Object.entries(expected)) {
  if (only && !file.includes(only)) continue;
  await page.goto(BASE);
  const t0 = Date.now();
  await page.setInputFiles('[data-testid=file-input]', `test-docs/${file}`);
  await page.waitForSelector('[data-testid=action-card]', { timeout: 180000 });
  const ms = Date.now() - t0;
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
  rows.push({ file, set: e.set ?? 'dev', ms, expected: e, got });
  console.log(`${file}: ${ms} ms`);
}
await browser.close();
writeFileSync('test-results/ocr-text.json', JSON.stringify(texts, null, 2));
writeFileSync('test-results/browser-run.json', JSON.stringify(rows, null, 2));

// score
const F = ['docLanguage', 'docType', 'deadline', 'amount', 'currency', 'reference'];
const CORE = ['docType', 'deadline', 'amount', 'currency'];
const same = (f, exp, g) => f === 'amount' ? (exp === null ? g === null : g !== null && Math.abs(g - exp) < 0.005)
  : f === 'reference' ? (exp === null ? g === null : g !== null && g.replace(/\s/g, '') === exp) : (exp ?? null) === (g ?? null);
const tally = {};
const lines = [];
for (const r of rows) {
  const parts = [];
  for (const f of F) {
    const ok = same(f, r.expected[f] ?? null, r.got[f] ?? null);
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
const report = lines.join('\n');
console.log('\n' + report);
writeFileSync('test-results/accuracy-report.txt', report + '\n');
