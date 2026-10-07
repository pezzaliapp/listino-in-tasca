/*
 * Listino in tasca
 * Preventivi da listino PDF, tutto in locale sul telefono.
 */
(function () {
  'use strict';

  const APP_VERSION = '1.1.0';

  /* ---------- utilità ---------- */
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const eur = new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' });
  const money = n => eur.format(Math.round((n || 0) * 100) / 100);
  const pct = new Intl.NumberFormat('it-IT', { maximumFractionDigits: 2 });
  const norm = s => String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  const debounce = (fn, ms) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };
  const vibrate = () => { try { navigator.vibrate && navigator.vibrate(8); } catch (e) { /* */ } };

  /* ---------- dizionari ---------- */
  const ICONS = {
    auto: '<path d="M3 15.5v-3.2l2.1-4.6A2 2 0 0 1 6.9 6.5h8.5a2 2 0 0 1 1.6.8L20 11.4l1 .9v3.2h-1.6M6 15.5H4.6M10 15.5h4" /><circle cx="8" cy="15.8" r="2"/><circle cx="17" cy="15.8" r="2"/><path d="M5 11.4h15"/>',
    moto: '<circle cx="5.5" cy="15.5" r="3.3"/><circle cx="18.5" cy="15.5" r="3.3"/><path d="M5.5 15.5 9.5 10h4.5l4.5 5.5M12 10l-1.2-3H8.5M14 10l2-3h2.2"/>',
    truck: '<path d="M2.5 16.5v-11h11v11M13.5 9h4l3 4v3.5h-1.4M8.2 16.5h7.2"/><circle cx="6" cy="17" r="2"/><circle cx="17.2" cy="17" r="2"/>',
    equilibratura: '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="3.2"/><rect x="10.6" y="1.8" width="2.8" height="3" rx=".6" fill="currentColor" stroke="none"/>',
    smontaggio: '<circle cx="12" cy="13" r="8"/><circle cx="12" cy="13" r="4.6"/><path d="M15.5 2.5 10.2 13"/>',
    sollevamento: '<path d="M3.5 20.5h17M7 20.5v-16M17 20.5v-16M7 12h10M12 9.5V4.5m-2.2 2.2L12 4.5l2.2 2.2"/>',
    assetto: '<path d="M8.5 4 6 20M15.5 4 18 20M3 12h3m3.5 0h5m3.5 0h3"/>',
    altro: '<path d="M14.7 6.3a4 4 0 0 0-5.4 5.4L3.8 17.2l3 3 5.5-5.5a4 4 0 0 0 5.4-5.4l-2.5 2.5-2.6-.6-.6-2.6z"/>'
  };
  const icon = (id, size = 28) => `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[id] || ''}</svg>`;

  const VEHICLES = [
    { id: 'auto', label: 'Auto', hint: 'Vetture, SUV, furgoni' },
    { id: 'moto', label: 'Moto', hint: 'Moto e scooter' },
    { id: 'truck', label: 'Truck', hint: 'Camion, bus, agricoli' }
  ];
  const ACTIVITIES = [
    { id: 'equilibratura', label: 'Equilibratura' },
    { id: 'smontaggio', label: 'Smontaggio gomme' },
    { id: 'sollevamento', label: 'Sollevamento' },
    { id: 'assetto', label: 'Assetto ruote' },
    { id: 'altro', label: 'Altre attrezzature' }
  ];
  const FEATURES = [
    { id: 'touch', label: 'Touchscreen', re: /touch/i, act: ['equilibratura'] },
    { id: 'sonar', label: 'Sonar', re: /sonar/i, act: ['equilibratura'] },
    { id: 'laser', label: 'Laser', re: /laser/i, act: ['equilibratura'] },
    { id: 'lift', label: 'Sollevatore ruote', re: /sollevatore|\bLIFT\b|VDLL/i, act: ['equilibratura', 'smontaggio'] },
    { id: 'nls', label: 'Bloccaggio rapido NLS', re: /\bNLS\b/, act: ['equilibratura'] },
    { id: 'rlc', label: 'Analisi pneumatico RLC', re: /\bRLC\b/, act: ['equilibratura'] },
    { id: 'freno', label: 'Freno a pedale', re: /freno/i, act: ['equilibratura'] },
    { id: 'prot', label: 'Protezione ruota', re: /protezione ruota/i, act: ['equilibratura'] },
    { id: 'auto', label: 'Acquisizione dati automatica', re: /acquisizione/i, act: ['equilibratura'] },
    { id: 'mi', label: 'Motoinverter (MI)', re: /\bMI\b/, act: ['smontaggio'] },
    { id: 'lever', label: 'Leverless', re: /leverless/i, act: ['smontaggio'] },
    { id: 'vel', label: '2 velocità', re: /2 vel|2 speed/i, act: ['smontaggio'] },
    { id: 'prem', label: 'Premitallone', re: /premitallone/i, act: ['smontaggio'] },
    { id: 'gt', label: 'Versione GT / Racing', re: /\bGT\b|racing/i, act: ['smontaggio'] }
  ];
  const POWER = [
    { id: 'mono', label: 'Monofase 230V', test: t => /\b(230|220)\s?-?V?|1\s?ph/i.test(t) },
    { id: 'tri', label: 'Trifase 400V', test: t => /400\s?V|3\s?ph/i.test(t) },
    { id: 'batt', label: 'Batteria 12/24V', test: t => /12V|24V|batteri/i.test(t) },
    { id: 'nd', label: 'Non indicata', test: null }
  ];
  const PRICE = [
    { id: 'p1', label: 'Fino a 5.000 €', min: 0, max: 5000 },
    { id: 'p2', label: '5.000 – 10.000 €', min: 5000, max: 10000 },
    { id: 'p3', label: '10.000 – 20.000 €', min: 10000, max: 20000 },
    { id: 'p4', label: 'Oltre 20.000 €', min: 20000, max: Infinity }
  ];

  const DEFAULT_SETTINGS = {
    company: '',
    seller: '',
    vat: 22,
    defaultDisc: '',
    validity: 30,
    notes: 'Prezzi IVA esclusa. Resa franco stabilimento del produttore, imballo e trasporto esclusi.',
    counterYear: new Date().getFullYear(),
    counter: 0
  };

  /* ---------- stato ---------- */
  const S = {
    catalog: null,
    byKey: new Map(),
    settings: Object.assign({}, DEFAULT_SETTINGS),
    quote: null,
    view: 'config',
    cfg: { vehicle: null, activity: null, open: 'vehicle', sel: {}, acc: false, sort: 'listino' },
    search: { q: '', section: null },
    loading: null
  };

  function newQuote() {
    return {
      id: null, number: null, date: new Date().toISOString(),
      customer: '', reference: '',
      globalDisc: S.settings.defaultDisc || '',
      vatOn: false,
      items: [],
      notes: S.settings.notes,
      savedAt: null
    };
  }

  /* ---------- sconti ---------- */
  // Accetta "20", "20,5", "30+5", "30+10+2" (sconti in cascata)
  function parseDisc(str) {
    const s = String(str == null ? '' : str).replace(/%/g, '').replace(/\s/g, '').replace(/,/g, '.');
    if (!s) return { factor: 1, pct: 0, valid: true };
    const parts = s.split('+').filter(Boolean);
    let f = 1;
    for (const p of parts) {
      const v = Number(p);
      if (!isFinite(v) || v < 0 || v > 100) return { factor: 1, pct: 0, valid: false };
      f *= 1 - v / 100;
    }
    return { factor: f, pct: (1 - f) * 100, valid: true };
  }
  function lineDisc(item) {
    const own = item.disc != null && String(item.disc).trim() !== '';
    return parseDisc(own ? item.disc : S.quote.globalDisc);
  }
  function lineNet(item) { return item.price * item.qty * lineDisc(item).factor; }
  function totals() {
    const q = S.quote;
    let gross = 0, net = 0, count = 0;
    for (const it of q.items) { gross += it.price * it.qty; net += lineNet(it); count += it.qty; }
    const vat = q.vatOn ? net * (Number(S.settings.vat) || 0) / 100 : 0;
    return { gross, net, disc: gross - net, discPct: gross ? (1 - net / gross) * 100 : 0, vat, total: net + vat, count, lines: q.items.length };
  }

  /* ---------- persistenza ---------- */
  const saveDraft = debounce(() => { Store.set('kv', 'draft', S.quote).catch(() => {}); }, 400);
  const saveSettings = debounce(() => { Store.set('kv', 'settings', S.settings).catch(() => {}); }, 300);

  /* ---------- catalogo ---------- */
  function indexCatalog(cat) {
    S.catalog = cat;
    S.byKey.clear();
    for (const p of cat.products) {
      p.key = p.code + '|' + (p.power || '');
      const fam = cat.families[p.family] || {};
      p._hay = norm([p.code, p.name, fam.title, fam.subtitle, fam.sub, fam.main].join(' '));
      p._feat = p.name + ' ' + (fam.title || '');
      p._power = powerGroups(p);
      S.byKey.set(p.key, p);
    }
    PdfView.setSource(() => Store.get('files', 'listino'));
    updateHeader();
  }
  function fam(id) { return (S.catalog && S.catalog.families[id]) || {}; }
  function powerGroups(p) {
    const t = (p.power || '') + ' ' + p.name;
    const g = POWER.filter(x => x.test && x.test(t)).map(x => x.id);
    return g.length ? g : ['nd'];
  }

  function updateHeader() {
    const el = $('#listino-label');
    if (!S.catalog) { el.textContent = 'Nessun listino caricato'; return; }
    const t = S.catalog.title.replace(/\s+/g, ' ');
    el.textContent = `${t}, ${S.catalog.products.length} articoli`;
  }

  /* ---------- caricamento PDF ---------- */
  async function loadPdfFile(file) {
    if (!file) return;
    if (!/pdf$/i.test(file.type) && !/\.pdf$/i.test(file.name)) { toast('Scegli un file PDF'); return; }
    closeSheet(true);
    S.view = 'config';
    const ok = await processPdf(await file.arrayBuffer(), { name: file.name, size: file.size }, file.name);
    if (ok) S.cfg = { vehicle: null, activity: null, open: 'vehicle', sel: {}, acc: false, sort: 'listino' };
    render();
  }

  // Legge il PDF (gia' in memoria) ed estrae il catalogo. Usato anche per
  // aggiornare i dati quando cambia la versione del lettore.
  async function processPdf(bytes, meta, label) {
    S.loading = { done: 0, total: 0, name: label, phase: 'Apertura del file' };
    render();
    try {
      const pdf = await PdfView.load(bytes);
      S.loading.total = pdf.numPages;
      const cat = await ListinoParser.parseListino(pdf, (p, n, phase) => {
        S.loading.done = phase === 'lettura' ? p : n;
        S.loading.phase = phase === 'lettura' ? 'Lettura pagine' : 'Analisi prodotti';
        paintLoading();
      });
      pdf.destroy();
      if (!cat.products.length) throw new Error('Nel PDF non ho trovato righe con codice a 8 cifre e prezzo. Controlla che sia il listino giusto.');
      cat.fileName = meta.name;
      cat.fileSize = meta.size;
      await Store.set('files', 'listino', bytes);
      await Store.set('kv', 'catalog', cat);
      Store.persist();
      PdfView.reset();
      indexCatalog(cat);
      S.loading = null;
      toast(`Listino caricato: ${cat.products.length} articoli`);
      return true;
    } catch (err) {
      console.error(err);
      S.loading = null;
      toast(err && err.message ? err.message : 'Impossibile leggere il PDF');
      return false;
    }
  }

  async function upgradeCatalog(cat) {
    const bytes = await Store.get('files', 'listino');
    if (!bytes) return;
    await processPdf(bytes, { name: cat.fileName, size: cat.fileSize }, 'Aggiorno i dati del listino');
    render();
  }

  function paintLoading() {
    const l = S.loading;
    const bar = $('#load-bar');
    if (!bar || !l) return;
    const pctDone = l.total ? Math.round((l.done / l.total) * 100) : 4;
    bar.style.width = pctDone + '%';
    $('#load-text').textContent = l.total ? `${l.phase}: ${l.done} di ${l.total}` : l.phase;
  }

  /* ---------- render principale ---------- */
  function render() {
    const view = $('#view');
    $$('#tabbar .tab').forEach(b => b.classList.toggle('active', b.dataset.view === S.view));
    if (S.loading) {
      view.innerHTML = `
        <section class="welcome">
          <h1 class="w-title">Sto leggendo il listino</h1>
          <p class="w-text">${esc(S.loading.name)}</p>
          <div class="progress"><div id="load-bar"></div></div>
          <p class="w-small" id="load-text"></p>
          <p class="w-small">La lettura avviene sul telefono. Il file non viene inviato da nessuna parte.</p>
        </section>`;
      paintLoading();
      updateQuoteBar();
      return;
    }
    if (!S.catalog && (S.view === 'config' || S.view === 'search')) {
      view.innerHTML = welcomeHTML();
    } else if (S.view === 'config') view.innerHTML = configHTML();
    else if (S.view === 'search') { view.innerHTML = searchHTML(); }
    else if (S.view === 'quote') { view.innerHTML = quoteHTML(); warmPrintImages(); }
    else if (S.view === 'archive') { view.innerHTML = '<p class="empty">Caricamento…</p>'; archiveRender(); }
    hydrateThumbs(view);
    updateQuoteBar();
  }

  function welcomeHTML() {
    return `
      <section class="welcome">
        <div class="w-mark">${icon('equilibratura', 56)}</div>
        <h1 class="w-title">Carica il listino per iniziare</h1>
        <p class="w-text">Scegli il PDF del listino dal telefono. Viene letto qui, sul dispositivo, e non viene mai caricato online.</p>
        <button class="btn btn-signal btn-big" data-action="pick-file">Carica listino PDF</button>
        <p class="w-small">Puoi sostituirlo in qualsiasi momento dalle impostazioni, quando esce un listino nuovo.</p>
      </section>`;
  }

  /* ---------- configuratore ---------- */
  function machineBase(withAcc) {
    const c = S.cfg;
    return S.catalog.products.filter(p =>
      (!c.vehicle || p.vehicles.includes(c.vehicle)) &&
      (!c.activity || p.activity === c.activity) &&
      (withAcc || !p.accessory));
  }

  function filterGroups(base) {
    const c = S.cfg;
    const groups = [];
    const machines = base.filter(p => !p.accessory);
    if (!machines.length) return groups;
    // Tipologia: sottosezioni del listino
    const subs = new Map();
    for (const p of machines) { const s = fam(p.family).sub || ''; if (s) subs.set(s, (subs.get(s) || 0) + 1); }
    if (subs.size > 1) groups.push({ id: 'tipo', label: 'Tipologia', opts: [...subs].map(([s, n]) => ({ id: s, label: s, n })) });
    // Caratteristiche
    const feats = FEATURES.filter(f => !c.activity || f.act.includes(c.activity))
      .map(f => ({ id: f.id, label: f.label, n: machines.filter(p => f.re.test(p._feat)).length }))
      .filter(o => o.n > 0 && o.n < machines.length);
    if (feats.length) groups.push({ id: 'feat', label: 'Caratteristiche', opts: feats, all: true });
    // Alimentazione
    const pw = POWER.map(x => ({ id: x.id, label: x.label, n: machines.filter(p => p._power.includes(x.id)).length })).filter(o => o.n > 0);
    if (pw.length > 1) groups.push({ id: 'power', label: 'Alimentazione', opts: pw });
    // Prezzo
    const pr = PRICE.map(x => ({ id: x.id, label: x.label, n: machines.filter(p => p.price >= x.min && p.price < x.max).length })).filter(o => o.n > 0);
    if (pr.length > 1) groups.push({ id: 'price', label: 'Prezzo di listino', opts: pr });
    return groups;
  }

  function applyFilters(list) {
    const sel = S.cfg.sel;
    return list.filter(p => {
      if (p.accessory) return true; // gli accessori non hanno questi filtri
      for (const g of Object.keys(sel)) {
        const v = sel[g];
        if (!v || !v.length) continue;
        if (g === 'tipo' && !v.includes(fam(p.family).sub)) return false;
        if (g === 'feat' && !v.every(id => FEATURES.find(f => f.id === id).re.test(p._feat))) return false;
        if (g === 'power' && !v.some(id => p._power.includes(id))) return false;
        if (g === 'price' && !v.some(id => { const r = PRICE.find(x => x.id === id); return p.price >= r.min && p.price < r.max; })) return false;
      }
      return true;
    });
  }

  function configHTML() {
    const c = S.cfg;
    const all = S.catalog.products;
    const vCount = v => all.filter(p => !p.accessory && p.vehicles.includes(v)).length;
    const aCount = a => all.filter(p => !p.accessory && p.activity === a && (!c.vehicle || p.vehicles.includes(c.vehicle))).length;
    const vLabel = c.vehicle ? VEHICLES.find(v => v.id === c.vehicle).label : 'Tutti i veicoli';
    const aLabel = c.activity ? ACTIVITIES.find(a => a.id === c.activity).label : '';

    let h = '<div class="config">';
    // Passo 1
    h += step(1, 'vehicle', 'Per quale veicolo?', c.vehicle || c.open !== 'vehicle' ? vLabel : '', `
      <div class="tiles tiles-3">
        ${VEHICLES.map(v => `
          <button class="tile ${c.vehicle === v.id ? 'on' : ''}" data-action="cfg-vehicle" data-id="${v.id}" ${vCount(v.id) ? '' : 'disabled'}>
            ${icon(v.id, 34)}<span class="tile-l">${v.label}</span><span class="tile-h">${v.hint}</span>
          </button>`).join('')}
      </div>
      <button class="link" data-action="cfg-vehicle" data-id="">Mostra per tutti i veicoli</button>`);
    // Passo 2
    h += step(2, 'activity', 'Che lavoro deve fare?', aLabel, `
      <div class="tiles tiles-2">
        ${ACTIVITIES.map(a => { const n = aCount(a.id); return `
          <button class="tile tile-row ${c.activity === a.id ? 'on' : ''}" data-action="cfg-activity" data-id="${a.id}" ${n ? '' : 'disabled'}>
            ${icon(a.id, 30)}<span class="tile-l">${a.label}</span><span class="tile-n">${n}</span>
          </button>`; }).join('')}
      </div>`, !c.vehicle && c.open === 'vehicle');

    if (c.activity) {
      const base = machineBase(c.acc);
      const groups = filterGroups(base);
      const nSel = Object.values(c.sel).reduce((a, v) => a + (v ? v.length : 0), 0);
      h += step(3, 'needs', 'Esigenze del cliente', nSel ? `${nSel} ${nSel === 1 ? 'filtro' : 'filtri'}` : 'Facoltativo', `
        ${groups.length ? groups.map(g => `
          <div class="fgroup">
            <p class="fg-label">${g.label}${g.all ? ' <span class="fg-hint">(tutte quelle scelte)</span>' : ''}</p>
            <div class="chips chips-scroll">
              ${g.opts.map(o => `<button class="chip ${(c.sel[g.id] || []).includes(o.id) ? 'on' : ''}" data-action="cfg-chip" data-g="${g.id}" data-id="${esc(o.id)}">${esc(o.label)} <span>${o.n}</span></button>`).join('')}
            </div>
          </div>`).join('') : '<p class="muted">Nessun filtro utile per questa scelta: guarda direttamente i prodotti qui sotto.</p>'}
        ${nSel ? '<button class="link" data-action="cfg-clear">Togli tutti i filtri</button>' : ''}`);

      const list = applyFilters(base);
      h += resultsHTML(list);
    }
    h += '</div>';
    return h;
  }

  function step(n, id, q, answer, body, disabled) {
    const open = S.cfg.open === id;
    return `
      <section class="step ${open ? 'open' : ''} ${disabled ? 'locked' : ''}">
        <button class="step-head" data-action="cfg-open" data-step="${id}" ${disabled ? 'disabled' : ''} aria-expanded="${open}">
          <span class="step-n">${n}</span>
          <span class="step-q">${q}</span>
          ${answer ? `<span class="step-a">${esc(answer)}</span>` : ''}
        </button>
        ${open ? `<div class="step-body">${body}</div>` : ''}
      </section>`;
  }

  function sortList(list) {
    const s = S.cfg.sort;
    if (s === 'asc') return [...list].sort((a, b) => a.price - b.price);
    if (s === 'desc') return [...list].sort((a, b) => b.price - a.price);
    return list;
  }

  function resultsHTML(list) {
    const groups = new Map();
    for (const p of sortList(list)) {
      if (!groups.has(p.family)) groups.set(p.family, []);
      groups.get(p.family).push(p);
    }
    const machines = list.filter(p => !p.accessory).length;
    return `
      <section class="results">
        <div class="res-bar">
          <p class="res-count"><b>${machines}</b> ${machines === 1 ? 'prodotto' : 'prodotti'}${S.cfg.acc ? ` e ${list.length - machines} accessori` : ''}</p>
          <label class="select-wrap">
            <span class="sr">Ordina</span>
            <select data-bind-cfg="sort">
              <option value="listino" ${S.cfg.sort === 'listino' ? 'selected' : ''}>Ordine listino</option>
              <option value="asc" ${S.cfg.sort === 'asc' ? 'selected' : ''}>Prezzo crescente</option>
              <option value="desc" ${S.cfg.sort === 'desc' ? 'selected' : ''}>Prezzo decrescente</option>
            </select>
          </label>
        </div>
        <label class="switch">
          <input type="checkbox" data-action="cfg-acc" ${S.cfg.acc ? 'checked' : ''}>
          <span class="sw"></span> Mostra anche gli accessori
        </label>
        ${groups.size ? [...groups].map(([fid, items]) => familyCard(fid, items)).join('') : '<p class="empty">Nessun prodotto con questi filtri. Prova a togliere qualche caratteristica.</p>'}
      </section>`;
  }

  function famCrop(f) {
    return f.accessory ? null : { x0: 0.04, x1: 0.46, y0: 0.085, y1: 0.5 };
  }
  // Ritaglio della figura di un singolo articolo: foto della macchina oppure
  // riga dell'accessorio (immagine, codice, descrizione, prezzo).
  function productCrop(p) {
    if (!p) return null;
    const f = fam(p.family);
    if (!p.accessory && !f.accessory) { const c = famCrop(f); return c ? Object.assign({ page: p.page }, c) : null; }
    if (p.band) {
      // foto a sinistra del codice; se non c'e' spazio, tutta la riga
      if (p.band.xc > 0.12) return { page: p.page, x0: 0.055, x1: p.band.xc, y0: p.band.y0, y1: p.band.y1 };
      return { page: p.page, x0: 0.02, x1: p.band.x1 || 0.62, y0: p.band.y0, y1: p.band.y1 };
    }
    return null;
  }
  function itemCrop(it) { return it && !it.custom && it.key ? productCrop(S.byKey.get(it.key)) : null; }
  function thumbImg(crop, w) {
    return `<img alt="" data-thumb-page="${crop.page}" data-crop="${crop.x0},${crop.x1},${crop.y0},${crop.y1}" data-w="${w}">`;
  }
  const PRINT_W = 220;
  const showImages = () => S.quote.showImages !== false;
  function warmPrintImages() {
    if (!showImages()) return;
    for (const it of S.quote.items) { const c = itemCrop(it); if (c) PdfView.thumb(c.page, c, PRINT_W).catch(() => {}); }
  }

  function familyCard(fid, items) {
    const f = fam(fid);
    const min = Math.min(...items.map(p => p.price));
    const crop = famCrop(f);
    return `
      <article class="fam ${f.accessory ? 'fam-acc' : ''}">
        <button class="fam-head" data-action="open-family" data-fam="${fid}">
          ${crop ? `<span class="thumb"><img alt="" data-thumb-page="${f.page}" data-crop="${crop.x0},${crop.x1},${crop.y0},${crop.y1}" data-w="120"></span>` : `<span class="thumb thumb-icon">${icon(f.activity, 30)}</span>`}
          <span class="fam-text">
            <span class="fam-title">${esc(f.title)}</span>
            ${f.subtitle ? `<span class="fam-sub">${esc(f.subtitle)}</span>` : ''}
            <span class="fam-from">${items.length > 1 ? 'da ' : ''}${money(min)} <span class="muted">pag. ${f.page}</span></span>
          </span>
        </button>
        <ul class="variants">${items.map(rowHTML).join('')}</ul>
      </article>`;
  }

  function inQuote(key) { return S.quote.items.filter(i => i.key === key).reduce((a, i) => a + i.qty, 0); }

  function addBtn(p) {
    const n = inQuote(p.key);
    return `<button class="add ${n ? 'added' : ''}" data-action="add" data-key="${esc(p.key)}" aria-label="Aggiungi ${esc(p.code)} al preventivo">${n ? `<span>${n}</span>` : '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="M12 5v14M5 12h14" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>'}</button>`;
  }

  function rowHTML(p, opts = {}) {
    const f = fam(p.family);
    return `
      <li class="var">
        <button class="var-main" data-action="open-product" data-key="${esc(p.key)}">
          <span class="v-code">${esc(p.code)}${p.shared ? ' <span class="tag" title="Stesso prezzo di altri codici">variante</span>' : ''}</span>
          <span class="v-name">${esc(p.name)}</span>
          ${p.power ? `<span class="v-meta">${esc(p.power)}</span>` : ''}
          ${opts.meta ? `<span class="v-meta">${esc(f.title)}, pag. ${p.page}</span>` : ''}
        </button>
        <span class="v-side">
          <span class="v-price">${money(p.price)}</span>
          ${addBtn(p)}
        </span>
      </li>`;
  }

  /* ---------- ricerca ---------- */
  function searchHTML() {
    return `
      <div class="search">
        <div class="searchbox">
          <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6" stroke="currentColor" stroke-width="1.8" fill="none"/><path d="m15 15 5 5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>
          <input id="q" type="search" enterkeyhint="search" autocomplete="off" autocorrect="off" spellcheck="false"
            placeholder="Codice o nome, es. 01100313 o MEC 1000" value="${esc(S.search.q)}">
        </div>
        <div id="search-results">${searchResultsHTML()}</div>
      </div>`;
  }

  function searchResultsHTML() {
    const q = norm(S.search.q).trim();
    const cat = S.catalog;
    if (!q && !S.search.section) {
      // Indice del listino come menu
      const idx = (cat.index || []).filter(e => cat.products.some(p => p.page >= e.page));
      const mains = [];
      let cur = null;
      for (const e of idx) {
        if (e.main) { cur = { e, subs: [] }; mains.push(cur); }
        else if (cur) cur.subs.push(e);
      }
      const count = (from, to) => cat.products.filter(p => p.page >= from && p.page < to).length;
      const nextPage = e => { const i = idx.indexOf(e); const nx = idx.slice(i + 1).find(x => x.page > e.page); return nx ? nx.page : 9999; };
      const nextMain = e => { const i = idx.indexOf(e); const nx = idx.slice(i + 1).find(x => x.main && x.page > e.page); return nx ? nx.page : 9999; };
      const blocks = mains.map(m => {
        const n = count(m.e.page, nextMain(m.e));
        if (!n) return '';
        return `
          <div class="sec">
            <button class="sec-main" data-action="section" data-from="${m.e.page}" data-to="${nextMain(m.e)}" data-name="${esc(m.e.name)}">
              <span>${esc(cap(m.e.name))}</span><span class="tile-n">${n}</span>
            </button>
            ${m.subs.length ? `<div class="sec-subs">${m.subs.map(s => { const k = count(s.page, Math.min(nextPage(s), nextMain(m.e))); return k ? `<button class="chip" data-action="section" data-from="${s.page}" data-to="${Math.min(nextPage(s), nextMain(m.e))}" data-name="${esc(s.name)}">${esc(s.name)} <span>${k}</span></button>` : ''; }).join('')}</div>` : ''}
          </div>`;
      }).join('');
      return `<p class="hint">Oppure sfoglia per sezione del listino</p>${blocks || '<p class="empty">Indice non trovato nel PDF: usa la ricerca.</p>'}`;
    }
    let list;
    let head = '';
    if (S.search.section && !q) {
      const s = S.search.section;
      list = cat.products.filter(p => p.page >= s.from && p.page < s.to);
      head = `<div class="res-bar"><p class="res-count"><b>${esc(s.name)}</b>, ${list.length} articoli</p><button class="link" data-action="section-clear">Tutte le sezioni</button></div>`;
    } else {
      const toks = q.split(/\s+/).filter(Boolean);
      list = cat.products.filter(p => toks.every(t => p._hay.includes(t)));
      // codice esatto o che inizia per: in cima
      list.sort((a, b) => (b.code.startsWith(q) ? 1 : 0) - (a.code.startsWith(q) ? 1 : 0));
      head = `<p class="res-count"><b>${list.length}</b> ${list.length === 1 ? 'risultato' : 'risultati'}</p>`;
    }
    const shown = list.slice(0, 120);
    return head + (shown.length
      ? `<ul class="variants flat">${shown.map(p => rowHTML(p, { meta: true })).join('')}</ul>${list.length > shown.length ? `<p class="hint">Mostro i primi ${shown.length}: scrivi qualcosa in più per restringere.</p>` : ''}`
      : '<p class="empty">Nessun articolo trovato. Controlla il codice o prova con una parola sola.</p>');
  }
  const cap = s => s.charAt(0) + s.slice(1).toLowerCase();

  /* ---------- scheda prodotto / famiglia ---------- */
  function openFamily(fid, focusKey) {
    const f = fam(fid);
    const items = S.catalog.products.filter(p => p.family === fid);
    const focus = focusKey ? S.byKey.get(focusKey) : null;
    const accs = suggestedAccessories(f);
    const html = `
      <header class="sh-head">
        <p class="sh-kicker">${esc(f.sub || cap(f.main || ''))}, pag. ${f.page}</p>
        <h2 id="sheet-title" class="sh-title">${esc(f.title)}</h2>
        ${f.subtitle ? `<p class="sh-sub">${esc(f.subtitle)}</p>` : ''}
      </header>
      <div class="figure">
        <div class="fig-scroll" id="fig-scroll">
          <div class="fig-inner" id="fig-inner">
            <canvas id="fig-canvas" aria-label="Pagina ${f.page} del listino"></canvas>
            ${focus && focus.band ? `<div class="fig-hl" style="top:${(focus.band.y0 * 100).toFixed(2)}%;height:${((focus.band.y1 - focus.band.y0) * 100).toFixed(2)}%"></div>` : ''}
          </div>
        </div>
        <div class="fig-tools">
          <span class="muted" id="fig-status">Pagina ${f.page} del listino</span>
          <button class="btn btn-ghost btn-sm" data-action="fig-zoom" id="fig-zoom">Ingrandisci</button>
        </div>
      </div>
      ${focus ? `<h3 class="sh-h3">Articolo selezionato</h3><ul class="variants">${rowHTML(focus)}</ul>` : ''}
      <h3 class="sh-h3">${f.accessory ? 'Articoli in questa pagina' : 'Versioni'}</h3>
      <ul class="variants">${items.filter(p => !focus || p.key !== focus.key).map(p => rowHTML(p)).join('')}</ul>
      ${f.features && f.features.length ? `
        <details class="feats"><summary>Caratteristiche (${f.features.length})</summary>
          <ul>${f.features.map(t => `<li>${esc(t)}</li>`).join('')}</ul>
        </details>` : ''}
      ${accs.length ? `
        <h3 class="sh-h3">Accessori consigliati</h3>
        <ul class="variants">${accs.slice(0, 40).map(p => rowHTML(p)).join('')}</ul>
        ${accs.length > 40 ? `<p class="hint">Altri ${accs.length - 40} accessori nella sezione Cerca.</p>` : ''}` : ''}`;
    openSheet(html);
    drawFigure(f.page, focus);
  }

  function suggestedAccessories(f) {
    if (f.accessory) return [];
    const cat = S.catalog;
    let subName = null;
    if (f.optionalPage) {
      const target = cat.families['p' + f.optionalPage];
      if (target) subName = target.sub;
    }
    let list;
    if (subName) list = cat.products.filter(p => p.accessory && fam(p.family).sub === subName);
    else list = cat.products.filter(p => p.accessory && p.activity === f.activity && p.vehicles.some(v => f.vehicles.includes(v)) && fam(p.family).accessory);
    return list;
  }

  let figZoom = 1;
  async function drawFigure(pageNo, focus) {
    figZoom = 1;
    const canvas = $('#fig-canvas');
    const scroller = $('#fig-scroll');
    if (!canvas || !scroller) return;
    const w = scroller.clientWidth || 340;
    try {
      $('#fig-inner').style.width = '100%';
      await PdfView.page(pageNo, w * figZoom, canvas);
      if (focus && focus.band) {
        const top = focus.band.y0 * canvas.clientHeight - 24;
        scroller.scrollTop = Math.max(0, top);
      }
    } catch (e) {
      const st = $('#fig-status');
      if (st) st.textContent = 'Figura non disponibile: ricarica il listino dalle impostazioni.';
      canvas.remove();
    }
  }
  async function toggleZoom() {
    const canvas = $('#fig-canvas');
    const scroller = $('#fig-scroll');
    if (!canvas || !scroller) return;
    figZoom = figZoom === 1 ? 2.2 : 1;
    const inner = $('#fig-inner');
    const ratioY = scroller.scrollTop / (scroller.scrollHeight || 1);
    const w = scroller.clientWidth;
    inner.style.width = (figZoom * 100) + '%';
    $('#fig-zoom').textContent = figZoom === 1 ? 'Ingrandisci' : 'Riduci';
    const pageNo = Number((canvas.getAttribute('aria-label') || '').replace(/\D/g, ''));
    if (pageNo) await PdfView.page(pageNo, w * figZoom, canvas);
    scroller.scrollTop = ratioY * scroller.scrollHeight;
  }

  /* ---------- miniature ---------- */
  let thumbObserver = null;
  function hydrateThumbs(root) {
    const imgs = $$('img[data-thumb-page]', root);
    if (!imgs.length) return;
    if (!thumbObserver) {
      thumbObserver = new IntersectionObserver(entries => {
        for (const e of entries) {
          if (!e.isIntersecting) continue;
          const img = e.target;
          thumbObserver.unobserve(img);
          const [x0, x1, y0, y1] = img.dataset.crop.split(',').map(Number);
          PdfView.thumb(Number(img.dataset.thumbPage), { x0, x1, y0, y1 }, Number(img.dataset.w) || 120)
            .then(url => { img.src = url; img.classList.add('ready'); })
            .catch(() => { img.closest('.thumb') && img.closest('.thumb').classList.add('thumb-missing'); });
        }
      }, { rootMargin: '200px' });
    }
    imgs.forEach(i => thumbObserver.observe(i));
  }

  /* ---------- preventivo ---------- */
  function addToQuote(key) {
    const p = S.byKey.get(key);
    if (!p) return;
    const ex = S.quote.items.find(i => i.key === key && !i.custom);
    if (ex) ex.qty += 1;
    else S.quote.items.push({ id: uid(), key, code: p.code, name: p.name, power: p.power, price: p.price, qty: 1, disc: '', page: p.page, family: fam(p.family).title });
    saveDraft();
    vibrate();
    refreshAddButtons(key);
    updateQuoteBar();
    toast(`Aggiunto: ${p.code}`);
  }

  function refreshAddButtons(key) {
    const p = S.byKey.get(key);
    $$(`.add[data-key="${CSS.escape(key)}"]`).forEach(b => { b.outerHTML = addBtn(p); });
  }

  function updateQuoteBar() {
    const bar = $('#quote-bar');
    const badge = $('#tab-badge');
    const t = S.quote ? totals() : { lines: 0 };
    badge.hidden = !t.lines;
    badge.textContent = t.lines || '';
    const show = t.lines > 0 && (S.view === 'config' || S.view === 'search') && !S.loading;
    bar.hidden = !show;
    document.body.classList.toggle('has-bar', show);
    if (show) {
      $('#qb-count').textContent = `${t.lines} ${t.lines === 1 ? 'articolo' : 'articoli'} nel preventivo`;
      $('#qb-total').textContent = money(t.net);
    }
  }

  function quoteHTML() {
    const q = S.quote;
    const t = totals();
    const gd = parseDisc(q.globalDisc);
    return `
      <div class="quote">
        <section class="q-head">
          <div class="q-titlebar">
            <h1 class="q-title">${q.number ? `Preventivo ${esc(q.number)}` : 'Nuovo preventivo'}</h1>
            <span class="muted">${new Date(q.date).toLocaleDateString('it-IT')}</span>
          </div>
          <label class="field"><span>Cliente</span><input data-q="customer" value="${esc(q.customer)}" placeholder="Ragione sociale o nome" autocomplete="organization"></label>
          <label class="field"><span>Riferimento</span><input data-q="reference" value="${esc(q.reference)}" placeholder="Es. officina di Mario, richiesta del 7/10"></label>
        </section>

        ${q.items.length ? `
        <section class="q-disc">
          <label class="field field-disc ${gd.valid ? '' : 'invalid'}">
            <span>Sconto generale %</span>
            <input data-q="globalDisc" inputmode="decimal" value="${esc(q.globalDisc)}" placeholder="0">
          </label>
          <div class="chips chips-tight">
            ${[0, 10, 15, 20, 25, 30, 35, 40].map(v => `<button class="chip ${String(q.globalDisc) === String(v) || (!q.globalDisc && v === 0) ? 'on' : ''}" data-action="quick-disc" data-v="${v}">${v}%</button>`).join('')}
          </div>
          <p class="hint">Per gli sconti in cascata scrivi per esempio 30+5. Ogni riga può avere uno sconto diverso.</p>
        </section>

        <ul class="q-lines">${q.items.map(lineHTML).join('')}</ul>` : `
        <section class="empty-quote">
          <p class="w-text">Il preventivo è vuoto.</p>
          <div class="row-btns">
            <button class="btn btn-signal" data-action="go" data-view="config">Configura</button>
            <button class="btn btn-ghost" data-action="go" data-view="search">Cerca per codice</button>
          </div>
        </section>`}

        <button class="btn btn-ghost btn-wide" data-action="add-custom">Aggiungi voce libera</button>

        ${q.items.length ? `
        <section class="totals" id="totals">${totalsHTML(t)}</section>
        <label class="switch"><input type="checkbox" data-action="vat" ${q.vatOn ? 'checked' : ''}><span class="sw"></span> Mostra IVA ${esc(S.settings.vat)}% e totale ivato</label>
        <label class="switch"><input type="checkbox" data-action="img-toggle" ${showImages() ? 'checked' : ''}><span class="sw"></span> Immagini nel preventivo stampato</label>
        <label class="field"><span>Note per il cliente</span><textarea data-q="notes" rows="3">${esc(q.notes)}</textarea></label>
        <div class="q-actions">
          <button class="btn btn-signal" data-action="save-quote">${q.id ? 'Salva modifiche' : 'Salva preventivo'}</button>
          <button class="btn btn-dark" data-action="print">Stampa o PDF</button>
          <button class="btn btn-dark" data-action="share">Condividi</button>
          <button class="btn btn-ghost" data-action="new-quote">Nuovo</button>
        </div>` : ''}
      </div>`;
  }

  function lineHTML(it) {
    const d = lineDisc(it);
    const own = it.disc != null && String(it.disc).trim() !== '';
    const gd = parseDisc(S.quote.globalDisc);
    return `
      <li class="qline" data-id="${it.id}">
        <div class="ql-top">
          <span class="v-code">${esc(it.code || 'Voce libera')}</span>
          <button class="icon-btn icon-sm" data-action="remove-line" data-id="${it.id}" aria-label="Rimuovi riga">
            <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
          </button>
        </div>
        <div class="ql-body">
          ${(() => { const c = itemCrop(it); return c ? `<button class="ql-thumb thumb" data-action="open-product" data-key="${esc(it.key)}" aria-label="Vedi figura di ${esc(it.code)}">${thumbImg(c, 84)}</button>` : ''; })()}
          <p class="ql-name">${esc(it.name)}${it.power ? ` <span class="muted">${esc(it.power)}</span>` : ''}</p>
        </div>
        <div class="ql-ctrl">
          <div class="stepper">
            <button data-action="qty" data-id="${it.id}" data-d="-1" aria-label="Meno">−</button>
            <input data-line="qty" data-id="${it.id}" inputmode="numeric" value="${it.qty}" aria-label="Quantità">
            <button data-action="qty" data-id="${it.id}" data-d="1" aria-label="Più">+</button>
          </div>
          <label class="ql-disc ${d.valid ? '' : 'invalid'}">
            <span>Sconto riga %</span>
            <input data-line="disc" data-id="${it.id}" inputmode="decimal" value="${esc(it.disc)}" placeholder="${gd.valid ? pct.format(gd.pct) : '0'}">
          </label>
        </div>
        <div class="ql-money">
          <span class="ql-gross" data-out="gross-${it.id}">${money(it.price)} × ${it.qty}${d.pct ? `, sconto ${pct.format(d.pct)}%${own ? '' : ' (generale)'}` : ''}</span>
          <span class="ql-net" data-out="net-${it.id}">${money(lineNet(it))}</span>
        </div>
      </li>`;
  }

  function totalsHTML(t) {
    return `
      <div class="t-row"><span>Totale di listino</span><span>${money(t.gross)}</span></div>
      <div class="t-row t-disc"><span>Sconto${t.discPct ? ` (${pct.format(t.discPct)}%)` : ''}</span><span>${t.disc ? '− ' + money(t.disc) : money(0)}</span></div>
      <div class="t-row t-net"><span>Totale netto${S.quote.vatOn ? ' imponibile' : ''}</span><span>${money(t.net)}</span></div>
      ${S.quote.vatOn ? `
        <div class="t-row"><span>IVA ${esc(S.settings.vat)}%</span><span>${money(t.vat)}</span></div>
        <div class="t-row t-total"><span>Totale IVA inclusa</span><span>${money(t.total)}</span></div>` : '<p class="hint">IVA esclusa</p>'}`;
  }

  function refreshQuoteNumbers() {
    const t = totals();
    for (const it of S.quote.items) {
      const d = lineDisc(it);
      const own = it.disc != null && String(it.disc).trim() !== '';
      const g = $(`[data-out="gross-${it.id}"]`);
      const n = $(`[data-out="net-${it.id}"]`);
      if (g) g.textContent = `${money(it.price)} × ${it.qty}${d.pct ? `, sconto ${pct.format(d.pct)}%${own ? '' : ' (generale)'}` : ''}`;
      if (n) n.textContent = money(lineNet(it));
      const inp = $(`input[data-line="disc"][data-id="${it.id}"]`);
      if (inp) {
        const gd = parseDisc(S.quote.globalDisc);
        inp.placeholder = gd.valid ? pct.format(gd.pct) : '0';
        inp.closest('.ql-disc').classList.toggle('invalid', !d.valid);
      }
    }
    const tot = $('#totals');
    if (tot) tot.innerHTML = totalsHTML(t);
    const gdField = $('.field-disc');
    if (gdField) gdField.classList.toggle('invalid', !parseDisc(S.quote.globalDisc).valid);
    $$('[data-action="quick-disc"]').forEach(b => b.classList.toggle('on', String(S.quote.globalDisc) === b.dataset.v || (!S.quote.globalDisc && b.dataset.v === '0')));
    updateQuoteBar();
  }

  function nextNumber() {
    const y = new Date().getFullYear();
    if (S.settings.counterYear !== y) { S.settings.counterYear = y; S.settings.counter = 0; }
    S.settings.counter += 1;
    saveSettings();
    return `${y}/${String(S.settings.counter).padStart(3, '0')}`;
  }

  async function saveQuote() {
    const q = S.quote;
    if (!q.items.length) return;
    if (!q.id) { q.id = uid(); q.number = nextNumber(); }
    q.savedAt = new Date().toISOString();
    q.totals = totals();
    await Store.set('quotes', null, JSON.parse(JSON.stringify(q)));
    saveDraft();
    render();
    toast(`Preventivo ${q.number} salvato`);
  }

  function shareText() {
    const q = S.quote;
    const t = totals();
    const lines = q.items.map(it => {
      const d = lineDisc(it);
      return `• ${it.code ? it.code + ' ' : ''}${it.name}${it.qty > 1 ? ` (x${it.qty})` : ''}\n  ${money(it.price * it.qty)}${d.pct ? ` − ${pct.format(d.pct)}% = ${money(lineNet(it))}` : ''}`;
    });
    return [
      `Preventivo${q.number ? ' ' + q.number : ''}${q.customer ? ' per ' + q.customer : ''}`,
      new Date(q.date).toLocaleDateString('it-IT'),
      '',
      ...lines,
      '',
      `Totale di listino: ${money(t.gross)}`,
      t.disc ? `Sconto: − ${money(t.disc)}` : null,
      `Totale netto: ${money(t.net)}${q.vatOn ? '' : ' + IVA'}`,
      q.vatOn ? `Totale IVA ${S.settings.vat}% inclusa: ${money(t.total)}` : null,
      q.notes ? '\n' + q.notes : null,
      S.settings.seller ? '\n' + S.settings.seller : null
    ].filter(x => x !== null).join('\n');
  }

  async function shareQuote() {
    const text = shareText();
    if (navigator.share) {
      try { await navigator.share({ title: 'Preventivo', text }); return; } catch (e) { if (e && e.name === 'AbortError') return; }
    }
    openSheet(`
      <header class="sh-head"><h2 id="sheet-title" class="sh-title">Condividi</h2></header>
      <textarea class="share-text" rows="12" readonly>${esc(text)}</textarea>
      <div class="q-actions">
        <button class="btn btn-signal" data-action="copy-share">Copia testo</button>
        <a class="btn btn-dark" href="https://wa.me/?text=${encodeURIComponent(text)}" target="_blank" rel="noopener">WhatsApp</a>
        <a class="btn btn-dark" href="mailto:?subject=${encodeURIComponent('Preventivo' + (S.quote.number ? ' ' + S.quote.number : ''))}&body=${encodeURIComponent(text)}">Email</a>
      </div>`);
  }

  let printing = false;
  async function printQuote() {
    if (printing) return;
    printing = true;
    const q = S.quote;
    const t = totals();
    const st = S.settings;
    const withImg = showImages() && q.items.some(it => itemCrop(it));
    const imgs = {};
    if (withImg) {
      toast('Preparo le immagini…');
      await Promise.all(q.items.map(async it => {
        const c = itemCrop(it);
        if (!c) return;
        try { imgs[it.id] = await PdfView.thumb(c.page, c, PRINT_W); } catch (e) { /* figura non disponibile */ }
      }));
    }
    const valid = new Date(new Date(q.date).getTime() + (Number(st.validity) || 30) * 86400000);
    $('#print-area').innerHTML = `
      <div class="pr">
        <header class="pr-head">
          <div class="pr-company">${esc(st.company || '').replace(/\n/g, '<br>')}</div>
          <div class="pr-meta">
            <h1>Preventivo${q.number ? ' ' + esc(q.number) : ''}</h1>
            <p>Data ${new Date(q.date).toLocaleDateString('it-IT')}<br>Valido fino al ${valid.toLocaleDateString('it-IT')}</p>
          </div>
        </header>
        ${q.customer || q.reference ? `<section class="pr-cust"><p class="pr-lbl">Cliente</p><p><b>${esc(q.customer)}</b>${q.reference ? '<br>' + esc(q.reference) : ''}</p></section>` : ''}
        <table class="pr-table">
          <thead><tr>${withImg ? '<th class="pr-img"></th>' : ''}<th>Codice</th><th>Descrizione</th><th class="r">Q.tà</th><th class="r">Listino</th><th class="r">Sconto</th><th class="r">Netto</th></tr></thead>
          <tbody>
            ${q.items.map(it => { const d = lineDisc(it); return `<tr>${withImg ? `<td class="pr-img">${imgs[it.id] ? `<img src="${imgs[it.id]}" alt="">` : ''}</td>` : ''}<td>${esc(it.code)}</td><td>${esc(it.name)}${it.power ? `<br><small>${esc(it.power)}</small>` : ''}</td><td class="r">${it.qty}</td><td class="r">${money(it.price)}</td><td class="r">${d.pct ? pct.format(d.pct) + '%' : ''}</td><td class="r">${money(lineNet(it))}</td></tr>`; }).join('')}
          </tbody>
        </table>
        <section class="pr-tot">
          <div><span>Totale di listino</span><span>${money(t.gross)}</span></div>
          ${t.disc ? `<div><span>Sconto</span><span>− ${money(t.disc)}</span></div>` : ''}
          <div class="pr-strong"><span>Totale netto${q.vatOn ? ' imponibile' : ' (IVA esclusa)'}</span><span>${money(t.net)}</span></div>
          ${q.vatOn ? `<div><span>IVA ${esc(st.vat)}%</span><span>${money(t.vat)}</span></div><div class="pr-strong"><span>Totale IVA inclusa</span><span>${money(t.total)}</span></div>` : ''}
        </section>
        ${q.notes ? `<section class="pr-notes">${esc(q.notes).replace(/\n/g, '<br>')}</section>` : ''}
        ${st.seller ? `<footer class="pr-foot">${esc(st.seller).replace(/\n/g, '<br>')}</footer>` : ''}
      </div>`;
    const prevTitle = document.title;
    document.title = `Preventivo ${q.number ? q.number.replace('/', '-') : ''} ${q.customer || ''}`.trim();
    // aspetto che le immagini siano pronte prima di aprire la stampa
    await Promise.all($$('#print-area img').map(img => (img.decode ? img.decode() : Promise.resolve()).catch(() => {})));
    setTimeout(() => { window.print(); document.title = prevTitle; printing = false; }, 60);
  }

  function customLineSheet() {
    openSheet(`
      <header class="sh-head"><h2 id="sheet-title" class="sh-title">Voce libera</h2><p class="sh-sub">Per trasporto, installazione, formazione o articoli fuori listino.</p></header>
      <div class="form">
        <label class="field"><span>Descrizione</span><input id="cl-name" placeholder="Es. Trasporto e installazione"></label>
        <label class="field"><span>Codice (facoltativo)</span><input id="cl-code" placeholder=""></label>
        <label class="field"><span>Prezzo di listino €</span><input id="cl-price" inputmode="decimal" placeholder="0,00"></label>
        <label class="field"><span>Quantità</span><input id="cl-qty" inputmode="numeric" value="1"></label>
        <button class="btn btn-signal btn-wide" data-action="custom-save">Aggiungi al preventivo</button>
      </div>`);
    setTimeout(() => { const i = $('#cl-name'); i && i.focus(); }, 250);
  }
  function customLineSave() {
    const name = $('#cl-name').value.trim();
    const price = Number(String($('#cl-price').value).replace(/\./g, '').replace(',', '.'));
    const qty = Math.max(1, parseInt($('#cl-qty').value, 10) || 1);
    if (!name) { toast('Scrivi una descrizione'); return; }
    if (!isFinite(price) || price < 0) { toast('Prezzo non valido'); return; }
    S.quote.items.push({ id: uid(), key: null, custom: true, code: $('#cl-code').value.trim(), name, power: '', price, qty, disc: '0' });
    saveDraft();
    closeSheet();
    render();
  }

  /* ---------- archivio ---------- */
  async function archiveRender() {
    const list = (await Store.all('quotes')).sort((a, b) => (b.savedAt || '').localeCompare(a.savedAt || ''));
    if (S.view !== 'archive') return;
    $('#view').innerHTML = `
      <div class="archive">
        <h1 class="q-title">Preventivi salvati</h1>
        ${list.length ? `<ul class="arch-list">${list.map(q => `
          <li class="arch">
            <button class="arch-main" data-action="open-quote" data-id="${q.id}">
              <span class="arch-num">${esc(q.number)}</span>
              <span class="arch-cust">${esc(q.customer || 'Senza cliente')}</span>
              <span class="muted">${new Date(q.date).toLocaleDateString('it-IT')}, ${q.items.length} ${q.items.length === 1 ? 'riga' : 'righe'}</span>
            </button>
            <span class="arch-side">
              <span class="v-price">${money(q.totals ? q.totals.net : 0)}</span>
              <span class="arch-btns">
                <button class="btn btn-ghost btn-sm" data-action="dup-quote" data-id="${q.id}">Duplica</button>
                <button class="btn btn-ghost btn-sm danger" data-action="del-quote" data-id="${q.id}">Elimina</button>
              </span>
            </span>
          </li>`).join('')}</ul>` : '<p class="empty">Nessun preventivo salvato. Quelli che salvi restano su questo telefono.</p>'}
      </div>`;
  }

  async function openQuote(id, duplicate) {
    const q = await Store.get('quotes', id);
    if (!q) return;
    if (duplicate) {
      Object.assign(q, { id: null, number: null, date: new Date().toISOString(), savedAt: null });
      q.items = q.items.map(i => Object.assign({}, i, { id: uid() }));
    }
    S.quote = q;
    saveDraft();
    S.view = 'quote';
    render();
    if (duplicate) toast('Copia creata: modificala e salvala');
  }

  /* ---------- impostazioni ---------- */
  function settingsSheet() {
    const st = S.settings;
    const c = S.catalog;
    openSheet(`
      <header class="sh-head"><h2 id="sheet-title" class="sh-title">Impostazioni</h2></header>
      <section class="set-block">
        <h3 class="sh-h3">Listino</h3>
        ${c ? `
          <p><b>${esc(c.title)}</b><br><span class="muted">${esc(c.fileName || '')}, ${c.pages} pagine, ${c.products.length} articoli, caricato il ${new Date(c.parsedAt).toLocaleDateString('it-IT')}</span></p>` : '<p class="muted">Nessun listino caricato.</p>'}
        <p class="privacy">Il listino resta solo su questo telefono. L'app lo legge in locale e non lo invia a nessun server.</p>
        <div class="row-btns">
          <button class="btn btn-signal" data-action="pick-file">${c ? 'Sostituisci listino' : 'Carica listino PDF'}</button>
          ${c ? '<button class="btn btn-ghost danger" data-action="remove-listino">Rimuovi dal telefono</button>' : ''}
        </div>
      </section>
      <section class="set-block form">
        <h3 class="sh-h3">Intestazione del preventivo</h3>
        <label class="field"><span>Azienda e contatti</span><textarea data-s="company" rows="4" placeholder="Ragione sociale&#10;Indirizzo&#10;P.IVA, telefono, email">${esc(st.company)}</textarea></label>
        <label class="field"><span>Firma del venditore</span><textarea data-s="seller" rows="2" placeholder="Nome, cellulare">${esc(st.seller)}</textarea></label>
      </section>
      <section class="set-block form">
        <h3 class="sh-h3">Valori predefiniti</h3>
        <div class="two">
          <label class="field"><span>IVA %</span><input data-s="vat" inputmode="decimal" value="${esc(st.vat)}"></label>
          <label class="field"><span>Validità giorni</span><input data-s="validity" inputmode="numeric" value="${esc(st.validity)}"></label>
        </div>
        <label class="field"><span>Sconto predefinito %</span><input data-s="defaultDisc" inputmode="decimal" value="${esc(st.defaultDisc)}" placeholder="Es. 20 o 30+5"></label>
        <label class="field"><span>Note standard</span><textarea data-s="notes" rows="3">${esc(st.notes)}</textarea></label>
      </section>
      <p class="muted small">Listino in tasca ${APP_VERSION}. Dati salvati solo in questo browser.</p>`);
  }

  async function removeListino() {
    if (!confirm('Rimuovere il listino da questo telefono? I preventivi salvati restano.')) return;
    await Store.del('files', 'listino');
    await Store.del('kv', 'catalog');
    PdfView.reset();
    S.catalog = null;
    S.byKey.clear();
    updateHeader();
    closeSheet();
    S.view = 'config';
    render();
    toast('Listino rimosso');
  }

  /* ---------- sheet ---------- */
  let sheetOpen = false;
  function openSheet(html) {
    $('#sheet-body').innerHTML = html;
    const sh = $('#sheet');
    sh.hidden = false;
    requestAnimationFrame(() => sh.classList.add('show'));
    document.body.classList.add('no-scroll');
    $('.sheet-panel').scrollTop = 0;
    if (!sheetOpen) { history.pushState({ sheet: true }, ''); sheetOpen = true; }
    hydrateThumbs($('#sheet-body'));
  }
  function closeSheet(silent) {
    const sh = $('#sheet');
    if (sh.hidden) return;
    sh.classList.remove('show');
    document.body.classList.remove('no-scroll');
    setTimeout(() => { sh.hidden = true; $('#sheet-body').innerHTML = ''; }, 220);
    if (sheetOpen) { sheetOpen = false; if (!silent && history.state && history.state.sheet) history.back(); }
  }
  window.addEventListener('popstate', () => { if (sheetOpen) { sheetOpen = false; closeSheet(true); } });

  /* ---------- toast ---------- */
  let toastT;
  function toast(msg) {
    const t = $('#toast');
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(toastT);
    toastT = setTimeout(() => t.classList.remove('show'), 1700);
  }

  /* ---------- eventi ---------- */
  document.addEventListener('click', async e => {
    const el = e.target.closest('[data-action]');
    if (!el) return;
    const a = el.dataset.action;
    if (el.tagName === 'INPUT') return; // gestiti da change
    switch (a) {
      case 'go':
        closeSheet();
        S.view = el.dataset.view;
        render();
        window.scrollTo(0, 0);
        break;
      case 'pick-file': $('#file-input').click(); break;
      case 'open-settings': settingsSheet(); break;
      case 'close-sheet': closeSheet(); break;
      case 'cfg-open': S.cfg.open = S.cfg.open === el.dataset.step ? null : el.dataset.step; render(); break;
      case 'cfg-vehicle':
        S.cfg.vehicle = el.dataset.id || null;
        S.cfg.open = 'activity';
        if (S.cfg.activity && !S.catalog.products.some(p => !p.accessory && p.activity === S.cfg.activity && (!S.cfg.vehicle || p.vehicles.includes(S.cfg.vehicle)))) S.cfg.activity = null;
        S.cfg.sel = {};
        render();
        break;
      case 'cfg-activity':
        S.cfg.activity = el.dataset.id;
        S.cfg.open = 'needs';
        S.cfg.sel = {};
        render();
        break;
      case 'cfg-chip': {
        const g = el.dataset.g, id = el.dataset.id;
        const arr = S.cfg.sel[g] || (S.cfg.sel[g] = []);
        const i = arr.indexOf(id);
        if (i >= 0) arr.splice(i, 1); else arr.push(id);
        const y = window.scrollY;
        render();
        window.scrollTo(0, y);
        break;
      }
      case 'cfg-clear': S.cfg.sel = {}; render(); break;
      case 'open-family': openFamily(el.dataset.fam); break;
      case 'open-product': { const p = S.byKey.get(el.dataset.key); if (p) openFamily(p.family, p.key); break; }
      case 'add': addToQuote(el.dataset.key); break;
      case 'fig-zoom': toggleZoom(); break;
      case 'section':
        S.search.section = { from: Number(el.dataset.from), to: Number(el.dataset.to), name: el.dataset.name };
        $('#search-results').innerHTML = searchResultsHTML();
        window.scrollTo(0, 0);
        break;
      case 'section-clear': S.search.section = null; $('#search-results').innerHTML = searchResultsHTML(); break;
      case 'quick-disc': {
        S.quote.globalDisc = el.dataset.v === '0' ? '' : el.dataset.v;
        const gi = $('[data-q="globalDisc"]');
        if (gi) gi.value = S.quote.globalDisc;
        saveDraft();
        refreshQuoteNumbers();
        break;
      }
      case 'qty': {
        const it = S.quote.items.find(i => i.id === el.dataset.id);
        if (!it) break;
        it.qty = Math.max(1, it.qty + Number(el.dataset.d));
        const inp = $(`input[data-line="qty"][data-id="${it.id}"]`);
        if (inp) inp.value = it.qty;
        saveDraft();
        refreshQuoteNumbers();
        break;
      }
      case 'remove-line': {
        const idx = S.quote.items.findIndex(i => i.id === el.dataset.id);
        if (idx < 0) break;
        const [removed] = S.quote.items.splice(idx, 1);
        saveDraft();
        render();
        toast(`Rimosso: ${removed.code || removed.name}`);
        break;
      }
      case 'add-custom': customLineSheet(); break;
      case 'custom-save': customLineSave(); break;
      case 'save-quote': saveQuote(); break;
      case 'print': printQuote(); break;
      case 'share': shareQuote(); break;
      case 'copy-share': {
        const ta = $('.share-text');
        try { await navigator.clipboard.writeText(ta.value); toast('Testo copiato'); }
        catch (err) { ta.select(); document.execCommand('copy'); toast('Testo copiato'); }
        break;
      }
      case 'new-quote':
        if (S.quote.items.length && !S.quote.savedAt && !confirm('Il preventivo attuale non è salvato. Iniziarne uno nuovo?')) break;
        S.quote = newQuote();
        saveDraft();
        render();
        break;
      case 'open-quote': openQuote(el.dataset.id); break;
      case 'dup-quote': openQuote(el.dataset.id, true); break;
      case 'del-quote':
        if (!confirm('Eliminare questo preventivo dal telefono?')) break;
        await Store.del('quotes', el.dataset.id);
        if (S.quote.id === el.dataset.id) { S.quote.id = null; S.quote.number = null; S.quote.savedAt = null; saveDraft(); }
        archiveRender();
        break;
      case 'remove-listino': removeListino(); break;
    }
  });

  document.addEventListener('change', e => {
    const el = e.target;
    if (el.id === 'file-input') { const f = el.files && el.files[0]; el.value = ''; loadPdfFile(f); return; }
    if (el.dataset.action === 'cfg-acc') { S.cfg.acc = el.checked; render(); return; }
    if (el.dataset.action === 'vat') { S.quote.vatOn = el.checked; saveDraft(); refreshQuoteNumbers(); return; }
    if (el.dataset.action === 'img-toggle') { S.quote.showImages = el.checked; saveDraft(); warmPrintImages(); return; }
    if (el.dataset.bindCfg === 'sort') { S.cfg.sort = el.value; render(); return; }
    if (el.dataset.line === 'qty') {
      const it = S.quote.items.find(i => i.id === el.dataset.id);
      if (it) { it.qty = Math.max(1, parseInt(el.value, 10) || 1); el.value = it.qty; saveDraft(); refreshQuoteNumbers(); }
    }
  });

  document.addEventListener('input', e => {
    const el = e.target;
    if (el.id === 'q') {
      S.search.q = el.value;
      if (el.value) S.search.section = null;
      renderSearchDebounced();
      return;
    }
    if (el.dataset.q) {
      S.quote[el.dataset.q] = el.value;
      saveDraft();
      if (el.dataset.q === 'globalDisc') refreshQuoteNumbers();
      return;
    }
    if (el.dataset.line) {
      const it = S.quote.items.find(i => i.id === el.dataset.id);
      if (!it) return;
      if (el.dataset.line === 'disc') it.disc = el.value;
      if (el.dataset.line === 'qty') { const v = parseInt(el.value, 10); if (v > 0) it.qty = v; }
      saveDraft();
      refreshQuoteNumbers();
      return;
    }
    if (el.dataset.s) {
      S.settings[el.dataset.s] = el.value;
      saveSettings();
    }
  });

  const renderSearchDebounced = debounce(() => {
    const box = $('#search-results');
    if (box) { box.innerHTML = searchResultsHTML(); hydrateThumbs(box); }
  }, 120);

  /* ---------- avvio ---------- */
  async function init() {
    try {
      const [cat, settings, draft] = await Promise.all([
        Store.get('kv', 'catalog'), Store.get('kv', 'settings'), Store.get('kv', 'draft')
      ]);
      if (settings) S.settings = Object.assign({}, DEFAULT_SETTINGS, settings);
      if (cat && cat.products) indexCatalog(cat);
      S.quote = draft && draft.items ? draft : newQuote();
      if (cat && cat.products && cat.parserVersion !== ListinoParser.PARSER_VERSION) {
        render();
        await upgradeCatalog(cat);
        return;
      }
    } catch (err) {
      console.error(err);
      S.quote = newQuote();
      toast('Archivio locale non disponibile in questa modalità del browser');
    }
    render();
  }

  if ('serviceWorker' in navigator && location.protocol !== 'file:') {
    window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
  }

  init();
})();
