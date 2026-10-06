---
name: pixel-brushes
description: The painting primitives for a pixel world. `@anarkisti/korpi/paint` implements them — a `Raster` (colour, depth and glow per pixel), the `Pen` contract every painter draws through (`fill` and `span` of whole pixels at a depth), pens (`rasterPen`, `recorder`, `canvasPen`) and wrappers (`shifted`, `flipped`, `masked`, `lit`), brushes (`line`, `ellipse`, `disc`, `polygon`), raster ops (`stamp`, `cut`, `atop`, `shade`, `wash`), the 5x7 `text` face and `presenter` — over packed colours from `@anarkisti/korpi/core` (`rgb`, `mix`, `tinted`, `over`). This skill is how to write painters on it and why it is shaped so: texture as a function of (x, y, salt), coverage by hash threshold instead of alpha, palettes as packed data, tinting by wrapping a pen, and what sells korpi's own brushes (leaf clumps, snow caps, bark, spruce boughs, root plates). Use when painting anything procedural into a pixel scene, adding a species, season or material, or when a painted thing flickers, crawls, smears off-palette, loses its glow or reads as a stamped oval.
user-invocable: true
---

> **Priors, not rails.** Palettes, salts and thresholds are taste; change them
> freely. Keep the contract (whole pixels at a depth through a pen, nothing
> else) and the rule that every random choice is a hash of where it is.

# pixel-brushes

A painter is a function `(pen, …plain values) => void` that paints a thing at
rest. Nothing in it knows about time or the frame: motion is
`game-maker:posed-pixels`, shapes come from `game-maker:procedural-plants`, the
season's inputs from `game-maker:sky-and-weather`, light from the frame's one
light pass. Hand-drawn art with a fixed silhouette (an animal, a sign) is a dab
sprite, not a painter: `game-maker:dab-sprites`.

## The contract: a pen

```ts
type Pen = {
  fill: (
    c: Rgba,
    x: number,
    y: number,
    w?: number,
    h?: number,
    d?: number,
  ) => void;
  span: (
    c: Rgba,
    x0: number,
    x1: number,
    y: number,
    d0: number,
    dd?: number,
  ) => void;
  glowing?: (g: number) => Pen;
};
```

A painter only fills whole pixels (rounded from the float geometry it passes,
in one place) at a depth `d`, smaller nearer; `span` is one row of a face whose
depth steps by `dd`. The same painter then writes into the scene raster
(`rasterPen`), is recorded for posing (`recorder`, `posedOf`), or draws straight
onto a canvas to look at alone (`canvasPen`, depth ignored).

- **Opaque pixels write where they are as near as or nearer than what is
  there**, a tie going to the later fill. Translucent ones blend over and leave
  the depth alone, so paint them after the opaque, back to front. The recorder
  refuses them.
- **Glow**: each pixel carries 0–255 of its own light; `lit(pen)` paints what
  lights itself (a lit clock face, a sign) and the light pass leaves 255 as
  painted.
- **Wrappers**: `shifted(pen, { dx, dy, dd })` puts a painting done at its own
  origin and depth 0 where it stands; `flipped(pen, about)` mirrors it;
  `masked(pen, keep)` keeps only allowed pixels (what is on a wall, where the
  wall still stands).
- Painters work in scene pixels; only the whole scene scales
  (`presenter().present(ctx, scene, x, y, zoom)`, a whole-number zoom). A near
  thing is painted bigger with more pixels, never a small painting scaled up.

## Colours and helpers

Colours are packed `0xAABBGGRR` (`Rgba`), ImageData's byte order on
little-endian machines, so a frame uploads as it is. **Pack once where a
palette is defined** (`rgb("#8a5a34")` at module scope), never per pixel;
`mix`, `tinted`, `over` and `withAlpha` are integer maths on packed words, and
`hexOf` gives a string back for debugging.

| Helper (core)       | What                              | Why this shape                                  |
| ------------------- | --------------------------------- | ----------------------------------------------- |
| `hash`, `hash2`–`4` | `[0, 1)` from a few integers      | stable per call site (`game-maker:world-clock`) |
| `ramp(v, a, b)`     | 0 before `a`, 1 after `b`, linear | thresholds that move with a season or a cover   |
| `smooth(v)`, `bump` | clamped smoothstep; a sin² bump   | growth and fades that ease in and out           |
| `mix(a, b, t)`      | packed colour toward another      | greying, rusting without alpha                  |
| `stream(seed)`      | mulberry32                        | building a plan once, where order is fixed      |

## Texture is a function of (x, y, salt)

Every per-pixel choice is `hash(x, y, salt)`, never `Math.random()`, one salt
per decision. The same pixel gets the same colour on every repaint, so a re-bake
changes only what the inputs changed. A reused salt correlates features: marks
line up with lit pixels. `hash(x, y, s)` and `hash(y, x, s)` are two independent
draws.

- **One hash, several decisions.** `colours[Math.floor(h * 97) % n]` picks a
  colour from the same `h` a threshold (`h > 0.55` is lit) already used; the
  `* 97` decorrelates the index from the threshold.
- **Texture rides at rest.** Hash the thing's own pixels (and its seed), never
  the scene's: hashing scene coordinates while a thing moves makes its texture
  crawl. Paint at rest and let `game-maker:posed-pixels` move the pixels.

## Coverage by threshold, not alpha

To show "this much" of something (snow on the ground, litter, moss on rubble),
give each pixel or item a fixed `at = hash(…)` and draw it when `at < cover`:

- It stays crisp and on-palette; alpha blends invent colours the palette never
  had.
- It is monotone: as cover rises pixels are only added, and melting runs the
  same order backwards.
- It survives posing, which can't re-blend a translucent pixel over what moves
  beneath it.
- A painting keyed on the quantised cover (`Math.round(snow * 30)`) repaints
  only when the cover moves a step.

**A front that climbs a field** adds a spatial term: moss on a fallen piece when
`moss > climb * 0.8 + hash(x, y, i) * 0.25` (climb 0 at the ground, 1 at the
top). The field sets where the front goes, the hash how ragged it is; the same
form rots a fallen log. korpi's `paintSnowGround` and `paintSnowCaps` are this.

## Palettes as data

Colour lives in tables, not in branches of code (`LEAVES`, `BARK`, `NEEDLES`,
`MOSSES`, `WALL_PALETTE`). Every material gets 2–4 body tones, one lit and one
dark; seasonal extras (blossom, berries, leaves kept into winter) are their own
short lists. A new species is one table entry plus, at most, one case in the
bark painter.

## Tinting by wrapping the pen

To shift everything a painter paints (dead needles going to rust, a tree
greying), wrap the pen instead of threading a tint through every brush, as
korpi's `rusted(pen, t)` does:

```ts
const rusted = (pen: Pen, t: number): Pen => {
  const k = Math.min(1, t) * 0.8;
  const out: Pen = {
    fill: (c, x, y, w, h, d) => pen.fill(mix(c, RUST, k), x, y, w, h, d),
    span: (c, x0, x1, y, d0, dd) =>
      pen.span(mix(c, RUST, k), x0, x1, y, d0, dd),
  };
  const { glowing } = pen;
  return glowing ? { ...out, glowing: (g) => rusted(glowing(g), t) } : out;
};
```

- **Pass `glowing` through**, or whatever lights itself painted through the
  wrapper loses its glow.
- **Tint for what the material is, never for the light.** Night, shade and
  cover are the light pass's (`game-maker:sky-and-weather`); a tint for them
  baked into a cached painting stays when the light changes.
- Paint snow through the plain pen so it stays white.

## korpi's brushes, and what sells them

They live beside their models (`plants/paint`, `masonry/paint`, `sky/paint`);
the design is worth knowing to tune or extend them.

- **`clump`** (leaves, needles, moss cushions): an ellipse whose rim wanders by
  7 angular sectors, each its own radius `0.8 + 0.35·hash(seed, sector)`, so no
  two read as one stamped oval; rim pixels fray; `density` thins from the
  outside in, so a crown loses its edge leaves first; lit when up and to the
  left with `h > 0.55`; colour from the caller as `(h, lit) => Rgba`, which is
  how season, species and rust get in without the brush knowing.
- **`cap`**: snow one pixel above a clump's top edge, a column kept when
  `hash < snow * 0.9`, so a cap is never a ruled line. On wood: only bare
  broadleaf wood near level (`|dy| < 1.5 |dx|`); steep wood sheds it.
- **Bark** (`BARK`): a lit left column and a shaded right one; birch with black
  marks and a black fissured foot that comes with girth, each 2 px ridge solid
  to its own height and breaking up into upright fissures above, so it never
  ends in a straight line; oak furrows hashed on x alone, so they run down the
  trunk; pine orange above 0.45 of its height.
- **Spruce bough**: one whorl, two pixels thick, sagging by `|dx| / half`: low
  and middle boughs droop then sweep up at the tip, high boughs rise.
- **`paintRootPlate`**: a ragged bowl under the root (half-width per row
  `r·√(1 − v²)`, jittered), stones, roots and earth tones, roots poking out at
  the rim; painted below the ground line, where nothing shows until the tree
  turns over.

## Text in the scene

`text(pen, colour, string, x, y, { scale, align, d })` from
`@anarkisti/korpi/paint`: the 5x7 dot face of `@glowbox/lcd`, one dot per scene
pixel, an advance of 6 px (`textWidth`, `TEXT_LINE`). It carries printable ASCII
plus €, so `×`, `·` and `—` are off limits in the scene. `scale` is for UI text
on a canvas of its own.
