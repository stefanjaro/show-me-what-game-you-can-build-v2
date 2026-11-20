'use strict';
(function(){
const LF = window.LF;
const P = {
  under: [],
  over: []
};
P.ripple = (x,y,r=10,a=0.32,life=1.5)=>{ P.under.push({t:'rip',x,y,r,a,life,age:0}); };
P.drops = (x,y,n=7,p=1)=>{
  for(let i=0;i<n;i++){
    const an=LF.rand(-Math.PI,-0.15)+LF.rand(-0.35,0.35);
    const sp=LF.rand(70,220)*p;
    P.over.push({t:'drop',x,y,vx:Math.cos(an)*sp,vy:Math.sin(an)*sp,age:0,life:LF.rand(0.35,0.75)});
  }
};
P.spark = (x,y,c='#ffd97a',n=7,sp=90)=>{
  for(let i=0;i<n;i++){
    const an=LF.rand(0,LF.TAU);
    P.over.push({t:'sp',x,y,vx:Math.cos(an)*sp*LF.rand(0.25,1),vy:Math.sin(an)*sp*LF.rand(0.25,1),age:0,life:LF.rand(0.5,1.1),c});
  }
};
P.petal = (x,y)=>{ P.over.push({t:'pe',x,y,vx:LF.rand(-16,14),vy:LF.rand(4,20),ph:LF.rand(0,LF.TAU),age:0,life:LF.rand(3,5.5)}); };
P.bubble = (x,y)=>{ P.over.push({t:'bu',x,y,vy:-LF.rand(18,42),xr:LF.rand(-9,9),age:0,life:LF.rand(0.8,1.7)}); };
P.streak = (x,y)=>{ P.over.push({t:'st',x,y,vx:LF.rand(480,820),age:0,life:LF.rand(0.4,0.9)}); };
P.burst = (x,y,c='#ffe9b8')=>{ P.over.push({t:'ring',x,y,age:0,life:0.8,c}); };
P.clear = ()=>{ P.under.length=0; P.over.length=0; };
P.update = dt=>{
  for(const arr of [P.under,P.over]){
    for(let i=arr.length-1;i>=0;i--){
      const p=arr[i];
      p.age+=dt;
      if(p.age>=p.life){ arr.splice(i,1); continue; }
      if(p.t==='drop'){ p.vy+=850*dt; p.x+=p.vx*dt; p.y+=p.vy*dt; }
      else if(p.t==='sp'){ p.x+=p.vx*dt; p.y+=p.vy*dt; p.vx*=(1-1.8*dt); p.vy*=(1-1.8*dt); }
      else if(p.t==='pe'){ p.x+=p.vx*dt+Math.sin(p.ph+p.age*3)*14*dt; p.y+=p.vy*dt; }
      else if(p.t==='bu'){ p.y+=p.vy*dt; }
      else if(p.t==='st'){ p.x+=p.vx*dt; }
    }
  }
};
P.drawUnder = (ctx,cam,proj)=>{
  for(const p of P.under){
    const k=1-p.age/p.life;
    if(p.t==='rip'){
      const r=p.r+(1-k)*46;
      ctx.strokeStyle='rgba(210,230,255,'+(p.a*k)+')';
      ctx.lineWidth=1.2;
      ctx.beginPath();
      ctx.ellipse(p.x-cam, proj(p.y), r, r*0.3, 0, 0, LF.TAU);
      ctx.stroke();
    }
  }
};
P.drawOver = (ctx,cam,proj)=>{
  ctx.save();
  for(const p of P.over){
    const k=1-p.age/p.life;
    const sx=p.x-cam, sy=proj(p.y);
    if(p.t==='drop'){
      ctx.fillStyle='rgba(200,225,255,'+(0.5*k)+')';
      ctx.beginPath(); ctx.arc(sx,sy,1.6,0,LF.TAU); ctx.fill();
    } else if(p.t==='sp'){
      ctx.globalCompositeOperation='lighter';
      ctx.fillStyle=p.c;
      ctx.globalAlpha=0.7*k;
      ctx.beginPath(); ctx.arc(sx,sy,2.1,0,LF.TAU); ctx.fill();
      ctx.globalAlpha=0.18*k;
      ctx.beginPath(); ctx.arc(sx,sy,5.5,0,LF.TAU); ctx.fill();
      ctx.globalAlpha=1;
      ctx.globalCompositeOperation='source-over';
    } else if(p.t==='pe'){
      ctx.fillStyle='rgba(255,215,224,'+(0.75*k)+')';
      ctx.save();
      ctx.translate(sx,sy);
      ctx.rotate(Math.sin(p.ph+p.age*2.5)*0.7);
      ctx.beginPath(); ctx.ellipse(0,0,3.4,1.7,0,0,LF.TAU); ctx.fill();
      ctx.restore();
    } else if(p.t==='bu'){
      ctx.strokeStyle='rgba(190,215,240,'+(0.5*k)+')';
      ctx.lineWidth=1;
      ctx.beginPath(); ctx.arc(sx+p.xr,p.y===undefined?sy:sy,2.3,0,LF.TAU); ctx.stroke();
    } else if(p.t==='st'){
      ctx.strokeStyle='rgba(200,215,235,'+(0.16*k)+')';
      ctx.lineWidth=1.4;
      ctx.beginPath(); ctx.moveTo(sx,sy); ctx.lineTo(sx-70,sy); ctx.stroke();
    } else if(p.t==='ring'){
      ctx.globalCompositeOperation='lighter';
      ctx.strokeStyle=p.c;
      ctx.globalAlpha=0.5*k;
      ctx.lineWidth=2.4;
      ctx.beginPath(); ctx.ellipse(sx,sy,(1-k)*90+8,((1-k)*90+8)*0.4,0,0,LF.TAU); ctx.stroke();
      ctx.globalAlpha=1;
      ctx.globalCompositeOperation='source-over';
    }
  }
  ctx.restore();
};
LF.Particles = P;
})();
