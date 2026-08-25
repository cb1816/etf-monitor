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
