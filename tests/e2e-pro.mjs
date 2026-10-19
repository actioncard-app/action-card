// End-to-end checks of the Pro backup/restore + all-cards PDF on the production build (dist), web store mock.
// Usage: node tests/e2e-pro.mjs   (ENGINE=webkit for iPhone 14 emulation)
// Not covered (cannot run on Linux): the iOS Filesystem write + share sheet, Files/iCloud Drive picking.
import { spawn } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { launch, deviceProfile, ENGINE, waitCard } from './browser.mjs';

const { name: deviceName, ...MOBILE } = deviceProfile(ENGINE);
const results = [];
const check = (name, ok, detail = '') => { results.push({ name, ok: !!ok, detail }); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  — ' + detail : ''}`); };
const TMP = `test-results/pro-${ENGINE}`; mkdirSync(TMP, { recursive: true });
const PORT = 4185;
const srv = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], { detached: true, stdio: 'ignore' });
const BASE = `http://127.0.0.1:${PORT}/`;
for (let i = 0; i < 60; i++) { if (await fetch(BASE).then((r) => r.ok).catch(() => false)) break; await new Promise((r) => setTimeout(r, 500)); }
const browser = await launch();
const pages = (buf) => (buf.toString('latin1').match(/\/Type\s*\/Page(?![s\w])/g) ?? []).length;
const dl = async (pg, sel) => { const [d] = await Promise.all([pg.waitForEvent('download', { timeout: 60000 }), pg.click(sel)]); const p = `${TMP}/${d.suggestedFilename()}`; await d.saveAs(p); return { name: d.suggestedFilename(), buf: readFileSync(p), path: p }; };
const histCount = async (pg) => { if (await pg.locator('[data-testid=back-btn]').count()) await pg.click('[data-testid=back-btn]'); await pg.click('[data-testid=tab-history]'); await pg.waitForSelector('[data-testid=history]'); return pg.locator('[data-testid=history-item]').count(); };
const restore = async (pg, file) => {
  await pg.click('[data-testid=tab-settings]');
  await pg.setInputFiles('[data-testid=restore-input]', file);
  await pg.waitForSelector('[data-testid=restore-preview], [data-testid=restore-error]', { timeout: 10000 });
};
const newCtx = async () => {
  const ctx = await browser.newContext({ ...MOBILE });
  await ctx.addInitScript(() => { try { sessionStorage.clear(); localStorage.setItem('actioncard.intro.v1', '1'); } catch { /* */ } });
  await ctx.route('https://api.x.ai/**', (r) => r.abort());
  const page = await ctx.newPage(); const errors = []; page.on('pageerror', (e) => errors.push(e.message));
  return { ctx, page, errors };
};
try {
  // A. Device 1: save two cards (digital PDF, no OCR needed), free user
  const A = await newCtx(); const page = A.page;
  await page.goto(BASE);
  for (let i = 0; i < 2; i++) {
    if (await page.locator('[data-testid=back-btn]').count()) await page.click('[data-testid=back-btn]');
    await page.waitForSelector('[data-testid=camera-btn]');
    await page.setInputFiles('[data-testid=file-input]', 'test-docs/pdf/digital_inkasso_2pages.pdf');
    await waitCard(page, { timeout: 120000 });
    await page.click('[data-testid=save-btn]'); await page.waitForSelector('[data-testid=save-btn][disabled]'); await page.waitForTimeout(300);
  }
  check('two cards saved', (await histCount(page)) === 2);

  // B. Gating without Pro: both export entry points open the paywall, which lists the new features + Apple privacy line
  await page.click('[data-testid=bundle-btn]');
  check('saved list: all-cards PDF opens the paywall without Pro', (await page.locator('[data-testid=paywall]').count()) === 1);
  const pw = (await page.textContent('[data-testid=paywall]')) ?? '';
  check('paywall lists backup + all-cards PDF and says Apple handles payment', /Back up and restore/.test(pw) && /one PDF/.test(pw) && /handled by Apple/.test(pw), pw.slice(0, 160));
  await page.click('[data-testid=pro-close]');
  await page.click('[data-testid=tab-settings]');
  await page.click('[data-testid=backup-btn]');
  check('settings: backup opens the paywall without Pro (no file)', (await page.locator('[data-testid=paywall]').count()) === 1);
  await page.click('[data-testid=pro-close]');
  check('restore button is available without Pro', await page.isEnabled('[data-testid=restore-btn]'));

  // C. Unlock Pro with the web mock; store an API key to make sure it never lands in a backup
  await page.evaluate(() => { localStorage.setItem('actioncard.pro.mock', JSON.stringify({ result: 'purchased' })); localStorage.setItem('actioncard.pro.v1', 'owned');
    const k = 'actioncard.settings.v1'; const s = JSON.parse(localStorage.getItem(k) || '{}'); s.xaiKey = 'xai-SECRET-TEST'; s.theme = 'plum'; localStorage.setItem(k, JSON.stringify(s)); });
  await page.reload(); await page.click('[data-testid=tab-settings]');
  const bk = await dl(page, '[data-testid=backup-btn]');
  const j = JSON.parse(bk.buf.toString('utf8'));
  check('backup file name LetterScan-backup-YYYY-MM-DD.json', /^LetterScan-backup-\d{4}-\d{2}-\d{2}\.json$/.test(bk.name), bk.name);
  check('backup is versioned and holds both cards with photos', j.kind === 'letterscan-backup' && j.version === 1 && j.cards.length === 2 && j.cards.every((c) => c.thumbnail && c.card.deadline), `v${j.version} ${j.cards.length} cards`);
  check('API key is not in the backup; settings are', !bk.buf.toString('utf8').includes('xai-SECRET-TEST') && j.settings.theme === 'plum');

  // D. All-cards PDF: cover + each card; selected subset
  const one = (await histCount(page), null);
  const all = await dl(page, '[data-testid=bundle-btn]');
  const nAll = pages(all.buf);
  await page.click('[data-testid=select-toggle]');
  await page.locator('[data-testid=select-card]').first().check();
  const sub = await dl(page, '[data-testid=bundle-btn]');
  const nSub = pages(sub.buf);
  check('bundle PDF named LetterScan-cards-*.pdf with a cover page', /^LetterScan-cards-\d{4}-\d{2}-\d{2}\.pdf$/.test(all.name) && all.buf.toString('latin1').includes('Your saved cards'), all.name);
  check('bundle page count = 1 cover + pages of each card (2 cards vs 1 selected)', nSub >= 2 && nAll === 1 + 2 * (nSub - 1), `all=${nAll} one=${nSub}`);
  check('no page errors (device 1)', A.errors.length === 0, A.errors.join(' | '));
  void one; await A.ctx.close();

  // E. Device 2 (fresh install, NO Pro): restore round-trip, no duplicates, corrupt files
  const B = await newCtx(); const p2 = B.page;
  await p2.goto(BASE); await p2.waitForSelector('[data-testid=camera-btn]');
  await restore(p2, bk.path);
  check('restore without Pro: preview shows 2 cards, 2 new', /2 card\(s\); 2 are new/.test((await p2.textContent('[data-testid=restore-found]')) ?? ''));
  await p2.click('[data-testid=restore-apply]');
  check('restore adds both cards', (await histCount(p2)) === 2);
  check('restored card keeps its data (deadline shown)', /27 Oct/.test((await p2.textContent('[data-testid=history]')) ?? ''));
  await restore(p2, bk.path);
  check('restoring the same file again: 0 new', /2 are new|0 are new/.test((await p2.textContent('[data-testid=restore-found]')) ?? '') && /0 are new/.test((await p2.textContent('[data-testid=restore-found]')) ?? ''));
  await p2.click('[data-testid=restore-apply]');
  check('no duplicates after a second restore', (await histCount(p2)) === 2);
  const merged = { ...j, cards: [...j.cards, { ...j.cards[0], id: j.cards[0].id + '-x' }, { ...j.cards[0], id: j.cards[0].id + '-x' }] };
  writeFileSync(`${TMP}/merge.json`, JSON.stringify(merged));
  await restore(p2, `${TMP}/merge.json`);
  check('merge: 4 cards in file (one duplicated id inside), 1 new', /4 card\(s\); 1 are new/.test((await p2.textContent('[data-testid=restore-found]')) ?? ''), await p2.textContent('[data-testid=restore-found]'));
  await p2.click('[data-testid=restore-apply]');
  check('merge keeps existing cards and adds only the new one', (await histCount(p2)) === 3);
  check('theme was not changed without opting in', (await p2.evaluate(() => document.documentElement.dataset.theme ?? '')) !== 'plum');
  const bad = [
    ['garbage.json', 'this is {not json', /could not be read/],
    ['other.json', JSON.stringify({ hello: 1 }), /not a LetterScan backup/],
    ['newer.json', JSON.stringify({ ...j, version: 99 }), /newer version/],
    ['broken.json', JSON.stringify({ ...j, cards: [{ id: 'x' }] }), /damaged, so nothing was added/],
  ];
  for (const [f, body, re] of bad) {
    writeFileSync(`${TMP}/${f}`, body);
    await restore(p2, `${TMP}/${f}`);
    const e = (await p2.textContent('[data-testid=restore-error]').catch(() => '')) ?? '';
    check(`bad file ${f}: clear error, nothing offered`, re.test(e) && (await p2.locator('[data-testid=restore-preview]').count()) === 0, e);
  }
  check('cards unchanged after bad files', (await histCount(p2)) === 3);
  check('no page errors (device 2)', B.errors.length === 0, B.errors.join(' | '));
  await B.ctx.close();
} finally {
  await browser.close();
  try { process.kill(-srv.pid, 'SIGTERM'); } catch { /* */ }
}
writeFileSync(`test-results/e2e-pro-${ENGINE}.json`, JSON.stringify({ engine: ENGINE, device: deviceName, ranAt: new Date().toString(), results }, null, 2));
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} Pro checks passed (${ENGINE})`);
process.exit(failed.length ? 1 : 0);
