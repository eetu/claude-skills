---
name: spa-frontend
description: The frontend half of a homebrew web app — a Vite-built SPA that the Rust backend embeds and serves, talks to the backend over /api, styled with the halo-design tokens and written in ts-style. Use when building or working on the UI of a sibling app. Defines a framework-agnostic contract (build → embed → proxy → conventions) with React documented as the current default across all 4 apps, and Svelte as the actively-evaluated alternative. Pairs with rust-axum (backend) and sibling-app (assembly).
user-invocable: true
---

> **Priors, not rails — and the framework is explicitly a slot.** React is the
> current default by inertia: four apps (halo, chat, scribe, listen-this) use
> it. That is _not_ a mandate. The stable thing is the **contract** below; the
> framework that fulfills it is swappable. **Svelte has now shipped** in
> raspi-dashboard (the verified stack is specified below, on par with the React
> section) and is the recommended choice for a new app. Keep the contract, swap
> the instantiation, document it here.

# spa-frontend

## The contract (framework-agnostic — this is what's stable)

1. **Build with Vite → `dist/`.** The Rust backend embeds/serves `dist/` with an
   SPA fallback to `index.html` (see `rust-axum`). One origin in prod.
2. **Dev = Vite dev server + proxy.** `vite.config.ts` `server.proxy` maps
   `/api`, `/auth`, `/status` → the backend port (e.g. `http://localhost:3003`).
   No CORS locally; same-origin in prod.
3. **Styling from `halo-design`.** Use the canonical `--halo-*` tokens. Copy
   `colors_and_type.css` in; mirror it into the framework's theme layer. One warm
   accent, 6px soft cards, light/dark via `prefers-color-scheme`.
4. **Code from `ts-style`.** Same eslint-config, prettier, import sort, scripts
   (`dev/build/lint/format/typecheck/validate/preview`).
5. **Data layer = a thin fetch wrapper + cache/revalidate** over the backend's
   JSON. Types hand-written to match the Rust structs (no codegen — see
   `sibling-app`).
6. **Toolchain:** `yarn` 4 (pinned `packageManager`), node 24, CI installs
   `--immutable`. A tiny `api.ts`-style module centralizes fetches.

## React instantiation (current default — verified across the 4 apps)

- React 19 + Vite 8 + `@vitejs/plugin-react` + `babel-plugin-react-compiler`.
- **Styling:** `@emotion/react` (CSS-in-JS) — a typed `Theme` in
  `frontend/src/themes.ts` (mirrors `halo-design` tokens); components call
  `useTheme()` and style via the `css={{}}` prop. **Not** tailwind / CSS-modules.
- **Routing:** `@tanstack/react-router` (file-based, `autoCodeSplitting`); single-
  view apps (halo) skip the router. `eslint.config.js` then also spreads
  `@tanstack/eslint-plugin-router` `flat/recommended`.
- **Data:** `swr`. **Misc:** `classnames`, `usehooks-ts`.
- Component/handler/type conventions: see `ts-style` (named function components,
  arrow callbacks, `type` props). `Wordmark.tsx` + `themes.ts` are the canonical
  brand/theme files to copy forward.

## Svelte instantiation (shipped in raspi-dashboard — verified stack)

Why chosen: lighter runtime and smaller compiled output (good on a Pi 4);
**scoped `<style>` blocks consuming `--halo-*` CSS vars are a more natural fit
for `halo-design` than a CSS-in-JS runtime** — the tokens drop straight in, no
`themes.ts`/Emotion layer. ts-style and the whole contract above still apply
(Svelte is TS-first). Reference app: `../raspi-dashboard/frontend`.

- **SvelteKit 2 + Svelte 5 (runes) + Vite 8**, scaffolded with `npx sv create
  <dir> --template minimal --types ts --no-add-ons`. Runes mode is on by default
  in the generated `svelte.config.js`.
- **Adapter = `@sveltejs/adapter-static` in pure-SPA mode.** No server logic (no
  `+*.server.ts` / `+server.ts`). Config:
  ```js
  adapter: adapter({ pages: 'dist', assets: 'dist', fallback: 'index.html', strict: true })
  ```
  Root `src/routes/+layout.ts`: `export const ssr = false; export const prerender = false;`
  - **`pages/assets: 'dist'`** matches the family convention (rust-axum's
    `STATIC_DIR` + the Dockerfile embed `dist/`; SvelteKit's default is `build/`).
  - **`fallback: 'index.html'`** (not the docs' `200.html`): in pure-SPA mode
    adapter-static emits ONLY the fallback file, and the backend serves
    `index.html` for `/` and every unmatched path. Naming the fallback
    `index.html` makes the two line up with no backend change. **Backend note:**
    tower-http `ServeDir.not_found_service` leaks a 404 status onto client
    routes — raspi-dashboard's backend instead serves the SPA via a small fs
    handler (200 + content-type + path-traversal guard). See rust-axum.
- **Styling:** import `colors_and_type.css` globally in `+layout.svelte`
  (copied verbatim to `src/lib/styles/halo.css`); use `--halo-*` in component
  `<style>` blocks. A shared `Panel.svelte` card + `Wordmark.svelte` are the
  copy-forward brand/layout files (vs React's `themes.ts` + `Wordmark.tsx`).
- **Data:** the same thin `api.ts` fetch wrapper (types hand-mirrored from the
  Rust structs) + a `createResource()` rune helper in a `.svelte.ts` module
  (poll/SWR-ish: reactive `data/error/loading`, started/stopped from an
  `$effect`). No `swr`.
- **Routing:** SvelteKit file-based routes. Single-view apps just use `+page.svelte`.
- **Lint/format deltas (the one real gap):** the shared `eslint-config` has
  `node`/`react` exports but **no Svelte preset**. Layer it: base config +
  `eslint-plugin-svelte` v3 (`...svelte.configs.recommended`) with a `.svelte`
  block setting `parserOptions.parser: ts.parser` + `svelteConfig`. Prettier
  needs `prettier-plugin-svelte`. `typecheck` = `svelte-check` (not `tsc`).
  Scripts otherwise identical (`dev/build/lint/format/typecheck/validate`).

Dockerfile/CI deltas vs React: **none of substance** — the `frontend-build`
stage is still just `yarn build`, and CI's frontend job runs the same
`lint/format/typecheck/build`. Only `typecheck` resolves to `svelte-check`.
