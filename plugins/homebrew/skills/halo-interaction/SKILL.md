---
name: halo-interaction
description: The interaction discipline for eetu's homebrew web apps — the behavioural counterpart to halo-design's visual identity. Context-menu policy, keyboard map rules, mouse/gesture vocabulary, floating states, undo semantics, dialogs, status feedback, and what persists across reloads. Use when building any app with a working surface (canvas, list, tree, grid) — a new tool from scratch, or aligning an existing one (nib, dab). Distilled from building dab, where every rule here was first gotten wrong.
user-invocable: true
---

> **Priors, not rails.** These rules exist because breaking them was tried and
> it hurt. Deviate when the app's domain genuinely wants it — but deviate on
> purpose, and say so in the repo's CLAUDE.md, because the value of a family
> discipline is that a person who learned one app can predict the next.

# halo-interaction — how the family's tools behave

halo-design says what an app looks like; this says what it does under the hand.
It applies to any app with a working surface — an editor's canvas, a dashboard's
list, a player's timeline. Examples cite `../dab` (pixel editor, the origin of
most rules) and `../nib` (whose canvas gestures dab follows).

## Context menus — the 1.0 gate

One policy, one sentence: **every row, thumbnail and swatch answers right-click
with the app's shared menu carrying every verb that applies to that thing; every
"⋯" button opens the same items as right-click on its subject; text fields keep
the browser menu; nothing else shows the browser's.**

- **One menu component**, rendered once at the app root, driven by a tiny module
  (`openMenu(event, title, items)` / `closeMenu()`). Never a component per call
  site: only one menu can be open, and it must escape panel clipping.
- **Suppress the browser menu app-wide** at the window level, excepting
  INPUT/TEXTAREA/contenteditable. Half-suppression is worse than none — a user
  who sometimes gets Back/Reload and sometimes your menu stops right-clicking.
- **The text-field exception must actually win.** Any ancestor with its own
  `oncontextmenu` must check the target first, or a number input inside a
  menu-bearing row silently loses paste and spellcheck. (dab shipped this bug
  twice.)
- **Disabled items render greyed with the reason as their hint — never filtered
  out.** An action that vanishes teaches that it doesn't exist; one that greys
  with "this part is borrowed — open X to change it" teaches the model.
- **A menu names its subject** as a heading (the swatch's character, the part's
  path). Four verbs with no subject read as noise.
- **Labels are verbs; hints are facts.** A hint earns its place only carrying a
  size, a count, a character, or the reason an item is grey — never prose
  re-explaining the label ("erase these cells", "an independent copy"). If the
  label needs explaining, fix the label.
- Menus close when the document changes under them, and when a mode opens.

## Keyboard

- **The same key means the same thing everywhere, and keys never stop working
  because of invisible state.** dab's arrows nudged a pixel selection but
  silently stepped frames otherwise, and stopped stepping the moment anything
  was selected — three behaviours, zero cues. Give the secondary meaning its own
  keys instead (`,`/`.` for frames, à la Aseprite).
- **The Escape ladder**, outermost first: close menu → close dialog → abort the
  drag in progress → cancel the mode (rotation, transform) → cancel the floating
  thing (restore what it covered) → deselect. Escape never _commits_ anything.
  One rung per press.
- **Enter confirms the current mode or dialog** — with a guard so Enter on a
  focused Cancel button doesn't confirm.
- Single letters select tools (b/e/g/i/l/r/o/m/v as in dab); ⌘ carries verbs
  (S save, Z/⇧Z undo/redo, A/C/X/V clipboard, B/⌥B/J region toggles as in VS
  Code). Letters don't fire while a dialog is up — **a dialog swallows all
  keys**, or tool switches happen behind the veil.
- Arrows nudge the selected thing (pixels, part, list row); Shift = ×10.
- Delete removes the selected thing when undo can take it back; no confirm.
- Every binding appears in a hover hint somewhere visible. A shortcut only in
  the docs doesn't exist.

## Mouse and gestures

- **Click and drag are different verbs, split by travel**: a press that never
  leaves its cell is a click (pick the shape under it); a press with travel is a
  drag (draw a box). Never a timer.
- **A drag is ONE undo entry** — snapshot on the first point, ride the rest.
  This applies to paint strokes, marquee moves, hue sweeps in a colour picker
  (dab's picker once committed per pointermove and one sweep flushed all 200
  undo slots), and slider scrubs.
- Space-hold pans; wheel zooms toward the cursor; middle-drag pans. A second
  touch aborts the tool gesture rather than finishing it under a pinch.
- ⌥-hold is the quick-pick (eyedropper) over any tool — ⌥, not ⌘, which the
  browser owns.
- Capture the pointer on press (in a try — synthetic events throw), so a stroke
  that leaves the element still ends on it.
- Double-click is a shortcut to the _obvious_ deeper action (open the picker on
  a swatch, rename on a name) — never the only route to it.

## Modes and floating states

- **A mode owns its surface.** While a transform/rotation previews, tools,
  menus and draws on that surface are inert — every one would act on a preview
  about to be rebuilt. Enter applies, Escape cancels, and the controls sit on a
  bar over the surface, not in a dialog: a preview means nothing out of context.
- **Nothing commits while the dial moves.** A mode re-derives its preview from
  the pristine source every time (never from the last preview — repeated
  resampling compounds), so cancel is just letting go, and the whole session at
  the dial is one undo entry.
- **A paste floats**: it sits over what it landed on, moving it restores what it
  covered a step ago, and it bakes on deselect/select-elsewhere/draw. Stamps are
  matte — transparent cells are gaps, never paint.
- **Only states with something to lose get a cue.** dab: a floating paste shows
  accent marching ants (where) + a status-bar chip naming the state with its
  exit verb, "Floating · Drop" (what). A move shows nothing — nothing under it
  can be lost. Cues that cry wolf teach users to ignore cues.
- Opening another document ends every mode and float. A mode holding a stale
  source will replace the new document with a transform of the old one.

## Undo

- **Whole-state snapshots when the state is small** (strings, a few kB): a
  hundred copies cost less than inverse-operation machinery, and nothing drifts.
- One gesture = one entry. Multi-step flows (paste, then shove into place;
  rotate, then shove) share the entry via the float.
- **Never mutate app state outside the snapshot.** dab's rename rewrote
  hidden/shown keys beside the commit, so undoing a rename un-hid the part.
  Everything the snapshot doesn't cover must be derived, or keyed by something
  stable.
- **A reload must be undoable.** Autosave the working draft (on a short timer,
  not per stroke) AND the last on-disk state; offer Revert when they differ.
  Undo lives in memory — without the baseline, reloading is the one gesture
  that makes a change permanent. Revert asks first; it's the one thing undo
  can't take back.

## Selection vocabulary

One word, one meaning, everywhere it is said — canvas, tree rows, thumbnails:

| cue                       | means                                          |
| ------------------------- | ---------------------------------------------- |
| accent border + soft fill | selected / active                              |
| dashed                    | borrowed / referenced (not yours to edit here) |
| marching ants (white)     | marquee — what operations apply to             |
| accent ants + chip        | floating — selected AND not yet yours          |
| hatch texture             | empty placeholder awaiting content             |

Never overload: dab's audit found "dashed" carrying six meanings and "selected"
said five ways. Pick the recipe once, share the CSS. The active-toggle rule:
`active` styling means the FEATURE is on, not that the object is in some state —
an eye button that lights up when the part is _hidden_ reads backwards.

## Dialogs

- **One Modal component** owns veil, focus (first input, else first button),
  Escape=cancel, Enter=confirm-with-button-guard, geometry. Every dialog is
  built on it; hand-rolled veils drift within weeks (dab grew three geometries
  and four copies of the button CSS).
- Dialogs are for questions that block; a bar-over-the-surface is for modes
  that preview; inline editing is for renames. Don't put a preview in a dialog.
- Confirm only what undo cannot take back (Revert, Discard, file deletion).
  Everything undoable acts immediately.
- Native `prompt()`/`confirm()` never — they block the page, break the type,
  and read as the browser interrupting.

## App chrome

- **Settings and help live in the header, rightmost** — a gear and a circled ?,
  after the document verbs (Save is last of those). The status bar's right end
  is for layout furniture (region toggles); the app's own two are not
  furniture. Settings = the few app-level choices (theme auto/dark/light,
  default auto); help = how the tool works, opening itself once on a first
  visit and on ? thereafter.

## Feedback

- A status bar reports outcomes ("saved car.json", "reverted", refusal
  reasons); errors in the error colour, not the muted one; messages clear on
  the next action rather than sitting for an hour.
- **Refusals say why**: a draw on a hidden or borrowed thing sets a status
  message naming the reason, never a silent no-op. Same reason string
  everywhere the same refusal happens.
- Counts and costs are shown before they're paid (dab's rotate bar: "+17
  colours" before Apply).

## Persistence

- **Prefs persist globally** (tool, toggles, fps, chrome layout, folded
  panels) under one storage key; **document state resets with the document**
  (selection, variant, clip, hidden children, frame). Opening file B must not
  carry file A's view state.
- Structured handles (FS Access folder handles) go in IndexedDB; JSON prefs in
  localStorage; both behind a tiny module so private-mode failures degrade to
  "the app forgets" rather than throws.
- Expect and design for the permission lapse: handle persists, permission
  doesn't; one visible "reconnect" click, not an error.

## Look at it

Ship a screenshot rig (`just shots`): scenes that mount the real app, drive it
into a state with a cell-coordinate driver, and photograph it. Outside the test
gate — pictures are for reading, and a picture nobody reads is a slow test —
but typechecked, so scenes can't silently rot. Every layout bug dab ever had
(collapsed control, overflowing row, wrong-colour marquee) was found by looking
at a picture, none by an assertion. Scenes assert the minimum that makes the
picture meaningful: a blank rectangle reads as a design decision.

## Aligning an existing app

Audit in this order — it's the order users notice:

1. Right-click coverage and the browser-menu suppression (the coin toss is the
   loudest inconsistency).
2. Escape/Enter in every dialog; keys leaking through veils.
3. Keys that change meaning with invisible state.
4. Undo entries per gesture (find the per-pointermove commits).
5. Selection-state vocabulary across panels.
6. What survives a reload, and whether a reload can be undone.

Fix by adopting the shared components (menu, Modal, IconButton, Panel) rather
than patching each surface's copy — the copies are how it drifted apart.
