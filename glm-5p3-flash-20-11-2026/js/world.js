"use strict";

const TAU = Math.PI * 2;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;
const dist = (ax, ay, bx, by) => Math.hypot(bx - ax, by - ay);
const rand = (a, b) => a + Math.random() * (b - a);
const angLerp = (a, b, t) => {
  let d = (b - a) % TAU;
  if (d > Math.PI) d -= TAU;
  if (d < -Math.PI) d += TAU;
  return a + d * t;
};

const cvs = document.getElementById("game");
const ctx = cvs.getContext("2d");
let W = 0, H = 0, DPR = 1;

const maskC = document.createElement("canvas");
const maskX = maskC.getContext("2d");
const tmpC = document.createElement("canvas");
const tmpX = tmpC.getContext("2d");
let mapC = null, mapX = null;

function resize() {
  DPR = Math.min(window.devicePixelRatio || 1, 1.5);
  W = window.innerWidth;
  H = window.innerHeight;
  cvs.width = Math.floor(W * DPR);
  cvs.height = Math.floor(H * DPR);
  cvs.style.width = W + "px";
  cvs.style.height = H + "px";
  maskC.width = tmpC.width = cvs.width;
  maskC.height = tmpC.height = cvs.height;
}
window.addEventListener("resize", resize);
resize();

const qs = (id) => document.getElementById(id);
const show = (id) => qs(id).classList.remove("hidden");
const hide = (id) => qs(id).classList.add("hidden");
const hideAll = () => ["title", "chapter", "intro", "log", "death", "pause", "end"].forEach(hide);
const setText = (id, t) => { qs(id).textContent = t; };

const keys = {};
const handlers = { down: [], up: [] };
window.addEventListener("keydown", (e) => {
  if (["Space", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.code)) e.preventDefault();
  keys[e.code] = true;
  if (!e.repeat) {
    handlers.down.forEach((f) => f(e.code));
    AUD.init();
    AUD.resume();
  }
});
window.addEventListener("keyup", (e) => {
  keys[e.code] = false;
  handlers.up.forEach((f) => f(e.code));
});
window.addEventListener("pointerdown", () => {
  AUD.init();
  AUD.resume();
  handlers.down.forEach((f) => f("PointerDown"));
});
window.addEventListener("pointerup", () => {
  handlers.up.forEach((f) => f("PointerUp"));
});

const ROMAN = ["I", "II", "III", "IV", "V"];
const LS_KEY = "halcyon_deep_best";
function loadBest() {
  try { return parseInt(localStorage.getItem(LS_KEY) || "0", 10) || 0; } catch (e) { return 0; }
}
function saveBest(v) {
  try { localStorage.setItem(LS_KEY, String(v)); } catch (e) {}
}

const G = {
  state: "title",
  ch: 0,
  t: 0,
  dt: 0.016,
  playTime: 0,
  pings: 0,
  deaths: 0,
  best: loadBest(),
  cam: { x: 0, y: 0 },
  shake: 0,
  flash: 0,
  fade: 0,
  fadeTarget: 0,
  fadeCb: null,
  rings: [],
  pending: [],
  parts: [],
  snow: [],
  hints: [],
  hintT: 0,
  flags: {},
  danger: 0,
  heartT: 0,
  chargeT: -1,
  deathT: 0,
  endT: 0,
  typer: null,
  timers: [],
  ringId: 0,
  moveNoiseT: 0,
  ghostT: 0,
  menuRings: [],
  menuSnow: [],
  currentLog: 0,
};

let world = null, walls = [], pillars = [], gridInfo = null;
let player = null, hunters = [], boids = [], mines = [], crystals = [], doors = [];
let beacons = [], sponges = [], currents = [], surges = [], lev = null, box = null, exitZone = null;
let checkpoint = null;

function playerStart(x, y) {
  player = {
    x, y, vx: 0, vy: 0, r: 9, hull: 3, inv: 0, ang: -Math.PI / 2,
    sponge: 0, anchor: false, cd: 0, thrust: 0,
  };
}

function buildChapter(i, cp) {
  world = CHAPTERS[i];
  walls = world.walls;
  pillars = world.pillars || [];
  crystals = world.crystals.map((c, idx) => ({
    x: c.x, y: c.y, idx, cd: 0, rev: 0, flash: 0, rot: rand(0, TAU),
  }));
  doors = world.doors.map((d) => ({
    x: d.x, y: d.y, w: d.w, h: d.h, need: d.need, from: d.from,
    got: 0, open: 0, opening: false, rev: 0, checkpoint: d.checkpoint || null,
  }));
  mines = (world.mines || []).map((m) => ({ x: m.x, y: m.y, fuse: -1, spent: false, rev: 0, blink: rand(0, TAU) }));
  beacons = world.beacons.map((b, idx) => ({
    x: b.x, y: b.y, log: b.log || 0, done: false, t: rand(0, TAU), rev: 0.5, pt: rand(0, 3), idx,
  }));
  if (cp) {
    beacons.forEach((b) => {
      if ((G.doneBeacons || []).includes(b.idx)) b.done = true;
    });
    G.doneBeacons = G.doneBeacons || [];
  } else {
    G.doneBeacons = [];
  }
  sponges = (world.sponges || []).map((s) => ({ x: s.x, y: s.y, r: s.r, ph: rand(0, TAU) }));
  currents = (world.currents || []).map((c) => ({ ...c }));
  surges = (world.surges || []).map((s, idx) => ({ ...s, state: "idle", t: rand(2, 5), dx: idx % 2 ? 1 : -1 }));
  box = world.box ? { x: world.box.x, y: world.box.y, got: false, rev: 0, seen: false } : null;
  exitZone = { x: world.exit.x, y: world.exit.y };

  hunters = (world.hunters || []).map((h) => ({
    x: h.x, y: h.y, vx: 0, vy: 0, r: 15, ang: rand(0, TAU),
    state: h.wake === "box" ? "dormant" : "idle",
    wake: h.wake || "none", t: rand(0, 2), wp: null, path: null, pathI: 0,
    repathT: 0, hot: 0, growlT: rand(3, 7), backoff: 0, rev: 0, wag: rand(0, TAU),
    lastSeen: null, scanT: 0,
  }));

  boids = [];
  (world.roosts || []).forEach((r) => {
    for (let k = 0; k < r.n; k++) {
      const a = rand(0, TAU);
      boids.push({
        x: r.x + rand(-60, 60), y: r.y + rand(-60, 60),
        vx: Math.cos(a) * 30, vy: Math.sin(a) * 30,
        hx: r.x, hy: r.y,
        agit: 0, agx: 0, agy: 0, cd: rand(0, 2), stun: 0,
        rev: 0, ph: rand(0, TAU), wa: rand(0, TAU), waT: rand(1, 3),
      });
    }
  });

  if (world.leviathan) {
    const m = world.leviathan.mode;
    const sx = m === "throat" ? world.leviathan.waypoints[0][0] : 550;
    const sy = m === "throat" ? world.leviathan.waypoints[0][1] : world.h + 120;
    const segs = [];
    for (let k = 0; k < 22; k++) segs.push({ x: sx + k * 34, y: sy });
    lev = {
      mode: m, x: sx, y: sy, ang: Math.PI,
      segs, state: m === "throat" ? "survey" : "rise",
      wpi: 0, t: m === "throat" ? 4 : 0, stunT: 0, pauseT: 0, surgeV: 0,
      waypoints: world.leviathan.waypoints || null,
      rev: 0, spotPh: rand(0, TAU), motifPlayed: false, lungeTX: 0, lungeTY: 0,
    };
  } else {
    lev = null;
  }

  playerStart(cp ? cp.x : world.spawn.x, cp ? cp.y : world.spawn.y);
  checkpoint = { x: player.x, y: player.y };
  G.rings = [];
  G.pending = [];
  G.parts = [];
  G.flags = {};
  G.hints = [];
  G.hintT = 0;
  G.danger = 0;
  G.shake = 0;
  G.flash = 0;
  G.chargeT = -1;
  gridInfo = buildGrid(world);

  G.snow = [];
  for (let k = 0; k < 150; k++) {
    G.snow.push({
      x: rand(-100, world.w + 100), y: rand(-100, world.h + 100),
      z: rand(0.3, 1), ph: rand(0, TAU),
    });
  }

  mapC = document.createElement("canvas");
  mapC.width = world.w;
  mapC.height = world.h;
  mapX = mapC.getContext("2d");
  buildMap(world);

  G.cam.x = camTargetX(player.x);
  G.cam.y = camTargetY(player.y);
}

function camTargetX(px) {
  if (world.w <= W) return (world.w - W) / 2;
  return clamp(px - W / 2, 0, world.w - W);
}
function camTargetY(py) {
  if (world.h <= H) return (world.h - H) / 2;
  return clamp(py - H / 2, 0, world.h - H);
}

function buildMap(w) {
  const m = mapX;
  m.clearRect(0, 0, w.w, w.h);
  const hue = w.hue;
  m.lineCap = "round";
  m.fillStyle = `hsla(${hue}, 60%, 55%, 0.07)`;
  m.strokeStyle = `hsla(${hue}, 85%, 68%, 0.9)`;
  walls.forEach(([x, y, ww, hh]) => {
    m.fillRect(x, y, ww, hh);
    m.lineWidth = 7;
    m.globalAlpha = 0.16;
    m.strokeRect(x, y, ww, hh);
    m.lineWidth = 2;
    m.globalAlpha = 1;
    m.strokeRect(x, y, ww, hh);
  });
  pillars.forEach(([x, y, r]) => {
    m.beginPath();
    m.arc(x, y, r, 0, TAU);
    m.fill();
    m.lineWidth = 7;
    m.globalAlpha = 0.16;
    m.beginPath();
    m.arc(x, y, r, 0, TAU);
    m.stroke();
    m.lineWidth = 2;
    m.globalAlpha = 1;
    m.beginPath();
    m.arc(x, y, r, 0, TAU);
    m.stroke();
  });
  m.globalAlpha = 0.3;
  m.fillStyle = `hsla(${hue}, 80%, 75%, 1)`;
  walls.forEach(([x, y, ww, hh]) => {
    const n = Math.floor((ww + hh) / 34);
    for (let k = 0; k < n; k++) {
      const side = Math.floor(rand(0, 4));
      let dx = 0, dy = 0;
      if (side === 0) { dx = rand(0, ww); dy = 0; }
      else if (side === 1) { dx = ww; dy = rand(0, hh); }
      else if (side === 2) { dx = rand(0, ww); dy = hh; }
      else { dx = 0; dy = rand(0, hh); }
      m.beginPath();
      m.arc(x + dx, y + dy, 1.4, 0, TAU);
      m.fill();
    }
  });
  m.globalAlpha = 1;
}

function buildGrid(w) {
  const cs = 40;
  const cols = Math.ceil(w.w / cs);
  const rows = Math.ceil(w.h / cs);
  const g = new Uint8Array(cols * rows);
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const x = c * cs + cs / 2;
      const y = r * cs + cs / 2;
      g[r * cols + c] = pointBlocked(x, y, 14) ? 1 : 0;
    }
  }
  return { cs, cols, rows, grid: g };
}

function pointBlocked(x, y, pad) {
  for (let i = 0; i < walls.length; i++) {
    const wx = walls[i][0], wy = walls[i][1], ww = walls[i][2], wh = walls[i][3];
    if (x > wx - pad && x < wx + ww + pad && y > wy - pad && y < wy + wh + pad) return true;
  }
  for (let i = 0; i < pillars.length; i++) {
    if (dist(x, y, pillars[i][0], pillars[i][1]) < pillars[i][2] + pad) return true;
  }
  for (let i = 0; i < doors.length; i++) {
    const d = doors[i];
    if (d.open < 0.5 && x > d.x - pad && x < d.x + d.w + pad && y > d.y - pad && y < d.y + d.h + pad) return true;
  }
  return false;
}

function nearestFreeCell(ci, cj) {
  const gi = gridInfo;
  for (let rad = 1; rad < 8; rad++) {
    for (let dy = -rad; dy <= rad; dy++) {
      for (let dx = -rad; dx <= rad; dx++) {
        const c = ci + dx, r = cj + dy;
        if (c < 0 || r < 0 || c >= gi.cols || r >= gi.rows) continue;
        if (!gi.grid[r * gi.cols + c]) return [c, r];
      }
    }
  }
  return [ci, cj];
}

function bfsPath(sx, sy, tx, ty) {
  const gi = gridInfo;
  const cs = gi.cs;
  const sCell = nearestFreeCell(Math.floor(sx / cs), Math.floor(sy / cs));
  const tCell = nearestFreeCell(Math.floor(tx / cs), Math.floor(ty / cs));
  const sc = sCell[0], sr = sCell[1], tc = tCell[0], tr = tCell[1];
  const N = gi.cols * gi.rows;
  const prev = new Int32Array(N).fill(-2);
  const q = [sr * gi.cols + sc];
  prev[q[0]] = -1;
  const target = tr * gi.cols + tc;
  let found = false;
  let qi = 0;
  while (qi < q.length && qi < 6000) {
    const cur = q[qi++];
    if (cur === target) { found = true; break; }
    const c = cur % gi.cols;
    const r = Math.floor(cur / gi.cols);
    const nb = [[c + 1, r], [c - 1, r], [c, r + 1], [c, r - 1]];
    for (let k = 0; k < 4; k++) {
      const nc = nb[k][0], nr = nb[k][1];
      if (nc < 0 || nr < 0 || nc >= gi.cols || nr >= gi.rows) continue;
      const ni = nr * gi.cols + nc;
      if (gi.grid[ni] || prev[ni] !== -2) continue;
      prev[ni] = cur;
      q.push(ni);
    }
  }
  if (!found) return null;
  const path = [];
  let cur = target;
  while (cur !== -1 && path.length < 500) {
    const c = cur % gi.cols;
    const r = Math.floor(cur / gi.cols);
    path.push({ x: c * cs + cs / 2, y: r * cs + cs / 2 });
    cur = prev[cur];
  }
  path.reverse();
  return path;
}

function lineClear(x1, y1, x2, y2, pad) {
  const d = dist(x1, y1, x2, y2);
  const steps = Math.max(2, Math.floor(d / 18));
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    if (pointBlocked(lerp(x1, x2, t), lerp(y1, y2, t), pad)) return false;
  }
  return true;
}

function resolveCircle(px, py, r) {
  let nx = 0, ny = 0, hit = false;
  for (let i = 0; i < walls.length; i++) {
    const wx = walls[i][0], wy = walls[i][1], ww = walls[i][2], wh = walls[i][3];
    const cx = clamp(px, wx, wx + ww);
    const cy = clamp(py, wy, wy + wh);
    const dx = px - cx, dy = py - cy;
    const d2 = dx * dx + dy * dy;
    if (d2 < r * r) {
      hit = true;
      if (d2 > 0.0001) {
        const d = Math.sqrt(d2);
        const push = (r - d) / d;
        px += dx * push;
        py += dy * push;
        nx = dx / d; ny = dy / d;
      } else {
        const left = px - wx, right = wx + ww - px, top = py - wy, bot = wy + wh - py;
        const mn = Math.min(left, right, top, bot);
        if (mn === left) { px = wx - r; nx = -1; }
        else if (mn === right) { px = wx + ww + r; nx = 1; }
        else if (mn === top) { py = wy - r; ny = -1; }
        else { py = wy + wh + r; ny = 1; }
      }
    }
  }
  for (let i = 0; i < pillars.length; i++) {
    const pxx = pillars[i][0], pyy = pillars[i][1], pr = pillars[i][2];
    const dx = px - pxx, dy = py - pyy;
    const d = Math.hypot(dx, dy);
    if (d < pr + r && d > 0.0001) {
      hit = true;
      const push = (pr + r - d) / d;
      px += dx * push;
      py += dy * push;
      nx = dx / d; ny = dy / d;
    }
  }
  for (let i = 0; i < doors.length; i++) {
    const d = doors[i];
    if (d.open >= 0.5) continue;
    const cx = clamp(px, d.x, d.x + d.w);
    const cy = clamp(py, d.y, d.y + d.h);
    const dx = px - cx, dy = py - cy;
    const d2 = dx * dx + dy * dy;
    if (d2 < r * r && d2 > 0.0001) {
      hit = true;
      const dd = Math.sqrt(d2);
      const push = (r - dd) / dd;
      px += dx * push;
      py += dy * push;
      nx = dx / dd; ny = dy / dd;
    }
  }
  return { x: px, y: py, nx, ny, hit };
}

function paintMaskBlob(x, y, r, a) {
  const sx = x - G.cam.x, sy = y - G.cam.y;
  if (sx < -r || sy < -r || sx > W + r || sy > H + r) return;
  const g = maskX.createRadialGradient(sx, sy, 0, sx, sy, r);
  g.addColorStop(0, `rgba(255,255,255,${a})`);
  g.addColorStop(1, "rgba(255,255,255,0)");
  maskX.fillStyle = g;
  maskX.beginPath();
  maskX.arc(sx, sy, r, 0, TAU);
  maskX.fill();
}

function paintMaskRing(x, y, r, band, a) {
  const sx = x - G.cam.x, sy = y - G.cam.y;
  const outer = r + band;
  if (sx + outer < 0 || sy + outer < 0 || sx - outer > W || sy - outer > H) return;
  const g = maskX.createRadialGradient(sx, sy, Math.max(0, r - band), sx, sy, outer);
  g.addColorStop(0, "rgba(255,255,255,0)");
  g.addColorStop(0.55, `rgba(255,255,255,${a})`);
  g.addColorStop(1, "rgba(255,255,255,0)");
  maskX.fillStyle = g;
  maskX.beginPath();
  maskX.arc(sx, sy, outer, 0, TAU);
  maskX.fill();
}

function fadeTo(cb) {
  G.fadeCb = cb;
  G.fadeTarget = 1;
}
