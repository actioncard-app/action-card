// Detects the twelve extra reading languages (no wording rules) from script and distinctive letters/words.
// Used after OCR in "auto" mode when the six-language detector finds nothing convincing.
import type { ExtraLang } from '../types';

const count = (t: string, re: RegExp) => t.match(re)?.length ?? 0;
const words = (t: string) => new Set((t.toLowerCase().match(/\p{L}+/gu) ?? []));
const STOP: Partial<Record<ExtraLang, string[]>> = {
  tr: ['ve', 'bir', 'bu', 'için', 'ile', 'olarak', 'tarihine', 'kadar', 'lütfen', 'sayın', 'numarası', 'tutar'],
  pl: ['i', 'w', 'na', 'do', 'się', 'jest', 'że', 'nie', 'prosimy', 'kwota', 'numer', 'dnia', 'oraz', 'pan', 'pani'],
  ro: ['și', 'în', 'la', 'de', 'pentru', 'vă', 'este', 'până', 'suma', 'număr', 'rugăm', 'dumneavoastră'],
  vi: ['và', 'của', 'các', 'được', 'cho', 'là', 'không', 'trước', 'ngày', 'số', 'tiền', 'vui', 'lòng'],
  tl: ['ang', 'ng', 'mga', 'sa', 'na', 'at', 'ay', 'po', 'mangyaring', 'bago', 'halaga', 'numero', 'inyong'],
};

/** Like detectExtraLanguage, but only when the evidence is unambiguous (own script, or several letters no rule
 * language uses, e.g. Turkish ı ş ğ or Polish ł ą ę). Checked BEFORE the six-language detector, which would otherwise
 * read Turkish ö/ü as German or Polish "o"/"do" as Portuguese. */
export function detectExtraStrong(text: string): ExtraLang | null {
  const letters = count(text, /\p{L}/gu);
  if (letters < 8) return null;
  const nonLatin = count(text, /[\u0400-\u04FF\u0600-\u06FF\u0750-\u077F\uFB50-\uFDFF\uFE70-\uFEFF\u4E00-\u9FFF\u0900-\u097F]/g);
  if (nonLatin > letters * 0.3) return detectExtraLanguage(text);
  const own = Math.max(count(text, /[ğışİ]/g), count(text, /[łąęśźżńŁĄĘŚŹŻŃ]/g), count(text, /[șțȘȚăĂ]/g), count(text, /[ơưđƠƯĐạảấầẩẫậắằẳẵặẹẻẽếềểễệỉịọỏốồổỗộớờởỡợụủứừửữựỳỵỷỹ]/g));
  return own >= 2 ? detectExtraLanguage(text) : null;
}

export function detectExtraLanguage(text: string): ExtraLang | null {
  const letters = count(text, /\p{L}/gu);
  if (letters < 8) return null;
  const arabic = count(text, /[\u0600-\u06FF\u0750-\u077F\uFB50-\uFDFF\uFE70-\uFEFF]/g);
  if (arabic > letters * 0.3) {
    const urdu = count(text, /[ےۓٹڈڑںھۂ]/g);
    const persian = count(text, /[پچژگکی]/g);
    if (urdu >= 2) return 'ur';
    if (persian >= 2) return 'fa';
    return 'ar';
  }
  const cyr = count(text, /[\u0400-\u04FF]/g);
  if (cyr > letters * 0.3) return count(text, /[іїєґІЇЄҐ]/g) >= 1 ? 'uk' : 'ru';
  if (count(text, /[\u4E00-\u9FFF]/g) > letters * 0.3) return 'zh';
  if (count(text, /[\u0900-\u097F]/g) > letters * 0.3) return 'hi';
  // Latin-script extras: distinctive letters first, then function words
  const score: Partial<Record<ExtraLang, number>> = {
    tr: count(text, /[ğışİ]/g) * 2,
    pl: count(text, /[łąęśźżńŁĄĘŚŹŻŃ]/g) * 2,
    ro: count(text, /[șțȘȚăĂ]/g) * 2,
    vi: count(text, /[ơưđƠƯĐạảấầẩẫậắằẳẵặẹẻẽếềểễệỉịọỏốồổỗộớờởỡợụủứừửữựỳỵỷỹ]/g) * 2,
    tl: 0,
  };
  const w = words(text);
  for (const [l, list] of Object.entries(STOP) as [ExtraLang, string[]][]) for (const s of list) if (w.has(s)) score[l] = (score[l] ?? 0) + 1;
  const best = (Object.entries(score) as [ExtraLang, number][]).sort((a, b) => b[1] - a[1])[0];
  return best && best[1] >= 4 ? best[0] : null;
}
