// Offline support for Demon Play Predictor
const V = 'dpp-v4';
const CORE = ['./', './index.html', './offense.html', './xlsx.full.min.js', './manifest.webmanifest',
  './icon-192.png', './icon-512.png', './apple-touch-icon.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(V).then(c => c.addAll(CORE)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== V).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});
const timeout = ms => new Promise((_, rej) => setTimeout(() => rej(new Error('slow')), ms));

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  // Only handle this site's files and Google Fonts; live sync traffic goes straight to the network.
  if (url.origin !== self.location.origin && !/fonts\.(googleapis|gstatic)\.com$/.test(url.hostname)) return;
  // The page: try the network briefly for updates, fall back to the saved copy.
  if (req.mode === 'navigate') {
    e.respondWith((async () => {
      try {
        const res = await Promise.race([fetch(req), timeout(2500)]);
        if (res && res.ok) { const c = await caches.open(V); c.put(req, res.clone()); }
        return res;
      } catch (_) {
        return (await caches.match(req, {ignoreSearch: true})) || (/offense/.test(url.pathname) ? await caches.match('./offense.html') : null) || (await caches.match('./index.html')) || (await caches.match('./'));
      }
    })());
    return;
  }
  // Everything else (library, icons, fonts): saved copy first, refresh in the background.
  e.respondWith((async () => {
    const c = await caches.open(V);
    const hit = await c.match(req);
    const net = fetch(req).then(res => {
      if (res && (res.ok || res.type === 'opaque')) c.put(req, res.clone());
      return res;
    }).catch(() => null);
    return hit || (await net) || new Response('', { status: 504 });
  })());
});
