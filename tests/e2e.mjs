// End-to-end checks of the production build with Playwright device emulation.
// Usage: node tests/e2e.mjs
//   ENGINE=chromium|webkit  (default chromium = system Chrome with Pixel 7 emulation; webkit = iPhone 14 emulation)
//   BASE_PATH=/action-card/ DIST=dist-sub  to test a build made for a subpath (e.g. GitHub Pages project site)
//   LIVE_URL=https://user.github.io/action-card/  to test a deployed site instead of a local build (no local server;
//     the offline test goes through a local CONNECT proxy that is cut after first load, so the site is really unreachable)
// Serves the build itself with `vite preview` on ports 4180/4181.
import { spawn, execSync } from 'node:child_process';
import { writeFileSync, mkdirSync, readFileSync } from 'node:fs';
import { launch, deviceProfile, ENGINE } from './browser.mjs';
import { startCuttableProxy } from './cuttable-proxy.mjs';

const LIVE = process.env.LIVE_URL ? new URL(process.env.LIVE_URL).href.replace(/\/?$/, '/') : null;
const BASE_PATH = LIVE ? new URL(LIVE).pathname : ('/' + (process.env.BASE_PATH ?? '/') + '/').replace(/\/+/g, '/');
const DIST = process.env.DIST ?? 'dist';
const { name: deviceName, ...MOBILE } = deviceProfile(ENGINE);
const W = MOBILE.viewport.width;
// Official screenshots only from the default run (Chromium, root path); other runs keep their own copies.
const tag = LIVE ? `${ENGINE}-live` : `${ENGINE}${BASE_PATH === '/' ? '' : '-subpath'}`;
const SHOTS = tag === 'chromium' ? 'screenshots' : `test-results/screens-${tag}`;
mkdirSync(SHOTS, { recursive: true });
mkdirSync('test-results', { recursive: true });
console.log(`engine=${ENGINE} device=${deviceName} base=${BASE_PATH} ${LIVE ? 'live=' + LIVE : 'dist=' + DIST}`);
const results = [];
const skip = (name, why) => { results.push({ name, ok: null, skipped: true, detail: why }); console.log(`SKIP  ${name}  — ${why}`); };
// Playwright WebKit's setOffline() also breaks reading local Blobs (createImageBitmap, blob: URLs and FileReader all
// fail: "An error occured reading the Blob"), which Chromium and real Safari do not do. So on WebKit the offline tests
// stop the server instead (the service worker must serve everything) and only use setOffline after OCR finished.
const WK = ENGINE === 'webkit';
const check = (name, ok, detail = '') => { results.push({ name, ok: !!ok, detail }); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  — ' + detail : ''}`); };
// Every visible control must be at least 44x44 CSS px (WCAG 2.5.5 / Apple HIG). Checkboxes are measured by their label row.
// The card screen is a focused view without the tab bar: leave it with the back button before switching tabs.
const goTab = async (pg, name) => {
  if (await pg.locator('[data-testid=back-btn]').count()) await pg.click('[data-testid=back-btn]');
  await pg.click(`[data-testid=tab-${name}]`);
};
const smallTargets = (pg) => pg.evaluate(async () => {
  // let the screen's entrance transition finish first (a transform mid-animation gives sub-pixel sizes)
  await Promise.all(document.getAnimations().filter((an) => an.effect?.getTiming().iterations !== Infinity).map((an) => an.finished.catch(() => {})));
  const bad = [];
  for (const el of document.querySelectorAll('button, a[href], label.btn, select, input:not([type=hidden]):not([hidden]), textarea, summary')) {
    let t = el;
    if (el.matches('input[type=checkbox], input[type=radio]')) t = el.closest('label') ?? el;
    const r = t.getBoundingClientRect(); const cs = getComputedStyle(t);
    if (!r.width || !r.height || cs.visibility === 'hidden' || cs.display === 'none') continue;
    if (!el.matches('summary') && el.closest('details:not([open])')) continue; // inside a collapsed section: not on screen
    if (r.height < 44 || (r.width < 44 && !el.matches('summary'))) bad.push(`${(el.getAttribute('data-testid') || el.textContent || el.tagName).trim().slice(0, 24)} ${r.width.toFixed(2)}x${r.height.toFixed(2)}`);
  }
  return bad;
});

function serve(port) {
  const p = spawn('npx', ['vite', 'preview', '--host', '127.0.0.1', '--port', String(port), '--strictPort', '--outDir', DIST], { stdio: 'pipe', detached: true, env: { ...process.env, BASE_PATH } });
  return new Promise((res) => { p.stdout.on('data', (d) => { if (String(d).includes(String(port))) res(p); }); setTimeout(() => res(p), 8000); });
}
const kill = (p) => { if (!p) return; try { process.kill(-p.pid, 'SIGTERM'); } catch { /* gone */ } };

const srv = LIVE ? null : await serve(4180);
const BASE = LIVE ?? `http://127.0.0.1:4180${BASE_PATH}`;
const browser = await launch();
try {
  const ctx = await browser.newContext({ ...MOBILE, acceptDownloads: true });
  // Headless Chrome has no share sheet; force the download fallback for the PDF export.
  await ctx.addInitScript(() => { Object.defineProperty(navigator, 'canShare', { value: undefined, configurable: true }); });
  // record Content-Security-Policy violations (there must be none)
  await ctx.addInitScript(() => { window.__csp = []; document.addEventListener('securitypolicyviolation', (e) => window.__csp.push(`${e.violatedDirective} ${e.blockedURI}`)); });
  // Any request to xAI must be intercepted in tests: never reach the real API.
  const xaiCalls = [];
  let xaiMode = '401';
  await installXaiMock(ctx);
  async function installXaiMock(c) {
  // Any request to xAI must be intercepted in tests: never reach the real API.
  await c.route('https://api.x.ai/**', async (route) => {
    const req = route.request();
    xaiCalls.push({ url: req.url(), auth: req.headers()['authorization'], body: req.postData() });
    if (xaiMode === '401') return route.fulfill({ status: 401, contentType: 'application/json', body: '{"error":"invalid api key"}' });
    if (xaiMode === 'badjson') return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ choices: [{ message: { content: 'Sure! Here is the card: {deadline: tomorrow' } }] }) });
    if (xaiMode === 'invalid-schema') return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ choices: [{ message: { content: JSON.stringify({ doc_type: { value: 'parking_fine', snippet: 'x', confidence: 'high' }, deadline: { value: '2026-02-31', snippet: null, confidence: 'high', kind: 'deadline' } }) } }] }) });
    if (xaiMode === 'fabricated') return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ choices: [{ message: { content: JSON.stringify({
      doc_language: 'de',
      doc_type: { value: 'parking_fine', snippet: 'Verwarnung mit Verwarnungsgeld', confidence: 'high' },
      deadline: { value: '2026-10-19', snippet: 'bis zum 19.10.2026', confidence: 'high', kind: 'deadline' },
      amount: { value: { amount: 999, currency: 'EUR' }, snippet: 'Strafe: 999 EUR', confidence: 'high' },
      reference: { value: null, snippet: null, confidence: 'low' },
      next_action: 'Pay by 19 Oct.', reply_doc_language: 'Sehr geehrte Damen und Herren, ...', reply_user_language: 'Dear Sir or Madam, ...',
    }) } }] }) });
    return route.abort();
  });
  }
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const cspConsole = []; // CSP violations are also logged to the console, across navigations
  page.on('console', (m) => { if (/Content.Security.Policy|Refused to/i.test(m.text())) cspConsole.push(m.text().slice(0, 160)); });

  // 1. Home + service worker + manifest
  await page.goto(BASE);
  await page.waitForSelector('[data-testid=camera-btn]');
  const swOk = await page.evaluate(async () => { const r = await Promise.race([navigator.serviceWorker.ready, new Promise((res) => setTimeout(() => res(null), 30000))]); return !!(r && r.active); });
  check('service worker registers and activates', swOk);
  await page.reload();
  await page.waitForSelector('[data-testid=camera-btn]');
  check('page is controlled by the service worker after reload', await page.evaluate(() => !!navigator.serviceWorker.controller));
  const precached = await page.evaluate(async () => {
    const keys = await caches.keys();
    const urls = [];
    for (const k of keys) for (const r of await (await caches.open(k)).keys()) urls.push(r.url);
    return urls;
  });
  const need = ['eng', 'deu', 'fra', 'spa', 'ita', 'por'].map((l) => `tesseract/lang/${l}.traineddata.gz`).concat(['tesseract/worker.min.js', 'tesseract-core-simd-lstm.wasm.js']);
  const missing = need.filter((n) => !precached.some((u) => u.includes(n)));
  check('OCR worker, SIMD core and all 6 traineddata files are precached', missing.length === 0, missing.length ? 'missing ' + missing.join(', ') : `${precached.length} cached URLs`);

  const manifest = await page.evaluate(async () => {
    const link = document.querySelector('link[rel=manifest]');
    if (!link) return { error: 'no <link rel=manifest>' };
    const m = await (await fetch(link.href)).json();
    const icons = [];
    for (const ic of m.icons) {
      const img = new Image(); img.src = new URL(ic.src, link.href).href;
      try { await img.decode(); icons.push({ ...ic, w: img.naturalWidth, h: img.naturalHeight }); } catch { icons.push({ ...ic, w: 0 }); }
    }
    const apple = document.querySelector('link[rel=apple-touch-icon]');
    return { m, icons, apple: apple?.getAttribute('href'), themeColor: document.querySelector('meta[name=theme-color]')?.getAttribute('content') };
  });
  const m = manifest.m ?? {};
  const iconOk = (s) => manifest.icons?.some((i) => i.sizes === `${s}x${s}` && i.w === s && i.h === s);
  check('manifest valid (name, short_name, start_url, scope, display=standalone, theme/background colors)', m.name && m.short_name && m.start_url && m.scope && m.display === 'standalone' && m.theme_color && m.background_color, JSON.stringify({ name: m.name, display: m.display, start_url: m.start_url }));
  const swScope = await page.evaluate(async () => (await navigator.serviceWorker.getRegistration())?.scope ?? null);
  check(`manifest start_url/scope/id and service-worker scope match the base path ${BASE_PATH}`, m.start_url === BASE_PATH && m.scope === BASE_PATH && swScope === new URL(BASE_PATH, BASE).href, JSON.stringify({ start_url: m.start_url, scope: m.scope, id: m.id, swScope }));
  const outside = precached.filter((u) => !u.startsWith(new URL(BASE_PATH, BASE).href));
  check('every precached URL (app, icons, OCR worker/core/traineddata) is under the base path', outside.length === 0, outside.slice(0, 3).join(', '));
  check('apple-touch-icon href is under the base path', (manifest.apple ?? '').startsWith(BASE_PATH), manifest.apple);
  check('manifest icons 192 + 512 load with the right pixel size, plus a maskable icon', iconOk(192) && iconOk(512) && manifest.icons.some((i) => (i.purpose ?? '').includes('maskable') && i.w === 512));
  check('apple-touch-icon + theme-color present for iOS Add to Home Screen', manifest.apple && manifest.themeColor, `${manifest.apple} ${manifest.themeColor}`);
  check('capture input uses accept=image/* capture=environment', await page.evaluate(() => !!document.querySelector('input[type=file][accept="image/*"][capture=environment]')));
  check(`no horizontal overflow at ${W}px (home)`, await page.evaluate((w) => document.documentElement.scrollWidth <= w, W));
  { const bad = await smallTargets(page); check('every tap target on the home screen is at least 44x44 px', bad.length === 0, bad.join(', ')); }
  await page.screenshot({ path: `${SHOTS}/01-home-capture.png` });

  // First run: short explainer with "Try a sample" (sample is drawn on the phone, works offline); hidden afterwards
  {
    const hasIntro = await page.locator('[data-testid=intro]').count();
    await page.click('[data-testid=try-sample]');
    await page.waitForSelector('[data-testid=action-card]', { timeout: 180000 });
    const s = await page.evaluate(() => ({ type: document.querySelector('[data-testid=card-type]')?.textContent, amount: document.querySelector('[data-field=amount]')?.getAttribute('data-value'), deadline: document.querySelector('[data-field=deadline]')?.getAttribute('data-value'), days: document.querySelector('[data-testid=summary-days]')?.textContent }));
    check('first run: explainer shown; "Try a sample" makes a full card offline (parking fine, 35 EUR, deadline in 14 days)', hasIntro === 1 && s.type === 'Parking / traffic fine' && s.amount === '35 EUR' && s.days === 'in 14 days', JSON.stringify(s));
    await page.click('[data-testid=new-btn]');
    await page.waitForSelector('[data-testid=camera-btn]');
    check('first run: explainer does not come back after it was used', await page.locator('[data-testid=intro]').count() === 0);
  }

  // 2. Upload a sample -> card
  await page.setInputFiles('[data-testid=file-input]', 'test-docs/de_parking_ticket.png');
  const sawProgress = await page.waitForSelector('[data-testid=processing]', { timeout: 5000 }).then(() => true).catch(() => false);
  check('OCR progress UI is shown while reading', sawProgress);
  await page.waitForSelector('[data-testid=action-card]', { timeout: 180000 });
  const card = await page.evaluate(() => ({
    type: document.querySelector('[data-field=docType]')?.getAttribute('data-value'),
    deadline: document.querySelector('[data-field=deadline]')?.getAttribute('data-value'),
    amount: document.querySelector('[data-field=amount]')?.getAttribute('data-value'),
    snippets: document.querySelectorAll('[data-testid^=snippet-]').length,
    confs: document.querySelectorAll('.conf').length,
    disclaimer: document.querySelector('[data-testid=disclaimer]')?.textContent,
    next: document.querySelector('[data-testid=next-action]')?.textContent,
    replyDoc: document.querySelector('[data-testid=reply-doc]')?.textContent,
    replyUser: document.querySelector('[data-testid=reply-user]')?.textContent,
    days: document.querySelector('[data-testid=days-left]')?.textContent,
    ocr: !!document.querySelector('[data-testid=ocr-text] pre'),
    overflow: document.documentElement.scrollWidth,
  }));
  check('action card renders with type/deadline/amount', card.type === 'parking_fine' && card.deadline === '2026-10-19' && card.amount === '35 EUR', JSON.stringify({ type: card.type, deadline: card.deadline, amount: card.amount, days: card.days }));
  check('every found field shows a source snippet + confidence', card.snippets >= 4 && card.confs >= 4, `${card.snippets} snippets, ${card.confs} badges`);
  check('disclaimer visible on card', /can be wrong/.test(card.disclaimer ?? '') && /Not legal or medical advice/.test(card.disclaimer ?? ''));
  check('bilingual reply drafted (German + English)', /Sehr geehrte/.test(card.replyDoc ?? '') && /Dear Sir or Madam/.test(card.replyUser ?? ''));
  check('full OCR text section present', card.ocr);
  check(`no horizontal overflow at ${W}px (card)`, card.overflow <= W, String(card.overflow));
  { const bad = await smallTargets(page); check('every tap target on the card is at least 44x44 px', bad.length === 0, bad.join(', ')); }
  check('countdown badge shown next to the deadline', /^(in \d+ days|Tomorrow|Today|\d+ days? ago)$/.test(card.days ?? ''), card.days);
  {
    const first = await page.evaluate(() => {
      const r = document.querySelector('[data-testid=next-action]').getBoundingClientRect();
      const bar = document.querySelector('.action-bar').getBoundingClientRect();
      const chips = [...document.querySelectorAll('.todo .sum-chip')].map((c) => c.textContent);
      const vd = document.querySelector('[data-testid=value-deadline]');
      return { nextBottom: Math.round(r.bottom), barTop: Math.round(bar.top), vh: innerHeight, tabsShown: getComputedStyle(document.querySelector('.tabs')).display !== 'none', back: !!document.querySelector('[data-testid=back-btn]'), chips, aria: vd.getAttribute('aria-label'), name: vd.textContent };
    });
    check('next action is fully on the first screen, above the bottom action bar', first.nextBottom <= first.barTop, JSON.stringify(first));
    check('card is a focused view: tab bar hidden, back button shown', !first.tabsShown && first.back);
    {
      const fit = await page.evaluate(() => [...document.querySelectorAll('.todo .sum-value')].map((e) => { const lh = parseFloat(getComputedStyle(e).lineHeight); const r = e.getBoundingClientRect(); return { t: e.textContent, oneLine: r.height < lh * 1.5, inside: e.scrollWidth <= e.clientWidth + 1 }; }));
      check(`summary chip values fit on one line at ${W}px`, fit.every((f) => f.oneLine && f.inside), JSON.stringify(fit));
      for (const w of [320, 375]) {
        await page.setViewportSize({ width: w, height: 760 });
        const f2 = await page.evaluate(() => [...document.querySelectorAll('.todo .sum-value')].map((e) => { const lh = parseFloat(getComputedStyle(e).lineHeight); return { t: e.textContent, oneLine: e.getBoundingClientRect().height < lh * 1.5, inside: e.scrollWidth <= e.clientWidth + 1 }; }));
        check(`summary chip values fit on one line at ${w}px (iPhone SE)`, f2.every((f) => f.oneLine && f.inside), JSON.stringify(f2));
      }
      await page.setViewportSize(MOBILE.viewport);
    }
    check('summary chips show a confidence word (Clear / Check this / Guess)', first.chips.length === 2 && first.chips.every((c) => /Clear|Check this|Guess/.test(c)), JSON.stringify(first.chips));
    check('screen readers get the value: deadline button name contains the date, no aria-label override', !first.aria && /19 Oct 2026/.test(first.name) && /tap to edit/.test(first.name), first.name);
    const [ics] = await Promise.all([page.waitForEvent('download', { timeout: 20000 }), page.click('[data-testid=remind-btn]')]);
    await ics.saveAs('test-results/sample-deadline.ics');
    const icsText = readFileSync('test-results/sample-deadline.ics', 'utf8');
    check('Remind me downloads a calendar file (all-day 19 Oct 2026, alarm 3 days before)', /DTSTART;VALUE=DATE:20261019/.test(icsText) && /TRIGGER:-P3D/.test(icsText) && /\r\nEND:VCALENDAR\r\n$/.test(icsText), ics.suggestedFilename());
  }
  await page.screenshot({ path: `${SHOTS}/02-action-card-top.png` });
  await page.addStyleTag({ content: '.tabs{position:static !important}' });
  await page.screenshot({ path: `${SHOTS}/02b-action-card-full.png`, fullPage: true });

  // edit a field
  await page.click('[data-testid=value-reference]');
  await page.fill('.field[data-field=reference] input', 'TEST-123');
  await page.click('.field[data-field=reference] .btn.primary');
  const edited = await page.evaluate(() => ({ v: document.querySelector('[data-field=reference]')?.getAttribute('data-value'), badge: document.querySelector('[data-field=reference] .conf')?.textContent, reply: document.querySelector('[data-testid=reply-doc]')?.textContent }));
  check('tap-to-edit a field works and the reply updates', edited.v === 'TEST-123' && /Edited/.test(edited.badge ?? '') && /TEST-123/.test(edited.reply ?? ''), JSON.stringify(edited));

  // PDF export
  const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 20000 }), page.click('[data-testid=pdf-btn]')]);
  await dl.saveAs('test-results/sample-card.pdf');
  let pdfText = '';
  try { pdfText = execSync('pdftotext -layout test-results/sample-card.pdf -').toString(); } catch (e) { pdfText = ''; }
  check('PDF export downloads and contains snippets, confidence and disclaimer', /Source text:/.test(pdfText) && /Confidence: Clear/.test(pdfText) && /can be wrong/.test(pdfText) && /19\.10\.2026/.test(pdfText), `${pdfText.length} chars of text`);
  check('PDF renders the euro sign and accents', /35,00\s*€|€\s*35|35,00 €/.test(pdfText) && /überweisen/.test(pdfText));

  // Multi-page document: page 1 has the case number, page 2 the amount + deadline (test-docs/multipage, synthetic)
  {
    await page.click('[data-testid=new-btn]').catch(() => {});
    await page.setInputFiles('[data-testid=file-input]', 'test-docs/multipage/de_fine_page1.jpg');
    await page.waitForSelector('[data-testid=action-card]', { timeout: 180000 });
    const one = await page.evaluate(() => ({ amount: document.querySelector('[data-field=amount]')?.getAttribute('data-value'), ref: document.querySelector('[data-field=reference]')?.getAttribute('data-value') }));
    await page.setInputFiles('[data-testid=add-page-input]', 'test-docs/multipage/de_fine_page2.jpg');
    await page.waitForSelector('[data-testid=processing]', { timeout: 20000 }).catch(() => {});
    const procTitle = await page.textContent('.proc-title').catch(() => '');
    await page.waitForSelector('[data-testid=page-count]', { timeout: 180000 });
    const two = await page.evaluate(() => ({
      pages: document.querySelector('[data-testid=page-count]')?.textContent,
      thumbs: document.querySelectorAll('.page-thumb').length,
      amount: document.querySelector('[data-field=amount]')?.getAttribute('data-value'),
      deadline: document.querySelector('[data-field=deadline]')?.getAttribute('data-value'),
      ref: document.querySelector('[data-field=reference]')?.getAttribute('data-value'),
      amountFrom: document.querySelector('[data-testid=snippet-amount] .snippet-label')?.textContent,
      refFrom: document.querySelector('[data-testid=snippet-reference] .snippet-label')?.textContent,
      text: document.querySelector('[data-testid=ocr-text] pre')?.textContent ?? '',
    }));
    check('multi-page: page 1 alone has no amount; "Add page" adds page 2 to the same card', !one.amount && /731\.22\.904417\.3/.test(one.ref ?? '') && two.pages === '2 pages' && two.thumbs === 2 && /page 2/i.test(procTitle ?? ''), JSON.stringify({ one, pages: two.pages, thumbs: two.thumbs, procTitle }));
    check('multi-page: fields re-read from both pages, snippets show their page number, full text has page markers',
      two.amount === '55 EUR' && two.deadline === '2026-10-30' && /731\.22\.904417\.3/.test(two.ref ?? '') && /page 2/.test(two.amountFrom ?? '') && /page 1/.test(two.refFrom ?? '') && /— Page 1 —[\s\S]*— Page 2 —/.test(two.text),
      JSON.stringify({ ...two, text: two.text.length }));
    await page.screenshot({ path: `${SHOTS}/11-multipage-card.png` });
    const [mdl] = await Promise.all([page.waitForEvent('download', { timeout: 20000 }), page.click('[data-testid=pdf-btn]')]);
    await mdl.saveAs('test-results/multipage-card.pdf');
    let mText = '', mPages = 0;
    try { mText = execSync('pdftotext -layout test-results/multipage-card.pdf -').toString(); mPages = Number(/Pages:\s+(\d+)/.exec(execSync('pdfinfo test-results/multipage-card.pdf').toString())?.[1] ?? 0); } catch { /* checked below */ }
    check('multi-page PDF: text of both pages + one photo page per document page', /731\.22\.904417\.3/.test(mText) && /55,00/.test(mText) && /PAGE 2/.test(mText) && mPages >= 3, `${mPages} PDF pages`);
  }

  // Relative deadline cards (new in v2): computed from the document date, and unknown start date
  await page.click('[data-testid=new-btn]').catch(() => {});
  await page.setInputFiles('[data-testid=file-input]', 'test-docs/new_de_bussgeld_twocol.jpg');
  await page.waitForSelector('[data-testid=action-card]', { timeout: 180000 });
  const rel = await page.evaluate(() => ({
    deadline: document.querySelector('[data-field=deadline]')?.getAttribute('data-value'),
    math: document.querySelector('[data-testid=deadline-math]')?.textContent ?? '',
    snip: document.querySelector('[data-field=deadline] [data-testid=snippet-deadline]')?.textContent ?? '',
    conf: document.querySelector('[data-field=deadline] .conf')?.textContent ?? '',
  }));
  check('relative deadline ("innerhalb von 14 Tagen ab dem Datum dieses Schreibens") computed from the letter date, math + both snippets shown',
    rel.deadline === '2026-10-15' && /14 days/.test(rel.math) && /=/.test(rel.math) && /innerhalb von 14 Tagen/.test(rel.snip) && /01\.10\.2026/.test(rel.snip), JSON.stringify(rel));
  await page.locator('[data-field=deadline]').scrollIntoViewIfNeeded();
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: `${SHOTS}/08-relative-deadline-card.png` });
  await page.addStyleTag({ content: '.tabs{position:static !important}' });
  await page.screenshot({ path: `${SHOTS}/08b-relative-deadline-card-full.png`, fullPage: true });
  await page.click('[data-testid=new-btn]').catch(() => {});
  await page.setInputFiles('[data-testid=file-input]', 'test-docs/new_de_auslaenderbehoerde_nodate.jpg');
  await page.waitForSelector('[data-testid=action-card]', { timeout: 180000 });
  const unk = await page.evaluate(() => ({
    deadline: document.querySelector('[data-field=deadline]')?.getAttribute('data-value'),
    shown: document.querySelector('[data-testid=relative-unknown]')?.textContent ?? '',
    conf: document.querySelector('[data-field=deadline] .conf')?.textContent ?? '',
    body: document.querySelector('[data-field=deadline]')?.textContent ?? '',
    next: document.querySelector('[data-testid=next-action]')?.textContent ?? '',
  }));
  check('relative deadline with no printed start date: no date invented (today NOT assumed), "unknown date" text, low confidence, rule quoted in next action',
    !unk.deadline && /unknown/i.test(unk.shown) && /Guess/.test(unk.conf) && /does not assume today/.test(unk.body) && /zwei Wochen/.test(unk.next), JSON.stringify({ ...unk, body: undefined }));
  await page.screenshot({ path: `${SHOTS}/09-relative-unknown-date-card.png` });

  // Save, reload, history
  await page.click('[data-testid=save-btn]');
  await page.waitForSelector('[data-testid=save-btn]:has-text("Saved")');
  await page.reload();
  await page.waitForSelector('[data-testid=action-card]', { timeout: 30000 }).catch(() => {});
  check('the open card survives a page reload (app update / iOS tab discard)', await page.locator('[data-testid=action-card]').count() === 1);
  await goTab(page, 'history');
  await page.waitForSelector('[data-testid=history-item]');
  check('saved list warns that the browser may delete cards (not installed) and suggests Home Screen + PDF', /Home Screen/.test(await page.textContent('[data-testid=storage-hint]').catch(() => '') ?? ''));
  check('saved card is in history after reload (IndexedDB)', (await page.locator('[data-testid=history-item]').count()) === 1);

  // second card: medicine label (safety wording), save, then delete it
  await goTab(page, 'scan');
  await page.click('[data-testid=new-btn]').catch(() => {});
  await page.setInputFiles('[data-testid=file-input]', 'test-docs/fr_medicine_label.jpg');
  await page.waitForSelector('[data-testid=action-card]', { timeout: 180000 });
  const med = await page.evaluate(() => ({ next: document.querySelector('[data-testid=next-action]')?.textContent ?? '', quote: document.querySelector('.field.medicine')?.textContent ?? '', amount: document.querySelector('[data-testid=value-amount]')?.textContent ?? '' }));
  check('medicine label: next action = confirm with a pharmacist, label quoted verbatim, no dosing advice generated', /pharmacist/.test(med.next) && /Posologie/.test(med.quote) && /never gives dosing advice/.test(med.quote), med.next.slice(0, 100));
  check('missing value shown as "Not found" (no price on medicine box)', /Not found/.test(med.amount));
  await page.screenshot({ path: `${SHOTS}/05-medicine-card.png`, fullPage: false });
  // make this one overdue (edit the date) to check the Overdue section of the saved list
  await page.click('[data-testid=value-deadline]');
  await page.fill('.field[data-field=deadline] input', '2026-01-15');
  await page.click('.field[data-field=deadline] .btn.primary');
  await page.click('[data-testid=save-btn]');
  await page.waitForSelector('[data-testid=save-btn]:has-text("Saved")');
  await goTab(page, 'history');
  await page.waitForSelector('[data-testid=history-item] >> nth=1');
  await page.screenshot({ path: `${SHOTS}/03-history.png` });
  {
    const order = await page.evaluate(() => [...document.querySelectorAll('[data-testid^=hist-]')].map((s) => `${s.getAttribute('data-testid')}:${s.querySelectorAll('[data-testid=history-item]').length}`));
    check('saved list: Overdue section first, cards without a deadline last', JSON.stringify(order) === JSON.stringify(['hist-overdue:1', 'hist-none:1']), JSON.stringify(order));
  }
  { const bad = await smallTargets(page); check('every tap target in the saved list is at least 44x44 px', bad.length === 0, bad.join(', ')); }
  await page.locator('[data-testid=delete-btn]').first().click();
  await page.click('[data-testid=confirm-delete]');
  await page.waitForFunction(() => document.querySelectorAll('[data-testid=history-item]').length === 1);
  check('delete a card from history', (await page.locator('[data-testid=history-item]').count()) === 1);
  await page.locator('.hist-open').first().click();
  await page.waitForSelector('[data-testid=action-card]');
  check('open a saved card from history', true);

  // Settings
  await goTab(page, 'settings');
  await page.waitForSelector('[data-testid=settings]');
  await page.screenshot({ path: `${SHOTS}/04-settings.png` });
  { const bad = await smallTargets(page); check('every tap target in settings is at least 44x44 px', bad.length === 0, bad.join(', ')); }
  // Interface language: switch to German in Settings, it persists across a reload, then back to English
  {
    await page.selectOption('[data-testid=user-lang]', 'de');
    const de1 = await page.evaluate(() => ({ h2: document.querySelector('[data-testid=settings] h2')?.textContent, tab: document.querySelector('[data-testid=tab-settings]')?.textContent, lang: document.documentElement.lang }));
    await page.reload();
    await page.waitForSelector('[data-testid=tab-scan]');
    const de2 = await page.evaluate(() => document.querySelector('[data-testid=tab-saved], [data-testid=tab-history]')?.textContent);
    await page.screenshot({ path: `${SHOTS}/10-german-ui-home.png` });
    check('UI language: German chosen in Settings translates the interface and persists after reload', de1.h2 === 'Einstellungen' && /Einstellungen/.test(de1.tab ?? '') && de1.lang === 'de' && /Gespeichert/.test(de2 ?? ''), JSON.stringify({ ...de1, de2 }));
    await goTab(page, 'settings');
    await page.selectOption('[data-testid=user-lang]', 'en');
  }
  {
    const lctx = await browser.newContext({ ...MOBILE, locale: 'fr-FR', serviceWorkers: 'block' });
    const lp = await lctx.newPage();
    await lp.goto(BASE);
    await lp.waitForSelector('[data-testid=camera-btn]');
    const fr = await lp.evaluate(() => ({ h1: document.querySelector('h1')?.textContent, lang: document.documentElement.lang, nav: navigator.language }));
    check('UI language: first start follows the phone language (fr-FR -> French interface)', /Que me demande/.test(fr.h1 ?? '') && fr.lang === 'fr', JSON.stringify(fr));
    await lctx.close();
  }
  // Dark mode follows the system setting (prefers-color-scheme); text stays readable (light text on a dark background)
  {
    const lum = (rgb) => { const [r, g, b] = rgb.match(/\d+(\.\d+)?/g).slice(0, 3).map((v) => { const c = Number(v) / 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; }); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
    const colors = async () => page.evaluate(() => ({ bg: getComputedStyle(document.body).backgroundColor, ink: getComputedStyle(document.querySelector('.settings h2')).color }));
    const light = await colors();
    await page.emulateMedia({ colorScheme: 'dark' });
    const dark = await colors();
    await page.screenshot({ path: `${SHOTS}/04c-settings-dark.png` });
    await page.emulateMedia({ colorScheme: 'light' });
    const ratio = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
    check('dark mode: dark background, light text, contrast >= 4.5 (light mode too)', lum(dark.bg) < 0.05 && lum(dark.ink) > 0.6 && ratio(dark.bg, dark.ink) >= 4.5 && ratio(light.bg, light.ink) >= 4.5, JSON.stringify({ light, dark }));
  }
  await page.addStyleTag({ content: '.tabs{position:static !important}' });
  await page.screenshot({ path: `${SHOTS}/04b-settings-full.png`, fullPage: true });

  // 3. AI mode fallbacks (no real key; every xAI request must be intercepted).
  const runWith = async (pg, mode) => {
    xaiMode = mode;
    await goTab(pg, 'scan');
    if (await pg.locator('[data-testid=new-btn]').count()) await pg.click('[data-testid=new-btn]');
    await pg.setInputFiles('[data-testid=file-input]', 'test-docs/de_parking_ticket.png');
    await pg.waitForSelector('[data-testid=action-card]', { timeout: 180000 });
    return pg.evaluate(() => ({ mode: document.querySelector('[data-testid=action-card]')?.getAttribute('data-mode'), note: document.querySelector('[data-testid=mode-note]')?.textContent ?? '', amount: document.querySelector('[data-field=amount]')?.getAttribute('data-value'), amountConf: document.querySelector('[data-field=amount] .conf')?.textContent, amountNote: document.querySelector('[data-field=amount] .note')?.textContent ?? '' }));
  };
  // Cases that never send a request run in the normal (service-worker) context.
  await page.click('[data-testid=ai-toggle]');
  let r = await runWith(page, '401');
  check('AI on but no key -> offline rules + clear note, no request sent', r.mode === 'rules' && /no API key/.test(r.note) && xaiCalls.length === 0, r.note);
  if (WK) skip('AI on + key + offline -> offline rules, no request', 'needs setOffline() during OCR, which breaks Blob reading in Playwright WebKit');
  else {
    // Go offline FIRST, then enter a fake key: the browser cannot reach the network, and the app must not try.
    await ctx.setOffline(true);
    await goTab(page, 'settings');
    await page.fill('[data-testid=ai-key]', 'xai-THIS-IS-A-FAKE-TEST-KEY');
    await page.click('[data-testid=ai-save]');
    r = await runWith(page, 'abort');
    check('AI on + key + offline -> offline rules, no request', r.mode === 'rules' && /Offline/.test(r.note) && xaiCalls.length === 0, r.note);
    // stays offline until this context is closed below
  }
  check('no uncaught page errors (main context)', errors.length === 0, errors.join(' | '));
  { const csp = await page.evaluate(() => ({ meta: document.querySelector('meta[http-equiv=Content-Security-Policy]')?.content ?? '', v: window.__csp ?? null })); check('Content-Security-Policy present (self + api.x.ai only) and no violations during the run', /connect-src 'self' https:\/\/api\.x\.ai;/.test(csp.meta) && Array.isArray(csp.v) && csp.v.length === 0 && cspConsole.length === 0, JSON.stringify([csp.v, cspConsole])); }
  await ctx.close();

  // Cases with a (fake) key run in a context with service workers blocked: in Playwright WebKit, context.route()
  // does NOT see fetches from a page controlled by a service worker, so a mocked request could reach the real API.
  // The probe below proves interception works before any key is entered; if it fails these checks are skipped.
  const actx = await browser.newContext({ ...MOBILE, serviceWorkers: 'block' });
  await installXaiMock(actx);
  const ap = await actx.newPage();
  const aerrors = [];
  ap.on('pageerror', (e) => aerrors.push(e.message));
  const netXai = [];
  ap.on('request', (q) => { if (q.url().startsWith('https://api.x.ai/')) netXai.push(q.url()); });
  await ap.goto(BASE);
  await ap.waitForSelector('[data-testid=camera-btn]');
  xaiMode = '401';
  const before = xaiCalls.length;
  const probe = await ap.evaluate(async () => { try { return (await fetch('https://api.x.ai/v1/probe', { method: 'POST', body: '{}' })).status; } catch (e) { return 'error ' + e.message; } });
  const intercepted = probe === 401 && xaiCalls.length === before + 1;
  xaiCalls.length = 0; netXai.length = 0;
  check('xAI mock interception verified before entering any key (service workers blocked in this context)', intercepted, `probe=${probe}`);
  if (intercepted) {
    await goTab(ap, 'settings');
    await ap.click('[data-testid=ai-toggle]');
    await ap.fill('[data-testid=ai-key]', 'xai-THIS-IS-A-FAKE-TEST-KEY');
    await ap.click('[data-testid=ai-save]');
    check('API key stored only in localStorage', await ap.evaluate(() => (localStorage.getItem('actioncard.settings.v1') ?? '').includes('FAKE-TEST-KEY')));
    r = await runWith(ap, '401');
    check('bad key (HTTP 401) -> falls back to offline rules', r.mode === 'rules' && /HTTP 401/.test(r.note) && r.amount === '35 EUR', r.note);
    const lastBody = JSON.parse(xaiCalls.at(-1)?.body ?? '{}');
    check('AI request goes to api.x.ai/v1/chat/completions with Bearer key, OCR text only (no image)', xaiCalls.at(-1)?.url === 'https://api.x.ai/v1/chat/completions' && /^Bearer xai-THIS/.test(xaiCalls.at(-1)?.auth ?? '') && !/data:image|base64/.test(xaiCalls.at(-1)?.body ?? '') && lastBody.response_format?.type === 'json_schema', `model=${lastBody.model}`);
    r = await runWith(ap, 'badjson');
    check('non-JSON AI answer -> falls back to offline rules', r.mode === 'rules' && /not valid JSON/.test(r.note), r.note);
    r = await runWith(ap, 'invalid-schema');
    check('schema-invalid AI answer (impossible date / missing fields) -> falls back', r.mode === 'rules' && /AI mode failed/.test(r.note) && !/HTTP 4/.test(r.note), r.note);
    r = await runWith(ap, 'fabricated');
    check('AI value whose quoted snippet is NOT in the OCR text is discarded (offline value kept, with a note)', r.mode === 'ai' && r.amount === '35 EUR' && /discarded/.test(r.amountNote), JSON.stringify(r));
    check('every request the page made to api.x.ai was intercepted by the mock (none reached the network)', netXai.length === xaiCalls.length && xaiCalls.length === 4, `${netXai.length} page requests, ${xaiCalls.length} intercepted`);
  }
  check('no uncaught page errors (AI context)', aerrors.length === 0, aerrors.join(' | '));
  await actx.close();

  // 4. True offline test: fresh context, first load online, then the site is made unreachable.
  //    Local build: the preview server is killed. Live site: all traffic goes through a local CONNECT proxy which is
  //    cut (open tunnels destroyed, new ones refused). Chromium additionally goes setOffline(); WebKit only after OCR.
  const srv2 = LIVE ? null : await serve(4181);
  const B2 = LIVE ?? `http://127.0.0.1:4181${BASE_PATH}`;
  const proxy = LIVE ? await startCuttableProxy() : null;
  const obrowser = LIVE ? await launch(ENGINE, { proxy: { server: `http://127.0.0.1:${proxy.port}` } }) : browser;
  const octx = await obrowser.newContext({ ...MOBILE });
  const op = await octx.newPage();
  await op.goto(B2);
  await op.evaluate(async () => { await navigator.serviceWorker.ready; });
  // wait until precache install finished (all 6 languages cached)
  await op.waitForFunction(async () => {
    const keys = await caches.keys(); let n = 0;
    for (const k of keys) for (const r of await (await caches.open(k)).keys()) if (r.url.includes('traineddata')) n++;
    return n >= 6;
  }, null, { timeout: 180000, polling: 1000 });
  if (LIVE) check('live first load went through the test proxy', proxy.tunnels() > 0, `${proxy.tunnels()} tunnels`);
  kill(srv2);
  proxy?.cut();
  await new Promise((r) => setTimeout(r, 1500));
  const serverDown = LIVE
    ? await op.evaluate(async (u) => { try { await fetch(u + '__probe_' + Date.now(), { cache: 'no-store' }); return false; } catch { return true; } }, B2)
    : await fetch(B2).then(() => false).catch(() => true);
  if (!WK) await octx.setOffline(true);
  await op.reload();
  await op.waitForSelector('[data-testid=camera-btn]', { timeout: 15000 });
  check(WK ? `app shell loads with the ${LIVE ? 'site unreachable (proxy cut)' : 'server stopped'} (served by the service worker)` : `app shell loads offline (${LIVE ? 'site unreachable via proxy cut' : 'server stopped'} + browser offline)`, serverDown);
  if (!WK) check('offline badge shown', /Offline/.test(await op.textContent('[data-testid=net-status]') ?? ''));
  await op.setInputFiles('[data-testid=file-input]', 'test-docs/it_hotel_cancellation.jpg');
  const offOk = await op.waitForSelector('[data-testid=action-card]', { timeout: 180000 }).then(() => true).catch(() => false);
  if (WK) {
    await octx.setOffline(true);
    await op.waitForTimeout(500);
    check('offline badge shown (WebKit: after setOffline, once OCR finished)', /Offline/.test(await op.textContent('[data-testid=net-status]') ?? ''));
  }
  const offCard = offOk ? await op.evaluate(() => ({ type: document.querySelector('[data-field=docType]')?.getAttribute('data-value'), deadline: document.querySelector('[data-field=deadline]')?.getAttribute('data-value'), lang: document.querySelector('[data-field=docLanguage]')?.getAttribute('data-value') })) : {};
  check(WK ? `OCR + extraction work with the ${LIVE ? 'site unreachable' : 'server stopped'} (OCR files from the SW cache; auto language eng then ita)` : 'OCR + extraction work fully offline (auto language: eng pass then ita)', offOk && offCard.type === 'hotel_cancellation' && offCard.deadline === '2026-11-07' && offCard.lang === 'it', JSON.stringify(offCard));
  await op.screenshot({ path: `${SHOTS}/06-offline-card.png` });
  await octx.close();
  if (LIVE) { await obrowser.close(); proxy.close(); }
} finally {
  await browser.close();
  kill(srv);
}
writeFileSync(`test-results/e2e-results-${tag}.json`, JSON.stringify({ engine: ENGINE, device: deviceName, basePath: BASE_PATH, target: LIVE ?? DIST, ranAt: new Date().toString(), results }, null, 2));
const failed = results.filter((r) => r.ok === false);
const skipped = results.filter((r) => r.skipped);
console.log(`\n${results.length - failed.length - skipped.length}/${results.length - skipped.length} checks passed${skipped.length ? `, ${skipped.length} skipped` : ''}`);
process.exit(failed.length ? 1 : 0);
