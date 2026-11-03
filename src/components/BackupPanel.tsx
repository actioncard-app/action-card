// Pro extras around saved cards: backup export (Pro), restore (always free) and the all-cards PDF (Pro).
import { useRef, useState } from 'react';
import { useT, useLang } from '../lib/i18n';
import type { Settings } from '../lib/settings';
import type { SavedCard } from '../lib/types';
import { cardLang } from '../lib/types';
import { listCards, saveCard } from '../lib/db';
import { BackupParseError, exportBackup, mergeSettings, newCards, parseBackup, type BackupFile } from '../lib/backup';
import { Paywall, usePro } from './ProPanel';
import { PRO_ENABLED } from '../lib/pro';
import { IconDownload, IconStar } from './Icons';

/** "All cards as one PDF" (Pro). Without Pro the button opens the paywall. */
export function BundleButton(props: { cards: SavedCard[]; selected?: SavedCard[] }) {
  return PRO_ENABLED ? <BundleButtonInner {...props} /> : null; // build flag: Pro hidden (see src/lib/pro.ts)
}

function BundleButtonInner({ cards, selected }: { cards: SavedCard[]; selected?: SavedCard[] }) {
  const t = useT();
  const ul = useLang();
  const { owned } = usePro();
  const [open, setOpen] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const list = selected?.length ? selected : cards;
  const go = async () => {
    if (!owned) { setOpen(true); return; }
    const { exportBundlePdf } = await import('../lib/pdf');
    await exportBundlePdf(list, cardLang(ul));
    setMsg(t('bundle_done', { n: list.length }));
  };
  return (
    <>
      <button className="btn secondary small" onClick={go} disabled={!list.length} data-testid="bundle-btn">
        {owned ? <IconDownload size={18} /> : <IconStar size={18} />} {selected?.length ? t('bundle_selected', { n: selected.length }) : t('bundle_btn')}
        {!owned && <span className="pill pro-pill">Pro</span>}
      </button>
      {msg && <p className="small muted" role="status" data-testid="bundle-msg">{msg}</p>}
      {open && <Paywall onClose={() => setOpen(false)} />}
    </>
  );
}

/** "Back up all cards" (Pro). Without Pro the button opens the paywall. */
export function BackupButton() {
  return PRO_ENABLED ? <BackupButtonInner /> : null; // build flag: Pro hidden (see src/lib/pro.ts)
}

function BackupButtonInner() {
  const t = useT();
  const { owned } = usePro();
  const [open, setOpen] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const go = async () => {
    if (!owned) { setOpen(true); return; }
    const { loadSettings } = await import('../lib/settings');
    const cards = await listCards();
    await exportBackup(cards, loadSettings());
    setMsg(t('backup_done', { n: cards.length }));
  };
  return (
    <>
      <button className="btn secondary small" onClick={go} data-testid="backup-btn">
        {owned ? <IconDownload size={18} /> : <IconStar size={18} />} {t('backup_export')}
        {!owned && <span className="pill pro-pill">Pro</span>}
      </button>
      {msg && <p className="small muted" role="status" data-testid="backup-msg">{msg}</p>}
      {open && <Paywall onClose={() => setOpen(false)} />}
    </>
  );
}

/** Restore: always free. Shows what the file holds, adds only cards that are not here yet, never deletes. */
export function RestoreBox({ settings, onChange, onRestored }: { settings: Settings; onChange: (s: Settings) => void; onRestored?: () => void }) {
  const t = useT();
  const input = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<BackupFile | null>(null);
  const [fresh, setFresh] = useState<SavedCard[]>([]);
  const [withSettings, setWithSettings] = useState(false);
  const [msg, setMsg] = useState<{ text: string; err?: boolean } | null>(null);
  const pick = async (f: File | undefined) => {
    setFile(null); setMsg(null);
    if (!f) return;
    try {
      const b = parseBackup(await f.text());
      const have = (await listCards()).map((c) => c.id);
      setFile(b); setFresh(newCards(b, have));
    } catch (e) {
      setMsg({ text: t(e instanceof BackupParseError ? e.code : 'err_backup_json'), err: true });
    } finally { if (input.current) input.current.value = ''; }
  };
  const apply = async () => {
    if (!file) return;
    for (const c of fresh) await saveCard(c);
    if (withSettings) onChange(mergeSettings(settings, file));
    setMsg({ text: fresh.length ? t('restore_done', { n: fresh.length }) : t('restore_nothing_new') });
    setFile(null); setFresh([]); onRestored?.();
  };
  return (
    <div className="restore" data-testid="restore-box">
      <button className="btn ghost small" onClick={() => input.current?.click()} data-testid="restore-btn">{t('restore_btn')}</button>
      <input ref={input} type="file" accept="application/json,.json" hidden onChange={(e) => pick(e.target.files?.[0])} data-testid="restore-input" />
      <p className="small muted">{t('restore_help')}</p>
      {file && (
        <div className="restore-preview" data-testid="restore-preview">
          <p className="small" data-testid="restore-found">{t('restore_found', { n: file.cards.length, m: fresh.length })}</p>
          <label className="switch small"><input type="checkbox" checked={withSettings} onChange={(e) => setWithSettings(e.target.checked)} data-testid="restore-settings" /><span>{t('restore_settings_too')}</span></label>
          <div className="row-btns">
            <button className="btn small primary" onClick={apply} data-testid="restore-apply">{fresh.length ? t('restore_add', { n: fresh.length }) : t('got_it')}</button>
            <button className="btn small ghost" onClick={() => { setFile(null); setFresh([]); }}>{t('cancel')}</button>
          </div>
        </div>
      )}
      {msg && <p className={`small ${msg.err ? 'warn-text' : 'muted'}`} role={msg.err ? 'alert' : 'status'} data-testid={msg.err ? 'restore-error' : 'restore-msg'}>{msg.text}</p>}
    </div>
  );
}
