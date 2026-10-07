import { launch, MOBILE } from './browser.mjs';
const b = await launch(); const p = await (await b.newContext(MOBILE)).newPage();
await p.goto('http://localhost:4173/');
await p.setInputFiles('[data-testid=file-input]', 'test-docs/stress_de_traffic_fine_tiny_blurry.jpg');
await p.waitForSelector('[data-testid=action-card]', { timeout: 120000 });
console.log(await p.textContent('[data-testid=mode-note]').catch(() => 'no note'));
await p.screenshot({ path: 'screenshots/07-unreadable-photo-warning.png' });
await b.close();
