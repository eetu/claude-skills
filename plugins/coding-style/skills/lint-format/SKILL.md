---
name: lint-format
description: Language-agnostic rule for tooling on every project — always wire up the standard formatter and linter for the language, run with defaults unless a project rule overrides, and keep the build at zero warnings (fix the code, or disable narrowly with a stated reason). Use when starting a project, adding files in a new language, or reviewing any code in any language (TS, Python, Rust, Go, shell, etc.). Language-specific configs layer on top — e.g. ts-style pins eslint+prettier via eslint-config. Ships an example .editorconfig (spaces, cross-language indentation/line-width) to copy into new repos.
user-invocable: true
---

> **Default, then specialize.** This is the floor for every language. A
> language-specific skill (e.g. [[ts-style]]) may pin exact tools, configs, and
> conventions on top — when one exists, it wins on the specifics. This skill
> still governs the _posture_: tooling present, defaults unless overridden, zero
> warnings.

# lint-format

## Always wire up a formatter and a linter

Every project gets the language's standard auto-formatter **and** linter, run as
part of the normal check (a `validate` / `check` / CI step). No project ships
without them. Use the de-facto community tool unless a project rule says
otherwise:

- **TS/JS** — eslint + prettier (here: pinned by `eslint-config`, see
  [[ts-style]])
- **Python** — ruff (format + lint)
- **Rust** — `cargo fmt` + `cargo clippy`
- **Go** — `gofmt`/`goimports` + `go vet`
- **Shell** — `shfmt` + `shellcheck`

Don't hand-fight the formatter, don't reorder/realign by hand — run the tool.

## New project: prefer the latest of every dependency

When scaffolding a new app, take the **latest release** of every dependency and
tool — language runtime, framework, libraries, formatter/linter. Don't seed a
new repo with versions copied from an older sibling; start current and let the
lockfile pin. (Existing projects bump deliberately, on their own cadence.) These
skills name _preferred libraries_ but deliberately avoid version numbers —
"latest" is the version.

## Use defaults unless a rule overrides

Adopt each tool's **default config**. Don't author a custom rc, tweak rule
severities, or fiddle line-length/quote-style for taste. Configure only when a
real project requirement forces it (a pinned shared config, a framework plugin,
a genuine incompatibility) — and prefer a shared/inherited config over a
per-project one so the whole fleet moves together. Less local config = more
boring, more uniform diffs.

## One `.editorconfig` for cross-tool basics

Indentation, line width, and newline/charset hygiene aren't per-tool taste —
they're shared facts every editor and formatter should agree on. Declare them
once in a root **`.editorconfig`** instead of scattering `useTabs`/`printWidth`
across each tool's rc. Prettier reads `.editorconfig` for `indent_style`,
`indent_size`/`tab_width`, `max_line_length`, and `end_of_line`; editors read it
natively; rustfmt/gofmt ignore it but already match it.

- **Spaces, not tabs** — except where a tool _requires_ tabs (Go/gofmt, Makefile
  recipes). YAML forbids tabs outright; never override it to tabs.
- It's the **single sanctioned place** for the rare width override the section
  above allows — change it here once and fleet-wide tools follow.
- A per-tool rc then carries **only what `.editorconfig` can't express** — e.g.
  `.prettierrc` holds just plugins (`prettier-plugin-svelte`) + parser overrides,
  not indent/width/quote style (formatting stays delegated to tooling, see
  [[ts-style]]).

Copy `editorconfig.example` to the repo root as `.editorconfig` and trim the
language blocks you don't need.

## Zero warnings — fix or justify, never leave dangling

The check must pass clean: **every warning gets resolved before the change
lands.** A warning left in place is noise that trains everyone to ignore the
next one. Two ways to resolve, in order of preference:

1. **Fix the code** so the rule is satisfied — the default. The rule is usually
   right; the warning points at something real.
2. **Disable the rule inline** — but _only_ when silencing is strictly better
   than the workaround the rule would otherwise force. Sometimes the
   rule-satisfying version is genuinely worse code (more indirection, a wrong
   abstraction, a needless cast). When so, disable rather than contort.

When you disable, do it narrowly and say why — scoped to the single line, the
specific rule (never a bare/file-wide disable), always with a reason:

```ts
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- third-party
// type is wrong upstream; cast is the seam, not a habit.
const parsed = raw as any;
```

```python
x = compute()  # noqa: E731 -- assignment-as-lambda is clearer than a def here
```

No reason → treat as a fix-the-code case. If the same disable recurs, the rule
is mis-tuned: change it in the shared config, don't scatter disables across the
fleet.
