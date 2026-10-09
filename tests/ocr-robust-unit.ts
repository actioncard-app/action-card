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
if (fails) { console.error(`${fails} test(s) failed`); process.exit(1); }
console.log('All OCR-robustness tests passed');
