// BalkanBite service-worker retirement shim.
// The previous cache-first PWA worker could keep an old HTML shell alive across
// deployments. This worker performs one deterministic cleanup, reloads open
// clients from the network, and unregisters itself. BalkanBite can reintroduce
// offline caching later with a versioned/atomic strategy once it has dedicated QA.
self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    try {
      const keys = await caches.keys();
      await Promise.all(keys.map((key) => caches.delete(key)));
    } catch (_) {}

    await self.clients.claim();

    try {
      await self.registration.unregister();
    } catch (_) {}

    const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    await Promise.all(windows.map((client) => {
      if (typeof client.navigate !== 'function') return undefined;
      try {
        const url = new URL(client.url);
        url.searchParams.set('bb_sw_cleanup', Date.now().toString());
        return client.navigate(url.toString()).catch(() => undefined);
      } catch (_) {
        return client.navigate(client.url).catch(() => undefined);
      }
    }));
  })());
});
