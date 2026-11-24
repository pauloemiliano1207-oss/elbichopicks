/* ============ HOY + PARLAYS (El Bicho Picks) ============
   Datos: today.json (cuotas reales + modelo). Todo en español y pensado para leerse rápido. */
let TD=null,HMAX=24,HSP='all',HDAY=0,HLG='Todas',PAR=[],PMODE='eq',PDAY=0,PSP='all',PN=3;
const SPN={fut:'Fútbol',nba:'NBA',nfl:'NFL'};
const FAMN={res:'Resultado',dc:'Doble oportunidad',dnb:'Empate no apuesta',hc:'Hándicap',tot:'Goles / puntos',btts:'Ambos anotan',team:'Goles por equipo','1t':'Primer tiempo'};
const BKN=k=>(typeof BOOKN!=='undefined'&&BOOKN[k])||k;
const p0=p=>Math.round(p*100)+'%';
const dayStart=o=>{const d=new Date();d.setHours(0,0,0,0);return d.getTime()+o*86400e3;};
function inDay(e,day){const t=new Date(e.t).getTime();if(day===7)return t>Date.now()-3*3600e3&&t<dayStart(7);return t>=dayStart(day)&&t<dayStart(day+1)&&t>Date.now()-3*3600e3;}
const hhmm=t=>new Date(t).toLocaleTimeString('es-MX',{hour:'numeric',minute:'2-digit'});
const dlab=t=>new Date(t).toLocaleDateString('es-MX',{weekday:'short',day:'numeric',month:'short'});
const riskOf=p=>p>=.75?['Bajo','good']:p>=.6?['Medio','mid']:['Alto','hi'];
const evTxt=x=>x.ev==null?'':`<span class="ev ${x.ev>0?'pos':'neg'}">${x.ev>0?'+':''}${(x.ev*100).toFixed(1)}%</span>`;

function loadToday(cb){if(TD)return cb();fetch('today.json',{cache:'no-store'}).then(r=>r.json()).then(j=>{TD=j;cb();}).catch(()=>{const el=$('hoyBox');if(el)el.innerHTML='<p class="note">No se pudieron cargar los partidos de hoy.</p>';});}

/* ---------- HOY ---------- */
function renderHoy(){const el=$('hoyBox');if(!el)return;loadToday(()=>{
  const evs=TD.events.filter(e=>(HSP==='all'||e.sp===HSP)&&inDay(e,HDAY));
  const lgs=['Todas',...new Set(TD.events.filter(e=>(HSP==='all'||e.sp===HSP)&&inDay(e,HDAY)).map(e=>e.lg))];if(!lgs.includes(HLG))HLG='Todas';
  const list=evs.filter(e=>HLG==='Todas'||e.lg===HLG);
  const days=[['Hoy',0],['Mañana',1],['Esta semana',7]];
  el.innerHTML=`<div class="hbar">
    <div class="seg">${[['all','Todo'],['fut','⚽ Fútbol'],['nba','🏀 NBA'],['nfl','🏈 NFL']].map(([k,l])=>`<button class="${HSP===k?'on':''}" data-hs="${k}">${l}</button>`).join('')}</div>
    <div class="seg">${days.map(([l,d])=>`<button class="${HDAY===d?'on':''}" data-hd="${d}">${l}</button>`).join('')}</div>
    ${lgs.length>2?`<select id="hLg" class="hsel">${lgs.map(l=>`<option ${l===HLG?'selected':''}>${esc(l)}</option>`).join('')}</select>`:''}
  </div>
  <p class="hsub">${list.length?`${list.length} partido${list.length>1?'s':''}${list.some(e=>e.pending)?` (${list.filter(e=>e.pending).length} todavía sin cuotas)`:''}. En cada uno te mostramos la <b>jugada clave</b>: lo más probable que vale la pena mirar. Toca <b>Ver todo</b> para ver todos los números.`:'No hay partidos con estos filtros. Prueba con “Esta semana”.'}</p>
  <div class="hgrid">${list.slice(0,HMAX).map(cardHTML).join('')}</div>${list.length>HMAX?`<div style="text-align:center;margin:16px 0"><button class="btn" id="hMore">Ver más partidos (${list.length-HMAX})</button></div>`:''}
  <p class="note">Probabilidades calculadas con las cuotas de Pinnacle (la casa más precisa) sin su comisión, más nuestro modelo para mercados derivados. Datos del ${new Date(TD.taken).toLocaleString('es-MX',{dateStyle:'medium',timeStyle:'short'})}. Ninguna jugada es segura.</p>`;
  if($('hMore'))$('hMore').onclick=()=>{HMAX+=24;renderHoy();};
  el.querySelectorAll('[data-hs]').forEach(b=>b.onclick=()=>{HSP=b.dataset.hs;HMAX=24;renderHoy();});
  el.querySelectorAll('[data-hd]').forEach(b=>b.onclick=()=>{HDAY=+b.dataset.hd;HMAX=24;renderHoy();});
  if($('hLg'))$('hLg').onchange=e=>{HLG=e.target.value;renderHoy();};
  el.querySelectorAll('[data-fi]').forEach(b=>b.onclick=()=>openFicha(b.dataset.fi));
  el.querySelectorAll('[data-padd]').forEach(b=>b.onclick=()=>{const e=TD.events.find(x=>x.id===b.dataset.padd);addLeg(e,e.key);});
});}
function cardHTML(e){
  if(e.pending)return`<div class="hcard pend"><div class="hct"><span class="hlg">${esc(e.lg)}</span><span class="htm">${HDAY===0?'':dlab(e.t)+' · '}${hhmm(e.t)}</span></div><div class="hteams"><b>${esc(e.h)}</b><span>vs</span><b>${esc(e.a)}</b></div><div class="note" style="margin:0">⏳ Las casas aún no publican cuotas de este partido. Se actualiza solo cada mañana a las 6:00.</div></div>`;
  const r=e.m.filter(x=>x.fam==='res'),k=e.key,[rk,rc]=riskOf(k.p);
  const bars=r.map(x=>{const lab=x.k==='Empate'?'Empate':x.k.replace('Gana ','');return`<div class="hb"><span class="hbl">${esc(short2(lab))}</span><span class="hbt"><i style="width:${Math.round(x.p*100)}%" class="${x.k===e.fav.k?'f':''}"></i></span><b>${p0(x.p)}</b></div>`;}).join('');
  const tightNote=e.tight?`<div class="tight">⚖️ Resultado apretado: mejor mira otra jugada</div>`:'';
  return`<div class="hcard"><div class="hct"><span class="hlg">${esc(e.lg)}</span><span class="htm">${HDAY===0?'':dlab(e.t)+' · '}${e.own?'<span class="rk mid" style="margin-right:6px">Modelo propio</span>':''}${hhmm(e.t)}</span></div>
    <div class="hteams"><b>${esc(e.h)}</b><span>vs</span><b>${esc(e.a)}</b></div>
    <div class="hbars">${bars}</div>${tightNote}
    <div class="hkey"><span class="lab">Jugada clave</span><div class="kk">${esc(k.k)}</div><div class="kp"><b>${p0(k.p)}</b><span>cuota justa ${k.fair}</span><span class="rk ${rc}">Riesgo ${rk.toLowerCase()}</span></div></div>
    <div class="hact"><button class="btn sm" data-fi="${e.id}">Ver todo</button><button class="btn menta sm" data-padd="${e.id}">+ Parlay</button></div></div>`;}
const short2=s=>s.length>14?s.split(' ').slice(-1)[0]:s;

/* ---------- FICHA DEL PARTIDO ---------- */
let FTAB='top';
function openFicha(id){const e=TD.events.find(x=>x.id===id);if(!e)return;FTAB='top';drawFicha(e);$('fichaModal').classList.add('on');}

/* ---------- NFL: proyecciones de jugadores (props.json, modelo propio con nflverse) ---------- */
let PROPS=null,PROPSL=false;
const NFLAB={'Arizona Cardinals':'ARI','Atlanta Falcons':'ATL','Baltimore Ravens':'BAL','Buffalo Bills':'BUF','Carolina Panthers':'CAR','Chicago Bears':'CHI','Cincinnati Bengals':'CIN','Cleveland Browns':'CLE','Dallas Cowboys':'DAL','Denver Broncos':'DEN','Detroit Lions':'DET','Green Bay Packers':'GB','Houston Texans':'HOU','Indianapolis Colts':'IND','Jacksonville Jaguars':'JAX','Kansas City Chiefs':'KC','Las Vegas Raiders':'LV','Los Angeles Chargers':'LAC','Los Angeles Rams':'LA','Miami Dolphins':'MIA','Minnesota Vikings':'MIN','New England Patriots':'NE','New Orleans Saints':'NO','New York Giants':'NYG','New York Jets':'NYJ','Philadelphia Eagles':'PHI','Pittsburgh Steelers':'PIT','San Francisco 49ers':'SF','Seattle Seahawks':'SEA','Tampa Bay Buccaneers':'TB','Tennessee Titans':'TEN','Washington Commanders':'WAS'};
const POSN={QB:'Mariscal',RB:'Corredor',WR:'Receptor',TE:'Ala cerrada'};
function loadProps(cb){if(PROPS||PROPSL)return cb&&cb();PROPSL=true;fetch('props.json',{cache:'no-store'}).then(r=>r.json()).then(j=>{PROPS=j;cb&&cb();}).catch(()=>{PROPS={games:[]};cb&&cb();});}
function propsGame(e){if(!PROPS||e.sp!=='nfl')return null;const h=NFLAB[e.h],a=NFLAB[e.a];return PROPS.games.find(g=>g.h===h&&g.a===a)||PROPS.games.find(g=>g.h===a&&g.a===h)||null;}
function pOverP(s,mu,L){if(PROPS.pois.includes(s)){let c=0;for(let i=0;i<=Math.floor(L);i++){let f=1;for(let j=2;j<=i;j++)f*=j;c+=Math.exp(-mu)*mu**i/f;}return Math.min(.995,Math.max(.005,1-c));}
  const q=PROPS.q[s],r=L/mu;if(r<=q[0])return .995;if(r>=q[100])return .005;let lo=0;while(lo<100&&q[lo+1]<=r)lo++;const fr=q[lo+1]>q[lo]?(r-q[lo])/(q[lo+1]-q[lo]):0;return Math.min(.995,Math.max(.005,1-(lo+fr)/100));}
const UNI={pass_yds:'yds',rush_yds:'yds',rec_yds:'yds',rec:'rec.',pass_td:'TD'};
function propsHTML(e,g){
  const tm=t=>Object.keys(NFLAB).find(k=>NFLAB[k]===t)||t;
  const card=p=>`<div class="ppl"><div class="ppn"><b>${esc(p.n)}</b><span>${POSN[p.pos]||p.pos}</span></div>${p.m.map(m=>m.s==='any_td'?`<div class="ppm"><span>Anota touchdown</span><b class="pc">${p0(m.p)}</b></div>`:
    `<div class="ppm"><span>${esc(m.lab[0].toUpperCase()+m.lab.slice(1))}</span><b>${m.mu}</b><i class="fn">rango ${m.r[0]}–${m.r[1]}</i>${m.safe?`<em class="pch">Más de ${m.safe.L} · <b>${p0(m.safe.p)}</b></em>`:''}</div>`).join('')}</div>`;
  const sel=[];g.players.forEach((p,i)=>p.m.forEach((m,j)=>{if(m.s!=='any_td')sel.push(`<option value="${i}|${j}">${esc(p.n)} · ${esc(m.lab)} (proy. ${m.mu})</option>`);}));
  const v=PROPS.val||{},vs=['pass_yds','rush_yds','rec_yds','rec'].map(k=>v[k]&&v[k].segura).filter(Boolean),hit=vs.length?Math.round(100*vs.reduce((a,x)=>a+x.acierto*x.n,0)/vs.reduce((a,x)=>a+x.n,0)):null;
  return `${[g.h,g.a].map(t=>`<h4 class="pph">${esc(tm(t))}</h4><div class="ppg">${g.players.filter(p=>p.team===t).map(card).join('')}</div>`).join('')}
   <div class="pcalc"><b>🧮 ¿Qué línea te da tu casa?</b><div class="pcr"><select id="pcS">${sel.join('')}</select><input id="pcL" type="number" step="0.5" placeholder="Ej. 210.5"><span id="pcO" class="pco">—</span></div></div>
   <p class="note">Proyección = lo más probable según su temporada (los partidos recientes pesan más), la defensa rival contra su posición, los puntos que se esperan de su equipo (línea ${esc(g.spread)} · total ${esc(g.total)}) y si juega de local. “Más de X” es la línea más alta que el modelo da con al menos 70%.${hit?` Probado con ${esc(PROPS.vperiod||'')}: esas líneas acertaron <b>${hit}%</b> de las veces.`:''} Datos de nflverse hasta la semana ${PROPS.data_week}; no considera lesiones de última hora.</p>`;}
function bindProps(g){const S=$('pcS'),L=$('pcL'),O=$('pcO');if(!S)return;const go=()=>{const[i,j]=S.value.split('|').map(Number),m=g.players[i].m[j],x=parseFloat(L.value);if(!isFinite(x)){O.textContent='—';return;}const p=pOverP(m.s,m.mu,x);O.innerHTML=`Más de ${x}: <b>${p0(p)}</b> · Menos: <b>${p0(1-p)}</b>`;};S.onchange=go;L.oninput=go;}

function drawFicha(e){
  if(e.sp==='nfl'&&!PROPS){loadProps(()=>drawFicha(e));}
  const pg=propsGame(e);
  const tabs=[['top','⭐ Top 3'],...(pg?[['jug','🏈 Jugadores']]:[]),['res','Resultado'],['tot',e.sp==='fut'?'Goles':'Puntos'],...(e.sp==='fut'?[['mas','Más mercados'],['sc','Marcadores']]:[['hc','Hándicaps']])];
  const row=x=>`<tr><td>${esc(x.k)}</td><td class="pb"><span class="hbt"><i style="width:${Math.round(x.p*100)}%"></i></span><b>${p0(x.p)}</b></td><td class="n num">${x.fair}</td><td class="n num">${x.odd?x.odd.toFixed(2)+'<div class="fn">'+esc(BKN(x.book))+'</div>':'—'}</td><td class="n">${evTxt(x)}</td><td><button class="share" data-leg="${esc(x.k)}">+</button></td></tr>`;
  const tbl=xs=>`<div style="overflow-x:auto"><table class="ftab ftk"><thead><tr><th>Mercado</th><th>Probabilidad</th><th class="n">Cuota justa</th><th class="n">Mejor cuota</th><th class="n">Ventaja</th><th></th></tr></thead><tbody>${xs.map(row).join('')}</tbody></table></div>`;
  let body='';
  if(FTAB==='top'){body=e.top.length?e.top.map((x,i)=>{const[rk,rc]=riskOf(x.p);return`<div class="top3"><div class="medal">${['🥇','🥈','🥉'][i]}</div><div style="flex:1"><div class="kk">${esc(x.k)}</div><div class="fn">${FAMN[x.fam]} · cuota justa ${x.fair}${x.odd?` · mejor cuota ${x.odd.toFixed(2)} (${esc(BKN(x.book))})`:''}</div></div><div class="tp"><b>${p0(x.p)}</b><span class="rk ${rc}">Riesgo ${rk.toLowerCase()}</span>${x.ev!=null&&x.ev<0?'<span class="fn">No conviene a esa cuota</span>':''}</div><button class="share" data-leg="${esc(x.k)}">+ Parlay</button></div>`;}).join(''):'<p class="note">No hay mercados con suficiente probabilidad.</p>';
    body+=`<p class="note">Las 3 jugadas más probables de este partido (una por tipo de mercado, entre 55% y 90%). Que sean probables no significa que sean rentables: si la cuota de tu casa es menor que la cuota justa, a la larga pierdes.${e.top.length>1?' Ojo: dependen del mismo partido, no se cubren entre sí.':''}</p>`;}
  else if(FTAB==='jug'&&pg)body=propsHTML(e,pg);
  else if(FTAB==='res')body=tbl(e.m.filter(x=>['res','dc','dnb'].includes(x.fam)));
  else if(FTAB==='tot')body=tbl(e.m.filter(x=>x.fam==='tot'));
  else if(FTAB==='hc')body=tbl(e.m.filter(x=>x.fam==='hc'))+`<p class="note">Hándicaps calculados a partir del ganador (Pinnacle), suponiendo una variación típica del margen. Son estimaciones del modelo: verifica que tu casa ofrezca esa línea.</p>`;
  else if(FTAB==='mas')body=tbl(e.m.filter(x=>['btts','team','1t','hc'].includes(x.fam)));
  else if(FTAB==='sc')body=`<div class="scs">${e.scores.map(([s,p])=>`<div><b>${s}</b><span>${(p*100).toFixed(1)}%</span></div>`).join('')}</div><p class="note">Ningún marcador exacto suele pasar de 12–15%: son jugadas de alto riesgo.</p>`;
  const meta=e.sp==='fut'?`Goles esperados: <b>${esc(e.h)} ${e.xg[0]}</b> · <b>${esc(e.a)} ${e.xg[1]}</b> · Total ${(e.xg[0]+e.xg[1]).toFixed(1)}${e.line!=null?` (línea de la casa: ${e.line})`:''}`:`Margen esperado: <b>${esc(e.margin>=0?e.h:e.a)} por ${Math.abs(e.margin).toFixed(1)}</b>${e.line!=null?` · Total de la casa: ${e.line} pts`:''}`;
  $('fichaBody').innerHTML=`<div class="fhd"><span class="hlg">${esc(e.lg)} · ${dlab(e.t)} ${hhmm(e.t)}</span><h3>${esc(e.h)} <span>vs</span> ${esc(e.a)}</h3><div class="fn">${meta}</div>${e.note?`<div class="pwarn" style="margin-top:8px">${esc(e.note)}</div>`:''}</div>
   <div class="seg" style="margin:12px 0">${tabs.map(([k,l])=>`<button class="${FTAB===k?'on':''}" data-ft="${k}">${l}</button>`).join('')}</div>${body}
   ${typeof SAMPLE!=='undefined'&&SAMPLE?`<div style="margin-top:14px"><button class="btn menta" id="fAi">🧠 Análisis experto de este partido</button><div id="fAiBox" class="note" style="margin-top:10px"></div></div>`:''}
   <p class="note" style="margin-top:12px">“Ventaja” = cuánto ganarías a la larga por cada $100 a la mejor cuota, si nuestra probabilidad fuera exacta. Compara siempre con la cuota de tu casa.</p>`;
  if($('fAi'))$('fAi').onclick=()=>expertAI(e);
  if(FTAB==='jug'&&pg)bindProps(pg);
  $('fichaBody').querySelectorAll('[data-ft]').forEach(b=>b.onclick=()=>{FTAB=b.dataset.ft;drawFicha(e);});
  $('fichaBody').querySelectorAll('[data-leg]').forEach(b=>b.onclick=()=>{const x=e.m.find(y=>y.k===b.dataset.leg);addLeg(e,x);});
}

/* ---------- PARLAYS ---------- */
const PMODES={seg:{n:'Seguro',d:'Piernas de 72% a 90%. Sale seguido, paga poco.',lo:.72,hi:.90,legs:3},eq:{n:'Equilibrado',d:'Piernas de 60% a 80%. Balance entre probabilidad y pago.',lo:.60,hi:.80,legs:3},jug:{n:'Jugoso',d:'Piernas de 50% a 70%. Paga mucho, falla seguido.',lo:.50,hi:.70,legs:4}};
function addLeg(e,x){if(!e||!x)return;PAR=PAR.filter(l=>l.e.id!==e.id);PAR.push({e,x});renderParlay();toast('Agregado al parlay: '+x.k);}
function genParlay(seed){const md=PMODES[PMODE];const evs=TD.events.filter(e=>(PSP==='all'||e.sp===PSP)&&inDay(e,PDAY));
  const pool=[];for(const e of evs){const c=e.m.filter(x=>x.p>=md.lo&&x.p<=md.hi&&x.fam!=='dnb');if(!c.length)continue;
    // preferimos la jugada clave si cae en el rango; si no, la de mayor probabilidad
    c.sort((a,b)=>b.p-a.p);const k=c.find(x=>x.k===e.key.k)||c[0];pool.push({e,x:k,alt:c});}
  pool.sort((a,b)=>b.x.p-a.x.p);
  let pick=pool.slice(0,PN);
  if(seed){const sh=[...pool].sort(()=>Math.random()-.5);pick=sh.slice(0,PN).map(o=>({e:o.e,x:o.alt[Math.floor(Math.random()*Math.min(3,o.alt.length))]}));}
  PAR=pick.map(o=>({e:o.e,x:o.x}));renderParlay();}
function renderParlay(){const el=$('parBox');if(!el)return;loadToday(()=>{
  const md=PMODES[PMODE];const cnt=TD.events.filter(e=>(PSP==='all'||e.sp===PSP)&&inDay(e,PDAY)).length;
  const p=PAR.reduce((a,l)=>a*l.x.p,1),fair=PAR.length?1/p:0,allOdd=PAR.length&&PAR.every(l=>l.x.odd),real=allOdd?PAR.reduce((a,l)=>a*l.x.odd,1):fair*Math.pow(.95,PAR.length),ev=PAR.length?p*real-1:0;
  const oneIn=p>0?Math.max(1,Math.round(1/p)):0;
  el.innerHTML=`<div class="pgrid"><div>
   <div class="lbl">1. Tipo de parlay</div><div class="pmodes">${Object.entries(PMODES).map(([k,v])=>`<button class="pm ${PMODE===k?'on':''}" data-pm="${k}"><b>${v.n}</b><span>${v.d}</span></button>`).join('')}</div>
   <div class="lbl">2. ¿Cuándo?</div><div class="seg">${[['Hoy',0],['Mañana',1],['Semana',7]].map(([l,d])=>`<button class="${PDAY===d?'on':''}" data-pd="${d}">${l}</button>`).join('')}</div>
   <div class="lbl">3. Deporte</div><div class="seg">${[['all','Todo'],['fut','Fútbol'],['nba','NBA'],['nfl','NFL']].map(([k,l])=>`<button class="${PSP===k?'on':''}" data-ps="${k}">${l}</button>`).join('')}</div>
   <div class="lbl">4. Número de piernas: <b id="pnv">${PN}</b></div><input type="range" min="2" max="6" value="${PN}" id="pnr" style="width:100%">
   <div style="display:flex;gap:8px;margin-top:14px;flex-wrap:wrap"><button class="btn menta" id="pGen">⚡ Armar parlay</button><button class="btn" id="pShuf">🎲 Otra combinación</button><button class="btn" id="pClr">Limpiar</button></div>
   <p class="note">${cnt} partidos disponibles. Usamos una sola pierna por partido para no mezclar resultados que dependen entre sí. También puedes agregar piernas desde “Partidos de hoy” con <b>+ Parlay</b>.</p>
  </div><div class="pslip">
   <div class="lbl">Tu parlay</div>
   ${PAR.length?PAR.map((l,i)=>`<div class="leg"><div><div class="kk">${esc(l.x.k)}</div><div class="fn">${esc(l.e.h)} vs ${esc(l.e.a)} · ${esc(l.e.lg)} · ${dlab(l.e.t)} ${hhmm(l.e.t)}</div></div><b>${p0(l.x.p)}</b><button class="x" data-rm="${i}">×</button></div>`).join(''):'<p class="note">Elige un tipo y toca <b>Armar parlay</b>.</p>'}
   ${PAR.length?`<div class="psum"><div><span>Probabilidad de que salga</span><b class="big">${(p*100).toFixed(p<.1?1:0)}%</b><span class="fn">≈ 1 de cada ${oneIn} veces</span></div>
     <div><span>Cuota justa</span><b>${fair.toFixed(2)}</b><span class="fn">si apuestas $100 → $${Math.round(fair*100)}</span></div>
     <div><span>${allOdd?'Mejor cuota real':'Cuota aprox. en tu casa'}</span><b>${real.toFixed(2)}</b><span class="fn">${allOdd?'combinando las mejores casas':'restando ~5% de comisión por pierna'}</span></div></div>
     <div class="pwarn">${ev>=0?'✅ A estas cuotas el parlay tendría ventaja según el modelo. Confirma las cuotas de tu casa.':'💡 Busca la mejor cuota en tu casa: cada pierna lleva comisión. Juega por diversión y solo lo que puedas perder · +18.'}</div>`:''}
  </div></div>`;
  el.querySelectorAll('[data-pm]').forEach(b=>b.onclick=()=>{PMODE=b.dataset.pm;PN=PMODES[PMODE].legs;genParlay();});
  el.querySelectorAll('[data-pd]').forEach(b=>b.onclick=()=>{PDAY=+b.dataset.pd;genParlay();});
  el.querySelectorAll('[data-ps]').forEach(b=>b.onclick=()=>{PSP=b.dataset.ps;genParlay();});
  $('pnr').oninput=e=>{PN=+e.target.value;$('pnv').textContent=PN;};$('pnr').onchange=()=>genParlay();
  $('pGen').onclick=()=>genParlay();$('pShuf').onclick=()=>genParlay(true);$('pClr').onclick=()=>{PAR=[];renderParlay();};
  el.querySelectorAll('[data-rm]').forEach(b=>b.onclick=()=>{PAR.splice(+b.dataset.rm,1);renderParlay();});
});}
function initHoy(){
  renderJK();renderBigStat();
  if($('fichaClose'))$('fichaClose').onclick=()=>$('fichaModal').classList.remove('on');
  if($('fichaModal'))$('fichaModal').addEventListener('click',e=>{if(e.target.id==='fichaModal')$('fichaModal').classList.remove('on');});
  loadToday(()=>{if(!TD.events.some(e=>inDay(e,0)&&!e.pending)){HDAY=7;PDAY=7;}renderHoy();if(!PAR.length)genParlay();});
}

/* Análisis experto: reglas tomadas de los prompts de análisis del usuario (fútbol y NFL), limitado a los datos que tiene la página. */
async function expertAI(e){const btn=$('fAi'),box=$('fAiBox');btn.disabled=true;btn.textContent='Analizando…';
  const data={deporte:SPN[e.sp],competicion:e.lg,fecha:e.t,local:e.h,visitante:e.a,modelo_propio_sin_cuotas:!!e.own,nota:e.note||null,
    goles_esperados:e.xg||null,margen_esperado:e.margin??null,linea_total_casa:e.line??null,marcadores_probables:e.scores||null,
    mercados:e.m.map(x=>({mercado:x.k,tipo:FAMN[x.fam],prob:x.p,cuota_justa:x.fair,mejor_cuota:x.odd||null,casa:x.book||null,ev:x.ev??null})),fuente:TD.src,datos_del:TD.taken};
  const prompt=`Eres el equipo de análisis de "El Bicho Picks" (analista deportivo, estadístico y especialista en valor esperado). Escribe en español de México, claro y breve, para alguien que no es experto.
REGLAS: usa SOLO los datos del JSON. No inventes estadísticas, lesiones, alineaciones, rachas ni cuotas. No digas que buscaste en internet. Distingue dato real (cuotas), cálculo del modelo y estimación. Ninguna apuesta es segura. Una probabilidad alta no garantiza rentabilidad. Si una selección tiene EV negativo con la mejor cuota disponible, dilo: "no conviene a esa cuota". Si los datos no alcanzan para tres apuestas, da menos.
FORMATO (texto corto, sin tablas Markdown):
1) Resumen del partido en 2-3 frases: favorito, qué tan apretado está y cuántos goles/puntos se esperan.
2) Si el resultado está apretado, explica qué mercado alternativo tiene mejor probabilidad (goles, ambos anotan, doble oportunidad, hándicap).
3) Las 3 apuestas individuales más probables del mismo partido, una por tipo de mercado, ordenadas de mayor a menor probabilidad. Para cada una: **mercado**, probabilidad, cuota justa, mejor cuota y EV si existen, riesgo (bajo/medio/alto) y su principal riesgo.
4) Aclara si las tres dependen del mismo escenario del partido.
5) Conclusión: ¿hay alguna apuesta justificable o es mejor NO APOSTAR? Cierra con una línea de juego responsable (+18).
DATOS: ${JSON.stringify(data)}`;
  const md=t=>t.split(/\n{2,}/).map(p=>'<p>'+esc(p).replace(/\*\*(.+?)\*\*/g,'<b>$1</b>').replace(/\n/g,'<br>')+'</p>').join('');
  box.innerHTML='Pensando…';
  try{const r=await SAMPLE(prompt,{onText:({text})=>{box.innerHTML=md(text);},cache:false});box.innerHTML=md(r.text);}
  catch(err){box.innerHTML=err&&err.code==='rate_limited'?'El análisis está ocupado; intenta en un momento.':'El análisis experto no está disponible en esta vista.';}
  btn.disabled=false;btn.textContent='🧠 Análisis experto de este partido';}

/* ---------- Historial de jugadas clave ---------- */
let JK=null,JKN=15,RP=null,RPN=null,RPT=null;
function renderJK(){const el=$('jkBox');if(!el)return;
  if(!JK){Promise.all([fetch('sys/picks.json',{cache:'no-store'}).then(r=>r.json()),fetch('backtest.json',{cache:'no-store'}).then(r=>r.json()).catch(()=>({}))]).then(([j,b])=>{JK=j;RP=b.replay||null;RPN=b.replay_nfl||null;RPT=b.replay_total||null;renderJK();renderBigStat();}).catch(()=>{el.innerHTML='';});return;}
  const P=JK.picks.slice().sort((a,b)=>a.t<b.t?1:-1),done=P.filter(p=>p.res&&!p.res.void&&(p.key.g==='win'||p.key.g==='loss'));
  const st=xs=>{const w=xs.filter(p=>p.key.g==='win').length,n=xs.length;return{n,w,acc:n?w/n:0,exp:n?xs.reduce((a,p)=>a+p.key.p,0)/n:0};};
  const all=st(done),bySp=['fut','nba','nfl'].map(s=>[s,st(done.filter(p=>p.sp===s))]).filter(([,x])=>x.n),byR=[['Riesgo bajo (75%+)',.75,1.01],['Riesgo medio (60–75%)',.6,.75],['Riesgo alto (<60%)',0,.6]].map(([l,lo,hi])=>[l,st(done.filter(p=>p.key.p>=lo&&p.key.p<hi))]).filter(([,x])=>x.n);
  const pend=P.filter(p=>!p.res).length;
  const row=([l,x])=>`<tr><td>${l}</td><td class="n num">${x.n}</td><td class="n num"><b>${pct(x.acc,0)}</b></td><td class="n num">${pct(x.exp,0)}</td></tr>`;
  const since=P.length?dlab(P[P.length-1].made):'';
  el.innerHTML=`<h3 class="t" style="margin-top:0">📒 Historial de jugadas clave</h3>
  <p class="note" style="margin-top:4px">Cada mañana guardamos la jugada clave de cada partido <b>antes</b> de que empiece, y después la calificamos con el marcador final. Nada se borra ni se edita${since?` · desde el ${since}`:''}.</p>
  ${all.n?`<div class="psum" style="grid-template-columns:repeat(3,1fr)"><div><span>Calificadas</span><b>${all.n}</b><span class="fn">${pend} pendientes</span></div><div><span>Acertamos</span><b class="big">${pct(all.acc,0)}</b><span class="fn">${all.w} de ${all.n}</span></div><div><span>Lo que esperábamos</span><b>${pct(all.exp,0)}</b><span class="fn">probabilidad promedio</span></div></div>
  <p class="note">Si "Acertamos" y "Lo que esperábamos" se parecen, las probabilidades están bien calibradas. Con pocos partidos la diferencia todavía es mucho azar.</p>
  <div style="overflow-x:auto"><table class="ftab"><thead><tr><th>Grupo</th><th class="n">Jugadas</th><th class="n">Acierto real</th><th class="n">Esperado</th></tr></thead><tbody>${bySp.map(([s,x])=>row([SPN[s],x])).join('')}${byR.map(row).join('')}</tbody></table></div>`
  :`<p class="note">${P.length} jugadas guardadas, esperando resultado. Los primeros resultados aparecen en 1–2 días.</p>`}
  ${RPT?`<div class="bigstat"><div><b>${fmt(RPT.partidos)}</b><span>partidos reales simulados</span></div><div><b class="g">${pct(RPT.clave.acc,0)}</b><span>acierto de la jugada clave</span></div><div><b>${pct(RPT.top1.acc,0)}</b><span>acierto de la jugada más segura</span></div></div>`:''}
  ${RP?(()=>{const k=RP.jugada_clave,f=RP.favorito_1x2,t=RP.top1,pl=RP.parlays_seguros_3,rr=RP.por_riesgo;return`<div class="hkey" style="margin:14px 0">
    <span class="lab">⚽ Fútbol · prueba con ${fmt(RP.partidos)} partidos pasados</span>
    <p style="margin:6px 0 10px;font-size:13px;color:var(--t2)">Simulamos con el sistema actual ${fmt(RP.partidos)} partidos reales de 8 ligas (${new Date(RP.desde+'T12:00').toLocaleDateString('es-MX',{month:'short',year:'numeric'})} a ${new Date(RP.hasta+'T12:00').toLocaleDateString('es-MX',{month:'short',year:'numeric'})}) y los comparamos con el marcador final.</p>
    <div class="psum" style="grid-template-columns:repeat(3,1fr);margin-top:0"><div><span>Jugada clave</span><b class="big">${pct(k.acc,0)}</b><span class="fn">${fmt(k.w)} de ${fmt(k.n)} · esperado ${pct(k.exp,0)}</span></div><div><span>Jugada más segura (top 1)</span><b>${pct(t.acc,0)}</b><span class="fn">esperado ${pct(t.exp,0)}</span></div><div><span>Solo el ganador (1X2)</span><b>${pct(f.acc,0)}</b><span class="fn">esperado ${pct(f.exp,0)}</span></div></div>
    <p class="note" style="margin-bottom:0">Riesgo bajo: acertó ${pct(rr['bajo (75%+)'].acc,0)} · riesgo medio: ${pct(rr['medio (60-75%)'].acc,0)} · parlays “seguros” de 3: ${pct(pl.acc,0)}. Ninguna jugada es segura y acertar no garantiza ganancias. Juega con responsabilidad · +18.</p></div>`;})():''}
  ${RPN?(()=>{const k=RPN.jugada_clave,t=RPN.top1,f=RPN.favorito;return`<div class="hkey" style="margin:14px 0;border-color:rgba(59,130,246,.4);background:rgba(59,130,246,.07)"><span class="lab" style="color:var(--azul)">🏈 NFL · prueba con ${fmt(k.n)} partidos (temporadas ${RPN.desde.slice(0,4)}–2026)</span>
    <div class="psum" style="grid-template-columns:repeat(3,1fr)"><div><span>Jugada clave</span><b class="big" style="color:var(--azul)">${pct(k.acc,0)}</b><span class="fn">${fmt(k.w)} de ${fmt(k.n)}</span></div><div><span>Jugada más segura</span><b>${pct(t.acc,0)}</b><span class="fn">top 1</span></div><div><span>Solo el ganador</span><b>${pct(f.acc,0)}</b><span class="fn">moneyline</span></div></div>
    <p class="note" style="margin-bottom:0">Acierto estable temporada tras temporada (entre ${pct(Math.min(...Object.values(RPN.por_temporada).map(x=>x.acc)),0)} y ${pct(Math.max(...Object.values(RPN.por_temporada).map(x=>x.acc)),0)}). Datos públicos de nflverse con líneas de cierre.</p></div>`;})():''}
  <div style="margin-top:12px">${P.slice(0,JKN).map(p=>{const g=p.key.g,lab=!p.res?'<span class="rk mid">Pendiente</span>':p.res.void?'<span class="rk mid">Anulado</span>':g==='win'?'<span class="rk good">✓ Acierto</span>':g==='loss'?'<span class="rk hi">✗ Fallo</span>':g==='push'?'<span class="rk mid">Devuelta</span>':'<span class="rk mid">Sin calificar</span>';
    return`<div class="leg"><div><div class="kk" style="font-size:14px">${esc(p.key.k)} · ${p0(p.key.p)}</div><div class="fn">${esc(p.h)} ${p.res&&!p.res.void?`<b>${p.res.hs}-${p.res.as}</b>`:'vs'} ${esc(p.a)} · ${esc(p.lg)} · ${dlab(p.t)}</div></div>${lab}<span></span></div>`;}).join('')}</div>
  ${P.length>JKN?`<div style="text-align:center;margin-top:10px"><button class="btn sm" id="jkMore">Ver más (${P.length-JKN})</button></div>`:''}`;
  if($('jkMore'))$('jkMore').onclick=()=>{JKN+=30;renderJK();};}

function weekBox(){if(!JK)return '';const lim=Date.now()-7*864e5,d=JK.picks.filter(p=>p.res&&!p.res.void&&new Date(p.t).getTime()>lim&&(p.key.g==='win'||p.key.g==='loss'));if(d.length<5)return '';
  const w=xs=>xs.filter(p=>p.key.g==='win').length,sp=[['fut','⚽ Fútbol'],['nba','🏀 NBA'],['nfl','🏈 NFL']].map(([k,l])=>{const x=d.filter(p=>p.sp===k);return x.length?`<span>${l} <b>${w(x)}/${x.length}</b></span>`:''}).join('');
  return `<div class="wkbox"><div class="wkt">🔥 Últimos 7 días, en vivo</div><div class="wkn"><b>${w(d)} de ${d.length}</b> jugadas clave acertadas <b class="g">(${Math.round(100*w(d)/d.length)}%)</b></div><div class="wks">${sp}</div></div>`;}
function renderBigStat(){const el=$('bigStat');if(!el||!RPT)return;
  el.innerHTML=weekBox()+`<div class="bigstat"><div><b>${fmt(RPT.partidos)}</b><span>partidos reales simulados (fútbol y NFL)</span></div><div><b class="g">${pct(RPT.clave.acc,0)}</b><span>de acierto en nuestra jugada clave</span></div><div><b>${pct(RPT.top1.acc,0)}</b><span>en la jugada más segura de cada partido</span></div></div><p class="note" style="text-align:center;margin:8px 0 0">Prueba con partidos ya jugados de 9 ligas · <a href="#record" onclick="event.preventDefault();goTo('metodo')" style="color:var(--menta)">ver el récord completo →</a></p>`;}
