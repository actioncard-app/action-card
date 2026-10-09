// Unit tests for OCR-robustness rules: junk-line filter, keyword repair, "§"-read-as-"$", misread "nº".
// Usage: npx tsx tests/ocr-robust-unit.ts
import { dejunkLine, foldDoc, cleanOcr } from '../src/lib/extract/normalize.ts';
import { extractRules } from '../src/lib/extract/index.ts';

let fails = 0;
const eq = (name: string, got: unknown, exp: unknown) => {
  const ok = JSON.stringify(got) === JSON.stringify(exp);
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${ok ? '' : `: got ${JSON.stringify(got)}, expected ${JSON.stringify(exp)}`}`);
  if (!ok) fails++;
};
eq('edge symbols stripped', dejunkLine('| Total 225€ ]'), 'Total 225€');
eq('junk line dropped', dejunkLine('ï j'), '');
eq('symbol-only line dropped', dejunkLine("-~=_'.,|"), '');
eq('short number kept', dejunkLine('12'), '12');
eq('currency line kept', dejunkLine('€ 5'), '€ 5');
eq('normal line kept', dejunkLine('EXP : 03/2028'), 'EXP : 03/2028');
eq('cleanOcr drops junk lines', cleanOcr('Hotel Roma\n| -"\nTotale 50 €'), 'Hotel Roma\n\nTotale 50 €');
const s = 'Ausiinderbehürde rovembre Auferthaltstitel Butte';
eq('foldDoc keeps length', foldDoc(s).length, s.length);
eq('foldDoc repairs misread keywords', foldDoc(s), 'auslanderbehorde novembre aufenthaltstitel butte');
eq('foldDoc leaves unknown words alone', foldDoc('Sachbearbeitung Wohnung'), 'sachbearbeitung wohnung');
const card = (t: string) => { const c = extractRules(t, { userLanguage: 'en' }); return [c.docType.value, c.deadline.value, c.amount.value && `${c.amount.value.amount} ${c.amount.value.currency}`, c.reference.value]; };
eq('"§" read as "$" is not money; rn->m misread cue still found',
  card('Sie parkten im Halteverbot,\n$ 41 Abs. 1 iVm Anlage 2, $ 49 StVO\nVerwamungsgeld: 35,00 EUR\nBitte überweisen Sie den Betrag bis zum\n19.10.2026'),
  ['parking_fine', '2026-10-19', '35 EUR', null]);
eq('real dollar amount still read', card('Parking ticket\nAmount due: $ 45.00 by 10/20/2026')[2], '45 USD');
eq('"n.º" read as "n.9"', card('Contrato n.9: ALQ-2026-0917\nFianza depositada: 1.700,00 €')[3], 'ALQ-2026-0917');
eq('"nº" read as "1"', card('Arrendatario: Lukas Contrato 1 ALQ/26/3381\nFianza 1.800,00 €')[3], 'ALQ/26/3381');
eq('"2.850.00" (comma read as dot)', card('Mietkaution (3 Kaltmieten) 2.850.00€\nKaltmiete monatlich 950,00 €')[2], '2850 EUR');
eq('lost decimal separator "£214 60"', card('Your flight was cancelled.\nRefund to original payment: £214 60')[2], '214.6 GBP');
eq('licence plate "$1" is not money', card('Auto n.º 77120483\nMatrícula 23XR $1\nOoma: 60,00 €')[2], '60 EUR');
eq('a stray "1" alone is not money', card('Hotel Roma\nCamera 1 €')[2], null);
eq('impossible month repaired (EXP 62/2028)', card('Eye Drops 0.5% w/v\nDirections: 1 drop\nLOT B2271\nEXP 62/2028')[1], '2028-02-29');
eq('far-off year repaired when other dates agree', card('Fecha: 01/10/2026\nEntrada: 1 de noviembre de 2026\nPague antes del 27/10/2076')[1], '2026-10-27');
eq('real later year kept when nothing agrees', card('Visa valid until 15/03/2036')[1] !== '2026-03-15', true);
if (fails) { console.error(`${fails} test(s) failed`); process.exit(1); }
console.log('All OCR-robustness tests passed');
