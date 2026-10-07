import { useState } from 'react';
import { DEFAULT_MODEL, type Settings } from '../lib/settings';
import { LANGS, LANG_NAMES, type Lang } from '../lib/types';
import { clearAll } from '../lib/db';

export default function SettingsScreen({ settings, onChange }: { settings: Settings; onChange: (s: Settings) => void }) {
  const [key, setKey] = useState(settings.xaiKey);
  const [model, setModel] = useState(settings.xaiModel);
  const [msg, setMsg] = useState<string | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);
  return (
    <div className="settings" data-testid="settings">
      <h2>Settings</h2>

      <section className="panel">
        <label htmlFor="ulang" className="panel-title">Your language</label>
        <p className="small muted">Next actions and the second copy of each reply are written in this language.</p>
        <select id="ulang" value={settings.userLanguage} onChange={(e) => onChange({ ...settings, userLanguage: e.target.value as Lang })} data-testid="user-lang">
          {LANGS.map((l) => <option key={l} value={l}>{LANG_NAMES[l]}</option>)}
        </select>
        <label htmlFor="dlang" className="panel-title" style={{ marginTop: 14 }}>Document language</label>
        <select id="dlang" value={settings.docLanguage} onChange={(e) => onChange({ ...settings, docLanguage: e.target.value as Lang | 'auto' })}>
          <option value="auto">Detect automatically</option>
          {LANGS.map((l) => <option key={l} value={l}>{LANG_NAMES[l]}</option>)}
        </select>
        <p className="small muted">Auto-detect reads the page twice (quick English pass, then the detected language), so picking the language is faster.</p>
      </section>

      <section className="panel">
        <div className="panel-title">AI mode (optional)</div>
        <p className="small">Off by default. The app always works offline with built-in rules. If you turn this on and add your own xAI (Grok) API key, the <strong>text</strong> read from the photo (never the photo itself) is sent <strong>directly from this phone to xAI</strong> to fill in the card. Results are still checked: every value must quote text that really is in the document, and anything invalid falls back to the offline rules.</p>
        <p className="small warn-text">Your key is stored only in this browser's local storage on this phone. It is not in the app's code and is not sent anywhere except api.x.ai. That is fine for a personal prototype, but a real public launch needs a server proxy so keys never live on phones.</p>
        <label className="switch">
          <input type="checkbox" checked={settings.aiEnabled} onChange={(e) => onChange({ ...settings, aiEnabled: e.target.checked })} data-testid="ai-toggle" />
          <span>Use AI mode when online</span>
        </label>
        <label htmlFor="xkey" className="small">xAI API key</label>
        <input id="xkey" type="password" autoComplete="off" spellCheck={false} placeholder="xai-…" value={key} onChange={(e) => setKey(e.target.value)} data-testid="ai-key" />
        <label htmlFor="xmodel" className="small">Model</label>
        <input id="xmodel" type="text" spellCheck={false} value={model} onChange={(e) => setModel(e.target.value)} />
        <div className="row-btns">
          <button className="btn small primary" onClick={() => { onChange({ ...settings, xaiKey: key.trim(), xaiModel: model.trim() || DEFAULT_MODEL }); setMsg('Saved on this phone.'); }} data-testid="ai-save">Save key</button>
          <button className="btn small ghost" onClick={() => { setKey(''); onChange({ ...settings, xaiKey: '', aiEnabled: false }); setMsg('Key removed.'); }}>Remove key</button>
        </div>
        {msg && <p className="small muted">{msg}</p>}
      </section>

      <section className="panel">
        <div className="panel-title">Privacy</div>
        <ul className="small">
          <li>No account, no analytics, no trackers.</li>
          <li>Text recognition (Tesseract OCR) runs on this phone. Language data for English, German, French, Spanish, Italian and Portuguese is stored with the app so it works offline.</li>
          <li>Photos and saved cards stay in this browser's storage on this phone.</li>
        </ul>
        {confirmClear ? (
          <div className="row-btns">
            <button className="btn small danger" onClick={async () => { await clearAll(); setConfirmClear(false); setMsg('All saved cards deleted.'); }}>Yes, delete all cards</button>
            <button className="btn small ghost" onClick={() => setConfirmClear(false)}>Cancel</button>
          </div>
        ) : (
          <button className="btn small ghost" onClick={() => setConfirmClear(true)}>Delete all saved cards…</button>
        )}
      </section>

      <section className="panel">
        <div className="panel-title">About</div>
        <p className="small">Action Card (working name) · prototype v0.1. Not a translator, not legal or medical advice: it can be wrong, so always check the original document.</p>
        <p className="small muted">Install: iPhone Safari → Share → Add to Home Screen. Android Chrome → menu → Install app.</p>
        <p className="small muted">Technical note: Google ML Kit text recognition is only available to native Android/iOS apps, so this web app uses Tesseract.js (WebAssembly) instead.</p>
      </section>
    </div>
  );
}
