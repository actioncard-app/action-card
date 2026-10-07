import { createWorker } from 'tesseract.js';
import { readFileSync, writeFileSync } from 'node:fs';
const exp = JSON.parse(readFileSync('test-docs/expected.json', 'utf8'));
const map = { en: 'eng', de: 'deu', fr: 'fra', es: 'spa', it: 'ita', pt: 'por' };
const out = {};
for (const [file, e] of Object.entries(exp)) {
  const w = await createWorker(map[e.docLanguage], 1, { langPath: process.cwd() + '/public/tesseract/lang', cacheMethod: 'none' });
  const t0 = Date.now();
  const { data } = await w.recognize('test-docs/' + file);
  out[file] = data.text;
  console.log('==', file, data.confidence, Date.now() - t0, 'ms\n' + data.text);
  await w.terminate();
}
writeFileSync('test-results/node-ocr-text.json', JSON.stringify(out, null, 2));
