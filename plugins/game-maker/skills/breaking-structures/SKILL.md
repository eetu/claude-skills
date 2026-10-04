---
name: breaking-structures
description: A masonry wall (cement blocks, bricks or rubble stone, plastered or bare) coming down over time as a pure function of (time, seed) — laid in courses, judged by what really holds masonry up (centre of mass over the bed, mortar, the arch over a gap), worn loose by Weibull wear times exposure with roof collapses and blows given as input, its pieces leaving the wall as real ones do (slabs tipping out of the picture plane, deep pieces pushed out, the pieces above dropping when what held them has gone), tumbling, breaking, and piling into a heap that sinks away, its plaster flaking off in patches. All of it baked once per seed into an event timeline and read at any moment, either way. Use when anything stacked should break or crumble over time (ruins, walls, towers, cliffs of blocks), when pieces must fall and pile convincingly at pixel scale, or when a destruction has to survive scrubbing, reloads, taps and tests.
user-invocable: true
---

> **Priors, not rails.** Built and tuned for a 320×180 scene at 40 px to the
> metre, over a clock where a year is ten minutes. The rules are research-backed;
> the constants are one tuning. Keep the shape, re-tune the numbers in a
> simulator (`game-maker:game-workbench`).

# breaking-structures

A pipeline of pure stages. Each takes what the one before baked and adds a layer:

| stage            | does                                                       | out                                               |
| ---------------- | ---------------------------------------------------------- | ------------------------------------------------- |
| bond             | lays the pieces and finds what touches what                | owner map, pieces, contacts, joint/unit per pixel |
| stability        | says how each piece stands, or how it fails                | classes, gaps, `settle` in waves                  |
| decay + timeline | finds when each piece goes, exactly                        | every release, in time order                      |
| fall             | gives each release its whole motion, in closed-form phases | bodies                                            |
| pile + fracture  | lands, breaks and heaps them; sinks them                   | the heap through time                             |
| skin             | plaster patches and when each comes off                    | patch map, loss times                             |
| query            | reads it all at any `t`                                    | standing, moving, lying, cues                     |

Everything is baked once per (spec, seed, input) and cached in one slot keyed by
the spec object and the seed (`game-maker:world-clock`). Nothing is stepped per
frame.

## Laying the bond

- **Courses from the base up**, each half a unit along from the one below; the
  top course is the one cut off (fold it into the course below if it would be
  under half height).
- **Coursed units** (cement blocks, bricks): each unit, with its bed joint and
  one head joint, is a piece of its own, the bed joint as its bottom row so a
  broken top shows the unit, not mortar. Joints run straight. For a hand-laid
  look they may wander as continuous noisy curves (`y = y_k + rough·noise(x/5)`),
  with a few half-units where no joint above or below is within 4 px. Never lay
  units as "nearest seed by an L4 distance": courses wander and stray pixels of
  one unit turn up inside its neighbour.
- **Rubble** (medieval, roughly coursed): courses of uneven height, stones of
  uneven length; a pixel belongs to the nearest stone by a rounded-square
  measure `(u³ + v³)^(1/3)`, roughened. It is mortar where the two nearest are
  within 0.14 of each other, or the nearest is beyond 1.05. The wall is thick
  (50 cm).
- Keep **per-pixel `joint` and `unit`** arrays for the look.
- **Tidy, in order:**
  1. Split every piece into its 4-connected parts.
  2. Fold scraps (under 12 px, or thinner than 5) into the neighbour they share
     the most edge with, a same-course neighbour scoring ×1.5. The sliver over
     an opening joins the piece over it; the one at its side joins its neighbour.
  3. Fold any piece laid with **no bed at all** (a column wedged beside an
     opening) into its biggest neighbour.
- **Contacts from pixel adjacency**, kept from 3 px of shared edge. A **bed** is
  a contact with something lower: a lower course, or the same course with a
  centroid more than 1 px lower, or the base, or an insert (a window) while it
  is in. Everything else is a head contact. The strict order means support never
  runs in a loop.
- **Settings in pixels or wall height, never in courses or pieces.** A setting
  counted in courses or pieces silently changes meaning when the pieces shrink:
  how hard the wall is to loosen, which part of the foot is sound, how deep a
  collapse bites, what counts as a scrap, how big a piece must be to break.

## What stands

Take the hull `[L, R]` of a piece's live bed contacts.

| condition                                         | class                                          |
| ------------------------------------------------- | ---------------------------------------------- |
| no bed                                            | **drop**                                       |
| centroid within `[L+1, R−1]`                      | **bedded**                                     |
| overhangs, over an arched gap, carrying something | **pinned**                                     |
| overhangs by ≤ 3 px                               | **glued**: mortar holds it, weathering it fast |
| overhangs more                                    | **topple**                                     |

**Gaps.** Flood-fill empty cells on a course × column grid. A gap is **arched**
when all of these hold:

- it doesn't reach the top course;
- its triangle closes below the top, narrowing by half a unit per side per
  course (45° when a unit is twice a course, as the masonry codes take it);
- the course above the apex is solid over the gap;
- masonry (or an abutment) stands a unit to each side.

Any other gap is a **notch**. `settle` removes failing pieces wave by wave, and
neither shape is drawn by hand: low in the wall only a stepped triangle drops
and its sides are pinned; at the free top nothing arches, the glued edges
weather out fast, and the gap opens into a V. By induction from the base nothing
floats. Pin that with a property test over random removals.

## When each piece goes

Hazard: `h = m(t) · [w(t) + Σ_k A_k · o_k(t)]`.

- **Wear** `w` is Weibull: `Λ(t) = (t/η)^β`. β above 1 means the wall ages.
- **Collapse shocks** `o_k`: after collapse k, `K_a/(t − T_k + c_a)` (integral
  `K_a·ln(1 + Δt/c_a)`); in a lead-up window before it, rising, so small falls
  cluster before a big one. No lead-up before the blast, nor before a collapse
  given as input: a blow can't loosen the wall before it is struck.
- **Reach** `A_k = exp(−dist/40)`, dropping terms below 0.01; a collapse's
  delay along its bite is each piece's distance from its nearest column.
- **Exposure** `m` is the course's resistance (top course 1, falling steeply
  downward) times the factors that apply, capped at about 12:

| factor                                             | ×    |
| -------------------------------------------------- | ---- |
| top free (course 0, or under half its top covered) | 3    |
| a neighbour gone                                   | 2    |
| undercut (bed under 60%)                           | 2    |
| glued                                              | 4    |
| pinned                                             | 3    |
| fully confined, instead of all those               | 0.05 |

- **Thresholds:** each piece has `E = −ln U` from the seed and goes when its
  integral reaches it. Exposure changes only at events, so solve each piece's
  time **exactly**: the integral only rises, so widen in doubling steps from the
  last event, then bisect. Recompute only pieces next to what went or whose
  class changed.
- **Sound pieces**, about half the bottom course and a quarter of the next,
  never wear: part of the foot stands for good.
- **Events, in time order:** a scheduled roof collapse knocks the standing wall
  in its band, from the top down to its bite, stopping at an opening; a blow
  given as input (a list of knocks in the spec); a piece whose hazard ran out
  (glued, it topples; under load, it slips out; free, it tips out).
- **After each event, settle.** A piece that lost its last bed support goes a
  few hundredths of a second after that support, not a wave later: a wave later
  it hangs over an empty slot for up to half a second. Only failures nothing
  gave way under (an arch failing) come in waves, 0.12–0.35 s apart, and never
  before what they rested on.
- **Inserts and hung things:** an insert goes when what holds it goes (the piece
  over its middle, either jamb, or everything it sits on). A hung thing goes
  with the piece above it, or once half the wall behind it has gone.
- **Only what wears loose warns:** its crack shows 3 s ahead and it shakes for
  the last 0.3 s. A piece a cascade or a blow brings down would show a warning
  that began before the blow, and a whole cascade flashes.

What held up in tuning, at ten minutes a year: η ≈ 13 h, β 1.6; about 10
collapses over the first hours, ever further apart, each only 1–2 pieces deep.
The top three courses go over a few hours, the middle over many, and the foot
hardly moves.

## Leaving the wall

Looking straight at a wall, the common real failure is **out of plane**: the top
of a roofless wall overturns toward or away from you. Give each body its whole
motion as closed-form phases (`ease`, `pivot`, `fly`), read by `poseAt(phases, t)`.

**How a piece leaves:**

- **A slab tips** about its bottom front or back edge, the side picked by the
  seed (about 55% into the room, 70% when a collapse pushes it). It leaves at
  `atan(T/H) + 0.15` rad with `φ = ½αt²`; pick ω so it lands turned 100–150°
  (`ω = (Φ − φ_leave)/fall_time`, clamped 1.5–6), 1.4× more when knocked.
- **A deep piece is pushed out**, not tipped. A piece deeper than it is tall (a
  brick, a rubble stone) would turn most of a right angle before tipping over
  its front edge, hanging above the wall while its neighbours turn through it.
  Push it at **real speeds**: 1–1.75 m/s when knocked, a quarter to half a metre
  a second when held from above and slipping out (3.5 m/s threw stones three
  metres into the room). Slide it until its **whole depth is clear** of the
  face, then let it fall: stopped with its middle just past, its back half falls
  through the courses below.
- **A drop** (no bed) holds in place until what it sits on has cleared the wall,
  then falls onto the sill as it is when it gets there, not when it set off: the
  support may have left by then. On a sill inside the wall, a deep piece is
  kicked out at a push's speed; a slab pivots off the edge.
- **A topple** first tilts over the side it overhangs, about the edge of its
  support there.
- **What is leaving is still there.** A piece on its way out of the wall's
  thickness counts as something to land on until it has left. Counting only
  what stands, the piece above drops into the space of one still crawling out,
  and the two, drawn per pixel by depth, fight pixel by pixel: it reads as
  flicker.
- **The mortar stays behind.** A body is its unit less the joint pixels the bond
  gave it, which crumble in the hole. A brick carrying its joint falls with a
  strip of mortar down one side, lost against the wall's own joints and showing
  against its bricks by turns: even a lone brick flickers all the way down.

**Flight:** ballistic at **real gravity** (392 px/s² at 40 px/m), spin constant
until an impact. Find the landing by stepping 1/120 s **during the bake only**,
then bisect. While a falling slab passes standing masonry, keep its centre at
least its turned half-depth off the face, or its spinning edge swings into the
courses below. A body ending behind the wall hits the ground there and is gone;
draw it into the view behind the gaps (`game-maker:depth-and-lod`).

**Landing:**

- It hops once: normal restitution 0.3; along the floor, keep **0.4** of its
  speed (0.85 is a rock on a scree slope; slabs on a floor stop). It spins toward
  its rest pose during the hop, then eases into place.
- **Rest pose:** the broadest face down. A slab lies on its face; a stone deeper
  than tall lies on its bed, as it sat in the wall.
- **Rest onward:** pick the rest angle ahead in the direction it spins (the next
  face down that way). The nearest face down turns half the pieces back the way
  they came, and a drawing turned in steps flips back and forth.

## The heap

- **A height field** of 2×2 px cells over (x, depth), each listing what rests on
  it and since when.
- **Drop and roll:** a body lands on the highest point under its footprint, then
  moves while any shift of 2, 4, 8 or 12 px outward or sideways is steeper than
  repose (tan 40° ≈ 0.84), never in toward the wall. Push big pieces a few px
  further out first, so they reach the toe.
- **Find the resting place when it settles,** and lay bodies in the order they
  settle, not the order they were baked: asked at landing, the heap misses what
  settles in between (the other pieces of the same break, first), and pieces at
  rest overlap.
- **As deep as the floor that shows.** A shallower heap cuts flights beyond it
  short to its edge, where they can't roll off: they stack into a column along
  it. Cut short anyway, land somewhere in its last stretch, not on its edge.
- **Rest on whole pixels, upward.** Snap a rest pose so its drawn centre is on a
  whole pixel (no half-pixel tie to round differently on the way in and at rest),
  always upward, and move its recorded top with it. Snapped down, its bottom row
  is under the floor; its top not moved, it is not all under when sunk its full
  height.
- **Sinking without floating:** `sink_b = max(own(t), max over supports j of
(sink_j(t) − sink_j(when b came to rest)))`. A piece rides down with what holds
  it up; it is gone when sunk its full height. Start sinking minutes after it
  comes to rest and take most of an hour, or the heap never shows.

## Breaking

- **Odds** `0.04 + 0.55·smooth(fall/110) + 0.2·edge-on + 0.1·on rubble`, capped
  at 0.85, × the build's brittleness (concrete block 1, brick 0.4, natural stone
  0.25), for pieces above a size set relative to the build's unit.
- **Cracks:** 1–2, mostly across the long axis, each wandering ±1 px a row and
  kept 2 px apart. Then 1–5 chips grown from the rim, 3–10 px each.
- **Pieces:** split every label into 4-connected parts; anything cut off is a
  chip. The pieces share the mask exactly. Mark pixels next to another piece as
  **fresh** and draw them as the stone's own colour, paler: a flat white turns a
  heap of tough stone into snow.
- Each piece starts where it sat in the parent, turned as the parent lay, flies
  apart along the crack normal at 10–25 px/s, then hops and settles on its own.
  Number pieces in a range of their own, in the order they break
  (`game-maker:world-clock`).

## Plaster

- **Patches:** ragged cells about 14 px across, nearest seed asked from a point
  jostled by one hash per pixel.
- **When each goes:** the earlier of worn through (Weibull, sooner up the wall)
  or opened by a gap beside it (soon after that release).
- **Drawing:** a darker rim where a coat ends. A falling piece keeps the plaster
  it had when it left.

## Cues

Merge impacts within 0.06 s and 32 px into one thud, against every cue in the
window, not just the latest. Only a whole piece's first impact sounds; its
fragments' landings fold into that thud. Report cues in `(from, to]`
(`game-maker:world-clock`).

## Cost

Lay the wall in its smallest pieces (single bricks: about 700) to find what does
not scale, and profile with V8's sampler (`--cpu-prof`, self time summed by
function). What it found:

| cost                                                                                             | fix                                                                                                                                                                                                                                      |
| ------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| a full gap map (flood fill, an allocated cell list per gap) on every judgement, thousands a bake | judge an arch lazily: flood only the gap under an overhanging piece, upward first, and stop when it reaches the top course (no arch) or a gap already found open; keep the marks for the rest of the call, in buffers kept between calls |
| judging the settled state twice                                                                  | `settle` returns the classes it ended on; reuse them                                                                                                                                                                                     |
| exposure worked out again for every piece after every event                                      | only for pieces next to what went, or whose class changed                                                                                                                                                                                |
| the heap's sinking recursion run per query (one bake: 680 ms)                                    | memoise sinks per asked-for `t`, asked to the second during the bake; count each piece once per footprint by a stamp array, not a `Set`; skip the heap while a flight's bottom is above its highest top                                  |
| bisection from the release to the horizon                                                        | widen in doubling steps, then halve to 0.02 s; leave out collapses that reach under 5%                                                                                                                                                   |

## Traps

- **Any shared edge as support** lets pieces hang off a neighbour's side.
  Support is the bed.
- **A collapse scanning a column through an opening** knocks out pieces under
  the window. Stop at the opening, and only bite the top courses: a roof bears
  on the wall's top, not on what is left of it decades later.
- **Exposure multipliers on the shock terms** unzipped the wall in seconds. Cap
  `m`, keep aftershocks small, and keep the blast's damage to a fraction of each
  threshold.
- **Bodies out of the order they set off.** Pieces of a broken block set off
  when it lands; appended after it, they put the list out of order, and a
  reader that stops at the first body not yet started skips others already in
  flight: falling pieces flicker. Sort by start.
- **Grass drawn over the heap, or moss covering a stone in minutes,** hides all
  of it. Draw the rubble over the ground cover and let moss take an hour.
- **A test neighbour check by index offset** (`q+1`, `q+w`) collides for 1-px-wide
  boxes. Step by (dx, dy).

## Tests worth writing

- **Bond:** it covers the wall exactly; no scraps; each piece connected; beds
  always lower, both ways round. Run every build.
- **Stability:** an intact wall settles to nothing; a two-unit gap low down drops
  only its triangle, with pinned sides; a gap at the top is never arched; random
  removals over 50 seeds leave every piece grounded.
- **Timeline:** `hanging(t) === 0` over seeds and times; a piece goes within a
  moment of losing its last support, never before; the pace (top mostly gone by
  3 h, foot mostly there at 10 h, something forever); hung things go with what
  holds them; the same answers asked forwards, backwards or shuffled; **a blow
  or a roof brought down changes nothing before it** (`game-maker:world-clock`).
- **Falls:** no pose jumps across phase boundaries (under 2 px, 0.25 rad);
  tipped pieces land turned within range; every body in flight is read at every
  frame; nothing passes through standing masonry; no two bodies at rest overlap.
- **Heap:** nothing floats while sinking; a piece sunk its full height draws
  nothing.
- **Fracture:** the pieces are disjoint and connected, cover the mask exactly,
  and break more often the further they fell.
- **Plaster:** all there at 0, less by 3 h than by 1 h, none in the end.

## Sources

- NCMA TEK 17-1B, the arching triangle and its conditions (superblock.com.mx/files/TEK-17-01B.pdf)
- BIA TN 36A, corbel limits (gobrick.com)
- Paterson & Zwick, _Overhang_ (dcs.warwick.ac.uk/~msp/papers/overhang.pdf)
- Whiting, Ochsendorf & Durand 2009, rigid-block equilibrium with "glue"
- Valheim building stability; Teardown and Fortnite connectivity
- Kent, _A Heritage in Ruins_ (buildingconservation.com), how ruins decay
- Hoek, rockfall analysis (restitution, spin); Housner, rocking blocks
- Engineering ToolBox, angles of repose (rubble about 45°, crushed stone 35–40°)

## Related

- `game-maker:world-clock`: pure functions of time, inputs, cue windows, caches.
- `game-maker:depth-and-lod`: drawing a piece turned out of the picture plane
  (stepped turning, per-pixel depth, the floor's slant) and what hides the heap.
- `game-maker:game-workbench`: a simulator unit to tune it in.
- `game-maker:posed-pixels`: the shared sheet that falling bodies draw into.
