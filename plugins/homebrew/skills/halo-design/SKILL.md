---
name: halo-design
description: The shared visual identity for eetu's homebrew web apps — Inter + Space Grotesk type, a single warm orange accent, soft 6px cards, light/dark via prefers-color-scheme. Use whenever building or styling a new personal/self-hosted web app, including throwaway static HTML mockups and docs pages. Provides canonical design tokens (colors_and_type.css), wordmark + glyph conventions, and a recipe for per-app design skills that layer glyph/voice/layout on top.
user-invocable: true
---

> **Priors, not rails.** This skill records the _why_ behind the house look.
> Fonts, accent, and the card/wordmark conventions are deliberately stable so
> the family stays recognizable — don't churn them on a whim. But everything
> else is open: new layouts, components, motion, and libraries are welcome, and
> if a token genuinely reads better tweaked today, propose it (and update the
> canonical css so the whole family moves together). Recognizability is the
> goal; the specific values serve it.

# halo-design — the homebrew family look

One visual language across every self-hosted app in the family — canonical
tokens use the `--halo-*` prefix (halo is the family origin). A person who's
used one should instantly recognize the next. Only four things differ per app:
the **wordmark glyph**, the **wordmark text**, the **layout/density**, and the
**voice**.

If invoked with no concrete task, ask what the user wants to build or design,
ask a couple of questions, then act as an expert designer — output static HTML
artifacts _or_ production code as appropriate.

## Files in this skill

- `colors_and_type.css` — **canonical tokens**. The source of truth. Copy
  verbatim into a new project. Light + dark, fonts, geometry, shadow, motion,
  plus `.halo-wordmark` / `.halo-card` primitives.
- `assets/halo-logo.svg`, `assets/halo-wordmark.svg` — halo's ring glyph, the
  reference example of the glyph convention (see below).
- `assets/mermaid-halo.md` — the family theme for **Mermaid diagrams** (light +
  dark init blocks, accent classes, optional card-shadow CSS). Use for any
  diagram in a sibling app's docs (see below).

## The tokens (summary — `colors_and_type.css` is authoritative)

- **Type.** Inter (body, numerals, wordmark; weights 300–700) + Space Grotesk
  (section labels, nav, counters; 400–600).
- **Color.** Monochrome greys + **one** saturated accent: warm orange
  `#f78f08`. The accent means "alive" — active state, lit, warm trend, focus.
  Everything else is grey. Optional domain hues (warm/cool/etc) only when data
  demands them.
- **Geometry.** `--halo-radius: 6px`. Cards: 6px radius + soft shadow in light;
  **shadow off in dark** (cards read via bg-vs-body contrast there). Card
  elevation is the shadow — **never a border on the card edge** (a border muddies
  the light-mode float; borders are for internal hairlines only).
- **Theme.** Light default; dark via `@media (prefers-color-scheme: dark)`.
  (halo also supports an explicit `[data-theme]` toggle — add only if needed.)
- **Icons.** [Lucide](https://lucide.dev) — the house icon set. No emoji, no
  hero imagery. Install the framework pack (Svelte: `@lucide/svelte`, React:
  `lucide-react`) and import per-icon for tree-shaking
  (`import RotateCw from "@lucide/svelte/icons/rotate-cw"`). Icons stroke in
  `currentColor`, so they inherit text colour — size ~18px inline, default
  stroke. (Was Material Icons Outlined; migrate on next touch.)
- **Motion.** Calm, with small wow moments: 150ms reveals, gentle pulses,
  counters that ease to new values. Restraint over flourish.

## Wordmark

`.halo-wordmark` is the canonical primitive (defined in `colors_and_type.css`)
and every app renders through it: **Inter (`--halo-font-body`) 600, lowercase,
`letter-spacing: -0.04em`, `white-space: nowrap`**, the app name in
`--halo-text-main` followed by **exactly one** accent element — a trailing period
`<span class="accent">.</span>` in `--halo-accent`.

House convention: the full wordmark is a short, dry pop-culture riff ending in
the app's own name (the riff is a muted weight-400 prefix in `--halo-text-muted`),
and it **collapses to the bare app name** (+ accent dot) below the mobile
breakpoint. The brand reads in the same typeface as the app's numerals so brand
and data feel like one system. Each app writes its own; keep it terse and lowercase.

**Sanctioned per-app overrides.** Two axes may deviate, but _only_ when the app's
`<app>-design` skill documents the deviation with a reason — everything else
(lowercase, `-0.04em`, single accent element, mobile collapse) still holds:

- **Font.** Swap `--halo-font-body` for another face when the app's identity calls
  for it — e.g. the scene apps (tracker, party) use an Amiga bitmap font for the
  demoscene look. Do _not_ route the wordmark through `--halo-font-heading` (Space
  Grotesk) by default — that's drift, not a choice.
- **Accent form.** Instead of the trailing period, an app may accent a _genuinely
  clever_ trailing letter-run — one that reveals a real word inside the name (e.g.
  represent → `re`+accent-`present`). Still exactly one accent element. If the
  substring isn't meaningful, use the period (dice is `dice.`, not `di`+`ce`).

Deeper deviations (the whole word in accent, no dot at all) are allowed for a
strong reason but must likewise be documented in the per-app skill — see
tracker/party, whose demoscene title-screen treatment colours the whole word in
`--halo-accent`.

## Glyph

64×64 SVG. The family stroke language:

- `currentColor` strokes so the outline inherits theme text color; the **only**
  hardcoded color is a warm dot `fill="#f78f08"` (the accent centre).
- Stroke weights ~3 (primary outline) and ~2.5 (interior detail), all
  `stroke-linecap: round` / `stroke-linejoin: round`.
- Must read at favicon size.

Reference example: halo = thin ring + warm centre (`assets/halo-logo.svg`, the
glyph shipped in this skill). Other apps follow the same stroke language with
their own motif (a bubble, a book + ripples, etc.); a new app = a new glyph in
the same family.

## Voice

Lowercase, terse, numbers-do-the-talking. No marketing voice, no exclamation
marks, no emoji. Empty states get at most one quiet line. Each app picks a
flavor (e.g. a localized tongue, archival, dry) but the restraint is shared.

## Mermaid diagrams

Any Mermaid diagram in a sibling app's docs uses the family theme:
`assets/mermaid-halo.md` maps the tokens onto Mermaid's `base` theme. Nodes are
cards, subgraphs are `--halo-bg-light` panels, edges are quiet
`--halo-text-muted` grey, and the accent is applied by hand (the
`halo-accent` / `halo-live` classes) to the one thing that's alive — the theme
never sprays it. Paste the light init block into READMEs (the family default);
apps that render diagrams client-side pick light/dark at
`mermaid.initialize` time. Derived from `colors_and_type.css` — when a token
moves there, move it in the Mermaid asset too.

## Two ways to apply

**A. Static HTML** (mockups, docs pages, prototypes): `<link>` or inline
`colors_and_type.css`, use the `--halo-*` vars and `.halo-card` /
`.halo-wordmark` primitives directly. Don't re-derive tokens by hand — that's
how an app once drifted to its own names; copy the canonical file.

**B. React production** (the sibling-app stack): tokens live in
`frontend/src/themes.ts` as a typed Emotion `Theme`; components call
`useTheme()` and style via the `css={{}}` prop (CSS-in-JS — **not** tailwind /
CSS-modules). Here `themes.ts` **is** the in-repo source of truth — `css`-prop
styling can't read `--halo-*` CSS vars, so the tokens are mirrored once into TS
and the CSS file is not shipped. Seed a new React app by **deriving `themes.ts`
from the shipped canonical `colors_and_type.css`** (the CSS is the source of
truth, and React is the legacy path) — or, as a shortcut when a React sibling is
cloned, copy its `themes.ts` verbatim (the app's `CLAUDE.md` says which). Once
seeded, `themes.ts` is the in-repo source; keep it visually in lockstep when the
canonical CSS moves — a TS-token React app is **not** "CSS drift". The per-app
`CLAUDE.md` is authoritative on how its theme is sourced — follow it. See the
`sibling-app` skill for the app skeleton.

## Per-app design skill (the layering recipe)

Each app carries its own `.claude/skills/<app>-design/` (e.g. `<app>-design`).
Because a project skill overrides a same-named
plugin skill and plugin skills are namespaced, these coexist with this shared
one cleanly. A per-app skill should be **thin**:

1. Frontmatter `name: <app>-design`, `user-invocable: true`, description framing
   it as a sibling in the family.
2. Body: "Shared tokens + conventions come from `halo-design` — copy
   `colors_and_type.css` verbatim. Below is this app's delta."
3. The four deltas only: glyph SVG, wordmark text, layout/density, voice.
4. A short "Differences from the family baseline" table.
5. Point at the production source-of-truth files
   (`frontend/src/components/`, `themes.ts`, `Wordmark.tsx`).

Copy an existing per-app skill as a template and swap the four deltas.
