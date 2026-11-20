/* VIGIL — procedural WebAudio: adaptive score + sound design.
   No audio files; everything is synthesised. */
window.Vigil = window.Vigil || {};
(function (V) {
  'use strict';

  function midiToFreq(m) { return 440 * Math.pow(2, (m - 69) / 12); }

  var CHORDS = {
    Am: [57, 60, 64, 69],
    F:  [53, 57, 60, 65],
    C:  [48, 55, 60, 64],
    G:  [55, 59, 62, 67],
    Dm: [50, 57, 62, 65],
    Em: [52, 59, 64, 67],
    E:  [52, 56, 59, 64],
    Bb: [46, 53, 58, 62],
    D:  [50, 54, 57, 62],
    Csus: [49, 54, 56, 61]
  };
  var BASS = { Am: 45, F: 41, C: 36, G: 43, Dm: 38, Em: 40, E: 40, Bb: 34, D: 38, Csus: 36 };

  var MOODS = {
    title:  { prog: ['Am', 'F', 'C', 'G'], bpm: 56, layers: { pad: 1, bell: 0.5, pulse: 0, bass: 0, trem: 0, arp: 0 }, cutoff: 1400 },
    calm:   { prog: ['Am', 'F', 'C', 'G'], bpm: 62, layers: { pad: 1, bell: 0.8, pulse: 0, bass: 0.4, trem: 0, arp: 0 }, cutoff: 1600 },
    deep:   { prog: ['Am', 'Dm', 'F', 'E'], bpm: 68, layers: { pad: 1, bell: 0.55, pulse: 0.6, bass: 0.7, trem: 0, arp: 0 }, cutoff: 1200 },
    storm:  { prog: ['Dm', 'Bb', 'F', 'G'], bpm: 84, layers: { pad: 0.9, bell: 0.35, pulse: 1, bass: 0.9, trem: 0.8, arp: 0 }, cutoff: 2000 },
    boss:   { prog: ['Am', 'F', 'Am', 'E'], bpm: 96, layers: { pad: 1, bell: 0.25, pulse: 1, bass: 1, trem: 1, arp: 0.5 }, cutoff: 2400 },
    dawn:   { prog: ['C', 'G', 'Am', 'F'], bpm: 60, layers: { pad: 1, bell: 0.9, pulse: 0, bass: 0.3, trem: 0, arp: 0.7 }, cutoff: 2600 },
    end:    { prog: ['C', 'F', 'C', 'G'], bpm: 54, layers: { pad: 1, bell: 1, pulse: 0, bass: 0, trem: 0, arp: 0.5 }, cutoff: 2800 },
    fail:   { prog: ['Am'], bpm: 50, layers: { pad: 1, bell: 0.2, pulse: 0, bass: 0.6, trem: 0, arp: 0 }, cutoff: 700 }
  };

  var SCALE_MINOR_PENT = [0, 3, 5, 7, 10];
  var SCALE_DORIAN = [0, 2, 3, 5, 7, 9, 10];
  var SCALE_MAJOR_PENT = [0, 2, 4, 7, 9];

  function Sound() {
    this.ok = false;
    this.muted = false;
    this.mood = null;
    this.moodName = 'title';
    this.appliedMood = null;
    this.ctx = null;
  }

  Sound.prototype.init = function () {
    if (this.ok) return;
    var AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    try {
      var ctx = new AC();
      this.ctx = ctx;

      this.master = ctx.createGain();
      this.master.gain.value = 0.85;
      this.comp = ctx.createDynamicsCompressor();
      this.comp.threshold.value = -16;
      this.comp.knee.value = 22;
      this.comp.ratio.value = 5;
      this.comp.attack.value = 0.004;
      this.comp.release.value = 0.24;
      this.master.connect(this.comp);
      this.comp.connect(ctx.destination);

      this.musicBus = ctx.createGain(); this.musicBus.gain.value = 0.5;
      this.sfxBus = ctx.createGain(); this.sfxBus.gain.value = 0.75;
      this.ambBus = ctx.createGain(); this.ambBus.gain.value = 0.55;
      this.musicBus.connect(this.master);
      this.sfxBus.connect(this.master);
      this.ambBus.connect(this.master);

      /* reverb */
      this.verb = ctx.createConvolver();
      this.verb.buffer = this.makeImpulse(2.8, 2.4);
      this.verbGain = ctx.createGain(); this.verbGain.gain.value = 0.33;
      this.verb.connect(this.verbGain);
      this.verbGain.connect(this.master);
      this.musicVerbSend = ctx.createGain(); this.musicVerbSend.gain.value = 0.5;
      this.musicVerbSend.connect(this.verb);
      this.sfxVerbSend = ctx.createGain(); this.sfxVerbSend.gain.value = 0.4;
      this.sfxVerbSend.connect(this.verb);

      this.noiseBuf = this.makeNoise(3);

      this.buildAmbience();
      this.buildBeamSounds();

      this.stepLen = 60 / 56 / 2;
      this.nextStep = ctx.currentTime + 0.1;
      this.stepCount = 0;
      this.chordIdx = 0;
      this.chordTime = 0;
      this.melNote = 69;
      this.ok = true;
      this.appliedMood = null;
      this.setMood(this.moodName || 'title');
      this.seqTimer = setInterval(this.tick.bind(this), 60);
    } catch (e) {
      this.ok = false;
    }
  };

  Sound.prototype.makeNoise = function (sec) {
    var ctx = this.ctx;
    var len = Math.floor(ctx.sampleRate * sec);
    var buf = ctx.createBuffer(1, len, ctx.sampleRate);
    var d = buf.getChannelData(0);
    for (var i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    return buf;
  };

  Sound.prototype.makeImpulse = function (sec, decay) {
    var ctx = this.ctx;
    var len = Math.floor(ctx.sampleRate * sec);
    var buf = ctx.createBuffer(2, len, ctx.sampleRate);
    for (var c = 0; c < 2; c++) {
      var d = buf.getChannelData(c);
      for (var i = 0; i < len; i++) {
        var t = i / len;
        d[i] = (Math.random() * 2 - 1) * Math.pow(1 - t, decay) * (i < 80 ? i / 80 : 1);
      }
    }
    return buf;
  };

  Sound.prototype.loopNoise = function (dest, filterType, freq, q) {
    var ctx = this.ctx;
    var src = ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    src.loop = true;
    var f = ctx.createBiquadFilter();
    f.type = filterType; f.frequency.value = freq; if (q) f.Q.value = q;
    var g = ctx.createGain(); g.gain.value = 0;
    src.connect(f); f.connect(g); g.connect(dest);
    src.start(ctx.currentTime + Math.random() * 0.1);
    return { src: src, filter: f, gain: g };
  };

  Sound.prototype.buildAmbience = function () {
    /* rolling sea */
    this.sea = this.loopNoise(this.ambBus, 'lowpass', 420, 0.6);
    this.sea.gain.gain.value = 0.11;
    var lfo = this.ctx.createOscillator();
    lfo.frequency.value = 0.09;
    var lg = this.ctx.createGain(); lg.gain.value = 0.055;
    lfo.connect(lg); lg.connect(this.sea.gain.gain);
    lfo.start();
    var lfo2 = this.ctx.createOscillator();
    lfo2.frequency.value = 0.043;
    var lg2 = this.ctx.createGain(); lg2.gain.value = 160;
    lfo2.connect(lg2); lg2.connect(this.sea.filter.frequency);
    lfo2.start();

    /* wind */
    this.wind = this.loopNoise(this.ambBus, 'bandpass', 480, 1.2);
    this.wind.gain.gain.value = 0;
    var wl = this.ctx.createOscillator(); wl.frequency.value = 0.13;
    var wg = this.ctx.createGain(); wg.gain.value = 260;
    wl.connect(wg); wg.connect(this.wind.filter.frequency);
    wl.start();

    /* rain */
    this.rain = this.loopNoise(this.ambBus, 'highpass', 3800, 0.5);
    this.rain.gain.gain.value = 0;
  };

  Sound.prototype.buildBeamSounds = function () {
    /* whoosh when the lens swings */
    this.sweep = this.loopNoise(this.sfxBus, 'bandpass', 700, 3.5);
    this.sweep.gain.gain.value = 0;
    /* flare roar */
    this.flareN = this.loopNoise(this.sfxBus, 'highpass', 2400, 0.7);
    this.flareN.gain.gain.value = 0;
    var ctx = this.ctx;
    this.flareOsc = ctx.createOscillator();
    this.flareOsc.type = 'sawtooth';
    this.flareOsc.frequency.value = 74;
    var flt = ctx.createBiquadFilter(); flt.type = 'lowpass'; flt.frequency.value = 320;
    this.flareGain = ctx.createGain(); this.flareGain.gain.value = 0;
    this.flareOsc.connect(flt); flt.connect(this.flareGain); this.flareGain.connect(this.sfxBus);
    this.flareOsc.start();
  };

  /* ---------- continuous controls ---------- */
  Sound.prototype.setSweep = function (v) {
    if (!this.ok) return;
    this.sweep.gain.gain.setTargetAtTime(V.clamp(v, 0, 1) * 0.16, this.ctx.currentTime, 0.06);
    this.sweep.filter.frequency.setTargetAtTime(500 + v * 900, this.ctx.currentTime, 0.08);
  };
  Sound.prototype.setFlare = function (v) {
    if (!this.ok) return;
    var t = this.ctx.currentTime;
    this.flareN.gain.gain.setTargetAtTime(V.clamp(v, 0, 1) * 0.11, t, 0.05);
    this.flareGain.gain.setTargetAtTime(V.clamp(v, 0, 1) * 0.075, t, 0.05);
    this.flareOsc.frequency.setTargetAtTime(66 + v * 26, t, 0.1);
  };
  Sound.prototype.setWind = function (v) {
    if (!this.ok) return;
    this.wind.gain.gain.setTargetAtTime(V.clamp(v, 0, 1) * 0.4, this.ctx.currentTime, 0.4);
  };
  Sound.prototype.setRain = function (v) {
    if (!this.ok) return;
    this.rain.gain.gain.setTargetAtTime(V.clamp(v, 0, 1) * 0.16, this.ctx.currentTime, 0.5);
  };
  Sound.prototype.setSea = function (v) {
    if (!this.ok) return;
    this.sea.gain.gain.setTargetAtTime(V.clamp(v, 0, 1) * 0.13, this.ctx.currentTime, 0.6);
  };

  /* ---------- one-shot voices ---------- */
  Sound.prototype.blip = function (o) {
    if (!this.ok || this.muted) return;
    var ctx = this.ctx, t = ctx.currentTime + (o.at || 0);
    var osc = ctx.createOscillator();
    osc.type = o.type || 'sine';
    var f0 = o.freq || 440;
    osc.frequency.setValueAtTime(f0, t);
    if (o.to) osc.frequency.exponentialRampToValueAtTime(Math.max(1, o.to), t + (o.dur || 0.3));
    var g = ctx.createGain();
    var a = o.attack === undefined ? 0.008 : o.attack;
    var dur = o.dur || 0.3;
    var peak = o.gain === undefined ? 0.2 : o.gain;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    var dest = (o.verb ? this.sfxVerbSend : this.sfxBus);
    if (o.verb) { g.connect(this.sfxBus); }
    osc.connect(g); g.connect(dest);
    if (o.verb) g.connect(this.sfxVerbSend);
    osc.start(t); osc.stop(t + dur + 0.05);
    osc.onended = function () { try { g.disconnect(); } catch (e) {} };
    if (o.detune && osc.detune) osc.detune.value = o.detune;
    return osc;
  };

  Sound.prototype.noiseBurst = function (o) {
    if (!this.ok || this.muted) return;
    var ctx = this.ctx, t = ctx.currentTime + (o.at || 0);
    var src = ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    src.playbackRate.value = o.rate || 1;
    var f = ctx.createBiquadFilter();
    f.type = o.filter || 'lowpass';
    f.frequency.setValueAtTime(o.freq || 1000, t);
    if (o.to) f.frequency.exponentialRampToValueAtTime(Math.max(20, o.to), t + (o.dur || 0.4));
    f.Q.value = o.q || 0.8;
    var g = ctx.createGain();
    var dur = o.dur || 0.4;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(o.gain === undefined ? 0.3 : o.gain, t + (o.attack || 0.01));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f); f.connect(g);
    g.connect(this.sfxBus);
    if (o.verb) g.connect(this.sfxVerbSend);
    var off = Math.random() * 2;
    src.start(t, off); src.stop(t + dur + 0.05);
    src.onended = function () { try { g.disconnect(); } catch (e) {} };
  };

  /* ---------- sfx ---------- */
  Sound.prototype.sfx = function (name, arg) {
    if (!this.ok || this.muted) return;
    var r = Math.random;
    switch (name) {
      case 'click':
        this.blip({ freq: 660, type: 'triangle', dur: 0.07, gain: 0.06 });
        break;
      case 'card':
        this.blip({ freq: 392, type: 'sine', dur: 0.5, gain: 0.1, verb: 1 });
        this.blip({ freq: 587.3, type: 'sine', dur: 0.7, gain: 0.06, at: 0.07, verb: 1 });
        break;
      case 'type':
        this.blip({ freq: 1400 + r() * 500, type: 'square', dur: 0.02, gain: 0.012 });
        break;
      case 'save':
        this.blip({ freq: 523.25, type: 'sine', dur: 0.8, gain: 0.14, verb: 1 });
        this.blip({ freq: 784, type: 'sine', dur: 1.1, gain: 0.1, at: 0.09, verb: 1 });
        this.horn(0.5, 0.9);
        break;
      case 'horn':
        this.horn(arg === undefined ? 0.6 : arg, 1.1);
        break;
      case 'wreck':
        this.noiseBurst({ filter: 'lowpass', freq: 1800, to: 120, dur: 0.9, gain: 0.5, verb: 1 });
        this.blip({ freq: 130, to: 38, type: 'sine', dur: 0.9, gain: 0.4 });
        this.blip({ freq: 62, to: 30, type: 'triangle', dur: 1.3, gain: 0.32, at: 0.04, verb: 1 });
        for (var i = 0; i < 5; i++) {
          this.blip({ freq: 700 + r() * 1400, type: 'square', dur: 0.05, gain: 0.04, at: 0.1 + r() * 0.5 });
        }
        break;
      case 'burn':
        this.noiseBurst({ filter: 'bandpass', freq: 3400, to: 900, dur: 0.5, gain: 0.24, q: 1.4, verb: 1 });
        this.blip({ freq: 190, to: 70, type: 'sawtooth', dur: 0.4, gain: 0.1 });
        break;
      case 'monsterDie':
        this.noiseBurst({ filter: 'bandpass', freq: 4200, to: 500, dur: 0.7, gain: 0.3, q: 2, verb: 1 });
        this.blip({ freq: 240, to: 55, type: 'sawtooth', dur: 0.55, gain: 0.16, verb: 1 });
        break;
      case 'breach':
        this.blip({ freq: 92, to: 44, type: 'sawtooth', dur: 1.1, gain: 0.34, verb: 1 });
        this.noiseBurst({ filter: 'lowpass', freq: 900, to: 100, dur: 0.8, gain: 0.36, verb: 1 });
        this.blip({ freq: 1174.7, type: 'square', dur: 0.16, gain: 0.07, at: 0.05 });
        break;
      case 'overheat':
        this.blip({ freq: 1500, to: 300, type: 'square', dur: 0.2, gain: 0.07 });
        this.noiseBurst({ filter: 'highpass', freq: 4000, dur: 0.5, gain: 0.12 });
        break;
      case 'flareOn':
        this.noiseBurst({ filter: 'highpass', freq: 1200, to: 5000, dur: 0.3, gain: 0.14 });
        break;
      case 'thunder':
        var d = arg === undefined ? 1 : arg;
        this.noiseBurst({ filter: 'lowpass', freq: 400, to: 60, dur: 1.6 + d, gain: 0.34 + 0.3 * (1 - d), verb: 1 });
        this.noiseBurst({ filter: 'bandpass', freq: 2400, to: 300, dur: 0.35, gain: 0.2, at: 0.02 });
        break;
      case 'roar':
        this.blip({ freq: 74, to: 36, type: 'sawtooth', dur: 2.4, gain: 0.34, verb: 1 });
        this.blip({ freq: 78.5, to: 38, type: 'sawtooth', dur: 2.4, gain: 0.28, at: 0.02, verb: 1, detune: 18 });
        this.noiseBurst({ filter: 'bandpass', freq: 500, to: 140, dur: 2.2, gain: 0.3, q: 0.9, verb: 1 });
        this.noiseBurst({ filter: 'highpass', freq: 2600, dur: 0.5, gain: 0.14 });
        break;
      case 'slam':
        this.blip({ freq: 60, to: 26, type: 'sine', dur: 2.0, gain: 0.5, verb: 1 });
        this.noiseBurst({ filter: 'lowpass', freq: 1400, to: 60, dur: 1.6, gain: 0.5, verb: 1 });
        break;
      case 'eye':
        this.blip({ freq: 1174.7, type: 'sine', dur: 0.7, gain: 0.16, verb: 1 });
        this.blip({ freq: 1568, type: 'sine', dur: 0.9, gain: 0.1, at: 0.05, verb: 1 });
        this.noiseBurst({ filter: 'highpass', freq: 5200, dur: 0.4, gain: 0.16 });
        break;
      case 'bossDie':
        this.blip({ freq: 48, to: 24, type: 'sine', dur: 3.2, gain: 0.5, verb: 1 });
        this.noiseBurst({ filter: 'lowpass', freq: 3000, to: 60, dur: 2.6, gain: 0.42, verb: 1 });
        this.blip({ freq: 220, to: 440, type: 'sawtooth', dur: 1.4, gain: 0.14, at: 0.1, verb: 1 });
        break;
      case 'rise':
        this.blip({ freq: 40, to: 30, type: 'sine', dur: 3.4, gain: 0.44, verb: 1 });
        this.noiseBurst({ filter: 'lowpass', freq: 260, to: 900, dur: 3.0, gain: 0.3, verb: 1 });
        break;
      case 'fail':
        this.blip({ freq: 196, to: 98, type: 'sawtooth', dur: 1.6, gain: 0.2, verb: 1 });
        this.blip({ freq: 207.65, to: 103, type: 'sawtooth', dur: 1.6, gain: 0.16, at: 0.03, verb: 1, detune: 14 });
        this.blip({ freq: 65, to: 32, type: 'sine', dur: 2.2, gain: 0.34, verb: 1 });
        break;
      case 'bell':
        this.blip({ freq: arg || 880, type: 'sine', dur: 1.6, gain: 0.13, verb: 1 });
        this.blip({ freq: (arg || 880) * 2.01, type: 'sine', dur: 1.1, gain: 0.05, verb: 1 });
        break;
      case 'windGust':
        this.noiseBurst({ filter: 'bandpass', freq: 500, to: 1400, dur: 2.4, gain: 0.2, q: 0.7, verb: 1 });
        break;
      case 'dawn':
        this.blip({ freq: 261.63, type: 'sine', dur: 3.4, gain: 0.14, verb: 1 });
        this.blip({ freq: 392, type: 'sine', dur: 3.2, gain: 0.1, at: 0.4, verb: 1 });
        this.blip({ freq: 523.25, type: 'sine', dur: 3.6, gain: 0.1, at: 0.9, verb: 1 });
        break;
    }
  };

  Sound.prototype.horn = function (dist, dur) {
    if (!this.ok || this.muted) return;
    var ctx = this.ctx, t = ctx.currentTime;
    var g = ctx.createGain();
    var f = ctx.createBiquadFilter();
    f.type = 'lowpass'; f.frequency.value = 700 - dist * 350;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.16 * (1 - dist * 0.6), t + 0.16);
    g.gain.setValueAtTime(0.16 * (1 - dist * 0.6), t + dur * 0.5);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    [1, 1.005, 0.5].forEach(function (mul, i) {
      var o = ctx.createOscillator();
      o.type = i === 2 ? 'triangle' : 'sawtooth';
      o.frequency.value = 116 * mul;
      var og = ctx.createGain(); og.gain.value = i === 2 ? 0.5 : 1;
      o.connect(og); og.connect(f);
      o.start(t); o.stop(t + dur + 0.1);
      o.onended = function () { try { og.disconnect(); } catch (e) {} };
    });
    f.connect(g); g.connect(this.sfxBus); g.connect(this.sfxVerbSend);
    setTimeout(function () { try { g.disconnect(); f.disconnect(); } catch (e) {} }, (dur + 0.4) * 1000);
  };

  /* ---------- adaptive music sequencer ---------- */
  Sound.prototype.setMood = function (name) {
    this.moodName = name;
    if (!this.ok) return;
    if (this.appliedMood === name) return;
    this.appliedMood = name;
    this.mood = MOODS[name] || MOODS.calm;
    this.chordIdx = 0;
    this.chordTime = 0;
    this.stepLen = 60 / this.mood.bpm / 2;
    /* pad voice crossfade */
    this.scheduleChord(this.ctx.currentTime + 0.06, 0.06, 3.2);
    if (name === 'fail') this.sfx('fail');
    if (name === 'dawn') this.sfx('dawn');
    if (name === 'boss') this.sfx('rise');
  };

  Sound.prototype.scheduleChord = function (t, attack, release) {
    var m = this.mood;
    if (!m || !m.prog) return;
    var name = m.prog[this.chordIdx % m.prog.length];
    var notes = CHORDS[name];
    if (!notes) return;
    var ctx = this.ctx;
    var bus = this.musicBus;
    if (!this.padVoices) this.padVoices = [];
    var self = this;

    /* release old voices */
    this.padVoices.forEach(function (v) {
      try {
        v.g.gain.cancelScheduledValues(t);
        v.g.gain.setTargetAtTime(0.0001, t, release * 0.35);
        v.o1.stop(t + release + 1.2);
        v.o2.stop(t + release + 1.2);
      } catch (e) {}
    });
    this.padVoices = [];

    var cutoff = m.cutoff || 1400;
    notes.forEach(function (midi, i) {
      var f = midiToFreq(midi);
      var o1 = ctx.createOscillator();
      o1.type = 'triangle';
      o1.frequency.value = f;
      var o2 = ctx.createOscillator();
      o2.type = 'sawtooth';
      o2.frequency.value = f;
      o2.detune.value = 6;
      var flt = ctx.createBiquadFilter();
      flt.type = 'lowpass';
      flt.frequency.value = cutoff * (i === 0 ? 0.55 : 1);
      flt.Q.value = 0.6;
      var g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime((i === 0 ? 0.05 : 0.03) * (m.layers.pad || 1), t + attack);
      var mix = ctx.createGain(); mix.gain.value = 0.5;
      o1.connect(mix); o2.connect(mix); mix.connect(flt); flt.connect(g);
      g.connect(bus); g.connect(self.musicVerbSend);
      o1.start(t); o2.start(t);
      self.padVoices.push({ o1: o1, o2: o2, g: g, mix: mix, flt: flt });
    });
  };

  Sound.prototype.tick = function () {
    if (!this.ok || this.muted) return;
    var ctx = this.ctx;
    var now = ctx.currentTime;
    if (this.nextStep < now - 0.5) this.nextStep = now + 0.05;
    while (this.nextStep < now + 0.28) {
      this.scheduleStep(this.nextStep, this.stepCount);
      this.nextStep += this.stepLen;
      this.stepCount++;
    }
  };

  Sound.prototype.scheduleStep = function (t, step) {
    var m = this.mood;
    if (!m || !m.layers) return;
    var L = m.layers;
    var bar = step % 16;

    if (bar === 0) {
      this.chordIdx++;
      this.scheduleChord(t, 1.4, 2.6);
    }

    /* bass */
    if (L.bass > 0 && (bar % 4 === 0 || (L.bass > 0.8 && bar % 2 === 1))) {
      var bname = m.prog[this.chordIdx % m.prog.length];
      var bm = BASS[bname];
      if (bm !== undefined) {
        var accent = bar % 8 === 0 ? 1 : 0.7;
        this.tone(t, midiToFreq(bm), 'triangle', this.stepLen * 1.6, 0.11 * L.bass * accent, { verb: false, lowpass: 500 });
        if (L.bass > 0.85) this.tone(t, midiToFreq(bm - 12), 'sine', this.stepLen * 1.4, 0.1 * L.bass, {});
      }
    }

    /* pulse (kick-ish) */
    if (L.pulse > 0 && (bar % 4 === 0 || (L.pulse >= 1 && (bar === 6 || bar === 10)))) {
      var o = this.blip({ freq: 120, to: 42, type: 'sine', dur: 0.3, gain: 0.17 * L.pulse });
      if (L.pulse >= 1 && bar % 8 === 4) {
        this.noiseBurst({ filter: 'highpass', freq: 6000, dur: 0.09, gain: 0.05, at: 0 });
      }
    }

    /* tremolo strings (storm/boss) */
    if (L.trem > 0 && bar % 8 === 0) {
      var tname = m.prog[this.chordIdx % m.prog.length];
      var tn = CHORDS[tname];
      if (tn) {
        var self = this;
        [tn[1], tn[2]].forEach(function (midi) {
          self.tone(t, midiToFreq(midi + 12), 'sawtooth', self.stepLen * 7, 0.035 * L.trem,
            { lowpass: 2400, trem: 9, verb: true });
        });
      }
    }

    /* bass ostinato 8ths for boss */
    if (L.arp > 0 && L.pulse >= 1) {
      var aname = m.prog[this.chordIdx % m.prog.length];
      var an = CHORDS[aname];
      if (an && step % 2 === 0) {
        var idx = (step / 2) % an.length;
        this.tone(t, midiToFreq(an[idx] - 12), 'square', this.stepLen * 0.9, 0.045 * L.arp, { lowpass: 900 });
      }
    }

    /* bells / melody */
    var bellP = L.bell || 0;
    if (bellP > 0 && step % 2 === 0) {
      var scale = (this.moodName === 'dawn' || this.moodName === 'end') ? SCALE_MAJOR_PENT :
        (this.moodName === 'storm' ? SCALE_DORIAN : SCALE_MINOR_PENT);
      if (Math.random() < bellP * 0.42) {
        var stepMove = Math.random() < 0.7 ? (Math.random() < 0.5 ? -1 : 1) : (Math.random() < 0.5 ? -2 : 2);
        this.melIdx = (this.melIdx === undefined ? 2 : this.melIdx) + stepMove;
        this.melIdx = V.clamp(this.melIdx, 0, scale.length * 2 - 1);
        var oct = Math.floor(this.melIdx / scale.length);
        var semi = scale[this.melIdx % scale.length] + oct * 12;
        var rootName = m.prog[this.chordIdx % m.prog.length];
        var rootMidi = (CHORDS[rootName] || CHORDS.Am)[0];
        var freq = midiToFreq(rootMidi + 12 + semi);
        var long = Math.random() < 0.3;
        this.tone(t, freq, 'sine', long ? this.stepLen * 4 : this.stepLen * 2.2, 0.075 * bellP, { verb: true, bell: true });
        this.tone(t, freq * 2.004, 'sine', this.stepLen * 1.4, 0.02 * bellP, { verb: true });
      }
    }
  };

  /* generic scheduled tone */
  Sound.prototype.tone = function (t, freq, type, dur, gain, o) {
    if (!this.ok) return;
    o = o || {};
    var ctx = this.ctx;
    var osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.value = freq;
    if (o.detune) osc.detune.value = o.detune;
    var g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(gain, t + (o.attack || 0.02));
    g.gain.setTargetAtTime(0.0001, t + dur * 0.6, dur * 0.28);
    var node = osc;
    if (o.lowpass) {
      var f = ctx.createBiquadFilter();
      f.type = 'lowpass'; f.frequency.value = o.lowpass;
      osc.connect(f); node = f;
    }
    if (o.trem) {
      var tg = ctx.createGain(); tg.gain.value = 1;
      var lfo = ctx.createOscillator(); lfo.frequency.value = o.trem;
      var lg = ctx.createGain(); lg.gain.value = 0.55;
      lfo.connect(lg); lg.connect(tg.gain);
      lfo.start(t); lfo.stop(t + dur + 1);
      node.connect(tg); node = tg;
      g.connect(this.musicBus);
      g.connect(this.musicVerbSend);
      node.connect(g);
      var self = this;
      osc.onended = function () { try { g.disconnect(); node.disconnect(); } catch (e) {} };
    } else {
      node.connect(g);
      g.connect(this.musicBus);
      if (o.verb) g.connect(this.musicVerbSend);
    }
    osc.start(t);
    osc.stop(t + dur + 1.4);
    osc.onended = function () { try { g.disconnect(); } catch (e) {} };
  };

  Sound.prototype.setMute = function (m) {
    this.muted = m;
    if (this.ok) this.master.gain.setTargetAtTime(m ? 0 : 0.85, this.ctx.currentTime, 0.05);
  };

  Sound.prototype.suspend = function () {
    if (this.ok && this.ctx.state === 'running') this.ctx.suspend();
  };
  Sound.prototype.resume = function () {
    if (this.ok && this.ctx.state === 'suspended') this.ctx.resume();
  };

  V.sound = new Sound();

})(window.Vigil);
