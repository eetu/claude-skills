---
name: procedural-plants
description: Grow plants from a seed for a small pixel-art canvas world — trees whose whole life (stems gaining height and girth, branches sprouting each year, the crown rising, dead branches dropping) is laid down once and read at any age into a plan of limbs, clumps, fruit and a perch; species as tables of numbers; shrubs, climbers and grass as stems with leaves; moss spreading over the floor and whatever lies on it; the season's look, the dead look, and a life cycle where trees die, fall, rot and are replaced. Use when adding vegetation to a canvas scene or game, a new tree or shrub species, a tree that keeps growing, a forest that renews itself, seasonal dressing, or moss and ground cover.
user-invocable: true
---

> **Priors, not rails.** The species, numbers and palettes below are one
> northern wood's. The parts worth keeping are the split (a life laid down once
> from the seed, read at an age into a plan; a painter that takes the plan and
> the season) and the habits that keep a plant reading as itself at 1 px a leaf.

# procedural-plants

A tree is two things. Its **life** is laid down once from a seed and cached:
every stem and branch it will ever grow, when each sprouts, how fast it grows,
when it dies and when it drops. Read at an **age** it gives a **plan**, plain
geometry in scene pixels. The **painter** is a pure function of `(plan, look)`
that emits whole pixels. Motion lives in `game-maker:wind-and-springs`, posing in
`game-maker:posed-pixels`, the stamps in `game-maker:pixel-brushes`. Soft plants
use a simpler model (below).

## Scale first, then let them grow out of the picture

Fix the pixels to the metre from something everyone knows the size of: a table
0.8 m tall at 32 px makes 40 px/m. Then trees get their real heights: a birch
grows toward 20 m (800 px), a spruce 25 m, an apple 5 m. In a scene a few metres
tall, a grown tree's crown leaves the top, and that is right: you see trunks,
lower branches and the next generation. **Trap: shrinking a tree to fit the
scene** makes it the size of the furniture and stops it ever growing.

## A plan, read off a life

```ts
type Limb = { a: Pt; b: Pt; w: number; dead?: number }; // dead 0..1 once its branch died
type Plan = {
  species: Species;
  root: Pt;
  height: number;
  limbs: Limb[];
  clumps: Clump[]; // leaves, a bough, a tuft: { x, y, r }
  fruit: Pt[];
  perch: Pt | null; // a branch a bird can sit on, if one is in view
  parents: { piece: number; t: number }[]; // what each piece hangs on (-1 the root)
  clumpOn: number[]; // the piece each clump hangs on
  ids: number[]; // stable per piece across ages
};
```

- **Parents, hangs and ids come with the plan.** The sway rig takes them as given,
  and a stable id keeps each piece's spring and each clump's flutter phase when a
  new age adds pieces in between.
- **Read at steps and keep only a few.** Quantise the age (e.g. 1/24 year, about
  a pixel of growth) and keep the last few plans per life: six trees × 24 steps a
  year × decades is a memory leak.
- **Leave out what can never show**: pieces with both ends above the scene (with
  a margin for sway) and the axes that start there. A tree going over needs its
  whole height (it falls into view), so the reader takes a flag for that.

## A species is a table of numbers

| Habit                       | What it sets                                                          |
| --------------------------- | --------------------------------------------------------------------- |
| `tall`, `at5`               | the height it grows toward, and at five years                         |
| `multi`, `forkAt`, `forks`  | stems from the ground; when (if ever) the leader forks, into how many |
| `whorl`, `perYear`          | branches in a whorl at each year's node, or alternate along it        |
| `angle` [low, top], `bend`  | lean off the stem low and high in the crown; droop or rise            |
| `reach`, `rate`             | how long a branch gets and how fast                                   |
| `twig`, `leaf`, `outer`     | twig spacing and curl; leaf clump size; the outer share in leaf       |
| `girth`                     | trunk width per (years of wood)^0.6                                   |
| `crown`, `crownAge`, `keep` | the live crown's floor; dead branches' hold time                      |
| `lives`                     | years                                                                 |

What sells a species at this size is one or two traits, not botany. Birch has a
white stem with dark marks and twigs that curl down and hang. Spruce has level
whorls, widest at the bottom, laid bottom up so each layer's tips fall over the
one below. Pine is a crooked bare stem with stubs and plates of needles high up.
Oak has a dark, furrowed trunk, and its dead leaves stay into winter.

## Laying down a life

- **Height** by Chapman–Richards, `H(A) = tall·(1 − e^(−kA))^1.5`, with `k`
  solved from the height at five: `k = −ln(1 − (at5/tall)^(2/3)) / 5`. Fast
  young, slowing with age, never past `tall`.
- **Stems.** Excurrent kinds keep one leader. Kinds that spread fork it at their
  fork age: the trunk stops there and two to five stems carry the height on,
  leaning out and turning back up toward the light. Some kinds clump from the
  ground.
- **Branches, year by year**, off every stem's new growth: a whorl at the year's
  node, or a few alternating along the year's shoot. Several stems share the
  light, so each takes `perYear / √stems`.
- **Lay every path by arc length.** A path is points every few px along
  `θ(s) = θ0 + bend·s + wander·noise(id, s)`, made once to the longest it could
  grow; the current length takes a prefix. Growing then only lengthens: a branch
  stays where it sprouted. **Trap:** noise keyed by the current length makes a
  whole branch wriggle at every age step.
- **Reach** saturates, `L(a) = cap·(1 − e^(−rate·a))`. A broadleaf's low
  branches, shaded, get a shorter cap; a conifer's lowest are its longest.
- **Girth** comes from the age of the wood: width at height `z` is
  `girth·(A − ageAtHeight(z))^0.6`. The foot is thickest, the leader's tip 1 px,
  and nothing is stored.
- **The crown rises.** The live crown's share falls toward its floor:
  `CR(A) = crown + (1 − crown)·e^(−A/crownAge)`, its base at `H·(1 − CR)`. A
  branch dies when the base passes its node, or early, shaded out (a tenth or
  so). Dead, it stops growing, greys and loses its twigs one by one, and drops
  after its kind's hold time (a pine's in a year or three, a spruce's after a
  decade); pine and spruce keep a short stub. Trees in a clearing keep a deeper
  crown than in a stand.
- **Twigs on the outer part only**; inner ones were shed long ago. Clumps sit on
  the outer share of a branch and at twig tips, spaced to touch rather than
  overlap: the crown reads the same at half the pixels.
- **Its age runs on its own clock** (grown in fast, then a year per world year),
  with the mapping in one place (`game-maker:world-clock`). A dead tree's age
  stops at its death.

## The season's look

```ts
type Look = {
  k: 0 | 1 | 2 | 3;
  p: number;
  leaves: number;
  snow: number;
  dead?: number;
};
```

`k` is the season (summer, autumn, winter, spring) and `p` how far through it;
`leaves` is how much of a broadleaf crown is in leaf, `snow` how much snow lies
about. It is computed once per frame from the clock
(`game-maker:sky-and-weather`), and painters read nothing else.

- **Turn leaf by leaf, not crown by crown.** Every leaf pixel has its own hash
  `h`, and a season's change is that hash against a ramp of `p`:

  ```ts
  if (k === 1 && h < ramp(p, 0, 0.55)) return autumn[Math.floor(h * 97) % autumn.length];
  // blossom comes and goes pixel by pixel: on after one ramp, off after another
  if (k === 3 && h > ramp(p, 0.25, 0.6) && h < 1 - ramp(p, 0.75, 1)) return BLOSSOM[...];
  ```

- **Each species keeps its own calendar.** Birch goes fresh lime in spring.
  Apple flowers all over, then the petals go. Cherry and plum flower white,
  earlier. Maple flowers yellow-green before its leaves. Rowan flowers white and
  keeps its berries into early winter, longer than its leaves. Oak keeps 0.3 of
  its crown as brown leaves in winter. Fruit that falls is the world's to drop,
  on its schedule, not the painter's (`game-maker:world-clock`).
- **Thin with `leaves`, from the outside in**, so a crown in late autumn is a
  sparse ghost of its summer shape.
- **Snow lies on what is level**: caps along the tops of clumps and spruce
  boughs; on bare wood only where near level (`game-maker:pixel-brushes`).
- The season is part of the bake key at 24 steps, so a slow autumn re-dresses a
  tree a couple of dozen times, not every frame.

## The dead look

`look.dead` runs 0 to 1 over the time a tree stands dead:

- **A broadleaf paints no clumps at all.** It dies in a spring, so it simply
  never leafs out again.
- **A conifer's needles rust**, painted through a tint proxy
  (`game-maker:pixel-brushes`), and drop all at once at `dead = 0.35`.
- **Twigs go one by one**: a piece of width 1 is skipped once `dead > 0.5` and
  its `hash(i, …) < dead`.
- **The bark greys but keeps its species**: each bark colour mixed toward a
  weathered grey by `dead × 0.6`; a dead birch is still a birch.
- **Down, it is dead wood**: no leaves, no twigs, and no snow.

## Shrubs, climbers and grass

The soft plants share one model, a sprawl: stems as runs of pieces from the
ground up, leaves and buds hanging on them. Every piece knows its stem and how
far up it sits (`s0..s1`), and every leaf its stem, its place on it and when it
came; that is all the rod physics needs to bend them by height
(`game-maker:wind-and-springs`). They have no rig, because they are not trees.

- **Shrubs** grow by swelling like trees, from their own generators. Raspberry
  canes arch over with leaves all along them. Juniper is a narrow column of
  needles round a hidden stem. Lilac has upright stems with panicles at the tips.
  Bilberry is a low carpet that vanishes under deep snow. A dress table per kind
  holds stem, summer, lit and autumn colours, plus bloom, berries and clump
  aspect; kinds turn at different times, and the juniper keeps its needles.
- **Climbers grow by reaching, not swelling.** A stem is there as far as the
  plant has got along it (`at = s × reach`), at full size; only the newest leaves
  near the tip are small (`young = min(1, (reach − leaf.at) × 8)`). A creeper fans
  side shoots that turn upward, clamped to a strip so a curtain stays on what it
  covers. A hop twines (a sine bine), carries cones on its upper half, and dies
  back to the floor each early winter: reach 1 → 0 at the start of winter, back
  to 0.8 through spring, full by midsummer. Clematis zigzags, with flowers on its
  upper two thirds that turn to silver seed heads.
- **Grass** is tufts of blade stems along the floor's cracks, each with its own
  delay. In spring it starts at half height and grows back. Under snow, only the
  part of a blade above `snow × 6` px shows. Straw creeps in through autumn and
  goes green again in spring; tips are lighter; seed heads come late in summer.

## Moss

- **A reach field, worked out once** (`game-maker:world-clock`): for every 2×2
  cell of floor, moss arrives at `6 + distance to the nearest source / 0.9 +
hash × 8`. The sources are the cracks and the climbers' roots, and the distance
  weights `dy × 1.6`, because the floor is seen at a slant. Cushions sit on a
  jittered grid, a little bigger nearer the viewer, and swell over 5 s once
  reached. Hollows fill in dark per cell, cushions are lit at the top left, and in
  spring about one in eight sends up spore stalks.
- **The floor is one layer canvas**, repainted only while the moss is still
  spreading (twice a second) and when the season changes: the largest thing in
  the scene must not repaint every frame.
- **Moss over what lies on the floor climbs from the ground up, with noise**
  (`game-maker:pixel-brushes`), in the season's moss palette.

## Placement

- **Slots, not scatter.** Trees come up at fixed points along the floor's cracks,
  each with a start time; staggering the starts (e.g. 40–120 s apart) brings the
  wood in one tree at a time. Kinds are shuffled by the seed, with any kind the
  game depends on (a fruit tree to shake) always present. Size varies ±15% within
  a kind.
- **Shrubs go where nothing stands in front of them**: tall kinds in the gaps
  between the furniture, low kinds along the near edge.
- **Draw order is the depth**: climbers on the back wall, then rubble, then
  trees, the ground, the back shrubs, grass, fruit (`game-maker:depth-and-lod`).

## Life cycle

Each slot keeps a tree for good, one generation after another, scheduled as in
`game-maker:world-clock`. A life is `{ arch, slot, n, born, dies, falls, side,
rots }`.

- A tree **lives** its kind's years (compressed if a sitting should see the
  cycle: a few world hours), and some are crowded out at half that. It dies in
  the next spring (`look.dead` rises while it stands). After a while it **goes
  over** sideways, mostly toward the open middle of the scene, and **rots** for a
  year or two.
- **The gap grows something else**: a few minutes after the fall, a sapling of a
  different kind comes up within a few px of the old root. **A slot the game
  depends on regrows its kind** (the fruit tree the player shakes).
- **Shed branches come down.** Each branch's drop is a scheduled event: the dead
  branch, as it was when it died, falls turning (`game-maker:wind-and-springs`),
  lands at its tree's foot, settles flat, lies a few minutes and sinks into the
  moss. What drops while the wood grows in, years in minutes, just goes.
- **The root plate** stands up beside the base as the tree goes over: the one
  part of a fallen tree that reads above grass and furniture. Size it from the
  trunk (the brush is in `game-maker:pixel-brushes`, the trick in
  `game-maker:posed-pixels`).
- **Everything that rode the tree follows whichever tree stands.** Fruit is
  placed once a year from the tree as it was at the year's start, so it hangs
  still while the tree grows on, and only where the scene shows it. Falling
  leaves come only from living broadleaves. A bird needs a branch in view; when
  its tree has none, it moves to the tallest that has.

## Tests worth having

- Same seed, same tree; a different seed, different limbs. Laying a life down
  further changes nothing it has already grown.
- It only grows: height and the trunk's foot never shrink, and no stem or branch
  piece moves from one age to the next (twigs, drawn at their length, may).
- It comes in at a believable size at five and grows past the scene in time.
- The crown rises: the lowest leaves climb with age, and dead wood appears below.
- Every piece hangs on an earlier one or on the root.
- Fruit only on fruit trees; the perch, when there is one, in view.
- Climber stems grow from the base out; a creeper stays on what it covers.
- The life cycle: `born < dies < falls`, the next born after the last fell,
  deaths on a spring, a slot the game depends on never changes kind; shed
  branches land in the scene and come out the same however the clock is read.
