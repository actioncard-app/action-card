import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// Base path the app is served from. '/' for a root domain; e.g. BASE_PATH=/action-card/ for
// https://<user>.github.io/action-card/. Always normalised to start and end with '/'.
const rawBase = process.env.BASE_PATH ?? '/';
const base = ('/' + rawBase + '/').replace(/\/+/g, '/');

export default defineConfig({
  base,
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: false, // registered manually in src/main.tsx
      manifest: {
        name: 'LetterScan',
        short_name: 'LetterScan',
        description: 'Point your phone at a document in a language you cannot fully read and get the deadline, money at stake and the one next action. Works offline. Photos and cards stay on your phone.',
        theme_color: '#0f4c5c',
        background_color: '#f6f5f1',
        display: 'standalone',
        orientation: 'portrait',
        start_url: base,
        scope: base,
        id: base,
        lang: 'en',
        // Android/Chrome: LetterScan appears in the share sheet for images and PDFs (handled in public/share-target-sw.js)
        share_target: { action: `${base}share-target`, method: 'POST', enctype: 'multipart/form-data', params: { files: [{ name: 'file', accept: ['image/*', 'application/pdf', '.pdf'] }] } },
        icons: [
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          { src: 'maskable-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // Precache the app shell, the SIMD OCR core and the 6 rule-language traineddata files so OCR works offline.
        // The 12 extra reading languages (2-3 MB each) are cached on first use by the runtime rule below.
        globPatterns: ['**/*.{js,mjs,css,html,ico,png,svg,webmanifest}', 'tesseract/lang/{eng,deu,fra,spa,ita,por}.traineddata.gz', 'tesseract/worker.min.js', 'tesseract/core/tesseract-core-simd-lstm.wasm.js'],
        globIgnores: ['tesseract/core/tesseract-core-lstm.wasm.js'],
        maximumFileSizeToCacheInBytes: 12 * 1024 * 1024,
        importScripts: ['share-target-sw.js'],
        clientsClaim: true,
        skipWaiting: true,
        navigateFallback: `${base}index.html`,
        runtimeCaching: [
          {
            // Non-SIMD fallback core for old devices: cached on first use.
            // RegExp, not a closure: Workbox serialises this into sw.js, where `base` would not exist.
            urlPattern: new RegExp(`${base.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}tesseract/`),
            handler: 'CacheFirst',
            options: { cacheName: 'ocr-fallback', expiration: { maxEntries: 20 } },
          },
        ],
      },
    }),
  ],
  build: { chunkSizeWarningLimit: 1200 },
  preview: { host: '0.0.0.0', port: 4173, strictPort: true },
});
