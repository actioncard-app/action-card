// English text normalization for the on-device neural voice (Kokoro).
// Turns numbers, money, dates, times, percentages, ordinals, codes and common
// abbreviations into plain words, because the phonemizer only knows words.
// Pure, synchronous, no network. The letter text never leaves the phone.

const ONES = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten',
  'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen']
const TENS = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety']
const SCALES: [number, string][] = [[1e12, 'trillion'], [1e9, 'billion'], [1e6, 'million'], [1e3, 'thousand']]
export const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August',
  'September', 'October', 'November', 'December']

function under1000(n: number): string {
  const out: string[] = []
  if (n >= 100) { out.push(ONES[Math.floor(n / 100)], 'hundred'); n %= 100 }
  if (n >= 20) { out.push(n % 10 ? `${TENS[Math.floor(n / 10)]} ${ONES[n % 10]}` : TENS[Math.floor(n / 10)]) }
  else if (n > 0 || out.length === 0) out.push(ONES[n])
  return out.join(' ')
}

export function cardinal(n: number): string {
  if (!Number.isFinite(n)) return ''
  if (n < 0) return 'minus ' + cardinal(-n)
  n = Math.floor(n)
  if (n < 1000) return under1000(n)
  const parts: string[] = []
  for (const [v, name] of SCALES) {
    if (n >= v) { parts.push(`${under1000(Math.floor(n / v) % 1000)} ${name}`); n %= v }
  }
  if (n > 0) parts.push(under1000(n))
  return parts.join(' ')
}

const ORD_IRREG: Record<string, string> = { one: 'first', two: 'second', three: 'third', five: 'fifth',
  eight: 'eighth', nine: 'ninth', twelve: 'twelfth' }
export function ordinal(n: number): string {
  const words = cardinal(n).split(' ')
  const last = words.pop()!
  let o: string
  if (ORD_IRREG[last]) o = ORD_IRREG[last]
  else if (last.endsWith('y')) o = last.slice(0, -1) + 'ieth'
  else o = last + 'th'
  return [...words, o].join(' ')
}

export function year(y: number): string {
  if (y >= 2000 && y < 2010) return y === 2000 ? 'two thousand' : `two thousand ${ONES[y - 2000]}`
  if (y >= 1100 && y < 2100 && y % 100 !== 0) {
    const hi = Math.floor(y / 100), lo = y % 100
    return `${cardinal(hi)} ${lo < 10 ? 'oh ' + ONES[lo] : cardinal(lo)}`
  }
  if (y >= 1100 && y < 2100) return `${cardinal(y / 100)} hundred`
  return cardinal(y)
}

export function digits(s: string): string {
  return s.replace(/\D/g, '').split('').map(d => ONES[+d]).join(' ')
}

/** Spell a code like "AB12-3X" as "A B one two three X". Letters stay as single capitals; the phonemizer reads them by name. */
export const LETTER_MARK = '\u2063'
export function spellCode(s: string): string {
  return s.split('').map(ch => /\d/.test(ch) ? ONES[+ch] : /[a-z]/i.test(ch) ? LETTER_MARK + ch.toUpperCase() : '').filter(Boolean).join(' ')
}

/** Parse "1.234,56", "1,234.56", "45", "45,5" into a number with its cents (0-99). */
export function parseAmount(raw: string): { whole: number; cents: number } | null {
  let s = raw.replace(/[\s'\u00a0\u202f]/g, '')
  if (!/^\d[\d.,]*$/.test(s)) return null
  const lastDot = s.lastIndexOf('.'), lastComma = s.lastIndexOf(',')
  let dec = ''
  const sep = Math.max(lastDot, lastComma)
  if (sep >= 0) {
    const after = s.slice(sep + 1)
    const both = lastDot >= 0 && lastComma >= 0
    if (both || after.length === 1 || after.length === 2) { dec = after; s = s.slice(0, sep) }
    else if (after.length !== 3) { dec = after; s = s.slice(0, sep) }
  }
  const whole = parseInt(s.replace(/[.,]/g, ''), 10)
  if (!Number.isFinite(whole)) return null
  const cents = dec ? Math.round(parseFloat('0.' + dec) * 100) : 0
  return { whole, cents: Math.min(cents, 99) }
}

const CURRENCY: Record<string, [string, string, string, string]> = {
  // symbol: [singular, plural, sub singular, sub plural]
  '€': ['euro', 'euros', 'cent', 'cents'], eur: ['euro', 'euros', 'cent', 'cents'], euro: ['euro', 'euros', 'cent', 'cents'], euros: ['euro', 'euros', 'cent', 'cents'],
  '$': ['dollar', 'dollars', 'cent', 'cents'], usd: ['dollar', 'dollars', 'cent', 'cents'],
  '£': ['pound', 'pounds', 'penny', 'pence'], gbp: ['pound', 'pounds', 'penny', 'pence'],
  chf: ['franc', 'francs', 'rappen', 'rappen'],
}
function money(cur: string, raw: string): string | null {
  const a = parseAmount(raw); const c = CURRENCY[cur.toLowerCase()]
  if (!a || !c) return null
  let s = `${cardinal(a.whole)} ${a.whole === 1 ? c[0] : c[1]}`
  if (a.cents) s += ` and ${cardinal(a.cents)} ${a.cents === 1 ? c[2] : c[3]}`
  return ` ${s} `
}

function dateWords(d: number, m: number, y?: number): string | null {
  if (m < 1 || m > 12 || d < 1 || d > 31) return null
  return ` ${MONTHS[m - 1]} ${ordinal(d)}${y !== undefined ? ', ' + year(y) : ''} `
}
function fullYear(y: string): number { const n = +y; return y.length === 2 ? 2000 + n : n }

const ABBR: [RegExp, string][] = [
  [/\bMr\./g, 'Mister'], [/\bMrs\./g, 'Missus'], [/\bMs\./g, 'Miz'], [/\bDr\./g, 'Doctor'],
  [/\bSt\.(?=\s+[A-Z])/g, 'Saint'], [/\bNo\.(?=\s*\d)/g, 'number'], [/\bNr\.(?=\s*\d)/gi, 'number'],
  [/\be\.g\./gi, 'for example'], [/\bi\.e\./gi, 'that is'], [/\betc\./gi, 'et cetera'],
  [/\bapprox\./gi, 'approximately'], [/\bincl\./gi, 'including'], [/\bvs\./gi, 'versus'],
  [/\bRef\.(?=\s)/g, 'reference'], [/\bTel\.(?=\s)/gi, 'phone'], [/\bp\.a\./gi, 'per year'],
  [/&/g, ' and '], [/\+/g, ' plus '], [/@/g, ' at '], [/#(?=\d)/g, 'number '],
]
const MONTH_ABBR: Record<string, number> = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, sept: 9, oct: 10, nov: 11, dec: 12 }

export function normalizeEn(input: string): string {
  let t = ' ' + input.replace(/[\u2018\u2019]/g, "'").replace(/[\u201c\u201d\u201e]/g, '"').replace(/[\u2013\u2014]/g, ' - ') + ' '
  // URLs and emails: read the domain parts plainly
  t = t.replace(/\bhttps?:\/\/\S+|\bwww\.\S+/gi, m => ' ' + m.replace(/^https?:\/\//i, '').replace(/\/.*$/, '').split('.').join(' dot ') + ' ')
  t = t.replace(/\b[\w.+-]+@[\w-]+(\.[\w-]+)+\b/g, m => ' ' + m.replace('@', ' at ').split('.').join(' dot ') + ' ')
  for (const [re, w] of ABBR) t = t.replace(re, w)
  // IBAN-like and long reference codes (letters+digits, 6+ chars): spell out
  t = t.replace(/\b[A-Z]{2}\d{2}(?:\s?[A-Z0-9]{4}){2,7}(?:\s?[A-Z0-9]{1,4})?\b/g, m => ' ' + spellCode(m) + ', ')
  // ISO dates 2026-11-30
  t = t.replace(/\b(\d{4})-(\d{1,2})-(\d{1,2})\b/g, (m, y, mo, d) => dateWords(+d, +mo, +y) ?? m)
  // 30.11.2026, 30/11/2026, 11/30/2026 (US order only when the first part can't be a day-month)
  t = t.replace(/\b(\d{1,2})[./](\d{1,2})[./](\d{4}|\d{2})\b/g, (m, a, b, y) => {
    let d = +a, mo = +b
    if (mo > 12 && d <= 12) [d, mo] = [mo, d]
    return dateWords(d, mo, fullYear(y)) ?? m
  })
  // 30 November 2026 / 30th Nov / November 30, 2026
  const MN = '(January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sept|Sep|Oct|Nov|Dec)\\.?'
  t = t.replace(new RegExp(`\\b(\\d{1,2})(?:st|nd|rd|th)?\\.?\\s+${MN}(?:,?\\s+(\\d{4}))?\\b`, 'gi'), (m, d, mn, y) => {
    const mo = MONTH_ABBR[mn.toLowerCase().slice(0, mn.toLowerCase().startsWith('sept') ? 4 : 3)] ?? MONTH_ABBR[mn.toLowerCase().slice(0, 3)]
    return dateWords(+d, mo, y ? +y : undefined) ?? m
  })
  t = t.replace(new RegExp(`\\b${MN}\\s+(\\d{1,2})(?:st|nd|rd|th)?(?:,?\\s+(\\d{4}))?\\b`, 'gi'), (m, mn, d, y) => {
    const mo = MONTH_ABBR[mn.toLowerCase().slice(0, 3)]
    return dateWords(+d, mo, y ? +y : undefined) ?? m
  })
  // Money: €45.50, € 45, 45,50 €, EUR 45, 45 EUR, 45 euros
  t = t.replace(/(€|\$|£|\b(?:EUR|USD|GBP|CHF)\b)\s?(\d[\d.,'\u00a0\u202f]*\d|\d)/gi, (m, c, n) => money(c, n) ?? m)
  t = t.replace(/(\d[\d.,'\u00a0\u202f]*\d|\d)\s?(€|\$|£|\b(?:EUR|USD|GBP|CHF|euros?)\b)/gi, (m, n, c) => money(c, n) ?? m)
  // Times 14:30, 9:05 am
  t = t.replace(/\b(\d{1,2}):(\d{2})(?:\s?([ap])\.?m\.?)?\b/gi, (m, h, mi, ap) => {
    const H = +h, M = +mi
    if (H > 24 || M > 59) return m
    const mm = M === 0 ? (ap ? '' : " o'clock") : M < 10 ? ` oh ${ONES[M]}` : ` ${cardinal(M)}`
    return ` ${cardinal(H)}${mm}${ap ? ' ' + ap.toUpperCase() + ' M' : ''} `
  })
  // Percent
  t = t.replace(/(\d+(?:[.,]\d+)?)\s?%/g, (m, n) => {
    const [w, f] = n.split(/[.,]/)
    return ` ${cardinal(+w)}${f ? ' point ' + digits(f) : ''} percent `
  })
  // Ordinals 1st 2nd 3rd 30th
  t = t.replace(/\b(\d+)(st|nd|rd|th)\b/gi, (m, n) => ` ${ordinal(+n)} `)
  // Number ranges 10-12
  t = t.replace(/\b(\d{1,4})\s?-\s?(\d{1,4})\b/g, (m, a, b) => ` ${cardinal(+a)} to ${cardinal(+b)} `)
  // Mixed letter/digit codes: AB123, 12B
  t = t.replace(/\b(?=[A-Za-z]*\d)(?=\d*[A-Za-z])[A-Za-z0-9]{2,}(?:[-/][A-Za-z0-9]+)*\b/g, m => ' ' + spellCode(m) + ' ')
  // Phone numbers and long digit runs (with spaces/slashes/dashes): read digit by digit
  t = t.replace(/(?:\+?\d[\d \-/]{6,}\d)/g, m => /\d{5,}|\d[ \-/]\d/.test(m) && m.replace(/\D/g, '').length >= 6 ? ' ' + digits(m) + ' ' : m)
  // Grouped numbers and decimals 1,234.56 / 1.234,56 / 3.5
  t = t.replace(/\b\d{1,3}(?:[.,\u00a0\u202f]\d{3})+(?:[.,]\d+)?\b|\b\d+[.,]\d+\b/g, m => {
    const a = parseAmount(m)
    if (!a) return m
    const dm = m.match(/[.,](\d{1,2})$/)
    return ` ${cardinal(a.whole)}${dm && a.cents ? ' point ' + digits(dm[1]) : ''} `
  })
  // Years standing alone (1900-2099) read as years, other integers as cardinals
  t = t.replace(/\b\d+\b/g, m => {
    const n = +m
    if (m.length > 6) return ' ' + digits(m) + ' '
    if (m.length === 4 && n >= 1900 && n <= 2099) return ' ' + year(n) + ' '
    return ' ' + cardinal(n) + ' '
  })
  t = t.replace(/[\s\u00a0]+/g, ' ').replace(/\s+([,.;:!?])/g, '$1').replace(/,\s*,/g, ',').replace(/,([.;:!?])/g, '$1')
  return t.trim()
}

/** Make the first piece short so speech starts quickly: break it at a comma (or a space) near firstMax characters. */
export function shortFirst(pieces: string[], firstMax = 60): string[] {
  if (!pieces.length || pieces[0].length <= firstMax) return pieces
  const s = pieces[0]
  let cut = s.indexOf(', ', 15); if (cut < 0 || cut > firstMax + 20) cut = -1
  if (cut < 0) { cut = s.lastIndexOf(' ', firstMax); if (cut < 15) return pieces }
  const a = s.slice(0, cut + (s[cut] === ',' ? 1 : 0)).trim(), b = s.slice(cut + 1).trim()
  return b ? [a, b, ...pieces.slice(1)] : pieces
}

/** Split normalized text into sentences of at most ~maxChars, breaking at commas if needed. */
export function splitSentences(text: string, maxChars = 220): string[] {
  const raw = text.replace(/\n+/g, '. ').split(/(?<=[.!?;:])\s+/).map(s => s.trim()).filter(s => /[a-z0-9]/i.test(s))
  const out: string[] = []
  for (const s of raw) {
    if (s.length <= maxChars) { out.push(s); continue }
    let cur = ''
    for (const part of s.split(/(?<=,)\s+|\s+(?=and |or |but )/)) {
      if ((cur + ' ' + part).trim().length > maxChars && cur) { out.push(cur.trim()); cur = part }
      else cur = (cur + ' ' + part).trim()
      while (cur.length > maxChars) {
        const cut = cur.lastIndexOf(' ', maxChars)
        out.push(cur.slice(0, cut > 0 ? cut : maxChars).trim()); cur = cur.slice(cut > 0 ? cut : maxChars).trim()
      }
    }
    if (cur) out.push(cur)
  }
  return out
}
