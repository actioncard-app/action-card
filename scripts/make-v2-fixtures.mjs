// Builds the test inputs for tests/e2e-v2.mjs into test-results/v2-fixtures (not committed):
//  - a text-layer PDF of a German tax notice whose objection period runs "from notification" (received-date box)
//  - the sample parking ticket with an EPC payment QR (different IBAN -> mismatch warning) and with a Swiss QR-bill
//  - a too-dark copy of the parking ticket (bad-photo warning)
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { PNG } from 'pngjs';
import QRCode from 'qrcode';

const OUT = 'test-results/v2-fixtures';
mkdirSync(OUT, { recursive: true });

// --- minimal PDF with a real text layer (Helvetica, WinAnsi; umlauts as octal escapes)
function pdf(lines) {
  const esc = (s) => s.replace(/[\\()]/g, (c) => '\\' + c).replace(/[^\x20-\x7e]/g, (c) => '\\' + c.charCodeAt(0).toString(8).padStart(3, '0'));
  const content = 'BT /F1 12 Tf 60 780 Td 16 TL\n' + lines.map((l) => `(${esc(l)}) Tj T*`).join('\n') + '\nET';
  const objs = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>',
    `<< /Length ${Buffer.byteLength(content, 'latin1')} >>\nstream\n${content}\nendstream`,
  ];
  let body = '%PDF-1.4\n'; const offs = [];
  objs.forEach((o, i) => { offs.push(Buffer.byteLength(body, 'latin1')); body += `${i + 1} 0 obj\n${o}\nendobj\n`; });
  const x = Buffer.byteLength(body, 'latin1');
  body += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n` + offs.map((o) => String(o).padStart(10, '0') + ' 00000 n \n').join('') + `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${x}\n%%EOF\n`;
  return Buffer.from(body, 'latin1');
}
writeFileSync(`${OUT}/de_steuerbescheid_bekanntgabe.pdf`, pdf([
  'Finanzamt München',
  'Deroystraße 18, 80335 München',
  'Datum: 02.10.2026',
  'Bescheid für 2025 über Einkommensteuer',
  'Steuernummer: 143/123/45678',
  'Festgesetzte Einkommensteuer: 1.240,00 EUR',
  'Rechtsbehelfsbelehrung',
  'Gegen diesen Bescheid ist der Einspruch zulässig.',
  'Der Einspruch ist innerhalb von 1 Monat nach Bekanntgabe',
  'dieses Bescheids beim Finanzamt München einzulegen.',
]));

// --- PNG helpers
const base = PNG.sync.read(readFileSync('test-docs/de_parking_ticket.png'));
const clone = () => { const p = new PNG({ width: base.width, height: base.height }); base.data.copy(p.data); return p; };
async function withQr(payload, file) {
  const qr = PNG.sync.read(await QRCode.toBuffer(payload, { errorCorrectionLevel: 'M', margin: 2, width: 300 }));
  const img = clone();
  const x0 = img.width - qr.width - 40, y0 = img.height - qr.height - 40;
  for (let y = 0; y < qr.height; y++) for (let x = 0; x < qr.width; x++) {
    const s = (y * qr.width + x) * 4, d = ((y + y0) * img.width + x + x0) * 4;
    for (let k = 0; k < 4; k++) img.data[d + k] = qr.data[s + k];
  }
  writeFileSync(`${OUT}/${file}`, PNG.sync.write(img));
}
await withQr(['BCD', '002', '1', 'SCT', '', 'Stadtkasse München', 'DE89370400440532013000', 'EUR35.00', '', '', '702.41.883915.6'].join('\n'), 'de_parking_epc_qr.png');
await withQr(['SPC', '0200', '1', 'CH4431999123000889012', 'S', 'Robert Schneider AG', 'Rue du Lac', '1268', '2501', 'Biel', 'CH', '', '', '', '', '', '', '', '1949.75', 'CHF', 'S', 'Pia Rutschmann', 'Marktgasse', '28', '9400', 'Rorschach', 'CH', 'QRR', '210000000003139471430009017', 'Auftrag vom 15.06.2026', 'EPD'].join('\n'), 'ch_qr_bill.png');
const dark = clone();
for (let i = 0; i < dark.data.length; i += 4) for (let k = 0; k < 3; k++) dark.data[i + k] = Math.round(dark.data[i + k] * 0.28);
writeFileSync(`${OUT}/de_parking_dark.png`, PNG.sync.write(dark));
console.log('v2 fixtures written to', OUT);
