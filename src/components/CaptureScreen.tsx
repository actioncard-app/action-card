import type { Settings } from '../lib/settings';
import { LANGS, LANG_NAMES, EXTRA_LANGS, UI_LANG_NAMES, type ReadLang } from '../lib/types';
import { useEffect, useRef, useState } from 'react';
import { IconCamera, IconImage, IconShield, IconDoc, IconSpark, IconCheck } from './Icons';
import { introSeen, makeSampleFile, setIntroSeen } from '../lib/sample';
import { useT } from '../lib/i18n';
import { isNative, nativePhoto } from '../lib/native';
import { coreLimited, FREE_SCANS_PER_MONTH, scansLeft } from '../lib/limits';
import { usePro } from './ProPanel';

interface Props { settings: Settings; onSettings: (s: Settings) => void; onFile: (f: File, sample?: boolean) => void; error: string | null; onLimit?: () => void }

export default function CaptureScreen({ settings, onSettings, onFile, error, onLimit }: Props) {
  const t = useT();
  const { owned } = usePro();
  const limited = coreLimited(owned);
  const left = limited ? scansLeft() : null;
  // no free scans left: explain + paywall before the camera or picker opens (nothing is lost)
  // a double tap must open the picker once: taps within 1.2 s of the last one are ignored (the input's own
  // click, which bubbles up to the label, is let through)
  const lastOpen = useRef(0);
  // an error (unreadable file, picture that won't open) is shown right under the buttons and scrolled into view
  const errRef = useRef<HTMLDivElement>(null);
  useEffect(() => { if (error) errRef.current?.scrollIntoView({ block: 'center', behavior: 'smooth' }); }, [error]);
  const blocked = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).tagName === 'INPUT') return false;
    if (left === 0) { e.preventDefault(); onLimit?.(); return true; }
    const now = Date.now();
    if (now - lastOpen.current < 1200) { e.preventDefault(); return true; }
    lastOpen.current = now;
    return false;
  };
  const [intro, setIntro] = useState(() => !introSeen());
  const [sampleErr, setSampleErr] = useState<string | null>(null);
  const close = () => { setIntroSeen(true); setIntro(false); };
  const trySample = async () => {
    setSampleErr(null);
    try { const f = await makeSampleFile(); close(); onFile(f, true); } catch (e) { setSampleErr(t('sample_err', { msg: (e as Error).message })); }
  };
  // iOS app: native camera / photo library instead of the web file picker
  const native = (e: React.MouseEvent, from: 'camera') => {
    if (blocked(e)) return;
    if (!isNative()) return;
    e.preventDefault();
    nativePhoto(from).then((f) => { if (f) onFile(f); }).catch((err) => setSampleErr(String((err as Error).message ?? err)));
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
        <label className="btn primary big" data-testid="camera-btn" onClick={(e) => native(e, 'camera')}>
          <input type="file" accept="image/*" capture="environment" onChange={pick} hidden />
          <span className="btn-ic" aria-hidden><IconCamera size={26} /></span>
          <span className="btn-txt"><span>{t('take_photo')}</span><small>{t('opens_camera')}</small></span>
        </label>
        {/* One picker for photos, screenshots and PDFs. On iOS the system sheet offers Photo Library, Take Photo and
            Choose File (Files/iCloud), with no photo-library permission needed. iOS hands over library photos as JPEG
            (HEIC is not listed in accept); HEIC from Files is decoded by WebKit and converted in normalizeImage. */}
        <label className="btn secondary big" data-testid="upload-btn" onClick={(e) => { blocked(e); }}>
          <input type="file" accept="image/*,application/pdf,.pdf" onChange={pick} hidden data-testid="file-input" />
          <span className="btn-ic" aria-hidden><IconImage size={26} /></span>
          <span className="btn-txt"><span>{t('choose_gallery')}</span><small>{t('screenshots_ok')}</small></span>
        </label>
      </div>

      {error && <div ref={errRef} className="alert error" role="alert" data-testid="scan-error">{error}</div>}
      {left !== null && <p className={`small scans-left ${left === 0 ? 'none' : ''}`} role="status" data-testid="scans-left" data-left={left}>{t('core_scans_left', { n: left, m: FREE_SCANS_PER_MONTH })}{left === 0 && <> <button className="linklike small" onClick={() => onLimit?.()} data-testid="scans-left-pro">{t('core_pro_only')}</button></>}</p>}
      {sampleErr && !intro && <div className="alert error" role="alert" data-testid="pick-error">{sampleErr}</div>}

      <div className="row-field">
        <label htmlFor="doclang">{t('doc_language')}</label>
        <select id="doclang" value={settings.docLanguage} onChange={(e) => onSettings({ ...settings, docLanguage: e.target.value as ReadLang | 'auto' })} data-testid="doclang">
          <option value="auto">{t('detect_auto')}</option>
          <optgroup label={t('lang_group_full')}>{LANGS.map((l) => <option key={l} value={l}>{LANG_NAMES[l]}</option>)}</optgroup>
          <optgroup label={t('lang_group_read')}>{EXTRA_LANGS.map((l) => <option key={l} value={l} lang={l}>{UI_LANG_NAMES[l]}</option>)}</optgroup>
        </select>
      </div>

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
