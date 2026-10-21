// End-to-end checks of the v2 features on the production build (dist): bad-photo warning, read aloud + Easy Language,
// "when did you receive it?" deadlines, payment QR (make + read EPC / Swiss QR-bill), reading in an extra language,
// and right-to-left layout for Arabic, Persian and Urdu. AI-mode redaction/preview is covered in tests/e2e.mjs.
// Usage: node tests/e2e-v2.mjs   (ENGINE=webkit for iPhone emulation)
import { spawn, execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { launch, deviceProfile, ENGINE } from './browser.mjs';

const { name: deviceName, ...MOBILE } = deviceProfile(ENGINE);
const results = [];
const check = (name, ok, detail = '') => { results.push({ name, ok: !!ok, detail }); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  — ' + detail : ''}`); };
const SHOTS = `test-results/v2-${ENGINE}`; mkdirSync(SHOTS, { recursive: true });
const FX = 'test-results/v2-fixtures';
execFileSync('node', ['scripts/make-v2-fixtures.mjs'], { stdio: 'inherit' });
const PORT = 4185;
const srv = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], { detached: true, stdio: 'ignore' });
const BASE = `http://127.0.0.1:${PORT}/`;
for (let i = 0; i < 60; i++) { if (await fetch(BASE).then((r) => r.ok).catch(() => false)) break; await new Promise((r) => setTimeout(r, 500)); }
const browser = await launch();
const field = (pg, f) => pg.evaluate((f) => document.querySelector(`[data-field=${f}]`)?.getAttribute('data-value') ?? null, f);
const setSettings = (pg, patch) => pg.evaluate((p) => { const k = 'actioncard.settings.v1'; localStorage.setItem(k, JSON.stringify({ ...JSON.parse(localStorage.getItem(k) || '{}'), ...p })); }, patch);
const home = async (pg) => { await pg.goto(BASE); await pg.waitForSelector('[data-testid=camera-btn]'); };
/** upload; returns 'card' | 'warning' | 'timeout'. useAnyway: tap "Use it anyway" when warned */
const open = async (pg, file, useAnyway = true) => {
  await home(pg);
  await pg.setInputFiles('[data-testid=file-input]', file);
  const el = await pg.waitForSelector('[data-testid=action-card], [data-testid=photo-warning]', { timeout: 240000 }).catch(() => null);
  if (!el) return 'timeout';
  if ((await el.getAttribute('data-testid')) === 'photo-warning') {
    if (!useAnyway) return 'warning';
    await pg.click('[data-testid=photo-use]');
    await pg.waitForSelector('[data-testid=action-card]', { timeout: 240000 });
    return 'warning';
  }
  return 'card';
};
const noOverflow = (pg) => pg.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
try {
  const ctx = await browser.newContext({ ...MOBILE });
  await ctx.addInitScript(() => { try { sessionStorage.clear(); } catch { /* */ } });
  await ctx.route('https://api.x.ai/**', (r) => r.abort());
  // speech: record what would be spoken (no audio in CI); no voices listed -> the app passes the language tag
  await ctx.addInitScript(() => {
    window.__spoken = [];
    // installed voices as Safari lists them (names only; quality and gender are not reported by Web Speech)
    const voices = [['Samantha', 'en-US'], ['Daniel (Enhanced)', 'en-GB'], ['Zoe (Premium)', 'en-US'], ['Albert', 'en-US'], ['Anna', 'de-DE'], ['Markus', 'de-DE'], ['Rocko', 'de-DE'], ['Jorge', 'es-ES']]
      .map(([name, lang]) => ({ name, lang, voiceURI: 'v:' + name, localService: true, default: false }));
    const fake = { getVoices: () => voices, speak: (u) => { window.__spoken.push({ lang: u.lang, text: u.text, voice: u.voice?.name ?? null, rate: u.rate, pitch: u.pitch }); setTimeout(() => u.onend?.(), 50); }, cancel: () => {}, speaking: false, addEventListener: () => {} };
    try { Object.defineProperty(window, 'speechSynthesis', { value: fake, configurable: true }); } catch { /* */ }
    window.SpeechSynthesisUtterance = class { constructor(text) { this.text = text; this.lang = ''; this.voice = null; this.rate = 1; this.pitch = 1; } };
  });
  const page = await ctx.newPage();
  const errors = []; page.on('pageerror', (e) => errors.push(e.message));
  await home(page); await setSettings(page, { userLanguage: 'en', docLanguage: 'auto' });

  // 0. one picker for photos, screenshots and PDFs (camera button kept); JPEG / PNG / screenshot / HEIC / large photo
  {
    execFileSync('python3', ['scripts/make-picker-fixtures.py'], { stdio: 'ignore' });
    const PF = 'test-results/picker-fixtures';
    await home(page);
    const ui = await page.evaluate(() => ({
      pickers: document.querySelectorAll('.capture-actions input[type=file]:not([capture])').length,
      camera: !!document.querySelector('[data-testid=camera-btn] input[capture]'),
      oldPdfBtn: !!document.querySelector('[data-testid=pdf-open-btn], [data-testid=pdf-input]'),
      accept: document.querySelector('[data-testid=file-input]')?.getAttribute('accept') ?? '',
      label: document.querySelector('[data-testid=upload-btn]')?.textContent ?? '',
    }));
    check('one "Choose photo or PDF" button (images + PDF), camera button kept, old duplicate gone',
      ui.pickers === 1 && ui.camera && !ui.oldPdfBtn && /image\/\*/.test(ui.accept) && /application\/pdf/.test(ui.accept) && /Choose photo or PDF/.test(ui.label) && !/gallery/i.test(ui.label), JSON.stringify(ui));
    for (const [f, what] of [['picked.png', 'PNG'], ['picked-large.jpg', 'large JPEG (4400 px, downscaled once)'], ['screenshot.png', 'iPhone screenshot']]) {
      const res = await open(page, `${PF}/${f}`);
      check(`picked ${what} -> card with amount 35 EUR`, res !== 'timeout' && (await field(page, 'amount')) === '35 EUR', `${res} ${await field(page, 'amount')}`);
    }
    // a photo handed over without a type or extension (as some pickers do)
    await home(page);
    await page.setInputFiles('[data-testid=file-input]', { name: 'IMG_0001', mimeType: '', buffer: readFileSync(`${PF}/picked.png`) });
    await page.waitForSelector('[data-testid=action-card], [data-testid=photo-warning]', { timeout: 240000 });
    if (await page.locator('[data-testid=photo-warning]').count()) { await page.click('[data-testid=photo-use]'); await page.waitForSelector('[data-testid=action-card]', { timeout: 240000 }); }
    check('picked image without type or extension still opens', (await field(page, 'amount')) === '35 EUR');
    // HEIC: decoded where the engine can (iOS WebKit); otherwise a clear, translated message instead of a raw error
    await home(page);
    await page.setInputFiles('[data-testid=file-input]', `${PF}/picked.heic`);
    const el = await page.waitForSelector('[data-testid=action-card], [data-testid=photo-warning], .alert.error', { timeout: 240000 });
    let kind = await el.getAttribute('data-testid');
    if (kind === 'photo-warning') { await page.click('[data-testid=photo-use]'); await page.waitForSelector('[data-testid=action-card]', { timeout: 240000 }); kind = 'action-card'; }
    const heicMsg = kind === 'action-card' ? `decoded, amount ${await field(page, 'amount')}` : (await el.textContent()) ?? '';
    check(`picked HEIC -> card, or a clear message if this engine cannot decode HEIC (${ENGINE})`,
      kind === 'action-card' ? (await field(page, 'amount')) === '35 EUR' : /could not be opened.*JPEG or PNG/.test(heicMsg) && !/Could not process/.test(heicMsg), heicMsg.slice(0, 160));
    // PDF through the same button
    const res = await open(page, 'test-docs/pdf/digital_inkasso_2pages.pdf');
    check('PDF through the same button -> card', res !== 'timeout' && !!(await field(page, 'amount')), String(await field(page, 'amount')));
    await home(page);
    await page.screenshot({ path: `${SHOTS}/v2-picker-home.png` });
  }

  // 1. bad photo: warning before OCR, retake = nothing read, use anyway = card
  let r = await open(page, `${FX}/de_parking_dark.png`, false);
  const issues = r === 'warning' ? await page.evaluate(() => [...document.querySelectorAll('[data-testid=photo-warning] [data-issue]')].map((e) => e.getAttribute('data-issue'))) : [];
  check('too-dark photo: warning shown BEFORE reading, naming the problem', r === 'warning' && issues.includes('dark'), `${r} ${issues}`);
  await page.screenshot({ path: `${SHOTS}/v2-photo-warning.png` });
  await page.click('[data-testid=photo-retake]');
  await page.waitForTimeout(300);
  check('"Retake" closes the warning and reads nothing', (await page.locator('[data-testid=photo-warning]').count()) === 0 && (await page.locator('[data-testid=action-card]').count()) === 0);
  r = await open(page, `${FX}/de_parking_dark.png`, true);
  check('"Use it anyway" still reads the photo', r === 'warning' && (await page.locator('[data-testid=action-card]').count()) === 1);
  r = await open(page, 'test-docs/de_parking_ticket.png');
  check('a good photo goes straight to the card (no warning)', r === 'card', r);

  // 2. read aloud + Easy Language
  const easyBtn = page.locator('[data-testid=easy-btn]');
  await easyBtn.click();
  const easy = await page.textContent('[data-testid=easy-text]');
  check('Easy Language: short sentences with the deadline, the money and the file number', /35/.test(easy) && /702\.41\.883915\.6/.test(easy) && /19 Oct/.test(easy), easy.slice(0, 160));
  await page.click('[data-testid=speak-card]');
  await page.waitForTimeout(400);
  let spoken = await page.evaluate(() => window.__spoken.at(-1));
  check('"Read card aloud" speaks the Easy Language text in the app language (en)', spoken?.lang?.startsWith('en') && /35/.test(spoken.text), JSON.stringify(spoken).slice(0, 120));
  await page.click('[data-testid=speak-letter]');
  await page.waitForTimeout(400);
  spoken = await page.evaluate(() => window.__spoken.at(-1));
  check('"Read letter aloud" speaks the original text in the letter language (de-DE)', spoken?.lang === 'de-DE' && /Verwarnungsgeld/.test(spoken.text), spoken?.lang);
  check('read aloud picks the best voice, natural rate and pitch (Premium > Enhanced > default, never a novelty/robotic voice)',
    (await page.evaluate(() => window.__spoken.at(-2)?.voice)) === 'Zoe (Premium)' && spoken.voice === 'Anna' && spoken.rate >= 0.9 && spoken.pitch === 1, `${await page.evaluate(() => window.__spoken.at(-2)?.voice)} / ${spoken.voice}`);
  await page.locator('[data-testid=listen-box]').evaluate((e) => e.scrollIntoView({ block: 'start' })); await page.evaluate(() => window.scrollBy(0, -70));
  await page.screenshot({ path: `${SHOTS}/v2-easy.png` });
  // Settings > Reading voice: Automatic / Female / Male + Preview + fallback note
  await home(page); await page.click('[data-testid=tab-settings]');
  await page.waitForSelector('[data-testid=voice-section]');
  check('Settings shows the reading voice choice with the voice in use', /Voice: Zoe \(Premium\)/.test(await page.textContent('[data-testid=voice-status]')), await page.textContent('[data-testid=voice-status]'));
  await page.selectOption('[data-testid=voice-gender]', 'male');
  check('Male -> best male voice for the language', /Voice: Daniel \(Enhanced\)/.test(await page.textContent('[data-testid=voice-status]')), await page.textContent('[data-testid=voice-status]'));
  await page.click('[data-testid=voice-preview]'); await page.waitForTimeout(400);
  spoken = await page.evaluate(() => window.__spoken.at(-1));
  check('"Preview voice" speaks a sample sentence with the chosen voice', spoken?.voice === 'Daniel (Enhanced)' && /LetterScan/.test(spoken.text), JSON.stringify(spoken).slice(0, 120));
  check('setting saved on the phone', await page.evaluate(() => JSON.parse(localStorage.getItem('actioncard.settings.v1')).voiceGender) === 'male');
  await setSettings(page, { userLanguage: 'es', voiceGender: 'female' });
  await home(page); await page.click('[data-testid=tab-settings]'); await page.waitForSelector('[data-testid=voice-status]');
  const esMsg = await page.textContent('[data-testid=voice-status]');
  check('no voice of the chosen gender -> another voice is used and the app says so (es, female -> Jorge)', /voz femenina/.test(esMsg) && /Jorge/.test(esMsg), esMsg);
  await page.screenshot({ path: `${SHOTS}/v2-voice-settings.png` });
  await setSettings(page, { userLanguage: 'en', voiceGender: 'auto' });

  // 3. payment QR: make an EPC code from the letter (sample IBAN is not checksum-valid -> no maker), read a QR in the photo
  r = await open(page, `${FX}/de_parking_epc_qr.png`);
  const found = await page.locator('[data-testid=pay-qr-found]').getAttribute('data-kind').catch(() => null);
  check('EPC payment QR in the photo is read on the phone and shown', found === 'epc' && /DE89370400440532013000/.test((await page.textContent('[data-testid=pay-qr-found]')) ?? ''), `${r} ${found}`);
  check('QR IBAN differs from the IBAN printed in the letter -> warning', (await page.locator('[data-testid=pay-qr-mismatch]').count()) === 1);
  check('"check before paying" warning always shown; nothing pays automatically', (await page.locator('[data-testid=pay-warning]').count()) === 1 && (await page.locator('a[href^="bank"], a[href*="pay"]').count()) === 0);
  await page.locator('[data-testid=pay-box]').evaluate((e) => e.scrollIntoView({ block: 'start' })); await page.evaluate(() => window.scrollBy(0, -70));
  await page.screenshot({ path: `${SHOTS}/v2-pay-qr-found.png` });
  r = await open(page, `${FX}/ch_qr_bill.png`);
  const swiss = await page.textContent('[data-testid=pay-qr-found]').catch(() => '');
  check('Swiss QR-bill read: IBAN, recipient, CHF amount, QR reference', /CH4431999123000889012/.test(swiss) && /Robert Schneider AG/.test(swiss) && /1949\.75 CHF/.test(swiss) && /210000000003139471430009017/.test(swiss), swiss.slice(0, 160));
  r = await open(page, 'test-docs/pdf/digital_inkasso_2pages.pdf');
  check('letter with a valid euro IBAN offers "make payment QR" with recipient, amount and reference filled in', (await page.locator('[data-testid=pay-make]').count()) === 1 && (await page.inputValue('[data-testid=pay-amount]')) === '186.40' && !!(await page.inputValue('[data-testid=pay-ref]')), `${await page.inputValue('[data-testid=pay-name]').catch(() => '')} | ${await page.inputValue('[data-testid=pay-ref]').catch(() => '')}`);
  if (!(await page.inputValue('[data-testid=pay-name]'))) await page.fill('[data-testid=pay-name]', 'Inkasso Test GmbH');
  await page.click('[data-testid=pay-make]');
  const qrImg = await page.waitForSelector('[data-testid=pay-qr]', { timeout: 10000 }).then((e) => e.getAttribute('src')).catch(() => null);
  check('payment QR generated on the phone (image, no network)', /^data:image\/png;base64,/.test(qrImg ?? ''));
  await page.fill('[data-testid=pay-name]', '');
  await page.click('[data-testid=pay-make]');
  check('missing recipient -> clear error, no QR', (await page.locator('[data-testid=pay-error]').count()) === 1 && (await page.locator('[data-testid=pay-qr]').count()) === 0);
  await page.fill('[data-testid=pay-name]', 'Inkasso Test GmbH'); await page.click('[data-testid=pay-make]'); await page.waitForSelector('[data-testid=pay-qr]');
  await page.locator('[data-testid=pay-box]').evaluate((e) => e.scrollIntoView({ block: 'start' })); await page.evaluate(() => window.scrollBy(0, -70));
  await page.screenshot({ path: `${SHOTS}/v2-pay-make.png` });

  // 4. received date: German tax notice, objection 1 month after notification (4-day rule, § 122 AO)
  r = await open(page, `${FX}/de_steuerbescheid_bekanntgabe.pdf`);
  check('deadline counted from notification -> "When did you receive it?" box', (await page.locator('[data-testid=received-box]').count()) === 1, `${r} ${await field(page, 'deadline')}`);
  await page.fill('[data-testid=received-date]', '2026-10-09');
  await page.selectOption('[data-testid=received-country]', 'DE');
  await page.click('[data-testid=received-apply]');
  await page.waitForSelector('[data-testid=received-steps]');
  const steps = await page.evaluate(() => [...document.querySelectorAll('[data-testid=received-steps] li')].map((e) => e.getAttribute('data-step')));
  const rule = await page.locator('[data-testid=received-rule]').getAttribute('data-verified');
  check('DE: computation shown step by step (posted, 4th day, received later, result, safer date)', ['rcv_posted', 'rcv_deemed', 'rcv_received', 'rcv_later', 'rcv_result', 'rcv_safer'].every((s) => steps.includes(s)), steps.join(','));
  check('DE: deadline becomes the SAFER date 6 Nov 2026 (one month from the 4th day after 2 Oct); rule marked verified (§ 122 AO)', (await field(page, 'deadline')) === '2026-11-06' && rule === '1' && /122/.test((await page.textContent('[data-testid=received-rule]')) ?? ''), await field(page, 'deadline'));
  await page.locator('[data-testid=received-box]').evaluate((e) => e.scrollIntoView({ block: 'start' })); await page.evaluate(() => window.scrollBy(0, -70));
  await page.screenshot({ path: `${SHOTS}/v2-received.png` });
  await page.selectOption('[data-testid=received-country]', 'FR');
  await page.click('[data-testid=received-apply]');
  await page.waitForTimeout(200);
  check('other country: counted from the day received and clearly marked NOT verified', (await field(page, 'deadline')) === '2026-11-09' && (await page.locator('[data-testid=received-rule]').getAttribute('data-verified')) === '0', await field(page, 'deadline'));

  // 5. extra reading language: Turkish chosen by hand (Tesseract tur data loaded from this site on first use)
  const tp = await ctx.newPage();
  await tp.setViewportSize({ width: 900, height: 600 });
  await tp.setContent(`<html><body style="margin:0;background:#fff"><pre style="font:34px/1.5 Arial,sans-serif;margin:40px">Para cezası bildirimi
Dosya numarası: 2026/4471
Ödenecek tutar: 35 avro
Lütfen 06.11.2026 tarihine kadar ödeyin</pre></body></html>`);
  await tp.screenshot({ path: `${FX}/tr_notice.png` }); await tp.close();
  await home(page);
  const groups = await page.evaluate(() => [...document.querySelectorAll('[data-testid=doclang] optgroup')].map((g) => g.children.length));
  check('document language list: 6 languages with full rules + 12 reading-only languages', groups.join() === '6,12', groups.join());
  await page.selectOption('[data-testid=doclang]', 'tr');
  await page.setInputFiles('[data-testid=file-input]', `${FX}/tr_notice.png`);
  await page.waitForSelector('[data-testid=action-card], [data-testid=photo-warning]', { timeout: 240000 });
  if (await page.locator('[data-testid=photo-warning]').count()) { await page.click('[data-testid=photo-use]'); await page.waitForSelector('[data-testid=action-card]', { timeout: 240000 }); }
  const fullText = await page.textContent('[data-testid=action-card]');
  check('Turkish letter read in Turkish: text with ı/ş/ü, amount found, note that wording rules are not available', /cezası/.test(fullText) && /Ödenecek|ödeyin/.test(fullText) && (await field(page, 'amount')) === '35 EUR' && (await page.locator('[data-testid=read-language-note]').count()) === 1, await field(page, 'amount'));
  await setSettings(page, { docLanguage: 'auto' });

  // 6. right-to-left UI: Arabic, Persian, Urdu
  for (const l of ['ar', 'fa', 'ur']) {
    await setSettings(page, { userLanguage: l });
    r = await open(page, 'test-docs/de_parking_ticket.png');
    const st = await page.evaluate(() => {
      const card = document.querySelector('[data-testid=action-card]');
      const head = document.querySelector('[data-field=deadline] .field-label, [data-field=deadline] label, [data-field=deadline]');
      return { dir: document.documentElement.dir, lang: document.documentElement.lang, cardDir: card ? getComputedStyle(card).direction : '', align: head ? getComputedStyle(head).textAlign : '' };
    });
    check(`${l} UI: page dir=rtl, card laid out right-to-left`, st.dir === 'rtl' && st.lang === l && st.cardDir === 'rtl', JSON.stringify(st));
    check(`${l} UI: no horizontal overflow on the card`, await noOverflow(page));
    check(`${l} UI: quoted German text keeps its own direction`, await page.evaluate(() => { const s = document.querySelector('.snippet'); return !!s && getComputedStyle(s).unicodeBidi === 'plaintext'; }));
    await page.click('[data-testid=easy-btn]');
    check(`${l} UI: Easy Language block is RTL and in ${l}`, (await page.getAttribute('[data-testid=easy-text]', 'dir')) === 'rtl' && /[\u0600-\u06FF]/.test((await page.textContent('[data-testid=easy-text]')) ?? ''));
    await page.screenshot({ path: `${SHOTS}/v2-rtl-${l}-card.png` });
    await home(page);
    const tabsX = await page.evaluate(() => ['scan', 'history', 'settings'].map((k) => document.querySelector(`[data-testid=tab-${k}]`).getBoundingClientRect().x));
    check(`${l} UI: tab bar mirrored (Scan on the right)`, tabsX[0] > tabsX[1] && tabsX[1] > tabsX[2], tabsX.join());
    await page.click('[data-testid=tab-settings]');
    check(`${l} UI: settings translated, no overflow`, /[\u0600-\u06FF]/.test((await page.textContent('[data-testid=tab-settings]')) ?? '') && await noOverflow(page));
    await page.screenshot({ path: `${SHOTS}/v2-rtl-${l}-settings.png` });
  }
  for (const l of ['ro', 'vi', 'zh', 'tl', 'hi']) {
    await setSettings(page, { userLanguage: l });
    await home(page);
    const st = await page.evaluate(() => [document.documentElement.dir, document.documentElement.lang, document.querySelector('[data-testid=tab-settings]')?.textContent]);
    check(`${l} UI loads LTR and translated`, st[0] === 'ltr' && st[1] === l && !/Settings/.test(st[2] ?? ''), st.join(' | '));
  }
  await setSettings(page, { userLanguage: 'en' });
  check('no page errors', errors.length === 0, errors.join(' | '));
  await ctx.close();
} finally {
  await browser.close();
  try { process.kill(-srv.pid, 'SIGTERM'); } catch { /* */ }
}
writeFileSync(`test-results/e2e-v2-${ENGINE}.json`, JSON.stringify({ engine: ENGINE, device: deviceName, ranAt: new Date().toString(), results }, null, 2));
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} v2 checks passed (${ENGINE})`);
process.exit(failed.length ? 1 : 0);
