// Per-split scores (tuning vs held-out) for a cached-OCR set. Usage: npx tsx tests/split-report.ts <ocr.json> <expected.json>
import { readFileSync } from 'node:fs';
import { extractRules } from '../src/lib/extract/index.ts';
import { scoreCard } from './score.ts';
const [src, expFile] = process.argv.slice(2);
const texts = JSON.parse(readFileSync(src, 'utf8'));
const expected = JSON.parse(readFileSync(expFile, 'utf8'));
const acc: Record<string, { core: number; coreN: number; all: number; allN: number; iban: number; ibanN: number; misses: string[] }> = {};
for (const [file, e] of Object.entries<any>(expected)) {
  const card = extractRules(texts[file] ?? '', { userLanguage: 'en' });
  const r: any = scoreCard(file, e, { docLanguage: card.docLanguage.value, docType: card.docType.value, deadline: card.deadline.value, amount: card.amount.value?.amount ?? null, currency: card.amount.value?.currency ?? null, reference: card.reference.value, conf: {}, snippets: {} });
  const s = (acc[e.set] ??= { core: 0, coreN: 0, all: 0, allN: 0, iban: 0, ibanN: 0, misses: [] });
  for (const [k, v] of Object.entries<any>(r.fields ?? r.results ?? {})) {
    const core = ['docType', 'deadline', 'amount', 'currency'].includes(k);
    if (core) { s.coreN++; if (v === true || v?.ok) s.core++; }
    s.allN++; if (v === true || v?.ok) s.all++; else s.misses.push(`${file} ${k}`);
  }
  if ('iban' in e) { s.ibanN++; const got = card.iban?.value?.replace(/\s/g, '') ?? null; if (got === (e.iban?.replace(/\s/g, '') ?? null)) s.iban++; else s.misses.push(`${file} iban exp ${e.iban} got ${card.iban?.value}`); }
}
for (const [k, s] of Object.entries(acc)) console.log(`${k}: core ${s.core}/${s.coreN}, all ${s.all}/${s.allN}, IBAN ${s.iban}/${s.ibanN}\n   ${s.misses.join('\n   ')}`);
