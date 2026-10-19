/**
 * On-device OCR with Tesseract.js (WebAssembly). Worker, core and traineddata are served by the
 * app itself (public/tesseract) and precached by the service worker, so OCR works offline.
 * Note: Google ML Kit text recognition is native-only (Android/iOS SDKs) and cannot run in a web app.
 */
import { createWorker, OEM, type Worker } from 'tesseract.js';
import { simd } from 'wasm-feature-detect';
import type { ReadLang } from './types';
import { TESS_CODE, isRuleLang } from './types';
import { detectLanguage, knownWordCount } from './extract/language';
import { detectExtraLanguage } from './extract/script';
import { cleanOcr } from './extract/normalize';
import { loadBitmap, preprocessForOcr, drawScaled, turnCanvas } from './image';
import { isNative } from './native';

export interface OcrProgress { stage: string; progress: number }
export interface OcrResult { text: string; confidence: number; language: ReadLang | null; languageAuto: boolean; preprocessed: HTMLCanvasElement; engine?: 'vision' | 'tesseract' }

let worker: Worker | null = null;
let loaded = '';
let progressCb: ((p: OcrProgress) => void) | null = null;
let stagePrefix = '';

const abs = (p: string) => new URL(import.meta.env.BASE_URL + p, location.href).href;

const STATUS: Record<string, string> = {
  'loading tesseract core': 'Loading OCR engine',
  'initializing tesseract': 'Starting OCR engine',
  'initialized tesseract': 'Starting OCR engine',
  'loading language traineddata': 'Loading language data',
  'loaded language traineddata': 'Loading language data',
  'initializing api': 'Preparing',
  'initialized api': 'Preparing',
  'recognizing text': 'Reading text',
};

async function getWorker(langs: string): Promise<Worker> {
  if (!worker) {
    const hasSimd = await simd().catch(() => false);
    worker = await createWorker(langs, OEM.LSTM_ONLY, {
      workerPath: abs('tesseract/worker.min.js'),
      corePath: abs(`tesseract/core/${hasSimd ? 'tesseract-core-simd-lstm.wasm.js' : 'tesseract-core-lstm.wasm.js'}`),
      langPath: abs('tesseract/lang'),
      gzip: true,
      cacheMethod: 'none', // the service worker already caches the files; avoid a second copy in IndexedDB
      workerBlobURL: false,
      logger: (m: { status: string; progress: number }) => {
        progressCb?.({ stage: stagePrefix + (STATUS[m.status] ?? m.status), progress: m.progress ?? 0 });
      },
    });
    loaded = langs;
  } else if (loaded !== langs) {
    await worker.reinitialize(langs, OEM.LSTM_ONLY);
    loaded = langs;
  }
  return worker;
}

async function recognize(canvas: HTMLCanvasElement, langs: string) {
  const w = await getWorker(langs);
  const { data } = await w.recognize(canvas);
  return { text: data.text ?? '', confidence: data.confidence ?? 0 };
}

/** Six rule languages first; if none is convincing, the extra reading languages (script, letters, function words). */
export function guessLanguage(text: string): ReadLang | null {
  const d = detectLanguage(text);
  if (d.value && d.confidence !== 'low') return d.value;
  return detectExtraLanguage(text) ?? d.value;
}

/**
 * Run OCR. With docLanguage 'auto': quick English pass on a smaller copy -> detect language -> full pass in that
 * language. If the full pass then reads clearly as another language (the quick pass can misjudge a hard photo),
 * one more pass runs in that language and the better-scoring result is kept.
 */
export async function runOcr(file: Blob, docLanguage: ReadLang | 'auto', onProgress: (p: OcrProgress) => void): Promise<OcrResult> {
  progressCb = onProgress;
  try {
    onProgress({ stage: 'Preparing image', progress: 0 });
    const bmp = await loadBitmap(file);
    let pre = preprocessForOcr(bmp, 2000);
    if ('close' in bmp) bmp.close();
    // iOS app: Apple Vision first (faster, better on photos); Tesseract below stays the fallback and the web engine
    if (isNative()) {
      try {
        onProgress({ stage: 'Reading (Apple Vision)', progress: 0.3 });
        const { visionOcr } = await import('./vision');
        const { visionReads } = await import('./vision');
        if (docLanguage !== 'auto' && !(await visionReads(docLanguage))) throw new Error(`Apple Vision cannot read ${docLanguage}`);
        const v = await visionOcr(file, docLanguage);
        if ((cleanOcr(v.text).match(/\p{L}{2,}/gu) ?? []).length >= 3) {
          const vl = docLanguage === 'auto' ? guessLanguage(cleanOcr(v.text)) : docLanguage;
          console.info(`[ocr] Apple Vision, ${v.lines.length} lines, language ${vl}`);
          return { text: v.text, confidence: v.confidence, language: vl, languageAuto: docLanguage === 'auto', preprocessed: pre, engine: 'vision' };
        }
        console.info('[ocr] Apple Vision returned too little text; falling back to Tesseract');
      } catch (e) {
        console.info('[ocr] Apple Vision unavailable, falling back to Tesseract:', (e as Error)?.message);
      }
    }
    let lang: ReadLang | null = docLanguage === 'auto' ? null : docLanguage;
    let passes = 0;
    const words = (t: string) => (cleanOcr(t).match(/\p{L}{2,}/gu) ?? []).length;
    // Upside-down (or turned the wrong way) text reads as junk: few real words and low confidence.
    const looksWrong = (r: { text: string; confidence: number }) =>
      r.confidence < 60 || knownWordCount(cleanOcr(r.text)) < Math.max(3, words(r.text) * 0.15);
    /** Try the page turned 180 degrees on a small copy; true (and `pre` turned) if that reads clearly better. */
    const tryFlip = async (smallRes: { text: string; confidence: number }, small: HTMLCanvasElement, code: string) => {
      stagePrefix = 'Checking orientation: ';
      const alt = await recognize(turnCanvas(small, 180), code);
      passes++;
      const known = knownWordCount(cleanOcr(smallRes.text)), knownAlt = knownWordCount(cleanOcr(alt.text));
      if (knownAlt > Math.max(2, known * 1.5) && alt.confidence > smallRes.confidence) { pre = turnCanvas(pre, 180); return alt; }
      return null;
    };
    let res: { text: string; confidence: number };
    if (!lang) {
      // auto: quick English pass on a smaller copy -> orientation check -> language -> full pass
      stagePrefix = 'Detecting language: ';
      const small = drawScaled(pre, 1300);
      let first = await recognize(small, 'eng');
      passes++;
      if (looksWrong(first)) first = (await tryFlip(first, small, 'eng')) ?? first;
      // (non-Latin letters read as junk in this English pass: those need the language chosen by hand on the web)
      lang = guessLanguage(cleanOcr(first.text)) ?? 'en';
      stagePrefix = `Reading (${lang.toUpperCase()}): `;
      res = await recognize(pre, TESS_CODE[lang]);
      passes++;
    } else {
      // language chosen by the user: full pass; only if it reads as junk, check the orientation and re-read
      stagePrefix = `Reading (${lang.toUpperCase()}): `;
      res = await recognize(pre, TESS_CODE[lang]);
      passes++;
      if (looksWrong(res)) {
        const small = drawScaled(pre, 1300);
        const quick = await recognize(small, TESS_CODE[lang]);
        passes++;
        if (await tryFlip(quick, small, TESS_CODE[lang])) {
          stagePrefix = `Reading (${lang.toUpperCase()}): `;
          res = await recognize(pre, TESS_CODE[lang]);
          passes++;
        }
      }
    }
    if (docLanguage === 'auto') {
      const again = detectLanguage(cleanOcr(res.text));
      if (again.value && again.value !== lang && again.confidence !== 'low' && isRuleLang(lang)) {
        stagePrefix = `Reading (${again.value.toUpperCase()}): `;
        const res2 = await recognize(pre, TESS_CODE[again.value]);
        passes++;
        const check = detectLanguage(cleanOcr(res2.text));
        if (check.value === again.value && res2.confidence >= res.confidence - 5) { res = res2; lang = again.value; }
      }
    }
    console.info(`[ocr] ${passes} pass(es), language ${lang}, preprocessing ${JSON.stringify(pre.ocrInfo)}`);
    return { text: res.text, confidence: res.confidence, language: lang, languageAuto: docLanguage === 'auto', preprocessed: pre };
  } finally {
    progressCb = null;
    stagePrefix = '';
  }
}
