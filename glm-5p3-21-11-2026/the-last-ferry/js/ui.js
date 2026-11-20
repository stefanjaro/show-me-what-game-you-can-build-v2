'use strict';
(function(){
const LF = window.LF;
const WHOS = {
  ferryman:{n:'THE FERRYMAN', c:'#cfd8e8'},
  oldman:{n:'THE OLD MAN', c:'#dfe6ff'},
  child:{n:'THE CHILD', c:'#a8f0ff'},
  lady:{n:'THE GRAY LADY', c:'#ffe8f0'},
  merchant:{n:'THE MERCHANT', c:'#ffd98c'},
  light:{n:'THE LIGHT', c:'#fff4d0'}
};
const UI = {
  WHOS,
  dlgActive:false, dlgLines:[], dlgIdx:0, dlgChars:0, dlgFull:false, dlgText:'', dlgDone:null, lastShown:null, smokeT:0,
  cardActive:false, cardLines:[], cardIdx:0, cardChars:0, cardFull:false, cardText:'', cardDone:null, cardOpts:{}, cardSmokeT:0,
  toastT:0, chapT:0, chapDur:0, objT:0, objDur:0,
  fadeA:1, fadeFrom:1, fadeTo:1, fadeT:0, fadeDur:1, fadeCb:null,
  els:{},
  init(){
    const g = id=>document.getElementById(id);
    this.els = {
      dlg:g('dlg'), dname:g('dlgName'), dtext:g('dlgText'), dport:g('dlgPort'), dhint:g('dlgHint'),
      card:g('card'), cardKick:g('cardKicker'), cardText:g('cardText'), cardHint:g('cardHint'),
      toastEl:g('toast'), chapterEl:g('chapter'), objEl:g('objective'),
      fadeEl:g('fade'), flashEl:g('flash'),
      barTop:g('barTop'), barBot:g('barB'), title:g('titleScreen'), pauseOv:g('pauseOv')
    };
    this.setFade(1);
  },
  dialogue(lines, cb){
    this.dlgLines = lines.map(l=> typeof l==='string' ? {who:'ferryman', text:l} : l);
    this.dlgIdx=0; this.dlgDone=cb||null;
    this.dlgActive=true;
    this.els.dlg.classList.add('show');
    this.letterbox(true);
    this._showDlgLine();
  },
  _showDlgLine(){
    const L=this.dlgLines[this.dlgIdx];
    const w=WHOS[L.who]||WHOS.ferryman;
    this.els.dname.textContent=w.n;
    this.els.dname.style.color=w.c;
    this.els.dport.style.background='radial-gradient(circle at 40% 35%, #fff8 0%, '+w.c+'cc 30%, '+w.c+'22 70%, transparent 78%)';
    this.els.dport.style.boxShadow='0 0 18px '+w.c+'66';
    this.dlgText=L.text;
    this.dlgChars=0; this.dlgFull=false; this.lastShown=null;
    this.els.dtext.textContent='';
    this.els.dhint.style.opacity=0;
    this.smokeT=0;
  },
  _endDlg(){
    this.dlgActive=false;
    this.els.dlg.classList.remove('show');
    const cb=this.dlgDone; this.dlgDone=null;
    if(!this.cardActive) this.letterbox(false);
    if(cb) cb();
  },
  card(lines, opts, cb){
    this.cardOpts=opts||{};
    this.cardLines=lines.map(l=> typeof l==='string' ? {text:l} : l);
    this.cardIdx=0; this.cardDone=cb||null;
    this.cardActive=true;
    this.els.cardKick.textContent=this.cardOpts.kicker||'';
    this.els.card.classList.add('show');
    this.letterbox(true);
    this._showCardLine();
  },
  _showCardLine(){
    const L=this.cardLines[this.cardIdx];
    this.cardText=L.text;
    this.cardChars=0; this.cardFull=false; this.lastShown=null;
    this.els.cardText.textContent='';
    this.els.cardHint.style.opacity=0;
    this.cardSmokeT=0;
  },
  _endCard(){
    this.cardActive=false;
    this.els.card.classList.remove('show');
    if(!this.dlgActive) this.letterbox(false);
    const cb=this.cardDone; this.cardDone=null;
    if(cb) cb();
  },
  blocking(){ return this.dlgActive || this.cardActive; },
  cancelAll(){
    this.dlgActive=false;
    this.cardActive=false;
    this.dlgDone=null;
    this.cardDone=null;
    this.els.dlg.classList.remove('show');
    this.els.card.classList.remove('show');
    this.letterbox(false);
  },
  advance(){
    if(this.dlgActive){
      if(!this.dlgFull){
        this.dlgFull=true;
        this.els.dtext.textContent=this.dlgText;
        this.els.dhint.style.opacity=1;
        return true;
      }
      this.dlgIdx++;
      if(this.dlgIdx>=this.dlgLines.length) this._endDlg();
      else this._showDlgLine();
      return true;
    }
    if(this.cardActive){
      if(!this.cardFull){
        this.cardFull=true;
        this.els.cardText.textContent=this.cardText;
        this.els.cardHint.style.opacity=1;
        return true;
      }
      this.cardIdx++;
      if(this.cardIdx>=this.cardLines.length) this._endCard();
      else this._showCardLine();
      return true;
    }
    return false;
  },
  chapter(txt, dur=3.6){
    this.els.chapterEl.textContent=txt;
    this.chapT=dur; this.chapDur=dur;
    this.els.chapterEl.classList.add('show');
  },
  objective(txt, dur=5.5){
    this.els.objEl.textContent=txt;
    this.objT=dur; this.objDur=dur;
    this.els.objEl.classList.add('show');
  },
  toast(txt, dur=3.4){
    this.els.toastEl.textContent=txt;
    this.toastT=dur;
    this.els.toastEl.classList.add('show');
  },
  letterbox(on){
    this.els.barTop.classList.toggle('lb', !!on);
    this.els.barBot.classList.toggle('lb', !!on);
  },
  flash(){
    const el=this.els.flashEl;
    el.classList.remove('boom');
    void el.offsetWidth;
    el.classList.add('boom');
  },
  setFade(a){
    this.fadeA=a;
    this.els.fadeEl.style.opacity=a;
  },
  fade(to, dur, cb){
    this.fadeFrom=this.fadeA;
    this.fadeTo=to;
    this.fadeDur=Math.max(0.01,dur);
    this.fadeT=0;
    this.fadeCb=cb||null;
  },
  update(dt){
    if(this.dlgActive && !this.dlgFull){
      this.dlgChars=Math.min(this.dlgText.length, this.dlgChars+dt*46);
      const n=Math.floor(this.dlgChars);
      const shown=this.dlgText.slice(0,n);
      if(shown!==this.lastShown){
        this.lastShown=shown;
        this.els.dtext.textContent=shown;
        if(n%3===0) LF.Audio.blip();
      }
      if(n>=this.dlgText.length){
        this.dlgFull=true;
        this.els.dhint.style.opacity=1;
      }
    }
    if(this.cardActive && !this.cardFull){
      this.cardChars=Math.min(this.cardText.length, this.cardChars+dt*34);
      const n=Math.floor(this.cardChars);
      const shown=this.cardText.slice(0,n);
      if(shown!==this.lastShown){
        this.lastShown=shown;
        this.els.cardText.textContent=shown;
        if(n%3===0) LF.Audio.blip();
      }
      if(n>=this.cardText.length){
        this.cardFull=true;
        this.els.cardHint.style.opacity=1;
      }
    }
    if(LF.SMOKE && this.blocking()){
      if(this.dlgFull||this.cardFull){
        this.cardSmokeT+=dt;
        this.smokeT+=dt;
        if(this.smokeT>0.12 && this.dlgFull){ this.smokeT=0; this.advance(); }
        if(this.cardSmokeT>0.12 && this.cardFull){ this.cardSmokeT=0; this.advance(); }
      }
    }
    if(this.toastT>0){
      this.toastT-=dt;
      if(this.toastT<=0) this.els.toastEl.classList.remove('show');
    }
    if(this.chapT>0){
      this.chapT-=dt;
      if(this.chapT<=0) this.els.chapterEl.classList.remove('show');
      else if(this.chapT<0.6) this.els.chapterEl.style.opacity=(this.chapT/0.6);
      else this.els.chapterEl.style.opacity=Math.min(1,(this.chapDur-this.chapT)/0.6+0.2);
    }
    if(this.objT>0){
      this.objT-=dt;
      if(this.objT<=0) this.els.objEl.classList.remove('show');
      else if(this.objT<0.7) this.els.objEl.style.opacity=(this.objT/0.7);
      else this.els.objEl.style.opacity=Math.min(1,(this.objDur-this.objT)/0.5+0.2);
    }
    if(this.fadeCb!==null || this.fadeA!==this.fadeTo){
      this.fadeT+=dt;
      const t=LF.clamp(this.fadeT/this.fadeDur,0,1);
      this.setFade(LF.lerp(this.fadeFrom,this.fadeTo,LF.easeInOut(t)));
      if(t>=1){
        const cb=this.fadeCb; this.fadeCb=null;
        if(cb) cb();
      }
    }
  }
};
LF.UI = UI;
})();
