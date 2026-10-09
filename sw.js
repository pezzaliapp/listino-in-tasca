/*
 * Service worker: mette in cache solo i file dell'app per l'uso offline.
 * Il listino PDF non passa mai di qui: viene letto dal file scelto sul telefono
 * e salvato in IndexedDB, mai scaricato o inviato in rete.
 */
const VERSION = 'lit-v1.3.2';
const SHELL = [
  './',
  'index.html',
  'css/app.css',
  'js/parser.js',
  'js/regole.js',
  'js/cerca.js',
  'js/agente.js',
  'data/agente.pack.json',
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

// File dell'app: prima la rete (cosi' una versione nuova si vede subito),
// la copia salvata se la rete non risponde entro pochi secondi o si e' offline.
// Font: prima la copia salvata.
const NET_TIMEOUT = 3500;

function fromNetwork(req) {
  return fetch(req, { cache: 'no-cache' }).then(res => {
    if (res && res.ok) {
      const copy = res.clone();
      caches.open(VERSION).then(c => c.put(req, copy));
    }
    return res;
  });
}

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (/\.pdf$/i.test(url.pathname)) return; // nessun PDF in cache, per scelta
  const isFont = url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com';
  if (url.origin !== location.origin && !isFont) return;

  if (isFont) {
    e.respondWith(caches.match(req).then(hit => hit || fetch(req).then(res => {
      if (res && (res.ok || res.type === 'opaque')) { const copy = res.clone(); caches.open(VERSION).then(c => c.put(req, copy)); }
      return res;
    })));
    return;
  }

  e.respondWith(new Promise(resolve => {
    let done = false;
    const cached = () => caches.match(req, { ignoreSearch: true })
      .then(hit => hit || (req.mode === 'navigate' ? caches.match('index.html') : null));
    const timer = setTimeout(() => {
      cached().then(hit => { if (hit && !done) { done = true; resolve(hit); } });
    }, NET_TIMEOUT);
    fromNetwork(req).then(res => {
      clearTimeout(timer);
      if (!done) { done = true; resolve(res); }
    }).catch(() => {
      clearTimeout(timer);
      cached().then(hit => { if (!done) { done = true; resolve(hit || Response.error()); } });
    });
  }));
});
