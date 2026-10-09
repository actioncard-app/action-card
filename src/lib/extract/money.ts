import type { Confidence, DocType, Field, Money } from '../types';
import { fold, foldDoc, phraseRe, nearestCueBefore, snippetFor } from './normalize';

const CUR_SYMBOL: Record<string, string> = { '€': 'EUR', '£': 'GBP', '$': 'USD', 'us$': 'USD', 'r$': 'BRL', 'chf': 'CHF', 'eur': 'EUR', 'euro': 'EUR', 'euros': 'EUR', 'gbp': 'GBP', 'usd': 'USD', 'brl': 'BRL', 'fr.': 'CHF', 'sfr': 'CHF' };
const CUR = '(€|£|us\\$|r\\$|\\$|chf|eur|euros?|gbp|usd|brl|sfr)';
const NUM = '(\\d{1,3}(?:[.,\\u2009 ]\\d{3})+(?:[.,]\\d{1,2})?|\\d+(?:[.,]\\d{1,2})?)(?:,-|\\.-)?';

export function parseAmount(raw: string): number | null {
  let s = raw.replace(/[\u2009 ]/g, '').replace(/[,.]-$/, '');
  const lastDot = s.lastIndexOf('.'), lastComma = s.lastIndexOf(',');
  if (lastDot >= 0 && lastComma >= 0) {
    const dec = lastDot > lastComma ? '.' : ',';
    const thou = dec === '.' ? ',' : '.';
    s = s.split(thou).join('').replace(dec, '.');
  } else if (lastComma >= 0) {
    const after = s.length - lastComma - 1;
    s = after === 3 && s.split(',').length >= 2 && !/^0/.test(s) ? s.replace(/,/g, '') : s.replace(',', '.');
  } else if (lastDot >= 0) {
    const after = s.length - lastDot - 1;
    if (after === 3 && s.split('.').length >= 2) s = s.replace(/\./g, '');
  }
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

const GENERIC = ['amount', 'total', 'sum', 'price', 'betrag', 'summe', 'preis', 'montant', 'prix', 'somme', 'importe', 'precio', 'total', 'importo', 'prezzo', 'totale', 'valor', 'montante', 'preco', 'quantia'];
const STAKE: Record<DocType, [string, number][]> = {
  parking_fine: [['pronto pago', 4.5], ['reduccion', 4.5], ['reduced', 4.5], ['early payment', 4.5], ['ermaßigt', 4.5], ['ermassigt', 4.5], ['ridotto', 4.5], ['pagamento ridotto', 4.5], ['minoree', 4.5], ['reduite', 4.5], ['desconto', 4.5], ['gesamtbetrag', 4], ['zu zahlen', 3], ['verwarnungsgeld', 3], ['bußgeld', 2], ['bussgeld', 2], ['amount due', 4], ['total due', 4], ['penalty', 3], ['fine', 2], ['montant', 3], ['amende', 3], ['a payer', 3], ['importe', 3], ['multa', 3], ['importo', 3], ['sanzione', 3], ['da pagare', 3], ['coima', 3], ['valor a pagar', 4], ['total a pagar', 4], ['totale da pagare', 4], ['montant a payer', 4]],
  hotel_cancellation: [['penale', 4], ['penalty', 4], ['cancellation fee', 4], ['cancellation charge', 4], ['will be charged', 3], ['charged', 2], ['addebitata', 3], ['addebitato', 3], ['frais d\'annulation', 4], ['facture', 3], ['facturee', 3], ['sera facturee', 3], ['facturer', 2], ['gastos de cancelacion', 4], ['penalizacion', 4], ['se cobrara', 3], ['stornogebuhr', 4], ['stornokosten', 4], ['berechnet', 2], ['taxa de cancelamento', 4], ['penalizacao', 4], ['sera cobrado', 3]],
  rental_move_in: [['fianza', 4], ['deposit', 4], ['security deposit', 4], ['kaution', 4], ['mietkaution', 4], ['depot de garantie', 4], ['caution', 4], ['deposito cauzionale', 4], ['cauzione', 4], ['caucao', 4], ['deposito', 3]],
  airline_cancellation: [['refund', 3], ['full refund', 4], ['erstattung', 3], ['ruckerstattung', 3], ['remboursement', 3], ['reembolso', 3], ['rimborso', 3], ['compensation', 2], ['entschadigung', 2], ['indemnisation', 2], ['compensacion', 2], ['compensazione', 2], ['indemnizacao', 2]],
  visa_entry: [['fee', 3], ['visa fee', 4], ['gebuhr', 3], ['visumgebuhr', 4], ['frais', 3], ['timbre fiscal', 4], ['droit de visa', 4], ['tasa', 3], ['tasas', 3], ['tassa', 3], ['diritti consolari', 4], ['taxa', 3], ['taxa consular', 4], ['emolumentos', 3]],
  medicine_label: [['prix', 2], ['price', 2], ['preis', 2], ['pvp', 2], ['prezzo', 2], ['preco', 2]],
  unknown: [['to pay', 3], ['amount due', 3], ['zu zahlen', 3], ['a payer', 3], ['a pagar', 3], ['da pagare', 3]],
};
const LOWER = ['gebuhren und auslagen', 'auslagen', 'monthly rent', 'renta mensual', 'miete', 'loyer', 'canone', 'renda', 'per night', 'por noche', 'par nuit', 'a notte'];
const reGeneric = phraseRe(GENERIC);
const reLower = phraseRe(LOWER);
const STAKE_RES = Object.fromEntries(Object.entries(STAKE).map(([t, l]) => [t, l.map(([p, w]) => [phraseRe([p]), w] as const)])) as unknown as Record<DocType, (readonly [RegExp, number])[]>;

const LEGAL_AFTER = /^\s*(?:abs\b|absatz|satz\b|ziff|nr\.?\s*\d|stvo|stgb|stpo|bgb|owig|aufenthg|i\.?\s?v\.?\s?m|[a-z]?\s*(?:abs|stvo))/;

interface Cand { amount: number; currency: string; start: number; end: number }

export function findAmounts(text: string): Cand[] {
  const f = foldDoc(text);
  const all: (Cand & { digits: number })[] = [];
  // "€ 35.50" and "35,50 €" forms; the space must not be a line break. When both overlap (e.g. "35,50 € 1" read
  // with a stray margin digit) the reading with more digits wins, instead of whichever regex ran first.
  const res = [new RegExp(`(?<![a-z])${CUR}[^\\S\\n]?${NUM}`, 'g'), new RegExp(`(?<![\\d.,])${NUM}[^\\S\\n]?${CUR}(?![a-z])`, 'g')];
  res.forEach((re, k) => {
    let m: RegExpExecArray | null;
    while ((m = re.exec(f))) {
      const cur = k === 0 ? m[1] : m[2];
      const num = k === 0 ? m[2] : m[1];
      const amount = parseAmount(num);
      if (amount === null || amount <= 0) continue;
      // OCR reads the legal section sign "§" as "$": "$ 41 Abs. 1", "$ 49 StVO" are paragraphs, not dollars
      if (k === 0 && cur === '$' && LEGAL_AFTER.test(f.slice(m.index + m[0].length, m.index + m[0].length + 14))) continue;
      all.push({ amount, currency: CUR_SYMBOL[cur] ?? cur.toUpperCase(), start: m.index, end: m.index + m[0].length, digits: num.replace(/\D/g, '').length });
    }
  });
  all.sort((a, b) => b.digits - a.digits || a.start - b.start);
  const out: Cand[] = [];
  for (const c of all) if (!out.some((o) => c.start < o.end && c.end > o.start)) out.push({ amount: c.amount, currency: c.currency, start: c.start, end: c.end });
  return out.sort((a, b) => a.start - b.start);
}

export function findMoney(text: string, docType: DocType): Field<Money> {
  const cands = findAmounts(text);
  if (!cands.length) return { value: null, snippet: null, confidence: null };
  const f = foldDoc(text);
  const scored = cands.map((c, i) => {
    const prevEnd = i > 0 ? cands[i - 1].end : 0;
    const win = Math.min(80, c.start - prevEnd);
    let score = 0.5; let cueStart: number | undefined; let close = false;
    for (const [re, w] of STAKE_RES[docType] ?? []) {
      const hit = nearestCueBefore(f, c.start, re, win);
      if (hit) {
        const p = hit.dist <= 25 ? 1 : hit.dist <= 50 ? 0.7 : 0.45;
        if (w * p + 0.5 > score) { score = w * p + 0.5; cueStart = hit.start; close = hit.dist <= 25; }
      }
    }
    const g = nearestCueBefore(f, c.start, reGeneric, Math.min(win, 40));
    if (g && 1.5 > score) { score = 1.5; cueStart = g.start; close = g.dist <= 25; }
    const lo = nearestCueBefore(f, c.start, reLower, Math.min(win, 40));
    if (lo) score -= 1;
    return { c, score, cueStart, close };
  });
  scored.sort((a, b) => b.score - a.score);
  let top = scored[0];
  // Itemised tables: a line labelled "Total"/"Gesamtbetrag"/... whose amount is the exact sum of the amounts
  // listed directly above it is what has to be paid, unless the top pick is a deposit/penalty AND the text never
  // refers to the total elsewhere ("el total a pagar debe abonarse...").
  const tot = totalOverride(text, f, cands, top.c, docType, top.score);
  if (tot) top = scored.find((x) => x.c === tot)!;
  const runner = scored.find((x) => x !== top);
  let confidence: Confidence = top.score >= 3 && top.close ? 'high' : top.score >= 1.5 ? 'medium' : 'low';
  if (runner && runner.score >= top.score - 0.3 && runner.c.amount !== top.c.amount) confidence = confidence === 'high' ? 'medium' : 'low';
  const note = top.score < 1.5 ? 'Amount found, but no wording nearby says it is what you owe or risk.' : scored.length > 1 ? `${scored.length} amounts found in the document; check this is the right one.` : undefined;
  return {
    value: { amount: top.c.amount, currency: top.c.currency },
    snippet: snippetFor(text, top.c.start, top.c.end, top.cueStart),
    confidence,
    note,
  };
}

const RE_TOTAL_LINE = /(?:^|[^a-z])(total|totale|totaal|gesamtbetrag|gesamtsumme|gesamt|summe|somme)(?![a-z])/;
const RE_TOTAL_MENTION = /(the|el|o|le|il|den|das|do|del|au|al) (total|totale|gesamtbetrag)|gesamtbetrag|total amount|importe total|montant total|valor total|importo totale/;
function totalOverride(text: string, f: string, cands: Cand[], top: Cand, docType: DocType, topScore: number): Cand | null {
  for (let i = 2; i < cands.length; i++) {
    const t = cands[i];
    const lineStart = f.lastIndexOf('\n', t.start - 1) + 1;
    if (!RE_TOTAL_LINE.test(f.slice(lineStart, t.start))) continue;
    for (let k = 2; k <= Math.min(8, i); k++) {
      const parts = cands.slice(i - k, i);
      if (parts.some((p) => p.currency !== t.currency)) break;
      const sum = parts.reduce((a, p) => a + p.amount, 0);
      if (Math.abs(sum - t.amount) > 0.011) continue;
      if (!parts.includes(top)) return null;
      const specific = (docType === 'rental_move_in' || docType === 'hotel_cancellation') && topScore >= 3;
      if (specific) {
        const rest = f.slice(0, lineStart) + f.slice(f.indexOf('\n', t.end) < 0 ? f.length : f.indexOf('\n', t.end));
        if (!RE_TOTAL_MENTION.test(rest)) return null;
      }
      return t;
    }
  }
  return null;
}

export function listAmounts(text: string) {
  return findAmounts(text).map((c) => ({ amount: c.amount, currency: c.currency, snippet: snippetFor(text, c.start, c.end) }));
}
