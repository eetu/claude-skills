---
name: depth-and-lod
description: How a 2.5D pixel world shows depth, and how it keeps detail where the eye is. `@anarkisti/korpi` implements the core — one scene `Raster` with a depth per pixel (`paint`), the oblique front view and a whole-number-zoom camera (`view`: `obliqueView`, `cameraView`), lit after painting (`light`) — and the governor that steps detail is still to come (korpi#1). This skill is how to place things at true depth and why — a depth table in metres, what lies flat at its row's depth, what stands at its foot's, what stands on furniture just behind its front, nothing under the floor, translucent last, per-pixel depth for bodies that move through depth, a block turned out of the picture plane in turn steps on a pinned grid, one sprite pixel per scene pixel, far scenery with its own painters, and re-baking at steps. Also holds a design (marked untested) for level of detail on things that come and go. Use when deciding what covers what, when something shows through, hides, peeks out, flickers where it overlaps, or shimmers as it turns; when sizing a sprite for its distance; when painting a background or horizon; or when an object needs to come nearer or go farther.
user-invocable: true
---

> **Priors, not rails.** The proven half held up in a dense 320×180 scene
> painted at true depth. The design half has not been built. Treat it as the
> first draft to test, not as a rule.

# depth-and-lod

The world is 3D, in metres: x across, y up, z toward the viewer. **Every pixel
has a depth**: painters fill a scene raster (`raster(w, h)` from
`@anarkisti/korpi/paint`: colour, depth, glow per pixel) through a view, and
what is nearer covers what is farther wherever they meet, **whatever order they
are painted in**. Models never see a view; only painters import `paint` and
`view`, so another projection draws the same world.

`obliqueView({ w, h, pxPerM: 40, k: 0.25, horizon })` from
`@anarkisti/korpi/view` projects a point to `sx = x·s`,
`sy = horizon − y·s + k·z·s` and depth `d = −z` (smaller nearer): looking a
little down, a metre toward the viewer slides a point a quarter of a metre down
the scene, so a 70 cm heap at a wall's foot spans 7 px. `cameraView(base,
{ pan, zoom }, screenW, screenH)` pans in metres at a whole-number zoom.

## Proven in practice

### A depth table

Give everything its true depth, in metres out from the back wall, in one table
(nahkarele's room is `src/lib/office/depth.ts`):

| what                                      | z (m)         |
| ----------------------------------------- | ------------- |
| the wall; what is on it; what hangs on it | 0; 0.01; 0.02 |
| a chair behind the desk                   | 0.1           |
| the back lane of trees (their roots)      | 0.3           |
| the machines' faces                       | 0.35          |
| what stands on the desk                   | 0.38          |
| the desk's front                          | 0.4           |
| fliers                                    | 0.5–1.2       |
| the land beyond the wall; the sky         | −50; −10 km   |

- **What lies flat on the floor is at its row's depth** (`floorZ(y)`, every row
  its own): one depth for a whole floor layer puts its near rows behind what
  stands on them. Layers on it (moss, cracks, litter, snow) each sit a hair
  (1e-4 m) over the one before.
- **What stands on the floor is at its foot's depth**, a hair (1e-3 m) over
  what lies there. A walker's depth is where its feet are, never its sprite's
  top: a rabbit whose feet put it behind a deer is covered by it whatever order
  they are painted in.
- **Nothing goes under the floor.** What reaches below the floor where it is
  painted (a leaf below its root, an apple's lower half) is clamped to lie on
  the floor there, or a nearer floor row covers it.
- **What stands on furniture sits just behind its front** (0.38 against the
  desk's 0.4): the desk's front covers its foot, and a tree rooted at 0.3 stands
  behind it while one rooted at 0.5 stands in front.
- Pen wrappers carry it (`shifted(pen, { dd: -z })`; nahkarele's `at`,
  `onFloor`, `standing`, `footAt`, `grounded`), so painters paint at depth 0 in
  their own pixels and never compute a depth.

**Trap: true depth does what it says.** A rabbit hopping at 0.3 vanishes behind
the desk's front at 0.4; a sign landing on the near floor is covered by a
fireweed rooted nearer. Choose the depth for what should be seen, not the
pixel row you wanted.

### Ties, translucency, light

- **A tie goes to the later fill**, and depths compare as the raster stores them
  (32-bit floats), so a tie is a tie. "On top of" is a hair nearer, not paint
  order.
- **Translucent pixels blend and leave the depth alone**: paint them after
  everything opaque, back to front (falling snow, an arc between two faces).
  Only they have an order.
- **Light comes after all painting**, one pass over the depths
  (`game-maker:sky-and-weather`); what is beyond the wall is under the open sky
  by its depth alone.

### Bodies that move through depth

A body falling out of a wall or into a room has its own depth per pixel, not
per body:

- **Against a wall.** Switching a whole body between "behind" and "in front"
  makes all of it jump the frame its near edge passes the face, a top still in
  the wall included: a cap pops over the piece above, and with several crossing,
  it flickers. Per pixel, only what has left the face shows in the room.
- **Between bodies.** Bodies that fall together pass through each other. Sorted
  by centres, the overlap changes hands in one frame when two swap order, which
  looks like a hit; per pixel, the nearer wins at each pixel. Test that the
  picture doesn't depend on paint order: paint a frame forwards and backwards
  and compare fingerprints.
- **Clip each pixel at the floor for its own depth**, so sinking needs no mask
  and a body sunk its full height shows nothing.

### A block turned out of the picture plane

korpi's masonry draws its stones so (`masonry/paint`'s `paintStone`, turn steps
`TURN_STEP`); the rules are what to keep when extending it:

1. **Turn in steps**, as pixel art turns: a sixteenth of a turn out of the plane,
   a thirty-second in it. Turned smoothly, a small textured piece is re-sampled
   every frame and its grain crawls. Chips spinning faster than about 3 rad/s
   shimmer whatever you do.
2. Each column's cross-section is turned; a face is visible when its turned
   normal has `n_z − k·n_y > 0`. In a notched column, **keep the nearer** of two
   faces on a row.
3. A face fills **the rows whose middles it spans**, not every row its edges
   touch: inclusive fills paint an upright block a row taller than it was in the
   wall. Where a centre and an edge both fall on half a pixel, round them
   opposite ways.
4. A small turn in the plane comes last, by inverse nearest-pixel sampling
   **about the body's true centre pinned to the pixel grid**. About a centre
   between pixels, a body moving a third of a pixel a frame changed 50 of 300
   pixels each frame; pinned, its image only moves, a whole pixel at a time.
5. **Only a small turn is a turn of the drawing**, which has the floor's slant
   in it. Past a quarter turn, draw the body as itself turned half round in its
   own plane, its tilt reversed, and turn the drawing by `θ − π`
   (`Rz(π)·Rx(φ) = Rx(−φ)·Rz(π)`); the slant's error stays under `k·T/2`.

Tests: moved sub-pixel, its shape lined up by whole pixels never changes; drawn
upright where it sat, it covers exactly its own pixels; turned one step, odd and
even sizes alike, its middle stays within half a pixel.

### Place things by what will hide them

List what is nearer than a thing before choosing where it goes, and give it a
part that stands clear. A fallen trunk at the wall's foot is 3–5 px tall, and
furniture and grass hide almost all of it; what reads is the root plate, about
10 px tall where the tree stood.

### Sprite size: one sprite pixel is one scene pixel

- **Bigger is drawn bigger.** A deer beside a rabbit is a larger drawing at the
  same pixel size; a 2× sprite reads as a coarser game pasted in.
- **Smaller-for-farther is another drawing**: a dab level
  (`game-maker:dab-sprites`) or a far painter, never a fractional scale, which
  drops or doubles rows unevenly and shimmers as it moves.
- **Scale the whole scene, not its parts**: `presenter().present(ctx, scene, x,
y, zoom)` at a whole-number zoom, smoothing off. Flipping is the only
  per-sprite transform.

### Far away: a different painter, not a smaller one

The landscape through a window or a gap doesn't shrink the near trees. A far
conifer is a stack of widening spans, one per row; a far broadleaf a 1 px trunk
and a disc of hashed leaf pixels; two or three colours each.

- **Depth inside the distance.** Bases spread over 16 px below the horizon, most
  close to it (`horizon + floor(rand() ** 2 * 16)`); nearer trees are taller;
  far to near.
- **Ground rows** darken toward the viewer and carry hashed speckle; a ridge is
  a flat silhouette, one column per x.
- **The sky is flat bands**, one per 6 px, two at least (`bandsFor`,
  `paintBands`, optionally dithered at the seams).
- **Bake the slow parts, paint the moving parts**: the land keyed on its
  quantised inputs, sky, sun, moon and smoke every frame.

### Detail in time: re-bake at steps

A growing tree is re-painted about 40 times over its growth, not every frame
(korpi reads a tree's age in 24ths of a year); a landscape that changes over
years re-bakes at e.g. `heal * 40`, `season.p * 12`. Make each step as coarse as
the eye allows (`game-maker:posed-pixels` owns the split between baking and
posing).

## Design: detail where the eye is (not built yet)

Nothing below has been built. korpi's roadmap has it as #1 (passes, regions and
paging, the governor) and #7 (each piece of wood at its own depth; a tree is
one depth today, so a bird can't pass between its near and far branches).

- **A governor** measures whole-frame time and missed frames (rAF delta against
  the refresh rate), attributes cost through each component's `inspect()`, and
  steps `detail` one level at a time. It skips bake frames and the frame after a
  hidden tab, and freezes while the shuttle runs at a rate other than 1.
- **What `detail` changes**: fewer particles (a stable hash-ranked subset, so
  the same flakes stay), posing every n-th frame, fewer soft plants rustled, a
  smaller paging margin. Queries and cues must be identical at every level
  (`detailFree`) and under any view or pan (`viewFree`).
- **Regions and paging**: the world cut into regions with stable ids, paged in
  as the view nears them; what is closed-form is `f(t, seed, region)`, so a
  region paged in late is exactly what it would have been.
- **Tiers for a thing that comes and goes**: near, the full posed painting;
  mid, one baked painting a frame with one offset of motion; far, a silhouette
  in the far painters' vocabulary. A smaller tier is a new painting (a plan at
  a smaller height, a dab level), keyed `${id}|${tier}|${step}`.
- **Hysteresis**: enter the farther tier above `edge + h` and come back below
  `edge − h`, or an object pacing at an edge flickers between tiers.
- **Crossfade by dither, not alpha**: each pixel switches to the new tier when
  `hash(x, y) < t`.
