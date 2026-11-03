// Dropped decimal point ("$84.50" read as "$8450") must never be shown as a confident amount.
import { extractRules } from '../src/lib/extract/index';
const base = (a: string) => `CITY WATER & POWER\nNOTICE OF PAST DUE BALANCE\nAccount: 000-000-0000 (SAMPLE)\nCustomer: Jane Sample\n${a}\nPay by: November 20, 2026\nPay online or call to avoid service interruption.\nA late fee of $10 applies after due date.`;
let pass = 0, fail = 0;
const check = (name: string, ok: boolean, info?: unknown) => { ok ? pass++ : fail++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}`, ok ? '' : JSON.stringify(info)); };
const card = (a: string) => extractRules(base(a), { userLanguage: 'en' as never });
let c = card('Amountdue: $8450');
check('"$8450" is low confidence with a Check-this note naming 84.50', c.amount.confidence === 'low' && /Check this.*84\.50/.test(c.amount.note ?? ''), c.amount);
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
console.log(`${pass} decimal checks passed, ${fail} failed`);
if (fail) process.exit(1);
