---
name: no-iteration-narration
description: Ban the iteration journey from every written artifact — code comments, documentation, CHANGELOGs, PR descriptions, commit bodies, test names. Applies whenever writing or reviewing any of those. The default failure mode is narrating how the work went ("previously X, now Y", fixing bugs that never shipped, citing the earlier wrong approach); every artifact instead describes the final model as if it had always been the design. The narrow exception: a genuinely counter-intuitive trap worth a warning to the next person, recorded as a fact about the world, not as a story about the session.
user-invocable: true
---

> **Scope.** [[ts-style]] states this rule for TS code comments. This skill is
> the general case: it governs **every prose artifact** in any language —
> comments, docs, README, CHANGELOG, PR/MR descriptions, commit messages, test
> names, memory files. When both are loaded, they agree.

# no-iteration-narration

The iteration path — what was tried first, what was wrong with it, what the fix
fixed, which earlier draft said otherwise — is scaffolding. It comes down when
the work ships. Assistants are strongly biased toward narrating it (it is the
context they just lived through), so treat this as an active check, not a
default you can trust: **before committing any prose, re-read it as someone
with no memory of the session.** Anything that only makes sense with that
memory gets rewritten or deleted.

## The rule

Describe the **final model** — what the thing is, what invariant it keeps, why
it is shaped this way. Never describe the **path** — what it used to be, what
was broken along the way, or the order in which the pieces landed.

A mistake that was made and fixed inside the same unit of work (one session,
one branch, one unreleased version) **never happened** as far as any artifact
is concerned. It was a random draft choice; fixing it erased it.

## Per artifact

- **Code comments** — a constraint, an invariant, a non-obvious why. No
  "previously", no "now", no "the old approach", no reviewer-directed notes
  ("this fixes…", "changed to match…"). If the code can say it, delete the
  comment. ([[ts-style]] § Comments has the TS-specific detail.)
- **Documentation / README** — documents the product as it stands. Never
  "X now does Y" (implies a before that readers may never have seen), never a
  compatibility note for a state that was never released.
- **CHANGELOG** — the one place history _belongs_, but only **released**
  history. A "Fixed" entry must describe a defect a consumer could actually
  have hit in a shipped version. A bug introduced _and_ fixed within the same
  unreleased cycle folds silently into that cycle's "Added"/"Changed" entry —
  no entry, no explanation, no trace. (Same for pulled versions: fold into the
  next release without comment.)
- **PR / MR descriptions** — describe the change against the base branch, as
  one coherent design. Not the intra-branch journey: no "first I did X, then
  review found Y", no fix-commits explained as reactions to earlier commits in
  the same PR. If an intra-PR fix is worth words, squash the story out and
  present the corrected design directly.
- **Commit messages** — each commit states what it changes about the codebase
  and why, in final-model terms. A follow-up commit on the same branch may
  factually say what it corrects (that is what the message is for), but the
  _merged_ artifacts — changelog, docs, comments — must not inherit that story.
- **Test names / test comments** — name the behaviour guaranteed, not the
  incident ("the seam stays out of a severed feature", not "regression: the
  colon bug from Tuesday"). Exception below for released regressions.

## The narrow exception

Some history earns its keep — record it when, and only when, the next person
would plausibly re-make the mistake:

- **A counter-intuitive trap.** The obvious approach was tried, failed for a
  non-obvious reason, and looks attractive enough that someone will try it
  again. Record it as a present-tense fact with the evidence: "caching this
  layer measures 4–7 fps _slower_ than refilling — the blit does not win at
  this fill rate", not "we tried caching and reverted it".
- **Released defects.** Once a bug shipped, it is real history: it gets its
  changelog "Fixed" entry, and a regression test may cite the released version
  ("the 1.3.1 lesson") because users and old checkouts genuinely carry it.
- **Memory / lessons files.** A private note about a hard-won debugging insight
  is fine — that is what memory is for. Keep it out of the shipped artifacts.

The test for the exception: would this sentence still be useful to someone who
never saw the session? If it is only interesting because _we_ happened to trip
on it today, it is journey — drop it.

## Review checklist

Words that almost always mark a violation in shipped prose: "previously",
"no longer", "now correctly", "used to", "instead of the old", "as before",
"went nowhere", "regression" (for anything unreleased), "the earlier
approach", "after review". Grep for them before merging; each hit either
rewrites to a present-tense fact or deletes.
