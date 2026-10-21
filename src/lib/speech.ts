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

import { registerPlugin } from '@capacitor/core';
import { isNative } from './native';

export type VoiceGender = 'auto' | 'female' | 'male';
/** One installed voice. quality: 1 default/compact, 2 enhanced, 3 premium. gender: 0 unknown, 1 male, 2 female. */
export interface VoiceInfo { id: string; name: string; lang: string; quality: number; gender: number; novelty?: boolean; personal?: boolean }
interface NativeSpeechPlugin {
  voices(): Promise<{ voices: VoiceInfo[] }>;
  speak(o: { text: string; voiceId?: string; lang: string; rate?: number; pitch?: number }): Promise<{ started: boolean; voice?: VoiceInfo }>;
  stop(): Promise<void>;
  addListener(ev: 'speechEnd', cb: (d: { reason: string }) => void): Promise<{ remove: () => Promise<void> }>;
}
const NativeSpeech = registerPlugin<NativeSpeechPlugin>('NativeSpeech');

const webSpeech = () => typeof window !== 'undefined' && 'speechSynthesis' in window && typeof SpeechSynthesisUtterance !== 'undefined';
export const speechAvailable = () => isNative() || webSpeech();

// Apple and common system voice names whose gender is not reported by Web Speech (the iPhone app gets it from iOS).
const FEMALE = /\b(samantha|karen|moira|tessa|fiona|victoria|allison|ava|susan|zoe|nicky|serena|kate|stephanie|martha|catherine|anna|helena|petra|marlene|vicki|sandy|shelley|flo|grandma|am[ée]lie|audrey|aur[ée]lie|marie|monica|m[óo]nica|paulina|marisol|isabela|alice|federica|emma|joana|luciana|catarina|yelda|milena|katya|zosia|ewa|lesya|ioana|linh|ting-?ting|yu-?shu|mei-?jia|sin-?ji|lekha|laila|sara|ellen|nora|alva|klara|satu|melina|kanya|damayanti|amira|carmit|mariska|kyoko|yuna|female|frau|femme|mujer|donna|mulher|kadın)\b/i;
const MALE = /\b(daniel|alex|fred|aaron|arthur|gordon|oliver|rishi|tom|evan|nathan|lee|martin|markus|yannick|viktor|thomas|jacques|jorge|juan|diego|eddy|reed|rocko|grandpa|luca|paolo|felipe|maged|majed|tarik|dariush|yuri|li-?mu|aru|xander|hattori|otoya|neel|male|mann|homme|hombre|uomo|homem|erkek)\b/i;
/** Web Speech voices as VoiceInfo. Quality and gender are guessed from the name (browsers report neither). */
export function webVoiceInfo(v: Pick<SpeechSynthesisVoice, 'voiceURI' | 'name' | 'lang'>): VoiceInfo {
  const n = v.name;
  const quality = /premium/i.test(n) ? 3 : /enhanced|natural|neural|wavenet/i.test(n) ? 2 : 1;
  const gender = /\bfemale\b/i.test(n) ? 2 : /\bmale\b/i.test(n) ? 1 : FEMALE.test(n) ? 2 : MALE.test(n) ? 1 : 0;
  return { id: v.voiceURI || n, name: n, lang: v.lang, quality, gender };
}
// Robotic or joke voices are only used when nothing else exists for the language.
const ROBOTIC = /eloquence|com\.apple\.speech\.synthesis\.voice\.|\b(albert|bad news|bahh|bells|boing|bubbles|cellos|good news|jester|organ|superstar|trinoids|whisper|wobble|zarvox|junior|ralph|kathy|eddy|flo|grandma|grandpa|reed|rocko|sandy|shelley)\b/i;

const norm = (s: string) => s.replace('_', '-').toLowerCase();
const baseOf = (l: string) => { const b = norm(l).split('-')[0]; return b === 'fil' ? 'tl' : b; };
export interface VoicePick { voice: VoiceInfo | null; genderMatched: boolean }
/**
 * Best installed voice for the language: right language (exact region first), then premium > enhanced > default,
 * never a novelty/personal voice, robotic voices only as a last resort (a pleasant voice beats the chosen gender). With a gender, voices of that gender win;
 * if the language has none, the best other voice is used and genderMatched is false (the app says so).
 */
export function pickVoice(voices: VoiceInfo[], lang: string, gender: VoiceGender = 'auto'): VoicePick {
  const want = norm(lang), base = baseOf(lang);
  const cands = voices.filter((v) => baseOf(v.lang) === base && !v.novelty && !v.personal);
  if (!cands.length) return { voice: null, genderMatched: false };
  const g = gender === 'female' ? 2 : gender === 'male' ? 1 : 0;
  const score = (v: VoiceInfo) => (g && v.gender === g ? 1000 : 0) + (ROBOTIC.test(v.id) || ROBOTIC.test(v.name) ? 0 : 2000) + v.quality * 10 + (norm(v.lang) === want ? 3 : 0);
  const best = [...cands].sort((a, b) => score(b) - score(a) || a.name.localeCompare(b.name))[0];
  return { voice: best, genderMatched: !g || best.gender === g };
}

export async function listVoices(): Promise<VoiceInfo[]> {
  if (isNative()) { try { return (await NativeSpeech.voices()).voices ?? []; } catch { /* fall back to Web Speech */ } }
  if (!webSpeech()) return [];
  let vs = speechSynthesis.getVoices();
  if (!vs.length) { await new Promise((ok) => { speechSynthesis.addEventListener?.('voiceschanged', ok, { once: true }); setTimeout(ok, 1500); }); vs = speechSynthesis.getVoices(); }
  return vs.map(webVoiceInfo);
}

/** Kept for old callers: a Web Speech voice for the language, or null. */
export function voiceFor(lang: string, voices: SpeechSynthesisVoice[] = webSpeech() ? speechSynthesis.getVoices() : []): SpeechSynthesisVoice | null {
  const p = pickVoice(voices.map(webVoiceInfo), lang).voice;
  return p ? voices.find((v) => (v.voiceURI || v.name) === p.id) ?? null : null;
}

export type SpeakResult = 'started' | 'no-voice' | 'unavailable';
export interface SpeakOutcome { result: SpeakResult; voice?: VoiceInfo; genderMatched?: boolean }
let endSub: { remove: () => Promise<void> } | null = null;
/** Speak text in lang with the best voice (and the chosen gender if one exists). onEnd runs once speaking stops. */
export async function speak(text: string, lang: string, onEnd?: () => void, gender: VoiceGender = 'auto'): Promise<SpeakOutcome> {
  if (!speechAvailable()) return { result: 'unavailable' };
  const voices = await listVoices();
  const { voice, genderMatched } = pickVoice(voices, lang, gender);
  if (voices.length && !voice) return { result: 'no-voice' };
  if (isNative()) {
    try {
      await endSub?.remove(); endSub = null;
      endSub = await NativeSpeech.addListener('speechEnd', () => { endSub?.remove(); endSub = null; onEnd?.(); });
      await NativeSpeech.speak({ text, voiceId: voice?.id, lang: voice?.lang ?? lang });
      return { result: 'started', voice: voice ?? undefined, genderMatched };
    } catch { if (!webSpeech()) return { result: 'unavailable' }; }
  }
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  const wv = voice ? speechSynthesis.getVoices().find((v) => (v.voiceURI || v.name) === voice.id) : undefined;
  u.lang = wv?.lang ?? lang;
  if (wv) { try { u.voice = wv; } catch { /* keep lang only */ } }
  u.rate = 0.95; u.pitch = 1;
  u.onend = () => onEnd?.();
  u.onerror = () => onEnd?.();
  speechSynthesis.speak(u);
  return { result: 'started', voice: voice ?? undefined, genderMatched };
}
export const stopSpeaking = () => {
  if (isNative()) NativeSpeech.stop().catch(() => {});
  if (webSpeech()) speechSynthesis.cancel();
};

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
  // The next-step wording exists only in the card language; do not mix it into another language.
  if (lang === card.userLanguage) out.push(t('easy_todo', { action: card.nextAction.text.replace(/\s+/g, ' ').trim() }));
  out.push(t('easy_check'));
  return out;
}
