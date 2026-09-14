// BalkanBite service worker
// Navigations must never be cache-first: a stale HTML shell can reference hashed
// JS assets from an older deployment and leave the app on a blank screen.
const CACHE_NAME = 'balkanbite-cache-v3';
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
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)));
    await self.clients.claim();

    // Existing tabs may currently be displaying a blank page from the previous
    // cache-first worker. Reload each open BalkanBite window once when this new
    // worker takes control so recovery does not require clearing browser data.
    const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    await Promise.all(
      windows.map((client) => {
        if (typeof client.navigate === 'function') {
          return client.navigate(client.url).catch(() => undefined);
        }
        return undefined;
      })
    );
  })());
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  if (event.request.url.includes('/api/')) return;

  // Always resolve document navigations from the network first. Cache the latest
  // successful HTML only as an offline fallback, never as the primary response.
  if (event.request.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        const networkResponse = await fetch(event.request);
        if (networkResponse && networkResponse.status === 200) {
          const copy = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put('/index.html', copy));
        }
        return networkResponse;
      } catch {
        return caches.match('/index.html');
      }
    })());
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
