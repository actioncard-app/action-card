import type { Settings } from '../lib/settings';
import { LANGS, LANG_NAMES, type Lang } from '../lib/types';
import { useState } from 'react';
import { IconCamera, IconImage, IconShield, IconDoc, IconSpark, IconCheck } from './Icons';
import { introSeen, makeSampleFile, setIntroSeen } from '../lib/sample';
import { useT } from '../lib/i18n';

interface Props { settings: Settings; onSettings: (s: Settings) => void; onFile: (f: File) => void; error: string | null }

export default function CaptureScreen({ settings, onSettings, onFile, error }: Props) {
  const t = useT();
  const [intro, setIntro] = useState(() => !introSeen());
  const [sampleErr, setSampleErr] = useState<string | null>(null);
  const close = () => { setIntroSeen(true); setIntro(false); };
  const trySample = async () => {
    setSampleErr(null);
    try { const f = await makeSampleFile(); close(); onFile(f); } catch (e) { setSampleErr(t('sample_err', { msg: (e as Error).message })); }
  };
  const pick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (f) onFile(f);
  };
  return (
    <div className="capture screen">
      <p className="eyebrow">{t('eyebrow')}</p>
      <h1>{t('headline')}</h1>
      <p className="tagline" data-testid="tagline">{t('tagline')}</p>
      <p className="lead">{t('lead')}</p>

      {intro && (
        <section className="intro" data-testid="intro" aria-labelledby="intro-title">
          <h2 id="intro-title" className="intro-title">{t('intro_title')}</h2>
          <ol className="intro-steps">
            <li><span className="intro-ic" aria-hidden><IconCamera size={18} /></span>{t('intro_1')}</li>
            <li><span className="intro-ic" aria-hidden><IconSpark size={18} /></span>{t('intro_2')}</li>
            <li><span className="intro-ic" aria-hidden><IconCheck size={18} /></span>{t('intro_3')}</li>
          </ol>
          <div className="intro-actions">
            <button className="btn secondary" onClick={trySample} data-testid="try-sample"><IconDoc size={18} /> {t('try_sample')}</button>
            <button className="btn ghost" onClick={close} data-testid="intro-close">{t('got_it')}</button>
          </div>
          <p className="small muted">{t('sample_hint')}</p>
          {sampleErr && <div className="alert error" role="alert">{sampleErr}</div>}
        </section>
      )}

      <div className="capture-actions">
        <label className="btn primary big" data-testid="camera-btn">
          <input type="file" accept="image/*" capture="environment" onChange={pick} hidden />
          <span className="btn-ic" aria-hidden><IconCamera size={26} /></span>
          <span className="btn-txt"><span>{t('take_photo')}</span><small>{t('opens_camera')}</small></span>
        </label>
        <label className="btn secondary big" data-testid="upload-btn">
          <input type="file" accept="image/*" onChange={pick} hidden data-testid="file-input" />
          <span className="btn-ic" aria-hidden><IconImage size={26} /></span>
          <span className="btn-txt"><span>{t('choose_gallery')}</span><small>{t('screenshots_ok')}</small></span>
        </label>
      </div>

      <div className="row-field">
        <label htmlFor="doclang">{t('doc_language')}</label>
        <select id="doclang" value={settings.docLanguage} onChange={(e) => onSettings({ ...settings, docLanguage: e.target.value as Lang | 'auto' })} data-testid="doclang">
          <option value="auto">{t('detect_auto')}</option>
          {LANGS.map((l) => <option key={l} value={l}>{LANG_NAMES[l]}</option>)}
        </select>
      </div>

      {error && <div className="alert error" role="alert">{error}</div>}

      <div className="tips">
        <div className="tip-title">{t('works_best')}</div>
        <div className="chips">
          {(['chip_fines', 'chip_cancel', 'chip_visa', 'chip_medicine', 'chip_rental'] as const).map((k) => <span key={k}>{t(k)}</span>)}
        </div>
        <ul className="small muted">
          <li>{t('tip_photo')}</li>
          <li>{t('tip_private')}</li>
          <li>{t('tip_advice')}</li>
        </ul>
        <div className="privacy-line small"><IconShield size={18} /> {t('privacy_line')}</div>
      </div>
    </div>
  );
}
