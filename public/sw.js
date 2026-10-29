// Cache for the site. Images and built assets are cache-first, so repeat visits start from the phone.
// The HTML page is network-first, so a new deploy is picked up on the next visit.
// Videos are not handled here: iOS Safari shows blank video when a service worker answers its
// byte-range requests, so .mp4 files always go straight to the network.
const CACHE = 'portfolio-v3';
const MEDIA = /\.(jpg|jpeg|png|webp|svg)$/i;

self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.endsWith('.mp4')) return;

  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy));
          return res;
        })
        .catch(() => caches.match(req).then((r) => r || caches.match(url.pathname))),
    );
    return;
  }

  if (url.pathname.includes('/assets/') || MEDIA.test(url.pathname)) {
    e.respondWith(
      caches.open(CACHE).then((c) =>
        c.match(req).then((hit) => {
          if (hit) return hit;
          return fetch(req).then((res) => {
            if (res.ok && res.status === 200) c.put(req, res.clone());
            return res;
          });
        }),
      ),
    );
  }
});
