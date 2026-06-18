---
name: ascii-artist
description: Render images, logos, and text as animated ASCII art on an HTML <canvas> — masks sampled from a source image, density-ramp glyphs, particle systems (rain/snow/vapor/sparks), fbm-noise fields (clouds/fog/fire/plasma), and a cheap pseudo-3D camera. Use when building a generative/ASCII canvas effect, an animated logo or splash, a text-to-ASCII renderer, or weather/elemental motion (frost, fire, smoke). Carries the house performance rules that keep these animations from cooking the CPU, plus a recipe for shipping a single self-contained HTML file. Reference implementation: the invinite frozen-gear logo (eetu/logo).
user-invocable: true
---

> **Priors, not rails.** These are the techniques and gotchas distilled from
> building real canvas ASCII effects. Glyph sets, palettes, speeds and particle
> counts are all yours to push — the parts worth keeping are the _structure_
> (mask → cells → per-frame render) and the _performance rules_ (the "why" is
> spelled out so you know when it stops mattering).

## What this is

Draw glyphs on a `<canvas>` 2D context — **not** DOM text — to render a picture
or shape as living ASCII. The canvas gives per-glyph colour, alpha, position and
sub-pixel motion, which `<pre>` text can't. Everything below composes from one
loop: a grid of cells, each cell drawn as a character each frame.

## Source → mask (image / logo / text)

To render an existing image or logo, sample it into a low-res grid once, then
bake the grid into the file as a string array. ImageMagick is the quickest path:

```sh
# isolate the shape (here: alpha of a white-on-transparent logo), trim, then
# sample to a 72×42 grid and dump an ASCII 0/1 bitmap (P1 PBM).
magick logo.png -alpha extract -trim +repage \
  -resize 72x42! -threshold 45% -negate -compress none pbm:-
```

Key trick — **aspect compensation**. A monospace cell is ~0.6 as wide as it is
tall. So a _square_ source must be sampled to a grid that is wider than it is
tall (e.g. 72×42 ≈ 1.7:1); when drawn with `cellW ≈ 0.6·cellH` it comes back
square. Pick `fontSize ≈ cellH`; then the glyph advance (~0.6·fontSize) ≈ cellW,
so glyphs tile naturally.

Parse the PBM into an array of `"0101"` strings and embed it. (For text, render
the string to an offscreen canvas and read pixels the same way; for pure shapes,
generate the mask procedurally.)

## The render model

1. **Precompute cells once.** One entry per lit mask cell: grid `(c,r)`,
   normalized polar coords in the _display square_ (`dx=(c+.5)/COLS-.5`,
   `rN=hypot(dx,dy)/.5`, `ang=atan2`), a stable per-cell random (hash of c,r),
   a chosen glyph, and any per-cell field (reveal order, relief height, phase).
2. **Per frame, for each cell:** compute brightness/colour/alpha from time +
   cell fields, pick a glyph, `fillText`. Keep the maths in the loop; keep
   allocations out of it.

```js
// stable per-cell randomness (no Math.random in the hot loop)
let h = (c * 73856093) ^ (r * 19349663);
h = (h ^ (h >>> 13)) >>> 0; // unsigned! signed >> gives negatives → undefined glyphs
const rnd = (h % 1000) / 1000;
const glyph = GLYPHS[(h >>> 3) % GLYPHS.length]; // use >>> for array indices
```

## Effect toolbox

- **Density ramp** for tone/structure: `" .:-=+*#@"` indexed by a 0..1 value.
  Leading space = empty. This is the ASCII-art workhorse (and the look of the
  classic fire demo).
- **Particle systems** — falling (rain/snow) with ground contact (splashes, a
  per-column accumulating layer, landing puffs); drifting; stationary
  **twinkle** (`alpha = base·|sin(t·speed+phase)|`); **sparks/shards** that
  detach and fall off-screen; soft **vapour** as pre-rendered radial-gradient
  sprites (`drawImage`, not 1000 live gradients).
- **fbm value-noise field** for clouds, fog, smoke, plasma, or a churning
  surface (e.g. a roiling sun): sum 2–3 octaves of bilinear value noise, scroll
  the sample coords over time, carve with a threshold + smoothstep, map through
  a density ramp. Stretch `scaleX < scaleY` to make features streak sideways
  (clouds/fog drift); add a vertical gradient for low-lying fog.
- **Pseudo-3D** so a camera can pan: give each cell a relief height `z`
  (e.g. `z = cos(rN·π/2)` to dome toward the viewer), rotate by an oscillating
  yaw (`sin(t·s)`) ± a little pitch, project with perspective
  `s = focal/(focal+z')`, then **depth-sort** (far→near) and depth-shade
  (nearer = brighter/larger). Even a tiny relief reads as 3D under a gentle pan.
- **Colour**: define a few palette stops and `lerp` between them by a lightness
  param; keep alpha low for backgrounds, high for foreground marks. Tint per
  effect (ice blue, ember orange, etc.).

## Performance — the rules that matter (the why)

These are where canvas ASCII goes wrong. In rough order of impact:

- **Cap the frame rate** with a time accumulator (~24–30 fps). Uncapped `rAF`
  runs at the panel's refresh — 120 Hz does 4× the work for no visible gain.
- **Set `ctx.font` once per frame**, never per glyph. Re-parsing the font string
  ~1000×/frame is the single biggest hot path. (This means a _uniform_ glyph
  size — fake depth with brightness + parallax position, not per-glyph scale.)
- **Cache gradients.** Build radial/linear gradients once (on resize), modulate
  with `globalAlpha`; never `createRadialGradient` + full-screen fill per frame.
- **Cap DPR** to ~1.5. `devicePixelRatio` 2–3 multiplies every fill; 1.5 is
  plenty for glyphs.
- **No per-frame allocations** in the loop. Write projection results onto the
  cell objects; reuse a draw-order index array; pre-render sprites.
- **Pause when hidden** (`visibilitychange` → `cancelAnimationFrame`). Zero CPU
  in a background tab — important for always-on / wall displays.
- **Respect `prefers-reduced-motion`** — render a single static frame, no loop.

## Shipping a single file

Develop with assets as separate files (`new Audio("wow.mp3")`, etc.) so they're
editable; ship one self-contained `.html` via a tiny build step that inlines
each referenced asset as a `data:` URI. A ~40-line `build.mjs` (scan referenced
filenames → base64 → replace) is enough — see eetu/logo `build.mjs`. The result
drops into any static host or a 2-line nginx Dockerfile.

## Reference

`eetu/logo` — the invinite frozen-gear mark: image→mask, frost density ramp,
freeze-in reveal, rotating ice highlight, cryo-vapour sprites, falling sparkle
shards, a dome + yaw camera, and the full performance + single-file-build setup.
