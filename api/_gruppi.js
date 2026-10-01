'use strict';
/* ETF Monitor — gruppo-indice ed efficienza di replica (tracking difference relativa).
   Modulo di api/data.js. Il prefisso "_" impedisce a Vercel di esporlo come endpoint.

   Perche': le categorie Morningstar mescolano indici diversi (S&P 500, Equal Weight, ESG,
   fattori, attivi...). Ordinare per TER dentro la categoria confronta indici diversi.
   Qui gli ETF vengono raggruppati per INDICE, e dentro un gruppo si misura quanto ciascuno
   rende in piu' o in meno dei gemelli: e' la tracking difference, al netto dell'indice.

   Chiave = famiglia d'indice + varianti + hedged, estratta dal NOME. Nel dubbio non si
   raggruppa: ESG (indici troppo diversi fra loro), leva/short, categorie Trading -> nessun
   gruppo. Obbligazionari: il fornitore dell'indice quasi mai e' nel nome, quindi il gruppo
   e' "segmento + scadenza" e puo' mescolare fornitori diversi: soglia piu' stretta.

   TD = pendenza (OLS su 36 mesi) del log-scarto cumulato fra l'ETF e la mediana mensile del
   gruppo, annualizzata. Le serie Morningstar hanno sfasamenti di data/cambio (scarti alterni
   +-1-2% mese su mese su diverse linee "USD ... EUR"): il tracking error mensile NON e'
   misurabile, e una TD da inizio a fine finestra erediterebbe quel rumore agli estremi.
   La pendenza lo assorbe. Rumore = dev. std. dei residui; sopra 0,75% l'ETF e' "sporco".

   Controllo di sanita' per gruppo: >= 3 ETF puliti e dispersione delle TD sotto soglia
   (azionari 1,5 punti, metalli 1,0, obbligazionari 0,5). Stati: ok | fallito | pochi.

   Riferimento: claude/ETF_Monitor_gruppo_indice_prototipo.py (Python) e
   claude/ETF_Monitor_gruppo_indice_risultati.md nel progetto. Le regole qui devono restare
   identiche a quelle: test/gruppi.test.js controlla i casi difficili trovati a mano.
   Ogni famiglia nuova va riletta membro per membro: la soglia da sola non basta. */

const N = 36;
const SOGLIA = { az: 1.5, met: 1.0, obb: 0.5 };
const RUMORE_MAX = 0.75;

const AZ = [
  ['S&P 500', /s\s*&\s*p\s*500/],
  ['S&P 100', /s\s*&\s*p\s*100/],
  ['Nasdaq 100', /nasdaq[\s-]*100|nasdaq\s*nxt|\bndx\b/],
  ['Dow Jones', /dow\s*jones\s*ind|\bdjia\b/],
  ['Euro Stoxx 50', /euro\s*stoxx\s*50|eurostoxx\s*50/],
  ['Stoxx Europe 50', /stoxx\s*europe\s*50\b|stoxx\s*eu(ro)?pe?\s*50\b/],
  ['Stoxx Europe 600', /stoxx\s*(europe|eurp|eur)\s*600/],
  ['Euro Stoxx', /euro\s*stoxx(?!\s*\d)/],
  ['DAX', /\bdax\b/],
  ['FTSE MIB', /ftse\s*mib/],
  ['FTSE 100', /ftse\s*100/],
  ['CAC 40', /cac\s*40/],
  ['IBEX 35', /ibex/],
  ['SMI', /\bsmi\b/],
  ['Nikkei 225', /nikkei/],
  ['Topix', /topix/],
  ['MSCI ACWI', /msci\s*(acwi|all\s*c(ou)?ntry|ac\s*world)/],
  ['MSCI EM Asia', /msci\s*em(erging)?\s*(mkts\s*)?asia/],
  ['MSCI EM Latin America', /msci\s*em(erging)?\s*(mkts\s*)?lat/],
  ['MSCI EM', /msci\s*(em\b|emerg|emg|em\s*mkts|emerging)/],
  ['MSCI World', /msci\s*(world|wld|wrld)/],
  ['MSCI North America', /msci\s*(north\s*amer|na\b)/],
  ['MSCI USA', /msci\s*usa/],
  ['MSCI EMU', /msci\s*emu/],
  ['MSCI Europe', /msci\s*(europe|eurp|eur\b)(?!\s*(ig|hy|corp))/],
  ['MSCI Japan', /msci\s*japan/],
  ['MSCI Pacific ex Japan', /msci\s*pac(ific)?\s*ex/],
  ['MSCI China A', /msci\s*china\s*a\b/],
  ['MSCI China', /msci\s*china/],
  ['MSCI India', /msci\s*india/],
  ['MSCI Korea', /msci\s*korea/],
  ['MSCI Taiwan', /msci\s*taiwan/],
  ['MSCI Brazil', /msci\s*brazil/],
  ['MSCI Canada', /msci\s*canada/],
  ['MSCI Australia', /msci\s*australia/],
  ['MSCI UK', /msci\s*uk/],
  ['MSCI Switzerland', /msci\s*switz/],
  ['MSCI Germany', /msci\s*germ/],
  ['MSCI Italy', /msci\s*italy/],
  ['FTSE All-World', /ftse\s*all[\s-]*world/],
  ['FTSE Developed World', /ftse\s*dev(eloped)?\s*w(or)?ld/],
  ['FTSE Developed Europe', /ftse\s*dev(eloped)?\s*e(u)?r(o)?p/],
  ['FTSE North America', /ftse\s*north\s*america/],
  ['FTSE Emerging', /ftse\s*em(erg|\s*mkts|erging)/],
  ['FTSE Japan', /ftse\s*japan/],
  ['FTSE EPRA Nareit', /ftse\s*epra/]
];

const MET = [
  ['Oro fisico', /phys(ical|cl)?\s*(swiss\s*)?g(o)?ld|gold\s*bullion|core\s*physical\s*gold|physical\s*gold/],
  ['Argento fisico', /phys(ical|cl)?\s*silver/],
  ['Platino fisico', /phys(ical|cl)?\s*platinum/],
  ['Palladio fisico', /phys(ical|cl)?\s*palladium/]
];

// obbligazionari: segmento; la scadenza si aggiunge dopo. L'ordine conta.
const OBB = [
  ['Govt Italia', /(ital(y|ian)|btp).*(govt|gov|bond|bd)|btp/],
  ['Govt Germania', /(ger(many)?|german|bund).*(govt|gov|bd)/],
  ['Govt Francia', /franc.*(govt|gov|oat)/],
  ['Govt Spagna', /spain.*(govt|gov)/],
  ['Inflation EUR', /(€|eur|euro).*(infl|linker|ilb)|infl.*(€|eur|euro)/],
  ['TIPS USA', /tips|us\s*infl/],
  ['Govt EUR', /(€|eur(o|oz|ozone|z)?|emu)\s*.*(govt|gov|government|sov|treas)/],
  ['Treasury USA', /(us\s*treas|\$\s*treas|usd\s*treas|treasury|us\s*govt|\bust\b)/],
  ['High Yield EUR', /(€|eur(o)?)\s*.*(high\s*y(ie)?ld|\bhy\b)/],
  ['High Yield USD', /(\$|usd|us)\s*.*(high\s*y(ie)?ld|\bhy\b)/],
  ['EM valuta locale', /(em|emerg)\w*\s*.*(lcl|local|\blc\b|\bl\s*govt)/],
  ['EM High Yield', /(em|emerg)\w*\s*.*(\bhy\b|high\s*y)/],
  ['EM Corporate', /(em|emerg)\w*\s*.*(corp|crp)/],
  ['EM Bond USD', /(em|emerg).*(\$|usd).*(bd|bond|sov|govt)|jpm\s*em|(em|emerg)\s*.*(bd|bond)/],
  ['Corporate EUR', /(€|eur(o)?)\s*.*(corp|crp)/],
  ['Corporate USD', /(\$|usd|us)\s*.*(corp|crp)/],
  ['Aggregate EUR', /(€|eur(o)?)\s*.*agg/],
  ['Aggregate Global', /glob(al)?\s*.*agg/],
  ['Govt Globali', /glob(al)?\s*.*(govt|gov|treas)/],
  ['Monetario overnight USD', /usd\s*overnight|sofr/],
  ['Monetario overnight GBP', /gbp\s*overnight|sonia/],
  ['Monetario €STR', /overnight|€str|\bestr\b|short\s*term\s*rate|ovrnt/],
  ['Monetario cash EUR', /(€|eur(o)?)\s*.*(cash|money)/]
];

const VAR = [
  ['ESG', new RegExp('esg|sri\\b|sri[a-z]|scrn|scr\\b|screened|scrd|\\bpab\\b|paris|prs\\s*al|prs[-\\s]*algn|clmt|climate|ctb|' +
    'net\\s*zero|nt\\s*zr|sclly|socially|unvsl|universal|selection|\\bsel(ion)?\\b|ldrs|leaders|' +
    'brdtrnstn|transition|gender|cathl?c|cthlc|catholic|prncpls|elite|nsl\\b|low\\s*cb|circular|' +
    'aware|scored|green|grn|select\\b|\\bsst\\b|advcd|advanced|sust|rspnsbl|responsib|sdg|impact|fssl|fossil|carb|ex[-\\s]*st[-\\s]*ownd')],
  ['Leva/Short', /\bshort\b|lev(erage)?|\b[23]x\b|daily\s*(2|3|-)|inverse|\bbear\b|\bbull\b|dly\s*(2|3)/],
  ['ex-USA', /\bex[\s-]*us(a)?\b/],
  ['ex-UK', /\bex[\s-]*uk\b/],
  ['ex-EMU', /\bex\s*emu\b/],
  ['ex-Japan', /\bex[\s-]*j(a)?p(a)?n\b/],
  ['ex-China', /ex[\s-]*china|exchina/],
  ['All Shares', /all\s*shares?|cnct/],
  ['Capped', /capped|\bcpd\b|cpd\s*etf/],
  ['ex-Fin', /ex[\s-]*f(i)?n/],
  ['Equal Weight', /equal\s*w|eql\s*w|\bew\b|eq\s*wt|eq\s*wgt/],
  ['Min Vol', /min(i)?\s*vol|low\s*vol/],
  ['Min TE', /min\s*te(?![a-z]{2,}\b)|minte/],
  ['Quality', /qual|qul/],
  ['Momentum', /momentum|\bmom\b/],
  ['Value', /value|\bval\b|fdml|fundamental|rafi/],
  ['Dividendi', /div(idend)?|hi\s*div|high\s*div|aristocrat|arist|yield|yld|income|\binc(ome)?\s*$/],
  ['Small/Mid', /small|smcp|sm\s*cap|mid\s*cap|midcap|\bmid\b|mdcp|md[\s-]*cp/],
  ['Growth', /growth|grwth/],
  ['Fattori', new RegExp('factor|fctr|fac\\b|multi\\s*f|mltfct|qvm|moat|millennials|mega\\s*cap|top\\s*\\d+|titans|\\bsf\\b|fac\\s*mix|buyback|' +
    'covered\\s*call|\\bcc\\b|option|premium|defens')],
  ['Attivo/Enh', new RegExp('\\bact(i?ve?|v)?\\b|actv|enh|enhanced|active|research|rsh|rsrch|quant|alp\\b|3d\\b|engnrd|' +
    'ai\\s*enh|dynamic|advantage|strategic|tilt|tltd|plus|yld\\s*pl')],
  ['IMI', /\bimi\b|inv\s*mkt|all\s*cap/],
  ['Sett. Finanziari', /financ|fincl|\bfin\b|banks?\b|insur|\bins\b/],
  ['Sett. Tecnologia', /info(rmation)?\s*tech|\btech|\bit\b|semicon/],
  ['Sett. Salute', /health|hlth|hlthcr/],
  ['Sett. Energia', /energy|enrgy/],
  ['Sett. Utilities', /utilit/],
  ['Sett. Industriali', /indust|indstr|constr/],
  ['Sett. Materiali', /material|matls|mtrls|basic\s*res|bsc\s*(res|mtrls)|chem/],
  ['Sett. Consumi', /cnsmr|consumer|staples|discr|cons\s*(stpl|disc)/],
  ['Sett. Comunicazioni', /telecom|telecm|comm(unication)?\s*serv|comms|media/],
  ['Sett. Immobiliare', /real\s*estate|reit/],
  ['Sett. Altri', /auto(mobile)?s?\b|food|oil\s*&?\s*gas|retail|travel|pers\s*&|hhold|household/],
  ['Rating', /aaa|aa\b|highest\s*r|lowest\s*r|hghst|lwst|hr\b|macro\s*w|mcwtd|sov\s*div|sovcap|large\s*cap|lg\s*cp|covered|pfandbr/],
  ['Lunga durata', /lng\s*dtd|long\s*dated|long\s*dur|\blong\b|lg\s*dur/],
  ['Ultrashort', /ultra\s*short|ultrashort/],
  ['Fallen angels/Opps', /faln|fallen|opps|opportunit/],
  ['Breve durata', /s\/t|short\s*dur|shrt\s*dur|low\s*dur|lowdur|short[\s-]*term|\bst\b/],
  ['Ibridi/Sub/BBB', /hybrid|hybr|subord|\bsub\b|bbb|crossover|\bat1\b|coco/],
  ['Scadenza fissa', /(?<!\d)20[2-4]\d(?!\d)|ibonds|bullet|trgt\s*mat|target\s*mat|mat\s*(sep|dec)|fxd\s*mat|fixed\s*mat/],
  ['Futures', /(?<!physical\s)\bgold\s*etc\b|bloomberg\s*commod|bcom/]
];

const HEDGED = new RegExp('hgd|hdg|hedged|\\b(usd|eur|chf|gbp)\\s*h\\s*etf|acc\\s*h\\b|\\bh(eur|usd|chf|gbp)\\b|\\beur\\s*h\\b|\\beurh\\b|€\\s*h\\b|\\(h\\)|\\bh\\s*(usd|eur|chf|gbp)?\\s*(acc|dis)|' +
  '\\bh(acc|dis)\\b|etfh(usd|eur|chf|gbp)|\\bh\\s*etc\\b|\\bh\\s*\\d\\s*eur');
const SCAD = /(?<a>\d{1,2})\s*[-–]\s*(?<b>\d{1,2})\s*(?:y|yr|year|anni)?|(?<p>\d{1,2})\s*(?:y|yr)?\s*\+|(?<![\d.])(?<s>\d{1,2})\s*(?:y|yr)\b/;

function scadenza(n) {
  if (/\d+\s*m\s*-\s*1\s*y/.test(n)) return '0-1';
  const m = SCAD.exec(n);
  if (!m) return 'tutte';
  const g = m.groups;
  if (g.a) return (+g.a) + '-' + (+g.b);
  if (g.p) return (+g.p) + '+';
  return String(+g.s);
}

function classeCat(cat) {
  const c = cat || '';
  if (/^Trading/.test(c)) return null;
  if (/^(Obbligazionari|Fondi Obiettivo|Monetari|Liquidit)/.test(c)) return 'obb';
  if (/^Materie/.test(c)) return 'met';
  return 'az';
}

// stesso ordinamento di sorted() in Python: per punto di codice
const perCodice = (a, b) => (a < b ? -1 : a > b ? 1 : 0);

function chiave(nome, cat) {
  const cl = classeCat(cat);
  if (cl === null) return [null, null];
  const n = String(nome || '').toLowerCase();
  let v = [...new Set(VAR.filter(([, rx]) => rx.test(n)).map(([k]) => k))].sort(perCodice);
  if (v.includes('ex-Fin')) v = v.filter(x => x !== 'Sett. Finanziari');
  if (v.includes('ESG') || v.includes('Leva/Short')) return [null, cl];
  const h = HEDGED.test(n);
  // in "Altro" finiscono classi coperte senza "hedged" nel nome (Xtrackers 2C/4C/5C...)
  if (['Azionari Altro', 'Obbligazionari Altro'].includes(String(cat || '').trim()) && !h) return [null, cl];
  let base = null;
  if (cl === 'az') {
    const t = AZ.find(([, rx]) => rx.test(n)); base = t ? t[0] : null;
  } else if (cl === 'met') {
    const t = MET.find(([, rx]) => rx.test(n)); base = t ? t[0] : null;
    v = v.filter(x => x === 'Futures');
  } else {
    const t = OBB.find(([, rx]) => rx.test(n)); base = t ? t[0] + ' ' + scadenza(n) : null;
    v = v.filter(x => !x.startsWith('Sett.') &&
      !['Dividendi', 'Growth', 'Small/Mid', 'Value', 'Quality', 'Momentum'].includes(x));
  }
  if (base === null) return [null, cl];
  return [[base].concat(v).join(' + ') + (h ? ' · hedged' : ''), cl];
}

function mensili(s) {
  if (!s) return null;
  const g = String(s).split(',').map(x => 1 + parseFloat(x) / 100);
  if (g.some(x => !isFinite(x)) || Math.min(...g) <= 0) return null;
  const r = [];
  for (let i = 1; i < g.length; i++) r.push(g[i] / g[i - 1] - 1);
  return r;
}

function mediana(a) {
  const v = a.slice().sort((x, y) => x - y), m = v.length >> 1;
  return v.length % 2 ? v[m] : (v[m - 1] + v[m]) / 2;
}
function pstdev(a) {
  const m = a.reduce((s, x) => s + x, 0) / a.length;
  return Math.sqrt(a.reduce((s, x) => s + (x - m) * (x - m), 0) / a.length);
}
const r2 = x => Math.round(x * 100) / 100;

/* funds: righe nel formato di api/data.js (0 isin, 1 nome, 2 categoria, 13 TER).
   series: {isin: "c0,c1,..."} rendimenti cumulati % mensili, ultimo punto = fine serie.
   Ritorna {g: [gruppi], f: {isin: [indiceGruppo, td, se, qualita]}}
   qualita: 0 pulito, 1 dati instabili, 2 meno di 3 anni di serie. td/se null se q=2. */
function calcolaRepliche(funds, series) {
  const gruppi = new Map();
  for (const f of funds) {
    const [k, cl] = chiave(f[1], f[2]);
    if (k === null) continue;
    const id = cl + '|' + k;
    if (!gruppi.has(id)) gruppi.set(id, { k, cl, membri: [] });
    gruppi.get(id).membri.push(f);
  }

  const g = [], f = {};
  for (const gr of gruppi.values()) {
    const gi = g.length;
    const info = { k: gr.k, cl: gr.cl, n: gr.membri.length, st: 'pochi', disp: null };
    g.push(info);
    const conSerie = [];
    for (const m of gr.membri) {
      const r = mensili(series && series[m[0]]);
      if (r && r.length >= N) conSerie.push([m, r.slice(-N)]);
      else f[m[0]] = [gi, null, null, 2];
    }
    if (conSerie.length < 3) {
      for (const [m] of conSerie) f[m[0]] = [gi, null, null, 2];
      continue;
    }
    const L = conSerie.map(([, r]) => {
      let acc = 0; const lv = [0];
      for (const x of r) { acc += Math.log(1 + x); lv.push(acc); }
      return lv;
    });
    const T = L[0].length;
    const med = [];
    for (let t = 0; t < T; t++) med.push(mediana(L.map(l => l[t])));
    const xm = (T - 1) / 2;
    let sxx = 0;
    for (let t = 0; t < T; t++) sxx += (t - xm) * (t - xm);
    const pul = [];
    conSerie.forEach(([m], i) => {
      const e = L[i].map((x, t) => x - med[t]);
      const em = e.reduce((s, x) => s + x, 0) / T;
      let b = 0;
      for (let t = 0; t < T; t++) b += (t - xm) * (e[t] - em);
      b /= sxx;
      const rs = e.map((x, t) => x - (em + b * (t - xm)));
      const sd = pstdev(rs);
      const td = r2((Math.exp(12 * b) - 1) * 100);
      const se = r2(12 * sd / Math.sqrt(sxx) * 100);
      const sporco = sd * 100 > RUMORE_MAX;
      f[m[0]] = [gi, td, se, sporco ? 1 : 0];
      if (!sporco) pul.push(td);
    });
    if (pul.length >= 2) info.disp = r2(Math.max(...pul) - Math.min(...pul));
    info.st = pul.length < 3 ? 'pochi' : (info.disp < SOGLIA[gr.cl] ? 'ok' : 'fallito');
  }
  return { g, f, finestra: N, soglie: SOGLIA };
}

module.exports = { calcolaRepliche, chiave, scadenza, classeCat };
