---
name: depth-and-lod
description: How a flat pixel-art canvas world fakes depth, and how it keeps detail where the eye is. Covers draw order as a named list of passes, lanes on a strip of floor drawn back to front by feet, occluding fronts that let falling things land out of sight, depth on a floor drawn as `y + K·z`, a block turned out of the picture plane drawn column by column in turn steps on a pinned pixel grid, per-pixel depth against a wall and between bodies, one sprite pixel per scene pixel (bigger is drawn bigger, never scaled up), distant scenery drawn with its own simpler painters, and re-baking at steps as detail in time. Also holds a design (marked untested) for level of detail on things that move toward and away from the viewer. Use when deciding what draws over what, when something shows through, peeks out, flickers where it overlaps, or shimmers as it turns; when sizing a sprite for its distance; when painting a background or horizon; or when an object needs to come nearer or go farther.
user-invocable: true
---

> **Priors, not rails.** The proven half held up in a dense 320×180 scene. The
> design half has not been built yet. Treat it as the first draft to test, not
> as a rule.

# depth-and-lod

A 2D pixel scene shows depth with three tools: **draw order**, **occlusion by
things already drawn**, and **a different painting for what is far**. Most of it
needs no z-buffer or mask: each is a decision made once in code, by where a thing
stands. Bodies that move through depth (falling out of a wall, into a room) add
a per-pixel depth of their own.

## Proven in practice

### Draw order is a named list of passes

Each depth band gets one function, and each function lists its parts back to
front. When something draws over what it stands behind, fix it by moving a call
in the list, not in per-frame logic.

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

- **What is on the back wall goes before what stands in front of it.** The same
  ledge-snow function runs at two depths: the wall's ledges behind the trees,
  the furniture's tops after the furniture.
- **What lies at a thing's foot goes before the thing**: the tree pass draws
  `fallen` first, then `standing`.
- **Growth over a front object belongs to that object's pass**: a creeper over a
  cabinet is drawn by the cabinet's pass.
- **Things with no fixed depth draw over everything**: particles, fliers.
- **Light comes last**: the night shade, then whatever gives its own light drawn
  again on top (`game-maker:sky-and-weather`).

### A strip of floor: lanes by feet

A walker has a lane, the y of its feet: `floorY + 4` for a rabbit, `+6` for a
fox, `+8` for a hedgehog, `+26` for a deer. Draw them in lane order; anything
else at that depth slots in between (near shrubs after the small animals, before
the deer).

**Trap:** order by where the feet are. Sprite top and creation order are both
wrong keys: a rabbit whose feet put it behind a deer, drawn after it, covers it.
With fixed lanes the order is fixed code; once walkers change lanes, sort them by
feet y every frame.

### Fronts: let things fall out of sight

A falling thing knows what stands on the floor in front of the wall: the
furniture's rects, the scene's `fronts`. A piece that overlaps a front comes to
rest at that front's base, behind it, and is drawn in an earlier pass, so the
front hides it without any mask.

```ts
const restOn = (fronts: Rect[], x: number, w: number, floor: number) => {
  for (const f of fronts) {
    const overlap = Math.min(x + w, f.x + f.w) - Math.max(x, f.x);
    if (overlap > 0) return f.y + f.h - 1; // behind its base
  }
  return floor;
};
```

The test is `overlap > 0`, not "mostly behind": a piece half in view at a front's
edge reads as peeking out. For the same reason the fronts are one pixel wider
than the furniture on each side.

### Depth on the floor, and a body turned out of the plane

When something moves toward or away from the viewer on a strip of floor (rubble
tipping out of a wall, a body falling into the room), give it a depth `z` and
draw it at `sy = y + K·z`. K = 0.25 reads as a floor seen from a little above: a
70 cm heap at a wall's foot spans 7 px of screen.

**A block turned out of the picture plane**, drawn column by column through its
own pixel mask:

1. **Turn in steps**, as pixel art turns: a sixteenth of a turn out of the plane,
   a thirty-second in it. Turned smoothly, a small textured piece is re-sampled
   every frame and its grain crawls; in steps it shows a new pose every few
   frames, like drawn frames. Chips spinning faster than about 3 rad/s shimmer
   whatever you do.
2. Each column's cross-section, the block's height by its thickness, is turned
   by φ. A face is visible when its turned normal satisfies `n_z − K·n_y > 0`;
   only those fill the rows they project to (front, back, top and bottom bands).
   In a notched column the top of the part below the notch is behind the face
   above it: **keep the nearer** of two faces on a row.
3. A face fills **the rows whose middles it spans**, not every row its edges
   touch, and takes its depth and texture row there. Filling inclusive paints an
   upright block a row taller than it was in the wall and puts the top band's
   front row on the wall's face. Where the centre's row and a face's edge both
   fall on half a pixel, round them opposite ways (centre half up, edge half
   down), or the column comes out a row low.
4. A small turn in the plane comes last, by inverse nearest-pixel sampling,
   **about the body's true centre pinned to the pixel grid**: its left column and
   centre row rounded, the same anchor its upright drawing uses. About a centre
   between pixels, a body moving a fraction of a pixel a frame is sampled afresh
   every frame and its outline shimmers (a third of a pixel a frame changed 50 of
   300 pixels each frame); pinned, its turned image only moves, a whole pixel at
   a time. A centre half a row off is a tenth of a pixel at one step and a whole
   row half round.
5. **Only a small turn is a turn of the drawing.** The drawing has the floor's
   slant in it (`y + K·z`), and turning the drawing turns the slant too: half
   round, what faces up is drawn underneath. With the turn in the plane applied
   after the tilt (`Rz(θ)·Rx(φ)`), `Rz(π)·Rx(φ) = Rx(−φ)·Rz(π)`: past a quarter
   turn either way, draw the body as itself turned half round in its own plane
   (mask and grain upside down and back to front), its tilt reversed, and turn
   the drawing by `θ − π`. The slant's error then never exceeds `K·T/2`.

A slab lying flat then shows edge-on (its bed toward the viewer, a strip of its
face on top) with no special case. **Clip each pixel at the floor for its own
depth** (`Y − K·z > floor` is under it), so sinking needs no mask and a body sunk
its full height shows nothing. One line per body, at its front edge, leaves its
top face showing to the end.

**Depth against a wall, per pixel, not per body.** Keep each projected pixel's
depth as you rasterise it, and draw a body leaving a wall twice: into the view
behind the wall's gaps, only its pixels behind the face; in the room, only those
in front. Switching a whole body between layers makes all of it jump in front
the frame its near edge passes the face, a top face still in the wall included:
a cap pops over the piece above, and with several pieces crossing, it flickers.

**A depth buffer across bodies, too.** Bodies that fall together without
colliding pass through each other. Sorted by their centres, the overlap changes
hands in one frame when two swap order, which looks like a hit. Share a per-pixel
depth buffer between the frame's bodies (seeded from what lies at rest, if that
is cached in a layer of its own) and keep the nearer at each pixel. Test that the
picture no longer depends on draw order: paint a frame forwards and backwards
and compare.

Tests:

- move a turned body sub-pixel and check its shape, lined up by whole pixels,
  never changes;
- drawn upright where it sat, a body covers exactly its own pixels;
- turned one step, odd and even sizes alike, its middle stays within half a pixel.

### Place things by what will hide them

List what draws after a thing in its band before choosing where it goes, and
give it a part that stands clear of those occluders. A fallen trunk at the
wall's foot is 3–5 px tall, and furniture and grass hide almost all of it; what
reads is the root plate, about 10 px tall where the tree stood.

### Sprite size: one sprite pixel is one scene pixel

Near things keep the scene's detail level. A sprite is drawn at its own size,
one of its pixels per scene pixel, never scaled on its own.

- **Bigger is drawn bigger.** A deer that should stand tall beside a rabbit is a
  larger drawing at the same pixel size. A 2× sprite has pixels twice the
  scene's, reads as a coarser game pasted in, and carries no more detail.
- **Smaller-for-farther is a separate, smaller drawing** or a far painter
  (below), never a fractional scale: nearest-neighbour at `0.5` or `1.5` drops or
  doubles rows unevenly, and the sprite shimmers as it moves.
- **Scale the whole scene, not its parts.** The canvas is the scene times a
  whole number `k`, set once with `setTransform(k, 0, 0, k, 0, 0)`,
  `imageSmoothingEnabled = false` and CSS `image-rendering: pixelated`. Every
  sprite and brush then lands on the same grid.
- **A flip is the only per-sprite transform**: `scale(-1, 1)` after translating
  by the sprite's width.
- Detail a size needs (a real rack of antlers) goes into the sprite drawn at that
  size, in dab (`game-maker:dab-sprites`).

### Far away: a different painter, not a smaller one

The landscape seen through a window or a gap does not shrink the near trees. A
far conifer is a stack of widening horizontal spans; a far broadleaf is a 1 px
trunk and a disc of hashed leaf pixels; each uses two or three colours.

```ts
for (let r = 0; r < h; r++) {
  const half = Math.round(((r + 1) / h) * h * 0.22);
  px(dark, x - half, base - h + r, half * 2 + 1, 1); // one span per row
}
```

- **Depth inside the distance.** Tree bases spread over 16 px below the horizon,
  most close to it (`horizon + floor(rand() ** 2 * 16)`); nearer trees are taller
  (`* (1 + near * 0.8)`); sort by base, draw far to near.
- **Ground rows** darken toward the viewer (`mix(base, black, near * 0.25)`) and
  carry hashed speckle. A ridge is a flat silhouette, one column per x.
- **The sky is flat bands, not a smooth gradient**: about 14 for an open sky, 2
  behind a small pane.
- **Bake the slow parts, draw the moving parts.** The land is baked into a canvas
  keyed by its quantised inputs; sky, sun, moon and smoke are drawn every frame
  before it.
- **One landscape per frame**, and every opening (a window, the gaps in a
  crumbling wall) shows its part of it, so whatever looks through, the world
  agrees (`game-maker:sky-and-weather` has the timeline).

### Detail in time: re-bake at steps

A growing tree is re-painted about 40 times over its growth, not every frame; a
landscape that changes over years is re-baked at e.g. `heal * 40`,
`season.p * 12`, `daylight * 8`. Make each step as coarse as the eye allows
(`game-maker:posed-pixels` owns the split between baking and posing).

## Design: LOD for things that come and go (not built yet)

Nothing below has been built. It extends the patterns above to an object that
moves toward and away from the viewer. Test it on the workbench first
(`game-maker:game-workbench`).

- **Depth drives two things.** Give the object a depth `z`: 0 at the near edge,
  1 at the wall. Feet y follows `lerp(nearY, wallY, z)`, and the lane order
  follows the feet. Size follows `1 / (d0 + z)`, where `d0` is the eye's distance
  to the near edge, quantised to the sizes actually painted.
- **Tiers, each with its own painter**: near, the full posed painting with full
  motion; mid, one baked sprite per frame with motion reduced to one offset; far,
  a silhouette in the distant-painter vocabulary, or a few pixels. Key the cache
  by tier: `${id}|${tier}|${step}`.
- **A smaller tier is a new painting, not a scale**: a procedural plan repaints
  at a smaller `height` (`game-maker:procedural-plants`); a sprite needs a
  hand-drawn size.
- **Hysteresis.** Enter the farther tier above `edge + h` and come back below
  `edge - h`, with `h` a few percent of the tier's depth range, or an object
  pacing near an edge flickers between tiers.
- **Crossfade by dither, not by alpha**: over a few frames, each pixel switches
  to the new tier when `hash(x, y) < t` (`game-maker:pixel-brushes`).
- **Order movers by feet every frame**; with hundreds, re-sort every few frames
  (`creative-coding:ascii-artist`).
- **Motion LOD.** Far away, a shorter wind history, one spring for the whole
  object, fewer particles (`game-maker:wind-and-springs`).
