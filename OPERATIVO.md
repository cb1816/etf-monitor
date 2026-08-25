# ETF Monitor — note operative

Complemento a **`METODOLOGIA.md`**, che resta la fonte di verità sull'impianto analitico.
Qui c'è il resto: il **livello di presentazione** (testata, PWA) e i **canali di scrittura**
verso il repo, con le lezioni che sono costate tempo.

> **Stato**: 25/08/2026. Questo file **assorbe** le due note che vivevano nel progetto Claude
> (`00_LEGGIMI_stato_e_prossimi_passi` e `pwa_e_testata`, del 20/08): erano scadute e
> duplicavano il repo. Una fonte di verità sola, e sta qui.

---

## 1. Testata

`app.js` scrive in `#cnt` la stringa `N strumenti · fonte · data`. Quella riga resta dov'è: nel
loader di `index.html`, sull'`onload` del tag `<script>` di `app.js`, gira una funzione `head(d)`
che la riscrive.

- `#cnt` → solo il conteggio, attenuato (`--mut`);
- `#asof` → `dati al gg/mm/aaaa`, in evidenza, **su una riga sua**;
- la **fonte esce dalla testata** — era lei a mangiare lo spazio e a spingere fuori la data — e
  finisce nel pannello Info, appesa in coda al foglio da un wrapper su `infoBtn.onclick` che
  chiama prima l'handler originale di `app.js`.

Titolo: **ETF-ETC-ETN Monitor** (prima ETF-ETN-ETP, che ometteva gli ETC). Verificato che a 320px
stia su una riga insieme al bottone "i". Header sticky con
`padding-top: calc(12px + env(safe-area-inset-top))`, così in standalone non finisce sotto la
status bar.

⚠️ **Due `itDate()` diverse, e non è un errore.** Quella nel loader di `index.html` normalizza
`meta.date`, che arriva già italiana da `toLocaleDateString('it-IT')` ma può uscire come
`20/8/2026`: mette gli zeri. Quella in `app.js` (§4 della metodologia) converte `meta.dataChiusura`,
che arriva in **ISO** da Morningstar. Chi le unifica deve gestire entrambi i formati.

Cosmetica non risolta: `Number(n).toLocaleString('it')` su un numero di 4 cifre non mette sempre il
separatore di migliaia (dipende dalla versione di ICU del browser). Comportamento identico a quello
che aveva `app.js` prima: non è una regressione.

---

## 2. PWA — installabile sulla home

File in root, tutti con percorsi **relativi** (`./`):

- `manifest.webmanifest` — `ETF Monitor` / short name `ETF`, `standalone`, `portrait`,
  background `#0b1220`, theme `#0f172a`, icone 192 e 512 (+ una `maskable`).
- `apple-touch-icon.png` (180), `icon-192.png`, `icon-512.png` — fondo `#0b1220`, **ETF** in
  **arancio `#ff7a45`** e **MONITOR** sotto in chiaro. L'arancio è deliberato: l'accento principale
  (`--accent #4f9cff`) è **lo stesso blu di OICR Monitor**, e con quello le due icone sarebbero
  indistinguibili sulla home. Generate a codice con PIL; lo script `make_icons.py` **non è stato
  committato** e va riscritto se serviranno di nuovo.
- `sw.js` — service worker **network-first**, mai cache-first: l'app legge dati live e un worker
  cache-first riporterebbe esattamente al problema che si stava risolvendo.

Nel `<head>`: `apple-mobile-web-app-capable`, `mobile-web-app-capable`,
`apple-mobile-web-app-status-bar-style=black` (**non** `black-translucent`: con la testata sticky
il contenuto finirebbe sotto l'orologio), `apple-mobile-web-app-title=ETF`, `apple-touch-icon`,
`manifest`. Registrazione del worker in fondo al body con `.catch(()=>{})`.

### Il worker e `app.js?v=N`

Prova la rete, aggiorna la copia in cache e serve la cache **solo** se la rete fallisce (per le
navigazioni ripiega su `./index.html`). Cache versionata `etf-monitor-v1`, pulizia in `activate`,
`skipWaiting()` + `clients.claim()`. La richiesta parte con `new Request(req, {cache:'no-cache'})`,
cioè **rivalida sempre col server**: misurato che, senza, un `app.js` modificato non veniva ripreso
al reload — ma succedeva identico a worker spento, quindi la colpa era della cache HTTP del browser.
**Se si tocca `sw.js`, alzare `CACHE`.** Il cache-bust `app.js?v=N` resta comunque obbligatorio
(§1 della metodologia).

---

## 3. Come si scrive nel repo

**`git push` dal container non funziona**: nessuna credenziale in sessione, e con il remoto HTTPS
si ferma su `could not read Username`. Riverificato il 25/08/2026. **`git clone` in lettura invece
funziona** ed è il modo giusto per leggere il codice, provarlo e **confrontare gli hash dopo il
commit**.

Quindi si scrive dal Chrome dell'utente, mai con download e upload manuali (i browser rinominano i
duplicati e su GitHub finiscono file nuovi invece di sovrascrivere).

**Editor web (CodeMirror)** — un file per commit, ottimo per il testo. Si naviga
`github.com/cb1816/etf-monitor/edit/main/<file>`, si aspettano ~4 s, si prende la view con
`document.querySelector('.cm-content').cmView?.view ?? .cmTile?.view`. Per le modifiche puntuali
conviene **calcolare gli indici sul documento originale e mandarle in un solo `dispatch`**, invece
di sostituire l'intero file: si spedisce solo il testo nuovo, non 40 KB.

```js
v.dispatch({changes:[{from:i, to:i+vecchio.length, insert:nuovo}, /* … */]});
```

**Verificare sempre lo SHA-256 del buffer prima di committare**, confrontandolo con quello del file
preparato in container:

```js
[...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(doc)))]
  .map(x=>x.toString(16).padStart(2,'0')).join('')
```

⚠️ La lunghezza **non** è un buon controllo: `doc.length` in JS conta in UTF-16, quindi ogni emoji
vale 2 e non torna con `len()` di Python. L'hash sì.

**Sequenza di commit**: click sull'apri-dialogo "Commit changes…" → attesa ~2 s → messaggio scritto
con il setter nativo
(`Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set` + evento `input`, o React
lo ignora) → click sul "Commit changes" **dentro il dialogo** → attesa ~9 s → conferma su
`location.pathname`, che passa da `/edit/` a `/blob/`.

**Pagina `upload/main`** — serve per i **file binari** e per mettere **più file in un commit solo**.
I file si iniettano costruendo `File` da base64 e assegnandoli all'input con un `DataTransfer`;
GitHub svuota `input.files` subito dopo, quindi la conferma è la lista sotto il dropzone, non il
valore dell'input. Il base64 va passato **a pezzi e verificato**: su blocchi da ~3 KB una parte è
arrivata troncata due volte su nove. Confrontare gli hash *prima* di committare e, in caso di
differenza, rifare l'hash a fette per trovare il pezzo da rispedire.

**Regola che vale sempre: chiedere conferma prima di ogni commit**, e verificare sul sito live
prima di dire che è fatto.

---

## 4. Verifica dopo il commit

1. `git clone --depth 1` del repo nel container e `sha256sum` dei file toccati: devono coincidere
   con quelli preparati.
2. Sito live (`etf-monitor-italia.vercel.app` o `-kappa`, stesso deploy): controllare che
   `document.scripts` serva `app.js?v=N` nuovo, che `window.DATA.meta` abbia i campi attesi, e
   guardare il pezzo di interfaccia che si è toccato.
3. Il banco di prova jsdom sta nel container, non nel repo: monta `index.html` senza i suoi
   `<script>`, inietta `app.js` con `DATA` costruito da `data/snapshot.json` + `data/series.json`
   passati per `upgradeSnapshot()`. Al 25/08/2026: 33 test, 0 falliti. Se diventerà stabile, vale
   la pena committarlo.
