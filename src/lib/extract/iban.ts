// IBAN extraction + validation (ISO 13616: country length + mod-97 checksum). Never invents a value: a printed
// IBAN that fails the checksum is still shown (OCR may have misread a digit) but marked low confidence with a note.
import type { Field } from '../types';
import { snippetFor } from './normalize';

// IBAN lengths per country (SEPA + common), from the SWIFT IBAN registry.
export const IBAN_LEN: Record<string, number> = {
  AD: 24, AT: 20, BE: 16, BG: 22, CH: 21, CY: 28, CZ: 24, DE: 22, DK: 18, EE: 20, ES: 24, FI: 18, FR: 27, GB: 22, GI: 23, GR: 27,
  HR: 21, HU: 28, IE: 22, IS: 26, IT: 27, LI: 21, LT: 20, LU: 20, LV: 21, MC: 27, MT: 31, NL: 18, NO: 15, PL: 28, PT: 25, RO: 24,
  SE: 24, SI: 19, SK: 24, SM: 27, VA: 22, TR: 26, UA: 29, AE: 23, SA: 24, IL: 23, MA: 28, TN: 24, RS: 22, BA: 20, ME: 22, MK: 19, AL: 28,
};

/** mod-97 check on a compact IBAN (no spaces, upper case). */
export function ibanChecksumOk(iban: string): boolean {
  if (!/^[A-Z]{2}\d{2}[A-Z0-9]+$/.test(iban)) return false;
  const r = iban.slice(4) + iban.slice(0, 4);
  let rem = 0;
  for (const ch of r) {
    const v = ch >= 'A' && ch <= 'Z' ? String(ch.charCodeAt(0) - 55) : ch;
    for (const d of v) rem = (rem * 10 + Number(d)) % 97;
  }
  return rem === 1;
}
export function validIban(iban: string): boolean {
  const c = iban.replace(/\s+/g, '').toUpperCase();
  return IBAN_LEN[c.slice(0, 2)] === c.length && ibanChecksumOk(c);
}
/** "DE89370400440532013000" -> "DE89 3704 0044 0532 0130 00" */
export const formatIban = (c: string) => c.replace(/(.{4})/g, '$1 ').trim();

// OCR fixes inside the BBAN for countries whose BBAN is all digits (O->0, I/l->1, S->5, B->8).
const NUMERIC_BBAN = new Set(['DE', 'AT', 'BE', 'CH', 'DK', 'EE', 'FI', 'HR', 'LT', 'LU', 'NO', 'PL', 'PT', 'SE', 'SI', 'SK', 'ES', 'CZ', 'HU', 'IS', 'TR', 'RS', 'BA', 'ME', 'IL', 'TN', 'MA', 'AL']);
const fixDigits = (s: string) => s.replace(/[Oo]/g, '0').replace(/[Il|]/g, '1').replace(/S/g, '5').replace(/B/g, '8');

export interface IbanHit { value: string; valid: boolean; start: number; end: number }
export function findIbans(text: string): IbanHit[] {
  const out: IbanHit[] = [];
  // two letters, two check digits, then groups (OCR may insert single spaces between groups)
  const re = /\b([A-Z]{2})\s?(\d{2})((?:\s?[A-Z0-9Ol|]){10,30})/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    const cc = m[1];
    const len = IBAN_LEN[cc];
    if (!len) continue;
    let bban = m[3].replace(/\s+/g, '');
    if (NUMERIC_BBAN.has(cc)) bban = fixDigits(bban);
    bban = bban.toUpperCase();
    const need = len - 4;
    if (bban.length < need) continue;
    // greedy match may run into the next word ("... 00 BIC"); try the exact length first
    const cand = cc + m[2] + bban.slice(0, need);
    if (NUMERIC_BBAN.has(cc) && !/^\d+$/.test(cand.slice(4))) continue;
    // end position in the original text: walk the raw match until `need` BBAN characters were consumed
    let used = 0, i = 0; const raw = m[3];
    while (i < raw.length && used < need) { if (!/\s/.test(raw[i])) used++; i++; }
    const end = m.index + m[0].length - raw.length + i;
    out.push({ value: cand, valid: ibanChecksumOk(cand), start: m.index, end });
    re.lastIndex = end;
  }
  return out;
}

/** The IBAN to pay to, if one is printed. Prefers a checksum-valid one next to an "IBAN" label. */
export function findIban(text: string): Field<string> {
  const hits = findIbans(text);
  if (!hits.length) return { value: null, snippet: null, confidence: null };
  const labelled = (h: IbanHit) => /iban|konto|account|compte|cuenta|conto|conta|hesap|rachunek|счет|рахун/i.test(text.slice(Math.max(0, h.start - 40), h.start));
  const best = hits.find((h) => h.valid && labelled(h)) ?? hits.find((h) => h.valid) ?? hits[0];
  const snippet = snippetFor(text, best.start, best.end);
  if (!best.valid) return { value: formatIban(best.value), snippet, confidence: 'low', note: 'The check digits do not match: a character was probably misread. Copy it from the original letter.' };
  return { value: formatIban(best.value), snippet, confidence: labelled(best) ? 'high' : 'medium', note: 'Check digits are valid (IBAN checksum).' };
}
