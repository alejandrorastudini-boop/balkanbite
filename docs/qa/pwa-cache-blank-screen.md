# PWA blank-screen incident

Root cause: the service worker used cache-first behavior for `/` and `/index.html`. After a deployment, an old cached HTML shell could reference hashed JS assets that no longer exist on the current Vercel deployment, leaving the app white/blank. The fix makes navigations network-first, bumps the cache version so stale HTML is purged, and avoids caching HTML responses as static assets.
