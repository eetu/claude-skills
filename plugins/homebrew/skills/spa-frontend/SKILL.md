---
name: spa-frontend
description: The frontend half of a homebrew web app — a Vite-built SPA that the Rust backend embeds and serves, talks to the backend over /api, styled with the halo-design tokens and written in ts-style. Use when building or working on the UI of a sibling app. Defines a framework-agnostic contract (build → embed → proxy → conventions → component/state decomposition); SvelteKit (Svelte) is the default for new apps, with React documented as the legacy-by-inertia alternative for existing apps. Pairs with rust-axum (backend) and sibling-app (assembly).
user-invocable: true
---

> **Priors, not rails — and the framework is explicitly a slot.** For a **new
> app the default is SvelteKit (Svelte)** — unambiguously; scaffold it that way
> unless the user says otherwise. React is legacy-by-inertia: older apps in the
> family use it, but it is _not_ the choice for new work. The stable thing is
> the **contract** below; the framework that fulfills it is swappable. Both
> stacks are verified below — start from the Svelte section for new apps, the
> React section only when extending an existing React app. Keep the contract,
> swap the instantiation, document it here.

# spa-frontend

## The contract (framework-agnostic — this is what's stable)

1. **Build with Vite → `dist/`.** The Rust backend embeds/serves `dist/` with an
   SPA fallback to `index.html` (see `rust-axum`). One origin in prod.
2. **Dev = Vite dev server (`:5173`) + proxy.** `vite.config.ts` `server.proxy`
   maps `/api` and `/status` → the backend bind (`http://localhost:3010`). No
   CORS locally; same-origin in prod. **`/auth` is the oauth2-proxy EDGE route,
   not a backend route** — don't proxy it and don't add a backend `/auth`
   handler; locally `PARTY_OPEN=1` / `DEV_AUTH` bypass forward-auth. See
   `vite.config.ts.example`.
3. **Styling from `halo-design`.** Use the canonical `--halo-*` tokens. How
   they're sourced is framework-specific (and the app's `CLAUDE.md` is
   authoritative — follow it): **Svelte** imports `colors_and_type.css` verbatim
   and reads the vars in `<style>` blocks; **React/Emotion** mirrors the tokens
   into a typed `themes.ts` (the `css` prop can't read CSS vars), derived from the
   shipped canonical `colors_and_type.css` (the source of truth) — or copied from
   a cloned React sibling's `themes.ts` as a shortcut when one exists. That TS
   file is then the in-repo source of truth, not drift. One warm accent, 6px soft
   cards, light/dark via `prefers-color-scheme`.
4. **Code from `ts-style`.** Same eslint-config, prettier, import sort, scripts
   (`dev/build/lint/format/typecheck/validate/preview`).
5. **Data layer = a thin fetch wrapper + cache/revalidate** over the backend's
   JSON. Types hand-written to match the Rust structs (no codegen — see
   `sibling-app`).
6. **Toolchain — yarn (latest), vendored into the repo (no corepack).** Pin + vendor
   with `yarn set version <ver> --yarn-path`: it commits
   `.yarn/releases/yarn-<ver>.cjs` and sets `yarnPath` in `.yarnrc.yml`. The
   `--yarn-path` flag is **required** — modern `yarn set version` only bumps the
   `packageManager` field otherwise (it won't write the binary). The build image
   then invokes `node .yarn/releases/yarn-*.cjs install --immutable` — **no
   corepack, no global yarn, independent of the node version** (node ≥25 dropped
   the bundled corepack; vendoring sidesteps it entirely). Commit the `.cjs`
   (berry's `.gitignore` drops `.yarn/cache`/`install-state` but keeps
   `.yarn/releases`). **Bump** = re-run `set version <newer> --yarn-path` then
   refresh the lockfile with a plain `yarn install` (the bump fails `--immutable`
   until the lock is regenerated); dependabot won't touch the vendored binary.
   Local dev keeps a corepack `yarn` shim that transparently delegates to the
   vendored release, so hooks/CLI still just call `yarn`. CI installs
   `--immutable`.
   **Node** is pinned separately in a `.node-version` file at the frontend root
   (e.g. `26`) — the single source of truth. CI's `setup-node` reads it via
   `node-version-file: frontend/.node-version` (**never** a hardcoded
   `node-version: 24` literal — it silently drifts: dependabot bumps the
   Dockerfile's `node:<v>-alpine` but can't touch a CI literal or
   `.node-version`). The Dockerfile's `frontend-build` `FROM node:<v>-alpine`
   matches the file; bump all three in lockstep. (Vendored yarn is
   node-independent, so this pin is purely for reproducible builds + local-dev
   parity, not a yarn requirement.) A tiny `api.ts`-style module centralizes
   fetches.
7. **Icons + install metadata (every app — don't skip).** Ship a home-screen-
   installable icon set in the Vite static dir (`static/` SvelteKit, `public/`
   React) so iOS/Android installs aren't blank. See the recipe below.

## Component & state decomposition (name the seams in the plan; decompose early)

A route is a **composition root**, not a bucket to grow a monolith in. The plan
for any non-trivial view must name its **component seams** (which blocks become
files) and its **state seams** (what's shared vs local) _up front_ — a plan that
skips this is the actual defect. The failure mode it prevents (learned the hard
way): one `+page.svelte` accretes every overlay, list, toolbar, and the global
keyboard handler until it's ~2000 lines, and every block is welded to the page's
locals. Pulling a block out _then_ means untangling shared state, CSS scoping,
and that shared handler all at once — expensive and error-prone. Decomposing a
grown monolith is far more work than never letting it grow.

- **Extract early — bias toward too-soon.** Creating a component that later gets
  binned is cheap (doubly so with an LLM); a monolith you can't cheaply move a
  block out of is expensive. When a block has one clear responsibility (an
  overlay, a list, a toolbar, a panel), give it a file — don't wait for it to get
  big. Smells that it's overdue: a route component past ~300–400 lines, or a block
  you'd describe with an "and" ("the list _and_ the player"). Priors, not rails —
  but the bias is toward splitting.
- **The seam: data-down / events-up for leaves, a shared store for shared state.**
  A child that only renders what it's handed + reports user intent takes **props**
  (data) + **callback props** (events) — that's a clean leaf, _not_ prop-drilling.
  State that **two or more** components read/write is **hoisted to a store** (a
  `.svelte.ts` rune module — the jotai/`useSettings` equivalent) and read
  directly, never threaded through a shared parent as props. Getting this split
  right is the design; do it before the monolith forms, not after. (Framework
  mechanics: `coding-style:svelte`.)
- **The root owns orchestration + the overlays it opens; it delegates the rest.**
  Stores, the top-level layout, and the modals it controls stay in the route; each
  cohesive block is a child that reads the stores and takes callbacks.
- **Minimize copy-paste across components.** A base or block copied a second time
  (a CSS control base, a derivation, a handler) is the signal to hoist it — to a
  store, a global style (see `coding-style:svelte`), or a shared helper — _before_
  it drifts. Extracting a component that silently left its copy-pasted base behind
  is a classic regression. Duplicate only when the copies are coincidentally alike
  and expected to diverge; don't over-generalize genuinely separate things.
- **Guard before you move.** Before extracting a block that isn't already covered,
  add a thin as-shipped test (Playwright) asserting its behaviour, so the move is
  provably behaviour-preserving. Cheap insurance — see Testing.

## Icons & PWA metadata (how to create + regenerate)

Touch devices need a real PNG `apple-touch-icon` (iOS ignores SVG favicons for
the home screen) plus a web manifest for Android/PWA install. The house setup
(the shipped `gen-icons.sh` + manifest examples are the starting point; a cloned
sibling app's `frontend` is an optional fuller example):

- **Square, never pre-rounded (the #1 rule).** The icon frame is a _full-bleed
  square_ on an opaque bg — **no rounded corners baked in** (no `rx` on the
  background `rect`, no transparent corners). iOS and Android round home-screen /
  PWA icons _themselves_; a pre-rounded source gets double-masked (a smaller
  squircle with gaps / odd corners). Let the OS round. The browser-tab favicon is
  square too — browsers don't round, and a square reads fine at tab size.
- **One source SVG** (committed, hand-edited — the per-app glyph from the design
  skill, on an _opaque_ square bg, `rx` omitted): `favicon.svg`, a full-bleed
  square glyph. It's the SVG favicon **and** the raster source for every PNG,
  including the maskable one — no separate `icon-maskable.svg`; the script derives
  it by compositing the glyph at ~80% onto a full-bleed bg (Android's adaptive
  mask can't clip the safe zone).
- **Generated PNGs** (committed, so the build needs no rasterizer) via
  `scripts/gen-icons.sh` (ship `gen-icons.sh.example`) using **librsvg +
  ImageMagick** (`brew install librsvg imagemagick` — apple-touch / maskable steps
  pipe through `magick`). It writes `icon-192.png`, `icon-512.png`,
  `apple-touch-icon.png` (opaque, alpha off — Apple guidance), and
  `icon-maskable-512.png`. Rerun after editing `favicon.svg`; copy the script
  forward verbatim.
- **`manifest.webmanifest`** (ship `manifest.webmanifest.example`): `name`,
  `short_name`, `description`, `display: standalone`, `start_url` + `scope` both
  `/`, `background_color` + `theme_color` (`--halo-body`), and `icons` — the two
  `purpose: "any"` PNGs (192/512) plus one `purpose: "maskable"` (512).
- **HTML head** (`app.html` for SvelteKit, `index.html` for React/Vite — same
  tags): `icon` (svg + the 192px png fallback), `apple-touch-icon`, `manifest`, `theme-color`
  (light + dark via `media`), `mobile-web-app-capable` +
  `apple-mobile-web-app-capable`, `apple-mobile-web-app-title`, and the
  `viewport-fit=cover` viewport tag (below). Copy the shipped `app.html.example`
  forward. Don't put these in a component `<svelte:head>` — keep them in the static
  HTML shell so they're present pre-hydration.

### iOS full-height & safe areas (the standalone-PWA traps)

An installed PWA runs full-screen with no browser chrome, so the layout owns the
whole display — including the notch and the home-indicator gesture area. Get these
wrong and the app shows a dead band at the bottom. Learned the hard way, and
**verified on a physical device** (the simulator does not reproduce this — always
test the installed shortcut on real hardware):

- **`viewport-fit=cover` is mandatory, not optional.**
  `<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">`.
  It's what extends the page edge-to-edge under the notch/home-indicator **and**
  what makes `env(safe-area-inset-*)` resolve to non-zero — without it the insets
  are all `0` and your safe-area padding silently does nothing.
- **Full height: `100vh` when standalone, `100dvh` in a browser tab. This is the
  crux, and it's counterintuitive.** In an installed iOS PWA the _dynamic_
  viewport (`100dvh`, and `window.innerHeight`) is **stale at cold start** — iOS
  doesn't compute it until the viewport is "exercised" by a geometry change, so it
  resolves _short_ and leaves a blank band at the bottom that only a device rotate
  clears (you can't trigger the recompute from JS — an `innerHeight`→CSS-var mirror
  is stale too; don't try it). `100vh` resolves against the _static_ viewport,
  computed at layout time, so it's correct from launch — and in standalone there's
  no browser chrome, so `100vh` == the full screen (none of the usual "100vh
  overshoots behind the toolbar" problem). A normal browser tab is the opposite:
  there `100vh` hides content behind the collapsing toolbar, so it wants `100dvh`.
  So detect the mode and switch:

  ```js
  // in the root layout, once on mount
  const standalone =
    window.navigator.standalone === true || // iOS-reliable
    window.matchMedia("(display-mode: standalone)").matches; // installed elsewhere
  document.documentElement.classList.toggle("standalone", standalone);
  ```

  ```css
  html,
  body {
    height: 100svh;
    height: 100dvh;
  } /* browser tab */
  html.standalone,
  html.standalone body {
    height: 100vh;
  } /* installed PWA */
  ```

- **Body owns the viewport; scroll an inner element.** Make `body` a non-scrolling
  flex column (`margin: 0; overflow: hidden; display: flex; flex-direction: column`)
  and let an inner `<main>` (`flex: 1; min-height: 0; overflow-y: auto`) be the
  scroll container. Keeps a phantom page scrollbar from appearing behind
  full-screen overlays.
- **Pad off the insets, don't leave gaps.** Top chrome:
  `padding-top: calc(<n>px + env(safe-area-inset-top))` (required —
  `apple-mobile-web-app-status-bar-style: black-translucent` overlays the status
  bar). A **fixed bottom bar** anchors to the true bottom edge and uses
  `padding-bottom: env(safe-area-inset-bottom)` while extending its own
  `background` into that inset — so the bar meets the physical edge with its
  controls lifted above the home indicator (no visible dead strip). Landscape:
  add `env(safe-area-inset-left/right)` too.

## Auto-reload on a new deploy (stale-tab guard)

A sibling ships frontend + backend in **one image**, so a deploy restarts the
backend and (for an in-memory app) wipes its state. A tab left open then runs a
**stale SPA against a newer backend** — protocol drift, dead room/session codes,
failed lazy-chunk imports. Have the SPA notice a new build and reload itself.

- **Trigger = SvelteKit's built-in version poll, NOT a backend semver.** Set
  `kit.version.pollInterval` (e.g. `60_000`) in `svelte.config.js`. SvelteKit's
  `version.name` **defaults to a fresh build timestamp every build**, so it flips
  on every `:main` rebuild. It polls `_app/version.json` and, when the deployed
  name differs from the running one, flips the `updated` store (`$app/state`). The
  root `+layout.svelte` reacts:

  ```js
  import { updated } from "$app/state";
  $effect(() => {
    if (updated.current) location.reload();
  });
  ```

  (SvelteKit already hard-reloads on a post-deploy chunk-load error; this just
  makes it proactive instead of waiting for a failed lazy import.)

- **Why a build-timestamp beats a semver for the co-deployed case.** When the SPA
  and backend ship in **one image**, `/status` or `/api/version` expose the Cargo
  `CARGO_PKG_VERSION`, which only changes on a `v*` tag — a plain `:main` rebuild
  (the usual deploy) doesn't bump it, so a semver poll would miss the common case.
  Use the build-timestamp poll above; keep the version endpoints for display /
  gatus / debugging. If you want a server-side freshness signal, return a
  **per-build id** (build timestamp or git SHA baked in at compile time), not the
  semver.
- **When a semver comparison IS the right signal: an independently-deployed SPA,
  or a shared engine artifact.** The build-timestamp poll assumes co-deployment.
  It's the _wrong_ axis when the SPA and backend ship separately — e.g. the SPA on
  GitHub Pages against a standalone backend — or when the browser runs a **WASM
  build of an engine the backend also links natively** and the two must agree.
  nib is the latter: `nib-core` compiles to both WASM (the browser's editor) and
  native (the backend's op-sync), and they apply the same ops, so a version skew
  is a _compatibility_ problem, not a stale-tab one. There the gate is a **semantic
  engine/protocol version**: have the client compare its bundled version against
  the server's and reload (or warn) on divergence. nib exposes exactly the pieces
  — the SPA knows its WASM `core_version()`, the backend reports `/api/version` →
  `{backend, core}`; a mismatch on `core` means the two engines disagree. Bump
  that version when the wire/engine format changes, not every build.
- **Auto-reload vs a prompt.** A hard `location.reload()` is safe when there's no
  client state to lose — e.g. an in-memory app whose redeploy already wiped the
  server session (dice). If the SPA holds **unsaved** local state, show a quiet
  "new version — tap to reload" affordance instead and let the user pick the
  moment (same `updated.current` signal, gated behind a click).
- **React (legacy):** no built-in `updated` store. Emit a build-id asset (a
  `version.json` you write, or a `<meta name="build">` / `import.meta.env` value)
  and poll-and-compare against the running build; reload on change. Same caveat —
  key it off a per-build id, not the semver.

## React instantiation (current default — verified across the family)

- React + Vite + `@vitejs/plugin-react` + `babel-plugin-react-compiler` (latest).
- **Styling:** `@emotion/react` (CSS-in-JS) — a typed `Theme` in
  `frontend/src/themes.ts` (mirrors `halo-design` tokens); components call
  `useTheme()` and style via the `css={{}}` prop. **Not** tailwind / CSS-modules.
- **Routing:** `@tanstack/react-router` (file-based, `autoCodeSplitting`); single-
  view apps skip the router. `eslint.config.js` then also spreads
  `@tanstack/eslint-plugin-router` `flat/recommended`.
- **Data:** `swr`. **Misc:** `classnames`, `usehooks-ts`.
- Component/handler/type conventions: see `ts-style` (named function components,
  arrow callbacks, `type` props). `Wordmark.tsx` + `themes.ts` are the canonical
  brand/theme files to copy forward.

## Svelte instantiation (shipped — verified stack)

Why chosen: lighter runtime and smaller compiled output (good on a small Pi);
**scoped `<style>` blocks consuming `--halo-*` CSS vars are a more natural fit
for `halo-design` than a CSS-in-JS runtime** — the tokens drop straight in, no
`themes.ts`/Emotion layer. ts-style and the whole contract above still apply
(Svelte is TS-first). Start from the shipped `*.example` files (below); a cloned
sibling Svelte app's `frontend` is an optional fuller example.

- **SvelteKit + Svelte (runes) + Vite** (latest), scaffolded with `npx sv create
  <dir> --template minimal --types ts --no-add-ons`. Runes mode is on by default
  in the generated `svelte.config.js`.
- **Vite config** = `vite.config.ts.example` (the `:5173` server + `/api`,
  `/status` → `:3010` proxy).
- **Adapter = `@sveltejs/adapter-static` in pure-SPA mode** — full config in
  `svelte.config.js.example`. No server logic (no `+*.server.ts` / `+server.ts`).
  Root `src/routes/+layout.ts`: `export const ssr = false; export const prerender = false;`
  - **`pages/assets: 'dist'`** matches the family convention (rust-axum's
    `STATIC_DIR` + the Dockerfile embed `dist/`; SvelteKit's default is `build/`).
  - **`fallback: 'index.html'`** (not the docs' `200.html`): in pure-SPA mode
    adapter-static emits ONLY the fallback file, and the backend serves
    `index.html` for `/` and every unmatched path. Naming the fallback
    `index.html` makes the two line up with no backend change. **Backend note:**
    tower-http `ServeDir.not_found_service` leaks a 404 status onto client
    routes — the backend instead serves the SPA via a small fs handler
    (200 + content-type + path-traversal guard). See rust-axum.

- **Styling:** import the `--halo-*` token CSS globally once in the root
  `+layout.svelte` (copied verbatim from `colors_and_type.css` to
  `src/lib/styles/halo.css`, or — in a monorepo — re-exported from a shared
  design package, e.g. `import "@scene/design/halo.css"`); use `--halo-*` in
  component `<style>` blocks. No `themes.ts`/Emotion layer (that's React-only).
- **Data:** the same thin `api.ts` fetch wrapper (types hand-mirrored from the
  Rust structs — see `api.ts.example`) + a `createResource()` rune helper in a
  `.svelte.ts` module (poll/SWR-ish: reactive `data/error/loading`,
  started/stopped from an `$effect` — see `createResource.svelte.ts.example`).
  No `swr`.
- **Routing:** SvelteKit file-based routes. Single-view apps just use `+page.svelte`.
- **Lint/format:** use the shared **`@anarkisti/eslint-config/svelte`** preset
  (the published npm package — a factory, since it needs your
  `svelte.config.js`):
  `import svelte from "@anarkisti/eslint-config/svelte"; import svelteConfig from
"./svelte.config.js"; export default svelte(svelteConfig);` (see
  `eslint.config.js.example`). It bundles `eslint-plugin-svelte` recommended +
  prettier + the TS parser wiring. Prettier needs `prettier-plugin-svelte`,
  which **requires a minimal `.prettierrc`** to load it (see
  `coding-style:svelte`'s `prettierrc.example`); `typecheck` = `svelte-check`
  (not `tsc`). Scripts otherwise identical
  (`dev/build/lint/format/typecheck/validate`). See `coding-style:svelte` for
  the `.svelte` conventions.

Dockerfile/CI deltas vs React: **none of substance** — the `frontend-build`
stage is still just `yarn build`, and CI's frontend job runs the same
`lint/format/typecheck/build` (+ `test`, see below). Only `typecheck` resolves to
`svelte-check`.

## Testing (frontend)

Tiers + placement are cross-cutting → **sibling-app → Testing**. The frontend's
tools:

- **vitest**, two projects in one config, split by filename:
  - **unit** — `*.test.ts` → node env. Pure logic, stores, the api layer, a state
    machine. Fast, no browser.
  - **browser** — `*.svelte.test.ts` → **real headless chromium** via
    `@vitest/browser-playwright` + `vitest-browser-svelte` (React:
    `vitest-browser-react`). Component render + anything needing a real DOM / WebGL
    / canvas jsdom can't do. Lighter than a full-app Playwright run.
  - Co-locate both in `__tests__/` next to the source. CI's frontend job installs
    chromium once and runs `yarn test` (both projects, across the workspace).
- **File naming — `Foo.svelte.test.ts`** (Svelte's port of React's `Foo.test.tsx`).
  A test can't _be_ a `.svelte` file (that's a component the compiler owns), so
  `.svelte` becomes a name segment — and it's load-bearing: SvelteKit's vitest
  setup routes `*.svelte.{test,spec}.ts` into the browser (DOM) project and plain
  `*.{test,spec}.ts` into the node project. (It ends in `.test.ts`, so it isn't
  mistaken for a `*.svelte.ts` rune module.)
- **Playwright** = the full built app in a real browser: reserve it for **e2e**
  (real SPA ↔ real backend) and for **as-shipped guards** (below).

**Two fidelity floors pick vitest-vs-Playwright, independent of the tier:**

- _Needs a real browser?_ AudioWorklet / WebGL / real layout ⇒ vitest **browser**
  mode (or Playwright), never node/jsdom.
- _Needs the real shipped build?_ Bundling / asset-path / growable-ArrayBuffer-class
  regressions only reproduce against `vite build && preview` ⇒ **Playwright**.

_Example — WASM:_ pure decode/compute → **node unit** (WASM runs in node); WASM in
a live audio graph (AudioWorklet) → vitest **browser** integration; "plays as
shipped" → **Playwright** against the built bundle.

## Starter files

Canonical SvelteKit templates ship beside this SKILL.md — copy each forward,
rename off `.example`, and replace `<app>`/placeholder types with the real ones:

- `app.html.example` — the static SvelteKit shell: `viewport-fit=cover` viewport,
  PWA/apple-touch meta, per-scheme `theme-color` (see the iOS full-height notes above).
- `manifest.webmanifest.example` — the PWA manifest (`standalone`, icons any + maskable).
- `gen-icons.sh.example` — regenerate the icon PNGs from `favicon.svg` (librsvg + magick).
- `vite.config.ts.example` — `:5173` dev server + `/api`,`/status` → `:3010` proxy.
- `svelte.config.js.example` — adapter-static, `pages/assets: dist`,
  `fallback: index.html`.
- `eslint.config.js.example` — the `@anarkisti/eslint-config/svelte` factory spread.
- `api.ts.example` — the thin fetch wrapper (`ApiError` + `request<T>` + `api` object).
- `createResource.svelte.ts.example` — the rune resource helper (reactive
  `data/error/loading`, `start()`/`stop()` driven from an `$effect`, optional poll).

The `.prettierrc` (required to load `prettier-plugin-svelte`) and the `.svelte`
code conventions live in `coding-style:svelte`. Icons: see the recipe above.
