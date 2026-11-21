# EMBERWAKE — *A Night in the Lamp Room*

You are the Lampkeeper of Vell. Tonight is the longest night of the year, your oil is low,
and one small flame is the only thing between a sleeping town and the dark.

**Your light is your life and your only currency.** Everything you give away to the people
who climb your tower visibly lights the town below — and visibly dims the room you live in.
The game is about what you are willing to spend.

---

## Play it

Open `index.html` in a browser, or serve the folder statically (GitHub Pages works):

```
python3 -m http.server 8000     # then visit http://localhost:8000/
```

## Controls

| Key | Meaning |
|---|---|
| `SPACE` | strike the flame's heartbeat · open the door · feed the flame |
| `1` `2` `3` | choose what to give away |
| `W` `A` `S` `D` | brace the lantern against the wind |
| `M` | mute |
| `ENTER` | begin / stand another watch |

Designed for a desktop browser (keyboard, optional mouse on the choice cards). Headphones
recommended — the flame has a heartbeat and so does the score.

## The four acts

1. **The Heart** — a rhythm mechanic. The flame swells just before each beat; strike with it.
   The beats get faster, narrower and eventually double.
2. **The Visitors** — people climb the stairs. Open the door on the beat, read what they need,
   and decide which of your three gifts to hand over. The wrong gift costs more than the right one.
3. **The Storm** — everything at once. Keep feeding the flame while bracing the lantern
   against gusts from four directions. The climax.
4. **Dawn** — one last decision about the little boat still out on the water, and the ending
   you earn from how generous (or how careful) you were.

Five endings, including the one where the flame simply goes out.

## How it's built

No engine, no art assets, no audio files, no dependencies.

| File | Role |
|---|---|
| `index.html` | structure + HUD markup |
| `css/style.css` | typography, HUD, cards, overlays |
| `js/util.js` | math helpers |
| `js/audio.js` | WebAudio synthesis: fire crackle, wind, rain, thunder, a generative pentatonic score per act |
| `js/flame.js` | the flame — a domain-warped noise shader on a fullscreen quad, rendered at half resolution and screen-blended over the room so its light spills onto the architecture |
| `js/scene.js` | procedural Canvas2D scenery: curved glass wall, the sleeping town of Vell, weather, visitors, the engraved ember ring |
| `js/ui.js` | captions (typewriter), prompts, choice cards, act cards, endings |
| `js/game.js` | state machine, the four acts, scoring and balance |

Three composited layers: a Canvas2D backdrop, a WebGL flame layer (`mix-blend-mode: screen`),
and a Canvas2D foreground for the brass, the visitors and the weather.
