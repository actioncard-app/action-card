// Fast loop: run the rule-based extractor on cached OCR text (produced by the real OCR run)
// and score it against test-docs/expected.json.
// Usage: npx tsx tests/rules-on-cached-ocr.ts [test-results/ocr-text.json] [--min-core=N] [--min-all=N] [--expected=test-docs/phone/expected.json]
// tests/fixtures/ocr-text.json is a committed copy of the OCR text from the final browser run, so CI can run this
// regression check without browsers or the sample images. With --min-* it exits 1 if the score drops below N.
import { readFileSync } from 'node:fs';
import { extractRules } from '../src/lib/extract/index.ts';
import { scoreCard, printReport } from './score.ts';

const src = process.argv.slice(2).find((a) => !a.startsWith('--')) ?? 'test-results/ocr-text.json';
const texts: Record<string, string> = JSON.parse(readFileSync(src, 'utf8'));
const expFile = process.argv.find((a) => a.startsWith('--expected='))?.split('=')[1] ?? 'test-docs/expected.json';
const expected = JSON.parse(readFileSync(expFile, 'utf8'));
const rows = Object.entries(expected).map(([file, e]: [string, any]) => {
  const card = extractRules(texts[file] ?? '', { userLanguage: 'en' });
  return scoreCard(file, e, {
    docLanguage: card.docLanguage.value, docType: card.docType.value, deadline: card.deadline.value,
    amount: card.amount.value?.amount ?? null, currency: card.amount.value?.currency ?? null, reference: card.reference.value,
    conf: { docType: card.docType.confidence, deadline: card.deadline.confidence, amount: card.amount.confidence },
    snippets: { deadline: card.deadline.snippet, amount: card.amount.snippet },
  });
});
const res = printReport(rows, process.argv.includes('--verbose'));
const min = (k: string) => Number(process.argv.find((a) => a.startsWith(`--min-${k}=`))?.split('=')[1] ?? 0);
if (res.coreOk < min('core') || res.ok < min('all')) {
  console.error(`REGRESSION: core ${res.coreOk} (min ${min('core')}), all ${res.ok} (min ${min('all')})`);
  process.exit(1);
}
