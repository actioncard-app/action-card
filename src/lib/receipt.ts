// "When did you receive it?" — deadlines that run from the day a letter was received/served/notified.
// Per-country rule table. Only Germany is VERIFIED, against the official legal texts (checked 19 Oct 2026):
//  - § 41 Abs. 2 VwVfG, § 122 Abs. 2 Nr. 1 AO, § 37 Abs. 2 SGB X (gesetze-im-internet.de): a written administrative
//    act posted inside Germany counts as notified on the 4th day after it was posted, unless it arrived later
//    (then the later day counts; in doubt the authority must prove when it arrived).
//  - Gesetz zur Modernisierung des Postrechts, BGBl. 2024 I Nr. 236, and BMF letter of 10 Dec 2024 (IV D 1 -
//    S 0062/24/10003 :001): 4 days (before: 3) for everything posted after 31 Dec 2024.
//  - § 67 Abs. 1 OWiG: objection to a fine notice (Bußgeldbescheid) within two weeks after formal service
//    (Zustellung) - the date the postal worker writes on the envelope.
// Every other country: NOT verified; the period is counted from the date the user enters, and the card says so.
import type { ActionCard, DeadlineCalc, DocType } from './types';
import { addPeriod } from './extract/relative';

export type ReceiptKind = 'deemed4' | 'served' | 'actual';
export interface ReceiptRule { country: string; kind: ReceiptKind; verified: boolean; law: string | null }

export const RECEIPT_COUNTRIES = ['DE', 'AT', 'CH', 'FR', 'BE', 'NL', 'ES', 'IT', 'PT', 'GB', 'IE', 'PL', 'OTHER'] as const;
const DE_AUTHORITY: Partial<Record<DocType, string>> = {
  tax_office: '§ 122 Abs. 2 Nr. 1 AO',
  benefits_office: '§ 37 Abs. 2 SGB X',
  health_insurance: '§ 37 Abs. 2 SGB X',
};

export function receiptRule(country: string, docType: DocType | null): ReceiptRule {
  if (country === 'DE') {
    if (docType && DE_AUTHORITY[docType]) return { country, kind: 'deemed4', verified: true, law: DE_AUTHORITY[docType]! };
    if (docType === 'parking_fine') return { country, kind: 'served', verified: true, law: '§ 67 Abs. 1 OWiG' };
    if (docType === 'broadcast_fee') return { country, kind: 'deemed4', verified: false, law: '§ 41 Abs. 2 VwVfG' }; // state procedure law; same wording in most states, not checked one by one
    return { country, kind: 'actual', verified: false, law: null };
  }
  return { country, kind: 'actual', verified: false, law: null };
}

export interface ReceiptStep { key: 'rcv_posted' | 'rcv_deemed' | 'rcv_received' | 'rcv_later' | 'rcv_start' | 'rcv_served' | 'rcv_result' | 'rcv_safer'; vars: Record<string, string> }
export interface ReceiptResult {
  rule: ReceiptRule;
  startIso: string;
  /** deadline counted from the start the law gives */
  resultIso: string;
  /** earlier date to act by when the start is uncertain (otherwise = resultIso) */
  safeIso: string;
  steps: ReceiptStep[];
}

const addDays = (iso: string, n: number) => addPeriod(iso, n, 'day', false, 1);

/**
 * receivedIso: the day the user says the letter arrived. postedIso: the letter's own date, taken as the posting day
 * (letters are normally posted that day or later, so this gives the EARLIER, safer deemed day).
 */
export function computeFromReceipt(calc: DeadlineCalc, receivedIso: string, postedIso: string | null, country: string, docType: DocType | null): ReceiptResult {
  const rule = receiptRule(country, docType);
  const steps: ReceiptStep[] = [];
  const period = (from: string) => addPeriod(from, calc.n, calc.unit, calc.business, calc.direction === 'before' ? -1 : 1);
  let startIso = receivedIso, safeStart = receivedIso;
  if (rule.kind === 'deemed4' && postedIso) {
    const deemed = addDays(postedIso, 4);
    steps.push({ key: 'rcv_posted', vars: { date: postedIso } });
    steps.push({ key: 'rcv_deemed', vars: { date: deemed, law: rule.law ?? '' } });
    steps.push({ key: 'rcv_received', vars: { date: receivedIso } });
    if (receivedIso > deemed) {
      startIso = receivedIso; safeStart = deemed;
      steps.push({ key: 'rcv_later', vars: { date: receivedIso } });
    } else {
      startIso = deemed; safeStart = deemed;
      steps.push({ key: 'rcv_start', vars: { date: deemed } });
    }
  } else if (rule.kind === 'served') {
    steps.push({ key: 'rcv_served', vars: { date: receivedIso, law: rule.law ?? '' } });
  } else {
    steps.push({ key: 'rcv_received', vars: { date: receivedIso } });
    steps.push({ key: 'rcv_start', vars: { date: receivedIso } });
  }
  const resultIso = period(startIso), safeIso = period(safeStart);
  steps.push({ key: 'rcv_result', vars: { rule: calc.ruleSnippet, date: resultIso } });
  if (safeIso !== resultIso) steps.push({ key: 'rcv_safer', vars: { date: safeIso } });
  return { rule, startIso, resultIso, safeIso, steps };
}

/** Apply the user's received date to the card: the deadline becomes the SAFER date; the calculation is kept. */
export function applyReceived(card: ActionCard, receivedIso: string, country: string): ActionCard {
  const calc = card.deadline.calc;
  if (!calc || calc.anchor !== 'receipt') return card;
  const posted = calc.base && calc.base.label === 'document date' ? calc.base.iso : (card.received?.postedIso ?? null);
  const r = computeFromReceipt(calc, receivedIso, posted, country, card.docType.value);
  return {
    ...card,
    received: { iso: receivedIso, country, postedIso: posted },
    deadline: { ...card.deadline, value: r.safeIso, confidence: r.rule.verified ? 'medium' : 'low', calc: { ...calc, resultIso: r.safeIso } },
  };
}
