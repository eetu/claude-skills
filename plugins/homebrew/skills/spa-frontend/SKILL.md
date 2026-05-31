---
name: spa-frontend
description: The frontend half of a homebrew web app — a Vite-built SPA that the Rust backend embeds and serves, talks to the backend over /api, styled with the halo-design tokens and written in ts-style. Use when building or working on the UI of a sibling app. Defines a framework-agnostic contract (build → embed → proxy → conventions) with React documented as the current default across all 4 apps, and Svelte as the actively-evaluated alternative. Pairs with rust-axum (backend) and sibling-app (assembly).
user-invocable: true
---

> **Priors, not rails — and the framework is explicitly a slot.** React is the
> current default by inertia: all four apps (halo, chat, scribe, listen-this)
> use it. That is *not* a mandate. The stable thing is the **contract** below;
> the framework that fulfills it is swappable. Svelte is under active evaluation
> (see below) and may be the better fit going forward — choosing it for a new
> app is encouraged. Keep the contract, swap the instantiation, document it here.

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

## Svelte (under active evaluation — preferred-feeling, not yet shipped)

Why on the table: lighter runtime and smaller compiled output (good on a Pi 4);
**scoped `<style>` blocks consuming `--halo-*` CSS vars are a more natural fit for
`halo-design` than a CSS-in-JS runtime** — the tokens drop straight in. ts-style
and the whole contract above still apply (Svelte is TS-first).

Contract mapping (principle-level — **verify against current docs with
`find-docs` at adoption; don't trust these specifics from memory**):

- Build: Vite + the Svelte plugin → `dist/`. For an embedded SPA, SvelteKit with
  `adapter-static` (SPA/fallback mode) or a plain Svelte+Vite SPA — confirm the
  current adapter story before committing.
- Styling: import `colors_and_type.css` globally; use `--halo-*` in component
  `<style>` blocks. No themes.ts/Emotion layer needed.
- State/data: keep the same fetch wrapper; use runes/stores (or a small SWR-like
  cache) instead of `swr`.
- Routing: SvelteKit routing or a small SPA router.

When the first Svelte app ships, fill this section with the verified concrete
stack (versions, adapter, router) the way the React section is specified, and
note any deltas in `sibling-app`'s Dockerfile/CI (the `frontend-build` stage is
just `yarn build`, so it's largely unaffected).
