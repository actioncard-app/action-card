// App Store screenshot driver. Only compiled into builds made with VITE_SHOTS=1 (the CI screenshot workflow,
// .github/workflows/ios-screenshots.yml); release builds never contain it. It drives the normal UI the way a person
// would: puts a fake sample letter (src/lib/shots-letters.ts, drawn on a canvas) into the regular file input, so the card is produced by the real
// on-device pipeline (Vision OCR + rules). The scene comes from shot.json, which the workflow writes into the
// simulator's copy of the app before each launch.
interface Shot { scene: 'card' | 'saved' | 'home' | 'diag'; docs?: string[]; scroll?: string }

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

const RTL = ['ar', 'fa', 'ur'];
/** A sample text drawn as a clean page, or as a smaller, slightly tilted "photo" on grey paper. */
async function sampleImage(lang: string, text: string, photo: boolean): Promise<Blob> {
  const lines = text.split('\n'), size = photo ? 24 : 34;
  const c = document.createElement('canvas');
  c.width = 1100; c.height = 80 + lines.length * size * 1.7;
  const g = c.getContext('2d')!;
  g.fillStyle = photo ? '#e9e3d6' : '#fff'; g.fillRect(0, 0, c.width, c.height);
  if (photo) { g.translate(c.width / 2, c.height / 2); g.rotate((1.2 * Math.PI) / 180); g.translate(-c.width / 2, -c.height / 2); }
  g.fillStyle = photo ? '#333' : '#111';
  g.font = `${size}px -apple-system, "PingFang SC", "Geeza Pro", "Noto Nastaliq Urdu", "Kohinoor Devanagari", sans-serif`;
  const rtl = RTL.includes(lang);
  g.direction = rtl ? 'rtl' : 'ltr'; g.textAlign = rtl ? 'right' : 'left';
  lines.forEach((l, i) => g.fillText(l, rtl ? c.width - 40 : 40, 40 + size + i * size * 1.7));
  return new Promise((ok) => c.toBlob((b) => ok(b!), 'image/png'));
}
const b64 = (b: Blob) => new Promise<string>((ok) => { const r = new FileReader(); r.onload = () => ok(String(r.result).split(',')[1]); r.readAsDataURL(b); });
const timed = <T,>(p: Promise<T>, ms: number) => Promise.race([p, new Promise<never>((_, bad) => setTimeout(() => bad(new Error('timeout')), ms))]);

/** Measures what this device can really do: Apple Vision languages and accuracy per language, the app's own OCR
 * path (Vision, or the bundled Tesseract fallback), auto-detection, and speech synthesis voices. Writes Documents/diag.json. */
async function diag() {
  const { VisionOCR, VISION_CODE } = await import('./vision');
  const { LANG_SAMPLES, charAccuracy } = await import('./lang-samples');
  const { runOcr } = await import('./ocr');
  const { Filesystem, Directory, Encoding } = await import('@capacitor/filesystem');
  const out: Record<string, unknown> = { at: new Date().toString(), ua: navigator.userAgent };
  const save = () => Filesystem.writeFile({ path: 'diag.json', data: JSON.stringify(out, null, 1), directory: Directory.Documents, encoding: Encoding.UTF8 });
  try { out.visionLanguages = (await VisionOCR.supportedLanguages()).languages; } catch (e) { out.visionLanguages = 'error: ' + (e as Error).message; }
  // speech synthesis (Read aloud)
  const sp: Record<string, unknown> = { available: 'speechSynthesis' in window };
  if (sp.available) {
    let voices = speechSynthesis.getVoices();
    if (!voices.length) await new Promise((ok) => { speechSynthesis.onvoiceschanged = ok; setTimeout(ok, 4000); });
    voices = speechSynthesis.getVoices();
    sp.voiceLangs = [...new Set(voices.map((v) => v.lang))].sort();
    sp.speak = await new Promise((ok) => {
      const u = new SpeechSynthesisUtterance('Bitte zahlen Sie bis zum sechsten November.'); u.lang = 'de-DE';
      let started = false;
      u.onstart = () => { started = true; }; u.onend = () => ok(started ? 'spoke' : 'ended without start'); u.onerror = (e) => ok('error: ' + e.error);
      speechSynthesis.speak(u); setTimeout(() => ok(started ? 'started (no end within 10 s)' : 'no start within 10 s'), 10000);
    });
  }
  out.speech = sp;
  await save();
  const ocr: Record<string, unknown> = {};
  out.ocr = ocr;
  for (const [l, text] of Object.entries(LANG_SAMPLES)) {
    const r: Record<string, unknown> = {};
    for (const photo of [false, true]) {
      const key = photo ? 'photo' : 'clean';
      const blob = await sampleImage(l, text, photo);
      try {
        const v = await timed(VisionOCR.recognize({ image: await b64(blob), languages: [VISION_CODE[l as keyof typeof VISION_CODE]], languageCorrection: true }), 60000);
        const t = v.lines.map((x) => x.text).join('\n');
        r[`vision_${key}`] = { accuracy: charAccuracy(text, t), languagesUsed: v.languages, text: t };
      } catch (e) { r[`vision_${key}`] = { error: (e as Error).message }; }
      try {
        const o = await timed(runOcr(blob, l as never, () => {}), 180000);
        r[`app_${key}`] = { engine: o.engine ?? 'tesseract', accuracy: charAccuracy(text, o.text), text: o.text };
      } catch (e) { r[`app_${key}`] = { error: (e as Error).message }; }
    }
    try {
      const o = await timed(runOcr(await sampleImage(l, text, false), 'auto', () => {}), 180000);
      r.auto = { engine: o.engine ?? 'tesseract', detected: o.language, accuracy: charAccuracy(text, o.text) };
    } catch (e) { r.auto = { error: (e as Error).message }; }
    ocr[l] = r;
    await save();
  }
  out.done = true;
  await save();
  console.log('DIAG-DONE');
}

export async function runShot() {
  const cfg: Shot | null = await fetch('shot.json', { cache: 'no-store' }).then((r) => (r.ok ? r.json() : null)).catch(() => null);
  if (!cfg) return;
  if (cfg.scene === 'diag') { await diag().catch((e) => console.log('DIAG-ERROR ' + (e as Error).message)); return; }
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
