// UI screenshots for design review: home, processing, finished card, saved list, settings, dark-mode home + card,
// on iPhone 14 (Playwright WebKit) and Pixel 7 (Chromium). Emulation only, not real devices.
// Usage: APP_URL=http://127.0.0.1:4186/ TAG=before node tests/ui-screens.mjs   -> test-results/ui-redesign/<TAG>-<device>-<view>.png
import { mkdirSync } from 'node:fs';
import { launch, BASE, deviceProfile } from './browser.mjs';
const TAG = process.env.TAG ?? 'shot';
const DOC = process.env.DOC ?? 'test-docs/de_parking_ticket.png';
const OUT = 'test-results/ui-redesign';
mkdirSync(OUT, { recursive: true });

async function shoot(engine, short) {
  const browser = await launch(engine);
  const { name, ...dev } = deviceProfile(engine);
  for (const scheme of ['light', 'dark']) {
    const ctx = await browser.newContext({ ...dev, colorScheme: scheme, reducedMotion: 'reduce', serviceWorkers: 'block' });
    const page = await ctx.newPage();
    const p = (v) => { console.log(short, scheme, v); return `${OUT}/${TAG}-${short}-${v}.png`; };
    await page.goto(BASE, { waitUntil: 'networkidle', timeout: 120000 });
    await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); indexedDB.deleteDatabase('action-card'); });
    await page.goto(BASE, { waitUntil: 'networkidle', timeout: 120000 });
    await page.waitForSelector('[data-testid=camera-btn]');
    const pre = scheme === 'dark' ? 'dark-' : '';
    await page.screenshot({ path: p(`${pre}home`) });
    // slow the OCR assets down a little so the processing state can be captured reliably
    await page.route('**/tesseract/**', async (r) => { await new Promise((ok) => setTimeout(ok, 1200)); await r.continue(); });
    await page.setInputFiles('[data-testid=file-input]', DOC);
    if (scheme === 'light') {
      await page.waitForSelector('[data-testid=processing]', { timeout: 60000 });
      // capture mid-way (text being read), same moment for the old and new UI
      await page.waitForFunction(() => /Reading \(/.test(document.querySelector('[data-testid=processing]')?.textContent ?? ''), null, { timeout: 60000, polling: 50 }).catch(() => {});
      await page.waitForTimeout(150);
      await page.screenshot({ path: p('processing') });
    }
    await page.waitForSelector('[data-testid=action-card]', { timeout: 300000 });
    await page.waitForTimeout(400);
    await page.screenshot({ path: p(`${pre}card`) });
    await page.screenshot({ path: p(`${pre}card-full`), fullPage: true });
    if (scheme === 'light') {
      await page.click('[data-testid=save-btn]');
      await page.waitForSelector('[data-testid=save-btn]:has-text("Saved")');
      await page.click('[data-testid=back-btn]'); // card screen hides the tab bar
      await page.click('[data-testid=tab-history]');
      await page.waitForSelector('[data-testid=history-item]');
      await page.waitForTimeout(300);
      await page.screenshot({ path: p('saved') });
      await page.click('[data-testid=tab-settings]');
      await page.waitForSelector('[data-testid=settings]');
      await page.waitForTimeout(300);
      await page.screenshot({ path: p('settings') });
    }
    await ctx.close();
  }
  await browser.close();
  console.log('done', name);
}
const only = process.env.ONLY;
if (!only || only === 'iphone14') await shoot('webkit', 'iphone14');
if (!only || only === 'pixel7') await shoot('chromium', 'pixel7');
