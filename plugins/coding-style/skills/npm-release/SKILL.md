---
name: npm-release
description: How eetu's npm libraries (@anarkisti/korpi, @anarkisti/dab, @anarkisti/biome-config, @glowbox/*) are versioned and published — a CHANGELOG [Unreleased] line per commit, 0.x semver (patch for additions, minor for a changed interface or output), a publish smoke that installs the packed tarball and typechecks every subpath under nodenext, an annotated v* tag on main, and a release.yaml that publishes over npm trusted publishing (OIDC, no token; provenance only from public repos; skips a version already published; rc dist-tag for prereleases). Covers the npmjs.com trusted-publisher setup and what its E404/E403 errors mean, and moving consumers onto the new version (yarn link first, Yarn's quarantine and npmPreapprovedPackages). Use when releasing a version, setting up publishing for a new package, a release workflow fails, or deciding a version number.
user-invocable: true
---

> **Priors, not rails.** This is the flow korpi, dab, biome-config and glowbox
> publish by. A repo's own CLAUDE.md wins on its specifics (dab lands through a
> PR titled `feat: @anarkisti/dab X.Y.Z — <what>` and keeps no changelog; glowbox
> versions a whole monorepo at once).

# npm-release

## As commits land

- **Each commit adds its line to `CHANGELOG.md`'s `[Unreleased]`**, in the
  [[brevity]] shape (`**name** — facts`). A release is then a date and a number,
  not an archaeology session. The user doesn't release single fixes; a version
  goes out when they ask.
- **The version number, in 0.x**: patch for additions only; minor when an
  exported interface changes or the output does (a changed picture fingerprint
  is a minor). From 1.0, plain semver. A prerelease `X.Y.Z-rc.N` publishes under
  the `rc` dist-tag, so `latest` never moves to it.

## A release

1. Date the `[Unreleased]` section as `## [X.Y.Z] - YYYY-MM-DD`, bump
   `package.json`, commit (`<pkg>: X.Y.Z`).
2. `yarn validate`, `yarn build`, and `yarn smoke` pass locally. The workflow
   runs them again, but a failed publish is a slower way to find out.
3. Tag the commit on main, annotated, and push the tag:
   `git tag -a vX.Y.Z -m "@scope/pkg X.Y.Z"`, `git push origin vX.Y.Z`. A repo that
   lands through PRs tags the squashed commit after the user merges.
4. `npm view @scope/pkg version` shows it in about a minute.
5. Consumers move to the new range (below).

## The publish smoke

`yarn smoke` checks what a consumer gets, not what the repo has: pack the
package, install the tarball into a throwaway project, import every subpath in
bare Node, and typecheck a file importing them all against the shipped `.d.ts`
under `"module"`/`"moduleResolution": "nodenext"` with `skipLibCheck: false`.
It catches what `validate` can't: a file missing from `files`, an `exports` typo,
a DOM touched at import, declarations that don't resolve. `publint --strict` in
`build` covers the manifest.

A shipped `.d.ts` must not name a dependency's types when that dependency's own
declarations break under `nodenext` (glowbox's extensionless relative imports,
eetu/glowbox#139): the consumer's typecheck fails on them. Copy the shape
locally instead; the smoke is what finds it.

## release.yaml

On a `v*` tag, with `permissions: { contents: read, id-token: write }`:

- checkout with `fetch-depth: 0`; check the tag is on main
  (`git merge-base --is-ancestor "$GITHUB_SHA" origin/main`) and equals
  `v` + `package.json`'s version;
- `install --immutable`, `validate`, `smoke`;
- **skip a version already on npm** (`npm view <pkg>@<v> version`), so a rerun
  is safe;
- dist-tag `rc` when the version has a `-`, else `latest`;
- `yarn pack --out pkg.tgz`, then `npm publish pkg.tgz --access public --tag <t>`.
  Yarn packs (it resolves `workspace:^` ranges and runs `prepack`); npm publishes
  (it does the OIDC exchange).

**Trusted publishing** replaces the token. On npmjs.com, each package's settings
name a trusted publisher: the GitHub repo and the workflow file
(`release.yaml`), with publishing allowed. A package's first publish is by hand,
or through an org-level trusted publisher. When it fails:

| error                         | means                                                                 |
| ----------------------------- | --------------------------------------------------------------------- |
| `E404` on publish             | no trusted publisher matches this repo + workflow                     |
| `E403 OIDC permission denied` | the trusted publisher exists but isn't allowed to publish             |
| provenance rejected           | `--provenance` from a private repo; drop it while the repo is private |

`--provenance` is for public repos only (glowbox, dab); korpi is private and
publishes without it.

## Consumers

- **Before the release**, try the change in a consumer with `yarn link ../pkg`
  (dab: `../dab/cli` after its build). Never commit the link; restore
  `package.json` and `yarn.lock` before bumping to the published version.
- **After**, bump the range. Yarn quarantines a fresh release for a day; the
  family's scopes are preapproved in each consumer's `.yarnrc.yml`
  (`npmPreapprovedPackages: ["@anarkisti/*", "@glowbox/*"]`), so a new scope
  needs adding there.
