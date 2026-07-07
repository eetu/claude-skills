---
name: svelte
description: Svelte (runes) + SvelteKit house code style for eetu's projects — the .svelte conventions that layer on top of ts-style (which still governs all .ts). Covers runes (state/derived/props/effect), callback-prop events, snippets over slots, scoped styles consuming halo-design tokens, .svelte.ts modules for shared reactive state, keyed each, file-based routing with resolve()/page, and the @anarkisti/eslint-config/svelte preset. Use when writing or reviewing any Svelte/SvelteKit code.
user-invocable: true
---

> **Priors, not rails.** Current house conventions for the Svelte stack.
> Svelte (runes) + SvelteKit, TypeScript-first. If a
> convention fights a better pattern, propose the change to `eslint-config` (the
> `svelte` preset) or this skill so the fleet moves together — don't silently
> diverge. `ts-style` still governs everything inside `<script lang="ts">`; this
> only adds the `.svelte`-specific layer. Pairs with `spa-frontend` (app stack)
> and `halo-design` (tokens).

# svelte

## Stack: Svelte (runes) + SvelteKit, always TypeScript

`<script lang="ts">` always. Runes mode on (the default in a fresh `sv create`).
No legacy reactivity — no `export let`, no `$:`, no `on:` directive, no
`createEventDispatcher`, no stores where a rune fits.

## Tooling does the mechanical work

Lint/format come from **`@anarkisti/eslint-config/svelte`** (the published npm
package — a factory; pass your `svelte.config.js`, see that repo). It composes the node base
(`typescript-eslint` + import-sort + unused-imports + prettier) with
`eslint-plugin-svelte` recommended + prettier. Formatting is **prettier +
`prettier-plugin-svelte`**, which **requires a `.prettierrc`** to load the
plugin — copy the shipped `prettierrc.example` to `.prettierrc`. It holds ONLY
the plugin + the `*.svelte` parser override; formatting/width still come from
the repo `.editorconfig` (100 col). `eslint.config.js` is two lines:

```javascript
import svelte from "@anarkisti/eslint-config/svelte";

import svelteConfig from "./svelte.config.js";

export default svelte(svelteConfig);
```

Scripts mirror ts-style: `lint`, `lint:fix`, `format`, `format:fix`, plus
**`typecheck` = `svelte-check`** (not `tsc`), and `validate` = the three. Never
hand-sort imports or argue layout — run `yarn lint:fix` / `yarn format:fix`.

## The conventions tooling can't enforce

- **Runes for all reactivity.** `$state` for mutable local state, `$derived`
  (or `$derived.by(() => …)` for multi-statement) for computed values, `$props`
  for inputs. Never compute derived values in an `$effect`.
- **`$effect` is for side-effects only** — subscriptions, imperative DOM,
  start/stop of pollers/timers. Return a cleanup function. Don't use it to mirror
  one piece of state into another (that's `$derived`).
- **Props via `$props()` with a `type`** (not `interface`), destructured with
  defaults: `let { systems, compact = false }: Props = $props();`. Local
  `type Props = { … }` for one-offs; a named exported `type` when shared. Type
  `children`/snippets as `Snippet` from `svelte`.
- **One component per `.svelte` file, PascalCase name** (the file _is_ the
  default export — no explicit export needed). Smaller helpers = `const` arrows
  inside `<script>`, per ts-style.
- **Events = callback props**, not dispatchers: accept `onSave`, `onclick` in
  `$props` and call them. Native handlers use the runes-era attribute form
  (`onclick={…}`, no colon).
- **Composition = snippets**, not slots: `{#snippet row(item)}…{/snippet}` +
  `{@render row(x)}`; pass snippets as props (incl. `children`).
- **Always key `{#each}`**: `{#each rows as row (row.id)}` — `svelte/require-each-key`
  is on, and unkeyed lists mis-patch on reorder.
- **Never `{@html}`** unless the value is provably sanitized (`svelte/no-at-html-tags`).
- **Shared reactive state lives in `.svelte.ts` modules** — runes work there too.
  This is the store layer (the jotai/`useSettings` equivalent): the moment **two**
  components read the same state, hoist it here and import it directly — do **not**
  thread it through props or a shared parent. Props are for a leaf's own inputs
  (data to render) + callback props (events up), never for shared state. Export a
  singleton `$state` object, or a factory returning getters
  (`createResource()` → `get data()`/`start()`/`stop()`) for per-instance
  resources; plain non-reactive helpers stay in `.ts`. **Gotcha:** you can't
  `export` a `$derived` from a module (`derived_invalid_export`) — for a memoised
  shared selector, put it as a field on an exported singleton _class_
  (`class V { x = $derived(…) } export const v = new V()`), or export a function
  that returns the computed value.
- **Copy-paste is a design smell, not a shortcut.** A rule or block copied a
  second time (a CSS base, a derivation, a handler) is the signal to hoist it —
  to a store, a global style, or a `.ts` helper — _before_ it drifts (and before
  extracting a component silently leaves its copy behind — a classic regression).
  Duplicate only when the copies are coincidentally alike and expected to diverge;
  don't over-generalize genuinely separate things. Ideals, not rails — when
  unsure, hoist.
- **Styling = scoped `<style>` consuming `--halo-*`** (see `halo-design`). No
  CSS-in-JS, no Tailwind. Scoped styles **don't cross component boundaries**, so
  an app-wide element/utility base (the themed `button`/`select`/`.icon-btn`)
  belongs as **one `:global()` rule in the root `+layout`** — not re-typed in
  every component (it drifts, and an extraction that forgets it silently drops the
  styling); component-specific variants then override the global base on
  specificity. The other global CSS is the one token-file import in the root
  layout. Otherwise keep `:global()` for injected/slotted markup only.

## SvelteKit

- **File-based routing.** Tabs/sections = real routes (`/`, `/cve`), so refresh
  and deep-link both work; the embedding backend serves the SPA fallback.
  Single-view apps just use `+page.svelte`.
- **Pure SPA** when embedded behind a Rust backend (see `spa-frontend`/`rust-axum`):
  `adapter-static`, root `+layout.ts` with `ssr = false; prerender = false`, no
  `+*.server.ts` / `+server.ts`.
- **Internal links via `resolve()`** from `$app/paths`; **active route via the
  `page` rune** from `$app/state` (not the legacy `$app/stores`). This satisfies
  `svelte/no-navigation-without-resolve`.
- **Data** = the same thin `api.ts` fetch wrapper as React apps (types
  hand-mirrored from the Rust structs); poll/cache with a rune resource, not `swr`.

## Reference

Live examples (if cloned): a sibling Svelte app's `frontend/src` — `routes/+layout.svelte`
(tabs/resolve/page), `lib/components/*.svelte` (props/snippets/scoped styles), a
`*.svelte.ts` runes module, `lib/api.ts`. Preset source: the `eslint-config`
repo's `svelte.js`.
