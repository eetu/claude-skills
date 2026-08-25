---
name: ts-style
description: TypeScript/JavaScript house code style for eetu's projects — enforced by the shared @anarkisti/eslint-config (npm package). Covers the conventions that aren't auto-fixable: named function declarations for components vs const-arrow for callbacks, type over interface, inline type imports, default-export-per-component, nullish/optional-chaining, comment discipline (the final model, never the iteration journey), shipped-prose density (changelogs/commits/PRs: fewer words, same information), and how import sorting + formatting are delegated to tooling. Use when writing or reviewing any TS/JS in any project (frontend, node, scripts) — not tied to any framework or app stack.
user-invocable: true
---

> **Priors, not rails.** These are the current house conventions, enforced by
> `eslint-config`. They keep diffs boring and code uniform. If a convention
> actively fights a better pattern (new language feature, a rule that's aged
> out), propose the change _to the eslint-config repo_ so the whole fleet moves
> together — don't silently diverge in one project.

# ts-style

## Toolchain: yarn (latest) + a pinned node version

**Package manager — always yarn (latest), vendored, never npm/pnpm.** Every
JS/TS project uses **yarn** (latest), pinned **and vendored** into the repo with
`yarn set version <ver> --yarn-path`: it commits `.yarn/releases/yarn-<ver>.cjs`
and sets `yarnPath` in `.yarnrc.yml`. The `--yarn-path` flag is **required** —
modern `yarn set version` only bumps the `packageManager` field otherwise.
**No corepack** — node ≥25 dropped the bundled corepack, so a committed binary is
what makes the toolchain reproducible and node-version-independent. Run scripts
and manage deps with `yarn` — `yarn install`, `yarn add`, `yarn <script>`,
`yarn dlx` (not `npx`). Commit `yarn.lock` and `.yarn/releases/*.cjs` (berry's
`.gitignore` drops `.yarn/cache`/`install-state` but keeps `releases`); CI and
Docker invoke `yarn install --immutable`. Don't mix in `npm`/`pnpm` — a stray
`package-lock.json` is a bug.

**Yarn does not run lifecycle scripts implicitly** (no `prepare`/`postinstall`
on `yarn install` — deliberate, for supply-chain safety). So don't put one-time
setup (e.g. git-hook wiring) in a `prepare` script expecting it to fire; it
won't. Use an explicit, committed-executable `install-hooks.sh` run by hand
after clone (see `sibling-app`).

**Node version — always a `.node-version` file.** Every project (frontend or
node) commits a `.node-version` pinning the node major, set to the **latest**
release. `.node-version` over `.nvmrc` — broadest tool
support (fnm, nodenv, asdf all read it). fnm picks it up on `cd`; CI reads it via
`actions/setup-node` `node-version-file: .node-version` (don't hardcode the
version in the workflow). Bump the file to move the floor; keep it in step with
the Dockerfile's node stage.

## Tooling does the mechanical work — don't hand-fight it

Style is enforced by **`@anarkisti/eslint-config`** — the published npm package
(`"@anarkisti/eslint-config": "^X.Y.Z"`), **not** the legacy
`github:eetu/eslint-config` git dep (those tags are gone, and consuming it as a
git dep also trips a Node `require(esm)` assertion under yarn). Also add
`typescript` + `typescript-eslint` as direct devDeps. Import the matching
preset — `@anarkisti/eslint-config/react`, `/node`, `/svelte`, or `/web` (plain
browser / vanilla-JS, no framework). It composes:

- `@eslint/js` recommended + `typescript-eslint` recommended
- **`simple-import-sort`** — imports/exports auto-sorted (error). Never reorder
  imports by hand; run `yarn lint:fix`.
- **`unused-imports`** — unused _imports_ error; unused _vars_ warn, ignored when
  prefixed `_` (`argsIgnorePattern`/`varsIgnorePattern` = `^_`).
- **prettier** — 2-space, double quotes, semicolons, trailing commas. Line
  width per the repo `.editorconfig` (100; Prettier's bare default is 80 absent
  the file). No rc for plain TS; plugins (e.g. `prettier-plugin-svelte`) need a
  minimal `.prettierrc` — see `lint-format` / `coding-style:svelte`. Run
  `yarn format` / `format:fix`; don't argue layout.

`react` config adds `@eslint-react` recommended-typescript + `react-refresh`.
Per-project `eslint.config.js` is tiny: spread `@anarkisti/eslint-config/react` (and
`@tanstack/eslint-plugin-router` flat/recommended first if the app uses the
router). Scripts: `lint`, `lint:fix`, `format`, `format:fix`, `typecheck`
(`tsc --noEmit`), `validate` (= typecheck + lint + format).

## Zero warnings — TS specifics

The general posture lives in **lint-format**: tooling always present, defaults
unless overridden, `validate` clean before landing, fix-or-disable-with-reason.
Here that floor is concrete: TS/JS tooling is **pinned by `eslint-config`**
(eslint + prettier, versions locked) — that's the project rule that overrides
"community default", so use it, don't bring your own. When you must disable,
scoped `// eslint-disable-next-line <rule> -- reason`; recurring disables mean
the rule is mis-tuned — fix it in `eslint-config` (per the priors note above),
not per-project.

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
- **JSDoc block comments** on non-obvious exported components/functions —
  short, says _why_, not _what_.

## Comments: the final model, never the journey

Comments describe the code **as it is** — a constraint, an invariant, a
non-obvious why. They are read by someone months later with no memory of how
the code got here, so:

- **Never narrate iteration history.** No "previously X, now Y", no discarded
  approaches, no corrections explained ("the earlier model was wrong because…"),
  no session play-by-play. When a first version went off track and was pulled
  back, the comments present the final design as if it had always been the
  design. Git history holds the journey; comments hold the destination.
- **No reviewer-directed commentary.** "This fixes the bug where…" and "changed
  to match the new API" belong in the commit message, not the source.
- **No provenance of working materials.** Don't cite the photo, recording,
  screenshot or conversation that informed a value — state the resulting fact
  (with numbers where they matter). Citable public sources (a spec, a patent,
  Wikipedia) are fine when they genuinely help the next reader.
- **Default to fewer.** If the code can say it, delete the comment. A wrong or
  stale comment is worse than none — and every comment written for the person
  watching the change (rather than the person reading the file) is noise the
  moment it merges.

## Shipped prose: changelogs, commit bodies, PR text

Same discipline, different surface. The goal is **fewer words, same
information** — these are scanned, not read.

- **Changelog entries are `**name** — facts`, one to three lines each**: API
  names, behaviours, defaults, budget/size changes. No design narrative, no
  metaphors, no justification stories — the _why it had to work this way_
  lives in code comments and internal docs, not the changelog.
- **Verbosity compounds across releases.** Each new entry mimics the tone of
  the one above it, so drift only ever ratchets up. Calibrate a new entry
  against the repo's _earliest_ releases, not the latest.
- **One-line release intro.** A release gets a single headline sentence, not a
  paragraph restating the bullets below it.
- Commit bodies and PR descriptions state what changed and its consequence.
  Rationale earns a sentence when a reviewer needs it to judge the diff —
  never a narrative arc.

## Reference

Live examples (if cloned): a sibling app's `frontend/src/components/*.tsx` and
`frontend/src/api.ts`. The eslint-config source: the `eslint-config` repo's
`{node,react}.js`.
