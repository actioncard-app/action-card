// Calendar reminder (.ics) and a short plain-text summary for sharing. Pure functions + tiny DOM helpers; no network.
import type { ActionCard } from './types';
import { makeT, type TFn } from './i18n';

const icsEscape = (t: string) => t.replace(/\\/g, '\\\\').replace(/[,;]/g, (m) => '\\' + m).replace(/\r?\n/g, '\\n');
// RFC 5545: content lines longer than 75 octets are folded (CRLF + one space).
function fold(line: string): string {
  const out: string[] = [];
  let cur = '', bytes = 0;
  for (const ch of line) {
    const b = new TextEncoder().encode(ch).length;
    if (bytes + b > 75) { out.push(cur); cur = ' '; bytes = 1; }
    cur += ch; bytes += b;
  }
  out.push(cur);
  return out.join('\r\n');
}

/** All-day event on the deadline with a display alarm 3 days before (09:00 that day is up to the calendar app). */
export function buildIcs(card: ActionCard, title: string, now = new Date(), t: TFn = makeT('en')): string | null {
  const iso = card.deadline.value;
  if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return null;
  const [y, m, d] = iso.split('-').map(Number);
  const next = new Date(Date.UTC(y, m - 1, d + 1)).toISOString().slice(0, 10).replace(/-/g, '');
  const desc = [card.nextAction.text, card.reference.value ? t('sh_ref', { v: card.reference.value }) : '', t('ics_check')].filter(Boolean).join('\n');
  const lines = [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Action Card//EN', 'CALSCALE:GREGORIAN', 'BEGIN:VEVENT',
    `UID:${card.id}@action-card`, `DTSTAMP:${now.toISOString().replace(/[-:]/g, '').slice(0, 15)}Z`,
    `DTSTART;VALUE=DATE:${iso.replace(/-/g, '')}`, `DTEND;VALUE=DATE:${next}`,
    `SUMMARY:${icsEscape(t('ics_title', { title }))}`, `DESCRIPTION:${icsEscape(desc)}`,
    'BEGIN:VALARM', 'TRIGGER:-P3D', 'ACTION:DISPLAY', `DESCRIPTION:${icsEscape(t('ics_alarm', { title }))}`, 'END:VALARM',
    'END:VEVENT', 'END:VCALENDAR',
  ];
  return lines.map(fold).join('\r\n') + '\r\n';
}

export function summaryText(card: ActionCard, title: string, fmtDate: (iso: string) => string, fmtMoney: (a: number, c: string) => string, t: TFn = makeT('en')): string {
  return [
    title,
    card.deadline.value ? t('sh_deadline', { v: fmtDate(card.deadline.value) }) : '',
    card.amount.value ? t('sh_amount', { v: fmtMoney(card.amount.value.amount, card.amount.value.currency) }) : '',
    card.reference.value ? t('sh_ref', { v: card.reference.value }) : '',
    t('sh_next', { v: card.nextAction.text }),
    t('sh_footer'),
  ].filter(Boolean).join('\n');
}

export function downloadIcs(card: ActionCard, title: string, t?: TFn) {
  const ics = buildIcs(card, title, new Date(), t);
  if (!ics) return;
  const url = URL.createObjectURL(new Blob([ics], { type: 'text/calendar;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url; a.download = `deadline-${card.deadline.value}.ics`;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}

/** iOS/Android share sheet when available, otherwise copy to the clipboard. Returns what happened. */
export async function shareText(title: string, text: string): Promise<'shared' | 'copied' | 'failed'> {
  try {
    if (navigator.share) { await navigator.share({ title, text }); return 'shared'; }
    await navigator.clipboard.writeText(text); return 'copied';
  } catch { return 'failed'; }
}
