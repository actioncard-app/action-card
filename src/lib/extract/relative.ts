/**
 * Relative deadlines: "within 14 days", "innerhalb von 14 Tagen", "dans un délai de 15 jours",
 * "en un plazo de 20 días", "entro 60 giorni", "no prazo de 30 dias", "48 hours before arrival"...
 * The date is computed ONLY from a start date printed in the document itself (issue date, arrival
 * date, ...). Today's date is never used as the start date.
 */
import type { Confidence, DeadlineCalc } from '../types';
export type { DeadlineCalc };
import { fold, phraseRe, nearestCueBefore, snippetFor, lines, lineAt } from './normalize';
import type { DateCand } from './dates';

const NUM_WORDS: Record<string, number> = {
  // en
  a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, fourteen: 14, fifteen: 15, twenty: 20, 'twenty-one': 21, thirty: 30, sixty: 60, ninety: 90,
  // de
  ein: 1, einen: 1, einem: 1, einer: 1, eine: 1, zwei: 2, drei: 3, vier: 4, funf: 5, sechs: 6, sieben: 7, acht: 8, zehn: 10, vierzehn: 14, funfzehn: 15, zwanzig: 20, dreißig: 30, dreissig: 30, sechzig: 60,
  // fr
  un: 1, une: 1, deux: 2, trois: 3, quatre: 4, cinq: 5, sept: 7, huit: 8, dix: 10, quatorze: 14, quinze: 15, vingt: 20, trente: 30, soixante: 60,
  // es
  uno: 1, una: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6, siete: 7, ocho: 8, diez: 10, catorce: 14, quince: 15, veinte: 20, treinta: 30, sesenta: 60, noventa: 90,
  // it
  due: 2, tre: 3, quattro: 4, cinque: 5, sei: 6, sette: 7, otto: 8, dieci: 10, quattordici: 14, quindici: 15, venti: 20, trenta: 30, sessanta: 60, novanta: 90,
  // pt
  um: 1, uma: 1, dois: 2, duas: 2, quatro: 4, sete: 7, oito: 8, dez: 10, catorze: 14, vinte: 20, trinta: 30, sessenta: 60,
};
type Unit = 'day' | 'week' | 'month' | 'hour';
const UNITS: Record<string, Unit> = {
  day: 'day', days: 'day', tag: 'day', tage: 'day', tagen: 'day', jour: 'day', jours: 'day', dia: 'day', dias: 'day', giorno: 'day', giorni: 'day',
  werktag: 'day', werktage: 'day', werktagen: 'day', arbeitstag: 'day', arbeitstage: 'day', arbeitstagen: 'day',
  week: 'week', weeks: 'week', woche: 'week', wochen: 'week', semaine: 'week', semaines: 'week', semana: 'week', semanas: 'week', settimana: 'week', settimane: 'week',
  month: 'month', months: 'month', monat: 'month', monate: 'month', monaten: 'month', mois: 'month', mes: 'month', meses: 'month', mese: 'month', mesi: 'month',
  hour: 'hour', hours: 'hour', stunde: 'hour', stunden: 'hour', heure: 'hour', heures: 'hour', hora: 'hour', horas: 'hour', ora: 'hour', ore: 'hour',
};
const BUSINESS = ['working', 'business', 'werktag', 'werktage', 'werktagen', 'arbeitstag', 'arbeitstage', 'arbeitstagen', 'ouvres', 'ouvrables', 'habiles', 'lavorativi', 'feriali', 'uteis'];
const CALENDAR = ['calendar', 'clear', 'naturales', 'calendaires', 'francs', 'consecutivi', 'corridos', 'seguidos'];

const numAlt = [...Object.keys(NUM_WORDS), '\\d{1,3}'].sort((a, b) => b.length - a.length).join('|');
const unitAlt = Object.keys(UNITS).sort((a, b) => b.length - a.length).join('|');
const modAlt = [...BUSINESS, ...CALENDAR].join('|');
const RE_REL = new RegExp(`(?<![a-z0-9])(${numAlt})\\s*(?:\\((\\d{1,3})\\)\\s*)?(?:(${modAlt})\\s+)?(${unitAlt})(?:\\s+(${modAlt}))?(?![a-z])`, 'g');

// what precedes "N days" for it to be a time limit
const RE_TRIGGER = /(within|no later than|not later than|at the latest|no more than|innerhalb(?: von| einer frist von)?|binnen|frist von|dans un delai de|dans le delai de|dans les|sous|au plus tard|delai de|en un plazo de|en el plazo de|plazo de|dentro de(?: los)?|en los|entro(?: il termine di)?|nel termine di|termine di|no prazo de|prazo de|dentro do prazo de|no prazo maximo de|until|up to|bis zu|jusqu'a|hasta|fino a|ate)\s*$/;
// what follows "N days" (after / before)
const RE_AFTER = /^\s*(?:\(\w+\)\s*)?(from|after|of|following|nach|ab|seit|apres|suivant|a compter d[eu]|a partir d[eu]?|des|desde|contados? a partir d[eoa]|dalla|dal|dopo|apos|a contar d[aeo]|contados? d[aeo]|da data d[aeo])/;
const RE_BEFORE = /^\s*(before|prior to|vor|avant|antes d[eao]l?|antes|prima d[ie]ll?'?|prima del|prima)/;

// anchors (what the period counts from / before), looked up in the words after the unit
const ANCHOR_EVENT: [RegExp, string, string[]][] = [
  [/arriv|check-?in|anreise|ankunft|llegada|chegada|entrada|arrivee/, 'arrival', ['arrival', 'check-in', 'check in', 'anreise', 'ankunft', 'arrivee', 'arrivée', 'llegada', 'entrada', 'arrivo', 'chegada', 'data de chegada', 'fecha de llegada', 'fecha de entrada']],
  [/depart|abflug|abfahrt|salida|partenza|partida|flight|vol |vuelo|volo|voo/, 'departure', ['departure', 'abflug', 'abfahrt', 'depart', 'départ', 'salida', 'partenza', 'partida', 'flight date']],
  [/appointment|termin|rendez-vous|cita|appuntamento|entrevista|interview|colloquio/, 'appointment', ['appointment', 'termin', 'rendez-vous', 'cita', 'appuntamento', 'entrevista', 'interview', 'colloquio', 'marcada para']],
  [/move-in|einzug|mietbeginn|tenancy start|entrega|consegna|start of the tenancy|inicio del contrato|data de entrega|key handover|ubergabe/, 'move-in', ['move-in', 'move in', 'tenancy start date', 'tenancy start', 'einzug', 'mietbeginn', 'übergabe', 'ubergabe', 'fecha de entrada', 'entrega de llaves', 'data di consegna', 'data de entrega', 'data de entrega das chaves', 'date d\'entree']],
];
const RE_RECEIPT = /receipt|received|service|delivery|notification|zustellung|erhalt|bekanntgabe|zugang|reception|notificacion|recepcion|recibo|notifica|ricevimento|ricezione|notificacao|rececao|recebimento/;
const RE_ISSUE_ANCHOR = /date of (this|the) (notice|letter|invoice|document|e-?mail|message)|issue|this notice|this letter|this (e-?mail|message)|(dieser|dieses) (e-?mail|nachricht|schreibens?)|(ce|du present) (courriel|message|e-?mail|courrier)|(este|esta) (correo|mensaje|e-?mail|comunicacion)|(questa|della presente) (e-?mail|comunicazione|lettera)|(deste|desta) (e-?mail|mensagem|comunicacao)|bescheid|schreiben|datum|ausstellung|la presente|l'avis|date d'emission|la date|emision|esta (carta|notificacion)|emissione|presente|data (do|da|de) (aviso|carta|emissao)|emissao/;

const ISSUE_CUES = ['sent', 'date sent', 'gesendet', 'envoye le', 'enviado', 'inviato', 'enviado em', 'date of issue', 'issue date', 'issued', 'issued on', 'date of this notice', 'date of notice', 'notice date', 'dated', 'letter date', 'date',
  'datum', 'datum des bescheids', 'bescheiddatum', 'ausgestellt am', 'ausgestellt', 'ausstellungsdatum', 'erstellt am',
  'date d\'emission', 'emis le', 'fait le', 'date de l\'avis', 'date d\'envoi',
  'fecha de emision', 'fecha de expedicion', 'fecha', 'emitido el', 'fecha del aviso',
  'data di emissione', 'emesso il', 'data', 'data del verbale', 'data della lettera',
  'data de emissao', 'emitido em', 'data do aviso', 'data da carta'];
const reIssue = phraseRe(ISSUE_CUES);
const WEEKDAY = /^(mon|tues|wednes|thurs|fri|satur|sun)day$|^(montag|dienstag|mittwoch|donnerstag|freitag|samstag|sonntag)$|^(lundi|mardi|mercredi|jeudi|vendredi|samedi|dimanche)$|^(lunes|martes|miercoles|jueves|viernes|sabado|domingo)$|^(lunedi|martedi|mercoledi|giovedi|venerdi|sabato|domenica)$|^(segunda|terca|quarta|quinta|sexta)(-feira)?$/;
const OFFENCE = /infra|offen|tatzeit|tattag|tatdatum|violation|denuncia|verbale di accert|contravention|hora|uhrzeit/;

export interface RelativeDeadline { iso: string | null; calc: DeadlineCalc; confidence: Confidence; note: string; start: number; end: number }

/** Snippet lines without page-edge OCR junk ("j Bitte ... Tagen 3" -> "Bitte ... Tagen"). Display only. */
function cleanSnippet(snip: string): string {
  return snip.split(' / ').map((ln) => {
    const toks = ln.trim().split(/\s+/);
    while (toks.length > 1 && isNoiseTok(toks[toks.length - 1], true)) toks.pop();
    while (toks.length > 1 && isNoiseTok(toks[0], false)) toks.shift();
    return toks.join(' ');
  }).join(' / ');
}
// Page-edge OCR junk: punctuation-only tokens (1-2 chars) anywhere at an edge; a lone digit or lone capital only at
// the END of a line (sentences don't end in "3" or "E"); a lone i/j/l only at the START. Digits at a line start are
// kept ("innerhalb von / 5 Tagen"), as are lowercase one-letter words (a, à, e, y, o).
const isNoiseTok = (t: string, atEnd: boolean) => /^[^\p{L}\p{N}\s]{1,2}$/u.test(t) || (atEnd && /^(\p{N}|\p{Lu})$/u.test(t)) || (!atEnd && /^[ijl]$/.test(t));

/** Folded, whitespace-collapsed context with page-edge OCR junk removed, so "72 ore E\ni prima dell'arrivo" reads
 * "72 ore prima dell'arrivo" while "15 jours à\ncompter de" still reads "15 jours a compter de". */
function denoise(raw: string): string {
  const isNoise = isNoiseTok;
  const out = raw.split('\n').map((ln) => {
    const toks = ln.split(/[^\S\n]+/);
    while (toks.length > 1 && isNoise(toks[toks.length - 1], true)) toks.pop();
    while (toks.length > 1 && (toks[0] === '' || isNoise(toks[0], false))) toks.shift();
    return toks.join(' ');
  }).join(' ');
  return fold(out).replace(/\s+/g, ' ');
}

const pad = (n: number) => String(n).padStart(2, '0');
function addPeriod(iso: string, n: number, unit: Unit, business: boolean, sign: 1 | -1): string {
  const [y, m, d] = iso.split('-').map(Number);
  let dt = new Date(Date.UTC(y, m - 1, d));
  if (unit === 'month') {
    const target = new Date(Date.UTC(y, m - 1 + sign * n, 1));
    const last = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
    dt = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth(), Math.min(d, last)));
  } else if (unit === 'hour') {
    // N hours before/after a date: whole days are subtracted/added; partial days round toward the safe (earlier) side
    const days = sign < 0 ? Math.ceil(n / 24) : Math.floor(n / 24);
    dt = new Date(dt.getTime() + sign * days * 86400000);
  } else if (business && unit === 'day') {
    let left = n;
    while (left > 0) {
      dt = new Date(dt.getTime() + sign * 86400000);
      const wd = dt.getUTCDay();
      if (wd !== 0 && wd !== 6) left--;
    }
  } else {
    const days = unit === 'week' ? n * 7 : n;
    dt = new Date(dt.getTime() + sign * days * 86400000);
  }
  return `${dt.getUTCFullYear()}-${pad(dt.getUTCMonth() + 1)}-${pad(dt.getUTCDate())}`;
}

/** Issue / letter date printed on the document, if any. */
export function findIssueDate(text: string, cands: DateCand[]): { iso: string; snippet: string } | null {
  const f = fold(text);
  const ls = lines(text);
  let best: { iso: string; snippet: string; score: number } | null = null;
  cands.forEach((c, i) => {
    if (c.precision !== 'day') return;
    const prevEnd = i > 0 ? cands[i - 1].end : 0;
    const li = ls[lineAt(ls, c.start)];
    const before = f.slice(li.start, c.start);
    if (OFFENCE.test(before)) return;
    let score = 0;
    const cue = nearestCueBefore(f, c.start, reIssue, Math.min(40, c.start - prevEnd));
    if (cue && cue.dist <= 25) {
      const between = f.slice(cue.start + cue.cue.length, c.start);
      const short = cue.cue.trim().length <= 5;
      // bare "date"/"datum"/"fecha"/"data"/"sent" only when the date directly follows (optionally one word + colon)
      if (!short || /^[^\S\n]*([a-z]+[^\S\n]*)?[:.]?[^\S\n]*([a-z]+,?[^\S\n]*)?$/.test(between)) score = short ? 2 : 3;
    }
    // letter dateline "Lyon, le 25 septembre 2026" / "London, 2 October 2026"
    // two-column letters often put the dateline after other text on the same OCR line, so match at the end only
    const dl = /(?:^|\s)([A-ZÀ-Ý][\p{L}\-]{1,25}(?: [A-ZÀ-Ý][\p{L}\-]{1,20})?),\s*(le|den|am|il|el|em)?\s*$/u.exec(text.slice(li.start, c.start));
    if (dl && !WEEKDAY.test(fold(dl[1]))) score = Math.max(score, 2.5);
    if (score > 0 && (!best || score > best.score)) best = { iso: c.iso, snippet: snippetFor(text, c.start, c.end), score };
  });
  return best ? { iso: (best as { iso: string }).iso, snippet: (best as { snippet: string }).snippet } : null;
}

function findEventDate(text: string, cands: DateCand[], cues: string[]): { iso: string; snippet: string } | null {
  const f = fold(text);
  const re = phraseRe(cues.map((c) => fold(c)));
  let best: { iso: string; snippet: string; dist: number } | null = null;
  cands.forEach((c, i) => {
    if (c.precision !== 'day') return;
    const prevEnd = i > 0 ? cands[i - 1].end : 0;
    const cue = nearestCueBefore(f, c.start, re, Math.min(45, c.start - prevEnd));
    if (cue && (!best || cue.dist < best.dist)) best = { iso: c.iso, snippet: snippetFor(text, c.start, c.end), dist: cue.dist };
  });
  return best ? { iso: (best as { iso: string }).iso, snippet: (best as { snippet: string }).snippet } : null;
}

export function findRelativeDeadlines(text: string, cands: DateCand[]): RelativeDeadline[] {
  const f = fold(text);
  const out: RelativeDeadline[] = [];
  let issue: ReturnType<typeof findIssueDate> | undefined;
  RE_REL.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = RE_REL.exec(f))) {
    const numTok = m[1];
    const n = /^\d+$/.test(numTok) ? Number(numTok) : m[2] ? Number(m[2]) : NUM_WORDS[numTok];
    if (!n || n > 400) continue;
    const unit = UNITS[m[4]];
    const business = BUSINESS.includes(m[3] ?? '') || BUSINESS.includes(m[5] ?? '') || /werktag|arbeitstag/.test(m[4]);
    const start = m.index, end = m.index + m[0].length;
    const pre = denoise(text.slice(Math.max(0, start - 45), start));
    const post = denoise(text.slice(end, end + 80));
    const isBefore = RE_BEFORE.test(post);
    const triggered = RE_TRIGGER.test(pre);
    const afterWord = RE_AFTER.exec(post);
    if (!isBefore && !triggered && !afterWord) continue;
    // "N days before" needs an event; "after N days" style without trigger needs an explicit anchor
    const anchorText = post.slice(0, 70);
    let anchor: DeadlineCalc['anchor'] = 'unspecified';
    let eventCues: string[] | null = null;
    for (const [re, name, cues] of ANCHOR_EVENT) if (re.test(anchorText)) { anchor = name as DeadlineCalc['anchor']; eventCues = cues; break; }
    if (anchor === 'unspecified') {
      if (RE_RECEIPT.test(anchorText)) anchor = 'receipt';
      else if (RE_ISSUE_ANCHOR.test(anchorText)) anchor = 'issue';
    }
    if (isBefore && !eventCues) continue; // "2 hours before eating" etc. is not a deadline
    if (!triggered && anchor === 'unspecified') continue;
    const ruleSnippet = cleanSnippet(snippetFor(text, start, Math.min(text.length, end + 18), triggered ? Math.max(0, start - 25) : start));
    let base: DeadlineCalc['base'] = null;
    if (eventCues) {
      const ev = findEventDate(text, cands, eventCues);
      if (ev) base = { iso: ev.iso, snippet: cleanSnippet(ev.snippet), label: `${anchor} date` };
    } else {
      issue ??= findIssueDate(text, cands);
      if (issue) base = { iso: issue.iso, snippet: cleanSnippet(issue.snippet), label: 'document date' };
    }
    const direction = isBefore ? 'before' : 'after';
    const resultIso = base ? addPeriod(base.iso, n, unit, business, isBefore ? -1 : 1) : null;
    let confidence: Confidence = 'low';
    const notes: string[] = [];
    if (!base) {
      notes.push(anchor === 'receipt'
        ? 'This deadline counts from when you received the document, and that date is not printed on it, so the exact date cannot be computed.'
        : eventCues ? `This deadline is relative to the ${anchor} date, which was not found in the text.` : 'This deadline is relative to a start date that is not printed in the document, so the exact date cannot be computed.');
    } else if (anchor === 'issue') {
      confidence = 'medium';
    } else if (eventCues) {
      confidence = isBefore || afterWord ? 'medium' : 'low';
      if (!isBefore && !afterWord) notes.push(`The text does not clearly say whether this is before or after the ${anchor} date. Check the original.`);
    } else if (anchor === 'receipt') {
      notes.push('The period runs from when you received the document. It is counted here from the document date, which is the earliest possible start, so the real deadline may be a few days later. Check when it was delivered.');
    } else {
      notes.push('The document does not say what the period counts from; it is counted here from the document date. Check the original.');
    }
    if (business) notes.push('Working days counted Monday to Friday; public holidays are NOT taken into account.');
    if (unit === 'hour') notes.push('Hours rounded to whole days on the safe (earlier) side; the exact time of day matters.');
    out.push({ iso: resultIso, calc: { ruleSnippet, n, unit, business, direction, anchor, base, resultIso }, confidence, note: notes.join(' '), start, end });
  }
  return out;
}

export function calcText(c: DeadlineCalc, fmt: (iso: string) => string): string {
  const unitWord = `${c.business ? 'working ' : ''}${c.unit}${c.n === 1 ? '' : 's'}`;
  if (!c.base || !c.resultIso) return `${c.n} ${unitWord} ${c.direction} ${c.anchor === 'receipt' ? 'the day you received it' : c.anchor === 'issue' || c.anchor === 'unspecified' ? 'the start date' : `the ${c.anchor} date`} (start date unknown, not printed)`;
  return `${fmt(c.base.iso)} (${c.base.label}) ${c.direction === 'before' ? '−' : '+'} ${c.n} ${unitWord} = ${fmt(c.resultIso)}`;
}
