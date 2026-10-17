/* VAS v2: conexion resistente (bloqueo de pantalla / cambio de app), reanudar partida y mazo sin repeticiones */
(()=>{
const GRACE=120000,HOLD=20000,HK='vasHost';
try{localStorage.setItem('vasPidKeep',PID)}catch(e){}

/* ---- aviso de conexion ---- */
const st=document.createElement('style');
st.textContent='.vas-net{position:absolute;left:50%;top:60px;transform:translateX(-50%);z-index:30;max-width:92%;background:var(--ink-2);border:1px solid var(--line);color:var(--paper);border-radius:999px;padding:8px 14px;font:600 12px var(--f-mono);letter-spacing:.03em;text-align:center;pointer-events:none}';
document.head.appendChild(st);
let netBad=false,hostLost=false,hlT=null,rcT=null,errT=null,missT=null,lastHello=0,hiddenAt=0;
const paint=()=>{const ph=document.querySelector('#phone');if(!ph)return;let b=document.querySelector('#vasNet');const m=netBad?'Reconectando…':hostLost?'El anfitrión perdió la conexión. Esperándolo…':'';if(!m){b&&b.remove();return}if(!b){b=document.createElement('div');b.id='vasNet';b.className='vas-net';b.setAttribute('role','status');ph.appendChild(b)}b.textContent=m};
const inRoom=()=>S.mode==='room'&&S.code&&['lobby','game','result'].includes(S.screen);

/* ---- canal: siempre vuelve a anunciarse con datos frescos ---- */
window.sbJoin=function(code,meta,h){
  if(!RT)RT=new RealtimeClient(SB.url.replace('https:','wss:')+'/realtime/v1',{params:{apikey:SB.key,eventsPerSecond:30}});
  const t=RT.channel('vas-'+code,{config:{broadcast:{self:false,ack:false},presence:{key:PID}}});
  let dead=false;
  t.on('broadcast',{event:'m'},m=>h.msg(m.payload))
   .on('presence',{event:'sync'},()=>{const s=t.presenceState(),l=[];for(const k in s)if(s[k]&&s[k][0])l.push(s[k][0]);h.sync(l)})
   .subscribe(x=>{if(dead)return;if(x==='SUBSCRIBED'){let m=meta;try{m=myMeta()}catch(e){}t.track(m);h.status&&h.status('ok')}else if(x==='CHANNEL_ERROR'||x==='TIMED_OUT'||x==='CLOSED'){h.status&&h.status('err')}});
  return{send:e=>t.send({type:'broadcast',event:'m',payload:e}),track:e=>t.track(e),leave:()=>{dead=true;try{t.unsubscribe();RT.removeChannel(t)}catch(e){}}};
};
window.roomHandlers=function(){return{msg:onNetMsg,sync:onPresence,status:s=>{
  if(s==='err'){if(!inRoom())return;netBad=true;paint();clearTimeout(errT);errT=setTimeout(()=>{if(netBad)reconnect(0)},3000)}
  else if(netBad){netBad=false;clearTimeout(errT);paint();resync()}
}}};
function reconnect(n){
  clearTimeout(rcT);
  if(!inRoom())return;
  try{Net.leave()}catch(e){}
  try{if(RT){RT.disconnect();RT=null}}catch(e){RT=null}
  Net.join(S.code,myMeta(),roomHandlers());
  rcT=setTimeout(()=>{
    if(ROOM.list.some(p=>p.pid===PID)){netBad=false;paint();resync();return}
    if(n<10)reconnect(n+1);else{netBad=true;paint()}
  },4000);
}
function resume(){if(!inRoom())return;netBad=true;paint();reconnect(0)}
function resync(){
  if(S.host||S.mode!=='room'||!S.code||Date.now()-lastHello<2500)return;
  if(S.screen==='lobby'){S.helloSent=false;checkHello();return}
  if(!S.g||(S.screen!=='game'&&S.screen!=='result'))return;
  lastHello=Date.now();
  Net.send({k:'int',ev:'hello',from:PID,a:{name:S.me.name,color:S.me.color,sinAlc:S.me.sinAlc}});
}

/* ---- anfitrion ausente: se espera en vez de cerrar la partida ---- */
function setHostLost(on,lobby){
  if(on){
    if(hostLost)return;
    hostLost=true;paint();clearTimeout(hlT);
    hlT=setTimeout(()=>{hlT=null;if(hostLost&&!ROOM.list.some(p=>p.host)){hostLost=false;paint();leaveRoom(lobby?'El anfitrion salio de la sala':'El anfitrion se desconecto. Se acabo la partida')}},GRACE);
  }else if(hostLost){hostLost=false;clearTimeout(hlT);hlT=null;paint();resync()}
}
window.onPresence=function(e){
  ROOM.list=e;
  if(S.probe)return void S.probe(e);
  const a=e.some(x=>x.host);
  if(S.screen==='lobby'){
    if(a)ROOM.hostSeen=true;
    if(!S.host&&ROOM.hostSeen&&!a){setHostLost(true,true);return}
    setHostLost(false);checkHello();renderLobby();
  }else if(S.mode==='room'&&S.g&&(S.screen==='game'||S.screen==='result')){
    if(!S.host&&!a){setHostLost(true,false);return}
    setHostLost(false);
    S.host&&hostPresence(e);
  }
};
/* ---- jugadores ausentes: el anfitrion les da 20 s antes de marcarlos sin senal ---- */
const miss={},ohp=window.hostPresence;
window.hostPresence=function(list){
  const g=S.g;if(!g)return ohp.call(this,list);
  const now=Date.now(),here=new Set(list.map(p=>p.pid)),eff=list.slice();let hold=false;
  g.players.forEach(p=>{
    if(p.id===PID||here.has(p.id)){delete miss[p.id];return}
    if(!p.present)return;
    miss[p.id]=miss[p.id]||now;
    if(now-miss[p.id]<HOLD){eff.push({pid:p.id,name:p.name,color:p.color,sinAlc:p.sinAlc});hold=true}
  });
  if(hold){clearTimeout(missT);missT=setTimeout(()=>{if(S.host&&S.g&&S.screen==='game')window.hostPresence(ROOM.list)},HOLD+1000)}
  return ohp.call(this,eff);
};
const olr=window.leaveRoom;
window.leaveRoom=function(){hostLost=false;netBad=false;[hlT,rcT,errT,missT].forEach(clearTimeout);try{localStorage.removeItem(HK)}catch(e){}paint();return olr.apply(this,arguments)};

/* ---- pantalla encendida y reconexion al volver ---- */
let WL=null;
async function wake(){try{if(!navigator.wakeLock||WL||document.visibilityState!=='visible'||S.mode!=='room')return;WL=await navigator.wakeLock.request('screen');WL.addEventListener('release',()=>{WL=null})}catch(e){WL=null}}
document.addEventListener('visibilitychange',()=>{
  if(document.visibilityState==='hidden'){hiddenAt=Date.now();return}
  wake();
  if(hiddenAt&&Date.now()-hiddenAt>2500)resume();
  hiddenAt=0;
});
window.addEventListener('pageshow',e=>{if(e.persisted)resume()});
window.addEventListener('online',resume);

/* ---- el anfitrion guarda la partida para poder retomarla si el navegador recarga ---- */
setInterval(()=>{
  if(S.mode==='room'&&S.host&&S.g&&S.screen==='game'&&S.code&&S.g.turn>=0){
    try{localStorage.setItem(HK,JSON.stringify({c:S.code,t:Date.now(),cfg:S.cfg,g:snapshot().g,seen:RECENT.slice(-400)}))}catch(e){}
  }
},2500);
const hostSaved=()=>{try{const o=JSON.parse(localStorage.getItem(HK)||'null');return o&&/^\d{4}$/.test(o.c)&&Date.now()-o.t<108e5&&o.g&&o.g.turn>=0?o:null}catch(e){return null}};
ACT['resume-host']=function(){
  const h=hostSaved();if(!h||S.joining)return;
  S.mode='room';S.host=true;S.code=h.c;S.cfg=h.cfg;S.helloSent=false;S.g=null;S.screen='home';
  const ps=h.g.players.map(p=>p.host?{...p,id:PID}:p);
  S.players=ps.map(p=>({...p,isMe:p.id===PID}));
  S.joinSnap={...h.g,players:ps};
  RECENT.length=0;(h.seen||[]).forEach(k=>RECENT.push(k));
  ROOM.list=[];ROOM.hostSeen=false;
  go('game');
  Net.join(S.code,myMeta(),roomHandlers());
};
const oth=ACT['to-home'];
ACT['to-home']=function(){if(S.mode==='room'&&S.host&&S.g){try{localStorage.removeItem(HK)}catch(e){}}return oth.apply(this,arguments)};

/* ---- go: aviso, pantalla encendida y boton de retomar ---- */
const og2=window.go;
window.go=function(e){
  og2.apply(this,arguments);
  if(e==='result'){try{localStorage.removeItem(HK)}catch(x){}}
  if(S.mode==='room'&&(e==='lobby'||e==='game'))wake();
  if(e==='home'){
    hostLost=false;if(!S.g)netBad=false;paint();
    const h=hostSaved(),j=document.querySelector('.join');
    if(h&&!S.g&&j&&!document.querySelector('[data-act=resume-host]')){
      const r=document.querySelector('[data-act=rejoin]');r&&r.remove();
      j.insertAdjacentHTML('afterend',`<button class="back" data-act="resume-host" style="align-self:flex-start;color:#000">Retomar mi partida (sala ${h.c})</button>`);
    }
  }
};

/* ---- mazo: no repite cartas hasta agotar las de la seleccion; al reciclar, las vistas hace mas tiempo salen primero ---- */
const RECENT=[],key=c=>c.id!=null?'i'+c.id:'t'+(c.x||'');
window.buildDeck=function(){
  const c=S.cfg,sel=TEMAS.filter(t=>c.temas.includes(t.k)).map(t=>t.k);
  const venueOk=x=>x.v==='b'||x.v===c.venue,actOk=x=>!c.act||x.a||x.fmt||x.t==='wild'||x.t==='round';
  const lvl=BANK.filter(x=>x.l===c.level&&venueOk(x)&&actOk(x));
  let pool=lvl.filter(x=>x.t==='wild'||sel.includes(x.tema));
  if(pool.filter(x=>x.t!=='wild').length<4)pool=lvl;
  const last=new Map();RECENT.forEach((k,i)=>last.set(k,i));
  const fresh=pool.filter(x=>!last.has(key(x))),old=pool.filter(x=>last.has(key(x))).sort((a,b)=>last.get(key(b))-last.get(key(a)));
  return[...old,...shuffle(fresh)];
};
const od=window.drawCard;
window.drawCard=function(){const c=od.apply(this,arguments);if(c){RECENT.push(key(c));if(RECENT.length>800)RECENT.splice(0,200)}return c};
const osg=window.startGame;
window.startGame=function(){if(!S.joinSnap)RECENT.length=0;return osg.apply(this,arguments)};
window.__vas2={RECENT,reconnect,resume,resync,hostSaved};
})();
