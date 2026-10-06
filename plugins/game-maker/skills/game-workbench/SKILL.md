---
name: game-workbench
description: The dev loop for a small pixel world that is a function of time and seed. `@anarkisti/korpi/bench` implements the workbench (`mountBench(node, { units })` in plain DOM: each unit alone with live controls, a grid of seeds, a depth overlay, drag to pan; `simClock` for simulator units; `timeDraws` for frame time), `@anarkisti/korpi/clock` the shuttle's `rateOf`, and `@anarkisti/korpi/testing` raster `fingerprint`s; nahkarele's `/workbench` is a Svelte bench over the same shape. This skill is how to use them and the practice around them — pieces that draw themselves, simulator units that play, poke and retune a baked world, a time shuttle that runs the world ahead or back at up to 200×, Playwright scripts that warp to a moment and screenshot it, ImageMagick montages, fingerprints that prove a refactor changed nothing, and frame time measured against a baseline in a git worktree. Use when setting up dev tooling for a canvas game or simulation, adding a piece that should be inspectable on its own, checking a change visually at a time that takes hours to reach, proving a move or refactor is behaviour-preserving, or measuring whether a feature made frames slower.
user-invocable: true
---

> **Priors, not rails.** This tooling makes a world of hours-long processes
> (trees living for years, a wall crumbling for an afternoon) workable in
> minutes. Keep that every piece can be drawn alone, that time is a control, and
> that "looks the same" and "is as fast" are measured, not judged.

# game-workbench

A world that is a pure function of `(t, seed, input)` (`game-maker:world-clock`)
can be shown at any moment, alone, side by side with its variants, and run
backwards. This skill is the tooling that cashes that in.

## The precondition: pieces draw themselves

A tree, a sprite, a wall calendar, a line of pixel text: each is a paint
function over a pen and plain values (`game-maker:pixel-brushes`), with no DOM
and no reach into the game's stores. A piece that reads a store can only be seen
inside the game, at whatever moment the game happens to be in. Keep new pieces
this shape, and the game's stage a thin caller of them.

## The bench

A bench shows one **unit** at a time: a small adapter over a library painter
that sets the stage and draws nothing of its own. korpi's `Unit`
(`@anarkisti/korpi/bench`):

```ts
type Unit = {
  name: string;
  about: string; // what it shows, and what a tap does
  defaults: Values; // a `seed` key makes the grid of seeds available
  params: (v: Values) => Param[]; // range | select | seed | text | toggle; hint, group
  frame: (v: Values) => Omit<Oblique, "pan">; // the scene's size and view
  draw: (stage: Stage, v: Values, t: number) => void; // { scene, pen, view }
  animated?: boolean; // redrawn every frame on the bench clock
  tap?: (v: Values, t: number, at: Tap) => void; // scene px and the world point there
  inspect?: (v: Values) => Record<string, number>; // an instance's counters
};
```

- **`mountBench(node, { units, title, storageKey, grid })`** mounts it in plain
  DOM (Svelte can `use:` it) and keeps what it was showing through reloads.
  Keys: `[` `]` between units, `g` the grid of seeds, `r` a new seed, `d` the
  depth overlay, space pauses the clock, `+` `-` zoom, `0` resets the pan; drag
  pans. The clock runs only for animated units.
- **korpi's gallery** (`yarn dev` in korpi, :5180) puts every `*.unit.ts` on one
  bench; `yarn new <name>` makes a component folder with its index, test, unit
  and its place in the layer order.
- **nahkarele's `/workbench`** is a Svelte route with its own `Unit` (`size`
  in place of `frame`, a `Stage` of `{ pen, scene }`), its units in
  `src/routes/workbench/units.ts` and the wall simulator in `wallSim.ts`. It is
  served in production too, unlinked and `noindex`; the dev bar that opens it
  is a dev-only dynamic import.
- **Grid of seeds**: the same values at `seed`, `seed+1`, … Procedural content
  is judged across seeds, never on the one that happened to look good.
- **Hints are facts** (a unit, what its ends mean) and tuning knobs fold under
  a `group`, so the controls for looking stay few.

**Trap: a time slider must reach the times you need to look at.** A `since`
range sized for the first year cannot show a tree that dies in year four. Size
ranges from the world's longest process, not from the default.

## A simulator unit

A world baked from input (a seed, a tuning, blows at moments) gets a unit that
plays it, pokes it and retunes it, not only a still picture.

- **Its own clock**: `simClock()` reads the unit's `since` slider and `rate`
  (`RATES`: 1×, 10×, 100×, 1000×), re-anchoring on any change so the world
  never jumps. Give the slider sub-second steps, or a single fall can't be
  found.
- **Taps are timed input**: a tap records an `Input` at that moment and
  re-bakes (`wall.fork`); scrubbing back before it undoes it, for free. Add a
  "forget taps" choice rather than a button the bench doesn't have.
- **Sliders re-bake**: every tunable constant is a range. Key the bake cache by
  seed, tuning and input (a small `lru`), so a grid of seeds doesn't re-bake
  each frame.
- **On or off is a `toggle`**, not a two-item select.
- **Overlays as a select**: the real look plus debug views (each piece by its
  class, the hazard as a heat map, the release order, the heap's profile) and a
  readout in the scene's pixel font; `inspect` shows the counters under it.
- **A companion unit** shows one piece alone with sliders for its pose and look,
  to tune the drawing apart from the physics.

## Time as a control in the running game

A dev bar under every page jumps between levels or days and holds the
**shuttle**: a thumb resting in the middle at 1×. Pulled right the world runs
ahead, left it runs back; let go, it springs back (a CSS transition with an
overshooting cubic-bezier) and speed returns to 1×. `rateOf(pull)` from
`@anarkisti/korpi/clock`: past a slack of 0.08, `sign·200^u`, so equal pulls
multiply (fine near 1×, an hour in 18 s at full pull).

- **Apply a rate by moving the epoch, not by scaling `t`.** The clock is
  `t = (now − startedAt) / 1000`; a rate shifts `startedAt` by `dt·(rate − 1)`
  each frame (clamped at `t ≥ 0`). Everything that reads the clock follows, and
  because the start is persisted a reload stays where you shuttled to.
  Running backwards needs no undo, since nothing is stepped. (korpi's
  `session` has the same as a `shuttle` policy.)
- **Leaving never leaves the world racing**: the component's cleanup sets the
  rate back to 1. Held arrow keys shuttle too, harder the longer they are held.
- **`warp(t)`** puts the clock at any moment. Scripts use it; the shuttle is for
  eyes.
- **Dev keys read `e.code`, not `e.key`.** Shift + `Digit1`–`Digit5` jumps to a
  level on any keyboard layout without colliding with digits the game uses;
  `Backquote` or `IntlBackslash` (§ on a Nordic Mac) flips between the game and
  the bench and back.

## Looking, with Playwright

Borrow Playwright from a sibling project's `node_modules` (`require` it by
absolute path) instead of adding a dependency. Run a second dev server on its
own port (`yarn dev --port 5199 --strictPort`) so scripts never fight the one
you are using.

Drive the app through its own modules: under Vite's dev server, `import("/src/…")`
inside `page.evaluate` returns the same module instances the app runs, so a
script can jump a level, warp the clock, or ask the world a question.

```js
await page.evaluate(async (t) => {
  const { world } = await import("/src/world.svelte.ts"); // your store
  world.warp(t);
}, t);
await page.waitForTimeout(150); // let a frame draw at the new time
await page
  .locator("canvas")
  .first()
  .screenshot({ path: `at-${t}.png` });
```

- **Ask the world when things happen, then shoot those moments**: find when a
  tree dies, falls and rots, and warp to each.
- **Bench shots**: press `]` to the unit, fill params by their label text,
  screenshot the tile. Pass params as JSON so one script shoots any unit.
- **Compare stages in one image**: `magick shot.png -crop 400x200+20+300 +repage
a.png` (`+repage` drops the old offset), then `magick a.png b.png +append
row.png` (`-append` stacks). Crop to what changed, zoomed: a fallen log at a
  wall's foot vanishes in a full frame.
- **Headless Chromium is not Safari**: a canvas bug only Safari shows never
  appears in a capture (`game-maker:posed-pixels`).

**Trap: stale modules after many HMR edits.** The script's `import()` can stop
reaching the instance the app runs, so state set from the script never shows.
Restart the dev server before trusting a run.

**Trap: an animated bench unit's clock keeps running** while the script fills
params, so a shot lands half a second or more late. When the exact moment
matters (a 2.4 s fall), warp the game instead, or pause the bench first.

## Fingerprints: proving a refactor changed nothing

`fingerprint(raster)` from `@anarkisti/korpi/testing` hashes a raster's colours,
its depth (unless `{ depth: false }`) and its glow, as `320x180:1a2b3c4d`.
Before moving code, record prints of fixed scenes; after, compare. Pick moments
that exercise every phase (before the seasons, each season, a recorded tap;
stepped engines with a fixed seed stepped a fixed count). A changed print is
changed pixels or depths: fix it, or accept it explicitly when it was meant and
re-baseline. korpi keeps them as snapshots in `*.perf.test.ts`, beside counter
budgets (bakes, cache size, bodies per frame, `PenStats`) that are the same on
every machine; a changed fingerprint is a minor version in 0.x.

## Frame time

`timeDraws(draw, { at, step, warm, runs })` gives `{ mean, p95, worst }` ms:
`warm` untimed calls fill caches and bakes, then `runs` timed ones.

- **Time the moments that cost**: a tree mid-fall, logs lying, late years with
  more on screen, not only the opening (`logTimes` reaches them).
- **Find the hot painter** by counting a pen's fills per caller
  (`new Error().stack.split("\n")[3]`); a raster pen's `stats` count fills,
  writes, blends and rejects.
- **Baseline in a worktree, not from memory.** A number from an earlier session
  ran under a different machine load. korpi's `yarn bench:compare <ref>` runs
  the same benches at `<ref>` in a worktree, then here, back to back.
- Put the result in the commit message ("frames still 3.6–4.1 ms"): the cost of
  a feature is information a reviewer can't get from the diff.
- **Pin every input the harness draws with.** Build the state in the harness
  rather than borrowing a store's live one. A harness that spread a store's
  current state timed whatever screen it was on and reported 0.4 ms for a 4 ms
  scene. A number that drops tenfold without a reason is a harness bug until
  shown otherwise.

## The gate

`yarn validate` (typecheck, lint, format or Biome, tests) runs in the pre-commit
hook. Engines and schedules are pure, so vitest covers them without a DOM; the
bench and the scripts are for what a test can't judge: how it looks and how
fast it draws.
