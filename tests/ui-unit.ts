// Unit tests for small UI helpers: saved-list grouping, short date format, calendar file.
import { groupCards } from '../src/lib/saved';
import { formatDateShort } from '../src/lib/templates';
import { buildIcs } from '../src/lib/share';
import type { SavedCard, ActionCard } from '../src/lib/types';

let fails = 0;
const eq = (name: string, got: unknown, exp: unknown) => {
  const ok = JSON.stringify(got) === JSON.stringify(exp);
  if (!ok) fails++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok ? '' : `  got ${JSON.stringify(got)} expected ${JSON.stringify(exp)}`}`);
};
const card = (id: string, deadline: string | null, createdAt = 0): SavedCard => ({
  id, createdAt, thumbnail: '',
  card: { id, createdAt, deadline: { value: deadline, snippet: null, confidence: 'high', kind: 'deadline' }, nextAction: { text: 'x' }, reference: { value: null } } as unknown as ActionCard,
});
const now = new Date(2026, 9, 10);
const g = groupCards([card('a', '2026-11-01'), card('b', '2026-09-01'), card('c', null, 1), card('d', '2026-10-12'), card('e', '2026-10-01'), card('f', null, 5), card('t', '2026-10-10')], now);
eq('overdue: most recently missed first', g.overdue.map((c) => c.id), ['e', 'b']);
eq('upcoming: nearest deadline first, today counts as upcoming', g.upcoming.map((c) => c.id), ['t', 'd', 'a']);
eq('no deadline: newest saved first', g.none.map((c) => c.id), ['f', 'c']);

eq('short date en', formatDateShort('2026-10-19', 'en'), '19 Oct 2026');
eq('short date de', /^19\. Okt\.? 2026$/.test(formatDateShort('2026-10-19', 'de')), true);
for (const l of ['fr', 'es', 'it', 'pt'] as const) {
  const s = formatDateShort('2026-10-19', l);
  eq(`short date ${l} is "19 <month> 2026", no "de"`, /^19 \S+ 2026$/.test(s), true);
}

const ics = buildIcs(card('z', '2026-10-19').card, 'Parking fine', new Date(Date.UTC(2026, 9, 9, 12)))!;
eq('ics: all-day start/end', /DTSTART;VALUE=DATE:20261019\r\nDTEND;VALUE=DATE:20261020/.test(ics), true);
eq('ics: CRLF line endings, lines <= 75 octets', ics.split('\r\n').every((l) => new TextEncoder().encode(l).length <= 75), true);
eq('ics: no date -> null', buildIcs(card('n', null).card, 'x'), null);

// multi-page: page 1 has the case number, page 2 the amount and deadline; edits survive adding a page
{
  const { extractRules } = await import('../src/lib/extract');
  const { addPage, pageOf, textWithMarkers, combinedConfidence } = await import('../src/lib/pages');
  const p1 = 'Stadt Musterhausen - Ordnungsamt\nVerwarnung mit Verwarnungsgeld\nAktenzeichen: 731.22.904417.3\nIhnen wird vorgeworfen, am 02.10.2026 im Halteverbot geparkt zu haben.\nDie Zahlungsfrist finden Sie auf Seite 2.';
  const p2 = 'Verwarnungsgeld: 55,00 €\nBitte überweisen Sie den Betrag bis zum 30.10.2026 unter Angabe des Aktenzeichens.\nMit freundlichen Grüßen';
  const c1 = { ...extractRules(p1, { userLanguage: 'en', ocrConfidence: 90 }), pages: [{ text: p1, confidence: 90 }] };
  eq('page 1 alone: no amount', c1.amount.value, null);
  const c2 = addPage(c1, { text: p2, confidence: 80 }, null);
  eq('2 pages: amount from page 2', c2.amount.value, { amount: 55, currency: 'EUR' });
  eq('2 pages: deadline from page 2', c2.deadline.value, '2026-10-30');
  eq('2 pages: same card id', c2.id, c1.id);
  eq('2 pages: snippet page numbers (amount p2, reference p1)', [pageOf(c2, c2.amount.snippet), pageOf(c2, c2.reference.snippet)], [2, 1]);
  eq('2 pages: markers in full text', /— Page 1 —[\s\S]*— Page 2 —/.test(textWithMarkers(c2, (n) => `Page ${n}`)), true);
  eq('2 pages: OCR confidence weighted by text length', Math.round(combinedConfidence(c2.pages!)!), Math.round((90 * p1.length + 80 * p2.length) / (p1.length + p2.length)));
  const edited = { ...c1, reference: { ...c1.reference, value: 'MY-REF', edited: true } };
  const c3 = addPage(edited, { text: p2, confidence: 80 }, null);
  eq('edited value kept after adding a page; reply uses it', [c3.reference.value, /MY-REF/.test(c3.reply.docText)], ['MY-REF', true]);
  eq('single-page card: no page numbers', pageOf(c1, c1.reference.snippet), null);
}

if (fails) { console.error(`${fails} UI unit test(s) failed`); process.exit(1); }
console.log('All UI unit tests passed');
