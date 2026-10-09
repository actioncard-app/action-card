import { useEffect, useState } from 'react';
import type { ActionCard, SavedCard } from './lib/types';
import { loadSettings, saveSettings, type Settings } from './lib/settings';
import { runOcr, type OcrProgress } from './lib/ocr';
import { extractRules } from './lib/extract';
import { extractWithAi } from './lib/ai';
import { loadBitmap, drawScaled, canvasToBlob } from './lib/image';
import { saveCard } from './lib/db';
import CaptureScreen from './components/CaptureScreen';
import CardView from './components/CardView';
import HistoryScreen from './components/HistoryScreen';
import SettingsScreen from './components/SettingsScreen';
import { rememberCurrent, restoreCurrent, requestPersistentStorage } from './lib/session';
import { setBusyCheck, idleNow } from './lib/update';
import ProcessingView from './components/ProcessingView';
import { IconCamera, IconStack, IconGear, IconBack } from './components/Icons';

type Tab = 'scan' | 'history' | 'settings';
export interface Current { card: ActionCard; thumbnail: string; photo?: Blob; saved: boolean }

export default function App() {
  const [tab, setTab] = useState<Tab>('scan');
  const [settings, setSettings] = useState<Settings>(loadSettings);
  const [current, setCurrent] = useState<Current | null>(() => restoreCurrent());
  const [progress, setProgress] = useState<OcrProgress | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [online, setOnline] = useState(navigator.onLine);

  useEffect(() => {
    const up = () => setOnline(navigator.onLine);
    window.addEventListener('online', up);
    window.addEventListener('offline', up);
    return () => { window.removeEventListener('online', up); window.removeEventListener('offline', up); };
  }, []);

  // keep the card across reloads (app update, iOS discarding the tab); only for this tab
  useEffect(() => { rememberCurrent(current); }, [current]);
  // app updates reload only when no OCR is running
  useEffect(() => { setBusyCheck(() => progress !== null); if (progress === null) idleNow(); }, [progress]);

  const updateSettings = (s: Settings) => { setSettings(s); saveSettings(s); };

  async function handleFile(file: File) {
    setError(null);
    setCurrent(null);
    const url = URL.createObjectURL(file);
    setPreview(url);
    setProgress({ stage: 'Preparing image', progress: 0 });
    try {
      const bmp = await loadBitmap(file);
      const thumb = drawScaled(bmp, 360).toDataURL('image/jpeg', 0.7);
      const photo = await canvasToBlob(drawScaled(bmp, 1600), 'image/jpeg', 0.82);
      const ocr = await runOcr(file, settings.docLanguage, setProgress);
      let card = extractRules(ocr.text, {
        userLanguage: settings.userLanguage,
        docLanguage: settings.docLanguage === 'auto' ? null : settings.docLanguage,
        ocrConfidence: ocr.confidence,
      });
      const lowOcr = ocr.confidence < 60 ? `The photo was hard to read (OCR confidence ${Math.round(ocr.confidence)}%), so results are likely incomplete or wrong. Retake it closer, flat and in good light. ` : '';
      if (!card.ocrText.trim()) {
        card.modeNote = 'No text could be read. Try a sharper, well-lit photo, held flat.';
      } else if (settings.aiEnabled) {
        if (!settings.xaiKey) card.modeNote = 'AI mode is on but no API key is set; used offline rules.';
        else if (!navigator.onLine) card.modeNote = 'Offline; used offline rules instead of AI mode.';
        else {
          setProgress({ stage: 'Asking AI (xAI)', progress: 0.5 });
          try {
            card = await extractWithAi(card, settings.xaiKey, settings.xaiModel);
          } catch (e) {
            card = { ...card, modeNote: `AI mode failed (${(e as Error).message}); used offline rules.` };
          }
        }
      }
      if (lowOcr) card = { ...card, modeNote: lowOcr + (card.modeNote ?? '') };
      setCurrent({ card, thumbnail: thumb, photo, saved: false });
    } catch (e) {
      console.error(e);
      setError(`Could not process this image: ${(e as Error).message}`);
    } finally {
      setProgress(null);
      setPreview(null);
      URL.revokeObjectURL(url);
    }
  }

  async function save(c: Current) {
    const rec: SavedCard = { id: c.card.id, createdAt: c.card.createdAt, card: c.card, thumbnail: c.thumbnail, photo: c.photo };
    await saveCard(rec);
    setCurrent({ ...c, saved: true });
    requestPersistentStorage(); // ask the browser not to evict saved cards (best effort)
  }

  const [cameFrom, setCameFrom] = useState<Tab>('scan');
  const openSaved = (s: SavedCard) => { setCurrent({ card: s.card, thumbnail: s.thumbnail, photo: s.photo, saved: true }); setCameFrom('history'); setTab('scan'); };
  const cardOpen = tab === 'scan' && !!current && !progress;
  const closeCard = () => { setCurrent(null); setTab(cameFrom); setCameFrom('scan'); };

  return (
    <div className={`app ${cardOpen ? 'card-open' : ''}`}>
      <header className="topbar">
        {cardOpen && <button className="back-btn" onClick={closeCard} data-testid="back-btn"><IconBack /> {cameFrom === 'history' ? 'Saved' : 'Home'}</button>}
        <div className="brand"><img src={`${import.meta.env.BASE_URL}pwa-192x192.png`} alt="" width={30} height={30} /> Action Card</div>
        <span className={`net ${online ? 'on sr-only' : 'off'}`} data-testid="net-status"><i className="net-dot" aria-hidden />{online ? 'Online' : 'Offline'}</span>
      </header>
      <main className="content">
        {tab === 'scan' && (progress ? (
          <ProcessingView progress={progress} preview={preview} />
        ) : current ? (
          <CardView
            current={current}
            onChange={(card) => setCurrent({ ...current, card, saved: false })}
            onSave={() => save(current)}
            onNew={() => { setCurrent(null); setCameFrom('scan'); }}
          />
        ) : (
          <CaptureScreen settings={settings} onSettings={updateSettings} onFile={handleFile} error={error} />
        ))}
        {tab === 'history' && <HistoryScreen onOpen={openSaved} userLanguage={settings.userLanguage} />}
        {tab === 'settings' && <SettingsScreen settings={settings} onChange={updateSettings} />}
      </main>
      <nav className="tabs" aria-label="Main">
        <button className={tab === 'scan' ? 'active' : ''} aria-current={tab === 'scan' ? 'page' : undefined} onClick={() => setTab('scan')} data-testid="tab-scan"><span className="tab-ic"><IconCamera /></span>Scan</button>
        <button className={tab === 'history' ? 'active' : ''} aria-current={tab === 'history' ? 'page' : undefined} onClick={() => setTab('history')} data-testid="tab-history"><span className="tab-ic"><IconStack /></span>Saved</button>
        <button className={tab === 'settings' ? 'active' : ''} aria-current={tab === 'settings' ? 'page' : undefined} onClick={() => setTab('settings')} data-testid="tab-settings"><span className="tab-ic"><IconGear /></span>Settings</button>
      </nav>
    </div>
  );
}
