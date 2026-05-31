---
name: lint-format
description: Language-agnostic rule for tooling on every project — always wire up the standard formatter and linter for the language, run with defaults unless a project rule overrides, and keep the build at zero warnings (fix the code, or disable narrowly with a stated reason). Use when starting a project, adding files in a new language, or reviewing any code in any language (TS, Python, Rust, Go, shell, etc.). Language-specific configs layer on top — e.g. ts-style pins eslint+prettier via eslint-config.
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

## Use defaults unless a rule overrides

Adopt each tool's **default config**. Don't author a custom rc, tweak rule
severities, or fiddle line-length/quote-style for taste. Configure only when a
real project requirement forces it (a pinned shared config, a framework plugin,
a genuine incompatibility) — and prefer a shared/inherited config over a
per-project one so the whole fleet moves together. Less local config = more
boring, more uniform diffs.

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
