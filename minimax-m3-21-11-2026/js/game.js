// ---------------------------------------------------------------------------
// THE TIDE ENGINE — game logic
// ---------------------------------------------------------------------------
import { W, H, TAU, clamp, lerp, rand, chance } from './util.js';
import * as R from './render.js';
import { ST, PAL } from './render.js';
import * as V from './views.js';
import * as S from './story.js';
import { AudioEngine } from './audio.js';

const DEG = Math.PI / 180;
const VALVE_RATE = 0.66;
const SWEEP_SPEED = 126 * DEG;   // rad/s  (90 deg per beat at 84bpm)
const BEAT = 90 * DEG;
const LEAD = 113 * DEG;
const HIT_WINDOW = 28 * DEG;
const PERFECT_WINDOW = 10 * DEG;

export class Game {
  constructor() {
    this.audio = new AudioEngine();
    this.state = 'title';
    this.t = 0;
    this.act = 1;
    this.actT = 0;
    this.actProgress = 0;
    this.nightProgress = 0;
    this.actLabel = 'CHARGE';
    this.actProgressLabel = '';
    this.pressure = 0;
    this.charge = 0;
    this.valve = { p: 0.5, target: 0.5, band: 0.10, v: 0, amp: 0.18, wt: 0, ph1: Math.random() * 6.28, ph2: Math.random() * 6.28, inBand: false, lock: 0, stepOff: 0, stepT: 7, stepEvery: 9, stepFlash: 0 };
    this.sweep = { raw: 0, vis: 0, notes: [], spawned: 0, hits: 0, misses: 0, maintNext: 0 };
    this.msg = null;
    this.msgQ = [];
    this.traffic = [];
    this.choices = null;
    this.choiceSel = 0;
    this.callOpen = null;
    this.callTimer = 0;
    this.callTimerMax = 22;
    this.callCooldown = 0;
    this.focus = 0;
    this.pendingCalls = [];
    this.resolvedCalls = 0;
    this.rings = [];
    this.ringSel = 0;
    this.coreOpen = false;
    this.coreHold = 0;
    this.finalSel = 0;
    this.finalHold = 0;
    this.finalShown = false;
    this.flags = {};
    this.melody = [];
    this.melodyT = 0;
    this.logLine = null;
    this.logQ = [];
    this.logHistory = [];
    this.vu = new Float32Array(44);
    this.scope = new Float32Array(80);
    this.scopeAmp = 0.2;
    this.vuT = 0;
    this.keys = {};
    this.reveal = 0;
    this.titleFig = { reveal: 0 };
    this.introLines = S.INTRO.slice();
    this.introIndex = 0;
    this.introT = 0;
    this.epiLines = [];
    this.epiIndex = 0;
    this.epiT = 0;
    this.ending = null;
    this.songSheet = [];
    this.choirGlow = new Array(13).fill(0);
    this.trans = null;
    this.mouse = { x: -999, y: -999, down: false, dragging: false };
    this.mouseHover = null;
    this.surgeCount = 0;
    this.totalTime = 0;
    this.deathTimer = 0;
  }

  // ------------------------------------------------------------------ input
  attach(canvas) {
    window.addEventListener('keydown', (e) => {
      if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Space', 'KeyA', 'KeyD', 'Digit1', 'Digit2', 'Enter', 'KeyR', 'Escape', 'Tab'].includes(e.code)) e.preventDefault();
      if (e.repeat) { this.keys[e.code] = true; return; }
      this.keys[e.code] = true;
      this.press(e.code);
    });
    window.addEventListener('keyup', (e) => { this.keys[e.code] = false; });
    window.addEventListener('blur', () => { this.keys = {}; });

    const toLocal = (ev) => {
      const r = canvas.getBoundingClientRect();
      return { x: ((ev.clientX - r.left) / r.width) * W, y: ((ev.clientY - r.top) / r.height) * H };
    };
    canvas.addEventListener('mousemove', (ev) => {
      const p = toLocal(ev);
      this.mouse.x = p.x; this.mouse.y = p.y;
      this.mouseHover = this.hitTest(p.x, p.y);
      if (this.mouse.down && this.valveDrag) this.dragValve(p);
    });
    canvas.addEventListener('mousedown', (ev) => {
      const p = toLocal(ev);
      this.mouse.x = p.x; this.mouse.y = p.y;
      this.mouse.down = true;
      this.mouseClick(p);
    });
    window.addEventListener('mouseup', () => { this.mouse.down = false; this.valveDrag = false; });
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  press(code) {
    if (this.state === 'title') {
      if (code === 'Enter' || code === 'Space') this.begin();
      return;
    }
    if (this.state === 'intro') {
      if (code === 'Space' || code === 'Enter') this.advanceIntro();
      return;
    }
    if (this.state === 'epilogue') {
      if (code === 'Space' || code === 'Enter') this.advanceEpi();
      if (code === 'KeyR') this.restart();
      return;
    }
    // playing
    if (this.act >= 2 && (code === 'Space')) this.strike();
    if (code === 'Digit1' && this.choices) this.choose(0);
    if (code === 'Digit2' && this.choices) this.choose(1);
    if (this.finalShown) {
      if (code === 'Digit1') this.finalSel = 0;
      if (code === 'Digit2') this.finalSel = 1;
      if (code === 'ArrowLeft') this.finalSel = 0;
      if (code === 'ArrowRight') this.finalSel = 1;
    } else if (this.act === 4) {
      if (code === 'ArrowUp') this.ringSel = (this.ringSel + this.rings.length - 1) % this.rings.length;
      if (code === 'ArrowDown') this.ringSel = (this.ringSel + 1) % this.rings.length;
      if (code === 'ArrowLeft' || code === 'ArrowRight') this.audio.click(0.06);
    }
  }

  hitTest(x, y) {
    const I = V.L.inst;
    if (this.choices) {
      const c = V.L.comms;
      const cy = c.y + c.h - 122;
      for (let i = 0; i < this.choices.length; i++) {
        const bx = c.x + 22 + i * ((c.w - 44) / 2);
        const bw = (c.w - 44) / 2 - 14;
        if (x >= bx && x <= bx + bw && y >= cy && y <= cy + 60) return 'choice' + i;
      }
    }
    if (this.finalShown) {
      const c = V.L.comms;
      const y0 = 300;
      for (let i = 0; i < 2; i++) {
        const bx = c.x + 24 + i * 356;
        if (x > bx && x < bx + 340 && y > y0 && y < y0 + 116) return 'final' + i;
      }
    }
    const d = Math.hypot(x - I.x, y - I.y);
    if (this.act === 4 && this.rings.length) {
      const cx = V.L.schem.x + 26 + (V.L.schem.w - 52) * 0.20;
      const cy = V.L.schem.y + 34 + (V.L.schem.h - 62) * 0.42;
      for (let i = 0; i < this.rings.length; i++) {
        const rg = this.rings[i];
        if (Math.abs(Math.hypot(x - cx, y - cy) - rg.r) < 12) return 'ring' + i;
      }
    }
    if (this.act >= 2 && Math.abs(d - I.sweepR) < 22) return 'sweep';
    if (d < I.r + 10) return 'dial';
    return null;
  }

  mouseClick(p) {
    if (this.state === 'title') { this.begin(); return; }
    const h = this.hitTest(p.x, p.y);
    if (!h) return;
    if (h.startsWith('choice')) { this.choose(parseInt(h.slice(6), 10)); return; }
    if (h.startsWith('final')) { this.finalSel = parseInt(h.slice(5), 10); return; }
    if (h.startsWith('ring')) { this.ringSel = parseInt(h.slice(4), 10); return; }
    if (h === 'sweep') { if (this.act >= 2) this.strike(); return; }
    if (h === 'dial') { this.valveDrag = true; this.dragValve(p); }
  }

  dragValve(p) {
    const I = V.L.inst;
    let a = Math.atan2(p.y - I.y, p.x - I.x);
    const A0 = -225 * DEG, A1 = 45 * DEG;
    let deg = a / DEG;
    // unwrap to the gauge range
    while (deg < A0 / DEG) deg += 360;
    while (deg > A1 / DEG) deg -= 360;
    this.valve.p = clamp((deg - A0 / DEG) / ((A1 - A0) / DEG), 0, 1);
  }

  // ------------------------------------------------------------- lifecycle
  begin() {
    if (new URLSearchParams(location.search).has('mute')) {
      this.audio.silent = true;
      this.audio.ready = true;
    }
    this.audio.init();
    this.audio.resume();
    this.state = 'intro';
    this.introIndex = -1;
    this.introT = 0;
    this.advanceIntro();
    this.audio.setMode('calm');
    this.audio.setIntensity(0.2);
  }

  restart() {
    const keep = this.audio;
    const g = new Game();
    g.audio = keep;
    Object.assign(this, g);
    if (keep.ready && !keep.silent) {
      keep.setMode('calm');
      keep.setIntensity(0.2);
      keep._step = 0;
      keep._bar = 0;
      keep._nextTime = keep.ctx.currentTime + 0.1;
      keep.setHum(1, false, false);
    }
  }

  advanceIntro() {
    this.introIndex++;
    if (this.introIndex >= this.introLines.length) {
      this.startAct(1);
      return;
    }
    this.introT = 0;
  }

  startAct(n) {
    this.act = n;
    this.state = 'play';
    this.actT = 0;
    this.actProgress = 0;
    this.pressure = 0;
    this.charge = 0;
    this.valve.p = 0.5; this.valve.target = 0.5; this.valve.v = 0; this.valve.lock = 0;
    this.valve.band = 0.10; this.valve.amp = 0.18; this.valve.wt = 0;
    this.valve.stepOff = 0; this.valve.stepT = 8; this.valve.stepEvery = 9; this.valve.stepFlash = 0;
    this.valve.ph1 = Math.random() * 6.28; this.valve.ph2 = Math.random() * 6.28;
    this.sweep.notes = []; this.sweep.raw = 0; this.sweep.vis = 0; this.sweep.spawned = 0;
    this.sweep.hits = 0; this.sweep.misses = 0; this.sweep.maintNext = 0;
    this.msgQ = []; this.msg = null;
    this.traffic = [];
    this.figReveal = 0;
    this.choices = null;
    this.callOpen = null; this.callTimer = 0; this.focus = 0; this.callCooldown = 0;
    this.pendingCalls = []; this.resolvedCalls = 0;
    this.rings = []; this.ringSel = 0; this.coreOpen = false; this.coreHold = 0;
    this.finalSel = 0; this.finalHold = 0; this.finalShown = false;
    this.ending = null;
    this.epiLines = []; this.epiIndex = -1;
    if (n === 1) this.songSheet = [];
    this.choirGlow.fill(0);
    this.actLines = (S.ACT_LINES[n] || []).map((l) => ({ sp: l.sp, text: l.t, at: l.at, sec: l.sec, fired: false }));

    if (n === 1) {
      this.audio.setMode('calm'); this.audio.setIntensity(0.2);
      this.pushLog('REV. 11 — NIGHT SHIFT OPENS — wren, 03:14');
    } else if (n === 2) {
      this.audio.setMode('song'); this.audio.setIntensity(0.5);
      this.songSheet = S.SONG.map((s) => ({ midi: s.m, hit: false }));
      this.pushLog('SHEET 9 — CHOIR PIPES — TEMPO LOST');
    } else if (n === 3) {
      this.audio.setMode('tense'); this.audio.setIntensity(0.72);
      this.pendingCalls = S.CALLS.map((c) => Object.assign({}, c));
      this.callCooldown = 2.2;
      this.pushLog('SHEET 2 — UPPER ANEMONE — PONTOON PLAN');
    } else if (n === 4) {
      this.audio.setMode('climax'); this.audio.setIntensity(1);
      const radii = [50, 74, 98];
      const targets = [Math.PI / 2, 205 * DEG, 322 * DEG];
      this.rings = radii.map((r, i) => ({
        r, ang: (i * 137) * DEG, target: targets[i],
        delta() {
          let d = (this.target - this.ang) % TAU;
          if (d > Math.PI) d -= TAU;
          if (d < -Math.PI) d += TAU;
          return d;
        },
      }));
      this.pushLog('FIG. 4 — THE CORE — SECTION A–A');
    }
  }

  checkActLines(trigger) {
    for (const l of this.actLines) {
      if (l.fired) continue;
      const ok = l.sec !== undefined ? this.actT >= l.sec : trigger >= l.at;
      if (ok) { l.fired = true; this.pushMsg(l.sp, l.text); }
    }
  }

  // ------------------------------------------------------------- messaging
  pushMsg(sp, text, opts = {}) {
    this.msgQ.push({ sp, text, hold: opts.hold ?? (1.0 + text.length * 0.016), shownText: '', typed: 0, ...opts });
  }

  pushLog(text) {
    this.logQ.push(text);
    this.logHistory.push(text);
    if (this.logHistory.length > 40) this.logHistory.shift();
  }

  updateMessages(dt) {
    if (!this.msg && this.msgQ.length) {
      const m = this.msgQ.shift();
      this.msg = m;
      this.msg.typed = 0;
      this.msg.shownText = '';
      if (m.sp === 'HARBORMASTER' || m.sp === 'ARCHIVE' || m.sp === 'LIGHT' || m.sp === 'ILSE') this.audio.radioOpen();
      this.vuT = 0.9;
    }
    if (this.msg) {
      const m = this.msg;
      const full = m.text.length;
      const cps = 52;
      if (m.typed < full) {
        const before = Math.floor(m.typed);
        m.typed = Math.min(full, m.typed + cps * dt);
        const now = Math.floor(m.typed);
        if (now > before && now % 3 === 0) this.audio.radioBlip();
        this.vuT = 0.5;
      } else {
        m.hold -= dt;
        if (m.hold <= 0) {
          const sp = S.SPEAKERS[m.sp] || S.SPEAKERS.SYS;
          this.traffic.push((sp.name ? sp.name + ': ' : '') + m.text);
          if (this.traffic.length > 12) this.traffic.shift();
          this.msg = null;
        }
      }
      const n = Math.floor(m.typed);
      m.shownText = m.text.slice(0, n) + (n < full ? '█' : '');
    }
    // log
    if (!this.logLine && this.logQ.length) {
      this.logLine = { text: this.logQ.shift(), typed: 0, shownText: '' };
    }
    if (this.logLine) {
      const l = this.logLine;
      if (l.typed < l.text.length) {
        l.typed = Math.min(l.text.length, l.typed + 90 * dt);
        l.shownText = l.text.slice(0, Math.floor(l.typed));
      }
    }
  }

  // ------------------------------------------------------------- mechanics
  updateValve(dt, driftScale, bandScale) {
    const v = this.valve;
    // The trim target never sits still — it breathes across the dial, so the
    // player has to keep actively chasing it.
    v.wt += dt;
    v.stepOff *= Math.pow(0.28, dt);
    v.target = clamp(
      0.5 + v.amp * Math.sin(v.wt * 0.55 + v.ph1) + v.amp * 0.5 * Math.sin(v.wt * 1.31 + v.ph2) + v.stepOff,
      0.04, 0.96
    );
    // pressure steps: the line suddenly re-trims itself and the player must react
    v.stepT -= dt;
    if (v.stepT <= 0) {
      v.stepT = v.stepEvery * rand(0.8, 1.25);
      const d = rand(-1, 1) * v.amp * 0.9;
      v.stepOff = clamp(v.stepOff + d, -0.34, 0.34);
      this.audio.clunk(0.13);
      R.flash(PAL.amber, 0.13);
      v.stepFlash = 1;
    }
    v.stepFlash = Math.max(0, v.stepFlash - dt * 1.6);
    let dir = 0;
    if (!this.valveDrag) {
      dir = (this.keys['KeyD'] ? 1 : 0) - (this.keys['KeyA'] ? 1 : 0);
      v.v = lerp(v.v, dir * VALVE_RATE, 1 - Math.exp(-15 * dt));
      v.p = clamp(v.p + v.v * dt, 0, 1);
    }
    const err = Math.abs(v.p - v.target);
    v.inBand = err < v.band * bandScale;
    if (v.inBand) {
      const bonus = v.lock > 0.98 ? 1.35 : 1;
      this.charge += 0.022 * bonus * dt;
      this.pressure -= 0.11 * dt;
      v.lock = Math.min(1, v.lock + dt * 0.40);
      this.melodyT += dt;
      if (this.melodyT > 0.4) {
        this.melodyT = 0;
        this.melody.push(v.p);
        if (this.melody.length > 64) this.melody.shift();
      }
    } else {
      this.charge -= 0.014 * dt;
      this.pressure += 0.082 * dt;
      v.lock = Math.max(0, v.lock - dt * 1.4);
    }
    this.charge = clamp(this.charge, 0, 1);
    this.pressure = clamp(this.pressure, 0, 1);
    const e = clamp(err / 0.5, 0, 1);
    this.audio.setHum(e, v.inBand, this.act !== 4 || !this.finalShown);
  }

  updateSweep(dt, allowSong) {
    const s = this.sweep;
    const d = SWEEP_SPEED * dt;
    s.raw += d;
    s.vis += d;
    while (s.vis > TAU) s.vis -= TAU;

    const beatNow = s.raw / BEAT;
    if (allowSong) {
      for (let i = s.spawned; i < S.SONG.length; i++) {
        const nb = S.SONG[i].s * 0.5 + 4;
        if (nb <= beatNow + LEAD / BEAT) {
          s.notes.push({ angle: nb * BEAT, midi: S.SONG[i].m, state: 'wait', fx: 0, song: true, idx: i });
          s.spawned = i + 1;
        } else break;
      }
    }
    // maintenance notes (acts 3-4 only — act 2 is the song, nothing else)
    if (!allowSong) {
      if (s.maintNext === 0) s.maintNext = beatNow + 2;
      while (s.maintNext <= beatNow + LEAD / BEAT) {
        s.notes.push({ angle: s.maintNext * BEAT, midi: 60 + [0, 3, 5, 7, 10][Math.floor(Math.random() * 5)], state: 'wait', fx: 0, song: false });
        s.maintNext += 2;
      }
    }

    // misses
    for (let i = s.notes.length - 1; i >= 0; i--) {
      const n = s.notes[i];
      if (n.state !== 'wait') { n.fx += dt * 2.2; continue; }
      const rel = angDiff(n.angle, s.raw);
      if (rel < -HIT_WINDOW) {
        n.state = 'miss';
        this.onMiss(n);
      }
    }
    // remove resolved
    for (let i = s.notes.length - 1; i >= 0; i--) {
      if (s.notes[i].state !== 'wait' && s.notes[i].fx > 1) s.notes.splice(i, 1);
    }
  }

  strike() {
    if (this.act < 2) return;
    if (this.state !== 'play') return;
    const s = this.sweep;
    let best = null, bestAbs = 1e9;
    for (const n of s.notes) {
      if (n.state !== 'wait') continue;
      const rel = Math.abs(angDiff(n.angle, s.raw));
      if (rel < bestAbs) { bestAbs = rel; best = n; }
    }
    if (!best || bestAbs > HIT_WINDOW) {
      this.audio.click(0.05);
      this.pressure = clamp(this.pressure + 0.022, 0, 1);
      R.spawn(best ? best.angle : 0, 0, 0);
      return;
    }
    best.state = 'hit';
    best.fx = 0;
    const perfect = bestAbs < PERFECT_WINDOW;
    s.hits++;
    if (best.song) {
      const sh = this.songSheet[best.idx];
      if (sh) sh.hit = true;
    }
    this.audio.bell(best.midi, { dur: 2.0, gain: perfect ? 0.30 : 0.22, bright: perfect ? 1.2 : 0.9, pan: rand(-0.3, 0.3) });
    if (perfect) this.audio.pluck(best.midi + 12, { dur: 0.4, gain: 0.08, cutoff: 3800 });
    this.pressure = clamp(this.pressure - 0.045, 0, 1);
    this.charge = clamp(this.charge + (best.song ? 0.012 : 0.02), 0, 1);
    // sparks at the note
    const I = V.L.inst;
    const a = best.angle;
    const x = I.x + Math.cos(a) * I.sweepR;
    const y = I.y + Math.sin(a) * I.sweepR;
    R.spawn(x, y, perfect ? 16 : 9, { col: perfect ? PAL.green : PAL.cyan, spMin: 40, spMax: 190, lifeMin: 0.25, lifeMax: 0.7, sizeMin: 1, sizeMax: 2.6 });
    R.spawn(x, y, 5, { col: PAL.white, spMin: 10, spMax: 60, lifeMin: 0.15, lifeMax: 0.35 });
    // choir pipe glow
    const gi = Math.floor(Math.random() * this.choirGlow.length);
    this.choirGlow[gi] = 1;
    // pressure release puff
    R.spawn(I.x + Math.cos(a) * (I.r - 30), I.y + Math.sin(a) * (I.r - 30), 3,
      { col: PAL.cyan, kind: 'steam', lifeMin: 0.5, lifeMax: 1.2, spMin: 8, spMax: 34, grav: -14, drag: 0.94 });
  }

  onMiss(n) {
    const s = this.sweep;
    s.misses++;
    if (n.song) {
      const sh = this.songSheet[n.idx];
      if (sh) sh.hit = false;
      this.audio.noiseHit({ dur: 0.5, freq: 1400, q: 0.7, gain: 0.16, type: 'bandpass', sweep: 0.3 });
      this.audio.thump(70, { dur: 0.5, gain: 0.22 });
    } else {
      this.audio.noiseHit({ dur: 0.35, freq: 1100, q: 0.8, gain: 0.13, type: 'bandpass', sweep: 0.35 });
    }
    this.pressure = clamp(this.pressure + (n.song ? 0.075 : 0.05), 0, 1);
    this.charge = clamp(this.charge - (n.song ? 0.02 : 0.01), 0, 1);
    R.shake(3.5);
    const I = V.L.inst;
    R.spawn(I.x + Math.cos(n.angle) * (I.r - 40), I.y + Math.sin(n.angle) * (I.r - 40), 7,
      { col: PAL.red, spMin: 30, spMax: 130, lifeMin: 0.3, lifeMax: 0.8 });
    if (this.act === 2 && s.misses % 4 === 1) {
      this.pushMsg('ENGINE', 'A PIPE HAS BURST. THE SONG IS BLEEDING.');
      this.pushLog('PIPE RUPTURE — LINE 4 — THE SONG IS BLEEDING');
    }
  }

  surge() {
    this.surgeCount++;
    this.pressure = 0.55;
    this.audio.surge();
    R.shake(20); R.glitch(1); R.flash(PAL.red, 0.45);
    const I = V.L.inst;
    R.spawn(I.x, I.y, 34, { col: PAL.red, kind: 'steam', lifeMin: 0.7, lifeMax: 1.8, spMin: 40, spMax: 190, grav: -60, drag: 0.93, sizeMin: 3, sizeMax: 8 });
    for (const n of this.sweep.notes) if (!n.song && n.state === 'wait') { n.state = 'miss'; n.fx = 0; }
    this.pushMsg('ENGINE', 'PRESSURE SURGE. LINE 4 IS BURSTING. HOLD HER, WREN.');
    this.pushLog('SURGE — LINE 4 — PRESSURE 61%');
  }

  // ------------------------------------------------------------------ calls
  openCall() {
    if (!this.pendingCalls.length) return;
    const c = this.pendingCalls.shift();
    this.callOpen = c;
    this.callTimer = this.callTimerMax;
    this.msgQ.length = 0;
    this.msg = null;
    this.pushMsg(c.sp, c.t, { hold: 999 });
    this.audio.radioOpen();
    this.vuT = 1;
    this.choices = c.choices.map((ch) => ({ label: ch.label, sub: ch.sub }));
    this.choiceSel = 0;
    this.choiceData = c;
    this.pushLog('INCOMING — ' + (S.SPEAKERS[c.sp] || {}).name);
  }

  choose(i) {
    if (!this.choices || !this.callOpen) return;
    const ch = this.choiceData.choices[i];
    this.choices = null;
    this.callOpen = null;
    this.callTimer = 0;
    this.focus = 3.2;
    this.resolvedCalls++;
    Object.assign(this.flags, ch.set || {});
    this.pressure = clamp(this.pressure + (ch.cost || 0), 0, 1);
    this.audio.click(0.12);
    this.audio.bell(69, { dur: 1.2, gain: 0.10, bright: 0.5 });
    this.pushMsg('WREN', ch.after, { hold: 1.2 + ch.after.length * 0.022 });
    this.pushLog(ch.log || 'DECISION LOGGED');
    this.callCooldown = 1.6;
  }

  timeoutCall() {
    const c = this.callOpen;
    if (!c) return;
    this.choices = null;
    this.callOpen = null;
    this.resolvedCalls++;
    this.pressure = clamp(this.pressure + 0.1, 0, 1);
    Object.assign(this.flags, { [c.id + 'Timeout']: true });
    this.audio.alarm(0.10);
    this.pushMsg('ENGINE', 'NO ANSWER. THE LINE WENT DEAD. THE ENGINE KEPT WORKING ANYWAY.');
    this.pushLog('CALL UNANSWERED — ' + c.id.toUpperCase());
    this.callCooldown = 1.2;
  }

  // ----------------------------------------------------------------- update
  update(dt) {
    this.t += dt;
    R.updateParticles(dt);
    this.updateVU(dt);
    this.audio.tick();

    if (this.state === 'title') {
      this.reveal = Math.min(1, this.reveal + dt * 0.42);
      this.audio.setHum(1, false, false);
      return;
    }
    if (this.state === 'intro') {
      this.introT += dt;
      this.audio.setHum(0.35, true, true);
      if (this.introT > 2.4) { this.introT = 0; this.advanceIntro(); }
      return;
    }
    if (this.state === 'epilogue') {
      this.updateEpilogue(dt);
      return;
    }
    if (this.trans) {
      this.trans.t += dt;
      if (this.trans.t >= this.trans.dur) {
        const n = this.trans.next;
        this.trans = null;
        this.startAct(n);
      }
      return;
    }

    this.actT += dt;
    this.totalTime += dt;
    this.figReveal = Math.min(1, this.figReveal + dt * 0.85);
    this.updateMessages(dt);

    if (this.act === 1) {
      this.valve.amp = 0.17 + Math.min(this.actT * 0.0016, 0.10);
      this.valve.band = Math.max(0.062, 0.10 - this.actT * 0.00075);
      this.valve.stepEvery = Math.max(5.5, 9 - this.actT * 0.045);
      this.updateValve(dt, 1, 1);
      this.actProgress = this.charge;
      this.actProgressLabel = Math.round(this.charge * 100) + '% WOUND';
      this.actLabel = 'CHARGE';
      this.checkActLines(this.charge);
      if (this.charge >= 1) this.advanceAct(2);
    } else if (this.act === 2) {
      this.valve.amp = 0.25;
      this.valve.band = Math.max(0.052, 0.070 - this.actT * 0.00028);
      this.valve.stepEvery = 8;
      this.updateValve(dt, 1, 1);
      this.updateSweep(dt, true);
      this.actProgress = clamp(this.sweep.hits / S.SONG.length, 0, 1);
      this.actProgressLabel = this.sweep.hits + ' / ' + S.SONG.length;
      this.actLabel = 'THE SONG';
      this.checkActLines(this.actProgress);
      if (this.sweep.spawned >= S.SONG.length && this.sweep.notes.every((n) => n.state !== 'wait')) {
        this.sweepFinished();
      }
    } else if (this.act === 3) {
      this.valve.amp = 0.27;
      this.valve.band = Math.max(0.05, 0.062 - this.actT * 0.0002);
      this.valve.stepEvery = 7;
      this.updateValve(dt, 1, 1);
      this.updateSweep(dt, false);
      this.actProgress = this.resolvedCalls / S.CALLS.length;
      this.actProgressLabel = this.resolvedCalls + ' / ' + S.CALLS.length;
      this.actLabel = 'CALLS';
      this.checkActLines(this.actT);
      // call flow
      this.callCooldown -= dt;
      this.focus -= dt;
      if (this.callOpen) {
        this.callTimer -= dt;
        if (this.callTimer <= 0) this.timeoutCall();
      } else if (this.focus <= 0 && this.callCooldown <= 0 && this.pendingCalls.length) {
        this.openCall();
      }
      if (this.resolvedCalls >= S.CALLS.length && !this.callOpen && !this.pendingCalls.length) {
        this.advanceAct(4);
      }
    } else if (this.act === 4) {
      this.valve.amp = 0.28;
      this.valve.band = Math.max(0.045, 0.055 - this.actT * 0.0003);
      this.valve.stepEvery = 6;
      this.updateValve(dt, 1, 1);
      this.updateSweep(dt, false);
      this.checkActLines(this.actT);
      // ring rotation — slows to a crawl as it nears the notch
      const dir = (this.keys['ArrowRight'] ? 1 : 0) - (this.keys['ArrowLeft'] ? 1 : 0);
      if (!this.finalShown && dir !== 0 && this.rings.length) {
        const rg = this.rings[this.ringSel];
        const near = Math.abs(rg.delta()) < 22 * DEG ? 0.22 : 1;
        rg.ang = (rg.ang + dir * 1.15 * near * dt) % TAU;
        if (chance(dt * 5)) this.audio.click(0.03);
      }
      const aligned = this.rings.every((rg) => Math.abs(rg.delta()) < 7 * DEG);
      // the core only unlocks if everything is held at once: rings true,
      // the trim in band, and the pressure still sane.
      const steady = aligned && this.valve.inBand && this.pressure < 0.85;
      if (steady) {
        this.coreHold += dt;
        if (this.coreHold > 5 && !this.coreOpen) this.openCore();
      } else {
        this.coreHold = Math.max(0, this.coreHold - dt * 0.7);
      }
      this.actProgress = clamp(this.ringProgress() * 0.55 + (this.coreHold / 5) * 0.45, 0, 1);
      this.actProgressLabel = this.coreOpen ? 'OPEN'
        : (steady ? Math.round((this.coreHold / 5) * 100) + '% OPENING'
          : this.rings.filter((r) => Math.abs(r.delta()) < 7 * DEG).length + ' / 3 RINGS');
      this.actLabel = 'THE CORE';
      // final choice
      if (this.finalShown) {
        if (this.keys['Enter']) {
          this.finalHold += dt / 1.15;
          if (this.finalHold >= 1) this.commitFinal();
        } else this.finalHold = Math.max(0, this.finalHold - dt * 1.6);
      }
    }

    if (this.pressure >= 1) this.surge();

    // choir glow decay
    for (let i = 0; i < this.choirGlow.length; i++) this.choirGlow[i] = Math.max(0, this.choirGlow[i] - dt * 1.4);

    // overall progress through the night
    this.nightProgress = clamp((this.act - 1 + clamp(this.actProgress, 0, 1)) / 4, 0, 1);

    // sea level rises with pressure
    this.audio.setOcean(clamp(0.2 + this.pressure * 0.6 + (this.act - 1) * 0.1, 0, 1));
    this.audio.tick();
  }

  ringProgress() {
    if (!this.rings.length) return 0;
    let s = 0;
    for (const rg of this.rings) s += 1 - clamp(Math.abs(rg.delta()) / (Math.PI), 0, 1);
    return s / this.rings.length;
  }

  advanceAct(n) {
    this.trans = { t: 0, dur: 2.2, next: n };
    this.audio.noiseHit({ dur: 1.2, freq: 3200, q: 0.6, gain: 0.10, type: 'bandpass', sweep: 0.2 });
    R.glitch(0.5);
  }

  sweepFinished() {
    const hits = this.sweep.hits;
    const total = S.SONG.length;
    if (hits >= total - 1) {
      this.pushMsg('ENGINE', 'THE SONG IS WHOLE. ONE VERSE. ELEVEN YEARS AND THE SONG IS WHOLE.');
      this.pushLog('THE SONG IS WHOLE — 31 VESSELS, 31 NOTES');
    } else {
      this.pushMsg('ENGINE', `THE SONG IS ${total - hits} NOTES SHORT. THE ENGINE WILL CARRY THE GAP.`);
      this.pushLog(`THE SONG IS ${total - hits} NOTES SHORT`);
    }
    this.advanceAct(3);
  }

  openCore() {
    this.coreOpen = true;
    this.audio.ping(1320, { gain: 0.22, dur: 1.4 });
    this.audio.bell(45, { dur: 3.0, gain: 0.26, bright: 1.3 });
    R.flash(PAL.green, 0.35);
    R.shake(8);
    this.pushMsg('ENGINE', 'THE CORE IS OPEN. TWO VALVES. ONE STOPS THE SEA. ONE FINISHES THE SONG.');
    this.pushLog('THE CORE IS OPEN — SELECTION IS FINAL');
    this.finalShown = true;
  }

  commitFinal() {
    const id = S.FINAL_CHOICES[this.finalSel].id;
    this.ending = id;
    this.finalShown = false;
    this.finalHold = 0;
    this.audio.setMode('end');
    this.audio.setIntensity(0.3);
    this.audio.surge();
    R.flash(PAL.white, 0.6);
    R.shake(22);
    // build the ending lines
    const lines = [];
    for (const l of S.ENDINGS[id]) {
      if (typeof l === 'string') lines.push(l);
      else {
        const cond = l.cond;
        let ok;
        if (cond.startsWith('!')) ok = !this.flags[cond.slice(1)];
        else ok = !!this.flags[cond];
        if (ok) lines.push(l.t);
      }
    }
    lines.push('');
    for (const c of S.CODA) lines.push(c);
    this.epiLines = lines;
    this.epiIndex = -1;
    this.epiT = 0;
    this.state = 'epilogue';
    this.nightProgress = 1;
    this.audio.setHum(0.5, false, false);
    this.startEpilogueAudio();
  }

  startEpilogueAudio() {
    const hits = this.songSheet.filter((s) => s.hit).map((s) => s.midi);
    const PENT = [0, 3, 5, 7, 10, 12, 15, 17, 19, 22];
    const mel = [];
    let last = -99;
    for (const p of this.melody) {
      const i = clamp(Math.floor(p * PENT.length), 0, PENT.length - 1);
      const n = 57 + PENT[i];
      if (n !== last) { mel.push(n); last = n; }
    }
    this.melodyNotes = mel.slice(0, 26);
    window.setTimeout(() => {
      this.audio.playSequence(hits, { step: 0.235, gain: 0.17 });
    }, 900);
    window.setTimeout(() => {
      this.audio.playSequence(this.melodyNotes, { step: 0.30, gain: 0.11, spacing: 6.4 });
    }, 3200);
  }

  updateEpilogue(dt) {
    this.epiT += dt;
    if (this.epiT > 3.5 && this.epiIndex < this.epiLines.length - 1) {
      this.epiT = 0;
      this.epiIndex++;
      this.audio.bell(45 + (this.epiIndex % 3) * 4, { dur: 2.6, gain: 0.085, bright: 0.7 });
    }
  }

  advanceEpi() {
    if (this.epiIndex < this.epiLines.length - 1) {
      this.epiIndex++;
      this.epiT = 0;
      this.audio.bell(45 + (this.epiIndex % 3) * 4, { dur: 2.4, gain: 0.08, bright: 0.7 });
    }
  }

  updateVU(dt) {
    this.vuT = Math.max(0, this.vuT - dt * 1.6);
    const level = this.vuT;
    for (let i = this.vu.length - 1; i > 0; i--) this.vu[i] = this.vu[i - 1];
    this.vu[0] = Math.max(level * (0.45 + Math.random() * 0.55), this.valve.inBand ? 0.12 : 0.03);
    this.scopeAmp = clamp(0.16 + this.vuT * 0.42 + (this.valve.inBand ? 0.22 : 0.02) + this.pressure * 0.16, 0, 1.2);
  }

  drawTransition() {
    const t = this.trans.t / this.trans.dur;
    const y = t * H;
    const c = ST.ctx;
    c.save();
    c.setTransform(ST.dpr, 0, 0, ST.dpr, 0, 0);
    c.globalCompositeOperation = 'lighter';
    const g = c.createLinearGradient(0, y - 70, 0, y + 70);
    g.addColorStop(0, 'rgba(90,200,255,0)');
    g.addColorStop(0.5, 'rgba(120,220,255,0.22)');
    g.addColorStop(1, 'rgba(90,200,255,0)');
    c.fillStyle = g;
    c.fillRect(0, y - 70, W, 140);
    c.globalCompositeOperation = 'source-over';
    c.globalAlpha = 0.9;
    c.fillStyle = PAL.cyan;
    c.fillRect(0, y - 0.5, W, 1);
    c.restore();
    R.text('REDRAWING THE ARCHIVE — FIG. ' + (this.trans.next + 8), W / 2, y - 16,
      { size: 11, col: PAL.cyan, align: 'center', tracking: 5, a: 0.9 });
  }

  // ------------------------------------------------------------------- draw
  draw(dt) {
    R.beginFrame();
    R.drawBackground(this.t);

    if (this.state === 'title') {
      V.drawTitle(this);
    } else if (this.state === 'intro') {
      V.drawIntro(this);
    } else if (this.state === 'epilogue') {
      V.drawEpilogue(this);
    } else {
      V.drawHUD(this);
      V.drawInstrument(this);
      V.drawComms(this);
      V.drawSchematic(this);
      V.drawLog(this);
      if (this.finalShown) V.drawFinalChoice(this);
      if (this.trans) this.drawTransition();
    }

    R.drawParticles();
    R.endFrame(dt);
  }
}

function angDiff(a, b) {
  let d = (a - b) % TAU;
  if (d > Math.PI) d -= TAU;
  if (d < -Math.PI) d += TAU;
  return d;
}
