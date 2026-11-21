/* EMBERWAKE — procedural audio. No sample assets: everything is synthesised. */
(function (global) {
  'use strict';

  var ctx = null;
  var master = null, comp = null, verbSend = null, sfxBus = null, musicBus = null, ambBus = null;
  var noiseBuf = null;
  var ready = false;

  function makeNoise(c) {
    var len = c.sampleRate * 2;
    var b = c.createBuffer(1, len, c.sampleRate);
    var d = b.getChannelData(0);
    for (var i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    return b;
  }

  function makeIR(c, seconds, decay) {
    var rate = c.sampleRate, len = Math.floor(rate * seconds);
    var buf = c.createBuffer(2, len, rate);
    for (var ch = 0; ch < 2; ch++) {
      var d = buf.getChannelData(ch);
      for (var i = 0; i < len; i++) {
        var t = i / len;
        var env = Math.pow(1 - t, decay);
        d[i] = (Math.random() * 2 - 1) * env * (1 - t * 0.2);
      }
    }
    return buf;
  }

  function ensure() {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return ctx; }
    var AC = global.AudioContext || global.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();

    comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14; comp.knee.value = 22; comp.ratio.value = 3.2;
    comp.attack.value = 0.006; comp.release.value = 0.25;
    comp.connect(ctx.destination);

    master = ctx.createGain();
    master.gain.value = 0.85;
    master.connect(comp);

    var conv = ctx.createConvolver();
    conv.buffer = makeIR(ctx, 3.0, 2.4);
    var verbOut = ctx.createGain(); verbOut.gain.value = 0.9;
    conv.connect(verbOut); verbOut.connect(master);
    verbSend = ctx.createGain(); verbSend.gain.value = 0.34;
    verbSend.connect(conv);

    sfxBus = ctx.createGain(); sfxBus.gain.value = 0.95; sfxBus.connect(master); sfxBus.connect(verbSend);
    musicBus = ctx.createGain(); musicBus.gain.value = 0.42; musicBus.connect(master); musicBus.connect(verbSend);
    ambBus = ctx.createGain(); ambBus.gain.value = 0.0; ambBus.connect(master);

    noiseBuf = makeNoise(ctx);
    ready = true;
    return ctx;
  }

  function now() { return ctx.currentTime; }

  /* ---------------- primitives ---------------- */

  function env(gain, t, a, d, peak) {
    gain.gain.cancelScheduledValues(t);
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), t + a);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + a + d);
  }

  function tone(o) {
    if (!ready) return;
    o = o || {};
    var t = now() + (o.delay || 0);
    var osc = ctx.createOscillator();
    var g = ctx.createGain();
    osc.type = o.type || 'sine';
    osc.frequency.setValueAtTime(o.freq || 440, t);
    if (o.to) osc.frequency.exponentialRampToValueAtTime(Math.max(20, o.to), t + (o.glide || 0.2));
    var lp = null;
    if (o.cut) {
      lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.setValueAtTime(o.cut, t);
      if (o.cutTo) lp.frequency.exponentialRampToValueAtTime(o.cutTo, t + (o.dur || 0.4));
      osc.connect(lp); lp.connect(g);
    } else { osc.connect(g); }
    g.connect(o.bus || sfxBus);
    env(g, t, o.attack || 0.008, o.dur || 0.5, o.gain === undefined ? 0.2 : o.gain);
    osc.start(t); osc.stop(t + (o.attack || 0.008) + (o.dur || 0.5) + 0.05);
  }

  function noise(o) {
    if (!ready) return;
    o = o || {};
    var t = now() + (o.delay || 0);
    var src = ctx.createBufferSource();
    src.buffer = noiseBuf;
    src.loop = true;
    src.playbackRate.value = o.rate || 1;
    var f = ctx.createBiquadFilter();
    f.type = o.filter || 'bandpass';
    f.frequency.setValueAtTime(o.freq || 800, t);
    if (o.freqTo) f.frequency.exponentialRampToValueAtTime(Math.max(40, o.freqTo), t + (o.dur || 0.4));
    f.Q.value = o.q === undefined ? 1 : o.q;
    var g = ctx.createGain();
    src.connect(f); f.connect(g); g.connect(o.bus || sfxBus);
    env(g, t, o.attack || 0.01, o.dur || 0.4, o.gain === undefined ? 0.2 : o.gain);
    src.start(t); src.stop(t + (o.attack || 0.01) + (o.dur || 0.4) + 0.05);
  }

  /* ---------------- ambience ---------------- */

  var fire = { src: null, gain: null, filt: null, level: 0, target: 0 };
  var wind = { src: null, gain: null, filt: null, level: 0, target: 0 };
  var rain = { src: null, gain: null, level: 0, target: 0 };

  function startAmbience() {
    if (!ready) return;
    // fire
    var fs = ctx.createBufferSource(); fs.buffer = noiseBuf; fs.loop = true;
    var ff = ctx.createBiquadFilter(); ff.type = 'bandpass'; ff.frequency.value = 900; ff.Q.value = 0.7;
    var fg = ctx.createGain(); fg.gain.value = 0.0;
    fs.connect(ff); ff.connect(fg); fg.connect(ambBus);
    fs.start();
    fire.src = fs; fire.gain = fg; fire.filt = ff;

    // wind
    var ws = ctx.createBufferSource(); ws.buffer = noiseBuf; ws.loop = true; ws.playbackRate.value = 0.55;
    var wf = ctx.createBiquadFilter(); wf.type = 'bandpass'; wf.frequency.value = 420; wf.Q.value = 0.9;
    var wg = ctx.createGain(); wg.gain.value = 0.0;
    ws.connect(wf); wf.connect(wg); wg.connect(ambBus);
    ws.start();
    wind.src = ws; wind.gain = wg; wind.filt = wf;

    // rain
    var rs = ctx.createBufferSource(); rs.buffer = noiseBuf; rs.loop = true; rs.playbackRate.value = 1.6;
    var rf = ctx.createBiquadFilter(); rf.type = 'highpass'; rf.frequency.value = 2400;
    var rg = ctx.createGain(); rg.gain.value = 0.0;
    rs.connect(rf); rf.connect(rg); rg.connect(ambBus);
    rs.start();
    rain.src = rs; rain.gain = rg;

    ambBus.gain.setTargetAtTime(0.9, now(), 1.2);
    scheduleCrackle();
  }

  var crackleTimer = null;
  function scheduleCrackle() {
    if (crackleTimer) clearTimeout(crackleTimer);
    crackleTimer = setTimeout(function () {
      if (ready && fire.level > 0.02) {
        var n = 1 + Math.floor(Math.random() * 3);
        for (var i = 0; i < n; i++) {
          noise({
            delay: i * 0.035 + Math.random() * 0.05,
            freq: 1400 + Math.random() * 2600,
            q: 3 + Math.random() * 5,
            dur: 0.035 + Math.random() * 0.05,
            gain: (0.02 + Math.random() * 0.05) * fire.level,
            attack: 0.002
          });
        }
      }
      scheduleCrackle();
    }, 180 + Math.random() * 520);
  }

  function setFire(level) { fire.target = level; }
  function setWind(level) {
    wind.target = level;
    if (ready) wind.filt.frequency.setTargetAtTime(300 + level * 900, now(), 0.4);
  }
  function setRain(level) { rain.target = level; }

  /* ---------------- one-shot sfx ---------------- */

  var Sfx = {
    perfect: function () {
      var base = 880;
      tone({ freq: base, type: 'triangle', dur: 0.55, gain: 0.16, cut: 4000 });
      tone({ freq: base * 1.5, type: 'sine', dur: 0.4, gain: 0.09, delay: 0.012 });
      tone({ freq: base * 2, type: 'sine', dur: 0.7, gain: 0.05, delay: 0.02 });
    },
    good: function () {
      tone({ freq: 520, type: 'triangle', dur: 0.35, gain: 0.14, cut: 2600 });
      tone({ freq: 780, type: 'sine', dur: 0.25, gain: 0.05, delay: 0.01 });
    },
    miss: function () {
      noise({ freq: 260, freqTo: 90, q: 1.2, dur: 0.4, gain: 0.18 });
      tone({ freq: 110, to: 62, type: 'sine', dur: 0.5, gain: 0.12, glide: 0.4 });
    },
    knock: function (n) {
      n = n || 1;
      for (var i = 0; i < n; i++) {
        noise({ delay: i * 0.26, freq: 200 + Math.random() * 120, q: 2.4, dur: 0.14, gain: 0.2, attack: 0.002 });
        tone({ delay: i * 0.26, freq: 78, to: 52, type: 'sine', dur: 0.16, gain: 0.13 });
      }
    },
    doorOpen: function () {
      noise({ freq: 180, freqTo: 620, q: 0.8, dur: 0.7, gain: 0.12 });
      tone({ freq: 220, to: 330, type: 'sine', dur: 0.6, gain: 0.06 });
    },
    gust: function () {
      noise({ freq: 700, freqTo: 180, q: 0.9, dur: 0.85, gain: 0.16 });
    },
    brace: function () {
      noise({ freq: 2200, freqTo: 700, q: 1.6, dur: 0.22, gain: 0.13 });
      tone({ freq: 300, to: 150, type: 'square', dur: 0.14, gain: 0.05, cut: 900 });
    },
    thunder: function () {
      noise({ freq: 160, freqTo: 45, q: 0.6, dur: 2.4, gain: 0.24, attack: 0.06 });
      tone({ freq: 55, to: 28, type: 'sine', dur: 2.6, gain: 0.14, glide: 1.6 });
    },
    give: function () {
      // warm, generous chord
      var f = [523.25, 659.25, 783.99, 1046.5];
      for (var i = 0; i < f.length; i++) {
        tone({ freq: f[i], type: 'sine', dur: 1.6, gain: 0.085, delay: i * 0.06, attack: 0.05 });
      }
    },
    refuse: function () {
      var f = [392, 311.13, 261.63];
      for (var i = 0; i < f.length; i++) {
        tone({ freq: f[i], type: 'sine', dur: 1.3, gain: 0.075, delay: i * 0.12, attack: 0.04 });
      }
    },
    dawn: function () {
      var f = [261.63, 329.63, 392, 523.25, 659.25];
      for (var i = 0; i < f.length; i++) {
        tone({ freq: f[i], type: 'triangle', dur: 3.2, gain: 0.075, delay: i * 0.22, attack: 0.3, cut: 2400 });
      }
    },
    dark: function () {
      var f = [220, 174.61, 130.81];
      for (var i = 0; i < f.length; i++) {
        tone({ freq: f[i], type: 'sine', dur: 2.4, gain: 0.09, delay: i * 0.3, attack: 0.4 });
      }
    },
    ui: function () {
      tone({ freq: 1320, type: 'sine', dur: 0.09, gain: 0.05 });
    },
    tick: function () {
      tone({ freq: 1800, type: 'sine', dur: 0.05, gain: 0.035 });
    }
  };

  /* ---------------- generative score ---------------- */

  var MOODS = {
    title:   { root: 146.83, scale: [0, 3, 5, 7, 10], tempo: 2.6, dens: 0.5,  type: 'triangle', oct: 2, pad: [0, 7, 12, 15] },
    act1:    { root: 146.83, scale: [0, 3, 5, 7, 10], tempo: 1.9, dens: 0.62, type: 'triangle', oct: 2, pad: [0, 7, 12] },
    act2:    { root: 174.61, scale: [0, 2, 3, 7, 8],  tempo: 2.2, dens: 0.5,  type: 'sine',    oct: 2, pad: [0, 7, 12, 19] },
    act3:    { root: 130.81, scale: [0, 2, 3, 7, 8],  tempo: 1.25, dens: 0.72, type: 'triangle', oct: 1, pad: [0, 6, 12] },
    act4:    { root: 164.81, scale: [0, 2, 4, 7, 11], tempo: 2.4, dens: 0.46, type: 'triangle', oct: 2, pad: [0, 7, 12, 16, 19] },
    ending:  { root: 164.81, scale: [0, 2, 4, 7, 11], tempo: 3.0, dens: 0.4,  type: 'sine',    oct: 2, pad: [0, 7, 12, 16, 19, 24] }
  };

  var mood = 'title';
  var nextTime = 0, step = 0, timer = null, droneOn = false, droneGain = null, droneOsc = [];

  function freqOf(semi) { return 440 * Math.pow(2, (semi - 69) / 12); }

  function midi(root, semi, oct) {
    var base = 12 * (Math.floor(root / 10) - 2); // rough; we use root as hz -> use direct hz math
    return root * Math.pow(2, (semi + 12 * oct) / 12);
  }

  function schedule() {
    if (!ready) return;
    var m = MOODS[mood];
    var ahead = now() + 0.4;
    while (nextTime < ahead) {
      var t = Math.max(nextTime, now() + 0.05);
      var bar = Math.floor(step / 4);
      // bass drone pulse
      if (step % 4 === 0) {
        var bassSemi = m.scale[(bar * 3) % m.scale.length];
        tone({
          freq: m.root * Math.pow(2, bassSemi / 12) * 0.5, type: 'sine',
          dur: m.tempo * 2.2, gain: 0.1, delay: t - now(), attack: 0.4, bus: musicBus
        });
      }
      // pad chord
      if (step % 8 === 0) {
        for (var i = 0; i < m.pad.length; i++) {
          tone({
            freq: m.root * Math.pow(2, m.pad[i] / 12) * 0.5, type: 'sine',
            dur: m.tempo * 6, gain: 0.035, delay: t - now(), attack: 1.2, bus: musicBus
          });
        }
      }
      // melody
      if (Math.random() < m.dens) {
        var semi = m.scale[Math.floor(Math.random() * m.scale.length)];
        var oct = m.oct + (Math.random() < 0.25 ? 1 : 0);
        tone({
          freq: m.root * Math.pow(2, semi / 12) * Math.pow(2, oct),
          type: m.type, dur: m.tempo * 1.4, gain: 0.055,
          delay: t - now(), attack: 0.02, cut: 2600, bus: musicBus
        });
      }
      nextTime += m.tempo;
      step++;
    }
  }

  var Music = {
    set: function (m) {
      if (!MOODS[m]) return;
      mood = m; step = 0; nextTime = now() + 0.1;
    },
    start: function () {
      if (!ready || timer) return;
      nextTime = now() + 0.1;
      timer = setInterval(schedule, 60);
    },
    stop: function () { if (timer) { clearInterval(timer); timer = null; } }
  };

  /* ---------------- public API ---------------- */

  global.Snd = {
    ensure: ensure,
    get ctx() { return ctx; },
    get ready() { return ready; },
    resume: function () { if (ctx && ctx.state === 'suspended') ctx.resume(); },
    startAmbience: startAmbience,
    setFire: setFire, setWind: setWind, setRain: setRain,
    sfx: Sfx,
    music: Music,
    update: function (dt) {
      if (!ready) return;
      var k = 1 - Math.exp(-3.2 * dt);
      fire.level += (fire.target - fire.level) * k;
      wind.level += (wind.target - wind.level) * k;
      rain.level += (rain.target - rain.level) * k;
      fire.gain.gain.setTargetAtTime(0.055 * fire.level, now(), 0.08);
      wind.gain.gain.setTargetAtTime(0.11 * wind.level, now(), 0.2);
      rain.gain.gain.setTargetAtTime(0.05 * rain.level, now(), 0.2);
    },
    toggleMute: function () {
      if (!ready) return false;
      master.gain.value = master.gain.value > 0.05 ? 0 : 0.85;
      return master.gain.value > 0.05;
    }
  };
})(window);
