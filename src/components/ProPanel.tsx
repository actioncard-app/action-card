// Pro unlock UI: settings section, paywall dialog, restore. Purchase plumbing lives in src/lib/pro.ts.
import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { useT } from '../lib/i18n';
import type { Settings } from '../lib/settings';
import { buyPro, PRO_ENABLED, proProduct, proPurchasable, restorePro, REMINDER_PRESETS, THEMES, type Theme } from '../lib/pro';
import { IconStar, IconCheck } from './Icons';

export interface ProState { owned: boolean; setOwned: (b: boolean) => void; reminderDays: readonly number[] }
export const ProCtx = createContext<ProState>({ owned: false, setOwned: () => {}, reminderDays: REMINDER_PRESETS[0] });
export const usePro = () => useContext(ProCtx);

/** Effective reminder schedule: own schedule only while Pro is owned. */
export const reminderDaysFor = (s: Settings, owned: boolean): readonly number[] => (owned && s.reminderDays?.length ? s.reminderDays : REMINDER_PRESETS[0]);

export function Paywall({ onClose }: { onClose: () => void }) {
  if (!PRO_ENABLED) return null; // build flag: Pro hidden (see src/lib/pro.ts)
  return <PaywallDialog onClose={onClose} />;
}

function PaywallDialog({ onClose }: { onClose: () => void }) {
  const t = useT();
  const { owned, setOwned } = usePro();
  const [price, setPrice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const can = proPurchasable();
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => { if (can) proProduct().then((p) => setPrice(p.price)); ref.current?.focus(); }, [can]);
  useEffect(() => { const k = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); }; window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k); }, [onClose]);
  const buy = async () => {
    setBusy(true); setMsg(null);
    const r = await buyPro();
    setBusy(false);
    if (r === 'purchased') { setOwned(true); setMsg(t('pro_owned')); } else setMsg(r === 'cancelled' ? t('pro_cancelled') : t('pro_unavailable'));
  };
  const restore = async () => {
    setBusy(true); setMsg(null);
    const r = await restorePro();
    setBusy(false);
    if (r === true) { setOwned(true); setMsg(t('pro_owned')); } else setMsg(r === 'unavailable' ? t('pro_unavailable') : t('pro_restored_none'));
  };
  return (
    <div className="paywall-backdrop" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="paywall" role="dialog" aria-modal="true" aria-labelledby="pw-title" tabIndex={-1} ref={ref} data-testid="paywall">
        <div className="pw-badge" aria-hidden><IconStar size={26} /></div>
        <h2 id="pw-title">{t('pro_title')}</h2>
        <p className="pw-lead">{t('pro_lead')}</p>
        <ul className="pw-list">
          <li><IconCheck size={18} /> {t('pro_f_reminders')}</li>
          <li><IconCheck size={18} /> {t('pro_f_themes')}</li>
          <li><IconCheck size={18} /> {t('pro_f_backup')}</li>
          <li><IconCheck size={18} /> {t('pro_f_bundle')}</li>
        </ul>
        {owned ? <p className="pw-owned" role="status" data-testid="pro-owned">{t('pro_owned')}</p> : can ? (
          <>
            <button className="btn primary block" onClick={buy} disabled={busy} data-testid="pro-buy">{price ? t('pro_buy', { price }) : t('pro_buy_noprice')}</button>
            <button className="btn ghost block" onClick={restore} disabled={busy} data-testid="pro-restore">{t('pro_restore')}</button>
          </>
        ) : <p className="small muted" data-testid="pro-web">{t('pro_web')}</p>}
        {msg && !owned && <p className="small" role="status" data-testid="pro-msg">{msg}</p>}
        <p className="small muted pw-free">{t('pro_free_note')}</p>
        <p className="small muted" data-testid="pro-privacy">{t('pro_privacy')}</p>
        <button className="btn secondary block" onClick={onClose} data-testid="pro-close">{t('got_it')}</button>
      </div>
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
      {owned ? <p className="small muted">{t('pro_owned')}</p> : <p className="small muted">{t('pro_lead')}</p>}
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
      {open && <Paywall onClose={() => setOpen(false)} />}
    </section>
  );
}
