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
`prettier-plugin-svelte`**. `eslint.config.js` is two lines:

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
  Export a factory returning getters (e.g. `createResource()` exposing
  `get data()`/`start()`/`stop()`); plain non-reactive helpers stay in `.ts`.
- **Styling = scoped `<style>` consuming `--halo-*`** (see `halo-design`). No
  CSS-in-JS, no Tailwind; the only global CSS is the one token-file import in the
  root `+layout.svelte`. Don't reach for `:global()` unless styling injected
  markup.

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

Live examples: a sibling Svelte app's `frontend/src` — `routes/+layout.svelte`
(tabs/resolve/page), `lib/components/*.svelte` (props/snippets/scoped styles), a
`*.svelte.ts` runes module, `lib/api.ts`. Preset source: the `eslint-config`
repo's `svelte.js`.
