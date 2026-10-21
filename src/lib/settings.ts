import type { ReadLang, UiLangCode } from './types';
import { detectLanguage } from './i18n';

export interface Settings {
  userLanguage: UiLangCode;
  docLanguage: ReadLang | 'auto';
  aiEnabled: boolean;
  /** Set only when the user agreed to the AI-mode consent dialog. Without it nothing is ever sent to xAI. */
  aiConsent?: boolean;
  xaiKey: string; // stored only in this browser's localStorage
  xaiModel: string;
  /** Pro extras (only applied while Pro is owned). */
  theme?: 'default' | 'ocean' | 'forest' | 'plum';
  reminderDays?: number[];
  /** Read-aloud voice: best voice of any gender, or prefer a female / male voice (falls back when none is installed). */
  voiceGender?: 'auto' | 'female' | 'male';
  /** iPhone app: natural offline neural voice (default) or the iPhone's own voices. */
  voiceKind?: 'natural' | 'system';
}
export const DEFAULT_MODEL = 'grok-4.20-0309-non-reasoning';
const KEY = 'actioncard.settings.v1';
export const DEFAULT_SETTINGS: Settings = { userLanguage: 'en', docLanguage: 'auto', aiEnabled: false, xaiKey: '', xaiModel: DEFAULT_MODEL };

export function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(KEY);
    // first start: use the phone's language if supported; afterwards the saved choice wins
    return raw ? { ...DEFAULT_SETTINGS, ...JSON.parse(raw) } : { ...DEFAULT_SETTINGS, userLanguage: detectLanguage() };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}
export function saveSettings(s: Settings) {
  localStorage.setItem(KEY, JSON.stringify(s));
}
