/**
 * sw.js — Service Worker para uso offline (cache-first dos assets estáticos).
 * Ver PLANEJAMENTO.md fase 5.
 */
const CACHE = 'leitordf-v2';
const ASSETS = [
  './',
  './index.html',
  './style.css',
  './app.js',
  './scanner.js',
  './chave.js',
  './manifest.json',
  './icon.svg',
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((nomes) =>
      Promise.all(nomes.filter((n) => n !== CACHE).map((n) => caches.delete(n)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  event.respondWith(
    caches.match(event.request).then((cached) => cached || fetch(event.request))
  );
});
