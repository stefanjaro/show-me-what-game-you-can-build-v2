/* VIGIL — world simulation. Pure logic; no canvas/DOM access. */
window.Vigil = window.Vigil || {};
(function (V) {
  'use strict';

  var LAMP = { x: 640, y: 668 };
  var HORIZON = 132;
  var SAFE_Y = 610;
  var SAFE_HW = 56;
  var HEMI = 1.75;             /* beam sweep limit from straight up (rad) */
  var UP = -Math.PI / 2;
  var BEAM_RANGE = 1150;
  var BEAM_RANGE_FOCUS = 1220;
  var HALF_WIDE = 15 * V.DEG;
  var HALF_FOCUS = 6.5 * V.DEG;

  var ROCKS = [
    { x: 455, y: 648, r: 110, big: true, name: 'west' },
    { x: 825, y: 648, r: 110, big: true, name: 'east' },
    { x: 452, y: 478, r: 56, name: 'reefW' },
    { x: 828, y: 470, r: 56, name: 'reefE' },
    { x: 648, y: 330, r: 40, name: 'sentinel' }
  ];
  var BUOYS = [
    { x: 566, y: 626 }, { x: 714, y: 626 }
  ];

  V.LAMP = LAMP;
  V.ROCKS = ROCKS;
  V.BUOYS = BUOYS;
  V.HORIZON = HORIZON;
  V.SAFE = { y: SAFE_Y, hw: SAFE_HW };

  function shipScale(y) {
    return 0.5 + 0.55 * V.clamp((y - 140) / 470, 0, 1);
  }

  /* ---------- chapter scripts ---------- */
  function S(t, x, y, rock, j, kind) {
    return { t: t, x: x, y: y, rock: rock, j: j === undefined ? 0.05 : j, kind: kind || 'normal' };
  }
  function M(t, edge, a, b) { return { t: t, edge: edge, a: a, b: b }; }

  var CHAPTERS = [
    null,
    {
      roman: 'I', name: 'THE CHANNEL', hope: 3,
      hint: 'SWING THE LIGHT — SHIPS FOLLOW IT HOME. KEEP THEM OFF THE STONE.',
      ships: [
        S(2.5, 300, 190, 0, 0.06),
        S(10, 980, 175, 1, 0.06),
        S(17.5, 470, 210, 2, 0.05),
        S(25, 845, 185, 3, 0.05),
        S(33, 235, 172, 0, 0.05),
        S(41, 1055, 205, 1, 0.05)
      ],
      monsters: [],
      weather: { rain: 0, fog: 0, wind: 0, bolt: false }
    },
    {
      roman: 'II', name: 'THE DEEP', hope: 3,
      hint: 'HOLD [SPACE] TO FLARE — THE DARK THINGS BURN, BUT THE ROAD NARROWS.',
      ships: [
        S(2.5, 900, 180, 1, 0.05),
        S(11, 345, 196, 0, 0.05),
        S(19.5, 645, 168, 4, 0.04),
        S(28.5, 1120, 205, 3, 0.05),
        S(37.5, 185, 182, 0, 0.05),
        S(46, 760, 212, 2, 0.05)
      ],
      monsters: [
        M(14, 'W', 330, 560), M(23, 'E', 380, 600), M(32, 'N', 260, 980),
        M(41, 'W', 420, 620), M(50, 'E', 300, 520), M(59, 'N', 420, 860)
      ],
      weather: { rain: 0, fog: 0, wind: 0, bolt: false }
    },
    {
      roman: 'III', name: 'THE STORM', hope: 3,
      hint: 'THE GALE SHOVES THEM OFF THE ROAD. THE LIGHT HOLDS THEM — HOLD IT.',
      ships: [
        S(2.5, 400, 175, 0, 0.05),
        S(10, 880, 190, 1, 0.05),
        S(17, 215, 215, 0, 0.05),
        S(24.5, 1065, 178, 3, 0.05),
        S(32, 610, 165, 4, 0.04),
        S(39.5, 320, 205, 2, 0.05),
        S(47, 940, 210, 3, 0.05)
      ],
      monsters: [
        M(15, 'W', 360, 600), M(27, 'E', 400, 640), M(38, 'N', 300, 940), M(50, 'W', 440, 640)
      ],
      weather: { rain: 1, fog: 0.5, wind: 1, bolt: true }
    },
    {
      roman: 'IV', name: 'THE GREAT DARK', hope: 3,
      hint: 'SEAR ITS EYES. BRING HER HOME.',
      ships: [
        S(3, 250, 195, 0, 0.05),
        S(15, 1015, 185, 1, 0.05),
        S(27, 475, 205, 2, 0.05),
        S(42, 640, 172, 4, 0.04, 'daughter')
      ],
      monsters: [
        M(20, 'W', 340, 580), M(33, 'E', 400, 620), M(47, 'N', 320, 920), M(60, 'W', 430, 640)
      ],
      weather: { rain: 0.55, fog: 0.25, wind: 0.5, bolt: true },
      boss: { t: 4 }
    }
  ];

  /* ---------- Sim ---------- */
  function Sim() {
    this.particles = new V.ParticleSet(1200);
    this.mode = 'title';
    this.events = [];
    this.t = 0;
    this.totalTime = 0;
    this.beamAngle = UP;
    this.beamVel = 0;
    this.half = HALF_WIDE;
    this.focus = false;
    this.heat = 0;
    this.overheated = false;
    this.lampDark = 0;
    this.lampPower = 1;
    this.flashPulse = 0;
    this.shake = 0;
    this.beamSweepSpeed = 0;
    this.dawnT = 0;
    this.phase = 'main';
    this.autopilot = true;
    this._init(true);
  }

  Sim.prototype._init = function (titleMode) {
    this.t = 0;
    this.ships = [];
    this.monsters = [];
    this.wrecks = [];
    this.ghosts = [];
    this.boss = null;
    this.hope = 3;
    this.saved = 0;
    this.lost = 0;
    this.banished = 0;
    this.shipTotal = 0;
    this.spawnQueue = [];
    this.monsterQueue = [];
    this.chapter = 0;
    this.chapterData = null;
    this.phase = 'main';
    this.dawnT = 0;
    this.daughterSaved = false;
    this.daughterLost = false;
    this.beamAngle = UP + (titleMode ? -0.5 : 0);
    this.beamVel = 0;
    this.heat = 0;
    this.overheated = false;
    this.lampDark = 0;
    this.lampPower = 1;
    this.flashPulse = 0;
    this.rainAmt = 0;
    this.fogAmt = 0;
    this.wind = { ang: 0, mag: 0, base: 0 };
    this.windTimer = 6;
    this.gustT = -1;
    this.gustDur = 0;
    this.nextBolt = 7;
    this.flash = 0;
    this.hintT = 0;
    this.autopilot = titleMode;
    this.failed = false;
    this.particles.clear();
    this.rainInit = false;
    if (titleMode) {
      this.rainAmt = 0;
      this.spawnGhostShip(3);
      this.spawnShip({ t: 0, x: 880, y: 195, rock: 1, j: 0.05 });
    }
  };

  Sim.prototype.startTitle = function () {
    this.mode = 'title';
    this._init(true);
  };

  Sim.prototype.startChapter = function (n) {
    var data = CHAPTERS[n];
    if (!data) return;
    this.mode = 'play';
    this._init(false);
    this.chapter = n;
    this.chapterData = data;
    this.hope = data.hope;
    this.spawnQueue = data.ships.slice();
    this.monsterQueue = (data.monsters || []).slice();
    this.shipTotal = data.ships.length;
    this.rainAmt = data.weather.rain;
    this.fogAmt = data.weather.fog;
    this.wind.base = data.weather.wind ? 9 : 0;
    this.wind.mag = this.wind.base;
    this.wind.ang = -0.4;
    this.hintT = 7.5;
    this.hint = data.hint;
    if (data.weather.rain > 0) this.initRain();
    if (data.boss) {
      this.boss = {
        x: 640, y: 148, ty: 200, scale: 0.4, state: 'rising', t: 0,
        eyes: [{ hp: 100, dead: false }, { hp: 100, dead: false }],
        roam: 0, roamDir: 1, roarT: 9, slamFlash: 0, sink: 0, alpha: 1,
        riseSnd: false
      };
      this.bossSpawnT = data.boss.t;
      this.bossActive = false;
    } else {
      this.boss = null;
      this.bossActive = false;
    }
    this.events.push({ type: 'chapterStart', n: n });
  };

  Sim.prototype.initRain = function () {
    var i;
    for (i = 0; i < 150; i++) {
      this.particles.spawn({
        type: 'rain', x: V.rand(0, V.W), y: V.rand(-40, V.H),
        vx: -140, vy: 940, life: V.rand(1, 2), size: 1, drag: 1
      });
    }
    this.rainInit = true;
  };

  Sim.prototype.spawnGhostShip = function (delay) {
    this.ghosts.push({
      x: V.rand(80, 1200), y: HORIZON + V.rand(16, 40),
      vx: (Math.random() < 0.5 ? -1 : 1) * V.rand(9, 16),
      life: delay || 0, maxLife: 26, seed: V.rand(0, 100)
    });
  };

  /* ---------- spawns ---------- */
  Sim.prototype.spawnShip = function (def) {
    var rock = ROCKS[def.rock];
    var doom = V.angOf(def.x, def.y, rock.x, rock.y) + V.rand(-def.j, def.j);
    var sh = {
      x: def.x, y: def.y,
      heading: doom,
      doom: doom,
      kind: def.kind,
      seed: V.rand(0, 100),
      lit: false,
      proj: null,
      age: 0,
      scale: shipScale(def.y),
      saved: false,
      lost: false,
      bob: V.rand(0, V.TAU),
      wake: []
    };
    this.ships.push(sh);
    if (this.mode === 'play') {
      this.events.push({ type: 'shipSpawn', kind: def.kind });
    }
    return sh;
  };

  Sim.prototype.spawnMonster = function (def) {
    var x, y;
    if (def.edge === 'W') { x = -30; y = V.rand(def.a, def.b); }
    else if (def.edge === 'E') { x = V.W + 30; y = V.rand(def.a, def.b); }
    else { x = V.rand(def.a, def.b); y = HORIZON - 26; }
    var m = {
      x: x, y: y, hp: 100, seed: V.rand(0, 100),
      speed: V.rand(19, 25), heading: V.angOf(x, y, LAMP.x, LAMP.y),
      dead: false, burn: 0, warned: false, spawnT: 0, scale: V.rand(0.85, 1.2)
    };
    this.monsters.push(m);
    this.events.push({ type: 'monsterSpawn' });
    for (var i = 0; i < 8; i++) {
      this.particles.spawn({
        type: 'spray', x: x, y: y, vx: V.rand(-40, 40), vy: V.rand(-50, -10),
        life: V.rand(0.4, 0.9), size: V.rand(1.5, 3.5), hue: 200, sat: 40, lum: 70, drag: 0.94
      });
    }
    return m;
  };

  /* ---------- helpers ---------- */
  Sim.prototype.beamDir = function () {
    return { ux: Math.cos(this.beamAngle), uy: Math.sin(this.beamAngle) };
  };

  Sim.prototype.coneContains = function (px, py) {
    var d = this.beamDir();
    var pr = V.projectOnRay(LAMP.x, LAMP.y, d.ux, d.uy, px, py);
    var range = this.focus ? BEAM_RANGE_FOCUS : BEAM_RANGE;
    if (pr.t < 45 || pr.t > range) return false;
    var minW = 26;
    var w = Math.max(minW, pr.t * Math.tan(this.half));
    return pr.err <= w;
  };

  /* ray from lamp through current beam: does segment to point hit a rock? */
  Sim.prototype.rayHitsRock = function (px, py) {
    var d = this.beamDir();
    var pr = V.projectOnRay(LAMP.x, LAMP.y, d.ux, d.uy, px, py);
    var t0 = Math.min(pr.t, 1150);
    for (var i = 0; i < ROCKS.length; i++) {
      var r = ROCKS[i];
      var t = V.rayCircle(LAMP.x, LAMP.y, d.ux, d.uy, r.x, r.y, r.r + 12);
      if (t >= 0 && t <= t0) return true;
    }
    return false;
  };

  Sim.prototype.addShake = function (a) { this.shake = Math.min(24, this.shake + a); };

  /* ---------- main update ---------- */
  Sim.prototype.update = function (dt, input) {
    if (dt <= 0) dt = 0;
    var prevT = this.t;
    this.t += dt;
    this.totalTime += dt;
    var i, s, m;

    this.flash = Math.max(0, this.flash - dt * 3.2);
    this.flashPulse = Math.max(0, this.flashPulse - dt * 2.2);
    this.shake = Math.max(0, this.shake - dt * 34);
    if (this.hintT > 0) this.hintT -= dt;

    if (this.lampDark > 0) this.lampDark = Math.max(0, this.lampDark - dt);

    this.updateWeather(dt);
    this.updateInput(dt, input);
    this.advanceDawn(dt);
    this.updateSpawns();
    this.updateShips(dt);
    this.updateMonsters(dt);
    this.updateBoss(dt);
    this.updateGhosts(dt);

    /* lamp power (ending dims it) */
    this.lampPower = V.lerp(this.lampPower, this.mode === 'ending' ? 0.06 : 1, 1 - Math.exp(-0.7 * dt));

    this.particles.update(dt, this.wind ? Math.cos(this.wind.ang) * this.wind.mag * 0.4 : 0, 0);

    if (this.mode === 'play') {
      this.checkChapterState();
    }
  };

  Sim.prototype.updateInput = function (dt, input) {
    if (!input) input = { left: false, right: false, flare: false };
    var prevAngle = this.beamAngle;

    if (this.autopilot) {
      /* title attract: escort the nearest ship */
      var target = null, best = -1;
      for (var i = 0; i < this.ships.length; i++) {
        var sh = this.ships[i];
        if (sh.y > best) { best = sh.y; target = sh; }
      }
      if (target) {
        var want = V.angOf(LAMP.x, LAMP.y, target.x, target.y);
        this.beamAngle = this.beamAngle + V.angleDiff(this.beamAngle, want) * (1 - Math.exp(-3.2 * dt));
      } else {
        this.beamAngle = UP + Math.sin(this.t * 0.33) * 0.85;
      }
      this.beamAngle = V.clamp(this.beamAngle, UP - HEMI, UP + HEMI);
      this.focus = false;
    } else if (input.mouseActive && input.mx !== undefined) {
      var want2 = Math.atan2(input.my - LAMP.y, input.mx - LAMP.x);
      var rel = V.clamp(V.angleDiff(UP, want2), -HEMI, HEMI);
      var tgt = UP + rel;
      this.beamAngle = this.beamAngle + V.angleDiff(this.beamAngle, tgt) * (1 - Math.exp(-11 * dt));
    } else {
      var dir = (input.right ? 1 : 0) - (input.left ? 1 : 0);
      var targetVel = dir * 4.4;
      this.beamVel = V.lerp(this.beamVel, targetVel, 1 - Math.exp(-9 * dt));
      if (dir === 0) this.beamVel *= Math.exp(-7 * dt);
      this.beamAngle += this.beamVel * dt;
      this.beamAngle = V.clamp(this.beamAngle, UP - HEMI, UP + HEMI);
      if ((this.beamAngle <= UP - HEMI && this.beamVel < 0) ||
          (this.beamAngle >= UP + HEMI && this.beamVel > 0)) this.beamVel = 0;
    }

    this.beamSweepSpeed = Math.abs(V.angleDiff(prevAngle, this.beamAngle)) / Math.max(dt, 0.0001);

    /* focus / heat */
    var wantFocus = !!input.flare && !this.overheated && this.lampDark <= 0 && !this.autopilot;
    if (wantFocus !== this.focus && wantFocus && this.lampDark <= 0) {
      this.events.push({ type: 'flareOn' });
    }
    this.focus = wantFocus && this.lampDark <= 0;

    if (this.focus) {
      this.heat = Math.min(100, this.heat + 30 * dt);
      if (this.heat >= 100) {
        this.overheated = true;
        this.focus = false;
        this.events.push({ type: 'overheat' });
      }
    } else {
      this.heat = Math.max(0, this.heat - 22 * dt);
      if (this.overheated && this.heat <= 34) this.overheated = false;
    }

    var targetHalf = this.focus ? HALF_FOCUS : HALF_WIDE;
    if (this.chapterData && this.chapterData.weather.wind) targetHalf *= 0.86;
    this.half = V.lerp(this.half, targetHalf, 1 - Math.exp(-12 * dt));
  };

  Sim.prototype.updateWeather = function (dt) {
    var w = this.chapterData ? this.chapterData.weather : null;
    var stormy = w && w.wind;
    if (this.mode === 'title') { this.wind.mag = V.lerp(this.wind.mag, 0, dt); return; }

    if (stormy && this.phase !== 'dawn') {
      this.windTimer -= dt;
      if (this.windTimer <= 0) {
        this.windTimer = V.rand(7, 12);
        this.gustT = 0;
        this.gustDur = V.rand(2.8, 4);
        this.events.push({ type: 'gust' });
      }
      var g = 0;
      if (this.gustT >= 0) {
        this.gustT += dt;
        var p = this.gustT / this.gustDur;
        if (p >= 1) this.gustT = -1;
        else g = Math.sin(p * Math.PI) * 26;
      }
      this.wind.ang = -0.5 + Math.sin(this.t * 0.14) * 0.85;
      this.wind.mag = this.wind.base + g;
      /* lightning */
      if (w.bolt) {
        this.nextBolt -= dt;
        if (this.nextBolt <= 0) {
          this.nextBolt = V.rand(6.5, 12);
          this.flash = 1;
          this.events.push({ type: 'bolt', delay: V.rand(0.35, 1.3) });
        }
      }
    } else {
      this.wind.mag = V.lerp(this.wind.mag, this.phase === 'dawn' ? 0 : this.wind.base, 1 - Math.exp(-0.8 * dt));
      if (this.phase === 'dawn') this.gustT = -1;
    }

    /* keep rain particles topped up while raining */
    if (this.rainAmt > 0 && this.phase !== 'dawn') {
      if (!this.rainInit) this.initRain();
      var need = Math.floor(150 * this.rainAmt) - this.countRain();
      for (var i = 0; i < need && i < 8; i++) {
        this.particles.spawn({
          type: 'rain', x: V.rand(-40, V.W + 40), y: V.rand(-60, -4),
          vx: -140 - this.wind.mag * 3, vy: 940, life: V.rand(0.7, 1.1), size: 1, drag: 1
        });
      }
    }
  };

  Sim.prototype.countRain = function () {
    var n = 0, l = this.particles.list;
    for (var i = 0; i < l.length; i++) if (l[i].type === 'rain') n++;
    return n;
  };

  Sim.prototype.updateSpawns = function () {
    if (this.mode !== 'play') return;
    while (this.spawnQueue.length && this.spawnQueue[0].t <= this.t) {
      this.spawnShip(this.spawnQueue.shift());
    }
    while (this.monsterQueue.length && this.monsterQueue[0].t <= this.t) {
      var mdef = this.monsterQueue.shift();
      if (this.phase !== 'dawn') this.spawnMonster(mdef);
    }
    if (this.chapterData && this.chapterData.boss && !this.bossActive && this.t >= this.bossSpawnT) {
      this.bossActive = true;
      this.events.push({ type: 'bossRise' });
      this.addShake(14);
    }
  };

  Sim.prototype.updateGhosts = function (dt) {
    for (var i = this.ghosts.length - 1; i >= 0; i--) {
      var g = this.ghosts[i];
      if (g.life > 0) { g.life -= dt; continue; }
      g.x += g.vx * dt;
      g.age = (g.age || 0) + dt;
      if (g.x < -80 || g.x > V.W + 80 || g.age > g.maxLife) {
        this.ghosts.splice(i, 1);
        this.spawnGhostShip(V.rand(4, 9));
      }
    }
  };

  Sim.prototype.updateShips = function (dt) {
    var i, j;
    var wx = Math.cos(this.wind.ang) * this.wind.mag;
    var wy = Math.sin(this.wind.ang) * this.wind.mag * 0.35;
    var driftX = Math.sin(this.t * 0.23) * 3.2;
    var driftY = 1.6;

    for (i = this.ships.length - 1; i >= 0; i--) {
      var s = this.ships[i];
      s.age += dt;
      s.scale = shipScale(s.y);
      s.bob += dt * 2.1;

      /* lighting */
      s.lit = false;
      s.proj = null;
      var d = this.beamDir();
      if (this.lampDark <= 0 && this.lampPower > 0.25) {
        var pr = V.projectOnRay(LAMP.x, LAMP.y, d.ux, d.uy, s.x, s.y);
        var range = this.focus ? BEAM_RANGE_FOCUS : BEAM_RANGE;
        if (pr.t > 45 && pr.t < range) {
          var w = Math.max(26, pr.t * Math.tan(this.half));
          if (pr.err <= w) {
            s.lit = true;
            s.proj = pr;
          }
        }
      }

      /* steering */
      if (s.lit && s.proj) {
        var tBack = Math.max(s.proj.t - 66, 8);
        var Tx = LAMP.x + d.ux * tBack;
        var Ty = LAMP.y + d.uy * tBack;
        var want = Math.atan2(Ty - s.y, Tx - s.x);
        s.heading = V.turnToward(s.heading, want, 1.55 * dt);
      }

      var speed = (20 + 26 * s.scale) * (s.lit ? 1.15 : 1);
      var wob = Math.sin(this.t * 1.35 + s.seed) * 0.055;
      var shelter = s.lit ? 0.45 : 1;
      var vx = Math.cos(s.heading + wob) * speed + wx * shelter + driftX;
      var vy = Math.sin(s.heading + wob) * speed + wy * shelter + driftY;
      s.x += vx * dt;
      s.y += vy * dt;

      /* wake */
      if (s.age > 0.2) {
        s.wake.push({ x: s.x, y: s.y, a: 1 });
        if (s.wake.length > 34) s.wake.shift();
      }
      for (j = 0; j < s.wake.length; j++) s.wake[j].a -= dt * 0.75;
      while (s.wake.length && s.wake[0].a <= 0) s.wake.shift();

      /* safety first */
      if (s.y > SAFE_Y && Math.abs(s.x - LAMP.x) < SAFE_HW) {
        this.saveShip(s, i);
        continue;
      }
      /* rocks */
      var hit = false;
      for (j = 0; j < ROCKS.length; j++) {
        var r = ROCKS[j];
        if (V.dist2(s.x, s.y, r.x, r.y) < (r.r + 13 * s.scale) * (r.r + 13 * s.scale)) {
          hit = true; break;
        }
      }
      if (hit) { this.wreckShip(s, i, 'rock'); continue; }
      /* out of bounds */
      if (s.y > 688 || s.x < -55 || s.x > V.W + 55 || s.y < HORIZON - 42) {
        this.wreckShip(s, i, 'sea');
        continue;
      }
    }
  };

  Sim.prototype.fail = function (reason) {
    if (this.failed || this.mode !== 'play') return;
    this.failed = true;
    this.mode = 'failed';
    this.events.push({ type: 'fail', reason: reason || 'hope' });
  };

  Sim.prototype.dismissMonsters = function () {
    for (var i = this.monsters.length - 1; i >= 0; i--) {
      var m = this.monsters[i];
      for (var k = 0; k < 8; k++) {
        this.particles.spawn({
          type: 'ash', x: m.x + V.rand(-16, 16), y: m.y + V.rand(-14, 14),
          vx: V.rand(-30, 30), vy: V.rand(-50, -6), life: V.rand(0.4, 1),
          size: V.rand(1.5, 3), hue: 20, sat: 30, lum: 30, drag: 0.95
        });
      }
    }
    this.monsters.length = 0;
  };

  Sim.prototype.saveShip = function (s, idx) {
    this.ships.splice(idx, 1);
    if (this.mode === 'title') {
      /* attract mode: quietly respawn */
      this.spawnShip({ t: 0, x: V.rand(140, 1140), y: V.rand(150, 215), rock: V.randInt(0, 4), j: 0.05 });
      return;
    }
    s.saved = true;
    this.saved++;
    this.flashPulse = 1;
    this.events.push({ type: 'save', kind: s.kind });
    var n = s.kind === 'daughter' ? 26 : 16;
    for (var i = 0; i < n; i++) {
      this.particles.spawn({
        type: 'sparkle', x: s.x + V.rand(-14, 14), y: s.y + V.rand(-10, 10),
        vx: V.rand(-46, 46), vy: V.rand(-70, -8), life: V.rand(0.5, 1.3),
        size: V.rand(1.5, 3.6), hue: V.rand(38, 52), sat: 95, lum: 70, grav: 60, drag: 0.95
      });
    }
    for (i = 0; i < 8; i++) {
      this.particles.spawn({
        type: 'spray', x: s.x, y: s.y + 8, vx: V.rand(-60, 60), vy: V.rand(-30, 20),
        life: V.rand(0.4, 0.8), size: V.rand(2, 4), hue: 205, sat: 45, lum: 78, drag: 0.93
      });
    }
    this.particles.spawn({
      type: 'text', x: s.x, y: s.y - 22, vx: 0, vy: -26, life: 1.6,
      text: s.kind === 'daughter' ? 'SHE IS HOME' : 'HOME', size: s.kind === 'daughter' ? 22 : 17
    });
    if (s.kind === 'daughter') { this.daughterSaved = true; }
  };

  Sim.prototype.wreckShip = function (s, idx, cause) {
    this.ships.splice(idx, 1);
    if (this.mode === 'title') {
      this.spawnShip({ t: 0, x: V.rand(140, 1140), y: V.rand(150, 215), rock: V.randInt(0, 4), j: 0.05 });
      return;
    }
    s.lost = true;
    this.lost++;
    if (s.kind === 'daughter') this.daughterLost = true;
    this.wrecks.push({ x: s.x, y: s.y, a: s.heading, scale: s.scale, t: 0, kind: s.kind });
    this.events.push({ type: 'wreck', cause: cause, kind: s.kind });
    this.addShake(8);
    this.hope--;
    var i;
    for (i = 0; i < 22; i++) {
      this.particles.spawn({
        type: 'debris', x: s.x, y: s.y, vx: V.rand(-140, 140), vy: V.rand(-150, 60),
        life: V.rand(0.7, 1.6), size: V.rand(2, 5), hue: V.rand(18, 32), sat: 45, lum: 35,
        grav: 260, drag: 0.95, rot: V.rand(0, 6), vr: V.rand(-8, 8)
      });
    }
    for (i = 0; i < 16; i++) {
      this.particles.spawn({
        type: 'spray', x: s.x, y: s.y, vx: V.rand(-170, 170), vy: V.rand(-190, -20),
        life: V.rand(0.5, 1.1), size: V.rand(2, 5), hue: 200, sat: 40, lum: 80, grav: 300, drag: 0.94
      });
    }
    for (i = 0; i < 8; i++) {
      this.particles.spawn({
        type: 'ember', x: s.x, y: s.y, vx: V.rand(-50, 50), vy: V.rand(-90, -30),
        life: V.rand(0.6, 1.4), size: V.rand(1.5, 3), hue: 28, sat: 95, lum: 60, grav: -30, drag: 0.96
      });
    }
    if (this.hope <= 0) this.fail('hope');
    else if (s.kind === 'daughter') this.fail('daughter');
  };

  Sim.prototype.updateMonsters = function (dt) {
    var i, j;
    for (i = this.monsters.length - 1; i >= 0; i--) {
      var m = this.monsters[i];
      m.spawnT += dt;
      m.burn = Math.max(0, m.burn - dt * 2);

      var inWide = false, inFocus = false;
      if (this.lampDark <= 0 && this.lampPower > 0.25) {
        var d = this.beamDir();
        var pr = V.projectOnRay(LAMP.x, LAMP.y, d.ux, d.uy, m.x, m.y);
        if (pr.t > 45 && pr.t < BEAM_RANGE) {
          var w = Math.max(26, pr.t * Math.tan(this.half));
          if (pr.err <= w) { inFocus = this.focus; inWide = !this.focus; }
        }
      }
      m.lit = inWide || inFocus;

      if (inFocus) {
        m.hp -= 62 * dt;
        m.burn = 1;
        m.speed = Math.max(6, m.speed - 30 * dt);
        if (Math.random() < dt * 34) {
          this.particles.spawn({
            type: 'ash', x: m.x + V.rand(-16, 16), y: m.y + V.rand(-14, 14),
            vx: V.rand(-26, 26), vy: V.rand(-46, -8), life: V.rand(0.4, 1),
            size: V.rand(1, 3), hue: V.rand(10, 30), sat: 30, lum: V.rand(20, 45), drag: 0.95
          });
        }
        if (Math.random() < dt * 6) {
          this.particles.spawn({
            type: 'spark', x: m.x + V.rand(-14, 14), y: m.y + V.rand(-12, 12),
            vx: V.rand(-70, 70), vy: V.rand(-90, -10), life: V.rand(0.2, 0.5),
            size: V.rand(1, 2.4), hue: 45, sat: 100, lum: 75, drag: 0.93
          });
        }
        if (m.hp <= 0) {
          this.killMonster(i, 'burn');
          continue;
        }
      } else if (inWide) {
        m.speed = V.lerp(m.speed, m.speed * 0.4, 1 - Math.exp(-4 * dt));
        var away = V.angOf(LAMP.x, LAMP.y, m.x, m.y);
        m.x += Math.cos(away) * 26 * dt;
        m.y += Math.sin(away) * 26 * dt;
      } else {
        m.speed = V.lerp(m.speed, m.scale * 22, 1 - Math.exp(-1.4 * dt));
      }

      /* crawl toward the lamp */
      var want = V.angOf(m.x, m.y, LAMP.x, LAMP.y) + Math.sin(this.t * 1.7 + m.seed) * 0.16;
      m.heading = V.turnToward(m.heading, want, 0.9 * dt);
      m.x += Math.cos(m.heading) * m.speed * dt;
      m.y += Math.sin(m.heading) * m.speed * dt;

      if (!m.warned && V.dist2(m.x, m.y, LAMP.x, LAMP.y) < 300 * 300) {
        m.warned = true;
        this.events.push({ type: 'monsterNear' });
      }
      if (V.dist2(m.x, m.y, LAMP.x, LAMP.y) < 78 * 78) {
        this.breachMonster(i);
        continue;
      }
      if (this.phase === 'dawn') {
        /* the dark things sink at sunrise */
        this.killMonster(i, 'dawn');
        continue;
      }
    }
  };

  Sim.prototype.killMonster = function (idx, cause) {
    var m = this.monsters[idx];
    this.monsters.splice(idx, 1);
    this.banished++;
    this.events.push({ type: 'monsterDie', cause: cause });
    var i;
    for (i = 0; i < 16; i++) {
      this.particles.spawn({
        type: 'ash', x: m.x + V.rand(-18, 18), y: m.y + V.rand(-16, 16),
        vx: V.rand(-70, 70), vy: V.rand(-90, -6), life: V.rand(0.5, 1.3),
        size: V.rand(1.5, 3.5), hue: V.rand(10, 35), sat: 35, lum: V.rand(15, 40), drag: 0.95
      });
    }
    for (i = 0; i < 8; i++) {
      this.particles.spawn({
        type: 'spark', x: m.x + V.rand(-14, 14), y: m.y + V.rand(-12, 12),
        vx: V.rand(-90, 90), vy: V.rand(-110, -10), life: V.rand(0.3, 0.7),
        size: V.rand(1.5, 3), hue: 45, sat: 100, lum: 78, drag: 0.93
      });
    }
    if (cause === 'burn') this.heat = Math.max(0, this.heat - 13);
  };

  Sim.prototype.breachMonster = function (idx) {
    var m = this.monsters[idx];
    this.monsters.splice(idx, 1);
    this.lampDark = 2.6;
    this.hope--;
    this.addShake(11);
    this.flash = 0.55;
    this.events.push({ type: 'breach' });
    var i;
    for (i = 0; i < 24; i++) {
      this.particles.spawn({
        type: 'ash', x: LAMP.x + V.rand(-40, 40), y: LAMP.y + V.rand(-50, 10),
        vx: V.rand(-140, 140), vy: V.rand(-160, -20), life: V.rand(0.5, 1.4),
        size: V.rand(2, 4.5), hue: V.rand(0, 30), sat: 50, lum: V.rand(15, 45), drag: 0.94
      });
    }
    if (this.hope <= 0) this.fail('hope');
  };

  /* ---------- boss ---------- */
  Sim.prototype.updateBoss = function (dt) {
    var b = this.boss;
    if (!b || !this.bossActive) return;
    b.t += dt;

    var targetScale = 0.55 + V.clamp((b.y - 150) / 320, 0, 1) * 0.65;
    b.scale += (targetScale - b.scale) * (1 - Math.exp(-2.2 * dt));
    if (b.state === 'rising') {
      b.y = V.lerp(b.y, b.ty, 1 - Math.exp(-1.6 * dt));
      if (b.t > 3.4) { b.state = 'idle'; b.t = 0; }
      return;
    }
    if (b.state === 'dying') {
      b.sink += dt;
      b.y += 46 * dt;
      b.alpha = V.clamp(1 - (b.sink - 1.6) / 1.6, 0, 1);
      b.scale *= (1 - dt * 0.12);
      if (b.alpha <= 0) {
        b.state = 'dead';
        this.events.push({ type: 'bossGone' });
      }
      return;
    }
    if (b.state === 'dead') return;

    /* advance toward shore */
    var speed = 3.1 + Math.min(2.4, b.t * 0.03);
    if (b.surge > 0) { b.surge -= dt; speed *= 3.1; }
    b.y += speed * dt;
    b.roam += dt;
    b.x = 640 + Math.sin(b.roam * 0.42) * 168 * b.roamDir;
    if (Math.sin(b.roam * 0.42) * b.roamDir > 0.995) b.roamDir *= -1;

    if (Math.random() < dt * 14) {
      this.particles.spawn({
        type: 'spray', x: b.x + V.rand(-190, 190), y: b.y + V.rand(-8, 14),
        vx: V.rand(-40, 40), vy: V.rand(-120, -40), life: V.rand(0.5, 1.1),
        size: V.rand(2, 5), hue: 205, sat: 40, lum: 80, grav: 260, drag: 0.94
      });
    }

    /* eyes */
    var eyePos = this.bossEyePos();
    var searing = [false, false];
    if (this.focus && this.lampDark <= 0) {
      for (var e = 0; e < 2; e++) {
        if (b.eyes[e].dead) continue;
        if (this.coneContains(eyePos[e].x, eyePos[e].y)) {
          b.eyes[e].hp -= 64 * dt;
          searing[e] = true;
          if (Math.random() < dt * 30) {
            this.particles.spawn({
              type: 'spark', x: eyePos[e].x + V.rand(-10, 10), y: eyePos[e].y + V.rand(-8, 8),
              vx: V.rand(-90, 90), vy: V.rand(-120, -10), life: V.rand(0.25, 0.6),
              size: V.rand(1.5, 3), hue: 48, sat: 100, lum: 80, drag: 0.93
            });
          }
          if (b.eyes[e].hp <= 0 && !b.eyes[e].dead) {
            b.eyes[e].dead = true;
            b.eyes[e].hp = 0;
            this.addShake(6);
            this.flashPulse = 1;
            this.events.push({ type: 'eyeDead', which: e });
          }
        }
      }
    }
    b.searing = searing;

    if (b.eyes[0].dead && b.eyes[1].dead) {
      b.state = 'dying';
      b.sink = 0;
      this.addShake(18);
      this.flash = 1;
      this.events.push({ type: 'bossDie' });
      return;
    }

    /* roars */
    b.roarT -= dt;
    if (b.roarT <= 0) {
      b.roarT = V.rand(11, 14);
      b.surge = 2.4;
      this.gustT = 0;
      this.gustDur = 2.2;
      this.addShake(7);
      this.events.push({ type: 'roar' });
      var alive = this.monsters.length;
      if (alive < 2 && this.phase !== 'dawn') {
        this.spawnMonster({ edge: V.pick(['W', 'E']), a: 340, b: 620 });
      }
    }

    /* slam the shore */
    if (b.y >= 470) {
      b.y = 270;
      b.surge = 0;
      this.hope--;
      this.addShake(20);
      this.flash = 0.8;
      this.events.push({ type: 'slam' });
      /* shove every ship back out */
      for (var i = 0; i < this.ships.length; i++) {
        var s = this.ships[i];
        var ang = V.angOf(b.x, b.y, s.x, s.y);
        s.heading = ang + V.rand(-0.3, 0.3);
        s.x += Math.cos(ang) * 40;
        s.y += Math.sin(ang) * 40;
      }
      if (this.hope <= 0) this.fail('hope');
    }

    /* dawn trigger handled in checkChapterState */
  };

  Sim.prototype.bossEyePos = function () {
    var b = this.boss;
    var s = b.scale;
    return [
      { x: b.x - 96 * s, y: b.y - 120 * s },
      { x: b.x + 96 * s, y: b.y - 120 * s }
    ];
  };

  /* ---------- chapter flow ---------- */
  Sim.prototype.checkChapterState = function () {
    var data = this.chapterData;
    if (!data) return;

    /* fail already emitted by wreck/breach */
    if (this.hope <= 0) return;

    var scheduleDone = !this.spawnQueue.length && !this.monsterQueue.length;
    var shipsDone = !this.ships.length;

    if (this.chapter === 4) {
      /* dawn begins once the beast is dying */
      if (this.boss && this.boss.state === 'dying' && this.phase !== 'dawn') {
        this.phase = 'dawn';
        this.dawnT = 0;
        this.monsterQueue.length = 0;
        this.dismissMonsters();
        this.wind.mag = 0;
        this.wind.base = 0;
        this.events.push({ type: 'dawn' });
      }
      var bossDone = this.boss && (this.boss.state === 'dying' || this.boss.state === 'dead');
      if (bossDone && this.daughterSaved && shipsDone && scheduleDone) {
        this.dismissMonsters();
        this.events.push({ type: 'complete' });
        this.mode = 'won';
      }
      return;
    }

    if (scheduleDone && shipsDone && this.mode === 'play') {
      this.dismissMonsters();
      this.events.push({ type: 'complete' });
      this.mode = 'won';
    }
  };

  Sim.prototype.advanceDawn = function (dt) {
    if (this.phase === 'dawn' && this.dawnT < 1) {
      this.dawnT = Math.min(1, this.dawnT + dt / 17);
    }
  };

  V.Sim = Sim;
  V.shipScale = shipScale;
  V.CHAPTERS = CHAPTERS;
  V.LAMP_X = LAMP.x;

})(window.Vigil);
