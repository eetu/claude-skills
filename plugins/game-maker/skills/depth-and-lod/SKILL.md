---
name: depth-and-lod
description: How a flat pixel-art canvas world fakes depth, and how it keeps detail where the eye is. Covers draw order as a named list of passes, lanes on a strip of floor drawn back to front by feet, occluding fronts that let falling things land out of sight, one sprite pixel per scene pixel (bigger is drawn bigger, never scaled up), distant scenery drawn with its own simpler painters instead of scaled-down ones, and re-baking at steps as detail in time. Also holds a design (marked untested) for level of detail on things that move toward and away from the viewer — tiers, hysteresis, dithered crossfades. Use when deciding what draws over what, when something shows through or peeks out behind what should hide it, when sizing a sprite for its distance, when painting a background or horizon, or when an object needs to come nearer or go farther.
user-invocable: true
---

> **Priors, not rails.** The proven half held up in a dense 320×180 scene. The
> design half has not been built yet. Treat it as the first draft to test, not
> as a rule.

# depth-and-lod

A 2D pixel scene shows depth with three tools: **draw order**, **occlusion by
things already drawn**, and **a different painting for what is far**. None of
them needs a z-buffer or a mask. Each is a decision made once in code, by where a
thing stands.

## Proven in practice

### Draw order is a named list of passes

Each depth band gets one function, and each function lists its parts back to
front. When something draws over what it stands behind, you fix it by moving a
call in the list. Per-frame logic is the wrong place for that fix.

```text
drawScene, back to front:
  sky + distant land (through windows and gaps)
  back wall: cracks · moss · ledge snow · climbers
  at its foot: rubble · fallen logs
  what stands: trees → ground cover · shrubs · grass
  furniture in front of the wall (table, cabinets) + its own snow caps
  floor: creatures by lane, shrubs between them
  air: birds, falling snow and leaves
  night shade → what lights itself → glow
```

Rules the list encodes:

- **What is on the back wall goes before what stands in front of it.** Ledge
  snow and climbers draw before the trees. The same ledge-snow function runs at
  two depths: once for the wall's ledges, behind the trees, and once for the
  furniture's tops, after the furniture.
- **What lies at a thing's foot goes before the thing.** Rubble and fallen logs
  draw before standing trees: the tree pass draws `fallen` first, then
  `standing`.
- **Growth over a front object belongs to that object's pass.** A creeper over a
  cabinet is drawn by the cabinet's pass, not the garden's.
- **Things with no fixed depth draw over everything.** That covers particles and
  fliers.
- **Light comes last.** The night shade covers everything. Then whatever gives
  its own light is drawn again on top of it: lit signs, a clock face, fireflies.
  See `game-maker:sky-and-weather`.

### A strip of floor: lanes by feet

A walker has a lane, which is the y of its feet: `floorY + 4` for a rabbit, `+6`
for a fox, `+8` for a hedgehog, `+26` for a deer. Draw them in lane order.
Anything else at the same depth slots in between them, such as near shrubs after
the small animals and before the deer.

**Trap:** order by where the feet are. Sprite top and creation order are both
wrong keys. A rabbit whose feet put it behind a deer, drawn after the deer,
covers it. That breaks the illusion more than any mistake in scale.

With fixed lanes the order is fixed code. Once walkers change lanes, sort them by
feet y every frame (see the design below).

### Fronts: let things fall out of sight

A falling thing should know what stands on the floor in front of the wall: the
furniture's rects, the scene's `fronts`. A piece that overlaps a front comes to
rest at that front's base, so it lies behind it. It is drawn in an earlier pass,
so the front hides it without any mask.

```ts
const restOn = (fronts: Rect[], x: number, w: number, floor: number) => {
  for (const f of fronts) {
    const overlap = Math.min(x + w, f.x + f.w) - Math.max(x, f.x);
    if (overlap > 0) return f.y + f.h - 1; // behind its base
  }
  return floor;
};
```

The test is `overlap > 0`, not "mostly behind". A piece lying half in view at a
front's edge reads as peeking out. For the same reason the fronts are one pixel
wider than the furniture on each side (`x - 1`, `w + 2`).

### Depth on the floor as `y + K·z`, and things turned out of the plane

When something must move toward or away from the viewer on a strip of floor (rubble
tipping out of a wall, a body falling into the room), give it a depth `z` and
draw it at `sy = y + K·z`. K = 0.25 reads as a floor seen from a little above: a
70 cm heap at a wall's foot spans 7 px of screen.

**A block turned out of the picture plane**, drawn column by column through its
own pixel mask:

1. Each column's cross-section, the block's height by its thickness, is turned
   by φ.
2. A face is visible when its turned normal satisfies `n_z − K·n_y > 0`. Only
   those faces fill the rows they project to: the front, the back, the top and
   the bottom bands. At most two show, and they don't overlap.
3. Map each screen row back to a mask row for the face's texture.
4. A small turn in the plane comes last, by inverse nearest-pixel sampling.

A slab lying flat then shows edge-on: its bed toward the viewer, a strip of its
face on top, with no special case. Clip each body at the floor line in front of
it (`ground + K·z_front`), so sinking needs no mask.

**Depth against a wall, per pixel, not per body.** Keep each projected pixel's
depth as you rasterise it (the faces' depths interpolate down each span), and
draw a body leaving a wall twice:

- into the view behind the wall's gaps, only its pixels behind the face;
- in the room, only its pixels in front of it.

Do not switch a whole body from one layer to the other. The frame its near edge
passes the face, all of it jumps in front, including a top face still buried in
the wall: a cap pops over the piece above, and with several pieces crossing on
different frames, it flickers.

**A depth buffer across bodies, too.** Bodies that fall together without
colliding pass through each other. Sorted by their centres, the overlap changes
hands in one frame when two swap order, which looks like a hit. Share a per-pixel
depth buffer between the frame's bodies and keep the nearer at each pixel. The
picture then no longer depends on draw order: test that by painting a frame
forwards and backwards and comparing.

### Place things by what will hide them

List what draws after a thing in its band before you choose where it goes.
Then give it a part that stands clear of those occluders.

A fallen trunk at the wall's foot is 3–5 px tall, and the furniture and the
grass hide almost all of it. What reads is the root plate, which stands about 10
px tall where the tree stood.

### Sprite size: one sprite pixel is one scene pixel

Near things keep the scene's detail level. A sprite is drawn at its own size,
one of its pixels per scene pixel, and never scaled on its own.

- **Bigger is drawn bigger.** A deer that should stand tall beside a rabbit is a
  larger drawing at the same pixel size, not a small sprite blown up to 2×. A
  2× sprite has pixels twice the scene's, so it reads as a different, coarser
  game pasted in, and it carries no more detail than the small one.
- **Smaller-for-farther is a separate, smaller drawing** or a far painter
  (below), never a fractional scale. Nearest-neighbour at `0.5` or `1.5` drops
  or doubles rows unevenly, and the sprite shimmers as it moves.
- **Scale the whole scene, not its parts.** The canvas is the scene times a
  whole number `k`, set once with `setTransform(k, 0, 0, k, 0, 0)` and
  `imageSmoothingEnabled = false`. Every sprite and brush then lands on the same
  pixel grid.
- **A flip is the only per-sprite transform**: `scale(-1, 1)` after translating
  by the sprite's width, so one drawing faces both ways.
- Detail a size needs, like a real rack of antlers, goes into the sprite drawn
  at that size, in dab (`game-maker:dab-sprites`).

### Far away: a different painter, not a smaller one

The landscape seen through a window or a gap does not shrink the near trees. A
far conifer is a stack of widening horizontal spans. A far broadleaf is a 1 px
trunk and a disc of hashed leaf pixels. Each uses two or three colours.

```ts
for (let r = 0; r < h; r++) {
  const half = Math.round(((r + 1) / h) * h * 0.22);
  px(dark, x - half, base - h + r, half * 2 + 1, 1); // one span per row
}
```

- **Depth inside the distance.** Tree bases spread over 16 px below the horizon,
  most of them close to it (`horizon + floor(rand() ** 2 * 16)`). Nearer trees
  are taller (`* (1 + near * 0.8)`). They're sorted by base and drawn far to
  near.
- **Ground rows** darken toward the viewer (`mix(base, black, near * 0.25)`) and
  carry hashed speckle. A ridge is a flat silhouette, one column of pixels per x.
- **The sky is drawn in flat bands, not a smooth gradient**: about 14 for an
  open sky, 2 behind a small pane of glass. Flat bands keep the pixel look.
- **Bake the slow parts, draw the moving parts.** The land is baked into a
  canvas keyed by its quantised inputs. The sky, sun, moon and smoke are drawn
  every frame. The land then draws over them, so the sun sets behind the ridge
  through draw order alone.
- **One landscape per frame.** It is drawn once, and every opening (a window,
  the gaps in a crumbling wall) shows its part of it. Whatever looks through,
  the world agrees.

### Detail in time: re-bake at steps

A growing tree is re-painted about 40 times over its growth, not every frame. A
landscape that changes over years is re-baked at, for example, `heal * 40`,
`season.p * 12` and `daylight * 8`. Make each step as coarse as the eye allows.
This is a level of detail in time, and it is why posing stays cheap
(`game-maker:posed-pixels` owns the split between baking and posing).

## Design: LOD for things that come and go (not built yet)

Nothing below has been built. It extends the patterns above to an object that
moves toward and away from the viewer. Test it on the workbench before you rely
on it (`game-maker:game-workbench`).

- **Depth drives two things.** Give the object a depth `z`: 0 at the near edge,
  1 at the wall. Feet y follows `lerp(nearY, wallY, z)`, and the lane order
  follows the feet. Size follows `1 / (d0 + z)`, where `d0` is the eye's
  distance to the near edge, quantised to the sizes that have actually been
  painted.
- **Tiers, each with its own painter.**
  - Near: the full posed painting with full motion.
  - Mid: one baked sprite per frame, with motion reduced to an offset for the
    whole sprite.
  - Far: a silhouette in the distant-painter vocabulary (spans, a disc, two
    colours), or a few pixels.

  Bake each tier separately and key the cache by tier: `${id}|${tier}|${step}`.

- **A smaller tier is a new painting, not a scale.** A procedural plan repaints
  at a smaller `height` (`game-maker:procedural-plants`). A sprite needs a
  hand-drawn size (`game-maker:dab-sprites`). Every tier is drawn at one
  sprite pixel per scene pixel; no tier is a scaled copy of another.
- **Hysteresis.** Enter the farther tier above `edge + h` and come back below
  `edge - h`, with `h` a few percent of the tier's depth range. Otherwise an
  object pacing near an edge flickers between tiers.
- **Crossfade by dither, not by alpha.** Over a few frames, each pixel switches
  to the new tier when `hash(x, y) < t`. Alpha mixes colours off the palette, and
  the dither stays crisp (`game-maker:pixel-brushes`).
- **Order movers by feet every frame.** That is cheap for tens of items. With
  hundreds, re-sort only every few frames, since the order drifts slowly
  (`creative-coding:ascii-artist`).
- **Motion LOD.** Far away, use a shorter wind history than the near one
  (16 samples 0.25 s apart), one spring for the whole object, and fewer
  particles (`game-maker:wind-and-springs`).
