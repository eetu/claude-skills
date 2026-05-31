---
name: halo-design
description: The shared visual identity for eetu's homebrew web apps (halo, chat, scribe, listen-this, and any new one) — Inter + Space Grotesk type, a single warm orange accent, soft 6px cards, light/dark via prefers-color-scheme. Use whenever building or styling a new personal/self-hosted web app, including throwaway static HTML mockups and docs pages. Provides canonical design tokens (colors_and_type.css), wordmark + glyph conventions, and a recipe for per-app design skills that layer glyph/voice/layout on top.
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

One visual language across every self-hosted app: **halo** (the family origin —
canonical tokens use its `--halo-*` prefix), **chat**, **scribe**,
**listen-this**, and whatever comes next. A person who's used one should instantly recognize the
next. Only four things differ per app: the **wordmark glyph**, the **wordmark
text**, the **layout/density**, and the **voice**.

If invoked with no concrete task, ask what the user wants to build or design,
ask a couple of questions, then act as an expert designer — output static HTML
artifacts _or_ production code as appropriate.

## Files in this skill

- `colors_and_type.css` — **canonical tokens**. The source of truth. Copy
  verbatim into a new project. Light + dark, fonts, geometry, shadow, motion,
  plus `.halo-wordmark` / `.halo-card` primitives.
- `assets/halo-logo.svg`, `assets/halo-wordmark.svg` — halo's ring glyph, the
  reference example of the glyph convention (see below).

## The tokens (summary — `colors_and_type.css` is authoritative)

- **Type.** Inter (body, numerals, wordmark; weights 300–700) + Space Grotesk
  (section labels, nav, counters; 400–600).
- **Color.** Monochrome greys + **one** saturated accent: warm orange
  `#f78f08`. The accent means "alive" — active state, lit, warm trend, focus.
  Everything else is grey. Optional domain hues (warm/cool/etc) only when data
  demands them.
- **Geometry.** `--halo-radius: 6px`. Cards: 6px radius + soft shadow in light;
  **shadow off in dark**.
- **Theme.** Light default; dark via `@media (prefers-color-scheme: dark)`.
  (halo also supports an explicit `[data-theme]` toggle — add only if needed.)
- **Icons.** Material Icons Outlined. No emoji. No hero imagery.
- **Motion.** Calm, with small wow moments: 150ms reveals, gentle pulses,
  counters that ease to new values. Restraint over flourish.

## Wordmark

`.hcc-wordmark`: Inter 600, lowercase, `letter-spacing: -0.04em`, with an accent
period/dot. House convention: the full wordmark is a short, dry pop-culture
riff ending in the app's own name, which **collapses to the bare app name** (+
accent dot) below the mobile breakpoint. The brand reads in the same typeface as
the app's numerals so brand and data feel like one system. Each app writes its
own; keep it terse and lowercase.

## Glyph

64×64 SVG. The family stroke language:

- `currentColor` strokes so the outline inherits theme text color; the **only**
  hardcoded color is a warm dot `fill="#f78f08"` (the accent centre).
- Stroke weights ~3 (primary outline) and ~2.5 (interior detail), all
  `stroke-linecap: round` / `stroke-linejoin: round`.
- Must read at favicon size.

Reference examples: halo = thin ring + warm centre (`assets/halo-logo.svg`);
chat = chat bubble + warm centre; scribe = closed-book outline + audio ripples +
warm dot. New app = a new glyph in the same stroke family.

## Voice

Lowercase, terse, numbers-do-the-talking. No marketing voice, no exclamation
marks, no emoji. Empty states get at most one quiet line. Each app picks a
flavor (halo: Finnish; scribe: archival; chat: dry) but the restraint is shared.

## Two ways to apply

**A. Static HTML** (mockups, docs pages like `listen-this/docs/index.html`,
prototypes): `<link>` or inline `colors_and_type.css`, use the `--halo-*` vars and
`.halo-card` / `.halo-wordmark` primitives directly. Don't re-derive tokens by
hand — that's how `listen-this` drifted to its own names; copy the canonical file.

**B. React production** (the sibling-app stack): tokens live in
`frontend/src/themes.ts` as a typed Emotion `Theme`; components call
`useTheme()` and style via the `css={{}}` prop (CSS-in-JS — **not** tailwind /
CSS-modules). Keep `themes.ts` values in lockstep with `colors_and_type.css`.
See the `sibling-app` skill for the app skeleton.

## Per-app design skill (the layering recipe)

Each app carries its own `.claude/skills/<app>-design/` (e.g. `scribe-design`,
`chat-design`, halo's own). Because a project skill overrides a same-named
plugin skill and plugin skills are namespaced, these coexist with this shared
one cleanly. A per-app skill should be **thin**:

1. Frontmatter `name: <app>-design`, `user-invocable: true`, description framing
   it as a sibling in the family.
2. Body: "Shared tokens + conventions come from `halo-design` — copy
   `colors_and_type.css` verbatim. Below is this app's delta."
3. The four deltas only: glyph SVG, wordmark text, layout/density, voice.
4. A short "Differences from halo/chat/scribe" table.
5. Point at the production source-of-truth files
   (`frontend/src/components/`, `themes.ts`, `Wordmark.tsx`).

Copy an existing per-app skill (scribe-design is a good template) and swap the
four deltas.
