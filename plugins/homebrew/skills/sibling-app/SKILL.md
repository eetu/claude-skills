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
> security model, and the deploy contract. Read an existing sibling app live for
> the worked multi-service example; versions drift — prefer the latest.

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
  e2e/       # optional integration crate
  <worker>/  # optional extra Rust service crate(s) — workers/sidecars
             #   (e.g. an ffmpeg media worker, a compat API)
  <sidecar>/ # optional non-Rust sidecar, own toolchain, NOT in the workspace
             #   (e.g. a Python FastAPI service wrapping a vendor SDK)
```

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

1. Workspace `Cargo.toml` (from a sibling app; keep `[workspace.dependencies]`,
   trim `members`; prefer the latest crate versions). → `rust-axum`.
2. Backend skeleton → `rust-axum`.
3. Frontend skeleton → `spa-frontend` (pick framework consciously).
4. Per-app design skill → `halo-design` (copy `colors_and_type.css`, swap the
   four deltas: glyph, wordmark text, layout, voice).
5. Tooling (this skill): hooks, workflows, dependabot, Dockerfile, ignores.
   Run `./install-hooks.sh`.
6. `SECURITY.md`: copy a sibling app's, rewrite threat-model/trust-boundaries.
7. Deploy wiring in `../raspi` (below).

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
- **CI (`ci.yaml`):** `frontend` job (yarn install --immutable → lint, format,
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
  automerge action. **`cve-scan.yaml`:** weekly trivy, SARIF → Security
  tab, report-only; matrix over every service image (per-image SARIF category).
- **`dependabot.yaml`:** npm(`/frontend`) + cargo(`/`) + docker + github-actions,
  **plus one ecosystem per non-Rust sidecar** (e.g. pip at `/shim`);
  cooldowns (major 14d/minor 7d/patch 5d); group react/tanstack/axum/tokio;
  ignore eslint major.
- **Dockerfile:** multi-stage, `tonistiigi/xx` cross-compile → `scratch`. Stages:
  `frontend-build` (`node:<latest>-alpine`) — COPY the manifest + `yarn.lock` +
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
