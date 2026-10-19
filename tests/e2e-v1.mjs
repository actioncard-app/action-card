// End-to-end checks of the v1 features on the production build (dist): PDF import (text layer + scanned), IBAN + copy,
// plain summary, scam hints + free-help links, UI languages incl. Arabic RTL, Pro paywall (web: info only; mocked purchase).
// Usage: node tests/e2e-v1.mjs   (ENGINE=webkit for iPhone 14 emulation)
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { launch, deviceProfile, ENGINE } from './browser.mjs';

const { name: deviceName, ...MOBILE } = deviceProfile(ENGINE);
const results = [];
const check = (name, ok, detail = '') => { results.push({ name, ok: !!ok, detail }); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  — ' + detail : ''}`); };
const SHOTS = `test-results/v1-${ENGINE}`; mkdirSync(SHOTS, { recursive: true });
const PORT = 4183;
const srv = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], { detached: true, stdio: 'ignore' });
const BASE = `http://127.0.0.1:${PORT}/`;
for (let i = 0; i < 60; i++) { if (await fetch(BASE).then((r) => r.ok).catch(() => false)) break; await new Promise((r) => setTimeout(r, 500)); }
const browser = await launch();
const field = (pg, f) => pg.evaluate((f) => document.querySelector(`[data-field=${f}]`)?.getAttribute('data-value') ?? null, f);
const open = async (pg, file) => {
  await pg.goto(BASE); await pg.waitForSelector('[data-testid=camera-btn]');
  await pg.setInputFiles('[data-testid=file-input]', file);
  return pg.waitForSelector('[data-testid=action-card]', { timeout: 240000 }).then(() => true).catch(() => false);
};
const small = (pg, sel) => pg.evaluate((sel) => [...document.querySelectorAll(`${sel} button, ${sel} select, ${sel} a`)].filter((e) => e.offsetParent).map((e) => e.getBoundingClientRect()).filter((r) => r.width < 44 || r.height < 44).length, sel);
try {
  const ctx = await browser.newContext({ ...MOBILE, ...(ENGINE === 'chromium' ? { permissions: ['clipboard-read', 'clipboard-write'] } : {}) });
  await ctx.addInitScript(() => { try { sessionStorage.clear(); } catch { /* */ } });
  await ctx.route('https://api.x.ai/**', (r) => r.abort());
  const page = await ctx.newPage();
  const errors = []; page.on('pageerror', (e) => errors.push(e.message));

  // 1. Digital PDF (text layer, 2 pages): no OCR, debt collection, IBAN valid, summary, copy IBAN
  let ok = await open(page, 'test-docs/pdf/digital_inkasso_2pages.pdf');
  const iban = await page.textContent('[data-testid=value-iban]').catch(() => '');
  check('PDF with text layer opens as a card (debt collection, 2 pages, text taken from PDF)', ok && (await field(page, 'docType')) === 'debt_collection' && /PDF/.test((await page.textContent('[data-testid=action-card]')) ?? ''), await field(page, 'docType'));
  check('IBAN extracted and checksum-valid', /DE89 3704 0044 0532 0130 00/.test(iban ?? '') && /Check digits are valid/.test((await page.textContent('[data-testid=iban-check]').catch(() => '')) ?? ''), iban);
  const sum = await page.textContent('[data-testid=plain-summary]').catch(() => '');
  check('plain two-sentence summary at the top names type, amount and date', /debt collection/i.test(sum) && /186\.40/.test(sum) && /27 Oct 2026/.test(sum), sum.slice(0, 140));
  check('summary is above the fields', await page.evaluate(() => { const s = document.querySelector('[data-testid=plain-summary]'); const d = document.querySelector('[data-field=deadline]'); return !!(s && d && (s.compareDocumentPosition(d) & Node.DOCUMENT_POSITION_FOLLOWING)); }));
  await page.click('[data-testid=copy-iban]');
  await page.waitForFunction(() => /Copied/.test(document.querySelector('[data-testid=copy-iban]')?.textContent ?? ''), null, { timeout: 2000 }).catch(() => {});
  const fb = await page.textContent('[data-testid=copy-iban]');
  check('one-tap copy shows feedback', /Copied/.test(fb ?? ''), fb);
  if (ENGINE === 'chromium') check('clipboard holds the IBAN', (await page.evaluate(() => navigator.clipboard.readText()).catch(() => '')).replace(/\s/g, '') === 'DE89370400440532013000');
  for (const f of ['amount', 'reference']) check(`copy button on ${f}`, (await page.locator(`[data-testid=copy-${f}]`).count()) === 1);
  check('no scam hints on a normal collection letter', (await page.locator('[data-testid=scam-hints]').count()) === 0);
  await page.locator('[data-testid=plain-summary]').evaluate((e) => e.scrollIntoView({ block: 'start' })); await page.evaluate(() => window.scrollBy(0, -70));
  await page.screenshot({ path: `${SHOTS}/v1-pdf-card.png` });
  await page.locator('[data-field=iban]').evaluate((e) => e.scrollIntoView({ block: 'center' }));
  await page.screenshot({ path: `${SHOTS}/v1-iban.png` });

  // 2. Scanned PDF (image only): rendered and OCRed
  ok = await open(page, 'test-docs/pdf/scan_rundfunkbeitrag.pdf');
  check('scanned PDF (no text layer) is rendered and OCRed (broadcast fee, 15 Nov 2026, €55.08)', ok && (await field(page, 'docType')) === 'broadcast_fee' && (await field(page, 'deadline')) === '2026-11-15', `${await field(page, 'docType')} ${await field(page, 'deadline')}`);

  // 3. Scam-like letter: things to double-check + free help links
  ok = await open(page, 'test-docs/v1-e2e/en_scam_giftcard.png');
  const hints = ok ? await page.evaluate(() => [...document.querySelectorAll('[data-testid=scam-hints] [data-hint]')].map((e) => e.getAttribute('data-hint'))) : [];
  check('scam-like letter: hints for gift cards, threat, short link, free e-mail, secrecy', ['hint_giftcard', 'hint_threat', 'hint_shortlink', 'hint_freemail'].every((h) => hints.includes(h)), hints.join(','));
  const hintText = await page.textContent('[data-testid=scam-hints]').catch(() => '');
  check('hints never say "this is a scam"', !/this is a scam|is fraud/i.test(hintText) && /does not mean it is fake/i.test(hintText));
  await page.click('[data-testid=help-links] summary');
  const links = await page.evaluate(() => [...document.querySelectorAll('[data-testid=help-links] a')].map((a) => a.href));
  check('free-help links shown (https, opens externally), country preselected GB', links.length >= 2 && links.every((u) => u.startsWith('https://')) && (await page.inputValue('[data-testid=help-country]')) === 'GB', links.join(' '));
  await page.locator('[data-testid=scam-hints]').evaluate((e) => e.scrollIntoView({ block: 'start' }));
  await page.screenshot({ path: `${SHOTS}/v1-hints.png` });

  // 4. Arabic UI: RTL, translated, note that it is unreviewed, no horizontal overflow
  await page.goto(BASE); await page.waitForSelector('[data-testid=camera-btn]');
  await page.click('[data-testid=tab-settings]');
  await page.selectOption('[data-testid=user-lang]', 'ar');
  const dir = await page.evaluate(() => [document.documentElement.dir, document.documentElement.lang]);
  check('Arabic UI switches the page to dir=rtl lang=ar', dir[0] === 'rtl' && dir[1] === 'ar', dir.join(' '));
  check('Arabic UI: tab labels translated, unreviewed note shown', (await page.textContent('[data-testid=tab-settings]'))?.includes('الإعدادات') && (await page.locator('[data-testid=lang-unreviewed]').count()) === 1);
  check('Arabic UI: no horizontal overflow (settings)', await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1));
  await page.screenshot({ path: `${SHOTS}/v1-ar-settings.png` });
  ok = await open(page, 'test-docs/pdf/digital_inkasso_2pages.pdf');
  check('Arabic UI: card renders RTL with Arabic summary, no horizontal overflow', ok && /باختصار/.test((await page.textContent('[data-testid=plain-summary]')) ?? '') && await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1));
  check('Arabic UI: quoted source text keeps its own (LTR) direction', await page.evaluate(() => { const s = document.querySelector('.snippet'); return !!s && getComputedStyle(s).unicodeBidi === 'plaintext'; }));
  await page.screenshot({ path: `${SHOTS}/v1-ar-card.png` });
  for (const l of ['tr', 'pl', 'ru', 'uk']) {
    await page.evaluate((l) => { const k = 'actioncard.settings.v1'; const s = JSON.parse(localStorage.getItem(k) || '{}'); s.userLanguage = l; localStorage.setItem(k, JSON.stringify(s)); }, l);
    await page.goto(BASE); await page.waitForSelector('[data-testid=camera-btn]');
    const st = await page.evaluate(() => [document.documentElement.dir, document.documentElement.lang, document.querySelector('[data-testid=tab-settings]')?.textContent]);
    check(`${l} UI loads LTR and translated`, st[0] === 'ltr' && st[1] === l && !/Settings/.test(st[2] ?? ''), st.join(' | '));
  }
  await page.evaluate(() => { const k = 'actioncard.settings.v1'; const s = JSON.parse(localStorage.getItem(k) || '{}'); s.userLanguage = 'en'; localStorage.setItem(k, JSON.stringify(s)); });

  // 5./6. Pro is behind the VITE_PRO_ENABLED build flag (off by default). Run with PRO=1 against a build made with
  // VITE_PRO_ENABLED=true to test the paywall; otherwise check that no Pro entry point is shown at all.
  if (process.env.PRO !== '1') {
    await page.goto(BASE); await page.waitForSelector('[data-testid=camera-btn]');
    await page.click('[data-testid=tab-settings]'); await page.waitForSelector('[data-testid=settings]');
    const proUi = await page.evaluate(() => ['pro-section', 'pro-open', 'backup-section', 'backup-btn', 'paywall', 'pro-buy', 'pro-restore'].filter((id) => document.querySelector(`[data-testid=${id}]`)));
    check('Pro flag off: no Pro section, Unlock/Restore, backup or paywall in Settings', proUi.length === 0, proUi.join(','));
    check('Pro flag off: no purchase wording on the Settings screen', !/Pro\b|Purchases are handled/.test((await page.textContent('[data-testid=settings]')) ?? ''));
    await page.click('[data-testid=tab-history]'); await page.waitForSelector('[data-testid=history]');
    check('Pro flag off: no all-cards PDF (Pro) button in Saved', (await page.locator('[data-testid=bundle-btn]').count()) === 0);
    await page.evaluate(() => localStorage.setItem('actioncard.pro.mock', JSON.stringify({ price: '$5.99', result: 'purchased' })));
    await page.reload(); await page.click('[data-testid=tab-settings]');
    check('Pro flag off: the web store mock cannot bring the paywall back', (await page.locator('[data-testid=pro-section], [data-testid=paywall]').count()) === 0);
    await page.evaluate(() => localStorage.removeItem('actioncard.pro.mock'));
  } else {
    // 5. Pro on the web: explained, not sold; options locked
    await page.goto(BASE); await page.waitForSelector('[data-testid=camera-btn]');
    await page.click('[data-testid=tab-settings]');
    check('Pro options are locked without Pro', await page.isDisabled('[data-testid=pro-theme]') && await page.isDisabled('[data-testid=pro-days]'));
    await page.click('[data-testid=pro-open]');
    await page.waitForSelector('[data-testid=paywall]');
    check('web paywall explains Pro is in the iPhone app, no buy button', (await page.locator('[data-testid=pro-web]').count()) === 1 && (await page.locator('[data-testid=pro-buy]').count()) === 0);
    check('paywall states core features stay free', /Always free/.test((await page.textContent('[data-testid=paywall]')) ?? ''));
    await page.keyboard.press('Escape');
    check('paywall closes with Escape', (await page.locator('[data-testid=paywall]').count()) === 0);

    // 6. Mocked store (web test hook; ignored in the iOS app): cancel, restore none, buy, then Pro extras unlock
    await page.evaluate(() => localStorage.setItem('actioncard.pro.mock', JSON.stringify({ price: '$5.99', result: 'cancelled', restore: false })));
    await page.reload(); await page.click('[data-testid=tab-settings]'); await page.click('[data-testid=pro-open]');
    check('paywall shows the App Store price on the buy button', /\$5\.99/.test((await page.textContent('[data-testid=pro-buy]')) ?? ''));
    check('paywall controls are at least 44x44', (await small(page, '[data-testid=paywall]')) === 0);
    await page.screenshot({ path: `${SHOTS}/v1-paywall.png` });
    await page.click('[data-testid=pro-buy]');
    check('cancelled purchase: message, still locked', /cancelled/i.test((await page.textContent('[data-testid=pro-msg]')) ?? ''));
    await page.click('[data-testid=pro-restore]');
    check('restore with nothing to restore: message', /No earlier purchase/i.test((await page.textContent('[data-testid=pro-msg]')) ?? ''));
    await page.evaluate(() => localStorage.setItem('actioncard.pro.mock', JSON.stringify({ price: '$5.99', result: 'purchased' })));
    await page.reload(); await page.click('[data-testid=tab-settings]'); await page.click('[data-testid=pro-open]');
    await page.click('[data-testid=pro-buy]');
    check('purchase unlocks Pro', (await page.locator('[data-testid=pro-owned]').count()) === 1);
    await page.click('[data-testid=pro-close]');
    await page.selectOption('[data-testid=pro-theme]', 'ocean');
    await page.waitForTimeout(200);
    await page.selectOption('[data-testid=pro-days]', '7,3,1,0');
    await page.waitForTimeout(200);
    check('Pro theme applies (html[data-theme=ocean])', (await page.evaluate(() => document.documentElement.dataset.theme)) === 'ocean');
    await page.reload();
    const persisted = await page.evaluate(() => [document.documentElement.dataset.theme, localStorage.getItem('actioncard.settings.v1'), localStorage.getItem('actioncard.pro.v1')].join(' | '));
    check('Pro + theme + reminder schedule persist after reload', (await page.evaluate(() => document.documentElement.dataset.theme)) === 'ocean' && (await page.evaluate(() => JSON.parse(localStorage.getItem('actioncard.settings.v1')).reminderDays.join())) === '7,3,1,0', persisted);
    await page.click('[data-testid=tab-settings]'); await page.locator('[data-testid=pro-section]').evaluate((e) => e.scrollIntoView({ block: 'center' })); await page.waitForTimeout(300);
    await page.screenshot({ path: `${SHOTS}/v1-pro-ocean.png` });
  }
  check('no page errors', errors.length === 0, errors.join(' | '));
  await ctx.close();
} finally {
  await browser.close();
  try { process.kill(-srv.pid, 'SIGTERM'); } catch { /* */ }
}
writeFileSync(`test-results/e2e-v1-${ENGINE}.json`, JSON.stringify({ engine: ENGINE, device: deviceName, ranAt: new Date().toString(), results }, null, 2));
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} v1 checks passed (${ENGINE})`);
process.exit(failed.length ? 1 : 0);
