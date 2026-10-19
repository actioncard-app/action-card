// App Store screenshot driver. Only compiled into builds made with VITE_SHOTS=1 (the CI screenshot workflow,
// .github/workflows/ios-screenshots.yml); release builds never contain it. It drives the normal UI the way a person
// would: puts a fake sample letter (src/lib/shots-letters.ts, drawn on a canvas) into the regular file input, so the card is produced by the real
// on-device pipeline (Vision OCR + rules). The scene comes from shot.json, which the workflow writes into the
// simulator's copy of the app before each launch.
interface Shot { scene: 'card' | 'saved' | 'home'; docs?: string[]; scroll?: string }

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
async function waitFor(sel: string, ms = 180000): Promise<HTMLElement> {
  const end = Date.now() + ms;
  for (;;) {
    const el = document.querySelector<HTMLElement>(sel);
    if (el) return el;
    if (Date.now() > end) throw new Error('shots: timeout waiting for ' + sel);
    await sleep(200);
  }
}
const click = async (sel: string) => (await waitFor(sel)).click();

import { letterFile } from './shots-letters';

async function scan(doc: string) {
  if (document.querySelector('[data-testid=back-btn]')) await click('[data-testid=back-btn]');
  await click('[data-testid=tab-scan]');
  const input = (await waitFor('[data-testid=file-input]')) as HTMLInputElement;
  const dt = new DataTransfer();
  dt.items.add(await letterFile(doc));
  input.files = dt.files;
  input.dispatchEvent(new Event('change', { bubbles: true }));
  await waitFor('[data-testid=action-card]');
  await sleep(800);
}

export async function runShot() {
  const cfg: Shot | null = await fetch('shot.json', { cache: 'no-store' }).then((r) => (r.ok ? r.json() : null)).catch(() => null);
  if (!cfg) return;
  await waitFor('[data-testid=tab-scan]');
  await sleep(500);
  if (cfg.scene === 'card' && cfg.docs?.[0]) {
    await scan(cfg.docs[0]);
    if (cfg.scroll) document.querySelector(cfg.scroll)?.scrollIntoView({ block: 'start' });
  } else if (cfg.scene === 'saved') {
    for (const d of cfg.docs ?? []) { await scan(d); await click('[data-testid=save-btn]'); await sleep(600); }
    if (document.querySelector('[data-testid=back-btn]')) await click('[data-testid=back-btn]');
    await click('[data-testid=tab-history]');
  } else {
    if (document.querySelector('[data-testid=back-btn]')) await click('[data-testid=back-btn]');
    await click('[data-testid=tab-scan]');
  }
  window.scrollTo?.(window.scrollX, window.scrollY);
  document.documentElement.dataset.shotReady = '1';
}
