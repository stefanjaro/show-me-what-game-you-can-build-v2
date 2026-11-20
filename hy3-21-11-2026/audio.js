'use strict';

const Sound = (function () {
  let ctx = null, master = null, delay = null, fb = null, wet = null;
  let ambGain = null, ambFilter = null, ambNodes = [], started = false;
  const PENTA = [523.25, 587.33, 659.25, 783.99, 880.0, 1046.5];

  function init() {
    if (ctx) return;
    try {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      master = ctx.createGain();
      master.gain.value = 0.0;
      master.connect(ctx.destination);

      delay = ctx.createDelay(1.0);
      delay.delayTime.value = 0.34;
      fb = ctx.createGain();
      fb.gain.value = 0.34;
      delay.connect(fb);
      fb.connect(delay);
      wet = ctx.createGain();
      wet.gain.value = 0.5;
      delay.connect(wet);
      wet.connect(master);

      ambGain = ctx.createGain();
      ambGain.gain.value = 0.0;
      ambFilter = ctx.createBiquadFilter();
      ambFilter.type = 'lowpass';
      ambFilter.frequency.value = 600;
      ambFilter.connect(ambGain);
      ambGain.connect(master);
      ambGain.connect(delay);

      master.gain.setTargetAtTime(0.85, ctx.currentTime, 1.2);
    } catch (e) {
      ctx = null;
    }
  }

  function resume() {
    if (!ctx) init();
    if (ctx && ctx.state === 'suspended') ctx.resume();
  }

  function startAmbient() {
    if (!ctx || started) return;
    started = true;
    const roots = [110, 164.81, 220];
    roots.forEach((f, i) => {
      const o = ctx.createOscillator();
      o.type = i === 0 ? 'sine' : 'triangle';
      o.frequency.value = f;
      o.detune.value = i === 1 ? 4 : -3;
      const g = ctx.createGain();
      g.gain.value = i === 0 ? 0.5 : 0.22;
      o.connect(g);
      g.connect(ambFilter);
      o.start();
      ambNodes.push(o);
    });
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.06;
    const lg = ctx.createGain();
    lg.gain.value = 280;
    lfo.connect(lg);
    lg.connect(ambFilter.frequency);
    lfo.start();
    ambNodes.push(lfo);
    ambGain.gain.setTargetAtTime(0.22, ctx.currentTime, 2.0);
  }

  function setMood(act) {
    if (!ctx) return;
    startAmbient();
    let base, cut, vol;
    if (act === 1) { base = [110, 164.81, 220]; cut = 520; vol = 0.22; }
    else if (act === 2) { base = [82.41, 123.47, 164.81]; cut = 320; vol = 0.3; }
    else { base = [146.83, 220, 293.66]; cut = 1300; vol = 0.32; }
    const oscs = ambNodes.filter(n => n.frequency && n.frequency.value < 1000);
    oscs.forEach((o, i) => {
      if (base[i] !== undefined) o.frequency.setTargetAtTime(base[i], ctx.currentTime, 1.5);
    });
    ambFilter.frequency.setTargetAtTime(cut, ctx.currentTime, 1.5);
    ambGain.gain.setTargetAtTime(vol, ctx.currentTime, 1.5);
  }

  function chime(i) {
    if (!ctx) return;
    const f = PENTA[((i % PENTA.length) + PENTA.length) % PENTA.length];
    const t = ctx.currentTime;
    const o = ctx.createOscillator();
    o.type = 'sine';
    o.frequency.value = f;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.32, t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.7);
    o.connect(g);
    g.connect(master);
    g.connect(delay);
    o.start(t);
    o.stop(t + 0.75);
    const o2 = ctx.createOscillator();
    o2.type = 'sine';
    o2.frequency.value = f * 2;
    const g2 = ctx.createGain();
    g2.gain.setValueAtTime(0.0001, t);
    g2.gain.exponentialRampToValueAtTime(0.12, t + 0.02);
    g2.gain.exponentialRampToValueAtTime(0.0001, t + 0.45);
    o2.connect(g2);
    g2.connect(master);
    o2.start(t);
    o2.stop(t + 0.5);
  }

  function ignite(i) {
    if (!ctx) return;
    const t = ctx.currentTime;
    const f = 261.63 * Math.pow(2, (i % 8) / 12);
    [1, 1.5, 2].forEach((mul, k) => {
      const o = ctx.createOscillator();
      o.type = k === 0 ? 'sine' : 'triangle';
      o.frequency.value = f * mul;
      const g = ctx.createGain();
      const peak = k === 0 ? 0.3 : 0.12;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(peak, t + 0.03);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 1.6);
      o.connect(g);
      g.connect(master);
      g.connect(delay);
      o.start(t);
      o.stop(t + 1.7);
    });
  }

  function hit() {
    if (!ctx) return;
    const t = ctx.currentTime;
    const o = ctx.createOscillator();
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(180, t);
    o.frequency.exponentialRampToValueAtTime(40, t + 0.4);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.4, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.45);
    o.connect(g);
    g.connect(master);
    o.start(t);
    o.stop(t + 0.5);
  }

  function bolt() {
    if (!ctx) return;
    const t = ctx.currentTime;
    const o = ctx.createOscillator();
    o.type = 'square';
    o.frequency.setValueAtTime(420, t);
    o.frequency.exponentialRampToValueAtTime(120, t + 0.18);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.16, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.2);
    o.connect(g);
    g.connect(master);
    o.start(t);
    o.stop(t + 0.22);
  }

  function finale() {
    if (!ctx) return;
    const t = ctx.currentTime;
    const chord = [130.81, 164.81, 196.0, 261.63, 329.63, 392.0, 523.25];
    chord.forEach((f, i) => {
      const o = ctx.createOscillator();
      o.type = i % 2 ? 'triangle' : 'sine';
      o.frequency.value = f;
      const g = ctx.createGain();
      const peak = i < 3 ? 0.22 : 0.14;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(peak, t + 0.4 + i * 0.04);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 6.0);
      o.connect(g);
      g.connect(master);
      g.connect(delay);
      o.start(t);
      o.stop(t + 6.2);
    });
    ambGain.gain.setTargetAtTime(0.14, t, 1.0);
  }

  function stopAmbient() {
    if (!ctx || !started) return;
    ambGain.gain.setTargetAtTime(0.0001, ctx.currentTime, 0.6);
  }

  return {
    init, resume, startAmbient, setMood, chime, ignite, hit, bolt, finale, stopAmbient
  };
})();
if (typeof window !== 'undefined') window.Sound = Sound;
