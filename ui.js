/* ============ REDISEÑO: navegación inferior, Inicio directo, Hoy compacto y ficha tipo hoja ============ */
(function(){
const DAYN=['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'];
const rc=p=>p>=.75?'g':p>=.6?'m':'h';
const RISK={g:'Riesgo bajo',m:'Riesgo medio',h:'Riesgo alto'};
const SPI={fut:'⚽',nba:'🏀',nfl:'🏈'};
function ring(p,sz){sz=sz||58;const r=(sz-9)/2,c=2*Math.PI*r,h=sz/2;
  return `<svg class="ring ${rc(p)}" width="${sz}" height="${sz}" viewBox="0 0 ${sz} ${sz}" aria-label="${Math.round(p*100)}%"><circle cx="${h}" cy="${h}" r="${r}" class="rb"/><circle cx="${h}" cy="${h}" r="${r}" class="rf" stroke-dasharray="${(c*p).toFixed(1)} ${c.toFixed(1)}" transform="rotate(-90 ${h} ${h})"/><text x="50%" y="50%" dy=".36em" text-anchor="middle">${Math.round(p*100)}%</text></svg>`;}
const tm=t=>{const d=new Date(t);let h=d.getHours(),m=String(d.getMinutes()).padStart(2,'0');const ap=h>=12?'pm':'am';h=h%12||12;return `${h}:${m}<small>${ap}</small>`;};
const pill=p=>`<span class="pill ${rc(p)}">${Math.round(p*100)}%</span>`;
const firstDay=()=>{for(let o=0;o<7;o++)if(TD.events.some(e=>inDay(e,o)&&!e.pending))return o;return 0;};
function bestOf(list){const x=list.filter(e=>!e.pending&&e.key).sort((a,b)=>b.key.p-a.key.p);return x[0]||null;}
function pickCard(e,title){if(!e)return'';const k=e.key;
  return `<div class="bpk ${rc(k.p)}"><div class="bpk-t">${title} · ${RISK[rc(k.p)].toLowerCase()}</div>
   <div class="bpk-b"><div class="bpk-x"><div class="bpk-k">${esc(k.k)}</div><div class="bpk-m">${SPI[e.sp]||''} ${esc(e.h)} vs ${esc(e.a)} · ${hhmm(e.t)}</div>${window.VIVO?`<div class="bpk-w">💡 ${esc(VIVO.why(e,k))}</div>`:''}
   <div class="bpk-a"><button class="nb" data-fi="${e.id}">Ver ficha</button><button class="nb pri" data-padd="${e.id}">+ Parlay</button></div></div>${ring(k.p,64)}</div></div>`;}
function bind(el){
  el.querySelectorAll('[data-fi]').forEach(b=>b.onclick=ev=>{ev.stopPropagation();openFicha(b.dataset.fi);});
  el.querySelectorAll('[data-padd]').forEach(b=>b.onclick=ev=>{ev.stopPropagation();const e=TD.events.find(x=>x.id===b.dataset.padd);if(e&&e.key)addLeg(e,e.key);});
}

/* ---------- HOY ---------- */
window.renderHoy=function(){const el=$('hoyBox');if(!el)return;loadToday(()=>{
  if(HDAY>6)HDAY=firstDay();
  const cnt=o=>TD.events.filter(e=>inDay(e,o)&&(HSP==='all'||e.sp===HSP)).length;
  const days=[...Array(7)].map((_,o)=>{const d=new Date(dayStart(o));return{o,l:o===0?'Hoy':o===1?'Mañana':DAYN[d.getDay()],n:d.getDate(),c:cnt(o)};});
  const dayEv=TD.events.filter(e=>inDay(e,HDAY));
  const list=dayEv.filter(e=>HSP==='all'||e.sp===HSP).sort((a,b)=>a.t<b.t?-1:1);
  const sc=s=>dayEv.filter(e=>s==='all'||e.sp===s).length;
  const groups=[];const gi={};list.forEach(e=>{if(!(e.lg in gi)){gi[e.lg]=groups.length;groups.push({lg:e.lg,sp:e.sp,xs:[]});}groups[gi[e.lg]].xs.push(e);});
  const best=bestOf(list);
  const h2=document.querySelector('#hoy h2');if(h2){const dd=days[HDAY];h2.innerHTML=HDAY===0?'Partidos de <em>hoy</em>':HDAY===1?'Partidos de <em>mañana</em>':`Partidos del <em>${dd.l.toLowerCase()} ${dd.n}</em>`;}
  const V=window.VIVO;
  const tcell=e=>{const s=V&&V.rowState(e);if(s&&s.st==='in')return`<span class="mt live"><i class="ldot"></i>${esc((s.det||'').replace('Halftime','Medio t.').replace('End of ','Fin ').replace(' - ',' '))}</span>`;if(s&&s.st==='post')return`<span class="mt fin">Final</span>`;return`<span class="mt">${tm(e.t)}</span>`;};
  const tn=(e,side)=>{const n=side?e.a:e.h,s=V&&V.rowState(e);return`<b>${V?V.badge(n):''}<span class="tn">${esc(n)}</span>${s&&s.st!=='pre'?`<em class="sc ${s.st}">${side?s.as:s.hs}</em>`:''}</b>`;};
  const mark=e=>{const s=V&&V.rowState(e);if(!s||s.st!=='post'||!e.key)return'';const g=V.grade(e.key.k,e.h,e.a,s.hs,s.as,s);return g==='win'?'<span class="gmk w">✓</span>':g==='loss'?'<span class="gmk l">✗</span>':g==='push'?'<span class="gmk p">=</span>':'';};
  const row=e=>e.pending?`<div class="mrow pend">${tcell(e)}<span class="mteams">${tn(e,0)}${tn(e,1)}</span><span class="mk"><span class="mkk muted">Sin cuotas aún</span></span></div>`
    :`<div class="mrow ${(V&&V.rowState(e)||{}).st==='in'?'is-live':''}" data-fi="${e.id}" role="button" tabindex="0">${tcell(e)}<span class="mteams">${tn(e,0)}${tn(e,1)}</span><span class="mk"><span class="mkk">${esc(e.key.k)}</span><span>${mark(e)}${pill(e.key.p)}</span></span><button class="madd" data-padd="${e.id}" aria-label="Agregar al parlay">+</button></div>`;
  el.innerHTML=`<div class="dstrip">${days.map(d=>`<button class="dchip ${HDAY===d.o?'on':''} ${d.c?'':'empty'}" data-hd="${d.o}"><span>${d.l}</span><b>${d.n}</b>${d.c?`<i>${d.c}</i>`:''}</button>`).join('')}</div>
   <div class="schips">${[['all','Todo'],['fut','⚽ Fútbol'],['nba','🏀 NBA'],['nfl','🏈 NFL']].map(([k,l])=>`<button class="schip ${HSP===k?'on':''}" data-hs="${k}">${l}<i>${sc(k)}</i></button>`).join('')}</div>
   ${best?pickCard(best,HDAY===0?'Pick del día':'Pick más probable'):''}
   ${groups.length?groups.map(g=>`<div class="lgh">${SPI[g.sp]||''} ${esc(g.lg)}<span>${g.xs.length}</span></div><div class="mlist">${g.xs.map(row).join('')}</div>`).join('')
     :`<div class="empty-st"><b>Sin partidos este día</b><span>Prueba otro día en la tira de arriba.</span></div>`}
   <div class="legend"><span><i class="dot g"></i>Riesgo bajo 75%+</span><span><i class="dot m"></i>Medio 60–75%</span><span><i class="dot h"></i>Alto</span></div>
   <p class="note small">Toca un partido para ver todos sus números. Probabilidades con cuotas de Pinnacle sin comisión, actualizadas el ${new Date(TD.taken).toLocaleString('es-MX',{dateStyle:'medium',timeStyle:'short'})}. Ninguna jugada es segura.</p>`;
  el.querySelectorAll('[data-hs]').forEach(b=>b.onclick=()=>{HSP=b.dataset.hs;renderHoy();});
  el.querySelectorAll('[data-hd]').forEach(b=>b.onclick=()=>{HDAY=+b.dataset.hd;renderHoy();const on=el.querySelector('.dchip.on');if(on)on.scrollIntoView({inline:'center',block:'nearest'});});
  el.querySelectorAll('.mrow[data-fi]').forEach(r=>r.onkeydown=ev=>{if(ev.key==='Enter')openFicha(r.dataset.fi);});
  bind(el);
  if(window.VIVO){VIVO.ensure(list).then(ch=>{if(ch&&document.body.dataset.view==='hoy')renderHoy();});VIVO.startPoll(()=>renderHoy());}
});};

/* ---------- INICIO directo ---------- */
function parlayOfDay(){const evs=TD.events.filter(e=>inDay(e,firstDay())&&!e.pending&&e.m);const pool=[];
  for(const e of evs){const c=e.m.filter(x=>x.p>=.72&&x.p<=.9&&x.fam!=='dnb').sort((a,b)=>b.p-a.p);if(c.length)pool.push({e,x:c.find(x=>x.k===e.key.k)||c[0]});}
  pool.sort((a,b)=>b.x.p-a.x.p);return pool.slice(0,3);}
function renderHome(){const el=$('homeBox');if(!el)return;loadToday(()=>{
  const go=()=>{const o=firstDay();const today=TD.events.filter(e=>inDay(e,o)&&!e.pending);const best=bestOf(today);const legs=parlayOfDay();
    const pr=legs.reduce((a,l)=>a*l.x.p,1);const d=new Date();
    el.innerHTML=`<div class="home-h"><div><span class="kick">${d.toLocaleDateString('es-MX',{weekday:'long',day:'numeric',month:'long'})}</span><h1>Tu día en <em>10 segundos</em></h1></div></div>
     ${typeof weekBox==='function'?weekBox():''}
     ${pickCard(best,o===0?'Pick del día':'Próximo pick')}
     ${legs.length===3?`<div class="pod"><div class="bpk-t">Parlay seguro del día</div>${legs.map(l=>`<div class="podl"><span>${esc(l.x.k)}<small>${esc(l.e.h)} vs ${esc(l.e.a)}</small></span>${pill(l.x.p)}</div>`).join('')}
       <div class="podf"><span>Probabilidad <b>${Math.round(pr*100)}%</b> · cuota justa ${(1/pr).toFixed(2)}</span><button class="nb pri" id="podGo">Armarlo</button></div></div>`:''}
     <button class="bigcta" id="homeHoy">Ver los ${today.length} partidos ${o===0?'de hoy':'próximos'} <span>›</span></button>`;
    bind(el);
    if($('homeHoy'))$('homeHoy').onclick=()=>{HDAY=o;showView('hoy');renderHoy();};
    if($('podGo'))$('podGo').onclick=()=>{PAR=[];legs.forEach(l=>PAR.push({e:l.e,x:l.x}));showView('parlays');renderParlay();};
  };
  if(typeof JK!=='undefined'&&!JK)fetch('sys/picks.json',{cache:'no-store'}).then(r=>r.json()).then(j=>{if(!JK)JK=j;go();}).catch(go);else go();
});}
window.renderHome=renderHome;

/* ---------- Navegación inferior + "Más" ---------- */
const IC={hoy:'<path d="M4 7h16v13H4zM4 11h16M9 3v4M15 3v4"/>',parlays:'<path d="M12 3l9 5-9 5-9-5zM3 13l9 5 9-5"/>',simulador:'<path d="M7 4v16l13-8z"/>',record:'<path d="M5 20V10M12 20V4M19 20v-7"/>',mas:'<circle cx="5" cy="12" r="1.4"/><circle cx="12" cy="12" r="1.4"/><circle cx="19" cy="12" r="1.4"/>'};
const TABS=[['hoy','Hoy'],['parlays','Parlays'],['simulador','Simular'],['record','Récord'],['mas','Más']];
const svg=k=>`<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${IC[k]}</svg>`;
const nav=document.createElement('nav');nav.id='tabbar';nav.innerHTML=TABS.map(([k,l])=>`<button data-tab="${k}">${svg(k)}<span>${l}</span></button>`).join('');
document.body.appendChild(nav);
const sh=document.createElement('div');sh.id='masSheet';sh.className='modal';
sh.innerHTML=`<div class="mbox sheet"><div class="grab"></div><div class="maslist">${[['inicio','🏠','Inicio','Tu resumen del día'],['torneos','🏆','Torneos','Nations League, Liguilla y más'],['cuotas','💱','Cuotas','Compara casas de apuestas'],['mispicks','⭐','Mis picks','Tus jugadas guardadas'],['faq','❓','Preguntas','Cómo funciona el modelo']].map(([v,i,t,s])=>`<button data-mv="${v}"><span class="mi">${i}</span><span><b>${t}</b><small>${s}</small></span><span class="chev">›</span></button>`).join('')}</div></div>`;
document.body.appendChild(sh);
const closeMas=()=>sh.classList.remove('on');
sh.addEventListener('click',e=>{if(e.target===sh)closeMas();});
sh.querySelectorAll('[data-mv]').forEach(b=>b.onclick=()=>{closeMas();showView(b.dataset.mv);});
nav.querySelectorAll('[data-tab]').forEach(b=>b.onclick=()=>{const t=b.dataset.tab;if(t==='mas'){sh.classList.add('on');return;}showView(t);});
const MORE=['inicio','torneos','cuotas','mispicks','faq'];
function sync(v){nav.querySelectorAll('[data-tab]').forEach(b=>b.classList.toggle('on',b.dataset.tab===v||(b.dataset.tab==='mas'&&MORE.includes(v)&&v!=='inicio')));}
const _sv=window.showView;window.showView=function(v,o){_sv(v,o);sync(document.body.dataset.view);if(document.body.dataset.view==='inicio')renderHome();};
sync(document.body.dataset.view);


/* ---------- Boleto flotante del parlay ---------- */
const tkt=document.createElement('button');tkt.id='ticket';tkt.type='button';document.body.appendChild(tkt);
let lastN=0;
function updTicket(){const n=(typeof PAR!=='undefined'&&PAR)?PAR.length:0,v=document.body.dataset.view;
  if(!n||v==='parlays'){tkt.classList.remove('on');lastN=n;return;}
  const p=PAR.reduce((a,l)=>a*l.x.p,1),f=1/p;
  tkt.innerHTML=`<span class="tk-i">🎟️</span><span class="tk-t"><b>${n} pierna${n>1?'s':''}</b><small>${(p*100).toFixed(p<.1?1:0)}% de que salga · cuota justa ${f<1000?f.toFixed(2):Math.round(f)}</small></span><span class="tk-go">Ver ›</span>`;
  tkt.classList.add('on');if(n!==lastN){tkt.classList.remove('bump');void tkt.offsetWidth;tkt.classList.add('bump');if(n>lastN&&navigator.vibrate)try{navigator.vibrate(12);}catch(_){}}lastN=n;}
tkt.onclick=()=>showView('parlays');
if(typeof renderParlay==='function'){const _rp=window.renderParlay;window.renderParlay=function(){const r=_rp.apply(this,arguments);setTimeout(updTicket,0);return r;};}
const _sv2=window.showView;window.showView=function(v,o){_sv2(v,o);updTicket();};
/* ---------- Inicio: bloque nuevo arriba de todo ---------- */
const first=document.getElementById('confianza');
if(first){const h=document.createElement('div');h.id='homeBox';h.className='homebox';h.dataset.v='inicio';h.style.display=document.body.dataset.view==='inicio'?'':'none';first.parentNode.insertBefore(h,first);}
document.addEventListener('DOMContentLoaded',()=>{if(document.body.dataset.view==='inicio')setTimeout(renderHome,400);});
if(document.readyState!=='loading'&&document.body.dataset.view==='inicio')setTimeout(renderHome,400);
/* Ficha: cerrar deslizando hacia abajo en celular */
['fichaModal','shModal','masSheet'].forEach(id=>{const m=document.getElementById(id);if(!m)return;let y0=null;
  m.addEventListener('touchstart',e=>{const b=m.querySelector('.mbox');if(b&&b.scrollTop<=0)y0=e.touches[0].clientY;},{passive:true});
  m.addEventListener('touchend',e=>{if(y0!==null&&e.changedTouches[0].clientY-y0>110)m.classList.remove('on');y0=null;},{passive:true});});
})();
