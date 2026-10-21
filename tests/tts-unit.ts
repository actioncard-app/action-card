// Unit tests for the natural voice text pipeline: English number/date/money normalization, sentence split,
// lexicon + suffix rules + letter-to-sound phonemes (Kokoro symbols), pack manifest integrity.
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { cardinal, ordinal, year, normalizeEn, splitSentences, parseAmount, shortFirst } from '../src/lib/tts/en-normalize.ts';
import { lts, morph, phonemizeEn, phonemizeSentence, wordsFor } from '../src/lib/tts/en-g2p.ts';
import { splitPlain, hasNeuralFor, packMB, neuralVoiceFor, PACK_INFO, RELEASE_BASE } from '../src/lib/tts/neural.ts';
import PACKS from '../src/lib/tts/voice-packs.json';

let n = 0; const ok = (name: string, f: () => void | Promise<void>) => Promise.resolve(f()).then(() => { n++; console.log('PASS ', name); });
const strip = (s: string) => s.replace(/\u2063/g, '');

await ok('cardinals', () => {
  assert.equal(cardinal(0), 'zero'); assert.equal(cardinal(45), 'forty five'); assert.equal(cardinal(100), 'one hundred');
  assert.equal(cardinal(1234), 'one thousand two hundred thirty four'); assert.equal(cardinal(2000000), 'two million');
});
await ok('ordinals and years', () => {
  assert.equal(ordinal(1), 'first'); assert.equal(ordinal(2), 'second'); assert.equal(ordinal(30), 'thirtieth'); assert.equal(ordinal(21), 'twenty first'); assert.equal(ordinal(12), 'twelfth');
  assert.equal(year(2026), 'twenty twenty six'); assert.equal(year(2005), 'two thousand five'); assert.equal(year(1999), 'nineteen ninety nine'); assert.equal(year(1905), 'nineteen oh five');
});
await ok('amount parsing', () => {
  assert.deepEqual(parseAmount('45,50'), { whole: 45, cents: 50 }); assert.deepEqual(parseAmount('1.234,56'), { whole: 1234, cents: 56 });
  assert.deepEqual(parseAmount('1,234.5'), { whole: 1234, cents: 50 }); assert.deepEqual(parseAmount('1.234'), { whole: 1234, cents: 0 });
});
await ok('money', () => {
  assert.match(normalizeEn('Pay €45.50 now.'), /forty five euros and fifty cents/);
  assert.match(normalizeEn('Total 1.234,56 EUR'), /one thousand two hundred thirty four euros and fifty six cents/);
  assert.match(normalizeEn('Fee: £1'), /one pound/); assert.match(normalizeEn('$12'), /twelve dollars/);
});
await ok('dates', () => {
  assert.match(normalizeEn('due by 30.11.2026.'), /November thirtieth, twenty twenty six/);
  assert.match(normalizeEn('on 2026-03-01'), /March first, twenty twenty six/);
  assert.match(normalizeEn('until 11/30/2026'), /November thirtieth/);
  assert.match(normalizeEn('by 5 May 2026'), /May fifth, twenty twenty six/);
  assert.match(normalizeEn('by March 3rd, 2027'), /March third, twenty twenty seven/);
});
await ok('times, percent, ordinals, ranges, codes, abbreviations', () => {
  assert.match(normalizeEn('at 14:30'), /fourteen thirty/); assert.match(normalizeEn('at 9:05 am'), /nine oh five A M/);
  assert.match(normalizeEn('5% interest'), /five percent/); assert.match(normalizeEn('the 2nd reminder'), /second reminder/);
  assert.match(normalizeEn('pages 10-12'), /ten to twelve/);
  assert.match(strip(normalizeEn('Ref AB12-3')), /A B one two three/);
  assert.match(normalizeEn('Dear Mr. Smith, e.g. this'), /Dear Mister Smith, for example this/);
  assert.match(normalizeEn('Call 030 1234567'), /zero three zero one two three four five six seven/);
  assert.doesNotMatch(normalizeEn('Invoice 2026 dated 30.11.2026, amount €45 (approx. 5%) at 14:30'), /\d/);
});
await ok('short first piece for fast start', () => {
  const r = shortFirst(['Dear Mister Ferguson, your parking fine of forty five euros is due by November thirtieth.', 'Two.']);
  assert.deepEqual(r, ['Dear Mister Ferguson,', 'your parking fine of forty five euros is due by November thirtieth.', 'Two.']);
  assert.deepEqual(shortFirst(['Short one.']), ['Short one.']);
});
await ok('sentence split keeps pieces short', () => {
  const s = splitSentences('One. Two words here! ' + 'very long clause, '.repeat(30) + 'end.');
  assert.ok(s.length >= 3); assert.ok(s.every((x) => x.length <= 220));
});
const D = new Map(Object.entries({ remind: 'ɹəmˈInd', reminder: 'ɹəmˈIndəɹ', invoice: 'ˈɪnvˌYs', euro: 'jˈʊɹO', pay: 'pˈA', payment: 'pˈAmənt', dead: 'dˈɛd', line: 'lˈIn', deadline: 'dˈɛdlˌIn', box: 'bˈɑks', walk: 'wˈɔk', want: 'wˈɑnt', city: 'sˈɪɾi', the: 'ði', your: 'jʊɹ' }));
await ok('suffix rules', () => {
  assert.equal(morph(D, 'reminders'), 'ɹəmˈIndəɹz'); assert.equal(morph(D, 'invoices'), 'ˈɪnvˌYsᵻz'); assert.equal(morph(D, 'euros'), 'jˈʊɹOz');
  assert.equal(morph(D, 'boxes'), 'bˈɑksᵻz'); assert.equal(morph(D, 'walked'), 'wˈɔkt'); assert.equal(morph(D, 'wanted'), 'wˈɑntᵻd');
  assert.equal(morph(D, 'cities'), 'sˈɪɾiz'); assert.equal(morph(D, 'paying'), 'pˈAɪŋ'); assert.equal(morph(D, 'deadlines'), 'dˈɛdlˌInz');
});
await ok('letter-to-sound for names', () => {
  assert.equal(lts('Ferguson'), 'fˈɜɹɡəsən'); assert.equal(lts('Benji'), 'bˈɛnʤi');
  for (const w of ['Schmidt', 'Okonkwo', 'Nguyen', 'Müller', 'Xochitl']) assert.ok(/[ˈ]/.test(lts(w)) && lts(w).length >= 2, w);
});
await ok('sentence phonemes use only Kokoro symbols', () => {
  const ipa = phonemizeSentence(D, 'Pay your reminders, Ferguson.');
  assert.equal(ipa, 'pˈA jʊɹ ɹəmˈIndəɹz, fˈɜɹɡəsən.');
  const KOKORO = new Set([...';:,.!?—…"()“” ̃ʣʥʦʨᵝꭧAIOQSTWYᵊabcdefhijklmnopqrstuvwxyzɑɐɒæβɔɕçɖðʤəɚɛɜɟɡɥɨɪʝɯɰŋɳɲɴøɸθœɹɾɻʁɽʂʃʈʧʊʋʌɣɤχʎʒʔˈˌːʰʲ↓→↗↘ᵻ']);
  for (const ch of phonemizeSentence(D, 'The city of Xochitl Nguyen, deadline boxes.')) assert.ok(KOKORO.has(ch), `symbol ${ch}`);
});
await ok('wordsFor asks for bases', () => {
  const w = wordsFor(['Reminders and deadlines.']);
  for (const x of ['reminders', 'reminder', 'deadlines', 'deadline', 'and']) assert.ok(w.includes(x), x);
});
await ok('full pipeline with lookup', async () => {
  const r = await phonemizeEn('Dear Mr. Ferguson, pay €45 by 30.11.2026. Thank you.', async (ws) => Object.fromEntries(ws.filter((w) => D.has(w)).map((w) => [w, D.get(w)!])));
  assert.equal(r.ipa.length, 3); assert.ok(r.ipa[0].includes('fˈɜɹɡəsən')); assert.ok(!/\d/.test(r.ipa.join('')));
});
await ok('real lexicon (when present on this machine)', async () => {
  const p = '/workspace/tts/packs/en/lexicon-en.txt';
  if (!existsSync(p)) return;
  const L = new Map<string, string>();
  for (const line of readFileSync(p, 'utf8').split('\n')) { const i = line.indexOf(' '); if (i > 0) L.set(line.slice(0, i), line.slice(i + 1)); }
  const text = 'Dear Mr. Ferguson, your parking fine of €45.50 is due by 30.11.2026. Please pay the reminders and invoices using reference AB12-345. If you have already paid, you can ignore this letter.';
  const r = await phonemizeEn(text, async (ws) => Object.fromEntries(ws.filter((w) => L.has(w)).map((w) => [w, L.get(w)!])));
  assert.equal(r.ipa.length, 4); assert.ok(r.ipa.every((x) => x.length > 10));
});
await ok('plain split for the other languages', () => {
  assert.deepEqual(splitPlain('Sehr geehrter Herr Müller,\nbitte zahlen Sie. Danke!'), ['Sehr geehrter Herr Müller, bitte zahlen Sie.', 'Danke!']);
});
await ok('pack manifest', () => {
  assert.equal(RELEASE_BASE, 'https://github.com/actioncard-app/action-card/releases/download/voices-v1/');
  for (const l of ['de', 'es', 'fr', 'pl', 'pt', 'ro']) {
    const p = (PACKS.packs as any)[l]; assert.ok(p, l);
    assert.deepEqual(p.files.map((f: any) => f.name).sort(), ['model.onnx', 'tokens.txt']);
    for (const f of p.files) { assert.match(f.sha256, /^[0-9a-f]{64}$/); assert.ok(f.bytes > 0); assert.ok(f.asset.startsWith(`voice-${l}-v1-`)); }
    assert.ok(packMB(l + '-XX') > 50);
  }
  assert.ok(!('uk' in PACK_INFO), 'Ukrainian excluded: M-AILABS Ukrainian audio is for machine learning only');
  assert.ok(hasNeuralFor('de-DE') && hasNeuralFor('en-GB') && !hasNeuralFor('tr-TR') && !hasNeuralFor('it-IT'));
  assert.equal(neuralVoiceFor('en-US', 'male').name, 'Michael'); assert.equal(neuralVoiceFor('en-US', 'auto').name, 'Heart');
  assert.equal(neuralVoiceFor('de-DE', 'female').matched, false);
});
console.log(`\n${n} tts checks passed`);
