'use strict';

(function () {
  const S = window.Sound;

  const rand = (a, b) => a + Math.random() * (b - a);
  const randi = (a, b) => Math.floor(rand(a, b + 1));
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const lerp = (a, b, t) => a + (b - a) * t;
  const dist = (x1, y1, x2, y2) => Math.hypot(x1 - x2, y1 - y2);
  const TAU = Math.PI * 2;
  const rgba = (r, g, b, a) => `rgba(${r | 0},${g | 0},${b | 0},${a})`;

  const canvas = document.getElementById('c');
  const ctx = canvas.getContext('2d');
  let W = 0, H = 0, DPR = 1;
  function resize() {
    DPR = Math.min(window.devicePixelRatio || 1, 2);
    W = window.innerWidth; H = window.innerHeight;
    canvas.width = W * DPR; canvas.height = H * DPR;
    canvas.style.width = W + 'px'; canvas.style.height = H + 'px';
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  }
  window.addEventListener('resize', resize);
  resize();

  const ui = document.getElementById('ui');

  const hud = document.createElement('div'); hud.id = 'hud'; hud.className = 'hidden';
  const statusEl = document.createElement('div'); statusEl.id = 'status';
  const timerEl = document.createElement('div'); timerEl.id = 'timer'; timerEl.className = 'hidden';
  const lightWrap = document.createElement('div'); lightWrap.id = 'lightWrap'; lightWrap.className = 'hidden';
  const lightBar = document.createElement('div'); lightBar.id = 'lightBar';
  lightWrap.appendChild(lightBar);
  hud.appendChild(statusEl); hud.appendChild(timerEl); hud.appendChild(lightWrap);
  ui.appendChild(hud);

  const overlay = document.createElement('div'); overlay.id = 'overlay'; overlay.className = 'hidden';
  const titleEl = document.createElement('div'); titleEl.id = 'title';
  const subtitleEl = document.createElement('div'); subtitleEl.id = 'subtitle';
  const storyEl = document.createElement('div'); storyEl.id = 'storyText';
  const promptEl = document.createElement('div'); promptEl.id = 'prompt';
  overlay.appendChild(titleEl); overlay.appendChild(subtitleEl);
  overlay.appendChild(storyEl); overlay.appendChild(promptEl);
  ui.appendChild(overlay);

  const toastEl = document.createElement('div'); toastEl.id = 'toast'; ui.appendChild(toastEl);

  const endEl = document.createElement('div'); endEl.id = 'end';
  const endTitle = document.createElement('div'); endTitle.id = 'endTitle';
  const endText = document.createElement('div'); endText.id = 'endText';
  const endHint = document.createElement('div'); endHint.id = 'endHint'; endHint.textContent = 'press enter';
  endEl.appendChild(endTitle); endEl.appendChild(endText); endEl.appendChild(endHint);
  ui.appendChild(endEl);

  let presentList = null, presentIdx = 0, presentCb = null;
  function present(screens, cb) {
    presentList = screens; presentIdx = 0; presentCb = cb;
    overlay.classList.remove('hidden'); overlay.classList.remove('fade');
    showScreen();
  }
  function showScreen() {
    const s = presentList[presentIdx];
    titleEl.style.display = s.title ? 'block' : 'none'; titleEl.textContent = s.title || '';
    subtitleEl.style.display = s.subtitle ? 'block' : 'none'; subtitleEl.textContent = s.subtitle || '';
    storyEl.style.display = s.text ? 'block' : 'none'; storyEl.textContent = s.text || '';
    promptEl.textContent = s.prompt || 'press enter';
  }
  function advancePresent() {
    if (!presentList) return;
    presentIdx++;
    if (presentIdx >= presentList.length) {
      overlay.classList.add('fade');
      const cb = presentCb; presentList = null; presentCb = null;
      setTimeout(() => { overlay.classList.add('hidden'); overlay.classList.remove('fade'); if (cb) cb(); }, 750);
    } else {
      overlay.classList.add('fade');
      setTimeout(() => { overlay.classList.remove('fade'); showScreen(); }, 350);
    }
  }

  let toastT = 0;
  function toast(msg) { toastEl.textContent = msg; toastEl.classList.add('show'); toastT = 2.4; }

  const PALETTES = {
    1: {
      bg1: [3, 7, 17], bg2: [1, 3, 9],
      neb: [[12, 42, 74], [16, 58, 92], [10, 58, 58]],
      player: [191, 233, 255], mote: [[127, 212, 255], [160, 255, 224], [155, 184, 255]]
    },
    2: {
      bg1: [12, 3, 7], bg2: [5, 1, 3],
      neb: [[58, 11, 20], [74, 16, 48], [42, 11, 58]],
      player: [255, 217, 176], mote: [[255, 157, 110], [255, 210, 127], [255, 127, 157]]
    },
    3: {
      bg1: [10, 8, 20], bg2: [4, 3, 10],
      neb: [[58, 42, 92], [92, 74, 42], [42, 92, 74]],
      player: [255, 242, 192], mote: [[255, 217, 138], [255, 255, 255], [255, 230, 160]]
    }
  };

  const G = {
    state: 'title', t: 0,
    player: { x: 0, y: 0, vx: 0, vy: 0, r: 14 },
    motes: [], parts: [], clouds: [], stars: [], bolts: [], nodes: [],
    devour: null, light: 1, collected: 0, need1: 12,
    survive: 0, surviveNeed: 35, invuln: 0, finaleT: 0,
    shake: 0, act: 1, motesSpawnT: 0, boltT: 0, devourSpawned: false,
    endShown: false, lastChime: 0
  };

  function genStars() {
    G.stars = [];
    const n = Math.floor((W * H) / 5200);
    for (let i = 0; i < n; i++) {
      G.stars.push({ x: rand(0, W), y: rand(0, H), s: rand(0.4, 1.7), phase: rand(0, TAU), sp: rand(0.4, 1.6) });
    }
  }
  function genClouds(act) {
    G.clouds = [];
    const pal = PALETTES[act];
    for (let i = 0; i < 6; i++) {
      const c = pal.neb[i % pal.neb.length];
      G.clouds.push({
        x: rand(0, W), y: rand(0, H), r: rand(160, 380),
        c, alpha: rand(0.05, 0.13), phase: rand(0, TAU),
        driftx: rand(20, 70), drifty: rand(20, 70)
      });
    }
  }

  function spawnMote(x, y) {
    const pal = PALETTES[G.act];
    const col = pal.mote[randi(0, pal.mote.length - 1)];
    if (x === undefined) {
      x = rand(60, W - 60); y = rand(60, H - 60);
    }
    G.motes.push({
      x, y, vx: rand(-22, 22), vy: rand(-22, 22),
      r: rand(5, 8), col, phase: rand(0, TAU), bob: rand(0.6, 1.6), base: y
    });
  }

  function burst(x, y, col, n, spd) {
    for (let i = 0; i < n; i++) {
      const a = rand(0, TAU), s = rand(spd * 0.3, spd);
      G.parts.push({
        x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s,
        life: 1, max: rand(0.5, 1.1), size: rand(1.5, 4), col
      });
    }
  }

  function resetPlayer() {
    G.player.x = W / 2; G.player.y = H / 2; G.player.vx = 0; G.player.vy = 0;
  }

  function initAct1() {
    G.act = 1; G.state = 'act1';
    genClouds(1); resetPlayer();
    G.motes = []; G.parts = []; G.bolts = []; G.devour = null;
    G.collected = 0; G.light = 1; G.survive = 0; G.invuln = 0;
    S.setMood(1);
    hud.classList.remove('hidden');
    timerEl.classList.add('hidden'); lightWrap.classList.add('hidden');
    statusEl.textContent = 'light remembered  ' + G.collected + ' / ' + G.need1;
    toast('move — WASD / arrows, or hold the mouse');
    for (let i = 0; i < 7; i++) spawnMote();
  }

  function initAct2() {
    G.act = 2; G.state = 'act2';
    genClouds(2);
    G.motes = []; G.parts = []; G.bolts = [];
    G.light = 1; G.survive = 0; G.invuln = 0;
    G.motesSpawnT = 0; G.boltT = 1.2; G.devourSpawned = false;
    G.devour = null;
    S.setMood(2);
    resetPlayer();
    timerEl.classList.remove('hidden'); lightWrap.classList.remove('hidden');
    statusEl.textContent = 'flee the devourer';
    toast('keep your light alive — gather motes, avoid the dark');
    for (let i = 0; i < 5; i++) spawnMote();
  }

  function initAct3() {
    G.act = 3; G.state = 'act3';
    genClouds(3);
    G.parts = []; G.bolts = []; G.devour = null; G.motes = [];
    S.setMood(3);
    resetPlayer();
    timerEl.classList.add('hidden'); lightWrap.classList.add('hidden');
    G.nodes = [];
    const n = 26;
    let tries = 0;
    while (G.nodes.length < n && tries < 4000) {
      tries++;
      const x = rand(80, W - 80), y = rand(110, H - 80);
      let ok = true;
      for (const nd of G.nodes) { if (dist(x, y, nd.x, nd.y) < 78) { ok = false; break; } }
      if (ok) {
        const col = PALETTES[3].mote[randi(0, 2)];
        G.nodes.push({ x, y, lit: false, charge: 0, col, phase: rand(0, TAU) });
      }
    }
    G.litCount = 0;
    statusEl.textContent = 'stars lit  ' + G.litCount + ' / ' + G.nodes.length;
    toast('linger near each dim star to rekindle it');
  }

  function endGame(kind) {
    G.state = kind; G.endShown = true;
    hud.classList.add('hidden');
    if (kind === 'win') {
      S.finale();
      endTitle.textContent = 'THE SKY REMEMBERS';
      endText.innerHTML = 'You gave the light back, one star at a time.<br/>Thank you, Luminary.';
    } else {
      S.stopAmbient();
      endTitle.textContent = 'THE LIGHT WENT OUT';
      endText.innerHTML = 'The dark is patient, and it does not forgive.<br/>Will you try again?';
    }
    endEl.classList.add('show');
  }

  function bootTitle() {
    G.state = 'title'; G.endShown = false;
    endEl.classList.remove('show');
    hud.classList.add('hidden');
    if (G.stars.length === 0) genStars();
    genClouds(1);
    present([{ title: 'LUMINARY', subtitle: 'the last light', prompt: 'press enter to begin' }], startGame);
  }

  function startGame() {
    present([
      { text: 'The stars went dark, one by one, until the sky was a closed eye.' },
      { text: 'You are what stayed lit — a single, stubborn light.' },
      { text: 'Drift through the silence. Gather what the dark forgot.', prompt: 'press enter' }
    ], initAct1);
  }

  function act1Done() {
    present([
      { text: 'You remember their warmth. It hums inside you like a held breath.' },
      { text: 'But warmth is a signal. And something hungry has been listening.' },
      { text: 'It is coming.', prompt: 'press enter' }
    ], initAct2);
  }

  function act2Done() {
    present([
      { text: 'You slipped the Devourer’s grasp. It melts back into the black, unsated.' },
      { text: 'The sky is still empty. A whole universe, waiting to be given back.' },
      { text: 'Light the stars. Rekindle everything.', prompt: 'press enter' }
    ], initAct3);
  }

  const keys = {};
  const pointer = { x: 0, y: 0, down: false };
  window.addEventListener('keydown', (e) => {
    if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' '].includes(e.key.toLowerCase())) e.preventDefault();
    keys[e.key.toLowerCase()] = true;
    S.resume();
    if (e.key === 'Enter' || e.key === ' ') handleAdvance();
  });
  window.addEventListener('keyup', (e) => { keys[e.key.toLowerCase()] = false; });
  window.addEventListener('mousemove', (e) => { pointer.x = e.clientX; pointer.y = e.clientY; });
  window.addEventListener('mousedown', (e) => {
    pointer.down = true; S.resume();
    if (presentList) advancePresent();
    else if (G.endShown) bootTitle();
  });
  window.addEventListener('mouseup', () => { pointer.down = false; });

  function handleAdvance() {
    if (presentList) advancePresent();
    else if (G.endShown) bootTitle();
  }

  function updatePlayer(dt) {
    const p = G.player;
    let ax = 0, ay = 0;
    if (keys['a'] || keys['arrowleft']) ax -= 1;
    if (keys['d'] || keys['arrowright']) ax += 1;
    if (keys['w'] || keys['arrowup']) ay -= 1;
    if (keys['s'] || keys['arrowdown']) ay += 1;
    if (pointer.down) {
      const dx = pointer.x - p.x, dy = pointer.y - p.y;
      const m = Math.hypot(dx, dy) || 1;
      ax += dx / m; ay += dy / m;
    }
    const len = Math.hypot(ax, ay);
    if (len > 1) { ax /= len; ay /= len; }
    const ACC = 1500, MAX = 290;
    p.vx += ax * ACC * dt; p.vy += ay * ACC * dt;
    const fr = Math.pow(0.85, dt * 60);
    p.vx *= fr; p.vy *= fr;
    const sp = Math.hypot(p.vx, p.vy);
    if (sp > MAX) { p.vx *= MAX / sp; p.vy *= MAX / sp; }
    p.x = clamp(p.x + p.vx * dt, p.r, W - p.r);
    p.y = clamp(p.y + p.vy * dt, p.r, H - p.r);
    if (Math.random() < 0.6) {
      G.parts.push({ x: p.x + rand(-4, 4), y: p.y + rand(-4, 4), vx: rand(-8, 8), vy: rand(-8, 8), life: 1, max: 0.5, size: rand(1, 2.5), col: PALETTES[G.act].player });
    }
  }

  function updateMotes(dt) {
    const p = G.player;
    for (let i = G.motes.length - 1; i >= 0; i--) {
      const m = G.motes[i];
      m.x += m.vx * dt; m.y += m.vy * dt; m.phase += dt * m.bob;
      if (m.x < 40 || m.x > W - 40) m.vx *= -1;
      if (m.y < 40 || m.y > H - 40) m.vy *= -1;
      m.x = clamp(m.x, 30, W - 30); m.y = clamp(m.y, 30, H - 30);
      if (dist(m.x, m.y, p.x, p.y) < p.r + m.r + 4) {
        G.motes.splice(i, 1);
        burst(m.x, m.y, m.col, 14, 160);
        const ci = G.collected % 5;
        S.chime(ci);
        if (G.act === 1) {
          G.collected++;
          statusEl.textContent = 'light remembered  ' + G.collected + ' / ' + G.need1;
          spawnMote();
          if (G.collected >= G.need1) { G.state = 'transition'; act1Done(); }
        } else if (G.act === 2) {
          G.light = clamp(G.light + 0.14, 0, 1);
        }
      }
    }
  }

  function updateDevourer(dt) {
    const p = G.player;
    if (!G.devourSpawned) {
      G.devourSpawned = true;
      let dx = p.x > W / 2 ? -1 : 1, dy = p.y > H / 2 ? -1 : 1;
      G.devour = { x: dx > 0 ? -60 : W + 60, y: dy > 0 ? -60 : H + 60, r: 58, phase: 0, speed: 62 };
    }
    const d = G.devour;
    d.phase += dt * 2;
    d.speed = 62 + (G.survive / G.surviveNeed) * 78;
    const ang = Math.atan2(p.y - d.y, p.x - d.x);
    d.x += Math.cos(ang) * d.speed * dt;
    d.y += Math.sin(ang) * d.speed * dt;

    if (G.invuln > 0) G.invuln -= dt;
    if (G.invuln <= 0 && dist(d.x, d.y, p.x, p.y) < d.r + p.r) {
      G.light = clamp(G.light - 0.24, 0, 1);
      G.invuln = 0.9; G.shake = 14; S.hit();
      const kx = (p.x - d.x), ky = (p.y - d.y), km = Math.hypot(kx, ky) || 1;
      p.vx += (kx / km) * 420; p.vy += (ky / km) * 420;
      burst(p.x, p.y, [255, 90, 90], 18, 220);
      if (G.light <= 0) { endGame('lose'); return; }
    }

    G.boltT -= dt;
    if (G.boltT <= 0) {
      G.boltT = lerp(2.6, 1.3, G.survive / G.surviveNeed);
      const a = Math.atan2(p.y - d.y, p.x - d.x) + rand(-0.3, 0.3);
      G.bolts.push({ x: d.x, y: d.y, vx: Math.cos(a) * 165, vy: Math.sin(a) * 165, r: 8, life: 6 });
      S.bolt();
    }

    for (let i = G.bolts.length - 1; i >= 0; i--) {
      const b = G.bolts[i];
      b.x += b.vx * dt; b.y += b.vy * dt; b.life -= dt;
      if (b.life <= 0 || b.x < -40 || b.x > W + 40 || b.y < -40 || b.y > H + 40) { G.bolts.splice(i, 1); continue; }
      if (G.invuln <= 0 && dist(b.x, b.y, p.x, p.y) < b.r + p.r) {
        G.bolts.splice(i, 1);
        G.light = clamp(G.light - 0.13, 0, 1);
        G.invuln = 0.6; G.shake = 8; S.hit();
        burst(p.x, p.y, [255, 120, 120], 12, 180);
        if (G.light <= 0) { endGame('lose'); return; }
      }
    }

    G.light -= lerp(0.045, 0.085, G.survive / G.surviveNeed) * dt;
    if (G.light <= 0) { endGame('lose'); return; }
    G.survive += dt;
    if (G.survive >= G.surviveNeed) { G.state = 'transition'; act2Done(); return; }

    G.motesSpawnT -= dt;
    if (G.motesSpawnT <= 0 && G.motes.length < 5) {
      G.motesSpawnT = 1.1;
      spawnMote();
    }
  }

  function updateNodes(dt) {
    const p = G.player;
    for (const nd of G.nodes) {
      nd.phase += dt;
      const d = dist(nd.x, nd.y, p.x, p.y);
      if (!nd.lit) {
        if (d < nodeRadius(nd) + p.r + 16) {
          nd.charge += dt * 1.8;
          if (nd.charge >= 1) {
            nd.lit = true; nd.charge = 1;
            G.litCount++;
            statusEl.textContent = 'stars lit  ' + G.litCount + ' / ' + G.nodes.length;
            burst(nd.x, nd.y, nd.col, 26, 200);
            S.ignite(G.litCount);
            if (G.litCount >= G.nodes.length) { G.state = 'finale'; G.finaleT = 0; }
          }
        } else {
          nd.charge = Math.max(0, nd.charge - dt * 0.8);
        }
      }
    }
  }
  function nodeRadius(nd) { return 16; }

  function updateFinale(dt) {
    G.finaleT += dt;
    const p = G.player;
    for (let i = 0; i < 3; i++) {
      const a = rand(0, TAU), r = rand(20, 120);
      G.parts.push({ x: W / 2 + Math.cos(a) * r, y: H / 2 + Math.sin(a) * r, vx: rand(-30, 30), vy: rand(-30, 30), life: 1, max: rand(1, 2.2), size: rand(2, 5), col: PALETTES[3].mote[randi(0, 2)] });
    }
    if (G.finaleT >= 3.6) endGame('win');
  }

  function update(dt) {
    G.t += dt;
    if (G.shake > 0) G.shake = Math.max(0, G.shake - dt * 30);
    if (toastT > 0) { toastT -= dt; if (toastT <= 0) toastEl.classList.remove('show'); }

    for (let i = G.parts.length - 1; i >= 0; i--) {
      const q = G.parts[i];
      q.x += q.vx * dt; q.y += q.vy * dt; q.life -= dt / q.max;
      q.vx *= 0.97; q.vy *= 0.97;
      if (q.life <= 0) G.parts.splice(i, 1);
    }

    if (G.state === 'act1') {
      updatePlayer(dt); updateMotes(dt);
    } else if (G.state === 'act2') {
      updatePlayer(dt); updateMotes(dt); updateDevourer(dt);
      lightBar.style.width = (G.light * 100) + '%';
      lightWrap.classList.toggle('low', G.light < 0.35);
      timerEl.textContent = Math.max(0, (G.surviveNeed - G.survive)).toFixed(1);
    } else if (G.state === 'act3') {
      updatePlayer(dt); updateNodes(dt);
      for (const nd of G.nodes) if (nd.lit) burst(nd.x, nd.y, nd.col, 1, 30);
    } else if (G.state === 'finale') {
      updateFinale(dt);
    }
  }

  function drawBackground(t, pal) {
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, rgba(pal.bg1[0], pal.bg1[1], pal.bg1[2], 1));
    g.addColorStop(1, rgba(pal.bg2[0], pal.bg2[1], pal.bg2[2], 1));
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);

    ctx.globalCompositeOperation = 'lighter';
    for (const c of G.clouds) {
      const x = c.x + Math.sin(t * 0.05 + c.phase) * c.driftx;
      const y = c.y + Math.cos(t * 0.04 + c.phase) * c.drifty;
      const rg = ctx.createRadialGradient(x, y, 0, x, y, c.r);
      rg.addColorStop(0, rgba(c.c[0], c.c[1], c.c[2], c.alpha));
      rg.addColorStop(1, rgba(c.c[0], c.c[1], c.c[2], 0));
      ctx.globalAlpha = 1; ctx.fillStyle = rg;
      ctx.beginPath(); ctx.arc(x, y, c.r, 0, TAU); ctx.fill();
    }
    ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';

    for (const s of G.stars) {
      const tw = 0.5 + 0.5 * Math.sin(t * s.sp + s.phase);
      ctx.globalAlpha = 0.25 + 0.65 * tw;
      ctx.fillStyle = '#cfe6ff';
      ctx.beginPath(); ctx.arc(s.x, s.y, s.s, 0, TAU); ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  function drawMotes(t) {
    ctx.globalCompositeOperation = 'lighter';
    for (const m of G.motes) {
      const y = m.y + Math.sin(m.phase) * 4;
      const rg = ctx.createRadialGradient(m.x, y, 0, m.x, y, m.r * 3.2);
      rg.addColorStop(0, rgba(m.col[0], m.col[1], m.col[2], 0.95));
      rg.addColorStop(0.4, rgba(m.col[0], m.col[1], m.col[2], 0.4));
      rg.addColorStop(1, rgba(m.col[0], m.col[1], m.col[2], 0));
      ctx.fillStyle = rg;
      ctx.beginPath(); ctx.arc(m.x, y, m.r * 3.2, 0, TAU); ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.arc(m.x, y, m.r * 0.5, 0, TAU); ctx.fill();
    }
    ctx.globalCompositeOperation = 'source-over';
  }

  function drawPlayer(t, pal) {
    const p = G.player;
    const pulse = 0.85 + 0.15 * Math.sin(t * 4);
    ctx.globalCompositeOperation = 'lighter';
    const gr = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r * 4.5 * pulse);
    gr.addColorStop(0, rgba(255, 255, 255, 0.95));
    gr.addColorStop(0.25, rgba(pal.player[0], pal.player[1], pal.player[2], 0.6));
    gr.addColorStop(1, rgba(pal.player[0], pal.player[1], pal.player[2], 0));
    ctx.fillStyle = gr;
    ctx.beginPath(); ctx.arc(p.x, p.y, p.r * 4.5 * pulse, 0, TAU); ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.arc(p.x, p.y, p.r * 0.6, 0, TAU); ctx.fill();
    ctx.globalCompositeOperation = 'source-over';
  }

  function drawDevourer(t) {
    const d = G.devour; if (!d) return;
    ctx.globalCompositeOperation = 'lighter';
    const rg = ctx.createRadialGradient(d.x, d.y, d.r * 0.4, d.x, d.y, d.r * 2);
    rg.addColorStop(0, rgba(150, 12, 24, 0.5));
    rg.addColorStop(1, rgba(0, 0, 0, 0));
    ctx.fillStyle = rg;
    ctx.beginPath(); ctx.arc(d.x, d.y, d.r * 2, 0, TAU); ctx.fill();
    ctx.globalCompositeOperation = 'source-over';

    const bg = ctx.createRadialGradient(d.x, d.y, 0, d.x, d.y, d.r);
    bg.addColorStop(0, '#220308');
    bg.addColorStop(0.7, '#0a0103');
    bg.addColorStop(1, rgba(10, 1, 3, 0));
    ctx.fillStyle = bg;
    ctx.beginPath(); ctx.arc(d.x, d.y, d.r, 0, TAU); ctx.fill();

    ctx.strokeStyle = rgba(200, 30, 50, 0.5); ctx.lineWidth = 3;
    for (let i = 0; i < 7; i++) {
      const a0 = (i / 7) * TAU + d.phase * 0.3;
      ctx.beginPath();
      let x = d.x, y = d.y;
      ctx.moveTo(x, y);
      for (let s = 1; s <= 5; s++) {
        const rr = (d.r * 1.7) * (s / 5);
        const aa = a0 + Math.sin(d.phase + s * 0.8 + i) * 0.4;
        x = d.x + Math.cos(aa) * rr; y = d.y + Math.sin(aa) * rr;
        ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
  }

  function drawBolts() {
    ctx.globalCompositeOperation = 'lighter';
    for (const b of G.bolts) {
      const rg = ctx.createRadialGradient(b.x, b.y, 0, b.x, b.y, b.r * 2.4);
      rg.addColorStop(0, rgba(255, 120, 120, 0.9));
      rg.addColorStop(0.4, rgba(220, 30, 50, 0.5));
      rg.addColorStop(1, rgba(220, 30, 50, 0));
      ctx.fillStyle = rg;
      ctx.beginPath(); ctx.arc(b.x, b.y, b.r * 2.4, 0, TAU); ctx.fill();
    }
    ctx.globalCompositeOperation = 'source-over';
  }

  function drawNodes(t) {
    ctx.globalCompositeOperation = 'lighter';
    const lit = G.nodes.filter(n => n.lit);
    for (const nd of lit) {
      ctx.strokeStyle = rgba(nd.col[0], nd.col[1], nd.col[2], 0.18);
      ctx.lineWidth = 1;
      for (const o of lit) {
        if (o === nd) continue;
        if (dist(nd.x, nd.y, o.x, o.y) < 200) {
          ctx.beginPath(); ctx.moveTo(nd.x, nd.y); ctx.lineTo(o.x, o.y); ctx.stroke();
        }
      }
    }
    for (const nd of G.nodes) {
      if (nd.lit) {
        const pulse = 0.8 + 0.2 * Math.sin(t * 3 + nd.phase);
        const rg = ctx.createRadialGradient(nd.x, nd.y, 0, nd.x, nd.y, 40 * pulse);
        rg.addColorStop(0, rgba(255, 255, 255, 0.95));
        rg.addColorStop(0.3, rgba(nd.col[0], nd.col[1], nd.col[2], 0.7));
        rg.addColorStop(1, rgba(nd.col[0], nd.col[1], nd.col[2], 0));
        ctx.fillStyle = rg;
        ctx.beginPath(); ctx.arc(nd.x, nd.y, 40 * pulse, 0, TAU); ctx.fill();
        ctx.strokeStyle = rgba(255, 255, 255, 0.8); ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(nd.x - 26, nd.y); ctx.lineTo(nd.x + 26, nd.y);
        ctx.moveTo(nd.x, nd.y - 26); ctx.lineTo(nd.x, nd.y + 26);
        ctx.stroke();
      } else {
        const rr = nodeRadius(nd);
        const a = 0.25 + 0.15 * Math.sin(t * 2 + nd.phase);
        ctx.strokeStyle = rgba(nd.col[0], nd.col[1], nd.col[2], a);
        ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.arc(nd.x, nd.y, rr, 0, TAU); ctx.stroke();
        ctx.fillStyle = rgba(nd.col[0], nd.col[1], nd.col[2], 0.5);
        ctx.beginPath(); ctx.arc(nd.x, nd.y, 2.5, 0, TAU); ctx.fill();
        if (nd.charge > 0) {
          ctx.strokeStyle = rgba(255, 240, 200, 0.9); ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.arc(nd.x, nd.y, rr + 6, -Math.PI / 2, -Math.PI / 2 + TAU * nd.charge);
          ctx.stroke();
        }
      }
    }
    ctx.globalCompositeOperation = 'source-over';
  }

  function drawParticles() {
    ctx.globalCompositeOperation = 'lighter';
    for (const q of G.parts) {
      ctx.globalAlpha = clamp(q.life, 0, 1);
      ctx.fillStyle = rgba(q.col[0], q.col[1], q.col[2], 1);
      ctx.beginPath(); ctx.arc(q.x, q.y, q.size, 0, TAU); ctx.fill();
    }
    ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
  }

  function drawFinale() {
    const p = Math.min(1, G.finaleT / 2);
    ctx.globalCompositeOperation = 'lighter';
    const r = 60 + G.finaleT * 200;
    const rg = ctx.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, r);
    rg.addColorStop(0, rgba(255, 245, 210, 0.5 * p));
    rg.addColorStop(0.5, rgba(255, 220, 160, 0.2 * p));
    rg.addColorStop(1, rgba(255, 220, 160, 0));
    ctx.fillStyle = rg;
    ctx.beginPath(); ctx.arc(W / 2, H / 2, r, 0, TAU); ctx.fill();
    ctx.globalCompositeOperation = 'source-over';
  }

  function render() {
    const pal = PALETTES[G.act] || PALETTES[1];
    ctx.save();
    if (G.shake > 0) ctx.translate(rand(-G.shake, G.shake), rand(-G.shake, G.shake));
    drawBackground(G.t, pal);
    if (G.state === 'act1' || G.state === 'act2' || G.state === 'act3' || G.state === 'finale' || G.state === 'transition' || G.state === 'win' || G.state === 'lose') {
      drawMotes(G.t);
      drawNodes(G.t);
      if (G.devour) drawDevourer(G.t);
      drawBolts();
      drawParticles();
      drawPlayer(G.t, pal);
      if (G.state === 'finale') drawFinale();
    }
    ctx.restore();
    drawParticles();
  }

  let last = performance.now();
  function loop(now) {
    let dt = (now - last) / 1000; last = now;
    if (dt > 0.05) dt = 0.05;
    if (!presentList && !G.endShown) update(dt);
    else if (G.endShown && G.state === 'finale') update(dt);
    render();
    requestAnimationFrame(loop);
  }

  genStars();
  bootTitle();
  requestAnimationFrame(loop);
})();
