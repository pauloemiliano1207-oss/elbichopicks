/* =====================================================================
   El Bicho Picks · App (datos, modelo, interfaz)
   ===================================================================== */
let NATCONF='Todas',NATQ='';
let DATA=null,SPORT='fut',LEAGUE='epl',INTL=false,LAST=null,FIXTURE=null;
const S={H:{lg:'epl',i:0,ctx:{},adj:0},A:{lg:'epl',i:1,ctx:{},adj:0}};
const LG_ORDER=['epl','laliga','seriea','bund','ligue1','ligamx'];
const CTX={fut:[['cans','Cansancio (jugó hace ≤3 días)'],['bajas','Bajas importantes'],['motiv','Partido decisivo']],
  nba:[['b2b','Back-to-back'],['star','Estrella lesionada'],['rest','Descanso extra']],
  nfl:[['bye','Viene de bye'],['qb','QB titular fuera'],['short','Semana corta']],
  nat:[]};
const $=id=>document.getElementById(id);
const esc=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const pct=(p,d=1)=>(p*100).toFixed(d)+'%';
const fmt=n=>Math.round(n).toLocaleString('es-MX');
const fair=p=>p>0.0005?(1/p).toFixed(2):'—';
const rnd=Math.random;
let spare=null;
function normal(){if(spare!==null){const s=spare;spare=null;return s;}let u=0;while(!u)u=rnd();const v=rnd(),r=Math.sqrt(-2*Math.log(u));spare=r*Math.sin(2*Math.PI*v);return r*Math.cos(2*Math.PI*v);}
function poisson(l){if(l<=0)return 0;const L=Math.exp(-l);let k=0,p=1;do{k++;p*=rnd();}while(p>L);return k-1;}
function toast(t){const e=$('toast');e.textContent=t;e.style.display='block';clearTimeout(toast.t);toast.t=setTimeout(()=>e.style.display='none',2200);}
const DAYS=['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'],MON=['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];
function fdate(s){const[d,h]=s.split(' ');const[y,m,dd]=d.split('-').map(Number);const dt=new Date(y,m-1,dd);return`${DAYS[dt.getDay()]} ${dd} ${MON[m-1]} · ${h}`;}
const short=n=>n.length>20?n.split(' ').slice(-1)[0]:n;
const tip=$('tip');
document.addEventListener('mousemove',e=>{const t=e.target.closest&&e.target.closest('[data-tip]');if(t){tip.textContent=t.dataset.tip;tip.style.display='block';tip.style.left=Math.min(e.clientX+12,innerWidth-tip.offsetWidth-8)+'px';tip.style.top=(e.clientY-36)+'px';}else if(!(e.target.id==='wpHit'))tip.style.display='none';});

/* ============ ESCUDOS (diseño propio con los colores del equipo) ============ */
function hash(s){let h=7;for(const c of s)h=(h*31+c.charCodeAt(0))|0;return Math.abs(h);}
function lumA(hex){const n=parseInt(hex.slice(1),16);return((n>>16&255)*.299+(n>>8&255)*.587+(n&255)*.114)/255;}
function cdist(a,b){const x=parseInt(a.slice(1),16),y=parseInt(b.slice(1),16);return Math.hypot((x>>16&255)-(y>>16&255),(x>>8&255)-(y>>8&255),(x&255)-(y&255));}
let CRN=0;
function crest(t,sz=40,sp=SPORT){
  const[c1,c2]=t.c||['#555555','#DDDDDD'],id='cr'+(CRN++),k=hash(t.n)%4;
  const shape=(sp==='fut'||sp==='nat')?'M50 4 L92 15 V47 C92 72 74 88 50 96 C26 88 8 72 8 47 V15 Z':sp==='nba'?'M50 4 A46 46 0 1 1 49.9 4 Z':'M50 4 L90 20 L90 67 L50 96 L10 67 L10 20 Z';
  const fill=k===0?`<rect width="100" height="100" fill="${c1}"/><rect y="70" width="100" height="30" fill="${c2}" opacity=".9"/>`
    :k===1?`<rect width="100" height="100" fill="${c1}"/><rect x="24" width="13" height="100" fill="${c2}"/><rect x="63" width="13" height="100" fill="${c2}"/>`
    :k===2?`<rect width="100" height="100" fill="${c1}"/><path d="M-10 78 L78 -10 L104 -10 L-10 104Z" fill="${c2}"/>`
    :`<rect width="50" height="100" fill="${c1}"/><rect x="50" width="50" height="100" fill="${c2}"/>`;
  const stroke=lumA(c2)<.14&&lumA(c1)<.3?'#9CA3AF':(cdist(c2,'#0B0B0B')<40?'#F4F4F4':c2);
  const ab=(t.ab||t.n.slice(0,3)).toUpperCase().slice(0,4),fs=ab.length>3?18:ab.length>2?22:26;
  return`<svg xmlns="http://www.w3.org/2000/svg" class="crest" viewBox="0 0 100 100" width="${sz}" height="${sz}" aria-label="${esc(t.n)}"><defs><clipPath id="${id}"><path d="${shape}"/></clipPath></defs><path d="${shape}" fill="none" stroke="rgba(0,0,0,.6)" stroke-width="10"/><g clip-path="url(#${id})">${fill}<rect y="37" width="100" height="27" fill="rgba(11,11,11,.84)"/></g><path d="${shape}" fill="none" stroke="${stroke}" stroke-width="5"/><text x="50" y="${50+fs*.36}" text-anchor="middle" font-family="Montserrat,sans-serif" font-weight="800" font-size="${fs}" fill="#F4F4F4" letter-spacing="-.5">${esc(ab)}</text></svg>`;
}
function kits(H,A){
  let h=[H.c[0],H.c[1]],a=[A.c[0],A.c[1]];
  if(cdist(h[0],a[0])<120)a=[A.c[1],A.c[0]];
  if(cdist(h[0],a[0])<120)a=[lumA(h[0])>.5?'#1c1c1c':'#F4F4F4',A.c[0]];
  for(const k of[h,a])if(cdist(k[0],k[1])<70)k[1]=lumA(k[0])>.5?'#111111':'#F4F4F4';
  return[h,a];
}

/* ============ SELECCIÓN ============ */
const team=s=>DATA[SPORT][S[s].lg].teams[S[s].i];
const lgOf=s=>DATA[SPORT][S[s].lg];
const curLeague=()=>SPORT==='fut'?LEAGUE:SPORT;
const MTYPE={amistoso:'Amistoso',elim:'Eliminatoria mundialista',grupo:'Torneo oficial · fase de grupos',ko:'Eliminación directa'};
function flag(iso){if(!iso)return'';const sub={'GB-ENG':'gbeng','GB-SCT':'gbsct','GB-WLS':'gbwls'}[iso];if(sub)return'🏴'+[...sub].map(c=>String.fromCodePoint(0xE0000+c.charCodeAt(0))).join('')+String.fromCodePoint(0xE007F);if(iso.length!==2)return'🏳️';return String.fromCodePoint(...[...iso.toUpperCase()].map(c=>0x1F1E6+c.charCodeAt(0)-65));}
// Selecciones: Elo -> goles esperados. dr incluye +100 de localía (convención de World Football Elo Ratings).
// g=0.0035 ajustado con 5,059 partidos de selecciones (2022–2026): minimiza Log Loss (antes 0.00434, que exageraba a los favoritos).
function natLam(eh,ea,home){const dr=eh-ea+home,mu=Math.log(1.3),g=0.0035;return[Math.min(5,Math.exp(mu+g*dr/2)),Math.min(5,Math.exp(mu-g*dr/2))];}
function renderLeagues(){
  const el=$('leagues');$('natOpts').classList.toggle('hidden',SPORT!=='nat');
  if(SPORT==='nat'){el.innerHTML=['Todas','UEFA','CONMEBOL','CONCACAF','CAF','AFC','OFC'].map(c=>`<button class="lg ${NATCONF===c?'on':''}" data-c="${c}">${c}</button>`).join('');
    el.querySelectorAll('[data-c]').forEach(b=>b.onclick=()=>{NATCONF=b.dataset.c;renderLeagues();});return;}
  if(SPORT!=='fut'){el.innerHTML='';return;}
  const keys=Object.keys(DATA.fut).sort((a,b)=>(LG_ORDER.indexOf(a)+1||99)-(LG_ORDER.indexOf(b)+1||99));
  el.innerHTML=keys.map(k=>`<button class="lg ${!INTL&&LEAGUE===k?'on':''}" data-k="${k}">${esc(DATA.fut[k].name)}</button>`).join('')+`<button class="lg intl ${INTL?'on':''}" data-k="intl">🌍 Internacional</button>`;
  el.querySelectorAll('.lg').forEach(b=>b.onclick=()=>{if(b.dataset.k==='intl')INTL=true;else{INTL=false;LEAGUE=b.dataset.k;S.H={lg:LEAGUE,i:0,ctx:{},adj:0};S.A={lg:LEAGUE,i:1,ctx:{},adj:0};}renderPicker();renderUpcoming();});
}
function recText(t){if(SPORT==='nat')return`${flag(t.iso)} Elo ${t.elo} · ${t.pos}º del mundo · ${t.conf}`;return SPORT==='fut'?`${t.pos}º · ${t.w}G ${t.d}E ${t.l}P · ${t.pts} pts`:`${t.w}-${t.l}${t.t?'-'+t.t:''} · ${t.pos}º de la liga`;}
function formTag(t){if(SPORT==='nat')return'';const th=SPORT==='fut'?.25:3;return t.form>th?'<span class="form up">▲ En buen momento</span>':t.form<-th?'<span class="form dn">▼ Por debajo de lo esperado</span>':'';}
function renderPicker(){
  for(const s of['H','A']){const t=team(s),L=lgOf(s);
    $('pick'+s).innerHTML=`${crest(t,58)}<div><div class="role">${s==='H'?'Local':'Visitante'}${INTL||SPORT!=='fut'?'':''}</div><div class="nm">${esc(t.n)}</div><div class="rec">${SPORT==='fut'&&INTL?esc(L.name)+' · ':''}${recText(t)}</div>${formTag(t)}</div><span class="chg">Cambiar ▾</span>`;
    $('pick'+s).onclick=()=>openModal(s);
    $('ctx'+s).innerHTML=`<h4>${esc(t.n)}</h4>${CTX[SPORT].map(([k,lab])=>`<button class="tog ${S[s].ctx[k]?'on':''}" data-c="${k}">${lab}</button>`).join('')}
      <div style="font-size:12px;color:var(--t3);margin-top:6px">Ajuste manual: <b id="adjv${s}">${S[s].adj>0?'+':''}${Math.round(S[s].adj*100)}%</b></div><input type="range" min="-15" max="15" value="${Math.round(S[s].adj*100)}" id="adj${s}">`;
    $('ctx'+s).querySelectorAll('.tog').forEach(b=>b.onclick=()=>{S[s].ctx[b.dataset.c]=!S[s].ctx[b.dataset.c];b.classList.toggle('on');});
    $('adj'+s).oninput=e=>{S[s].adj=+e.target.value/100;$('adjv'+s).textContent=(S[s].adj>0?'+':'')+Math.round(S[s].adj*100)+'%';};
  }
  renderLeagues();
}
function openModal(s){
  const m=$('modal'),grid=$('mGrid'),ls=$('mLeague');$('mTitle').textContent=s==='H'?'Elige al local':'Elige al visitante';
  if(SPORT==='fut'&&INTL){ls.classList.remove('hidden');ls.innerHTML=Object.keys(DATA.fut).map(k=>`<option value="${k}" ${k===S[s].lg?'selected':''}>${esc(DATA.fut[k].name)}</option>`).join('');ls.onchange=()=>fill(ls.value);}else ls.classList.add('hidden');
  let curL=S[s].lg;
  function fill(lgk){curL=lgk;const L=DATA[SPORT][lgk];const cell=(t,i)=>`<button class="tcell ${lgk===S[s].lg&&i===S[s].i?'sel':''}" data-i="${i}">${crest(t,54)}<div class="n">${esc(t.n)}</div><div class="r">${recText(t)}</div></button>`;
    if(SPORT==='nat'){const draw=()=>{const q=NATQ.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');const list=L.teams.map((t,i)=>[t,i]).filter(([t])=>(NATCONF==='Todas'||t.conf===NATCONF)&&(!q||t.n.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').includes(q)));
        $('natGrid').innerHTML=list.length?list.map(([t,i])=>cell(t,i)).join(''):'<p class="note">No encontré esa selección.</p>';
        $('natGrid').querySelectorAll('.tcell').forEach(b=>b.onclick=()=>pickTeam(+b.dataset.i));};
      grid.innerHTML=`<input class="msearch" id="natQ" placeholder="Buscar país…" value="${esc(NATQ)}"><div class="leagues" id="natC">${['Todas','UEFA','CONMEBOL','CONCACAF','CAF','AFC','OFC'].map(c=>`<button class="lg ${NATCONF===c?'on':''}" data-c="${c}">${c}</button>`).join('')}</div><div class="tgrid" id="natGrid"></div>`;
      $('natQ').oninput=e=>{NATQ=e.target.value;draw();};$('natC').querySelectorAll('[data-c]').forEach(b=>b.onclick=()=>{NATCONF=b.dataset.c;$('natC').querySelectorAll('.lg').forEach(x=>x.classList.toggle('on',x===b));draw();});draw();setTimeout(()=>$('natQ').focus(),50);return;}
    if(SPORT==='fut')grid.innerHTML=`<div class="tgrid">${L.teams.map(cell).join('')}</div>`;
    else{const g={};L.teams.forEach((t,i)=>(g[t.conf]=g[t.conf]||[]).push([t,i]));grid.innerHTML=Object.entries(g).map(([c,arr])=>`<div class="mgroup">${SPORT==='nba'?'Conferencia '+c:c}</div><div class="tgrid">${arr.map(([t,i])=>cell(t,i)).join('')}</div>`).join('');}
    grid.querySelectorAll('.tcell').forEach(b=>b.onclick=()=>pickTeam(+b.dataset.i));}
  function pickTeam(i){const lgk=curL,o=s==='H'?'A':'H';if(lgk===S[o].lg&&i===S[o].i){S[o].i=S[s].i;S[o].lg=S[s].lg;}S[s].lg=lgk;S[s].i=i;S[s].ctx={};FIXTURE=null;m.classList.remove('on');renderPicker();}
  fill(S[s].lg);m.classList.add('on');
}
$('venue').onchange=e=>{$('neutral').checked=e.target.value==='neutral';};
$('neutral').addEventListener('change',e=>{$('venue').value=e.target.checked?'neutral':'home';});
$('market').onchange=e=>{MARKET=e.target.checked;};
$('mClose').onclick=()=>$('modal').classList.remove('on');
$('modal').onclick=e=>{if(e.target.id==='modal')$('modal').classList.remove('on');};
function upList(){return(!INTL&&DATA.upcoming[curLeague()])||[];}
const NAT_FEAT=[['MEX','ESP','Revive el sueño'],['ESP','ARG','Final del Mundial 2026'],['ARG','BRA','Superclásico'],['MEX','USA','Clásico de CONCACAF'],['ENG','FRA','Duelo europeo'],['MEX','ARG','Rivalidad mundialista'],['COL','URU','CONMEBOL'],['MAR','SEN','África'],['JPN','KOR','Asia']];
function renderUpcoming(){
  if(SPORT==='nat'){const T=DATA.nat.nat.teams,ix=ab=>T.findIndex(t=>t.ab===ab);
    $('upcoming').innerHTML=NAT_FEAT.map(([h,a2,lab],k)=>{const H=T[ix(h)],A=T[ix(a2)];const[lh,la]=natLam(H.elo,A.elo,0),p=futPr(lh,la);
      return`<button class="fx" data-k="${k}"><div class="d">${lab} · partido hipotético</div><div class="row"><div class="tm">${crest(H,44)}${flag(H.iso)} ${esc(short(H.n))}</div><div class="vs">VS</div><div class="tm">${crest(A,44)}${flag(A.iso)} ${esc(short(A.n))}</div></div><div class="mini"><div style="flex:${p[0]};background:var(--home)"></div><div style="flex:${p[1]};background:var(--draw)"></div><div style="flex:${p[2]};background:var(--away)"></div></div><div class="p"><span>${pct(p[0],0)}</span><span>E ${pct(p[1],0)}</span><span>${pct(p[2],0)}</span></div></button>`;}).join('');
    $('upcoming').querySelectorAll('.fx').forEach(b=>b.onclick=()=>{const[h,a2]=NAT_FEAT[+b.dataset.k];S.H={lg:'nat',i:ix(h),ctx:{},adj:0};S.A={lg:'nat',i:ix(a2),ctx:{},adj:0};$('venue').value='neutral';$('neutral').checked=true;FIXTURE=null;renderPicker();runSim(true);});
    return;}
  const list=upList(),L=DATA[SPORT][curLeague()],idx=ab=>L.teams.findIndex(t=>t.ab===ab);
  if(!list.length){$('upcoming').innerHTML=`<p class="note" style="margin:0">No hay próximos partidos cargados para esta liga. Arma tu partido abajo.</p>`;return;}
  $('upcoming').innerHTML=list.map((g,k)=>{const h=L.teams[idx(g.h)],a=L.teams[idx(g.a)];if(!h||!a)return'';
    const on=FIXTURE&&FIXTURE.h===g.h&&FIXTURE.a===g.a&&FIXTURE.t===g.t;
    const bar=g.ph!=null?`<div class="mini"><div style="flex:${g.ph};background:var(--home)"></div>${g.pd!=null?`<div style="flex:${g.pd};background:var(--draw)"></div>`:''}<div style="flex:${g.pa};background:var(--away)"></div></div><div class="p"><span>${g.ph}%</span>${g.pd!=null?`<span>E ${g.pd}%</span>`:''}<span>${g.pa}%</span></div>`:`<div class="p"><span>SportRadar aún sin probabilidad</span></div>`;
    return`<button class="fx ${on?'on':''}" data-k="${k}"><div class="d">${fdate(g.t)}</div><div class="row"><div class="tm">${crest(h,44)}${esc(short(h.n))}</div><div class="vs">VS</div><div class="tm">${crest(a,44)}${esc(short(a.n))}</div></div>${bar}</button>`;}).join('');
  $('upcoming').querySelectorAll('.fx').forEach(b=>b.onclick=()=>{const g=list[+b.dataset.k],lg=curLeague();
    S.H={lg,i:idx(g.h),ctx:{},adj:0};S.A={lg,i:idx(g.a),ctx:{},adj:0};$('neutral').checked=false;FIXTURE=g;renderPicker();runSim(true);});
}
document.querySelectorAll('#sports button').forEach(b=>b.onclick=()=>{
  document.querySelectorAll('#sports button').forEach(x=>x.classList.toggle('on',x===b));document.querySelectorAll('#sportsM button').forEach(x=>x.classList.toggle('on',x.dataset.sm===b.dataset.s));
  SPORT=b.dataset.s;INTL=false;FIXTURE=null;if(SPORT!=='nat')$('neutral').checked=false;const lg=curLeague();S.H={lg,i:0,ctx:{},adj:0};S.A={lg,i:1,ctx:{},adj:0};
  featured();renderPicker();runSim(false);if(INTRO)renderPotd();
});
$('go').onclick=()=>{FIXTURE=matchFixture();runSim(true);};
function matchFixture(){if(INTL||S.H.lg!==S.A.lg)return null;const h=team('H').ab,a=team('A').ab;return upList().find(g=>g.h===h&&g.a===a)||null;}
function featured(){ // partido destacado: el próximo más atractivo
  if(SPORT==='nat'){const T=DATA.nat.nat.teams,ix=ab=>T.findIndex(t=>t.ab===ab);S.H={lg:'nat',i:ix('MEX'),ctx:{},adj:0};S.A={lg:'nat',i:ix('ESP'),ctx:{},adj:0};FIXTURE=null;$('venue').value='neutral';$('neutral').checked=true;return;}
  const list=upList(),L=DATA[SPORT][curLeague()],idx=ab=>L.teams.findIndex(t=>t.ab===ab);
  const str=t=>SPORT==='nat'?t.elo:SPORT==='fut'?t.x/t.y:t.x-t.y;
  let best=null,bs=-1e9;for(const g of list){const h=L.teams[idx(g.h)],a=L.teams[idx(g.a)];if(!h||!a)continue;const sc=Math.min(str(h),str(a))*2+str(h)+str(a);if(sc>bs){bs=sc;best=g;}}
  const lg=curLeague();
  if(best){S.H={lg,i:idx(best.h),ctx:{},adj:0};S.A={lg,i:idx(best.a),ctx:{},adj:0};FIXTURE=best;}
  else{const T=L.teams;S.H={lg,i:0,ctx:{},adj:0};S.A={lg,i:1,ctx:{},adj:0};FIXTURE=null;}
}

/* ============ MODELO ============ */
function params(){
  const H=team('H'),A=team('A'),LH=lgOf('H'),LA=lgOf('A'),neutral=$('neutral').checked,cH=S.H.ctx,cA=S.A.ctx;
  if(SPORT==='nat'){const[lh,la]=natLam(H.elo+S.H.adj*400,A.elo+S.A.adj*400,neutral?0:100);return{H,A,lh,la,nat:true};}
  if(SPORT==='fut'){let bH=(LH.h+LA.h)/2,bA=(LH.a+LA.a)/2;if(neutral){const m=(bH+bA)/2;bH=bA=m;}
    const kH=LH.coef||.9,kA=LA.coef||.9;
    const att=(t,c,adj)=>t.x*(1+adj)*(c.cans?.95:1)*(c.bajas?.91:1)*(c.motiv?1.03:1);
    const def=(t,c,adj)=>t.y*(1-adj/2)*(c.cans?1.05:1)*(c.bajas?1.05:1);
    // Calibración con 5,396 partidos históricos (más/menos 2.5 goles): las diferencias entre equipos se encogen (exponente 0.8)
    // y el nivel de goles sube 3 %. Si hay probabilidades del mercado, después se reajusta a ellas.
    const rH=att(H,cH,S.H.adj)*def(A,cA,S.A.adj)*(kH/kA)*(neutral?1:(H.alt||1)),rA=att(A,cA,S.A.adj)*def(H,cH,S.H.adj)*(kA/kH);
    return{H,A,lh:Math.max(.08,GOAL_B*bH*Math.pow(rH,GOAL_A)),la:Math.max(.08,GOAL_B*bA*Math.pow(rA,GOAL_A))};}
  const own=(c,adj,sp)=>sp==='nba'?(c.b2b?-1.5:0)+(c.star?-3:0)+(c.rest?1:0)+adj*15:(c.bye?1:0)+(c.qb?-5:0)+(c.short?-1:0)+adj*15;
  const opp=(c,adj,sp)=>sp==='nba'?(c.b2b?1:0)+(c.star?1.5:0)+(c.rest?-.5:0)-adj*10:(c.qb?1:0)+(c.short?.5:0)-adj*10;
  if(SPORT==='nba'){const avg=114,adv=neutral?0:2.4;return{H,A,mh:avg+H.x+A.y+adv/2+own(cH,S.H.adj,'nba')+opp(cA,S.A.adj,'nba'),ma:avg+A.x+H.y-adv/2+own(cA,S.A.adj,'nba')+opp(cH,S.H.adj,'nba')};}
  const avg=22.5,adv=neutral?0:1.8;
  return{H,A,eh:Math.max(6,avg+H.x+A.y+adv/2+own(cH,S.H.adj,'nfl')+opp(cA,S.A.adj,'nfl')),ea:Math.max(6,avg+A.x+H.y-adv/2+own(cA,S.A.adj,'nfl')+opp(cH,S.H.adj,'nfl'))};
}
function scoreMatrix(lh,la,rho=-0.1,G=11){
  const M=Array.from({length:G},()=>new Array(G).fill(0));const pois=(l,k)=>{let p=Math.exp(-l);for(let j=1;j<=k;j++)p*=l/j;return p;};
  for(const[m,w]of[[.86,.25],[1,.5],[1.14,.25]]){const a=lh*m,b=la*m;for(let i=0;i<G;i++)for(let j=0;j<G;j++){let tau=1;if(!i&&!j)tau=1-a*b*rho;else if(!i&&j===1)tau=1+a*rho;else if(i===1&&!j)tau=1+b*rho;else if(i===1&&j===1)tau=1-rho;M[i][j]+=w*Math.max(0,tau)*pois(a,i)*pois(b,j);}}
  let s=0;for(const r of M)for(const v of r)s+=v;for(const r of M)for(let j=0;j<G;j++)r[j]/=s;return M;
}
function nflDrive(E){const k=E/(11*1.96);let pTD=.22*k,pFG=.14*k;const s=pTD+pFG;if(s>.85){pTD*=.85/s;pFG*=.85/s;}return{pTD,pFG};}
function nflPts(d,n){let p=0;for(let i=0;i<n;i++){const r=rnd();if(r<d.pTD){const x=rnd();p+=x<.05?6:x<.08?8:7;}else if(r<d.pTD+d.pFG)p+=3;}return p;}
function nflOT(h,a,eh,ea){if(rnd()<.06)return[h,a];const pts=rnd()<.6?3:6;return rnd()<eh/(eh+ea)?[h+pts,a]:[h,a+pts];}
let MARKET=true;
function futPr(lh,la){const M=scoreMatrix(lh,la);let h=0,d=0,w=0;M.forEach((r,i)=>r.forEach((v,j)=>{if(i>j)h+=v;else if(i===j)d+=v;else w+=v;}));return[h,d,w];}
function nflPr(eh,ea,n=3000){const dH=nflDrive(eh),dA=nflDrive(ea);let w=0;for(let i=0;i<n;i++){const D=10+Math.floor(rnd()*3);let h=nflPts(dH,D),a=nflPts(dA,D);if(h===a)[h,a]=nflOT(h,a,eh,ea);w+=h>a?1:h===a?.5:0;}return w/n;}
// Mezcla del modelo con el consenso del mercado (SportRadar) cuando existe
// Peso del modelo frente al mercado en fútbol: 25 %. Validado con 6,215 partidos (8 ligas, 2024–2026): el mercado solo predice mejor
// que el modelo, y la mezcla óptima le da 0–20 % al modelo; se deja 25 % porque aquí el mercado es previo y no de cierre.
const FUT_WM=0.25,GOAL_A=0.8,GOAL_B=1.03;
function blendMarket(P,fx){
  if(!MARKET||!fx||fx.ph==null)return null;
  if(SPORT==='fut'||SPORT==='nat'){const m=futPr(P.lh,P.la),W=FUT_WM,t=[W*m[0]+(1-W)*fx.ph/100,W*m[1]+(1-W)*(fx.pd||0)/100,W*m[2]+(1-W)*fx.pa/100];let lh=P.lh,la=P.la;
    for(let it=0;it<30;it++){const p=futPr(lh,la);lh=Math.min(6,Math.max(.05,lh*Math.pow(t[0]/p[0],.6)));la=Math.min(6,Math.max(.05,la*Math.pow(t[2]/p[2],.6)));}
    P.lh=lh;P.la=la;return{model:m,market:[fx.ph/100,(fx.pd||0)/100,fx.pa/100]};}
  if(SPORT==='nfl'){const m=nflPr(P.eh,P.ea,4000),t=(m+fx.ph/100)/2;let lo=-14,hi=14;for(let it=0;it<12;it++){const d=(lo+hi)/2,p=nflPr(Math.max(6,P.eh+d),Math.max(6,P.ea-d),2500);if(p<t)lo=d;else hi=d;}
    const d=(lo+hi)/2;P.eh=Math.max(6,P.eh+d);P.ea=Math.max(6,P.ea-d);return{model:[m,0,1-m],market:[fx.ph/100,0,fx.pa/100]};}
  return null;
}
function simulate(n,fx=FIXTURE){
  const P=params(),R={sport:SPORT,n,H:P.H,A:P.A,P};R.blend=blendMarket(P,fx);
  if(SPORT==='fut'||SPORT==='nat'){R.sport='fut';R.nat=SPORT==='nat';const G=11,M=scoreMatrix(P.lh,P.la),cdf=[],keys=[];let c=0;
    for(let i=0;i<G;i++)for(let j=0;j<G;j++){c+=M[i][j];cdf.push(c);keys.push([i,j]);}
    const cnt=new Array(G*G).fill(0);for(let k=0;k<n;k++){const u=rnd()*c;let lo=0,hi=cdf.length-1;while(lo<hi){const mid=(lo+hi)>>1;if(cdf[mid]<u)lo=mid+1;else hi=mid;}cnt[lo]++;}
    let w=0,d=0,l=0,btts=0,sh=0,sa=0,h2=0,a2=0,hs=0,as=0;const tot=new Array(9).fill(0),sc=[],ov={.5:0,1.5:0,2.5:0,3.5:0,4.5:0},grid=Array.from({length:7},()=>new Array(7).fill(0));
    cnt.forEach((v,idx)=>{if(!v)return;const[i,j]=keys[idx];sh+=i*v;sa+=j*v;if(i>j)w+=v;else if(i===j)d+=v;else l+=v;if(i&&j)btts+=v;if(i)hs+=v;if(j)as+=v;const t=i+j;tot[Math.min(8,t)]+=v;for(const k in ov)if(t>+k)ov[k]+=v;if(i-j>=2)h2+=v;if(j-i>=2)a2+=v;grid[Math.min(6,i)][Math.min(6,j)]+=v/n;sc.push([i+'-'+j,v/n,i>j?'h':i<j?'a':'d']);});
    Object.assign(R,{pH:w/n,pD:d/n,pA:l/n,expH:sh/n,expA:sa/n,btts:btts/n,o25:ov[2.5]/n,grid,exact:futPr(P.lh,P.la)});
    R.top=sc.sort((a,b)=>b[1]-a[1]).slice(0,10).map(([k,p,c])=>({k,p,c}));
    R.hist={title:'Goles totales en el partido',labels:['0','1','2','3','4','5','6','7','8+'],v:tot.map(x=>x/n),col:()=>'var(--menta)'};
    const h=P.H.n,a=P.A.n;
    R.markets=[['Gana '+h,R.pH],['Empate',R.pD],['Gana '+a,R.pA],['1X · '+h+' o empate',R.pH+R.pD],['X2 · '+a+' o empate',R.pA+R.pD],['12 · Sin empate',R.pH+R.pA]];
    for(const k of [.5,1.5,2.5,3.5,4.5])R.markets.push([`Más de ${k} goles`,ov[k]/n],[`Menos de ${k} goles`,1-ov[k]/n]);
    R.markets.push(['Ambos anotan: Sí',btts/n],['Ambos anotan: No',1-btts/n],[h+' marca al menos 1',hs/n],[a+' marca al menos 1',as/n],
      ['Portería a cero de '+h,1-as/n],['Portería a cero de '+a,1-hs/n],[h+' gana por 2+',h2/n],[a+' gana por 2+',a2/n]);
    if(R.nat&&$('mtype').value==='ko'){const e=futPr(P.lh/3,P.la/3);R.adv=[R.pH+R.pD*(e[0]+e[1]*.5),R.pA+R.pD*(e[2]+e[1]*.5)];R.markets.push(['Avanza '+h+' (incl. prórroga y penales)',R.adv[0]],['Avanza '+a+' (incl. prórroga y penales)',R.adv[1]]);}
    return R;}
  let w=0,l=0,ti=0,sh=0,sa=0;const mg=new Int16Array(n),tt=new Int16Array(n);
  if(SPORT==='nba'){for(let i=0;i<n;i++){const c=normal()*5;let h=Math.round(P.mh+c+normal()*10.5),a=Math.round(P.ma+c+normal()*10.5);while(h===a){h+=Math.round(P.mh*5/48+normal()*3.5);a+=Math.round(P.ma*5/48+normal()*3.5);}sh+=h;sa+=a;if(h>a)w++;else l++;mg[i]=h-a;tt[i]=h+a;}}
  else{const dH=nflDrive(P.eh),dA=nflDrive(P.ea);for(let i=0;i<n;i++){const D=10+Math.floor(rnd()*3);let h=nflPts(dH,D),a=nflPts(dA,D);if(h===a)[h,a]=nflOT(h,a,P.eh,P.ea);sh+=h;sa+=a;if(h>a)w++;else if(h<a)l++;else ti++;mg[i]=h-a;tt[i]=h+a;}}
  Object.assign(R,{pH:w/n,pA:l/n,pD:ti/n,expH:sh/n,expA:sa/n});
  const em=R.expH-R.expA,favH=em>=0,L=Math.floor(Math.abs(em))+0.5,T=Math.round(R.expH+R.expA)+0.5;
  let cov=0,ov=0;for(let i=0;i<n;i++){if((favH?mg[i]:-mg[i])>L)cov++;if(tt[i]>T)ov++;}
  R.spread={fav:favH?P.H.n:P.A.n,dog:favH?P.A.n:P.H.n,line:L,p:cov/n};R.total={line:T,p:ov/n};
  const B=SPORT==='nba'?[[1,5],[6,10],[11,15],[16,99]]:[[1,3],[4,7],[8,14],[15,99]];
  const cntR=(lo,hi,s)=>{let c=0;for(let i=0;i<n;i++){const m=s*mg[i];if(m>=lo&&m<=hi)c++;}return c/n;};
  R.top=[];for(const[lo,hi]of B)R.top.push({k:`${short(P.H.n)} por ${hi>90?lo+'+':lo+'–'+hi}`,p:cntR(lo,hi,1),c:'h'});for(const[lo,hi]of B)R.top.push({k:`${short(P.A.n)} por ${hi>90?lo+'+':lo+'–'+hi}`,p:cntR(lo,hi,-1),c:'a'});
  const step=SPORT==='nba'?4:3,lim=SPORT==='nba'?32:27,labels=[],v=[],mids=[];
  for(let lo=-lim;lo<lim;lo+=step){labels.push(String(lo+step/2|0));mids.push(lo+step/2);v.push(0);}
  for(let i=0;i<n;i++){const m=Math.max(-lim,Math.min(lim-.001,mg[i]));v[Math.floor((m+lim)/step)]++;}
  R.hist={title:'Diferencia de puntos (local − visitante)',labels,v:v.map(x=>x/n),col:i=>mids[i]>.5?'var(--home)':mids[i]<-.5?'var(--away)':'var(--draw)'};
  R.markets=[['Gana '+P.H.n,R.pH],['Gana '+P.A.n,R.pA],[`${R.spread.fav} −${L}`,cov/n],[`${R.spread.dog} +${L}`,1-cov/n],[`Más de ${T} puntos`,ov/n],[`Menos de ${T} puntos`,1-ov/n]];
  return R;
}

/* ============ SIMULAR Y MOSTRAR ============ */
function runSim(scrollTop){if(scrollTop)introOff();
  const n=+$('nSim').value;$('go').disabled=true;$('go').textContent='Simulando…';
  setTimeout(()=>{const t0=performance.now();const R=simulate(n);R.ms=performance.now()-t0;R.fx=FIXTURE;LAST=R;
    render(R);if(INTRO)liveIdle(SPORT);else startLiveMatch();renderUpcoming();
    $('go').disabled=false;$('go').textContent='Simular partido';
    if(scrollTop)window.scrollTo({top:0,behavior:'smooth'});},20);
}
function countUp(el,to,dec=1,suffix='%'){const t0=performance.now(),from=0;const step=t=>{const p=Math.min(1,(t-t0)/900),e=1-Math.pow(1-p,3);el.textContent=(from+(to-from)*e).toFixed(dec)+suffix;if(p<1)requestAnimationFrame(step);};requestAnimationFrame(step);}
function render(R){
  const h=R.H.n,a=R.A.n,fut=R.sport==='fut',L=lgOf('H');
  $('simKick').textContent=`${fmt(R.n)} simulaciones en ${(R.ms/1000).toFixed(2)} segundos`;
  $('simMeta').textContent=R.nat?'Selecciones · '+MTYPE[$('mtype').value]:SPORT==='fut'&&!INTL?L.name:SPORT==='fut'?'Partido internacional':L.name;
  const big=(cls,t,p,lab)=>`<div class="bigc ${cls}" style="--glow:${cls==='a'?'rgba(59,130,246,.16)':'rgba(0,230,168,.14)'}">${crest(t,76)}<div><div class="pc num" style="color:var(--${cls==='a'?'away':'home'})" data-to="${p*100}">0%</div><div class="who">${lab}</div><div class="sm">${fmt(p*R.n)} de ${fmt(R.n)} simulaciones</div></div></div>`;
  const U=uncertainty(R);R.U=U;const rd=round100(fut||R.pD>0.004?[R.pH,R.pD,R.pA]:[R.pH,R.pA],U.dec);const[rH,rD,rA]=fut||R.pD>0.004?rd:[rd[0],null,rd[1]];
  $('hypo').innerHTML=(R.fx?'':`<span class="hyp">${R.nat?'PARTIDO DE SELECCIONES · ':''}SIMULACIÓN HIPOTÉTICA · NO ES UN PARTIDO PROGRAMADO</span>`)+`<span class="uchip" id="uchip" style="color:${{Baja:'var(--menta)',Media:'var(--dorado)',Alta:'var(--naranja)'}[U.level]}">● Incertidumbre ${U.level.toLowerCase()} · ver por qué</span>`;
  $('uchip').onclick=()=>$('howCard').scrollIntoView({behavior:'smooth',block:'start'});
  $('big3').innerHTML=big('h',R.H,R.pH,'Gana '+esc(h))+(rD!=null?`<div class="bigd"><div class="pc num" data-to="${rD}" data-dec="${U.dec}">0%</div><div class="sm">Empate</div></div>`:'<div></div>')+big('a',R.A,R.pA,'Gana '+esc(a));
  const pcs=$('big3').querySelectorAll('.bigc .pc');pcs[0].dataset.to=rH;pcs[1].dataset.to=rA;pcs.forEach(e=>e.dataset.dec=U.dec);
  $('big3').querySelectorAll('[data-to]').forEach(e=>countUp(e,+e.dataset.to,+e.dataset.dec));
  $('advBox').innerHTML=R.adv?`<div class="advb"><span>Avanza ${esc(short(h))} <b style="color:var(--home)">${pct(R.adv[0],0)}</b></span><span>Avanza ${esc(short(a))} <b style="color:var(--away)">${pct(R.adv[1],0)}</b></span><span style="color:var(--t3)">Incluye prórroga (30 min) y penales (50/50)</span></div>`:'';
  $('top5').innerHTML=top5HTML(R);$('compBox').innerHTML=compHTML(R);$('howBox').innerHTML=howHTML(R);$('heatBox').innerHTML=heatHTML(R);
  $('split').innerHTML=`<div style="flex-grow:${R.pH};background:var(--home)"></div>${R.pD>0.004?`<div style="flex-grow:${R.pD};background:var(--draw)"></div>`:''}<div style="flex-grow:${R.pA};background:var(--away)"></div>`;
  const fav=R.pH>=R.pA?h:a,pf=Math.max(R.pH,R.pA);
  $('summary').innerHTML=fut?`<b>${esc(fav)}</b> es favorito con <b>${pct(pf,0)}</b>. Marcador más probable: <b>${R.top[0].k}</b>. Se esperan <b>${(R.expH+R.expA).toFixed(1)} goles</b> y ambos anotan en el ${pct(R.btts,0)} de los partidos.`
    :`<b>${esc(fav)}</b> gana en el <b>${pct(pf,0)}</b> de las simulaciones. Marcador promedio: <b>${Math.round(R.expH)}-${Math.round(R.expA)}</b> · línea del modelo: <b>${esc(R.spread.fav)} −${R.spread.line}</b>, total <b>${R.total.line}</b>.`;
  if(R.blend)$('summary').innerHTML+=` <span class="mk">Pronóstico combinado: ${R.sport==='nfl'?50:FUT_WM*100}% modelo El Bicho (${pct(R.blend.model[0],0)} / ${pct(R.blend.model[2],0)}) + ${R.sport==='nfl'?50:100-FUT_WM*100}% consenso del mercado (${pct(R.blend.market[0],0)} / ${pct(R.blend.market[2],0)}).</span>`;
  renderPicks(R);
  // análisis
  $('topT').textContent=fut?'Marcadores más probables':'¿Por cuánto gana?';const mx=Math.max(...R.top.map(t=>t.p));
  $('top').innerHTML=R.top.map(t=>`<div class="hb" style="--lw:${fut?'48px':'150px'}"><div>${esc(t.k)}</div><div class="tr"><div class="fl" style="width:${t.p/mx*100}%;background:var(--${t.c==='h'?'home':t.c==='a'?'away':'draw'})" data-tip="${esc(t.k)}: ${pct(t.p,2)}"></div></div><div class="pv num">${pct(t.p)}</div></div>`).join('')+`<div class="legend"><span><i style="background:var(--home)"></i>${esc(h)}</span>${fut?'<span><i style="background:var(--draw)"></i>Empate</span>':''}<span><i style="background:var(--away)"></i>${esc(a)}</span></div>`;
  $('histT').textContent=R.hist.title;const hm=Math.max(...R.hist.v);
  $('hist').innerHTML=`<div class="hist">${R.hist.v.map((v,i)=>`<div class="b" style="height:${v/hm*100}%;background:${R.hist.col(i)}" data-tip="${fut?R.hist.labels[i]+' goles':'Diferencia ≈ '+R.hist.labels[i]}: ${pct(v,2)}"></div>`).join('')}</div>`;
  const ev=R.hist.labels.length>12?2:1;$('histL').innerHTML=R.hist.labels.map((l,i)=>`<span>${i%ev===0?l:''}</span>`).join('');
  $('histLg').innerHTML=fut?'<span>% de las simulaciones con ese total de goles</span>':`<span><i style="background:var(--home)"></i>Gana ${esc(h)}</span><span><i style="background:var(--away)"></i>Gana ${esc(a)}</span>`;
  $('markets').innerHTML=R.markets.map((m,i)=>`<tr><td>${esc(m[0])}</td><td class="n num">${pct(m[1])}</td><td class="n num">${fair(m[1])}</td><td style="text-align:right"><button class="btn sm" data-save="${i}">+ Pick</button></td></tr>`).join('');
  $('markets').querySelectorAll('[data-save]').forEach(b=>b.onclick=()=>{const m=R.markets[+b.dataset.save];savePick(m[0],m[1],null);});
  $('aiTitle').textContent='Análisis del modelo';$('ai').innerHTML=ruleAnalysis(R);
  buildOdds(R);renderCmp(R);
}
function renderPicks(R){
  const fut=R.sport==='fut',M=R.markets,safe=M.filter(m=>m[1]<=.80).sort((a,b)=>b[1]-a[1])[0];
  const risk=fut?[`Marcador exacto ${R.top[0].k}`,R.top[0].p]:(R.pH<R.pA?['Gana '+R.H.n,R.pH]:['Gana '+R.A.n,R.pA]);
  const card=(cls,lab,what,p,why)=>`<div class="pk ${cls}"><div class="lab">${lab}</div><div class="what">${esc(what)}</div><div class="why">${why}</div><div class="pp num">${pct(p,0)}</div><div class="acts2"><button class="share" data-sh="${esc(what)}" data-shp="${p}" data-shl="${lab}">📸</button><button class="btn sm" data-p="${esc(what)}" data-pr="${p}">+ Pick</button></div></div>`;
  $('picks').innerHTML=card('safe','Pick seguro',safe[0],safe[1],`El resultado más probable que no es casi seguro (cuota justa: ${fair(safe[1])})`)
    +`<div class="pk value" id="valuePick"></div>`
    +card('risk','Jugada arriesgada',risk[0],risk[1],`Sale poco, pero paga mucho (cuota justa: ${fair(risk[1])})`);
  $('picks').querySelectorAll('[data-p]').forEach(b=>b.onclick=()=>savePick(b.dataset.p,+b.dataset.pr,null));
  $('picks').querySelectorAll('[data-sh]').forEach(b=>b.onclick=()=>openShare({kicker:b.dataset.shl.toUpperCase(),kc:b.dataset.shl==='Jugada arriesgada'?'#FF7A00':'#00E6A8',H:R.H,A:R.A,sp:R.sport,pick:b.dataset.sh,prob:+b.dataset.shp,probs:[R.pH,R.pD,R.pA],meta:(R.fx?fdate(R.fx.t)+' · ':'')+(R.sport==='fut'?lgOf('H').name:R.sport.toUpperCase())}));
  valueCard(null);
}
function valueCard(best,any){const vp=$('valuePick');if(!vp)return;
  if(best){vp.innerHTML=`<div class="lab">Comparado con tu casa</div><div class="what">${esc(best.o[1])} @ ${best.odd.toFixed(2)}</div><div class="why">Tu casa paga más que la cuota justa del pronóstico (+$${best.ev.toFixed(0)} por cada $100 <i>si</i> el pronóstico fuera exacto). Ojo: en nuestra prueba con miles de partidos, apostar en estas diferencias perdió dinero.</div><div class="pp num">${pct(best.o[2],0)}</div><div class="acts2"><button class="btn sm" id="vpSave">+ Pick</button></div>`;$('vpSave').onclick=()=>savePick(best.o[1],best.o[2],best.odd);}
  else vp.innerHTML=`<div class="lab">Comparado con tu casa</div><div class="what">${any?'Tu casa no paga de más':'¿Qué cuotas te da tu casa?'}</div><div class="why">${any?'La casa paga igual o menos que la cuota justa del pronóstico. Mejor no forzar.':'Escríbelas y te mostramos cómo se comparan con nuestro pronóstico.'}</div><button class="btn menta sm" style="margin-top:14px" onclick="showTab('bet');goTo('analysis')">Escribir cuotas →</button>`;}
function ruleAnalysis(R){
  const h=R.H.n,a=R.A.n,fut=R.sport==='fut',o=[[h,R.pH],[a,R.pA]];if(fut)o.push(['el empate',R.pD]);o.sort((x,y)=>y[1]-x[1]);
  const conf=o[0][1]>.62?'alta':o[0][1]>.47?'media':'baja',gap=o[0][1]-o[1][1];
  let s=`<p><b>Favorito:</b> ${esc(o[0][0])} con ${pct(o[0][1])}. Confianza <b>${conf}</b>${gap<.08?` — partido muy parejo (solo ${pct(gap)} de diferencia)`:''}.</p>`;
  if(fut){const t=R.expH+R.expA;s+=`<p><b>Goles:</b> se esperan ${t.toFixed(2)}. ${t>3?'Pinta abierto: más de 2.5 sale en '+pct(R.o25)+'.':t<2.3?'Pinta cerrado: menos de 2.5 sale en '+pct(1-R.o25)+'.':'Más de 2.5 en '+pct(R.o25)+'.'} Ambos anotan: ${pct(R.btts)}.</p><p><b>Marcadores:</b> ${R.top.slice(0,3).map(t=>t.k+' ('+pct(t.p)+')').join(', ')}. Un marcador exacto casi nunca pasa del 13%.</p>`;}
  else{s+=`<p><b>Hándicap:</b> ${esc(R.spread.fav)} −${R.spread.line} lo cubre en ${pct(R.spread.p)}. <b>Total:</b> ${(R.expH+R.expA).toFixed(1)} puntos esperados; más de ${R.total.line} en ${pct(R.total.p)}.</p>`;if(R.sport==='nfl')s+=`<p>En la NFL los márgenes de 3 y 7 puntos son los más comunes: vigila líneas como −2.5/−3.5 y −6.5/−7.5.</p>`;}
  if(R.H.alt&&!$('neutral').checked)s+=`<p><b>Altitud:</b> ${esc(h)} recibe un extra de ${Math.round((R.H.alt-1)*100)}% por jugar en altura.</p>`;
  s+=`<p style="color:var(--t3);font-size:13px">Con ${fmt(R.n)} simulaciones el margen de error es de ±${(100/Math.sqrt(R.n)).toFixed(1)} puntos. El límite real del modelo es la calidad de los datos.</p>`;return s;
}
function buildOdds(R){
  const fut=R.sport==='fut',opts=[['h','Gana '+R.H.n,R.pH]];if(fut)opts.push(['d','Empate',R.pD]);opts.push(['a','Gana '+R.A.n,R.pA]);
  $('oddsRow').innerHTML=opts.map(o=>`<label>${esc(o[1])}<input type="number" step="0.01" min="1.01" id="od_${o[0]}" placeholder="ej. ${Math.max(1.05,(1/o[2])/1.06).toFixed(2)}"></label>`).join('');
  const upd=()=>{const vals=opts.map(o=>+$('od_'+o[0]).value||0),all=vals.every(v=>v>1),inv=vals.map(v=>v>1?1/v:0),sum=inv.reduce((x,y)=>x+y,0);let best=null;
    $('ev').innerHTML=opts.map((o,i)=>{const odd=vals[i];if(!(odd>1))return`<tr><td>${esc(o[1])}</td><td class="n num">${pct(o[2])}</td><td class="n">—</td><td class="n">—</td><td><span class="pill bad">Escribe la cuota</span></td><td></td></tr>`;
      const ev=(o[2]*odd-1)*100;if(ev>3&&(!best||ev>best.ev))best={ev,o,odd};
      const v=ev>3?(o[2]<.35?'<span class="pill risk">Paga más · arriesgada</span>':'<span class="pill good">Paga más que el pronóstico</span>'):ev>-3?'<span class="pill bad">≈ Parecido</span>':'<span class="pill bad">Paga menos</span>';
      return`<tr><td>${esc(o[1])}</td><td class="n num">${pct(o[2])}</td><td class="n num">${all?pct(inv[i]/sum):pct(inv[i])}</td><td class="n num" style="color:${ev>3?'var(--menta)':'var(--t2)'}">${(ev>=0?'+$':'−$')+Math.abs(ev).toFixed(2)}</td><td>${v}</td><td style="text-align:right"><button class="btn sm" data-i="${i}">+ Pick</button></td></tr>`;}).join('');
    $('ev').querySelectorAll('[data-i]').forEach(b=>b.onclick=()=>{const i=+b.dataset.i;savePick(opts[i][1],opts[i][2],vals[i]);});
    $('margin').textContent=all?`Margen de la casa: ${((sum-1)*100).toFixed(1)}%. La ganancia esperada es un promedio de largo plazo: en un partido se gana o se pierde todo.`:'';
    valueCard(best,vals.some(v=>v>1));};
  opts.forEach(o=>$('od_'+o[0]).oninput=upd);upd();
}
function renderCmp(R){const g=R.fx;const has=g&&g.ph!=null;$('tabSr').classList.toggle('hidden',!has);if(!has){if($('t-sr').classList.contains('on'))showTab('res');return;}
  const rows=[['Gana '+short(R.H.n),R.pH,g.ph/100,'home']];if(g.pd!=null)rows.push(['Empate',R.pD,g.pd/100,'draw']);rows.push(['Gana '+short(R.A.n),R.pA,g.pa/100,'away']);
  $('cmp').innerHTML=rows.map(([l,m,s,c])=>`<div class="cmp"><div>${esc(l)}</div><div class="two"><div style="width:${m*100}%;background:var(--${c})" data-tip="Modelo: ${pct(m)}"></div><div style="width:${s*100}%;background:var(--${c});opacity:.35" data-tip="SportRadar: ${pct(s)}"></div></div><div class="num" style="text-align:right;font-weight:800">${pct(m,0)} <span style="color:var(--t3);font-weight:500">/ ${pct(s,0)}</span></div></div>`).join('')+`<div class="legend"><span><i style="background:var(--plata)"></i>Sólido = modelo del Bicho</span><span><i style="background:var(--plata);opacity:.35"></i>Tenue = SportRadar</span></div>`;}
function showTab(t){document.querySelectorAll('#tabs .tab').forEach(b=>b.classList.toggle('on',b.dataset.t===t));document.querySelectorAll('.tpanel').forEach(p=>p.classList.toggle('on',p.id==='t-'+t));if(t==='live'&&LV)liveDetail();}
document.querySelectorAll('#tabs .tab').forEach(b=>b.onclick=()=>showTab(b.dataset.t));

/* ============ PARTIDO EN VIVO (interfaz) ============ */
function startLiveMatch(){
  const R=LAST,K=kits(R.H,R.A);
  $('heroTitle').innerHTML=`${esc(R.H.n)}<span>vs</span>${esc(R.A.n)}`;
  $('heroSub').textContent=R.nat?'Selecciones · '+MTYPE[$('mtype').value]:R.fx?fdate(R.fx.t)+' · '+(SPORT==='fut'?lgOf('H').name:SPORT.toUpperCase()):(SPORT==='fut'?(INTL?'Internacional':lgOf('H').name):SPORT.toUpperCase());
  $('sbH').innerHTML=`${crest(R.H,34)}<span class="nm">${esc(short(R.H.n))}</span>`;$('sbA').innerHTML=`${crest(R.A,34)}<span class="nm">${esc(short(R.A.n))}</span>`;
  $('ticker').innerHTML='';$('cPlay').textContent='❚❚';
  $('final').classList.remove('on');LIVE.paused=false;
  liveStart(R.P,R.sport,K);
}
function setupHooks(){
LIVE.hooks.score=(d,team)=>{$('scH').textContent=d[0];$('scA').textContent=d[1];if(team>=0){const e=$(team===0?'scH':'scA');e.classList.remove('pop');void e.offsetWidth;e.classList.add('pop');}};
LIVE.hooks.banner=(t,c,big)=>{const b=$('banner');b.textContent=t;b.style.color=c||'#fff';b.className=big?'':'sm';void b.offsetWidth;b.classList.add('go');};
LIVE.hooks.ticker=html=>{const tk=$('ticker'),d=document.createElement('div');d.innerHTML=`<span style="color:var(--t3);font-weight:700;margin-right:8px">${LV?LV.min+"'":''}</span>${html}`;tk.prepend(d);while(tk.children.length>4)tk.lastChild.remove();};
LIVE.hooks.end=L=>{$('cPlay').textContent='▶';sfx('final');setTimeout(()=>showFinal(L||LV),900);};
LIVE.hooks.sfx=sfx;
LIVE.hooks.minute=L=>{
  const sp=L.sport,m=L.min;
  $('sbClock').textContent=L.done?'FINAL':sp==='fut'?(m<=45?m+"'":m>90?"90+"+(m-90)+"'":m+"'"):sp==='nba'?(m>48?'TIEMPO EXTRA':'Q'+Math.min(4,Math.floor(Math.max(0,m-1)/12)+1)+' · '+String(12-((m-1)%12+1)).padStart(2,'0')+':00'):('Q'+Math.min(4,Math.floor(Math.max(0,m-1)/15)+1)+' · '+String(15-((m-1)%15+1)).padStart(2,'0')+':00');
  const w=L.wp[L.wp.length-1],fut=sp==='fut';
  $('wpH').style.flexGrow=Math.max(.001,w[1]);$('wpD').style.flexGrow=fut?Math.max(.001,w[2]):0;$('wpD').style.display=fut?'':'none';$('wpA').style.flexGrow=Math.max(.001,w[3]);
  $('wpHl').textContent=short(L.P.H.n)+' '+pct(w[1],0);$('wpDl').textContent=fut?'Empate '+pct(w[2],0):'';$('wpAl').textContent=pct(w[3],0)+' '+short(L.P.A.n);
  const s=L.s,c=(l,a,b)=>`<div class="chip4"><div class="v num"><span style="color:var(--home)">${a}</span><i>·</i><span style="color:var(--away)">${b}</span></div><div class="l">${l}</div></div>`;
  let ch;
  if(fut){const ph=Math.round(s[0].pos/(s[0].pos+s[1].pos||1)*100)||50;ch=c('Posesión',ph+'%',(100-ph)+'%')+c('Tiros',s[0].shots,s[1].shots)+c('A puerta',s[0].sot,s[1].sot)+c('Córners',s[0].corn,s[1].corn);}
  else if(sp==='nba'){const fg=i=>s[i].fga?Math.round(s[i].fgm/s[i].fga*100)+'%':'—';ch=c('Tiros de campo',fg(0),fg(1))+c('Triples',s[0].tpm,s[1].tpm)+c('Rebotes',s[0].reb,s[1].reb)+c('Pérdidas',s[0].to,s[1].to);}
  else ch=c('Yardas',Math.round(s[0].yds),Math.round(s[1].yds))+c('1os downs',s[0].fd,s[1].fd)+c('Pérdidas',s[0].to,s[1].to)+c('Posesión',s[0].top+"'",s[1].top+"'");
  $('liveChips').innerHTML=ch;
  if($('t-live').classList.contains('on'))liveDetail();
};
}
function liveDetail(){
  const L=LV;if(!L)return;const s=L.s,fut=L.sport==='fut',rows=[];
  if(fut){const ph=Math.round(s[0].pos/(s[0].pos+s[1].pos||1)*100)||50;rows.push(['Posesión %',ph,100-ph],['Tiros',s[0].shots,s[1].shots],['Tiros a puerta',s[0].sot,s[1].sot],['Tiros de esquina',s[0].corn,s[1].corn],['Amarillas',s[0].yel,s[1].yel],['Rojas',s[0].red,s[1].red]);}
  else if(L.sport==='nba'){const fg=i=>s[i].fga?Math.round(s[i].fgm/s[i].fga*100):0;rows.push(['Puntos',s[0].pts,s[1].pts],['% tiros de campo',fg(0),fg(1)],['Triples',s[0].tpm,s[1].tpm],['Rebotes',s[0].reb,s[1].reb],['Asistencias',s[0].ast,s[1].ast],['Pérdidas',s[0].to,s[1].to]);}
  else rows.push(['Puntos',s[0].pts,s[1].pts],['Yardas',Math.round(s[0].yds),Math.round(s[1].yds)],['Primeros downs',s[0].fd,s[1].fd],['Pérdidas de balón',s[0].to,s[1].to],['Posesión (min)',s[0].top,s[1].top]);
  $('lvStats').innerHTML=rows.map(r=>{const t=(r[1]+r[2])||1;return`<div class="srow"><div class="lab">${r[0]}</div><div class="vh num">${r[1]}</div><div class="sbar"><div style="flex:${r[1]/t||.001};background:var(--home)"></div><div style="flex:${r[2]/t||.001};background:var(--away)"></div></div><div class="va num">${r[2]}</div></div>`;}).join('');
  $('lvLog').innerHTML=L.log.map(e=>`<div><span class="m">${e.m}'</span>${e.t}</div>`).join('');
  const W=560,H=200,pl=38,pr=10,pt=10,pb=24,end=Math.max(L.end,L.min),x=m=>pl+(W-pl-pr)*m/end,y=p=>pt+(H-pt-pb)*(1-p);
  let g='';for(const p of[0,.5,1])g+=`<line x1="${pl}" x2="${W-pr}" y1="${y(p)}" y2="${y(p)}" stroke="#262626"/><text x="${pl-6}" y="${y(p)+4}" fill="#8a8f98" font-size="11" text-anchor="end" font-family="Montserrat,sans-serif">${p*100}%</text>`;
  const ser=[[1,'#00E6A8',L.P.H.n],[3,'#3B82F6',L.P.A.n]];if(fut)ser.splice(1,0,[2,'#9CA3AF','Empate']);
  for(const[i,c]of ser)g+=`<polyline points="${L.wp.map(r=>x(r[0]).toFixed(1)+','+y(r[i]).toFixed(1)).join(' ')}" fill="none" stroke="${c}" stroke-width="2.2" stroke-linejoin="round"/>`;
  $('wp').innerHTML=`<svg viewBox="0 0 ${W} ${H}" width="100%" style="display:block">${g}</svg>`;
  const lr=L.wp[L.wp.length-1];$('wpLg').innerHTML=ser.map(([i,c,n])=>`<span><i style="background:${c}"></i>${esc(n)} ${pct(lr[i])}</span>`).join('');
}
$('cPlay').onclick=()=>{if(!LV)return;if(LV.done&&!LV.q.length&&!LV.act){startLiveMatch();return;}LIVE.paused=!LIVE.paused;$('cPlay').textContent=LIVE.paused?'▶':'❚❚';SND.base();};
document.querySelectorAll('.ctrl [data-sp]').forEach(b=>b.onclick=()=>{LIVE.speed=+b.dataset.sp;document.querySelectorAll('.ctrl [data-sp]').forEach(x=>x.classList.toggle('on',x===b));});
$('cSkip').onclick=()=>{if(LV)liveSkip();};
$('cNew').onclick=()=>{if(LAST)startLiveMatch();};

/* ============ ANÁLISIS DETALLADO ============ */
let SAMPLE=null;
async function aiAnalyze(){
  const R=LAST;if(!R||!SAMPLE)return;const btn=$('aiBtn');btn.disabled=true;btn.textContent='Analizando…';
  const odds=['h','d','a'].map(k=>$('od_'+k)?+$('od_'+k).value||null:null);
  const data={deporte:R.sport==='fut'?'fútbol':R.sport.toUpperCase(),liga:lgOf('H').name,local:{nombre:R.H.n,record:recText(R.H),contexto:S.H.ctx},visitante:{nombre:R.A.n,record:recText(R.A),contexto:S.A.ctx},
    cancha_neutral:$('neutral').checked,simulaciones:R.n,prob_local:+R.pH.toFixed(3),prob_empate:+R.pD.toFixed(3),prob_visitante:+R.pA.toFixed(3),esperado:[+R.expH.toFixed(2),+R.expA.toFixed(2)],
    top:R.top.slice(0,5).map(t=>[t.k,+t.p.toFixed(3)]),mercados:R.markets.map(m=>[m[0],+m[1].toFixed(3)]),sportradar:R.fx&&R.fx.ph!=null?{local:R.fx.ph,empate:R.fx.pd,visitante:R.fx.pa}:null,cuotas_casa:odds};
  const prompt=`Eres el analista de "El Bicho Picks", una marca mexicana de picks deportivos. Escribe en español de México, directo y con seguridad, sin exagerar.
Con los datos de la simulación (JSON), escribe 4 a 5 párrafos cortos: 1) quién es favorito y qué tan claro; 2) ritmo y goles/puntos esperados; 3) tres picks: "Pick seguro", "Comparado con tu casa" (solo si hay cuotas de la casa que paguen más que la cuota justa; aclara que en la prueba histórica apostar en esas diferencias perdió dinero y que no es garantía) y "Jugada arriesgada", con su probabilidad; 4) si hay probabilidad de SportRadar, compárala; 5) qué podría romper el pronóstico.
Reglas: usa solo los datos dados; no inventes lesiones, noticias ni alineaciones. Usa **negritas** para los picks. Termina con una línea corta de juego responsable. Sin títulos ni viñetas.
DATOS: ${JSON.stringify(data)}`;
  const box=$('ai');$('aiTitle').textContent='Análisis detallado';box.innerHTML='<p style="color:var(--t3)">Pensando…</p>';
  const md=t=>t.split(/\n{2,}/).map(p=>'<p>'+esc(p).replace(/\*\*(.+?)\*\*/g,'<b>$1</b>').replace(/\n/g,'<br>')+'</p>').join('');
  try{const r=await SAMPLE(prompt,{onText:({text})=>{box.innerHTML=md(text);},cache:false});box.innerHTML=md(r.text);}
  catch(e){$('aiTitle').textContent='Análisis del modelo';box.innerHTML=ruleAnalysis(R)+`<p class="note">${e&&e.code==='rate_limited'?'El análisis detallado está ocupado; intenta en un momento.':'El análisis detallado no está disponible en esta vista.'}</p>`;if(e&&e.code==='not_granted')btn.classList.add('hidden');}
  btn.disabled=false;btn.textContent='✦ Ver análisis detallado';
}
$('aiBtn').onclick=aiAnalyze;

/* ============ MIS PICKS ============ */
let DB=null,UID=null,PICKS=[];
const pickCol=()=>DB.collection('data/users/'+UID);
async function savePick(label,prob,odd){if(!LAST)return;if(!DB||!UID){toast('Para guardar picks abre la página con tu sesión de Claude');return;}
  const R=LAST,doc={kind:'pick',ts:Date.now(),sport:R.sport,league:R.sport==='fut'?lgOf('H').name:R.sport.toUpperCase(),home:R.H.n,away:R.A.n,pick:label,prob:+prob.toFixed(4),odd:odd||null,status:'pendiente'};
  try{await pickCol().add(doc);toast('Pick guardado ✓');}catch(e){toast(e&&e.code==='quota_exceeded'?'Ya no caben más picks: borra algunos':'No se pudo guardar el pick');}}
async function setStatus(id,st){try{await pickCol().doc(id).update({status:st});if(PUBIDS.has(id))await DB.doc('historial/'+id).update({status:st});}catch(e){toast('No se pudo actualizar');}}
let PUB=[],PUBIDS=new Set(),ISOWNER=false;
async function togglePub(p){try{if(PUBIDS.has(p.id)){await DB.doc('historial/'+p.id).delete();toast('Quitado del historial');}else{const{id,...rest}=p;await DB.doc('historial/'+p.id).set(rest);toast('Publicado en el historial ✓');}}catch(e){toast('No se pudo publicar');}}
function renderPub(){
  const el=$('pubHist');
  if(!DB){el.innerHTML='<p class="note" style="margin:0;font-size:14px">El historial se muestra al abrir la página con sesión de Claude.</p>';return;}
  if(!PUB.length){el.innerHTML=`<p class="note" style="margin:0;font-size:14px">${ISOWNER?'Aún no publicas picks. En <b>Mis picks</b> toca <b>Publicar</b> para que tus seguidores vean tu récord real.':'Aún no hay picks publicados.'}</p>`;return;}
  const done=PUB.filter(p=>p.status!=='pendiente'),hits=done.filter(p=>p.status==='acierto'),wo=done.filter(p=>p.odd),profit=wo.reduce((s,p)=>s+(p.status==='acierto'?(p.odd-1)*100:-100),0);
  const st=(l,v,s)=>`<div class="k"><div class="l">${l}</div><div class="v num">${v}</div><div class="s">${s}</div></div>`;
  el.innerHTML=`<div class="kp">${st('Efectividad',done.length?pct(hits.length/done.length,0):'—',hits.length+' aciertos de '+done.length)}${st('Picks publicados',PUB.length,(PUB.length-done.length)+' pendientes')}${st('Rendimiento',wo.length?(profit>=0?'+':'−')+Math.abs(profit/wo.length).toFixed(0)+'%':'—',wo.length?'por pick con cuota':'sin cuotas registradas')}</div>`
   +PUB.slice(0,30).map(p=>{const d=new Date(p.ts);return`<div class="hrow"><span style="color:var(--t3)">${d.getDate()} ${MON[d.getMonth()]}</span><div><b>${esc(p.pick)}</b><div style="font-size:11px;color:var(--t3)">${esc(p.home)} vs ${esc(p.away)} · ${esc(p.league)}</div></div><span class="num" style="color:var(--t2);font-weight:700">${pct(p.prob,0)}${p.odd?' · @'+p.odd.toFixed(2):''}</span><span class="res ${p.status==='acierto'?'ok':p.status==='fallo'?'no':'pe'}">${p.status==='acierto'?'✓ GANÓ':p.status==='fallo'?'✗ PERDIÓ':'PENDIENTE'}</span></div>`;}).join('');
}
async function delPick(id){try{await pickCol().doc(id).delete();}catch(e){toast('No se pudo borrar');}}
function renderMyPicks(){
  const el=$('myPicks');
  if(!DB||!UID){el.innerHTML='<p class="note" style="margin:0;font-size:14px">Para guardar tus picks y medir tu récord, abre esta página con tu sesión de Claude iniciada.</p>';return;}
  if(!PICKS.length){el.innerHTML='<p class="note" style="margin:0;font-size:14px">Aún no guardas picks. Toca <b>+ Pick</b> en cualquier pick o mercado; después marca si acertó y aquí verás tu récord contra lo que esperaba el modelo.</p>';return;}
  const done=PICKS.filter(p=>p.status!=='pendiente'),hits=done.filter(p=>p.status==='acierto'),exp=done.reduce((s,p)=>s+p.prob,0),wo=done.filter(p=>p.odd),profit=wo.reduce((s,p)=>s+(p.status==='acierto'?(p.odd-1)*100:-100),0);
  const st=(l,v,s)=>`<div class="k"><div class="l">${l}</div><div class="v num">${v}</div><div class="s">${s}</div></div>`;
  el.innerHTML=`<div class="kp">${st('Resueltos',done.length,(PICKS.length-done.length)+' pendientes')}${st('Aciertos',done.length?pct(hits.length/done.length,0):'—',hits.length+' de '+done.length)}${st('El modelo esperaba',done.length?exp.toFixed(1):'—','aciertos')}${st('Con cuotas',wo.length?(profit>=0?'+$':'−$')+Math.abs(profit).toFixed(0):'—',wo.length?'apostando $100 c/u':'guarda picks con cuota')}</div>
  <table><thead><tr><th>Fecha</th><th>Partido</th><th>Pick</th><th class="n">Prob.</th><th class="n">Cuota</th><th>Resultado</th><th></th></tr></thead><tbody>${PICKS.map(p=>{const d=new Date(p.ts);return`<tr><td style="color:var(--t3);white-space:nowrap">${d.getDate()} ${MON[d.getMonth()]}</td><td>${esc(p.home)} vs ${esc(p.away)}<div style="font-size:11px;color:var(--t3)">${esc(p.league)}</div></td><td><b>${esc(p.pick)}</b></td><td class="n num">${pct(p.prob,0)}</td><td class="n num">${p.odd?p.odd.toFixed(2):'—'}</td><td>${p.status==='pendiente'?`<button class="btn sm" data-s="acierto" data-id="${p.id}">✓ Acertó</button> <button class="btn sm" data-s="fallo" data-id="${p.id}">✗ Falló</button>`:p.status==='acierto'?'<span class="pill good">Acierto</span>':'<span class="pill bad">Fallo</span>'}</td><td style="text-align:right;white-space:nowrap">${ISOWNER?`<button class="btn sm" data-pub="${p.id}">${PUBIDS.has(p.id)?'Publicado ✓':'Publicar'}</button> `:''}<button class="btn sm" data-del="${p.id}">×</button></td></tr>`;}).join('')}</tbody></table>`;
  el.querySelectorAll('[data-s]').forEach(b=>b.onclick=()=>setStatus(b.dataset.id,b.dataset.s));el.querySelectorAll('[data-del]').forEach(b=>b.onclick=()=>delPick(b.dataset.del));el.querySelectorAll('[data-pub]').forEach(b=>b.onclick=()=>togglePub(PICKS.find(p=>p.id===b.dataset.pub)));
}
async function initCaps(){
  const c=window.claude;if(!c||!c.use){renderMyPicks();renderPub();return;}
  c.use('sample').then(s=>{if(s){SAMPLE=s;$('aiBtn').classList.remove('hidden');}}).catch(()=>{});
  c.use('downloads').then(d=>{DL=d||null;}).catch(()=>{});
  try{const[db,user]=await Promise.all([c.use('db'),c.use('user')]);
    if(user){try{ISOWNER=!!(await Promise.resolve(user.isOwner()));}catch(e){}}
    if(db){DB=db;db.collection('historial').orderBy('ts','desc').limit(200).onSnapshot(snap=>{PUB=snap.docs.map(d=>({id:d.id,...d.data()}));PUBIDS=new Set(PUB.map(p=>p.id));renderPub();renderMyPicks();},()=>renderPub());}
    if(db&&user){UID=await user.id();if(UID){DB=db;const tm=setTimeout(()=>{if(!PICKS.length)$('myPicks').innerHTML='<p class="note" style="margin:0">No se pudieron cargar tus picks todavía.</p>';},10000);
      pickCol().orderBy('ts','desc').limit(300).onSnapshot(snap=>{clearTimeout(tm);PICKS=snap.docs.map(d=>({id:d.id,...d.data()})).filter(p=>p.kind==='pick');renderMyPicks();},()=>{clearTimeout(tm);DB=null;renderMyPicks();});}}}catch(e){}
  renderMyPicks();renderPub();
}

/* ============ CSV ============ */
$('csvGo').onclick=()=>{
  const T={};let gh=0,ga=0,n=0;
  for(const ln of $('csv').value.split(/\r?\n/)){const p=ln.split(/[,;\t]/).map(x=>x.trim());if(p.length<4)continue;const a=parseInt(p[2]),b=parseInt(p[3]);if(isNaN(a)||isNaN(b))continue;
    for(const t of[p[0],p[1]])T[t]=T[t]||{gf:0,ga:0,gp:0,w:0,d:0,l:0};T[p[0]].gf+=a;T[p[0]].ga+=b;T[p[0]].gp++;T[p[1]].gf+=b;T[p[1]].ga+=a;T[p[1]].gp++;
    if(a>b){T[p[0]].w++;T[p[1]].l++;}else if(a<b){T[p[1]].w++;T[p[0]].l++;}else{T[p[0]].d++;T[p[1]].d++;}gh+=a;ga+=b;n++;}
  if(n<3||Object.keys(T).length<2){$('csvMsg').textContent='No encontré suficientes partidos. Formato: Local,Visitante,GolesLocal,GolesVisitante';return;}
  const avg=(gh+ga)/(2*n),K=3,pal=['#00E6A8','#3B82F6','#FF7A00','#D4AF37','#E5484D','#8B5CF6','#14B8A6','#F4F4F4'];
  const teams=Object.entries(T).map(([k,v])=>({n:k,ab:k.replace(/[^A-Za-zÁÉÍÓÚÑáéíóúñ ]/g,'').split(' ').filter(Boolean).map(w=>w[0]).join('').slice(0,3).toUpperCase()||k.slice(0,3).toUpperCase(),c:[pal[hash(k)%8],pal[(hash(k)+3)%8]],w:v.w,d:v.d,l:v.l,pts:3*v.w+v.d,gp:v.gp,gf:v.gf,ga:v.ga,
    x:(v.gf+avg*K)/((v.gp+K)*avg),y:(v.ga+avg*K)/((v.gp+K)*avg),form:0})).sort((a,b)=>b.pts-a.pts||(b.gf-b.ga)-(a.gf-a.ga));
  teams.forEach((t,i)=>t.pos=i+1);DATA.fut.mis={name:'Mis datos',country:'CSV',h:gh/n,a:ga/n,coef:.9,src:'tus resultados',teams};
  $('csvMsg').textContent=`Listo: ${n} partidos, ${teams.length} equipos.`;
  if(SPORT!=='fut'){SPORT='fut';document.querySelectorAll('#sports button').forEach(x=>x.classList.toggle('on',x.dataset.s==='fut'));document.querySelectorAll('#sportsM button').forEach(x=>x.classList.toggle('on',x.dataset.sm==='fut'));}
  LEAGUE='mis';INTL=false;S.H={lg:'mis',i:0,ctx:{},adj:0};S.A={lg:'mis',i:1,ctx:{},adj:0};FIXTURE=null;renderPicker();renderUpcoming();
  document.getElementById('choose').scrollIntoView();
};

/* ============ PRESENTACIÓN ============ */
let INTRO=true,POTD=null,CDT=null;
function introOn(){INTRO=true;liveIdle(SPORT);SND.stop();$('final').classList.remove('on');$('intro').classList.remove('off');$('stage').classList.add('intro-on');$('envivo').classList.add('intro-on');$('cPlay').textContent='❚❚';LIVE.paused=false;renderPotd();$('menu').classList.remove('open');window.scrollTo({top:0,behavior:'smooth'});}
function introOff(){if(!INTRO)return;INTRO=false;$('intro').classList.add('off');$('stage').classList.remove('intro-on');$('envivo').classList.remove('intro-on');LIVE.speed=1;document.querySelectorAll('.ctrl [data-sp]').forEach(x=>x.classList.toggle('on',x.dataset.sp==='1'));setTimeout(liveResize,50);}
$('introPlay').onclick=()=>{featured();renderPicker();runSim(true);};
if($('introPick'))$('introPick').onclick=()=>{goTo('choose');};$('introHoy').onclick=()=>goTo('hoy');$('introPar').onclick=()=>goTo('parlays');
function kickUTC(t){const[d,h]=t.split(' ');const[y,m,dd]=d.split('-').map(Number);const[hh,mm]=h.split(':').map(Number);return Date.UTC(y,m-1,dd,hh+6,mm);}
function quickProbs(sp,lgk,hi,ai){
  const save={sp:SPORT,H:S.H,A:S.A,n:$('neutral').checked};let r=null;
  try{SPORT=sp;S.H={lg:lgk,i:hi,ctx:{},adj:0};S.A={lg:lgk,i:ai,ctx:{},adj:0};$('neutral').checked=false;
    if(sp==='fut'||sp==='nat'){const P=params(),M=scoreMatrix(P.lh,P.la);let h=0,d=0,w=0;M.forEach((row,i)=>row.forEach((v,j)=>{if(i>j)h+=v;else if(i===j)d+=v;else w+=v;}));r={pH:h,pD:d,pA:w,H:P.H,A:P.A};}
    else{const R=simulate(6000,null);r={pH:R.pH,pD:R.pD,pA:R.pA,H:R.H,A:R.A};}}
  finally{SPORT=save.sp;S.H=save.H;S.A=save.A;$('neutral').checked=save.n;}
  return r;
}
function computePotd(){
  const sp=SPORT,now=Date.now(),c=[];
  const lgs=sp==='fut'?Object.keys(DATA.fut).filter(k=>DATA.upcoming[k]):[sp];
  for(const k of lgs)for(const g of(DATA.upcoming[k]||[])){const t=kickUTC(g.t);if(t>now-2*3600e3)c.push([k,g,t]);}
  if(!c.length){const L=DATA[sp][sp]||DATA[sp][Object.keys(DATA[sp])[0]];const k=sp==='fut'?LEAGUE:sp;const r=quickProbs(sp,k,0,1);if(!r)return null;const side=r.pH>=r.pA?'H':'A';return{...r,side,p:Math.max(r.pH,r.pA),k,sp,hi:0,ai:1,g:null,t:null,feat:true};}
  const first=Math.min(...c.map(x=>x[2]));let best=null;
  for(const[k,g,t]of c){if(t>first+4*86400e3)continue;const L=DATA[sp][k],hi=L.teams.findIndex(x=>x.ab===g.h),ai=L.teams.findIndex(x=>x.ab===g.a);if(hi<0||ai<0)continue;
    const r=quickProbs(sp,k,hi,ai);if(MARKET&&g.ph!=null){const W=sp==='fut'?FUT_WM:.5;r.pH=W*r.pH+(1-W)*g.ph/100;r.pD=W*r.pD+(1-W)*(g.pd||0)/100;r.pA=W*r.pA+(1-W)*g.pa/100;}const side=r.pH>=r.pA?'H':'A',p=Math.max(r.pH,r.pA);if(!best||p>best.p)best={...r,side,p,t,k,g,sp,hi,ai};}
  return best;
}
function renderPotd(){
  const el=$('potd');clearInterval(CDT);POTD=computePotd();if(!POTD){el.innerHTML='';return;}
  const P=POTD,win=P.side==='H'?P.H:P.A,lg=DATA[P.sp][P.k].name;
  el.innerHTML=`<div class="potd"><div class="crs">${crest(P.H,46,P.sp)}${crest(P.A,46,P.sp)}</div><div><div class="lab">🔥 ${P.feat?'PARTIDO DESTACADO':'PICK DEL DÍA'}</div><div class="pk2">Gana ${esc(short(win.n))} <span>${pct(P.p,0)}</span></div><div class="mt">${esc(P.H.n)} vs ${esc(P.A.n)} · ${esc(lg)}${P.g?' · '+fdate(P.g.t):''}</div><div class="cd" id="cd"></div></div><div class="acts"><button class="btn menta sm" id="potdGo">▶ Simular</button><button class="share" id="potdSh">📸 Compartir</button></div></div>`;
  $('potdGo').onclick=()=>{if(P.sp==='fut'){LEAGUE=P.k;INTL=false;}S.H={lg:P.k,i:P.hi,ctx:{},adj:0};S.A={lg:P.k,i:P.ai,ctx:{},adj:0};FIXTURE=P.g;$('neutral').checked=false;renderPicker();renderUpcoming();runSim(true);};
  $('potdSh').onclick=()=>openShare({kicker:P.feat?'PARTIDO DESTACADO':'PICK DEL DÍA',H:P.H,A:P.A,sp:P.sp,pick:'Gana '+win.n,prob:P.p,probs:[P.pH,P.pD,P.pA],meta:lg+(P.g?' · '+fdate(P.g.t):'')});
  if(P.t){const upd=()=>{const e=$('cd');if(!e){clearInterval(CDT);return;}const ms=P.t-Date.now();if(ms<=0){e.textContent='● En juego o por empezar';return;}
    const d=Math.floor(ms/864e5),h=Math.floor(ms%864e5/36e5),m=Math.floor(ms%36e5/6e4),s=Math.floor(ms%6e4/1e3);e.textContent=`⏱ Empieza en ${d?d+'d ':''}${h}h ${String(m).padStart(2,'0')}m ${String(s).padStart(2,'0')}s`;};upd();CDT=setInterval(upd,1000);}
}

/* ============ TARJETA PARA REDES ============ */
const svgImg=svg=>new Promise(res=>{const i=new Image();i.onload=()=>res(i);i.onerror=()=>res(null);i.src='data:image/svg+xml;charset=utf-8,'+encodeURIComponent(svg);});
let LOGOI=null;const logoImg=()=>LOGOI?Promise.resolve(LOGOI):new Promise(res=>{const i=new Image();i.onload=()=>{LOGOI=i;res(i);};i.onerror=()=>res(null);i.src='logo.png';});
async function makeCard(o){
  try{await document.fonts.ready;}catch(e){}
  const W=1080,H=1350,c=document.createElement('canvas');c.width=W;c.height=H;const g=c.getContext('2d');
  g.fillStyle='#0B0B0B';g.fillRect(0,0,W,H);
  let gr=g.createRadialGradient(W/2,180,20,W/2,180,700);gr.addColorStop(0,'rgba(0,230,168,.22)');gr.addColorStop(1,'rgba(0,230,168,0)');g.fillStyle=gr;g.fillRect(0,0,W,H);
  gr=g.createRadialGradient(W/2,H,20,W/2,H,700);gr.addColorStop(0,'rgba(59,130,246,.14)');gr.addColorStop(1,'rgba(59,130,246,0)');g.fillStyle=gr;g.fillRect(0,0,W,H);
  g.strokeStyle='rgba(255,255,255,.035)';g.lineWidth=2;for(let x=-H;x<W;x+=46){g.beginPath();g.moveTo(x,H);g.lineTo(x+H,0);g.stroke();}
  g.strokeStyle='rgba(0,230,168,.55)';g.lineWidth=3;g.strokeRect(34,34,W-68,H-68);
  const lg=await logoImg();if(lg){const w=430,h=w*lg.height/lg.width;g.drawImage(lg,(W-w)/2,82,w,h);}
  g.textAlign='center';g.textBaseline='alphabetic';
  const ls=(px,w=900)=>`${w} ${px}px "League Spartan", sans-serif`,mo=(px,w=800)=>`${w} ${px}px Montserrat, sans-serif`;
  g.font=ls(34,800);g.fillStyle=o.kc||'#D4AF37';try{g.letterSpacing='10px';}catch(e){}g.fillText(o.kicker,W/2,330);try{g.letterSpacing='0px';}catch(e){}
  g.strokeStyle=o.kc||'#D4AF37';g.lineWidth=3;g.beginPath();g.moveTo(W/2-300,316);g.lineTo(W/2-250,316);g.moveTo(W/2+250,316);g.lineTo(W/2+300,316);g.stroke();
  const ch=await svgImg(crest(o.H,240,o.sp)),ca=await svgImg(crest(o.A,240,o.sp));
  if(ch)g.drawImage(ch,140,380,240,240);if(ca)g.drawImage(ca,W-380,380,240,240);
  g.font=ls(64);g.fillStyle='#3a3a3a';g.fillText('VS',W/2,520);
  g.font=mo(34);g.fillStyle='#F4F4F4';const fitT=(t,x,y,max)=>{let s=34;g.font=mo(s);while(g.measureText(t).width>max&&s>20){s-=2;g.font=mo(s);}g.fillText(t,x,y);};
  fitT(o.H.n,260,672,340);fitT(o.A.n,W-260,672,340);
  if(o.score){g.font=ls(200);g.fillStyle='#F4F4F4';g.fillText(o.score,W/2,920);g.font=mo(34,700);g.fillStyle=o.ok?'#00E6A8':'#FF7A00';g.fillText(o.line,W/2,1000);}
  else{let s=86;g.font=ls(s);while(g.measureText(o.pick.toUpperCase()).width>900&&s>44){s-=4;g.font=ls(s);}g.fillStyle='#F4F4F4';g.fillText(o.pick.toUpperCase(),W/2,800);
    g.font=ls(210);g.fillStyle='#00E6A8';g.shadowColor='rgba(0,230,168,.45)';g.shadowBlur=40;g.fillText(Math.round(o.prob*100)+'%',W/2,1010);g.shadowBlur=0;
    g.font=mo(30,600);g.fillStyle='#9CA3AF';g.fillText('de probabilidad en 50,000 simulaciones',W/2,1065);}
  if(o.probs){const x0=140,w=W-280,y=1110,hh=18,parts=[[o.probs[0],'#00E6A8'],[o.probs[1],'#9CA3AF'],[o.probs[2],'#3B82F6']].filter(p=>p[0]>.004);let x=x0;const tot=parts.reduce((s,p)=>s+p[0],0);
    for(const[p,c2]of parts){const pw=w*p/tot-4;g.fillStyle=c2;g.beginPath();g.roundRect?g.roundRect(x,y,pw,hh,9):g.rect(x,y,pw,hh);g.fill();x+=pw+6;}
    g.font=mo(26,700);g.textAlign='left';g.fillStyle='#00E6A8';g.fillText(short(o.H.n)+' '+pct(o.probs[0],0),x0,y+56);g.textAlign='right';g.fillStyle='#3B82F6';g.fillText(pct(o.probs[2],0)+' '+short(o.A.n),x0+w,y+56);
    if(o.probs[1]>.004){g.textAlign='center';g.fillStyle='#9CA3AF';g.fillText('Empate '+pct(o.probs[1],0),W/2,y+56);}g.textAlign='center';}
  g.font=mo(26,600);g.fillStyle='#8a8f98';g.fillText(o.meta||'',W/2,1238);
  g.font=mo(22,600);g.fillStyle='#5f646c';g.fillText('El Bicho Picks · Pronósticos con datos · +18 Juega responsable',W/2,1282);
  return c;
}
let DL=null;
async function openShare(o){
  const m=$('shModal'),body=$('shBody');body.innerHTML='<p class="note">Creando tarjeta…</p>';m.classList.add('on');
  const c=await makeCard(o),url=c.toDataURL('image/png');
  const cap=o.score?`⚽ Resultado simulado: ${o.H.n} ${o.score} ${o.A.n}. ${o.line} · El Bicho Picks · +18`:`🔥 ${o.kicker}: ${o.pick} (${pct(o.prob,0)}) — ${o.H.n} vs ${o.A.n}. 50,000 simulaciones de El Bicho Picks. +18 Juega responsable.`;
  body.innerHTML=`<img class="shimg" src="${url}" alt="Tarjeta del pick"><div class="shbtns">${DL?'<button class="btn menta" id="shDl">⬇ Descargar imagen</button>':''}<button class="btn" id="shCp">Copiar texto para la publicación</button></div><p class="note" style="text-align:center">${DL?'':'Mantén presionada la imagen (o clic derecho) para guardarla. '}Formato 4:5, ideal para Instagram y WhatsApp.</p>`;
  if(DL)$('shDl').onclick=()=>c.toBlob(async b=>{try{await DL.save({filename:'bicho-pick.png',data:b});toast('Imagen lista ✓');}catch(e){if(e&&e.code!=='declined')toast('No se pudo descargar; mantén presionada la imagen');}},'image/png');
  $('shCp').onclick=async()=>{try{await navigator.clipboard.writeText(cap);toast('Texto copiado ✓');}catch(e){toast('No se pudo copiar');}};
}
$('shClose').onclick=()=>$('shModal').classList.remove('on');
$('shModal').onclick=e=>{if(e.target.id==='shModal')$('shModal').classList.remove('on');};
function shareResult(){const R=LAST;if(!R)return;const o=[['H',R.pH],['A',R.pA]];if(R.sport==='fut')o.push(['D',R.pD]);o.sort((a,b)=>b[1]-a[1]);const k=o[0][0],w=k==='H'?R.H.n:k==='A'?R.A.n:null;
  openShare({kicker:'PICK DEL BICHO',H:R.H,A:R.A,sp:R.sport,pick:w?'Gana '+w:'Empate',prob:o[0][1],probs:[R.pH,R.pD,R.pA],meta:(R.fx?fdate(R.fx.t)+' · ':'')+(R.sport==='fut'?(INTL?'Internacional':lgOf('H').name):R.sport.toUpperCase())});}
$('shareRes').onclick=shareResult;

/* ============ FINAL DEL PARTIDO ============ */
function showFinal(L){
  const R=LAST;if(!R||!L)return;const d=L.s[0].pts-L.s[1].pts,res=d>0?'H':d<0?'A':'D';
  const o=[['H',R.pH],['A',R.pA]];if(R.sport==='fut')o.push(['D',R.pD]);o.sort((a,b)=>b[1]-a[1]);const mp=o[0],ok=mp[0]===res;
  const pk=mp[0]==='D'?'Empate':'Gana '+(mp[0]==='H'?R.H.n:R.A.n),score=L.s[0].pts+' - '+L.s[1].pts;
  $('final').innerHTML=`<div class="fbox"><div class="k">FINAL · PARTIDO SIMULADO</div><div class="row">${crest(R.H,76)}<div class="scr num">${score}</div>${crest(R.A,76)}</div>
    <div class="verd ${ok?'ok':'no'}">${ok?'✓ Se cumplió el pick':'✗ Esta vez no salió el pick'}: ${esc(pk)} (${pct(mp[1],0)})</div>
    <div class="btns"><button class="btn menta" id="fAgain">↻ Jugar otra vez</button><button class="share" id="fShare" style="padding:9px 14px">📸 Compartir</button><button class="btn" id="fAn">Ver análisis</button></div>
    <p class="note" style="margin-top:12px">Este fue un solo partido; el pick se basa en las 50,000 simulaciones.</p></div>`;
  $('final').classList.add('on');
  $('fAgain').onclick=()=>startLiveMatch();
  $('fShare').onclick=()=>openShare({kicker:'RESULTADO SIMULADO',kc:'#00E6A8',H:R.H,A:R.A,sp:R.sport,score,ok,line:(ok?'✓ Se cumplió el pick: ':'✗ No salió el pick: ')+pk,probs:[R.pH,R.pD,R.pA],meta:'Un partido simulado por El Bicho Picks'});
  $('fAn').onclick=()=>goTo('analysis');
}

/* ============ SONIDO (opcional, apagado por defecto) ============ */
const SND={on:false,ctx:null,gain:null,
  init(){if(this.ctx)return;const C=window.AudioContext||window.webkitAudioContext;if(!C)return;this.ctx=new C();const sr=this.ctx.sampleRate,len=sr*3,buf=this.ctx.createBuffer(1,len,sr),d=buf.getChannelData(0);let b=0;for(let i=0;i<len;i++){b=.985*b+.015*(Math.random()*2-1);d[i]=b*6;}
    const src=this.ctx.createBufferSource();src.buffer=buf;src.loop=true;const f=this.ctx.createBiquadFilter();f.type='bandpass';f.frequency.value=650;f.Q.value=.5;this.gain=this.ctx.createGain();this.gain.gain.value=0;src.connect(f);f.connect(this.gain);this.gain.connect(this.ctx.destination);src.start();},
  toggle(){this.on=!this.on;if(this.on){this.init();if(!this.ctx){this.on=false;return;}this.ctx.resume();this.base();}else this.stop();$('cSnd').textContent=this.on?'🔊':'🔇';},
  base(){if(!this.ctx||!this.on)return;const t=this.ctx.currentTime,g=this.gain.gain;g.cancelScheduledValues(t);g.setTargetAtTime(LV&&!LIVE.paused&&!INTRO&&!LV.done?.09:0,t,.3);},
  swell(a,dur){if(!this.ctx||!this.on)return;const t=this.ctx.currentTime,g=this.gain.gain;g.cancelScheduledValues(t);g.setTargetAtTime(a,t,.08);g.setTargetAtTime(LV&&!LV.done?.09:0,t+dur,.6);},
  tone(f,dur,type='sine',vol=.12,when=0){if(!this.ctx||!this.on)return;const o=this.ctx.createOscillator(),gg=this.ctx.createGain(),t=this.ctx.currentTime+when;o.type=type;o.frequency.value=f;gg.gain.setValueAtTime(0,t);gg.gain.linearRampToValueAtTime(vol,t+.01);gg.gain.setTargetAtTime(0,t+dur,.03);o.connect(gg);gg.connect(this.ctx.destination);o.start(t);o.stop(t+dur+.4);},
  whistle(n=1){for(let i=0;i<n;i++){const L=i===n-1?.6:.2;this.tone(2900,L,'sine',.10,i*.32);this.tone(3180,L,'sine',.05,i*.32);}},
  stop(){if(this.gain&&this.ctx){const t=this.ctx.currentTime;this.gain.gain.cancelScheduledValues(t);this.gain.gain.setTargetAtTime(0,t,.2);}}
};
$('cSnd').onclick=()=>SND.toggle();
function sfx(k){if(!SND.on)return;const sp=LV?LV.sport:SPORT;
  if(k==='start'){SND.base();if(sp==='nba')SND.tone(220,.5,'sawtooth',.06);else SND.whistle(1);}
  else if(k==='big'){SND.swell(.6,2.8);if(sp==='nfl'){SND.tone(523,.18,'triangle',.07);SND.tone(659,.18,'triangle',.07,.2);SND.tone(784,.4,'triangle',.07,.4);}}
  else if(k==='small')SND.swell(.22,.7);
  else if(k==='final'){SND.swell(.3,1.2);if(sp==='nba')SND.tone(196,.9,'sawtooth',.08);else SND.whistle(3);}}

/* ============ MENÚ ============ */
function goTo(id){const _e=$(id);if(_e){const d=_e.closest('details');if(d)d.open=true;}if(id==='top')window.scrollTo({top:0,behavior:'smooth'});else{const e=$(id);if(e)e.scrollIntoView({behavior:'smooth',block:'start'});}$('menu').classList.remove('open');}
document.querySelectorAll('[data-go]').forEach(a=>a.onclick=e=>{e.preventDefault();goTo(a.dataset.go);});
$('logoTop').onclick=e=>{e.preventDefault();introOn();};
$('burger').onclick=()=>$('menu').classList.toggle('open');
window.addEventListener('scroll',()=>{document.querySelector('header').classList.toggle('scrolled',scrollY>10);
  const ids=['envivo','hoy','parlays','gana','choose','torneos','cuotas','metodo','planes','mispicks'];let cur='envivo';for(const id of ids){const e=$(id);if(e&&e.getBoundingClientRect().top<140)cur=id;}
  document.querySelectorAll('#menu a').forEach(a=>a.classList.toggle('on',(a.dataset.go===cur||((cur==='envivo'||cur==='gana'||cur==='choose')&&a.dataset.go==='top'))));},{passive:true});


/* ============ CONFIANZA Y RÉCORD ============ */
const argmax=p=>p.indexOf(Math.max(...p));
const RES_I={H:0,D:1,A:2};
function tname(lg,ab){const L=lg==='nfl'?DATA.nfl.nfl:DATA.fut[lg];const t=L&&L.teams.find(x=>x.ab===ab);return t?t.n:ab;}
function trackStats(){
  const T=DATA.track||[],done=T.filter(e=>e.res),hit=e=>argmax(e.p)===RES_I[e.res];
  const f=done.filter(e=>e.lg!=='nfl'),n=done.filter(e=>e.lg==='nfl'),sr=T.filter(e=>e.sr&&e.sr[0]!=null);
  const srAgree=sr.filter(e=>{const s=[e.sr[0],e.sr[1]||0,e.sr[2]];return argmax(e.p)===argmax(s);}).length;
  return{done:done.length,fH:f.filter(hit).length,fN:f.length,nH:n.filter(hit).length,nN:n.length,srA:srAgree,srN:sr.length,test:T.filter(e=>e.test).length,pend:T.filter(e=>!e.res).length};
}
function renderTrust(){
  const s=trackStats(),tile=(v,suf,l,sub)=>`<div class="tile"><div class="v num" data-to="${v}" data-suf="${suf}">0${suf}</div><div class="l">${l}</div><div class="s">${sub}</div></div>`;
  $('tiles').innerHTML=tile(s.done,'','Pronósticos verificados',`${s.pend} más en espera de resultado`)
    +tile(s.fN?Math.round(s.fH/s.fN*100):0,'%','Acierto en fútbol',`${s.fH} de ${s.fN} partidos`)
    +tile(s.nN?Math.round(s.nH/s.nN*100):0,'%','Acierto en NFL',`${s.nH} de ${s.nN} partidos`)
    +tile(s.srN?Math.round(s.srA/s.srN*100):0,'%','Coincide con SportRadar',`mismo favorito en ${s.srA} de ${s.srN}`);
  $('tnote').innerHTML=`Récord público y automático: cada pronóstico se guarda <b>antes</b> del partido y se compara con el resultado real. Incluye ${s.test} partidos de prueba (8 al 16 nov 2026) evaluados sin usar sus resultados. <a href="#metodo" data-go="metodo" style="color:var(--menta)">Ver el récord completo →</a>`;
  $('tnote').querySelector('[data-go]').onclick=e=>{e.preventDefault();goTo('metodo');};
  const[y,m,d]=DATA.updated.split('-').map(Number);$('bdgUpd').innerHTML=`<i>↻</i>Actualizado: ${d} ${MON[m-1]} ${y}`;
  renderRecord('all');
}
let RECN=10;
function renderRecord(f){
  const T=(DATA.track||[]).filter(e=>e.res&&(f==='all'||(f==='nfl'?e.lg==='nfl':e.lg!=='nfl')));
  $('recf').innerHTML=[['all','Todos'],['fut','Fútbol'],['nfl','NFL']].map(([k,l])=>`<button class="lg ${k===f?'on':''}" data-f="${k}">${l}</button>`).join('');
  $('recf').querySelectorAll('[data-f]').forEach(b=>b.onclick=()=>renderRecord(b.dataset.f));
  const rows=T.slice(0,RECN).map(e=>{const i=argmax(e.p),ok=i===RES_I[e.res],pk=i===1?'Empate':'Gana '+short(tname(e.lg,i===0?e.h:e.a)),lgName=e.lg==='nfl'?'NFL':DATA.fut[e.lg]?DATA.fut[e.lg].name:e.lg,[y,m,d]=e.t.slice(0,10).split('-').map(Number);
    return`<div class="rec"><span style="color:var(--t3)">${d} ${MON[m-1]}</span><div><b>${esc(tname(e.lg,e.h))} ${e.sc||''} ${esc(tname(e.lg,e.a))}</b><div style="font-size:11px;color:var(--t3)">${esc(lgName)}${e.test?' · prueba':''}</div></div><span class="hide-m" style="color:var(--t2)">${esc(pk)} · ${pct(e.p[i],0)}</span><span class="${ok?'ok':'no'}">${ok?'✓ ACIERTO':'✗ FALLO'}</span></div>`;}).join('');
  $('recList').innerHTML=(rows||'<p class="note">Aún no hay resultados en esta categoría.</p>')+(T.length>RECN?`<div style="text-align:center;margin-top:14px"><button class="ghost" id="recMore">Ver todos (${T.length})</button></div>`:'');
  if($('recMore'))$('recMore').onclick=()=>{RECN=999;renderRecord(f);};
}

/* ============ PLANES ============ */
// Para activar los pagos, pega aquí el enlace de pago (Mercado Pago, Stripe, etc.) de cada plan.
const PLANS=[
  {n:'Gratis',p:'$0',per:'para siempre',f:['Simulador de 50,000 partidos','Pick del día','Partido en vivo','Récord público verificado'],x:['Picks VIP diarios','Alertas por WhatsApp o Telegram'],cta:'Empezar gratis',free:true},
  {n:'VIP',hot:true,p:'$199',per:'MXN / mes',f:['Todo lo del plan Gratis','3 picks VIP diarios con análisis','Comparación de tus cuotas con el pronóstico','Alertas por WhatsApp o Telegram','Estadísticas completas de tu récord'],cta:'Quiero ser VIP',link:''},
  {n:'VIP Anual',gold:true,p:'$1,790',per:'MXN / año · ahorra 25%',f:['Todo lo del plan VIP','2 meses gratis','Grupo privado El Bicho','Acceso anticipado a nuevas ligas'],cta:'Suscripción anual',link:''}];
function renderPlans(){
  $('plans').innerHTML=PLANS.map((p,i)=>`<div class="plan ${p.hot?'hot':''} ${p.gold?'gold':''}">${p.hot?'<span class="tagp">MÁS POPULAR</span>':''}<h4>${p.n}</h4><div class="pr">${p.p} <small>${p.per}</small></div>
    <ul>${p.f.map(x=>`<li>${x}</li>`).join('')}${(p.x||[]).map(x=>`<li class="x" style="color:var(--t3)">${x}</li>`).join('')}</ul>
    ${p.link?`<a class="${p.hot?'cta':'btn'}" href="${esc(p.link)}" target="_blank" rel="noopener" style="text-decoration:none;display:block">${p.cta}</a>`:`<button class="${p.hot?'cta':'btn'}" data-plan="${i}">${p.cta}</button>`}</div>`).join('')
    +`<p class="note" style="grid-column:1/-1;text-align:center">Pagos seguros. Puedes cancelar cuando quieras. +18 · Juega responsable.</p>`;
  $('plans').querySelectorAll('[data-plan]').forEach(b=>b.onclick=()=>{const p=PLANS[+b.dataset.plan];if(p.free)goTo('choose');else toast('Las suscripciones abren muy pronto 🔥');});
}

/* ============ TRANSICIONES ============ */
const IO=new IntersectionObserver(es=>es.forEach(e=>{if(!e.isIntersecting)return;const el=e.target;el.classList.add('in');IO.unobserve(el);
  el.querySelectorAll('[data-to]').forEach(n=>{if(n.closest('#big3'))return;countUp(n,+n.dataset.to,0,n.dataset.suf||'');});}),{threshold:.12,rootMargin:'0px 0px -40px 0px'});
let RVT=null;
function reveal(){document.querySelectorAll('#app .sec,#app .card,#app .bigc,#app .bigd,#app .pk,#app .step3,#app .plan,#app .tile,#app .faq details,#app .builder,#app .fx,#app .trust,#app .leagues').forEach((el,i)=>{if(el.dataset.rv)return;el.dataset.rv=1;el.classList.add('rv');el.style.setProperty('--d',((i%4)*0.07)+'s');IO.observe(el);});}
new MutationObserver(()=>{clearTimeout(RVT);RVT=setTimeout(reveal,30);}).observe(document.getElementById('app'),{childList:true,subtree:true});
window.addEventListener('scroll',()=>{const h=document.documentElement;$('prog').style.width=(h.scrollTop/(h.scrollHeight-h.clientHeight)*100)+'%';},{passive:true});

/* ============ ARRANQUE ============ */
fetch('data.json',{cache:'no-store'}).then(r=>r.json()).then(d=>{
  DATA=d;$('boot').classList.add('hidden');$('app').classList.remove('hidden');
  const[y,m,dd]=d.updated.split('-').map(Number);
  $('srcInfo').innerHTML=`Tablas, goles y próximos partidos al <b>${dd} ${MON[m-1]} ${y}</b> (se actualizan cada mañana). Fuentes: SportRadar (Premier, LaLiga, Serie A, Bundesliga, Ligue 1, NBA, NFL y grupos del Mundial 2026), futboltotal.futbol (goles, local/visitante y forma; Liga MX) y World Football Elo Ratings (selecciones, consultado el ${DATA.nat.nat.elo_date}). Escudos: diseño propio con los colores de cada equipo.
  <details style="margin-top:12px"><summary style="cursor:pointer;font-weight:700">Metodología y limitaciones</summary><ul style="color:var(--t2);font-size:13px;line-height:1.7;margin:10px 0 0">
  <li><b>Clubes:</b> modelo de Poisson con ajuste Dixon-Coles para marcadores bajos. La fuerza de ataque y defensa sale de los goles de esta temporada combinados con el nivel de la anterior. Cuando hay probabilidad publicada por SportRadar, el pronóstico final combina 25% modelo y 75% mercado. Ese peso salió de probar el modelo contra 6,215 partidos reales de 8 ligas (2024–2026): el mercado por sí solo acierta más que nuestro modelo, así que le damos más peso.</li>
  <li><b>Selecciones:</b> el rating Elo se convierte en goles esperados con un modelo ajustado para reproducir la curva de Elo. Todavía no se valida con resultados históricos.</li>
  <li><b>NBA y NFL:</b> modelos basados en el récord de la temporada; la diferencia de puntos aún no está disponible.</li>
  <li><b>No incluidos todavía:</b> xG, datos de jugadores, lesiones, sanciones, alineaciones y modelos de machine learning. Requieren proveedores de datos con licencia y varios años de historial para entrenarlos y validarlos.</li>
  <li><b>Pruebas:</b> 868 pruebas matemáticas automáticas sin fallas. Validación con 70 partidos reales fuera de muestra (ver Récord).</li></ul></details>`;
  setupHooks();liveMount($('cv'));featured();renderPicker();runSim(false);renderPotd();renderTrust();renderEval();renderRankings();renderTourney();renderOdds();renderLineups();if(typeof initHoy==='function')initHoy();renderPlans();initCaps();reveal();
}).catch(e=>{console.error(e);$('boot').textContent='No se pudieron cargar los datos. Recarga la página.';});

document.querySelectorAll('#sportsM button').forEach(b=>b.onclick=()=>{const t=document.querySelector('#sports button[data-s="'+b.dataset.sm+'"]');if(t)t.click();});

/* Móvil: secciones técnicas plegadas */
[['howCard','📊 Ver cómo se calculó'],['evalBox','📈 Ver métricas y pruebas del modelo']].forEach(([id,l])=>{const e=document.getElementById(id);if(!e)return;e.classList.add('mcol');const b=document.createElement('button');b.className='mtog';b.textContent=l;b.onclick=()=>{const o=e.classList.toggle('mopen');b.textContent=o?'Ocultar':l;};e.parentNode.insertBefore(b,e);});
