'use strict';
(function(){
const LF = window.LF;

LF.Boat = class {
  constructor(){
    this.x=240; this.y=860;
    this.vx=0; this.vy=0;
    this.tilt=0; this.tiltVis=0;
    this.rowAnim=0; this.strokeT=0; this.rowSide=0;
    this.hull=0; this.inv=0; this.spinT=0;
    this.coins=0; this.lightR=300;
    this.thudT=0; this.wakeT=0; this.wisp=null; this.wispBob=0;
    this.sink=0; this.inReed=false; this.lane=null;
  }
  get speed(){ return Math.hypot(this.vx,this.vy); }
  update(dt, ctl, world, game){
    const facing = game.seg.facing;
    const dir = facing;
    const row = ctl.row|0, steer = ctl.steer|0;
    this.inv = Math.max(0, this.inv-dt);
    this.thudT = Math.max(0, this.thudT-dt);
    this.wispBob += dt;
    if(this.spinT>0){ this.spinT -= dt; }
    const locked = this.spinT>0;
    const r = locked?0:row;
    const s = locked?0:steer;
    if(r>0){
      this.vx += dir*430*dt;
      const cap=370;
      if(this.vx*dir>cap) this.vx=cap*dir;
      this.rowAnim += dt/0.62;
      if(this.rowAnim>=1){
        this.rowAnim-=1; this.rowSide^=1;
        const ox=this.x-dir*36, oy=this.y+(this.rowSide?14:-14);
        LF.Particles.ripple(ox,oy,9,0.28);
        LF.Particles.drops(ox,oy,4,0.7);
        LF.Audio.splash(0.8);
      }
    } else {
      this.rowAnim=0;
      this.vx *= (1-1.0*dt);
    }
    if(r<0){
      this.vx *= (1-3.4*dt);
      if(Math.abs(this.vx)<70) this.vx += dir*-46*dt;
    }
    const targetTilt = s===0?0:(s>0?0.6:-0.6);
    this.tilt += (targetTilt-this.tilt)*Math.min(1,7*dt);
    if(!locked){
      if(s!==0){
        this.vy += s*300*dt;
        if(this.vy>235) this.vy=235;
        if(this.vy<-235) this.vy=-235;
      } else {
        this.vy *= (1-3.2*dt);
      }
    } else {
      this.vx *= (1-2.2*dt);
      this.vy *= (1-2.2*dt);
    }
    const cur = world.currentAt(this);
    this.x += (this.vx+cur)*dt;
    this.y += this.vy*dt;
    if(this.y<48){ this.y=48; if(this.vy<0) this.vy*=-0.25; }
    if(this.y>952){ this.y=952; if(this.vy>0) this.vy*=-0.25; }
    if(this.speed>36){
      this.wakeT-=dt;
      if(this.wakeT<=0){
        this.wakeT=0.3;
        LF.Particles.ripple(this.x-dir*44, this.y+LF.rand(-6,6), 7, 0.16, 1.1);
      }
    }
    this.tiltVis += (this.tilt*dir - this.tiltVis)*Math.min(1,8*dt);
  }
};

LF.World = class {
  constructor(def, seed){
    this.def=def;
    this.len=def.len;
    this.current=def.current||0;
    this.rocks=[];
    this.reedWalls=[];
    this.gates=[];
    this.whirls=[];
    this.lanes=[];
    this.coins=[];
    this.fields=[];
    this.star=null;
    this.tree=null;
    this.leftDock=170;
    this.rightDock=def.len-170;
    def.build && def.build(this, LF.mulberry32(seed));
  }
  addFireflies(x0,x1,y0,y1,n,glow){
    const flies=[];
    for(let i=0;i<n;i++) flies.push({x:LF.rand(x0,x1),y:LF.rand(y0,y1),ph:LF.rand(0,LF.TAU),vx:0,vy:0});
    this.fields.push({x0,x1,y0,y1,glow,flies});
  }
  scatterRocks(rng,count,x0,x1,y0=120,y1=880,rmin=26,rmax=58){
    for(let i=0;i<count;i++){
      const x=LF.lerp(x0,x1,rng());
      const y=LF.lerp(y0,y1,rng());
      const r=LF.lerp(rmin,rmax,rng());
      if(this.rocks.some(o=>LF.dist(o.x,o.y,x,y)<o.r+r+120)) continue;
      this.rocks.push({x,y,r,seed:rng()*9});
    }
  }
  rockRows(rng,x0,x1){
    let x=x0;
    while(x<x1){
      const gy=LF.lerp(180,760,rng());
      const gh=LF.lerp(280,400,rng());
      const count=1+rng()*3|0;
      for(let i=0;i<count;i++){
        const side=rng()<0.5?-1:1;
        let ry = side<0 ? LF.rand(90,Math.max(120,gy-gh/2-60)) : LF.rand(Math.min(870,gy+gh/2+60),900);
        ry = LF.clamp(ry,90,900);
        const r=LF.lerp(28,62,rng());
        this.rocks.push({x:x+LF.rand(-70,70),y:ry,r,seed:rng()*9});
      }
      x += LF.lerp(330,470,rng());
    }
  }
  buildMaze(rng,x0,x1){
    let x=x0, gy=500;
    while(x<x1){
      const gh=LF.lerp(230,300,rng());
      gy = LF.clamp(gy+LF.rand(-260,260), 170, 820-gh);
      const gate={x, gaps:[{y0:gy, y1:gy+gh}], fireflies:true};
      if(rng()<0.4){
        const gh2=LF.lerp(200,260,rng());
        let gy2 = LF.clamp(gy + (rng()<0.5?-1:1)*LF.rand(300,440), 150, 800-gh2);
        if(gy2 > gy+gh+60 || gy2+gh2+60 < gy){
          gate.gaps.push({y0:gy2,y1:gy2+gh2});
        }
      }
      this.gates.push(gate);
      const edges=[0];
      for(const g of gate.gaps){ edges.push(g.y0,g.y1); }
      edges.push(1000);
      for(let i=0;i<edges.length;i+=2){
        if(edges[i+1]-edges[i]>40){
          this.reedWalls.push({x0:x-52,x1:x+52,y0:edges[i],y1:edges[i+1]});
        }
      }
      for(const g of gate.gaps){
        this.addFireflies(gate.x-120,gate.x+120,g.y0-40,g.y1+40,7,1);
      }
      x += LF.lerp(520,680,rng());
    }
  }
  currentAt(boat){
    let cur=this.current;
    if(this.lanes.length && boat.lane) cur=this.current*0.18;
    return cur;
  }
  update(dt,game){
    for(const f of this.fields){
      for(const fl of f.flies){
        fl.ph+=dt*LF.rand(1.2,2.6);
        fl.vx+=LF.rand(-30,30)*dt; fl.vy+=LF.rand(-30,30)*dt;
        fl.vx*=1-1.2*dt; fl.vy*=1-1.2*dt;
        fl.x+=fl.vx*dt; fl.y+=fl.vy*dt;
        if(fl.x<f.x0) fl.vx+=40*dt; if(fl.x>f.x1) fl.vx-=40*dt;
        if(fl.y<f.y0) fl.vy+=40*dt; if(fl.y>f.y1) fl.vy-=40*dt;
      }
    }
    for(const c of this.coins){
      c.bob+=dt;
    }
    for(const w of this.whirls){
      w.ph+=dt*1.6;
      w.cool=Math.max(0,w.cool-dt);
    }
    for(const l of this.lanes) l.cool=Math.max(0,(l.cool||0)-dt);
    for(const c of this.coins){
      if(c.gone) continue;
      if(c.sink>0){ c.sink-=dt; if(c.sink<=0) c.gone=true; }
      if(c.sink>0 && c.sink<4) c.y+=12*dt;
    }
    if(this.star && !this.star.caught){
      this.star.ph+=dt*1.4;
      this.star.x+=this.star.vx*dt;
      this.star.y=this.star.baseY+Math.sin(this.star.ph)*70;
      if(LF.chance(0.12)) LF.Particles.spark(this.star.x,this.star.y,'#bfe8ff',1,24);
    }
    if(game.seg.rapids && game.state==='cross' && LF.chance(dt*2.4)){
      LF.Particles.streak(game.cam.x+LF.rand(-200,500), LF.rand(140,880));
    }
    if(game.seg.key==='reeds' && game.state==='cross'){
      if(this.tree && this.tree.sang && LF.chance(dt*2)){
        LF.Particles.petal(this.tree.x+LF.rand(-70,70), this.tree.y-LF.rand(40,90));
      }
    }
  }
  collide(boat, game, dt){
    const ev=[];
    const facing=game.seg.facing;
    const dir=facing;
    boat.inReed=false;
    boat.lane=null;
    for(const r of this.rocks){
      if(Math.abs(r.x-boat.x)>r.r+120) continue;
      for(const off of [-36,0,36]){
        const bx=boat.x+off*dir, by=boat.y;
        const d=LF.dist(bx,by,r.x,r.y);
        const rr=r.r+24;
        if(d<rr){
          const nx=(bx-r.x)/(d||0.001), ny=(by-r.y)/(d||0.001);
          boat.x=r.x+nx*rr-off*dir;
          boat.y=LF.clamp(r.y+ny*rr,48,952);
          const vn=boat.vx*nx+boat.vy*ny;
          if(vn<0){
            boat.vx-=nx*vn*1.55;
            boat.vy-=ny*vn*1.55;
          }
          if(boat.inv<=0){
            if(Math.abs(vn)>160 && !LF.SMOKE){
              boat.hull++; boat.inv=1.4;
              ev.push({t:'damage',x:r.x,y:r.y});
            } else if(Math.abs(vn)>60 && boat.thudT<=0){
              boat.thudT=0.4;
              ev.push({t:'thud',x:r.x,y:r.y});
            }
          }
          break;
        }
      }
    }
    for(const w of this.reedWalls){
      if(boat.x>w.x0-22 && boat.x<w.x1+22 && boat.y>w.y0-14 && boat.y<w.y1+14){
        boat.inReed=true;
        boat.vx*=(1-4.5*dt);
        boat.vy*=(1-4.5*dt);
        const dTop=Math.abs(boat.y-w.y0), dBot=Math.abs(boat.y-w.y1);
        const pushY = dTop<dBot ? w.y0-16 : w.y1+16;
        boat.y += (pushY-boat.y)*Math.min(1,10*dt);
        if(boat.thudT<=0){
          boat.thudT=0.5;
          ev.push({t:'reed'});
        }
      }
    }
    for(const w of this.whirls){
      const d=LF.dist(boat.x,boat.y,w.x,w.y);
      if(d<w.R){
        const k=1-d/w.R;
        const nx=(w.x-boat.x)/(d||0.001), ny=(w.y-boat.y)/(d||0.001);
        boat.x += nx*k*k*260*dt;
        boat.y += ny*k*k*260*dt;
        boat.vx += -ny*k*140*dt;
        boat.vy += nx*k*140*dt;
        if(d<w.R*0.24 && w.cool<=0 && boat.spinT<=0 && !LF.SMOKE){
          w.cool=9;
          boat.spinT=1.15;
          boat.vx=dir*40;
          ev.push({t:'swirl',x:w.x,y:w.y});
        }
      }
    }
    for(const l of this.lanes){
      if(boat.x>l.x0 && boat.x<l.x1 && boat.y>l.y0 && boat.y<l.y1){
        boat.lane=l;
        break;
      }
    }
    for(const c of this.coins){
      if(c.taken||c.gone) continue;
      if(LF.dist2(boat.x,boat.y,c.x,c.y)<3600){
        c.taken=true;
        boat.coins++;
        ev.push({t:'coin',x:c.x,y:c.y});
      }
    }
    return ev;
  }
};
})();
