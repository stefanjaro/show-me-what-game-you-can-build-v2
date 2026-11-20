'use strict';
(function(){
const LF = window.LF;

const MOODS = {
  night:    {bpm:56, chord:[220,261.63,329.63], pad:'sine', cut:420, scale:[220,261.63,293.66,329.63,392,440], dens:0.30, vol:0.06, dur:1.6, type:'triangle'},
  wonder:   {bpm:70, chord:[220,329.63,440,523.25], pad:'sine', cut:520, scale:[440,523.25,587.33,659.25,783.99,880], dens:0.42, vol:0.07, dur:1.2, type:'sine', bell:0.35},
  reeds:    {bpm:60, chord:[146.83,220,293.66], pad:'triangle', cut:380, scale:[293.66,349.23,440,523.25,587.33], dens:0.32, vol:0.06, dur:1.5, type:'sine', crickets:true},
  rapids:   {bpm:92, chord:[110,164.81,246.94], pad:'sawtooth', cut:300, scale:[329.63,392,493.88,587.33,659.25], dens:0.8, vol:0.055, dur:0.5, type:'triangle', bass:true},
  upstream: {bpm:80, chord:[196,246.94,293.66], pad:'triangle', cut:460, scale:[392,440,493.88,587.33,659.25], dens:0.55, vol:0.07, dur:0.8, type:'triangle', bass:true},
  dawn:     {bpm:64, chord:[261.63,329.63,392,523.25], pad:'sine', cut:640, scale:[523.25,587.33,659.25,783.99,880,1046.5], dens:0.42, vol:0.08, dur:1.8, type:'sine', bell:0.5},
  end:      {bpm:48, chord:[261.63,329.63,392,523.25], pad:'sine', cut:700, scale:[523.25,659.25,783.99,1046.5], dens:0.22, vol:0.09, dur:2.6, type:'sine', bell:0.7}
};

const A = {
  ctx:null, ready:false, muted:false, master:null,
  sfxG:null, musG:null, ambG:null, delay:null, windG:null,
  mood:'night', M:MOODS.night, padVoices:[], nextT:0, schedTimer:null,
  noteIdx:3, cricketT:1, noiseBuf:null, birdUntil:0,
  init(){
    if(this.ctx) return;
    try{
      const AC = window.AudioContext || window.webkitAudioContext;
      if(!AC) return;
      const c = this.ctx = new AC();
      this.master = c.createGain(); this.master.gain.value=0.85;
      const comp = c.createDynamicsCompressor();
      this.master.connect(comp); comp.connect(c.destination);
      this.sfxG = c.createGain(); this.sfxG.gain.value=0.9; this.sfxG.connect(this.master);
      this.musG = c.createGain(); this.musG.gain.value=0.5; this.musG.connect(this.master);
      this.ambG = c.createGain(); this.ambG.gain.value=0.7; this.ambG.connect(this.master);
      const d = c.createDelay(1); d.delayTime.value=0.40;
      const fb = c.createGain(); fb.gain.value=0.34;
      const dl = c.createBiquadFilter(); dl.type='lowpass'; dl.frequency.value=2200;
      d.connect(dl); dl.connect(fb); fb.connect(d);
      const wet = c.createGain(); wet.gain.value=0.5; d.connect(wet); wet.connect(this.musG);
      this.delay = d;
      const buf = c.createBuffer(1, c.sampleRate*2, c.sampleRate);
      const ch = buf.getChannelData(0);
      let last=0;
      for(let i=0;i<ch.length;i++){ const w=Math.random()*2-1; last=(last+0.02*w)/1.02; ch[i]=last*3.5; }
      this.noiseBuf = buf;
      const src = c.createBufferSource(); src.buffer=buf; src.loop=true;
      const lp = c.createBiquadFilter(); lp.type='lowpass'; lp.frequency.value=260; lp.Q.value=0.4;
      const g = c.createGain(); g.gain.value=0.30;
      src.connect(lp); lp.connect(g); g.connect(this.ambG);
      const lfo = c.createOscillator(); lfo.frequency.value=0.07;
      const lg = c.createGain(); lg.gain.value=0.10;
      lfo.connect(lg); lg.connect(g.gain); lfo.start();
      src.start();
      const wsrc = c.createBufferSource(); wsrc.buffer=buf; wsrc.loop=true; wsrc.playbackRate.value=1.7;
      const bp = c.createBiquadFilter(); bp.type='bandpass'; bp.frequency.value=520; bp.Q.value=0.9;
      this.windG = c.createGain(); this.windG.gain.value=0.0;
      wsrc.connect(bp); bp.connect(this.windG); this.windG.connect(this.ambG);
      wsrc.start();
      this.ready = true;
      this.setMood(this.mood, true);
      this.nextT = c.currentTime + 0.3;
      this.schedTimer = setInterval(()=>this._sched(), 110);
    }catch(e){ LF.logError('audio-init '+e.message); }
  },
  resume(){ try{ if(this.ctx && this.ctx.state==='suspended') this.ctx.resume(); }catch(e){} },
  toggle(){
    this.muted = !this.muted;
    try{ if(this.master) this.master.gain.setTargetAtTime(this.muted?0:0.85, this.ctx.currentTime, 0.04); }catch(e){}
    return this.muted;
  },
  windLevel(v){ try{ if(this.windG) this.windG.gain.setTargetAtTime(v*0.16, this.ctx.currentTime, 1.2); }catch(e){} },
  duck(v,t){ try{ if(this.musG) this.musG.gain.setTargetAtTime(v, this.ctx.currentTime, t||0.4); }catch(e){} },
  setMood(key, force){
    if(!key || (!force && key===this.mood)) return;
    this.mood = key; this.M = MOODS[key] || MOODS.night;
    if(!this.ready) return;
    try{
      const c=this.ctx, t=c.currentTime;
      for(const v of this.padVoices){
        v.g.gain.setTargetAtTime(0.0001, t, 0.8);
        v.o.stop(t+3.5); v.o2.stop(t+3.5);
      }
      this.padVoices = [];
      const fil = c.createBiquadFilter(); fil.type='lowpass'; fil.frequency.value=this.M.cut; fil.connect(this.musG);
      for(const f of this.M.chord){
        const g = c.createGain(); g.gain.value=0.0001;
        const o = c.createOscillator(); o.type=this.M.pad; o.frequency.value=f; o.detune.value=-4;
        const o2 = c.createOscillator(); o2.type=this.M.pad; o2.frequency.value=f; o2.detune.value=5;
        o.connect(g); o2.connect(g); g.connect(fil);
        g.gain.setTargetAtTime(this.M.vol/this.M.chord.length, t, 2.2);
        o.start(); o2.start();
        this.padVoices.push({o,o2,g});
      }
      if(this.schedTimer) clearInterval(this.schedTimer);
      this.nextT = t + 0.25;
      this.schedTimer = setInterval(()=>this._sched(), 110);
    }catch(e){ LF.logError('mood '+e.message); }
  },
  _sched(){
    if(!this.ready || this.muted) return;
    try{
      const c=this.ctx, t=c.currentTime;
      if(this.nextT < t) this.nextT = t + 0.05;
      while(this.nextT < t + 0.30){
        this._note(this.nextT);
        this.nextT += 30/this.M.bpm;
      }
      if(this.M.crickets){
        this.cricketT -= 0.11;
        if(this.cricketT<=0){
          this.cricketT = LF.rand(0.9, 3.2);
          this._crickets(t);
        }
      }
    }catch(e){ LF.logError('sched '+e.message); }
  },
  _note(when){
    try{
      const c=this.ctx, M=this.M;
      if(LF.chance(M.dens)){
        this.noteIdx = LF.clamp(this.noteIdx + LF.randi(-2,2), 0, M.scale.length-1);
        const f = M.scale[this.noteIdx];
        this._pluck(f, when, M.type, M.vol*LF.rand(0.8,1.6), M.dur);
        if(M.bell && LF.chance(M.bell)) this._bell(f*2, when+0.02, 1.8, M.vol*0.8);
      }
      if(M.bass && LF.chance(0.5)){
        const o=c.createOscillator(); o.type='triangle'; o.frequency.value=M.chord[0]/2;
        const g=c.createGain(); o.connect(g); g.connect(this.musG);
        g.gain.setValueAtTime(0.0001, when);
        g.gain.linearRampToValueAtTime(0.09, when+0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, when+0.42);
        o.start(when); o.stop(when+0.5);
      }
    }catch(e){ LF.logError('note '+e.message); }
  },
  _pluck(f, when, type, vol, dur){
    const c=this.ctx;
    const o=c.createOscillator(); o.type=type; o.frequency.value=f;
    const g=c.createGain();
    o.connect(g); g.connect(this.musG); g.connect(this.delay);
    g.gain.setValueAtTime(0.0001, when);
    g.gain.linearRampToValueAtTime(vol, when+0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, when+dur);
    o.start(when); o.stop(when+dur+0.1);
  },
  _bell(f, when, dur, vol){
    const c=this.ctx;
    const o=c.createOscillator(); o.type='sine'; o.frequency.value=f;
    const m=c.createOscillator(); m.type='sine'; m.frequency.value=f*2.4;
    const mg=c.createGain(); mg.gain.value=f*1.4;
    m.connect(mg); mg.connect(o.frequency);
    const g=c.createGain();
    o.connect(g); g.connect(this.musG); g.connect(this.delay);
    g.gain.setValueAtTime(0.0001, when);
    g.gain.linearRampToValueAtTime(vol, when+0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, when+dur);
    o.start(when); m.start(when); o.stop(when+dur+0.1); m.stop(when+dur+0.1);
  },
  _crickets(t){
    try{
      const c=this.ctx;
      for(let i=0;i<4;i++){
        const when=t+i*0.07+LF.rand(0,0.02);
        const o=c.createOscillator(); o.type='sine'; o.frequency.value=4300+LF.rand(-250,250);
        const g=c.createGain(); o.connect(g); g.connect(this.ambG);
        g.gain.setValueAtTime(0.0001, when);
        g.gain.linearRampToValueAtTime(0.014, when+0.008);
        g.gain.exponentialRampToValueAtTime(0.0001, when+0.05);
        o.start(when); o.stop(when+0.08);
      }
    }catch(e){}
  },
  _noise(dur, when, type, f0, f1, peak, Q){
    const c=this.ctx;
    const src=c.createBufferSource(); src.buffer=this.noiseBuf; src.loop=true;
    src.playbackRate.value=LF.rand(0.8,1.2);
    const fl=c.createBiquadFilter(); fl.type=type; fl.Q.value=Q||0.8;
    fl.frequency.setValueAtTime(f0, when);
    fl.frequency.exponentialRampToValueAtTime(Math.max(40,f1), when+dur);
    const g=c.createGain();
    src.connect(fl); fl.connect(g); g.connect(this.sfxG);
    g.gain.setValueAtTime(0.0001, when);
    g.gain.linearRampToValueAtTime(peak, when+Math.min(0.04,dur*0.2));
    g.gain.exponentialRampToValueAtTime(0.0001, when+dur);
    src.start(when); src.stop(when+dur+0.05);
  },
  _ping(f, when, dur, vol, type){
    const c=this.ctx;
    const o=c.createOscillator(); o.type=type||'sine'; o.frequency.value=f;
    const g=c.createGain(); o.connect(g); g.connect(this.sfxG);
    g.gain.setValueAtTime(0.0001, when);
    g.gain.linearRampToValueAtTime(vol, when+0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, when+dur);
    o.start(when); o.stop(when+dur+0.05);
  },
  splash(v=1){ if(!this.ready) return; try{ const t=this.ctx.currentTime; this._noise(0.22,t,'bandpass',750,320,0.14*v); this._ping(680,t+0.02,0.08,0.03*v,'sine'); }catch(e){} },
  thud(){ if(!this.ready) return; try{ const t=this.ctx.currentTime; const c=this.ctx;
    const o=c.createOscillator(); o.type='sine'; o.frequency.setValueAtTime(95,t); o.frequency.exponentialRampToValueAtTime(42,t+0.16);
    const g=c.createGain(); o.connect(g); g.connect(this.sfxG);
    g.gain.setValueAtTime(0.0001,t); g.gain.linearRampToValueAtTime(0.3,t+0.01); g.gain.exponentialRampToValueAtTime(0.0001,t+0.2);
    o.start(t); o.stop(t+0.25); this._noise(0.08,t,'lowpass',400,200,0.1);
  }catch(e){} },
  crack(){ if(!this.ready) return; try{ const t=this.ctx.currentTime;
    this.thud(); this._noise(0.07,t,'highpass',2400,1200,0.22);
    this._ping(190,t,0.1,0.14,'square'); this._ping(150,t+0.05,0.12,0.1,'square');
  }catch(e){} },
  coin(){ if(!this.ready) return; try{ const t=this.ctx.currentTime; this._ping(1318.5,t,0.1,0.1,'triangle'); this._ping(1760,t+0.07,0.14,0.1,'triangle'); }catch(e){} },
  sparkle(){ if(!this.ready) return; try{ const t=this.ctx.currentTime;
    this._ping(2100,t,0.2,0.06); this._ping(2650,t+0.06,0.24,0.055); this._ping(3300,t+0.13,0.3,0.05);
    this._noise(0.25,t,'highpass',3000,5000,0.03);
  }catch(e){} },
  whoosh(){ if(!this.ready) return; try{ const t=this.ctx.currentTime; this._noise(0.9,t,'bandpass',400,2600,0.09); }catch(e){} },
  hum(){ if(!this.ready) return; try{ const t=this.ctx.currentTime; this._ping(523.25,t,0.5,0.05); this._ping(659.25,t+0.04,0.6,0.045); this._ping(783.99,t+0.09,0.7,0.03); }catch(e){} },
  bells(){ if(!this.ready) return; try{ const t=this.ctx.currentTime;
    this._bell(523.25,t,2.8,0.09); this._bell(659.25,t+0.7,2.6,0.08); this._bell(783.99,t+1.3,2.6,0.07); this._bell(1046.5,t+2.2,3.2,0.07);
  }catch(e){} },
  lark(){ if(!this.ready) return; try{ const t=this.ctx.currentTime; const c=this.ctx;
    for(let i=0;i<6;i++){
      const when=t+i*0.16, f=1400+i*260;
      const o=c.createOscillator(); o.type='sine';
      o.frequency.setValueAtTime(f,when);
      o.frequency.exponentialRampToValueAtTime(f+520,when+0.12);
      const g=c.createGain(); o.connect(g); g.connect(this.sfxG);
      g.gain.setValueAtTime(0.0001,when); g.gain.linearRampToValueAtTime(0.06,when+0.02);
      g.gain.exponentialRampToValueAtTime(0.0001,when+0.15);
      o.start(when); o.stop(when+0.2);
    }
  }catch(e){} },
  bird(){
    if(!this.ready) return;
    try{
      const c=this.ctx, t0=c.currentTime+0.15;
      this.duck(0.12,0.5);
      this.musG.gain.setTargetAtTime(0.5,t0+8.5,1.5);
      const phrases=[
        [0.00,2800,2400,0.16],[0.22,3100,3500,0.18],[0.46,2600,2300,0.20],
        [0.78,3300,3800,0.14],[0.94,2900,2700,0.15],[1.18,3600,4200,0.22],
        [1.60,2400,2000,0.25],[2.05,3200,3600,0.12],[2.22,3000,3400,0.12],[2.40,3800,4300,0.30],
        [3.40,2900,3300,0.18],[3.65,3600,3000,0.20],[3.95,2700,3100,0.16],[4.15,3900,4400,0.34],
        [5.30,3200,2800,0.22],[5.62,2400,2900,0.2],[5.9,3400,4200,0.4]
      ];
      for(const [dt,f0,f1,d] of phrases){
        const when=t0+dt;
        const o=c.createOscillator(); o.type='sine';
        o.frequency.setValueAtTime(f0,when);
        o.frequency.exponentialRampToValueAtTime(f1,when+d*0.9);
        const lfo=c.createOscillator(); lfo.type='sine'; lfo.frequency.value=31;
        const lg=c.createGain(); lg.gain.value=60;
        lfo.connect(lg); lg.connect(o.frequency); lfo.start(when); lfo.stop(when+d);
        const g=c.createGain(); o.connect(g); g.connect(this.sfxG); g.connect(this.delay);
        g.gain.setValueAtTime(0.0001,when);
        g.gain.linearRampToValueAtTime(0.055,when+0.03);
        g.gain.setValueAtTime(0.055,when+d*0.6);
        g.gain.exponentialRampToValueAtTime(0.0001,when+d);
        o.start(when); o.stop(when+d+0.05);
      }
    }catch(e){ LF.logError('bird '+e.message); }
  },
  suck(){ if(!this.ready) return; try{ const t=this.ctx.currentTime;
    this._noise(0.7,t,'bandpass',180,900,0.18);
    const c=this.ctx;
    const o=c.createOscillator(); o.type='sine'; o.frequency.setValueAtTime(70,t); o.frequency.exponentialRampToValueAtTime(30,t+0.6);
    const g=c.createGain(); o.connect(g); g.connect(this.sfxG);
    g.gain.setValueAtTime(0.0001,t); g.gain.linearRampToValueAtTime(0.2,t+0.05); g.gain.exponentialRampToValueAtTime(0.0001,t+0.7);
    o.start(t); o.stop(t+0.75);
  }catch(e){} },
  rustle(){ if(!this.ready) return; try{ const t=this.ctx.currentTime; this._noise(0.12,t,'highpass',2600,3600,0.05); this._noise(0.1,t+0.08,'highpass',2200,3000,0.04); }catch(e){} },
  dock(){ if(!this.ready) return; try{ const t=this.ctx.currentTime;
    this._ping(160,t,0.18,0.14,'sine'); this._noise(0.1,t,'lowpass',500,300,0.08);
    const c=this.ctx;
    const o=c.createOscillator(); o.type='sawtooth'; o.frequency.value=88;
    const lfo=c.createOscillator(); lfo.frequency.value=9;
    const lg=c.createGain(); lg.gain.value=14; lfo.connect(lg); lg.connect(o.frequency);
    const g=c.createGain(); o.connect(g); g.connect(this.sfxG);
    g.gain.setValueAtTime(0.0001,t); g.gain.linearRampToValueAtTime(0.02,t+0.06); g.gain.exponentialRampToValueAtTime(0.0001,t+0.4);
    o.start(t); lfo.start(t); o.stop(t+0.45); lfo.stop(t+0.45);
  }catch(e){} },
  blip(){ if(!this.ready) return; try{ this._ping(880,this.ctx.currentTime,0.03,0.012,'sine'); }catch(e){} }
};
LF.Audio = A;
})();
