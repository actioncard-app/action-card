// English grapheme-to-phoneme for Kokoro, GPL-free.
// 1) Kokoro/misaki lexicon (Apache-2.0) lookup, 2) suffix rules (-s, -es, -'s, -ed, -ing, -er, -ly, -ment, -ness),
// 3) compound split into known words, 4) letter-to-sound rules for names and unknown words.
// Output: one IPA string per sentence in Kokoro's symbol set, words separated by spaces.
import { LETTER_MARK, normalizeEn, shortFirst, splitSentences } from './en-normalize'

export type Lookup = (words: string[]) => Promise<Record<string, string>>

const LETTER: Record<string, string> = {
  a: 'ˈA', b: 'bˈi', c: 'sˈi', d: 'dˈi', e: 'ˈi', f: 'ˈɛf', g: 'ʤˈi', h: 'ˈAʧ', i: 'ˈI', j: 'ʤˈA', k: 'kˈA',
  l: 'ˈɛl', m: 'ˈɛm', n: 'ˈɛn', o: 'ˈO', p: 'pˈi', q: 'kjˈu', r: 'ˈɑɹ', s: 'ˈɛs', t: 'tˈi', u: 'jˈu', v: 'vˈi',
  w: 'dˈʌbəljˌu', x: 'ˈɛks', y: 'wˈI', z: 'zˈi',
}
const VOICELESS = /[ptkfθ]$/
const SIBILANT = /(s|z|ʃ|ʒ|ʧ|ʤ)$/

function plural(base: string): string {
  if (SIBILANT.test(base)) return base + 'ᵻz'
  if (VOICELESS.test(base)) return base + 's'
  return base + 'z'
}
function past(base: string): string {
  if (/[td]$/.test(base)) return base + 'ᵻd'
  if (/[pkfθsʃʧ]$/.test(base)) return base + 't'
  return base + 'd'
}

type Dict = Map<string, string>
function look(d: Dict, w: string): string | undefined { return d.get(w) }

/** Try suffix rules against the lexicon. */
export function morph(d: Dict, w: string): string | undefined {
  const tryBase = (b: string) => look(d, b)
  let m: string | undefined
  if (w.endsWith("'s") && (m = tryBase(w.slice(0, -2)) ?? lts(w.slice(0, -2)))) return plural(m)
  if (w.endsWith("s'") && (m = tryBase(w.slice(0, -1)))) return m
  if (w.endsWith('ies') && (m = tryBase(w.slice(0, -3) + 'y'))) return plural(m)
  if (w.endsWith('es') && (m = tryBase(w.slice(0, -2))) && /(s|x|z|ch|sh)$/.test(w.slice(0, -2))) return plural(m)
  if (w.endsWith('s') && !w.endsWith('ss') && (m = tryBase(w.slice(0, -1)) ?? morph(d, w.slice(0, -1)))) return plural(m)
  if (w.endsWith('ied') && (m = tryBase(w.slice(0, -3) + 'y'))) return past(m)
  if (w.endsWith('ed')) {
    const b = w.slice(0, -2)
    if ((m = tryBase(b) ?? tryBase(b + 'e') ?? (b.length > 2 && b[b.length - 1] === b[b.length - 2] ? tryBase(b.slice(0, -1)) : undefined))) return past(m)
  }
  if (w.endsWith('ing')) {
    const b = w.slice(0, -3)
    if ((m = tryBase(b) ?? tryBase(b + 'e') ?? (b.length > 2 && b[b.length - 1] === b[b.length - 2] ? tryBase(b.slice(0, -1)) : undefined))) return m + 'ɪŋ'
  }
  for (const [suf, ph] of [['ly', 'li'], ['ment', 'mənt'], ['ness', 'nəs'], ['er', 'əɹ'], ['ers', 'əɹz'], ['less', 'ləs'], ['ful', 'fəl']] as const) {
    if (w.endsWith(suf) && w.length > suf.length + 2) {
      const b = w.slice(0, -suf.length)
      if ((m = tryBase(b) ?? tryBase(b + 'e'))) return m + ph
    }
  }
  if (w.startsWith('un') && (m = tryBase(w.slice(2)))) return 'ˌʌn' + m
  if (w.startsWith('re') && w.length > 5 && (m = tryBase(w.slice(2)))) return 'ɹˌi' + m
  return undefined
}

/** Split an unknown word into 2-3 known lexicon words (each ≥3 letters). */
export function compound(d: Dict, w: string): string | undefined {
  if (w.length < 6) return undefined
  for (let i = w.length - 3; i >= 3; i--) {
    const a = look(d, w.slice(0, i))
    if (!a) continue
    const rest = w.slice(i)
    const b = look(d, rest) ?? (rest.length >= 4 ? morph(d, rest) : undefined)
    if (b) return a + destress(b)
    if (rest.length >= 6) { const c = compound(d, rest); if (c) return a + destress(c) }
  }
  return undefined
}
function destress(p: string): string { return p.replace(/ˈ/g, 'ˌ') }

// Letter-to-sound rules (ordered, longest first). Context: ^ word start, $ word end.
const RULES: [RegExp, string][] = [
  [/^kn/, 'n'], [/^wr/, 'ɹ'], [/^ps/, 's'], [/^x/, 'z'],
  [/^tion/, 'ʃən'], [/^sion/, 'ʒən'], [/^ture/, 'ʧəɹ'], [/^eigh/, 'A'], [/^ough/, 'O'], [/^augh/, 'ɔ'],
  [/^igh/, 'I'], [/^sch/, 'ʃ'], [/^tch/, 'ʧ'], [/^dge/, 'ʤ'], [/^ch/, 'ʧ'], [/^sh/, 'ʃ'], [/^th/, 'θ'],
  [/^ph/, 'f'], [/^ck/, 'k'], [/^ng/, 'ŋ'], [/^qu/, 'kw'], [/^wh/, 'w'], [/^gh/, 'ɡ'],
  [/^ee/, 'i'], [/^ea/, 'i'], [/^oo/, 'u'], [/^ou/, 'W'], [/^ow$/, 'O'], [/^ow/, 'W'], [/^oi/, 'Y'], [/^oy/, 'Y'],
  [/^ai/, 'A'], [/^ay/, 'A'], [/^au/, 'ɔ'], [/^aw/, 'ɔ'], [/^ei/, 'I'], [/^ey$/, 'i'], [/^ie$/, 'i'], [/^ie/, 'i'],
  [/^ue/, 'u'], [/^ew/, 'u'], [/^oa/, 'O'],
  [/^ar/, 'ɑɹ'], [/^or/, 'ɔɹ'], [/^er/, 'ɜɹ'], [/^ir/, 'ɜɹ'], [/^ur/, 'ɜɹ'],
  [/^ll/, 'l'], [/^ss/, 's'], [/^tt/, 't'], [/^nn/, 'n'], [/^mm/, 'm'], [/^pp/, 'p'], [/^rr/, 'ɹ'], [/^ff/, 'f'],
  [/^dd/, 'd'], [/^bb/, 'b'], [/^gg/, 'ɡ'], [/^zz/, 'z'], [/^cc/, 'k'],
  [/^c(?=[eiy])/, 's'], [/^c/, 'k'], [/^g(?=[eiy])/, 'ʤ'], [/^g/, 'ɡ'], [/^j/, 'ʤ'], [/^x/, 'ks'], [/^y(?=[aeiou])/, 'j'],
  [/^w/, 'w'], [/^r/, 'ɹ'], [/^v/, 'v'], [/^z/, 'z'], [/^b/, 'b'], [/^d/, 'd'], [/^f/, 'f'], [/^h/, 'h'], [/^k/, 'k'],
  [/^l/, 'l'], [/^m/, 'm'], [/^n/, 'n'], [/^p/, 'p'], [/^q/, 'k'], [/^s/, 's'], [/^t/, 't'],
  [/^ä/, 'ɛ'], [/^ö/, 'ɜ'], [/^ü/, 'u'], [/^ß/, 's'], [/^[éèê]/, 'A'], [/^[áà]/, 'ɑ'], [/^[íì]/, 'i'], [/^[óò]/, 'O'], [/^[úù]/, 'u'], [/^ñ/, 'nj'], [/^ç/, 's'],
]
const LONG: Record<string, string> = { a: 'A', e: 'i', i: 'I', o: 'O', u: 'u', y: 'I' }
const SHORT: Record<string, string> = { a: 'æ', e: 'ɛ', i: 'ɪ', o: 'ɑ', u: 'ʌ', y: 'ɪ' }
const VOWEL_PH = /[AIOWYiuæɛɪɑʌɔəɜᵻ]/

/** Rule-based pronunciation for names and other unknown words. */
export function lts(word: string): string {
  const w = word.toLowerCase().replace(/[^a-zäöüßéèêáàíìóòúùñç']/g, '').replace(/'/g, '')
  if (!w) return ''
  const out: string[] = []
  let i = 0, syll = 0
  while (i < w.length) {
    const rest = w.slice(i)
    const ch = w[i]
    if ('aeiouy'.includes(ch) && !(ch === 'y' && i === 0)) {
      // digraph vowels/r-colored handled by rules first
      let hit = false
      for (const [re, ph] of RULES) {
        if (!/^\^?[aeiouy]/.test(re.source.replace('^', ''))) continue
        const m = rest.match(re)
        if (m && (re.source.endsWith('$') ? i + m[0].length === w.length : true)) {
          out.push((syll === 0 ? 'ˈ' : '') + (syll > 0 && ph === 'ɜɹ' ? 'əɹ' : ph)); i += m[0].length; syll++; hit = true; break
        }
      }
      if (hit) continue
      if (ch === 'e' && i === w.length - 1 && syll > 0) { i++; continue } // silent final e
      if (ch === 'y' && i === w.length - 1) { out.push(syll === 0 ? 'ˈI' : 'i'); i++; syll++; continue }
      if (ch === 'i' && i === w.length - 1) { out.push(syll === 0 ? 'ˈi' : 'i'); i++; syll++; continue }
      if (ch === 'o' && i === w.length - 1) { out.push((syll === 0 ? 'ˈ' : '') + 'O'); i++; syll++; continue }
      const magic = /^[aeiouy][bcdfgklmnprstvz]e$/.test(w.slice(i, i + 3)) && i + 3 === w.length
      let ph = magic ? LONG[ch] : SHORT[ch]
      if (syll > 0 && !magic) ph = ch === 'e' || ch === 'i' ? 'ɪ' : 'ə'
      out.push((syll === 0 ? 'ˈ' : '') + ph); i++; syll++
      continue
    }
    let hit = false
    for (const [re, ph] of RULES) {
      const m = rest.match(re)
      if (!m) continue
      if (re.source.startsWith('^') && /^\^(kn|wr|ps|x)/.test(re.source) && i !== 0) continue
      if (re.source.endsWith('$') && i + m[0].length !== w.length) continue
      const vowelish = VOWEL_PH.test(ph)
      out.push((vowelish ? (syll === 0 ? 'ˈ' : '') : '') + (vowelish && syll > 0 && ph === 'ɜɹ' ? 'əɹ' : ph))
      if (vowelish) syll++
      i += m[0].length; hit = true; break
    }
    if (!hit) i++
  }
  let s = out.join('')
  if (!VOWEL_PH.test(s)) s = w.split('').map(c => LETTER[c] ?? '').join('')
  return s
}

const CAPS_SPELL = /^[A-Z]{2,5}$/

export function wordPhonemes(d: Dict, raw: string): string {
  if (raw.startsWith(LETTER_MARK)) return LETTER[raw.slice(1).toLowerCase()] ?? ''
  const w = raw.toLowerCase()
  const hit = look(d, w)
  if (hit && !(CAPS_SPELL.test(raw) && !look(d, raw.toLowerCase()))) return hit
  if (CAPS_SPELL.test(raw) && !hit) return raw.toLowerCase().split('').map(c => LETTER[c] ?? '').join('')
  if (w.includes('-')) return w.split('-').filter(Boolean).map(p => wordPhonemes(d, p)).join(' ')
  return morph(d, w) ?? compound(d, w) ?? lts(w)
}

const TOKEN_RE = new RegExp(`${LETTER_MARK}?[A-Za-zÀ-ÿ'’-]+|[,.;:!?]`, 'g')

/** Words needed from the lexicon for this text (so the native side can look up only these). */
export function wordsFor(sentences: string[]): string[] {
  const set = new Set<string>()
  for (const s of sentences) for (const t of s.match(TOKEN_RE) ?? []) {
    if (/^[,.;:!?]$/.test(t) || t.startsWith(LETTER_MARK)) continue
    const w = t.toLowerCase().replace(/’/g, "'")
    set.add(w)
    for (const p of w.split('-')) if (p) set.add(p)
    // candidate bases for suffix rules and compounds
    for (const suf of ["'s", 's', 'es', 'ies', 'ed', 'ied', 'ing', 'ly', 'ment', 'ness', 'er', 'ers', 'less', 'ful']) {
      if (w.endsWith(suf) && w.length > suf.length + 1) {
        const b = w.slice(0, -suf.length)
        set.add(b); set.add(b + 'e'); set.add(b + 'y'); set.add(b.slice(0, -1))
        if (b.endsWith('s')) set.add(b.slice(0, -1))
      }
    }
    if (w.startsWith('un') || w.startsWith('re')) set.add(w.slice(2))
    if (w.length >= 6) for (let i = 3; i <= w.length - 3; i++) { set.add(w.slice(0, i)); set.add(w.slice(i)) }
  }
  return [...set]
}

export function phonemizeSentence(d: Dict, s: string): string {
  const parts: string[] = []
  for (const t of s.match(TOKEN_RE) ?? []) {
    if (/^[,.;:!?]$/.test(t)) { if (parts.length) parts[parts.length - 1] += t; continue }
    const p = wordPhonemes(d, t.replace(/’/g, "'"))
    if (p) parts.push(p)
  }
  return parts.join(' ')
}

/** Full pipeline: text → normalized sentences → IPA per sentence. */
export async function phonemizeEn(text: string, lookup: Lookup): Promise<{ sentences: string[]; ipa: string[] }> {
  const sentences = shortFirst(splitSentences(normalizeEn(text)))
  const found = await lookup(wordsFor(sentences))
  const d: Dict = new Map(Object.entries(found))
  return { sentences, ipa: sentences.map(s => phonemizeSentence(d, s)).filter(Boolean) }
}
