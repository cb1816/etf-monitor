// ETF Monitor — /api/data
// Scarica lo screener Morningstar (universo ETF/ETP Borsa Italiana ETEXG$XMIL) e
// restituisce l'oggetto DATA usato dal frontend.
// Cache edge: 6 ore. In caso di errore Morningstar -> snapshot statico.
//
// Impianto metriche: vedi ETF_Monitor_metodologia.md.
// Due punteggi separati, mai mescolati in un numero solo:
//   - ALLOCAZIONE, sulla categoria: trend 6m, Mom. 12-1, accelerazione, ampiezza
//     e dispersione di macro, score = percentile dentro la macro.
//   - SELEZIONE, sullo strumento: TER (valore + quartile di categoria), patrimonio, anzianita'.
// Niente momentum relativo alla categoria e niente consistenza: su strumenti che
// replicano lo stesso indice misurerebbero il TER travestito da bravura del gestore.

const fs = require('fs');
const path = require('path');

const API = 'https://lt.morningstar.com/api/rest.svc/9vehuxllxs/security/screener';
const DATAPOINTS = [
  'isin', 'SecId', 'Name', 'categoryName',
  'GBRReturnW1', 'GBRReturnM0', 'GBRReturnM1', 'GBRReturnM3', 'GBRReturnM6',
  'GBRReturnM12', 'GBRReturnM36', 'GBRReturnM60',
  'starRatingM255', 'StandardDeviationM36', 'OngoingCostActual', 'ongoingCharge',
  'FundTNAV', 'InceptionDate', 'ticker', 'closePriceDate',
  'MaxDrawdownM36', 'SharpeM36', 'currency', 'exchangeCode'
].join('|');

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36',
  'Accept': 'application/json, text/plain, */*',
  'Accept-Language': 'it-IT,it;q=0.9',
  'Referer': 'https://www.morningstar.it/',
  'Origin': 'https://www.morningstar.it'
};

// Sotto questa soglia niente metriche relative: una categoria con pochi strumenti
// e' la mediana di se' stessa e il percentile non ha popolazione su cui calcolarsi.
const MIN_N = 5;

// Macro. Etichette allineate all'app OICR dove le categorie coincidono ("Bilanciati",
// non "Multi-asset"; "Convertibili" staccati come sugli OICR il 20/08/2026).
// Lo screener NON espone il wrapper giuridico (investmentType vale "FO" su tutto
// l'universo): la separazione degli ibridi e' per categoria Morningstar.
const MACROS = ['Azionari', 'Obbligazionari', 'Convertibili', 'Monetari', 'Bilanciati',
  'Materie Prime (ETC)', 'Immobiliare', 'Alternativi', 'Leva e Inverse (ETP)', 'Cripto', 'Altro'];

function macroOf(cat) {
  const c = String(cat || '').trim();
  if (!c) return 'Altro';
  if (/^Asset Digitali/i.test(c)) return 'Cripto';
  if (/^Materie [Pp]rime/i.test(c)) return 'Materie Prime (ETC)';
  if (/^Trading -/i.test(c)) return 'Leva e Inverse (ETP)';
  if (/Convertibil/i.test(c)) return 'Convertibili';   // PRIMA di Obbligazionari:
  if (/^Azionari/i.test(c)) return 'Azionari';         // "Obbligazionari Convertibili ..."
  if (/^Obbligazionari/i.test(c)) return 'Obbligazionari';
  if (/^Fondi Obiettivo/i.test(c)) return 'Obbligazionari';   // target maturity
  if (/^(Monetari|Liquidit)/i.test(c)) return 'Monetari';
  if (/^Bilanciati/i.test(c)) return 'Bilanciati';
  if (/^Immobiliar/i.test(c)) return 'Immobiliare';
  if (/^(Alternativi|Hedge)/i.test(c)) return 'Alternativi';
  return 'Altro';
}

const r2 = v => (v === null || v === undefined || isNaN(v)) ? null : Math.round(v * 100) / 100;
const r1 = v => (v === null || v === undefined || isNaN(v)) ? null : Math.round(v * 10) / 10;

function median(a) {
  const v = a.filter(x => x !== null && x !== undefined && isFinite(x)).sort((x, y) => x - y);
  if (!v.length) return null;
  const m = v.length >> 1;
  return v.length % 2 ? v[m] : (v[m - 1] + v[m]) / 2;
}

// quantile lineare (tipo 7, come R e Excel)
function quantile(a, p) {
  const v = a.filter(x => x !== null && x !== undefined && isFinite(x)).sort((x, y) => x - y);
  if (!v.length) return null;
  if (v.length === 1) return v[0];
  const h = (v.length - 1) * p;
  const lo = Math.floor(h), hi = Math.ceil(h);
  return v[lo] + (h - lo) * (v[hi] - v[lo]);
}

// percentile di x dentro l'insieme a, 0-100; media dei ranghi sui pari merito
function percentile(a, x) {
  const v = a.filter(y => y !== null && y !== undefined && isFinite(y));
  if (v.length < 2 || x === null || x === undefined || !isFinite(x)) return null;
  let sotto = 0, pari = 0;
  for (const y of v) { if (y < x) sotto++; else if (y === x) pari++; }
  return Math.round(1000 * (sotto + pari / 2) / v.length) / 10;
}

// Mom. 12-1 = (1+r12)/(1+m1) - 1. Il classico, escluso l'ultimo mese che tende a invertire.
function mom121(r12, m1) {
  if (r12 === null || m1 === null) return null;
  const d = 1 + m1 / 100;
  if (d === 0) return null;
  return Math.round(((1 + r12 / 100) / d - 1) * 10000) / 100;
}

// Accelerazione = 4*m3 - 2*m6. Su scala diversa dal trend: non confrontare i due numeri.
function accelerazione(m3, m6) {
  if (m3 === null || m6 === null) return null;
  return Math.round((4 * m3 - 2 * m6) * 100) / 100;
}

function loadJSON(rel) {
  return JSON.parse(fs.readFileSync(path.join(process.cwd(), 'data', rel), 'utf8'));
}

async function fetchScreener() {
  const rows = [];
  for (let page = 1; page <= 2; page++) {
    const url = API + '?page=' + page + '&pageSize=5000&sortOrder=Name%20asc&outputType=json'
      + '&version=1&languageId=it-IT&currencyId=EUR&universeIds=ETEXG%24XMIL'
      + '&securityDataPoints=' + encodeURIComponent(DATAPOINTS);
    const res = await fetch(url, { headers: HEADERS });
    if (!res.ok) throw new Error('Morningstar HTTP ' + res.status);
    const j = await res.json();
    const batch = j.rows || j.securities || [];
    rows.push(...batch);
    const total = j.total || 0;
    if (rows.length >= total || batch.length === 0) break;
  }
  // Liveness check: meglio lo snapshot di ieri che una classifica costruita su meta' universo.
  // Gli aggiornamenti del 3, 10 e 17 agosto sono andati persi in silenzio per la mancanza di questo.
  if (rows.length < 2000) throw new Error('Screener incompleto: ' + rows.length + ' righe');
  return rows;
}

// normalizza il nome per raggruppare le linee/valute dello stesso prodotto (badge "N linee")
function baseName(name) {
  return (name || '')
    .toUpperCase()
    .replace(/\b(CLASS(E|IC)?|CL|R\/?[AD]?|RE\/?[AD]?|H-?(EUR|USD|GBP|CHF)|EUR|USD|GBP|CHF|JPY|ACC(UMULAT\w*)?|DIS(T(RIBUT\w*)?)?|INC|CAP(ITALIS\w*)?|HEDGED|HDG|[A-Z]\d?|\d+)\b/g, ' ')
    .replace(/[^A-Z]+/g, ' ')
    .trim();
}

// Aggregati di categoria + quartile TER + score di allocazione.
// Estratta da build() perche' serve anche a rigenerare le metriche su uno
// snapshot vecchio (schema 1), evitando di dover riscrivere il file da 600 KB.
function computeCats(funds) {
  const perCat = new Map();
  for (const f of funds) {
    if (!f[2]) continue;
    if (!perCat.has(f[2])) perCat.set(f[2], []);
    perCat.get(f[2]).push(f);
  }

  const cats = [];
  for (const [nome, membri] of perCat) {
    const med = i => median(membri.map(f => f[i]));
    const cm1 = med(5), cm3 = med(6), cm6 = med(7), cr1 = med(8), cr3 = med(9);
    cats.push({
      nome, macro: macroOf(nome), n: membri.length,
      m1: r2(cm1), m3: r2(cm3), m6: r2(cm6), r1: r2(cr1), r3: r2(cr3),
      trend: r2(cm6),
      mom121: mom121(cr1, cm1),
      accel: accelerazione(cm3, cm6),
      sd: r1(med(12)), mdd: r2(med(21)), terMed: r2(med(13)),
      ampiezza: null, disp: null, score: null
    });

    // quartile di TER dentro la categoria (1 = piu' economico)
    const ters = membri.map(f => f[13]).filter(t => t !== null && t !== undefined);
    if (ters.length >= 4) {
      const q1 = quantile(ters, 0.25), q2 = quantile(ters, 0.5), q3 = quantile(ters, 0.75);
      for (const f of membri) {
        if (f[13] === null || f[13] === undefined) continue;
        f[18] = f[13] <= q1 ? 1 : f[13] <= q2 ? 2 : f[13] <= q3 ? 3 : 4;
      }
    }
  }

  // ampiezza, dispersione e score si calcolano per MACRO
  const perMacro = new Map();
  for (const c of cats) {
    if (!perMacro.has(c.macro)) perMacro.set(c.macro, []);
    perMacro.get(c.macro).push(c);
  }

  for (const [, gruppo] of perMacro) {
    // Ampiezza di MACRO: quota di CATEGORIE con 1 e 3 mesi entrambi positivi.
    // Non la quota di strumenti dentro la categoria: li' replicano tutti la stessa
    // cosa, quindi uscirebbe 0% o 100% e non direbbe nulla.
    const conDati = gruppo.filter(c => c.m1 !== null && c.m3 !== null);
    const amp = conDati.length
      ? Math.round(1000 * conDati.filter(c => c.m1 > 0 && c.m3 > 0).length / conDati.length) / 10
      : null;
    // Dispersione: scarto interquartile dei 3 mesi TRA le categorie della macro.
    const q1 = quantile(gruppo.map(c => c.m3), 0.25);
    const q3 = quantile(gruppo.map(c => c.m3), 0.75);
    const disp = (q1 === null || q3 === null) ? null : Math.round((q3 - q1) * 100) / 100;

    const amm = gruppo.filter(c => c.n >= MIN_N);
    const vT = amm.map(c => c.trend), vM = amm.map(c => c.mom121), vA = amm.map(c => c.accel);

    for (const c of gruppo) {
      c.ampiezza = amp;
      c.disp = disp;
      if (c.n < MIN_N) continue;
      // Composito: media semplice dei tre percentili dentro la macro. La metodologia
      // non fissa i pesi — scelta esplicita, si cambia qui.
      const p = [percentile(vT, c.trend), percentile(vM, c.mom121), percentile(vA, c.accel)]
        .filter(x => x !== null);
      c.score = p.length ? Math.round(p.reduce((a, b) => a + b, 0) / p.length * 10) / 10 : null;
    }
  }

  cats.sort((a, b) => {
    const oa = MACROS.indexOf(a.macro), ob = MACROS.indexOf(b.macro);
    if (oa !== ob) return oa - ob;
    if (a.score !== b.score) {
      if (a.score === null) return 1;
      if (b.score === null) return -1;
      return b.score - a.score;
    }
    return a.nome.localeCompare(b.nome, 'it');
  });

  return cats;
}

// Porta uno snapshot vecchio (schema 1, 18 campi, macro vecchie) al formato nuovo.
// I campi che nello schema 1 non esistono (patrimonio, drawdown, ticker) restano
// assenti e l'interfaccia li mostra come "—": meglio un fallback parziale che rotto.
function upgradeSnapshot(snap) {
  if (!snap || !snap.funds || (snap.meta && snap.meta.schema >= 2)) return snap;
  for (const f of snap.funds) f[3] = macroOf(f[2]);
  snap.cats = computeCats(snap.funds);
  snap.catNames = snap.cats.map(c => c.nome);
  snap.macroOrder = MACROS;
  snap.meta = snap.meta || {};
  snap.meta.schema = 2;
  snap.meta.nCat = snap.cats.length;
  snap.meta.nCatSottoSoglia = snap.cats.filter(c => c.n < MIN_N).length;
  snap.meta.nNoTer = snap.funds.filter(f => f[13] === null || f[13] === undefined).length;
  snap.meta.nStale = 0;
  snap.meta.minN = MIN_N;
  snap.meta.source += ' · schema 1 convertito';
  return snap;
}

function build(rows, series) {
  const seen = new Set();
  const funds = [];

  // data di riferimento = moda di closePriceDate
  const dm = {};
  for (const r of rows) if (r.closePriceDate) dm[r.closePriceDate] = (dm[r.closePriceDate] || 0) + 1;
  const modaData = Object.keys(dm).sort((a, b) => dm[b] - dm[a])[0] || null;

  for (const r of rows) {
    const isin = r.isin || r.Isin;
    if (!isin) continue;
    const secId = r.SecId || isin;
    if (seen.has(isin)) continue; // stesso ISIN quotato in piu' valute = una riga sola
    seen.add(isin);
    const cat = r.categoryName ? String(r.categoryName).trim() : null;
    const m3 = r2(r.GBRReturnM3), m6 = r2(r.GBRReturnM6);
    const mom = (m3 !== null && m6 !== null) ? r2((m3 + m6) / 2) : (m3 !== null ? m3 : m6);
    // TER: OngoingCostActual con ripiego su ongoingCharge. Alza la copertura di ~120 strumenti.
    const ter = (r.OngoingCostActual !== null && r.OngoingCostActual !== undefined)
      ? r2(r.OngoingCostActual)
      : ((r.ongoingCharge !== null && r.ongoingCharge !== undefined) ? r2(r.ongoingCharge) : null);
    funds.push([
      isin,                       // 0
      r.Name ? String(r.Name).trim() : isin, // 1
      cat,                        // 2
      macroOf(cat),               // 3
      r2(r.GBRReturnM0),          // 4  ytd
      r2(r.GBRReturnM1),          // 5  m1
      m3,                         // 6
      m6,                         // 7
      r2(r.GBRReturnM12),         // 8  r1
      r2(r.GBRReturnM36),         // 9  r3 p.a.
      r2(r.GBRReturnM60),         // 10 r5 p.a.
      r.starRatingM255 || null,   // 11 stelle — non usato nell'interfaccia, vedi metodologia §9
      r1(r.StandardDeviationM36), // 12 sd
      ter,                        // 13 TER
      mom,                        // 14 momentum assoluto (legacy, non mostrato)
      1,                          // 15 nc, ricalcolato sotto
      r2(r.GBRReturnW1),          // 16 w1
      secId,                      // 17
      null,                       // 18 quartile TER dentro la categoria
      (r.FundTNAV !== null && r.FundTNAV !== undefined) ? Math.round(r.FundTNAV / 1e5) / 10 : null, // 19 patrimonio in M€
      r.InceptionDate ? +String(r.InceptionDate).slice(0, 4) : null, // 20 anno di partenza
      r2(r.MaxDrawdownM36),       // 21 max drawdown 36m
      r2(r.SharpeM36),            // 22 rendimento/volatilita' 3a
      r.ticker || null,           // 23 codice di negoziazione
      (modaData && r.closePriceDate && r.closePriceDate !== modaData) ? 1 : 0, // 24 prezzo vecchio
      (r.currency && r.currency !== 'EUR') ? r.currency : null // 25 valuta anomala
    ]);
  }

  // nc = numero di linee/valute dello stesso prodotto
  const groups = {};
  for (const f of funds) { const k = baseName(f[1]); groups[k] = (groups[k] || 0) + 1; }
  for (const f of funds) f[15] = groups[baseName(f[1])] || 1;

  funds.sort((a, b) => a[1].localeCompare(b[1], 'it'));

  const cats = computeCats(funds);

  // serie storiche solo per ISIN presenti
  const inUniverse = new Set(funds.map(f => f[0]));
  const ser = {};
  let nSeries = 0;
  for (const [k, v] of Object.entries(series)) if (inUniverse.has(k)) { ser[k] = v; nSeries++; }

  const nData = funds.filter(f => f[8] !== null || f[4] !== null).length;
  const date = new Date().toLocaleDateString('it-IT', { timeZone: 'Europe/Rome' });

  return {
    funds, cats,
    catNames: cats.map(c => c.nome),
    macroOrder: MACROS,
    series: ser,
    meta: {
      date, dataChiusura: modaData,
      source: 'Morningstar Italia · via Vercel',
      nTot: funds.length, nData, nSeries,
      nCat: cats.length,
      nCatSottoSoglia: cats.filter(c => c.n < MIN_N).length,
      nNoTer: funds.filter(f => f[13] === null).length,
      nStale: funds.filter(f => f[24] === 1).length,
      minN: MIN_N,
      schema: 2
    }
  };
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  // fuori dal try: servono anche allo snapshot in caso di fallback
  let series = {};
  try { series = loadJSON('series.json'); } catch (e) {}
  try {
    const rows = await fetchScreener();
    const data = build(rows, series);
    res.setHeader('Cache-Control', 's-maxage=21600, stale-while-revalidate=86400');
    res.status(200).json(data);
  } catch (err) {
    // Fallback: snapshot statico incluso nel repo, gia' nel formato schema 2
    try {
      const snap = upgradeSnapshot(loadJSON('snapshot.json'));
      snap.series = series;
      snap.meta.nSeries = Object.keys(series).length;
      snap.meta.source += ' · snapshot (refresh fallito: ' + String(err.message || err).slice(0, 80) + ')';
      res.setHeader('Cache-Control', 's-maxage=900');
      res.status(200).json(snap);
    } catch (e2) {
      res.status(500).json({ error: String(err.message || err) });
    }
  }
};

// esportato per i test locali
module.exports.build = build;
module.exports.computeCats = computeCats;
module.exports.upgradeSnapshot = upgradeSnapshot;
module.exports.macroOf = macroOf;
module.exports.mom121 = mom121;
module.exports.accelerazione = accelerazione;
module.exports.percentile = percentile;
module.exports.quantile = quantile;
module.exports.median = median;
