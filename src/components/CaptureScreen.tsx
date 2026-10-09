import type { Settings } from '../lib/settings';
import { LANGS, LANG_NAMES, type Lang } from '../lib/types';
import { IconCamera, IconImage, IconShield } from './Icons';

interface Props { settings: Settings; onSettings: (s: Settings) => void; onFile: (f: File) => void; error: string | null }

export default function CaptureScreen({ settings, onSettings, onFile, error }: Props) {
  const pick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (f) onFile(f);
  };
  return (
    <div className="capture screen">
      <p className="eyebrow">Foreign-language paperwork, decoded</p>
      <h1>What does this paper want from me?</h1>
      <p className="lead">Photograph a document in a language you can't fully read. You get the deadline, the money at stake and the one next step, with the exact source text for each.</p>

      <div className="capture-actions">
        <label className="btn primary big" data-testid="camera-btn">
          <input type="file" accept="image/*" capture="environment" onChange={pick} hidden />
          <span className="btn-ic" aria-hidden><IconCamera size={26} /></span>
          <span className="btn-txt"><span>Take a photo</span><small>Opens the camera</small></span>
        </label>
        <label className="btn secondary big" data-testid="upload-btn">
          <input type="file" accept="image/*" onChange={pick} hidden data-testid="file-input" />
          <span className="btn-ic" aria-hidden><IconImage size={26} /></span>
          <span className="btn-txt"><span>Choose from gallery</span><small>Screenshots work too</small></span>
        </label>
      </div>

      <div className="row-field">
        <label htmlFor="doclang">Document language</label>
        <select id="doclang" value={settings.docLanguage} onChange={(e) => onSettings({ ...settings, docLanguage: e.target.value as Lang | 'auto' })} data-testid="doclang">
          <option value="auto">Detect automatically</option>
          {LANGS.map((l) => <option key={l} value={l}>{LANG_NAMES[l]}</option>)}
        </select>
      </div>

      {error && <div className="alert error" role="alert">{error}</div>}

      <div className="tips">
        <div className="tip-title">Works best with</div>
        <div className="chips">
          <span>Parking & traffic fines</span><span>Hotel & airline cancellations</span><span>Visa & entry letters</span><span>Medicine labels</span><span>Rental move-in sheets</span>
        </div>
        <ul className="small muted">
          <li>Hold the phone flat over the page, in good light, page filling the screen.</li>
          <li>Photos and cards stay on this phone. No account. Works offline.</li>
          <li>Not a translator, and not legal or medical advice. Always check the original.</li>
        </ul>
        <div className="privacy-line small"><IconShield size={18} /> On-device text recognition · nothing uploaded</div>
      </div>
    </div>
  );
}
