/* Majlis service worker — lets the site install as an app and open even with a bad connection.
   Network first: you always get the newest version when online; the saved copy is only used offline.
   It never touches Supabase or anything on another website. */
const CACHE = 'majlis-shell-v61';
const SHELL = ['./', './index.html', './styles.css', './app.js', './extras.js', './topics.js', './filters.js', './challenges.js', './guide.js', './guide-videos-a.js', './guide-videos-b.js', './guide-player.js', './questions.js', './majlis-characters.js',
  './manifest.webmanifest', './icons/icon-192.png', './icons/icon-512.png'];
self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then(c => Promise.all(SHELL.map(u => c.add(u).catch(() => null)))).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if(req.method !== 'GET') return;
  const url = new URL(req.url);
  if(url.origin !== self.location.origin) return;          // Supabase, fonts, CDNs: straight to the network
  e.respondWith(fetch(req).then(res => {
    if(res && res.ok){ const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)).catch(() => {}); }
    return res;
  }).catch(() => caches.match(req, { ignoreSearch: true }).then(r => r || (req.mode === 'navigate' ? caches.match('./index.html') : undefined))));
});
