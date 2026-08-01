'use strict';

const APP_VERSION = '1.0.0';
const CACHE_NAME = `crc-immune-frontier-${APP_VERSION}`;
const APP_SHELL = [
  './',
  './index.html',
  './404.html',
  './styles.css',
  './js/content-loader.js',
  './js/sim-engine.js',
  './js/sim-worker.js',
  './js/storage.js',
  './js/app.js',
  './data/content-manifest.json',
  './data/pathways.json',
  './data/evidence.json',
  './data/cases/case-b2m-escape.json',
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png',
  './pages/methods.html',
  './pages/references.html',
  './pages/privacy.html',
  './pages/accessibility.html'
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key.startsWith('crc-immune-frontier-') && key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) caches.open(CACHE_NAME).then((cache) => cache.put(request, response.clone()));
          return response;
        })
        .catch(async () => (await caches.match(request)) || (await caches.match('./index.html')) || (await caches.match('./404.html')))
    );
    return;
  }

  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request).then((response) => {
        if (response.ok && ['script', 'style', 'image', 'worker', 'manifest'].includes(request.destination)) {
          caches.open(CACHE_NAME).then((cache) => cache.put(request, response.clone()));
        }
        return response;
      });
    })
  );
});
