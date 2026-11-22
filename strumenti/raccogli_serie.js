// Uso: node strumenti/raccogli_serie.js <cartella di lavoro> — rilanciare finche' esce con codice 0 (2 = fermo per 429, riprende da li').
// Alla fine scrive <cartella>/series.json da copiare in data/; poi aggiornare SERIE_FINE in api/data.js. Vedi METODOLOGIA.md §12.
// Raccoglie serie mensili cumulative 5 anni per gli ISIN dello screener ETEXG$XMIL.
// Ripresa: stato in stato.json (isin -> stringa | "" se vuota). Al primo 429 salva ed esce (codice 2).
const fs = require('fs');
const DIR = process.argv[2];
if (!DIR) { console.error('uso: node strumenti/raccogli_serie.js <cartella di lavoro>'); process.exit(1); }
fs.mkdirSync(DIR, { recursive: true });
const START = '2021-11-30', END = '2026-10-31'; // da aggiornare a ogni giro: END = ultima fine mese, START = 5 anni prima
const H = {'User-Agent':'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36',
  'Accept':'application/json, text/plain, */*','Accept-Language':'it-IT,it;q=0.9','Referer':'https://www.morningstar.it/','Origin':'https://www.morningstar.it'};
const SCR = 'https://lt.morningstar.com/api/rest.svc/9vehuxllxs/security/screener';
const TS = 'https://lt.morningstar.com/api/rest.svc/timeseries_cumulativereturn/1c6qh1t6k9';
const DP = 'isin|SecId|Name|GBRReturnM0|GBRReturnM1|GBRReturnM3|GBRReturnM6|GBRReturnM12|closePriceDate';

async function universo() {
  const f = DIR + '/universo.json';
  if (fs.existsSync(f)) return JSON.parse(fs.readFileSync(f));
  const rows = [];
  for (let page = 1; page <= 2; page++) {
    const url = SCR + '?page=' + page + '&pageSize=5000&sortOrder=Name%20asc&outputType=json&version=1&languageId=it-IT&currencyId=EUR&universeIds=ETEXG%24XMIL&securityDataPoints=' + encodeURIComponent(DP);
    const r = await fetch(url, { headers: H });
    if (!r.ok) throw new Error('screener HTTP ' + r.status);
    const j = await r.json(); rows.push(...(j.rows || []));
    if (rows.length >= (j.total || 0) || !(j.rows || []).length) break;
  }
  if (rows.length < 2000) throw new Error('screener incompleto: ' + rows.length);
  const seen = new Set(), u = [];
  for (const r of rows) { if (!r.isin || seen.has(r.isin)) continue; seen.add(r.isin); u.push(r); }
  fs.writeFileSync(f, JSON.stringify(u));
  return u;
}

const fmt = v => { const s = (Math.round(v * 10) / 10).toFixed(1); return s === '-0.0' ? '0.0' : s; };

async function main() {
  const u = await universo();
  const statoF = DIR + '/stato.json';
  const stato = fs.existsSync(statoF) ? JSON.parse(fs.readFileSync(statoF)) : {};
  const todo = u.filter(r => !(r.isin in stato) && r.SecId);
  console.log(`universo ${u.length}, fatti ${Object.keys(stato).length}, da fare ${todo.length}`);
  let stop = false, i = 0, fatti = 0;
  const save = () => fs.writeFileSync(statoF, JSON.stringify(stato));
  async function worker() {
    while (!stop && i < todo.length) {
      const r = todo[i++];
      const url = TS + '?id=' + encodeURIComponent(r.SecId + ']2]0]ETEXG$XMIL') + '&currencyId=EUR&idtype=Morningstar&frequency=monthly&startDate=' + START + '&endDate=' + END + '&outputType=COMPACTJSON';
      let res;
      try { res = await fetch(url, { headers: H }); } catch (e) { console.log('rete', r.isin, e.message); stop = true; break; }
      if (res.status === 429) { console.log('429 su', r.isin, '— mi fermo'); stop = true; break; }
      if (!res.ok) { console.log('HTTP', res.status, r.isin, '— mi fermo'); stop = true; break; }
      const a = JSON.parse(await res.text() || '[]');
      stato[r.isin] = a.length ? a.map(p => fmt(p[1])).join(',') : '';
      stato['@' + r.isin] = a.length ? new Date(a[a.length - 1][0]).toISOString().slice(0, 10) : '';
      if (++fatti % 50 === 0) { save(); console.log('…', fatti); }
    }
  }
  await Promise.all([worker(), worker(), worker(), worker()]);
  save();
  const resto = u.filter(r => !(r.isin in stato) && r.SecId).length;
  console.log(`fatti in questo giro ${fatti}, restano ${resto}`);
  if (!resto) {
    const ser = {};
    for (const [k, v] of Object.entries(stato)) if (k[0] !== '@' && v) ser[k] = v;
    fs.writeFileSync(DIR + '/series.json', JSON.stringify(ser));
    console.log('scritto', DIR + '/series.json:', Object.keys(ser).length, 'serie');
  }
  process.exit(resto ? 2 : 0);
}
main().catch(e => { console.error(e); process.exit(1); });
