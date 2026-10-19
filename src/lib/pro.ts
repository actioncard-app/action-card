// "LetterScan Pro": one-time, non-consumable in-app purchase (StoreKit via @capgo/native-purchases), iOS app only.
// Core features are never gated: reading documents, all fields and checks, steps, reminders (default schedule),
// calendar, PDF of a card and saving cards stay free and unlimited. Pro only adds local extras that cost nothing
// to run (custom reminder schedule, colour themes). Nothing here talks to a server of ours; there is none.
//
// NOT VERIFIED: the purchase flow cannot run without a Mac/Xcode, an App Store Connect product and a sandbox
// tester. The product id below is a PLACEHOLDER that Ben must create in App Store Connect.
import { isNative } from './native';

/**
 * Build flag. Pro (paywall, Unlock/Restore, Pro-gated buttons and settings) is only shown when the app is built with
 * VITE_PRO_ENABLED=true. Off by default: App Review rejects a purchase button whose in-app purchase does not exist yet.
 * Turn it back on once the IAP below is created (and submitted) in App Store Connect: set VITE_PRO_ENABLED=true for the
 * build (e.g. the iOS workflow's "pro_enabled" input). With the flag off every free feature works exactly as before.
 */
export const PRO_ENABLED = import.meta.env.VITE_PRO_ENABLED === 'true';

export const PRO_PRODUCT_ID = 'com.benjiferguson.letterscan.pro'; // must match the IAP product in App Store Connect
const CACHE = 'actioncard.pro.v1';
const MOCK = 'actioncard.pro.mock'; // test hook, honoured on the web build only (never in the iOS app)

export type ProStatus = 'owned' | 'not_owned';
export type BuyResult = 'purchased' | 'cancelled' | 'unavailable';
export interface ProProduct { price: string | null }

interface Mock { price?: string; result?: BuyResult; restore?: boolean }
const mock = (): Mock | null => {
  if (isNative() || !PRO_ENABLED) return null;
  try { const m = localStorage.getItem(MOCK); return m ? (JSON.parse(m) as Mock) : null; } catch { return null; }
};

/** Pro can be bought here: the iOS app (or the web test mock). On the web the paywall only explains where to get it. */
export const proPurchasable = () => PRO_ENABLED && (isNative() || !!mock());

/** Last known entitlement (cached so the UI does not flicker; refreshed from StoreKit on start in the iOS app). */
export function proOwnedCached(): boolean {
  if (!PRO_ENABLED) return false;
  try { return localStorage.getItem(CACHE) === 'owned'; } catch { return false; }
}
function setCache(s: ProStatus) { try { localStorage.setItem(CACHE, s); } catch { /* private mode */ } }

async function plugin() {
  const m = await import('@capgo/native-purchases');
  return { NP: m.NativePurchases, INAPP: m.PURCHASE_TYPE.INAPP };
}

/** Ask StoreKit for current entitlements (verified transactions, on-device). Falls back to the cache when offline. */
export async function refreshPro(): Promise<boolean> {
  if (!PRO_ENABLED) return false;
  const mk = mock();
  if (mk) return proOwnedCached();
  if (!isNative()) { return false; }
  try {
    const { NP, INAPP } = await plugin();
    const { purchases } = await NP.getPurchases({ productType: INAPP, onlyCurrentEntitlements: true });
    const owned = purchases.some((p) => p.productIdentifier === PRO_PRODUCT_ID && !p.revocationDate);
    setCache(owned ? 'owned' : 'not_owned');
    return owned;
  } catch { return proOwnedCached(); }
}

/** Localised price from the App Store (never hard-coded: Apple sets it per storefront from Ben's price choice). */
export async function proProduct(): Promise<ProProduct> {
  const mk = mock();
  if (mk) return { price: mk.price ?? null };
  if (!isNative()) return { price: null };
  try {
    const { NP, INAPP } = await plugin();
    const { product } = await NP.getProduct({ productIdentifier: PRO_PRODUCT_ID, productType: INAPP });
    return { price: product?.priceString ?? null };
  } catch { return { price: null }; }
}

export async function buyPro(): Promise<BuyResult> {
  if (!PRO_ENABLED) return 'unavailable';
  const mk = mock();
  if (mk) { const r = mk.result ?? 'purchased'; if (r === 'purchased') setCache('owned'); return r; }
  if (!isNative()) return 'unavailable';
  try {
    const { NP, INAPP } = await plugin();
    const { isBillingSupported } = await NP.isBillingSupported();
    if (!isBillingSupported) return 'unavailable';
    const tx = await NP.purchaseProduct({ productIdentifier: PRO_PRODUCT_ID, productType: INAPP, quantity: 1 });
    if (tx?.transactionId) { setCache('owned'); return 'purchased'; }
    return 'cancelled';
  } catch (e) {
    const msg = String((e as Error)?.message ?? e).toLowerCase();
    return /cancel/.test(msg) ? 'cancelled' : 'unavailable';
  }
}

/** "Restore purchase" (required by App Review for non-consumables): syncs with the App Store, then re-reads entitlements. */
export async function restorePro(): Promise<boolean | 'unavailable'> {
  if (!PRO_ENABLED) return 'unavailable';
  const mk = mock();
  if (mk) { if (mk.restore) setCache('owned'); return !!mk.restore; }
  if (!isNative()) return 'unavailable';
  try {
    const { NP } = await plugin();
    await NP.restorePurchases();
    return await refreshPro();
  } catch { return 'unavailable'; }
}

// ---- Pro extras (local only) ----
export const THEMES = ['default', 'ocean', 'forest', 'plum'] as const;
export type Theme = (typeof THEMES)[number];
/** Reminder schedules (days before the deadline, 0 = on the day). The first one is the free default. */
export const REMINDER_PRESETS: readonly (readonly number[])[] = [[3, 0], [7, 3, 1, 0], [14, 7, 3, 0], [1, 0]];
export const DEFAULT_REMINDERS = REMINDER_PRESETS[0];
