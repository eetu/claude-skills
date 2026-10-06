---
name: wind-and-springs
description: How things move in a small pixel world, without state. `@anarkisti/korpi/motion` implements the air (`airOf`: a mean by season, gusts crossing from upwind, turbulence, `drift` for what rides it, `thermals` and `lee` passed in), damped springs read by convolution (`springOf`, `historyOf`, `feltBy`) and closed-form falls (`ballistic`, `fallTime`); `@anarkisti/korpi/plants` builds on it (`rigOf`/`poseOf` for trees, `rustleOf` for soft plants). This skill is why each is shaped so and how to tune it — the front, the integral, the kernel's window, width cubed, the clamps, rods and waves, a tap as a push into the wind, tumbling, landing and toppling. Use when anything in the scene should sway, flutter, bend, drift, fall or topple; when motion must survive scrubbing time backwards or a reload; or when tree tops look rubbery or a painting tears in the wind.
user-invocable: true
---

> **Priors, not rails.** The constants are korpi's tuning, at 40 px to the
> metre and a few seconds per gust; keep the structure (wind as a pure
> function, motion as a convolution of its history, poses as offsets) and the
> reasons each clamp and exponent is there.

# wind-and-springs

One model moves everything: the wind is a function of `(t, seed, x)`, and
anything that moves answers the wind's **recent history** through a damped
spring kernel. Nothing integrates velocity from frame to frame, so the world
scrubs backwards, survives a reload, and tests without a frame loop
(`game-maker:world-clock`). The output is offsets from rest, which
`game-maker:posed-pixels` applies to pixels painted once.

| korpi                   | what                                                                  |
| ----------------------- | --------------------------------------------------------------------- |
| `motion`: `airOf(spec)` | an `Air`: `dir`, `wind(t, x)`, `drift(from, to, x)`, `at(t, p)` (m/s) |
| `seasonalWind(cal)`     | the mean by season, for `AirSpec.mean`                                |
| `thermals`, `lee`       | lift and shelter terms passed into `airOf`                            |
| `springOf(hz, zeta)`    | a kernel (memoised and shared: read it, never write it)               |
| `historyOf`, `feltBy`   | `LAGS` samples of a push, newest first; a kernel's answer to them     |
| `ballistic`, `fallTime` | a point thrown or dropped, at `G_M` 9.8 m/s²                          |
| `plants`: `poseOf`      | a tree's moves (rig from `rigOf`), m, y up                            |
| `plants`: `rustleOf`    | a soft plant's moves, per kind from `GIVE`                            |

## The wind field

Strength is signed and unitless, about 0..2 (1 a stiff breeze, `WIND_M_S` 4 m/s);
the sign is the direction along x. Each mover scales it by how readily it
follows.

- **Mean by season**, eased into the next over the last 30% of each (calm
  summers, autumn gales).
- **Gusts**, at most one per 6 s slot. Whether a slot has one and how strong it
  is both scale with the mean: windy weather is gusty weather. Up quickly, down
  slowly.
- **Turbulence**: three incommensurate sines, scaled by the mean.
- **A front.** The strength is read at `t − upwind / front`, so a gust crosses
  from the upwind side of `span` (2 m/s: four seconds across 320 px at 40 px/m)
  and the trees take it one after another. `windDir(seed)` blows toward +x 70%
  of the time.

Trap: one global wind number moves every plant in lockstep, and the scene reads
as a screen shake. Passing `x` is what makes it weather.

## Drift: what rides the wind

A particle's sideways travel is the wind's **integral** over its time aloft
(`air.drift`, Simpson's rule over six steps), not the wind now times its age.
With `wind(now) * age`, a gust jumps every airborne flake at once, further the
longer it had been falling. A leaf follows at about half a metre a second per
unit of wind, a flake at less.

## Answering history, without state

A spring stepped per frame needs state and a `dt`, and breaks under a time
scrub. The same answer is a convolution: sample the last 4 s of push
(`LAGS` 16 samples, `LAG_S` 0.25 s apart) and weight it by the spring's impulse
response, `e^(−ζωt)·sin(ω√(1−ζ²)·t)`.

- **Normalised to 1**, so a steady wind gives a lean equal to the push, held
  still. Test it: the pose at two moments in a steady wind is identical.
- **A gust overshoots and settles**: the kernel rings (`sin`) and decays (`exp`).
- **The 4 s window** is long enough for the slowest spring used (about
  0.35 Hz, ζ 0.3) to ring down under a tenth. A slower spring needs more lags.
- Sample the history once per plant; a kernel's answer is a 16-term dot product.

Trap: **rubbery tops.** If the tops bounce faster than the gusts come, the
kernel is too quick or under-damped. Give every piece its own pace and damp the
twigs harder: wood `0.3 + 0.3/w` Hz (w in px at 40 px/m, plus up to 0.15 by
hash) at ζ 0.3, twigs (`w <= 1` px) at ζ 0.45.

## Rigs: trees

A tree is forward kinematics over the pieces its plan already has
(`game-maker:procedural-plants`). `rigOf(plan)` builds it once per plan:

- Each piece hangs off **the earlier piece nearest its base**, `t` of the way
  along it, or off the root; a plan that knows its `parents` says so. A new
  species needs no rig code.
- Clumps, fruit and anything that perches (an owl) hang off the nearest piece
  and ride its displacement interpolated at `t`.

Per frame, root outwards, each piece turns about its base by
`flex·(PUSH·felt·up + FLAP·(felt − settled)) / w³`, clamped, and turns add up
from the root:

- **`up`.** An upright twig is pushed over. A level branch barely leans, but it
  still **flaps** as the wind changes (`felt − settled`).
- **Width cubed.** Bending stiffness grows steeply with thickness, so the trunk
  hardly moves, limbs more and twigs most. That gradient is what makes it read
  as a tree.
- **Constants:** `PUSH` 0.06 and `FLAP` 0.05 rad per unit of wind; `OWN_MAX`
  0.3 and `ALL_MAX` 0.7 rad clamp each piece and its chain, or a gale folds a
  twig back on itself and a six-deep chain spins at the tip.
- **`FLEX` by species**: birch whips at 1.4, oak stays stiff at 0.7. Times
  **drag**: a bare broadleaf crown catches `0.45 + 0.55·leaves` of the wind.
- **Flutter.** Clumps jitter on top of the rig with hashed phases, only once
  `|wind|` passes 0.3: leaves keep still in a light breeze.

## Rods and waves: soft plants

Shrubs, climbers, flowers and grass have no skeleton. `rustleOf` bends each
stem as one whippy rod from its base:

- **`s^1.5`** along the stem keeps the base planted and the curve smooth
  without joints. The **nod** dips a swinging tip, so it travels an arc rather
  than sliding.
- **Per kind** (`GIVE`): pace, damping, `give`, `nod`, wave, ripple, how far
  leaves silver. A climber has `give` near 0: it clings to the wall, so its
  leaves move and its stems hardly do. Each stem's pace is jittered ±20% so
  neighbours drift out of step.
- **Shelter**: down among the soft plants, the wind is 0.6 of itself.
- **A wave runs downwind** at 0.75 m/s, driven by `max(0, |wind| − 0.15)`.
  Grass bows to it and leaves ripple on it, so soft plants keep moving in a
  steady wind where a tree holds its lean.
- **Leaves turn over** on the wave's crest, the turned share ramping from
  `|wind|` 0.45 to 1.1; evergreens never turn. Bare stems catch
  `0.4 + 0.6·leaves` of the wind.

## A tap is a push into the wind

Interaction stays stateless: a tap on the fruit tree adds a term to the wind
the tree reads, `3·sin²(π·d/0.6)` for 0.6 s after the recorded moment of the
tap. Because the push enters the history, every piece answers it with its own
wobble and it rings down by itself. korpi's stand does this for a knock on the
apple tree (`stand.poseAt(life, t, wind, knocks)`).

## Reduced motion

Scale the wind once, in the function handed to the pose functions
(`calm = prefersReducedMotion ? 0.3 : 1`). Everything downstream stirs instead
of tossing.

## Falling, in closed form

Position is a function of the time since release. Store no velocities.

- **Free fall** at real gravity, one `G` for everything (`G_M` 9.8 m/s²,
  `gravityPx(scale)` 392 px/s² at 40 px/m), so a branch and a block come down
  alike. `ballistic(from, v, t)`; landing after `fallTime(height, up)`.
- **Tumble in quarter turns**: `k = (k0 + ⌊7·t⌋) % 4`, which pixel art takes
  without resampling (`game-maker:posed-pixels`).
- **Landing**: a 2 px sine hop over 0.3 s and a slide of 0.3·`vx` sell the
  impact.
- **Fruit**: from where it hangs, sway included, to a hashed spot on the
  ground: `x` lerps by `u` and `y` by `u²` over 0.6 s (`DROP_S`).
- **Toppling**: `angle = side·(π/2)·u²` over 2.4 s (`FALL_S`), slow and then
  all at once. The wind keeps swaying it until it lands, then it bounces back
  0.06 rad over 0.4 s. The pivot and the turning are `game-maker:posed-pixels`.
- **Sound**: release and landing are cues read from a `(from, to]` window,
  never fed back into motion (`game-maker:world-clock`).

## Tests worth having

- The wind is deterministic per seed, signed the scene's way, and reaches the
  downwind side `span / front` s later.
- Drift follows the wind's sign, grows with time aloft, and is 0 when
  `to <= from`.
- A rig holds still without wind and keeps its roots fixed; twigs move more than
  the trunk; a steady wind gives a lean that holds; a gust bends further at its
  height than before it; a harder wind moves more.
- Rods bend from the base with the tip furthest; they ripple on in a steady
  wind; leaves turn over only above the threshold, and evergreens never.
