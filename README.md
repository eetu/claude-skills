# claude-skills

Personal Claude Code skill marketplace. Battle-tested house patterns so new
projects follow them without re-deriving from scratch each time.

Skills are **priors, not rails** — every skill records the _why_ so you can tell
when the _why_ no longer holds and deviate deliberately.

## Layout

```text
.claude-plugin/marketplace.json      catalog
plugins/
  homebrew/                          self-hosted homebrew web apps
    skills/
      halo-design/                   shared visual identity (tokens, wordmark, glyph)
      halo-interaction/              how the tools behave (menus, keys, undo, modes)
      sibling-app/                   Rust(axum)+React app bootstrap + raspi deploy wiring
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
      sky-and-weather/               seasons, days, sun, moon, weather
      depth-and-lod/                 layering, distance, level of detail
      game-workbench/                bench, shuttle, screenshots, perf
```

New domains get their own plugin beside `homebrew/` (e.g. `raspi-iac`,
`rust-axum`, `python-tooling`). Domain-split so a project enables only what's
relevant.

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

### Auto-enable per project

In a project's `.claude/settings.json`:

```json
{
  "extraKnownMarketplaces": {
    "eetu-skills": {
      "source": { "source": "github", "repo": "eetu/claude-skills" }
    }
  },
  "enabledPlugins": { "homebrew@eetu-skills": true }
}
```

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
