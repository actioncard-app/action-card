import { useEffect, useState } from 'react';
import type { ActionCard, DocType, Lang, Money } from '../lib/types';
import { DOC_TYPES, LANGS, LANG_NAMES } from '../lib/types';
import { DISCLAIMER, DOC_TYPE_LABEL, formatDate, formatDateShort, formatMoney } from '../lib/templates';
import { calcText } from '../lib/extract/relative';
import { daysUntil, regenerateActions } from '../lib/extract';
// jsPDF (~350 KB) is split into its own chunk: fetched when a card is shown (precached by the service worker for offline).
const loadPdf = () => import('../lib/pdf');
import { downloadIcs, shareText, summaryText } from '../lib/share';
import FieldRow, { ConfidenceBadge, EditedBadge } from './FieldRow';
import { IconAlert, IconArrow, IconCalendar, IconCoins, IconDownload, IconPlus, IconCheck, IconShare } from './Icons';
import type { Current } from '../App';
import { useLang, useT, makeT, type TFn } from '../lib/i18n';
import { pageOf, pagesOf, textWithMarkers } from '../lib/pages';

interface Props { current: Current; onChange: (c: ActionCard) => void; onSave: () => Promise<void>; onNew: () => void; onAddPage?: (f: File) => void; error?: string | null }

const CURRENCIES = ['EUR', 'GBP', 'USD', 'CHF', 'BRL'];

export function countdown(d: number, t: TFn = makeT('en')): { cls: string; txt: string } {
  const cls = d < 0 ? 'past' : d <= 3 ? 'urgent' : d <= 14 ? 'soon' : 'ok';
  const txt = d < 0 ? (d === -1 ? t('day_ago') : t('days_ago', { n: -d })) : d === 0 ? t('today') : d === 1 ? t('tomorrow') : t('in_days', { n: d });
  return { cls, txt };
}

function Days({ iso, testid = 'days-left' }: { iso: string; testid?: string }) {
  const { cls, txt } = countdown(daysUntil(iso), useT());
  return <span className={`days ${cls}`} data-testid={testid}>{txt}</span>;
}

function SimpleEditor({ initial, type, done, cancel }: { initial: string; type: string; done: (v: string | null) => void; cancel: () => void }) {
  const t = useT();
  const [v, setV] = useState(initial);
  return (
    <div className="editor">
      <input type={type} value={v} onChange={(e) => setV(e.target.value)} autoFocus />
      <div className="editor-actions">
        <button className="btn small primary" onClick={() => done(v.trim() ? v.trim() : null)}>{t('save')}</button>
        <button className="btn small ghost" onClick={cancel}>{t('cancel')}</button>
      </div>
    </div>
  );
}

export default function CardView({ current, onChange, onSave, onNew, onAddPage, error }: Props) {
  const { card, thumbnail, photo, morePhotos, saved } = current;
  const L = card.userLanguage; // card contents (next action, replies, dates) keep the language they were made in
  const t = useT(); // interface language
  const ul = useLang();
  const [showPhoto, setShowPhoto] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  // one object URL per page photo (page 1 = photo, then morePhotos)
  const [photoUrls] = useState(() => [photo, ...(morePhotos ?? [])].filter((b): b is Blob => !!b).map((b) => URL.createObjectURL(b)));
  // data URLs of every page for the PDF, prepared in advance so the PDF tap keeps its user gesture on iOS
  const [pdfPhotos, setPdfPhotos] = useState<string[]>([]);
  useEffect(() => {
    let live = true;
    Promise.all([photo, ...(morePhotos ?? [])].filter((b): b is Blob => !!b).map((b) => new Promise<string>((ok, bad) => { const r = new FileReader(); r.onload = () => ok(String(r.result)); r.onerror = () => bad(r.error); r.readAsDataURL(b); })))
      .then((u) => { if (live) setPdfPhotos(u); }).catch(() => {});
    return () => { live = false; };
  }, [photo, morePhotos]);
  const nPages = pagesOf(card).length;
  const pg = (snippet: string | null | undefined) => pageOf(card, snippet);
  const type: DocType = card.docType.value ?? 'unknown';
  // warm the PDF chunk so the tap on "PDF" can open the share sheet immediately (iOS needs the user gesture)
  useEffect(() => { loadPdf().catch(() => {}); }, []);

  const edit = (patch: Partial<ActionCard>) => onChange(regenerateActions({ ...card, ...patch }));
  const copy = async (k: string, t: string) => {
    try { await navigator.clipboard.writeText(t); setCopied(k); setTimeout(() => setCopied(null), 1500); } catch { /* clipboard blocked */ }
  };
  const dlLabel = t(card.deadline.kind === 'expiry' ? 'expiry' : card.deadline.kind === 'appointment' ? 'appointment' : 'deadline');

  return (
    <article className="card screen" data-testid="action-card" data-mode={card.mode}>
      <header className="card-top">
        <button className="thumb" onClick={() => setShowPhoto(!showPhoto)} aria-label={t('show_photo')}>
          <img src={thumbnail} alt={t('original_doc')} />
        </button>
        <div className="card-head">
          <div className="card-type" data-testid="card-type">{DOC_TYPE_LABEL[type][L]}</div>
          <div className="small muted">{new Date(card.createdAt).toLocaleString(ul)} · {card.mode === 'ai' ? t('mode_ai') : t('mode_rules')}{nPages > 1 && <> · <span className="nowrap" data-testid="page-count">{t('pages_n', { n: nPages })}</span></>}</div>
          <button className="linklike small" onClick={() => setShowPhoto(!showPhoto)}>{showPhoto ? t('hide_photo') : t('check_photo')}</button>
        </div>
      </header>
      <section className="todo" aria-label={t('what_to_do')}>
        <div className="todo-chips">
          <div className={`sum-chip ${card.deadline.value ? '' : 'empty'}`}>
            <span className="sum-label"><IconCalendar size={14} /> {dlLabel}</span>
            <span className="sum-value">{card.deadline.value ? formatDateShort(card.deadline.value, L) : t('not_found')}</span>
            <span className="sum-foot">{card.deadline.value && <Days iso={card.deadline.value} testid="summary-days" />}{card.deadline.edited ? <EditedBadge short /> : card.deadline.value !== null && <ConfidenceBadge c={card.deadline.confidence} short />}</span>
          </div>
          <div className={`sum-chip ${card.amount.value ? '' : 'empty'}`}>
            <span className="sum-label"><IconCoins size={14} /> {t('money')}</span>
            <span className="sum-value">{card.amount.value ? formatMoney(card.amount.value.amount, card.amount.value.currency, L) : t('not_found')}</span>
            <span className="sum-foot">{card.amount.edited ? <EditedBadge short /> : card.amount.value !== null && <ConfidenceBadge c={card.amount.confidence} short />}</span>
          </div>
        </div>
        <section className="next" data-testid="next-action">
          <div className="field-label light"><span className="field-ic" aria-hidden><IconArrow size={16} /></span>{t('next_action')}</div>
          <EditableText value={card.nextAction.text} onSave={(x) => onChange({ ...card, nextAction: { text: x, edited: true } })} className="next-text" />
        </section>
        <div className="todo-actions">
          {card.deadline.value && <button className="btn small secondary" onClick={() => downloadIcs(card, DOC_TYPE_LABEL[type][L], t)} data-testid="remind-btn"><IconCalendar size={18} /> {t('remind_me')}</button>}
          <button className="btn small ghost" onClick={async () => { const r = await shareText(DOC_TYPE_LABEL[type][L], summaryText(card, DOC_TYPE_LABEL[type][L], (i) => formatDate(i, L), (a, c) => formatMoney(a, c, L), t)); if (r === 'copied') { setCopied('share'); setTimeout(() => setCopied(null), 1500); } }} data-testid="share-btn"><IconShare size={18} /> {copied === 'share' ? t('copied') : t('share')}</button>
        </div>
      </section>
      {showPhoto && photoUrls.map((u, i) => (
        <figure className="full-photo-wrap" key={u}>
          {photoUrls.length > 1 && <figcaption className="small muted">{t('page_n', { n: i + 1 })}</figcaption>}
          <img className="full-photo" src={u} alt={`${t('original_doc')} · ${t('page_n', { n: i + 1 })}`} />
        </figure>
      ))}
      <div className="disclaimer" role="note" data-testid="disclaimer"><IconAlert /> <span>{DISCLAIMER[L]}</span></div>
      <section className="pages" data-testid="pages" aria-label={t('pages_n', { n: nPages })}>
        <div className="page-strip">
          {photoUrls.map((u, i) => (
            <button key={u} className="page-thumb" onClick={() => setShowPhoto(true)} aria-label={`${t('show_photo')} · ${t('page_n', { n: i + 1 })}`}>
              <img src={u} alt="" /><span className="page-no" aria-hidden>{i + 1}</span>
            </button>
          ))}
          {onAddPage && (
            <label className="btn small secondary add-page" data-testid="add-page-btn">
              <input type="file" accept="image/*" hidden data-testid="add-page-input" onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) onAddPage(f); }} />
              <IconPlus size={18} /> {t('add_page')}
            </label>
          )}
        </div>
        <p className="small muted">{nPages > 1 ? `${t('pages_n', { n: nPages })}. ${t('page_edited_note')}` : t('add_page_hint')}</p>
        {error && <div className="alert error" role="alert" data-testid="page-error">{error}</div>}
      </section>
      <div className="section-title">{t('where_from')}</div>
      {card.modeNote && <div className="alert info" data-testid="mode-note">{card.modeNote}</div>}

      <FieldRow<string>
        name="deadline" label={dlLabel} icon={<IconCalendar size={16} />} hero field={card.deadline} page={pg(card.deadline.snippet)} dataValue={card.deadline.value ?? ''}
        display={card.deadline.value ? <>{formatDateShort(card.deadline.value, L)} <Days iso={card.deadline.value} /></> : null}
        onEdit={(v) => edit({ deadline: { ...card.deadline, value: v, edited: true } })}
        renderEditor={(done, cancel) => <SimpleEditor initial={card.deadline.value ?? ''} type="date" done={done} cancel={cancel} />}
        missingDisplay={card.deadline.calc ? <span className="relative-unknown" data-testid="relative-unknown">{calcText(card.deadline.calc, (i) => formatDate(i, L))}</span> : undefined}
        snippetOverride={card.deadline.calc && !card.deadline.edited ? (
          <div className="calc" data-testid="snippet-deadline">
            <blockquote className="snippet"><span className="snippet-label">{t('rule_in_doc')}</span> “{card.deadline.calc.ruleSnippet}”</blockquote>
            {card.deadline.calc.base
              ? <blockquote className="snippet"><span className="snippet-label">{t('start_in_doc', { label: card.deadline.calc.base.label })}</span> “{card.deadline.calc.base.snippet}”</blockquote>
              : <p className="note">{t('no_start')}</p>}
            {card.deadline.calc.resultIso && <div className="math" data-testid="deadline-math">{t('calculation', { calc: calcText(card.deadline.calc, (i) => formatDate(i, L)) })}</div>}
          </div>
        ) : undefined}
        extra={<>{(card.otherDeadlines?.length ?? 0) > 0 && (
          <details className="seen" data-testid="other-deadlines">
            <summary>{t('other_deadlines', { n: card.otherDeadlines!.length })}</summary>
            <ul>
              {card.otherDeadlines!.map((d, i) => (
                <li key={i}>
                  {d.iso && <button className="btn tiny ghost" onClick={() => edit({ deadline: { ...card.deadline, value: d.iso, snippet: d.snippet, calc: d.calc, confidence: 'low', edited: true } })}>{t('use')}</button>}
                  <strong>{d.iso ? formatDate(d.iso, L) : t('date_unknown')}</strong> <span className="muted">“{d.snippet}”{d.calc ? ` · ${calcText(d.calc, (x) => formatDate(x, L))}` : ''}</span>
                </li>
              ))}
            </ul>
          </details>
        )}{card.datesSeen.length > 0 && (
          <details className="seen">
            <summary>{t('all_dates', { n: card.datesSeen.length })}</summary>
            <ul>
              {card.datesSeen.map((d, i) => (
                <li key={i}>
                  <button className="btn tiny ghost" onClick={() => edit({ deadline: { ...card.deadline, value: d.iso, snippet: d.snippet, edited: true } })}>{t('use')}</button>
                  <strong>{formatDate(d.iso, L)}</strong> <span className="muted">“{d.snippet}”</span>
                </li>
              ))}
            </ul>
          </details>
        )}</>}
      />

      <FieldRow<Money>
        name="amount" label={t('money')} icon={<IconCoins size={16} />} hero field={card.amount} page={pg(card.amount.snippet)}
        dataValue={card.amount.value ? `${card.amount.value.amount} ${card.amount.value.currency}` : ''}
        display={card.amount.value ? formatMoney(card.amount.value.amount, card.amount.value.currency, L) : null}
        onEdit={(v) => edit({ amount: { ...card.amount, value: v, edited: true } })}
        renderEditor={(done, cancel) => <MoneyEditor initial={card.amount.value} done={done} cancel={cancel} />}
        extra={(card.amountsSeen?.length ?? 0) > 1 && (
          <details className="seen">
            <summary>{t('all_amounts', { n: card.amountsSeen!.length })}</summary>
            <ul>
              {card.amountsSeen!.map((a, i) => (
                <li key={i}>
                  <button className="btn tiny ghost" onClick={() => edit({ amount: { ...card.amount, value: { amount: a.amount, currency: a.currency }, snippet: a.snippet, edited: true } })}>{t('use')}</button>
                  <strong>{formatMoney(a.amount, a.currency, L)}</strong> <span className="muted">“{a.snippet}”</span>
                </li>
              ))}
            </ul>
          </details>
        )}
      />

      {type === 'medicine_label' && (
        <section className="field medicine">
          <div className="field-head"><span className="field-label">{t('label_says')}</span></div>
          {card.labelQuote?.value ? <blockquote className="snippet">“{card.labelQuote.value}”</blockquote> : <p className="notfound">{t('no_dosing_text')}</p>}
          <p className="note">{t('never_dosing')}</p>
        </section>
      )}


      <section className="reply" data-testid="reply">
        <div className="field-label">{t('draft_reply', { lang: LANG_NAMES[card.reply.docLang] })}</div>
        <EditableText value={card.reply.docText} onSave={(x) => onChange({ ...card, reply: { ...card.reply, docText: x, edited: true } })} className="reply-text" testid="reply-doc" />
        <button className="btn small secondary" onClick={() => copy('doc', card.reply.docText)}>{copied === 'doc' ? t('copied') : t('copy_lang', { lang: LANG_NAMES[card.reply.docLang] })}</button>
        {card.reply.docLang !== L && (
          <>
            <div className="field-label" style={{ marginTop: 14 }}>{t('same_reply', { lang: LANG_NAMES[L] })}</div>
            <EditableText value={card.reply.userText} onSave={(x) => onChange({ ...card, reply: { ...card.reply, userText: x, edited: true } })} className="reply-text" testid="reply-user" />
            <button className="btn small ghost" onClick={() => copy('user', card.reply.userText)}>{copied === 'user' ? t('copied') : t('copy')}</button>
          </>
        )}
      </section>

      <div className="section-title">{t('details')}</div>
      <FieldRow<DocType>
        name="docType" label={t('doc_type')} field={card.docType} page={pg(card.docType.snippet)} dataValue={card.docType.value ?? ''}
        display={DOC_TYPE_LABEL[type][L]}
        onEdit={(v) => edit({ docType: { ...card.docType, value: v ?? 'unknown', edited: true }, deadline: { ...card.deadline, kind: v === 'medicine_label' ? 'expiry' : card.deadline.kind === 'expiry' ? 'deadline' : card.deadline.kind } })}
        renderEditor={(done, cancel) => (
          <div className="editor">
            <select defaultValue={type} onChange={(e) => done(e.target.value as DocType)} autoFocus>
              {DOC_TYPES.map((t) => <option key={t} value={t}>{DOC_TYPE_LABEL[t][L]}</option>)}
            </select>
            <div className="editor-actions"><button className="btn small ghost" onClick={cancel}>{t('cancel')}</button></div>
          </div>
        )}
      />

      <FieldRow<string>
        name="reference" label={t('reference')} field={card.reference} page={pg(card.reference.snippet)} dataValue={card.reference.value ?? ''}
        display={<code>{card.reference.value}</code>}
        onEdit={(v) => edit({ reference: { ...card.reference, value: v, edited: true } })}
        renderEditor={(done, cancel) => <SimpleEditor initial={card.reference.value ?? ''} type="text" done={done} cancel={cancel} />}
      />

      <FieldRow<Lang>
        name="docLanguage" label={t('doc_language')} field={card.docLanguage} dataValue={card.docLanguage.value ?? ''}
        display={card.docLanguage.value ? LANG_NAMES[card.docLanguage.value] : null}
        onEdit={(v) => edit({ docLanguage: { ...card.docLanguage, value: v, edited: true }, reply: { ...card.reply, edited: false } })}
        renderEditor={(done, cancel) => (
          <div className="editor">
            <select defaultValue={card.docLanguage.value ?? 'en'} onChange={(e) => done(e.target.value as Lang)} autoFocus>
              {LANGS.map((l) => <option key={l} value={l}>{LANG_NAMES[l]}</option>)}
            </select>
            <div className="editor-actions"><button className="btn small ghost" onClick={cancel}>{t('cancel')}</button></div>
          </div>
        )}
      />

      <details className="ocr" data-testid="ocr-text">
        <summary>{t('full_text')} {card.ocrConfidence !== null && <span className="muted">{t('ocr_conf', { pct: Math.round(card.ocrConfidence) })}</span>}</summary>
        <pre>{textWithMarkers(card, (n) => t('page_n', { n })) || t('no_text_found')}</pre>
      </details>

      <div className="disclaimer bottom" role="note"><IconAlert /> <span>{DISCLAIMER[L]}</span></div>

      <div className="actions action-bar">
        <button className="btn primary" disabled={saved || busy} onClick={async () => { setBusy(true); setSaveError(null); try { await onSave(); } catch (e) { setSaveError(t('save_error', { msg: e instanceof Error ? e.message : String(e) })); } finally { setBusy(false); } }} data-testid="save-btn">{saved ? <><IconCheck /> {t('saved')}</> : t('save_card')}</button>
        <button className="btn secondary" onClick={async () => (await loadPdf()).exportPdf(card, thumbnail, ul, pdfPhotos)} data-testid="pdf-btn" aria-label={t('export_pdf')}><IconDownload size={18} /> {t('pdf')}</button>
        <button className="btn ghost" onClick={onNew} data-testid="new-btn"><IconPlus size={18} /> {t('new_scan')}</button>
      </div>
      {saveError && <div className="alert error" role="alert" data-testid="save-error">{saveError}</div>}
    </article>
  );
}

function MoneyEditor({ initial, done, cancel }: { initial: Money | null; done: (v: Money | null) => void; cancel: () => void }) {
  const t = useT();
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
        <button className="btn small primary" onClick={() => { const n = Number(amt.replace(',', '.')); done(amt.trim() && Number.isFinite(n) ? { amount: n, currency: cur } : null); }}>{t('save')}</button>
        <button className="btn small ghost" onClick={cancel}>{t('cancel')}</button>
      </div>
    </div>
  );
}

function EditableText({ value, onSave, className, testid }: { value: string; onSave: (t: string) => void; className: string; testid?: string }) {
  const t = useT();
  const [editing, setEditing] = useState(false);
  const [v, setV] = useState(value);
  if (editing) {
    return (
      <div className="editor">
        <textarea value={v} onChange={(e) => setV(e.target.value)} rows={6} autoFocus />
        <div className="editor-actions">
          <button className="btn small primary" onClick={() => { onSave(v); setEditing(false); }}>{t('save')}</button>
          <button className="btn small ghost" onClick={() => { setV(value); setEditing(false); }}>{t('cancel')}</button>
        </div>
      </div>
    );
  }
  return (
    <button className={`textblock ${className}`} onClick={() => { setV(value); setEditing(true); }} data-testid={testid}>
      {value}<span className="sr-only"> ({t('tap_to_edit')})</span><span className="edit-hint" aria-hidden> ✎</span>
    </button>
  );
}
