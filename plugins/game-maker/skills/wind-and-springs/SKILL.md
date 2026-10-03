---
name: wind-and-springs
description: How things move in a small pixel-art canvas world, without state — a wind field that is a function of time and x (a mean by season, gusts that cross the scene from the upwind side), its integral for what rides it (leaves, flakes, rain), damped springs that answer the wind's last few seconds by convolution, forward-kinematic rigs for trees (each piece turning about its base against its width cubed), whippy rods and travelling waves for soft plants, a tap as a push into the wind, and falling, tumbling and toppling in closed form. Use when anything in the scene should sway, flutter, bend, drift, fall or topple; when motion must survive scrubbing time backwards or a reload; or when tree tops look rubbery or a sprite tears in the wind.
user-invocable: true
---

> **Priors, not rails.** The constants are examples for a 320×180 scene at a
> few seconds per gust; the parts worth keeping are the structure — wind as a
> pure function, motion as a convolution of its history, poses as offsets —
> and the reasons each clamp and exponent is there.

# wind-and-springs

One model moves everything: the wind is a function of `(time, seed, x)`, and
anything that moves answers the wind's **recent history** through a damped
spring kernel. Nothing integrates velocity from frame to frame, so the world
scrubs backwards, survives a reload, and tests without a frame loop
(`game-maker:world-clock`). The output is offsets from rest, px, which
`game-maker:posed-pixels` applies to pixels painted once.

## The wind field

Signed and unitless, about 0..2 (1 is a stiff breeze); the sign is the
direction. Each consumer scales it to px.

- **Mean by season**, eased into the next season over the last 30% of each,
  plus a storm that blows itself out.
- **Gusts**, at most one per 6 s slot. Whether a slot has one, and how strong it
  is, both scale with the mean: windy weather is gusty weather. Shape: up
  quickly, down slowly.
- **Turbulence**: three incommensurate sines, scaled by the mean.
- **A front.** Evaluate the strength at `since - upwind / FRONT_PX_S`, so a gust
  crosses the scene from the upwind side (80 px/s: four seconds across 320 px)
  and the trees take it one after another.

```ts
export const windAt = (since: number, seed: number, x: number) => {
  const dir = windDir(seed); // the scene's prevailing side: 70% one way
  const upwind = dir > 0 ? x : SCENE_W - x;
  return dir * strength(Math.max(0, since - upwind / FRONT_PX_S), seed);
};
```

Trap: one global wind number moves every plant in lockstep, and the whole scene
reads as a screen shake. Passing `x` is what makes it weather.

## Drift: what rides the wind

A particle's sideways travel is the wind's **integral** over its time aloft,
not the wind now times its age. `driftOf(from, to, seed, x)` integrates by
Simpson's rule over six steps. With `wind(now) * age`, a gust would jump every
airborne flake at once, and further the longer it had been falling.

```ts
const blown = driftOf(since - age, since, seed, x0) * LEAF_PX_S; // ~20 px/s; flakes ~16
```

## Answering history, without state

A spring stepped per frame needs state and a `dt`, and it breaks under a time
scrub. The same answer is a convolution: sample the last 4 s of wind and weight
it by the spring's impulse response.

```ts
export const LAGS = 16; // samples …
export const LAG_S = 0.25; // … this far apart: a 4 s window

export const springOf = (hz: number, zeta: number) => {
  const omega = 2 * Math.PI * hz;
  const ring = omega * Math.sqrt(1 - zeta * zeta);
  const out = new Float64Array(LAGS);
  let sum = 0;
  for (let k = 0; k < LAGS; k++) {
    const ago = (k + 0.5) * LAG_S;
    out[k] = Math.exp(-zeta * omega * ago) * Math.sin(ring * ago);
    sum += out[k];
  }
  return out.map((v) => v / sum); // sums to 1: a steady push is a steady lean
};

const history = historyOf(wind, root.x); // once per plant: LAGS samples, newest first
const felt = feltBy(spring, history); // per piece: a 16-term dot product
```

- **Normalise to 1**, so a steady wind gives a lean equal to the push, held
  still. Test it: the pose at two moments in a steady wind is identical.
- **A gust overshoots and settles**, because the kernel rings (the `sin` term)
  and decays (the `exp`).
- **The 4 s window** is long enough for the slowest spring used (about
  0.35 Hz, ζ 0.3) to ring down to under a tenth. A slower spring needs more
  lags.
- Build each kernel once per piece (cache it in a `WeakMap` keyed by the plan).
  Sample the history once per plant.

Trap: **rubbery tops.** If the tops bounce side to side faster than the gusts
come, the kernel is too quick or under-damped. Give every piece its own pace and
damp the twigs harder: wood `0.3 + 0.3/w` Hz (± jitter) at ζ 0.3, twigs
(`w <= 1`) at ζ 0.45.

## Rigs: trees

A tree is forward kinematics over the pieces its plan already has
(`game-maker:procedural-plants`). Build the rig once per plan:

- Each piece hangs off **the earlier piece nearest its base**, `t` of the way
  along it. If the root is nearer, it hangs off the root. Generators lay parents
  before children, so a parent is always earlier. A new species needs no rig
  code.
- Clumps, fruit and anything that perches (a bird) hang off the nearest piece.
  They ride its displacement interpolated at `t`.

Per frame, root outwards:

```ts
const up = -vy / len; // how upright this piece stands, 1..-1
const felt = feltBy(rig.answer[k], history);
const settled = mean(history);
const own = clamp(
  (flex * (PUSH * felt * up + FLAP * (felt - settled))) / w ** 3,
  OWN_MAX,
);
const turn = clamp(parentTurn + own, ALL_MAX); // turns add up from the root
// rotate the piece's rest vector by `turn` about its base, which rides the parent
```

- **`up`.** An upright twig is pushed over. A level branch barely leans, but it
  still **flaps** as the wind changes (`felt - settled`).
- **Width cubed.** Bending stiffness grows steeply with thickness, so the trunk
  hardly moves, limbs move more and twigs most. That gradient is what makes it
  read as a tree.
- **Constants:** `PUSH` 0.06 and `FLAP` 0.05 rad per unit of wind.
  `OWN_MAX` 0.3 and `ALL_MAX` 0.7 rad are clamps: without them a gale folds a
  twig back on itself, and a six-deep chain spins at the tip.
- **`FLEX` by species**: birch whips at 1.4, oak stays stiff at 0.7. Times
  **drag**: a bare broadleaf crown catches `0.45 + 0.55·leaves` of the wind.
- **Flutter.** Clumps jitter on top of the rig with hashed per-clump phases, but
  only once `|wind|` passes 0.3: leaves keep still in a light breeze.

Trap: moving rows of a sprite sideways reads as **tearing**, and skewing a
whole sprite moves trunk and leaves as one rigid group. Pose the parts and let
`game-maker:posed-pixels` re-place their pixels.

## Rods and waves: soft plants

Shrubs, climbers and grass have no skeleton to lean. Each stem is one whippy
rod, bent from its base:

```ts
const d = give * stemLength * growth * leafy * feltBy(stemSpring, history); // tip, px
const bent = (s: number) => ({ x: d * s ** 1.5, y: nod * Math.abs(d) * s * s }); // s: 0 base, 1 tip
```

- **`s^1.5`** keeps the base planted and the curve smooth without per-piece
  joints. The **nod** dips a swinging tip, so it travels an arc rather than
  sliding.
- **Per kind**: pace, damping, `give`, `nod`, wave strength, ripple, how far
  leaves silver. A climber has `give` near 0: it clings to the wall, so its
  leaves move and its stems hardly do. Jitter each stem's pace ±20% so
  neighbours drift out of step.
- **Shelter**: down among the soft plants, the wind is 0.6 of itself.
- **A wave runs downwind** across them (phase `2π(0.7·t − x/λ)`, 30 px/s), driven
  by `stir = max(0, |wind| − 0.15)`. Grass bows to it and leaves ripple on it, so
  soft plants keep moving in a steady wind where a tree holds its lean.
- **Leaves turn over** to their paler undersides on the wave's crest: the
  turned share ramps from `|wind|` 0.45 to 1.1, and evergreens never turn.
  `game-maker:posed-pixels` turns a clump leaf by leaf using a per-pixel rank.
  Trap: recolouring a whole clump at once blinks.
- **Bare stems** catch `0.4 + 0.6·leaves` of the wind.

## A tap is a push into the wind

Interaction stays stateless: a tap on a fruit tree adds a term to the wind
function itself, for 0.6 s after the recorded moment of the tap
(`game-maker:world-clock`):

```ts
const shake = (time: number) => {
  const d = time - tappedAt;
  return d >= 0 && d < 0.6 ? 3 * Math.sin((Math.PI * d) / 0.6) ** 2 : 0;
};
const wind = (x: number, ago: number) =>
  (windAt(since - ago, seed, x) + shake(since - ago)) * calm;
```

Because the push enters the history, every piece answers it with its own
wobble, and it rings down by itself.

## Reduced motion

Scale the wind once, in the closure handed to the pose functions
(`calm = prefersReducedMotion ? 0.3 : 1`). Everything downstream stirs instead
of tossing, and nothing else needs to know.

## Falling, in closed form

Position is a function of the time since release. Store no velocities.

- **Free fall.** `x = x0 + vx·t`, `y = y0 + ½·G·t²`, landing after
  `√(2·(land − bottom)/G)`. `land` is the floor, or the base of furniture the
  body falls behind (`game-maker:depth-and-lod`). For a 320×180 scene,
  `G` ≈ 240 px/s² makes a 90 px drop take 0.87 s, which reads as heavy without
  being slow.
- **Tumble in quarter turns**: `k = (k0 + ⌊7·t⌋) % 4`. Pixel art rotates by 90°
  without resampling (`game-maker:posed-pixels`).
- **Landing**: a 2 px sine hop over 0.3 s and a slide of 0.3·`vx` sell the
  impact.
- **Fruit**: from where it hangs, including the current sway offset, to a
  hashed spot on the ground. `x` lerps by `u` and `y` by `u²` over 0.6 s.
- **Toppling**: `angle = side·(π/2)·u²` over 2.4 s, slow and then all at once.
  The wind keeps swaying it until it lands, then it bounces back 0.06 rad over
  0.4 s. **Pivot at the trunk's edge on the falling side**: pivoting at the
  centre leaves half the fallen trunk below the ground line.
- **Sound**: release and landing are cues, read from a `(from, to]` window and
  never fed back into motion (`game-maker:world-clock`).

## Tests worth having

- The wind is deterministic per seed, signed the scene's way, and reaches the
  downwind side `SCENE_W / FRONT_PX_S` s later.
- Drift follows the wind's sign, grows with time aloft, and is 0 when
  `to <= from`.
- A rig holds still without wind and keeps its roots fixed; twigs move more than
  the trunk; a steady wind gives a lean that holds; a gust bends further at its
  height than before it; a harder wind moves more.
- Rods bend from the base with the tip furthest; they ripple on in a steady
  wind; leaves turn over only above the threshold, and evergreens never.
