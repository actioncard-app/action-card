// Unit tests for v1 features: IBAN, summary, hints/help, new doc types, UI languages, PDF import helpers, Vision mock.
import assert from 'node:assert/strict';
import { findIban, findIbans, validIban, ibanChecksumOk } from '../src/lib/extract/iban.ts';
let n = 0; const ok = (name: string, f: () => void) => { f(); n++; console.log('PASS ', name); };

ok('IBAN checksum: known valid DE/GB/FR/ES/IT/PT', () => {
  for (const s of ['DE89370400440532013000', 'GB82WEST12345698765432', 'FR1420041010050500013M02606', 'ES9121000418450200051332', 'IT60X0542811101000000123456', 'PT50000201231234567890154']) assert.ok(validIban(s), s);
});
ok('IBAN checksum: one changed digit fails', () => { assert.equal(validIban('DE89370400440532013001'), false); assert.equal(ibanChecksumOk('DE88370400440532013000'), false); });
ok('IBAN found with spaces + label, high confidence', () => {
  const f = findIban('Bitte überweisen Sie den Betrag.\nIBAN: DE89 3704 0044 0532 0130 00\nBIC: COBADEFFXXX');
  assert.equal(f.value, 'DE89 3704 0044 0532 0130 00'); assert.equal(f.confidence, 'high');
});
ok('IBAN with OCR O->0 in German BBAN is repaired', () => { assert.equal(findIban('IBAN DE89 37O4 0044 0532 0130 00').value, 'DE89 3704 0044 0532 0130 00'); });
ok('IBAN with a misread digit: shown low + not valid', () => {
  const f = findIban('IBAN: DE89 3704 0044 0532 0130 08'); assert.equal(f.confidence, 'low'); assert.equal(validIban(f.value!), false);
});
ok('IBAN does not run into the next word', () => { const h = findIbans('IBAN ES91 2100 0418 4502 0005 1332 BIC CAIXESBBXXX'); assert.equal(h[0].value, 'ES9121000418450200051332'); });
ok('no IBAN in a parking ticket', () => { assert.equal(findIban('Kennzeichen B-AB 1234 Tatzeit 28.09.2026').value, null); });

function done() { console.log(`\n${n} v1 checks passed`); }

// ---- summary + hints ----
import { extractRules } from '../src/lib/extract/index.ts';
import { summaryParts } from '../src/lib/summary.ts';
import { scamHints, guessCountry, HELP } from '../src/lib/hints.ts';
import { tr } from '../src/lib/i18n.ts';
const fmt = { date: (i: string) => i, money: (a: number, c: string) => `${a} ${c}`, type: 'X', lang: 'German' };
const card = (txt: string) => extractRules(txt, { userLanguage: 'en' });
ok('summary: pay by date', () => {
  const c = card('Stadt Köln Bußgeldstelle\nVerwarnungsgeld 35,00 €\nBitte zahlen Sie bis zum 19.10.2026.\nAktenzeichen: 702.41.883915.6');
  const [a, b] = summaryParts(c, fmt);
  assert.equal(a.key, 'sum_intro'); assert.equal(b.key, 'sum_pay_by');
  assert.equal(tr('en', b.key, b.vars), 'It asks you to pay 35 EUR by 2026-10-19.');
});
ok('summary: nothing found', () => { const [, b] = summaryParts(card('Hallo Welt'), fmt); assert.equal(b.key, 'sum_none'); });
ok('summary: refund', () => {
  const c = card('Your flight BA123 was cancelled. You will receive a full refund of €212.40 to your card. Request it by 30 October 2026.');
  assert.match(summaryParts(c, fmt)[1].key, /^sum_refund/, JSON.stringify([c.amount.value, c.docType.value]));
});
ok('hints: clean letter has none', () => {
  const c = card('Finanzamt München\nSteuernummer 21/815/30477\nNachzahlung 1.284,00 €\nbis 16.11.2026 auf IBAN DE89 3704 0044 0532 0130 00\nwww.elster.de');
  assert.deepEqual(scamHints(c), []);
});
ok('hints: gift card + threat + 24h + freemail + lookalike', () => {
  const c = card('Finanzamt Steuerprüfung\nZahlen Sie innerhalb von 24 Stunden 500 € mit Google Play Gift Karten (google play gift card).\nSonst droht ein Haftbefehl.\nKontakt: finanzamt.zahlung@gmail.com\nwww.finanzamt-zahlung-online.com');
  const k = scamHints(c).map((h) => h.key);
  for (const want of ['hint_giftcard', 'hint_threat', 'hint_rush', 'hint_freemail', 'hint_lookalike']) assert.ok(k.includes(want as never), want + ' in ' + k);
});
ok('hints: crypto, short link, IP link', () => {
  const k = scamHints(card('HMRC tax refund. Pay the fee in Bitcoin at http://192.168.4.20/pay or bit.ly/x7Yz9')).map((h) => h.key);
  for (const want of ['hint_crypto', 'hint_iplink', 'hint_shortlink']) assert.ok(k.includes(want as never), want + ' in ' + k);
});
ok('hints: official German letter with Lithuanian IBAN + private holder', () => {
  const iban = 'LT12 1000 0111 0100 1000';
  const k = scamHints(card(`Beitragsservice ARD ZDF\nSehr geehrte Damen und Herren, bitte zahlen Sie den Rundfunkbeitrag für die Wohnung bis zum 15.11.2026.\nRundfunkbeitrag 55,08 €\nKontoinhaber: Max Mustermann\nIBAN: ${iban}`)).map((h) => h.key);
  assert.ok(k.includes('hint_iban_country'), String(k)); assert.ok(k.includes('hint_personal_account'), String(k));
});
ok('hints: real company holder is fine', () => {
  const k = scamHints(card('Stadtwerke Leipzig GmbH Stromrechnung\nKontoinhaber: Stadtwerke Leipzig GmbH\nIBAN DE89 3704 0044 0532 0130 00')).map((h) => h.key);
  assert.deepEqual(k, []);
});
ok('help: country guess from IBAN, then language; every link https', () => {
  assert.equal(guessCountry(card('Rechnung IBAN AT61 1904 3002 3457 3201 Betrag 10,00 €')), 'AT');
  assert.equal(guessCountry(card('Bonjour, votre facture est disponible. Montant à payer : 10,00 €')), 'FR');
  for (const h of HELP) assert.match(h.url, /^https:\/\//);
});

// ---- Apple Vision JS side (the Swift plugin itself is unverified: no Mac) ----
import { linesToText, meanConfidence, visionOcr, type VisionPlugin } from '../src/lib/vision.ts';
ok('vision: lines ordered top-to-bottom, same row joined left-to-right', () => {
  const t = linesToText([
    { text: '35,00 €', confidence: 0.9, x: 0.7, y: 0.30, w: 0.15, h: 0.03 },
    { text: 'Betrag', confidence: 0.9, x: 0.1, y: 0.305, w: 0.2, h: 0.03 },
    { text: 'Stadt Köln', confidence: 0.95, x: 0.1, y: 0.05, w: 0.3, h: 0.04 },
  ]);
  assert.equal(t, 'Stadt Köln\nBetrag   35,00 €');
});
ok('vision: confidence is length-weighted 0..100', () => { assert.equal(meanConfidence([{ text: 'aaaa', confidence: 1, x: 0, y: 0, w: 0, h: 0 }, { text: 'bbbb', confidence: 0.5, x: 0, y: 0, w: 0, h: 0 }]), 75); });
await (async () => {
  // mock plugin: records the request; FileReader is not in Node, so give a tiny shim
  (globalThis as any).FileReader ??= class { result: string | null = null; onload: any; onerror: any; readAsDataURL(b: Blob) { b.arrayBuffer().then((a) => { this.result = 'data:image/jpeg;base64,' + Buffer.from(a).toString('base64'); this.onload(); }); } };
  let seen: any = null;
  const mock: VisionPlugin = { recognize: async (o) => { seen = o; return { lines: [{ text: 'Bitte zahlen Sie bis 19.10.2026', confidence: 0.8, x: 0.1, y: 0.1, w: 0.5, h: 0.03 }], width: 100, height: 100, languages: o.languages }; }, supportedLanguages: async () => ({ languages: [] }) };
  const r = await visionOcr(new Blob([new Uint8Array([1, 2, 3])]), 'de', mock);
  ok('vision mock: chosen language first, base64 without data: prefix, text returned', () => {
    assert.equal(seen.languages[0], 'de-DE'); assert.ok(seen.languages.includes('en-US')); assert.equal(seen.image, 'AQID');
    assert.equal(r.text, 'Bitte zahlen Sie bis 19.10.2026'); assert.equal(r.confidence, 80);
  });
})();
done();
