// Copies the Tesseract.js worker, WASM core and traineddata into public/tesseract
// so they are served by the app itself (and precached by the service worker),
// never fetched from a CDN at runtime.
import { cpSync, mkdirSync, existsSync, rmSync } from 'node:fs';
import { join } from 'node:path';

const root = new URL('..', import.meta.url).pathname;
const out = join(root, 'public', 'tesseract');
rmSync(out, { recursive: true, force: true });
mkdirSync(join(out, 'core'), { recursive: true });
mkdirSync(join(out, 'lang'), { recursive: true });

const nm = join(root, 'node_modules');
cpSync(join(nm, 'tesseract.js/dist/worker.min.js'), join(out, 'worker.min.js'));
// LSTM-only single-file cores (wasm embedded). simd = modern iOS/Android; plain = old devices.
for (const f of ['tesseract-core-simd-lstm.wasm.js', 'tesseract-core-lstm.wasm.js']) {
  cpSync(join(nm, 'tesseract.js-core', f), join(out, 'core', f));
}
// The six rule languages are precached (vite.config.ts); the twelve extra reading languages are cached on first use
// on the web and bundled inside the iOS app (public/ is copied into it), so the app never downloads them at runtime.
const LANGS = ['eng', 'deu', 'fra', 'spa', 'ita', 'por', 'tur', 'ara', 'pol', 'rus', 'ukr', 'fas', 'ron', 'vie', 'chi_sim', 'tgl', 'hin', 'urd'];
for (const l of LANGS) {
  // tgl has no 4.0.0_best_int build; its 4.0.0 file is the standard LSTM model
  const best = join(nm, `@tesseract.js-data/${l}/4.0.0_best_int/${l}.traineddata.gz`);
  const src = existsSync(best) ? best : join(nm, `@tesseract.js-data/${l}/4.0.0/${l}.traineddata.gz`);
  if (!existsSync(src)) throw new Error('missing ' + src);
  cpSync(src, join(out, 'lang', `${l}.traineddata.gz`));
}
console.log('OCR assets copied to', out);
