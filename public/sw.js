// BalkanBite service worker
// Navigations must never be cache-first: a stale HTML shell can reference hashed
// JS assets from an older deployment and leave the app on a blank screen.
const CACHE_NAME = 'balkanbite-cache-v2';
const STATIC_ASSETS = [
  '/manifest.json',
  '/favicon.svg'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      cache.addAll(STATIC_ASSETS).catch((err) => {
        console.warn('Pre-cache error:', err);
      })
    )
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  if (event.request.url.includes('/api/')) return;

  // Always resolve document navigations from the network first. This guarantees
  // that each deployment loads its matching hashed JS/CSS bundle.
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).catch(() => caches.match('/index.html'))
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      const networkFetch = fetch(event.request)
        .then((networkResponse) => {
          if (!networkResponse || networkResponse.status !== 200) return networkResponse;

          const contentType = networkResponse.headers.get('content-type') || '';
          // Do not cache HTML under asset URLs (possible with SPA fallbacks).
          if (!contentType.includes('text/html')) {
            const copy = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
          }
          return networkResponse;
        });

      // Static resources can use cached content while refreshing in background.
      if (cachedResponse) {
        networkFetch.catch(() => {});
        return cachedResponse;
      }

      return networkFetch;
    })
  );
});
