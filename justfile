# claude-skills task runner. `just` with no args lists recipes.
#
# Yarn = the repo-vendored release pinned by `yarnPath` in .yarnrc.yml, run via
# node. No global yarn / corepack needed (recipes run under sh, which can't see a
# shell yarn function), and it auto-tracks `yarn set version` bumps.
yarn := "node " + (justfile_directory() / `awk '/^yarnPath:/{print $2}' .yarnrc.yml`)

default:
    @just --list

# Install JS dev deps (prettier + markdownlint).
install:
    {{yarn}} install

# All pre-commit checks: prettier --check, markdownlint, skill validation.
check: format lint validate

# Prettier formatting check.
format:
    {{yarn}} format

# Markdown lint.
lint:
    {{yarn}} lint

# Validate skill JSON + SKILL.md frontmatter.
validate:
    {{yarn}} validate:skills

# Auto-fix formatting + markdown.
fix:
    {{yarn}} format:fix
    {{yarn}} lint:fix
