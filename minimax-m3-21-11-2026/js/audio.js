// ---------------------------------------------------------------------------
// THE TIDE ENGINE — procedural audio (music + sfx + machine voices)
// Everything is synthesised at runtime. No external assets.
// ---------------------------------------------------------------------------
import { clamp, lerp, rand, mtof, pick } from './util.js';

const CHORDS = {
  Am:  { bass: 45, pad: [57, 60, 64] },
  F:   { bass: 41, pad: [53, 57, 60] },
  C:   { bass: 48, pad: [60, 64, 67] },
  G:   { bass: 43, pad: [55, 59, 62] },
  Dm:  { bass: 38, pad: [50, 53, 57] },
  E:   { bass: 40, pad: [52, 56, 59] },
  D:   { bass: 38, pad: [50, 54, 57] },
  Bm:  { bass: 35, pad: [47, 50, 54] },
  Asus:{ bass: 45, pad: [57, 61, 64] },
};

const PROGRESSIONS = {
  calm:   ['Am', 'F', 'C', 'G'],
  song:   ['Am', 'F', 'C', 'G'],
  tense:  ['Am', 'Dm', 'G', 'E'],
  climax: ['Am', 'G', 'F', 'E'],
  end:    ['D', 'Bm', 'G', 'Am'],
};

export class AudioEngine {
  constructor() {
    this.ready = false;
    this.mode = 'calm';
    this.intensity = 0;
    this.musicOn = true;
    this._step = 0;
    this._bar = 0;
    this._nextTime = 0;
    this.bpm = 84;
  }

  init() {
    if (this.ready) return;
    if (this.silent) { this.ready = true; return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) { this.ready = true; this.silent = true; return; }
    const c = (this.ctx = new AC());
    this.ready = true;

    this.master = c.createGain();
    this.master.gain.value = 0.0001;
    this.comp = c.createDynamicsCompressor();
    this.comp.threshold.value = -16;
    this.comp.knee.value = 22;
    this.comp.ratio.value = 5;
    this.comp.attack.value = 0.004;
    this.comp.release.value = 0.22;
    this.master.connect(this.comp);
    this.comp.connect(c.destination);

    this.sfx = c.createGain(); this.sfx.gain.value = 0.9; this.sfx.connect(this.master);
    this.music = c.createGain(); this.music.gain.value = 0.55; this.music.connect(this.master);
    this.amb = c.createGain(); this.amb.gain.value = 0.5; this.amb.connect(this.master);

    // --- reverb (generated impulse response) ---
    this.rev = c.createConvolver();
    this.rev.buffer = this._impulse(2.9, 2.4);
    this.revGain = c.createGain(); this.revGain.gain.value = 0.42;
    this.rev.connect(this.revGain); this.revGain.connect(this.master);

    // --- noise sources ---
    this.whiteBuf = this._noise(3, 'white');
    this.brownBuf = this._noise(6, 'brown');

    this._buildAmbience();
    this._buildHum();

    this.master.gain.setTargetAtTime(0.92, c.currentTime, 1.2);
    this._nextTime = c.currentTime + 0.1;
  }

  resume() {
    if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
  }

  _noise(seconds, kind) {
    const c = this.ctx;
    const len = Math.floor(c.sampleRate * seconds);
    const buf = c.createBuffer(1, len, c.sampleRate);
    const d = buf.getChannelData(0);
    if (kind === 'brown') {
      let last = 0;
      for (let i = 0; i < len; i++) {
        const w = Math.random() * 2 - 1;
        last = (last + 0.02 * w) / 1.02;
        d[i] = last * 3.2;
      }
    } else {
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    }
    return buf;
  }

  _impulse(seconds, decay) {
    const c = this.ctx;
    const len = Math.floor(c.sampleRate * seconds);
    const buf = c.createBuffer(2, len, c.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = buf.getChannelData(ch);
      for (let i = 0; i < len; i++) {
        const t = i / len;
        d[i] = (Math.random() * 2 - 1) * Math.pow(1 - t, decay) * (1 - t * 0.2);
      }
    }
    return buf;
  }

  // ---------------------------------------------------------------- ambience
  _buildAmbience() {
    const c = this.ctx;
    // ocean swell
    const src = c.createBufferSource();
    src.buffer = this.brownBuf;
    src.loop = true;
    const lp = c.createBiquadFilter();
    lp.type = 'lowpass'; lp.frequency.value = 320; lp.Q.value = 0.6;
    const g = c.createGain(); g.gain.value = 0.30;
    const lfo = c.createOscillator(); lfo.frequency.value = 0.07;
    const lfoG = c.createGain(); lfoG.gain.value = 0.22;
    lfo.connect(lfoG); lfoG.connect(g.gain);
    src.connect(lp); lp.connect(g); g.connect(this.amb);
    src.start(); lfo.start();
    this.oceanGain = g;
    this.oceanFilter = lp;

    // deep hiss of the engine hall
    const h = c.createBufferSource();
    h.buffer = this.whiteBuf; h.loop = true;
    const hp = c.createBiquadFilter();
    hp.type = 'bandpass'; hp.frequency.value = 2200; hp.Q.value = 0.8;
    const hg = c.createGain(); hg.gain.value = 0.012;
    h.connect(hp); hp.connect(hg); hg.connect(this.amb);
    h.start();
    this.hallGain = hg;
  }

  // -------------------------------------------------------------------- hum
  _buildHum() {
    const c = this.ctx;
    this.humGain = c.createGain(); this.humGain.gain.value = 0.0;
    this.humFilter = c.createBiquadFilter();
    this.humFilter.type = 'lowpass';
    this.humFilter.frequency.value = 400;
    this.humFilter.Q.value = 3;
    this.humGain.connect(this.humFilter);
    this.humFilter.connect(this.master);
    const send = c.createGain(); send.gain.value = 0.5;
    this.humFilter.connect(send); send.connect(this.rev);

    this.humOscs = [];
    const specs = [['sawtooth', 1, 0.50], ['sawtooth', 1.006, 0.38], ['sine', 0.5, 0.30], ['sine', 2, 0.14]];
    for (const [type, mult, amp] of specs) {
      const o = c.createOscillator();
      o.type = type;
      o.frequency.value = 60 * mult;
      const g = c.createGain(); g.gain.value = 0;
      o.connect(g); g.connect(this.humGain);
      o.start();
      this.humOscs.push({ o, mult, amp, g });
    }
  }

  /** error: 0 = perfectly tuned, 1 = far off. inBand: boolean. */
  setHum(error, inBand, active) {
    if (!this.ready || this.silent || !this.humOscs) return;
    const t = this.ctx.currentTime;
    const err = clamp(error, 0, 1);
    const base = 44 + (1 - err) * 30;
    for (const h of this.humOscs) {
      h.o.frequency.setTargetAtTime(base * h.mult, t, 0.09);
      const amp = inBand ? h.amp : h.amp * 0.55;
      h.g.gain.setTargetAtTime(amp, t, 0.18);
    }
    this.humFilter.frequency.setTargetAtTime(inBand ? 1400 : 260 + (1 - err) * 340, t, 0.14);
    this.humGain.gain.setTargetAtTime(active ? (inBand ? 0.19 : 0.13) : 0.035, t, 0.3);
  }

  setOcean(level) {
    if (!this.ready || this.silent) return;
    this.oceanGain.gain.setTargetAtTime(0.16 + level * 0.4, this.ctx.currentTime, 0.6);
  }

  // ------------------------------------------------------------------- sfx
  _env(node, t, a, d, peak, sustain = 0, rel = 0) {
    const g = node.gain;
    g.cancelScheduledValues(t);
    g.setValueAtTime(0.0001, t);
    g.exponentialRampToValueAtTime(Math.max(peak, 0.0002), t + a);
    if (sustain > 0) {
      g.exponentialRampToValueAtTime(Math.max(peak * sustain, 0.0002), t + a + d);
      g.exponentialRampToValueAtTime(0.0001, t + a + d + rel);
    } else {
      g.exponentialRampToValueAtTime(0.0001, t + a + d);
    }
  }

  bell(midi, { dur = 1.8, gain = 0.32, when = 0, bright = 1, pan = 0 } = {}) {
    if (!this.ready || this.silent) return;
    const c = this.ctx;
    const t = c.currentTime + when;
    const f = mtof(midi);
    const car = c.createOscillator(); car.type = 'sine'; car.frequency.value = f;
    const mod = c.createOscillator(); mod.type = 'sine'; mod.frequency.value = f * 3.51;
    const modG = c.createGain();
    modG.gain.setValueAtTime(f * 2.6 * bright, t);
    modG.gain.exponentialRampToValueAtTime(f * 0.05, t + dur * 0.6);
    mod.connect(modG); modG.connect(car.frequency);
    const g = c.createGain(); g.gain.value = 0;
    car.connect(g);
    this._env(g, t, 0.006, dur, gain);
    const p = c.createStereoPanner ? c.createStereoPanner() : null;
    if (p) { p.pan.value = pan; g.connect(p); p.connect(this.sfx); p.connect(this.rev); }
    else { g.connect(this.sfx); }
    g.connect(this.rev);
    car.start(t); mod.start(t);
    car.stop(t + dur + 0.1); mod.stop(t + dur + 0.1);
  }

  pluck(midi, { dur = 0.5, gain = 0.14, when = 0, cutoff = 2600 } = {}) {
    if (!this.ready || this.silent) return;
    const c = this.ctx;
    const t = c.currentTime + when;
    const o = c.createOscillator(); o.type = 'sawtooth'; o.frequency.value = mtof(midi);
    const f = c.createBiquadFilter(); f.type = 'lowpass';
    f.frequency.setValueAtTime(cutoff, t);
    f.frequency.exponentialRampToValueAtTime(320, t + dur);
    f.Q.value = 4;
    const g = c.createGain(); g.gain.value = 0;
    o.connect(f); f.connect(g); g.connect(this.sfx); g.connect(this.rev);
    this._env(g, t, 0.01, dur, gain);
    o.start(t); o.stop(t + dur + 0.05);
  }

  pad(midis, { dur = 2.6, gain = 0.055, when = 0, cutoff = 900 } = {}) {
    if (!this.ready || this.silent) return;
    const c = this.ctx;
    const t = c.currentTime + when;
    const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = cutoff; f.Q.value = 1.2;
    const g = c.createGain(); g.gain.value = 0;
    f.connect(g); g.connect(this.music); g.connect(this.rev);
    this._env(g, t, 0.6, dur, gain, 0.55, 0.8);
    for (const m of midis) {
      for (const det of [-4, 4]) {
        const o = c.createOscillator(); o.type = 'sawtooth';
        o.frequency.value = mtof(m) * Math.pow(2, det / 1200);
        o.connect(f); o.start(t); o.stop(t + dur + 1.4);
      }
    }
  }

  bass(midi, { dur = 1.6, gain = 0.16, when = 0 } = {}) {
    if (!this.ready || this.silent) return;
    const c = this.ctx;
    const t = c.currentTime + when;
    const o = c.createOscillator(); o.type = 'sine'; o.frequency.value = mtof(midi);
    const o2 = c.createOscillator(); o2.type = 'triangle'; o2.frequency.value = mtof(midi) * 2;
    const g2 = c.createGain(); g2.gain.value = 0.25;
    const g = c.createGain(); g.gain.value = 0;
    o.connect(g); o2.connect(g2); g2.connect(g);
    g.connect(this.music);
    this._env(g, t, 0.03, dur, gain);
    o.start(t); o2.start(t); o.stop(t + dur + 0.1); o2.stop(t + dur + 0.1);
  }

  noiseHit({ dur = 0.16, freq = 1800, q = 1.2, gain = 0.14, when = 0, type = 'bandpass', sweep = 0 } = {}) {
    if (!this.ready || this.silent) return;
    const c = this.ctx;
    const t = c.currentTime + when;
    const s = c.createBufferSource(); s.buffer = this.whiteBuf;
    s.playbackRate.value = rand(0.9, 1.1);
    const f = c.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
    if (sweep) f.frequency.exponentialRampToValueAtTime(Math.max(80, freq * sweep), t + dur);
    const g = c.createGain(); g.gain.value = 0;
    s.connect(f); f.connect(g); g.connect(this.sfx);
    this._env(g, t, 0.006, dur, gain);
    s.start(t, rand(0, 2)); s.stop(t + dur + 0.05);
  }

  steam({ dur = 0.5, gain = 0.09, when = 0 } = {}) {
    this.noiseHit({ dur, freq: 5200, q: 0.5, gain, when, type: 'highpass', sweep: 0.35 });
  }

  ping(freq = 880, { gain = 0.16, dur = 0.5 } = {}) {
    if (!this.ready || this.silent) return;
    const c = this.ctx;
    const t = c.currentTime;
    const o = c.createOscillator(); o.type = 'sine';
    o.frequency.setValueAtTime(freq, t);
    o.frequency.exponentialRampToValueAtTime(freq * 0.55, t + dur);
    const g = c.createGain(); g.gain.value = 0;
    o.connect(g); g.connect(this.sfx); g.connect(this.rev);
    this._env(g, t, 0.004, dur, gain);
    o.start(t); o.stop(t + dur + 0.05);
  }

  thump(freq = 90, { dur = 0.6, gain = 0.34, when = 0 } = {}) {
    if (!this.ready || this.silent) return;
    const c = this.ctx;
    const t = c.currentTime + when;
    const o = c.createOscillator(); o.type = 'sine';
    o.frequency.setValueAtTime(freq * 2.4, t);
    o.frequency.exponentialRampToValueAtTime(freq * 0.55, t + dur * 0.7);
    const g = c.createGain(); g.gain.value = 0;
    o.connect(g); g.connect(this.sfx);
    this._env(g, t, 0.005, dur, gain);
    o.start(t); o.stop(t + dur + 0.05);
  }

  clunk(gain = 0.2) {
    this.noiseHit({ dur: 0.12, freq: 380, q: 2.2, gain, type: 'lowpass' });
    this.thump(120, { dur: 0.22, gain: gain * 1.2 });
  }

  click(gain = 0.09) {
    this.noiseHit({ dur: 0.045, freq: 3200, q: 1.0, gain, type: 'highpass' });
  }

  radioBlip() {
    if (!this.ready || this.silent) return;
    const c = this.ctx;
    const t = c.currentTime;
    const s = c.createBufferSource(); s.buffer = this.whiteBuf;
    s.playbackRate.value = rand(0.8, 1.25);
    const f = c.createBiquadFilter(); f.type = 'bandpass';
    f.frequency.value = rand(700, 1900); f.Q.value = rand(3, 8);
    const g = c.createGain(); g.gain.value = 0;
    s.connect(f); f.connect(g); g.connect(this.sfx);
    this._env(g, t, 0.012, rand(0.05, 0.13), 0.05);
    s.start(t, rand(0, 2)); s.stop(t + 0.3);
  }

  radioOpen() {
    this.noiseHit({ dur: 0.3, freq: 2400, q: 0.4, gain: 0.07, type: 'bandpass', sweep: 0.3 });
    this.ping(660, { gain: 0.09, dur: 0.25 });
  }

  alarm(gain = 0.12) {
    if (!this.ready || this.silent) return;
    const c = this.ctx;
    const t = c.currentTime;
    for (let i = 0; i < 2; i++) {
      const o = c.createOscillator(); o.type = 'square';
      o.frequency.value = 420 - i * 90;
      const g = c.createGain(); g.gain.value = 0;
      o.connect(g); g.connect(this.sfx);
      const tt = t + i * 0.16;
      this._env(g, tt, 0.01, 0.14, gain);
      o.start(tt); o.stop(tt + 0.2);
    }
  }

  surge() {
    this.thump(70, { dur: 1.4, gain: 0.5 });
    this.noiseHit({ dur: 1.2, freq: 900, q: 0.5, gain: 0.18, type: 'lowpass', sweep: 0.12 });
    this.alarm(0.09);
  }

  // ------------------------------------------------------------- sequencer
  setMode(mode) { this.mode = mode; }
  setIntensity(v) { this.intensity = clamp(v, 0, 1); }

  tick() {
    if (!this.ready || this.silent || !this.musicOn) return;
    const c = this.ctx;
    const stepDur = 60 / this.bpm / 4;
    const horizon = c.currentTime + 0.18;
    let guard = 0;
    while (this._nextTime < horizon && guard++ < 64) {
      this._playStep(this._step, this._nextTime);
      this._nextTime += stepDur;
      this._step = (this._step + 1) % 16;
      if (this._step === 0) this._bar++;
    }
  }

  _playStep(step, time) {
    const prog = PROGRESSIONS[this.mode] || PROGRESSIONS.calm;
    const chord = CHORDS[prog[this._bar % prog.length]];
    const I = this.intensity;
    const beat = step % 4 === 0;

    // pad on bar start
    if (step === 0) {
      this.pad(chord.pad, { dur: 2.7, gain: 0.030 + I * 0.022, when: time - this.ctx.currentTime, cutoff: 620 + I * 900 });
      if (this.mode !== 'end' || this._bar % 2 === 0) {
        this.bass(chord.bass, { dur: 2.2, gain: 0.10 + I * 0.07, when: time - this.ctx.currentTime });
      }
    }

    // arpeggio
    if (step % 2 === 0) {
      const pat = [0, 1, 2, 1, 2, 0, 1, 2];
      const idx = pat[(step / 2) % 8];
      const note = chord.pad[idx] + (step >= 8 ? 12 : 0);
      const g = (this.mode === 'end') ? 0.030 : 0.020 + I * 0.016;
      if (step % 4 === 0 || Math.random() < 0.55 + I * 0.3) {
        this.bell(note, { dur: 1.5, gain: g, when: time - this.ctx.currentTime, bright: 0.6 + I * 0.5, pan: rand(-0.4, 0.4) });
      }
    }

    // drums
    const drumOn = this.mode === 'song' || this.mode === 'tense' || this.mode === 'climax';
    if (drumOn) {
      if (beat && (step === 0 || step === 8 || (this.mode === 'climax' && step === 6))) {
        this.thump(58, { dur: 0.36, gain: 0.16 + I * 0.10, when: time - this.ctx.currentTime });
      }
      const hatEvery = this.mode === 'climax' ? 1 : 2;
      if (step % hatEvery === 0 && (this.mode === 'climax' || step % 4 === 2)) {
        this.noiseHit({ dur: 0.05, freq: 7000, q: 0.8, gain: 0.030 + I * 0.022, when: time - this.ctx.currentTime, type: 'highpass' });
      }
      if (this.mode === 'climax' && step % 2 === 1 && Math.random() < 0.6) {
        this.noiseHit({ dur: 0.03, freq: 9000, q: 0.7, gain: 0.018, when: time - this.ctx.currentTime, type: 'highpass' });
      }
    }
  }

  /** play a sequence of midi notes with a bell voice (the Engine's song) */
  playSequence(midis, { step = 0.24, gain = 0.20, spacing = 0.0, octave = 0 } = {}) {
    if (!this.ready || this.silent) return;
    midis.forEach((m, i) => {
      this.bell(m + octave, { dur: 2.2, gain, when: i * step + spacing, bright: 1.0, pan: ((i % 3) - 1) * 0.25 });
    });
  }
}
