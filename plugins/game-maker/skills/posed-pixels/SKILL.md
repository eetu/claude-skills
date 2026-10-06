---
name: posed-pixels
description: Draw pixel art that moves without tearing — paint a thing once at rest, part by part, then each frame put every recorded pixel back where its part's pose says, at its own depth, through any pen. `@anarkisti/korpi/posed` implements it (`posedOf`, `Part`, `Pose`, `Over`, `Painter`); this skill is how to drive it and why it works so — part kinds (bending wood, clumps, fruit, still), names and coarse keys, a stable per-pixel rank (leaves turning over leaf by leaf, rot and moss creeping), turning a whole painting about a ground pivot (a tree going over, its root plate rising), replaying what is still, quarter turns, and the costs. Use when animating anything painted procedurally in pixels: trees and shrubs in the wind, a falling or toppling object, a painting that bends, sways, rots or turns over; before reaching for row shifts or a rotated canvas on pixel art; or when posed pixels tear, blink or cost too much.
user-invocable: true
---

> **Priors, not rails.** Keep the split between painting and posing: the
> painter knows how a thing looks, the pose knows how far each part has moved.
> The part kinds and the rank formula are what one small wood needed.

# posed-pixels

Moving a pixel-art painting looks wrong in two common ways: it tears, or it
smears. The fix is to never move a picture. Record the painting as a list of
whole pixels, grouped by part. Each frame, offset every pixel by its part's
displacement, rounded to whole pixels, and fill it through a pen. Bark keeps its
texture, leaves keep their pattern, and every pixel stays a palette colour.

**Use `posedOf({ max })` from `@anarkisti/korpi/posed`**: its
`draw(pen, name, key, paint, pose)` bakes `paint` (a `Painter`,
`(pen, part) => void`) once per `key` and poses it every call. How far each part
has moved is `game-maker:wind-and-springs` (`poseOf`, `rustleOf`, in metres, y
up); `posePx` from `@anarkisti/korpi/plants/paint` turns those moves into a
pixel `Pose`. korpi's `standPainterOf` and `meadowPainterOf` already pose a
stand's trees and a meadow's flowers.

## Traps this replaces

- **Row-shifting reads as tearing.** If each row slides by its own wind offset,
  a trunk breaks into crawling stair steps and leaves slide off their branches.
  Connected wood moves together: each piece's base rides its parent's end, so
  the joints never open.
- **Rotating or scaling pixel art.** Smoothed, edges blur into colours off the
  palette; nearest-neighbour drops and doubles different pixels every frame, and
  the art shimmers. Quarter turns are the exception (below); the only scale is
  the whole scene's (`game-maker:depth-and-lod`).

## The model

1. **Bake.** The painter paints through a recording pen. It only fills whole
   pixels at a depth (`game-maker:pixel-brushes`), and announces each part
   before painting it (`part({ kind: "wood", i, a, b })`), which starts a new run.
2. **Pose.** Every frame, each part's pixels are offset by its pose and filled
   through the caller's pen, **each at the depth it was painted at**, so a
   posed tree sits in the scene raster at true depth (`shifted(pen, { dd })`
   puts a plant's depth 0 where it stands).

`posed` keeps a translucent pixel and blends it where it lands; korpi's general
`recorder` (for posing of your own) refuses a translucent fill, since it can't
be re-posed over what changes beneath it.

## Parts and how they move

- **Wood** has an offset at each end (`pose.a[i]`, `pose.b[i]`). Each pixel
  stores how far along `a→b` it lies (`alongOf`); posed, it moves by the offset
  interpolated there, so the piece bends instead of shearing. A child's base
  gets the offset of the point on its parent it grows from.
- **Clump / fruit** move as one block by a single offset.
- **Still** parts (a sapling's leaves, a root plate) are never offset, but still
  turn with the painting.
- **Painting order is draw order** at equal depth (a tie goes to the later
  fill): wood, then leaves, then fruit.
- Each offset is rounded before it is applied, so a part moves a whole pixel at
  a time and never splits across two.

Soft plants with no skeleton use the same pose: every stem piece is a `wood`
part whose end offsets come from a rod's bend, and leaves are clumps riding
their stem.

## Names and keys

- **Name each thing on screen, not each version of it.** A slot whose tree is
  replaced by a sapling keeps one name (`tree${slot}`); a name per generation
  fills the cache with one bake per generation. `max` bounds it.
- **Keep keys coarse.** A bake allocates every list again. Build the key from
  quantised state (`game-maker:world-clock`), so a tree re-bakes every few
  seconds of world time, not every frame. A profile showing bakes in the frame
  loop means a key isn't quantised; `inspect()` counts them.

## Per-pixel rank: change pixel by pixel, never all at once

At bake time each pixel gets `rank ∈ [0,1)`, a hash of its position:

```ts
rank[k] = (Math.imul(x * 73 + y * 151, 2654435761) >>> 0) / 2 ** 32;
```

It depends only on position, so it holds across frames and re-bakes. Any gradual
change becomes a threshold against it:

- **Leaves turning over.** `pose.turned[i]` per clump; a pixel shows its
  underside (55% of the way to a pale grey-green, precomputed) when
  `rank < turned`. A whole clump flipping reads as blinking; by rank it silvers
  leaf by leaf, as long as `turned` ramps smoothly.
- **Rot and moss on something lying down**, with `low` 1 at the ground and 0 at
  14 px above it: a pixel is gone once `gone > 0.4·rank + 0.6·low` (what sticks
  up crumbles first), and mossed once `moss > (1 − low)·0.8 + rank·0.25` (moss
  climbs from the ground). The right-hand sides reach 1.0 and 1.05: drive
  `gone` to 1.05 and `moss` to 1.1, or the last pixels never go.

## Turning a whole painting over

`pose.over` (`Over`: `about`, `angle`, `sunk`, `moss`, `gone`, `mosses`) turns
every posed pixel about a pivot on the ground, then sinks it by `sunk` px;
pixels below the pivot's ground line are not drawn.

- **Pivot on the trunk's edge on the falling side**,
  `root.x + side·(trunkWidth/2 + 0.5)`. At the trunk's centre, half the trunk is
  buried once the tree is down.
- **Forward-mapping leaves holes** at angles off the square. When
  `|sin 2θ| > 0.05`, each pixel also fills its empty right neighbour, a hair
  behind so it never wins over anything else; nobody sees the slight thickening
  during a fall. Down, the tree lies at exactly `π/2`, pixel-exact.
- **The root-plate trick.** Paint the root plate under the ground at the foot,
  as a `still` part, in the fallen tree's painter only (`paintRootPlate`).
  Standing, it is clipped as underground; as the painting turns, the half
  beyond the pivot rises out of the ground where the tree stood, with no extra
  code.
- **Something level on a painting turned over** (a shelf fungus on a fallen
  trunk) is drawn pre-turned back about its own anchor, so the turn leaves it
  level. At a quarter turn this is exact: `(dx, dy) → (dy, −dx)` back for
  `(−dy, dx)` forward.
- During the fall, sway with `over` on top, so it keeps moving in the wind
  until it lands; lying, an all-zero rest pose. The impact hides the switch.

## Replay what is still

`pose.still` names a pose that doesn't move: posed once, its pixels are kept
and replayed while the name holds (a lying log would otherwise be posed in
full every frame). Build it from the quantised values that change what you see
(`` `${sunk}|${Math.round(moss * 40)}|…` ``; korpi's `Down` carries `still` and
`key`); leave it `undefined` while anything moves.

## Quarter turns are free

A quarter turn maps pixels one-to-one, `(dx, dy) → (−dy, dx)`: a small piece
tumbling in 90° steps turns its pixel list with no holes and no resampling.
Turns between quarters, of a block out of the picture plane, are
`game-maker:depth-and-lod`.

## Cost

- A pixel costs one loop iteration and one fill per frame, plus a rotation if
  turned; a bake costs far more than a pose.
- korpi's yardsticks (M4 Pro, 320×180): a sapling of 12 pieces poses in 19 µs,
  26 µs going over; a frame of a six-tree stand in 1.6 ms.
- **Pose into the scene raster, present once.** korpi's `presenter` uploads a
  frame in one `putImageData` and one `drawImage`. Safari draws one canvas onto
  another lazily: an offscreen canvas refilled and drawn again in the same frame
  shows its second contents both times, and a layer blinks out on some frames,
  never in a headless capture.
