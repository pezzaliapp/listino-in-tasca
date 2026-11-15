/*
 * Listino per gli agenti.
 * Calcola i prezzi di vendita (sconto d'acquisto + margine o ricarico) e
 * crea un file HTML unico, che funziona offline, con ricerca e preventivo.
 * Nel file finiscono SOLO i prezzi di vendita: niente prezzo di listino,
 * niente costo, niente margine, niente book dell'agente o disegni.
 */
(function (root) {
  'use strict';

  // "60", "50+10", "30,5" -> fattore moltiplicativo (sconti in cascata)
  function discFactor(str) {
    const s = String(str == null ? '' : str).replace(/%/g, '').replace(/\s/g, '').replace(/,/g, '.');
    if (!s) return { f: 1, ok: true };
    let f = 1;
    for (const p of s.split('+').filter(Boolean)) {
      const v = Number(p);
      if (!isFinite(v) || v < 0 || v >= 100) return { f: 1, ok: false };
      f *= 1 - v / 100;
    }
    return { f, ok: true };
  }
  const num = v => { const n = Number(String(v == null ? '' : v).replace(/%/g, '').replace(',', '.').trim()); return isFinite(n) ? n : NaN; };

  // Arrotondamento: all'euro intero; sotto i 10 € ai 10 centesimi
  function round(p) {
    if (!isFinite(p) || p <= 0) return 0;
    return p < 10 ? Math.round(p * 10) / 10 : Math.round(p);
  }

  /*
   * cfg = { buyDisc: '60', mode: 'margin' | 'markup' | 'list', value: '30' }
   *  - margin: margine sul prezzo di vendita  -> vendita = costo / (1 - m)
   *  - markup: ricarico sul costo             -> vendita = costo * (1 + r)
   *  - list:   sconto al cliente dal listino   -> vendita = listino * (1 - s)
   */
  function check(cfg) {
    const buy = discFactor(cfg.buyDisc);
    const v = num(cfg.value);
    if (!buy.ok) return 'Lo sconto d\'acquisto non è valido (es. 60 oppure 50+10).';
    if (cfg.mode !== 'list' && !String(cfg.buyDisc || '').trim()) return 'Scrivi lo sconto d\'acquisto che ti fa il fornitore.';
    if (!isFinite(v) || v < 0) return 'Scrivi un valore valido per ' + (cfg.mode === 'margin' ? 'il margine' : cfg.mode === 'markup' ? 'il ricarico' : 'lo sconto') + '.';
    if (cfg.mode === 'margin' && v >= 100) return 'Il margine deve essere inferiore al 100%.';
    if (cfg.mode === 'list' && v >= 100) return 'Lo sconto deve essere inferiore al 100%.';
    return null;
  }
  function price(listPrice, cfg) {
    const cost = listPrice * discFactor(cfg.buyDisc).f;
    const v = num(cfg.value) / 100;
    let sell;
    if (cfg.mode === 'margin') sell = cost / (1 - v);
    else if (cfg.mode === 'markup') sell = cost * (1 + v);
    else sell = listPrice * (1 - v);
    sell = round(sell);
    return { list: listPrice, cost, sell, margin: sell > 0 ? (sell - cost) / sell * 100 : 0 };
  }

  const escH = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  function buildHTML(cat, cfg, meta) {
    const fams = {};
    const products = [];
    for (const p of cat.products) {
      const f = cat.families[p.family] || {};
      if (!fams[p.family]) fams[p.family] = [f.title || '', f.main || '', f.sub || ''];
      products.push([p.code, p.name, p.power || '', p.family, price(p.price, cfg).sell]);
    }
    const data = {
      title: cat.title || 'Listino',
      date: new Date().toISOString().slice(0, 10),
      company: meta.company || '', seller: meta.seller || '', vat: Number(meta.vat) || 22,
      validity: Number(meta.validity) || 30, notes: meta.notes || '', maxDisc: Math.max(0, Math.min(100, num(meta.maxDisc) || 0)),
      id: (cat.parsedAt || '') + '|' + cfg.mode + cfg.value + cfg.buyDisc,
      fams, products
    };
    const json = JSON.stringify(data).replace(/</g, '\\u003c').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');
    return TEMPLATE.replace('__TITLE__', escH(data.title)).replace('__DATA__', () => json);
  }

  const TEMPLATE = `<!doctype html>
<html lang="it"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="theme-color" content="#18222B">
<title>__TITLE__ · Listino agenti</title>
<style>
:root{--ink:#18222B;--paper:#fff;--bg:#EDF0F2;--line:#D5DBE0;--muted:#5D6B77;--signal:#E8590C;--ok:#1F7A4D}
*{box-sizing:border-box}html{-webkit-text-size-adjust:100%}
body{margin:0;background:var(--bg);color:var(--ink);font:16px/1.45 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;padding-bottom:calc(90px + env(safe-area-inset-bottom))}
header{background:var(--ink);color:#fff;padding:calc(14px + env(safe-area-inset-top)) 16px 14px}
header h1{margin:0;font-size:19px;line-height:1.2}header p{margin:4px 0 0;font-size:13px;opacity:.75}
main{max-width:860px;margin:0 auto;padding:12px}
.search{position:sticky;top:0;z-index:5;background:var(--bg);padding:8px 0}
.search input{width:100%;font:inherit;font-size:17px;padding:13px 14px;border:1.5px solid var(--line);border-radius:12px;background:#fff}
.chips{display:flex;gap:8px;overflow-x:auto;padding:4px 0 8px;scrollbar-width:none}
.chip{flex:none;border:1.5px solid var(--line);background:#fff;border-radius:999px;padding:8px 14px;font:inherit;font-size:14px;font-weight:600;color:var(--ink)}
.chip.on{background:var(--ink);color:#fff;border-color:var(--ink)}
.count{font-size:13px;color:var(--muted);margin:2px 2px 8px}
.item{display:flex;gap:12px;align-items:center;background:#fff;border:1px solid var(--line);border-radius:14px;padding:12px 12px 12px 14px;margin-bottom:8px}
.item .t{flex:1;min-width:0}.item b{display:block;font-size:15px}.item small{display:block;color:var(--muted);font-size:13px}
.code{font-variant-numeric:tabular-nums;color:var(--muted);font-size:13px}
.pr{font-weight:800;font-size:17px;white-space:nowrap;font-variant-numeric:tabular-nums}
.add{flex:none;width:44px;height:44px;border-radius:12px;border:0;background:var(--signal);color:#fff;font-size:24px;font-weight:700}
.add.in{background:var(--ok);font-size:16px}
.bar{position:fixed;left:0;right:0;bottom:0;background:var(--ink);color:#fff;padding:12px 16px calc(12px + env(safe-area-inset-bottom));display:flex;align-items:center;gap:12px;z-index:9}
.bar span{flex:1;font-size:15px}.bar b{font-size:18px}
.btn{border:0;border-radius:12px;padding:13px 18px;font:inherit;font-weight:700;background:var(--signal);color:#fff;min-height:46px}
.btn.g{background:#fff;color:var(--ink);border:1.5px solid var(--line)}.btn.d{background:var(--ink)}
.sheet{position:fixed;inset:0;background:rgba(10,15,20,.5);z-index:20;display:none}
.sheet.on{display:block}
.panel{position:absolute;left:0;right:0;bottom:0;max-height:92vh;overflow:auto;background:var(--bg);border-radius:20px 20px 0 0;padding:16px 16px calc(20px + env(safe-area-inset-bottom))}
.panel h2{margin:4px 0 12px;font-size:20px}
.line{background:#fff;border:1px solid var(--line);border-radius:14px;padding:12px;margin-bottom:8px}
.line .r{display:flex;align-items:center;gap:10px;margin-top:8px}
.stp{display:flex;border:1.5px solid var(--line);border-radius:10px;overflow:hidden}
.stp button{width:42px;height:40px;border:0;background:#fff;font-size:20px}.stp input{width:52px;border:0;text-align:center;font:inherit;font-weight:700}
.del{margin-left:auto;border:0;background:none;color:#B42318;font-weight:700;font:inherit}
label.f{display:block;margin:10px 0 0;font-size:13px;font-weight:700;color:var(--muted)}
label.f input,label.f textarea{display:block;width:100%;margin-top:4px;font:inherit;font-size:16px;padding:11px 12px;border:1.5px solid var(--line);border-radius:10px;background:#fff;color:var(--ink)}
.tot{background:#fff;border:1px solid var(--line);border-radius:14px;padding:12px 14px;margin:12px 0}
.tot div{display:flex;justify-content:space-between;padding:3px 0}.tot .big{font-size:20px;font-weight:800;border-top:1px solid var(--line);margin-top:6px;padding-top:8px}
.acts{display:flex;flex-wrap:wrap;gap:10px}
.empty{color:var(--muted);text-align:center;padding:30px 10px}
.toast{position:fixed;left:50%;bottom:100px;transform:translateX(-50%);background:var(--ink);color:#fff;padding:10px 16px;border-radius:10px;font-size:14px;display:none;z-index:30}
#print{display:none}
@media print{body{background:#fff;padding:0}header,main,.bar,.sheet,.toast{display:none!important}#print{display:block;font-size:12px;color:#000}
#print table{width:100%;border-collapse:collapse}#print th,#print td{border-bottom:1px solid #ccc;padding:6px 4px;text-align:left;vertical-align:top}
#print td.n,#print th.n{text-align:right;white-space:nowrap}#print h1{font-size:18px;margin:0 0 4px}#print .hd{display:flex;justify-content:space-between;gap:20px;margin-bottom:14px;white-space:pre-line}}
</style></head><body>
<header><h1 id="h-title"></h1><p id="h-sub"></p></header>
<main>
  <div class="search"><input id="q" type="search" placeholder="Cerca codice, nome o famiglia…" autocomplete="off" enterkeyhint="search"></div>
  <div class="chips" id="chips"></div>
  <p class="count" id="count"></p>
  <div id="list"></div>
</main>
<div class="bar"><span>Preventivo: <b id="b-n">0</b> righe · <b id="b-tot">0 €</b></span><button class="btn" id="open-q">Apri</button></div>
<div class="sheet" id="sheet"><div class="panel" id="panel"></div></div>
<div class="toast" id="toast"></div>
<div id="print"></div>
<script id="data" type="application/json">__DATA__</script>
<script>
(function(){'use strict';
var D=JSON.parse(document.getElementById('data').textContent);
var $=function(s){return document.querySelector(s)};
var esc=function(s){return String(s==null?'':s).replace(/[&<>"']/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})};
var fmt;try{fmt=new Intl.NumberFormat('it-IT',{style:'currency',currency:'EUR',useGrouping:'always'})}catch(e){fmt=new Intl.NumberFormat('it-IT',{style:'currency',currency:'EUR'})}
var money=function(n){return fmt.format(Math.round((n||0)*100)/100)};
var norm=function(s){return String(s||'').toLowerCase().normalize('NFD').replace(/[\\u0300-\\u036f]/g,'')};
var P=D.products.map(function(r,i){var f=D.fams[r[3]]||['','',''];return{i:i,code:r[0],name:r[1],power:r[2],fam:f[0],main:f[1],sub:f[2],price:r[4],hay:norm([r[0],r[1],r[2],f[0],f[1],f[2]].join(' '))}});
var mains=[];P.forEach(function(p){if(p.main&&mains.indexOf(p.main)<0)mains.push(p.main)});
var KEY='listino-agenti:'+D.id, st={q:'',main:'',lines:[],client:'',notes:D.notes,disc:'',vat:false};
try{var sv=JSON.parse(localStorage.getItem(KEY)||'null');if(sv&&sv.lines)st=Object.assign(st,sv,{q:'',main:''})}catch(e){}
var save=function(){try{localStorage.setItem(KEY,JSON.stringify(st))}catch(e){}};
function toast(m){var t=$('#toast');t.textContent=m;t.style.display='block';clearTimeout(toast.t);toast.t=setTimeout(function(){t.style.display='none'},1800)}
$('#h-title').textContent=D.title;
$('#h-sub').textContent='Prezzi di vendita IVA esclusa · aggiornati al '+new Date(D.date).toLocaleDateString('it-IT')+' · '+P.length+' articoli';
function chips(){$('#chips').innerHTML=['<button class="chip'+(st.main?'':' on')+'" data-m="">Tutto</button>'].concat(mains.map(function(m){return'<button class="chip'+(st.main===m?' on':'')+'" data-m="'+esc(m)+'">'+esc(m)+'</button>'})).join('')}
function inQ(i){for(var k=0;k<st.lines.length;k++)if(st.lines[k].i===i)return st.lines[k];return null}
function list(){var w=norm(st.q).split(/\\s+/).filter(Boolean);var r=P.filter(function(p){if(st.main&&p.main!==st.main)return false;for(var k=0;k<w.length;k++)if(p.hay.indexOf(w[k])<0)return false;return true});
$('#count').textContent=r.length+' articoli'+(r.length>150?' · ne mostro 150, affina la ricerca':'');
$('#list').innerHTML=r.length?r.slice(0,150).map(function(p){var l=inQ(p.i);return'<div class="item"><div class="t"><span class="code">'+esc(p.code)+'</span><b>'+esc(p.name)+'</b><small>'+esc([p.fam,p.power].filter(Boolean).join(' · '))+'</small></div><div class="pr">'+money(p.price)+'</div><button class="add'+(l?' in':'')+'" data-add="'+p.i+'" aria-label="Aggiungi">'+(l?'×'+l.qty:'+')+'</button></div>'}).join(''):'<p class="empty">Nessun articolo trovato.</p>'}
function discF(){var v=Number(String(st.disc||'').replace(',','.'));if(!isFinite(v)||v<=0)return 1;return 1-Math.min(v,D.maxDisc)/100}
function tot(){var s=0;st.lines.forEach(function(l){s+=P[l.i].price*l.qty});var net=s*discF();var vat=st.vat?net*D.vat/100:0;return{gross:s,net:net,vat:vat,total:net+vat}}
function bar(){var t=tot();$('#b-n').textContent=st.lines.length;$('#b-tot').textContent=money(t.net)}
function quote(){var t=tot();var h='<h2>Preventivo</h2>';
if(!st.lines.length)h+='<p class="empty">Nessun articolo. Cerca un prodotto e premi +.</p>';
st.lines.forEach(function(l,k){var p=P[l.i];h+='<div class="line"><span class="code">'+esc(p.code)+'</span><b style="display:block">'+esc(p.name)+'</b><div class="r"><div class="stp"><button data-qd="'+k+'" data-d="-1">−</button><input data-qi="'+k+'" inputmode="numeric" value="'+l.qty+'"><button data-qd="'+k+'" data-d="1">+</button></div><b>'+money(p.price*l.qty)+'</b><button class="del" data-del="'+k+'">Togli</button></div></div>'});
h+='<label class="f">Cliente<input id="f-client" value="'+esc(st.client)+'" placeholder="Nome o ragione sociale"></label>';
if(D.maxDisc>0)h+='<label class="f">Sconto % (massimo '+D.maxDisc+'%)<input id="f-disc" inputmode="decimal" value="'+esc(st.disc)+'" placeholder="0"></label>';
h+='<label class="f">Note<textarea id="f-notes" rows="3">'+esc(st.notes)+'</textarea></label>';
h+='<label class="f" style="display:flex;gap:10px;align-items:center;font-size:15px;color:var(--ink)"><input type="checkbox" id="f-vat" style="width:auto;margin:0"'+(st.vat?' checked':'')+'> Mostra IVA '+D.vat+'%</label>';
h+='<div class="tot" id="tot">'+totHTML(t)+'</div>';
h+='<div class="acts"><button class="btn" id="a-print">Stampa o PDF</button><button class="btn d" id="a-share">Condividi</button><button class="btn g" id="a-new">Nuovo</button><button class="btn g" id="a-close">Chiudi</button></div>';
$('#panel').innerHTML=h}
function totHTML(t){var dd=discF()<1;return(dd?'<div><span>Totale listino agente</span><span>'+money(t.gross)+'</span></div><div><span>Sconto '+Math.min(Number(String(st.disc).replace(',','.')),D.maxDisc)+'%</span><span>− '+money(t.gross-t.net)+'</span></div>':'')+'<div class="'+(st.vat?'':'big')+'"><span>Totale IVA esclusa</span><span>'+money(t.net)+'</span></div>'+(st.vat?'<div><span>IVA '+D.vat+'%</span><span>'+money(t.vat)+'</span></div><div class="big"><span>Totale IVA inclusa</span><span>'+money(t.total)+'</span></div>':'')}
function text(){var t=tot();var L=[D.company?D.company.split('\\n')[0]:'','Preventivo'+(st.client?' per '+st.client:''),'Data: '+new Date().toLocaleDateString('it-IT'),''];
st.lines.forEach(function(l){var p=P[l.i];L.push(l.qty+' x '+p.code+' '+p.name+' = '+money(p.price*l.qty))});
L.push('');if(discF()<1)L.push('Sconto: '+st.disc+'%');L.push('Totale IVA esclusa: '+money(t.net));if(st.vat)L.push('Totale IVA '+D.vat+'% inclusa: '+money(t.total));
L.push('Validità: '+D.validity+' giorni');if(st.notes)L.push('',st.notes);if(D.seller)L.push('',D.seller);return L.filter(function(x,i){return x!==''||i>0}).join('\\n')}
function printHTML(){var t=tot();return'<div class="hd"><div><h1>Preventivo</h1>'+esc(new Date().toLocaleDateString('it-IT'))+(st.client?'<br><b>Cliente: '+esc(st.client)+'</b>':'')+'</div><div>'+esc(D.company)+'</div></div><table><thead><tr><th>Codice</th><th>Descrizione</th><th class="n">Q.tà</th><th class="n">Prezzo</th><th class="n">Totale</th></tr></thead><tbody>'+st.lines.map(function(l){var p=P[l.i];return'<tr><td>'+esc(p.code)+'</td><td>'+esc(p.name)+(p.power?'<br>'+esc(p.power):'')+'</td><td class="n">'+l.qty+'</td><td class="n">'+money(p.price)+'</td><td class="n">'+money(p.price*l.qty)+'</td></tr>'}).join('')+'</tbody></table><div class="tot" style="border:0">'+totHTML(t)+'</div><p>Validità dell\\'offerta: '+D.validity+' giorni. Prezzi IVA esclusa salvo diversa indicazione.</p>'+(st.notes?'<p style="white-space:pre-line">'+esc(st.notes)+'</p>':'')+(D.seller?'<p style="white-space:pre-line">'+esc(D.seller)+'</p>':'')}
function open(){quote();$('#sheet').classList.add('on')}function close(){$('#sheet').classList.remove('on');list()}
document.addEventListener('click',function(e){var b=e.target.closest('button');if(e.target.id==='sheet'){close();return}if(!b)return;
if(b.dataset.m!=null){st.main=b.dataset.m;chips();list();return}
if(b.dataset.add!=null){var i=+b.dataset.add,l=inQ(i);if(l)l.qty++;else st.lines.push({i:i,qty:1});save();bar();list();toast('Aggiunto al preventivo');return}
if(b.dataset.qd!=null){var x=st.lines[+b.dataset.qd];x.qty=Math.max(1,x.qty+(+b.dataset.d));save();bar();quote();return}
if(b.dataset.del!=null){st.lines.splice(+b.dataset.del,1);save();bar();quote();return}
if(b.id==='open-q')open();if(b.id==='a-close')close();
if(b.id==='a-new'){if(st.lines.length&&!confirm('Iniziare un nuovo preventivo?'))return;st.lines=[];st.client='';st.disc='';st.notes=D.notes;save();bar();quote()}
if(b.id==='a-print'){$('#print').innerHTML=printHTML();window.print()}
if(b.id==='a-share'){var tx=text();if(navigator.share){navigator.share({title:'Preventivo',text:tx}).catch(function(){})}else if(navigator.clipboard){navigator.clipboard.writeText(tx).then(function(){toast('Testo copiato')})}else prompt('Copia il testo',tx)}});
document.addEventListener('input',function(e){var el=e.target;
if(el.id==='q'){st.q=el.value;list();return}
if(el.dataset.qi!=null){var v=parseInt(el.value,10);if(v>0){st.lines[+el.dataset.qi].qty=v;save();bar()}return}
if(el.id==='f-client')st.client=el.value;if(el.id==='f-notes')st.notes=el.value;if(el.id==='f-disc'){var d=Number(String(el.value).replace(',','.'));if(d>D.maxDisc){el.value=D.maxDisc;toast('Sconto massimo '+D.maxDisc+'%')}st.disc=el.value}
if(el.id==='f-vat')st.vat=el.checked;save();bar();var tt=$('#tot');if(tt)tt.innerHTML=totHTML(tot())});
chips();list();bar();
})();
</script></body></html>`;

  root.ListinoAgenti = { discFactor, check, price, round, buildHTML };
})(self);
