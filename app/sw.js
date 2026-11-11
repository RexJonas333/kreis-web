// Kreis Web-App: hält die App-Dateien für den Offline-Start bereit. Chats liegen verschlüsselt in IndexedDB.
const V = 'kreis-5';
const FILES = ['./', 'index.html', 'css/app.css', 'js/config.js', 'js/vendor/qrcode.js', 'js/vendor/jsQR.js', 'js/crypto.js', 'js/store.js', 'js/net.js', 'js/core.js', 'js/ui.js', 'js/app.js', 'js/app2.js', 'js/call.js', 'js/pwa.js', 'manifest.webmanifest', 'icons/icon-192.png', 'icons/icon-512.png'];
self.addEventListener('install', (e) => { e.waitUntil(caches.open(V).then((c) => c.addAll(FILES)).then(() => self.skipWaiting())); });
self.addEventListener('activate', (e) => { e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== V).map((k) => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', (e) => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET' || u.origin !== location.origin) return;
  // Netz zuerst (immer neueste Version), sonst Zwischenspeicher
  e.respondWith(fetch(e.request).then((r) => { const c = r.clone(); caches.open(V).then((x) => x.put(e.request, c)); return r; }).catch(() => caches.match(e.request).then((r) => r || caches.match('index.html'))));
});
