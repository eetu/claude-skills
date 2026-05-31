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
      sibling-app/                   Rust(axum)+React app bootstrap + raspi deploy wiring
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
design skills (scribe-design, halo's own) layer on top of the shared ones freely.

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

## Versioning

No `version` pin in `plugin.json` → every commit is an update; installed copies
refresh at session start. Pin a version string only when a plugin needs a
release cadence.
