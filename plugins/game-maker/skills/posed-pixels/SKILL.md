---
name: posed-pixels
description: Draw pixel art that moves without tearing. Paint a thing once at rest through a recording canvas context into a pixel list per part, then each frame put every part back where its pose says, into one ImageData buffer per painting, and blit it. Covers part kinds (bending wood, clumps, fruit, still), re-baking on a coarse key, room boxes, a stable per-pixel rank (leaves turning over leaf by leaf, rot and moss creeping), turning a whole painting about a ground pivot (a tree going over, its root plate rising), skipping paintings that are not moving, and quarter-turn sprites. Use when animating anything painted procedurally in pixels: trees and shrubs in the wind, a falling or toppling object, a sprite that bends, sways, rots or turns over. Use before reaching for row shifts or ctx.rotate on pixel art.
user-invocable: true
---

> **Priors, not rails.** Use the split between painting and posing as it is: the
> painter knows how a thing looks, the pose knows how far each part has moved.
> The part kinds, the rank formula and the margins are what one small wood
> needed. Grow them for yours.

# posed-pixels

Moving a pixel-art painting looks wrong in two common ways: it tears, or it
smears. The fix is to never move the canvas. Record the painting as a list of
whole pixels, grouped by part. Each frame, offset every pixel by its part's
displacement, rounded to whole pixels, and write it into a buffer. Bark keeps its
texture, leaves keep their pattern, and every pixel stays a palette colour.

The motion itself (how far each part has moved) is a separate concern. See
`game-maker:wind-and-springs`.

## Traps this replaces

- **Row-shifting reads as tearing.** If each row of a sprite slides sideways by
  its own wind offset, a trunk breaks into stair steps that crawl, and leaves
  slide off their branches. Connected wood has to move together. Each piece's
  base rides its parent's end, so the joints never open.
- **`ctx.rotate` or `ctx.scale` on pixel art.** With smoothing on, edges blur
  into colours that aren't in the palette. With smoothing off, nearest-neighbour
  sampling drops and doubles different pixels every frame, and the art shimmers.
  Quarter turns are the exception: they map pixels one-to-one (below). The only
  scale is the whole scene's, once, to the display: a canvas of scene × k with
  smoothing off. A sprite scaled up on its own, even by a whole number, has
  coarser pixels than the scene around it; a near object keeps the scene's
  detail level and is sized in scene pixels (`game-maker:depth-and-lod`).

## The model

1. **Bake.** Call the painter with a recorder in place of a canvas. The brush
   contract is: _set `fillStyle`, `fillRect` whole pixels_. That is everything
   the recorder implements, so any brush that keeps to it can be recorded. See
   `game-maker:pixel-brushes`. Before each part, the painter announces it, and
   the recorder starts a new run.
2. **Pose.** Every frame, for each part, offset its pixels and write their RGBA
   words into a `Uint32Array` view over the painting's own `ImageData`.
3. **Blit.** `putImageData` into the painting's canvas, then `drawImage` that
   canvas into the scene at the box corner.

```ts
type Part =
  | { kind: "wood"; i: number; a: Pt; b: Pt } // a piece that bends a→b
  | { kind: "clump" | "fruit"; i: number } // rides one offset
  | { kind: "still" }; // never moves
type Painter = (ctx: CanvasRenderingContext2D, part: (p: Part) => void) => void;
type Pose = { a: Pt[]; b: Pt[]; clumps: Pt[]; fruit: Pt[]; turned?: number[] };

// The recorder: a fake ctx that only remembers which pixels got which colour.
const recorder = {
  set fillStyle(c: string) {
    fill = c;
  },
  fillRect(x: number, y: number, w: number, h: number) {
    for (let py = Math.round(y); py < Math.round(y + h); py++)
      for (let px = Math.round(x); px < Math.round(x + w); px++) {
        xs.push(px);
        ys.push(py);
        colours.push(wordOf(fill));
        along.push(
          piece ? alongOf({ x: px + 0.5, y: py }, piece.a, piece.b) : 0,
        );
      }
  },
} as unknown as CanvasRenderingContext2D;
```

`wordOf` turns a CSS colour into an `ImageData` word: little-endian
`(a<<24)|(b<<16)|(g<<8)|r`. It does this once per colour, by painting it on a 1×1
probe canvas and reading it back. That means any CSS colour string works, and
the cost is a single `Map` lookup per pixel at bake time.

## Parts and how they move

- **Wood** has an offset at each end (`pose.a[i]`, `pose.b[i]`). At bake time,
  each pixel stores `along`: how far along `a→b` it lies, 0..1. When posing, the
  pixel moves by the offset interpolated at `along`, so the piece bends along
  its length and doesn't shear between rows. The rig decides the end offsets; a
  child's base gets the same offset as the point on its parent it grows from.
- **Clump / fruit** move as one block by a single offset. A leaf clump's
  flutter, or an apple hanging off its piece, rides that offset.
- **Still** parts are never offset: a sapling's two leaves, a root plate. They
  still turn with the painting.
- **Painting order is draw order.** There is no z-sort. Later parts overwrite
  earlier ones, so paint wood, then leaves, then fruit.
- Round each offset (`Math.round`) before applying it. A part moves a whole
  pixel at a time and never splits across two.

Soft plants with no skeleton use the same pose shape. Every stem piece is a
`wood` part whose end offsets come from a rod's bend, `d·s^1.5` at height
fraction `s`, and leaves are clumps riding their stem
(`game-maker:wind-and-springs`).

## The cache: name, key, box

`drawPosed(ctx, name, key, paint, pose, room?)` keeps one baked painting per
`name`. When the `key` changes, it re-bakes.

- **Name each thing on screen, not each version of it.** Give a slot whose tree
  is replaced by a sapling the same name (`tree${slot}`, `down${slot}`). A name
  per generation (`down${slot}:${n}`) leaks one bake per generation for as long
  as the world runs.
- **Keep keys coarse.** A bake allocates every list again. Build the key from
  quantized state, e.g.
  `` `${seed}|${life.n}|${growthStep}|${season}|${Math.round(p * 24)}|${deadStep}` ``.
  Growth comes in 40 steps and the season's progress in 24, so a tree re-bakes
  every few seconds of world time, not every frame (`game-maker:world-clock`
  owns the stepping).
- **Box = pixel bounds ± `MARGIN` (12 px).** This is the room to sway. The
  biggest swing in the wood is about 10 px at a twig tip; anything that moves
  past the box is clipped silently.
- **A painting that turns needs a `Room`.** A painting that sweeps a quarter
  circle leaves its own bounds. Compute the box once, by rotating the
  painting's points about the pivot at several angles (nine, from 0 to the lying
  angle). Pad it by 12 and stop it at the ground, because nothing below the
  ground is drawn.

## Per-pixel rank: change pixel by pixel, never all at once

At bake time, each pixel gets `rank ∈ [0,1)`, a hash of its position:

```ts
rank[k] = (Math.imul(x * 73 + y * 151, 2654435761) >>> 0) / 2 ** 32;
```

The hash depends only on position, so a pixel keeps its rank across frames and
across re-bakes. Any gradual change becomes a threshold against rank:

- **Leaves turning over.** The pose carries `turned[i]` per clump, and a pixel
  shows its underside when `rank < turned`. The underside is the colour taken
  55% of the way to a pale grey-green, and it is precomputed per pixel at bake
  time. Flipping a whole clump at a threshold reads as blinking. With the rank,
  a clump silvers leaf by leaf, as long as `turned` itself ramps smoothly (on a
  wave crest; `game-maker:wind-and-springs`).
- **Rot and moss on something lying down.** Combine rank with `low`, which is 1
  at the ground and 0 at `ROT_REACH` (14 px) above it:

  ```ts
  if (gone > 0.4 * rank + 0.6 * low) continue; // what sticks up crumbles first
  // moss climbs from the ground
  if (moss > (1 - low) * 0.8 + rank * 0.25)
    word = mosses[Math.floor(rank * 997) % mosses.length];
  ```

  The right-hand sides reach 1.0 and 1.05. Drive `gone` to 1.05 and `moss` to
  1.1, or the last pixels never go.

## Turning a whole painting over

`pose.over = { about, angle, sunk, moss, gone, mosses }` rotates every posed
pixel about a pivot on the ground, then shifts it down by `sunk`. Pixels below
the pivot's ground line are not drawn.

- **Pivot on the trunk's edge on the falling side**:
  `root.x + side·(trunkWidth/2 + 0.5)`. A pivot at the trunk's centre buries half
  the trunk once the tree is down.
- **Forward-mapping leaves holes** at any angle that isn't a quarter turn. When
  `|sin 2θ| > 0.05`, each written pixel also fills its right neighbour, if that
  neighbour is empty. Nobody sees the slight thickening during a 2.4 s fall.
  Down, the tree lies at exactly `π/2` (after a brief bounce), so it needs no
  fill and stays pixel-exact.
- **The root-plate trick.** Paint the root plate under the ground at the foot,
  as a `still` part, and only in the fallen tree's painter. While the tree
  stands, the plate is clipped as underground. As the painting turns, the half
  of the plate on the far side of the pivot rotates up out of the ground and
  stands where the tree stood. That is the physics, with no extra code.
- During the fall, use the swaying pose with `over` added on top, so it keeps
  moving in the wind until it lands. Lying, use an all-zero rest pose. The
  impact hides the switch between the two. Timing and easing belong to
  `game-maker:wind-and-springs`.

## Skip what isn't moving

`pose.still` is a signature string. If it matches the one last drawn, posing
and `putImageData` are skipped and the cached canvas is blitted again. A log
lying in a box of about 350×200 px would otherwise cost a full buffer fill and
put every frame. Build the signature from the quantized values that change what
you see, e.g. `` `${sunk}|${round(moss*40)}|${round(gone*40)}|${palette}` ``.
Leave it `undefined` while anything moves, such as the bounce.

## Quarter turns are free

A small sprite that tumbles in 90° steps, like a wall piece falling, can use
`ctx.rotate(k·π/2)` after an integer `translate`. A quarter turn maps pixels
one-to-one, so there are no holes, no smoothing and no ImageData. Translate to
the corner of the turned box (`[0,0]`, `[h,0]`, `[w,h]`, `[0,w]` for `k` = 0..3).
Do the same for pieces at rest: read the sprite back as data once and index
each turned pixel into it when painting the rubble layer.

## Cost

- A pixel costs one loop iteration per frame, plus a rotation if it is turned.
  Clearing the buffer and `putImageData` cost in proportion to box area. Keep
  boxes tight; only a `Room` is big.
- As a yardstick: a 320×180 scene with six trees, shrubs, climbers, grass
  tufts, a falling or lying tree, a crumbling wall and the sky, all posed every
  frame, takes about 4 ms per frame on a laptop. Measure with the harness in
  `game-maker:game-workbench`.
- The bake costs far more than the pose. If a profile shows bakes inside the
  frame loop, a key isn't quantized.
- **Big paintings: pose into one shared sheet.** Once trees grow to fill the
  scene, the per-painting upload and blit dominate, not the pixel loop. Give
  the paintings of one depth band a single scene-sized buffer: each poses its
  pixels straight into it at scene coordinates, in draw order (later ones
  overwrite, as separate blits would), widening a dirty rectangle. Then one
  `putImageData` and one `drawImage` of just that rectangle. Clear only last
  frame's rectangle. Six large trees went from 4.3 to 2.1 ms this way. A
  painting that is `still` (a lying log) keeps its own canvas and cache.
- **Offscreen layers at scene size, not device size.** Everything here lands on
  whole scene pixels, so a layer for clipping or shading (the wall's gaps, the
  night) can be `SCENE_W × SCENE_H` and drawn up through the context's transform.
  At 3× that is nine times fewer pixels per pass; on a large display, more.
- **A canvas per layer per frame.** Never draw an offscreen canvas, refill it
  (`putImageData`, `clearRect`, more drawing) and draw it again in the same
  frame. Safari draws one canvas onto another lazily, so both draws can show
  the second contents. A layer drawn first then blinks out on some frames.
  Pixels read back from the canvas (`toDataURL`, headless Chromium captures)
  never show this, so test in Safari when a blink can't be caught. A layer
  redrawn with the same contents is harmless.

## Related

- `game-maker:wind-and-springs`: the poses (rig offsets, rod bends, `turned`,
  the topple).
- `game-maker:pixel-brushes`: the painters a recorder can take.
- `game-maker:procedural-plants`: the plans being painted, the root plate.
- `game-maker:world-clock`: the stepped keys.
