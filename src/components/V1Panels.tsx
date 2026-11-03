import { useState } from 'react';
import type { ActionCard } from '../lib/types';
import { useLang, useT } from '../lib/i18n';
import { summaryParts } from '../lib/summary';
import { scamHints, HELP_COUNTRIES, guessCountry, helpFor } from '../lib/hints';
import { IconShield2 } from './Icons';

/** Localised language name ("German" / "allemand" / "Deutsch"), falling back to the code. */
export function langName(code: string | null, ui: string): string | null {
  if (!code) return null;
  try { return new Intl.DisplayNames([ui], { type: 'language' }).of(code) ?? code; } catch { return code; }
}
export function countryName(code: string, ui: string): string {
  if (code === 'EU') return 'EU';
  try { return new Intl.DisplayNames([ui], { type: 'region' }).of(code) ?? code; } catch { return code; }
}

/** Two plain sentences at the top, built from the extracted fields (no AI). */
export function SummaryBox({ card, typeLabel, date, money }: { card: ActionCard; typeLabel: string; date: (iso: string) => string; money: (a: number, c: string) => string }) {
  const t = useT();
  const ul = useLang();
  // mid-sentence: lower-case the label's first letter ("a tax office letter"), except German nouns and acronyms ("TV")
  const type = ul !== 'de' && /^\p{Lu}\p{Ll}/u.test(typeLabel) ? typeLabel[0].toLocaleLowerCase(ul) + typeLabel.slice(1) : typeLabel;
  const [a, b] = summaryParts(card, { date, money, type, lang: langName(card.docLanguage.value, ul) });
  return (
    <section className="plain-summary" data-testid="plain-summary" aria-label={t('sum_title')}>
      <p><strong>{t('sum_title')}:</strong> <span data-testid="sum-1" data-key={a.key}>{t(a.key, a.vars)}</span> <span data-testid="sum-2" data-key={b.key}>{t(b.key, b.vars)}</span></p>
      <p className="small muted">{t('sum_note')}</p>
    </section>
  );
}

export function HintsBox({ card }: { card: ActionCard }) {
  const t = useT();
  const hints = scamHints(card);
  if (!hints.length) return null;
  return (
    <section className="hints" data-testid="scam-hints" data-count={hints.length} aria-labelledby="hints-h">
      <h3 id="hints-h" className="field-label"><IconShield2 size={16} /> {t('hints_title')}</h3>
      <p className="small">{t('hints_intro')}</p>
      <ul>
        {hints.map((h) => (
          <li key={h.key} data-hint={h.key}>{t(h.key)}{h.snippet && <blockquote className="snippet small">“{h.snippet}”</blockquote>}</li>
        ))}
      </ul>
    </section>
  );
}

export function HelpBox({ card }: { card: ActionCard }) {
  const t = useT();
  const ul = useLang();
  const [country, setCountry] = useState(() => guessCountry(card));
  return (
    <details className="help-links seen" data-testid="help-links">
      <summary>{t('help_title')}</summary>
      <p className="small muted">{t('help_intro')}</p>
      <label className="small help-country">{t('help_country')}{' '}
        <select value={country} onChange={(e) => setCountry(e.target.value)} data-testid="help-country">
          {HELP_COUNTRIES.map((c) => <option key={c} value={c}>{countryName(c, ul)}</option>)}
        </select>
      </label>
      <ul>
        {[...helpFor(country), ...(country === 'EU' ? [] : helpFor('EU'))].map((h) => (
          <li key={h.url}><a href={h.url} target="_blank" rel="noopener noreferrer" className="help-link">{h.name}</a> <span className="muted small">{new URL(h.url).hostname.replace(/^www\./, '')}</span></li>
        ))}
      </ul>
    </details>
  );
}
