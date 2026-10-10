import { jsPDF } from 'jspdf';
import type { ActionCard, Field } from './types';
import { LANG_NAMES } from './types';
import { DISCLAIMER, DOC_TYPE_LABEL, formatDate, formatMoney } from './templates';
import { daysUntil } from './extract';
import type { Confidence, Lang } from './types';
import { makeT, type Key } from './i18n';
const CONF_KEY: Record<Confidence, Key> = { high: 'conf_high', medium: 'conf_medium', low: 'conf_low' };
import { calcText } from './extract/relative';

/** Build a PDF of the card incl. source snippets, confidence and the disclaimer. Labels follow the interface
 *  language `ul`; card contents keep the card's own language. */
export function cardToPdf(card: ActionCard, thumbnail?: string, ul: Lang = 'en', photos: string[] = []): jsPDF {
  const t = makeT(ul);
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const L = card.userLanguage;
  const W = 210, M = 16, CW = W - 2 * M;
  let y = 18;
  const ensure = (h: number) => { if (y + h > 282) { doc.addPage(); y = 18; } };
  const text = (s: string, size = 10, style: 'normal' | 'bold' | 'italic' = 'normal', color: [number, number, number] = [20, 20, 20]) => {
    doc.setFont('helvetica', style); doc.setFontSize(size); doc.setTextColor(...color);
    const lines = doc.splitTextToSize(s, CW) as string[];
    for (const ln of lines) { ensure(size * 0.5); y += size * 0.36; doc.text(ln, M, y); y += size * 0.14; }
  };
  const head = (k: string) => text(k.toLocaleUpperCase(ul), 8, 'bold', [90, 90, 90]);

  doc.setFillColor(15, 76, 92); doc.rect(0, 0, W, 12, 'F');
  doc.setTextColor(255, 255, 255); doc.setFont('helvetica', 'bold'); doc.setFontSize(11);
  doc.text('Action Card', M, 8);
  doc.setFont('helvetica', 'normal'); doc.text(new Date(card.createdAt).toLocaleString(ul), W - M, 8, { align: 'right' });

  // Disclaimer box at the top (card language, plus English if different)
  doc.setFillColor(255, 243, 205); doc.rect(M, y - 2, CW, L !== 'en' ? 12 : 8, 'F');
  text(DISCLAIMER[L], 9.5, 'bold', [110, 70, 0]);
  if (L !== 'en') text(DISCLAIMER.en, 8.5, 'normal', [110, 70, 0]);
  y += 4;

  if (thumbnail) {
    try { doc.addImage(thumbnail, 'JPEG', W - M - 40, y, 40, 40 * 1.3); } catch { /* ignore */ }
  }
  const field = (label: string, f: Field<unknown>, shown: string) => {
    ensure(18);
    head(label);
    text(f.value === null ? t('not_found') : shown, 13, 'bold', f.value === null ? [150, 150, 150] : [20, 20, 20]);
    if (f.confidence) text(t('pdf_conf', { v: t(CONF_KEY[f.confidence]) }) + (f.edited ? t('pdf_edited') : ''), 8.5, 'normal', [90, 90, 90]);
    if (f.snippet) text(t('pdf_source', { v: f.snippet }), 8.5, 'italic', [60, 60, 60]);
    if (f.note) text(f.note, 8, 'normal', [120, 90, 30]);
    y += 3;
  };
  const type = card.docType.value ?? 'unknown';
  field(t('doc_type'), card.docType, DOC_TYPE_LABEL[type][L]);
  field(t('doc_language'), card.docLanguage, card.docLanguage.value ? LANG_NAMES[card.docLanguage.value] : '');
  const dlLabel = t(card.deadline.kind === 'expiry' ? 'expiry' : card.deadline.kind === 'appointment' ? 'appointment' : 'deadline');
  const days = card.deadline.value ? daysUntil(card.deadline.value) : 0;
  const today = new Date().toLocaleDateString(ul);
  field(dlLabel, card.deadline.calc && !card.deadline.edited ? { ...card.deadline, snippet: null } : card.deadline, card.deadline.value ? `${formatDate(card.deadline.value, L)} (${days >= 0 ? t('pdf_days_left', { n: days, date: today }) : t('pdf_days_ago', { n: -days, date: today })})` : '');
  if (card.deadline.calc && !card.deadline.edited) {
    const c = card.deadline.calc;
    text(`${t('rule_in_doc')} "${c.ruleSnippet}"`, 8.5, 'italic', [60, 60, 60]);
    text(c.base ? `${t('start_in_doc', { label: c.base.label })} "${c.base.snippet}"` : t('pdf_no_start'), 8.5, 'italic', [60, 60, 60]);
    text(t('calculation', { calc: calcText(c, (i) => formatDate(i, L)) }), 9, 'bold', [15, 76, 92]);
    y += 3;
  }
  for (const o of card.otherDeadlines ?? []) text(t('pdf_other', { v: `${o.iso ? formatDate(o.iso, L) : t('date_unknown')} - "${o.snippet}"${o.calc ? ' (' + calcText(o.calc, (i) => formatDate(i, L)) + ')' : ''}` }), 8, 'normal', [90, 90, 90]);
  field(t('money'), card.amount, card.amount.value ? formatMoney(card.amount.value.amount, card.amount.value.currency, L) : '');
  field(t('reference'), card.reference, card.reference.value ?? '');
  if (card.labelQuote?.value) field(t('label_says'), card.labelQuote, card.labelQuote.value);

  ensure(20); y += 2;
  head(t('next_action'));
  text(card.nextAction.text, 12, 'bold');
  y += 4;
  head(t('draft_reply', { lang: LANG_NAMES[card.reply.docLang] }));
  text(card.reply.docText, 10);
  y += 3;
  if (card.reply.docLang !== L) {
    head(t('pdf_reply_same', { lang: LANG_NAMES[L] }));
    text(card.reply.userText, 10);
    y += 3;
  }
  text(`${t('pdf_mode', { v: card.mode === 'ai' ? 'AI (xAI)' : t('mode_rules') })}${card.modeNote ? ' - ' + card.modeNote : ''}. ${t('pdf_ocr', { v: card.ocrConfidence !== null ? Math.round(card.ocrConfidence) + '%' : 'n/a' })}.`, 8, 'normal', [100, 100, 100]);
  y += 4;
  ensure(14);
  head(t('pdf_full_text'));
  text(card.ocrText || '(empty)', 8, 'normal', [60, 60, 60]);
  y += 4;
  text(DISCLAIMER[L], 9, 'bold', [110, 70, 0]);
  // photos of every page, one per PDF page, so the original travels with the card
  photos.forEach((src, i) => {
    doc.addPage(); y = 18;
    head(`${t('pdf_photos')} · ${t('page_n', { n: i + 1 })}`);
    try {
      const p = doc.getImageProperties(src);
      const maxW = CW, maxH = 282 - y - 4;
      const k = Math.min(maxW / p.width, maxH / p.height);
      doc.addImage(src, 'JPEG', M, y + 2, p.width * k, p.height * k);
    } catch { text('(image could not be added)', 9); }
  });
  return doc;
}

export async function exportPdf(card: ActionCard, thumbnail?: string, ul: Lang = 'en', photos: string[] = []) {
  const doc = cardToPdf(card, thumbnail, ul, photos);
  const name = `action-card-${new Date(card.createdAt).toISOString().slice(0, 10)}-${card.id.slice(-4)}.pdf`;
  const blob = doc.output('blob');
  const file = new File([blob], name, { type: 'application/pdf' });
  // iOS / Android: share sheet lets the user save to Files or send it. Fallback: download.
  if (navigator.canShare?.({ files: [file] })) {
    try { await navigator.share({ files: [file], title: 'Action Card' }); return 'shared'; } catch (e) { if ((e as Error).name === 'AbortError') return 'cancelled'; }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
  return 'downloaded';
}
