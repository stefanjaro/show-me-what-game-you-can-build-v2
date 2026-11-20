const fs = require("fs");
const vm = require("vm");
const path = require("path");

const ROOT = path.join(__dirname, "..");

const listeners = {};
let rafCb = null;

const ctxStub = new Proxy({}, {
  get(target, prop) {
    if (prop === "canvas") return null;
    if (prop === "createLinearGradient" || prop === "createRadialGradient" || prop === "createPattern") {
      return () => ({ addColorStop() {} });
    }
    if (prop === "measureText") return () => ({ width: 10 });
    if (prop === "getImageData") return () => ({ data: [] });
    if (prop in target) return target[prop];
    return () => {};
  },
  set(target, prop, value) {
    target[prop] = value;
    return true;
  },
});

const els = {};
function makeEl(id) {
  const el = {
    id: id || "",
    style: {},
    textContent: "",
    children: [],
    _innerHTML: "",
    addEventListener() {},
    removeEventListener() {},
    appendChild(ch) { this.children.push(ch); return ch; },
    removeChild(ch) { this.children = this.children.filter((c) => c !== ch); },
    remove() {},
    setAttribute() {},
    querySelector() { return null; },
    getBoundingClientRect() { return { left: 0, top: 0, width: 1440, height: 900 }; },
    getContext() { return ctxStub; },
    width: 300,
    height: 150,
  };
  Object.defineProperty(el, "innerHTML", {
    get() { return this._innerHTML; },
    set(v) {
      this._innerHTML = v;
      if (v === "") this.children = [];
    },
  });
  const classes = new Set();
  el.classList = {
    add: (...c) => c.forEach((x) => classes.add(x)),
    remove: (...c) => c.forEach((x) => classes.delete(x)),
    contains: (c) => classes.has(c),
    toggle: (c) => (classes.has(c) ? classes.delete(c) : classes.add(c)),
  };
  return el;
}

global.window = global;
global.innerWidth = 1440;
global.innerHeight = 900;
global.devicePixelRatio = 1;
global.__FORCE_DT = 1 / 60;

global.addEventListener = (type, fn) => {
  listeners[type] = listeners[type] || [];
  listeners[type].push(fn);
};
global.removeEventListener = () => {};
global.requestAnimationFrame = (cb) => { rafCb = cb; };
global.localStorage = {
  _d: {},
  getItem(k) { return this._d[k] !== undefined ? this._d[k] : null; },
  setItem(k, v) { this._d[k] = String(v); },
  removeItem(k) { delete this._d[k]; },
};

global.document = {
  hidden: false,
  getElementById(id) { return els[id] || (els[id] = makeEl(id)); },
  createElement(tag) { return makeEl(tag); },
  addEventListener(type, fn) {
    listeners[type] = listeners[type] || [];
    listeners[type].push(fn);
  },
  body: makeEl("body"),
};

let ts = 0;
function pump(n, dt) {
  dt = dt || 1 / 60;
  for (let i = 0; i < n; i++) {
    ts += dt * 1000;
    const cb = rafCb;
    rafCb = null;
    if (!cb) throw new Error("no rAF callback scheduled");
    cb(ts);
  }
}

function key(code, type) {
  type = type || "keydown";
  const ev = { code, repeat: false, preventDefault() {} };
  (listeners[type] || []).forEach((f) => f(ev));
}
function press(code) {
  key(code, "keydown");
  key(code, "keyup");
}

let failures = 0;
function assert(cond, msg) {
  if (cond) {
    console.log("  PASS " + msg);
  } else {
    failures++;
    console.log("  FAIL " + msg);
  }
}

const SHIM = `
global.__X = {
  get CHAPTERS(){ return CHAPTERS; },
  get G(){ return G; },
  get player(){ return player; },
  get doors(){ return doors; },
  get hunters(){ return hunters; },
  get box(){ return box; },
  get boids(){ return boids; },
  get lev(){ return lev; },
  get world(){ return world; },
  get AUD(){ return AUD; },
  set gridInfo(v){ gridInfo = v; },
};
`;

const src = ["audio.js", "levels.js", "world.js", "logic.js", "render.js"]
  .map((f) => fs.readFileSync(path.join(ROOT, "js", f), "utf8"))
  .join("\n;\n");

console.log("== loading scripts ==");
try {
  vm.runInThisContext(src + SHIM, { filename: "bundle.js" });
  console.log("  PASS scripts loaded without exceptions");
} catch (e) {
  console.log("  FAIL load: " + e.stack);
  process.exit(1);
}

const X = global.__X;

console.log("== data validation ==");
(function validateLevels() {
  const CHAPTERS = X.CHAPTERS;
  assert(CHAPTERS.length === 5, "5 chapters defined");
  for (let i = 0; i < CHAPTERS.length; i++) {
    const w = CHAPTERS[i];
    X.G.ch = i;
    global.buildChapter(i);
    const spawn = w.spawn, exit = w.exit;
    assert(!global.pointBlocked(spawn.x, spawn.y, 12), `ch${i} spawn clear`);
    assert(!global.pointBlocked(exit.x, exit.y, 12), `ch${i} exit clear`);
    w.beacons.forEach((b, bi) => {
      assert(!global.pointBlocked(b.x, b.y, 10), `ch${i} beacon${bi} clear`);
    });
    w.crystals.forEach((c, ci) => {
      assert(!global.pointBlocked(c.x, c.y, 10), `ch${i} crystal${ci} clear`);
    });
    (w.mines || []).forEach((m, mi) => {
      assert(!global.pointBlocked(m.x, m.y, 10), `ch${i} mine${mi} clear`);
    });
    X.doors.forEach((d) => { d.open = 1; d.opening = true; });
    X.gridInfo = global.buildGrid(w);
    assert(global.bfsPath(spawn.x, spawn.y, exit.x, exit.y), `ch${i} spawn->exit path exists`);
    w.crystals.forEach((c, ci) => {
      assert(global.bfsPath(spawn.x, spawn.y, c.x, c.y), `ch${i} crystal${ci} reachable`);
    });
    w.beacons.forEach((b, bi) => {
      assert(global.bfsPath(spawn.x, spawn.y, b.x, b.y), `ch${i} beacon${bi} reachable`);
    });
    console.log(`  chapter ${i}: walls=${w.walls.length} crystals=${w.crystals.length} doors=${(w.doors || []).length}`);
  }
  X.G.ch = 0;
  global.buildChapter(0);
})();

console.log("== full playthrough ==");
(async () => {
  const G = X.G;
  assert(G.state === "title", "starts on title");
  press("Enter");
  assert(G.state === "intro", "intro shown");
  press("Enter");
  press("Enter");
  assert(G.state === "chapterIntro" && G.ch === 0, "chapter I intro");
  press("Space");
  assert(G.state === "play", "chapter I playing");
  pump(30);

  X.AUD.setMute(true);

  function doLog() {
    assert(G.state === "log", "log opened");
    press("Enter");
    press("Enter");
    assert(G.state === "play", "log closed");
  }
  function goto(x, y, frames) {
    X.player.x = x;
    X.player.y = y;
    X.player.vx = 0;
    X.player.vy = 0;
    pump(frames || 6);
  }

  goto(600, 795);
  doLog();
  goto(600, 1770);
  pump(6);
  goto(600, 2060);
  global.startPing(1, false);
  pump(55);
  assert(X.doors[0].opening, "ch1 song door opened by charged ping");
  goto(600, 2400);
  pump(50);
  assert(G.ch === 1, "advanced to chapter II");
  assert(G.state === "chapterIntro", "chapter II intro");
  press("Space");
  pump(10);

  goto(600, 255);
  doLog();
  goto(340, 1240);
  global.startPing(0.9, false);
  pump(40);
  assert(X.doors[0].opening, "ch2 vault door opened");
  goto(730, 1365);
  assert(X.box.got, "black box recovered");
  assert(X.hunters[0].state === "chase", "hunter awakens for the box");
  pump(30);
  goto(1320, 140);
  pump(60);
  assert(G.ch === 2, "advanced to chapter III");
  press("Space");
  pump(10);

  goto(350, 980);
  global.startPing(0.9, false);
  pump(55);
  assert(X.doors[0].opening, "ch3 door I opened");
  goto(900, 1170);
  doLog();
  goto(1450, 1420);
  global.startPing(0.9, false);
  pump(55);
  goto(1620, 760);
  global.startPing(0.9, false);
  pump(55);
  assert(X.doors[1].opening, "ch3 door II opened");
  goto(900, 1660);
  pump(50);
  assert(G.ch === 3, "advanced to chapter IV");
  press("Space");
  pump(10);

  goto(350, 1230);
  doLog();
  X.player.hull = 0.5;
  const lv = X.lev;
  goto(lv.x, lv.y);
  pump(20);
  assert(G.state === "dead", "leviathan contact kills");
  assert(G.deaths === 1, "death counted");
  pump(160);
  assert(G.state === "play" && G.ch === 3, "respawned at checkpoint");
  assert(X.player.hull === 3, "hull restored on respawn");

  G.flags.escort = true;
  goto(700, 320);
  global.startPing(0.9, false);
  pump(55);
  goto(330, 1120);
  global.startPing(0.9, false);
  pump(55);
  goto(1065, 1750);
  global.startPing(0.9, false);
  pump(55);
  assert(X.doors[0].opening, "ch4 final door opened");
  G.flags.escort = false;
  X.lev.x = 360;
  X.lev.y = 540;
  X.lev.state = "patrol";
  X.player.hull = 3;
  goto(700, 2240);
  pump(60);
  assert(G.ch === 4 && G.state === "chapterIntro", "advanced to chapter V (Surface)");
  press("Space");
  pump(10);

  goto(550, 140);
  pump(60);
  assert(G.state === "endcut", "endcut triggered");
  pump(220);
  assert(G.state === "end", "ending shown");
  press("KeyR");
  assert(G.state === "title", "back to title");

  press("Enter");
  assert(G.state === "chapterIntro" && G.ch === 4, "resume jumps to final chapter");
  press("Space");
  pump(10);

  key("Space", "keydown");
  pump(70);
  key("Space", "keyup");
  assert(G.pings > 0, "charge ping registers");

  console.log("== soak test (long-run stability) ==");
  const fin = (v) => typeof v === "number" && Number.isFinite(v);
  for (let ci = 0; ci < 5; ci++) {
    global.buildChapter(ci);
    G.state = "play";
    G.flags.escort = false;
    key("KeyW", "keydown");
    key("ShiftLeft", "keydown");
    for (let k = 0; k < 6; k++) {
      pump(300);
      global.startPing(Math.random(), k % 2 === 0);
      pump(300);
      if (G.state === "dead") pump(160);
    }
    key("KeyW", "keyup");
    key("ShiftLeft", "keyup");
    let ok = fin(X.player.x) && fin(X.player.y) && fin(X.player.hull);
    if (X.lev) ok = ok && fin(X.lev.x) && fin(X.lev.y) && X.lev.segs.every((s) => fin(s.x) && fin(s.y));
    ok = ok && X.boids.every((b) => fin(b.x) && fin(b.y) && fin(b.vx));
    X.hunters.forEach((h) => { ok = ok && fin(h.x) && fin(h.y); });
    assert(ok, `soak ch${ci} stable over 3600 frames (state=${G.state})`);
  }
  global.buildChapter(0);
  G.state = "title";

  console.log(failures === 0 ? "\nALL TESTS PASSED" : `\n${failures} FAILURES`);
  process.exit(failures === 0 ? 0 : 1);
})().catch((e) => {
  console.log("FAIL uncaught: " + e.stack);
  process.exit(1);
});
