'use strict';
(function(){
const LF = window.LF;

const View = {
  W:1280, H:800, dpr:1, skyH:240, bandT:270, bandB:740, fgT:720,
  update(canvas){
    const w = Math.max(320, window.innerWidth);
    const h = Math.max(240, window.innerHeight);
    this.W=w; this.H=h;
    const dpr = Math.min(window.devicePixelRatio||1, 1.75);
    this.dpr=dpr;
    canvas.width = Math.round(w*dpr);
    canvas.height = Math.round(h*dpr);
    canvas.style.width = w+'px';
    canvas.style.height = h+'px';
    this.skyH = h*0.30;
    this.bandT = h*0.345;
    this.bandB = h*0.925;
    this.fgT = h*0.895;
  },
  proj(y){ return this.bandT + (y/1000)*(this.bandB-this.bandT); }
};

const PAL = {
  night:    {sky0:'#0a0e2e',sky1:'#27406b',wat0:'#12283f',wat1:'#04070f',hillA:'#131c3e',hillB:'#0a1128',moon:'#f2ead6',star:1,glow:'#ffb457',glitter:'#cfe3ff'},
  wonder:   {sky0:'#0c0a2c',sky1:'#3a3164',wat0:'#1a2050',wat1:'#070b1e',hillA:'#161a46',hillB:'#0c1030',moon:'#f6efdd',star:1,glow:'#9fe8dc',glitter:'#bfe8ff'},
  reeds:    {sky0:'#04090b',sky1:'#122c22',wat0:'#0b1c22',wat1:'#020607',hillA:'#0a1a14',hillB:'#050c09',moon:'#e9e2c8',star:0.4,glow:'#ffd27a',glitter:'#e8d8a0'},
  rapids:   {sky0:'#0d131f',sky1:'#2b3a52',wat0:'#14243a',wat1:'#05080f',hillA:'#0f1828',hillB:'#0a101c',moon:'#e8e4d0',star:0.25,glow:'#c9d8ec',glitter:'#d5e4f4'},
  predawn:  {sky0:'#11142e',sky1:'#3c3050',wat0:'#141d3a',wat1:'#05070f',hillA:'#141536',hillB:'#0b0c22',moon:'#f0e6d0',star:0.5,glow:'#ffc07a',glitter:'#e8d0a8'},
  dawn:     {sky0:'#2a2a58',sky1:'#e09a5a',wat0:'#3c3050',wat1:'#0a0c18',hillA:'#241a3a',hillB:'#120e26',moon:'#f6ecd2',star:0,glow:'#ffd27a',glitter:'#ffca80'},
  sunrise:  {sky0:'#5b4a7a',sky1:'#ffd9a0',wat0:'#7a5060',wat1:'#141c2e',hillA:'#3a2c4e',hillB:'#1c1430',moon:'#fff4dc',star:0,glow:'#ffdf9a',glitter:'#ffe9b8'}
};
const COLOR_KEYS = ['sky0','sky1','wat0','wat1','hillA','hillB','moon','glow','glitter'];
function mixPal(a,b,t){
  if(t<=0.001) return a;
  if(t>=0.999) return b;
  const o={};
  for(const k of COLOR_KEYS) o[k]=LF.mix(a[k],b[k],t);
  o.star=LF.lerp(a.star,b.star,t);
  return o;
}

const shoreN = new LF.Noise1(7);
const rockN = new LF.Noise1(11);
const fgN = new LF.Noise1(13);
const STARS=[]; for(let i=0;i<140;i++) STARS.push({x:Math.random(),y:Math.random()*0.92,tw:LF.rand(0.5,2.4),s:LF.rand(0.6,1.8)});
const CLOUDS=[]; for(let i=0;i<6;i++) CLOUDS.push({x:Math.random()*1.6,y:LF.rand(0.05,0.55),w:LF.rand(180,420),h:LF.rand(16,40),a:LF.rand(0.05,0.14),sp:LF.rand(2,7)});
const FLOW=[]; for(let i=0;i<110;i++) FLOW.push({x:LF.rand(0,2400),yf:Math.random(),len:LF.rand(24,90),a:LF.rand(0.03,0.10)});
const GL=[]; for(let i=0;i<42;i++) GL.push({dx:LF.rand(6,34),ph:LF.rand(0,LF.TAU),w:LF.rand(1,3)});

let bloomCv=null, bctx=null;

const R = {
  View, PAL,
  paletteFor(game){
    const seg=game.seg;
    let pal = PAL[seg.palette] || PAL.night;
    if(seg.key==='light'){
      pal = mixPal(PAL.predawn, PAL.dawn, LF.clamp(game.dawnT,0,1));
    }
    if(game.state==='release' || game.state==='end'){
      pal = mixPal(PAL.dawn, PAL.sunrise, LF.clamp(game.endT,0,1));
    }
    return pal;
  },
  draw(game){
    const ctx=LF.ctx;
    const V=View, W=V.W, H=V.H;
    ctx.setTransform(V.dpr,0,0,V.dpr,0,0);
    ctx.clearRect(0,0,W,H);
    const pal=this.paletteFor(game);
    const cam=game.cam.x;
    const t=game.time;
    let shx=0, shy=0;
    if(game.shakeT>0){
      const k=game.shakeT*game.shakeA;
      shx=LF.rand(-1,1)*k; shy=LF.rand(-1,1)*k;
    }
    ctx.save();
    ctx.translate(shx,shy);
    this.sky(ctx,pal,game,cam,t,W,H,V);
    this.farShore(ctx,pal,game,cam,W,H,V);
    this.water(ctx,pal,game,cam,t,W,H,V);
    LF.Particles.drawUnder(ctx,cam,(y)=>V.proj(y));
    this.boatLayer(ctx,pal,game,cam,t,W,H,V);
    LF.Particles.drawOver(ctx,cam,(y)=>V.proj(y));
    this.fireflies(ctx,game,cam,t,V);
    this.foreground(ctx,pal,game,cam,t,W,H,V);
    ctx.restore();
    if(game.state!=='title') this.hud(ctx,game,W,H,V);
    this.bloom(ctx,W,H);
  },
  sky(ctx,pal,game,cam,t,W,H,V){
    const skyH=V.skyH;
    const g=ctx.createLinearGradient(0,0,0,skyH);
    g.addColorStop(0,pal.sky0);
    g.addColorStop(1,pal.sky1);
    ctx.fillStyle=g;
    ctx.fillRect(0,0,W,skyH+1);
    const dawnT=Math.max(game.state==='release'||game.state==='end'?game.endT*0.6:0, game.dawnT||0);
    const starA=LF.clamp(pal.star*(1-dawnT*1.4),0,1);
    if(starA>0.02){
      for(const s of STARS){
        let x=(s.x*W*1.5 - cam*0.05)%(W*1.5);
        if(x<0) x+=W*1.5;
        if(x>W) continue;
        const y=s.y*skyH;
        const a=(0.35+0.65*Math.abs(Math.sin(t*s.tw+s.x*40)))*starA;
        ctx.fillStyle='rgba(220,230,255,'+a.toFixed(3)+')';
        ctx.fillRect(x,y,s.s,s.s);
      }
    }
    if(game.state==='cross' && game.meteors.length){
      ctx.save();
      ctx.globalCompositeOperation='lighter';
      for(const m of game.meteors){
        const k=LF.clamp(m.life/m.max,0,1);
        const grad=ctx.createLinearGradient(m.x,m.y,m.x-m.vx*0.14,m.y-m.vy*0.14);
        grad.addColorStop(0,'rgba(230,250,255,'+(0.9*k)+')');
        grad.addColorStop(1,'rgba(150,220,255,0)');
        ctx.strokeStyle=grad;
        ctx.lineWidth=2.2;
        ctx.beginPath();
        ctx.moveTo(m.x,m.y);
        ctx.lineTo(m.x-m.vx*0.14,m.y-m.vy*0.14);
        ctx.stroke();
        ctx.fillStyle='rgba(255,255,255,'+(0.9*k)+')';
        ctx.beginPath(); ctx.arc(m.x,m.y,1.8,0,LF.TAU); ctx.fill();
      }
      ctx.restore();
    }
    for(const c of CLOUDS){
      let x=(c.x*W - cam*0.08 - t*c.sp);
      x=((x%(W+420))+ (W+420))%(W+420)-210;
      const y=c.y*skyH;
      ctx.fillStyle='rgba(30,40,70,'+c.a+')';
      ctx.beginPath();
      ctx.ellipse(x,y,c.w*0.5,c.h*0.5,0,0,LF.TAU);
      ctx.ellipse(x+c.w*0.3,y+c.h*0.1,c.w*0.3,c.h*0.4,0,0,LF.TAU);
      ctx.fill();
    }
    const mp=game.moonP;
    const moonA=LF.clamp(1-Math.max(game.dawnT||0,game.endT*0.9),0,1);
    if(moonA>0.02){
      const mx=W*LF.lerp(0.76,0.16,mp);
      let my=skyH*0.80 - Math.sin(mp*Math.PI)*skyH*0.52;
      my += (game.dawnT||0)*skyH*0.9;
      const mr=Math.max(14,skyH*0.13);
      const halo=ctx.createRadialGradient(mx,my,mr*0.4,mx,my,mr*4.2);
      halo.addColorStop(0,LF.rgba(pal.moon,0.22*moonA));
      halo.addColorStop(1,LF.rgba(pal.moon,0));
      ctx.fillStyle=halo;
      ctx.fillRect(mx-mr*4.2,my-mr*4.2,mr*8.4,mr*8.4);
      ctx.fillStyle=LF.rgba(pal.moon,0.95*moonA);
      ctx.beginPath(); ctx.arc(mx,my,mr,0,LF.TAU); ctx.fill();
      ctx.fillStyle=LF.rgba(pal.sky0,0.25*moonA);
      ctx.beginPath(); ctx.arc(mx-mr*0.32,my-mr*0.18,mr*0.9,0,LF.TAU); ctx.fill();
    }
    const dawn=Math.max(game.dawnT||0, game.state==='release'||game.state==='end'?game.endT:0);
    if(dawn>0.01){
      const sunX=W*0.12;
      const dg=ctx.createRadialGradient(sunX,skyH,10,sunX,skyH,W*0.55);
      dg.addColorStop(0,'rgba(255,214,140,'+(0.5*dawn)+')');
      dg.addColorStop(0.4,'rgba(240,160,90,'+(0.22*dawn)+')');
      dg.addColorStop(1,'rgba(240,160,90,0)');
      ctx.fillStyle=dg;
      ctx.fillRect(sunX-W*0.55,0,W*1.1,skyH+1);
      if(game.endT>0.15){
        const sy=skyH - LF.clamp(game.endT-0.15,0,1)*skyH*0.55;
        ctx.fillStyle='rgba(255,244,220,'+(0.9*game.endT)+')';
        ctx.beginPath(); ctx.arc(sunX,sy,skyH*0.11,0,LF.TAU); ctx.fill();
        const rg=ctx.createRadialGradient(sunX,sy,2,sunX,sy,skyH*0.5);
        rg.addColorStop(0,'rgba(255,240,200,'+(0.55*game.endT)+')');
        rg.addColorStop(1,'rgba(255,240,200,0)');
        ctx.fillStyle=rg;
        ctx.fillRect(sunX-skyH*0.5,sy-skyH*0.5,skyH,skyH);
      }
    }
  },
  farShore(ctx,pal,game,cam,W,H,V){
    const skyH=V.skyH, bandT=V.bandT;
    const ridge=(wx,base,amp,off)=> base - LF.fbm(shoreN,wx*0.0016+off,3)*amp;
    for(const L of [{p:0.06,base:skyH*0.94,amp:skyH*0.34,off:0,c:pal.hillA,a:0.85},{p:0.13,base:skyH*1.0,amp:skyH*0.24,off:40,c:pal.hillB,a:0.95}]){
      ctx.fillStyle=LF.rgba(L.c,L.a);
      ctx.beginPath();
      ctx.moveTo(0,bandT);
      for(let x=0;x<=W;x+=18){
        const wx=cam*L.p+x;
        ctx.lineTo(x, ridge(wx,L.base,L.amp,L.off));
      }
      ctx.lineTo(W,bandT);
      ctx.closePath();
      ctx.fill();
    }
    {
      const sx=170-cam*0.13;
      if(sx>-80 && sx<W+80){
        for(let k=0;k<5;k++){
          const lx=sx+k*15+((k*17)%9);
          const ly=skyH*1.02 - ((k*37)%3)*4;
          const flick=0.6+0.4*Math.sin(game.time*2.2+k*1.7);
          ctx.fillStyle='rgba(255,196,120,'+(0.75*flick)+')';
          ctx.fillRect(lx,ly,2,2.6);
        }
      }
    }
    if(game.seg.landmark==='gate'){
      const sx=game.world.len+140-cam;
      if(sx>-160 && sx<W+160){
        ctx.fillStyle='rgba(3,5,12,0.96)';
        const gw=Math.max(46,skyH*0.24), gh=skyH*0.62;
        ctx.fillRect(sx-gw,bandT-gh,gw*0.28,gh);
        ctx.fillRect(sx+gw*0.72,bandT-gh,gw*0.28,gh);
        ctx.fillRect(sx-gw,bandT-gh,gw*2,gh*0.18);
        const gg=ctx.createRadialGradient(sx,bandT-gh*0.5,4,sx,bandT-gh*0.5,gw*2.4);
        gg.addColorStop(0,'rgba(120,150,255,0.10)');
        gg.addColorStop(1,'rgba(120,150,255,0)');
        ctx.fillStyle=gg;
        ctx.fillRect(sx-gw*2.4,bandT-gh-gw*2.4,gw*4.8,gh+gw*4.8);
      }
    }
  },
  water(ctx,pal,game,cam,t,W,H,V){
    const bandT=V.bandT, bandB=V.bandB;
    const g=ctx.createLinearGradient(0,bandT,0,H);
    g.addColorStop(0,pal.wat0);
    g.addColorStop(1,pal.wat1);
    ctx.fillStyle=g;
    ctx.fillRect(0,bandT-1,W,H-bandT+1);
    ctx.fillStyle='rgba(255,255,255,0.05)';
    ctx.fillRect(0,bandT-1,W,1.4);
    for(const f of FLOW){
      let x=(f.x - cam*0.5)%2400;
      if(x<0) x+=2400;
      x-=120;
      if(x>W+100) continue;
      const y=bandT+f.yf*(bandB-bandT);
      const a=f.a*(0.6+0.4*Math.sin(t*1.2+f.x));
      ctx.fillStyle=LF.rgba(pal.glitter,a);
      ctx.fillRect(x,y,f.len,1);
    }
    const moonA=LF.clamp(1-Math.max(game.dawnT||0,game.endT*0.9),0,1);
    if(moonA>0.05){
      const mx=W*LF.lerp(0.76,0.16,game.moonP);
      for(let k=0;k<GL.length;k++){
        const gl=GL[k];
        const y=bandT+8+k*((bandB-bandT)/46);
        const x=mx+Math.sin(t*0.8+gl.ph)*gl.dx*0.4 + Math.sin(k*1.3)*4;
        const a=(1-k/GL.length)*0.20*moonA;
        ctx.fillStyle=LF.rgba(pal.glitter,a);
        ctx.fillRect(x-gl.w/2,y,gl.w,1.4);
      }
    }
    const dawn=Math.max(game.dawnT||0, game.endT);
    if(dawn>0.05){
      const sunX=W*0.12;
      for(let k=0;k<GL.length;k++){
        const gl=GL[k];
        const y=bandT+8+k*((bandB-bandT)/46);
        const x=sunX+Math.sin(t*0.7+gl.ph*1.7)*gl.dx*0.5;
        const a=(1-k/GL.length)*0.24*dawn;
        ctx.fillStyle='rgba(255,214,130,'+a.toFixed(3)+')';
        ctx.fillRect(x-gl.w/2,y,gl.w,1.6);
      }
    }
    const w=game.world;
    if(!w) return;
    for(const l of w.lanes){
      const sx0=l.x0-cam, sx1=l.x1-cam;
      if(sx1<-40||sx0>W+40) continue;
      const y0=V.proj(l.y0), y1=V.proj(l.y1);
      const pulse=0.045+0.03*Math.sin(t*2+l.x0*0.01);
      ctx.fillStyle='rgba(255,205,110,'+pulse.toFixed(3)+')';
      ctx.fillRect(sx0,y0,sx1-sx0,y1-y0);
      ctx.fillStyle='rgba(255,220,150,0.14)';
      ctx.fillRect(sx0,y0,2,y1-y0);
      ctx.fillRect(sx1-2,y0,2,y1-y0);
      ctx.save();
      ctx.globalCompositeOperation='lighter';
      const h=(y1-y0), ww=sx1-sx0;
      for(let k=0;k<8;k++){
        const mx=sx0+((k*137)%Math.max(1,ww));
        const my=y1-((t*26+k*47+l.x0)%Math.max(1,h));
        const a=0.3+0.3*Math.sin(k*2.4+t*3);
        ctx.fillStyle='rgba(255,225,160,'+(a*0.5).toFixed(3)+')';
        ctx.fillRect(mx,my,1.6,1.6);
      }
      ctx.restore();
    }
    for(const wl of w.whirls){
      const sx=wl.x-cam;
      if(sx<-wl.R-30||sx>W+wl.R+30) continue;
      const sy=V.proj(wl.y);
      ctx.save();
      for(let a=0;a<3;a++){
        ctx.strokeStyle='rgba(200,220,255,'+(0.07+a*0.045)+')';
        ctx.lineWidth=2;
        ctx.beginPath();
        ctx.ellipse(sx,sy,wl.R*(0.32+a*0.22),wl.R*(0.32+a*0.22)*0.55,wl.ph+a*2.1,wl.ph+a*2.1+1.55);
        ctx.stroke();
      }
      const cg=ctx.createRadialGradient(sx,sy,1,sx,sy,wl.R*0.24);
      cg.addColorStop(0,'rgba(1,4,8,0.85)');
      cg.addColorStop(1,'rgba(1,4,8,0)');
      ctx.fillStyle=cg;
      ctx.beginPath(); ctx.ellipse(sx,sy,wl.R*0.26,wl.R*0.15,0,0,LF.TAU); ctx.fill();
      ctx.restore();
    }
    for(const wl of w.reedWalls){
      const sx=wl.x0-cam, ww=wl.x1-wl.x0;
      if(sx+ww<-40||sx>W+40) continue;
      const y0=V.proj(wl.y0), y1=V.proj(wl.y1);
      const rg=ctx.createLinearGradient(0,y0,0,y1);
      rg.addColorStop(0,'#0a1712');
      rg.addColorStop(1,'#050b08');
      ctx.fillStyle=rg;
      ctx.fillRect(sx-6,y0-3,ww+12,y1-y0+6);
      ctx.strokeStyle='rgba(18,44,30,0.95)';
      ctx.lineWidth=1.1;
      for(let gx=sx;gx<sx+ww;gx+=9){
        const wx=Math.floor((wl.x0+gx-sx)/9);
        const h=10+rockN.at(wx*3.3)*22;
        const sway=Math.sin(t*1.5+wx*1.1)*3;
        ctx.beginPath();
        ctx.moveTo(gx,y0+2);
        ctx.quadraticCurveTo(gx+sway,y0-h*0.6,gx+sway*1.5,y0-h);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(gx,y1+2);
        ctx.quadraticCurveTo(gx+sway*0.7,y1-h*0.5,gx+sway,y1-h*0.8);
        ctx.stroke();
      }
    }
    for(const r of w.rocks){
      const sx=r.x-cam;
      if(sx<-r.r-60||sx>W+r.r+60) continue;
      const sy=V.proj(r.y);
      ctx.beginPath();
      const N=10;
      for(let i=0;i<=N;i++){
        const an=i/N*LF.TAU;
        const rad=r.r*(0.84+0.16*rockN.at(r.seed+Math.cos(an)*2.2+2));
        const px=sx+Math.cos(an)*rad;
        const py=sy+Math.sin(an)*rad*0.74;
        if(i===0) ctx.moveTo(px,py); else ctx.lineTo(px,py);
      }
      ctx.closePath();
      ctx.fillStyle='#0c1017';
      ctx.fill();
      ctx.strokeStyle=LF.rgba(pal.moon,0.16);
      ctx.lineWidth=1.5;
      ctx.beginPath();
      ctx.ellipse(sx,sy,r.r*0.82,r.r*0.6,0,Math.PI*1.05,Math.PI*1.95);
      ctx.stroke();
      ctx.strokeStyle='rgba(205,225,245,'+(0.07+0.05*Math.sin(t*2+r.x)).toFixed(3)+')';
      ctx.lineWidth=1.2;
      ctx.beginPath();
      ctx.ellipse(sx,sy,r.r+12,(r.r+12)*0.74,0,0,LF.TAU);
      ctx.stroke();
      if(r.tree) this.tree(ctx,sx,sy,r,t);
    }
    for(const c of w.coins){
      if(c.taken||c.gone) continue;
      const sx=c.x-cam;
      if(sx<-20||sx>W+20) continue;
      let a=1;
      if(c.sink>0 && c.sink<4) a=c.sink/4;
      const sy=V.proj(c.y)+Math.sin(c.bob*3)*2;
      ctx.save();
      ctx.globalAlpha=a;
      ctx.fillStyle='#e8c25a';
      ctx.beginPath(); ctx.arc(sx,sy,5,0,LF.TAU); ctx.fill();
      ctx.strokeStyle='#fff2c0';
      ctx.lineWidth=1;
      ctx.beginPath(); ctx.arc(sx,sy,5,Math.sin(c.bob*4),Math.sin(c.bob*4)+1.8); ctx.stroke();
      ctx.globalAlpha=a*0.25;
      ctx.beginPath(); ctx.arc(sx,sy,9,0,LF.TAU); ctx.fill();
      ctx.restore();
    }
    if(w.star && !w.star.caught){
      const s=w.star;
      const sx=s.x-cam, sy=V.proj(s.y);
      if(sx>-60 && sx<W+60){
        ctx.save();
        ctx.globalCompositeOperation='lighter';
        const gg=ctx.createRadialGradient(sx,sy,2,sx,sy,34+6*Math.sin(s.ph*3));
        gg.addColorStop(0,'rgba(200,255,255,0.8)');
        gg.addColorStop(0.4,'rgba(140,230,255,0.25)');
        gg.addColorStop(1,'rgba(140,230,255,0)');
        ctx.fillStyle=gg;
        ctx.fillRect(sx-42,sy-42,84,84);
        ctx.fillStyle='rgba(235,255,255,0.95)';
        ctx.beginPath(); ctx.arc(sx,sy,6.5,0,LF.TAU); ctx.fill();
        ctx.restore();
      }
    }
    this.dock(ctx,cam,w.leftDock,W,V);
    if(game.segIndex<4) this.dock(ctx,cam,w.rightDock,W,V);
    this.bankReeds(ctx,game,cam,t,W,V);
  },
  tree(ctx,sx,sy,r,t){
    ctx.strokeStyle='#0a0f0a';
    ctx.lineWidth=5;
    ctx.beginPath();
    ctx.moveTo(sx,sy+4);
    ctx.quadraticCurveTo(sx+8,sy-30,sx+4,sy-52);
    ctx.stroke();
    ctx.lineWidth=2.4;
    ctx.beginPath();
    ctx.moveTo(sx+4,sy-30);
    ctx.quadraticCurveTo(sx-14,sy-40,sx-20,sy-52);
    ctx.stroke();
    ctx.fillStyle='#0d1810';
    for(let i=0;i<5;i++){
      const bx=sx+Math.cos(i*2.4)*22;
      const by=sy-56-Math.sin(i*1.7)*14;
      ctx.beginPath(); ctx.ellipse(bx,by,24,14,i,0,LF.TAU); ctx.fill();
    }
    for(let i=0;i<16;i++){
      const bx=sx+Math.cos(i*2.1)*26*rockN.at(i*7.7);
      const by=sy-58+Math.sin(i*3.3)*16*rockN.at(i*3.1);
      ctx.fillStyle='rgba(255,214,224,'+(0.35+0.45*Math.abs(Math.sin(t+i))+0.15)+')';
      ctx.beginPath(); ctx.arc(bx,by,2,0,LF.TAU); ctx.fill();
    }
  },
  dock(ctx,cam,x,W,V){
    const sx=x-cam;
    if(sx<-140||sx>W+140) return;
    const dy=V.proj(878);
    ctx.fillStyle='#161210';
    ctx.fillRect(sx-66,dy,132,9);
    ctx.fillStyle='#0d0b08';
    for(let k=-2;k<=2;k++){
      ctx.fillRect(sx+k*26-2,dy,4.4,V.proj(1005)-dy+10);
    }
    ctx.fillStyle='#201609';
    ctx.fillRect(sx+52,dy-34,3.4,34);
    ctx.fillRect(sx+46,dy-40,17,12);
    ctx.save();
    ctx.globalCompositeOperation='lighter';
    const flick=0.8+0.2*Math.sin(LF.TAU*(x%7)+Math.sin(LF.TAU*x)*0.5);
    const gg=ctx.createRadialGradient(sx+54,dy-36,2,sx+54,dy-36,56);
    gg.addColorStop(0,'rgba(255,190,110,'+(0.5*flick)+')');
    gg.addColorStop(1,'rgba(255,190,110,0)');
    ctx.fillStyle=gg;
    ctx.fillRect(sx-6,dy-96,120,120);
    ctx.restore();
  },
  bankReeds(ctx,game,cam,t,W,V){
    const dense=game.seg.key==='reeds';
    ctx.strokeStyle=dense?'rgba(20,52,36,0.9)':'rgba(14,34,24,0.8)';
    ctx.lineWidth=1.2;
    const reedAt=(wy)=>{
      ctx.beginPath();
      for(let gx=0;gx<=W+12;gx+=12){
        const wx=Math.floor((cam+gx)/12);
        const h=8+fgN.at(wx*1.7)*14;
        const yy=V.proj(wy)+2;
        const sway=Math.sin(t*1.3+wx*0.9)*2.4;
        ctx.moveTo(gx,yy);
        ctx.quadraticCurveTo(gx+sway*0.5,yy-h*0.6,gx+sway,yy-h);
      }
      ctx.stroke();
    };
    reedAt(1000);
    reedAt(0);
  },
  boatLayer(ctx,pal,game,cam,t,W,H,V){
    const b=game.boat;
    const S=V.H/900;
    const f=game.seg.facing;
    const bx=b.x-cam, by=V.proj(b.y);
    if(b.sink>0){
      ctx.save();
      ctx.globalAlpha=Math.max(0,1-b.sink*0.55);
      ctx.translate(bx,by+b.sink*26);
    }
    if(b.wisp && game.state!=='release'){
      const c=b.wisp;
      const wx=bx+Math.cos(b.tiltVis)*26*f*S, wy=by-14*S+Math.sin(b.wispBob*2)*2;
      ctx.save();
      ctx.globalCompositeOperation='lighter';
      const gg=ctx.createRadialGradient(wx,wy,1,wx,wy,26*S);
      gg.addColorStop(0,'rgba(255,255,255,0.85)');
      gg.addColorStop(0.35,LF.rgba(c,0.5));
      gg.addColorStop(1,LF.rgba(c,0));
      ctx.fillStyle=gg;
      ctx.fillRect(wx-30*S,wy-30*S,60*S,60*S);
      ctx.restore();
    }
    if(game.boardWisp && game.boardWisp.a>0){
      const bw=game.boardWisp;
      const wx=bw.x-cam, wy=V.proj(bw.y);
      ctx.save();
      ctx.globalCompositeOperation='lighter';
      ctx.globalAlpha=bw.a;
      const gg=ctx.createRadialGradient(wx,wy,1,wx,wy,20*S);
      gg.addColorStop(0,'rgba(255,255,255,0.9)');
      gg.addColorStop(0.35,LF.rgba(bw.c,0.55));
      gg.addColorStop(1,LF.rgba(bw.c,0));
      ctx.fillStyle=gg;
      ctx.fillRect(wx-24*S,wy-24*S,48*S,48*S);
      ctx.restore();
    }
    if(game.exitWisp && game.exitWisp.a>0){
      const ew=game.exitWisp;
      const wx=ew.x-cam, wy=V.proj(ew.y);
      ctx.save();
      ctx.globalCompositeOperation='lighter';
      ctx.globalAlpha=ew.a;
      const gg=ctx.createRadialGradient(wx,wy,1,wx,wy,18*S);
      gg.addColorStop(0,'rgba(255,255,255,0.9)');
      gg.addColorStop(0.4,LF.rgba(ew.c,0.5));
      gg.addColorStop(1,LF.rgba(ew.c,0));
      ctx.fillStyle=gg;
      ctx.fillRect(wx-22*S,wy-22*S,44*S,44*S);
      ctx.restore();
    }
    const rot=b.tiltVis + (b.spinT>0 ? (1.15-b.spinT)*LF.TAU*1.6 : 0);
    ctx.save();
    ctx.translate(bx,by);
    ctx.rotate(rot);
    if(f<0) ctx.scale(-1,1);
    ctx.scale(S,S);
    if(b.inv>0 && Math.floor(b.inv*14)%2===0) ctx.globalAlpha=0.45;
    const bob=Math.sin(t*2.1)*1.4;
    ctx.translate(0,bob);
    ctx.strokeStyle='#241a12';
    ctx.lineWidth=3;
    const oarAng=(side)=>{
      const base=side?0.34:-0.34;
      if(b.rowAnim>0){
        const sw=Math.sin(b.rowAnim*Math.PI)*(side?1:-1);
        return base+sw*0.5;
      }
      return base;
    };
    for(const side of [0,1]){
      const ox=side?12:-2, oy=-4;
      const an=oarAng(side)+Math.PI/2;
      const bl=side?26:26;
      const tipx=ox+Math.cos(an)*bl, tipy=oy+Math.sin(an)*bl;
      ctx.strokeStyle='#3a2c1c';
      ctx.lineWidth=2.6;
      ctx.beginPath();
      ctx.moveTo(ox,oy);
      ctx.lineTo(tipx,tipy);
      ctx.stroke();
      ctx.fillStyle='#2a2016';
      ctx.beginPath();
      ctx.ellipse(tipx,tipy,3.2,6.5,an-Math.PI/2,0,LF.TAU);
      ctx.fill();
    }
    ctx.beginPath();
    ctx.moveTo(-52,-4);
    ctx.quadraticCurveTo(-46,8,-30,11);
    ctx.quadraticCurveTo(0,16,30,11);
    ctx.quadraticCurveTo(46,8,52,-4);
    ctx.quadraticCurveTo(30,2,0,3);
    ctx.quadraticCurveTo(-30,2,-52,-4);
    ctx.closePath();
    ctx.fillStyle='#241a12';
    ctx.fill();
    ctx.strokeStyle='#5e452c';
    ctx.lineWidth=1.2;
    ctx.beginPath();
    ctx.moveTo(-52,-4);
    ctx.quadraticCurveTo(0,4,52,-4);
    ctx.stroke();
    ctx.strokeStyle='rgba(70,50,30,0.5)';
    ctx.lineWidth=1;
    for(let k=-1;k<=1;k++){
      ctx.beginPath();
      ctx.moveTo(k*20,8);
      ctx.quadraticCurveTo(k*20,3,k*20+3,0);
      ctx.stroke();
    }
    for(let k=0;k<b.hull;k++){
      ctx.strokeStyle='rgba(30,16,10,0.9)';
      ctx.lineWidth=1.4;
      ctx.beginPath();
      const cx0=-34+k*26;
      ctx.moveTo(cx0,7);
      ctx.lineTo(cx0+6,4);
      ctx.lineTo(cx0+10,8);
      ctx.lineTo(cx0+15,5);
      ctx.stroke();
    }
    ctx.fillStyle='#0c0a08';
    ctx.beginPath();
    ctx.moveTo(-40,-2);
    ctx.quadraticCurveTo(-34,-26,-22,-28);
    ctx.quadraticCurveTo(-12,-27,-10,-16);
    ctx.quadraticCurveTo(-16,-4,-28,-2);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(-26,-27);
    ctx.quadraticCurveTo(-22,-33,-16,-31);
    ctx.quadraticCurveTo(-20,-29,-26,-27);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle='#0c0a08';
    ctx.lineWidth=2.2;
    ctx.beginPath();
    ctx.moveTo(-33,-30);
    ctx.lineTo(-9,-30.5);
    ctx.stroke();
    ctx.strokeStyle='#141210';
    ctx.lineWidth=2.4;
    ctx.beginPath();
    ctx.moveTo(-6,-4);
    ctx.quadraticCurveTo(8,-14,22,-13);
    ctx.stroke();
    ctx.strokeStyle='#1c150e';
    ctx.lineWidth=2;
    ctx.beginPath();
    ctx.moveTo(44,0);
    ctx.lineTo(44,-26);
    ctx.stroke();
    const flick=0.85+0.15*Math.sin(t*9.3)+0.06*Math.sin(t*23.7);
    ctx.fillStyle='#221708';
    ctx.fillRect(40,-36,9,12);
    ctx.save();
    ctx.globalCompositeOperation='lighter';
    ctx.fillStyle='rgba(255,205,120,'+(0.9*flick)+')';
    ctx.fillRect(41.6,-34.2,5.8,8.4);
    ctx.restore();
    ctx.restore();
    const lanternA=Math.cos(rot), lanternB=Math.sin(rot);
    const lx=bx+(lanternA*44*f - lanternB*-30)*S;
    const ly=by+(lanternB*44*f + lanternA*-30)*S+bob*S;
    ctx.save();
    ctx.globalCompositeOperation='lighter';
    const lr=b.lightR*S*(0.97+0.05*flick);
    const gg=ctx.createRadialGradient(lx,ly,4,lx,ly,lr);
    gg.addColorStop(0,LF.rgba(pal.glow,0.30));
    gg.addColorStop(0.5,LF.rgba(pal.glow,0.10));
    gg.addColorStop(1,LF.rgba(pal.glow,0));
    ctx.fillStyle=gg;
    ctx.fillRect(lx-lr,ly-lr,lr*2,lr*2);
    ctx.restore();
    const shg=ctx.createRadialGradient(bx,by+10*S,2,bx,by+10*S,70*S);
    shg.addColorStop(0,'rgba(2,4,8,0.5)');
    shg.addColorStop(1,'rgba(2,4,8,0)');
    ctx.fillStyle=shg;
    ctx.beginPath();
    ctx.ellipse(bx,by+12*S,72*S,20*S,0,0,LF.TAU);
    ctx.fill();
    if(b.sink>0) ctx.restore();
  },
  fireflies(ctx,game,cam,t,V){
    const w=game.world;
    if(!w) return;
    ctx.save();
    ctx.globalCompositeOperation='lighter';
    for(const f of w.fields){
      if(f.x1<cam-60||f.x0>cam+V.W+60) continue;
      for(const fl of f.flies){
        const sx=fl.x-cam, sy=V.proj(fl.y);
        const a=Math.max(0,Math.sin(fl.ph));
        const glow=0.3+0.7*a;
        const gg=ctx.createRadialGradient(sx,sy,0.4,sx,sy,6.5);
        gg.addColorStop(0,'rgba(255,235,170,'+(0.55*glow*f.glow)+')');
        gg.addColorStop(1,'rgba(255,220,120,0)');
        ctx.fillStyle=gg;
        ctx.fillRect(sx-7,sy-7,14,14);
        ctx.fillStyle='rgba(255,244,200,'+(0.85*glow)+')';
        ctx.fillRect(sx-0.8,sy-0.8,1.6,1.6);
      }
    }
    ctx.restore();
  },
  foreground(ctx,pal,game,cam,t,W,H,V){
    const fgT=V.fgT;
    const g=ctx.createLinearGradient(0,fgT-14,0,H);
    g.addColorStop(0,'rgba(4,7,5,0)');
    g.addColorStop(0.35,'rgba(4,7,5,0.92)');
    g.addColorStop(1,'rgba(3,5,4,1)');
    ctx.fillStyle=g;
    ctx.fillRect(0,fgT-14,W,H-fgT+14);
    const dense=game.seg.key==='reeds';
    ctx.strokeStyle=dense?'rgba(16,44,30,0.95)':'rgba(10,26,18,0.9)';
    ctx.lineWidth=1.6;
    ctx.beginPath();
    for(let gx=0;gx<=W+14;gx+=14){
      const wx=Math.floor((cam*1.04+gx)/14);
      const hh=(dense?46:26)+fgN.at(wx*2.3)*(dense?46:26);
      const sway=Math.sin(t*1.1+wx*0.7)*(dense?5:3);
      ctx.moveTo(gx,H+2);
      ctx.quadraticCurveTo(gx+sway*0.4,H-hh*0.55,gx+sway,H-hh);
    }
    ctx.stroke();
    if(dense){
      ctx.fillStyle='rgba(255,214,224,0.5)';
      for(let gx=0;gx<=W+14;gx+=70){
        const wx=Math.floor((cam*1.04+gx)/14);
        const hh=(dense?46:26)+fgN.at(wx*2.3)*(dense?46:26);
        const sway=Math.sin(t*1.1+wx*0.7)*5;
        ctx.beginPath(); ctx.arc(gx+sway,H-hh,1.8,0,LF.TAU); ctx.fill();
      }
    }
  },
  hud(ctx,game,W,H,V){
    if(game.state==='title'||game.state==='end'||game.state==='sink') return;
    if(game.state==='release' && game.releaseT>1.2) return;
    ctx.save();
    ctx.font='600 15px "Cormorant Garamond", Georgia, serif';
    ctx.textBaseline='middle';
    ctx.fillStyle='#e8dcae';
    ctx.strokeStyle='#8a7440';
    ctx.lineWidth=1.4;
    ctx.beginPath(); ctx.arc(34,32,8,0,LF.TAU); ctx.stroke();
    ctx.fillStyle='#e8c25a';
    ctx.beginPath(); ctx.arc(34,32,5.4,0,LF.TAU); ctx.fill();
    ctx.fillStyle='#f2e6c0';
    ctx.font='600 19px "Cormorant Garamond", Georgia, serif';
    ctx.fillText(String(game.boat.coins),48,33);
    for(let i=0;i<3;i++){
      const x=26+i*30, y=62;
      const alive=i < 3-game.boat.hull;
      ctx.strokeStyle=alive?'rgba(190,205,225,0.85)':'rgba(120,80,60,0.6)';
      ctx.lineWidth=1.6;
      ctx.beginPath();
      ctx.moveTo(x-10,y);
      ctx.quadraticCurveTo(x,y+6,x+10,y);
      ctx.quadraticCurveTo(x,y-4,x-10,y);
      ctx.stroke();
      if(!alive){
        ctx.strokeStyle='rgba(200,90,60,0.8)';
        ctx.beginPath();
        ctx.moveTo(x-6,y-4); ctx.lineTo(x+6,y+4);
        ctx.moveTo(x+6,y-4); ctx.lineTo(x-6,y+4);
        ctx.stroke();
      }
    }
    if(game.showPace){
      ctx.font='400 13px "Cormorant Garamond", Georgia, serif';
      ctx.fillStyle='rgba(220,228,240,0.75)';
      ctx.fillText('pace',26,90);
      ctx.fillStyle='rgba(20,30,26,0.7)';
      ctx.fillRect(60,84,110,8);
      ctx.fillStyle='rgba(90,170,90,0.35)';
      ctx.fillRect(60,84,110*(265/420),8);
      const pv=LF.clamp(game.paceVal/420,0,1);
      ctx.fillStyle=game.paceVal>265?'#e89a6a':'#bfe8b0';
      ctx.fillRect(60+110*pv-1.4,82,2.8,12);
    }
    if(game.timerOn){
      const frac=LF.clamp(game.timer/game.timerMax,0,1);
      const bw=260, bx=W/2-bw/2, by=30;
      ctx.fillStyle='rgba(10,14,22,0.65)';
      ctx.fillRect(bx-2,by-2,bw+4,12);
      ctx.fillStyle=frac>0.25?'rgba(232,194,90,0.9)':'rgba(226,110,70,0.95)';
      ctx.fillRect(bx,by,bw*frac,8);
      ctx.font='400 13px "Cormorant Garamond", Georgia, serif';
      ctx.fillStyle='rgba(230,220,190,0.8)';
      ctx.textAlign='center';
      ctx.fillText('the deadline',W/2,by+18);
      ctx.textAlign='left';
    }
    if(game.showLanes){
      ctx.font='400 14px "Cormorant Garamond", Georgia, serif';
      ctx.fillStyle='rgba(255,236,200,0.85)';
      ctx.textAlign='right';
      ctx.fillText('the light sings along — '+Math.min(4,game.stats.lanes)+' of 4',W-24,32);
      ctx.textAlign='left';
    }
    ctx.restore();
  },
  bloom(ctx,W,H){
    try{
      if(!bloomCv){
        bloomCv=document.createElement('canvas');
        bctx=bloomCv.getContext('2d');
      }
      const bw=Math.max(2,W>>2), bh=Math.max(2,H>>2);
      if(bloomCv.width!==bw||bloomCv.height!==bh){
        bloomCv.width=bw; bloomCv.height=bh;
      }
      bctx.clearRect(0,0,bw,bh);
      bctx.drawImage(LF.canvas,0,0,bw,bh);
      ctx.save();
      ctx.globalCompositeOperation='lighter';
      ctx.globalAlpha=0.16;
      ctx.drawImage(bloomCv,0,0,W,H);
      ctx.restore();
    }catch(e){}
  }
};
LF.View=View;
LF.Render=R;
})();
