"use strict";

const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

const titleScreen = document.getElementById("titleScreen");
const startButton = document.getElementById("startButton");
const chapterCard = document.getElementById("chapterCard");
const continueButton = document.getElementById("continueButton");
const chapterIndex = document.getElementById("chapterIndex");
const chapterEyebrow = document.getElementById("chapterEyebrow");
const chapterTitle = document.getElementById("chapterTitle");
const chapterText = document.getElementById("chapterText");
const controlStrip = document.getElementById("controlStrip");
const continueLabel = document.getElementById("continueLabel");
const hud = document.getElementById("hud");
const phaseLabel = document.getElementById("phaseLabel");
const objectiveLabel = document.getElementById("objectiveLabel");
const signalBar = document.getElementById("signalBar");
const signalValue = document.getElementById("signalValue");
const storyToast = document.getElementById("storyToast");
const toastLabel = document.getElementById("toastLabel");
const toastText = document.getElementById("toastText");
const phaseHint = document.getElementById("phaseHint");
const endingScreen = document.getElementById("endingScreen");
const endingHeading = document.getElementById("endingHeading");
const endingMessage = document.getElementById("endingMessage");
const choiceGrid = document.getElementById("choiceGrid");
const endingResult = document.getElementById("endingResult");
const resultStamp = document.getElementById("resultStamp");
const resultTitle = document.getElementById("resultTitle");
const resultText = document.getElementById("resultText");
const resultStats = document.getElementById("resultStats");
const replayButton = document.getElementById("replayButton");
const soundButton = document.getElementById("soundButton");
const soundLabel = document.getElementById("soundLabel");
const cornerReadout = document.getElementById("cornerReadout");

const TAU = Math.PI * 2;
const keys = new Set();
const pressed = new Set();
const mouse = { x: 0, y: 0, down: false, clicked: false };

let width = window.innerWidth;
let height = window.innerHeight;
let pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
let state = "title";
let previousTime = 0;
let time = 0;
let shake = 0;
let signal = 0;
let muted = false;
let audioContext = null;
let masterGain = null;
let ambientNodes = [];
let toastTimer = null;
let transitionTimer = null;
let completedSeconds = 0;

const stars = [];
const particles = [];
const sparks = [];
const flight = {};
const tune = {};
const beacon = {};

const fragmentLines = [
  "The station was built for twelve people.",
  "When the sun went out, I left one window on.",
  "A voice is not a place. But it can lead you there.",
  "Tell Jun I learned the sky by waiting.",
  "If you hear this, you are already home.",
];

const palette = {
  paper: "#e7e3d7",
  coral: "#ff8068",
  acid: "#d9f36b",
  blue: "#78b9e6",
  violet: "#9b8cff",
  ink: "#090b12",
};

function resize() {
  width = window.innerWidth;
  height = window.innerHeight;
  pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.floor(width * pixelRatio);
  canvas.height = Math.floor(height * pixelRatio);
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;
  ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
  if (state === "beacon") {
    createBeaconStars();
  }
}

function seededRandom(seed) {
  let value = seed % 2147483647;
  if (value <= 0) value += 2147483646;
  return () => {
    value = (value * 16807) % 2147483647;
    return (value - 1) / 2147483646;
  };
}

function initializeStars() {
  const random = seededRandom(73109);
  stars.length = 0;
  for (let i = 0; i < 210; i += 1) {
    stars.push({
      x: random(),
      y: random(),
      size: 0.45 + random() * 1.8,
      depth: 0.08 + random() * 0.92,
      phase: random() * TAU,
      tint: random() > 0.82 ? palette.blue : palette.paper,
    });
  }
}

function resetGame() {
  window.clearTimeout(transitionTimer);
  window.clearTimeout(toastTimer);
  state = "title";
  signal = 0;
  time = 0;
  completedSeconds = 0;
  shake = 0;
  particles.length = 0;
  sparks.length = 0;
  titleScreen.classList.add("is-visible");
  chapterCard.classList.remove("is-visible");
  endingScreen.classList.remove("is-visible");
  endingScreen.setAttribute("aria-hidden", "true");
  hud.classList.remove("is-visible");
  storyToast.classList.remove("is-visible");
  phaseHint.textContent = "";
  endingResult.hidden = true;
  choiceGrid.hidden = false;
  endingHeading.textContent = "The voice is yours now.";
  endingMessage.textContent = "Mara's last recording resolves into a room, a window, and someone still waiting on the other side of the dark.";
  signalBar.style.width = "0%";
  signalValue.textContent = "00%";
  cornerReadout.textContent = "MOTH-07 / LINK WAITING";
  initializeFlight();
}

function initializeFlight() {
  flight.t = 0;
  flight.duration = 58;
  flight.player = { x: 0.18, y: 0.5, tilt: 0, trail: [] };
  flight.hull = 100;
  flight.collected = 0;
  flight.fragments = [];
  flight.hazards = [];
  flight.nextHazard = 1.4;
  flight.nextFragment = 2.4;
  flight.pulseCooldown = 0;
  flight.pulseRadius = 0;
  flight.invulnerable = 0;
  flight.flash = 0;
  flight.nearMisses = 0;
  flight.lanes = 0;
}

function initializeTune() {
  tune.round = 0;
  tune.value = 0.3;
  tune.target = 0.66;
  tune.targetVelocity = 0.17;
  tune.targetPhase = 1.2;
  tune.targetSpeed = 1.1;
  tune.band = 0.105;
  tune.strikes = 0;
  tune.t = 0;
  tune.flash = 0;
  tune.locked = 0;
}

function initializeBeacon() {
  beacon.stage = 0;
  beacon.expected = 0;
  beacon.completed = 0;
  beacon.timeLeft = 31;
  beacon.stars = [];
  beacon.lines = [];
  beacon.flash = 0;
  beacon.wrong = 0;
  beacon.storm = [];
  createBeaconStars();
  for (let i = 0; i < 12; i += 1) {
    beacon.storm.push({
      x: Math.random() * width,
      y: 130 + Math.random() * Math.max(240, height - 250),
      r: 35 + Math.random() * 90,
      speed: 4 + Math.random() * 13,
      alpha: 0.03 + Math.random() * 0.04,
    });
  }
}

function createBeaconStars() {
  if (state !== "beacon" && !beacon.stars) return;
  const count = 4 + beacon.stage;
  const marginX = Math.min(150, width * 0.14);
  const top = 175;
  const bottom = height - 130;
  const random = seededRandom(4801 + beacon.stage * 993);
  beacon.stars = [];
  const points = [];
  for (let i = 0; i < count; i += 1) {
    let x = marginX + random() * Math.max(200, width - marginX * 2);
    let y = top + random() * Math.max(130, bottom - top);
    let tries = 0;
    while (points.some((point) => distance(point.x, point.y, x, y) < 94) && tries < 12) {
      x = marginX + random() * Math.max(200, width - marginX * 2);
      y = top + random() * Math.max(130, bottom - top);
      tries += 1;
    }
    points.push({ x, y });
  }
  beacon.stars = points.map((point, index) => ({
    ...point,
    index,
    hit: false,
    phase: random() * TAU,
    size: 7 + random() * 3,
  }));
  beacon.expected = 0;
  beacon.lines = [];
}

function showChapter(config) {
  chapterIndex.textContent = config.index;
  chapterEyebrow.textContent = config.eyebrow;
  chapterTitle.textContent = config.title;
  chapterText.textContent = config.text;
  controlStrip.innerHTML = config.controls;
  continueLabel.textContent = config.button;
  chapterCard.classList.add("is-visible");
  chapterCard.setAttribute("aria-hidden", "false");
}

function hideChapter() {
  chapterCard.classList.remove("is-visible");
  chapterCard.setAttribute("aria-hidden", "true");
}

function beginTransmission() {
  startAudio();
  titleScreen.classList.remove("is-visible");
  hud.classList.add("is-visible");
  state = "briefing-flight";
  showChapter({
    index: "01",
    eyebrow: "THE FIRST DISTANCE",
    title: "Cross the Hush",
    text: "The station has been silent for twelve years. One packet survived inside its smallest machine. Keep it moving.",
    controls: '<span class="key-chip">WASD / ARROWS</span><span>steer the moth</span><span class="key-chip">SPACE</span><span>pulse the Hush</span>',
    button: "ENTER THE DARK",
  });
  playTone(196, 0.22, "sine", 0.035);
}

function beginFlight() {
  hideChapter();
  initializeFlight();
  state = "flight";
  phaseLabel.textContent = "01 / CROSS THE HUSH";
  objectiveLabel.textContent = "Recover five memory fragments. Keep the packet alive.";
  phaseHint.textContent = "WASD / ARROWS TO STEER     SPACE TO PULSE";
  cornerReadout.textContent = "MOTH-07 / SIGNAL RUNNING";
  showToast("The dark has teeth. The light has somewhere to be.", "MISSION NOTE", 3400);
  playTone(247, 0.3, "triangle", 0.045);
}

function beginTuneBriefing() {
  state = "briefing-tune";
  showChapter({
    index: "02",
    eyebrow: "THE SECOND DISTANCE",
    title: "Tune the Heart",
    text: "The fragments are real, but the Hush has folded their frequencies together. Find the true note and pull the voice back into one piece.",
    controls: '<span class="key-chip">A / D</span><span>move the needle</span><span class="key-chip">SPACE</span><span>lock the note</span>',
    button: "LISTEN CLOSER",
  });
  phaseLabel.textContent = "02 / TUNE THE HEART";
  objectiveLabel.textContent = "Lock three clean notes before the static finds them.";
  phaseHint.textContent = "";
  cornerReadout.textContent = "MOTH-07 / RECEIVER OPEN";
}

function beginTune() {
  hideChapter();
  initializeTune();
  state = "tune";
  phaseHint.textContent = "A / D OR ARROWS TO TUNE     SPACE TO LOCK";
  playTone(330, 0.22, "sine", 0.04);
}

function beginBeaconBriefing() {
  state = "briefing-beacon";
  showChapter({
    index: "03",
    eyebrow: "THE LAST DISTANCE",
    title: "Draw the Way Home",
    text: "The voice is clean. The destination is not. Join the beacon stars in order before the dark tide closes over them.",
    controls: '<span class="key-chip">MOUSE</span><span>click the stars in order</span><span class="key-chip">1 - 2 - 3</span><span>you will know the rest</span>',
    button: "OPEN THE SKY",
  });
  phaseLabel.textContent = "03 / DRAW THE WAY HOME";
  objectiveLabel.textContent = "Connect the beacon stars before the tide closes.";
  phaseHint.textContent = "";
  cornerReadout.textContent = "MOTH-07 / BEACON LOCK";
}

function beginBeacon() {
  hideChapter();
  initializeBeacon();
  state = "beacon";
  phaseHint.textContent = "CLICK THE STARS IN ASCENDING ORDER";
  playTone(392, 0.25, "triangle", 0.045);
}

function startEnding() {
  state = "ending";
  completedSeconds = Math.round(time);
  phaseHint.textContent = "";
  endingScreen.classList.add("is-visible");
  endingScreen.setAttribute("aria-hidden", "false");
  cornerReadout.textContent = "MOTH-07 / PACKET COMPLETE";
  playTone(523.25, 0.5, "sine", 0.06);
  setTimeout(() => playTone(659.25, 0.8, "sine", 0.045), 180);
}

function selectEnding(choice) {
  choiceGrid.hidden = true;
  endingResult.hidden = false;
  if (choice === "map") {
    resultStamp.textContent = "COORDINATES DELIVERED";
    resultTitle.textContent = "A star to come back to.";
    resultText.textContent = "The map unfolds in the receiver's dark. Somewhere beyond the Hush, a ship turns toward the window Mara refused to let go out.";
    playTone(392, 0.35, "triangle", 0.055);
  } else {
    resultStamp.textContent = "VOICE DELIVERED";
    resultTitle.textContent = "A light that does not ask.";
    resultText.textContent = "The recording crosses the dark without a destination. Jun hears the room, the window, the waiting - and understands they were loved without being called back.";
    playTone(293.66, 0.35, "triangle", 0.055);
  }
  resultStats.textContent = `TRANSMISSION TIME ${formatTime(completedSeconds)}   //   FRAGMENTS ${flight.collected}/5   //   HULL ${Math.max(0, Math.round(flight.hull))}%`;
}

function formatTime(seconds) {
  const minutes = Math.floor(seconds / 60).toString().padStart(2, "0");
  const remaining = Math.max(0, seconds % 60).toString().padStart(2, "0");
  return `${minutes}:${remaining}`;
}

function showToast(text, label = "MEMORY FRAGMENT", duration = 3000) {
  window.clearTimeout(toastTimer);
  toastLabel.textContent = label;
  toastText.textContent = text;
  storyToast.classList.add("is-visible");
  toastTimer = window.setTimeout(() => storyToast.classList.remove("is-visible"), duration);
}

function updateSignal(value) {
  signal = clamp(value, 0, 1);
  signalBar.style.width = `${Math.round(signal * 100)}%`;
  signalValue.textContent = `${Math.round(signal * 100).toString().padStart(2, "0")}%`;
}

function update(dt) {
  time += dt;
  shake = Math.max(0, shake - dt * 2.8);
  updateParticles(dt);
  updateSparks(dt);

  if (state === "flight") updateFlight(dt);
  if (state === "tune") updateTune(dt);
  if (state === "beacon") updateBeacon(dt);

  pressed.clear();
  mouse.clicked = false;
}

function updateFlight(dt) {
  flight.t += dt;
  flight.pulseCooldown = Math.max(0, flight.pulseCooldown - dt);
  flight.invulnerable = Math.max(0, flight.invulnerable - dt);
  flight.flash = Math.max(0, flight.flash - dt * 2.8);
  if (flight.pulseRadius > 0) flight.pulseRadius += dt * 0.88;
  if (flight.pulseRadius > 0.3) flight.pulseRadius = 0;

  const horizontal = (keys.has("ArrowRight") || keys.has("d") ? 1 : 0) - (keys.has("ArrowLeft") || keys.has("a") ? 1 : 0);
  const vertical = (keys.has("ArrowDown") || keys.has("s") ? 1 : 0) - (keys.has("ArrowUp") || keys.has("w") ? 1 : 0);
  const movement = 0.44 * dt;
  flight.player.x = clamp(flight.player.x + horizontal * movement, 0.06, 0.92);
  flight.player.y = clamp(flight.player.y + vertical * movement, 0.16, 0.87);
  flight.player.tilt += (horizontal * 0.32 - flight.player.tilt) * dt * 7;

  if (horizontal !== 0 || vertical !== 0) {
    const p = flight.player;
    emitParticle(p.x * width, p.y * height, palette.coral, 1, 12, 0.36, 1.4);
  }

  if (pressed.has(" ") && flight.pulseCooldown <= 0) {
    flight.pulseCooldown = 4.1;
    flight.pulseRadius = 0.025;
    playTone(116, 0.24, "sine", 0.07);
    const px = flight.player.x * width;
    const py = flight.player.y * height;
    for (let i = flight.hazards.length - 1; i >= 0; i -= 1) {
      const hazard = flight.hazards[i];
      if (distance(px, py, hazard.x * width, hazard.y * height) < width * 0.16) {
        emitParticle(hazard.x * width, hazard.y * height, palette.violet, 12, 70, 0.7, 2.4);
        flight.hazards.splice(i, 1);
      }
    }
  }

  flight.nextHazard -= dt;
  if (flight.nextHazard <= 0) {
    spawnHazard();
    flight.nextHazard = 0.54 + Math.random() * 0.62 - Math.min(0.19, flight.t * 0.002);
    if (flight.t > 20 && Math.random() > 0.6) spawnHazard();
  }

  flight.nextFragment -= dt;
  if (flight.nextFragment <= 0 && flight.fragments.length < 5) {
    spawnFragment();
    flight.nextFragment = 7.0 + Math.random() * 1.7;
  }

  for (const hazard of flight.hazards) {
    hazard.x -= hazard.speed * dt;
    hazard.spin += hazard.spinSpeed * dt;
    hazard.wobble += dt * hazard.wobbleSpeed;
  }
  flight.hazards = flight.hazards.filter((hazard) => hazard.x > -0.14);

  const px = flight.player.x * width;
  const py = flight.player.y * height;
  for (let i = flight.fragments.length - 1; i >= 0; i -= 1) {
    const fragment = flight.fragments[i];
    fragment.x -= 0.105 * dt;
    fragment.phase += dt * 2.5;
    if (distance(px, py, fragment.x * width, fragment.y * height) < 26) {
      collectFragment(i);
    } else if (fragment.x < -0.1) {
      flight.fragments.splice(i, 1);
    }
  }

  if (flight.invulnerable <= 0) {
    for (const hazard of flight.hazards) {
      const hitDistance = hazard.kind === "ring" ? 20 : hazard.radius * Math.min(width, height);
      if (distance(px, py, hazard.x * width, hazard.y * height) < hitDistance + 17) {
        flight.hull -= hazard.kind === "shard" ? 18 : 12;
        flight.invulnerable = 1.15;
        flight.flash = 1;
        shake = 0.9;
        emitParticle(px, py, palette.coral, 18, 90, 0.65, 2.5);
        playTone(76, 0.16, "sawtooth", 0.045);
        if (flight.hull <= 0) {
          flight.hull = 34;
          flight.player.x = 0.19;
          flight.player.y = 0.5;
          showToast("The Hush found you. Keep flying.", "SIGNAL DAMAGED", 2200);
        }
        break;
      }
    }
  }

  updateSignal(0.07 + flight.collected * 0.15 + Math.max(0, flight.hull) * 0.0025);
  if (flight.collected >= 5 && flight.t > 39) {
    finishFlight();
  } else if (flight.t >= flight.duration) {
    finishFlight();
  }
}

function spawnHazard() {
  const kindRoll = Math.random();
  const kind = kindRoll > 0.72 ? "ring" : kindRoll > 0.44 ? "orb" : "shard";
  flight.hazards.push({
    x: 1.08,
    y: 0.18 + Math.random() * 0.68,
    radius: kind === "shard" ? 0.016 + Math.random() * 0.01 : kind === "orb" ? 0.022 + Math.random() * 0.012 : 0.032,
    kind,
    speed: 0.105 + Math.random() * 0.075 + flight.t * 0.0008,
    spin: Math.random() * TAU,
    spinSpeed: (Math.random() - 0.5) * 5,
    wobble: Math.random() * TAU,
    wobbleSpeed: 0.9 + Math.random() * 1.7,
    seed: Math.random() * 100,
  });
}

function spawnFragment() {
  const index = flight.collected + flight.fragments.length;
  flight.fragments.push({
    x: 1.08,
    y: 0.2 + Math.random() * 0.62,
    phase: Math.random() * TAU,
    index,
  });
}

function collectFragment(index) {
  const fragment = flight.fragments[index];
  flight.fragments.splice(index, 1);
  flight.collected += 1;
  emitParticle(fragment.x * width, fragment.y * height, palette.acid, 22, 85, 0.9, 2.5);
  playTone(430 + flight.collected * 45, 0.22, "triangle", 0.055);
  showToast(fragmentLines[flight.collected - 1], "MEMORY FRAGMENT 0" + flight.collected, 3800);
  updateSignal(0.07 + flight.collected * 0.15 + Math.max(0, flight.hull) * 0.0025);
}

function finishFlight() {
  if (state !== "flight") return;
  state = "flight-complete";
  phaseHint.textContent = "PACKET STABLE // PREPARING RECEIVER";
  showToast("The voice is still there. It only needs a shape.", "PACKET STABLE", 1900);
  transitionTimer = window.setTimeout(() => {
    beginTuneBriefing();
  }, 2100);
}

function updateTune(dt) {
  tune.t += dt;
  tune.flash = Math.max(0, tune.flash - dt * 3);
  const direction = (keys.has("ArrowRight") || keys.has("d") ? 1 : 0) - (keys.has("ArrowLeft") || keys.has("a") ? 1 : 0);
  tune.value = clamp(tune.value + direction * dt * 0.54, 0.035, 0.965);
  tune.target = clamp(0.5 + Math.sin(tune.t * tune.targetSpeed + tune.targetPhase) * (0.19 + tune.round * 0.022) + Math.sin(tune.t * 0.49) * 0.08, 0.08, 0.92);
  if (mouse.down && mouse.y > height * 0.36 && mouse.y < height * 0.8) {
    const bar = getTuneBar();
    tune.value = clamp((mouse.x - bar.x) / bar.width, 0.035, 0.965);
  }
  if (pressed.has(" ")) lockTune();
  updateSignal(0.82 + tune.round * 0.055 - tune.strikes * 0.018);
}

function getTuneBar() {
  return { x: width * 0.19, y: height * 0.61, width: width * 0.62, height: 14 };
}

function lockTune() {
  if (state !== "tune") return;
  const accuracy = Math.abs(tune.value - tune.target);
  if (accuracy <= tune.band) {
    tune.locked = 0.8;
    tune.flash = 1;
    tune.round += 1;
    emitParticle(width * (0.19 + tune.target * 0.62), height * 0.61, palette.acid, 30, 110, 1.1, 2.6);
    playTone(330 + tune.round * 110, 0.3, "sine", 0.065);
    const lines = ["I remember the first snow.", "I remember the window." , "I remember your name."];
    showToast(lines[tune.round - 1], `VOICE LOCK ${"0" + tune.round}`, 2700);
    if (tune.round >= 3) {
      state = "tune-complete";
      phaseHint.textContent = "VOICE RESTORED // THE SKY IS LISTENING";
      transitionTimer = window.setTimeout(() => beginBeaconBriefing(), 2400);
    } else {
      tune.targetPhase += 1.4;
      tune.targetSpeed += 0.25;
      tune.value = clamp(tune.target + (Math.random() - 0.5) * 0.34, 0.05, 0.95);
    }
  } else {
    tune.strikes += 1;
    tune.flash = 0.45;
    tune.value = clamp(tune.target + (tune.value > tune.target ? 0.16 : -0.16), 0.035, 0.965);
    playTone(112, 0.13, "square", 0.035);
    showToast("Static. Listen for the warmer band.", "SIGNAL SLIP", 1500);
  }
}

function updateBeacon(dt) {
  beacon.timeLeft -= dt;
  beacon.flash = Math.max(0, beacon.flash - dt * 3);
  for (const cloud of beacon.storm) {
    cloud.x -= cloud.speed * dt;
    if (cloud.x < -cloud.r * 2) {
      cloud.x = width + cloud.r * 2;
      cloud.y = 130 + Math.random() * Math.max(240, height - 250);
    }
  }
  updateSignal(0.93 + beacon.completed * 0.02 - Math.max(0, 25 - beacon.timeLeft) * 0.003);
  if (beacon.timeLeft <= 0) {
    beacon.timeLeft = 18;
    beacon.wrong += 1;
    beacon.stage = Math.max(0, beacon.stage - 1);
    createBeaconStars();
    showToast("The tide closed. The beacon is still willing.", "STAR MAP RESET", 2200);
    shake = 0.35;
  }
  if (mouse.clicked) clickBeacon(mouse.x, mouse.y);
}

function clickBeacon(x, y) {
  const target = beacon.stars[beacon.expected];
  if (!target) return;
  if (distance(x, y, target.x, target.y) < 32) {
    target.hit = true;
    beacon.lines.push({ x: target.x, y: target.y });
    beacon.expected += 1;
    beacon.completed += 1;
    emitParticle(target.x, target.y, palette.acid, 20, 88, 0.85, 2.4);
    playTone(280 + beacon.expected * 70, 0.2, "triangle", 0.06);
    if (beacon.expected >= beacon.stars.length) {
      beacon.stage += 1;
      if (beacon.stage >= 3) {
        state = "beacon-complete";
        phaseHint.textContent = "THE WAY IS DRAWN";
        showToast("For one second, the whole sky remembers where home is.", "BEACON ALIGNED", 2500);
        transitionTimer = window.setTimeout(startEnding, 2800);
      } else {
        showToast(beacon.stage === 1 ? "The first door opens." : "The dark is losing its shape.", `CONSTELLATION 0${beacon.stage + 1}`, 1900);
        createBeaconStars();
      }
    }
  } else {
    beacon.wrong += 1;
    beacon.timeLeft = Math.max(4, beacon.timeLeft - 2.5);
    beacon.flash = 1;
    shake = 0.25;
    playTone(96, 0.12, "sawtooth", 0.032);
    showToast("Not that one. Follow the order.", "BEACON MISALIGN", 1100);
  }
}

function render() {
  ctx.save();
  const shakeX = shake > 0 ? (Math.random() - 0.5) * shake * 10 : 0;
  const shakeY = shake > 0 ? (Math.random() - 0.5) * shake * 10 : 0;
  ctx.translate(shakeX, shakeY);
  drawBackdrop();
  if (state === "title" || state.startsWith("briefing")) drawTitleAtmosphere();
  if (state === "flight" || state === "flight-complete") drawFlight();
  if (state === "tune" || state === "tune-complete" || state === "briefing-beacon") drawTune();
  if (state === "beacon" || state === "beacon-complete" || state === "ending") drawBeacon();
  drawParticles();
  drawSparks();
  if (flight.flash > 0) {
    ctx.fillStyle = `rgba(255, 128, 104, ${flight.flash * 0.08})`;
    ctx.fillRect(0, 0, width, height);
  }
  ctx.restore();
}

function drawBackdrop() {
  const gradient = ctx.createRadialGradient(width * 0.52, height * 0.46, 20, width * 0.52, height * 0.46, Math.max(width, height) * 0.75);
  gradient.addColorStop(0, state === "tune" ? "#151632" : state === "beacon" || state === "ending" ? "#111b25" : "#141526");
  gradient.addColorStop(0.55, "#0b0e1a");
  gradient.addColorStop(1, "#05060b");
  ctx.fillStyle = gradient;
  ctx.fillRect(-10, -10, width + 20, height + 20);

  const horizonY = height * 0.66;
  ctx.save();
  ctx.globalAlpha = 0.22;
  const horizon = ctx.createLinearGradient(0, horizonY - 60, 0, horizonY + 200);
  horizon.addColorStop(0, "rgba(120, 185, 230, 0)");
  horizon.addColorStop(0.45, "rgba(120, 185, 230, 0.09)");
  horizon.addColorStop(1, "rgba(120, 185, 230, 0)");
  ctx.fillStyle = horizon;
  ctx.fillRect(0, horizonY - 70, width, 280);
  ctx.restore();

  ctx.save();
  for (const star of stars) {
    const drift = (time * (star.depth * 0.007) + star.x) % 1;
    const x = drift * width;
    const y = star.y * height;
    const alpha = (0.2 + star.depth * 0.68) * (0.7 + Math.sin(time * 1.7 + star.phase) * 0.3);
    ctx.globalAlpha = alpha;
    ctx.fillStyle = star.tint;
    ctx.fillRect(x, y, star.size * star.depth, star.size * star.depth);
    if (star.depth > 0.78 && state !== "title") {
      ctx.globalAlpha = alpha * 0.22;
      ctx.fillRect(x - 22 * star.depth, y, 44 * star.depth, 1);
    }
  }
  ctx.restore();

  ctx.save();
  ctx.globalAlpha = 0.16;
  ctx.strokeStyle = palette.blue;
  ctx.lineWidth = 1;
  for (let i = 0; i < 7; i += 1) {
    const y = horizonY + i * 26 + Math.sin(time * 0.24 + i) * 3;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width, y + Math.sin(time * 0.18 + i) * 5);
    ctx.stroke();
  }
  ctx.restore();
}

function drawTitleAtmosphere() {
  const x = width * 0.69;
  const y = height * 0.49;
  const pulse = 1 + Math.sin(time * 1.4) * 0.05;
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  const glow = ctx.createRadialGradient(x, y, 0, x, y, 210 * pulse);
  glow.addColorStop(0, "rgba(255, 128, 104, 0.16)");
  glow.addColorStop(0.45, "rgba(155, 140, 255, 0.04)");
  glow.addColorStop(1, "rgba(155, 140, 255, 0)");
  ctx.fillStyle = glow;
  ctx.fillRect(x - 220, y - 220, 440, 440);
  ctx.restore();
}

function drawFlight() {
  const p = flight.player;
  const px = p.x * width;
  const py = p.y * height;
  const top = height * 0.14;
  const bottom = height * 0.88;

  ctx.save();
  ctx.strokeStyle = "rgba(231, 227, 215, 0.08)";
  ctx.lineWidth = 1;
  ctx.setLineDash([2, 13]);
  for (let i = 0; i < 5; i += 1) {
    const y = top + ((bottom - top) / 5) * i;
    ctx.beginPath();
    ctx.moveTo(45, y);
    ctx.lineTo(width - 45, y);
    ctx.stroke();
  }
  ctx.setLineDash([]);
  ctx.restore();

  for (const fragment of flight.fragments) drawFragment(fragment);
  for (const hazard of flight.hazards) drawHazard(hazard);
  drawPlayer(px, py, p.tilt);

  if (flight.pulseRadius > 0) {
    ctx.save();
    ctx.globalAlpha = Math.max(0, 1 - flight.pulseRadius / 0.3);
    ctx.strokeStyle = palette.violet;
    ctx.lineWidth = 2;
    ctx.shadowColor = palette.violet;
    ctx.shadowBlur = 22;
    ctx.beginPath();
    ctx.arc(px, py, flight.pulseRadius * width, 0, TAU);
    ctx.stroke();
    ctx.restore();
  }

  ctx.save();
  ctx.fillStyle = "rgba(231, 227, 215, 0.38)";
  ctx.font = "9px ui-monospace, monospace";
  ctx.letterSpacing = "0.12em";
  ctx.fillText(`HULL ${Math.max(0, Math.round(flight.hull)).toString().padStart(3, "0")}%`, 48, height - 92);
  ctx.fillText(`FRAGMENTS ${flight.collected}/05`, 145, height - 92);
  const cooldown = flight.pulseCooldown > 0 ? `PULSE ${flight.pulseCooldown.toFixed(1)}S` : "PULSE READY";
  ctx.fillStyle = flight.pulseCooldown > 0 ? "rgba(231, 227, 215, 0.3)" : palette.violet;
  ctx.fillText(cooldown, width - 152, height - 92);
  ctx.restore();
}

function drawPlayer(x, y, tilt) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(tilt);
  const flicker = 0.8 + Math.sin(time * 17) * 0.2;
  ctx.globalCompositeOperation = "lighter";
  ctx.shadowColor = palette.coral;
  ctx.shadowBlur = 23;
  ctx.fillStyle = `rgba(255, 128, 104, ${0.18 * flicker})`;
  ctx.beginPath();
  ctx.ellipse(-4, 0, 36, 20, 0, 0, TAU);
  ctx.fill();
  ctx.shadowBlur = 9;
  ctx.fillStyle = palette.coral;
  ctx.beginPath();
  ctx.moveTo(23, 0);
  ctx.lineTo(-7, -10);
  ctx.lineTo(-18, 0);
  ctx.lineTo(-7, 10);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = palette.paper;
  ctx.beginPath();
  ctx.ellipse(7, 0, 7, 5, 0, 0, TAU);
  ctx.fill();
  ctx.fillStyle = palette.ink;
  ctx.beginPath();
  ctx.arc(10, 0, 2.2, 0, TAU);
  ctx.fill();
  ctx.globalAlpha = 0.5;
  ctx.strokeStyle = palette.coral;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(-20, -7);
  ctx.lineTo(-43, -17);
  ctx.moveTo(-20, 7);
  ctx.lineTo(-43, 17);
  ctx.stroke();
  ctx.restore();
}

function drawFragment(fragment) {
  const x = fragment.x * width;
  const y = fragment.y * height;
  const bob = Math.sin(fragment.phase) * 4;
  ctx.save();
  ctx.translate(x, y + bob);
  ctx.globalCompositeOperation = "lighter";
  ctx.shadowColor = palette.acid;
  ctx.shadowBlur = 22;
  ctx.strokeStyle = palette.acid;
  ctx.lineWidth = 1.5;
  ctx.rotate(Math.PI / 4 + fragment.phase * 0.12);
  ctx.strokeRect(-8, -8, 16, 16);
  ctx.globalAlpha = 0.38;
  ctx.fillStyle = palette.acid;
  ctx.fillRect(-4, -4, 8, 8);
  ctx.restore();
}

function drawHazard(hazard) {
  const x = hazard.x * width;
  const y = hazard.y * height + Math.sin(hazard.wobble) * 5;
  const r = hazard.radius * Math.min(width, height) * (hazard.kind === "ring" ? 1.15 : 1);
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(hazard.spin);
  ctx.globalCompositeOperation = "lighter";
  if (hazard.kind === "shard") {
    ctx.shadowColor = palette.coral;
    ctx.shadowBlur = 12;
    ctx.fillStyle = "rgba(255, 128, 104, 0.82)";
    ctx.beginPath();
    ctx.moveTo(r * 1.8, 0);
    ctx.lineTo(-r * 0.8, -r * 0.7);
    ctx.lineTo(-r * 1.1, r * 0.7);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = "rgba(231, 227, 215, 0.66)";
    ctx.lineWidth = 1;
    ctx.stroke();
  } else if (hazard.kind === "orb") {
    ctx.shadowColor = palette.violet;
    ctx.shadowBlur = 18;
    ctx.fillStyle = "rgba(155, 140, 255, 0.74)";
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, TAU);
    ctx.fill();
    ctx.globalAlpha = 0.62;
    ctx.strokeStyle = palette.violet;
    ctx.beginPath();
    ctx.arc(0, 0, r * 1.8, 0, TAU);
    ctx.stroke();
  } else {
    ctx.shadowColor = palette.blue;
    ctx.shadowBlur = 15;
    ctx.strokeStyle = "rgba(120, 185, 230, 0.8)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, r * 1.55, 0.3, Math.PI * 1.65);
    ctx.stroke();
    ctx.globalAlpha = 0.35;
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.82, 0, TAU);
    ctx.stroke();
  }
  ctx.restore();
}

function drawTune() {
  const bar = getTuneBar();
  const barY = bar.y;
  const current = bar.x + tune.value * bar.width;
  const target = bar.x + tune.target * bar.width;
  const bandWidth = tune.band * bar.width;

  ctx.save();
  ctx.strokeStyle = "rgba(231, 227, 215, 0.09)";
  ctx.lineWidth = 1;
  for (let y = height * 0.28; y < height * 0.78; y += 38) {
    ctx.beginPath();
    ctx.moveTo(width * 0.1, y);
    ctx.lineTo(width * 0.9, y);
    ctx.stroke();
  }
  for (let x = width * 0.1; x < width * 0.9; x += 60) {
    ctx.beginPath();
    ctx.moveTo(x, height * 0.23);
    ctx.lineTo(x, height * 0.8);
    ctx.stroke();
  }
  ctx.restore();

  drawWave(width * 0.1, height * 0.38, width * 0.8, 44, 1.2, palette.blue, 0.33);
  drawWave(width * 0.1, height * 0.46, width * 0.8, 26, 2.3, palette.violet, 0.31);
  drawWave(width * 0.1, height * 0.54, width * 0.8, 13, 4.2, palette.coral, 0.3);

  ctx.save();
  ctx.fillStyle = "rgba(217, 243, 107, 0.09)";
  ctx.fillRect(target - bandWidth, height * 0.29, bandWidth * 2, height * 0.31);
  ctx.strokeStyle = "rgba(217, 243, 107, 0.7)";
  ctx.lineWidth = 1;
  ctx.setLineDash([4, 8]);
  ctx.beginPath();
  ctx.moveTo(target, height * 0.27);
  ctx.lineTo(target, height * 0.82);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.restore();

  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  ctx.shadowColor = palette.paper;
  ctx.shadowBlur = 15;
  ctx.strokeStyle = palette.paper;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(current, height * 0.26);
  ctx.lineTo(current, height * 0.82);
  ctx.stroke();
  ctx.fillStyle = palette.paper;
  ctx.beginPath();
  ctx.arc(current, barY, 8, 0, TAU);
  ctx.fill();
  ctx.restore();

  ctx.save();
  ctx.fillStyle = "rgba(231, 227, 215, 0.11)";
  ctx.fillRect(bar.x, barY - 2, bar.width, 4);
  ctx.fillStyle = palette.paper;
  ctx.fillRect(bar.x, barY - 2, tune.value * bar.width, 4);
  ctx.fillStyle = palette.acid;
  ctx.fillRect(target - bandWidth, barY - 5, bandWidth * 2, 10);
  ctx.fillStyle = palette.ink;
  ctx.fillRect(current - 2, barY - 7, 4, 14);
  ctx.restore();

  ctx.save();
  ctx.fillStyle = "rgba(231, 227, 215, 0.46)";
  ctx.font = "10px ui-monospace, monospace";
  ctx.fillText("NOISE", width * 0.1, height * 0.25);
  ctx.fillText(`VOICE LOCK 0${Math.min(3, tune.round)} / 03`, width * 0.1, height * 0.87);
  ctx.fillText("TRUE NOTE", target - 30, height * 0.87);
  ctx.fillStyle = tune.strikes > 0 ? palette.coral : "rgba(231, 227, 215, 0.34)";
  ctx.fillText(`SLIPS ${tune.strikes.toString().padStart(2, "0")}`, width * 0.81, height * 0.87);
  ctx.restore();

  if (tune.flash > 0) {
    ctx.save();
    ctx.fillStyle = `rgba(217, 243, 107, ${tune.flash * 0.055})`;
    ctx.fillRect(0, 0, width, height);
    ctx.restore();
  }
}

function drawWave(x, y, waveWidth, amplitude, frequency, color, alpha) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.globalCompositeOperation = "lighter";
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  for (let i = 0; i <= waveWidth; i += 3) {
    const normal = i / waveWidth;
    const wave = Math.sin(normal * Math.PI * frequency * 3 + time * (0.8 + frequency * 0.15)) * amplitude;
    const second = Math.sin(normal * Math.PI * 11 - time * 0.4) * amplitude * 0.16;
    const pointY = y + wave + second;
    if (i === 0) ctx.moveTo(x + i, pointY);
    else ctx.lineTo(x + i, pointY);
  }
  ctx.stroke();
  ctx.restore();
}

function drawBeacon() {
  const centerX = width * 0.5;
  const centerY = height * 0.53;
  const radius = Math.min(width, height) * 0.25;
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  const beaconGlow = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, radius * 1.2);
  beaconGlow.addColorStop(0, "rgba(217, 243, 107, 0.12)");
  beaconGlow.addColorStop(0.35, "rgba(120, 185, 230, 0.045)");
  beaconGlow.addColorStop(1, "rgba(120, 185, 230, 0)");
  ctx.fillStyle = beaconGlow;
  ctx.fillRect(centerX - radius * 1.2, centerY - radius * 1.2, radius * 2.4, radius * 2.4);
  ctx.shadowColor = palette.acid;
  ctx.shadowBlur = 18;
  ctx.fillStyle = palette.acid;
  ctx.globalAlpha = 0.7 + Math.sin(time * 3) * 0.15;
  ctx.beginPath();
  ctx.arc(centerX, centerY, 3.5, 0, TAU);
  ctx.fill();
  ctx.restore();

  ctx.save();
  ctx.globalAlpha = 0.18;
  ctx.strokeStyle = palette.blue;
  ctx.lineWidth = 1;
  for (let i = 1; i <= 4; i += 1) {
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius * i * 0.55, 0, TAU);
    ctx.stroke();
  }
  ctx.restore();

  ctx.save();
  ctx.strokeStyle = "rgba(231, 227, 215, 0.23)";
  ctx.lineWidth = 1;
  ctx.setLineDash([1, 9]);
  for (let i = 0; i < 9; i += 1) {
    const angle = time * 0.05 + i * TAU / 9;
    ctx.beginPath();
    ctx.moveTo(centerX + Math.cos(angle) * 50, centerY + Math.sin(angle) * 50);
    ctx.lineTo(centerX + Math.cos(angle) * radius * 2.15, centerY + Math.sin(angle) * radius * 2.15);
    ctx.stroke();
  }
  ctx.setLineDash([]);
  ctx.restore();

  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  ctx.strokeStyle = palette.acid;
  ctx.shadowColor = palette.acid;
  ctx.shadowBlur = 12;
  ctx.lineWidth = 2;
  ctx.beginPath();
  beacon.lines.forEach((point, index) => {
    if (index === 0) ctx.moveTo(point.x, point.y);
    else ctx.lineTo(point.x, point.y);
  });
  ctx.stroke();
  ctx.restore();

  for (const cloud of beacon.storm) {
    ctx.save();
    ctx.globalAlpha = cloud.alpha;
    ctx.fillStyle = palette.ink;
    ctx.shadowColor = palette.violet;
    ctx.shadowBlur = 30;
    ctx.beginPath();
    ctx.arc(cloud.x, cloud.y, cloud.r, 0, TAU);
    ctx.fill();
    ctx.restore();
  }

  beacon.stars.forEach((star, index) => {
    const hovering = distance(mouse.x, mouse.y, star.x, star.y) < 32;
    const active = index === beacon.expected;
    const pulse = 1 + Math.sin(time * 2.6 + star.phase) * 0.18;
    ctx.save();
    ctx.translate(star.x, star.y);
    ctx.rotate(Math.PI / 4);
    ctx.globalCompositeOperation = "lighter";
    ctx.shadowColor = active ? palette.acid : palette.blue;
    ctx.shadowBlur = active || hovering ? 27 : 12;
    ctx.strokeStyle = star.hit ? palette.acid : active ? palette.acid : "rgba(120, 185, 230, 0.58)";
    ctx.lineWidth = active ? 2 : 1;
    ctx.strokeRect(-star.size * pulse, -star.size * pulse, star.size * 2 * pulse, star.size * 2 * pulse);
    ctx.rotate(-Math.PI / 4);
    ctx.fillStyle = star.hit ? palette.acid : active ? palette.paper : palette.blue;
    ctx.globalAlpha = star.hit ? 0.9 : active ? 0.85 : 0.46;
    ctx.beginPath();
    ctx.arc(0, 0, star.hit ? 3 : active ? 4 : 2.5, 0, TAU);
    ctx.fill();
    ctx.restore();

    ctx.save();
    ctx.fillStyle = active || star.hit ? "rgba(231, 227, 215, 0.62)" : "rgba(231, 227, 215, 0.24)";
    ctx.font = "9px ui-monospace, monospace";
    ctx.fillText(`0${index + 1}`, star.x + 14, star.y - 12);
    ctx.restore();
  });

  ctx.save();
  ctx.fillStyle = "rgba(231, 227, 215, 0.42)";
  ctx.font = "10px ui-monospace, monospace";
  ctx.fillText(`CONSTELLATION 0${Math.min(3, beacon.stage + 1)} / 03`, 48, height - 92);
  ctx.fillStyle = beacon.timeLeft < 8 ? palette.coral : palette.acid;
  ctx.fillText(`TIDE ${Math.ceil(beacon.timeLeft).toString().padStart(2, "0")}S`, width - 122, height - 92);
  ctx.restore();
}

function updateParticles(dt) {
  for (let i = particles.length - 1; i >= 0; i -= 1) {
    const particle = particles[i];
    particle.life -= dt;
    particle.x += particle.vx * dt;
    particle.y += particle.vy * dt;
    particle.vx *= 1 - dt * 1.8;
    particle.vy *= 1 - dt * 1.8;
    if (particle.life <= 0) particles.splice(i, 1);
  }
}

function updateSparks(dt) {
  for (let i = sparks.length - 1; i >= 0; i -= 1) {
    const spark = sparks[i];
    spark.life -= dt;
    spark.x += spark.vx * dt;
    spark.y += spark.vy * dt;
    if (spark.life <= 0) sparks.splice(i, 1);
  }
}

function drawParticles() {
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  for (const particle of particles) {
    const alpha = clamp(particle.life / particle.maxLife, 0, 1);
    ctx.globalAlpha = alpha;
    ctx.fillStyle = particle.color;
    ctx.shadowColor = particle.color;
    ctx.shadowBlur = particle.size * 4;
    ctx.beginPath();
    ctx.arc(particle.x, particle.y, particle.size * alpha, 0, TAU);
    ctx.fill();
  }
  ctx.restore();
}

function drawSparks() {
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  for (const spark of sparks) {
    ctx.globalAlpha = clamp(spark.life / spark.maxLife, 0, 1);
    ctx.strokeStyle = spark.color;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(spark.x, spark.y);
    ctx.lineTo(spark.x - spark.vx * 0.08, spark.y - spark.vy * 0.08);
    ctx.stroke();
  }
  ctx.restore();
}

function emitParticle(x, y, color, count, speed, life, size) {
  for (let i = 0; i < count; i += 1) {
    const angle = Math.random() * TAU;
    const velocity = speed * (0.3 + Math.random() * 0.9);
    particles.push({
      x,
      y,
      vx: Math.cos(angle) * velocity,
      vy: Math.sin(angle) * velocity,
      life: life * (0.55 + Math.random() * 0.55),
      maxLife: life,
      size: size * (0.55 + Math.random() * 0.8),
      color,
    });
  }
}

function distance(x1, y1, x2, y2) {
  return Math.hypot(x2 - x1, y2 - y1);
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function startAudio() {
  if (audioContext) {
    if (audioContext.state === "suspended") audioContext.resume();
    return;
  }
  const AudioCtor = window.AudioContext || window.webkitAudioContext;
  if (!AudioCtor) return;
  audioContext = new AudioCtor();
  masterGain = audioContext.createGain();
  masterGain.gain.value = muted ? 0 : 0.48;
  masterGain.connect(audioContext.destination);
  const drone = audioContext.createOscillator();
  const droneGain = audioContext.createGain();
  drone.type = "sine";
  drone.frequency.value = 55;
  droneGain.gain.value = 0.025;
  drone.connect(droneGain).connect(masterGain);
  drone.start();
  ambientNodes.push(drone, droneGain);
}

function playTone(frequency, duration, type, volume) {
  if (!audioContext || !masterGain || muted) return;
  const oscillator = audioContext.createOscillator();
  const gain = audioContext.createGain();
  const now = audioContext.currentTime;
  oscillator.type = type;
  oscillator.frequency.setValueAtTime(frequency, now);
  oscillator.frequency.exponentialRampToValueAtTime(Math.max(35, frequency * 0.88), now + duration);
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(volume, now + 0.015);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
  oscillator.connect(gain).connect(masterGain);
  oscillator.start(now);
  oscillator.stop(now + duration + 0.03);
}

function toggleSound() {
  muted = !muted;
  soundLabel.textContent = muted ? "SOUND OFF" : "SOUND ON";
  soundButton.querySelector(".sound-icon").textContent = muted ? "-" : "))";
  if (!audioContext) return;
  masterGain.gain.setTargetAtTime(muted ? 0 : 0.48, audioContext.currentTime, 0.04);
}

function handleKeyDown(event) {
  const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;
  if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", " ", "Enter"].includes(key)) event.preventDefault();
  if (!keys.has(key)) pressed.add(key);
  keys.add(key);
  if ((state === "title" && (key === "Enter" || key === " ")) || (state === "ending" && key === "Escape")) {
    if (state === "title") beginTransmission();
  }
  if (state === "ending" && (key === "1" || key === "2")) selectEnding(key === "1" ? "map" : "voice");
}

function handleKeyUp(event) {
  const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;
  keys.delete(key);
}

function handleMouseMove(event) {
  const rect = canvas.getBoundingClientRect();
  mouse.x = event.clientX - rect.left;
  mouse.y = event.clientY - rect.top;
}

function handleMouseDown(event) {
  handleMouseMove(event);
  mouse.down = true;
  mouse.clicked = true;
}

function handleMouseUp() {
  mouse.down = false;
}

function handleContinue() {
  if (state === "briefing-flight") beginFlight();
  else if (state === "briefing-tune") beginTune();
  else if (state === "briefing-beacon") beginBeacon();
}

startButton.addEventListener("click", beginTransmission);
continueButton.addEventListener("click", handleContinue);
soundButton.addEventListener("click", toggleSound);
replayButton.addEventListener("click", resetGame);
document.querySelectorAll(".choice-button").forEach((button) => {
  button.addEventListener("click", () => selectEnding(button.dataset.choice));
});
window.addEventListener("resize", resize);
window.addEventListener("keydown", handleKeyDown);
window.addEventListener("keyup", handleKeyUp);
canvas.addEventListener("mousemove", handleMouseMove);
canvas.addEventListener("mousedown", handleMouseDown);
window.addEventListener("mouseup", handleMouseUp);

function loop(timestamp) {
  if (!previousTime) previousTime = timestamp;
  const dt = Math.min(0.05, (timestamp - previousTime) / 1000);
  previousTime = timestamp;
  update(dt);
  render();
  requestAnimationFrame(loop);
}

initializeStars();
resize();
resetGame();
requestAnimationFrame(loop);
