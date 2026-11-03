// Apple Vision text recognition (iOS app only). Native side: ios/App/App/VisionOCRPlugin.swift (VNRecognizeTextRequest,
// accurate level). Returns text lines with bounding boxes (normalised 0..1, origin top-left) and confidence 0..1.
// NOT VERIFIED ON A DEVICE: written and type-checked on Linux without Xcode. ocr.ts falls back to Tesseract whenever
// this is unavailable, throws, or returns too little text, so the web/PWA and a broken native build keep working.
import { registerPlugin } from '@capacitor/core';
import type { ReadLang } from './types';

export interface VisionLine { text: string; confidence: number; x: number; y: number; w: number; h: number }
export interface VisionResult { lines: VisionLine[]; width: number; height: number; languages: string[]; revision?: number }
export interface VisionPlugin {
  recognize(o: { image: string; languages: string[]; languageCorrection?: boolean }): Promise<VisionResult>;
  supportedLanguages(): Promise<{ languages: string[] }>;
}
export const VisionOCR = registerPlugin<VisionPlugin>('VisionOCR');

/** Vision language codes for our document languages. Vision silently lacks some (checked at runtime natively). */
export const VISION_CODE: Record<ReadLang, string> = {
  en: 'en-US', de: 'de-DE', fr: 'fr-FR', es: 'es-ES', it: 'it-IT', pt: 'pt-BR', tr: 'tr-TR', pl: 'pl-PL', ru: 'ru-RU', uk: 'uk-UA', ar: 'ar-SA',
  fa: 'fa-IR', ro: 'ro-RO', vi: 'vi-VT', zh: 'zh-Hans', tl: 'fil-PH', hi: 'hi-IN', ur: 'ur-PK',
};
export const ALL_VISION_LANGS = Object.values(VISION_CODE);

let supported: Promise<string[]> | null = null;
/** Vision's own list of recognition languages on this device (asked once). */
export const visionSupported = (plugin: VisionPlugin = VisionOCR) =>
  (supported ??= plugin.supportedLanguages().then((r) => r.languages ?? []).catch(() => []));
/** Does Apple Vision read this language on this device? Matches the base language too (e.g. "vi" against "vi-VT"). */
export async function visionReads(l: ReadLang, plugin: VisionPlugin = VisionOCR): Promise<boolean> {
  const list = await visionSupported(plugin);
  const code = VISION_CODE[l], base = code.split('-')[0];
  return list.includes(code) || list.some((x) => x.split('-')[0] === base);
}
/** Map our code to the exact identifier this device's Vision uses. */
async function visionId(l: ReadLang, plugin: VisionPlugin): Promise<string> {
  const list = await visionSupported(plugin);
  const code = VISION_CODE[l], base = code.split('-')[0];
  return list.includes(code) ? code : list.find((x) => x.split('-')[0] === base) ?? code;
}

/** Order lines like a reader: top to bottom; boxes whose vertical centres are on the same row are joined left to right. */
export function linesToText(lines: VisionLine[]): string {
  const sorted = [...lines].filter((l) => l.text.trim()).sort((a, b) => a.y + a.h / 2 - (b.y + b.h / 2));
  const rows: VisionLine[][] = [];
  for (const l of sorted) {
    const row = rows[rows.length - 1];
    const c = l.y + l.h / 2;
    if (row && Math.abs(c - (row[0].y + row[0].h / 2)) < Math.min(row[0].h, l.h) * 0.5) row.push(l); else rows.push([l]);
  }
  return rows.map((r) => r.sort((a, b) => a.x - b.x).map((l) => l.text.trim()).join('   ')).join('\n');
}
/** Mean line confidence weighted by text length, as a 0..100 number like Tesseract's. */
export function meanConfidence(lines: VisionLine[]): number {
  let n = 0, s = 0;
  for (const l of lines) { const k = Math.max(1, l.text.length); n += k; s += l.confidence * k; }
  return n ? Math.round((s / n) * 1000) / 10 : 0;
}

const toBase64 = (b: Blob) => new Promise<string>((ok, bad) => { const r = new FileReader(); r.onload = () => ok(String(r.result).split(',')[1] ?? ''); r.onerror = () => bad(r.error); r.readAsDataURL(b); });

/** Recognise text with Apple Vision. docLanguage first (Vision prioritises the order), then the rest. */
export async function visionOcr(file: Blob, docLanguage: ReadLang | 'auto', plugin: VisionPlugin = VisionOCR): Promise<{ text: string; confidence: number; lines: VisionLine[] }> {
  // chosen language: that one plus English (numbers, names, IBANs); auto: every language and Vision picks
  const languages = docLanguage === 'auto' ? ALL_VISION_LANGS : [...new Set([await visionId(docLanguage, plugin), 'en-US'])];
  const res = await plugin.recognize({ image: await toBase64(file), languages, languageCorrection: true });
  const lines = res?.lines ?? [];
  return { text: linesToText(lines), confidence: meanConfidence(lines), lines };
}
