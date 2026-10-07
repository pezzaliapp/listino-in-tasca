# Listino in tasca

Web app per smartphone (Android e iPhone) che crea preventivi a partire da un listino in PDF.

Il listino **non è dentro l'app e non viene mai caricato online**: si sceglie il PDF dal telefono, l'app lo legge in locale con pdf.js e salva i dati estratti solo nella memoria del browser (IndexedDB). Su GitHub c'è solo il codice.

## Cosa fa

- **Carica il listino** dal telefono e ne estrae codici, descrizioni, alimentazione e prezzi lordi, più l'indice delle sezioni.
- **Configuratore guidato** in tre passi: veicolo (auto, moto, truck), lavoro (equilibratura, smontaggio gomme, sollevamento, assetto ruote, altro), esigenze del cliente. I filtri delle esigenze (tipologia, caratteristiche come laser, NLS, RLC, motoinverter, leverless, alimentazione, fascia di prezzo) si costruiscono da soli in base ai prodotti trovati.
- **Ricerca** per codice o parole, oppure navigazione per sezioni del listino.
- **Scheda prodotto** con la pagina del listino disegnata dal PDF (con l'articolo evidenziato), versioni, caratteristiche e accessori consigliati.
- **Preventivo** con quantità, sconto generale, sconto per riga, sconti in cascata (es. `30+5`), voci libere, IVA opzionale.
- **Stampa o PDF**, **condivisione** (WhatsApp, email, copia testo) e **archivio** dei preventivi sul telefono.
- Funziona **offline** una volta aperta la prima volta.

## Pubblicazione su GitHub Pages

1. Copia tutti i file di questa cartella nella radice della repo e fai commit e push.
2. Su GitHub vai in *Settings → Pages*, scegli *Deploy from a branch*, branch `main`, cartella `/ (root)`.
3. Dopo un minuto l'app è su `https://pezzaliapp.github.io/listino-in-tasca/`.

Il file `.gitignore` esclude tutti i `*.pdf`, così il listino non può finire nella repo per errore.

## Installazione sul telefono

- **iPhone (Safari):** apri il link, tocca Condividi, poi *Aggiungi alla schermata Home*.
- **Android (Chrome):** apri il link, menu ⋮, poi *Installa app* o *Aggiungi a schermata Home*.

Al primo avvio tocca **Carica listino PDF** e scegli il file. La lettura di 96 pagine richiede pochi secondi.

## Note sulla privacy

- Il PDF viene letto dal browser sul dispositivo. Non esistono server, API o upload.
- Listino, preventivi e impostazioni stanno nell'IndexedDB del browser di quel telefono. Cancellando i dati del sito si cancellano anche loro.
- L'app chiede al browser l'archiviazione persistente. Su iPhone conviene comunque usarla dalla schermata Home: Safari può liberare i dati dei siti non usati per molte settimane.
- L'unica risorsa esterna sono i font Google Fonts; se vuoi zero richieste esterne puoi rimuovere le righe dei font in `index.html` (resta il font di sistema).

## Struttura

```
index.html            guscio dell'app
css/app.css           stile
js/parser.js          estrazione dei prodotti dal PDF
js/store.js           archivio locale (IndexedDB)
js/pdfview.js         disegno di figure e pagine dal PDF
js/app.js             interfaccia, configuratore, preventivo
lib/                  pdf.js 3.11.174 (Mozilla, licenza Apache 2.0)
sw.js                 service worker per l'uso offline
manifest.webmanifest  installazione come app
```

## Come legge il listino

Il parser cerca nelle pagine le righe con un **codice a 8 cifre** e un **prezzo** (`9.500,00 €` per le macchine, `65,00` nelle tabelle accessori). La descrizione è il testo nella colonna tra codice e prezzo, anche su più righe. Codici senza prezzo sulla propria riga vengono collegati al prezzo della riga vicina (varianti dello stesso articolo). Sezioni e sottosezioni arrivano dall'indice del PDF e servono per classificare veicolo e tipo di lavoro.

È tarato sull'impaginazione del listino attuale. Se un listino futuro cambia formato, va adattato `js/parser.js`.

## Aggiornare l'app

Quando modifichi i file, cambia la costante `VERSION` in `sw.js`: così i telefoni scaricano la nuova versione invece di usare quella in cache.
