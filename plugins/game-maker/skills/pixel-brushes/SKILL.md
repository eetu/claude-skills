---
name: pixel-brushes
description: The painting primitives for a pixel-art canvas world — one whole-pixel rect, a stable hash for texture, ramp/smooth/mix, and the brushes built from them (ragged leaf clumps, snow caps, bark by species, seasonal leaf colour, spruce boughs, root plates, a 5x7 dot font). Covers the brush contract that lets any brush be recorded and re-posed, texture as a function of (x, y, salt), coverage by hash threshold instead of alpha (snow, litter, moss creeping up), palettes as data, and tinting through a Proxy context. Use when painting anything procedural into a pixel scene, adding a species, season or material, or when a painted thing flickers, crawls, smears off-palette or reads as a stamped oval.
user-invocable: true
---

> **Priors, not rails.** Palettes, salts and thresholds are taste; change them
> freely. The parts worth keeping are the contract (colour + whole-pixel fills,
> nothing else) and the rule that every random choice is a hash of where it is.

# pixel-brushes

A brush is a function `(ctx, …plain values) => void` that paints a thing at
rest. Nothing in it knows about time, animation or the frame: motion is
`game-maker:posed-pixels`, shapes come from `game-maker:procedural-plants`,
the season's inputs from `game-maker:sky-and-weather`. Hand-drawn art with a
fixed silhouette (an animal, a sign) is a dab sprite, not a brush:
`game-maker:dab-sprites`.

## The contract

A brush only **sets `fillStyle` and calls `fillRect` on whole pixels**. That is
the whole surface it may touch: no paths, no `globalAlpha`, no transforms, no
`drawImage`, no reading back.

Why: the same brush then draws straight onto a canvas, into an offscreen layer,
or into the recorder that `game-maker:posed-pixels` uses to turn a painting into
pixel lists (a fake ctx with a `fillStyle` setter and a `fillRect`). A brush that
reaches for anything else silently drops out of the recording. The 5x7 text
face obeys it too (one `fillStyle`, a `fillRect` per dot), so even text can be
posed.

```ts
/** A filled rect on whole scene pixels: a pixel by default. */
export const rect = (
  ctx: CanvasRenderingContext2D,
  c: string,
  x: number,
  y: number,
  w = 1,
  h = 1,
) => {
  ctx.fillStyle = c;
  ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
};
```

`rect` rounds, so callers pass the float geometry they computed and the snap
happens in one place. Brushes work in scene pixels, and only the whole scene
scales to the display:

- The canvas is the scene size times a whole-number scale.
- Set `setTransform(k, 0, 0, k, 0, 0)` once and `imageSmoothingEnabled = false`.
- The CSS sets `image-rendering: pixelated`.

That is the only scale. A near thing is painted bigger at the scene's pixel
size, with more pixels, never a small painting or sprite scaled up: its pixels
would come out coarser than the scene around it. At a fractional scale,
whole-pixel fills land on uneven device pixels.

## Helpers

| Helper          | What                              | Why this shape                                |
| --------------- | --------------------------------- | --------------------------------------------- |
| `hash(...ints)` | `[0, 1)` from a few integers      | stable per call site, see below               |
| `ramp(v, a, b)` | 0 before `a`, 1 after `b`, linear | thresholds that move with a season or a cover |
| `smooth(v)`     | clamped smoothstep                | growth and fades that ease in and out         |
| `mix(a, b, t)`  | `#rrggbb` toward `#rrggbb`        | greying, rusting, dusk tints without alpha    |
| `random(seed)`  | mulberry32 stream                 | building a plan once, where order is fixed    |

```ts
export const hash = (...n: number[]): number => {
  let h = 2166136261;
  for (const v of n) h = Math.imul(h ^ (v | 0), 16777619); // FNV to combine
  h ^= h >>> 16;
  h = Math.imul(h, 0x85ebca6b); // murmur3's finaliser to mix
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
};
```

Traps:

- **Without the finaliser**, consecutive inputs (flake 0, 1, 2…) land in
  near-even steps and whatever they place lines up in streaks.
- **`v | 0` truncates.** `hash(0.4)` is `hash(0)`; round coordinates first.
- **`mix` parses `#rrggbb` only.** An `rgb()` string or a colour name gives
  `NaN` garbage. Keep palettes in hex.
- **Stream vs hash.** `random(seed)` is for laying out a plan once (limbs in
  order). Anything decided per pixel or per item uses `hash`, because it must
  give the same answer whatever was asked before it.

## Texture is a function of (x, y, salt)

Every per-pixel choice is `hash(x, y, salt)`, never `Math.random()`. The same
pixel gets the same colour on every repaint, so a re-bake (the next growth step,
a season tick) changes only what the inputs changed. Nothing flickers.

- **One salt per decision**, numbered and never reused (say bark spots 78,
  birch marks 77, moss lit tops 71, moss body 72). Reusing a salt correlates features: marks line up with lit
  pixels. `hash(x, y, s)` and `hash(y, x, s)` are two independent draws; `clump`
  uses both.
- **One hash, several decisions.** `colours[Math.floor(h * 97) % n]` picks a
  colour from the same `h` that a threshold (`h > 0.55` is lit) already used;
  the `* 97` decorrelates the index from the threshold.
- **Texture rides at rest.** Hashing scene coordinates while drawing a moving
  thing each frame makes its texture crawl. Paint at rest and let
  `game-maker:posed-pixels` move the pixels.

## Coverage by threshold, not alpha

To show "this much" of something (snow on the ground, litter, a pixel turned to
autumn, moss on rubble), give each pixel or item a fixed `at = hash(…)` and
draw it when `at < cover`:

```ts
for (const c of snowField())
  if (c.at < snow) rect(off, c.colour, c.x, c.y, 2, 2);
```

- It stays crisp and on-palette; alpha blends invent colours the palette never had.
- It is monotone: as cover rises, pixels are only added; melting runs the same
  order backwards. Nothing reshuffles.
- It survives the recorder, which ignores `globalAlpha`.
- A layer keyed on the quantised cover (`Math.round(snow * 30)`) repaints only
  when the cover moves a step.

**A front that climbs a field.** Add a spatial term to the threshold:

```ts
// moss on a fallen piece: the lowest pixels first, a ragged edge of 0.25
const mossy = moss > climb * 0.8 + hash(x, v, i) * 0.25; // climb: 0 at the ground, 1 at the top
```

The front follows the field (height above ground, distance from a source) and
the hash term sets how ragged it is. The same form rots a fallen log from the
top down (`game-maker:posed-pixels`).

**Seasonal waves.** Leaf colour compares each pixel's `h` with a threshold that
moves through the season. `h < ramp(p, 0, 0.55)` turns leaves to autumn pixel
by pixel. Blossom is a window, `h > ramp(p, a, b) && h < 1 - ramp(p, c, d)`: it
opens across the crown and closes again.

**Two-deep ledges.** On a ledge, the first row shows when `hash < snow`, and a
second row when `hash2 < snow - 0.5`, so the drift deepens once the ledge is
half covered.

Alpha still has a place in a layer drawn directly, never through a brush: the
floor moss fades each cell in over 3 s with `globalAlpha`.

## Brushes

**`clump(ctx, cx, cy, r, aspect, seed, density, colour)`**: leaves, needles
and moss cushions.

- An ellipse `aspect` as tall as it is wide.
- The rim wanders: 7 angular sectors, each with its own radius
  `0.8 + 0.35 * hash(seed, sector)`, so no two clumps read as one stamped oval.
- Rim pixels fray (`d > 0.7 && h < 0.35` skipped).
- `density` thins from the outside in, `hash(y, x, seed) > density * (1.15 - d * 0.3)`,
  so a crown loses its edge leaves first.
- A pixel is lit when it sits up and to the left (`dy < -0.25 && dx < 0.2`) and
  `h > 0.55`; the light comes from the upper left.
- Colour comes from the caller as `(h, lit) => string`, which is how season,
  species and rust get in without the brush knowing about them.

**`cap(ctx, cx, cy, r, ry, snow, seed)`**: snow along a clump's top edge, one
pixel above the ellipse. A column is kept when `hash(seed, dx, 9) < snow * 0.9`;
the 0.9 means a cap is never a ruled line.

**Snow on wood**: only on bare broadleaf wood (`leaves < 0.3`) that is near
level (`|dy| < 1.5 |dx|`), one pixel above, `hash < snow`. Steep wood sheds it.

**Bark** is `barkColour(species, x, y, col, w, up)`, where `col` is the column
across the limb and `up` is the fraction of the tree's height:

- a lit left column and a shaded right one;
- birch: 16% black marks, a dark base below `up` 0.1, plain twigs;
- apple: 20% dark spots;
- oak: furrows from `hash(x, 80)`, keyed on x alone, so they run down the trunk;
- cherry: lenticel bands every third row;
- pine: orange bark above 0.45 of its height;
- spruce: green near the top.

**Spruce bough**: one whorl, two pixels thick.

- It sags by `f = |dx| / half`: low and middle boughs droop, then sweep up at
  the tip; high boughs rise all the way out.
- Branchlets hang under the middle.
- The upper row of the left half is lit, and snow sits on top.

**Root plate**, an example of a whole brush in about twenty lines:

- A bowl under the root. The half-width per row is `r * sqrt(1 - v²)`, jittered
  0.85–1.15 by `hash(y, cx, 91)`.
- Each pixel is 5% stone, 15% root, or one of three earth tones.
- Roots poke out 0–2 px at each rim, drooping a row lower in the deep half.
- It is painted below the ground line, where nothing shows until the tree is
  turned over (see `posed-pixels`).

## Palettes as data

Colour lives in tables, not in branches of code:

```ts
const LEAVES: Record<Broadleaf, { summer: string[]; lit: string; autumn: string[] }> = { … };
const MOSS = [{ body: [3 tones], lit, dark }, …]; // summer, autumn, winter, spring
```

- Every material gets 2–4 body tones, one lit tone and one dark tone.
- Seasonal extras are their own short lists: spring birch, rowan and apple
  blossom, maple flowers, an oak that keeps brown leaves into winter, rowan
  berries from late summer into early winter.
- A new species is one table entry plus, at most, one case in the bark switch.

## Tinting through a Proxy ctx

To shift everything a brush paints (dead needles going to rust, a whole tree
greying), wrap the context instead of threading a tint through every brush:

```ts
const rusted = (ctx: CanvasRenderingContext2D, t: number) =>
  new Proxy(ctx, {
    set(target, key, value) {
      if (key === "fillStyle")
        target.fillStyle = mix(value as string, RUST, Math.min(1, t) * 0.8);
      else Reflect.set(target, key, value);
      return true;
    },
    get(target, key) {
      const v = Reflect.get(target, key) as unknown;
      return typeof v === "function"
        ? (v as (...a: unknown[]) => unknown).bind(target)
        : v;
    },
  });
```

Traps:

- **`get` must bind methods to the target.** Native canvas methods called with
  the Proxy as `this` throw "Illegal invocation".
- **`set` must return `true`**, or strict mode throws.
- The values reaching `mix` must be hex, as above.
- It wraps a real canvas and the posed recorder alike, because both only see
  `fillStyle` and `fillRect`.

Snow and caps are painted through the plain ctx, not the tinted one, so they
stay white.

## Text in the scene

In-scene text uses a 5x7 dot face, one scene pixel per dot and an advance of
6 px (the ink plus one column of gap). Glyphs are row bitmasks; a missing glyph
is compiled from an ASCII picture (`#` ink, `.` gap). In the scene a dot is
always one scene pixel; `scale` (whole dots, an integer) is only for UI text on
a canvas of its own, off the scene. The face carries printable ASCII plus €, so
`×`, `·` and `—` are off limits on the walls.
