# mermaid-halo — the family look for Mermaid diagrams

Halo tokens mapped onto Mermaid's `base` theme, so architecture/sequence/pie
diagrams in any sibling app's docs read as the same system as its UI. Derived
from `colors_and_type.css` (the source of truth) — if a token moves there, move
it here.

The mapping, in family terms:

- **Nodes are cards**: `--halo-bg-main` fill, `--halo-text-main` labels.
  SVG can't cast the halo card shadow, so nodes carry a `--halo-border`
  hairline instead — the documented exception to "no border on a card edge"
  (or use the optional CSS below for the real shadow).
- **Subgraphs are panels**: `--halo-bg-light` on the `--halo-body` canvas.
- **Edges are quiet**: `--halo-text-muted`. Grey does the structure.
- **The accent means "alive"** — one saturated orange, applied by _you_ via
  the classes below to the active/emphasized node or edge, never sprayed by
  the theme itself.
- **Notes are the one warm surface** (`--halo-accent-bg`-ish), like a lit
  annunciator.
- Font is Inter everywhere (`--halo-font-body`); prefer `("rounded")` node
  shapes for the 6px-card feel.

## Paste-ready init — light (the family default)

```text
%%{init: {
  "theme": "base",
  "themeVariables": {
    "fontFamily": "Inter, system-ui, sans-serif",
    "fontSize": "14px",
    "background": "#f0f0f0",
    "mainBkg": "#ffffff",
    "primaryColor": "#ffffff",
    "primaryTextColor": "#525252",
    "primaryBorderColor": "#d3d3d3",
    "secondaryColor": "#fbfbfb",
    "secondaryTextColor": "#525252",
    "secondaryBorderColor": "#d3d3d3",
    "tertiaryColor": "#fbfbfb",
    "tertiaryTextColor": "#525252",
    "tertiaryBorderColor": "#d3d3d3",
    "textColor": "#525252",
    "titleColor": "#525252",
    "lineColor": "#767676",
    "nodeBorder": "#d3d3d3",
    "nodeTextColor": "#525252",
    "clusterBkg": "#fbfbfb",
    "clusterBorder": "#d3d3d3",
    "edgeLabelBackground": "#f0f0f0",
    "noteBkgColor": "#ffedcf",
    "noteTextColor": "#1a1a1a",
    "noteBorderColor": "#ffedcf",
    "errorBkgColor": "#ff6347",
    "errorTextColor": "#1a1a1a",
    "actorBkg": "#ffffff",
    "actorBorder": "#d3d3d3",
    "actorTextColor": "#525252",
    "actorLineColor": "#767676",
    "signalColor": "#525252",
    "signalTextColor": "#525252",
    "labelBoxBkgColor": "#fbfbfb",
    "labelBoxBorderColor": "#d3d3d3",
    "labelTextColor": "#525252",
    "loopTextColor": "#525252",
    "activationBkgColor": "#ffedcf",
    "activationBorderColor": "#f78f08",
    "pie1": "#f78f08",
    "pie2": "#767676",
    "pie3": "#d9d9d9",
    "pie4": "#525252"
  }
}}%%
```

## Paste-ready init — dark

```text
%%{init: {
  "theme": "base",
  "themeVariables": {
    "darkMode": true,
    "fontFamily": "Inter, system-ui, sans-serif",
    "fontSize": "14px",
    "background": "#0f0f0f",
    "mainBkg": "#252525",
    "primaryColor": "#252525",
    "primaryTextColor": "#ededed",
    "primaryBorderColor": "#3a3a3a",
    "secondaryColor": "#1c1c1c",
    "secondaryTextColor": "#ededed",
    "secondaryBorderColor": "#3a3a3a",
    "tertiaryColor": "#1c1c1c",
    "tertiaryTextColor": "#ededed",
    "tertiaryBorderColor": "#3a3a3a",
    "textColor": "#ededed",
    "titleColor": "#ededed",
    "lineColor": "#9c9c9c",
    "nodeBorder": "#3a3a3a",
    "nodeTextColor": "#ededed",
    "clusterBkg": "#1c1c1c",
    "clusterBorder": "#3a3a3a",
    "edgeLabelBackground": "#0f0f0f",
    "noteBkgColor": "#4f3a1f",
    "noteTextColor": "#ededed",
    "noteBorderColor": "#4f3a1f",
    "errorBkgColor": "#ff8a8a",
    "errorTextColor": "#1a1a1a",
    "actorBkg": "#252525",
    "actorBorder": "#3a3a3a",
    "actorTextColor": "#ededed",
    "actorLineColor": "#9c9c9c",
    "signalColor": "#ededed",
    "signalTextColor": "#ededed",
    "labelBoxBkgColor": "#1c1c1c",
    "labelBoxBorderColor": "#3a3a3a",
    "labelTextColor": "#ededed",
    "loopTextColor": "#ededed",
    "activationBkgColor": "#4f3a1f",
    "activationBorderColor": "#f78f08",
    "pie1": "#f78f08",
    "pie2": "#9c9c9c",
    "pie3": "#4a4a4a",
    "pie4": "#ededed"
  }
}}%%
```

(`#4f3a1f` = the accent at 20 % over `--halo-bg-main` dark, i.e. the dark
`--halo-accent-bg`, flattened — Mermaid can't gradient a note.)

## The accent classes (flowcharts)

The theme keeps everything grey on purpose; mark what's alive yourself, once
per diagram:

```text
classDef halo-accent fill:#f78f08,stroke:#f78f08,color:#1a1a1a
classDef halo-live stroke:#f78f08,stroke-width:2px
classDef halo-muted stroke-dasharray:4 3
```

- `halo-accent` — the one node the diagram is about (fill = accent,
  text = `--halo-on-accent`). Use sparingly: one per diagram, like the
  wordmark's single dot.
- `halo-live` — active/current, without shouting (accent ring on a normal
  card).
- `halo-muted` — legends, contracts, meta boxes (dashed hairline; text color
  stays themed so it works in both modes).
- An alive **edge**: `linkStyle <n> stroke:#f78f08,stroke-width:2px`.

## Picking light vs dark

Mermaid init directives can't read `prefers-color-scheme`, so:

- **In-app rendering** (a sibling app rendering diagrams client-side): pick at
  init time —

  ```js
  const dark = matchMedia("(prefers-color-scheme: dark)").matches;
  mermaid.initialize({
    startOnLoad: true,
    theme: "base",
    themeVariables: haloMermaid(dark),
  });
  ```

  (keep the two variable sets above in a `mermaid-halo.ts` next to the app's
  theme tokens; `haloMermaid(dark)` just returns one of them).

- **GitHub READMEs / static docs**: paste the **light** header (the family
  default). White cards on the `#f0f0f0` canvas stay readable on GitHub's dark
  theme too; don't ship two copies of a diagram.

## Optional CSS — the real card shadow

Where the page ships halo CSS anyway (docs pages, in-app), the true card
elevation is available; add this and set `"nodeBorder": "transparent"` /
`"primaryBorderColor": "transparent"` in the light init so elevation is the
shadow, not a border, exactly like `.halo-card`:

```css
.mermaid .node rect,
.mermaid .node polygon,
.mermaid .node circle {
  filter: drop-shadow(rgba(60, 64, 67, 0.3) 0 1px 2px)
    drop-shadow(rgba(60, 64, 67, 0.15) 0 2px 6px);
}
@media (prefers-color-scheme: dark) {
  .mermaid .node rect,
  .mermaid .node polygon,
  .mermaid .node circle {
    filter: none; /* dark cards read via bg-vs-body contrast, like .halo-card */
  }
}
```

## Example

```text
%%{init: { "theme": "base", "themeVariables": { …light block above… } }}%%
flowchart LR
  ui("frontend<br/>Vite SPA") --> api("backend<br/>axum /api")
  api --> db[("sqlite")]
  api -.-> up("upstream")
  classDef halo-live stroke:#f78f08,stroke-width:2px
  class api halo-live
```
