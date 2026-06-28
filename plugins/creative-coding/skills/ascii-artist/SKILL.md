---
name: ascii-artist
description: Render images, logos, and text as animated ASCII art on an HTML <canvas> — masks sampled from a source image, density-ramp glyphs, particle systems (rain/snow/vapor/sparks), fbm-noise fields (clouds/fog/fire/plasma), and a cheap pseudo-3D camera. Use when building a generative/ASCII canvas effect, an animated logo or splash, a text-to-ASCII renderer, or weather/elemental motion (frost, fire, smoke). Carries the house performance rules that keep these animations from cooking the CPU. Reference implementation: the invinite frozen-gear logo (eetu/logo).
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
  For parallax that follows the user, drive the yaw/pitch from the **pointer or
  device tilt**, eased toward the target with a dt-based factor
  (`a += (target-a)·(1-exp(-dt·k))`) so it glides instead of snapping.
- **Specular glint** that reads as a lit 3D surface (vs a flat rotating wedge):
  give each cell a hemisphere dome normal `N`, and brightness
  `pow(max(0, N·H), k)` where `H` is the normalized half-vector of a slowly
  orbiting light plus the `+z` view direction. The highlight rakes _across_ the
  relief as the light moves.
- **Additive bloom**: a second pass over the brightest cells with
  `globalCompositeOperation = "lighter"`, stamping a soft radial-gradient sprite
  — gives glints/embers a halo. Flip the composite mode once per frame, not per
  cell.
- **Colour**: define a few palette stops and `lerp` between them by a lightness
  param; keep alpha low for backgrounds, high for foreground marks. Tint per
  effect (ice blue, ember orange, etc.). A travelling "event" can recolour cells
  toward a second palette (e.g. a melt front blending ice→magma) keyed off a
  per-cell phase so it sweeps across the mark.

## Starter skeleton

The HiDPI canvas + capped loop the rules below tune. Size the backing store by
DPR, scale the context once so you draw in CSS pixels, and gate the loop on a
time accumulator:

```js
const dpr = Math.min(window.devicePixelRatio || 1, 1.5); // see DPR cap below
function resize() {
  const cssW = canvas.clientWidth,
    cssH = canvas.clientHeight;
  canvas.width = cssW * dpr;
  canvas.height = cssH * dpr; // backing store
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0); // draw in CSS px; rebuild gradients here
}
addEventListener("resize", resize);
resize();

const FRAME = 1000 / 30; // ~30 fps cap
let last = 0,
  acc = 0;
function loop(now) {
  acc += now - last;
  last = now;
  if (acc >= FRAME) {
    acc = Math.min(acc - FRAME, FRAME); // spend one frame, don't spiral
    ctx.font = `${fontSize}px monospace`; // set once per frame, not per glyph
    render(now);
  }
  requestAnimationFrame(loop);
}
requestAnimationFrame((now) => {
  last = now;
  loop(now);
});
```

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
  plenty for glyphs. Drop to ~1.25 on touch (`pointer: coarse`) — phones are
  fill-rate bound, especially with big soft sprites.
- **Throttle the depth-sort.** The far→near order drifts slowly under a gentle
  pan, so re-sort every ~8 frames, not every frame (~85% less sort work). Still
  project every cell every frame — it's only the sort you skip.
- **No per-frame allocations** in the loop. Write projection results onto the
  cell objects; reuse a draw-order index array; pre-render sprites.
- **Pause when hidden** (`visibilitychange` → `cancelAnimationFrame`). Zero CPU
  in a background tab — important for always-on / wall displays.
- **Respect `prefers-reduced-motion`** — render a single static frame, no loop.

## Reference

`eetu/logo` — the invinite frozen-gear mark: image→mask, frost density ramp,
freeze-in reveal, a specular ice glint, a magma melt/refreeze cycle, additive
bloom, cryo-vapour sprites, falling sparkle shards, and a pointer-driven dome +
yaw camera — with the full performance setup.
