// Letters READ in one of the twelve extra languages: the text, dates, amounts, IBAN and reference are found by the
// language-independent rules, but the wording rules (deadline phrases, document type, reply drafts) only exist for
// the six card languages, so the card records the reading language and leaves docLanguage empty.
import type { ActionCard, Lang, ReadLang } from './types';
import { isRuleLang } from './types';

export const ruleLang = (l: ReadLang | 'auto' | null | undefined): Lang | null => (isRuleLang(l) ? l : null);

export function withReadLanguage(card: ActionCard, lang: ReadLang | 'auto' | null | undefined): ActionCard {
  if (!lang || lang === 'auto' || isRuleLang(lang)) return card;
  return { ...card, readLanguage: lang, docLanguage: { value: null, snippet: null, confidence: null, note: 'Read in a language without wording rules.' } };
}
