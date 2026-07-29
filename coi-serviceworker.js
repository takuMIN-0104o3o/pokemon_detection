// coi-serviceworker.js
// -----------------------------------------------------------------------
// GitHub Pages (and most static hosts) can't send custom response
// headers, so Cross-Origin-Isolation -- which multi-threaded WASM
// (SharedArrayBuffer) needs -- can't be turned on server-side the way
// server_coi.py does for local testing.
//
// This service worker intercepts every same-origin request after it's
// installed and adds the Cross-Origin-Opener-Policy / Cross-Origin-
// Embedder-Policy response headers on the client side instead, which has
// the same effect: the page becomes cross-origin-isolated and
// self.crossOriginIsolated becomes true.
//
// This only ever *adds* a speed path (extra WASM threads as a fallback
// for browsers/devices without WebGPU) -- it changes no model weights,
// no preprocessing, no math, so it can't affect accuracy. If registration
// fails for any reason, index.html simply keeps running the way it did
// before (single-threaded WASM / WebGPU if available).
// -----------------------------------------------------------------------

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

self.addEventListener('fetch', (event) => {
  const req = event.request;
  // Only same-origin GET requests can have their headers rewritten here;
  // no-cors cross-origin requests (Hugging Face model files, jsdelivr
  // scripts) come back as "opaque" responses whose headers JS can't read
  // or modify, so those are just passed through untouched.
  if (req.method !== 'GET') {
    event.respondWith(fetch(req));
    return;
  }
  event.respondWith(
    fetch(req).then((response) => {
      if (response.status === 0 || response.type === 'opaque') return response;
      const newHeaders = new Headers(response.headers);
      newHeaders.set('Cross-Origin-Opener-Policy', 'same-origin');
      // 'credentialless' (not 'require-corp') so cross-origin fetches to
      // Hugging Face / jsdelivr aren't blocked even if those servers don't
      // send a Cross-Origin-Resource-Policy header of their own.
      newHeaders.set('Cross-Origin-Embedder-Policy', 'credentialless');
      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers: newHeaders,
      });
    })
  );
});
