---
name: game-workbench
description: The dev loop for a small pixel-art canvas world that is a function of time and seed — a workbench that draws each scene piece alone with live controls and a grid of seeds, simulator units that play, poke and retune a baked world, a time shuttle that runs the world ahead or back at up to 200×, Playwright scripts that warp to a moment and screenshot it, ImageMagick montages to compare stages, pixel fingerprints that prove a refactor changed nothing, and a frame-time harness with a baseline measured in a git worktree. Use when setting up dev tooling for a canvas game or simulation, adding a piece that should be inspectable on its own, checking a change visually at a time that takes hours to reach, proving a move or refactor is behaviour-preserving, or measuring whether a feature made frames slower.
user-invocable: true
---

> **Priors, not rails.** This tooling makes a world of hours-long processes
> (trees living for years, a wall crumbling for an afternoon) workable in
> minutes. Port numbers, speeds and harness sizes are incidental; the parts worth
> keeping are that every piece can be drawn alone, that time is a control, and
> that "looks the same" and "is as fast" are measured, not judged.

# game-workbench

A world that is a pure function of `(time, seed)` (see `game-maker:world-clock`)
can be shown at any moment, alone, side by side with its variants, and run
backwards. This skill is the tooling that cashes that in.

## The precondition: pieces draw themselves

A tree, a sprite, a wall calendar, a line of pixel text: each is a draw function
over a `CanvasRenderingContext2D` and plain values, with no DOM and no reach into
the game's stores. A piece that reads a store can only be seen inside the game,
at whatever moment the game happens to be in. Keep new pieces this shape, and the
game's own stage a thin caller of them.

## The bench

A dev-only route (`/workbench`) shows one **unit** at a time. A unit is a small
adapter over a draw function in the library; it sets the stage and never draws
anything of its own.

```ts
type Unit = {
  name: string;
  defaults: Values; // a `seed` key makes the grid of seeds available
  params: (v: Values) => Param[]; // range | select | seed | text; may depend on v
  size: (v: Values) => { w: number; h: number }; // scene px
  draw: (ctx: CanvasRenderingContext2D, v: Values, t: number) => void;
  animated?: boolean; // redraw every frame on the bench clock
  tap?: (v: Values, t: number, at: { x: number; y: number }) => void;
};
// e.g. the wood: draw: (ctx, v, t) => drawTrees(ctx, Number(v.since) + t, Number(v.seed))
```

- **Grid of seeds** (`g`): the same values at `seed`, `seed+1`, … `seed+7`.
  Procedural content is judged across seeds, never on the one that happened to
  look good.
- **Keys:** `[` `]` between units, `r` a new seed, `space` pauses the clock,
  `-` `+` zoom. The clock runs only for animated units.
- **Crisp pixels:** each tile sizes its canvas to `size × zoom × devicePixelRatio`,
  sets the transform to that factor, `imageSmoothingEnabled = false`, and CSS
  `image-rendering: pixelated`.
- **Tap** maps the pointer to scene px and calls `unit.tap`, which records the
  tap in the unit's own state (taps per seed); a tap counter forces a redraw so a
  paused tile still shows it.
- **Dev only:** the route's `load` throws `error(404)` unless
  `import.meta.env.DEV`, and the dev bar is a dynamic import behind the same
  check, so neither reaches the production bundle.

**Trap — a time slider must reach the times you need to look at.** A `since`
range sized for the first year cannot show a tree that dies in year four. Size
ranges from the world's longest process, not from the default.

## A simulator unit

A world that is baked from input (a seed, a tuning, blows given at moments) gets
a unit that plays it, pokes it and retunes it, not only a still picture.

- **Its own clock:** a `since` slider plus a rate starting at 1× (10×, 100×,
  1000×; the bench's own play and pause covers paused). Re-anchor on any change: `base = slider` when the slider moves,
  `base += (t − t0)·oldRate` when the rate changes. The world then never jumps.
  Give the slider sub-second steps, or a single fall cannot be found.
- **Taps are timed input:** a tap records `{t: since, x, y, kind}` into the input
  list and re-bakes. Scrubbing back before it un-does it, for free. Add a
  "forget taps" choice rather than a button the bench doesn't have.
- **Sliders re-bake:** every tunable constant is a range control. Key the bake
  cache by seed, tuning and input (a small map, the newest 16) so a grid of
  seeds doesn't re-bake each frame.
- **On or off is a checkbox**, not a two-item dropdown (a `toggle` control whose
  value is 1 or 0).
- **Overlays as a select:** the real look, plus debug views (each piece by its
  class, the hazard as a heat map, the release order, a profile of the heap), and
  a readout drawn in the scene with the pixel font (counts, bake ms).
- **A companion unit** shows one piece alone with sliders for its pose and its
  look, to tune the drawing apart from the physics.

## Time as a control in the running game

A dev bar under every page jumps between levels or days and holds the
**shuttle** (a `TimeShuttle` component): a thumb that rests in the middle at
normal speed. Pulled right, the world runs ahead; left, it runs back. Let go, it
springs back to the middle (a CSS transition with an overshooting cubic-bezier)
and speed returns to 1×.

```ts
const FASTEST = 200; // at full pull: a 600 s year passes in 3 s, an hour in 18 s
const SLACK = 0.08; // a pull this small is still 1×, so a touch changes nothing
const rateOf = (pull: number) => {
  const u = (Math.abs(pull) - SLACK) / (1 - SLACK);
  if (u <= 0) return 1;
  return Math.sign(pull) * FASTEST ** u; // equal pulls multiply: fine near 1×, reach at the end
};
```

- **Apply a rate by moving the epoch, not by scaling `since`.** The clock is
  `since = (now - startedAt) / 1000`; a rate shifts `startedAt` by
  `dt × (rate - 1)` each frame (clamped so `since ≥ 0`). Everything that reads
  the clock follows, and because the start is persisted, a reload stays where
  you shuttled to. Running backwards needs no undo, since nothing is stepped.
- **Leaving never leaves the world racing:** the component's cleanup sets the
  rate back to 1. Held arrow keys shuttle too, harder the longer they are held.
- **`world.warp(since)`** puts the clock at any moment. Scripts use it; the
  shuttle is for eyes.
- **Dev keys read `e.code`, not `e.key`.** Shift + `Digit1`–`Digit5` jumps to a
  level on any keyboard layout and never collides with digit keys the game
  uses; `Backquote` or `IntlBackslash` (the § key on a Nordic Mac) flips between
  the game and the bench, and goes back to where it came from.

## Looking, with Playwright

Borrow Playwright from a sibling project's `node_modules` (`require` it by
absolute path) instead of adding a dependency. Run a second dev server on its
own port (`yarn dev --port 5199 --strictPort`) so scripts never fight the dev
server you are using.

Drive the app through its own modules: under Vite's dev server,
`import("/src/…")` inside `page.evaluate` returns the same module instances the
app runs, so a script can jump a level, warp the clock, or ask the world a
question.

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

- **Ask the world when things happen, then shoot those moments**: import the
  schedule in the page, find when a tree dies, falls and rots, and warp to each.
- **Bench shots:** press `]` to the unit, fill params by their label text,
  screenshot `main`. Pass params as JSON so one script shoots any unit.
- **Compare stages in one image:** crop and tile with ImageMagick, then read
  the montage.

  ```sh
  magick shot.png -crop 400x200+20+300 +repage a.png   # +repage drops the old offset
  magick a.png b.png c.png +append row.png             # side by side; -append stacks
  ```

- **Crop to what changed**, zoomed: a fallen log at a wall's foot vanishes in a
  full frame.
- **Headless Chromium is not Safari.** A canvas bug only Safari shows never
  appears in a capture (`game-maker:posed-pixels`).

**Trap — stale modules after many HMR edits.** The script's `import()` can stop
reaching the module instance the app runs, so state set from the script never
shows on screen. Restart the dev server before trusting a run.

**Trap — an animated bench unit's clock keeps running** while the script fills
params, so a shot at `since = 5195` lands half a second or more later. When the
exact moment matters (a 2.4 s fall), warp the game instead, or pause the bench
first.

## Fingerprints: proving a refactor changed nothing

Before moving code, record a fingerprint of fixed scenes; after, compare.

```js
const print = () => {
  const d = ctx.getImageData(0, 0, 320, 180).data;
  let h = 2166136261;
  for (let i = 0; i < d.length; i++) h = Math.imul(h ^ d[i], 16777619);
  return (h >>> 0).toString(16);
};
// stepped engines: create with a fixed seed, step(s, 0.05) × 200, draw, print
// time-driven scenes: draw at fixed (since, seed, recorded input) moments, print each
```

Pick moments that exercise every phase (before the seasons, each season, a
recorded tap). Print JSON, diff the two runs. A changed print means changed
pixels. Fix the change, or accept it explicitly when it was meant (a rect merge
that sharpened distant edges) and re-baseline.

## Frame time

Time the real draw call into an offscreen canvas at the on-screen scale:

```js
const c = Object.assign(document.createElement("canvas"), {
  width: 960,
  height: 540,
});
const ctx = c.getContext("2d");
ctx.setTransform(3, 0, 0, 3, 0, 0);
for (let i = 0; i < 20; i++) drawScene(ctx, at + i * 0.016); // warm caches and bakes
const t0 = performance.now();
for (let i = 0; i < 200; i++) drawScene(ctx, at + i * 0.016);
const ms = (performance.now() - t0) / 200;
```

- **Time the moments that cost:** a tree mid-fall, logs lying, late years with
  more on screen, not only the opening.
- **Find the hot painter** by wrapping `ctx.fillRect` and counting calls per
  caller (`new Error().stack.split("\n")[3]`); count `drawImage` the same way.
- **Baseline in a worktree, not from memory.** A number from an earlier session
  ran on a different machine load. Check out the comparison commit with
  `git worktree add`, serve it on another port, and run the same harness against
  both, back to back.
- Put the result in the commit message ("frames still 3.6–4.1 ms"): the cost of
  a feature is information a reviewer cannot get from the diff.
- **Pin every input the harness draws with.** Build the state in the harness
  (`{ seed, since, after: true, … }`) rather than borrowing the store's live
  one. **Trap:** a harness that spread the store's current state over its own
  timed whatever screen the store happened to be on, and reported 0.4 ms for a
  4 ms scene. A number that drops tenfold without a reason is a harness bug
  until shown otherwise.

## The gate

`yarn validate` (typecheck, lint, format, test) runs in the pre-commit hook.
Engines and schedules are pure, so vitest covers them without a DOM; the bench
and the scripts are for what a test cannot judge: how it looks and how fast it
draws.
