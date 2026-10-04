---
name: sky-and-weather
description: The clocks above a small pixel-art world and what falls out of them — a seasons clock that drives foliage, snow cover and litter; days of a minute whose length, noon height and night darkness follow the season; the sun on its seasonal arc and a moon crossing the nights through its phases, drawn pixel by pixel; weather as spells inside a season; leaves and flakes that ride the wind's integral; snow that settles cell by cell on the ground and the ledges; night shading that darkens a room but not the world seen through its openings, with a glow pass for what lights itself; and a landscape outside that heals over the years. Use when adding a day/night cycle, seasons, a sun or moon, rain or snow, falling leaves, snow cover, night lighting, or a landscape that changes over the years to a canvas game.
user-invocable: true
---

> **Priors, not rails.** The numbers (a minute a day, an eight-day month, the
> season shapes) suit a northern wood watched for an hour or more. Keep the
> structure: every clock is a function of time, quantities ease between season
> middles, the weather comes in spells, and light passes come after the shade.

# sky-and-weather

Two clocks run the sky: the **season** (`k`, `p`) and the **day** (a phase
through 24 h). Weather is a spell within a season. Everything else here (sky
colour, sun, moon, what falls, what lies on the ground, how dark the room is) is
a pure function of `since` and `seed` (`game-maker:world-clock`).

## The seasons clock

```ts
const SEASONS_FROM = 320; // the scene has grown in; from here the year turns
const SEASON_S = 150; // a year is ten minutes
const seasonAt = (since: number) => {
  if (since < SEASONS_FROM) return { k: 0, p: 0 }; // summer until then
  const t = (since - SEASONS_FROM) / SEASON_S;
  return { k: Math.floor(t) % 4, p: t % 1 }; // 0 summer, 1 autumn, 2 winter, 3 spring
};
```

Derived quantities are **overlapping ramps on `p`**, not switches. Snow melts
early in spring (`1 - ramp(p, 0, 0.4)`) while leaves come late
(`ramp(p, 0.3, 0.9)`), so for a while the trees are bare and the ground already
green. Litter piles through autumn, stays all winter and is gone by mid-spring.
Bundle them into one `Look` per frame (`{ k, p, leaves, snow }`) that painters
read (`game-maker:procedural-plants`).

## Days

`DAY_S = 60` lets you sit through a sunset and still see many days in a session.
A month of `8 * DAY_S` is long enough that the moon looks still within a night
and short enough to see all its phases.

A season has a **shape**, given at its middle: how much of the day the sun is
up, how high it gets at noon, how dark the night gets, and how high the moon
rides.

```ts
const SEASONS = [
  { day: 0.78, noon: 1, night: 0.76, moon: 0.4 }, // summer: 19 h of sun, a bright dusk for night
  { day: 0.45, noon: 0.5, night: 0.86, moon: 0.7 },
  { day: 0.25, noon: 0.18, night: 0.93, moon: 1 }, // winter: 6 h, barely over the ridge
  { day: 0.56, noon: 0.62, night: 0.82, moon: 0.6 },
];
```

Ease with `smooth` from one season's middle to the next, so day length doesn't
jump at a season boundary. Offset the phase so the **first dawn breaks as an
opening storm clears**:

```ts
const dawn = 0.5 - SEASONS[0].day / 2 - TWILIGHT / 2;
const phase = ((((since - STORM_S) / DAY_S + dawn) % 1) + 1) % 1; // 0 midnight, 0.5 noon
```

Return the day's `progress` on the **sky palette's own 0..1 scale** (0.2 dawn,
0.45 noon, 0.7 dusk, then night), so the days get their colours from the existing
sky keyframes. A day maps the sun's time up into 0.2–0.7; a night goes from dusk
toward the season's `night` value and back before dawn, eased over
`TWILIGHT = 0.07` of a day. Summer's `night: 0.76` never gets past dusk.

## Sun and moon

Both move on one arc. `across` runs 0..1 left to right and `up` runs 0..1 of as
high as anything goes:

```ts
const arc = (u: number, high: number): Place => ({
  across: u,
  up: Math.sin(Math.PI * u) * high,
});
// sun:  u = (phase - rise) / shape.day,          high = shape.noon
// moon: u = sinceSet / (1 - shape.day),           high = shape.moon * 0.7
const month = ((((since - STORM_S) / MONTH_S) % 1) + 1) % 1; // phase: 0 new, 0.5 full
const lit = 0.5 - 0.5 * Math.cos(2 * Math.PI * month); // skip the moon when lit < 0.04
```

- **Return a place in sky terms, not scene pixels.** The landscape module
  imports the clock; if the clock imported the landscape's horizon back, they
  would form a cycle. The landscape maps the place itself, and the clock stays
  testable without a canvas.
- **Draw the sun and the moon before the land**, so the ridge takes them as they
  set, with no clipping code; only on clear skies, because cloud hides them.
- **The phase is drawn per pixel.** For each pixel of an r = 3 disc, compare its
  `x` with the terminator, `cos(2π·phase)` scaled by the disc's half-width at that
  row. A waxing moon is lit from the right, a waning one from the left; the dark
  limb is a faint night colour, and three darker seas sit on the lit face.

```ts
const turn = Math.cos(2 * Math.PI * phase);
const half = Math.sqrt(Math.max(0, 1 - (dy / r) ** 2));
const lit =
  phase < 0.5 ? dx / r > turn * half - 0.05 : dx / r < -turn * half + 0.05;
```

**Test the clock by sampling a day**: summer has over 2.5× the sun-up samples of
winter, the sun tops 0.9 in summer and stays under 0.25 in winter, the first sun
comes after `STORM_S`, the moon is never up with the sun, and over a month the
phases reach new, full and back.

## Weather spells

Weather is a table of **spells as shares of each season**, with clear sky
between them:

| season | spells              | reads as                                                    |
| ------ | ------------------- | ----------------------------------------------------------- |
| summer | 0.4–0.55            | a rain                                                      |
| autumn | 0.15–0.4, 0.55–0.75 | a wet autumn with a dry spell in it                         |
| winter | 0.05–0.38, 0.55–0.8 | two snowfalls, clear frost (and the moon) between and after |
| spring | 0.3–0.45            | a shower                                                    |

**Trap: weather that never stops hides the sky.** Overcast drains the sky colour
and the sun and moon are drawn only on clear skies, so snowing all winter means a
winter with no sun, no moon and no stars. Leave clear frost between spells.

`snowing(since)` eases in and out of each spell over 0.04 of a season, so the
flakes thin out instead of stopping at once. A window that shows its own weather
asks the same table, and its rain leans with the world's wind
(`lean = -wind * 0.45`). Stars show only on a clear night, twinkling on a hashed
beat.

## What falls

Every leaf and flake is closed-form: a hashed start, period and speed, and a
position computed from `since`, so the clock can scrub backwards. Sideways motion
is the **wind's integral since the particle set off**
(`game-maker:wind-and-springs` owns `driftOf`):

```ts
const down = (since * speed + hash(i, 53) * fall) % fall;
const blown = driftOf(since - down / speed, since, seed, x0) * FLAKE_PX_S;
```

At a wind of 1, a leaf moves 20 px/s and a flake 16 px/s in a 320×180 scene.

- **Snowfall:** 90 flakes. One in four is "near": 2×2 px, faster, and blown 1.3×
  as far, parallax for one comparison. Flakes wrap sideways across the scene, and
  `globalAlpha` follows `snowing`.
- **Leaves** fall only from the crowns of **living** broadleaf trees, from a third
  of the way into autumn into early winter, each swaying on a sine on top of its
  drift.

## On the ground and the ledges

Cover is a **threshold field** (`game-maker:pixel-brushes`): each 2 px floor cell
gets a hash `at` and is drawn while `at < cover`, so snow settles cell by cell
and the highest `at` thaws first. Bake the layer per quantised cover. Leaf litter
is the same pattern over a few hundred hashed leaves.

Ledges are data, `[x, y, w]`. A column caps when `hash(x, y) <= cover`, and gets a
second row when a second hash `< cover - 0.5`, so the drift deepens once the
ledge is half covered. **Snow belongs to its ledge's layer**: a window sill's
snow is drawn with the back wall, behind the trees; the caps on furniture in
front are drawn with the furniture. One late pass for all ledge snow puts the
sill's snow over the trees (`game-maker:depth-and-lod`).

## Night: shade the room, not the world

A landscape seen through a window or a gap keeps its own light: its night sky is
already as dark as it should be and its moon as bright. Shade the room with an
offscreen fill that has the openings cut out:

```ts
off.globalCompositeOperation = "copy";
off.fillStyle = colour;
off.fillRect(0, 0, W, H);
off.globalCompositeOperation = "destination-out";
off.drawImage(holesMask, 0, 0); // the gaps in the wall, as last drawn
if (glass) off.fillRect(glass.x, glass.y, glass.w, glass.h); // the window, while it hangs
off.globalCompositeOperation = "source-over";
ctx.globalAlpha = alpha;
ctx.drawImage(shade, 0, 0);
```

**Trap:** a full-scene overlay dims the moon, the stars and the dusk sky a second
time, which reads as fog.

Frame order, back to front:

1. The room, the wall, and the landscape through its openings.
2. The room shade (lamps and machines hold their own, so it stays light, around
   0.28 plus overcast), with the openings cut out.
3. Fixtures that light themselves (a lit clock face).
4. The trees, the furniture, the floor and the air, each band drawn into a layer
   of its own and shaded there, `(1 - daylight) * 0.32`: one full-scene fill would
   also dim what shows through the openings, and cutting the openings out would
   leave the trees in front of them unshaded.
5. A **redraw** of everything that lights itself (the clock, lit signs), then the
   glow pass (fireflies).

Draw what emits light after every shade, never under one: redrawing it is simpler
than exempting it.

## A world outside that heals

The view through the openings can be one landscape on a timeline, for example
`heal = smooth((since - 60) / 1700)` after a disaster:

- Ash greens to the season's ground colour, and snow covers either.
- Ruins shrink to a quarter of their height and moss over from the top.
- A forest comes up tree by tree, each with its own `from` threshold on `heal`.
- The ridge greys to forest blue; light is `mix(NIGHT, c, 0.15 + 0.85 * day)`.

Bake the land on a key that quantises heal (×40), season `p` (×12) and day (×8);
draw the sky, sun, moon and smoke over it every frame. The gaps show it via
`source-atop` over the hole mask, and the window replaces its own sky and scenery
with it while keeping its weather and cracks, so every view lines up on the same
world.
