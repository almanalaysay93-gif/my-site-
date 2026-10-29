// Cache for the site. Media and built assets are cache-first, so repeat visits and page changes start
// from the phone. The HTML page is network-first, so a new deploy is picked up on the next visit.
const CACHE = 'portfolio-v2';
const MEDIA = /\.(mp4|jpg|jpeg|png|webp|svg)$/i;

self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

// Video is asked for in byte ranges. Store the whole file once, then answer every range from it.
async function rangeFromCache(req, cache) {
  const key = new Request(new URL(req.url).pathname);
  let full = await cache.match(key);
  if (!full) {
    const res = await fetch(new Request(req.url, { headers: {} }));
    if (!res.ok) return res;
    await cache.put(key, res.clone());
    full = res;
  }
  const buf = await full.arrayBuffer();
  const m = /bytes=(\d*)-(\d*)/.exec(req.headers.get('range') || '');
  if (!m) return new Response(buf, { status: 200, headers: { 'Content-Type': full.headers.get('Content-Type') || 'video/mp4' } });
  const start = m[1] === '' ? buf.byteLength - Number(m[2]) : Number(m[1]);
  const end = m[2] === '' || m[1] === '' ? buf.byteLength - 1 : Math.min(Number(m[2]), buf.byteLength - 1);
  return new Response(buf.slice(start, end + 1), {
    status: 206,
    headers: {
      'Content-Type': full.headers.get('Content-Type') || 'video/mp4',
      'Content-Range': `bytes ${start}-${end}/${buf.byteLength}`,
      'Content-Length': String(end - start + 1),
      'Accept-Ranges': 'bytes',
    },
  });
}

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req)
        .then((res) => {
          caches.open(CACHE).then((c) => c.put(req, res.clone()));
          return res;
        })
        .catch(() => caches.match(req).then((r) => r || caches.match(url.pathname))),
    );
    return;
  }

  if (url.pathname.includes('/assets/') || MEDIA.test(url.pathname)) {
    e.respondWith(
      caches.open(CACHE).then((c) => {
        if (req.headers.has('range')) return rangeFromCache(req, c);
        return c.match(req).then((hit) => {
          if (hit) return hit;
          return fetch(req).then((res) => {
            if (res.ok && res.status === 200) c.put(req, res.clone());
            return res;
          });
        });
      }),
    );
  }
});
