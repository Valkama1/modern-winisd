# UI/UX Overhaul Design

Date: 2026-08-28

## Goal

The app (a WinISD-style loudspeaker enclosure design tool, Tauri + React) works
functionally but doesn't feel polished: text sizes are inconsistent and go as
small as 7px in places, theme contrast is unverified (one theme's grid lines
are effectively invisible), and the sidebar is a single dense scroll with no
information hierarchy. Ctrl+ zoom (a natural workaround for small text)
doesn't work because it's disabled by default in Tauri.

This is a visual + interaction polish pass over the existing app. It is not a
rewrite: the top-level structure (fixed sidebar with Driver/Enclosure/Signal
tabs, graph dashboard on the right, project tabs, theme system) stays. The aim
is to make the existing structure consistent, legible, and give it real
information hierarchy, plus fix specific functional gaps (zoom, feedback,
tooltips) that make the app feel less intuitive than it should.

## Non-goals

- No new features (no new calculators, graphs, or driver parameters).
- No split of `App.tsx` into many files / no broad componentization beyond
  the specific shared primitives listed below.
- No change to the DSP/simulation logic in the Rust backend
  (`src-tauri/src/*.rs`) — those files currently show as modified in git
  status from prior unrelated work and are out of scope here.
- No new top-level navigation paradigm — Driver/Enclosure/Signal tabs and the
  fixed sidebar layout remain.
- Not chasing pixel-perfect WCAG AAA — targets below are pragmatic minimums
  for a dense engineering tool, not a compliance audit deliverable.

## 1. Type scale & spacing

Replace the current ad hoc sizes (`text-[7px]` through `text-[11px]`, plus
inconsistent `text-xs`/`text-sm` usage — 273 total size-related class sites)
with a fixed scale. Floor is 11px, reserved for micro-labels/badges only;
nothing read continuously goes below 12px.

| Token | Size | Use |
|---|---|---|
| `2xs` | 11px | Uppercase micro-labels, count badges, tiny tags |
| `xs` | 12px | Secondary/helper text, table values, form field labels |
| `sm` | 13px | Default UI text — most inputs, buttons, body copy |
| `base` | 14px | Panel section headers, emphasized values |
| `lg` | 16px | Card/panel titles |
| `xl` | 20px | Page-level title ("Simulation Dashboard") |

Line-height increases alongside size bumps, since several dense blocks
currently combine tight/default leading with tiny sizes.

Spacing consolidates the current scattergun (`p-2`, `p-2.5`, `p-3`, `p-5`,
etc.) into a small set: `gap-2`/`p-3` for compact control rows, `p-4` for
panel padding, `gap-4` between panel sections.

Implementation: define these as Tailwind-compatible utility values (either
`@theme` tokens in `App.css` under Tailwind v4's CSS-based config, or a
shared constants file consumed via className strings) — not just documented
convention, so drift is structurally harder to reintroduce.

## 2. Theme palettes

`src/theme.ts` — `AppTheme` interface gains two new fields:

```ts
export interface AppTheme {
  name: string;
  bgColor: string;
  sidebarColor: string;
  textColor: string;
  textMutedColor: string;   // NEW — replaces opacity-based secondary text
  accentColor: string;
  graphLineColor: string;
  graphGridColor: string;
  warningColor: string;     // NEW — replaces hardcoded #f59e0b etc.
  dangerColor: string;      // NEW — replaces hardcoded red-400/red-500
}
```

`successColor` is not added as a separate field; semantic "success" reuses
`accentColor`.

**Why `textMutedColor` replaces opacity:** secondary text is currently done
via `opacity-70`/`opacity-60`/`opacity-50` on the primary text color. Opacity
compounds unpredictably depending on what's rendered behind an element
(card-on-sidebar vs. direct-on-bg), and is riskiest in the light themes
(Classic, Solarized) where washing out already-moderate-contrast text can
push labels below readable. Each theme instead gets an explicit muted-text
color tuned against both its `bgColor` and `sidebarColor`.

**Per-theme changes:**

- **Slate Dark** — base colors unchanged (already high contrast: text
  `#f8fafc` on bg `#020617`). Add `textMutedColor` (slate-400 range),
  `warningColor` (amber), `dangerColor` (red, dark-bg-appropriate shade).
- **Classic WinISD** — base colors unchanged. Add `textMutedColor` (a
  gray dark enough to stay legible on both the light bg and the
  medium-gray sidebar), `warningColor`/`dangerColor` tuned for a light
  background.
- **Cyberpunk** — `graphGridColor` (`#3b0764` on bg `#0f051d`) is too close
  in luminance to the background to read; lighten toward a visible
  mid-purple, keeping the neon character. Add `textMutedColor`/
  `warningColor`/`dangerColor` in-theme.
- **Solarized Light** — `graphGridColor` (`#d3c7a1` on bg `#fdf6e3`) is
  near-invisible; replace with Solarized's own `base1` (`#93a1a1`), designed
  for this exact role. Add `textMutedColor`/`warningColor`/`dangerColor`
  using Solarized's own accent colors (`yellow`/`red`) for palette
  consistency.

**Verification method (not eyeballing):** implementation includes a small
script computing WCAG contrast ratios for every text-on-background and
UI-border-on-background pair across all 4 themes. Targets: ≥4.5:1 for body
text, ≥3:1 for large text/borders/graph lines. Any pair that fails gets its
color adjusted and re-checked. This script is a one-off verification tool,
not a permanent test suite addition (no CI requirement implied).

`applyTheme()`/`saveTheme()`/`loadSavedTheme()` in `theme.ts` need no
signature changes — they already iterate/serialize the whole `AppTheme`
object generically via `Object.entries`-style application. Need to confirm
`applyTheme()`'s current implementation sets each field explicitly
(it does, per current source — each new field gets one added
`root.style.setProperty(...)` line).

Any UI that lets users build a **custom** theme (the settings modal) needs
its color-picker fields extended to cover the two new tokens.

## 3. Shared component primitives

New file: `src/components/ui.tsx`. Thin wrappers around existing inline
patterns — not a new abstraction layer, no new capabilities beyond what the
raw elements already have:

- **`TextField`, `NumberField`, `Select`** — themed input styling in one
  place: Section 1 type-scale token for label/value text, consistent
  padding, a visible focus ring (several inputs currently use
  `focus:outline-none` with no replacement, so focus is invisible for
  keyboard users).
- **`Button`** — variants: `primary` (accent-bordered — Save/confirm),
  `secondary` (neutral — New/Open/icon actions), `icon` (icon-only, header
  buttons). Consolidates the ~15+ near-duplicate inline button style blocks.
- **`PanelHeader`** — consistent treatment for section labels ("Enclosure
  Settings," "Auto-Align Enclosure," etc.).
- **`Badge`** — small status/count indicators.
- **`Tooltip`** — real hover tooltip (see Section 5), used where a `title=`
  attribute currently carries more than a one-word label.
- **`CollapsibleSection`** — accordion primitive used by Section 4's sidebar
  reorganization: header with chevron, controlled or persisted open/closed
  state, content slot.

These are used to replace existing inline patterns as each area of the app is
touched during implementation — not a mechanical find/replace across the
whole file in one shot, to keep changes reviewable.

## 4. Sidebar reorganization

Top-level `Driver` / `Enclosure` / `Signal` tabs are unchanged. Within each
tab, existing implicit groups (already marked by headers like "Enclosure
Settings," "Auto-Align Enclosure," "Enclosure Dimension Calculator") become
real `CollapsibleSection`s:

- **Default open** (core, always-relevant): active driver's Thiele-Small
  parameters; enclosure type + chamber/port configuration; primary signal
  chain controls.
- **Default collapsed** (secondary/occasional): dimension calculator,
  advanced/derived driver parameters, auto-align wizard's detail panel.

Open/closed state persists via the existing session-save mechanism (the same
`localStorage` round trip already used for `sidebarTab`, `graphHeights`,
etc.) — add a `sidebarSectionState: Record<string, boolean>` field to the
saved-session shape.

Exact default-open/closed assignment per section is decided during
implementation by reading each tab's actual content in full (this design
doc's assignments above are the directional intent, confirmed with the user
during brainstorming — "go ahead" on the Section 4 proposal).

## 5. Functional UX fixes

- **Zoom:** add `"zoomHotkeysEnabled": true` to the window config in
  `src-tauri/tauri.conf.json`. Enables native Ctrl+/Ctrl-/Ctrl+0/Ctrl+scroll
  zoom in the Tauri (v2) webview — no custom zoom logic.
- **Tooltips:** icon-only header buttons (Driver Database, Settings, Undo,
  Redo, Ruler, Export) move from bare `title=` attributes to the `Tooltip`
  primitive for consistent, reliable-to-trigger styling.
- **Action feedback:** add a lightweight toast/snackbar, triggered on Save
  Project and graph/summary export completion, so the action is visibly
  acknowledged (currently silent — no feedback beyond the side effect
  itself).
- **Themed confirm dialogs:** replace the native browser `confirm()` used
  for project deletion with a themed modal consistent with the rest of the
  UI.
- **Empty states:** audited and addressed during implementation — driver
  browser (empty/no-results search) and any other list-driven view found to
  render blank with no content.

## Testing / verification approach

- **Contrast:** the WCAG contrast script described in Section 2, run against
  final color values for all 4 themes; failing pairs get corrected.
- **Manual pass:** run the app (`npm run dev` via Tauri) and walk each
  sidebar tab, each theme, and the functional fixes (zoom, save toast,
  delete confirm, tooltips) per the project's standard practice of testing
  UI changes in a live browser/app session before calling the work done.
- **No regression in simulation logic:** since Rust backend files are out of
  scope, a diff review before finishing confirms no unintended changes
  leaked into `src-tauri/src/*.rs` beyond what was already modified prior to
  this task.
- **Existing frontend build/typecheck** (`npm run build` / `tsc`) must still
  pass — new components are TypeScript, so type errors would surface here.
