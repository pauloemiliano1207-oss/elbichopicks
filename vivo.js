/* ============ EN VIVO, LOGOS, POR QUÉ Y CALIFICACIÓN AL INSTANTE ============
   Marcadores y escudos: marcador público de ESPN (se consulta desde tu navegador, sin claves).
   Si ESPN no responde, la página funciona igual sin estos extras. */
window.VIVO=(function(){
const PATH={'Premier League':'soccer/eng.1','LaLiga':'soccer/esp.1','Serie A':'soccer/ita.1','Bundesliga':'soccer/ger.1','Ligue 1':'soccer/fra.1','Liga MX':'soccer/mex.1','Champions League':'soccer/uefa.champions','UEFA Nations League':'soccer/uefa.nations','NBA':'basketball/nba','NFL':'football/nfl'};
const SB={},ST={},LOGO={};let busy=false,timer=null;
const norm=s=>(s||'').normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase().replace(/[^a-z0-9 ]/g,' ').split(/\s+/).filter(t=>t&&!['fc','cf','ac','afc','sc','sv','club','de','the','and','cd','ud','ssc','as','rc'].includes(t));
const sim=(a,b)=>{const A=new Set(norm(a)),B=new Set(norm(b));let n=0;A.forEach(t=>{if(B.has(t))n++;});return n/Math.max(1,new Set([...A,...B]).size);};
const ymd=t=>{const d=new Date(t);return`${d.getFullYear()}${String(d.getMonth()+1).padStart(2,'0')}${String(d.getDate()).padStart(2,'0')}`;};
function fetchSB(lg,day,force){const k=lg+'|'+day,c=SB[k];if(c&&!force&&(c.p||Date.now()-c.at<(c.live?55e3:15*60e3)))return c.p||Promise.resolve(c.evs);
  const p=fetch(`https://site.api.espn.com/apis/site/v2/sports/${PATH[lg]}/scoreboard?dates=${day}`).then(r=>r.json()).then(j=>{const evs=j.events||[];SB[k]={at:Date.now(),evs,live:evs.some(x=>x.status&&x.status.type&&x.status.type.state==='in')};return evs;}).catch(()=>{SB[k]={at:Date.now(),evs:[]};return[];});
  SB[k]={...(c||{}),p,at:Date.now()};return p.then(v=>{delete SB[k].p;return v;});}
function apply(e,evs){const t=new Date(e.t).getTime();let best=null;
  for(const x of evs){const c=x.competitions&&x.competitions[0];if(!c)continue;const dt=Math.abs(new Date(x.date).getTime()-t);if(dt>3*3600e3)continue;
    const H=c.competitors.find(z=>z.homeAway==='home'),A=c.competitors.find(z=>z.homeAway==='away');if(!H||!A)continue;
    const s=sim(e.h,H.team.displayName)+sim(e.a,A.team.displayName)+0.5*(sim(e.h,H.team.shortDisplayName)+sim(e.a,A.team.shortDisplayName))-dt/36e5*0.2;
    if(s>0.45&&(!best||s>best.s))best={s,x,c,H,A};}
  if(!best)return;const{x,H,A}=best,ty=x.status.type;
  if(H.team.logo)LOGO[e.h]=H.team.logo;if(A.team.logo)LOGO[e.a]=A.team.logo;
  const goals1t=(best.c.details||[]).filter(d=>d.scoringPlay&&parseInt(((d.clock||{}).displayValue)||'99')<=45).length;
  ST[e.id]={st:ty.state,det:ty.shortDetail||'',clock:x.status.displayClock,per:x.status.period,hs:+H.score||0,as:+A.score||0,h1:best.c.details?goals1t:null,done:!!ty.completed};}
async function ensure(list){if(busy)return false;busy=true;let changed=false;
  try{const need={};list.forEach(e=>{if(PATH[e.lg])(need[e.lg+'|'+ymd(e.t)]=need[e.lg+'|'+ymd(e.t)]||[]).push(e);});
    await Promise.all(Object.entries(need).map(async([k,es])=>{const[lg,day]=k.split('|');const before=JSON.stringify(es.map(e=>ST[e.id])),lb=Object.keys(LOGO).length;
      const evs=await fetchSB(lg,day);es.forEach(e=>apply(e,evs));if(JSON.stringify(es.map(e=>ST[e.id]))!==before||Object.keys(LOGO).length!==lb)changed=true;}));}
  finally{busy=false;}return changed;}
/* calificación instantánea de la jugada (misma lógica que el historial) */
function grade(k,h,a,hs,as_,s){const W=c=>c?'win':'loss',tot=hs+as_;let m;
  if(k==='Empate')return W(hs===as_);if(k==='Gana cualquiera (no empate)')return W(hs!==as_);
  if(k.startsWith('Gana ')){const t=k.slice(5);return t===h?W(hs>as_):t===a?W(as_>hs):null;}
  if((m=k.match(/^(.*) o empate$/)))return m[1]===h?W(hs>=as_):m[1]===a?W(as_>=hs):null;
  if((m=k.match(/^(.*) \(empate devuelve\)$/))){if(hs===as_)return'push';return m[1]===h?W(hs>as_):W(as_>hs);}
  if(/1er tiempo/.test(k)){if(s.h1==null)return null;const g=s.h1;return k==='Gol en el 1er tiempo'?W(g>=1):k==='1er tiempo sin goles'?W(g===0):/Más de 1.5/.test(k)?W(g>=2):null;}
  if((m=k.match(/^(Más|Menos) de ([\d.]+) (goles|puntos)/))){const L=+m[2];if(tot===L)return'push';return m[1]==='Más'?W(tot>L):W(tot<L);}
  if(k==='Ambos anotan: sí')return W(hs>0&&as_>0);if(k==='Ambos anotan: no')return W(hs===0||as_===0);
  if((m=k.match(/^(.*) (anota|mete 2 o más)$/))){const g=m[1]===h?hs:m[1]===a?as_:null;if(g==null)return null;return m[2]==='anota'?W(g>=1):W(g>=2);}
  if((m=k.match(/^(.*) ([−+-])([\d.]+)$/))){const d=m[1]===h?hs-as_:m[1]===a?as_-hs:null;if(d==null)return null;const v='−-'.includes(m[2])?d-+m[3]:d+ +m[3];return v===0?'push':W(v>0);}
  return null;}
/* escudo: logo de ESPN o círculo con iniciales y color fijo por equipo */
function badge(n){if(LOGO[n])return`<img class="tl" src="${LOGO[n]}" alt="" loading="lazy">`;
  let h=0;for(const c of n)h=(h*31+c.charCodeAt(0))%360;const ini=norm(n).slice(-2).map(w=>w[0]).join('').toUpperCase()||n[0];
  return`<span class="tl ti" style="background:hsl(${h} 45% 30%)">${ini.slice(0,2)}</span>`;}
/* por qué: una línea que explica la jugada con los números del partido */
function why(e,x){if(!x)return'';const k=x.k,f=x.fam,P=Math.round(x.p*100);let m;
  if(e.sp==='fut'&&e.xg){const[gh,ga]=e.xg,T=(gh+ga).toFixed(1),xg=`${e.h} ${gh.toFixed(1)} – ${ga.toFixed(1)} ${e.a}`;
    if(f==='tot')return`Se esperan ${T} goles en total${e.line!=null?` (las casas ponen ${e.line})`:''}.`;
    if(f==='1t')return`Se esperan ${((gh+ga)*(e.lg==='Bundesliga'?.467:.445)).toFixed(1)} goles en el 1er tiempo.`;
    if(f==='team'&&(m=k.match(/^(.*) (anota|mete 2 o más)$/))){const g=m[1]===e.h?gh:ga;return`${m[1]} espera ${g.toFixed(1)} goles en este partido.`;}
    if(f==='btts')return`Goles esperados: ${xg}.`;
    if(f==='dc'&&(m=k.match(/^(.*) o empate$/)))return`${m[1]} solo pierde ${100-P}% de las veces.`;
    if(f==='hc'&&(m=k.match(/^(.*) ([−+-])([\d.]+)$/)))return m[2]==='+'?`${m[1]} solo falla si pierde por ${Math.ceil(+m[3])} o más goles.`:`${m[1]} necesita ganar por ${Math.ceil(+m[3])} o más. Goles esperados: ${xg}.`;
    return`Goles esperados: ${xg}.`;}
  if(e.margin!=null){const fav=e.margin>=0?e.h:e.a,mg=Math.abs(e.margin).toFixed(1),u=e.sp==='nba'?'puntos':'puntos';
    if(f==='hc'&&(m=k.match(/^(.*) ([−+-])([\d.]+)$/)))return m[2]==='+'?`Se espera que ${fav} gane por ${mg}; ${m[1]} solo falla si pierde por más de ${m[3]}.`:`Se espera que ${fav} gane por ${mg}; necesita ganar por más de ${m[3]}.`;
    if(f==='tot')return`Las casas esperan ${e.line} ${u} en total.`;
    if(f==='res')return`Margen esperado: ${fav} por ${mg} ${u}.`;}
  if(f==='prop')return'Según su temporada, el rival y el partido esperado.';
  return'';}
/* estado para la fila de Hoy */
function rowState(e){return ST[e.id]||null;}
function startPoll(cb){if(timer)return;timer=setInterval(()=>{if(document.hidden||document.body.dataset.view!=='hoy')return;
  const live=Object.keys(SB).filter(k=>SB[k].live);if(!live.length)return;Promise.all(live.map(k=>{const[lg,d]=k.split('|');return fetchSB(lg,d,true);})).then(()=>cb&&cb());},60e3);}
return{ensure,grade,badge,why,rowState,startPoll,LOGO,ST,apply,fetchSB};
})();
