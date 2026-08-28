# UI Polish Round 2 Design

Date: 2026-08-28

## Goal

A batch of UI/UX feedback surfaced after using the app post-modularization:
native form controls (color picker, select dropdowns, number-input spinners)
don't match the theme since browsers/webviews render their popups outside
CSS's reach; a genuine bug where the Add/Edit Driver modal's number fields
visually stagger because labels of different lengths wrap inconsistently in
a 3-column grid; the sidebar can't be resized or collapsed; there's no
autocomplete on the Manufacturer field despite the driver database already
holding manufacturer names; and `--graph-grid-color` — deliberately
brightened earlier for graph-gridline WCAG contrast — is reused as the
border color for every piece of UI chrome app-wide, making ordinary
dividers and card borders read as loud highlights instead of subtle
structure.

This is a polish/small-feature batch on top of the already-modularized
frontend, not a rewrite. Every item lands as new or modified files inside
the existing `src/components/ui/` and theme system.

## Non-goals

- No change to the Rust backend.
- No new state-management library — the sidebar's resize/collapse state
  is local `useState` in `Sidebar.tsx`, consistent with the rest of the
  codebase's "not everything is shared" principle.
- Not retrofitting spin buttons onto every raw `<input type="number">` in
  the app (Settings' axis-limit inputs, EQ filter freq/Q/gain inputs) —
  only `NumberField` (the shared primitive), which covers the Add/Edit
  Driver modal the feedback was about. Retrofitting the rest is a
  reasonable future follow-up, not blocking this batch.
- Not adding persistence for sidebar width/collapsed state in this pass —
  local `useState`, resets on relaunch. Cheap to add later via the same
  `localStorage` pattern `useSectionState` already uses, but not required
  now.

## 1. `--border-color` token split

`--graph-grid-color` currently serves two unrelated jobs: the actual graph
gridlines/reference lines in `GraphPanel.tsx` (which needed a contrast
bump — WCAG ≥3:1 against the background — done in an earlier pass), and
the border/divider color for essentially every other piece of UI chrome
(inputs, cards, modals, panel dividers) across 15 files, ~168 usages. The
gridline-driven brightening makes those unrelated borders read as far more
prominent than a divider should.

Add a new `borderColor` field to `AppTheme` (`src/theme.ts`), one value
per preset, tuned for subtlety (closer to the background than
`graphGridColor`, low but present contrast — enough to read as a boundary,
not enough to draw the eye). Add the matching `--border-color` CSS custom
property to `App.css`'s `:root` defaults and to `applyTheme()`.

Then repoint every non-graph usage of `var(--graph-grid-color)` to
`var(--border-color)`. `GraphPanel.tsx`'s actual gridlines/reference lines
keep `var(--graph-grid-color)` — that's the one legitimate consumer.

## 2. `Listbox` — themed dropdown, replacing native `<select>`

A new primitive in `src/components/ui/Listbox.tsx`: a button showing the
selected option's label, opening a themed popover list on click, closing
on outside-click/Escape/selection, with keyboard arrow-key navigation and
Enter-to-select. Same prop shape as today's `Select` (`label?`, `value`,
`onChange`, `options: {value, label}[]`, `className?`) so it's a drop-in
replacement.

Migrate all 16 dropdown call sites: `SettingsModal.tsx`'s 2 (theme
preset, curve-to-calibrate — currently via the old `Select`), and the 13
raw `<select>` elements in `AddDriverModal.tsx` (nominal impedance),
`SignalTab.tsx` (3), `DriverTab.tsx` (1), `EnclosureTab.tsx` (8). Retire
the old `Select` from `Field.tsx` once nothing references it, and drop
the global `select`/`option` CSS override rules in `App.css` (they exist
solely to theme native `<select>`, which no longer renders anywhere in
the app after this migration).

## 3. `ColorPicker` — themed swatch + popover, replacing native color input

A new primitive in `src/components/ui/ColorPicker.tsx`: a small themed
swatch button showing the current color, opening a popover with a
saturation/hue picker (or, pragmatically, an `<input type="color">`
rendered *inside* the themed popover as the actual picking surface — the
popover chrome around it is themed even though the color-picking widget
itself remains a native control; this is the standard practical
compromise, since a fully custom HSV picker is a bigger build than this
batch's other items and the native picker only appears inside an already-
themed container rather than as a jarring top-level popup). Props:
`value: string`, `onChange: (hex: string) => void`, `label?: string`.

Migrate the ~10 call sites: `SettingsModal.tsx`'s 9 theme-customizer
swatches, `Toolbar.tsx`'s 1 per-project graph-line color picker.

## 4. `NumberField` — themed spin buttons + label-alignment fix

In `src/components/ui/Field.tsx`:
- Hide the native spinner (`appearance: none` scoped to `.nf-input`, plus
  the existing WebKit-specific rules become unnecessary and can be
  removed once nothing relies on them).
- Add two small themed buttons (up/down chevrons) inside the field,
  incrementing/decrementing by `step` (default `1`) within `min`/`max` if
  set, calling the same `onChange` path as manual typing.
- Fix the alignment bug: give `FieldWrapper`'s label a fixed min-height
  (enough for two lines at the current `text-xs` size) so a long label's
  wrap doesn't shift its input's vertical position relative to
  neighboring grid cells. Applies to `TextField`/`NumberField`/`Listbox`
  uniformly since they share `FieldWrapper`.

## 5. Sidebar resize + collapse

`Sidebar.tsx` gains:
- A drag handle on its right border (a thin invisible-until-hover strip)
  that resizes its width via local `useState<number>` (replacing the
  hardcoded `w-80`), clamped to a sensible min/max (e.g. 240–480px).
- A collapse toggle (icon button near the header) that shrinks the
  sidebar to an icon-only rail (~56px): the Driver/Enclosure/Signal tab
  icons stay visible and clickable (switching `sidebarTab` still works,
  just without visible labels — icons need to be added to the tab
  definitions, currently label-only), the header's Database/Settings
  icons stay, and the scrollable tab content / project section / docked
  stats panel hide entirely while collapsed. Clicking any rail icon or a
  dedicated expand icon restores the prior width.

## 6. Manufacturer autocomplete

`TextField` (`Field.tsx`) gains an optional `list?: string` prop, passed
through to the underlying `<input>`'s `list` attribute. `AddDriverModal`
renders a `<datalist id="manufacturer-suggestions">` populated from the
unique, sorted set of `manufacturer` values already in
`useDriverDatabaseContext().drivers`, and passes `list="manufacturer-
suggestions"` to the Manufacturer `TextField`. Native `<datalist>`
dropdown styling has the same browser-chrome limitation as `<select>`
(unfixable without a much larger custom-autocomplete build) — noted as a
known, accepted limitation for this batch, not a regression, since no
autocomplete exists today at all.

## 7. Drop shadows for depth

Modals already carry Tailwind's `shadow-2xl`. Add a subtler shadow (e.g.
Tailwind's `shadow-md` or a custom low-opacity `box-shadow`) to
`CollapsibleSection`'s panel body and to `Sidebar.tsx`'s outer container
(against the dashboard), giving those surfaces the same sense of
elevation the modals already have. Tuned per current theme's background
darkness isn't necessary — a low-opacity black shadow reads fine on both
dark and light presets at the subtlety level intended here.

## Testing

This is a visual/interaction polish batch — verification is `tsc`/`build`
passing plus manual review of the diff against each file's current state,
matching how the prior two UI passes in this project were verified (no
live browser available in this environment). `Listbox`/`ColorPicker`
being genuinely new components with real interaction logic (open/close,
keyboard nav, outside-click) are the highest-risk items — worth a close
read during task review even without a live render to check against.
