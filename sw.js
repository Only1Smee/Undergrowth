// UNDERGROWTH service worker: network first, cache fallback for offline play
const CACHE = 'undergrowth-v5';
const FILES = ['./', 'index.html', 'manifest.json', 'icons.js', 'engine.js', 'world.js', 'lowpoly.js', 'gen.js', 'chars.js', 'data.js', 'audio.js', 'ai.js', 'game.js', 'controls.js', 'ui.js',
  'ug-text.woff', 'ug-text-bold.woff', 'ug-display.woff', 'icon-192.png', 'icon-512.png', 'maskable-192.png', 'maskable-512.png', 'apple-touch-icon.png', 'favicon-64.png', 'favicon.ico'];
self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  e.respondWith(fetch(e.request).then(r => { const cp = r.clone(); caches.open(CACHE).then(c => c.put(e.request, cp)); return r; }).catch(() => caches.match(e.request).then(r => r || caches.match('index.html'))));
});
