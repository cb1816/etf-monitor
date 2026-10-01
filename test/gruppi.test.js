'use strict';
/* ETF Monitor — banco di prova del gruppo-indice (api/_gruppi.js). `node test/gruppi.test.js`.
   I nomi qui sotto sono gli errori trovati rileggendo i gruppi a mano il 01/10/2026:
   abbreviazioni compresse dei nomi Morningstar che facevano entrare un intruso in un gruppo.
   Se una regola cambia e uno di questi torna dentro, il test deve fallire. */
const G = require('../api/_gruppi.js');
let ok = 0, ko = 0;
const eq = (nome, a, b) => {
  if (JSON.stringify(a) === JSON.stringify(b)) ok++;
  else { ko++; console.log('  FALLITO ' + nome + ': ' + JSON.stringify(a) + ' != ' + JSON.stringify(b)); }
};
const k = (n, c) => G.chiave(n, c)[0];

/* indici puri riconosciuti */
eq('S&P 500', k('iShares Core S&P 500 ETF USD Acc EUR', 'Azionari USA Large Cap Blend'), 'S&P 500');
eq('S&P 500 senza spazio', k('Stt Strt SPDR S&P 500ETF EUR', 'Azionari USA Large Cap Blend'), 'S&P 500');
eq('MSCI World abbreviato', k('State Street SPDR MSCI Wld ETF EUR', 'Azionari Internazionali Large Cap Blend'), 'MSCI World');
eq('oro fisico', k('iShares Physical Gold ETC EUR', 'Materie Prime - Metalli Preziosi'), 'Oro fisico');
eq('govt EUR 3-5', k('iShares € Govt Bond 3-5yr ETF EUR Dist EUR', 'Obbligazionari Governativi EUR'), 'Govt EUR 3-5');

/* intrusi trovati a mano: devono restare FUORI dal gruppo puro */
eq('Screened abbreviato', k('Xtrackers MSCI AC World Scr ETF 1C', 'Azionari Internazionali Large Cap Blend'), null);
eq('Min TE compresso', k('BNP Paribas EasyMSCIWldMinTEUCITSETF€Cap EUR', 'Azionari Internazionali Large Cap Blend'), 'MSCI World + Min TE');
eq('Catholic compresso', k('Franklin MSCI Wld Cthlc PrncplsETFUSDAcc EUR', 'Azionari Internazionali Large Cap Blend'), null);
eq('Mid cap equal weight', k('iShares MSCI Wld Md-Cp Eq Wgt UCITS ETF EUR', 'Azionari Internazionali Flex Cap'), 'MSCI World + Equal Weight + Small/Mid');
eq('Settoriale Advanced', k('iShares MSCI Wld Matrls SctrAdvcdETF$Inc EUR', 'Azionari Settore Beni Industriali'), null);
eq('ex China', k('Xtrackers MSCI Em Mkts ex China ETF 1C EUR', 'Azionari Paesi Emergenti ex-Cina'), 'MSCI EM + ex-China');
eq('China All Shares', k('Invesco MSCI China All Shares Cnct ETF EUR', 'Azionari Cina'), 'MSCI China + All Shares');
eq('Stoxx 600 settoriale', k('Amundi STOXX Europe 600 Indstr ETF Acc EUR', 'Azionari Settore Beni Industriali'), 'Stoxx Europe 600 + Sett. Industriali');
eq('Stoxx 600 assicurazioni', k('Amundi STOXX Europe 600 Ins ETF Acc EUR', 'Azionari Settore Servizi Finanziari'), 'Stoxx Europe 600 + Sett. Finanziari');
eq('green bond compresso', k('Invesco EUR Govt & RelatedGrnBdWtdETFDis EUR', 'Obbligazionari Governativi EUR'), null);
eq('scadenza in mesi', k('onemarkets MSCI Euro Govt Bd1M-1YETF€Acc', 'Obbligazionari Governativi Breve Termine EUR'), 'Govt EUR 0-1');
eq('Treasury long dated', k('Amundi US Treasury Bond Lng DtdETFAcc EUR', 'Obbligazionari Governativi USD'), 'Treasury USA tutte + Lunga durata');
eq('BTP 10 anni', k('Amundi Italy BTP Govt Bd 10Y ETF Acc', 'Obbligazionari Lungo Termine EUR'), 'Govt Italia 10');
eq('high yield non corporate', k('Xtrackers EUR HY Corp Bond ETF 1D EUR', 'Obbligazionari High Yield EUR'), 'High Yield EUR tutte');
eq('EM valuta locale', k('Stt Strt SPDR Blmbrg EM Lcl BdETF Acc EUR', 'Obbligazionari Paesi Emergenti Valuta Locale'), 'EM valuta locale tutte');
eq('overnight USD', k('Xtrackers USD Overnight Rate Swap ETF 1C EUR', 'Monetari - Altro'), 'Monetario overnight USD tutte');
eq('hedged "€ Acc H"', k('Stt Strt SPDR S&P 500ETF € Acc H EUR', 'Azionari Altro'), 'S&P 500 · hedged');
eq('hedged "hEUR"', k('UBS Core MSCI World ETF hEUR acc EUR', 'Azionari Altro'), 'MSCI World · hedged');
eq('coperto non dichiarato in Altro', k('Xtrackers MSCI Japan ETF 4C EUR', 'Azionari Altro'), null);
eq('leva esclusa', k('Xtrackers S&P 500 2x Leveraged Daily Swap ETF', 'Trading - Azionario Leveraged/Inverse'), null);
eq('oro su futures separato', k('WisdomTree Gold ETC EUR', 'Materie Prime - Metalli Preziosi'), null);

/* calcolo: tre gemelli identici tranne una deriva costante di -0,5% l'anno */
const serie = d => { let c = 1; const v = ['0']; for (let i = 1; i <= 40; i++) { c *= (1 + 0.01) * Math.pow(1 + d, 1 / 12); v.push(((c - 1) * 100).toFixed(4)); } return v.join(','); };
const funds = [['A', 'X MSCI Japan ETF', 'Azionari Giappone Large Cap Blend'],
               ['B', 'Y MSCI Japan ETF', 'Azionari Giappone Large Cap Blend'],
               ['C', 'Z MSCI Japan ETF', 'Azionari Giappone Large Cap Blend'],
               ['D', 'W MSCI Japan ETF', 'Azionari Giappone Large Cap Blend']];
const R = G.calcolaRepliche(funds, { A: serie(0), B: serie(0), C: serie(-0.005), D: '0,1,2' });
eq('gruppo ok', R.g[0].st, 'ok');
eq('TD gemello', R.f.A[1], 0);
eq('TD deriva -0,5%', R.f.C[1], -0.5);
eq('serie corta = qualita 2', R.f.D[3], 2);

console.log(ok + ' test superati, ' + ko + ' falliti');
process.exit(ko ? 1 : 0);
