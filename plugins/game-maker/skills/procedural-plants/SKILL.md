---
name: procedural-plants
description: Plants grown from a seed for a small pixel world. `@anarkisti/korpi/plants` implements them in metres and years (`archOf` lays a tree's whole life down once, `planAt` reads it at an age; nine species as `HABITS`; `lookAt` for the season; shrubs, climbers, grass, flowers as sprawls; `mossOf`; bracket fungi; shedding; `standOf` for slots whose trees live, die, fall, rot and regrow; `meadowOf` for which flower holds a spot), and `@anarkisti/korpi/plants/paint` paints them in a plant's own pixels (`paintTreeParts`, `standPainterOf`, `meadowPainterOf`, `mossPainterOf`). This skill is why they grow as they do and how to tune or extend them — scale first, a life read at an age, species as numbers, the season's and the dead look, soft plants, moss, placement, the life cycle and conks. Use when adding vegetation to a scene or game, a new tree or shrub species, a tree that keeps growing, a forest that renews itself, seasonal dressing, or moss and ground cover.
user-invocable: true
---

> **Priors, not rails.** The species, numbers and palettes are one northern
> wood's. Keep the split (a life laid down once from the seed, read at an age
> into a plan; a painter that takes the plan and the season) and the habits
> that keep a plant reading as itself at 1 px a leaf.

# procedural-plants

A tree is two things. Its **life** (`Arch`, from `archOf(seed, species, years)`)
is laid down once from a seed: every stem and branch it will ever grow, when each
sprouts, how fast it grows, when it dies and drops. Read at an **age**
(`planAt(arch, age, { cull, perch })`) it gives a `Plan`, plain geometry. The
painter (`paintTreeParts(pen, plan, g, look, part, conks, pxPerM)`) is a pure
function of plan and `Look` that fills whole pixels. Motion is
`game-maker:wind-and-springs`, posing `game-maker:posed-pixels`, the brushes
`game-maker:pixel-brushes`.

**Two coordinate spaces, on purpose.** A plant is in its own metres, x across,
y up, its root at the origin; its place in the world is its root, given
separately. Painters paint in the plant's own pixels (root at 0, 0, y down), and
their patterns hash the plant's seed and those pixels, never the scene's, so a
painting baked once is put down anywhere by shifting the pen and its texture
doesn't crawl as it moves.

## Scale first, then let them grow out of the picture

Fix the pixels to the metre from something everyone knows the size of: a table
0.8 m tall at 32 px makes 40 px/m (korpi's `SCALE`, and `REF_PX_M`, the scale
the habits and sway were tuned at). Trees then get their real heights: a birch
grows toward 20 m (800 px), a spruce 25 m, an apple 5 m. In a scene a few metres
tall a grown crown leaves the top, and that is right: you see trunks, lower
branches and the next generation. **Trap: shrinking a tree to fit the scene**
makes it the size of the furniture and stops it ever growing.

## A plan, read off a life

`Plan`: `species`, `seed`, `height`, `limbs` (`a`, `b`, `w` m, `at`, `dead`),
`clumps` (`x`, `y`, `r`), `perch`, `fruit`, and `parents`, `clumpOn`, `ids`.

- **Parents, hangs and ids come with the plan.** The sway rig takes them as
  given, and a stable id keeps each piece's spring and each clump's flutter
  phase when a new age adds pieces in between.
- **Read at steps and keep only a few.** The stand reads ages in 24ths of a
  year (about a pixel of growth), and `planAt` keeps the last four plans per
  life: six trees × 24 steps a year × decades is a memory leak.
- **Leave out what can never show**: `cull` drops what starts above a height
  (the room's top plus a metre for sway). A tree going over needs its whole
  height (it falls into view), so the stand's `Down` carries the uncut plan.

## A species is a table of numbers

`HABITS[species]` holds, in metres, years and radians: `tall` and `at5`;
`multi`, `forkAt`, `forks`, `spread`; `whorl`, `perYear`, `between`; `angle`
(low and at the top), `bend`, `wander`; `reach`, `rate`; `twig`; `leaf`,
`outer`, `gap`; `girth`; `crown`, `crownAge`, `keep`, `stubs`; `lives`. A new
species is a `Species` entry, a habit, a `FLEX`, and its colours in
`LEAVES`/`BARK`/`NEEDLES`.

What sells a species at this size is one or two traits, not botany. Birch has a
white stem with dark marks and twigs that curl down and hang. Spruce has level
whorls, widest at the bottom, laid bottom up so each layer's tips fall over the
one below. Pine is a crooked bare stem with stubs and plates of needles high up.
Oak has a dark, furrowed trunk, and its dead leaves stay into winter.

## Laying down a life

- **Height** by Chapman–Richards, `H(A) = tall·(1 − e^(−kA))^1.5`, with
  `k = −ln(1 − (at5/tall)^(2/3)) / 5`. Fast young, slowing with age, never past
  `tall`.
- **Stems.** Excurrent kinds keep one leader. Kinds that spread fork it at
  `forkAt`: the trunk stops there and two to five stems carry the height on,
  leaning out and turning back up toward the light. A trunk that has forked ends
  in the crotch; leaves sit at a stem's top only while it grows there.
- **Branches, year by year**, off every stem's new growth: a whorl at the year's
  node, or a few alternating along the year's shoot. Stems share the light, so
  each takes `perYear / √stems`.
- **Lay every path by arc length.** Points every few cm along
  `θ(s) = θ0 + bend·s + wander·noise(id, s)`, laid once to the longest it could
  grow; the current length takes a prefix. Growing then only lengthens: nothing
  that has grown moves. **Trap:** noise keyed by the current length makes a
  whole branch wriggle at every age step.
- **Reach** saturates, `L(a) = cap·(1 − e^(−rate·a))`. A broadleaf's shaded low
  branches get a shorter cap; a conifer's lowest are its longest.
- **Girth** comes from the age of the wood: width at height `z` is
  `girth·(A − ageAtHeight(z))^0.6`, thickest at the foot, nothing stored. Where
  bark changes with age (a birch's white over a brown shoot), blend the young
  shoot from the older bark over its first few px; a colour switched by width
  shows a hard line.
- **The crown rises.** The live crown's share falls toward its floor,
  `CR(A) = crown + (1 − crown)·e^(−A/crownAge)`, its base at `H·(1 − CR)`. A
  branch dies when the base passes its node, or early, shaded out. Dead, it
  stops growing, greys, loses its twigs one by one, and drops after its kind's
  `keep` (a pine's in a year or three, a spruce's after a decade), leaving a stub
  where `stubs`.
- **Twigs on the outer part only**, clumps on the outer share of a branch and at
  twig tips, spaced to touch rather than overlap: the crown reads the same at
  half the pixels.
- **Its age runs on its own clock** (grown in fast, then a year per world year:
  `game-maker:world-clock`). A dead tree's age stops at its death.

## The season's look

`lookAt(cal, t)` gives `Look`: `k` (0 summer … 3 spring), `p` how far through,
`leaves` (how much of a broadleaf crown is in leaf, `foliage`), `snow`
(`snowCover`), and `dead` for a dead tree. Painters read nothing else.

- **Turn leaf by leaf, not crown by crown.** Every leaf pixel has its own hash
  `h`, and a season's change is `h` against a ramp of `p`: autumn colour when
  `h < ramp(p, 0, 0.55)`; blossom on after one ramp and off after another.
- **Each species keeps its own calendar.** Birch goes fresh lime in spring.
  Apple flowers all over, then the petals go. Cherry and plum flower white,
  earlier. Maple flowers yellow-green before its leaves. Rowan keeps its berries
  into early winter, longer than its leaves. Oak keeps 0.3 of its crown as brown
  leaves in winter. Fruit that falls is the stand's to drop, not the painter's.
- **Thin with `leaves`, from the outside in**, so a late-autumn crown is a
  sparse ghost of its summer shape.
- **Snow lies on what is level**: caps along the tops of clumps and spruce
  boughs; on bare wood only where near level.
- The season is in the bake key at 24 steps a season, so a slow autumn
  re-dresses a tree a couple of dozen times, not every frame.

## The dead look

`look.dead` runs 0 to 1 over the time a tree stands dead:

- **A broadleaf paints no clumps.** It dies in a spring, so it never leafs out.
- **A conifer's needles rust** (painted through `rusted(pen, t)`) and drop all
  at once at `dead = 0.35`.
- **Twigs go one by one**, a twig breaking off taking the pieces beyond it and
  their conks with it.
- **The bark greys but keeps its species**: mixed toward a weathered grey by
  `dead × 0.6`; a dead birch is still a birch.
- **Down, it is dead wood**: no leaves, no twigs, and no snow.

## Shrubs, climbers, flowers and grass

The soft plants share one model, a `Sprawl`: stems as runs of pieces from the
ground up, leaves and buds hanging on them. Every piece knows its stem and how
far up it sits, every leaf its stem, its place and when it came; that is all
`rustleOf` needs to bend them by height. They have no rig.

- **Shrubs** (`planShrub`, `SHRUBS`) grow from a seed like trees. Raspberry
  canes arch over with leaves all along them; juniper is a narrow column of
  needles round a hidden stem; lilac has upright stems with panicles; bilberry
  is a low carpet that vanishes under deep snow (`underSnow`). Each kind has a
  dress for the season (`SHRUB_DRESS`).
- **Climbers grow by reaching, not swelling** (`planClimber`, `planCurtain`,
  `reachIn`). A stem is there as far as the plant has got along it, at full
  size; only the newest leaves near the tip are small. Virginia creeper fans
  side shoots that turn upward, clamped to a strip so a curtain stays on what it
  covers; hop twines, carries cones on its upper half and dies back to the floor
  each early winter; clematis zigzags, its flowers turning to silver seed heads.
- **Flowers** (`planFlowers`, `FLOWERS`, `FLOWER_YEAR`) keep their own
  calendars; the kinds that close at night close (`closes`).
- **Grass** (`planGrass`) is tufts of blades along the floor's cracks. In spring
  it starts at half height and grows back; under snow only what is above it
  shows; straw creeps in through autumn; seed heads come late in summer.

## Moss

- **A reach field, worked out once** (`mossOf`): when moss arrives at each cell
  of a patch, from its sources (cracks, a climber's roots), with distance down
  the patch weighted 1.6× because the floor is seen at a slant; cushions on a
  jittered grid, a little bigger nearer the viewer, swelling once reached.
- **Painted once per step of its growth and per season** (`mossPainterOf`) and
  laid down run by run: the largest thing on the floor must not repaint every
  frame.
- **Moss over what lies on the floor climbs from the ground up, with noise**
  (`game-maker:posed-pixels`).

## Placement

- **Slots, not scatter** (`standOf({ seed, cal, slots, always, keeps, growIn,
toward, bounds, apples })`). Trees come up at fixed world points, each slot
  with a start time; staggering starts brings the wood in one tree at a time.
  Kinds are shuffled by the seed, with any kind the game depends on (a fruit
  tree to shake) `always` present.
- **Shrubs go where nothing stands in front of them**: tall kinds in the gaps
  between furniture, low kinds along the near edge.
- **Depth places them**: a plant at its root's depth; what is clear of the
  furniture in front of it, the rest behind (`game-maker:depth-and-lod`).
- **Which flower holds a spot** follows the light (`meadowOf`): pioneers on bare
  ground, the meadow's kinds once it settles, the wood's own in the shade, the
  pioneers back where a tree comes down; decided a year at a time under the
  snow, from the shade the stand casts.

## Life cycle

Each slot keeps a tree for good, one generation after another (`stand.lives`,
`standing`, `fallen`).

- A tree **lives** its kind's years (`lifespanOf`; a few world hours if a
  sitting should see the cycle), some crowded out at half that. It dies in the
  next spring and stands dead. After a while it **goes over**, mostly toward
  the open middle (`toward`), and **rots** for a year or two (`downAt`).
- **The gap grows something else**: a sapling of another kind comes up near the
  old root. **A kind the game depends on regrows itself** (`keeps`).
- **Shed branches come down** (`sticksOf`, `stickAt`): each dead branch's drop
  is scheduled; it falls turning, lands at its tree's foot, lies a few minutes
  and sinks into the moss. What drops while the wood grows in, years in
  minutes, just goes.
- **The root plate** stands up beside the base as the tree goes over: the one
  part of a fallen tree that reads above grass and furniture
  (`game-maker:posed-pixels` has the trick).
- **Everything that rode the tree follows whichever tree stands.** Fruit is
  placed once a year from the tree as it was at the year's start, so it hangs
  still while the tree grows on. Falling leaves come only from living
  broadleaves. An owl needs a branch in view (`perch`); when its tree has none,
  it moves to the tallest that has.

## Bracket fungi

Old and dead wood grows conks by host (`CONKS`, `conksOn`): tinder fungus and
birch polypore on birch, chaga on living old birch, a red-belted conk on spruce
and pine, a sulphur shelf on oak, a cushion on plum.

- **When:** perennials from the last third of a tree's life, adding a band a
  year with a pale growing rim in season; annuals in their season, withering
  through winter. All from the wood's age (which runs on after death) and the
  time of year.
- **Where:** low to mid trunk, mostly at a shed branch's stub, side-on, 3–12 px.
- **Riding the tree:** painted right after the wood it grows on, under the same
  part, so it sways, goes over and rots with it. On a fallen log it turns over
  with it, then grows level again (`drawConkLevel`), drawn pre-turned against
  the log's turn.
- **Seed by kind too:** two host kinds with the same fungus on one seed would
  otherwise bear the same ones.

## Tests worth having

- Same seed, same tree; laying a life down further changes nothing it has grown.
- It only grows: height and the foot never shrink, and no stem or branch piece
  moves from one age to the next.
- It comes in at a believable size at five and grows past the scene in time.
- The crown rises: the lowest leaves climb with age, dead wood appears below.
- Every piece hangs on an earlier one or on the root.
- Fruit only on fruit trees; the perch, when there is one, in view.
- The life cycle: `born < dies < falls`, the next born after the last fell,
  deaths on a spring, a kept kind never changes; shed branches land in the scene
  and come out the same however the clock is read (`orderFree`).
