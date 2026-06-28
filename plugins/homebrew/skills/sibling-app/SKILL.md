---
name: sibling-app
description: Orchestrator for building a new self-hosted homebrew web app and deploying it to the Raspberry Pi via the ../raspi pyinfra repo. Use when starting a new app repo in the family, or adding house-standard tooling to one. Assembles the other skills — halo-design (look), spa-frontend (UI), rust-axum (backend+security+tests), ts-style (code) — and owns the app-level glue they don't: repo layout, the frontend↔backend seam, Dockerfile, CI/git-hooks/dependabot, the oauth2-proxy edge trust model, and the raspi deploy wiring.
user-invocable: true
---

> **Priors, not rails.** This is the assembly playbook for the family as it
> stands (Rust axum backend + Vite SPA, shipped as one arm64 container, deployed
> by pyinfra). The framework slot (React or Svelte — see
> `spa-frontend`) and any tool here are open to better options; keep the seams
> and the deploy contract, swap the parts, document the change. **The
> single-binary, all-Rust shape is the common case, not a rule** — a domain that
> needs extra service binaries or a non-Rust sidecar (see "Multi-service &
> polyglot" below) is still a sibling app, as long as it keeps the seams, the
> security model, and the deploy contract. **Standalone by default:** the shipped
> `*.example` templates are the canonical starting point and produce a working
> result with no sibling cloned; a cloned sibling is an optional fuller reference,
> not a prerequisite. Read one live for the worked multi-service example if it's
> checked out; versions drift — prefer the latest.

# sibling-app

A sibling app = a Rust (axum) binary that **embeds a Vite SPA**, ships to
`ghcr.io/<owner>/<name>`, and is deployed onto the Pi by the deploy/infra repo
(`../raspi`, a pyinfra project) as a Podman quadlet behind Traefik +
oauth2-proxy. Usually that's **one** binary in **one**
container; some apps add extra service binaries or a non-Rust sidecar, each its
own image (see "Multi-service & polyglot").

This skill is the index. The pieces live in their own skills:

| Concern                                   | Skill                            |
| ----------------------------------------- | -------------------------------- |
| Visual identity (tokens, wordmark, glyph) | `halo-design`                    |
| Frontend SPA (contract + React/Svelte)    | `spa-frontend`                   |
| Rust backend + security impl + tests      | `rust-axum`                      |
| Python backend/sidecar (hardware/vendor)  | `python-service`                 |
| TS/JS code conventions                    | `ts-style` (coding-style plugin) |

If invoked with no concrete task, ask what the app does, then walk the scaffold.

## The seam (frontend ↔ backend — what this skill owns)

- SPA built by Vite → `dist/`; the backend serves it with an SPA fallback
  (`rust-axum`). One origin in prod.
- Dev: Vite proxy maps `/api`,`/auth`,`/status` → backend port. Same-origin prod.
- Manual type sharing: Rust `Serialize` structs ↔ hand-written TS types. No
  codegen. JSON over the wire.
- This decoupling is why the framework is swappable: the backend only knows
  `dist/`; the frontend only knows `/api`.

## Repo layout

```text
<name>/
  Cargo.toml Cargo.lock Dockerfile .dockerignore .gitignore
  install-hooks.sh  .githooks/pre-commit
  README.md  SECURITY.md  CLAUDE.md     # root CLAUDE.md — repo overview (see below)
  .github/{workflows/{ci,dockerimage,automerge,cve-scan}.yaml, dependabot.yaml}
  .claude/skills/<name>-design/     # thin per-app design skill (see halo-design)
  backend/   # see rust-axum — carries its own CLAUDE.md
  frontend/  # see spa-frontend — has .node-version + vendored .yarn/releases + CLAUDE.md
  shared/    # optional shared types
  e2e/       # optional integration crate
  <worker>/  # optional extra Rust service crate(s) — workers/sidecars
             #   (e.g. an ffmpeg media worker, a compat API)
  <sidecar>/ # optional non-Rust sidecar, own toolchain, NOT in the workspace
             #   (e.g. a Python FastAPI service wrapping a vendor SDK)
```

## Docs (CLAUDE.md — root + per-area)

Every app carries a **root `CLAUDE.md`** plus **one per service/area** (`backend/`,
`frontend/`, and each extra crate/sidecar — `press/`, `shim/`, …). README is for
humans; CLAUDE.md is the agent's map. Keep them terse; don't repeat what the code
or a skill already says — record the non-obvious invariants.

Root `CLAUDE.md` structure (see `chat/CLAUDE.md`, `scribe/CLAUDE.md`):

- `# <app> — repo overview` — one line on what it is + sibling links.
- `## Layout` — a fenced tree of top-level dirs, each with a one-line role.
- `## Conventions` — the load-bearing invariants: auth model, per-user data
  isolation, resource budgets, polling/streaming contracts, anything a change
  could silently break.
- `## Working on this repo` — ports, dev commands, `DEV_AUTH`, proxy notes.
- `## Out of scope` — what's deliberately not built, so it isn't "added" by accident.

Per-area `CLAUDE.md` is shorter — just that area's specifics (e.g. `frontend/`
documents `yarn validate`; `backend/` notes the module map + loops/upstreams).

## Local dev (task runner)

A root **`justfile`** is the task runner. Support **two flows**:

- **Whole service, one command:** `just dev <app>` starts _every_ component that
  service needs together — backend + frontend + any sidecars — and one Ctrl-C
  tears them all down (kill the children _and_ their grandchildren — the binary
  under bacon, vite under yarn; never `kill 0`, which would also signal `just`).
- **Per component, own terminal:** the Rust backend/worker via **bacon** (a
  `bacon.toml` per crate: `default_job = "run"`, a `run` job that's
  `background = true`, `on_change_strategy = "kill_then_restart"`,
  `watch = [".env"]`), the SPA via `yarn dev`, a Python sidecar via `uv run`.

The one-command flow runs the backend(s) **headless** so their logs compose into
one stream: `bacon --headless -j run` (auto-reload, no TUI); run plain `bacon` in
the crate when you want the interactive view. Backends load their own
`backend/.env` (dotenvy) and bacon watches it, so config + code changes both
hot-reload. Document the exact ports and `DEV_AUTH` / `*_OPEN` bypass switches in
the app's root `CLAUDE.md` ("Working on this repo"). Avoid `cargo run` directly in
`just dev` — it doesn't reload, so you debug a stale binary.

## Multi-service & polyglot (only when the domain demands it)

Default to one binary. Split out a second service **only** when work is genuinely
separate — a long-running worker that mustn't block requests, a component with a
different memory/lifecycle profile, or one that wraps a library with no Rust
equivalent. A worked example: `backend` (API + SPA), an ffmpeg media `worker`, a
compat-API service, and a Python `shim` wrapping a vendor SDK.

- **Extra Rust services** are just more workspace crates (`rust-axum` covers the
  per-crate shape — each its own binary, config, `/status`). They share
  `shared/` types and the `[workspace.dependencies]` table.
- **Non-Rust sidecar** when a library forces the language (e.g. Python for a
  vendor SDK with no Rust crate). It lives **outside** the Cargo workspace with
  its own toolchain (e.g. `uv` + FastAPI + `ruff`), and is reached over **loopback
  HTTP only** — the main backend never imports it or parses its secrets. This is
  also the **isolation boundary**: scope sensitive state (credentials, vendor
  cookies) to the sidecar so a crash/compromise there leaves the cached-data app
  working. Justify the extra language in the app's `CLAUDE.md`.
- **Inter-service auth:** loopback isn't trust — services authenticate with a
  shared bearer token (env, constant-time compare; `rust-axum` security).
- **One image per service**, each `ghcr.io/<owner>/<name>-<svc>`; the tooling
  below fans out per service (see the per-service notes inline).
- **Deploy:** one `../raspi` quadlet per service (one task file per image);
  co-locate on the Pi over loopback or split across LAN hosts.

## Scaffold order

1. Workspace `Cargo.toml` (from the canonical `Cargo.toml.example` shipped in the
   **rust-axum** skill dir — or a sibling's, if cloned; keep
   `[workspace.dependencies]`, trim `members`; prefer the latest crate versions).
   → `rust-axum`.
2. Backend skeleton → `rust-axum`.
3. Frontend skeleton → `spa-frontend`. **New-app default = SvelteKit (Svelte);**
   pick another framework only with a reason. → `spa-frontend`.
4. Per-app design skill → `halo-design` (copy `colors_and_type.css`, swap the
   four deltas: glyph, wordmark text, layout, voice).
5. Tooling (this skill): copy the starter files (below), substitute `<name>`,
   then run `./install-hooks.sh`.
6. `SECURITY.md`: from `SECURITY.md.example` (below), fill threat-model/
   trust-boundaries for this app.
7. Deploy wiring in `../raspi` (below) — **only if `../raspi` is checked out
   beside this repo** (see the HARD PREREQUISITE note on that section).

## Starter files

Canonical, generalized-from-a-working-sibling templates ship beside this skill
(and the leaf skills). **They are self-sufficient: copying them produces a working
result with NO sibling app cloned.** A checked-out sibling is an optional fuller
example — a complete live instance — never a prerequisite; these skills are
written to yield equivalent results whether or not siblings are present. Copy the
templates in, substitute `<name>`/`<NAME>` (see "Per-app substitutions"), and
re-resolve action SHAs. They're single-service shapes; each carries inline notes
for the multi-service / polyglot fan-out.

| File                                 | Lands at                             | Notes                                                 |
| ------------------------------------ | ------------------------------------ | ----------------------------------------------------- |
| `justfile.example`                   | `justfile`                           | task runner; `dev` recipe has the child-tree teardown |
| `install-hooks.sh.example`           | `install-hooks.sh`                   | **mode 755**                                          |
| `pre-commit.example`                 | `.githooks/pre-commit`               | **mode 755**; staged-path branching                   |
| `Dockerfile.example`                 | `Dockerfile`                         | vendored-yarn → xx cross-compile → scratch            |
| `dependabot.yaml.example`            | `.github/dependabot.yml`             | npm `/frontend` + cargo `/` + docker + actions        |
| `SECURITY.md.example`                | `SECURITY.md`                        | threat-model skeleton                                 |
| `workflows/ci.yaml.example`          | `.github/workflows/ci.yaml`          | resolve SHAs first                                    |
| `workflows/automerge.yaml.example`   | `.github/workflows/automerge.yaml`   | uses `eetu/action-automerge`                          |
| `workflows/dockerimage.yaml.example` | `.github/workflows/dockerimage.yaml` | build+push linux/arm64 to GHCR                        |
| `workflows/cve-scan.yaml.example`    | `.github/workflows/cve-scan.yaml`    | weekly trivy → Security tab                           |

## App-level tooling (owned here)

- **Git hooks:** `install-hooks.sh` does `git config core.hooksPath .githooks`.
  `pre-commit` (`set -e`, early-exit on empty staged set) inspects staged paths:
  `frontend/` → `yarn lint` + `yarn format`; `backend|shared|Cargo.*` →
  `cargo clippy --workspace --all-targets -- -D warnings` (covers all Rust
  service crates at once). Add a branch per non-Rust sidecar (e.g. a Python one:
  `shim/*.py|shim/pyproject.toml` → `uv run ruff check src`).
  - **Commit both scripts with the executable bit (mode 755).** Files written by
    an editor/tool land 644, and git stores the mode — a 644 `install-hooks.sh`
    can't be `./`-run, and git **silently skips** a non-executable
    `core.hooksPath` hook, so the gate appears installed but never fires. After
    creating them: `chmod +x install-hooks.sh .githooks/*` **then** `git add`
    (or, if already committed wrong, `git update-index --chmod=+x <file>`).
    Verify with `git ls-files -s .githooks` → mode must read `100755`.
- **Actions are SHA-pinned.** Every `uses:` across all workflows pins a full
  commit SHA with a same-line `# vX` comment
  (`uses: actions/checkout@<sha> # v6`) — tamper-evident, and dependabot still
  bumps the SHA + rewrites the comment. Exception: rolling selectors like
  `dtolnay/rust-toolchain@stable` stay on the tag (pinning would freeze them).
  **You cannot know SHAs offline** — the ones in the starter workflows are
  illustrative and go stale. Before committing, resolve each action's current
  release commit and rewrite the SHA + `# vN`:
  `gh api repos/<owner>/<action>/git/ref/tags/<tag> --jq .object.sha` (or the
  action's Releases page).
- **CI (`ci.yaml`):** `frontend` job (`setup-node` with `node-version-file:
frontend/.node-version` → yarn install --immutable → lint, format,
  typecheck, build) + `backend` job (`dtolnay/rust-toolchain@stable` + clippy,
  `Swatinem/rust-cache@v2`, clippy `-D warnings`, `cargo test`, build --release;
  one job covers the whole Rust workspace). Add `e2e` job if there's an e2e
  crate. Each non-Rust sidecar gets its own job in its toolchain (e.g. a Python
  one: `astral-sh/setup-uv` → `uv sync --frozen` → `ruff check src`).
- **`dockerimage.yaml`:** `dorny/paths-filter` gate → QEMU + buildx → ghcr login
  → `docker/metadata-action` (tags: `type=ref,event=branch` for `:main`, semver
  on `v*`, `latest` only on version tags) → `build-push-action`
  (`platforms: linux/arm64`, `provenance:false`, `sbom:false`, gha cache) →
  `actions/delete-package-versions` prune untagged (keep 5). **One image per
  service** — repeat the build-push per service (build each service's image),
  each its own target stage + ghcr repo + paths-filter gate.
- **`automerge.yaml`:** gates `github.actor == 'dependabot[bot]'`, uses the house
  automerge action `eetu/action-automerge` on the plain `GITHUB_TOKEN`
  (`contents: write` +
  `pull-requests: write` — no extra read scopes needed). **Skip github-actions
  bumps:** add `&& !startsWith(github.head_ref, 'dependabot/github_actions')` to
  the job `if`. Those PRs edit `.github/workflows/*`, which `GITHUB_TOKEN` cannot
  merge (no `workflows` permission scope exists) — the run would fail with a red
  X. Merge them by hand (you want to eyeball CI changes anyway); a long-lived
  PAT/App token just for action bumps is too much attack surface to justify.
  The skip makes the job _skipped_, not failed. **`cve-scan.yaml`:** weekly
  trivy, SARIF → Security tab, report-only; matrix over every service image
  (per-image SARIF category).
- **`dependabot.yaml`:** npm(`/frontend`) + cargo(`/`) + docker + github-actions,
  **plus one ecosystem per non-Rust sidecar** (e.g. pip/uv at `/shim`, `/backend`);
  group react/tanstack/axum/tokio; ignore eslint major. **Cooldown rule:** code
  ecosystems (npm/cargo/pip/uv) get the full set — `default-days: 7`,
  `semver-major-days: 14`, `semver-minor-days: 7`, `semver-patch-days: 5`;
  **docker + github-actions take `default-days` only** — the `semver-*` keys
  silently break parsing for those two ecosystems.
- **Dockerfile:** multi-stage, `tonistiigi/xx` cross-compile → `scratch`. Stages:
  `frontend-build` (`node:<v>-alpine`, `<v>` matching `frontend/.node-version`) — COPY the manifest + `yarn.lock` +
  `.yarnrc.yml` + `.yarn/releases`, then `RUN node .yarn/releases/yarn-*.cjs
install --immutable` and `… build`. **Vendored yarn, no corepack** (see
  `spa-frontend`), so the stage is independent of the node version. →
  `workspace-deps` (warm cargo cache) → `backend-build` → `runner` (scratch +
  binary + dist + certs). **Multi-service:** one runner stage per Rust binary
  (the SPA `dist/` ships only with the frontend-serving one); a non-Rust sidecar
  gets its own base + stage (e.g. Python: `python:<latest>-slim` + `uv sync`),
  not scratch. `dockerimage.yaml` builds each via its target stage.

### Per-app substitutions

When copying from a sibling app: `<sibling>`→`<name>` (crate names, image, prune
package-name); `<SIBLING>_IMAGE_TAG`/`VITE_<SIBLING>_IMAGE_TAG`→`<NAME>_IMAGE_TAG`;
branch (`main`; some apps use `develop`); env prefixes (`<NAME>_DB_PATH`, `BIND`,
`STATIC_DIR`); pre-commit cargo glob.

## Edge security / deploy trust model (cross-cutting — every app, any backend)

- Apps sit **behind oauth2-proxy forward-auth** on the Pi (Traefik gated host).
  The app can **trust `X-Auth-Request-User` / `X-Auth-Request-Email`** headers —
  but validate they're present (401 if not) and never log them (PII). **No
  per-app Kanidm OIDC client needed** in this mode; no own login/session.
- Unauth liveness `/status` (`rust-axum`) for gatus probing; put it on a Traefik
  monitor router that bypasses oauth2-proxy if the host is gated.
- Secrets via `/etc/secrets/<name>.env` (written by `../raspi`'s `tasks/secrets.py`).
- LAN-only by default; container runs rootful (quadlets under
  `/etc/containers/systemd`) so it can write host-shared mounts without extra
  privilege. Container name must equal the systemd unit name (cgroup match).

## raspi deploy wiring (in `../raspi`, per its CLAUDE.md "Adding a new service")

> **HARD PREREQUISITE: this phase requires the existing `../raspi` pyinfra repo
> checked out beside this one.** It edits files _in that repo_ (`all.py`,
> `tasks/*.py`). If `../raspi` is absent, deploy is **out of scope** for a
> standalone app — stop here, ship the image to GHCR, and do NOT invent raspi
> files (`tasks/<name>.py`, `all.py` entries) from scratch; they only make sense
> as edits to the real repo.

- `all.py` + `all.example.py`: service dict (host `127.0.0.1`, port, `url_prefix`,
  image, `public:` flag, `MemoryMax`, `MALLOC_ARENA_MAX=2`).
- `tasks/<name>.py`: quadlet — **copy an existing service's task**
  (`tasks/<existing>.py`) (`Network=host`, AutoUpdate/Pull for `:main`,
  `optional()` + cleanup branch).
- `tasks/traefik.py`: add `(name, DICT, "<prefix>")` to `ROUTES`; if human-gated,
  append the route name to **`_gated_hosts`** (there is **no** `OAUTH2_GATED_HOSTS`
  var — that's a common mistake).
- `tasks/secrets.py` env write + a `vault.py` helper if it needs secrets.
- `_SUBDOMAIN_NAMES` in `all.py` — the **dict name** (e.g. `<APP_NAME>`),
  not the subdomain string.
- `tasks/network_restrict.py` `RESTRICTED` if LAN-only.
- `RESTIC["paths"]` only if stateful. `deploy.py` include after dependencies.
- Create the Bitwarden item before deploy.

## Verified stack values

Live in the leaf skills (`rust-axum` deps, `spa-frontend` React stack,
`ts-style` eslint-config). Always cross-check a sibling app before copying —
versions move; prefer the latest.
