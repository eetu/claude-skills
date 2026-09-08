---
name: brevity
description: Language-agnostic rule for every project — a comment, doc line, commit message or PR description must tell the reader something the code does not, or it does not get written. Applies whenever writing or reviewing any prose artifact in any repo. Bans the kinds that carry no information: documenting an absence ("there is no write route"), padding a real point with elaboration, and tests that assert an absence. Also records which anti-verbosity instructions are model-version workarounds, to be deleted rather than accumulated.
user-invocable: true
---

> **Two axes, one habit.** This skill is about whether a line _earns its place_.
> [[no-iteration-narration]] is about whether it describes the _final model_ or
> the path taken. A line can pass one and fail the other; check both.

# brevity

Comments are read far more often than written, and every line that carries no
information dilutes the ones that do. Prose in a PR body or a commit message
reaches reviewers and release notes; prose in a comment is re-read into context
on every later session that touches the file.

Verbosity is partly a model-version trait rather than a preference the code can
fix — see [Model-version workarounds](#model-version-workarounds) below, which
is the part of this skill with an expiry date.

## The test

Before writing a line, ask: **what would a reader get wrong without this?**

If the answer is "nothing", delete it. Not reword it — delete it. Rewording a
zero-information line produces a shorter zero-information line.

## The kinds that never earn their place

- **An absence.** "There is no write route", "position is not configured here",
  "this struct has no lifetime because…". Nobody needs telling that a thing
  which does not exist does not exist. If the absence is load-bearing, say what
  _is_ true: "the refresh loop is the table's only writer".
- **Padding.** A real justification followed by two sentences elaborating it.
  Keep the justification. When trimming, prefer deleting a whole bullet or
  paragraph to shortening every sentence in it.
- **A test that asserts an absence**, or that mostly exercises the framework
  rather than the code under change — asserting a removed route now answers 404
  tests the router.
- **Restating the change.** A line that only makes sense as "this used to be
  different". See [[no-iteration-narration]].

## What does earn its place

- A non-obvious **trap**: "FMI stamps each accumulation at the _end_ of the hour
  it covers, so sun position is taken at the midpoint and the row labelled with
  the start." A reader gets this wrong silently, and no value-level test catches
  it.
- Why a **suspicious constant** has its value — an efficiency floor well above
  the physical figure, a magic timeout, an empirical coefficient.
- A pointer to the **paper or algorithm** a block implements, so the next reader
  can check it against the source rather than re-deriving.
- **Units** on a bare number, and the range a value is expected to hold.
- A **cross-reference** the type system cannot express: which module must change
  in step, which invariant a caller is relied on to have checked.

## Commits and PRs

State what changed, plus the one or two things a reviewer cannot infer from the
diff — a breaking change, a decision with a live alternative, a measured result.
Not a narrative, not a tour of the files, not a restatement of the diffstat.

A verification result is information: keep the numbers, drop the adjectives.

## Review posture

Flag a zero-information comment the way you would flag dead code — same cost
profile. Deleting six lines of comment is a legitimate review outcome on its
own.

The counterweight: this is not a licence to strip the _why_ from a codebase. A
repo whose comments all explain non-obvious constraints is doing it right,
however many there are. The target is noise, not volume.

## Model-version workarounds

**This section has an expiry date. Re-read it on every model upgrade and delete
what is no longer needed.** Anthropic's own guidance is that instructions older
models needed now actively cost tokens and quality — the
[Opus 5 prompting guide](https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/prompting-claude-opus-5)
says to _remove_ verification instructions ("include a final verification
step"), self-correction instructions ("double-check your answer"), and
prompt-side vision workarounds, because the model already does these and the
instructions compound into over-verification. Accumulated anti-verbosity rules
are the same class of debt.

As of Claude Opus 5 (September 2026):

- **Longer output is a documented default, not a bug.** "Claude Opus 5's default
  user-facing responses run longer than prior Opus models'." Prompt for length
  explicitly; it will not fix itself.
- **Effort is the wrong lever.** Effort controls how much the model _thinks_,
  not how much it _says_ — lowering it reduces thinking without reliably
  shortening the visible response.
- **Conversational length and file length are separate surfaces**, each needing
  its own instruction. The one that matters for this skill is the file one:

  > Match the length of written documents to what the task needs: cover the
  > substance, but do not pad with filler sections, redundant summaries, or
  > boilerplate.

- **Positive framing beats prohibition.** Describing the shape you want works
  better than listing what not to do — so state the target, and keep the ban
  list (above) short and concrete.
- **In Claude Code**, the anti-verbosity rules live in the long system-prompt
  preset, which Opus 5 does not get by default; the harness ships a short preset
  instead. `CLAUDE_CODE_SIMPLE_SYSTEM_PROMPT=0` in `~/.claude/settings.json`
  reportedly restores the long one. Community-extracted from the CLI rather than
  documented, so treat it as version-fragile and re-check it after a CLI upgrade.
- **An output style beats a CLAUDE.md rule** for this, because it edits the
  system prompt rather than arriving as one more user-turn line competing with
  everything else already said.

What to delete on the next upgrade: any rule here that the model observably
follows unprompted. Test it by removing the rule and watching one real task,
not by reasoning about whether it should still be needed.
