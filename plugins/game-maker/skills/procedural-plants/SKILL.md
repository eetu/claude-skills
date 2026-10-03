---
name: procedural-plants
description: Grow plants from a seed for a small pixel-art canvas world — trees as plans of limbs, clumps, fruit and a perch, one generator per species grown the way that species grows; shrubs, climbers and grass as stems with leaves; moss spreading over the floor and over whatever lies on it; growth, the season's look (leaves turning one by one, blossom, berries, snow), the dead look, and a life cycle where trees die, fall, rot and are replaced. Use when adding vegetation to a canvas scene or game, a new tree or shrub species, seasonal dressing, a plant that grows over time, a forest that renews itself, or moss and ground cover.
user-invocable: true
---

> **Priors, not rails.** The species, numbers and palettes below are one
> northern wood's. The parts worth keeping are the split (a plan from the seed
> once, a painter that takes growth and the season) and the habits that keep a
> plant reading as itself at 1 px per leaf.

# procedural-plants

A plant is two things. Its **plan** is the full-grown geometry in scene pixels,
made once from a seed and cached. Its **painter** is a pure function of
`(plan, growth, look)` that emits whole pixels. The plan never changes as the
plant grows or the year turns; only the painter's arguments do. Motion lives in
`game-maker:wind-and-springs`, per-frame posing in `game-maker:posed-pixels`,
the stamps (`rect`, `clump`, `cap`) in `game-maker:pixel-brushes`.

## A tree is a plan, not a sprite

```ts
type Limb = { a: Pt; b: Pt; w: number; at: number }; // wood, there once growth ≥ at
type Clump = { x: number; y: number; r: number; at: number }; // leaves, a bough, a tuft
type Plan = {
  species: Species;
  root: Pt;
  height: number;
  limbs: Limb[];
  clumps: Clump[];
  fruit: Pt[]; // where apples / cherries / plums hang
  perch: Pt; // a fork a bird can sit on
};
```

- **Pieces carry `at`, the growth at which they appear.** Generators assign it
  from the base out: trunk 0, main limbs ~0.12, shoots and twigs later, leaves
  last. One number drives both how big the tree is and which parts it has yet.
- **Parents before children in `limbs`.** The rig that makes a tree sway
  (`game-maker:wind-and-springs`) finds each piece's parent among the pieces
  laid before it. Any generator that keeps that order gets motion for free.
- **Anchors live in the plan.** The perch is the fork nearest three fifths of the
  way up; fruit hangs under outer clumps (`at > 0.5`). Creatures and fruit ride
  the posed tree through these anchors, so no species needs special cases.
- **One seeded stream per plant** (mulberry32 `random(seed)`), with the seed
  hashed from the world seed and the slot. Trap: inserting one `rand()` call in
  a generator reshapes every later tree of that kind for every seed. Take new
  randomness from `hash(...)` instead, or add the call last.

## One generator per species, grown the way it grows

Everything is built from one helper: a limb from a point at an angle off the
vertical, in pieces that turn by `bend` (an arch out and down; negative curls
up) plus `wander`, with a width per piece. A species is a handful of numbers on
one of three shapes:

| Shape        | How it grows                                                                               | Species                                                     |
| ------------ | ------------------------------------------------------------------------------------------ | ----------------------------------------------------------- |
| bespoke      | written out                                                                                | birch (hanging twigs), spruce (whorls), pine (crown on top) |
| `scaffolded` | a trunk splits into main limbs fanned to `span`, leafy shoots off them                     | apple, oak, cherry, plum: numbers only                      |
| `forked`     | forks recursively, each pulled back up by `lift` × its lean: an oval crown, not a flat one | rowan (often multi-stem), maple                             |

<!-- prettier-ignore -->
```ts
// apple: short trunk, 4–5 gnarled scaffolds just above level, up at the ends
const apple = scaffolded({ trunk: 0.2, limbs: [4, 5], span: 1.35, reach: 0.34,
  rise: -0.05, wander: 0.45, leaf: 4.6, shoots: 0.8 });
// oak: the same shape, thicker, wider and more crooked
const oak = scaffolded({ trunk: 0.32, limbs: [3, 5], span: 1.4, reach: 0.4,
  rise: 0.04, wander: 0.7, leaf: 6, shoots: 0.85 });
```

What sells a species at this size is one or two traits, not botany. Birch has a
white stem with dark marks and twigs that turn down and hang. Spruce has level
whorls, widest at the bottom, laid bottom up so each layer's tips fall over the
one below. Pine is a crooked bare stem with a few dead stubs and plates of
needles high up. Oak has a dark, furrowed trunk, and its dead leaves stay into
winter.

**Fit by shrinking the whole tree.** After generating, measure the bounds and
scale every point about the root by
`k = min(1, room above, room left, room right)`. A crown clipped by the scene's
edge reads as a bug. A squashed crown stops looking like its species. A smaller
tree is still the right tree. Test it: every point stays inside the scene for
dozens of seeds, roots at both edges and the middle, and a height taller than
the scene.

## Growth

```ts
const grownAt =
  (plan: Plan, g: number) =>
  (q: Pt): Pt => ({
    x: plan.root.x + (q.x - plan.root.x) * g,
    y: plan.root.y + (q.y - plan.root.y) * g,
  });
```

- The tree scales about its root. A limb paints once `g ≥ at`. Wood is
  `w × (0.4 + 0.6g)` wide and a clump `r × g`.
- **Below `g = 0.15` it is a sapling**: a green stem and two leaves. A scaled-down
  tree at that size is a smudge, and a sapling is the shape people recognise.
- **Growth is drawn in steps** (e.g. 40 for trees, 30 for shrubs). The step and
  the season are the bake key, so a plant is repainted a few dozen times as it
  grows, not every frame. See `game-maker:posed-pixels`.
- The first wood can grow in fast (minutes) when it is the show; trees that come
  later grow slowly (e.g. five times as long), because by then the year is
  turning around them.

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

`k` is the season (summer, autumn, winter, spring) and `p` how far through it.
`leaves` is how much of a broadleaf crown is in leaf, and `snow` how much snow
lies about. The look is computed once per frame from the clock
(`game-maker:sky-and-weather`). Painters read nothing else.

- **Turn leaf by leaf, not crown by crown.** Every leaf pixel has its own hash
  `h`. A season's change is that hash against a ramp of `p`, so the crown fills
  with autumn colour gradually instead of switching:

  ```ts
  if (k === 1 && h < ramp(p, 0, 0.55)) return autumn[Math.floor(h * 97) % autumn.length];
  // blossom comes and goes pixel by pixel: on after one ramp, off after another
  if (k === 3 && h > ramp(p, 0.25, 0.6) && h < 1 - ramp(p, 0.75, 1)) return BLOSSOM[...];
  ```

- **Each species keeps its own calendar.** Birch goes fresh lime in spring.
  Apple flowers all over, then the petals go. Cherry and plum flower white,
  earlier. Maple flowers yellow-green before its leaves. Rowan flowers white and
  keeps its berries into early winter, longer than its leaves. Oak keeps 0.3 of
  its crown as brown leaves in winter. Cherries and plums hang in their window.
  Fruit that falls (apples) is the world's to drop, on its schedule, not the
  painter's (`game-maker:world-clock`).
- **Thin with `leaves`, from the outside in.** Clump density drops as leaves fall,
  so a crown in late autumn is a sparse ghost of its summer shape.
- **Snow lies on what is level.** Caps go along the tops of clumps and spruce
  boughs. On bare deciduous wood, snow goes along limbs no steeper than 1.5:1,
  and only once `snow > 0.5` and leaves are below 0.3.
- The season is part of the bake key at 24 steps (`round(p × 24)`), so a slow
  autumn re-dresses a tree a couple of dozen times, not every frame.

## The dead look

`look.dead` runs 0 to 1 over the time a tree stands dead:

- **A broadleaf paints no clumps at all.** It dies in a spring, so it simply
  never leafs out again; nothing has to drop. (`game-maker:world-clock` snaps
  death to a spring for this reason.)
- **A conifer's needles rust**, painted through a tint proxy toward rust
  (`game-maker:pixel-brushes`), and drop all at once at `dead = 0.35`.
- **Twigs go one by one.** A piece of width 1 is skipped once `dead > 0.5` and its
  `hash(i, …) < dead`.
- **The bark greys but keeps its species.** Each bark colour is mixed toward a
  weathered grey by `dead × 0.6`; a dead birch is still a birch.
- **Down, it is dead wood**: no leaves, no twigs, and no snow, because the fall
  shook it off.

## Shrubs, climbers and grass

The soft plants share one model, a sprawl: stems as runs of pieces from the
ground up, and leaves and buds hanging on them.

```ts
type Piece = {
  a: Pt;
  b: Pt;
  w: number;
  stem: number;
  s0: number;
  s1: number;
  at: number;
};
type Leaves = Pt & {
  r: number;
  at: number;
  stem: number;
  s: number;
  bloom: boolean;
};
```

Every piece knows its stem and how far up it sits (`s0..s1`). That is all the
rod physics needs to bend it by height (`game-maker:wind-and-springs`). They
have no rig, because they are not trees.

- **Shrubs** grow by swelling like trees, from their own generators. Raspberry
  canes arch over (`bend 0.1`) with leaves all along them. Juniper is a narrow
  column of needles round a hidden stem. Lilac has upright stems with panicles at
  the tips. Bilberry is a low carpet. A dress table per kind holds stem, summer,
  lit and autumn colours, plus bloom, berries and clump aspect. Kinds turn at
  different times: bilberry early, lilac late, and the juniper keeps its needles.
  Bilberry vanishes under deep snow.
- **Climbers grow by reaching, not swelling.** A stem is there as far as the
  plant has got along it (`at = s × reach`), at full size. Only the newest leaves
  near the growing tip are small:
  `young = min(1, (reach − leaf.at) × 8)`. A creeper fans side shoots that turn
  upward, clamped to a strip so a curtain stays on the cabinet it covers. A hop
  twines (a sine bine), carries cones on its upper half, and dies back to the
  floor each early winter: reach goes 1 → 0 at the start of winter, back to 0.8
  through spring, and to full by midsummer. Clematis zigzags, with flowers on its
  upper two thirds that turn to silver seed heads.
- **Grass** is tufts of blade stems along the floor's cracks, each tuft with its
  own delay. In spring it starts at half height and grows back. Under snow, only
  the part of a blade above `snow × 6` px shows. Straw creeps in through autumn
  and goes green again in spring. Tips are lighter. Seed heads come late in
  summer.

## Moss

- **A reach field, worked out once.** For every 2 × 2 cell of floor, the time the
  moss arrives is `6 + distance to the nearest source / 0.9 + hash × 8`. The
  sources are the cracks and the climbers' roots. The distance weights `dy × 1.6`,
  because the floor is seen at a slant. Cushions sit on a jittered grid, a little
  bigger nearer the viewer, and swell over 5 s once reached. Hollows fill in dark
  per cell, and cushions are lit at the top left. In spring about one in eight
  sends up spore stalks.
- **The floor is one layer canvas**, repainted only while the moss is still
  spreading (twice a second) and when the season changes. It is the largest
  thing in the scene, so it must not repaint every frame.
- **Moss over what lies on the floor climbs from the ground up, with noise.**
  A pixel is mossy when `moss > height share × 0.8 + hash × 0.25`. Fallen rubble
  and rotting logs use the same rule with the season's moss palette.

## Placement

- **Slots, not scatter.** Trees come up at fixed points along the floor's cracks.
  Each slot has a base height and a start time; staggering the starts (e.g.
  40–120 s apart) brings the wood in one tree at a time. Kinds are shuffled by
  the seed, with any kind the game depends on (a fruit tree to shake) always
  present. Height is `slot.h × SIZE[species] × (0.9 + 0.2 × hash)`; a per-species
  size (apple 0.72, pine 1.15) keeps an orchard tree small and a pine tall.
- **Shrubs go where nothing stands in front of them.** Tall kinds go in the gaps
  between the furniture. Low kinds go along the near edge, anywhere.
- **Draw order is the depth.** Climbers on the back wall, then rubble, then trees,
  the ground, the back shrubs, grass, fruit. Trees draw over the climbers
  because the climbers hug the wall behind them. The full rules are in
  `game-maker:depth-and-lod`.

## Life cycle

Each slot keeps a tree for good, one generation after another. A life is
`{ plan, slot, n, born, grows, dies, falls, side, rots }`, each time in seconds
of the world clock.

- A tree **lives** a few years (e.g. 1500–3000 s with a 600 s year), then dies
  in the next spring (`look.dead` rises while it stands). After a while it
  **goes over** sideways, mostly toward the open middle of the scene where it has
  space to lie, and **rots** for a year or two. Growth stops at death.
- **The gap grows something else**: a few minutes after the fall, a sapling of a
  different kind comes up within a few px of the old root. **A slot the game
  depends on regrows its kind** (the fruit tree the player shakes), so the
  interaction survives every generation.
- **Stagger the first generation's deaths** (one a spring, in a seeded order).
  Independent random lifespans snapped to springs bunch up: six trees spread
  over a few springs can lose half the wood in one.
- **The root plate** is painted under the ground at the root, in the fallen
  tree's painting only. A standing tree would show it as a disc on the floor. As
  the tree turns about the edge of its trunk, the far half of the plate lifts and
  stands up beside the base. That is the one part of a fallen tree that reads
  above grass and furniture.
- **Everything that rode the tree follows whichever tree stands.** Fruit comes
  only from a living fruit tree that is at least 0.9 grown. Falling leaves come
  only from living broadleaves. A bird whose tree is down moves to the tallest
  grown tree.

The schedule itself (lazily extended per seed, order-independent) is in
`game-maker:world-clock`. The topple and the bounce are in
`game-maker:wind-and-springs`, and the turning, moss and crumbling pixels in
`game-maker:posed-pixels`.

## Tests worth having

- Same seed, same tree; a different seed, different limbs.
- Every point stays inside the scene, however tall the tree is asked to be.
- Fruit only on fruit trees; the perch inside the tree.
- Climber stems grow from the base out; a creeper stays on what it covers.
- The life cycle: `born + grows < dies < falls`, the next born after the last
  fell, deaths on a spring, a slot the game depends on never changes kind.
