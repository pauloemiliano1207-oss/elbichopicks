/* =====================================================================
   El Bicho Picks · Motor del partido en vivo
   - La lógica del partido avanza por minutos (goles, tiros, puntos…)
   - Un "director" convierte los eventos de cada minuto en jugadas
     animadas (pases, tiros, rebotes, series ofensivas) a 60 fps.
   ===================================================================== */
const LIVE={cv:null,ctx:null,W:1050,H:680,dpr:1,k:1,speed:1,paused:false,raf:0,last:0,time:0,bg:null,hooks:{},parts:[],trail:[],shake:0};
let LV=null;
const MD={fut:2600,nba:9000,nfl:6500};           // ms por minuto de juego a 1x
const DIM={fut:[1050,680],nba:[940,500],nfl:[1200,533]};
const clamp=(v,a,b)=>v<a?a:v>b?b:v, lerp=(a,b,t)=>a+(b-a)*t;
const ease=t=>t<.5?2*t*t:1-Math.pow(-2*t+2,2)/2;
const pickR=a=>a[Math.floor(Math.random()*a.length)];
const NS=()=>({pts:0,shots:0,sot:0,corn:0,yel:0,red:0,pos:0,fga:0,fgm:0,tpa:0,tpm:0,reb:0,ast:0,to:0,yds:0,fd:0,top:0});

/* ---------------- arranque / control ---------------- */
function liveMount(canvas){LIVE.cv=canvas;LIVE.ctx=canvas.getContext('2d');window.addEventListener('resize',liveResize);if(!LIVE.raf)LIVE.raf=requestAnimationFrame(frame);}
function liveResize(){
  const cv=LIVE.cv;if(!cv)return;const w=cv.parentElement.clientWidth;const[W,H]=[LIVE.W,LIVE.H];
  LIVE.dpr=Math.min(2,window.devicePixelRatio||1);LIVE.k=w/W;
  cv.width=Math.round(w*LIVE.dpr);cv.height=Math.round(w*H/W*LIVE.dpr);cv.style.height=(w*H/W)+'px';
  LIVE.bg=buildBg(LV?LV.sport:(LIVE.sport||'fut'));
}
function liveIdle(sp){if(sp==='nat')sp='fut';LV=null;LIVE.sport=sp;const[W,H]=DIM[sp];LIVE.W=W;LIVE.H=H;LIVE.parts=[];LIVE.trail=[];liveResize();}
function liveStart(P,sport,kits){
  LIVE.sport=sport;const[W,H]=DIM[sport];LIVE.W=W;LIVE.H=H;LIVE.parts=[];LIVE.trail=[];
  LV={P,sport,kits,min:0,t:0,md:MD[sport],end:sport==='fut'?90:sport==='nba'?48:60,s:[NS(),NS()],disp:[0,0],wp:[],log:[],pend:[],done:false,possH:50,ot:0,ev:null,q:[],act:null,pl:null,ball:{x:W/2,y:H/2,h:0},pt:0,car:null};
  if(sport==='fut'){LV.end+=1+Math.floor(Math.random()*4);futInit();}
  else if(sport==='nba')nbaInit();
  else{LV.poss=Math.random()<.5?0:1;LV.dH=nflDrive(P.eh);LV.dA=nflDrive(P.ea);newDrive();nflInit();}
  liveResize();LIVE.paused=false;
  addLog(0,'Arranca el partido.');pushWP();LIVE.hooks.sfx&&LIVE.hooks.sfx('start');LIVE.hooks.minute&&LIVE.hooks.minute(LV);LIVE.hooks.score&&LIVE.hooks.score(LV.disp,-1);
}
function liveSkip(){if(!LV||LV.done)return;while(!LV.done)tick();LV.q=[];LV.act=null;flushPend();LV.disp=[LV.s[0].pts,LV.s[1].pts];LIVE.hooks.score(LV.disp,-1);LIVE.hooks.minute(LV);LIVE.hooks.banner('FINAL','#F4F4F4',true);LIVE.hooks.end&&LIVE.hooks.end(LV);}
function startMinute(){
  flushPend();
  if(LV.disp[0]!==LV.s[0].pts||LV.disp[1]!==LV.s[1].pts){LV.disp=[LV.s[0].pts,LV.s[1].pts];LIVE.hooks.score(LV.disp,-1);}
  if(LV.done)return;
  tick();LIVE.hooks.minute(LV);
  if(LV.sport==='fut')futPlan();else if(LV.sport==='nba')nbaPlan();else nflPlan();
  if(LV.done)LV.q.push({dur:600,end(){LIVE.hooks.banner('FINAL','#F4F4F4',true);LIVE.hooks.end&&LIVE.hooks.end(LV);}});
}
function frame(ts){
  LIVE.raf=requestAnimationFrame(frame);
  const dt=Math.min(50,ts-(LIVE.last||ts));LIVE.last=ts;
  if(LV&&!LIVE.paused){
    const g=dt*LIVE.speed,gs=g/1000;LIVE.time+=g;
    const fut=LV.sport==='fut',busy=fut&&LV.F.pend;
    if(fut&&LV.F.pend&&LV.F.pend.t>LV.md/1000*4)LV.F.pend=null; // seguro anti-atasco
    if(!LV.done||LV.q.length||LV.act){
      LV.t+=g;
      if(LV.t>=LV.md&&!LV.q.length&&!LV.act&&!LV.done&&!busy){LV.t=0;startMinute();}
    }
    runActions(g);
    if(fut)futUpdate(gs);else if(LV.sport==='nba')nbaTargets();else nflTargets();
    movePlayers(gs);
    if(LIVE.shake>0)LIVE.shake-=dt;
  }
  updParts(dt);draw();
}
function runActions(g){
  let left=g;
  while(left>0){
    if(!LV.act){if(!LV.q.length)break;LV.act=LV.q.shift();LV.act.el=0;LV.act.start&&LV.act.start();}
    const a=LV.act,need=a.dur-a.el,use=Math.min(need,left);a.el+=use;left-=use;
    a.upd&&a.upd(Math.min(1,a.el/a.dur));
    if(a.el>=a.dur){a.end&&a.end();LV.act=null;}
  }
}
function movePlayers(dt){
  if(!LV.pl||dt<=0)return;const def=LV.sport==='nba'?260:LV.sport==='nfl'?230:SPD.jog,acc=(LV.sport==='fut'?430:560)*dt,b=LV.ball;
  for(const team of LV.pl)for(const p of team){
    const dx=p.tx-p.x,dy=p.ty-p.y,d=Math.hypot(dx,dy),mx=p.max||def,want=Math.min(mx,d*2.6);
    const dvx=(d>.5?dx/d*want:0)-(p.vx||0),dvy=(d>.5?dy/d*want:0)-(p.vy||0),dv=Math.hypot(dvx,dvy);
    if(dv>acc){p.vx=(p.vx||0)+dvx/dv*acc;p.vy=(p.vy||0)+dvy/dv*acc;}else{p.vx=(p.vx||0)+dvx;p.vy=(p.vy||0)+dvy;}
    p.x+=p.vx*dt;p.y+=p.vy*dt;const sp=Math.hypot(p.vx,p.vy);p.st=(p.st||0)+sp*dt*.12;
    const ta=sp>14?Math.atan2(p.vy,p.vx):Math.atan2(b.y-p.y,b.x-p.x);let da=ta-(p.a||0);da=Math.atan2(Math.sin(da),Math.cos(da));p.a=(p.a||0)+da*Math.min(1,dt*7);}
  // separación entre compañeros
  for(const team of LV.pl)for(let i=0;i<team.length;i++)for(let j=i+1;j<team.length;j++){const p=team[i],q=team[j],dx=q.x-p.x,dy=q.y-p.y,d=Math.hypot(dx,dy);if(d>0&&d<22){const f=(22-d)*.5;p.x-=dx/d*f;p.y-=dy/d*f;q.x+=dx/d*f;q.y+=dy/d*f;}}
}
function addLog(m,t){LV.log.unshift({m,t});}
function flushPend(){while(LV.pend.length){const p=LV.pend.shift();addLog(p.m,p.t);LIVE.hooks.ticker&&LIVE.hooks.ticker(p.t);}}
function popPend(){const p=LV.pend.shift();if(p){addLog(p.m,p.t);LIVE.hooks.ticker&&LIVE.hooks.ticker(p.t);}}
const tn=i=>i===0?LV.P.H.n:LV.P.A.n;
function bright(team){const[a,b]=LV.kits[team];return lum(a)>.38?a:lum(b)>.38?b:'#F4F4F4';}
function scored(team,pts,label,big){LV.disp[team]+=pts;LIVE.hooks.score(LV.disp,team);if(label)LIVE.hooks.banner(label,bright(team),big);if(big){confetti(team);LIVE.shake=350;}LIVE.hooks.sfx&&LIVE.hooks.sfx(big?'big':'small');popPend();}

/* ---------------- LÓGICA (por minuto) ---------------- */
function tick(){
  const L=LV,s=L.s;L.min++;L.ev=null;
  if(L.sport==='fut'){
    const lam=[L.P.lh,L.P.la].map((l,i)=>l*Math.pow(.72,s[i].red)*Math.pow(1.25,s[1-i].red));
    const base=50+16*(lam[0]-lam[1])/(lam[0]+lam[1]);L.possH=L.possH*.85+(base+normal()*8)*.15;s[0].pos+=L.possH;s[1].pos+=100-L.possH;
    L.ev={type:'play',team:Math.random()*100<L.possH?0:1};
    for(let i=0;i<2;i++){
      const att=Math.sqrt(lam[i]/1.35);
      if(Math.random()<lam[i]/90){s[i].pts++;s[i].shots++;s[i].sot++;L.ev={type:'goal',team:i};L.pend.push({m:L.min,t:`<b>⚽ ¡GOL de ${esc(tn(i))}!</b> ${s[0].pts}-${s[1].pts}`});}
      else if(Math.random()<12*att/90){s[i].shots++;const on=Math.random()<.33;if(on)s[i].sot++;if(L.ev.type==='play'||L.ev.type==='corner')L.ev={type:on?'save':'shot',team:i};}
      if(Math.random()<5*att/90){s[i].corn++;if(L.ev.type==='play')L.ev={type:'corner',team:i};}
      if(Math.random()<2/90){s[i].yel++;addLog(L.min,`🟨 Amarilla para ${esc(tn(i))}.`);LIVE.hooks.ticker(`🟨 Amarilla para ${esc(tn(i))}`);
        if(Math.random()<.04){s[i].red++;addLog(L.min,`🟥 <b>¡Expulsado uno de ${esc(tn(i))}!</b>`);LIVE.hooks.banner('ROJA','#ff4d4d',false);}}
      else if(Math.random()<.06/90){s[i].red++;addLog(L.min,`🟥 <b>Roja directa para ${esc(tn(i))}.</b>`);LIVE.hooks.banner('ROJA','#ff4d4d',false);}
    }
    if(L.min===45){L.pend.push({m:45,t:'Medio tiempo: '+s[0].pts+'-'+s[1].pts});}
    if(L.min>=L.end){L.done=true;L.pend.push({m:L.min,t:`<b>Final: ${esc(tn(0))} ${s[0].pts} - ${s[1].pts} ${esc(tn(1))}</b>`});}
  }else if(L.sport==='nba'){
    const mus=[L.P.mh,L.P.ma],lists=[[],[]];
    for(let i=0;i<2;i++){const k=(mus[i]/100)/0.9745,np=poisson(2.08);
      for(let j=0;j<np;j++){
        if(Math.random()<.12){s[i].to++;lists[i].push({team:i,k:'to'});continue;}
        if(Math.random()<.08){const ft=(Math.random()<.78)+(Math.random()<.78);s[i].pts+=ft;lists[i].push({team:i,k:'ft',pts:ft});continue;}
        if(Math.random()<.40){s[i].fga++;s[i].tpa++;if(Math.random()<.36*k){s[i].fgm++;s[i].tpm++;s[i].pts+=3;lists[i].push({team:i,k:'3',pts:3});if(Math.random()<.6)s[i].ast++;}else{const o=Math.random()<.28;if(o)s[i].reb++;else s[1-i].reb++;lists[i].push({team:i,k:'m3',oreb:o});}}
        else{s[i].fga++;if(Math.random()<.53*k){s[i].fgm++;s[i].pts+=2;lists[i].push({team:i,k:'2',pts:2});if(Math.random()<.6)s[i].ast++;}else{const o=Math.random()<.28;if(o)s[i].reb++;else s[1-i].reb++;lists[i].push({team:i,k:'m2',oreb:o});}}
      }}
    // intercalar posesiones de ambos equipos
    L.plays=[];let a=0,b=0,turn=L.pt;while(a<lists[0].length||b<lists[1].length){if(turn===0&&a<lists[0].length)L.plays.push(lists[0][a++]);else if(turn===1&&b<lists[1].length)L.plays.push(lists[1][b++]);turn=1-turn;}
    if(L.min%12===0&&L.min<=48)L.pend.push({m:L.min,t:`Fin del ${['1er','2º','3er','4º'][L.min/12-1]} cuarto: ${s[0].pts}-${s[1].pts}`});
    if(L.min>=L.end){if(s[0].pts===s[1].pts){L.end+=5;L.ot++;L.pend.push({m:L.min,t:`<b>¡Empate! Tiempo extra ${L.ot}.</b>`});}else{L.done=true;L.pend.push({m:L.min,t:`<b>Final: ${esc(tn(0))} ${s[0].pts} - ${s[1].pts} ${esc(tn(1))}</b>`});}}
  }else{
    const D=L.drive,from=D.pos;s[D.team].top++;D.left--;D.pos=Math.min(D.out==='td'?100:99,D.pos+D.ypm);s[D.team].yds+=D.ypm;
    let end=null,pts=0;const team=D.team;
    if(D.left<=0){const i=D.team;s[i].fd+=Math.round(D.yards/17);end=D.out;
      if(D.out==='td'){const x=Math.random();pts=x<.05?6:x<.08?8:7;s[i].pts+=pts;L.pend.push({m:L.min,t:`<b>🏈 ¡Touchdown de ${esc(tn(i))}!</b> Serie de ${D.yards} yardas. ${s[0].pts}-${s[1].pts}`});}
      else if(D.out==='fg'){pts=3;s[i].pts+=3;L.pend.push({m:L.min,t:`Gol de campo de ${esc(tn(i))} (${Math.round(117-D.pos)} yardas). ${s[0].pts}-${s[1].pts}`});}
      else if(D.out==='to'){s[i].to++;L.pend.push({m:L.min,t:`${Math.random()<.5?'Intercepción':'Balón suelto'}: ${esc(tn(i))} pierde el balón.`});}
      else{L.pend.push({m:L.min,t:`${esc(tn(i))} despeja tras ${D.yards} yardas.`});}
      L.poss=1-i;newDrive();}
    L.nflMin={team,from,to:end?(end==='td'?100:Math.min(97,from+Math.max(3,D.ypm))):D.pos,end,pts};
    if(L.min===30)L.pend.push({m:30,t:'Medio tiempo: '+s[0].pts+'-'+s[1].pts});
    if(L.min>=L.end){
      if(s[0].pts===s[1].pts&&!L.ot){L.ot=1;const[h,a]=nflOT(s[0].pts,s[1].pts,L.P.eh,L.P.ea);L.pend.push({m:L.min,t:'<b>Empate: tiempo extra.</b> '+(h>s[0].pts?esc(tn(0))+' anota.':a>s[1].pts?esc(tn(1))+' anota.':'Nadie anota.')});s[0].pts=h;s[1].pts=a;}
      L.done=true;L.pend.push({m:L.min,t:`<b>Final: ${esc(tn(0))} ${s[0].pts} - ${s[1].pts} ${esc(tn(1))}</b>`});}
  }
  pushWP();
}
function newDrive(){
  const i=LV.poss,d=i===0?LV.dH:LV.dA,r=Math.random(),out=r<d.pTD?'td':r<d.pTD+d.pFG?'fg':Math.random()<.12?'to':'punt';
  const start=20+Math.floor(Math.random()*15);
  const yards=out==='td'?100-start:out==='fg'?Math.min(70,40+Math.floor(Math.random()*25)):Math.floor(Math.random()*40);
  const left=Math.max(1,Math.round(out==='td'||out==='fg'?2+Math.random()*3.5:1+Math.random()*2.5));
  LV.drive={team:i,out,yards,left,ypm:yards/left,pos:start,start};
}
function winNow(){
  const L=LV,s=L.s,N=4000;if(L.done){const d=s[0].pts-s[1].pts;return d>0?[1,0,0]:d<0?[0,0,1]:[0,1,0];}
  let w=0,d=0,l=0;
  if(L.sport==='fut'){const rem=Math.max(0,L.end-L.min)/90,lam=[L.P.lh,L.P.la].map((x,i)=>x*Math.pow(.72,s[i].red)*Math.pow(1.25,s[1-i].red)*rem);
    for(let k=0;k<N;k++){const a=s[0].pts+poisson(lam[0]),b=s[1].pts+poisson(lam[1]);if(a>b)w++;else if(a===b)d++;else l++;}}
  else if(L.sport==='nba'){const rem=Math.max(0,L.end-L.min)/48;for(let k=0;k<N;k++){const a=s[0].pts+L.P.mh*rem+normal()*12*Math.sqrt(rem),b=s[1].pts+L.P.ma*rem+normal()*12*Math.sqrt(rem);if(a>b)w++;else l++;}return[w/N,0,l/N];}
  else{const rem=Math.max(0,L.end-L.min),dr=rem/2.75;
    for(let k=0;k<N;k++){let a=s[0].pts,b=s[1].pts,p=L.poss;const n=Math.floor(dr)+(Math.random()<dr%1?1:0);
      for(let j=0;j<n;j++){const dd=p===0?L.dH:L.dA,r=Math.random(),pts=r<dd.pTD?7:r<dd.pTD+dd.pFG?3:0;if(p===0)a+=pts;else b+=pts;p=1-p;}
      if(a===b)[a,b]=nflOT(a,b,L.P.eh,L.P.ea);if(a>b)w++;else if(a===b)d++;else l++;}}
  return[w/N,d/N,l/N];
}
function pushWP(){LV.wp.push([LV.min,...winNow()]);}

/* ================= FÚTBOL (posesión continua con física) ================= */
const FB_BASE=[[50,340],[235,105],[205,262],[205,418],[235,575],[385,190],[365,340],[385,490],[545,130],[580,340],[545,550]];
const fdir=k=>k===0?1:-1;
const SPD={walk:40,jog:78,run:128,sprint:182};
const SKIN=['#f1c9a5','#d8a47f','#b77b55','#8d5a3b','#5e3a26','#e7b896'];
const GOALY=[303,377];
function futInit(){
  LV.pl=[0,1].map(k=>FB_BASE.map(([x,y],i)=>{const kx=Math.min(505,30+x*.85),X=k?1050-kx:kx;
    return{x:X,y,vx:0,vy:0,tx:X,ty:y,max:SPD.jog,ph:Math.random()*6,i,k,a:k?Math.PI:0,st:Math.random()*6,skin:SKIN[(i*5+k*3)%SKIN.length]};}));
  LV.ball={x:525,y:340,h:0,vx:0,vy:0,vz:0,spin:0};
  LV.F={pt:Math.random()<.5?0:1,car:null,mode:'kickoff',timer:1.2,pend:null,hold:1,recv:null,cel:null,pass:null};
  const F=LV.F;F.car=9;const c=LV.pl[F.pt][9];c.x=c.tx=F.pt?540:510;c.y=c.ty=340;
}
const mate=(k,i)=>LV.pl[k][i];
function car(){const F=LV.F;return F.car==null?null:LV.pl[F.pt][F.car];}
const attX=(k,x)=>(x-525)*fdir(k);           // cuánto ha avanzado k hacia la portería rival
const goalLineX=k=>k===0?1030:20;            // línea de gol que ataca k
function futPlan(){
  const ev=LV.ev,F=LV.F;
  if(ev.type==='play'){F.pend=(ev.team!==F.pt&&Math.random()<.45)?{kind:'turn',team:ev.team,t:0}:null;}
  else F.pend={kind:ev.type,team:ev.team,t:0};
}
function kickBall(tx,ty,speed,loft){
  const b=LV.ball,dx=tx-b.x,dy=ty-b.y,d=Math.hypot(dx,dy)||1;
  // velocidad inicial para que, con rozamiento, el balón llegue a (tx,ty)
  const k=loft?0.25:1.05,T=Math.max(.35,d/speed);let v0=d*k/(1-Math.exp(-k*T));
  b.vx=dx/d*v0;b.vy=dy/d*v0;b.vz=loft?Math.min(420,180+d*.55):0;b.h=loft?1:0;
  LV.F.car=null;LIVE.trail=[];return T;
}
function passTo(k,j,lofted){
  const F=LV.F,r=mate(k,j),b=LV.ball,d=Math.hypot(r.x-b.x,r.y-b.y);
  // el receptor se desmarca: el pase va al espacio, un poco adelante
  const lead=Math.min(45,d*.12),tx=clamp(r.x+fdir(k)*lead,30,1020),ty=clamp(r.y+(r.vy||0)*.2,30,650);
  const T=kickBall(tx,ty,lofted?380:Math.max(230,Math.min(420,d*1.15)),lofted);
  F.mode='pass';F.recv={k,i:j,x:tx,y:ty};F.pass={t:0,T};
}
function choosePass(k,attack){
  const F=LV.F,c=car(),opp=LV.pl[1-k];let best=null,bs=-1e9;
  for(const p of LV.pl[k]){if(p===c)continue;if(p.i===0&&Math.random()<.85)continue;
    const d=Math.hypot(p.x-c.x,p.y-c.y);if(d<60||d>(attack?430:340))continue;
    const fw=attX(k,p.x)-attX(k,c.x),open=Math.min(...opp.map(o=>Math.hypot(o.x-p.x,o.y-p.y)));
    const sc=fw*(attack?1.1:.35)+Math.min(open,90)*1.4-d*.25+Math.random()*60;
    if(sc>bs){bs=sc;best=p;}}
  return best;
}
function startShot(k,kind){
  const F=LV.F,b=LV.ball,gx=goalLineX(k)+fdir(k)*14;let ty;
  if(kind==='goal')ty=GOALY[0]+8+Math.random()*(GOALY[1]-GOALY[0]-16);
  else if(kind==='save')ty=330+Math.random()*20;
  else ty=Math.random()<.5?GOALY[0]-15-Math.random()*45:GOALY[1]+15+Math.random()*45;
  const loft=kind==='shot'&&Math.random()<.4;
  kickBall(gx+fdir(k)*10,ty,760,false);if(loft){b.vz=160;b.h=1;}
  F.mode='shot';F.shot={k,kind,ty};LIVE.trail=[];
}
function tackleBy(p){const F=LV.F;F.pt=p.k;F.car=p.i;F.mode='play';F.hold=.6+Math.random()*.8;LV.ball.vx=LV.ball.vy=0;}
function futUpdate(dt){
  const F=LV.F,b=LV.ball,md=LV.md/1000;
  if(F.pend)F.pend.t+=dt;
  // ---------- balón ----------
  const c=car();
  const far=c&&(F.mode==='gk'||F.mode==='corner')&&Math.hypot(c.x-b.x,c.y-b.y)>16;
  if(c&&!far){const fx=Math.cos(c.a),fy=Math.sin(c.a),tx=c.x+fx*11,ty=c.y+fy*11,al=Math.min(1,dt*10);b.x+=(tx-b.x)*al;b.y+=(ty-b.y)*al;b.vx=c.vx;b.vy=c.vy;b.h=0;b.vz=0;}
  else if(!far){b.x+=b.vx*dt;b.y+=b.vy*dt;const fr=b.h>0?.25:1.05;const e=Math.exp(-fr*dt);b.vx*=e;b.vy*=e;
    if(b.h>0||b.vz>0){b.vz-=900*dt;b.h+=b.vz*dt;if(b.h<=0){b.h=0;b.vz=Math.abs(b.vz)>70?-b.vz*.32:0;if(b.vz>0)b.h=.1;}}}
  b.spin+=Math.hypot(b.vx,b.vy)*dt*.08;
  // ---------- balón fuera ----------
  if(!c&&(F.mode==='pass'||F.mode==='loose')&&(b.x<14||b.x>1036||b.y<14||b.y>666)){
    const k=1-F.pt,goalLine=b.x<14||b.x>1036;F.pt=k;F.recv=null;b.vx=b.vy=0;b.h=0;b.vz=0;
    if(goalLine&&((b.x<14&&k===0)||(b.x>1036&&k===1))){F.car=0;F.mode='gk';F.timer=1.3;b.x=k?960:90;b.y=340;const g=mate(k,0);g.x=b.x;g.y=b.y;}
    else{b.x=clamp(b.x,22,1028);b.y=clamp(b.y,20,660);const n=LV.pl[k].slice(1).sort((p,q)=>Math.hypot(p.x-b.x,p.y-b.y)-Math.hypot(q.x-b.x,q.y-b.y))[0];F.car=n.i;F.mode='gk';F.timer=1.1;}
    if(F.pend&&F.pend.kind==='turn'&&F.pend.team===k)F.pend=null;
  }
  // ---------- modos ----------
  if(F.mode==='kickoff'){F.timer-=dt;if(F.timer<=0){F.mode='play';const k=F.pt;passTo(k,6,false);}}
  else if(F.mode==='celebrate'){F.timer-=dt;if(F.timer<=0){F.cel=null;F.mode='kickoff';F.timer=1.6;F.pt=1-F.shot.k;F.car=9;b.x=525;b.y=340;b.vx=b.vy=0;b.h=0;
      const kk=LV.pl[F.pt][9];kk.x=F.pt?540:510;kk.y=340;}}
  else if(F.mode==='gk'){if(!far)F.timer-=dt;if(F.timer<=0){const k=F.pt,j=choosePass(k,false)||mate(k,2);F.mode='play';passTo(k,j.i,Math.random()<.4);}}
  else if(F.mode==='shot'){
    const S=F.shot,kp=mate(1-S.k,0),gl=goalLineX(S.k);
    // el portero se lanza hacia la trayectoria
    kp.tx=gl-fdir(S.k)*8;kp.ty=clamp(b.y+(b.vy/(Math.abs(b.vx)+1))*Math.abs(gl-b.x),GOALY[0]-18,GOALY[1]+18);kp.max=SPD.sprint*1.3;
    if(S.kind==='save'&&Math.hypot(kp.x-b.x,kp.y-b.y)<18){F.pt=1-S.k;F.car=0;F.mode='gk';F.timer=1.1;F.pend=null;LIVE.hooks.banner('¡ATAJADA!','#F4F4F4',false);LIVE.hooks.ticker('Gran atajada del portero de '+esc(tn(1-S.k)));}
    else if(fdir(S.k)*(b.x-gl)>0){
      if(S.kind==='goal'){b.vx*=.15;b.vy*=.15;b.vz=0;b.h=Math.min(b.h,20);b.x=gl+fdir(S.k)*clamp(Math.abs(b.x-gl),4,16);F.mode='celebrate';F.timer=3.2;F.cel={k:S.k,x:S.k?120:930,y:b.y<340?110:570};F.pend=null;scored(S.k,1,'¡GOL!',true);}
      else{F.pend=null;LIVE.hooks.ticker('Disparo desviado de '+esc(tn(S.k)));F.pt=1-S.k;F.car=0;F.mode='gk';F.timer=1.6;const g=mate(1-S.k,0);b.x=S.k?110:940;b.y=340+(Math.random()-.5)*60;b.vx=b.vy=0;b.h=0;g.x=b.x;g.y=b.y;}}
  }
  else if(F.mode==='pass'){
    F.pass.t+=dt;const r=F.recv,rp=mate(r.k,r.i);
    // intercepción: solo cuando el partido pide un cambio de posesión
    if(F.pend&&F.pend.team!==r.k&&F.pass.t>.15){const opp=LV.pl[1-r.k].slice(1);let best=null,bd=60;for(const o of opp){const d=Math.hypot(o.x-b.x,o.y-b.y);if(d<bd){bd=d;best=o;}}
      if(best){best.tx=b.x+b.vx*.25;best.ty=b.y+b.vy*.25;best.max=SPD.sprint;if(bd<15&&b.h<14){tackleBy(best);if(F.pend.kind==='turn')F.pend=null;}}}
    if(F.mode==='pass'){
      if(Math.hypot(rp.x-b.x,rp.y-b.y)<14&&b.h<16){F.pt=r.k;F.car=r.i;F.mode='play';F.recv=null;F.hold=.5+Math.random()*1.3;}
      else if(Math.hypot(b.vx,b.vy)<25&&b.h<=0){F.mode='loose';F.recv=null;}}
  }
  else if(F.mode==='loose'){
    let best=null,bd=1e9;for(const team of LV.pl)for(const p of team){if(p.i===0)continue;const d=Math.hypot(p.x-b.x,p.y-b.y);if(d<bd){bd=d;best=p;}}
    if(best&&bd<14){if(F.pend&&F.pend.team!==best.k&&F.pend.kind!=='turn'){/* el que debe atacar la recupera */const o=LV.pl[F.pend.team].slice(1).sort((p,q)=>Math.hypot(p.x-b.x,p.y-b.y)-Math.hypot(q.x-b.x,q.y-b.y))[0];tackleBy(o);}else{tackleBy(best);if(F.pend&&F.pend.kind==='turn'&&best.k===F.pend.team)F.pend=null;}}
  }
  else if(F.mode==='play'&&c){
    const k=F.pt,P=F.pend,att=P&&P.team===k&&P.kind!=='turn';
    // ¿hay que perder el balón?
    if(P&&P.team!==k){const pr=LV.pl[1-k].slice(1).sort((p,q)=>Math.hypot(p.x-c.x,p.y-c.y)-Math.hypot(q.x-c.x,q.y-c.y))[0];
      if(Math.hypot(pr.x-c.x,pr.y-c.y)<16||P.t>md*1.4){tackleBy(pr);if(P.kind==='turn')P.t=0,F.pend=null;else F.pend.t=Math.min(P.t,md*.4);}}
    else{
      F.hold-=dt;const zone=attX(k,c.x)>270&&Math.abs(c.y-340)<230;
      if(att&&(zone&&F.hold<.4||P.t>md*1.6)){startShot(k,P.kind==='corner'?'shot':P.kind);if(P.kind==='corner'){F.shot.corner=true;}}
      else if(F.hold<=0){const j=choosePass(k,att||Math.random()<.35);if(j)passTo(k,j.i,Math.hypot(j.x-c.x,j.y-c.y)>300&&Math.random()<.6);else F.hold=.5;}
    }
  }
  // tiro de esquina: el disparo desviado se convierte en córner
  if(F.mode==='gk'&&F.shot&&F.shot.corner&&!F.shot.cornerDone){F.shot.cornerDone=true;const k=F.shot.k;LIVE.hooks.ticker('Tiro de esquina para '+esc(tn(k)));
    F.pt=k;F.car=8;F.mode='corner';F.timer=1.6;b.x=k?24:1026;b.y=Math.random()<.5?26:654;const w=mate(k,8);w.x=b.x-fdir(k)*8;w.y=b.y;b.vx=b.vy=0;}
  if(F.mode==='corner'){if(!far)F.timer-=dt;if(F.timer<=0){F.mode='pass';const k=F.pt,r=mate(k,9);kickBall(k?95:955,320+Math.random()*40,330,true);F.recv={k,i:9,x:r.x,y:r.y};F.pass={t:0,T:1};F.pend={kind:'turn',team:1-k,t:md*2};}}
  futTargets(dt);
}
function futTargets(){
  const F=LV.F,b=LV.ball,T=LIVE.time,c=car();
  const reset=F.mode==='kickoff',cel=F.cel;
  for(let k=0;k<2;k++){const dir=fdir(k),att=F.pt===k,team=LV.pl[k];
    const push=reset?0:att?80:-30,shift=reset?0:clamp((b.x-525)*.6,-230,230),wid=att?1.08:.86;
    team.forEach((p,i)=>{const[bx,by]=FB_BASE[i];let tx,ty,mx=SPD.jog;
      if(reset){const kx=Math.min(505,30+bx*.85);tx=k?1050-kx:kx;ty=by;mx=SPD.run;}
      else if(i===0){const gl=k?1022:28;tx=gl+dir*clamp(Math.abs(b.x-gl)*.06,8,32);ty=clamp(340+(b.y-340)*.25,GOALY[0]-10,GOALY[1]+10);}
      else{tx=(k?1050-bx:bx)+dir*push+shift;ty=340+(by-340)*wid+(b.y-340)*.22;
        if(att&&i>=8&&F.mode==='play'){tx+=dir*(40+Math.sin(T*.0006+p.ph)*40);} // desmarques
        if(Math.hypot(tx-p.x,ty-p.y)>140)mx=SPD.run;}
      tx+=Math.sin(T*.0011+p.ph)*5;ty+=Math.cos(T*.0009+p.ph)*5;
      if(cel&&cel.k===k&&i>3){tx=cel.x-dir*(i*9)+Math.sin(i*3)*28;ty=cel.y+Math.cos(i*2)*34;mx=SPD.sprint;}
      if(cel&&cel.k!==k){mx=SPD.walk;}
      p.tx=clamp(tx,24,1026);p.ty=clamp(ty,24,656);p.max=mx;});}
  if(c&&F.mode==='play'){const dir=fdir(F.pt),space=Math.min(...LV.pl[1-F.pt].map(o=>Math.hypot(o.x-c.x-dir*40,o.y-c.y)));
    c.tx=clamp(c.x+dir*(space>70?70:25),30,1020);c.ty=clamp(c.y+(340-c.y)*.08,40,640);c.max=space>70?SPD.run:SPD.jog;}
  if(c&&(F.mode==='gk'||F.mode==='corner'||F.mode==='kickoff')){const fr=Math.hypot(c.x-b.x,c.y-b.y)>16;c.tx=fr?b.x:c.x;c.ty=fr?b.y:c.y;c.max=fr?SPD.run:SPD.walk;}
  if(F.mode==='pass'&&F.recv){const r=mate(F.recv.k,F.recv.i);const ex=b.x+b.vx*.35,ey=b.y+b.vy*.35;r.tx=lerp(F.recv.x,ex,.5);r.ty=lerp(F.recv.y,ey,.5);r.max=SPD.run;}
  if(F.mode==='loose'){for(const team of LV.pl){const n=team.slice(1).sort((p,q)=>Math.hypot(p.x-b.x,p.y-b.y)-Math.hypot(q.x-b.x,q.y-b.y))[0];n.tx=b.x;n.ty=b.y;n.max=SPD.sprint;}}
  // presión al portador
  if(c&&!reset&&!cel&&F.mode==='play'){const dk=1-F.pt,dd=fdir(dk),opp=LV.pl[dk].slice(1).map(p=>[p,Math.hypot(p.x-c.x,p.y-c.y)]).sort((a,q)=>a[1]-q[1]);
    const hunt=F.pend&&F.pend.team===dk;
    if(opp[0]){const p=opp[0][0],gap=hunt?0:22;p.tx=c.x-dd*-gap*0-dd*gap;p.ty=c.y;p.max=hunt?SPD.sprint:SPD.run;}
    if(opp[1]){const p=opp[1][0];p.tx=c.x-dd*75;p.ty=lerp(c.y,340,.35);p.max=SPD.run;}}
}

/* ================= NBA ================= */
const nbk=k=>k===0?870:70;   // canasta a la que ataca cada equipo
function nbaSpots(k){const b=nbk(k),d=k===0?1:-1;return[[b-d*245,95],[b-d*245,405],[b-d*275,250],[b-d*95,165],[b-d*95,335]];}
function nbaInit(){LV.pl=[0,1].map(k=>[0,1,2,3,4].map(i=>{const x=470+(k?60:-60)+(i-2)*14,y=110+i*70;return{x,y,tx:x,ty:y,ph:Math.random()*6,i,k,skin:SKIN[(i*5+k*3)%SKIN.length]};}));LV.pt=Math.random()<.5?0:1;LV.car=0;LV.up=1;LV.ball={x:470,y:250,h:0};}
function nbaTargets(){
  const T=LIVE.time;for(let k=0;k<2;k++){const off=k===LV.pt,team=LV.pl[k];
    if(off){const sp=nbaSpots(k),d=k===0?1:-1;team.forEach((p,i)=>{p.tx=sp[i][0]-d*LV.up*230+Math.sin(T*.002+p.ph)*12;p.ty=sp[i][1]+Math.cos(T*.0017+p.ph)*14;if(LV.post&&i===LV.post.i){p.tx=LV.post.x;p.ty=LV.post.y;}});}
  }
  const ok=LV.pt,dk=1-ok,b=nbk(ok);LV.pl[dk].forEach((p,i)=>{const o=LV.pl[ok][i];p.tx=o.x+(b-o.x)*.2;p.ty=o.y+(250-o.y)*.2;});
  if(LV.car!=null&&!LV.flying){const c=LV.pl[LV.pt][LV.car];LV.ball.x=c.x+(LV.pt===0?9:-9);LV.ball.y=c.y+4;LV.ball.h=Math.abs(Math.sin(T*.022))*7;}
}
function nbaPass(team,i,dur,steal){return{dur,start(){this.x0=LV.ball.x;this.y0=LV.ball.y;LV.flying=true;},upd(p){const r=LV.pl[team][i];LV.ball.x=lerp(this.x0,r.x,ease(p));LV.ball.y=lerp(this.y0,r.y,ease(p));LV.ball.h=10*4*p*(1-p);},end(){LV.flying=false;LV.pt=team;LV.car=i;if(steal&&Math.random()<.3){LIVE.hooks.banner('¡ROBO!',bright(team),false);}}};}
function nbaPlan(){
  const P=LV.plays,md=LV.md;if(!P.length){LV.q.push(waitAct(md,()=>{}));return;}
  const slot=Math.max(700,md/P.length);
  for(const pl of P){const k=pl.team,b=nbk(k),d=k===0?1:-1;
    if(k!==LV.pt||LV.up>0){LV.q.push({dur:slot*.32,start(){if(LV.pt!==k){LV.pt=k;LV.car=0;}this.u0=LV.up;},upd(p){LV.up=lerp(this.u0,0,ease(p));},end(){LV.up=0;}});}
    if(pl.k==='to'){LV.q.push(nbaPass(1-k,Math.floor(Math.random()*3),slot*.25,true));LV.q.push({dur:slot*.1,start(){LV.up=0;}});continue;}
    const shooter=pl.k==='3'||pl.k==='m3'?Math.floor(Math.random()*3):pl.k==='ft'?2:3+Math.floor(Math.random()*2);
    LV.q.push(nbaPass(k,shooter,slot*.18));
    if(pl.k==='2'||pl.k==='m2'){LV.q.push({dur:slot*.12,start(){LV.post={i:shooter,x:b-d*(40+Math.random()*60),y:200+Math.random()*100};}});}
    if(pl.k==='ft'){LV.q.push({dur:slot*.12,start(){LV.post={i:shooter,x:b-d*165,y:250};}});}
    const make=pl.k==='3'||pl.k==='2'||(pl.k==='ft'&&pl.pts>0);
    LV.q.push({dur:slot*.3,start(){this.x0=LV.ball.x;this.y0=LV.ball.y;LV.flying=true;LV.car=null;this.peak=pl.k[pl.k.length-1]==='3'?95:pl.k==='ft'?70:55;
        this.tx=b+(make?0:(Math.random()-.5)*26);this.ty=250+(make?0:(Math.random()-.5)*26);},
      upd(p){LV.ball.x=lerp(this.x0,this.tx,p);LV.ball.y=lerp(this.y0,this.ty,p);LV.ball.h=this.peak*4*p*(1-p);},
      end(){LV.flying=false;LV.post=null;
        if(make){const pts=pl.pts;scored(k,pts,pts===3?'+3':null,false);if(pts===3)LIVE.hooks.ticker(`🎯 Triple de ${esc(tn(k))}`);swish(b,250,k);}
        else{const reb=pl.oreb?k:1-k,i=3+Math.floor(Math.random()*2);LV.ball.x=b-d*(40+Math.random()*40);LV.ball.y=230+Math.random()*40;LV.pt=reb;LV.car=i;if(reb!==k)LV.up=0.0001;}}});
    if(make){LV.q.push({dur:slot*.08,start(){LV.pt=1-k;LV.car=0;LV.ball.x=b;LV.ball.y=250;LV.up=0.0001;}});}
  }
}

/* ================= NFL ================= */
const NX=(team,yd)=>team===0?100+yd*10:1100-yd*10;
const OFF=[[-8,226],[-8,246],[-8,266],[-8,286],[-8,306],[-9,330],[-8,80],[-8,452],[-22,392],[-34,266],[-68,266]];
const DEF=[[11,236],[11,256],[11,276],[11,296],[50,200],[50,266],[50,332],[26,80],[26,452],[120,182],[120,350]];
function nflInit(){LV.off=LV.drive.team;LV.los=LV.drive.pos;LV.pl=[0,1].map(k=>Array.from({length:11},(_,i)=>({x:600,y:266,tx:600,ty:266,ph:Math.random()*6,i,k})));nflFormation(true);LV.ball={x:NX(LV.off,LV.los),y:266,h:0};}
function nflFormation(snap){const o=LV.off,d=o===0?1:-1,X=NX(o,LV.los);
  LV.pl[o].forEach((p,i)=>{p.tx=X+d*OFF[i][0]*1;p.ty=OFF[i][1];if(snap){p.x=p.tx;p.y=p.ty;}});
  LV.pl[1-o].forEach((p,i)=>{p.tx=X+d*DEF[i][0];p.ty=DEF[i][1];if(snap){p.x=p.tx;p.y=p.ty;}});}
function nflTargets(){if(LV.mode!=='action'){nflFormation(false);if(!LV.flying&&LV.carP==null){LV.ball.x=lerp(LV.ball.x,NX(LV.off,LV.los)-(LV.off===0?1:-1)*6,.2);LV.ball.y=lerp(LV.ball.y,266,.2);}}}
function nflPlay(gainTo,dur,kind,last){ // kind: run | pass | int | td
  return{dur,start(){this.o=LV.off;this.d=this.o===0?1:-1;this.X0=NX(this.o,LV.los);this.Xt=NX(this.o,Math.min(gainTo,kind==='td'?108:99));
      this.pass=kind==='int'||(kind!=='run'&&Math.random()<.55);this.wr=Math.random()<.5?6:7;this.ty=150+Math.random()*230;LV.mode='set';LV.carP=null;},
    upd(p){const o=this.o,d=this.d,off=LV.pl[o],def=LV.pl[1-o];
      if(p<.28){LV.mode='set';return;}
      LV.mode='action';const q=(p-.28)/.72;
      // línea: empuje
      for(let i=0;i<5;i++){off[i].tx=this.X0+d*(-8+q*14);def[i].tx=this.X0+d*(11-q*4);}
      const qb=off[9],rb=off[10];
      if(this.pass){qb.tx=this.X0-d*40;qb.ty=266;const wr=off[this.wr];wr.tx=this.Xt;wr.ty=this.ty;
        if(q<.45){LV.carP=null;LV.ball.x=qb.x+d*4;LV.ball.y=qb.y;LV.ball.h=0;}
        else if(q<.78){LV.flying=true;const t=(q-.45)/.33;const tgt=kind==='int'?def[7+(this.wr-6)]:wr;LV.ball.x=lerp(qb.x,tgt.x,t);LV.ball.y=lerp(qb.y,tgt.y,t);LV.ball.h=60*4*t*(1-t);if(kind==='int'){tgt.tx=wr.x+d*10;tgt.ty=wr.y;}}
        else{LV.flying=false;const c=kind==='int'?def[7+(this.wr-6)]:wr;LV.ball.x=c.x;LV.ball.y=c.y;LV.ball.h=0;LV.carP=c;}
        const cb=def[7+(this.wr-6)];if(kind!=='int'){cb.tx=wr.x+d*18;cb.ty=wr.y+12;}
      }else{rb.tx=this.Xt;rb.ty=266+(this.ty-266)*.3;if(q>.15){LV.ball.x=rb.x+d*5;LV.ball.y=rb.y;LV.ball.h=0;LV.carP=rb;}else{LV.ball.x=qb.x;LV.ball.y=qb.y;}}
      // defensa persigue el balón
      const b=LV.ball;def.forEach((p,i)=>{if(i>=4&&!(this.pass&&i===7+(this.wr-6))){p.tx=lerp(p.x,b.x+d*10,.6);p.ty=lerp(p.y,b.y,.6);}});
      off.forEach((p,i)=>{if(i===5||i===8||(i>=6&&i<=7&&i!==this.wr)){p.tx=this.X0+d*(30+q*120);}});
    },
    end(){LV.mode='set';LV.carP=null;LV.flying=false;
      if(kind==='td'){LV.los=Math.min(99,gainTo);scored(this.o,LV.nflMin.pts,'TOUCHDOWN',true);}
      else if(kind==='int'){LIVE.hooks.banner('¡INTERCEPCIÓN!','#FF7A00',false);popPend();}
      else LV.los=gainTo;}};
}
function nflKick(fg){return{dur:fg?1100:1000,start(){this.o=LV.off;this.d=this.o===0?1:-1;this.x0=NX(this.o,LV.los)-this.d*70;LV.mode='set';
      this.tx=fg?(this.o===0?1196:4):clamp(NX(this.o,LV.los+42),110,1090);this.ty=266+(fg?0:(Math.random()-.5)*160);},
    upd(p){if(p<.25){LV.ball.x=this.x0;LV.ball.y=266;return;}const q=(p-.25)/.75;LV.ball.x=lerp(this.x0,this.tx,q);LV.ball.y=lerp(266,this.ty,q);LV.ball.h=(fg?120:150)*4*q*(1-q);LV.flying=true;},
    end(){LV.flying=false;LV.ball.h=0;if(fg)scored(this.o,3,'GOL DE CAMPO',false);else popPend();}};}
function nflPlan(){
  const M=LV.nflMin,md=LV.md;
  if(M.team!==LV.off){LV.off=M.team;LV.los=M.from;LV.q.push({dur:400,start(){LV.ball.x=NX(LV.off,LV.los);LV.ball.y=266;}});}
  const end=M.end,mid=LV.los+(M.to-LV.los)*(.35+Math.random()*.3);
  if(end==='td'){LV.q.push(nflPlay(mid,md*.45,'run'));LV.q.push(nflPlay(105,md*.55,'td'));}
  else if(end==='fg'){LV.q.push(nflPlay(M.to,md*.55,'run'));LV.q.push(nflKick(true));}
  else if(end==='punt'){LV.q.push(nflPlay(M.to,md*.55,'run'));LV.q.push(nflKick(false));}
  else if(end==='to'){LV.q.push(nflPlay(mid,md*.45,'run'));LV.q.push(nflPlay(M.to,md*.55,'int'));}
  else{LV.q.push(nflPlay(mid,md*.5,'run'));LV.q.push(nflPlay(M.to,md*.5,'run'));}
}

/* ================= PARTÍCULAS ================= */
function confetti(team){const c=LV.kits[team];for(let i=0;i<90;i++)LIVE.parts.push({x:LIVE.W/2+(Math.random()-.5)*200,y:LIVE.H*.35,vx:(Math.random()-.5)*.9,vy:-Math.random()*.9-.2,c:i%3?c[0]:c[1]==='#111111'?'#F4F4F4':c[1],life:1800+Math.random()*900,r:Math.random()*6,s:3+Math.random()*4});}
function swish(x,y,team){for(let i=0;i<14;i++)LIVE.parts.push({x,y,vx:(Math.random()-.5)*.35,vy:Math.random()*.3,c:LV.kits[team][0],life:500,r:0,s:3});}
function updParts(dt){for(const p of LIVE.parts){p.vy+=.0012*dt;p.x+=p.vx*dt;p.y+=p.vy*dt;p.life-=dt;p.r+=.01*dt;}LIVE.parts=LIVE.parts.filter(p=>p.life>0);}

/* ================= DIBUJO ================= */
function buildBg(sp){
  const[W,H]=DIM[sp],c=document.createElement('canvas'),s=LIVE.k*LIVE.dpr;c.width=Math.max(1,Math.round(W*s));c.height=Math.max(1,Math.round(H*s));
  const g=c.getContext('2d');g.scale(s,s);g.lineCap='round';
  if(sp==='fut'){
    for(let i=0;i<14;i++){g.fillStyle=i%2?'#0f3f2b':'#0c3524';g.fillRect(i*75,0,75,H);}
    const vg=g.createRadialGradient(W/2,H/2,100,W/2,H/2,700);vg.addColorStop(0,'rgba(255,255,255,.05)');vg.addColorStop(1,'rgba(0,0,0,.35)');g.fillStyle=vg;g.fillRect(0,0,W,H);
    g.strokeStyle='rgba(244,244,244,.62)';g.lineWidth=3;
    g.strokeRect(20,20,1010,640);g.beginPath();g.moveTo(525,20);g.lineTo(525,660);g.stroke();
    g.beginPath();g.arc(525,340,91,0,7);g.stroke();g.fillStyle='rgba(244,244,244,.7)';g.beginPath();g.arc(525,340,4,0,7);g.fill();
    for(const [x,w] of [[20,165],[865,165]]){g.strokeRect(x,138,w,404);}g.strokeRect(20,246,55,188);g.strokeRect(975,246,55,188);
    g.beginPath();g.arc(130,340,91,-.93,.93);g.stroke();g.beginPath();g.arc(920,340,91,Math.PI-.93,Math.PI+.93);g.stroke();
    g.fillStyle='rgba(244,244,244,.7)';g.beginPath();g.arc(130,340,3,0,7);g.fill();g.beginPath();g.arc(920,340,3,0,7);g.fill();
    for(const[x0,dir] of [[20,-1],[1030,1]]){g.fillStyle='rgba(255,255,255,.08)';g.fillRect(dir<0?6:1030,303,14,74);g.strokeStyle='rgba(244,244,244,.85)';g.lineWidth=3;g.strokeRect(dir<0?6:1030,303,14,74);
      g.strokeStyle='rgba(244,244,244,.18)';g.lineWidth=1;for(let y=307;y<377;y+=6){g.beginPath();g.moveTo(dir<0?6:1030,y);g.lineTo(dir<0?20:1044,y);g.stroke();}}
    for(const [x,y] of [[20,20],[1030,20],[20,660],[1030,660]]){g.strokeStyle='rgba(244,244,244,.62)';g.lineWidth=2;g.beginPath();g.arc(x,y,10,0,7);g.stroke();}
  }else if(sp==='nba'){
    g.fillStyle='#3b2918';g.fillRect(0,0,W,H);
    for(let i=0;i<40;i++){g.fillStyle=i%2?'rgba(255,220,170,.035)':'rgba(0,0,0,.05)';g.fillRect(0,i*12.5,W,12.5);}
    const vg=g.createRadialGradient(W/2,H/2,80,W/2,H/2,600);vg.addColorStop(0,'rgba(255,230,190,.10)');vg.addColorStop(1,'rgba(0,0,0,.45)');g.fillStyle=vg;g.fillRect(0,0,W,H);
    g.fillStyle='rgba(0,230,168,.12)';g.fillRect(15,170,190,160);g.fillStyle='rgba(59,130,246,.14)';g.fillRect(735,170,190,160);
    g.strokeStyle='rgba(244,244,244,.68)';g.lineWidth=3;g.strokeRect(15,15,910,470);g.beginPath();g.moveTo(470,15);g.lineTo(470,485);g.stroke();
    g.beginPath();g.arc(470,250,60,0,7);g.stroke();g.strokeRect(15,170,190,160);g.strokeRect(735,170,190,160);
    g.beginPath();g.arc(205,250,60,-Math.PI/2,Math.PI/2);g.stroke();g.beginPath();g.arc(735,250,60,Math.PI/2,Math.PI*1.5);g.stroke();
    g.beginPath();g.moveTo(15,35);g.lineTo(140,35);g.arc(70,250,226,-1.25,1.25);g.lineTo(15,465);g.stroke();
    g.beginPath();g.moveTo(925,35);g.lineTo(800,35);g.arc(870,250,226,Math.PI+1.25,Math.PI-1.25,true);g.lineTo(925,465);g.stroke();
    g.font='800 64px "League Spartan",sans-serif';g.textAlign='center';g.fillStyle='rgba(244,244,244,.06)';g.fillText('EL BICHO',470,272);
    for(const x of [52,888]){g.strokeStyle='#F4F4F4';g.lineWidth=5;g.beginPath();g.moveTo(x,222);g.lineTo(x,278);g.stroke();}
  }else{
    for(let i=0;i<10;i++){g.fillStyle=i%2?'#0f3f2b':'#0c3524';g.fillRect(100+i*100,0,100,H);}
    const vg=g.createRadialGradient(W/2,H/2,100,W/2,H/2,700);vg.addColorStop(0,'rgba(255,255,255,.04)');vg.addColorStop(1,'rgba(0,0,0,.35)');g.fillStyle=vg;g.fillRect(0,0,W,H);
    const kH=LV?LV.kits[0][0]:'#00E6A8',kA=LV?LV.kits[1][0]:'#3B82F6';
    g.fillStyle=kH;g.globalAlpha=.8;g.fillRect(0,0,100,H);g.fillStyle=kA;g.fillRect(1100,0,100,H);g.globalAlpha=1;
    g.font='800 46px "League Spartan",sans-serif';g.textAlign='center';
    const tH=LV?LV.P.H.ab:'',tA=LV?LV.P.A.ab:'';
    g.save();g.translate(50,H/2);g.rotate(-Math.PI/2);g.fillStyle=lum(kH)>.6?'#0b0b0b':'#F4F4F4';g.fillText(tH,0,16);g.restore();
    g.save();g.translate(1150,H/2);g.rotate(Math.PI/2);g.fillStyle=lum(kA)>.6?'#0b0b0b':'#F4F4F4';g.fillText(tA,0,16);g.restore();
    for(let yd=5;yd<100;yd+=5){const x=100+yd*10;g.strokeStyle=`rgba(244,244,244,${yd%10?.28:.6})`;g.lineWidth=yd%10?2:3;g.beginPath();g.moveTo(x,0);g.lineTo(x,H);g.stroke();
      if(yd%10===0){const lab=yd<=50?yd:100-yd;g.font='800 30px Montserrat,sans-serif';g.fillStyle='rgba(244,244,244,.55)';g.fillText(lab,x,72);g.fillText(lab,x,482);}}
    for(let yd=1;yd<100;yd++){const x=100+yd*10;g.strokeStyle='rgba(244,244,244,.35)';g.lineWidth=1.5;for(const y of[180,353]){g.beginPath();g.moveTo(x,y-5);g.lineTo(x,y+5);g.stroke();}}
    g.strokeStyle='#F4F4F4';g.lineWidth=5;g.strokeRect(2,2,W-4,H-4);g.beginPath();g.moveTo(100,0);g.lineTo(100,H);g.moveTo(1100,0);g.lineTo(1100,H);g.stroke();
    g.strokeStyle='#D4AF37';g.lineWidth=6;for(const x of [6,1194]){g.beginPath();g.moveTo(x,236);g.lineTo(x,296);g.stroke();}
  }
  return c;
}
function lum(hex){const n=parseInt(hex.slice(1),16);return((n>>16&255)*.299+(n>>8&255)*.587+(n&255)*.114)/255;}
function draw(){
  const cv=LIVE.cv,g=LIVE.ctx;if(!cv)return;
  if(!LV){g.setTransform(1,0,0,1,0,0);g.clearRect(0,0,cv.width,cv.height);if(LIVE.bg)g.drawImage(LIVE.bg,0,0);return;}const s=LIVE.k*LIVE.dpr;
  g.setTransform(1,0,0,1,0,0);g.clearRect(0,0,cv.width,cv.height);
  let sx=0,sy=0;if(LIVE.shake>0){sx=(Math.random()-.5)*6;sy=(Math.random()-.5)*6;}
  if(LIVE.bg)g.drawImage(LIVE.bg,sx*s,sy*s);
  g.setTransform(s,0,0,s,sx*s,sy*s);
  const sp=LV.sport,R=sp==='fut'?12:sp==='nba'?12.5:11,b=LV.ball;
  // línea de golpeo y primera y diez (NFL)
  if(sp==='nfl'){const X=NX(LV.off,LV.los),F=NX(LV.off,Math.min(100,LV.los+10));g.strokeStyle='rgba(59,130,246,.85)';g.lineWidth=3;g.beginPath();g.moveTo(X,0);g.lineTo(X,LIVE.H);g.stroke();
    if(LV.los<=90){g.strokeStyle='#D4AF37';g.lineWidth=4;g.beginPath();g.moveTo(F,0);g.lineTo(F,LIVE.H);g.stroke();}}
  // estela del balón
  LIVE.trail.push([b.x,b.y-b.h]);if(LIVE.trail.length>9)LIVE.trail.shift();
  if(LV.flying||(sp==='fut'&&!car()&&Math.hypot(b.vx||0,b.vy||0)>300)){LIVE.trail.forEach(([x,y],i)=>{g.fillStyle=`rgba(255,255,255,${i/40})`;g.beginPath();g.arc(x,y,3+i*.4,0,7);g.fill();});}
  // jugadores ordenados por profundidad
  const all=[];LV.pl.forEach((team,k)=>team.forEach(p=>all.push([p,k])));all.sort((a,c)=>a[0].y-c[0].y);
  const carrier=sp==='nfl'?LV.carP:sp==='fut'?car():(LV.car!=null&&!LV.flying?LV.pl[LV.pt][LV.car]:null);
  if(!LV.gkc){const C=['#FFD400','#FF7A00','#22D3EE','#A3E635','#F472B6','#F4F4F4'],ok=c=>cdist(c,LV.kits[0][0])>140&&cdist(c,LV.kits[1][0])>140,g0=C.find(ok)||C[0],g1=C.find(c=>c!==g0&&ok(c))||C.find(c=>c!==g0);LV.gkc=[g0,g1];}
  for(const[p,k] of all){if(p===carrier){g.strokeStyle='rgba(255,255,255,.75)';g.lineWidth=2;g.beginPath();g.ellipse(p.x,p.y+2,R*1.35,R*1.0,0,0,7);g.stroke();}}
  for(const[p,k] of all)drawFig(g,p,LV.kits[k],R,sp,sp==='fut'&&p.i===0?LV.gkc[k]:null);
  // balón
  const bs=sp==='nba'?8:sp==='nfl'?7:6.5;
  g.fillStyle='rgba(0,0,0,.4)';g.beginPath();g.ellipse(b.x+2+b.h*.15,b.y+3,bs*(1-b.h/300),bs*.5*(1-b.h/300),0,0,7);g.fill();
  const by=b.y-b.h,br=bs*(1+b.h/160);
  if(sp==='fut'){g.fillStyle='#F4F4F4';g.beginPath();g.arc(b.x,by,br,0,7);g.fill();g.fillStyle='#1a1a1a';for(let q=0;q<3;q++){const an=(b.spin||0)+q*2.1;g.beginPath();g.arc(b.x+Math.cos(an)*br*.5,by+Math.sin(an)*br*.5,br*.28,0,7);g.fill();}g.strokeStyle='#222';g.lineWidth=1;g.beginPath();g.arc(b.x,by,br,0,7);g.stroke();}
  else if(sp==='nba'){g.fillStyle='#FF7A00';g.beginPath();g.arc(b.x,by,br,0,7);g.fill();g.strokeStyle='#2b1300';g.lineWidth=1.4;g.beginPath();g.arc(b.x,by,br,0,7);g.moveTo(b.x-br,by);g.lineTo(b.x+br,by);g.moveTo(b.x,by-br);g.lineTo(b.x,by+br);g.stroke();}
  else{g.save();g.translate(b.x,by);g.fillStyle='#7a3b12';g.beginPath();g.ellipse(0,0,br*1.6,br,0,0,7);g.fill();g.strokeStyle='#F4F4F4';g.lineWidth=1.5;g.beginPath();g.moveTo(-br*.5,0);g.lineTo(br*.5,0);g.stroke();g.restore();}
  // aros (encima del balón)
  if(sp==='nba'){for(const x of [70,870]){g.strokeStyle='#FF7A00';g.lineWidth=3.5;g.beginPath();g.arc(x,250,13,0,7);g.stroke();}}
  for(const p of LIVE.parts){g.save();g.globalAlpha=Math.min(1,p.life/400);g.translate(p.x,p.y);g.rotate(p.r);g.fillStyle=p.c;g.fillRect(-p.s/2,-p.s/4,p.s,p.s/2);g.restore();}
}
function drawFig(g,p,kit,R,sp,gk){
  const a=p.a||0,ca=Math.cos(a),sa=Math.sin(a),spd=Math.hypot(p.vx||0,p.vy||0),sw=Math.sin(p.st||0)*Math.min(1,spd/50),c1=gk||kit[0],c2=gk?'#111111':kit[1];
  g.fillStyle='rgba(0,0,0,.30)';g.beginPath();g.ellipse(p.x+R*.35,p.y+R*.55,R*1.05,R*.72,a,0,7);g.fill();
  g.fillStyle='#141414';for(const s of[-1,1]){const lx=p.x-sa*R*.4*s+ca*R*.62*sw*s,ly=p.y+ca*R*.4*s+sa*R*.62*sw*s;g.beginPath();g.ellipse(lx,ly,R*.3,R*.22,a,0,7);g.fill();}
  g.save();g.translate(p.x,p.y);g.rotate(a);
  g.fillStyle=shade(c1,-.18);for(const s of[-1,1]){g.beginPath();g.ellipse(R*.35*sw*s,s*R*.86,R*.3,R*.21,0,0,7);g.fill();}
  const gr=g.createLinearGradient(-R,0,R,0);gr.addColorStop(0,shade(c1,-.2));gr.addColorStop(1,shade(c1,.18));
  g.fillStyle=gr;g.beginPath();g.ellipse(0,0,R*.6,R*.98,0,0,7);g.fill();g.lineWidth=1.6;g.strokeStyle=c2;g.stroke();
  g.fillStyle=c2;g.globalAlpha=.65;g.fillRect(-R*.5,-R*.12,R*.2,R*.24);g.globalAlpha=1;
  if(sp==='nfl'){g.fillStyle=shade(c1,-.25);g.beginPath();g.arc(R*.1,0,R*.52,0,7);g.fill();g.fillStyle=c2;g.fillRect(-R*.42,-R*.08,R*.95,R*.16);g.strokeStyle='rgba(255,255,255,.85)';g.lineWidth=1.4;g.beginPath();g.moveTo(R*.58,-R*.3);g.lineTo(R*.58,R*.3);g.stroke();}
  else{g.fillStyle=p.skin||'#d8a47f';g.beginPath();g.arc(R*.06,0,R*.43,0,7);g.fill();g.fillStyle='rgba(28,18,10,.9)';g.beginPath();g.arc(0,0,R*.44,Math.PI*.5,Math.PI*1.5);g.fill();}
  g.restore();
}
function shade(hex,a){const n=parseInt(hex.slice(1),16);let r=n>>16&255,gg=n>>8&255,b=n&255;const f=v=>Math.round(a>=0?v+(255-v)*a:v*(1+a));return`rgb(${f(r)},${f(gg)},${f(b)})`;}
