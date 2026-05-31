/**
 * Service Worker — 7 Wonders Duel PWA
 * Strategy: Cache-first for local assets, network-only for CDN
 */
const CACHE = '7wd-v4';

const LOCAL_ASSETS = [
  './',
  './index.html',
  './style.css',
  './game.js',
  './data.js',
  './manifest.json',
  './icons/icon.svg',
  './icons/icon-192.png',
  './icons/icon-512.png',
];

// Install: pre-cache all local assets
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c =>
      Promise.allSettled(LOCAL_ASSETS.map(url => c.add(url)))
    )
  );
  self.skipWaiting();
});

// Activate: delete old caches
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Fetch: cache-first for same-origin, pass-through for CDN
self.addEventListener('fetch', e => {
  const req = e.request;
  // Only handle GET
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  // CDN requests (Google Fonts, PeerJS) — always network
  if (url.origin !== self.location.origin) return;

  e.respondWith(
    caches.match(req).then(cached => {
      if (cached) return cached;
      return fetch(req).then(res => {
        if (res.ok) {
          const clone = res.clone();
          caches.open(CACHE).then(c => c.put(req, clone));
        }
        return res;
      });
    })
  );
});
