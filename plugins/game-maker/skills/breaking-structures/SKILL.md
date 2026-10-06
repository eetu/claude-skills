---
name: breaking-structures
description: A masonry wall (cement blocks, bricks or rubble stone, plastered or bare) coming down over time as a pure function of (time, seed, input). `@anarkisti/korpi/masonry` implements it (`wallOf` places a wall in the world and bakes its whole ruin once; blows and roof collapses are recorded `Input`; `fork` adds more; `solidAt`, `hung`, `cues` read it) and `@anarkisti/korpi/masonry/paint` paints it into the depth raster (`wallPainter`). This skill is what the model does and why, for tuning and extending it — laid in courses, judged by what really holds masonry up (centre of mass over the bed, mortar, the arch over a gap), worn loose by Weibull wear times exposure, pieces leaving the wall as real ones do (slabs tipping out of the picture plane, deep pieces pushed out, drops when what held them has gone), tumbling, breaking, a heap that sinks away, plaster flaking in patches, and the traps met on the way. Use when anything stacked should break or crumble over time (ruins, walls, towers, cliffs of blocks), when pieces must fall and pile convincingly at pixel scale, or when a destruction has to survive scrubbing, reloads, taps and tests.
user-invocable: true
---

> **Priors, not rails.** Built and tuned for a 320×180 scene at 40 px to the
> metre, over a clock where a year is ten minutes. The rules are
> research-backed; the constants (`PACE`) are one tuning. Re-tune them in a
> simulator (`game-maker:game-workbench`).

# breaking-structures

**Use korpi.** `wallOf({ spec, seed, at, pace, inputs, land })` from
`@anarkisti/korpi/masonry` places a wall's grid in the world (`at`, the top-left
of its face, metres) and bakes its ruin once into a timeline:

- `inputs` are recorded `Input`s: `kind: "block"` knocks out the block at a
  world point, `"roof"` brings roof down above it (`knockOf`). `wall.fork(inputs)`
  is another bake from the same seed that answers exactly as this one before the
  first of them.
- `solidAt(t, box)` (for anything that walks or flies into it), `occupied(x, y,
t)`, `hung(name, t)` (a clock or sign on the face, on it or where it came to
  rest; `land` says where a hung thing comes down), `cues(from, to)` (stones and
  hung things landing, placed in the world).
- `Spec`: `w`, `h`, `course`, `unit`, `thickness`, `ground` (px of the wall's
  grid, `pxPerM` cells to the metre), `bond` (`"block"`, `"brick"`, `"rubble"`),
  `plaster`, `brittle`, `inserts` (a window), `hangs`. `PACE` tunes wear and
  collapses, its lengths at 40 cells to the metre; `scaledPace(pace, pxPerM)`
  carries them to another scale.
- The model's stages are exported for a simulator: `layBond`, `classify`,
  `settle`, `gapsOf`, `bake`, `stateAt`, `classesAt`, `moving`, `lying`,
  `warningAt`, `exposureOf`, `fracture`, `poseAt`, `heightOver`, `plasteredAt`.

`wallPainter(wall, { palette, moss })` from `@anarkisti/korpi/masonry/paint`
paints the face (coat, bare masonry, the broken rim, cracks before a block
goes), the stones falling and lying and their dust, each at its own depth, into
the scene raster; it repaints the face only when a block goes or a patch of coat
falls. korpi bakes its 219-block reference wall in 25 ms.

## The pipeline

| stage            | does                                                       | out                                               |
| ---------------- | ---------------------------------------------------------- | ------------------------------------------------- |
| bond             | lays the pieces and finds what touches what                | owner map, pieces, contacts, joint/unit per pixel |
| stability        | says how each piece stands, or how it fails                | classes, gaps, `settle` in waves                  |
| decay + timeline | finds when each piece goes, exactly                        | every release, in time order                      |
| fall             | gives each release its whole motion, in closed-form phases | bodies                                            |
| pile + fracture  | lands, breaks and heaps them; sinks them                   | the heap through time                             |
| skin             | plaster patches and when each comes off                    | patch map, loss times                             |
| query            | reads it all at any `t`                                    | standing, moving, lying, cues                     |

## Laying the bond

- **Courses from the base up**, each half a unit along from the one below; the
  top course is the one cut off.
- **Coursed units** (blocks, bricks): each unit, with its bed joint and one head
  joint, is a piece, the bed joint as its bottom row so a broken top shows the
  unit, not mortar. For a hand-laid look joints may wander as continuous noisy
  curves. Never lay units as "nearest seed by an L4 distance": strays of one
  unit turn up inside its neighbour.
- **Rubble**: courses of uneven height, stones of uneven length; a pixel belongs
  to the nearest stone by a rounded-square measure `(u³ + v³)^(1/3)`, roughened,
  and is mortar where the two nearest are within 0.14 of each other. The wall
  is 50 cm thick.
- **Tidy**: split pieces into 4-connected parts; fold scraps (under 12 px, or
  thinner than 5) into the neighbour they share most edge with; fold any piece
  laid with **no bed at all** (a column wedged beside an opening) into its
  biggest neighbour.
- **Contacts from pixel adjacency**, from 3 px of shared edge. A **bed** is a
  contact with something lower (a lower course, the same course more than 1 px
  lower, the base, an insert while it is in). The strict order means support
  never runs in a loop.
- **Settings in pixels or wall height, never in courses or pieces**: counted in
  courses, a setting silently changes meaning when the pieces shrink.

## What stands

Take the hull `[L, R]` of a piece's live bed contacts.

| condition                                         | class                                          |
| ------------------------------------------------- | ---------------------------------------------- |
| no bed                                            | **drop**                                       |
| centroid within `[L+1, R−1]`                      | **bedded**                                     |
| overhangs, over an arched gap, carrying something | **pinned**                                     |
| overhangs by ≤ 3 px                               | **glued**: mortar holds it, weathering it fast |
| overhangs more                                    | **topple**                                     |

A gap is **arched** when it doesn't reach the top course, its triangle closes
below the top (narrowing half a unit per side per course: 45° when a unit is
twice a course, as the masonry codes take it), the course above its apex is
solid, and masonry stands a unit to each side. Any other gap is a notch.
Neither shape is drawn by hand: low in the wall only a stepped triangle drops,
its sides pinned; at the free top nothing arches, glued edges weather out fast,
and the gap opens into a V. By induction from the base nothing floats; a
property test over random removals pins it.

## When each piece goes

Hazard `h = m(t) · [w(t) + Σ_k A_k · o_k(t)]`:

- **Wear** is Weibull, `Λ(t) = (t/η)^β`; β above 1 means the wall ages.
- **Collapse shocks**: after collapse k, `K_a/(t − T_k + c_a)`; rising in a
  lead-up window before it, so small falls cluster before a big one. No lead-up
  before a collapse given as input: a blow can't loosen the wall before it.
- **Reach** `A_k = exp(−dist/40)`; terms under 0.01 dropped.
- **Exposure** `m`: the course's resistance (top 1, falling steeply down) times
  top free ×3, a neighbour gone ×2, undercut (bed under 60%) ×2, glued ×4,
  pinned ×3, or fully confined ×0.05 instead; capped at 12.
- **Thresholds**: each piece has `E = −ln U` from the seed and goes when its
  integral reaches it. Exposure changes only at events, so each time is solved
  exactly: widen in doubling steps from the last event, then bisect; recompute
  only pieces next to what went or whose class changed.
- **Sound pieces**, about half the bottom course and a quarter of the next,
  never wear: part of the foot stands for good.
- **Events in time order**: a roof collapse knocks the standing wall in its band
  from the top down to its bite, stopping at an opening, each piece after a
  delay from **its nearest column** in the bite (the first scanned brings one
  side down late); a blow; a hazard run out (glued, it topples; under load, it
  slips out; free, it tips out).
- **After each event, settle.** A piece that lost its last bed support goes a
  few hundredths of a second after it; a wave later it hangs over an empty slot
  for up to half a second. Only failures nothing gave way under (an arch) come
  in waves, 0.12–0.35 s apart.
- **Inserts and hung things**: an insert goes when what holds it goes; a hung
  thing with the piece above it, or once half the wall behind it has gone.
- **Only what wears loose warns** (`CRACK_S`, `SHAKE_S`: a crack 3 s ahead, a
  shake for the last 0.3 s), and no sooner than the fall beside it that set it
  wearing. A piece a blow or a cascade brings down would show a warning that
  began before the blow, and a whole cascade flashes.

`PACE` at ten minutes a year: η ≈ 13 h, β 1.6, about 10 collapses over the first
hours, ever further apart, each 1–2 pieces deep. The top three courses go over a
few hours, the middle over many, and the foot hardly moves.

## Leaving the wall

Looking straight at a wall, the common real failure is **out of plane**: the top
of a roofless wall overturns toward or away from you. Each body's whole motion
is closed-form phases, read by `poseAt(phases, t)`.

- **A slab tips** about its bottom front or back edge (about 55% into the room,
  70% when a collapse pushes it), leaving at `atan(T/H) + 0.15` rad, its spin
  picked so it lands turned 100–150°.
- **A deep piece is pushed out**, not tipped: deeper than tall (a brick, a
  rubble stone), it would turn most of a right angle before tipping, hanging
  above the wall while its neighbours turn through it. Push it at **real
  speeds** (1–1.75 m/s knocked; a quarter to half a metre a second slipping out
  under load; 3.5 m/s threw stones three metres into the room), until its
  **whole depth is clear** of the face, then let it fall.
- **A drop** waits until what it sits on has cleared the wall, then falls onto
  the sill as it is when it gets there, not when it set off.
- **What is leaving is still there.** A piece crawling out of the wall's
  thickness counts as something to land on until it has left; otherwise the
  piece above drops into its space and the two fight pixel by pixel.
- **The mortar stays behind.** A body is its unit less the joint pixels, which
  crumble in the hole; a brick carrying its joint flickers all the way down.

**Flight**: ballistic at real gravity, spin constant until an impact; the
landing found by stepping 1/120 s during the bake only, then bisecting. A slab
passing standing masonry keeps its centre its turned half-depth off the face. A
body ending behind the wall is gone there, painted at its depth beyond the face
(`game-maker:depth-and-lod`).

**Meeting in the air**: each flight is checked as it sets off against those in
the air (turned rectangles plus a span in depth); where two first overlap, both
are knocked apart along the way they overlap least, the lighter taking more,
knocks capped per piece and never back into the wall.

**Landing**: one hop at restitution 0.3, keeping **0.4** of its speed along the
floor (0.85 is a rock on scree; slabs on a floor stop). It comes to rest on its
broadest face, **the next face down in the direction it spins** (the nearest
turns half of them back, and a drawing in steps flips back and forth). When
something settled first where it was going, it slides at its height while
there is something under it, then down off the edge; a straight ease glides
over air.

## The heap

- **A height field** of 2×2 px cells over (x, depth). A body lands on the
  highest point under its footprint, then rolls while a shift of 2–12 px out or
  sideways is steeper than repose (tan 40°), never toward the wall.
- **Lay bodies in the order they settle**, not the order baked: asked at
  landing, the heap misses what settles in between and pieces at rest overlap.
- **As deep as the floor that shows**, or flights cut short stack into a column
  along its edge.
- **Rest on whole pixels, upward**, moving the recorded top with it; **a tilted
  piece's top is its high corner**, or sunk its full height it still shows.
- **Sinking without floating**: a piece rides down with what holds it up,
  `sink_b = max(own(t), max_j (sink_j(t) − sink_j(rest_b)))`. Start minutes after
  rest and take most of an hour, or the heap never shows.

## Breaking

- **Odds** `0.04 + 0.55·smooth(fall/110) + 0.2·edge-on + 0.1·on rubble`, capped
  at 0.85, × brittleness (block 1, brick 0.4, natural stone 0.25). Only pieces
  over a **share of the unit** break (about a sixth); a size in pixels means
  small units never break.
- **Cracks**: 1–2, mostly across the long axis, wandering ±1 px a row; then 1–5
  chips from the rim. Pixels next to another piece are **fresh**: the stone's
  own colour paler, never flat white, which turns a heap into snow.
- Pieces start where they sat, fly apart along the crack normal at 10–25 px/s,
  and settle on their own. Number them in a range of their own, in the order
  they break (`game-maker:world-clock`).

## Plaster

Ragged patches about 14 px across, each gone at the earlier of worn through
(Weibull, sooner up the wall) or opened by a gap beside it. A darker rim where a
coat ends. A falling piece keeps its plaster on its face only; its top and
bottom are bare masonry.

## Cues

Impacts within 0.06 s and 32 px merge into one thud, against every cue in the
window. Only a whole piece's first impact sounds; its fragments fold into it.

## Cost

Laying the wall in single bricks (about 700) found what doesn't scale; profile
with V8's sampler (`--cpu-prof`, self time by function):

- judge an arch lazily: flood only the gap under an overhanging piece, upward,
  stopping at the top course or a gap already found open, in buffers kept
  between calls;
- reuse the classes `settle` ended on; recompute exposure only next to what
  went;
- memoise the heap's sinks per asked `t`, count each piece once per footprint by
  a stamp array, skip the heap while a flight is above its highest top;
- widen then halve to 0.02 s when solving a time; leave out collapses that reach
  under 5%.

## Traps

- **Any shared edge as support** lets pieces hang off a neighbour's side.
- **A collapse scanning a column through an opening** knocks out pieces under
  the window. Stop at the opening, and bite only the top courses.
- **Exposure multipliers on the shock terms** unzipped the wall in seconds. Cap
  `m`, keep aftershocks small, keep the blast to a fraction of each threshold.
- **Bodies out of the order they set off.** Pieces of a broken block set off
  when it lands; appended after it, a reader that stops at the first body not
  yet started skips others in flight. Sort by start.
- **Grass over the heap, or moss covering a stone in minutes,** hides all of it.
- **A test neighbour check by index offset** (`q+1`, `q+w`) collides for
  1-px-wide boxes. Step by (dx, dy).

## Tests worth writing

- **Bond**: covers the wall exactly; no scraps; each piece connected; beds
  always lower. Every build.
- **Stability**: an intact wall settles to nothing; a two-unit gap low down
  drops only its triangle; a gap at the top never arches; random removals over
  50 seeds leave every piece grounded.
- **Timeline**: `hanging(t) === 0` over seeds and times; a piece goes within a
  moment of losing its last support, never before; the pace (top mostly gone by
  3 h, foot mostly there at 10 h, something forever); the same answers in any
  order; a blow changes nothing before it (`causal`).
- **Falls**: no pose jumps across phase boundaries (under 2 px, 0.25 rad);
  nothing passes through standing masonry; pieces in the air overlap a pixel
  or two at most.
- **Heap and fracture**: nothing floats while sinking, nothing at rest overlaps;
  pieces disjoint, connected, covering the mask, breaking more the further they
  fell.

## Sources

- NCMA TEK 17-1B, the arching triangle and its conditions (superblock.com.mx/files/TEK-17-01B.pdf)
- BIA TN 36A, corbel limits (gobrick.com)
- Paterson & Zwick, _Overhang_ (dcs.warwick.ac.uk/~msp/papers/overhang.pdf)
- Whiting, Ochsendorf & Durand 2009, rigid-block equilibrium with "glue"
- Valheim building stability; Teardown and Fortnite connectivity
- Kent, _A Heritage in Ruins_ (buildingconservation.com), how ruins decay
- Hoek, rockfall analysis (restitution, spin); Housner, rocking blocks
- Engineering ToolBox, angles of repose (rubble about 45°, crushed stone 35–40°)
