/* EMBERWAKE — the lamp room. Procedural Canvas2D scenery: a curved glass wall,
   a sleeping town, weather, visitors, and the engraved ember-ring the whole game
   is played on.                                                                   */
(function (global) {
  'use strict';

  var bg = null, bgx = null, fx = null, fxx = null;
  var W = 0, H = 0, DPR = 1;
  var L = {};           // layout
  var stars = [], town = [], windows = [], grainTile = null;

  /* ---------------------------------------------------------------- helpers */
  function hex2rgb(h) {
    h = h.replace('#', '');
    if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    var n = parseInt(h, 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  function mixc(a, b, t) {
    var A = hex2rgb(a), B = hex2rgb(b);
    t = U.clamp(t, 0, 1);
    return 'rgb(' + Math.round(A[0] + (B[0] - A[0]) * t) + ',' +
      Math.round(A[1] + (B[1] - A[1]) * t) + ',' +
      Math.round(A[2] + (B[2] - A[2]) * t) + ')';
  }
  function rgba(hex, a) {
    var c = hex2rgb(hex);
    return 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + a + ')';
  }

  /* ---------------------------------------------------------------- symbols */
  var SYMS = {
    flame: function (c, r) {
      c.beginPath();
      c.moveTo(r * 0.34, -r * 0.96);
      c.bezierCurveTo(r * 0.74, -r * 0.42, r * 0.82, r * 0.12, r * 0.46, r * 0.56);
      c.bezierCurveTo(r * 0.22, r * 0.86, -r * 0.28, r * 0.92, -r * 0.52, r * 0.52);
      c.bezierCurveTo(-r * 0.74, r * 0.16, -r * 0.54, -r * 0.34, -r * 0.12, -r * 0.50);
      c.bezierCurveTo(-r * 0.20, -r * 0.70, r * 0.10, -r * 0.82, r * 0.34, -r * 0.96);
      c.closePath();
    },
    drop: function (c, r) {
      c.beginPath();
      c.moveTo(0, -r * 1.05);
      c.bezierCurveTo(r * 0.46, -r * 0.30, r * 0.80, r * 0.06, r * 0.72, r * 0.42);
      c.bezierCurveTo(r * 0.62, r * 0.90, -r * 0.62, r * 0.90, -r * 0.72, r * 0.42);
      c.bezierCurveTo(-r * 0.80, r * 0.06, -r * 0.46, -r * 0.30, 0, -r * 1.05);
      c.closePath();
    },
    key: function (c, r) {
      c.beginPath();
      c.arc(0, -r * 0.42, r * 0.42, 0, Math.PI * 2);
      c.moveTo(0, 0);
      c.lineTo(0, r * 0.95);
      c.moveTo(0, r * 0.52);
      c.lineTo(r * 0.42, r * 0.52);
      c.moveTo(0, r * 0.8);
      c.lineTo(r * 0.3, r * 0.8);
      c.stroke();
    },
    bird: function (c, r) {
      c.beginPath();
      c.moveTo(-r, r * 0.35);
      c.quadraticCurveTo(-r * 0.35, -r * 0.62, 0, -r * 0.05);
      c.quadraticCurveTo(r * 0.35, -r * 0.62, r, r * 0.35);
      c.quadraticCurveTo(r * 0.42, r * 0.05, 0, r * 0.5);
      c.quadraticCurveTo(-r * 0.42, r * 0.05, -r, r * 0.35);
      c.closePath();
    },
    bell: function (c, r) {
      c.beginPath();
      c.moveTo(-r * 0.78, r * 0.55);
      c.quadraticCurveTo(-r * 0.72, -r * 0.85, 0, -r * 0.9);
      c.quadraticCurveTo(r * 0.72, -r * 0.85, r * 0.78, r * 0.55);
      c.closePath();
      c.moveTo(-r * 0.9, r * 0.62);
      c.lineTo(r * 0.9, r * 0.62);
      c.moveTo(0, -r * 0.95);
      c.lineTo(0, -r * 1.15);
      c.stroke();
    },
    coin: function (c, r) {
      c.beginPath();
      c.arc(0, 0, r * 0.88, 0, Math.PI * 2);
      c.moveTo(-r * 0.34, 0);
      c.lineTo(r * 0.34, 0);
      c.stroke();
    },
    oar: function (c, r) {
      c.beginPath();
      c.moveTo(0, -r);
      c.lineTo(0, r * 0.35);
      c.moveTo(0, r * 0.35);
      c.bezierCurveTo(r * 0.55, r * 0.55, r * 0.5, r, 0, r);
      c.bezierCurveTo(-r * 0.5, r, -r * 0.55, r * 0.55, 0, r * 0.35);
      c.stroke();
    },
    wave: function (c, r) {
      c.beginPath();
      for (var i = 0; i < 3; i++) {
        var y = -r * 0.5 + i * r * 0.5;
        c.moveTo(-r, y);
        c.bezierCurveTo(-r * 0.5, y - r * 0.3, -r * 0.16, y + r * 0.3, 0, y);
        c.bezierCurveTo(r * 0.16, y - r * 0.3, r * 0.5, y + r * 0.3, r, y);
      }
      c.stroke();
    },
    star: function (c, r) {
      c.beginPath();
      for (var i = 0; i < 8; i++) {
        var a = i * Math.PI / 4, rad = (i % 2 === 0) ? r : r * 0.34;
        var x = Math.cos(a) * rad, y = Math.sin(a) * rad;
        if (i === 0) c.moveTo(x, y); else c.lineTo(x, y);
      }
      c.closePath();
    }
  };

  function paintSymbol(ctx, name, cx, cy, r, color, alpha, glow) {
    var fn = SYMS[name];
    if (!fn) return;
    ctx.save();
    ctx.globalAlpha = alpha === undefined ? 1 : alpha;
    ctx.translate(cx, cy);
    ctx.strokeStyle = color; ctx.fillStyle = color;
    ctx.lineWidth = Math.max(1.4, r * 0.14);
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    if (glow) { ctx.shadowColor = color; ctx.shadowBlur = glow; }
    fn(ctx, r);
    if (name === 'key' || name === 'bell' || name === 'coin' || name === 'oar' || name === 'wave') ctx.stroke();
    else ctx.fill();
    ctx.restore();
  }

  function paintSymbolToCanvas(cv, name, color) {
    var c = cv.getContext('2d');
    var s = cv.width;
    c.clearRect(0, 0, s, s);
    paintSymbol(c, name, s / 2, s / 2, s * 0.3, color, 1, 12);
  }

  /* ---------------------------------------------------------------- layout */
  function computeLayout() {
    L.W = W; L.H = H;
    L.cx = W * 0.5;
    L.horizon = H * 0.455;
    L.floorY = H * 0.79;
    L.baseY = H * 0.652;
    L.flameH = H * 0.178;
    L.glassTop = H * 0.452;
    L.glassBot = H * 0.700;
    L.glassW = Math.min(W * 0.052, 76);
    L.ringCX = L.cx;
    L.ringCY = L.baseY - L.flameH * 0.50;
    L.ringR = Math.min(H * 0.200, W * 0.140);
    L.doorY = H * 0.235;
    L.ceilY = H * 0.075;
  }

  function resize() {
    DPR = Math.min(global.devicePixelRatio || 1, 2);
    W = global.innerWidth; H = global.innerHeight;
    // the backdrop runs at full device resolution...
    bg.width = Math.round(W * DPR); bg.height = Math.round(H * DPR);
    bg.style.width = W + 'px'; bg.style.height = H + 'px';
    // ...and so does the foreground layer (the flame layer keeps its own smaller buffer)
    fx.width = Math.round(W * DPR); fx.height = Math.round(H * DPR);
    fx.style.width = W + 'px'; fx.style.height = H + 'px';
    bgx = bg.getContext('2d'); fxx = fx.getContext('2d');
    bgx.setTransform(DPR, 0, 0, DPR, 0, 0);
    fxx.setTransform(DPR, 0, 0, DPR, 0, 0);
    computeLayout();
    buildScenery();
  }

  /* ---------------------------------------------------------------- scenery */
  function buildScenery() {
    var r = U.mulberry(90210);
    stars = [];
    for (var i = 0; i < 210; i++) {
      var sx = r() * W;
      var sy = r() * L.horizon * 1.0;
      var mag = r();
      stars.push({ x: sx, y: sy, r: 0.35 + mag * mag * 1.5, a: 0.16 + r() * 0.78, tw: r() * 6.28, sp: 0.4 + r() * 1.6 });
    }

    // The town of Vell: two clusters on the shore, sea (and the moon path) between.
    town = []; windows = [];
    function cluster(x0, x1, count) {
      var x = x0;
      for (var i = 0; i < count; i++) {
        var kindRoll = r();
        var kind = kindRoll < 0.06 ? 'tower' : (kindRoll < 0.28 ? 'gable' : (kindRoll < 0.40 ? 'step' : 'flat'));
        var bw, bh;
        if (kind === 'tower') { bw = W * (0.016 + r() * 0.010); bh = H * (0.050 + r() * 0.036); }
        else if (kind === 'step') { bw = W * (0.020 + r() * 0.018); bh = H * (0.028 + r() * 0.032); }
        else if (kind === 'gable') { bw = W * (0.020 + r() * 0.022); bh = H * (0.016 + r() * r() * 0.030); }
        else { bw = W * (0.022 + r() * 0.030); bh = H * (0.012 + r() * r() * 0.028); }
        var base = L.horizon + H * 0.016 - r() * H * 0.014;
        var y = base - bh;
        town.push({ x: x, y: y, w: bw, h: bh, base: base, kind: kind, roof: r() });
        var nw = Math.max(1, Math.round(bw / (W * 0.0115)));
        for (var k = 0; k < nw; k++) {
          if (r() < 0.22) continue;
          windows.push({
            x: x + bw * ((k + 0.5) / nw) - W * 0.0013,
            y: y + bh * (0.20 + r() * 0.52),
            w: W * 0.0026, h: H * 0.0072,
            lit: 0, target: 0
          });
        }
        x += bw + W * (0.004 + r() * 0.016);
        if (x > x1) break;
      }
    }
    cluster(-W * 0.01, W * 0.325, 18);
    cluster(W * 0.665, W * 1.01, 18);

    // grain tile
    grainTile = document.createElement('canvas');
    grainTile.width = grainTile.height = 128;
    var gc = grainTile.getContext('2d');
    var id = gc.createImageData(128, 128);
    for (var p = 0; p < id.data.length; p += 4) {
      var v = Math.random() * 255;
      id.data[p] = id.data[p + 1] = id.data[p + 2] = v;
      id.data[p + 3] = 26;
    }
    gc.putImageData(id, 0, 0);
  }

  /* ---------------------------------------------------------------- back */
  function drawSky(c, G, t) {
    var d = G.dawn;
    var g = c.createLinearGradient(0, 0, 0, L.horizon * 1.08);
    g.addColorStop(0.00, mixc('#04060d', '#16254c', d));
    g.addColorStop(0.44, mixc('#080d1c', '#4a4a80', d));
    g.addColorStop(0.78, mixc('#111c36', '#b8757e', d));
    g.addColorStop(1.00, mixc('#1b2a4c', '#ffc477', d));
    c.fillStyle = g;
    c.fillRect(0, 0, W, L.horizon * 1.10);
  }

  function drawStars(c, G, t) {
    var a = (1 - G.dawn) * (1 - G.storm * 0.9);
    if (a <= 0.01) return;
    for (var i = 0; i < stars.length; i++) {
      var s = stars[i];
      var tw = 0.62 + 0.38 * Math.sin(t * s.sp + s.tw);
      c.globalAlpha = s.a * tw * a;
      c.fillStyle = '#dfe8ff';
      c.fillRect(s.x - s.r * 0.5, s.y - s.r * 0.5, s.r, s.r);
    }
    c.globalAlpha = 1;
  }

  function drawMoon(c, G, t) {
    var d = G.dawn;
    if (d > 0.88) return;
    var mx = W * 0.80, my = L.horizon * 0.40;
    var r = Math.min(W, H) * 0.030;
    var a = (1 - d) * (1 - G.storm * 0.95);
    var halo = c.createRadialGradient(mx, my, r * 0.7, mx, my, r * 8);
    halo.addColorStop(0, 'rgba(190,212,255,' + (0.22 * a) + ')');
    halo.addColorStop(1, 'rgba(190,212,255,0)');
    c.fillStyle = halo; c.beginPath(); c.arc(mx, my, r * 8, 0, 6.2832); c.fill();
    c.globalAlpha = a;
    var mg = c.createRadialGradient(mx - r * 0.3, my - r * 0.3, r * 0.2, mx, my, r);
    mg.addColorStop(0, '#ffffff'); mg.addColorStop(1, '#d8e2f8');
    c.fillStyle = mg;
    c.beginPath(); c.arc(mx, my, r, 0, 6.2832); c.fill();
    c.globalAlpha = a * 0.32;
    c.fillStyle = '#a9b6d6';
    c.beginPath(); c.arc(mx - r * 0.32, my - r * 0.28, r * 0.2, 0, 6.2832); c.fill();
    c.beginPath(); c.arc(mx + r * 0.3, my + r * 0.22, r * 0.14, 0, 6.2832); c.fill();
    c.globalAlpha = 1;
  }

  function drawSeaAndTown(c, G, t) {
    var d = G.dawn;
    var sg = c.createLinearGradient(0, L.horizon, 0, L.floorY);
    sg.addColorStop(0, mixc('#09121f', '#4a4a70', d));
    sg.addColorStop(0.40, mixc('#060c18', '#2c3050', d));
    sg.addColorStop(1, mixc('#03060c', '#0e1326', d));
    c.fillStyle = sg;
    c.fillRect(0, L.horizon, W, L.floorY - L.horizon + 2);
    // the last light along the horizon
    c.save();
    c.globalAlpha = 0.5 * (1 - G.storm * 0.75);
    c.strokeStyle = mixc('#4a6a9a', '#f0b478', d);
    c.lineWidth = 1.4;
    c.beginPath(); c.moveTo(0, L.horizon + 0.5); c.lineTo(W, L.horizon + 0.5); c.stroke();
    c.restore();

    // moon path
    var mx = W * 0.80;
    c.save();
    c.globalAlpha = (1 - d) * 0.20 * (1 - G.storm * 0.85);
    var pg = c.createLinearGradient(mx, L.horizon, mx, L.floorY);
    pg.addColorStop(0, 'rgba(198,216,255,0.6)');
    pg.addColorStop(1, 'rgba(198,216,255,0)');
    c.fillStyle = pg;
    c.beginPath();
    c.moveTo(mx - 14, L.horizon); c.lineTo(mx + 14, L.horizon);
    c.lineTo(mx + 96, L.floorY); c.lineTo(mx - 96, L.floorY);
    c.closePath(); c.fill();
    c.restore();

    // swell
    c.save();
    c.strokeStyle = mixc('#33496f', '#77769c', d);
    c.lineWidth = 1;
    for (var i = 0; i < 16; i++) {
      var y = L.horizon + 3 + i * ((L.floorY - L.horizon) / 16);
      c.globalAlpha = 0.20 - i * 0.010;
      c.beginPath();
      for (var x = 0; x <= W; x += 22) {
        var yy = y + Math.sin((x * 0.011) + t * 0.55 + i * 1.7) * (0.9 + i * 0.11);
        if (x === 0) c.moveTo(x, yy); else c.lineTo(x, yy);
      }
      c.stroke();
    }
    c.restore();

    // the lamp's own reflection on the water
    c.save();
    c.globalCompositeOperation = 'lighter';
    var lit = U.clamp(G.lightVis, 0, 1);
    var rg = c.createLinearGradient(L.cx, L.horizon, L.cx, L.floorY);
    rg.addColorStop(0, 'rgba(255,150,60,' + (0.05 * lit) + ')');
    rg.addColorStop(1, 'rgba(255,120,40,0)');
    c.fillStyle = rg;
    c.beginPath();
    c.moveTo(L.cx - 12, L.horizon); c.lineTo(L.cx + 12, L.horizon);
    c.lineTo(L.cx + 54, L.floorY); c.lineTo(L.cx - 54, L.floorY);
    c.closePath(); c.fill();
    c.restore();

    // mist at the horizon
    c.save();
    var mg2 = c.createLinearGradient(0, L.horizon - H * 0.05, 0, L.horizon + H * 0.06);
    mg2.addColorStop(0, 'rgba(120,150,190,0)');
    mg2.addColorStop(0.5, 'rgba(120,150,190,' + (0.10 * (1 - G.storm * 0.4)) + ')');
    mg2.addColorStop(1, 'rgba(120,150,190,0)');
    c.fillStyle = mg2;
    c.fillRect(0, L.horizon - H * 0.05, W, H * 0.11);
    c.restore();

    // the town
    for (var b = 0; b < town.length; b++) {
      var h = town[b];
      c.fillStyle = mixc('#080c17', '#1c2036', d);
      c.beginPath();
      c.moveTo(h.x, h.base + H * 0.008);
      c.lineTo(h.x, h.y);
      if (h.kind === 'gable') {
        c.lineTo(h.x + h.w * 0.5, h.y - h.h * 0.34);
        c.lineTo(h.x + h.w, h.y);
      } else if (h.kind === 'step') {
        c.lineTo(h.x + h.w, h.y);
      } else if (h.kind === 'tower') {
        c.lineTo(h.x + h.w * 0.34, h.y - h.h * 0.07);
        c.lineTo(h.x + h.w * 0.66, h.y - h.h * 0.07);
        c.lineTo(h.x + h.w, h.y);
      }
      c.lineTo(h.x + h.w, h.base + H * 0.008);
      c.closePath();
      c.fill();
      if (h.kind === 'step') {
        c.fillRect(h.x + h.w * 0.22, h.y - h.h * 0.30, h.w * 0.56, h.h * 0.31);
      }
      // a faint rim of moonlight on the seaward edge
      c.strokeStyle = 'rgba(130,160,210,' + (0.20 * (1 - d) * (1 - G.storm * 0.7)) + ')';
      c.lineWidth = 1;
      c.beginPath();
      c.moveTo(h.x + h.w, h.base + H * 0.008);
      c.lineTo(h.x + h.w, h.y);
      c.stroke();
    }
    // a jetty with lamps, on the right shore
    c.strokeStyle = mixc('#0a0f1c', '#232741', d);
    c.lineWidth = 1.6;
    c.beginPath();
    c.moveTo(W * 0.60, L.horizon + H * 0.028);
    c.lineTo(W * 0.70, L.horizon + H * 0.020);
    c.stroke();
    for (var j = 0; j < 3; j++) {
      var jx = W * (0.615 + j * 0.030);
      var jy = L.horizon + H * (0.027 - j * 0.0028);
      var jg = c.createRadialGradient(jx, jy, 0, jx, jy, 9);
      jg.addColorStop(0, 'rgba(255,206,140,0.85)');
      jg.addColorStop(1, 'rgba(255,180,90,0)');
      c.fillStyle = jg;
      c.beginPath(); c.arc(jx, jy, 9, 0, 6.2832); c.fill();
    }
    // a small boat, still out — the one Act IV is about
    var boatX = W * 0.575, boatY = L.horizon + H * 0.075;
    c.fillStyle = mixc('#0a0f1b', '#1e2237', d);
    c.beginPath();
    c.moveTo(boatX - 13, boatY);
    c.quadraticCurveTo(boatX, boatY + 5, boatX + 13, boatY);
    c.closePath(); c.fill();
    c.fillRect(boatX - 1, boatY - 9, 2, 9);
    var bg3 = c.createRadialGradient(boatX, boatY - 11, 0, boatX, boatY - 11, 13);
    bg3.addColorStop(0, 'rgba(255,214,150,0.95)');
    bg3.addColorStop(0.3, 'rgba(255,180,90,0.45)');
    bg3.addColorStop(1, 'rgba(255,160,70,0)');
    c.fillStyle = bg3;
    c.beginPath(); c.arc(boatX, boatY - 11, 13, 0, 6.2832); c.fill();
    c.fillStyle = 'rgba(255,236,200,0.95)';
    c.beginPath(); c.arc(boatX, boatY - 11, 1.7, 0, 6.2832); c.fill();
    // lit windows
    var lit2 = G.cityLit;
    for (var w = 0; w < windows.length; w++) {
      var win = windows[w];
      var want = (w / windows.length) < lit2 ? 1 : 0;
      win.target = want;
      win.lit += (win.target - win.lit) * 0.05;
      if (win.lit <= 0.01) continue;
      c.globalAlpha = win.lit * (0.82 + 0.18 * Math.sin(t * 1.6 + w));
      c.fillStyle = '#ffd08a';
      c.fillRect(win.x, win.y, win.w, win.h);
      c.globalAlpha = win.lit * 0.20;
      c.fillStyle = '#ffb055';
      c.beginPath(); c.arc(win.x + win.w / 2, win.y + win.h / 2, win.w * 3.2, 0, 6.2832); c.fill();
    }
    c.globalAlpha = 1;
  }

  function drawGlassWall(c, G, t) {
    var lit = G.lightVis;
    var top = L.ceilY, bot = L.floorY;
    var nBars = 21;
    var cg = c.createLinearGradient(0, 0, 0, top + 14);
    cg.addColorStop(0, '#020308'); cg.addColorStop(1, mixc('#070911', '#231e2b', G.dawn));
    c.fillStyle = cg; c.fillRect(0, 0, W, top + 8);
    c.save();
    c.globalAlpha = 0.6;
    c.fillStyle = '#03050a';
    c.beginPath(); c.moveTo(0, 0); c.lineTo(W * 0.20, 0); c.lineTo(0, H * 0.19); c.closePath(); c.fill();
    c.beginPath(); c.moveTo(W, 0); c.lineTo(W * 0.80, 0); c.lineTo(W, H * 0.19); c.closePath(); c.fill();
    c.restore();

    var lightAt = function (x, y) {
      var dx = (x - L.cx) / (W * 0.26), dy = (y - L.ringCY) / (H * 0.30);
      return Math.exp(-(dx * dx + dy * dy) * 1.5) * lit;
    };

    for (var i = 0; i <= nBars; i++) {
      var x = (i / nBars) * W;
      var bow = (x - L.cx) / W;
      var off = bow * bow * W * 0.062;
      var l = lightAt(x, (top + bot) / 2);
      c.beginPath();
      c.moveTo(x, top);
      c.quadraticCurveTo(x + off, (top + bot) / 2, x, bot);
      c.strokeStyle = mixc('#080a10', '#211a16', G.dawn);
      c.lineWidth = 3.2 + 2.4 * Math.abs(bow);
      c.stroke();
      if (l > 0.02) {
        c.strokeStyle = 'rgba(' + Math.round(210 + 45 * l) + ',' + Math.round(150 + 60 * l) + ',' + Math.round(70 + 40 * l) + ',' + (0.03 + 0.48 * l) + ')';
        c.lineWidth = 1.2;
        c.beginPath();
        var s2 = x < L.cx ? -1.5 : 1.5;
        c.moveTo(x + s2, top);
        c.quadraticCurveTo(x + off + s2, (top + bot) / 2, x + s2, bot);
        c.stroke();
      }
    }
    var rails = [top + 6, H * 0.285, H * 0.475, L.floorY - 2];
    for (var r = 0; r < rails.length; r++) {
      var y = rails[r];
      var l2 = lightAt(L.cx, y);
      c.strokeStyle = mixc('#080a10', '#211a16', G.dawn);
      c.lineWidth = r === 0 || r === rails.length - 1 ? 6 : 4;
      c.beginPath(); c.moveTo(0, y); c.lineTo(W, y); c.stroke();
      if (l2 > 0.02) {
        c.strokeStyle = 'rgba(235,180,100,' + (0.03 + 0.40 * l2) + ')';
        c.lineWidth = 1.1;
        c.beginPath(); c.moveTo(0, y - 2); c.lineTo(W, y - 2); c.stroke();
      }
    }
  }

  function drawFloor(c, G, t) {
    var lit = G.lightVis;
    var fg2 = c.createLinearGradient(0, L.floorY, 0, H);
    fg2.addColorStop(0, mixc('#06070b', '#1b1820', G.dawn));
    fg2.addColorStop(1, '#020306');
    c.fillStyle = fg2;
    c.fillRect(0, L.floorY, W, H - L.floorY);

    c.save();
    c.globalCompositeOperation = 'lighter';
    var pg = c.createRadialGradient(L.cx, L.floorY + 4, 4, L.cx, L.floorY + 4, W * 0.40);
    pg.addColorStop(0, 'rgba(255,170,76,' + (0.32 * lit) + ')');
    pg.addColorStop(0.4, 'rgba(255,130,48,' + (0.10 * lit) + ')');
    pg.addColorStop(1, 'rgba(255,110,30,0)');
    c.fillStyle = pg;
    c.beginPath(); c.ellipse(L.cx, L.floorY + 4, W * 0.40, H * 0.085, 0, 0, 6.2832); c.fill();
    c.restore();

    c.save();
    c.strokeStyle = '#000';
    c.lineWidth = 2;
    for (var i = 0; i < 12; i++) {
      var y = L.floorY + 3 + i * i * 0.7;
      if (y > H) break;
      c.globalAlpha = 0.55 - i * 0.035;
      c.beginPath(); c.moveTo(0, y); c.lineTo(W, y); c.stroke();
    }
    c.restore();
  }

  function drawBack(G, t) {
    var c = bgx;
    c.clearRect(0, 0, W, H);
    c.fillStyle = '#03050a';
    c.fillRect(0, 0, W, H);
    drawSky(c, G, t);
    drawStars(c, G, t);
    drawMoon(c, G, t);
    drawSeaAndTown(c, G, t);
    drawGlassWall(c, G, t);
    drawFloor(c, G, t);
  }

  /* ---------------------------------------------------------------- front */
  /* brass metal: shade 0 = cold silhouette, 1 = white-hot brass */
  function metal(lit, s) {
    s = U.clamp(s, 0, 1);
    var l = U.clamp(lit, 0, 1.2);
    return 'rgb(' + Math.round(14 + 216 * l * s) + ',' + Math.round(12 + 158 * l * s) + ',' + Math.round(12 + 78 * l * s) + ')';
  }
  function metalA(lit, s, a) {
    s = U.clamp(s, 0, 1);
    var l = U.clamp(lit, 0, 1.2);
    return 'rgba(' + Math.round(14 + 216 * l * s) + ',' + Math.round(12 + 158 * l * s) + ',' + Math.round(12 + 78 * l * s) + ',' + a + ')';
  }

  function drawShafts(c, G, t) {
    var lit = U.clamp(G.lightVis, 0, 1);
    if (lit < 0.02) return;
    c.save();
    c.globalCompositeOperation = 'lighter';
    for (var i = 0; i < 7; i++) {
      var a = -Math.PI * 0.94 + (i / 6) * Math.PI * 0.88;
      var len = L.ringR * (2.0 + 0.5 * Math.sin(t * 0.5 + i));
      var wid = 0.055 + 0.02 * Math.sin(t * 0.31 + i * 2.1);
      var ex = L.cx + Math.cos(a) * len, ey = L.ringCY + Math.sin(a) * len;
      var g = c.createLinearGradient(L.cx, L.ringCY, ex, ey);
      g.addColorStop(0, 'rgba(255,175,85,' + (0.055 * lit) + ')');
      g.addColorStop(1, 'rgba(255,140,50,0)');
      c.fillStyle = g;
      c.beginPath();
      c.moveTo(L.cx, L.ringCY);
      c.lineTo(ex - Math.sin(a) * len * wid, ey + Math.cos(a) * len * wid);
      c.lineTo(ex + Math.sin(a) * len * wid, ey - Math.cos(a) * len * wid);
      c.closePath();
      c.fill();
    }
    c.restore();
  }

  function drawLantern(c, G, t) {
    var lit = U.clamp(G.lightVis, 0, 1.2);
    var cx = L.cx;
    var gw = L.glassW, gt = L.glassTop, gb = L.glassBot;
    var fy = L.baseY;

    // glass body tint (over the flame so it reads as glass)
    c.save();
    var gg = c.createLinearGradient(cx - gw, gt, cx + gw, gb);
    gg.addColorStop(0, 'rgba(26,38,56,0.32)');
    gg.addColorStop(0.30, 'rgba(255,222,175,0.02)');
    gg.addColorStop(0.58, 'rgba(255,238,205,0.055)');
    gg.addColorStop(1, 'rgba(18,26,42,0.34)');
    c.fillStyle = gg;
    c.beginPath();
    c.moveTo(cx - gw, gb);
    c.lineTo(cx - gw * 0.93, gt + 8);
    c.quadraticCurveTo(cx, gt - 10, cx + gw * 0.93, gt + 8);
    c.lineTo(cx + gw, gb);
    c.closePath();
    c.fill();
    c.restore();

    // ---- pedestal -------------------------------------------------------
    var pw0 = gw * 1.05, pw1 = gw * 1.72;
    var pg = c.createLinearGradient(0, gb, 0, H);
    pg.addColorStop(0, metal(lit * 0.85, 0.95));
    pg.addColorStop(0.35, metal(lit * 0.7, 0.62));
    pg.addColorStop(1, metal(lit * 0.45, 0.16));
    c.beginPath();
    c.moveTo(cx - pw1, H * 0.985);
    c.lineTo(cx - pw0, gb + 3);
    c.lineTo(cx + pw0, gb + 3);
    c.lineTo(cx + pw1, H * 0.985);
    c.closePath();
    c.fillStyle = pg;
    c.fill();
    // side shading
    var sg3 = c.createLinearGradient(cx - pw1, 0, cx + pw1, 0);
    sg3.addColorStop(0, 'rgba(0,0,0,0.55)');
    sg3.addColorStop(0.5, 'rgba(0,0,0,0)');
    sg3.addColorStop(1, 'rgba(0,0,0,0.55)');
    c.fillStyle = sg3;
    c.fill();
    // recessed panel
    c.beginPath();
    c.moveTo(cx - pw1 * 0.58, H * 0.985);
    c.lineTo(cx - pw0 * 0.52, gb + 16);
    c.lineTo(cx + pw0 * 0.52, gb + 16);
    c.lineTo(cx + pw1 * 0.58, H * 0.985);
    c.closePath();
    c.fillStyle = 'rgba(0,0,0,0.45)';
    c.fill();

    // ---- rings ----------------------------------------------------------
    function ring(cy, rx, ry, shade) {
      var rg2 = c.createLinearGradient(0, cy - ry, 0, cy + ry);
      rg2.addColorStop(0, metal(lit, shade * 0.35));
      rg2.addColorStop(0.45, metal(lit, shade));
      rg2.addColorStop(1, metal(lit, shade * 0.22));
      c.fillStyle = rg2;
      c.beginPath(); c.ellipse(cx, cy, rx, ry, 0, 0, 6.2832); c.fill();
    }
    ring(gb, gw * 1.10, H * 0.0135, 0.95);
    c.fillStyle = 'rgba(0,0,0,0.30)';
    c.beginPath(); c.ellipse(cx, gb + H * 0.0035, gw * 0.94, H * 0.0085, 0, 0, 6.2832); c.fill();
    ring(gt + 7, gw * 1.00, H * 0.0115, 0.90);

    // ---- cage struts (in front of the glass → they occlude the flame) -----
    var strutXs = [-0.99, -0.38, 0.38, 0.99];
    for (var i = 0; i < strutXs.length; i++) {
      var sx = cx + strutXs[i] * gw;
      var inner = strutXs[i] < 0 ? 1 : -1;
      var sg2 = c.createLinearGradient(sx - inner * 3, 0, sx + inner * 3, 0);
      sg2.addColorStop(0, metal(lit, 0.22));
      sg2.addColorStop(0.55, metal(lit, 0.95));
      sg2.addColorStop(1, metal(lit, 0.38));
      c.beginPath();
      c.moveTo(sx, gb);
      c.lineTo(sx, gt + 7);
      c.strokeStyle = sg2;
      c.lineWidth = 4.2;
      c.stroke();
      // specular sliver
      c.beginPath();
      c.moveTo(sx + inner * 1.6, gb); c.lineTo(sx + inner * 1.6, gt + 9);
      c.strokeStyle = metalA(lit, 1.25, 0.55);
      c.lineWidth = 1.1;
      c.stroke();
    }

    // ---- dome -----------------------------------------------------------
    var dg = c.createLinearGradient(0, gt - 30, 0, gt + 8);
    dg.addColorStop(0, metal(lit, 0.55));
    dg.addColorStop(0.55, metal(lit, 0.92));
    dg.addColorStop(1, metal(lit, 0.28));
    c.beginPath();
    c.moveTo(cx - gw * 0.99, gt + 7);
    c.quadraticCurveTo(cx - gw * 0.72, gt - 24, cx, gt - 28);
    c.quadraticCurveTo(cx + gw * 0.72, gt - 24, cx + gw * 0.99, gt + 7);
    c.closePath();
    c.fillStyle = dg;
    c.fill();
    // hot underside catching the flame
    c.save();
    c.globalCompositeOperation = 'lighter';
    c.beginPath();
    c.ellipse(cx, gt + 7, gw * 0.92, H * 0.010, 0, 0, 6.2832);
    c.fillStyle = 'rgba(255,170,80,' + (0.30 * lit) + ')';
    c.fill();
    c.restore();
    // finial
    c.fillStyle = metal(lit, 0.7);
    c.beginPath(); c.ellipse(cx, gt - 28, gw * 0.17, H * 0.0068, 0, 0, 6.2832); c.fill();
    c.beginPath();
    c.moveTo(cx - 2.2, gt - 30); c.lineTo(cx + 2.2, gt - 30); c.lineTo(cx, gt - 45); c.closePath();
    c.fill();

    // ---- glow caught on the metal --------------------------------------
    c.save();
    c.globalCompositeOperation = 'lighter';
    var ag = c.createRadialGradient(cx, fy - L.flameH * 0.25, 3, cx, fy - L.flameH * 0.25, gw * 2.0);
    ag.addColorStop(0, 'rgba(255,195,115,' + (0.22 * lit) + ')');
    ag.addColorStop(1, 'rgba(255,150,60,0)');
    c.fillStyle = ag;
    c.beginPath(); c.arc(cx, fy - L.flameH * 0.25, gw * 2.0, 0, 6.2832); c.fill();
    c.restore();
  }

  function drawRing(c, G, t) {
    var R = G.ring;
    if (R.alpha <= 0.01) return;
    var cx = L.ringCX, cy = L.ringCY, r = L.ringR;
    c.save();
    c.globalAlpha = R.alpha;
    c.strokeStyle = 'rgba(206,162,90,0.34)';
    c.lineWidth = 1.2;
    c.beginPath(); c.arc(cx, cy, r, 0, 6.2832); c.stroke();
    c.strokeStyle = 'rgba(206,162,90,0.15)';
    c.beginPath(); c.arc(cx, cy, r * 0.92, 0, 6.2832); c.stroke();
    for (var i = 0; i < 36; i++) {
      var a = i * Math.PI / 18;
      var long = (i % 3 === 0);
      c.beginPath();
      c.moveTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
      c.lineTo(cx + Math.cos(a) * (r + (long ? 8 : 4)), cy + Math.sin(a) * (r + (long ? 8 : 4)));
      c.strokeStyle = 'rgba(206,162,90,' + (long ? 0.34 : 0.16) + ')';
      c.lineWidth = long ? 1.4 : 0.9;
      c.stroke();
    }
    if (R.showArc) {
      c.save();
      c.shadowColor = 'rgba(255,170,70,1)';
      c.shadowBlur = 26;
      c.strokeStyle = 'rgba(255,214,150,' + (0.72 + 0.24 * Math.sin(t * 5)) + ')';
      c.lineWidth = 6;
      c.lineCap = 'round';
      c.beginPath();
      c.arc(cx, cy, r, R.arcPos - R.arcHalf, R.arcPos + R.arcHalf);
      c.stroke();
      c.restore();
      c.strokeStyle = 'rgba(255,236,190,0.45)';
      c.lineWidth = 1.6;
      c.beginPath();
      c.arc(cx, cy, r * 0.95, R.arcPos - R.arcHalf * 0.85, R.arcPos + R.arcHalf * 0.85);
      c.stroke();
    }
    var ma = R.marker;
    var bx = cx + Math.cos(ma) * r, by = cy + Math.sin(ma) * r;
    c.save();
    c.shadowColor = 'rgba(255,215,150,0.95)';
    c.shadowBlur = 26;
    var bg2 = c.createRadialGradient(bx, by, 0, bx, by, 15);
    bg2.addColorStop(0, '#fff8e8');
    bg2.addColorStop(0.32, 'rgba(255,192,112,0.92)');
    bg2.addColorStop(1, 'rgba(255,140,50,0)');
    c.fillStyle = bg2;
    c.beginPath(); c.arc(bx, by, 15, 0, 6.2832); c.fill();
    c.restore();
    c.fillStyle = '#fffaf0';
    c.beginPath(); c.arc(bx, by, 3.4, 0, 6.2832); c.fill();
    c.restore();
  }

  function drawBraces(c, G, t) {
    var B = G.braces;
    if (!B || !B.alpha) return;
    var cx = L.ringCX, cy = L.ringCY, r = L.ringR;
    var dirs = [
      { a: -Math.PI / 2, key: 'W' },
      { a: 0, key: 'D' },
      { a: Math.PI / 2, key: 'S' },
      { a: Math.PI, key: 'A' }
    ];
    c.save();
    c.globalAlpha = B.alpha;
    for (var i = 0; i < dirs.length; i++) {
      var d = dirs[i];
      var px = cx + Math.cos(d.a) * r, py = cy + Math.sin(d.a) * r;
      c.save();
      c.translate(px, py);
      c.rotate(d.a + Math.PI / 2);
      c.strokeStyle = 'rgba(206,162,90,0.45)';
      c.lineWidth = 2;
      c.beginPath();
      c.moveTo(-12, -11); c.lineTo(-12, 9); c.lineTo(12, 9); c.lineTo(12, -11);
      c.stroke();
      c.restore();
      c.font = '600 10px ui-monospace, Menlo, monospace';
      c.textAlign = 'center'; c.textBaseline = 'middle';
      c.fillStyle = 'rgba(206,162,90,0.6)';
      c.fillText(d.key, px + Math.cos(d.a) * 21, py + Math.sin(d.a) * 21);
    }
    for (var g = 0; g < B.gusts.length; g++) {
      var gu = B.gusts[g];
      var d2 = dirs[gu.dir];
      var prog = U.clamp(gu.p, 0, 1);
      var rr = r + 130 * (1 - prog);
      var gx = cx + Math.cos(d2.a) * rr, gy = cy + Math.sin(d2.a) * rr;
      var near = 1 - prog;
      var col = gu.dir === 0 ? '255,140,90' : gu.dir === 1 ? '140,190,255' : gu.dir === 2 ? '255,215,130' : '150,255,190';
      c.save();
      c.globalAlpha = B.alpha * (0.25 + 0.75 * near);
      c.shadowColor = 'rgba(' + col + ',0.9)';
      c.shadowBlur = 22;
      c.fillStyle = 'rgba(' + col + ',0.88)';
      c.save();
      c.translate(gx, gy);
      c.rotate(d2.a + Math.PI);
      c.beginPath();
      c.moveTo(0, -17); c.lineTo(12, 7); c.lineTo(0, 0); c.lineTo(-12, 7);
      c.closePath();
      c.fill();
      c.restore();
      c.globalAlpha = B.alpha * 0.32 * near;
      c.strokeStyle = 'rgba(' + col + ',0.8)';
      c.lineWidth = 3;
      c.beginPath();
      c.moveTo(gx + Math.cos(d2.a) * 46, gy + Math.sin(d2.a) * 46);
      c.lineTo(gx, gy);
      c.stroke();
      c.restore();
    }
    c.restore();
  }

  function drawDoorMeter(c, G, t) {
    var D = G.door;
    if (!D || D.alpha <= 0.01) return;
    var w = W * 0.36, x0 = (W - w) / 2, y = L.doorY;
    c.save();
    c.globalAlpha = D.alpha;
    c.fillStyle = 'rgba(206,162,90,0.15)';
    c.fillRect(x0, y - 2, w, 4);
    c.strokeStyle = 'rgba(206,162,90,0.38)';
    c.lineWidth = 1;
    c.strokeRect(x0 + 0.5, y - 2.5, w - 1, 5);
    // label
    c.font = '600 9.5px ui-monospace, Menlo, monospace';
    c.textAlign = 'center'; c.textBaseline = 'bottom';
    c.fillStyle = 'rgba(206,162,90,0.55)';
    c.letterSpacing = '4px';
    c.fillText('THE DOOR', x0 + w / 2, y - 12);
    c.letterSpacing = '0px';
    var zw = w * D.zoneW;
    var zx = x0 + (D.zone - 0.5) * w;
    c.save();
    c.shadowColor = 'rgba(255,180,90,0.95)'; c.shadowBlur = 18;
    c.fillStyle = 'rgba(255,190,110,0.45)';
    c.fillRect(zx - zw / 2, y - 6, zw, 12);
    c.restore();
    c.fillStyle = 'rgba(255,238,195,0.6)';
    c.fillRect(zx - zw / 2, y - 6, zw, 2);
    var mx = x0 + D.pos * w;
    c.save();
    c.shadowColor = 'rgba(255,240,210,0.95)'; c.shadowBlur = 20;
    var mg = c.createRadialGradient(mx, y, 0, mx, y, 13);
    mg.addColorStop(0, '#fff8ea'); mg.addColorStop(0.4, 'rgba(255,200,120,0.85)'); mg.addColorStop(1, 'rgba(255,140,50,0)');
    c.fillStyle = mg;
    c.beginPath(); c.arc(mx, y, 13, 0, 6.2832); c.fill();
    c.restore();
    c.fillStyle = '#fffaf0';
    c.beginPath(); c.arc(mx, y, 3.2, 0, 6.2832); c.fill();
    c.restore();
  }

  function drawVisitors(c, G, t) {
    var V = G.visitors;
    for (var i = 0; i < V.length; i++) {
      var v = V[i];
      if (v.alpha <= 0.01) continue;
      drawVisitor(c, v, t);
    }
  }

  function drawVisitor(c, v, t) {
    var side = v.x < L.cx ? 1 : -1;
    var s = v.scale;
    c.save();
    c.globalAlpha = v.alpha;
    c.translate(v.x, v.y);
    c.scale(s, s);

    c.fillStyle = 'rgba(4,5,9,0.97)';
    c.strokeStyle = 'rgba(4,5,9,0.97)';
    c.lineWidth = 6;
    c.lineCap = 'round';
    var body = new Path2D();
    var headY, headR, hatPath = null;
    switch (v.kind) {
      case 'ferryman':
        headY = -218; headR = 19;
        body.moveTo(-13, 0); body.lineTo(-12, -36); body.lineTo(-32, -74);
        body.lineTo(-26, -152); body.lineTo(-23, -198); body.lineTo(23, -198);
        body.lineTo(26, -152); body.lineTo(32, -74); body.lineTo(12, -36);
        body.lineTo(13, 0); body.lineTo(4, 0); body.lineTo(3, -32);
        body.lineTo(-3, -32); body.lineTo(-4, 0);
        body.closePath();
        break;
      case 'girl':
        headY = -152; headR = 19;
        body.moveTo(-10, 0); body.lineTo(-9, -30); body.lineTo(-24, -84);
        body.lineTo(-20, -124); body.lineTo(-19, -132); body.lineTo(19, -132);
        body.lineTo(20, -124); body.lineTo(24, -84); body.lineTo(9, -30);
        body.lineTo(10, 0); body.lineTo(3, 0); body.lineTo(2, -26);
        body.lineTo(-2, -26); body.lineTo(-3, 0);
        body.closePath();
        break;
      case 'sailor':
        headY = -194; headR = 19;
        body.moveTo(-12, 0); body.lineTo(-11, -34); body.lineTo(-30, -70);
        body.lineTo(-27, -124); body.lineTo(-26, -176); body.lineTo(26, -176);
        body.lineTo(27, -124); body.lineTo(30, -70); body.lineTo(11, -34);
        body.lineTo(12, 0); body.lineTo(4, 0); body.lineTo(3, -30);
        body.lineTo(-3, -30); body.lineTo(-4, 0);
        body.closePath();
        break;
      default:
        headY = -122; headR = 16;
        body.moveTo(-8, 0); body.lineTo(-7, -24); body.lineTo(-19, -58);
        body.lineTo(-16, -98); body.lineTo(-15, -104); body.lineTo(15, -104);
        body.lineTo(16, -98); body.lineTo(19, -58); body.lineTo(7, -24);
        body.lineTo(8, 0); body.lineTo(3, 0); body.lineTo(2, -22);
        body.lineTo(-2, -22); body.lineTo(-3, 0);
        body.closePath();
    }
    c.fill(body);
    c.beginPath(); c.arc(0, headY, headR, 0, 6.2832); c.fill();

    if (v.kind === 'ferryman') {
      c.beginPath(); c.ellipse(0, headY - 13, 31, 6, 0, 0, 6.2832); c.fill();
      hatPath = new Path2D(); hatPath.ellipse(0, headY - 21, 15, 11, 0, 0, 6.2832);
      c.fill(hatPath);
    } else if (v.kind === 'sailor') {
      c.beginPath(); c.ellipse(0, headY - 11, 25, 5, 0, 0, 6.2832); c.fill();
      hatPath = new Path2D(); hatPath.ellipse(0, headY - 18, 13, 10, 0, 0, 6.2832);
      c.fill(hatPath);
    }

    if (v.kind === 'ferryman') {
      c.lineWidth = 6;
      c.beginPath(); c.moveTo(30, -186); c.lineTo(64, 26); c.stroke();
      c.lineWidth = 13;
      c.beginPath(); c.moveTo(64, 26); c.lineTo(72, 52); c.stroke();
    } else if (v.kind === 'girl') {
      c.lineWidth = 2.6;
      c.beginPath(); c.arc(42, -104, 23, 0, 6.2832); c.stroke();
      for (var b = 0; b < 4; b++) {
        c.beginPath();
        c.moveTo(42 + Math.cos(b * 1.5708) * 23, -104 + Math.sin(b * 1.5708) * 23);
        c.lineTo(42 + Math.cos(b * 1.5708) * 23, -104 - 23 + Math.sin(b * 1.5708) * 23);
        c.stroke();
      }
    } else if (v.kind === 'sailor') {
      c.beginPath(); c.ellipse(-36, -126, 22, 17, 0.3, 0, 6.2832); c.fill();
    }

    // warm rim light running along the flame-facing edge only
    c.save();
    c.beginPath();
    if (side > 0) c.rect(0, -420, 560, 480); else c.rect(-560, -420, 560, 480);
    c.clip();
    var rimGrad = c.createLinearGradient(0, -250, 0, 30);
    rimGrad.addColorStop(0, 'rgba(255,206,132,' + (0.88 * v.rim) + ')');
    rimGrad.addColorStop(0.55, 'rgba(255,164,84,' + (0.42 * v.rim) + ')');
    rimGrad.addColorStop(1, 'rgba(255,140,60,0)');
    c.strokeStyle = rimGrad;
    c.lineWidth = 2.2;
    c.stroke(body);
    c.beginPath(); c.arc(0, headY, headR, 0, 6.2832); c.stroke();
    if (hatPath) c.stroke(hatPath);
    c.restore();

    // a whisper of cold night on the far side
    c.save();
    c.globalCompositeOperation = 'lighter';
    var cg = c.createLinearGradient(-side * 44, -50, side * 26, 20);
    cg.addColorStop(0, 'rgba(96,140,205,' + (0.10 * v.rim) + ')');
    cg.addColorStop(1, 'rgba(96,140,205,0)');
    c.fillStyle = cg;
    c.fill(body);
    c.restore();

    if (v.sym) {
      var symA = v.symAlpha === undefined ? 1 : v.symAlpha;
      var symY = headY - 54;
      c.save();
      c.globalAlpha = v.alpha * symA;
      var sg = c.createRadialGradient(0, symY, 0, 0, symY, 28);
      sg.addColorStop(0, 'rgba(255,220,160,0.26)');
      sg.addColorStop(1, 'rgba(255,200,130,0)');
      c.fillStyle = sg;
      c.beginPath(); c.arc(0, symY, 28, 0, 6.2832); c.fill();
      paintSymbol(c, v.sym, 0, symY, 12, '#ffe0aa', 1, 10);
      c.restore();
    }
    c.restore();
  }

  function drawRain(c, G, t) {
    if (G.rain < 0.02) return;
    c.save();
    c.globalAlpha = G.rain * 0.55;
    c.strokeStyle = 'rgba(180,205,235,0.55)';
    c.lineWidth = 1.1;
    for (var i = 0; i < 120; i++) {
      var seed = i * 12.9898;
      var sx = Math.abs((Math.sin(seed) * 43758.5453) % 1);
      var sp = 0.55 + (Math.abs(Math.sin(seed * 1.7)) % 1) * 0.9;
      var y = ((t * 640 * sp) + (Math.abs(Math.sin(seed * 3.1)) % 1) * H) % (H + 80) - 40;
      var x = sx * (W + 200) - 100 + y * 0.22;
      c.beginPath();
      c.moveTo(x, y);
      c.lineTo(x + 5, y + 22);
      c.stroke();
    }
    c.globalAlpha = G.rain * 0.42;
    for (var d = 0; d < 24; d++) {
      var dx = (Math.abs(Math.sin(d * 78.233)) % 1) * W;
      var dy = (Math.abs(Math.cos(d * 43.117)) % 1) * H;
      var rr = 2 + (Math.abs(Math.sin(d * 12.9)) % 1) * 4;
      var dg = c.createRadialGradient(dx - rr * 0.3, dy - rr * 0.4, 0, dx, dy, rr);
      dg.addColorStop(0, 'rgba(230,240,255,0.75)');
      dg.addColorStop(0.6, 'rgba(120,150,190,0.25)');
      dg.addColorStop(1, 'rgba(60,80,110,0.05)');
      c.fillStyle = dg;
      c.beginPath(); c.arc(dx, dy, rr, 0, 6.2832); c.fill();
    }
    c.restore();
  }

  function drawParticles(c, G, t) {
    var E = G.embers;
    c.save();
    c.globalCompositeOperation = 'lighter';
    for (var i = 0; i < E.length; i++) {
      var e = E[i];
      var a = e.life * (0.4 + 0.6 * Math.abs(Math.sin(t * 6 + e.ph)));
      c.globalAlpha = a * 0.9;
      c.fillStyle = e.cool ? '#9ec8ff' : '#ffbe6a';
      c.beginPath(); c.arc(e.x, e.y, e.r, 0, 6.2832); c.fill();
    }
    for (var d = 0; d < G.motes.length; d++) {
      var m = G.motes[d];
      var ma = m.life * (0.25 + 0.5 * Math.abs(Math.sin(t * 1.7 + m.ph)));
      c.globalAlpha = ma * 0.5;
      c.fillStyle = '#ffd9a5';
      c.beginPath(); c.arc(m.x, m.y, m.r, 0, 6.2832); c.fill();
    }
    c.restore();
  }

  function drawDawnTableau(c, G, t) {
    if (G.tableau <= 0.01) return;
    c.save();
    c.globalAlpha = G.tableau;
    var n = G.warmed;
    for (var i = 0; i < n; i++) {
      var fx = W * (0.125 + i * 0.068) + (i % 2 ? 16 : 0);
      var fy = L.floorY + 26;
      var hgt = H * 0.082;
      c.fillStyle = 'rgba(5,6,11,0.92)';
      // torso
      c.beginPath();
      c.moveTo(fx - 11, fy);
      c.lineTo(fx - 9, fy - hgt * 0.58);
      c.quadraticCurveTo(fx - 9, fy - hgt * 0.80, fx - 4, fy - hgt * 0.84);
      c.lineTo(fx + 4, fy - hgt * 0.84);
      c.quadraticCurveTo(fx + 9, fy - hgt * 0.80, fx + 9, fy - hgt * 0.58);
      c.lineTo(fx + 11, fy);
      c.closePath();
      c.fill();
      // legs
      c.fillRect(fx - 8, fy - 2, 5, 4);
      c.fillRect(fx + 3, fy - 2, 5, 4);
      // head + neck
      c.beginPath(); c.arc(fx, fy - hgt * 0.90, 5.4, 0, 6.2832); c.fill();
      c.fillRect(fx - 2, fy - hgt * 0.88, 4, 4);
      // a rim of the new light on their shoulders
      c.strokeStyle = 'rgba(255,214,150,0.30)';
      c.lineWidth = 1.1;
      c.beginPath();
      c.moveTo(fx - 9, fy - hgt * 0.60);
      c.quadraticCurveTo(fx - 9, fy - hgt * 0.80, fx - 4, fy - hgt * 0.84);
      c.stroke();
    }
    c.restore();
  }

  function drawGrade(c, G, t) {
    var vg = c.createRadialGradient(W * 0.5, H * 0.52, Math.min(W, H) * 0.20, W * 0.5, H * 0.52, Math.max(W, H) * 0.76);
    vg.addColorStop(0, 'rgba(0,0,0,0)');
    vg.addColorStop(0.58, 'rgba(0,0,0,0.26)');
    vg.addColorStop(1, 'rgba(0,0,0,0.86)');
    c.fillStyle = vg;
    c.fillRect(0, 0, W, H);

    if (grainTile) {
      c.save();
      c.globalAlpha = 0.5;
      var pat = c.createPattern(grainTile, 'repeat');
      c.translate(-Math.floor(Math.random() * 128), -Math.floor(Math.random() * 128));
      c.fillStyle = pat;
      c.fillRect(0, 0, W + 128, H + 128);
      c.restore();
    }
  }

  /* A Canvas2D stand-in for the shader flame, used only when WebGL is unavailable.
     Still has to look like fire. */
  function drawFallbackFlame(G, t) {
    var c = fxx;
    var lit = U.clamp(G.lightVis, 0, 1.2);
    if (lit <= 0.01) return;
    var cx = L.cx, by = L.baseY, h = L.flameH;
    var gut = 1 - G.gutter * 0.8;
    var l = lit * gut;
    var pulse = 1 + G.pulse * 0.5 + Math.sin(t * 2.1) * 0.06;
    var tilt = G.tilt * 0.22;

    c.save();
    c.globalCompositeOperation = 'lighter';

    // outer halo
    var gg = c.createRadialGradient(cx, by - h * 0.25, 4, cx, by - h * 0.25, h * 2.1);
    gg.addColorStop(0, 'rgba(255,168,78,' + (0.30 * l) + ')');
    gg.addColorStop(0.35, 'rgba(255,126,44,' + (0.10 * l) + ')');
    gg.addColorStop(1, 'rgba(255,110,30,0)');
    c.fillStyle = gg;
    c.beginPath(); c.arc(cx, by - h * 0.25, h * 2.1, 0, 6.2832); c.fill();

    // body: three layered teardrops
    var layers = [
      { w: 0.34, h: 1.00, sp: 2.1, o: 0.55, col: '255,128,32' },
      { w: 0.22, h: 0.74, sp: 3.1, o: 0.62, col: '255,196,96' },
      { w: 0.12, h: 0.46, sp: 4.3, o: 0.80, col: '255,248,224' }
    ];
    for (var i = 0; i < layers.length; i++) {
      var Lr = layers[i];
      var w = h * Lr.w;
      var hh = h * Lr.h * pulse;
      var sway = Math.sin(t * Lr.sp) * w * 0.42 + tilt * hh;
      c.beginPath();
      c.moveTo(cx + sway, by - hh);
      c.bezierCurveTo(cx + sway + w, by - hh * 0.55, cx + sway + w * 0.85, by - hh * 0.08, cx + sway * 0.4, by);
      c.bezierCurveTo(cx + sway * 0.4 - w * 0.85, by - hh * 0.08, cx + sway - w, by - hh * 0.55, cx + sway, by - hh);
      c.closePath();
      var grd = c.createRadialGradient(cx + sway * 0.4, by - hh * 0.35, 1, cx + sway * 0.4, by - hh * 0.35, w * 1.4);
      grd.addColorStop(0, 'rgba(' + Lr.col + ',' + (Lr.o * l) + ')');
      grd.addColorStop(0.55, 'rgba(' + Lr.col + ',' + (Lr.o * l * 0.45) + ')');
      grd.addColorStop(1, 'rgba(' + Lr.col + ',0)');
      c.fillStyle = grd;
      c.fill();
    }

    // blue gas at the base
    var bg4 = c.createRadialGradient(cx, by, 1, cx, by, h * 0.16);
    bg4.addColorStop(0, 'rgba(120,190,255,' + (0.35 * l) + ')');
    bg4.addColorStop(1, 'rgba(90,150,255,0)');
    c.fillStyle = bg4;
    c.beginPath(); c.ellipse(cx, by, h * 0.15, h * 0.05, 0, 0, 6.2832); c.fill();

    c.restore();
  }

  function drawFront(G, t) {
    var c = fxx;
    c.clearRect(0, 0, W, H);
    // if there is no WebGL, paint the flame straight onto this layer
    if (!global.Flame || !global.Flame.ok) drawFallbackFlame(G, t);
    drawRain(c, G, t);
    drawShafts(c, G, t);
    drawDoorMeter(c, G, t);
    drawLantern(c, G, t);
    drawRing(c, G, t);
    drawBraces(c, G, t);
    drawVisitors(c, G, t);
    drawParticles(c, G, t);
    drawDawnTableau(c, G, t);
    drawGrade(c, G, t);
  }

  global.Scene = {
    init: function (bgCanvas, fxCanvas) { bg = bgCanvas; fx = fxCanvas; resize(); },
    resize: resize,
    layout: function () { return L; },
    drawBack: drawBack,
    drawFront: drawFront,
    drawFallbackFlame: drawFallbackFlame,
    paintSymbol: paintSymbolToCanvas,
    symbols: SYMS
  };
})(window);
