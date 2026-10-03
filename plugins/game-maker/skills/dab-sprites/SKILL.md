---
name: dab-sprites
description: Hand-drawn pixel art for a game through dab (eetu/dab), the house pixel editor — the character-grid sprite format (rows of characters plus a palette, `.` transparent, `#rrggbbaa` for see-through), editing a game's sprite folder in place, writing a first draft of a sprite as text, palette variants and colour cycles for recolouring, named animations tied to the game's own clock, parts for subjects with independent states, and the ~60-line reader a game owns instead of a library. Use when a game needs a creature, prop, sign or anything with a fixed silhouette drawn by hand; when adding frames, an animation, a variant or a palette entry to an existing sprite; when writing or extending the reader that draws sprites on a canvas; or when choosing between a dab sprite and a procedural painting.
user-invocable: true
---

> **Priors, not rails.** dab is the core tool for drawn art; the format is the
> contract. Everything below is how a game consumes it. When dab grows a feature
> (an MCP server is planned), prefer the tool over hand-editing JSON.

# dab-sprites

A dab sprite is text: rows of characters plus the palette they mean. Art in that
shape **diffs as art** — a changed antler is a changed line in review — and needs
no decoder to draw. The editor runs locally (`just dev` in `../dab`) or at
<https://eetu.github.io/dab/>; it is client-side, so files never leave the
machine. `?` in the editor opens its guide.

```json
{
  "name": "deer",
  "w": 27,
  "h": 25,
  "palette": { "B": "#8a5a34", "K": "#2a1a10", "a": "#8a7458", "T": "#efe6d2" },
  "animations": { "walk": [0, 1, 2, 3, 4, 5, 6, 7], "graze": [8, 8, 8, 9] },
  "frames": [[".................T..T......", "..."]]
}
```

## Drawn or grown

Pick per subject, not per game:

- **dab** for anything with an identity and a fixed silhouette: animals,
  people, props, signs, fixtures, a car. Each instance looks the same, and a
  human should be able to fix it with a pencil.
- **Procedural** (`game-maker:procedural-plants`, `game-maker:pixel-brushes`)
  for what should differ per seed or grow over time: trees, shrubs, moss,
  rubble, terrain.

The two meet on one canvas at one pixel scale, so a sprite pixel and a brush
pixel are the same size unless a subject is scaled on purpose (below).

## Where the art lives

The game repo holds the sprite JSON in a `sprites/` directory and only **reads**
it; the art is edited in dab. Open that folder in dab (Chrome or Edge: Save
writes back to the file in place through the File System Access API; other
browsers download). The folder handle survives a dev reload; the permission
needs a click after a cold start.

The game's CLAUDE.md should say so ("sprites are dab files: edit them there, the
game only reads them"), so nobody grows a second editor inside the game.

## Writing a draft as text

An agent can author or extend a sprite directly — the format is the whole
interface. Draft the frames as text, then judge the art on screen. dab's
validator rejects a file that breaks any of these, so hold them while typing:

- every frame has exactly `h` rows, every row exactly `w` characters;
- every character in a row is `.` or a palette key; keys are one character;
- `.` is the only transparent; it can't carry a colour;
- colours are `#rrggbb`, or `#rrggbbaa` for glass, a shadow, a windscreen;
- a variant may only recolour characters the palette has;
- an animation names frames that exist.

Add a palette key rather than reusing a near colour: a new key (`a`, `T` for an
antler's shade and tips) keeps the part recolourable later. Then open the file
in dab to check it validates and to see it at game size: the loupe is a size
window, not a magnifier, and shows where a one-pixel highlight vanishes.

**Trap: formatters.** Sprite JSON is written one frame row per line. A
formatter that packs short arrays onto one line turns small sprites back into a
wall of quoted strings. Keep Prettier away from the sprite folder (add it to
`.prettierignore`); a wide sprite survives only because its rows overflow the
print width.

## The reader the game owns

There is no library: the colour rule is one line, so each game keeps its own
sprite reader. This is the whole of it:

```ts
const cellColour = (s: Sprite, ch: string, variant?: string) =>
  ch === "."
    ? null
    : (variant && s.variants?.[variant]?.[ch]) || s.palette[ch] || null;

/** One frame at 1 px per cell, cached per frame/variant/flip. */
export const bake = (s: Sprite, frame = 0, variant?: string, flip?: Flip) => {
  const key = `${s.name}:${frame}:${variant ?? ""}:${flip ?? ""}`;
  // … fillRect each cell of flipRows(s.frames[frame], flip) into a w×h canvas
};

export const drawSprite = (ctx, s, x, y, opts = {}) =>
  ctx.drawImage(
    bake(s, opts.frame, opts.variant, opts.flip),
    Math.round(x),
    Math.round(y),
  );
```

- **Bake once, blit after.** A frame becomes a tiny canvas the first time it is
  drawn; every later draw is one `drawImage`. Round the position, or the blit
  lands between pixels.
- **Flip is free**: reverse the rows for `v`, reverse each row for `h`. A
  creature faces both ways from one drawing.
- Import each sprite JSON where it is drawn (`import deer from "./sprites/deer.json"`);
  a tool that shows them all (a workbench) can `import.meta.glob` the folder.
- If a sprite uses **parts**, add the draw loop from dab's README: a node's
  `behind` parts, then its grid, then the rest, each at its parent's offset plus
  its own, each showing the frame the game's state says.

## Animations and the game's clock

An animation is a named list of frame indices. A hold is a repeat
(`graze: [8, 8, 8, 9]`), reversing is reading backwards, and there are no
durations: the clock is the game's. Step through it with a looping index that
wraps both ways, so a negative step (a visitor still off the left edge) works:

```ts
export const frameOf = (s: Sprite, animation: string, step: number) => {
  const run = s.animations?.[animation];
  if (!run?.length) return 0;
  return run[((Math.floor(step) % run.length) + run.length) % run.length];
};
```

Drive the step by what the animation depicts: a walk by **distance travelled**
(`along / STRIDE * frames`) so the feet don't slide at any speed, idle motions
and wings by time (`since * 9 + i`, the phase offset per individual so a flock
doesn't flap in step). With a world that is a function of time
(`game-maker:world-clock`) the step is computed, never accumulated.

## Recolouring without redrawing

- **Palette variants** override a few keys and inherit the rest: one drawing,
  many looks. An x-ray view, a damaged state or a team colour is a variant (or
  a frame) of the subject's sprite, never a separate file.
- **Colour cycles** are variants too, one per phase: `water 1` … `water n`,
  each naming only the characters it turns. The game draws `water k` on its own
  clock, counting phases up to the first missing number. Lights chase and water
  flows without a frame more.

## Parts: subjects with independent states

When a subject's pieces change state independently (doors, wheels, lamps, a
trunk lid), whole-subject frames multiply: three door states by three lamp
states by two trunk by three damage is 54 frames. As parts it is a few short
strips. A part is a placement (`x`, `y`, `behind`, `flip`) plus either its own
pixels (inline: intrinsic to this subject) or `use` naming another sprite in the
folder (reuse: one wheel for every car). Which frame a part shows, and whether
it is drawn at all, is runtime state and never in the file: a door that fell off
is the game not drawing it.

## Turning and size

- **Authored turns**: dab's Spin (in the picture plane), Swing and Tilt (hinges,
  as foreshortening) write the in-between frames for you, each sampled from the
  original. Quarter turns are exact; other angles must invent colours, and the
  editor says how many palette entries that costs before you pay.
- **Runtime turns** of procedural paintings belong to `game-maker:posed-pixels`;
  don't rotate a sprite canvas with `ctx.rotate`, it smears the pixels.
- **One sprite pixel is one scene pixel.** Never scale a sprite up to make it
  bigger: a 2× animal has pixels twice the scene's and breaks the detail level
  everything else holds. A subject that should be bigger is drawn bigger in dab
  at the same pixel size; one meant to read smaller or further away gets its own
  smaller drawing (`game-maker:depth-and-lod`). Only the whole scene scales to
  the display, by a whole number with `imageSmoothingEnabled = false`. Flipping
  (`flip: "h"`) is fine.

## The format's authority

`eetu/dab`: its `README.md` and `CLAUDE.md` define the format, and its core
format and validate modules hold the rules.
