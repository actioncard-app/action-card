// "Trust panel": money direction, what needs checking, and approximate meaning of source snippets.
// All offline and rule-based. Everything here is derived from the card (OCR text + extracted fields) at render time,
// so it also works for cards saved before this existed. It never guesses: no keyword evidence means "unclear".
import type { ActionCard, Confidence } from './types';
import { findAmounts } from './extract/money';
import { pagesOf } from './pages';
import type { Key } from './i18n';

export type Direction = 'pay' | 'refund' | 'deposit' | 'fee' | 'unclear';
export const DIR_KEY: Record<Direction, Key> = { pay: 'dir_pay', refund: 'dir_refund', deposit: 'dir_deposit', fee: 'dir_fee', unclear: 'dir_unclear' };
export const MEAN_KEY: Record<Direction, Key> = { pay: 'mean_pay', refund: 'mean_refund', deposit: 'mean_deposit', fee: 'mean_fee', unclear: 'mean_unclear' };
export interface DirectionResult { value: Direction; snippet: string | null; confidence: Confidence | null; noPayment: string | null }

const fold = (s: string) => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
const words = (list: string[]) => new RegExp(`(?:^|[^a-z])(?:${list.map((w) => fold(w).replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/ /g, '\\s+')).join('|')})`, 'i');

// Keywords per direction (folded: lower case, no accents). Stems end without a word boundary on purpose (erstatt*).
const KW: Record<Exclude<Direction, 'unclear'>, RegExp> = {
  refund: words(['refund', 'reimburse', 'repaid', 'compensation', 'rembours', 'indemnisation', 'erstatt', 'ruckerstatt', 'entschadigung', 'gutschrift', 'reembols', 'compensacion', 'devolucion', 'rimbors', 'compensazion', 'indennizz', 'devolucao', 'indemnizacao', 'compensacao', 'estorno']),
  deposit: words(['deposit', 'security deposit', 'kaution', 'mietkaution', 'caution', 'depot de garantie', 'fianza', 'deposito cauzionale', 'cauzione', 'caucao', 'garantia locaticia']),
  fee: words(['cancellation fee', 'penalty', 'will be charged', 'be charged', 'stornogebuhr', 'storno', 'berechnen wir', 'in rechnung', 'frais d\'annulation', 'penalite', 'sera facture', 'factur', 'gastos de cancelacion', 'penalizacion', 'se cobrar', 'penale', 'addebit', 'penalidade', 'sera cobrad', 'taxa de cancelamento']),
  pay: words(['pay', 'payment', 'amount due', 'total due', 'payable', 'zahl', 'bezahl', 'uberweis', 'verwarnungsgeld', 'bussgeld', 'gesamtbetrag', 'payer', 'payez', 'paiement', 'a regler', 'reglement', 'amende', 'timbre', 'pagar', 'pago', 'abonar', 'abonarse', 'importe a pagar', 'multa', 'pagare', 'pagamento', 'versamento', 'sanzione', 'coima', 'liquidar']),
};
// higher wins when several directions appear at the same distance ("Refund to original payment": refund, not pay)
const PRIORITY: Exclude<Direction, 'unclear'>[] = ['deposit', 'refund', 'fee', 'pay'];

const NO_PAYMENT = words(['no payment is required', 'no payment is requested', 'no payment required', 'no payment needed', 'nothing to pay', 'does not request any payment', 'keine zahlung', 'nichts zu zahlen', 'aucun paiement', 'rien a payer', 'ningun pago', 'no tiene que pagar', 'nessun pagamento', 'non deve pagare', 'nenhum pagamento', 'nao tem de pagar', 'nao precisa de pagar']);

const PAY_INSTRUMENT = /(?:original )?payment method|original payment|mode de paiement|moyen de paiement|forma de pago|metodo de pago|metodo di pagamento|metodo de pagamento|meio de pagamento|zahlungsmittel|zahlungsart/g;

function lineAround(text: string, at: number) {
  const s = text.lastIndexOf('\n', at - 1) + 1; const e = text.indexOf('\n', at); return text.slice(s, e < 0 ? text.length : e).trim();
}

export function moneyDirection(card: ActionCard): DirectionResult {
  const text = card.ocrText;
  const np = NO_PAYMENT.exec(fold(text));
  const noPayment = np ? lineAround(text, np.index + 1) : null;
  const money = card.amount.value;
  if (!money) return { value: 'unclear', snippet: null, confidence: null, noPayment };
  const lines = text.split('\n');
  const starts: number[] = []; let o = 0;
  for (const l of lines) { starts.push(o); o += l.length + 1; }
  const lineOf = (pos: number) => { let i = 0; while (i + 1 < starts.length && starts[i + 1] <= pos) i++; return i; };
  // every place the same amount is printed counts ("Penale ... (120,00 €)" may be far from the table row)
  const hits = findAmounts(text).filter((c) => Math.abs(c.amount - money.amount) < 0.005 && c.currency === money.currency).map((c) => lineOf(c.start));
  if (!hits.length) return { value: 'unclear', snippet: null, confidence: null, noPayment };
  for (const dist of [0, 1, 2]) {
    let best: { d: Exclude<Direction, 'unclear'>; line: number } | null = null;
    for (const h of hits) {
      for (const li of dist === 0 ? [h] : [h - dist, h + dist]) {
        if (li < 0 || li >= lines.length || !lines[li].trim()) continue;
        // "to your original payment method" names how a refund is paid, not a payment by you
        const f = fold(lines[li]).replace(PAY_INSTRUMENT, ' ');
        for (const d of PRIORITY) if (KW[d].test(f) && (!best || PRIORITY.indexOf(d) < PRIORITY.indexOf(best.d))) best = { d, line: li };
      }
    }
    if (best) {
      const snippet = dist === 0 ? lines[best.line].trim() : [lines[Math.min(best.line, hits[0])], lines[Math.max(best.line, hits[0])]].map((s) => s.trim()).join(' / ');
      return { value: best.d, snippet, confidence: dist === 0 ? 'high' : dist === 1 ? 'medium' : 'low', noPayment };
    }
  }
  return { value: 'unclear', snippet: null, confidence: null, noPayment };
}

// Contact / submission method: e-mail, web address, phone number, IBAN, postal box, or wording such as "online", "by post", "in person".
const CONTACT = words(['online', 'website', 'portal', 'by post', 'by email', 'in person', 'per post', 'postalisch', 'per e-mail', 'vor ort', 'personlich', 'kontoverbindung', 'par courrier', 'par e-mail', 'en ligne', 'sur place', 'site internet', 'por correo', 'en persona', 'presencial', 'sede electronica', 'per posta', 'di persona', 'sito', 'via e-mail', 'por correio', 'presencialmente', 'multibanco', 'balcao', 'postfach', 'boite postale', 'apartado', 'casella postale']);
export function hasContact(text: string): boolean {
  if (/[\w.+-]+@[\w-]+\.[\w.]+/.test(text)) return true;
  if (/\b(?:https?:\/\/|www\.)\S+/i.test(text) || /\b[a-z0-9-]+\.(?:de|fr|es|it|pt|com|org|gov|gouv\.fr|gob\.es|eu|uk|co\.uk)\b/i.test(text)) return true;
  if (/\b[A-Z]{2}\d{2}(?: ?[A-Z0-9]{4}){3,}/.test(text)) return true; // IBAN
  if (/(?:\+\d{1,3}[\s/-]?)?\(?\d{2,5}\)?[\s/-]?\d{3,}[\s/-]?\d{2,}/.test(text) && /(tel|phone|fon|telefone|telefono|téléphone|☎)/i.test(text)) return true;
  return CONTACT.test(fold(text));
}

export type CheckKey = 'chk_no_deadline' | 'chk_start_unknown' | 'chk_from_receipt' | 'chk_deadline_guess' | 'chk_date_repaired' | 'chk_date_ambiguous' | 'chk_no_amount' | 'chk_amount_guess' | 'chk_direction_unclear' | 'chk_no_reference' | 'chk_no_contact' | 'chk_ocr_low' | 'chk_doctype_unknown' | 'chk_appointment';
/** Plain list of what the user should double-check, most important first. Edited fields are never flagged. */
export function needsChecking(card: ActionCard, dir = moneyDirection(card)): CheckKey[] {
  const out: CheckKey[] = [];
  const type = card.docType.value ?? 'unknown';
  const med = type === 'medicine_label';
  if (!card.docType.edited && type === 'unknown') out.push('chk_doctype_unknown');
  const dl = card.deadline;
  if (!dl.edited) {
    if (!dl.value && dl.calc && !dl.calc.base) out.push('chk_start_unknown');
    else if (!dl.value) out.push('chk_no_deadline');
    else {
      if (dl.calc?.anchor === 'receipt') out.push('chk_from_receipt');
      if (/misread/.test(dl.note ?? '')) out.push('chk_date_repaired');
      if (/ambiguous/.test(dl.note ?? '')) out.push('chk_date_ambiguous');
      if (dl.kind === 'appointment') out.push('chk_appointment');
      if (dl.confidence === 'low' && !out.includes('chk_from_receipt') && !out.includes('chk_date_repaired')) out.push('chk_deadline_guess');
    }
  }
  if (!med && !card.amount.edited) {
    if (!card.amount.value) { if (type !== 'unknown') out.push('chk_no_amount'); }
    else {
      if (card.amount.confidence === 'low') out.push('chk_amount_guess');
      if (dir.value === 'unclear') out.push('chk_direction_unclear');
    }
  }
  if (!med && !card.reference.edited && !card.reference.value) out.push('chk_no_reference');
  if (!med && !hasContact(pagesOf(card).map((p) => p.text).join('\n'))) out.push('chk_no_contact');
  if (card.ocrConfidence !== null && card.ocrConfidence < 70) out.push('chk_ocr_low');
  return out;
}

// ---- approximate meaning of a source snippet: recognised words -> concept, plus the value the app read ----
export type Concept = 'g_pay' | 'g_transfer' | 'g_by' | 'g_at_latest' | 'g_deadline' | 'g_within' | 'g_days' | 'g_refund' | 'g_deposit' | 'g_fine' | 'g_fee' | 'g_penalty' | 'g_cancel' | 'g_reference' | 'g_total' | 'g_amount' | 'g_return' | 'g_signed' | 'g_documents' | 'g_appointment' | 'g_expiry' | 'g_no_payment' | 'g_compensation' | 'g_charged' | 'g_before' | 'g_from_date' | 'g_rent' | 'g_contest';
const GLOSSARY: [string, Concept][] = [
  // de
  ['überweisen', 'g_transfer'], ['zahlen', 'g_pay'], ['zahlbar', 'g_pay'], ['bis zum', 'g_by'], ['spätestens', 'g_at_latest'], ['frist', 'g_deadline'], ['innerhalb von', 'g_within'], ['tagen', 'g_days'], ['erstattung', 'g_refund'], ['kaution', 'g_deposit'], ['verwarnungsgeld', 'g_fine'], ['bußgeld', 'g_fine'], ['gebühr', 'g_fee'], ['stornogebühr', 'g_penalty'], ['storno', 'g_cancel'], ['aktenzeichen', 'g_reference'], ['gesamtbetrag', 'g_total'], ['betrag', 'g_amount'], ['zurücksenden', 'g_return'], ['unterschrieben', 'g_signed'], ['unterlagen', 'g_documents'], ['termin', 'g_appointment'], ['verwendbar bis', 'g_expiry'], ['keine zahlung', 'g_no_payment'], ['entschädigung', 'g_compensation'], ['vor', 'g_before'], ['ab dem datum', 'g_from_date'], ['miete', 'g_rent'], ['einspruch', 'g_contest'],
  // fr
  ['payer', 'g_pay'], ['payez', 'g_pay'], ['paiement', 'g_pay'], ['virement', 'g_transfer'], ['avant le', 'g_by'], ['au plus tard', 'g_at_latest'], ['délai', 'g_deadline'], ['dans un délai de', 'g_within'], ['jours', 'g_days'], ['remboursement', 'g_refund'], ['dépôt de garantie', 'g_deposit'], ['amende', 'g_fine'], ['frais', 'g_fee'], ['pénalité', 'g_penalty'], ['annulation', 'g_cancel'], ['référence', 'g_reference'], ['total', 'g_total'], ['montant', 'g_amount'], ['renvoyer', 'g_return'], ['signé', 'g_signed'], ['pièces', 'g_documents'], ['rendez-vous', 'g_appointment'], ['à utiliser avant', 'g_expiry'], ['aucun paiement', 'g_no_payment'], ['indemnisation', 'g_compensation'], ['facturé', 'g_charged'], ['facturée', 'g_charged'], ['loyer', 'g_rent'], ['contester', 'g_contest'],
  // es
  ['pagar', 'g_pay'], ['pago', 'g_pay'], ['transferencia', 'g_transfer'], ['antes del', 'g_by'], ['a más tardar', 'g_at_latest'], ['plazo', 'g_deadline'], ['en un plazo de', 'g_within'], ['días', 'g_days'], ['reembolso', 'g_refund'], ['fianza', 'g_deposit'], ['multa', 'g_fine'], ['tasa', 'g_fee'], ['penalización', 'g_penalty'], ['cancelación', 'g_cancel'], ['expediente', 'g_reference'], ['importe', 'g_amount'], ['devolver', 'g_return'], ['firmada', 'g_signed'], ['documentos', 'g_documents'], ['cita', 'g_appointment'], ['caducidad', 'g_expiry'], ['ningún pago', 'g_no_payment'], ['compensación', 'g_compensation'], ['renta', 'g_rent'], ['recurrir', 'g_contest'],
  // it
  ['pagare', 'g_pay'], ['pagamento', 'g_pay'], ['bonifico', 'g_transfer'], ['entro il', 'g_by'], ['entro', 'g_within'], ['scadenza', 'g_deadline'], ['giorni', 'g_days'], ['rimborso', 'g_refund'], ['cauzione', 'g_deposit'], ['sanzione', 'g_fine'], ['penale', 'g_penalty'], ['cancellazione', 'g_cancel'], ['addebitata', 'g_charged'], ['riferimento', 'g_reference'], ['totale', 'g_total'], ['importo', 'g_amount'], ['restituire', 'g_return'], ['firmato', 'g_signed'], ['documenti', 'g_documents'], ['appuntamento', 'g_appointment'], ['nessun pagamento', 'g_no_payment'], ['indennizzo', 'g_compensation'], ['affitto', 'g_rent'], ['ricorso', 'g_contest'],
  // pt
  ['pagar', 'g_pay'], ['pagamento', 'g_pay'], ['até', 'g_by'], ['prazo', 'g_deadline'], ['no prazo de', 'g_within'], ['dias', 'g_days'], ['reembolso', 'g_refund'], ['caução', 'g_deposit'], ['coima', 'g_fine'], ['taxa', 'g_fee'], ['penalidade', 'g_penalty'], ['cancelamento', 'g_cancel'], ['referência', 'g_reference'], ['valor', 'g_amount'], ['devolver', 'g_return'], ['assinado', 'g_signed'], ['documentos', 'g_documents'], ['agendamento', 'g_appointment'], ['validade', 'g_expiry'], ['nenhum pagamento', 'g_no_payment'], ['indemnização', 'g_compensation'], ['renda', 'g_rent'], ['contestar', 'g_contest'],
  // en
  ['pay', 'g_pay'], ['payment', 'g_pay'], ['refund', 'g_refund'], ['deposit', 'g_deposit'], ['fine', 'g_fine'], ['fee', 'g_fee'], ['penalty', 'g_penalty'], ['cancellation', 'g_cancel'], ['reference', 'g_reference'], ['no later than', 'g_at_latest'], ['within', 'g_within'], ['by', 'g_by'], ['return', 'g_return'], ['signed', 'g_signed'], ['appointment', 'g_appointment'], ['expiry', 'g_expiry'], ['compensation', 'g_compensation'], ['charged', 'g_charged'], ['before', 'g_before'], ['rent', 'g_rent'], ['appeal', 'g_contest'],
];
const GL = GLOSSARY.map(([w, c]) => [w, c, new RegExp(`(?:^|[^\\p{L}])${w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/ /g, '\\s+')}(?![\\p{L}])`, 'iu')] as const);

/** Words of the snippet that the app recognises, as [word as printed, concept], in reading order, no duplicates
 *  (longer phrases win over the single words inside them). */
export function glossTerms(snippet: string | null | undefined): [string, Concept][] {
  if (!snippet) return [];
  const found: { at: number; end: number; word: string; c: Concept }[] = [];
  for (const [w, c, re] of GL) {
    const m = re.exec(snippet);
    if (!m) continue;
    const at = m.index + m[0].length - w.length;
    const word = snippet.slice(Math.max(0, m.index + m[0].length - m[0].trimStart().length), m.index + m[0].length).replace(/^[^\p{L}]+/u, '');
    found.push({ at, end: at + word.length, word, c });
  }
  found.sort((a, b) => a.at - b.at || b.end - a.end);
  const out: typeof found = [];
  for (const f of found) if (!out.some((o) => f.at < o.end && f.end > o.at) && !out.some((o) => o.c === f.c)) out.push(f);
  return out.map((f) => [f.word, f.c]);
}
