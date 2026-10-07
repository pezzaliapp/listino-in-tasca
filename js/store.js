/*
 * Archivio locale (IndexedDB). Tutto resta sul dispositivo.
 *  - kv:     catalogo estratto, impostazioni, bozza del preventivo
 *  - files:  il PDF del listino (serve per mostrare le figure)
 *  - quotes: preventivi salvati
 */
(function (root) {
  'use strict';
  const DB_NAME = 'listino-in-tasca';
  const DB_VERSION = 1;
  let dbp = null;

  function open() {
    if (dbp) return dbp;
    dbp = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains('kv')) db.createObjectStore('kv');
        if (!db.objectStoreNames.contains('files')) db.createObjectStore('files');
        if (!db.objectStoreNames.contains('quotes')) db.createObjectStore('quotes', { keyPath: 'id' });
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    return dbp;
  }

  function tx(store, mode, fn) {
    return open().then(db => new Promise((resolve, reject) => {
      const t = db.transaction(store, mode);
      const s = t.objectStore(store);
      let result;
      Promise.resolve(fn(s)).then(r => { result = r; });
      t.oncomplete = () => resolve(result && result.result !== undefined ? result.result : result);
      t.onerror = () => reject(t.error);
      t.onabort = () => reject(t.error || new Error('Operazione annullata'));
    }));
  }

  const Store = {
    get: (store, key) => tx(store, 'readonly', s => s.get(key)),
    set: (store, key, value) => tx(store, 'readwrite', s => (key === null ? s.put(value) : s.put(value, key))),
    del: (store, key) => tx(store, 'readwrite', s => s.delete(key)),
    all: store => tx(store, 'readonly', s => s.getAll()),
    clear: store => tx(store, 'readwrite', s => s.clear()),
    async persist() {
      try {
        if (navigator.storage && navigator.storage.persist) return await navigator.storage.persist();
      } catch (e) { /* non supportato */ }
      return false;
    }
  };

  root.Store = Store;
})(self);
