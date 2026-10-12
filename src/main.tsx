import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import { onNeedReload } from './lib/update';
import { isNative } from './lib/native';
import App from './App';
import './styles.css';

// Service worker: precaches the app + OCR engine + language data so it works offline.
// New versions activate in the background; the reload waits until no OCR is running (src/lib/update.ts).
// In the iOS app (Capacitor) the files ship inside the app, so no service worker is needed (and WKWebView does not
// support one on the app:// scheme).
if (!isNative()) registerSW({ immediate: true, onNeedReload });

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
