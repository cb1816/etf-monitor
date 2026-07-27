# ETF Monitor — Metodologia e istruzioni operative

App gemella di OICR Monitor, dedicata agli ETF/ETP quotati su Borsa Italiana, con classifiche per categoria, momentum, accelerazione e schede fondo.

## Architettura

- Repo: https://github.com/cb1816/etf-monitor
- Sito: https://etf-monitor-italia.vercel.app — attenzione, `etf-monitor.vercel.app` è di un altro utente, non usarlo
- Deploy: Vercel, automatico a ogni commit su `main`; progetto `etf-monitor` nel team `cb1816s-projects`
- File: `index.html` (loader), `app.js` (interfaccia), `api/data.js` (dati)
- App gemella fondi: repo `oicr-monitor`, sito https://oicr-monitor.vercel.app. Le due app si linkano a vicenda con il pulsante fisso ⇄ in basso a destra.

## Dati (`api/data.js`)

**Fonte.** Screener Morningstar via `lt.morningstar.com/api/rest.svc/9vehuxllxs/security/screener`.
Il vecchio host `tools.morningstar.it` (chiave `klr5zyak8x`) è stato dismesso intorno al 21/07/2026: da browser redirige alla registrazione su global.morningstar.com, da server risponde 200 con corpo vuoto, da cui l'errore `Unexpected end of JSON input`. Stessa sorte per `tools.morningstar.co.uk`. L'host `lt.morningstar.com` è aperto, non richiede account e restituisce lo stesso identico formato.

**Universo.**

- ETF: `ETEXG$XMIL`, 2.480 ETF/ETP quotati su Borsa Italiana. Entrano in una sola pagina da 5.000.
- Fondi: `FOITA$$ALL`, 54.436 righe, pagine da 10.000 (max 10) con uscita su pagina corta e controllo di integrità al 99%: sotto quella soglia si preferisce lo snapshot a una classifica coi buchi.

**Datapoint.** isin, SecId, Name, categoryName, rendimenti (W1, M0 = YTD, M1, M3, M6, M12, M36, M60), starRatingM255, StandardDeviationM36, OngoingCostActual. Serve `languageId=it-IT` per avere le categorie in italiano.

**Riga fondo** = array di 18 campi; indice 17 = SecId, per il link alla scheda Morningstar.

**Momentum** = media dei rendimenti a 3 e 6 mesi.
**Accelerazione** = rendimento a 1 mese meno il passo medio mensile del trend (media di M3/3 e M6/6); soglia ±0,3 punti/mese; quattro stati: 🚀 rafforzamento, ⚠️ raffreddamento, ↗️ possibile svolta (momentum negativo ma in risalita), 🔻 peggioramento.

**Macro-categorie.** Come i fondi più Materie Prime; le categorie cripto/digital (Asset Digitali) finiscono in Alternativi.

**Deduplica per ISIN**, non per SecId: lo stesso ISIN può comparire come più listing in valute diverse, con rendimenti identici. Sugli ETF era 1 caso su 2.480; sui fondi erano 500 righe in eccesso su 243 ISIN, fino a 8 copie dello stesso titolo.

**Niente filtro ISIN** sugli ETF, non c'è l'allegato Fineco; il badge mostra Linee/valute.

**Storici reali** (`data/series.json`): raccolti. 2.186 serie agganciate sugli ETF, 3.063 sui fondi. I grafici usano la stima dai rendimenti solo per i titoli scoperti.
Per raccoglierne altri: endpoint `timeseries_cumulativereturn`, `id=SECID]2]1]`, mensile a 5 anni, valori a 1 decimale uniti da virgole, chiave = ISIN. Lanciare come job nella scheda Chrome, salvataggio in localStorage ogni 25 titoli, ritmo lento (400 ms, pausa di 2 minuti dopo 10 errori consecutivi): Morningstar blocca dopo circa 2.500 richieste al giorno.

**Fallback.** Entrambe le app hanno `data/snapshot.json`: se lo screener non risponde, il `catch` lo serve marcandolo in `meta.source`. Lo snapshot non contiene le serie storiche — il handler le riaggancia a runtime da `series.json`, che è già nel repo.

## Interfaccia (`app.js` / `index.html`)

Schede: Classifica, Top/Flop, Categorie, Mappa, Idee (con i blocchi 🚀 in accelerazione e ↗️ possibili svolte). Metrica selezionabile da 1 settimana a 5 anni più Momentum; pulsante i con la guida; scheda titolo con grafico, rendimenti, rischio, momentum e accelerazione, link Scheda completa Morningstar ↗.

## Lezioni operative (leggere prima di modificare)

- Niente download e upload manuali: i browser rinominano i duplicati e su GitHub finiscono file nuovi invece di sovrascrivere. Modificare i file direttamente nell'editor web di GitHub dal Chrome dell'utente: l'editor è CodeMirror, accessibile via `document.querySelector('.cm-content').cmView.view`, contenuto sostituibile con `view.dispatch({changes: {from: 0, to: len, insert}})`.
- Il limite di 1 MB dell'editor web di GitHub blocca l'apertura, non il salvataggio: si può committare un file più grande di quello che si è aperto. Lo snapshot dei fondi è a 1.058 KB e quindi non è più apribile in editing: per riscriverlo va cancellato e ricreato come file nuovo, oppure compresso (gzip + base64, `zlib.gunzipSync` nel handler; un JSON così ripetitivo scende sotto i 300 KB).
- Per travasare dati grossi da un sito a GitHub senza download: assegnarli a `window.name` sulla pagina di origine e rileggerli dopo aver navigato **la stessa scheda** su github.com. `window.name` sopravvive al cambio di origine.
- La CSP di github.com consente il fetch verso raw.githubusercontent.com ma blocca vercel.app.
- Dopo ogni modifica ad `app.js`, aggiornare il cache-bust in `index.html` (`app.js?v=N` diventa `v=N+1`) o il telefono continuerà a vedere la versione vecchia.
- Verificare sempre il risultato sul sito live leggendo `window.DATA` (funds, meta, series) via javascript nella scheda del sito. Aggiungere un parametro fittizio a `/api/data` per bypassare la cache edge.
- Istruzioni a passi minimi, un'azione per volta, massima automazione; chiedere conferma prima di ogni commit.
- Il collegamento con Chrome cade quando il PC va in standby: i job lunghi nella scheda continuano da soli, al ritorno si riprende con riprendi.

---

Ultimo aggiornamento: 27/07/2026.
