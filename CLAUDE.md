# Regole di lavoro su ETF Monitor

Come e' fatto: `METODOLOGIA.md` (la fonte di verita' sull'impianto analitico)
e `OPERATIVO.md` (testata, PWA, pubblicazione).

- **Il repository e' pubblico**: chiunque legge il codice e la storia. Mai dati
  di clienti, chiavi o indirizzi interni, nemmeno in un messaggio di commit.
- **Test**: `node --test test/*.test.js`.
- **Nessuna riga `Co-Authored-By` nei commit**: in passato ha bloccato la
  pubblicazione su Vercel.
- Dopo ogni modifica ad `app.js` si alza il cache-bust (`app.js?v=N+1`), e
  prima di dire che e' fatto si guarda il sito vivo
  (`etf-monitor-italia.vercel.app`).
- **Magut e My Way leggono `/api/data`** (Magut per gli ETF dei modelli, My
  Way per i mercati obbligazionari): un campo rinominato o tolto li rompe.
  Prima di cambiare il formato, guardare `lib/fonti.js` nei due repository.
- Ogni regola nuova del gruppo-indice va in tre posti: `api/_gruppi.js`, il
  prototipo Python e un caso di test.

## La suite e dove si lavora (6 ottobre 2026)

Questa sezione e' uguale nei `CLAUDE.md` dei cinque progetti. Se la cambi in
uno, cambiala in tutti.

| Progetto | GitHub | Cartella sui Mac | Cosa fa |
|---|---|---|---|
| My Way | `cb1816/myway` | `~/myway` | il cruscotto: Mercati, Calendario, Magut indicator, link alle altre parti |
| Magut | `cb1816/magut` | `~/magut` | portafogli modello, revisione, tattica, prezzi e rendimenti: il fornitore dei dati di mercato |
| OICR Monitor | `cb1816/oicr-monitor` | `~/oicr-monitor` | fondi Fineco su dati Morningstar (`/api/data`, `/api/nav`) |
| ETF Monitor | `cb1816/etf-monitor` (**pubblico**) | `~/etf-monitor` | ETF, ETC ed ETN di Borsa Italiana su dati Morningstar (`/api/data`) |
| CRM (Portfolio Workbench) | `cb1816/portfolioworkbench` | `~/Suite/portfolioworkbench` | il libro dei clienti: resta sul Mac |

Chi legge chi: Magut legge OICR Monitor (fondi, e i NAV di `/api/prezzi`), ETF
Monitor (`/api/data`) e il Magut indicator di My Way (`magut-indicator.json`).
My Way legge ETF Monitor per i mercati obbligazionari. Il CRM legge Magut:
`/api/prezzi`, `/api/tattica`, `/api/rendimenti` e le revisioni in
`~/magut/data/revisioni` via `git pull`. **OICR Monitor ed ETF Monitor non si
archiviano**: il CRM non li legge piu', Magut e My Way si'. Prima di cambiare il
formato di una API, guardare chi la legge.

- **Si ragiona nel progetto My Way di Claude, si costruisce in Claude Code.**
  Le chat servono a decidere; il codice si cambia da una sessione di Claude
  Code aperta nella cartella del repository che cambia, che legge da sola il
  suo `CLAUDE.md`. Le vecchie strade (editor web di GitHub, «Upload files»,
  `finisci.sh` lanciato a mano) servivano quando dalle chat non si poteva fare
  push: restano solo come ripiego.
- **Una modifica si fa nel repository del progetto che cambia.** My Way non
  contiene gli altri: li collega. Una modifica che tocca due progetti sono due
  modifiche, una per repository. Una sola sessione di Claude per progetto alla
  volta.
- **Due Mac**: il Mac mini a Montorfano (casa, libro vero del CRM) e il MacBook
  Air nell'ufficio di Milano. Il codice passa solo da GitHub: `git pull` prima
  di cominciare, push dopo. Si puo' lavorare da tutti e due.
- **I dati dei clienti stanno solo nel CRM, solo sui Mac**: mai su GitHub, mai
  su Vercel, mai in una chat o in una sessione nel cloud. Verso Magut escono
  solo ISIN.
- **Nei file versionati, di qualunque progetto**: niente nomi di clienti e
  niente codici cliente (`CL-...`, `POL-...`) accanto a importi. I repository
  sono privati tranne `etf-monitor`, che e' pubblico; e la storia di git non
  si cancella.
- **Il merge su `main` di Magut, My Way, OICR Monitor ed ETF Monitor pubblica
  in produzione su Vercel**: lo fa Corrado.
