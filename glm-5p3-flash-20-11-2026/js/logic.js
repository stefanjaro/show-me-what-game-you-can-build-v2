"use strict";

function startPing(charge, quiet) {
  if (player.cd > 0) return;
  const raw = quiet ? 0.3 : 0.45 + 0.55 * charge;
  const loud = raw * (player.sponge ? 0.35 : 1);
  const rmax = quiet ? 250 : 280 + charge * 640;
  const v = 480 + charge * 300;
  G.rings.push({ id: ++G.ringId, x: player.x, y: player.y, r: 0, rmax, v, loud, quiet, charge });
  player.cd = quiet ? 0.4 : 0.4 + 0.4 * charge;
  G.pings++;
  AUD.ping(charge, quiet);
  noiseEvent(player.x, player.y, loud, "ping");
  if (!G.flags.pinged) {
    G.flags.pinged = true;
    if (G.ch === 0) queueHint("HOLD SPACE LONGER — SING LOUDER", 4);
  }
}

function noiseEvent(x, y, loud, src) {
  hunters.forEach((h) => {
    if (h.state === "dormant" || h.state === "stagger") return;
    const d = dist(x, y, h.x, h.y);
    const hearR = 850 * loud + 60;
    if (d < hearR) {
      if (d < 300 * loud + 70) {
        h.state = "chase";
        h.hot = 4.5;
        h.lastSeen = { x, y };
        if (Math.random() < 0.4) AUD.growl(clamp(1 - d / 900, 0.2, 1));
      } else if (h.state !== "chase") {
        h.state = "investigate";
        h.wp = { x: x + rand(-40, 40), y: y + rand(-40, 40) };
        h.path = null;
        h.scanT = 0;
      }
    }
  });
  if (lev && !G.flags.escort) {
    const d = dist(x, y, lev.x, lev.y);
    if (lev.mode === "throat") {
      if (lev.state !== "stun" && loud >= 0.5 && d < 1600) {
        lev.state = "lunge";
        lev.lungeTX = x;
        lev.lungeTY = y;
        lev.t = 0;
        AUD.moan("high");
      }
    } else if (lev.mode === "ascent" && loud > 0.5) {
      lev.surgeV = Math.min(lev.surgeV + 300, 380);
    }
  }
  boids.forEach((b) => {
    const d = dist(x, y, b.x, b.y);
    if (d < 900 * loud + 80) {
      b.agit = Math.min(1, b.agit + 0.5 + loud * 0.5);
      b.agx = x + rand(-50, 50);
      b.agy = y + rand(-50, 50);
    }
  });
}

function updateRings(dt) {
  for (let i = G.rings.length - 1; i >= 0; i--) {
    const ring = G.rings[i];
    const pr = ring.r;
    ring.r += ring.v * dt;
    const bw = ring.v * dt + 12;
    paintMaskRing(ring.x, ring.y, ring.r, bw, (1 - ring.r / ring.rmax) * 0.5 + 0.06);

    const cross = (ex, ey) => {
      const d = dist(ring.x, ring.y, ex, ey);
      return d <= ring.r + bw * 0.5 && d > pr - bw * 0.5 && d < ring.rmax;
    };

    crystals.forEach((c) => {
      const d = dist(ring.x, ring.y, c.x, c.y);
      if (cross(c.x, c.y)) c.rev = Math.max(c.rev, clamp(1.15 - (0.75 * d) / ring.rmax, 0, 1));
      if (ring.loud >= 0.35 && c.cd <= 0 && cross(c.x, c.y)) {
        c.cd = 1.1;
        c.flash = 1;
        AUD.chime(c.idx);
        paintMaskBlob(c.x, c.y, 130, 0.7);
        G.pending.push({ t: 0.18, x: c.x, y: c.y, rmax: 280, v: 520, loud: 0.5, quiet: false, charge: 0 });
        doors.forEach((d2) => {
          if (!d2.opening && d2.from.includes(c.idx) && d2.got < d2.need) {
            d2.got++;
            if (d2.got >= d2.need) {
              d2.opening = true;
              AUD.door();
              paintMaskBlob(d2.x + d2.w / 2, d2.y + d2.h / 2, 220, 0.9);
              if (d2.checkpoint) {
                checkpoint = { x: d2.checkpoint.x, y: d2.checkpoint.y };
                AUD.checkpoint();
              }
            }
          }
        });
      }
    });

    mines.forEach((mn) => {
      const d = dist(ring.x, ring.y, mn.x, mn.y);
      if (cross(mn.x, mn.y)) mn.rev = Math.max(mn.rev, clamp(1.15 - (0.75 * d) / ring.rmax, 0, 1));
      if (ring.loud >= 0.4 && !mn.spent && mn.fuse < 0 && cross(mn.x, mn.y)) mn.fuse = 0.9;
    });

    beacons.forEach((b) => {
      const d = dist(ring.x, ring.y, b.x, b.y);
      if (cross(b.x, b.y)) b.rev = Math.max(b.rev, clamp(1.2 - d / ring.rmax, 0, 1));
    });

    hunters.forEach((h) => {
      const d = dist(ring.x, ring.y, h.x, h.y);
      if (cross(h.x, h.y)) h.rev = Math.max(h.rev, clamp(1.15 - (0.75 * d) / ring.rmax, 0, 1));
      if (ring.charge > 0.85 && cross(h.x, h.y) && h.state !== "dormant") {
        h.state = "stagger";
        h.t = 1.1;
        h.vx *= -0.3; h.vy *= -0.3;
        AUD.thud(0.8);
      }
    });

    boids.forEach((b) => {
      const d = dist(ring.x, ring.y, b.x, b.y);
      if (cross(b.x, b.y)) b.rev = Math.max(b.rev, clamp(1.15 - (0.75 * d) / ring.rmax, 0, 1));
      if (ring.charge > 0.6 && cross(b.x, b.y)) {
        const dd = Math.max(1, d);
        b.vx += ((b.x - ring.x) / dd) * 400;
        b.vy += ((b.y - ring.y) / dd) * 400;
        b.agit = 0;
        b.stun = 1;
      }
    });

    if (lev) {
      const d = dist(ring.x, ring.y, lev.x, lev.y);
      if (cross(lev.x, lev.y)) lev.rev = Math.max(lev.rev, clamp(1.2 - d / ring.rmax, 0, 1));
    }

    if (box && !box.got) {
      const d = dist(ring.x, ring.y, box.x, box.y);
      if (cross(box.x, box.y)) {
        box.rev = Math.max(box.rev, clamp(1.2 - d / ring.rmax, 0, 1));
        if (box.rev > 0.1) box.seen = true;
      }
    }

    doors.forEach((d2) => {
      const d = dist(ring.x, ring.y, d2.x + d2.w / 2, d2.y + d2.h / 2);
      if (cross(d2.x + d2.w / 2, d2.y + d2.h / 2)) d2.rev = Math.max(d2.rev, clamp(1.2 - d / ring.rmax, 0, 1));
    });

    if (ring.r > ring.rmax) G.rings.splice(i, 1);
  }

  for (let i = G.pending.length - 1; i >= 0; i--) {
    const p = G.pending[i];
    p.t -= dt;
    if (p.t <= 0) {
      G.rings.push({ id: ++G.ringId, x: p.x, y: p.y, r: 0, rmax: p.rmax, v: p.v, loud: p.loud, quiet: p.quiet, charge: p.charge });
      G.pending.splice(i, 1);
    }
  }
}

function updatePlayer(dt) {
  const p = player;
  p.anchor = !!(keys.ShiftLeft || keys.ShiftRight);
  const ax = (keys.KeyA || keys.ArrowLeft ? -1 : 0) + (keys.KeyD || keys.ArrowRight ? 1 : 0);
  const ay = (keys.KeyW || keys.ArrowUp ? -1 : 0) + (keys.KeyS || keys.ArrowDown ? 1 : 0);
  const acc = p.anchor ? 140 : 520;
  if (ax || ay) {
    const l = Math.hypot(ax, ay);
    p.vx += (ax / l) * acc * dt;
    p.vy += (ay / l) * acc * dt;
    p.thrust = Math.min(1, p.thrust + dt * 4);
  } else {
    p.thrust = Math.max(0, p.thrust - dt * 3);
  }
  currents.forEach((c) => {
    if (p.x > c.x && p.x < c.x + c.w && p.y > c.y && p.y < c.y + c.h) {
      const k = p.anchor ? 0.22 : 1;
      p.vx += c.vx * k * dt;
      p.vy += c.vy * k * dt;
    }
  });
  surges.forEach((s) => {
    if (s.state === "active" && p.y > s.y0 - 40 && p.y < s.y1 + 40) {
      const k = p.anchor ? 0.1 : 1;
      p.vx += s.dx * 340 * k * dt;
      p.vy += 420 * k * dt;
    }
  });
  const drag = p.anchor ? 5.5 : 2.1;
  const dr = Math.exp(-drag * dt);
  p.vx *= dr;
  p.vy *= dr;
  p.x += p.vx * dt;
  p.y += p.vy * dt;
  const res = resolveCircle(p.x, p.y, p.r);
  if (res.hit) {
    p.x = res.x; p.y = res.y;
    const vn = p.vx * res.nx + p.vy * res.ny;
    if (vn < 0) {
      p.vx -= res.nx * vn;
      p.vy -= res.ny * vn;
    }
  }
  p.x = clamp(p.x, p.r, world.w - p.r);
  p.y = clamp(p.y, p.r, world.h - p.r);
  const spd = Math.hypot(p.vx, p.vy);
  if (spd > 24) p.ang = Math.atan2(p.vy, p.vx);
  p.inv = Math.max(0, p.inv - dt);
  p.cd = Math.max(0, p.cd - dt);
  p.sponge = 0;
  sponges.forEach((s) => {
    if (dist(p.x, p.y, s.x, s.y) < s.r) p.sponge = 1;
  });
  if (spd > 55) {
    G.moveNoiseT -= dt;
    if (G.moveNoiseT <= 0) {
      G.moveNoiseT = 0.13;
      noiseEvent(p.x, p.y, (0.08 + 0.3 * Math.min(1, spd / 240)) * (p.sponge ? 0.3 : 1), "move");
    }
    if (p.thrust > 0.4 && Math.random() < dt * 22) {
      G.parts.push({
        type: "bubble", x: p.x - Math.cos(p.ang) * 12, y: p.y - Math.sin(p.ang) * 12,
        vx: -p.vx * 0.2 + rand(-14, 14), vy: -p.vy * 0.2 + rand(-24, -8),
        life: rand(0.7, 1.4), max: 1.4,
      });
    }
  }
  beacons.forEach((b) => {
    if (!b.done && dist(p.x, p.y, b.x, b.y) < 70) {
      b.done = true;
      G.doneBeacons = G.doneBeacons || [];
      if (!G.doneBeacons.includes(b.idx)) G.doneBeacons.push(b.idx);
      checkpoint = { x: b.x, y: b.y };
      AUD.checkpoint();
      if (b.log) openLog(b.log);
      else queueHint("CHECKPOINT", 2);
    }
  });
  (world.checkpoints || []).forEach((cz) => {
    const key = "cp" + cz.x + "_" + cz.y;
    if (!G.flags[key] && dist(p.x, p.y, cz.x, cz.y) < 60) {
      G.flags[key] = true;
      checkpoint = { x: cz.x, y: cz.y };
      AUD.checkpoint();
      queueHint("CHECKPOINT", 2);
    }
  });
  if (box && !box.got && dist(p.x, p.y, box.x, box.y) < 44) {
    box.got = true;
    AUD.door();
    queueHint("RUN.", 3);
    hunters.forEach((h) => {
      if (h.wake === "box") {
        h.state = "chase";
        h.hot = 999;
        h.lastSeen = { x: p.x, y: p.y };
        AUD.growl(1);
        G.shake = 10;
        paintMaskBlob(h.x, h.y, 260, 0.8);
        h.rev = 1;
      }
    });
  }
  if (dist(p.x, p.y, exitZone.x, exitZone.y) < 60) {
    if (world.exitNeeds === "box" && (!box || !box.got)) return;
    if (G.ch === 4) startEndcut();
    else completeChapter();
    return;
  }
}

function damage(amount, sx, sy, knock) {
  if (player.inv > 0 || G.state !== "play") return;
  player.hull -= amount;
  player.inv = 1.7;
  const d = Math.max(1, dist(sx, sy, player.x, player.y));
  player.vx += ((player.x - sx) / d) * (knock || 300);
  player.vy += ((player.y - sy) / d) * (knock || 300);
  G.flash = 1;
  G.shake = 10;
  AUD.hurt();
  if (player.hull <= 0) die();
}

function die() {
  G.state = "dead";
  G.deaths++;
  G.deathT = 0;
  G.chargeT = -1;
  AUD.death();
  show("death");
}

function respawn() {
  hide("death");
  buildChapter(G.ch, { x: checkpoint.x, y: checkpoint.y });
  AUD.restoreEars();
  G.state = "play";
  AUD.setMusic(G.ch, 0);
}

function updateHunters(dt) {
  hunters.forEach((h) => {
    h.rev = Math.max(0, h.rev - 1.4 * dt);
    h.t += dt;
    h.growlT -= dt;
    if (h.state === "dormant") {
      if (box && box.got) {
        h.state = "chase";
        h.hot = 999;
        h.lastSeen = { x: player.x, y: player.y };
      }
      return;
    }
    if (h.state === "stagger") {
      h.t -= dt * 2;
      h.vx *= Math.exp(-3 * dt);
      h.vy *= Math.exp(-3 * dt);
      h.x += h.vx * dt;
      h.y += h.vy * dt;
      resolveCircle(h.x, h.y, h.r);
      if (h.t <= 0) { h.state = "investigate"; h.wp = { x: player.x, y: player.y }; h.path = null; }
      return;
    }
    const dPlayer = dist(h.x, h.y, player.x, player.y);
    const senseR = player.sponge ? 40 : 90;
    if (h.state === "chase" && dPlayer < senseR) h.hot = 4.5;
    h.hot -= dt;
    if (h.growlT <= 0) {
      h.growlT = rand(4, 8);
      if (h.state !== "idle") {
        AUD.growl(clamp(1 - dPlayer / 900, 0.15, 1));
        paintMaskBlob(h.x, h.y, 190, 0.55);
        h.rev = 1;
      }
    }
    let tx, ty, spd;
    if (h.state === "chase") {
      if (h.hot <= 0) {
        h.state = "investigate";
        h.wp = h.lastSeen || { x: player.x, y: player.y };
        h.path = null;
        h.scanT = 0;
      }
      tx = player.x; ty = player.y;
      spd = 188;
    } else if (h.state === "investigate") {
      if (!h.wp) h.state = "idle";
      tx = h.wp ? h.wp.x : h.x;
      ty = h.wp ? h.wp.y : h.y;
      spd = 108;
      if (h.wp && dist(h.x, h.y, tx, ty) < 46) {
        h.scanT += dt;
        spd = 0;
        if (h.scanT > 1.3) { h.state = "idle"; h.wp = null; }
      }
    } else {
      spd = 52;
      if (!h.wp || dist(h.x, h.y, h.wp.x, h.wp.y) < 40 || h.t > 6) {
        h.t = 0;
        const a = rand(0, TAU);
        const r = rand(120, 420);
        h.wp = {
          x: clamp(h.x + Math.cos(a) * r, 60, world.w - 60),
          y: clamp(h.y + Math.sin(a) * r, 60, world.h - 60),
        };
      }
      tx = h.wp.x; ty = h.wp.y;
    }
    if (h.backoff > 0) {
      h.backoff -= dt;
      h.vx *= Math.exp(-2.5 * dt);
      h.vy *= Math.exp(-2.5 * dt);
      h.x += h.vx * dt;
      h.y += h.vy * dt;
      resolveCircle(h.x, h.y, h.r);
      return;
    }
    if (spd > 0) {
      let dirx, diry;
      if (lineClear(h.x, h.y, tx, ty, 16)) {
        h.path = null;
        dirx = tx - h.x; diry = ty - h.y;
      } else {
        h.repathT -= dt;
        if (!h.path || h.repathT <= 0) {
          h.repathT = 0.55;
          h.path = bfsPath(h.x, h.y, tx, ty);
          h.pathI = 1;
        }
        if (h.path && h.pathI < h.path.length) {
          while (h.pathI < h.path.length - 1 && dist(h.x, h.y, h.path[h.pathI].x, h.path[h.pathI].y) < 34) h.pathI++;
          const nd = h.path[h.pathI];
          dirx = nd.x - h.x; diry = nd.y - h.y;
        } else {
          dirx = tx - h.x; diry = ty - h.y;
        }
      }
      const dl = Math.max(1, Math.hypot(dirx, diry));
      h.vx += (dirx / dl) * spd * 3.2 * dt;
      h.vy += (diry / dl) * spd * 3.2 * dt;
      const hv = Math.hypot(h.vx, h.vy);
      const mx = spd * (h.state === "chase" && dPlayer < 200 ? 1.15 : 1);
      if (hv > mx) {
        h.vx = (h.vx / hv) * mx;
        h.vy = (h.vy / hv) * mx;
      }
    } else {
      h.vx *= Math.exp(-3 * dt);
      h.vy *= Math.exp(-3 * dt);
    }
    h.x += h.vx * dt;
    h.y += h.vy * dt;
    const res = resolveCircle(h.x, h.y, h.r);
    h.x = res.x; h.y = res.y;
    const hv2 = Math.hypot(h.vx, h.vy);
    if (res.hit && hv2 > 130 && h.state === "chase") {
      AUD.thud(0.7);
      G.shake = Math.max(G.shake, 5);
      h.vx *= -0.4; h.vy *= -0.4;
    }
    if (hv2 > 8) h.ang = angLerp(h.ang, Math.atan2(h.vy, h.vx), 8 * dt);
    h.wag += dt * (h.state === "chase" ? 14 : 6);
    if (dPlayer < h.r + player.r + 2) {
      damage(1, h.x, h.y, 340);
      h.backoff = 1.5;
      h.vx = -Math.cos(h.ang) * 200;
      h.vy = -Math.sin(h.ang) * 200;
    }
  });
}

function updateBoids(dt) {
  boids.forEach((b) => {
    b.rev = Math.max(0, b.rev - 1.4 * dt);
    b.cd -= dt;
    b.ph += dt * 8;
    b.stun = Math.max(0, b.stun - dt);
    b.agit = Math.max(0, b.agit - 0.22 * dt);
    b.waT -= dt;
    if (b.waT <= 0) {
      b.waT = rand(1, 3);
      b.wa = rand(0, TAU);
    }
    let tx, ty;
    if (b.agit > 0.1 && !b.stun) {
      tx = b.agx; ty = b.agy;
    } else {
      tx = b.hx + Math.cos(b.wa) * 70;
      ty = b.hy + Math.sin(b.wa) * 70;
    }
    const spd = b.stun > 0 ? 20 : 60 + b.agit * 105;
    const dx = tx - b.x, dy = ty - b.y;
    const dl = Math.max(1, Math.hypot(dx, dy));
    b.vx += (dx / dl) * spd * 2.6 * dt;
    b.vy += (dy / dl) * spd * 2.6 * dt;
    let sx = 0, sy = 0;
    for (let i = 0; i < boids.length; i++) {
      const o = boids[i];
      if (o === b) continue;
      const dd = dist(b.x, b.y, o.x, o.y);
      if (dd < 26 && dd > 0.001) {
        sx += (b.x - o.x) / dd;
        sy += (b.y - o.y) / dd;
      }
    }
    b.vx += sx * 60 * dt;
    b.vy += sy * 60 * dt;
    if (b.agit > 0.3 && Math.random() < dt * 0.8) {
      AUD.click(b.agit);
      b.rev = Math.max(b.rev, 0.7);
      paintMaskBlob(b.x, b.y, 60, 0.4);
    }
    const v = Math.hypot(b.vx, b.vy);
    const mx = 200 + spd;
    if (v > mx) {
      b.vx = (b.vx / v) * mx;
      b.vy = (b.vy / v) * mx;
    }
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    const res = resolveCircle(b.x, b.y, 5);
    b.x = clamp(res.x, 10, world.w - 10);
    b.y = clamp(res.y, 10, world.h - 10);
    if (b.cd <= 0 && player.inv <= 0 && dist(b.x, b.y, player.x, player.y) < player.r + 7) {
      b.cd = 2.6;
      damage(0.5, b.x, b.y, 180);
    }
  });
}

function updateMines(dt) {
  mines.forEach((mn) => {
    mn.rev = Math.max(0, mn.rev - 1.1 * dt);
    mn.blink += dt * (mn.fuse > 0 ? 26 : 2.4);
    if (mn.fuse > 0) {
      mn.fuse -= dt;
      if (mn.fuse <= 0 && !mn.spent) {
        mn.spent = true;
        mn.fuse = -1;
        AUD.explode();
        G.shake = 14;
        paintMaskBlob(mn.x, mn.y, 260, 1);
        noiseEvent(mn.x, mn.y, 1, "explosion");
        G.parts.push({ type: "shock", x: mn.x, y: mn.y, r: 10, life: 0.6, max: 0.6 });
        for (let k = 0; k < 14; k++) {
          const a = rand(0, TAU);
          G.parts.push({
            type: "debris", x: mn.x, y: mn.y,
            vx: Math.cos(a) * rand(60, 220), vy: Math.sin(a) * rand(60, 220),
            life: rand(0.5, 1.1), max: 1.1,
          });
        }
        if (dist(player.x, player.y, mn.x, mn.y) < 95) damage(1, mn.x, mn.y, 380);
        hunters.forEach((h) => {
          if (dist(h.x, h.y, mn.x, mn.y) < 150) {
            h.state = "stagger";
            h.t = 1.2;
          }
        });
        boids.forEach((b) => {
          if (dist(b.x, b.y, mn.x, mn.y) < 130) {
            b.agit = 0;
            b.stun = 1.4;
            const d = Math.max(1, dist(b.x, b.y, mn.x, mn.y));
            b.vx += ((b.x - mn.x) / d) * 320;
            b.vy += ((b.y - mn.y) / d) * 320;
          }
        });
      }
    }
  });
}

function updateDoors(dt) {
  doors.forEach((d) => {
    d.rev = Math.max(0, d.rev - 0.8 * dt);
    if (d.opening && d.open < 1) {
      d.open = Math.min(1, d.open + dt / 0.8);
    }
  });
}

function updateCrystals(dt) {
  crystals.forEach((c) => {
    c.cd = Math.max(0, c.cd - dt);
    c.rev = Math.max(0, c.rev - 0.55 * dt);
    c.flash = Math.max(0, c.flash - 2 * dt);
    c.rot += dt * 0.5;
  });
}

function updateBeacons(dt) {
  beacons.forEach((b) => {
    b.t += dt;
    b.pt -= dt;
    b.rev = Math.max(0.4, b.rev - 0.4 * dt);
    if (b.pt <= 0) {
      b.pt = 4.2;
      G.rings.push({ id: ++G.ringId, x: b.x, y: b.y, r: 0, rmax: 230, v: 420, loud: 0.1, quiet: true, charge: 0, beacon: true });
      AUD.chime(Math.floor(rand(0, 5)), true);
    }
  });
}

function updateLev(dt) {
  if (!lev) return;
  lev.rev = Math.max(0, lev.rev - 1.2 * dt);
  lev.spotPh += dt * 2;
  if (G.flags.escort) {
    const tx = player.x + 170;
    const ty = player.y - 30;
    lev.ang = Math.atan2(ty - lev.y, tx - lev.x);
    lev.x += (tx - lev.x) * dt * 1.4;
    lev.y += (ty - lev.y) * dt * 1.4;
    followBody(dt);
    return;
  }
  if (lev.mode === "throat") {
    if (lev.state === "stun") {
      lev.stunT -= dt;
      if (lev.stunT <= 0) lev.state = "patrol";
      followBody(dt);
      return;
    }
    if (lev.state === "lunge") {
      lev.t += dt;
      const dl = Math.max(1, dist(lev.x, lev.y, lev.lungeTX, lev.lungeTY));
      lev.ang = Math.atan2(lev.lungeTY - lev.y, lev.lungeTX - lev.x);
      lev.x += Math.cos(lev.ang) * 520 * dt;
      lev.y += Math.sin(lev.ang) * 520 * dt;
      lev.rev = 1;
      const res = resolveCircle(lev.x, lev.y, 46);
      if (res.hit) {
        lev.state = "stun";
        lev.stunT = 5.5;
        lev.x = res.x; lev.y = res.y;
        AUD.thud(1.3);
        AUD.moan("low");
        G.shake = 16;
        paintMaskBlob(lev.x, lev.y, 420, 0.9);
      } else if (dl < 90 || lev.t > 2.6) {
        lev.state = "survey";
        lev.t = 2.4;
      }
      if (dist(lev.x, lev.y, player.x, player.y) < 64) damage(1.5, lev.x, lev.y, 420);
      followBody(dt);
      return;
    }
    if (lev.state === "survey") {
      lev.t -= dt;
      if (lev.t <= 0) lev.state = "patrol";
      followBody(dt);
      if (dist(lev.x, lev.y, player.x, player.y) < 64) damage(1.5, lev.x, lev.y, 420);
      return;
    }
    const wp = lev.waypoints[lev.wpi];
    const dl = dist(lev.x, lev.y, wp[0], wp[1]);
    if (dl < 60) lev.wpi = (lev.wpi + 1) % lev.waypoints.length;
    const dirx = wp[0] - lev.x, diry = wp[1] - lev.y;
    const l = Math.max(1, Math.hypot(dirx, diry));
    lev.ang = Math.atan2(diry, dirx);
    lev.x += (dirx / l) * 105 * dt;
    lev.y += (diry / l) * 105 * dt;
    followBody(dt);
    if (dist(lev.x, lev.y, player.x, player.y) < 64) damage(1.5, lev.x, lev.y, 420);
    lev.segs.forEach((s) => {
      if (dist(s.x, s.y, player.x, player.y) < 42) damage(0.75, s.x, s.y, 320);
    });
  } else if (lev.mode === "ascent") {
    if (!G.flags.escort && player.y < world.h * 0.3) {
      G.flags.escort = true;
      lev.state = "escort";
      if (!lev.motifPlayed) {
        lev.motifPlayed = true;
        AUD.motif();
        queueHint("IT SINGS WITH THEM", 4);
      }
    }
    if (lev.pauseT > 0) {
      lev.pauseT -= dt;
    } else {
      lev.surgeV = Math.max(0, lev.surgeV - 140 * dt);
      const tx = player.x, ty = player.y + 250;
      const dl = Math.max(1, dist(lev.x, lev.y, tx, ty));
      const sp = 60 + lev.surgeV;
      lev.ang = Math.atan2(ty - lev.y, tx - lev.x);
      lev.x += ((tx - lev.x) / dl) * sp * 0.7 * dt;
      lev.y += ((ty - lev.y) / dl) * sp * dt;
    }
    followBody(dt);
    if (dist(lev.x, lev.y, player.x, player.y) < 64) {
      damage(1.2, lev.x, lev.y, 460);
      lev.pauseT = 2.4;
    }
  }
}

function followBody(dt) {
  const segs = lev.segs;
  let px = lev.x, py = lev.y;
  for (let i = 0; i < segs.length; i++) {
    const s = segs[i];
    const dx = s.x - px, dy = s.y - py;
    const d = Math.hypot(dx, dy);
    if (d > 34) {
      const k = (d - 34) / d;
      s.x -= dx * k;
      s.y -= dy * k;
    }
    px = s.x; py = s.y;
  }
}

function updateSurges(dt) {
  surges.forEach((s) => {
    s.t -= dt;
    if (s.state === "idle" && s.t <= 0) {
      s.state = "warn";
      s.t = 0.9;
      s.dx = Math.random() < 0.5 ? -1 : 1;
      AUD.warnSurge();
      if (!G.flags.surgeHint) {
        G.flags.surgeHint = true;
        queueHint("SURGE — HOLD SHIFT TO ANCHOR", 3);
      }
    } else if (s.state === "warn" && s.t <= 0) {
      s.state = "active";
      s.t = 1.6;
      G.shake = Math.max(G.shake, 6);
    } else if (s.state === "active" && s.t <= 0) {
      s.state = "cool";
      s.t = rand(3.5, 6);
    } else if (s.state === "cool" && s.t <= 0) {
      s.state = "idle";
      s.t = rand(1, 3);
    }
  });
}

function updateParts(dt) {
  for (let i = G.parts.length - 1; i >= 0; i--) {
    const p = G.parts[i];
    p.life -= dt;
    if (p.type === "shock") {
      p.r += 900 * dt;
    } else {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      if (p.type === "bubble") p.vy -= 30 * dt;
      if (p.type === "debris") {
        p.vx *= Math.exp(-2 * dt);
        p.vy *= Math.exp(-2 * dt);
      }
    }
    if (p.life <= 0) G.parts.splice(i, 1);
  }
  G.snow.forEach((s) => {
    s.y += (4 + s.z * 7) * dt;
    s.x += Math.sin(G.t * 0.4 + s.ph) * 4 * dt;
    if (s.y > world.h + 100) { s.y = -100; s.x = rand(-100, world.w + 100); }
  });
}

function queueHint(text, dur) {
  G.hints.push({ text, dur: dur || 3.5 });
}

function updateHints(dt) {
  if (G.hintT > 0) {
    G.hintT -= dt;
    if (G.hintT <= 0) qs("hint").classList.remove("show");
  } else if (G.hints.length) {
    const h = G.hints.shift();
    qs("hint").textContent = h.text;
    qs("hint").classList.add("show");
    G.hintT = h.dur;
  }
}

function currentTarget() {
  const b = beacons.find((bb) => !bb.done);
  if (b) return { x: b.x, y: b.y, kind: "beacon" };
  if (box && !box.got) return { x: box.x, y: box.y, kind: "box" };
  const locked = doors.filter((d) => !d.opening);
  if (locked.length) {
    let bestC = null, bestD = 1e9;
    crystals.forEach((c) => {
      const need = locked.some((d) => d.from.includes(c.idx));
      if (!need) return;
      const d = dist(player.x, player.y, c.x, c.y);
      if (d < bestD) { bestD = d; bestC = c; }
    });
    if (bestC) return { x: bestC.x, y: bestC.y, kind: "crystal" };
  }
  return { x: exitZone.x, y: exitZone.y, kind: "exit" };
}

function updatePlay(dt) {
  G.playTime += dt;
  updatePlayer(dt);
  if (G.state !== "play") return;
  updateHunters(dt);
  updateBoids(dt);
  updateMines(dt);
  updateDoors(dt);
  updateCrystals(dt);
  updateBeacons(dt);
  updateLev(dt);
  updateSurges(dt);
  updateRings(dt);
  updateParts(dt);
  updateHints(dt);

  let target = 0;
  hunters.forEach((h) => {
    if (h.state === "dormant") return;
    const d = dist(h.x, h.y, player.x, player.y);
    const v = clamp(1 - d / 650, 0, 1);
    if (h.state === "chase") target = Math.max(target, Math.max(0.45, v));
    else target = Math.max(target, v * 0.6);
  });
  if (lev && !G.flags.escort) {
    const d = dist(lev.x, lev.y, player.x, player.y);
    const v = clamp(1 - d / 900, 0, 1);
    target = Math.max(target, lev.state === "lunge" ? Math.max(0.6, v) : v * 0.7);
  }
  G.danger += (target - G.danger) * Math.min(1, dt * 2.5);
  AUD.setMusic(G.ch, G.danger);
  if (G.danger > 0.3) {
    G.heartT -= dt;
    if (G.heartT <= 0) {
      AUD.heart(clamp(G.danger, 0, 1));
      G.heartT = 1.15 - 0.55 * G.danger;
    }
  }
  G.shake = Math.max(0, G.shake - 26 * dt);
  G.flash = Math.max(0, G.flash - 2.2 * dt);
}

function startEndcut() {
  G.state = "endcut";
  G.endT = 0;
  AUD.setMusic(4, 0.15);
  hideAll();
}

function completeChapter() {
  if (G.flags.done) return;
  G.flags.done = true;
  G.best = Math.max(G.best, G.ch + 1);
  saveBest(G.best);
  fadeTo(() => {
    startChapter(G.ch + 1);
  });
}

function startChapter(i) {
  G.ch = i;
  buildChapter(i);
  G.state = "chapterIntro";
  hideAll();
  setText("ch-num", CHAPTERS[i].num);
  setText("ch-name", CHAPTERS[i].name);
  setText("ch-sub", CHAPTERS[i].sub);
  show("chapter");
  G.fade = 1;
  G.fadeTarget = 0;
  G.fadeCb = null;
}

function beginPlay() {
  hideAll();
  G.state = "play";
  AUD.setMusic(G.ch, 0);
  const startHints = [
    "W A S D — DRIFT",
    "SPACE — SING INTO THE DARK",
    "THEY ARE BLIND. THEY LISTEN.",
    "SPONGE FIELDS SWALLOW YOUR SOUND",
    "IT HEARS EVERYTHING. LET THE STONE HEAR IT FIRST.",
    "CLIMB. SPEND YOUR VOICE WISELY.",
  ];
  queueHint(startHints[G.ch], 4.5);
}

function clearTimers() {
  G.timers.forEach(clearTimeout);
  G.timers = [];
  if (G.typer) { clearInterval(G.typer); G.typer = null; }
}

function showTitle() {
  G.state = "title";
  hideAll();
  show("title");
  const press = qs("title-press");
  const foot = qs("title-continue");
  if (G.best > 0 && G.best < 5) {
    press.textContent = "press any key — resume chapter " + ROMAN[G.best];
    foot.textContent = "N — start over from day one";
  } else if (G.best >= 5) {
    press.textContent = "press any key — dive again";
    foot.textContent = "N — start over from day one";
  } else {
    press.textContent = "press any key to dive";
    foot.textContent = "wear headphones. the dark is listening.";
  }
  AUD.setMusic(-1, 0);
}

function titleKey(code) {
  if (code === "KeyN") {
    G.best = 0;
    saveBest(0);
    showIntro();
    return;
  }
  if (G.best > 0) {
    startChapter(Math.min(G.best, 4));
  } else {
    showIntro();
  }
}

function showIntro() {
  G.state = "intro";
  hideAll();
  show("intro");
  const panel = qs("intro-lines");
  panel.innerHTML = "";
  hide("intro-press");
  const lines = STORY.intro;
  lines.forEach((ln, i) => {
    const p = document.createElement("p");
    p.className = "intro-line";
    p.textContent = ln;
    panel.appendChild(p);
    G.timers.push(setTimeout(() => {
      p.classList.add("show");
      AUD.blip(i);
      if (i === lines.length - 1) {
        G.timers.push(setTimeout(() => show("intro-press"), 1200));
      }
    }, 500 + i * 1500));
  });
}

function introKey() {
  const all = qs("intro-lines").children;
  if (all.length && !all[all.length - 1].classList.contains("show")) {
    clearTimers();
    Array.from(all).forEach((p) => p.classList.add("show"));
    show("intro-press");
  } else {
    clearTimers();
    startChapter(0);
  }
}

function openLog(n) {
  G.state = "log";
  G.chargeT = -1;
  G.currentLog = n;
  const data = STORY.logs[n];
  hideAll();
  show("log");
  setText("log-speaker", data.speaker);
  const el = qs("log-text");
  el.classList.remove("done");
  el.textContent = "";
  hide("log-press");
  let i = 0;
  G.typer = setInterval(() => {
    if (i >= data.text.length) {
      clearInterval(G.typer);
      G.typer = null;
      el.classList.add("done");
      show("log-press");
      return;
    }
    el.textContent += data.text[i];
    if (i % 3 === 0) AUD.blip(i);
    i++;
  }, 34);
}

function logKey() {
  const el = qs("log-text");
  const data = STORY.logs[G.currentLog];
  if (!el.classList.contains("done")) {
    clearTimers();
    el.textContent = data.text;
    el.classList.add("done");
    show("log-press");
  } else {
    clearTimers();
    hide("log");
    G.state = "play";
  }
}

function showEnd() {
  G.state = "end";
  hideAll();
  show("end");
  const panel = qs("end-lines");
  panel.innerHTML = "";
  qs("end-stats").textContent = "";
  hide("end-press");
  const mm = Math.floor(G.playTime / 60);
  const ss = String(Math.floor(G.playTime % 60)).padStart(2, "0");
  const stats = `listened ${mm}:${ss} · sang ${G.pings} songs · caught ${G.deaths} time${G.deaths === 1 ? "" : "s"}`;
  STORY.epilogue.forEach((ln, i) => {
    const p = document.createElement("p");
    p.className = "end-line" + (i === 4 ? " big" : "");
    p.textContent = ln;
    panel.appendChild(p);
    G.timers.push(setTimeout(() => {
      p.classList.add("show");
      AUD.blip(i);
    }, 400 + i * 1700));
  });
  G.timers.push(setTimeout(() => {
    qs("end-stats").textContent = stats;
    AUD.motif();
  }, 400 + STORY.epilogue.length * 1700));
  G.timers.push(setTimeout(() => show("end-press"), 400 + (STORY.epilogue.length + 1) * 1700));
}

function endKey(code) {
  if (code === "KeyR") {
    clearTimers();
    G.playTime = 0;
    G.pings = 0;
    G.deaths = 0;
    showTitle();
  }
}

function pressAdvance(code) {
  return code === "Space" || code === "Enter";
}

handlers.down.push((code) => {
  if (G.state === "title") {
    titleKey(code);
  } else if (G.state === "intro") {
    if (pressAdvance(code)) introKey();
  } else if (G.state === "chapterIntro") {
    if (pressAdvance(code)) beginPlay();
  } else if (G.state === "log") {
    if (pressAdvance(code)) logKey();
  } else if (G.state === "play") {
    if (code === "KeyP" || code === "Escape") {
      G.state = "pause";
      G.chargeT = -1;
      show("pause");
      return;
    }
    if (code === "KeyM") {
      AUD.setMute(!AUD.muted);
      return;
    }
    if (code === "KeyR") {
      buildChapter(G.ch);
      AUD.setMusic(G.ch, 0);
      return;
    }
    if (code === "Space" || code === "PointerDown") {
      G.chargeT = 0;
    }
  } else if (G.state === "pause") {
    if (code === "KeyP" || code === "Escape") {
      G.state = "play";
      hide("pause");
    } else if (code === "KeyM") {
      AUD.setMute(!AUD.muted);
    } else if (code === "KeyR") {
      buildChapter(G.ch);
      hide("pause");
      G.state = "play";
      AUD.setMusic(G.ch, 0);
    }
  } else if (G.state === "end") {
    endKey(code);
  }
});

handlers.up.push((code) => {
  if (G.state === "play" && (code === "Space" || code === "PointerUp")) {
    if (G.chargeT >= 0) {
      const quiet = !!(keys.ShiftLeft || keys.ShiftRight);
      startPing(clamp(G.chargeT / 1.1, 0, 1), quiet);
      G.chargeT = -1;
    }
  }
});

document.addEventListener("visibilitychange", () => {
  if (document.hidden && G.state === "play") {
    G.state = "pause";
    G.chargeT = -1;
    show("pause");
  }
});

function update(dt) {
  G.t += dt;
  G.dt = dt;
  AUD.tick();
  if (G.state === "play") {
    if (G.chargeT >= 0) G.chargeT += dt;
    updatePlay(dt);
    if (G.state === "play" || G.state === "log") {
      const cx = camTargetX(player.x + player.vx * 0.25);
      const cy = camTargetY(player.y + player.vy * 0.25);
      G.cam.x = lerp(G.cam.x, cx, Math.min(1, dt * 4));
      G.cam.y = lerp(G.cam.y, cy, Math.min(1, dt * 4));
    }
  } else if (G.state === "log") {
    updateBeacons(dt);
    updateRings(dt);
    updateParts(dt);
    updateHints(dt);
  } else if (G.state === "dead") {
    G.deathT += dt;
    updateParts(dt);
    if (G.deathT > 2.1) respawn();
  } else if (G.state === "endcut") {
    G.endT += dt;
    G.playTime += dt;
    player.vy = lerp(player.vy, -46, dt);
    player.vx *= Math.exp(-2 * dt);
    player.x += player.vx * dt;
    player.y += player.vy * dt;
    updateParts(dt);
    updateRings(dt);
    if (lev) {
      G.flags.escort = true;
      updateLev(dt);
    }
    if (G.endT > 3.2) {
      G.state = "ended";
      showEnd();
    }
  } else if (G.state === "ended") {
    updateParts(dt);
  }
  if (G.fadeTarget === 1) {
    G.fade = Math.min(1, G.fade + dt * 1.6);
    if (G.fade >= 1 && G.fadeCb) {
      const cb = G.fadeCb;
      G.fadeCb = null;
      G.fadeTarget = 0;
      cb();
    }
  } else {
    G.fade = Math.max(0, G.fade - dt * 1.4);
  }
  if (G.state === "title" || G.state === "chapterIntro" || G.state === "intro" || G.state === "end" || G.state === "ended") {
    G.ghostT -= dt;
    if (G.ghostT <= 0) {
      G.ghostT = rand(1.6, 3);
      G.menuRings.push({
        x: rand(W * 0.2, W * 0.8), y: rand(H * 0.25, H * 0.75),
        r: 0, rmax: rand(220, 460), v: rand(220, 340),
      });
    }
    G.menuRings.forEach((r) => { r.r += r.v * dt; });
    G.menuRings = G.menuRings.filter((r) => r.r < r.rmax);
    while (G.menuSnow.length < 110) {
      G.menuSnow.push({ x: rand(0, W), y: rand(0, H), z: rand(0.3, 1), ph: rand(0, TAU) });
    }
    G.menuSnow.forEach((s) => {
      s.y += (3 + s.z * 6) * dt;
      s.x += Math.sin(G.t * 0.5 + s.ph) * 3 * dt;
      if (s.y > H + 10) { s.y = -10; s.x = rand(0, W); }
    });
  }
}
