// App updates: the new service worker activates in the background (autoUpdate), but the page is only reloaded when
// the user is not in the middle of something (no OCR running). The current card is kept in sessionStorage, so it
// survives the reload. Until then the old version keeps running.
let pending = false;
let isBusy: () => boolean = () => false;
const tryReload = () => { if (pending && !isBusy()) { pending = false; try { sessionStorage.setItem(UPDATE_RELOAD, '1'); } catch { /* */ } window.location.reload(); } };
/** Set just before an app-update reload, so only that reload reopens the card that was open. */
export const UPDATE_RELOAD = 'letterscan-update-reload';

export function onNeedReload() { pending = true; tryReload(); }
export function setBusyCheck(fn: () => boolean) { isBusy = fn; }
/** Call when the app becomes idle (e.g. OCR finished). */
export function idleNow() { tryReload(); }
export const updatePending = () => pending;
