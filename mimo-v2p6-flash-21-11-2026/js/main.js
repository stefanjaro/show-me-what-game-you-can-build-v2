/* VIGIL — boot, flow, input, loop. */
(function (V) {
  'use strict';

  var canvas, renderer, sim, ctx;
  var sound = V.sound;

  var state = 'boot';      /* boot | title | story | play | fail | end */
  var paused = false;
  var audioReady = false;
  var last = 0;
  var hitstop = 0;
  var runStart = 0;
  var story = null;
  var totals = { home: 0, lost: 0, banished: 0 };

  var input = {
    left: false, right: false, flare: false,
    mouseActive: false, mx: 640, my: 300
  };

  var el = {};

  /* ---------- story data ---------- */
  var INTRO = [
    { h: "THE KEEPER'S LOG", lines: ['For forty years I have kept the light at Cape Mourn.'] },
    { h: '', lines: ["Ships know my beam the way children know a mother's voice."] },
    { h: '', lines: ["Tonight, my daughter's ship comes home with the tide."] },
    { h: '', lines: ['And the sea has forgotten how to be water.'] },
    { h: 'HOW TO KEEP THE LIGHT', lines: [
      'Swing the light with \u2190 \u2192 (or your mouse).',
      'Ships follow it home \u2014 but a RED road means stone.',
      'Sweep PAST a ship to nudge it clear.'
    ] }
  ];

  var INTERLUDES = {
    1: [
      { h: 'A LETTER, THREE DAYS OLD', lines: ['\u201CWe sight land at dawn.', 'Leave the lamp burning for me.\u201D', { t: '\u2014 Marta', c: 'sig' }] },
      { h: 'THE SECOND NIGHT', lines: [
        'Tomorrow the dark things climb up from the deep.',
        'HOLD [SPACE] TO FLARE \u2014 they burn in it,',
        'but the road narrows to a thread.'
      ] }
    ],
    2: [
      { h: 'THE SECOND WATCH', lines: ['Something touched the hull tonight.', 'The men say it had hands.', 'I say: keep the light burning.'] },
      { h: 'A GALE IS COMING', lines: [
        'It will shove them off the road.',
        'THE LIGHT HOLDS THEM \u2014 hold it.'
      ] }
    ],
    3: [
      { h: 'MENDED WITH MY COAT', lines: ['The gale tore the roof from the lantern room.', 'I mended it with my own coat.', 'The lamp holds. I hold.'] },
      { h: 'THEN, AT MOONRISE', lines: [
        'The horizon STANDS UP.',
        'SEAR ITS EYES WITH THE FLARE.',
        'And bring her home.'
      ] }
    ]
  };

  var EPILOGUE = [
    { h: 'DAWN', lines: ['Dawn comes up gold on the water,', 'and the sea is only sea again.'] },
    { h: '', lines: ['Marta steps ashore before I can set down the lantern.', 'She takes my hands \u2014 they smell of lamp-oil and old rope.'] },
    { h: '', lines: ['\u201CPapa,\u201D she says. \u201CYou never let it go out.\u201D', { t: '\u201CSomeone had to keep it, girl.\u201D', c: 'em' }] },
    { h: '', lines: ['The lamp is cold now.', 'That is all right.', { t: 'The sun is up.', c: 'em' }] }
  ];

  var MOOD_BY_CH = ['', 'calm', 'deep', 'storm', 'boss'];

  var TOTAL_SHIPS = (function () {
    var n = 0;
    for (var i = 1; i < V.CHAPTERS.length; i++) n += V.CHAPTERS[i].ships.length;
    return n;
  })();

  /* ================= boot ================= */
  function init() {
    el.stage = document.getElementById('stage');
    el.canvas = document.getElementById('game');
    el.screens = {
      title: document.getElementById('title'),
      story: document.getElementById('story'),
      fail: document.getElementById('fail'),
      end: document.getElementById('end'),
      pause: document.getElementById('pause')
    };
    el.storyHeading = document.querySelector('#story .story-heading');
    el.storyLines = document.querySelector('#story .story-lines');
    el.failTitle = document.getElementById('fail-title');
    el.failBody = document.getElementById('fail-body');
    el.failPrompt = document.getElementById('fail-prompt');
    el.endStats = document.getElementById('end-stats');

    canvas = el.canvas;
    resize();
    renderer = new V.Renderer(canvas);
    sim = new V.Sim();
    sim.startTitle();

    window.addEventListener('resize', resize);
    bindInput();

    V._debug = {
      get sim() { return sim; },
      get state() { return state; },
      get paused() { return paused; },
      get renderer() { return renderer; },
      startChapter: function (n) { runStart = performance.now(); startChapter(n); },
      showEnd: showEnd,
      input: input
    };

    showScreen('title');
    state = 'title';
    last = performance.now();
    requestAnimationFrame(frame);
  }

  function resize() {
    var scale = Math.min(window.innerWidth / V.W, window.innerHeight / V.H);
    var w = Math.round(V.W * scale), h = Math.round(V.H * scale);
    el.stage.style.width = w + 'px';
    el.stage.style.height = h + 'px';
    canvas.style.width = w + 'px';
    canvas.style.height = h + 'px';
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(V.W * dpr);
    canvas.height = Math.round(V.H * dpr);
    ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function showScreen(name) {
    for (var k in el.screens) {
      if (!el.screens.hasOwnProperty(k)) continue;
      el.screens[k].classList.toggle('hidden', k !== name);
    }
    if (!name) {
      for (k in el.screens) {
        if (el.screens.hasOwnProperty(k)) el.screens[k].classList.add('hidden');
      }
    }
  }

  /* ================= story engine ================= */
  function showStory(cards, onDone) {
    story = { cards: cards, ci: 0, li: 0, chi: 0, acc: 0, onDone: onDone };
    state = 'story';
    showScreen('story');
    renderStory(true);
    sound.sfx('card');
  }

  function renderStory(force) {
    if (!story) return;
    var card = story.cards[story.ci];
    el.storyHeading.textContent = card.h || '';
    el.storyHeading.style.opacity = card.h ? '1' : '0';
    var html = '';
    for (var i = 0; i < card.lines.length; i++) {
      var line = card.lines[i];
      var text = typeof line === 'string' ? line : line.t;
      var cls = (typeof line === 'string' ? '' : line.c) || '';
      var shown;
      if (i < story.li) shown = text;
      else if (i === story.li) shown = text.substring(0, story.chi);
      else shown = '';
      if (cls) html += '<div class="' + cls + '">' + esc(shown) + '</div>';
      else html += '<div>' + esc(shown) + '</div>';
      if (i === story.li && story.chi < text.length && !force) {
        /* still typing this line */
      }
    }
    el.storyLines.innerHTML = html;
  }

  function esc(s) {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function storyTick(dt) {
    if (!story) return;
    var card = story.cards[story.ci];
    if (story.li >= card.lines.length) return; /* waiting for advance */
    var line = card.lines[story.li];
    var text = typeof line === 'string' ? line : line.t;
    story.acc += dt;
    var perChar = 0.030;
    var guard = 0;
    while (story.acc >= perChar && guard < 40) {
      story.acc -= perChar;
      guard++;
      if (story.chi < text.length) {
        story.chi++;
        if (story.chi % 3 === 0) sound.sfx('type');
      } else {
        story.li++;
        story.chi = 0;
        break;
      }
    }
    renderStory(false);
  }

  function storyAdvance() {
    if (!story) return;
    var card = story.cards[story.ci];
    /* finish typing current card */
    if (story.li < card.lines.length) {
      story.li = card.lines.length;
      story.chi = 0;
      renderStory(false);
      sound.sfx('click');
      return;
    }
    story.ci++;
    if (story.ci >= story.cards.length) {
      var done = story.onDone;
      story = null;
      showScreen(null);
      sound.sfx('click');
      if (done) done();
      return;
    }
    story.li = 0;
    story.chi = 0;
    story.acc = 0;
    renderStory(true);
    sound.sfx('click');
  }

  /* ================= flow ================= */
  function startIntro() {
    if (state !== 'title') return;
    ensureAudio();
    showStory(INTRO, function () {
      runStart = performance.now();
      startChapter(1);
    });
  }

  function startChapter(n) {
    showScreen(null);
    state = 'play';
    paused = false;
    input.flare = false;
    input.left = false;
    input.right = false;
    sim.startChapter(n);
    sound.setMood(MOOD_BY_CH[n] || 'calm');
  }

  function retryChapter() {
    var n = sim.chapter;
    showScreen(null);
    state = 'play';
    input.flare = false;
    input.left = false;
    input.right = false;
    sim.startChapter(n);
    sound.setMood(MOOD_BY_CH[n] || 'calm');
  }

  function onFail(reason) {
    state = 'fail';
    input.flare = false;
    input.left = false;
    input.right = false;
    if (reason === 'daughter') {
      el.failTitle.textContent = 'YOU LET HER GO DOWN';
      el.failBody.textContent = 'The pennant went under with the tide. Night again \u2014 bring her home.';
      el.failPrompt.textContent = 'PRESS SPACE TO TRY AGAIN';
    } else {
      el.failTitle.textContent = 'THE LIGHT WENT OUT';
      el.failBody.textContent = 'The sea closes over the harbour. But a keeper does not sleep \u2014 yet.';
      el.failPrompt.textContent = 'PRESS SPACE TO RELIGHT';
    }
    showScreen('fail');
    sound.setMood('fail');
  }

  function onChapterComplete() {
    var n = sim.chapter;
    if (n >= 4) {
      sim.mode = 'ending';
      showStory(EPILOGUE, showEnd);
      return;
    }
    showStory(INTERLUDES[n] || [{ h: '', lines: ['The night relents.'] }], function () {
      startChapter(n + 1);
    });
  }

  function showEnd() {
    state = 'end';
    var secs = Math.max(1, Math.round((performance.now() - runStart) / 1000));
    var mm = Math.floor(secs / 60), ss = secs % 60;
    var timeStr = mm + ':' + (ss < 10 ? '0' : '') + ss;
    el.endStats.innerHTML =
      'SHIPS HOME &nbsp;<b>' + totals.home + ' / ' + TOTAL_SHIPS + '</b><br/>' +
      'LOST TO THE SEA &nbsp;<b>' + totals.lost + '</b><br/>' +
      'DARK THINGS BANISHED &nbsp;<b>' + totals.banished + '</b><br/>' +
      'NIGHT KEPT &nbsp;<b>' + timeStr + '</b>';
    showScreen('end');
    sound.setMood('end');
    sound.sfx('bell', 523.25);
  }

  function restartAll() {
    totals = { home: 0, lost: 0, banished: 0 };
    runStart = 0;
    story = null;
    sim.startTitle();
    showScreen('title');
    state = 'title';
    sound.setMood('title');
  }

  /* ================= events ================= */
  function drainEvents() {
    var e;
    while ((e = sim.events.shift())) {
      var snd = (state === 'play' || state === 'story');
      switch (e.type) {
        case 'save':
          totals.home++;
          if (snd) sound.sfx('save');
          break;
        case 'wreck':
          totals.lost++;
          hitstop = Math.max(hitstop, 0.14);
          if (snd) sound.sfx('wreck');
          break;
        case 'breach':
          hitstop = Math.max(hitstop, 0.16);
          if (snd) sound.sfx('breach');
          break;
        case 'monsterDie':
          totals.banished++;
          if (snd) sound.sfx('burn');
          break;
        case 'flareOn':
          if (snd) sound.sfx('flareOn');
          break;
        case 'overheat':
          if (snd) sound.sfx('overheat');
          break;
        case 'monsterNear':
          if (snd) sound.blip({ freq: 74, to: 52, type: 'sine', dur: 0.9, gain: 0.3, verb: 1 });
          break;
        case 'gust':
          if (snd) sound.sfx('windGust');
          break;
        case 'bolt':
          (function (delay) {
            setTimeout(function () { sound.sfx('thunder', 0.45); }, delay * 1000);
          })(e.delay);
          break;
        case 'roar':
          if (snd) sound.sfx('roar');
          break;
        case 'slam':
          if (snd) sound.sfx('slam');
          break;
        case 'eyeDead':
          if (snd) sound.sfx('eye');
          break;
        case 'bossRise':
          if (snd) sound.sfx('rise');
          break;
        case 'bossDie':
          if (snd) sound.sfx('bossDie');
          break;
        case 'dawn':
          sound.setMood('dawn');
          if (snd) sound.sfx('dawn');
          break;
        case 'shipSpawn':
          if (snd && e.kind === 'daughter') sound.sfx('horn', 0.3);
          else if (snd && Math.random() < 0.3) sound.sfx('horn', 0.8);
          break;
        case 'fail':
          onFail(e.reason);
          break;
        case 'complete':
          if (state === 'play') onChapterComplete();
          break;
      }
    }
  }

  function updateAudio() {
    if (!sound.ok || paused) {
      if (sound.ok) { sound.setSweep(0); sound.setFlare(0); }
      return;
    }
    sound.setSweep(V.clamp(sim.beamSweepSpeed / 5, 0, 1));
    sound.setFlare(sim.focus ? 1 : 0);
    sound.setWind(sim.wind ? V.clamp(sim.wind.mag / 40, 0, 1) : 0);
    sound.setRain(V.clamp((sim.rainAmt || 0) * (1 - (sim.dawnT || 0)), 0, 1));
  }

  /* ================= input ================= */
  function ensureAudio() {
    if (audioReady) { sound.resume(); return; }
    sound.init();
    audioReady = true;
    sound.setMood(state === 'title' ? 'title' : (MOOD_BY_CH[sim.chapter] || 'title'));
  }

  function togglePause() {
    if (state !== 'play') return;
    paused = !paused;
    if (paused) {
      showScreen('pause');
      sound.suspend();
    } else {
      showScreen(null);
      sound.resume();
      last = performance.now();
    }
  }

  function bindInput() {
    window.addEventListener('keydown', function (e) {
      var code = e.code;
      if (code === 'Space' || code === 'ArrowLeft' || code === 'ArrowRight' ||
          code === 'ArrowUp' || code === 'ArrowDown') {
        e.preventDefault();
      }
      ensureAudio();

      if (code === 'KeyM') { sound.setMute(!sound.muted); return; }
      if (code === 'KeyP' || code === 'Escape') { togglePause(); return; }
      if (paused) return;

      if (state === 'title') { startIntro(); return; }
      if (state === 'story') {
        if (code === 'Space' || code === 'Enter' || code === 'ArrowRight' || code === 'KeyE') storyAdvance();
        return;
      }
      if (state === 'fail') {
        if (code === 'Space' || code === 'Enter') retryChapter();
        return;
      }
      if (state === 'end') {
        if (code === 'KeyR' || code === 'Enter' || code === 'Space') restartAll();
        return;
      }
      if (state === 'play') {
        if (code === 'ArrowLeft' || code === 'KeyA') { input.left = true; input.mouseActive = false; }
        if (code === 'ArrowRight' || code === 'KeyD') { input.right = true; input.mouseActive = false; }
        if (code === 'Space') input.flare = true;
      }
    });

    window.addEventListener('keyup', function (e) {
      var code = e.code;
      if (code === 'ArrowLeft' || code === 'KeyA') input.left = false;
      if (code === 'ArrowRight' || code === 'KeyD') input.right = false;
      if (code === 'Space') input.flare = false;
    });

    canvas.addEventListener('mousemove', function (e) {
      var r = canvas.getBoundingClientRect();
      input.mx = (e.clientX - r.left) / r.width * V.W;
      input.my = (e.clientY - r.top) / r.height * V.H;
      input.mouseActive = true;
    });

    window.addEventListener('mousedown', function () {
      ensureAudio();
      if (paused) return;
      if (state === 'title') startIntro();
      else if (state === 'story') storyAdvance();
      else if (state === 'fail') retryChapter();
      else if (state === 'end') restartAll();
    });

    canvas.addEventListener('contextmenu', function (e) { e.preventDefault(); });

    document.addEventListener('visibilitychange', function () {
      if (document.hidden) {
        if (state === 'play' && !paused) togglePause();
        sound.suspend();
      }
    });
  }

  /* ================= loop ================= */
  function frame(now) {
    requestAnimationFrame(frame);
    var realDt = Math.min((now - last) / 1000, 0.05);
    if (realDt < 0) realDt = 0;
    last = now;

    if (paused) return;

    if (state === 'story') storyTick(realDt);

    var dt = realDt;
    if (hitstop > 0) {
      hitstop -= realDt;
      dt = realDt * 0.08;
      if (hitstop < 0) hitstop = 0;
    }

    var playInput;
    if (state === 'play') {
      playInput = input;
    } else {
      playInput = {
        left: false, right: false, flare: false,
        mouseActive: input.mouseActive, mx: input.mx, my: input.my
      };
    }

    sim.update(dt, playInput);
    drainEvents();
    updateAudio();
    renderer.draw(sim, dt);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})(window.Vigil);
