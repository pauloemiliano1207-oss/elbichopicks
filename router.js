/* ============ SECCIONES (cada parte de la página es su propia pantalla) ============ */
(function(){
  const app=document.getElementById('app');if(!app)return;
  // Bloque inicial -> sección. Todo lo que sigue a un bloque inicial pertenece a esa sección.
  const START={envivo:'hero',hoy:'hoy',parlays:'parlays',confianza:'inicio',gana:'simulador',sportsM:'simulador',choose:'simulador',metodo:'record',torneos:'torneos',cuotas:'cuotas',avanzado:'simulador',planes:'planes',mispicks:'mispicks',historial:'record',faq:'planes'};
  let cur='inicio';
  [...app.children].forEach(el=>{
    if(el.id&&START[el.id])cur=START[el.id];
    else if(el.classList.contains('sec')&&!el.id&&cur==='planes')cur='record'; // sección final "Datos"
    el.dataset.v=cur;
  });
  const HERO_IN=['inicio','simulador'];
  const NAMES={inicio:'Inicio',hoy:'Partidos de hoy',parlays:'Parlays',simulador:'Simulador',torneos:'Torneos',cuotas:'Cuotas',record:'Récord',planes:'Planes',mispicks:'Mis picks'};
  const GO2V={top:'simulador',hoy:'hoy',parlays:'parlays',torneos:'torneos',cuotas:'cuotas',metodo:'record',planes:'planes',mispicks:'mispicks',choose:'simulador',gana:'simulador',analysis:'simulador',rankings:'simulador',historial:'record',faq:'planes',inicio:'inicio'};
  let VIEW=null;
  window.showView=function(v,opts={}){
    if(!NAMES[v])v='inicio';
    [...app.children].forEach(el=>{const d=el.dataset.v;el.style.display=(d===v||(d==='hero'&&HERO_IN.includes(v)))?'':'none';});
    document.querySelectorAll('#menu a').forEach(a=>a.classList.toggle('on',GO2V[a.dataset.go]===v));
    document.body.dataset.view=v;
    if(VIEW!==v&&!opts.keepScroll)window.scrollTo({top:0,behavior:'instant'in window?'instant':'auto'});
    if(!opts.noHash&&location.hash!=='#'+v)history.pushState(null,'','#'+v);
    VIEW=v;document.title='El Bicho Picks · '+NAMES[v];
    if(typeof reveal==='function')setTimeout(reveal,30);
    if(HERO_IN.includes(v)&&typeof liveResize==='function')setTimeout(liveResize,60);
    // las animaciones de aparición necesitan un empujón al mostrar secciones ocultas
    setTimeout(()=>app.querySelectorAll('[data-v="'+v+'"] .rv, [data-v="'+v+'"].rv').forEach(e=>e.classList.add('in')),60);
  };
  // goTo original -> cambia de sección y, si hace falta, baja al bloque pedido
  const _goTo=window.goTo;
  window.goTo=function(id){
    const el=document.getElementById(id);let v=GO2V[id];
    if(!v&&el){const top=el.closest('#app > *');v=top&&top.dataset.v==='hero'?'simulador':top&&top.dataset.v;}
    v=v||'inicio';const changed=VIEW!==v;showView(v);
    if(el){const d=el.closest('details');if(d)d.open=true;}
    if(el&&!START[id]&&id!=='top')setTimeout(()=>el.scrollIntoView({behavior:changed?'auto':'smooth',block:'start'}),changed?80:0);
    document.getElementById('menu').classList.remove('open');
  };
  document.querySelectorAll('[data-go]').forEach(a=>a.onclick=e=>{e.preventDefault();goTo(a.dataset.go);});
  // Simular un partido siempre lleva al simulador
  if(typeof runSim==='function'){const _rs=runSim;window.runSim=runSim=function(...a){if(a[0]&&VIEW!=='simulador')showView('simulador');return _rs.apply(this,a);};}
  // Logo -> inicio con la presentación
  const logo=document.getElementById('logoTop');if(logo){const old=logo.onclick;logo.onclick=e=>{e.preventDefault();showView('inicio');if(old)old(e);};}
  window.addEventListener('popstate',()=>showView((location.hash||'#inicio').slice(1),{noHash:true}));
  // Menú: agrega "Inicio" al principio
  const menu=document.getElementById('menu');
  if(menu&&!menu.querySelector('[data-go="inicio"]')){const a=document.createElement('a');a.href='#inicio';a.dataset.go='inicio';a.textContent='Inicio';a.onclick=e=>{e.preventDefault();goTo('inicio');};menu.prepend(a);}
  showView((location.hash||'#inicio').slice(1),{noHash:true});
})();
