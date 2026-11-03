// Optional AI mode (user's own xAI key) is a web-only feature. It is compiled in only when the app is built with
// VITE_AI_ENABLED=true (the GitHub Pages web build). The iOS app is built without it, so it has no AI settings, no
// consent screen, no key field and no code path that contacts xAI. Even if the flag were set, it stays off natively.
import { isNative } from './native';
import type { Settings } from './settings';

export const AI_ENABLED = import.meta.env?.VITE_AI_ENABLED === 'true' // ?. : unit tests run outside Vite;

/** True only in a web build made with the flag, never in the iPhone app. */
export const aiAvailable = (): boolean => AI_ENABLED && !isNative();

/** Drops any saved AI-mode state (e.g. a key saved by an older build) when AI mode is not available. */
export function withoutAi(s: Settings): Settings {
  return aiAvailable() ? s : { ...s, aiEnabled: false, aiConsent: false, xaiKey: '' };
}
