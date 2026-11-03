// Pro subscription UI: settings section, paywall dialog, restore. Purchase plumbing lives in src/lib/pro.ts.
import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { FREE_SCANS, resetDate, scansLeft } from '../lib/limits';
import { useLang, useT } from '../lib/i18n';
import type { Settings } from '../lib/settings';
import { buyPro, MANAGE_SUBS_URL, TERMS_URL, PRO_ENABLED, proProduct, proPurchasable, restorePro, REMINDER_PRESETS, THEMES, type Theme } from '../lib/pro';
import { IconStar, IconCheck } from './Icons';

export interface ProState { owned: boolean; setOwned: (b: boolean) => void; reminderDays: readonly number[] }
export const ProCtx = createContext<ProState>({ owned: false, setOwned: () => {}, reminderDays: REMINDER_PRESETS[0] });
export const usePro = () => useContext(ProCtx);

/** Effective reminder schedule: own schedule only while Pro is owned. */
export const reminderDaysFor = (s: Settings, owned: boolean): readonly number[] => (owned && s.reminderDays?.length ? s.reminderDays : REMINDER_PRESETS[0]);

/** notice 'scans': opened because the free scans for this month are used up (explains why, then the paywall). */
export function Paywall({ onClose, notice }: { onClose: () => void; notice?: 'scans' }) {
  if (!PRO_ENABLED) return null; // build flag: Pro hidden (see src/lib/pro.ts)
  return <PaywallDialog onClose={onClose} notice={notice} />;
}

function PaywallDialog({ onClose, notice }: { onClose: () => void; notice?: 'scans' }) {
  const t = useT();
  const ul = useLang();
  const [trial, setTrial] = useState(false);
  const { owned, setOwned } = usePro();
  const [price, setPrice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const can = proPurchasable();
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => { if (can) proProduct().then((p) => { setPrice(p.price); setTrial(p.trial); }); ref.current?.focus(); }, [can]);
  useEffect(() => { const k = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); }; window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k); }, [onClose]);
  const buy = async () => {
    setBusy(true); setMsg(null);
    const r = await buyPro();
    setBusy(false);
    if (r === 'purchased') { setOwned(true); setMsg(t('pro_active')); } else setMsg(r === 'cancelled' ? t('pro_cancelled') : t('pro_unavailable'));
  };
  const restore = async () => {
    setBusy(true); setMsg(null);
    const r = await restorePro();
    setBusy(false);
    if (r === true) { setOwned(true); setMsg(t('pro_active')); } else setMsg(r === 'unavailable' ? t('pro_unavailable') : t('pro_restored_none_sub'));
  };
  return (
    <div className="paywall-backdrop" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="paywall" role="dialog" aria-modal="true" aria-labelledby="pw-title" tabIndex={-1} ref={ref} data-testid="paywall">
        <div className="pw-badge" aria-hidden><IconStar size={26} /></div>
        <h2 id="pw-title">{t('pro_title')}</h2>
        {notice === 'scans' && !owned && (
          <div className="alert info pw-notice" role="status" data-testid="limit-notice">
            <strong>{t('core_limit_title')}</strong>
            <p className="small">{t('core_limit_body', { m: FREE_SCANS, date: (resetDate() ?? new Date()).toLocaleDateString(ul, { day: 'numeric', month: 'long' }) })}</p>
          </div>
        )}
        <p className="pw-length" data-testid="pro-length">{t('pro_length')}</p>
        {price && !owned && <p className="pw-price" data-testid="pro-price">{trial ? t('pro_trial_line', { price }) : t('pro_price_month', { price })}</p>}
        <p className="pw-lead">{t('pro_lead_core')}</p>
        <ul className="pw-list" data-testid="pro-features">
          {(['pro_f_unlimited', 'pro_f_plan', 'pro_f_voices', 'pro_f_history', 'pro_f_backup', 'pro_f_bundle', 'pro_f_export', 'pro_f_reminders', 'pro_f_qr', 'pro_f_themes'] as const).map((k) => <li key={k}><IconCheck size={18} /> {t(k)}</li>)}
        </ul>
        {owned ? <p className="pw-owned" role="status" data-testid="pro-owned">{t('pro_active')}</p> : can ? (
          <button className="btn primary block" onClick={buy} disabled={busy} data-testid="pro-buy" data-trial={trial ? '1' : '0'}>{trial ? t('pro_start_trial') : price ? `${t('pro_subscribe')} · ${t('pro_price_month', { price })}` : t('pro_subscribe')}</button>
        ) : <p className="small muted" data-testid="pro-web">{t('pro_web')}</p>}
        {can && <button className="btn ghost block" onClick={restore} disabled={busy} data-testid="pro-restore">{t('pro_restore_all')}</button>}
        {msg && !owned && <p className="small" role="status" data-testid="pro-msg">{msg}</p>}
        {trial && !owned && <p className="small muted" data-testid="pro-trial-terms">{t('pro_trial_terms', { price: price ?? t('pro_price_store') })}</p>}
        <p className="small muted" data-testid="pro-renew">{t('pro_renew_terms')}</p>
        <p className="small muted pw-free" data-testid="core-free-note">{t('core_free_note', { m: FREE_SCANS })}</p>
        <p className="small muted" data-testid="pro-manage-how">{t('pro_manage_how')}</p>
        <p className="small muted" data-testid="pro-privacy">{t('pro_privacy')}</p>
        <SubLinks />
        <button className="btn secondary block" onClick={onClose} data-testid="pro-close">{t('got_it')}</button>
      </div>
    </div>
  );
}

const PRIVACY_URL = 'https://actioncard-app.github.io/action-card/privacy.html';
/** Manage subscription (Apple), Terms of Use (Apple standard EULA) and privacy policy: shown on the paywall and in Settings. */
export function SubLinks({ manage = true }: { manage?: boolean }) {
  const t = useT();
  return (
    <div className="row-btns pw-links" data-testid="pro-links">
      {manage && <a className="btn small ghost" href={MANAGE_SUBS_URL} target="_blank" rel="noopener" data-testid="pro-manage">{t('pro_manage')}</a>}
      <a className="btn small ghost" href={TERMS_URL} target="_blank" rel="noopener" data-testid="pro-terms">{t('pro_terms')}</a>
      <a className="btn small ghost" href={PRIVACY_URL} target="_blank" rel="noopener" data-testid="pro-privacy-link">{t('privacy_policy')}</a>
    </div>
  );
}

/** Settings section: Pro status, the Pro options (enabled only when owned), and the way into the paywall. */
export function ProSection(props: { settings: Settings; onChange: (s: Settings) => void }) {
  return PRO_ENABLED ? <ProSectionInner {...props} /> : null; // build flag: Pro hidden (see src/lib/pro.ts)
}

function ProSectionInner({ settings, onChange }: { settings: Settings; onChange: (s: Settings) => void }) {
  const t = useT();
  const { owned } = usePro();
  const [open, setOpen] = useState(false);
  const days = settings.reminderDays?.join(',') ?? REMINDER_PRESETS[0].join(',');
  return (
    <section className="panel" data-testid="pro-section">
      <div className="panel-head"><span className="panel-ic" aria-hidden><IconStar /></span><h3 className="panel-title">{t('pro_title')}</h3>{!owned && <span className="pill pro-pill">{t('pro_locked')}</span>}</div>
      {owned ? <p className="small muted" data-testid="pro-active">{t('pro_active')}</p> : <><p className="small muted" data-testid="core-free-settings">{t('core_free_note', { m: FREE_SCANS })}</p><p className="small" data-testid="settings-scans-left">{t('core_scans_left', { n: scansLeft(), m: FREE_SCANS })}</p></>}
      <label htmlFor="pro-days" className="panel-title" style={{ marginTop: 10 }}>{t('pro_reminder_days')}</label>
      <select id="pro-days" value={owned ? days : REMINDER_PRESETS[0].join(',')} disabled={!owned} onChange={(e) => onChange({ ...settings, reminderDays: e.target.value.split(',').map(Number) })} data-testid="pro-days">
        {REMINDER_PRESETS.map((p) => <option key={p.join(',')} value={p.join(',')}>{p.join(' · ')}</option>)}
      </select>
      <p className="small muted">{t('pro_days_help')}</p>
      <label htmlFor="pro-theme" className="panel-title" style={{ marginTop: 10 }}>{t('pro_theme')}</label>
      <select id="pro-theme" value={owned ? settings.theme ?? 'default' : 'default'} disabled={!owned} onChange={(e) => onChange({ ...settings, theme: e.target.value as Theme })} data-testid="pro-theme">
        {THEMES.map((th) => <option key={th} value={th}>{t(`theme_${th}` as 'theme_default')}</option>)}
      </select>
      {!owned && <button className="btn primary block" style={{ marginTop: 12 }} onClick={() => setOpen(true)} data-testid="pro-open"><IconStar size={18} /> {t('pro_open')}</button>}
      {owned && <button className="btn ghost small" style={{ marginTop: 8 }} onClick={() => setOpen(true)}>{t('pro_title')}</button>}
      <SubLinks manage={owned} />
      {open && <Paywall onClose={() => setOpen(false)} />}
    </section>
  );
}

/** Free Core keeps 1 saved letter. Saving another: replace the saved one (only when exactly one is saved) or see Pro.
 *  The open letter is never thrown away: closing keeps it on screen, unsaved. */
export function SaveLimitDialog({ hasOne, onReplace, onClose }: { hasOne: boolean; onReplace: () => void; onClose: () => void }) {
  const t = useT();
  const [pw, setPw] = useState(false);
  if (pw) return <Paywall onClose={() => { setPw(false); onClose(); }} />;
  return (
    <div className="paywall-backdrop" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="paywall" role="dialog" aria-modal="true" aria-labelledby="sl-title" data-testid="save-limit">
        <h2 id="sl-title">{t('core_save_title')}</h2>
        <p className="small">{t('core_save_body')}</p>
        {hasOne && <button className="btn secondary block" onClick={onReplace} data-testid="save-replace">{t('core_replace')}</button>}
        <button className="btn primary block" onClick={() => setPw(true)} data-testid="save-limit-pro"><IconStar size={18} /> {t('pro_open')}</button>
        <button className="btn ghost block" onClick={onClose} data-testid="save-limit-close">{t('cancel')}</button>
      </div>
    </div>
  );
}

/** Pro-only feature on a free Core card: a short note and the way into the paywall. */
export function ProTeaser({ text, testid }: { text: string; testid: string }) {
  const t = useT();
  const [open, setOpen] = useState(false);
  return (
    <section className="panel pro-teaser" data-testid={testid}>
      <p className="small"><span className="pill pro-pill">Pro</span> {text}</p>
      <button className="btn small secondary" onClick={() => setOpen(true)} data-testid={`${testid}-open`}><IconStar size={16} /> {t('pro_open')}</button>
      {open && <Paywall onClose={() => setOpen(false)} />}
    </section>
  );
}
