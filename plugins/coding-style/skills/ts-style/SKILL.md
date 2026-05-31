---
name: ts-style
description: TypeScript/JavaScript house code style for eetu's projects — enforced by the shared eslint-config (github:eetu/eslint-config). Covers the conventions that aren't auto-fixable: named function declarations for components vs const-arrow for callbacks, type over interface, inline type imports, default-export-per-component, nullish/optional-chaining, and how import sorting + formatting are delegated to tooling. Use when writing or reviewing any TS/JS in any project (frontend, node, scripts) — not tied to any framework or app stack.
user-invocable: true
---

> **Priors, not rails.** These are the current house conventions, enforced by
> `eslint-config`. They keep diffs boring and code uniform. If a convention
> actively fights a better pattern (new language feature, a rule that's aged
> out), propose the change *to the eslint-config repo* so the whole fleet moves
> together — don't silently diverge in one project.

# ts-style

## Tooling does the mechanical work — don't hand-fight it

Style is enforced by **`eslint-config`** (a git dependency:
`"eslint-config": "github:eetu/eslint-config#vX.Y.Z"`, imported as
`eslint-config/react` or `eslint-config/node`). It composes:

- `@eslint/js` recommended + `typescript-eslint` recommended
- **`simple-import-sort`** — imports/exports auto-sorted (error). Never reorder
  imports by hand; run `yarn lint:fix`.
- **`unused-imports`** — unused *imports* error; unused *vars* warn, ignored when
  prefixed `_` (`argsIgnorePattern`/`varsIgnorePattern` = `^_`).
- **prettier** (defaults, no rc file) — 2-space, double quotes, semicolons,
  trailing commas, ~80 col. Run `yarn format` / `format:fix`; don't argue layout.

`react` config adds `@eslint-react` recommended-typescript + `react-refresh`.
Per-project `eslint.config.js` is tiny: spread `eslint-config/react` (and
`@tanstack/eslint-plugin-router` flat/recommended first if the app uses the
router). Scripts: `lint`, `lint:fix`, `format`, `format:fix`, `typecheck`
(`tsc --noEmit`), `validate` (= typecheck + lint + format).

## The conventions tooling can't enforce

- **Components = named `function` declarations, default-exported, one per file.**
  `export default function AccountRow({ account }: Props) { … }`. **Not** a
  `const Foo = () => …` arrow. The function-declaration form is the component;
  arrows are for everything smaller.
- **Callbacks, handlers, locals, derived values = `const` arrow.** Inside a
  component: `const onRefresh = async () => { … }`, `const label = x ?? y`.
- **Props typed with `type`, not `interface`.** Local `type Props = { … }` for
  one-offs, or a named `type WordmarkProps = { … }` when exported/shared. Use
  `type` over `interface` everywhere unless declaration-merging is genuinely
  needed.
- **Inline type imports:** `import { type Account, api } from "../api"` — keep
  the `type` modifier on the specifier, not a separate `import type` line, when
  mixing values and types from one module.
- **Module-level data = `UPPER_SNAKE` consts**, often `Record<string, T>`:
  `const LOCALE_LABEL: Record<string, string> = { … }`.
- **Reach for `??` and `?.`**, not `||` / manual null guards, for nullish cases.
- **Prefix intentionally-unused bindings with `_`** so the linter stays quiet.
- **JSDoc block comments** on non-obvious exported components/functions (see
  scribe's `Wordmark.tsx`) — short, says *why*, not *what*.

## Reference

Live examples: `../scribe/frontend/src/components/*.tsx`,
`../scribe/frontend/src/api.ts`. The eslint-config source:
`../eslint-config/{node,react}.js`.
