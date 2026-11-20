'use strict';
(function(){
const LF = window.LF;

const SEED0 = 90210;

const PROLOGUE = [
  'Every night, the dead come down to the water.',
  'Every night, one boat goes out to meet them.',
  'Tonight, five souls wait at the crossing.',
  'And tonight — for the first time in a thousand years — the river feels different.'
];

const EPILOGUE = [
  'For a thousand years, the Ferryman carried the dead down the still water.',
  'And every night he asked the river: "When may I carry a life instead?"',
  'The river never answered. Rivers are patient. They wait until you are ready to hear it.',
  'Tonight, a small light went home to be born — and for the first time, the water was warm on the way back.',
  'Somewhere, a child wakes and asks: "Who rows the boat between the worlds?"',
  '"Someone kind," says the river. "I chose the oars myself."'
];

const RETRY_CARD = ['The old hull rests beneath the reeds. The river returns what is empty — and it always, always returns the ferryman.'];
const RETRY_DLG = [{who:'ferryman', text:'Again, then. The night is long, and the dead are patient.'}];

const SEGS = [
  {
    key:'oldman', chapter:'the first fare', palette:'night', mood:'night',
    facing:1, len:6200, current:90, wind:0.05, landmark:'town',
    wispColor:'#dfe6ff', showPace:true, pay:true,
    objective:'Row gently — keep the pace needle in the calm.',
    build(w,rng){
      w.scatterRocks(rng,6,620,5700,150,850,26,50);
      w.addFireflies(400,5800,90,220,12,0.7);
      w.addFireflies(400,5800,780,910,12,0.7);
    },
    board(){
      return [
        {who:'ferryman', text:'Step aboard, grandfather. Mind the lantern.'},
        {who:'oldman', text:'Slowly, if you please. I hurried enough for one lifetime. Or nine.'},
        {who:'oldman', text:'Point me at the far shore, and take your sweet time about it.'}
      ];
    },
    tick(g,dt,p){
      const st=g.segState;
      g.paceVal=Math.max(0,g.boat.vx-g.world.current);
      if(g.paceVal>265){
        st.hastyTotal=(st.hastyTotal||0)+dt;
        if(st.hastyTotal>3.6 && !st.flags.hasty){
          st.flags.hasty=true;
          LF.UI.dialogue([{who:'oldman', text:'Easy now. The dead are not in a hurry. Only the living are.'}]);
        }
      }
      if(p>0.45 && !st.flags.mid){
        st.flags.mid=true;
        LF.UI.dialogue([{who:'oldman', text:'You row like my son did. He would hate that I said it out loud.'}]);
      }
    },
    arrive(g){
      if((g.segState.hastyTotal||0)<4.5){
        return [
          {who:'oldman', text:'Three herons tonight. I counted them for you.'},
          {who:'oldman', text:'Do not rush the next one either, boy. The river rewards the patient.'},
          {who:'ferryman', text:'Safe travels, grandfather. The dark is kind, from here on.'}
        ];
      }
      return [
        {who:'oldman', text:'We made good time. A pity. Time was the only thing I wanted more of.'}
      ];
    },
    finish(g){
      g.stats.pace = (g.segState.hastyTotal||0)<4.5;
    },
    after:['The moon climbs. The dead do not feel the cold — still, the Ferryman gives them his lantern.']
  },
  {
    key:'child', chapter:'the second fare', palette:'wonder', mood:'wonder',
    facing:1, len:7600, current:110, wind:0.1, landmark:'town',
    wispColor:'#a8f0ff', pay:true,
    objective:'Catch the falling star.',
    build(w,rng){
      w.scatterRocks(rng,10,620,6900,150,850,24,46);
      w.rockRows(rng,3800,6900);
      w.addFireflies(600,7000,90,220,10,0.6);
      w.addFireflies(600,7000,780,910,10,0.6);
    },
    board(){
      return [
        {who:'child', text:'Are you the dream boat? Grandma said dreams arrive on the water!'},
        {who:'child', text:'I am not sleepy AT ALL, by the way. I am only here for the ride.'},
        {who:'ferryman', text:'Sit small, bright one. The night is looking for excuses to sparkle.'}
      ];
    },
    tick(g,dt,p){
      const st=g.segState;
      if(p>0.18 && !st.flags.star){
        st.flags.star=true;
        g.world.star={x:g.boat.x+900, baseY:LF.rand(320,620), y:400, ph:0, vx:175, caught:false};
        LF.UI.dialogue([
          {who:'child', text:'LOOK! Falling stars! The sky is throwing a party and we are INVITED!'},
          {who:'child', text:'That one is landing in the river! Can we catch it? Pleasepleaseplease — I will carry it home in my pocket!'}
        ]);
      }
      const s=g.world.star;
      if(s && !s.caught){
        if(LF.dist2(g.boat.x,g.boat.y,s.x,s.y)<5600){
          s.caught=true;
          g.stats.star=true;
          g.boat.lightR=380;
          LF.Audio.sparkle();
          LF.Particles.burst(s.x,s.y,'#cfeeff');
          LF.Particles.spark(s.x,s.y,'#cfeeff',14,120);
          LF.UI.dialogue([
            {who:'child', text:'GOT IT! It is warm! Like a cat that decided to be a star today.'},
            {who:'ferryman', text:'Keep it safe, little one. Caught stars stay lit for kind hands.'}
          ]);
        } else if(p>0.88 && !st.flags.missed){
          st.flags.missed=true;
          LF.UI.dialogue([{who:'child', text:'It got away... that is okay. I will dream it caught us instead. Same thing, if you believe hard.'}]);
        }
      }
    },
    arrive(g){
      if(g.stats.star){
        return [
          {who:'child', text:'Best dream EVER. Tell my grandma I beat the fireworks.'},
          {who:'child', text:'Wait — how do you tell someone a dream? ...You just remember it really hard, right?'},
          {who:'ferryman', text:'That is exactly right. Go on, now. Remember hard.'}
        ];
      }
      return [
        {who:'child', text:'Best dream EVER — even without the star. I will remember it caught us anyway.'}
      ];
    },
    finish(g){},
    after:['Somewhere below, a starfish inherits a fallen star. The river keeps every promise it can.']
  },
  {
    key:'reeds', chapter:'the third fare', palette:'reeds', mood:'reeds',
    facing:1, len:7000, current:70, wind:0.12, landmark:'town',
    wispColor:'#ffe8f0', pay:true,
    objective:'Follow the fireflies to the blossom tree.',
    build(w,rng){
      w.scatterRocks(rng,8,620,2100,150,850,24,44);
      w.buildMaze(rng,2500,5900);
      w.rocks.push({x:6180,y:500,r:110,seed:5,tree:true});
      w.tree={x:6180,y:500,sangT:0,sang:false};
      w.addFireflies(6020,6340,360,640,10,1);
    },
    board(){
      return [
        {who:'lady', text:'Forgive me. I keep looking back at the reeds — do you see the channel there?'},
        {who:'lady', text:'A nightingale nests among them. Forty springs ago, a young man proposed to me to that exact song.'},
        {who:'lady', text:'Could we go in? One last time? I know the way is narrow. I am not afraid of narrow.'}
      ];
    },
    tick(g,dt,p){
      const st=g.segState;
      const tr=g.world.tree;
      if(p>0.32 && !st.flags.maze){
        st.flags.maze=true;
        LF.UI.dialogue([{who:'ferryman', text:'The fireflies know the way. They always have. Hold steady.'}]);
      }
      if(tr){
        const d=LF.dist(g.boat.x,g.boat.y,tr.x,tr.y);
        if(d<300 && !st.flags.near){
          st.flags.near=true;
          LF.UI.dialogue([{who:'lady', text:'There — the blossom tree. Hush now... let us not scare it.'}]);
        }
        tr.warm = d<250;
        if(d<205 && g.boat.speed<72){
          tr.sangT+=dt;
          if(tr.sangT>2.0 && !tr.sang){
            tr.sang=true;
            g.stats.song=true;
            LF.Audio.bird();
          }
        }
        if(tr.sang && !st.flags.thanks){
          st.thanksT=(st.thanksT===undefined?6.6:st.thanksT)-dt;
          if(st.thanksT<=0){
            st.flags.thanks=true;
            LF.UI.dialogue([
              {who:'lady', text:'...It is still singing. After everything. It is still singing.'},
              {who:'lady', text:'Thank you, Ferryman. You gave an old woman one more spring.'}
            ]);
          }
        }
      }
    },
    arrive(g){
      if(g.stats.song){
        return [
          {who:'lady', text:'I will carry the song with me. That is what the dead are for — carrying the beautiful things, so the living may set them down gently.'},
          {who:'ferryman', text:'Sing it back to them sometimes, madam. The living forget how to listen.'}
        ];
      }
      return [
        {who:'lady', text:'The nightingale stayed quiet tonight. Perhaps it has sung enough for one lifetime... have we not all.'}
      ];
    },
    finish(g){},
    after:['The river remembers everything, forgets nothing, and tells no one. Tonight, it told the reeds.']
  },
  {
    key:'merchant', chapter:'the fourth fare', palette:'rapids', mood:'rapids',
    facing:1, len:9000, current:150, wind:0.8, landmark:'town', rapids:true,
    wispColor:'#ffd98c', pay:true, timerMax:40,
    objective:'Beat the deadline — forty seconds.',
    firstHit:{who:'merchant', text:'That one is on the river! I will dock your pay. DOCK. Get it? ...Tough crowd, the dead.'},
    build(w,rng){
      w.scatterRocks(rng,8,620,1400,150,850,24,46);
      w.rockRows(rng,1600,8300);
    },
    board(){
      return [
        {who:'merchant', text:'AT LAST! I have been standing here since half past six. Half past six! And I died at quarter past!'},
        {who:'merchant', text:'The buyer waits across. The deadline stands. Row like you are paid to — because you ARE. Sort of.'},
        {who:'merchant', text:'Forty seconds, ferryman. Make it forty and there is a tip in it for you.'}
      ];
    },
    tick(g,dt,p){
      const st=g.segState;
      if(g.timer<=10 && !st.flags.warn && g.timerOn){
        st.flags.warn=true;
        LF.UI.dialogue([{who:'merchant', text:'Tick tock, row row! MARVELLOUS stuff. Do not bank on the tip yet!'}]);
      }
      if(g.timer<=0 && !st.flags.late){
        st.flags.late=true;
        LF.UI.toast('The deadline drifts past... the dead keep no calendars.');
      }
      if(LF.SMOKE && !g.smokeSinkDone && p>0.25){
        g.smokeSinkDone=true;
        g.boat.hull=3;
        g.startSink();
      }
    },
    arrive(g){
      if(g.timer>0){
        return [
          {who:'merchant', text:'PUNCTUAL and upright! Here — three extra coins. Do not spend it all on... whatever ferrymen buy. Oars? Oars.'},
          {who:'merchant', text:'Pleasure doing business. If you ever need crockery upstairs — HA — you will not. Nothing breaks up there. NOTHING.'}
        ];
      }
      return [
        {who:'merchant', text:'Late! HA! There is no deadline up here, is there? I just like keeping busy. Keeps eternity interesting.'},
        {who:'merchant', text:'No tip for you, but no hard feelings. The dead cannot afford grudges. Bad for the posture.'}
      ];
    },
    finish(g){
      g.stats.deadline = g.timer>0;
      if(g.stats.deadline){
        g.boat.coins+=3;
        LF.Audio.coin();
      }
    },
    after:[
      'The loud ones keep the night awake. The night, it must be said, does not seem to mind.',
      'And now — the far gate stands open. Nothing ever comes through it. Nothing ever has. Until tonight.'
    ]
  },
  {
    key:'light', chapter:'the last fare', palette:'predawn', mood:'upstream',
    facing:-1, len:8200, current:95, wind:0.35, landmark:'gate', boardDock:'right', pay:false,
    wispColor:'#fff4d0', showLanes:true,
    objective:'Row upstream — ride the golden lanes.',
    swirlLine:{who:'ferryman', text:'Steady. Circle wide. The deep is curious tonight, not cruel.'},
    build(w,rng){
      const laneDefs=[[6700,7600,260,480],[5200,6300,560,800],[3700,4800,160,400],[2200,3300,560,800],[700,1700,280,520]];
      for(const d of laneDefs) w.lanes.push({x0:d[0],x1:d[1],y0:d[2],y1:d[3],cool:0});
      w.scatterRocks(rng,16,900,7400,150,850,26,54);
      w.rocks=w.rocks.filter(r=>!w.lanes.some(l=>r.x>l.x0-90&&r.x<l.x1+90&&r.y>l.y0-70&&r.y<l.y1+70));
      let placed=0, tries=0;
      while(placed<7 && tries<60){
        tries++;
        const x=LF.lerp(1500,7300,rng());
        const y=LF.lerp(220,780,rng());
        const R=LF.lerp(105,155,rng());
        if(w.lanes.some(l=>x>l.x0-R-140&&x<l.x1+R+140)) continue;
        if(w.rocks.some(r=>LF.dist(r.x,r.y,x,y)<r.r+R+90)) continue;
        w.whirls.push({x,y,R,ph:rng()*9,cool:0});
        placed++;
      }
    },
    board(){
      return [
        {who:'ferryman', text:'No coin tonight. Only a light — small as a held breath, humming like a morning.'},
        {who:'ferryman', text:'The river has never carried a soul upstream. The current will not help. It never helps with this.'},
        {who:'ferryman', text:'Row, Ferryman. Row like a world is waiting on the other side. (Because it is.)'}
      ];
    },
    tick(g,dt,p){
      const st=g.segState;
      if(g.boat.lane && g.boat.lane.cool<=0){
        g.boat.lane.cool=8;
        g.stats.lanes++;
        LF.Audio.hum();
        LF.Particles.burst(g.boat.x,g.boat.y,'#ffe9b8');
        if(!st.flags.lane1){
          st.flags.lane1=true;
          LF.UI.dialogue([{who:'ferryman', text:'There — the warm water. The river lets us through, lane by lane. Listen: the light sings when we ride them.'}]);
        }
        if(g.stats.lanes===4){
          LF.UI.toast('The light sings with all its heart — four of four.');
        }
      }
      if(p>0.5 && !st.flags.moon){
        st.flags.moon=true;
        LF.UI.dialogue([{who:'ferryman', text:'The moon is setting. Good. Let it rest — it has kept watch long enough.'}]);
      }
      if(p>0.72 && !st.flags.dawnMood){
        st.flags.dawnMood=true;
        LF.Audio.setMood('dawn');
      }
    },
    arrive(g){ return []; },
    finish(g){},
    after:[]
  }
];

class GameClass{
  constructor(){
    this.state='title';
    this.segIndex=0;
    this.seg=SEGS[0];
    this.world=null;
    this.boat=new LF.Boat();
    this.cam={x:0};
    this.time=0;
    this.moonP=0.05;
    this.dawnT=0;
    this.endT=0;
    this.meteors=[];
    this.shakeT=0; this.shakeA=0;
    this.stats={coins:0,pace:false,star:false,song:false,deadline:false,lanes:0,retries:0};
    this.segState={flags:{},hastyTotal:0};
    this.segCoinsStart=0;
    this.paceVal=0;
    this.showPace=false;
    this.showLanes=false;
    this.timer=0; this.timerMax=1; this.timerOn=false;
    this.boardT=0;
    this.boardWisp=null;
    this.exitWisp=null;
    this.relWisp=null;
    this.arriveT=0;
    this.sinkT=0;
    this.releaseT=0;
    this.retryMode=false;
    this.smokeSinkDone=false;
    this.controlOK=false;
    this.pauseFlag=false;
    this.clickFlag=false;
    this.titleGone=false;
  }
  crossP(){
    if(!this.world) return 0;
    return this.seg.facing>0 ? this.boat.x/this.world.len : 1-this.boat.x/this.world.len;
  }
  boot(){
    this.loadSegment(0);
    if(LF.SMOKE){
      this.state='idle';
      LF.UI.setFade(0);
      LF.UI.card(PROLOGUE,{kicker:'the last ferry'},()=>this.boarding());
    } else {
      this.state='title';
      LF.UI.fade(0,2.4);
    }
  }
  begin(){
    if(this.titleGone) return;
    this.titleGone=true;
    LF.Audio.init();
    LF.Audio.resume();
    LF.UI.els.title.classList.add('gone');
    this.state='idle';
    LF.UI.card(PROLOGUE,{kicker:'the last ferry'},()=>{
      this.loadSegment(0);
      this.boarding();
    });
  }
  loadSegment(i){
    this.segIndex=i;
    this.seg=SEGS[i];
    this.segState={flags:{},hastyTotal:0,thanksT:undefined};
    this.world=new LF.World(this.seg, SEED0+i*991);
    const carried=this.boat?this.boat.coins:0;
    const carriedLight=this.boat?this.boat.lightR:300;
    this.boat=new LF.Boat();
    this.boat.coins=carried;
    this.boat.lightR=carriedLight;
    this.segCoinsStart=carried;
    if(this.seg.boardDock==='right'){
      this.boat.x=this.world.len-240;
      this.boat.y=858;
    } else {
      this.boat.x=240;
      this.boat.y=858;
    }
    this.meteors.length=0;
    this.dawnT=0;
    this.endT=0;
    this.timerOn=false;
    this.showPace=false;
    this.showLanes=false;
    this.exitWisp=null;
    this.relWisp=null;
    this.boardWisp=null;
    this.state='idle';
    const V=LF.View;
    this.cam.x=this.boat.x - V.W*(this.seg.facing>0?0.38:0.62);
    this.moonP=this.segIndex/5.6;
    LF.Audio.setMood(this.seg.mood);
    LF.Audio.windLevel(this.seg.wind||0.1);
    LF.Particles.clear();
  }
  boarding(){
    this.state='board';
    this.boardT=0;
    const dockX=this.seg.boardDock==='right'?this.world.len-170:170;
    this.boardWisp={x:dockX,y:945,a:0,c:this.seg.wispColor,x0:dockX,y0:945};
  }
  startCross(){
    this.state='cross';
    this.controlOK=true;
    if(this.seg.showPace) this.showPace=true;
    if(this.seg.showLanes) this.showLanes=true;
    if(this.seg.timerMax){
      this.timer=this.seg.timerMax;
      this.timerMax=this.seg.timerMax;
      this.timerOn=true;
    }
    if(this.seg.pay!==false){
      this.boat.coins++;
      LF.Audio.coin();
    }
    LF.UI.chapter(this.seg.chapter);
    LF.UI.objective(this.seg.objective);
    this.segState.mT=LF.rand(0.4,1);
  }
  startArrive(){
    this.state='arrive';
    this.controlOK=false;
    this.arriveT=0;
    this.timerOn=false;
    this.segState.arriveFlags={};
    LF.Audio.dock();
    this.shake(3,0.3);
  }
  startSink(){
    if(this.state==='sink') return;
    this.state='sink';
    this.sinkT=0;
    this.controlOK=false;
    this.timerOn=false;
    LF.UI.cancelAll();
    LF.Audio.suck();
  }
  startRelease(){
    this.state='release';
    this.controlOK=false;
    this.releaseT=0;
    this.showLanes=false;
    this.segState.relFlags={};
    LF.Audio.setMood('dawn');
    LF.Audio.windLevel(0.08);
    LF.Audio.dock();
  }
  finishArrive(){
    this.seg.finish && this.seg.finish(this);
    const done=this.segIndex;
    LF.UI.fade(1,1.1,()=>{
      this.exitWisp=null;
      if(done<SEGS.length-1){
        this.loadSegment(done+1);
        LF.UI.fade(0,1.0);
        LF.UI.card(SEGS[done].after,{kicker:'between fares'},()=>this.boarding());
      }
    });
  }
  showStats(){
    const s=this.stats;
    const lines=[
      {text:'souls ferried — five'},
      {text:'lives begun — one'},
      {text:"the old man's pace — "+(s.pace?'kept':'quick, "a pity"')},
      {text:"the child's star — "+(s.star?'caught':'dreamed of')},
      {text:'the nightingale — '+(s.song?'heard':'quiet tonight')},
      {text:'the merchant — '+(s.deadline?'paid in full':'fashionably late')},
      {text:'the light — '+(s.lanes>=4?'sang along the whole way':'hummed '+Math.min(4,s.lanes)+' of 4 lanes')},
      {text:'toll kept — '+this.boat.coins+(s.retries?' · hull mended × '+s.retries:'')}
    ];
    const comforted=(s.pace?1:0)+(s.star?1:0)+(s.song?1:0)+(s.deadline?1:0)+(s.lanes>=4?1:0);
    lines.push({text:''});
    if(comforted>=5) lines.push({text:'The river will remember you. The dead already do.'});
    else if(comforted>=3) lines.push({text:'The dead tell stories of a kind oar tonight.'});
    else lines.push({text:'The dead forgive a tired arm. The river, even more so.'});
    LF.UI.card(lines,{kicker:'the crossing, complete'},()=>{
      this.state='end';
      const el=document.getElementById('endScreen');
      if(el) el.classList.add('show');
    });
  }
  shake(a,t){ this.shakeA=a; this.shakeT=t; }
  togglePause(){
    if(this.state!=='cross'&&this.state!=='board'&&this.state!=='arrive'&&this.state!=='release') return;
    this.pauseFlag=!this.pauseFlag;
    LF.UI.els.pauseOv.classList.toggle('show',this.pauseFlag);
  }
  pointer(){
    this.clickFlag=true;
    LF.Audio.init();
    LF.Audio.resume();
  }
  update(dt){
    LF.UI.update(dt);
    this.handleKeys();
    if(this.pauseFlag) return;
    this.time+=dt;
    this.shakeT=Math.max(0,this.shakeT-dt*2);
    for(let i=this.meteors.length-1;i>=0;i--){
      const m=this.meteors[i];
      m.x+=m.vx*dt; m.y+=m.vy*dt; m.life-=dt;
      if(m.life<=0) this.meteors.splice(i,1);
    }
    switch(this.state){
      case 'title': this.titleUpdate(dt); break;
      case 'idle': this.idleUpdate(dt); break;
      case 'board': this.boardUpdate(dt); break;
      case 'cross': this.crossUpdate(dt); break;
      case 'arrive': this.arriveUpdate(dt); break;
      case 'sink': this.sinkUpdate(dt); break;
      case 'release': this.releaseUpdate(dt); break;
      case 'end': this.endUpdate(dt); break;
    }
  }
  handleKeys(){
    const I=LF.Input, U=LF.UI;
    if(I.justPressed('KeyM')){
      const m=LF.Audio.toggle();
      U.toast(m?'sound muted':'sound restored');
    }
    if(I.justPressed('Escape')){
      this.togglePause();
      return;
    }
    const click=this.clickFlag;
    this.clickFlag=false;
    if(I.justPressed('Space','Enter')||click){
      if(this.state==='title'&&!U.blocking()){ this.begin(); return; }
      if(this.state==='end'&&!U.blocking()){
        try{ window.location.reload(); }catch(e){}
        return;
      }
      if(U.blocking()){ U.advance(); return; }
    }
  }
  idleUpdate(dt){
    this.boat.update(dt,{row:0,steer:0},this.world,this);
    this.world.update(dt,this);
    this.updateCam(dt);
  }
  titleUpdate(dt){
    this.world.update(dt,this);
    if(LF.chance(dt*1.6)) LF.Particles.ripple(this.boat.x+LF.rand(-60,60),this.boat.y+LF.rand(-30,30),8,0.14,2.2);
    if(LF.chance(dt*2)) LF.Particles.spark(LF.rand(this.cam.x+100,this.cam.x+LF.View.W-100),LF.rand(120,900),'#ffd97a',1,10);
  }
  boardUpdate(dt){
    this.boardT+=dt;
    const bw=this.boardWisp;
    if(bw){
      const k=LF.smoothstep(Math.min(1,this.boardT/1.8));
      bw.x=LF.lerp(bw.x0,this.boat.x+24*this.seg.facing,k);
      bw.y=LF.lerp(bw.y0,this.boat.y-6,k);
      bw.a=Math.min(1,this.boardT/0.5);
      if(this.boardT>1.8){
        this.boardWisp=null;
        this.boat.wisp=this.seg.wispColor;
        const wasRetry=this.retryMode;
        this.retryMode=false;
        if(wasRetry){
          LF.UI.dialogue(RETRY_DLG,()=>this.startCross());
        } else {
          LF.UI.dialogue(this.seg.board(this),()=>this.startCross());
        }
      }
    }
    this.boat.update(dt,{row:0,steer:0},this.world,this);
    this.world.update(dt,this);
    this.updateCam(dt);
  }
  crossUpdate(dt){
    let ctl={row:0,steer:0};
    if(LF.SMOKE){
      ctl=this.pilot();
    } else {
      ctl={row:LF.Input.rowAxis(), steer:LF.Input.turnAxis()};
    }
    this.boat.update(dt,ctl,this.world,this);
    const ev=this.world.collide(this.boat,this,dt);
    for(const e of ev) this.processEvent(e);
    if(this.boat.hull>=3){ this.startSink(); return; }
    this.world.update(dt,this);
    if(this.timerOn){
      this.timer-=dt;
      if(this.timer<0) this.timer=0;
    }
    const p=this.crossP();
    if(this.seg.facing>0){
      this.moonP=(this.segIndex+p)/5.6;
    } else {
      this.moonP=LF.clamp((this.segIndex+p)/5.6,0,1);
      this.dawnT=LF.smoothstep(LF.clamp(p*1.08,0,1));
    }
    if(this.seg.key==='child' && p>0.06 && p<0.93){
      const st=this.segState;
      st.mT-=dt;
      if(st.mT<=0){
        st.mT=LF.rand(0.7,1.9);
        const V=LF.View;
        const life=LF.rand(0.7,1.2);
        this.meteors.push({x:LF.rand(V.W*0.3,V.W*0.95),y:LF.rand(6,V.skyH*0.5),vx:LF.rand(-620,-420),vy:LF.rand(130,240),life,max:life});
        if(LF.chance(0.4)) LF.Audio.whoosh();
      }
    }
    this.seg.tick && this.seg.tick(this,dt,p);
    if(this.boat.wisp && LF.chance(dt*7)){
      LF.Particles.spark(this.boat.x+30*this.seg.facing,this.boat.y-4,this.boat.wisp,1,26);
    }
    this.updateCam(dt);
    if(this.seg.facing>0){
      if(this.boat.x>this.world.len-300) this.startArrive();
    } else {
      if(this.boat.x<300) this.startRelease();
    }
  }
  processEvent(e){
    if(e.t==='damage'){
      LF.Audio.crack();
      LF.UI.flash();
      this.shake(11,0.55);
      LF.Particles.drops(this.boat.x,this.boat.y,12,1.3);
      LF.Particles.spark(this.boat.x,this.boat.y,'#ffb457',5,70);
      const n=Math.min(2,this.boat.coins);
      this.boat.coins-=n;
      for(let k=0;k<n;k++){
        this.world.coins.push({x:this.boat.x+LF.rand(-70,90),y:LF.clamp(this.boat.y+LF.rand(-60,60),100,900),bob:LF.rand(0,9),sink:16});
      }
      if(this.seg.firstHit && !this.segState.flags.hit && this.state==='cross'){
        this.segState.flags.hit=true;
        LF.UI.dialogue([this.seg.firstHit]);
      }
    } else if(e.t==='thud'){
      LF.Audio.thud();
      this.shake(4,0.25);
      LF.Particles.drops(this.boat.x,this.boat.y,5,0.8);
    } else if(e.t==='reed'){
      LF.Audio.rustle();
    } else if(e.t==='swirl'){
      LF.Audio.suck();
      this.shake(9,0.6);
      if(this.boat.coins>0){
        this.boat.coins--;
        this.world.coins.push({x:this.boat.x+LF.rand(-60,60),y:LF.clamp(this.boat.y+LF.rand(-60,60),100,900),bob:LF.rand(0,9),sink:16});
      }
      if(this.seg.swirlLine && !this.segState.flags.swirl){
        this.segState.flags.swirl=true;
        LF.UI.dialogue([this.seg.swirlLine]);
      }
    } else if(e.t==='coin'){
      LF.Audio.coin();
      LF.Particles.spark(e.x,e.y,'#ffd97a',6,60);
    }
  }
  arriveUpdate(dt){
    this.arriveT+=dt;
    const tx=this.world.rightDock-70;
    this.boat.x+=(tx-this.boat.x)*Math.min(1,1.4*dt);
    this.boat.y+=(870-this.boat.y)*Math.min(1,1.4*dt);
    this.boat.vx*=1-2*dt;
    this.boat.vy*=1-2*dt;
    const st=this.segState;
    if(this.arriveT>0.8 && !st.flags.exit){
      st.flags.exit=true;
      this.boat.wisp=null;
      this.exitWisp={x:this.boat.x+26,y:this.boat.y,a:1,c:this.seg.wispColor};
    }
    if(this.exitWisp){
      this.exitWisp.x+=60*dt;
      this.exitWisp.y+=80*dt;
      this.exitWisp.a=Math.max(0,1-Math.max(0,this.arriveT-2.6)*0.55);
    }
    if(this.arriveT>1.15 && !st.flags.dlg){
      st.flags.dlg=true;
      LF.UI.dialogue(this.seg.arrive(this),()=>this.finishArrive());
    }
    this.world.update(dt,this);
    this.updateCam(dt);
  }
  sinkUpdate(dt){
    this.sinkT+=dt;
    this.boat.sink=this.sinkT/1.8;
    this.boat.vx*=1-3*dt;
    this.boat.vy*=1-3*dt;
    if(LF.chance(dt*6)) LF.Particles.bubble(this.boat.x+LF.rand(-40,40),this.boat.y);
    this.world.update(dt,this);
    if(this.sinkT>1.9 && !this.segState.flags.sunk){
      this.segState.flags.sunk=true;
      LF.UI.fade(1,1.0,()=>{
        this.stats.retries++;
        const coins=this.segCoinsStart;
        this.loadSegment(this.segIndex);
        this.boat.coins=coins;
        this.segCoinsStart=coins;
        LF.UI.fade(0,0.9);
        this.retryMode=true;
        LF.UI.card(RETRY_CARD,{kicker:''},()=>this.boarding());
      });
    }
  }
  releaseUpdate(dt){
    this.releaseT+=dt;
    const st=this.segState;
    this.boat.x+=(240-this.boat.x)*Math.min(1,1.2*dt);
    this.boat.y+=(880-this.boat.y)*Math.min(1,1.2*dt);
    this.boat.vx*=1-2*dt;
    this.boat.vy*=1-2*dt;
    this.endT=LF.clamp((this.releaseT-2.2)/5,0,1);
    if(this.releaseT>1.6 && !st.relFlags.exit){
      st.relFlags.exit=true;
      this.boat.wisp=null;
      this.relWisp={x:this.boat.x+26,y:this.boat.y};
      this.exitWisp={x:this.relWisp.x,y:this.relWisp.y,a:1,c:this.seg.wispColor};
    }
    if(this.relWisp){
      if(this.releaseT<3.4){
        this.relWisp.x+=(150-this.relWisp.x)*Math.min(1,1.3*dt);
        this.relWisp.y+=(950-this.relWisp.y)*Math.min(1,1.3*dt);
      } else if(!st.relFlags.ascend){
        st.relFlags.ascend=true;
        LF.Audio.lark();
        LF.Particles.burst(this.relWisp.x,this.relWisp.y,'#fff4d0');
      } else {
        this.relWisp.y-=dt*(90+this.releaseT*50);
        this.relWisp.x-=dt*30;
        if(LF.chance(dt*10)) LF.Particles.spark(this.relWisp.x,this.relWisp.y,'#fff4d0',1,30);
        if(!st.relFlags.bell && this.relWisp.y<-520){
          st.relFlags.bell=true;
          LF.Audio.bells();
        }
      }
      this.exitWisp.x=this.relWisp.x;
      this.exitWisp.y=this.relWisp.y;
    }
    if(this.releaseT>8.8 && !st.relFlags.poem){
      st.relFlags.poem=true;
      LF.Audio.setMood('end');
      LF.UI.card(EPILOGUE,{kicker:'the epilogue'},()=>this.showStats());
    }
    this.world.update(dt,this);
    this.updateCam(dt);
  }
  endUpdate(dt){
    this.endT=Math.min(1,this.endT+dt*0.05);
    this.world.update(dt,this);
  }
  updateCam(dt){
    const V=LF.View;
    const tx=this.boat.x - V.W*(this.seg.facing>0?0.38:0.62);
    this.cam.x+=(tx-this.cam.x)*Math.min(1,3.2*dt);
  }
  pilot(){
    const b=this.boat, w=this.world, seg=this.seg;
    let row=1, steer=0;
    let ty=500;
    if(seg.key==='oldman'){
      row=(Math.sin(this.time*3.1)>0)?1:0;
      ty=520;
    } else if(seg.key==='child' && w.star && !w.star.caught){
      ty=w.star.y;
    } else if(seg.key==='reeds'){
      if(w.tree && b.x>w.tree.x-480 && !w.tree.sang){
        if(b.x<w.tree.x-330) row=0.5;
        else row = b.speed>46 ? -1 : 0;
        ty=w.tree.y+150;
      } else if(w.tree && w.tree.sang && !this.segState.flags.thanks){
        row=0;
        ty=w.tree.y+150;
      } else {
        const gates=w.gates.filter(g=>g.x>b.x+60).sort((a,c)=>a.x-c.x);
        if(gates[0]){
          const gap=gates[0].gaps[0];
          ty=(gap.y0+gap.y1)/2;
        } else {
          ty=500;
        }
      }
    } else if(seg.key==='light'){
      const lanes=w.lanes.filter(l=>l.x1<b.x-40).sort((a,c)=>c.x0-a.x0);
      if(lanes[0]) ty=(lanes[0].y0+lanes[0].y1)/2;
      for(const wl of w.whirls){
        if(Math.abs(wl.x-b.x)<340 && LF.dist(b.x,b.y,wl.x,wl.y)<wl.R+150){
          ty=b.y<wl.y?wl.y-320:wl.y+320;
          break;
        }
      }
    }
    let tyRock=null;
    const starCatch = seg.key==='child' && w.star && !w.star.caught && Math.abs(w.star.x-b.x)<320;
    for(const r of w.rocks){
      if(r.tree) continue;
      const dx=(r.x-b.x)*seg.facing;
      if(dx>-40 && dx<340 && Math.abs(r.y-b.y)<r.r+60){
        tyRock=b.y<r.y?r.y-r.r-130:r.y+r.r+130;
        break;
      }
    }
    if(tyRock!==null && !starCatch) ty=tyRock;
    ty=LF.clamp(ty,140,860);
    steer=b.y<ty-14?1:(b.y>ty+14?-1:0);
    return {row,steer};
  }
}
LF.GameClass=GameClass;
LF.SEGS=SEGS;
})();
