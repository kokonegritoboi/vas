/* Complemento VAS: el codigo de la sala se ve siempre y se puede volver a entrar */
(()=>{
const wm=()=>`<div class="wm">${nn('app')}<small>por DEKO</small></div>`;
const chip=()=>S.mode==='room'&&S.code?`<button class="pill-btn code-chip" data-act="copycode" aria-label="Código de la sala ${S.code}. Toca para copiarlo">Sala <b>${S.code}</b></button>`:'';
window.renderTop=function(){const t=document.querySelector('#top');if(t)t.innerHTML=wm()+chip()};
const K='vasRoom';
const saved=()=>{try{const o=JSON.parse(localStorage.getItem(K)||'null');return o&&/^\d{4}$/.test(o.c)&&Date.now()-o.t<216e5?o.c:null}catch(e){return null}};
const save=c=>{try{localStorage.setItem(K,JSON.stringify({c:c,t:Date.now()}))}catch(e){}};
const og=window.go;
window.go=function(e){og.apply(this,arguments);
if(S.mode==='room'&&S.code&&(e==='lobby'||e==='game'))save(S.code);
renderTop();
if(e==='home'){const c=saved(),j=document.querySelector('.join');if(c&&j&&!document.querySelector('[data-act=rejoin]'))j.insertAdjacentHTML('afterend',`<button class="back" data-act="rejoin" style="align-self:flex-start;color:#000">Volver a la sala ${c}</button>`)}
};
ACT.copycode=()=>{const c=S.code;if(!c)return;const f=()=>toast('Código de la sala: '+c);try{navigator.clipboard.writeText(c).then(()=>toast('Código '+c+' copiado'),f)}catch(e){f()}};
ACT.rejoin=()=>{const c=saved(),i=document.querySelector('#joinCode');if(c&&i){i.value=c;ACT.join()}};
const ob=window.boardHTML;
window.boardHTML=function(){const h=ob.apply(this,arguments);return S.mode==='room'&&S.code?h.replace('</p>',`</p><button class="btn ghost" data-act="copycode">Código de la sala ${S.code} · toca para copiar</button>`):h};
renderTop();
})();
