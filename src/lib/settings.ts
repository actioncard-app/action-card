import type { Lang } from './types';
import { detectLanguage } from './i18n';

export interface Settings {
  userLanguage: Lang;
  docLanguage: Lang | 'auto';
  aiEnabled: boolean;
  xaiKey: string; // stored only in this browser's localStorage
  xaiModel: string;
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
