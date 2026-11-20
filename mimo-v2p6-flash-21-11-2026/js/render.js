/* VIGIL — canvas renderer. All visuals; no game rules. */
window.Vigil = window.Vigil || {};
(function (V) {
  'use strict';

  var W = V.W, H = V.H, LAMP = V.LAMP, ROCKS = V.ROCKS, BUOYS = V.BUOYS;
  var HORIZON = V.HORIZON;
  var SERIF = '"Iowan Old Style", Palatino, "Palatino Linotype", Georgia, serif';

  var LAND_L = [[0, 640], [200, 654], [340, 672], [455, 656], [520, 700], [565, 780]];
  var LAND_R = [[1280, 640], [1080, 654], [940, 672], [825, 656], [760, 700], [715, 780]];

  function landTop(pts, x) {
    if (x < pts[0][0] || x > pts[pts.length - 1][0]) return Infinity;
    for (var i = 0; i < pts.length - 1; i++) {
      var a = pts[i], b = pts[i + 1];
      var x0 = Math.min(a[0], b[0]), x1 = Math.max(a[0], b[0]);
      if (x >= x0 && x <= x1) {
        var t = (b[0] - a[0]) === 0 ? 0 : (x - a[0]) / (b[0] - a[0]);
        return a[1] + (b[1] - a[1]) * t;
      }
    }
    return Infinity;
  }
  V.landTop = function (x) {
    return Math.min(landTop(LAND_L, x), landTop(LAND_R, x));
  };

  function conePath(ctx, cx, cy, ang, half, range) {
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, range, ang - half, ang + half);
    ctx.closePath();
  }

  function punchWedge(b, lx, ly, cx, cy, r, range) {
    var w = V.shadowWedge(lx, ly, cx, cy, r);
    if (!w) return;
    var d = V.dist(lx, ly, cx, cy);
    var tl = Math.sqrt(Math.max(d * d - r * r, 1));
    b.moveTo(lx + Math.cos(w.a1) * tl, ly + Math.sin(w.a1) * tl);
    b.lineTo(lx + Math.cos(w.a1) * range, ly + Math.sin(w.a1) * range);
    b.lineTo(lx + Math.cos(w.a2) * range, ly + Math.sin(w.a2) * range);
    b.lineTo(lx + Math.cos(w.a2) * tl, ly + Math.sin(w.a2) * tl);
    b.closePath();
    b.fill();
  }

  function impactPoint(x1, y1, x2, y2, cx, cy, r) {
    var lo = 0, hi = 1, i;
    var inside = function (t) {
      var x = x1 + (x2 - x1) * t, y = y1 + (y2 - y1) * t;
      return V.dist2(x, y, cx, cy) <= r * r;
    };
    if (!inside(1)) return null;
    for (i = 0; i < 18; i++) {
      var mid = (lo + hi) / 2;
      if (inside(mid)) hi = mid; else lo = mid;
    }
    return { x: x1 + (x2 - x1) * hi, y: y1 + (y2 - y1) * hi };
  }

  function Renderer(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.time = 0;

    this.beamC = document.createElement('canvas');
    this.beamC.width = W; this.beamC.height = H;
    this.bctx = this.beamC.getContext('2d');

    this.bloomC = document.createElement('canvas');
    this.bloomC.width = 320; this.bloomC.height = 180;
    this.bloomCtx = this.bloomC.getContext('2d');

    this.fogC = document.createElement('canvas');
    this.fogC.width = W; this.fogC.height = H;
    this.fctx = this.fogC.getContext('2d');

    var rng = V.mulberry32(20261120);
    this.stars = [];
    for (var i = 0; i < 150; i++) {
      this.stars.push({
        x: rng() * W, y: rng() * (HORIZON - 6), r: 0.5 + rng() * 1.4,
        ph: rng() * 6.28, sp: 0.6 + rng() * 2.2, big: rng() > 0.94
      });
    }
    this.clouds = [];
    for (i = 0; i < 9; i++) {
      this.clouds.push({
        x: rng() * W, y: 14 + rng() * 96, sx: 60 + rng() * 130, sy: 16 + rng() * 26,
        v: 3 + rng() * 7, a: 0.16 + rng() * 0.22, seed: rng() * 10
      });
    }
    this.motes = [];
    for (i = 0; i < 54; i++) {
      this.motes.push({
        x: rng() * W, y: HORIZON + rng() * (H - HORIZON),
        vx: V.rand(-6, 6), vy: V.rand(-5, 4), r: 0.7 + rng() * 1.7, ph: rng() * 6.28
      });
    }
    this.rockShapes = ROCKS.map(function (rk, idx) {
      var rr = V.mulberry32(500 + idx * 37);
      var pts = [], n = 11;
      for (var k = 0; k < n; k++) {
        pts.push({ a: (k / n) * V.TAU, r: rk.r * (0.84 + rr() * 0.3) });
      }
      return pts;
    });

    this.grainC = document.createElement('canvas');
    this.grainC.width = 128; this.grainC.height = 128;
    var g = this.grainC.getContext('2d');
    var img = g.createImageData(128, 128);
    for (i = 0; i < img.data.length; i += 4) {
      var v = (Math.random() * 255) | 0;
      img.data[i] = v; img.data[i + 1] = v; img.data[i + 2] = v;
      img.data[i + 3] = 34;
    }
    g.putImageData(img, 0, 0);
    this.grainPat = this.ctx.createPattern(this.grainC, 'repeat');

    var vg = this.ctx.createRadialGradient(W / 2, H / 2, H * 0.42, W / 2, H / 2, H * 0.95);
    vg.addColorStop(0, 'rgba(0,0,0,0)');
    vg.addColorStop(1, 'rgba(0,0,0,0.62)');
    this.vignette = vg;
  }

  /* ================= main draw ================= */
  Renderer.prototype.draw = function (sim, dt) {
    if (dt === undefined) dt = 0.016;
    this.time += dt;
    var ctx = this.ctx;
    var sh = sim.shake;
    var ox = sh > 0.2 ? V.rand(-sh, sh) : 0;
    var oy = sh > 0.2 ? V.rand(-sh, sh) : 0;

    ctx.save();
    ctx.translate(ox, oy);

    this.drawSky(sim, dt);
    this.drawSea(sim);
    this.drawLand(sim);
    this.drawRocks(sim);
    this.drawBuoys(sim);
    this.drawWrecks(sim);
    this.drawGhosts(sim);
    this.drawShips(sim);
    this.drawMonsters(sim);
    this.drawBoss(sim);
    this.drawFog(sim);
    this.buildBeam(sim);
    this.compositeBeam(sim);
    this.drawLantern(sim);
    this.drawMotes(sim, dt);
    this.drawParticles(sim);
    this.drawDawn(sim);
    this.drawPost(sim);

    ctx.restore();

    if (sim.mode !== 'title' && sim.mode !== 'ending') this.drawHUD(sim);
  };

  /* ================= sky ================= */
  Renderer.prototype.drawSky = function (sim, dt) {
    var ctx = this.ctx;
    var d = sim.dawnT || 0;
    var stormy = sim.chapterData && sim.chapterData.weather.rain ? 1 : 0;
    var i;

    var topN = stormy ? '#05070e' : '#05070f';
    var horN = stormy ? '#131c2c' : '#182641';

    var g = ctx.createLinearGradient(0, 0, 0, HORIZON + 8);
    g.addColorStop(0, topN);
    g.addColorStop(1, horN);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, HORIZON + 8);
    if (d > 0) {
      var g2 = ctx.createLinearGradient(0, 0, 0, HORIZON + 8);
      g2.addColorStop(0, '#3a4a72');
      g2.addColorStop(0.55, '#8a5f6a');
      g2.addColorStop(1, '#f0a860');
      ctx.globalAlpha = d;
      ctx.fillStyle = g2;
      ctx.fillRect(0, 0, W, HORIZON + 8);
      ctx.globalAlpha = 1;
    }

    var starA = (1 - d) * (stormy ? 0.5 : 1);
    if (starA > 0.02) {
      ctx.save();
      for (i = 0; i < this.stars.length; i++) {
        var s = this.stars[i];
        var tw = 0.45 + 0.55 * (0.5 + 0.5 * Math.sin(this.time * s.sp + s.ph));
        var a = starA * tw;
        if (s.big) {
          ctx.globalAlpha = a * 0.9;
          ctx.fillStyle = '#dfe9ff';
          ctx.beginPath(); ctx.arc(s.x, s.y, s.r + 0.6, 0, V.TAU); ctx.fill();
          ctx.globalAlpha = a * 0.30;
          ctx.beginPath(); ctx.arc(s.x, s.y, s.r * 4.5, 0, V.TAU); ctx.fill();
        } else {
          ctx.globalAlpha = a * 0.85;
          ctx.fillStyle = '#c9d6f2';
          ctx.fillRect(s.x, s.y, s.r, s.r);
        }
      }
      ctx.restore();
    }

    var moonA = (1 - d) * (stormy ? 0.45 : 1);
    if (moonA > 0.02) {
      var mx = 1035, my = 72;
      ctx.save();
      ctx.globalAlpha = moonA;
      var hg = ctx.createRadialGradient(mx, my, 8, mx, my, 150);
      hg.addColorStop(0, 'rgba(206,222,255,0.30)');
      hg.addColorStop(0.4, 'rgba(190,210,255,0.10)');
      hg.addColorStop(1, 'rgba(180,200,255,0)');
      ctx.fillStyle = hg;
      ctx.beginPath(); ctx.arc(mx, my, 150, 0, V.TAU); ctx.fill();
      ctx.fillStyle = '#e9e7db';
      ctx.beginPath(); ctx.arc(mx, my, 24, 0, V.TAU); ctx.fill();
      ctx.fillStyle = 'rgba(176,178,166,0.55)';
      ctx.beginPath(); ctx.arc(mx - 7, my - 5, 5.5, 0, V.TAU); ctx.fill();
      ctx.beginPath(); ctx.arc(mx + 6, my + 7, 4, 0, V.TAU); ctx.fill();
      ctx.beginPath(); ctx.arc(mx + 10, my - 8, 3, 0, V.TAU); ctx.fill();
      ctx.fillStyle = 'rgba(30,38,58,0.30)';
      ctx.beginPath(); ctx.arc(mx + 8, my + 4, 21, 0, V.TAU); ctx.fill();
      ctx.restore();
    }

    ctx.save();
    for (i = 0; i < this.clouds.length; i++) {
      var c = this.clouds[i];
      c.x += c.v * dt * (stormy ? 2.4 : 1);
      if (c.x - c.sx > W + 40) c.x = -c.sx - 40;
      var a = c.a * (0.65 + 0.35 * Math.sin(this.time * 0.3 + c.seed)) * (stormy ? 1.5 : 1) * (1 - d * 0.75);
      if (a <= 0.01) continue;
      var col = stormy ? '10,14,24' : (d > 0 ? '150,90,70' : '14,20,36');
      var cg = ctx.createRadialGradient(c.x, c.y, 2, c.x, c.y, c.sx);
      cg.addColorStop(0, 'rgba(' + col + ',' + a + ')');
      cg.addColorStop(1, 'rgba(' + col + ',0)');
      ctx.fillStyle = cg;
      ctx.save();
      ctx.translate(c.x, c.y);
      ctx.scale(1, c.sy / c.sx);
      ctx.beginPath(); ctx.arc(0, 0, c.sx, 0, V.TAU); ctx.fill();
      ctx.restore();
      if (d > 0.35) {
        var cg2 = ctx.createRadialGradient(c.x, c.y + c.sy * 0.7, 2, c.x, c.y + c.sy * 0.7, c.sx * 0.8);
        cg2.addColorStop(0, 'rgba(255,170,110,' + (a * d * 0.8) + ')');
        cg2.addColorStop(1, 'rgba(255,150,90,0)');
        ctx.fillStyle = cg2;
        ctx.save();
        ctx.translate(c.x, c.y + c.sy * 0.7);
        ctx.scale(1, 0.4);
        ctx.beginPath(); ctx.arc(0, 0, c.sx * 0.8, 0, V.TAU); ctx.fill();
        ctx.restore();
      }
    }
    ctx.restore();

    var hz = ctx.createLinearGradient(0, HORIZON - 26, 0, HORIZON + 14);
    hz.addColorStop(0, 'rgba(130,170,215,0)');
    hz.addColorStop(0.6, 'rgba(140,180,220,' + (0.10 + d * 0.15) + ')');
    hz.addColorStop(1, 'rgba(120,160,200,0)');
    ctx.fillStyle = hz;
    ctx.fillRect(0, HORIZON - 26, W, 42);
  };

  /* ================= sea ================= */
  Renderer.prototype.drawSea = function (sim) {
    var ctx = this.ctx;
    var d = sim.dawnT || 0;
    var stormy = sim.chapterData && sim.chapterData.weather.rain ? 1 : 0;

    var g = ctx.createLinearGradient(0, HORIZON - 4, 0, H);
    g.addColorStop(0, stormy ? '#0a1322' : '#0c1730');
    g.addColorStop(0.4, stormy ? '#08101d' : '#0a1324');
    g.addColorStop(1, '#050a14');
    ctx.fillStyle = g;
    ctx.fillRect(0, HORIZON - 4, W, H - HORIZON + 4);
    if (d > 0) {
      var g2 = ctx.createLinearGradient(0, HORIZON - 4, 0, H);
      g2.addColorStop(0, '#3c5a72');
      g2.addColorStop(0.4, '#2c4660');
      g2.addColorStop(1, '#1b2c42');
      ctx.globalAlpha = d;
      ctx.fillStyle = g2;
      ctx.fillRect(0, HORIZON - 4, W, H - HORIZON + 4);
      ctx.globalAlpha = 1;
    }

    ctx.save();
    ctx.lineCap = 'round';
    var y = HORIZON + 6;
    var idx = 0;
    while (y < H + 20) {
      var pers = (y - HORIZON) / (H - HORIZON);
      var amp = 1.6 + pers * pers * 17;
      var step = 7 + pers * 30;
      var a = 0.035 + pers * 0.055;
      ctx.strokeStyle = 'rgba(168,200,235,' + a + ')';
      ctx.lineWidth = 1 + pers * 1.3;
      ctx.beginPath();
      var t = this.time * (0.55 + pers * 0.9);
      for (var x = -30; x <= W + 30; x += 26) {
        var yy = y +
          Math.sin(x * 0.020 + t + idx * 1.7) * amp +
          Math.sin(x * 0.045 - t * 1.3 + idx) * amp * 0.45;
        if (x === -30) ctx.moveTo(x, yy); else ctx.lineTo(x, yy);
      }
      ctx.stroke();
      y += step;
      idx++;
    }
    ctx.restore();

    if (d < 0.9) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      var mx = 1035;
      var yy2 = HORIZON + 4, i = 0;
      while (yy2 < H) {
        var p = (yy2 - HORIZON) / (H - HORIZON);
        var jit = Math.sin(yy2 * 0.06 + this.time * 1.4 + i) * (5 + p * 42);
        var rl = 0.45 + 0.55 * Math.abs(Math.sin(i * 12.9898));
        var len = (8 + p * 46) * rl;
        var a2 = (1 - p * 0.55) * 0.075 * (1 - d) * (0.5 + rl * 0.6);
        ctx.strokeStyle = 'rgba(190,215,255,' + a2 + ')';
        ctx.lineWidth = 1.6 + p * 2.4;
        ctx.beginPath();
        ctx.moveTo(mx + jit - len, yy2);
        ctx.lineTo(mx + jit + len, yy2);
        ctx.stroke();
        yy2 += 8 + p * 20;
        i++;
      }
      ctx.restore();
    }

    if (d > 0.02) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      var sx = 640, yy3 = HORIZON + 2, j = 0;
      while (yy3 < H) {
        var p2 = (yy3 - HORIZON) / (H - HORIZON);
        var jit = Math.sin(yy3 * 0.05 + this.time * 1.1 + j) * (6 + p2 * 50);
        var len2 = 12 + p2 * 66;
        var a3 = (1 - p2 * 0.5) * 0.14 * d;
        ctx.strokeStyle = 'rgba(255,196,120,' + a3 + ')';
        ctx.lineWidth = 2 + p2 * 4;
        ctx.beginPath();
        ctx.moveTo(sx + jit - len2, yy3);
        ctx.lineTo(sx + jit + len2, yy3);
        ctx.stroke();
        yy3 += 9 + p2 * 22;
        j++;
      }
      ctx.restore();
    }
  };

  /* ================= land / rocks / buoys ================= */
  Renderer.prototype.drawLand = function (sim) {
    var ctx = this.ctx;
    var d = sim.dawnT || 0;
    var i;
    ctx.save();
    var g = ctx.createLinearGradient(0, 630, 0, H);
    g.addColorStop(0, d > 0 ? '#2a2f38' : '#0e1219');
    g.addColorStop(1, '#05070c');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(0, H);
    ctx.lineTo(0, LAND_L[0][1]);
    for (i = 0; i < LAND_L.length; i++) ctx.lineTo(LAND_L[i][0], LAND_L[i][1]);
    ctx.lineTo(565, 780);
    ctx.lineTo(715, 780);
    for (i = LAND_R.length - 1; i >= 0; i--) ctx.lineTo(LAND_R[i][0], LAND_R[i][1]);
    ctx.lineTo(W, H);
    ctx.closePath();
    ctx.fill();

    ctx.strokeStyle = 'rgba(130,170,210,' + (0.14 + d * 0.1) + ')';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(LAND_L[0][0], LAND_L[0][1]);
    for (i = 0; i < LAND_L.length; i++) ctx.lineTo(LAND_L[i][0], LAND_L[i][1]);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(LAND_R[0][0], LAND_R[0][1]);
    for (i = 0; i < LAND_R.length; i++) ctx.lineTo(LAND_R[i][0], LAND_R[i][1]);
    ctx.stroke();
    ctx.restore();
  };

  Renderer.prototype.drawRocks = function (sim) {
    var ctx = this.ctx;
    var d = sim.dawnT || 0;
    for (var i = 0; i < ROCKS.length; i++) {
      var rk = ROCKS[i];
      var shape = this.rockShapes[i];
      ctx.save();
      var fa = 0.16 + 0.10 * Math.sin(this.time * 2 + i * 2);
      ctx.strokeStyle = 'rgba(225,240,255,' + (fa + d * 0.12) + ')';
      ctx.lineWidth = 2.2;
      ctx.setLineDash([13, 17]);
      ctx.lineDashOffset = -this.time * 24;
      ctx.beginPath();
      ctx.ellipse(rk.x, rk.y + rk.r * 0.5, rk.r * 1.16, rk.r * 0.4, 0, 0, V.TAU);
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.beginPath();
      for (var k = 0; k < shape.length; k++) {
        var p = shape[k];
        var x = rk.x + Math.cos(p.a) * p.r;
        var y = rk.y + Math.sin(p.a) * p.r * 0.92;
        if (k === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.closePath();
      var g = ctx.createLinearGradient(rk.x, rk.y - rk.r, rk.x, rk.y + rk.r);
      g.addColorStop(0, d > 0 ? '#3a3f4a' : '#1a2030');
      g.addColorStop(1, '#080b12');
      ctx.fillStyle = g;
      ctx.fill();
      ctx.strokeStyle = 'rgba(150,185,230,' + (0.16 + d * 0.16) + ')';
      ctx.lineWidth = 1.6;
      ctx.stroke();
      ctx.fillStyle = 'rgba(180,210,245,' + (0.07 + d * 0.12) + ')';
      ctx.beginPath();
      ctx.ellipse(rk.x - rk.r * 0.2, rk.y - rk.r * 0.55, rk.r * 0.4, rk.r * 0.16, -0.3, 0, V.TAU);
      ctx.fill();
      ctx.restore();
    }
  };

  Renderer.prototype.drawBuoys = function (sim) {
    if (!sim.chapterData) return;
    var ctx = this.ctx;
    var d = sim.dawnT || 0;
    var cols = ['70,255,140', '255,86,86'];
    for (var i = 0; i < BUOYS.length; i++) {
      var b = BUOYS[i];
      var blink = 0.35 + 0.65 * Math.pow(0.5 + 0.5 * Math.sin(this.time * 2.6 + i * 2.4), 2);
      ctx.save();
      ctx.strokeStyle = '#141a26';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(b.x, b.y + 8);
      ctx.lineTo(b.x, b.y - 14);
      ctx.stroke();
      ctx.fillStyle = '#1c2434';
      ctx.beginPath();
      ctx.arc(b.x, b.y - 17, 5.5, 0, V.TAU);
      ctx.fill();
      ctx.globalCompositeOperation = 'lighter';
      var gg = ctx.createRadialGradient(b.x, b.y - 17, 0, b.x, b.y - 17, 34);
      gg.addColorStop(0, 'rgba(' + cols[i] + ',' + (0.75 * blink) + ')');
      gg.addColorStop(0.3, 'rgba(' + cols[i] + ',' + (0.3 * blink) + ')');
      gg.addColorStop(1, 'rgba(' + cols[i] + ',0)');
      ctx.fillStyle = gg;
      ctx.beginPath(); ctx.arc(b.x, b.y - 17, 34, 0, V.TAU); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,' + (0.8 * blink) + ')';
      ctx.beginPath(); ctx.arc(b.x, b.y - 17, 2.4, 0, V.TAU); ctx.fill();
      ctx.restore();
    }
    if (sim.mode !== 'title') {
      var pa = 0.20 + 0.12 * Math.sin(this.time * 2.2);
      ctx.save();
      ctx.strokeStyle = 'rgba(255,214,140,' + (pa * (1 - d * 0.6)) + ')';
      ctx.lineWidth = 2.4;
      ctx.lineCap = 'round';
      for (var c = 0; c < 2; c++) {
        var cy = 592 + c * 16;
        var spread = 26 + c * 8;
        ctx.beginPath();
        ctx.moveTo(640 - spread, cy - 9);
        ctx.lineTo(640, cy + 3);
        ctx.lineTo(640 + spread, cy - 9);
        ctx.stroke();
      }
      ctx.restore();
    }
  };

  Renderer.prototype.drawWrecks = function (sim) {
    var ctx = this.ctx;
    for (var i = 0; i < sim.wrecks.length; i++) {
      var w = sim.wrecks[i];
      var bob = Math.sin(this.time * 1.4 + i) * 1.1;
      ctx.save();
      ctx.translate(w.x, w.y + bob + 3);
      ctx.rotate(w.a);
      var s = w.scale;
      ctx.fillStyle = 'rgba(8,10,15,0.94)';
      ctx.beginPath();
      ctx.moveTo(17 * s, 0);
      ctx.lineTo(10 * s, 6.5 * s);
      ctx.lineTo(-13 * s, 6 * s);
      ctx.lineTo(-16 * s, 0);
      ctx.lineTo(-13 * s, -6 * s);
      ctx.lineTo(10 * s, -6.5 * s);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = 'rgba(90,110,140,0.25)';
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.strokeStyle = 'rgba(10,12,18,0.95)';
      ctx.lineWidth = 1.6 * s;
      ctx.beginPath();
      ctx.moveTo(-2 * s, -2 * s); ctx.lineTo(-7 * s, -13 * s);
      ctx.moveTo(5 * s, 1 * s); ctx.lineTo(9 * s, 9 * s);
      ctx.stroke();
      if (w.kind === 'daughter') {
        ctx.fillStyle = 'rgba(244,197,66,0.5)';
        ctx.beginPath();
        ctx.moveTo(-7 * s, -13 * s);
        ctx.lineTo(-13 * s, -11 * s);
        ctx.lineTo(-7 * s, -9 * s);
        ctx.closePath();
        ctx.fill();
      }
      ctx.restore();
      ctx.fillStyle = 'rgba(20,30,45,0.30)';
      ctx.beginPath();
      ctx.ellipse(w.x, w.y + 5, 26 * w.scale, 7 * w.scale, 0, 0, V.TAU);
      ctx.fill();
    }
  };

  Renderer.prototype.drawGhosts = function (sim) {
    if (sim.mode !== 'title') return;
    var ctx = this.ctx;
    for (var i = 0; i < sim.ghosts.length; i++) {
      var g = sim.ghosts[i];
      if (g.life > 0) continue;
      var fade = Math.min(1, g.age / 2) * V.clamp((g.maxLife - g.age) / 3, 0, 1);
      ctx.save();
      ctx.globalAlpha = 0.5 * fade;
      ctx.translate(g.x, g.y);
      var sc = 0.5;
      ctx.fillStyle = '#0c1119';
      ctx.beginPath();
      ctx.moveTo(16 * sc, 0);
      ctx.lineTo(9 * sc, 5 * sc);
      ctx.lineTo(-12 * sc, 4.5 * sc);
      ctx.lineTo(-15 * sc, 0);
      ctx.lineTo(-12 * sc, -4.5 * sc);
      ctx.lineTo(9 * sc, -5 * sc);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = 'rgba(180,205,240,0.5)';
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(0, -2); ctx.lineTo(0, -13); ctx.stroke();
      ctx.fillStyle = 'rgba(210,225,250,0.6)';
      ctx.beginPath();
      ctx.moveTo(0, -13); ctx.lineTo(8, -4); ctx.lineTo(0, -3);
      ctx.closePath(); ctx.fill();
      ctx.restore();
    }
  };

  /* ================= ships ================= */
  Renderer.prototype.shipPathDanger = function (sim, s) {
    var i, r;
    if (s.lit && s.proj) {
      var Q = s.proj;
      var pts = [{ x: s.x, y: s.y }, { x: Q.qx, y: Q.qy }, { x: LAMP.x, y: LAMP.y }];
      for (i = 0; i < ROCKS.length; i++) {
        r = ROCKS[i];
        if (V.segCircle(s.x, s.y, Q.qx, Q.qy, r.x, r.y, r.r + 8)) {
          return { pts: pts, danger: true, impact: impactPoint(s.x, s.y, Q.qx, Q.qy, r.x, r.y, r.r + 8) };
        }
      }
      var d = sim.beamDir();
      var total = Q.t;
      for (i = 0; i < ROCKS.length; i++) {
        r = ROCKS[i];
        var t = V.rayCircle(LAMP.x, LAMP.y, d.ux, d.uy, r.x, r.y, r.r + 8);
        if (t >= 0 && t <= total) {
          return { pts: pts, danger: true, impact: { x: LAMP.x + d.ux * t, y: LAMP.y + d.uy * t } };
        }
      }
      return { pts: pts, danger: false, impact: null };
    }
    var len = 300;
    var ex = s.x + Math.cos(s.heading) * len;
    var ey = s.y + Math.sin(s.heading) * len;
    var pts2 = [{ x: s.x, y: s.y }, { x: ex, y: ey }];
    for (i = 0; i < ROCKS.length; i++) {
      r = ROCKS[i];
      if (V.segCircle(s.x, s.y, ex, ey, r.x, r.y, r.r + 6)) {
        return { pts: pts2, danger: true, impact: impactPoint(s.x, s.y, ex, ey, r.x, r.y, r.r + 6) };
      }
    }
    var lt = V.landTop(s.x + Math.cos(s.heading) * len * 0.66);
    var lt2 = V.landTop(s.x);
    if ((lt2 !== Infinity && s.y > lt2) || (lt !== Infinity && ey > lt)) {
      return { pts: pts2, danger: true, impact: { x: ex, y: Math.min(ey, lt === Infinity ? ey : lt) } };
    }
    if (ey > H - 6 || ex < 4 || ex > W - 4 || ey < HORIZON - 30) {
      return {
        pts: pts2, danger: true,
        impact: { x: V.clamp(ex, 6, W - 6), y: V.clamp(ey, HORIZON - 24, H - 6) }
      };
    }
    return { pts: pts2, danger: false, impact: null };
  };

  Renderer.prototype.drawShips = function (sim) {
    var ctx = this.ctx;
    var power = sim.lampPower * (sim.lampDark > 0 ? 0 : 1);
    for (var i = 0; i < sim.ships.length; i++) {
      var s = sim.ships[i];
      var sc = s.scale * (s.kind === 'daughter' ? 1.14 : 1);

      var info = this.shipPathDanger(sim, s);
      ctx.save();
      ctx.setLineDash([7, 10]);
      ctx.lineDashOffset = -this.time * 34;
      ctx.lineWidth = 2;
      if (info.danger) {
        ctx.strokeStyle = 'rgba(255,86,72,' + (0.55 + 0.2 * Math.sin(this.time * 6)) + ')';
      } else {
        ctx.strokeStyle = s.lit ? 'rgba(255,214,140,0.55)' : 'rgba(255,214,140,0.26)';
      }
      ctx.beginPath();
      ctx.moveTo(info.pts[0].x, info.pts[0].y);
      for (var k = 1; k < info.pts.length; k++) ctx.lineTo(info.pts[k].x, info.pts[k].y);
      ctx.stroke();
      ctx.setLineDash([]);
      if (info.danger && info.impact) {
        var pr = 9 + Math.sin(this.time * 7) * 3;
        ctx.strokeStyle = 'rgba(255,86,72,0.85)';
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(info.impact.x, info.impact.y, pr, 0, V.TAU); ctx.stroke();
        ctx.strokeStyle = 'rgba(255,86,72,0.55)';
        ctx.beginPath();
        ctx.moveTo(info.impact.x - pr * 0.7, info.impact.y - pr * 0.7);
        ctx.lineTo(info.impact.x + pr * 0.7, info.impact.y + pr * 0.7);
        ctx.moveTo(info.impact.x + pr * 0.7, info.impact.y - pr * 0.7);
        ctx.lineTo(info.impact.x - pr * 0.7, info.impact.y + pr * 0.7);
        ctx.stroke();
      }
      if (info.danger) {
        ctx.strokeStyle = 'rgba(255,86,72,' + (0.22 + 0.16 * Math.sin(this.time * 6)) + ')';
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.ellipse(s.x, s.y, 24 * sc, 16 * sc, 0, 0, V.TAU);
        ctx.stroke();
      }
      ctx.restore();

      if (s.wake.length > 1) {
        ctx.save();
        ctx.lineCap = 'round';
        for (var w = 1; w < s.wake.length; w++) {
          var a = s.wake[w].a;
          if (a <= 0) continue;
          ctx.strokeStyle = 'rgba(190,220,245,' + (a * 0.24) + ')';
          ctx.lineWidth = 1.6;
          ctx.beginPath();
          ctx.moveTo(s.wake[w - 1].x, s.wake[w - 1].y);
          ctx.lineTo(s.wake[w].x, s.wake[w].y);
          ctx.stroke();
        }
        ctx.restore();
      }

      if (s.lit && power > 0.1) {
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        var hg = ctx.createRadialGradient(s.x, s.y, 2, s.x, s.y, 44 * sc);
        hg.addColorStop(0, 'rgba(255,215,150,' + (0.34 * power) + ')');
        hg.addColorStop(1, 'rgba(255,190,120,0)');
        ctx.fillStyle = hg;
        ctx.beginPath(); ctx.arc(s.x, s.y, 44 * sc, 0, V.TAU); ctx.fill();
        ctx.restore();
      }

      var bob = Math.sin(s.bob) * 1.4;
      ctx.save();
      ctx.translate(s.x, s.y + bob);
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      ctx.beginPath();
      ctx.ellipse(3, 5, 17 * sc, 8 * sc, 0, 0, V.TAU);
      ctx.fill();

      ctx.rotate(s.heading + Math.sin(s.bob * 0.7) * 0.04);
      var L = 17 * sc, Wd = 7 * sc;
      ctx.beginPath();
      ctx.moveTo(L, 0);
      ctx.quadraticCurveTo(L * 0.55, Wd, -L * 0.5, Wd * 0.85);
      ctx.lineTo(-L * 0.92, Wd * 0.4);
      ctx.lineTo(-L * 0.92, -Wd * 0.4);
      ctx.lineTo(-L * 0.5, -Wd * 0.85);
      ctx.quadraticCurveTo(L * 0.55, -Wd, L, 0);
      ctx.closePath();
      var hullG = ctx.createLinearGradient(0, -Wd, 0, Wd);
      hullG.addColorStop(0, '#4a3826');
      hullG.addColorStop(0.5, '#2e2115');
      hullG.addColorStop(1, '#1b130c');
      ctx.fillStyle = hullG;
      ctx.fill();
      ctx.strokeStyle = s.lit ? 'rgba(255,220,160,0.65)' : 'rgba(140,160,190,0.30)';
      ctx.lineWidth = 1.2;
      ctx.stroke();
      ctx.fillStyle = 'rgba(0,0,0,0.3)';
      ctx.fillRect(-L * 0.45, -Wd * 0.4, L * 0.9, Wd * 0.8);
      ctx.restore();

      var mh = 15 * sc;
      ctx.save();
      ctx.translate(s.x, s.y + bob);
      var px = -Math.sin(s.heading), py = Math.cos(s.heading);
      ctx.strokeStyle = 'rgba(30,24,16,0.95)';
      ctx.lineWidth = 1.6 * sc;
      ctx.beginPath();
      ctx.moveTo(0, -2);
      ctx.lineTo(0, -mh - 6);
      ctx.stroke();
      var sail = function (cx, cy, h, w2, shade) {
        var x1 = cx + px * w2, y1 = cy + py * w2 * 0.5 - h;
        var x2 = cx - px * w2, y2 = cy - py * w2 * 0.5 - h;
        var x3 = cx - px * w2 * 0.72, y3 = cy - py * w2 * 0.36 - h * 0.18;
        var x4 = cx + px * w2 * 0.72, y4 = cy + py * w2 * 0.36 - h * 0.18;
        ctx.beginPath();
        ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.lineTo(x3, y3); ctx.lineTo(x4, y4);
        ctx.closePath();
        ctx.fillStyle = shade;
        ctx.fill();
        ctx.strokeStyle = 'rgba(20,16,10,0.55)';
        ctx.lineWidth = 0.8;
        ctx.stroke();
      };
      var sailCol = s.lit ? 'rgba(236,222,190,0.96)' : 'rgba(168,170,166,0.8)';
      sail(0, -6, mh * 0.92, 9 * sc, sailCol);
      sail(0, -3, mh * 0.5, 6.5 * sc, s.lit ? 'rgba(214,198,166,0.95)' : 'rgba(146,150,150,0.8)');

      if (s.kind === 'daughter') {
        ctx.fillStyle = '#f4c542';
        ctx.beginPath();
        ctx.moveTo(0, -mh - 6);
        ctx.lineTo(-9 * sc, -mh - 3.5);
        ctx.lineTo(0, -mh - 1);
        ctx.closePath();
        ctx.fill();
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        var lg = ctx.createRadialGradient(-L * 0.8, 0, 0, -L * 0.8, 0, 22 * sc);
        lg.addColorStop(0, 'rgba(255,200,110,' + (0.5 * (0.6 + power * 0.4)) + ')');
        lg.addColorStop(1, 'rgba(255,180,90,0)');
        ctx.fillStyle = lg;
        ctx.beginPath(); ctx.arc(-L * 0.8, 0, 22 * sc, 0, V.TAU); ctx.fill();
        ctx.restore();
        ctx.fillStyle = '#ffd98a';
        ctx.beginPath(); ctx.arc(-L * 0.8, 0, 2, 0, V.TAU); ctx.fill();
      }
      if (s.lit) {
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        var lg2 = ctx.createRadialGradient(-L * 0.75, 0, 0, -L * 0.75, 0, 15 * sc);
        lg2.addColorStop(0, 'rgba(255,214,140,' + (0.55 * power) + ')');
        lg2.addColorStop(1, 'rgba(255,190,110,0)');
        ctx.fillStyle = lg2;
        ctx.beginPath(); ctx.arc(-L * 0.75, 0, 15 * sc, 0, V.TAU); ctx.fill();
        ctx.restore();
        ctx.fillStyle = '#ffe6b0';
        ctx.beginPath(); ctx.arc(-L * 0.75, 0, 1.7, 0, V.TAU); ctx.fill();
      }
      ctx.restore();

      if (s.kind === 'daughter') {
        ctx.save();
        ctx.font = '600 13px ' + SERIF;
        ctx.textAlign = 'center';
        ctx.fillStyle = 'rgba(244,197,66,' + (0.75 + 0.25 * Math.sin(this.time * 3)) + ')';
        ctx.fillText('\u2605', s.x, s.y - mh - 16);
        ctx.restore();
      }
    }
  };

  /* ================= monsters ================= */
  Renderer.prototype.drawMonsters = function (sim) {
    var ctx = this.ctx;
    for (var i = 0; i < sim.monsters.length; i++) {
      var m = sim.monsters[i];
      var r = 19 * m.scale;
      ctx.save();
      ctx.strokeStyle = 'rgba(150,190,230,0.14)';
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.ellipse(m.x, m.y + 6, r * 1.7, r * 0.7, 0, 0, V.TAU);
      ctx.stroke();

      ctx.strokeStyle = 'rgba(10,14,24,0.9)';
      ctx.lineWidth = 3 * m.scale;
      ctx.lineCap = 'round';
      var back = m.heading + Math.PI;
      for (var t = 0; t < 4; t++) {
        var ang = back + (t - 1.5) * 0.4 + Math.sin(this.time * 3 + t + m.seed) * 0.28;
        var len = r * (1.3 + 0.4 * Math.sin(this.time * 2.4 + t * 2 + m.seed));
        ctx.beginPath();
        ctx.moveTo(m.x, m.y);
        ctx.quadraticCurveTo(
          m.x + Math.cos(ang) * len * 0.6 + Math.sin(this.time * 4 + t) * 6,
          m.y + Math.sin(ang) * len * 0.6,
          m.x + Math.cos(ang) * len,
          m.y + Math.sin(ang) * len
        );
        ctx.stroke();
      }

      ctx.beginPath();
      var n = 12;
      for (var k = 0; k <= n; k++) {
        var a = (k / n) * V.TAU;
        var rr = r * (1 + 0.16 * Math.sin(a * 3 + this.time * 3.4 + m.seed) + 0.1 * Math.sin(a * 5 - this.time * 2.2));
        var bx = m.x + Math.cos(a) * rr;
        var by = m.y + Math.sin(a) * rr * 0.86;
        if (k === 0) ctx.moveTo(bx, by); else ctx.lineTo(bx, by);
      }
      ctx.closePath();
      var bg = ctx.createRadialGradient(m.x - 4, m.y - 6, 2, m.x, m.y, r * 1.3);
      if (m.burn > 0) {
        bg.addColorStop(0, 'rgba(120,60,26,0.95)');
        bg.addColorStop(1, 'rgba(30,12,6,0.98)');
      } else if (m.lit) {
        bg.addColorStop(0, 'rgba(46,58,84,0.97)');
        bg.addColorStop(1, 'rgba(10,14,26,0.98)');
      } else {
        bg.addColorStop(0, 'rgba(24,30,48,0.97)');
        bg.addColorStop(1, 'rgba(6,9,16,0.98)');
      }
      ctx.fillStyle = bg;
      ctx.fill();
      ctx.strokeStyle = m.lit ? 'rgba(160,200,240,0.28)' : 'rgba(90,120,160,0.14)';
      ctx.lineWidth = 1.4;
      ctx.stroke();

      var look = V.angOf(m.x, m.y, LAMP.x, LAMP.y);
      var ex = Math.cos(look), ey = Math.sin(look);
      var ppx = -ey, ppy = ex;
      for (var e = -1; e <= 1; e += 2) {
        var exs = m.x + ex * r * 0.35 + ppx * r * 0.34 * e;
        var eys = m.y + ey * r * 0.3 + ppy * r * 0.3 * e;
        var tw = 0.55 + 0.45 * Math.sin(this.time * 5 + e + m.seed);
        var eyeCol = m.burn > 0 ? '255,170,90' : (m.lit ? '225,240,255' : '130,175,215');
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        var eg = ctx.createRadialGradient(exs, eys, 0, exs, eys, 8 * m.scale);
        eg.addColorStop(0, 'rgba(' + eyeCol + ',' + (0.85 * tw) + ')');
        eg.addColorStop(1, 'rgba(' + eyeCol + ',0)');
        ctx.fillStyle = eg;
        ctx.beginPath(); ctx.arc(exs, eys, 8 * m.scale, 0, V.TAU); ctx.fill();
        ctx.restore();
        ctx.fillStyle = 'rgba(' + eyeCol + ',' + (0.9 * tw) + ')';
        ctx.beginPath(); ctx.arc(exs, eys, 1.7 * m.scale, 0, V.TAU); ctx.fill();
      }

      if (m.burn > 0) {
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        var fg = ctx.createRadialGradient(m.x, m.y, 2, m.x, m.y, r * 1.8);
        fg.addColorStop(0, 'rgba(255,140,50,' + (0.30 * m.burn) + ')');
        fg.addColorStop(1, 'rgba(255,120,40,0)');
        ctx.fillStyle = fg;
        ctx.beginPath(); ctx.arc(m.x, m.y, r * 1.8, 0, V.TAU); ctx.fill();
        ctx.restore();
      }
      ctx.restore();
    }
  };

  /* ================= boss ================= */
  Renderer.prototype.drawBoss = function (sim) {
    var b = sim.boss;
    if (!b || b.state === 'dead' || b.alpha <= 0.01) return;
    var ctx = this.ctx;
    var s = b.scale;
    ctx.save();
    ctx.globalAlpha = b.alpha === undefined ? 1 : b.alpha;
    ctx.translate(b.x, b.y);

    var bodyH = 215 * s;
    ctx.beginPath();
    ctx.moveTo(-205 * s, 8);
    ctx.bezierCurveTo(-190 * s, -70 * s, -150 * s, -128 * s, -96 * s, -150 * s);
    ctx.bezierCurveTo(-70 * s, -186 * s, -34 * s, -215 * s, 0, -215 * s);
    ctx.bezierCurveTo(34 * s, -215 * s, 70 * s, -186 * s, 96 * s, -150 * s);
    ctx.bezierCurveTo(150 * s, -128 * s, 190 * s, -70 * s, 205 * s, 8);
    ctx.closePath();
    var g = ctx.createLinearGradient(0, -bodyH, 0, 20);
    g.addColorStop(0, '#0a0f1c');
    g.addColorStop(0.55, '#070b14');
    g.addColorStop(1, '#03050a');
    ctx.fillStyle = g;
    ctx.fill();
    ctx.strokeStyle = 'rgba(130,170,230,' + (0.20 + 0.1 * Math.sin(this.time * 1.4)) + ')';
    ctx.lineWidth = 2.5;
    ctx.stroke();

    /* spine fins */
    ctx.fillStyle = '#05080f';
    for (var f = -3; f <= 3; f++) {
      var fx = f * 46 * s;
      var fh = (46 - Math.abs(f) * 7) * s * (1 + 0.12 * Math.sin(this.time * 2 + f));
      var fy = -190 * s + Math.abs(f) * 14 * s;
      ctx.beginPath();
      ctx.moveTo(fx - 13 * s, fy);
      ctx.lineTo(fx, fy - fh);
      ctx.lineTo(fx + 13 * s, fy);
      ctx.closePath();
      ctx.fill();
    }

    /* barnacle texture */
    ctx.fillStyle = 'rgba(90,120,160,0.10)';
    for (var d = 0; d < 16; d++) {
      var dx = ((d * 53) % 170 - 85) * s;
      var dy = -((d * 37) % 150 + 10) * s;
      ctx.beginPath();
      ctx.arc(dx, dy, (2 + (d % 3)) * s, 0, V.TAU);
      ctx.fill();
    }

    var eyes = [
      { x: -96, y: -120 },
      { x: 96, y: -120 }
    ];
    for (var i = 0; i < 2; i++) {
      var E = eyes[i];
      var ex = E.x * s, ey = E.y * s;
      var st = b.eyes[i];
      var searing = b.searing && b.searing[i];
      if (!st.dead) {
        var R = (26 + (searing ? 12 : 0)) * s;
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        var pulse = 1 + 0.12 * Math.sin(this.time * 3.2 + i * 2);
        var eg = ctx.createRadialGradient(ex, ey, 0, ex, ey, R * 2.6 * pulse);
        var c0 = searing ? '255,255,240' : '255,220,150';
        var c1 = searing ? '255,190,90' : '255,150,60';
        eg.addColorStop(0, 'rgba(' + c0 + ',0.95)');
        eg.addColorStop(0.35, 'rgba(' + c1 + ',0.55)');
        eg.addColorStop(1, 'rgba(255,120,40,0)');
        ctx.fillStyle = eg;
        ctx.beginPath(); ctx.arc(ex, ey, R * 2.6 * pulse, 0, V.TAU); ctx.fill();
        ctx.restore();
        ctx.fillStyle = searing ? '#ffffff' : '#ffe9c0';
        ctx.beginPath(); ctx.arc(ex, ey, 9 * s * (searing ? 1.35 : 1), 0, V.TAU); ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,0.16)';
        ctx.lineWidth = 3;
        ctx.beginPath(); ctx.arc(ex, ey, R, 0, V.TAU); ctx.stroke();
        ctx.strokeStyle = searing ? '#fff2c0' : 'rgba(255,190,110,0.9)';
        ctx.beginPath();
        ctx.arc(ex, ey, R, -Math.PI / 2, -Math.PI / 2 + V.TAU * (st.hp / 100));
        ctx.stroke();
        if (sim.focus && sim.coneContains(b.x + ex, b.y + ey)) {
          ctx.strokeStyle = 'rgba(255,255,255,0.9)';
          ctx.lineWidth = 2;
          var br = R + 8;
          for (var q = 0; q < 4; q++) {
            var qa = Math.PI / 4 + q * Math.PI / 2;
            var qx = ex + Math.cos(qa) * br, qy = ey + Math.sin(qa) * br;
            ctx.beginPath();
            ctx.moveTo(qx - Math.cos(qa - 0.5) * 8, qy - Math.sin(qa - 0.5) * 8);
            ctx.lineTo(qx, qy);
            ctx.stroke();
          }
        }
      } else {
        ctx.fillStyle = '#020306';
        ctx.beginPath(); ctx.arc(ex, ey, 13 * s, 0, V.TAU); ctx.fill();
        ctx.strokeStyle = 'rgba(120,130,150,0.5)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(ex - 10 * s, ey - 10 * s); ctx.lineTo(ex + 10 * s, ey + 10 * s);
        ctx.moveTo(ex + 10 * s, ey - 10 * s); ctx.lineTo(ex - 10 * s, ey + 10 * s);
        ctx.stroke();
      }
    }

    ctx.globalCompositeOperation = 'source-over';
    ctx.strokeStyle = 'rgba(220,238,255,' + (0.30 + 0.18 * Math.sin(this.time * 5)) + ')';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.ellipse(0, 6, 200 * s, 18 * s, 0, 0, V.TAU);
    ctx.stroke();

    ctx.restore();
  };

  /* ================= fog ================= */
  Renderer.prototype.drawFog = function (sim) {
    var fog = sim.fogAmt || 0;
    var d = sim.dawnT || 0;
    fog *= (1 - d);
    var dark = sim.lampDark > 0 ? V.clamp(sim.lampDark / 2.6, 0, 1) : 0;
    if (fog < 0.02 && dark < 0.02) return;
    var ctx = this.ctx;
    var f = this.fctx;
    f.clearRect(0, 0, W, H);

    var a = Math.max(fog * 0.5, dark * 0.82);
    f.fillStyle = 'rgba(14,20,34,' + a + ')';
    f.fillRect(0, HORIZON - 30, W, H - HORIZON + 40);

    if (dark < 0.9) {
      f.save();
      f.globalCompositeOperation = 'destination-out';
      f.fillStyle = '#fff';
      if (sim.lampPower > 0.05) {
        conePath(f, LAMP.x, LAMP.y, sim.beamAngle, sim.half * 1.06, 1180);
        f.fill();
      }
      var hg = f.createRadialGradient(LAMP.x, LAMP.y, 10, LAMP.x, LAMP.y, 150);
      hg.addColorStop(0, 'rgba(255,255,255,0.95)');
      hg.addColorStop(1, 'rgba(255,255,255,0)');
      f.fillStyle = hg;
      f.beginPath(); f.arc(LAMP.x, LAMP.y, 150, 0, V.TAU); f.fill();
      f.restore();
    } else {
      f.save();
      f.globalCompositeOperation = 'destination-out';
      var hg2 = f.createRadialGradient(LAMP.x, LAMP.y, 4, LAMP.x, LAMP.y, 66);
      hg2.addColorStop(0, 'rgba(255,255,255,0.9)');
      hg2.addColorStop(1, 'rgba(255,255,255,0)');
      f.fillStyle = hg2;
      f.beginPath(); f.arc(LAMP.x, LAMP.y, 66, 0, V.TAU); f.fill();
      f.restore();
    }

    ctx.drawImage(this.fogC, 0, 0);

    if (fog > 0.02) {
      var mg = ctx.createLinearGradient(0, HORIZON - 40, 0, HORIZON + 60);
      mg.addColorStop(0, 'rgba(150,175,205,0)');
      mg.addColorStop(0.5, 'rgba(150,175,205,' + (0.16 * fog) + ')');
      mg.addColorStop(1, 'rgba(150,175,205,0)');
      ctx.fillStyle = mg;
      ctx.fillRect(0, HORIZON - 40, W, 100);
    }
  };

  /* ================= beam ================= */
  Renderer.prototype.buildBeam = function (sim) {
    var b = this.bctx;
    b.clearRect(0, 0, W, H);
    var power = sim.lampPower * (sim.lampDark > 0 ? 0 : 1);
    if (power < 0.02) return;
    var ang = sim.beamAngle, half = sim.half;
    var range = sim.focus ? 1220 : 1150;
    var flick = 1 + Math.sin(this.time * 17.3) * 0.022 + Math.sin(this.time * 7.1) * 0.03;
    var a = power * flick;
    var i;

    b.save();
    /* feathered outer wash: nested cones, small alpha steps */
    var washMults = [2.0, 1.75, 1.52, 1.32, 1.14];
    var washAlphas = [0.03, 0.04, 0.05, 0.065, 0.085];
    for (var wi = 0; wi < washMults.length; wi++) {
      conePath(b, LAMP.x, LAMP.y, ang, half * washMults[wi], range);
      var gw = b.createRadialGradient(LAMP.x, LAMP.y, 40, LAMP.x, LAMP.y, range);
      gw.addColorStop(0, 'rgba(255,224,168,' + (washAlphas[wi] * a) + ')');
      gw.addColorStop(0.45, 'rgba(255,210,148,' + (washAlphas[wi] * 0.55 * a) + ')');
      gw.addColorStop(1, 'rgba(255,190,120,0)');
      b.fillStyle = gw;
      b.fill();
    }

    conePath(b, LAMP.x, LAMP.y, ang, half, range);
    var g2 = b.createRadialGradient(LAMP.x, LAMP.y, 30, LAMP.x, LAMP.y, range);
    g2.addColorStop(0, 'rgba(255,236,190,' + (0.46 * a) + ')');
    g2.addColorStop(0.5, 'rgba(255,220,160,' + (0.20 * a) + ')');
    g2.addColorStop(1, 'rgba(255,205,140,0)');
    b.fillStyle = g2;
    b.fill();

    for (i = 0; i < 3; i++) {
      var ba = ang + Math.sin(this.time * (0.6 + i * 0.45) + i * 2.1) * half * 0.55;
      conePath(b, LAMP.x, LAMP.y, ba, half * 0.2, range * 0.97);
      var g3 = b.createRadialGradient(LAMP.x, LAMP.y, 20, LAMP.x, LAMP.y, range);
      g3.addColorStop(0, 'rgba(255,244,214,' + (0.14 * a) + ')');
      g3.addColorStop(1, 'rgba(255,235,200,0)');
      b.fillStyle = g3;
      b.fill();
    }

    if (sim.focus) {
      conePath(b, LAMP.x, LAMP.y, ang, half * 0.5, range * 1.02);
      var g4 = b.createRadialGradient(LAMP.x, LAMP.y, 16, LAMP.x, LAMP.y, range);
      g4.addColorStop(0, 'rgba(255,255,250,' + (0.72 * a) + ')');
      g4.addColorStop(0.35, 'rgba(255,246,220,' + (0.34 * a) + ')');
      g4.addColorStop(1, 'rgba(255,240,210,0)');
      b.fillStyle = g4;
      b.fill();
    }

    b.globalCompositeOperation = 'destination-out';
    b.fillStyle = '#000';
    for (i = 0; i < ROCKS.length; i++) {
      var r = ROCKS[i];
      punchWedge(b, LAMP.x, LAMP.y, r.x, r.y, r.r + 2, 1300);
    }
    b.restore();
  };

  Renderer.prototype.compositeBeam = function (sim) {
    var ctx = this.ctx;
    if (sim.lampPower < 0.02 || sim.lampDark > 0) return;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.drawImage(this.beamC, 0, 0);
    var bl = this.bloomCtx;
    bl.clearRect(0, 0, 320, 180);
    bl.drawImage(this.beamC, 0, 0, 320, 180);
    ctx.globalAlpha = 0.5;
    ctx.drawImage(this.bloomC, 0, 0, W, H);
    ctx.restore();
  };

  /* ================= lantern ================= */
  Renderer.prototype.drawLantern = function (sim) {
    var ctx = this.ctx;
    var power = sim.lampPower * (sim.lampDark > 0 ? 0.12 : 1);
    var flick = 1 + Math.sin(this.time * 13.7) * 0.04 + Math.sin(this.time * 5.3) * 0.03;
    var heat = sim.heat / 100;

    /* parapet wall */
    ctx.save();
    var pg = ctx.createLinearGradient(0, 676, 0, H);
    pg.addColorStop(0, '#171c27');
    pg.addColorStop(1, '#080a10');
    ctx.fillStyle = pg;
    ctx.beginPath();
    ctx.moveTo(430, H);
    ctx.quadraticCurveTo(640, 656, 850, H);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#12161f';
    for (var m = -3; m <= 3; m++) {
      var mx = 640 + m * 62;
      var my = 668 + Math.abs(m) * 13;
      ctx.fillRect(mx - 14, my, 28, H - my);
    }
    ctx.strokeStyle = 'rgba(120,150,190,0.07)';
    ctx.lineWidth = 1;
    for (var l = 0; l < 5; l++) {
      ctx.beginPath();
      ctx.moveTo(470 + l * 10, 700 + l * 6);
      ctx.quadraticCurveTo(640, 686 + l * 8, 810 - l * 10, 700 + l * 6);
      ctx.stroke();
    }
    ctx.restore();

    /* pedestal + lens */
    ctx.save();
    var cg = ctx.createLinearGradient(622, 0, 658, 0);
    cg.addColorStop(0, '#3a2c14');
    cg.addColorStop(0.5, '#7a5f2c');
    cg.addColorStop(1, '#2e2310');
    ctx.fillStyle = cg;
    ctx.fillRect(624, 686, 32, 34);
    ctx.fillStyle = '#241a0c';
    ctx.beginPath();
    ctx.ellipse(640, 686, 52, 13, 0, 0, V.TAU);
    ctx.fill();
    ctx.strokeStyle = 'rgba(200,160,80,0.4)';
    ctx.lineWidth = 1.4;
    ctx.stroke();

    ctx.save();
    ctx.translate(LAMP.x, LAMP.y);
    var rot = this.time * 0.9;
    var gg = ctx.createRadialGradient(0, 0, 4, 0, 0, 40);
    gg.addColorStop(0, 'rgba(255,240,210,' + (0.34 * power * flick + heat * 0.25) + ')');
    gg.addColorStop(0.6, 'rgba(255,220,170,' + (0.16 * power) + ')');
    gg.addColorStop(1, 'rgba(255,210,150,0.05)');
    ctx.fillStyle = gg;
    ctx.beginPath(); ctx.ellipse(0, 0, 40, 30, 0, 0, V.TAU); ctx.fill();

    for (var p = 0; p < 7; p++) {
      var pa = rot + (p / 7) * V.TAU;
      var alpha = 0.10 + 0.16 * (0.5 + 0.5 * Math.sin(pa * 2 + this.time * 2));
      ctx.strokeStyle = 'rgba(255,245,220,' + (alpha * power + 0.05) + ')';
      ctx.lineWidth = 2.4;
      ctx.beginPath();
      ctx.ellipse(0, 0, 34, 25, pa * 0.12, -0.5, 0.5);
      ctx.stroke();
    }

    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    var core = ctx.createRadialGradient(0, 0, 0, 0, 0, 26);
    var ca = (0.75 * power * flick + (sim.overheated ? 0.2 : 0));
    core.addColorStop(0, 'rgba(255,255,245,' + ca + ')');
    core.addColorStop(0.4, 'rgba(255,225,160,' + (ca * 0.7) + ')');
    core.addColorStop(1, 'rgba(255,190,110,0)');
    ctx.fillStyle = core;
    ctx.beginPath(); ctx.arc(0, 0, 26, 0, V.TAU); ctx.fill();
    ctx.restore();
    ctx.restore();

    /* big glow */
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    var glowA = (0.42 + heat * 0.2) * power * flick;
    var gl = ctx.createRadialGradient(LAMP.x, LAMP.y, 6, LAMP.x, LAMP.y, 190);
    gl.addColorStop(0, 'rgba(255,220,160,' + glowA + ')');
    gl.addColorStop(0.35, 'rgba(255,200,130,' + (glowA * 0.4) + ')');
    gl.addColorStop(1, 'rgba(255,180,110,0)');
    ctx.fillStyle = gl;
    ctx.beginPath(); ctx.arc(LAMP.x, LAMP.y, 190, 0, V.TAU); ctx.fill();

    if (sim.focus && sim.lampDark <= 0) {
      ctx.translate(LAMP.x, LAMP.y);
      ctx.rotate(sim.beamAngle);
      var sg = ctx.createLinearGradient(0, 0, 240, 0);
      sg.addColorStop(0, 'rgba(255,255,240,0.5)');
      sg.addColorStop(1, 'rgba(255,250,230,0)');
      ctx.fillStyle = sg;
      ctx.fillRect(0, -1.6, 240, 3.2);
      ctx.fillStyle = 'rgba(255,255,250,0.75)';
      ctx.beginPath();
      ctx.moveTo(30, -2); ctx.lineTo(0, -7); ctx.lineTo(-8, -2); ctx.lineTo(0, 2);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();

    if (sim.lampDark > 0) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      var ea = V.clamp(sim.lampDark / 2.6, 0, 1);
      var em = ctx.createRadialGradient(LAMP.x, LAMP.y, 0, LAMP.x, LAMP.y, 60);
      em.addColorStop(0, 'rgba(255,120,60,' + (0.4 * ea) + ')');
      em.addColorStop(1, 'rgba(255,80,40,0)');
      ctx.fillStyle = em;
      ctx.beginPath(); ctx.arc(LAMP.x, LAMP.y, 60, 0, V.TAU); ctx.fill();
      ctx.restore();
    }

    if (sim.overheated) {
      ctx.save();
      ctx.strokeStyle = 'rgba(220,230,240,0.30)';
      ctx.lineWidth = 2;
      for (var st = 0; st < 3; st++) {
        var stx = LAMP.x - 18 + st * 18;
        ctx.beginPath();
        for (var yy = 0; yy < 30; yy += 4) {
          var sx = stx + Math.sin(yy * 0.4 + this.time * 5 + st) * 5;
          var sy = LAMP.y - 26 - yy - ((this.time * 40 + st * 12) % 30);
          if (yy === 0) ctx.moveTo(sx, sy); else ctx.lineTo(sx, sy);
        }
        ctx.stroke();
      }
      ctx.restore();
    }
    ctx.restore();
  };

  /* ================= motes / particles ================= */
  Renderer.prototype.drawMotes = function (sim, dt) {
    if (sim.lampDark > 0 || sim.lampPower < 0.1) return;
    var ctx = this.ctx;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (var i = 0; i < this.motes.length; i++) {
      var m = this.motes[i];
      m.x += (m.vx + Math.sin(this.time + m.ph) * 3) * dt;
      m.y += (m.vy + Math.cos(this.time * 0.8 + m.ph) * 2) * dt;
      if (m.x < -20) m.x = W + 20;
      if (m.x > W + 20) m.x = -20;
      if (m.y < HORIZON) m.y = H;
      if (m.y > H) m.y = HORIZON + 4;
      var inBeam = sim.coneContains(m.x, m.y);
      var a = inBeam ? 0.5 * sim.lampPower : 0.05;
      if (a < 0.03) continue;
      ctx.fillStyle = 'rgba(255,236,200,' + a + ')';
      ctx.beginPath();
      ctx.arc(m.x, m.y, inBeam ? m.r + 0.5 : m.r * 0.7, 0, V.TAU);
      ctx.fill();
    }
    ctx.restore();
  };

  Renderer.prototype.drawParticles = function (sim) {
    var ctx = this.ctx;
    var list = sim.particles.list;
    var i, p, a;
    ctx.save();
    for (i = 0; i < list.length; i++) {
      p = list[i];
      if (p.type === 'rain' || p.type === 'spark' || p.type === 'ember' || p.type === 'sparkle' || p.type === 'text') continue;
      a = V.clamp(p.life / p.maxLife, 0, 1) * p.a0;
      if (p.type === 'ash') {
        ctx.fillStyle = V.hsla(p.hue, p.sat, p.lum, a * 0.8);
        ctx.beginPath(); ctx.arc(p.x, p.y, p.size * (0.6 + (1 - a) * 0.8), 0, V.TAU); ctx.fill();
      } else if (p.type === 'debris') {
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.fillStyle = V.hsla(p.hue, p.sat, p.lum, a);
        ctx.fillRect(-p.size, -p.size * 0.5, p.size * 2, p.size);
        ctx.restore();
      } else if (p.type === 'spray') {
        ctx.fillStyle = V.hsla(p.hue, p.sat, p.lum, a * 0.55);
        ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, V.TAU); ctx.fill();
      }
    }
    ctx.lineCap = 'round';
    for (i = 0; i < list.length; i++) {
      p = list[i];
      if (p.type !== 'rain') continue;
      ctx.strokeStyle = 'rgba(190,214,240,0.34)';
      ctx.lineWidth = 1.15;
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      ctx.lineTo(p.x - p.vx * 0.018, p.y - p.vy * 0.018);
      ctx.stroke();
    }
    ctx.restore();

    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (i = 0; i < list.length; i++) {
      p = list[i];
      a = V.clamp(p.life / p.maxLife, 0, 1) * p.a0;
      if (p.type === 'spark' || p.type === 'sparkle' || p.type === 'ember') {
        var col = p.type === 'sparkle' ? V.hsla(p.hue, p.sat, p.lum, a) :
          (p.type === 'ember' ? 'rgba(255,150,60,' + a + ')' : 'rgba(255,214,140,' + a + ')');
        ctx.fillStyle = col;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, V.TAU); ctx.fill();
        if (p.type === 'sparkle') {
          ctx.strokeStyle = V.hsla(p.hue, p.sat, Math.min(90, p.lum + 15), a * 0.7);
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(p.x - p.size * 2.4, p.y); ctx.lineTo(p.x + p.size * 2.4, p.y);
          ctx.moveTo(p.x, p.y - p.size * 2.4); ctx.lineTo(p.x, p.y + p.size * 2.4);
          ctx.stroke();
        }
      }
    }
    ctx.restore();

    for (i = 0; i < list.length; i++) {
      p = list[i];
      if (p.type !== 'text') continue;
      a = V.clamp(p.life / p.maxLife, 0, 1);
      var pop = V.easeOut(V.clamp((p.maxLife - p.life) * 4, 0, 1));
      ctx.save();
      ctx.globalAlpha = a;
      ctx.font = '600 ' + Math.round(p.size * (0.7 + 0.3 * pop)) + 'px ' + SERIF;
      ctx.textAlign = 'center';
      ctx.fillStyle = '#ffd98a';
      ctx.shadowColor = 'rgba(255,180,80,0.8)';
      ctx.shadowBlur = 12;
      ctx.fillText(p.text, p.x, p.y);
      ctx.restore();
    }
  };

  /* ================= dawn / post ================= */
  Renderer.prototype.drawDawn = function (sim) {
    var d = sim.dawnT || 0;
    if (d <= 0.01) return;
    var ctx = this.ctx;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    var g = ctx.createLinearGradient(0, HORIZON - 60, 0, H * 0.8);
    g.addColorStop(0, 'rgba(255,170,90,' + (0.30 * d) + ')');
    g.addColorStop(0.5, 'rgba(255,150,90,' + (0.10 * d) + ')');
    g.addColorStop(1, 'rgba(255,140,80,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, HORIZON - 60, W, H);

    var sg = ctx.createRadialGradient(640, HORIZON, 10, 640, HORIZON, 420);
    sg.addColorStop(0, 'rgba(255,214,150,' + (0.55 * d) + ')');
    sg.addColorStop(0.4, 'rgba(255,180,110,' + (0.20 * d) + ')');
    sg.addColorStop(1, 'rgba(255,160,90,0)');
    ctx.fillStyle = sg;
    ctx.beginPath(); ctx.arc(640, HORIZON, 420, 0, V.TAU); ctx.fill();
    ctx.restore();
  };

  Renderer.prototype.drawPost = function (sim) {
    var ctx = this.ctx;
    var fl = Math.max(sim.flash * 0.5, sim.flashPulse * 0.22);
    if (fl > 0.01) {
      ctx.fillStyle = 'rgba(235,244,255,' + fl + ')';
      ctx.fillRect(-30, -30, W + 60, H + 60);
    }
    if (sim.mode === 'failed') {
      ctx.fillStyle = 'rgba(8,10,18,0.44)';
      ctx.fillRect(-30, -30, W + 60, H + 60);
    }
    /* dread as the great dark approaches */
    if (sim.boss && sim.bossActive && sim.phase !== 'dawn' &&
        (sim.boss.state === 'idle' || sim.boss.state === 'rising') && sim.mode !== 'title') {
      var pr = V.clamp((sim.boss.y - 160) / (470 - 160), 0, 1);
      if (pr > 0.02) {
        var pulse = 0.85 + 0.15 * Math.sin(this.time * 2.2);
        var rg = ctx.createRadialGradient(W / 2, H / 2, H * 0.30, W / 2, H / 2, H * 0.94);
        rg.addColorStop(0, 'rgba(140,24,16,0)');
        rg.addColorStop(1, 'rgba(152,26,16,' + (0.40 * pr * pulse).toFixed(3) + ')');
        ctx.fillStyle = rg;
        ctx.fillRect(-30, -30, W + 60, H + 60);
      }
    }
    ctx.fillStyle = this.vignette;
    ctx.fillRect(-30, -30, W + 60, H + 60);
    ctx.save();
    ctx.globalCompositeOperation = 'overlay';
    ctx.globalAlpha = 0.05;
    ctx.translate((Math.random() * 128) | 0, (Math.random() * 128) | 0);
    ctx.fillStyle = this.grainPat;
    ctx.fillRect(-160, -160, W + 320, H + 320);
    ctx.restore();
  };

  /* ================= HUD ================= */
  Renderer.prototype.drawHUD = function (sim) {
    var ctx = this.ctx;
    var chap = sim.chapterData;
    var fade = V.clamp(sim.t / 1.2, 0, 1);

    ctx.save();
    ctx.textBaseline = 'alphabetic';

    if (chap) {
      ctx.globalAlpha = fade * (sim.mode === 'failed' ? 0.4 : 0.95);
      ctx.font = 'italic 700 30px ' + SERIF;
      ctx.fillStyle = '#e8c477';
      ctx.textAlign = 'left';
      ctx.fillText(chap.roman, 36, 56);
      ctx.font = '600 13px ' + SERIF;
      ctx.fillStyle = 'rgba(230,220,200,0.85)';
      V.drawSpaced(ctx, chap.name, 76, 52, 3.2, 'left');
      ctx.globalAlpha = 1;
    }

    ctx.textAlign = 'right';
    ctx.font = '600 12px ' + SERIF;
    ctx.fillStyle = 'rgba(230,220,200,0.7)';
    V.drawSpaced(ctx, 'HOME', 1244, 34, 3, 'right');
    var sStr = String(sim.saved), tStr = ' / ' + sim.shipTotal;
    ctx.font = '700 30px ' + SERIF;
    var ws = ctx.measureText(sStr).width;
    ctx.font = '400 17px ' + SERIF;
    var wt = ctx.measureText(tStr).width;
    var hx = 1244 - ws - wt;
    ctx.textAlign = 'left';
    ctx.font = '700 30px ' + SERIF;
    ctx.fillStyle = '#e8c477';
    ctx.fillText(sStr, hx, 64);
    ctx.font = '400 17px ' + SERIF;
    ctx.fillStyle = 'rgba(230,220,200,0.6)';
    ctx.fillText(tStr, hx + ws, 64);
    ctx.textAlign = 'right';

    ctx.textAlign = 'left';
    ctx.font = '600 11px ' + SERIF;
    ctx.fillStyle = 'rgba(230,220,200,0.6)';
    V.drawSpaced(ctx, 'THE LAMP HOLDS', 36, 646, 2.4, 'left');
    for (var i = 0; i < 3; i++) {
      var fx = 46 + i * 34, fy = 684;
      var lit = i < sim.hope;
      if (lit) {
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        var fg = ctx.createRadialGradient(fx, fy - 2, 0, fx, fy - 2, 24);
        fg.addColorStop(0, 'rgba(255,190,90,0.55)');
        fg.addColorStop(1, 'rgba(255,160,70,0)');
        ctx.fillStyle = fg;
        ctx.beginPath(); ctx.arc(fx, fy - 2, 24, 0, V.TAU); ctx.fill();
        ctx.restore();
        var lg = ctx.createLinearGradient(fx, fy - 13, fx, fy + 8);
        lg.addColorStop(0, '#ffe9a8');
        lg.addColorStop(1, '#ff8c3a');
        ctx.fillStyle = lg;
      } else {
        ctx.fillStyle = 'rgba(120,140,170,0.16)';
      }
      ctx.beginPath();
      ctx.moveTo(fx, fy - 13);
      ctx.bezierCurveTo(fx + 8, fy - 4, fx + 7, fy + 3, fx, fy + 8);
      ctx.bezierCurveTo(fx - 7, fy + 3, fx - 8, fy - 4, fx, fy - 13);
      ctx.closePath();
      ctx.fill();
      if (!lit) {
        ctx.strokeStyle = 'rgba(160,180,210,0.3)';
        ctx.lineWidth = 1.2;
        ctx.stroke();
      }
    }

    /* flare gauge */
    var gx = 1040, gw = 204, gy = 682, gh = 9;
    ctx.font = '600 11px ' + SERIF;
    ctx.fillStyle = sim.overheated ? 'rgba(255,110,90,0.95)' : 'rgba(230,220,200,0.65)';
    V.drawSpaced(ctx, sim.overheated ? 'OVERHEAT' : 'FLARE', 1244, 668, 2.6, 'right');
    ctx.fillStyle = 'rgba(10,14,22,0.75)';
    ctx.fillRect(gx, gy, gw, gh);
    var pct = sim.heat / 100;
    if (pct > 0.005) {
      var hg = ctx.createLinearGradient(gx, 0, gx + gw, 0);
      hg.addColorStop(0, '#ffd479');
      hg.addColorStop(0.6, '#ff9a4a');
      hg.addColorStop(1, '#ff5a44');
      ctx.fillStyle = hg;
      ctx.fillRect(gx, gy, gw * pct, gh);
    }
    if (sim.focus) {
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      ctx.fillRect(gx, gy - 3, gw * pct, 2);
    }
    if (sim.overheated && Math.sin(this.time * 10) > 0) {
      ctx.fillStyle = 'rgba(255,90,70,0.9)';
      ctx.fillRect(gx, gy, gw, gh);
    }

    /* chapter hint */
    if (sim.hint && sim.hintT > 0 && sim.mode === 'play') {
      var ha = V.clamp(Math.min(sim.hintT, 7.5 - sim.hintT + 1.5), 0, 1);
      ha = V.clamp(ha, 0, 1);
      ctx.save();
      ctx.globalAlpha = ha * 0.92;
      ctx.font = '600 15px ' + SERIF;
      var tw = V.textWidthSpaced(ctx, sim.hint, 2.6);
      var bx = 640 - tw / 2 - 26;
      ctx.fillStyle = 'rgba(6,9,16,0.66)';
      ctx.beginPath();
      if (ctx.roundRect) { ctx.roundRect(bx, 452, tw + 52, 44, 8); }
      else { ctx.rect(bx, 452, tw + 52, 44); }
      ctx.fill();
      ctx.strokeStyle = 'rgba(232,196,119,0.35)';
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.fillStyle = 'rgba(240,230,210,0.95)';
      ctx.textAlign = 'left';
      V.drawSpaced(ctx, sim.hint, 640 - tw / 2, 480, 2.6, 'left');
      ctx.restore();
    }

    /* darkness warning */
    if (sim.lampDark > 0 && sim.mode === 'play') {
      ctx.save();
      ctx.globalAlpha = 0.55 + 0.45 * Math.sin(this.time * 9);
      ctx.font = '700 30px ' + SERIF;
      ctx.textAlign = 'center';
      ctx.fillStyle = '#ff7a6a';
      V.drawSpaced(ctx, 'HOLD FAST', 640, 300, 8, 'center');
      ctx.restore();
    }

    ctx.restore();
  };

  V.Renderer = Renderer;

})(window.Vigil);
