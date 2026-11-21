// ---------------------------------------------------------------------------
// THE TIDE ENGINE — views (all drawing)
// ---------------------------------------------------------------------------
import { W, H, TAU, clamp, lerp, rand, mtof } from './util.js';
import * as R from './render.js';
import { ST, PAL } from './render.js';
import * as S from './story.js';

const DEG = Math.PI / 180;
const HIT_WIN = 28 * DEG;

export const L = {
  inst: { x: 418, y: 546, r: 208, sweepR: 290 },
  status: { x: 40, y: 84, w: 752, h: 74 },
  comms: { x: 822, y: 84, w: 738, h: 386 },
  schem: { x: 822, y: 490, w: 738, h: 410 },
  log: { x: 40, y: 916, w: 1520, h: 62 },
};

function glow(fn) {
  const prev = ST.glowMode;
  ST.glowMode = true;
  fn();
  ST.glowMode = prev;
}

function panel(x, y, w, h, title, tag) {
  R.rect(x, y, w, h, { col: PAL.cyanDim, w: 1.2, a: 0.7, r: 3 });
  const k = 14;
  const corners = [[x, y, 1, 1], [x + w, y, -1, 1], [x, y + h, 1, -1], [x + w, y + h, -1, -1]];
  for (const [cx, cy, sx, sy] of corners) {
    R.line(cx, cy, cx + sx * k, cy, { col: PAL.cyan, w: 1.5, a: 0.9 });
    R.line(cx, cy, cx, cy + sy * k, { col: PAL.cyan, w: 1.5, a: 0.9 });
  }
  if (title) {
    const tw = R.measure(title, { size: 10, tracking: 3.2 });
    R.rect(x, y - 7, tw + 18, 14, { col: PAL.bg1, w: 1, a: 1, fill: PAL.bg1 });
    R.text(title, x + 9, y + 3.5, { size: 10, col: PAL.cyan, tracking: 3.2, weight: 600 });
  }
  if (tag) R.text(tag, x + w - 9, y + 3.5, { size: 9, col: PAL.inkDim, align: 'right', tracking: 2 });
}

function bar(x, y, w, h, v, col, label, sub) {
  R.text(label, x, y - 7, { size: 10, col: PAL.ink, tracking: 3 });
  if (sub) R.text(sub, x + w, y - 7, { size: 10, col: col, align: 'right', tracking: 1.6, weight: 600 });
  R.rect(x, y, w, h, { col: PAL.cyanDim, w: 1, a: 0.55 });
  const fw = Math.max(0, Math.min(1, v)) * (w - 4);
  if (fw > 1) {
    R.rect(x + 2, y + 2, fw, h - 4, { col, w: 1, a: 0.95, fill: col + '30' });
    glow(() => R.rect(x + 2, y + 2, fw, h - 4, { col, w: 2, a: 0.85 }));
  }
  for (let i = 1; i < 10; i++) {
    R.line(x + (w * i) / 10, y + h + 2, x + (w * i) / 10, y + h + 6, { col: PAL.inkDim, w: 1, a: 0.35 });
  }
}

// ------------------------------------------------------------------- header
export function drawHUD(g) {
  R.text('THE TIDE ENGINE', 40, 42, { size: 19, col: PAL.white, tracking: 7, weight: 700 });
  R.text('UPPER ANEMONE — TIDE STATION — NIGHT SHIFT', 40, 60, { size: 9, col: PAL.inkDim, tracking: 3 });
  const actName = ['I — WIND HER UP', 'II — THE CHOIR', 'III — COMMS', 'IV — THE CORE'][g.act - 1] || '';
  glow(() => R.text(actName, 806, 38, { size: 14, col: PAL.amber, tracking: 6, align: 'center', weight: 600, a: 0.5 }));
  R.text(actName, 806, 38, { size: 14, col: PAL.amber, tracking: 6, align: 'center', weight: 600 });
  const clock = '03:' + String(14 + Math.floor(g.actT / 60)).padStart(2, '0') + ':' + String(Math.floor(g.actT % 60)).padStart(2, '0');
  R.text(clock, 1560, 38, { size: 17, col: PAL.cyan, tracking: 3, align: 'right' });
  R.text('SPRING TIDE — 04:51 — 5.4 M', 1560, 58, { size: 9, col: PAL.inkDim, tracking: 2, align: 'right' });
  R.line(40, 74, 1560, 74, { col: PAL.cyanDim, w: 1, a: 0.55 });
  R.line(40, 74, 40 + 1520 * clamp(g.nightProgress, 0, 1), 74, { col: PAL.amber, w: 2, a: 0.85 });

  // status strip
  const s = L.status;
  panel(s.x, s.y, s.w, s.h, 'INSTRUMENT STATUS', 'TIDE STATION No. 4');
  const bw = 214, gap = 29;
  const labels = ['PRESSURE', g.actLabel || 'CHARGE', 'NIGHT'];
  const cols = [g.pressure > 0.8 ? PAL.red : g.pressure > 0.5 ? PAL.amber : PAL.cyan, PAL.amber, PAL.green];
  const vals = [g.pressure, g.actProgress, g.nightProgress];
  const subs = [
    g.pressure > 0.85 ? 'SURGE' : g.pressure > 0.6 ? 'HIGH' : g.pressure > 0.3 ? 'RISING' : 'NOMINAL',
    g.actProgressLabel || '',
    Math.round(g.nightProgress * 100) + '%',
  ];
  for (let i = 0; i < 3; i++) {
    const x = s.x + 22 + i * (bw + gap);
    bar(x, s.y + 38, bw, 13, vals[i], cols[i], labels[i], subs[i]);
  }
}

// ---------------------------------------------------------------- instrument
export function drawInstrument(g) {
  const I = L.inst;
  const t = g.t;

  // --- the sweep sits behind the glass of the dial
  if (g.act >= 2) drawSweep(g);

  // --- mounting bracket
  R.segs([
    [I.x - 120, I.y + I.r + 26, I.x - 150, I.y + I.r + 78],
    [I.x + 120, I.y + I.r + 26, I.x + 150, I.y + I.r + 78],
    [I.x - 172, I.y + I.r + 78, I.x + 172, I.y + I.r + 78],
  ], { col: PAL.cyanDim, w: 1.6, a: 0.45 });

  // --- bezel
  R.circle(I.x, I.y, I.r + 30, { col: PAL.cyanDim, w: 1.2, a: 0.5 });
  R.circle(I.x, I.y, I.r + 18, { col: PAL.cyanDim, w: 1, a: 0.3, dash: [3, 7] });
  const bolts = [];
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * TAU + 0.26;
    const x = I.x + Math.cos(a) * (I.r + 24);
    const y = I.y + Math.sin(a) * (I.r + 24);
    bolts.push([x - 4, y - 4, x + 4, y + 4]);
  }
  R.segs(bolts, { col: PAL.cyanDim, w: 1.4, a: 0.65 });

  // --- dial face (faintly opaque so the sweep shows through the glass)
  R.circle(I.x, I.y, I.r + 6, { col: 'rgba(4,12,22,0.62)', w: 1, a: 1, fill: 'rgba(4,12,22,0.62)' });

  // --- scale ring
  const A0 = -225 * DEG, A1 = 45 * DEG;
  const minor = [], majorT = [];
  for (let i = 0; i <= 40; i++) {
    const a = A0 + (A1 - A0) * (i / 40);
    const isMaj = i % 4 === 0;
    const r0 = I.r - (isMaj ? 24 : 13);
    const seg = [I.x + Math.cos(a) * r0, I.y + Math.sin(a) * r0, I.x + Math.cos(a) * (I.r - 2), I.y + Math.sin(a) * (I.r - 2)];
    (isMaj ? majorT : minor).push(seg);
  }
  R.segs(minor, { col: PAL.cyanDim, w: 1, a: 0.35 });
  R.segs(majorT, { col: PAL.cyan, w: 1.5, a: 0.7 });
  for (const [p, lbl] of [[0, '0'], [0.25, '25'], [0.5, '50'], [0.75, '75'], [1, '100']]) {
    const a = A0 + (A1 - A0) * p;
    R.text(lbl, I.x + Math.cos(a) * (I.r - 42), I.y + Math.sin(a) * (I.r - 42) + 4,
      { size: 10, col: PAL.inkDim, align: 'center', tracking: 1 });
  }

  // --- target band (thick, sits just inside the bezel)
  const bandA = A0 + (A1 - A0) * clamp(g.valve.target - g.valve.band, 0, 1);
  const bandB = A0 + (A1 - A0) * clamp(g.valve.target + g.valve.band, 0, 1);
  const inBand = g.valve.inBand;
  const bandCol = inBand ? PAL.green : PAL.amber;
  glow(() => R.arc(I.x, I.y, I.r - 12, bandA, bandB, { col: bandCol, w: 22, a: inBand ? 0.34 : 0.16 }));
  R.arc(I.x, I.y, I.r - 12, bandA, bandB, { col: bandCol, w: 7, a: 0.9 });
  R.segs([
    [I.x + Math.cos(bandA) * (I.r - 24), I.y + Math.sin(bandA) * (I.r - 24), I.x + Math.cos(bandA) * (I.r + 10), I.y + Math.sin(bandA) * (I.r + 10)],
    [I.x + Math.cos(bandB) * (I.r - 24), I.y + Math.sin(bandB) * (I.r - 24), I.x + Math.cos(bandB) * (I.r + 10), I.y + Math.sin(bandB) * (I.r + 10)],
  ], { col: bandCol, w: 1.8, a: 0.85 });

  // --- pressure gauge (segmented ring, outside the bezel)
  const pStart = -215 * DEG, pEnd = 35 * DEG;
  const pv = clamp(g.pressure, 0, 1);
  const pCol = pv > 0.78 ? PAL.red : pv > 0.5 ? PAL.amber : PAL.cyan;
  const segs = [], hot = [];
  for (let i = 0; i < 30; i++) {
    const a = pStart + (pEnd - pStart) * (i / 29);
    const lit = i / 29 < pv;
    const s = [
      I.x + Math.cos(a) * (I.r + 28), I.y + Math.sin(a) * (I.r + 28),
      I.x + Math.cos(a) * (I.r + 38), I.y + Math.sin(a) * (I.r + 38),
    ];
    if (lit) hot.push(s); else segs.push(s);
  }
  R.segs(segs, { col: PAL.cyanDim, w: 1.6, a: 0.22 });
  R.segs(hot, { col: pCol, w: 2.4, a: 0.9 });
  if (pv > 0.78) {
    const pulse = 0.35 + 0.65 * Math.abs(Math.sin(t * 6));
    glow(() => R.segs(hot, { col: PAL.red, w: 3.4, a: pulse * 0.55 }));
  }

  // --- needle (amber, tapered, drawn above everything)
  const na = A0 + (A1 - A0) * g.valve.p;
  const nx = I.x + Math.cos(na) * (I.r - 30), ny = I.y + Math.sin(na) * (I.r - 30);
  const tx = I.x - Math.cos(na) * 30, ty = I.y - Math.sin(na) * 30;
  const px = -Math.sin(na), py2 = Math.cos(na);
  const nCol = inBand ? PAL.green : PAL.amber;
  const shape = (c) => {
    c.moveTo(tx + px * 7, ty + py2 * 7);
    c.lineTo(nx + px * 1.2, ny + py2 * 1.2);
    c.lineTo(nx - px * 1.2, ny - py2 * 1.2);
    c.lineTo(tx - px * 7, ty - py2 * 7);
    c.closePath();
  };
  glow(() => R.path(shape, { col: nCol, w: 2.4, a: 0.8, fill: nCol + '30' }));
  R.path(shape, { col: nCol, w: 1.6, a: 0.98, fill: nCol + '22' });
  R.circle(tx, ty, 7, { col: PAL.cyanDim, w: 1.2, a: 0.7 });
  R.circle(I.x, I.y, 15, { col: PAL.cyan, w: 1.6, a: 0.95, fill: 'rgba(5,16,28,0.95)' });
  R.circle(I.x, I.y, 5.5, { col: PAL.cyan, w: 1.4, a: 0.95 });

  // --- labels
  R.text('FIG. 2 — PRESSURE TRIM', I.x, I.y + 152, { size: 11, col: PAL.inkDim, align: 'center', tracking: 3.4 });
  R.text('VALVE 12 · ANEMONE', I.x, I.y + 172, { size: 9, col: PAL.inkDim, align: 'center', tracking: 3 });

  // --- re-trim flash
  if (g.valve.stepFlash > 0.02) {
    const f = g.valve.stepFlash;
    glow(() => R.circle(I.x, I.y, I.r + 30 + (1 - f) * 26, { col: PAL.amber, w: 3 * f, a: f * 0.75 }));
    R.text('RE-TRIM', I.x, I.y - 118, { size: 11, col: PAL.amber, align: 'center', tracking: 5, a: f * 0.9 });
  }

  // --- locked indicator
  if (g.valve.lock > 0.02) {
    const lo = clamp(g.valve.lock, 0, 1);
    const pulse = 0.55 + 0.45 * Math.sin(t * 9);
    glow(() => R.text('LOCKED', I.x, I.y + 112, { size: 15, col: PAL.green, align: 'center', tracking: 8, weight: 700, a: lo * pulse }));
  }

  // --- tutorial callout
  if (g.act === 1 && g.actT > 1.5 && g.actT < 20) {
    R.callout(I.x + 128, I.y - 140, I.x + 236, I.y - 250, 'THE VALVE', 'HOLD [A] / [D]', { col: PAL.amber });
  }
  if (g.act === 2 && g.actT > 3 && g.actT < 18) {
    R.callout(I.x - 250, I.y - 210, I.x - 300, I.y - 300, 'THE SWEEP', 'PRESS [SPACE]', { col: PAL.cyan });
  }
  if (g.act === 4 && g.actT > 2 && g.actT < 16) {
    R.callout(I.x + 40, I.y + 250, I.x + 150, I.y + 320, 'THE CORE LOCK', '[UP]/[DOWN]  [LEFT]/[RIGHT]', { col: PAL.green });
  }

  // --- sweep ring (act 2+)
  if (g.act >= 2) drawSweep(g);
}

export function drawSweep(g) {
  const I = L.inst;
  const Rr = I.sweepR;

  R.circle(I.x, I.y, Rr, { col: PAL.cyanDim, w: 1.2, a: 0.55, dash: [6, 10] });
  R.circle(I.x, I.y, Rr - 9, { col: PAL.cyanDim, w: 1, a: 0.22 });
  // beat marks
  const bm = [];
  for (let i = 0; i < 4; i++) {
    const a = -Math.PI / 2 + (i / 4) * TAU;
    bm.push([I.x + Math.cos(a) * (Rr - 8), I.y + Math.sin(a) * (Rr - 8), I.x + Math.cos(a) * (Rr + 8), I.y + Math.sin(a) * (Rr + 8)]);
  }
  R.segs(bm, { col: PAL.cyan, w: 2, a: 0.8 });

  // trail
  const sw = g.sweep.vis;
  for (let i = 0; i < 10; i++) {
    const a0 = sw - 0.9 + (i / 10) * 0.9;
    const a1 = sw - 0.9 + ((i + 1) / 10) * 0.9;
    const al = (1 - i / 10) * 0.5;
    glow(() => R.arc(I.x, I.y, Rr - 5, a0, a1, { col: PAL.cyan, w: 6 * (1 - i / 12) + 1, a: al * 0.5 }));
  }
  // sweep line
  const ex = I.x + Math.cos(sw) * (Rr - 5), ey = I.y + Math.sin(sw) * (Rr - 5);
  glow(() => R.line(I.x, I.y, ex, ey, { col: PAL.cyan, w: 4, a: 0.85 }));
  R.line(I.x, I.y, ex, ey, { col: PAL.white, w: 1.4, a: 0.85 });
  R.circle(ex, ey, 5, { col: PAL.white, w: 1.4, a: 0.95 });

  // notes
  for (const n of g.sweep.notes) {
    const rel = relAngle(n.angle, g.sweep.raw);
    const a = g.sweep.vis + rel;
    const x = I.x + Math.cos(a) * (Rr - 5), y = I.y + Math.sin(a) * (Rr - 5);
    if (n.state === 'hit') {
      if (n.fx < 1) glow(() => R.circle(x, y, 10 + n.fx * 50, { col: PAL.green, w: 3.5 * (1 - n.fx), a: (1 - n.fx) * 0.9 }));
      continue;
    }
    if (n.state === 'miss') {
      if (n.fx < 1) R.circle(x, y, 6 + n.fx * 24, { col: PAL.red, w: 2.2 * (1 - n.fx), a: (1 - n.fx) * 0.85 });
      continue;
    }
    const prog = clamp(1 - Math.abs(rel) / (113 * DEG), 0, 1);
    const near = Math.abs(rel) < HIT_WIN;
    const col = near ? PAL.green : PAL.amber;
    // the window you must hit inside, drawn on the ring
    R.arc(I.x, I.y, Rr - 5, a - HIT_WIN, a + HIT_WIN, { col, w: 4, a: 0.28 + prog * 0.35 });
    const rr = 38 - prog * 24;
    glow(() => R.circle(x, y, rr, { col, w: 2, a: 0.3 + prog * 0.55 }));
    R.circle(x, y, rr, { col, w: 1.2, a: 0.25 + prog * 0.5 });
    R.line(x, y, I.x + Math.cos(a) * (I.r + 4), I.y + Math.sin(a) * (I.r + 4), { col, w: 1, a: 0.14 });
    glow(() => R.circle(x, y, 15, { col, w: 2, a: 0.7 }));
    R.circle(x, y, 15, { col, w: 2, a: 0.95, fill: 'rgba(6,18,32,0.92)' });
    R.circle(x, y, 6, { col, w: 1.6, a: 0.95 });
  }
}

function relAngle(target, base) {
  let d = (target - base) % TAU;
  if (d > Math.PI) d -= TAU;
  if (d < -Math.PI) d += TAU;
  return d;
}

// ------------------------------------------------------------------- comms
export function drawComms(g) {
  const c = L.comms;
  const m = g.msg;
  panel(c.x, c.y, c.w, c.h, 'COMMS — CHANNEL 4', g.callOpen ? '● INCOMING' : '○ MONITOR');

  // VU meter strip
  const vuY = c.y + 24, vuX = c.x + 22, vuW = c.w - 44, vuH = 26;
  R.rect(vuX, vuY, vuW, vuH, { col: PAL.cyanDim, w: 1, a: 0.45 });
  const n = 48;
  const bars = [];
  for (let i = 0; i < n; i++) {
    const bx = vuX + 6 + (i * (vuW - 12)) / n;
    const amp = g.vu[i];
    const h = 2 + amp * (vuH - 9);
    bars.push([bx, vuY + vuH - 4, bx, vuY + vuH - 4 - h]);
    R.line(bx, vuY + vuH - 4, bx, vuY + vuH - 4 - h, { col: amp > 0.6 ? PAL.amber : PAL.cyan, w: 2.4, a: 0.3 + amp * 0.7 });
  }
  R.text('SIGNAL', vuX + 4, vuY + 11, { size: 7, col: PAL.inkDim, tracking: 2 });

  // current message
  const ty = c.y + 84;
  if (m) {
    const sp = S.SPEAKERS[m.sp] || S.SPEAKERS.SYS;
    if (sp.name) {
      R.text(sp.name, c.x + 22, ty, { size: 11, col: sp.col, tracking: 3.6, weight: 700 });
      const w = R.measure(sp.name, { size: 11, tracking: 3.6 });
      R.line(c.x + 22 + w + 12, ty - 4, c.x + c.w - 22, ty - 4, { col: sp.col, w: 1, a: 0.22 });
    }
    const lines = wrapText(m.shownText, c.w - 44, 15);
    const maxLines = g.finalShown ? 3 : 4;
    const start = Math.max(0, lines.length - maxLines);
    for (let i = start; i < lines.length; i++) {
      const y = ty + 28 + (i - start) * 25;
      R.text(lines[i], c.x + 22, y, { size: 15, col: PAL.white, tracking: 1.1, a: 0.95 });
    }
  } else {
    R.text('— NO TRAFFIC ON CHANNEL 4 —', c.x + 22, ty + 24, { size: 13, col: PAL.inkDim, tracking: 4 });
  }

  // scope
  if (!g.finalShown) drawScope(g, c.x + 22, c.y + 206, c.w - 44, 60);

  // divider + recent transmissions
  const dy = c.y + 284;
  R.line(c.x + 22, dy - 14, c.x + c.w - 22, dy - 14, { col: PAL.cyanDim, w: 1, a: 0.3 });
  R.text('TRAFFIC LOG', c.x + 22, dy, { size: 8, col: PAL.inkDim, tracking: 3 });
  if (!(g.choices && g.choices.length)) {
    g.traffic.slice(-3).forEach((t, i, arr) => {
      const y = dy + 18 + i * 19;
      const txt = t.length > 96 ? t.slice(0, 95) + '…' : t;
      R.text(txt, c.x + 22, y, { size: 10, col: PAL.inkDim, tracking: 1.4, a: 0.8 - i * 0.22 });
    });
  }

  // choices
  if (g.choices && g.choices.length) {
    const cy = c.y + c.h - 122;
    R.line(c.x + 22, cy - 16, c.x + c.w - 22, cy - 16, { col: PAL.amber, w: 1, a: 0.3 });
    g.choices.forEach((ch, i) => {
      const bx = c.x + 22 + i * ((c.w - 44) / 2);
      const bw = (c.w - 44) / 2 - 14;
      const sel = g.choiceSel === i;
      const hov = g.mouseHover === 'choice' + i;
      const col = sel || hov ? PAL.amber : PAL.cyanDim;
      R.rect(bx, cy, bw, 60, {
        col, w: sel ? 2 : 1.2, a: sel ? 0.95 : 0.5, r: 2,
        fill: sel ? 'rgba(255,180,84,0.12)' : 'rgba(5,14,26,0.6)',
      });
      R.text('[' + (i + 1) + ']', bx + 12, cy + 22, { size: 13, col, tracking: 2, weight: 700 });
      R.text(ch.label, bx + 44, cy + 22, { size: 13, col: sel ? PAL.white : PAL.ink, tracking: 2, weight: 600 });
      R.text(ch.sub || '', bx + 12, cy + 45, { size: 10, col: PAL.inkDim, tracking: 1.4 });
    });
  }

  // call timer
  if (g.callOpen && g.callTimer > 0) {
    const p = g.callTimer / g.callTimerMax;
    const bx = c.x + c.w - 22 - 220, by = c.y + c.h - 22;
    R.text('CALLER WAITING', bx, by - 9, { size: 9, col: PAL.inkDim, tracking: 2.4 });
    R.rect(bx, by, 220, 8, { col: PAL.cyanDim, w: 1, a: 0.5 });
    const col = p < 0.3 ? PAL.red : p < 0.6 ? PAL.amber : PAL.cyan;
    R.rect(bx + 2, by + 2, 216 * p, 4, { col, w: 1, a: 0.95, fill: col + '44' });
  }
}

export function wrapText(str, maxW, size) {
  const words = str.split(' ');
  const lines = [];
  let cur = '';
  const w = (s) => R.measure(s, { size, tracking: 1.1 });
  for (const word of words) {
    const test = cur ? cur + ' ' + word : word;
    if (w(test) > maxW && cur) { lines.push(cur); cur = word; }
    else cur = test;
  }
  if (cur) lines.push(cur);
  return lines;
}

function drawScope(g, x, y, w, h) {
  R.rect(x, y, w, h, { col: PAL.cyanDim, w: 1, a: 0.35 });
  const grid = [];
  for (let i = 1; i < 8; i++) grid.push([x + (w * i) / 8, y, x + (w * i) / 8, y + h]);
  for (let i = 1; i < 3; i++) grid.push([x, y + (h * i) / 3, x + w, y + (h * i) / 3]);
  R.segs(grid, { col: PAL.cyanDim, w: 1, a: 0.13 });
  const t = g.t;
  const mid = y + h / 2;
  const n = 96;
  const amp = h * 0.42 * (0.22 + g.scopeAmp);
  const pts = [];
  for (let i = 0; i < n; i++) {
    const px = x + 4 + (i * (w - 8)) / (n - 1);
    const ph = t * 9 - i * 0.42;
    const v = Math.sin(ph) * 0.55 + Math.sin(ph * 2.7 + 1.3) * 0.3 + Math.sin(ph * 6.1) * 0.12;
    pts.push([px, mid - v * amp]);
  }
  R.poly(pts, { col: PAL.cyan, w: 1.4, a: 0.85 });
  glow(() => R.poly(pts, { col: PAL.cyan, w: 3, a: 0.28 }));
  R.text('SCOPE — CH 4', x + 6, y + 12, { size: 7, col: PAL.inkDim, tracking: 2 });
  R.text('ENGINE HUM — ' + (g.valve.inBand ? 'IN BAND' : 'OFF BAND'), x + w - 6, y + 12,
    { size: 7, col: g.valve.inBand ? PAL.green : PAL.inkDim, align: 'right', tracking: 2 });
}

// --------------------------------------------------------------- schematic
export function drawSchematic(g) {
  const c = L.schem;
  const titles = {
    1: ['FIG. 2 — TIDE ENGINE — SECTION A–A', 'REV. 11'],
    2: ['FIG. 9 — THE CHOIR PIPES', 'SHEET 9'],
    3: ['FIG. 3 — UPPER AND LOWER ANEMONE', 'SHEET 2'],
    4: ['FIG. 4 — THE CORE — SECTION A–A', 'REV. 12'],
  };
  const t = titles[g.act] || titles[1];
  panel(c.x, c.y, c.w, c.h, t[0], t[1]);

  const ox = c.x + 26, oy = c.y + 32;
  const ow = c.w - 52, oh = c.h - 60;
  const rv = clamp(g.figReveal === undefined ? 1 : g.figReveal, 0, 1);

  // frame + grid ticks
  R.rect(ox, oy, ow, oh, { col: PAL.cyanDim, w: 1, a: 0.25 });
  const dim = [];
  for (let i = 1; i < 8; i++) dim.push([ox + (ow * i) / 8, oy, ox + (ow * i) / 8, oy + oh]);
  R.segs(dim, { col: PAL.cyanDim, w: 1, a: 0.12 });

  // the figure draws itself, line by line, like a pen plotter
  const ctx = ST.ctx;
  const sc = ST.gctx;
  const band = oh * clamp(rv, 0, 1);
  ctx.save();
  ctx.beginPath();
  ctx.rect(ox, oy, ow, oh);
  ctx.clip();
  sc.save();
  sc.beginPath();
  sc.rect(ox, oy, ow, band);
  sc.clip();

  if (g.act === 1) drawEngineFig(g, ox, oy, ow, oh, rv);
  else if (g.act === 2) drawChoirFig(g, ox, oy, ow, oh, rv);
  else if (g.act === 3) drawCityFig(g, ox, oy, ow, oh, rv);
  else drawCoreFig(g, ox, oy, ow, oh, rv);

  sc.restore();
  ctx.restore();

  // the pen head
  if (rv < 1) {
    const py = oy + band;
    R.line(ox, py, ox + ow, py, { col: PAL.cyan, w: 1.4, a: 0.7 });
    glow(() => R.line(ox, py, ox + ow, py, { col: PAL.cyan, w: 4, a: 0.35 }));
  }
}

function revLine(x, y, w, label, rv) {
  const n = Math.ceil(label.length * clamp(rv, 0, 1));
  R.text(label.slice(0, n), x, y, { size: 9, col: PAL.inkDim, tracking: 2 });
}

function drawEngineFig(g, ox, oy, ow, oh, rv) {
  const bodyY = oy + oh * 0.22;
  const bodyH = oh * 0.26;
  const seaY = oy + oh * 0.72;
  const bx = ox + ow * 0.05, bw = ow * 0.44;
  // housing
  R.rect(bx, bodyY, bw, bodyH, { col: PAL.amber, w: 1.5, a: 0.9 });
  R.rect(bx + 6, bodyY + 6, bw - 12, bodyH - 12, { col: PAL.amber, w: 1, a: 0.25 });
  revLine(bx, bodyY - 10, bw, 'ENGINE HOUSING — CAST BRONZE — 1904', rv);
  // piston
  const px = bx + bw * 0.42;
  R.rect(px - 13, bodyY + bodyH * 0.18, 26, bodyH * 0.5, { col: PAL.amber, w: 1.4, a: 0.85 });
  R.rect(px - 46, bodyY + bodyH * 0.68, 92, 11, { col: PAL.amber, w: 1.4, a: 0.85 });
  R.segs([[px, bodyY + bodyH * 0.68, px, seaY]], { col: PAL.amber, w: 1.2, a: 0.45 });
  R.text('PISTON 3', px + 52, bodyY + bodyH * 0.68 + 4, { size: 8, col: PAL.inkDim, tracking: 2 });
  // flywheel
  const fx = ox + ow * 0.76, fy = bodyY + bodyH * 0.5;
  const rot = g.t * 0.55;
  R.circle(fx, fy, 40, { col: PAL.cyan, w: 1.5, a: 0.85 });
  R.circle(fx, fy, 33, { col: PAL.cyanDim, w: 1, a: 0.4, dash: [4, 6] });
  const sp = [];
  for (let i = 0; i < 6; i++) {
    const a = rot + (i / 6) * TAU;
    sp.push([fx, fy, fx + Math.cos(a) * 33, fy + Math.sin(a) * 33]);
  }
  R.segs(sp, { col: PAL.cyan, w: 1.3, a: 0.6 });
  R.circle(fx, fy, 8, { col: PAL.cyan, w: 1.3, a: 0.9 });
  R.text('FLYWHEEL 6', fx, fy + 60, { size: 8, col: PAL.inkDim, align: 'center', tracking: 2 });
  // sea
  R.line(ox + 2, seaY, ox + ow - 2, seaY, { col: PAL.cyan, w: 1.3, a: 0.5, dash: [16, 8, 3, 8] });
  R.hatch(ox + 2, seaY, ow - 4, oy + oh - seaY - 2, { col: PAL.cyan, a: 0.1, sp: 12 });
  R.text('MEAN SEA LEVEL', ox + 8, seaY + 15, { size: 8, col: PAL.inkDim, tracking: 2 });
  // submerged city
  for (let i = 0; i < 7; i++) {
    const sx = ox + 20 + i * 46;
    const sh = 16 + (i % 3) * 12;
    R.rect(sx, seaY + 26 + (i % 2) * 20, 26, sh, { col: PAL.cyan, w: 1, a: 0.3 });
  }
  R.text('LOWER ANEMONE — SUBMERGED 1979', ox + 20, oy + oh - 12, { size: 9, col: PAL.inkDim, tracking: 2 });
  // pressure line from housing down to the sea
  R.segs([[bx + 30, bodyY + bodyH, bx + 30, seaY]], { col: PAL.cyan, w: 1.4, a: 0.45 });
  R.segs([[bx + bw - 30, bodyY + bodyH, bx + bw - 30, seaY]], { col: PAL.cyan, w: 1.4, a: 0.45 });
  // dimension line under the housing
  const dy = bodyY + bodyH + 30;
  R.segs([[bx, dy, bx + bw, dy]], { col: PAL.inkDim, w: 1, a: 0.3 });
  R.segs([[bx, dy - 4, bx, dy + 4], [bx + bw, dy - 4, bx + bw, dy + 4]], { col: PAL.inkDim, w: 1, a: 0.3 });
  R.text('11.6 M', bx + bw / 2, dy - 6, { size: 8, col: PAL.inkDim, align: 'center', tracking: 2 });
}

function drawChoirFig(g, ox, oy, ow, oh, rv) {
  const seaY = oy + oh * 0.74;
  const n = 21;
  const gap = (ow - 60) / n;
  for (let i = 0; i < n; i++) {
    const x = ox + 30 + i * gap;
    const h = 40 + ((i * 7) % 5) * 26 + (i % 3) * 12;
    const lit = g.choirGlow[i % g.choirGlow.length] || 0;
    const col = lit > 0.02 ? PAL.green : PAL.cyan;
    const w = gap * 0.52;
    R.rect(x, seaY - h, w, h, {
      col, w: 1.4, a: 0.6 + lit * 0.4,
      fill: lit > 0.02 ? 'rgba(125,255,180,0.22)' : 'rgba(14,34,54,0.55)',
    });
    R.segs([[x + w / 2, seaY - h, x + w / 2, seaY - h - 11]], { col, w: 1.2, a: 0.45 + lit * 0.45 });
    if (lit > 0.02) glow(() => R.rect(x, seaY - h, w, h, { col, w: 1.8, a: lit * 0.85 }));
  }
  R.line(ox + 2, seaY, ox + ow - 2, seaY, { col: PAL.cyan, w: 1.3, a: 0.5, dash: [16, 8, 3, 8] });
  R.hatch(ox + 2, seaY, ow - 4, oy + oh - seaY - 2, { col: PAL.cyan, a: 0.1, sp: 12 });
  R.text('31 VESSELS — 31 NOTES — 1 LISTENER', ox + 30, oy + 24, { size: 9, col: PAL.inkDim, tracking: 2 });
  R.text('THE FOURTH VESSEL IS THE ONE SHE DIED IN', ox + 30, oy + oh - 14, { size: 9, col: PAL.red, tracking: 2, a: 0.6 });
}

function drawCityFig(g, ox, oy, ow, oh, rv) {
  const seaY = oy + oh * 0.62;
  // wall
  R.segs([[ox + ow * 0.46, oy + 20, ox + ow * 0.46, seaY]], { col: PAL.amber, w: 2.4, a: 0.7 });
  for (let i = 0; i < 6; i++) {
    R.segs([[ox + ow * 0.46 - 9, oy + 34 + i * 30, ox + ow * 0.46 + 9, oy + 34 + i * 30]], { col: PAL.amber, w: 1, a: 0.35 });
  }
  R.text('THE WALL', ox + ow * 0.46 - 14, oy + 16, { size: 9, col: PAL.amberDim, align: 'right', tracking: 2 });
  // upper city on pontoons
  const ux = ox + ow * 0.52, uy = seaY - 66;
  R.text('UPPER ANEMONE — ON PONTOONS', ux, uy - 34, { size: 9, col: PAL.amberDim, tracking: 2 });
  R.line(ux, uy + 44, ux + ow * 0.40, uy + 44, { col: PAL.amber, w: 2.4, a: 0.8 });
  for (let i = 0; i < 3; i++) {
    R.circle(ux + 18 + i * (ow * 0.40 - 36) / 2, uy + 52, 6, { col: PAL.amber, w: 1.3, a: 0.7 });
  }
  for (let i = 0; i < 6; i++) {
    const bx = ux + 6 + i * (ow * 0.40 - 12) / 6;
    const bwd = (ow * 0.40 - 12) / 6 - 7;
    const bh = 28 + (i % 3) * 18;
    R.rect(bx, uy + 44 - bh, bwd, bh, { col: PAL.amber, w: 1.2, a: 0.8 });
    R.segs([[bx + bwd / 2, uy + 44 - bh, bx + bwd / 2, uy + 44 - bh - 9]], { col: PAL.amber, w: 1, a: 0.5 });
    if (i % 2 === 0) R.rect(bx + bwd * 0.25, uy + 44 - bh * 0.7, bwd * 0.3, 7, { col: PAL.amber, w: 1, a: 0.45 });
  }
  // floodlight walkway
  const wx = ox + ow * 0.26;
  R.segs([[wx, seaY - 16, wx + ow * 0.16, seaY - 16]], { col: PAL.pink, w: 1.8, a: 0.85 });
  for (let i = 0; i < 4; i++) R.circle(wx + 10 + i * 14, seaY - 24, 2.6, { col: PAL.pink, w: 1.2, a: 0.9 });
  R.text('FLOODLIGHT WALKWAY', wx + ow * 0.08, seaY - 32, { size: 8, col: PAL.pink, tracking: 1.8, a: 0.85, align: 'center' });
  // sea + submerged
  R.line(ox + 2, seaY, ox + ow - 2, seaY, { col: PAL.cyan, w: 1.3, a: 0.5, dash: [16, 8, 3, 8] });
  R.hatch(ox + 2, seaY, ow - 4, oy + oh - seaY - 2, { col: PAL.cyan, a: 0.1, sp: 12 });
  for (let i = 0; i < 9; i++) {
    const sx = ox + 16 + i * 40;
    const sh = 16 + (i % 3) * 12;
    R.rect(sx, seaY + 22 + (i % 2) * 22, 26, sh, { col: PAL.cyan, w: 1, a: 0.3 });
  }
  R.text('LOWER ANEMONE — THE ARCHIVE', ox + 16, oy + oh - 14, { size: 9, col: PAL.inkDim, tracking: 2 });
  R.text('TIDE TABLE 04:51 — 5.4 M', ox + ow - 16, oy + oh - 14, { size: 9, col: PAL.inkDim, align: 'right', tracking: 2 });
}

/** A bell profile: crown, shoulder, flared mouth, clapper. */
function bellPath(c, cx, top, w, h) {
  c.moveTo(cx - w * 0.30, top);
  c.bezierCurveTo(cx - w * 0.30, top + h * 0.34, cx - w * 0.31, top + h * 0.68, cx - w * 0.52, top + h);
  c.lineTo(cx + w * 0.52, top + h);
  c.bezierCurveTo(cx + w * 0.31, top + h * 0.68, cx + w * 0.30, top + h * 0.34, cx + w * 0.30, top);
  c.closePath();
}

function drawBell(cx, top, w, h, opts = {}) {
  const col = opts.col || PAL.amber;
  R.path((c) => bellPath(c, cx, top, w, h), { col, w: opts.w || 1.7, a: opts.a === undefined ? 0.95 : opts.a });
  R.segs([[cx - w * 0.56, top + h, cx + w * 0.56, top + h]], { col, w: (opts.w || 1.7) + 0.3, a: 0.95 });
  R.segs([[cx - w * 0.3, top, cx + w * 0.3, top]], { col, w: 1.5, a: 0.9 });
  R.segs([[cx, top - h * 0.22, cx, top]], { col, w: 1.4, a: 0.75 });
  R.segs([[cx - w * 0.2, top - h * 0.22, cx + w * 0.2, top - h * 0.22]], { col, w: 1.4, a: 0.75 });
  if (opts.glow) glow(() => R.circle(cx, top + h * 0.5, w * 0.72, { col, w: 8, a: 0.28 }));
  R.circle(cx, top + h + h * 0.13, w * 0.11, { col, w: 1.4, a: 0.9 });
}

function drawCoreFig(g, ox, oy, ow, oh, rv) {
  const cx = ox + ow * 0.27, cy = oy + oh * 0.44;
  const rings = g.rings;
  if (rings.length) {
    rings.forEach((rg, i) => {
      const a = rg.target;
      const sel = g.ringSel === i;
      R.circle(cx, cy, rg.r, { col: sel ? PAL.amber : PAL.cyanDim, w: sel ? 2 : 1.2, a: sel ? 0.95 : 0.5 });
      R.segs([
        [cx + Math.cos(a) * (rg.r - 11), cy + Math.sin(a) * (rg.r - 11), cx + Math.cos(a) * (rg.r + 11), cy + Math.sin(a) * (rg.r + 11)],
      ], { col: PAL.green, w: 2.2, a: 0.9 });
      glow(() => R.circle(cx + Math.cos(a) * rg.r, cy + Math.sin(a) * rg.r, 4.5, { col: PAL.green, w: 2, a: 0.9 }));
      const pa = rg.ang;
      const px = cx + Math.cos(pa) * rg.r, py = cy + Math.sin(pa) * rg.r;
      const aligned = Math.abs(rg.delta()) < 7 * DEG;
      const col = aligned ? PAL.green : sel ? PAL.amber : PAL.cyan;
      glow(() => R.circle(px, py, 8, { col, w: 2.6, a: 0.9 }));
      R.circle(px, py, 8, { col, w: 1.8, a: 0.95 });
      R.circle(px, py, 3, { col, w: 1.2, a: 0.95, fill: col });
      const la = 200 * DEG;
      R.circle(cx + Math.cos(la) * (rg.r + 26), cy + Math.sin(la) * (rg.r + 26), 3, { col, w: 1.4, a: 0.9 });
    });
    R.circle(cx, cy, 16, { col: PAL.cyan, w: 1.4, a: 0.85, fill: 'rgba(5,16,28,0.9)' });
    R.text('CORE', cx, cy + 4, { size: 9, col: PAL.cyan, align: 'center', tracking: 2 });
    // opening progress
    if (g.coreHold > 0.02 && !g.coreOpen) {
      R.arc(cx, cy, 118, -Math.PI / 2, -Math.PI / 2 + TAU * Math.min(1, g.coreHold / 5), { col: PAL.green, w: 3, a: 0.9 });
      R.text('OPENING', cx, cy + 136, { size: 9, col: PAL.green, align: 'center', tracking: 3 });
    }
  }
  // the bell
  const bx = ox + ow * 0.68, by = oy + oh * 0.18;
  drawBell(bx, by, 116, 118);
  R.text('THE CORE BELL', bx, by + 172, { size: 9, col: PAL.inkDim, align: 'center', tracking: 2 });
  // ring legend
  rings.forEach((rg, i) => {
    const lx = ox + 16 + i * 74;
    const sel = g.ringSel === i;
    const ok = Math.abs(rg.delta()) < 7 * DEG;
    R.circle(lx, oy + 16, 4, { col: ok ? PAL.green : sel ? PAL.amber : PAL.cyanDim, w: 1.6, a: 0.95 });
    R.text('RING ' + (i + 1), lx + 12, oy + 20, { size: 9, col: sel ? PAL.amber : PAL.inkDim, tracking: 2 });
  });
  // the two valves
  const vy = oy + oh * 0.76;
  const valves = [
    ['GATES', PAL.cyan, ox + ow * 0.58],
    ['SONG', PAL.amber, ox + ow * 0.80],
  ];
  for (const [lbl, col, vx] of valves) {
    R.rect(vx - 36, vy - 28, 72, 56, { col, w: 1.5, a: 0.7 });
    R.segs([[vx - 36, vy - 4, vx + 36, vy - 4]], { col, w: 1.2, a: 0.5 });
    R.text(lbl, vx, vy + 5, { size: 10, col, align: 'center', tracking: 2 });
  }
  R.text('ONE STOPS THE SEA — ONE FINISHES THE SONG — NOT BOTH', ox + ow * 0.50, oy + oh - 12, { size: 9, col: PAL.inkDim, tracking: 1.6 });
}

// --------------------------------------------------------------------- log
export function drawLog(g) {
  const c = L.log;
  R.rect(c.x, c.y, c.w, c.h, { col: PAL.cyanDim, w: 1, a: 0.4, r: 2 });
  R.text('LOG', c.x + 12, c.y + 38, { size: 9, col: PAL.inkDim, tracking: 3 });
  R.line(c.x + 44, c.y + 34, c.x + c.w - 12, c.y + 34, { col: PAL.cyanDim, w: 1, a: 0.3 });
  const line = g.logLine;
  if (line) R.text(line.shownText, c.x + 56, c.y + 38, { size: 11, col: PAL.ink, tracking: 1.6 });
  const prev = g.logHistory.slice(-2, -1);
  prev.forEach((l, i) => R.text(l, c.x + 56, c.y + 38 + 16 * (i + 1), { size: 9, col: PAL.inkDim, tracking: 1.2, a: 0.5 }));
}

// ------------------------------------------------------------------- title
export function drawTitle(g) {
  const t = g.t;
  const rv = clamp(g.reveal, 0, 1);

  drawSheetFrame(g);
  drawEngineFigure(g, 1120, 392, 0.95, rv);

  glow(() => R.text('THE TIDE ENGINE', 170, 372, { size: 60, col: PAL.cyan, tracking: 16, weight: 700, a: 0.30 }));
  R.text('THE TIDE ENGINE', 170, 372, { size: 60, col: PAL.white, tracking: 16, weight: 700 });
  R.text('A NIGHT SHIFT IN THE DROWNED CITY OF ANEMONE', 174, 408, { size: 13, col: PAL.amber, tracking: 6 });

  R.line(170, 442, 700, 442, { col: PAL.cyanDim, w: 1, a: 0.6 });
  const lines = [
    'THE SEA TOOK THE STREETS. THE BELLS. THE PEOPLE.',
    'IT DID NOT TAKE THE ENGINE.',
  ];
  lines.forEach((l, i) => {
    if (rv > i * 0.25) R.text(l, 170, 474 + i * 26, { size: 14, col: PAL.ink, tracking: 2.4, a: 0.9 });
  });

  const blink = 0.55 + 0.45 * Math.sin(t * 3.2);
  glow(() => R.text('PRESS  [ENTER]  TO CLOCK IN', 170, 618, { size: 16, col: PAL.cyan, tracking: 6, weight: 600, a: blink * 0.5 }));
  R.text('PRESS  [ENTER]  TO CLOCK IN', 170, 618, { size: 16, col: PAL.cyan, tracking: 6, weight: 600, a: blink });
  R.text('A / D — VALVE        SPACE — SWEEP        1 / 2 — ANSWER        ARROWS — CORE LOCK', 170, 652,
    { size: 10, col: PAL.inkDim, tracking: 2.4 });
  R.text('HEADPHONES RECOMMENDED — THE ENGINE SPEAKS IN BAND', 170, 674, { size: 9, col: PAL.inkDim, tracking: 2.4 });

  R.text('NIGHT 03:14', 170, 880, { size: 10, col: PAL.inkDim, tracking: 4 });
  R.text('SPRING TIDE — 5.4 M AT 04:51', 170, 900, { size: 10, col: PAL.inkDim, tracking: 4 });
  R.text('FIG. 1 — THE ENGINE AT REST', 1120, 620, { size: 10, col: PAL.inkDim, align: 'center', tracking: 4 });
}

/** The drawing-sheet border and title block. */
function drawSheetFrame(g) {
  const m = 22;
  R.rect(m, m, W - m * 2, H - m * 2, { col: PAL.cyanDim, w: 1, a: 0.35 });
  const k = 26;
  for (const [cx, cy, sx, sy] of [
    [m, m, 1, 1], [W - m, m, -1, 1], [m, H - m, 1, -1], [W - m, H - m, -1, -1],
  ]) {
    R.line(cx, cy, cx + sx * k, cy, { col: PAL.cyan, w: 1.6, a: 0.7 });
    R.line(cx, cy, cx, cy + sy * k, { col: PAL.cyan, w: 1.6, a: 0.7 });
  }
  // title block
  const bw = 460, bh = 100;
  const bx = W - m - bw, by = H - m - bh;
  R.rect(bx, by, bw, bh, { col: PAL.cyanDim, w: 1, a: 0.4 });
  R.line(bx, by + 25, bx + bw, by + 25, { col: PAL.cyanDim, w: 1, a: 0.3 });
  R.line(bx, by + 50, bx + bw, by + 50, { col: PAL.cyanDim, w: 1, a: 0.3 });
  R.line(bx, by + 75, bx + bw, by + 75, { col: PAL.cyanDim, w: 1, a: 0.3 });
  R.line(bx + 82, by, bx + 82, by + bh, { col: PAL.cyanDim, w: 1, a: 0.3 });
  const rows = [
    ['PROJECT', 'TIDE ENGINE No. 4 — NIGHT SHIFT'],
    ['LOCATION', 'ANEMONE — SUBMERGED 1979'],
    ['DRAWN BY', 'W. ASHGROVE, APPRENTICE'],
    ['SCALE 1:50', 'SHEET 1 OF 1'],
  ];
  rows.forEach((r, i) => {
    R.text(r[0], bx + 10, by + 18 + i * 25, { size: 8, col: PAL.inkDim, tracking: 2 });
    R.text(r[1], bx + 92, by + 18 + i * 25, { size: 9, col: PAL.ink, tracking: 1.2 });
  });
  R.text('REV 11', bx + bw - 10, by + 93, { size: 8, col: PAL.inkDim, align: 'right', tracking: 2 });
}

export function drawEngineFigure(g, x, y, s, rv) {
  const cx = x, cy = y;
  const seg = (pts, col) => {
    const total = pts.length - 1;
    const p = rv * (total + 1);
    const idx = Math.min(total, Math.floor(p));
    const frac = p - idx;
    const sub = pts.slice(0, idx + 1);
    if (frac > 0 && idx < total) sub.push([lerp(pts[idx][0], pts[idx + 1][0], frac), lerp(pts[idx][1], pts[idx + 1][1], frac)]);
    if (sub.length > 1) R.poly(sub, { col: col || PAL.cyan, w: 1.5, a: 0.9 });
  };
  // beam
  seg([[cx - 320 * s, cy - 230 * s], [cx + 320 * s, cy - 230 * s]], PAL.amber);
  // bell
  const bx = cx - 90 * s, by = cy - 215 * s;
  drawBell(bx, by, 96 * s, 108 * s);
  // pipes
  for (let i = 0; i < 10; i++) {
    const px = cx - 60 * s + i * 40 * s;
    const h = (46 + (i % 5) * 30) * s;
    R.segs([[px, cy + 70 * s, px, cy + 70 * s - h], [px, cy + 70 * s - h, px + 20 * s, cy + 70 * s - h]],
      { col: PAL.cyan, w: 1.3, a: 0.65 });
  }
  // hull
  seg([[cx - 330 * s, cy + 70 * s], [cx + 330 * s, cy + 70 * s]]);
  seg([[cx - 360 * s, cy + 104 * s], [cx + 360 * s, cy + 104 * s]]);
  const ribs = [];
  for (let i = -7; i <= 7; i++) ribs.push([cx + i * 52 * s, cy + 70 * s, cx + i * 52 * s, cy + 104 * s]);
  R.segs(ribs, { col: PAL.cyanDim, w: 1, a: 0.4 });
  // sea
  for (let i = 0; i < 3; i++) {
    const yy = cy + 126 * s + i * 24 * s;
    const pts = [];
    for (let j = 0; j <= 34; j++) {
      pts.push([cx - 360 * s + (720 * s * j) / 34, yy + Math.sin(j * 0.55 + g.t * 1.1 + i) * 5 * s]);
    }
    seg(pts);
  }
  // annotation
  R.segs([[bx + 60 * s, by + 40 * s, bx + 130 * s, by - 20 * s]], { col: PAL.amberDim, w: 1, a: 0.6, dash: [4, 4] });
  R.text('THE CORE BELL', bx + 138 * s, by - 22 * s, { size: 10, col: PAL.amberDim, tracking: 2.4 });
  R.segs([[cx + 150 * s, cy + 40 * s, cx + 220 * s, cy - 20 * s]], { col: PAL.cyanDim, w: 1, a: 0.6, dash: [4, 4] });
  R.text('CHOIR — 31 VESSELS', cx + 228 * s, cy - 22 * s, { size: 10, col: PAL.inkDim, tracking: 2.4 });
}

// ------------------------------------------------------------------- intro
export function drawIntro(g) {
  R.text('ANEMONE — 1979 — 2026', 800, 186, { size: 12, col: PAL.inkDim, align: 'center', tracking: 8 });
  R.line(600, 206, 1000, 206, { col: PAL.cyanDim, w: 1, a: 0.4 });
  const cur = g.introLines.slice(0, g.introIndex + 1);
  cur.forEach((l, i) => {
    const last = i === g.introIndex;
    R.text(l, 800, 300 + i * 46, { size: last ? 22 : 16, col: PAL.white, align: 'center', tracking: 3, a: last ? 1 : 0.32 });
  });
  const blink = 0.4 + 0.5 * Math.sin(g.t * 3);
  R.text('PRESS  [SPACE]  TO CONTINUE', 800, 878, { size: 12, col: PAL.cyan, align: 'center', tracking: 5, a: blink });
  if (g.introIndex >= g.introLines.length - 1) {
    R.text('OR WAIT — THE NIGHT DOES NOT', 800, 904, { size: 9, col: PAL.inkDim, align: 'center', tracking: 3 });
  }
}

// ---------------------------------------------------------------- epilogue
export function drawEpilogue(g) {
  const seaH = g.ending === 'memory' ? 0.72 : 0.28;
  drawFinalTableau(g, 1245, 400, seaH);

  const px = 70, py = 96, pw = 930, ph = 730;
  R.rect(px, py, pw, ph, { col: PAL.cyanDim, w: 1.2, a: 0.5, fill: 'rgba(3,9,18,0.66)' });
  const corner = 18;
  for (const [cx, cy, sx, sy] of [[px, py, 1, 1], [px + pw, py, -1, 1], [px, py + ph, 1, -1], [px + pw, py + ph, -1, -1]]) {
    R.line(cx, cy, cx + sx * corner, cy, { col: PAL.amber, w: 1.6, a: 0.8 });
    R.line(cx, cy, cx, cy + sy * corner, { col: PAL.amber, w: 1.6, a: 0.8 });
  }
  R.text('AFTER', px + 26, py + 40, { size: 11, col: PAL.amber, tracking: 7, weight: 700 });
  const lines = g.epiLines;
  // build the visible block from the end backwards, newest at the bottom
  const avail = ph - 130 - 40;
  const blocks = [];
  let total = 0;
  for (let i = lines.length - 1; i >= 0; i--) {
    const isLast = i === lines.length - 1;
    if (lines[i] === '') { blocks.push({ sep: true, rows: [], isLast }); total += 40; }
    else {
      const rows = wrapText(lines[i], pw - 56, isLast ? 16 : 15);
      blocks.push({ rows, isLast });
      total += rows.length * 26 + 26;
    }
    if (total > avail) break;
  }
  blocks.reverse();
  let y = py + ph - 56 - total;
  for (const b of blocks) {
    if (b.sep) {
      R.segs([[px + 26, y - 12], [px + pw - 26, y - 12]], { col: PAL.amber, w: 1, a: 0.35 });
      R.text('· · ·', px + pw / 2, y - 4, { size: 10, col: PAL.amber, align: 'center', tracking: 4, a: 0.5 });
      y += 40;
      continue;
    }
    for (const row of b.rows) {
      R.text(row, px + 26, y, { size: b.isLast ? 16 : 15, col: b.isLast ? PAL.amber : PAL.white, tracking: 1.8, a: 0.95 });
      y += 26;
    }
    y += 26;
  }
  const blink = 0.4 + 0.5 * Math.sin(g.t * 3);
  if (g.epiIndex >= g.epiLines.length - 1) {
    R.text('PRESS  [R]  TO CLOCK IN AGAIN', px + 26, py + ph - 24, { size: 12, col: PAL.cyan, tracking: 4, a: blink });
  }

  drawSongSheet(g, 1040, 630);
}

function drawSongSheet(g, x, y) {
  R.text('THE ENGINE’S SONG — AS YOU PLAYED IT', x, y, { size: 10, col: PAL.inkDim, tracking: 3.2 });
  const sheet = g.songSheet;
  const sw = 360, sh = 86;
  const ox = x, oy = y + 12;
  R.rect(ox, oy, sw, sh, { col: PAL.cyanDim, w: 1, a: 0.4 });
  const staffTop = oy + 14;
  const staff = [];
  for (let i = 0; i < 5; i++) staff.push([ox + 6, staffTop + i * 11, ox + sw - 6, staffTop + i * 11]);
  R.segs(staff, { col: PAL.cyanDim, w: 1, a: 0.32 });
  const n = sheet.length || 1;
  const step = (sw - 24) / n;
  sheet.forEach((s, i) => {
    const y = staffTop + 44 - (s.midi - 55) * 2.6;
    const x = ox + 12 + i * step;
    const col = s.hit ? PAL.green : PAL.red;
    if (s.hit) glow(() => R.circle(x, y, 3.8, { col, w: 1.5, a: 0.7 }));
    R.circle(x, y, 3.8, { col, w: 1.3, a: 0.95, fill: s.hit ? col + '44' : 'transparent' });
  });
  const hi = sheet.filter((s) => s.hit).length;
  R.text(hi + ' / ' + sheet.length + ' NOTES HELD', ox, oy + sh + 14, { size: 9, col: PAL.inkDim, tracking: 2 });

  // your own trim, written down as a melody
  const my = g.melodyNotes || [];
  const y2 = oy + sh + 34;
  R.text('YOUR TRIM — THE MELODY YOU TUNED TONIGHT', x, y2, { size: 10, col: PAL.amberDim, tracking: 3 });
  const sh2 = 74;
  R.rect(ox, y2 + 10, sw, sh2, { col: PAL.amberDim, w: 1, a: 0.3 });
  const st2 = [];
  for (let i = 0; i < 5; i++) st2.push([ox + 6, y2 + 24 + i * 10, ox + sw - 6, y2 + 24 + i * 10]);
  R.segs(st2, { col: PAL.amberDim, w: 1, a: 0.3 });
  const step2 = (sw - 24) / Math.max(1, my.length);
  my.forEach((m, i) => {
    const yy = y2 + 44 - (m - 55) * 2.4;
    const xx = ox + 12 + i * step2;
    glow(() => R.circle(xx, yy, 3.4, { col: PAL.amber, w: 1.4, a: 0.6 }));
    R.circle(xx, yy, 3.4, { col: PAL.amber, w: 1.2, a: 0.95, fill: 'rgba(255,180,84,0.35)' });
  });
  R.text(my.length + ' NOTES — SHE SANG THEM BACK', ox, y2 + sh2 + 22, { size: 9, col: PAL.inkDim, tracking: 2 });
}

function drawFinalTableau(g, x, y, sea) {
  const s = 1.0;
  const cx = x, cy = y;
  const seaY = cy - 150 * s + 320 * s * sea;
  for (let i = 0; i < 4; i++) {
    const yy = seaY + i * 22 * s;
    const pts = [];
    for (let j = 0; j <= 30; j++) {
      pts.push([cx - 300 * s + (600 * s * j) / 30, yy + Math.sin(j * 0.5 + g.t * 0.9 + i) * 4 * s]);
    }
    R.poly(pts, { col: PAL.cyan, w: 1.3, a: 0.45 - i * 0.07 });
  }
  R.line(cx - 310 * s, seaY, cx + 310 * s, seaY, { col: PAL.cyan, w: 1.4, a: 0.6, dash: [16, 8] });

  // beam + bell
  R.segs([[cx - 280 * s, cy - 250 * s, cx + 280 * s, cy - 250 * s]], { col: PAL.amber, w: 1.6, a: 0.8 });
  const bx = cx, by = cy - 240 * s;
  drawBell(bx, by, 116 * s, 112 * s, { glow: g.ending === 'memory' });

  // pipes
  for (let i = 0; i < 11; i++) {
    const px = cx - 210 * s + i * 40 * s;
    const h = (32 + (i % 5) * 22) * s;
    R.segs([[px, seaY + 40 * s, px, seaY + 40 * s - h]], { col: PAL.cyan, w: 1.1, a: 0.5 });
  }
  // city
  for (let i = 0; i < 8; i++) {
    const bx2 = cx - 230 * s + i * 62 * s;
    const bh = (26 + (i % 3) * 18) * s;
    const drowned = sea > 0.5;
    R.rect(bx2, seaY + 40 * s - bh, 38 * s, bh, { col: PAL.amber, w: 1.1, a: drowned ? 0.25 : 0.7 });
  }
  R.text(g.ending === 'memory' ? 'THE SEA CAME IN' : 'THE SEA KEPT OUT', cx, cy - 285 * s, { size: 11, col: PAL.amber, align: 'center', tracking: 5 });
}

// ------------------------------------------------------------ final choice
export function drawFinalChoice(g) {
  const c = L.comms;
  const y = 300;
  const bw = 340, bh = 116, gap = 16;
  const x0 = c.x + 24;
  S.FINAL_CHOICES.forEach((o, i) => {
    const x = x0 + i * (bw + gap);
    const sel = g.finalSel === i;
    const col = sel ? PAL.amber : PAL.cyanDim;
    R.rect(x, y, bw, bh, { col, w: sel ? 2.4 : 1.2, a: sel ? 1 : 0.5, r: 3, fill: sel ? 'rgba(255,180,84,0.13)' : 'rgba(4,11,21,0.8)' });
    R.rect(x, y, bw, 3, { col, w: 1, a: sel ? 0.9 : 0.3, fill: col + (sel ? '66' : '22') });
    R.text(o.label, x + 18, y + 36, { size: 14, col: sel ? PAL.white : PAL.ink, tracking: 2.6, weight: 700 });
    R.text(o.sub, x + 18, y + 56, { size: 11, col: PAL.amberDim, tracking: 2.2 });
    wrapText(o.hint, bw - 36, 10).forEach((l, k) => {
      R.text(l, x + 18, y + 78 + k * 15, { size: 10, col: PAL.inkDim, tracking: 1.2 });
    });
    R.text('[1]', x + bw - 24, y + 24, { size: 12, col, align: 'right', tracking: 2, weight: 700 });
    R.text('[2]', x + bw - 24, y + 44, { size: 12, col, align: 'right', tracking: 2, weight: 700 });
  });
  const by = y + bh + 20;
  if (g.finalHold > 0.01) {
    R.text('HOLD  [ENTER]  TO COMMIT', c.x + c.w / 2, by, { size: 11, col: PAL.amber, align: 'center', tracking: 4, a: 0.95 });
    R.rect(c.x + c.w / 2 - 130, by + 8, 260, 9, { col: PAL.cyanDim, w: 1, a: 0.6 });
    R.rect(c.x + c.w / 2 - 128, by + 10, 256 * clamp(g.finalHold, 0, 1), 5, { col: PAL.amber, w: 1, a: 0.95, fill: PAL.amber + '55' });
  } else {
    R.text('SELECT  [1]  OR  [2]      HOLD  [ENTER]  TO COMMIT', c.x + c.w / 2, by + 6,
      { size: 11, col: PAL.cyan, align: 'center', tracking: 4, a: 0.85 });
  }
}
