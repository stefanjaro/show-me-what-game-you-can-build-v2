/* EMBERWAKE — the game itself.
   Four acts, four different verbs, one flame. Your light is your life AND your
   only currency: everything you give to the town below visibly dims your room.  */
(function (global) {
  'use strict';

  var TAU = U.TAU;

  /* ------------------------------------------------------------------ state */
  var G = {
    t: 0, act: 0, state: 'title',
    light: 0.68, cityLit: 0, cityGoal: 0, started: false,
    lightVis: 0.6, pulse: 0, gutter: 0, tilt: 0, shake: 0,
    dawn: 0, storm: 0, rain: 0, wind: 0,
    ring: { alpha: 0, arcPos: 0, arcHalf: 1.1, marker: 0, showArc: false },
    braces: { alpha: 0, gusts: [] },
    door: { alpha: 0, pos: 0, zone: 0.5, zoneW: 0.2, active: false },
    visitors: [],
    embers: [], motes: [],
    tableau: 0, warmed: 0,
    combo: 0, bestCombo: 0, perfects: 0, good: 0, missed: 0, matched: 0, wrong: 0,
    score: 0, doorLock: 0, braceLock: 0
  };

  var activeSweep = null;
  var running = false;

  /* ------------------------------------------------------------------ intro */
  var VISITORS = [
    {
      kind: 'ferryman', name: 'THE FERRYMAN', knocks: 3, scaleK: 1.0,
      line: '“The river has gone dry under my boat. Let it fill again — one cup of your black water.”',
      sym: 'drop', showSym: true, faint: false,
      opts: [
        { icon: 'flame', label: 'A coal torn from your own lamp' },
        { icon: 'drop', label: 'A cupful of the black river' },
        { icon: 'bell', label: 'A knell for the drowned' }
      ],
      answer: 1,
      good: '“Water.” He fills his cup, and the river answers. Far below, a mill wheel remembers how to turn.',
      bad: 'He studies what you offer for a long moment, then sets it down. The river stays dry.',
      none: 'You do not answer. His footsteps go back down the stairs, unhurried, as if he had expected it.'
    },
    {
      kind: 'girl', name: 'THE GIRL WITH THE BIRD', knocks: 2, scaleK: 0.82,
      line: '“My bird has forgotten the sky. Give it back the road it flew.”',
      sym: 'bird', showSym: true, faint: false,
      opts: [
        { icon: 'key', label: 'A key to a door she will never open' },
        { icon: 'bird', label: 'The song of a bird that flew south' },
        { icon: 'coin', label: 'A coin to pay the wind' }
      ],
      answer: 1,
      good: 'She holds the song up to the cage. The bird turns its head — and the cage door opens a finger’s width.',
      bad: '“That is not a road,” she says, and takes it anyway, because she is polite. That is worse.',
      none: 'She does not knock twice. The bird sings once behind the door and then there is only the wind.'
    },
    {
      kind: 'sailor', name: 'THE OLD SAILOR', knocks: 4, scaleK: 0.92,
      line: '“Forty years I have not been warm. Give me the thing that remembers heat.”',
      sym: 'flame', showSym: true, faint: true,
      opts: [
        { icon: 'flame', label: 'A spark of the flame you keep' },
        { icon: 'drop', label: 'A drop of rain you remember' },
        { icon: 'wave', label: 'A wave that never reached shore' }
      ],
      answer: 0,
      good: 'He cups the spark in both hands like a coal he was told never to speak of. He does not cry. He is a sailor.',
      bad: 'He nods anyway. Sailors are polite about being disappointed. He takes the wave and the door shuts on him.',
      none: 'The knocking does not come again. Some things ask only once.'
    },
    {
      kind: 'child', name: 'THE CHILD AT THE TOP OF THE STAIRS', knocks: 1, scaleK: 0.62,
      line: '“I have nothing to trade. I only brought the cold, and I am carrying it down to her.”',
      sym: null, showSym: false, faint: false,
      opts: [
        { icon: 'flame', label: 'Warmth, borrowed from your own' },
        { icon: 'drop', label: 'A promise of rain' },
        { icon: 'coin', label: 'A coin for the ferryman' }
      ],
      answer: 0,
      good: 'She holds the warmth against her chest like a stone. By the time she reaches the bottom stair she is crying, and glowing.',
      bad: 'She looks at the coin in your palm and then at your hand, and something in her face closes like a door.',
      none: 'You listen to the small footsteps carry the cold back down the stairs. They get quieter and quieter.'
    }
  ];

  /* ------------------------------------------------------------------ utils */
  function addLight(d) {
    G.light = U.clamp(G.light + d, 0, 1);
  }
  function lightVis() {
    return U.clamp(0.10 + 0.90 * G.light + G.cityLit * 0.14, 0, 1.25);
  }
  function say(t, hold) { return UI.caption(t, { hold: hold === undefined ? 1300 : hold }); }
  function pushHUD() {
    UI.setLamp(G.light);
    UI.setCity(G.cityLit);
  }

  /* ------------------------------------------------------------------ sweep (the shared heartbeat) */
  var SWEEP_GAP = 1.9;

  function startSweep(period, arcHalf, arcPos) {
    var s = {
      elapsed: 0, period: period, arcHalf: arcHalf,
      arcPos: arcPos === undefined ? U.rand(0, TAU) : arcPos,
      resolved: false, result: null
    };
    s.promise = new Promise(function (res) { s.res = res; });
    activeSweep = s;
    G.ring.showArc = true;
    G.ring.arcPos = s.arcPos;
    G.ring.arcHalf = s.arcHalf;
    return s;
  }

  function sweepMarker() {
    if (!activeSweep) return G.ring.marker;
    var p = U.clamp(activeSweep.elapsed / activeSweep.period, 0, 1);
    var start = activeSweep.arcPos + SWEEP_GAP + activeSweep.arcHalf;
    return start - (SWEEP_GAP + activeSweep.arcHalf) * p;
  }

  function resolveSweep(result) {
    if (!activeSweep || activeSweep.resolved) return;
    activeSweep.resolved = true;
    activeSweep.result = result;
    var s = activeSweep;
    setTimeout(function () { if (activeSweep === s) activeSweep = null; }, 60);
    s.res(result);
  }

  function judgeSweep() {
    if (!activeSweep || activeSweep.resolved) return;
    var diff = Math.abs(U.angDiff(sweepMarker(), activeSweep.arcPos));
    if (diff <= activeSweep.arcHalf * 0.32) resolveSweep('perfect');
    else if (diff <= activeSweep.arcHalf) resolveSweep('good');
    else resolveSweep('early');
  }

  /* ------------------------------------------------------------------ act 1 */
  async function act1() {
    G.act = 1;
    await UI.actCard('ACT ONE', 'THE HEART', 'A flame is not a fire. It is a pulse. Learn the pulse before the dark learns it for you.');

    await say('Nine winters you have kept the lamp of Vell. Tonight the oil is low, the glass is cold, and the long dark has come.');
    await say('Everything below you is asleep, and all of it depends on one small flame.');

    G.ring.alpha = 1;
    UI.setPrompt('SPACE — strike when the bead meets the bright arc');
    UI.setReadout('');
    await say('Watch the flame. It swells just before each beat — strike with it, not before it.', 2100);

    var movements = [
      { beats: 8, period: 1.08, arc: 1.32, pair: 0 },
      { beats: 9, period: 0.95, arc: 1.14, pair: 0 },
      { beats: 9, period: 0.84, arc: 0.98, pair: 0.18 },
      { beats: 10, period: 0.76, arc: 0.86, pair: 0.38 }
    ];
    var lines = [
      null,
      'It keeps time. Something in this tower always has.',
      'Faster now. The dark is not waiting for you to be ready.',
      'Two beats in some. Give it what it asks, and it will carry you.'
    ];

    for (var m = 0; m < movements.length; m++) {
      var mv = movements[m];
      for (var b = 0; b < mv.beats; b++) {
        var r = await runBeat(mv);
        if (r === 'die') { await ending('dark'); return; }
      }
      if (lines[m]) await say(lines[m], 1500);
    }

    G.ring.alpha = 0;
    UI.setPrompt('');
    await say('The flame is steady. It would hold until morning, if morning were the problem.', 1500);
  }

  function runBeat(mv) {
    var s = startSweep(mv.period, mv.arc);
    return s.promise.then(function (res) {
      if (res === 'perfect') {
        G.perfects++; G.combo++;
        addLight(0.010); G.score += 120 * Math.min(G.combo, 8);
        Snd.sfx.perfect();
        G.pulse = 1;
        burstEmbers(10);
        UI.setCombo(G.combo > 2 ? 'HEART ×' + G.combo : '');
      } else if (res === 'good') {
        G.good++; G.combo++;
        addLight(0.0045); G.score += 45 * Math.min(G.combo, 8);
        Snd.sfx.good();
        G.pulse = 0.75;
        burstEmbers(4);
        UI.setCombo(G.combo > 4 ? 'HEART ×' + G.combo : '');
      } else if (res === 'early') {
        G.missed++; G.combo = 0;
        addLight(-0.008);
        Snd.sfx.miss();
        G.gutter = 0.5;
        UI.setCombo('');
      } else {
        G.missed++; G.combo = 0;
        addLight(-0.035);
        Snd.sfx.miss();
        G.gutter = 1;
        UI.setCombo('');
      }
      G.bestCombo = Math.max(G.bestCombo, G.combo);
      pushHUD();
      if (G.light <= 0.001) return 'die';
      return res;
    });
  }

  /* ------------------------------------------------------------------ act 2 */
  async function act2() {
    G.act = 2;
    await UI.actCard('ACT TWO', 'THE VISITORS', 'Something is climbing the stairs. Open the door at the right moment — but a door opened wrongly lets the cold in too.');

    await say('A knock climbs the tower from below. You have heard it a hundred times. It has never been this late.');
    await say('Whatever they need, you can give it. That is the whole of the job. The rest is what it costs.');

    for (var i = 0; i < VISITORS.length; i++) {
      var v = VISITORS[i];
      UI.setReadout(v.name + ' — ' + v.knocks + ' KNOCKS');
      Snd.sfx.knock(v.knocks);
      await U.wait(320);

      var opened = await doorPhase(i);
      if (!opened) {
        await say('The knocking stops. ' + v.name + ' goes back down into the dark, taking their cold with them.', 1500);
        addLight(-0.07);
        G.gutter = 0.8;
        pushHUD();
        if (G.light <= 0.001) { await ending('dark'); return; }
        continue;
      }

      Snd.sfx.doorOpen();
      await spawnVisitor(v, i);
      await U.wait(500);
      await say(v.line, 2200);

      var choice = await UI.buildChoice({
        title: 'WHAT WILL YOU GIVE?   ·   ' + v.name,
        options: v.opts,
        time: [13, 12, 11, 10][i]
      });

      if (choice === -1) {
        await say(v.none, 1800);
        addLight(-0.06);
        Snd.sfx.refuse();
      } else if (choice === v.answer) {
        G.matched++;
        G.warmed = G.matched;
        addLight(-0.045);
        G.cityGoal = U.clamp(G.cityGoal + 0.26, 0, 1);
        Snd.sfx.give();
        UI.flash(0.22, 1.1);
        await say(v.good, 2100);
        await say('You gave away a piece of your own light to do it. Look down — the town has taken it, and is a little warmer for it.', 2400);
      } else {
        G.wrong++;
        addLight(-0.090);
        Snd.sfx.refuse();
        G.gutter = 0.7;
        await say(v.bad, 2100);
      }
      despawnVisitor();
      pushHUD();
      if (G.light <= 0.001) { await ending('dark'); return; }
      await U.wait(300);
    }

    G.door.alpha = 0;
    UI.setReadout('');
    await say('The stairs are quiet again. You are lighter than you were, and the town below is not.', 1900);
  }

  function doorPhase(i) {
    var speed = 0.40 + i * 0.085;
    var zoneW = 0.21 - i * 0.018;
    G.door.alpha = 1; G.door.active = true;
    G.door.pos = 0; G.door.zone = U.rand(0.18, 0.82); G.door.zoneW = zoneW;
    UI.setPrompt('SPACE — open the door when the bead is on the bright mark');

    return new Promise(function (resolve) {
      var done = false;
      var step = function () {
        if (done) return;
        G.door.pos += speed * G.dt;
        if (G.door.pos > 1) {
          done = true; G.door.active = false; G.door.alpha = 0;
          UI.setPrompt('');
          Snd.sfx.miss();
          resolve(false);
          return;
        }
        requestAnimationFrame(step);
      };
      G.doorPress = function () {
        if (done) return;
        var d = Math.abs(G.door.pos - G.door.zone);
        if (d <= G.door.zoneW / 2) {
          done = true; G.door.active = false; G.door.alpha = 0;
          UI.setPrompt('');
          resolve(true);
        } else {
          addLight(-0.012);
          Snd.sfx.tick();
          G.doorLock = 0.25;
        }
      };
      requestAnimationFrame(step);
    });
  }

  function spawnVisitor(v, i) {
    var sides = [0.185, 0.815, 0.215, 0.785];
    var vv = {
      kind: v.kind,
      x: W * sides[i % sides.length],
      y: H * 0.985,
      scale: H * 0.335 * v.scaleK / 240,
      alpha: 0,
      rim: 0,
      sym: v.showSym ? v.sym : null,
      symAlpha: v.faint ? 0.34 : 1
    };
    G.visitors.push(vv);
    return new Promise(function (res) {
      var t0 = performance.now();
      var step = function () {
        var p = U.clamp((performance.now() - t0) / 700, 0, 1);
        vv.alpha = p;
        vv.rim = p;
        if (p < 1) requestAnimationFrame(step); else res();
      };
      requestAnimationFrame(step);
    });
  }
  function despawnVisitor() {
    var v = G.visitors[G.visitors.length - 1];
    if (!v) return;
    var t0 = performance.now();
    var step = function () {
      var p = U.clamp((performance.now() - t0) / 600, 0, 1);
      v.alpha = 1 - p;
      v.rim = 1 - p;
      if (p < 1) requestAnimationFrame(step);
      else { G.visitors.pop(); }
    };
    requestAnimationFrame(step);
  }

  /* ------------------------------------------------------------------ act 3 */
  async function act3() {
    G.act = 3;
    await UI.actCard('ACT THREE', 'THE STORM', 'It is not coming up the stairs. It is coming up the outside of the tower, and it wants your light.');

    await say('The glass begins to sing. Somewhere below the town, every door is shut against this.');
    await say('Keep the flame. Brace the lantern. Let nothing through.');

    G.braces.alpha = 1;
    G.storm = 0; G.rain = 0;
    UI.setPrompt('SPACE feeds the flame   ·   W A S D brace against the wind');

    var t0 = G.t;
    var dur = 104;
    var nextGust = 0.7, nextFeed = 1.4;
    var lightning = 3.5;

    while (G.t - t0 < dur) {
      var el = G.t - t0;
      var prog = el / dur;

      if (el > nextGust) {
        var dir = U.randi(0, 3);
        var travel = U.lerp(1.70, 1.05, prog);
        G.braces.gusts.push({ dir: dir, p: 0, travel: travel, braced: false, hit: false });
        Snd.sfx.gust();
        nextGust += U.lerp(3.00, 1.75, prog) * U.rand(0.85, 1.18);
      }

      if (el > nextFeed && !activeSweep) {
        var fs = startSweep(1.15, 0.62);
        fs.promise.then(function (res) {
          if (res === 'perfect') { addLight(0.012); G.score += 60; Snd.sfx.perfect(); G.pulse = 0.9; burstEmbers(6); }
          else if (res === 'good') { addLight(0.005); G.score += 25; Snd.sfx.good(); G.pulse = 0.6; }
          else { addLight(-0.030); G.score -= 20; Snd.sfx.miss(); G.gutter = 1; }
          pushHUD();
        });
        nextFeed += U.lerp(3.60, 2.55, prog);
      }

      lightning -= G.dt;
      if (lightning <= 0) {
        lightning = U.rand(3.5, 8.5);
        UI.flash(0.42, 0.85);
        Snd.sfx.thunder();
        G.shake = 0.5;
      }
      await U.wait(28);
      if (G.light <= 0.001) break;
    }

    G.braces.alpha = 0;
    G.braces.gusts.length = 0;
    G.ring.showArc = false;
    UI.setPrompt('');
    if (G.light <= 0.001) { await ending('dark'); return; }
    await say('The storm walks away the way it came, taking the sea with it. The flame is still here.', 1900);
  }

  /* ------------------------------------------------------------------ act 4 */
  async function act4() {
    G.act = 4;
    G.warmed = G.matched;
    await UI.actCard('ACT FOUR', 'DAWN', 'Grey behind the glass. Then, slowly, the colour comes back.');

    await say('Out on the water there is one small light that is not yours. A boat, still a long way from the harbour.');
    await say('You have kept the lamp for nine winters. You are allowed, tonight, to stop.');

    // the dawn rises behind the glass, on its own clock
    (function dawnRise() {
      var t0 = performance.now();
      var step = function () {
        var p = U.clamp((performance.now() - t0) / 11000, 0, 1);
        G.dawn = U.easeInOutSine(p);
        G.tableau = U.clamp(p * 1.8, 0, 1);
        if (p < 1) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    })();

    await U.wait(3200);

    var choice = await UI.buildChoice({
      title: 'THE LAST DECISION',
      options: [
        { icon: 'flame', label: 'Hold the flame until the little boat is home.' },
        { icon: 'star', label: 'Close the shutters. Let the dawn do the rest.' }
      ],
      time: 18
    });

    if (choice === 0) {
      G.heldTheFlame = true;
      G.cityGoal = 1;
      addLight(-(G.light - 0.06));
      UI.flash(0.3, 1.4);
      await say('You turn the lamp toward the water and you give it everything you have left. The little light comes in.', 2800);
      await say('When it touches the harbour wall you are already gone.', 2400);
    } else {
      G.heldTheFlame = false;
      await say('You close the shutters. The dawn does what dawns do, and does not need you for it.', 2400);
      await say('The little boat finds the harbour on its own. Boats mostly do.', 2200);
    }
    // let the sun finish coming up before the last words
    await new Promise(function (res) {
      var t0 = performance.now();
      var step = function () {
        var p = U.clamp((performance.now() - t0) / 4200, 0, 1);
        G.dawn = U.easeInOutSine(p);
        G.tableau = 1;
        if (p < 1) requestAnimationFrame(step); else res();
      };
      requestAnimationFrame(step);
    });
    await ending(G.heldTheFlame ? 'held' : 'slept');
  }

  /* ------------------------------------------------------------------ ending */
  async function ending(kind) {
    G.state = 'end';
    UI.setPrompt('');
    UI.setReadout('');
    UI.setCombo('');
    G.ring.alpha = 0; G.braces.alpha = 0; G.door.alpha = 0;
    Snd.music.set('ending');

    var warm = G.cityLit;
    var title, kicker, body;

    if (kind === 'dark') {
      title = 'THE DARK';
      kicker = 'THE LONG DARK';
      body = 'The flame goes out the way a held breath goes out — without any argument at all.<br><br>' +
        'Below you, the town of Vell wakes to a morning it did not choose, and goes about its business in the dark, ' +
        'not knowing that anything was ever on fire for them.<br><br>' +
        'You kept the lamp for nine winters. Tonight it was simply more than you had.';
      UI.fade(true, 2.2);
      Snd.sfx.dark();
      await U.wait(2600);
    } else if (kind === 'held') {
      if (warm >= 0.68) {
        title = 'THE LAST WATCH';
        kicker = 'DAWN, AND A BOAT IN THE HARBOUR';
        body = 'The little boat comes in on the last of your light, and the harbour is bright enough to see it by.<br><br>' +
          'They find you in the lamp room with your hands still on the brass, and the whole town below is warm ' +
          'because of what you carried up those stairs tonight.<br><br>' +
          'Somebody will have to take the lamp. Somebody always does. But not before the sun is properly up.';
      } else {
        title = 'THE LAST WATCH';
        kicker = 'DAWN, AND AN EMPTY STREET';
        body = 'The little boat comes in on the last of your light. The harbour is quiet; the streets below are dark, ' +
          'because you kept almost all of it in the room with you.<br><br>' +
          'You will be warm. That is not nothing. Nine winters of being warm is a great deal of being warm.';
      }
      UI.flash(0.5, 2.4);
      Snd.sfx.dawn();
    } else {
      if (warm >= 0.68) {
        title = 'THE CITY REMEMBERS';
        kicker = 'DAWN OVER VELL';
        body = 'You close the shutters and, for the first time in nine winters, you sleep.<br><br>' +
          'Below, the town of Vell comes up into the morning one window at a time — every one of them a thing you ' +
          'gave away and could not get back. They say there is a lampkeeper who gives his light away, and that the ' +
          'lamps of Vell burn brighter than they should.<br><br>' +
          'You will not be there to correct them.';
      } else {
        title = 'A WELL-FED FLAME';
        kicker = 'DAWN OVER VELL';
        body = 'You close the shutters. The dawn arrives and finds the lamp room exactly as tidy as you left it, ' +
          'and the streets below exactly as dark.<br><br>' +
          'The flame is fat and bright and there is nothing wrong with it. You will be here tonight, and the night ' +
          'after, and every night you can stand.';
      }
      UI.flash(0.42, 2.4);
      Snd.sfx.dawn();
    }

    await U.wait(900);
    UI.showEnd({
      kicker: kicker,
      title: title,
      body: body,
      stats: [
        { k: 'WINDOWS LIT IN VELL', v: Math.round(warm * 100) + '%' },
        { k: 'LIGHT LEFT IN THE LAMP', v: Math.round(G.light * 100) + '%' },
        { k: 'PEOPLE WARMED', v: G.matched + '/' + VISITORS.length },
        { k: 'PERFECT BEATS', v: String(G.perfects) }
      ]
    });
    G.state = 'ended';
  }

  /* ------------------------------------------------------------------ particles */
  function burstEmbers(n) {
    for (var i = 0; i < n; i++) {
      G.embers.push({
        x: Scene.layout().cx + U.rand(-14, 14),
        y: Scene.layout().baseY - Scene.layout().flameH * U.rand(0.45, 0.95),
        vy: -U.rand(26, 70),
        vx: U.rand(-14, 14),
        r: U.rand(0.5, 1.3),
        life: 1,
        dec: U.rand(0.30, 0.65),
        ph: U.rand(0, 6.28),
        cool: U.chance(0.12)
      });
    }
  }

  function updateParticles(dt) {
    var L = Scene.layout();
    var rate = (4 + G.light * 26) * dt;
    while (rate > 0) {
      if (rate < 1 && !U.chance(rate)) break;
      rate -= 1;
      G.embers.push({
        x: L.cx + U.rand(-11, 11),
        y: L.baseY - L.flameH * U.rand(0.42, 0.98),
        vy: -U.rand(22, 64),
        vx: U.rand(-12, 12),
        r: U.rand(0.45, 1.15),
        life: 1, dec: U.rand(0.26, 0.58), ph: U.rand(0, 6.28), cool: U.chance(0.10)
      });
    }
    for (var i = G.embers.length - 1; i >= 0; i--) {
      var e = G.embers[i];
      e.x += e.vx * dt + Math.sin(G.t * 2 + e.ph) * 12 * dt;
      e.y += e.vy * dt;
      e.vy += 14 * dt;
      e.life -= e.dec * dt;
      if (e.life <= 0) G.embers.splice(i, 1);
    }
    if (G.motes.length < 70) {
      G.motes.push({
        x: U.rand(0, L.W), y: U.rand(L.floorY * 0.55, L.H),
        vx: U.rand(-6, 6), vy: U.rand(-7, -2),
        r: U.rand(0.5, 1.5), life: 1, dec: U.rand(0.03, 0.09), ph: U.rand(0, 6.28)
      });
    }
    for (var m = G.motes.length - 1; m >= 0; m--) {
      var mo = G.motes[m];
      mo.x += (mo.vx + Math.sin(G.t * 0.7 + mo.ph) * 5) * dt;
      mo.y += mo.vy * dt;
      mo.life -= mo.dec * dt;
      if (mo.life <= 0) G.motes.splice(m, 1);
    }
  }

  /* ------------------------------------------------------------------ gust handling */
  function brace(dir) {
    if (G.braces.alpha < 0.2) return;
    if (G.braceLock > 0) return;
    var target = null;
    for (var i = 0; i < G.braces.gusts.length; i++) {
      var g = G.braces.gusts[i];
      if (g.dir === dir && !g.braced && g.p >= 0.66) { target = g; break; }
    }
    if (target) {
      target.braced = true;
      addLight(0.008);
      G.score += 80;
      Snd.sfx.brace();
      G.pulse = 0.8;
      UI.setReadout('BRACED');
      setTimeout(function () { if (G.state !== 'end') UI.setReadout(''); }, 450);
      burstEmbers(5);
    } else {
      G.braceLock = 0.22;
      addLight(-0.008);
      Snd.sfx.tick();
    }
    pushHUD();
  }

  /* ------------------------------------------------------------------ input */
  function onSpace() {
    if (G.state === 'title' || G.state === 'ended') return;
    if (G.door.active) {
      if (G.doorLock > 0) return;
      G.doorLock = 0.2;
      if (G.doorPress) G.doorPress();
      return;
    }
    if (activeSweep && !activeSweep.resolved) {
      if (G.doorLock > 0) return;
      G.doorLock = 0.22;
      judgeSweep();
      return;
    }
    if (G.act === 3) {
      // mashing during the storm costs you
      addLight(-0.006);
      Snd.sfx.tick();
      pushHUD();
    } else if (G.act === 2) {
      Snd.sfx.tick();
    }
  }

  var KEYDIR = {
    'w': 0, 'arrowup': 0, 's': 2, 'arrowdown': 2,
    'a': 1, 'arrowleft': 1, 'd': 3, 'arrowright': 3
  };

  function onKey(e) {
    var k = e.key;
    var low = (k || '').toLowerCase();

    if (low === 'm') { Snd.toggleMute(); return; }

    if (k === 'Enter' || k === 'Return') {
      if (G.state === 'title') { startGame(); }
      else if (G.state === 'ended') { restart(); }
      return;
    }

    if (UI.hasChoice && UI.hasChoice()) {
      if (k >= '1' && k <= '9') {
        var idx = parseInt(k, 10) - 1;
        UI.resolveChoice(idx);
        e.preventDefault();
      }
      return;
    }

    if (k === ' ' || k === 'Spacebar' || k === 'Space') {
      e.preventDefault();
      onSpace();
      return;
    }
    if (KEYDIR[low] !== undefined) {
      e.preventDefault();
      brace(KEYDIR[low]);
    }
  }

  /* ------------------------------------------------------------------ loop */
  var last = 0, W = 0, H = 0;

  function update(dt) {
    G.dt = dt;
    if (G.doorLock > 0) G.doorLock -= dt;
    if (G.braceLock > 0) G.braceLock -= dt;

    // sweep
    if (activeSweep && !activeSweep.resolved) {
      activeSweep.elapsed += dt;
      if (activeSweep.elapsed > activeSweep.period) {
        resolveSweep('miss');
      }
    }
    G.ring.marker = sweepMarker();

    // the flame itself swells as the moment approaches
    if (activeSweep && !activeSweep.resolved) {
      var dd = Math.abs(U.angDiff(sweepMarker(), activeSweep.arcPos));
      var near = U.clamp(1 - dd / (activeSweep.arcHalf * 1.45), 0, 1);
      if (near > G.pulse) G.pulse = near * 0.9;
    }

    // gusts
    var gs = G.braces.gusts;
    for (var i = gs.length - 1; i >= 0; i--) {
      var g = gs[i];
      if (g.braced) { g.p = Math.min(1.2, g.p + dt / g.travel); if (g.p >= 1.2) gs.splice(i, 1); continue; }
      g.p += dt / g.travel;
      if (g.p >= 1) {
        gs.splice(i, 1);
        addLight(-0.020);
        G.gutter = 1;
        G.tilt = U.rand(-0.55, 0.55);
        G.shake = 0.45;
        Snd.sfx.miss();
        pushHUD();
      }
    }

    // visual damping
    G.pulse = U.damp(G.pulse, 0, 5.5, dt);
    G.gutter = U.damp(G.gutter, 0, 2.6, dt);
    G.tilt = U.damp(G.tilt, 0, 1.6, dt);
    G.shake = U.damp(G.shake, 0, 3.4, dt);
    G.lightVis = U.damp(G.lightVis, lightVis(), 3.0, dt);
    G.cityLit = U.damp(G.cityLit, G.cityGoal, 1.2, dt);
    G.storm = U.damp(G.storm, G.act === 3 ? 1 : 0, 0.5, dt);
    G.rain = U.damp(G.rain, G.act === 3 ? 0.95 : 0, 0.5, dt);

    updateParticles(dt);

    // sound beds
    Snd.setFire(U.clamp(G.light, 0, 1));
    var windLevel = G.act === 3 ? 0.55 + gs.length * 0.12 : 0;
    Snd.setWind(U.clamp(windLevel, 0, 1));
    Snd.setRain(G.rain * 0.8);
    Snd.update(dt);
  }

  function frame(now) {
    requestAnimationFrame(frame);
    if (!last) last = now;
    var dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    dt *= (Game._dbg.timeScale || 1);
    G.t += dt;

    update(dt);

    if (Game._dbg.noRender) return;

    Scene.drawBack(G, G.t);
    var L = Scene.layout();
    if (Flame.ok) {
      Flame.render(G.t, {
        cx: L.cx, baseY: L.baseY, scale: L.flameH,
        cssW: L.W, cssH: L.H,
        light: U.clamp(G.lightVis, 0, 1.2),
        pulse: G.pulse,
        gutter: G.gutter,
        tilt: G.tilt,
        dawn: G.dawn,
        shake: G.shake
      });
    }
    Scene.drawFront(G, G.t);
  }

  /* ------------------------------------------------------------------ flow */
  async function runGame() {
    G.state = 'act';
    UI.showHUD(true);
    Snd.music.set('act1');
    Snd.music.start();
    await act1();
    if (G.state === 'end') return;
    Snd.music.set('act2');
    await act2();
    if (G.state === 'end') return;
    Snd.music.set('act3');
    await act3();
    if (G.state === 'end') return;
    Snd.music.set('act4');
    G.dawn = 0;
    await act4();
  }

  function startGame() {
    if (G.state !== 'title' || G.started) return;
    G.started = true;
    Snd.ensure();
    Snd.resume();
    Snd.startAmbience();
    Snd.music.set('title');
    Snd.music.start();
    UI.showTitle(false);
    UI.fade(false, 1.4);
    UI.showHUD(true);
    setTimeout(function () { runGame(); }, 700);
  }

  function restart() {
    UI.hideEnd();
    UI.fade(true, 0.7);
    Object.assign(G, {
      light: 0.68, cityLit: 0, cityGoal: 0, dawn: 0, storm: 0, rain: 0,
      combo: 0, bestCombo: 0, perfects: 0, good: 0, missed: 0, matched: 0, wrong: 0,
      score: 0, tableau: 0, warmed: 0, heldTheFlame: false, state: 'act', started: true
    });
    G.embers.length = 0; G.motes.length = 0; G.visitors.length = 0;
    G.braces.gusts.length = 0;
    G.ring.alpha = 0; G.braces.alpha = 0; G.door.alpha = 0;
    activeSweep = null;
    pushHUD();
    setTimeout(function () {
      UI.fade(false, 1.2);
      UI.showHUD(true);
      runGame();
    }, 800);
  }

  /* ------------------------------------------------------------------ boot */
  function boot() {
    UI.init();
    var bgC = document.getElementById('bg');
    var fgC = document.getElementById('fg');
    Scene.init(bgC, fgC);
    Flame.init(document.getElementById('fx'));
    W = Scene.layout().W; H = Scene.layout().H;

    window.addEventListener('resize', function () {
      Scene.resize();
      W = Scene.layout().W; H = Scene.layout().H;
    });

    window.addEventListener('keydown', onKey);
    window.addEventListener('mousedown', function () { Snd.ensure(); Snd.resume(); });

    UI.showHUD(false);
    pushHUD();
    G.lightVis = 0.88;
    requestAnimationFrame(frame);
  }

  global.Game = {
    boot: boot,
    state: G,
    _dbg: {
      noRender: false,
      timeScale: 1,
      get sweep() { return activeSweep; },
      get door() { return G.door; },
      get gusts() { return G.braces.gusts; },
      answers: VISITORS.map(function (v) { return v.answer; }),
      markerAngle: sweepMarker
    }
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})(window);
