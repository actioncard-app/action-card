// Read aloud with the device's own speech synthesis (Web Speech API; on iOS the system voices, offline).
// Easy Language: the card as a few short, plain sentences (also what "Read card aloud" says).
import type { ActionCard, ReadLang, UiLangCode } from './types';
import { makeT } from './i18n';
import { moneyDirection } from './trust';
import { daysUntil } from './extract';
import { formatDateShort, formatMoney, typeLabelUi } from './templates';

export const SPEECH_LANG: Record<ReadLang, string> = {
  en: 'en-GB', de: 'de-DE', fr: 'fr-FR', es: 'es-ES', it: 'it-IT', pt: 'pt-PT', tr: 'tr-TR', ar: 'ar-SA', pl: 'pl-PL', ru: 'ru-RU', uk: 'uk-UA',
  fa: 'fa-IR', ro: 'ro-RO', vi: 'vi-VN', zh: 'zh-CN', tl: 'fil-PH', hi: 'hi-IN', ur: 'ur-PK',
};

export const speechAvailable = () => typeof window !== 'undefined' && 'speechSynthesis' in window && typeof SpeechSynthesisUtterance !== 'undefined';

/** A voice for the language (exact region first, then any region), or null if the device has none. */
export function voiceFor(lang: string, voices: SpeechSynthesisVoice[] = speechAvailable() ? speechSynthesis.getVoices() : []): SpeechSynthesisVoice | null {
  const norm = (s: string) => s.replace('_', '-').toLowerCase();
  const want = norm(lang), base = want.split('-')[0];
  const alt = base === 'fil' ? 'tl' : base === 'tl' ? 'fil' : base;
  return voices.find((v) => norm(v.lang) === want) ?? voices.find((v) => [base, alt].includes(norm(v.lang).split('-')[0])) ?? null;
}

export type SpeakResult = 'started' | 'no-voice' | 'unavailable';
export function speak(text: string, lang: string, onEnd?: () => void): SpeakResult {
  if (!speechAvailable()) return 'unavailable';
  const voices = speechSynthesis.getVoices();
  const v = voiceFor(lang, voices);
  if (voices.length && !v) return 'no-voice';
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = v?.lang ?? lang;
  if (v) u.voice = v;
  u.rate = 0.9;
  u.onend = () => onEnd?.();
  u.onerror = () => onEnd?.();
  speechSynthesis.speak(u);
  return 'started';
}
export const stopSpeaking = () => { if (speechAvailable()) speechSynthesis.cancel(); };

/** The card as short, plain sentences, in the card's language (lang). */
export function easySentences(card: ActionCard, lang: UiLangCode): string[] {
  const t = makeT(lang);
  const out: string[] = [];
  const type = card.docType.value ?? 'unknown';
  out.push(type === 'unknown' ? t('easy_unknown') : t('easy_type', { type: typeLabelUi(type, lang) }));
  if (card.deadline.value) {
    const d = daysUntil(card.deadline.value);
    out.push(t(card.deadline.kind === 'appointment' ? 'easy_appointment' : card.deadline.kind === 'expiry' ? 'easy_expiry' : 'easy_deadline', { date: formatDateShort(card.deadline.value, lang) }));
    out.push(d < 0 ? t('easy_past') : d === 0 ? t('easy_today') : t('easy_days', { n: d }));
  } else out.push(t('easy_no_deadline'));
  if (card.amount.value) {
    const money = formatMoney(card.amount.value.amount, card.amount.value.currency, lang);
    const dir = moneyDirection(card).value;
    out.push(t(dir === 'pay' || dir === 'fee' ? 'easy_pay' : dir === 'refund' ? 'easy_refund' : dir === 'deposit' ? 'easy_deposit' : 'easy_money', { money }));
  }
  if (card.reference.value) out.push(t('easy_ref', { ref: card.reference.value }));
  out.push(t('easy_todo', { action: card.nextAction.text.replace(/\s+/g, ' ').trim() }));
  out.push(t('easy_check'));
  return out;
}
