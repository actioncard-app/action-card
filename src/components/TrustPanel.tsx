import type { ActionCard } from '../lib/types';
import { useLang, useT, type TFn } from '../lib/i18n';
import { DIR_KEY, glossTerms, type DirectionResult, type CheckKey } from '../lib/trust';
export { DIR_KEY, MEAN_KEY } from '../lib/trust';
import { stepsFor } from '../lib/steps';
import { ConfidenceBadge } from './FieldRow';
import { IconAlert, IconCheck } from './Icons';


/** "Who pays" line under the money field: label + confidence + the words it is based on. */
export function DirectionLine({ dir, amountSnippet }: { dir: DirectionResult; amountSnippet?: string | null }) {
  const t = useT();
  const norm = (s: string) => s.replace(/\s+/g, ' ').trim();
  // same words as the amount quote above: don't quote them twice
  const same = !!dir.snippet && !!amountSnippet && norm(amountSnippet).includes(norm(dir.snippet));
  return (
    <div className={`direction dir-${dir.value}`} data-testid="money-direction" data-direction={dir.value}>
      <div className="dir-head"><span className="field-label">{t('dir_label')}</span><strong className="dir-value">{t(DIR_KEY[dir.value])}</strong><ConfidenceBadge c={dir.confidence} /></div>
      {same ? null : dir.snippet ? <blockquote className="snippet" data-testid="direction-snippet"><span className="snippet-label">{t('from_doc')}</span> “{dir.snippet}”</blockquote>
        : <p className="small muted">{t('dir_unclear_note')}</p>}
      {dir.noPayment && <p className="note" data-testid="no-payment">{t('no_payment')} “{dir.noPayment}”</p>}
    </div>
  );
}

/** Approximate meaning of a quoted snippet in the interface language. Not a translation: the value the app read,
 *  phrased by a template, plus a glossary of words it recognised in the snippet. Hidden when the document is
 *  already in the interface language. AI mode does not add a translation here (kept rules-only and offline). */
export function Meaning({ card, snippet, sentence, testid }: { card: ActionCard; snippet: string | null | undefined; sentence: string | null; testid: string }) {
  const t = useT();
  const ul = useLang();
  if (!snippet || card.docLanguage.value === ul) return null;
  const terms = glossTerms(snippet);
  if (!sentence && !terms.length) return null;
  return (
    <div className="meaning" data-testid={`meaning-${testid}`} title={t('meaning_title')}>
      <span className="meaning-label">{t('meaning_label')}</span>{' '}
      {sentence && <span className="meaning-text">{sentence}</span>}
      {terms.length > 0 && <span className="meaning-words"> {t('meaning_words')} {terms.map(([w, c], i) => <span key={i} className="gloss"><q lang={card.docLanguage.value ?? undefined}>{w}</q> = {t(c)}{i < terms.length - 1 ? '; ' : ''}</span>)}</span>}
      <span className="sr-only">. {t('meaning_title')}</span>
    </div>
  );
}

export function StepsBox({ card, onToggle }: { card: ActionCard; onToggle: (i: number) => void }) {
  const t = useT();
  const steps = stepsFor(card);
  const done = new Set(card.stepsDone ?? []);
  const n = steps.filter((_, i) => done.has(i)).length;
  return (
    <section className="steps" data-testid="steps" aria-labelledby="steps-h">
      <div className="steps-head"><h3 id="steps-h" className="field-label">{t('steps_title')}</h3><span className="small muted" data-testid="steps-count">{t('steps_done', { n, m: steps.length })}</span></div>
      <ol>
        {steps.map((s, i) => (
          <li key={i} className={done.has(i) ? 'done' : ''}>
            <label><input type="checkbox" checked={done.has(i)} onChange={() => onToggle(i)} data-testid={`step-${i}`} /><span>{s}</span></label>
          </li>
        ))}
      </ol>
      <p className="small muted">{t('steps_hint')}</p>
    </section>
  );
}

export function CheckBox({ items }: { items: CheckKey[] }) {
  const t = useT();
  return (
    <section className={`checkbox ${items.length ? '' : 'clear'}`} data-testid="needs-checking" data-count={items.length} aria-labelledby="check-h">
      <h3 id="check-h" className="field-label">{items.length ? <IconAlert size={16} /> : <IconCheck size={16} />} {t('check_title')}</h3>
      {items.length ? <ul>{items.map((k) => <li key={k} data-check={k}>{t(k)}</li>)}</ul> : <p className="small">{t('check_none')}</p>}
    </section>
  );
}

export const checkLines = (items: CheckKey[], t: TFn) => items.map((k) => t(k));
