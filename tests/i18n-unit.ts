// i18n checks: every interface string exists in all six languages, placeholders match, nothing obviously untranslated
// (same as English in a language where it should differ), and no plain English text left in component JSX.
import { readFileSync, readdirSync } from 'node:fs';
import { STRINGS, EXTRA, tr, detectLanguage } from '../src/lib/i18n';
import { LANGS } from '../src/lib/types';

let fails = 0;
const fail = (m: string) => { fails++; console.log('FAIL  ' + m); };
const ph = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join(',');
// identical to English is fine for these (loanwords, brand, format strings)
const SAME_OK = new Set(['pro_title', 'online', 'offline', 'pdf', 'tab_scan', 'privacy', 'back_home', 'details', 'mode_ai', 'page_n', 'pages_n', 'conf_high', 'model', 'copied']);
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
// UI-only languages: every key present, same placeholders, script sanity (Cyrillic / Arabic), not left in English
const SCRIPT: Record<string, RegExp> = { ru: /[\u0400-\u04FF]/, uk: /[\u0400-\u04FF]/, ar: /[\u0600-\u06FF]/ };
for (const [lang, dict] of Object.entries(EXTRA)) {
  for (const key of Object.keys(STRINGS) as (keyof typeof STRINGS)[]) {
    const s = (dict as Record<string, string>)[key];
    if (!s || !s.trim()) { fail(`${lang}.${key}: missing`); continue; }
    if (ph(s) !== ph(STRINGS[key][0])) fail(`${lang}.${key}: placeholders differ`);
    if (!SAME_OK.has(key) && STRINGS[key][0].length > 6 && s === STRINGS[key][0]) fail(`${lang}.${key}: identical to English`);
    if (SCRIPT[lang] && !SAME_OK.has(key) && STRINGS[key][0].length > 12 && !SCRIPT[lang].test(s)) fail(`${lang}.${key}: no ${lang} script`);
  }
  for (const key of Object.keys(dict)) if (!(key in STRINGS)) fail(`${lang}.${key}: unknown key`);
}
if (tr('ar', 'in_days', { n: 5 }) !== 'بعد 5 يوم' || tr('ru', 'tab_saved') !== 'Сохранённые') fail('tr() extra languages');
if (detectLanguage(['uk-UA']) !== 'uk' || detectLanguage(['ar-EG']) !== 'ar') fail('detectLanguage extra');
if (fails) { console.error(`${fails} i18n problem(s)`); process.exit(1); }
console.log(`All i18n checks passed (${n} strings x 6 languages + ${Object.keys(EXTRA).length} UI-only languages)`);
