import { chromium, webkit, devices } from 'playwright';
// ENGINE=chromium (default, system Google Chrome) or ENGINE=webkit (Playwright's WebKit build, iPhone emulation).
// WebKit emulation is NOT a real iPhone/iOS Safari: no real camera, share sheet, storage eviction or iOS PWA shell.
export const ENGINE = process.env.ENGINE ?? 'chromium';
export const BASE = process.env.APP_URL ?? 'http://localhost:4173/';
export async function launch(engine = ENGINE, extra = {}) {
  if (engine === 'webkit') return webkit.launch({ headless: true, ...extra });
  return chromium.launch({
    ...extra,
    executablePath: process.env.CHROME_PATH ?? '/usr/bin/google-chrome',
    headless: true,
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
  });
}
// Used by the accuracy runner: 390x844 phone viewport (same as earlier runs).
export const MOBILE = { viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true,
  userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1' };
// Used by e2e: Playwright device descriptors. isMobile is not supported by Playwright's Desktop/Linux WebKit for some
// features, but the descriptor (viewport, DPR, UA, touch) is applied as documented.
export function deviceProfile(engine = ENGINE) {
  if (engine === 'webkit') { const { defaultBrowserType, ...d } = devices['iPhone 14']; return { name: 'iPhone 14 (WebKit)', ...d }; }
  const { defaultBrowserType, ...d } = devices['Pixel 7']; return { name: 'Pixel 7 (Chromium)', ...d };
}
