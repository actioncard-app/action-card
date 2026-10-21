import { useState } from 'react';
import { isNative } from '../lib/native';
import { VoicePanel } from './VoicePanel';
import { DEFAULT_MODEL, type Settings } from '../lib/settings';
import { LANGS, LANG_NAMES, EXTRA_LANGS, UI_LANGS, UI_LANG_NAMES, type Lang, type ReadLang, type UiLangCode } from '../lib/types';
import { clearAll } from '../lib/db';
import { IconGlobe, IconSpark, IconShield, IconInfo } from './Icons';
import { useT } from '../lib/i18n';
import { ProSection } from './ProPanel';
import { BackupButton, RestoreBox } from './BackupPanel';
import { IconDownload } from './Icons';
import { PRO_ENABLED } from '../lib/pro';

// Privacy policy and support pages live on the public site (also linked from the App Store listing). Absolute URL so the
// iOS app opens them in Safari instead of navigating its own web view away.
const SITE = 'https://actioncard-app.github.io/action-card/';

export default function SettingsScreen({ settings, onChange, onShowIntro }: { settings: Settings; onChange: (s: Settings) => void; onShowIntro?: () => void }) {
  const t = useT();
  const [key, setKey] = useState(settings.xaiKey);
  const [model, setModel] = useState(settings.xaiModel);
  const [msg, setMsg] = useState<string | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);
  const [askConsent, setAskConsent] = useState(false);
  const aiOn = settings.aiEnabled && !!settings.aiConsent;
  // Turning AI mode on always goes through an explicit consent step first (nothing is sent to xAI before "Agree").
  const toggleAi = (on: boolean) => { if (on) setAskConsent(true); else { setAskConsent(false); onChange({ ...settings, aiEnabled: false }); } };
  return (
    <div className="settings screen" data-testid="settings">
      <h2>{t('settings')}</h2>

      <section className="panel">
        <div className="panel-head"><span className="panel-ic" aria-hidden><IconGlobe /></span><label htmlFor="ulang" className="panel-title">{t('your_language')}</label></div>
        <p className="small muted">{t('your_language_help')}</p>
        <select id="ulang" value={settings.userLanguage} onChange={(e) => onChange({ ...settings, userLanguage: e.target.value as UiLangCode })} data-testid="user-lang">
          {UI_LANGS.map((l) => <option key={l} value={l} lang={l}>{UI_LANG_NAMES[l]}</option>)}
        </select>
        {!(LANGS as readonly string[]).includes(settings.userLanguage) && <p className="small muted" data-testid="lang-unreviewed">{t('lang_unreviewed')} {t('cards_english')}</p>}
        <label htmlFor="dlang" className="panel-title" style={{ marginTop: 14 }}>{t('doc_language')}</label>
        <select id="dlang" value={settings.docLanguage} onChange={(e) => onChange({ ...settings, docLanguage: e.target.value as ReadLang | 'auto' })}>
          <option value="auto">{t('detect_auto')}</option>
          <optgroup label={t('lang_group_full')}>{LANGS.map((l) => <option key={l} value={l}>{LANG_NAMES[l]}</option>)}</optgroup>
          <optgroup label={t('lang_group_read')}>{EXTRA_LANGS.map((l) => <option key={l} value={l} lang={l}>{UI_LANG_NAMES[l]}</option>)}</optgroup>
        </select>
        <p className="small muted">{t('doc_lang_help')}</p>
      </section>

      <ProSection settings={settings} onChange={onChange} />

      {PRO_ENABLED && <section className="panel" data-testid="backup-section">
        <div className="panel-head"><span className="panel-ic" aria-hidden><IconDownload /></span><div className="panel-title">{t('backup_title')}</div></div>
        <p className="small muted">{t('backup_help')}</p>
        <BackupButton />
        <RestoreBox settings={settings} onChange={onChange} />
      </section>}

      <VoicePanel settings={settings} onChange={onChange} />

      <section className="panel">
        <div className="panel-head"><span className="panel-ic" aria-hidden><IconSpark /></span><div className="panel-title">{t('ai_title')}</div></div>
        <p className="small">{t('ai_help')}</p>
        <p className="small warn-text">{t(isNative() ? 'ai_key_warning_app' : 'ai_key_warning')}</p>
        <label className="switch">
          <input type="checkbox" checked={aiOn} onChange={(e) => toggleAi(e.target.checked)} data-testid="ai-toggle" />
          <span>{t('ai_toggle')}</span>
        </label>
        {askConsent && (
          <div className="consent" role="alertdialog" aria-labelledby="ai-consent-title" data-testid="ai-consent">
            <p className="panel-title" id="ai-consent-title">{t('ai_consent_title')}</p>
            <p className="small">{t('ai_consent_body')}</p>
            <p className="small" data-testid="ai-consent-redact">{t('ai_consent_redact')}</p>
            <div className="row-btns">
              <button className="btn small primary" onClick={() => { setAskConsent(false); onChange({ ...settings, aiEnabled: true, aiConsent: true }); }} data-testid="ai-consent-agree">{t('ai_consent_agree')}</button>
              <button className="btn small ghost" onClick={() => setAskConsent(false)} data-testid="ai-consent-cancel">{t('cancel')}</button>
            </div>
          </div>
        )}
        <label htmlFor="xkey" className="small">{t('ai_key')}</label>
        <input id="xkey" type="password" autoComplete="off" spellCheck={false} placeholder="xai-…" value={key} onChange={(e) => setKey(e.target.value)} data-testid="ai-key" />
        <label htmlFor="xmodel" className="small">{t('model')}</label>
        <input id="xmodel" type="text" spellCheck={false} value={model} onChange={(e) => setModel(e.target.value)} />
        <div className="row-btns">
          <button className="btn small primary" onClick={() => { onChange({ ...settings, xaiKey: key.trim(), xaiModel: model.trim() || DEFAULT_MODEL }); setMsg(t('key_saved')); }} data-testid="ai-save">{t('save_key')}</button>
          <button className="btn small ghost" onClick={() => { setKey(''); onChange({ ...settings, xaiKey: '', aiEnabled: false }); setMsg(t('key_removed')); }}>{t('remove_key')}</button>
        </div>
        {msg && <p className="small muted">{msg}</p>}
      </section>

      <section className="panel">
        <div className="panel-head"><span className="panel-ic" aria-hidden><IconShield /></span><div className="panel-title">{t('privacy')}</div></div>
        <ul className="small">
          <li>{t('privacy_1')}</li>
          <li>{t(isNative() ? 'privacy_2_app' : 'privacy_2')}</li>
          <li>{t('privacy_read_langs')}</li>
          <li>{t('ai_consent_redact')}</li>
          <li>{t(isNative() ? 'privacy_3_app' : 'privacy_3')}</li>
          {PRO_ENABLED && <li>{t('pro_privacy')}</li>}
        </ul>
        {confirmClear ? (
          <div className="row-btns">
            <button className="btn small danger" onClick={async () => { await clearAll(); setConfirmClear(false); setMsg(t('all_deleted')); }}>{t('delete_all_yes')}</button>
            <button className="btn small ghost" onClick={() => setConfirmClear(false)}>{t('cancel')}</button>
          </div>
        ) : (
          <button className="btn small ghost" onClick={() => setConfirmClear(true)}>{t('delete_all')}</button>
        )}
      </section>

      <section className="panel">
        <div className="panel-head"><span className="panel-ic" aria-hidden><IconInfo /></span><div className="panel-title">{t('about')}</div></div>
        <p className="small">{t(isNative() ? 'about_1_app' : 'about_1')}</p>
        {/* web-only notes (installing from Safari; mentions other platforms, which App Store metadata must not) */}
        {!isNative() && <p className="small muted">{t('about_install')}</p>}
        {!isNative() && <p className="small muted">{t('about_tech')}</p>}
        <div className="row-btns">
          <a className="btn small ghost" href={`${SITE}privacy.html`} target="_blank" rel="noopener" data-testid="privacy-link">{t('privacy_policy')}</a>
          <a className="btn small ghost" href={`${SITE}support.html`} target="_blank" rel="noopener" data-testid="support-link">{t('support')}</a>
        </div>
        {onShowIntro && <button className="btn small ghost" onClick={onShowIntro} data-testid="show-intro">{t('show_intro')}</button>}
      </section>
    </div>
  );
}
