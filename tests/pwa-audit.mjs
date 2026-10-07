// PWA audit (Lighthouse 12+ no longer has a PWA category, so this checks it directly in Chrome via CDP).
// Usage: node tests/pwa-audit.mjs [url]   default http://localhost:4173/
import { chromium } from 'playwright';
import { writeFileSync } from 'node:fs';
const url = process.argv[2] ?? 'http://localhost:4173/';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
// A persistent (non-incognito) profile: Chrome reports "in-incognito" as an installability error otherwise.
const dir = mkdtempSync(join(tmpdir(), 'pwa-audit-'));
const ctx = await chromium.launchPersistentContext(dir, { executablePath: process.env.CHROME_PATH ?? '/usr/bin/google-chrome', args: ['--no-sandbox'], headless: true,
  viewport: { width: 412, height: 915 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2.6 });
const b = { close: async () => { await ctx.close(); rmSync(dir, { recursive: true, force: true }); } };
const page = ctx.pages()[0] ?? await ctx.newPage();
await page.goto(url);
await page.evaluate(async () => { await navigator.serviceWorker.ready; });
await page.reload();
const cdp = await ctx.newCDPSession(page);
const inst = await cdp.send('Page.getInstallabilityErrors');
const man = await cdp.send('Page.getAppManifest');
const info = await page.evaluate(async () => {
  const q = (s) => document.querySelector(s);
  const link = q('link[rel=manifest]');
  const m = await (await fetch(link.href)).json();
  const load = async (src) => { const i = new Image(); i.src = src; try { await i.decode(); } catch { return null; }
    const c = document.createElement('canvas'); c.width = i.naturalWidth; c.height = i.naturalHeight; const g = c.getContext('2d'); g.drawImage(i, 0, 0);
    const px = (x, y) => g.getImageData(x, y, 1, 1).data[3];
    return { w: i.naturalWidth, h: i.naturalHeight, cornerAlpha: px(1, 1) }; };
  const icons = [];
  for (const ic of m.icons) icons.push({ ...ic, img: await load(new URL(ic.src, link.href).href) });
  const apple = q('link[rel=apple-touch-icon]');
  return {
    manifest: m, icons,
    appleTouchIcon: apple ? { href: apple.getAttribute('href'), img: await load(apple.href) } : null,
    meta: Object.fromEntries(['theme-color', 'apple-mobile-web-app-capable', 'mobile-web-app-capable', 'apple-mobile-web-app-status-bar-style', 'apple-mobile-web-app-title', 'viewport', 'description'].map((n) => [n, q(`meta[name="${n}"]`)?.getAttribute('content') ?? null])),
    lang: document.documentElement.lang, title: document.title,
    swControlled: !!navigator.serviceWorker.controller, swScope: (await navigator.serviceWorker.getRegistration())?.scope,
  };
});
await b.close();
const checks = [];
const c = (name, ok, detail = '') => { checks.push({ name, ok: !!ok, detail }); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  — ' + detail : ''}`); };
const m = info.manifest;
c('Chrome reports no installability errors (Page.getInstallabilityErrors)', inst.installabilityErrors.length === 0, JSON.stringify(inst.installabilityErrors));
c('Chrome manifest parser reports no errors', (man.errors ?? []).length === 0, JSON.stringify(man.errors));
c('manifest: name, short_name, description, lang', m.name && m.short_name && m.description && m.lang, `${m.name} / ${m.short_name}`);
c('manifest: start_url, scope and id set and consistent', m.start_url && m.scope && m.id && m.start_url.startsWith(m.scope), `${m.start_url} ${m.scope} ${m.id}`);
c('manifest: display standalone, orientation portrait', m.display === 'standalone' && m.orientation === 'portrait');
c('manifest: theme_color matches <meta name=theme-color>', m.theme_color === info.meta['theme-color'], `${m.theme_color} vs ${info.meta['theme-color']}`);
c('manifest: background_color set', !!m.background_color, m.background_color);
const ic = (s, p) => info.icons.find((i) => i.sizes === `${s}x${s}` && (p ? (i.purpose ?? '').includes(p) : !(i.purpose ?? '').includes('maskable')));
c('icon 192x192 (any) loads at the declared size', ic(192)?.img?.w === 192 && ic(192)?.img?.h === 192);
c('icon 512x512 (any) loads at the declared size', ic(512)?.img?.w === 512);
c('maskable 512x512 loads and is full-bleed (opaque corner, so no transparent ring when masked)', ic(512, 'maskable')?.img?.w === 512 && ic(512, 'maskable')?.img?.cornerAlpha === 255, `corner alpha ${ic(512, 'maskable')?.img?.cornerAlpha}`);
c('apple-touch-icon present, 180x180, opaque (iOS ignores transparency)', info.appleTouchIcon?.img?.w === 180 && info.appleTouchIcon?.img?.cornerAlpha === 255, JSON.stringify(info.appleTouchIcon));
c('iOS meta: apple-mobile-web-app-capable=yes, status-bar-style, title', info.meta['apple-mobile-web-app-capable'] === 'yes' && info.meta['apple-mobile-web-app-status-bar-style'] && info.meta['apple-mobile-web-app-title']);
c('viewport meta includes width=device-width and viewport-fit=cover (notch)', /width=device-width/.test(info.meta.viewport ?? '') && /viewport-fit=cover/.test(info.meta.viewport ?? ''), info.meta.viewport);
c('page is controlled by the service worker after reload', info.swControlled, info.swScope);
const u = new URL(url);
writeFileSync(`test-results/pwa-audit${!/^(localhost|127\.0\.0\.1)$/.test(u.hostname) ? '-live' : u.pathname === '/' ? '' : '-subpath'}.json`, JSON.stringify({ url, ranAt: new Date().toString(), checks, info: { ...info, icons: info.icons.map(({ img, ...r }) => ({ ...r, ...img })) }, installabilityErrors: inst.installabilityErrors }, null, 2));
const f = checks.filter((x) => !x.ok).length;
console.log(`\n${checks.length - f}/${checks.length} PWA checks passed`);
process.exit(f ? 1 : 0);
