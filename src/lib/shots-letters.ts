// Fake sample letters for the App Store screenshots (screenshot builds only, see src/lib/shots.ts). Every authority,
// company, person, plate, IBAN (valid check digits, invented bank) and number is made up. Drawn on a canvas on the phone,
// like the in-app sample, so the repository stays free of binary images.
export interface Letter { header: string; sub?: string; band?: string; title?: string; lines: string[]; w: number; h: number; bg: string; serif?: boolean; tilt: number }

export const LETTERS: Record<string, Letter> = {
  de_parking: {
    w: 1100, h: 1560, bg: '#fffce8', tilt: 0,
    header: 'Stadt Musterhausen', sub: 'Ordnungsamt - Verkehrsüberwachung', title: 'Verwarnung mit Verwarnungsgeld',
    lines: [
      'Aktenzeichen: 431.08.552917.3', 'Kennzeichen: MH-LS 2026', 'Tatzeit: 14.10.2026, 11:20 Uhr', 'Tatort: Bahnhofstraße 18, Musterhausen', '',
      'Sie parkten ohne gültigen Parkschein.', '', 'Verwarnungsgeld: 35,00 EUR', '',
      'Bitte überweisen Sie den Betrag bis zum 06.11.2026', 'unter Angabe des Aktenzeichens.', '',
      'Empfänger: Stadtkasse Musterhausen', 'IBAN: DE19 1234 5678 0000 4321 00', '',
      'Wird das Verwarnungsgeld nicht fristgerecht', 'bezahlt, wird ein Bußgeldverfahren eingeleitet.', '',
      'Ausgestellt am 14.10.2026, Dienstnummer 2210',
    ],
  },
  es_residence: {
    w: 1240, h: 1754, bg: '#fcfbf7', tilt: -0.5, serif: true,
    header: 'OFICINA DE EXTRANJERÍA DE VILLANUEVA', sub: 'Sección de Autorizaciones de Residencia',
    lines: [
      'Asunto: Cita para la toma de huellas (TIE)', 'Expediente n.º: EX-2026/48213', '', 'Estimado/a Sr./Sra.:', '',
      'Le comunicamos que su cita para la toma de huellas', 'es el día 19 de noviembre de 2026, a las 9:40.', '',
      'Antes de la cita deberá abonar la tasa modelo 790', 'código 012 por importe de 16,08 EUR y presentar el', 'justificante de pago antes del 12/11/2026.', '',
      'Traiga su pasaporte y una fotografía reciente.', 'Si no acude, deberá solicitar una nueva cita.', '',
      'Atentamente,', 'La Oficina de Extranjería', '', 'Villanueva, 15 de octubre de 2026',
    ],
  },
  it_flight: {
    w: 1240, h: 1500, bg: '#ffffff', tilt: 0.4, band: '#173a5e',
    header: 'Volarea Airlines', title: 'Il suo volo è stato cancellato',
    lines: [
      'Codice prenotazione: VK4R9T', 'Volo VA 1182  Milano Linate (LIN) - Napoli (NAP)', 'Partenza: 18/11/2026, 07:05', '',
      'Ci scusiamo: il volo è stato cancellato per motivi', 'operativi.', '',
      'Può scegliere una nuova prenotazione gratuita', 'oppure il rimborso completo di 189,90 EUR', 'sul metodo di pagamento originale.', '',
      'Invii la richiesta di rimborso o di nuova prenotazione', 'entro il 30/11/2026 dalla sezione Gestisci prenotazione.', '',
      'Potrebbe avere diritto anche a una compensazione', 'ai sensi del Regolamento (CE) n. 261/2004.', '', 'Il Servizio Clienti Volarea',
    ],
  },
};

export async function letterFile(id: string): Promise<File> {
  const L = LETTERS[id];
  const pad = 40, W = L.w + pad * 2, H = L.h + pad * 2;
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const g = c.getContext('2d')!;
  g.fillStyle = '#cdc8c0'; g.fillRect(0, 0, W, H); // table under the paper
  g.save(); g.translate(W / 2, H / 2); g.rotate((L.tilt * Math.PI) / 180); g.translate(-L.w / 2, -L.h / 2);
  g.fillStyle = L.bg; g.fillRect(0, 0, L.w, L.h);
  const sans = 'Arial, Helvetica, "DejaVu Sans", sans-serif', serif = 'Georgia, "Times New Roman", "DejaVu Serif", serif';
  const body = L.serif ? serif : sans;
  let y: number;
  if (L.band) {
    g.fillStyle = L.band; g.fillRect(0, 0, L.w, 120);
    g.fillStyle = '#ffffff'; g.font = `bold 46px ${sans}`; g.fillText(L.header, 60, 78); y = 200;
  } else {
    g.fillStyle = L.serif ? '#5a1414' : '#000000';
    if (!L.serif) { g.lineWidth = 3; g.strokeStyle = '#000'; g.strokeRect(40, 40, L.w - 80, 110); }
    g.font = `bold ${L.serif ? 34 : 38}px ${sans}`; g.fillText(L.header, 60, 92);
    if (L.sub) { g.font = `25px ${sans}`; g.fillText(L.sub, 60, 134); }
    y = 230;
  }
  g.fillStyle = '#191919';
  if (L.title) { g.font = `bold 38px ${sans}`; g.fillText(L.title, 60, y); y += 80; }
  g.font = `${L.serif ? 31 : 30}px ${body}`;
  for (const ln of L.lines) { if (ln) g.fillText(ln, 60, y); y += L.serif ? 46 : 44; }
  const shade = g.createLinearGradient(0, 0, 0, L.h); shade.addColorStop(0, 'rgba(0,0,0,0)'); shade.addColorStop(1, 'rgba(60,50,40,0.12)');
  g.fillStyle = shade; g.fillRect(0, 0, L.w, L.h);
  g.restore();
  const blob = await new Promise<Blob>((ok, bad) => c.toBlob((b) => (b ? ok(b) : bad(new Error('canvas'))), 'image/jpeg', 0.92));
  return new File([blob], `${id}.jpg`, { type: 'image/jpeg' });
}
