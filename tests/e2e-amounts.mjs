// Amount regression on the production build (dist): small print where OCR drops the decimal point must read 84.50
// (decimal point recovered from the pixels), other formats keep reading correctly, an amount printed with no decimal
// point is never silently turned into cents (both readings shown, kept out of the summary and next step).
// Usage: python3 scripts/make_amount_docs.py && npm run build && node tests/e2e-amounts.mjs   (ENGINE=webkit too)
// Also scans /workspace/qa/sample-letter.png (Human Tester's sample) when that file exists on this machine.
import { spawn } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { launch, deviceProfile, ENGINE, waitCard } from './browser.mjs';

const exp = JSON.parse(readFileSync('test-docs/amounts/expected.json', 'utf8'));
const docs = Object.entries(exp).map(([n, e]) => ['test-docs/amounts/' + n, e]);
const SAMPLE = '/workspace/qa/sample-letter.png';
// Human Tester's letters, when present on this machine
const QA = [[SAMPLE, { amount: 84.5, currency: 'USD', alt: null, type: 'utility', conf: 'Clear' }],
  ['/workspace/qa/letter-5.png', { amount: 5, currency: 'USD', alt: null, type: 'utility' }],
  ['/workspace/qa/letter-1234.png', { amount: 1234.56, currency: 'USD', alt: null, type: 'utility' }],
  ['/workspace/qa/letter-nodollar.png', { amount: 84.5, currency: '', alt: null, type: 'utility', conf: 'Check this' }]];
for (const q of QA.reverse()) if (existsSync(q[0])) docs.unshift(q);

const PORT = 4191;
const srv = spawn('npx', ['vite', 'preview', '--host', '127.0.0.1', '--port', String(PORT), '--strictPort'], { detached: true, stdio: 'ignore' });
const BASE = `http://127.0.0.1:${PORT}/`;
for (let i = 0; i < 60; i++) { if (await fetch(BASE).then((r) => r.ok).catch(() => false)) break; await new Promise((r) => setTimeout(r, 500)); }
let pass = 0, fail = 0;
const check = (name, ok, info = '') => { ok ? pass++ : fail++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok ? '' : '  ' + info}`); };
const browser = await launch();
try {
  const { name: dev, ...profile } = deviceProfile();
  const ctx = await browser.newContext({ ...profile, serviceWorkers: 'block' });
  // On a Pro-enabled build (the iOS app) read as a Pro subscriber via the web store mock, so the free 4-scan limit does
  // not stop the run; harmless on a Pro-off build (the mock is ignored there).
  await ctx.addInitScript(() => { try { localStorage.setItem('actioncard.intro.v1', '1'); localStorage.setItem('actioncard.pro.mock', JSON.stringify({ price: '$7.99', restore: true })); localStorage.setItem('actioncard.pro.v1', 'owned'); } catch { /* */ } });
  const page = await ctx.newPage();
  for (const [file, e] of docs) {
    await page.goto(BASE); await page.waitForSelector('[data-testid=file-input]', { state: 'attached' });
    await page.setInputFiles('[data-testid=file-input]', file);
    await waitCard(page, { timeout: 240000 });
    const dv = await page.locator('[data-field=amount]').getAttribute('data-value');
    const shown = await page.locator('[data-testid=value-amount]').innerText();
    const card = await page.locator('[data-testid=action-card]').innerText();
    const summary = card.split(/DEADLINE|MONEY AT STAKE/)[0];
    const [amt, cur] = (dv ?? '').split(' ');
    const n = file.split('/').pop();
    check(`${n}: amount ${e.amount} ${e.currency}`, Math.abs(Number(amt) - e.amount) < 0.005 && cur === e.currency, `got "${dv}" shown "${shown}"`);
    if (e.alt !== null) {
      check(`${n}: both readings shown (${e.alt} / ${e.amount})`, shown.includes('/') && /84\.50/.test(shown) && /8,450/.test(shown), shown);
      check(`${n}: doubtful amount not stated in the summary`, !/84\.50|8,450/.test(summary), summary);
      check(`${n}: doubtful amount not stated in the next step`, !/84\.50|8,450/.test(await page.locator('[data-testid=next-action]').innerText()));
    } else check(`${n}: one reading only`, !shown.includes(' / '), shown);
    if (e.type) check(`${n}: utility bill`, /utility/i.test(await page.locator('[data-testid=card-type]').innerText()));
    if (e.conf) check(`${n}: amount marked "${e.conf}"`, (await page.locator('[data-field=amount]').innerText()).includes(e.conf), await page.locator('[data-field=amount]').innerText());
    if (e.conf === 'Check this') check(`${n}: "Check this" amount not stated in the summary`, !/84\.50/.test(summary), summary);
    // result screen: tabs visible, Save / PDF / New scan not covered by them
    await page.waitForTimeout(600); // the card's entry animation (transform) ends
    const geo = await page.evaluate(() => {
      const tabs = document.querySelector('.tabs'); const bar = document.querySelector('.action-bar');
      if (!tabs || !bar) return null;
      const t = tabs.getBoundingClientRect(), b = bar.getBoundingClientRect();
      const btns = [...bar.querySelectorAll('button')].map((x) => x.getBoundingClientRect());
      const cs = getComputedStyle(bar); let a = bar.parentElement, anc = []; while (a) { const c = getComputedStyle(a); if (c.transform !== 'none' || c.filter !== 'none' || c.contain !== 'none' || c.willChange !== 'auto' || c.containerType !== 'normal') anc.push(a.className + ':' + c.transform + c.contain + c.willChange + c.containerType); a = a.parentElement; }
      return { pos: cs.position, anc, appClass: document.querySelector('.app')?.className, tabsVisible: getComputedStyle(tabs).display !== 'none' && t.height > 0, overlap: btns.some((r) => r.bottom > t.top + 0.5), barBottom: b.bottom, tabsTop: t.top };
    });
    check(`${n}: tabs shown on the result, action buttons above them`, !!geo && geo.tabsVisible && !geo.overlap, JSON.stringify(geo));
    await page.evaluate(() => sessionStorage.clear());
  }
} finally {
  await browser.close();
  try { process.kill(-srv.pid); } catch { /* */ }
}
console.log(`${deviceProfile().name}: ${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
