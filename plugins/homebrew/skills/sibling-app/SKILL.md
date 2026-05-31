---
name: sibling-app
description: Orchestrator for building a new self-hosted homebrew web app and deploying it to the Raspberry Pi via the ../raspi pyinfra repo. Use when starting a new app repo in the family, or adding house-standard tooling to one. Assembles the other skills — halo-design (look), spa-frontend (UI), rust-axum (backend+security+tests), ts-style (code) — and owns the app-level glue they don't: repo layout, the frontend↔backend seam, Dockerfile, CI/git-hooks/dependabot, the oauth2-proxy edge trust model, and the raspi deploy wiring.
user-invocable: true
---

> **Priors, not rails.** This is the assembly playbook for the family as it
> stands (Rust axum backend + Vite SPA, shipped as one arm64 container, deployed
> by pyinfra). The framework slot (React today, Svelte under evaluation — see
> `spa-frontend`) and any tool here are open to better options; keep the seams
> and the deploy contract, swap the parts, document the change. Reference is
> `../scribe`; read it live, versions drift.

# sibling-app

A sibling app = a single Rust (axum) binary that **embeds a Vite SPA**, ships as
one container to `ghcr.io/eetu/<name>`, and is deployed onto the Pi 4 by
`../raspi` as a Podman quadlet behind Traefik + oauth2-proxy.

This skill is the index. The pieces live in their own skills:

| Concern                                   | Skill                            |
| ----------------------------------------- | -------------------------------- |
| Visual identity (tokens, wordmark, glyph) | `halo-design`                    |
| Frontend SPA (contract + React/Svelte)    | `spa-frontend`                   |
| Rust backend + security impl + tests      | `rust-axum`                      |
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
  README.md  SECURITY.md
  .github/{workflows/{ci,dockerimage,automerge,cve-scan}.yaml, dependabot.yaml}
  .claude/skills/<name>-design/     # thin per-app design skill (see halo-design)
  backend/   # see rust-axum
  frontend/  # see spa-frontend
  shared/    # optional shared types
  e2e/       # optional integration crate (scribe has one)
```

## Scaffold order

1. Workspace `Cargo.toml` (from `../scribe`; keep `[workspace.dependencies]`,
   trim `members`). → `rust-axum`.
2. Backend skeleton → `rust-axum`.
3. Frontend skeleton → `spa-frontend` (pick framework consciously).
4. Per-app design skill → `halo-design` (copy `colors_and_type.css`, swap the
   four deltas: glyph, wordmark text, layout, voice).
5. Tooling (this skill): hooks, workflows, dependabot, Dockerfile, ignores.
   Run `./install-hooks.sh`.
6. `SECURITY.md`: copy scribe's, rewrite threat-model/trust-boundaries.
7. Deploy wiring in `../raspi` (below).

## App-level tooling (owned here)

- **Git hooks:** `install-hooks.sh` does `git config core.hooksPath .githooks`.
  `pre-commit` (`set -e`, early-exit on empty staged set) inspects staged paths:
  `frontend/` → `yarn lint` + `yarn format`; `backend|shared|Cargo.*` →
  `cargo clippy --workspace --all-targets -- -D warnings`. Add a python branch
  only if the app has one.
- **CI (`ci.yaml`):** `frontend` job (yarn install --immutable → lint, format,
  typecheck, build) + `backend` job (`dtolnay/rust-toolchain@stable` + clippy,
  `Swatinem/rust-cache@v2`, clippy `-D warnings`, `cargo test`, build --release).
  Add `e2e` job if there's an e2e crate.
- **`dockerimage.yaml`:** `dorny/paths-filter` gate → QEMU + buildx → ghcr login
  → `docker/metadata-action` (tags: `type=ref,event=branch` for `:main`, semver
  on `v*`, `latest` only on version tags) → `build-push-action`
  (`platforms: linux/arm64`, `provenance:false`, `sbom:false`, gha cache) →
  `actions/delete-package-versions` prune untagged (keep 5).
- **`automerge.yaml`:** gates `github.actor == 'dependabot[bot]'`, uses
  `eetu/action-automerge@v1`. **`cve-scan.yaml`:** weekly trivy, SARIF → Security
  tab, report-only.
- **`dependabot.yaml`:** npm(`/frontend`) + cargo(`/`) + docker + github-actions;
  cooldowns (major 14d/minor 7d/patch 5d); group react/tanstack/axum/tokio;
  ignore eslint major.
- **Dockerfile:** multi-stage, `tonistiigi/xx` cross-compile → `scratch`. Stages:
  `frontend-build` (node 24+-alpine, `yarn build` — framework-agnostic; on
  `node:26-alpine` install corepack first: `RUN npm i -g corepack@latest &&
corepack enable` — node ≥25 dropped the bundled corepack, hit in
  raspi-dashboard via a dependabot bump) →
  `workspace-deps` (warm cargo cache) → `backend-build` → `runner` (scratch +
  binary + dist + certs). node 24+ throughout (see corepack note above).

### Per-app substitutions

`scribe`→`<name>` (crate names, image, prune package-name);
`SCRIBE_IMAGE_TAG`/`VITE_SCRIBE_IMAGE_TAG`→`<NAME>_IMAGE_TAG`; branch
(`main`; halo uses `develop`); env prefixes (`<NAME>_DB_PATH`, `BIND`,
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

- `all.py` + `all.example.py`: service dict (host `127.0.0.1`, port, `url_prefix`,
  image, `public:` flag, `MemoryMax`, `MALLOC_ARENA_MAX=2`).
- `tasks/<name>.py`: quadlet — **copy `tasks/chat.py`** (`Network=host`,
  AutoUpdate/Pull for `:main`, `optional()` + cleanup branch).
- `tasks/traefik.py`: add `(name, DICT, "<prefix>")` to `ROUTES`; if human-gated,
  append the route name to **`_gated_hosts`** (there is **no** `OAUTH2_GATED_HOSTS`
  var — that's a common mistake).
- `tasks/secrets.py` env write + a `vault.py` helper if it needs secrets.
- `_SUBDOMAIN_NAMES` in `all.py` — the **dict name** (e.g. `RASPI_DASHBOARD`),
  not the subdomain string.
- `tasks/network_restrict.py` `RESTRICTED` if LAN-only.
- `RESTIC["paths"]` only if stateful. `deploy.py` include after dependencies.
- Create the Bitwarden item before deploy.

## Verified stack values

Live in the leaf skills (`rust-axum` deps, `spa-frontend` React stack,
`ts-style` eslint-config). Always cross-check `../scribe` before copying —
this fleet's versions move.
