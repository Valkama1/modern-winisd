# Number Input Rework Design

Date: 2026-08-28

## Goal

Follow-up feedback after using the number-input spin buttons and border-color
work from the previous round: the increment/decrement buttons should be
replaced by scroll-to-adjust; several fields pair a number input with a range
slider that's redundant once the field itself is easy to nudge; unit labels
(e.g. "L" after Box Volume) float outside their input box and look
disconnected; and the sidebar's drag-resize should snap to fully collapsed
once dragged below a sensible width instead of stopping at an unusably
narrow expanded state.

Investigating the unit-label complaint surfaced a bigger, unstated problem:
`EnclosureTab.tsx` alone has **~40 raw `<input type="number">` elements**
(SignalTab.tsx has ~12 more), none built from a shared component. They
drifted independently — some put the label above the box in a 2-column
grid, most put the label to the left on the same line, and box
widths/padding vary field to field. That inconsistency, not any single
bug, is what reads as "one input looks offset from another." Confirmed
with the user via mockup: the fix is to migrate every one of these fields
onto one of two shared, consistent components (see Section 1), used
uniformly within any group of fields presented together.

## Non-goals

- No change to the Rust backend.
- Not rewording labels that already bake their unit into the label text
  itself (e.g. AddDriverModal's `"Fs (Hz) *"`, `"Sensitivity (dB @ 1W/1m) *"`)
  to use the new fused-suffix box instead — those stay as-is. The fused
  unit suffix is for fields that currently render a *separate* unit span
  outside the input (the pattern being replaced), not a mandate to
  restructure every label string in the app.
- Not adding new unit labels to fields that don't have one today (e.g.
  Settings' axis-limit inputs, DimensionCalculator's L/W/D ratio triplets)
  — they get the shared component's other benefits (consistent sizing,
  scroll-to-adjust, no spin buttons) without inventing a unit suffix that
  wasn't there before.
- Not persisting the sidebar's resize/collapse state — unchanged from the
  prior round's decision, still local `useState`, still resets on relaunch.
- Not touching the Driver Config isobaric selector or any other non-numeric
  control while passing through these files.

## 1. Two shared number-input components, replacing ~55 hand-rolled fields

Two thin layout components share one internal input implementation, so the
raw-string-tracking fix from the earlier Critical bug (users couldn't clear
a field or type "30.") lives in exactly one place no matter which layout is
used:

- **`NumberField`** (existing component, kept) — label above the box, used
  wherever fields already sit in a "label above, input below" grid:
  AddDriverModal's 13-field grid (unchanged behavior), Settings' axis-limit
  2-column grids, DimensionCalculator's L/W/D ratio and dimension triplets
  (3-across grids, where stacking would waste vertical space for a tightly
  related set of 3 numbers).
- **`NumberRow`** (new) — label to the left, inline, on the same line as a
  fixed-width value box. Used wherever a field sits in a single-line
  "label left, value right" row: every remaining field in `EnclosureTab.tsx`
  and `SignalTab.tsx`, `DriverTab.tsx`'s "Number of Drivers" field, and
  DimensionCalculator's single-value rows (Box Volume, Panel Thickness).

Both extract their actual `<input>` markup — the raw-value tracking, the
wheel-adjust handler (Section 2), and the unit-suffix-fused-into-the-box
rendering (Section 3) — from one shared internal piece (an unexported
component or hook inside `Field.tsx`, exact shape decided at plan time) so
neither layout can drift out of sync with the other on bug fixes.

**The consistency rule this enforces:** within any single group of fields
presented together — a stacked list of rows, or a small side-by-side grid —
every field in that group uses the same one of these two components. A
group is never a mix of `NumberField` and `NumberRow`, and within
`NumberField`'s FieldWrapper, a field with no label reserves the exact same
label-row height as a sibling with one (see the small `FieldWrapper`
hardening below) — so label presence can never shift one field's input out
of alignment with its neighbors.

**`FieldWrapper` hardening:** today, `{label && <label>...}` means a field
with no `label` prop skips the label element (and its `min-h-8` reservation)
entirely, while a labeled sibling still reserves that space — reintroducing
the exact misalignment the `min-h-8` fix (previous round) was meant to
prevent, for any future field that omits a label inside a `NumberField`
grid. Fix: always render the label container at its reserved height;
when there's no label text, render it empty rather than omitting it.

**Spin buttons removed:** the up/down chevron buttons added last round are
removed from the shared internal input (both `NumberField` and `NumberRow`
lose them) — replaced by scroll-to-adjust (Section 2).

## 2. Scroll-to-adjust, replacing the spin buttons

The number box adjusts its value on mouse wheel, but **only while
focused** — not on hover alone. The sidebar itself scrolls
(`overflow-y-auto`) and is dense with number fields; hover-triggered
adjustment would make it impossible to scroll past a field without
accidentally changing its value. Requiring a click first (focus) before
wheel input does anything is the same trade-off tools like Figma make for
their numeric fields, and it keeps normal page/sidebar scrolling completely
unaffected until a field is deliberately focused.

Behavior: on `wheel`, if the input is focused, `preventDefault()` (so the
page doesn't also scroll) and adjust the value by one `step` per wheel
notch (reusing the same `step`/`min`/`max` semantics the removed spin
buttons used) — scroll up increments, scroll down decrements. Not focused:
the event passes through untouched, sidebar scrolls normally.

## 3. Unit suffix fused into the input box

Confirmed via mockup: the unit label renders *inside* the same bordered box
as the number — dimmed, right-padded, no border of its own — rather than as
a separate `<span>` floating after the box with a gap. Applies to both
`NumberField` (block mode — not currently exercised by any real call site,
but the same internal box is shared, so it's fixed for free) and `NumberRow`
(compact mode — where nearly every migrated field actually uses it: L, Hz,
cm, W, etc.).

## 4. Slider removal

Five of the app's six range sliders pair with a number field with the same
min/max and are removed, since a slider adds no capability the number field
plus scroll-adjust doesn't already cover, and removing it recovers vertical
space in an already-dense sidebar:

- Input Power (W) — `SignalTab.tsx`
- Cabin Corner Freq (Hz) — `SignalTab.tsx`
- Box Volume (L) — `EnclosureTab.tsx`
- Tuning Freq (Hz) — `EnclosureTab.tsx`
- Port Diameter (cm) — `EnclosureTab.tsx`

**Kept:** Wall Absorption (α), in `SignalTab.tsx`'s Room Correction section
— the only slider with no adjacent number field, so removing it would be a
regression with nothing to replace it. Its track is currently invisible
(the track's `backgroundColor` is set to `var(--bg-color)`, identical to
the panel it sits inside, so only the accent-colored thumb is visible) —
fixed by giving the track a background distinct from its container (e.g.
`var(--border-color)`), so the track itself is visible while the thumb
still reads as the interactive part via `accentColor`.

## 5. Sidebar: collapse instead of clamping past a sensible minimum

The previous round's drag-resize clamps to a 240–480px range. 240px is
narrower than the sidebar's header row actually needs: the wordmark + icon
(~130px) plus the collapse-toggle/Database/Settings icon-button group
(~100px) need roughly 240px of *content* width alone, which — plus the
sidebar's 20px padding on each side — means the header needs about **280px**
before it visually breaks (wraps or crowds the icon buttons). The
Driver/Enclosure/Signal tab bar is close behind at roughly 250px (driven by
"Enclosure," the longest label).

New behavior: raise the resize floor to **280px** (the sidebar never gets
narrower than this while still expanded — the header and tab bar always
have room). If the user keeps dragging past that floor down toward
**200px** (measured from the drag's live cursor position, not the clamped
rendered width — otherwise the floor would absorb the extra drag distance
and a collapse could never trigger), the sidebar snaps directly to the
collapsed icon rail instead of continuing to render a cramped expanded
state. Releasing the drag while past the 200px trigger point leaves it
collapsed; a fresh drag from the collapsed rail's own edge (or the existing
expand icon) restores the prior expanded width.

## Testing

Same as the prior two UI-polish rounds: no live browser in this
environment, so verification is `tsc`/`vite build` passing, `npm test` for
the unaffected `src/lib/` suite, and a careful diff read during task
review — particularly for the scroll-adjust wheel handler (a real
interaction with a focus-gating condition worth tracing carefully) and the
drag-to-collapse threshold logic (worth tracing against both the "still
expanded, clamped at 280px" and "past 200px, collapsed" cases). The
`FieldWrapper` hardening and the two shared components are new/changed
code with no existing test coverage to lean on, consistent with this
project's established pattern for UI-polish batches.
