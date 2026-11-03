// Round-4 polish on the production build (dist): own-language next step, Clear document type with a whole-line quote,
// a fresh load opens Home (saved cards stay under Saved), a double tap opens the file picker once, PDF named letterscan-.
// Usage: npm run build && node tests/e2e-polish.mjs   (ENGINE=webkit too). Uses Human Tester's letters in /workspace/qa when present.
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { launch, deviceProfile, waitCard } from './browser.mjs';

const QA = '/workspace/qa/';
const letters = [['letter-school.png', 'school'], ['letter-5.png', 'utility'], ['letter-1234.png', 'utility'], ['letter-nodollar.png', 'utility'], ['sample-letter.png', 'utility']]
  .map(([f, t]) => [existsSync(QA + f) ? QA + f : null, t]).filter(([f]) => f);
const PORT = 4193;
const LIVE = process.env.APP_URL; // e.g. the live Pages URL; then no local server
const srv = LIVE ? null : spawn('npx', ['vite', 'preview', '--host', '127.0.0.1', '--port', String(PORT), '--strictPort'], { detached: true, stdio: 'ignore' });
const BASE = LIVE ?? `http://127.0.0.1:${PORT}/`;
const SHOTS = process.env.SHOTS; // folder for screenshots (optional)
for (let i = 0; i < 60; i++) { if (await fetch(BASE).then((r) => r.ok).catch(() => false)) break; await new Promise((r) => setTimeout(r, 500)); }
let pass = 0, fail = 0;
const check = (name, ok, info = '') => { ok ? pass++ : fail++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok ? '' : '  ' + info}`); };
const browser = await launch();
try {
  const { name: _n, ...profile } = deviceProfile();
  const ctx = await browser.newContext({ ...profile, serviceWorkers: 'block', acceptDownloads: true, colorScheme: process.env.DARK ? 'dark' : 'light' });
  await ctx.addInitScript(() => { try { localStorage.setItem('actioncard.intro.v1', '1'); } catch { /* */ } });
  const page = await ctx.newPage();
  const scan = async (file) => {
    await page.goto(BASE); await page.waitForSelector('[data-testid=file-input]', { state: 'attached' });
    await page.setInputFiles('[data-testid=file-input]', file);
    await waitCard(page, { timeout: 240000 });
  };
  for (const [file, type] of letters) {
    const n = file.split('/').pop();
    await scan(file);
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/10-${n}` });
    const next = await page.locator('[data-testid=next-action]').innerText();
    check(`${n}: next step has no "ask someone who reads the language"`, !/reads the language/i.test(next), next);
    if (type === 'school') {
      const reply = await page.locator('[data-testid=reply]').innerText().catch(() => '');
      check(`${n}: reply fits a readable letter (no "cannot fully read")`, !!reply && !/cannot fully read/.test(reply), reply.slice(0, 200));
    }
    const lang = await page.locator('[data-field=docLanguage]').innerText();
    check(`${n}: document language English shown as Clear`, /English/.test(lang) && /Clear/.test(lang), lang.slice(0, 120));
    const bar = await page.evaluate(() => { const b = document.querySelector('.action-bar'); if (!b) return null; const cs = getComputedStyle(b); const m = cs.backgroundColor.match(/rgba?\(([^)]+)\)/); const a = m ? (m[1].split(',')[3] ?? '1') : '0'; return { bg: cs.backgroundColor, alpha: Number(a), border: cs.borderTopWidth, shadow: cs.boxShadow }; });
    check(`${n}: action bar is solid with a top border`, !!bar && bar.alpha === 1 && bar.border === '1px', JSON.stringify(bar));
    if (type === 'school') {
      check(`${n}: school next step (sign and return by …)`, /Read what the school asks and do it by .*sign it and return it/.test(next), next);
      const ct = await page.locator('[data-testid=card-type]').innerText();
      check(`${n}: labelled "School letter / permission slip", not Unknown`, /School letter/.test(ct) && !/Unknown/i.test(ct), ct);
    }
    if (type) {
      const f = await page.locator('[data-field=docType]').innerText();
      check(`${n}: document type shown as Clear`, /Clear/.test(f) && !/Check this|Guess/.test(f.split('\n').slice(0, 3).join(' ')), f.slice(0, 200));
    }
  }
  // 3. fresh load opens Home; a saved card stays under Saved
  await scan(letters[1][0]);
  await page.click('[data-testid=save-btn]');
  await page.waitForTimeout(500);
  await page.reload(); await page.waitForTimeout(800);
  check('reload after a result opens Home, not the last result', await page.locator('[data-testid=file-input]').count() === 1 && !(await page.locator('[data-testid=action-card]').isVisible().catch(() => false)));
  await page.click('[data-testid=tab-history]');
  const saved = await page.waitForSelector('[data-testid=history-item]', { timeout: 10000 }).then(() => true).catch(() => false);
  check('the saved card is still under Saved', saved);
  // 5. PDF name
  await page.locator('[data-testid=history-item]').first().click();
  await waitCard(page);
  const pdfBtn = page.locator('[data-testid=pdf-btn]');
  if (await pdfBtn.count()) {
    const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 20000 }).catch(() => null), pdfBtn.click()]);
    check('PDF export is named letterscan-YYYY-MM-DD-….pdf', !!dl && /^letterscan-\d{4}-\d{2}-\d{2}-.+\.pdf$/.test(dl.suggestedFilename()), dl?.suggestedFilename());
  } else check('PDF button present', false);
  // 4. double tap on "Choose photo or PDF" opens the picker once
  await page.goto(BASE); await page.evaluate(() => sessionStorage.clear()); await page.reload();
  await page.waitForSelector('[data-testid=upload-btn]');
  let choosers = 0;
  page.on('filechooser', () => { choosers++; });
  await page.locator('[data-testid=upload-btn]').dblclick();
  await page.waitForTimeout(1500);
  check('double tap opens the file picker once', choosers === 1, `opened ${choosers}x`);
  await page.waitForTimeout(500);
  await page.locator('[data-testid=upload-btn]').click(); await page.waitForTimeout(800);
  check('a later single tap opens it again', choosers === 2, `opened ${choosers}x`);
  // 6. a file that is not a photo or PDF: clear message on Home, never silent
  await page.goto(BASE); await page.waitForSelector('[data-testid=file-input]', { state: 'attached' });
  const acc = await page.locator('[data-testid=file-input]').getAttribute('accept');
  check('picker accepts only images and PDF', acc === 'image/*,application/pdf,.pdf', acc);
  await page.setInputFiles('[data-testid=file-input]', { name: 'notes.txt', mimeType: 'text/plain', buffer: Buffer.from('hello, this is not a photo') });
  const err = await page.waitForSelector('[data-testid=scan-error]', { timeout: 10000 }).then((h) => h.innerText()).catch(() => '');
  check('.txt file: "This file can\'t be read. Pick a photo or PDF." shown', /This file can't be read\. Pick a photo or PDF\./.test(err), err);
  check('.txt file: message is on screen (scrolled into view)', await page.locator('[data-testid=scan-error]').isVisible() && await page.evaluate(() => { const r = document.querySelector('[data-testid=scan-error]').getBoundingClientRect(); return r.top >= 0 && r.bottom <= innerHeight; }));
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/20-odd-file.png` });
  await page.setInputFiles('[data-testid=file-input]', { name: 'broken.png', mimeType: 'image/png', buffer: Buffer.from('not really a png') });
  const err2 = await page.waitForFunction(() => document.querySelector('[data-testid=scan-error]')?.textContent?.includes('could not be opened'), null, { timeout: 15000 }).then(() => true).catch(() => false);
  check('broken image: "This picture could not be opened" shown', err2);
  // 5. no "Action Card" in what the user sees
  check('no "Action Card" / "action-card" in the page text', !/action[ -]card/i.test(await page.locator('body').innerText()));
} finally {
  await browser.close();
  try { if (srv) process.kill(-srv.pid); } catch { /* */ }
}
console.log(`${deviceProfile().name}: ${pass} polish passed, ${fail} failed`);
if (fail) process.exit(1);
