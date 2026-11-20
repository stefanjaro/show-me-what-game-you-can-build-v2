(() => {
'use strict';

const VW = 1600, VH = 900, TAU = Math.PI * 2;
const SERIF = '"Iowan Old Style","Palatino Linotype",Palatino,"Book Antiqua",Georgia,serif';
const SANS = '"Avenir Next","Seravek","Gill Sans",Calibri,"Trebuchet MS",sans-serif';
const PARAMS = new URLSearchParams(location.search);
const DEBUG = PARAMS.get('dev') === '1';
const START = PARAMS.get('scene') || null;

const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const lerp = (a, b, t) => a + (b - a) * t;
const damp = (a, b, rate, dt) => a + (b - a) * (1 - Math.exp(-rate * dt));
const rand = (a = 1, b = 0) => b + Math.random() * (a - b);
const randInt = (a, b) => Math.floor(rand(a, b));
const pick = arr => arr[Math.floor(Math.random() * arr.length)];
const sign = v => v < 0 ? -1 : 1;
const easeOutCubic = t => 1 - Math.pow(1 - t, 3);
const easeInCubic = t => t * t * t;
const easeInOutCubic = t => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
const easeOutQuint = t => 1 - Math.pow(1 - t, 5);
const easeOutBack = t => { const c = 1.70158; return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); };
const smoothstep = (a, b, v) => { const t = clamp((v - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const wrap = (v, n) => ((v % n) + n) % n;
const dist = (ax, ay, bx, by) => Math.hypot(ax - bx, ay - by);

function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hexRgb(hex) {
  const h = hex.replace('#', '');
  const n = h.length === 3 ? h.split('').map(c => c + c).join('') : h;
  const v = parseInt(n, 16);
  return [(v >> 16) & 255, (v >> 8) & 255, v & 255];
}

function rgba(hex, a) {
  const [r, g, b] = hexRgb(hex);
  return `rgba(${r},${g},${b},${a})`;
}

function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.ceil(w));
  c.height = Math.max(1, Math.ceil(h));
  return c;
}

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d', { alpha: false });
let viewScale = 1, viewOx = 0, viewOy = 0, viewDpr = 1;

function resize() {
  const w = window.innerWidth, h = window.innerHeight;
  viewDpr = Math.min(window.devicePixelRatio || 1, 1.5);
  canvas.width = Math.round(w * viewDpr);
  canvas.height = Math.round(h * viewDpr);
  canvas.style.width = w + 'px';
  canvas.style.height = h + 'px';
  viewScale = Math.min(w / VW, h / VH);
  viewOx = (w - VW * viewScale) / 2;
  viewOy = (h - VH * viewScale) / 2;
}
window.addEventListener('resize', resize);
resize();

const Input = {
  keys: new Set(),
  pressed: new Set(),
  anyPressed: false,
  mouse: { x: 0, y: 0, down: false, clicked: false, moved: false },
  install() {
    window.addEventListener('keydown', e => {
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space', 'Tab', 'Backspace'].includes(e.code)) e.preventDefault();
      if (!e.repeat) {
        this.pressed.add(e.code);
        this.anyPressed = true;
      }
      this.keys.add(e.code);
      if (e.code !== 'F5' && e.code !== 'F12') Sound.init();
    });
    window.addEventListener('keyup', e => { this.keys.delete(e.code); });
    window.addEventListener('blur', () => { this.keys.clear(); this.mouse.down = false; });
    canvas.addEventListener('pointerdown', e => {
      this.mouse.down = true;
      this.mouse.clicked = true;
      this.anyPressed = true;
      this.updateMouse(e);
      Sound.init();
    });
    window.addEventListener('pointerup', () => { this.mouse.down = false; });
    window.addEventListener('pointermove', e => { this.updateMouse(e); this.mouse.moved = true; });
    canvas.style.cursor = 'default';
  },
  updateMouse(e) {
    const r = canvas.getBoundingClientRect();
    this.mouse.x = (e.clientX - r.left - viewOx) / viewScale;
    this.mouse.y = (e.clientY - r.top - viewOy) / viewScale;
  },
  down(code) { return this.keys.has(code); },
  hit(code) { return this.pressed.has(code); },
  left() { return this.down('ArrowLeft') || this.down('KeyA'); },
  right() { return this.down('ArrowRight') || this.down('KeyD'); },
  up() { return this.down('ArrowUp') || this.down('KeyW'); },
  downKey() { return this.down('ArrowDown') || this.down('KeyS'); },
  flap() { return this.down('Space') || this.mouse.down; },
  endFrame() {
    this.pressed.clear();
    this.anyPressed = false;
    this.mouse.clicked = false;
    this.mouse.moved = false;
  }
};

const candidates = [
  'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown',
  'KeyA', 'KeyD', 'KeyW', 'KeyS', 'Space', 'Enter', 'Escape', 'KeyM', 'KeyF', 'KeyR'
];

function anyKeyPressed() {
  return Input.anyPressed;
}

const midiFreq = m => 440 * Math.pow(2, (m - 69) / 12);

const THEME = [
  [0, 74, 2], [2, 77, 1], [3, 76, 1], [4, 74, 2], [6, 69, 2],
  [8, 70, 2], [10, 74, 1], [11, 77, 1], [12, 76, 2], [14, 72, 1], [15, 74, 1]
];

const PAD_CHORDS = {
  meadow: [[50, 53, 57], [46, 50, 53], [41, 45, 48], [48, 52, 55]],
  storm: [[50, 53, 57], [46, 50, 53], [43, 46, 50], [45, 49, 52]],
  town: [[46, 50, 53], [41, 45, 48], [48, 52, 55], [50, 53, 57]],
  room: [[50, 53, 57], [46, 50, 53], [41, 45, 48], [48, 52, 55]],
  finale: [[50, 54, 57], [43, 47, 50], [48, 52, 55], [50, 54, 57]],
  dawn: [[50, 54, 57], [43, 47, 50], [48, 52, 55], [50, 54, 57]]
};

const Sound = {
  ac: null, ready: false, muted: false,
  master: null, musicBus: null, sfxBus: null, verbSend: null,
  padBus: null, pads: [], padChords: [], padIndex: 0, padNext: 0,
  noiseBuf: null, act: null, cricket: false, nextCricket: 0,
  heart: false, nextHeart: 0, heartRate: 1.2,
  windGain: null, rainGain: null, roomGain: null, cityGain: null,
  mix: { rain: 0, wind: 0, room: 0, city: 0 },

  init() {
    if (this.ac) {
      if (this.ac.state === 'suspended') this.ac.resume().catch(() => {});
      return;
    }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      const ac = new AC();
      this.ac = ac;
      try { this.muted = localStorage.getItem('littlemoon.muted') === '1'; } catch (e) { this.muted = false; }

      const master = ac.createGain();
      master.gain.value = this.muted ? 0 : 0.62;
      const comp = ac.createDynamicsCompressor();
      comp.threshold.value = -18;
      comp.knee.value = 24;
      comp.ratio.value = 3;
      comp.attack.value = 0.004;
      comp.release.value = 0.25;
      master.connect(comp);
      comp.connect(ac.destination);
      this.master = master;

      const music = ac.createGain();
      music.gain.value = 0.72;
      music.connect(master);
      this.musicBus = music;

      const sfx = ac.createGain();
      sfx.gain.value = 0.72;
      sfx.connect(master);
      this.sfxBus = sfx;

      const conv = ac.createConvolver();
      conv.buffer = this.makeImpulse(3.1, 2.6);
      const wet = ac.createGain();
      wet.gain.value = 0.48;
      conv.connect(wet);
      wet.connect(master);
      const verbSend = ac.createGain();
      verbSend.gain.value = 1;
      verbSend.connect(conv);
      this.verbSend = verbSend;

      this.noiseBuf = this.makeNoise(2.5);
      this.buildAmbience();
      this.ready = true;
      if (this.act) this.setAct(this.act, true);
      this.applyMute();
      if (ac.state === 'suspended') ac.resume().catch(() => {});
    } catch (e) {
      console.warn('Little Moon: audio could not start', e);
    }
  },

  resume() {
    if (this.ac && this.ac.state === 'suspended') this.ac.resume().catch(() => {});
  },

  makeNoise(seconds) {
    const ac = this.ac;
    const len = Math.floor(ac.sampleRate * seconds);
    const buf = ac.createBuffer(1, len, ac.sampleRate);
    const d = buf.getChannelData(0);
    let last = 0;
    for (let i = 0; i < len; i++) {
      const white = Math.random() * 2 - 1;
      last = last * 0.32 + white * 0.68;
      d[i] = last;
    }
    return buf;
  },

  makeImpulse(seconds, decay) {
    const ac = this.ac;
    const rate = ac.sampleRate;
    const len = Math.floor(rate * seconds);
    const buf = ac.createBuffer(2, len, rate);
    for (let ch = 0; ch < 2; ch++) {
      const d = buf.getChannelData(ch);
      for (let i = 0; i < len; i++) {
        const t = i / len;
        d[i] = (Math.random() * 2 - 1) * Math.pow(1 - t, decay) * (1 - Math.exp(-i / 120));
      }
    }
    return buf;
  },

  buildAmbience() {
    const ac = this.ac;
    const makeNoiseLoop = (filterType, freq, q, gainValue) => {
      const src = ac.createBufferSource();
      src.buffer = this.noiseBuf;
      src.loop = true;
      const f = ac.createBiquadFilter();
      f.type = filterType;
      f.frequency.value = freq;
      f.Q.value = q;
      const g = ac.createGain();
      g.gain.value = gainValue;
      src.connect(f);
      f.connect(g);
      g.connect(this.musicBus);
      src.start();
      return g;
    };
    this.windGain = makeNoiseLoop('bandpass', 340, 0.65, 0);
    this.rainGain = makeNoiseLoop('highpass', 1100, 0.4, 0);
    const rainLow = ac.createBiquadFilter();
    rainLow.type = 'lowpass';
    rainLow.frequency.value = 7000;
    this.rainGain.disconnect();
    this.rainGain.connect(rainLow);
    rainLow.connect(this.musicBus);
    this.roomGain = makeNoiseLoop('lowpass', 240, 0.5, 0);
    this.cityGain = makeNoiseLoop('bandpass', 160, 0.9, 0);
  },

  applyMute() {
    if (!this.ready) return;
    const t = this.ac.currentTime;
    this.master.gain.cancelScheduledValues(t);
    this.master.gain.setTargetAtTime(this.muted ? 0 : 0.62, t, 0.08);
  },

  toggleMute() {
    this.muted = !this.muted;
    try { localStorage.setItem('littlemoon.muted', this.muted ? '1' : '0'); } catch (e) {}
    this.applyMute();
  },

  setMusicGain(v) {
    if (!this.ready) return;
    this.musicBus.gain.setTargetAtTime(v, this.ac.currentTime, 0.2);
  },

  setMixValue(key, value) {
    if (!this.ready) return;
    if (Math.abs((this.mix[key] || 0) - value) < 0.005) return;
    this.mix[key] = value;
    const t = this.ac.currentTime;
    const nodes = { wind: this.windGain, rain: this.rainGain, room: this.roomGain, city: this.cityGain };
    const n = nodes[key];
    if (n) n.gain.setTargetAtTime(Math.max(0, value), t, 0.6);
  },

  setRain(v) { this.setMixValue('rain', v); this.setMixValue('wind', v * 0.55); },
  setWind(v) { this.setMixValue('wind', v); },
  setRoom(v) { this.setMixValue('room', v); },
  setCity(v) { this.setMixValue('city', v); },

  setAct(name, force) {
    if (this.act === name && !force) return;
    this.act = name;
    if (!this.ready) return;
    this.startPads(PAD_CHORDS[name] || PAD_CHORDS.meadow);
    this.cricket = name === 'meadow' || (name === 'room');
    this.nextCricket = this.ac.currentTime + rand(2.5, 1);
    this.heart = false;
    const amb = { meadow: { rain: 0, room: 0.05, city: 0 }, storm: { rain: 0.32, room: 0, city: 0 }, town: { rain: 0.06, room: 0, city: 0.08 }, room: { rain: 0, room: 0.1, city: 0 }, finale: {}, credits: {} }[name];
    if (amb) {
      this.setMixValue('rain', amb.rain || 0);
      this.setMixValue('wind', name === 'meadow' ? 0.1 : name === 'storm' ? 0.3 : 0.04);
      this.setMixValue('room', amb.room || 0);
      this.setMixValue('city', amb.city || 0);
    }
  },

  startPads(chords) {
    const ac = this.ac;
    const oldBus = this.padBus;
    if (oldBus) {
      const ot = ac.currentTime;
      oldBus.gain.cancelScheduledValues(ot);
      oldBus.gain.setTargetAtTime(0.0001, ot, 0.9);
      const oldPads = this.pads;
      setTimeout(() => { oldPads.forEach(p => { try { p.osc.stop(); } catch (e) {} }); }, 4200);
    }
    const bus = ac.createGain();
    bus.gain.value = 0.0001;
    bus.connect(this.musicBus);
    const send = ac.createGain();
    send.gain.value = 0.55;
    bus.connect(send);
    send.connect(this.verbSend);
    const filter = ac.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = this.act === 'storm' ? 620 : 980;
    filter.Q.value = 0.4;
    filter.connect(bus);
    const lfo = ac.createOscillator();
    lfo.frequency.value = 0.06;
    const lfoGain = ac.createGain();
    lfoGain.gain.value = filter.frequency.value * 0.22;
    lfo.connect(lfoGain);
    lfoGain.connect(filter.frequency);
    lfo.start();
    const pads = [];
    const chord = chords[0];
    chord.forEach((note, i) => {
      for (const det of [-5, 6]) {
        const osc = ac.createOscillator();
        osc.type = 'triangle';
        osc.frequency.value = midiFreq(note);
        osc.detune.value = det;
        const g = ac.createGain();
        g.gain.value = 0.016;
        osc.connect(g);
        g.connect(filter);
        osc.start();
        pads.push({ osc, note });
      }
      const sub = ac.createOscillator();
      sub.type = 'sine';
      sub.frequency.value = midiFreq(note - 12);
      const sg = ac.createGain();
      sg.gain.value = 0.015;
      sub.connect(sg);
      sg.connect(filter);
      sub.start();
      pads.push({ osc: sub, note: note - 12 });
    });
    this.padBus = bus;
    this.pads = pads;
    this.padChords = chords;
    this.padIndex = 0;
    this.padNext = ac.currentTime + 9.6;
    bus.gain.setTargetAtTime(0.95, ac.currentTime, 1.4);
  },

  updatePads() {
    if (!this.padBus) return;
    const t = this.ac.currentTime;
    if (t >= this.padNext) {
      this.padIndex = (this.padIndex + 1) % this.padChords.length;
      const chord = this.padChords[this.padIndex];
      const notes = [];
      chord.forEach(n => { notes.push(n, n - 12); });
      let idx = 0;
      for (const p of this.pads) {
        const target = midiFreq(notes[idx % notes.length]);
        p.osc.frequency.cancelScheduledValues(t);
        p.osc.frequency.setTargetAtTime(target, t, 1.8);
        idx++;
      }
      this.padNext = t + 9.6;
    }
  },

  tone(freq, t, dur, opts = {}) {
    if (!this.ready) return;
    const ac = this.ac;
    const type = opts.type || 'sine';
    const gainValue = opts.gain != null ? opts.gain : 0.06;
    const attack = opts.attack != null ? opts.attack : 0.01;
    const release = opts.release != null ? opts.release : dur * 0.8;
    const osc = ac.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    if (opts.slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(20, opts.slideTo), t + dur);
    if (opts.detune) osc.detune.value = opts.detune;
    const g = ac.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(gainValue, t + attack);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0001, gainValue * 0.22), t + attack + release);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    let node = osc;
    if (opts.filter) {
      const f = ac.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.value = opts.filter;
      node.connect(f);
      node = f;
    }
    node.connect(g);
    let out = g;
    if (ac.createStereoPanner) {
      const p = ac.createStereoPanner();
      p.pan.value = clamp(opts.pan || 0, -1, 1);
      g.connect(p);
      out = p;
    }
    out.connect(opts.bus || this.sfxBus);
    if (opts.wet) {
      const s = ac.createGain();
      s.gain.value = opts.wet;
      out.connect(s);
      s.connect(this.verbSend);
    }
    osc.start(t);
    osc.stop(t + dur + 0.05);
  },

  noise(t, dur, opts = {}) {
    if (!this.ready) return;
    const ac = this.ac;
    const src = ac.createBufferSource();
    src.buffer = this.noiseBuf;
    const f = ac.createBiquadFilter();
    f.type = opts.type || 'bandpass';
    f.frequency.setValueAtTime(opts.freq || 1200, t);
    if (opts.slideTo) f.frequency.exponentialRampToValueAtTime(Math.max(30, opts.slideTo), t + dur);
    f.Q.value = opts.q != null ? opts.q : 0.8;
    const g = ac.createGain();
    const gainValue = opts.gain != null ? opts.gain : 0.05;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(gainValue, t + (opts.attack || 0.008));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f);
    f.connect(g);
    let out = g;
    if (ac.createStereoPanner) {
      const p = ac.createStereoPanner();
      p.pan.value = clamp(opts.pan || 0, -1, 1);
      g.connect(p);
      out = p;
    }
    out.connect(opts.bus || this.sfxBus);
    if (opts.wet) {
      const s = ac.createGain();
      s.gain.value = opts.wet;
      out.connect(s);
      s.connect(this.verbSend);
    }
    src.start(t, Math.random() * 1.5);
    src.stop(t + dur + 0.05);
  },

  bell(freq, t, opts = {}) {
    const gain = opts.gain != null ? opts.gain : 0.052;
    this.tone(freq, t, opts.dur || 1.5, { type: 'sine', gain, attack: 0.006, release: (opts.dur || 1.5) * 0.7, wet: opts.wet != null ? opts.wet : 0.5, pan: opts.pan });
    this.tone(freq * 2.004, t, (opts.dur || 1.5) * 0.55, { type: 'sine', gain: gain * 0.28, attack: 0.004, release: 0.6, wet: 0.4, pan: opts.pan });
    this.tone(freq * 3.01, t, (opts.dur || 1.5) * 0.25, { type: 'sine', gain: gain * 0.12, attack: 0.002, release: 0.3, pan: opts.pan });
  },

  pluck(note, t, opts = {}) {
    const freq = midiFreq(note + (opts.transpose || 0));
    const gain = (opts.gain != null ? opts.gain : 0.045);
    const dur = opts.dur || 1.8;
    this.tone(freq, t, dur, { type: 'triangle', gain, attack: 0.004, release: dur * 0.55, filter: 3000, wet: 0.55, pan: opts.pan });
    this.tone(freq * 2, t, dur * 0.5, { type: 'sine', gain: gain * 0.3, attack: 0.002, release: 0.7, wet: 0.35, pan: opts.pan });
  },

  box(note, t, opts = {}) {
    const freq = midiFreq(note + (opts.transpose || 0));
    const gain = (opts.gain != null ? opts.gain : 0.047);
    this.tone(freq, t, 2.4, { type: 'sine', gain, attack: 0.002, release: 1.7, wet: 0.65, pan: opts.pan });
    this.tone(freq * 2.002, t, 1.1, { type: 'sine', gain: gain * 0.24, attack: 0.001, release: 0.8, wet: 0.5, pan: opts.pan });
    this.tone(freq * 5.01, t, 0.35, { type: 'sine', gain: gain * 0.09, attack: 0.001, release: 0.25, wet: 0.4, pan: opts.pan });
  },

  playTheme(opts = {}) {
    if (!this.ready) return 0;
    const t0 = this.ac.currentTime + (opts.delay || 0.05);
    const beat = opts.beat || 0.6;
    const inst = opts.instrument || 'pluck';
    const gain = opts.gain != null ? opts.gain : 1;
    const panSpread = opts.pan != null ? opts.pan : -0.15;
    const majorMap = { 70: 71, 72: 73, 77: 78 };
    THEME.forEach((entry, i) => {
      const [b, rawNote, len] = entry;
      const note = opts.major && majorMap[rawNote] ? majorMap[rawNote] : rawNote;
      const t = t0 + b * beat;
      const pan = panSpread + (i % 3) * 0.12;
      if (inst === 'box') this.box(note + (opts.octave || 0) * 12, t, { gain: 0.035 * gain, pan });
      else if (inst === 'glass') this.tone(midiFreq(note + 12), t, 2.6, { type: 'sine', gain: 0.02 * gain, attack: 0.2, release: 1.8, wet: 0.8, pan });
      else this.pluck(note + (opts.octave || 0) * 12, t, { gain: 0.034 * gain, pan });
      const harmonyNote = note - 5;
      if (opts.harmony) this.pluck(harmonyNote + (opts.octave || 0) * 12, t + 0.015, { gain: 0.013 * gain, pan: -pan });
    });
    return THEME[THEME.length - 1][0] * beat;
  },

  sfx(name, opts = {}) {
    if (!this.ready) return;
    const ac = this.ac;
    const t = ac.currentTime + 0.008;
    const pan = opts.pan || 0;
    switch (name) {
      case 'flap':
        this.noise(t, 0.06, { freq: 1000 + rand(500), q: 1.3, gain: 0.018, pan, wet: 0.12 });
        break;
      case 'dew':
        this.bell(1318.5, t, { gain: 0.032, dur: 1.2, pan });
        this.bell(1975.5, t + 0.07, { gain: 0.02, dur: 1.1, pan });
        break;
      case 'web':
        this.tone(120, t, 0.35, { type: 'triangle', gain: 0.04, slideTo: 80, wet: 0.2, pan });
        this.noise(t, 0.15, { freq: 800, gain: 0.012, pan });
        break;
      case 'hurt':
        this.tone(140, t, 0.5, { type: 'sine', gain: 0.14, slideTo: 52, wet: 0.2 });
        this.noise(t, 0.3, { type: 'lowpass', freq: 700, gain: 0.06, pan });
        break;
      case 'thunder':
        this.noise(t, 2.8, { type: 'lowpass', freq: 280, q: 0.6, gain: 0.22, attack: 0.05, wet: 0.5 });
        this.tone(46, t, 2.4, { type: 'sine', gain: 0.11, attack: 0.03, release: 1.8, wet: 0.3 });
        break;
      case 'bolt':
        this.noise(t, 0.5, { type: 'highpass', freq: 900, gain: 0.16, attack: 0.002, wet: 0.4 });
        this.tone(90, t, 0.7, { type: 'sine', gain: 0.13, slideTo: 32, wet: 0.3 });
        break;
      case 'zap':
        this.noise(t, 0.22, { freq: 2800, q: 2.2, gain: 0.12, wet: 0.3 });
        this.tone(58, t, 0.32, { type: 'square', gain: 0.05, wet: 0.2 });
        this.tone(1760, t, 0.18, { type: 'sawtooth', gain: 0.015, wet: 0.2 });
        break;
      case 'dazzle':
        this.tone(220, t, 1.4, { type: 'sine', gain: 0.035, slideTo: 660, wet: 0.5, pan });
        this.tone(330, t + 0.1, 1.2, { type: 'triangle', gain: 0.02, slideTo: 880, wet: 0.5, pan });
        break;
      case 'warm':
        this.bell(587.3, t, { gain: 0.03, dur: 2.2, pan });
        this.bell(880, t + 0.16, { gain: 0.024, dur: 2.4, pan });
        this.bell(1174.7, t + 0.32, { gain: 0.02, dur: 2.8, pan });
        break;
      case 'memory':
        this.bell(midiFreq(62), t, { gain: 0.033, dur: 3, pan: -0.2 });
        this.bell(midiFreq(69), t + 0.22, { gain: 0.028, dur: 3, pan: 0.2 });
        this.bell(midiFreq(74), t + 0.44, { gain: 0.024, dur: 3.4, pan: 0 });
        this.noise(t, 0.8, { type: 'highpass', freq: 3000, gain: 0.008, wet: 0.8 });
        break;
      case 'door':
        this.noise(t, 0.4, { type: 'lowpass', freq: 500, gain: 0.05 });
        this.tone(82, t, 0.45, { type: 'triangle', gain: 0.05, slideTo: 62, wet: 0.3 });
        break;
      case 'box':
        this.bell(midiFreq(74), t, { gain: 0.03, dur: 2.5, pan: 0 });
        this.bell(midiFreq(81), t + 0.35, { gain: 0.02, dur: 2.5, pan: 0.1 });
        break;
      case 'dawn':
        [50, 54, 57, 62, 66, 69].forEach((n, i) => this.tone(midiFreq(n), t + i * 0.09, 6, { type: 'sine', gain: 0.025, attack: 1.3, release: 4, wet: 0.7, pan: (i / 5 - 0.5) * 0.8 }));
        break;
      case 'ui':
        this.tone(720, t, 0.12, { type: 'sine', gain: 0.02, attack: 0.002, wet: 0.3 });
        break;
      case 'begin':
        this.bell(392, t, { gain: 0.03, dur: 2.4 });
        this.bell(587.3, t + 0.18, { gain: 0.024, dur: 3 });
        this.bell(783.99, t + 0.38, { gain: 0.018, dur: 3.4 });
        break;
      case 'respawn':
        this.tone(220, t, 0.6, { type: 'sine', gain: 0.03, slideTo: 440, wet: 0.5 });
        break;
      case 'spark':
        this.tone(1800 + rand(700), t, 0.08, { type: 'sine', gain: 0.012, wet: 0.2, pan });
        break;
      case 'charge':
        this.tone(130, t, 1.05, { type: 'sawtooth', gain: 0.018, attack: 0.1, slideTo: 560, wet: 0.55, pan });
        this.noise(t, 1.0, { type: 'bandpass', freq: 600, slideTo: 2400, q: 1.4, gain: 0.012, wet: 0.5, pan });
        break;
      case 'shelter':
        this.bell(392, t, { gain: 0.022, dur: 2.4, pan });
        this.bell(587.33, t + 0.14, { gain: 0.016, dur: 2.6, pan });
        break;
    }
  },

  setHeart(active, rate) {
    this.heart = active;
    if (rate) this.heartRate = rate;
  },

  update(dt) {
    if (!this.ready) return;
    this.updatePads();
    const t = this.ac.currentTime;
    if (this.cricket && t > this.nextCricket) {
      const p = rand(0.6, -0.6);
      for (let i = 0; i < 3; i++) {
        this.tone(3400 + rand(500), t + i * 0.055, 0.045, { type: 'sine', gain: 0.0065, attack: 0.005, wet: 0.4, pan: p });
      }
      this.nextCricket = t + rand(2.6, 1.1);
    }
    if (this.heart && t > this.nextHeart) {
      this.tone(62, t, 0.18, { type: 'sine', gain: 0.055, attack: 0.01, wet: 0.15 });
      this.tone(55, t + 0.22, 0.2, { type: 'sine', gain: 0.035, attack: 0.01, wet: 0.15 });
      this.nextHeart = t + this.heartRate;
    }
  },

  status() {
    return { ready: this.ready, state: this.ac ? this.ac.state : 'none', act: this.act, muted: this.muted };
  }
};

const Glow = (() => {
  const cache = new Map();
  function sprite(color) {
    let s = cache.get(color);
    if (s) return s;
    const [r, g, b] = hexRgb(color);
    const c = makeCanvas(256, 256);
    const x = c.getContext('2d');
    const grad = x.createRadialGradient(128, 128, 0, 128, 128, 128);
    grad.addColorStop(0, `rgba(${r},${g},${b},1)`);
    grad.addColorStop(0.12, `rgba(${r},${g},${b},0.72)`);
    grad.addColorStop(0.32, `rgba(${r},${g},${b},0.28)`);
    grad.addColorStop(0.62, `rgba(${r},${g},${b},0.07)`);
    grad.addColorStop(1, `rgba(${r},${g},${b},0)`);
    x.fillStyle = grad;
    x.fillRect(0, 0, 256, 256);
    cache.set(color, c);
    return c;
  }
  return {
    sprite,
    draw(ctx, x, y, radius, color, alpha = 1, composite = 'lighter') {
      if (alpha <= 0.002) return;
      ctx.save();
      ctx.globalCompositeOperation = composite;
      ctx.globalAlpha = alpha;
      ctx.drawImage(sprite(color), x - radius, y - radius, radius * 2, radius * 2);
      ctx.restore();
    }
  };
})();

const Grain = (() => {
  let tile = null, pat = null;
  function make() {
    const c = makeCanvas(192, 192);
    const x = c.getContext('2d');
    const img = x.createImageData(192, 192);
    for (let i = 0; i < img.data.length; i += 4) {
      const v = Math.random() * 255;
      img.data[i] = v;
      img.data[i + 1] = v;
      img.data[i + 2] = v;
      img.data[i + 3] = Math.random() < 0.55 ? Math.floor(Math.random() * 14) : 0;
    }
    x.putImageData(img, 0, 0);
    return c;
  }
  return {
    draw(ctx, time, alpha = 0.5) {
      if (!tile) { tile = make(); pat = ctx.createPattern(tile, 'repeat'); }
      if (!pat) return;
      const seed = Math.floor(time * 10);
      const ox = (seed * 73) % 192, oy = (seed * 151) % 192;
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.translate(-ox, -oy);
      ctx.fillStyle = pat;
      ctx.fillRect(0, 0, VW + 192, VH + 192);
      ctx.restore();
    }
  };
})();

const Vignette = (() => {
  let grad = null;
  return {
    draw(ctx, strength = 0.55) {
      if (!grad) {
        grad = ctx.createRadialGradient(VW / 2, VH / 2, VH * 0.28, VW / 2, VH / 2, VH * 0.92);
        grad.addColorStop(0, 'rgba(0,0,0,0)');
        grad.addColorStop(0.62, 'rgba(0,0,0,0.18)');
        grad.addColorStop(1, 'rgba(0,0,0,0.82)');
      }
      ctx.save();
      ctx.globalAlpha = strength;
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, VW, VH);
      ctx.restore();
    }
  };
})();

function roundRect(ctx, x, y, w, h, r) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

function setFont(size, family = SERIF, weight = '400', italic = false) {
  ctx.font = `${italic ? 'italic ' : ''}${weight} ${size}px ${family}`;
}

function drawSpaced(text, x, y, opts = {}) {
  const size = opts.size || 16;
  const family = opts.family || SANS;
  const weight = opts.weight || '500';
  const spacing = opts.spacing != null ? opts.spacing : 3;
  const align = opts.align || 'left';
  const alpha = opts.alpha != null ? opts.alpha : 1;
  const color = opts.color || '#eae0ca';
  setFont(size, family, weight);
  const chars = [...text];
  const widths = chars.map(c => ctx.measureText(c).width);
  const total = widths.reduce((a, b) => a + b, 0) + spacing * Math.max(0, chars.length - 1);
  let cx = align === 'center' ? x - total / 2 : align === 'right' ? x - total : x;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = color;
  if (opts.glow) {
    ctx.shadowColor = opts.glow;
    ctx.shadowBlur = opts.glowRadius || 18;
  }
  for (let i = 0; i < chars.length; i++) {
    ctx.fillText(chars[i], cx, y);
    cx += widths[i] + spacing;
  }
  ctx.restore();
  return total;
}

function drawText(text, x, y, opts = {}) {
  const size = opts.size || 24;
  const family = opts.family || SERIF;
  const weight = opts.weight || '400';
  const italic = !!opts.italic;
  const align = opts.align || 'left';
  const alpha = opts.alpha != null ? opts.alpha : 1;
  setFont(size, family, weight, italic);
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.textAlign = align;
  ctx.textBaseline = opts.baseline || 'alphabetic';
  ctx.fillStyle = opts.color || '#efe7d6';
  if (opts.glow) {
    ctx.shadowColor = opts.glow;
    ctx.shadowBlur = opts.glowRadius || 16;
  }
  if (opts.letterSpacing) {
    ctx.restore();
    drawSpaced(text, x, y, { size, family, weight, spacing: opts.letterSpacing, align, alpha, color: opts.color, glow: opts.glow, glowRadius: opts.glowRadius });
    return;
  }
  ctx.fillText(text, x, y);
  ctx.restore();
  return ctx.measureText(text).width;
}

function wrapLines(text, maxWidth, font) {
  ctx.save();
  if (font) ctx.font = font;
  const paragraphs = String(text).split('\n');
  const lines = [];
  for (const para of paragraphs) {
    if (!para) { lines.push(''); continue; }
    const words = para.split(/\s+/);
    let line = '';
    for (const word of words) {
      const test = line ? line + ' ' + word : word;
      if (ctx.measureText(test).width > maxWidth && line) {
        lines.push(line);
        line = word;
      } else {
        line = test;
      }
    }
    if (line) lines.push(line);
  }
  ctx.restore();
  return lines;
}

function fillCircle(ctx, x, y, r) {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, TAU);
  ctx.fill();
}

class Particles {
  constructor(max = 1100) {
    this.items = [];
    this.max = max;
  }
  add(o) {
    if (this.items.length >= this.max) return null;
    const p = Object.assign({
      x: 0, y: 0, vx: 0, vy: 0, g: 0, drag: 0, life: 1, size: 2,
      color: '#ffd38a', type: 'dot', alpha: 1, rotate: 0, vr: 0,
      twinkle: 0, glow: 1, shrink: 1, swirl: 0, seed: Math.random() * TAU
    }, o);
    p.maxLife = p.life;
    p.age = 0;
    this.items.push(p);
    return p;
  }
  burst(x, y, opts = {}) {
    const count = opts.count || 12;
    for (let i = 0; i < count; i++) {
      const a = opts.angle != null ? opts.angle + rand(0, opts.spread || TAU) - (opts.spread || 0) / 2 : rand(TAU);
      const sp = rand(opts.speed || 90, (opts.speed || 90) * 0.15);
      this.add({
        x: x + rand(opts.jitter || 4, -(opts.jitter || 4)),
        y: y + rand(opts.jitter || 4, -(opts.jitter || 4)),
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp,
        life: rand(opts.life || 0.9, (opts.life || 0.9) * 0.4),
        size: rand(opts.size || 2.4, 0.7),
        color: Array.isArray(opts.color) ? pick(opts.color) : (opts.color || '#ffd38a'),
        type: opts.type || 'dot',
        g: opts.g || 0,
        drag: opts.drag || 1.2,
        alpha: opts.alpha != null ? opts.alpha : 0.9,
        twinkle: opts.twinkle || 0,
        shrink: opts.shrink || -0.4,
        rotate: rand(TAU),
        vr: rand(2.5, -2.5)
      });
    }
  }
  update(dt) {
    const arr = this.items;
    for (let i = arr.length - 1; i >= 0; i--) {
      const p = arr[i];
      p.age += dt;
      if (p.age >= p.maxLife) {
        arr[i] = arr[arr.length - 1];
        arr.pop();
        continue;
      }
      p.vy += p.g * dt;
      const d = Math.exp(-p.drag * dt);
      p.vx *= d;
      p.vy *= d;
      if (p.swirl) {
        p.vx += Math.cos(p.age * 3.1 + p.seed) * p.swirl * dt;
        p.vy += Math.sin(p.age * 2.4 + p.seed) * p.swirl * dt;
      }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.rotate += p.vr * dt;
    }
  }
  draw(ctx) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const p of this.items) {
      let k = p.age / p.maxLife;
      let a = p.alpha * (k < 0.12 ? k / 0.12 : k > 0.72 ? (1 - k) / 0.28 : 1);
      if (a <= 0.003) continue;
      if (p.twinkle) a *= 0.65 + 0.35 * Math.sin(p.age * 26 + p.seed);
      const size = p.size * (1 + p.shrink * k);
      if (p.type === 'dot') {
        Glow.draw(ctx, p.x, p.y, size * 4.2, p.color, a * 0.5 * p.glow);
        ctx.globalAlpha = a;
        ctx.fillStyle = p.color;
        fillCircle(ctx, p.x, p.y, Math.max(0.4, size * 0.62));
      } else if (p.type === 'spark') {
        ctx.globalAlpha = a;
        ctx.strokeStyle = p.color;
        ctx.lineWidth = Math.max(0.6, size * 0.5);
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(p.x - p.vx * 0.035, p.y - p.vy * 0.035);
        ctx.stroke();
        Glow.draw(ctx, p.x, p.y, size * 6, p.color, a * 0.3);
      } else if (p.type === 'line') {
        ctx.globalAlpha = a;
        ctx.strokeStyle = p.color;
        ctx.lineWidth = Math.max(0.5, size * 0.35);
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(p.x - p.vx * 0.05, p.y - p.vy * 0.05);
        ctx.stroke();
      } else if (p.type === 'ring') {
        const e = easeOutCubic(k);
        const r = lerp(p.size, p.size * 4.2, e);
        ctx.globalAlpha = a * 0.8;
        ctx.strokeStyle = p.color;
        ctx.lineWidth = Math.max(0.5, 2.5 * (1 - k));
        ctx.beginPath();
        ctx.arc(p.x, p.y, r, 0, TAU);
        ctx.stroke();
      } else if (p.type === 'leaf') {
        ctx.globalAlpha = a;
        ctx.fillStyle = p.color;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rotate);
        ctx.beginPath();
        ctx.ellipse(0, 0, size * 2.4, size * 0.85, 0, 0, TAU);
        ctx.fill();
        ctx.restore();
      } else if (p.type === 'star') {
        ctx.globalAlpha = a;
        ctx.strokeStyle = p.color;
        ctx.lineWidth = 0.8;
        const r = size * 3.2;
        ctx.beginPath();
        ctx.moveTo(p.x - r, p.y);
        ctx.lineTo(p.x + r, p.y);
        ctx.moveTo(p.x, p.y - r);
        ctx.lineTo(p.x, p.y + r);
        ctx.stroke();
        ctx.fillStyle = '#fff6df';
        fillCircle(ctx, p.x, p.y, Math.max(0.5, size * 0.4));
      }
    }
    ctx.restore();
  }
  clear() { this.items.length = 0; }
}

class Camera {
  constructor(worldW = VW, worldH = VH) {
    this.worldW = worldW;
    this.worldH = worldH;
    this.cx = VW / 2;
    this.cy = VH / 2;
    this.zoom = 1;
    this.trauma = 0;
    this.sx = 0;
    this.sy = 0;
    this.lookX = 0;
    this.lookY = 0;
  }
  setWorld(w, h) {
    this.worldW = w;
    this.worldH = h;
    this.clampToWorld();
  }
  clampToWorld() {
    const hw = VW / (2 * this.zoom);
    const hh = VH / (2 * this.zoom);
    this.cx = this.worldW <= hw * 2 ? this.worldW / 2 : clamp(this.cx, hw, this.worldW - hw);
    this.cy = this.worldH <= hh * 2 ? this.worldH / 2 : clamp(this.cy, hh, this.worldH - hh);
  }
  snap(x, y) {
    this.cx = x;
    this.cy = y;
    this.clampToWorld();
  }
  follow(x, y, dt, opts = {}) {
    const lookX = opts.lookX != null ? opts.lookX : this.lookX;
    const lookY = opts.lookY != null ? opts.lookY : this.lookY;
    const smooth = opts.smooth != null ? opts.smooth : 3.2;
    const tx = x + lookX;
    const ty = y + lookY;
    this.cx = damp(this.cx, tx, smooth, dt);
    this.cy = damp(this.cy, ty, smooth * 0.9, dt);
    if (opts.zoom != null) this.zoom = damp(this.zoom, opts.zoom, 2.2, dt);
    this.clampToWorld();
  }
  shake(n) {
    this.trauma = clamp(this.trauma + n, 0, 1);
  }
  update(dt, time) {
    this.trauma = Math.max(0, this.trauma - dt * 1.3);
    const s = this.trauma * this.trauma * 24;
    this.sx = (Math.sin(time * 91.3) * 0.6 + Math.sin(time * 57.7) * 0.4) * s;
    this.sy = (Math.cos(time * 83.1) * 0.6 + Math.cos(time * 61.3) * 0.4) * s;
  }
  apply(ctx) {
    ctx.translate(VW / 2 + this.sx, VH / 2 + this.sy);
    ctx.scale(this.zoom, this.zoom);
    ctx.translate(-this.cx, -this.cy);
  }
  get left() { return this.cx - VW / (2 * this.zoom); }
  get right() { return this.cx + VW / (2 * this.zoom); }
  get top() { return this.cy - VH / (2 * this.zoom); }
  get bottom() { return this.cy + VH / (2 * this.zoom); }
}

class Moth {
  constructor() {
    this.x = 0;
    this.y = 0;
    this.vx = 0;
    this.vy = 0;
    this.facing = 1;
    this.bank = 0;
    this.flapTimer = 0;
    this.flapPhase = rand(TAU);
    this.glow = 1;
    this.radius = 13;
    this.trailT = 0;
    this.visible = true;
    this.frozen = false;
    this.speedCap = 470;
  }
  reset(x, y) {
    this.x = x;
    this.y = y;
    this.vx = 0;
    this.vy = 0;
    this.bank = 0;
    this.facing = 1;
    this.trailT = 0;
  }
  update(dt, particles, env = {}) {
    if (this.frozen) return;
    const axInput = (Input.right() ? 1 : 0) - (Input.left() ? 1 : 0);
    const ayInput = (Input.downKey() ? 1 : 0) - (Input.up() ? 1 : 0);
    const accelX = env.accelX != null ? env.accelX : 1150;
    const accelY = env.accelY != null ? env.accelY : 760;
    this.vx += (axInput * accelX + (env.windX || 0) + (env.forceX || 0)) * dt;
    this.vy += (ayInput * accelY + (env.gravity != null ? env.gravity : 150) + (env.windY || 0) + (env.forceY || 0)) * dt;

    this.flapTimer -= dt;
    const flapping = Input.flap() && !env.noFlap;
    if (flapping && this.flapTimer <= 0) {
      this.flapTimer = env.flapInterval || 0.19;
      this.vy -= env.flapPower || 176;
      this.vx += this.facing * 12;
      if (env.flapSound !== false) Sound.sfx('flap', { pan: (this.x - (env.camX || this.x)) / 900 });
      if (particles && env.flapDust !== false) {
        for (let i = 0; i < 2; i++) {
          particles.add({
            x: this.x + rand(8, -8), y: this.y + rand(6, -2),
            vx: rand(16, -16) - this.vx * 0.05, vy: rand(28, 4),
            life: rand(0.9, 0.4), size: rand(1.6, 0.6), color: '#ffd9a0',
            type: 'dot', drag: 1.8, alpha: 0.4, shrink: -0.6
          });
        }
      }
    }
    this.flapPhase += dt * (flapping ? 22 : 7);

    const d = Math.exp(-(env.drag != null ? env.drag : 2.1) * dt);
    this.vx *= d;
    this.vy *= d;
    const speed = Math.hypot(this.vx, this.vy);
    if (speed > this.speedCap) {
      this.vx = this.vx / speed * this.speedCap;
      this.vy = this.vy / speed * this.speedCap;
    }
    this.x += (this.vx + (env.driftX || 0)) * dt;
    this.y += (this.vy + (env.driftY || 0)) * dt;

    const bankTarget = clamp(this.vx * 0.00055, -0.34, 0.34) + clamp(ayInput * 0.06, -0.06, 0.06);
    this.bank = damp(this.bank, bankTarget, 6, dt);
    if (Math.abs(this.vx) > 25) this.facing = this.vx >= 0 ? 1 : -1;

    this.trailT -= dt;
    if (particles && this.trailT <= 0 && speed > 25) {
      this.trailT = 0.065;
      particles.add({
        x: this.x - this.vx * 0.02 + rand(5, -5),
        y: this.y - this.vy * 0.02 + rand(5, -5),
        vx: rand(10, -10), vy: rand(16, -4),
        life: rand(1.5, 0.5), size: rand(1.5, 0.45),
        color: Math.random() < 0.3 ? '#fff3d0' : '#ffc96e',
        type: 'dot', drag: 1.1, alpha: rand(0.55, 0.18), shrink: -0.7
      });
    }
  }
  draw(ctx, time, opts = {}) {
    if (!this.visible) return;
    const glow = opts.glow != null ? opts.glow : this.glow;
    const flicker = 0.92 + Math.sin(time * 11.3) * 0.045 + Math.sin(time * 5.7) * 0.035;
    const g = Math.max(0, glow);
    Glow.draw(ctx, this.x, this.y + 6, 190 * (0.55 + g * 0.45) * flicker, '#ff9b3d', 0.13 * g);
    Glow.draw(ctx, this.x, this.y, 108 * (0.5 + g * 0.5) * flicker, '#ffc46b', 0.36 * g);
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.bank);
    const open = 0.28 + 0.72 * (0.5 + 0.5 * Math.sin(this.flapPhase));
    this.drawWing(ctx, -1, open, time);
    this.drawWing(ctx, 1, open, time);
    ctx.save();
    ctx.rotate(-this.bank * 0.3);
    const bodyGrad = ctx.createLinearGradient(0, -22, 0, 16);
    bodyGrad.addColorStop(0, '#fff6dd');
    bodyGrad.addColorStop(0.45, '#f6dcae');
    bodyGrad.addColorStop(1, '#c79a5b');
    ctx.fillStyle = bodyGrad;
    ctx.beginPath();
    ctx.ellipse(0, 0, 5.4, 20, 0, 0, TAU);
    ctx.fill();
    ctx.globalAlpha = 0.55;
    ctx.fillStyle = '#fff0cf';
    fillCircle(ctx, 0, -16.5, 5.2);
    ctx.globalAlpha = 1;
    ctx.strokeStyle = 'rgba(255,236,198,0.7)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(-2, -20);
    ctx.bezierCurveTo(-7, -31, -15, -36, -21, -38);
    ctx.moveTo(2, -20);
    ctx.bezierCurveTo(7, -31, 15, -36, 21, -38);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(255,236,198,0.45)';
    ctx.lineWidth = 0.7;
    for (let i = 0; i < 5; i++) {
      const yy = -10 + i * 5.4;
      const a = 0.18 + (i % 2) * 0.08;
      ctx.globalAlpha = a;
      ctx.beginPath();
      ctx.ellipse(0, yy, 2.4 + i * 0.42, 0.9, 0, 0, TAU);
      ctx.fillStyle = '#fff3d6';
      ctx.fill();
    }
    ctx.restore();
    ctx.restore();
    if (g > 0.2) Glow.draw(ctx, this.x, this.y, 32, '#fff3d2', 0.42 * g);
  }
  drawWing(ctx, dir, open, time) {
    ctx.save();
    ctx.scale(dir, 1);
    ctx.translate(3, -1);
    ctx.rotate(-0.1 + 0.16 * Math.sin(this.flapPhase + (dir < 0 ? 0 : Math.PI)));
    ctx.scale(1, 0.42 + 0.58 * open);
    const grad = ctx.createLinearGradient(0, 0, 62, -8);
    grad.addColorStop(0, 'rgba(255,244,214,0.8)');
    grad.addColorStop(0.35, 'rgba(255,214,150,0.62)');
    grad.addColorStop(0.75, 'rgba(255,176,111,0.34)');
    grad.addColorStop(1, 'rgba(255,158,95,0.05)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(2, -4);
    ctx.bezierCurveTo(16, -25, 43, -34, 60, -21);
    ctx.bezierCurveTo(69, -14, 58, 1, 39, 8);
    ctx.bezierCurveTo(24, 13, 9, 9, 2, -4);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,239,204,0.28)';
    ctx.lineWidth = 0.9;
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(8, 6);
    ctx.bezierCurveTo(22, 15, 38, 15, 46, 7);
    ctx.bezierCurveTo(38, -1, 24, -2, 14, 3);
    ctx.fillStyle = 'rgba(255,207,142,0.26)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,241,210,0.23)';
    ctx.lineWidth = 0.55;
    for (let i = 0; i < 4; i++) {
      ctx.beginPath();
      ctx.moveTo(5, -2);
      ctx.bezierCurveTo(20, -10 - i * 3, 38, -16 - i * 3, 55 - i * 3, -17 + i * 5);
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.moveTo(6, 0);
    ctx.bezierCurveTo(18, 6, 32, 9, 43, 7);
    ctx.stroke();
    const shimmer = 0.12 + 0.08 * Math.sin(time * 2.1 + dir);
    ctx.fillStyle = `rgba(255,255,240,${shimmer})`;
    ctx.beginPath();
    ctx.ellipse(30, -12, 16, 6, -0.35, 0, TAU);
    ctx.fill();
    ctx.restore();
  }
}

const Captions = {
  items: [],
  add(text, opts = {}) {
    if (opts.style !== 'memory') this.items = this.items.filter(it => it.style === 'memory');
    this.items.push({
      text,
      speaker: opts.speaker || null,
      style: opts.style || 'narration',
      age: 0,
      dur: opts.dur != null ? opts.dur : 5,
      fadeIn: opts.fadeIn != null ? opts.fadeIn : 0.5,
      fadeOut: opts.fadeOut != null ? opts.fadeOut : 1.1,
      size: opts.size || 27,
      y: opts.y || 742
    });
    if (this.items.length > 2) this.items.splice(0, this.items.length - 2);
  },
  clear() { this.items.length = 0; },
  update(dt) {
    for (let i = this.items.length - 1; i >= 0; i--) {
      const it = this.items[i];
      it.age += dt;
      if (it.age >= it.dur) this.items.splice(i, 1);
    }
  },
  draw(ctx) {
    if (!this.items.length) return;
    let maxAlpha = 0;
    for (const it of this.items) {
      const a = it.age < it.fadeIn ? it.age / it.fadeIn : it.age > it.dur - it.fadeOut ? Math.max(0, (it.dur - it.age) / it.fadeOut) : 1;
      maxAlpha = Math.max(maxAlpha, a);
    }
    if (maxAlpha > 0.01) {
      const grad = ctx.createLinearGradient(0, VH - 300, 0, VH);
      grad.addColorStop(0, 'rgba(2,4,9,0)');
      grad.addColorStop(0.55, `rgba(2,4,9,${0.32 * maxAlpha})`);
      grad.addColorStop(1, `rgba(2,4,9,${0.62 * maxAlpha})`);
      ctx.fillStyle = grad;
      ctx.fillRect(0, VH - 300, VW, 300);
    }
    this.items.forEach((it, idx) => {
      const a = it.age < it.fadeIn ? it.age / it.fadeIn : it.age > it.dur - it.fadeOut ? Math.max(0, (it.dur - it.age) / it.fadeOut) : 1;
      if (a <= 0.002) return;
      const y = it.y - (this.items.length - 1 - idx) * 58;
      const color = it.style === 'memory' ? '#ffdca4' : it.style === 'june' ? '#f3e6d2' : '#efe7d7';
      ctx.save();
      ctx.globalAlpha = a;
      if (it.style === 'memory') {
        ctx.strokeStyle = 'rgba(255,198,122,0.35)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(VW / 2 - 30, y - 48);
        ctx.lineTo(VW / 2 + 30, y - 48);
        ctx.stroke();
      }
      if (it.speaker) {
        drawSpaced(it.speaker.toUpperCase(), VW / 2, y - 44, { size: 13, spacing: 4, align: 'center', color: 'rgba(255,205,145,0.75)', alpha: a });
      }
      setFont(it.size, SERIF, '400', it.style !== 'june');
      const lines = wrapLines(it.text, 980, ctx.font);
      const lineH = it.size * 1.42;
      const startY = y - (lines.length - 1) * lineH;
      ctx.textAlign = 'center';
      ctx.fillStyle = color;
      lines.forEach((line, i) => {
        ctx.globalAlpha = a;
        ctx.fillText(line, VW / 2, startY + i * lineH);
      });
      ctx.restore();
    });
  }
};

function drawMeter(ctx, x, y, w, label, value, color, opts = {}) {
  const v = clamp(value / (opts.max || 100), 0, 1);
  drawSpaced(label, x + w, y - 12, { size: 10, spacing: 3.4, align: 'right', color: 'rgba(235,226,208,0.62)', alpha: opts.alpha != null ? opts.alpha : 1 });
  ctx.save();
  ctx.globalAlpha = (opts.alpha != null ? opts.alpha : 1) * 0.9;
  ctx.fillStyle = 'rgba(8,12,20,0.55)';
  roundRect(ctx, x, y, w, 5, 3);
  ctx.fill();
  ctx.strokeStyle = 'rgba(235,226,208,0.12)';
  ctx.lineWidth = 1;
  roundRect(ctx, x + 0.5, y + 0.5, w - 1, 4, 2.5);
  ctx.stroke();
  if (v > 0.001) {
    const grad = ctx.createLinearGradient(x, 0, x + w, 0);
    grad.addColorStop(0, rgba(color, 0.55));
    grad.addColorStop(1, color);
    ctx.fillStyle = grad;
    roundRect(ctx, x, y, Math.max(3, w * v), 5, 3);
    ctx.fill();
    if (opts.warn) {
      const pulse = 0.5 + 0.5 * Math.sin(performance.now() * 0.008);
      Glow.draw(ctx, x + w * v, y + 2.5, 26, color, 0.25 * pulse);
    }
  }
  ctx.restore();
}

function drawControlsHint(ctx, alpha, extra) {
  if (alpha <= 0.005) return;
  ctx.save();
  ctx.globalAlpha = alpha;
  drawSpaced(extra || 'M  MUTE      ESC  PAUSE', VW - 84, VH - 30, { size: 9.5, spacing: 2.6, align: 'right', color: 'rgba(236,228,210,0.42)' });
  ctx.restore();
}

function drawKeyFrame(x, y, w, h, label) {
  ctx.save();
  ctx.fillStyle = 'rgba(232,222,203,0.055)';
  roundRect(ctx, x, y, w, h, 6);
  ctx.fill();
  ctx.strokeStyle = 'rgba(232,222,203,0.22)';
  ctx.lineWidth = 1;
  roundRect(ctx, x + 0.5, y + 0.5, w - 1, h - 1, 5.5);
  ctx.stroke();
  drawText(label, x + w / 2, y + h / 2 + 4, { size: 11, family: SANS, color: 'rgba(240,230,210,0.72)', align: 'center' });
  ctx.restore();
}

function drawTutorialKeys(alpha) {
  if (alpha <= 0.005) return;
  ctx.save();
  ctx.globalAlpha = alpha;
  const x = 56, y = 742;
  drawKeyFrame(x, y, 128, 30, '← ↑ ↓ →');
  drawText('fly', x + 143, y + 20, { size: 17, italic: true, color: 'rgba(238,228,208,0.55)' });
  drawKeyFrame(x, y + 42, 128, 30, 'SPACE');
  drawText('flutter', x + 143, y + 62, { size: 17, italic: true, color: 'rgba(238,228,208,0.55)' });
  ctx.restore();
}

function drawMuteBadge(ctx) {
  if (!Sound.muted) return;
  ctx.save();
  ctx.globalAlpha = 0.55;
  drawSpaced('MUTED', 42, 44, { size: 10, spacing: 3, color: 'rgba(236,228,210,0.8)' });
  ctx.strokeStyle = 'rgba(236,228,210,0.6)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(42, 54);
  ctx.lineTo(84, 54);
  ctx.stroke();
  ctx.restore();
}

function drawChapterCard(ctx, time, start, index, title, subtitle) {
  const t = time - start;
  if (t < 0 || t > 4.6) return;
  let a = 1;
  if (t < 0.7) a = t / 0.7;
  else if (t > 3.3) a = Math.max(0, (4.6 - t) / 1.3);
  a = easeInOutCubic(clamp(a, 0, 1));
  if (a <= 0.002) return;
  ctx.save();
  ctx.globalAlpha = a;
  const grad = ctx.createLinearGradient(0, 0, 0, VH);
  grad.addColorStop(0, 'rgba(3,5,10,0.05)');
  grad.addColorStop(0.5, 'rgba(3,5,10,0.16)');
  grad.addColorStop(1, 'rgba(3,5,10,0.05)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, VW, VH);
  drawSpaced('CHAPTER ' + index, VW / 2, 404, { size: 12, spacing: 6, align: 'center', color: 'rgba(255,201,137,0.8)' });
  setFont(56, SERIF, '400');
  ctx.textAlign = 'center';
  ctx.fillStyle = '#f2e9d6';
  ctx.fillText(title.toUpperCase(), VW / 2, 470);
  ctx.strokeStyle = 'rgba(255,206,145,0.26)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(VW / 2 - 46, 500);
  ctx.lineTo(VW / 2 + 46, 500);
  ctx.stroke();
  if (subtitle) drawText(subtitle, VW / 2, 540, { size: 19, italic: true, align: 'center', color: 'rgba(235,226,206,0.7)' });
  ctx.restore();
}

const fract = v => v - Math.floor(v);

const skyCache = new Map();
function drawSky(stops) {
  const key = stops.map(s => s[1]).join('_');
  let grad = skyCache.get(key);
  if (!grad) {
    grad = ctx.createLinearGradient(0, 0, 0, VH);
    for (const [at, color] of stops) grad.addColorStop(at, color);
    skyCache.set(key, grad);
  }
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, VW, VH);
}

class StarField {
  constructor(seed, count = 240, opts = {}) {
    const rng = mulberry32(seed);
    this.span = VW + 700;
    this.stars = [];
    for (let i = 0; i < count; i++) {
      this.stars.push({
        x: rng() * this.span,
        y: Math.pow(rng(), opts.bias || 1.35) * (opts.height || VH * 0.72),
        r: 0.45 + rng() * (opts.maxR || 1.7),
        phase: rng() * TAU,
        tw: 0.35 + rng() * 0.65,
        warm: rng() < (opts.warmRatio || 0.3),
        big: rng() < (opts.bigRatio || 0.035)
      });
    }
  }
  draw(camX, time, opts = {}) {
    const par = opts.parallax != null ? opts.parallax : 0.025;
    const alpha = opts.alpha != null ? opts.alpha : 1;
    if (alpha <= 0.01) return;
    const off = wrap(camX * par, this.span);
    for (const s of this.stars) {
      let x = s.x + off;
      if (x >= this.span) x -= this.span;
      if (x < -10 || x > VW + 10) continue;
      const tw = 0.62 + 0.38 * Math.sin(time * (0.6 + s.tw) + s.phase);
      const a = alpha * tw;
      const color = s.warm ? '#ffe3b6' : '#d5e4ff';
      if (s.big) {
        Glow.draw(ctx, x, s.y, s.r * 8, color, a * 0.28);
        ctx.save();
        ctx.globalAlpha = a * 0.85;
        ctx.strokeStyle = color;
        ctx.lineWidth = 0.7;
        const rr = s.r * 4.5;
        ctx.beginPath();
        ctx.moveTo(x - rr, s.y);
        ctx.lineTo(x + rr, s.y);
        ctx.moveTo(x, s.y - rr);
        ctx.lineTo(x, s.y + rr);
        ctx.stroke();
        ctx.restore();
      }
      ctx.save();
      ctx.globalAlpha = a * (s.big ? 0.95 : 0.72);
      ctx.fillStyle = color;
      fillCircle(ctx, x, s.y, s.r * (s.big ? 1.4 : 1));
      ctx.restore();
    }
  }
}

const moonCache = new Map();
function moonHalo(r, glowColor) {
  const key = 'h' + Math.round(r) + glowColor;
  let c = moonCache.get(key);
  if (c) return c;
  const size = Math.ceil(r * 7);
  c = makeCanvas(size, size);
  const g = c.getContext('2d');
  const cx = size / 2;
  const grad = g.createRadialGradient(cx, cx, 0, cx, cx, size / 2);
  grad.addColorStop(0, rgba(glowColor, 0.42));
  grad.addColorStop(0.055, rgba(glowColor, 0.3));
  grad.addColorStop(0.13, rgba(glowColor, 0.17));
  grad.addColorStop(0.24, rgba(glowColor, 0.07));
  grad.addColorStop(0.42, rgba(glowColor, 0.02));
  grad.addColorStop(0.7, rgba(glowColor, 0.005));
  grad.addColorStop(1, rgba(glowColor, 0));
  g.fillStyle = grad;
  g.fillRect(0, 0, size, size);
  moonCache.set(key, c);
  return c;
}

function moonBody(r, color, edge, edgeDark, seed) {
  const key = 'b' + Math.round(r) + color + edge + seed;
  let c = moonCache.get(key);
  if (c) return c;
  const size = Math.ceil(r * 2 + 4);
  c = makeCanvas(size, size);
  const g = c.getContext('2d');
  const cx = size / 2;
  const grad = g.createRadialGradient(cx - r * 0.32, cx - r * 0.36, r * 0.08, cx, cx, r);
  grad.addColorStop(0, '#fffbea');
  grad.addColorStop(0.42, color);
  grad.addColorStop(0.76, color);
  grad.addColorStop(0.92, edge);
  grad.addColorStop(1, edgeDark);
  g.fillStyle = grad;
  g.beginPath();
  g.arc(cx, cx, r, 0, TAU);
  g.fill();
  const rng = mulberry32(seed);
  for (let i = 0; i < 11; i++) {
    const px = cx + (rng() * 2 - 1) * r * 0.66;
    const py = cx + (rng() * 2 - 1) * r * 0.66;
    const rr = r * (0.035 + rng() * 0.12);
    g.globalAlpha = 0.08 + rng() * 0.09;
    g.fillStyle = '#6f563d';
    g.beginPath();
    g.ellipse(px, py, rr, rr * (0.7 + rng() * 0.4), rng() * TAU, 0, TAU);
    g.fill();
  }
  g.globalAlpha = 0.12;
  g.strokeStyle = '#fff8e6';
  g.lineWidth = Math.max(1, r * 0.018);
  g.beginPath();
  g.arc(cx, cx, r * 0.97, Math.PI * 1.04, Math.PI * 1.78);
  g.stroke();
  g.globalAlpha = 0.1;
  g.strokeStyle = '#6f563d';
  g.lineWidth = Math.max(1, r * 0.02);
  g.beginPath();
  g.arc(cx, cx, r * 0.97, Math.PI * 0.02, Math.PI * 0.55);
  g.stroke();
  moonCache.set(key, c);
  return c;
}

function drawMoon(x, y, r, time, opts = {}) {
  const a = clamp(opts.alpha != null ? opts.alpha : 1, 0, 1);
  if (a <= 0.01) return;
  const color = opts.color || '#ffedc9';
  const glowColor = opts.glowColor || '#ffc177';
  const halo = moonHalo(r, glowColor);
  const body = moonBody(r, color, opts.edge || '#e5c08a', opts.edgeDark || '#b98c57', opts.seed || 77);
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.globalAlpha = a * (0.9 + 0.06 * Math.sin(time * 0.35));
  ctx.drawImage(halo, x - halo.width / 2, y - halo.height / 2);
  ctx.restore();
  ctx.save();
  ctx.globalAlpha = a;
  ctx.drawImage(body, x - body.width / 2, y - body.height / 2);
  ctx.restore();
}

function hillY(x, layer) {
  return layer.base
    + Math.sin(x * 0.00112 + layer.seed) * layer.amp
    + Math.sin(x * 0.00384 + layer.seed * 2.3) * layer.amp2
    + Math.sin(x * 0.00062 + layer.seed * 0.7) * layer.amp * 0.4;
}

function drawHillLayer(camX, time, layer) {
  const p = layer.p || 0.1;
  const off = camX * p;
  ctx.save();
  ctx.globalAlpha = layer.alpha != null ? layer.alpha : 1;
  ctx.beginPath();
  ctx.moveTo(-30, VH + 30);
  const pts = [];
  for (let x = -30; x <= VW + 40; x += 22) {
    const wx = x + off;
    const y = hillY(wx, layer);
    pts.push([x, y]);
    ctx.lineTo(x, y);
  }
  ctx.lineTo(VW + 40, VH + 30);
  ctx.closePath();
  const g = ctx.createLinearGradient(0, layer.base - layer.amp - layer.amp2, 0, VH);
  g.addColorStop(0, layer.top);
  g.addColorStop(0.65, layer.mid || layer.top);
  g.addColorStop(1, layer.bottom || '#03040a');
  ctx.fillStyle = g;
  ctx.fill();
  if (layer.trees) {
    ctx.globalAlpha = (layer.alpha != null ? layer.alpha : 1) * (layer.treeAlpha || 0.9);
    const spacing = layer.treeSpacing || 90;
    const start = Math.floor(off / spacing) * spacing - 100;
    for (let wx = start - off; wx < VW + 120; wx += spacing) {
      const nx = wx + off;
      const vx = nx - off;
      const jitter = fract(Math.sin(wx * 0.013 + layer.seed) * 43758.5453) * spacing * 0.7;
      const x = vx + jitter;
      const y = hillY(nx + jitter, layer) + 4;
      const h = (layer.treeSize || 26) * (0.6 + fract(Math.sin(wx * 0.031 + 3) * 1234.567) * 0.8);
      if (layer.treeStyle === 'round') drawRoundTree(x, y, h, layer.treeColor || layer.top, 0.92);
      else drawPine(x, y, h, layer.treeColor || layer.top, 0.92);
    }
  }
  ctx.restore();
}

function drawPine(x, y, h, color, alpha = 1) {
  ctx.save();
  ctx.globalAlpha *= alpha;
  ctx.fillStyle = color;
  const layers = 3;
  for (let i = 0; i < layers; i++) {
    const t = i / layers;
    const w = h * (0.32 - t * 0.07);
    const y0 = y - h * (0.18 + t * 0.3);
    ctx.beginPath();
    ctx.moveTo(x, y0 - h * 0.42);
    ctx.lineTo(x + w, y0);
    ctx.lineTo(x - w, y0);
    ctx.closePath();
    ctx.fill();
  }
  ctx.fillRect(x - 1, y - h * 0.15, 2, h * 0.18);
  ctx.restore();
}

function drawRoundTree(x, y, h, color, alpha = 1) {
  ctx.save();
  ctx.globalAlpha *= alpha;
  ctx.fillStyle = color;
  ctx.fillRect(x - h * 0.025, y - h * 0.32, h * 0.05, h * 0.34);
  ctx.beginPath();
  ctx.ellipse(x - h * 0.13, y - h * 0.46, h * 0.2, h * 0.22, 0.2, 0, TAU);
  ctx.ellipse(x + h * 0.12, y - h * 0.5, h * 0.22, h * 0.24, -0.15, 0, TAU);
  ctx.ellipse(x, y - h * 0.63, h * 0.24, h * 0.25, 0, 0, TAU);
  ctx.fill();
  ctx.restore();
}

function drawMistBand(y, h, color, alpha, time, camX) {
  if (alpha <= 0.005) return;
  ctx.save();
  const g = ctx.createLinearGradient(0, y - h, 0, y + h);
  g.addColorStop(0, rgba(color, 0));
  g.addColorStop(0.5, rgba(color, alpha));
  g.addColorStop(1, rgba(color, 0));
  ctx.fillStyle = g;
  ctx.fillRect(0, y - h, VW, h * 2);
  const drift = time * 5 + camX * 0.05;
  for (let i = 0; i < 5; i++) {
    const x = wrap(i * 430 + drift, VW + 500) - 250;
    const yy = y + Math.sin(i * 2.3 + time * 0.1) * h * 0.35;
    Glow.draw(ctx, x, yy, 330, color, alpha * 0.32, 'source-over');
  }
  ctx.restore();
}

function makeCloud(seed, color, rim, w = 660) {
  const rng = mulberry32(seed);
  const h = Math.round(w * 0.42);
  const c = makeCanvas(w, h);
  const x = c.getContext('2d');
  for (let i = 0; i < 22; i++) {
    const cx = w * (0.1 + rng() * 0.8);
    const cy = h * (0.36 + rng() * 0.34);
    const r = w * (0.06 + rng() * 0.13);
    const grad = x.createRadialGradient(cx, cy - r * 0.2, r * 0.05, cx, cy, r);
    grad.addColorStop(0, rgba(color, 0.14 + rng() * 0.08));
    grad.addColorStop(0.55, rgba(color, 0.07));
    grad.addColorStop(1, rgba(color, 0));
    x.fillStyle = grad;
    x.beginPath();
    x.arc(cx, cy, r, 0, TAU);
    x.fill();
  }
  for (let i = 0; i < 10; i++) {
    const cx = w * (0.18 + rng() * 0.64);
    const cy = h * (0.22 + rng() * 0.18);
    const r = w * (0.06 + rng() * 0.1);
    const grad = x.createRadialGradient(cx, cy, 0, cx, cy, r);
    grad.addColorStop(0, rgba(rim, 0.08 + rng() * 0.06));
    grad.addColorStop(1, rgba(rim, 0));
    x.fillStyle = grad;
    x.beginPath();
    x.arc(cx, cy, r, 0, TAU);
    x.fill();
  }
  return c;
}

class CloudField {
  constructor(seed, count, color, rim, opts = {}) {
    const rng = mulberry32(seed);
    this.span = 3600;
    this.sprites = [];
    for (let i = 0; i < 3; i++) this.sprites.push(makeCloud(seed + i * 713, color, rim, opts.size || 700));
    this.items = [];
    for (let i = 0; i < count; i++) {
      this.items.push({
        x: rng() * this.span,
        y: (opts.yMin || 40) + rng() * ((opts.yMax || 330) - (opts.yMin || 40)),
        scale: (opts.scaleMin || 0.45) + rng() * ((opts.scaleMax || 1.1) - (opts.scaleMin || 0.45)),
        speed: 1.4 + rng() * 3.4,
        alpha: (opts.alphaMin || 0.35) + rng() * ((opts.alphaMax || 0.8) - (opts.alphaMin || 0.35)),
        sprite: Math.floor(rng() * 3),
        flip: rng() < 0.5
      });
    }
  }
  draw(camX, time, opts = {}) {
    const par = opts.parallax != null ? opts.parallax : 0.07;
    const drift = opts.drift != null ? opts.drift : 5;
    const yoff = opts.yOffset || 0;
    const alphaMul = opts.alpha != null ? opts.alpha : 1;
    ctx.save();
    for (const it of this.items) {
      const off = wrap(camX * par + time * drift * it.speed * 0.18, this.span);
      let x = it.x - off;
      if (x < -this.span * 0.5) x += this.span;
      if (x < -800 || x > VW + 800) continue;
      const sprite = this.sprites[it.sprite];
      const w = sprite.width * it.scale;
      const h = sprite.height * it.scale;
      ctx.globalAlpha = it.alpha * alphaMul;
      if (it.flip) {
        ctx.save();
        ctx.translate(x + w, it.y + yoff);
        ctx.scale(-1, 1);
        ctx.drawImage(sprite, 0, 0, w, h);
        ctx.restore();
      } else {
        ctx.drawImage(sprite, x, it.y + yoff, w, h);
      }
    }
    ctx.restore();
  }
}

class GrassField {
  constructor(opts = {}) {
    const rng = mulberry32(opts.seed || 1);
    this.blades = [];
    const left = opts.left || 0;
    const right = opts.right || VW;
    const count = opts.count || 1000;
    const palette = opts.colors || ['#08131d'];
    this.sway = opts.sway != null ? opts.sway : 5;
    for (let i = 0; i < count; i++) {
      const x = left + rng() * (right - left);
      this.blades.push({
        x,
        base: (opts.groundY || VH) + (rng() * 2 - 1) * (opts.groundJitter || 8),
        h: (opts.minH || 40) + rng() * ((opts.maxH || 140) - (opts.minH || 40)),
        w: (opts.minW || 1) + rng() * ((opts.maxW || 3) - (opts.minW || 1)),
        lean: (rng() * 2 - 1) * (opts.lean || 0.3),
        phase: rng() * TAU,
        color: pick(palette),
        hi: rng() < (opts.hiRatio || 0.16),
        curve: (rng() * 2 - 1) * 0.4
      });
    }
    this.blades.sort((a, b) => a.x - b.x);
    this.left = left;
    this.right = right;
  }
  draw(time, opts = {}) {
    const left = opts.left != null ? opts.left : -100;
    const right = opts.right != null ? opts.right : VW + 100;
    const wind = opts.wind || 0;
    const blades = this.blades;
    let i = lowerBoundX(blades, left - 80);
    ctx.save();
    ctx.lineCap = 'round';
    for (; i < blades.length; i++) {
      const b = blades[i];
      if (b.x > right + 80) break;
      const sway = Math.sin(time * (0.85 + (b.phase % 0.4)) + b.phase) * this.sway + wind * (0.012 + b.h * 0.00005);
      const tipX = b.x + b.lean * b.h + sway;
      const tipY = b.base - b.h;
      const midX = b.x + b.lean * b.h * 0.45 + sway * 0.35 + b.curve * 12;
      const midY = b.base - b.h * 0.56;
      ctx.strokeStyle = b.color;
      ctx.lineWidth = b.w;
      ctx.beginPath();
      ctx.moveTo(b.x, b.base + 2);
      ctx.quadraticCurveTo(midX, midY, tipX, tipY);
      ctx.stroke();
      if (b.hi) {
        ctx.globalAlpha = 0.28;
        ctx.strokeStyle = opts.hiColor || '#9fb6b0';
        ctx.lineWidth = Math.max(0.5, b.w * 0.45);
        ctx.beginPath();
        ctx.moveTo(b.x + b.w * 0.2, b.base);
        ctx.quadraticCurveTo(midX + 1, midY, tipX, tipY + 4);
        ctx.stroke();
        ctx.globalAlpha = 1;
      }
    }
    ctx.restore();
  }
}

function lowerBoundX(arr, x) {
  let lo = 0, hi = arr.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (arr[mid].x < x) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

class FlowerField {
  constructor(opts = {}) {
    const rng = mulberry32(opts.seed || 9);
    this.items = [];
    const left = opts.left || 0;
    const right = opts.right || VW;
    const count = opts.count || 30;
    const colors = opts.colors || ['#ffd9a0'];
    this.openRatio = opts.openRatio != null ? opts.openRatio : 0.55;
    for (let i = 0; i < count; i++) {
      this.items.push({
        x: left + rng() * (right - left),
        base: (opts.groundY || VH) + (rng() * 2 - 1) * 10,
        h: (opts.minH || 60) + rng() * ((opts.maxH || 150) - (opts.minH || 60)),
        phase: rng() * TAU,
        color: pick(colors),
        size: (opts.minSize || 3) + rng() * ((opts.maxSize || 7) - (opts.minSize || 3)),
        lean: (rng() * 2 - 1) * 0.2,
        glow: (opts.glowMin || 0.25) + rng() * 0.55,
        type: rng() < 0.5 ? 'bell' : 'cluster',
        open: rng() < (opts.openRatio != null ? opts.openRatio : 0.55),
        leaf: rng() < 0.5,
        tilt: (rng() * 2 - 1) * 0.5
      });
    }
    this.items.sort((a, b) => a.x - b.x);
  }
  draw(time, opts = {}) {
    const left = opts.left != null ? opts.left : -100;
    const right = opts.right != null ? opts.right : VW + 100;
    const wind = opts.wind || 0;
    const arr = this.items;
    let i = lowerBoundX(arr, left - 80);
    ctx.save();
    ctx.lineCap = 'round';
    for (; i < arr.length; i++) {
      const f = arr[i];
      if (f.x > right + 80) break;
      const sway = Math.sin(time * 0.9 + f.phase) * 6 + wind * 0.006;
      const tx = f.x + f.lean * f.h + sway;
      const ty = f.base - f.h;
      ctx.strokeStyle = opts.stem || '#0a1a1a';
      ctx.lineWidth = 1.1;
      ctx.beginPath();
      ctx.moveTo(f.x, f.base);
      ctx.quadraticCurveTo(f.x + sway * 0.25, f.base - f.h * 0.55, tx, ty);
      ctx.stroke();
      if (f.leaf) {
        const ly = f.base - f.h * (0.3 + (f.phase % 0.2));
        ctx.fillStyle = opts.stem || '#0a1a1a';
        ctx.beginPath();
        ctx.ellipse(f.x + 3 + sway * 0.1, ly, 7, 2.2, -0.5 + f.tilt * 0.3, 0, TAU);
        ctx.fill();
      }
      const pulse = 0.72 + 0.28 * Math.sin(time * 1.25 + f.phase);
      const s = f.size;
      if (!f.open) {
        Glow.draw(ctx, tx, ty, s * 5, f.color, 0.16 * f.glow * pulse);
        ctx.globalAlpha = 0.72;
        ctx.fillStyle = f.color;
        ctx.beginPath();
        ctx.ellipse(tx, ty, s * 0.55, s * 0.9, f.tilt, 0, TAU);
        ctx.fill();
        ctx.globalAlpha = 1;
        continue;
      }
      ctx.globalCompositeOperation = 'lighter';
      Glow.draw(ctx, tx, ty, s * 6.5, f.color, 0.14 * f.glow * pulse);
      ctx.globalCompositeOperation = 'source-over';
      if (f.type === 'bell') {
        const g = ctx.createLinearGradient(tx, ty - s, tx, ty + s * 1.2);
        g.addColorStop(0, rgba(f.color, 0.8));
        g.addColorStop(0.6, rgba(f.color, 0.55));
        g.addColorStop(1, rgba(f.color, 0.12));
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.moveTo(tx - s, ty + 1);
        ctx.bezierCurveTo(tx - s * 0.9, ty - s * 0.9, tx + s * 0.9, ty - s * 0.9, tx + s, ty + 1);
        ctx.bezierCurveTo(tx + s * 0.75, ty + s * 0.75, tx + s * 0.4, ty + s * 1.05, tx, ty + s * 1.12);
        ctx.bezierCurveTo(tx - s * 0.4, ty + s * 1.05, tx - s * 0.75, ty + s * 0.75, tx - s, ty + 1);
        ctx.closePath();
        ctx.fill();
        ctx.globalAlpha = 0.8;
        ctx.fillStyle = '#fff4d6';
        fillCircle(ctx, tx, ty + s * 0.6, s * 0.24);
      } else {
        ctx.fillStyle = rgba(f.color, 0.72);
        for (let p = 0; p < 5; p++) {
          const a = p / 5 * TAU + f.phase;
          const px = tx + Math.cos(a) * s * 0.9;
          const py = ty + Math.sin(a) * s * 0.7;
          ctx.beginPath();
          ctx.ellipse(px, py, s * 0.52, s * 0.42, a, 0, TAU);
          ctx.fill();
        }
        ctx.fillStyle = 'rgba(255,244,210,0.8)';
        fillCircle(ctx, tx, ty, s * 0.34);
      }
      ctx.globalAlpha = 1;
    }
    ctx.restore();
  }
}

class Fireflies {
  constructor(seed, count, opts = {}) {
    const rng = mulberry32(seed);
    this.span = VW + 700;
    this.items = [];
    for (let i = 0; i < count; i++) {
      this.items.push({
        x: rng() * this.span,
        y: (opts.yMin || 200) + rng() * ((opts.yMax || 760) - (opts.yMin || 200)),
        phase: rng() * TAU,
        speed: 0.3 + rng() * 0.8,
        drift: 20 + rng() * 50,
        r: (opts.sizeMin || 0.8) + rng() * ((opts.sizeMax || 2.2) - (opts.sizeMin || 0.8)),
        color: Array.isArray(opts.color) ? pick(opts.color) : (opts.color || '#ffe8a3'),
        phase2: rng() * TAU
      });
    }
  }
  draw(camX, time, opts = {}) {
    const par = opts.parallax != null ? opts.parallax : 0.2;
    const off = wrap(camX * par, this.span);
    const alpha = opts.alpha != null ? opts.alpha : 1;
    for (const f of this.items) {
      let x = f.x + off;
      if (x >= this.span) x -= this.span;
      if (x < -20 || x > VW + 20) continue;
      const xx = x + Math.sin(time * f.speed + f.phase) * f.drift;
      const yy = f.y + Math.cos(time * f.speed * 0.8 + f.phase2) * f.drift * 0.5;
      const pulse = Math.max(0, Math.sin(time * (1.1 + f.speed) + f.phase));
      const a = alpha * (0.18 + pulse * 0.65);
      if (a <= 0.02) continue;
      Glow.draw(ctx, xx, yy, f.r * 16, f.color, a * 0.5);
      ctx.save();
      ctx.globalAlpha = a;
      ctx.fillStyle = '#fff5d6';
      fillCircle(ctx, xx, yy, f.r);
      ctx.restore();
    }
  }
}

function drawRainWorld(cam, time, intensity, shelters = [], opts = {}) {
  if (intensity <= 0.01) return;
  const wind = opts.wind != null ? opts.wind : 150;
  const zoom = cam.zoom;
  const spanX = VW / zoom + 500;
  const spanY = VH / zoom + 450;
  ctx.save();
  ctx.lineCap = 'round';
  const layers = [
    { count: Math.floor(150 * intensity), speed: 760, len: 20, alpha: 0.12, w: 0.9 },
    { count: Math.floor(220 * intensity), speed: 1180, len: 34, alpha: 0.2, w: 1.2 },
    { count: Math.floor(80 * intensity), speed: 1550, len: 56, alpha: 0.17, w: 1.6 }
  ];
  layers.forEach((layer, li) => {
    ctx.strokeStyle = li === 0 ? 'rgba(150,180,205,1)' : li === 1 ? 'rgba(190,214,232,1)' : 'rgba(214,231,240,1)';
    ctx.lineWidth = layer.w / zoom;
    ctx.globalAlpha = layer.alpha * 0.86;
    ctx.beginPath();
    for (let i = 0; i < layer.count; i++) {
      const r1 = fract(i * 0.754877666 + li * 0.13);
      const r2 = fract(i * 0.569840291 + li * 0.31);
      const x = cam.left - 260 + wrap(r1 * spanX + r2 * 90 + time * wind * 0.22, spanX);
      const y = cam.top - 240 + wrap(r2 * spanY + time * layer.speed, spanY);
      let dry = false;
      for (let si = 0; si < shelters.length; si++) {
        const sh = shelters[si];
        if (x > sh.x - sh.r && x < sh.x + sh.r && y > sh.y - sh.r * 0.95 && y < sh.y + sh.r * 2.6) { dry = true; break; }
      }
      if (dry) continue;
      ctx.moveTo(x, y);
      ctx.lineTo(x + wind * 0.026, y + layer.len / zoom);
    }
    ctx.stroke();
  });
  ctx.restore();
}

function drawBolt(x, top, bottom, seed, alpha = 1, width = 2.4) {
  const rng = mulberry32(seed);
  const pts = [];
  let cx = x;
  for (let y = top; y <= bottom + 30; y += 26) {
    pts.push([cx, y]);
    cx += (rng() * 2 - 1) * 42;
  }
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.globalAlpha = alpha;
  const strokePath = (w, color) => {
    ctx.strokeStyle = color;
    ctx.lineWidth = w;
    ctx.beginPath();
    ctx.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
    ctx.stroke();
  };
  strokePath(width * 7, 'rgba(130,170,255,0.16)');
  strokePath(width * 3.4, 'rgba(170,204,255,0.36)');
  strokePath(width * 2.0, 'rgba(186,214,255,0.8)');
  strokePath(width, 'rgba(255,255,255,1)');
  for (let b = 0; b < 5; b++) {
    const idx = Math.floor(rng() * (pts.length - 2)) + 1;
    const [bx, by] = pts[idx];
    ctx.strokeStyle = 'rgba(200,224,255,0.65)';
    ctx.lineWidth = width * 0.6;
    ctx.beginPath();
    ctx.moveTo(bx, by);
    let lx = bx, ly = by;
    for (let k = 0; k < 3; k++) {
      lx += (rng() * 2 - 1) * 44;
      ly += 28 + rng() * 30;
      ctx.lineTo(lx, ly);
    }
    ctx.stroke();
  }
  ctx.restore();
}

function groundGradient(x, y, w, h, top, bottom) {
  const g = ctx.createLinearGradient(0, y, 0, y + h);
  g.addColorStop(0, top);
  g.addColorStop(1, bottom);
  ctx.fillStyle = g;
  ctx.fillRect(x, y, w, h);
}

function drawDistantHouse(x, baseY, s, time, opts = {}) {
  const lit = opts.lit != null ? opts.lit : 1;
  ctx.save();
  ctx.translate(x, baseY);
  ctx.scale(s, s);
  const lampX = -25, lampY = -57;
  if (lit > 0.01) {
    Glow.draw(ctx, lampX, lampY, 74, '#ffbb64', 0.22 * lit);
    Glow.draw(ctx, lampX, lampY, 24, '#ffd28c', 0.55 * lit);
    Glow.draw(ctx, 12, -49, 44, '#ffb765', 0.12 * lit);
  }
  ctx.fillStyle = opts.color || '#04070c';
  ctx.beginPath();
  ctx.moveTo(-44, 2);
  ctx.lineTo(-44, -56);
  ctx.lineTo(0, -88);
  ctx.lineTo(44, -56);
  ctx.lineTo(44, 2);
  ctx.closePath();
  ctx.fill();
  ctx.fillRect(-38, -104, 10, 22);
  ctx.fillRect(-52, -44, 12, 46);
  ctx.fillRect(40, -44, 8, 46);
  ctx.fillStyle = opts.roofRim || 'rgba(151,180,190,0.15)';
  ctx.beginPath();
  ctx.moveTo(-44, -56);
  ctx.lineTo(0, -88);
  ctx.lineTo(44, -56);
  ctx.lineTo(40, -54);
  ctx.lineTo(0, -83);
  ctx.lineTo(-40, -54);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#0a1016';
  ctx.beginPath();
  ctx.moveTo(-60, -48);
  ctx.lineTo(-2, -48);
  ctx.lineTo(0, -44);
  ctx.lineTo(-58, -44);
  ctx.closePath();
  ctx.fill();
  ctx.fillRect(-56, -44, 3, 46);
  ctx.fillRect(-22, -44, 3, 46);
  if (lit > 0.01) {
    ctx.globalAlpha = 0.8 * lit;
    const wg = ctx.createLinearGradient(0, -54, 0, -26);
    wg.addColorStop(0, '#ffd79b');
    wg.addColorStop(1, '#c97a3d');
    ctx.fillStyle = wg;
    ctx.fillRect(18, -54, 16, 18);
    ctx.fillStyle = '#120d09';
    ctx.fillRect(25, -54, 2, 18);
    ctx.fillRect(18, -45, 16, 2);
    ctx.globalAlpha = 1;
  }
  ctx.fillStyle = '#05090e';
  ctx.fillRect(-8, -30, 15, 32);
  if (lit > 0.01) {
    ctx.globalAlpha = 0.55 * lit;
    ctx.fillStyle = '#ffdfa6';
    fillCircle(ctx, lampX, lampY, 2.3);
    ctx.globalAlpha = 1;
    Glow.draw(ctx, lampX, 4, 70, '#ffb45e', 0.09 * lit);
  }
  if (opts.moth) {
    const t = time;
    const mx = lampX + Math.cos(t * 1.35) * 15;
    const my = lampY + Math.sin(t * 1.7) * 9 + Math.sin(t * 0.7) * 4;
    ctx.save();
    ctx.translate(mx, my);
    ctx.scale(0.42, 0.42);
    opts.moth.x = 0;
    opts.moth.y = 0;
    opts.moth.flapPhase = t * 9;
    opts.moth.bank = Math.sin(t * 1.35) * 0.25;
    opts.moth.draw(ctx, time, { glow: 0.55 });
    ctx.restore();
  }
  ctx.restore();
}

function makeNightArt(seed, opts = {}) {
  const ground = opts.groundY || 706;
  return {
    stars: new StarField(seed + 1, opts.stars || 300, { height: 620, maxR: 1.9, bigRatio: 0.045, warmRatio: 0.34 }),
    cloudsFar: new CloudField(seed + 2, 4, '#233947', '#a4bac8', { yMin: 70, yMax: 330, scaleMin: 0.6, scaleMax: 1.35, alphaMin: 0.3, alphaMax: 0.55, size: 780 }),
    cloudsNear: new CloudField(seed + 3, 3, '#182b37', '#8da6b5', { yMin: 260, yMax: 490, scaleMin: 0.85, scaleMax: 1.5, alphaMin: 0.16, alphaMax: 0.36, size: 900 }),
    hills: [
      { p: 0.035, base: 566, amp: 26, amp2: 9, top: '#0f2230', mid: '#0b1a26', bottom: '#08111a', seed: 3.7, trees: true, treeStyle: 'round', treeColor: '#0a1924', treeSpacing: 76, treeSize: 20, treeAlpha: 0.55 },
      { p: 0.085, base: 620, amp: 24, amp2: 8, top: '#0a1924', mid: '#07121b', bottom: '#050c12', seed: 8.1, trees: true, treeStyle: 'pine', treeColor: '#07131c', treeSpacing: 108, treeSize: 32, treeAlpha: 0.72 },
      { p: 0.16, base: 700, amp: 18, amp2: 5, top: '#060f16', mid: '#04090f', bottom: '#03050a', seed: 11.4, trees: false }
    ],
    flies: new Fireflies(seed + 9, opts.flies || 30, { yMin: 280, yMax: 700, sizeMin: 0.7, sizeMax: 2.1, color: ['#ffe9a8', '#ffd08a', '#d8eedd'] }),
    grassMid: new GrassField({ seed: seed + 5, left: -140, right: VW + 140, groundY: ground + 26, count: 380, minH: 40, maxH: 120, minW: 0.8, maxW: 2, colors: ['#08141b', '#0a1820', '#071019'], hiRatio: 0.1, hiColor: '#4f706f', sway: 3.5 }),
    flowers: new FlowerField({ seed: seed + 6, left: -140, right: VW + 140, groundY: ground + 22, count: 16, minH: 50, maxH: 120, minSize: 2, maxSize: 5, colors: ['#cfe8dd', '#ffe3b1', '#d8c7ec'], glowMin: 0.2 }),
    grassFront: new GrassField({ seed: seed + 7, left: -160, right: VW + 160, groundY: ground + 235, count: 150, minH: 90, maxH: 260, minW: 1.4, maxW: 3.8, colors: ['#020409', '#010307'], hiRatio: 0.06, hiColor: '#355052', sway: 5.5 }),
    houseX: opts.houseX != null ? opts.houseX : 1290,
    houseBase: opts.houseBase != null ? opts.houseBase : 690,
    houseScale: opts.houseScale != null ? opts.houseScale : 1.0,
    groundY: ground
  };
}

function drawNightArt(art, time, camX, opts = {}) {
  drawSky(opts.sky || [[0, '#04060e'], [0.3, '#0a1226'], [0.56, '#12283a'], [0.74, '#1a3944'], [0.84, '#14262c'], [1, '#05080d']]);
  art.stars.draw(camX, time, { parallax: 0.02, alpha: opts.starAlpha != null ? opts.starAlpha : 1 });
  drawMoon(opts.moonX || 1250, opts.moonY || 196, opts.moonR || 104, time, { aura: true, alpha: opts.moonAlpha != null ? opts.moonAlpha : 1 });
  art.cloudsFar.draw(camX, time, { parallax: 0.05, alpha: 0.9 });
  drawHillLayer(camX, time, art.hills[0]);
  drawHillLayer(camX, time, art.hills[1]);
  const hx = art.houseX - camX * 0.03;
  if (hx > -200 && hx < VW + 200) {
    drawDistantHouse(hx, art.houseBase, art.houseScale, time, { moth: opts.moth, lit: opts.houseLit != null ? opts.houseLit : 1 });
  }
  drawMistBand(art.groundY - 70, 90, '#6c939e', opts.mistAlpha != null ? opts.mistAlpha : 0.07, time, camX);
  drawHillLayer(camX, time, art.hills[2]);
  art.cloudsNear.draw(camX, time, { parallax: 0.11, alpha: 0.8 });
  art.flies.draw(camX, time, { parallax: 0.17, alpha: opts.flyAlpha != null ? opts.flyAlpha : 1 });
  const groundTop = art.groundY + 14;
  const gg = ctx.createLinearGradient(0, groundTop - 30, 0, VH);
  gg.addColorStop(0, '#071018');
  gg.addColorStop(0.35, '#050a10');
  gg.addColorStop(1, '#020409');
  ctx.fillStyle = gg;
  ctx.beginPath();
  ctx.moveTo(0, VH + 10);
  for (let x = 0; x <= VW; x += 24) {
    const y = groundTop + Math.sin((x + camX) * 0.0023) * 7 + Math.sin((x + camX) * 0.008) * 3;
    ctx.lineTo(x, y);
  }
  ctx.lineTo(VW, VH + 10);
  ctx.closePath();
  ctx.fill();
  art.grassMid.draw(time, { left: -100, right: VW + 100, wind: opts.wind || 0, hiColor: '#5d7d7b' });
  art.flowers.draw(time, { left: -100, right: VW + 100, wind: opts.wind || 0 });
  art.grassFront.draw(time, { left: -100, right: VW + 100, wind: opts.wind || 0, hiColor: '#274348' });
}

function drawNightTextOverlay() {
  const grad = ctx.createLinearGradient(0, VH * 0.3, 0, VH);
  grad.addColorStop(0, 'rgba(3,5,10,0)');
  grad.addColorStop(0.5, 'rgba(3,5,10,0.15)');
  grad.addColorStop(1, 'rgba(3,5,10,0.7)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, VW, VH);
}

function makeTitleScene() {
  const art = makeNightArt(42117, { houseX: 1310, houseBase: 690, houseScale: 1.06 });
  const moth = new Moth();
  let time = 0;
  let starting = false;
  let startT = 0;
  let introT = 0;
  return {
    name: 'title',
    enter() {
      Captions.clear();
      Sound.setAct('meadow');
      Sound.setRoom(0.03);
      this.time = 0;
    },
    update(dt) {
      time += dt;
      introT += dt;
      if (!starting) {
        const startAllowed = [...Input.pressed].some(c => !['KeyM', 'KeyF', 'Escape', 'Tab'].includes(c)) || Input.mouse.clicked;
        if (startAllowed && time > 0.35) {
          starting = true;
          startT = 0;
          Sound.init();
          Sound.resume();
          Sound.sfx('begin');
          Sound.playTheme({ instrument: 'pluck', gain: 0.85, delay: 0.7 });
        }
      } else {
        startT += dt;
        if (startT > 1.2) Game.go('prologue', {}, { duration: 1.4 });
      }
    },
    draw() {
      const camX = time * 3.2 + Math.sin(time * 0.05) * 20;
      drawNightArt(art, time, camX, { moth: moth, houseLit: 0.95, mistAlpha: 0.08, moonX: 1338, moonY: 168, moonR: 101 });
      drawNightTextOverlay();
      const breathe = 0.6 + 0.4 * Math.sin(time * 0.9);
      drawSpaced('A SHORT FLIGHT THROUGH THE DARK', VW / 2, 246, { size: 12, spacing: 6.5, align: 'center', color: 'rgba(241,225,196,0.58)', alpha: 0.9 });
      ctx.save();
      ctx.globalAlpha = starting ? Math.max(0, 1 - startT / 1.0) : 1;
      Glow.draw(ctx, VW / 2, 330, 520, '#ffb763', 0.055);
      drawSpaced('LITTLE MOON', VW / 2, 344, { size: 92, weight: '400', family: SERIF, spacing: 16, align: 'center', color: '#f3ead7' });
      drawText('a story about keeping a light on', VW / 2, 398, { size: 24, italic: true, align: 'center', color: 'rgba(239,226,200,0.68)' });
      ctx.strokeStyle = 'rgba(255,205,142,0.28)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(VW / 2 - 44, 428);
      ctx.lineTo(VW / 2 + 44, 428);
      ctx.stroke();
      ctx.restore();
      if (!starting) {
        const pa = 0.58 + 0.28 * breathe;
        drawSpaced('PRESS ANY KEY', VW / 2, 672, { size: 14, spacing: 5, align: 'center', color: '#f0e2c8', alpha: pa });
        drawText('best experienced with sound', VW / 2, 706, { size: 15, italic: true, align: 'center', color: 'rgba(235,223,200,0.42)' });
      }
      drawSpaced('ARROWS / WASD  FLY', 58, 842, { size: 10, spacing: 3, color: 'rgba(235,225,206,0.42)' });
      drawSpaced('SPACE  FLUTTER', 58, 862, { size: 10, spacing: 3, color: 'rgba(235,225,206,0.42)' });
      drawSpaced('M  MUTE      ESC  PAUSE', 58, 882, { size: 10, spacing: 3, color: 'rgba(235,225,206,0.3)' });
      drawSpaced('A GAME FOR ONE QUIET NIGHT', VW - 58, 866, { size: 10, spacing: 3.4, align: 'right', color: 'rgba(235,225,206,0.32)' });
    }
  };
}

function makePrologueScene() {
  const art = makeNightArt(7351, { houseX: 1200, houseBase: 682, houseScale: 1.0 });
  const moth = new Moth();
  const lines = [
    "June's mother used to say that moths were little moons, come down to visit.",
    'Every night, she left the porch lamp on for them.',
    'Then one winter, her mother went away. The lamp stayed on.',
    'Tonight, a small moth has hatched at the edge of the meadow.',
    'Somewhere across the dark, a light is waiting.'
  ];
  let time = 0;
  let lineIndex = 0;
  let lineAge = 0;
  let done = false;
  let doneT = 0;
  let themePlayed = false;
  return {
    name: 'prologue',
    enter() {
      Captions.clear();
      Sound.setAct('meadow');
      Sound.setRoom(0.02);
    },
    update(dt) {
      time += dt;
      if (!done) {
        lineAge += dt;
        if (!themePlayed && time > 1.6) {
          themePlayed = true;
          Sound.playTheme({ instrument: 'pluck', gain: 0.6, delay: 0.1 });
        }
        const advance = Input.hit('Space') || Input.hit('Enter') || Input.mouse.clicked;
        if (advance && lineAge > 0.3) lineAge = Math.max(lineAge, 4.05);
        if (lineAge > 4.6) {
          lineIndex++;
          lineAge = 0;
          if (lineIndex >= lines.length) {
            done = true;
            doneT = 0;
          }
        }
      } else {
        doneT += dt;
        if (doneT > 1.2) Game.go('meadow', {}, { duration: 1.8 });
      }
    },
    draw() {
      const camX = 120 + Math.sin(time * 0.08) * 60;
      drawNightArt(art, time, camX, { moth: moth, houseLit: 1, starAlpha: 1.1, mistAlpha: 0.09, flyAlpha: 0.8 });
      const grad = ctx.createLinearGradient(0, 0, 0, VH);
      grad.addColorStop(0, 'rgba(3,5,10,0.32)');
      grad.addColorStop(0.45, 'rgba(3,5,10,0.42)');
      grad.addColorStop(1, 'rgba(3,5,10,0.78)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, VW, VH);
      const text = done ? lines[lines.length - 1] : lines[lineIndex];
      let alpha = 1;
      if (!done) {
        alpha = clamp(lineAge / 0.9, 0, 1) * clamp((4.6 - lineAge) / 0.8, 0, 1);
      } else {
        alpha = clamp(1 - doneT / 1.2, 0, 1);
      }
      ctx.save();
      ctx.globalAlpha = easeInOutCubic(alpha);
      setFont(31, SERIF, '400', true);
      ctx.textAlign = 'center';
      ctx.fillStyle = '#f2e8d5';
      ctx.shadowColor = 'rgba(255,174,83,0.18)';
      ctx.shadowBlur = 20;
      const wrap = wrapLines(text, 940, ctx.font);
      const lineH = 46;
      const startY = 420 - (wrap.length - 1) * lineH * 0.5;
      wrap.forEach((l, i) => ctx.fillText(l, VW / 2, startY + i * lineH));
      ctx.restore();
      if (!done && lineAge > 0.9) {
        drawSpaced('SPACE', VW / 2, 604, { size: 9, spacing: 3, align: 'center', color: 'rgba(240,228,205,0.3)' });
      }
      if (lineIndex === 0 && time < 8) {
        drawSpaced('A LONG TIME AGO, AT THE EDGE OF THE WOODS', VW / 2, 250, { size: 10, spacing: 4.5, align: 'center', color: 'rgba(241,226,198,0.38)' });
      }
      drawMuteBadge(ctx);
    }
  };
}

function makeMeadowScene() {
  const worldW = 5600;
  const cam = new Camera(worldW, VH);
  const moth = new Moth();
  const particles = new Particles(1500);
  const stars = new StarField(20241, 430, { height: 610, maxR: 2, bigRatio: 0.05, warmRatio: 0.33 });
  const cloudsFar = new CloudField(20242, 4, '#223a48', '#a7bcc8', { yMin: 80, yMax: 340, scaleMin: 0.6, scaleMax: 1.3, alphaMin: 0.2, alphaMax: 0.46, size: 800 });
  const cloudsNear = new CloudField(20243, 3, '#162832', '#8aa3b0', { yMin: 290, yMax: 520, scaleMin: 0.9, scaleMax: 1.5, alphaMin: 0.14, alphaMax: 0.3, size: 900 });
  const hills = [
    { p: 0.03, base: 560, amp: 28, amp2: 9, top: '#0e2130', mid: '#0a1823', bottom: '#071018', seed: 4.2, trees: true, treeStyle: 'round', treeColor: '#0a1a26', treeSpacing: 72, treeSize: 19, treeAlpha: 0.55 },
    { p: 0.075, base: 616, amp: 24, amp2: 8, top: '#091823', mid: '#06111a', bottom: '#040b11', seed: 9.3, trees: true, treeStyle: 'pine', treeColor: '#06131b', treeSpacing: 115, treeSize: 34, treeAlpha: 0.7 },
    { p: 0.15, base: 704, amp: 16, amp2: 5, top: '#060f16', mid: '#04090f', bottom: '#03050a', seed: 13.7, trees: false }
  ];
  const farGrass = new GrassField({ seed: 20244, left: -160, right: VW + 160, groundY: 710, count: 170, minH: 18, maxH: 62, minW: 0.7, maxW: 1.6, colors: ['#061018', '#07131a'], hiRatio: 0.05, hiColor: '#385b5c', sway: 2.5 });
  const fliesBack = new Fireflies(20245, 20, { yMin: 180, yMax: 690, sizeMin: 0.6, sizeMax: 1.7, color: ['#cfe8d8', '#ffe3a4', '#ffd494'] });
  const fliesFront = new Fireflies(20246, 10, { yMin: 240, yMax: 760, sizeMin: 1.1, sizeMax: 2.6, color: ['#ffe7a8', '#ffd18a'] });
  const midGrass = new GrassField({ seed: 20247, left: -120, right: worldW + 120, count: 1800, groundY: 810, groundJitter: 8, minH: 45, maxH: 165, minW: 0.8, maxW: 2.4, colors: ['#091920', '#08141b', '#071018', '#0a1c22'], lean: 0.34, sway: 4, hiRatio: 0.12, hiColor: '#547879' });
  const foreGrass = new GrassField({ seed: 20248, left: -120, right: worldW + 120, count: 360, groundY: 945, groundJitter: 12, minH: 110, maxH: 300, minW: 1.3, maxW: 4.2, colors: ['#02050a', '#010306', '#020408'], lean: 0.25, sway: 7, hiRatio: 0.05, hiColor: '#2d4b50' });
  const flowers = new FlowerField({ seed: 20249, left: -100, right: worldW + 100, count: 52, groundY: 810, minH: 50, maxH: 175, minSize: 2, maxSize: 5.5, colors: ['#d8eee2', '#ffe3ae', '#bfd3ea', '#e9d9f2'], glowMin: 0.22, maxSize: 6 });
  const demoMoth = new Moth();
  const dew = [
    { x: 850, y: 525, phase: 0.4, taken: false },
    { x: 1420, y: 430, phase: 1.9, taken: false },
    { x: 2120, y: 615, phase: 3.1, taken: false },
    { x: 2760, y: 398, phase: 5.2, taken: false },
    { x: 3460, y: 552, phase: 2.4, taken: false },
    { x: 4120, y: 452, phase: 4.7, taken: false },
    { x: 4740, y: 630, phase: 0.8, taken: false }
  ];
  const drafts = [
    { x: 1640, top: 300, width: 210, strength: 1400, spawnT: 0 },
    { x: 3120, top: 240, width: 230, strength: 1500, spawnT: 0.2 },
    { x: 4460, top: 330, width: 200, strength: 1350, spawnT: 0.4 }
  ];
  const webs = [
    { x: 2430, y: 585, w: 270, h: 200, wobble: 0, hit: false },
    { x: 3960, y: 520, w: 260, h: 190, wobble: 0, hit: false }
  ];
  const flowersTall = [
    { x: 640, h: 180 }, { x: 1870, h: 210 }, { x: 2630, h: 170 },
    { x: 3350, h: 240 }, { x: 4200, h: 190 }, { x: 5050, h: 220 }
  ];
  const flags = {};
  const trigger = (key, fn) => { if (!flags[key]) { flags[key] = true; fn(); } };
  let time = 0;
  let entry = 0;
  let sticky = 0;
  let boost = 0;
  let outro = null;
  let leaving = false;
  let tutorialMoved = false;

  function drawDew() {
    for (const d of dew) {
      if (d.taken) continue;
      const yy = d.y + Math.sin(time * 1.4 + d.phase) * 9;
      const pulse = 0.8 + Math.sin(time * 2.2 + d.phase) * 0.2;
      Glow.draw(ctx, d.x, yy, 50, '#ffe8ac', 0.26 * pulse);
      ctx.save();
      ctx.translate(d.x, yy);
      const g = ctx.createRadialGradient(-2, -2.5, 0, 0, 0, 8);
      g.addColorStop(0, '#fffdf2');
      g.addColorStop(0.45, '#ffe6b0');
      g.addColorStop(0.82, 'rgba(255,198,104,0.55)');
      g.addColorStop(1, 'rgba(255,190,80,0.05)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.ellipse(0, 0, 5.4, 7.6, 0, 0, TAU);
      ctx.fill();
      ctx.globalAlpha = 0.75;
      ctx.fillStyle = '#fffdf5';
      fillCircle(ctx, -1.8, -2.6, 1.25);
      ctx.restore();
    }
  }

  function drawDraft(d) {
    if (d.x < cam.left - 300 || d.x > cam.right + 300) return;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.translate(d.x, (d.top + 810) / 2);
    ctx.scale(0.42, 1);
    Glow.draw(ctx, 0, 0, 300, '#9fe7cf', 0.12);
    ctx.restore();
    for (let i = 0; i < 8; i++) {
      const p = fract(time * 0.16 + i * 0.127);
      const x = d.x + Math.sin(time * 0.9 + i * 2.1) * d.width * 0.24;
      const y = 800 - p * (800 - d.top);
      const a = Math.sin(p * Math.PI) * 0.3;
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = a;
      ctx.strokeStyle = '#b8f0dd';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.quadraticCurveTo(x + Math.sin(time + i) * 12, y - 22, x - 4, y - 44);
      ctx.stroke();
      ctx.restore();
    }
  }

  function drawWebs() {
    for (const w of webs) {
      if (w.x < cam.left - 350 || w.x > cam.right + 350) continue;
      const wob = w.wobble * 6;
      const cx = w.x;
      const cy = w.y + Math.sin(time * 1.3 + w.x) * 4;
      const rx = w.w / 2, ry = w.h / 2;
      ctx.save();
      ctx.strokeStyle = '#0b1b1c';
      ctx.lineCap = 'round';
      const stemL = cx - rx - 14, stemR = cx + rx + 8;
      for (const sx of [stemL, stemR]) {
        ctx.lineWidth = 4.5;
        ctx.strokeStyle = '#061115';
        ctx.beginPath();
        ctx.moveTo(sx, 810);
        ctx.quadraticCurveTo(sx + Math.sin(time * 0.7 + sx) * 10, cy + ry * 0.5, sx + Math.sin(time * 0.5 + sx) * 4, cy - ry * 0.7);
        ctx.stroke();
        ctx.lineWidth = 1;
        ctx.strokeStyle = 'rgba(96,138,134,0.3)';
        ctx.beginPath();
        ctx.moveTo(sx + 1.5, 808);
        ctx.quadraticCurveTo(sx + Math.sin(time * 0.7 + sx) * 10 + 1.5, cy + ry * 0.5, sx + Math.sin(time * 0.5 + sx) * 4 + 1.5, cy - ry * 0.7);
        ctx.stroke();
      }
      ctx.globalAlpha = 0.34;
      ctx.strokeStyle = 'rgba(190,222,218,0.7)';
      ctx.lineWidth = 0.7;
      for (let i = 0; i < 6; i++) {
        const a = i / 6 * TAU + 0.3;
        const ex = cx + Math.cos(a) * rx;
        const ey = cy + Math.sin(a) * ry;
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.quadraticCurveTo((cx + ex) / 2 + Math.sin(time * 12 + i) * wob, (cy + ey) / 2, ex, ey + Math.sin(time + i) * wob);
        ctx.stroke();
      }
      for (let ring = 1; ring <= 3; ring++) {
        const k = ring / 3.3;
        ctx.beginPath();
        ctx.ellipse(cx, cy, rx * k, ry * k, 0, 0, TAU);
        ctx.stroke();
      }
      for (let i = 0; i < 7; i++) {
        const a = fract(i * 0.618 + 0.2) * TAU;
        const k = 0.35 + fract(i * 0.37) * 0.6;
        const gx = cx + Math.cos(a) * rx * k;
        const gy = cy + Math.sin(a) * ry * k;
        Glow.draw(ctx, gx, gy, 6, '#dff3ec', 0.28 + 0.2 * Math.sin(time * 2 + i));
      }
      ctx.restore();
    }
  }

  function drawGround() {
    const x0 = cam.left - 200, x1 = cam.right + 200;
    const g = ctx.createLinearGradient(0, 790, 0, 930);
    g.addColorStop(0, '#0a1a1d');
    g.addColorStop(0.25, '#071214');
    g.addColorStop(1, '#020507');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(x0, 930);
    for (let x = x0; x <= x1; x += 22) {
      const y = 806 + Math.sin(x * 0.0021 + 1.2) * 7 + Math.sin(x * 0.0069 + 3.9) * 3;
      ctx.lineTo(x, y);
    }
    ctx.lineTo(x1, 930);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = 'rgba(126,170,158,0.08)';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    for (let x = x0; x <= x1; x += 22) {
      const y = 806 + Math.sin(x * 0.0021 + 1.2) * 7 + Math.sin(x * 0.0069 + 3.9) * 3;
      if (x === x0) ctx.moveTo(x, y + 1); else ctx.lineTo(x, y + 1);
    }
    ctx.stroke();
  }

  function drawBushes() {
    const bushes = [
      { x: 540, y: 818, h: 80, type: 'round' },
      { x: 1840, y: 818, h: 62, type: 'round' },
      { x: 3560, y: 818, h: 90, type: 'pine' },
      { x: 4820, y: 818, h: 74, type: 'round' },
      { x: 5360, y: 818, h: 100, type: 'pine' }
    ];
    for (const b of bushes) {
      if (b.x < cam.left - 200 || b.x > cam.right + 200) continue;
      ctx.save();
      ctx.globalAlpha = 0.9;
      if (b.type === 'pine') drawPine(b.x, b.y, b.h, '#041014', 1);
      else drawRoundTree(b.x, b.y, b.h, '#041014', 1);
      ctx.restore();
    }
  }

  return {
    name: 'meadow',
    enter() {
      Captions.clear();
      particles.clear();
      Sound.setAct('meadow');
      Sound.setRain(0);
      Sound.setWind(0.1);
      Sound.setCity(0);
      Sound.setRoom(0.04);
      moth.reset(260, 560);
      cam.zoom = 1;
      cam.snap(820, 450);
      time = 0;
      entry = 0;
      sticky = 0;
      boost = 0;
      outro = null;
      leaving = false;
      for (const key in flags) delete flags[key];
      for (const d of dew) d.taken = false;
      for (const w of webs) { w.hit = false; w.wobble = 0; }
    },
    update(dt) {
      time += dt;
      entry += dt;
      Captions.update(dt);
      const wasMoving = moth.vx !== 0 || moth.vy !== 0;
      const env = {
        windX: Math.sin(time * 0.37) * 28 + Math.sin(time * 0.13 + 1.2) * 22,
        windY: 0,
        gravity: 150,
        forceX: 0,
        forceY: 0,
        camX: cam.cx
      };
      if (outro) {
        outro.t += dt;
        env.windX += 180 * smoothstep(0, 2, outro.t);
        Sound.setRain(Math.min(0.55, outro.t * 0.24));
        Sound.setWind(0.12 + Math.min(0.25, outro.t * 0.08));
        if (outro.t > 1.1 && !outro.flash) {
          outro.flash = true;
          cam.shake(0.65);
          setTimeout(() => Sound.sfx('thunder'), 550);
          Sound.sfx('bolt');
        }
        if (outro.t > 4.7 && !leaving) {
          leaving = true;
          Game.go('storm', {}, { duration: 1.9 });
        }
      }
      if (sticky > 0) {
        sticky -= dt;
        moth.vx *= 0.82;
        moth.vy *= 0.82;
        if (Math.random() < 0.3) {
          particles.add({ x: moth.x + rand(20, -20), y: moth.y + rand(20, -20), vx: rand(20, -20), vy: rand(10, -10), life: rand(0.8, 0.3), size: rand(1.4, 0.5), color: '#d9ede6', type: 'dot', alpha: 0.5, drag: 2 });
        }
      }
      for (const d of drafts) {
        if (Math.abs(moth.x - d.x) < d.width * 0.55 && moth.y > d.top && moth.y < 800) {
          env.forceY -= d.strength;
          env.windX += Math.sin(time * 2.1 + d.x) * 140;
        }
        d.spawnT -= dt;
        if (d.spawnT <= 0) {
          d.spawnT = 0.09;
          if (d.x > cam.left - 250 && d.x < cam.right + 250) {
            particles.add({
              x: d.x + rand(d.width * 0.3, -d.width * 0.3),
              y: 790 + rand(10, -20),
              vx: Math.sin(time + d.x) * 20,
              vy: rand(-230, -120),
              life: rand(2.6, 1.2), size: rand(1.8, 0.5),
              color: Math.random() < 0.3 ? '#e5f6dd' : '#a8e7d2',
              type: 'dot', drag: 0.5, alpha: rand(0.35, 0.12), swirl: 26, shrink: -0.4
            });
          }
        }
      }
      moth.update(dt, particles, env);
      moth.x = clamp(moth.x, 90, worldW - 90);
      if (moth.y > 776) {
        moth.y = 776;
        if (moth.vy > 80) {
          particles.burst(moth.x, 790, { count: 5, speed: 40, size: 1.3, color: '#8db8a8', life: 0.7, g: -40, alpha: 0.3 });
          Sound.sfx('flap', { pan: 0 });
        }
        moth.vy = Math.min(moth.vy, 0);
      }
      if (moth.y < 118) { moth.y = 118; moth.vy = Math.max(moth.vy, 0); }
      for (const d of dew) {
        if (d.taken) continue;
        if (dist(moth.x, moth.y, d.x, d.y) < 44) {
          d.taken = true;
          boost = 1;
          Sound.sfx('dew', { pan: (d.x - cam.cx) / 900 });
          particles.burst(d.x, d.y, { count: 20, speed: 180, color: ['#fff6d5', '#ffe1a0', '#bcebdd'], size: 2.4, life: 1.2, drag: 2, twinkle: 1 });
          particles.add({ x: d.x, y: d.y, size: 30, life: 0.7, color: '#ffe3a0', type: 'ring', alpha: 0.5 });
          cam.shake(0.08);
        }
      }
      boost = Math.max(0, boost - dt * 0.8);
      for (const w of webs) {
        w.wobble = Math.max(0, w.wobble - dt * 2);
        if (!w.hit && sticky <= 0 && Math.abs(moth.x - w.x) < w.w * 0.34 && Math.abs(moth.y - w.y) < w.h * 0.34) {
          w.hit = true;
          w.wobble = 1;
          sticky = 0.95;
          cam.shake(0.22);
          Sound.sfx('web', { pan: (w.x - cam.cx) / 900 });
          Captions.add('For a heartbeat, the web held her. Then it let go.', { dur: 4.4, size: 24 });
        }
      }
      if (!outro) {
        if (moth.x > 1050 && entry > 5) trigger('first', () => { Captions.add('The moon was very far. The lamp was closer.', { dur: 6 }); });
        if (moth.x > 2880) trigger('rain', () => { Captions.add('The meadow smelled of rain.', { dur: 5.5 }); });
        if (moth.x > 3760) trigger('call', () => { Captions.add('Some lights call. This one waited.', { dur: 5.5 }); Sound.playTheme({ instrument: 'glass', gain: 0.45, delay: 0.2 }); });
        if (moth.x > 4680) trigger('thunder', () => { Captions.add('Then the first thunder came from behind the hills.', { dur: 6 }); });
        if (moth.x > 5120) {
          outro = { t: 0, flash: false };
          cam.shake(0.12);
          Captions.add('The first drop landed on her wing.', { dur: 4.8, style: 'memory' });
          Sound.sfx('bolt');
          setTimeout(() => Sound.sfx('thunder'), 700);
          Sound.setRain(0.3);
        }
      }
      cam.follow(moth.x, moth.y, dt, {
        lookX: clamp(moth.vx * 0.34, -160, 160) + (outro ? 60 : 0),
        lookY: clamp(moth.vy * 0.12, -50, 50),
        smooth: 2.7
      });
      cam.update(dt, time);
      particles.update(dt);
      if (entry > 1 && entry < 10) {
        tutorialMoved = tutorialMoved || Input.left() || Input.right() || Input.up() || Input.downKey() || Input.flap();
      }
      if (moth.x > worldW - 160) { moth.x = worldW - 160; moth.vx = Math.min(moth.vx, 0); }
      if (moth.x < 60) { moth.x = 60; moth.vx = Math.max(moth.vx, 0); }
      Sound.setWind(0.08 + (outro ? 0.25 : 0));
    },
    moth,
    draw() {
      drawSky([[0, '#04060e'], [0.28, '#0a1126'], [0.52, '#112637'], [0.7, '#183741'], [0.8, '#102026'], [1, '#04070b']]);
      stars.draw(cam.cx, time, { parallax: 0.02, alpha: outro ? 0.5 : 1 });
      drawMoon(1180, 208, 108, time, { aura: true, alpha: outro ? 0.55 : 1 });
      cloudsFar.draw(cam.cx, time, { parallax: 0.05, alpha: 0.92 });
      drawHillLayer(cam.cx, time, hills[0]);
      drawHillLayer(cam.cx, time, hills[1]);
      const hx = 1320 - cam.cx * 0.045;
      if (hx > -250 && hx < VW + 250) {
        drawDistantHouse(hx, 688, 1 + cam.cx / 18000, time, { lit: outro ? 0.65 : 1 });
      }
      drawHillLayer(cam.cx, time, hills[2]);
      farGrass.draw(time, { left: -160, right: VW + 160, wind: 20 });
      drawMistBand(655, 90, '#6c939e', 0.06, time, cam.cx);
      cloudsNear.draw(cam.cx, time, { parallax: 0.11, alpha: 0.7 });
      fliesBack.draw(cam.cx, time, { parallax: 0.16, alpha: outro ? 0.4 : 1 });
      ctx.save();
      cam.apply(ctx);
      drawGround();
      drawBushes();
      midGrass.draw(time, { left: cam.left - 100, right: cam.right + 100, wind: 30 + (outro ? 280 : 0), hiColor: '#547879' });
      flowers.draw(time, { left: cam.left - 100, right: cam.right + 100, wind: 30 });
      for (const ft of flowersTall) {
        if (ft.x < cam.left - 80 || ft.x > cam.right + 80) continue;
        const sway = Math.sin(time * 1.1 + ft.x) * 8;
        ctx.save();
        ctx.strokeStyle = '#0a1d1c';
        ctx.lineWidth = 2.4;
        ctx.beginPath();
        ctx.moveTo(ft.x, 815);
        ctx.quadraticCurveTo(ft.x + sway * 0.4, 815 - ft.h * 0.6, ft.x + sway, 815 - ft.h);
        ctx.stroke();
        Glow.draw(ctx, ft.x + sway, 815 - ft.h, 48, '#f3e6b4', 0.25);
        ctx.fillStyle = 'rgba(243,230,180,0.52)';
        for (let p = 0; p < 6; p++) {
          const a = p / 6 * TAU + ft.x * 0.2;
          ctx.beginPath();
          ctx.ellipse(ft.x + sway + Math.cos(a) * 11, 815 - ft.h + Math.sin(a) * 11, 12, 6.2, a, 0, TAU);
          ctx.fill();
        }
        ctx.fillStyle = 'rgba(255,247,224,0.75)';
        fillCircle(ctx, ft.x + sway, 815 - ft.h, 4.6);
        ctx.restore();
      }
      for (const d of drafts) drawDraft(d);
      drawWebs();
      drawDew();
      particles.draw(ctx);
      moth.draw(ctx, time, { glow: 1 + boost * 0.8 });
      foreGrass.draw(time, { left: cam.left - 100, right: cam.right + 100, wind: 40 + (outro ? 240 : 0), hiColor: '#2d4b50' });
      if (outro) {
        const rain = smoothstep(0, 2.2, outro.t) * 0.82;
        drawRainWorld(cam, time, rain, [], { wind: 260 });
        if (outro.flash && outro.t < 1.45) {
          ctx.save();
          ctx.globalCompositeOperation = 'lighter';
          ctx.globalAlpha = Math.max(0, 0.5 - (outro.t - 1.1) * 1.2);
          ctx.fillStyle = '#cfe0ff';
          ctx.fillRect(cam.left - 100, cam.top - 100, VW + 200, VH + 200);
          ctx.restore();
        }
      }
      ctx.restore();
      fliesFront.draw(cam.cx, time, { parallax: 0.63, alpha: outro ? 0.25 : 0.9 });
      if (outro) {
        const dark = smoothstep(0, 2.8, outro.t) * 0.4;
        ctx.fillStyle = `rgba(2,4,9,${dark})`;
        ctx.fillRect(0, 0, VW, VH);
      }
      const objA = entry < 1 ? 0 : entry < 7 ? 1 : Math.max(0, 1 - (entry - 7) / 2);
      if (objA > 0) {
        ctx.save();
        ctx.globalAlpha = objA;
        drawSpaced('FOLLOW THE LIGHT', VW / 2, 68, { size: 11, spacing: 5, align: 'center', color: 'rgba(240,229,209,0.6)' });
        ctx.strokeStyle = 'rgba(240,229,209,0.16)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(VW / 2 - 110, 82);
        ctx.lineTo(VW / 2 - 46, 82);
        ctx.moveTo(VW / 2 + 46, 82);
        ctx.lineTo(VW / 2 + 110, 82);
        ctx.stroke();
        ctx.restore();
      }
      if (entry < 11) {
        const a = entry < 1.2 ? 0 : entry < 8 ? 0.8 : Math.max(0, (11 - entry) / 3) * 0.8;
        drawTutorialKeys(a);
      }
      drawControlsHint(ctx, entry > 1 ? Math.max(0, 1 - (entry - 10) / 3) * 0.9 : 0, 'M  MUTE      ESC  PAUSE');
      drawChapterCard(ctx, entry, 0.5, 'I', 'The Meadow', 'the world is wider than the porch light');
      Captions.draw(ctx);
      drawMuteBadge(ctx);
      if (DEBUG) drawDebugOverlay('meadow');
    }
  };
}

function makeStormScene() {
  const worldW = 6800;
  const cam = new Camera(worldW, VH);
  const moth = new Moth();
  const particles = new Particles(1600);
  const stars = new StarField(31001, 200, { height: 470, maxR: 1.5, bigRatio: 0.02 });
  const cloudsFar = new CloudField(31002, 6, '#16242f', '#546a78', { yMin: 10, yMax: 270, scaleMin: 0.8, scaleMax: 1.6, alphaMin: 0.5, alphaMax: 0.9, size: 940 });
  const cloudsNear = new CloudField(31003, 5, '#101d27', '#3b5262', { yMin: 140, yMax: 410, scaleMin: 1.0, scaleMax: 1.8, alphaMin: 0.45, alphaMax: 0.8, size: 1020 });
  const hills = [
    { p: 0.03, base: 540, amp: 30, amp2: 10, top: '#0b1720', mid: '#071019', bottom: '#04090e', seed: 6.2, trees: true, treeStyle: 'pine', treeColor: '#07131b', treeSpacing: 88, treeSize: 42, treeAlpha: 0.7 },
    { p: 0.08, base: 614, amp: 26, amp2: 9, top: '#08121a', mid: '#050d13', bottom: '#03070b', seed: 10.8, trees: true, treeStyle: 'pine', treeColor: '#051018', treeSpacing: 140, treeSize: 58, treeAlpha: 0.8 },
    { p: 0.17, base: 712, amp: 16, amp2: 5, top: '#050c12', mid: '#03080d', bottom: '#020409', seed: 15.1, trees: false }
  ];
  const farGrass = new GrassField({ seed: 31004, left: -200, right: VW + 200, groundY: 718, count: 190, minH: 20, maxH: 72, minW: 0.7, maxW: 1.7, colors: ['#050d12', '#071018'], hiRatio: 0.06, hiColor: '#3a5b5c', sway: 5 });
  const midGrass = new GrassField({ seed: 31005, left: -150, right: worldW + 150, count: 2100, groundY: 812, groundJitter: 10, minH: 50, maxH: 175, minW: 0.9, maxW: 2.8, colors: ['#061215', '#071519', '#050f13'], lean: 0.55, sway: 10, hiRatio: 0.12, hiColor: '#4f7774' });
  const foreGrass = new GrassField({ seed: 31006, left: -150, right: worldW + 150, count: 430, groundY: 948, groundJitter: 12, minH: 120, maxH: 320, minW: 1.4, maxW: 4.5, colors: ['#010405', '#020607', '#010304'], lean: 0.42, sway: 15, hiRatio: 0.06, hiColor: '#2a4246' });
  const shelters = [
    { x: 1160, y: 505, r: 205, visited: false, seed: 2 },
    { x: 2570, y: 586, r: 200, visited: false, seed: 5 },
    { x: 3980, y: 448, r: 210, visited: false, seed: 8 },
    { x: 5390, y: 566, r: 200, visited: false, seed: 11 }
  ];
  const motes = [
    { x: 1780, y: 480 }, { x: 2140, y: 610 }, { x: 3150, y: 360 },
    { x: 4520, y: 570 }, { x: 4850, y: 390 }, { x: 5960, y: 510 }
  ].map(m => Object.assign(m, { taken: false, phase: rand(TAU) }));
  const puddles = [
    { x: 760, w: 160 }, { x: 1850, w: 220 }, { x: 3260, w: 180 },
    { x: 4650, w: 240 }, { x: 5850, w: 200 }, { x: 6400, w: 150 }
  ];
  const flags = {};
  const trigger = (key, fn) => { if (!flags[key]) { flags[key] = true; fn(); } };
  let time = 0, entry = 0;
  let warmth = 100;
  let invuln = 0;
  let faint = null;
  let strike = null;
  let nextStrike = 0;
  let ambient = null;
  let nextAmbient = 0;
  let flash = 0;
  let outro = null;
  let leaving = false;
  let checkpoint = { x: 260, y: 545 };
  let currentShelter = -1;
  let sheltered = false;
  let soundRain = -1;
  let lastLow = false;

  function drawShelter(sh) {
    if (sh.x < cam.left - 450 || sh.x > cam.right + 450) return;
    const cx = sh.x;
    const ground = 812;
    const sway = Math.sin(time * 0.8 + sh.seed) * 7;
    ctx.save();
    const warm = 0.2 + 0.05 * Math.sin(time * 1.3 + sh.seed);
    Glow.draw(ctx, cx, 770, 300, '#ffb45e', warm * 0.7);
    Glow.draw(ctx, cx, 775, 165, '#ffbd6b', warm);
    Glow.draw(ctx, cx, 786, 80, '#ffd69a', warm * 1.5);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const cone = ctx.createLinearGradient(0, sh.y - 110, 0, 820);
    cone.addColorStop(0, 'rgba(255,186,106,0.11)');
    cone.addColorStop(0.65, 'rgba(255,170,84,0.05)');
    cone.addColorStop(1, 'rgba(255,150,70,0)');
    ctx.fillStyle = cone;
    ctx.beginPath();
    ctx.moveTo(cx - 130, sh.y - 110);
    ctx.lineTo(cx + 130, sh.y - 110);
    ctx.lineTo(cx + 290, 822);
    ctx.lineTo(cx - 290, 822);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    ctx.strokeStyle = '#061012';
    ctx.lineWidth = 14;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(cx - 330, ground + 8);
    ctx.quadraticCurveTo(cx - 260, 430, cx - 150, 310);
    ctx.stroke();
    ctx.lineWidth = 3;
    ctx.strokeStyle = 'rgba(84,120,112,0.18)';
    ctx.beginPath();
    ctx.moveTo(cx - 327, ground);
    ctx.quadraticCurveTo(cx - 257, 432, cx - 148, 314);
    ctx.stroke();
    const topY = sh.y - 235;
    const leftX = cx - 335 + sway;
    const rightX = cx + 350 + sway;
    const leaf = ctx.createLinearGradient(0, topY - 40, 0, sh.y + 30);
    leaf.addColorStop(0, '#0e2925');
    leaf.addColorStop(0.45, '#0a1f1c');
    leaf.addColorStop(1, '#05100e');
    ctx.fillStyle = leaf;
    ctx.beginPath();
    ctx.moveTo(leftX, sh.y - 70);
    ctx.bezierCurveTo(leftX + 60, topY - 90, cx + 120, topY - 70, rightX, sh.y - 120);
    ctx.bezierCurveTo(cx + 190, sh.y - 30, cx - 160, sh.y + 30, leftX, sh.y - 70);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = 'rgba(18,48,42,0.55)';
    ctx.beginPath();
    ctx.moveTo(leftX + 20, sh.y - 88);
    ctx.bezierCurveTo(leftX + 90, topY - 62, cx + 110, topY - 45, rightX - 10, sh.y - 145);
    ctx.bezierCurveTo(cx + 170, sh.y - 90, cx - 110, sh.y - 40, leftX + 20, sh.y - 88);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = 'rgba(126,181,154,0.18)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(leftX + 8, sh.y - 72);
    ctx.bezierCurveTo(leftX + 90, topY - 52, cx + 120, topY - 54, rightX - 8, sh.y - 128);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(110,164,138,0.13)';
    ctx.lineWidth = 1;
    for (let i = 0; i < 9; i++) {
      const t = i / 9;
      const bx = lerp(leftX + 40, rightX - 40, t) + sway * 0.4;
      const by = sh.y - 78 - Math.sin(t * Math.PI) * 96;
      ctx.beginPath();
      ctx.moveTo(cx + sway, sh.y - 150);
      ctx.quadraticCurveTo(lerp(cx, bx, 0.5), by - 20, bx, by);
      ctx.stroke();
    }
    for (let i = 0; i < 3; i++) {
      const dx = cx - 220 + i * 200 + Math.sin(time + i) * 4;
      const dy = sh.y - 18 + i * 10;
      const drip = fract(time * 0.24 + i * 0.33);
      ctx.globalAlpha = 0.35 * (1 - drip);
      ctx.strokeStyle = '#a9c7c6';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(dx, dy);
      ctx.lineTo(dx - 2, dy + 16 + drip * 30);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
    for (let i = 0; i < 3; i++) {
      const mx = cx - 54 + i * 48 + Math.sin(time * 0.9 + i) * 3;
      const my = ground - 8;
      Glow.draw(ctx, mx, my - 12, 42, '#ffd190', 0.46);
      ctx.fillStyle = '#d8a86c';
      ctx.beginPath();
      ctx.ellipse(mx, my - 12, 7 + i * 2, 4 + i * 1.3, 0, Math.PI, TAU);
      ctx.fill();
      ctx.fillStyle = '#ffe4b3';
      ctx.globalAlpha = 0.55;
      ctx.beginPath();
      ctx.ellipse(mx - 1, my - 13, 3 + i, 1.4, 0.2, Math.PI, TAU);
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.fillStyle = '#5e4b38';
      ctx.fillRect(mx - 1, my - 9, 2, 9);
    }
    ctx.globalCompositeOperation = 'lighter';
    const haze = ctx.createRadialGradient(cx, sh.y + 40, 20, cx, sh.y + 40, sh.r * 1.15);
    haze.addColorStop(0, `rgba(255,184,98,${0.055 + 0.02 * Math.sin(time * 1.2)})`);
    haze.addColorStop(1, 'rgba(255,184,98,0)');
    ctx.fillStyle = haze;
    ctx.beginPath();
    ctx.ellipse(cx, sh.y + 60, sh.r, sh.r * 0.9, 0, 0, TAU);
    ctx.fill();
    ctx.restore();
  }

  function drawMote(m) {
    if (m.taken) return;
    const yy = m.y + Math.sin(time * 1.6 + m.phase) * 11;
    const pulse = 0.7 + 0.3 * Math.sin(time * 2.3 + m.phase);
    Glow.draw(ctx, m.x, yy, 58, '#ffdb8f', 0.34 * pulse);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = 0.8;
    ctx.fillStyle = '#fff2cc';
    fillCircle(ctx, m.x, yy, 2.6);
    ctx.restore();
  }

  function drawPuddles() {
    for (const p of puddles) {
      if (p.x < cam.left - 250 || p.x > cam.right + 250) continue;
      ctx.save();
      ctx.globalAlpha = 0.35;
      const g = ctx.createLinearGradient(p.x - p.w / 2, 0, p.x + p.w / 2, 0);
      g.addColorStop(0, 'rgba(70,96,108,0)');
      g.addColorStop(0.5, 'rgba(103,137,148,0.4)');
      g.addColorStop(1, 'rgba(70,96,108,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.ellipse(p.x, 812, p.w / 2, 7, 0, 0, TAU);
      ctx.fill();
      for (let i = 0; i < 3; i++) {
        const r = fract(time * 0.35 + i * 0.33 + p.x * 0.01);
        ctx.strokeStyle = `rgba(160,198,205,${0.16 * (1 - r)})`;
        ctx.lineWidth = 0.8;
        ctx.beginPath();
        ctx.ellipse(p.x + Math.sin(i * 4 + p.x) * 20, 812, 8 + r * p.w * 0.22, 1.5 + r * 3, 0, 0, TAU);
        ctx.stroke();
      }
      ctx.restore();
    }
  }

  function startFaint() {
    faint = { t: 0 };
    moth.frozen = true;
    strike = null;
    nextStrike = time + 3;
    Sound.setHeart(false);
    Sound.sfx('hurt');
    Captions.add('The dark leaned close.', { dur: 3.2, style: 'memory' });
    cam.shake(0.25);
  }

  function respawn() {
    moth.frozen = false;
    moth.reset(checkpoint.x, checkpoint.y);
    moth.glow = 0.5;
    warmth = 64;
    faint = null;
    invuln = 2.2;
    cam.snap(checkpoint.x, checkpoint.y);
    Sound.sfx('respawn');
    particles.burst(checkpoint.x, checkpoint.y, { count: 28, speed: 190, color: ['#ffd9a0', '#ffb763', '#fff2d2'], size: 2.2, life: 1.4, drag: 1.7, twinkle: 1 });
    Captions.add('A little light, deciding to stay lit.', { dur: 3.8 });
  }

  return {
    name: 'storm',
    moth,
    get state() { return { warmth, sheltered, currentShelter, faint: !!faint, strike, invuln, checkpoint, time, outro: !!outro, leaving, paused: Game.paused }; },
    enter() {
      Captions.clear();
      particles.clear();
      Sound.setAct('storm');
      Sound.setRain(0.34);
      Sound.setWind(0.22);
      Sound.setCity(0);
      Sound.setRoom(0);
      Sound.setHeart(false);
      moth.reset(260, 545);
      cam.snap(800, 450);
      warmth = 100;
      invuln = 0;
      faint = null;
      strike = null;
      ambient = null;
      flash = 0;
      outro = null;
      leaving = false;
      checkpoint = { x: 260, y: 545 };
      currentShelter = -1;
      sheltered = false;
      nextStrike = 7;
      nextAmbient = 3.2;
      soundRain = -1;
      for (const key in flags) delete flags[key];
      for (const sh of shelters) sh.visited = false;
      for (const m of motes) m.taken = false;
      time = 0;
      entry = 0;
    },
    update(dt) {
      time += dt;
      entry += dt;
      Captions.update(dt);
      invuln = Math.max(0, invuln - dt);
      flash = Math.max(0, flash - dt * 2.6);
      if (entry < 2 && !outro) warmth = Math.min(100, warmth + 20 * dt);
      sheltered = false;
      currentShelter = -1;
      if (!outro && !faint) {
        for (let i = 0; i < shelters.length; i++) {
          if (dist(moth.x, moth.y, shelters[i].x, shelters[i].y) < shelters[i].r) {
            sheltered = true;
            currentShelter = i;
            const sh = shelters[i];
            if (!sh.visited) {
              sh.visited = true;
              checkpoint = { x: sh.x, y: sh.y };
              Sound.sfx('shelter');
              cam.shake(0.04);
              trigger('firstShelter', () => Captions.add('Under the leaves, the rain cannot find you.', { dur: 5 }));
              particles.burst(sh.x, sh.y + 100, { count: 22, speed: 120, color: ['#ffd08a', '#ffb45e', '#cfe8d8'], size: 2, life: 1.8, g: -20, drag: 1.3, twinkle: 1 });
            }
            break;
          }
        }
      }
      if (!outro && !faint) {
        if (sheltered) warmth = Math.min(100, warmth + 34 * dt);
        else if (entry > 2) warmth = Math.max(0, warmth - 5.4 * dt);
      }
      if (warmth <= 0 && !faint && !outro) startFaint();
      if (faint) {
        faint.t += dt;
        moth.frozen = true;
        if (faint.t > 2.0) respawn();
        cam.follow(moth.x, moth.y, dt, { lookX: 0, lookY: 0, smooth: 1.2 });
        cam.update(dt, time);
        particles.update(dt);
        return;
      }
      const gustPhase = Math.sin(time * 0.27 + 0.6);
      const gust = gustPhase > 0.35 ? Math.pow((gustPhase - 0.35) / 0.65, 2) * 300 : 0;
      const env = {
        windX: 55 + Math.sin(time * 0.53) * 70 + Math.sin(time * 0.19 + 2) * 30 + gust + (outro ? -40 : 0),
        windY: Math.sin(time * 0.71) * 22,
        gravity: 165,
        drag: 2.0,
        camX: cam.cx
      };
      moth.update(dt, particles, env);
      moth.x = clamp(moth.x, 80, worldW - 100);
      moth.y = clamp(moth.y, 118, 776);
      if (moth.y >= 776) moth.vy = Math.min(moth.vy, 0);
      if (moth.y <= 118) moth.vy = Math.max(moth.vy, 0);
      if (moth.x >= worldW - 100) moth.vx = Math.min(moth.vx, 0);
      if (moth.x <= 80) moth.vx = Math.max(moth.vx, 0);

      for (const m of motes) {
        if (m.taken) continue;
        if (dist(moth.x, moth.y, m.x, m.y) < 48 && !outro) {
          m.taken = true;
          warmth = Math.min(100, warmth + 18);
          Sound.sfx('dew', { pan: (m.x - cam.cx) / 900 });
          particles.burst(m.x, m.y, { count: 16, speed: 150, color: ['#fff0c8', '#ffce85', '#cfe8d8'], size: 2.2, life: 1.2, drag: 1.8, twinkle: 1 });
        }
      }

      if (!outro) {
        if (entry > 5.2) trigger('intro', () => Captions.add('The storm had no manners.', { dur: 4.6 }));
        if (moth.x > 3200) trigger('mid', () => Captions.add('Every little light is a stubborn thing.', { dur: 5.2 }));
        if (moth.x > 4950) trigger('town', () => Captions.add('And then, over the valley: a town of small, brave lights.', { dur: 6 }));
      }

      if (!outro && !sheltered && entry > 7 && !strike) {
        if (time > nextStrike) {
          strike = { x: moth.x, y: moth.y, t: 0, phase: 'warn', seed: randInt(1, 99999), hit: false };
          Sound.sfx('charge');
          trigger('firstBolt', () => Captions.add('The lightning was looking for her.', { dur: 4.4 }));
        }
      }
      if (strike) {
        strike.t += dt;
        if (strike.phase === 'warn' && strike.t >= 1.08) {
          strike.phase = 'strike';
          flash = 1;
          cam.shake(0.7);
          Sound.sfx('bolt');
          setTimeout(() => { if (Game.scene === this) Sound.sfx('thunder'); }, 400);
          if (dist(moth.x, moth.y, strike.x, strike.y) < 118 && invuln <= 0 && !sheltered) {
            strike.hit = true;
            warmth = Math.max(0, warmth - 26);
            invuln = 1.5;
            const kx = moth.x - strike.x;
            moth.vx += (Math.abs(kx) < 10 ? 1 : sign(kx)) * 320;
            moth.vy -= 130;
            cam.shake(0.5);
            Sound.sfx('hurt');
            particles.burst(moth.x, moth.y, { count: 26, speed: 260, color: ['#cfe0ff', '#ffffff', '#ffb45e'], size: 2.4, life: 1.1, drag: 1.6, twinkle: 1 });
          }
        }
        if (strike.t > 1.7) {
          strike = null;
          nextStrike = time + rand(6.5, 9.5);
        }
      }

      if (!outro) {
        if (time > nextAmbient) {
          nextAmbient = time + rand(5, 9.5);
          ambient = { x: cam.cx + rand(760, -640), t: 0, seed: randInt(1, 99999) };
          setTimeout(() => { if (Game.scene === this) Sound.sfx('thunder'); }, 700);
        }
      }
      if (ambient) {
        ambient.t += dt;
        if (ambient.t < 0.35) flash = Math.max(flash, 0.22);
        if (ambient.t > 0.6) ambient = null;
      }

      if (moth.x > 6100 && !outro) {
        outro = { t: 0 };
        strike = null;
        warmth = 100;
        Sound.setHeart(false);
        Captions.add('The storm let go of the sky.', { dur: 5.4, style: 'memory' });
        Sound.playTheme({ instrument: 'glass', gain: 0.55, delay: 0.4 });
        Sound.setRain(0.22);
        Sound.setWind(0.12);
      }
      if (outro) {
        outro.t += dt;
        flash = Math.max(0, flash);
        if (outro.t > 5.4 && !leaving) {
          leaving = true;
          Game.go('town', {}, { duration: 2.1 });
        }
      }
      const targetRain = sheltered && !outro ? 0.12 : outro ? 0.12 : 0.34;
      if (Math.abs(targetRain - soundRain) > 0.04) {
        soundRain = targetRain;
        Sound.setRain(targetRain);
      }
      const low = warmth < 30 && !outro;
      if (low !== lastLow) {
        lastLow = low;
        if (low) {
          Sound.setHeart(true, warmth < 15 ? 0.7 : 1.05);
          trigger('low', () => Captions.add('Her light was thinning.', { dur: 3.6 }));
        } else Sound.setHeart(false);
      }
      if (sheltered) {
        Sound.setWind(0.18);
      } else if (!outro) Sound.setWind(0.3);

      cam.follow(moth.x, moth.y, dt, {
        lookX: clamp(moth.vx * 0.32, -150, 150) + (outro ? 130 : 0),
        lookY: clamp(moth.vy * 0.1, -40, 40),
        smooth: 2.8
      });
      cam.update(dt, time);
      particles.update(dt);

      if (Math.random() < dt * 7) {
        particles.add({
          x: moth.x + rand(30, -30), y: moth.y + rand(40, -10),
          vx: rand(20, -20), vy: rand(60, 20),
          life: rand(0.6, 0.25), size: rand(1.4, 0.5), color: '#a8cfd0', type: 'dot', drag: 1, alpha: 0.25
        });
      }
      for (const sh of shelters) {
        if (Math.random() < dt * 2.2) {
          particles.add({
            x: sh.x + rand(300, -300), y: sh.y - 60 + rand(40, -40),
            vx: rand(15, -15), vy: rand(80, 20), g: 260,
            life: rand(1.2, 0.5), size: rand(1.6, 0.6), color: '#a9cfd2', type: 'dot', drag: 0.2, alpha: 0.3
          });
        }
      }
    },
    draw(ctx) {
      const stormAlpha = outro ? 1 - smoothstep(0, 3.5, outro.t) * 0.75 : 1;
      drawSky([[0, '#03060b'], [0.28, '#081520'], [0.54, '#0d1f2a'], [0.74, '#10232c'], [0.88, '#0b181f'], [1, '#030508']]);
      stars.draw(cam.cx, time, { parallax: 0.015, alpha: 0.22 * stormAlpha });
      cloudsFar.draw(cam.cx, time, { parallax: 0.06, alpha: 1, drift: 9 });
      drawHillLayer(cam.cx, time, hills[0]);
      drawHillLayer(cam.cx, time, hills[1]);
      drawMistBand(620, 120, '#56747c', 0.075, time, cam.cx);
      drawHillLayer(cam.cx, time, hills[2]);
      farGrass.draw(time, { left: -200, right: VW + 200, wind: 300 });
      cloudsNear.draw(cam.cx, time, { parallax: 0.14, alpha: 0.68 * (0.4 + 0.6 * stormAlpha), drift: 15 });
      if (ambient && ambient.t < 0.4) {
        const a = 1 - ambient.t / 0.4;
        drawBolt(((ambient.x - cam.cx * 0.18) % VW + VW) % VW, 40, 540, ambient.seed, a * 0.28, 1.4);
      }
      ctx.save();
      cam.apply(ctx);
      const x0 = cam.left - 200, x1 = cam.right + 200;
      const g = ctx.createLinearGradient(0, 790, 0, 940);
      g.addColorStop(0, '#0b181b');
      g.addColorStop(0.35, '#061013');
      g.addColorStop(1, '#020407');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(x0, 940);
      for (let x = x0; x <= x1; x += 22) {
        const y = 806 + Math.sin(x * 0.0023 + 0.7) * 8 + Math.sin(x * 0.0071 + 2.4) * 3;
        ctx.lineTo(x, y);
      }
      ctx.lineTo(x1, 940);
      ctx.closePath();
      ctx.fill();
      drawPuddles();
      midGrass.draw(time, { left: cam.left - 100, right: cam.right + 100, wind: 500, hiColor: '#4f7774' });
      for (const sh of shelters) drawShelter(sh);
      for (const m of motes) drawMote(m);
      particles.draw(ctx);
      const glowScale = 0.38 + 0.62 * (warmth / 100);
      moth.draw(ctx, time, { glow: glowScale * (outro ? 1 : 1.05) });
      foreGrass.draw(time, { left: cam.left - 100, right: cam.right + 100, wind: 600, hiColor: '#2a4246' });
      if (strike) {
        const sx = strike.x, sy = strike.y;
        if (strike.phase === 'warn') {
          const p = clamp(strike.t / 1.08, 0, 1);
          const gp = ctx.createLinearGradient(0, cam.top - 100, 0, sy);
          gp.addColorStop(0, `rgba(170,205,255,${0.08 + p * 0.12})`);
          gp.addColorStop(1, `rgba(210,230,255,${0.24 + p * 0.26})`);
          ctx.fillStyle = gp;
          ctx.fillRect(sx - 5 - p * 16, cam.top - 100, 10 + p * 32, sy - cam.top + 100);
          ctx.save();
          ctx.setLineDash([10, 12]);
          ctx.lineDashOffset = -time * 70;
          ctx.strokeStyle = `rgba(200,225,255,${0.6 + p * 0.35})`;
          ctx.lineWidth = 2.2;
          ctx.beginPath();
          ctx.arc(sx, sy, 118, 0, TAU);
          ctx.stroke();
          ctx.setLineDash([]);
          ctx.globalCompositeOperation = 'lighter';
          Glow.draw(ctx, sx, sy, 105, '#bcd6ff', 0.18 + p * 0.22);
          for (let i = 0; i < 5; i++) {
            const a = time * 3 + i * 1.7;
            const rr = 40 + p * 70;
            ctx.strokeStyle = `rgba(190,220,255,${0.2 + p * 0.3})`;
            ctx.lineWidth = 0.8;
            ctx.beginPath();
            ctx.moveTo(sx + Math.cos(a) * rr, sy + Math.sin(a) * rr * 0.4);
            ctx.lineTo(sx + Math.cos(a + 0.4) * (rr + 12), sy + Math.sin(a + 0.4) * (rr + 8) * 0.4);
            ctx.stroke();
          }
          ctx.restore();
        } else {
          const a = Math.max(0, 1 - (strike.t - 1.08) / 0.55);
          drawBolt(sx, cam.top - 200, sy, strike.seed, a, 3.4);
          ctx.save();
          ctx.globalCompositeOperation = 'lighter';
          Glow.draw(ctx, sx, sy, 130, '#d9e8ff', a * 0.55);
          const r = 30 + easeOutCubic(clamp((strike.t - 1.08) / 0.5, 0, 1)) * 280;
          ctx.strokeStyle = `rgba(200,225,255,${a * 0.5})`;
          ctx.lineWidth = 2 * a;
          ctx.beginPath();
          ctx.arc(sx, sy, r, 0, TAU);
          ctx.stroke();
          ctx.restore();
        }
      }
      if (faint) {
        const k = clamp(faint.t / 2, 0, 1);
        ctx.fillStyle = `rgba(2,4,9,${k * 0.82})`;
        ctx.fillRect(cam.left - 100, cam.top - 100, VW + 200, VH + 200);
        Glow.draw(ctx, moth.x, moth.y, 160 * (1 - k * 0.7), '#ffaf53', (1 - k) * 0.3);
      }
      ctx.restore();
      drawRainWorld(cam, time, outro ? 0.18 : 0.92, shelters, { wind: 330 });
      if (outro) {
        const k = smoothstep(0, 3.2, outro.t);
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        const townGlow = ctx.createLinearGradient(VW * 0.55, 0, VW, 0);
        townGlow.addColorStop(0, 'rgba(255,190,110,0)');
        townGlow.addColorStop(1, `rgba(255,180,100,${0.06 * k})`);
        ctx.fillStyle = townGlow;
        ctx.fillRect(VW * 0.55, 600, VW * 0.45, 300);
        for (let i = 0; i < 34; i++) {
          const x = VW * 0.66 + fract(i * 0.618) * 520;
          const y = 600 + fract(i * 0.371) * 140;
          const a = k * (0.2 + 0.6 * fract(i * 0.73)) * (0.7 + 0.3 * Math.sin(time * 1.4 + i));
          Glow.draw(ctx, x, y, 12 + fract(i * 0.91) * 24, i % 3 === 0 ? '#ffd28c' : '#ffad5f', a * 0.45);
        }
        ctx.restore();
        drawMistBand(650, 140, '#8fb6bc', 0.06 * k, time, cam.cx);
      }
      if (flash > 0.01) {
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = flash * 0.4;
        ctx.fillStyle = '#bcd4ff';
        ctx.fillRect(0, 0, VW, VH);
        ctx.restore();
      }
      if (!outro) {
        const low = 1 - warmth / 100;
        if (low > 0.55) {
          ctx.fillStyle = `rgba(2,4,9,${(low - 0.55) * 0.5})`;
          ctx.fillRect(0, 0, VW, VH);
        }
      }
      if (!outro) {
        drawMeter(ctx, VW - 306, 82, 238, 'LIGHT', warmth, '#ffc46b', { warn: warmth < 30, alpha: 0.92 });
        if (sheltered) {
          const pulse = 0.55 + 0.25 * Math.sin(time * 2.2);
          drawSpaced('SHELTERED', VW - 68, 106, { size: 9, spacing: 3.4, align: 'right', color: 'rgba(198,231,204,0.72)', alpha: pulse });
        }
      }
      const objA = entry < 1 ? 0 : entry < 8 ? 1 : Math.max(0, 1 - (entry - 8) / 2);
      if (objA > 0) {
        drawSpaced('KEEP THE LIGHT · REACH THE TOWN', VW / 2, 68, { size: 11, spacing: 4, align: 'center', color: 'rgba(240,229,209,0.58)', alpha: objA });
      }
      drawControlsHint(ctx, entry > 2 ? Math.max(0, 1 - (entry - 12) / 3) * 0.8 : 0, 'M  MUTE      ESC  PAUSE');
      drawChapterCard(ctx, entry, 0.5, 'II', 'The Storm', 'the night does not make it easy');
      Captions.draw(ctx);
      drawMuteBadge(ctx);
      if (DEBUG) drawDebugOverlay('storm');
    }
  };
}

function makeTownScene() {
  const worldW = 7000;
  const cam = new Camera(worldW, VH);
  const moth = new Moth();
  const particles = new Particles(1500);
  const stars = new StarField(52001, 260, { height: 560, maxR: 1.8, bigRatio: 0.035 });
  const clouds = new CloudField(52002, 4, '#162534', '#7d94a3', { yMin: 60, yMax: 300, scaleMin: 0.7, scaleMax: 1.4, alphaMin: 0.16, alphaMax: 0.34, size: 900 });
  const farSkyline = (() => {
    const rng = mulberry32(52003);
    const arr = [];
    let x = -200;
    while (x < VW + 600) {
      const w = 50 + rng() * 110;
      const h = 30 + rng() * 120;
      const wins = [];
      for (let i = 0; i < 5; i++) if (rng() < 0.26) wins.push({ x: rng() * w, y: rng() * h, s: 1 + rng() * 1.5, warm: rng() < 0.7 });
      arr.push({ x, w, h, wins, roof: rng() < 0.4 });
      x += w + 4 + rng() * 36;
    }
    return { arr, span: VW + 800 };
  })();
  const houses = [];
  {
    const rng = mulberry32(52004);
    let hx = -260;
    while (hx < 5850) {
      const w = 210 + rng() * 260;
      const h = 170 + rng() * 280;
      const top = 842 - h;
      const wins = [];
      const cols = Math.max(1, Math.floor((w - 44) / 66));
      const rows = Math.max(1, Math.floor((h - 44) / 78));
      for (let c = 0; c < cols; c++) {
        for (let r = 0; r < rows; r++) {
          if (rng() < 0.6) continue;
          wins.push({
            x: hx + 30 + c * 66, y: top + 34 + r * 78,
            w: 24 + rng() * 8, h: 28 + rng() * 8,
            warm: rng() < 0.72, bright: 0.28 + rng() * 0.6, curtain: rng() < 0.3
          });
        }
      }
      houses.push({
        x: hx, w, h, top, wins,
        gable: rng() < 0.55,
        chimney: rng() < 0.55,
        antenna: rng() < 0.25,
        tone: rng()
      });
      hx += w + 12 + rng() * 36;
    }
  }
  const lamps = [
    { x: 940, y: 320, r: 172 },
    { x: 1810, y: 630, r: 168 },
    { x: 2680, y: 306, r: 168 },
    { x: 3540, y: 620, r: 172 },
    { x: 4470, y: 336, r: 168 },
    { x: 5280, y: 610, r: 172 }
  ];
  const zappers = [
    { x: 2250, y: 470, w: 82, h: 118, period: 3.6, onT: 1.55, phase: 0.3, on: false },
    { x: 4910, y: 438, w: 82, h: 118, period: 3.1, onT: 1.25, phase: 1.6, on: false }
  ];
  const checkpoints = [
    { x: 240, y: 520 }, { x: 1460, y: 500 }, { x: 3050, y: 500 },
    { x: 4200, y: 540 }, { x: 5480, y: 540 }
  ];
  const neon = [
    { x: 1230, y: 610, text: 'DINER', color: '#ff8cae', phase: 0.5 },
    { x: 4090, y: 574, text: 'MOTEL', color: '#8fe6d8', phase: 2.2 }
  ];
  const porch = {
    lampX: 5960, lampY: 474,
    juneX: 6016, juneY: 700,
    doorX: 6120, windowX: 6300, windowY: 490,
    windowW: 100, windowH: 130
  };
  const flags = {};
  const trigger = (key, fn) => { if (!flags[key]) { flags[key] = true; fn(); } };
  let time = 0, entry = 0;
  let dazzle = 0;
  let hit = null;
  let invuln = 0;
  let checkpoint = checkpoints[0];
  let nextCheckpoint = 1;
  let nearLamp = null;
  let cut = null;
  let porchDone = false;
  let juneGone = false;
  let lampLit = 1;
  let flash = 0;
  let leaving = false;
  let lastZapState = [false, false];
  let cinema = 0;

  function drawSkyline() {
    const g = ctx.createLinearGradient(0, 480, 0, 700);
    g.addColorStop(0, 'rgba(64,96,118,0.08)');
    g.addColorStop(1, 'rgba(10,18,28,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 480, VW, 220);
    const off = wrap(cam.cx * 0.055, farSkyline.span);
    ctx.save();
    ctx.globalAlpha = 0.82;
    ctx.fillStyle = '#081119';
    for (const b of farSkyline.arr) {
      let x = b.x + off;
      if (x > VW + 100) x -= farSkyline.span;
      if (x < -150 || x > VW + 150) continue;
      const base = 690;
      ctx.fillRect(x, base - b.h, b.w, b.h);
      if (b.roof) {
        ctx.beginPath();
        ctx.moveTo(x - 4, base - b.h);
        ctx.lineTo(x + b.w / 2, base - b.h - 22);
        ctx.lineTo(x + b.w + 4, base - b.h);
        ctx.closePath();
        ctx.fill();
      }
      for (const w of b.wins) {
        ctx.globalAlpha = 0.5;
        ctx.fillStyle = w.warm ? '#e8b06e' : '#9fc4d1';
        ctx.fillRect(x + w.x, base - b.h + 8 + w.y * 0.5, w.s, w.s * 1.5);
        ctx.globalAlpha = 0.82;
        ctx.fillStyle = '#081119';
      }
    }
    ctx.restore();
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const hg = ctx.createLinearGradient(0, 620, 0, 760);
    hg.addColorStop(0, 'rgba(255,174,92,0)');
    hg.addColorStop(0.45, 'rgba(255,174,92,0.045)');
    hg.addColorStop(1, 'rgba(255,174,92,0)');
    ctx.fillStyle = hg;
    ctx.fillRect(0, 620, VW, 140);
    ctx.restore();
  }

  function drawHouse(h) {
    if (h.x + h.w < cam.left - 120 || h.x > cam.right + 120) return;
    const base = 842;
    const body = ctx.createLinearGradient(0, h.top, 0, base);
    body.addColorStop(0, h.tone > 0.5 ? '#070d14' : '#060a10');
    body.addColorStop(1, '#03060a');
    ctx.fillStyle = body;
    ctx.fillRect(h.x, h.top, h.w, h.h);
    if (h.gable) {
      ctx.fillStyle = '#050a10';
      ctx.beginPath();
      ctx.moveTo(h.x - 7, h.top + 2);
      ctx.lineTo(h.x + h.w / 2, h.top - 52 - (h.tone * 22));
      ctx.lineTo(h.x + h.w + 7, h.top + 2);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = 'rgba(116,146,158,0.09)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(h.x - 7, h.top + 2);
      ctx.lineTo(h.x + h.w / 2, h.top - 52 - (h.tone * 22));
      ctx.stroke();
    } else {
      ctx.fillStyle = '#060b11';
      ctx.fillRect(h.x - 5, h.top - 12, h.w + 10, 14);
    }
    if (h.chimney) {
      const cx = h.x + h.w * (0.2 + h.tone * 0.6);
      ctx.fillStyle = '#05090e';
      ctx.fillRect(cx, h.top - 92, 18, 54);
      ctx.fillRect(cx - 3, h.top - 96, 24, 6);
    }
    if (h.antenna) {
      const cx = h.x + h.w * 0.68;
      ctx.strokeStyle = 'rgba(90,112,124,0.25)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(cx, h.top - 8);
      ctx.lineTo(cx, h.top - 76);
      ctx.moveTo(cx - 14, h.top - 62);
      ctx.lineTo(cx + 16, h.top - 62);
      ctx.moveTo(cx - 8, h.top - 44);
      ctx.lineTo(cx + 10, h.top - 44);
      ctx.stroke();
      ctx.fillStyle = '#5e2638';
      ctx.globalAlpha = 0.55 + 0.25 * Math.sin(time * 2.2 + h.x);
      fillCircle(ctx, cx, h.top - 76, 1.2);
      ctx.globalAlpha = 1;
    }
    for (const w of h.wins) {
      if (w.warm) {
        const wg = ctx.createLinearGradient(0, w.y, 0, w.y + w.h);
        wg.addColorStop(0, 'rgba(255,205,131,0.92)');
        wg.addColorStop(1, 'rgba(226,142,68,0.8)');
        ctx.fillStyle = wg;
        ctx.globalAlpha = w.bright;
        ctx.fillRect(w.x, w.y, w.w, w.h);
        ctx.globalAlpha = 1;
        Glow.draw(ctx, w.x + w.w / 2, w.y + w.h / 2, w.w * 2.6, '#ffb565', 0.08 * w.bright);
      } else {
        ctx.fillStyle = '#86b0c0';
        ctx.globalAlpha = 0.32 * w.bright;
        ctx.fillRect(w.x, w.y, w.w, w.h);
        ctx.globalAlpha = 1;
      }
      ctx.strokeStyle = 'rgba(2,5,9,0.8)';
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(w.x + w.w / 2, w.y);
      ctx.lineTo(w.x + w.w / 2, w.y + w.h);
      ctx.moveTo(w.x, w.y + w.h / 2);
      ctx.lineTo(w.x + w.w, w.y + w.h / 2);
      ctx.stroke();
      if (w.curtain) {
        ctx.fillStyle = 'rgba(6,10,14,0.6)';
        ctx.fillRect(w.x + 1, w.y + 1, w.w * 0.25, w.h - 2);
      }
    }
    ctx.strokeStyle = 'rgba(120,150,160,0.05)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(h.x, h.top + 5);
    ctx.lineTo(h.x + h.w, h.top + 5);
    ctx.stroke();
  }

  function drawStreet() {
    const g = ctx.createLinearGradient(0, 816, 0, 950);
    g.addColorStop(0, '#0a1218');
    g.addColorStop(0.25, '#050b10');
    g.addColorStop(1, '#020408');
    ctx.fillStyle = g;
    ctx.fillRect(cam.left - 200, 816, (cam.right - cam.left) + 400, 140);
    ctx.save();
    ctx.globalAlpha = 0.2;
    ctx.strokeStyle = '#8ca9b2';
    ctx.lineWidth = 1;
    ctx.setLineDash([30, 46]);
    ctx.beginPath();
    ctx.moveTo(cam.left - 100, 878);
    ctx.lineTo(cam.right + 100, 878);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.globalAlpha = 0.12;
    ctx.beginPath();
    ctx.moveTo(cam.left - 100, 832);
    ctx.lineTo(cam.right + 100, 832);
    ctx.stroke();
    ctx.restore();
    for (const l of lamps) {
      if (l.x < cam.left - 200 || l.x > cam.right + 200) continue;
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = 0.08;
      ctx.translate(l.x, 850);
      ctx.scale(0.5, 1);
      Glow.draw(ctx, 0, 0, 150, '#ffbd72', 0.3);
      ctx.restore();
    }
  }

  function drawLamp(l) {
    if (l.x < cam.left - 350 || l.x > cam.right + 350) return;
    const bulbY = l.y;
    const ground = 840;
    const poleX = l.x + 84;
    ctx.save();
    ctx.strokeStyle = '#03070b';
    ctx.lineWidth = 7;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(poleX, ground);
    ctx.lineTo(poleX, bulbY + 120);
    ctx.quadraticCurveTo(poleX, bulbY + 34, l.x, bulbY + 14);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(112,138,148,0.16)';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(poleX + 2, ground);
    ctx.lineTo(poleX + 2, bulbY + 118);
    ctx.quadraticCurveTo(poleX + 2, bulbY + 32, l.x + 2, bulbY + 12);
    ctx.stroke();
    ctx.fillStyle = '#04080c';
    ctx.beginPath();
    ctx.ellipse(l.x, bulbY, 10, 8, 0, 0, TAU);
    ctx.fill();
    const near = nearLamp === l;
    const pulse = 0.82 + 0.18 * Math.sin(time * 2.1 + l.x);
    Glow.draw(ctx, l.x, bulbY, 330, '#ffb25f', 0.115 * pulse);
    Glow.draw(ctx, l.x, bulbY, 120, '#ffc87d', 0.26 * pulse);
    Glow.draw(ctx, l.x, bulbY, 38, '#ffe2ac', 0.7);
    ctx.fillStyle = '#fff2cf';
    fillCircle(ctx, l.x, bulbY, 5.2);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const cone = ctx.createLinearGradient(0, bulbY, 0, 860);
    cone.addColorStop(0, 'rgba(255,188,108,0.13)');
    cone.addColorStop(1, 'rgba(255,170,80,0)');
    ctx.fillStyle = cone;
    ctx.beginPath();
    ctx.moveTo(l.x - 10, bulbY + 8);
    ctx.lineTo(l.x + 10, bulbY + 8);
    ctx.lineTo(l.x + 210, 862);
    ctx.lineTo(l.x - 210, 862);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    for (let i = 0; i < 5; i++) {
      const a = time * 0.5 + i * 1.4;
      const rr = 26 + Math.sin(time + i) * 8;
      const x = l.x + Math.cos(a) * rr;
      const y = bulbY + Math.sin(a) * rr * 0.5;
      Glow.draw(ctx, x, y, 8, '#ffe7b7', 0.2);
    }
    if (near) {
      ctx.save();
      ctx.strokeStyle = `rgba(255,205,140,${0.14 + dazzle / 100 * 0.3})`;
      ctx.lineWidth = 1;
      ctx.setLineDash([6, 14]);
      ctx.lineDashOffset = -time * 30;
      ctx.beginPath();
      ctx.arc(l.x, bulbY, l.r * (0.75 + 0.25 * Math.sin(time * 2)), 0, TAU);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();
      for (let i = 0; i < 7; i++) {
        const a = time * 1.7 + i * 0.9;
        const rr = l.r * (0.45 + 0.5 * fract(i * 0.37 + time * 0.08));
        const px = l.x + Math.cos(a) * rr * 0.7;
        const py = bulbY + Math.sin(a) * rr * 0.5;
        Glow.draw(ctx, px, py, 7, '#ffe4ad', 0.24);
      }
    }
    ctx.restore();
  }

  function drawZapper(z) {
    if (z.x < cam.left - 250 || z.x > cam.right + 250) return;
    const sway = Math.sin(time * 0.7 + z.phase) * 5;
    const cx = z.x + sway;
    const poleY = 260;
    ctx.save();
    ctx.strokeStyle = '#101a20';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(z.x - 170, poleY);
    ctx.quadraticCurveTo(z.x, poleY + 110, z.x + 170, poleY);
    ctx.stroke();
    ctx.strokeStyle = '#04080c';
    ctx.lineWidth = 7;
    ctx.beginPath();
    ctx.moveTo(z.x - 170, 840);
    ctx.lineTo(z.x - 170, poleY);
    ctx.moveTo(z.x + 170, 840);
    ctx.lineTo(z.x + 170, poleY);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(110,140,150,0.16)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(z.x - 168, 840);
    ctx.lineTo(z.x - 168, poleY);
    ctx.moveTo(z.x + 168, 840);
    ctx.lineTo(z.x + 168, poleY);
    ctx.stroke();
    ctx.fillStyle = '#05090e';
    roundRect(ctx, cx - z.w / 2 - 5, z.y - z.h / 2 - 5, z.w + 10, z.h + 10, 10);
    ctx.fill();
    ctx.strokeStyle = 'rgba(168,205,222,0.22)';
    ctx.lineWidth = 1.4;
    roundRect(ctx, cx - z.w / 2 - 5, z.y - z.h / 2 - 5, z.w + 10, z.h + 10, 10);
    ctx.stroke();
    const on = z.on;
    if (on) {
      Glow.draw(ctx, cx, z.y, 220, '#9fd4ff', 0.16);
      Glow.draw(ctx, cx, z.y, 90, '#d9edff', 0.28);
      for (let i = 0; i < 7; i++) {
        const y = z.y - z.h / 2 + (i + 0.5) * (z.h / 7);
        ctx.strokeStyle = 'rgba(206,232,255,0.28)';
        ctx.lineWidth = 0.8;
        ctx.beginPath();
        ctx.moveTo(cx - z.w / 2 + 5, y);
        ctx.lineTo(cx + z.w / 2 - 5, y);
        ctx.stroke();
      }
      for (let i = 0; i < 8; i++) {
        const seed = Math.floor(time * 16) * 13 + i * 71;
        const rng = mulberry32(seed + z.phase * 9);
        const x1 = cx - z.w / 2 + rng() * z.w;
        const y1 = z.y - z.h / 2 + rng() * z.h;
        const x2 = x1 + (rng() * 2 - 1) * 22;
        const y2 = y1 + (rng() * 2 - 1) * 18;
        ctx.strokeStyle = i % 2 === 0 ? 'rgba(214,238,255,0.8)' : 'rgba(155,210,255,0.6)';
        ctx.lineWidth = i % 3 === 0 ? 1.2 : 0.6;
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();
      }
      for (let i = 0; i < 4; i++) {
        const a = time * 9 + i * 1.55;
        const px = cx + Math.cos(a) * 55;
        const py = z.y + Math.sin(a * 1.3) * 38;
        Glow.draw(ctx, px, py, 10, '#cfe8ff', 0.3);
      }
    } else {
      ctx.fillStyle = '#06131b';
      ctx.beginPath();
      ctx.ellipse(cx, z.y, z.w / 2, z.h / 2, 0, 0, TAU);
      ctx.fill();
      ctx.strokeStyle = 'rgba(94,134,156,0.16)';
      ctx.lineWidth = 0.7;
      for (let i = 0; i < 6; i++) {
        const y = z.y - z.h / 2 + (i + 0.5) * (z.h / 6);
        ctx.beginPath();
        ctx.moveTo(cx - z.w / 2 + 6, y);
        ctx.lineTo(cx + z.w / 2 - 6, y);
        ctx.stroke();
      }
      Glow.draw(ctx, cx, z.y, 60, '#6ba3c2', 0.03);
    }
    ctx.fillStyle = '#050a0f';
    ctx.fillRect(cx - z.w / 2 - 8, z.y - z.h / 2 - 16, z.w + 16, 12);
    ctx.restore();
  }

  function drawNeon(n) {
    if (n.x < cam.left - 300 || n.x > cam.right + 300) return;
    const on = 0.72 + 0.28 * Math.sin(time * 2.3 + n.phase);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    Glow.draw(ctx, n.x, n.y, 150, n.color, 0.09 * on);
    ctx.globalAlpha = 0.6 * on;
    setFont(22, SANS, '600');
    ctx.fillStyle = n.color;
    ctx.textAlign = 'center';
    ctx.fillText(n.text, n.x, n.y);
    ctx.globalAlpha = 0.16 * on;
    ctx.strokeStyle = n.color;
    ctx.lineWidth = 6;
    ctx.strokeText(n.text, n.x, n.y);
    ctx.restore();
  }

  function drawPorchScene() {
    const wallX = 5880;
    const wallTop = 252;
    const ground = 842;
    const lit = lampLit;
    const lampX = porch.lampX;
    const lampY = porch.lampY;
    const wallRight = 7020;
    const porchFloor = 700;
    const stepY = [724, 756, 788];
    const stepX = [5904, 5854, 5822];
    ctx.save();
    ctx.fillStyle = '#04070c';
    ctx.beginPath();
    ctx.moveTo(5730, 300);
    ctx.lineTo(6370, 108);
    ctx.lineTo(wallRight, 226);
    ctx.lineTo(wallRight, ground);
    ctx.lineTo(5730, ground);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = 'rgba(120,150,165,0.11)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(5730, 300);
    ctx.lineTo(6370, 108);
    ctx.lineTo(wallRight, 226);
    ctx.stroke();
    ctx.fillStyle = '#060a10';
    ctx.fillRect(wallX, wallTop, wallRight - wallX, ground - wallTop);
    ctx.strokeStyle = 'rgba(130,160,170,0.045)';
    ctx.lineWidth = 1;
    for (let y = wallTop + 18; y < ground - 12; y += 24) {
      if (y > 395 && y < 720) continue;
      ctx.beginPath();
      ctx.moveTo(wallX + 4, y);
      ctx.lineTo(wallRight - 4, y);
      ctx.stroke();
    }
    ctx.fillStyle = '#050a0f';
    ctx.fillRect(6540, 156, 54, 106);
    ctx.fillRect(6534, 250, 66, 10);
    ctx.strokeStyle = 'rgba(160,130,110,0.08)';
    ctx.lineWidth = 1;
    for (let i = 0; i < 5; i++) {
      ctx.beginPath();
      ctx.moveTo(6542, 170 + i * 18);
      ctx.lineTo(6590, 170 + i * 18);
      ctx.stroke();
    }
    ctx.fillStyle = '#04080d';
    ctx.fillRect(6180, 300, 86, 96);
    ctx.fillStyle = '#02050a';
    ctx.fillRect(6188, 308, 70, 80);
    ctx.strokeStyle = 'rgba(130,165,180,0.12)';
    ctx.strokeRect(6188.5, 308.5, 69, 79);
    ctx.beginPath();
    ctx.moveTo(6223, 308);
    ctx.lineTo(6223, 388);
    ctx.moveTo(6188, 348);
    ctx.lineTo(6258, 348);
    ctx.stroke();
    ctx.globalAlpha = 0.16;
    const ug = ctx.createLinearGradient(6190, 310, 6256, 386);
    ug.addColorStop(0, 'rgba(140,180,205,0.5)');
    ug.addColorStop(1, 'rgba(140,180,205,0)');
    ctx.fillStyle = ug;
    ctx.fillRect(6192, 310, 30, 74);
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#05090e';
    ctx.fillRect(6340, 228, 54, 26);
    ctx.fillRect(6358, 252, 18, 18);
    if (lit < 0.02) {
      ctx.fillStyle = 'rgba(4,7,11,0.45)';
      ctx.fillRect(wallX, wallTop, wallRight - wallX, ground - wallTop);
    }
    const roofGrad = ctx.createLinearGradient(0, 400, 0, 448);
    roofGrad.addColorStop(0, '#0a1219');
    roofGrad.addColorStop(1, '#04080d');
    ctx.fillStyle = roofGrad;
    ctx.beginPath();
    ctx.moveTo(5772, 438);
    ctx.lineTo(6364, 402);
    ctx.lineTo(6372, 424);
    ctx.lineTo(5762, 460);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = 'rgba(150,180,188,0.13)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(5772, 438);
    ctx.lineTo(6364, 402);
    ctx.stroke();
    ctx.fillStyle = '#04080d';
    ctx.fillRect(5762, 460, 620, 9);
    ctx.fillStyle = '#050a10';
    ctx.fillRect(5780, 700, 560, 16);
    ctx.fillStyle = '#071018';
    ctx.fillRect(5788, 716, 548, 10);
    for (let i = 0; i < 3; i++) {
      ctx.fillStyle = i % 2 === 0 ? '#061016' : '#04090e';
      ctx.fillRect(stepX[i], stepY[i], 6060 - stepX[i] + (i === 0 ? 40 : 0), 16);
      ctx.fillStyle = 'rgba(138,172,180,0.13)';
      ctx.fillRect(stepX[i], stepY[i], 6060 - stepX[i], 1.5);
      ctx.fillStyle = '#03070b';
      ctx.fillRect(stepX[i], stepY[i] + 16, 6060 - stepX[i], stepY[i + 1] != null ? stepY[i + 1] - stepY[i] - 16 : 38);
    }
    ctx.fillStyle = '#03070b';
    ctx.fillRect(stepX[2], 804, 6060 - stepX[2], 40);
    ctx.save();
    ctx.strokeStyle = 'rgba(118,146,151,0.1)';
    ctx.lineWidth = 1;
    for (let i = 0; i < 3; i++) {
      ctx.beginPath();
      ctx.moveTo(stepX[i] + 8, stepY[i] + 2);
      ctx.lineTo(6050, stepY[i] + 2);
      ctx.stroke();
    }
    ctx.restore();
    ctx.fillStyle = '#04090e';
    ctx.fillRect(5832, 438, 13, 262);
    ctx.fillRect(6248, 420, 13, 280);
    ctx.fillStyle = '#050a0f';
    ctx.fillRect(5826, 430, 25, 14);
    ctx.fillRect(6242, 414, 25, 14);
    ctx.strokeStyle = 'rgba(140,170,178,0.12)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(5834, 452);
    ctx.lineTo(5834, 698);
    ctx.moveTo(6250, 436);
    ctx.lineTo(6250, 698);
    ctx.stroke();
    ctx.fillStyle = '#040a0e';
    ctx.fillRect(5920, 646, 142, 8);
    ctx.fillRect(5920, 674, 142, 8);
    ctx.fillRect(5924, 654, 5, 20);
    ctx.fillRect(5946, 654, 4, 20);
    ctx.fillRect(5974, 654, 4, 20);
    ctx.fillRect(6002, 654, 4, 20);
    ctx.fillRect(6030, 654, 4, 20);
    ctx.fillRect(6050, 654, 5, 20);
    ctx.strokeStyle = 'rgba(140,166,168,0.09)';
    ctx.beginPath();
    ctx.moveTo(5920, 646);
    ctx.lineTo(6062, 646);
    ctx.stroke();
    ctx.fillStyle = lit > 0.02 ? '#0c0b0d' : '#05090d';
    ctx.fillRect(porch.doorX, 500, 92, 200);
    ctx.fillStyle = lit > 0.02 ? '#241a13' : '#080b0e';
    ctx.fillRect(porch.doorX + 6, 506, 80, 188);
    ctx.strokeStyle = 'rgba(210,170,120,0.1)';
    ctx.lineWidth = 1;
    ctx.strokeRect(porch.doorX + 12, 516, 68, 68);
    ctx.strokeRect(porch.doorX + 12, 596, 68, 86);
    ctx.fillStyle = '#d5a665';
    ctx.globalAlpha = lit > 0.02 ? 0.5 : 0.15;
    fillCircle(ctx, porch.doorX + 76, 600, 2.2);
    ctx.globalAlpha = 1;
    const doorOpen = cut ? cut.doorOpen : 0;
    if (doorOpen > 0.01) {
      ctx.fillStyle = '#010204';
      ctx.fillRect(porch.doorX + 4, 504, 84, 194);
      ctx.fillStyle = '#05080d';
      ctx.beginPath();
      ctx.moveTo(porch.doorX + 4 + 66 * doorOpen, 504);
      ctx.lineTo(porch.doorX + 4 + 84 * doorOpen, 510);
      ctx.lineTo(porch.doorX + 4 + 84 * doorOpen, 692);
      ctx.lineTo(porch.doorX + 4 + 66 * doorOpen, 698);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = 'rgba(200,170,130,0.12)';
      ctx.stroke();
    }
    ctx.fillStyle = '#040a0e';
    ctx.fillRect(porch.windowX - 10, porch.windowY - 10, porch.windowW + 20, porch.windowH + 20);
    const glass = ctx.createLinearGradient(porch.windowX, porch.windowY, porch.windowX + porch.windowW, porch.windowY + porch.windowH);
    glass.addColorStop(0, 'rgba(32,56,74,0.9)');
    glass.addColorStop(0.55, 'rgba(10,20,32,0.95)');
    glass.addColorStop(1, 'rgba(34,58,74,0.8)');
    ctx.fillStyle = glass;
    ctx.fillRect(porch.windowX, porch.windowY, porch.windowW, porch.windowH);
    ctx.strokeStyle = 'rgba(150,190,200,0.25)';
    ctx.lineWidth = 1.4;
    ctx.strokeRect(porch.windowX + 0.5, porch.windowY + 0.5, porch.windowW - 1, porch.windowH - 1);
    ctx.beginPath();
    ctx.moveTo(porch.windowX + porch.windowW / 2, porch.windowY);
    ctx.lineTo(porch.windowX + porch.windowW / 2, porch.windowY + porch.windowH * 0.55);
    ctx.moveTo(porch.windowX, porch.windowY + porch.windowH * 0.55);
    ctx.lineTo(porch.windowX + porch.windowW, porch.windowY + porch.windowH * 0.55);
    ctx.stroke();
    ctx.fillStyle = '#02050a';
    ctx.fillRect(porch.windowX + 4, porch.windowY + porch.windowH * 0.55 + 3, porch.windowW - 8, porch.windowH * 0.45 - 7);
    ctx.strokeStyle = 'rgba(180,210,220,0.18)';
    ctx.beginPath();
    ctx.moveTo(porch.windowX + 10, porch.windowY + porch.windowH * 0.55);
    ctx.lineTo(porch.windowX + 10, porch.windowY + porch.windowH - 8);
    ctx.stroke();
    ctx.globalAlpha = 0.18;
    ctx.fillStyle = '#a7ceda';
    ctx.beginPath();
    ctx.moveTo(porch.windowX + 60, porch.windowY + 5);
    ctx.lineTo(porch.windowX + 88, porch.windowY + 5);
    ctx.lineTo(porch.windowX + 52, porch.windowY + 66);
    ctx.lineTo(porch.windowX + 28, porch.windowY + 66);
    ctx.closePath();
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#050a0f';
    ctx.fillRect(5866, 664, 50, 36);
    ctx.fillRect(5862, 646, 58, 18);
    ctx.fillRect(5866, 656, 6, 20);
    ctx.fillRect(5910, 656, 6, 20);
    ctx.fillStyle = '#0a0d16';
    ctx.beginPath();
    ctx.ellipse(6234, 684, 21, 11, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#070a10';
    ctx.beginPath();
    ctx.ellipse(6244, 676, 10, 10, 0, 0, TAU);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(6251, 677, 3.5, 4.5, -0.3, 0, TAU);
    ctx.fill();
    ctx.globalAlpha = 0.4;
    ctx.strokeStyle = 'rgba(180,200,198,0.4)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(6244, 676, 11, -0.7, 0.5);
    ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#0a0f12';
    ctx.beginPath();
    ctx.ellipse(5868, 680, 14, 28, 0.1, 0, TAU);
    ctx.fill();
    ctx.fillRect(5860, 698, 20, 22);
    ctx.strokeStyle = 'rgba(120,160,150,0.2)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(5860, 670);
    ctx.quadraticCurveTo(5840, 650, 5850, 620);
    ctx.moveTo(5872, 664);
    ctx.quadraticCurveTo(5888, 640, 5878, 612);
    ctx.stroke();
    ctx.fillStyle = '#071110';
    for (let i = 0; i < 5; i++) {
      ctx.beginPath();
      ctx.ellipse(5848 + i * 7, 620 + i * 3, 9, 3, -0.6 + i * 0.25, 0, TAU);
      ctx.fill();
    }
    const chimeX = 6058;
    const sway = Math.sin(time * 1.2) * 3;
    ctx.strokeStyle = 'rgba(170,180,170,0.22)';
    ctx.lineWidth = 0.7;
    ctx.beginPath();
    ctx.moveTo(chimeX, 460);
    ctx.lineTo(chimeX + sway, 476);
    ctx.stroke();
    for (let i = 0; i < 3; i++) {
      const tx = chimeX + sway + (i - 1) * 5;
      ctx.strokeStyle = 'rgba(200,205,195,0.24)';
      ctx.beginPath();
      ctx.moveTo(tx, 476);
      ctx.lineTo(tx, 496 + i * 7);
      ctx.stroke();
      ctx.fillStyle = 'rgba(170,170,160,0.14)';
      ctx.beginPath();
      ctx.ellipse(tx, 498 + i * 7, 2.4, 6, 0, 0, TAU);
      ctx.fill();
    }
    const coolA = 0.045 + (1 - lit) * 0.075;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const cool = ctx.createLinearGradient(5660, 200, 6900, 900);
    cool.addColorStop(0, `rgba(96,136,166,${coolA})`);
    cool.addColorStop(0.5, `rgba(82,118,140,${coolA * 0.45})`);
    cool.addColorStop(1, 'rgba(70,100,120,0)');
    ctx.fillStyle = cool;
    ctx.fillRect(5660, 200, 1400, 700);
    Glow.draw(ctx, porch.windowX + 50, porch.windowY + 60, 250, '#9cc6d4', 0.045 + (1 - lit) * 0.08);
    Glow.draw(ctx, 5900, 770, 280, '#7fa7b0', 0.025 + (1 - lit) * 0.045);
    ctx.restore();
    if (lit > 0.01) {
      const flick = 0.94 + 0.06 * Math.sin(time * 17) + 0.03 * Math.sin(time * 7);
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      const wash = ctx.createRadialGradient(lampX, lampY, 10, lampX, lampY + 40, 430);
      wash.addColorStop(0, `rgba(255,190,115,${0.16 * lit * flick})`);
      wash.addColorStop(0.35, `rgba(255,168,88,${0.09 * lit * flick})`);
      wash.addColorStop(0.7, `rgba(255,150,72,${0.025 * lit})`);
      wash.addColorStop(1, 'rgba(255,150,72,0)');
      ctx.fillStyle = wash;
      ctx.fillRect(5620, 240, 1000, 610);
      ctx.restore();
      ctx.strokeStyle = '#05080a';
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(lampX, 424);
      ctx.lineTo(lampX, 444);
      ctx.stroke();
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      Glow.draw(ctx, lampX, lampY, 240, '#ffb460', 0.2 * lit * flick);
      Glow.draw(ctx, lampX + 2, lampY + 5, 70, '#ffd08b', 0.44 * lit * flick);
      ctx.restore();
      ctx.fillStyle = '#090c0e';
      ctx.beginPath();
      ctx.moveTo(lampX - 18, lampY - 22);
      ctx.lineTo(lampX + 18, lampY - 22);
      ctx.lineTo(lampX + 11, lampY + 12);
      ctx.lineTo(lampX - 11, lampY + 12);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = `rgba(255,215,160,${0.5 * lit})`;
      ctx.lineWidth = 1.3;
      ctx.stroke();
      ctx.fillStyle = '#fff1c7';
      fillCircle(ctx, lampX, lampY + 1, 4.6);
      ctx.save();
      ctx.globalAlpha = 0.4 * lit;
      ctx.fillStyle = '#ffcb7c';
      ctx.beginPath();
      ctx.moveTo(lampX - 13, lampY - 16);
      ctx.lineTo(lampX + 13, lampY - 16);
      ctx.lineTo(lampX + 9, lampY + 8);
      ctx.lineTo(lampX - 9, lampY + 8);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      const cone = ctx.createLinearGradient(0, lampY, 0, 842);
      cone.addColorStop(0, `rgba(255,190,112,${0.1 * lit * flick})`);
      cone.addColorStop(0.6, `rgba(255,165,82,${0.03 * lit})`);
      cone.addColorStop(1, 'rgba(255,150,70,0)');
      ctx.fillStyle = cone;
      ctx.beginPath();
      ctx.moveTo(lampX - 16, lampY + 8);
      ctx.lineTo(lampX + 16, lampY + 8);
      ctx.lineTo(lampX + 250, 860);
      ctx.lineTo(lampX - 250, 860);
      ctx.closePath();
      ctx.fill();
      const pool = ctx.createRadialGradient(lampX, 740, 10, lampX, 740, 230);
      pool.addColorStop(0, `rgba(255,185,105,${0.08 * lit})`);
      pool.addColorStop(1, 'rgba(255,185,105,0)');
      ctx.fillStyle = pool;
      ctx.fillRect(lampX - 250, 620, 500, 240);
      ctx.restore();
    } else {
      ctx.fillStyle = '#090c0e';
      ctx.beginPath();
      ctx.moveTo(lampX - 18, lampY - 22);
      ctx.lineTo(lampX + 18, lampY - 22);
      ctx.lineTo(lampX + 11, lampY + 12);
      ctx.lineTo(lampX - 11, lampY + 12);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = 'rgba(140,166,176,0.2)';
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.strokeStyle = 'rgba(140,166,176,0.12)';
      ctx.beginPath();
      ctx.moveTo(lampX - 2, lampY + 8);
      ctx.bezierCurveTo(lampX - 8, lampY + 26, lampX + 6, lampY + 36, lampX - 1, lampY + 55);
      ctx.stroke();
    }
    if (cut && cut.lampDead) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      Glow.draw(ctx, moth.x, moth.y, 340, '#ffb35f', 0.14);
      Glow.draw(ctx, moth.x, moth.y, 150, '#ffd190', 0.22);
      ctx.restore();
    }
    drawJune(lit);
    if (porchDone) {
      const wx = porch.windowX + porch.windowW / 2;
      const wy = porch.windowY + porch.windowH * 0.75;
      const pulse = 0.5 + 0.5 * Math.sin(time * 2.1);
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      Glow.draw(ctx, wx, wy, 90, '#a9d6df', 0.12 + pulse * 0.08);
      ctx.restore();
    }
    ctx.restore();
  }

  function drawJune(lit) {
    if (juneGone) return;
    const jx = porch.juneX;
    const jy = porch.juneY;
    let x = jx;
    let alpha = 1;
    let stand = 0;
    if (cut) {
      if (cut.t > 12.8) stand = smoothstep(12.8, 13.8, cut.t);
      if (cut.t > 14.0) {
        const k = smoothstep(14.0, 15.15, cut.t);
        x += k * 112;
        alpha = 1 - smoothstep(14.9, 15.2, cut.t);
      }
    }
    if (alpha <= 0.01) return;
    const look = cut ? smoothstep(1.3, 2.3, cut.t) : 0;
    const reach = cut ? smoothstep(7.9, 8.7, cut.t) * (1 - smoothstep(10.2, 11.0, cut.t)) : 0;
    const breathe = Math.sin(time * 1.15) * 1.3;
    const warm = lit > 0.02;
    const rim = warm ? `rgba(255,198,132,${0.36 + lit * 0.18})` : 'rgba(255,184,112,0.34)';
    const cool = 'rgba(152,190,205,0.32)';
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(x, jy - stand * 24 + breathe);
    ctx.scale(1.22, 1.22);
    if (stand < 0.98) {
      ctx.globalAlpha = alpha * (1 - stand);
      const bg = ctx.createLinearGradient(-70, -108, 40, 4);
      bg.addColorStop(0, '#1a1730');
      bg.addColorStop(0.55, '#141126');
      bg.addColorStop(1, '#0d0c18');
      ctx.fillStyle = bg;
      ctx.beginPath();
      ctx.moveTo(-78, 0);
      ctx.bezierCurveTo(-84, -48, -50, -88, 0, -90 + breathe);
      ctx.bezierCurveTo(42, -90, 60, -50, 54, 0);
      ctx.closePath();
      ctx.fill();
      ctx.save();
      ctx.clip();
      ctx.strokeStyle = 'rgba(126,128,172,0.16)';
      ctx.lineWidth = 1;
      for (let i = 0; i < 5; i++) {
        ctx.beginPath();
        ctx.moveTo(-74 + i * 26, -86);
        ctx.quadraticCurveTo(-58 + i * 24, -46, -66 + i * 28, 0);
        ctx.stroke();
      }
      ctx.restore();
      ctx.fillStyle = '#0a0e17';
      ctx.beginPath();
      ctx.ellipse(-42, -38, 18, 23, -0.25, 0, TAU);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(-20, -20, 18, 13, 0.2, 0, TAU);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(-54, -9, 15, 8, -0.1, 0, TAU);
      ctx.fill();
      const hx = -28, hy = -94 + breathe;
      ctx.fillStyle = '#0b0f18';
      ctx.beginPath();
      ctx.ellipse(hx + 9, hy + 2, 17, 18, 0.14, 0, TAU);
      ctx.fill();
      ctx.fillStyle = '#0c101a';
      ctx.beginPath();
      ctx.ellipse(hx, hy, 14, 15, -0.16, 0, TAU);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(hx - 11, hy + 1);
      ctx.lineTo(hx - 18, hy + 6);
      ctx.lineTo(hx - 10, hy + 8);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#0b0f18';
      ctx.beginPath();
      ctx.moveTo(hx + 6, hy - 14);
      ctx.bezierCurveTo(hx + 25, hy - 6, hx + 30, hy + 16, hx + 19, hy + 31);
      ctx.bezierCurveTo(hx + 25, hy + 11, hx + 20, hy - 2, hx + 4, hy - 4);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = rim;
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.arc(hx, hy, 14.5, Math.PI * 0.55, Math.PI * 1.5);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(hx - 11, hy + 11);
      ctx.bezierCurveTo(hx - 18, hy + 24, hx - 9, hy + 34, hx + 2, hy + 36);
      ctx.stroke();
      ctx.strokeStyle = 'rgba(255,206,148,0.26)';
      ctx.lineWidth = 1.1;
      ctx.beginPath();
      ctx.moveTo(-78, -3);
      ctx.bezierCurveTo(-82, -48, -48, -86, 0, -84);
      ctx.stroke();
      ctx.strokeStyle = cool;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(hx + 18, hy - 2);
      ctx.bezierCurveTo(hx + 26, hy + 12, hx + 23, hy + 24, hx + 16, hy + 32);
      ctx.stroke();
      const handX = -56 - reach * 4, handY = -48 - reach * 22;
      ctx.strokeStyle = '#0a0e17';
      ctx.lineWidth = 7;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(-12, -70);
      ctx.quadraticCurveTo(-36, -62, handX, handY);
      ctx.stroke();
      ctx.strokeStyle = rim;
      ctx.lineWidth = 1.1;
      ctx.beginPath();
      ctx.moveTo(-12, -71);
      ctx.quadraticCurveTo(-36, -63, handX, handY - 1);
      ctx.stroke();
      if (look > 0.3) {
        ctx.globalAlpha = alpha * (0.55 + Math.min(0.35, lit * 0.3));
        ctx.fillStyle = 'rgba(255,229,188,0.8)';
        fillCircle(ctx, hx - 7, hy + 1, 0.9);
        ctx.globalAlpha = alpha * 0.6;
        ctx.strokeStyle = 'rgba(220,235,240,0.4)';
        ctx.lineWidth = 0.7;
        ctx.beginPath();
        ctx.moveTo(hx - 9, hy + 6);
        ctx.lineTo(hx - 4, hy + 6);
        ctx.stroke();
        ctx.globalAlpha = alpha;
      }
      if (cut && cut.lampDead && cut.t < 13.8) {
        ctx.fillStyle = 'rgba(190,225,235,0.7)';
        fillCircle(ctx, hx - 6, hy + 3, 0.9);
        ctx.strokeStyle = 'rgba(170,210,225,0.35)';
        ctx.lineWidth = 0.6;
        ctx.beginPath();
        ctx.moveTo(hx - 6, hy + 4);
        ctx.lineTo(hx - 7, hy + 8);
        ctx.stroke();
      }
    }
    ctx.globalAlpha = alpha * stand;
    if (stand > 0.01) {
      const hx = 2, hy = -112;
      ctx.fillStyle = '#0a0e17';
      ctx.beginPath();
      ctx.moveTo(-20, 0);
      ctx.bezierCurveTo(-32, -52, -8, -100, hx + 4, -106);
      ctx.bezierCurveTo(34, -98, 42, -50, 34, 0);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#0c101a';
      ctx.beginPath();
      ctx.ellipse(hx + 2, hy, 14, 16, 0.04, 0, TAU);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(hx + 9, hy - 10);
      ctx.bezierCurveTo(hx + 26, hy + 2, hx + 25, hy + 22, hx + 13, hy + 36);
      ctx.bezierCurveTo(hx + 18, hy + 15, hx + 15, hy + 3, hx + 6, hy);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = rim;
      ctx.lineWidth = 1.3;
      ctx.beginPath();
      ctx.moveTo(-18, -8);
      ctx.bezierCurveTo(-28, -54, -6, -98, hx + 2, -102);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(hx + 2, hy, 15, Math.PI * 0.65, Math.PI * 1.5);
      ctx.stroke();
      ctx.strokeStyle = '#0a0e17';
      ctx.lineWidth = 10;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(-6, 0);
      ctx.quadraticCurveTo(-10, 22, -16, 44);
      ctx.moveTo(14, 0);
      ctx.quadraticCurveTo(16, 24, 12, 48);
      ctx.stroke();
      ctx.strokeStyle = 'rgba(255,198,132,0.2)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(-8, 0);
      ctx.quadraticCurveTo(-12, 22, -18, 46);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    ctx.restore();
    if (stand > 0.5) {
      ctx.save();
      ctx.globalAlpha = Math.min(alpha, stand) * 0.8;
      ctx.fillStyle = '#0a0a15';
      ctx.beginPath();
      ctx.ellipse(jx - 10, jy - 2, 20, 8, 0.12, 0, TAU);
      ctx.fill();
      ctx.restore();
    }
  }

  function drawWindowTarget() {
    if (!porchDone) return;
    const x = porch.windowX + porch.windowW / 2;
    const y = porch.windowY + porch.windowH * 0.8;
    const pulse = 0.5 + 0.5 * Math.sin(time * 2.1);
    Glow.draw(ctx, x, y, 130, '#a6d3df', 0.16 + pulse * 0.12);
    Glow.draw(ctx, x, y, 48, '#d8eef2', 0.2 + pulse * 0.12);
    ctx.save();
    ctx.strokeStyle = `rgba(200,235,240,${0.32 + pulse * 0.25})`;
    ctx.lineWidth = 1.2;
    ctx.setLineDash([4, 8]);
    ctx.lineDashOffset = time * 16;
    ctx.beginPath();
    ctx.arc(x, y, 34 + pulse * 5, 0, TAU);
    ctx.stroke();
    ctx.restore();
  }

  function startCutscene() {
    cut = { t: 0, lampDead: false, doorOpen: 0, startX: moth.x, startY: moth.y };
    porchDone = false;
    moth.frozen = true;
    hit = null;
    dazzle = 0;
    Sound.setHeart(false);
    Sound.setCity(0.02);
    Sound.playTheme({ instrument: 'pluck', gain: 0.42, delay: 0.4 });
    trigger('porchIntro', () => {});
  }

  function respawnFromHit() {
    hit = null;
    moth.frozen = false;
    moth.reset(checkpoint.x, checkpoint.y);
    invuln = 2;
    dazzle = 0;
    cam.snap(checkpoint.x, checkpoint.y);
    Sound.sfx('respawn');
    particles.burst(checkpoint.x, checkpoint.y, { count: 22, speed: 160, color: ['#ffd9a0', '#cfe8ff', '#fff2d2'], size: 2, life: 1.1, drag: 1.8, twinkle: 1 });
  }

  return {
    name: 'town',
    moth,
    get state() { return { dazzle, hit: !!hit, cut: !!cut, porchDone, checkpoint, invuln, x: moth.x, y: moth.y }; },
    enter() {
      Captions.clear();
      particles.clear();
      Sound.setAct('town');
      Sound.setRain(0.04);
      Sound.setWind(0.05);
      Sound.setCity(0.09);
      Sound.setRoom(0);
      Sound.setHeart(false);
      moth.reset(260, 520);
      cam.zoom = 1;
      cam.snap(820, 450);
      time = 0; entry = 0;
      dazzle = 0; hit = null; invuln = 0;
      checkpoint = checkpoints[0];
      nextCheckpoint = 1;
      nearLamp = null;
      cut = null;
      porchDone = false;
      juneGone = false;
      lampLit = 1;
      flash = 0;
      leaving = false;
      cinema = 0;
      for (const key in flags) delete flags[key];
    },
    update(dt) {
      time += dt;
      entry += dt;
      Captions.update(dt);
      invuln = Math.max(0, invuln - dt);
      flash = Math.max(0, flash - dt * 3);
      cinema = damp(cinema, cut ? 1 : 0, 3.5, dt);

      if (cut) {
        cut.t += dt;
        if (cut.t < 12.8) {
          moth.frozen = true;
          const t = cut.t;
          const targetDown = smoothstep(7.6, 8.8, t);
          const bob = Math.sin(t * 1.2) * 5;
          const orbitX = lerp(porch.lampX - 74, porch.juneX - 20, targetDown) + Math.sin(t * 0.8) * 8;
          const orbitY = lerp(porch.lampY - 36, porch.juneY - 98, targetDown) + bob;
          const glide = smoothstep(0, 1.25, t);
          moth.x = lerp(cut.startX, orbitX, glide);
          moth.y = lerp(cut.startY, orbitY, glide);
          moth.bank = Math.sin(t * 1.1) * 0.12;
          moth.flapPhase += dt * 13;
        }
        if (cut.t > 1.1) trigger('line1', () => Captions.add('June was sitting on the porch, the way she did every night.', { dur: 4.4 , y: 792 }));
        if (cut.t > 3.0) trigger('line2', () => Captions.add('You came back.', { speaker: 'JUNE', style: 'june', dur: 3.2 , y: 792 }));
        if (cut.t > 5.6) trigger('line3', () => Captions.add('The moth had never been here before.', { dur: 3.4 , y: 792 }));
        if (cut.t > 7.6) trigger('line4', () => Captions.add('Mama said you were little moons.', { speaker: 'JUNE', style: 'june', dur: 3.4 , y: 792 }));
        if (cut.t > 9.5 && !cut.lampDead) {
          const flick = Math.sin(cut.t * 37) > 0.1 ? 1 : 0.15;
          lampLit = cut.t > 10.3 ? 0 : flick * clamp(1 - (cut.t - 9.5) / 0.8, 0, 1);
          if (cut.t > 10.3) {
            cut.lampDead = true;
            lampLit = 0;
            Sound.sfx('respawn');
            Sound.sfx('hurt');
            cam.shake(0.18);
            Captions.add('No— no, not tonight.', { speaker: 'JUNE', style: 'june', dur: 3.2 , y: 792 });
          }
        }
        if (cut.t > 11.8) trigger('line5', () => Captions.add('The lamp went out. But the window was still open.', { dur: 4.4, style: 'memory' , y: 792 }));
        if (cut.t > 12.8) {
          cut.doorOpen = smoothstep(13.2, 14.0, cut.t) * (1 - smoothstep(14.95, 15.2, cut.t));
          if (cut.t > 14.0) Sound.setCity(0.04);
        }
        if (cut.t > 15.2) {
          cut = null;
          porchDone = true;
          juneGone = true;
          moth.frozen = false;
          moth.x = porch.juneX - 6;
          moth.y = porch.juneY - 130;
          moth.vx = 0; moth.vy = 0;
          Sound.playTheme({ instrument: 'box', gain: 0.32, delay: 0.2 });
        }
        cam.cx = damp(cam.cx, 6058, 1.7, dt);
        cam.cy = damp(cam.cy, 552, 1.7, dt);
        cam.zoom = damp(cam.zoom, 1.17, 1.5, dt);
        cam.clampToWorld();
        cam.update(dt, time);
        particles.update(dt);
        return;
      }

      if (hit) {
        hit.t += dt;
        moth.frozen = true;
        if (hit.type === 'dazzle') {
          const l = hit.lamp;
          moth.x = damp(moth.x, l.x, 5, dt);
          moth.y = damp(moth.y, l.y, 5, dt);
        }
        if (hit.t > 0.85) respawnFromHit();
        cam.update(dt, time);
        particles.update(dt);
        return;
      }

      if (!porchDone && moth.x > 5560) {
        startCutscene();
        return;
      }

      if (!porchDone) {
        if (moth.x > 5000) trigger('porchNear', () => Captions.add('Then she saw it: one small amber star, keeping watch over a sleeping street.', { dur: 6 }));
      }

      if (!porchDone) {
        for (let i = nextCheckpoint; i < checkpoints.length; i++) {
          if (moth.x > checkpoints[i].x) {
            checkpoint = checkpoints[i];
            nextCheckpoint = i + 1;
            trigger('cp' + i, () => {});
          }
        }
      }

      for (let i = 0; i < zappers.length; i++) {
        const z = zappers[i];
        z.on = ((time + z.phase) % z.period) < z.onT;
        if (z.on !== lastZapState[i]) {
          lastZapState[i] = z.on;
          if (Math.abs(moth.x - z.x) < 700) Sound.sfx(z.on ? 'charge' : 'spark', { pan: (z.x - cam.cx) / 900 });
        }
      }

      const env = {
        windX: Math.sin(time * 0.37) * 18,
        windY: 0,
        gravity: 130,
        camX: cam.cx
      };
      const grace = entry < 5.4;
      nearLamp = null;
      let best = 1e9;
      if (!porchDone && !hit && !cut && !grace) {
        for (const l of lamps) {
          const d = dist(moth.x, moth.y, l.x, l.y);
          if (d < l.r && d < best) {
            best = d;
            nearLamp = l;
          }
        }
      }
      if (nearLamp) {
        const dx = nearLamp.x - moth.x;
        const dy = nearLamp.y - moth.y;
        const d = Math.max(1, Math.hypot(dx, dy));
        env.forceX = dx / d * (80 + dazzle * 1.5);
        env.forceY = dy / d * (80 + dazzle * 1.5);
        dazzle = Math.min(100, dazzle + 57 * dt);
        if (dazzle > 4) trigger('firstDazzle', () => Captions.add('The light was warm. It was not home.', { dur: 5.2 }));
        if (Math.random() < dt * 18) {
          particles.add({
            x: moth.x + rand(40, -40), y: moth.y + rand(40, -40),
            vx: (dx / d) * 60 + rand(30, -30), vy: (dy / d) * 60 + rand(30, -30),
            life: rand(1.1, 0.4), size: rand(1.8, 0.6), color: '#ffcf8d', type: 'dot', drag: 0.6, alpha: 0.5, shrink: -0.6
          });
        }
        if (dazzle >= 100 && invuln <= 0) {
          hit = { type: 'dazzle', t: 0, lamp: nearLamp };
          moth.frozen = true;
          flash = 1;
          cam.shake(0.6);
          Sound.sfx('zap');
          Sound.sfx('dazzle');
          particles.burst(moth.x, moth.y, { count: 30, speed: 260, color: ['#ffe4ad', '#ffb35c', '#fff7e6'], size: 2.6, life: 1.2, drag: 1.4, twinkle: 1 });
          trigger('firstDazzleHit', () => Captions.add('Some lights were lies.', { dur: 4.4 }));
        }
      } else {
        dazzle = Math.max(0, dazzle - 52 * dt);
      }
      if (nearLamp) {
        const pull = 1 - best / nearLamp.r;
        cam.shake(dt * pull * 0.15);
      }

      moth.update(dt, particles, env);
      moth.x = clamp(moth.x, 70, worldW - 80);
      moth.y = clamp(moth.y, 110, 748);
      if (moth.y >= 748) moth.vy = Math.min(moth.vy, 0);
      if (moth.y <= 110) moth.vy = Math.max(moth.vy, 0);
      if (moth.x <= 70) moth.vx = Math.max(moth.vx, 0);

      if (!porchDone && invuln <= 0 && !grace) {
        for (const z of zappers) {
          if (z.on && Math.abs(moth.x - z.x) < z.w / 2 + 14 && Math.abs(moth.y - z.y) < z.h / 2 + 14) {
            hit = { type: 'zap', t: 0, zapper: z };
            moth.frozen = true;
            invuln = 1;
            flash = 1;
            cam.shake(0.8);
            Sound.sfx('zap');
            particles.burst(moth.x, moth.y, { count: 30, speed: 300, color: ['#d7ecff', '#ffffff', '#9ac8ff'], size: 2.4, life: 1.1, drag: 1.5, twinkle: 1 });
            trigger('firstZap', () => Captions.add('Some lights bite.', { dur: 4.2 }));
            break;
          }
        }
      }

      if (porchDone) {
        const wx = porch.windowX + porch.windowW / 2;
        const wy = porch.windowY + porch.windowH * 0.8;
        if (dist(moth.x, moth.y, wx, wy) < 96 && !leaving) {
          leaving = true;
          Game.go('room', {}, { duration: 1.8 });
        }

      }

      if (!porchDone) {
        if (entry > 5.2 && moth.x > 900) trigger('intro1', () => Captions.add('The town was a constellation that had fallen into the valley.', { dur: 6 }));
        if (entry > 5.2 && moth.x > 2300) trigger('intro2', () => Captions.add('Every window was a star. None of them were home.', { dur: 5.4 }));
      }

      const targetLookX = clamp(moth.vx * 0.3, -130, 130) + (porchDone ? 80 : 0);
      cam.follow(moth.x, moth.y, dt, { lookX: targetLookX, lookY: clamp(moth.vy * 0.1, -40, 40), smooth: 2.6, zoom: porchDone ? 1.04 : 1 });
      cam.update(dt, time);
      particles.update(dt);

      if (moth.glow != null) moth.glow = 1;
      if (Math.random() < dt * 3.5) {
        const x = cam.cx + rand(700, -700);
        particles.add({ x, y: 830, vx: rand(6, -6), vy: rand(-20, -8), life: rand(4, 2), size: rand(1.2, 0.4), color: '#ffd28a', type: 'dot', drag: 0.2, alpha: 0.25, twinkle: 1 });
      }
    },
    draw(ctx) {
      drawSky([[0, '#03060d'], [0.28, '#071126'], [0.55, '#0b1a2f'], [0.74, '#11283a'], [0.85, '#152c38'], [1, '#050a12']]);
      stars.draw(cam.cx, time, { parallax: 0.02, alpha: 0.9 });
      drawMoon(1240, 158, 74, time, { aura: true, alpha: 0.9 });
      clouds.draw(cam.cx, time, { parallax: 0.05, alpha: 0.8 });
      drawSkyline();
      drawMistBand(560, 100, '#668d9c', 0.05, time, cam.cx);
      ctx.save();
      cam.apply(ctx);
      drawStreet();
      for (const h of houses) drawHouse(h);
      for (const n of neon) drawNeon(n);
      for (const l of lamps) drawLamp(l);
      for (const z of zappers) drawZapper(z);
      drawPorchScene();
      drawWindowTarget();
      particles.draw(ctx);
      const glow = porchDone ? 1 : 1;
      moth.draw(ctx, time, { glow });
      if (cut && cut.lampDead) {
        Glow.draw(ctx, moth.x, moth.y, 260, '#ffb35f', 0.11);
        Glow.draw(ctx, moth.x, moth.y, 110, '#ffd190', 0.2);
      }
      ctx.restore();
      if (flash > 0.01) {
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = flash * 0.5;
        ctx.fillStyle = '#cfe4ff';
        ctx.fillRect(0, 0, VW, VH);
        ctx.restore();
      }
      if (dazzle > 4 && !porchDone && !cut) {
        const k = dazzle / 100;
        const warm = ctx.createRadialGradient(VW / 2, VH / 2, 200, VW / 2, VH / 2, 900);
        warm.addColorStop(0, 'rgba(255,180,90,0)');
        warm.addColorStop(1, `rgba(255,158,72,${k * 0.16})`);
        ctx.fillStyle = warm;
        ctx.fillRect(0, 0, VW, VH);
        drawMeter(ctx, VW - 306, 82, 238, 'DAZZLE', dazzle, '#ffb066', { warn: dazzle > 65, alpha: 0.95 });
      }
      if (cut && cut.lampDead) {
        const k = smoothstep(10.2, 11.6, cut.t) * 0.22;
        ctx.fillStyle = `rgba(2,4,9,${k})`;
        ctx.fillRect(0, 0, VW, VH);
      }
      if (cinema > 0.01) {
        const bar = 74 * easeInOutCubic(cinema);
        ctx.fillStyle = '#020308';
        ctx.fillRect(0, 0, VW, bar);
        ctx.fillRect(0, VH - bar, VW, bar);
        drawText('III', VW - 70, bar / 2 + 5, { size: 14, family: SERIF, color: 'rgba(235,222,199,0.35)', align: 'center' });
      }
      if (!porchDone && !cut) {
        const objA = entry < 1 ? 0 : entry < 9 ? 1 : Math.max(0, 1 - (entry - 9) / 2);
        if (objA > 0) drawSpaced('FIND THE PORCH LIGHT', VW / 2, 68, { size: 11, spacing: 5, align: 'center', color: 'rgba(240,229,209,0.58)', alpha: objA });
      }
      if (porchDone && !leaving) {
        drawSpaced('FOLLOW HER INSIDE', VW / 2, 68, { size: 11, spacing: 5, align: 'center', color: 'rgba(220,235,238,0.62)' });
      }
      if (!porchDone) drawControlsHint(ctx, entry > 2 ? Math.max(0, 1 - (entry - 12) / 3) * 0.6 : 0, 'M  MUTE      ESC  PAUSE');
      drawChapterCard(ctx, entry, 0.5, 'III', 'The Town', 'every light calls; only one is home');
      Captions.draw(ctx);
      drawMuteBadge(ctx);
      if (DEBUG) drawDebugOverlay('town');
    }
  };
}

function makeRoomScene() {
  const worldW = 2150;
  const cam = new Camera(worldW, VH);
  const moth = new Moth();
  const particles = new Particles(1200);
  const memories = [
    { id: 'drawing', x: 100, y: 514, r: 95, charge: 0, lit: false, t: 0, caption: 'A moon with wings. Under it, in crayon: for Mama.' },
    { id: 'kettle', x: 342, y: 600, r: 95, charge: 0, lit: false, t: 0, caption: 'Tea at midnight. Two cups, always.' },
    { id: 'chair', x: 1080, y: 640, r: 110, charge: 0, lit: false, t: 0, caption: 'It still held the shape of her. June never sat in it.' },
    { id: 'photo', x: 1785, y: 620, r: 95, charge: 0, lit: false, t: 0, caption: 'The last good summer. Flour in her hair, laughing.' }
  ];
  const musicBox = { id: 'box', x: 708, y: 288, r: 92, charge: 0, lit: false, t: 0, ready: false, caption: 'Sleep, little moon. The night is long.' };
  const juneHand = { x: 1474, y: 624 };
  const flags = {};
  const trigger = (key, fn) => { if (!flags[key]) { flags[key] = true; fn(); } };
  let time = 0, entry = 0;
  let glow = 72;
  let litCount = 0;
  let faint = null;
  let finale = null;
  let leaving = false;
  let boxOpened = false;

  function drawWall() {
    const g = ctx.createLinearGradient(0, 60, 0, 790);
    g.addColorStop(0, '#0c1220');
    g.addColorStop(0.55, '#101827');
    g.addColorStop(1, '#080c14');
    ctx.fillStyle = g;
    ctx.fillRect(-50, 40, worldW + 100, 760);
    ctx.strokeStyle = 'rgba(110,140,160,0.03)';
    ctx.lineWidth = 1;
    for (let x = 10; x < worldW; x += 34) {
      ctx.beginPath();
      ctx.moveTo(x, 60);
      ctx.lineTo(x, 788);
      ctx.stroke();
    }
    ctx.fillStyle = '#0c111b';
    ctx.fillRect(-50, 780, worldW + 100, 120);
    const fg = ctx.createLinearGradient(0, 782, 0, 920);
    fg.addColorStop(0, '#101521');
    fg.addColorStop(0.4, '#0b101a');
    fg.addColorStop(1, '#05080e');
    ctx.fillStyle = fg;
    ctx.fillRect(-50, 788, worldW + 100, 140);
    ctx.strokeStyle = 'rgba(120,145,160,0.06)';
    for (let i = 0; i < 18; i++) {
      ctx.beginPath();
      ctx.moveTo(i * 130 - 40, 790);
      ctx.lineTo(i * 150 - 100, 910);
      ctx.stroke();
    }
    ctx.strokeStyle = 'rgba(150,175,185,0.1)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-50, 788);
    ctx.lineTo(worldW + 50, 788);
    ctx.stroke();
    ctx.fillStyle = '#0c121d';
    ctx.fillRect(-50, 40, worldW + 100, 22);
    ctx.strokeStyle = 'rgba(130,155,165,0.08)';
    ctx.beginPath();
    ctx.moveTo(-50, 62);
    ctx.lineTo(worldW + 50, 62);
    ctx.stroke();
  }

  function drawWindow(warm) {
    const wx = 1870, wy = 182, ww = 150, wh = 300;
    ctx.fillStyle = '#04070c';
    ctx.fillRect(wx - 14, wy - 14, ww + 28, wh + 28);
    if (warm > 0.02) {
      const sky = ctx.createLinearGradient(0, wy, 0, wy + wh);
      sky.addColorStop(0, '#4a5f8c');
      sky.addColorStop(0.5, '#e8a575');
      sky.addColorStop(1, '#ffcf95');
      ctx.fillStyle = sky;
      ctx.fillRect(wx, wy, ww, wh);
      Glow.draw(ctx, wx + ww * 0.7, wy + wh * 0.76, 130, '#ffd294', 0.3 * warm);
      ctx.fillStyle = 'rgba(255,228,173,0.9)';
      fillCircle(ctx, wx + ww * 0.68, wy + wh * 0.72, 24);
    } else {
      const sky = ctx.createLinearGradient(0, wy, 0, wy + wh);
      sky.addColorStop(0, '#0c1830');
      sky.addColorStop(0.6, '#162c42');
      sky.addColorStop(1, '#1c3a4e');
      ctx.fillStyle = sky;
      ctx.fillRect(wx, wy, ww, wh);
      for (let i = 0; i < 9; i++) {
        const sx = wx + 12 + fract(i * 0.618) * (ww - 24);
        const sy = wy + 14 + fract(i * 0.371) * wh * 0.55;
        ctx.globalAlpha = 0.3 + 0.4 * Math.sin(time * 1.1 + i);
        ctx.fillStyle = '#cfe4f2';
        fillCircle(ctx, sx, sy, 0.8 + fract(i * 0.71) * 1.2);
      }
      ctx.globalAlpha = 1;
      Glow.draw(ctx, wx + ww * 0.76, wy + wh * 0.22, 62, '#cfe6ec', 0.09);
      ctx.fillStyle = 'rgba(220,238,244,0.55)';
      fillCircle(ctx, wx + ww * 0.76, wy + wh * 0.22, 6);
    }
    ctx.strokeStyle = 'rgba(140,175,185,0.2)';
    ctx.lineWidth = 2;
    ctx.strokeRect(wx + 0.5, wy + 0.5, ww - 1, wh - 1);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(wx + ww / 2, wy);
    ctx.lineTo(wx + ww / 2, wy + wh * 0.58);
    ctx.moveTo(wx, wy + wh * 0.58);
    ctx.lineTo(wx + ww, wy + wh * 0.58);
    ctx.stroke();
    ctx.fillStyle = '#02050a';
    ctx.fillRect(wx + 5, wy + wh * 0.58 + 4, ww - 10, wh * 0.42 - 9);
    const sway = Math.sin(time * 0.7) * 6;
    ctx.strokeStyle = 'rgba(120,148,162,0.12)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(wx + 10 + sway, wy + wh * 0.58);
    ctx.quadraticCurveTo(wx + 4 + sway, wy + wh * 0.8, wx + 12 + sway, wy + wh - 10);
    ctx.stroke();
    ctx.fillStyle = '#050a0f';
    ctx.beginPath();
    ctx.moveTo(wx - 20, wy - 20);
    ctx.lineTo(wx - 2, wy - 6);
    ctx.lineTo(wx - 2, wy + wh + 4);
    ctx.lineTo(wx - 28, wy + wh + 18);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(wx + ww + 20, wy - 20);
    ctx.lineTo(wx + ww + 2, wy - 6);
    ctx.lineTo(wx + ww + 2, wy + wh + 4);
    ctx.lineTo(wx + ww + 28, wy + wh + 18);
    ctx.closePath();
    ctx.fill();
    if (warm > 0.02) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      const beam = ctx.createLinearGradient(wx, wy, wx - 420, 900);
      beam.addColorStop(0, `rgba(255,190,120,${0.1 * warm})`);
      beam.addColorStop(1, 'rgba(255,170,90,0)');
      ctx.fillStyle = beam;
      ctx.beginPath();
      ctx.moveTo(wx, wy);
      ctx.lineTo(wx + ww, wy + 30);
      ctx.lineTo(1200, 900);
      ctx.lineTo(400, 900);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
  }

  function drawWindowNightGlow() {
    const wx = 1945, wy = 250;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    Glow.draw(ctx, wx, wy + 90, 290, '#a6cbd8', 0.1);
    const beam = ctx.createLinearGradient(wx, 300, wx - 380, 860);
    beam.addColorStop(0, 'rgba(160,200,215,0.1)');
    beam.addColorStop(1, 'rgba(160,200,215,0)');
    ctx.fillStyle = beam;
    ctx.beginPath();
    ctx.moveTo(1870, 280);
    ctx.lineTo(2020, 280);
    ctx.lineTo(1600, 880);
    ctx.lineTo(1000, 880);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  function drawFridge() {
    ctx.fillStyle = '#0c121d';
    roundRect(ctx, 34, 420, 126, 370, 8);
    ctx.fill();
    ctx.strokeStyle = 'rgba(135,165,175,0.11)';
    ctx.lineWidth = 1.2;
    roundRect(ctx, 34.5, 420.5, 125, 369, 8);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(150,175,185,0.13)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(40, 480);
    ctx.lineTo(154, 480);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(160,175,170,0.16)';
    ctx.beginPath();
    ctx.moveTo(144, 492);
    ctx.lineTo(144, 548);
    ctx.stroke();
    ctx.fillStyle = '#0f1521';
    ctx.fillRect(66, 492, 52, 62);
    ctx.strokeStyle = 'rgba(210,210,190,0.12)';
    ctx.strokeRect(66.5, 492.5, 51, 61);
  }

  function drawCounter() {
    ctx.fillStyle = '#0c121c';
    ctx.fillRect(172, 650, 358, 140);
    ctx.fillStyle = '#0f1521';
    ctx.fillRect(166, 642, 370, 12);
    ctx.strokeStyle = 'rgba(135,160,170,0.1)';
    ctx.beginPath();
    ctx.moveTo(166, 642);
    ctx.lineTo(536, 642);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(120,145,155,0.06)';
    for (let x = 196; x < 530; x += 56) {
      ctx.beginPath();
      ctx.moveTo(x, 656);
      ctx.lineTo(x, 782);
      ctx.stroke();
    }
    ctx.fillStyle = '#101725';
    ctx.fillRect(232, 668, 96, 66);
    ctx.strokeStyle = 'rgba(150,170,175,0.1)';
    ctx.strokeRect(232.5, 668.5, 95, 65);
    ctx.fillStyle = '#0e141e';
    ctx.beginPath();
    ctx.ellipse(342, 602, 33, 25, 0, 0, TAU);
    ctx.fill();
    ctx.lineWidth = 6;
    ctx.strokeStyle = '#0e141e';
    ctx.beginPath();
    ctx.moveTo(316, 606);
    ctx.quadraticCurveTo(298, 592, 304, 574);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(145,170,175,0.16)';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.ellipse(342, 602, 33, 25, 0, Math.PI * 0.9, Math.PI * 1.9);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(145,170,175,0.12)';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.arc(352, 576, 26, Math.PI * 1.12, Math.PI * 1.9);
    ctx.stroke();
  }

  function drawCups(a) {
    for (let i = 0; i < 2; i++) {
      const x = 408 + i * 48;
      ctx.save();
      ctx.globalAlpha = a;
      ctx.fillStyle = 'rgba(240,208,160,0.55)';
      ctx.beginPath();
      ctx.ellipse(x, 634, 13, 5, 0, 0, TAU);
      ctx.fill();
      ctx.fillStyle = 'rgba(220,160,100,0.3)';
      ctx.beginPath();
      ctx.ellipse(x, 633, 10, 4, 0, 0, TAU);
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,215,165,0.2)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x - 2, 622);
      ctx.bezierCurveTo(x - 12, 606, x + 10, 596, x - 2, 576);
      ctx.stroke();
      ctx.restore();
    }
  }

  function drawShelf() {
    ctx.fillStyle = '#0b1019';
    ctx.fillRect(618, 300, 184, 490);
    ctx.fillStyle = '#080b11';
    ctx.fillRect(610, 300, 200, 12);
    ctx.strokeStyle = 'rgba(140,165,170,0.12)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(610, 300);
    ctx.lineTo(810, 300);
    ctx.stroke();
    for (let i = 0; i < 4; i++) {
      const y = 332 + i * 110;
      ctx.fillStyle = '#0f1520';
      ctx.fillRect(614, y, 192, 9);
      ctx.strokeStyle = 'rgba(130,155,160,0.07)';
      ctx.beginPath();
      ctx.moveTo(614, y);
      ctx.lineTo(806, y);
      ctx.stroke();
      let bx = 624;
      while (bx < 788) {
        const w = 9 + fract(bx * 0.37 + i) * 8;
        const h = 28 + fract(bx * 0.71 + i * 0.3) * 48;
        ctx.fillStyle = i % 2 === 0 ? '#0b101a' : '#06090e';
        ctx.fillRect(bx, y - h, w, h);
        if (fract(bx * 0.91) > 0.7) {
          ctx.fillStyle = 'rgba(120,150,160,0.12)';
          ctx.fillRect(bx + 2, y - h + 5, 1, h - 10);
        }
        bx += w + 4 + fract(bx * 0.53) * 9;
      }
    }
  }

  function drawMusicBoxShape() {
    const x = musicBox.x, y = musicBox.y;
    ctx.save();
    ctx.translate(x, y);
    if (musicBox.lit) {
      Glow.draw(ctx, 0, 5, 260, '#ffc36f', 0.22);
      Glow.draw(ctx, 0, 4, 85, '#ffe0a4', 0.3);
    }
    ctx.fillStyle = musicBox.lit ? '#3b2513' : '#0f1521';
    roundRect(ctx, -30, -4, 60, 32, 4);
    ctx.fill();
    ctx.strokeStyle = musicBox.lit ? 'rgba(255,214,152,0.55)' : 'rgba(140,165,170,0.16)';
    ctx.lineWidth = 1.3;
    roundRect(ctx, -29.5, -3.5, 59, 31, 4);
    ctx.stroke();
    if (boxOpened) {
      ctx.fillStyle = musicBox.lit ? '#4a2c16' : '#0c1016';
      roundRect(ctx, -30, -20, 60, 18, 3);
      ctx.fill();
      ctx.strokeStyle = musicBox.lit ? 'rgba(255,214,152,0.4)' : 'rgba(140,165,170,0.12)';
      ctx.stroke();
    }
    if (musicBox.lit) {
      ctx.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 4; i++) {
        const a = time * 1.2 + i * 1.7;
        const nx = Math.cos(a) * (22 + i * 9);
        const ny = -36 - fract(time * 0.2 + i * 0.27) * 82 + Math.sin(a) * 8;
        ctx.globalAlpha = 0.16 + 0.12 * Math.sin(time * 2 + i);
        ctx.fillStyle = '#ffe3af';
        ctx.beginPath();
        ctx.ellipse(nx, ny, 2.2, 4.5, a * 0.3, 0, TAU);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
    }
    ctx.restore();
  }

  function drawArmchair() {
    const x = 990, y = 560;
    ctx.fillStyle = '#0b1019';
    roundRect(ctx, x, y, 180, 230, 26);
    ctx.fill();
    ctx.fillRect(x + 12, 700, 156, 72);
    ctx.strokeStyle = 'rgba(140,168,175,0.14)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(x + 90, y + 160, 80, Math.PI * 1.08, Math.PI * 1.92);
    ctx.stroke();
    ctx.fillStyle = '#0c121d';
    roundRect(ctx, x + 18, y + 126, 144, 90, 18);
    ctx.fill();
    ctx.strokeStyle = 'rgba(120,145,155,0.1)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x + 32, y + 140);
    ctx.quadraticCurveTo(x + 90, y + 154, x + 148, y + 140);
    ctx.stroke();
    ctx.fillStyle = '#101622';
    ctx.beginPath();
    ctx.ellipse(x + 40, y + 150, 24, 44, 0.3, 0, TAU);
    ctx.ellipse(x + 140, y + 150, 24, 44, -0.3, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#0c121c';
    ctx.beginPath();
    ctx.ellipse(x + 138, y + 110, 34, 15, -0.5, 0, TAU);
    ctx.fill();
  }

  function drawSofa() {
    const x = 1290, y = 590, w = 420;
    ctx.fillStyle = '#0b1019';
    roundRect(ctx, x, y, w, 200, 24);
    ctx.fill();
    ctx.fillStyle = '#0c121d';
    roundRect(ctx, x + 14, y + 24, w - 28, 80, 18);
    ctx.fill();
    ctx.fillStyle = '#0d131e';
    roundRect(ctx, x - 18, y + 92, 44, 104, 20);
    ctx.fill();
    roundRect(ctx, x + w - 26, y + 92, 44, 104, 20);
    ctx.fill();
    ctx.fillStyle = '#101725';
    roundRect(ctx, x + 20, y + 96, w - 40, 48, 16);
    ctx.fill();
    ctx.strokeStyle = 'rgba(140,165,170,0.09)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x + 22, y + 102);
    ctx.quadraticCurveTo(x + 90, y + 112, x + 150, y + 102);
    ctx.stroke();
    ctx.fillStyle = '#05090f';
    ctx.fillRect(x + 24, y + 172, 16, 30);
    ctx.fillRect(x + w - 40, y + 172, 16, 30);
  }

  function drawSideTable() {
    ctx.fillStyle = '#0c121d';
    ctx.fillRect(1732, 652, 108, 10);
    ctx.fillRect(1740, 662, 6, 72);
    ctx.fillRect(1826, 662, 6, 72);
    ctx.fillStyle = '#0f1520';
    roundRect(ctx, 1740, 640, 92, 14, 3);
    ctx.fill();
    ctx.fillStyle = '#0b1019';
    roundRect(ctx, 1760, 568, 54, 74, 3);
    ctx.fill();
    ctx.strokeStyle = 'rgba(150,175,180,0.16)';
    ctx.lineWidth = 1.4;
    roundRect(ctx, 1760.5, 568.5, 53, 73, 3);
    ctx.stroke();
    ctx.fillStyle = 'rgba(190,210,205,0.07)';
    ctx.fillRect(1765, 574, 44, 62);
  }

  function drawCat(wake) {
    const x = 1218, y = 786;
    ctx.fillStyle = '#0b1019';
    ctx.beginPath();
    ctx.ellipse(x, y - 10, 28, 13, 0.05, 0, TAU);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(x + 22, y - 22, 12, 10, 0, 0, TAU);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(x + 15, y - 30);
    ctx.lineTo(x + 18, y - 38);
    ctx.lineTo(x + 23, y - 31);
    ctx.closePath();
    ctx.moveTo(x + 26, y - 31);
    ctx.lineTo(x + 31, y - 38);
    ctx.lineTo(x + 32, y - 28);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,205,140,0.24)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(x + 22, y - 24, 9, Math.PI * 0.8, Math.PI * 1.55);
    ctx.stroke();
    if (wake > 0.2) {
      ctx.fillStyle = `rgba(255,205,120,${wake * 0.8})`;
      fillCircle(ctx, x + 25, y - 24, 1.2);
      fillCircle(ctx, x + 19, y - 24, 1.2);
    }
  }
  function drawJuneRoom(sit, awake, ghost) {
    const x = 1540, y = 690;
    const breathe = Math.sin(time * 1.1) * 1.2;
    ctx.save();
    if (ghost > 0.01) {
      const gx = x + 132, gy = y - 150;
      ctx.save();
      ctx.globalAlpha = ghost;
      ctx.globalCompositeOperation = 'lighter';
      Glow.draw(ctx, gx, y - 74, 150, '#ffc478', 0.06);
      Glow.draw(ctx, gx, gy, 44, '#ffe0ac', 0.09);
      ctx.globalCompositeOperation = 'source-over';
      ctx.strokeStyle = 'rgba(255,223,173,0.5)';
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.arc(gx, gy, 15, 0, TAU);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(gx - 20, gy + 24);
      ctx.bezierCurveTo(gx - 30, gy + 58, gx - 34, y - 18, gx - 22, y - 4);
      ctx.bezierCurveTo(gx - 4, y + 8, gx + 26, y + 8, gx + 34, y - 8);
      ctx.bezierCurveTo(gx + 36, gy + 50, gx + 24, gy + 26, gx + 17, gy + 23);
      ctx.stroke();
      ctx.fillStyle = 'rgba(255,222,170,0.06)';
      ctx.beginPath();
      ctx.moveTo(gx - 20, gy + 24);
      ctx.bezierCurveTo(gx - 30, gy + 58, gx - 34, y - 18, gx - 22, y - 4);
      ctx.bezierCurveTo(gx - 4, y + 8, gx + 26, y + 8, gx + 34, y - 8);
      ctx.bezierCurveTo(gx + 36, gy + 50, gx + 24, gy + 26, gx + 17, gy + 23);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,220,166,0.35)';
      ctx.lineWidth = 7;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(gx - 18, gy + 48);
      ctx.quadraticCurveTo(gx - 56, gy + 68, gx - 84, gy + 82);
      ctx.stroke();
      ctx.strokeStyle = 'rgba(255,220,166,0.32)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(gx + 10, gy + 2, 18, Math.PI * 0.3, Math.PI * 1.2);
      ctx.moveTo(gx + 16, gy + 12);
      ctx.quadraticCurveTo(gx + 26, gy + 44, gx + 20, gy + 78);
      ctx.stroke();
      ctx.restore();
    }
    const rim = (glow > 24 || finale) ? 'rgba(255,198,132,0.4)' : 'rgba(150,184,200,0.3)';
    if (sit < 0.99) {
      ctx.globalAlpha = 1 - sit;
      const bg = ctx.createLinearGradient(x - 92, y - 120, x + 68, y);
      bg.addColorStop(0, '#18152f');
      bg.addColorStop(0.6, '#131125');
      bg.addColorStop(1, '#0d0c19');
      ctx.fillStyle = bg;
      ctx.beginPath();
      ctx.moveTo(x - 94, y - 4);
      ctx.bezierCurveTo(x - 98, y - 60, x - 56, y - 114, x + 4, y - 112 + breathe);
      ctx.bezierCurveTo(x + 52, y - 110, x + 74, y - 62, x + 64, y - 4);
      ctx.closePath();
      ctx.fill();
      ctx.save();
      ctx.clip();
      ctx.strokeStyle = 'rgba(122,126,170,0.15)';
      ctx.lineWidth = 1;
      for (let i = 0; i < 5; i++) {
        ctx.beginPath();
        ctx.moveTo(x - 92 + i * 30, y - 108);
        ctx.quadraticCurveTo(x - 74 + i * 26, y - 60, x - 84 + i * 32, y - 4);
        ctx.stroke();
      }
      ctx.restore();
      ctx.fillStyle = '#0a0e17';
      ctx.beginPath();
      ctx.ellipse(x - 54, y - 44, 21, 26, -0.25, 0, TAU);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(x - 30, y - 22, 20, 15, 0.2, 0, TAU);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(x - 68, y - 12, 17, 9, -0.1, 0, TAU);
      ctx.fill();
      const hx = x - 38, hy = y - 124 + breathe;
      ctx.fillStyle = '#0b0f18';
      ctx.beginPath();
      ctx.ellipse(hx + 9, hy + 2, 18, 19, 0.14, 0, TAU);
      ctx.fill();
      ctx.fillStyle = '#0c101a';
      ctx.beginPath();
      ctx.ellipse(hx, hy, 15, 16.5, -0.15, 0, TAU);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(hx - 12, hy + 1);
      ctx.lineTo(hx - 19, hy + 6);
      ctx.lineTo(hx - 11, hy + 9);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#0b0f18';
      ctx.beginPath();
      ctx.moveTo(hx + 7, hy - 15);
      ctx.bezierCurveTo(hx + 27, hy - 6, hx + 33, hy + 18, hx + 21, hy + 34);
      ctx.bezierCurveTo(hx + 27, hy + 12, hx + 21, hy - 2, hx + 5, hy - 5);
      ctx.closePath();
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(hx + 21, hy - 11, 7.5, 8.5, 0.4, 0, TAU);
      ctx.fill();
      ctx.strokeStyle = rim;
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.arc(hx, hy, 15.5, Math.PI * 0.55, Math.PI * 1.5);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(hx - 12, hy + 12);
      ctx.bezierCurveTo(hx - 20, hy + 26, hx - 10, hy + 37, hx + 2, hy + 38);
      ctx.stroke();
      ctx.strokeStyle = 'rgba(255,206,148,0.24)';
      ctx.lineWidth = 1.1;
      ctx.beginPath();
      ctx.moveTo(x - 92, y - 6);
      ctx.bezierCurveTo(x - 96, y - 58, x - 54, y - 110, x + 2, y - 108);
      ctx.stroke();
      if (awake > 0.1) {
        ctx.fillStyle = `rgba(255,229,188,${0.2 + awake * 0.45})`;
        fillCircle(ctx, hx - 8, hy, 0.9);
        ctx.strokeStyle = 'rgba(255,220,170,0.28)';
        ctx.lineWidth = 0.7;
        ctx.beginPath();
        ctx.moveTo(hx - 10, hy + 6);
        ctx.lineTo(hx - 5, hy + 6);
        ctx.stroke();
      }
    }
    ctx.globalAlpha = sit;
    if (sit > 0.01) {
      const hx = x + 2, hy = y - 136;
      ctx.fillStyle = '#0a0e17';
      ctx.beginPath();
      ctx.moveTo(x - 44, y - 2);
      ctx.bezierCurveTo(x - 56, y - 68, x - 28, y - 124, x + 4, y - 130);
      ctx.bezierCurveTo(x + 38, y - 120, x + 54, y - 68, x + 44, y - 2);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#0c101a';
      ctx.beginPath();
      ctx.ellipse(hx, hy, 16, 18, 0.04, 0, TAU);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(hx + 10, hy - 12);
      ctx.bezierCurveTo(hx + 30, hy + 2, hx + 30, hy + 26, hx + 16, hy + 42);
      ctx.bezierCurveTo(hx + 22, hy + 18, hx + 18, hy + 4, hx + 8, hy);
      ctx.closePath();
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(hx - 13, hy + 2);
      ctx.lineTo(hx - 20, hy + 7);
      ctx.lineTo(hx - 12, hy + 9);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = rim;
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(x - 42, y - 13);
      ctx.bezierCurveTo(x - 54, y - 72, x - 28, y - 118, x + 2, y - 124);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(hx, hy, 17, Math.PI * 0.62, Math.PI * 1.5);
      ctx.stroke();
      const handX = x - 66, handY = y - 66;
      ctx.strokeStyle = '#0a0e17';
      ctx.lineWidth = 9;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(x + 18, y - 104);
      ctx.quadraticCurveTo(x - 22, y - 102, handX, handY);
      ctx.stroke();
      ctx.strokeStyle = rim;
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(x + 18, y - 105);
      ctx.quadraticCurveTo(x - 22, y - 103, handX, handY - 1);
      ctx.stroke();
      ctx.strokeStyle = '#0a0e17';
      ctx.lineWidth = 11;
      ctx.beginPath();
      ctx.moveTo(x + 20, y - 16);
      ctx.quadraticCurveTo(x + 4, y + 22, x - 4, y + 48);
      ctx.moveTo(x + 30, y - 12);
      ctx.quadraticCurveTo(x + 20, y + 28, x + 16, y + 54);
      ctx.stroke();
      ctx.strokeStyle = 'rgba(255,198,132,0.2)';
      ctx.lineWidth = 1.1;
      ctx.beginPath();
      ctx.moveTo(x + 22, y - 14);
      ctx.quadraticCurveTo(x + 6, y + 24, x - 2, y + 50);
      ctx.stroke();
      if (awake > 0.15) {
        ctx.fillStyle = `rgba(255,229,188,${0.2 + awake * 0.55})`;
        fillCircle(ctx, hx - 8, hy + 1, 1);
        ctx.strokeStyle = 'rgba(255,222,172,0.42)';
        ctx.lineWidth = 0.8;
        ctx.beginPath();
        ctx.arc(hx + 1, hy + 12, 8, 0.18, Math.PI - 0.18);
        ctx.stroke();
      }
    }
    ctx.globalAlpha = 1;
    ctx.restore();
  }

  function drawGlimmer(mem) {
    if (mem.lit) return;
    if (mem === musicBox && !mem.ready) return;
    if (mem.x < cam.left - 100 || mem.x > cam.right + 100) return;
    const near = dist(moth.x, moth.y, mem.x, mem.y) < mem.r * 2.2;
    const pulse = 0.5 + 0.5 * Math.sin(time * 2 + mem.x * 0.01);
    const a = (mem === musicBox ? 0.3 : 0.17) * pulse + (near ? 0.16 : 0);
    Glow.draw(ctx, mem.x, mem.y - 8, 42 + pulse * 10, '#ffcc80', a);
    ctx.save();
    ctx.globalAlpha = 0.5 + pulse * 0.35;
    ctx.fillStyle = '#ffe3b1';
    fillCircle(ctx, mem.x, mem.y - 8, 2.2);
    ctx.restore();
    if (near && mem.charge > 0.01) {
      ctx.save();
      ctx.globalAlpha = 0.85;
      ctx.strokeStyle = 'rgba(255,214,150,0.7)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(mem.x, mem.y - 8, 21, -Math.PI / 2, -Math.PI / 2 + TAU * clamp(mem.charge, 0, 1));
      ctx.stroke();
      ctx.restore();
    }
  }

  function drawMemoryLight(mem) {
    if (!mem.lit) return;
    const t = mem.t;
    const fadeIn = smoothstep(0, 0.7, t);
    const persist = mem === musicBox ? 1 : 1 - smoothstep(5.5, 7.5, t);
    const a = fadeIn * persist;
    if (a <= 0.01) return;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    if (mem.id === 'drawing') {
      Glow.draw(ctx, mem.x, mem.y - 20, 220, '#ffc06f', 0.15 * a);
      ctx.globalAlpha = 0.5 * a;
      ctx.strokeStyle = '#ffdf9f';
      ctx.lineWidth = 1.3;
      ctx.beginPath();
      ctx.arc(mem.x + 2, mem.y - 66, 17, 0, TAU);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(mem.x - 14, mem.y - 66);
      ctx.quadraticCurveTo(mem.x - 44, mem.y - 94, mem.x - 56, mem.y - 62);
      ctx.quadraticCurveTo(mem.x - 34, mem.y - 52, mem.x - 14, mem.y - 66);
      ctx.moveTo(mem.x + 18, mem.y - 66);
      ctx.quadraticCurveTo(mem.x + 48, mem.y - 94, mem.x + 60, mem.y - 62);
      ctx.quadraticCurveTo(mem.x + 38, mem.y - 52, mem.x + 18, mem.y - 66);
      ctx.stroke();
    } else if (mem.id === 'kettle') {
      Glow.draw(ctx, mem.x, mem.y, 230, '#ffc170', 0.16 * a);
      drawCups(0.7 * a);
      ctx.globalAlpha = 0.3 * a;
      ctx.strokeStyle = '#ffe0ad';
      ctx.lineWidth = 1.2;
      for (let i = 0; i < 3; i++) {
        const sx = mem.x - 6 + i * 10;
        ctx.beginPath();
        ctx.moveTo(sx, mem.y - 38);
        ctx.bezierCurveTo(sx - 12, mem.y - 64, sx + 12, mem.y - 82, sx - 2, mem.y - 108);
        ctx.stroke();
      }
    } else if (mem.id === 'chair') {
      Glow.draw(ctx, mem.x, mem.y - 40, 270, '#ffc478', 0.17 * a);
      const ghostA = a * (1 - smoothstep(3.5, 6.5, t)) * 0.3;
      if (ghostA > 0.01) {
        ctx.globalAlpha = ghostA;
        ctx.fillStyle = '#ffe0a9';
        ctx.beginPath();
        ctx.ellipse(mem.x, mem.y - 96, 42, 68, -0.08, 0, TAU);
        ctx.fill();
        ctx.beginPath();
        ctx.ellipse(mem.x - 4, mem.y - 168, 17, 19, -0.1, 0, TAU);
        ctx.fill();
        ctx.beginPath();
        ctx.ellipse(mem.x + 12, mem.y - 146, 14, 18, 0.5, 0, TAU);
        ctx.fill();
      }
    } else if (mem.id === 'photo') {
      Glow.draw(ctx, mem.x, mem.y - 10, 220, '#ffc778', 0.16 * a);
      ctx.globalAlpha = 0.28 * a;
      ctx.fillStyle = '#ffe3b4';
      ctx.fillRect(mem.x - 26, mem.y - 62, 52, 68);
      ctx.fillStyle = '#ffc67c';
      ctx.beginPath();
      ctx.ellipse(mem.x - 8, mem.y - 40, 8, 14, 0.1, 0, TAU);
      ctx.ellipse(mem.x + 10, mem.y - 30, 6, 10, -0.1, 0, TAU);
      ctx.fill();
      ctx.globalAlpha = 0.2 * a;
      for (let i = 0; i < 12; i++) {
        const px = mem.x + Math.sin(i * 3.1 + time) * 36;
        const py = mem.y - 40 + Math.cos(i * 2.3 + time * 0.7) * 36;
        fillCircle(ctx, px, py, 1.2);
      }
    } else if (mem.id === 'box') {
      Glow.draw(ctx, mem.x, mem.y + 4, 320, '#ffc16e', 0.2 * a);
      Glow.draw(ctx, mem.x, mem.y + 4, 100, '#ffe3b1', 0.32 * a);
    }
    ctx.restore();
  }

  function drawObjectHighlights() {
    for (const mem of memories) {
      if (!mem.lit) continue;
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      if (mem.id === 'drawing') {
        ctx.globalAlpha = 0.35;
        ctx.fillStyle = '#ffd997';
        ctx.fillRect(66, 492, 52, 62);
        ctx.globalAlpha = 0.55;
        ctx.strokeStyle = '#ffedbe';
        ctx.lineWidth = 1;
        ctx.strokeRect(67, 493, 50, 60);
        ctx.beginPath();
        ctx.arc(94, 520, 8, 0, TAU);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(87, 520);
        ctx.lineTo(99, 520);
        ctx.moveTo(94, 513);
        ctx.lineTo(94, 527);
        ctx.stroke();
      } else if (mem.id === 'kettle') {
        ctx.globalAlpha = 0.25;
        ctx.strokeStyle = '#ffdda1';
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.ellipse(342, 600, 34, 26, 0, Math.PI * 0.72, Math.PI * 1.9);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(352, 576, 27, Math.PI * 1.1, Math.PI * 1.9);
        ctx.stroke();
      } else if (mem.id === 'chair') {
        ctx.globalAlpha = 0.22;
        ctx.strokeStyle = '#ffd695';
        ctx.lineWidth = 1.3;
        roundRect(ctx, 1008, 578, 144, 194, 20);
        ctx.stroke();
      } else if (mem.id === 'photo') {
        ctx.globalAlpha = 0.35;
        ctx.fillStyle = '#ffd99a';
        ctx.fillRect(1760, 568, 54, 74);
        ctx.globalAlpha = 0.5;
        ctx.strokeStyle = '#ffecc4';
        ctx.strokeRect(1761, 569, 52, 72);
      }
      ctx.restore();
    }
    drawMusicBoxShape();
  }

  function drawDarkness() {
    const mx = VW / 2 + (moth.x - cam.cx) * cam.zoom;
    const my = VH / 2 + (moth.y - cam.cy) * cam.zoom;
    const hole = (155 + glow * 1.65 + litCount * 28) * cam.zoom;
    const base = Math.max(0, 0.52 - litCount * 0.095);
    const k = finale ? Math.max(0, 1 - finale.t / 2.2) : 1;
    const dark = (base + (faint ? 0.24 : 0)) * k;
    if (dark <= 0.005) return;
    const g = ctx.createRadialGradient(mx, my, hole * 0.55, mx, my, hole * 2.9);
    g.addColorStop(0, 'rgba(2,4,9,0)');
    g.addColorStop(0.38, `rgba(2,4,9,${dark * 0.3})`);
    g.addColorStop(0.72, `rgba(2,4,9,${dark * 0.78})`);
    g.addColorStop(1, `rgba(2,4,9,${dark})`);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, VW, VH);
    if (faint) {
      ctx.fillStyle = `rgba(2,4,9,${clamp(faint.t / 1.8, 0, 1) * 0.5})`;
      ctx.fillRect(0, 0, VW, VH);
    }
  }

  function drawMothLight() {
    const mx = VW / 2 + (moth.x - cam.cx) * cam.zoom;
    const my = VH / 2 + (moth.y - cam.cy) * cam.zoom;
    const r = (190 + glow * 1.75) * cam.zoom;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const g = ctx.createRadialGradient(mx, my, 10, mx, my, r);
    g.addColorStop(0, `rgba(255,172,82,${0.13 + glow / 900 + (finale ? 0.07 : 0)})`);
    g.addColorStop(0.45, 'rgba(255,155,70,0.03)');
    g.addColorStop(1, 'rgba(255,150,70,0)');
    ctx.fillStyle = g;
    ctx.fillRect(mx - r, my - r, r * 2, r * 2);
    ctx.restore();
  }

  function drawRoomBase() {
    drawWall();
    drawWindow(finale ? smoothstep(9, 12, finale.t) : 0);
    drawFridge();
    drawCounter();
    drawShelf();
    drawSofa();
    drawArmchair();
    drawSideTable();
    drawCat(finale ? smoothstep(8, 9.5, finale.t) : 0);
    ctx.fillStyle = '#0e131d';
    ctx.fillRect(760, 704, 166, 22);
    ctx.fillStyle = '#101622';
    ctx.fillRect(786, 700, 22, 5);
    ctx.fillStyle = '#111726';
    ctx.beginPath();
    ctx.ellipse(944, 730, 9, 16, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#0d141e';
    ctx.beginPath();
    ctx.moveTo(1220, 790);
    ctx.bezierCurveTo(1216, 736, 1238, 700, 1264, 684);
    ctx.lineTo(1278, 686);
    ctx.bezierCurveTo(1250, 712, 1236, 750, 1242, 790);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(1264, 684);
    ctx.quadraticCurveTo(1260, 650, 1244, 638);
    ctx.lineTo(1272, 636);
    ctx.quadraticCurveTo(1276, 660, 1278, 686);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = 'rgba(130,160,165,0.07)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(1264, 684);
    ctx.quadraticCurveTo(1250, 714, 1242, 790);
    ctx.stroke();
    const frames = [
      { x: 860, y: 214, w: 90, h: 112 },
      { x: 550, y: 224, w: 64, h: 82 },
      { x: 420, y: 210, w: 72, h: 96 }
    ];
    for (const f of frames) {
      ctx.fillStyle = '#0b1019';
      ctx.fillRect(f.x, f.y, f.w, f.h);
      ctx.strokeStyle = 'rgba(140,165,170,0.12)';
      ctx.lineWidth = 2;
      ctx.strokeRect(f.x + 2, f.y + 2, f.w - 4, f.h - 4);
      ctx.lineWidth = 1;
      ctx.strokeRect(f.x + f.w * 0.5, f.y + 4, 0.5, f.h - 8);
    }
    ctx.fillStyle = '#0c121c';
    ctx.beginPath();
    ctx.arc(614, 250, 25, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = 'rgba(140,170,175,0.14)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(614, 250, 26, 0, TAU);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(614, 250);
    ctx.lineTo(614, 234);
    ctx.moveTo(614, 250);
    ctx.lineTo(626, 256);
    ctx.stroke();
    ctx.fillStyle = '#0b1019';
    ctx.beginPath();
    ctx.ellipse(764, 756, 20, 28, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#0c121d';
    ctx.beginPath();
    ctx.ellipse(764, 744, 23, 9, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#0d141e';
    ctx.beginPath();
    ctx.ellipse(404, 772, 64, 15, 0, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = 'rgba(120,145,150,0.07)';
    ctx.beginPath();
    ctx.ellipse(404, 772, 66, 16, 0, 0, TAU);
    ctx.stroke();
  }

  function startFinale() {
    finale = { t: 0 };
    moth.frozen = true;
    musicBox.lit = true;
    musicBox.t = 0;
    glow = 100;
    boxOpened = true;
    Sound.setAct('finale');
    Sound.setHeart(false);
    Sound.playTheme({ instrument: 'box', gain: 0.85, delay: 0.6, major: true });
    cam.shake(0.18);
    Captions.add('The music box remembered the song.', { style: 'memory', dur: 5.5, y: 792 });
    particles.burst(musicBox.x, musicBox.y, { count: 50, speed: 210, color: ['#ffe6b8', '#ffc574', '#fff8e8'], size: 2.6, life: 3, drag: 0.9, twinkle: 1, g: -14 });
  }

  return {
    name: 'room',
    moth,
    get state() { return { glow, litCount, finale: !!finale, finaleT: finale ? finale.t : 0, faint: !!faint, boxReady: musicBox.ready, boxOpened, camX: cam.cx, camZoom: cam.zoom, memories: memories.map(m => m.lit) }; },
    enter() {
      Captions.clear();
      particles.clear();
      Sound.setAct('room');
      Sound.setRain(0);
      Sound.setWind(0.03);
      Sound.setCity(0.02);
      Sound.setRoom(0.09);
      Sound.setHeart(false);
      moth.reset(1940, 420);
      cam.zoom = 1;
      cam.snap(1360, 450);
      time = 0;
      entry = 0;
      glow = 72;
      litCount = 0;
      faint = null;
      finale = null;
      leaving = false;
      boxOpened = false;
      for (const m of memories) { m.lit = false; m.charge = 0; m.t = 0; }
      musicBox.lit = false;
      musicBox.ready = false;
      musicBox.charge = 0;
      musicBox.t = 0;
      for (const key in flags) delete flags[key];
    },
    update(dt) {
      time += dt;
      entry += dt;
      Captions.update(dt);
      for (const m of memories) if (m.lit) m.t += dt;
      if (musicBox.lit) musicBox.t += dt;
      if (!flags['intro1'] && entry > 5.2 && litCount === 0) {
        trigger('intro1', () => Captions.add('Inside, the dark was enormous.', { dur: 4.6 }));
      }
      if (!flags['intro2'] && entry > 10.2 && litCount === 0) {
        trigger('intro2', () => Captions.add('June was somewhere in it.', { dur: 4.6 }));
      }
      if (!flags['intro3'] && entry > 16.5 && litCount === 0) {
        trigger('intro3', () => Captions.add('But a little light is still a light.', { dur: 6, style: 'memory' }));
      }

      if (finale) {
        finale.t += dt;
        moth.frozen = true;
        const ft = finale.t;
        const fly = smoothstep(0.4, 6.2, ft);
        moth.x = lerp(musicBox.x, juneHand.x - 10, easeInOutCubic(fly));
        moth.y = lerp(musicBox.y, juneHand.y - 12, easeInOutCubic(fly)) - Math.sin(fly * Math.PI) * 130;
        if (ft > 6.5) {
          moth.x = damp(moth.x, juneHand.x - 6, 1.8, dt);
          moth.y = damp(moth.y, juneHand.y - 12, 1.8, dt);
        }
        moth.bank = Math.sin(time * 0.9) * 0.08;
        moth.flapPhase += dt * (ft < 8 ? 15 : 5);
        if (ft > 1.4) trigger('fin1', () => Captions.add('But it was not her mother. It was a small, stubborn light.', { dur: 5.8, y: 792 }));
        if (ft > 4.7) trigger('fin2', () => Captions.add('Mama…?', { speaker: 'JUNE', style: 'june', dur: 3.4, y: 792 }));
        if (ft > 8.3) trigger('fin3', () => Captions.add('Little moon.', { speaker: 'JUNE', style: 'june', dur: 4, y: 792 }));
        if (ft > 10.0) {
          Sound.setRoom(0.03);
          trigger('dawnL', () => {
            Sound.sfx('dawn');
            Captions.add('The dark was never empty. It was only waiting for a light.', { style: 'memory', dur: 7.2, y: 792 });
          });
        }
        if (Math.random() < dt * 9) {
          particles.add({
            x: 1330 + rand(260, -260), y: rand(720, 360),
            vx: rand(12, -12), vy: rand(-24, -6),
            life: rand(3.6, 1.4), size: rand(2.1, 0.6),
            color: Math.random() < 0.6 ? '#ffdc9f' : '#ffc373',
            type: 'dot', drag: 0.1, alpha: rand(0.5, 0.2), twinkle: 1, swirl: 7, shrink: -0.2
          });
        }
        cam.cx = damp(cam.cx, 1340, 1.5, dt);
        cam.cy = damp(cam.cy, 486, 1.5, dt);
        cam.zoom = damp(cam.zoom, 1.1, 1.1, dt);
        cam.clampToWorld();
        cam.update(dt, time);
        particles.update(dt);
        if (ft > 15.6 && !leaving) {
          leaving = true;
          Game.go('credits', { memories: litCount + 1 }, { duration: 3.4, color: '#f4c68c' });
        }
        return;
      }

      if (faint) {
        faint.t += dt;
        moth.frozen = true;
        if (faint.t > 1.7) {
          faint = null;
          moth.frozen = false;
          const lit = memories.filter(m => m.lit);
          const target = lit.length ? lit[lit.length - 1] : { x: 1880, y: 420 };
          moth.reset(target.x, target.y - 40);
          glow = 44;
          cam.snap(target.x, target.y);
          Sound.sfx('respawn');
          Captions.add('The dark was patient. But so was she.', { style: 'memory', dur: 4.6 });
        }
        cam.update(dt, time);
        particles.update(dt);
        return;
      }

      glow = Math.max(0, glow - dt * 3.1);
      let nearLit = false;
      for (const m of memories) if (m.lit && dist(moth.x, moth.y, m.x, m.y) < 190) nearLit = true;
      if (nearLit) glow = Math.min(100, glow + dt * 9);
      if (glow <= 0) {
        faint = { t: 0 };
        moth.frozen = true;
        Sound.sfx('hurt');
        Captions.add('Her light was almost gone.', { style: 'memory', dur: 3.6 });
        return;
      }

      const env = { gravity: 90, windX: Math.sin(time * 0.6) * 8, windY: 0, drag: 2.4, camX: cam.cx };
      moth.update(dt, particles, env);
      moth.x = clamp(moth.x, 26, worldW - 30);
      moth.y = clamp(moth.y, 110, 770);
      if (moth.y >= 770) moth.vy = Math.min(moth.vy, 0);
      if (moth.y <= 110) moth.vy = Math.max(moth.vy, 0);

      let nearMem = null;
      let nearD = 1e9;
      for (const m of memories) {
        if (!m.lit) {
          const d = dist(moth.x, moth.y, m.x, m.y);
          if (d < m.r && d < nearD) { nearMem = m; nearD = d; }
        }
      }
      if (musicBox.ready && !musicBox.lit) {
        const d = dist(moth.x, moth.y, musicBox.x, musicBox.y);
        if (d < musicBox.r) { nearMem = musicBox; nearD = d; }
      }
      for (const m of memories) {
        if (m !== nearMem) m.charge = Math.max(0, m.charge - dt * 1.5);
      }
      if (musicBox !== nearMem) musicBox.charge = Math.max(0, musicBox.charge - dt * 1.5);
      if (nearMem) {
        nearMem.charge = Math.min(1, nearMem.charge + dt / 0.65);
        if (Math.random() < dt * 22) {
          particles.add({
            x: nearMem.x + rand(34, -34), y: nearMem.y + rand(30, -30),
            vx: rand(18, -18), vy: rand(-20, -4),
            life: rand(1.2, 0.4), size: rand(1.6, 0.5), color: '#ffd89b',
            type: 'dot', drag: 1.2, alpha: 0.4, shrink: -0.5
          });
        }
        if (nearMem.charge >= 1) {
          const target = nearMem;
          target.lit = true;
          target.t = 0;
          litCount++;
          glow = Math.min(100, glow + 20);
          Sound.sfx('memory', { pan: (target.x - cam.cx) / 900 });
          cam.shake(0.12);
          particles.burst(target.x, target.y - 8, { count: 28, speed: 130, color: ['#ffe3ac', '#ffc16b', '#fff4d8'], size: 2.1, life: 1.9, drag: 1.3, twinkle: 1, g: -18 });
          particles.add({ x: target.x, y: target.y, size: 35, life: 1, color: '#ffd28c', type: 'ring', alpha: 0.6 });
          Captions.add(target.caption, { style: 'memory', dur: 6.2, y: 782 });
          if (target === musicBox) {
            startFinale();
            return;
          }
          if (litCount >= 4 && !musicBox.ready) {
            musicBox.ready = true;
            Captions.add('One last thing. High on the shelf.', { style: 'memory', dur: 5.6, y: 782 });
            Sound.sfx('warm', { pan: 0 });
            Sound.playTheme({ instrument: 'box', gain: 0.25, delay: 0.5 });
          }
          if (litCount === 1) Sound.playTheme({ instrument: 'glass', gain: 0.22, delay: 0.6 });
        }
      }

      if (Math.random() < dt * 5) {
        particles.add({
          x: moth.x + rand(26, -26), y: moth.y + rand(30, -10),
          vx: rand(10, -10), vy: rand(24, 6),
          life: rand(0.9, 0.3), size: rand(1.2, 0.4), color: '#ffd59a', type: 'dot', drag: 1.5, alpha: 0.3
        });
      }

      cam.follow(moth.x, moth.y, dt, {
        lookX: clamp(moth.vx * 0.25, -100, 100),
        lookY: clamp(moth.vy * 0.08, -30, 30),
        smooth: 2.4,
        zoom: 1
      });
      cam.update(dt, time);
      particles.update(dt);
    },
    draw() {
      ctx.save();
      cam.apply(ctx);
      drawRoomBase();
      ctx.restore();
      drawDarkness();
      ctx.save();
      cam.apply(ctx);
      drawWindowNightGlow();
      drawObjectHighlights();
      for (const m of memories) {
        drawGlimmer(m);
        drawMemoryLight(m);
      }
      if (musicBox.ready || musicBox.lit) {
        drawGlimmer(musicBox);
        if (musicBox.lit) drawMemoryLight(musicBox);
      }
      drawJuneRoom(finale ? smoothstep(3.0, 5.0, finale.t) : 0, finale ? smoothstep(5.5, 7.5, finale.t) : 0, finale ? smoothstep(2.4, 4.4, finale.t) * 0.28 * (1 - smoothstep(8.5, 10, finale.t)) : 0);
      particles.draw(ctx);
      moth.draw(ctx, time, { glow: finale ? 1.15 : 0.5 + glow / 100 * 0.6 });
      ctx.restore();
      if (finale) {
        const k = smoothstep(0, 2.5, finale.t);
        const dawn = smoothstep(9, 12, finale.t);
        ctx.save();
        ctx.globalCompositeOperation = 'screen';
        ctx.globalAlpha = (0.13 + dawn * 0.24) * k;
        const wash = ctx.createLinearGradient(0, 120, 0, 900);
        wash.addColorStop(0, 'rgba(120,84,130,0.6)');
        wash.addColorStop(0.45, 'rgba(190,122,96,0.65)');
        wash.addColorStop(0.8, 'rgba(245,170,100,0.7)');
        wash.addColorStop(1, 'rgba(255,196,124,0.6)');
        ctx.fillStyle = wash;
        ctx.fillRect(0, 0, VW, VH);
        ctx.restore();
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        Glow.draw(ctx, 960, 520, 560, '#ffb36a', 0.06 * k + 0.06 * dawn);
        Glow.draw(ctx, 1260, 480, 700, '#ffcf92', 0.05 * k + 0.13 * dawn);
        Glow.draw(ctx, 1320, 460, 330, '#ffe1b1', 0.04 * k + 0.1 * dawn);
        const low = ctx.createLinearGradient(0, 560, 0, 900);
        low.addColorStop(0, `rgba(255,180,105,${0.03 * k})`);
        low.addColorStop(1, `rgba(255,150,80,${0.09 * k + 0.04 * dawn})`);
        ctx.fillStyle = low;
        ctx.fillRect(0, 0, VW, VH);
        ctx.restore();
      }
      drawMothLight();
      if (!finale) {
        drawMeter(ctx, VW - 306, 82, 238, 'LIGHT', glow, '#ffc46b', { warn: glow < 25, alpha: 0.92 });
        const dotsX = VW / 2 - 60;
        ctx.save();
        for (let i = 0; i < 4; i++) {
          const lit = memories[i].lit;
          ctx.strokeStyle = lit ? 'rgba(255,201,138,0.8)' : 'rgba(220,210,190,0.22)';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.arc(dotsX + i * 34, 62, 4, 0, TAU);
          ctx.stroke();
          if (lit) {
            Glow.draw(ctx, dotsX + i * 34, 62, 20, '#ffc978', 0.5);
            ctx.fillStyle = '#ffe1ad';
            fillCircle(ctx, dotsX + i * 34, 62, 2.4);
          }
        }
        if (musicBox.ready) {
          const pulse = 0.5 + 0.5 * Math.sin(time * 2.4);
          ctx.strokeStyle = `rgba(255,201,138,${0.35 + pulse * 0.3})`;
          ctx.beginPath();
          ctx.arc(dotsX + 4 * 34 + 12, 62, 4.5 + pulse * 1.5, 0, TAU);
          ctx.stroke();
          Glow.draw(ctx, dotsX + 4 * 34 + 12, 62, 24, '#ffc978', 0.4 * pulse);
        }
        ctx.restore();
      }
      if (entry < 9 && !finale) {
        const a = entry < 1 ? 0 : entry < 7 ? 0.8 : Math.max(0, (9 - entry) / 2) * 0.8;
        drawSpaced('FIND WHAT SHE LEFT BEHIND', VW / 2, 100, { size: 10, spacing: 4.2, align: 'center', color: 'rgba(240,229,209,0.5)', alpha: a });
      }
      if (musicBox.ready && !finale) {
        drawSpaced('THE MUSIC BOX', VW / 2, 100, { size: 10, spacing: 4.2, align: 'center', color: 'rgba(255,210,150,0.6)' });
      }
      drawControlsHint(ctx, entry > 2 && !finale ? Math.max(0, 1 - (entry - 14) / 3) * 0.6 : 0, 'M  MUTE      ESC  PAUSE');
      drawChapterCard(ctx, entry, 0.6, 'IV', 'The House', 'the dark is full of small things');
      Captions.draw(ctx);
      drawMuteBadge(ctx);
      if (DEBUG) drawDebugOverlay('room');
    }
  };
}

function makeCreditsScene() {
  const stars = new StarField(90210, 170, { height: 470, maxR: 1.6, bigRatio: 0.02, warmRatio: 0.5 });
  const clouds = new CloudField(90211, 4, '#f0b18d', '#ffe5bd', { yMin: 90, yMax: 300, scaleMin: 0.7, scaleMax: 1.4, alphaMin: 0.18, alphaMax: 0.36, size: 820 });
  const farHills = [
    { p: 0.03, base: 590, amp: 22, amp2: 8, top: '#3a2c43', mid: '#241d30', bottom: '#171224', seed: 4.4, trees: true, treeStyle: 'round', treeColor: '#20182b', treeSpacing: 90, treeSize: 30, treeAlpha: 0.6 },
    { p: 0.08, base: 660, amp: 20, amp2: 6, top: '#251b2b', mid: '#171221', bottom: '#100c17', seed: 8.9, trees: true, treeStyle: 'pine', treeColor: '#181223', treeSpacing: 140, treeSize: 54, treeAlpha: 0.75 },
    { p: 0.17, base: 726, amp: 14, amp2: 4, top: '#120e18', mid: '#0c0912', bottom: '#07050b', seed: 12.3, trees: false }
  ];
  const grass = new GrassField({ seed: 90212, left: -140, right: VW + 140, groundY: 840, count: 540, minH: 50, maxH: 170, minW: 0.9, maxW: 3, colors: ['#161020', '#1a1426', '#120d1a'], lean: 0.25, sway: 4, hiRatio: 0.12, hiColor: '#b67a62' });
  const flowers = new FlowerField({ seed: 90213, left: -140, right: VW + 140, groundY: 838, count: 26, minH: 50, maxH: 130, minSize: 2, maxSize: 4.5, colors: ['#ffd7a2', '#ffb98c', '#f2e1c9'], glowMin: 0.2 });
  const flies = new Fireflies(90214, 20, { yMin: 400, yMax: 780, sizeMin: 0.7, sizeMax: 1.8, color: ['#ffe4b2', '#ffd09a'] });
  let time = 0;
  let entry = 0;
  let played = false;
  return {
    name: 'credits',
    enter(opts) {
      Captions.clear();
      Sound.setAct('dawn');
      Sound.setRain(0);
      Sound.setWind(0.06);
      Sound.setCity(0.025);
      Sound.setRoom(0.04);
      Sound.setHeart(false);
      try { localStorage.setItem('littlemoon.completed', '1'); } catch (e) {}
      time = 0;
      entry = 0;
      played = false;
    },
    update(dt) {
      time += dt;
      entry += dt;
      if (!played && entry > 0.9) {
        played = true;
        Sound.sfx('dawn');
        Sound.playTheme({ instrument: 'box', gain: 0.62, delay: 0.4, major: true });
        Sound.playTheme({ instrument: 'pluck', gain: 0.3, delay: 3.2, octave: -1, major: true });
      }
      if (entry > 2.2) {
        if (Input.hit('KeyR') || Input.hit('Space') || Input.hit('Enter') || Input.mouse.clicked) {
          Game.go('title', {}, { duration: 1.8 });
        }
      }
    },
    draw() {
      drawSky([[0, '#141a34'], [0.26, '#2d2c50'], [0.5, '#7a5063'], [0.68, '#d4876a'], [0.8, '#f4b278'], [0.9, '#ffcf8f'], [1, '#ffdfa7']]);
      stars.draw(220, time, { parallax: 0.01, alpha: Math.max(0, 0.7 - entry / 14) });
      clouds.draw(60, time, { parallax: 0.04, alpha: 0.83, drift: 4 });
      const sunX = 1230, sunY = 594;
      Glow.draw(ctx, sunX, sunY, 500, '#ffc37c', 0.16);
      Glow.draw(ctx, sunX, sunY, 220, '#ffd79a', 0.28);
      ctx.save();
      ctx.globalAlpha = 0.9;
      const sunG = ctx.createRadialGradient(sunX - 20, sunY - 20, 8, sunX, sunY, 84);
      sunG.addColorStop(0, '#fff6da');
      sunG.addColorStop(0.5, '#ffd99b');
      sunG.addColorStop(1, '#ffc078');
      ctx.fillStyle = sunG;
      fillCircle(ctx, sunX, sunY, 82);
      ctx.restore();
      drawHillLayer(160 + time * 1.2, time, farHills[0]);
      drawHillLayer(160 + time * 1.2, time, farHills[1]);
      drawHillLayer(160 + time * 1.2, time, farHills[2]);
      const haze = ctx.createLinearGradient(0, 520, 0, 820);
      haze.addColorStop(0, 'rgba(255,190,130,0)');
      haze.addColorStop(0.55, 'rgba(255,190,130,0.06)');
      haze.addColorStop(1, 'rgba(255,170,110,0.02)');
      ctx.fillStyle = haze;
      ctx.fillRect(0, 520, VW, 300);
      grass.draw(time, { left: -100, right: VW + 100, wind: 20, hiColor: '#a66d5b' });
      flowers.draw(time, { left: -100, right: VW + 100, wind: 20 });
      ctx.save();
      ctx.globalAlpha = 0.98;
      drawDawnHouse(1000, 846, 1.2, time);
      ctx.restore();
      flies.draw(160 + time * 1.2, time, { parallax: 0.2, alpha: 0.7 });
      const birds = [[820, 240, 14], [866, 214, 10], [906, 254, 12]];
      ctx.save();
      ctx.strokeStyle = 'rgba(60,42,56,0.65)';
      ctx.lineWidth = 1.6;
      for (const [bx, by, s] of birds) {
        const flap = Math.sin(time * 2 + bx) * s * 0.35;
        ctx.beginPath();
        ctx.moveTo(bx - s, by + flap);
        ctx.quadraticCurveTo(bx - s * 0.4, by - s * 0.35, bx, by);
        ctx.quadraticCurveTo(bx + s * 0.4, by - s * 0.35, bx + s, by + flap);
        ctx.stroke();
      }
      ctx.restore();
      const grad = ctx.createLinearGradient(0, 0, 0, 620);
      grad.addColorStop(0, 'rgba(7,8,20,0.36)');
      grad.addColorStop(0.5, 'rgba(7,8,20,0.14)');
      grad.addColorStop(1, 'rgba(7,8,20,0)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, VW, 620);
      drawSpaced('THE END', VW / 2, 176, { size: 11, spacing: 6, align: 'center', color: 'rgba(255,213,170,0.7)' });
      drawSpaced('LITTLE MOON', VW / 2, 264, { size: 78, weight: '400', family: SERIF, spacing: 14, align: 'center', color: '#f6ead6', glow: 'rgba(255,178,100,0.3)', glowRadius: 30 });
      drawText('for everyone keeping a light on', VW / 2, 318, { size: 25, italic: true, align: 'center', color: 'rgba(255,235,208,0.8)' });
      ctx.strokeStyle = 'rgba(255,207,151,0.32)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(VW / 2 - 50, 346);
      ctx.lineTo(VW / 2 + 50, 346);
      ctx.stroke();
      drawText('five small lights, kept', VW / 2, 392, { size: 19, italic: true, align: 'center', color: 'rgba(250,228,199,0.6)' });
      if (entry > 1.6) {
        const pulse = 0.62 + 0.3 * Math.sin(time * 2);
        drawSpaced('PRESS R TO FLY AGAIN', VW / 2, 470, { size: 12, spacing: 4.5, align: 'center', color: 'rgba(255,243,222,0.95)', alpha: pulse });
      }
      drawSpaced('made in one night', 58, 872, { size: 9, spacing: 3, color: 'rgba(255,230,200,0.4)' });
      drawSpaced('thank you for flying', VW - 58, 872, { size: 9, spacing: 3, align: 'right', color: 'rgba(255,230,200,0.4)' });
      drawMuteBadge(ctx);
    }
  };
}

function drawDawnHouse(x, baseY, s, time) {
  ctx.save();
  ctx.translate(x, baseY);
  ctx.scale(s, s);
  Glow.draw(ctx, 190, -142, 170, '#ffc481', 0.16);
  Glow.draw(ctx, 190, -142, 55, '#ffe4b1', 0.3);
  ctx.fillStyle = '#150f1b';
  ctx.beginPath();
  ctx.moveTo(-30, 0);
  ctx.lineTo(-30, -170);
  ctx.lineTo(130, -260);
  ctx.lineTo(390, -170);
  ctx.lineTo(390, 0);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#1a1220';
  ctx.fillRect(-30, -168, 420, 168);
  ctx.fillStyle = '#110b16';
  ctx.fillRect(60, -300, 34, 78);
  ctx.fillRect(55, -306, 44, 10);
  ctx.fillStyle = '#0b0710';
  ctx.fillRect(12, -180, 360, 18);
  ctx.fillRect(26, -162, 12, 162);
  ctx.fillRect(344, -162, 12, 162);
  ctx.fillStyle = '#0c0811';
  ctx.fillRect(-18, -12, 436, 12);
  ctx.fillRect(4, 0, 380, 12);
  ctx.fillRect(34, 12, 320, 12);
  ctx.fillRect(64, 24, 260, 12);
  ctx.fillRect(94, 36, 200, 12);
  ctx.fillRect(124, 48, 140, 12);
  ctx.fillStyle = '#0b0710';
  ctx.fillRect(54, -158, 74, 158);
  ctx.fillRect(246, -160, 70, 160);
  ctx.fillStyle = '#24192a';
  ctx.fillRect(262, -146, 38, 48);
  ctx.strokeStyle = 'rgba(255,199,140,0.2)';
  ctx.lineWidth = 1;
  ctx.strokeRect(262.5, -145.5, 37, 47);
  ctx.beginPath();
  ctx.moveTo(281, -146);
  ctx.lineTo(281, -98);
  ctx.stroke();
  const girlX = 98, girlY = -4;
  const glowPulse = 0.6 + 0.4 * Math.sin(time * 2);
  Glow.draw(ctx, girlX + 12, girlY - 42, 42, '#ffd08b', 0.35 * glowPulse);
  ctx.fillStyle = '#0b0710';
  ctx.beginPath();
  ctx.ellipse(girlX, girlY - 40, 11, 19, -0.05, 0, TAU);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(girlX - 2, girlY - 64, 9, 10, 0, 0, TAU);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(girlX + 6, girlY - 70, 4, 7, 0.5, 0, TAU);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(girlX - 4, girlY - 14, 14, 8, 0, 0, TAU);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,208,150,0.45)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(girlX - 2, girlY - 64, 9, Math.PI * 0.7, Math.PI * 1.5);
  ctx.stroke();
  ctx.fillStyle = '#0b0710';
  ctx.beginPath();
  ctx.ellipse(girlX - 16, girlY - 38, 12, 3, -0.15, 0, TAU);
  ctx.fill();
  ctx.fillStyle = '#ffe0a4';
  fillCircle(ctx, girlX - 22, girlY - 41, 2);
  Glow.draw(ctx, girlX - 22, girlY - 41, 24, '#ffd08b', 0.5 * glowPulse);
  ctx.strokeStyle = 'rgba(255,208,150,0.13)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(-30, -170);
  ctx.lineTo(130, -260);
  ctx.lineTo(390, -170);
  ctx.stroke();
  ctx.restore();
}

function toggleFullscreen() {
  try {
    if (!document.fullscreenElement) {
      const p = document.documentElement.requestFullscreen && document.documentElement.requestFullscreen();
      if (p && p.catch) p.catch(() => {});
    } else if (document.exitFullscreen) {
      document.exitFullscreen().catch(() => {});
    }
  } catch (e) {}
}

function drawPauseOverlay() {
  ctx.save();
  ctx.fillStyle = 'rgba(2,4,9,0.84)';
  ctx.fillRect(0, 0, VW, VH);
  const g = ctx.createRadialGradient(VW / 2, VH / 2, 100, VW / 2, VH / 2, 700);
  g.addColorStop(0, 'rgba(255,190,110,0.05)');
  g.addColorStop(1, 'rgba(0,0,0,0.3)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, VW, VH);
  drawSpaced('PAUSED', VW / 2, 338, { size: 13, spacing: 9, align: 'center', color: 'rgba(255,204,141,0.8)' });
  drawText('the night can wait', VW / 2, 392, { size: 32, italic: true, align: 'center', color: '#f0e5d1' });
  ctx.strokeStyle = 'rgba(255,206,145,0.2)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(VW / 2 - 60, 420);
  ctx.lineTo(VW / 2 + 60, 420);
  ctx.stroke();
  const rows = [
    ['ESC', 'resume'],
    ['R', 'restart chapter'],
    ['M', 'mute / unmute'],
    ['F', 'fullscreen'],
    ['ARROWS / WASD', 'fly'],
    ['SPACE', 'flutter']
  ];
  rows.forEach((row, i) => {
    drawSpaced(row[0], VW / 2 - 28, 498 + i * 34, { size: 11, spacing: 2.5, align: 'right', color: 'rgba(240,229,208,0.72)' });
    drawText(row[1], VW / 2 + 16, 502 + i * 34, { size: 19, italic: true, color: 'rgba(238,228,208,0.55)' });
  });
  drawSpaced('HEADPHONES RECOMMENDED', VW / 2, 760, { size: 9, spacing: 4, align: 'center', color: 'rgba(238,228,208,0.26)' });
  drawMuteBadge(ctx);
  ctx.restore();
}

function drawDebugOverlay(sceneName) {
  ctx.save();
  const y = 24;
  ctx.globalAlpha = 0.85;
  ctx.font = '12px monospace';
  ctx.fillStyle = '#74d7c1';
  ctx.textAlign = 'left';
  const lines = [
    'little moon · ' + sceneName + ' · ' + Math.round(Game.fps) + 'fps',
    'audio: ' + JSON.stringify(Sound.status()),
    'pointer: ' + Math.round(Input.mouse.x) + ',' + Math.round(Input.mouse.y)
  ];
  lines.forEach((l, i) => ctx.fillText(l, 16, y + i * 16));
  ctx.restore();
}

const Game = {
  scene: null,
  name: null,
  paused: false,
  transition: null,
  fadeIn: 1,
  time: 0,
  fps: 60,
  frameAcc: 0,
  frameCount: 0,
  started: false,

  load(name, opts = {}) {
    const factory = SCENE_FACTORIES[name];
    if (!factory) {
      console.warn('Little Moon: unknown scene', name);
      return;
    }
    if (this.scene && this.scene.exit) this.scene.exit();
    this.name = name;
    this.scene = factory(opts);
    this.scene.name = name;
    if (this.scene.enter) this.scene.enter();
    if (DEBUG) console.log('Little Moon scene:', name);
  },

  go(name, opts = {}, tr = {}) {
    if (this.transition) return;
    if (!SCENE_FACTORIES[name]) {
      console.warn('Little Moon: cannot go to unknown scene', name);
      return;
    }
    this.transition = {
      name,
      opts,
      out: tr.duration != null ? tr.duration : 1.0,
      hold: tr.hold != null ? tr.hold : 0.12,
      in: tr.in != null ? tr.in : (tr.duration != null ? tr.duration : 1.0),
      color: tr.color || '#03050a',
      phase: 'out',
      t: 0
    };
    Sound.sfx('ui', { pan: 0 });
  },

  setPaused(v) {
    if (this.paused === v) return;
    this.paused = v;
    if (Sound.ready) Sound.setMusicGain(v ? 0.16 : 0.55);
    if (v) Input.keys.clear();
  },

  togglePause() {
    if (!this.started) return;
    if (this.scene && (this.scene.name === 'title' || this.scene.name === 'prologue')) return;
    this.setPaused(!this.paused);
    Sound.resume();
  },

  restartChapter() {
    if (!this.scene) return;
    this.paused = false;
    if (Sound.ready) Sound.setMusicGain(0.55);
    this.transition = null;
    this.load(this.name);
    this.fadeIn = 1;
  },

  install() {
    Input.install();
    window.addEventListener('keydown', e => {
      if (e.code === 'Escape' && !e.repeat) this.togglePause();
      if (e.code === 'KeyM' && !e.repeat) {
        Sound.init();
        Sound.toggleMute();
        if (this.scene && this.scene.name !== 'title') Sound.sfx('ui');
      }
      if (e.code === 'KeyF' && !e.repeat) toggleFullscreen();
      if (e.code === 'KeyR' && !e.repeat && this.paused) this.restartChapter();
      if (DEBUG && !e.repeat) {
        const map = { Digit1: 'title', Digit2: 'prologue', Digit3: 'meadow', Digit4: 'storm', Digit5: 'town', Digit6: 'room', Digit7: 'credits' };
        if (map[e.code] && e.code !== 'Escape') this.go(map[e.code], {}, { duration: 0.05, hold: 0.02, in: 0.3 });
      }
    });
    document.addEventListener('visibilitychange', () => {
      if (document.hidden && this.scene && this.scene.name !== 'title' && this.scene.name !== 'prologue') this.setPaused(true);
    });
    window.addEventListener('blur', () => {
      if (this.scene && this.scene.name !== 'title' && this.scene.name !== 'prologue' && this.started) this.setPaused(true);
    });
    const boot = document.getElementById('boot');
    if (boot) {
      boot.classList.add('gone');
      setTimeout(() => { if (boot.parentNode) boot.parentNode.removeChild(boot); }, 1100);
    }
    const grainEl = document.getElementById('grain');
    if (grainEl) {
      const c = makeCanvas(180, 180);
      const g = c.getContext('2d');
      const img = g.createImageData(180, 180);
      for (let i = 0; i < img.data.length; i += 4) {
        const v = 88 + Math.random() * 80;
        img.data[i] = v;
        img.data[i + 1] = v;
        img.data[i + 2] = v;
        img.data[i + 3] = 255;
      }
      g.putImageData(img, 0, 0);
      grainEl.style.backgroundImage = 'url(' + c.toDataURL('image/png') + ')';
    }
    this.load(START && SCENE_FACTORIES[START] ? START : 'title');
    this.started = true;
    this.lastT = performance.now();
    requestAnimationFrame(this.frame.bind(this));
  },

  update(dt) {
    this.time += dt;
    if (this.fadeIn > 0) this.fadeIn = Math.max(0, this.fadeIn - dt / 1.5);
    if (this.transition) {
      const tr = this.transition;
      tr.t += dt;
      if (tr.phase === 'out' && tr.t >= tr.out) {
        this.load(tr.name, tr.opts);
        tr.phase = 'hold';
        tr.t = 0;
      } else if (tr.phase === 'hold' && tr.t >= tr.hold) {
        tr.phase = 'in';
        tr.t = 0;
      } else if (tr.phase === 'in' && tr.t >= tr.in) {
        this.transition = null;
      }
    }
    if (!this.paused) {
      Sound.update(dt);
      if (this.scene && this.scene.update) this.scene.update(dt);
    }
  },

  draw() {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#020308';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    const s = viewDpr * viewScale;
    ctx.setTransform(s, 0, 0, s, viewDpr * viewOx, viewDpr * viewOy);
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, VW, VH);
    ctx.clip();
    if (this.scene) this.scene.draw(ctx);
    if (this.transition) {
      const tr = this.transition;
      let a = 0;
      if (tr.phase === 'out') a = clamp(tr.t / tr.out, 0, 1);
      else if (tr.phase === 'hold') a = 1;
      else a = 1 - clamp(tr.t / tr.in, 0, 1);
      ctx.save();
      ctx.globalAlpha = easeInOutCubic(a);
      ctx.fillStyle = tr.color;
      ctx.fillRect(0, 0, VW, VH);
      ctx.restore();
    } else if (this.fadeIn > 0) {
      ctx.save();
      ctx.globalAlpha = this.fadeIn;
      ctx.fillStyle = '#020308';
      ctx.fillRect(0, 0, VW, VH);
      ctx.restore();
    }
    if (this.paused) drawPauseOverlay();
    ctx.restore();
  },

  frame(now) {
    const raw = (now - this.lastT) / 1000;
    this.lastT = now;
    const dt = clamp(raw, 0, 0.05);
    this.frameAcc += raw;
    this.frameCount++;
    if (this.frameAcc > 0.4) {
      this.fps = this.frameCount / this.frameAcc;
      this.frameAcc = 0;
      this.frameCount = 0;
    }
    this.update(dt);
    this.draw();
    Input.endFrame();
    requestAnimationFrame(this.frame.bind(this));
  }
};

const SCENE_FACTORIES = {
  title: makeTitleScene,
  prologue: makePrologueScene,
  meadow: makeMeadowScene,
  storm: makeStormScene,
  town: makeTownScene,
  room: makeRoomScene,
  credits: makeCreditsScene
};

window.__lm = {
  Game, Sound, Input, Moth, Camera, Captions,
  get scene() { return Game.scene; },
  get moth() { return Game.scene && Game.scene.moth ? Game.scene.moth : null; }
};

Game.install();
})();
