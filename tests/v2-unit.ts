// Unit tests for the v2 features: personal-data hiding before AI mode, received-date deadlines, payment QR codes,
// bad-photo check, page-quad sanity check, extra reading languages, Easy Language sentences.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PNG } from 'pngjs';
import { redact, restore } from '../src/lib/redact.ts';
import { aiPayload, redactFor } from '../src/lib/ai.ts';
import { receiptRule, computeFromReceipt, applyReceived } from '../src/lib/receipt.ts';
import { makeEpcPayload, parsePaymentQr, findRecipient } from '../src/lib/payqr.ts';
import { checkPhoto } from '../src/lib/photocheck.ts';
import { inkOutsideQuad, type Quad } from '../src/lib/geometry.ts';
import { detectExtraLanguage, detectExtraStrong } from '../src/lib/extract/script.ts';
import { LANG_SAMPLES, charAccuracy } from '../src/lib/lang-samples.ts';
import { withReadLanguage, ruleLang } from '../src/lib/readlang.ts';
import { easySentences, SPEECH_LANG } from '../src/lib/speech.ts';
import { extractRules } from '../src/lib/extract/index.ts';
import { READ_LANGS, RTL_LANGS, TESS_CODE, type DeadlineCalc } from '../src/lib/types.ts';

let n = 0; const ok = (name: string, f: () => void) => { f(); n++; console.log('PASS ', name); };

// ---------------------------------------------------------------- 1. hide personal data
const LETTER = `Stadtkasse München
Herrn Max Mustermann
Lindenstraße 12
80331 München
Aktenzeichen: 702.41.883915.6
Steuer-ID: 12 345 678 901
Geburtsdatum: 14.03.1985
Telefon: +49 89 1234567
E-Mail: max.mustermann@example.de
Kundennummer: 4711-0815
Verwarnungsgeld: 35,00 EUR
Bitte überweisen Sie den Betrag bis zum 19.10.2026.
IBAN: DE89 3704 0044 0532 0130 00`;
const red = redact(LETTER, { known: [{ value: '702.41.883915.6', kind: 'REF' }, { value: 'DE89 3704 0044 0532 0130 00', kind: 'IBAN' }] });
ok('redact: each kind of personal data becomes a placeholder', () => {
  for (const ph of ['[NAME_1]', '[ADDRESS_1]', '[REF_1]', '[TAX_ID_1]', '[BIRTH_DATE_1]', '[PHONE_1]', '[EMAIL_1]', '[ACCOUNT_1]', '[IBAN_1]']) assert.ok(red.text.includes(ph), `${ph} missing in:\n${red.text}`);
  for (const secret of ['Mustermann', 'Lindenstraße 12', '80331', '702.41.883915.6', '12 345 678 901', '14.03.1985', '1234567', 'example.de', '4711-0815', '3704 0044']) assert.ok(!red.text.includes(secret), `${secret} still visible`);
});
ok('redact: deadline, amount and sender authority stay readable (the AI needs them)', () => {
  assert.ok(red.text.includes('19.10.2026')); assert.ok(red.text.includes('35,00 EUR')); assert.ok(red.text.includes('Stadtkasse München'));
});
ok('restore: placeholders in an AI answer are swapped back on the phone, deep in objects', () => {
  const back = restore({ ref: { value: '[REF_1]', snippet: 'Aktenzeichen: [REF_1]' }, list: ['[IBAN_1]'], n: 3 }, red.map);
  assert.equal(back.ref.value, '702.41.883915.6'); assert.equal(back.ref.snippet, 'Aktenzeichen: 702.41.883915.6'); assert.equal(back.list[0], 'DE89 3704 0044 0532 0130 00'); assert.equal(back.n, 3);
  assert.equal(restore('[NAME_9] unknown', red.map), '[NAME_9] unknown');
});
ok('redact: same value twice -> same placeholder; dates are not postcodes', () => {
  const r = redact('IBAN DE89370400440532013000, again DE89370400440532013000. Frist 06.11.2026 Bitte zahlen.', { known: [{ value: 'DE89370400440532013000', kind: 'IBAN' }] });
  assert.equal(r.items.filter((i) => i.kind === 'IBAN').length, 1); assert.ok(r.text.includes('06.11.2026 Bitte'));
});
ok('redact: English, French, Italian and Spanish letters', () => {
  const t = redact('Mrs Jane Smith\n221B Baker Street\nLondon NW1 6XE\nNational Insurance number: QQ 12 34 56 C\nPhone: 020 7946 0958');
  assert.ok(!/Smith|Baker Street|NW1 6XE|QQ 12|7946/.test(t.text), t.text);
  const f = redact('Madame Claire Dubois\n12 rue de la Paix\n75002 Paris\nN° de dossier : 2026-AB-1234');
  assert.ok(!/Dubois|rue de la Paix|75002|2026-AB-1234/.test(f.text), f.text);
  const i = redact('Sig.ra Giulia Rossi\nVia Roma 10\nCodice fiscale: RSSGLI80A41H501U');
  assert.ok(!/Rossi|Via Roma 10|RSSGLI80A41H501U/.test(i.text), i.text);
  const e = redact('Sra. Lucía García\nCalle Mayor 5\nDNI: 12345678Z');
  assert.ok(!/García|Calle Mayor 5|12345678Z/.test(e.text), e.text);
});
ok('AI payload carries only the redacted text, and the reference/IBAN the rules found are hidden even without a label', () => {
  const card = extractRules('Verwarnung\nAktenzeichen: 702.41.883915.6\nVerwarnungsgeld: 35,00 EUR\nbis zum 19.10.2026\nZahlung an DE89 3704 0044 0532 0130 00 mit 702.41.883915.6', { userLanguage: 'en' });
  const r = redactFor(card);
  const body = JSON.stringify(aiPayload(card, r));
  assert.ok(!/702\.41\.883915\.6|DE89 ?3704/.test(body), body.slice(0, 400)); assert.ok(body.includes('[REF_1]') && body.includes('[IBAN_1]'));
});

// ---------------------------------------------------------------- 2. received-date deadlines
const calc = (n: number, unit: DeadlineCalc['unit'], postedIso: string | null): DeadlineCalc => ({ ruleSnippet: `innerhalb von ${n} ${unit}`, n, unit, business: false, direction: 'after', anchor: 'receipt', base: postedIso ? { iso: postedIso, snippet: postedIso, label: 'document date' } : null, resultIso: null });
ok('rule table: Germany verified for tax (AO), benefits/health (SGB X) and fine notices (OWiG); everything else unverified', () => {
  assert.deepEqual(receiptRule('DE', 'tax_office'), { country: 'DE', kind: 'deemed4', verified: true, law: '§ 122 Abs. 2 Nr. 1 AO' });
  assert.equal(receiptRule('DE', 'benefits_office').law, '§ 37 Abs. 2 SGB X');
  assert.equal(receiptRule('DE', 'parking_fine').kind, 'served');
  assert.equal(receiptRule('DE', 'broadcast_fee').verified, false);
  for (const c of ['FR', 'AT', 'GB', 'OTHER']) { const r = receiptRule(c, 'tax_office'); assert.equal(r.verified, false); assert.equal(r.kind, 'actual'); }
});
ok('DE 4-day rule: posted Fri 2 Oct, arrived Mon 5 Oct -> counts from Tue 6 Oct (deemed day), 1 month -> 6 Nov', () => {
  const r = computeFromReceipt(calc(1, 'month', '2026-10-02'), '2026-10-05', '2026-10-02', 'DE', 'tax_office');
  assert.equal(r.startIso, '2026-10-06'); assert.equal(r.resultIso, '2026-11-06'); assert.equal(r.safeIso, '2026-11-06');
  assert.deepEqual(r.steps.map((s) => s.key), ['rcv_posted', 'rcv_deemed', 'rcv_received', 'rcv_start', 'rcv_result']);
});
ok('DE 4-day rule: arrived LATER than the deemed day -> later start, but the safer date (from the deemed day) is kept too', () => {
  const r = computeFromReceipt(calc(1, 'month', '2026-10-02'), '2026-10-09', '2026-10-02', 'DE', 'tax_office');
  assert.equal(r.resultIso, '2026-11-09'); assert.equal(r.safeIso, '2026-11-06'); assert.ok(r.steps.some((s) => s.key === 'rcv_safer'));
});
ok('DE fine notice: two weeks from the service date the user enters', () => {
  const r = computeFromReceipt(calc(2, 'week', null), '2026-10-05', null, 'DE', 'parking_fine');
  assert.equal(r.resultIso, '2026-10-19'); assert.equal(r.steps[0].key, 'rcv_served');
});
ok('other country: counted from the day received, marked unverified', () => {
  const r = computeFromReceipt(calc(30, 'day', null), '2026-10-05', null, 'FR', null);
  assert.equal(r.resultIso, '2026-11-04'); assert.equal(r.rule.verified, false);
});
ok('applyReceived: card deadline becomes the safe date; verified rule -> medium, unverified -> low', () => {
  const card = extractRules('Finanzamt München\nDatum: 02.10.2026\nEinspruch innerhalb von 1 Monat nach Bekanntgabe.', { userLanguage: 'en' });
  assert.equal(card.deadline.calc?.anchor, 'receipt'); assert.equal(card.deadline.calc?.base?.iso, '2026-10-02');
  const base = card;
  const de = applyReceived({ ...base, docType: { ...base.docType, value: 'tax_office' } }, '2026-10-09', 'DE');
  assert.equal(de.deadline.value, '2026-11-06'); assert.equal(de.deadline.confidence, 'medium'); assert.equal(de.received?.iso, '2026-10-09');
  const fr = applyReceived({ ...base, docType: { ...base.docType, value: 'tax_office' } }, '2026-10-09', 'FR');
  assert.equal(fr.deadline.confidence, 'low'); assert.equal(fr.deadline.value, '2026-11-09');
  // letter date unknown: counted from the day the user says it arrived
  const nodate = extractRules('Finanzamt München\nEinspruch innerhalb von 1 Monat nach Bekanntgabe.', { userLanguage: 'en' });
  assert.equal(applyReceived(nodate, '2026-10-09', 'DE').deadline.value, '2026-11-09');
});

// ---------------------------------------------------------------- 3. payment QR
ok('EPC payload (GiroCode): exact lines for IBAN, name, amount and reference', () => {
  const r = makeEpcPayload({ iban: 'DE89 3704 0044 0532 0130 00', name: 'Stadtkasse München', amount: 35, currency: 'EUR', reference: '702.41.883915.6' });
  assert.ok('payload' in r);
  assert.deepEqual(r.payload.split('\n'), ['BCD', '002', '1', 'SCT', '', 'Stadtkasse München', 'DE89370400440532013000', 'EUR35.00', '', '', '702.41.883915.6']);
});
ok('EPC payload: structured RF creditor reference goes in its own field', () => {
  const r = makeEpcPayload({ iban: 'DE89370400440532013000', name: 'X GmbH', amount: 1.5, currency: 'EUR', reference: 'RF18 5390 0754 7034' });
  assert.ok('payload' in r); const l = r.payload.split('\n'); assert.equal(l[9], 'RF18539007547034'); assert.equal(l.length, 10);
});
ok('EPC payload: refuses a bad IBAN, missing name, non-euro and impossible amounts', () => {
  assert.deepEqual(makeEpcPayload({ iban: 'DE89370400440532013001', name: 'X', amount: 1, currency: 'EUR', reference: '' }), { error: 'pq_err_iban' });
  assert.deepEqual(makeEpcPayload({ iban: 'DE89370400440532013000', name: ' ', amount: 1, currency: 'EUR', reference: '' }), { error: 'pq_err_name' });
  assert.deepEqual(makeEpcPayload({ iban: 'DE89370400440532013000', name: 'X', amount: 1, currency: 'GBP', reference: '' }), { error: 'pq_err_currency' });
  assert.deepEqual(makeEpcPayload({ iban: 'DE89370400440532013000', name: 'X', amount: 0, currency: 'EUR', reference: '' }), { error: 'pq_err_amount' });
});
ok('parse EPC payload round trip', () => {
  const r = makeEpcPayload({ iban: 'DE89370400440532013000', name: 'Stadtkasse', amount: 35, currency: 'EUR', reference: 'AZ 1' });
  assert.ok('payload' in r);
  assert.deepEqual(parsePaymentQr(r.payload), { kind: 'epc', bic: undefined, name: 'Stadtkasse', iban: 'DE89370400440532013000', amount: 35, currency: 'EUR', reference: 'AZ 1', message: undefined });
});
ok('parse Swiss QR-bill (SPC 0200) payload', () => {
  const spc = ['SPC', '0200', '1', 'CH4431999123000889012', 'S', 'Robert Schneider AG', 'Rue du Lac', '1268', '2501', 'Biel', 'CH', '', '', '', '', '', '', '', '1949.75', 'CHF', 'S', 'Pia-Maria Rutschmann-Schnyder', 'Grosse Marktgasse', '28', '9400', 'Rorschach', 'CH', 'QRR', '210000000003139471430009017', 'Auftrag vom 15.06.2020', 'EPD'].join('\n');
  const p = parsePaymentQr(spc)!;
  assert.equal(p.kind, 'swiss'); assert.equal(p.iban, 'CH4431999123000889012'); assert.equal(p.name, 'Robert Schneider AG'); assert.equal(p.amount, 1949.75); assert.equal(p.currency, 'CHF'); assert.equal(p.refType, 'QRR'); assert.equal(p.reference, '210000000003139471430009017'); assert.equal(p.message, 'Auftrag vom 15.06.2020');
});
ok('other QR codes (a web link) are ignored', () => { assert.equal(parsePaymentQr('https://example.com/pay'), null); });
ok('recipient found next to its label, not an IBAN', () => {
  assert.equal(findRecipient('Empfänger: Stadtkasse München\nIBAN: DE89'), 'Stadtkasse München');
  assert.equal(findRecipient('Bénéficiaire : Trésor Public'), 'Trésor Public');
  assert.equal(findRecipient('Beneficiary: DE89370400440532013000'), null);
  assert.equal(findRecipient('nothing here'), null);
});

// ---------------------------------------------------------------- 4. photo check + page quad
function load(path: string, side = 600) {
  const png = PNG.sync.read(readFileSync(path));
  const s = side / Math.max(png.width, png.height);
  const w = Math.round(png.width * s), h = Math.round(png.height * s);
  const out = new Uint8ClampedArray(w * h * 4);
  // box downscale
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const x0 = Math.floor(x / s), x1 = Math.max(x0 + 1, Math.floor((x + 1) / s)), y0 = Math.floor(y / s), y1 = Math.max(y0 + 1, Math.floor((y + 1) / s));
    const acc = [0, 0, 0]; let c = 0;
    for (let yy = y0; yy < y1 && yy < png.height; yy++) for (let xx = x0; xx < x1 && xx < png.width; xx++) { const i = (yy * png.width + xx) * 4; acc[0] += png.data[i]; acc[1] += png.data[i + 1]; acc[2] += png.data[i + 2]; c++; }
    const o = (y * w + x) * 4; out[o] = acc[0] / c; out[o + 1] = acc[1] / c; out[o + 2] = acc[2] / c; out[o + 3] = 255;
  }
  return { d: out, w, h };
}
const darken = (img: ReturnType<typeof load>, f: number) => ({ ...img, d: img.d.map((v, i) => (i % 4 === 3 ? 255 : v * f)) as Uint8ClampedArray });
function blur(img: ReturnType<typeof load>, r: number) {
  const { d, w, h } = img; const out = new Uint8ClampedArray(d.length);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) for (let ch = 0; ch < 3; ch++) {
    let s = 0, c = 0;
    for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) { const yy = y + dy, xx = x + dx; if (yy < 0 || xx < 0 || yy >= h || xx >= w) continue; s += d[(yy * w + xx) * 4 + ch]; c++; }
    out[(y * w + x) * 4 + ch] = s / c;
  }
  for (let i = 3; i < out.length; i += 4) out[i] = 255;
  return { d: out, w, h };
}
function crop(img: ReturnType<typeof load>, x0: number, y0: number, cw: number, ch: number) {
  const out = new Uint8ClampedArray(cw * ch * 4);
  for (let y = 0; y < ch; y++) for (let x = 0; x < cw; x++) for (let k = 0; k < 4; k++) out[(y * cw + x) * 4 + k] = img.d[((y + y0) * img.w + x + x0) * 4 + k];
  return { d: out, w: cw, h: ch };
}
function rotate(img: ReturnType<typeof load>, deg: number) {
  const { d, w, h } = img; const out = new Uint8ClampedArray(d.length); const a = (deg * Math.PI) / 180, c = Math.cos(a), s = Math.sin(a);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const sx = Math.round(c * (x - w / 2) + s * (y - h / 2) + w / 2), sy = Math.round(-s * (x - w / 2) + c * (y - h / 2) + h / 2);
    const o = (y * w + x) * 4;
    if (sx < 0 || sy < 0 || sx >= w || sy >= h) { out[o] = out[o + 1] = out[o + 2] = 245; } else for (let k = 0; k < 3; k++) out[o + k] = d[(sy * w + sx) * 4 + k];
    out[o + 3] = 255;
  }
  return { d: out, w, h };
}
const good = load('test-docs/de_parking_ticket.png');
ok('photo check: a clean test document passes', () => { const r = checkPhoto(good.d, good.w, good.h); assert.deepEqual(r.issues, [], JSON.stringify(r)); });
ok('photo check: too dark', () => { const img = darken(good, 0.3); assert.ok(checkPhoto(img.d, img.w, img.h).issues.includes('dark')); });
ok('photo check: blurry', () => { const img = blur(good, 4); const r = checkPhoto(img.d, img.w, img.h); assert.ok(r.issues.includes('blurry'), JSON.stringify(r)); });
ok('photo check: page cut off (text runs into the frame edge)', () => { const img = crop(good, Math.round(good.w * 0.18), 0, Math.round(good.w * 0.6), good.h); const r = checkPhoto(img.d, img.w, img.h); assert.ok(r.issues.includes('cut'), JSON.stringify(r)); });
ok('photo check: strongly tilted', () => { const img = rotate(good, 18); const r = checkPhoto(img.d, img.w, img.h); assert.ok(r.issues.includes('tilted'), JSON.stringify(r)); });
ok('page quad sanity: a quad that cuts through the text (half the page) is flagged, the full page is not', () => {
  const full: Quad = [{ x: 0, y: 0 }, { x: good.w, y: 0 }, { x: good.w, y: good.h }, { x: 0, y: good.h }];
  const half: Quad = [{ x: 0, y: 0 }, { x: good.w, y: 0 }, { x: good.w, y: good.h * 0.4 }, { x: 0, y: good.h * 0.4 }];
  assert.ok(inkOutsideQuad(good.d, good.w, good.h, full) < 0.01); assert.ok(inkOutsideQuad(good.d, good.w, good.h, half) > 0.12);
});

// ---------------------------------------------------------------- 5. extra reading languages
ok('every reading language has an OCR code and a speech code; RTL = ar, fa, ur', () => {
  for (const l of READ_LANGS) { assert.ok(TESS_CODE[l], l); assert.ok(SPEECH_LANG[l], l); }
  assert.deepEqual([...RTL_LANGS], ['ar', 'fa', 'ur']);
});
ok('script detection: each sample letter is recognised as its own language', () => {
  for (const [l, txt] of Object.entries(LANG_SAMPLES)) assert.equal(detectExtraLanguage(txt), l, l);
});
ok('strong detection: Turkish and Polish are not mistaken for German/Portuguese; German/French give null', () => {
  assert.equal(detectExtraStrong(LANG_SAMPLES.tr), 'tr'); assert.equal(detectExtraStrong(LANG_SAMPLES.pl), 'pl');
  assert.equal(detectExtraStrong('Bitte überweisen Sie den Betrag bis zum 19.10.2026 unter Angabe des Aktenzeichens.'), null);
  assert.equal(detectExtraStrong('Veuillez payer le montant avant le 19 octobre 2026.'), null);
});
ok('charAccuracy: identical 100, one wrong character < 100', () => { assert.equal(charAccuracy('abc', 'abc'), 100); assert.ok(charAccuracy('abcdefghij', 'abcdefghiX') < 100); });
ok('read language: extra language recorded, wording-rule language left empty; rule languages unchanged', () => {
  const c = extractRules(LANG_SAMPLES.tr, { userLanguage: 'en' });
  const r = withReadLanguage(c, 'tr'); assert.equal(r.readLanguage, 'tr'); assert.equal(r.docLanguage.value, null);
  assert.equal(withReadLanguage(c, 'de'), c); assert.equal(ruleLang('tr'), null); assert.equal(ruleLang('fr'), 'fr');
  assert.equal(r.amount.value?.amount, 35);
});

// ---------------------------------------------------------------- 6. Easy Language
ok('Easy Language: short sentences with type, deadline, money, reference and the next step, in the chosen language', () => {
  const c = extractRules(readFileSync('tests/fixtures/ocr-text.json', 'utf8') && JSON.parse(readFileSync('tests/fixtures/ocr-text.json', 'utf8'))['de_parking_ticket.png'], { userLanguage: 'en' });
  const en = easySentences(c, 'en');
  assert.ok(en.length >= 5 && en.every((s) => s.length < 220), en.join(' | '));
  assert.ok(en.some((s) => /35/.test(s)) && en.some((s) => /702\.41\.883915\.6/.test(s)), en.join(' | '));
  const ar = easySentences(c, 'ar'); assert.ok(ar.every((s) => /[\u0600-\u06FF]/.test(s)), ar.join(' | '));
  const zh = easySentences(c, 'zh'); assert.ok(zh.some((s) => /[\u4E00-\u9FFF]/.test(s)));
});

console.log(`\n${n} v2 checks passed`);
