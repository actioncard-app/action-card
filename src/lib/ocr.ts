/**
 * On-device OCR with Tesseract.js (WebAssembly). Worker, core and traineddata are served by the
 * app itself (public/tesseract) and precached by the service worker, so OCR works offline.
 * Note: Google ML Kit text recognition is native-only (Android/iOS SDKs) and cannot run in a web app.
 */
import { createWorker, OEM, type Worker } from 'tesseract.js';
import { simd } from 'wasm-feature-detect';
import type { Lang } from './types';
import { TESS_CODE } from './types';
import { detectLanguage, knownWordCount } from './extract/language';
import { cleanOcr } from './extract/normalize';
import { loadBitmap, preprocessForOcr, drawScaled, turnCanvas } from './image';

export interface OcrProgress { stage: string; progress: number }
export interface OcrResult { text: string; confidence: number; language: Lang | null; languageAuto: boolean; preprocessed: HTMLCanvasElement }

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

/**
 * Run OCR. With docLanguage 'auto': quick English pass on a smaller copy -> detect language -> full pass in that
 * language. If the full pass then reads clearly as another language (the quick pass can misjudge a hard photo),
 * one more pass runs in that language and the better-scoring result is kept.
 */
export async function runOcr(file: Blob, docLanguage: Lang | 'auto', onProgress: (p: OcrProgress) => void): Promise<OcrResult> {
  progressCb = onProgress;
  try {
    onProgress({ stage: 'Preparing image', progress: 0 });
    const bmp = await loadBitmap(file);
    let pre = preprocessForOcr(bmp, 2000);
    if ('close' in bmp) bmp.close();
    let lang: Lang | null = docLanguage === 'auto' ? null : docLanguage;
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
      lang = detectLanguage(cleanOcr(first.text)).value ?? 'en';
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
      if (again.value && again.value !== lang && again.confidence !== 'low') {
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
