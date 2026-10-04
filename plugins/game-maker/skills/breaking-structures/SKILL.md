---
name: breaking-structures
description: A masonry wall (blocks, bricks or rubble stone, plastered or bare) coming down over time as a pure function of (time, seed) — laid in courses, judged by what really holds masonry up (centre of mass over the bed, mortar, the arch over a gap), worn loose by Weibull wear times exposure with roof collapses, its pieces tipping out of the picture plane, tumbling, breaking, and piling into a heap that sinks away, its plaster flaking off in patches. All of it baked once per seed into an event timeline and read at any moment, either way. Use when anything stacked should break or crumble over time (ruins, walls, towers, cliffs of blocks), when pieces must fall and pile convincingly at pixel scale, or when a destruction has to survive scrubbing, reloads and tests.
user-invocable: true
---

> **Priors, not rails.** Built and tuned for a 320×180 scene at 40 px to the metre:
> a wall 320×97 px of about 90 blocks (or ~170 rubble stones) coming down over a
> clock where a year is ten minutes. The rules are research-backed; the constants
> are this one tuning. Keep the shape, re-tune the numbers in a simulator (see
> `game-maker:game-workbench`).

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

Everything is baked once per (spec, seed) — 30–50 ms for ~100 pieces — and cached
in one slot keyed by the spec object and the seed (see `game-maker:world-clock`).
Nothing is stepped per frame.

## Laying the bond

- **Courses from the base up**, each half a unit along from the one below; the
  top course is the one cut off (fold it into the course below if it would be
  under half height).
- **Joints are continuous noisy curves**: a bed joint is `y = y_k + rough·noise(x/5)`,
  a head joint `x = x_j + rough·noise(y/4)`. Do not lay blocks as "nearest seed
  by an L4 distance": courses wander and stray pixels of one block turn up inside
  its neighbour.
- **Three builds**, one owner map each:
  - **Blocks**: each block is a piece. About 7% laid as half-blocks where no
    joint above or below is within 4 px.
  - **Bricks** (9×3 px + 1 px mortar in running bond): bricks are texture.
    Mortared brickwork comes away in **chunks**, so a piece is a few bricks long
    by a few courses tall, assigned by each brick's centre, its rows offset by a
    seeded amount. The chunks' edges then step along the joints by themselves.
  - **Rubble** (medieval, roughly coursed): courses of uneven height; stones of
    uneven length; a pixel belongs to the nearest stone by a rounded-square
    measure `(u³ + v³)^(1/3)`, roughened. It is mortar where the two nearest
    are within 0.14 of each other, or the nearest is beyond 1.05. Each stone is
    a piece, and the wall is thick (50 cm).
- Keep **per-pixel `joint` and `unit`** arrays for the look.
- **Tidy, in order:**
  1. Split every piece into its 4-connected parts.
  2. Fold scraps (under 12 px, or thinner than 5) into the neighbour they share
     the most edge with, a same-course neighbour scoring ×1.5. The sliver over
     an opening joins the block over it; the one at its side joins its neighbour.
  3. Fold any piece laid with **no bed at all** (a column wedged beside an
     opening) into its biggest neighbour.
- **Contacts from pixel adjacency**, kept from 3 px of shared edge:
  - a **bed** is a contact with something lower: a lower course, or the same
    course with a centroid clearly lower (more than 1 px), or the base, or an
    insert (a window) while it is in;
  - everything else is a head contact.

  The strict order means support never runs in a loop.

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
  course (≈47° for 26×14 blocks; the masonry codes use 45°);
- the course above the apex is solid over the gap;
- masonry (or an abutment) stands a unit to each side.

Any other gap is a **notch**.

`settle` removes failing pieces wave by wave. Neither shape is drawn by hand:

- low in the wall, only a stepped triangle drops and the sides are pinned;
- at the free top, nothing arches, the glued edges weather out fast, and the gap
  opens into a V.

By induction from the base nothing floats. Pin that with a property test over
random removals.

## When each piece goes

Hazard: `h = m(t) · [w(t) + Σ_k A_k · o_k(t)]`.

- **Wear** `w` is Weibull: `Λ(t) = (t/η)^β`. β above 1 means the wall ages.
- **Collapse shocks** `o_k`:
  - after collapse k, `K_a/(t − T_k + c_a)`, integral `K_a·ln(1 + Δt/c_a)`;
  - in the lead-up window before it, rising: small falls cluster before a big
    one. Not at the blast, which comes without warning.
- **Reach** `A_k = exp(−dist/40)`, dropping terms below 0.01.
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
  time **exactly**: the integral only rises, so bisect. Recompute only the
  pieces whose class changed.
- **Sound pieces**, about half the bottom course and a quarter of the next,
  never wear: part of the foot stands for good.
- **Events, in time order:**
  - a scheduled roof collapse knocks the highest standing piece in each column
    of its band;
  - a blow given as input (a list of knocks in the spec);
  - a piece whose hazard ran out: glued, it topples; under load, it slips out;
    free, it tips out.

  After each, `settle`. Time each piece in a wave **after its own supports**
  (`max(wave time, support's release + gap)`), never from the wave alone.

- **Inserts and hung things:** an insert goes when what holds it goes (the piece
  over its middle, either jamb, or everything it sits on). A hung thing goes
  with the piece above it, or once half the wall behind it has gone.
- **Warning (worn pieces only):** a piece about to wear loose shows its crack 3 s ahead and shakes
  for the last 0.3 s.

What held up in tuning, at ten minutes a year:

- η ≈ 13 h, β 1.6;
- about 10 collapses over the first hours, ever further apart, each only
  1–2 pieces deep;
- result: the top three courses go over a few hours, the middle over many, and
  the foot hardly moves.

## Falling out of the picture plane

Looking straight at a wall, the common real failure is **out of plane**: the top
of a roofless wall overturns toward or away from you. Give each body its whole
motion as closed-form phases (`ease`, `pivot`, `fly`), read by `poseAt(phases, t)`.

- **Pivot** about the bottom front or back edge, the side picked by the seed,
  about 55% into the room, 70% when a collapse pushes it.
  - It leaves at `atan(T/H) + 0.15` rad, with `φ = ½αt²`.
  - Pick ω so the body lands turned 100–150° (`ω = (Φ − φ_leave)/fall_time`,
    clamped 1.5–6). A knocked piece spins 1.4× more.
- **Only a slab tips.** A piece deeper than it is tall (a brick: 4 px tall and
  9 deep; a rubble stone) would have to turn most of a right angle before tipping
  over its front edge, hanging above the wall while its neighbours turn through
  it. It is pushed out instead, until its middle is past the face, then falls
  tumbling a little. Push at **real speeds**: 1–1.75 m/s when knocked, a quarter
  to half a metre a second when it slides out. A push of its whole depth in a
  sixth of a second (3.5 m/s) threw stones three metres into the room.
- **Slip**: held from above, it slides out by its thickness over 0.3–0.6 s, then
  flies.
- **Drop**: with no bed, it falls in the plane onto the sill (the top of what
  still stands below), then pivots off that edge.
- **Topple**: it first tilts about its support corner in the plane.
- **Fly**: ballistic at **real gravity** (392 px/s² at 40 px/m), spin constant
  until an impact. Find the landing by stepping 1/120 s **during the bake only**,
  then bisect.
- **Outside**: a body ending behind the wall hits the ground there and is gone.
  Draw it into the view behind the wall's gaps (see `game-maker:depth-and-lod`).
- **Landing**:
  - it hops once: normal restitution 0.3; along the floor, keep **0.4** of its
    speed. 0.85 is a rock on a scree slope; slabs on a floor stop.
  - it spins toward its rest pose during the hop, then eases into place.
  - **Rest pose**: the broadest face down. A slab (thinner than tall) lies on its
    face; a stone deeper than tall lies on its bed, as it sat in the wall.

## The heap

- **A height field** of 2×2 px cells over (x, depth), each listing what rests on
  it and since when.
- **Drop and roll:** a body lands on the highest point under its footprint, then
  moves while any shift of 2, 4, 8 or 12 px outward or sideways is steeper than
  repose (tan 40° ≈ 0.84), never in toward the wall. Push big pieces a few px
  further out first, so they reach the toe.
- **Sinking without floating:** `sink_b = max(own(t), max over supports j of
(sink_j(t) − sink_j(when b came to rest)))`. A piece rides down with what holds
  it up; it is gone when sunk its full height. Start sinking minutes after it
  comes to rest and take most of an hour, or the heap never shows.
- **Cost:** that recursion run per query sank a bake to 680 ms. Three fixes
  brought it to 40:
  - memoise sinks per asked-for `t`;
  - count each piece once per footprint by a stamp array, not a `Set`;
  - skip the heap entirely while a flight's bottom is above its highest top.

## Breaking

- **Odds** `0.04 + 0.55·smooth(fall/110) + 0.2·edge-on + 0.1·on rubble`, capped
  at 0.85, × the build's brittleness:

| build          | brittleness                  |
| -------------- | ---------------------------- |
| concrete block | 1                            |
| brick chunks   | 1.2 (they part along joints) |
| natural stone  | 0.25                         |

- **Cracks:** 1–2, mostly across the long axis, each wandering ±1 px a row and
  kept 2 px apart. Then 1–5 chips grown from the rim, 3–10 px each.
- **Pieces:** split every label into 4-connected parts; anything cut off is a
  chip. The pieces share the mask exactly. Mark pixels next to another piece as
  **fresh** and draw them as the stone's own colour, paler. A flat white turns a
  heap of tough stone into snow.
- Each piece starts where it sat in the parent, turned as the parent lay. It
  flies apart along the crack normal at 10–25 px/s, then hops and settles on its
  own.

## Plaster

- **Patches:** ragged cells about 14 px across, nearest seed asked from a point
  jostled by one hash per pixel.
- **When each goes:** the earlier of worn through (Weibull, sooner up the wall)
  or opened by a gap beside it (soon after that release).
- **Drawing:** a darker rim where a coat ends. A falling piece keeps the plaster
  it had when it left.

## Cues

Merge impacts within 0.06 s and 32 px into one thud. Only a whole piece's first
impact sounds; its fragments' landings fold into that thud. Report cues in
`(from, to]` so split windows add up (`game-maker:world-clock`).

## Many small pieces

Lay the wall in its smallest pieces (single bricks: about 700) to find what does
not scale. Profile with V8's sampler (run the test with `--cpu-prof` and sum self
time by function). What it found, and the fixes, took a bake from 450 to about
100 ms:

| cost                                                                                             | fix                                                                                                                                                                                                                                      |
| ------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| a full gap map (flood fill, an allocated cell list per gap) on every judgement, thousands a bake | judge an arch lazily: flood only the gap under an overhanging piece, upward first, and stop when it reaches the top course (no arch) or a gap already found open; keep the marks for the rest of the call, in buffers kept between calls |
| judging the settled state twice                                                                  | `settle` returns the classes it ended on; reuse them                                                                                                                                                                                     |
| exposure worked out again for every piece after every event                                      | only for pieces next to what went, or whose class changed                                                                                                                                                                                |
| the heap's sinking recursion at a new moment on every flight step                                | ask it to the second during the bake (it moves thousandths of a px a second)                                                                                                                                                             |
| bisection from the release to the horizon                                                        | widen in doubling steps from the release, then halve to 0.02 s; leave out collapses that reach under 5%                                                                                                                                  |

Make the heap reach as far as anything can land (1.5 m here). A piece landing
past its edge gets pulled back to rest, a visible slide toward the wall.

**Turn stones in steps** when drawing them: a sixteenth of a turn out of the
plane, a thirty-second in it. Turned smoothly, a small textured piece is
re-sampled every frame and its grain crawls. In steps it shows a new pose every
few frames, like drawn rotation frames. Chips spinning faster than about 3 rad/s
shimmer whatever you do.

Draw pieces in flight **farthest first** (by depth, then id), or overlapping
pieces swap places from frame to frame.

Three more lessons:

- **Settings in pixels or wall height, not in courses or pieces.** A setting
  counted in courses or pieces silently changes meaning when the pieces shrink:
  how hard the wall is to loosen (spread the list over however many courses
  there are), which part of the foot is sound, how deep a collapse bites, what
  counts as a scrap.
- **Only what wears loose warns.** Mark the releases that come from wear and
  crack only those. A piece a cascade or a blow brings down would otherwise show
  a warning that began before the blow, and a whole cascade flashes.
- **Keep bodies in the order they set off.** Pieces of a broken block set off
  when it lands. Appended after it, they put the list out of order, and a reader
  that stops at the first body not yet started skips others already in flight:
  falling pieces flicker. Sort by start, and test that every body in flight is
  read at every frame.

## Tests worth writing

- **Bond:** it covers the wall exactly; no scraps; each piece connected; beds
  always lower, both ways round. Run all three builds.
- **Stability:**
  - an intact wall settles to nothing;
  - a two-unit gap low down drops only its triangle, with pinned sides;
  - a gap at the top is never arched;
  - random removals over 50 seeds leave every piece grounded.
- **Timeline:**
  - `hanging(t) === 0` over seeds and times;
  - a piece goes within 1 s of losing its last support;
  - no drop before its supports;
  - the pace (top mostly gone by 3 h, foot mostly there at 10 h, something
    forever);
  - hung things go with what holds them;
  - the same answers asked forwards, backwards or shuffled.
- **Falls:** no pose jumps across phase boundaries (under 2 px, 0.25 rad);
  tipped pieces land turned within range.
- **Heap:** nothing floats while sinking.
- **Fracture:** the pieces are disjoint and connected, cover the mask exactly,
  and break more often the further they fell.
- **Plaster:** all there at 0, less by 3 h than by 1 h, none in the end.

## Traps met on the way

- **Any shared edge as support** lets pieces hang off a neighbour's side. Support
  is the bed.
- **Releasing a whole wave at one time plus jitter** let a block drop before the
  block under it.
- **A collapse scanning a column through an opening** knocks out blocks under
  the window. Stop at the opening, and only bite the top courses: a roof bears on
  the wall's top, not on what is left of it decades later.
- **Exposure multipliers on the shock terms** unzipped the wall in seconds. Cap
  `m`, keep aftershocks small, and keep the blast's damage to a fraction of each
  threshold.
- **Grass drawn over the heap, or moss covering a stone in minutes,** hides all
  of it. Draw the rubble over the ground cover and let moss take an hour.
- **A test neighbour check by index offset** (`q+1`, `q+w`) collides for 1-px-wide
  boxes. Step by (dx, dy).

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

- `game-maker:world-clock`: pure functions of time, cue windows, caches.
- `game-maker:depth-and-lod`: the floor's depth, drawing a block turned out of
  the picture plane, what hides the heap.
- `game-maker:game-workbench`: a simulator unit to tune it in.
- `game-maker:posed-pixels`: the shared sheet that falling bodies draw into.
