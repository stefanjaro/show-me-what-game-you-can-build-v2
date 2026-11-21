// ---------------------------------------------------------------------------
// THE TIDE ENGINE — the living blueprint renderer
// Canvas 2D. Everything is drawn as glowing technical line-work.
// ---------------------------------------------------------------------------
import { W, H, TAU, clamp, lerp, rand, mtof } from './util.js';

export const PAL = {
  bg0: '#03070f',
  bg1: '#0a1728',
  grid: 'rgba(96,168,224,0.055)',
  gridMajor: 'rgba(96,168,224,0.10)',
  cyan: '#6fe3ff',
  cyanDim: 'rgba(111,227,255,0.42)',
  amber: '#ffb454',
  amberDim: 'rgba(255,180,84,0.40)',
  green: '#7dffb4',
  red: '#ff5f74',
  violet: '#c6a8ff',
  pink: '#ff9ec4',
  white: '#dff2ff',
  ink: 'rgba(160,214,246,0.55)',
  inkDim: 'rgba(160,214,246,0.28)',
};

const FONT = (size, weight = 400) =>
  `${weight} ${size}px "SFMono-Regular", Menlo, Consolas, "DejaVu Sans Mono", "Courier New", monospace`;

export const ST = {
  canvas: null,
  ctx: null,
  glow: null,
  gctx: null,
  small: null,
  sctx: null,
  overlay: null,
  octx: null,
  dpr: 1,
  glowMode: false,
  alphaMul: 1,
  particles: [],
  shake: 0,
  glitch: 0,
  flash: 0,
  flashCol: '#ffffff',
};

export function initRenderer(canvas) {
  ST.canvas = canvas;
  const dpr = Math.min(window.devicePixelRatio || 1, 1.25);
  ST.dpr = dpr;
  canvas.width = Math.round(W * dpr);
  canvas.height = Math.round(H * dpr);
  ST.ctx = canvas.getContext('2d', { alpha: false });
  LETTER_OK = detectLetter(ST.ctx);

  ST.glow = document.createElement('canvas');
  ST.glow.width = Math.round((W * dpr) / 2);
  ST.glow.height = Math.round((H * dpr) / 2);
  ST.gctx = ST.glow.getContext('2d');

  ST.small = document.createElement('canvas');
  ST.small.width = Math.round((W * dpr) / 4);
  ST.small.height = Math.round((H * dpr) / 4);
  ST.sctx = ST.small.getContext('2d');

  makeGrain();
  fit();
  window.addEventListener('resize', fit);
}

export function fit() {
  const scale = Math.min(window.innerWidth / W, window.innerHeight / H);
  const cw = Math.floor(W * scale), ch = Math.floor(H * scale);
  ST.canvas.style.width = cw + 'px';
  ST.canvas.style.height = ch + 'px';
  const frame = document.getElementById('frame');
  if (frame) { frame.style.width = cw + 'px'; frame.style.height = ch + 'px'; }
}

function makeGrain() {
  const c = document.createElement('canvas');
  c.width = 128; c.height = 128;
  const x = c.getContext('2d');
  const img = x.createImageData(128, 128);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const v = 110 + Math.random() * 90;
    d[i] = v; d[i + 1] = v; d[i + 2] = v; d[i + 3] = 255;
  }
  x.putImageData(img, 0, 0);
  const g = document.getElementById('grain');
  if (g) g.style.backgroundImage = `url(${c.toDataURL()})`;
}

// --------------------------------------------------------------- primitives
function C() { return ST.glowMode ? ST.gctx : ST.ctx; }
function GA() { return ST.glowMode ? ST.gctx : ST.ctx; }
function mul(a) { return ST.glowMode ? a * ST.alphaMul : a; }
function lw(w) { return ST.glowMode ? w * 2.0 : w; }

export function line(x1, y1, x2, y2, o = {}) {
  const c = GA();
  c.save();
  c.globalAlpha = mul(o.a === undefined ? 1 : o.a);
  c.strokeStyle = o.col || PAL.cyan;
  c.lineWidth = lw(o.w || 1.4);
  if (o.dash) c.setLineDash(o.dash.map((v) => v * (ST.glowMode ? 1.4 : 1)));
  if (o.cap) c.lineCap = o.cap;
  c.beginPath();
  c.moveTo(x1, y1);
  c.lineTo(x2, y2);
  c.stroke();
  c.restore();
}

export function poly(pts, o = {}) {
  const c = GA();
  c.save();
  c.globalAlpha = mul(o.a === undefined ? 1 : o.a);
  c.strokeStyle = o.col || PAL.cyan;
  c.lineWidth = lw(o.w || 1.4);
  c.lineJoin = 'round';
  if (o.dash) c.setLineDash(o.dash.map((v) => v * (ST.glowMode ? 1.4 : 1)));
  c.beginPath();
  c.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) c.lineTo(pts[i][0], pts[i][1]);
  if (o.close) c.closePath();
  if (o.fill) { c.fillStyle = o.fill; c.fill(); }
  c.stroke();
  c.restore();
}

export function circle(x, y, r, o = {}) {
  const c = GA();
  c.save();
  c.globalAlpha = mul(o.a === undefined ? 1 : o.a);
  c.strokeStyle = o.col || PAL.cyan;
  c.lineWidth = lw(o.w || 1.4);
  if (o.dash) c.setLineDash(o.dash.map((v) => v * (ST.glowMode ? 1.4 : 1)));
  c.beginPath();
  c.arc(x, y, r, 0, TAU);
  if (o.fill) { c.fillStyle = o.fill; c.fill(); }
  c.stroke();
  c.restore();
}

export function arc(x, y, r, a0, a1, o = {}) {
  const c = GA();
  c.save();
  c.globalAlpha = mul(o.a === undefined ? 1 : o.a);
  c.strokeStyle = o.col || PAL.cyan;
  c.lineWidth = lw(o.w || 1.4);
  c.lineCap = o.cap || 'butt';
  if (o.dash) c.setLineDash(o.dash.map((v) => v * (ST.glowMode ? 1.4 : 1)));
  c.beginPath();
  c.arc(x, y, r, a0, a1);
  if (o.fill) { c.fillStyle = o.fill; c.fill(); }
  c.stroke();
  c.restore();
}

export function rect(x, y, w, h, o = {}) {
  const c = GA();
  c.save();
  c.globalAlpha = mul(o.a === undefined ? 1 : o.a);
  c.strokeStyle = o.col || PAL.cyan;
  c.lineWidth = lw(o.w || 1.4);
  if (o.dash) c.setLineDash(o.dash.map((v) => v * (ST.glowMode ? 1.4 : 1)));
  c.beginPath();
  if (o.r) {
    const rr = Math.min(o.r, w / 2, h / 2);
    c.moveTo(x + rr, y);
    c.arcTo(x + w, y, x + w, y + h, rr);
    c.arcTo(x + w, y + h, x, y + h, rr);
    c.arcTo(x, y + h, x, y, rr);
    c.arcTo(x, y, x + w, y, rr);
    c.closePath();
  } else {
    c.rect(x, y, w, h);
  }
  if (o.fill) { c.fillStyle = o.fill; c.fill(); }
  c.stroke();
  c.restore();
}

export function hatch(x, y, w, h, o = {}) {
  const c = GA();
  c.save();
  c.beginPath();
  c.rect(x, y, w, h);
  c.clip();
  c.globalAlpha = mul(o.a === undefined ? 0.22 : o.a);
  c.strokeStyle = o.col || PAL.cyan;
  c.lineWidth = 1;
  const sp = o.sp || 9;
  for (let i = -h; i < w + h; i += sp) {
    c.beginPath();
    c.moveTo(x + i, y + h);
    c.lineTo(x + i + h, y);
    c.stroke();
  }
  c.restore();
}

/** Tracked (letter-spaced) monospace text. Uses native letterSpacing when available. */
let LETTER_OK = false;
function detectLetter(ctx) {
  try {
    ctx.letterSpacing = '2px';
    const ok = ctx.letterSpacing === '2px';
    ctx.letterSpacing = '0px';
    return ok;
  } catch (e) { return false; }
}

export function tr(ctx, str, x, y, o = {}) {
  const size = o.size || 12;
  const track = o.tracking === undefined ? size * 0.18 : o.tracking;
  const align = o.align || 'left';
  ctx.font = FONT(size, o.weight || 400);
  const n = str.length;
  if (!n) return 0;
  if (LETTER_OK) {
    ctx.letterSpacing = track.toFixed(2) + 'px';
    ctx.textAlign = align;
    ctx.textBaseline = o.baseline || 'alphabetic';
    ctx.fillText(str, x, y);
    const w = ctx.measureText(str).width;
    ctx.letterSpacing = '0px';
    ctx.textAlign = 'left';
    return w;
  }
  const adv = ctx.measureText(str).width / n;
  const total = adv * n + track * (n - 1);
  let cx = x;
  if (align === 'center') cx = x - total / 2;
  else if (align === 'right') cx = x - total;
  ctx.textBaseline = o.baseline || 'alphabetic';
  for (let i = 0; i < n; i++) {
    ctx.fillText(str[i], cx, y);
    cx += adv + track;
  }
  return total;
}

export function text(str, x, y, o = {}) {
  const c = GA();
  c.save();
  c.globalAlpha = mul(o.a === undefined ? 1 : o.a);
  c.fillStyle = o.col || PAL.white;
  c.textAlign = 'left';
  const width = tr(c, str, x, y, o);
  c.restore();
  return width;
}

export function measure(str, o = {}) {
  const c = ST.ctx;
  c.save();
  c.font = FONT(o.size || 12, o.weight || 400);
  const track = o.tracking === undefined ? (o.size || 12) * 0.18 : o.tracking;
  const n = str.length;
  let total;
  if (LETTER_OK) {
    c.letterSpacing = track.toFixed(2) + 'px';
    total = c.measureText(str).width;
    c.letterSpacing = '0px';
  } else {
    total = n ? (c.measureText(str).width / n) * n + track * (n - 1) : 0;
  }
  c.restore();
  return total;
}

/** Build a path with a callback, then stroke/fill it. */
export function path(fn, o = {}) {
  const c = GA();
  c.save();
  c.globalAlpha = mul(o.a === undefined ? 1 : o.a);
  c.strokeStyle = o.col || PAL.cyan;
  c.lineWidth = lw(o.w || 1.4);
  c.lineJoin = 'round';
  c.beginPath();
  fn(c);
  if (o.fill) { c.fillStyle = o.fill; c.fill(); }
  c.stroke();
  c.restore();
}

/** Many segments in a single path — one stroke instead of N. */
export function segs(list, o = {}) {
  const c = GA();
  c.save();
  c.globalAlpha = mul(o.a === undefined ? 1 : o.a);
  c.strokeStyle = o.col || PAL.cyan;
  c.lineWidth = lw(o.w || 1.4);
  c.beginPath();
  for (const s of list) { c.moveTo(s[0], s[1]); c.lineTo(s[2], s[3]); }
  c.stroke();
  c.restore();
}

/** Blueprint annotation: dot on target, leader line, boxed label. */
export function callout(tx, ty, lx, ly, label, sub, o = {}) {
  const col = o.col || PAL.amber;
  circle(tx, ty, 3.4, { col, w: 1.6, a: 0.95, glow: true });
  line(tx, ty, lx, ly, { col, w: 1, a: 0.5, dash: [4, 4] });
  const w = Math.max(measure(label, { size: 11 }) + 18, sub ? measure(sub, { size: 9 }) + 18 : 0);
  const h = sub ? 30 : 20;
  rect(lx - w / 2, ly - h, w, h, { col, w: 1, a: 0.75, r: 2 });
  text(label, lx, ly - (sub ? 17 : 7), { size: 11, col, align: 'center', weight: 600, tracking: 2.4 });
  if (sub) text(sub, lx, ly - 5, { size: 9, col: PAL.inkDim, align: 'center', tracking: 1.4 });
}

// ---------------------------------------------------------------- particles
export function spawn(x, y, n, o = {}) {
  for (let i = 0; i < n; i++) {
    const a = o.angle === undefined ? rand(0, TAU) : o.angle + rand(-0.5, 0.5) * (o.spread || 0.6);
    const sp = rand(o.spMin || 30, o.spMax || 130);
    ST.particles.push({
      x, y,
      vx: Math.cos(a) * sp,
      vy: Math.sin(a) * sp,
      life: rand(o.lifeMin || 0.4, o.lifeMax || 1.1),
      age: 0,
      size: rand(o.sizeMin || 1.2, o.sizeMax || 3.2),
      col: o.col || PAL.cyan,
      grav: o.grav === undefined ? 0 : o.grav,
      drag: o.drag === undefined ? 0.9 : o.drag,
      glow: o.glow !== false,
      kind: o.kind || 'spark',
    });
  }
  if (ST.particles.length > 900) ST.particles.splice(0, ST.particles.length - 900);
}

export function updateParticles(dt) {
  const ps = ST.particles;
  for (let i = ps.length - 1; i >= 0; i--) {
    const p = ps[i];
    p.age += dt;
    if (p.age >= p.life) { ps.splice(i, 1); continue; }
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vy += p.grav * dt;
    const d = Math.pow(p.drag, dt * 60);
    p.vx *= d; p.vy *= d;
    if (p.kind === 'steam') { p.size += dt * 9; p.vx += Math.sin(p.age * 2 + p.y * 0.01) * 12 * dt; }
  }
}

export function drawParticles() {
  const c = ST.ctx;
  c.save();
  for (const p of ST.particles) {
    const t = 1 - p.age / p.life;
    c.globalAlpha = Math.max(0, t * t);
    c.fillStyle = p.col;
    if (p.kind === 'steam') {
      c.globalAlpha = Math.max(0, t * 0.22);
      c.beginPath();
      c.arc(p.x, p.y, p.size, 0, TAU);
      c.fill();
    } else {
      c.beginPath();
      c.arc(p.x, p.y, p.size * t + 0.4, 0, TAU);
      c.fill();
    }
  }
  c.restore();
}

// ------------------------------------------------------------------ effects
export function shake(v) { ST.shake = Math.min(ST.shake + v, 26); }
export function glitch(v) { ST.glitch = Math.min(ST.glitch + v, 1); }
export function flash(col, v) { ST.flash = Math.min(ST.flash + v, 1); ST.flashCol = col; }

// --------------------------------------------------------------- background
let BG = null;

function buildBackground() {
  const c = document.createElement('canvas');
  c.width = W + 64;
  c.height = H + 64;
  const x = c.getContext('2d');
  x.translate(32, 32);
  const g = x.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, '#040914');
  g.addColorStop(0.55, '#071326');
  g.addColorStop(1, '#03070f');
  x.fillStyle = g;
  x.fillRect(-32, -32, W + 64, H + 64);

  const rg = x.createRadialGradient(420, 540, 60, 420, 540, 760);
  rg.addColorStop(0, 'rgba(40,120,180,0.17)');
  rg.addColorStop(1, 'rgba(0,0,0,0)');
  x.fillStyle = rg;
  x.fillRect(-32, -32, W + 64, H + 64);

  x.strokeStyle = PAL.grid;
  x.lineWidth = 1;
  x.beginPath();
  for (let gx = 0; gx <= W; gx += 32) { x.moveTo(gx + 0.5, -32); x.lineTo(gx + 0.5, H + 32); }
  for (let gy = 0; gy <= H; gy += 32) { x.moveTo(-32, gy + 0.5); x.lineTo(W + 32, gy + 0.5); }
  x.stroke();
  x.strokeStyle = PAL.gridMajor;
  x.beginPath();
  for (let gx = 0; gx <= W; gx += 160) { x.moveTo(gx + 0.5, -32); x.lineTo(gx + 0.5, H + 32); }
  for (let gy = 0; gy <= H; gy += 160) { x.moveTo(-32, gy + 0.5); x.lineTo(W + 32, gy + 0.5); }
  x.stroke();
  return c;
}

export function drawBackground(t) {
  const c = ST.ctx;
  if (!BG) BG = buildBackground();
  c.save();
  c.drawImage(BG, -32, -32);
  // drifting motes
  c.fillStyle = 'rgba(150,215,255,0.30)';
  for (let i = 0; i < 40; i++) {
    const sx = ((i * 137.5) % W) + Math.sin(t * 0.2 + i) * 22;
    const sy = ((i * 311.7 + t * (7 + (i % 5))) % H + H) % H;
    const r = 0.6 + ((i * 7) % 5) * 0.32;
    c.globalAlpha = 0.10 + 0.22 * (0.5 + 0.5 * Math.sin(t * 1.2 + i));
    c.beginPath();
    c.arc(sx, sy, r, 0, TAU);
    c.fill();
  }
  c.restore();
}

// ------------------------------------------------------------- compositing
export function beginFrame() {
  const c = ST.ctx;
  c.setTransform(ST.dpr, 0, 0, ST.dpr, 0, 0);
  c.globalCompositeOperation = 'source-over';
  c.globalAlpha = 1;
  ST.gctx.setTransform(ST.dpr / 2, 0, 0, ST.dpr / 2, 0, 0);
  ST.gctx.clearRect(0, 0, W, H);
  ST.gctx.globalCompositeOperation = 'source-over';
  ST.gctx.globalAlpha = 1;
  ST.sctx.setTransform(1, 0, 0, 1, 0, 0);
  ST.sctx.clearRect(0, 0, ST.small.width, ST.small.height);
  ST.glowMode = false;
  ST.alphaMul = 1;
  // screen shake
  if (ST.shake > 0.01) {
    const s = ST.shake;
    const ox = rand(-s, s), oy = rand(-s, s);
    c.translate(ox, oy);
    ST.gctx.translate(ox, oy);
  }
}

export function endFrame(dt) {
  const c = ST.ctx;
  // bloom — the half-res emissive buffer lifted onto the scene
  c.save();
  c.setTransform(ST.dpr, 0, 0, ST.dpr, 0, 0);
  c.globalCompositeOperation = 'lighter';
  c.globalAlpha = 0.52;
  c.drawImage(ST.glow, 0, 0, W, H);
  c.globalAlpha = 0.22;
  c.drawImage(ST.glow, -6, -6, W + 12, H + 12);
  c.restore();

  // glitch bands
  if (ST.glitch > 0.01) {
    c.save();
    c.setTransform(ST.dpr, 0, 0, ST.dpr, 0, 0);
    const bands = 3 + Math.floor(ST.glitch * 5);
    for (let i = 0; i < bands; i++) {
      const y = rand(0, H);
      const h = rand(2, 14) * (1 + ST.glitch);
      c.globalCompositeOperation = 'lighter';
      c.globalAlpha = 0.10 * ST.glitch;
      c.fillStyle = PAL.cyan;
      c.fillRect(rand(-30, 30), y, W, h);
    }
    c.restore();
  }

  // flash
  if (ST.flash > 0.005) {
    c.save();
    c.setTransform(ST.dpr, 0, 0, ST.dpr, 0, 0);
    c.globalCompositeOperation = 'lighter';
    c.globalAlpha = Math.min(0.6, ST.flash);
    c.fillStyle = ST.flashCol;
    c.fillRect(0, 0, W, H);
    c.restore();
  }

  ST.shake = Math.max(0, ST.shake - dt * 34);
  ST.glitch = Math.max(0, ST.glitch - dt * 2.4);
  ST.flash = Math.max(0, ST.flash - dt * 2.6);
}
