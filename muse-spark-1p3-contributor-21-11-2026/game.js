/* EMBERFALL — The Last Lighthouse
   A 3-act tiny epic. Canvas 2D, procedural art, synthesized audio. No assets.
   Act I: boat crossing (top-down dodge) · Act II: cliff climb (platformer) · Act III: spiral + burn
*/
(() => {
"use strict";
const W = 960, H = 600;
const cv = document.getElementById('game');
const ctx = cv.getContext('2d');
const el = id => document.getElementById(id);
const overlay = el('overlay'), startBtn = el('startBtn');
const emberBar = el('emberBar'), chapterTag = el('chapterTag');
const captionEl = el('caption'), toastEl = el('toast');

// ---------- utils ----------
const clamp=(v,a,b)=>v<a?a:v>b?b:v;
const lerp=(a,b,t)=>a+(b-a)*t;
const rand=(a,b)=>a+Math.random()*(b-a);
const randi=(a,b)=>Math.floor(rand(a,b+1));
const dist2=(x1,y1,x2,y2)=>{const dx=x2-x1,dy=y2-y1;return dx*dx+dy*dy;};
const TAU=Math.PI*2;

// ---------- input ----------
const keys={};
const mouse={x:W/2,y:H/2,down:false};
addEventListener('keydown',e=>{
  const k=e.key.toLowerCase();
  keys[k]=true;
  if([' ','arrowup','arrowdown','arrowleft','arrowright'].includes(k)) e.preventDefault();
  if(k==='m') Audio2.toggle();
  if(k==='enter') Game.advanceStory();
  if(k==='r') Game.respawn();
});
addEventListener('keyup',e=>{keys[e.key.toLowerCase()]=false;});
function canvasPos(e){const r=cv.getBoundingClientRect();return{x:(e.clientX-r.left)*W/r.width,y:(e.clientY-r.top)*H/r.height};}
cv.addEventListener('mousemove',e=>{const p=canvasPos(e);mouse.x=p.x;mouse.y=p.y;});
cv.addEventListener('mousedown',e=>{mouse.down=true;const p=canvasPos(e);mouse.x=p.x;mouse.y=p.y;});
addEventListener('mouseup',()=>mouse.down=false);

// ---------- audio (all synthesized) ----------
const Audio2={
  ctx:null,muted:false,master:null,
  init(){ if(this.ctx) return; try{
    this.ctx=new (window.AudioContext||window.webkitAudioContext)();
    this.master=this.ctx.createGain(); this.master.gain.value=0.5; this.master.connect(this.ctx.destination);
    this.startWind();
  }catch(e){} },
  toggle(){ this.muted=!this.muted; if(this.master) this.master.gain.value=this.muted?0:0.5; toast(this.muted?'sound off':'sound on'); },
  tone(f,dur,type='sine',vol=0.2,slide=0,delay=0){ if(!this.ctx||this.muted)return;
    const t=this.ctx.currentTime+delay, o=this.ctx.createOscillator(), g=this.ctx.createGain();
    o.type=type; o.frequency.setValueAtTime(f,t);
    if(slide) o.frequency.exponentialRampToValueAtTime(Math.max(20,f+slide),t+dur);
    g.gain.setValueAtTime(0.0001,t); g.gain.exponentialRampToValueAtTime(vol,t+0.02);
    g.gain.exponentialRampToValueAtTime(0.0001,t+dur);
    o.connect(g); g.connect(this.master); o.start(t); o.stop(t+dur+0.05); },
  noise(dur=0.3,vol=0.15,fc=800,delay=0){ if(!this.ctx||this.muted)return;
    const t=this.ctx.currentTime+delay, len=Math.floor(this.ctx.sampleRate*dur);
    const buf=this.ctx.createBuffer(1,len,this.ctx.sampleRate), d=buf.getChannelData(0);
    for(let i=0;i<len;i++)d[i]=(Math.random()*2-1)*(1-i/len);
    const s=this.ctx.createBufferSource(); s.buffer=buf;
    const f=this.ctx.createBiquadFilter(); f.type='lowpass'; f.frequency.value=fc;
    const g=this.ctx.createGain(); g.gain.value=vol;
    s.connect(f);f.connect(g);g.connect(this.master); s.start(t); },
  chime(n=3,base=660){ for(let i=0;i<n;i++) this.tone(base*Math.pow(1.335,i),0.5,'sine',0.12,0,i*0.09); },
  sad(){ this.tone(330,1.2,'triangle',0.15,-140); this.tone(220,1.6,'sine',0.12,-60,0.25); },
  pickup(){ this.tone(880,0.25,'sine',0.14,440); this.tone(1320,0.3,'sine',0.08,0,0.06); },
  hurtS(){ this.noise(0.25,0.25,500); this.tone(160,0.35,'sawtooth',0.12,-80); },
  jumpS(){ this.tone(300,0.18,'square',0.06,220); },
  flareS(){ this.noise(0.4,0.2,2500); this.tone(200,0.5,'sawtooth',0.1,500); },
  stunS(){ this.tone(1200,0.3,'sine',0.12,-700); },
  winS(){ [523,659,784,1046,1318].forEach((f,i)=>this.tone(f,0.6,'triangle',0.12,0,i*0.12)); },
  startWind(){ // looping wind bed: filtered noise buffer looped + slow LFO
    const c=this.ctx, len=c.sampleRate*2, buf=c.createBuffer(1,len,c.sampleRate), d=buf.getChannelData(0);
    for(let i=0;i<len;i++)d[i]=Math.random()*2-1;
    const s=c.createBufferSource(); s.buffer=buf; s.loop=true;
    const f=c.createBiquadFilter(); f.type='lowpass'; f.frequency.value=400; f.Q.value=0.6;
    const g=c.createGain(); g.gain.value=0.035;
    const lfo=c.createOscillator(); lfo.frequency.value=0.13;
    const lg=c.createGain(); lg.gain.value=0.02; lfo.connect(lg); lg.connect(g.gain);
    s.connect(f);f.connect(g);g.connect(this.master); s.start(); lfo.start();
    // deep drone
    const o=c.createOscillator(); o.type='sine'; o.frequency.value=55;
    const og=c.createGain(); og.gain.value=0.03; o.connect(og); og.connect(this.master); o.start();
  }
};

// ---------- global game state ----------
const Game={
  state:'boot', // boot, story, ch1, ch2, ch3a, ch3b, ending
  ember:80, deaths:0, flies:0, time:0,
  shake:0, flash:0, slowmo:1, fade:0, fadeDir:0,
  storyIdx:0, storyChar:0, storyTimer:0, storyDone:false,
  chapter:1, camX:0, camY:0, progress01:0,
  captionTimer:0, hudTick:0,
  advanceStory(){ if(this.state==='story') Story.next(); else if(this.state==='ending'&&Ending.done) Ending.restartPrompt(); },
  respawn(){
    if(this.state==='ch1') Ch1.respawn();
    else if(this.state==='ch2') Ch2.respawn();
    else if(this.state==='ch3a') Ch3a.respawn();
    else if(this.state==='ch3b') Ch3b.respawn();
  },
  setChapter(n,label){ this.chapter=n; chapterTag.textContent=label; },
  hurtPlayer(amount, how){
    if(P.iframes>0||this.state==='story'||this.state==='ending'||this._dead) return;
    this.ember-=amount; P.iframes=1.1; this.shake=Math.min(14,this.shake+8); this.flash=0.55;
    Audio2.hurtS(); burst(P.x,P.y,16,'255,90,40',160);
    caption(how||'The dark takes a bite of your light…');
    if(this.ember<=0) this.die();
  },
  die(){
    if(this._dead) return; this._dead=true;
    this.deaths++; Audio2.sad();
    this.slowmo=0.25; this.fadeDir=1;
    burst(P.x,P.y,40,'255,150,50',260); burst(P.x,P.y,20,'100,100,140',140);
    caption('…the ember gutters. But someone is still waiting. (R to rise again)');
    setTimeout(()=>{ this.slowmo=1; this.fadeDir=-1; this.ember=65; this._dead=false; this.respawn(); },900);
  }
};
// shared player-light position used by lighting + death fx
const P={x:W/2,y:H/2,iframes:0};

// ---------- particles ----------
const parts=[];
function burst(x,y,n,color,spd=120,life=0.8,size=3){
  for(let i=0;i<n;i++){const a=rand(0,TAU),s=rand(spd*0.3,spd);
    parts.push({x,y,vx:Math.cos(a)*s,vy:Math.sin(a)*s,life:rand(life*0.5,life),max:life,color,size:rand(1,size),drag:0.96,grav:0});}
}
function updateParts(dt){
  for(let i=parts.length-1;i>=0;i--){const p=parts[i];p.life-=dt;
    if(p.life<=0){parts.splice(i,1);continue;}
    p.x+=p.vx*dt;p.y+=p.vy*dt;p.vx*=p.drag;p.vy=p.vy*p.drag+(p.grav||0)*dt;}
  if(parts.length>900) parts.splice(0,parts.length-900);
}
function drawParts(front){
  ctx.save(); ctx.globalCompositeOperation='lighter';
  for(const p of parts){const a=clamp(p.life/p.max,0,1);
    ctx.fillStyle=`rgba(${p.color},${(a*0.9).toFixed(3)})`;
    ctx.beginPath();ctx.arc(p.x,p.y,p.size*a+0.4,0,TAU);ctx.fill();}
  ctx.restore();
}
const floats=[]; // floating score texts
function floatText(x,y,t,color='#ffe1a0'){floats.push({x,y,t,life:1.4});}
function updateFloats(dt){for(let i=floats.length-1;i>=0;i--){const f=floats[i];f.life-=dt;f.y-=34*dt;if(f.life<=0)floats.splice(i,1);}}
function drawFloats(){ctx.save();ctx.textAlign='center';ctx.font='italic 15px Georgia';
  for(const f of floats){ctx.globalAlpha=clamp(f.life,0,1);ctx.fillStyle='#ffe1a0';ctx.fillText(f.t,f.x,f.y);}ctx.restore();}

// ---------- caption / toast ----------
let toastTO=null;
function toast(t,ms=2200){toastEl.textContent=t;toastEl.style.opacity=1;clearTimeout(toastTO);toastTO=setTimeout(()=>toastEl.style.opacity=0,ms);}
function caption(t,ms=3400){captionEl.textContent=t;Game.captionTimer=ms/1000;}

// ---------- STORY ----------
const Story={
  cards:[
    {t:'EMBERFALL', s:'the last lighthouse', lines:[
      'The sun shattered seven years ago. The sky has been a bruise ever since.',
      'Only the Great Lighthouse still burns — and last night, its keeper (your mother) did not come home.',
      '',
      'On the table: her brass lantern, still warm. Inside it, one last ember — breathing, afraid, alive.',
      '“Take me home,” it seems to whisper. “Before I go out.”',
      '',
      'You wrap it in your coat. You untie her little boat. The drowned islands wait, black and hungry.'
    ]},
    {t:'I · THE DROWNED CROSSING', s:'row, little keeper, row', lines:[
      'Steer with WASD / ARROWS. Your ember drains in the rain — gather FIREFLIES to feed it.',
      'SPACE looses a FLARE: it burns back the pale wraiths and kicks your boat forward. (Costs ember. Worth it.)',
      '',
      'Reach the lighthouse rock alive. The beacon is small now… but it is still there.'
    ]},
    {t:'II · THE CLIMB', s:'she used to sing while she climbed', lines:[
      'A/D or ←/→ to move. SPACE to jump — press again against a wall to WALL-JUMP.',
      'Moths are fuel. Bats are thieves — press K or CLICK to swing the lantern when they crowd you.',
      'Pale-blue ribbons are wind: they will carry you, or betray you. R restarts at your last ledge.'
    ]},
    {t:'III · THE SPIRAL', s:'what the dark keeps', lines:[
      'Inside, the light has forgotten itself. Find the THREE MIRROR SHARDS.',
      'Move with WASD. Your lantern follows your MOUSE — its beam STUNS the grieving shadows.',
      'Then climb the flue. HOLD SPACE to BURN bright and fast — but burning spends the very thing you carry…',
      '',
      'Whatever happens: do not put the lantern down.'
    ]},
  ],
  active:0, charsShown:0, tAcc:0, lineDelay:0,
  start(i){ Game.state='story'; this.active=i; this.charsShown=0; this.tAcc=0; Game.storyDone=false; },
  next(){
    // if typing, complete instantly; else advance
    const total=this.fullText().length;
    if(this.charsShown<total){this.charsShown=total;return;}
    if(this.active===0){this.start(1);Ch1.begin();hintCh1();}
    else if(this.active===1){Game.state='ch1';caption('Row north. Follow the beacon.',4);}
    else if(this.active===2){Game.state='ch2';caption('Climb. She is counting your footsteps.',4);}
    else if(this.active===3){Game.state='ch3a';caption('Find 3 mirror shards. The beam stuns them — aim with your mouse.',5);}
  },
  fullText(){const c=this.cards[this.active];return c.t+'\n'+c.s+'\n'+c.lines.join('\n');},
  update(dt){
    const total=this.fullText().length;
    if(this.charsShown<total){this.tAcc+=dt;const sp=(keys[' ']||keys['enter'])?240:55;
      this.charsShown=Math.min(total,this.charsShown+sp*dt);}
  },
  draw(){
    // dim backdrop over frozen scene
    ctx.fillStyle='rgba(3,5,12,0.86)';ctx.fillRect(0,0,W,H);
    drawVignette(0.9);
    const c=this.cards[this.active];
    const txt=this.fullText().slice(0,Math.floor(this.charsShown));
    const lines=txt.split('\n');
    ctx.textAlign='center';
    let y=this.active===0?120:100;
    lines.forEach((ln,i)=>{
      if(i===0){ctx.font='700 44px Cinzel, serif';ctx.fillStyle='#ffd98a';
        ctx.shadowColor='#ff8c00';ctx.shadowBlur=24;ctx.fillText(ln,W/2,y);ctx.shadowBlur=0;y+=44;}
      else if(i===1){ctx.font='italic 19px Georgia';ctx.fillStyle='#9d9174';ctx.fillText('— '+ln+' —',W/2,y);y+=42;}
      else{ctx.font=(ln.startsWith('“')||ln.startsWith('Reach')||ln.startsWith('Whatever'))?'italic 18px Georgia':'17px Georgia';
        ctx.fillStyle=ln===''?'#000':'#e6d9b8';if(ln!=='')ctx.fillText(ln,W/2,y);y+=27;}
    });
    // ember candle animation
    drawCandle(W/2,H-118,performance.now()/1000);
    if(this.charsShown>=this.fullText().length){
      ctx.font='15px Cinzel, serif';ctx.fillStyle='#8d846d';
      const bl=Math.sin(performance.now()/400)*0.3+0.7;ctx.globalAlpha=bl;
      ctx.fillText(this.active%2===0?'— press ENTER to shoulder the lantern —':'— press ENTER to begin —',W/2,H-40);
      ctx.globalAlpha=1;
    }
  }
};
function drawCandle(x,y,t){
  ctx.save();ctx.translate(x,y);
  ctx.fillStyle='#3a2c1c';ctx.fillRect(-14,-2,28,26);
  ctx.fillStyle='#241a10';ctx.fillRect(-18,22,36,6);
  const fl=6+Math.sin(t*9)*1.4+Math.sin(t*23)*0.8;
  const g=ctx.createRadialGradient(0,-8,2,0,-8,60);
  g.addColorStop(0,'rgba(255,220,140,0.9)');g.addColorStop(0.4,'rgba(255,140,40,0.35)');g.addColorStop(1,'rgba(255,120,20,0)');
  ctx.fillStyle=g;ctx.beginPath();ctx.arc(0,-8,60,0,TAU);ctx.fill();
  ctx.fillStyle='#fff3c0';ctx.beginPath();ctx.ellipse(0,-8,4,fl,0,0,TAU);ctx.fill();
  ctx.fillStyle='#ff9d00';ctx.beginPath();ctx.ellipse(0,-6,7,fl*1.4,0,0,TAU);ctx.fill();
  ctx.restore();
}
function hintCh1(){}
function drawVignette(strength=0.55){
  const g=ctx.createRadialGradient(W/2,H/2,H*0.32,W/2,H/2,H*0.78);
  g.addColorStop(0,'rgba(0,0,0,0)');g.addColorStop(1,`rgba(0,0,0,${strength})`);
  ctx.fillStyle=g;ctx.fillRect(0,0,W,H);
}
// film grain
const grainCv=document.createElement('canvas');grainCv.width=160;grainCv.height=100;
function drawGrain(a=0.05){
  const g=grainCv.getContext('2d'),id=g.createImageData(160,100),d=id.data;
  for(let i=0;i<d.length;i+=4){const v=Math.random()*255;d[i]=d[i+1]=d[i+2]=v;d[i+3]=255;}
  g.putImageData(id,0,0);ctx.save();ctx.globalAlpha=a;ctx.drawImage(grainCv,0,0,W,H);ctx.restore();
}

/* ================= CHAPTER I — DROWNED CROSSING ================= */
const Ch1={
  boat:{x:0,y:0,vx:0,vy:0,ang:-Math.PI/2}, rocks:[],flies:[],wraiths:[],whirls:[],ships:[],
  goalY:-5600, spawnY:200, gustT:0, gustX:0, gustDur:0, flareCD:0, rain:[],
  begin(){
    Game.setChapter(1,'I · THE DROWNED CROSSING'); Game.ember=Math.max(Game.ember,80);
    const b=this.boat; b.x=rand(-40,40);b.y=0;b.vx=0;b.vy=0;
    this.rocks=[];this.flies=[];this.wraiths=[];this.whirls=[];this.ships=[];this.spawnY=-1500;
    this.gustT=3;this.flareCD=0;this.rain=[];
    for(let i=0;i<140;i++)this.rain.push({x:rand(0,W),y:rand(0,H),s:rand(500,900)});
    for(let i=0;i<5;i++)this.spawnRow(-i*400+100);
    Game.camX=0;Game.camY=0;
    caption('The rain hates your little light. Keep it fed.',4);
    toast('follow the beacon ↑ · grab fireflies');
  },
  respawn(){
    const b=this.boat; b.vx=0;b.vy=0;
    b.y=Math.min(b.y+300,0); // pull back a little
    this.wraiths=this.wraiths.filter(w=>dist2(w.x,w.y,b.x,b.y)>500*500);
  },
  spawnRow(yTop){
    // yTop is world y (more negative = further). spawn band ahead
    for(let i=0;i<7;i++){
      if(Math.random()<0.72) this.rocks.push({x:rand(-420,420),y:yTop-rand(0,380),r:rand(16,42)});
    }
    for(let i=0;i<4;i++) if(Math.random()<0.8) this.flies.push({x:rand(-380,380),y:yTop-rand(0,380),t:rand(0,9),got:false});
    if(Math.random()<0.5) this.whirls.push({x:rand(-350,350),y:yTop-rand(0,380),r:rand(46,70)});
    if(yTop<-600&&Math.random()<0.55) this.ships.push({x:Math.random()<0.5?-460:460,y:yTop-rand(0,300),vx:(Math.random()<0.5?-1:1)*rand(50,90),w:120});
    if(yTop<-400&&Math.random()<0.75) this.wraiths.push({x:rand(-380,380),y:yTop-100,hp:1,t:rand(0,9)});
  },
  update(dt){
    const b=this.boat;
    // wind gusts
    this.gustT-=dt;
    if(this.gustT<=0){this.gustT=rand(4,8);this.gustX=rand(-260,260);this.gustDur=rand(1.2,2.2);
      toast(this.gustX>0?'gust from the west! →':'← gust from the east!');Audio2.noise(0.8,0.12,600);}
    let windX=0;if(this.gustDur>0){this.gustDur-=dt;windX=this.gustX*(this.gustDur);}
    // input
    const ax=((keys['d']||keys['arrowright'])?1:0)-((keys['a']||keys['arrowleft'])?1:0);
    const ay=((keys['s']||keys['arrowdown'])?1:0)-((keys['w']||keys['arrowup'])?1:0);
    b.vx+=(ax*950+windX)*dt; b.vy+=(ay*950)*dt;
    // whirlpool pull
    for(const w of this.whirls){const d2=dist2(b.x,b.y,w.x,w.y);
      if(d2<(w.r*4)*(w.r*4)){const d=Math.sqrt(d2)||1, f=(1-d/(w.r*4))*420;
        b.vx+=(w.x-b.x)/d*f*dt; b.vy+=(w.y-b.y)/d*f*dt;
        if(d<w.r*0.55) Game.hurtPlayer(14*dt*3,'The whirlpool drinks your warmth…');}}
    // drag + clamp
    b.vx*=Math.pow(0.35,dt); b.vy*=Math.pow(0.35,dt);
    const sp=Math.hypot(b.vx,b.vy),max=285;
    if(sp>max){b.vx*=max/sp;b.vy*=max/sp;}
    b.x+=b.vx*dt;b.y+=b.vy*dt;
    b.x=clamp(b.x,-460,460);
    if(b.y>60){b.y=60;b.vy=Math.min(0,b.vy);}
    if(sp>40) b.ang=Math.atan2(b.vy,b.vx);
    P.x=b.x;P.y=b.y;
    Game.ember-=dt*2.6;
    // flare
    this.flareCD-=dt;
    if(keys[' ']&&this.flareCD<=0){
      if(Game.ember>14){Game.ember-=8;this.flareCD=1.1;Audio2.flareS();Game.shake+=5;
        b.vx+=Math.cos(b.ang)*260;b.vy+=Math.sin(b.ang)*260;
        burst(b.x,b.y,40,'255,180,80',320,0.7,4);
        for(let i=this.wraiths.length-1;i>=0;i--){const w=this.wraiths[i];
          if(dist2(w.x,w.y,b.x,b.y)<150*150){burst(w.x,w.y,24,'180,200,255',200);this.wraiths.splice(i,1);Game.ember=Math.min(100,Game.ember+4);floatText(w.x,w.y,'+4');}}
        keys[' ']=false;
      } else {toast('not enough ember for a flare!');keys[' ']=false;}
    }
    // spawn ahead / cleanup
    while(this.spawnY>b.y-900){this.spawnY-=400;this.spawnRow(this.spawnY);}
    const keep=(o)=>o.y>b.y+400;
    this.rocks=this.rocks.filter(keep);this.flies=this.flies.filter(f=>!f.got&&keep(f));
    this.whirls=this.whirls.filter(keep);this.ships=this.ships.filter(keep);this.wraiths=this.wraiths.filter(keep);
    // ships move
    for(const s of this.ships){s.x+=s.vx*dt;if(s.x<-520)s.x=520;if(s.x>520)s.x=-520;}
    // wraith homing
    for(const w of this.wraiths){w.t+=dt;const dx=b.x-w.x,dy=b.y-w.y,d=Math.hypot(dx,dy)||1;
      const s=d<320?95:40;w.x+=dx/d*s*dt+Math.cos(w.t*2)*20*dt;w.y+=dy/d*s*dt;
      if(d<26)Game.hurtPlayer(16,'A drowned one brushed your boat…');}
    // collisions: rocks
    if(P.iframes<=0)for(const r of this.rocks){
      if(dist2(b.x,b.y,r.x,r.y)<(r.r+13)*(r.r+13)){Game.hurtPlayer(18,'Rocks! Steer, keeper, steer!');
        b.vx*=-0.4;b.vy*=-0.4;burst(b.x,b.y,18,'150,170,200',220);break;}}
    // ships collision (approx as 2 circles)
    if(P.iframes<=0)for(const s of this.ships){
      if(dist2(b.x,b.y,s.x-35,s.y)<52*52||dist2(b.x,b.y,s.x+35,s.y)<52*52){
        Game.hurtPlayer(22,'The ghost ship does not see you. It never sees anyone.');b.vx*=-0.5;break;}}
    // fireflies
    for(const f of this.flies){f.t+=dt*3;
      if(!f.got&&dist2(b.x,b.y,f.x,f.y)<30*30){f.got=true;Game.ember=Math.min(100,Game.ember+13);
        Game.flies++;Audio2.pickup();burst(f.x,f.y,18,'255,230,150',150);floatText(f.x,f.y,'+13');}}
    // rain
    for(const r of this.rain){r.y+=r.s*dt;r.x-=80*dt;if(r.y>H){r.y=-10;r.x=rand(0,W+40);}}
    // light trail
    if(Math.random()<0.5)parts.push({x:b.x+rand(-6,6),y:b.y+rand(-6,6),vx:rand(-20,20),vy:rand(30,80),life:0.7,max:0.7,color:'255,170,60',size:rand(1,2.5),drag:0.97,grav:0});
    Game.camX=lerp(Game.camX,b.x*0.55,1-Math.pow(0.001,dt));
    Game.camY=lerp(Game.camY,b.y,1-Math.pow(0.0005,dt));
    Game.progress01=clamp(-b.y/-this.goalY,0,1);
    if(P.iframes>0)P.iframes-=dt;
    if(Game.ember<=0){Game.die();return;}
    P.x=b.x;P.y=b.y;
    if(b.y<=this.goalY){ // arrived
      Audio2.winS();Game.state='story';Story.start(2);Ch2.build();
      burst(b.x,b.y,60,'255,200,100',300,1.2,4);
    }
  },
  draw(){
    const camX=Game.camX,camY=Game.camY;
    const sx=x=>x-camX+W/2, sy=y=>y-camY+H/2;
    // sea gradient
    const g=ctx.createLinearGradient(0,0,0,H);
    const night=clamp(0.4+Game.progress01*0.4,0,0.8);
    g.addColorStop(0,'#0a1428');g.addColorStop(0.6,'#0d1b33');g.addColorStop(1,'#081020');
    ctx.fillStyle=g;ctx.fillRect(0,0,W,H);
    // moon + beacon glow on horizon
    const prog=Game.progress01;
    const bx=W/2+(0-camX)*0.2, by=90-prog*30;
    ctx.save();ctx.globalCompositeOperation='lighter';
    const bg=ctx.createRadialGradient(bx,by,4,bx,by,120+prog*160);
    bg.addColorStop(0,'rgba(255,190,90,0.85)');bg.addColorStop(0.4,'rgba(255,140,50,0.25)');bg.addColorStop(1,'rgba(255,120,20,0)');
    ctx.fillStyle=bg;ctx.beginPath();ctx.arc(bx,by,280,0,TAU);ctx.fill();ctx.restore();
    // lighthouse silhouette grows
    const lh=30+prog*120, lx=bx, ly=by+8;
    ctx.fillStyle='#05080f';
    ctx.fillRect(lx-10,ly-lh,20,lh);
    ctx.beginPath();ctx.moveTo(lx-14,ly-lh);ctx.lineTo(lx+14,ly-lh);ctx.lineTo(lx,ly-lh-18);ctx.fill();
    // rotating beam
    const t=performance.now()/1000;
    ctx.save();ctx.globalCompositeOperation='lighter';ctx.globalAlpha=0.25+prog*0.3;
    for(const a of [t*0.7,t*0.7+Math.PI]){
      const grd=ctx.createLinearGradient(lx,ly-lh,lx+Math.cos(a)*500,ly-lh+Math.sin(a)*120);
      grd.addColorStop(0,'rgba(255,220,150,0.5)');grd.addColorStop(1,'rgba(255,220,150,0)');
      ctx.fillStyle=grd;ctx.beginPath();ctx.moveTo(lx,ly-lh);
      ctx.lineTo(lx+Math.cos(a-0.06)*500,ly-lh+Math.sin(a-0.06)*120);
      ctx.lineTo(lx+Math.cos(a+0.06)*500,ly-lh+Math.sin(a+0.06)*120);ctx.fill();}
    ctx.restore();
    // waves (parallax sine bands)
    ctx.strokeStyle='rgba(120,170,220,0.16)';ctx.lineWidth=2;
    for(let r=0;r<5;r++){ctx.beginPath();
      for(let x=0;x<=W;x+=16){const wx=x+camX*0.3, wy=H*0.25+r*80+Math.sin(wx*0.02+t*(1+r*0.3)+r*2)*10+((camY*0.4)%40);
        x===0?ctx.moveTo(x,wy):ctx.lineTo(x,wy);}ctx.stroke();}
    const b=this.boat;
    // whirlpools
    for(const w of this.whirls){const X=sx(w.x),Y=sy(w.y);if(Y<-100||Y>H+100)continue;
      ctx.save();ctx.translate(X,Y);ctx.rotate(t*2);
      for(let i=0;i<3;i++){ctx.strokeStyle=`rgba(120,160,220,${0.35-i*0.1})`;ctx.lineWidth=3;
        ctx.beginPath();ctx.ellipse(0,0,w.r*(0.5+i*0.4),w.r*(0.3+i*0.25),0,0,TAU);ctx.stroke();}
      ctx.restore();}
    // rocks
    for(const r of this.rocks){const X=sx(r.x),Y=sy(r.y);if(Y<-80||Y>H+80)continue;
      ctx.fillStyle='#131c2c';ctx.beginPath();ctx.arc(X,Y,r.r,0,TAU);ctx.fill();
      ctx.fillStyle='#232f47';ctx.beginPath();ctx.arc(X-r.r*0.2,Y-r.r*0.25,r.r*0.7,0,TAU);ctx.fill();
      ctx.strokeStyle='rgba(160,200,240,0.35)';ctx.lineWidth=2;ctx.beginPath();ctx.arc(X,Y,r.r+3+Math.sin(t*2+X)*2,0,TAU);ctx.stroke();}
    // ghost ships
    for(const s of this.ships){const X=sx(s.x),Y=sy(s.y);if(Y<-100||Y>H+100)continue;
      ctx.save();ctx.translate(X,Y);ctx.globalAlpha=0.75;
      ctx.fillStyle='#1a2438';ctx.fillRect(-60,-10,120,22);
      ctx.fillRect(-14,-52,10,44);ctx.fillRect(14,-44,8,36);
      ctx.fillStyle='rgba(200,220,255,0.25)';ctx.fillRect(-30,-52,34,40);ctx.fillRect(0,-44,28,32);
      ctx.fillStyle='rgba(150,200,255,0.8)';ctx.fillRect(-60,14,120,3);
      ctx.restore();ctx.globalAlpha=1;}
    // fireflies (screen space world)
    ctx.save();ctx.globalCompositeOperation='lighter';
    for(const f of this.flies){if(f.got)continue;const X=sx(f.x),Y=sy(f.y);if(Y<-40||Y>H+40)continue;
      const p=1+Math.sin(f.t)*0.25;
      const fg=ctx.createRadialGradient(X,Y,1,X,Y,22*p);
      fg.addColorStop(0,'rgba(255,240,180,0.95)');fg.addColorStop(0.5,'rgba(255,190,80,0.4)');fg.addColorStop(1,'rgba(255,170,50,0)');
      ctx.fillStyle=fg;ctx.beginPath();ctx.arc(X,Y,22*p,0,TAU);ctx.fill();
      ctx.fillStyle='#fff6d8';ctx.beginPath();ctx.arc(X,Y,3,0,TAU);ctx.fill();}
    ctx.restore();
    // wraiths
    for(const w of this.wraiths){const X=sx(w.x),Y=sy(w.y);if(Y<-60||Y>H+60)continue;
      ctx.save();ctx.translate(X,Y+Math.sin(w.t*3)*5);ctx.globalAlpha=0.9;
      const wg=ctx.createRadialGradient(0,0,2,0,0,30);
      wg.addColorStop(0,'rgba(20,26,44,0.95)');wg.addColorStop(0.7,'rgba(90,110,180,0.35)');wg.addColorStop(1,'rgba(120,140,220,0)');
      ctx.fillStyle=wg;ctx.beginPath();ctx.arc(0,0,30,0,TAU);ctx.fill();
      ctx.fillStyle='#cfe0ff';ctx.fillRect(-8,-4,5,8);ctx.fillRect(3,-4,5,8);
      ctx.restore();}
    // boat
    const BX=sx(b.x),BY=sy(b.y);
    ctx.save();ctx.translate(BX,BY);ctx.rotate(b.ang+Math.PI/2);
    if(P.iframes>0&&Math.floor(performance.now()/90)%2===0)ctx.globalAlpha=0.35;
    ctx.fillStyle='#4a3520';ctx.beginPath();ctx.ellipse(0,0,11,20,0,0,TAU);ctx.fill();
    ctx.fillStyle='#6b4c2c';ctx.beginPath();ctx.ellipse(0,-2,7,14,0,0,TAU);ctx.fill();
    ctx.restore();ctx.globalAlpha=1;
    // lantern light on boat
    ctx.save();ctx.globalCompositeOperation='lighter';
    const lg=ctx.createRadialGradient(BX,BY,4,BX,BY,150);
    const flick=0.75+Math.sin(t*11)*0.08+Math.sin(t*27)*0.05;
    lg.addColorStop(0,`rgba(255,210,130,${0.55*flick})`);lg.addColorStop(0.5,'rgba(255,150,60,0.18)');lg.addColorStop(1,'rgba(255,140,40,0)');
    ctx.fillStyle=lg;ctx.beginPath();ctx.arc(BX,BY,150,0,TAU);ctx.fill();ctx.restore();
    drawParts(false);
    // rain (screen space)
    ctx.strokeStyle='rgba(170,200,240,0.28)';ctx.lineWidth=1;
    ctx.beginPath();
    for(const r of this.rain){ctx.moveTo(r.x,r.y);ctx.lineTo(r.x-3,r.y+14);}
    ctx.stroke();
    drawFloats();
    // progress
    ctx.fillStyle='rgba(0,0,0,0.45)';ctx.fillRect(W/2-170,14,340,10);
    ctx.fillStyle='#ffbe5a';ctx.fillRect(W/2-170,14,340*prog,10);
    ctx.font='12px Cinzel, serif';ctx.textAlign='center';ctx.fillStyle='#ffe1a0';
    ctx.fillText(`${Math.max(0,Math.ceil((-this.goalY-b.y)/10))} strokes to the light`,W/2,48);
    // side bounds buoys
    ctx.fillStyle='rgba(255,120,80,0.5)';
    for(let y=-40;y<H+40;y+=90){ctx.fillRect(8,y+((camY*0.5)%90),4,20);ctx.fillRect(W-12,y-((camY*0.5)%90),4,20);}
  }
};

/* ================= CHAPTER II — THE CLIMB ================= */
const Ch2={
  plats:[],moths:[],bats:[],winds:[],checkY:0,doorY:-2310,H:2310,
  pl:{x:0,y:0,vx:0,vy:0,w:22,h:30,onGround:false,coyote:0,buffer:0,face:1},
  camY:0,swingCD:0,crumbleT:{},
  build(){
    Game.setChapter(2,'II · THE CLIMB'); Game.ember=Math.max(Game.ember,75);
    this.plats=[];this.moths=[];this.bats=[];this.winds=[];
    const P2=(x,y,w,type='solid')=>this.plats.push({x,y,w,h:16,type,phase:rand(0,9),gone:0});
    // zigzag route: every step is ≤110 up and ≤90 across (jump reaches ~165 up / ~215 across)
    P2(-40,0,220);
    P2(190,-110,150);  P2(-40,-220,150);  P2(-260,-330,150);
    P2(-40,-440,130);  P2(170,-550,140);  P2(-30,-660,120,'crumble');
    P2(-260,-770,150); P2(-30,-880,130,'crumble'); P2(190,-990,150);
    P2(-30,-1100,120); P2(-250,-1210,140); P2(-30,-1320,120,'crumble');
    P2(190,-1430,140); P2(-30,-1540,120);  P2(-250,-1650,130,'crumble');
    P2(-30,-1760,140); P2(190,-1870,130);  P2(-30,-1980,120,'crumble');
    P2(-250,-2090,150); P2(-30,-2200,130); P2(150,-2310,200,'door');
    // a moth-pair above every platform
    for(const pl of this.plats){
      this.moths.push({x:pl.x+pl.w*0.35,y:pl.y-36,t:rand(0,9),got:false});
      if(pl.w>=140)this.moths.push({x:pl.x+pl.w*0.7,y:pl.y-64,t:rand(0,9),got:false});
    }
    // bats patrol the mid and upper cliff
    for(let i=0;i<10;i++)this.bats.push({x:rand(-320,320),y:-400-i*190,t:rand(0,9),vx:rand(-60,60),scared:0});
    // wind zones (shown as pale ribbons)
    this.winds=[{x:-340,y:-700,w:260,h:120,f:340},{x:60,y:-1350,w:260,h:120,f:-380},{x:-340,y:-1950,w:280,h:130,f:400}];
    const p=this.pl;p.x=-40;p.y=-60;p.vx=0;p.vy=0;
    this.checkY=-60;this.camY=p.y;Game.camY=p.y;
    caption('Up. Hand over hand. She sang on this cliff when you were small.',5);
  },
  respawn(){const p=this.pl;p.x=clamp(p.x,-380,380);p.y=this.checkY-40;p.vx=0;p.vy=0;
    for(const b of this.bats)if(Math.abs(b.y-p.y)<200){b.scared=2;b.x+=b.x>p.x?150:-150;}
    Game.camY=p.y;},
  update(dt){
    const p=this.pl;
    const L=keys['a']||keys['arrowleft'],R=keys['d']||keys['arrowright'];
    const ACC=p.onGround?2200:1500,MAX=265;
    if(L){p.vx-=ACC*dt;p.face=-1;} if(R){p.vx+=ACC*dt;p.face=1;}
    if(!L&&!R)p.vx*=Math.pow(0.002,dt);
    p.vx=clamp(p.vx,-MAX,MAX);
    // wind
    let inWind=false;
    for(const w of this.winds){if(p.x>w.x&&p.x<w.x+w.w&&p.y>w.y&&p.y<w.y+w.h){p.vx+=w.f*dt;inWind=true;}}
    // gravity (lighter in wind)
    p.vy+=2000*dt; p.vy=Math.min(p.vy,900);
    if((keys['w']||keys['arrowup']||keys[' '])&&!this._jumpHeld){p.buffer=0.14;this._jumpHeld=true;}
    if(!(keys['w']||keys['arrowup']||keys[' ']))this._jumpHeld=false;
    p.buffer-=dt;p.coyote-=dt;
    // integrate X then collide as AABB vs plats (top surfaces + walls for walljump)
    p.x+=p.vx*dt;
    let touchingWall=0;
    for(const pl of this.plats){if(pl.gone>0)continue;
      if(p.x+11>pl.x&&p.x-11<pl.x+pl.w&&p.y+15>pl.y&&p.y-15<pl.y+pl.h){
        if(p.vx>0){p.x=pl.x-11;touchingWall=1;}else if(p.vx<0){p.x=pl.x+pl.w+11;touchingWall=-1;}
        p.vx=0;}}
    p.y+=p.vy*dt; p.onGround=false;
    for(const pl of this.plats){if(pl.gone>0)continue;
      if(p.x+10>pl.x&&p.x-10<pl.x+pl.w&&p.y+15>pl.y&&p.y-15<pl.y+pl.h){
        if(p.vy>0&&p.y<pl.y+8){p.y=pl.y-15;p.vy=0;p.onGround=true;p.coyote=0.12;
          if(pl.type==='crumble'){pl.gone=0.6;}
          if(pl.y<this.checkY&&(pl.w>=135)){this.checkY=pl.y-40;toast('a ledge to breathe · checkpoint');Audio2.chime(2,520);}
        } else if(p.vy<0){p.y=pl.y+pl.h+15;p.vy=0;}
      }}
    // jump (apex ~168px; route steps are ≤110)
    if(p.buffer>0){
      if(p.onGround||p.coyote>0){p.vy=-820;p.buffer=0;p.coyote=0;p.onGround=false;Audio2.jumpS();burst(p.x,p.y+15,8,'200,220,255',120,0.4,2);}
      else if(touchingWall!==0){p.vy=-760;p.vx=touchingWall*-300;p.buffer=0;Audio2.jumpS();burst(p.x,p.y,10,'255,200,120',150,0.4,2);caption('Wall-kick! Again — higher.',1.6);}
    }
    // variable jump height
    if(!(keys['w']||keys['arrowup']||keys[' '])&&p.vy<-280)p.vy=lerp(p.vy,-280,1-Math.pow(0.0001,dt));
    // crumble timers
    for(const pl of this.plats){if(pl.type!=='crumble')continue;
      if(pl.gone>0&&pl.gone<10){pl.gone-=dt;if(pl.gone<=0){pl.gone=-3;burst(pl.x+pl.w/2,pl.y,14,'120,110,90',140);}}
      else if(pl.gone<0){pl.gone+=dt;if(pl.gone>=0){pl.gone=0;}}}
    // lantern swing scares bats (tap space handled as jump too — use 'j' or mouse? keep: swing on 'k'/mouse click)
    this.swingCD-=dt;
    if((keys['k']||mouse.down)&&this.swingCD<=0){this.swingCD=0.45;Audio2.noise(0.15,0.12,3000);
      burst(p.x+p.face*30,p.y,10,'255,220,150',200,0.4,3);
      for(const b of this.bats){if(dist2(b.x,b.y,p.x,p.y)<110*110){b.scared=2.5;floatText(b.x,b.y,'shoo!');}}
      mouse.down=false;}
    // bats
    for(const b of this.bats){b.t+=dt;
      if(b.scared>0){b.scared-=dt;b.x+=(b.x>p.x?1:-1)*220*dt;b.y-=60*dt;}
      else{b.x+=Math.sin(b.t*1.7)*90*dt+Math.cos(b.t*0.6)*30*dt;b.y+=Math.cos(b.t*2.3)*40*dt;
        const dx=p.x-b.x,dy=p.y-b.y,d=Math.hypot(dx,dy);
        if(d<190){b.x+=dx/d*70*dt;b.y+=dy/d*70*dt;}
        if(d<26&&P.iframes<=0){Game.hurtPlayer(12,'A soot-bat stole a mouthful of light!');b.scared=1.5;}}
      b.x=clamp(b.x,-420,420);}
    // moths
    for(const m of this.moths){m.t+=dt*3;
      if(!m.got&&dist2(m.x,m.y,p.x,p.y)<28*28){m.got=true;Game.ember=Math.min(100,Game.ember+9);
        Game.flies++;Audio2.pickup();burst(m.x,m.y,14,'255,240,180',130);floatText(m.x,m.y,'+9');}}
    Game.ember-=dt*1.7;
    // fell?
    const camBot=this.camY+H/2;
    if(p.y>camBot+80){Game.hurtPlayer(14,'The dark below is patient. Climb!');p.y=this.checkY-40;p.vy=0;p.vx=0;p.x=clamp(p.x,-380,380);}
    if(this.checkY<-1300&&this.checkY>-1400){/* mid */}
    P.x=p.x;P.y=p.y;
    if(P.iframes>0)P.iframes-=dt;
    if(Game.ember<=0){Game.die();return;}
    this.camY=lerp(this.camY,Math.min(p.y,this.camY+40*dt),1-Math.pow(0.002,dt));
    Game.camY=this.camY;Game.camX=lerp(Game.camX,p.x*0.35,1-Math.pow(0.01,dt));
    if(Math.random()<0.4)parts.push({x:p.x+rand(-6,6),y:p.y+rand(-8,8),vx:rand(-15,15),vy:rand(-40,-10),life:0.6,max:0.6,color:'255,175,70',size:rand(1,2.4),drag:0.97,grav:0});
    // door reached?
    if(p.y<this.doorY+20&&p.x>110&&p.x<370){Audio2.winS();Game.state='story';Story.start(3);Ch3a.build();}
  },
  draw(){
    const camX=Game.camX,camY=this.camY;
    const sx=x=>x-camX+W/2, sy=y=>y-camY+H/2;
    const t=performance.now()/1000;
    const prog=clamp(-this.pl.y/this.H,0,1);
    // sky: storm below → dawn glow above
    const g=ctx.createLinearGradient(0,0,0,H);
    g.addColorStop(0,`rgb(${20+prog*60|0},${24+prog*40|0},${52+prog*20|0})`);
    g.addColorStop(0.55,'#101a33');g.addColorStop(1,'#070c18');
    ctx.fillStyle=g;ctx.fillRect(0,0,W,H);
    // stars thinning near top + dawn
    ctx.save();ctx.globalAlpha=0.8*(1-prog*0.6);
    ctx.fillStyle='#fff';
    for(let i=0;i<70;i++){const x=(i*137.5)%W,y=(i*89.3+camY*0.1)%H;ctx.globalAlpha=0.3+((i*7)%10)/18;ctx.fillRect(x,y,1.6,1.6);}
    ctx.restore();ctx.globalAlpha=1;
    // distant sea far below
    if(camY>-900){const seaY=sy(120);if(seaY<H+100){ctx.fillStyle='#0a1626';ctx.fillRect(0,Math.max(0,seaY),W,H);
      ctx.strokeStyle='rgba(120,180,240,0.2)';for(let i=0;i<6;i++){ctx.beginPath();for(let x=0;x<=W;x+=20)ctx.lineTo(x,seaY+20+i*22+Math.sin(x*0.03+t*2+i)*5);ctx.stroke();}}}
    // moon
    ctx.save();ctx.globalCompositeOperation='lighter';
    const mg=ctx.createRadialGradient(W-150,110,5,W-150,110,90);
    mg.addColorStop(0,'rgba(220,235,255,0.8)');mg.addColorStop(0.4,'rgba(180,200,255,0.2)');mg.addColorStop(1,'rgba(180,200,255,0)');
    ctx.fillStyle=mg;ctx.beginPath();ctx.arc(W-150,110,90,0,TAU);ctx.fill();ctx.restore();
    // cliff walls left+right (jagged)
    ctx.fillStyle='#0c1220';
    ctx.beginPath();ctx.moveTo(0,0);
    for(let y=0;y<=H;y+=24){const wy=y+camY;ctx.lineTo(sx(-430+Math.sin(wy*0.01)*40+Math.sin(wy*0.043)*12),y);}
    ctx.lineTo(0,H);ctx.fill();
    ctx.beginPath();ctx.moveTo(W,0);
    for(let y=0;y<=H;y+=24){const wy=y+camY;ctx.lineTo(sx(430+Math.sin(wy*0.013+2)*40+Math.sin(wy*0.05)*12),y);}
    ctx.lineTo(W,H);ctx.fill();
    // lighthouse shaft above
    const doorY=sy(this.doorY);
    if(doorY>-200){ctx.fillStyle='#1a2338';ctx.fillRect(sx(80),doorY-220,320,240);
      ctx.fillStyle='#ffd98a';ctx.fillRect(sx(220),doorY-120,40,60);
      ctx.fillStyle='rgba(255,200,110,0.9)';ctx.font='13px Cinzel, serif';ctx.textAlign='center';
      ctx.fillText('THE DOOR',sx(240),doorY-130);}
    // wind zones
    for(const w of this.winds){const X=sx(w.x),Y=sy(w.y);
      ctx.fillStyle='rgba(150,210,255,0.07)';ctx.fillRect(X,Y,w.w,w.h);
      ctx.strokeStyle='rgba(150,210,255,0.35)';ctx.lineWidth=1.5;
      const dir=w.f>0?1:-1;
      for(let i=0;i<5;i++){const yy=Y+15+i*(w.h/5),xx=X+((t*160*dir+i*90)%w.w+w.w)%w.w;
        ctx.beginPath();ctx.moveTo(xx,yy);ctx.lineTo(xx+26*dir,yy);ctx.stroke();}}
    // platforms
    for(const pl of this.plats){if(pl.gone<0&&pl.gone>-3)continue;
      const X=sx(pl.x),Y=sy(pl.y);if(Y<-40||Y>H+40)continue;
      let alpha=1;if(pl.gone>0)alpha=0.4+Math.sin(t*30)*0.3;
      ctx.save();ctx.globalAlpha=alpha;
      const crumbly=pl.type==='crumble';
      ctx.fillStyle=pl.type==='door'?'#2a3550':crumbly?'#3d3222':'#232c44';
      ctx.fillRect(X,Y,pl.w,pl.h);
      ctx.fillStyle=crumbly?'#6b5a38':'#3a4a6b';ctx.fillRect(X,Y,pl.w,4);
      // glowing moss dots
      ctx.fillStyle='rgba(140,255,170,0.7)';
      for(let i=0;i<pl.w/26;i++){const mx=X+10+i*26;ctx.fillRect(mx,Y+1+Math.sin(t*2+i)*1,3,3);}
      if(pl.type==='door'){ctx.fillStyle='#ffd98a';ctx.font='12px Cinzel,serif';ctx.textAlign='center';ctx.fillText('↑',X+pl.w/2,Y-8);}
      ctx.restore();}
    // moths
    ctx.save();ctx.globalCompositeOperation='lighter';
    for(const m of this.moths){if(m.got)continue;const X=sx(m.x),Y=sy(m.y);if(Y<-30||Y>H+30)continue;
      const p=1+Math.sin(m.t)*0.3;
      const fg=ctx.createRadialGradient(X,Y,1,X,Y,18*p);
      fg.addColorStop(0,'rgba(255,244,200,0.95)');fg.addColorStop(1,'rgba(255,190,90,0)');
      ctx.fillStyle=fg;ctx.beginPath();ctx.arc(X,Y,18*p,0,TAU);ctx.fill();
      ctx.fillStyle='#fff';ctx.beginPath();ctx.ellipse(X,Y-2,4,2.4,Math.sin(m.t)*0.6,0,TAU);ctx.fill();}
    ctx.restore();
    // bats
    for(const b of this.bats){const X=sx(b.x),Y=sy(b.y);if(Y<-50||Y>H+50)continue;
      ctx.save();ctx.translate(X,Y);ctx.fillStyle=b.scared>0?'#3a3a55':'#141a2e';
      const w=Math.sin(b.t*14)*8;
      ctx.beginPath();ctx.moveTo(0,0);ctx.lineTo(-16,-6-w);ctx.lineTo(-6,2);ctx.lineTo(0,0);ctx.lineTo(6,2);ctx.lineTo(16,-6-w);ctx.fill();
      ctx.fillStyle='#ff5a5a';ctx.fillRect(-4,-2,3,3);ctx.fillRect(1,-2,3,3);
      ctx.restore();}
    // player: little keeper with lantern
    const p=this.pl,X=sx(p.x),Y=sy(p.y);
    ctx.save();ctx.translate(X,Y);
    if(P.iframes>0&&Math.floor(performance.now()/90)%2===0)ctx.globalAlpha=0.35;
    // scarf flutter
    ctx.strokeStyle='#c0392b';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(0,-8);
    ctx.quadraticCurveTo(-p.face*14,2+Math.sin(t*10)*5,-p.face*24,8+Math.sin(t*13)*4);ctx.stroke();
    // body
    ctx.fillStyle='#2c3a58';ctx.fillRect(-7,-8,14,18);
    ctx.fillStyle='#e8b98a';ctx.beginPath();ctx.arc(0,-14,7,0,TAU);ctx.fill();
    ctx.fillStyle='#1a2340';ctx.fillRect(-7,-20,14,5); // hood
    // legs animate
    const lp=Math.sin(t*(p.onGround?Math.abs(p.vx)*0.06:3))*5;
    ctx.fillStyle='#141b30';ctx.fillRect(-6,10,5,8+(p.onGround?lp*0.4:3));ctx.fillRect(1,10,5,8-(p.onGround?lp*0.4:3));
    // lantern held toward facing
    const lx2=p.face*14,ly2=2;
    ctx.strokeStyle='#8a6a3a';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(4,0);ctx.lineTo(lx2,ly2);ctx.stroke();
    ctx.fillStyle='#ffd98a';ctx.fillRect(lx2-4,ly2-4,8,9);
    ctx.restore();ctx.globalAlpha=1;
    // lantern glow
    ctx.save();ctx.globalCompositeOperation='lighter';
    const gg=ctx.createRadialGradient(X,Y,4,X,Y,130);
    const fl=0.7+Math.sin(t*11)*0.07+Math.sin(t*29)*0.05;
    gg.addColorStop(0,`rgba(255,215,140,${0.5*fl})`);gg.addColorStop(0.5,'rgba(255,150,60,0.16)');gg.addColorStop(1,'rgba(255,140,40,0)');
    ctx.fillStyle=gg;ctx.beginPath();ctx.arc(X,Y,130,0,TAU);ctx.fill();ctx.restore();
    drawParts(false);drawFloats();
    // height meter
    const pr=clamp(-p.y/this.H,0,1);
    ctx.fillStyle='rgba(0,0,0,0.45)';ctx.fillRect(20,80,10,H-200);
    ctx.fillStyle='#ffbe5a';const hh=(H-200)*pr;ctx.fillRect(20,80+(H-200)-hh,10,hh);
    ctx.save();ctx.translate(34,H-120);ctx.rotate(-Math.PI/2);ctx.font='11px Cinzel,serif';ctx.fillStyle='#ffe1a0';ctx.textAlign='center';
    ctx.fillText('THE LIGHT IS UP THERE',0,0);ctx.restore();
  }
};

/* ================= CHAPTER IIIa — THE SPIRAL (lantern maze) ================= */
const Ch3a={
  walls:[],shards:[],shadows:[],got:0,px:0,py:0,pvx:0,pvy:0,
  build(){
    Game.setChapter(3,'III · THE SPIRAL'); Game.ember=Math.max(Game.ember,80);
    this.walls=[];this.shards=[];this.shadows=[];this.got=0;
    // tower interior 1400x1100, ring walls with gaps (familiar maze, learnable in ~90s)
    const W2=(x,y,w,h)=>this.walls.push({x,y,w,h});
    W2(-700,-550,1400,40);W2(-700,510,1400,40);W2(-700,-550,40,1100);W2(660,-550,40,1100);
    W2(-420,-300,560,36);W2(-140,60,560,36);W2(-560,-60,220,36);
    W2(140,-300,36,220);W2(-420,240,36,220);W2(200,240,320,36);
    W2(-560,-300,36,240);W2(420,-60,36,200);
    this.shards=[{x:-560,y:-430,t:0,got:false},{x:540,y:400,t:2,got:false},{x:-80,y:-120,t:4,got:false}];
    for(let i=0;i<6;i++)this.shadows.push({x:rand(-500,500),y:rand(-400,400),t:rand(0,9),stun:0,vx:0,vy:0,ph:i});
    this.px=0;this.py=430;this.pvx=0;this.pvy=0;
    caption('Three shards. The shadows grieve — your beam can hold them still.',5);
  },
  respawn(){this.px=0;this.py=430;this.pvx=0;this.pvy=0;
    for(const s of this.shadows)if(dist2(s.x,s.y,this.px,this.py)<300*300){s.x*=-0.8;s.y-=200;}},
  collide(x,y,r){
    for(const w of this.walls){
      const cx=clamp(x,w.x,w.x+w.w),cy=clamp(y,w.y,w.y+w.h);
      if(dist2(x,y,cx,cy)<r*r)return w;}
    return null;
  },
  update(dt){
    let ax=((keys['d']||keys['arrowright'])?1:0)-((keys['a']||keys['arrowleft'])?1:0);
    let ay=((keys['s']||keys['arrowdown'])?1:0)-((keys['w']||keys['arrowup'])?1:0);
    this.pvx+=ax*1400*dt;this.pvy+=ay*1400*dt;
    this.pvx*=Math.pow(0.02,dt);this.pvy*=Math.pow(0.02,dt);
    const sp=Math.hypot(this.pvx,this.pvy),mx=240;
    if(sp>mx){this.pvx*=mx/sp;this.pvy*=mx/sp;}
    let nx=this.px+this.pvx*dt;
    if(!this.collide(nx,this.py,13))this.px=nx;else this.pvx=0;
    let ny=this.py+this.pvy*dt;
    if(!this.collide(this.px,ny,13))this.py=ny;else this.pvy=0;
    this.px=clamp(this.px,-660,660);this.py=clamp(this.py,-510,510);
    P.x=this.px;P.y=this.py;
    Game.ember-=dt*1.8;
    // lantern world pos -> mouse: camera centered on player
    const camX=this.px,camY=this.py;
    const mwx=camX+(mouse.x-W/2), mwy=camY+(mouse.y-H/2);
    const ma=Math.atan2(mwy-this.py,mwx-this.px);
    // shards
    for(const s of this.shards){s.t+=dt*2;
      if(!s.got&&dist2(s.x,s.y,this.px,this.py)<30*30){s.got=true;this.got++;Game.ember=Math.min(100,Game.ember+16);
        Game.flies++;Audio2.chime(4,740);burst(s.x,s.y,26,'150,220,255',200);floatText(s.x,s.y,'SHARD '+this.got+'/3');
        toast(this.got>=3?'the stairwell wakes — center of the tower! ↓':'a shard remembers the sun ('+this.got+'/3)');}}
    // stairwell (tower heart, clear of walls)
    if(this.got>=3&&dist2(0,150,this.px,this.py)<46*46){
      Audio2.winS();Ch3b.build();Game.state='ch3b';return;}
    // shadows AI
    for(const s of this.shadows){s.t+=dt;
      if(s.stun>0){s.stun-=dt;continue;}
      const dx=this.px-s.x,dy=this.py-s.y,d=Math.hypot(dx,dy)||1;
      // beam stun check
      const sa=Math.atan2(dy,dx);
      let da=Math.abs(((sa-ma+Math.PI*3)%TAU)-Math.PI);
      if(d<330&&da<0.30){s.stun=2.2;Audio2.stunS();burst(s.x,s.y,16,'255,240,180',160);floatText(s.x,s.y,'held!');continue;}
      let vx=0,vy=0;
      if(d<420){vx=dx/d*120;vy=dy/d*120;} // stalk
      else{vx=Math.cos(s.t*0.7+s.ph)*50;vy=Math.sin(s.t*0.9+s.ph*2)*50;}
      // avoid walls simply: try move, else slide
      const tx=s.x+vx*dt,ty=s.y+vy*dt;
      if(!this.collide(tx,s.y,14))s.x=tx;
      if(!this.collide(s.x,ty,14))s.y=ty;
      if(d<26)Game.hurtPlayer(15,'It only wanted to be warm. It took too much.');
    }
    if(Math.random()<0.35)parts.push({x:this.px+rand(-6,6),y:this.py+rand(-6,6),vx:rand(-15,15),vy:rand(-30,-5),life:0.6,max:0.6,color:'255,175,70',size:rand(1,2.4),drag:0.97,grav:0});
    Game.camX=this.px;Game.camY=this.py;
    if(P.iframes>0)P.iframes-=dt;
    if(Game.ember<=0){Game.die();return;}
  },
  draw(){
    const camX=this.px,camY=this.py;
    const sx=x=>x-camX+W/2, sy=y=>y-camY+H/2;
    const t=performance.now()/1000;
    ctx.fillStyle='#070912';ctx.fillRect(0,0,W,H);
    // floor: concentric tower stone rings
    ctx.save();
    for(let i=0;i<12;i++){ctx.strokeStyle=`rgba(70,86,130,${0.10+0.03*Math.sin(t+i)})`;ctx.lineWidth=2;
      ctx.beginPath();ctx.ellipse(W/2-camX*0.05,H/2-camyShift(camY)*0.05,120+i*70,80+i*48,0,0,TAU);ctx.stroke();}
    ctx.restore();
    function camyShift(c){return 0;}
    // stairwell (center)
    const CX=sx(0),CY=sy(150);
    ctx.fillStyle=this.got>=3?'#2a3a5c':'#151b30';
    ctx.beginPath();ctx.arc(CX,CY,44,0,TAU);ctx.fill();
    ctx.strokeStyle=this.got>=3?'#ffd98a':'#3a4666';ctx.lineWidth=3;
    ctx.beginPath();ctx.arc(CX,CY,44+Math.sin(t*3)*3,0,TAU);ctx.stroke();
    // spiral steps hint
    ctx.strokeStyle='rgba(255,217,138,0.25)';
    for(let i=0;i<5;i++){ctx.beginPath();ctx.arc(CX,CY,10+i*7,t*0.8+i,t*0.8+i+2.4);ctx.stroke();}
    ctx.fillStyle='#8d846d';ctx.font='11px Cinzel,serif';ctx.textAlign='center';
    ctx.fillText(this.got>=3?'DOWN ↓':'SEALED · '+this.got+'/3',CX,CY+60);
    // walls
    for(const w of this.walls){const X=sx(w.x),Y=sy(w.y);
      if(X>W+60||X+w.w<-60||Y>H+60||Y+h(w.h)<-60)continue;
      ctx.fillStyle='#1d2640';ctx.fillRect(X,Y,w.w,w.h);
      ctx.fillStyle='#33436b';ctx.fillRect(X,Y,w.w,3);
      ctx.fillStyle='rgba(255,215,140,0.12)';ctx.fillRect(X,Y+w.h-3,w.w,3);}
    function h(v){return v;}
    // shards
    ctx.save();ctx.globalCompositeOperation='lighter';
    for(const s of this.shards){if(s.got)continue;const X=sx(s.x),Y=sy(s.y);
      const p=1+Math.sin(s.t)*0.25;
      const fg=ctx.createRadialGradient(X,Y,2,X,Y,34*p);
      fg.addColorStop(0,'rgba(200,235,255,0.95)');fg.addColorStop(0.5,'rgba(140,190,255,0.35)');fg.addColorStop(1,'rgba(140,190,255,0)');
      ctx.fillStyle=fg;ctx.beginPath();ctx.arc(X,Y,34*p,0,TAU);ctx.fill();
      ctx.save();ctx.translate(X,Y+Math.sin(s.t)*3);ctx.rotate(s.t*0.6);
      ctx.fillStyle='#dff1ff';ctx.fillRect(-7,-7,14,14);ctx.strokeStyle='#8fc4ff';ctx.strokeRect(-7,-7,14,14);
      ctx.restore();}
    ctx.restore();
    // shadows
    for(const s of this.shadows){const X=sx(s.x),Y=sy(s.y);
      ctx.save();ctx.translate(X,Y);
      if(s.stun>0){ctx.globalAlpha=0.55;ctx.strokeStyle='#ffe1a0';ctx.lineWidth=2;
        ctx.beginPath();ctx.arc(0,0,24+Math.sin(t*8)*3,0,TAU);ctx.stroke();ctx.globalAlpha=1;}
      const wg=ctx.createRadialGradient(0,0,2,0,0,34);
      wg.addColorStop(0,'rgba(8,10,20,0.98)');wg.addColorStop(0.65,'rgba(70,60,120,0.4)');wg.addColorStop(1,'rgba(150,120,220,0)');
      ctx.fillStyle=wg;ctx.beginPath();ctx.arc(0,0,34,0,TAU);ctx.fill();
      // eyes: sad
      const blink=Math.sin(s.t*3+s.ph)>-0.9?1:0.15;
      ctx.fillStyle=s.stun>0?'#ffe1a0':'#b48cff';
      ctx.fillRect(-9,-5,6,8*blink);ctx.fillRect(3,-5,6,8*blink);
      // wavy bottom
      ctx.fillStyle='rgba(8,10,20,0.9)';
      ctx.beginPath();ctx.moveTo(-20,10);
      for(let i=0;i<=4;i++)ctx.lineTo(-20+i*10,16+Math.sin(t*5+i*2+s.ph)*5);
      ctx.lineTo(20,10);ctx.closePath();ctx.fill();
      ctx.restore();}
    // player keeper (screen center-ish)
    const PX=sx(this.px),PY=sy(this.py);
    ctx.save();ctx.translate(PX,PY);
    if(P.iframes>0&&Math.floor(performance.now()/90)%2===0)ctx.globalAlpha=0.35;
    ctx.fillStyle='#2c3a58';ctx.fillRect(-7,-8,14,18);
    ctx.fillStyle='#e8b98a';ctx.beginPath();ctx.arc(0,-13,6.5,0,TAU);ctx.fill();
    ctx.fillStyle='#1a2340';ctx.fillRect(-7,-19,14,5);
    ctx.restore();ctx.globalAlpha=1;
    // lantern beam toward mouse
    const mwx=camX+(mouse.x-W/2),mwy=camY+(mouse.y-H/2);
    const ma=Math.atan2(mwy-this.py,mwx-this.px);
    ctx.save();ctx.globalCompositeOperation='lighter';
    const beam=ctx.createRadialGradient(PX,PY,10,PX,PY,330);
    beam.addColorStop(0,'rgba(255,215,140,0.5)');beam.addColorStop(0.35,'rgba(255,170,70,0.14)');beam.addColorStop(1,'rgba(255,150,50,0)');
    ctx.fillStyle=beam;ctx.beginPath();ctx.arc(PX,PY,330,0,TAU);ctx.fill();
    // cone
    ctx.fillStyle='rgba(255,225,160,0.13)';
    ctx.beginPath();ctx.moveTo(PX,PY);ctx.arc(PX,PY,330,ma-0.30,ma+0.30);ctx.closePath();ctx.fill();
    ctx.strokeStyle='rgba(255,225,160,0.35)';ctx.lineWidth=1.5;
    ctx.beginPath();ctx.moveTo(PX,PY);ctx.lineTo(PX+Math.cos(ma-0.30)*330,PY+Math.sin(ma-0.30)*330);
    ctx.moveTo(PX,PY);ctx.lineTo(PX+Math.cos(ma+0.30)*330,PY+Math.sin(ma+0.30)*330);ctx.stroke();
    ctx.restore();
    // darkness overlay: everything outside light is near-black
    ctx.save();
    const dark=ctx.createRadialGradient(PX,PY,90,PX,PY,430);
    dark.addColorStop(0,'rgba(2,3,8,0)');dark.addColorStop(0.55,'rgba(2,3,8,0.55)');dark.addColorStop(1,'rgba(1,2,6,0.93)');
    ctx.fillStyle=dark;ctx.fillRect(0,0,W,H);
    ctx.restore();
    drawParts(false);drawFloats();
    ctx.font='12px Cinzel,serif';ctx.textAlign='center';ctx.fillStyle='#ffe1a0';
    ctx.fillText(`SHARDS ${this.got}/3 — the stairwell waits at the tower's heart`,W/2,44);
  }
};

/* ================= CHAPTER IIIb — THE BURN (finale runner) ================= */
const Ch3b={
  y:0,goal:3000,x:0,vx:0,debris:[],embers:[],burning:false,checkY:0,spawnAhead:0,
  build(){
    Game.setChapter(3,'III · THE BURN');Game.ember=Math.max(Game.ember,85);
    this.y=0;this.x=0;this.vx=0;this.debris=[];this.embers=[];this.checkY=0;this.spawnAhead=0;
    caption('BURN if you must — but spend yourself wisely. UP is home.',5);
    toast('hold SPACE to burn · steer with A/D');
    Audio2.winS();
  },
  respawn(){this.y=this.checkY;this.vx=0;this.x=0;
    this.debris=this.debris.filter(d=>d.y>this.y-100);},
  update(dt){
    const burning=!!keys[' '];
    this.burning=burning;
    const L=(keys['a']||keys['arrowleft'])?1:0,R=(keys['d']||keys['arrowright'])?1:0;
    this.vx+=(R-L)*1600*dt; this.vx*=Math.pow(0.01,dt); this.vx=clamp(this.vx,-330,330);
    this.x+=this.vx*dt; this.x=clamp(this.x,-300,300);
    const upSpeed=burning?360:165;
    this.y+=upSpeed*dt;
    Game.ember-=dt*(burning?16:2.2);
    if(burning){Game.shake=Math.min(8,Game.shake+20*dt);
      parts.push({x:W/2+this.x*0.9+rand(-8,8),y:H-140,vx:rand(-40,40),vy:rand(150,300),life:0.5,max:0.5,color:'255,150,40',size:rand(2,4),drag:0.96,grav:0});
      if(Math.random()<0.3)Audio2.noise(0.1,0.05,3000);
    }
    // spawn debris/embers ahead (world-y grows upward as you climb)
    while(this.spawnAhead<this.y+900){this.spawnAhead+=rand(90,160);
      const yy=this.spawnAhead;
      if(Math.random()<0.62)this.debris.push({x:rand(-300,300),y:yy,r:rand(14,30),vy:rand(40,120),t:rand(0,9)});
      if(Math.random()<0.5)this.embers.push({x:rand(-280,280),y:yy-40,t:rand(0,9),got:false});
    }
    const py=H-140;
    const scrY=wy=>py-(wy-this.y); // world-y -> screen-y
    // debris falls downward (toward smaller world-y, i.e. toward/past the player)
    for(const d of this.debris){d.t+=dt;d.y-=d.vy*dt;}
    this.debris=this.debris.filter(d=>d.y>this.y-200);
    this.embers=this.embers.filter(e=>!e.got&&e.y>this.y-200);
    // collisions
    const px=W/2+this.x*0.9;
    for(const d of this.debris){const dy=scrY(d.y);
      const dx=(W/2+d.x*0.9)-px;
      if(Math.abs(dy-py)<10+d.r&&Math.abs(dx)<d.r+12&&P.iframes<=0){
        Game.hurtPlayer(15,'Falling dark! Slip between the stones.');d.y=this.y-300;break;}}
    for(const e of this.embers){const ey=scrY(e.y),ex=W/2+e.x*0.9;
      if(!e.got&&Math.abs(ey-py)<30&&Math.abs(ex-px)<30){e.got=true;Game.ember=Math.min(100,Game.ember+10);
        Game.flies++;Audio2.pickup();floatText(ex,ey-20,'+10');}}
    if(this.y>1500&&this.checkY<1500){this.checkY=1500;toast('halfway up — the air smells like morning');Audio2.chime(3,880);}
    P.x=px;P.y=py;
    if(P.iframes>0)P.iframes-=dt;
    if(Game.ember<=0){Game.die();return;}
    Game.progress01=clamp(this.y/this.goal,0,1);
    if(this.y>=this.goal){Ending.begin();}
  },
  draw(){
    const t=performance.now()/1000;
    const prog=clamp(this.y/this.goal,0,1);
    // shaft walls closing + dawn above
    const g=ctx.createLinearGradient(0,0,0,H);
    g.addColorStop(0,`rgb(${40+prog*180|0},${30+prog*120|0},${70+prog*60|0})`);
    g.addColorStop(0.5,'#141126');g.addColorStop(1,'#05060e');
    ctx.fillStyle=g;ctx.fillRect(0,0,W,H);
    // dawn disc growing
    ctx.save();ctx.globalCompositeOperation='lighter';
    const dg=ctx.createRadialGradient(W/2,120-prog*40,5,W/2,120-prog*40,120+prog*220);
    dg.addColorStop(0,`rgba(255,230,170,${0.5+prog*0.5})`);dg.addColorStop(0.4,'rgba(255,160,70,0.3)');dg.addColorStop(1,'rgba(255,140,50,0)');
    ctx.fillStyle=dg;ctx.beginPath();ctx.arc(W/2,120-prog*40,340,0,TAU);ctx.fill();ctx.restore();
    // walls rushing (speed lines)
    const wallGap=340-prog*90+Math.sin(t*2)*6;
    ctx.fillStyle='#0a0d18';
    ctx.fillRect(0,0,W/2-wallGap,H);ctx.fillRect(W/2+wallGap,0,W/2,H);
    ctx.fillStyle='#232c4a';
    ctx.fillRect(W/2-wallGap-8,0,8,H);ctx.fillRect(W/2+wallGap,0,8,H);
    ctx.strokeStyle='rgba(150,180,240,0.18)';
    for(let i=0;i<24;i++){const yy=(i*53+this.y*2.2)%(H+40)-20;
      ctx.beginPath();ctx.moveTo(W/2-wallGap+10,yy);ctx.lineTo(W/2-wallGap+40,yy+8);ctx.stroke();
      ctx.beginPath();ctx.moveTo(W/2+wallGap-10,yy);ctx.lineTo(W/2+wallGap-40,yy+8);ctx.stroke();}
    const px=W/2+this.x*0.9, py=H-140;
    // debris
    for(const d of this.debris){const yy=py-(d.y-this.y);if(yy<-60||yy>H+60)continue;
      const X=W/2+d.x*0.9;
      ctx.save();ctx.translate(X,yy);ctx.rotate(d.t);
      ctx.fillStyle='#141a2e';ctx.fillRect(-d.r,-d.r*0.7,d.r*2,d.r*1.4);
      ctx.strokeStyle='rgba(180,140,255,0.5)';ctx.strokeRect(-d.r,-d.r*0.7,d.r*2,d.r*1.4);
      ctx.restore();}
    // embers
    ctx.save();ctx.globalCompositeOperation='lighter';
    for(const e of this.embers){if(e.got)continue;const yy=py-(e.y-this.y);if(yy<-30||yy>H+30)continue;
      const X=W/2+e.x*0.9,p=1+Math.sin(t*4+e.t)*0.25;
      const fg=ctx.createRadialGradient(X,yy,1,X,yy,20*p);
      fg.addColorStop(0,'rgba(255,240,190,0.95)');fg.addColorStop(1,'rgba(255,170,60,0)');
      ctx.fillStyle=fg;ctx.beginPath();ctx.arc(X,yy,20*p,0,TAU);ctx.fill();}
    ctx.restore();
    // player: the ember itself, blazing
    ctx.save();ctx.translate(px,py+Math.sin(t*6)*4);
    if(P.iframes>0&&Math.floor(performance.now()/90)%2===0)ctx.globalAlpha=0.4;
    ctx.globalCompositeOperation='lighter';
    const R=this.burning?70:44;
    const bg2=ctx.createRadialGradient(0,0,2,0,0,R);
    bg2.addColorStop(0,'rgba(255,250,220,0.95)');bg2.addColorStop(0.35,'rgba(255,180,80,0.55)');bg2.addColorStop(1,'rgba(255,120,20,0)');
    ctx.fillStyle=bg2;ctx.beginPath();ctx.arc(0,0,R,0,TAU);ctx.fill();
    ctx.globalCompositeOperation='source-over';
    ctx.fillStyle='#2c3a58';ctx.fillRect(-6,-4,12,14);
    ctx.fillStyle='#ffd98a';ctx.fillRect(-9,-8,18,6);
    ctx.restore();ctx.globalAlpha=1;
    drawParts(false);drawFloats();
    // progress pillar of light
    ctx.fillStyle='rgba(0,0,0,0.45)';ctx.fillRect(W-30,80,10,H-200);
    ctx.fillStyle='#ffe1a0';const hh=(H-200)*prog;ctx.fillRect(W-30,80+(H-200)-hh,10,hh);
    ctx.font='12px Cinzel,serif';ctx.textAlign='center';ctx.fillStyle=this.burning?'#ffb14e':'#ffe1a0';
    ctx.fillText(this.burning?'BURNING!':`${Math.ceil(this.goal-this.y)} ft to dawn`,W/2,40);
  }
};

/* ================= ENDING ================= */
const Ending={
  t:0,done:false,stats:'',
  begin(){Game.state='ending';this.t=0;this.done=false;Audio2.winS();setTimeout(()=>Audio2.chime(5,523),1200);},
  restartPrompt(){ // R / enter on ending → back to title
    overlay.classList.remove('hidden');
  },
  update(dt){this.t+=dt;if(this.t>3)this.done=true;},
  draw(){
    const t=this.t;
    const dawn=clamp(t/8,0,1);
    const g=ctx.createLinearGradient(0,0,0,H);
    g.addColorStop(0,`rgb(${30+dawn*200|0},${24+dawn*150|0},${70+dawn*120|0})`);
    g.addColorStop(0.6,`rgb(${16+dawn*120|0},${18+dawn*90|0},${44+dawn*60|0})`);
    g.addColorStop(1,'#05070f');
    ctx.fillStyle=g;ctx.fillRect(0,0,W,H);
    // rising sun
    const sy2=430-dawn*330;
    ctx.save();ctx.globalCompositeOperation='lighter';
    const sg=ctx.createRadialGradient(W/2,sy2,5,W/2,sy2,260);
    sg.addColorStop(0,'rgba(255,246,214,0.95)');sg.addColorStop(0.3,'rgba(255,200,110,0.5)');sg.addColorStop(1,'rgba(255,150,60,0)');
    ctx.fillStyle=sg;ctx.beginPath();ctx.arc(W/2,sy2,260,0,TAU);ctx.fill();ctx.restore();
    // sea + lighthouse lit
    ctx.fillStyle=`rgba(20,40,70,${0.9-dawn*0.4})`;ctx.fillRect(0,440,W,H-440);
    ctx.strokeStyle=`rgba(255,220,150,${0.2+dawn*0.5})`;
    for(let i=0;i<8;i++){ctx.beginPath();for(let x=0;x<=W;x+=24)ctx.lineTo(x,450+i*18+Math.sin(x*0.03+t*1.5+i)*4);ctx.stroke();}
    // lighthouse with lit lamp
    ctx.fillStyle='#10182c';ctx.fillRect(W/2-24,200,48,244);
    ctx.fillStyle='#0a0f1e';ctx.fillRect(W/2-34,160,68,44);
    ctx.save();ctx.globalCompositeOperation='lighter';
    const lamp=ctx.createRadialGradient(W/2,182,2,W/2,182,90+dawn*60);
    lamp.addColorStop(0,'rgba(255,240,200,0.95)');lamp.addColorStop(1,'rgba(255,170,60,0)');
    ctx.fillStyle=lamp;ctx.beginPath();ctx.arc(W/2,182,160,0,TAU);ctx.fill();ctx.restore();
    // beam sweeping, triumphant
    ctx.save();ctx.globalCompositeOperation='lighter';ctx.globalAlpha=0.35;
    const a=t*0.5;
    for(const aa of [a,a+Math.PI]){ctx.fillStyle='rgba(255,225,160,0.5)';ctx.beginPath();ctx.moveTo(W/2,182);
      ctx.lineTo(W/2+Math.cos(aa-0.05)*600,182+Math.sin(aa-0.05)*140);
      ctx.lineTo(W/2+Math.cos(aa+0.05)*600,182+Math.sin(aa+0.05)*140);ctx.fill();}
    ctx.restore();
    // tiny keeper silhouette
    const kx=W/2-80+Math.sin(t*0.8)*4;
    ctx.fillStyle='#05070f';ctx.fillRect(kx-6,420,12,24);
    ctx.beginPath();ctx.arc(kx,414,6,0,TAU);ctx.fill();
    // text
    ctx.textAlign='center';
    const lines=[
      [2,'The ember does not go out.'],
      [4,'It never was only an ember — it was every morning she promised you, kept.'],
      [7,'You lift the lantern into the great lamp. The tower takes a breath —'],
      [10,'— and the whole drowned world catches fire with dawn.'],
      [13,'Somewhere below, a mother\'s voice, humming, stops worrying.'],
    ];
    let y=60;
    ctx.font='700 34px Cinzel, serif';ctx.fillStyle='#ffd98a';
    ctx.shadowColor='#ff8c00';ctx.shadowBlur=18;
    if(t>0.8)ctx.fillText('D A W N',W/2,y);ctx.shadowBlur=0;y+=36;
    ctx.font='italic 18px Georgia';ctx.fillStyle='#f2e7c9';
    for(const [tt,ln] of lines){if(t>tt){ctx.fillText(ln,W/2,y);y+=28;}}
    if(t>15.5){
      const mm=Math.floor(Game.time/60),ss=Math.floor(Game.time%60);
      ctx.font='15px Cinzel, serif';ctx.fillStyle='#ffe1a0';
      ctx.fillText(`keeper's log — time ${mm}:${String(ss).padStart(2,'0')} · lights gathered ${Game.flies} · times fallen ${Game.deaths}`,W/2,H-72);
      ctx.font='italic 15px Georgia';ctx.fillStyle='#b9ac8d';
      const rank=Game.deaths===0?'“Flawless. She would have sung.”':Game.deaths<=3?'“Brave. Bruised. Just like her.”':'“Stubborn. The best kind of keeper.”';
      ctx.fillText(rank,W/2,H-50);
      ctx.globalAlpha=0.6+Math.sin(performance.now()/400)*0.3;
      ctx.fillText('— press R to keep the light again —',W/2,H-28);ctx.globalAlpha=1;
    }
    drawGrain(0.04);
  }
};

// ---------- HUD ----------
function updateHUD(){
  emberBar.style.width=clamp(Game.ember,0,100)+'%';
  emberBar.style.filter=Game.ember<25?`brightness(${1+Math.sin(performance.now()/120)*0.25})`:'none';
  if(Game.captionTimer>0){Game.captionTimer-=1/60;if(Game.captionTimer<=0)captionEl.textContent='';}
}

// ---------- main loop ----------
let last=performance.now();
function frame(now){
  requestAnimationFrame(frame);
  let dt=Math.min(0.033,(now-last)/1000);last=now;
  dt*=Game.slowmo;
  Game.time+=(Game.state!=='boot'&&Game.state!=='story'&&Game.state!=='ending')?dt:0;
  ctx.save();
  if(Game.shake>0){Game.shake=Math.max(0,Game.shake-40*dt);
    ctx.translate(rand(-Game.shake,Game.shake)*0.5,rand(-Game.shake,Game.shake)*0.5);}
  updateParts(dt);updateFloats(dt);
  if(Game.flash>0)Game.flash-=dt;
  const st=Game.state;
  if(st==='story'){Story.update(dt);
    if(Story.active===1)Ch1.draw();else if(Story.active===2)Ch2.draw();else if(Story.active===3)Ch3a.draw();
    Story.draw();
  }
  else if(st==='ch1'){Ch1.update(dt);Ch1.draw();}
  else if(st==='ch2'){Ch2.update(dt);Ch2.draw();}
  else if(st==='ch3a'){Ch3a.update(dt);Ch3a.draw();}
  else if(st==='ch3b'){Ch3b.update(dt);Ch3b.draw();}
  else if(st==='ending'){Ending.update(dt);Ending.draw();}
  else { // boot backdrop
    ctx.fillStyle='#05070f';ctx.fillRect(0,0,W,H);
    drawVignette(0.7);
  }
  // ember-low heartbeat + vignette pulse
  if(st!=='boot'&&st!=='story'){
    if(Game.ember<25&&Math.floor(performance.now()/600)%2===0&&!Audio2.muted)Audio2.tone(70,0.15,'sine',0.08);
    drawVignette(Game.ember<25?0.75:0.5);
    if(Game.flash>0){ctx.fillStyle=`rgba(255,60,30,${Game.flash*0.5})`;ctx.fillRect(0,0,W,H);}
    drawGrain(0.045);
  }
  // fade for death
  if(Game.fadeDir>0)Game.fade=Math.min(0.85,Game.fade+dt*2);
  else Game.fade=Math.max(0,Game.fade-dt*2);
  if(Game.fade>0){ctx.fillStyle=`rgba(0,0,0,${Game.fade})`;ctx.fillRect(0,0,W,H);}
  ctx.restore();
  updateHUD();
}

// ---------- start ----------
startBtn.addEventListener('click',()=>{
  Audio2.init();
  if(Audio2.ctx&&Audio2.ctx.state==='suspended')Audio2.ctx.resume();
  overlay.classList.add('hidden');
  Game.ember=80;Game.deaths=0;Game.flies=0;Game.time=0;
  Story.start(0);
});
document.addEventListener('keydown',e=>{
  if(Game.state==='boot'&&e.key==='Enter'){startBtn.click();return;}
  if(Game.state==='ending'&&Ending.done&&(e.key.toLowerCase()==='r')){
    Game.ember=80;Game.deaths=0;Game.flies=0;Game.time=0;
    Game.state='story';Story.start(0);
  }
});
requestAnimationFrame(frame);
// debug/testing hook (harmless in production)
try{ if(typeof window!=='undefined') window.__EMBER={Game,Ch1,Ch2,Ch3a,Ch3b,Story,Ending,keys,mouse,P}; }catch(e){}
})();
