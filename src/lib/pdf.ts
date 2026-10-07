import { jsPDF } from 'jspdf';
import type { ActionCard, Field } from './types';
import { LANG_NAMES } from './types';
import { DISCLAIMER, DOC_TYPE_LABEL, formatDate, formatMoney } from './templates';
import { daysUntil } from './extract';
import { calcText } from './extract/relative';

/** Build a PDF of the card incl. source snippets, confidence and the disclaimer. */
export function cardToPdf(card: ActionCard, thumbnail?: string): jsPDF {
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

  doc.setFillColor(15, 76, 92); doc.rect(0, 0, W, 12, 'F');
  doc.setTextColor(255, 255, 255); doc.setFont('helvetica', 'bold'); doc.setFontSize(11);
  doc.text('Action Card', M, 8);
  doc.setFont('helvetica', 'normal'); doc.text(new Date(card.createdAt).toLocaleString(), W - M, 8, { align: 'right' });

  // Disclaimer box at the top
  doc.setFillColor(255, 243, 205); doc.rect(M, y - 2, CW, L !== 'en' ? 12 : 8, 'F');
  text(DISCLAIMER[L], 9.5, 'bold', [110, 70, 0]);
  if (L !== 'en') text(DISCLAIMER.en, 8.5, 'normal', [110, 70, 0]);
  y += 4;

  if (thumbnail) {
    try { doc.addImage(thumbnail, 'JPEG', W - M - 40, y, 40, 40 * 1.3); } catch { /* ignore */ }
  }
  const field = (label: string, f: Field<unknown>, shown: string) => {
    ensure(18);
    text(label.toUpperCase(), 8, 'bold', [90, 90, 90]);
    text(f.value === null ? 'Not found' : shown, 13, 'bold', f.value === null ? [150, 150, 150] : [20, 20, 20]);
    if (f.confidence) text(`Confidence: ${f.confidence}${f.edited ? ' (edited by you)' : ''}`, 8.5, 'normal', [90, 90, 90]);
    if (f.snippet) text(`Source text: "${f.snippet}"`, 8.5, 'italic', [60, 60, 60]);
    if (f.note) text(f.note, 8, 'normal', [120, 90, 30]);
    y += 3;
  };
  const type = card.docType.value ?? 'unknown';
  field('Document type', card.docType, DOC_TYPE_LABEL[type][L]);
  field('Document language', card.docLanguage, card.docLanguage.value ? LANG_NAMES[card.docLanguage.value] : '');
  const dlLabel = card.deadline.kind === 'expiry' ? 'Expiry / use by' : card.deadline.kind === 'appointment' ? 'Appointment date' : 'Deadline';
  const days = card.deadline.value ? daysUntil(card.deadline.value) : 0;
  field(dlLabel, card.deadline.calc && !card.deadline.edited ? { ...card.deadline, snippet: null } : card.deadline, card.deadline.value ? `${formatDate(card.deadline.value, L)} (${days >= 0 ? `${days} days left` : `${-days} days ago`} on ${new Date().toLocaleDateString()})` : '');
  if (card.deadline.calc && !card.deadline.edited) {
    const c = card.deadline.calc;
    text(`Rule in the document: "${c.ruleSnippet}"`, 8.5, 'italic', [60, 60, 60]);
    text(c.base ? `Start date in the document (${c.base.label}): "${c.base.snippet}"` : 'No start date printed in the document; today\'s date is NOT assumed.', 8.5, 'italic', [60, 60, 60]);
    text(`Calculation: ${calcText(c, (i) => formatDate(i, L))}`, 9, 'bold', [15, 76, 92]);
    y += 3;
  }
  for (const o of card.otherDeadlines ?? []) text(`Other deadline: ${o.iso ? formatDate(o.iso, L) : 'date unknown'} - "${o.snippet}"${o.calc ? ' (' + calcText(o.calc, (i) => formatDate(i, L)) + ')' : ''}`, 8, 'normal', [90, 90, 90]);
  field('Money at stake', card.amount, card.amount.value ? formatMoney(card.amount.value.amount, card.amount.value.currency, L) : '');
  field('Reference', card.reference, card.reference.value ?? '');
  if (card.labelQuote?.value) field('What the label says (quote, not advice)', card.labelQuote, card.labelQuote.value);

  ensure(20); y += 2;
  text('NEXT ACTION', 8, 'bold', [90, 90, 90]);
  text(card.nextAction.text, 12, 'bold');
  y += 4;
  text(`DRAFT REPLY (${LANG_NAMES[card.reply.docLang]})`, 8, 'bold', [90, 90, 90]);
  text(card.reply.docText, 10);
  y += 3;
  if (card.reply.docLang !== L) {
    text(`SAME REPLY (${LANG_NAMES[L]})`, 8, 'bold', [90, 90, 90]);
    text(card.reply.userText, 10);
    y += 3;
  }
  text(`Mode: ${card.mode === 'ai' ? 'AI (xAI)' : 'Offline rules'}${card.modeNote ? ' - ' + card.modeNote : ''}. OCR confidence: ${card.ocrConfidence !== null ? Math.round(card.ocrConfidence) + '%' : 'n/a'}.`, 8, 'normal', [100, 100, 100]);
  y += 4;
  ensure(14);
  text('FULL OCR TEXT', 8, 'bold', [90, 90, 90]);
  text(card.ocrText || '(empty)', 8, 'normal', [60, 60, 60]);
  y += 4;
  text(DISCLAIMER[L], 9, 'bold', [110, 70, 0]);
  return doc;
}

export async function exportPdf(card: ActionCard, thumbnail?: string) {
  const doc = cardToPdf(card, thumbnail);
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
