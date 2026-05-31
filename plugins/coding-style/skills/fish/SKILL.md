---
name: fish
description: Eetu's default shell is fish (not bash/zsh). Use when running shell commands, writing setup/install scripts, or pasting "run this" snippets for his machines — bash/POSIX-assuming commands silently or loudly break under fish. Covers the real gotchas (unmatched globs error instead of passing literal, no export, no { } grouping, no () subshells, command-substitution syntax) and the escape hatch: wrap any POSIX-only snippet in bash -c.
user-invocable: true
---

> **Facts, verify on surprise.** Behavior below holds for fish 3.x / 4.x. fish
> evolves (e.g. `$(...)` and `&&` were added over time) — if a command behaves
> unexpectedly, check `fish --version` and `help` rather than assuming. When in
> doubt, use the bash escape hatch at the bottom.

# fish

The default interactive + command shell on Eetu's machines is **fish**. The
Claude Code Bash tool runs commands through it. Most bash works, but a handful of
POSIX-isms break — these cause the majority of "works in the docs, fails here"
moments.

## The gotchas (and fixes)

### 1. Unmatched globs ERROR — they don't pass through (the #1 trap)

Bash passes an unmatched `*.py` literally; **fish aborts the whole command**:

```text
> grep -r --include=*.py foo .
fish: No matches for wildcard '*.py'. See `help expand`.
```

This bites hardest on flags like `grep --include=*.ext`, `find ... -name *.x`.
**Fix: quote every glob meant for a program, not the filesystem:**

```fish
grep -r --include="*.py" foo .        # quoted → passed literally to grep
find . -name "*.tmp"
```

### 2. No `export` — use `set`

```fish
set -gx VAR value     # export (global). plain `export VAR=value` fails
set -e VAR            # unset
set -gx BW_SESSION (bw unlock --raw)
```

Inline per-command env **does** work (fish 3.1+): `PAGER=cat git log`.

### 3. Command substitution: `(cmd)`, not `` `cmd` ``

fish uses parentheses: `set d (mktemp -d)`. `$(cmd)` also works on fish 3.4+;
backticks never do.

### 4. No `{ ...; }` grouping, no `()` subshells

```fish
begin; cmd1; cmd2; end | less     # grouping
```

`( ... )` does not spawn a subshell in fish. For real isolation use `set -l` or
`fish -c '...'` / `bash -c '...'`.

### 5. Loops / conditionals use `end`, not `do/done`/`fi`

```fish
for f in a b c; echo $f; end
if test -f file; echo yes; end
```

### 6. Works fine

`&&`, `||`, `!`, pipes, `>`/`2>`/`&>`, `~`, `$var`, brace expansion `{a,b}`.
(fish has no word-splitting, so unquoted `$var` is safer than in bash — but quote
anyway for clarity.)

## Escape hatch: when a snippet is POSIX-only, wrap it

Heredocs, `export`, process substitution `<(...)`, `${VAR:-default}`, C-style
`for ((;;))`, arrays, and most copy-pasted install scripts assume bash. Don't
port them line-by-line — run them in bash:

```fish
bash -c 'set -euo pipefail; for i in 1 2 3; do echo "$i"; done'
bash <<'EOF'
  cat <<INNER > /tmp/x
  heredoc content
  INNER
EOF
```

Rule of thumb: **authoring a fish-native command → mind §1–5; pasting an existing
bash/POSIX script → `bash -c` it** instead of translating. For setup docs aimed
at Eetu, prefer fish syntax (`set -gx` not `export`) or explicitly say "run under
bash".

## Note for setup/installer instructions

Upstream "run this" snippets (`export X=…`, `curl … | bash`, `VAR=… ./script`)
are bash. Either tell the user to run them in `bash`, or translate the env-var
and grouping parts to fish. The `curl … | bash` form is already fine (it pipes
into bash explicitly).
