import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// Base path the app is served from. '/' for a root domain; e.g. BASE_PATH=/action-card/ for
// https://<user>.github.io/action-card/. Always normalised to start and end with '/'.
const rawBase = process.env.BASE_PATH ?? '/';
const base = ('/' + rawBase + '/').replace(/\/+/g, '/');

// Optional AI mode is web-only (VITE_AI_ENABLED=true for the Pages build). Without it, the page may not contact api.x.ai.
const aiEnabled = process.env.VITE_AI_ENABLED === 'true';

export default defineConfig({
  base,
  plugins: [
    react(),
    {
      name: 'csp-ai-mode',
      // the AI-mode module is replaced by an empty stub, so no xAI code or address ships in a build without AI mode
      enforce: 'pre' as const,
      load: (id: string) => !aiEnabled && /[\\/]src[\\/]lib[\\/]ai\.ts$/.test(id)
        ? "const off = () => { throw new Error('AI mode is not part of this build'); };\nexport const extractWithAi = off, redactFor = off, aiPayload = off;\n"
        : null,
      transformIndexHtml: (html: string) => aiEnabled ? html : html.replace(' https://api.x.ai', '').replace(' is api.x.ai (optional AI mode)', ' is none').replace('the only outside address the page may contact is none', 'the page may not contact any outside address'),
    },
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
        // only the app's own address falls back to the app; made-up paths reach the server's 404.html
        navigateFallbackAllowlist: [new RegExp(`^${base.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(index\\.html)?(\\?.*)?$`)],
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
