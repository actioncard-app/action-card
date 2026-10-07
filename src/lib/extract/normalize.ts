/** Fold one character to lowercase ASCII-ish form while keeping a 1:1 length mapping. */
function foldChar(c: string): string {
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
    .replace(/\n{3,}/g, '\n\n')
    .trim();
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

/** Build a regex that matches any of the (already folded) phrases on word boundaries. */
export function phraseRe(phrases: string[], flags = 'g'): RegExp {
  const sorted = [...phrases].sort((a, b) => b.length - a.length).map((p) => escapeRe(p).replace(/ /g, '\\s+'));
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
