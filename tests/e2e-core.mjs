// End-to-end checks of the free Core limits on a Pro-enabled production build (VITE_PRO_ENABLED=true npm run build),
// web store mock for Pro. Usage: node tests/e2e-core.mjs   (ENGINE=webkit for iPhone 14 emulation)
// Not covered (cannot run on Linux): real StoreKit purchase / trial, iOS camera, iOS natural voices.
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { launch, deviceProfile, ENGINE, waitCard } from './browser.mjs';

const { name: deviceName, ...MOBILE } = deviceProfile(ENGINE);
const results = [];
const check = (name, ok, detail = '') => { results.push({ name, ok: !!ok, detail }); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  — ' + detail : ''}`); };
const SHOTS = `test-results/core-${ENGINE}`; mkdirSync(SHOTS, { recursive: true });
const PORT = 4187;
const srv = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], { detached: true, stdio: 'ignore' });
const BASE = `http://127.0.0.1:${PORT}/`;
for (let i = 0; i < 60; i++) { if (await fetch(BASE).then((r) => r.ok).catch(() => false)) break; await new Promise((r) => setTimeout(r, 500)); }
const browser = await launch();
const PDF1 = 'test-docs/pdf/digital_inkasso_2pages.pdf';
const IMG = 'test-docs/de_parking_ticket.png';
const left = (pg) => pg.getAttribute('[data-testid=scans-left]', 'data-left');
const home = async (pg) => { if (await pg.locator('[data-testid=back-btn]').count()) await pg.click('[data-testid=back-btn]'); if (await pg.locator('[data-testid=new-btn]').count()) await pg.click('[data-testid=new-btn]'); await pg.click('[data-testid=tab-scan]'); await pg.waitForSelector('[data-testid=camera-btn]'); };
const scan = async (pg, file) => { await home(pg); await pg.setInputFiles('[data-testid=file-input]', file); await waitCard(pg, { timeout: 180000 }); };
const histCount = async (pg) => { await home(pg); await pg.click('[data-testid=tab-history]'); await pg.waitForSelector('[data-testid=history]'); await pg.waitForTimeout(200); return pg.locator('[data-testid=history-item]').count(); };
const newCtx = async (intro = true) => {
  const ctx = await browser.newContext({ ...MOBILE });
  await ctx.addInitScript((intro) => { try { if (!sessionStorage.getItem('t')) { sessionStorage.setItem('t', '1'); if (intro) localStorage.setItem('actioncard.intro.v1', '1'); } } catch { /* */ } }, intro);
  await ctx.route('https://api.x.ai/**', (r) => r.abort());
  const page = await ctx.newPage(); const errors = []; page.on('pageerror', (e) => errors.push(e.message));
  return { ctx, page, errors };
};
try {
 if (process.env.PRO_OFF === '1') {
  // Build with Pro switched off (VITE_PRO_ENABLED unset): nobody can buy Pro, so no Core limit applies at all
  const Z = await newCtx(); const pz = Z.page;
  await pz.goto(BASE); await pz.waitForSelector('[data-testid=camera-btn]');
  check('Pro off: no scan counter', (await pz.locator('[data-testid=scans-left]').count()) === 0);
  for (let i = 0; i < 3; i++) { await scan(pz, PDF1); await pz.click('[data-testid=save-btn]'); await pz.waitForSelector('[data-testid=save-btn][disabled]'); }
  const z = await pz.evaluate(() => ({ pages: document.querySelector('[data-testid=page-count]')?.textContent ?? '', steps: !!document.querySelector('[data-testid=steps]'), teaser: !!document.querySelector('[data-testid=steps-teaser]'), limit: !!document.querySelector('[data-testid=save-limit], [data-testid=paywall]') }));
  check('Pro off: 3 scans, both PDF pages, full steps, no limit dialog or paywall', /2 pages/.test(z.pages) && z.steps && !z.teaser && !z.limit, JSON.stringify(z));
  check('Pro off: 3 letters saved', (await histCount(pz)) === 3);
  await Z.ctx.close();
 } else {
  // 1. Sample letter is free and not counted
  const A = await newCtx(false); const page = A.page;
  await page.goto(BASE); await page.waitForSelector('[data-testid=scans-left]');
  check('new device: "2 of 2 free scans left this month"', (await left(page)) === '2' && /2 of 2 free scans left this month/.test(await page.textContent('[data-testid=scans-left]')));
  await page.click('[data-testid=try-sample]'); await waitCard(page, { timeout: 180000 });
  await home(page);
  check('sample letter does not count (still 2 left)', (await left(page)) === '2');

  // 2. Scan 1 (digital PDF, 2 pages): Core reads page 1 only; Pro features locked on the card
  await scan(page, PDF1);
  check('Core: 2-page PDF -> only page 1 read, with a note', (await page.locator('[data-testid=page-count]').count()) === 0 && /only page 1 of this PDF was read/.test((await page.textContent('[data-testid=mode-note]')) ?? ''));
  await home(page);
  check('after 1 scan: 1 left', (await left(page)) === '1');
  await scan(page, IMG);
  const card = await page.evaluate(() => { const q = (s) => document.querySelector(s); return { teaser: !!q('[data-testid=steps-teaser]'), steps: !!q('[data-testid=steps]'), reply: !!q('[data-testid=reply]'), next: (q('[data-testid=next-action]')?.textContent ?? '').length, check: !!q('[data-testid=needs-checking]'), dis: !!q('[data-testid=disclaimer]'), ocr: !!q('[data-testid=ocr-text]'), deadline: !!q('[data-field=deadline]'), amount: !!q('[data-field=amount]'), listen: !!q('[data-testid=speak-card]') || !!q('[data-testid=listen-box]'), remind: !!q('[data-testid=remind-btn]') }; });
  check('Core card: type, deadline, amount, ONE next step, source text, double-check, read aloud, reminder', card.next > 10 && card.check && card.dis && card.ocr && card.deadline && card.amount && card.listen && card.remind, JSON.stringify(card));
  check('Core card: full step plan and reply templates replaced by a Pro note', card.teaser && !card.steps && !card.reply);
  await page.click('[data-testid=steps-teaser-open]'); check('step-plan note opens the paywall', (await page.locator('[data-testid=paywall]').count()) === 1); await page.click('[data-testid=pro-close]');
  await page.click('[data-testid=pdf-btn]'); check('Core: PDF export opens the paywall (no download)', (await page.locator('[data-testid=paywall]').count()) === 1); await page.click('[data-testid=pro-close]');
  await page.click('[data-testid=share-btn]'); check('Core: share opens the paywall', (await page.locator('[data-testid=paywall]').count()) === 1); await page.click('[data-testid=pro-close]');
  await page.click('[data-testid=add-page-btn]'); check('Core: add page (multi-page) opens the paywall', (await page.locator('[data-testid=paywall]').count()) === 1); await page.click('[data-testid=pro-close]');

  // 3. 1 saved letter
  await page.click('[data-testid=save-btn]'); await page.waitForSelector('[data-testid=save-btn][disabled]');
  check('first letter saves normally', (await histCount(page)) === 1);
  check('after 2 scans: 0 left, Pro link shown', (await (async () => { await home(page); return left(page); })()) === '0' && (await page.locator('[data-testid=scans-left-pro]').count()) === 1);

  // 4. 3rd scan blocked BEFORE processing, with a clear notice + paywall
  await page.click('[data-testid=upload-btn]');
  await page.waitForSelector('[data-testid=paywall]');
  const notice = (await page.textContent('[data-testid=limit-notice]')) ?? '';
  check('3rd scan: tapping "choose" shows the limit notice in the paywall', /used your free scans/.test(notice) && /sample letter doesn’t count/.test(notice) && /come back on/.test(notice), notice.slice(0, 160));
  await page.screenshot({ path: `${SHOTS}/core-limit.png` });
  await page.click('[data-testid=pro-close]');
  await page.setInputFiles('[data-testid=file-input]', PDF1); // e.g. a file shared to the app
  await page.waitForSelector('[data-testid=paywall]');
  check('3rd scan via a file: blocked before processing (no progress, no card)', (await page.locator('[data-testid=action-card], [data-testid=processing]').count()) === 0 && (await left(page)) === '0');
  await page.click('[data-testid=pro-close]');

  // 5. Save limit: 2nd letter (after month rollover) -> replace or Pro; the open letter is never lost
  await page.evaluate(() => localStorage.setItem('letterscan.scans.v1', JSON.stringify({ month: '2020-01', n: 2 })));
  await page.reload(); await page.waitForSelector('[data-testid=scans-left]');
  check('month rollover: a counter from an old month gives 2 scans again', (await left(page)) === '2');
  await scan(page, PDF1);
  const ref = await page.getAttribute('[data-field=reference]', 'data-value');
  await page.click('[data-testid=save-btn]');
  await page.waitForSelector('[data-testid=save-limit]');
  check('saving a 2nd letter: "keeps 1 saved letter" dialog with Replace and Pro', /keeps 1 saved letter/.test(await page.textContent('[data-testid=save-limit]')) && (await page.locator('[data-testid=save-replace]').count()) === 1 && (await page.locator('[data-testid=save-limit-pro]').count()) === 1);
  await page.click('[data-testid=save-limit-close]');
  check('cancel: the letter stays open, unsaved', (await page.locator('[data-testid=action-card]').count()) === 1 && await page.isEnabled('[data-testid=save-btn]') && (await page.getAttribute('[data-field=reference]', 'data-value')) === ref);
  await page.click('[data-testid=save-btn]'); await page.waitForSelector('[data-testid=save-limit]');
  await page.click('[data-testid=save-limit-pro]');
  check('"See LetterScan Pro" from the save dialog opens the paywall', (await page.locator('[data-testid=paywall]').count()) === 1);
  await page.click('[data-testid=pro-close]');
  check('after closing the paywall the letter is still open', (await page.locator('[data-testid=action-card]').count()) === 1);
  await page.click('[data-testid=save-btn]'); await page.waitForSelector('[data-testid=save-limit]');
  await page.click('[data-testid=save-replace]'); await page.waitForSelector('[data-testid=save-btn][disabled]');
  await page.click('[data-testid=back-btn]').catch(() => {});
  const n1 = await histCount(page);
  const savedText = await page.textContent('[data-testid=history]');
  check('replace: still exactly 1 saved letter, the new one', n1 === 1 && /Inkasso|collection|debt/i.test(savedText ?? ''), `${n1}`);
  check('no page errors (Core)', A.errors.length === 0, A.errors.join(' | '));

  // 6. Paywall: 7-day free trial wording from the store (mock), 3.1.2 parts
  await page.evaluate(() => localStorage.setItem('actioncard.pro.mock', JSON.stringify({ price: '$5.99', trial: true, result: 'purchased' })));
  await page.reload(); await page.click('[data-testid=tab-settings]'); await page.click('[data-testid=pro-open]'); await page.waitForSelector('[data-testid=pro-buy]');
  await page.waitForFunction(() => document.querySelector('[data-testid=pro-buy]')?.getAttribute('data-trial') === '1');
  const pw = await page.evaluate(() => { const q = (id) => document.querySelector(`[data-testid=${id}]`)?.textContent ?? ''; return { buy: q('pro-buy'), price: q('pro-price'), trial: q('pro-trial-terms'), renew: q('pro-renew'), feats: document.querySelectorAll('[data-testid=pro-features] li').length, restore: q('pro-restore'), terms: document.querySelector('[data-testid=pro-terms]')?.getAttribute('href'), priv: document.querySelector('[data-testid=pro-privacy-link]')?.getAttribute('href'), free: q('core-free-note') }; });
  check('trial: button "Start 7-day free trial", headline "7 days free, then $5.99 per month"', pw.buy === 'Start 7-day free trial' && pw.price === '7 days free, then $5.99 per month', JSON.stringify([pw.buy, pw.price]));
  check('trial terms: $5.99 charged when trial ends, auto-renews monthly, cancel 24 h before trial ends', /When it ends, \$5\.99 is charged to your Apple ID/.test(pw.trial) && /renews automatically every month/.test(pw.trial) && /24 hours before the trial ends/.test(pw.trial));
  check('paywall: 10 Pro features, Restore, Terms (EULA), Privacy, free-version note', pw.feats === 10 && pw.restore === 'Restore purchases' && /stdeula/.test(pw.terms ?? '') && /privacy\.html$/.test(pw.priv ?? '') && /Free: 2 scans a month/.test(pw.free));
  await page.screenshot({ path: `${SHOTS}/paywall-trial.png` });
  await page.evaluate(() => localStorage.setItem('actioncard.pro.mock', JSON.stringify({ price: '$5.99', trial: false })));
  await page.reload(); await page.click('[data-testid=tab-settings]'); await page.click('[data-testid=pro-open]'); await page.waitForSelector('[data-testid=pro-price]');
  check('no trial offered (e.g. already used): no trial wording, "Subscribe · $5.99 per month"', (await page.locator('[data-testid=pro-trial-terms]').count()) === 0 && /Subscribe · \$5\.99 per month/.test(await page.textContent('[data-testid=pro-buy]')));
  await page.click('[data-testid=pro-close]');

  // 7. Arabic: limit notice right-to-left
  await page.evaluate(() => { const k = 'actioncard.settings.v1'; const s = JSON.parse(localStorage.getItem(k) || '{}'); s.userLanguage = 'ar'; localStorage.setItem(k, JSON.stringify(s)); localStorage.setItem('letterscan.scans.v1', JSON.stringify({ month: `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`, n: 2 })); });
  await page.reload(); await page.click('[data-testid=upload-btn]'); await page.waitForSelector('[data-testid=limit-notice]');
  const ar = await page.evaluate(() => ({ dir: document.documentElement.dir, txt: document.querySelector('[data-testid=limit-notice]')?.textContent ?? '' }));
  check('Arabic: limit notice translated and RTL', ar.dir === 'rtl' && /المسح/.test(ar.txt), ar.txt.slice(0, 60));
  await page.screenshot({ path: `${SHOTS}/core-limit-ar.png` });
  await page.evaluate(() => { const k = 'actioncard.settings.v1'; const s = JSON.parse(localStorage.getItem(k) || '{}'); s.userLanguage = 'en'; localStorage.setItem(k, JSON.stringify(s)); });
  await A.ctx.close();

  // 8. Pro unlocks everything: no counter, 3+ scans, all PDF pages, steps + replies, PDF, 2+ saved letters
  const B = await newCtx(); const p2 = B.page;
  await p2.goto(BASE);
  await p2.evaluate(() => { localStorage.setItem('actioncard.pro.mock', JSON.stringify({ price: '$5.99', trial: true, result: 'purchased' })); localStorage.setItem('letterscan.scans.v1', JSON.stringify({ month: `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`, n: 2 })); });
  await p2.reload(); await p2.waitForSelector('[data-testid=scans-left]');
  check('before buying: 0 left', (await left(p2)) === '0');
  await p2.click('[data-testid=upload-btn]'); await p2.waitForSelector('[data-testid=pro-buy]'); await p2.click('[data-testid=pro-buy]');
  await p2.waitForSelector('[data-testid=pro-owned]'); await p2.click('[data-testid=pro-close]');
  check('after buying (trial): no scan counter', (await p2.locator('[data-testid=scans-left]').count()) === 0);
  for (let i = 0; i < 3; i++) {
    await scan(p2, PDF1);
    await p2.click('[data-testid=save-btn]'); await p2.waitForSelector('[data-testid=save-btn][disabled]');
  }
  const pc = await p2.evaluate(() => ({ pages: document.querySelector('[data-testid=page-count]')?.textContent ?? '', steps: !!document.querySelector('[data-testid=steps]'), reply: !!document.querySelector('[data-testid=reply]'), teaser: !!document.querySelector('[data-testid=steps-teaser]'), limit: !!document.querySelector('[data-testid=save-limit]') }));
  check('Pro: 3 scans past the free limit, all saved without a limit dialog', !pc.limit && (await histCount(p2)) === 3);
  await scan(p2, PDF1);
  const pc2 = await p2.evaluate(() => ({ pages: document.querySelector('[data-testid=page-count]')?.textContent ?? '', steps: !!document.querySelector('[data-testid=steps]'), reply: !!document.querySelector('[data-testid=reply]'), teaser: !!document.querySelector('[data-testid=steps-teaser]') }));
  check('Pro: both PDF pages read, full steps + reply templates, no Pro note', /2 pages/.test(pc2.pages) && pc2.steps && pc2.reply && !pc2.teaser, JSON.stringify(pc2));
  const [dl] = await Promise.all([p2.waitForEvent('download', { timeout: 30000 }), p2.click('[data-testid=pdf-btn]')]);
  check('Pro: PDF export downloads', /\.pdf$/.test(dl.suggestedFilename()));
  check('no page errors (Pro)', B.errors.length === 0, B.errors.join(' | '));
  await B.ctx.close();
 }
} catch (e) {
  check('run completed', false, String(e?.stack ?? e).slice(0, 400));
} finally {
  await browser.close();
  try { process.kill(-srv.pid); } catch { /* */ }
}
const f = results.filter((r) => !r.ok).length;
console.log(`\n${deviceName}: ${results.length - f}/${results.length} core checks passed`);
process.exit(f ? 1 : 0);
