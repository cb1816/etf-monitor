# Lo stile di My Way — «olografico raffinato» (13 novembre 2026)

Vale per i cinque progetti della suite: My Way, Magüt, OICR Monitor, ETF Monitor e il CRM.
Questo file sta in `cb1816/myway` ed è l'originale; gli altri tengono una copia, come
`FORMATO_PORTAFOGLIO.md`. Se cambia qui, si cambia in tutti.

Nato dal mockup «Clienti — proposta di nuovo layout» (tavole F e G), approvato da Corrado
il 13/11/2026.

## 1. I colori: dodici variabili, stessi nomi di prima

I nomi non cambiano (il codice delle cinque app li usa in centinaia di punti); cambiano i valori.

| variabile | valore | uso |
|---|---|---|
| `--bg` | `#04070d` | fondo pagina, nero-blu |
| `--panel` | `rgba(219,234,254,.045)` | lastre, tabelle, schede (vetro: si vede il fondo) |
| `--panel2` | `rgba(165,243,252,.10)` | riquadro attivo, riga scelta |
| `--line` | `rgba(219,234,254,.12)` | bordi e separatori, sottili |
| `--txt` | `#e6f0f8` | testo |
| `--mut` | `#8ea3b5` | testo secondario, etichette |
| `--accent` | `#a5f3fc` | azzurro ghiaccio: voce attiva, link, titoli di sezione |
| `--pos` | `#5eead4` | positivo (verde acqua) |
| `--neg` | `#ff7a5c` | negativo, urgenza alta |
| `--warn` | `#f0c46b` | avviso, urgenza media |
| `--chip` | `rgba(219,234,254,.06)` | fondo di chip e pulsantini |
| `--hot` | `#e7c98a` | oro chiaro: il «modello», il riferimento, la seconda serie |

Più quattro nuove: `--oro: #e7c98a` (alias di `--hot`), `--basso: #9fb0ff` (urgenza bassa),
`--su-accento: #04070d` (testo sopra un fondo `--accent`), `--fondo-solido: #0a1019`
(dove serve un fondo pieno: menu, barra in basso sul telefono, finestre).

Positivo e negativo restano verde acqua e corallo, non verde e rosso puri: chi confonde i
due li distingue anche per luminosità. Il colore non porta mai l'identità da solo: la
parola (ALTA, MEDIA, BASSA; il segno + e −) c'è sempre.

## 2. Il fondo

Fisso dietro tutta la pagina: un alone blu tenue al centro, un alone oro appena
percettibile in alto a destra, una trama di punti ogni 24 pixel. Nient'altro.

```css
background:
  radial-gradient(1000px 640px at 46% 30%, rgba(56,120,170,.18), transparent 70%),
  radial-gradient(600px 400px at 100% 0%, rgba(231,201,138,.06), transparent 70%),
  radial-gradient(rgba(219,234,254,.07) 1px, transparent 1.2px) 0 0 / 24px 24px,
  #04070d;
background-attachment: fixed;
```

## 3. Le lastre

Ogni riquadro è una lastra. Due materiali, uno per app (si sceglie una volta, non per pagina):

- **vetro** (predefinito): fondo trasparente con sfocatura di quello che c'è dietro, bordo
  chiaro sottile, filo di luce in alto e d'ombra in basso, ombra sotto, riflesso diagonale
  tenue. Angoli 10 px.
- **metallo**: titanio scuro spazzolato, bordo d'acciaio, angoli 6 px.

Classi in `stile.css`: `.lastra` (vetro), `.lastra.metallo`.

La sfocatura (`backdrop-filter`) solo su schermi con mouse: sul telefono la lastra è
semitrasparente senza sfocatura, che consuma batteria.

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
- Un disco 3D si usa per **una misura sola con un riferimento**: altezza di un anello sopra
  il disco = distanza dal riferimento; velocità di rotazione = stessa misura; rotazione a
  mano = scegliere un pezzo; inclinazione o linea del tempo = la data.
- Tabelle, liste e grafici restano piatti.
- `@media (prefers-reduced-motion: reduce)`: tutto fermo.
- Animazioni sospese quando la pagina non è visibile (`document.hidden`).
- Sul telefono: niente rotazioni continue, solo la lastra che gira al tocco.

## 8. Dove si usa cosa

| app | lastre | disco 3D | lastre che girano |
|---|---|---|---|
| My Way · Mercati, Flussi, Calendario | sì | no | no |
| My Way · Magüt indicator | sì | sì: la quota della settimana | no |
| Magüt · Portafogli modello | sì | sì: il modello per profilo, fette come settori | sì |
| OICR Monitor, ETF Monitor | sì | no | sì: la scheda del fondo |
| CRM · Clienti | sì | sì: patrimonio e distanza dal modello | sì |

## 9. Come si porta in un'app

1. Si cambiano i valori delle dodici variabili in `:root` e si aggiungono le quattro nuove.
2. Si cercano i colori scritti a mano (`#0b1220`, `#0d1626`, `#111b2d`, `#070c16`,
   `rgba(79,156,255,…)`, `#04101f`, `#c9d3e3`) e si portano su variabili.
3. Fondo, lastre, etichette, pulsanti come sopra.
4. Test dell'app verdi; anteprima di Vercel guardata da Mac e da telefono prima del merge.
