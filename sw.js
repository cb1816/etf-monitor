/* ETF Monitor — service worker NETWORK-FIRST.
   Online si vede sempre l'ultima versione (dati live da /api/data e app.js?v=N);
   la cache serve solo come rete di sicurezza offline. Mai cache-first: congelerebbe
   proprio quello che stiamo cercando di tenere aggiornato. */
const CACHE = 'etf-monitor-v1';
const ASSETS = ['./', './index.html', './manifest.webmanifest',
                './apple-touch-icon.png', './icon-192.png', './icon-512.png'];

self.addEventListener('install', e => {
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).catch(() => {}));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  if (new URL(req.url).origin !== self.location.origin) return;
  // 'no-cache' = vai comunque al server a rivalidare (304 se nulla e' cambiato):
  // cosi' nemmeno la cache HTTP del browser puo' servire un app.js?v=N vecchio.
  let net = req;
  try { net = new Request(req, { cache: 'no-cache' }); } catch (_) {}
  e.respondWith(
    fetch(net)
      .then(r => {
        if (r && r.status === 200 && r.type === 'basic') {
          const copy = r.clone();
          caches.open(CACHE).then(c => c.put(req, copy)).catch(() => {});
        }
        return r;
      })
      .catch(() => caches.match(req).then(m =>
        m || (req.mode === 'navigate' ? caches.match('./index.html') : undefined)))
  );
});
