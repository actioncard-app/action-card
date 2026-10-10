// Multi-page documents: each photo is OCR'd on its own, the texts are combined (in page order) and the card is
// re-extracted from the combined text. Values the user edited are kept. Snippets are mapped back to their page.
import type { ActionCard, PageText } from './types';
import { extractRules } from './extract';
import { cleanOcr } from './extract/normalize';
import { regenerateActions } from './extract';

export const pagesOf = (card: ActionCard): PageText[] => card.pages?.length ? card.pages : [{ text: card.ocrText, confidence: card.ocrConfidence }];

export function combinePages(pages: PageText[]): string {
  return pages.map((p) => p.text.trim()).join('\n\n');
}
/** OCR confidence of the whole document: average of the pages weighted by text length. */
export function combinedConfidence(pages: PageText[]): number | null {
  const ps = pages.filter((p) => p.confidence !== null && p.text.trim());
  const w = ps.reduce((s, p) => s + p.text.length, 0);
  return w ? ps.reduce((s, p) => s + (p.confidence as number) * p.text.length, 0) / w : null;
}

/** Copy every field the user edited from `prev` onto `next` (edits always win over re-extraction). */
export function keepEdits(prev: ActionCard, next: ActionCard): ActionCard {
  const out: ActionCard = { ...next, id: prev.id, createdAt: prev.createdAt, userLanguage: prev.userLanguage };
  if (prev.docLanguage.edited) out.docLanguage = prev.docLanguage;
  if (prev.docType.edited) out.docType = prev.docType;
  if (prev.deadline.edited) out.deadline = prev.deadline;
  if (prev.amount.edited) out.amount = prev.amount;
  if (prev.reference.edited) out.reference = prev.reference;
  if (prev.nextAction.edited) out.nextAction = prev.nextAction;
  if (prev.reply.edited) out.reply = prev.reply;
  // ticks stay when the steps stay the same (same document type)
  if (prev.stepsDone?.length && (prev.docType.value === out.docType.value)) out.stepsDone = prev.stepsDone;
  return regenerateActions(out);
}

/** New card from all pages (rules), keeping the user's edits from the previous version of the card. */
export function addPage(prev: ActionCard, page: PageText, docLanguageChoice: ActionCard['docLanguage']['value'] | null): ActionCard {
  const pages = [...pagesOf(prev), page];
  const fresh = extractRules(combinePages(pages), { userLanguage: prev.userLanguage, docLanguage: docLanguageChoice, ocrConfidence: combinedConfidence(pages) });
  return keepEdits(prev, { ...fresh, pages });
}

const norm = (s: string) => cleanOcr(s).replace(/\s+/g, ' ').toLowerCase();
/** Page number (1-based) a snippet comes from, or null for single-page cards / not found. */
export function pageOf(card: ActionCard, snippet: string | null | undefined): number | null {
  if (!snippet || !card.pages || card.pages.length < 2) return null;
  const sn = norm(snippet);
  const texts = card.pages.map((p) => norm(p.text));
  for (const probe of [sn, sn.slice(0, 24), sn.slice(-24)]) {
    if (probe.length < 4) continue;
    const i = texts.findIndex((t) => t.includes(probe));
    if (i >= 0) return i + 1;
  }
  return null;
}

/** Full text with a visible marker before each page (display/PDF only; extraction uses the plain combined text). */
export function textWithMarkers(card: ActionCard, label: (n: number) => string): string {
  const ps = pagesOf(card);
  if (ps.length < 2) return card.ocrText;
  return ps.map((p, i) => `— ${label(i + 1)} —\n${cleanOcr(p.text).trim()}`).join('\n\n');
}
