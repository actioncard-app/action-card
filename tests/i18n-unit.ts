// i18n checks: every interface string exists in all six languages, placeholders match, nothing obviously untranslated
// (same as English in a language where it should differ), and no plain English text left in component JSX.
import { readFileSync, readdirSync } from 'node:fs';
import { STRINGS, tr, detectLanguage } from '../src/lib/i18n';
import { LANGS } from '../src/lib/types';

let fails = 0;
const fail = (m: string) => { fails++; console.log('FAIL  ' + m); };
const ph = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join(',');
// identical to English is fine for these (loanwords, brand, format strings)
const SAME_OK = new Set(['online', 'offline', 'pdf', 'tab_scan', 'privacy', 'back_home', 'details', 'mode_ai', 'page_n', 'pages_n', 'conf_high', 'model', 'copied']);
let n = 0;
for (const [key, six] of Object.entries(STRINGS)) {
  n++;
  if (six.length !== 6) { fail(`${key}: ${six.length} entries`); continue; }
  six.forEach((s, i) => { if (!s.trim()) fail(`${key}: empty for ${LANGS[i]}`); if (ph(s) !== ph(six[0])) fail(`${key}: placeholders differ for ${LANGS[i]} (${ph(s)} vs ${ph(six[0])})`); });
  if (!SAME_OK.has(key) && six[0].length > 6) six.slice(1).forEach((s, i) => { if (s === six[0]) fail(`${key}: ${LANGS[i + 1]} identical to English ("${s}")`); });
}
if (tr('de', 'in_days', { n: 5 }) !== 'in 5 Tagen') fail('tr() placeholder');
if (detectLanguage(['de-AT', 'en']) !== 'de' || detectLanguage(['pt-BR']) !== 'pt' || detectLanguage(['ja-JP', 'fr-CA']) !== 'fr' || detectLanguage(['ja']) !== 'en') fail('detectLanguage');
// components: JSX text nodes / string attributes that look like English words must go through t()
const dir = new URL('../src/components/', import.meta.url);
for (const f of readdirSync(dir).filter((x) => x.endsWith('.tsx') && x !== 'Icons.tsx')) {
  const src = readFileSync(new URL(f, dir), 'utf8');
  for (const m of src.matchAll(/>\s*([A-Z][a-z]+(?: [a-z]+){1,})\s*</g)) fail(`${f}: untranslated JSX text "${m[1]}"`);
  for (const m of src.matchAll(/(?:aria-label|alt|title|placeholder)="([A-Z][a-z]+[^"]*)"/g)) fail(`${f}: untranslated attribute "${m[1]}"`);
}
if (fails) { console.error(`${fails} i18n problem(s)`); process.exit(1); }
console.log(`All i18n checks passed (${n} strings x 6 languages)`);
