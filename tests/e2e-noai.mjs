// The iOS app is built WITHOUT AI mode (VITE_AI_ENABLED unset, the default). Checks on that default build (dist):
// no AI-mode UI anywhere, an AI setting + key saved by an older build is ignored, and scanning a letter makes no request
// to xAI. Also checks the built files contain no api.x.ai address and the page's CSP allows no outside address.
// Usage: npm run build && node tests/e2e-noai.mjs   (ENGINE=webkit for iPhone emulation)
import { spawn } from 'node:child_process';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { launch, deviceProfile, ENGINE } from './browser.mjs';

const { name: deviceName, ...MOBILE } = deviceProfile(ENGINE);
const results = [];
const check = (name, ok, detail = '') => { results.push({ name, ok: !!ok }); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  — ' + detail : ''}`); };
console.log(`engine=${ENGINE} device=${deviceName}`);

// 0. static: no xAI address in the app code or page (privacy.html is a public info page, not app code)
const files = []; const walk = (d) => { for (const f of readdirSync(d)) { const p = join(d, f); if (statSync(p).isDirectory()) walk(p); else if (/\.(js|mjs|html)$/.test(f) && !/privacy\.html$|support\.html$/.test(f) && !p.includes('tesseract')) files.push(p); } };
walk('dist');
const hits = files.filter((f) => readFileSync(f, 'utf8').includes('api.x.ai'));
check('built app code (dist js/html) contains no "api.x.ai"', hits.length === 0, hits.join(', '));
check('no xAI request code in the bundle (chat/completions)', !files.some((f) => readFileSync(f, 'utf8').includes('chat/completions')));

const PORT = 4187;
const srv = spawn('npx', ['vite', 'preview', '--host', '127.0.0.1', '--port', String(PORT), '--strictPort'], { detached: true, stdio: 'ignore' });
const BASE = `http://127.0.0.1:${PORT}/`;
for (let i = 0; i < 60; i++) { if (await fetch(BASE).then((r) => r.ok).catch(() => false)) break; await new Promise((r) => setTimeout(r, 500)); }
const browser = await launch();
try {
  const ctx = await browser.newContext({ ...MOBILE, serviceWorkers: 'block' });
  const xai = [];
  await ctx.route('https://api.x.ai/**', (r) => { xai.push(r.request().url()); return r.abort(); });
  const page = await ctx.newPage();
  page.on('request', (q) => { if (/x\.ai/.test(q.url())) xai.push(q.url()); });
  const errors = []; page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(BASE); await page.waitForSelector('[data-testid=camera-btn]');
  // settings left by an older build: AI mode on, consent given, a key saved
  await page.evaluate(() => localStorage.setItem('actioncard.settings.v1', JSON.stringify({ userLanguage: 'en', docLanguage: 'auto', aiEnabled: true, aiConsent: true, xaiKey: 'xai-THIS-IS-A-FAKE-TEST-KEY', xaiModel: 'x' })));
  await page.goto(BASE); await page.waitForSelector('[data-testid=camera-btn]');
  const csp = await page.evaluate(() => document.querySelector('meta[http-equiv=Content-Security-Policy]')?.content ?? '');
  check('CSP connect-src allows no outside address', /connect-src 'self';/.test(csp) && !/x\.ai/.test(csp), csp.match(/connect-src[^;]*/)?.[0]);
  await page.click('[data-testid=tab-settings]'); await page.waitForSelector('[data-testid=settings]');
  const ui = await page.evaluate(() => ({ n: document.querySelectorAll('[data-testid=ai-section],[data-testid=ai-toggle],[data-testid=ai-key],[data-testid=ai-save],[data-testid=ai-consent],#xkey').length, text: document.querySelector('[data-testid=settings]')?.textContent ?? '' }));
  check('Settings: no AI-mode section, toggle, consent or key field', ui.n === 0, `${ui.n} elements`);
  check('Settings text never mentions AI mode, xAI or Grok', !/\bAI\b|xAI|Grok|API key/.test(ui.text), (ui.text.match(/.{0,40}(\bAI\b|xAI|Grok).{0,40}/) ?? [''])[0]);
  // scan a letter: offline rules only, no send preview, nothing sent
  await page.click('[data-testid=tab-scan]').catch(() => {});
  await page.goto(BASE); await page.waitForSelector('[data-testid=camera-btn]');
  await page.setInputFiles('[data-testid=file-input]', 'test-docs/de_parking_ticket.png');
  await page.waitForSelector('[data-testid=action-card], [data-testid=photo-warning], [data-testid=send-preview]', { timeout: 240000 });
  if (await page.locator('[data-testid=photo-warning]').count()) await page.click('[data-testid=photo-use]');
  await page.waitForSelector('[data-testid=action-card], [data-testid=send-preview]', { timeout: 240000 });
  check('scanning shows no "send to xAI" preview', (await page.locator('[data-testid=send-preview]').count()) === 0);
  const card = await page.evaluate(() => ({ mode: document.querySelector('[data-testid=action-card]')?.getAttribute('data-mode'), text: document.querySelector('[data-testid=action-card]')?.textContent ?? '' }));
  check('card made by offline rules, card text has no AI-mode mention', card.mode === 'rules' && !/AI mode|xAI/.test(card.text), card.mode);
  check('no request to x.ai was made', xai.length === 0, xai.join(', '));
  check('no uncaught page errors', errors.length === 0, errors.join(' | '));
} finally {
  await browser.close();
  try { process.kill(-srv.pid); } catch { /* */ }
}
const failed = results.filter((r) => !r.ok).length;
console.log(`\n${results.length - failed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
