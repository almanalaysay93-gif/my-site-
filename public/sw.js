// Offline-friendly cache for the site. Media and built assets are cache-first (fast repeat visits);
// the HTML page is network-first so a new deploy is picked up on the next visit.
const CACHE = 'portfolio-v1';
const MEDIA = /\.(mp4|jpg|jpeg|png|webp|svg)$/i;

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
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  const url = new URL(req.url);

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
          // Video is requested in ranges; a 206 response cannot be stored as a whole file, so pass it through.
          return fetch(req).then((res) => {
            if (res.ok && res.status === 200) c.put(req, res.clone());
            return res;
          });
        }),
      ),
    );
  }
});
