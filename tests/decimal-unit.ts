// Dropped decimal point ("$84.50" read as "$8450") must never be shown as a confident amount.
import { extractRules } from '../src/lib/extract/index';
import { readFileSync } from 'node:fs';
import { statedAmount } from '../src/lib/extract/index';
import { recoverDecimal, suspectAmountWord } from '../src/lib/decimaldot';
const base = (a: string) => `CITY WATER & POWER\nNOTICE OF PAST DUE BALANCE\nAccount: 000-000-0000 (SAMPLE)\nCustomer: Jane Sample\n${a}\nPay by: November 20, 2026\nPay online or call to avoid service interruption.\nA late fee of $10 applies after due date.`;
let pass = 0, fail = 0;
const check = (name: string, ok: boolean, info?: unknown) => { ok ? pass++ : fail++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}`, ok ? '' : JSON.stringify(info)); };
const card = (a: string) => extractRules(base(a), { userLanguage: 'en' as never });
let c = card('Amountdue: $8450');
check('"$8450" is low confidence, keeps both readings (alt 84.50) and says to check the letter', c.amount.confidence === 'low' && c.amount.value?.alt === 84.5 && /Check the letter.*84\.50/.test(c.amount.note ?? ''), c.amount);
check('doubtful amount is not stated as fact (statedAmount null)', statedAmount(c.amount) === null);
check('doubtful amount is not in the next step', !/8,?450|84\.50/.test(c.nextAction.text), c.nextAction.text);
check('an edited amount is stated', statedAmount({ ...c.amount, edited: true }) !== null);
for (const a of ['Amount due: $84.50', 'Amount due: $84 50', 'Amount due: $84,50']) {
  c = card(a);
  check(`${a} reads 84.50`, c.amount.value?.amount === 84.5 && !/decimal point may be missing/.test(c.amount.note ?? ''), c.amount);
}
c = card('Amount due: $8400');
check('"$8400" (ends in 00) is not flagged', !/decimal point may be missing/.test(c.amount.note ?? ''), c.amount);
check('past-due water & power notice is a utility bill, not Unknown', c.docType.value === 'utility_bill', c.docType);
// the exact OCR text Tesseract reads from /workspace/qa/sample-letter.png (garbled "WATER & POWER", "interruption")
const ocrSample = 'CITYWATERE POWER\n\nNOTICE F PAST DUE BALANCE\n\nAccount 000-000-0000 (SAMPLE)\n\nCustomer. Jane Sample\n\nAmountdue: $8450\n\nPay by November 20, 2026\nPayonline or call avoid service ints ruption.\nAlate fee of $10 appliesaftsr due date.';
c = extractRules(ocrSample, { userLanguage: 'en' as never });
check('garbled OCR of the sample past-due notice is a utility bill', c.docType.value === 'utility_bill', c.docType);
// cross-check: another amount on the page with exactly the cents reading settles it
c = extractRules(base('Amount due: $8450') + '\nPrevious balance: $84.50', { userLanguage: 'en' as never });
check('"$8450" with a "$84.50" elsewhere on the page reads 84.50', c.amount.value?.amount === 84.5 && c.amount.value?.alt === undefined, c.amount);
for (const [a, v, cur] of [['Amount due: $5.00', 5, 'USD'], ['Amount due: $1,234.56', 1234.56, 'USD'], ['Amount due: $8,450.00', 8450, 'USD'], ['Betrag: 1.234,56 €', 1234.56, 'EUR'], ['Amount due: 84.50 USD', 84.5, 'USD']] as const) {
  c = card(a);
  check(`${a} reads ${v} ${cur}, one reading`, c.amount.value?.amount === v && c.amount.value?.currency === cur && c.amount.value?.alt === undefined, c.amount.value);
}
// decimal point recovered from the pixels (tests/fixtures/decimal-crop-sample.txt: the "$8450" word of
// /workspace/qa/sample-letter.png after the app's preprocessing; # dark, + grey, . white)
const grid = (rows: string[]) => ({ w: rows[0].length, h: rows.length, g: rows.join('').split('').map((ch) => ch === '#' ? 0 : ch === '+' ? 150 : 255) });
const crop = grid(readFileSync('tests/fixtures/decimal-crop-sample.txt', 'utf8').trim().split('\n'));
check('sample crop: visible dot -> "$84.50"', recoverDecimal(crop.g, crop.w, crop.h, '$8450') === '$84.50');
const noDot = grid(readFileSync('tests/fixtures/decimal-crop-sample.txt', 'utf8').trim().split('\n').map((r) => r.slice(0, 22) + '...' + r.slice(25)));
check('same crop with the dot erased -> no change', recoverDecimal(noDot.g, noDot.w, noDot.h, '$8450') === null);
check('glyph count not matching the text -> no change', recoverDecimal(crop.g, crop.w, crop.h, '$84500') === null);
check('not an amount word -> no change', recoverDecimal(crop.g, crop.w, crop.h, 'abc') === null);
check('suspect words: $8450 yes, $8400 no, 8450 no', suspectAmountWord('$8450') && !suspectAmountWord('$8400') && !suspectAmountWord('8450'));
// Human Tester's letters (OCR text read by the app from /workspace/qa/letter-*.png)
const QA = {
  k1234: 'KENTUCKY POWER CO.\nElectric bill - October 2026\nAccount: 88-4410\n\nAmount due: $1,234.56\nPlease pay by 28 Nov 2026.',
  nodollar: 'EAST KY GAS\n\nGas bill - October 2026\nAccount: 77-2231\n\nTotal due: 84.50\n\nPlease pay by 30 Nov 2026.',
  five: 'CITY WATER DEPARTMENT\nWater bill - October 2026\nAccount: 55-1023\n\nAmount due: $5.00\n\nPlease pay by 25 Nov 2026.',
};
const q = (t: string) => extractRules(t, { userLanguage: 'en' as never });
c = q(QA.k1234);
check('letter-1234: electric bill is a utility bill, $1,234.56 Clear', c.docType.value === 'utility_bill' && c.amount.value?.amount === 1234.56 && c.amount.value?.currency === 'USD' && c.amount.confidence === 'high', [c.docType, c.amount]);
c = q(QA.nodollar);
check('letter-nodollar: "Total due: 84.50" reads 84.50, no currency, Check this, with a currency note', c.amount.value?.amount === 84.5 && c.amount.value?.currency === '' && c.amount.confidence === 'medium' && /currency/.test(c.amount.note ?? ''), c.amount);
check('letter-nodollar: a Check-this amount is not stated in the summary/next step', statedAmount(c.amount) === null && !/84\.50/.test(c.nextAction.text));
check('letter-nodollar: gas bill is a utility bill', c.docType.value === 'utility_bill', c.docType);
c = q(QA.five);
check('letter-5: $5.00 Clear, utility bill', c.amount.value?.amount === 5 && c.amount.confidence === 'high' && c.docType.value === 'utility_bill', [c.docType, c.amount]);
c = q('Account: 12345.67\nPhone 555.12\nDate 30.11.2026\nZip 40502\nInvoice no. 4410.22\nPlease pay by 30.11.2026');
check('no money label: account, phone, date, zip and invoice numbers are not money', c.amount.value === null, c.amount);
c = q('Total due: 84.50\nLate fee: €10.00');
check('bare amount takes the document currency when another amount shows it', c.amount.value?.amount === 84.5 && c.amount.value?.currency === 'EUR', c.amount);
for (const [t, v] of [['Betrag: 35,50', 35.5], ['Montant à payer : 1 234,56', 1234.56], ['Importe a pagar: 12,30', 12.3], ['Totale da pagare: 7,00', 7], ['Valor a pagar: 19,90', 19.9]] as const) {
  c = q(t);
  check(`bare amount "${t}" reads ${v}`, c.amount.value?.amount === v, c.amount);
}
// recovered sample text (pixels gave "$84.50"): Clear, stated
c = extractRules(ocrSample.replace('$8450', '$84.50'), { userLanguage: 'en' as never });
check('sample with the decimal recovered: $84.50 Clear (OCR-run-together "Amountdue" is a cue)', c.amount.value?.amount === 84.5 && c.amount.confidence === 'high', c.amount);
// cross-check agreement is at least Check this, not Guess
c = extractRules(base('Amount due: $8450') + '\nPrevious balance: $84.50', { userLanguage: 'en' as never });
check('cross-checked amount is not a Guess', c.amount.confidence !== 'low', c.amount);
console.log(`${pass} decimal checks passed, ${fail} failed`);
if (fail) process.exit(1);
