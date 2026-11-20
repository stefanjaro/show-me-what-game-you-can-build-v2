const AUD = (() => {
  let ctx = null, master, comp, lp, verb, verbGain, noiseBuf;
  let muted = false;
  let amb = null;
  const music = { on: false, next: 0, step: 0, ch: 0, intensity: 0 };
  const PENT = [0, 3, 5, 7, 10];

  function init() {
    if (ctx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    try {
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.85;
      lp = ctx.createBiquadFilter();
      lp.type = "lowpass";
      lp.frequency.value = 19000;
      comp = ctx.createDynamicsCompressor();
      master.connect(lp);
      lp.connect(comp);
      comp.connect(ctx.destination);
      verb = ctx.createConvolver();
      verb.buffer = makeIR(2.6, 2.4);
      verbGain = ctx.createGain();
      verbGain.gain.value = 0.38;
      verb.connect(verbGain);
      verbGain.connect(master);
      noiseBuf = makeNoise(2);
      startAmbient();
      music.next = ctx.currentTime + 0.2;
    } catch (e) {
      ctx = null;
    }
  }

  function makeIR(sec, decay) {
    const len = Math.floor(ctx.sampleRate * sec);
    const buf = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let c = 0; c < 2; c++) {
      const d = buf.getChannelData(c);
      for (let i = 0; i < len; i++) {
        d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
      }
    }
    return buf;
  }

  function makeNoise(sec) {
    const len = Math.floor(ctx.sampleRate * sec);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    return buf;
  }

  function out(node, wet, t0, dur) {
    node.connect(master);
    if (wet > 0 && verb) {
      const g = ctx.createGain();
      g.gain.value = wet;
      node.connect(g);
      g.connect(verb);
    }
    if (t0 !== undefined && dur !== undefined) {
      node.stopAt = t0 + dur;
    }
  }

  function env(t0, a, peak, d, sus) {
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.linearRampToValueAtTime(peak, t0 + a);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0001, sus || 0.0001), t0 + a + d);
    return g;
  }

  function tone(type, f0, f1, t0, a, d, peak, wet) {
    if (!ctx) return;
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(Math.max(20, f0), t0);
    if (f1 && f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t0 + a + d);
    const g = env(t0, a, peak, d);
    o.connect(g);
    out(g, wet);
    o.start(t0);
    o.stop(t0 + a + d + 0.1);
  }

  function noiseHit(t0, dur, peak, type, freq, q, wet) {
    if (!ctx) return;
    const s = ctx.createBufferSource();
    s.buffer = noiseBuf;
    s.loop = true;
    const f = ctx.createBiquadFilter();
    f.type = type || "bandpass";
    f.frequency.value = freq || 800;
    f.Q.value = q || 1;
    const g = env(t0, 0.01, peak, dur);
    s.connect(f);
    f.connect(g);
    out(g, wet || 0.2);
    s.start(t0);
    s.stop(t0 + dur + 0.1);
  }

  function startAmbient() {
    if (!ctx || amb) return;
    const g = ctx.createGain();
    g.gain.value = 0.0;
    g.gain.setTargetAtTime(0.06, ctx.currentTime, 3);
    const s = ctx.createBufferSource();
    s.buffer = noiseBuf;
    s.loop = true;
    const f = ctx.createBiquadFilter();
    f.type = "lowpass";
    f.frequency.value = 110;
    s.connect(f);
    f.connect(g);
    g.connect(master);
    s.start();

    const sub = ctx.createOscillator();
    sub.type = "sine";
    sub.frequency.value = 38;
    const sg = ctx.createGain();
    sg.gain.value = 0.035;
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.07;
    const lg = ctx.createGain();
    lg.gain.value = 0.018;
    lfo.connect(lg);
    lg.connect(sg.gain);
    sub.connect(sg);
    sg.connect(master);
    sub.start();
    lfo.start();

    const airy = ctx.createBufferSource();
    airy.buffer = noiseBuf;
    airy.loop = true;
    const af = ctx.createBiquadFilter();
    af.type = "bandpass";
    af.frequency.value = 420;
    af.Q.value = 2.5;
    const ag = ctx.createGain();
    ag.gain.value = 0.012;
    const alfo = ctx.createOscillator();
    alfo.frequency.value = 0.05;
    const alg = ctx.createGain();
    alg.gain.value = 0.008;
    alfo.connect(alg);
    alg.connect(ag.gain);
    airy.connect(af);
    af.connect(ag);
    ag.connect(master);
    airy.start();
    alfo.start();

    amb = { g, sg };
  }

  function duck() {
    if (!ctx || !amb) return;
    const t = ctx.currentTime;
    amb.g.gain.cancelScheduledValues(t);
    amb.g.gain.setValueAtTime(amb.g.gain.value, t);
    amb.g.gain.linearRampToValueAtTime(0.018, t + 0.05);
    amb.g.gain.linearRampToValueAtTime(0.06, t + 1.2);
  }

  function freqOf(step) {
    const n = PENT[((step % 5) + 5) % 5] + 12 * Math.floor(step / 5);
    return 523.25 * Math.pow(2, n / 12);
  }

  const api = {
    get ready() { return !!ctx; },
    init,
    resume() {
      if (ctx && ctx.state === "suspended") ctx.resume().catch(() => {});
    },
    setMute(m) {
      muted = m;
      if (ctx) master.gain.setTargetAtTime(m ? 0 : 0.85, ctx.currentTime, 0.1);
    },
    get muted() { return muted; },

    ping(charge, quiet) {
      if (!ctx) return;
      duck();
      const t = ctx.currentTime;
      const f0 = quiet ? 1500 : 1150 - charge * 260;
      tone("sine", f0, quiet ? 620 : 190, t, 0.015, 0.45 + charge * 0.5, 0.1 + charge * 0.1, 0.55);
      tone("sine", f0 * 0.5, f0 * 0.5, t, 0.005, 0.12, 0.06, 0.1);
    },

    chime(step, soft) {
      if (!ctx) return;
      const t = ctx.currentTime;
      const f = freqOf(step);
      const peak = soft ? 0.07 : 0.11;
      const car = ctx.createOscillator();
      car.type = "sine";
      car.frequency.value = f;
      const mod = ctx.createOscillator();
      mod.type = "sine";
      mod.frequency.value = f * 2.41;
      const mg = ctx.createGain();
      mg.gain.setValueAtTime(f * 1.6, t);
      mg.gain.exponentialRampToValueAtTime(1, t + 0.9);
      mod.connect(mg);
      const g = env(t, 0.008, peak, 1.15);
      mg.connect(car.frequency);
      car.connect(g);
      out(g, 0.65);
      car.start(t);
      mod.start(t);
      car.stop(t + 1.4);
      mod.stop(t + 1.4);
    },

    growl(v) {
      if (!ctx) return;
      const t = ctx.currentTime;
      const o = ctx.createOscillator();
      o.type = "sawtooth";
      o.frequency.setValueAtTime(58, t);
      o.frequency.exponentialRampToValueAtTime(36, t + 1.1);
      const f = ctx.createBiquadFilter();
      f.type = "lowpass";
      f.frequency.value = 240;
      const am = ctx.createOscillator();
      am.frequency.value = 9;
      const ag = ctx.createGain();
      ag.gain.value = 0.5;
      am.connect(ag);
      const g = env(t, 0.06, 0.28 * v, 1.2);
      ag.connect(g.gain);
      o.connect(f);
      f.connect(g);
      out(g, 0.4);
      o.start(t);
      am.start(t);
      o.stop(t + 1.4);
      am.stop(t + 1.4);
    },

    click(v) {
      if (!ctx) return;
      noiseHit(ctx.currentTime, 0.05, 0.05 * v, "bandpass", 2400, 4, 0.15);
    },

    moan(kind) {
      if (!ctx) return;
      const t = ctx.currentTime;
      const o = ctx.createOscillator();
      o.type = "sine";
      o.frequency.value = kind === "low" ? 33 : 46;
      const vib = ctx.createOscillator();
      vib.frequency.value = 2.1;
      const vg = ctx.createGain();
      vg.gain.value = 5;
      vib.connect(vg);
      vg.connect(o.frequency);
      const g = env(t, 0.5, kind === "low" ? 0.4 : 0.3, kind === "low" ? 3.2 : 2.4, 0.0001);
      o.connect(g);
      out(g, 0.7);
      noiseHit(t, 1.8, 0.05, "lowpass", 180, 1, 0.3);
      o.start(t);
      vib.start(t);
      o.stop(t + 4);
      vib.stop(t + 4);
    },

    thud(v) {
      if (!ctx) return;
      const t = ctx.currentTime;
      tone("sine", 82, 38, t, 0.005, 0.28, 0.3 * v, 0.25);
      noiseHit(t, 0.16, 0.12 * v, "lowpass", 300, 1, 0.2);
    },

    hurt() {
      if (!ctx) return;
      const t = ctx.currentTime;
      tone("square", 210, 90, t, 0.005, 0.22, 0.14, 0.2);
      noiseHit(t, 0.3, 0.2, "bandpass", 900, 2, 0.25);
      tone("sine", 60, 40, t, 0.01, 0.5, 0.3, 0.2);
      if (lp) {
        lp.frequency.setTargetAtTime(900, t, 0.02);
        lp.frequency.setTargetAtTime(19000, t + 0.5, 0.4);
      }
    },

    explode() {
      if (!ctx) return;
      const t = ctx.currentTime;
      noiseHit(t, 0.7, 0.32, "lowpass", 500, 1, 0.6);
      tone("sine", 130, 28, t, 0.005, 0.8, 0.4, 0.5);
    },

    door() {
      if (!ctx) return;
      const t = ctx.currentTime;
      this.chime(0, true);
      setTimeout(() => this.chime(4, true), 180);
      tone("sine", 110, 220, t + 0.1, 0.4, 1.2, 0.07, 0.5);
    },

    warnSurge() {
      if (!ctx) return;
      const t = ctx.currentTime;
      noiseHit(t, 1.1, 0.16, "lowpass", 260, 1, 0.4);
      tone("sine", 48, 70, t, 0.6, 0.9, 0.18, 0.3);
    },

    checkpoint() {
      if (!ctx) return;
      const t = ctx.currentTime;
      this.chime(2, true);
      setTimeout(() => this.chime(4, true), 140);
    },

    heart(v) {
      if (!ctx) return;
      const t = ctx.currentTime;
      tone("sine", 58, 40, t, 0.01, 0.16, 0.35 * v, 0);
      tone("sine", 52, 38, t + 0.26, 0.01, 0.2, 0.28 * v, 0);
    },

    blip(i) {
      if (!ctx) return;
      tone("sine", 660 + ((i * 53) % 420), 0, ctx.currentTime, 0.004, 0.045, 0.03, 0);
    },

    shock() {
      if (!ctx) return;
      const t = ctx.currentTime;
      tone("sine", 900, 130, t, 0.01, 0.4, 0.18, 0.3);
      noiseHit(t, 0.25, 0.12, "highpass", 1400, 1, 0.2);
    },

    motif() {
      if (!ctx) return;
      const notes = [0, 3, 5, 7, 5, 3, 0, -2];
      notes.forEach((n, i) => {
        const f = 523.25 * Math.pow(2, n / 12);
        setTimeout(() => {
          if (!ctx) return;
          const t = ctx.currentTime;
          const car = ctx.createOscillator();
          car.type = "sine";
          car.frequency.value = f / 2;
          const g = env(t, 0.05, 0.09, 1.6);
          car.connect(g);
          out(g, 0.8);
          car.start(t);
          car.stop(t + 1.8);
        }, i * 640);
      });
    },

    death() {
      if (!ctx) return;
      const t = ctx.currentTime;
      this.moan("low");
      if (lp) lp.frequency.setTargetAtTime(260, t, 0.6);
    },

    restoreEars() {
      if (lp) lp.frequency.setTargetAtTime(19000, ctx.currentTime, 0.4);
    },

    setMusic(ch, intensity) {
      music.ch = ch;
      music.intensity = intensity;
      music.on = ch >= 0;
      if (ctx && music.next < ctx.currentTime) music.next = ctx.currentTime + 0.1;
    },

    tick() {
      if (!ctx || !music.on || muted) return;
      const ahead = ctx.currentTime + 0.2;
      const iv = music.ch === 4 ? 0.22 : 0.28;
      if (music.next < ctx.currentTime) music.next = ctx.currentTime + 0.05;
      while (music.next < ahead) {
        this.step(music.step, music.next);
        music.next += iv;
        music.step++;
      }
    },

    step(s, t) {
      const ch = music.ch;
      const roots = ch === 4 ? [0, 8, 5, 3] : [0, 8, 3, 10];
      const base = ch === 3 ? 82.41 : ch === 4 ? 87.31 : 110;
      if (s % 32 === 0) {
        const root = base * Math.pow(2, roots[(s / 32) % 4] / 12);
        [0, 7, 12, 15].forEach((iv, i) => {
          const f = root * Math.pow(2, iv / 12);
          const o = ctx.createOscillator();
          o.type = "triangle";
          o.frequency.value = f * (i % 2 ? 1.003 : 0.997);
          const g = ctx.createGain();
          g.gain.setValueAtTime(0.0001, t);
          g.gain.linearRampToValueAtTime(0.028, t + 2.5);
          g.gain.linearRampToValueAtTime(0.0001, t + 9);
          o.connect(g);
          out(g, 0.55);
          o.start(t);
          o.stop(t + 9.2);
        });
      }
      if (s % 16 === 0) {
        const root = base * Math.pow(2, roots[(Math.floor(s / 32) % 4)] / 12);
        tone("sine", root / 2, root / 2, t, 0.02, 0.9, 0.09, 0.2);
      }
      const pluckP = 0.35 + 0.4 * music.intensity;
      if (s % 4 === 0 && Math.random() < pluckP) {
        const f = freqOf(Math.floor(Math.random() * 7) + 3);
        const o = ctx.createOscillator();
        o.type = "sine";
        o.frequency.value = f;
        const g = env(t, 0.01, 0.05, 0.8);
        o.connect(g);
        out(g, 0.7);
        o.start(t);
        o.stop(t + 1);
      }
      if (ch === 4 && s % 2 === 0) {
        const seq = [0, 3, 7, 10, 12, 10, 7, 3];
        const f = base * 2 * Math.pow(2, seq[(s / 2) % 8] / 12);
        tone("triangle", f, f, t, 0.01, 0.16, 0.035, 0.3);
      }
      if (music.intensity > 0.4 && s % 8 === 0) {
        const f = base * Math.pow(2, roots[(Math.floor(s / 32) % 4)] / 12);
        const o = ctx.createOscillator();
        o.type = "sawtooth";
        o.frequency.value = f;
        const flt = ctx.createBiquadFilter();
        flt.type = "lowpass";
        flt.frequency.value = 600;
        const g = env(t, 0.4, 0.03 * music.intensity, 1.4);
        const trem = ctx.createOscillator();
        trem.frequency.value = 6.5;
        const tg = ctx.createGain();
        tg.gain.value = 0.015 * music.intensity;
        trem.connect(tg);
        tg.connect(g.gain);
        o.connect(flt);
        flt.connect(g);
        out(g, 0.4);
        o.start(t);
        trem.start(t);
        o.stop(t + 2);
        trem.stop(t + 2);
      }
    },
  };

  return api;
})();
