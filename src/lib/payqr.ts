// Payment QR codes, all on the phone:
//  - makeEpcPayload: the European "GiroCode" / EPC QR (EPC069-12 v2: BCD / 002 / UTF-8 / SCT) for EUR transfers, so a
//    banking app can pre-fill IBAN, recipient, amount and reference. The user still checks and confirms in the bank
//    app; LetterScan never pays anything.
//  - parsePaymentQr: reads an EPC ("BCD") or Swiss QR-bill ("SPC", Swiss Payment Standards 2.x) payload found in the
//    photo (decoded with jsQR in decodeQrFromImage).
import { validIban } from './extract/iban';

export interface PayData { iban: string; name: string; amount: number | null; currency: string; reference: string; bic?: string }
export interface PayQr extends PayData { kind: 'epc' | 'swiss'; refType?: string; message?: string }

const clean = (s: string, max: number) => s.replace(/[\r\n]+/g, ' ').trim().slice(0, max);

/** EPC QR payload, or an error key. Only EUR (the EPC standard is euro-only). */
export function makeEpcPayload(p: PayData): { payload: string } | { error: 'pq_err_iban' | 'pq_err_name' | 'pq_err_currency' | 'pq_err_amount' } {
  const iban = p.iban.replace(/\s+/g, '').toUpperCase();
  if (!validIban(iban)) return { error: 'pq_err_iban' };
  const name = clean(p.name, 70);
  if (!name) return { error: 'pq_err_name' };
  if (p.currency && p.currency !== 'EUR') return { error: 'pq_err_currency' };
  if (p.amount !== null && !(p.amount >= 0.01 && p.amount <= 999999999.99)) return { error: 'pq_err_amount' };
  const ref = clean(p.reference, 140);
  const structured = /^RF\d{2}[A-Z0-9]{1,21}$/i.test(ref.replace(/\s+/g, '')) ? ref.replace(/\s+/g, '').toUpperCase() : '';
  const lines = ['BCD', '002', '1', 'SCT', (p.bic ?? '').replace(/\s+/g, '').toUpperCase(), name, iban,
    p.amount !== null ? `EUR${p.amount.toFixed(2)}` : '', '', structured.slice(0, 35), structured ? '' : ref];
  while (lines.length > 7 && lines[lines.length - 1] === '') lines.pop();
  return { payload: lines.join('\n') };
}

/** Read an EPC or Swiss QR-bill payload. Returns null for any other QR code. */
export function parsePaymentQr(raw: string): PayQr | null {
  const l = raw.replace(/\r\n?/g, '\n').split('\n');
  if (l[0]?.trim() === 'BCD' && l[3]?.trim() === 'SCT') {
    const amt = /^([A-Z]{3})(\d+(?:\.\d{1,2})?)$/.exec((l[7] ?? '').trim());
    return { kind: 'epc', bic: (l[4] ?? '').trim() || undefined, name: (l[5] ?? '').trim(), iban: (l[6] ?? '').trim(), amount: amt ? Number(amt[2]) : null, currency: amt ? amt[1] : 'EUR', reference: ((l[9] ?? '').trim() || (l[10] ?? '').trim()), message: (l[11] ?? '').trim() || undefined };
  }
  if (l[0]?.trim() === 'SPC' && /^02\d\d$/.test((l[1] ?? '').trim())) {
    const amount = (l[18] ?? '').trim();
    return { kind: 'swiss', iban: (l[3] ?? '').trim(), name: (l[5] ?? '').trim(), amount: amount ? Number(amount) : null, currency: (l[19] ?? 'CHF').trim() || 'CHF', refType: (l[27] ?? '').trim(), reference: (l[28] ?? '').trim(), message: (l[29] ?? '').trim() || undefined };
  }
  return null;
}

/** Look for a payment QR code in the photo (several sizes; small codes on big photos need the larger one). */
export async function decodeQrFromImage(src: ImageBitmap | HTMLImageElement | HTMLCanvasElement): Promise<PayQr | null> {
  const { default: jsQR } = await import('jsqr');
  const { drawScaled } = await import('./image');
  for (const side of [1600, 1000, 2400]) {
    const c = drawScaled(src, side);
    const d = c.getContext('2d', { willReadFrequently: true })!.getImageData(0, 0, c.width, c.height);
    const r = jsQR(d.data, d.width, d.height, { inversionAttempts: 'dontInvert' });
    if (r?.data) return parsePaymentQr(r.data);
  }
  return null;
}

const RECIPIENT = /(?:zahlungs)?empf[äa]nger(?:in)?|kontoinhaber(?:in)?|beg[üu]nstigter|beneficiary(?: name)?|payee|account (?:holder|name)|b[ée]n[ée]ficiaire|titulaire(?: du compte)?|beneficiario|titular(?: de la cuenta| da conta)?|intestat(?:ario|o a)|benefici[áa]rio/i;
/** The payee printed next to a label like "Empfänger:" / "Beneficiary:" (same line), or null. */
export function findRecipient(text: string): string | null {
  for (const line of text.split('\n')) {
    const m = new RegExp(String.raw`(?:^|\b)(?:${RECIPIENT.source})\s*[:\-–]\s*(.+)$`, 'i').exec(line);
    if (!m) continue;
    const v = m[1].replace(/\b(?:IBAN|BIC|SWIFT)\b.*$/i, '').replace(/[,;]\s*$/, '').trim();
    if (v.length >= 3 && /\p{L}{2}/u.test(v) && !/^[A-Z]{2}\d{2}/.test(v)) return v.slice(0, 70);
  }
  return null;
}
