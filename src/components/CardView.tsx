import { useState } from 'react';
import type { ActionCard, DocType, Lang, Money } from '../lib/types';
import { DOC_TYPES, LANGS, LANG_NAMES } from '../lib/types';
import { DISCLAIMER, DOC_TYPE_LABEL, formatDate, formatMoney } from '../lib/templates';
import { calcText } from '../lib/extract/relative';
import { daysUntil, regenerateActions } from '../lib/extract';
import { exportPdf } from '../lib/pdf';
import { downloadIcs, shareText, summaryText } from '../lib/share';
import FieldRow, { ConfidenceBadge } from './FieldRow';
import { IconAlert, IconArrow, IconCalendar, IconCoins, IconDownload, IconPlus, IconCheck, IconShare } from './Icons';
import type { Current } from '../App';

interface Props { current: Current; onChange: (c: ActionCard) => void; onSave: () => Promise<void>; onNew: () => void }

const CURRENCIES = ['EUR', 'GBP', 'USD', 'CHF', 'BRL'];

export function countdown(d: number): { cls: string; txt: string } {
  const cls = d < 0 ? 'past' : d <= 3 ? 'urgent' : d <= 14 ? 'soon' : 'ok';
  const txt = d < 0 ? `${-d} day${d === -1 ? '' : 's'} ago` : d === 0 ? 'Today' : d === 1 ? 'Tomorrow' : `in ${d} days`;
  return { cls, txt };
}

function Days({ iso, testid = 'days-left' }: { iso: string; testid?: string }) {
  const { cls, txt } = countdown(daysUntil(iso));
  return <span className={`days ${cls}`} data-testid={testid}>{txt}</span>;
}

function SimpleEditor({ initial, type, done, cancel }: { initial: string; type: string; done: (v: string | null) => void; cancel: () => void }) {
  const [v, setV] = useState(initial);
  return (
    <div className="editor">
      <input type={type} value={v} onChange={(e) => setV(e.target.value)} autoFocus />
      <div className="editor-actions">
        <button className="btn small primary" onClick={() => done(v.trim() ? v.trim() : null)}>Save</button>
        <button className="btn small ghost" onClick={cancel}>Cancel</button>
      </div>
    </div>
  );
}

export default function CardView({ current, onChange, onSave, onNew }: Props) {
  const { card, thumbnail, photo, saved } = current;
  const L = card.userLanguage;
  const [showPhoto, setShowPhoto] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [photoUrl] = useState(() => (photo ? URL.createObjectURL(photo) : null));
  const type: DocType = card.docType.value ?? 'unknown';

  const edit = (patch: Partial<ActionCard>) => onChange(regenerateActions({ ...card, ...patch }));
  const copy = async (k: string, t: string) => {
    try { await navigator.clipboard.writeText(t); setCopied(k); setTimeout(() => setCopied(null), 1500); } catch { /* clipboard blocked */ }
  };
  const dlLabel = card.deadline.kind === 'expiry' ? 'Expiry / use by' : card.deadline.kind === 'appointment' ? 'Appointment date' : 'Deadline';

  return (
    <article className="card screen" data-testid="action-card" data-mode={card.mode}>
      <header className="card-top">
        <button className="thumb" onClick={() => setShowPhoto(!showPhoto)} aria-label="Show original photo">
          <img src={thumbnail} alt="Original document" />
        </button>
        <div className="card-head">
          <div className="card-type" data-testid="card-type">{DOC_TYPE_LABEL[type][L]}</div>
          <div className="small muted">{new Date(card.createdAt).toLocaleString()} · {card.mode === 'ai' ? 'AI mode' : 'Offline rules'}</div>
          <button className="linklike small" onClick={() => setShowPhoto(!showPhoto)}>{showPhoto ? 'Hide original' : 'Check the original photo'}</button>
        </div>
      </header>
      <section className="todo" aria-label="What to do">
        <div className="todo-chips">
          <div className={`sum-chip ${card.deadline.value ? '' : 'empty'}`}>
            <span className="sum-label"><IconCalendar size={14} /> {dlLabel}</span>
            <span className="sum-value">{card.deadline.value ? formatDate(card.deadline.value, L) : 'Not found'}</span>
            <span className="sum-foot">{card.deadline.value && <Days iso={card.deadline.value} testid="summary-days" />}{card.deadline.edited ? <span className="conf conf-edited conf-short"><i className="dot" aria-hidden />Edited</span> : card.deadline.value !== null && <ConfidenceBadge c={card.deadline.confidence} short />}</span>
          </div>
          <div className={`sum-chip ${card.amount.value ? '' : 'empty'}`}>
            <span className="sum-label"><IconCoins size={14} /> Money at stake</span>
            <span className="sum-value">{card.amount.value ? formatMoney(card.amount.value.amount, card.amount.value.currency, L) : 'Not found'}</span>
            <span className="sum-foot">{card.amount.edited ? <span className="conf conf-edited conf-short"><i className="dot" aria-hidden />Edited</span> : card.amount.value !== null && <ConfidenceBadge c={card.amount.confidence} short />}</span>
          </div>
        </div>
        <section className="next" data-testid="next-action">
          <div className="field-label light"><span className="field-ic" aria-hidden><IconArrow size={16} /></span>Your next action</div>
          <EditableText value={card.nextAction.text} onSave={(t) => onChange({ ...card, nextAction: { text: t, edited: true } })} className="next-text" />
        </section>
        <div className="todo-actions">
          {card.deadline.value && <button className="btn small secondary" onClick={() => downloadIcs(card, DOC_TYPE_LABEL[type][L])} data-testid="remind-btn"><IconCalendar size={18} /> Remind me</button>}
          <button className="btn small ghost" onClick={async () => { const r = await shareText(DOC_TYPE_LABEL[type][L], summaryText(card, DOC_TYPE_LABEL[type][L], (i) => formatDate(i, L), (a, c) => formatMoney(a, c, L))); if (r === 'copied') { setCopied('share'); setTimeout(() => setCopied(null), 1500); } }} data-testid="share-btn"><IconShare size={18} /> {copied === 'share' ? 'Copied ✓' : 'Share'}</button>
        </div>
      </section>
      {showPhoto && photoUrl && <img className="full-photo" src={photoUrl} alt="Original document" />}
      <div className="disclaimer" role="note" data-testid="disclaimer"><IconAlert /> <span>{DISCLAIMER[L]}</span></div>
      <div className="section-title">Where this comes from</div>
      {card.modeNote && <div className="alert info" data-testid="mode-note">{card.modeNote}</div>}

      <FieldRow<string>
        name="deadline" label={dlLabel} icon={<IconCalendar size={16} />} hero field={card.deadline} dataValue={card.deadline.value ?? ''}
        display={card.deadline.value ? <>{formatDate(card.deadline.value, L)} <Days iso={card.deadline.value} /></> : null}
        onEdit={(v) => edit({ deadline: { ...card.deadline, value: v, edited: true } })}
        renderEditor={(done, cancel) => <SimpleEditor initial={card.deadline.value ?? ''} type="date" done={done} cancel={cancel} />}
        missingDisplay={card.deadline.calc ? <span className="relative-unknown" data-testid="relative-unknown">{calcText(card.deadline.calc, (i) => formatDate(i, L))}</span> : undefined}
        snippetOverride={card.deadline.calc && !card.deadline.edited ? (
          <div className="calc" data-testid="snippet-deadline">
            <blockquote className="snippet"><span className="snippet-label">Rule in the document:</span> “{card.deadline.calc.ruleSnippet}”</blockquote>
            {card.deadline.calc.base
              ? <blockquote className="snippet"><span className="snippet-label">Start date in the document ({card.deadline.calc.base.label}):</span> “{card.deadline.calc.base.snippet}”</blockquote>
              : <p className="note">No start date found in the document. The app does not assume today's date.</p>}
            {card.deadline.calc.resultIso && <div className="math" data-testid="deadline-math">Calculation: {calcText(card.deadline.calc, (i) => formatDate(i, L))}</div>}
          </div>
        ) : undefined}
        extra={<>{(card.otherDeadlines?.length ?? 0) > 0 && (
          <details className="seen" data-testid="other-deadlines">
            <summary>Other deadlines in the document ({card.otherDeadlines!.length})</summary>
            <ul>
              {card.otherDeadlines!.map((d, i) => (
                <li key={i}>
                  {d.iso && <button className="btn tiny ghost" onClick={() => edit({ deadline: { ...card.deadline, value: d.iso, snippet: d.snippet, calc: d.calc, confidence: 'low', edited: true } })}>Use</button>}
                  <strong>{d.iso ? formatDate(d.iso, L) : 'Date unknown'}</strong> <span className="muted">“{d.snippet}”{d.calc ? ` · ${calcText(d.calc, (x) => formatDate(x, L))}` : ''}</span>
                </li>
              ))}
            </ul>
          </details>
        )}{card.datesSeen.length > 0 && (
          <details className="seen">
            <summary>All dates found in the document ({card.datesSeen.length})</summary>
            <ul>
              {card.datesSeen.map((d, i) => (
                <li key={i}>
                  <button className="btn tiny ghost" onClick={() => edit({ deadline: { ...card.deadline, value: d.iso, snippet: d.snippet, edited: true } })}>Use</button>
                  <strong>{formatDate(d.iso, L)}</strong> <span className="muted">“{d.snippet}”</span>
                </li>
              ))}
            </ul>
          </details>
        )}</>}
      />

      <FieldRow<Money>
        name="amount" label="Money at stake" icon={<IconCoins size={16} />} hero field={card.amount}
        dataValue={card.amount.value ? `${card.amount.value.amount} ${card.amount.value.currency}` : ''}
        display={card.amount.value ? formatMoney(card.amount.value.amount, card.amount.value.currency, L) : null}
        onEdit={(v) => edit({ amount: { ...card.amount, value: v, edited: true } })}
        renderEditor={(done, cancel) => <MoneyEditor initial={card.amount.value} done={done} cancel={cancel} />}
        extra={(card.amountsSeen?.length ?? 0) > 1 && (
          <details className="seen">
            <summary>All amounts found ({card.amountsSeen!.length})</summary>
            <ul>
              {card.amountsSeen!.map((a, i) => (
                <li key={i}>
                  <button className="btn tiny ghost" onClick={() => edit({ amount: { ...card.amount, value: { amount: a.amount, currency: a.currency }, snippet: a.snippet, edited: true } })}>Use</button>
                  <strong>{formatMoney(a.amount, a.currency, L)}</strong> <span className="muted">“{a.snippet}”</span>
                </li>
              ))}
            </ul>
          </details>
        )}
      />

      {type === 'medicine_label' && (
        <section className="field medicine">
          <div className="field-head"><span className="field-label">What the label says (quoted, not advice)</span></div>
          {card.labelQuote?.value ? <blockquote className="snippet">“{card.labelQuote.value}”</blockquote> : <p className="notfound">No dosing text found on the label.</p>}
          <p className="note">This app never gives dosing advice. Confirm with a pharmacist or doctor before taking any medicine.</p>
        </section>
      )}


      <section className="reply" data-testid="reply">
        <div className="field-label">Draft reply · {LANG_NAMES[card.reply.docLang]}</div>
        <EditableText value={card.reply.docText} onSave={(t) => onChange({ ...card, reply: { ...card.reply, docText: t, edited: true } })} className="reply-text" testid="reply-doc" />
        <button className="btn small secondary" onClick={() => copy('doc', card.reply.docText)}>{copied === 'doc' ? 'Copied ✓' : `Copy ${LANG_NAMES[card.reply.docLang]} text`}</button>
        {card.reply.docLang !== L && (
          <>
            <div className="field-label" style={{ marginTop: 14 }}>Same reply · {LANG_NAMES[L]} (so you know what you're sending)</div>
            <EditableText value={card.reply.userText} onSave={(t) => onChange({ ...card, reply: { ...card.reply, userText: t, edited: true } })} className="reply-text" testid="reply-user" />
            <button className="btn small ghost" onClick={() => copy('user', card.reply.userText)}>{copied === 'user' ? 'Copied ✓' : 'Copy'}</button>
          </>
        )}
      </section>

      <div className="section-title">Details</div>
      <FieldRow<DocType>
        name="docType" label="Document type" field={card.docType} dataValue={card.docType.value ?? ''}
        display={DOC_TYPE_LABEL[type][L]}
        onEdit={(v) => edit({ docType: { ...card.docType, value: v ?? 'unknown', edited: true }, deadline: { ...card.deadline, kind: v === 'medicine_label' ? 'expiry' : card.deadline.kind === 'expiry' ? 'deadline' : card.deadline.kind } })}
        renderEditor={(done, cancel) => (
          <div className="editor">
            <select defaultValue={type} onChange={(e) => done(e.target.value as DocType)} autoFocus>
              {DOC_TYPES.map((t) => <option key={t} value={t}>{DOC_TYPE_LABEL[t][L]}</option>)}
            </select>
            <div className="editor-actions"><button className="btn small ghost" onClick={cancel}>Cancel</button></div>
          </div>
        )}
      />

      <FieldRow<string>
        name="reference" label="Reference / case number" field={card.reference} dataValue={card.reference.value ?? ''}
        display={<code>{card.reference.value}</code>}
        onEdit={(v) => edit({ reference: { ...card.reference, value: v, edited: true } })}
        renderEditor={(done, cancel) => <SimpleEditor initial={card.reference.value ?? ''} type="text" done={done} cancel={cancel} />}
      />

      <FieldRow<Lang>
        name="docLanguage" label="Document language" field={card.docLanguage} dataValue={card.docLanguage.value ?? ''}
        display={card.docLanguage.value ? LANG_NAMES[card.docLanguage.value] : null}
        onEdit={(v) => edit({ docLanguage: { ...card.docLanguage, value: v, edited: true }, reply: { ...card.reply, edited: false } })}
        renderEditor={(done, cancel) => (
          <div className="editor">
            <select defaultValue={card.docLanguage.value ?? 'en'} onChange={(e) => done(e.target.value as Lang)} autoFocus>
              {LANGS.map((l) => <option key={l} value={l}>{LANG_NAMES[l]}</option>)}
            </select>
            <div className="editor-actions"><button className="btn small ghost" onClick={cancel}>Cancel</button></div>
          </div>
        )}
      />

      <details className="ocr" data-testid="ocr-text">
        <summary>Full text read from the photo {card.ocrConfidence !== null && <span className="muted">(OCR confidence {Math.round(card.ocrConfidence)}%)</span>}</summary>
        <pre>{card.ocrText || '(no text found)'}</pre>
      </details>

      <div className="disclaimer bottom" role="note"><IconAlert /> <span>{DISCLAIMER[L]}</span></div>

      <div className="actions action-bar">
        <button className="btn primary" disabled={saved || busy} onClick={async () => { setBusy(true); setSaveError(null); try { await onSave(); } catch (e) { setSaveError(`Could not save on this phone (${e instanceof Error ? e.message : String(e)}). Export a PDF instead.`); } finally { setBusy(false); } }} data-testid="save-btn">{saved ? <><IconCheck /> Saved</> : 'Save card'}</button>
        <button className="btn secondary" onClick={() => exportPdf(card, thumbnail)} data-testid="pdf-btn" aria-label="Export PDF"><IconDownload size={18} /> PDF</button>
        <button className="btn ghost" onClick={onNew} data-testid="new-btn"><IconPlus size={18} /> New scan</button>
      </div>
      {saveError && <div className="alert error" role="alert" data-testid="save-error">{saveError}</div>}
    </article>
  );
}

function MoneyEditor({ initial, done, cancel }: { initial: Money | null; done: (v: Money | null) => void; cancel: () => void }) {
  const [amt, setAmt] = useState(initial ? String(initial.amount) : '');
  const [cur, setCur] = useState(initial?.currency ?? 'EUR');
  return (
    <div className="editor">
      <div className="money-edit">
        <input inputMode="decimal" value={amt} onChange={(e) => setAmt(e.target.value)} placeholder="0.00" autoFocus />
        <select value={cur} onChange={(e) => setCur(e.target.value)}>
          {[...new Set([cur, ...CURRENCIES])].map((c) => <option key={c}>{c}</option>)}
        </select>
      </div>
      <div className="editor-actions">
        <button className="btn small primary" onClick={() => { const n = Number(amt.replace(',', '.')); done(amt.trim() && Number.isFinite(n) ? { amount: n, currency: cur } : null); }}>Save</button>
        <button className="btn small ghost" onClick={cancel}>Cancel</button>
      </div>
    </div>
  );
}

function EditableText({ value, onSave, className, testid }: { value: string; onSave: (t: string) => void; className: string; testid?: string }) {
  const [editing, setEditing] = useState(false);
  const [v, setV] = useState(value);
  if (editing) {
    return (
      <div className="editor">
        <textarea value={v} onChange={(e) => setV(e.target.value)} rows={6} autoFocus />
        <div className="editor-actions">
          <button className="btn small primary" onClick={() => { onSave(v); setEditing(false); }}>Save</button>
          <button className="btn small ghost" onClick={() => { setV(value); setEditing(false); }}>Cancel</button>
        </div>
      </div>
    );
  }
  return (
    <button className={`textblock ${className}`} onClick={() => { setV(value); setEditing(true); }} data-testid={testid}>
      {value}<span className="sr-only"> (tap to edit)</span><span className="edit-hint" aria-hidden> ✎</span>
    </button>
  );
}
