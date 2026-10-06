---
name: sky-and-weather
description: The clocks above a small pixel world, what falls out of them, and the light they give. `@anarkisti/korpi` implements it — `clock` (a `Calendar`, `seasonAt`, `seasonal`), `sky` (`dayAt`: the sun on its seasonal arc, a moon through its phases; `skyAt` colours; `weatherAt` spells; `snowCover`; `snowAt`/`rainAt` in a world volume; `skyLight`), `sky/paint` (sky bands, sun, moon, snowfall, rain, snow caps and ground), `light` (`Light`: the open sky, cover, point lights) and `light/paint` (`resolve`, one light pass a frame). This skill is how to use them and why they are shaped so — overlapping ramps on a season, days of a minute, places in sky terms, spells with clear frost between, particles at their own depth, snow at its ledge's depth, a room lit under cover while the world through its openings keeps the open sky's light, glow for what lights itself, and a landscape outside that heals. Use when adding a day/night cycle, seasons, a sun or moon, rain or snow, falling leaves, snow cover, night and lamp light, or a landscape that changes over the years.
user-invocable: true
---

> **Priors, not rails.** The numbers (a minute a day, an eight-day month, a
> Finnish year's day shapes) suit a northern wood watched for an hour or more.
> Keep the structure: every clock is a function of time, quantities ease
> between season middles, weather comes in spells, and light is one pass after
> all painting.

# sky-and-weather

Two clocks run the sky: the **season** (`k`, `p`) and the **day**. Weather is a
spell within a season. Everything else here (sky colour, sun, moon, what falls,
what lies on the ground, how dark the room is) is a pure function of `t` and
the seed (`game-maker:world-clock`).

## The seasons clock

A `Calendar` is a value (`from`, `season`, `day`, `month`, `dawn`, seconds);
`CALENDAR` is a ten-minute year of 60 s days and 480 s months. Before `from`
it is the start of summer, so a scene can grow in first. `seasonAt(cal, t)`
gives `{ k, p }`, 0 summer … 3 spring.

Derived quantities are **overlapping ramps on `p`**, not switches. Snow lies
from `ramp(p, 0.1, 0.7)` in winter and is gone by `0.4` into spring
(`snowCover`) while leaves come late (`foliage`), so for a while the trees are
bare and the ground already green. Litter piles through autumn, stays all winter
and is gone by mid-spring (`litter`). `lookAt(cal, t)` bundles them into the
`Look` painters read (`game-maker:procedural-plants`). A value kept per season
eases between the seasons' middles (`seasonal(cal, values, t)`), so nothing
jumps at a season boundary.

## Days

A 60 s day lets you sit through a sunset and still see many days in a
session; a month of eight days is long enough that the moon looks still within
a night and short enough to see all its phases.

`dayAt(cal, t, shapes)` gives the day's `progress` on the **sky palette's own
0..1 scale** (0.2 dawn, 0.45 noon, 0.7 dusk, then night), so days take their
colours from the sky keyframes (`skyAt(progress, grey)` → `top`, `low`), plus
the sun and the moon. A season's `DayShape`, at its middle: how much of the day
the sun is up, how high it gets at noon, how dark the night gets, how high the
moon rides. `DAY_SHAPES` is a Finnish year: summer 0.78 of the day in sun, its
night 0.76, which never gets past dusk; winter 0.25 of the day, noon at 0.18,
barely over the ridge. Dusk and dawn take `TWILIGHT` 0.07 of a day.
`cal.dawn` puts the first dawn where the story wants it (as an opening storm
clears). `daylight(progress)` is 0 at night, 1 at midday.

## Sun and moon

- **A place in sky terms, not scene pixels** (`Place`: `across` 0..1, `up`
  0..1 of as high as anything goes). The landscape maps the place itself
  (`skyPoint`); a clock that imported the landscape's horizon would form a
  cycle and need a canvas to test.
- **Painted far behind everything** (`SKY_DEPTH`, 10 km), so the ridge covers
  them as they set with no clipping code; only on clear skies.
- **The phase is drawn per pixel** (`paintMoon`): each pixel of the disc against
  the terminator, `cos(2π·phase)` scaled by the disc's half-width at that row;
  waxing lit from the right, waning from the left, the dark limb faint, three
  seas on the lit face.

**Test the clock by sampling a day**: summer has over 2.5× winter's sun-up
samples, the sun tops 0.9 in summer and stays under 0.25 in winter, the moon is
never up with the sun, and over a month the phases reach new, full and back.

## Weather spells

`weatherAt(cal, t, spells)` gives `{ kind, rain, snow }` from **spells as shares
of each season**, clear sky between them (`SPELLS`):

| season | spells              | reads as                                                    |
| ------ | ------------------- | ----------------------------------------------------------- |
| summer | 0.4–0.55            | a rain                                                      |
| autumn | 0.15–0.4, 0.55–0.75 | a wet autumn with a dry spell in it                         |
| winter | 0.05–0.38, 0.55–0.8 | two snowfalls, clear frost (and the moon) between and after |
| spring | 0.3–0.45            | a shower                                                    |

**Trap: weather that never stops hides the sky.** Overcast drains the sky colour
and the sun and moon show only on clear skies, so snowing all winter means a
winter with no sun, no moon and no stars. Leave clear frost between spells.

Spells ease in and out over 0.04 of a season, so flakes thin out instead of
stopping at once. A window that shows its own weather asks the same spells, and
its rain leans with the world's wind. Stars show only on a clear night,
twinkling on a hashed beat.

## What falls

`snowAt(fall, air, t, amount)` and `rainAt` give particles in a world volume
(`fall.volume`, a `Box3` in metres): each with a hashed column, speed and phase,
carried along x by `air.drift` over its fall so far (`game-maker:wind-and-springs`),
read at any moment, either way. One flake in four is near: bigger, quicker,
blown 1.3× as far. `paintSnowfall` and `paintRainfall` project each **at its
own depth**, so a flake passes in front of one thing and behind another;
they are translucent, so paint them after everything solid.

Leaves fall only from the crowns of **living** broadleaves, from a third of the
way into autumn into early winter, each swaying on a sine on top of its drift.

## On the ground and the ledges

Cover is a **threshold field** (`game-maker:pixel-brushes`): `paintSnowGround`
whitens each cell at its own point in the cover, and melting runs it backwards.
`paintSnowCaps` caps a ledge's front edge a pixel high where `hash < cover`,
two where deep (a second hash `< cover − 0.5`), **a hair nearer than the
ledge**: the sill's snow is behind the trees and the desk's in front of them,
with no ordering code.

## Light: one pass, after all painting

Painters paint colours as they are by day. A frame is lit once, by
`resolve(scene, view, light, t)` from `@anarkisti/korpi/light/paint`, every
painted pixel in the light at the world point drawn there:

```ts
const open = skyLight({ cal }); // the open sky's ambient: toward NIGHT as the day goes
const light: Light = {
  open,
  sheltered: (t) => further(open(t), NIGHT, roomDark(t)), // under the roof
  shelter: (p) => (p.z > -0.0005 ? 1 : 0), // in front of the back wall: covered
  points: (t) => lamps(t), // { p, colour: rgb3(c), level, radius } in metres
};
```

- **Ambients** are `{ gain, lift }` per channel: `toward(colour, a)` (dusk,
  night), `further(a, colour, k)` (cover under a sky), `between(a, b, u)`.
  `skyLight` darkens by the day and a little under a spell.
- **The world through an opening keeps its own light.** Shelter is a function
  of the world point, so the landscape beyond the wall gets the open sky's
  light and the room the covered one's, with no masks. A full-scene overlay
  instead dims the moon, the stars and the dusk sky a second time, which reads
  as fog.
- **What lights itself is painted through `lit(pen)`** (glow 255: the light
  pass leaves it as painted). What lights what is near it is also a point
  light, its reach a sphere in metres: a firefly's light 1.2 m out from the
  wall with a 0.18 m radius never reaches the wall.
- **A flash goes after the light pass**: `wash(scene, colour, a)` for lightning
  or a blast.
- **Nothing lit is cached.** Shade layers, masks and night tints baked into a
  painting stay when the light changes.

## A world outside that heals

The view through the openings can be one landscape on a timeline, for example
`heal = smooth((t - 60) / 1700)` after a disaster:

- Ash greens to the season's ground colour, and snow covers either.
- Ruins shrink to a quarter of their height and moss over from the top.
- A forest comes up tree by tree, each with its own `from` threshold on `heal`.
- The ridge greys to forest blue.

Bake the land on a key that quantises heal (×40) and season `p` (×12); paint
the sky, sun, moon and smoke over it every frame (`paintSky`, flat bands, one
every 6 px). Put it all at a depth beyond the wall (nahkarele: 50 m) so every
opening, a window or a gap in a crumbling wall, shows its part of one world and
the views line up.
