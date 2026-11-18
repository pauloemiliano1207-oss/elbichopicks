/* =====================================================================
   El Bicho Picks · Panel predictivo, transparencia, evaluación, rankings y torneos
   ===================================================================== */

/* ---------- Redondeo que suma exactamente 100% (método del residuo mayor) ---------- */
function round100(ps,dec=0){
  const f=Math.pow(10,dec),tot=100*f,raw=ps.map(p=>p*tot),fl=raw.map(Math.floor);let rest=tot-fl.reduce((a,b)=>a+b,0);
  raw.map((r,i)=>[r-fl[i],i]).sort((a,b)=>b[0]-a[0]).forEach(([_,i])=>{if(rest>0){fl[i]++;rest--;}});
  return fl.map(v=>(v/f).toFixed(dec));
}

/* ---------- Incertidumbre de la estimación (no es la probabilidad del resultado) ---------- */
function uncertainty(R){
  const r=[],add=(pts,t)=>r.push({pts,t});
  const sp=R.sport,H=R.H,A=R.A;
  if(R.nat){
    add(0,'Rating Elo construido con todo el historial internacional de cada selección');
    add(1,'Modelo de selecciones v1: reproduce la curva de Elo, pero aún no se valida con resultados históricos; con diferencias grandes de Elo puede ser más extremo que el mercado');
    const mt=$('mtype').value;if(mt==='amistoso')add(2,'Amistoso: convocatorias y rotaciones suelen ser inciertas');
    if(Math.max(H.pos,A.pos)>120)add(1,'Al menos una selección juega pocos partidos de alto nivel');
    add(1,'Convocatorias y alineaciones no confirmadas (no entran al cálculo)');
    add(1,'Sin datos de xG ni de jugadores para selecciones');
    if(Math.abs(H.elo-A.elo)<60)add(0,'Equipos muy parejos: el resultado es incierto, aunque la estimación sea buena');
  }else if(sp==='fut'){
    const gp=Math.min(H.gp||0,A.gp||0);
    if(gp<8)add(2,`Muestra corta: solo ${gp} partidos de liga esta temporada`);else if(gp<14)add(1,`Muestra moderada: ${gp} partidos esta temporada`);else add(0,`Muestra suficiente: ${gp} partidos esta temporada`);
    if(INTL||S.H.lg!==S.A.lg)add(2,'Equipos de ligas distintas: el factor de nivel entre ligas es aproximado');
    add(1,'Alineaciones y lesiones no confirmadas (no entran al cálculo)');
    add(1,'Sin xG: el modelo usa goles reales, que tienen más ruido');
  }else{
    const gp=Math.min(H.gp||0,A.gp||0);add(gp<20?1:0,`${gp} partidos jugados esta temporada`);
    add(1,sp==='nba'?'Lesiones y descansos de jugadores no incluidos':'Estado del quarterback y lesiones no incluidos');
    add(1,'El récord de ganados y perdidos dice menos que la diferencia de puntos, que aún no está disponible');
  }
  if(R.blend){const d=Math.abs(R.blend.model[0]-R.blend.market[0]);if(d>.12)add(2,`El modelo y el mercado no coinciden (${Math.round(d*100)} puntos de diferencia)`);else if(d>.06)add(1,`El modelo y el mercado difieren ${Math.round(d*100)} puntos`);else add(0,'El modelo y el mercado coinciden');}
  else if(!R.nat)add(1,'Sin probabilidad del mercado para contrastar');
  if(Object.values(S.H.ctx).some(Boolean)||Object.values(S.A.ctx).some(Boolean)||S.H.adj||S.A.adj)add(1,'Incluye supuestos que tú marcaste (no son datos confirmados)');
  const sc=r.reduce((s,x)=>s+x.pts,0),level=sc<=2?'Baja':sc<=4?'Media':'Alta';
  return{level,sc,r,dec:level==='Baja'?1:0};
}

/* ---------- Factores: ¿cómo se calculó esta predicción? ---------- */
function factorRows(R){
  const H=R.H,A=R.A,rows=[],nn=$('neutral').checked;
  const row=(lab,vh,va,better,fmt2,inModel,note)=>rows.push({lab,vh,va,adv:vh==null||va==null||Math.abs(vh-va)<1e-9?'=':(better==='hi'?(vh>va?'H':'A'):(vh<va?'H':'A')),f:fmt2||(v=>v),inModel,note});
  if(R.nat){
    row('Rating Elo',H.elo,A.elo,'hi',v=>v,true);
    row('Ranking mundial (Elo)',H.pos,A.pos,'lo',v=>v+'º',false,'Se deriva del Elo');
    rows.push({lab:'Sede',vh:nn?'Neutral':'Local',va:nn?'Neutral':'Visitante',adv:nn?'=':'H',f:v=>v,inModel:true,note:nn?'Sin ventaja':'+100 puntos Elo al local'});
    rows.push({lab:'Tipo de partido',vh:MTYPE[$('mtype').value],va:'',adv:'=',f:v=>v,inModel:false,note:'No cambia las probabilidades: aún no hay datos para estimar ese efecto'});
    rows.push({lab:'Confederación',vh:H.conf,va:A.conf,adv:'=',f:v=>v,inModel:false,note:'Ya reflejada en el Elo'});
  }else if(R.sport==='fut'){
    const L=lgOf('H'),gpH=H.gp||1,gpA=A.gp||1;
    if(H.gf!=null)row('Goles a favor por partido',H.gf/gpH,A.gf/gpA,'hi',v=>v.toFixed(2),true);
    if(H.ga!=null)row('Goles en contra por partido',H.ga/gpH,A.ga/gpA,'lo',v=>v.toFixed(2),true);
    row('Fuerza de ataque (1.00 = promedio)',H.x,A.x,'hi',v=>v.toFixed(2),true);
    row('Fuerza defensiva (menor es mejor)',H.y,A.y,'lo',v=>v.toFixed(2),true);
    row('Puntos por partido',H.pts/gpH,A.pts/gpA,'hi',v=>v.toFixed(2),false,'Informativo');
    if(H.hs&&A.as)row('Dif. de goles · local vs. visitante',(H.hs[1]-H.hs[2])/Math.max(1,H.hs[0]),(A.as[1]-A.as[2])/Math.max(1,A.as[0]),'hi',v=>(v>0?'+':'')+v.toFixed(2),false,'No mejoró la predicción en las pruebas; informativo');
    if(H.form_s&&A.form_s){const fp=s=>[...s].reduce((t,c)=>t+(c==='G'?3:c==='E'?1:0),0);row('Forma: puntos en los últimos 5',fp(H.form_s),fp(A.form_s),'hi',v=>v+' / 15',false,'Informativo; no mejoró la predicción en las pruebas');}
    if(!nn)rows.push({lab:'Localía',vh:`${L.h.toFixed(2)} goles`,va:`${L.a.toFixed(2)} goles`,adv:'H',f:v=>v,inModel:true,note:'Promedio real de la liga para local y visitante'});
    if(H.alt&&!nn)rows.push({lab:'Altitud',vh:`+${Math.round((H.alt-1)*100)}%`,va:'',adv:'H',f:v=>v,inModel:true,note:'Ventaja adicional de jugar en altura'});
  }else{
    const u=R.sport==='nba'?'pts':'pts';
    row('Ofensiva (pts sobre el promedio)',H.x,A.x,'hi',v=>(v>0?'+':'')+v.toFixed(1),true);
    row('Defensiva (pts permitidos sobre el promedio)',H.y,A.y,'lo',v=>(v>0?'+':'')+v.toFixed(1),true);
    row('Porcentaje de victorias',H.w/Math.max(1,H.w+H.l),A.w/Math.max(1,A.w+A.l),'hi',v=>Math.round(v*100)+'%',true);
    if(!nn)rows.push({lab:'Localía',vh:R.sport==='nba'?'+2.4 pts':'+1.8 pts',va:'',adv:'H',f:v=>v,inModel:true,note:'Ventaja de local típica de la liga'});
  }
  if(R.blend)rows.push({lab:'Consenso del mercado (SportRadar)',vh:pct(R.blend.market[0],0),va:pct(R.blend.market[2],0),adv:R.blend.market[0]>R.blend.market[2]?'H':'A',f:v=>v,inModel:true,note:R.sport==='nfl'?'Pesa 50% en el pronóstico final':'Pesa 75% en el pronóstico final'});
  return rows;
}
function howHTML(R){
  const U=uncertainty(R),rows=factorRows(R),h=esc(short(R.H.n)),a=esc(short(R.A.n));
  const lvlCol={Baja:'var(--menta)',Media:'var(--dorado)',Alta:'var(--naranja)'}[U.level];
  const advTxt=x=>x==='H'?`<span class="pill good">Ventaja ${h}</span>`:x==='A'?`<span class="pill" style="background:rgba(59,130,246,.15);color:var(--azul)">Ventaja ${a}</span>`:'<span class="pill bad">Parejo</span>';
  let s=`<div class="unc"><div><div class="lbl">Incertidumbre de la estimación</div><div class="ul" style="color:${lvlCol}">${U.level}</div><div class="note" style="margin:2px 0 0">No es lo mismo que la probabilidad: un 65% con incertidumbre alta merece menos confianza que un 65% con incertidumbre baja.</div></div>
    <ul class="ur">${U.r.map(x=>`<li><i style="background:${x.pts>=2?'var(--naranja)':x.pts===1?'var(--dorado)':'var(--menta)'}"></i>${esc(x.t)}</li>`).join('')}</ul></div>`;
  s+=`<table class="ftab"><thead><tr><th>Factor</th><th class="n">${h}</th><th class="n">${a}</th><th>Lectura</th><th>¿En el cálculo?</th></tr></thead><tbody>${rows.map(r=>`<tr><td>${esc(r.lab)}${r.note?`<div class="fn">${esc(r.note)}</div>`:''}</td><td class="n num">${r.vh==null?'—':esc(String(r.f(r.vh)))}</td><td class="n num">${r.va==null||r.va===''?'—':esc(String(r.f(r.va)))}</td><td>${advTxt(r.adv)}</td><td>${r.inModel?'<span class="pill good">Sí</span>':'<span class="pill bad">Informativo</span>'}</td></tr>`).join('')}</tbody></table>
    <p class="note">Estos factores muestran qué datos usa el modelo y hacia dónde apuntan. Son asociaciones estadísticas, no causas: un equipo no gana "por" tener más puntos por partido.</p>`;
  s+=`<h3 class="t" style="margin-top:20px">Análisis de sensibilidad <small>¿cuánto cambia el pronóstico si cambia un supuesto?</small></h3>${sensHTML(R)}`;
  return s;
}
function sensHTML(R){
  const P=R.P,rows=[],fmt3=p=>p.map(x=>pct(x,0));
  if(R.sport==='fut'){
    const base=futPr(P.lh,P.la);rows.push(['Pronóstico actual',base]);
    if(R.nat){const k=Math.exp(.00434*50),nn=$('neutral').checked;rows.push([nn?'Si el primero jugara en casa (+100 Elo)':'Si se jugara en cancha neutral',nn?futPr(P.lh*k,P.la/k):futPr(P.lh/k,P.la*k)]);}
    else{const L=lgOf('H'),m=(L.h+L.a)/2;if(!$('neutral').checked)rows.push(['Si se jugara en cancha neutral',futPr(P.lh*m/L.h/(R.H.alt||1),P.la*m/L.a)]);}
    rows.push([`Si ${short(R.H.n)} pierde 10% de ataque (supuesto ilustrativo)`,futPr(P.lh*.9,P.la)]);
    rows.push([`Si ${short(R.A.n)} pierde 10% de ataque (supuesto ilustrativo)`,futPr(P.lh,P.la*.9)]);
    rows.push(['Si el partido es 20% más cerrado (menos goles)',futPr(P.lh*.8,P.la*.8)]);
  }else if(R.sport==='nba'){const pr=d=>{const z=d/14.85,p=.5*(1+erf(z/Math.SQRT2));return[p,0,1-p];};const d=P.mh-P.ma;
    rows.push(['Pronóstico actual',[R.pH,0,R.pA]],['Sin ventaja de local',pr(d-2.4)],[`${short(R.H.n)} con 3 puntos menos`,pr(d-3)],[`${short(R.A.n)} con 3 puntos menos`,pr(d+3)]);}
  else{const pr=(eh,ea)=>{const w=nflPr(eh,ea,3000);return[w,0,1-w];};rows.push(['Pronóstico actual',[R.pH,0,R.pA]],['Sin ventaja de local',pr(P.eh-.9,P.ea+.9)],[`${short(R.H.n)} con 3 puntos menos`,pr(P.eh-3,P.ea)],[`${short(R.A.n)} con 3 puntos menos`,pr(P.eh,P.ea-3)]);}
  const b=rows[0][1];
  return`<table class="ftab"><thead><tr><th>Escenario</th><th class="n">Gana ${esc(short(R.H.n))}</th>${R.sport==='fut'?'<th class="n">Empate</th>':''}<th class="n">Gana ${esc(short(R.A.n))}</th></tr></thead><tbody>${rows.map(([l,p],i)=>`<tr><td>${esc(l)}</td><td class="n num">${pct(p[0],0)}${i?dl(p[0]-b[0]):''}</td>${R.sport==='fut'?`<td class="n num">${pct(p[1],0)}${i?dl(p[1]-b[1]):''}</td>`:''}<td class="n num">${pct(p[2],0)}${i?dl(p[2]-b[2]):''}</td></tr>`).join('')}</tbody></table><p class="note">Los escenarios son hipotéticos y sirven para ver qué tan sensible es el pronóstico; no son datos confirmados.</p>`;
}
const dl=d=>Math.abs(d)<.005?'':`<span class="dlt" style="color:${d>0?'var(--menta)':'var(--naranja)'}"> ${d>0?'+':'−'}${Math.round(Math.abs(d)*100)}</span>`;
function erf(x){const t=1/(1+.3275911*Math.abs(x)),y=1-(((((1.061405429*t-1.453152027)*t)+1.421413741)*t-.284496736)*t+.254829592)*t*Math.exp(-x*x);return x>=0?y:-y;}

/* ---------- Matriz de marcadores (mapa de calor) y top 5 ---------- */
function heatHTML(R){
  if(!R.grid)return'';const G=R.grid,mx=Math.max(...G.flat()),lab=i=>i===6?'6+':i;
  let s=`<div class="heat"><div class="hx">Goles de ${esc(short(R.A.n))} →</div><table><tr><th>${esc(short(R.H.n))} ↓</th>${G.map((_,j)=>`<th>${lab(j)}</th>`).join('')}</tr>`;
  G.forEach((row,i)=>{s+=`<tr><th>${lab(i)}</th>${row.map((p,j)=>{const a=p/mx,c=i>j?'0,230,168':i<j?'59,130,246':'156,163,175';return`<td style="background:rgba(${c},${(.08+a*.85).toFixed(2)});color:${a>.55?'#04120d':'#F4F4F4'}" data-tip="${lab(i)}-${lab(j)}: ${pct(p,1)} · cuota justa ${fair(p)}">${p>=.005?(p*100).toFixed(p>=.1?0:1):'·'}</td>`;}).join('')}</tr>`;});
  return s+`</table><p class="note">Probabilidad (%) de cada marcador exacto. Verde: gana ${esc(short(R.H.n))} · gris: empate · azul: gana ${esc(short(R.A.n))}. La probabilidad de un marcador exacto siempre es mucho menor que la de un resultado (ganar, empatar o perder).</p></div>`;
}
function top5HTML(R){if(R.sport!=='fut')return'';return`<div class="top5"><span class="lbl">5 marcadores más probables</span>${R.top.slice(0,5).map((t,i)=>`<span class="sc5 ${t.c}"><b>${t.k}</b>${pct(t.p,1)}</span>`).join('')}</div>`;}

/* ---------- Comparativa visual ---------- */
function compHTML(R){
  if(R.nat||R.sport!=='fut'||R.H.gf==null)return'';
  const H=R.H,A=R.A,bar=(lab,vh,va,dec=2)=>{const t=Math.max(vh,va)||1;return`<div class="cmpb"><div class="cl">${lab}</div><div class="cbh"><span class="num">${vh.toFixed(dec)}</span><div style="width:${vh/t*100}%"></div></div><div class="cba"><div style="width:${va/t*100}%"></div><span class="num">${va.toFixed(dec)}</span></div></div>`;};
  const pg=(t,k)=>t[k]/Math.max(1,t.gp);
  let s=`<div class="cmph"><span style="color:var(--home)">${esc(H.n)}</span><span style="color:var(--away)">${esc(A.n)}</span></div>`+bar('Goles a favor / partido',pg(H,'gf'),pg(A,'gf'))+bar('Goles en contra / partido',pg(H,'ga'),pg(A,'ga'))+bar('Puntos / partido',pg(H,'pts'),pg(A,'pts'))+bar('Ataque (modelo)',H.x,A.x)+bar('Defensa (modelo, menor es mejor)',H.y,A.y);
  if(H.hs&&A.as)s+=bar(`${short(H.n)} en casa / ${short(A.n)} de visita · goles a favor`,H.hs[1]/Math.max(1,H.hs[0]),A.as[1]/Math.max(1,A.as[0]));
  if(H.form_s&&A.form_s){const strip=f=>[...f].map(c=>`<i class="fm ${c}">${c==='G'?'G':c==='E'?'E':'P'}</i>`).join('');s+=`<div class="cmpb"><div class="cl">Últimos 5 (el más reciente a la derecha)</div><div class="cbh" style="justify-content:flex-end">${strip(H.form_s)}</div><div class="cba">${strip(A.form_s)}</div></div>`;}
  return s;
}

/* ---------- Evaluación del modelo ---------- */
function evalGroup(T,draws){
  const N=T.length;if(!N)return null;const O=e=>RES_I[e.res];
  let acc=0,br=0,ll=0,rps=0;const pts=[];const freq=[0,0,0];T.forEach(e=>freq[O(e)]++);const base=freq.map(f=>f/N);
  let brB=0,llB=0;
  for(const e of T){const p=e.p,o=O(e),y=[0,0,0];y[o]=1;
    if(argmax(p)===o)acc++;br+=p.reduce((s,v,i)=>s+(v-y[i])**2,0);ll-=Math.log(Math.max(1e-6,p[o]));
    const c1=p[0]-y[0],c2=p[0]+p[1]-y[0]-y[1];rps+=(c1*c1+c2*c2)/2;
    brB+=base.reduce((s,v,i)=>s+(v-y[i])**2,0);llB-=Math.log(Math.max(1e-6,base[o]));
    for(let i=0;i<3;i++){if(!draws&&i===1)continue;pts.push([p[i],y[i]]);}}
  const bins=Array.from({length:10},()=>({n:0,c:0,o:0}));for(const[p,y]of pts){const b=bins[Math.min(9,Math.floor(p*10))];b.n++;b.c+=p;b.o+=y;}
  const ece=bins.reduce((s,b)=>s+(b.n?b.n/pts.length*Math.abs(b.o/b.n-b.c/b.n):0),0);
  return{N,acc:acc/N,br:br/N,ll:ll/N,rps:rps/N,ece,brB:brB/N,llB:llB/N,bins,base};
}

let BT=null;
function renderBacktest(){const el=$('btBox');if(!el)return;
  const go=b=>{const f=v=>v.toFixed(3),c=b.clubs,t=c[c.length-1],N=b.nat;
    el.innerHTML=`<h3 class="t" style="margin-top:22px">Prueba con históricos reales</h3>
    <p class="note" style="margin-top:4px">Para cada fecha, el modelo solo conoce los partidos anteriores (como si fuera ese día) y pronostica los siguientes. Luego se compara con lo que pasó y con las cuotas de cierre de las casas de apuestas (promedio del mercado, datos de football-data.co.uk). Temporadas 2024-25 a 2026-27.</p>
    <div style="overflow-x:auto"><table class="ftab"><thead><tr><th>Liga</th><th class="n">Partidos</th><th class="n">Acierto modelo</th><th class="n">Acierto mercado</th><th class="n">Brier modelo ↓</th><th class="n">Brier mercado ↓</th><th class="n">Brier final (25/75) ↓</th><th class="n">Sin modelo</th></tr></thead><tbody>${c.map(r=>`<tr${r.lg==='Total'?' style="font-weight:700"':''}><td>${esc(r.lg)}</td><td class="n num">${fmt(r.n)}</td><td class="n num">${pct(r.mod.acierto)}</td><td class="n num">${pct(r.mkt.acierto)}</td><td class="n num">${f(r.mod.brier)}</td><td class="n num">${f(r.mkt.brier)}</td><td class="n num">${f(r.mix.brier)}</td><td class="n num">${f(r.base.brier)}</td></tr>`).join('')}</tbody></table></div>
    <p class="note"><b>Lectura honesta:</b> el modelo es claramente mejor que adivinar con las frecuencias (Brier ${f(t.mod.brier)} contra ${f(t.base.brier)}), pero el mercado de apuestas es más preciso (${f(t.mkt.brier)}). Por eso en fútbol el pronóstico final pesa 75% mercado y 25% modelo. Ningún resultado está garantizado.</p>
    <h3 class="t" style="margin-top:22px">¿Los picks dejan ganancia?</h3>
    <p class="note" style="margin-top:4px">Simulamos apostar $1 en cada caso, con los mismos partidos de 2024 a 2026. ROI = ganancia o pérdida por cada $100 apostados. IC 95% = rango probable del resultado real.</p>
    <div style="overflow-x:auto"><table class="ftab"><thead><tr><th>Estrategia</th><th class="n">Apuestas</th><th class="n">ROI</th><th class="n">IC 95%</th></tr></thead><tbody>${b.roi.map(r=>`<tr><td>${esc(r.s)}</td><td class="n num">${fmt(r.n)}</td><td class="n num" style="color:${r.roi<0?'#FF7A00':'var(--menta)'}">${r.roi>0?'+':''}${r.roi.toFixed(1)}%</td><td class="n num">${r.lo==null?'—':r.lo.toFixed(1)+'% a '+r.hi.toFixed(1)+'%'}</td></tr>`).join('')}</tbody></table></div>
    <p class="note"><b>Conclusión:</b> ninguna estrategia ganó dinero. Cuando el modelo y la casa no coinciden, casi siempre acierta la casa. Por eso El Bicho no promete ganancias: sirve para entender cada partido y ver probabilidades claras.</p>
    <p class="note"><b>Goles (más/menos 2.5):</b> en ${fmt(b.ou.n)} partidos ajustamos el modelo de goles; su error (Brier) bajó de ${b.ou.before.toFixed(4)} a ${b.ou.after.toFixed(4)}. El mercado sigue siendo más preciso (${b.ou.market.toFixed(4)}).</p>
    <p class="note"><b>Selecciones:</b> ${fmt(N.n)} partidos internacionales de 2022 a 2026. Acierto ${pct(N.new.acierto)} (sin modelo: ${pct(N.base.acierto)}); Brier ${f(N.new.brier)} contra ${f(N.base.brier)}. Con esta prueba corregimos la escala del Elo, que exageraba un poco a los favoritos (Brier antes ${f(N.old.brier)}).</p>`;};
  if(BT)return go(BT);fetch('backtest.json').then(r=>r.json()).then(b=>{BT=b;go(b);}).catch(()=>{el.innerHTML='';});}
function renderEval(){
  const el=$('evalBox');if(!el)return;const T=(DATA.track||[]).filter(e=>e.res);
  const F=evalGroup(T.filter(e=>e.lg!=='nfl'),true),Nf=evalGroup(T.filter(e=>e.lg==='nfl'),false);
  const row=(lab,G)=>G?`<tr><td><b>${lab}</b><div class="fn">${G.N} partidos</div></td><td class="n num">${pct(G.acc,0)}</td><td class="n num">${G.br.toFixed(3)} <span class="fn">vs ${G.brB.toFixed(3)}</span></td><td class="n num">${G.ll.toFixed(3)} <span class="fn">vs ${G.llB.toFixed(3)}</span></td><td class="n num">${G.rps.toFixed(3)}</td><td class="n num">${(G.ece*100).toFixed(1)} pts</td></tr>`:'';
  el.innerHTML=`<table class="ftab"><thead><tr><th>Grupo</th><th class="n">Acierto 1X2</th><th class="n">Brier ↓</th><th class="n">Log Loss ↓</th><th class="n">RPS ↓</th><th class="n">ECE ↓</th></tr></thead><tbody>${row('Fútbol de clubes',F)}${row('NFL',Nf)}</tbody></table>
  <p class="note">↓ = menor es mejor. "vs" compara contra un pronóstico sin modelo que usa solo la frecuencia de local/empate/visitante de esa misma muestra. ECE mide la descalibración: qué tanto se alejan las probabilidades de lo que realmente pasó. Con menos de unos cientos de partidos estas cifras todavía varían mucho.</p>
  <div id="btBox"></div><div class="grid2" style="margin-top:12px"><div><h3 class="t">Curva de calibración · fútbol</h3>${calSVG(F)}</div><div><h3 class="t">Curva de calibración · NFL</h3>${calSVG(Nf)}</div></div>`;
  renderBacktest();
}
function calSVG(G){
  if(!G)return'<p class="note">Sin datos todavía.</p>';const W=320,H=240,p=34,x=v=>p+(W-p-10)*v,y=v=>H-p-(H-p-10)*v;
  let s=`<svg viewBox="0 0 ${W} ${H}" width="100%" style="max-width:420px;display:block"><line x1="${x(0)}" y1="${y(0)}" x2="${x(1)}" y2="${y(1)}" stroke="#555" stroke-dasharray="4 4"/>`;
  for(const v of[0,.5,1])s+=`<text x="${x(v)}" y="${H-12}" fill="#8a8f98" font-size="10" text-anchor="middle" font-family="Montserrat,sans-serif">${v*100}%</text><text x="${p-6}" y="${y(v)+3}" fill="#8a8f98" font-size="10" text-anchor="end" font-family="Montserrat,sans-serif">${v*100}%</text>`;
  const pts=G.bins.map((b,i)=>b.n?[b.c/b.n,b.o/b.n,b.n]:null).filter(Boolean);
  s+=`<polyline points="${pts.map(([c,o])=>x(c)+','+y(o)).join(' ')}" fill="none" stroke="#00E6A8" stroke-width="2"/>`;
  for(const[c,o,n]of pts)s+=`<circle cx="${x(c)}" cy="${y(o)}" r="${3+Math.sqrt(n)}" fill="#00E6A8" fill-opacity=".55" stroke="#0b0b0b" stroke-width="1.5"><title>Predicho ${pct(c,0)} · ocurrió ${pct(o,0)} · ${n} casos</title></circle>`;
  return s+`<text x="${W/2}" y="${H-1}" fill="#8a8f98" font-size="10" text-anchor="middle" font-family="Montserrat,sans-serif">Probabilidad pronosticada</text></svg><p class="note">Si el modelo está bien calibrado, los puntos caen sobre la diagonal. El tamaño del punto indica cuántos casos hay.</p>`;
}

/* ---------- Rankings ---------- */
let RKIND='nat',RLG='epl',RCONF='Todas';
function renderRankings(){
  const el=$('rankBox');if(!el)return;
  const tabs=[['nat','Selecciones'],['fut','Clubes'],['nba','NBA'],['nfl','NFL']];
  let head=`<div class="leagues">${tabs.map(([k,l])=>`<button class="lg ${RKIND===k?'on':''}" data-rk="${k}">${l}</button>`).join('')}</div>`;
  let rows=[],note='';
  if(RKIND==='nat'){head+=`<div class="leagues">${['Todas','UEFA','CONMEBOL','CONCACAF','CAF','AFC','OFC'].map(c=>`<button class="lg ${RCONF===c?'on':''}" data-rc="${c}">${c}</button>`).join('')}</div>`;
    const T=DATA.nat.nat.teams.filter(t=>RCONF==='Todas'||t.conf===RCONF).slice(0,30);const mx=T[0]?T[0].elo:2200,mn=Math.min(...T.map(t=>t.elo))-60;
    rows=T.map(t=>({n:`${flag(t.iso)} ${t.n}`,sub:t.conf,v:t.elo,lab:String(t.elo),w:(t.elo-mn)/(mx-mn),ci:null,pos:t.pos,c:t}));
    note=`Rating Elo de World Football Elo Ratings (consultado el ${DATA.nat.nat.elo_date}). Esa fuente no publica intervalos de incertidumbre, por eso aquí no se muestran.`;}
  else if(RKIND==='fut'){head+=`<div class="leagues">${LG_ORDER.filter(k=>DATA.fut[k]).map(k=>`<button class="lg ${RLG===k?'on':''}" data-rl="${k}">${esc(DATA.fut[k].name)}</button>`).join('')}</div>`;
    const L=DATA.fut[RLG],m=(L.h+L.a)/2;const T=L.teams.map(t=>{const v=m*(t.x-t.y),se=1.96*Math.sqrt(m*(t.x+t.y)/((t.gp||0)+8));return{n:t.n,sub:`${t.pos}º en la tabla`,v,lab:(v>0?'+':'')+v.toFixed(2),ci:se,c:t};}).sort((a,b)=>b.v-a.v);
    const ext=Math.max(...T.map(t=>Math.abs(t.v)+t.ci));rows=T.map(r=>({...r,w:(r.v+ext)/(2*ext),ciw:r.ci/(2*ext)}));
    note='Fuerza = diferencia de goles esperada por partido contra un equipo promedio, en cancha neutral. La barra delgada muestra un intervalo aproximado del 95%: entre más corta, más confiable.';}
  else{const L=DATA[RKIND][RKIND],sd=RKIND==='nba'?12:13,k=RKIND==='nba'?20:6;const T=L.teams.map(t=>{const v=t.x-t.y,se=1.96*sd/Math.sqrt((t.gp||0)+k);return{n:t.n,sub:`${t.w}-${t.l}${t.t?'-'+t.t:''}`,v,lab:(v>0?'+':'')+v.toFixed(1),ci:se,c:t};}).sort((a,b)=>b.v-a.v);
    const ext=Math.max(...T.map(t=>Math.abs(t.v)+t.ci));rows=T.map(r=>({...r,w:(r.v+ext)/(2*ext),ciw:r.ci/(2*ext)}));
    note='Fuerza = margen de puntos esperado por partido contra un equipo promedio. La barra delgada es un intervalo aproximado del 95%.';}
  el.innerHTML=head+`<div class="rk">${rows.map((r,i)=>`<div class="rkr"><span class="rkn num">${r.pos||i+1}</span><span class="rkt">${RKIND==='nat'?'':crest(r.c,26,RKIND)}<span><b>${r.n}</b><small>${esc(r.sub)}</small></span></span><span class="rkb"><span class="rkf" style="width:${Math.max(2,r.w*100)}%"></span>${r.ci?`<span class="rkci" style="left:${(r.w-r.ciw)*100}%;width:${r.ciw*200}%"></span>`:''}</span><span class="rkv num">${r.lab}</span></div>`).join('')}</div><p class="note">${note}</p>`;
  el.querySelectorAll('[data-rk]').forEach(b=>b.onclick=()=>{RKIND=b.dataset.rk;renderRankings();});
  el.querySelectorAll('[data-rc]').forEach(b=>b.onclick=()=>{RCONF=b.dataset.rc;renderRankings();});
  el.querySelectorAll('[data-rl]').forEach(b=>b.onclick=()=>{RLG=b.dataset.rl;renderRankings();});
}


/* ---------- Torneos en curso (datos reales al 17 nov 2026) ---------- */
const LIVE_T={
  cnl:{name:'Concacaf Nations League 2026-27 · en curso',kind:'cnl',note:'Cuartos de final con resultados reales: Panamá (2-0 global ante Curazao) y Canadá (7-3 ante Guatemala) ya avanzaron. Faltan las vueltas de hoy, 17 de noviembre: Estados Unidos-Haití (ida 0-6) y México-Jamaica en Monterrey (ida 3-2 para Jamaica). Desempate en cuartos: gol de visitante, luego prórroga y penales. Las Finales (25–28 mar 2027) se juegan en el SoFi Stadium: semifinales 1º contra 4º y 2º contra 3º según el rendimiento en cuartos (aquí se ordena por diferencia de goles global y goles a favor, una aproximación).'},
  unl:{name:'UEFA Nations League 2026-27 · cuartos y Final Four',kind:'unl',note:'Fase de liga terminada. Primeros de grupo: Francia, Alemania, Inglaterra y Portugal; segundos: Bélgica, Países Bajos, España y Noruega. El sorteo de cuartos (marzo 2027) todavía no se hace: se simula cada vez respetando que no se crucen equipos del mismo grupo. Cuartos a ida y vuelta (el primero de grupo cierra en casa), prórroga y penales si hay empate. Final Four en junio 2027, sede aún sin definir (se simula en cancha neutral).'},
  lmx:{name:'Liga MX Apertura 2026 · jornada 17 y Liguilla',kind:'lmx',note:'Tabla real tras la jornada 16. Se simula la jornada 17 (20–22 nov) y la Liguilla sin Play-In: cuartos 1-8, 2-7, 3-6 y 4-5 a ida y vuelta; si hay empate en el global avanza el mejor ubicado. Semifinales con reacomodo y final a ida y vuelta con prórroga y penales. El partido Querétaro-Necaxa de la jornada 17 se dedujo del calendario publicado.'}};
const J17=[['Puebla','Atlético San Luis'],['Tijuana','Atlante'],['Juárez','Atlas'],['Pachuca','Toluca'],['Santos Laguna','León'],['Pumas','Monterrey'],['Tigres','América'],['Guadalajara','Cruz Azul'],['Querétaro','Necaxa']];
const SC={};
function sampleL(lh,la){const k=lh.toFixed(2)+'|'+la.toFixed(2);let c=SC[k];if(!c){const M=scoreMatrix(lh,la,-0.1,9),cdf=[],keys=[];let s=0;for(let i=0;i<9;i++)for(let j=0;j<9;j++){s+=M[i][j];cdf.push(s);keys.push([i,j]);}c=SC[k]={cdf,keys,s};}
  const u=Math.random()*c.s;let lo=0,hi=c.cdf.length-1;while(lo<hi){const m=(lo+hi)>>1;if(c.cdf[m]<u)lo=m+1;else hi=m;}return c.keys[lo];}
const natL=(h,a,neutral)=>natLam(tEloOf(h)+(THOST&&neutral==='host'&&h.ab==='USA'?100:0),tEloOf(a)+(THOST&&neutral==='host'&&a.ab==='USA'?100:0),neutral?0:100);
function clubL(h,a){const L=DATA.fut.ligamx;return[L.h*h.x*a.y*(h.alt||1),L.a*a.x*h.y];}
function match(h,a,lf,et){let[lh,la]=lf(h,a);if(et){lh/=3;la/=3;}return sampleL(lh,la);}
function neutralKO(a,b,lf){const[x,y]=match(a,b,lf);if(x!==y)return[x>y?a:b,0];const[p,q]=match(a,b,lf,true);if(p!==q)return[p>q?a:b,1];return[Math.random()<.5?a:b,2];}
// Eliminatoria a ida y vuelta: 'A' es local en la ida. pre = marcador de la ida ya jugado [gA,gB] (opcional)
function twoLeg(A,B,lf,rule,pre){const l1=pre||match(A,B,lf);const l2=match(B,A,lf);const gA=l1[0]+l2[1],gB=l1[1]+l2[0];
  if(gA!==gB)return{w:gA>gB?A:B,gA,gB,how:0};
  if(rule.away){const awA=l2[1],awB=l1[1];if(awA!==awB)return{w:awA>awB?A:B,gA,gB,how:3};}
  if(rule.seed)return{w:rule.seed,gA,gB,how:4};
  const[e1,e2]=match(B,A,lf,true);const tA=gA+e2,tB=gB+e1;if(tA!==tB)return{w:tA>tB?A:B,gA:tA,gB:tB,how:1};
  return{w:Math.random()<.5?A:B,gA:tA,gB:tB,how:2};}
function simLive(kind,n){
  const st={};const KY=t=>kind==='lmx'?t.n:t.ab;const S0=t=>{if(!st[KY(t)])st[KY(t)]={t,a1:0,a2:0,a3:0,fin:0,win:0,pen:0,pos:0,first:0};return st[KY(t)];};
  if(kind==='cnl'){const T=natTeam;const PAN=T('PAN'),CAN=T('CAN'),USA=T('USA'),HAI=T('HAI'),MEX=T('MEX'),JAM=T('JAM'),CUW=T('CUW'),GUA=T('GUA');[PAN,CAN,USA,HAI,MEX,JAM,CUW,GUA].forEach(S0);
    const lf=(h,a)=>natL(h,a,false),lfN=(h,a)=>natL(h,a,'host');
    for(let s=0;s<n;s++){
      const q3=twoLeg(HAI,USA,lf,{away:true},[0,6]),q4=twoLeg(JAM,MEX,lf,{away:true},[3,2]);
      const qs=[{t:PAN,gd:2,gf:2},{t:CAN,gd:4,gf:7},{t:q3.w,gd:q3.w===USA?q3.gB-q3.gA:q3.gA-q3.gB,gf:q3.w===USA?q3.gB:q3.gA},{t:q4.w,gd:q4.w===MEX?q4.gB-q4.gA:q4.gA-q4.gB,gf:q4.w===MEX?q4.gB:q4.gA}];
      if(q4.how===2)st[q4.w.ab].pen++;
      qs.forEach(q=>st[q.t.ab].a1++);qs.sort((a,b)=>b.gd-a.gd||b.gf-a.gf||Math.random()-.5);
      const f1=neutralKO(qs[0].t,qs[3].t,lfN),f2=neutralKO(qs[1].t,qs[2].t,lfN);[f1,f2].forEach(([w,h])=>{st[w.ab].fin++;if(h===2)st[w.ab].pen++;});
      const[ch,h]=neutralKO(f1[0],f2[0],lfN);st[ch.ab].win++;if(h===2)st[ch.ab].pen++;}
    return{stats:st,n,cols:[['a1','Finales (SoFi)'],['fin','Final'],['win','Campeón']]};}
  if(kind==='unl'){const T=natTeam,W=[['A1',T('FRA')],['A2',T('GER')],['A3',T('ENG')],['A4',T('POR')]],R=[['A1',T('BEL')],['A2',T('NED')],['A3',T('ESP')],['A4',T('NOR')]];W.concat(R).forEach(([,t])=>S0(t));
    const lf=(h,a)=>natL(h,a,false),lfN=(h,a)=>natL(h,a,true);
    for(let s=0;s<n;s++){let perm;do{perm=[...R].sort(()=>Math.random()-.5);}while(perm.some((r,i)=>r[0]===W[i][0]));
      const qw=W.map(([,w],i)=>{const r=perm[i][1],res=twoLeg(r,w,lf,{});if(res.how===2)st[res.w.ab].pen++;return res.w;});
      qw.forEach(t=>st[t.ab].a1++);const o=[...qw].sort(()=>Math.random()-.5);
      const f1=neutralKO(o[0],o[1],lfN),f2=neutralKO(o[2],o[3],lfN);[f1,f2].forEach(([w,h])=>{st[w.ab].fin++;if(h===2)st[w.ab].pen++;});
      const[ch,h]=neutralKO(f1[0],f2[0],lfN);st[ch.ab].win++;if(h===2)st[ch.ab].pen++;}
    return{stats:st,n,cols:[['a1','Final Four'],['fin','Final'],['win','Campeón']]};}
  if(kind==='lmx'){const L=DATA.fut.ligamx,TT=L.teams,by=nm=>TT.find(t=>t.n===nm);TT.forEach(S0);
    for(let s=0;s<n;s++){const tab=TT.map(t=>({t,pts:t.pts,gd:(t.gf||0)-(t.ga||0),gf:t.gf||0,r:Math.random()})),ix={};tab.forEach(x=>ix[x.t.n]=x);
      for(const[h,a]of J17){const H=by(h),A=by(a);if(!H||!A)continue;const[x,y]=match(H,A,clubL);const X=ix[h],Y=ix[a];X.gf+=x;Y.gf+=y;X.gd+=x-y;Y.gd+=y-x;X.pts+=x>y?3:x===y?1:0;Y.pts+=y>x?3:x===y?1:0;}
      tab.sort((a,b)=>b.pts-a.pts||b.gd-a.gd||b.gf-a.gf||b.r-a.r);tab.forEach((x,i)=>st[x.t.n].pos+=i+1);st[tab[0].t.n].first++;
      const seeds=tab.slice(0,8).map(x=>x.t);seeds.forEach(t=>st[t.n].a1++);const seedOf=t=>seeds.indexOf(t);
      const qf=[[0,7],[1,6],[2,5],[3,4]].map(([i,j])=>twoLeg(seeds[j],seeds[i],clubL,{seed:seeds[i]}).w);
      qf.forEach(t=>st[t.n].a2++);qf.sort((a,b)=>seedOf(a)-seedOf(b));
      const sf=[[0,3],[1,2]].map(([i,j])=>twoLeg(qf[j],qf[i],clubL,{seed:qf[i]}).w);sf.forEach(t=>st[t.n].fin++);sf.sort((a,b)=>seedOf(a)-seedOf(b));
      const fr=twoLeg(sf[1],sf[0],clubL,{});st[fr.w.n].win++;if(fr.how===2)st[fr.w.n].pen++;}
    return{stats:st,n,cols:[['a1','Liguilla'],['a2','Semifinal'],['fin','Final'],['win','Campeón']],lmx:true};}
}
function renderLiveOut(r,ms){
  const n=r.n,P=v=>pct(v/n,v/n>=.1?0:1),list=Object.values(r.stats).sort((a,b)=>b.win-a.win||b.fin-a.fin||b.a1-a.a1||(a.pos-b.pos));
  const ic=t=>t.iso?`<span class="flag">${flag(t.iso)}</span>`:crest(t,22,'fut');
  let s=`<div class="sub2">${fmt(n)} simulaciones en ${(ms/1000).toFixed(1)} s · datos al 17 nov 2026</div>`;
  if(TSEL==='cnl'){const m=r.stats.MEX,u=r.stats.USA;s+=`<div class="advb" style="margin:10px 0"><span>${flag('MX')} México avanza a las Finales <b style="color:var(--menta)">${P(m.a1)}</b></span><span>${flag('JM')} Jamaica avanza <b style="color:var(--azul)">${P(r.stats.JAM.a1)}</b></span><span>${flag('US')} Estados Unidos avanza <b>${P(u.a1)}</b></span></div>`;}
  s+=`<div class="champ">${list.slice(0,6).map((x,i)=>`<div class="chc ${i===0?'top':''}"><span style="font-size:28px;display:flex;justify-content:center">${ic(x.t)}</span><b>${esc(x.t.n)}</b><span class="num cp">${P(x.win)}</span><small>campeón</small></div>`).join('')}</div>`;
  s+=`<div style="overflow-x:auto"><table class="ftab tt"><thead><tr><th>Equipo</th>${r.lmx?'<th class="n">Pts hoy</th><th class="n">Lugar promedio</th><th class="n">Superlíder</th>':'<th class="n">Elo</th>'}${r.cols.map(c=>`<th class="n">${c[1]}</th>`).join('')}</tr></thead><tbody>${list.filter(x=>r.lmx||x.a1>0).map(x=>`<tr><td><span style="display:inline-flex;gap:6px;align-items:center">${ic(x.t)} ${esc(x.t.n)}</span></td>${r.lmx?`<td class="n num">${x.t.pts}</td><td class="n num">${(x.pos/n).toFixed(1)}</td><td class="n num">${P(x.first)}</td>`:`<td class="n num">${tEloOf(x.t)}</td>`}${r.cols.map(([k])=>`<td class="n num" style="background:rgba(0,230,168,${(x[k]/n*.55).toFixed(2)})">${P(x[k])}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
  s+=`<p class="note">${r.lmx?'Clubes: modelo de goles de la Liga MX (ataque, defensa, localía y altitud).':'Selecciones: modelo Elo (todavía sin validar con históricos).'} Los resultados ya jugados se toman como hechos; solo se simula lo que falta.</p>`;
  $('tOut').innerHTML=s;
}

/* ---------- Simulador de torneos de selecciones ---------- */
const TOURN={
  wc26:{name:'Mundial 2026 · re-simulación (48 equipos)',fmt:'48',note:'Grupos reales del Mundial 2026. El torneo ya se jugó (lo ganó España); esto es una re-simulación hipotética con los ratings actuales, que ya incluyen ese resultado. El modelo de selecciones todavía no se valida con históricos y puede dar probabilidades más extremas que las casas de apuestas. Los cruces de dieciseisavos siguen el cuadro oficial publicado; la asignación de los mejores terceros a cada cruce usa las combinaciones de grupos permitidas para ese cruce y puede diferir de la tabla oficial de FIFA en algunos casos.'},
  ca:{name:'Copa América · edición hipotética (16 equipos)',fmt:'16',note:'Los 10 de CONMEBOL más los 6 mejores de CONCACAF por Elo, repartidos en bombos por Elo. Cuartos y semifinales se definen en penales si hay empate (sin prórroga), como en 2024; la final tiene prórroga.',noET:true},
  cu:{name:'Torneo personalizado',fmt:'custom',note:'Elige las selecciones. Se reparten en grupos de 4 con bombos por Elo.'}};
let TSEL='cnl',TCUST=[],THOST=true,TN=10000,TEDIT={};
function natTeam(ab){return DATA.nat.nat.teams.find(t=>t.ab===ab);}
function tEloOf(t){return TEDIT[t.ab]!=null?TEDIT[t.ab]:t.elo;}
function tGroups(){
  const T=DATA.nat.nat.teams;
  if(TSEL==='wc26')return Object.entries(DATA.wc2026).map(([g,a])=>[g,a.map(natTeam)]);
  let teams;if(TSEL==='ca'){teams=T.filter(t=>t.conf==='CONMEBOL').slice(0,10).concat(T.filter(t=>t.conf==='CONCACAF').slice(0,6));}
  else teams=TCUST.map(natTeam).filter(Boolean);
  const n=teams.length,ng=n/4;if(!Number.isInteger(ng)||![2,4,8].includes(ng))return null;
  teams=[...teams].sort((a,b)=>tEloOf(b)-tEloOf(a));const G=Array.from({length:ng},()=>[]);
  teams.forEach((t,i)=>{const pot=Math.floor(i/ng),k=i%ng;G[pot%2?ng-1-k:k].push(t);});
  return G.map((g,i)=>[String.fromCharCode(65+i),g]);
}
const HOSTS={wc26:['MEX','USA','CAN']};
function tLam(a,b,round){const ha=THOST&&HOSTS[TSEL]&&HOSTS[TSEL].includes(a.ab)?100:0,hb=THOST&&HOSTS[TSEL]&&HOSTS[TSEL].includes(b.ab)?100:0;return natLam(tEloOf(a)+ha,tEloOf(b)+hb,0);}
const TC={};function tSample(a,b,et){const key=a.ab+'|'+b.ab+'|'+(et?1:0)+'|'+tEloOf(a)+'|'+tEloOf(b)+'|'+THOST;let c=TC[key];
  if(!c){let[lh,la]=tLam(a,b);if(et){lh/=3;la/=3;}const M=scoreMatrix(lh,la,-0.1,9),cdf=[],keys=[];let s=0;for(let i=0;i<9;i++)for(let j=0;j<9;j++){s+=M[i][j];cdf.push(s);keys.push([i,j]);}c=TC[key]={cdf,keys,s};}
  const u=Math.random()*c.s;let lo=0,hi=c.cdf.length-1;while(lo<hi){const m=(lo+hi)>>1;if(c.cdf[m]<u)lo=m+1;else hi=m;}return c.keys[lo];}
function tKO(a,b,noET){const[x,y]=tSample(a,b,false);if(x!==y)return[x>y?a:b,0];if(!noET){const[p,q]=tSample(a,b,true);if(p!==q)return[p>q?a:b,1];}return[Math.random()<.5?a:b,2];}
function tGroupStage(G){
  const res={};for(const[g,teams]of G){const st=teams.map(t=>({t,pts:0,gd:0,gf:0,h2h:{}}));
    for(let i=0;i<4;i++)for(let j=i+1;j<4;j++){const[x,y]=tSample(st[i].t,st[j].t,false);const A=st[i],B=st[j];A.gf+=x;B.gf+=y;A.gd+=x-y;B.gd+=y-x;const pa=x>y?3:x===y?1:0,pb=x<y?3:x===y?1:0;A.pts+=pa;B.pts+=pb;A.h2h[B.t.ab]=pa;B.h2h[A.t.ab]=pb;}
    st.forEach(s=>s.r=Math.random());
    // desempate: puntos, diferencia de goles, goles a favor, puntos entre empatados, sorteo
    st.sort((a,b)=>b.pts-a.pts||b.gd-a.gd||b.gf-a.gf||((b.h2h[a.t.ab]||0)-(a.h2h[b.t.ab]||0))||b.r-a.r);res[g]=st;}
  return res;
}
// Dieciseisavos del Mundial 2026 (partidos 73–88) y caminos de octavos en adelante
const R32=[['2A','2B'],['1E','3ABCDF'],['1F','2C'],['1C','2F'],['1I','3CDFGH'],['2E','2I'],['1A','3CEFHI'],['1L','3EHIJK'],['1D','3BEFIJ'],['1G','3AEHIJ'],['2K','2L'],['1H','2J'],['1B','3EFGIJ'],['1J','2H'],['1K','3DEIJL'],['2D','2G']];
// Orden: 89,90,93,94,91,92,95,96 para que cuartos (97–100) y semifinales (101–102) sigan el cuadro oficial
const R16=[[1,4],[0,2],[10,11],[8,9],[3,5],[6,7],[13,15],[12,14]];
function assignThirds(thirds){ // thirds: grupos (letras) de los 8 mejores terceros; asigna cada uno a un cruce permitido
  const slots=R32.map((m,i)=>m[1][0]==='3'?[i,m[1].slice(1)]:null).filter(Boolean),out={},used=new Set();
  const bt=k=>{if(k===slots.length)return true;const[i,allow]=slots[k];for(const g of thirds){if(!used.has(g)&&allow.includes(g)){used.add(g);out[i]=g;if(bt(k+1))return true;used.delete(g);}}return false;};
  if(!bt(0)){used.clear();slots.forEach(([i],k)=>out[i]=thirds[k]);}return out;
}
function simTournament(n){
  const G=tGroups();if(!G)return null;const stats={},adv=TOURN[TSEL],noET=!!adv.noET;
  for(const[,ts]of G)for(const t of ts)stats[t.ab]={t,first:0,second:0,out:0,r32:0,r16:0,qf:0,sf:0,fin:0,win:0,pen:0};
  const fmt=TOURN[TSEL].fmt==='48'?'48':G.length;
  for(let s=0;s<n;s++){
    const gs=tGroupStage(G);for(const g in gs){stats[gs[g][0].t.ab].first++;stats[gs[g][1].t.ab].second++;}
    let ko;
    if(fmt==='48'){const pos={};for(const g in gs){pos['1'+g]=gs[g][0].t;pos['2'+g]=gs[g][1].t;}
      const th=Object.entries(gs).map(([g,st])=>({g,s:st[2]})).sort((a,b)=>b.s.pts-a.s.pts||b.s.gd-a.s.gd||b.s.gf-a.s.gf||b.s.r-a.s.r).slice(0,8);
      const asg=assignThirds(th.map(x=>x.g));
      const r32=R32.map((m,i)=>[pos[m[0]],m[1][0]==='3'?gs[asg[i]][2].t:pos[m[1]]]);
      r32.flat().forEach(t=>stats[t.ab].r32++);
      const w32=r32.map(([a,b])=>{const[w,how]=tKO(a,b,false);if(how===2)stats[w.ab].pen++;return w;});
      ko=R16.map(([i,j])=>[w32[i],w32[j]]);ko.flat().forEach(t=>stats[t.ab].r16++);
    }else{const ng=G.length,L=G.map(([g])=>g);
      if(ng===8){ko=[[0,1],[2,3],[4,5],[6,7],[1,0],[3,2],[5,4],[7,6]].map(([a,b])=>[gs[L[a]][0].t,gs[L[b]][1].t]);ko.flat().forEach(t=>stats[t.ab].r16++);}
      else if(ng===4)ko=[[0,1],[1,0],[2,3],[3,2]].map(([a,b])=>[gs[L[a]][0].t,gs[L[b]][1].t]);
      else ko=[[gs[L[0]][0].t,gs[L[1]][1].t],[gs[L[1]][0].t,gs[L[0]][1].t]];}
    let round=ko;const stage=['qf','sf','fin'];
    // octavos (si existen) -> cuartos -> semis -> final
    if(round.length===8){const w=round.map(([a,b])=>{const[x,how]=tKO(a,b,noET);if(how===2)stats[x.ab].pen++;return x;});round=[[w[0],w[1]],[w[2],w[3]],[w[4],w[5]],[w[6],w[7]]];}
    if(round.length===4){round.flat().forEach(t=>stats[t.ab].qf++);const w=round.map(([a,b])=>{const[x,how]=tKO(a,b,noET);if(how===2)stats[x.ab].pen++;return x;});round=[[w[0],w[1]],[w[2],w[3]]];}
    if(round.length===2){round.flat().forEach(t=>stats[t.ab].sf++);const w=round.map(([a,b])=>{const[x,how]=tKO(a,b,noET);if(how===2)stats[x.ab].pen++;return x;});round=[[w[0],w[1]]];}
    round.flat().forEach(t=>stats[t.ab].fin++);const[ch,how]=tKO(round[0][0],round[0][1],false);if(how===2)stats[ch.ab].pen++;stats[ch.ab].win++;
  }
  return{G,stats,n,fmt};
}
function renderTourney(){
  const el=$('tourBox');if(!el)return;
  const T=TOURN[TSEL]||LIVE_T[TSEL],isLive=!!LIVE_T[TSEL];
  let s=`<div class="lbl" style="margin-bottom:8px">● En curso</div><div class="leagues">${Object.entries(LIVE_T).map(([k,v])=>`<button class="lg ${TSEL===k?'on':''}" data-t="${k}">${esc(v.name)}</button>`).join('')}</div><div class="lbl" style="margin:4px 0 8px">Escenarios hipotéticos</div><div class="leagues">${Object.entries(TOURN).map(([k,v])=>`<button class="lg ${TSEL===k?'on':''}" data-t="${k}">${esc(v.name)}</button>`).join('')}</div>
   <div class="row2" style="margin:0 0 12px">${TSEL==='wc26'?`<label class="chk"><input type="checkbox" id="tHost" ${THOST?'checked':''}> Ventaja de local para los anfitriones (México, EE. UU., Canadá)</label>`:TSEL==='cnl'?`<label class="chk"><input type="checkbox" id="tHost" ${THOST?'checked':''}> Ventaja de local para EE. UU. en las Finales (SoFi Stadium)</label>`:''}
   <span>Simulaciones:</span><select id="tN"><option value="2000">2,000</option><option value="10000" ${TN===10000?'selected':''}>10,000</option><option value="25000" ${TN===25000?'selected':''}>25,000</option></select>
   <button class="cta" id="tGo" style="padding:11px 20px;font-size:14px">Simular torneo</button></div><p class="note" style="margin:0 0 12px">${esc(T.note)}</p>`;
  if(TSEL==='cu'){const all=DATA.nat.nat.teams;s+=`<div class="tcust"><div class="tchips">${TCUST.map(ab=>{const t=natTeam(ab);return`<span class="tchip">${flag(t.iso)} ${esc(t.n)} <button data-rm="${ab}">×</button></span>`;}).join('')||'<span class="note">Aún no eliges selecciones.</span>'}</div>
     <div class="row2"><select id="tAdd"><option value="">+ Agregar selección…</option>${all.filter(t=>!TCUST.includes(t.ab)).map(t=>`<option value="${t.ab}">${t.n} (${t.elo})</option>`).join('')}</select>
     <button class="btn sm" data-fill="8">Top 8 por Elo</button><button class="btn sm" data-fill="16">Top 16</button><button class="btn sm" data-fill="32">Top 32</button><button class="btn sm" data-fill="0">Vaciar</button>
     <span class="note" style="margin:0">${TCUST.length} elegidas · se necesitan 8, 16 o 32</span></div></div>`;}
  s+=`<div id="tOut"><p class="note">Toca <b>Simular torneo</b> para calcular las probabilidades de cada selección.</p></div>`;
  el.innerHTML=s;
  el.querySelectorAll('[data-t]').forEach(b=>b.onclick=()=>{TSEL=b.dataset.t;TEDIT={};renderTourney();});
  if($('tHost'))$('tHost').onchange=e=>{THOST=e.target.checked;};
  $('tN').onchange=e=>{TN=+e.target.value;};
  if(TSEL==='cu'){$('tAdd').onchange=e=>{if(e.target.value)TCUST.push(e.target.value);renderTourney();};
    el.querySelectorAll('[data-rm]').forEach(b=>b.onclick=()=>{TCUST=TCUST.filter(x=>x!==b.dataset.rm);renderTourney();});
    el.querySelectorAll('[data-fill]').forEach(b=>b.onclick=()=>{TCUST=DATA.nat.nat.teams.slice(0,+b.dataset.fill).map(t=>t.ab);renderTourney();});}
  $('tGo').onclick=()=>{const b=$('tGo');b.disabled=true;b.textContent='Simulando…';setTimeout(()=>{const t0=performance.now();if(isLive){const r=simLive(LIVE_T[TSEL].kind,TN);b.disabled=false;b.textContent='Simular torneo';renderLiveOut(r,performance.now()-t0);return;}const r=simTournament(TN);b.disabled=false;b.textContent='Simular torneo';
    if(!r){$('tOut').innerHTML='<p class="note">Elige 8, 16 o 32 selecciones para formar grupos de 4.</p>';return;}renderTourOut(r,performance.now()-t0);},30);};
}
function renderTourOut(r,ms){
  const n=r.n,P=v=>pct(v/n,v/n>=.1?0:1),list=Object.values(r.stats).sort((a,b)=>b.win-a.win||b.fin-a.fin);
  const cols=r.fmt==='48'?[['r32','16avos'],['r16','Octavos'],['qf','Cuartos'],['sf','Semis'],['fin','Final'],['win','Campeón']]:r.fmt===8?[['r16','Octavos'],['qf','Cuartos'],['sf','Semis'],['fin','Final'],['win','Campeón']]:r.fmt===4?[['qf','Cuartos'],['sf','Semis'],['fin','Final'],['win','Campeón']]:[['sf','Semis'],['fin','Final'],['win','Campeón']];
  let s=`<div class="sub2">${fmt(n)} torneos simulados en ${(ms/1000).toFixed(1)} s</div><div class="champ">${list.slice(0,6).map((x,i)=>`<div class="chc ${i===0?'top':''}"><span class="flag" style="font-size:28px">${flag(x.t.iso)}</span><b>${esc(x.t.n)}</b><span class="num cp">${P(x.win)}</span><small>campeón</small></div>`).join('')}</div>`;
  s+=`<div style="overflow-x:auto"><table class="ftab tt"><thead><tr><th>Selección</th><th class="n">Elo</th>${cols.map(c=>`<th class="n">${c[1]}</th>`).join('')}<th class="n" title="Partidos de eliminación ganados en penales por simulación">Penales*</th></tr></thead><tbody>${list.map(x=>`<tr><td>${flag(x.t.iso)} ${esc(x.t.n)}</td><td class="n num"><input class="elo" data-ab="${x.t.ab}" value="${tEloOf(x.t)}" title="Cambia el Elo para probar un escenario"></td>${cols.map(([k])=>`<td class="n num" style="background:rgba(0,230,168,${(x[k]/n*.55).toFixed(2)})">${P(x[k])}</td>`).join('')}<td class="n num">${(x.pen/n).toFixed(2)}</td></tr>`).join('')}</tbody></table></div>
   <p class="note">Probabilidades de llegar a cada ronda. Los resultados a 90 minutos se distinguen de las eliminatorias decididas en prórroga o penales: *promedio de eliminatorias que cada selección gana en penales por torneo. Cambia el Elo de cualquier selección (escenario hipotético) y vuelve a simular. Desempate en grupos: puntos, diferencia de goles, goles a favor, resultado entre ellos y sorteo; algunos torneos usan otro orden.</p>`;
  s+=`<h3 class="t" style="margin-top:18px">Grupos <small>probabilidad de terminar 1º y 2º</small></h3><div class="tgroups">${r.G.map(([g,ts])=>`<div class="tg"><b>Grupo ${g}</b>${ts.map(t=>{const x=r.stats[t.ab];return`<div class="tgr"><span>${flag(t.iso)} ${esc(t.n)}</span><span class="num">${P(x.first)} · ${P(x.second)}</span></div>`;}).join('')}</div>`).join('')}</div>`;
  $('tOut').innerHTML=s;
  $('tOut').querySelectorAll('.elo').forEach(inp=>inp.onchange=()=>{const v=parseInt(inp.value);if(!isNaN(v)){TEDIT[inp.dataset.ab]=v;toast('Elo modificado: vuelve a simular el torneo');}});
}

/* ---------- Comparador de cuotas (The Odds API, en prueba) ---------- */
let ODDS=null,OLG='Todas',OONLY=false,OMAX=10;
const BOOKN={pinnacle:'Pinnacle',onexbet:'1xBet',unibet_se:'Unibet',unibet_fr:'Unibet FR',unibet_nl:'Unibet NL',williamhill:'William Hill',sport888:'888sport',winamax_fr:'Winamax',winamax_de:'Winamax',pmu_fr:'PMU',marathonbet:'Marathonbet',betclic_fr:'Betclic',betsson:'Betsson',nordicbet:'NordicBet',mybookieag:'MyBookie',everygame:'Everygame',codere_it:'Codere',coolbet:'Coolbet',betonlineag:'BetOnline',gtbets:'GTbets',betanysports:'BetAnySports',tipico_de:'Tipico',leovegas_se:'LeoVegas'};
function renderOdds(){const el=$('oddsBox');if(!el)return;
  if(!ODDS){fetch('odds.json').then(r=>r.json()).then(j=>{ODDS=j;renderOdds();}).catch(()=>{el.innerHTML='<p class="note">Sin cuotas cargadas todavía.</p>';});return;}
  const now=Date.now(),ev=ODDS.events.filter(e=>new Date(e.t).getTime()>now-2*3600e3),lgs=['Todas',...new Set(ev.map(e=>e.lg))];
  const lab=(e,i)=>e.labels[i]==='Draw'?'Empate':e.labels[i];
  let list=ev.filter(e=>OLG==='Todas'||e.lg===OLG);
  if(OONLY)list=list.filter(e=>e.best.some((b,i)=>b&&b.edge>.02&&b.odd<=6));
  const d=new Date(ODDS.taken);
  el.innerHTML=`<p class="note" style="margin-top:0">Línea de referencia: <b>Pinnacle sin margen</b>, la casa con fama de ser la más precisa. Para cada resultado mostramos la mejor cuota entre 25 casas y cuánto paga de más o de menos frente a esa referencia. Cuotas tomadas el ${d.toLocaleString('es-MX',{dateStyle:'medium',timeStyle:'short'})} (${esc(ODDS.src)}). Las cuotas cambian a cada rato: confírmalas en tu casa antes de apostar.</p>
  <div class="leagues">${lgs.map(l=>`<button class="lg ${OLG===l?'on':''}" data-ol="${esc(l)}">${esc(l)}</button>`).join('')}</div>
  <label class="chk"><input type="checkbox" id="oOnly" ${OONLY?'checked':''}> Solo partidos donde alguna casa paga más de 2% sobre la referencia (cuotas de hasta 6.0)</label>
  <div style="overflow-x:auto;margin-top:10px"><table class="ftab"><thead><tr><th>Partido</th><th>Resultado</th><th class="n">Prob. referencia</th><th class="n">Cuota justa</th><th class="n">Mejor cuota</th><th>Casa</th><th class="n">Diferencia</th></tr></thead><tbody>${list.slice(0,OMAX).map(e=>e.labels.map((x,i)=>{const b=e.best[i];const c=!b?'':b.edge>.02?'var(--menta)':b.edge<-.02?'#FF7A00':'var(--t2)';return`<tr${i===0?' style="border-top:2px solid var(--grafito)"':''}><td>${i===0?`<b>${esc(e.h)} vs ${esc(e.a)}</b><div class="fn">${esc(e.lg)} · ${new Date(e.t).toLocaleString('es-MX',{weekday:'short',day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'})}</div>`:''}</td><td>${esc(lab(e,i))}</td><td class="n num">${pct(e.p[i],0)}</td><td class="n num">${(1/e.p[i]).toFixed(2)}</td><td class="n num">${b?b.odd.toFixed(2):'—'}</td><td>${b?esc(BOOKN[b.book]||b.book):''}</td><td class="n num" style="color:${c}">${b?(b.edge>0?'+':'')+(b.edge*100).toFixed(1)+'%':''}</td></tr>`;}).join('')).join('')}</tbody></table></div>${list.length>OMAX?`<button class="btn sm" id="oMore" style="margin-top:10px">Ver más partidos (${list.length-OMAX})</button>`:''}
  ${ODDS.track?`<div class="advb" style="margin:12px 0"><span>Señales registradas: <b>${ODDS.track.n_signals}</b></span><span>Ya con cuota de cierre: <b>${ODDS.track.n_closed}</b></span><span>Ventaja promedio vs cierre (CLV): <b style="color:${ODDS.track.clv>0?'var(--menta)':ODDS.track.clv<0?'#FF7A00':'inherit'}">${ODDS.track.clv==null?'aún sin datos':(ODDS.track.clv>0?'+':'')+(ODDS.track.clv*100).toFixed(1)+'%'}</b></span></div>`:''}
  <p class="note"><b>Importante:</b> que una casa pague más que la referencia no garantiza ganar. En nuestra prueba con datos históricos, esta técnica no ganó dinero (aquellas cuotas no eran del mismo minuto). Por eso este comparador está <b>en prueba</b>: guardamos cada diferencia y en unas semanas publicaremos si de verdad le gana a la cuota de cierre. Las diferencias grandes en cuotas muy altas suelen ser errores o líneas viejas.</p>`;
  el.querySelectorAll('[data-ol]').forEach(b=>b.onclick=()=>{OLG=b.dataset.ol;OMAX=10;renderOdds();});if($('oMore'))$('oMore').onclick=()=>{OMAX+=15;renderOdds();};$('oOnly').onchange=e=>{OONLY=e.target.checked;renderOdds();};
}

/* ---------- Alineaciones y bajas (365Scores vía Apify) ---------- */
let LU=null,LULG='Todas';
function renderLineups(){const el=$('luBox');if(!el)return;
  if(!LU){fetch('lineups.json').then(r=>r.json()).then(j=>{LU=j;renderLineups();}).catch(()=>{el.innerHTML='';});return;}
  const now=Date.now(),gs=LU.games.filter(g=>new Date(g.t).getTime()>now-2*3600e3).sort((a,b)=>a.t<b.t?-1:1),lgs=['Todas',...new Set(gs.map(g=>g.lg))],list=gs.filter(g=>LULG==='Todas'||g.lg===LULG);
  const pill=s=>s==='Confirmed'?'<span class="pill good">Confirmada</span>':'<span class="pill bad">Probable</span>';
  const bj=s=>`${s.miss?`<b style="color:#FF7A00">${s.miss} baja${s.miss>1?'s':''}</b>`:'Sin bajas'}${s.doubt?` · ${s.doubt} duda${s.doubt>1?'s':''}`:''}`;
  el.innerHTML=`<h3 class="t" style="margin-top:0">Alineaciones y bajas</h3><p class="note" style="margin-top:4px">Alineación probable o confirmada, lesionados y dudas de los próximos 4 días. Calificación = promedio del 11 inicial (escala 0–10). Fuente: 365Scores. Actualizado ${new Date(LU.taken).toLocaleString('es-MX',{dateStyle:'medium',timeStyle:'short'})}.</p>
  <div class="leagues">${lgs.map(l=>`<button class="lg ${LULG===l?'on':''}" data-lu="${esc(l)}">${esc(l)}</button>`).join('')}</div>
  <div style="overflow-x:auto"><table class="ftab"><thead><tr><th>Partido</th><th>Local</th><th>Visitante</th></tr></thead><tbody>${list.map(g=>`<tr><td><b>${esc(g.h.n)} vs ${esc(g.a.n)}</b><div class="fn">${esc(g.lg)} · ${new Date(g.t).toLocaleString('es-MX',{weekday:'short',day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'})}</div></td>${[g.h,g.a].map(s=>`<td>${pill(s.st)} <span class="fn">${esc(s.fm||'')}${s.xi?' · calif. '+s.xi.toFixed(1):''}</span><div>${bj(s)}</div></td>`).join('')}</tr>`).join('')}</tbody></table></div>
  <p class="note">Las bajas ya suelen estar reflejadas en las cuotas de las casas, y nuestro pronóstico final pesa 75% mercado. Por eso aquí son información para ti: el modelo no las ajusta solo.</p>`;
  el.querySelectorAll('[data-lu]').forEach(b=>b.onclick=()=>{LULG=b.dataset.lu;renderLineups();});}
