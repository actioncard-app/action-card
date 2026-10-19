// Measures which document languages the WEB OCR engine (Tesseract.js, the traineddata shipped with the app) can read.
// Renders each made-up sample from src/lib/lang-samples.ts as a clean letter image (Chromium, Noto fonts, correct
// Arabic-script shaping), runs Tesseract with that language and scores character accuracy (1 - edit distance / length).
// Usage: node tests/lang-ocr.mjs   -> test-results/lang-ocr-web.json; exits 1 if a language listed as readable fails.
import { mkdirSync, writeFileSync, readFileSync, existsSync } from "node:fs";
import { createWorker, OEM } from 'tesseract.js';
import { launch } from './browser.mjs';

const grab = (file) => { const s = readFileSync(new URL(file, import.meta.url), 'utf8'); return Function(`return (${s.slice(s.indexOf('{', s.indexOf('= ')), s.lastIndexOf('}') + 1)})`)(); };
const SAMPLES = grab('../src/lib/lang-samples.ts');
const WEB_READS = process.env.EXPECT ? process.env.EXPECT.split(',') : null; // languages the app lists as readable on the web
const TESS = { ar: 'ara', uk: 'ukr', tr: 'tur', fa: 'fas', ru: 'rus', pl: 'pol', ro: 'ron', vi: 'vie', zh: 'chi_sim', tl: 'tgl', hi: 'hin', ur: 'urd' };
const RTL = new Set(['ar', 'fa', 'ur']);
const FONT = { zh: '"Noto Sans CJK SC"', hi: '"Noto Sans Devanagari"', ar: '"Noto Naskh Arabic"', fa: '"Noto Naskh Arabic"', ur: '"Noto Naskh Arabic"' };
const norm = (s) => s.normalize('NFC').replace(/[\s\u200c\u200f\u200e]+/g, '').replace(/[：:]/g, ':');
function lev(a, b) { const d = Array.from({ length: a.length + 1 }, (_, i) => [i]); for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)); return d[a.length][b.length]; }
mkdirSync('test-results/lang-ocr', { recursive: true });
const browser = await launch();
const page = await browser.newPage({ viewport: { width: 1100, height: 600 }, deviceScaleFactor: 1 });
const out = {};
let fails = 0;
const VARIANTS = {
  clean: { size: 34, css: 'color:#111', bg: '#fff' },
  // roughly what a phone photo of a printed letter looks like: smaller text, slightly tilted and soft, grey-beige paper
  photo: { size: 24, css: 'color:#333;transform:rotate(1.2deg);filter:blur(0.6px)', bg: '#e9e3d6' },
};
for (const [lang, text] of Object.entries(SAMPLES)) {
  out[lang] = {};
  const dir = existsSync(new URL(`../node_modules/@tesseract.js-data/${TESS[lang]}/4.0.0_best_int`, import.meta.url)) ? '4.0.0_best_int' : '4.0.0';
  const w = await createWorker(TESS[lang], OEM.LSTM_ONLY, { langPath: new URL(`../node_modules/@tesseract.js-data/${TESS[lang]}/${dir}`, import.meta.url).pathname, gzip: true, cacheMethod: 'none' });
  let ok = true;
  const line = [];
  for (const [vname, v] of Object.entries(VARIANTS)) {
    await page.setContent(`<html><body style="margin:0;background:${v.bg}"><div id="d" dir="${RTL.has(lang) ? 'rtl' : 'ltr'}" style="padding:40px;font:${v.size}px/1.6 ${FONT[lang] ?? '"Noto Sans"'}, sans-serif;white-space:pre-line;width:1000px;${v.css}">${text}</div></body></html>`);
    const png = `test-results/lang-ocr/${lang}-${vname}.png`;
    await (await page.$('#d')).screenshot({ path: png });
    const { data } = await w.recognize(png);
    const a = norm(text), b = norm(data.text);
    const acc = Math.max(0, 1 - lev(a, b) / a.length);
    const dateOk = /06\.11\.2026|2026年11月6日/.test(data.text.replace(/\s/g, ''));
    out[lang][vname] = { engine: `tesseract ${TESS[lang]} (${dir})`, accuracy: Math.round(acc * 1000) / 10, dateRead: dateOk, confidence: Math.round(data.confidence), text: data.text.trim() };
    if (!(acc >= 0.85)) ok = false;
    line.push(`${vname} ${out[lang][vname].accuracy}%${dateOk ? '' : ' (date missed)'}`);
  }
  await w.terminate();
  const claimed = WEB_READS ? WEB_READS.includes(lang) : null;
  if (claimed && !ok) fails++;
  console.log(`${ok ? 'PASS' : 'LOW '}  ${lang}  ${line.join('  ')}${claimed === null ? '' : claimed ? '  (listed as readable)' : '  (not listed)'}`);
}
await browser.close();
writeFileSync('test-results/lang-ocr-web.json', JSON.stringify({ ranAt: new Date().toString(), results: out }, null, 2));
if (fails) { console.error(`${fails} language(s) listed as readable scored below 85%`); process.exit(1); }
