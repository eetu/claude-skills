---
name: world-clock
description: Build a small pixel world as a pure function of (time, seed, recorded input) — what is where, what has grown, broken, fallen or rotted is computed from `t` and `seed`, never accumulated frame by frame. `@anarkisti/korpi` implements the parts (`core`: hash, streams, memo, `Input`/`Cue`, `within`; `clock`: the calendar; `testing`: deterministic, causal, orderFree, isolated, silentBackwards); this skill is how to use them and why they are shaped so — salts, schedules in closed form, ages on their own clock, lazily extended histories cached on a component, quantised cache keys, input that changes nothing before it, cues from (from, to] windows, support so nothing floats, and the stepped side (`step(state, dt)`, korpi's actor and session) with the tests that pin both down. Use when designing a simulation, an idle/screensaver world, a world that must survive reloads or be scrubbed backwards, a life cycle (grow, die, fall, decay, regrow), anything that breaks over time, or when wiring sound to world events.
user-invocable: true
---

> **Priors, not rails.** The constants are one tuning for a 320×180 scene
> watched for an hour or more; the shape (state derived from the clock,
> randomness from a hash, events from windows) and the tests are what to keep.

# world-clock

Two kinds of simulation live side by side, and each wants its own shape:

| Kind                                  | Shape                                 | Example                                         |
| ------------------------------------- | ------------------------------------- | ----------------------------------------------- |
| A world that runs by itself           | `f(t, seed, input)`: pure             | a wood growing in, a wall crumbling, weather    |
| A game the player plays, rule by rule | `step(state, dt)` over seeded streams | a conveyor of items, a tray that piles up, mail |

Default to the first. Reach for the second only where the rules genuinely depend
on what happened a moment ago (a pile of envelopes, a queue on a belt).

**Use korpi's pieces** rather than writing them:

- `@anarkisti/korpi/core`: `hash` (and `hash2`–`hash4` without the rest array,
  for per-pixel work), `stream` (mulberry32), `noise`, `shuffled`, `within`
  (a sorted list's items in `(from, to]`), `Input`, `Cue`, `Inspect`, and the
  caches `memo`, `weakMemo`, `lru`, `scratch`.
- `@anarkisti/korpi/clock`: a `Calendar` value (`from`, `season`, `day`,
  `month`, `dawn` in seconds; `CALENDAR` is a ten-minute year), `seasonAt`,
  `yearsAt`, `seasonal` (a value per season, eased between their middles).
- `@anarkisti/korpi/testing`: `deterministic`, `causal`, `orderFree`,
  `isolated`, `silentBackwards`, `worstOver`, `logTimes`.

Models work in metres and seconds; story timings (a life, a season's spells)
in the calendar's years and seasons, so a game retunes its calendar without
touching them.

## Why a function of time

Scrubbing works both ways (a dev shuttle runs the world back at −200×,
`game-maker:game-workbench`); a reload keeps it (persist only the start, the
seed and the input; years that passed while the tab was closed included); tests
ask for second 9000 directly; nothing drifts with frame rate. The cost: anything
that _would_ be state must be derivable. Most of this skill is how.

## Randomness: a hash, salted per decision

```ts
const h = (salt: number) => hash(seed, slot + 16 * n, salt);
const falls = dies + DEAD_S + SNAG_S * h(22); // one salt per decision
const side = h(23) < 0.75 ? inward : -inward;
```

- **One salt per decision**, numbered and never reused. A reused salt couples two
  choices (every tall tree also falls left).
- **The finaliser matters.** korpi's hash is FNV-1a then murmur3's finaliser;
  without it consecutive inputs (item 0, 1, 2…) land in near-even steps and
  whatever they place lines up in streaks.
- **Inputs are truncated to ints** (`v | 0`): `hash(0.4)` is `hash(0)`. Hash
  coordinates or indices; multiply first for sub-unit resolution.
- **Never `Math.random`** in the world. A seeded order is `shuffled(items, seed)`.
- **A stream for a plan, a hash for everything else.** A generator that draws
  many numbers in a fixed order (a tree's shape, a wall's bond) takes a
  `stream` seeded _from_ a hash, so adding a draw to one generator does not
  reshuffle every other decision. Anything decided per pixel, item or piece uses
  `hash`: it must answer the same whatever was asked before it.

## Schedules in closed form

Compute _when_ things happen once, up front, from the seed; render by asking
"where is it at `t`?".

- **Collapses that spread**, when no support rule is needed: a piece breaks at
  the minimum over collapse points of `start + t(d)` for its distance `d`
  (quick within a burst radius, then `((d - burst) / pace) ** (1 / 0.55)`), and
  of a "works loose on its own" time, so the world never finishes. Anything
  stacked needs support on top (below).
- **Generations** (trees in fixed slots): each slot holds a chain of lives,
  each derived from the one before, so only the first needs seeding. korpi's
  `standOf` keeps them (`Life`: `born`, `dies`, `falls`, `side`, `rots`).
  - **Snap to the calendar** where it reads better: `dies` is the first spring at
    or after the drawn lifespan, so a dead broadleaf is one that never leafs out.
  - **Stagger the first generation** by a seeded order (one death per spring).
    Independent draws cluster, and three trees falling in one minute reads as a
    bug.
- **Ages on their own clock.** A wood can grow in five years in a few minutes,
  then age a year per world year (`growIn: { years, by }`). Write the mapping and
  its inverse once (`stand.ageAt(life, t)`, `stand.timeOf(life, age)`): deaths,
  shed branches and fruit seasons are scheduled in ages and placed in time by
  the inverse.
- **Spreading fields** (moss over a floor): compute once when the front reaches
  each cell, and draw a cell iff its time `<= t`. Growth is a lookup, not a
  flood fill per frame (`mossOf`, `game-maker:procedural-plants`).
- **Kinematics** are closed form too (`ballistic`, `fallTime`):
  `game-maker:wind-and-springs`.

## Histories that extend themselves, and where caches live

An open-ended chain (generations, forever) cannot be built up front. Extend it
lazily to cover the asked moment: every link depends only on the seed and the
previous link, so the result cannot depend on which moment was asked first.
**Test that** with `orderFree`: ask for 15000, then 100, 5000, 15000 again.

Where caches may live is korpi's rule: **a component is a value built from a
spec, and its caches live on it** (`lru`), or in a `memo`/`weakMemo` of a pure
function of all its arguments, or in a `scratch` buffer used within one call.
No top-level `let` or `new Map`: two instances (two seeds on a bench grid)
would read each other's state. `isolated` checks it, and every instance reports
`inspect()` (bakes, bake ms, cached, queries).

## Quantised cache keys

Anything expensive (painting a tree, a heap of rubble, a distant landscape) is
cached under a key built from the clock _rounded to steps_:

```ts
const key = `${life.n}|${ageStep}|${look.k}|${Math.round(look.p * 24)}|${Math.ceil(dead * 12)}`;
```

- **The step is the level of detail in time.** korpi draws a tree's age in
  steps of a 24th of a year (`stand.ageStep`), about a pixel of growth; season
  progress `p * 24`. Pick the coarsest step nobody notices.
- **Paint with the step, not the live value**, or the cache holds whatever moment
  first hit the key.
- **Include "it changed state at all"** when 0 and a tiny value round alike: a
  deadness of 0.001 must not reuse the living tree's paint, hence `ceil`.

## Player input as recorded data

Record what the player does as korpi's `Input` (`{ t, p, kind, source }`) and
make it one more input to the pure function. A tap that shakes a fruit down
early: `knocks["year:apple"] = t`, and `drops = min(scheduled, knocks[key] ??
Infinity)`. Scrubbing back before the tap shows the fruit hanging again.

**An input changes nothing before its `t`.** Whatever the world bakes from input
must give the same answers up to that moment with or without it, or a tap makes
what is already on screen jump. A world with more input is another bake from the
same seed (`wall.fork(inputs)`). Test it with `causal`: several inputs, at once,
on what is already gone.

## Cues: events from (from, to] windows

Sound (and anything else that fires once) is derived, not emitted: each frame
asks what happened between the previous `t` and this one (`within(sorted,
from, to)`), e.g. every tree with `from < falls <= to` cracks, and every one
with `from < falls + FALL_S <= to` crashes where its crown lands.

- **Half-open window, `from` exclusive**, so an event on a frame boundary fires
  once.
- **`to <= from` returns nothing**: scrubbing backwards is silent
  (`silentBackwards`).
- **Periodic cues** compare phases: `(to - t0) % P < (from - t0) % P` means the
  cycle wrapped in the window (an owl hooting every 23 s).
- **A cue carries its place** (`Cue`: `t`, `p` in world metres, `kind`, `size`),
  so the stage can pan it and a fast-forwarded frame can hold many.
- **The stage drains, the world never hears.** Nothing audible feeds back.

## Structures that break: nothing floats

A schedule that takes away what is underneath leaves the pieces above hanging
unless support is a rule: contacts from pixel adjacency (3 px of shared edge, so
one pixel reads as a crack), a piece standing on its **bed** (contacts strictly
lower; any shared edge lets pieces hang off a neighbour's side), and the
cascade replayed once at build time, each piece a moment after its last support.
Things hung on the structure go with the piece above them. Masonry done
properly is korpi's `masonry`: `game-maker:breaking-structures`.

## The stepped side

- **Engines** (`step(state, dt)`, pure TypeScript, no DOM, stepped by the frame
  loop) **clamp `dt`** (`min(0.1, max(0, dt))`, NaN to 0) so a backgrounded tab
  can't deliver a ten-second step; push what can be heard onto `state.events`
  for the stage to drain; and draw anything whose count depends on the player
  from **a stream of its own**, so a player who keeps a pile short doesn't
  change what spawns next.
- **Output never depends on the player** (when that is the design): run idle,
  perfect, contrarian and slow players against one seed and assert identical
  outcomes.
- **A body the player moves** is korpi's `actor`: `stepBody` on a fixed tick
  (1/60 s) under the world's gravity, air and solids; `actorOf` logs every
  command, so its log is its input and any past moment reads back. `session`
  (`sessionOf`) runs world time `realtime`, at a `shuttle` rate, or
  `moveToAdvance`; control taken in the past starts a branch (`redo` restores
  the old future), and `preview` tries a plan on a fork.

## Tests worth writing

- **Ordering**: every life has `born + grows < dies < falls`, and the next is
  born after the previous fell. `dies` lands on a spring.
- **Invariants over many seeds and times** (`logTimes` reaches late years,
  `worstOver` finds the worst frame): nothing floats, everything fallen lands on
  the floor, a slot that must regrow its own kind always does.
- **korpi's properties**: `deterministic`, `orderFree`, `isolated`, `causal`,
  `silentBackwards`.
- **It never finishes**: there are cues in `[0, 60]`, `[600, 1800]` and
  `[4000, 6000]`.

## Traps

- **A frame-accumulated value hidden in a pure world** (a counter incremented in
  draw) breaks scrubbing and reloads silently. Grep the draw path for `+=`.
- **A cache keyed on the live clock** (`t` unrounded) never hits.
- **Random draws inside a cascade** (who falls next) must be hashed by piece,
  not taken from a stream, or the cascade depends on evaluation order.
- **Hash by an identity later input cannot change.** Things numbered as a bake
  makes them (the pieces of a break) must not be numbered after everything the
  bake holds: one more input renumbers them all, and whatever is hashed from the
  number changes before the input. Number them in a range of their own, in the
  order they are made.
