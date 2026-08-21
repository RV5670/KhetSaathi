/* ============================================================
   KISAN MITRA — sw.js
   Caches the app shell so the app opens instantly and still
   works (recommendation engine + reference prices) with no
   signal — only the live weather/market/sellers/scan calls
   need a connection.
   Bump CACHE_NAME whenever you change any cached file so
   returning users get the update instead of a stale cache.
   ============================================================ */

const CACHE_NAME = "khetsaathi-v6-ratnagiri-crop-rules";
const APP_SHELL = [
  "./",
  "./index.html",
  "./manifest.json",
  "./css/style.css",
  "./js/config.js",
  "./js/data.js",
  "./js/api.js",
  "./js/app.js",
  "./seller-listing.html",
  "./js/seller-listing.js",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  // Only handle same-origin GET requests with the cache; let every
  // external API call (weather/market/sellers/HF/fonts) go straight
  // to the network as normal.
  if (event.request.method !== "GET" || url.origin !== self.location.origin) return;

  event.respondWith(
    caches.match(event.request).then((cached) => {
      const network = fetch(event.request).then((res) => {
        if (res && res.status === 200) {
          const copy = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
        }
        return res;
      }).catch(() => cached);
      return cached || network;
    })
  );
});
