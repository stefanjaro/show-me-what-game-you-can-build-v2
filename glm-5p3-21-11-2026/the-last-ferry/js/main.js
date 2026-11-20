'use strict';
(function(){
const LF = window.LF;
const canvas = document.getElementById('cv');
LF.canvas = canvas;
LF.ctx = canvas.getContext('2d');
LF.View.update(canvas);
window.addEventListener('resize', ()=>LF.View.update(canvas));
LF.Input.init();
LF.UI.init();
LF.Game = new LF.GameClass();
window.addEventListener('pointerdown', ()=>LF.Game.pointer());
window.addEventListener('blur', ()=>{
  if(LF.Game.state==='cross' && !LF.Game.pauseFlag) LF.Game.togglePause();
});
LF.Game.boot();

if(LF.SMOKE){
  let acc=0;
  LF.__tick = dt=>{
    LF.Game.update(dt);
    LF.Render.draw(LF.Game);
    LF.Input.endFrame();
  };
  if(typeof document!=='undefined') document.title='SMOKE-RUNNING';
} else {
  let last=performance.now();
  function frame(now){
    let dt=(now-last)/1000;
    last=now;
    if(dt>1/20) dt=1/20;
    LF.Game.update(dt);
    LF.Render.draw(LF.Game);
    LF.Input.endFrame();
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}
})();
