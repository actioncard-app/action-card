import { useState, type ReactNode } from 'react';
import type { Confidence, Field } from '../lib/types';
import { IconPencil } from './Icons';
import { useT, type Key } from '../lib/i18n';

interface Props<T> {
  name: string;
  label: string;
  icon?: ReactNode;
  hero?: boolean;
  field: Field<T>;
  display: ReactNode;
  extra?: ReactNode;
  renderEditor: (done: (v: T | null) => void, cancel: () => void) => ReactNode;
  onEdit: (v: T | null) => void;
  dataValue?: string;
  missingDisplay?: ReactNode;
  snippetOverride?: ReactNode;
  /** page the snippet comes from (multi-page documents) */
  page?: number | null;
  /** approximate meaning of the snippet, shown under it */
  meaning?: ReactNode;
}

/** Plain words instead of a percentage-like scale: Clear (high), Check this (medium), Guess (low). Same words on screen, in the PDF and for screen readers. */
export const CONF_KEY: Record<Confidence, Key> = { high: 'conf_high', medium: 'conf_medium', low: 'conf_low' };
export function ConfidenceBadge({ c, short }: { c: Confidence | null; short?: boolean }) {
  const t = useT();
  if (!c) return null;
  return <span className={`conf conf-${c} ${short ? 'conf-short' : ''}`} data-conf={c} title={t('conf_title')}><i className="dot" aria-hidden /><span className="sr-only">{t('conf_sr')} </span>{t(CONF_KEY[c])}</span>;
}
export function EditedBadge({ short }: { short?: boolean }) {
  const t = useT();
  return <span className={`conf conf-edited ${short ? 'conf-short' : ''}`} data-conf="edited"><i className="dot" aria-hidden />{short ? t('edited') : t('edited_by_you')}</span>;
}

export default function FieldRow<T>({ name, label, icon, hero, field, display, extra, renderEditor, onEdit, dataValue, missingDisplay, snippetOverride, page, meaning }: Props<T>) {
  const t = useT();
  const [editing, setEditing] = useState(false);
  const missing = field.value === null;
  return (
    <section className={`field ${hero ? 'hero' : ''} ${missing ? 'missing' : ''}`} data-field={name} data-value={dataValue ?? ''}>
      <div className="field-head">
        <span className="field-label">{icon && <span className="field-ic" aria-hidden>{icon}</span>}{label}</span>
        {field.edited ? <EditedBadge /> : <ConfidenceBadge c={field.confidence} />}
      </div>
      {editing ? (
        renderEditor((v) => { onEdit(v); setEditing(false); }, () => setEditing(false))
      ) : (
        <button className="field-value" onClick={() => setEditing(true)} data-testid={`value-${name}`}>
          <span>{missing ? (missingDisplay ?? <span className="notfound">{t('not_found')}</span>) : display}</span>
          <span className="sr-only">{`, ${label}, ${t('tap_to_edit')}`}</span><span className="edit-hint" aria-hidden><IconPencil /></span>
        </button>
      )}
      {snippetOverride}
      {!snippetOverride && field.snippet && (
        <blockquote className="snippet" data-testid={`snippet-${name}`}>
          <span className="snippet-label" data-page={page ?? undefined}>{page ? t('from_page', { n: page }) : t('from_doc')}</span> “{field.snippet}”
        </blockquote>
      )}
      {!snippetOverride && field.snippet && meaning}
      {extra}
      {missing && !field.snippet && !snippetOverride && <p className="small muted">{t('not_in_text')}</p>}
      {field.note && <p className="note">{field.note}</p>}
    </section>
  );
}
