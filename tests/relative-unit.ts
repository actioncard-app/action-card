// Unit checks for relative deadlines (no OCR). Usage: npx tsx tests/relative-unit.ts
import { findDeadline } from '../src/lib/extract/dates.ts';
const cases: [string, string, string | null, string][] = [
  ['en', 'Date of notice: 02/10/2026\nPay within 14 days of the date of this notice.', '2026-10-16', 'issue +14d'],
  ['de', 'Datum: 01.10.2026\nZahlen Sie innerhalb von 14 Tagen.', '2026-10-15', 'de innerhalb'],
  ['de', 'Einspruch ist innerhalb von zwei Wochen nach Zustellung möglich.', null, 'receipt, no issue date'],
  ['fr', 'Lyon, le 25 septembre 2026\nVous devez répondre dans un délai de 15 jours.', '2026-10-10', 'fr dateline'],
  ['es', 'Fecha de emisión: 05/10/2026\nPuede presentar alegaciones en un plazo de 20 días hábiles.', '2026-11-02', 'es business days'],
  ['it', 'Data: 01/10/2026\nIl pagamento deve avvenire entro 60 giorni dalla notifica.', '2026-11-30', 'it receipt from issue'],
  ['pt', 'Lisboa, 01 de outubro de 2026\nDeve responder no prazo de 30 dias.', '2026-10-31', 'pt'],
  ['en', 'Arrival: 14/11/2026\nFree cancellation up to 48 hours before arrival.', '2026-11-12', 'hours before arrival'],
  ['en', 'Free cancellation up to 48 hours before arrival.', null, 'no arrival date'],
  ['fr', 'Prendre 1 comprimé toutes les 6 heures. Ne pas utiliser plus de 3 jours.', null, 'medicine, not deadline'],
  ['en', 'Pay by 19.10.2026. You may appeal within 14 days of receipt.', '2026-10-19', 'absolute wins'],
  ['fr', 'Paris, le 1 octobre 2026\nPayez dans un délai de 15 jours à\ncompter de la date du présent avis.', '2026-10-16', 'fr "à" at line end kept'],
  ['it', 'Arrivo: 20/11/2026\ncancellazione gratuita fino a 72 ore E\ni prima dell\'arrivo.', '2026-11-17', 'OCR margin noise between lines'],
  ['en', 'Sent: Friday, 2 October 2026 14:05\nFlight Route Date Status\nHZ 418 LGW 19 Oct 2026\nRequest it within 28 days of this email.', '2026-10-30', 'email sent date, table header "Date" ignored'],
  ['pt', 'Exmo. Senhor Lisboa, 28 de setembro de 2026\nDeve responder no prazo de 30 dias a contar da data desta carta.', '2026-10-28', 'dateline after other column text'],
];
let ok = 0;
for (const [lang, text, exp, name] of cases) {
  const r = findDeadline(text, 'unknown', lang);
  const pass = r.field.value === exp;
  if (pass) ok++;
  console.log(`${pass ? 'PASS' : 'FAIL'} ${name}: got ${r.field.value} (${r.field.confidence}) exp ${exp}${r.field.calc ? ' calc=' + JSON.stringify({ a: r.field.calc.anchor, base: r.field.calc.base?.iso, n: r.field.calc.n, u: r.field.calc.unit }) : ''} others=${r.others.length}`);
}
console.log(`${ok}/${cases.length}`);
process.exit(ok === cases.length ? 0 : 1);
