---
name: dab-sprites
description: Hand-drawn pixel art for a game through dab (eetu/dab, `@anarkisti/dab`), the house pixel editor and its MCP server — the character-grid sprite format (rows of characters plus a palette, `.` transparent, `#rrggbbaa` for see-through), the MCP workflow (versioned writes, `batch` as one undo step, rows as the working representation), drawing a subject whole and lifting the pieces that move into parts, hidden pieces drawn whole with `behind`/`order_part`, `carry` for a hand edit across frames, palette variants and colour cycles, levels for other sizes, sprites from a generator script folded back after hand edits, and reading sprites in a game with `@anarkisti/dab/core` or `@anarkisti/korpi/sprites`. Use when a game needs a creature, prop, sign or anything with a fixed silhouette drawn by hand; when adding frames, parts, an animation, a variant or a size to an existing sprite; when drawing a game's sprites in its scene; or when choosing between a dab sprite and a procedural painting.
user-invocable: true
---

> **Priors, not rails.** dab is the core tool for drawn art; the format is the
> contract. Draw through dab's MCP tools or its editor rather than editing the
> JSON by hand: every write is validated and versioned.

# dab-sprites

A dab sprite is text: rows of characters plus the palette they mean. Art in that
shape **diffs as art** (a changed antler is a changed line in review) and needs
no decoder to draw. `@anarkisti/dab` (0.2 on npm) carries the MCP server, a Vite
plugin and `/core`; `FORMAT.md` in eetu/dab is the spec.

```json
{
  "name": "deer",
  "w": 54,
  "h": 50,
  "palette": { "B": "#94582f", "T": "#d8c8a8", "t": "#d8c8a8", "K": "#1c1410" },
  "variants": { "winter": { "B": "#76644f", "T": "#847262", "t": "#cfc4b2" } },
  "animations": { "walk": [0, 1, 2, 3, 4, 5, 6, 7], "graze": [8, 8, 8, 9] },
  "frames": [["…50 rows of 54 characters…"]]
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

The two meet in one raster at one pixel scale: a sprite pixel and a brush pixel
are the same size.

## Where the art lives

The game holds its sprite JSON in a folder and only **reads** it. With
`dab({ sprites: "src/lib/sprites" })` from `@anarkisti/dab/vite` in its Vite
config, the dev server serves the editor at `/__dab/` (Save writes in place in
Chrome or Edge) and MCP on port 3061 for whichever project is running
(`claude mcp add --transport http dab http://localhost:3061/mcp`, once). Without
a dev server: `npx @anarkisti/dab mcp --root <folder>` over stdio.

Say so in the game's CLAUDE.md ("sprites are dab files: edit them there"), so
nobody grows a second editor in the game. **Trap: formatters.** dab writes one
frame row per line; Prettier packs short arrays and turns small sprites into a
wall of quoted strings. Put the folder in `.prettierignore`.

## Drawing through the MCP

- **Every write quotes a version** (from the last read or write) and answers
  with the next. A refused write means the file changed, usually the person
  saving in the editor: read again, and `diff` from your version shows what
  they drew.
- **`batch` is one write**: one version quoted, one change on disk, one undo
  step in the editor, all or nothing. A change made of several edits (a new
  colour and the cells that use it, cutting a sprite into parts) goes in one.
- **Rows are the working representation.** `read_frame` shows rows ruled in
  tens, zero-based, x right and y down in the node's own pixels; `put_rows`
  writes anything larger than a few cells, `set_pixels` single cells, `draw` a
  line, rect, ellipse or fill. `render` is for looking (a frame, an
  animation's strip); `render_lineup` puts several sprites side by side at one
  scale to check their sizes agree.
- A node is the sprite (omit `node`), a part by path (`"leg_front_far"`,
  `"doorL/handle"`) or a level (`"@far"`). `read_sprite` gives the outline:
  palette, variants, animations, parts in draw order with `(its own grid)`
  among them, levels and the version.

Writing a sprite from scratch as text is fine (`create_sprite`, then
`put_rows`); hold the validator's rules while typing: `h` rows of exactly `w`
characters, every character `.` or a one-character key, a variant only
recolouring keys the palette has, animations naming frames that exist.

## Whole first, then parts

- **Draw a subject whole, then lift the pieces that move.** Light and outline
  read as one when drawn together. `part` with `op: "lift"` cuts a rectangle
  out into a new part placed where it was, frame by frame, so a leg is taken
  from wherever it is in each; `chars` takes only those keys, `attach` adds
  touching cells of others (a leg's hooves). The part gets the node's
  animations. The deer was cut by colour (`N`/`n` near legs, `F`/`f` far, `K`
  hooves) into a body and four legs; put back together, every frame matched.
- **Hidden pieces can be drawn whole**: a far leg whole, the body whole under
  the near legs. `behind: true` draws a part before its parent's grid;
  `order_part` steps a part through the draw order, the parent's grid being
  one of the steps, so a part stepped past it changes sides.
- **`carry` takes a hand edit on one frame to the others**: spots painted on
  frame 0 of a walk go onto the rest, each at an offset given or found within
  `search` cells. A cell lands only where the target still has what it
  replaced; the rest is reported.
- **Parts are for independent state.** Three door states by three lamp states
  by two trunk by three damage is 54 whole-subject frames, or a few short
  strips as parts. A part has its own pixels (intrinsic to this subject) or
  `use`s another sprite in the folder (one wheel for every car). Which frame a
  part shows, and whether it is drawn, is the game's state: a door that fell
  off is the game not drawing it.

## Variants, cycles, levels

- **A variant overrides keys by name** and inherits the rest: a winter coat,
  an x-ray, a team colour is a variant of the subject, never a file.
- **A colour that should diverge between variants needs its own key.** The
  deer's tail shared `T` with its antler tips, and the winter coat turned the
  tail velvet brown; the tail now has `t`. Add a key rather than reuse a near
  colour.
- **Colour cycles** are variants too, one per phase: `water 1` … `water n`,
  each naming only the keys it turns. The game draws `water k` on its own
  clock, counting phases up to the first missing number.
- **Levels** are the subject drawn at other sizes, in step with its frames and
  playing its animations, so a game swaps size mid-walk. `level` `derive`
  scales a start to draw over; scaling is never the answer.

## From a generator

A sprite can start as a script: the roe deer's body spans written by hand, its
legs placed by 2-bone IK on a 4-beat walk, the stride matched to how far the
game moves it per pass through the walk frames (22 px) so the hooves plant.
Then it is hand-edited in dab. **Fold the edits back into the generator**
before running it again, or the run erases them; `diff` from the generated
version lists them.

## Reading sprites in a game

- **`@anarkisti/dab/core`** (pure, no dependencies) reads what the editor
  draws: `layers` is the walk (a node's `behind` parts, its grid, the rest,
  each at its parent's offset plus its own; `frameOf` holds a part's frame,
  `resolve` supplies `use`d sprites), `pixels` one grid's frame as packed
  words, `assembly` the whole subject in one, and
  `frameAt(sprite, animation, step)` the frame of an animation, looping both
  ways (a visitor still off the left edge steps through negative distance).
  Don't write a reader.
- **In a korpi raster**, `spritesOf({ resolve })` from
  `@anarkisti/korpi/sprites`: `draw(scene, view, sprite, at, pose)` stands it
  with the bottom middle of its grid on a world point, at that point's depth;
  `paint(pen, sprite, x, y, pose)` paints it through any pen as runs of one
  colour. The pose holds `frame`, `variant`, `flip` (the whole subject, parts
  too), `parts` frames by path and `dd`, a hair nearer or farther.
- **Drive the step by what it depicts**: a walk by distance travelled
  (`along / STRIDE * frames`) so the feet don't slide at any speed; idle
  motions and wings by time (`t * 9 + i`, a phase per individual so a flock
  doesn't flap in step). Animations have no durations; the clock is the game's.

## Turning and size

- **Authored turns**: dab's Spin (in the picture plane), Swing and Tilt
  (hinges, as foreshortening) write the in-between frames, each sampled from
  the original. Quarter turns are exact; other angles invent colours, and dab
  says how many palette entries that costs.
- **Runtime turns** of procedural paintings are `game-maker:posed-pixels`;
  never rotate a sprite at runtime, it smears.
- **Every sprite is drawn at its own size, one sprite pixel to a scene
  pixel**: 40 px to the metre in nahkarele, so a 1.8 m figure is 72 px and the
  deer 54×50. A bigger animal is a bigger drawing; one meant farther away is a
  level. Only the whole scene scales (`game-maker:depth-and-lod`).
