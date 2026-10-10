// WCAG AA contrast check of the colour tokens in src/styles.css, light AND dark (no browser needed).
// Every text/background pair the UI uses must reach 4.5:1. Usage: node tests/ui-contrast.mjs
import { readFileSync } from 'node:fs';
const css = readFileSync(new URL('../src/styles.css', import.meta.url), 'utf8');
const block = (re) => { const m = css.match(re); if (!m) throw new Error('token block not found: ' + re); return Object.fromEntries([...m[1].matchAll(/--([\w-]+):\s*(#[0-9a-fA-F]{6})/g)].map((x) => [x[1], x[2]])); };
const light = block(/:root \{([\s\S]*?)\n\}/);
const dark = { ...light, ...block(/prefers-color-scheme: dark\) \{\s*:root \{([\s\S]*?)\n  \}/) };
const lum = (h) => { const c = [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; };
const ratio = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
// [text token, background token] pairs as used in styles.css
const PAIRS = [['ink', 'bg'], ['ink', 'surface'], ['ink', 'sunken'], ['ink', 'primary-soft'], ['muted', 'bg'], ['muted', 'surface'], ['muted', 'surface-2'], ['muted', 'sunken'],
  ['faint', 'bg'], ['faint', 'surface'], ['primary-ink', 'primary'], ['link', 'bg'], ['link', 'surface'], ['link', 'primary-soft'],
  ['high', 'bg'], ['high', 'surface'], ['high', 'high-soft'], ['med', 'surface'], ['med', 'med-soft'], ['med', 'accent-soft'], ['low', 'surface'], ['low', 'low-soft'],
  ['edit', 'surface'], ['warn-ink', 'warn-bg'], ['danger', 'bg'], ['danger', 'danger-soft'], ['next-ink', 'next-a'], ['next-ink', 'next-b'], ['next-muted', 'next-a'], ['next-muted', 'next-b']];
// Secondary/help text is small: hold it to WCAG AAA (7:1) on every surface it sits on.
const AAA = [['muted', 'bg'], ['muted', 'surface'], ['muted', 'surface-2'], ['muted', 'sunken'], ['faint', 'bg'], ['faint', 'surface'], ['faint', 'surface-2'], ['faint', 'sunken'], ['next-muted', 'next-a'], ['next-muted', 'next-b']];
let fails = 0;
for (const [name, t] of [['light', light], ['dark', dark]]) {
  for (const [fg, bg] of PAIRS) {
    if (!t[fg] || !t[bg]) { console.log(`FAIL ${name}: missing token ${fg} or ${bg}`); fails++; continue; }
    const r = ratio(t[fg], t[bg]);
    if (r < 4.5) { console.log(`FAIL ${name}: ${fg} on ${bg} = ${r.toFixed(2)}`); fails++; }
  }
  for (const [fg, bg] of AAA) {
    const r = ratio(t[fg], t[bg]);
    if (r < 7) { console.log(`FAIL ${name}: secondary text ${fg} on ${bg} = ${r.toFixed(2)} (< 7:1)`); fails++; }
  }
  const min = Math.min(...PAIRS.filter(([f, b]) => t[f] && t[b]).map(([f, b]) => ratio(t[f], t[b])));
  console.log(`${name}: ${PAIRS.length} pairs, lowest contrast ${min.toFixed(2)}:1`);
}
if (fails) { console.error(`${fails} contrast failure(s)`); process.exit(1); }
console.log('All colour pairs meet WCAG AA (4.5:1); secondary text meets 7:1');
