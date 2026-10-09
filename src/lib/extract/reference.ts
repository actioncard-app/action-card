import type { Field } from '../types';
import { fold, foldDoc, phraseRe, snippetFor } from './normalize';

// Labels that introduce a case / booking / file number (folded).
const LABELS = [
  'aktenzeichen', 'az', 'kassenzeichen', 'buchungsnummer', 'vorgangsnummer', 'rechnungsnummer', 'vertragsnummer',
  'booking reference', 'booking ref', 'reservation confirmation', 'booking confirmation', 'confirmation', 'confirmation code', 'booking number', 'reservation number', 'confirmation number', 'reference number', 'reference', 'ref', 'case number', 'pcn',
  'numero de dossier', 'dossier', 'numero de reservation', 'reference de reservation', 'reservation', 'numero d\'avis', 'numero de l\'avis',
  'contrato', 'contrato de arrendamento', 'contrato de arrendamiento', 'contrato de alquiler', 'numero de contrato', 'contratto di locazione', 'contratto', 'expediente', 'numero de expediente', 'referencia', 'localizador', 'numero de reserva', 'reserva',
  'prenotazione', 'numero di prenotazione', 'codice prenotazione', 'verbale', 'pratica', 'numero pratica',
  'processo', 'numero do processo', 'verbale di accertamento', 'mietvertrag', 'vertrag', 'zeichen', 'unser zeichen', 'ihr zeichen', 'geschaftszeichen', 'auto', 'auto de contraordenacao',
  'solicitud', 'numero de solicitud', 'application', 'application number', 'antrag', 'antragsnummer', 'demande', 'domanda', 'pedido', 'tenancy ref', 'tenancy reference',
];
const reLabel = phraseRe(LABELS);

export function findReference(text: string): Field<string> {
  const f = foldDoc(text);
  reLabel.lastIndex = 0;
  const r = new RegExp(reLabel.source, 'g');
  let m: RegExpExecArray | null;
  while ((m = r.exec(f))) {
    const after = text.slice(m.index + m[0].length, m.index + m[0].length + 40);
    // optional "n.", "nº", "no.", ":" then the code (must contain a digit, >= 4 chars)
    // OCR often turns "n.º"/"nº" into "n.2" / "n.o" / "n°" / "ne", so accept those.
    // "1"/"l"/"|" alone before the code is also a misread "nº".
    const v = /^\s*(?:(?:n|nr|no|num|ne|n\.º)\.?\s*(?:[º°o?*](?![a-z])|[29](?=\s*:))?\.?|nº|n°|#|[1l|](?=\s+[A-Z]{2,}[./-]?\d))?\s*[:.]?\s*([A-Z0-9][A-Z0-9./-]{3,}[A-Z0-9])/i.exec(after);
    const val = v?.[1];
    // a usable code on the label's own line
    const inline = v && val && /\d/.test(val) && !/^\d{1,2}[./-]\d{1,2}[./-]\d{2,4}$/.test(val) && !v[0].slice(0, v[0].length - val.length).includes('\n');
    if (!inline) {
      // two-column layouts: "Aktenzeichen:" ends the line and the code sits on the next text line
      const rest = text.slice(m.index + m[0].length);
      const nl = /^\s*[:#]?[^\S\n]*\n\s*([^\n]*)/.exec(rest);
      const code = nl ? [...nl[1].matchAll(/(?:^|\s)([A-Z0-9][A-Z0-9./-]{4,}[A-Z0-9])(?=\s|$)/gi)]
        .find((t) => (t[1].match(/\d/g) ?? []).length >= 4 && !/^\d{1,2}[./-]\d{1,2}[./-]\d{2,4}$/.test(t[1])) : undefined;
      if (code) {
        const start = m.index + m[0].length + nl!.index + nl![0].length - nl![1].length + nl![1].indexOf(code[1]);
        return { value: code[1], snippet: snippetFor(text, m.index, start + code[1].length), confidence: 'low', note: 'Label and number were on different lines; check it matches the original.' };
      }
      continue;
    }
    const start = m.index + m[0].length + after.indexOf(val!);
    return { value: val!, snippet: snippetFor(text, m.index, start + val!.length), confidence: 'medium' };
  }
  return { value: null, snippet: null, confidence: null };
}

const DOSE_CUES = ['posologie', 'posologia', 'posología', 'dosage', 'dosierung', 'dosis', 'directions', 'how to take', 'anwendung', 'mode d\'emploi', 'modo de empleo', 'modo d\'uso', 'modo de usar', 'dose'];
const reDose = phraseRe(DOSE_CUES.map((s) => fold(s)));

/** Medicine labels: quote the label's own dosing text verbatim. Never generated, never advice. */
export function findLabelQuote(text: string): Field<string> {
  const f = foldDoc(text);
  reDose.lastIndex = 0;
  const m = new RegExp(reDose.source).exec(f);
  if (!m) return { value: null, snippet: null, confidence: null };
  const ls = text.split('\n');
  let pos = 0, i = 0;
  for (; i < ls.length; i++) { if (m.index < pos + ls[i].length + 1) break; pos += ls[i].length + 1; }
  // Tesseract often puts blank lines between lines: skip blanks, take up to 5 text lines,
  // stop at the next label section (lot / expiry / storage warning).
  const STOP = /^(lot|lotto|lote|ch\.?-?b|exp|scad|cad|val|verwendbar|tenir|keep|conservare|mantener|manter|aufbewahren|arzneimittel f)/i;
  const out: string[] = [];
  let blanks = 0;
  for (let j = i; j < ls.length && out.length < 5; j++) {
    const t = ls[j].trim();
    if (!t) { if (++blanks >= 3) break; continue; }
    if (j > i && STOP.test(fold(t))) break;
    blanks = 0;
    out.push(t);
  }
  const quote = out.join(' ');
  return { value: quote, snippet: quote, confidence: 'medium', note: 'Quoted from the label as read by OCR; it may be incomplete or misread. Read the full label and leaflet. Not dosing advice.' };
}
