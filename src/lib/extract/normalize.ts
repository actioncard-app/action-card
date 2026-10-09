/** Fold one character to lowercase ASCII-ish form while keeping a 1:1 length mapping. */
// letters without a Unicode decomposition that OCR produces for i/l/o/d
const FOLD_EXTRA: Record<string, string> = { 'ı': 'i', 'ł': 'l', 'Ł': 'l', 'ø': 'o', 'Ø': 'o', 'đ': 'd', 'Đ': 'd', 'İ': 'i' };
function foldChar(c: string): string {
  if (FOLD_EXTRA[c]) return FOLD_EXTRA[c];
  const f = c.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
  if (f.length === 1) return f;
  return f.length === 0 ? ' ' : f[0];
}

/** Lowercase + strip diacritics, same length as input so indices map back to the original text. */
export function fold(s: string): string {
  let out = '';
  for (const ch of s) {
    // code points outside the BMP are two UTF-16 units: keep length identical
    const f = foldChar(ch);
    out += ch.length === 2 ? f + ' ' : f;
  }
  return out;
}

/** Light OCR clean-up that keeps line structure. */
export function cleanOcr(text: string): string {
  return text
    .replace(/\r/g, '')
    .replace(/[\u2018\u2019\u00b4`]/g, "'")
    .replace(/[\u201c\u201d\u201e]/g, '"')
    .replace(/[\u2013\u2014]/g, '-')
    .replace(/\u00a0/g, ' ')
    .replace(/[ \t]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .split('\n').map(dejunkLine).join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

// Characters Tesseract produces from page edges, shadows, folds and table rules rather than from text.
const EDGE_JUNK = /^(?:[|!¦\]\[{}_~«»•*¬°^\\/]+\s+)+|(?:\s+[|!¦\]\[{}_~«»•*¬°^\\/]+)+$/g;

/**
 * OCR junk filter for one line: strip stray edge symbols ("| Total 225€ ]" -> "Total 225€") and blank out lines
 * that carry no readable content (no word of 3+ letters and no digit, e.g. "ï j", "| -\"", "/").
 */
export function dejunkLine(line: string): string {
  const t = line.replace(EDGE_JUNK, '').trim();
  if (!t) return '';
  if (!/\p{L}{3,}|\d/u.test(t)) return '';
  // mostly symbols (e.g. "-~=_'.,|") with a lone short token
  const good = (t.match(/[\p{L}\d]/gu) ?? []).length;
  if (good / t.replace(/\s/g, '').length < 0.4 && t.length > 4) return '';
  return t;
}

export interface LineInfo { start: number; end: number; text: string }

export function lines(text: string): LineInfo[] {
  const out: LineInfo[] = [];
  let start = 0;
  for (const part of text.split('\n')) {
    out.push({ start, end: start + part.length, text: part });
    start += part.length + 1;
  }
  return out;
}

export function lineAt(ls: LineInfo[], idx: number): number {
  for (let i = 0; i < ls.length; i++) if (idx >= ls[i].start && idx <= ls[i].end) return i;
  return ls.length - 1;
}

/** Snippet = the source line containing [start,end), plus the previous line if the cue started there. */
export function snippetFor(text: string, start: number, end: number, cueStart?: number): string {
  const ls = lines(text);
  const a = lineAt(ls, cueStart !== undefined ? Math.min(cueStart, start) : start);
  const b = lineAt(ls, Math.max(end - 1, start));
  return ls.slice(a, b + 1).map((l) => l.text.trim()).filter(Boolean).join(' / ');
}

export function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// ---- OCR-robust keyword matching ------------------------------------------------------------------------------
// Every cue word used by the extractors (>= 7 letters) is registered here. foldDoc() then repairs document words
// that differ from exactly one cue word by a few substituted letters (OCR misreads such as "Ausiinderbehurde" ->
// "auslanderbehorde"), keeping the text length so snippet positions still map to the original OCR text.
const VOCAB = new Map<number, Set<string>>();
export function registerVocab(words: Iterable<string>) {
  for (const p of words) for (const w of p.split(/[^a-z]+/)) {
    if (w.length < 7) continue;
    if (!VOCAB.has(w.length)) VOCAB.set(w.length, new Set());
    VOCAB.get(w.length)!.add(w);
  }
}
const maxSubs = (n: number) => (n >= 14 ? 3 : n >= 10 ? 2 : 1);
function repairWord(w: string): string {
  const set = VOCAB.get(w.length);
  if (!set || set.has(w)) return w;
  const lim = maxSubs(w.length);
  let best = '', bestD = lim + 1, tie = false;
  for (const v of set) {
    let d = 0;
    for (let i = 0; i < w.length && d <= lim; i++) if (w[i] !== v[i]) d++;
    if (d < bestD) { best = v; bestD = d; tie = false; } else if (d === bestD && v !== best) tie = true;
  }
  // first and last letters must mostly survive: require at least one of them to match, so short real words
  // are not rewritten into keywords
  if (!best || tie || bestD > lim || (w[0] !== best[0] && w[w.length - 1] !== best[best.length - 1])) return w;
  return best;
}
const foldDocCache = new Map<string, string>();
/** fold() for document text, plus keyword repair (same length as the input). Use for cue matching. */
export function foldDoc(s: string): string {
  const hit = foldDocCache.get(s);
  if (hit !== undefined) return hit;
  const out = fold(s).replace(/[a-z]{7,}/g, repairWord);
  if (foldDocCache.size > 16) foldDocCache.clear();
  foldDocCache.set(s, out);
  return out;
}

/** OCR letter-shape confusions that change length ("rn" read as "m" and vice versa), as regex alternatives. */
function ocrVariants(p: string): string {
  return escapeRe(p).replace(/ /g, '\\s+').replace(/rn|m/g, (x) => (x === 'm' ? '(?:m|rn)' : '(?:rn|m)'));
}

/** Build a regex that matches any of the (already folded) phrases on word boundaries (tolerating rn/m OCR swaps). */
export function phraseRe(phrases: string[], flags = 'g'): RegExp {
  registerVocab(phrases);
  const sorted = [...phrases].sort((a, b) => b.length - a.length).map(ocrVariants);
  return new RegExp(`(?<![a-z0-9])(?:${sorted.join('|')})(?![a-z0-9])`, flags);
}

/** Find the closest cue phrase ending before `idx` within `window` chars. Returns distance and cue start. */
export function nearestCueBefore(folded: string, idx: number, re: RegExp, window = 90): { dist: number; start: number; cue: string } | null {
  const from = Math.max(0, idx - window);
  const seg = folded.slice(from, idx);
  let best: { dist: number; start: number; cue: string } | null = null;
  re.lastIndex = 0;
  let m: RegExpExecArray | null;
  const r = new RegExp(re.source, 'g');
  while ((m = r.exec(seg))) {
    const endAbs = from + m.index + m[0].length;
    const dist = idx - endAbs;
    if (!best || dist < best.dist) best = { dist, start: from + m.index, cue: m[0] };
  }
  return best;
}
