/**
 * On-device OCR with Tesseract.js (WebAssembly). Worker, core and traineddata are served by the
 * app itself (public/tesseract) and precached by the service worker, so OCR works offline.
 * Note: Google ML Kit text recognition is native-only (Android/iOS SDKs) and cannot run in a web app.
 */
import { createWorker, OEM, type Worker } from 'tesseract.js';
import { simd } from 'wasm-feature-detect';
import type { Lang } from './types';
import { TESS_CODE } from './types';
import { detectLanguage } from './extract/language';
import { cleanOcr } from './extract/normalize';
import { loadBitmap, preprocessForOcr } from './image';

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

/** Run OCR. With docLanguage 'auto': quick English pass on a smaller image -> detect language -> full pass in that language. */
export async function runOcr(file: Blob, docLanguage: Lang | 'auto', onProgress: (p: OcrProgress) => void): Promise<OcrResult> {
  progressCb = onProgress;
  try {
    onProgress({ stage: 'Preparing image', progress: 0 });
    const bmp = await loadBitmap(file);
    const pre = preprocessForOcr(bmp, 2000);
    let lang: Lang | null = docLanguage === 'auto' ? null : docLanguage;
    if (!lang) {
      stagePrefix = 'Detecting language: ';
      const small = preprocessForOcr(bmp, 1300);
      const first = await recognize(small, 'eng');
      lang = detectLanguage(cleanOcr(first.text)).value ?? 'en';
    }
    stagePrefix = `Reading (${lang.toUpperCase()}): `;
    const res = await recognize(pre, TESS_CODE[lang]);
    if ('close' in bmp) bmp.close();
    return { text: res.text, confidence: res.confidence, language: lang, languageAuto: docLanguage === 'auto', preprocessed: pre };
  } finally {
    progressCb = null;
    stagePrefix = '';
  }
}
