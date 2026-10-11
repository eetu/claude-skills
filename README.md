# claude-skills

Personal Claude Code skill marketplace. Battle-tested house patterns so new
projects follow them without re-deriving from scratch each time.

Skills are **priors, not rails** — every skill records the _why_ so you can tell
when the _why_ no longer holds and deviate deliberately.

## Layout

```text
.claude-plugin/marketplace.json      catalog
plugins/
  coding-style/                      code + environment conventions, any stack
    skills/
      lint-format/                   formatter + linter everywhere, zero warnings
      brevity/                       a line must inform or go
      no-iteration-narration/        comments describe the final model
      ts-style/                      TS/JS house style (Biome or eslint)
      svelte/                        Svelte + SvelteKit style
      npm-release/                   versioning and publishing npm libraries
      fish/                          the default shell, and bash -c one-liners
  homebrew/                          self-hosted homebrew web apps
    skills/
      halo-design/                   shared visual identity (tokens, wordmark, glyph)
      halo-interaction/              how the tools behave (menus, keys, undo, modes)
      spa-frontend/                  the SvelteKit SPA (React for older apps)
      rust-axum/                     the Rust axum backend, security, tests
      python-service/                the Python backend for hardware/vendor libs
      sibling-app/                   app assembly + raspi deploy wiring; static SPAs
  diagnosis/                         investigating faults without inventing causes
    skills/
      root-cause/                    hypotheses, falsifying tests, "cause unknown" as an ending
  creative-coding/                   generative canvas effects
    skills/
      ascii-artist/                  animated ASCII on a canvas
  game-maker/                        building blocks for pixel-art games
    skills/
      dab-sprites/                   hand-drawn art in dab, the core tool
      world-clock/                   the world as a function of time and seed
      posed-pixels/                  paint once, re-pose per frame
      wind-and-springs/              wind, damped springs, rigs, falls
      procedural-plants/             trees, shrubs, climbers, grass, moss
      pixel-brushes/                 painting primitives, texture, palettes
      sky-and-weather/               seasons, days, sun, moon, weather, light
      depth-and-lod/                 true depth, distance, level of detail
      breaking-structures/           masonry that wears, breaks, falls and piles
      game-workbench/                bench, shuttle, screenshots, perf
```

New domains get their own plugin beside `homebrew/` (e.g. `raspi-iac`,
`python-tooling`).

## Use

```sh
# during development, from a clone:
claude --plugin-dir ./plugins/homebrew          # load for one session
# or register the whole marketplace:
/plugin marketplace add ~/dev/claude-skills     # local path
/plugin marketplace add eetu/claude-skills      # once pushed to GitHub
/plugin install homebrew@eetu-skills
```

Plugin skills are namespaced (`homebrew:halo-design`). A project's own
`.claude/skills/<name>` always wins over a same-named plugin skill — so per-repo
design skills (`<app>-design`) layer on top of the shared ones freely.

### Installed for the user

Every plugin is installed at user scope, so every project has them:
`claude plugin install <plugin>@eetu-skills --scope user`. That writes
`enabledPlugins` (and the marketplace, with `autoUpdate`) into
`~/.claude/settings.json`, which chezmoi syncs between machines; after
installing, `chezmoi re-add ~/.claude/settings.json`. A new plugin in the
marketplace is not enabled by itself: install it once.

## Develop

```sh
yarn install          # vendored yarn (yarnPath); deps for lint/format
./install-hooks.sh    # once after cloning — points core.hooksPath at .githooks
yarn validate         # prettier --check + markdownlint + skill checks (also the pre-commit gate)
```

## Versioning

No `version` pin in `plugin.json` → every commit is an update; installed copies
refresh at session start. Pin a version string only when a plugin needs a
release cadence.
