/*
 * Service worker: mette in cache solo i file dell'app per l'uso offline.
 * Il listino PDF non passa mai di qui: viene letto dal file scelto sul telefono
 * e salvato in IndexedDB, mai scaricato o inviato in rete.
 */
const VERSION = 'lit-v1.0.0';
const SHELL = [
  './',
  'index.html',
  'css/app.css',
  'js/parser.js',
  'js/store.js',
  'js/pdfview.js',
  'js/app.js',
  'lib/pdf.min.js',
  'lib/pdf.worker.min.js',
  'manifest.webmanifest',
  'icons/icon.svg',
  'icons/icon-192.png',
  'icons/apple-touch-icon.png'
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (/\.pdf$/i.test(url.pathname)) return; // nessun PDF in cache, per scelta
  const isFont = url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com';
  if (url.origin !== location.origin && !isFont) return;

  e.respondWith(
    caches.match(req, { ignoreSearch: true }).then(hit => {
      const net = fetch(req).then(res => {
        if (res && (res.ok || res.type === 'opaque')) {
          const copy = res.clone();
          caches.open(VERSION).then(c => c.put(req, copy));
        }
        return res;
      }).catch(() => hit);
      return hit || net;
    })
  );
});
