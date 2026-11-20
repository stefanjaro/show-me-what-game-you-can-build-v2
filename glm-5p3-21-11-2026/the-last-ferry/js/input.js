'use strict';
(function(){
const LF = window.LF;
const HANDLED = ['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space','Enter','KeyW','KeyA','KeyS','KeyD','Escape','KeyM'];
const Input = {
  down: Object.create(null),
  pressed: Object.create(null),
  init(){
    window.addEventListener('keydown', e=>{
      if(HANDLED.indexOf(e.code)!==-1) e.preventDefault();
      if(!e.repeat) this.pressed[e.code]=true;
      this.down[e.code]=true;
    });
    window.addEventListener('keyup', e=>{ this.down[e.code]=false; });
    window.addEventListener('blur', ()=>{ this.down=Object.create(null); });
  },
  isDown(...codes){ for(const c of codes) if(this.down[c]) return true; return false; },
  justPressed(...codes){ for(const c of codes) if(this.pressed[c]) return true; return false; },
  consume(...codes){ for(const c of codes) delete this.pressed[c]; },
  endFrame(){ this.pressed = Object.create(null); },
  rowAxis(){
    if(this.isDown('ArrowUp','KeyW')) return 1;
    if(this.isDown('ArrowDown','KeyS')) return -1;
    return 0;
  },
  turnAxis(){
    return (this.isDown('ArrowLeft','KeyA')?-1:0)+(this.isDown('ArrowRight','KeyD')?1:0);
  }
};
LF.Input = Input;
})();
