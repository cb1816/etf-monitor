'use strict';
/* ETF Monitor — banco di prova del MOTORE (api/data.js). Nessuna dipendenza: `node test/motore.test.js`.
   Nato dal porting di un secondo motore (`metriche.js`) che viveva fuori dal repo e ripeteva le
   stesse formule: il codice è stato buttato, i suoi 50 test sono qui, puntati su quello che gira
   davvero. Quando si tocca una formula in api/data.js, questo file deve fallire o cambiare. */

const P = require('../api/data.js');
let ok = 0, ko = 0;
const eq = (nome, a, b) => {
  const pass = JSON.stringify(a) === JSON.stringify(b);
  if (pass) ok++;
  else { ko++; console.log('  FALLITO ' + nome + ': ' + JSON.stringify(a) + ' != ' + JSON.stringify(b)); }
};

/* ---------- statistica di base ---------- */
eq('mediana dispari', P.median([3, 1, 2]), 2);
eq('mediana pari', P.median([4, 1, 2, 3]), 2.5);
eq('mediana con null', P.median([1, null, 3, undefined]), 2);
eq('mediana vuota', P.median([null]), null);
eq('quantile tipo7 mediana', P.quantile([1, 2, 3, 4], 0.5), 2.5);
eq('quantile tipo7 q1', P.quantile([1, 2, 3, 4], 0.25), 1.75);
eq('quantile tipo7 q3', P.quantile([1, 2, 3, 4], 0.75), 3.25);
eq('percentile mediano', P.percentile([1, 2, 3], 2), 50);
eq('percentile massimo', P.percentile([1, 2, 3], 3), 83.3);
eq('percentile pari merito', P.percentile([5, 5, 5, 5], 5), 50);

/* ---------- formule del documento (§5) ---------- */
// Mom. 12-1 = (1+r12)/(1+m1) - 1
eq('mom121 canonico', P.mom121(12, 2), 9.8);
eq('mom121 m1 negativo', P.mom121(10, -5), 15.79);
eq('mom121 null', P.mom121(null, 2), null);
// Accelerazione = 4*m3 - 2*m6
eq('accel positiva', P.accelerazione(6, 9), 6);
eq('accel negativa', P.accelerazione(-1, 5), -14);
eq('accel null', P.accelerazione(1, null), null);

/* ---------- macro (§10) ---------- */
eq('macro cripto', P.macroOf('Asset Digitali'), 'Cripto');
eq('macro ETC', P.macroOf('Materie Prime - Metalli Preziosi'), 'Materie Prime (ETC)');
eq('macro ETC minuscolo', P.macroOf('Materie prime - Metalli Industriali'), 'Materie Prime (ETC)');
eq('macro ETP leva', P.macroOf('Trading - Azionario Leveraged/Inverse'), 'Leva e Inverse (ETP)');
eq('macro azionari', P.macroOf('Azionari USA Large Cap Blend'), 'Azionari');
eq('macro target maturity', P.macroOf('Fondi Obiettivo 2046+'), 'Obbligazionari');
eq('macro residuo', P.macroOf('Altro'), 'Altro');
// etichette allineate a OICR Monitor, o il confronto fra le due app salta
eq('bilanciati, non multi-asset', P.macroOf('Bilanciati Prudenti EUR - Globali'), 'Bilanciati');
// i convertibili si chiamano "Obbligazionari Convertibili ...": vanno staccati PRIMA
eq('convertibili staccati dagli obbligazionari',
   P.macroOf('Obbligazionari Convertibili Globale'), 'Convertibili');
eq('convertibili hedged staccati',
   P.macroOf('Obbligazionari Convertibili Globali - EUR hedged'), 'Convertibili');
eq('obbligazionari normali restano', P.macroOf('Obbligazionari Governativi EUR'), 'Obbligazionari');

/* ---------- computeCats su un universo finto ----------
   Record schema 2 (§11): 0 isin, 1 name, 2 cat, 3 macro, 4 ytd, 5 m1, 6 m3, 7 m6, 8 r1, 9 r3,
   10 r5, 11 star, 12 sd, 13 ter, 14 mom, 15 nc, 16 w1, 17 secId, 18 terQ, 19 aum, 20 anno,
   21 mdd, 22 sharpe, 23 ticker, 24 stale, 25 ccy */
function riga(isin, name, cat, m1, m3, m6, r1, ter, aum) {
  const f = new Array(26).fill(null);
  f[0] = isin; f[1] = name; f[2] = cat; f[3] = P.macroOf(cat);
  f[5] = m1; f[6] = m3; f[7] = m6; f[8] = r1;
  f[12] = 10; f[13] = ter; f[15] = 1; f[19] = aum; f[20] = 2020; f[24] = 0;
  return f;
}
function blocco(pref, cat, m1, m3, m6, r1, ters) {
  return ters.map((t, i) => riga(pref + i, pref + '-' + i, cat, m1, m3, m6, r1, t, 1000 - i * 100));
}
// tre categorie ammesse (>= 5 strumenti) più una sotto soglia, così il percentile dentro la
// macro ha una popolazione vera su cui calcolarsi
const funds = [].concat(
  blocco('A', 'Azionari USA Large Cap Blend', 2, 6, 9, 12, [0.05, 0.10, 0.20, 0.30, 0.40, 0.50]),
  blocco('C', 'Azionari Europa Large Cap Blend', 1, 3, 4, 6, [0.10, 0.15, 0.25, 0.35, 0.45]),
  blocco('D', 'Azionari Giappone Large Cap Blend', -1, -2, -3, -4, [0.12, 0.18, 0.22, 0.28, 0.38]),
  [riga('B1', 'Eta', 'Azionari Italia', 1, 2, 3, 4, 0.20, 90),
   riga('B2', 'Theta', 'Azionari Italia', 1, 2, 3, 4, 0.20, 80),
   riga('B3', 'Iota', 'Azionari Italia', 1, 2, 3, 4, 0.20, 70)]
);
const cats = P.computeCats(funds);
const usa = cats.find(c => c.nome === 'Azionari USA Large Cap Blend');
const jap = cats.find(c => c.nome === 'Azionari Giappone Large Cap Blend');
const ita = cats.find(c => c.nome === 'Azionari Italia');

eq('n categoria grande', usa.n, 6);
eq('n categoria piccola', ita.n, 3);
eq('trend = mediana 6 mesi', usa.trend, 9);
eq('mom121 di categoria', usa.mom121, P.mom121(12, 2));
eq('accel di categoria', usa.accel, 6);
eq('sotto soglia niente score', ita.score, null);
eq('sopra soglia score presente', usa.score !== null, true);
eq('ampiezza calcolata sulla macro, uguale per tutte', usa.ampiezza, ita.ampiezza);
eq('score ordina dentro la macro', usa.score > jap.score, true);
eq('mediana TER di categoria', usa.terMed, P.median([0.05, 0.10, 0.20, 0.30, 0.40, 0.50]));

// ampiezza = quota di CATEGORIE della macro con m1 e m3 entrambi positivi (3 su 4 qui)
eq('ampiezza di macro', usa.ampiezza, 75);
// dispersione = IQR dei 3 mesi TRA le categorie della macro
eq('dispersione di macro', usa.disp, P.quantile([6, 3, -2, 2], 0.75) - P.quantile([6, 3, -2, 2], 0.25));

// macro con una sola categoria: niente percentile, quindi niente score (limite noto, §5)
const soloUna = P.computeCats([0, 1, 2, 3, 4].map(i =>
  riga('M' + i, 'M' + i, 'Monetari EUR', 1, 2, 3, 4, 0.1, 10)));
eq('macro con una sola categoria non ha score', soloUna[0].score, null);

// quartile di TER scritto dentro il record, indice 18 (1 = più economico)
eq('TER più basso in Q1', funds.find(f => f[0] === 'A0')[18], 1);
eq('TER più alto in Q4', funds.find(f => f[0] === 'A5')[18], 4);
eq('niente quartile sotto 4 valori', funds.find(f => f[0] === 'B1')[18], null);

/* ---------- upgradeSnapshot: lo snapshot in schema 1 va convertito, non rotto ---------- */
const snap1 = {
  funds: [['IE1', 'Alfa', 'Azionari USA Large Cap Blend', null, 5, 1, 2, 3, 4, 5, 6, 4, 10, 0.2],
          ['IE2', 'Beta', 'Obbligazionari Convertibili Globale', null, 1, 0, 1, 1, 2, 2, 2, 3, 4, null]],
  meta: { date: '27/07/2026', source: 'test' }
};
const up = P.upgradeSnapshot(snap1);
eq('schema alzato a 2', up.meta.schema, 2);
eq('macro ricalcolata dal nome', up.funds[0][3], 'Azionari');
eq('convertibili riconosciuti anche nello snapshot', up.funds[1][3], 'Convertibili');
eq('categorie ricalcolate', up.cats.length, 2);
eq('senza TER contati', up.meta.nNoTer, 1);
eq('minN dichiarato', up.meta.minN, 5);
eq('fonte marcata come convertita', /schema 1 convertito/.test(up.meta.source), true);
eq('uno snapshot già in schema 2 non si ritocca',
   P.upgradeSnapshot({ funds: [], meta: { schema: 2, source: 'x' } }).meta.source, 'x');

console.log(ok + ' test superati, ' + ko + ' falliti');
process.exit(ko ? 1 : 0);
