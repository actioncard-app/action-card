// Round-4 polish: own-language unknown letters, Clear doc type on strong matches with the cleanest full line as quote,
// fresh load opens Home, PDF/calendar names say LetterScan.
import { readFileSync } from 'node:fs';
import { extractRules } from '../src/lib/extract/index';
let pass = 0, fail = 0;
const check = (name: string, ok: boolean, info?: unknown) => { ok ? pass++ : fail++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}`, ok ? '' : JSON.stringify(info)); };
const q = (t: string, ul = 'en') => extractRules(t, { userLanguage: ul as never });
const LETTERS = {
  school: 'PIKEVILLE ELEMENTARY SCHOOL\n\nDear Parent or Guardian,\n\nOur fall field trip to the science museum\n\nis on Friday, 20 Nov 2026.\n\nPlease sign and return the permission slip\nby 13 Nov 2026. There is no cost to families.\nThank you, Mrs. Hall',
  k1234: 'KENTUCKY POWER CO.\nElectric bill - October 2026\nAccount: 88-4410\n\nAmount due: $1,234.56\nPlease pay by 28 Nov 2026.',
  nodollar: 'EAST KY GAS\n\nGas bill - October 2026\nAccount: 77-2231\n\nTotal due: 84.50\n\nPlease pay by 30 Nov 2026.',
  five: 'CITY WATER DEPARTMENT\nWater bill - October 2026\nAccount: 55-1023\n\nAmount due: $5.00\n\nPlease pay by 25 Nov 2026.',
  sample: 'CITYWATERE POWER\n\nNOTICE F PAST DUE BALANCE\n\nAccount 000-000-0000 (SAMPLE)\n\nCustomer. Jane Sample\n\nAmountdue: $84.50\n\nPay by November 20, 2026\nPayonline or call avoid service ints ruption.\nAlate fee of $10 appliesaftsr due date.',
};
// 1. own language vs foreign language
let c = q(LETTERS.school);
check('school letter (English, app in English): no "ask someone who reads the language"', !/reads the language/.test(c.nextAction.text) && /Read what this letter asks you to do by 13 November 2026/.test(c.nextAction.text), c.nextAction.text);
c = q(LETTERS.school.replace(/\b(by )?13 Nov 2026\.?/, '').replace(/is on Friday, 20 Nov 2026\./, 'is next month.'));
check('own-language letter without a date: "and by when"', /Read what this letter asks you to do and by when/.test(c.nextAction.text), c.nextAction.text);
const de = 'Sehr geehrte Damen und Herren,\nwir bitten Sie, das beiliegende Formular bis zum 20.11.2026 zurückzusenden.\nMit freundlichen Grüßen';
c = q(de);
check('German letter, app in English: keeps "ask someone who reads the language"', c.docLanguage.value === 'de' && /reads the language/.test(c.nextAction.text), c.nextAction.text);
c = q(de, 'de');
check('German letter, app in German: own-language wording', /Lesen Sie, was dieses Schreiben bis/.test(c.nextAction.text), c.nextAction.text);
const fr = JSON.parse(readFileSync('tests/fixtures/ocr-text.json', 'utf8'))['fr_residence_permit_letter.png'];
c = q(fr);
check('existing French letter (known type) still gets its own next step in English', c.docType.value !== 'unknown' && !/Read what this letter/.test(c.nextAction.text), [c.docType.value, c.nextAction.text]);
// 2. Clear type + full, clean quote
for (const [k, quote] of [['k1234', 'Electric bill - October 2026'], ['nodollar', 'Gas bill - October 2026'], ['five', null], ['sample', 'NOTICE F PAST DUE BALANCE']] as const) {
  c = q(LETTERS[k]);
  check(`${k}: utility bill, Clear`, c.docType.value === 'utility_bill' && c.docType.confidence === 'high', c.docType);
  const lines = LETTERS[k].split('\n').map((l) => l.trim());
  check(`${k}: quote is one whole OCR line${quote ? ` ("${quote}")` : ''}`, !!c.docType.snippet && lines.includes(c.docType.snippet) && (!quote || c.docType.snippet === quote), c.docType.snippet);
}
// 5. names
const pdf = readFileSync('src/lib/pdf.ts', 'utf8'), share = readFileSync('src/lib/share.ts', 'utf8');
check('PDF file name starts with letterscan-', /`letterscan-\$\{/.test(pdf) && !/action-card-\$\{/.test(pdf));
check('calendar UID says letterscan', /@letterscan`/.test(share));
console.log(`${pass} polish checks passed, ${fail} failed`);
if (fail) process.exit(1);
