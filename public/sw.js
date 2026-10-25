/* Kerem service worker: offline shell + notification clicks + optional web push */
const CACHE = 'kerem-v1';
const SHELL = ['/offline.html', '/icons/icon-192.png', '/manifest.webmanifest'];
self.addEventListener('install', (e) => { e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting())); });
self.addEventListener('activate', (e) => { e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', (e) => {
  const r = e.request;
  if (r.method !== 'GET') return;
  const url = new URL(r.url);
  if (url.origin !== location.origin || url.pathname.startsWith('/api/')) return;
  if (url.pathname.startsWith('/_next/static/') || url.pathname.startsWith('/icons/')) {
    e.respondWith(caches.match(r).then((hit) => hit || fetch(r).then((res) => { const cp = res.clone(); caches.open(CACHE).then((c) => c.put(r, cp)); return res; })));
    return;
  }
  if (r.mode === 'navigate') e.respondWith(fetch(r).catch(() => caches.match('/offline.html')));
});
self.addEventListener('push', (e) => {
  let d = {}; try { d = e.data ? e.data.json() : {}; } catch { d = { title: 'Kerem', body: e.data && e.data.text() }; }
  e.waitUntil(self.registration.showNotification(d.title || 'Kerem', { body: d.body || '', icon: '/icons/icon-192.png', badge: '/icons/icon-192.png', data: { link: d.link || '/' } }));
});
self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const link = (e.notification.data && e.notification.data.link) || '/';
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((cs) => {
    for (const c of cs) if ('focus' in c) { c.navigate(link); return c.focus(); }
    return self.clients.openWindow(link);
  }));
});
