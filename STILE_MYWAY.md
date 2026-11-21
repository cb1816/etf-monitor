# Lo stile di My Way — «verde a rilievo» (21 novembre 2026)

Vale per i cinque progetti della suite: My Way, Magüt, OICR Monitor, ETF Monitor e il CRM.
Questo file sta in `cb1816/myway` ed è l'originale; gli altri tengono una copia, come
`FORMATO_PORTAFOGLIO.md`. Se cambia qui, si cambia in tutti.

Storia: «olografico raffinato» del 13/11/2026 (tavole F e G di «Clienti — proposta di nuovo layout»);
il 21/11/2026 Corrado ha scelto per tutta la suite il verde a rilievo topografico, le pietre come colori
delle serie e la scena a steli (tela «Portfolio Workbench — proposte di stile», tavole 4 e 5). Vetro,
caratteri, lastre che girano, disco e regole del movimento restano quelli del 13/11.

## 1. I colori: dodici variabili, stessi nomi di prima

I nomi non cambiano (il codice delle cinque app li usa in centinaia di punti); cambiano i valori.

| variabile | valore | uso |
|---|---|---|
| `--bg` | `#0b1813` | fondo pagina, verde notte |
| `--panel` | `#0a1511` | lastre di lavoro: tabelle, liste, pannelli (fondo pieno) |
| `--panel2` | `rgba(31,242,168,.10)` | riquadro attivo, riga scelta |
| `--line` | `rgba(160,230,205,.14)` | bordi e separatori, sottili |
| `--txt` | `#e9f2ec` | testo |
| `--mut` | `#a9c7ba` | testo secondario, etichette |
| `--accent` | `#1ff2a8` | smeraldo: il colore guida; voce attiva, link, titoli di sezione |
| `--pos` | `#5eead4` | positivo (verde acqua) |
| `--neg` | `#e8365d` | negativo, urgenza alta (rubino) |
| `--warn` | `#ffb21f` | avviso, urgenza media (topazio) |
| `--chip` | `rgba(160,230,205,.07)` | fondo di chip e pulsantini |
| `--hot` | `#f5c84c` | oro: il «modello», il riferimento, le etichette che contano |

Più: `--oro: #f5c84c` (alias di `--hot`), `--basso: #4fb6ff` (urgenza bassa, zaffiro),
`--su-accento: #04140e` (testo sopra un fondo `--accent`), `--fondo-solido: #08120e` (menu, barra in
basso sul telefono, finestre), `--lastra: #0a1511` e `--lastra-bordo: rgba(160,230,205,.14)`.

**Dal logo.** I tre colori del logo sono la base: il verde del fondo è il terreno della suite (fondo e
smeraldo), il blu dell'asta è lo zaffiro, il corallo delle lettere è il colore del marchio. Il corallo
(`--marchio: #ff5a4f`) sta solo nel logo e nei titoli di pagina: **non vuol mai dire «male»**; il negativo
è il rubino, un rosso più freddo e più scuro.

**Le pietre** — un colore acceso per ogni serie; danno ricchezza senza confondere, perché ognuna ha un
significato fisso dentro una pagina e la parola c'è sempre:

| variabile | valore | pietra | dove, di solito |
|---|---|---|---|
| `--smeraldo` | `#1ff2a8` | smeraldo | la prima serie, il colore guida (= `--accent`) |
| `--zaffiro` | `#4fb6ff` | zaffiro (l'asta del logo) | la seconda serie |
| `--topazio` | `#ffb21f` | topazio | la terza serie |
| `--ametista` | `#b57cff` | ametista | la quarta serie |
| `--turchese` | `#22d3ee` | turchese | la quinta serie, il patrimonio |
| `--oro` | `#f5c84c` | oro | totali, ricavo, riferimento |
| `--rubino` | `#e8365d` | rubino | solo il dato mancante e il negativo |
| `--marchio` | `#ff5a4f` | corallo del logo | solo logo e titoli di pagina |

Nel CRM, per la consulenza: Advice smeraldo, Advice+ fee only zaffiro, Advice+ on top topazio, fuori
consulenza ametista, totale oro, dato mancante rubino.

Positivo e negativo restano verde acqua e rubino: chi confonde i due li distingue anche per
luminosità. Il colore non porta mai l'identità da solo: la parola (ALTA, MEDIA, BASSA; il segno + e −)
c'è sempre.

## 2. Il fondo: verde a rilievo topografico

Fisso dietro tutta la pagina: il verde notte, due luci piccole negli angoli (smeraldo in alto a
sinistra, oro in basso a destra) e le **curve di livello** di `topografia.svg`, con un filo d'ombra
spostato sotto ogni linea che le fa sembrare in rilievo. Niente aloni larghi: fanno nebbia.

```css
background:
  radial-gradient(620px 320px at 12% 0%, rgba(31,242,168,.12), transparent 70%),
  radial-gradient(520px 280px at 100% 100%, rgba(245,200,76,.08), transparent 70%),
  url("topografia.svg") center/cover no-repeat,
  #0b1813;
background-attachment: fixed;
```

`topografia.svg` lo scrive `grafica/rilievo.js` di My Way; gli altri progetti ne tengono una copia
nella radice (il CRM, che non carica niente da fuori, lo mette nel suo foglio di stile).

**Il logo** resta l'originale (MY / WA con la Y unica, lettere corallo, asta azzurra); il suo fondo
verde, prima piatto, è ora a rilievo con le stesse curve (`grafica/icona_rilievo_*.svg`).

## 3. Lastra e vetro: due materiali

- **Lastra** — le superfici dove si lavora: tabelle, liste, pannelli, la scena 3D. Fondo pieno
  `--lastra`, bordo `--lastra-bordo`, filo di luce in alto, ombra sotto. **Niente sfocatura.**
- **Vetro** — ciò che galleggia sopra qualcos'altro: i riquadri in cima a una pagina, le lastre che
  girano, il primo piano, il dettaglio che si apre, menu e barre. Fondo trasparente con sfocatura
  (16 px, saturazione 150%), bordo chiaro, filo di luce, riflesso diagonale. Angoli 10 px.
- **Metallo** — variante del 13/11, invariata.

Tre regole: **mai vetro sopra vetro**; **l'alone luminoso solo sull'elemento scelto**, mai su tutti;
gli aloni del fondo sono quelli del §2 e basta.

Classi in `stile.css`: `.lastra` (vetro, il nome resta per non rompere le pagine), `.tbl`, `.news`,
`.panel`, `.mi-box` (lastra), `.lastra.metallo`, `.cr` (angoli a squadretta).

La sfocatura solo su schermi con mouse: sul telefono il vetro è semitrasparente senza sfocatura.

## 4. Caratteri

**Caratteri di sistema, niente da scaricare** (il CRM non può caricare niente da fuori,
regola «nessuna rete» e test `w7`):

- testo e cifre: `-apple-system, BlinkMacSystemFont, "SF Pro Text", system-ui, sans-serif`;
- etichette tecniche: `"SF Mono", ui-monospace, Menlo, monospace`, 10–11 px, maiuscolo,
  spaziatura `.22em`, colore `--mut`.

Le cifre importanti sono **grandi e leggere** (peso 300, `letter-spacing:-.02em`, cifre
tabellari). Le cifre nelle tabelle restano a peso normale: leggere fra cento righe stanca.

## 5. Pulsanti e selettori

- Principale: vetro azzurro — fondo `rgba(165,243,252,.12)`, bordo `rgba(165,243,252,.55)`,
  testo bianco. **Mai bianco pieno**: sul fondo nero abbaglia.
- Secondario: solo bordo `--line`, testo `--txt`.
- Etichette dei pulsanti in maiuscolo spaziato, carattere tecnico.
- Voce attiva di un menu: sottolineata da un filo `--accent`, non riempita.

## 6. Urgenza

ALTA `--neg`, MEDIA `--warn`, BASSA `--basso`: un trattino orizzontale del colore seguito
dalla parola, in carattere tecnico. Nessun alone.

## 7. Movimento e 3D

Il movimento c'è solo dove **dice qualcosa**. Regole:

- Una lastra che gira (`rotateY(180deg)`, 0,6 s) mostra sul retro il dettaglio di quello
  che c'è davanti. Si gira cliccando in un punto qualsiasi, tranne pulsanti e caselle.
- Una lastra può anche **girarsi e venire in primo piano** (0,6 s, il resto della pagina si scurisce): per un
  dettaglio troppo grande per il retro (grafico del periodo, tabella degli strumenti collegati). Si chiude con ✕,
  con Esc o toccando fuori. Prima pagina che lo usa: Mercati, riquadri delle asset class (15/11/2026).
- Un disco 3D si usa per **una misura sola con un riferimento**: altezza di un anello sopra
  il disco = distanza dal riferimento; velocità di rotazione = stessa misura; rotazione a
  mano = scegliere un pezzo; inclinazione o linea del tempo = la data.
- Tabelle, liste e grafici restano piatti.
- `@media (prefers-reduced-motion: reduce)`: tutto fermo.
- Animazioni sospese quando la pagina non è visibile (`document.hidden`).
- Sul telefono: niente rotazioni continue, solo la lastra che gira al tocco.

### La scena (21/11/2026)

Il secondo tridimensionale, accanto al disco: **per confrontare**, non per raccontare. Un pavimento
isometrico **fermo** (niente rotazione: le altezze devono restare confrontabili), righe e colonne come in
una tabella, e su ogni incrocio uno **stelo**:

- altezza dello stelo = la prima misura (nel CRM la resa);
- superficie della sfera in cima = la seconda (il controvalore; raggio ∝ radice, con un minimo perché
  le cose piccole si vedano);
- luce della sfera = il loro prodotto (il ricavo): più guadagna, più è piena e larga di alone.

Regole che vengono con la scena: una fascia a terra per ogni riga, alternata chiara e scura; i nomi
degli assi sono pulsanti che mettono in evidenza riga o colonna (le altre diventano sagome) e
«Torna alla vista generale» le riaccende; sopra ogni sfera un'etichetta col valore, che sceglie la
cella; lo zero è un'impronta tratteggiata a terra, l'assente non si disegna. La scena sta su una
lastra; il dettaglio a destra è vetro. Accanto c'è sempre «Tabella / Spazio»: sul telefono si apre su
Tabella. Passaggi di 0,3 s quando una riga si accende, poi tutto fermo.

## 8. Dove si usa cosa

| app | lastre | disco 3D | lastre che girano |
|---|---|---|---|
| My Way · Mercati | sì | sì: il clima (punteggio e soglie ±25) | sì: i sei riquadri in cima (sul retro si sceglie cosa mostrare); le asset class si girano in primo piano |
| My Way · Mercati, il mondo in diretta | sì | nessuno | nessuno: la mappa e il video si muovono da soli, perché sono dati veri (navi, televisione); la mappa chiara è portata al buio con un filtro |
| Tutte le pagine · quadro di bordo | sì | nessuno | nessuno: è una barra fissa in cima, sempre uguale (quadro.js) |
| My Way · Trend | sì | il globo dei temi gira per mostrare tutte le parole e si ferma quando lo tocchi (non è una misura) | le parole e le schede si girano in primo piano |
| My Way · Flussi, Calendario | sì | no | no |
| My Way · Magüt indicator | sì | sì: la quota della settimana | no |
| Magüt · Portafogli modello | sì | sì: il modello per profilo, fette come settori | sì |
| OICR Monitor, ETF Monitor | sì | no | sì: la scheda del fondo |
| CRM · Clienti | sì | sì: patrimonio e distanza dal modello | sì |
| CRM · Analisi e operazioni | sì | la scena: resa, controvalore, ricavo per strumento e consulenza | no |

## 9. Come si porta in un'app

1. Si cambiano i valori delle dodici variabili in `:root` e si aggiungono le nuove (pietre, lastra).
2. Si cercano i colori scritti a mano e si portano su variabili; quelli del 13/11 diventano: `#04070d`→`#0b1813`,
   `#0a1019`→`#08120e`, `#a5f3fc`/`165,243,252`→`#1ff2a8`/`31,242,168`, `219,234,254`→`160,230,205`,
   `4,7,13`→`8,18,14`, `#e7c98a`/`231,201,138`→`#f5c84c`/`245,200,76`, `#ff7a5c`/`255,122,92`→`#e8365d`/`232,54,93`,
   `#9fb0ff`→`#4fb6ff`, `#8ea3b5`→`#a9c7ba`, `#e6f0f8`→`#e9f2ec`, `#f0c46b`→`#ffb21f`.
3. Fondo (con `topografia.svg` copiato nella radice), lastra e vetro, etichette, pulsanti come sopra.
4. Test dell'app verdi; anteprima di Vercel guardata da Mac e da telefono prima del merge.
