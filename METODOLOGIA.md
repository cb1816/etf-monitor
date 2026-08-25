# ETF Monitor — metodologia e aggiornamento

App per ETF/ETC/ETP quotati su Borsa Italiana. Gemella di **OICR Monitor**, ma con
**impianto analitico diverso**: gli OICR si giudicano sulla bravura del gestore dentro la
categoria, gli ETF si giudicano sulla categoria stessa e poi sull'efficienza dello strumento.

> **Stato**: aggiornato il **25/08/2026**, dopo le coppie e spread (§8) e la dichiarazione
> della fine delle serie storiche (§12).
> Questo file è la fonte di verità e vive **nel repo**: la copia nel progetto Claude ne è un
> riflesso, non il contrario. Dove una cosa non è stata fatta, è detto esplicitamente.

---

## 1. Architettura — leggere prima di tutto

**Il prodotto è il sito, non un file.** L'app vive su Vercel e si aggiorna da sola.

- Repo: `github.com/cb1816/etf-monitor`
- Sito: `https://etf-monitor-italia.vercel.app` **e** `https://etf-monitor-kappa.vercel.app` —
  verificato il 24/08/2026 che sono **due domini dello stesso progetto Vercel**, non due siti:
  servono lo stesso `app.js` e gli stessi dati. Usare quello che si preferisce.
  (Attenzione: `etf-monitor.vercel.app`, senza suffisso, è di un altro utente: non usarlo.)
- Deploy: automatico a ogni commit su `main`, progetto `etf-monitor` nel team `cb1816s-projects`
- File: `index.html` (loader), `app.js` (interfaccia), `api/data.js` (dati e metriche),
  `data/series.json` (storici), `data/snapshot.json` (fallback statico)
- Documenti: questo file (impianto analitico) e **`OPERATIVO.md`** (testata, PWA, canali di
  scrittura verso il repo e verifiche dopo il commit)
- Gemella fondi: repo `oicr-monitor`, sito `https://oicr-monitor.vercel.app`. Le due app si
  linkano col pulsantino fisso "⇄" in basso a destra.

**`api/data.js` gira lato server su Vercel**: fa la fetch a Morningstar dal server, quindi niente
CORS, niente robots.txt, niente browser. La cache edge è di 6 ore. Da questo discendono due cose:

1. **Non serve nessun task settimanale.** Il sito si aggiorna da solo. Un task che raccoglie dati
   dal browser è lavoro duplicato — è stato creato e poi eliminato il 20/08/2026.
2. **Non esiste un pipeline template + JSON per gli ETF.** Quello è il modello degli OICR. Qui i
   dati non passano dal progetto Claude: passano dal server.

**Regola operativa**: dopo ogni modifica ad `app.js`, alzare il cache-bust in `index.html`
(`app.js?v=N` → `v=N+1`), o il telefono continua a servire la versione vecchia dalla cache.
Al 25/08/2026 siamo a `v=12`.

Le modifiche ai file si fanno **nell'editor web di GitHub dal Chrome dell'utente**, mai con
download e upload manuali (i browser rinominano i duplicati e su GitHub finiscono file nuovi
invece di sovrascrivere). L'editor è CodeMirror: `document.querySelector('.cm-content').cmTile.view`,
contenuto sostituibile con `view.dispatch({changes:{from:0,to:len,insert}})`. **Verificare sempre
il checksum del contenuto incollato prima di committare**, e chiedere conferma prima di ogni commit.

---

## 2. L'idea di fondo: due punteggi, non uno

Il rendimento di un OICR = **beta di categoria + scarto sulla categoria**. L'app OICR misura il
secondo (Mom. rel., Consistenza) perché è l'unica informazione che i fondi attivi danno.

Su un ETF lo scarto sulla categoria **non esiste per costruzione**: due ETF sullo stesso indice
differiscono di qualche decimo l'anno, e quella differenza è costo e replica, non strategia.
Classificare gli ETF per "momentum relativo alla categoria" produce rumore: si finisce per
ordinare per TER travestito da bravura.

| | **Score allocazione** | **Selezione** |
|---|---|---|
| Risponde a | *Dove* mi posiziono | *Quale* strumento compro |
| Unità di analisi | la **categoria** | lo **strumento** |
| Ingredienti | trend, Mom. 12-1, accelerazione, ampiezza, dispersione | TER, patrimonio, anzianità |
| Cambia | ogni mese | quasi mai |
| Dove nell'app | Categorie, Mappa, Idee | Classifica, schede |

Non si mescolano mai in un unico numero.

---

## 3. Sorgente dati

Istanza Integrated Web Tools, **nessuna autenticazione**. `tools.morningstar.it` è dismesso.

- Screener: `lt.morningstar.com/api/rest.svc/9vehuxllxs/security/screener`
- Serie storiche: `lt.morningstar.com/api/rest.svc/timeseries_cumulativereturn/1c6qh1t6k9`

Parametri: `universeIds=ETEXG$XMIL`, `pageSize=5000` (2 pagine), `outputType=json`,
`currencyId=EUR`, `languageId=it-IT`.

**Nota sulle chiavi**: `api/data.js` usa `9vehuxllxs` e funziona. La chiave `1c6qh1t6k9`
funziona anch'essa (verificata dal browser il 20/08). Non è chiaro se siano equivalenti o se una
possa scadere: se una smette, provare l'altra prima di dare l'endpoint per morto.

**Verificato sul campo il 20/08/2026** (2.499 righe grezze → 2.497 dopo dedup ISIN):
- `currencyId=EUR` **è applicato**: `currency` torna `EUR` ovunque tranne 2 strumenti, marcati
  nella scheda con un avviso invece che mescolati in silenzio.
- `exchangeCode` è `MIL` su tutte le righe: l'universo è pulito, non serve filtrarlo.
- Le categorie tornano **tutte in italiano**, 158 distinte, nessuna da tradurre a mano (a
  differenza degli OICR, dove ~22 restano in inglese).
- **I campi nulli vengono OMESSI dal JSON**, non messi a `null`: leggere per chiave, mai per posizione.
- Il dedup scarta 2 righe: una senza ISIN (`iShares DJ US Select Dividend (DE)`) e un ISIN
  duplicato (`IE00BDDRDY39`).

**Liveness check** (in `fetchScreener`): se lo screener torna meno di 2.000 righe si solleva
un errore e scatta il fallback. Gli aggiornamenti del 3, 10 e 17 agosto sono andati persi in
silenzio proprio per la mancanza di questo controllo.

---

## 4. Datapoint e copertura

Chiesti: `isin, SecId, Name, categoryName, GBRReturnW1, M0 (YTD), M1, M3, M6, M12, M36, M60,
starRatingM255, StandardDeviationM36, OngoingCostActual, ongoingCharge, FundTNAV, InceptionDate,
ticker, closePriceDate, MaxDrawdownM36, SharpeM36, currency, exchangeCode`.

Copertura misurata su 2.499 righe: W1 2.499 · M1 2.491 · M3 2.426 · M6 2.349 · M12 2.170 ·
M36 1.730 · M60 1.364 · `FundTNAV` 2.429 · `InceptionDate` 2.499 · `ticker` 2.490 ·
`StandardDeviationM36` 1.559 · `MaxDrawdownM36` 1.537 · `SharpeM36` 1.559 · `starRatingM255` 1.174.

**TER**: `OngoingCostActual` (2.280) **con ripiego su `ongoingCharge`** → **2.397**. 117 strumenti
in più, gratis. In produzione restano 102 strumenti senza TER.

**Campi che NON esistono su questo universo**, verificati assenti e non ipotizzati: metodo di
replica, politica di distribuzione (acc/dist), nome dell'indice replicato, flag hedged, struttura
legale. Il criterio "replica fisica/campionata/sintetica" **non è calcolabile** e non compare.

`investmentType` vale `FO` e `holdingTypeId` vale `22` su **tutto** l'universo: **non esiste un
campo che distingua ETF da ETC da ETN.** La separazione degli ibridi è per categoria Morningstar,
non per wrapper giuridico — e l'app lo dice invece di lasciarlo credere.

`closePriceDate`: la moda è la data di riferimento. Arriva in **ISO** (`2026-08-24`); `itDate()`
in `app.js` la porta a `gg/mm/aaaa` ovunque si mostri. 4 strumenti hanno una data più vecchia (fino
al 2016) e sono marcati "prezzo vecchio".

---

## 5. Score di allocazione (livello categoria)

Tutto sulla **mediana della categoria**, mai sul singolo strumento.

- **Trend (6m)** = mediana dei rendimenti a 6 mesi. Assoluto, non relativo.
- **Mom. 12-1** = `(1+r12)/(1+m1) − 1` sulla mediana.
- **Accelerazione** = `4·m3 − 2·m6` sulla mediana.
  ⚠️ **Su scala diversa dal trend**: nei dati del 19/08 va da −74 a +86 dentro gli Azionari,
  contro un trend da −38 a +51. Nell'app è mostrata in **punti (pt)**, non in %, apposta per non
  farla leggere come un rendimento.
- **Ampiezza di macro** = quota di **categorie** della macro con 1 e 3 mesi entrambi positivi.
  *Non* la quota di strumenti dentro la categoria: lì replicano tutti la stessa cosa, quindi
  uscirebbe 0% o 100%. È la differenza principale rispetto all'app OICR, ed è deliberata.
- **Dispersione** = scarto interquartile dei rendimenti a 3 mesi **tra le categorie** della macro.
- **Score 0–100** = percentile della categoria **dentro la sua macro**.

**Scelta esplicita, non nella metodologia originale**: il composito da cui esce il percentile è la
**media semplice dei percentili** di trend, Mom. 12-1 e accelerazione. Si cambia in un punto solo,
`computeCats()` in `api/data.js`.

### Categorie troppo piccole
Sotto **5 strumenti** lo score è `null`. In produzione sono **58 categorie su 158**: più di un
terzo. È molto, ma è il prezzo di non produrre numeri finti.

### Limite noto delle macro piccole
Il percentile ha bisogno di **almeno 2 categorie ammesse** dentro la macro. Conseguenza diretta:
**Cripto** (una sola categoria, "Asset Digitali", 47 strumenti), **Altro**, **Convertibili** e
**Alternativi** non hanno score. Trend, Mom. 12-1 e accelerazione ci sono lo stesso, in assoluto.
Separare le cripto in una macro propria — necessario per non inquinare le mediane altrui —
**costa a loro il punteggio relativo**: è un compromesso, non un difetto. In produzione le
categorie con score sono **97 su 158**.

### I quattro stati
La metodologia non fissa una soglia di magnitudine per la nuova accelerazione, e la vecchia soglia
±0,3 punti/mese apparteneva a una definizione diversa. Quindi si classifica **per segno**, con il
valore sempre accanto:

| trend | accel | stato |
|---|---|---|
| ≥ 0 | > 0 | 🚀 rafforzamento |
| ≥ 0 | ≤ 0 | ⚠️ raffreddamento |
| < 0 | > 0 | ↗️ possibile svolta |
| < 0 | ≤ 0 | 🔻 peggioramento |

Nessuna soglia inventata. Se servirà una banda morta, va tarata sui dati.

---

## 6. Selezione dello strumento

0. **Leva e inversi: fuori di default** (§6bis). Prima di ordinare per qualunque metrica.
1. **TER** — mostrato **col valore in chiaro E il quartile di categoria**. Il quartile da solo
   nasconde la differenza fra 0,07% e 0,20%; il valore da solo non dice se è caro per la sua
   categoria. Quartile calcolato dove la categoria ha ≥4 valori: 2.319 strumenti su 2.497.
2. **Patrimonio** — `FundTNAV`. Sotto 50 M€ la scheda segnala il rischio di chiusura o fusione,
   che per il cliente significa realizzo forzato.
3. **Anzianità** — anno da `InceptionDate`.
4. **Efficienza di replica** — *non implementata*: dipende dal gruppo-indice (§7).
5. **Metodo di replica** — *impossibile*: il campo non esiste (§4).
6. **Liquidità e spread denaro-lettera** — *non disponibili*. È il costo che il cliente paga
   davvero all'ingresso e all'uscita, e su uno strumento sottile vale più di anni di TER.
   Finché manca, **l'app lo dice** nella Guida e in fondo a ogni scheda.

**Spareggio**: a parità di metrica → **TER crescente, poi patrimonio decrescente, poi nome**.
Senza, le metriche con pochi valori distinti escono in ordine alfabetico.

---

## 6bis. Leva e inversi — esclusi di default (24/08/2026)

**Il problema, misurato.** Sui dati in repo, rendimento a 6 mesi: **19 dei primi 20** e **20 su 20
degli ultimi 20** erano strumenti a leva. Primo assoluto un 3x su ARM a +278%, contro +85% del
primo non-leva. Non è una classifica di strumenti migliori: un 2x o un 3x **non batte l'indice, lo
moltiplica**, e con il ribilanciamento giornaliero perde valore nei mercati laterali. In una
classifica per rendimento occupa le prime posizioni **per costruzione**, non per merito.

**Cosa si è fatto, e cosa no.** Sono **nascosti di default**, non cancellati. `api/data.js` non è
stato toccato: le mediane di categoria si calcolano *dentro* la categoria e i percentili *dentro*
la macro, quindi i leva non hanno mai inquinato i numeri delle altre categorie — non c'era niente
da correggere a monte, solo da smettere di mostrarli in classifica. Togliere le righe dai dati
avrebbe solo perso informazione.

**Dove si applica** (tutto in `app.js`, funzione `visibile()` e `catPool()`):
Classifica, Top/Flop, selettore di categoria; e a livello di categoria Categorie, Mappa e Idee.

**Come si rientra**: chip **⚡** in testa alla riga dei tipi. Si accende **da solo** se si seleziona
la macro `Leva e Inverse (ETP)` o una categoria `Trading -`, altrimenti quella scheda resterebbe
vuota senza spiegazione. Spegnendolo da lì, macro e categoria si azzerano.

**Riconoscimento** — due criteri in OR, `isLeva()`:
1. macro `Leva e Inverse (ETP)` o categoria Morningstar `Trading -…` → **286 strumenti**;
2. rete di sicurezza sul **nome**, `LEVA_RE`, che cerca un moltiplicatore (`3x`, `-3x`, `+2X`) o le
   parole *leverage / leveraged / inverse*. Recupera i **4** ETP cripto a leva che Morningstar
   classifica sotto *Asset Digitali* e che il criterio 1 si perderebbe.

Totale **290**. ⚠️ Il criterio 2 è delicato: verificato che **non** prende gli obbligazionari
*Ultrashort*, *Short Maturity* e *Short Duration*, che sono fondi normali. Zero falsi positivi
sull'universo del 27/07. Se un giorno comparisse un ETF su *leveraged loans*, il nome lo farebbe
sparire dalle classifiche: è il punto da controllare per primo se qualcuno segnala un'assenza.

**Non è il filtro "tipo"** (§11). Quello è il wrapper (ETF/ETC/ETN-ETP) e resta ortogonale: fra i
355 ETN-ETP la maggior parte sono proprio i leva, quindi a chip spento quel conteggio scende a 65.

## 7. Raggruppamento — non implementato

Il **gruppo-indice** (tutti gli ETF sullo stesso indice, chiave = categoria + indice normalizzato
+ hedged) resta la strada giusta per uno score di selezione relativo, ma richiede di estrarre
l'indice dal nome per euristica e tararla col controllo di sanità (dentro un gruppo, la dispersione
dei rendimenti a 3 anni sotto ~1,5 punti l'anno). Oggi il raggruppamento è per categoria Morningstar.

Errore da non commettere quando si farà: indici *simili ma non uguali* (MSCI World vs MSCI World
ex-USA, S&P 500 vs S&P 500 Equal Weight, IMI vs standard) non vanno fusi.

---

## 8. Coppie e spread — in produzione dal 24/08/2026

Due strumenti che differiscono per **una cosa sola**, sottratti: quello che resta *è* quella cosa,
isolata. L'ampiezza vera del rialzo, il contributo del cambio, il premio di credito. È l'unica
analisi che gli ETF permettono e i fondi no: fra due gestori attivi la differenza è il gestore.

Il blocco sta in testa alla scheda **Idee**, in viola, con un pulsante "i" che spiega tutto.

### Le 10 coppie — tabella statica, `const COPPIE` in `app.js`

| Coppia | Cosa isola | Gamba A | Gamba B |
|---|---|---|---|
| Equal Weight − S&P 500 | ampiezza reale del rialzo americano | IE00BNGJJT35 | IE00B6YX5C33 |
| Min Vol − MSCI World | quanto costa (o rende) la difesa | IE00B8FHGS14 | IE00BJ0KDQ92 |
| World hedged − World | contributo puro del cambio | IE00B441G979 | IE00BJ0KDQ92 |
| S&P 500 hedged − S&P 500 | contributo del solo dollaro | IE00B3ZW0K18 | IE00B6YX5C33 |
| Enhanced Value − MSCI World | stile: value aggressivo | IE00BL25JM42 | IE00BJ0KDQ92 |
| Momentum − MSCI World | stile: momentum contro mercato | IE00BL25JP72 | IE00BJ0KDQ92 |
| High Yield € − Govt € | premio pagato per il rischio di credito | IE00B66F4759 | IE00B4WXJJ64 |
| Nasdaq 100 − S&P 500 | concentrazione sul tech | IE00BMFKG444 | IE00B6YX5C33 |
| Europa − S&P 500 | geografia: Europa contro Stati Uniti | LU0446734104 | IE00B6YX5C33 |
| Govt € 0-1 anno − Govt € | duration: liquidità contro scadenze lunghe | IE00B3FH7618 | IE00B4WXJJ64 |

Erano previste ~20 coppie: dieci sono quelle che reggono il controllo ISIN per ISIN sull'universo
di Milano. Small − large è la principale mancante (vedi sotto).

### Come si calcola

Le due serie mensili di `data/series.json` si **ribasano a zero** all'inizio della finestra comune
e si **troncano alla più corta** — confrontare orizzonti diversi darebbe un numero senza
significato. La scheda mostra la sparkline dello spread nel tempo, il totale sulla finestra, e
3 e 12 mesi **ricalcolati sulla finestra**, non come differenza di cumulati.

**Le serie sono total return**: verificato che due ETF sullo stesso indice, uno ad accumulazione e
uno a distribuzione, coincidono entro mezzo punto su cinque anni. Quindi le gambe si possono
accoppiare senza guardare la politica di distribuzione.

### Perché a mano, ISIN per ISIN, e non per euristica sul nome

Sotto lo stesso nome commerciale convivono prodotti diversissimi (S&P 500 QVM, Buyback, Low Vol,
ESG Elite, perfino futures sul VIX). Caso vero, trovato il 24/08/2026: l'ETF **IE00BL25JM42**,
venduto come *Xtrackers MSCI World Value*, replica in realtà il **MSCI World Enhanced Value**, un
value molto più aggressivo — se ne è accorti perché il +58% a 12 mesi era implausibile per un value
standard, mentre un concorrente (HSBC World Value Screened) faceva peggio del mercato. Verificato su
justETF e sul sito DWS, l'etichetta della coppia è stata corretta. Un'euristica sul nome avrebbe
accoppiato l'indice sbagliato senza dirlo.

### Limiti, tutti dichiarati dentro l'app

- **Small cap − large cap manca**: gli ETF World Small Cap quotati a Milano hanno meno di un anno
  di storia, e una coppia senza storia non dice niente.
- Le gambe sono ETF reali, quindi lo spread **include il TER di entrambe**: su orizzonti lunghi
  qualche decimo l'anno di differenza di costo finisce dentro il numero.
- **Le serie sono ferme al 30/06/2026** (§12): le coppie non vedono le ultime settimane, mentre
  rendimenti e score di categoria sì. Dal 25/08/2026 l'app lo scrive sopra il blocco, nel pannello
  "i" e nella legenda del grafico di scheda.

---

## 9. Rischio

A livello di categoria (mediana) e di strumento: volatilità 36m, max drawdown 36m,
rendimento/volatilità 3 anni — quest'ultimo **etichettato per quello che è**, non uno Sharpe:
manca il tasso privo di rischio e i rendimenti sono cumulati, non annualizzati. Copertura ~62%.

Correlazioni con riferimenti e drawdown a 5 anni si potrebbero calcolare dalle serie in
`data/series.json`: non fatto.

---

## 10. Cosa si è buttato del modello OICR, e perché

| Metrica OICR | Sugli ETF |
|---|---|
| **Mom. rel.** `0.5·(m3−mediana_cat_m3) + 0.5·(m6−mediana_cat_m6)` × `mediana_cat_sd/sd` (clamp 0.5–2) | **Eliminata.** Misura la bravura del gestore, che sull'ETF non esiste. Sostituita dal trend assoluto di categoria. |
| **Consistenza** (batte la mediana su 5 orizzonti) | **Eliminata.** Su strumenti che replicano lo stesso indice esce 5/5 o 0/5 per motivi di costo. Sostituita dal TER col quartile. |
| **Dedup per classe di quota** | Non serve: su un solo mercato ogni ISIN è un prodotto distinto. Resta il badge "Linee/valute". |
| **Rating a stelle** | **Non usato.** È relativo alla categoria e sui passivi premia di fatto il TER più basso: informazione già in chiaro. Il campo resta nel record (indice 11) ma non compare nell'interfaccia. |
| **Ampiezza dentro la categoria** | **Ridefinita** come ampiezza di macro (§5). |
| **Δ rango** | **Non attivo.** Richiede un archivio di rilevazioni, che su Vercel non c'è (vedi §13). |
| **Quartile di costo** | **Promosso**: da metrica accessoria a primo criterio di selezione. |

---

## 11. Schema del record — `schema: 2`

`DATA.funds`, array posizionale a 26 campi. **Gli indici 0–17 sono quelli storici e non vanno
cambiati**: è ciò che ha permesso di committare `api/data.js` prima di `app.js` senza rompere il
sito nel mezzo.

`0 isin, 1 name, 2 cat, 3 macro, 4 ytd, 5 m1, 6 m3, 7 m6, 8 r1, 9 r3, 10 r5, 11 star, 12 sd,
13 ter, 14 mom (legacy, non mostrato), 15 nc, 16 w1, 17 secId, 18 terQ, 19 aum (M€), 20 anno,
21 mdd, 22 sharpe, 23 ticker, 24 stale, 25 ccy`

`DATA.cats`, oggetti: `nome, macro, n, m1, m3, m6, r1, r3, trend, mom121, accel, ampiezza, disp,
score, sd, mdd, terMed`.

Più `catNames`, `macroOrder`, `series`, `meta{date, dataChiusura, source, nTot, nData, nSeries,
nCat, nCatSottoSoglia, nNoTer, nStale, minN, schema}`.

### Macro (11)
`Azionari, Obbligazionari, Convertibili, Monetari, Bilanciati, Materie Prime (ETC), Immobiliare,
Alternativi, Leva e Inverse (ETP), Cripto, Altro`

Etichette allineate all'app OICR dove le categorie coincidono: **"Bilanciati"** e non
"Multi-asset", e i **Convertibili** staccati dagli Obbligazionari come sugli OICR il 20/08.
⚠️ **Attenzione all'ordine dei test in `macroOf()`**: le categorie si chiamano *"Obbligazionari*
Convertibili Globale", quindi il controllo sui convertibili deve venire **prima** di quello sugli
obbligazionari.

Ripartizione al 19/08/2026: Azionari 1.289 · Obbligazionari 656 · Leva e Inverse 286 ·
Materie Prime 120 · Cripto 47 · Bilanciati 30 · Immobiliare 22 · Alternativi 21 · Monetari 19 ·
Altro 5 · Convertibili 2. Sugli ETF i convertibili sono quasi assenti (2 contro 41 fondi sugli
OICR): la macro resta per coerenza fra le due app, non perché pesi.

### Filtro "tipo", ortogonale alle macro
`app.js` classifica ETF / ETC / ETN-ETP per euristica su nome e categoria (`tipoOf`), come
**filtro** indipendente dalla macro: 2.052 ETF, 90 ETC, 355 ETN-ETP. È una dimensione diversa
(wrapper) da quella delle macro (asset class), e le due convivono. I conteggi mostrati sono quelli
dell'universo **visibile**: con i leva nascosti (§6bis) gli ETN-ETP scendono a 65.

---

## 12. Fallback e serie storiche

**`data/snapshot.json`** — copia statica servita se Morningstar non risponde. Quella in repo è del
**27/07/2026 in schema 1** (18 campi, macro vecchie). Non è stata riscritta: 604 KB dall'editor web
sono pesanti e fragili. Al suo posto `api/data.js` ha **`upgradeSnapshot()`**, che la converte al
volo — rimappa le macro, ricalcola le 158 categorie e lo score — e lascia a "—" i campi che nello
schema 1 non esistono (patrimonio, drawdown, ticker). Provato sul file vero: funziona. Meglio un
fallback parziale che rotto. Quando capiterà di doverlo rigenerare, farlo con `git` da un
container, non dall'editor web.

**`data/series.json`** — **2.186 serie storiche reali**, di cui **1.137 con 60 punti mensili**
(5 anni) e le altre più corte perché lo strumento è più giovane. Formato `isin -> "0.0,6.7,…"`,
cumulato % con base 0. In produzione ne vengono servite 2.182 (quelle degli ISIN presenti).
La scheda strumento usa la serie reale quando c'è e ripiega sulla stima dai rendimenti quando
manca, **dichiarando quale delle due sta mostrando**.

**La fine delle serie è dichiarata nell'app dal 25/08/2026.** Il file è **statico**: raccolto il
24/07/2026, ultimo punto mensile **30/06/2026**. Quella data **non è scritta dentro il file** — è
stata ricavata allineando i rendimenti YTD e 1/3/6/12 mesi delle serie con quelli dello screener
(su YTD il fit è netto: dicembre 2025 cade sei punti prima della fine). Vive in **una riga sola**,
`SERIE_FINE` in `api/data.js`, esposta come `meta.serieFine`: se un giorno si rigenerano le serie,
si aggiorna lì e basta. `app.js` la mostra sopra le coppie, nel pannello "i" e nella legenda del
grafico di scheda — dove prima c'era scritto "oggi", che da luglio era falso.

⚠️ Correzione: fino al 20/08/2026 la metodologia diceva che gli storici ETF "non erano ancora
stati raccolti". **È falso**, ed è stato ripetuto per errore anche nella prima riscrittura di
questo documento. Erano già nel repo.

Il timeseries endpoint va in **429 dopo ~350-500 richieste**: concorrenza ≤4, stop al primo 429.

---

## 13. Raccolta dati fuori da Vercel — quando serve e come

In esercizio normale **non serve mai**: `api/data.js` fa tutto lato server. Serve solo per lavori
ad hoc (raccogliere serie nuove, esperimenti). Vincoli verificati a caro prezzo il 20/08/2026,
da non riverificare:

1. **Il container non raggiunge `lt.morningstar.com`**: WebFetch è bloccato da robots.txt, e non
   si aggira per altre vie.
2. **Da `file://` lo screener dà `Failed to fetch`** — è CORS. ⚠️ La stesura precedente diceva il
   contrario: vale per il **timeseries** (che da `file://` funziona, ed è così che furono raccolte
   le 3.748 serie OICR), **non per lo screener**.
3. **La fetch dello screener va fatta da una scheda Chrome già sull'origine `lt.morningstar.com`**:
   si naviga la scheda sull'URL dello screener e si fa `fetch` da lì con `javascript_tool`.
4. **I download avviati dall'automazione non arrivano nel container.** La diagnosi originale
   ("il ponte `device_*` vede solo ciò che scriviamo noi") era incompleta: il ponte vede benissimo
   i file scritti da altre app. Il motivo vero è che **Chrome non salva in
   `/Users/corrrado/Downloads`**, l'unica cartella condivisa. Prova del nove: lì non c'è nemmeno
   `storici_oicr.json`, prodotto dal raccoglitore OICR che aveva funzionato.
5. **Il canale affidabile è `window.showSaveFilePicker()`**: si inietta un pulsante nella scheda
   Morningstar, l'utente lo preme e sceglie la cartella nella finestra nativa; poi
   `device_stage_files`. Richiede un clic, ma la cartella è certa.
6. **Canale DOM + `get_page_text`**: regge blocchi da 40 KB con checksum, buono per pochi valori.
   **Non per il payload intero**: 370 KB vanno ricopiati a mano e un carattere sbagliato corrompe
   tutto. Comprimere con `CompressionStream('gzip')` + base64 porta a 165 KB: ancora troppi.

**GitHub invece è raggiungibile dal container**: `git clone` del repo funziona. Per leggere il
codice, provarlo e calcolare i checksum si lavora lì; solo la scrittura passa dall'editor web.

---

## 14. Nota fiscale (per i testi dell'app)

- ETF armonizzati (UCITS): imposta sostitutiva **26%**, ridotta al **12,5%** sulla quota in titoli
  di Stato white list.
- Asimmetria: le **plusvalenze** sono *redditi di capitale*, le **minusvalenze** *redditi diversi* →
  **le minusvalenze da ETF non compensano le plusvalenze da ETF**.

Informazione generale al 20/08/2026, non consulenza: da verificare con la fonte normativa e con
l'ufficio fiscale prima di finire in un testo mostrato al cliente.

---

## 15. Prossimi passi, in ordine di resa

1. **Gruppo-indice ed efficienza di replica** (§7, §6.4) — rende la scheda categoria una vera
   classifica di selezione invece di un elenco ordinato per costo.
2. **Δ rango** — serve un archivio di rilevazioni settimanali (`data/snapshots.json` nel repo,
   `data -> {categoria: score}`, ~4 KB a settimana). Su Vercel non c'è persistenza fra richieste,
   quindi va scritto nel repo da un job. È l'unica cosa per cui varrebbe la pena rimettere un
   task settimanale.
3. **Drawdown a 5 anni e correlazioni** dalle serie già in repo (§9, §12).
4. **Ponte OICR ↔ ETF** — per ogni categoria, l'ETF di riferimento: "questo gestore attivo vale il
   suo costo?" diventa una sottrazione visibile. È l'uso più forte di avere le due app nello
   stesso impianto.
5. **Liquidità da Borsa Italiana** come secondo canale mensile (§6.6).
6. **Pesi del composito** (§5) e eventuale banda morta sugli stati, se dopo qualche settimana i
   dati suggeriscono che servono.
