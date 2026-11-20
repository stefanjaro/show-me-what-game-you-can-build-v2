"use strict";

function drawWorld() {
  const cam = G.cam;
  const shx = G.shake > 0 ? rand(-G.shake, G.shake) : 0;
  const shy = G.shake > 0 ? rand(-G.shake, G.shake) : 0;

  maskX.setTransform(DPR, 0, 0, DPR, 0, 0);
  maskX.globalCompositeOperation = "destination-out";
  maskX.fillStyle = `rgba(0,0,0,${Math.min(0.4, 0.8 * G.dt)})`;
  maskX.fillRect(0, 0, W, H);
  maskX.globalCompositeOperation = "source-over";
  paintMaskBlob(player.x, player.y, 46, 0.5);
  hunters.forEach((h) => {
    if (h.state === "dormant") return;
    const d = dist(h.x, h.y, player.x, player.y);
    if (d < 150) paintMaskBlob(h.x, h.y, 90, 0.4 * (1 - d / 150));
  });
  beacons.forEach((b) => {
    if (b.done) paintMaskBlob(b.x, b.y, 90, 0.16);
  });

  tmpX.setTransform(1, 0, 0, 1, 0, 0);
  tmpX.clearRect(0, 0, tmpC.width, tmpC.height);
  tmpX.setTransform(DPR, 0, 0, DPR, 0, 0);
  tmpX.translate(-cam.x + shx, -cam.y + shy);
  tmpX.drawImage(mapC, 0, 0);
  tmpX.setTransform(1, 0, 0, 1, 0, 0);
  tmpX.globalCompositeOperation = "destination-in";
  tmpX.drawImage(maskC, 0, 0);
  tmpX.globalCompositeOperation = "source-over";

  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  let dawn = 0;
  if (G.state === "endcut" || G.state === "ended") dawn = clamp(G.endT / 3, 0, 1);
  if (G.ch === 4) dawn = Math.max(dawn, clamp(1 - player.y / world.h, 0, 1) * 0.35);
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, `rgb(${Math.round(2 + dawn * 40)},${Math.round(4 + dawn * 26)},${Math.round(8 + dawn * 12)})`);
  bg.addColorStop(1, `rgb(${Math.round(1 + dawn * 60)},${Math.round(3 + dawn * 40)},${Math.round(6 + dawn * 20)})`);
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  ctx.globalCompositeOperation = "lighter";
  ctx.globalAlpha = 0.95;
  ctx.drawImage(tmpC, 0, 0, W, H);
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = "source-over";

  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  ctx.translate(-cam.x + shx, -cam.y + shy);
  const hue = world.hue;

  sponges.forEach((s) => {
    const d = dist(player.x, player.y, s.x, s.y);
    if (d > 900) return;
    const a = clamp(1 - d / 900, 0, 1) * 0.35;
    for (let k = 0; k < 9; k++) {
      const a2 = (k / 9) * TAU + s.ph;
      const bx = s.x + Math.cos(a2) * s.r * 0.75;
      const by = s.y + Math.sin(a2) * s.r * 0.75;
      const sway = Math.sin(G.t * 1.2 + k) * 10;
      ctx.strokeStyle = `rgba(150, 200, 160, ${a})`;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(bx, by);
      ctx.quadraticCurveTo(bx + sway, by - s.r * 0.4, bx + sway * 2, by - s.r * 0.75);
      ctx.stroke();
    }
    ctx.strokeStyle = `rgba(150, 220, 180, ${a * 0.5})`;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(s.x, s.y, s.r * 0.8, 0, TAU);
    ctx.stroke();
  });

  currents.forEach((c) => {
    if (cam.x > c.x + c.w || cam.x + W < c.x || cam.y > c.y + c.h || cam.y + H < c.y) return;
    ctx.strokeStyle = `hsla(${hue}, 70%, 70%, 0.13)`;
    ctx.lineWidth = 1.2;
    for (let k = 0; k < 14; k++) {
      const px2 = c.x + ((k * 137 + G.t * 60) % c.w);
      const py2 = c.y + ((k * 211 + Math.abs(G.t * c.vy) * 0.5) % c.h);
      ctx.beginPath();
      ctx.moveTo(px2, py2);
      ctx.lineTo(px2 + c.vx * 0.25, py2 + c.vy * 0.25);
      ctx.stroke();
    }
  });

  surges.forEach((s) => {
    if (s.state === "idle") return;
    const a = s.state === "warn" ? 0.12 + 0.1 * Math.sin(G.t * 20) : 0.22;
    ctx.fillStyle = `rgba(255, 120, 100, ${a})`;
    ctx.fillRect(0, s.y0 - 30, world.w, s.y1 - s.y0 + 60);
    if (s.state === "active") {
      ctx.strokeStyle = "rgba(255, 160, 130, 0.3)";
      ctx.lineWidth = 2;
      for (let k = 0; k < 20; k++) {
        const px2 = ((k * 173 + G.t * 700 * s.dx) % world.w + world.w) % world.w;
        const py2 = s.y0 + ((k * 97 + G.t * 500) % (s.y1 - s.y0));
        ctx.beginPath();
        ctx.moveTo(px2, py2);
        ctx.lineTo(px2 + s.dx * 40, py2 + 60);
        ctx.stroke();
      }
    }
  });

  doors.forEach((d) => {
    const a = Math.max(0.14, d.rev);
    const hw = d.w / 2, hh = d.h / 2;
    ctx.save();
    ctx.translate(d.x + hw, d.y + hh);
    ctx.fillStyle = `hsla(38, 70%, 60%, ${a})`;
    if (d.w >= d.h) {
      const off = (d.w / 2 + 4) * d.open;
      ctx.fillRect(-hw - off, -hh, hw, d.h);
      ctx.fillRect(off, -hh, hw, d.h);
    } else {
      const off = (d.h / 2 + 4) * d.open;
      ctx.fillRect(-hw, -hh - off, d.w, hh);
      ctx.fillRect(-hw, off, d.w, hh);
    }
    ctx.strokeStyle = `hsla(38, 90%, 72%, ${a})`;
    ctx.lineWidth = 2;
    ctx.strokeRect(-hw - 2, -hh - 2, d.w + 4, d.h + 4);
    for (let k = 0; k < d.need; k++) {
      const gotK = k < d.got;
      ctx.fillStyle = gotK ? `hsla(160, 90%, 70%, ${Math.max(0.5, a)})` : `hsla(38, 60%, 55%, ${a * 0.5})`;
      ctx.save();
      ctx.translate((k - (d.need - 1) / 2) * 16, -hh - 14);
      ctx.rotate(Math.PI / 4);
      ctx.fillRect(-4, -4, 8, 8);
      ctx.restore();
    }
    ctx.restore();
  });

  const e = exitZone;
  const pulse = 0.5 + 0.5 * Math.sin(G.t * 2);
  const ea = 0.18 + 0.22 * pulse + (G.ch === 4 ? clamp(1 - player.y / world.h, 0, 1) * 0.4 : 0);
  const eg = ctx.createRadialGradient(e.x, e.y, 0, e.x, e.y, 130);
  eg.addColorStop(0, `rgba(190, 245, 255, ${ea})`);
  eg.addColorStop(1, "rgba(190, 245, 255, 0)");
  ctx.fillStyle = eg;
  ctx.beginPath();
  ctx.arc(e.x, e.y, 130, 0, TAU);
  ctx.fill();
  ctx.strokeStyle = `rgba(200, 250, 255, ${ea + 0.2})`;
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.arc(e.x, e.y, 26 + pulse * 6, 0, TAU);
  ctx.stroke();

  beacons.forEach((b) => {
    const bp = 0.5 + 0.5 * Math.sin(b.t * 2.4);
    const a = 0.5 + 0.3 * bp;
    const g = ctx.createRadialGradient(b.x, b.y, 0, b.x, b.y, 60);
    g.addColorStop(0, `rgba(255, 205, 120, ${0.28 * a})`);
    g.addColorStop(1, "rgba(255, 205, 120, 0)");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(b.x, b.y, 60, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = `rgba(255, 215, 150, ${a})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(b.x, b.y, 10, 0, TAU);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(b.x, b.y - 10);
    ctx.lineTo(b.x, b.y - 22);
    ctx.stroke();
    ctx.fillStyle = `rgba(255, 230, 170, ${a})`;
    ctx.beginPath();
    ctx.arc(b.x, b.y - 24, 3.2, 0, TAU);
    ctx.fill();
  });

  if (box && !box.got && box.seen) {
    const a = Math.max(0.15, box.rev);
    ctx.save();
    ctx.translate(box.x, box.y);
    ctx.fillStyle = `rgba(255, 170, 90, ${a})`;
    ctx.fillRect(-12, -9, 24, 18);
    ctx.strokeStyle = `rgba(255, 200, 130, ${a})`;
    ctx.lineWidth = 2;
    ctx.strokeRect(-12, -9, 24, 18);
    ctx.beginPath();
    ctx.moveTo(-12, 0);
    ctx.lineTo(12, 0);
    ctx.stroke();
    ctx.restore();
  }

  crystals.forEach((c) => {
    const a = Math.max(0.2, c.rev);
    ctx.save();
    ctx.translate(c.x, c.y);
    ctx.rotate(c.rot);
    const s = 9 + c.flash * 5;
    const glow = ctx.createRadialGradient(0, 0, 0, 0, 0, 46);
    glow.addColorStop(0, `rgba(130, 255, 215, ${0.3 * a + c.flash * 0.5})`);
    glow.addColorStop(1, "rgba(130, 255, 215, 0)");
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(0, 0, 46, 0, TAU);
    ctx.fill();
    ctx.fillStyle = `rgba(170, 255, 230, ${0.75 * a + c.flash * 0.25})`;
    ctx.beginPath();
    ctx.moveTo(0, -s);
    ctx.lineTo(s * 0.6, 0);
    ctx.lineTo(0, s);
    ctx.lineTo(-s * 0.6, 0);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = `rgba(220, 255, 245, ${a})`;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, -s);
    ctx.lineTo(0, s);
    ctx.stroke();
    ctx.restore();
  });

  mines.forEach((mn) => {
    if (mn.spent) {
      const a = mn.rev * 0.4;
      ctx.fillStyle = `rgba(90, 60, 60, ${a})`;
      ctx.beginPath();
      ctx.arc(mn.x, mn.y, 8, 0, TAU);
      ctx.fill();
      return;
    }
    const a = Math.max(0.12, mn.rev);
    const blink = mn.fuse > 0 ? 0.6 + 0.4 * Math.sin(mn.blink) : 0.3 + 0.2 * Math.sin(mn.blink);
    ctx.fillStyle = `rgba(255, 70, 60, ${a * blink})`;
    ctx.beginPath();
    ctx.arc(mn.x, mn.y, 6, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = `rgba(255, 110, 90, ${a * 0.8})`;
    ctx.lineWidth = 1.5;
    for (let k = 0; k < 5; k++) {
      const a2 = (k / 5) * TAU + mn.blink * 0.2;
      ctx.beginPath();
      ctx.moveTo(mn.x + Math.cos(a2) * 7, mn.y + Math.sin(a2) * 7);
      ctx.lineTo(mn.x + Math.cos(a2) * 13, mn.y + Math.sin(a2) * 13);
      ctx.stroke();
    }
  });

  boids.forEach((b) => {
    const a = b.rev;
    if (a < 0.03) return;
    const ang = Math.atan2(b.vy, b.vx);
    ctx.save();
    ctx.translate(b.x, b.y);
    ctx.rotate(ang);
    const wob = Math.sin(b.ph) * 2;
    ctx.fillStyle = `rgba(190, 150, 255, ${0.7 * a})`;
    ctx.beginPath();
    ctx.ellipse(0, 0, 7, 3.4, 0, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = `rgba(210, 180, 255, ${0.55 * a})`;
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(-6, 0);
    ctx.quadraticCurveTo(-11, wob, -14, wob * 1.6);
    ctx.stroke();
    ctx.restore();
  });

  hunters.forEach((h) => {
    if (h.state === "dormant") return;
    const d = dist(h.x, h.y, player.x, player.y);
    const a = Math.max(h.rev, d < 170 ? (1 - d / 170) * 0.35 : 0);
    if (a < 0.03) return;
    ctx.save();
    ctx.translate(h.x, h.y);
    ctx.rotate(h.ang);
    const chase = h.state === "chase";
    ctx.fillStyle = `rgba(30, 12, 18, ${a})`;
    ctx.strokeStyle = `rgba(255, 80, 90, ${0.75 * a})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(0, 0, 19, 9, 0, 0, TAU);
    ctx.fill();
    ctx.stroke();
    const tw = Math.sin(h.wag) * 5;
    ctx.beginPath();
    ctx.moveTo(-16, 0);
    ctx.quadraticCurveTo(-26, tw, -30, tw * 1.8);
    ctx.stroke();
    if (chase || h.state === "stagger") {
      ctx.fillStyle = `rgba(255, 90, 90, ${a})`;
      ctx.beginPath();
      ctx.moveTo(14, -3);
      ctx.lineTo(26, -8);
      ctx.lineTo(15, -8);
      ctx.closePath();
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(14, 3);
      ctx.lineTo(26, 8);
      ctx.lineTo(15, 8);
      ctx.closePath();
      ctx.fill();
    } else {
      const flick = 0.5 + 0.5 * Math.sin(G.t * 3 + h.wag);
      const lx = 24, ly = -12;
      ctx.strokeStyle = `rgba(120, 200, 180, ${a * 0.5})`;
      ctx.beginPath();
      ctx.moveTo(8, -4);
      ctx.quadraticCurveTo(18, -16, lx, ly);
      ctx.stroke();
      const g = ctx.createRadialGradient(lx, ly, 0, lx, ly, 12);
      g.addColorStop(0, `rgba(160, 255, 220, ${a * 0.8 * flick})`);
      g.addColorStop(1, "rgba(160, 255, 220, 0)");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(lx, ly, 12, 0, TAU);
      ctx.fill();
    }
    ctx.restore();
  });

  if (lev) {
    const a = Math.max(lev.rev, G.flags.escort ? 0.5 : 0);
    if (a > 0.02) {
      const stunned = lev.state === "stun";
      for (let i = lev.segs.length - 1; i >= 0; i--) {
        const s = lev.segs[i];
        const t = 1 - i / lev.segs.length;
        const r = 12 + t * 40;
        const spot = i % 3 === 0 && !stunned;
        ctx.fillStyle = `rgba(8, 10, 16, ${0.9 * a})`;
        ctx.beginPath();
        ctx.arc(s.x, s.y, r, 0, TAU);
        ctx.fill();
        ctx.strokeStyle = `rgba(255, 90, 90, ${0.35 * a})`;
        ctx.lineWidth = 1.6;
        ctx.stroke();
        if (spot) {
          const sp = 0.5 + 0.5 * Math.sin(lev.spotPh + i);
          ctx.fillStyle = `rgba(120, 250, 255, ${a * (0.35 + 0.4 * sp)})`;
          ctx.beginPath();
          ctx.arc(s.x + r * 0.45, s.y - r * 0.4, 2.6, 0, TAU);
          ctx.fill();
          ctx.beginPath();
          ctx.arc(s.x - r * 0.45, s.y + r * 0.4, 2.2, 0, TAU);
          ctx.fill();
        }
      }
      ctx.save();
      ctx.translate(lev.x, lev.y);
      ctx.rotate(lev.ang);
      ctx.fillStyle = `rgba(10, 10, 16, ${a})`;
      ctx.strokeStyle = `rgba(255, 100, 100, ${0.5 * a})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(0, 0, 52, 34, 0, 0, TAU);
      ctx.fill();
      ctx.stroke();
      if (lev.state === "lunge") {
        ctx.fillStyle = `rgba(255, 60, 60, ${0.5 * a})`;
        ctx.beginPath();
        ctx.moveTo(30, -8);
        ctx.lineTo(72, -18);
        ctx.lineTo(34, -20);
        ctx.closePath();
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(30, 8);
        ctx.lineTo(72, 18);
        ctx.lineTo(34, 20);
        ctx.closePath();
        ctx.fill();
      }
      ctx.restore();
    }
  }

  G.parts.forEach((p) => {
    const lt = p.life / p.max;
    if (p.type === "bubble") {
      ctx.strokeStyle = `rgba(180, 230, 235, ${0.4 * lt})`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 1.6 + (1 - lt) * 2.4, 0, TAU);
      ctx.stroke();
    } else if (p.type === "debris") {
      ctx.fillStyle = `rgba(255, 140, 110, ${0.7 * lt})`;
      ctx.fillRect(p.x - 2, p.y - 2, 4, 4);
    } else if (p.type === "shock") {
      ctx.strokeStyle = `rgba(255, 160, 120, ${0.7 * lt})`;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, TAU);
      ctx.stroke();
    }
  });

  G.snow.forEach((s) => {
    const d = dist(s.x, s.y, player.x, player.y);
    let lit = clamp(1 - d / 220, 0, 1) * 0.55;
    G.rings.forEach((r) => {
      const rd = dist(r.x, r.y, s.x, s.y);
      if (Math.abs(rd - r.r) < 60) lit = Math.max(lit, 0.4 * (1 - r.r / r.rmax));
    });
    if (lit < 0.02) return;
    ctx.fillStyle = `rgba(200, 225, 230, ${lit * 0.5})`;
    ctx.fillRect(s.x, s.y, 1.4 + s.z, 1.4 + s.z);
  });

  G.rings.forEach((r) => {
    if (r.r < 4) return;
    const lt = 1 - r.r / r.rmax;
    ctx.strokeStyle = r.beacon
      ? `rgba(255, 210, 140, ${0.3 * lt})`
      : r.quiet
        ? `rgba(150, 240, 225, ${0.34 * lt})`
        : `rgba(140, 235, 250, ${0.4 * lt})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let a2 = 0; a2 <= TAU + 0.01; a2 += TAU / 40) {
      const rr = r.r + Math.sin(a2 * 9 + G.t * 6) * 4;
      const px2 = r.x + Math.cos(a2) * rr;
      const py2 = r.y + Math.sin(a2) * rr;
      if (a2 === 0) ctx.moveTo(px2, py2);
      else ctx.lineTo(px2, py2);
    }
    ctx.stroke();
    ctx.strokeStyle = r.beacon
      ? `rgba(255, 210, 140, ${0.12 * lt})`
      : `rgba(140, 235, 250, ${0.14 * lt})`;
    ctx.lineWidth = 7;
    ctx.beginPath();
    ctx.arc(r.x, r.y, r.r, 0, TAU);
    ctx.stroke();
  });

  if (G.state === "play") {
    const tgt = currentTarget();
    const a = Math.atan2(tgt.y - player.y, tgt.x - player.x);
    const col = tgt.kind === "beacon" ? "255, 205, 130" : tgt.kind === "crystal" ? "130, 255, 215" : tgt.kind === "box" ? "255, 170, 100" : "190, 245, 255";
    ctx.save();
    ctx.translate(player.x + Math.cos(a) * 34, player.y + Math.sin(a) * 34);
    ctx.rotate(a);
    ctx.fillStyle = `rgba(${col}, 0.55)`;
    ctx.beginPath();
    ctx.moveTo(6, 0);
    ctx.lineTo(-4, -5);
    ctx.lineTo(-4, 5);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  drawPlayer();

  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  drawHud(dawn);
}

function drawPlayer() {
  const p = player;
  const inv = p.inv > 0 && Math.floor(G.t * 14) % 2 === 0;
  const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, 34);
  g.addColorStop(0, "rgba(120, 225, 235, 0.3)");
  g.addColorStop(1, "rgba(120, 225, 235, 0)");
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(p.x, p.y, 34, 0, TAU);
  ctx.fill();
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.rotate(p.ang);
  ctx.fillStyle = inv ? "rgba(255,120,120,0.9)" : "rgba(225, 250, 250, 0.95)";
  ctx.beginPath();
  ctx.ellipse(0, 0, 13, 6.5, 0, 0, TAU);
  ctx.fill();
  ctx.fillStyle = "rgba(110, 225, 235, 0.95)";
  ctx.beginPath();
  ctx.arc(5, 0, 3.4, 0, TAU);
  ctx.fill();
  ctx.fillStyle = "rgba(160, 200, 210, 0.8)";
  ctx.beginPath();
  ctx.moveTo(-10, 0);
  ctx.lineTo(-17, -4);
  ctx.lineTo(-17, 4);
  ctx.closePath();
  ctx.fill();
  if (p.anchor) {
    ctx.strokeStyle = "rgba(160, 240, 230, 0.5)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(0, 0, 18 + Math.sin(G.t * 8) * 2, 0, TAU);
    ctx.stroke();
  }
  if (G.chargeT >= 0) {
    const c = clamp(G.chargeT / 1.1, 0, 1);
    ctx.strokeStyle = `rgba(140, 240, 250, ${0.4 + 0.3 * c})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, 16, -Math.PI / 2, -Math.PI / 2 + TAU * c);
    ctx.stroke();
  }
  ctx.restore();
}

function drawHud(dawn) {
  ctx.font = "11px 'Avenir Next', sans-serif";
  for (let i = 0; i < 3; i++) {
    const x = 22 + i * 30;
    const fill = clamp(player.hull - i, 0, 1);
    ctx.strokeStyle = "rgba(150, 230, 220, 0.4)";
    ctx.lineWidth = 1;
    ctx.strokeRect(x, 20, 24, 8);
    if (fill > 0) {
      ctx.fillStyle = player.hull <= 1 ? "rgba(255, 110, 100, 0.85)" : "rgba(140, 235, 220, 0.85)";
      ctx.fillRect(x + 1, 21, 22 * fill, 6);
    }
  }
  ctx.textAlign = "center";
  const d = Math.max(0, Math.round(world.baseDepth + (player.y - world.spawn.y) * (world.depthK || 0.12)));
  ctx.fillStyle = dawn > 0.5 ? "rgba(70, 50, 40, 0.9)" : "rgba(120, 170, 165, 0.55)";
  ctx.fillText(`DEPTH ${d}M`, W / 2, 30);
  ctx.textAlign = "right";
  ctx.fillText(`CH. ${ROMAN[G.ch]}`, W - 22, 30);
}

function drawMenuBg() {
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  const g = ctx.createRadialGradient(W / 2, H * 0.55, 0, W / 2, H * 0.55, Math.max(W, H) * 0.8);
  g.addColorStop(0, "rgb(3, 10, 14)");
  g.addColorStop(1, "rgb(1, 2, 4)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  G.menuSnow.forEach((s) => {
    ctx.fillStyle = `rgba(170, 210, 215, ${0.1 + s.z * 0.12})`;
    ctx.fillRect(s.x, s.y, 1.2 + s.z, 1.2 + s.z);
  });
  G.menuRings.forEach((r) => {
    const lt = 1 - r.r / r.rmax;
    ctx.strokeStyle = `rgba(120, 220, 210, ${0.16 * lt})`;
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.arc(r.x, r.y, r.r, 0, TAU);
    ctx.stroke();
  });
}

function render() {
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  if (G.state === "title" || G.state === "intro" || G.state === "chapterIntro" || G.state === "end" || G.state === "ended") {
    drawMenuBg();
  } else if (world) {
    drawWorld();
  }
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  if (G.flash > 0) {
    const g = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.3, W / 2, H / 2, Math.max(W, H) * 0.7);
    g.addColorStop(0, "rgba(255, 40, 40, 0)");
    g.addColorStop(1, `rgba(255, 30, 30, ${0.55 * G.flash})`);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
  }
  const vig = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.42, W / 2, H / 2, Math.max(W, H) * 0.75);
  vig.addColorStop(0, "rgba(0, 0, 0, 0)");
  vig.addColorStop(1, "rgba(0, 0, 0, 0.5)");
  ctx.fillStyle = vig;
  ctx.fillRect(0, 0, W, H);
  if (G.fade > 0.001) {
    ctx.fillStyle = `rgba(1, 2, 4, ${G.fade})`;
    ctx.fillRect(0, 0, W, H);
  }
}

let lastFrame = 0;
function loop(ts) {
  let dt = (ts - lastFrame) / 1000;
  lastFrame = ts;
  if (window.__FORCE_DT) dt = window.__FORCE_DT;
  dt = clamp(dt, 0, 0.05);
  update(dt);
  render();
  requestAnimationFrame(loop);
}

showTitle();
requestAnimationFrame(loop);
