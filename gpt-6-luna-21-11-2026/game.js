(() => {
  "use strict";

  const WIDTH = 1280;
  const HEIGHT = 720;
  // All artwork is drawn in this fixed design space, then scaled for the screen.
  const canvas = document.getElementById("gameCanvas");
  const ctx = canvas.getContext("2d", { alpha: false });
  const overlay = document.getElementById("overlay");
  const overlayKicker = document.getElementById("overlayKicker");
  const overlayTitle = document.getElementById("overlayTitle");
  const overlayCopy = document.getElementById("overlayCopy");
  const overlayDetails = document.getElementById("overlayDetails");
  const overlayFootnote = document.getElementById("overlayFootnote");
  const primaryButton = document.getElementById("primaryButton");
  const primaryLabel = document.getElementById("primaryLabel");
  const secondaryButton = document.getElementById("secondaryButton");
  const soundButton = document.getElementById("soundButton");
  const soundLabel = document.getElementById("soundLabel");
  const helpButton = document.getElementById("helpButton");
  const caption = document.getElementById("caption");
  const stageReadout = document.getElementById("stageReadout");
  const progressReadout = document.getElementById("progressReadout");
  const controlReadout = document.getElementById("controlReadout");
  const instrumentLed = document.querySelector(".instrument-led");

  const titleDetails = overlayDetails.innerHTML;
  const keys = new Set();
  const stars = makeStars(250);
  const particles = [];
  const ripples = [];
  let lastFrame = performance.now();
  let captionTimeout = 0;
  let animationTime = 0;
  let audioContext = null;
  let masterGain = null;
  let pauseFrom = "fly";
  let helpFrom = "title";
  let panelBeforeHelp = null;
  let currentPanel = null;

  const state = {
    mode: "title",
    stage: 1,
    elapsed: 0,
    player: createPlayer(),
    hazards: [],
    motes: [],
    collected: 0,
    total: 5,
    health: 4,
    pingTime: 0,
    pingCooldown: 0,
    dashCooldown: 0,
    beatResults: [],
    beatAttempt: 0,
    beatElapsed: 0,
    beatsSounded: new Set(),
    bestCadence: 0,
    soundOn: true,
    shake: 0,
    score: 0,
    lastHit: -10,
  };

  function makeStars(count) {
    let seed = 7719;
    const random = () => {
      seed = (seed * 16807) % 2147483647;
      return (seed - 1) / 2147483646;
    };
    return Array.from({ length: count }, () => ({
      x: random() * WIDTH,
      y: random() * HEIGHT * 0.82,
      size: random() < 0.12 ? 2.1 : 0.6 + random() * 1.25,
      alpha: 0.2 + random() * 0.65,
      phase: random() * Math.PI * 2,
      drift: 3 + random() * 15,
      warm: random() > 0.88,
    }));
  }

  function createPlayer() {
    return {
      x: 190,
      y: 365,
      vx: 0,
      vy: 0,
      radius: 17,
      invulnerable: 0,
      dashTime: 0,
      dashX: 1,
      dashY: 0,
      flap: 0,
    };
  }

  function makeMotes(stage) {
    if (stage === 1) {
      return [
        { x: 405, y: 164, phase: 0.4, line: "Tin roof in the rain." },
        { x: 850, y: 222, phase: 1.7, line: "A laugh caught in the kettle's hiss." },
        { x: 685, y: 538, phase: 2.9, line: "The tune she tapped against the window." },
        { x: 1085, y: 498, phase: 4.2, line: "‘You first,’ she said. ‘No, you.’" },
        { x: 1090, y: 326, phase: 5.1, line: "A little voice: ‘I'll come back.’" },
      ];
    }
    return [
      { x: 330, y: 185, phase: 0.7, line: "Find the low note." },
      { x: 1025, y: 185, phase: 1.9, line: "The ocean keeps the rhythm." },
      { x: 965, y: 538, phase: 3.2, line: "A window left open." },
      { x: 320, y: 510, phase: 4.6, line: "I am here. I am here." },
    ];
  }

  function makeHazards(stage) {
    if (stage === 1) {
      return [
        { x: 515, y: 352, radius: 39, swingX: 57, swingY: 55, phase: 0.2, speed: 0.7 },
        { x: 747, y: 235, radius: 35, swingX: 48, swingY: 68, phase: 1.9, speed: 0.85 },
        { x: 897, y: 475, radius: 43, swingX: 73, swingY: 45, phase: 3.1, speed: 0.61 },
        { x: 1105, y: 257, radius: 31, swingX: 33, swingY: 70, phase: 4.7, speed: 1.02 },
      ];
    }
    return [
      { x: 605, y: 235, radius: 34, swingX: 48, swingY: 82, phase: 0.9, speed: 0.7 },
      { x: 570, y: 492, radius: 37, swingX: 85, swingY: 42, phase: 2.8, speed: 0.9 },
      { x: 955, y: 361, radius: 43, swingX: 36, swingY: 84, phase: 4.2, speed: 0.62 },
      { x: 270, y: 366, radius: 29, swingX: 48, swingY: 45, phase: 5.7, speed: 1.04 },
    ];
  }

  function resizeCanvas() {
    const rect = canvas.getBoundingClientRect();
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    const pixelWidth = Math.max(1, Math.round(rect.width * ratio));
    const pixelHeight = Math.max(1, Math.round(rect.height * ratio));
    if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
      canvas.width = pixelWidth;
      canvas.height = pixelHeight;
    }
  }

  function showPanel(config) {
    currentPanel = config;
    overlayKicker.textContent = config.kicker || "THE DEEP-SKY POST · FIELD NOTE 04";
    overlayTitle.textContent = config.title || "";
    overlayCopy.textContent = config.copy || "";
    overlayDetails.innerHTML = config.details || "";
    overlayFootnote.textContent = config.footnote || "ARROW KEYS OR WASD · ESC TO PAUSE";
    primaryLabel.textContent = config.primary || "CONTINUE";
    secondaryButton.textContent = config.secondary || "";
    secondaryButton.hidden = !config.secondary;
    overlay.hidden = false;
    overlay.classList.remove("is-hidden");
    overlay.setAttribute("aria-label", config.dialogLabel || config.title || "Game information");
    primaryButton.focus({ preventScroll: true });
  }

  function hidePanel() {
    currentPanel = null;
    overlay.hidden = true;
  }

  function showTitle() {
    state.mode = "title";
    state.stage = 1;
    state.elapsed = 0;
    state.player = createPlayer();
    state.motes = makeMotes(1);
    state.hazards = makeHazards(1);
    state.total = 5;
    state.collected = 0;
    state.health = 4;
    state.pingTime = 0;
    state.pingCooldown = 0;
    state.dashCooldown = 0;
    keys.clear();
    updateReadout();
    showPanel({
      kicker: "A SHORT PLAYABLE STORY · ABOUT 4 MIN",
      title: "THE LAST\nLIGHTHOUSE",
      copy: "The sea climbed the sky. Sola stayed behind in the last lighthouse; her daughter, Aster, sailed for a new world. Tonight their ships pass within listening range—for seven seconds. You are MOTH-4. You carry the lullaby.",
      details: titleDetails,
      primary: "CARRY THE SONG",
      footnote: "HEADPHONES OPTIONAL · ARROW KEYS OR WASD",
      dialogLabel: "The Last Lighthouse introduction",
    });
  }

  function beginStage(stage) {
    state.stage = stage;
    state.elapsed = 0;
    state.player = createPlayer();
    state.health = 4;
    state.collected = 0;
    state.total = stage === 1 ? 5 : stage === 2 ? 4 : 8;
    state.score = 0;
    state.pingTime = 0;
    state.pingCooldown = 0;
    state.dashCooldown = 0;
    state.motes = makeMotes(stage === 1 ? 1 : 2);
    state.hazards = makeHazards(stage === 1 ? 1 : 2);
    state.beatResults = [];
    state.beatAttempt = 0;
    if (stage === 3) state.bestCadence = 0;
    state.beatElapsed = 0;
    state.beatsSounded = new Set();
    state.shake = 0;
    particles.length = 0;
    ripples.length = 0;
    keys.clear();
    state.mode = stage === 1 ? "fly" : stage === 2 ? "echo" : "tune";
    hidePanel();
    updateReadout();
    if (state.soundOn) startAudio();
    tone(stage === 1 ? 294 : stage === 2 ? 392 : 523, 0.32, "sine", 0.13);
    canvas.focus({ preventScroll: true });
  }

  function showInterlude(nextStage) {
    state.mode = "interlude";
    state.nextStage = nextStage;
    keys.clear();
    if (nextStage === 2) {
      showPanel({
        kicker: "MOVEMENT 01 COMPLETE · THE SQUALL",
        title: "A SONG IS\nMADE OF SMALL THINGS.",
        copy: "The storm gave back five scraps of a life: rain on a tin roof, a kettle, a tune tapped against glass. The rest is sleeping underneath the world.",
        details: '<div class="detail-list"><div class="detail-row"><b>01</b><span>THE DEAD REEF is almost completely dark.</span></div><div class="detail-row"><b>02</b><span>Tap <strong>SPACE</strong> to send a sonar pulse. It shows you the way—and what is waiting in it.</span></div><div class="detail-row"><b>03</b><span>Recover four buried notes. The ship is already passing overhead.</span></div></div>',
        primary: "DESCEND INTO THE BLUE",
        footnote: "WASD / ARROWS TO STEER · SPACE TO PING",
      });
    } else {
      showPanel({
        kicker: "MOVEMENT 02 COMPLETE · THE DEAD REEF",
        title: "SOMEONE IS\nLISTENING.",
        copy: "Through the noise, a receiver has answered. It knows the lullaby—but the final note is scattered across the carrier wave.",
        details: '<div class="detail-list"><div class="detail-row"><b>01</b><span>Find the receiver frequency in the starfield.</span></div><div class="detail-row"><b>02</b><span>Press <strong>SPACE</strong> when the two rings meet. Follow the soft, steady pulse.</span></div><div class="detail-row"><b>03</b><span>Six good notes will carry the song. A missed note is never the end.</span></div></div>',
        primary: "TUNE THE LAST NOTE",
        footnote: "SPACE WHEN THE RINGS TOUCH · SOUND OPTIONAL",
      });
    }
    updateReadout();
  }

  function showEnding() {
    state.mode = "ending";
    keys.clear();
    const cadence = Math.max(state.bestCadence, state.score);
    const musicalTag = cadence >= 8 ? "THE WHOLE LULLABY" : cadence >= 6 ? "A CLEAR SIGNAL" : "A SONG, A LITTLE WEATHERED";
    const lastLine = cadence >= 8
      ? "ASTER: ‘I knew every note.’\nSOLA: ‘Then you know the way home.’"
      : "ASTER: ‘I know this song.’\nSOLA: ‘I left the light on.’\nASTER: ‘I can see it. I'm turning around.’";
    showPanel({
      kicker: "SIGNAL DELIVERED · MOTH-4, YOU MAY REST",
      title: "THE LIGHT\nWAS ANSWERED.",
      copy: "For seven seconds, two quiet worlds found the same song. Then, far beyond the drowned coast, a ship changed course and began its long way home.",
      details: `<blockquote class="story-quote">${lastLine.replaceAll("\n", "<br>")}</blockquote><div class="score-stamp"><span>✳</span> ${musicalTag} <span>·</span> ${cadence}/8 NOTES</div>`,
      primary: "FLY THE SONG AGAIN",
      footnote: "A SMALL LIGHT CAN CROSS A VERY LARGE DARK",
    });
    updateReadout();
    burst(640, 340, "#f5d28d", 50, 270);
    tone(784, 0.65, "sine", 0.15);
    window.setTimeout(() => tone(988, 0.9, "sine", 0.12), 170);
  }

  function showGameOver() {
    state.mode = "gameover";
    keys.clear();
    showPanel({
      kicker: state.stage === 1 ? "THE SQUALL GOT LOUDER" : "THE REEF WENT QUIET",
      title: "STILL HERE.\nSTILL SENDING.",
      copy: "The little light flickers, then finds its wings again. The song is safe. Take a breath and try this stretch once more.",
      details: '<div class="detail-list"><div class="detail-row"><b>↺</b><span>Your story and earlier chapters are safe. This chapter starts fresh.</span></div></div>',
      primary: "TRY THIS CHAPTER AGAIN",
      secondary: "RETURN TO THE LIGHT",
      footnote: "THERE IS NO PENALTY FOR TRYING AGAIN",
    });
    updateReadout();
  }

  function showPause() {
    if (!["fly", "echo", "tune"].includes(state.mode)) return;
    pauseFrom = state.mode;
    state.mode = "pause";
    keys.clear();
    showPanel({
      kicker: "TRANSMISSION HELD · NO RUSH",
      title: "TAKE YOUR\nTIME.",
      copy: "The receiver will wait. The sea has been here a long time.",
      details: '<div class="detail-list"><div class="detail-row"><b>⏸</b><span>Pick up exactly where you left off, or restart this chapter.</span></div></div>',
      primary: "RESUME",
      secondary: "RESTART CHAPTER",
      footnote: "PRESS ESC TO RETURN TO THE GAME",
    });
  }

  function showHelp() {
    helpFrom = state.mode;
    panelBeforeHelp = currentPanel;
    state.mode = "help";
    showPanel({
      kicker: "MOTH-4 FIELD MANUAL · ONE PAGE",
      title: "FLY BY FEEL.",
      copy: "Your little courier knows the way. Stay light on the keys, watch the space around you, and listen for the warm notes in the static.",
      details: '<div class="detail-list"><div class="detail-row"><b>01</b><span><strong>W A S D</strong> or <strong>ARROW KEYS</strong> steer in all directions.</span></div><div class="detail-row"><b>02</b><span><strong>SPACE</strong> is a quick dash in the storm, a sonar ping in the reef, and the beat in the final movement.</span></div><div class="detail-row"><b>03</b><span><strong>ESC</strong> pauses. Bumping a shadow costs one glow; the glow returns when you restart a chapter.</span></div><div class="detail-row"><b>04</b><span>On the final screen, press Space as the two rings touch. Six of eight notes is enough.</span></div></div>',
      primary: "BACK TO THE JOURNEY",
      footnote: "SOUND IS OPTIONAL · THE GAME IS FULLY PLAYABLE SILENT",
    });
  }

  function returnFromHelp() {
    state.mode = helpFrom;
    if (["fly", "echo", "tune"].includes(helpFrom)) {
      hidePanel();
      canvas.focus({ preventScroll: true });
      return;
    }
    if (helpFrom === "pause") {
      state.mode = "pause";
      if (panelBeforeHelp) showPanel(panelBeforeHelp);
      return;
    }
    if (panelBeforeHelp) showPanel(panelBeforeHelp);
    else showTitle();
  }

  function handlePrimary() {
    switch (state.mode) {
      case "title":
        beginStage(1);
        break;
      case "interlude":
        beginStage(state.nextStage);
        break;
      case "pause":
        state.mode = pauseFrom;
        hidePanel();
        canvas.focus({ preventScroll: true });
        break;
      case "help":
        returnFromHelp();
        break;
      case "gameover":
        beginStage(state.stage);
        break;
      case "ending":
        showTitle();
        break;
      default:
        break;
    }
  }

  function handleSecondary() {
    if (state.mode === "pause") {
      beginStage(state.stage);
    } else if (state.mode === "gameover") {
      showTitle();
    }
  }

  function beginDash() {
    if (state.dashCooldown > 0) return;
    const input = directionInput();
    let dx = input.x;
    let dy = input.y;
    if (dx === 0 && dy === 0) {
      dx = state.player.vx;
      dy = state.player.vy;
      const magnitude = Math.hypot(dx, dy);
      if (magnitude > 20) {
        dx /= magnitude;
        dy /= magnitude;
      } else {
        dx = 1;
        dy = 0;
      }
    }
    const magnitude = Math.hypot(dx, dy) || 1;
    state.player.dashX = dx / magnitude;
    state.player.dashY = dy / magnitude;
    state.player.dashTime = 0.22;
    state.player.invulnerable = Math.max(state.player.invulnerable, 0.36);
    state.dashCooldown = 1.18;
    burst(state.player.x - state.player.dashX * 18, state.player.y - state.player.dashY * 18, "#b4e8e8", 8, 105);
    tone(520, 0.13, "triangle", 0.075);
  }

  function triggerPing() {
    if (state.pingCooldown > 0) return;
    state.pingTime = 1.85;
    state.pingCooldown = 2.85;
    ripples.push({ x: state.player.x, y: state.player.y, radius: 12, life: 1.2, maxLife: 1.2 });
    tone(380, 0.48, "sine", 0.12);
    window.setTimeout(() => tone(570, 0.28, "sine", 0.07), 95);
  }

  function directionInput() {
    let x = 0;
    let y = 0;
    if (keys.has("arrowleft") || keys.has("a")) x -= 1;
    if (keys.has("arrowright") || keys.has("d")) x += 1;
    if (keys.has("arrowup") || keys.has("w")) y -= 1;
    if (keys.has("arrowdown") || keys.has("s")) y += 1;
    const length = Math.hypot(x, y);
    if (length > 1) { x /= length; y /= length; }
    return { x, y };
  }

  function getHazardPosition(hazard, time = state.elapsed) {
    return {
      x: hazard.x + Math.sin(time * hazard.speed + hazard.phase) * hazard.swingX,
      y: hazard.y + Math.cos(time * hazard.speed * 0.83 + hazard.phase) * hazard.swingY,
    };
  }

  function update(dt) {
    animationTime += dt;
    updateParticles(dt);
    state.shake = Math.max(0, state.shake - dt * 2.6);
    if (state.mode === "fly" || state.mode === "echo") {
      updateFlight(dt);
    } else if (state.mode === "tune") {
      updateTuning(dt);
    }
    if (state.pingTime > 0) state.pingTime = Math.max(0, state.pingTime - dt);
    if (state.pingCooldown > 0) state.pingCooldown = Math.max(0, state.pingCooldown - dt);
    if (state.dashCooldown > 0) state.dashCooldown = Math.max(0, state.dashCooldown - dt);
    for (let i = ripples.length - 1; i >= 0; i -= 1) {
      const ripple = ripples[i];
      ripple.life -= dt;
      ripple.radius += dt * 490;
      if (ripple.life <= 0) ripples.splice(i, 1);
    }
  }

  function updateFlight(dt) {
    state.elapsed += dt;
    const player = state.player;
    const input = directionInput();
    player.invulnerable = Math.max(0, player.invulnerable - dt);
    player.dashTime = Math.max(0, player.dashTime - dt);
    player.flap += dt * (player.dashTime > 0 ? 24 : 10);

    if (player.dashTime > 0) {
      player.vx = player.dashX * 790;
      player.vy = player.dashY * 790;
    } else {
      const speed = state.mode === "echo" ? 298 : 322;
      const response = Math.min(1, dt * 8.5);
      if (input.x || input.y) {
        player.vx += (input.x * speed - player.vx) * response;
        player.vy += (input.y * speed - player.vy) * response;
      } else {
        player.vx *= Math.exp(-6.5 * dt);
        player.vy *= Math.exp(-6.5 * dt);
      }
    }

    player.x = clamp(player.x + player.vx * dt, 65, WIDTH - 65);
    player.y = clamp(player.y + player.vy * dt, 105, 620);
    if (Math.random() < dt * (player.dashTime > 0 ? 47 : 10)) {
      particles.push({
        x: player.x - 9 - Math.random() * 10,
        y: player.y + (Math.random() - 0.5) * 14,
        vx: -16 - Math.random() * 34,
        vy: (Math.random() - 0.5) * 35,
        life: 0.32 + Math.random() * 0.45,
        maxLife: 0.72,
        size: 1 + Math.random() * 2.1,
        color: Math.random() > 0.4 ? "#f6d78f" : "#b2dfe3",
      });
    }

    for (const mote of state.motes) {
      if (mote.collected) continue;
      const bobY = mote.y + Math.sin(state.elapsed * 1.25 + mote.phase) * 10;
      if (distance(player.x, player.y, mote.x, bobY) < player.radius + 20) {
        mote.collected = true;
        state.collected += 1;
        state.score += 1;
        burst(mote.x, bobY, state.stage === 2 ? "#8ce2d0" : "#f1ce86", 20, 185);
        tone(450 + state.collected * 46, 0.27, "sine", 0.12);
        showCaption(mote.line);
        updateReadout();
      }
    }

    for (const hazard of state.hazards) {
      const position = getHazardPosition(hazard);
      if (distance(player.x, player.y, position.x, position.y) < hazard.radius + player.radius * 0.62) {
        if (player.invulnerable <= 0 && animationTime - state.lastHit > 0.65) {
          state.lastHit = animationTime;
          state.health -= 1;
          player.invulnerable = 1.15;
          state.shake = 0.48;
          const dx = player.x - position.x;
          const dy = player.y - position.y;
          const length = Math.hypot(dx, dy) || 1;
          player.vx += (dx / length) * 260;
          player.vy += (dy / length) * 260;
          burst(player.x, player.y, "#b4cee0", 14, 190);
          tone(145, 0.23, "triangle", 0.09);
          updateReadout();
          if (state.health <= 0) {
            showGameOver();
            return;
          }
        }
      }
    }

    if (state.collected >= state.total) {
      if (state.stage === 1) showInterlude(2);
      else showInterlude(3);
    }
  }

  const FIRST_BEAT = 1.55;
  const BEAT_SPACING = 1.14;

  function updateTuning(dt) {
    state.elapsed += dt;
    state.beatElapsed += dt;
    const beatWindow = state.beatAttempt === 0 ? 0.28 : 0.41;
    for (let index = 0; index < 8; index += 1) {
      const beatTime = FIRST_BEAT + index * BEAT_SPACING;
      if (state.beatElapsed >= beatTime && !state.beatsSounded.has(index)) {
        state.beatsSounded.add(index);
        tone(220 + (index % 4) * 55, 0.22, "sine", 0.065);
      }
      if (state.beatResults[index] == null && state.beatElapsed > beatTime + beatWindow) {
        state.beatResults[index] = "miss";
      }
    }
    if (state.beatElapsed > FIRST_BEAT + 7 * BEAT_SPACING + beatWindow + 0.15) {
      const hits = state.beatResults.filter((result) => result === "hit").length;
      state.bestCadence = Math.max(state.bestCadence, hits);
      if (hits >= 6) {
        state.score = Math.max(state.score, hits);
        showEnding();
      } else if (state.beatAttempt === 0) {
        state.beatAttempt = 1;
        state.beatElapsed = 0;
        state.beatResults = [];
        state.beatsSounded.clear();
        showCaption("The receiver is still there. Let the soft pulse lead.");
        tone(330, 0.36, "sine", 0.08);
      } else {
        state.score = Math.max(state.score, hits, 4);
        showCaption("A little weather in the song. It still made it through.");
        window.setTimeout(() => {
          if (state.mode === "tune-finishing") showEnding();
        }, 1550);
        state.mode = "tune-finishing";
      }
    }
    if (state.mode === "tune-finishing") {
      // The receiver gently fills any missing notes on the assisted final pass.
    }
  }

  function hitBeat() {
    if (state.beatElapsed < FIRST_BEAT - 0.25) return;
    const index = Math.round((state.beatElapsed - FIRST_BEAT) / BEAT_SPACING);
    if (index < 0 || index > 7 || state.beatResults[index] != null) return;
    const beatTime = FIRST_BEAT + index * BEAT_SPACING;
    const windowSize = state.beatAttempt === 0 ? 0.28 : 0.41;
    const difference = Math.abs(state.beatElapsed - beatTime);
    if (difference <= windowSize) {
      state.beatResults[index] = "hit";
      state.score = state.beatResults.filter((result) => result === "hit").length;
      state.bestCadence = Math.max(state.bestCadence, state.score);
      const playerX = 310 + index * 40;
      burst(playerX, 355 + Math.sin(index * 0.9) * 42, "#f6d68f", 11, 115);
      tone(440 + index * 38, 0.22, "triangle", 0.09);
      updateReadout();
    }
  }

  function updateParticles(dt) {
    for (let i = particles.length - 1; i >= 0; i -= 1) {
      const particle = particles[i];
      particle.life -= dt;
      particle.x += particle.vx * dt;
      particle.y += particle.vy * dt;
      particle.vx *= Math.exp(-1.2 * dt);
      particle.vy *= Math.exp(-0.7 * dt);
      if (particle.life <= 0) particles.splice(i, 1);
    }
  }

  function burst(x, y, color, count, force) {
    for (let i = 0; i < count; i += 1) {
      const angle = Math.random() * Math.PI * 2;
      const speed = force * (0.18 + Math.random() * 0.82);
      const life = 0.36 + Math.random() * 0.72;
      particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life,
        maxLife: life,
        size: 1 + Math.random() * 3,
        color,
      });
    }
  }

  function showCaption(text) {
    caption.textContent = text;
    caption.classList.add("visible");
    window.clearTimeout(captionTimeout);
    captionTimeout = window.setTimeout(() => caption.classList.remove("visible"), 2300);
  }

  function updateReadout() {
    const active = ["fly", "echo", "tune"].includes(state.mode);
    instrumentLed.classList.toggle("active", active);
    if (state.mode === "title") {
      stageReadout.textContent = "STANDBY";
      progressReadout.textContent = "AWAITING PILOT";
      controlReadout.textContent = "A SMALL STORY ABOUT MAKING IT HOME";
    } else if (state.mode === "fly" || (state.mode === "interlude" && state.stage === 1)) {
      stageReadout.textContent = "01 / THE SQUALL";
      progressReadout.textContent = `MEMORIES ${state.collected} / 5`;
      controlReadout.textContent = "WASD STEER · SPACE DASH · FIND THE WARM LIGHTS";
    } else if (state.mode === "echo" || (state.mode === "interlude" && state.stage === 2)) {
      stageReadout.textContent = "02 / THE DEAD REEF";
      progressReadout.textContent = `NOTES ${state.collected} / 4`;
      controlReadout.textContent = "WASD STEER · SPACE PING · FOLLOW THE COMPASS SEED";
    } else if (["tune", "tune-finishing"].includes(state.mode) || state.mode === "interlude") {
      stageReadout.textContent = "03 / THE CALL";
      const hits = state.beatResults.filter((result) => result === "hit").length;
      progressReadout.textContent = `GOOD NOTES ${hits} / 6`;
      controlReadout.textContent = "SPACE WHEN THE RINGS TOUCH · SIX GOOD NOTES WILL DO";
    } else if (state.mode === "ending") {
      stageReadout.textContent = "DELIVERED";
      progressReadout.textContent = "SIGNAL RECEIVED";
      controlReadout.textContent = "THE LIGHT WAS ANSWERED";
    } else if (state.mode === "gameover") {
      stageReadout.textContent = `0${state.stage} / SIGNAL HELD`;
      progressReadout.textContent = "READY WHEN YOU ARE";
      controlReadout.textContent = "NO PENALTY FOR TRYING AGAIN";
    } else {
      stageReadout.textContent = "TRANSMISSION HELD";
      progressReadout.textContent = "TAKE YOUR TIME";
      controlReadout.textContent = "ESC TO RESUME";
    }
  }

  function draw() {
    resizeCanvas();
    ctx.setTransform(canvas.width / WIDTH, 0, 0, canvas.height / HEIGHT, 0, 0);
    const shakeX = state.shake > 0 ? (Math.random() - 0.5) * state.shake * 13 : 0;
    const shakeY = state.shake > 0 ? (Math.random() - 0.5) * state.shake * 10 : 0;
    ctx.save();
    ctx.translate(shakeX, shakeY);
    drawBackdrop();
    if (state.stage === 3 || ["tune", "tune-finishing"].includes(state.mode)) {
      drawSignalScene();
    } else {
      drawFlightScene();
    }
    drawParticles();
    drawRipples();
    drawHud();
    ctx.restore();
  }

  function drawBackdrop() {
    if (state.stage === 2 || state.mode === "echo" || (state.mode === "interlude" && state.nextStage === 3)) {
      drawReefBackdrop();
    } else if (state.stage === 3 || ["tune", "tune-finishing", "ending"].includes(state.mode)) {
      drawSignalBackdrop();
    } else {
      drawStormBackdrop();
    }
  }

  function drawStormBackdrop() {
    const sky = ctx.createLinearGradient(0, 0, 0, HEIGHT);
    sky.addColorStop(0, "#07101d");
    sky.addColorStop(0.45, "#102239");
    sky.addColorStop(1, "#101d2b");
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
    const haze = ctx.createRadialGradient(970, 210, 15, 970, 210, 570);
    haze.addColorStop(0, "rgba(232,183,121,.19)");
    haze.addColorStop(0.34, "rgba(133,155,173,.09)");
    haze.addColorStop(1, "rgba(31,48,68,0)");
    ctx.fillStyle = haze;
    ctx.fillRect(430, 0, 850, 560);
    drawStars(0.82);
    drawMoon(1000, 202, 91, "#f0d7a7", "#9d9da1");
    drawStormCloud(260, 150, 0.85, 0.1, 0.33);
    drawStormCloud(818, 117, 0.65, 0.7, 0.18);
    drawLighthouse();
    drawWater(500, 0.42, "#142839", "#0c1a28");
    drawWater(564, 0.68, "#0d1d2b", "#07111e");
    drawWater(631, 0.82, "#091724", "#07101a");
    drawDistantLightPath();
  }

  function drawReefBackdrop() {
    const deep = ctx.createLinearGradient(0, 0, 0, HEIGHT);
    deep.addColorStop(0, "#061a25");
    deep.addColorStop(0.45, "#082230");
    deep.addColorStop(1, "#071521");
    ctx.fillStyle = deep;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
    const shafts = ctx.createRadialGradient(680, 28, 8, 680, 28, 640);
    shafts.addColorStop(0, "rgba(116,207,181,.16)");
    shafts.addColorStop(1, "rgba(23,89,107,0)");
    ctx.fillStyle = shafts;
    ctx.fillRect(0, 0, WIDTH, 540);
    drawStars(0.44, true);
    for (let index = 0; index < 16; index += 1) {
      const x = ((index * 137 + 39) % (WIDTH + 100)) - 45;
      const y = 125 + ((index * 79) % 470);
      const sway = Math.sin(animationTime * 0.35 + index) * 18;
      drawKelp(x, y + 280, 0.68 + (index % 4) * 0.1, sway, index % 3 === 0 ? "#20544f" : "#123e43");
    }
    drawReefShelf(0, 644, 0.95, "#0c2c32");
    drawReefShelf(1280, 677, -1.1, "#0b2931");
    drawCoral(180, 625, 1.05, "#1d5551");
    drawCoral(1130, 640, 0.84, "#17494c");
    drawWater(575, 0.17, "rgba(14,66,73,.48)", "rgba(7,23,34,.8)");
  }

  function drawSignalBackdrop() {
    const sky = ctx.createLinearGradient(0, 0, 0, HEIGHT);
    sky.addColorStop(0, "#090d20");
    sky.addColorStop(0.52, "#17223b");
    sky.addColorStop(1, "#302738");
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
    const sunrise = ctx.createRadialGradient(870, 476, 5, 870, 476, 490);
    sunrise.addColorStop(0, "rgba(238,178,118,.25)");
    sunrise.addColorStop(0.36, "rgba(152,116,133,.1)");
    sunrise.addColorStop(1, "rgba(100,90,128,0)");
    ctx.fillStyle = sunrise;
    ctx.fillRect(400, 130, 880, 560);
    drawStars(0.98);
    drawMoon(225, 145, 54, "#c6d3d8", "#878b9c");
    drawWater(526, 0.26, "#263047", "#172033");
    drawWater(610, 0.35, "#1a2030", "#111825");
    drawDistantLightPath();
    drawCarrierShip();
  }

  function drawStars(speed, underwater = false) {
    ctx.save();
    for (const star of stars) {
      const x = wrap(star.x - animationTime * star.drift * speed, WIDTH);
      const y = (star.y + Math.sin(animationTime * 0.28 + star.phase) * 2.4) % (HEIGHT * 0.83);
      const twinkle = 0.62 + Math.sin(animationTime * 1.7 + star.phase) * 0.25;
      ctx.globalAlpha = star.alpha * twinkle * (underwater ? 0.58 : 1);
      ctx.fillStyle = star.warm ? "#e8c88d" : underwater ? "#9cd5ce" : "#c7d6e2";
      ctx.beginPath();
      ctx.arc(x, y, star.size, 0, Math.PI * 2);
      ctx.fill();
      if (star.size > 1.8) {
        ctx.globalAlpha *= 0.48;
        ctx.fillRect(x - 6, y - 0.45, 12, 0.9);
        ctx.fillRect(x - 0.45, y - 6, 0.9, 12);
      }
    }
    ctx.restore();
  }

  function drawMoon(x, y, radius, bright, shade) {
    ctx.save();
    ctx.shadowColor = bright;
    ctx.shadowBlur = 48;
    const moon = ctx.createRadialGradient(x - radius * 0.3, y - radius * 0.36, 2, x, y, radius * 1.14);
    moon.addColorStop(0, bright);
    moon.addColorStop(0.63, shade);
    moon.addColorStop(1, "rgba(91,112,129,.2)");
    ctx.fillStyle = moon;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.globalAlpha = 0.16;
    ctx.fillStyle = "#574b48";
    for (const crater of [[-0.29, -0.18, .12], [.22, .19, .17], [-.01, .38, .07], [.42, -.22, .06]]) {
      ctx.beginPath();
      ctx.arc(x + crater[0] * radius, y + crater[1] * radius, crater[2] * radius, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  function drawStormCloud(x, y, scale, phase, alpha) {
    ctx.save();
    ctx.translate(x, y + Math.sin(animationTime * 0.28 + phase) * 8);
    ctx.scale(scale, scale);
    ctx.globalAlpha = alpha;
    ctx.shadowColor = "#64829a";
    ctx.shadowBlur = 24;
    ctx.fillStyle = "#263b51";
    ctx.beginPath();
    ctx.ellipse(-26, 9, 43, 23, 0, 0, Math.PI * 2);
    ctx.ellipse(10, -3, 34, 30, 0, 0, Math.PI * 2);
    ctx.ellipse(45, 10, 38, 22, 0, 0, Math.PI * 2);
    ctx.ellipse(4, 16, 78, 18, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha *= 0.36;
    ctx.strokeStyle = "#8aa6b6";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(-65, 15);
    ctx.quadraticCurveTo(-12, 31, 68, 13);
    ctx.stroke();
    ctx.restore();
  }

  function drawLighthouse() {
    const towerX = 1075;
    const lensY = 380;
    const beamPhase = Math.sin(animationTime * 0.22) * 0.22;
    ctx.save();
    ctx.globalCompositeOperation = "screen";
    ctx.translate(towerX, lensY);
    ctx.rotate(beamPhase - 0.16);
    const beam = ctx.createLinearGradient(0, 0, -690, 0);
    beam.addColorStop(0, "rgba(255,218,150,.19)");
    beam.addColorStop(1, "rgba(255,216,149,0)");
    ctx.fillStyle = beam;
    ctx.beginPath();
    ctx.moveTo(-1, -7);
    ctx.lineTo(-715, -124);
    ctx.lineTo(-715, 139);
    ctx.lineTo(-1, 7);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    ctx.save();
    ctx.fillStyle = "#091421";
    ctx.beginPath();
    ctx.moveTo(991, 550);
    ctx.lineTo(1013, 409);
    ctx.lineTo(1030, 389);
    ctx.lineTo(1113, 389);
    ctx.lineTo(1131, 550);
    ctx.closePath();
    ctx.fill();
    ctx.fillRect(1025, 370, 91, 23);
    ctx.fillStyle = "#0a1522";
    ctx.fillRect(1034, 352, 72, 22);
    ctx.fillRect(1029, 347, 82, 5);
    ctx.fillRect(1042, 336, 56, 11);
    ctx.fillStyle = "rgba(245,203,127,.72)";
    ctx.fillRect(1052, 357, 12, 19);
    ctx.fillRect(1081, 357, 12, 19);
    ctx.globalAlpha = 0.38;
    ctx.fillStyle = "#f4cd84";
    ctx.fillRect(1051, 408, 9, 21);
    ctx.fillRect(1082, 408, 9, 21);
    ctx.globalAlpha = 1;
    ctx.shadowColor = "#f5ce87";
    ctx.shadowBlur = 24;
    ctx.fillStyle = "#ffe5ac";
    ctx.beginPath();
    ctx.arc(1070, 360, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = "#081321";
    ctx.beginPath();
    ctx.moveTo(920, 545);
    ctx.quadraticCurveTo(1000, 519, 1080, 544);
    ctx.quadraticCurveTo(1167, 508, 1237, 547);
    ctx.lineTo(1280, 590);
    ctx.lineTo(910, 590);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  function drawDistantLightPath() {
    ctx.save();
    ctx.globalAlpha = 0.12;
    ctx.strokeStyle = "#f4d69c";
    ctx.lineWidth = 1;
    for (let index = 0; index < 3; index += 1) {
      const y = 508 + index * 18;
      ctx.beginPath();
      ctx.moveTo(0, y + Math.sin(animationTime * 0.65 + index) * 3);
      ctx.bezierCurveTo(335, y - 15, 666, y + 15, 1020, y + Math.sin(animationTime * 0.5 + index) * 6);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawWater(base, amp, topColor, bottomColor) {
    const gradient = ctx.createLinearGradient(0, base - amp, 0, HEIGHT);
    gradient.addColorStop(0, topColor);
    gradient.addColorStop(1, bottomColor);
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.moveTo(0, HEIGHT);
    ctx.lineTo(0, base);
    for (let x = 0; x <= WIDTH; x += 20) {
      const y = base + Math.sin(x * 0.009 + animationTime * 0.48) * amp * 0.34
        + Math.sin(x * 0.021 - animationTime * 0.29) * amp * 0.2;
      ctx.lineTo(x, y);
    }
    ctx.lineTo(WIDTH, HEIGHT);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    for (let x = 0; x <= WIDTH; x += 20) {
      const y = base + Math.sin(x * 0.009 + animationTime * 0.48) * amp * 0.34
        + Math.sin(x * 0.021 - animationTime * 0.29) * amp * 0.2;
      if (x === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.strokeStyle = "rgba(205,221,225,.08)";
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.save();
    ctx.globalAlpha = 0.16;
    for (let i = 0; i < 23; i += 1) {
      const x = wrap(i * 77 + animationTime * (13 + i % 4 * 5), WIDTH);
      const y = base + 18 + ((i * 41) % 120) + Math.sin(animationTime + i) * 6;
      ctx.fillStyle = i % 4 === 0 ? "#f3d79e" : "#9dc4ce";
      ctx.fillRect(x, y, 14 + (i % 5) * 4, 1);
    }
    ctx.restore();
  }

  function drawKelp(x, baseY, scale, sway, color) {
    ctx.save();
    ctx.translate(x, baseY);
    ctx.scale(scale, scale);
    ctx.strokeStyle = color;
    ctx.lineWidth = 3;
    ctx.globalAlpha = 0.7;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.bezierCurveTo(-18 + sway, -64, 25 - sway, -143, 4 + sway, -247);
    ctx.stroke();
    ctx.lineWidth = 1.4;
    for (let index = 0; index < 5; index += 1) {
      const y = -42 - index * 38;
      const side = index % 2 === 0 ? 1 : -1;
      ctx.beginPath();
      ctx.moveTo(Math.sin(index + animationTime * 0.35) * 10, y);
      ctx.quadraticCurveTo(side * 42, y - 25, side * 54, y - 57);
      ctx.stroke();
      ctx.beginPath();
      ctx.ellipse(side * 41, y - 35, 13, 4, side * 0.55, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawReefShelf(x, y, direction, color) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(direction, 1);
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(0, 95);
    ctx.lineTo(0, 0);
    ctx.quadraticCurveTo(38, -16, 60, 20);
    ctx.quadraticCurveTo(92, -7, 118, 35);
    ctx.quadraticCurveTo(149, 18, 176, 58);
    ctx.lineTo(205, 100);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  function drawCoral(x, y, scale, color) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(scale, scale);
    ctx.strokeStyle = color;
    ctx.lineCap = "round";
    ctx.lineWidth = 8;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(0, -76);
    ctx.moveTo(0, -34);
    ctx.lineTo(-29, -58);
    ctx.moveTo(0, -48);
    ctx.lineTo(27, -74);
    ctx.moveTo(-29, -58);
    ctx.lineTo(-30, -78);
    ctx.moveTo(27, -74);
    ctx.lineTo(47, -86);
    ctx.stroke();
    ctx.globalAlpha = 0.48;
    ctx.strokeStyle = "#79b79e";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(4, -5);
    ctx.quadraticCurveTo(8, -39, 3, -69);
    ctx.stroke();
    ctx.restore();
  }

  function drawCarrierShip() {
    ctx.save();
    ctx.translate(947, 257);
    ctx.rotate(-0.18);
    ctx.globalAlpha = 0.62;
    ctx.shadowColor = "#eac990";
    ctx.shadowBlur = 34;
    ctx.fillStyle = "#172030";
    ctx.beginPath();
    ctx.moveTo(-250, 15);
    ctx.quadraticCurveTo(-78, -31, 225, -7);
    ctx.lineTo(281, 3);
    ctx.lineTo(235, 18);
    ctx.quadraticCurveTo(-50, 55, -250, 15);
    ctx.closePath();
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = "rgba(244,218,166,.6)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(-240, 11);
    ctx.quadraticCurveTo(-55, -28, 267, 4);
    ctx.stroke();
    ctx.fillStyle = "rgba(244,208,143,.78)";
    for (let index = 0; index < 11; index += 1) {
      ctx.beginPath();
      ctx.arc(-142 + index * 31, 13 + Math.sin(index * 0.4) * 2, index % 3 === 0 ? 2.2 : 1.2, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 0.26;
    ctx.strokeStyle = "#d6b77f";
    ctx.beginPath();
    ctx.moveTo(-95, -2);
    ctx.lineTo(-70, -72);
    ctx.lineTo(65, -72);
    ctx.lineTo(98, -1);
    ctx.stroke();
    ctx.beginPath();
    ctx.ellipse(15, 10, 282, 75 + Math.sin(animationTime * 0.35) * 3, -0.04, Math.PI, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  function drawFlightScene() {
    if (state.stage === 2 || state.mode === "echo") {
      drawEchoCreatures();
    } else {
      drawMotes();
      drawStorms();
    }
    if (state.mode === "echo") applySonarDarkness();
    drawMoth(state.player.x, state.player.y, state.player.flap, state.player.invulnerable > 0);
    drawTargetCompass();
  }

  function drawMotes() {
    for (const mote of state.motes) {
      if (mote.collected) continue;
      const y = mote.y + Math.sin(state.elapsed * 1.25 + mote.phase) * 10;
      const pulse = 1 + Math.sin(animationTime * 2.2 + mote.phase) * 0.13;
      ctx.save();
      ctx.translate(mote.x, y);
      ctx.rotate(Math.sin(animationTime * 0.62 + mote.phase) * 0.2);
      ctx.shadowColor = state.stage === 2 ? "#8fe3d1" : "#f4ca7b";
      ctx.shadowBlur = 25;
      ctx.globalAlpha = 0.32 + pulse * 0.17;
      ctx.strokeStyle = state.stage === 2 ? "#8fe3d1" : "#f4ca7b";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(0, 0, 21 * pulse, animationTime * 0.3, animationTime * 0.3 + Math.PI * 1.45);
      ctx.stroke();
      ctx.globalAlpha = 1;
      ctx.fillStyle = state.stage === 2 ? "#adf4df" : "#ffe4a6";
      ctx.beginPath();
      ctx.moveTo(0, -10);
      ctx.quadraticCurveTo(10, -2, 0, 12);
      ctx.quadraticCurveTo(-10, -2, 0, -10);
      ctx.fill();
      ctx.fillStyle = "rgba(255,255,255,.75)";
      ctx.beginPath();
      ctx.arc(-2, -3, 2.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  function drawStorms() {
    for (let index = 0; index < state.hazards.length; index += 1) {
      const hazard = state.hazards[index];
      const position = getHazardPosition(hazard);
      drawHazardCloud(position.x, position.y, hazard.radius, state.elapsed + index);
    }
  }

  function drawHazardCloud(x, y, radius, time) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(Math.sin(time * 0.45) * 0.08);
    const scale = radius / 40;
    ctx.scale(scale, scale);
    ctx.shadowColor = "rgba(54,94,124,.45)";
    ctx.shadowBlur = 24;
    ctx.fillStyle = "rgba(11,24,40,.9)";
    ctx.beginPath();
    ctx.ellipse(-22, 3, 27, 19, -0.15, 0, Math.PI * 2);
    ctx.ellipse(3, -8, 27, 27, 0, 0, Math.PI * 2);
    ctx.ellipse(26, 4, 25, 18, 0.18, 0, Math.PI * 2);
    ctx.ellipse(2, 12, 51, 17, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.globalAlpha = 0.32;
    ctx.strokeStyle = "#89a9bf";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(-42, 12);
    ctx.quadraticCurveTo(-4, 25, 43, 9);
    ctx.stroke();
    if (Math.sin(time * 1.6) > 0.88) {
      ctx.globalAlpha = 0.8;
      ctx.strokeStyle = "#b9d3d7";
      ctx.shadowColor = "#c8e2e3";
      ctx.shadowBlur = 10;
      ctx.beginPath();
      ctx.moveTo(8, 14);
      ctx.lineTo(2, 26);
      ctx.lineTo(8, 27);
      ctx.lineTo(-1, 40);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawEchoCreatures() {
    drawMotes();
    for (let index = 0; index < state.hazards.length; index += 1) {
      const hazard = state.hazards[index];
      const position = getHazardPosition(hazard);
      drawReefHazard(position.x, position.y, hazard.radius, state.elapsed, index);
    }
  }

  function drawReefHazard(x, y, radius, time, index) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(time * (index % 2 === 0 ? 0.25 : -0.2));
    ctx.shadowColor = "#4ec7b4";
    ctx.shadowBlur = 16;
    ctx.fillStyle = "rgba(6,18,29,.96)";
    ctx.beginPath();
    ctx.arc(0, 0, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = "rgba(112,215,190,.74)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let spike = 0; spike < 12; spike += 1) {
      const angle = (spike / 12) * Math.PI * 2;
      const r = spike % 2 === 0 ? radius + 12 : radius + 2;
      const sx = Math.cos(angle) * r;
      const sy = Math.sin(angle) * r;
      if (spike === 0) ctx.moveTo(sx, sy); else ctx.lineTo(sx, sy);
    }
    ctx.closePath();
    ctx.stroke();
    ctx.fillStyle = "#d2edbe";
    ctx.beginPath();
    ctx.arc(0, 0, 4 + Math.sin(time * 3 + index) * 1.1, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function applySonarDarkness() {
    ctx.save();
    const radius = state.pingTime > 0 ? 650 : 315;
    const vision = ctx.createRadialGradient(state.player.x, state.player.y, 5, state.player.x, state.player.y, radius);
    vision.addColorStop(0, "rgba(2,8,18,0)");
    if (state.pingTime > 0) {
      vision.addColorStop(0.72, "rgba(2,9,20,.035)");
      vision.addColorStop(1, "rgba(2,9,20,.2)");
    } else {
      vision.addColorStop(0.68, "rgba(2,8,18,.05)");
      vision.addColorStop(1, "rgba(2,8,18,.88)");
    }
    ctx.fillStyle = vision;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
    ctx.restore();
    if (state.pingTime > 0) {
      ctx.save();
      ctx.globalCompositeOperation = "screen";
      const halo = ctx.createRadialGradient(state.player.x, state.player.y, 30, state.player.x, state.player.y, 650);
      halo.addColorStop(0, "rgba(88,221,197,.14)");
      halo.addColorStop(0.66, "rgba(74,193,179,.06)");
      halo.addColorStop(1, "rgba(67,176,168,0)");
      ctx.fillStyle = halo;
      ctx.fillRect(0, 0, WIDTH, HEIGHT);
      ctx.restore();
    }
  }

  function drawMoth(x, y, flap, flicker = false) {
    const speedAngle = clamp(state.player.vy * 0.00045, -0.22, 0.22);
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(speedAngle);
    if (flicker && Math.sin(animationTime * 34) > 0.35) ctx.globalAlpha = 0.38;
    const glow = ctx.createRadialGradient(4, 0, 2, 3, 0, 61);
    glow.addColorStop(0, "rgba(255,230,173,.82)");
    glow.addColorStop(0.24, "rgba(245,204,131,.25)");
    glow.addColorStop(1, "rgba(245,204,131,0)");
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(0, 0, 61, 0, Math.PI * 2);
    ctx.fill();

    const wingBeat = Math.sin(flap) * 0.16;
    for (const side of [-1, 1]) {
      ctx.save();
      ctx.scale(1, side);
      ctx.rotate(wingBeat * side);
      const upper = ctx.createLinearGradient(-5, -3, -72, -43);
      upper.addColorStop(0, "rgba(255,233,189,.94)");
      upper.addColorStop(0.55, "rgba(199,185,155,.84)");
      upper.addColorStop(1, "rgba(114,149,163,.58)");
      ctx.fillStyle = upper;
      ctx.strokeStyle = "rgba(246,228,187,.5)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(-4, -5);
      ctx.bezierCurveTo(-19, -28, -31, -55, -65, -52);
      ctx.bezierCurveTo(-88, -49, -75, -13, -51, -3);
      ctx.bezierCurveTo(-34, 4, -18, 5, -4, 6);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.strokeStyle = "rgba(255,241,207,.48)";
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      ctx.moveTo(-9, -5);
      ctx.quadraticCurveTo(-42, -23, -68, -46);
      ctx.moveTo(-12, -2);
      ctx.quadraticCurveTo(-55, -9, -76, -17);
      ctx.moveTo(-19, -3);
      ctx.quadraticCurveTo(-33, -28, -38, -48);
      ctx.stroke();
      ctx.fillStyle = "rgba(219,169,116,.38)";
      ctx.beginPath();
      ctx.ellipse(-55, -28, 7, 12, -0.45, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = "rgba(214,221,199,.9)";
      ctx.beginPath();
      ctx.moveTo(-6, 2);
      ctx.bezierCurveTo(-28, 2, -42, 14, -40, 26);
      ctx.bezierCurveTo(-25, 22, -13, 16, -4, 7);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = "rgba(245,231,197,.4)";
      ctx.beginPath();
      ctx.moveTo(-10, 6);
      ctx.quadraticCurveTo(-28, 14, -39, 24);
      ctx.stroke();
      ctx.restore();
    }

    ctx.save();
    ctx.fillStyle = "#bd9e70";
    ctx.beginPath();
    ctx.ellipse(-5, 4, 6, 16, -0.18, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#ffe4a4";
    ctx.shadowColor = "#ffe0a1";
    ctx.shadowBlur = 16;
    ctx.beginPath();
    ctx.arc(5, -1, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = "#3c3732";
    ctx.beginPath();
    ctx.arc(8, -3, 1.15, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "rgba(245,223,179,.68)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(6, -7);
    ctx.quadraticCurveTo(10, -19, 18, -18);
    ctx.moveTo(8, -7);
    ctx.quadraticCurveTo(16, -16, 22, -13);
    ctx.stroke();
    ctx.restore();

    ctx.save();
    ctx.globalCompositeOperation = "screen";
    const beam = ctx.createLinearGradient(14, 0, 116, 0);
    beam.addColorStop(0, "rgba(255,228,166,.14)");
    beam.addColorStop(1, "rgba(255,228,166,0)");
    ctx.fillStyle = beam;
    ctx.beginPath();
    ctx.moveTo(12, -3);
    ctx.lineTo(114, -29);
    ctx.lineTo(114, 29);
    ctx.lineTo(12, 3);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    ctx.restore();
  }

  function drawTargetCompass() {
    const target = state.motes.find((mote) => !mote.collected);
    if (!target || state.mode === "title" || state.mode === "interlude") return;
    const dx = target.x - state.player.x;
    const dy = target.y - state.player.y;
    const angle = Math.atan2(dy, dx);
    const compassX = 1193;
    const compassY = 651;
    ctx.save();
    ctx.globalAlpha = 0.75;
    ctx.fillStyle = "rgba(8,15,25,.7)";
    ctx.beginPath();
    ctx.arc(compassX, compassY, 22, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "rgba(219,229,226,.22)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(compassX, compassY, 22, 0, Math.PI * 2);
    ctx.stroke();
    ctx.translate(compassX, compassY);
    ctx.rotate(angle);
    ctx.fillStyle = state.stage === 2 ? "#8fe3d1" : "#f1ce86";
    ctx.beginPath();
    ctx.moveTo(13, 0);
    ctx.lineTo(-7, -6);
    ctx.lineTo(-3, 0);
    ctx.lineTo(-7, 6);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  function drawSignalScene() {
    drawSignalThreads();
    const centerX = 640;
    const centerY = 363;
    drawTuningRings(centerX, centerY);
    drawMoth(306, 362 + Math.sin(animationTime * 0.9) * 14, animationTime * 10, false);
    drawReceiver(centerX, centerY, animationTime);
    drawBeatConstellation();
  }

  function drawSignalThreads() {
    const strength = clamp(state.bestCadence / 8, 0.15, 1);
    ctx.save();
    ctx.globalCompositeOperation = "screen";
    for (let strand = 0; strand < 6; strand += 1) {
      ctx.beginPath();
      const phase = strand * 0.72 + animationTime * (0.42 + strand * 0.012);
      for (let x = 320; x <= 968; x += 12) {
        const progress = (x - 320) / 648;
        const y = 362 + Math.sin(progress * 13 + phase) * (10 + 12 * (1 - strength)) * Math.sin(progress * Math.PI);
        if (x === 320) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.strokeStyle = strand % 2 === 0 ? `rgba(244,204,130,${0.11 + strength * 0.13})` : `rgba(142,208,211,${0.08 + strength * 0.1})`;
      ctx.lineWidth = strand === 1 ? 1.5 : 0.7;
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawTuningRings(x, y) {
    const period = 1.14;
    const elapsed = state.beatElapsed;
    let untilBeat;
    if (elapsed < FIRST_BEAT) {
      untilBeat = FIRST_BEAT - elapsed;
    } else {
      const phase = ((elapsed - FIRST_BEAT) % period + period) % period;
      untilBeat = Math.min(phase, period - phase);
    }
    const distanceToCenter = clamp(untilBeat / (period / 2), 0, 1);
    const outerRadius = 57 + distanceToCenter * 126;
    ctx.save();
    ctx.translate(x, y);
    const pulse = Math.max(0, 1 - untilBeat / 0.15);
    ctx.shadowColor = `rgba(243,204,135,${0.5 + pulse * 0.5})`;
    ctx.shadowBlur = 18 + pulse * 30;
    ctx.strokeStyle = `rgba(242,207,145,${0.45 + pulse * 0.48})`;
    ctx.lineWidth = 1.3 + pulse * 2;
    ctx.beginPath();
    ctx.arc(0, 0, outerRadius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = "rgba(204,225,224,.28)";
    ctx.lineWidth = 1;
    ctx.setLineDash([2, 7]);
    ctx.beginPath();
    ctx.arc(0, 0, 79, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = "rgba(9,16,27,.73)";
    ctx.beginPath();
    ctx.arc(0, 0, 56, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = `rgba(243,205,137,${0.48 + pulse * 0.42})`;
    ctx.lineWidth = 1.1;
    ctx.beginPath();
    ctx.arc(0, 0, 55, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = "rgba(243,212,160,.78)";
    ctx.font = "9px ui-monospace, SFMono-Regular, Menlo, monospace";
    ctx.textAlign = "center";
    ctx.fillText("TUNE", 0, 3);
    ctx.restore();
  }

  function drawReceiver(x, y, time) {
    ctx.save();
    ctx.translate(x + 327, y + Math.sin(time * 0.52) * 5);
    ctx.rotate(-0.07);
    ctx.globalAlpha = 0.85;
    ctx.strokeStyle = "rgba(216,228,216,.48)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(-36, -10);
    ctx.lineTo(33, -2);
    ctx.lineTo(38, 3);
    ctx.lineTo(-26, 12);
    ctx.closePath();
    ctx.fillStyle = "rgba(25,35,48,.9)";
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-5, -10);
    ctx.lineTo(5, -58);
    ctx.lineTo(17, -10);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(6, -59, 4, 0, Math.PI * 2);
    ctx.fillStyle = "#ffe6b2";
    ctx.shadowColor = "#ffe4ac";
    ctx.shadowBlur = 18;
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = "rgba(234,220,189,.33)";
    for (let ring = 0; ring < 3; ring += 1) {
      ctx.beginPath();
      ctx.ellipse(6, -60, 16 + ring * 12 + Math.sin(time * 2 + ring) * 4, 7 + ring * 4, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawBeatConstellation() {
    const beatCount = 8;
    const hits = state.beatResults.filter((result) => result === "hit").length;
    const centerX = 640;
    const centerY = 363;
    for (let index = 0; index < beatCount; index += 1) {
      const angle = -Math.PI * 0.8 + (index / (beatCount - 1)) * Math.PI * 1.6;
      const radius = 242;
      const x = centerX + Math.cos(angle) * radius;
      const y = centerY + Math.sin(angle) * radius * 0.72;
      const result = state.beatResults[index];
      const isNext = state.beatElapsed >= FIRST_BEAT - 0.7
        && index === clamp(Math.round((state.beatElapsed - FIRST_BEAT) / BEAT_SPACING), 0, 7)
        && result == null;
      ctx.save();
      ctx.shadowColor = result === "hit" || isNext ? "#f3cf8a" : "transparent";
      ctx.shadowBlur = result === "hit" ? 18 : isNext ? 9 : 0;
      ctx.fillStyle = result === "hit" ? "#ffe4a6" : result === "miss" ? "rgba(128,141,151,.48)" : isNext ? "#d8d3bc" : "rgba(174,194,199,.56)";
      ctx.beginPath();
      ctx.arc(x, y, result === "hit" ? 5.5 : isNext ? 4.2 : 3, 0, Math.PI * 2);
      ctx.fill();
      if (result === "hit") {
        ctx.strokeStyle = "rgba(246,217,158,.55)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(x, y, 12 + Math.sin(animationTime * 3 + index) * 2, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.restore();
    }

    ctx.save();
    ctx.textAlign = "center";
    ctx.fillStyle = "rgba(221,226,223,.67)";
    ctx.font = "10px ui-monospace, SFMono-Regular, Menlo, monospace";
    ctx.fillText(`MEMORY ${String(hits).padStart(2, "0")} / 06`, centerX, 567);
    ctx.fillStyle = "rgba(169,181,187,.53)";
    ctx.font = "8px ui-monospace, SFMono-Regular, Menlo, monospace";
    ctx.fillText(state.beatAttempt > 0 ? "THE CARRIER WAVE IS HELPING YOU" : "WAIT FOR THE LIGHTS TO MEET", centerX, 585);
    ctx.restore();
  }

  function drawParticles() {
    ctx.save();
    ctx.globalCompositeOperation = "screen";
    for (const particle of particles) {
      const alpha = clamp(particle.life / particle.maxLife, 0, 1);
      ctx.globalAlpha = alpha;
      ctx.fillStyle = particle.color;
      ctx.shadowColor = particle.color;
      ctx.shadowBlur = particle.size * 4;
      ctx.beginPath();
      ctx.arc(particle.x, particle.y, particle.size * (0.5 + alpha * 0.6), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  function drawRipples() {
    ctx.save();
    for (const ripple of ripples) {
      ctx.globalAlpha = clamp(ripple.life / ripple.maxLife, 0, 1) * 0.65;
      ctx.strokeStyle = "#92eddd";
      ctx.shadowColor = "#5ddacb";
      ctx.shadowBlur = 16;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(ripple.x, ripple.y, ripple.radius, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha *= 0.48;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(ripple.x, ripple.y, ripple.radius * 0.7, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawHud() {
    if (!["fly", "echo", "tune", "tune-finishing"].includes(state.mode)) return;
    ctx.save();
    ctx.fillStyle = "rgba(5,12,22,.54)";
    ctx.strokeStyle = "rgba(217,229,235,.13)";
    ctx.lineWidth = 1;
    roundedPanel(30, 25, 305, 54, 5);
    const chapter = state.stage === 1 ? "I  /  THE SQUALL" : state.stage === 2 ? "II  /  THE DEAD REEF" : "III  /  THE CALL";
    ctx.textAlign = "left";
    ctx.fillStyle = "#f1d49b";
    ctx.font = "700 10px ui-monospace, SFMono-Regular, Menlo, monospace";
    ctx.fillText(chapter, 47, 47);
    ctx.fillStyle = "rgba(202,215,224,.62)";
    ctx.font = "8px ui-monospace, SFMono-Regular, Menlo, monospace";
    const rightText = state.stage === 1 ? "GATHER THE MEMORY LIGHTS" : state.stage === 2 ? "ASK THE DARK TO ANSWER" : "SEVEN SECONDS TO BE HEARD";
    ctx.fillText(rightText, 47, 64);

    if (state.stage < 3) {
      roundedPanel(967, 25, 280, 54, 5);
      ctx.fillStyle = "rgba(197,211,219,.63)";
      ctx.font = "8px ui-monospace, SFMono-Regular, Menlo, monospace";
      ctx.fillText(state.stage === 1 ? "LANTERN INTEGRITY" : "SONAR RETURN", 985, 45);
      if (state.stage === 1) {
        for (let i = 0; i < 4; i += 1) {
          ctx.fillStyle = i < state.health ? "#f1cd8a" : "rgba(159,174,186,.2)";
          ctx.shadowColor = i < state.health ? "#f1cd8a" : "transparent";
          ctx.shadowBlur = i < state.health ? 8 : 0;
          ctx.beginPath();
          ctx.arc(987 + i * 21, 61, 4, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.shadowBlur = 0;
        ctx.textAlign = "right";
        ctx.fillStyle = "rgba(202,215,224,.76)";
        ctx.fillText(`${state.collected} / ${state.total} FOUND`, 1228, 64);
      } else {
        ctx.textAlign = "left";
        ctx.fillStyle = state.pingCooldown <= 0 ? "#9be4d2" : "rgba(161,185,192,.58)";
        ctx.fillText(state.pingCooldown <= 0 ? "SPACE  ·  PING READY" : `RECHARGING  ·  ${state.pingCooldown.toFixed(1)}s`, 985, 64);
        ctx.fillStyle = "rgba(202,215,224,.48)";
        ctx.fillText("GLOW", 1103, 64);
        for (let i = 0; i < 4; i += 1) {
          ctx.fillStyle = i < state.health ? "#91dec9" : "rgba(159,174,186,.2)";
          ctx.shadowColor = i < state.health ? "#91dec9" : "transparent";
          ctx.shadowBlur = i < state.health ? 7 : 0;
          ctx.beginPath();
          ctx.arc(1152 + i * 18, 61, 3.5, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.shadowBlur = 0;
        ctx.textAlign = "right";
        ctx.fillStyle = "rgba(202,215,224,.76)";
        ctx.fillText(`${state.collected} / ${state.total} FOUND`, 1228, 45);
      }
      const progress = state.collected / state.total;
      ctx.fillStyle = "rgba(220,230,236,.08)";
      ctx.fillRect(985, 70, 242, 2);
      ctx.fillStyle = state.stage === 2 ? "#89ddc8" : "#efca83";
      ctx.fillRect(985, 70, 242 * progress, 2);
    } else {
      roundedPanel(967, 25, 280, 54, 5);
      ctx.fillStyle = "rgba(197,211,219,.63)";
      ctx.font = "8px ui-monospace, SFMono-Regular, Menlo, monospace";
      ctx.fillText("THE LAST CARRIER WAVE", 985, 45);
      const hits = state.beatResults.filter((result) => result === "hit").length;
      ctx.fillStyle = "#f1d49b";
      ctx.font = "10px ui-monospace, SFMono-Regular, Menlo, monospace";
      ctx.fillText(`${String(hits).padStart(2, "0")} / 06 NOTES TO CARRY`, 985, 64);
      ctx.fillStyle = "rgba(220,230,236,.08)";
      ctx.fillRect(985, 70, 242, 2);
      ctx.fillStyle = "#efca83";
      ctx.fillRect(985, 70, 242 * clamp(hits / 6, 0, 1), 2);
    }

    roundedPanel(30, 657, 360, 35, 4);
    ctx.fillStyle = "rgba(220,229,231,.73)";
    ctx.font = "8px ui-monospace, SFMono-Regular, Menlo, monospace";
    ctx.fillText(state.stage === 1 ? "W A S D  STEER   ·   SPACE  DASH" : state.stage === 2 ? "W A S D  STEER   ·   SPACE  PING" : "SPACE  WHEN THE RINGS TOUCH", 46, 678);
    ctx.fillStyle = "rgba(191,204,211,.48)";
    ctx.textAlign = "right";
    ctx.fillText(state.stage === 3 ? "MISSED NOTES COME BACK AROUND" : "ESC  PAUSE", 376, 678);
    ctx.restore();
  }

  function roundedPanel(x, y, width, height, radius) {
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + width - radius, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
    ctx.lineTo(x + width, y + height - radius);
    ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
    ctx.lineTo(x + radius, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }

  function ensureAudio() {
    if (audioContext) {
      if (audioContext.state === "suspended") audioContext.resume();
      return;
    }
    const AudioContextConstructor = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextConstructor) return;
    try {
      audioContext = new AudioContextConstructor();
      masterGain = audioContext.createGain();
      masterGain.gain.value = state.soundOn ? 0.17 : 0;
      masterGain.connect(audioContext.destination);
      const low = audioContext.createOscillator();
      const lowGain = audioContext.createGain();
      low.type = "sine";
      low.frequency.value = 55;
      lowGain.gain.value = 0.09;
      low.connect(lowGain);
      lowGain.connect(masterGain);
      low.start();
      const high = audioContext.createOscillator();
      const highGain = audioContext.createGain();
      high.type = "sine";
      high.frequency.value = 82.41;
      highGain.gain.value = 0.025;
      high.connect(highGain);
      highGain.connect(masterGain);
      high.start();
    } catch (_error) {
      audioContext = null;
      masterGain = null;
    }
  }

  function startAudio() {
    if (!state.soundOn) return;
    ensureAudio();
    if (masterGain && audioContext) {
      masterGain.gain.setTargetAtTime(0.17, audioContext.currentTime, 0.12);
      if (audioContext.state === "suspended") audioContext.resume();
    }
  }

  function tone(frequency, duration, type = "sine", volume = 0.1) {
    if (!state.soundOn) return;
    ensureAudio();
    if (!audioContext || !masterGain) return;
    try {
      const oscillator = audioContext.createOscillator();
      const envelope = audioContext.createGain();
      const now = audioContext.currentTime;
      oscillator.type = type;
      oscillator.frequency.setValueAtTime(frequency, now);
      envelope.gain.setValueAtTime(0.0001, now);
      envelope.gain.exponentialRampToValueAtTime(Math.max(0.001, volume), now + 0.022);
      envelope.gain.exponentialRampToValueAtTime(0.0001, now + duration);
      oscillator.connect(envelope);
      envelope.connect(masterGain);
      oscillator.start(now);
      oscillator.stop(now + duration + 0.04);
    } catch (_error) {
      // Audio is decorative; the game remains complete without it.
    }
  }

  function setSound(enabled) {
    state.soundOn = enabled;
    soundButton.setAttribute("aria-pressed", String(enabled));
    soundButton.setAttribute("aria-label", enabled ? "Sound on" : "Sound off");
    soundLabel.textContent = enabled ? "SOUND ON" : "SOUND OFF";
    if (enabled) startAudio();
    else if (masterGain && audioContext) masterGain.gain.setTargetAtTime(0, audioContext.currentTime, 0.08);
  }

  function clamp(value, min, max) { return Math.max(min, Math.min(max, value)); }
  function distance(x1, y1, x2, y2) { return Math.hypot(x2 - x1, y2 - y1); }
  function wrap(value, length) { return ((value % length) + length) % length; }

  primaryButton.addEventListener("click", handlePrimary);
  secondaryButton.addEventListener("click", handleSecondary);
  helpButton.addEventListener("click", showHelp);
  soundButton.addEventListener("click", () => setSound(!state.soundOn));

  window.addEventListener("keydown", (event) => {
    const target = event.target;
    const onButton = target instanceof HTMLElement && target.closest("button");
    if (event.code === "Escape") {
      event.preventDefault();
      if (state.mode === "pause") {
        state.mode = pauseFrom;
        hidePanel();
        canvas.focus({ preventScroll: true });
      } else if (state.mode === "help") {
        returnFromHelp();
      } else {
        showPause();
      }
      updateReadout();
      return;
    }
    if (onButton) return;

    const key = event.key.toLowerCase();
    if (["arrowleft", "arrowright", "arrowup", "arrowdown", " "].includes(key)) event.preventDefault();
    if (state.mode === "title" && (event.code === "Enter" || event.code === "Space")) {
      event.preventDefault();
      beginStage(1);
      return;
    }
    if (state.mode === "interlude" && (event.code === "Enter" || event.code === "Space")) {
      event.preventDefault();
      beginStage(state.nextStage);
      return;
    }
    if (state.mode === "ending" && (event.code === "Enter" || event.code === "Space")) {
      event.preventDefault();
      showTitle();
      return;
    }
    if (event.repeat) return;
    if (state.mode === "fly" || state.mode === "echo") {
      if (event.code === "Space") {
        if (state.mode === "fly") beginDash();
        else triggerPing();
      }
      if (["arrowleft", "arrowright", "arrowup", "arrowdown", "w", "a", "s", "d"].includes(key)) keys.add(key);
    } else if (state.mode === "tune" && event.code === "Space") {
      hitBeat();
    }
  });

  window.addEventListener("keyup", (event) => {
    keys.delete(event.key.toLowerCase());
  });
  window.addEventListener("blur", () => keys.clear());
  window.addEventListener("resize", resizeCanvas);

  function frame(now) {
    const dt = Math.min(0.04, Math.max(0, (now - lastFrame) / 1000));
    lastFrame = now;
    update(dt);
    draw();
    requestAnimationFrame(frame);
  }

  resizeCanvas();
  state.motes = makeMotes(1);
  state.hazards = makeHazards(1);
  updateReadout();
  requestAnimationFrame(frame);
})();
