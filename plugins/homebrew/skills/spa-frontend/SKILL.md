---
name: spa-frontend
description: The frontend half of a homebrew web app — a Vite-built SPA that the Rust backend embeds and serves, talks to the backend over /api, styled with the halo-design tokens and written in ts-style. Use when building or working on the UI of a sibling app. Defines a framework-agnostic contract (build → embed → proxy → conventions) with React documented as the current default across the family, and Svelte as the shipped, recommended alternative. Pairs with rust-axum (backend) and sibling-app (assembly).
user-invocable: true
---

> **Priors, not rails — and the framework is explicitly a slot.** React is the
> current default by inertia: most apps in the family use it. That is _not_ a
> mandate. The stable thing is the **contract** below; the framework that
> fulfills it is swappable. **Svelte has now shipped** in the family (the
> verified stack is specified below, on par with the React section) and is the
> recommended choice for a new app. Keep the contract, swap the instantiation,
> document it here.

# spa-frontend

## The contract (framework-agnostic — this is what's stable)

1. **Build with Vite → `dist/`.** The Rust backend embeds/serves `dist/` with an
   SPA fallback to `index.html` (see `rust-axum`). One origin in prod.
2. **Dev = Vite dev server + proxy.** `vite.config.ts` `server.proxy` maps
   `/api`, `/auth`, `/status` → the backend port (e.g. `http://localhost:3003`).
   No CORS locally; same-origin in prod.
3. **Styling from `halo-design`.** Use the canonical `--halo-*` tokens. How
   they're sourced is framework-specific (and the app's `CLAUDE.md` is
   authoritative — follow it): **Svelte** imports `colors_and_type.css` verbatim
   and reads the vars in `<style>` blocks; **React/Emotion** mirrors the tokens
   into a typed `themes.ts` (the `css` prop can't read CSS vars), seeded by
   copying a sibling's `themes.ts` — that TS file is then the in-repo source of
   truth, not drift. One warm accent, 6px soft cards, light/dark via
   `prefers-color-scheme`.
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

## Icons & PWA metadata (how to create + regenerate)

Touch devices need a real PNG `apple-touch-icon` (iOS ignores SVG favicons for
the home screen) plus a web manifest for Android/PWA install. The house setup
(reference: a sibling app's `frontend`):

- **Source SVGs** (committed, hand-edited — the per-app glyph from the design
  skill, on an _opaque_ bg):
  - `favicon.svg` — full-bleed glyph: the SVG favicon + raster source for the
    any-purpose / apple-touch icons.
  - `icon-maskable.svg` — same glyph shrunk to the maskable safe zone (~60%
    centre) so Android's adaptive mask can't clip it.
- **Generated PNGs** (committed, so the build needs no rasterizer) via a
  `scripts/gen-icons.sh` using **librsvg** (`brew install librsvg`). Rerun it
  after editing a source SVG; copy the script forward verbatim:

```bash
rsvg-convert -w 180 -h 180 favicon.svg       -o apple-touch-icon.png
rsvg-convert -w 192 -h 192 favicon.svg       -o icon-192.png
rsvg-convert -w 512 -h 512 favicon.svg       -o icon-512.png
rsvg-convert -w 32  -h 32  favicon.svg       -o favicon-32.png
rsvg-convert -w 192 -h 192 icon-maskable.svg -o icon-192-maskable.png
rsvg-convert -w 512 -h 512 icon-maskable.svg -o icon-512-maskable.png
```

- **`manifest.webmanifest`**: `name`, `short_name`, `description`,
  `display: standalone`, `start_url: "/"`, `background_color` (`--halo-body`),
  `theme_color`, and `icons` with both `purpose: "any"` (192/512) and
  `purpose: "maskable"` (192/512).
- **HTML head** (`app.html` for SvelteKit, `index.html` for React/Vite — same
  tags): `icon` (svg + 32px png), `apple-touch-icon`, `manifest`, `theme-color`
  (light + dark via `media`), `mobile-web-app-capable` +
  `apple-mobile-web-app-capable`, `apple-mobile-web-app-title`. `viewport` is
  already in the template. Don't put these in a component `<svelte:head>` — keep
  them in the static HTML shell so they're present pre-hydration.

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
(Svelte is TS-first). Reference: a sibling Svelte app's `frontend`.

- **SvelteKit + Svelte (runes) + Vite** (latest), scaffolded with `npx sv create
  <dir> --template minimal --types ts --no-add-ons`. Runes mode is on by default
  in the generated `svelte.config.js`.
- **Adapter = `@sveltejs/adapter-static` in pure-SPA mode.** No server logic (no
  `+*.server.ts` / `+server.ts`). Config:

  ```js
  adapter: adapter({
    pages: "dist",
    assets: "dist",
    fallback: "index.html",
    strict: true,
  });
  ```

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

- **Styling:** import `colors_and_type.css` globally in `+layout.svelte`
  (copied verbatim to `src/lib/styles/halo.css`); use `--halo-*` in component
  `<style>` blocks. A shared `Panel.svelte` card + `Wordmark.svelte` are the
  copy-forward brand/layout files (vs React's `themes.ts` + `Wordmark.tsx`).
- **Data:** the same thin `api.ts` fetch wrapper (types hand-mirrored from the
  Rust structs) + a `createResource()` rune helper in a `.svelte.ts` module
  (poll/SWR-ish: reactive `data/error/loading`, started/stopped from an
  `$effect`). No `swr`.
- **Routing:** SvelteKit file-based routes. Single-view apps just use `+page.svelte`.
- **Lint/format:** use the shared **`@anarkisti/eslint-config/svelte`** preset
  (the published npm package — a factory, since it needs your
  `svelte.config.js`):
  `import svelte from "@anarkisti/eslint-config/svelte"; import svelteConfig from
"./svelte.config.js"; export default svelte(svelteConfig);`. It bundles
  `eslint-plugin-svelte` recommended + prettier + the TS parser wiring. Prettier
  needs `prettier-plugin-svelte`; `typecheck` = `svelte-check` (not `tsc`).
  Scripts otherwise identical (`dev/build/lint/format/typecheck/validate`). See
  `coding-style:svelte` for the `.svelte` conventions.

Dockerfile/CI deltas vs React: **none of substance** — the `frontend-build`
stage is still just `yarn build`, and CI's frontend job runs the same
`lint/format/typecheck/build`. Only `typecheck` resolves to `svelte-check`.
