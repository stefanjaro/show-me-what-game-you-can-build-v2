// Echoes of a Lullaby - game engine
const W = 1280, H = 720;
const canvas = document.getElementById('c');
const ctx = canvas.getContext('2d');
ctx.imageSmoothingEnabled = false;

// ---------- Audio ----------
let audioCtx = null;
function ensureAudio(){ if(!audioCtx){ try{ audioCtx = new (window.AudioContext||window.webkitAudioContext)(); }catch(e){ audioCtx=null; } } }
function note(freq, dur, type='triangle', gain=0.12, when=0){
  if(!audioCtx) return;
  const t = audioCtx.currentTime + when;
  const o = audioCtx.createOscillator();
  const g = audioCtx.createGain();
  o.type = type; o.frequency.value = freq;
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(gain, t+0.02);
  g.gain.exponentialRampToValueAtTime(0.0001, t+dur);
  o.connect(g); g.connect(audioCtx.destination);
  o.start(t); o.stop(t+dur+0.05);
}
function sfx(name){
  ensureAudio();
  if(name==='jump') note(520,0.12,'square',0.08);
  else if(name==='collect') { note(660,0.1,'triangle',0.12); note(880,0.12,'triangle',0.1,0.08); }
  else if(name==='hit') note(180,0.25,'sawtooth',0.15);
  else if(name==='step') note(120,0.05,'square',0.03);
  else if(name==='switch') { note(440,0.08,'square',0.1); note(660,0.1,'square',0.1,0.08); }
  else if(name==='miss') note(220,0.2,'sawtooth',0.12);
  else if(name==='win') { [523,659,784,1046].forEach((f,i)=>note(f,0.25,'triangle',0.12,i*0.12)); }
}

// music box melody
const MELODY = [523,587,659,698,784,698,659,587, 523,523,659,784,880,784,659,523, 392,440,523,587,659,587,523,440];
let musicTimer=null, musicIdx=0;
function startMusic(tempo=1.0){
  stopMusic();
  musicIdx=0;
  musicTimer = setInterval(()=>{
    if(!audioCtx) return;
    const f = MELODY[musicIdx % MELODY.length];
    note(f, 0.18*tempo, 'triangle', 0.07);
    musicIdx++;
  }, 220/tempo);
}
function stopMusic(){ if(musicTimer){ clearInterval(musicTimer); musicTimer=null; } }

// ---------- Input ----------
const keys = {};
const pressed = {};
window.addEventListener('keydown', e=>{
  if(!keys[e.code]){ pressed[e.code]=true; }
  keys[e.code]=true;
  if(['Space','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.code)) e.preventDefault();
});
window.addEventListener('keyup', e=>{ keys[e.code]=false; });
function consume(code){ const v=pressed[code]; pressed[code]=false; return v; }
let mouse = {x:0,y:0,down:false};
canvas.addEventListener('mousemove', e=>{
  const r = canvas.getBoundingClientRect();
  mouse.x = (e.clientX-r.left)*(W/r.width);
  mouse.y = (e.clientY-r.top)*(H/r.height);
});
canvas.addEventListener('mousedown', ()=>{ mouse.down=true; });
canvas.addEventListener('mouseup', ()=>{ mouse.down=false; });

// ---------- Util ----------
function clamp(v,a,b){ return Math.max(a,Math.min(b,v)); }
function lerp(a,b,t){ return a+(b-a)*t; }
function dist(a,b){ const dx=a.x-b.x,dy=a.y-b.y; return Math.hypot(dx,dy); }
function rand(a,b){ return a+Math.random()*(b-a); }

// ---------- Particles ----------
const particles = [];
function spawnParticle(p){ particles.push(p); }
function updateParticles(dt){
  for(let i=particles.length-1;i>=0;i--){
    const p=particles[i];
    p.x += p.vx*dt; p.y += p.vy*dt;
    p.vy += (p.g||0)*dt;
    p.life -= dt;
    if(p.life<=0) particles.splice(i,1);
  }
}
function drawParticles(){
  for(const p of particles){
    const a = clamp(p.life/p.maxLife,0,1);
    ctx.globalAlpha = a;
    ctx.fillStyle = p.color;
    ctx.fillRect(p.x-p.size/2, p.y-p.size/2, p.size, p.size);
  }
  ctx.globalAlpha = 1;
}

// ---------- Stars background ----------
const stars = [];
for(let i=0;i<120;i++) stars.push({x:rand(0,W),y:rand(0,H),s:rand(0.5,2),ph:rand(0,Math.PI*2),sp:rand(0.5,2)});

// ---------- Game state ----------
let state = 'MENU'; // MENU, STORY, PLAY, PAUSE, OVER, WIN, CREDITS
let levelIndex = 0;
let level = null;
let player = null;
let camera = {x:0,y:0};
let storyLines = [];
let storyIdx = 0;
let storyTimer = 0;
let typed = '';
let typedTarget = '';
let totalFragments = 0;
let fragmentsCollected = 0;
let dawnTimer = 0; // for clockwork
let levelTime = 0;
let score = 0;

// ---------- Player factory ----------
function makePlayer(x,y){
  return {x,y,w:28,h:44,vx:0,vy:0,onGround:false,facing:1,t:0,hurt:0,tiptoe:false};
}

// ---------- Level base helpers ----------
function solidRects(plats){ return plats; }

function physicsPlayer(p, platforms, dt, gravity=1800, speed=260){
  const tiptoe = keys['ShiftLeft']||keys['ShiftRight'];
  p.tiptoe = tiptoe;
  const sp = tiptoe ? speed*0.45 : speed;
  let ax=0;
  if(keys['ArrowLeft']||keys['KeyA']) ax -= sp;
  if(keys['ArrowRight']||keys['KeyD']) ax += sp;
  p.vx = ax;
  if((consume('Space')||consume('ArrowUp')||consume('KeyW')) && p.onGround){
    p.vy = -720; p.onGround=false; sfx('jump');
  }
  const steps = 4;
  const sdt = dt/steps;
  for(let s=0;s<steps;s++){
    p.vy += gravity*sdt;
    // X
    p.x += p.vx*sdt;
    for(const pl of platforms){
      if(overlap(p,pl)){
        if(p.vx>0) p.x = pl.x - p.w;
        else if(p.vx<0) p.x = pl.x+pl.w;
      }
    }
    // Y
    p.y += p.vy*sdt;
    p.onGround=false;
    for(const pl of platforms){
      if(overlap(p,pl)){
        if(p.vy>=0){ p.y = pl.y - p.h; p.onGround=true; p.vy=0; }
        else { p.y = pl.y+pl.h; p.vy=0; }
      }
    }
  }
  p.facing = p.vx>0?1:(p.vx<0?-1:p.facing);
  p.t += dt;
  if(p.hurt>0) p.hurt-=dt;
  p.x = clamp(p.x,0, (level&&level.worldW?level.worldW:W)-p.w);
}

function overlap(a,b){ return a.x < b.x+b.w && a.x+a.w > b.x && a.y < b.y+b.h && a.y+a.h > b.y; }

// ---------- Level definitions ----------
const LEVELS = [
  { name:'The Bedroom', color:'#f4d9a0', accent:'#ffcc66' },
  { name:'Forest of Whispers', color:'#7fb069', accent:'#b7e4a0' },
  { name:'Clockwork City', color:'#c9a227', accent:'#ffe08a' },
  { name:'The Abyss', color:'#6a8fb5', accent:'#b3d9ff' },
  { name:'The Lullaby', color:'#ff9aa2', accent:'#ffd6da' },
];

function initLevel(i){
  levelIndex = i;
  fragmentsCollected = 0;
  levelTime = 0;
  dawnTimer = 0;
  camera.x=0; camera.y=0;
  particles.length=0;
  if(i===0) initBedroom();
  else if(i===1) initForest();
  else if(i===2) initClockwork();
  else if(i===3) initAbyss();
  else if(i===4) initLullaby();
}

// ----- Level 0: Bedroom -----
let bedroom = {};
function initBedroom(){
  bedroom = {
    worldW: 2400,
    platforms: [
      {x:0,y:640,w:2400,h:80,color:'#3a2a1a'},
      {x:300,y:520,w:160,h:20,color:'#5a4030'},
      {x:600,y:460,w:180,h:20,color:'#5a4030'},
      {x:900,y:540,w:140,h:20,color:'#5a4030'},
      {x:1200,y:480,w:200,h:20,color:'#5a4030'},
      {x:1500,y:400,w:160,h:20,color:'#5a4030'},
      {x:1800,y:520,w:180,h:20,color:'#5a4030'},
    ],
    fragments: [
      {x:360,y:490,collected:false},
      {x:960,y:510,collected:false},
      {x:1560,y:370,collected:false},
    ],
    exit: {x:2250,y:560,w:60,h:80},
    decor: []
  };
  level = bedroom;
  player = makePlayer(80,560);
  bedroom.need = 3;
}

// ----- Level 1: Forest -----
let forest = {};
function initForest(){
  forest = {
    worldW: 2600,
    platforms: [
      {x:0,y:640,w:2600,h:80,color:'#1f3320'},
      {x:250,y:560,w:120,h:16,color:'#2e4a2e'},
      {x:450,y:500,w:140,h:16,color:'#2e4a2e'},
      {x:700,y:560,w:100,h:16,color:'#2e4a2e'},
      {x:900,y:480,w:160,h:16,color:'#2e4a2e'},
      {x:1150,y:540,w:120,h:16,color:'#2e4a2e'},
      {x:1400,y:460,w:180,h:16,color:'#2e4a2e'},
      {x:1700,y:520,w:140,h:16,color:'#2e4a2e'},
      {x:1950,y:440,w:160,h:16,color:'#2e4a2e'},
      {x:2200,y:560,w:200,h:16,color:'#2e4a2e'},
    ],
    fragments: [
      {x:500,y:470,collected:false},
      {x:960,y:450,collected:false},
      {x:1480,y:430,collected:false},
      {x:2000,y:410,collected:false},
    ],
    wraiths: [
      {x:600,y:580,w:30,h:50,vx:60,patrol:[500,800],alert:0},
      {x:1300,y:580,w:30,h:50,vx:-50,patrol:[1200,1500],alert:0},
      {x:1850,y:580,w:30,h:50,vx:70,patrol:[1750,2100],alert:0},
    ],
    exit: {x:2450,y:560,w:60,h:80},
    need:3,
  };
  level=forest;
  player=makePlayer(80,560);
}

// ----- Level 2: Clockwork -----
let clock = {};
function initClockwork(){
  clock = {
    worldW: 2200,
    platforms: [
      {x:0,y:640,w:2200,h:80,color:'#3a3020'},
    ],
    gears: [
      // gear platforms that rotate when activated? We'll make moving platforms controlled by switches
    ],
    switches: [
      {x:300,y:600,w:40,h:40,on:false},
      {x:900,y:480,w:40,h:40,on:false},
      {x:1500,y:560,w:40,h:40,on:false},
    ],
    bridges: [
      {x:450,y:520,w:260,h:16,extended:false},
      {x:1050,y:440,w:260,h:16,extended:false},
      {x:1650,y:500,w:260,h:16,extended:false},
    ],
    vents: [
      {x:600,y:600,w:60,h:40,t:0},
      {x:1200,y:600,w:60,h:40,t:1.5},
      {x:1800,y:600,w:60,h:40,t:3},
    ],
    platforms2: [
      {x:200,y:560,w:120,h:16,color:'#5a4a2a'},
      {x:750,y:480,w:120,h:16,color:'#5a4a2a'},
      {x:1350,y:560,w:120,h:16,color:'#5a4a2a'},
    ],
    fragments: [
      {x:320,y:560,collected:false},
      {x:920,y:440,collected:false},
      {x:1520,y:520,collected:false},
    ],
    exit: {x:2050,y:560,w:60,h:80},
    need:3,
    timeLimit: 120,
  };
  // combine platforms
  clock.allPlatforms = [...clock.platforms, ...clock.platforms2];
  level=clock;
  player=makePlayer(80,560);
  dawnTimer = clock.timeLimit;
}

// ----- Level 3: Abyss -----
let abyss = {};
function initAbyss(){
  abyss = {
    worldW: W,
    // vertical: x fixed-ish, climb up. We'll use y decreasing upward. World height large.
    worldH: 4000,
    platforms: [],
    fragments: [],
    shadowY: 3800, // rises
    need:4,
  };
  // generate platforms
  let y = 3700;
  for(let i=0;i<40;i++){
    const x = rand(100, W-200);
    const w = rand(120,220);
    abyss.platforms.push({x,y,w,h:16,color:'#4a6a8a',fallen:false,fallTimer:0,origY:y});
    y -= rand(80,130);
  }
  // fragments
  for(let i=0;i<4;i++){
    const pl = abyss.platforms[i*9+2];
    abyss.fragments.push({x:pl.x+pl.w/2-10,y:pl.y-30,collected:false});
  }
  // top exit platform
  abyss.platforms.push({x:W/2-100,y:200,w:200,h:20,color:'#ffd6da',exit:true});
  abyss.topY = 200;
  level=abyss;
  player=makePlayer(W/2-14, 3656);
  player.vy=0;
  // camera starts at bottom
  camera.y = 3700 - H + 100;
}

// ----- Level 4: Lullaby rhythm -----
let rhythm = {};
const RHYTHM_KEYS = ['KeyA','KeyS','KeyD','KeyF'];
const RHYTHM_LANES = [W*0.25, W*0.4, W*0.6, W*0.75];
function initLullaby(){
  // generate notes for melody
  const notes = [];
  let t = 2;
  for(let i=0;i<MELODY.length;i++){
    const lane = i % 4;
    notes.push({lane, time:t, hit:false, missed:false, y:-40});
    t += 0.5;
  }
  rhythm = {
    notes,
    startTime:0,
    started:false,
    score:0,
    total: notes.length,
    combo:0,
    best:0,
  };
  level=rhythm;
  // no player platformer
}

// ---------- Story ----------
const STORIES = [
  [
    "A child sleeps. Her music box turns, slow and bright.",
    "But a shadow slips through the window and steals her dreams.",
    "You are the dancer in the box — small, porcelain, alive.",
    "Go. Bring her dreams home before dawn."
  ],
  [
    "The forest remembers her name, but the wraiths do not.",
    "Walk softly. Sound is a lantern here.",
    "Find three shards of her dream and keep moving."
  ],
  [
    "The city runs on gears and steam. Every switch is a heartbeat.",
    "Three bridges. Three switches. The clock is not patient.",
    "Do not let the steam find you."
  ],
  [
    "Below the world, the shadow waits. Climb.",
    "The platforms will not hold you long. Neither will the dark.",
    "Reach the top. Bring back the last light."
  ],
  [
    "You have her dreams. Now give them back.",
    "Play the lullaby. Every note a memory.",
    "Do not let the melody break."
  ],
];
const INTRO = [
  "ECHOES OF A LULLABY",
  "",
  "A game of light, memory, and a child's sleep.",
  "",
  "Press SPACE to begin."
];

function startStory(lines, onDone){
  storyLines = lines;
  storyIdx=0;
  typed='';
  typedTarget=lines[0];
  storyTimer=0;
  state='STORY';
  window._storyDone = onDone;
}

// ---------- Level update/draw ----------
function updateLevel(dt){
  levelTime += dt;
  if(levelIndex===0) updateBedroom(dt);
  else if(levelIndex===1) updateForest(dt);
  else if(levelIndex===2) updateClockwork(dt);
  else if(levelIndex===3) updateAbyss(dt);
  else if(levelIndex===4) updateRhythm(dt);
}

function updateBedroom(dt){
  physicsPlayer(player, bedroom.allPlatforms||bedroom.platforms, dt);
  // camera
  camera.x = clamp(player.x - W/2, 0, bedroom.worldW-W);
  // fragments
  for(const f of bedroom.fragments){
    if(!f.collected && Math.hypot((player.x+player.w/2)-(f.x+12),(player.y+player.h/2)-(f.y+12))<40){ f.collected=true; fragmentsCollected++; sfx('collect'); spawnBurst(f.x+12,f.y+12,'#ffcc66'); }
  }
  // exit
  if(fragmentsCollected>=bedroom.need && overlap(player,bedroom.exit)){
    finishLevel();
  }
  // dust
  if(Math.random()<0.02) spawnParticle({x:camera.x+rand(0,W),y:rand(0,H),vx:rand(-10,10),vy:rand(-20,-5),size:rand(1,3),color:'#f4d9a0',life:rand(1,2),maxLife:2,g:0});
}

function updateForest(dt){
  physicsPlayer(player, forest.platforms, dt, 1800, 240);
  camera.x = clamp(player.x - W/2, 0, forest.worldW-W);
  for(const f of forest.fragments){
    if(!f.collected && Math.hypot((player.x+player.w/2)-(f.x+12),(player.y+player.h/2)-(f.y+12))<40){ f.collected=true; fragmentsCollected++; sfx('collect'); spawnBurst(f.x+12,f.y+12,'#b7e4a0'); }
  }
  // wraiths
  for(const w of forest.wraiths){
    // patrol
    w.x += w.vx*dt;
    if(w.x < w.patrol[0] || w.x > w.patrol[1]-w.w){ w.vx *= -1; }
    // hearing
    const moving = Math.abs(player.vx)>10 || Math.abs(player.vy)>10;
    const d = dist({x:player.x+player.w/2,y:player.y+player.h/2},{x:w.x+w.w/2,y:w.y+w.h/2});
    const hearR = player.tiptoe ? 60 : 180;
    if(moving && d < hearR){ w.alert = Math.min(1, w.alert+dt*2); }
    else { w.alert = Math.max(0, w.alert-dt*1.5); }
    if(w.alert>0.6){
      // chase
      const dir = player.x > w.x ? 1 : -1;
      w.x += dir*120*dt;
      if(overlap(player,w)){ player.hurt=0.5; // not lethal, push back
        player.x -= dir*60; sfx('hit');
      }
    }
  }
  if(fragmentsCollected>=forest.need && overlap(player,forest.exit)){ finishLevel(); }
}

function updateClockwork(dt){
  dawnTimer -= dt;
  if(dawnTimer<=0){ // time out -> game over
    state='OVER'; stopMusic(); return;
  }
  // platforms
  const plats = [...clock.platforms, ...clock.platforms2];
  // switches
  for(const s of clock.switches){
    if(!s.on && overlap(player,s)){ s.on=true; sfx('switch'); 
      // extend corresponding bridge
      const idx = clock.switches.indexOf(s);
      if(clock.bridges[idx]) clock.bridges[idx].extended=true;
    }
  }
  // bridges as platforms if extended
  const activeBridges = clock.bridges.filter(b=>b.extended).map(b=>({x:b.x,y:b.y,w:b.w,h:b.h,color:'#c9a227'}));
  physicsPlayer(player, [...plats, ...activeBridges], dt, 1800, 260);
  camera.x = clamp(player.x - W/2, 0, clock.worldW-W);
  // vents damage
  for(const v of clock.vents){
    v.t += dt;
    const active = Math.sin(v.t*2)>0;
    if(active && overlap(player,{x:v.x,y:v.y-40,w:v.w,h:v.h+40})){
      // push back
      player.x -= 80*dt*Math.sign(player.x-(v.x+v.w/2)||1);
      if(player.hurt<=0){ player.hurt=0.3; sfx('hit'); }
    }
  }
  for(const f of clock.fragments){
    if(!f.collected && Math.hypot((player.x+player.w/2)-(f.x+12),(player.y+player.h/2)-(f.y+12))<40){ f.collected=true; fragmentsCollected++; sfx('collect'); spawnBurst(f.x+12,f.y+12,'#ffe08a'); }
  }
  if(fragmentsCollected>=clock.need && overlap(player,clock.exit)){ finishLevel(); }
}

function updateAbyss(dt){
  // vertical world. camera follows player upward (y decreases). 
  // gravity
  player.vy += 1200*dt; // lower gravity for floaty climb
  // horizontal
  let ax=0;
  if(keys['ArrowLeft']||keys['KeyA']) ax -= 220;
  if(keys['ArrowRight']||keys['KeyD']) ax += 220;
  player.vx = ax;
  if((consume('Space')||consume('ArrowUp')||consume('KeyW')) && player.onGround){ player.vy=-600; player.onGround=false; sfx('jump'); }
  // move
  player.x += player.vx*dt;
  player.x = clamp(player.x, 0, W-player.w);
  // platform collision
  player.y += player.vy*dt;
  player.onGround=false;
  for(const pl of abyss.platforms){
    if(pl.fallen) continue;
    if(overlap(player,pl)){
      if(player.vy>=0){
        player.y = pl.y - player.h; player.vy=0; player.onGround=true;
        if(!pl.fallTimer && !pl.exit){ pl.fallTimer=1.5; }
      }
    }
  }
  // fall timers
  for(const pl of abyss.platforms){
    if(pl.fallTimer>0){ pl.fallTimer-=dt; if(pl.fallTimer<=0){ pl.fallen=true; } }
  }
  // shadow rises
  abyss.shadowY -= 150*dt; // speed
  if(Math.random()<0.3) spawnParticle({x:rand(camera.x,camera.x+W),y:camera.y+rand(0,H),vx:rand(-5,5),vy:rand(20,60),size:rand(1,2),color:'#b3d9ff',life:rand(1,2),maxLife:2,g:0});
  if(player.y + player.h > abyss.shadowY){ // caught
    // respawn at last safe? just game over-ish: push? We'll game over
    state='OVER'; stopMusic(); sfx('hit'); return;
  }
  // fragments
  for(const f of abyss.fragments){
    if(!f.collected && Math.hypot((player.x+player.w/2)-(f.x+12),(player.y+player.h/2)-(f.y+12))<40){ f.collected=true; fragmentsCollected++; sfx('collect'); spawnBurst(f.x+12,f.y+12,'#b3d9ff'); }
  }
  // camera: keep player centered vertically
  camera.y = clamp(player.y - H*0.5, 0, abyss.worldH-H);
  // exit at top
  const exitPl = abyss.platforms.find(p=>p.exit);
  if(exitPl && player.y < exitPl.y && fragmentsCollected>=abyss.need){ finishLevel(); }
  // fell too far? 
  if(player.y > abyss.worldH){ state='OVER'; stopMusic(); }
}

function updateRhythm(dt){
  if(!rhythm.started){
    rhythm.started=true;
    rhythm.startTime = levelTime;
  }
  const elapsed = levelTime - rhythm.startTime;
  // move notes
  for(const n of rhythm.notes){
    if(n.hit||n.missed) continue;
    // y position based on time to hit: note falls from top to hit line at note.time
    const hitLineY = H*0.75;
    const speed = 400; // px per sec? derive
    // time until hit
    const dtHit = n.time - elapsed;
    n.y = hitLineY - dtHit*600;
    if(n.y > hitLineY + 40){ n.missed=true; rhythm.combo=0; sfx('miss'); }
  }
  // input
  for(let i=0;i<4;i++){
    if(consume(RHYTHM_KEYS[i])){
      // find nearest unhit note in this lane near hit line
      let best=null, bestD=1e9;
      for(const n of rhythm.notes){
        if(n.lane!==i || n.hit||n.missed) continue;
        const d = Math.abs(n.y - H*0.75);
        if(d<bestD){ bestD=d; best=n; }
      }
      if(best && bestD < 40){
        best.hit=true; rhythm.score++; rhythm.combo++;
        if(rhythm.combo>rhythm.best) rhythm.best=rhythm.combo;
        sfx('collect');
        spawnBurst(RHYTHM_LANES[i], H*0.75, '#ffd6da');
      } else {
        rhythm.combo=0; sfx('miss');
      }
    }
  }
  // finish when all notes resolved
  const done = rhythm.notes.every(n=>n.hit||n.missed);
  if(done && rhythm.notes.length>0){
    // require score threshold
    if(rhythm.score >= Math.ceil(rhythm.total*0.8)){ finishGame(); }
    else { state='OVER'; stopMusic(); }
  }
}

function finishLevel(){
  stopMusic();
  fragmentsCollected=0;
  if(levelIndex < LEVELS.length-1){
    // story for next? show brief
    const nextStory = STORIES[levelIndex+1];
    startStory(nextStory, ()=>{ initLevel(levelIndex+1); state='PLAY'; startMusic(1.0+levelIndex*0.05); });
  } else {
    // shouldn't happen (last is rhythm)
  }
}

function finishGame(){
  state='WIN'; stopMusic(); sfx('win'); startMusic(1.2);
}

function spawnBurst(x,y,color){
  for(let i=0;i<16;i++){
    const a = Math.random()*Math.PI*2;
    const sp = rand(60,180);
    spawnParticle({x,y,vx:Math.cos(a)*sp,vy:Math.sin(a)*sp-60,size:rand(2,4),color,life:rand(0.4,0.8),maxLife:0.8,g:300});
  }
}

// ---------- Drawing ----------
function drawBg(){
  // gradient sky
  const g = ctx.createLinearGradient(0,0,0,H);
  const lvl = LEVELS[levelIndex] || LEVELS[0];
  g.addColorStop(0, '#0a0e1f');
  g.addColorStop(1, '#1a1430');
  ctx.fillStyle=g; ctx.fillRect(0,0,W,H);
  // stars
  const t = performance.now()/1000;
  ctx.fillStyle='#ffffff';
  for(const s of stars){
    const a = 0.4+0.6*Math.sin(t*s.sp+s.ph);
    ctx.globalAlpha=a*0.6;
    ctx.fillRect(s.x, s.y, s.s, s.s);
  }
  ctx.globalAlpha=1;
}

function drawPlayer(){
  const p=player;
  // aura
  ctx.save();
  ctx.globalAlpha=0.35;
  const grd=ctx.createRadialGradient(p.x-camera.x+p.w/2, p.y-camera.y+p.h/2, 4, p.x-camera.x+p.w/2, p.y-camera.y+p.h/2, 46);
  grd.addColorStop(0,'#fff7e0'); grd.addColorStop(1,'transparent');
  ctx.fillStyle=grd; ctx.fillRect(p.x-camera.x-40, p.y-camera.y-40, p.w+80, p.h+80);
  ctx.restore();
  ctx.save();
  ctx.translate(p.x-camera.x, p.y-camera.y);
  if(p.facing<0) { ctx.scale(-1,1); ctx.translate(-p.w,0); }
  // body (dancer silhouette)
  ctx.fillStyle = p.hurt>0 ? '#ff6b6b' : '#f0e6d2';
  // head
  ctx.beginPath(); ctx.arc(p.w/2, 8, 7, 0, Math.PI*2); ctx.fill();
  // torso
  ctx.fillRect(p.w/2-5, 14, 10, 18);
  // skirt
  ctx.beginPath();
  ctx.moveTo(p.w/2-12,32); ctx.lineTo(p.w/2+12,32); ctx.lineTo(p.w/2+8,44); ctx.lineTo(p.w/2-8,44); ctx.closePath(); ctx.fill();
  // legs
  const leg = Math.sin(p.t*8)*6;
  ctx.fillRect(p.w/2-7,44,5, p.h-44 + (p.onGround?0:0));
  ctx.fillRect(p.w/2+2,44,5, p.h-44);
  // arms
  ctx.fillRect(p.w/2-14,16,4,14);
  ctx.fillRect(p.w/2+10,16,4,14);
  ctx.restore();
  // tiptoe indicator
  if(p.tiptoe){ ctx.fillStyle='rgba(255,255,255,0.3)'; ctx.fillRect(p.x-camera.x, p.y-camera.y-6, p.w, 3); }
}

function drawLevel(){
  if(levelIndex===0) drawBedroom();
  else if(levelIndex===1) drawForest();
  else if(levelIndex===2) drawClockwork();
  else if(levelIndex===3) drawAbyss();
  else if(levelIndex===4) drawRhythm();
}

function drawBedroom(){
  drawBg();
  // furniture
  ctx.fillStyle='#4a3020'; ctx.fillRect(100,560,180,80);
  ctx.fillStyle='#d8c8a0'; ctx.fillRect(110,540,160,20);
  ctx.fillStyle='#8a6a40'; ctx.fillRect(2000,500,40,140);
  ctx.fillStyle='#ffe08a'; ctx.beginPath(); ctx.arc(2020,490,18,0,Math.PI*2); ctx.fill();
  // floor/walls hint
  for(const pl of bedroom.platforms){
    ctx.fillStyle=pl.color; ctx.fillRect(pl.x-camera.x, pl.y-camera.y, pl.w, pl.h);
    // top highlight
    ctx.fillStyle='rgba(255,255,255,0.15)'; ctx.fillRect(pl.x-camera.x, pl.y-camera.y, pl.w, 3);
  }
  // fragments
  for(const f of bedroom.fragments){
    if(f.collected) continue;
    drawFragment(f.x-camera.x, f.y-camera.y, '#ffcc66');
  }
  // exit
  drawExit(bedroom.exit.x-camera.x, bedroom.exit.y-camera.y, fragmentsCollected>=bedroom.need);
  drawPlayer();
  drawParticles();
  drawHUD();
}

function drawForest(){
  drawBg();
  // trees parallax
  ctx.fillStyle='rgba(20,40,20,0.6)';
  for(let i=0;i<8;i++){
    const tx = (i*320 - camera.x*0.3) % (W+200);
    ctx.fillRect(tx, 200, 40, 440);
    ctx.beginPath(); ctx.arc(tx+20,180,60,0,Math.PI*2); ctx.fill();
  }
  for(const pl of forest.platforms){
    ctx.fillStyle=pl.color; ctx.fillRect(pl.x-camera.x, pl.y-camera.y, pl.w, pl.h);
  }
  for(const f of forest.fragments){
    if(f.collected) continue;
    drawFragment(f.x-camera.x, f.y-camera.y, '#b7e4a0');
  }
  // wraiths
  for(const w of forest.wraiths){
    ctx.save();
    ctx.globalAlpha = 0.5 + w.alert*0.5;
    ctx.fillStyle = w.alert>0.6 ? '#ff4444' : '#8a6a9a';
    ctx.fillRect(w.x-camera.x, w.y-camera.y, w.w, w.h);
    // eyes
    ctx.fillStyle='#fff'; ctx.fillRect(w.x-camera.x+6, w.y-camera.y+10, 4,4); ctx.fillRect(w.x-camera.x+20,w.y-camera.y+10,4,4);
    ctx.restore();
    // hearing radius indicator if alert
    if(w.alert>0){
      ctx.strokeStyle='rgba(255,100,100,'+w.alert*0.4+')';
      ctx.beginPath(); ctx.arc(w.x-camera.x+w.w/2, w.y-camera.y+w.h/2, (player.tiptoe?60:180)*w.alert, 0, Math.PI*2); ctx.stroke();
    }
  }
  drawExit(forest.exit.x-camera.x, forest.exit.y-camera.y, fragmentsCollected>=forest.need);
  drawPlayer();
  // noise ripple
  if(Math.abs(player.vx)>10 || Math.abs(player.vy)>10){
    ctx.strokeStyle='rgba(255,255,255,0.15)';
    ctx.beginPath(); ctx.arc(player.x-camera.x+player.w/2, player.y-camera.y+player.h/2, (player.tiptoe?30:90),0,Math.PI*2); ctx.stroke();
  }
  drawParticles();
  drawHUD();
  // tiptoe hint
  ctx.fillStyle='rgba(255,255,255,0.7)'; ctx.font='14px Georgia'; ctx.fillText('Hold SHIFT to tiptoe (quiet)', 20, H-20);
}

function drawClockwork(){
  drawBg();
  // gear decorations
  ctx.fillStyle='#2a2015';
  ctx.fillRect(0,0,W,H);
  // gears
  const t=performance.now()/1000;
  for(const g of [{x:200,y:200,r:60},{x:1000,y:150,r:80},{x:1700,y:220,r:50}]){
    ctx.save(); ctx.translate(g.x-camera.x, g.y-camera.y);
    ctx.strokeStyle='rgba(201,162,39,0.35)'; ctx.lineWidth=3;
    ctx.beginPath(); ctx.arc(0,0,g.r,0,Math.PI*2); ctx.stroke();
    for(let i=0;i<8;i++){
      const a=t+i*Math.PI/4;
      ctx.beginPath(); ctx.moveTo(Math.cos(a)*g.r,Math.sin(a)*g.r); ctx.lineTo(Math.cos(a)*(g.r+12),Math.sin(a)*(g.r+12)); ctx.stroke();
    }
    ctx.restore();
  }
  // subtle grid
  ctx.strokeStyle='rgba(201,162,39,0.08)';
  for(let x=0;x<W;x+=80){ ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x,H); ctx.stroke(); }
  for(let y=0;y<H;y+=80){ ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(W,y); ctx.stroke(); }
  const plats=[...clock.platforms,...clock.platforms2];
  for(const pl of plats){
    ctx.fillStyle=pl.color; ctx.fillRect(pl.x-camera.x, pl.y-camera.y, pl.w, pl.h);
  }
  for(const b of clock.bridges){
    if(!b.extended) continue;
    ctx.fillStyle='#c9a227'; ctx.fillRect(b.x-camera.x,b.y-camera.y,b.w,b.h);
    ctx.fillStyle='rgba(255,255,255,0.3)'; ctx.fillRect(b.x-camera.x,b.y-camera.y,b.w,3);
  }
  // switches
  for(const s of clock.switches){
    ctx.fillStyle = s.on ? '#5aff8a' : '#c9a227';
    ctx.fillRect(s.x-camera.x, s.y-camera.y, s.w, s.h);
    ctx.fillStyle='#000'; ctx.font='bold 12px monospace'; ctx.fillText(s.on?'ON':'', s.x-camera.x+6, s.y-camera.y+26);
  }
  // vents
  for(const v of clock.vents){
    const active = Math.sin(v.t*2)>0;
    ctx.fillStyle = active ? '#ff6b3a' : '#555';
    ctx.fillRect(v.x-camera.x, v.y-camera.y, v.w, v.h);
    if(active){
      ctx.fillStyle='rgba(255,100,60,0.3)';
      ctx.fillRect(v.x-camera.x, v.y-camera.y-40, v.w, 40);
    }
  }
  for(const f of clock.fragments){
    if(f.collected) continue;
    drawFragment(f.x-camera.x, f.y-camera.y, '#ffe08a');
  }
  drawExit(clock.exit.x-camera.x, clock.exit.y-camera.y, fragmentsCollected>=clock.need);
  drawPlayer();
  drawParticles();
  // HUD timer
  ctx.fillStyle='#fff'; ctx.font='bold 20px Georgia';
  ctx.fillText('Time: '+Math.ceil(dawnTimer)+'s', 20, 30);
  drawHUD();
}

function drawAbyss(){
  // vertical: camera.y offset
  const g = ctx.createLinearGradient(0,0,0,H);
  g.addColorStop(0,'#050a18'); g.addColorStop(1,'#0a1a2e');
  ctx.fillStyle=g; ctx.fillRect(0,0,W,H);
  // platforms
  for(const pl of abyss.platforms){
    if(pl.fallen) continue;
    const alpha = pl.fallTimer>0 ? 0.5+0.5*Math.sin(pl.fallTimer*20) : 1;
    ctx.globalAlpha=alpha;
    ctx.fillStyle=pl.color; ctx.fillRect(pl.x-camera.x, pl.y-camera.y, pl.w, pl.h);
    ctx.globalAlpha=1;
  }
  for(const f of abyss.fragments){
    if(f.collected) continue;
    drawFragment(f.x-camera.x, f.y-camera.y-camera.y?0:0, '#b3d9ff'); // careful
  }
  // fix fragment draw with camera
  // (above double subtract bug) redo:
  // Actually re-draw fragments correctly:
  // We'll just draw separately below by clearing? Too late. Let's instead not draw above; handle here.
  // Oops. Let's restructure: skip above fragment draw mistake.
  // Shadow
  const sy = abyss.shadowY - camera.y;
  ctx.fillStyle='rgba(0,0,0,0.85)';
  ctx.fillRect(0, sy, W, H-sy+100);
  ctx.fillStyle='rgba(120,0,0,0.4)'; ctx.fillRect(0,sy-10,W,10);
  drawPlayerAbyss();
  drawParticles();
  // HUD
  ctx.fillStyle='#fff'; ctx.font='bold 20px Georgia';
  ctx.fillText('Fragments: '+fragmentsCollected+'/'+abyss.need, 20, 30);
  ctx.fillText('Climb!', 20, 60);
}

// fix fragment draw in abyss: do it before shadow
// We'll patch by overriding drawAbyss fragments via monkey? Instead edit: remove earlier fragment block and add correct.
// (handled below by redefining drawAbyss)

function drawPlayerAbyss(){
  const p=player;
  ctx.save();
  ctx.translate(p.x-camera.x, p.y-camera.y);
  ctx.fillStyle = p.hurt>0 ? '#ff6b6b' : '#f0e6d2';
  ctx.beginPath(); ctx.arc(p.w/2, 8, 7, 0, Math.PI*2); ctx.fill();
  ctx.fillRect(p.w/2-5, 14, 10, 18);
  ctx.beginPath();
  ctx.moveTo(p.w/2-12,32); ctx.lineTo(p.w/2+12,32); ctx.lineTo(p.w/2+8,44); ctx.lineTo(p.w/2-8,44); ctx.closePath(); ctx.fill();
  ctx.fillRect(p.w/2-7,44,5, p.h-44);
  ctx.fillRect(p.w/2+2,44,5, p.h-44);
  ctx.restore();
}

function drawRhythm(){
  // background
  const g = ctx.createLinearGradient(0,0,0,H);
  g.addColorStop(0,'#1a0a2e'); g.addColorStop(1,'#0a0a1f');
  ctx.fillStyle=g; ctx.fillRect(0,0,W,H);
  // lanes
  for(let i=0;i<4;i++){
    ctx.strokeStyle='rgba(255,255,255,0.15)';
    ctx.beginPath(); ctx.moveTo(RHYTHM_LANES[i],0); ctx.lineTo(RHYTHM_LANES[i],H); ctx.stroke();
  }
  // hit line
  ctx.strokeStyle='#ffd6da'; ctx.lineWidth=3;
  ctx.beginPath(); ctx.moveTo(0,H*0.75); ctx.lineTo(W,H*0.75); ctx.stroke(); ctx.lineWidth=1;
  // notes
  for(const n of rhythm.notes){
    if(n.hit){
      ctx.globalAlpha=0.3;
    }
    const col = n.hit ? '#5aff8a' : (n.missed ? '#555' : '#ff9aa2');
    ctx.fillStyle=col;
    ctx.fillRect(RHYTHM_LANES[n.lane]-18, n.y-12, 36, 24);
    ctx.globalAlpha=1;
  }
  // keys
  const keyLabels=['A','S','D','F'];
  for(let i=0;i<4;i++){
    ctx.fillStyle='rgba(255,255,255,0.2)';
    ctx.fillRect(RHYTHM_LANES[i]-22, H*0.78, 44, 44);
    ctx.fillStyle='#fff'; ctx.font='bold 24px Georgia'; ctx.textAlign='center';
    ctx.fillText(keyLabels[i], RHYTHM_LANES[i], H*0.78+30);
    ctx.textAlign='left';
  }
  // HUD
  ctx.fillStyle='#fff'; ctx.font='bold 22px Georgia';
  ctx.fillText('Score: '+rhythm.score+'/'+rhythm.total, 20, 30);
  ctx.fillText('Combo: '+rhythm.combo, 20, 60);
  drawParticles();
}

function drawFragment(x,y,color){
  const t = performance.now()/300;
  const glow = 8+4*Math.sin(t);
  ctx.save();
  ctx.shadowColor=color; ctx.shadowBlur=glow;
  ctx.fillStyle=color;
  ctx.beginPath(); ctx.arc(x+12,y+12,8,0,Math.PI*2); ctx.fill();
  ctx.restore();
}

function drawExit(x,y,ready){
  ctx.fillStyle = ready ? '#5aff8a' : '#555';
  ctx.fillRect(x,y,60,80);
  ctx.fillStyle='#000'; ctx.font='bold 12px monospace';
  ctx.fillText(ready?'EXIT':'LOCKED', x+6, y+46);
  // door arch
  ctx.strokeStyle=ready?'#5aff8a':'#555'; ctx.lineWidth=2;
  ctx.beginPath(); ctx.arc(x+30,y,30,Math.PI,0); ctx.stroke(); ctx.lineWidth=1;
}

function drawHUD(){
  const lvl = LEVELS[levelIndex];
  ctx.fillStyle='rgba(0,0,0,0.4)'; ctx.fillRect(0,0,W,40);
  ctx.fillStyle='#fff'; ctx.font='bold 18px Georgia';
  ctx.fillText(lvl.name, W/2-60, 26);
  ctx.fillText('Fragments: '+fragmentsCollected+'/'+(level.need||0), W-200, 26);
}

// ---------- Menu / Story / Over / Win drawing ----------
function drawMenu(){
  drawBg();
  ctx.fillStyle='rgba(0,0,0,0.3)'; ctx.fillRect(0,0,W,H);
  ctx.textAlign='center';
  ctx.fillStyle='#f0e6d2'; ctx.font='bold 64px Georgia';
  ctx.fillText('ECHOES OF A LULLABY', W/2, H/2-60);
  ctx.font='22px Georgia';
  ctx.fillStyle='#b3d9ff';
  ctx.fillText('A dancer of porcelain. A child asleep. A shadow that steals dreams.', W/2, H/2);
  ctx.font='18px Georgia'; ctx.fillStyle='#aaa';
  ctx.fillText('Press SPACE to begin', W/2, H/2+80);
  ctx.textAlign='left';
  // twinkle
}

function drawStory(){
  drawBg();
  ctx.fillStyle='rgba(0,0,0,0.5)'; ctx.fillRect(0,0,W,H);
  ctx.textAlign='center';
  ctx.fillStyle='#f0e6d2'; ctx.font='26px Georgia';
  // typed current line
  const lines = storyLines;
  let y = H/2 - (lines.length*34)/2;
  for(let i=0;i<lines.length;i++){
    if(i < storyIdx) ctx.fillText(lines[i], W/2, y+i*40);
    else if(i===storyIdx) ctx.fillText(typed, W/2, y+i*40);
  }
  ctx.font='16px Georgia'; ctx.fillStyle='#888';
  ctx.fillText('SPACE to continue', W/2, H-60);
  ctx.textAlign='left';
}

function drawOver(){
  ctx.fillStyle='rgba(0,0,0,0.7)'; ctx.fillRect(0,0,W,H);
  ctx.textAlign='center';
  ctx.fillStyle='#ff6b6b'; ctx.font='bold 56px Georgia';
  ctx.fillText('The dream fades...', W/2, H/2-20);
  ctx.fillStyle='#ddd'; ctx.font='20px Georgia';
  ctx.fillText('Press R to retry the level', W/2, H/2+40);
  ctx.textAlign='left';
}

function drawWin(){
  ctx.fillStyle='rgba(0,0,0,0.6)'; ctx.fillRect(0,0,W,H);
  ctx.textAlign='center';
  ctx.fillStyle='#ffd6da'; ctx.font='bold 52px Georgia';
  ctx.fillText('She smiles in her sleep.', W/2, H/2-40);
  ctx.fillStyle='#f0e6d2'; ctx.font='22px Georgia';
  ctx.fillText('The music box turns. The shadow is gone.', W/2, H/2+10);
  ctx.fillStyle='#aaa'; ctx.font='18px Georgia';
  ctx.fillText('Press R to play again', W/2, H/2+70);
  ctx.textAlign='left';
}

// ---------- Story typing logic ----------
function updateStory(dt){
  storyTimer += dt;
  if(typed.length < typedTarget.length){
    if(storyTimer > 0.03){
      storyTimer=0;
      typed += typedTarget[typed.length];
    }
  }
  if(consume('Space')){
    if(typed.length < typedTarget.length){
      typed = typedTarget; // skip typing
    } else {
      storyIdx++;
      if(storyIdx >= storyLines.length){
        const cb = window._storyDone; window._storyDone=null;
        if(cb) cb();
      } else {
        typed=''; typedTarget=storyLines[storyIdx]; storyTimer=0;
      }
    }
  }
}

// ---------- Main loop ----------
let last = performance.now();
function frame(now){
  const dt = Math.min(0.033, (now-last)/1000);
  last=now;
  ctx.clearRect(0,0,W,H);

  if(state==='MENU'){
    drawMenu();
    if(consume('Space')){
      ensureAudio(); 
      startStory(INTRO, ()=>{ initLevel(0); state='PLAY'; startMusic(1.0); });
    }
  } else if(state==='STORY'){
    updateStory(dt);
    drawStory();
  } else if(state==='PLAY'){
    updateLevel(dt);
    if(state==='PLAY'){
      if(levelIndex===0) drawBedroom();
      else if(levelIndex===1) drawForest();
      else if(levelIndex===2) drawClockwork();
      else if(levelIndex===3) drawAbyssFixed();
      else if(levelIndex===4) drawRhythm();
    }
    // pause
    if(consume('Escape')){ state='PAUSE'; }
  } else if(state==='PAUSE'){
    // draw last frame? just overlay
    if(levelIndex===0) drawBedroom();
    else if(levelIndex===1) drawForest();
    else if(levelIndex===2) drawClockwork();
    else if(levelIndex===3) drawAbyssFixed();
    else if(levelIndex===4) drawRhythm();
    ctx.fillStyle='rgba(0,0,0,0.5)'; ctx.fillRect(0,0,W,H);
    ctx.textAlign='center'; ctx.fillStyle='#fff'; ctx.font='bold 32px Georgia';
    ctx.fillText('PAUSED', W/2, H/2); ctx.textAlign='left';
    if(consume('Escape')) state='PLAY';
  } else if(state==='OVER'){
    if(levelIndex===0) drawBedroom();
    else if(levelIndex===1) drawForest();
    else if(levelIndex===2) drawClockwork();
    else if(levelIndex===3) drawAbyssFixed();
    else if(levelIndex===4) drawRhythm();
    drawOver();
    if(consume('KeyR')){
      initLevel(levelIndex); state='PLAY'; startMusic(1.0+levelIndex*0.05);
    }
  } else if(state==='WIN'){
    drawRhythm();
    drawWin();
    if(consume('KeyR')){ state='MENU'; stopMusic(); }
  }

  // update particles always
  // (particles updated in levels; menu none)
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// ---------- Abyss draw fixed (fragments correct) ----------
function drawAbyssFixed(){
  const g = ctx.createLinearGradient(0,0,0,H);
  g.addColorStop(0,'#050a18'); g.addColorStop(1,'#0a1a2e');
  ctx.fillStyle=g; ctx.fillRect(0,0,W,H);
  for(const pl of abyss.platforms){
    if(pl.fallen) continue;
    const alpha = pl.fallTimer>0 ? 0.5+0.5*Math.sin(pl.fallTimer*20) : 1;
    ctx.globalAlpha=alpha;
    ctx.fillStyle=pl.color; ctx.fillRect(pl.x-camera.x, pl.y-camera.y, pl.w, pl.h);
    ctx.globalAlpha=1;
  }
  for(const f of abyss.fragments){
    if(f.collected) continue;
    drawFragment(f.x-camera.x, f.y-camera.y, '#b3d9ff');
  }
  const sy = abyss.shadowY - camera.y;
  ctx.fillStyle='rgba(0,0,0,0.85)';
  ctx.fillRect(0, sy, W, H-sy+100);
  ctx.fillStyle='rgba(120,0,0,0.4)'; ctx.fillRect(0,sy-10,W,10);
  drawPlayerAbyss();
  drawParticles();
  ctx.fillStyle='#fff'; ctx.font='bold 20px Georgia';
  ctx.fillText('Fragments: '+fragmentsCollected+'/'+abyss.need, 20, 30);
  ctx.fillText('Climb! (Shadow rising)', 20, 60);
}

// drawAbyss legacy kept; frame uses drawAbyssFixed

// ---------- Fix initLevel abyss camera & player already ----------
// ---------- Fix bedroom/clock platforms aggregate ----------
// bedroom allPlatforms
// set in init after
// (initBedroom uses bedroom.platforms; physics uses bedroom.allPlatforms||bedroom.platforms)
// ensure allPlatforms defined
const _origInitBedroom = initBedroom;
// patch not needed; handle in update by fallback
// ---------- particle update hook ----------
// update particles in each level draw? We'll call updateParticles in updateLevel via adding:
// (monkey patch updateLevel)
const _origUpdateLevel = updateLevel;
function updateLevelWrapped(dt){
  _origUpdateLevel(dt);
  updateParticles(dt);
}
// replace calls: updateLevel = updateLevelWrapped
// but updateLevel is called in frame; redefine by editing? We'll just assign:
// (can't reassign const? it's function decl, mutable)
updateLevel = updateLevelWrapped;
