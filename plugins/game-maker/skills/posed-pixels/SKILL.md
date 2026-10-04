---
name: posed-pixels
description: Draw pixel art that moves without tearing. Paint a thing once at rest through a recording canvas context into a pixel list per part, then each frame put every part back where its pose says, into one ImageData buffer per painting (or one shared sheet per depth band), and blit it. Covers part kinds (bending wood, clumps, fruit, still), re-baking on a coarse key, room boxes, a stable per-pixel rank (leaves turning over leaf by leaf, rot and moss creeping), turning a whole painting about a ground pivot (a tree going over, its root plate rising), skipping paintings that are not moving, quarter-turn sprites, and the cost rules for offscreen layers (scene-sized, one canvas per layer per frame, which Safari needs). Use when animating anything painted procedurally in pixels: trees and shrubs in the wind, a falling or toppling object, a sprite that bends, sways, rots or turns over; before reaching for row shifts or ctx.rotate on pixel art; or when a layer blinks out in one browser only.
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

How far each part has moved is `game-maker:wind-and-springs`.

## Traps this replaces

- **Row-shifting reads as tearing.** If each row slides sideways by its own wind
  offset, a trunk breaks into crawling stair steps and leaves slide off their
  branches. Connected wood moves together: each piece's base rides its parent's
  end, so the joints never open.
- **`ctx.rotate` or `ctx.scale` on pixel art.** With smoothing on, edges blur
  into colours off the palette; with it off, nearest-neighbour sampling drops
  and doubles different pixels every frame, and the art shimmers. Quarter turns
  are the exception (below). The only scale is the whole scene's
  (`game-maker:depth-and-lod`).

## The model

1. **Bake.** Call the painter with a recorder in place of a canvas. The brush
   contract is _set `fillStyle`, `fillRect` whole pixels_
   (`game-maker:pixel-brushes`), which is all the recorder implements. Before
   each part, the painter announces it, and the recorder starts a new run.
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

`wordOf` turns a CSS colour into an `ImageData` word (little-endian
`(a<<24)|(b<<16)|(g<<8)|r`) once per colour, by painting it on a 1×1 probe canvas
and reading it back: any CSS colour works, for one `Map` lookup per pixel at
bake time.

## Parts and how they move

- **Wood** has an offset at each end (`pose.a[i]`, `pose.b[i]`). Each pixel
  stores `along`, how far along `a→b` it lies; posed, it moves by the offset
  interpolated there, so the piece bends along its length instead of shearing.
  A child's base gets the offset of the point on its parent it grows from.
- **Clump / fruit** move as one block by a single offset.
- **Still** parts (a sapling's leaves, a root plate) are never offset, but still
  turn with the painting.
- **Painting order is draw order.** Later parts overwrite earlier ones: wood,
  then leaves, then fruit.
- Round each offset before applying it, so a part moves a whole pixel at a time
  and never splits across two.

Soft plants with no skeleton use the same pose shape: every stem piece is a
`wood` part whose end offsets come from a rod's bend, and leaves are clumps
riding their stem (`game-maker:wind-and-springs`).

## The cache: name, key, box

`drawPosed(ctx, name, key, paint, pose, room?)` keeps one baked painting per
`name`, re-baked when the `key` changes.

- **Name each thing on screen, not each version of it.** A slot whose tree is
  replaced by a sapling keeps one name (`tree${slot}`); a name per generation
  leaks one bake per generation for as long as the world runs.
- **Keep keys coarse.** A bake allocates every list again. Build the key from
  quantised state (`game-maker:world-clock`), so a tree re-bakes every few
  seconds of world time, not every frame.
- **Box = pixel bounds ± 12 px**, the room to sway; the biggest swing is about
  10 px at a twig tip, and anything past the box is clipped silently.
- **A painting that turns needs a `Room`.** Sweeping a quarter circle leaves its
  own bounds. Compute the box once by rotating the painting's points about the
  pivot at nine angles from 0 to the lying angle; pad by 12 and stop it at the
  ground.

## Per-pixel rank: change pixel by pixel, never all at once

At bake time, each pixel gets `rank ∈ [0,1)`, a hash of its position:

```ts
rank[k] = (Math.imul(x * 73 + y * 151, 2654435761) >>> 0) / 2 ** 32;
```

It depends only on position, so it holds across frames and re-bakes. Any gradual
change becomes a threshold against rank:

- **Leaves turning over.** The pose carries `turned[i]` per clump; a pixel shows
  its underside (its colour 55% of the way to a pale grey-green, precomputed)
  when `rank < turned`. Flipping a whole clump reads as blinking; with the rank it
  silvers leaf by leaf, as long as `turned` ramps smoothly.
- **Rot and moss on something lying down**, with `low` 1 at the ground and 0 at
  14 px above it:

  ```ts
  if (gone > 0.4 * rank + 0.6 * low) continue; // what sticks up crumbles first
  // moss climbs from the ground
  if (moss > (1 - low) * 0.8 + rank * 0.25)
    word = mosses[Math.floor(rank * 997) % mosses.length];
  ```

  The right-hand sides reach 1.0 and 1.05: drive `gone` to 1.05 and `moss` to
  1.1, or the last pixels never go.

## Turning a whole painting over

Something that must stay level on a painting turned over whole (a shelf fungus
grown on a fallen trunk) is drawn **pre-turned back** about its own anchor, so
the painting's turn leaves it level. At a quarter turn this is exact: a quarter
turn moves whole pixels, `(dx, dy) → (dy, −dx)` back for `(−dy, dx)` forward.

`pose.over = { about, angle, sunk, moss, gone, mosses }` rotates every posed
pixel about a pivot on the ground, then shifts it down by `sunk`. Pixels below
the pivot's ground line are not drawn.

- **Pivot on the trunk's edge on the falling side**,
  `root.x + side·(trunkWidth/2 + 0.5)`. At the trunk's centre, half the trunk is
  buried once the tree is down.
- **Forward-mapping leaves holes** at any angle that isn't a quarter turn. When
  `|sin 2θ| > 0.05`, each written pixel also fills its empty right neighbour;
  nobody sees the slight thickening during a fall. Down, the tree lies at exactly
  `π/2`, so it stays pixel-exact.
- **The root-plate trick.** Paint the root plate under the ground at the foot, as
  a `still` part, in the fallen tree's painter only. Standing, it is clipped as
  underground; as the painting turns, the half beyond the pivot rotates up out of
  the ground and stands where the tree stood, with no extra code.
- During the fall, use the swaying pose with `over` on top, so it keeps moving in
  the wind until it lands; lying, an all-zero rest pose. The impact hides the
  switch.

## Skip what isn't moving

`pose.still` is a signature string. If it matches the one last drawn, posing and
`putImageData` are skipped and the cached canvas is blitted again (a lying log's
box would otherwise cost a full fill and put every frame). Build it from the
quantised values that change what you see (`` `${sunk}|${round(moss*40)}|…` ``);
leave it `undefined` while anything moves.

## Quarter turns are free

A small sprite that tumbles in 90° steps can use `ctx.rotate(k·π/2)` after an
integer `translate` to the corner of the turned box (`[0,0]`, `[h,0]`, `[w,h]`,
`[0,w]` for `k` = 0..3): a quarter turn maps pixels one-to-one, so there are no
holes, no smoothing and no ImageData. For a layer of such sprites at rest, read
each sprite back as data once and index each turned pixel into it. Turns between
quarters belong to `game-maker:depth-and-lod`.

## Cost

- A pixel costs one loop iteration per frame, plus a rotation if turned.
  Clearing the buffer and `putImageData` cost in proportion to box area: keep
  boxes tight; only a `Room` is big. The bake costs far more than the pose: a
  profile showing bakes in the frame loop means a key isn't quantised.
- As a yardstick, a 320×180 scene with six trees, shrubs, climbers, grass, a
  falling tree, a crumbling wall and the sky, all posed every frame, takes about
  4 ms a frame on a laptop (`game-maker:game-workbench` measures it).
- **Big paintings: pose into one shared sheet.** Once paintings fill the scene,
  the per-painting upload and blit dominate. Give one depth band a single
  scene-sized buffer: each painting poses its pixels straight into it, in draw
  order, widening a dirty rectangle; then one `putImageData` and one `drawImage`
  of that rectangle, and clear only last frame's. This halved six large trees'
  cost. A `still` painting keeps its own canvas and cache.
- **Offscreen layers at scene size, not device size.** Everything lands on whole
  scene pixels, so a layer for clipping or shading can be `SCENE_W × SCENE_H` and
  drawn up through the context's transform: nine times fewer pixels at 3×.
- **A canvas per layer per frame.** Never draw an offscreen canvas, refill it
  (`putImageData`, `clearRect`, more drawing) and draw it again in the same
  frame: Safari draws one canvas onto another lazily, so both draws can show the
  second contents and the first layer blinks out on some frames. Tiles of a grid
  drawn in one frame count too. Pixels read back from the canvas (`toDataURL`,
  headless Chromium captures) never show this, so test in Safari when a blink
  can't be caught. A layer redrawn with the same contents is harmless.

## Related

- `game-maker:wind-and-springs`: the poses (rig offsets, rod bends, `turned`,
  the topple).
- `game-maker:pixel-brushes`: the painters a recorder can take.
- `game-maker:procedural-plants`: the plans being painted.
- `game-maker:world-clock`: the stepped keys.
