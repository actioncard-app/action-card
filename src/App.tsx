import { useEffect, useState } from 'react';
import type { ActionCard, Lang, SavedCard } from './lib/types';
import { addPage, keepEdits, pagesOf } from './lib/pages';
import { setIntroSeen } from './lib/sample';
import { loadSettings, saveSettings, type Settings } from './lib/settings';
import type { OcrProgress } from './lib/ocr';
// OCR code (tesseract.js client + image pipeline) is its own chunk, warmed right after first paint.
const loadOcr = () => import('./lib/ocr');
import { extractRules } from './lib/extract';
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
import { UiLang, makeT } from './lib/i18n';

type Tab = 'scan' | 'history' | 'settings';
export interface Current { card: ActionCard; thumbnail: string; photo?: Blob; morePhotos?: Blob[]; saved: boolean }

export default function App() {
  const [tab, setTab] = useState<Tab>('scan');
  const [settings, setSettings] = useState<Settings>(loadSettings);
  const [current, setCurrent] = useState<Current | null>(() => restoreCurrent());
  const [progress, setProgress] = useState<OcrProgress | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pageNo, setPageNo] = useState(1);
  const [online, setOnline] = useState(navigator.onLine);

  useEffect(() => {
    const up = () => setOnline(navigator.onLine);
    window.addEventListener('online', up);
    window.addEventListener('offline', up);
    return () => { window.removeEventListener('online', up); window.removeEventListener('offline', up); };
  }, []);

  useEffect(() => { const t = setTimeout(() => loadOcr().catch(() => {}), 300); return () => clearTimeout(t); }, []);

  // keep the card across reloads (app update, iOS discarding the tab); only for this tab
  useEffect(() => { rememberCurrent(current); }, [current]);
  // app updates reload only when no OCR is running
  useEffect(() => { setBusyCheck(() => progress !== null); if (progress === null) idleNow(); }, [progress]);

  const updateSettings = (s: Settings) => { setSettings(s); saveSettings(s); };
  const ul = settings.userLanguage;
  const t = makeT(ul);
  useEffect(() => { document.documentElement.lang = ul; }, [ul]);

  /** OCR one photo: thumbnail, downscaled photo for the card, and the text. */
  async function readPhoto(file: File, lang: Lang | 'auto') {
    const bmp = await loadBitmap(file);
    const thumb = drawScaled(bmp, 360).toDataURL('image/jpeg', 0.7);
    const photo = await canvasToBlob(drawScaled(bmp, 1600), 'image/jpeg', 0.82);
    const { runOcr } = await loadOcr();
    const ocr = await runOcr(file, lang, setProgress);
    return { thumb, photo, ocr };
  }

  /** Optional AI step + notes (low OCR quality, no text, AI fallbacks). */
  async function finish(card: ActionCard, ocrConfidence: number | null): Promise<ActionCard> {
    const lowOcr = ocrConfidence !== null && ocrConfidence < 60 ? t('note_low_ocr', { pct: Math.round(ocrConfidence) }) + ' ' : '';
    if (!card.ocrText.trim()) {
      card = { ...card, modeNote: t('note_no_text') };
    } else if (settings.aiEnabled) {
      if (!settings.xaiKey) card = { ...card, modeNote: t('note_ai_nokey') };
      else if (!navigator.onLine) card = { ...card, modeNote: t('note_ai_offline') };
      else {
        setProgress({ stage: 'Asking AI (xAI)', progress: 0.5 });
        try {
          // AI code is only loaded when AI mode is actually used
          const { extractWithAi } = await import('./lib/ai');
          card = await extractWithAi(card, settings.xaiKey, settings.xaiModel);
        } catch (e) {
          card = { ...card, modeNote: t('note_ai_failed', { msg: (e as Error).message }) };
        }
      }
    }
    if (lowOcr) card = { ...card, modeNote: lowOcr + (card.modeNote ?? '') };
    return card;
  }

  async function run(file: File, page: number, work: (url: string) => Promise<void>) {
    setError(null);
    const url = URL.createObjectURL(file);
    setPreview(url);
    setPageNo(page);
    setProgress({ stage: 'Preparing image', progress: 0 });
    try {
      await work(url);
    } catch (e) {
      console.error(e);
      setError(t('err_process', { msg: (e as Error).message }));
    } finally {
      setProgress(null);
      setPreview(null);
      URL.revokeObjectURL(url);
    }
  }

  function handleFile(file: File) {
    setCurrent(null);
    return run(file, 1, async () => {
      const { thumb, photo, ocr } = await readPhoto(file, settings.docLanguage);
      const card = extractRules(ocr.text, {
        userLanguage: settings.userLanguage,
        docLanguage: settings.docLanguage === 'auto' ? null : settings.docLanguage,
        ocrConfidence: ocr.confidence,
      });
      card.pages = [{ text: ocr.text, confidence: ocr.confidence }];
      setCurrent({ card: await finish(card, ocr.confidence), thumbnail: thumb, photo, saved: false });
    });
  }

  /** Add another page to the open card: OCR it (in the document's language), re-extract from all pages, keep edits. */
  function handleAddPage(file: File) {
    const c = current;
    if (!c) return;
    const n = pagesOf(c.card).length + 1;
    return run(file, n, async () => {
      const docLang = c.card.docLanguage.value;
      const { photo, ocr } = await readPhoto(file, docLang ?? settings.docLanguage);
      const pinned = c.card.docLanguage.edited ? docLang : settings.docLanguage === 'auto' ? null : settings.docLanguage;
      let card = addPage(c.card, { text: ocr.text, confidence: ocr.confidence }, pinned);
      card = keepEdits(c.card, await finish(card, card.ocrConfidence));
      setCurrent({ ...c, card, morePhotos: [...(c.morePhotos ?? []), photo], saved: false });
    });
  }

  // ticking a step on a saved card updates the saved copy right away (ticks belong to that card)
  const toRecord = (c: Current): SavedCard => ({ id: c.card.id, createdAt: c.card.createdAt, card: c.card, thumbnail: c.thumbnail, photo: c.photo, morePhotos: c.morePhotos });
  async function save(c: Current) {
    await saveCard(toRecord(c));
    setCurrent({ ...c, saved: true });
    requestPersistentStorage(); // ask the browser not to evict saved cards (best effort)
  }

  const [cameFrom, setCameFrom] = useState<Tab>('scan');
  const openSaved = (s: SavedCard) => { setCurrent({ card: s.card, thumbnail: s.thumbnail, photo: s.photo, morePhotos: s.morePhotos, saved: true }); setCameFrom('history'); setTab('scan'); };
  const cardOpen = tab === 'scan' && !!current && !progress;
  const closeCard = () => { setCurrent(null); setTab(cameFrom); setCameFrom('scan'); };

  return (
    <UiLang.Provider value={ul}>
    <div className={`app ${cardOpen ? 'card-open' : ''}`}>
      <header className="topbar">
        {cardOpen && <button className="back-btn" onClick={closeCard} data-testid="back-btn"><IconBack /> {cameFrom === 'history' ? t('tab_saved') : t('back_home')}</button>}
        <div className="brand"><img src={`${import.meta.env.BASE_URL}pwa-192x192.png`} alt="" width={30} height={30} /> Action Card</div>
        <span className={`net ${online ? 'on sr-only' : 'off'}`} data-testid="net-status"><i className="net-dot" aria-hidden />{online ? t('online') : t('offline')}</span>
      </header>
      <main className="content">
        {tab === 'scan' && (progress ? (
          <ProcessingView progress={progress} preview={preview} page={pageNo} />
        ) : current ? (
          <CardView
            current={current}
            onChange={(card) => setCurrent({ ...current, card, saved: false })}
            onSteps={(card) => { const c = { ...current, card }; setCurrent(c); if (c.saved) saveCard(toRecord(c)).catch(() => {}); }}
            onSave={() => save(current)}
            onNew={() => { setCurrent(null); setCameFrom('scan'); setError(null); }}
            onAddPage={handleAddPage}
            error={error}
          />
        ) : (
          <CaptureScreen settings={settings} onSettings={updateSettings} onFile={handleFile} error={error} />
        ))}
        {tab === 'history' && <HistoryScreen onOpen={openSaved} userLanguage={settings.userLanguage} />}
        {tab === 'settings' && <SettingsScreen settings={settings} onChange={updateSettings} onShowIntro={() => { setIntroSeen(false); setCurrent(null); setTab('scan'); }} />}
      </main>
      <nav className="tabs" aria-label={t('nav_main')}>
        <button className={tab === 'scan' ? 'active' : ''} aria-current={tab === 'scan' ? 'page' : undefined} onClick={() => setTab('scan')} data-testid="tab-scan"><span className="tab-ic"><IconCamera /></span>{t('tab_scan')}</button>
        <button className={tab === 'history' ? 'active' : ''} aria-current={tab === 'history' ? 'page' : undefined} onClick={() => setTab('history')} data-testid="tab-history"><span className="tab-ic"><IconStack /></span>{t('tab_saved')}</button>
        <button className={tab === 'settings' ? 'active' : ''} aria-current={tab === 'settings' ? 'page' : undefined} onClick={() => setTab('settings')} data-testid="tab-settings"><span className="tab-ic"><IconGear /></span>{t('tab_settings')}</button>
      </nav>
    </div>
    </UiLang.Provider>
  );
}
