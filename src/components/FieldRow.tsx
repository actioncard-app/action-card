import { useState, type ReactNode } from 'react';
import type { Confidence, Field } from '../lib/types';
import { IconPencil } from './Icons';

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
}

export function ConfidenceBadge({ c, short }: { c: Confidence | null; short?: boolean }) {
  if (!c) return null;
  // short form for the summary chips: plain words instead of a percentage-like scale
  if (short) return <span className={`conf conf-${c} conf-short`} title="How sure the app is about this value"><i className="dot" aria-hidden /><span className="sr-only">Confidence: </span>{c === 'high' ? 'Clear' : c === 'medium' ? 'Check this' : 'Guess'}</span>;
  return <span className={`conf conf-${c}`} title="How sure the app is about this value"><i className="dot" aria-hidden />{c === 'high' ? 'High confidence' : c === 'medium' ? 'Medium confidence' : 'Low confidence'}</span>;
}

export default function FieldRow<T>({ name, label, icon, hero, field, display, extra, renderEditor, onEdit, dataValue, missingDisplay, snippetOverride }: Props<T>) {
  const [editing, setEditing] = useState(false);
  const missing = field.value === null;
  return (
    <section className={`field ${hero ? 'hero' : ''} ${missing ? 'missing' : ''}`} data-field={name} data-value={dataValue ?? ''}>
      <div className="field-head">
        <span className="field-label">{icon && <span className="field-ic" aria-hidden>{icon}</span>}{label}</span>
        {field.edited ? <span className="conf conf-edited"><i className="dot" aria-hidden />Edited by you</span> : <ConfidenceBadge c={field.confidence} />}
      </div>
      {editing ? (
        renderEditor((v) => { onEdit(v); setEditing(false); }, () => setEditing(false))
      ) : (
        <button className="field-value" onClick={() => setEditing(true)} data-testid={`value-${name}`}>
          <span>{missing ? (missingDisplay ?? <span className="notfound">Not found</span>) : display}</span>
          <span className="sr-only">{`, ${label}, tap to edit`}</span><span className="edit-hint" aria-hidden><IconPencil /></span>
        </button>
      )}
      {extra}
      {snippetOverride}
      {!snippetOverride && field.snippet && (
        <blockquote className="snippet" data-testid={`snippet-${name}`}>
          <span className="snippet-label">From the document:</span> “{field.snippet}”
        </blockquote>
      )}
      {missing && !field.snippet && !snippetOverride && <p className="small muted">The app did not find this in the text. Check the original, or tap to add it.</p>}
      {field.note && <p className="note">{field.note}</p>}
    </section>
  );
}
