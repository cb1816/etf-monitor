// ETF Monitor — interfaccia. Vedi ETF_Monitor_metodologia.md.
// Due punteggi separati: ALLOCAZIONE sulla categoria, SELEZIONE sullo strumento.
const DATA=window.DATA;
const F=DATA.funds,MO=DATA.macroOrder,META=DATA.meta,SER=DATA.series||{};
const CATS=Array.isArray(DATA.cats)&&typeof DATA.cats[0]==='object'?DATA.cats:[];
const CBY={};CATS.forEach(c=>CBY[c.nome]=c);
const MINN=META.minN||5;
const I={isin:0,name:1,cat:2,macro:3,ytd:4,m1:5,m3:6,m6:7,r1:8,r3:9,r5:10,star:11,
         sd:12,ter:13,mom:14,nc:15,w1:16,sec:17,terQ:18,aum:19,anno:20,mdd:21,shp:22,
         tick:23,stale:24,ccy:25};
const METRICS=[['1 sett.',16],['1 mese',5],['3 mesi',6],['6 mesi',7],['YTD',4],
               ['1 anno',8],['3 anni p.a.',9],['5 anni p.a.',10]];
let state={metric:7,macro:null,cat:null,q:'',tab:'rank',catSort:'score',tipo:null,leva:false};
const mLabel=()=>(METRICS.find(m=>m[1]===state.metric)||METRICS[3])[0];

document.getElementById('cnt').textContent=
  META.nTot.toLocaleString('it')+' strumenti · '+META.source+' · '+META.date;

/* ---------- formattazione ---------- */
function fmt(v,d){if(v===null||v===undefined)return'—';return(v>0?'+':'')+v.toFixed(d===undefined?1:d)+'%'}
function num(v,d){if(v===null||v===undefined)return'—';return v.toFixed(d===undefined?1:d)}
function fmtAcc(v){if(v===null||v===undefined)return'—';return(v>0?'+':'')+v.toFixed(1)+' pt'}
function cls(v){if(v===null||v===undefined)return'zero';return v>0.05?'pos':(v<-0.05?'neg':'zero')}
function esc(s){return String(s==null?'':s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]))}
/* Morningstar restituisce closePriceDate in ISO (2026-08-24). In interfaccia le date
   si mostrano sempre in gg/mm/aaaa: quello che e' gia' italiano passa intatto. */
function itDate(s){if(s==null||s==='')return s;const m=/^(\d{4})-(\d{2})-(\d{2})/.exec(String(s));
  return m?m[3]+'/'+m[2]+'/'+m[1]:String(s);}
function eur(v){if(v===null||v===undefined)return'—';return v>=1000?(v/1000).toFixed(1)+' mld €':v.toFixed(0)+' mln €'}
function jsq(s){return String(s).replace(/\\/g,'\\\\').replace(/'/g,"\\'")}

/* Stato della categoria. La metodologia non fissa una soglia di magnitudine per la
   nuova accelerazione, quindi si classifica per SEGNO e si mostra accanto il valore. */
function stato(c){
  if(!c||c.trend===null||c.accel===null)return null;
  if(c.trend>=0)return c.accel>0?{ico:'🚀',lbl:'In rafforzamento',k:'raff'}
                                :{ico:'⚠️',lbl:'In raffreddamento',k:'fred'};
  return c.accel>0?{ico:'↗️',lbl:'Possibile svolta',k:'svol'}
                  :{ico:'🔻',lbl:'In peggioramento',k:'peg'};
}

/* ---------- chip e filtri ---------- */
const mc=document.getElementById('metricChips');
METRICS.forEach(([lbl,idx])=>{const c=document.createElement('div');
  c.className='chip'+(idx===state.metric?' on':'');c.textContent=lbl;c.dataset.i=idx;
  c.onclick=()=>{state.metric=idx;[...mc.children].forEach(x=>x.classList.toggle('on',+x.dataset.i===idx));render()};
  mc.appendChild(c);});

const TIPI=['ETF','ETC','ETN-ETP'];
function tipoOf(f){const cat=String(f[I.cat]||'').toUpperCase();
  if(/TRADING|LEVERAGED|INVERSE/.test(cat))return 'ETN-ETP';
  const n=String(f[I.name]||'').toUpperCase();
  if(n.includes('ETC')&&!n.includes('ETF'))return 'ETC';
  if(n.includes('ETN')||n.includes('ETP'))return 'ETN-ETP';
  return 'ETF';}
/* ---------- leva e inverse: esclusi di default ----------
   Un 3x che fa +90% in 6 mesi non e' uno strumento "migliore": e' lo stesso indice
   moltiplicato, con decadimento da compounding, e in classifica occupa le prime
   posizioni per costruzione. Sono nascosti di default e richiamabili col chip ⚡.
   Riconoscimento: macro/categoria Morningstar "Trading -" (286 strumenti) piu' una
   rete di sicurezza sul nome, che recupera i 3x/-3x cripto classificati altrove (4). */
const LEVA_MACRO='Leva e Inverse (ETP)';
const LEVA_RE=/(^|[^a-z0-9])-?[1-9](?:[.,][0-9])?\s?x(?![a-z0-9])|\b(leverage|leveraged|inverse)\b/i;
function isLevaCat(c){c=String(c||'');return c===LEVA_MACRO||/^trading/i.test(c);}
function isLeva(f){return isLevaCat(f[I.macro])||isLevaCat(f[I.cat])||LEVA_RE.test(String(f[I.name]||''));}
function levaOn(){return state.leva||state.macro===LEVA_MACRO||isLevaCat(state.cat);}
function visibile(f){return levaOn()||!isLeva(f);}
const N_LEVA=F.filter(isLeva).length;

function calcMacroCounts(){const m={};F.forEach(f=>{
  if(!f[I.macro])return;
  if(!visibile(f)&&f[I.macro]!==LEVA_MACRO)return;   // il chip della macro leva resta tappabile
  if(state.tipo&&tipoOf(f)!==state.tipo)return;
  m[f[I.macro]]=(m[f[I.macro]]||0)+1});return m;}
const tch=document.getElementById('tipoChips');
function rebuild(){buildTipoChips();buildMacroChips();buildCatSel();render();}
function buildTipoChips(){if(!tch)return;tch.innerHTML='';const counts={};
  const base=F.filter(visibile);
  base.forEach(f=>{const t=tipoOf(f);counts[t]=(counts[t]||0)+1});
  const mk=(label,val)=>{const c=document.createElement('div');c.className='chip'+(state.tipo===val?' on':'');
    c.textContent=label;c.onclick=()=>{state.tipo=val;state.cat=null;rebuild()};tch.appendChild(c)};
  mk('Tutti ('+base.length+')',null);TIPI.forEach(t=>{if(counts[t])mk(t+' ('+counts[t]+')',t)});
  if(N_LEVA){const on=levaOn();const c=document.createElement('div');
    c.className='chip'+(on?' on':'');
    c.textContent=on?'⚡ leva e inverse incluse':'⚡ +'+N_LEVA+' a leva e inversi';
    c.onclick=()=>{const nuovo=!levaOn();state.leva=nuovo;
      if(!nuovo&&(state.macro===LEVA_MACRO||isLevaCat(state.cat))){state.macro=null;state.cat=null;}
      rebuild();};
    tch.appendChild(c);}}
const mch=document.getElementById('macroChips');
function buildMacroChips(){const mcount=calcMacroCounts();mch.innerHTML='';
  const all=document.createElement('div');all.className='chip'+(state.macro===null?' on':'');all.textContent='Tutte';
  all.onclick=()=>{state.macro=null;state.cat=null;buildMacroChips();buildCatSel();render()};mch.appendChild(all);
  MO.forEach(m=>{if(!mcount[m])return;const c=document.createElement('div');
    c.className='chip'+(state.macro===m?' on':'');c.textContent=m+' ('+mcount[m]+')';
    c.onclick=()=>{state.macro=(state.macro===m?null:m);state.cat=null;buildMacroChips();buildCatSel();render()};mch.appendChild(c);});}
const catSel=document.getElementById('catSel');
function buildCatSel(){const pool=F.filter(f=>f[I.cat]&&visibile(f)&&(!state.macro||f[I.macro]===state.macro)&&(!state.tipo||tipoOf(f)===state.tipo));
  const cnts={};pool.forEach(f=>cnts[f[I.cat]]=(cnts[f[I.cat]]||0)+1);
  const list=Object.keys(cnts).sort((a,b)=>a.localeCompare(b,'it'));
  catSel.innerHTML='<option value="">'+(state.macro?('Tutte le categorie '+esc(state.macro)):'Tutte le categorie Morningstar')+'</option>'+
    list.map(c=>'<option value="'+esc(c)+'">'+esc(c)+' ('+cnts[c]+')</option>').join('');catSel.value=state.cat||'';}
catSel.onchange=()=>{state.cat=catSel.value||null;render()};
document.getElementById('q').oninput=e=>{state.q=e.target.value.trim().toLowerCase();render()};
document.querySelectorAll('nav button').forEach(b=>b.onclick=()=>{state.tab=b.dataset.tab;
  document.querySelectorAll('nav button').forEach(x=>x.classList.toggle('on',x===b));render();});

/* ---------- selezione strumenti ---------- */
const val=f=>f[state.metric];
function withData(l){return l.filter(f=>val(f)!==null&&val(f)!==undefined)}
function pool(){return F.filter(f=>{
  if(!visibile(f))return false;
  if(state.tipo&&tipoOf(f)!==state.tipo)return false;
  if(state.macro&&f[I.macro]!==state.macro)return false;
  if(state.cat&&f[I.cat]!==state.cat)return false;
  if(state.q){const s=(f[I.name]+' '+f[I.isin]+' '+(f[I.tick]||'')+' '+(f[I.cat]||'')).toLowerCase();
    if(!s.includes(state.q))return false;}
  return true;});}

/* Spareggio (metodologia §7): a parita' di metrica → TER crescente, poi patrimonio
   decrescente, poi nome. Senza, le metriche a pochi valori distinti escono alfabetiche. */
function ordina(a,b){
  const va=val(a),vb=val(b);
  if(va!==vb){if(va===null||va===undefined)return 1;if(vb===null||vb===undefined)return -1;return vb-va;}
  const ta=a[I.ter]===null?Infinity:a[I.ter],tb=b[I.ter]===null?Infinity:b[I.ter];
  if(ta!==tb)return ta-tb;
  const aa=a[I.aum]===null?-1:a[I.aum],ab=b[I.aum]===null?-1:b[I.aum];
  if(aa!==ab)return ab-aa;
  return String(a[I.name]).localeCompare(String(b[I.name]),'it');}

function badges(f){let h='<div class="badges">';
  if(f[I.terQ]===1)h+='<span class="qbadge q1">TER Q1 · '+num(f[I.ter],2)+'%</span>';
  else if(f[I.terQ]===4)h+='<span class="qbadge q4">TER Q4 · '+num(f[I.ter],2)+'%</span>';
  else if(f[I.ter]!==null)h+='<span class="qbadge" style="background:var(--chip);color:var(--mut)">TER '+num(f[I.ter],2)+'%</span>';
  if(f[I.aum]!==null&&f[I.aum]<50)h+='<span class="qbadge q4">piccolo · '+eur(f[I.aum])+'</span>';
  if(f[I.stale]===1)h+='<span class="qbadge" style="background:var(--chip);color:var(--mut)">prezzo vecchio</span>';
  return h+'</div>';}

function rowCard(f,rank,rc){const v=val(f);
  return '<div class="card" onclick="detail(\''+f[I.isin]+'\')">'+(rank?'<div class="rank '+(rc||'')+'">'+rank+'</div>':'')+
    '<div class="info"><div class="nm">'+esc(f[I.name])+'</div>'+
    '<div class="ct">'+(f[I.tick]?esc(f[I.tick])+' · ':'')+esc(f[I.cat]||'—')+'</div>'+badges(f)+'</div>'+
    '<div class="val"><div class="pct '+cls(v)+'">'+fmt(v)+'</div></div></div>';}

/* ================= CLASSIFICA ================= */
function viewRank(){const list=withData(pool()).sort(ordina);
  if(!list.length)return'<div class="empty">Nessuno strumento con dati per questa selezione.</div>';
  let h='<div class="sec">Classifica per rendimento '+mLabel()+' · '+list.length+' strumenti</div>';
  if(!levaOn()&&N_LEVA)h+='<div class="note" style="margin:0 4px 8px">Esclusi '+N_LEVA+' strumenti a '+
    'leva e inversi: moltiplicano l\'indice invece di batterlo, quindi in classifica stanno sempre '+
    'in cima o in fondo. Il chip <b>⚡</b> in alto li rimette dentro.</div>';
  h+=list.slice(0,300).map((f,i)=>rowCard(f,i+1,i<3?'t':'')).join('');
  if(list.length>300)h+='<div class="empty">Mostrati i primi 300. Affina con filtri o ricerca.</div>';
  return h;}

function viewTopFlop(){const list=withData(pool()).sort(ordina);
  if(list.length<2)return'<div class="empty">Dati insufficienti.</div>';
  const n=Math.min(10,Math.floor(list.length/2)||1);
  const scope=state.cat?('cat. '+state.cat):(state.macro||'assoluto');
  let h='<div class="sec top">▲ Migliori per rend. '+mLabel()+' — '+esc(scope)+'</div>'+
        list.slice(0,n).map((f,i)=>rowCard(f,i+1,'t')).join('');
  h+='<div class="sec flop">▼ Peggiori per rend. '+mLabel()+' — '+esc(scope)+'</div>';
  h+=list.slice(-n).reverse().map((f,i)=>rowCard(f,list.length-i,'b')).join('');
  return h;}

/* ================= CATEGORIE — score di allocazione ================= */
function catPool(){return CATS.filter(c=>(levaOn()||!(isLevaCat(c.macro)||isLevaCat(c.nome)))
  &&(!state.macro||c.macro===state.macro)&&(!state.cat||c.nome===state.cat)
  &&(!state.q||c.nome.toLowerCase().includes(state.q)));}

function viewCat(){let keys=catPool();
  if(!keys.length)return'<div class="empty">Nessuna categoria per questa selezione.</div>';
  keys=keys.slice();
  if(state.catSort==='score')keys.sort((a,b)=>{
    if(a.score===b.score)return a.nome.localeCompare(b.nome,'it');
    if(a.score===null)return 1;if(b.score===null)return -1;return b.score-a.score;});
  else if(state.catSort==='trend')keys.sort((a,b)=>{
    if(a.trend===null)return 1;if(b.trend===null)return -1;return b.trend-a.trend;});
  else keys.sort((a,b)=>a.nome.localeCompare(b.nome,'it'));

  let h='<div class="sortrow">'+
    '<div class="sc'+(state.catSort==='score'?' on':'')+'" onclick="setSort(\'score\')">Score ▼</div>'+
    '<div class="sc'+(state.catSort==='trend'?' on':'')+'" onclick="setSort(\'trend\')">Trend 6m ▼</div>'+
    '<div class="sc'+(state.catSort==='az'?' on':'')+'" onclick="setSort(\'az\')">A-Z</div></div>';
  h+='<div class="sec">'+keys.length+' categorie · score di allocazione</div>';

  keys.forEach(c=>{const st=stato(c);
    const membri=F.filter(f=>f[I.cat]===c.nome&&(!state.tipo||tipoOf(f)===state.tipo))
      .sort((a,b)=>{const ta=a[I.ter]===null?Infinity:a[I.ter],tb=b[I.ter]===null?Infinity:b[I.ter];
        if(ta!==tb)return ta-tb;
        const aa=a[I.aum]===null?-1:a[I.aum],ab=b[I.aum]===null?-1:b[I.aum];
        if(aa!==ab)return ab-aa;
        return String(a[I.name]).localeCompare(String(b[I.name]),'it');});
    h+='<div class="catcard"><div class="cathead" onclick="this.parentNode.classList.toggle(\'open\')">'+
      '<div class="cn">'+esc(c.nome)+'<div class="cmeta">'+esc(c.macro)+' · '+c.n+' strumenti'+
        (st?' · '+st.ico+' '+st.lbl:'')+'</div></div>'+
      '<div class="cval"><div class="cv '+(c.score===null?'zero':cls(c.score-50))+'">'+
        (c.score===null?'—':c.score.toFixed(0))+'</div>'+
      '<div class="cmeta">'+(c.score===null?'n&lt;'+MINN:'score')+'</div></div></div>'+
      '<div class="catbody">'+
      '<div class="grid g2" style="margin:6px 0">'+
        kvBox('Trend 6m',fmt(c.trend))+kvBox('Mom. 12-1',fmt(c.mom121))+
        kvBox('Accelerazione',fmtAcc(c.accel))+kvBox('Ampiezza macro',num(c.ampiezza,0)+'%')+
      '</div>'+
      (c.score===null?'<div class="note">Meno di '+MINN+' strumenti: le metriche relative restano vuote.</div>':'')+
      (membri.length?'<div class="mlbl">Strumenti, per costo crescente</div>'+membri.slice(0,25).map(miniRow).join(''):'')+
      '</div></div>';});
  return h;}
function kvBox(k,v){return '<div class="kv"><div class="k">'+k+'</div><div class="v sm">'+v+'</div></div>';}
function setSort(s){state.catSort=s;render();}
function miniRow(f){return '<div class="mini" onclick="event.stopPropagation();detail(\''+f[I.isin]+'\')">'+
  '<div class="mn">'+esc(f[I.name])+'</div>'+
  '<div style="flex:0 0 auto;font-size:12px;color:var(--mut)">'+num(f[I.ter],2)+'% · '+eur(f[I.aum])+'</div></div>';}

/* ================= MAPPA ================= */
const MC={'Azionari':'#4f9cff','Obbligazionari':'#22c55e','Convertibili':'#14b8a6',
  'Monetari':'#38bdf8','Bilanciati':'#f5b642','Materie Prime (ETC)':'#f59e0b',
  'Immobiliare':'#a78bfa','Alternativi':'#fb7185','Leva e Inverse (ETP)':'#fb923c',
  'Cripto':'#e879f9','Altro':'#94a3b8'};
function viewMappa(){const keys=catPool().filter(c=>c.trend!==null).slice()
    .sort((a,b)=>b.trend-a.trend);
  if(!keys.length)return'<div class="empty">Nessun dato per questa selezione.</div>';
  const mx=Math.max(1,...keys.map(c=>Math.abs(c.trend)));
  let h='<div class="sec">Mappa trend 6 mesi · '+keys.length+' categorie</div>'+
    '<div class="note" style="margin:0 4px 8px">Barra = trend a 6 mesi della categoria (mediana). '+
    'A destra lo stato di accelerazione. Tocca per aprire la categoria.</div>';
  keys.forEach(c=>{const v=c.trend,w=Math.abs(v)/mx*50,pos=v>=0,st=stato(c);
    h+='<div class="maprow" onclick="pickCat(\''+jsq(c.nome)+'\')">'+
      '<div class="mlbl2" style="border-left:3px solid '+(MC[c.macro]||'#888')+'">'+
        '<span class="cn2">'+esc(c.nome)+'</span> <small>('+c.n+')</small></div>'+
      '<div class="mbarwrap"><div class="mzero"></div><div class="mbar '+(pos?'mp':'mn')+'" style="'+
        (pos?'left:50%;width:'+w+'%':'right:50%;width:'+w+'%')+'"></div></div>'+
      '<div class="mval2 '+cls(v)+'">'+fmt(v)+'</div>'+
      '<div style="flex:0 0 20px;text-align:center">'+(st?st.ico:'')+'</div></div>';});
  return h;}
function pickCat(c){state.cat=c;state.tab='cat';
  document.querySelectorAll('nav button').forEach(x=>x.classList.toggle('on',x.dataset.tab==='cat'));
  buildCatSel();render();}

/* ================= COPPIE E SPREAD =================
   Metodologia §8. Tabella STATICA scelta a mano: sotto lo stesso nome commerciale
   convivono prodotti diversissimi (S&P 500 QVM, Buyback, Low Vol, ESG Elite, perfino
   futures sul VIX), quindi nessuna euristica sul nome — ISIN verificati uno per uno.
   Le serie Morningstar sono TOTAL RETURN: verificato che Acc e Dist sullo stesso indice
   coincidono entro mezzo punto su 5 anni, quindi si possono accoppiare senza guardare
   la politica di distribuzione. */
/* La fine delle serie arriva da meta.serieFine (api/data.js). Se manca — dati vecchi
   in cache — si dice comunque che il file è statico, senza inventare una data. */
const SFIN=META.serieFine||null;
function notaSerie(){
  return '<div class="note">Le serie storiche sono un <b>file statico</b> nel repo'+
    (SFIN?', fermo al <b>'+esc(SFIN)+'</b>':'')+': le coppie si fermano lì, mentre '+
    'rendimenti e score qui sotto sono aggiornati'+
    (META.dataChiusura?' alla chiusura del '+esc(itDate(META.dataChiusura)):'')+'.</div>';
}

const COPPIE=[
  {t:'Equal Weight − S&P 500', k:'ampiezza reale del rialzo americano',
   a:'IE00BNGJJT35', b:'IE00B6YX5C33'},
  {t:'Min Vol − MSCI World', k:'quanto costa (o rende) la difesa',
   a:'IE00B8FHGS14', b:'IE00BJ0KDQ92'},
  {t:'World hedged − World', k:'contributo puro del cambio',
   a:'IE00B441G979', b:'IE00BJ0KDQ92'},
  {t:'S&P 500 hedged − S&P 500', k:'contributo del solo dollaro',
   a:'IE00B3ZW0K18', b:'IE00B6YX5C33'},
  {t:'Enhanced Value − MSCI World', k:'stile: value aggressivo (MSCI World Enhanced Value)',
   a:'IE00BL25JM42', b:'IE00BJ0KDQ92'},
  {t:'Momentum − MSCI World', k:'stile: momentum contro mercato',
   a:'IE00BL25JP72', b:'IE00BJ0KDQ92'},
  {t:'High Yield € − Govt €', k:'premio pagato per il rischio di credito',
   a:'IE00B66F4759', b:'IE00B4WXJJ64'},
  {t:'Nasdaq 100 − S&P 500', k:'concentrazione sul tech',
   a:'IE00BMFKG444', b:'IE00B6YX5C33'},
  {t:'Europa − S&P 500', k:'geografia: Europa contro Stati Uniti',
   a:'LU0446734104', b:'IE00B6YX5C33'},
  {t:'Govt € 0-1 anno − Govt €', k:'duration: liquidità contro scadenze lunghe',
   a:'IE00B3FH7618', b:'IE00B4WXJJ64'}
];

const serieDi=i=>{const r=SER[i];if(!r)return null;
  const v=String(r).split(',').map(Number).filter(x=>isFinite(x));return v.length>6?v:null;};

/* Spread = differenza fra le due curve di crescita, entrambe ribasate a 1 all'inizio
   della finestra comune. Si tronca alla serie piu' corta: confrontare orizzonti diversi
   darebbe un numero senza significato. */
function calcolaCoppia(c){
  const A=serieDi(c.a), B=serieDi(c.b);
  if(!A||!B)return null;
  const n=Math.min(A.length,B.length);
  const ta=A.slice(-n), tb=B.slice(-n);
  const g=v=>v.map(x=>(1+x/100)/(1+v[0]/100));
  const ga=g(ta), gb=g(tb);
  const curva=ga.map((x,i)=>(x-gb[i])*100);
  // spread sugli ultimi k mesi, ricalcolato sulla finestra (non differenza di cumulati)
  const su=k=>{if(n-1<k)return null;const j=n-1-k;
    return Math.round(((ga[n-1]/ga[j])-(gb[n-1]/gb[j]))*10000)/100;};
  return {curva, mesi:n-1, tot:Math.round(curva[n-1]*100)/100,
          m3:su(3), m12:su(12), nomeA:nomeDi(c.a), nomeB:nomeDi(c.b)};
}
function nomeDi(isin){const f=F.find(x=>x[I.isin]===isin);return f?f[I.name]:null;}

function sparkSpread(v){
  const W=300,H=54,p=4,N=v.length;
  const mn=Math.min(0,...v), mx=Math.max(0,...v), rng=(mx-mn)||1;
  const X=i=>p+(N<2?0:i/(N-1))*(W-2*p);
  const Y=x=>p+(1-(x-mn)/rng)*(H-2*p);
  const pts=v.map((x,i)=>X(i).toFixed(1)+','+Y(x).toFixed(1)).join(' ');
  const y0=Y(0);
  return '<div class="spark"><svg viewBox="0 0 '+W+' '+H+'" preserveAspectRatio="none" style="width:100%;height:54px;display:block">'+
    '<line x1="'+p+'" y1="'+y0.toFixed(1)+'" x2="'+(W-p)+'" y2="'+y0.toFixed(1)+'" stroke="#2b3a57" stroke-width="1" stroke-dasharray="3 3"/>'+
    '<polyline points="'+pts+'" fill="none" stroke="#a78bfa" stroke-width="1.8" stroke-linejoin="round" stroke-linecap="round"/></svg></div>';
}

function viewCoppie(){
  const righe=COPPIE.map(c=>({c, r:calcolaCoppia(c)})).filter(x=>x.r);
  if(!righe.length)return'';
  let h='<div class="sec pair">Coppie e spread <button class="ipair" onclick="openCoppie()">i</button></div>';
  h+=notaSerie();
  righe.forEach(({c,r})=>{
    const anni=(r.mesi/12).toFixed(r.mesi%12?1:0);
    h+='<div class="paircard"><div class="ph"><div>'+
      '<div class="pn">'+esc(c.t)+'</div><div class="pk">'+esc(c.k)+'</div></div>'+
      '<div class="pv '+cls(r.tot)+'">'+fmt(r.tot)+'<div class="pu">'+anni+' anni</div></div></div>'+
      sparkSpread(r.curva)+
      '<div class="pmeta">3 mesi '+fmt(r.m3)+' · 12 mesi '+fmt(r.m12)+'<br>'+
      esc(r.nomeA||c.a)+'<br>meno '+esc(r.nomeB||c.b)+'</div></div>';
  });
  const mancanti=COPPIE.length-righe.length;
  if(mancanti)h+='<div class="note">'+mancanti+' coppie non calcolabili: manca la serie storica di almeno una gamba.</div>';
  return h;
}

function openCoppie(){
  document.getElementById('sheet').innerHTML=
    '<button class="closex" onclick="closeOv()">✕</button>'+
    '<h2>Coppie e spread</h2><div class="mc">Cosa sono e perché stanno qui</div>'+
    '<div class="ip">Una coppia è una <b>sottrazione fra due ETF</b> che differiscono per una cosa sola. '+
      'Il numero grande è quanto ha reso il primo <i>in più</i> del secondo sull\'intera finestra: '+
      'niente a che vedere con un rendimento, è una <b>differenza</b>.</div>'+
    '<div class="ip">Serve perché è l\'unica cosa che gli ETF permettono e i fondi no. Due ETF sullo stesso '+
      'indice sono identici a meno del costo, quindi se ne cambio <i>un solo ingrediente</i> — la copertura '+
      'del cambio, il peso uguale invece che per capitalizzazione — la differenza che resta <b>è</b> '+
      'quell\'ingrediente, isolato.</div>'+
    '<div class="ihead">Come si legge</div>'+
    '<div class="ip"><b>Equal Weight − S&P 500</b> negativo significa che il rialzo americano l\'hanno fatto '+
      'poche società molto grandi: l\'indice a pesi uguali resta indietro. È la misura dell\'ampiezza che '+
      'nessuna media di categoria può darti.<br>'+
      '<b>Hedged − unhedged</b> è il contributo del cambio, <u>al netto</u> del costo della copertura: la '+
      'versione coperta ha un TER più alto e paga il rollo, quindi non è il cambio puro in senso stretto — '+
      'è quello che il cambio ti è costato o reso <i>davvero, in mano</i>.<br>'+
      '<b>HY € − Govt €</b> è il premio incassato per il rischio di credito. Quando si comprime, il rischio '+
      'viene pagato poco.</div>'+
    '<div class="ihead">Come sono calcolate</div>'+
    '<div class="ip">Le due serie mensili Morningstar vengono <b>ribasate a zero</b> all\'inizio della finestra '+
      'comune e troncate alla più corta. Le serie sono <b>total return</b>: verificato che due ETF sullo stesso '+
      'indice, uno ad accumulazione e uno a distribuzione, coincidono entro mezzo punto su cinque anni. '+
      'Il grafico è lo spread nel tempo, la linea tratteggiata è lo zero.</div>'+
    '<div class="ihead">Fin dove arrivano</div>'+
    '<div class="ip">Le serie stanno in un <b>file statico</b> nel repo, non arrivano dallo '+
      'screener a ogni caricamento: l\'ultimo punto mensile è '+(SFIN?'il <b>'+esc(SFIN)+'</b>':'più vecchio dell\'ultimo aggiornamento dei dati')+
      '. Le coppie quindi <b>non vedono le ultime settimane</b>, mentre i rendimenti e gli score '+
      'delle categorie sì. Vanno lette come «com\'è andata la relazione fino a quella data», '+
      'non come «com\'è andata ieri».</div>'+
    '<div class="ihead">Limiti dichiarati</div>'+
    '<div class="ip">La tabella è <b>statica e scelta a mano</b>, ISIN per ISIN: sotto lo stesso nome '+
      'commerciale convivono prodotti diversissimi, e un\'euristica automatica prima o poi accoppierebbe '+
      'l\'indice sbagliato. Caso vero, verificato il 24/08/2026: l\'ETF <i>Xtrackers MSCI World Value</i> '+
      'non replica il MSCI World Value ma il <b>MSCI World Enhanced Value</b>, un value molto più '+
      'aggressivo — il nome commerciale non coincide col benchmark, e qui la coppia è etichettata per '+
      'quello che replica davvero.<br><b>Small cap − large cap manca</b>: gli ETF World Small Cap quotati a Milano '+
      'hanno meno di un anno di storia, e una coppia senza storia non dice niente.<br>'+
      'Le gambe sono ETF reali, quindi lo spread include il TER di entrambi. Su orizzonti lunghi qualche '+
      'decimo l\'anno di differenza di costo finisce dentro il numero.</div>'+
    '<div class="note">Strumento informativo, non consulenza. Le performance passate non sono indicative '+
      'di quelle future.</div>';
  document.getElementById('ov').classList.add('on');
}

/* ================= IDEE ================= */
function viewIdee(){
  const base=catPool().filter(c=>c.score!==null);
  let h=viewCoppie();
  h+='<div class="note" style="margin:12px 4px">Le idee stanno a livello di <b>categoria</b>: '+
    'su un ETF la scelta che conta e\' dove ti posizioni, non quale replica compri. '+
    'Dentro ogni categoria, gli strumenti sono ordinati per costo.</div>';
  if(!base.length)return h+'<div class="empty">Nessuna categoria con score per questa selezione.</div>';

  const blocco=(titolo,cls2,nota,lista)=>{
    if(!lista.length)return'';
    let s='<div class="sec '+cls2+'">'+titolo+'</div><div class="note" style="margin:0 4px 6px">'+nota+'</div>';
    s+=lista.map(c=>{const st=stato(c);
      const best=F.filter(f=>f[I.cat]===c.nome&&f[I.ter]!==null)
        .sort((a,b)=>a[I.ter]-b[I.ter])[0];
      return '<div class="card" onclick="pickCat(\''+jsq(c.nome)+'\')">'+
        '<div class="info"><div class="nm">'+(st?st.ico+' ':'')+esc(c.nome)+'</div>'+
        '<div class="ct">'+esc(c.macro)+' · '+c.n+' strumenti · ampiezza macro '+num(c.ampiezza,0)+'%</div>'+
        (best?'<div class="badges"><span class="qbadge q1">più economico: '+num(best[I.ter],2)+'%</span></div>':'')+
        '</div><div class="val"><div class="pct '+cls(c.trend)+'">'+fmt(c.trend)+'</div>'+
        '<div class="stars" style="color:var(--mut)">score '+c.score.toFixed(0)+'</div></div></div>';}).join('');
    return s;};

  h+=blocco('🚀 In accelerazione','top',
    'Trend a 6 mesi positivo e accelerazione positiva. Da leggere insieme all\'ampiezza: '+
    'ampiezza bassa = movimento concentrato su poche categorie, più fragile.',
    base.filter(c=>c.trend>=0&&c.accel>0).sort((a,b)=>b.accel-a.accel).slice(0,10));
  h+=blocco('↗️ Possibili svolte','hot',
    'Trend a 6 mesi ancora negativo ma accelerazione positiva. È il segnale più rapido '+
    'e il più esposto ai falsi positivi.',
    base.filter(c=>c.trend<0&&c.accel>0).sort((a,b)=>b.accel-a.accel).slice(0,10));
  h+=blocco('⚠️ In raffreddamento','flop',
    'Trend ancora positivo ma accelerazione negativa: il movimento perde passo.',
    base.filter(c=>c.trend>=0&&c.accel<=0).sort((a,b)=>a.accel-b.accel).slice(0,10));

  const escluse=catPool().filter(c=>c.score===null).length;
  if(escluse)h+='<div class="note">Non compaiono '+escluse+' categorie senza score: '+
    'sotto i '+MINN+' strumenti, oppure in una macro con una sola categoria, dove il '+
    'percentile non ha popolazione su cui calcolarsi.</div>';
  return h;}

/* ================= GRAFICO ================= */
function svgLine(vals,up,srcLabel,leftLabel,rightLabel){
  const W=320,H=100,pad=6,N=vals.length;
  let mn=Math.min(...vals),mx=Math.max(...vals);if(mn===mx){mn-=1;mx+=1;}const rng=mx-mn;
  const X=i=>pad+(N<2?0:i/(N-1))*(W-2*pad);
  const Y=v=>pad+(1-(v-mn)/rng)*(H-2*pad);
  const pts=vals.map((v,i)=>X(i).toFixed(1)+','+Y(v).toFixed(1)).join(' ');
  const col=up?'#22c55e':'#f4536b';const y100=Y(100);
  const area=pts+' '+X(N-1).toFixed(1)+','+(H-pad)+' '+X(0).toFixed(1)+','+(H-pad);
  return '<div class="chartbox"><svg viewBox="0 0 '+W+' '+H+'" preserveAspectRatio="none">'+
    '<polygon points="'+area+'" fill="'+col+'" opacity="0.08"/>'+
    (100>=mn&&100<=mx?'<line x1="'+pad+'" y1="'+y100.toFixed(1)+'" x2="'+(W-pad)+'" y2="'+y100.toFixed(1)+'" stroke="#2b3a57" stroke-width="1" stroke-dasharray="3 3"/>':'')+
    '<polyline points="'+pts+'" fill="none" stroke="'+col+'" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/></svg>'+
    '<div class="chleg"><span>'+leftLabel+'</span><span>'+srcLabel+'</span><span>'+(rightLabel||'oggi')+'</span></div></div>';}
function growthChart(f){
  const raw=SER[f[I.isin]];
  if(raw){const cum=String(raw).split(',').map(Number).filter(x=>isFinite(x));
    if(cum.length>=6){const vals=cum.map(v=>100*(1+v/100));const up=vals[vals.length-1]>=vals[0];
      const mo=cum.length-1;const left=mo>=60?'5 anni fa':mo>=36?'~3 anni fa':(mo+' mesi fa');
      return svgLine(vals,up,'storico Morningstar · base 100',left,SFIN||'oggi');}}
  const P=[];const push=(mo,v)=>{if(v!=null&&isFinite(v))P.push([mo,v]);};
  push(0,100);
  if(f[I.w1]!=null)push(0.25,100/(1+f[I.w1]/100));
  if(f[I.m1]!=null)push(1,100/(1+f[I.m1]/100));
  if(f[I.m3]!=null)push(3,100/(1+f[I.m3]/100));
  if(f[I.m6]!=null)push(6,100/(1+f[I.m6]/100));
  if(f[I.r1]!=null)push(12,100/(1+f[I.r1]/100));
  if(f[I.r3]!=null)push(36,100/Math.pow(1+f[I.r3]/100,3));
  if(f[I.r5]!=null)push(60,100/Math.pow(1+f[I.r5]/100,5));
  if(P.length<2)return'';
  P.sort((a,b)=>b[0]-a[0]);
  const W=320,H=100,pad=6,maxMo=P[0][0];
  const vals=P.map(p=>p[1]);let mn=Math.min(...vals),mx=Math.max(...vals);if(mn===mx){mn-=1;mx+=1;}
  const rng=mx-mn;
  const X=mo=>pad+(1-mo/maxMo)*(W-2*pad);
  const Y=v=>pad+(1-(v-mn)/rng)*(H-2*pad);
  const pts=P.map(p=>X(p[0]).toFixed(1)+','+Y(p[1]).toFixed(1)).join(' ');
  const up=P[P.length-1][1]>=P[0][1];const col=up?'#22c55e':'#f4536b';
  const marks=P.map(p=>'<circle cx="'+X(p[0]).toFixed(1)+'" cy="'+Y(p[1]).toFixed(1)+'" r="2.4" fill="'+col+'"/>').join('');
  return '<div class="chartbox"><svg viewBox="0 0 '+W+' '+H+'" preserveAspectRatio="none">'+
    '<line x1="'+pad+'" y1="'+Y(100).toFixed(1)+'" x2="'+(W-pad)+'" y2="'+Y(100).toFixed(1)+'" stroke="#2b3a57" stroke-width="1" stroke-dasharray="3 3"/>'+
    '<polyline points="'+pts+'" fill="none" stroke="'+col+'" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>'+marks+'</svg>'+
    '<div class="chleg"><span>'+(maxMo>=60?'5 anni fa':maxMo>=36?'3 anni fa':(Math.round(maxMo)+' mesi fa'))+
    '</span><span>stima dai rendimenti · base 100</span><span>oggi</span></div></div>';}

/* ================= SCHEDA STRUMENTO ================= */
function detail(isin){const f=F.find(x=>x[I.isin]===isin);if(!f)return;
  const c=CBY[f[I.cat]];const st=stato(c);
  const kv=(k,v,sm)=>'<div class="kv"><div class="k">'+k+'</div><div class="v'+(sm?' sm':'')+'">'+v+'</div></div>';
  const p=v=>'<span class="'+cls(v)+'">'+fmt(v)+'</span>';
  let b='<button class="closex" onclick="closeOv()">✕</button><h2>'+esc(f[I.name])+'</h2>'+
    '<div class="mc"><span class="pill">'+esc(f[I.isin])+'</span>'+
      (f[I.tick]?'<span class="pill">'+esc(f[I.tick])+'</span>':'')+esc(f[I.cat]||'categoria n/d')+'</div>';
  if(f[I.ccy])b+='<div class="note" style="color:var(--warn)">Attenzione: performance restituite in '+
    esc(f[I.ccy])+', non in euro. Il confronto dentro la categoria non è omogeneo.</div>';
  if(f[I.stale]===1)b+='<div class="note">Prezzo di chiusura più vecchio della data di riferimento: '+
    'su strumenti sottili può restare fermo per giorni.</div>';
  b+='<div class="mlbl">Andamento (crescita di 100 €)</div>'+growthChart(f)+
    '<div class="mlbl">Rendimenti recenti</div><div class="grid">'+
      kv('1 sett.',p(f[I.w1]),1)+kv('1 mese',p(f[I.m1]),1)+kv('3 mesi',p(f[I.m3]),1)+
      kv('6 mesi',p(f[I.m6]),1)+kv('YTD',p(f[I.ytd]),1)+'</div>'+
    '<div class="mlbl">Rendimenti annualizzati</div><div class="grid">'+
      kv('1 anno',p(f[I.r1]),1)+kv('3 anni p.a.',p(f[I.r3]),1)+kv('5 anni p.a.',p(f[I.r5]),1)+'</div>'+
    '<div class="mlbl">Selezione — quanto costa e quanto è solido</div><div class="grid">'+
      kv('TER',(f[I.ter]!==null?num(f[I.ter],2)+'%':'—')+(f[I.terQ]?' <span style="font-size:11px;color:var(--mut)">Q'+f[I.terQ]+'</span>':''),1)+
      kv('Patrimonio',eur(f[I.aum]),1)+
      kv('Dal',f[I.anno]||'—',1)+'</div>'+
    '<div class="mlbl">Rischio</div><div class="grid">'+
      kv('Volat. 3a',f[I.sd]!==null?num(f[I.sd])+'%':'—',1)+
      kv('Max drawdown 3a','<span class="neg">'+(f[I.mdd]!==null?num(f[I.mdd])+'%':'—')+'</span>',1)+
      kv('Rend./volat. 3a',num(f[I.shp],2),1)+'</div>';
  if(f[I.aum]!==null&&f[I.aum]<50)
    b+='<div class="note" style="color:var(--warn)">Sotto i 50 milioni di patrimonio: rischio di '+
       'chiusura o fusione, che per il cliente significa realizzo forzato.</div>';
  if(c){b+='<div class="mlbl">Allocazione — come sta la categoria</div>'+
    '<div class="kv"><div class="k">'+esc(c.nome)+(st?' · '+st.ico+' '+st.lbl:'')+'</div>'+
    '<div class="v">'+(c.score===null?'score n/d':c.score.toFixed(0)+'/100')+'</div>'+
    (c.score!==null?'<div class="mombar"><i style="width:'+c.score+'%"></i></div>':'')+'</div>'+
    '<div class="grid g2" style="margin-top:8px">'+
      kvBox('Trend 6m',fmt(c.trend))+kvBox('Mom. 12-1',fmt(c.mom121))+
      kvBox('Accelerazione',fmtAcc(c.accel))+kvBox('Dispersione macro',num(c.disp,2))+'</div>'+
    '<div class="note">Lo score è il percentile della categoria dentro la macro <b>'+esc(c.macro)+
      '</b>, non dentro tutto l\'universo: confrontare un monetario con un ETF sui semiconduttori '+
      'non direbbe nulla.</div>';}
  if(f[I.isin]&&String(f[I.isin]).length===12)
    b+='<a target="_blank" rel="noopener" style="display:inline-block;margin:10px 0 2px;padding:9px 14px;'+
       'background:#2563eb;color:#fff;border-radius:9px;text-decoration:none;font-weight:600;font-size:13px" '+
       'href="https://www.justetf.com/it/etf-profile.html?isin='+encodeURIComponent(f[I.isin])+'">Scheda completa JustETF ↗</a>';
  b+='<div class="note"><span class="pill">Linee/valute: '+(f[I.nc]||1)+'</span></div>'+
    '<div class="note">Fonte: Morningstar · rendimenti in EUR'+(META.dataChiusura?' alla chiusura del '+esc(itDate(META.dataChiusura)):'')+
    '. Liquidità e spread denaro-lettera <b>non</b> sono considerati: non sono nello screener, '+
    'e su uno strumento sottile possono valere più di anni di TER. '+
    'Informativa, non sollecitazione all\'investimento.</div>';
  document.getElementById('sheet').innerHTML=b;
  document.getElementById('ov').classList.add('on');}

/* ================= GUIDA ================= */
function openInfo(){
  const s='<button class="closex" onclick="closeOv()">✕</button>'+
    '<h2>Come funziona ETF Monitor</h2>'+
    '<div class="mc">ETF, ETC ed ETP di Borsa Italiana · dati Morningstar</div>'+
    '<div class="ihead">Due domande, due punteggi</div>'+
    '<div class="ip">Gli OICR si giudicano sulla bravura del gestore dentro la categoria. Gli ETF no: '+
      'due ETF sullo stesso indice rendono uguale a meno di costo e replica. Quindi qui ci sono '+
      '<b>due domande separate</b>, e non vanno mai mescolate in un unico numero.</div>'+
    '<div class="istep"><div class="n">1</div><div><b>Dove mi posiziono</b> — è lo '+
      '<b>score di allocazione</b>, calcolato sulla <b>categoria</b>. Lo trovi nelle schede '+
      'Categorie, Mappa e Idee.</div></div>'+
    '<div class="istep"><div class="n">2</div><div><b>Quale strumento compro</b> — costo, patrimonio '+
      'e anzianità, sullo <b>strumento</b>. Lo trovi nella Classifica e nelle schede.</div></div>'+
    '<div class="ihead">Le metriche di categoria</div>'+
    '<div class="ip"><b>Trend 6m</b>: mediana dei rendimenti a 6 mesi. Assoluto, non relativo.<br>'+
      '<b>Mom. 12-1</b>: (1+r12)/(1+m1) − 1 sulla mediana. Il classico accademico, esclude l\'ultimo '+
      'mese perché tende a invertire.<br>'+
      '<b>Accelerazione</b>: 4·m3 − 2·m6 sulla mediana. Segnala i cambi di fase ed è la più esposta '+
      'ai falsi segnali. <b>È su una scala diversa dal trend</b>: non confrontare i due numeri fra loro.<br>'+
      '<b>Ampiezza</b>: quota di <i>categorie</i> della macro con 1 e 3 mesi entrambi positivi. '+
      'Misura quante aree partecipano al movimento.<br>'+
      '<b>Dispersione</b>: scarto interquartile dei 3 mesi tra le categorie della macro. Alta = '+
      'mercato selettivo, la scelta di categoria conta.<br>'+
      '<b>Score</b>: percentile della categoria dentro la sua macro, media dei percentili di trend, '+
      'Mom. 12-1 e accelerazione.</div>'+
    '<div class="ibox">'+
    '<div class="ihead hot" style="margin-top:0">I quattro stati</div>'+
    '<div class="ip">🚀 <b>rafforzamento</b> (trend ≥0, accelera) · ⚠️ <b>raffreddamento</b> (trend ≥0, '+
      'rallenta) · ↗️ <b>possibile svolta</b> (trend &lt;0 ma accelera) · 🔻 <b>peggioramento</b>.<br>'+
      'Classificati per <b>segno</b>, senza soglie inventate: accanto trovi sempre il valore.</div>'+
    '</div>'+
    '<div class="ihead">Cosa non c\'è, e perché</div>'+
    '<div class="ip"><b>Momentum relativo alla categoria</b>: misura la bravura del gestore, che su un '+
      'ETF non esiste. Su strumenti che replicano lo stesso indice ordinerebbe per TER credendo di '+
      'misurare altro.<br>'+
      '<b>Consistenza</b>: stesso motivo, uscirebbe 5/5 o 0/5 per ragioni di costo.<br>'+
      '<b>Leva e inversi</b>: esclusi dalle classifiche <i>per impostazione predefinita</i>. Un 2x o '+
      'un 3x non batte l\'indice, lo moltiplica — e con il ribilanciamento giornaliero perde valore '+
      'nei mercati laterali. In una classifica per rendimento occuperebbe le prime posizioni per '+
      'costruzione, non per merito. Il chip <b>⚡</b> in alto li rimette dentro quando servono.<br>'+
      '<b>Rating a stelle</b>: è relativo alla categoria e sui passivi premia di fatto il TER più '+
      'basso, che qui è già in chiaro.<br>'+
      '<b>Metodo di replica, politica di distribuzione, indice replicato</b>: lo screener non li '+
      'espone su questo universo. Non sono stimati: mancano.<br>'+
      '<b>Liquidità e spread denaro-lettera</b>: non disponibili. È il costo che paghi davvero '+
      'all\'ingresso e all\'uscita, e su uno strumento sottile vale più di anni di TER: '+
      'questa classifica <b>non</b> lo considera.</div>'+
    '<div class="ihead">Qualità dei dati</div>'+
    '<div class="ip">'+META.nTot.toLocaleString('it')+' strumenti · '+(META.nCat||'—')+' categorie'+
      (META.dataChiusura?' · chiusura '+esc(itDate(META.dataChiusura)):'')+'.<br>'+
      (META.nNoTer||0)+' senza TER · '+(META.nStale||0)+' con prezzo di chiusura più vecchio · '+
      (META.nCatSottoSoglia||0)+' categorie sotto i '+MINN+' strumenti, senza metriche relative.</div>'+
    '<div class="ihead">Nota fiscale</div>'+
    '<div class="ip">ETF armonizzati UCITS: imposta sostitutiva 26%, ridotta al 12,5% sulla quota in '+
      'titoli di Stato white list. Le plusvalenze sono redditi di capitale e le minusvalenze redditi '+
      'diversi, quindi <b>le minusvalenze da ETF non compensano le plusvalenze da ETF</b>. '+
      'Informazione generale verificata al 20/08/2026, non consulenza.</div>'+
    '<div class="note">Il momentum è un segnale di <b>breve periodo</b>, non una previsione: va '+
      'combinato con rischio, costo e obiettivo del cliente. Strumento informativo, non consulenza '+
      'né sollecitazione all\'investimento. Le performance passate non sono indicative di quelle future.</div>';
  document.getElementById('sheet').innerHTML=s;
  document.getElementById('ov').classList.add('on');}

/* ---------- avvio ---------- */
function render(){buildCatSel();const v=document.getElementById('view');
  v.innerHTML=state.tab==='rank'?viewRank():state.tab==='topflop'?viewTopFlop():
    state.tab==='cat'?viewCat():state.tab==='mappa'?viewMappa():viewIdee();
  window.scrollTo(0,0);}
document.getElementById('infoBtn').onclick=openInfo;
function closeOv(){document.getElementById('ov').classList.remove('on')}
document.getElementById('ov').onclick=e=>{if(e.target.id==='ov')closeOv()};
buildTipoChips();buildMacroChips();buildCatSel();render();
