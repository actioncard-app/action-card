// Web Share Target (installed PWA on Android/Chrome): another app shares an image or PDF to LetterScan.
// The service worker receives the POST, keeps the file in a private cache on this device, and opens the app,
// which picks it up and deletes it. Imported into the Workbox service worker (vite.config.ts importScripts).
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'POST' || !url.pathname.endsWith('/share-target')) return;
  event.respondWith((async () => {
    try {
      const form = await event.request.formData();
      const file = form.getAll('file').find((f) => f && typeof f === 'object' && 'size' in f);
      if (file) {
        const cache = await caches.open('share-target');
        await cache.put('shared-file', new Response(file, { headers: { 'content-type': file.type || 'application/octet-stream', 'x-name': encodeURIComponent(file.name || 'shared') } }));
      }
    } catch (e) { /* nothing shared: just open the app */ }
    return Response.redirect(url.pathname.replace(/share-target$/, '') + '?shared=1', 303);
  })());
});
