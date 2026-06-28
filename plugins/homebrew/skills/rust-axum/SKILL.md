---
name: rust-axum
description: The backend half of a homebrew web app — a Rust axum service that embeds and serves the Vite SPA, fans in upstreams over HTTP/files, and ships as a tiny scratch container. Use when building or working on the Rust backend of a sibling app. Covers structure, deps, config, sqlite, error handling, embedded-SPA serving, plus the house security patterns (CSP, signed cookies, forward-auth trust, fail-closed, constant-time) and the backend test harness (spawned-binary integration + wiremock). Frontend-framework-agnostic — it just serves dist/. Pairs with spa-frontend and sibling-app.
user-invocable: true
---

> **Priors, not rails.** These choices (axum, rusqlite-single-mutex, plain-env
> config) are deliberate and battle-tested for a 1GB Pi. But the crate ecosystem
> moves — if a newer approach is clearly better for a given app (e.g. a real
> connection pool when concurrency demands it, or dropping the DB entirely when
> stateless), take it and note why. The shipped `*.example` files
> (`config.rs`/`lib.rs`/`Cargo.toml`/`e2e_stack`/`bacon.toml`) are canonical and
> self-sufficient; a cloned sibling's backend is an optional fuller example, not
> required. Read one live for a worked example if it's checked out; pin nothing
> from memory — prefer the latest crate versions.

# rust-axum

## Decisions

- **axum** for all new backends. (Some older apps in the family predate it and
  use actix — don't follow them; new work is axum.) The one exception is a
  Python-only domain lib (hardware SDK, vendor client) — then FastAPI, see
  `python-service` (as a loopback sidecar behind axum, or the whole backend).
- **Type sharing = manual.** No ts-rs/typeshare. `#[derive(Serialize,Deserialize)]`
  structs in a `shared` crate (or just `backend`); TS types hand-written to match.
- **SQLite via rusqlite, one `Arc<Mutex<Connection>>`** (no pool/sqlx). WAL mode.
  Idempotent `CREATE TABLE IF NOT EXISTS` migrations every boot; one-shot data
  migrations gated on `PRAGMA user_version`. **Skip the DB entirely if stateless**
  (a pure fan-in dashboard has no durable state).
- **Config = plain `env::var()` → `Config` struct** with `Config::from_env()`. No
  figment/clap/envy. The seam contract (fixed so the frontend + deploy halves
  line up): bind `<APP>_BIND` (default `0.0.0.0:3010`); `dev_auth` from
  `DEV_AUTH=1` OR `<APP>_OPEN=1`; `<APP>_DB_PATH`; `STATIC_DIR` (default
  `./dist`). `<app>` lowercase, `<APP>` the uppercase env prefix. Line width 100
  (set in `.editorconfig`). See `config.rs.example`.
- **SPA served by the binary** (frontend-agnostic — see below).
- **Fail closed:** refuse to boot in prod without required secrets.
- **One service or many.** Default = one backend binary. Split out separate work
  (a long-running worker, a different memory/lifecycle profile) into **another
  crate in the same workspace** — each its own binary, `Config::from_env`, and
  `/status`, sharing `shared/` types and `[workspace.dependencies]` (e.g. a
  media-processing worker). When a library has no Rust equivalent, the sidecar
  lives **outside** the workspace in its own language and is reached over loopback
  HTTP only (e.g. a small Python service wrapping a vendor SDK). Inter-service
  calls authenticate with a shared
  bearer token (constant-time compare, below). The Dockerfile / CI / deploy
  fan-out for multiple images is `sibling-app`'s.

## Structure

```text
Cargo.toml            # [workspace] resolver=2, members + [workspace.dependencies]
backend/
  Cargo.toml
  src/
    main.rs           # one line: <name>_backend::run_server().await
    lib.rs            # run_server(): dotenv → tracing → Config::from_env →
                      #   AppState{Arc<Config>, db?, reqwest::Client} → router → serve
    config.rs         # Config + from_env()
    routes.rs         # Router + CSP layer + SPA fallback
    error.rs          # thiserror AppError → IntoResponse
    db.rs             # rusqlite wrapper (omit if stateless)
shared/               # optional: shared Serialize types
<worker>/             # optional: more service crates, same shape — own
                      #   binary/config/status, share shared/
```

## Starter files

Copy-pasteable skeletons sit beside this SKILL.md — copy each, replace `<app>`
(lowercase) / `<APP>` (uppercase env prefix), strip the placeholder comments,
then split `lib.rs.example` into the per-file modules above as the app grows.
They use the pinned seam contract; don't invent alternative env names.

- `Cargo.toml.example` — workspace skeleton: `[workspace]` (resolver 2, members
  = `backend` + `e2e`) + the `[workspace.dependencies]` table.
- `config.rs.example` — `Config` + `from_env()` (the four contract fields).
- `lib.rs.example` — boot flow (dotenv → tracing → `Config::from_env` →
  `AppState` → router → serve) plus the `serve_spa` handler, `csp_layer()`, and
  the forward-auth `Auth` extractor with the `dev_auth` bypass.
- `e2e_stack.rs.example` — the `Stack::start()` harness (spawn the binary, temp
  SQLite, `DEV_AUTH=1`, poll `/status`, kill on `Drop`).
- `bacon.toml.example` — the backend dev runner used by `just dev` (`default_job
= run`, a `background` run job, `kill_then_restart`, `watch = [".env"]`).

## Deps (preferred crates — take the latest of each)

`[workspace.dependencies]`, latest versions: axum (`macros`,`tokio`,`tracing`);
axum-extra (`cookie`,`cookie-signed`,`typed-header`); tokio (`full`); tower-http
(`fs`,`set-header`,`trace`,`cors`); reqwest (`json`,`rustls-tls`,
`default-features=false`); serde/serde_json; thiserror; anyhow; tracing +
tracing-subscriber (`env-filter`); chrono; uuid (`v4`); url; hex; dotenvy;
mime_guess (the `serve_spa` handler uses it); rusqlite (`bundled`); openidconnect
(only if the app does its own OIDC — usually not, it's behind oauth2-proxy).
dev-deps: `tempfile`, `wiremock`. (`Cargo.toml.example` ships this table.)

## Serving the SPA (frontend-agnostic)

**Do NOT use `ServeDir.not_found_service(ServeFile)`** — it leaks a 404 status
onto every client route (a hard refresh on a sub-route returns 404 with the
shell body). Serve from a `fallback` handler instead: return the built asset if
the path maps to a real file under `static_dir`, else `index.html` with 200 so
the client router owns the route. (A regression we hit the hard way in a sibling
app.)

```rust
Router::new()
    .route("/status", get(status)) /* …api routes… */
    .layer(csp_layer())
    .fallback(get(serve_spa))          // NOT fallback_service(ServeDir…)
    .with_state(state)

async fn serve_spa(State(state): State<AppState>, uri: Uri) -> Response {
    let base = &state.cfg.static_dir;
    let rel = uri.path().trim_start_matches('/');
    if !rel.is_empty() {
        let cand = base.join(rel);
        // canonicalize + starts_with(base) → rejects `..` traversal / escapes
        if let (Ok(c), Ok(b)) = (cand.canonicalize(), base.canonicalize()) {
            if c.starts_with(&b) && c.is_file() {
                if let Ok(bytes) = tokio::fs::read(&c).await {
                    let mime = mime_guess::from_path(&c).first_or_octet_stream();
                    return ([(CONTENT_TYPE, mime.as_ref())], bytes).into_response();
                }
            }
        }
    }
    match tokio::fs::read_to_string(base.join("index.html")).await {
        Ok(html) => Html(html).into_response(),
        Err(_) => (StatusCode::NOT_FOUND, "not found").into_response(),
    }
}
```

Adds a `mime_guess` dep. Serves whatever `dist/` Vite produced — React or
Svelte, no difference here. (The full handler + `csp_layer()` ship in
`lib.rs.example`.)

## Security (house patterns — apply every time)

- **CSP in-code** via `tower_http::set_header::SetResponseHeaderLayer` on all
  responses: `default-src 'self'; script-src 'self'; style-src 'self'
'unsafe-inline' https://fonts.googleapis.com; font-src 'self' data:
https://fonts.gstatic.com; img-src 'self' data: blob:; connect-src 'self';
manifest-src 'self'; frame-ancestors 'none'; base-uri 'self'; object-src 'none';
form-action 'self'`. (`manifest-src 'self'` so the SPA's webmanifest loads —
  spa-frontend ships one.) Extend `img-src`/`media-src` per app. **HSTS /
  X-Frame-Options / X-Content-Type-Options are Traefik's job**, not the
  binary's.
- **Sessions** (only if the app has its own login): `axum-extra` `SignedCookieJar`
  keyed by `SESSION_KEY` (≥64 hex bytes). Cookie `http_only`, `same_site=Lax`,
  `secure` in prod, `path=/`. Tiny payload (`sub|email`). Refuse to boot in prod
  without the key. Most apps skip this — they sit behind oauth2-proxy (see
  `sibling-app` for the edge trust model + `X-Auth-Request-*` headers).
- **Forward-auth gate + the dev bypass.** Behind oauth2-proxy the binary only
  asserts the edge vouched: a `FromRequestParts` `Auth` extractor on every
  `/api/*` handler that 401s unless `X-Auth-Request-User` is present. **This
  check is bypassed when `cfg.dev_auth` is set — `DEV_AUTH=1` (local dev) OR
  `<APP>_OPEN=1` (a LAN-only deploy with no oauth2-proxy).** That single switch
  is the linchpin: it's how `just dev`, the e2e harness, and a LAN deploy all
  reach `/api/*`. `/status` is always unauth.
- **Service-to-service tokens:** load from env, never log. Constant-time compare
  with `subtle::ConstantTimeEq`. Bearer in `Authorization` header only (query
  `?token=` solely where a client can't set headers, and keep those routes out of
  access logs).
- **Unauthenticated liveness:** one `GET /status` (or `/ping`) → `{service,
version, <upstream>_healthy: bool}` — booleans + version only, no secrets. The
  Pi's gatus probes these; keep auth-free (and on a Traefik monitor router that
  bypasses oauth2-proxy if the host is gated).
- **Input:** parameterized SQL (`rusqlite params!`), path-traversal scrub,
  `sanitize_next()` on any `?next=` redirect (block `//host` + absolute URLs).
- Secrets via env only; `.env`, `*.db*`, data dirs in `.gitignore`. Errors via
  `tracing::error!(?err)` — formatted, never raw secret values.

## Tests (this is where the backend test effort goes — frontend has none)

- **Unit:** inline `#[cfg(test)] mod tests` in the source file. `#[test]` for
  sync, `#[tokio::test]` for async. Test pure logic — parsers, sanitizers,
  `Config::from_env`, constant-time compare, migration idempotency.
- **Integration:** a `Stack::start()` harness (a dedicated `e2e` crate is the
  model) that spawns the real binary + temp SQLite (`tempfile::tempdir`) + `DEV_AUTH=1`,
  drives it with a `reqwest` client (`cookie_store(true)`), polls `/status` until
  up, kills children on `Drop`. Tests `#[ignore]`, run in CI via
  `cargo test -p <app>-e2e -- --ignored`. (Harness ships in `e2e_stack.rs.example`.)
- **Mock HTTP upstreams** with `wiremock` (dev-dep) for a fan-in app — stub each
  upstream incl. 500s and assert graceful handling. (When the app spawns real
  sidecars instead, drive those; for an app that fans in third-party HTTP
  upstreams, wiremock is the right call.) Axum handlers are plain async fns — no
  `axum-test`/`tower::oneshot` in the house style.

## Container

Multi-stage, cross-compiled to arm64 with `tonistiigi/xx`, runtime = `scratch` +
binary + `dist` + CA certs. The Dockerfile + CI live in `sibling-app` (they're
app-level, not backend-only).
