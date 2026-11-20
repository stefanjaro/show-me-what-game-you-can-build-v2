'use strict';
(function(){
const TAU = Math.PI*2;
const LF = (typeof window!=='undefined' ? (window.LF = window.LF || {}) : {});
LF.SMOKE = (typeof location!=='undefined' && /smoke/.test(location.search||''));
LF.TAU = TAU;
LF.clamp = (v,a,b)=> v<a?a:(v>b?b:v);
LF.lerp = (a,b,t)=> a+(b-a)*t;
LF.smoothstep = t => t<=0?0:(t>=1?1:t*t*(3-2*t));
LF.easeOut = t => 1-(1-t)*(1-t);
LF.easeInOut = t => t<0.5?2*t*t:1-((-2*t+2)*(-2*t+2))/2;
LF.rand = (a=1,b)=> b===undefined? Math.random()*a : a+Math.random()*(b-a);
LF.randi = (a,b)=> Math.floor(LF.rand(a,b+1));
LF.chance = p => Math.random()<p;
LF.pick = arr => arr[(Math.random()*arr.length)|0];
LF.dist = (x1,y1,x2,y2)=> Math.hypot(x2-x1,y2-y1);
LF.dist2 = (x1,y1,x2,y2)=>{const dx=x2-x1,dy=y2-y1;return dx*dx+dy*dy;};
LF.mulberry32 = function(seed){
  let a = seed>>>0;
  return function(){
    a|=0; a=(a+0x6D2B79F5)|0;
    let t=Math.imul(a^(a>>>15),1|a);
    t=(t+Math.imul(t^(t>>>7),61|t))^t;
    return ((t^(t>>>14))>>>0)/4294967296;
  };
};
LF.Noise1 = class {
  constructor(seed=1){
    const r = LF.mulberry32((seed*2654435761)>>>0||1);
    this.p = new Float32Array(512);
    for(let i=0;i<512;i++) this.p[i]=r();
  }
  at(x){
    const xi=Math.floor(x), f=x-xi;
    const ia=((xi%512)+512)%512, ib=(((xi+1)%512)+512)%512;
    return LF.lerp(this.p[ia], this.p[ib], LF.smoothstep(f));
  }
};
LF.fbm = (noise,x,oct=4)=>{
  let s=0, amp=0.5, fr=1, norm=0;
  for(let i=0;i<oct;i++){ s+=amp*noise.at(x*fr); norm+=amp; amp*=0.5; fr*=2.03; }
  return s/norm;
};
const hexCache = {};
LF.hexRGB = h=>{
  let c=hexCache[h];
  if(!c){ c=[parseInt(h.slice(1,3),16),parseInt(h.slice(3,5),16),parseInt(h.slice(5,7),16)]; hexCache[h]=c; }
  return c;
};
LF.mix = (h1,h2,t)=>{
  const a=LF.hexRGB(h1), b=LF.hexRGB(h2);
  const h=v=>('0'+Math.round(LF.clamp(v,0,255)).toString(16)).slice(-2);
  return '#'+h(LF.lerp(a[0],b[0],t))+h(LF.lerp(a[1],b[1],t))+h(LF.lerp(a[2],b[2],t));
};
LF.rgba = (h,a)=>{
  const c=LF.hexRGB(h);
  return 'rgba('+c[0]+','+c[1]+','+c[2]+','+a+')';
};
LF.errorLog = [];
LF.logError = msg=>{
  LF.errorLog.push(String(msg));
  try{
    if(LF.SMOKE && typeof document!=='undefined' && document.title && document.title.indexOf('SMOKE-ERR')!==0){
      document.title='SMOKE-ERR:'+LF.errorLog.length;
    }
  }catch(e){}
};
if(typeof window!=='undefined'){
  window.addEventListener('error', e=>LF.logError(e.message));
}
})();
