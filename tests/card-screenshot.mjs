// Screenshot the action card for one image. Usage: APP_URL=... node tests/card-screenshot.mjs <image> <out.png>
import { launch, BASE, MOBILE } from './browser.mjs';
const [img, out] = process.argv.slice(2);
const browser = await launch();
const page = await (await browser.newContext({ ...MOBILE, deviceScaleFactor: 2 })).newPage();
await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 60000 });
await page.evaluate(() => localStorage.clear());
await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 60000 });
await page.setInputFiles('[data-testid=file-input]', img);
await page.waitForSelector('[data-testid=action-card]', { timeout: 300000 });
await page.waitForTimeout(500);
await page.screenshot({ path: out, fullPage: true });
await browser.close();
console.log('saved', out);
