// Two-sentence plain summary at the top of the card, built only from the extracted fields (no AI). Sentence 1 says
// what the document is; sentence 2 says what matters (pay / get back / date). Returns i18n keys + values so it is
// shown in the interface language; the values come from the card, so nothing is invented.
import type { ActionCard } from './types';
import { moneyDirection } from './trust';
import type { Key } from './i18n';

export interface SummaryPart { key: Key; vars: Record<string, string> }
export function summaryParts(card: ActionCard, fmt: { date: (iso: string) => string; money: (a: number, c: string) => string; type: string; lang: string | null }): [SummaryPart, SummaryPart] {
  const type = card.docType.value ?? 'unknown';
  const first: SummaryPart = type === 'unknown'
    ? { key: fmt.lang ? 'sum_unknown_lang' : 'sum_unknown', vars: { lang: fmt.lang ?? '' } }
    : { key: fmt.lang ? 'sum_intro' : 'sum_intro_nolang', vars: { type: fmt.type, lang: fmt.lang ?? '' } };
  const d = card.deadline.value ? fmt.date(card.deadline.value) : null;
  const a = card.amount.value ? fmt.money(card.amount.value.amount, card.amount.value.currency) : null;
  const dir = moneyDirection(card).value;
  let key: Key;
  if (type === 'medicine_label') key = d ? 'sum_expiry' : 'sum_med';
  else if (card.deadline.kind === 'appointment' && d) key = 'sum_appt';
  else if (a && (dir === 'pay' || dir === 'fee')) key = d ? 'sum_pay_by' : 'sum_pay_nodate';
  else if (a && dir === 'refund') key = d ? 'sum_refund_by' : 'sum_refund';
  else if (a && dir === 'deposit') key = d ? 'sum_deposit_by' : 'sum_deposit';
  else if (a) key = d ? 'sum_amount_by' : 'sum_amount_nodate';
  else key = d ? 'sum_act_by' : 'sum_none';
  return [first, { key, vars: { date: d ?? '', amount: a ?? '' } }];
}
