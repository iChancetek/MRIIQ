/**
 * sw.js — Service Worker for MRIIQ Progressive Web App (PWA).
 * Network-first for dynamic API routes, cache-first for static icons/assets.
 */

const CACHE_NAME = "mriiq-pwa-v1";
const STATIC_ASSETS = [
  "/",
  "/manifest.json",
  "/favicon.ico",
  "/icons/icon-192x192.png",
  "/icons/icon-512x512.png",
  "/icons/apple-touch-icon.png",
  "/icons/og-image.png",
];

// Install event — cache core shell
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    }).then(() => self.skipWaiting())
  );
});

// Activate event — clean up old caches
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch event — network-first for /api, cache-first for static assets
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  // Dynamic API calls: Network-only with graceful offline fallback
  if (url.pathname.startsWith("/api/")) {
    event.respondWith(
      fetch(event.request).catch(() => {
        return new Response(
          JSON.stringify({ error: "Offline mode: network connection required for live clinical authorization." }),
          { status: 503, headers: { "Content-Type": "application/json" } }
        );
      })
    );
    return;
  }

  // Static assets: Stale-while-revalidate
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      const fetchPromise = fetch(event.request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200 && networkResponse.type === "basic") {
            const responseToCache = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, responseToCache);
            });
          }
          return networkResponse;
        })
        .catch(() => cachedResponse);

      return cachedResponse || fetchPromise;
    })
  );
});
