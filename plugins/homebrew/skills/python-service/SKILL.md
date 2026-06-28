---
name: python-service
description: The Python escape hatch for a homebrew app — a FastAPI service used when the domain needs a Python-only library a Rust crate can't replace (a hardware SDK like picamera2, a vendor wrapper like mkb79/audible). Two shapes — a loopback sidecar the Rust backend calls (scribe's shim), or the whole backend serving the SPA + /api when the hardware forces Python (ocular). Use when adding or working on Python in the family. Pairs with rust-axum (the default backend) and sibling-app (assembly).
user-invocable: true
---

> **Rust axum is the default backend** (see `rust-axum`). Reach for Python only
> when a Python-only library is the reason the app exists and porting it to Rust
> isn't realistic — a hardware SDK (picamera2/libcamera), a vendor client
> (mkb79/audible). Then it's FastAPI, in one of the two shapes below. Don't add a
> Python service for convenience; the Pi's RAM budget (≈1 GB, shared fleet-wide)
> is the constraint.

# python-service — FastAPI sidecar or backend

Two real shapes in the family, same conventions:

- **Loopback sidecar** (scribe `shim/`) — a small FastAPI process the Rust
  backend calls over loopback to wrap a Python-only lib. Owns a narrow,
  frozen contract; the Rust app owns persistence, scheduling, UI, auth.
- **Primary backend** (ocular `backend/`) — FastAPI is the whole backend
  because the hardware lib forces it; it serves the built SPA + `/api` just
  like a `rust-axum` app would.

## Packaging & deps (uv)

- `pyproject.toml` with `[project]` + `[dependency-groups] dev`. `uv` only —
  **no pip**. Commit `uv.lock`.
- Pin `requires-python` to the lib's real floor (shim `>=3.10`, ocular `>=3.11`).
- **Plain `uvicorn`**, not `uvicorn[standard]` — skip uvloop/httptools/watchfiles
  to keep the Pi footprint small.
- Console entry via `[project.scripts]`, e.g. `shim = "shim.__main__:main"`.
- Dev workflow: `uv sync` then `uv run <package>`.

## Structure (src layout)

```text
src/<package>/
  __init__.py     # __version__
  __main__.py     # console entry: load .env (if used), boot uvicorn
  main.py         # app singleton OR build()/create_app() factory
  web.py          # (optional) create_app factory + routes + SPA mount
  config.py       # env → settings (raw os.environ or a dataclass; NOT pydantic-settings)
  <domain>.py     # routes + logic
```

- Small/stateless (sidecar): module-level `app = FastAPI(...)`, `uvicorn.run("pkg.main:app", ...)`.
- Stateful (owns threads/hardware): `create_app(...)` factory + `build()`, no string import.
- Routes are direct `@app.get/@app.post` — **no `APIRouter`/`include_router`** at this size.
- Internal API → suppress docs: `FastAPI(docs_url=None, redoc_url=None, openapi_url=None)`.

## Config

- No `pydantic-settings`. Read env directly — small functions over `os.environ`
  (shim) or a `@dataclass` with `Settings.from_env()` (ocular). Pydantic
  `BaseModel` only for request bodies that need validation.
- Secrets via env only (`SHIM_TOKEN`, `SHIM_PASSPHRASE`, …), never hard-coded.
  Sidecar reads them from a systemd `EnvironmentFile=` on the Pi; `.env` +
  `python-dotenv` for local dev if needed.

## Security / trust

- **Sidecar**: bind `127.0.0.1` only — loopback is the primary control. Add an
  optional bearer token (`Authorization: Bearer`) verified with an HMAC
  **constant-time** compare on every route except `/health`. The Rust caller
  sends it. Encrypt any on-disk creds with a passphrase env var.
- **Primary backend**: sits behind oauth2-proxy at the edge (same model as
  `rust-axum`) — trust `X-Auth-Request-User`/`-Email`, anonymous if absent,
  never log those headers. No CORS (same-origin SPA / loopback).

## SPA serving (primary-backend shape)

Mirror the `rust-axum` fallback contract — serve real files from `dist/`,
fall back to `index.html` for client routes, no-op when `dist/` is absent
(dev runs Vite separately and the backend serves only `/api`). Resolve the
candidate path and confirm it's inside `dist/` before serving (no `..` escape):

```python
def _mount_spa(app: FastAPI, settings: Settings) -> None:
    dist = settings.static_dir
    index = dist / "index.html"
    if not index.is_file():
        return  # dev: Vite serves the SPA
    @app.get("/{path:path}")
    def spa(path: str) -> Response:
        candidate = (dist / path).resolve()
        if path and candidate.is_file() and dist.resolve() in candidate.parents:
            return FileResponse(candidate)
        return FileResponse(index)
```

## Sidecar boundary (the loopback contract)

Freeze the endpoint shapes in an `API.md` next to the code — it's the source of
truth the Rust side codes against. The sidecar absorbs upstream-lib churn
without breaking that contract. Keep a `CLAUDE.md` stating who owns what (e.g.
shim owns auth/token-refresh/library-fetch/voucher-decrypt; the Rust app owns
SQLite, polling cadence, NAS IO, UI, OIDC session). Single-process is fine for
low-QPS sequential work; cache warm clients in memory to keep sessions live.

## Lint / format

Per `lint-format`: **ruff** in the dev group, run `uv run ruff check` +
`uv run ruff format`, zero warnings. Config in `pyproject.toml`
(`[tool.ruff] line-length = 100`, `src = ["src"]`). Type-hint throughout;
no mypy/pyright gate in the family today.

## Dockerfile (multi-stage, warm dep layer)

Use the **latest** stable `python:<X.Y>-slim` tag at scaffold time — don't copy
a sibling's pin (per `lint-format`: always latest, never inherit a stale pin).
This is the one base image dependabot's `docker` ecosystem then keeps bumped.

```dockerfile
FROM python:3.14-slim AS runner   # bump to the current stable minor at scaffold
WORKDIR /app
COPY --from=ghcr.io/astral-sh/uv:latest /uv /uvx /usr/local/bin/
COPY <svc>/pyproject.toml <svc>/uv.lock ./
RUN uv sync --frozen --no-dev --no-install-project   # cached dep layer
COPY <svc>/src ./src
RUN uv sync --frozen --no-dev                        # install the app
# primary backend only: COPY --from=frontend-build /app/dist ./dist
ENV PATH="/app/.venv/bin:$PATH"
USER 1000
CMD ["/app/.venv/bin/<package>"]   # direct venv binary, not `uv run`
```

Copy `pyproject.toml`+`uv.lock` first and `uv sync` before copying source so the
dependency layer caches; `--frozen` so no resolver runs; non-root `USER 1000`;
call the venv binary directly in `CMD` (avoids a `uv run` cache probe at boot).

## Reference instances

- `scribe/shim/` — loopback sidecar (mkb79/audible), `127.0.0.1:3004`, bearer +
  encrypted creds, `API.md` contract.
- `ocular/backend/` — primary backend (picamera2), serves the Svelte SPA +
  `/api` + an MJPEG stream.
