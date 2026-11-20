/* VIGIL — utilities */
window.Vigil = window.Vigil || {};
(function (V) {
  'use strict';

  V.W = 1280;
  V.H = 720;

  V.TAU = Math.PI * 2;
  V.DEG = Math.PI / 180;

  V.clamp = function (v, a, b) { return v < a ? a : (v > b ? b : v); };
  V.lerp = function (a, b, t) { return a + (b - a) * t; };
  V.sign = function (v) { return v < 0 ? -1 : (v > 0 ? 1 : 0); };
  V.smoothstep = function (t) { t = V.clamp(t, 0, 1); return t * t * (3 - 2 * t); };
  V.easeOut = function (t) { t = V.clamp(t, 0, 1); return 1 - (1 - t) * (1 - t); };
  V.easeIn = function (t) { t = V.clamp(t, 0, 1); return t * t; };
  V.easeInOut = function (t) { t = V.clamp(t, 0, 1); return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; };
  V.easeOutBack = function (t) {
    t = V.clamp(t, 0, 1);
    var c1 = 1.70158, c3 = c1 + 1;
    return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
  };

  V.rand = function (a, b) {
    if (b === undefined) { b = a; a = 0; }
    return a + Math.random() * (b - a);
  };
  V.randInt = function (a, b) { return Math.floor(V.rand(a, b + 0.999999)); };
  V.pick = function (arr) { return arr[Math.floor(Math.random() * arr.length)]; };
  V.chance = function (p) { return Math.random() < p; };

  V.dist = function (x1, y1, x2, y2) { var dx = x2 - x1, dy = y2 - y1; return Math.sqrt(dx * dx + dy * dy); };
  V.dist2 = function (x1, y1, x2, y2) { var dx = x2 - x1, dy = y2 - y1; return dx * dx + dy * dy; };

  /* smallest signed difference b-a wrapped to [-PI,PI] */
  V.angleDiff = function (a, b) {
    var d = (b - a) % V.TAU;
    if (d > Math.PI) d -= V.TAU;
    if (d < -Math.PI) d += V.TAU;
    return d;
  };
  V.turnToward = function (cur, target, maxStep) {
    var d = V.angleDiff(cur, target);
    if (Math.abs(d) <= maxStep) return target;
    return cur + V.sign(d) * maxStep;
  };
  V.angOf = function (x1, y1, x2, y2) { return Math.atan2(y2 - y1, x2 - x1); };

  /* deterministic rng */
  V.mulberry32 = function (seed) {
    var a = seed >>> 0;
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  };

  V.hsla = function (h, s, l, a) {
    return 'hsla(' + h + ',' + s + '%,' + l + '%,' + (a === undefined ? 1 : a) + ')';
  };
  V.rgba = function (r, g, b, a) {
    return 'rgba(' + (r | 0) + ',' + (g | 0) + ',' + (b | 0) + ',' + (a === undefined ? 1 : a) + ')';
  };

  /* letterspaced text (canvas has no reliable letterSpacing) */
  V.drawSpaced = function (ctx, text, x, y, spacing, align) {
    var i, w = 0, ch, cw;
    for (i = 0; i < text.length; i++) {
      cw = ctx.measureText(text[i]).width;
      w += cw + (i < text.length - 1 ? spacing : 0);
    }
    var startX = x;
    if (align === 'center') startX = x - w / 2;
    else if (align === 'right') startX = x - w;
    var cx = startX;
    for (i = 0; i < text.length; i++) {
      ch = text[i];
      if (align === 'center' || align === 'right' || align === 'left') {
        ctx.fillText(ch, cx, y);
      }
      cx += ctx.measureText(ch).width + spacing;
    }
    return w;
  };

  V.textWidthSpaced = function (ctx, text, spacing) {
    var w = 0;
    for (var i = 0; i < text.length; i++) {
      w += ctx.measureText(text[i]).width + (i < text.length - 1 ? spacing : 0);
    }
    return w;
  };

  /* ---------- particles ---------- */
  /* types drawn by render; sim only moves them */
  V.Particle = function (o) {
    this.x = o.x; this.y = o.y;
    this.vx = o.vx || 0; this.vy = o.vy || 0;
    this.life = o.life; this.maxLife = o.life;
    this.type = o.type || 'spark';
    this.size = o.size || 2;
    this.drag = o.drag === undefined ? 0.9 : o.drag;
    this.grav = o.grav || 0;
    this.hue = o.hue || 45;
    this.sat = o.sat === undefined ? 90 : o.sat;
    this.lum = o.lum === undefined ? 60 : o.lum;
    this.a0 = o.a0 === undefined ? 1 : o.a0;
    this.rot = o.rot || 0;
    this.vr = o.vr || 0;
    this.data = o.data || 0;
    this.text = o.text || '';
    this.dead = false;
  };

  V.ParticleSet = function (cap) {
    this.cap = cap || 900;
    this.list = [];
  };
  V.ParticleSet.prototype.spawn = function (o) {
    if (this.list.length >= this.cap) this.list.shift();
    var p = new V.Particle(o);
    this.list.push(p);
    return p;
  };
  V.ParticleSet.prototype.update = function (dt, windX, windY) {
    var l = this.list, i, p;
    for (i = l.length - 1; i >= 0; i--) {
      p = l[i];
      p.life -= dt;
      if (p.life <= 0) { l.splice(i, 1); continue; }
      if (p.type === 'rain') {
        p.x += (p.vx + (windX || 0) * 0.5) * dt;
        p.y += p.vy * dt;
        if (p.y > V.H + 20) p.life = 0;
        continue;
      }
      p.vx += (p.grav ? p.grav : 0) * dt;
      if (windX && p.type !== 'ash') p.vx += windX * dt * (p.type === 'ember' ? 0.6 : 0.25);
      if (windY && p.type !== 'ash') p.vy += windY * dt * 0.25;
      var d = Math.pow(p.drag, dt * 60);
      p.vx *= d; p.vy *= d;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.rot += p.vr * dt;
      if (p.type === 'spray' && p.y > V.H) p.life = 0;
    }
  };
  V.ParticleSet.prototype.clear = function () { this.list.length = 0; };
  V.ParticleSet.prototype.count = function () { return this.list.length; };

  /* ---------- geometry helpers ---------- */

  /* nearest point on ray (origin o, unit dir u, t>=0) to point p.
     returns {t, qx, qy, ex, ey} where e = p - q (lateral error) */
  V.projectOnRay = function (ox, oy, ux, uy, px, py) {
    var dx = px - ox, dy = py - oy;
    var t = dx * ux + dy * uy;
    var qx, qy;
    if (t < 0) { t = 0; qx = ox; qy = oy; }
    else { qx = ox + ux * t; qy = oy + uy * t; }
    return { t: t, qx: qx, qy: qy, ex: px - qx, ey: py - qy, err: V.dist(px, py, qx, qy) };
  };

  /* ray vs circle: returns entry distance t or -1 */
  V.rayCircle = function (ox, oy, ux, uy, cx, cy, r) {
    var dx = cx - ox, dy = cy - oy;
    var proj = dx * ux + dy * uy;
    var d2 = dx * dx + dy * dy;
    var r2 = r * r;
    if (d2 < r2) return 0;
    var perp2 = d2 - proj * proj;
    if (perp2 > r2) return -1;
    if (proj < 0) return -1;
    var t = proj - Math.sqrt(r2 - perp2);
    return t;
  };

  /* segment (p1->p2) vs circle: true if intersects */
  V.segCircle = function (x1, y1, x2, y2, cx, cy, r) {
    var dx = x2 - x1, dy = y2 - y1;
    var fx = x1 - cx, fy = y1 - cy;
    var a = dx * dx + dy * dy;
    if (a === 0) return V.dist2(x1, y1, cx, cy) <= r * r;
    var b = 2 * (fx * dx + fy * dy);
    var c = fx * fx + fy * fy - r * r;
    var disc = b * b - 4 * a * c;
    if (disc < 0) return false;
    disc = Math.sqrt(disc);
    var t1 = (-b - disc) / (2 * a);
    var t2 = (-b + disc) / (2 * a);
    return (t1 >= 0 && t1 <= 1) || (t2 >= 0 && t2 <= 1) || (t1 < 0 && t2 > 1);
  };

  /* tangent wedge from point L to circle — for light shadows.
     returns [{a1,a2}] angles (absolute) of the shadow cone */
  V.shadowWedge = function (lx, ly, cx, cy, r) {
    var d = V.dist(lx, ly, cx, cy);
    if (d <= r) return null;
    var phi = V.angOf(lx, ly, cx, cy);
    var beta = Math.asin(V.clamp(r / d, 0, 1));
    return { a1: phi - beta, a2: phi + beta, d: d };
  };

  V.hexToRgb = function (hex) {
    var h = hex.replace('#', '');
    if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    var n = parseInt(h, 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  };
  V.mixHex = function (h1, h2, t) {
    var a = V.hexToRgb(h1), b = V.hexToRgb(h2);
    return V.rgba(V.lerp(a[0], b[0], t), V.lerp(a[1], b[1], t), V.lerp(a[2], b[2], t), 1);
  };

})(window.Vigil);
