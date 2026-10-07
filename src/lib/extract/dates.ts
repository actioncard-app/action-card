import type { Confidence, DateSeen, DeadlineCalc, DeadlineKind, DocType, Field, OtherDeadline } from '../types';
import { findRelativeDeadlines } from './relative';
import { fold, phraseRe, nearestCueBefore, snippetFor, lines, lineAt } from './normalize';

// Month names (folded) in en, de, fr, es, it, pt, incl. common abbreviations.
const MONTHS: [string, number][] = [];
const add = (m: number, ...names: string[]) => names.forEach((n) => MONTHS.push([n, m]));
add(1, 'january', 'jan', 'januar', 'janner', 'janvier', 'janv', 'enero', 'ene', 'gennaio', 'gen', 'janeiro');
add(2, 'february', 'feb', 'februar', 'feber', 'fevrier', 'fevr', 'fev', 'febrero', 'febbraio', 'fevereiro');
add(3, 'march', 'mar', 'marz', 'maerz', 'mars', 'marzo', 'marco');
add(4, 'april', 'apr', 'avril', 'avr', 'abril', 'abr', 'aprile');
add(5, 'may', 'mai', 'mayo', 'maggio', 'mag', 'maio');
add(6, 'june', 'jun', 'juni', 'juin', 'junio', 'giugno', 'giu', 'junho');
add(7, 'july', 'jul', 'juli', 'juillet', 'juil', 'julio', 'luglio', 'lug', 'julho');
add(8, 'august', 'aug', 'aout', 'agosto', 'ago');
add(9, 'september', 'sept', 'sep', 'septembre', 'septiembre', 'setiembre', 'settembre', 'set', 'setembro');
add(10, 'october', 'oct', 'oktober', 'okt', 'octobre', 'octubre', 'ottobre', 'ott', 'outubro', 'out');
add(11, 'november', 'nov', 'novembre', 'noviembre', 'novembro');
add(12, 'december', 'dec', 'dezember', 'dez', 'decembre', 'diciembre', 'dic', 'dicembre', 'dezembro');
const MONTH_MAP = new Map(MONTHS);
const MONTH_ALT = [...MONTH_MAP.keys()].sort((a, b) => b.length - a.length).join('|');

export interface DateCand { iso: string; start: number; end: number; raw: string; precision: 'day' | 'month'; ambiguous: boolean }

function valid(y: number, m: number, d: number) {
  if (m < 1 || m > 12 || d < 1 || y < 1990 || y > 2100) return false;
  return d <= new Date(Date.UTC(y, m, 0)).getUTCDate();
}
const pad = (n: number) => String(n).padStart(2, '0');
const iso = (y: number, m: number, d: number) => `${y}-${pad(m)}-${pad(d)}`;
const lastDay = (y: number, m: number) => new Date(Date.UTC(y, m, 0)).getUTCDate();
const yr = (s: string) => (s.length === 2 ? 2000 + Number(s) : Number(s));

/** Fix common OCR confusions inside digit groups (O->0, l/I->1) without changing length. */
function digitFix(f: string): string {
  return f.replace(/(?<=\d)[oO](?=\d)|(?<=\d[./-])[oO]|[oO](?=\d[./-]\d)/g, '0').replace(/(?<=\d)[lI|](?=\d)/g, '1');
}

export function findDates(text: string, opts: { englishUS?: boolean } = {}): DateCand[] {
  const f = digitFix(fold(text));
  const out: DateCand[] = [];
  const taken: [number, number][] = [];
  const push = (c: DateCand) => {
    if (taken.some(([a, b]) => c.start < b && c.end > a)) return;
    taken.push([c.start, c.end]);
    out.push(c);
  };
  let m: RegExpExecArray | null;
  // 1) ISO yyyy-mm-dd
  const reIso = /(?<!\d)((?:19|20)\d{2})[-./](\d{1,2})[-./](\d{1,2})(?!\d)/g;
  while ((m = reIso.exec(f))) {
    const [y, mo, d] = [+m[1], +m[2], +m[3]];
    if (valid(y, mo, d)) push({ iso: iso(y, mo, d), start: m.index, end: m.index + m[0].length, raw: text.slice(m.index, m.index + m[0].length), precision: 'day', ambiguous: false });
  }
  // 2) written: 7 novembre 2026 / 15 de octubre de 2026 / 30. Oktober 2026 / 26 October 2026 / 12 Oct 2026
  const reW = new RegExp(`(?<!\\d)(\\d{1,2})(?:\\.|º|°|er|st|nd|rd|th)?\\s*(?:de\\s+|of\\s+)?(${MONTH_ALT})\\.?,?\\s*(?:de\\s+|del\\s+)?((?:19|20)\\d{2})(?!\\d)`, 'g');
  while ((m = reW.exec(f))) {
    const [d, mo, y] = [+m[1], MONTH_MAP.get(m[2])!, +m[3]];
    if (valid(y, mo, d)) push({ iso: iso(y, mo, d), start: m.index, end: m.index + m[0].length, raw: text.slice(m.index, m.index + m[0].length), precision: 'day', ambiguous: false });
  }
  // 3) English: October 26, 2026 / Oct 26 2026
  const reE = new RegExp(`(?<![a-z])(${MONTH_ALT})\\.?\\s+(\\d{1,2})(?:st|nd|rd|th)?,?\\s+((?:19|20)\\d{2})(?!\\d)`, 'g');
  while ((m = reE.exec(f))) {
    const [mo, d, y] = [MONTH_MAP.get(m[1])!, +m[2], +m[3]];
    if (valid(y, mo, d)) push({ iso: iso(y, mo, d), start: m.index, end: m.index + m[0].length, raw: text.slice(m.index, m.index + m[0].length), precision: 'day', ambiguous: false });
  }
  // 4) numeric d.m.y / d/m/y / d-m-y (2- or 4-digit year)
  const reN = /(?<![\d.,/])(\d{1,2})\s?([./-])\s?(\d{1,2})\s?\2\s?((?:19|20)?\d{2})(?![\d])/g;
  while ((m = reN.exec(f))) {
    const a = +m[1], b = +m[3], y = yr(m[4]);
    let d = a, mo = b, ambiguous = false;
    if (a <= 12 && b <= 12 && a !== b) {
      ambiguous = true; // could be dd/mm or mm/dd
      if (opts.englishUS && m[2] === '/') { d = b; mo = a; }
    } else if (b > 12 && a <= 12) { d = b; mo = a; }
    if (valid(y, mo, d)) push({ iso: iso(y, mo, d), start: m.index, end: m.index + m[0].length, raw: text.slice(m.index, m.index + m[0].length), precision: 'day', ambiguous });
  }
  // 5) month/year only (typical medicine expiry: EXP 03/2028, 2028-03) -> last day of month
  const reMY = /(?<![\d./-])(\d{1,2})\s?[./-]\s?((?:19|20)\d{2})(?![\d./-])/g;
  while ((m = reMY.exec(f))) {
    const mo = +m[1], y = +m[2];
    if (mo >= 1 && mo <= 12) push({ iso: iso(y, mo, lastDay(y, mo)), start: m.index, end: m.index + m[0].length, raw: text.slice(m.index, m.index + m[0].length), precision: 'month', ambiguous: false });
  }
  const reYM = /(?<![\d./-])((?:19|20)\d{2})\s?[./-]\s?(\d{1,2})(?![\d./-])/g;
  while ((m = reYM.exec(f))) {
    const y = +m[1], mo = +m[2];
    if (mo >= 1 && mo <= 12) push({ iso: iso(y, mo, lastDay(y, mo)), start: m.index, end: m.index + m[0].length, raw: text.slice(m.index, m.index + m[0].length), precision: 'month', ambiguous: false });
  }
  // written month + year only: "EXP: MAR 2028"
  const reWMY = new RegExp(`(?<![a-z\\d])(${MONTH_ALT})\\.?\\s*((?:19|20)\\d{2})(?!\\d)`, 'g');
  while ((m = reWMY.exec(f))) {
    const mo = MONTH_MAP.get(m[1])!, y = +m[2];
    push({ iso: iso(y, mo, lastDay(y, mo)), start: m.index, end: m.index + m[0].length, raw: text.slice(m.index, m.index + m[0].length), precision: 'month', ambiguous: false });
  }
  return out.sort((a, b) => a.start - b.start);
}

// ---- deadline cues (folded) ----
const DEADLINE_CUES = [
  // en
  'until', 'by', 'before', 'no later than', 'not later than', 'due', 'due date', 'due by', 'deadline', 'payable by', 'pay by', 'expires', 'expires on', 'within', 'latest',
  // de
  'bis', 'bis zum', 'bis spatestens', 'spatestens', 'spatestens am', 'spatestens bis', 'zahlbar bis', 'frist', 'zahlungsfrist', 'fallig am', 'fallig', 'innerhalb',
  // fr
  'avant', 'avant le', 'au plus tard', 'au plus tard le', 'jusqu\'au', 'jusqu au', 'date limite', 'd\'ici le', 'echeance', 'a regler avant', 'delai',
  // es
  'antes', 'antes de', 'antes del', 'a mas tardar', 'hasta', 'hasta el', 'plazo', 'fecha limite', 'vence', 'vencimiento',
  // it
  'entro', 'entro il', 'entro e non oltre', 'scadenza', 'termine', 'non oltre', 'prima del',
  // pt
  'ate', 'ate ao dia', 'ate dia', 'prazo', 'o mais tardar', 'data limite', 'antes de',
];
const EXPIRY_CUES = ['exp', 'expiry', 'expiry date', 'use by', 'use before', 'best before', 'verwendbar bis', 'verw. bis', 'verw bis', 'haltbar bis', 'verfall', 'a utiliser avant', 'utiliser avant', 'peremption', 'date de peremption', 'cad', 'caducidad', 'fecha de caducidad', 'scad', 'scadenza', 'da usare entro', 'val', 'validade', 'prazo de validade', 'usar antes de'];
const WEAK_APPT_CUES = ['el dia', 'il giorno', 'o dia', 'le jour', 'on the day', 'am tag'];
const APPOINTMENT_CUES = ['appointment', 'interview', 'scheduled for', 'termin', 'vorsprache', 'rendez-vous', 'convocation', 'cita', 'cita previa', 'appuntamento', 'colloquio', 'marcada para', 'entrevista', 'agendado para', 'agendada para'];
const NEGATIVE_CUES = [
  'tatzeit', 'tattag', 'tatdatum', 'datum des bescheids', 'bescheiddatum', 'ausgestellt', 'ausgestellt am', 'ausstellungsdatum', 'datum', 'geburtsdatum', 'geboren', 'abflug', 'ankunft', 'anreise', 'abreise', 'einzug',
  'date of issue', 'issued', 'issued on', 'date of birth', 'born', 'departure', 'arrival', 'check-in', 'check-out', 'move-in date', 'offence date', 'date of offence', 'dated', 'date',
  'date d\'emission', 'emis le', 'ne le', 'date de naissance', 'depart', 'arrivee', 'date de l\'infraction', 'fait le',
  'fecha de emision', 'fecha de entrada', 'fecha de nacimiento', 'fecha', 'salida', 'llegada', 'fecha de la denuncia',
  'data di emissione', 'data di nascita', 'arrivo', 'partenza', 'data del verbale', 'emesso il',
  'data de emissao', 'data de nascimento', 'partida', 'chegada', 'data',
];
const reDeadline = phraseRe(DEADLINE_CUES);
const reExpiry = phraseRe(EXPIRY_CUES);
const reAppt = phraseRe(APPOINTMENT_CUES);
const reWeakAppt = phraseRe(WEAK_APPT_CUES);
const reNeg = phraseRe(NEGATIVE_CUES);

function prox(dist: number): number {
  if (dist <= 12) return 1;
  if (dist <= 30) return 0.8;
  if (dist <= 60) return 0.5;
  return 0.25;
}

export interface DeadlineResult { field: Field<string> & { kind: DeadlineKind; calc?: DeadlineCalc }; seen: DateSeen[]; others: OtherDeadline[] }

function findAbsoluteDeadline(text: string, docType: DocType, cands: DateCand[]): { field: Field<string> & { kind: DeadlineKind }; score: number; seen: DateSeen[] } {
  const f = digitFix(fold(text));
  const ls = lines(text);
  const seen: DateSeen[] = cands.map((c) => ({ iso: c.iso, snippet: snippetFor(text, c.start, c.end), precision: c.precision }));
  const notFound = { field: { value: null, snippet: null, confidence: null, kind: (docType === 'medicine_label' ? 'expiry' : 'deadline') as DeadlineKind }, seen, score: 0 };
  if (!cands.length) return notFound;

  type Scored = { c: DateCand; score: number; kind: DeadlineKind; cueStart?: number; dist: number; cue?: string };
  const scored: Scored[] = cands.map((c, i) => {
    // only look back to the previous date (a cue before an earlier date belongs to that date)
    const prevEnd = i > 0 ? cands[i - 1].end : 0;
    const window = Math.min(90, c.start - prevEnd);
    const dl = nearestCueBefore(f, c.start, reDeadline, window);
    const ex = nearestCueBefore(f, c.start, reExpiry, window);
    const ap = nearestCueBefore(f, c.start, reAppt, Math.min(window, 70));
    const wa = nearestCueBefore(f, c.start, reWeakAppt, Math.min(window, 20));
    const ng = nearestCueBefore(f, c.start, reNeg, Math.min(window, 40));
    let best: Scored = { c, score: 0, kind: 'deadline', dist: 999 };
    if (dl) best = { c, score: 3 * prox(dl.dist), kind: 'deadline', cueStart: dl.start, dist: dl.dist, cue: dl.cue };
    if (ex) {
      const s = (docType === 'medicine_label' ? 3.2 : 1.5) * prox(ex.dist);
      if (s > best.score) best = { c, score: s, kind: 'expiry', cueStart: ex.start, dist: ex.dist, cue: ex.cue };
    }
    if (ap) {
      const s = (docType === 'visa_entry' ? 1.2 : 0.8) * prox(ap.dist);
      if (s > best.score) best = { c, score: s, kind: 'appointment', cueStart: ap.start, dist: ap.dist, cue: ap.cue };
    }
    if (wa) {
      const s = (docType === 'visa_entry' ? 0.9 : 0.6) * prox(wa.dist);
      if (s > best.score) best = { c, score: s, kind: 'appointment', cueStart: wa.start, dist: wa.dist, cue: wa.cue };
    }
    // a negative cue closer than the positive cue (e.g. "Tatzeit: 28.09.2026") cancels it
    if (ng && (best.dist === 999 || ng.dist < best.dist)) best.score -= 2;
    // letter dateline like "Lyon, le 25 septembre 2026" / "Lisboa, 01 de outubro de 2026"
    const li = ls[lineAt(ls, c.start)];
    if (/^\s*[A-ZÀ-Ý][\p{L}\- ]{1,30},\s*(le|den|am|il)?\s*$/u.test(text.slice(li.start, c.start))) best.score -= 2;
    // month-only dates are only plausible as expiry dates
    if (c.precision === 'month' && best.kind !== 'expiry') best.score -= 1.5;
    if (c.ambiguous) best.score -= 0.3;
    return best;
  });

  const positive = scored.filter((s) => s.score > 0.4).sort((a, b) => b.score - a.score);
  if (!positive.length) return notFound;
  const top = positive[0];
  const runner = positive[1];
  const strongCue = top.score >= 2.3;
  let confidence: Confidence = strongCue ? 'high' : top.score >= 1.2 ? 'medium' : 'low';
  if (runner && runner.score >= top.score - 0.5 && runner.c.iso !== top.c.iso) confidence = confidence === 'high' ? 'medium' : 'low';
  if (top.c.ambiguous && confidence === 'high') confidence = 'medium';
  const notes: string[] = [];
  if (top.c.ambiguous) notes.push('Day/month order is ambiguous in this format; check the original.');
  if (top.c.precision === 'month') notes.push('Only month and year printed; shown as the last day of that month.');
  if (top.kind === 'appointment') notes.push('This looks like an appointment date, not a payment/reply deadline.');
  return {
    field: {
      value: top.c.iso,
      snippet: snippetFor(text, top.c.start, top.c.end, top.cueStart),
      confidence,
      kind: top.kind,
      note: notes.join(' ') || undefined,
    },
    seen,
    score: top.score,
  };
}

export function findDeadline(text: string, docType: DocType, docLang: string | null): DeadlineResult {
  const cands = findDates(text, { englishUS: docLang === 'en' && /\$|usd/i.test(text) });
  const abs = findAbsoluteDeadline(text, docType, cands);
  const rel = findRelativeDeadlines(text, cands);
  const others: OtherDeadline[] = [];
  const strongAbsolute = abs.field.value !== null && abs.score >= 1.2 && abs.field.kind !== 'appointment';
  if (strongAbsolute || !rel.length) {
    for (const r of rel) others.push({ iso: r.iso, kind: 'deadline', snippet: r.calc.ruleSnippet, calc: r.calc, note: r.note || undefined });
    return { field: abs.field, seen: abs.seen, others };
  }
  // No explicit dated deadline: use the relative one. Prefer one we could compute; among those the earliest.
  const sorted = [...rel].sort((a, b) => (a.iso ? 0 : 1) - (b.iso ? 0 : 1) || (a.iso ?? '').localeCompare(b.iso ?? ''));
  const main = sorted[0];
  for (const r of sorted.slice(1)) others.push({ iso: r.iso, kind: 'deadline', snippet: r.calc.ruleSnippet, calc: r.calc, note: r.note || undefined });
  if (abs.field.value) others.push({ iso: abs.field.value, kind: abs.field.kind, snippet: abs.field.snippet ?? '', note: abs.field.note });
  const snippet = main.calc.base ? `${main.calc.ruleSnippet}  ‖  ${main.calc.base.snippet}` : main.calc.ruleSnippet;
  return {
    field: { value: main.iso, snippet, confidence: main.confidence, kind: 'deadline', calc: main.calc, note: main.note || undefined },
    seen: abs.seen,
    others,
  };
}
