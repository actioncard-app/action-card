import { spawn } from 'node:child_process';
import { chromium } from 'playwright';
const srv = spawn('npx', ['vite', 'preview', '--port', '4191', '--strictPort'], { detached: true, stdio: 'ignore', cwd: '/workspace/letterscan-work' });
const BASE = 'http://127.0.0.1:4191/';
for (let i = 0; i < 60; i++) { if (await fetch(BASE).then((r) => r.ok).catch(() => false)) break; await new Promise((r) => setTimeout(r, 500)); }
const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
const ctx = await b.newContext({ viewport: { width: 430, height: 932 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true, userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1' });
const p = await ctx.newPage();
await p.goto(BASE);
await p.evaluate(() => { localStorage.setItem('actioncard.intro.v1', '1'); localStorage.setItem('actioncard.pro.mock', JSON.stringify({ price: '$5.99', trial: true })); });
await p.reload(); await p.click('[data-testid=tab-settings]'); await p.click('[data-testid=pro-open]');
await p.waitForFunction(() => document.querySelector('[data-testid=pro-buy]')?.getAttribute('data-trial') === '1');
await p.waitForTimeout(600);
await p.screenshot({ path: '/workspace/letterscan-work/screenshots/paywall-6.7.png' });
await b.close(); process.kill(-srv.pid);
