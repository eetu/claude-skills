---
name: world-clock
description: Build a small canvas world as a pure function of (time, seed) — what is where, what has grown, broken, fallen or rotted is computed from `since` and `seed`, never accumulated frame by frame. Covers the hash and its salts, schedules in closed form (collapses, generations of trees, spreading fields), ages on their own clock, lazily extended histories cached by seed, quantised cache keys so repaints happen at steps, player input recorded as data that changes nothing before it, sound cues from (from, to] windows, support graphs so nothing floats, and the stepped-engine side (`step(state, dt)` plus an events queue) with the tests that pin both down. Use when designing a simulation, an idle/screensaver world, a world that must survive reloads or be scrubbed backwards, a life cycle (grow, die, fall, decay, regrow), anything that breaks over time, or when wiring sound to world events.
user-invocable: true
---

> **Priors, not rails.** The constants below are example tuning for a 320×180
> scene watched for an hour or more; the parts worth keeping are the shape
> (state derived from the clock, randomness from a hash, events from windows)
> and the tests that keep it honest.

# world-clock

Two kinds of simulation live side by side, and each wants its own shape:

| Kind                                  | Shape                                 | Example                                         |
| ------------------------------------- | ------------------------------------- | ----------------------------------------------- |
| A world that runs by itself           | `f(since, seed)`: pure, no state      | a wood growing in, a wall crumbling, weather    |
| A game the player plays, rule by rule | `step(state, dt)` over seeded streams | a conveyor of items, a tray that piles up, mail |

Default to the first. Reach for the second only where the rules genuinely depend
on what happened a moment ago (a pile of envelopes, a queue on a belt).

## Why a function of time

- **Scrubbing works both ways.** A dev shuttle can run the clock at -200× and the
  world un-grows, un-falls, un-rots (`game-maker:game-workbench`).
- **A reload keeps it.** Persist only when it began (`startedAt`) and the seed;
  `since = (Date.now() - startedAt) / 1000` rebuilds everything, including years
  that passed while the tab was closed.
- **Tests need no DOM and no loop.** Ask for second 9000 directly.
- **Nothing drifts**: no accumulated float error, no frame-rate dependence.

The cost: anything that _would_ be state must be derivable. Most of this skill is
how to derive it.

## Randomness: a hash, salted per decision

```ts
// FNV-1a over ints, then murmur3's finaliser: 0..1, stable for the same inputs.
export const hash = (...n: number[]): number => {
  let h = 2166136261;
  for (const v of n) h = Math.imul(h ^ (v | 0), 16777619);
  h ^= h >>> 16;
  h = Math.imul(h, 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};

const h = (salt: number) => hash(seed, slot + 16 * n, salt);
const falls = dies + DEAD_S + SNAG_S * h(22); // one salt per decision
const side = h(23) < 0.75 ? inward : -inward;
```

- **One salt per decision**, numbered and never reused. A reused salt couples two
  choices (every tall tree also falls left).
- **Keep the finaliser.** Without it consecutive inputs (item 0, 1, 2…) land in
  near-even steps, and whatever they place lines up in streaks.
- **Inputs are truncated to ints** (`v | 0`): `hash(0.4)` is `hash(0)`. Hash
  coordinates or indices; multiply first for sub-unit resolution.
- **Never `Math.random`** in the world. A seeded shuffle is a hash-driven
  Fisher–Yates.
- **A stream for a plan, a hash for everything else.** A generator that draws
  many numbers in a fixed order (a tree's shape) takes a seeded PRNG (mulberry32)
  seeded _from_ a hash, so adding a draw to one generator does not reshuffle
  every other decision. Anything decided per pixel, item or piece uses `hash`:
  it must answer the same whatever was asked before it.

## Schedules in closed form

Compute _when_ things happen once, up front, from the seed; render by asking
"where is it at `since`?".

- **Collapses that spread**, when no support rule is needed: a list of collapse
  points with start times, and a piece breaks at the minimum over them of
  `start + t(d)` for its distance `d` (quick within a burst radius, then
  `((d - burst) / pace) ** (1 / 0.55)`: fast at first, slower for ever), and of
  a "works loose on its own" time, so the world never finishes. Anything stacked
  needs the support rule below on top.
- **Generations** (trees in fixed slots): each slot holds a chain of lives,
  `{ born, grows, dies, falls, side, rots }`, each derived from the one before
  (`next.born = prev.falls + FALL_S + EMPTY_S + GAP_S * h(25)`), so only the
  first needs seeding.
  - **Snap to the calendar** where it reads better. `dies` is the first spring at
    or after the drawn lifespan, so a dead broadleaf is simply one that never
    leafs out.
  - **Stagger the first generation** by a seeded order (one death per spring).
    Independent draws cluster, and three trees falling in one minute reads as a
    bug.
- **Ages on their own clock.** A thing's age need not run at the world's pace:
  a wood can grow in five years in a few minutes, then age a year per world
  year. Write the mapping and its inverse once (`ageAt(life, t)`,
  `timeAt(life, age)`): deaths, shed branches and fruit seasons are scheduled in
  ages and placed in time by the inverse.
- **Spreading fields** (moss over a floor): compute once when the front reaches
  each cell, and draw a cell iff its time `<= since`. Growth is a lookup, not a
  flood fill per frame (`game-maker:procedural-plants`).
- **Kinematics** are closed form too (`y = y0 + ½gt²`, a topple angle `∝ u²`):
  `game-maker:wind-and-springs`.

## Histories that extend themselves

An open-ended chain (generations, forever) cannot be built up front. Extend it
lazily to cover the asked moment, and cache it by seed:

```ts
let stand: { seed: number; slots: Life[][] } | null = null;

const slotsTo = (seed: number, since: number): Life[][] => {
  if (stand?.seed !== seed) stand = { seed, slots: firstLives(seed) };
  for (const lives of stand.slots) {
    while (lives[lives.length - 1].falls <= since)
      lives.push(nextOf(seed, lives.at(-1)!));
  }
  return stand.slots;
};
```

Every link depends only on `seed` and the previous link, so the result cannot
depend on which moment was asked first. **Test that**: ask for 15000, then 100,
5000, 15000 again (switching seed in between) and compare.

Module-level caches keyed by seed are the only state allowed. A cache that keys
on anything the frame supplies (the last `since`) must be a pure memo of the
same frame.

## Quantised cache keys

Anything expensive (painting a tree, a layer of rubble, a distant landscape) is
cached under a key built from the clock _rounded to steps_:

```ts
const key = `${seed}|${life.n}|${growStep}|${look.k}|${Math.round(look.p * 24)}|${deadStep}`;
```

- **The step is the level of detail in time.** Growth in 40 steps over 180 s is
  a repaint every 4.5 s; season progress `p * 24`; deadness `ceil(dead * 12)`.
  Pick the coarsest step nobody notices.
- **Paint with the step, not the live value**, or the cache holds whatever moment
  first hit the key.
- **Include "it changed state at all"** when 0 and a tiny value round alike: a
  deadness of 0.001 must not reuse the living tree's paint, hence `ceil`.

## Player input as recorded data

When the player may affect the world, record the act as data keyed by time and
make it one more input to the pure function. A tap that shakes a fruit down
early: `taps["year:fruit"] = since`, and
`dropAt = min(scheduledDrop, taps[key] ?? Infinity)`. Scrubbing back before the
tap shows the fruit hanging again.

**An input changes nothing before it.** Whatever the world bakes from input must
give the same answers up to the input's time with or without it, or a tap makes
what is already on screen jump. Test exactly that: bake with and without an
input (several, at once, on what is already gone) and compare everything before
it.

## Cues: events from (from, to] windows

Sound (and anything else that fires once) is derived, not emitted: each frame
asks what happened between the previous `since` and this one.

```ts
export const fellCue = (from: number, to: number, seed: number): Fell[] =>
  lives.flatMap((l) =>
    l.falls > from && l.falls <= to
      ? [{ x: l.plan.root.x, kind: "crack" }]
      : l.falls + FALL_S > from && l.falls + FALL_S <= to
        ? [{ x: l.plan.root.x + l.side * l.plan.height * 0.6, kind: "crash" }]
        : [],
  );
```

- **Half-open window, `from` exclusive**, so an event on a frame boundary fires
  once.
- **`to <= from` returns nothing**: scrubbing backwards is silent.
- **Periodic cues** compare phases: `(to - t0) % P < (from - t0) % P` means the
  cycle wrapped in the window (an owl hooting every 23 s).
- **Return a list with positions** (`x`), so the stage can pan the sound and a
  fast-forwarded frame can hold many.
- **The stage drains, the world never hears.** The frame loop calls every cue
  with `(previous.since, world.since)` and plays what comes back.

## Structures that break: nothing floats

A breaking structure needs a support rule, or a schedule that takes away what is
underneath leaves the pieces above hanging:

1. Build a contact graph once from pixel adjacency, kept from 3 px of shared
   edge. A one-pixel contact reads as a crack.
2. A piece stands on its **bed**: contacts with what is strictly lower. Any
   shared edge is not enough; with that, pieces hang off a neighbour's side.
3. Replay the cascade once at build time: after each break, settle what no
   longer stands, each piece a moment after its last support. The cascade
   becomes part of the timeline.
4. Things hung on the structure go with the piece above them.

Pin it with a test that counts pieces standing on nothing at many times and
seeds. Masonry done properly is `game-maker:breaking-structures`.

## The stepped side

Rules that depend on what just happened stay in an engine: `step(state, dt)`,
pure TypeScript, no DOM, stepped by the frame loop.

- **Clamp `dt`** (`min(0.1, max(0, dt))`, NaN to 0). A backgrounded tab must
  not deliver a ten-second step.
- **Events go on `state.events`**; the stage drains them each frame
  (`s.events.splice(0)`) into sound. Nothing audible feeds back.
- **Separate seeded streams** for draws whose count depends on the player, so a
  player who keeps a pile short does not change what spawns next.
- **Output never depends on the player** (when that is the design): run idle,
  perfect, contrarian and slow players against one seed and assert identical
  outcomes.

## Tests worth writing

- **Ordering**: every life has `born + grows < dies < falls`, and the next is
  born after the previous fell. `dies` lands on a spring.
- **Invariants over many seeds and times**: nothing floats, everything fallen
  lands on the floor, a slot that must regrow its own kind always does.
- **Order independence** of lazily built histories and memoised queries:
  forwards, backwards, shuffled.
- **Same seed, same world**; an input changes nothing before it.
- **It never finishes**: there are cues in `[0, 60]`, `[600, 1800]` and
  `[4000, 6000]`.

## Traps

- **A frame-accumulated value hidden in a pure world** (a counter incremented in
  draw) breaks scrubbing and reloads silently. Grep the draw path for `+=`.
- **A cache keyed on the live clock** (`since` unrounded) never hits.
- **Random draws inside a cascade** (who falls next) must be hashed by piece,
  not taken from a stream, or the cascade depends on evaluation order.
- **Hash by an identity later input cannot change.** Things numbered as a bake
  makes them (the pieces of a break) must not be numbered after everything the
  bake holds: one more input renumbers them all, and whatever is hashed from the
  number changes before the input. Number them in a range of their own, in the
  order they are made.
