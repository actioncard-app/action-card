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
  // native read aloud (AVSpeechSynthesizer bridge): installed voices for en/de/es, the voice the app picks per gender,
  // and one real utterance with start/end events
  try {
    const { registerPlugin } = await import('@capacitor/core');
    const { pickVoice } = await import('./speech');
    type V = { id: string; name: string; lang: string; quality: number; gender: number; novelty?: boolean; personal?: boolean };
    const NS = registerPlugin<{ voices(): Promise<{ voices: V[] }>; speak(o: Record<string, unknown>): Promise<{ started: boolean; voice?: V }>;
      addListener(ev: string, cb: (d: unknown) => void): Promise<{ remove: () => Promise<void> }> }>('NativeSpeech');
    const all = (await timed(NS.voices(), 15000)).voices;
    const ns: Record<string, unknown> = { count: all.length };
    for (const [l, tag] of [['en', 'en-GB'], ['de', 'de-DE'], ['es', 'es-ES']] as const) {
      ns[l] = {
        voices: all.filter((v) => v.lang.toLowerCase().startsWith(l)).map((v) => ({ name: v.name, lang: v.lang, quality: v.quality, gender: v.gender, novelty: v.novelty, id: v.id })),
        pick: Object.fromEntries((['auto', 'female', 'male'] as const).map((g) => { const p = pickVoice(all, tag, g); return [g, p.voice ? `${p.voice.name} (${p.voice.lang}, q${p.voice.quality}, g${p.voice.gender})${p.genderMatched ? '' : ' [gender fallback]'}` : null]; })),
      };
    }
    const de = pickVoice(all, 'de-DE', 'auto').voice;
    ns.speak = await new Promise((ok) => {
      let started = false;
      NS.addListener('speechStart', () => { started = true; });
      NS.addListener('speechEnd', (d) => ok({ started, end: d }));
      NS.speak({ text: 'Bitte zahlen Sie bis zum sechsten November.', voiceId: de?.id, lang: 'de-DE' }).then((r) => { ns.speakReturn = r; }).catch((e) => ok({ error: String(e?.message ?? e) }));
      setTimeout(() => ok({ started, end: 'no end within 15 s' }), 15000);
    });
    out.nativeSpeech = ns;
  } catch (e) { out.nativeSpeech = { error: String((e as Error)?.message ?? e) }; }
  await save();
  // natural offline voice: English (bundled Kokoro) female + male, cold and warm; German pack download + speak
  try {
    const nt = await import('./tts/neural');
    const { phonemizeEn } = await import('./tts/en-g2p');
    const N = nt.NeuralSpeech;
    const nd: Record<string, unknown> = { status: await timed(N.status(), 10000) };
    const LETTER = 'Dear Mr. Ferguson, your parking fine of €45.50 is due by 30.11.2026. Please pay using the reference AB12-345 shown below. If you have already paid, you can ignore this letter.';
    const run = (o: Parameters<typeof N.speak>[0]) => new Promise<Record<string, unknown>>((ok) => {
      const r: Record<string, unknown> = {}; const subs: Promise<{ remove: () => Promise<void> }>[] = [];
      const done = (x: Record<string, unknown>) => { subs.forEach((p) => p.then((s) => s.remove())); ok(x); };
      subs.push(N.addListener('neuralStart', (d) => Object.assign(r, { start: d })));
      const prog: unknown[] = []; r.progress = prog;
      subs.push(N.addListener('neuralProgress', (d) => prog.push(d)));
      subs.push(N.addListener('neuralEnd', (d) => done(Object.assign(r, { end: d }))));
      subs.push(N.addListener('neuralError', (d) => done(Object.assign(r, { error: d }))));
      N.speak(o).catch((e) => done({ error: String(e?.message ?? e) }));
      setTimeout(() => { N.status().then((st) => done(Object.assign(r, { end: 'timeout 120 s', state: st.state }))).catch(() => done(Object.assign(r, { end: 'timeout 120 s' }))); }, 120000);
    });
    const t0 = performance.now();
    const ph = await phonemizeEn(LETTER, async (words) => (await N.lookup({ words })).found);
    nd.g2pMs = Math.round(performance.now() - t0); nd.ipa = ph.ipa; nd.sentences = ph.sentences;
    nd.footprintBeforeMB = (await N.status()).footprintMB;
    nd.enFemaleCold = await run({ lang: 'en', ipa: ph.ipa, sid: 0 });
    nd.enFemaleWarm = await run({ lang: 'en', ipa: ph.ipa, sid: 0 });
    nd.enMaleWarm = await run({ lang: 'en', ipa: ph.ipa, sid: 1 });
    await save();
    out.neural = nd;
    const deT = performance.now();
    try { await timed(nt.downloadPack('de-DE'), 600000); nd.deDownloadMs = Math.round(performance.now() - deT); } catch (e) { nd.deDownload = String((e as Error)?.message ?? e); }
    nd.statusAfter = await N.status();
    const deText = 'Sehr geehrter Herr Ferguson, Ihr Bußgeld von 45,50 € ist bis zum 30.11.2026 fällig. Bitte zahlen Sie mit dem Verwendungszweck AB12-345. Wenn Sie bereits bezahlt haben, ignorieren Sie dieses Schreiben.';
    nd.deNormalized = (await N.normalize({ text: deText, lang: 'de' })).text;
    nd.esNormalized = (await N.normalize({ text: 'Su multa de 45,50 € vence el 30/11/2026 a las 14:30.', lang: 'es' })).text;
    nd.deCold = await run({ lang: 'de', sentences: nt.splitPlain(deText), sid: 0 });
    nd.deWarm = await run({ lang: 'de', sentences: nt.splitPlain(deText), sid: 0 });
    // a wrong checksum must be refused and leave nothing installed
    try { await N.download({ lang: 'fr', files: nt.PACK_INFO.fr.files.map((f) => ({ name: f.name, url: nt.RELEASE_BASE + f.asset, sha256: '0'.repeat(64), bytes: f.bytes })).slice(1) }); nd.badShaRefused = false; }
    catch (e) { nd.badShaRefused = String((e as Error)?.message ?? e); }
    nd.frInstalledAfterBadSha = (await N.status()).packs?.fr?.installed;
    nd.footprintEndMB = (await N.status()).footprintMB;
    out.neural = nd;
  } catch (e) { out.neural = { error: String((e as Error)?.message ?? e) }; }
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
  // picker path: files the workflow put next to shot.json (HEIC made with sips, a large JPEG, a PNG screenshot) go
  // through normalizeImage and the normal file input, as a picked photo would
  const { normalizeImage } = await import('./image');
  const picks: Record<string, unknown> = {};
  for (const [name, type] of [['pick-test.heic', 'image/heic'], ['pick-test.jpg', 'image/jpeg'], ['pick-test.png', 'image/png']] as const) {
    try {
      const r = await fetch(name); if (!r.ok) { picks[name] = { error: 'missing' }; continue; }
      const f = new File([await r.blob()], name, { type });
      const n = await normalizeImage(f);
      const res: Record<string, unknown> = { inType: f.type, inSize: f.size, outType: n.type, outSize: n.size };
      if (document.querySelector('[data-testid=back-btn]')) await click('[data-testid=back-btn]');
      await click('[data-testid=tab-scan]');
      const input = (await waitFor('[data-testid=file-input]')) as HTMLInputElement;
      const dt = new DataTransfer(); dt.items.add(f); input.files = dt.files;
      input.dispatchEvent(new Event('change', { bubbles: true }));
      const el = await timed(waitFor('[data-testid=action-card], [data-testid=photo-warning], .alert.error'), 120000);
      if (el.dataset.testid === 'photo-warning') { await click('[data-testid=photo-use]'); await timed(waitFor('[data-testid=action-card]'), 120000); }
      const card = document.querySelector('[data-testid=action-card]');
      res.amount = card ? document.querySelector('[data-field=amount]')?.getAttribute('data-value') ?? null : null;
      if (!card) res.error = el.textContent;
      picks[name] = res;
    } catch (e) { picks[name] = { error: String((e as Error)?.message ?? e) }; }
    await save();
  }
  out.picker = picks;
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
