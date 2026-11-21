// ---------------------------------------------------------------------------
// THE TIDE ENGINE — bootstrap
// ---------------------------------------------------------------------------
import { initRenderer, ST } from './render.js';
import { Game } from './game.js';

const canvas = document.getElementById('game');
initRenderer(canvas);

const game = new Game();
game.attach(canvas);
window.__game = game;

const pre = document.getElementById('preload');
if (pre) pre.remove();

let last = performance.now();
let acc = 0;
let frames = 0;
let fps = 60;

function frame(now) {
  requestAnimationFrame(frame);
  if (window.__pause) { last = now; return; }
  let dt = (now - last) / 1000;
  last = now;
  if (dt > 0.1) dt = 0.1;
  acc += dt; frames++;
  if (acc > 0.5) { fps = frames / acc; acc = 0; frames = 0; window.__fps = fps; }
  try {
    game.update(dt);
    game.draw(dt);
  } catch (err) {
    if (!window.__errShown) { window.__errShown = 1; console.error('GAME ERROR', err && err.stack ? err.stack : err); }
  }
}
requestAnimationFrame(frame);
