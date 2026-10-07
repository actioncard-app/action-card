import type { Lang, Field } from '../types';
import { fold } from './normalize';

// Function words that are frequent in each language. Words shared by several languages
// count for each of them; distinctive ones carry the signal.
const STOP: Record<Lang, string[]> = {
  en: ['thank', 'thanks', 'dear', 'regards', 'the', 'and', 'you', 'your', 'to', 'of', 'for', 'is', 'has', 'have', 'been', 'by', 'with', 'please', 'will', 'this', 'are', 'we', 'our', 'may', 'can', 'or', 'from', 'be', 'that', 'not', 'due', 'which'],
  de: ['danke', 'vielen', 'herren', 'damen', 'freundlichen', 'der', 'die', 'das', 'und', 'sie', 'ihr', 'ihre', 'ihnen', 'bis', 'zum', 'zur', 'mit', 'nicht', 'wird', 'ist', 'den', 'dem', 'des', 'von', 'bitte', 'fur', 'auf', 'ein', 'eine', 'einer', 'nach', 'oder', 'werden', 'kann', 'uhr', 'am', 'im', 'gegen', 'diesen', 'innerhalb'],
  fr: ['merci', 'madame', 'monsieur', 'cordialement', 'le', 'la', 'les', 'des', 'et', 'du', 'vous', 'votre', 'vos', 'est', 'pour', 'une', 'avant', 'par', 'sur', 'pas', 'dans', 'au', 'aux', 'ne', 'sera', 'devez', 'qui', 'que', 'ou', 'plus', 'cette', 'sans', 'leur', 'apres', 'si'],
  es: ['gracias', 'estimado', 'atentamente', 'senores', 'el', 'la', 'los', 'las', 'y', 'del', 'que', 'en', 'por', 'su', 'para', 'una', 'con', 'antes', 'se', 'es', 'al', 'debe', 'esta', 'cualquier', 'caso', 'podran', 'no', 'lo', 'como', 'sus', 'hasta', 'usted'],
  it: ['grazie', 'arrivederci', 'gentile', 'cordiali', 'totale', 'il', 'la', 'le', 'di', 'e', 'che', 'per', 'una', 'del', 'della', 'delle', 'con', 'entro', 'alla', 'al', 'sono', 'non', 'verra', 'gli', 'dopo', 'tale', 'questa', 'nel', 'nella', 'dei', 'ai', 'pari', 'si', 'oppure', 'saluti'],
  pt: ['obrigado', 'obrigada', 'exmo', 'cumprimentos', 'o', 'a', 'os', 'as', 'do', 'da', 'dos', 'das', 'que', 'em', 'para', 'uma', 'com', 'sua', 'seu', 'ate', 'nao', 'devera', 'ao', 'aos', 'no', 'na', 'pelo', 'pela', 'sem', 'estes', 'esta', 'foi', 'voce', 'informamos', 'melhores'],
};
// Diacritics / letters that strongly hint at one language (checked on raw text).
const CHAR_HINTS: [RegExp, Lang, number][] = [
  [/[ßäöü]/gi, 'de', 2], [/[ãõ]/gi, 'pt', 3], [/ç/gi, 'pt', 0.5], [/ç/gi, 'fr', 0.5],
  [/[ñ¿¡]/gi, 'es', 3], [/[èêœ]/gi, 'fr', 1.5], [/[ìò]/gi, 'it', 1.5], [/º/g, 'es', 0.5], [/º/g, 'pt', 0.5],
];

export function detectLanguage(text: string): Field<Lang> & { scores: Record<Lang, number> } {
  const words = fold(text).match(/[a-zß]+/g) ?? [];
  const scores: Record<Lang, number> = { en: 0, de: 0, fr: 0, es: 0, it: 0, pt: 0 };
  const sets = Object.fromEntries(Object.entries(STOP).map(([k, v]) => [k, new Set(v)])) as Record<Lang, Set<string>>;
  for (const w of words) {
    const hits = (Object.keys(sets) as Lang[]).filter((l) => sets[l].has(w));
    if (hits.length) for (const l of hits) scores[l] += 1 / hits.length;
  }
  for (const [re, l, wgt] of CHAR_HINTS) scores[l] += (text.match(re)?.length ?? 0) * wgt * 0.5;
  const ranked = (Object.keys(scores) as Lang[]).sort((a, b) => scores[b] - scores[a]);
  const [best, second] = ranked;
  const top = scores[best];
  if (top < 2) return { value: null, snippet: null, confidence: null, scores };
  const ratio = scores[second] / top;
  const confidence = ratio < 0.5 && top >= 6 ? 'high' : ratio < 0.8 ? 'medium' : 'low';
  return { value: best, snippet: null, confidence, scores };
}
