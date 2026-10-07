import type { ActionCard, DocType, Lang } from '../types';
import { cleanOcr } from './normalize';
import { detectLanguage } from './language';
import { detectDocType } from './doctype';
import { findDeadline } from './dates';
import { findMoney, listAmounts } from './money';
import { findReference, findLabelQuote } from './reference';
import { nextActionText, replyText, REL_UNKNOWN } from '../templates';

export { detectLanguage } from './language';

export function newId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

/** Offline, rule-based extraction. Never invents values: anything not found stays null ("Not found"). */
export function extractRules(rawText: string, opts: { userLanguage: Lang; docLanguage?: Lang | null; ocrConfidence?: number | null }): ActionCard {
  const text = cleanOcr(rawText);
  const detected = detectLanguage(text);
  const docLanguage = opts.docLanguage
    ? { value: opts.docLanguage, snippet: null, confidence: 'high' as const, note: 'Chosen by you.' }
    : { value: detected.value, snippet: null, confidence: detected.confidence, note: detected.value ? 'Detected from common words in the text.' : 'Could not detect the language.' };
  const docType = detectDocType(text);
  const type: DocType = docType.value ?? 'unknown';
  const dl = findDeadline(text, type, docLanguage.value);
  const amount = findMoney(text, type);
  const reference = findReference(text);
  const card: ActionCard = {
    id: newId(),
    createdAt: Date.now(),
    mode: 'rules',
    userLanguage: opts.userLanguage,
    docLanguage,
    docType: { value: docType.value, snippet: docType.snippet, confidence: docType.confidence, note: docType.note },
    deadline: dl.field,
    otherDeadlines: dl.others,
    amount,
    reference,
    labelQuote: type === 'medicine_label' ? findLabelQuote(text) : undefined,
    nextAction: { text: '' },
    reply: { docLang: docLanguage.value ?? 'en', docText: '', userText: '' },
    datesSeen: dl.seen,
    amountsSeen: listAmounts(text),
    ocrText: text,
    ocrConfidence: opts.ocrConfidence ?? null,
  };
  return regenerateActions(card);
}

/** Rebuild next action + reply from the (possibly user-edited) fields, unless the user edited those texts. */
export function regenerateActions(card: ActionCard): ActionCard {
  const type = card.docType.value ?? 'unknown';
  const docLang = card.docLanguage.value ?? 'en';
  const out = { ...card };
  if (!card.nextAction.edited) {
    let text = nextActionText(type, card.userLanguage, card.deadline.value, card.amount.value);
    if (!card.deadline.value && card.deadline.calc) text += ' ' + REL_UNKNOWN[card.userLanguage].replace('{rule}', card.deadline.calc.ruleSnippet);
    out.nextAction = { text };
  }
  if (!card.reply.edited) {
    out.reply = {
      docLang,
      docText: replyText(type, docLang, card.reference.value),
      userText: replyText(type, card.userLanguage, card.reference.value),
    };
  }
  return out;
}

/** Days from today (local) to an ISO date. Negative = passed. */
export function daysUntil(iso: string, now = new Date()): number {
  const [y, m, d] = iso.split('-').map(Number);
  const target = Date.UTC(y, m - 1, d);
  const today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((target - today) / 86400000);
}
