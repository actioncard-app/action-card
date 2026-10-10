// Unit tests for the trust panel: money direction, no-payment wording, what needs checking, steps, glossary.
import { extractRules } from '../src/lib/extract';
import { moneyDirection, needsChecking, glossTerms, hasContact } from '../src/lib/trust';
import { stepsFor, toggleStep, STEP_TEMPLATES } from '../src/lib/steps';
import { summaryText } from '../src/lib/share';
import { makeT } from '../src/lib/i18n';
import { LANGS, DOC_TYPES } from '../src/lib/types';

let fails = 0;
const eq = (name: string, got: unknown, exp: unknown) => {
  const ok = JSON.stringify(got) === JSON.stringify(exp);
  if (!ok) fails++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok ? '' : `  got ${JSON.stringify(got)} expected ${JSON.stringify(exp)}`}`);
};
const dir = (text: string) => moneyDirection(extractRules(text, { userLanguage: 'en' })).value;

// one sentence per language and direction
eq('de pay', dir('Bußgeldbescheid\nBitte zahlen Sie 35,00 € bis zum 19.10.2026.'), 'pay');
eq('fr refund', dir('Vol annulé\nLe remboursement de 184,90 € sera versé sur votre carte.'), 'refund');
eq('es deposit', dir('Contrato de alquiler\nFianza: 1.700,00 €'), 'deposit');
eq('it fee', dir('Prenotazione hotel\nIn caso di cancellazione verrà addebitata una penale di 145,00 €.'), 'fee');
eq('pt deposit', dir('Arrendamento\nCaução: 1.900,00 €'), 'deposit');
eq('en refund beats "payment method"', dir('Flight cancelled\nRefund of GBP 312.40 to your original payment method.'), 'refund');
eq('de deposit beats transfer wording on the same line', dir('Mietvertrag\nMietkaution 2.850,00 € bitte überweisen'), 'deposit');
eq('receipt total: unclear (never guess)', dir('Ristorante\nTOTALE EUR 45,00\nGrazie'), 'unclear');
eq('no amount: unclear, no snippet', moneyDirection(extractRules('Termin am 12.11.2026', { userLanguage: 'en' })).snippet, null);
const near = moneyDirection(extractRules('Stornierung\nDanach berechnen wir eine Stornogebühr\nvon 80 % des Gesamtpreises (729,60 EUR).', { userLanguage: 'en' }));
eq('cue on the line above: medium confidence', [near.value, near.confidence], ['fee', 'medium']);
const np = moneyDirection(extractRules('Flight HZ 422 is moved by 20 minutes.\nNo payment is required from you.\nTicket value £214.60', { userLanguage: 'en' }));
eq('no payment requested detected', np.noPayment, 'No payment is required from you.');
eq('no payment in German', moneyDirection(extractRules('Es ist keine Zahlung erforderlich.', { userLanguage: 'en' })).noPayment, 'Es ist keine Zahlung erforderlich.');

// what needs checking
const fine = extractRules('Verwarnungsgeld\nBitte zahlen Sie 35,00 € bis zum 19.10.2026 \nAktenzeichen: 702.41.883915.6\nIBAN DE12 3456 7890 1234 5678 90', { userLanguage: 'en', ocrConfidence: 92 });
eq('clean fine: nothing to check', needsChecking(fine), []);
const bare = extractRules('Hotel\nTotal 120,00 €', { userLanguage: 'en', ocrConfidence: 50 });
const items = needsChecking(bare);
for (const k of ['chk_no_deadline', 'chk_direction_unclear', 'chk_no_reference', 'chk_no_contact', 'chk_ocr_low']) eq(`bare doc flags ${k}`, items.includes(k as never), true);
const edited = { ...bare, deadline: { ...bare.deadline, value: '2026-11-01', edited: true } };
eq('edited deadline is not flagged', needsChecking(edited).includes('chk_no_deadline'), false);
const receipt = extractRules('Notifica del verbale\nPagamento entro 5 giorni dalla notifica: 29,40 €\nData del verbale 03/10/2026', { userLanguage: 'en' });
eq('receipt-relative deadline flagged', needsChecking(receipt).some((k) => k === 'chk_from_receipt' || k === 'chk_start_unknown'), true);
eq('contact: email', hasContact('Write to info@example.org'), true);
eq('contact: none', hasContact('Total 12,00 €'), false);

// steps: 2-4 per type, every language, {date} filled or avoided
for (const type of DOC_TYPES) {
  const n = STEP_TEMPLATES[type].length;
  eq(`${type}: 2-4 steps`, n >= 2 && n <= 4, true);
  for (const L of LANGS) for (const date of [null, '2026-10-19']) {
    const c = { ...fine, userLanguage: L, docType: { ...fine.docType, value: type }, deadline: { ...fine.deadline, value: date } };
    const s = stepsFor(c);
    if (s.some((x) => !x || x.includes('{'))) { fails++; console.log(`FAIL  ${type}/${L}/${date}: ${JSON.stringify(s)}`); }
  }
}
eq('steps carry the date', stepsFor(fine)[1], 'Pay by 19 October 2026, quoting the reference number.');
const t1 = toggleStep(toggleStep(fine, 2), 0);
eq('ticks stored per card', t1.stepsDone, [0, 2]);
eq('untick', toggleStep(t1, 2).stepsDone, [0]);
eq('original card untouched', fine.stepsDone, undefined);
const share = summaryText(t1, 'Fine', (i) => i, (a, c) => `${a} ${c}`, makeT('en'));
eq('share: direction + ticked steps', [share.includes('35 EUR (You pay)'), share.includes('[x] Check the date'), share.includes('[ ] Pay by')], [true, true, true]);

// glossary: recognised words only, longer phrase wins, reading order
eq('gloss de', glossTerms('Bitte überweisen Sie den Betrag bis zum 19.10.2026 unter Angabe des Aktenzeichens').map(([, c]) => c), ['g_transfer', 'g_amount', 'g_by']);
eq('gloss keeps the printed word', glossTerms('Fianza depositada: 1.700,00 €')[0], ['Fianza', 'g_deposit']);
eq('gloss: nothing recognised', glossTerms('xyz 123'), []);

console.log(fails ? `\n${fails} FAILED` : '\nall trust tests passed');
process.exit(fails ? 1 : 0);
