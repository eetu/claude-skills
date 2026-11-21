---
name: changelog
description: How a project's CHANGELOG.md is kept, in every repo — Keep a Changelog 1.1.0 (an [Unreleased] section, `## [X.Y.Z] - YYYY-MM-DD` versions, Added/Changed/Deprecated/Removed/Fixed/Security groups, compare links at the bottom), written for the people who use the software, not the people who build it. An entry is one or two lines of user-visible effect; refactors, tests, CI and the reasons behind a design stay out. Use whenever adding a changelog entry, cutting a release, reviewing a changelog, or tidying or condensing an existing one.
user-invocable: true
---

> The reader is deciding whether to upgrade and what changes for them. They scan
> the section once, often as release notes on the forge. Every line answers
> "what is different for me?"; [[brevity]] decides how few words that takes and
> [[no-iteration-narration]] keeps the work's own path out of it.

# changelog

## Structure (Keep a Changelog 1.1.0)

```markdown
# Changelog

Notable changes to acme. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and acme uses
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- `acme feed add <url>` installs from private package feeds.

## [0.4.0] - 2026-11-18

### Changed

- **Breaking:** `acme allow --ttl` is `--for`.

### Fixed

- `acme down` exited 0 when its pull left files out.

[Unreleased]: https://github.com/owner/acme/compare/v0.4.0...HEAD
[0.4.0]: https://github.com/owner/acme/compare/v0.3.2...v0.4.0
```

- Newest first. Groups in the order Added, Changed, Deprecated, Removed, Fixed,
  Security, and only those with entries.
- Work in progress goes under `## [Unreleased]`, in its group, as it lands.
  Cutting a release renames that heading to `## [X.Y.Z] - YYYY-MM-DD` (the tag's
  date), adds the version's compare link and moves `[Unreleased]`'s base. Release
  tooling that extracts a version's section must match this heading; change the
  two together.
- A breaking change goes first in its group, led by `**Breaking:**`, with the new
  name or the way over in the same line. Under 0.y a minor release may break; a
  patch only adds and fixes.
- Links are absolute. Release workflows copy a section onto the forge's release
  page, where a relative link leads nowhere. For detail, link the guide rather
  than write it here.

## What goes in

A change someone outside the project could notice: a command, flag, setting,
default, output, file format, supported platform or runtime, a security fix, or
a bug they could have hit in a released version. Name the thing (`acme feed
add`, `--for`) and say what it does now.

Stays out: refactors, tests, CI, build and dependency changes without a user
effect, internal renames, review rounds, how the work was done and why it had
to be so. Code comments, docs and commit messages hold those.

## An entry

- One line where it fits, two at most; three only for a breaking change and its
  way over.
- The final behaviour. Changed says old → new; Fixed names the symptom a user
  saw, in a few words.
- No example output, no list of every case, no justification unless it changes
  what the user does. One entry per change a user notices: small related fixes
  share one.

## Unreleased is one release

Its entries compare the coming release with the last one. A bug introduced and
fixed before release gets no Fixed entry; a later change to something new in the
same release edits that entry instead of adding one. Each entry reads as the
final design ([[no-iteration-narration]]).

## Keeping it short

Each new entry imitates the one above it, so length only ratchets up. Calibrate
against the shortest good entries, not the latest. Past about fifteen entries in
a section, or entries past two lines, trim: first delete what isn't user-visible,
then shorten ([[brevity]]).

## Tidying an existing changelog

- Dates come from the tags; a section lost in a merge comes back from its tag
  (`git show vX.Y.Z:CHANGELOG.md`).
- Regroup, condense, make links absolute, and drop entries no user would notice.
  Condensing an old release is fine; changing what it contained is not.
- Check the result against the old file entry by entry, so nothing a user could
  notice was dropped.
