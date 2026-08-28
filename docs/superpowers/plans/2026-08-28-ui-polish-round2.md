# UI Polish Round 2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix a batch of post-modularization UI/UX feedback — native browser chrome that doesn't match the theme (color picker, select dropdowns, number-input spinners), an Add/Edit Driver modal alignment bug, a missing manufacturer autocomplete, an overloaded border-color token, and missing depth cues — without touching the Rust backend or restructuring the hooks/Context architecture.

**Architecture:** Two new themed primitives (`Listbox`, `ColorPicker`) replace native `<select>` and `<input type="color">` everywhere they render app UI chrome. A new `--border-color` CSS custom property replaces `--graph-grid-color` for all non-graph borders/dividers, leaving `--graph-grid-color` exclusively for `GraphPanel.tsx`'s actual gridlines. `NumberField` gains custom spin buttons and `FieldWrapper` gains a label min-height to fix wrap-driven misalignment. `Sidebar.tsx` gains local resize/collapse state. All changes are additive/replacement within the existing `src/components/` and `src/theme.ts` structure — no new directories.

**Tech Stack:** React 19 + TypeScript, Tailwind CSS v4 (CSS-first `@theme`), lucide-react icons, Vite. No new dependencies.

**Spec:** `docs/superpowers/specs/2026-08-28-ui-polish-round2-design.md`

## Global Constraints

- No changes to `src-tauri/` (Rust backend) — frontend-only work.
- No new state-management library — `Sidebar.tsx`'s resize/collapse state is local `useState`, not lifted to Context, not persisted to `localStorage`.
- Do not add spin buttons to any `<input type="number">` outside the shared `NumberField` primitive (Settings' axis-limit inputs, EQ filter freq/Q/gain inputs, the Add/Edit Driver modal's Piston Diameter helper input all stay untouched, native-spinner-as-is).
- `Listbox` and `ColorPicker` must match their native predecessors' prop shape closely enough to be near-drop-in: `Listbox` mirrors today's `Select` (`label?`, `value: string`, `onChange: (value: string) => void`, `options: {value, label}[]`, `className?`), plus a new optional `buttonClassName?: string` for call sites that style the trigger directly instead of relying on `FieldWrapper`.
- Every popover (`Listbox`, `ColorPicker`) closes on outside-click and (`Listbox`) on Escape, and never traps focus outside itself.
- Verification throughout is `npm run build` (runs `tsc` then `vite build`) — this is a visual/interaction polish batch with no unit-test coverage for these components; there is no live browser in this environment, so a close read of each diff during task review is the primary quality gate, matching how the prior two UI passes in this project were verified.
- `src/hooks/useSimulation.ts` (lines 38-51) bakes `--graph-grid-color`'s computed value into exported SVG/PNG markup via string substitution. It reads `getComputedStyle(...).getPropertyValue("--graph-grid-color")` and replaces `var(--graph-grid-color)` inside the serialized `<svg>` only — the `<svg>` element itself (`GraphPanel.tsx` line 260 onward) is the only place this string appears after this plan lands, since GraphPanel's two UI-chrome usages (outside the `<svg>`) migrate to `--border-color`. **No changes needed in `useSimulation.ts`** — noted here so no task mistakes it for a stray usage needing migration.

---

## Task 1: Add the `--border-color` theme token

**Files:**
- Modify: `src/theme.ts`
- Modify: `src/App.css:14-25` (`:root` defaults)

**Interfaces:**
- Produces: `AppTheme.borderColor: string` field; CSS custom property `--border-color`, settable via `applyTheme()` and readable everywhere via `var(--border-color)`. All later tasks that migrate a `borderColor: "var(--graph-grid-color)"` usage depend on this existing first.

- [ ] **Step 1: Add `borderColor` to the `AppTheme` interface**

In `src/theme.ts`, add the field to the interface (after `graphGridColor`, matching declaration order used elsewhere):

```ts
export interface AppTheme {
  name: string;
  bgColor: string;
  sidebarColor: string;
  textColor: string;
  textMutedColor: string;
  accentColor: string;
  graphLineColor: string;
  graphGridColor: string;
  borderColor: string;
  warningColor: string;
  dangerColor: string;
}
```

- [ ] **Step 2: Add a tuned `borderColor` value to each of the 4 presets**

Each value sits closer to that preset's `bgColor` than `graphGridColor` does — a subtle boundary, not a highlight. Insert `borderColor` right after `graphGridColor` in each preset object:

```ts
  slate: {
    name: "Slate Dark",
    bgColor: "#020617",
    sidebarColor: "#0f172a",
    textColor: "#f8fafc",
    textMutedColor: "#94a3b8",
    accentColor: "#10b981",
    graphLineColor: "#06b6d4",
    graphGridColor: "#64748b",
    borderColor: "#293548",
    warningColor: "#f59e0b",
    dangerColor: "#f87171",
  },
  classic: {
    name: "Classic WinISD",
    bgColor: "#d1d5db",
    sidebarColor: "#9ca3af",
    textColor: "#111827",
    textMutedColor: "#1f2937",
    accentColor: "#1e40af",
    graphLineColor: "#10b981",
    graphGridColor: "#6b7280",
    borderColor: "#a3a9b3",
    warningColor: "#b45309",
    dangerColor: "#b91c1c",
  },
  cyberpunk: {
    name: "Cyberpunk",
    bgColor: "#0f051d",
    sidebarColor: "#1b0a2f",
    textColor: "#fdf4ff",
    textMutedColor: "#c4b5fd",
    accentColor: "#f43f5e",
    graphLineColor: "#06b6d4",
    graphGridColor: "#7c3aed",
    borderColor: "#3a1f57",
    warningColor: "#fbbf24",
    dangerColor: "#f87171",
  },
  solarized: {
    name: "Solarized Light",
    bgColor: "#fdf6e3",
    sidebarColor: "#eee8d5",
    textColor: "#073642",
    textMutedColor: "#2d3c45",
    accentColor: "#8b5900",
    graphLineColor: "#268bd2",
    graphGridColor: "#657b86",
    borderColor: "#d9cfb0",
    warningColor: "#cb4b16",
    dangerColor: "#dc322f",
  },
```

- [ ] **Step 3: Set `--border-color` in `applyTheme()`**

In `src/theme.ts`, add a line right after the `--graph-grid-color` line:

```ts
export function applyTheme(theme: AppTheme) {
  const root = document.documentElement;
  root.style.setProperty("--bg-color", theme.bgColor);
  root.style.setProperty("--sidebar-color", theme.sidebarColor);
  root.style.setProperty("--text-color", theme.textColor);
  root.style.setProperty("--text-muted-color", theme.textMutedColor);
  root.style.setProperty("--accent-color", theme.accentColor);
  root.style.setProperty("--graph-line-color", theme.graphLineColor);
  root.style.setProperty("--graph-grid-color", theme.graphGridColor);
  root.style.setProperty("--border-color", theme.borderColor);
  root.style.setProperty("--warning-color", theme.warningColor);
  root.style.setProperty("--danger-color", theme.dangerColor);
  root.style.setProperty("--color-scheme", relativeLuminance(theme.bgColor) > 0.5 ? "light" : "dark");
}
```

- [ ] **Step 4: Add the `--border-color` default to `App.css`'s `:root`**

In `src/App.css`, add a line inside the `:root { ... }` block (line 14-25), right after `--graph-grid-color`:

```css
:root {
  --bg-color: #020617;
  --sidebar-color: #0f172a;
  --text-color: #f8fafc;
  --text-muted-color: #94a3b8;
  --accent-color: #10b981;
  --graph-line-color: #06b6d4;
  --graph-grid-color: #1e293b;
  --border-color: #293548;
  --warning-color: #f59e0b;
  --danger-color: #f87171;
  --color-scheme: dark;
}
```

- [ ] **Step 5: Verify and commit**

Run: `npm run build`
Expected: succeeds with no TypeScript errors (no call site references `borderColor` incorrectly yet — this task only adds the field/property, nothing consumes it until Task 2).

```bash
git add src/theme.ts src/App.css
git commit -m "feat: add --border-color theme token, distinct from graph gridline color"
```

---

## Task 2: Migrate UI-chrome borders to `--border-color` (15-file batch)

**Files:**
- Modify: `src/components/ui/Field.tsx` (3 usages: `TextField`, `NumberField`, `Select`)
- Modify: `src/components/ui/Button.tsx` (2 usages: `secondary`, `icon` variants)
- Modify: `src/components/ui/Tooltip.tsx` (1 usage)
- Modify: `src/components/ui/Dialog.tsx` (2 usages)
- Modify: `src/components/ui/CollapsibleSection.tsx` (1 usage)
- Modify: `src/components/CustomTopologyDiagram.tsx` (2 usages: lines 10, 27)
- Modify: `src/components/sidebar/DimensionCalculator.tsx` (4 usages: lines 49, 57, 90, 134)
- Modify: `src/components/sidebar/Sidebar.tsx` (12 usages)
- Modify: `src/components/sidebar/SignalTab.tsx` (20 usages)
- Modify: `src/components/sidebar/DriverTab.tsx` (8 usages)
- Modify: `src/components/sidebar/EnclosureTab.tsx` (63 usages)
- Modify: `src/components/dashboard/Toolbar.tsx` (7 usages)
- Modify: `src/components/modals/SettingsModal.tsx` (26 usages)
- Modify: `src/components/modals/AddDriverModal.tsx` (8 usages)
- Modify: `src/components/modals/DriverBrowserModal.tsx` (7 usages)

**Interfaces:**
- Consumes: `--border-color` CSS custom property from Task 1 (must already be defined in `App.css`'s `:root` and set by `applyTheme()`).
- Produces: none new — this is a pure find-and-replace task with no new exports or signatures.

This is a single mechanical, same-shape edit repeated across 15 files: every occurrence of the literal string `var(--graph-grid-color)` becomes `var(--border-color)`. Every occurrence in every one of these 15 files is a non-graph UI-chrome use (input border, panel border, divider, modal border, card border) — none of them is a graph gridline, so the replacement is unconditionally safe in these files with no per-line judgment needed. (Contrast with `GraphPanel.tsx`, handled separately in Task 3, which has two genuine SVG-gridline uses that must NOT be touched.)

Do the replacement with a single shell command per file (safe here because, per the file list above, every match in every one of these 15 files is confirmed UI chrome):

- [ ] **Step 1: Run the blanket replacement across all 15 files**

```bash
cd /home/felix/Documents/winisd
for f in \
  src/components/ui/Field.tsx \
  src/components/ui/Button.tsx \
  src/components/ui/Tooltip.tsx \
  src/components/ui/Dialog.tsx \
  src/components/ui/CollapsibleSection.tsx \
  src/components/CustomTopologyDiagram.tsx \
  src/components/sidebar/DimensionCalculator.tsx \
  src/components/sidebar/Sidebar.tsx \
  src/components/sidebar/SignalTab.tsx \
  src/components/sidebar/DriverTab.tsx \
  src/components/sidebar/EnclosureTab.tsx \
  src/components/dashboard/Toolbar.tsx \
  src/components/modals/SettingsModal.tsx \
  src/components/modals/AddDriverModal.tsx \
  src/components/modals/DriverBrowserModal.tsx \
; do
  sed -i 's/var(--graph-grid-color)/var(--border-color)/g' "$f"
done
```

- [ ] **Step 2: Verify no stray `graph-grid-color` usages remain in these 15 files**

Run: `grep -rn "graph-grid-color" src/components/ui/Field.tsx src/components/ui/Button.tsx src/components/ui/Tooltip.tsx src/components/ui/Dialog.tsx src/components/ui/CollapsibleSection.tsx src/components/CustomTopologyDiagram.tsx src/components/sidebar/DimensionCalculator.tsx src/components/sidebar/Sidebar.tsx src/components/sidebar/SignalTab.tsx src/components/sidebar/DriverTab.tsx src/components/sidebar/EnclosureTab.tsx src/components/dashboard/Toolbar.tsx src/components/modals/SettingsModal.tsx src/components/modals/AddDriverModal.tsx src/components/modals/DriverBrowserModal.tsx`

Expected: no output (zero matches).

- [ ] **Step 3: Verify the whole-repo count matches expectations**

Run: `grep -rln "graph-grid-color" src`
Expected: exactly 3 files remain: `src/theme.ts` (the `graphGridColor` property name itself, unrelated string), `src/components/dashboard/GraphPanel.tsx` (untouched until Task 3), and `src/hooks/useSimulation.ts` (intentionally untouched per Global Constraints). `src/App.css` should NOT appear (Task 2 doesn't touch it, and its only `--graph-grid-color` usage is the `:root` default itself plus the `select`/`option` override block, both to be revisited in Task 7).

- [ ] **Step 4: Verify and commit**

Run: `npm run build`
Expected: succeeds. `sed` only ever changes a CSS custom-property name inside a string literal — no TypeScript types are affected.

```bash
git add src/components/ui/Field.tsx src/components/ui/Button.tsx src/components/ui/Tooltip.tsx src/components/ui/Dialog.tsx src/components/ui/CollapsibleSection.tsx src/components/CustomTopologyDiagram.tsx src/components/sidebar/DimensionCalculator.tsx src/components/sidebar/Sidebar.tsx src/components/sidebar/SignalTab.tsx src/components/sidebar/DriverTab.tsx src/components/sidebar/EnclosureTab.tsx src/components/dashboard/Toolbar.tsx src/components/modals/SettingsModal.tsx src/components/modals/AddDriverModal.tsx src/components/modals/DriverBrowserModal.tsx
git commit -m "refactor: repoint UI-chrome borders from graph-grid-color to border-color"
```

---

## Task 3: Split `GraphPanel.tsx`'s border-color usage from its gridline usage

**Files:**
- Modify: `src/components/dashboard/GraphPanel.tsx`

**Interfaces:**
- Consumes: `--border-color` from Task 1.

`GraphPanel.tsx` has 4 occurrences of `var(--graph-grid-color)`. Exactly 2 are genuine SVG gridlines (keep) and 2 are UI chrome (migrate). This is the one file in the codebase with legitimate mixed usage, so it gets its own judgment-based task instead of Task 2's blanket replace.

- [ ] **Step 1: Migrate the outer panel border (line 204)**

Change:
```tsx
    <div
      className="border rounded-xl p-5 flex flex-col gap-4 animate-fadeIn"
      style={{ backgroundColor: "var(--sidebar-color)", borderColor: "var(--graph-grid-color)" }}
    >
```
to:
```tsx
    <div
      className="border rounded-xl p-5 flex flex-col gap-4 animate-fadeIn"
      style={{ backgroundColor: "var(--sidebar-color)", borderColor: "var(--border-color)" }}
    >
```

- [ ] **Step 2: Migrate the legend-row divider (line 242)**

Change:
```tsx
                      <div key={project.id} className="flex items-center gap-1.5 border-l pl-4 first:border-none first:pl-0" style={{ borderColor: "var(--graph-grid-color)" }}>
```
to:
```tsx
                      <div key={project.id} className="flex items-center gap-1.5 border-l pl-4 first:border-none first:pl-0" style={{ borderColor: "var(--border-color)" }}>
```

- [ ] **Step 3: Leave the two SVG gridline `<line>` elements (lines ~317 and ~345) unchanged**

Both `stroke="var(--graph-grid-color)"` occurrences inside the `<svg>` (the horizontal Y-grid lines loop and the vertical X-grid lines loop) stay exactly as they are — these are the one legitimate consumer of the brightened gridline color.

- [ ] **Step 4: Verify exactly 2 `graph-grid-color` occurrences remain, both inside the `<svg>`**

Run: `grep -n "graph-grid-color" src/components/dashboard/GraphPanel.tsx`
Expected: exactly 2 lines, both `stroke="var(--graph-grid-color)"` inside `<line>` elements (not `borderColor`).

- [ ] **Step 5: Verify and commit**

Run: `npm run build`
Expected: succeeds.

```bash
git add src/components/dashboard/GraphPanel.tsx
git commit -m "refactor: split GraphPanel's UI-chrome borders from its gridline color"
```

---

## Task 4: Build the `Listbox` primitive

**Files:**
- Create: `src/components/ui/Listbox.tsx`
- Modify: `src/components/ui/Field.tsx` (export `FieldWrapper`)
- Modify: `src/components/ui/index.ts` (export `Listbox`)

**Interfaces:**
- Consumes: `FieldWrapper` from `./Field` (exported by this task's Step 1).
- Produces: `Listbox` component — `{ label?: string; value: string; onChange: (value: string) => void; options: { value: string; label: string }[]; className?: string; buttonClassName?: string }`. Tasks 5 and 6 (raw `<select>` migration) and Task 7 (retiring `Select`) depend on this exact shape.

- [ ] **Step 1: Export `FieldWrapper` from `Field.tsx`**

In `src/components/ui/Field.tsx`, change:
```ts
function FieldWrapper({ label, className, children }: FieldWrapperProps) {
```
to:
```ts
export function FieldWrapper({ label, className, children }: FieldWrapperProps) {
```

- [ ] **Step 2: Create `src/components/ui/Listbox.tsx`**

```tsx
import { useEffect, useRef, useState } from "react";
import { ChevronDown, Check } from "lucide-react";
import { FieldWrapper } from "./Field";

interface ListboxOption {
  value: string;
  label: string;
}

interface ListboxProps {
  label?: string;
  value: string;
  onChange: (value: string) => void;
  options: ListboxOption[];
  className?: string;
  buttonClassName?: string;
}

const defaultButtonClass =
  "w-full border rounded px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent-color)]/50 flex items-center justify-between gap-2 cursor-pointer text-left";

export function Listbox({ label, value, onChange, options, className, buttonClassName }: ListboxProps) {
  const [open, setOpen] = useState(false);
  const [highlighted, setHighlighted] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const selectedIndex = Math.max(0, options.findIndex((o) => o.value === value));
  const selectedLabel = options.find((o) => o.value === value)?.label ?? "";

  // Reset the highlighted option to the current selection each time the popover opens,
  // and close on outside click while it's open.
  useEffect(() => {
    if (!open) return;
    setHighlighted(selectedIndex);
    const handlePointerDown = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const handleTriggerKeyDown = (e: React.KeyboardEvent) => {
    if (!open) {
      if (e.key === "Enter" || e.key === " " || e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        setOpen(true);
      }
      return;
    }
    if (e.key === "Escape") {
      e.preventDefault();
      setOpen(false);
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlighted((h) => Math.min(options.length - 1, h + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlighted((h) => Math.max(0, h - 1));
    } else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      const opt = options[highlighted];
      if (opt) {
        onChange(opt.value);
        setOpen(false);
      }
    }
  };

  const body = (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        onKeyDown={handleTriggerKeyDown}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={buttonClassName ?? defaultButtonClass}
        style={{ backgroundColor: "var(--bg-color)", borderColor: "var(--border-color)", color: "var(--text-color)" }}
      >
        <span className="truncate">{selectedLabel}</span>
        <ChevronDown className={`h-3.5 w-3.5 opacity-60 shrink-0 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div
          role="listbox"
          className="absolute left-0 right-0 mt-1 z-50 rounded-lg border shadow-xl py-1 max-h-60 overflow-y-auto animate-fadeIn"
          style={{ backgroundColor: "var(--sidebar-color)", borderColor: "var(--border-color)" }}
        >
          {options.map((opt, idx) => (
            <div
              key={opt.value}
              role="option"
              aria-selected={opt.value === value}
              onMouseEnter={() => setHighlighted(idx)}
              onClick={() => {
                onChange(opt.value);
                setOpen(false);
              }}
              className="flex items-center justify-between gap-2 px-3 py-1.5 text-sm cursor-pointer"
              style={{
                backgroundColor: idx === highlighted ? "var(--accent-color)" : "transparent",
                color: idx === highlighted ? "#fff" : "var(--text-color)",
              }}
            >
              <span className="truncate">{opt.label}</span>
              {opt.value === value && <Check className="h-3.5 w-3.5 shrink-0" />}
            </div>
          ))}
        </div>
      )}
    </div>
  );

  if (!label) return <div className={className}>{body}</div>;

  return (
    <FieldWrapper label={label} className={className}>
      {body}
    </FieldWrapper>
  );
}
```

- [ ] **Step 3: Export `Listbox` from `src/components/ui/index.ts`**

Change:
```ts
export { TextField, NumberField, Select } from "./Field";
```
to:
```ts
export { TextField, NumberField, Select } from "./Field";
export { Listbox } from "./Listbox";
```
(Leave `Select` exported for now — Task 7 retires it once every call site has migrated.)

- [ ] **Step 4: Verify and commit**

Run: `npm run build`
Expected: succeeds — `Listbox` is created and exported but has no consumers yet, so this is purely additive.

```bash
git add src/components/ui/Listbox.tsx src/components/ui/Field.tsx src/components/ui/index.ts
git commit -m "feat: add themed Listbox primitive to replace native select dropdowns"
```

---

## Task 5: Migrate 7 dropdown call sites to `Listbox` (SettingsModal, AddDriverModal, DriverTab, SignalTab)

**Files:**
- Modify: `src/components/modals/SettingsModal.tsx` (2 `Select` usages)
- Modify: `src/components/modals/AddDriverModal.tsx` (1 raw `<select>`)
- Modify: `src/components/sidebar/DriverTab.tsx` (1 raw `<select>`)
- Modify: `src/components/sidebar/SignalTab.tsx` (3 raw `<select>`s)

**Interfaces:**
- Consumes: `Listbox` from `../ui` (Task 4).

This batches 7 independent, same-shape swaps (native/old-`Select` dropdown → `Listbox`) into one task per SDD's batching guidance. Each swap below is a complete before/after.

- [ ] **Step 1: `SettingsModal.tsx` — Theme Presets (around line 41)**

Change the import:
```tsx
import { Select, Button } from "../ui";
```
to:
```tsx
import { Listbox, Button } from "../ui";
```

Change:
```tsx
            <Select
              label="Theme Presets"
              value={activePresetKey}
              onChange={(val) => {
                if (val && val !== "custom") {
                  setCurrentTheme(PRESETS[val]);
                }
              }}
              options={[
                ...Object.keys(PRESETS).map((key) => ({ value: key, label: PRESETS[key].name })),
                ...(activePresetKey === "custom" ? [{ value: "custom", label: "Custom Theme" }] : []),
              ]}
            />
```
to:
```tsx
            <Listbox
              label="Theme Presets"
              value={activePresetKey}
              onChange={(val) => {
                if (val && val !== "custom") {
                  setCurrentTheme(PRESETS[val]);
                }
              }}
              options={[
                ...Object.keys(PRESETS).map((key) => ({ value: key, label: PRESETS[key].name })),
                ...(activePresetKey === "custom" ? [{ value: "custom", label: "Custom Theme" }] : []),
              ]}
            />
```

- [ ] **Step 2: `SettingsModal.tsx` — Select Curve to Calibrate (around line 185)**

Change:
```tsx
            <Select
              label="Select Curve to Calibrate"
              value={configEditType}
              onChange={(val) => setConfigEditType(val as CurveType)}
              options={[
```
to:
```tsx
            <Listbox
              label="Select Curve to Calibrate"
              value={configEditType}
              onChange={(val) => setConfigEditType(val as CurveType)}
              options={[
```
(The rest of the `options={[...]}` array and closing `/>` are unchanged — only the component tag name changes.)

- [ ] **Step 3: `AddDriverModal.tsx` — Nominal Impedance (around line 96)**

Change the import:
```tsx
import { Button, TextField, NumberField } from "../ui";
```
to:
```tsx
import { Button, TextField, NumberField, Listbox } from "../ui";
```

Change:
```tsx
                <div className="flex items-center gap-1 border-l pl-2" style={{ borderColor: "var(--border-color)" }}>
                  <span className="opacity-50">Imp:</span>
                  <select
                    value={nominalImpedance}
                    onChange={(e) => setNominalImpedance(e.target.value)}
                    className="rounded px-1.5 py-0.5 focus:outline-none text-2xs"
                  >
                    <option value="1">1 Ω</option>
                    <option value="2">2 Ω</option>
                    <option value="4">4 Ω</option>
                    <option value="8">8 Ω</option>
                    <option value="16">16 Ω</option>
                  </select>
                </div>
```
to:
```tsx
                <div className="flex items-center gap-1 border-l pl-2" style={{ borderColor: "var(--border-color)" }}>
                  <span className="opacity-50">Imp:</span>
                  <Listbox
                    value={nominalImpedance}
                    onChange={setNominalImpedance}
                    buttonClassName="rounded px-1.5 py-0.5 focus:outline-none text-2xs flex items-center gap-1 cursor-pointer"
                    options={[
                      { value: "1", label: "1 Ω" },
                      { value: "2", label: "2 Ω" },
                      { value: "4", label: "4 Ω" },
                      { value: "8", label: "8 Ω" },
                      { value: "16", label: "16 Ω" },
                    ]}
                  />
                </div>
```
(Note: this is one of the 15 files already migrated to `--border-color` in Task 2 — the `borderColor: "var(--border-color)"` above reflects that, not a new change in this task.)

- [ ] **Step 4: `DriverTab.tsx` — Driver Config (around line 114)**

Add `Listbox` to the existing `../ui` import at the top of the file (find the current import line and add `Listbox` to its named imports — mirror however `TextField`/`NumberField` etc. are already imported there).

Change:
```tsx
            <select
              value={activeProject.driverConfig}
              onChange={(e) => updateActiveProject({ driverConfig: e.target.value as Project["driverConfig"] })}
              className="border rounded px-1.5 py-0.5 text-xs focus:outline-none"
              style={{ backgroundColor: "var(--sidebar-color)", borderColor: "var(--border-color)", color: "var(--text-color)" }}
            >
              <option value="standard">Standard</option>
              <option value="isobaric_series">Isobaric (series, 8Ω×2)</option>
              <option value="isobaric_parallel">Isobaric (parallel, 2Ω×2)</option>
            </select>
```
to:
```tsx
            <Listbox
              value={activeProject.driverConfig}
              onChange={(val) => updateActiveProject({ driverConfig: val as Project["driverConfig"] })}
              buttonClassName="border rounded px-1.5 py-0.5 text-xs focus:outline-none flex items-center gap-1.5 cursor-pointer"
              options={[
                { value: "standard", label: "Standard" },
                { value: "isobaric_series", label: "Isobaric (series, 8Ω×2)" },
                { value: "isobaric_parallel", label: "Isobaric (parallel, 2Ω×2)" },
              ]}
            />
```

- [ ] **Step 5: `SignalTab.tsx` — SPL Environment (around line 75)**

Add `Listbox` to the file's existing `../ui` import.

Change:
```tsx
                <select
                  value={activeProject.splEnvironment}
                  onChange={(e) => updateActiveProject({ splEnvironment: e.target.value as typeof activeProject.splEnvironment })}
                  className="w-full border rounded px-2.5 py-1.5 text-xs focus:outline-none"
                  style={{ backgroundColor: "var(--bg-color)", borderColor: "var(--border-color)", color: "var(--text-color)" }}
                >
                  <option value="half_space">Half-space — wall / floor mount</option>
                  <option value="free_field">Free-field — anechoic / elevated (−6 dB)</option>
                  <option value="corner">Corner placement — 3 boundaries (+12 dB)</option>
                </select>
```
to:
```tsx
                <Listbox
                  value={activeProject.splEnvironment}
                  onChange={(val) => updateActiveProject({ splEnvironment: val as typeof activeProject.splEnvironment })}
                  buttonClassName="w-full border rounded px-2.5 py-1.5 text-xs focus:outline-none flex items-center justify-between gap-2 cursor-pointer text-left"
                  options={[
                    { value: "half_space", label: "Half-space — wall / floor mount" },
                    { value: "free_field", label: "Free-field — anechoic / elevated (−6 dB)" },
                    { value: "corner", label: "Corner placement — 3 boundaries (+12 dB)" },
                  ]}
                />
```

- [ ] **Step 6: `SignalTab.tsx` — EQ Filter Type (around line 122)**

Change:
```tsx
                        <select
                          value={flt.type}
                          onChange={e => setFilters(prev => prev.map((f, i) => i === idx ? { ...f, type: e.target.value as EqFilter["type"] } : f))}
                          className="flex-1 border rounded px-1 py-0.5 text-2xs focus:outline-none cursor-pointer"
                          style={{ backgroundColor: "var(--sidebar-color)", borderColor: "var(--border-color)", color: "var(--text-color)" }}
                        >
                          <option value="hp">HP (2nd order)</option>
                          <option value="lp">LP (2nd order)</option>
                          <option value="peak">Peak EQ</option>
                          <option value="lowshelf">Low Shelf</option>
                          <option value="highshelf">High Shelf</option>
                        </select>
```
to:
```tsx
                        <Listbox
                          value={flt.type}
                          onChange={(val) => setFilters(prev => prev.map((f, i) => i === idx ? { ...f, type: val as EqFilter["type"] } : f))}
                          className="flex-1"
                          buttonClassName="w-full border rounded px-1 py-0.5 text-2xs focus:outline-none cursor-pointer flex items-center justify-between gap-1"
                          options={[
                            { value: "hp", label: "HP (2nd order)" },
                            { value: "lp", label: "LP (2nd order)" },
                            { value: "peak", label: "Peak EQ" },
                            { value: "lowshelf", label: "Low Shelf" },
                            { value: "highshelf", label: "High Shelf" },
                          ]}
                        />
```

- [ ] **Step 7: `SignalTab.tsx` — Crossover Type (around line 211)**

Change:
```tsx
                      <select
                        value={activeProject.passiveXoType}
                        onChange={(e) => updateActiveProject({ passiveXoType: e.target.value as any })}
                        className="w-full border rounded px-2.5 py-1.5 text-xs focus:outline-none"
                        style={{ backgroundColor: "var(--bg-color)", borderColor: "var(--border-color)", color: "var(--text-color)" }}
                      >
                        <option value="lowpass_1st">1st-Order Lowpass (Inductor L)</option>
                        <option value="highpass_1st">1st-Order Highpass (Capacitor C)</option>
                        <option value="lowpass_2nd">2nd-Order Lowpass (L-C Network)</option>
                        <option value="highpass_2nd">2nd-Order Highpass (C-L Network)</option>
                      </select>
```
to:
```tsx
                      <Listbox
                        value={activeProject.passiveXoType}
                        onChange={(val) => updateActiveProject({ passiveXoType: val as any })}
                        buttonClassName="w-full border rounded px-2.5 py-1.5 text-xs focus:outline-none flex items-center justify-between gap-2 cursor-pointer text-left"
                        options={[
                          { value: "lowpass_1st", label: "1st-Order Lowpass (Inductor L)" },
                          { value: "highpass_1st", label: "1st-Order Highpass (Capacitor C)" },
                          { value: "lowpass_2nd", label: "2nd-Order Lowpass (L-C Network)" },
                          { value: "highpass_2nd", label: "2nd-Order Highpass (C-L Network)" },
                        ]}
                      />
```

- [ ] **Step 8: Verify no raw `<select>` remain in these 4 files, and build**

Run: `grep -n "<select" src/components/modals/SettingsModal.tsx src/components/modals/AddDriverModal.tsx src/components/sidebar/DriverTab.tsx src/components/sidebar/SignalTab.tsx`
Expected: no output.

Run: `npm run build`
Expected: succeeds.

- [ ] **Step 9: Commit**

```bash
git add src/components/modals/SettingsModal.tsx src/components/modals/AddDriverModal.tsx src/components/sidebar/DriverTab.tsx src/components/sidebar/SignalTab.tsx
git commit -m "refactor: migrate SettingsModal/AddDriverModal/DriverTab/SignalTab dropdowns to Listbox"
```

---

## Task 6: Migrate `EnclosureTab.tsx`'s 8 raw `<select>`s to `Listbox`

**Files:**
- Modify: `src/components/sidebar/EnclosureTab.tsx`

**Interfaces:**
- Consumes: `Listbox` from `../ui` (Task 4).

The largest single migration target — kept as its own task (not folded into Task 5's batch) because it's the highest-risk file for this migration: 8 call sites, one of them (`portQ`) repeated 4 times with a numeric-typed value that needs explicit string coercion at the `Listbox` boundary.

- [ ] **Step 1: Add `Listbox` to the file's existing `../ui` import**

Find the current `import { ... } from "../ui";` line in `EnclosureTab.tsx` and add `Listbox` to its named imports, matching how the other primitives are already imported there.

- [ ] **Step 2: Enclosure Type (around line 105)**

Change:
```tsx
              <select
                value={activeProject.enclosureType}
                onChange={(e) => updateActiveProject({ enclosureType: e.target.value as EnclosureType })}
                className="w-full border rounded px-2.5 py-1.5 text-xs focus:outline-none"
                style={{
                  backgroundColor: "var(--bg-color)",
                  borderColor: "var(--border-color)",
                  color: "var(--text-color)",
                }}
              >
                <option value="sealed">Sealed (2nd Order Closed Box)</option>
                <option value="ported">Vented (4th Order Bass Reflex)</option>
                <option value="bandpass4">4th-Order Bandpass (BP4)</option>
                <option value="bandpass6_parallel">6th-Order Parallel Bandpass (BP6P)</option>
                <option value="bandpass6_series">6th-Order Series Bandpass (BP6S)</option>
                <option value="passive_radiator">Passive Radiator (4th Order PR)</option>
                <option value="custom">Custom Topology Builder</option>
              </select>
            </div>
```
(This `<select>` sits directly inside a plain `<div>` with its own `<label>` above it — not wrapped in the `TextField`/`NumberField`-style `FieldWrapper` pattern — so `Listbox` is used here without its own `label` prop, matching the existing separate `<label>` element.)

to:
```tsx
              <Listbox
                value={activeProject.enclosureType}
                onChange={(val) => updateActiveProject({ enclosureType: val as EnclosureType })}
                buttonClassName="w-full border rounded px-2.5 py-1.5 text-xs focus:outline-none flex items-center justify-between gap-2 cursor-pointer text-left"
                options={[
                  { value: "sealed", label: "Sealed (2nd Order Closed Box)" },
                  { value: "ported", label: "Vented (4th Order Bass Reflex)" },
                  { value: "bandpass4", label: "4th-Order Bandpass (BP4)" },
                  { value: "bandpass6_parallel", label: "6th-Order Parallel Bandpass (BP6P)" },
                  { value: "bandpass6_series", label: "6th-Order Series Bandpass (BP6S)" },
                  { value: "passive_radiator", label: "Passive Radiator (4th Order PR)" },
                  { value: "custom", label: "Custom Topology Builder" },
                ]}
              />
            </div>
```

- [ ] **Step 3: Alignment Target (around line 151)**

Change:
```tsx
                  <select
                    value={alignmentPref}
                    onChange={(e) => setAlignmentPref(e.target.value as any)}
                    className="w-full border rounded px-2.5 py-1 text-xs focus:outline-none"
                    style={{ backgroundColor: "var(--sidebar-color)", borderColor: "var(--border-color)", color: "var(--text-color)" }}
                  >
                    <option value="maximally_flat">Maximally Flat (Butterworth)</option>
                    <option value="extended_bass">Extended Bass Shelf</option>
                    <option value="boomy">High-Output / Boomy (Bass Boost)</option>
                  </select>
```
to:
```tsx
                  <Listbox
                    value={alignmentPref}
                    onChange={(val) => setAlignmentPref(val as any)}
                    buttonClassName="w-full border rounded px-2.5 py-1 text-xs focus:outline-none flex items-center justify-between gap-2 cursor-pointer text-left"
                    options={[
                      { value: "maximally_flat", label: "Maximally Flat (Butterworth)" },
                      { value: "extended_bass", label: "Extended Bass Shelf" },
                      { value: "boomy", label: "High-Output / Boomy (Bass Boost)" },
                    ]}
                  />
```

- [ ] **Step 4: Port Shape, primary port (around line 241)**

Change:
```tsx
                  <select
                    value={activeProject.portShape}
                    onChange={(e) => updateActiveProject({ portShape: e.target.value as "circular" | "rectangular" })}
                    className="w-full border rounded px-2.5 py-1.5 text-xs focus:outline-none"
                    style={{
                      backgroundColor: "var(--bg-color)",
                      borderColor: "var(--border-color)",
                      color: "var(--text-color)",
                    }}
                  >
                    <option value="circular">Circular / Cylinder</option>
                    <option value="rectangular">Rectangular / Slot</option>
                  </select>
```
to:
```tsx
                  <Listbox
                    value={activeProject.portShape}
                    onChange={(val) => updateActiveProject({ portShape: val as "circular" | "rectangular" })}
                    buttonClassName="w-full border rounded px-2.5 py-1.5 text-xs focus:outline-none flex items-center justify-between gap-2 cursor-pointer text-left"
                    options={[
                      { value: "circular", label: "Circular / Cylinder" },
                      { value: "rectangular", label: "Rectangular / Slot" },
                    ]}
                  />
```

- [ ] **Step 5: Port Losses (Q factor) — 4 occurrences (around lines 277, 472, 551, 657)**

All 4 are identical in shape (only surrounding context differs — ported, bandpass4, bandpass6_parallel, bandpass6_series). `activeProject.portQ` is typed `number`, and the native `<select>` used numeric `<option value={50}>`; `Listbox`'s `value`/`options[].value` are strings, so this needs explicit coercion at both boundaries. Apply this same transformation at all 4 locations:

Change (each occurrence):
```tsx
                  <select
                    value={activeProject.portQ}
                    onChange={(e) => updateActiveProject({ portQ: parseFloat(e.target.value) })}
                    className="w-full border rounded px-2.5 py-1.5 text-xs focus:outline-none"
                    style={{ backgroundColor: "var(--bg-color)", borderColor: "var(--border-color)", color: "var(--text-color)" }}
                  >
                    <option value={50}>Circular port (Q = 50)</option>
                    <option value={30}>Slot port (Q = 30)</option>
                    <option value={100}>Low-loss / rigid port (Q = 100)</option>
                  </select>
```
to:
```tsx
                  <Listbox
                    value={String(activeProject.portQ)}
                    onChange={(val) => updateActiveProject({ portQ: parseFloat(val) })}
                    buttonClassName="w-full border rounded px-2.5 py-1.5 text-xs focus:outline-none flex items-center justify-between gap-2 cursor-pointer text-left"
                    options={[
                      { value: "50", label: "Circular port (Q = 50)" },
                      { value: "30", label: "Slot port (Q = 30)" },
                      { value: "100", label: "Low-loss / rigid port (Q = 100)" },
                    ]}
                  />
```

- [ ] **Step 6: Port Shape, secondary port (around line 395)**

Change:
```tsx
                        <select
                          value={activeProject.port2Shape}
                          onChange={(e) => updateActiveProject({ port2Shape: e.target.value as "circular" | "rectangular" })}
                          className="border rounded px-1.5 py-0.5 text-xs focus:outline-none"
                          style={{ backgroundColor: "var(--sidebar-color)", borderColor: "var(--border-color)", color: "var(--text-color)" }}
                        >
                          <option value="circular">Circular</option>
                          <option value="rectangular">Rectangular / Slot</option>
                        </select>
```
to:
```tsx
                        <Listbox
                          value={activeProject.port2Shape}
                          onChange={(val) => updateActiveProject({ port2Shape: val as "circular" | "rectangular" })}
                          buttonClassName="border rounded px-1.5 py-0.5 text-xs focus:outline-none flex items-center gap-1.5 cursor-pointer"
                          options={[
                            { value: "circular", label: "Circular" },
                            { value: "rectangular", label: "Rectangular / Slot" },
                          ]}
                        />
```

- [ ] **Step 7: Verify no raw `<select>` remains, and build**

Run: `grep -n "<select" src/components/sidebar/EnclosureTab.tsx`
Expected: no output.

Run: `npm run build`
Expected: succeeds. If `EnclosureType`'s full option list wasn't copied correctly in Step 2, this will surface as either a TypeScript narrowing error or a visibly incomplete dropdown during the task review's diff read — re-check against the original `<option>` list before proceeding.

- [ ] **Step 8: Commit**

```bash
git add src/components/sidebar/EnclosureTab.tsx
git commit -m "refactor: migrate EnclosureTab's 8 select dropdowns to Listbox"
```

---

## Task 7: Retire the old `Select` primitive and its CSS overrides

**Files:**
- Modify: `src/components/ui/Field.tsx` (remove `Select`)
- Modify: `src/components/ui/index.ts` (remove `Select` export)
- Modify: `src/App.css` (remove the `select`/`option` override rules)

**Interfaces:**
- Consumes: confirmation that Tasks 5 and 6 removed every consumer of `Select` and every raw `<select>`.

- [ ] **Step 1: Confirm zero remaining consumers**

Run: `grep -rn "\bSelect\b" src/components src/App.tsx`
Expected: no output referencing the `Select` component (a match on an unrelated word containing "Select" as a substring, e.g. inside a longer identifier, is not a hit — only a standalone `Select` token counts).

Run: `grep -rn "<select" src`
Expected: no output.

If either check finds a remaining usage, stop and fix Task 5 or 6's diff first — do not remove `Select` while something still imports it.

- [ ] **Step 2: Remove the `Select` component and its `SelectProps` interface from `Field.tsx`**

Delete this block from `src/components/ui/Field.tsx` (the last ~24 lines of the file):
```tsx
interface SelectProps {
  label?: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
  className?: string;
}

export function Select({ label, value, onChange, options, className }: SelectProps) {
  return (
    <FieldWrapper label={label} className={className}>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full border rounded px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent-color)]/50"
        style={{ backgroundColor: "var(--bg-color)", borderColor: "var(--border-color)", color: "var(--text-color)" }}
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>
    </FieldWrapper>
  );
}
```

- [ ] **Step 3: Remove the `Select` export from `index.ts`**

Change:
```ts
export { TextField, NumberField, Select } from "./Field";
export { Listbox } from "./Listbox";
```
to:
```ts
export { TextField, NumberField } from "./Field";
export { Listbox } from "./Listbox";
```

- [ ] **Step 4: Remove the native `select`/`option` CSS override rules from `App.css`**

Delete this entire block (it exists solely to theme native `<select>`, which no longer renders anywhere in the app):
```css
/* Force select elements to use theme variables and a custom SVG arrow indicator */
select {
  appearance: none;
  -webkit-appearance: none;
  -moz-appearance: none;
  background-color: var(--bg-color) !important;
  color: var(--text-color) !important;
  border: 1px solid var(--graph-grid-color) !important;
  padding-right: 1.75rem !important;
  background-image: url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%23888888' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e") !important;
  background-position: right 0.5rem center !important;
  background-repeat: no-repeat !important;
  background-size: 1.25em 1.25em !important;
  border-radius: 0.25rem;
}

select:focus {
  border-color: var(--accent-color) !important;
}

option {
  background-color: var(--sidebar-color) !important;
  color: var(--text-color) !important;
}
```
(Note: this block still references the old `var(--graph-grid-color)` name — that's expected, since Task 2 deliberately didn't touch `App.css`, and this whole block is being deleted here rather than migrated.)

- [ ] **Step 5: Verify and commit**

Run: `npm run build`
Expected: succeeds.

```bash
git add src/components/ui/Field.tsx src/components/ui/index.ts src/App.css
git commit -m "refactor: retire native-select-backed Select primitive and its CSS overrides"
```

---

## Task 8: Build the `ColorPicker` primitive

**Files:**
- Create: `src/components/ui/ColorPicker.tsx`
- Modify: `src/components/ui/index.ts` (export `ColorPicker`)

**Interfaces:**
- Produces: `ColorPicker` component — `{ value: string; onChange: (hex: string) => void; label?: string; shape?: "square" | "circle"; className?: string }`. Task 9 depends on this exact shape.

- [ ] **Step 1: Create `src/components/ui/ColorPicker.tsx`**

```tsx
import { useEffect, useRef, useState } from "react";

interface ColorPickerProps {
  value: string;
  onChange: (hex: string) => void;
  label?: string;
  shape?: "square" | "circle";
  className?: string;
}

export function ColorPicker({ value, onChange, label, shape = "square", className }: ColorPickerProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handlePointerDown = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [open]);

  const swatchClass =
    shape === "circle"
      ? "w-5 h-5 rounded-full shrink-0 border border-white/20 shadow-inner cursor-pointer transition-transform hover:scale-110"
      : "w-7 h-7 rounded shrink-0 border cursor-pointer transition hover:brightness-110";

  return (
    <div ref={containerRef} className={`relative inline-flex items-center gap-2 ${className ?? ""}`}>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setOpen((o) => !o);
        }}
        className={swatchClass}
        style={{ backgroundColor: value, borderColor: shape === "circle" ? undefined : "var(--border-color)" }}
        title={label ?? "Change color"}
      />
      {label && <span>{label}</span>}
      {open && (
        <div
          className="absolute left-0 top-full mt-1.5 z-50 rounded-lg border shadow-xl p-3 flex flex-col gap-2 animate-fadeIn"
          style={{ backgroundColor: "var(--sidebar-color)", borderColor: "var(--border-color)" }}
          onClick={(e) => e.stopPropagation()}
        >
          <input
            type="color"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="w-24 h-16 rounded border-0 bg-transparent cursor-pointer p-0"
          />
          <span className="text-2xs font-mono opacity-70 text-center uppercase" style={{ color: "var(--text-muted-color)" }}>
            {value}
          </span>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Export `ColorPicker` from `src/components/ui/index.ts`**

Change:
```ts
export { TextField, NumberField } from "./Field";
export { Listbox } from "./Listbox";
```
to:
```ts
export { TextField, NumberField } from "./Field";
export { Listbox } from "./Listbox";
export { ColorPicker } from "./ColorPicker";
```

- [ ] **Step 3: Verify and commit**

Run: `npm run build`
Expected: succeeds — additive, no consumers yet.

```bash
git add src/components/ui/ColorPicker.tsx src/components/ui/index.ts
git commit -m "feat: add themed ColorPicker primitive to replace native color inputs"
```

---

## Task 9: Migrate 10 color-input call sites to `ColorPicker` (SettingsModal, Toolbar)

**Files:**
- Modify: `src/components/modals/SettingsModal.tsx` (9 `<input type="color">` swatches)
- Modify: `src/components/dashboard/Toolbar.tsx` (1 per-project color circle)

**Interfaces:**
- Consumes: `ColorPicker` from `../ui` (Task 8).

- [ ] **Step 1: `SettingsModal.tsx` — add `ColorPicker` to the `../ui` import**

Change:
```tsx
import { Listbox, Button } from "../ui";
```
to:
```tsx
import { Listbox, Button, ColorPicker } from "../ui";
```

- [ ] **Step 2: `SettingsModal.tsx` — replace all 9 customizer swatches**

Each of the 9 blocks has this shape:
```tsx
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={currentTheme.bgColor}
                  onChange={(e) => handleCustomColorChange("bgColor", e.target.value)}
                  className="w-7 h-7 rounded border bg-transparent cursor-pointer"
                  style={{ borderColor: "var(--border-color)" }}
                />
                <span>Background</span>
              </div>
```
Replace each with:
```tsx
              <ColorPicker
                value={currentTheme.bgColor}
                onChange={(hex) => handleCustomColorChange("bgColor", hex)}
                label="Background"
              />
```

Apply the same transformation to all 9, using each one's existing `AppTheme` key and label text:

| `AppTheme` key | label |
|---|---|
| `bgColor` | Background |
| `sidebarColor` | Sidebar |
| `textColor` | Text Color |
| `accentColor` | Highlight Accent |
| `graphLineColor` | Graph Line |
| `graphGridColor` | Graph Grid |
| `textMutedColor` | Muted Text |
| `warningColor` | Warning |
| `dangerColor` | Danger |

- [ ] **Step 3: `Toolbar.tsx` — add `ColorPicker` to the `../ui` import**

Change:
```tsx
import { Tooltip, useDialog } from "../ui";
```
to:
```tsx
import { Tooltip, useDialog, ColorPicker } from "../ui";
```

- [ ] **Step 4: `Toolbar.tsx` — replace the per-project color circle**

Change:
```tsx
              {/* Project color circle with picker */}
              <div className="relative flex items-center shrink-0">
                <input
                  type="color"
                  value={project.color}
                  onClick={(e) => e.stopPropagation()}
                  onChange={(e) => {
                    setProjectsWithHistory(projects.map(p =>
                      p.id === project.id ? { ...p, color: e.target.value } : p
                    ));
                  }}
                  className="w-5 h-5 rounded-full overflow-hidden border border-white/20 shadow-inner cursor-pointer p-0 shrink-0 bg-transparent transition-transform hover:scale-110"
                  style={{
                    WebkitAppearance: "none",
                    border: "none",
                  }}
                  title="Change project line color"
                />
              </div>
```
to:
```tsx
              {/* Project color circle with picker */}
              <div className="relative flex items-center shrink-0" onClick={(e) => e.stopPropagation()}>
                <ColorPicker
                  shape="circle"
                  value={project.color}
                  onChange={(hex) => {
                    setProjectsWithHistory(projects.map(p =>
                      p.id === project.id ? { ...p, color: hex } : p
                    ));
                  }}
                />
              </div>
```
(The outer `onClick={(e) => e.stopPropagation()}` is moved to the wrapping `<div>` since `ColorPicker`'s own trigger button already calls `stopPropagation` internally — this extra guard preserves the original behavior of not triggering the parent project-tab's `onClick={() => setActiveProjectId(project.id)}` when interacting with the swatch itself, matching the original `<input>`'s inline handler.)

- [ ] **Step 5: Verify no raw `<input type="color">` remains, and build**

Run: `grep -rn 'type="color"' src/components/modals/SettingsModal.tsx src/components/dashboard/Toolbar.tsx`
Expected: no output.

Run: `npm run build`
Expected: succeeds.

- [ ] **Step 6: Commit**

```bash
git add src/components/modals/SettingsModal.tsx src/components/dashboard/Toolbar.tsx
git commit -m "refactor: migrate SettingsModal and Toolbar color inputs to ColorPicker"
```

---

## Task 10: `NumberField` — themed spin buttons, native spinner hidden

**Files:**
- Modify: `src/components/ui/Field.tsx` (`NumberField`)
- Modify: `src/App.css` (scope the spinner-hiding rule to `.nf-input`, leave other number inputs untouched)

**Interfaces:**
- Consumes: nothing new.
- Produces: no signature change to `NumberField`'s public props — this is purely internal.

- [ ] **Step 1: Add the `ChevronUp`/`ChevronDown` import to `Field.tsx`**

Change:
```tsx
import { ReactNode, useEffect, useState } from "react";
```
to:
```tsx
import { ReactNode, useEffect, useState } from "react";
import { ChevronUp, ChevronDown } from "lucide-react";
```

- [ ] **Step 2: Add an `applyDelta` helper and the two spin buttons inside `NumberField`**

Change:
```tsx
export function NumberField({
  label, value, onChange, min, max, step, required, disabled, unit, className, accent = true,
}: NumberFieldProps) {
  // Track the raw typed string locally so intermediate states ("30.", "", "-")
  // aren't clobbered by re-parsing on every keystroke; only sync from the
  // external value when it actually diverges from what's been typed.
  const [rawValue, setRawValue] = useState(String(value));

  useEffect(() => {
    const parsedRaw = parseFloat(rawValue);
    const parsedValue = typeof value === "number" ? value : parseFloat(value);
    if (isNaN(parsedRaw) || parsedRaw !== parsedValue) {
      setRawValue(String(value));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  return (
    <FieldWrapper label={label} className={className}>
      <div className="flex items-center gap-1">
        <input
          type="number"
          min={min}
          max={max}
          step={step ?? "any"}
          required={required}
          disabled={disabled}
          value={rawValue}
          onChange={(e) => {
            const raw = e.target.value;
            setRawValue(raw);
            const parsed = parseFloat(raw);
            if (!isNaN(parsed)) onChange(parsed);
          }}
          className="nf-input w-full border rounded px-2.5 py-1.5 text-sm font-mono text-right focus:outline-none focus:ring-2 focus:ring-[var(--accent-color)]/50 disabled:cursor-not-allowed"
          style={{
            backgroundColor: "var(--bg-color)",
            borderColor: "var(--border-color)",
            color: disabled ? "var(--text-muted-color)" : accent ? "var(--accent-color)" : "var(--text-color)",
          }}
        />
        {unit && <span className="text-xs opacity-60 shrink-0">{unit}</span>}
      </div>
    </FieldWrapper>
  );
}
```
to:
```tsx
export function NumberField({
  label, value, onChange, min, max, step, required, disabled, unit, className, accent = true,
}: NumberFieldProps) {
  // Track the raw typed string locally so intermediate states ("30.", "", "-")
  // aren't clobbered by re-parsing on every keystroke; only sync from the
  // external value when it actually diverges from what's been typed.
  const [rawValue, setRawValue] = useState(String(value));

  useEffect(() => {
    const parsedRaw = parseFloat(rawValue);
    const parsedValue = typeof value === "number" ? value : parseFloat(value);
    if (isNaN(parsedRaw) || parsedRaw !== parsedValue) {
      setRawValue(String(value));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const applyDelta = (delta: number) => {
    const current = parseFloat(rawValue);
    const base = isNaN(current) ? (typeof value === "number" ? value : parseFloat(value) || 0) : current;
    let next = base + delta;
    if (min !== undefined) next = Math.max(min, next);
    if (max !== undefined) next = Math.min(max, next);
    setRawValue(String(next));
    onChange(next);
  };

  const stepValue = typeof step === "number" ? step : 1;

  return (
    <FieldWrapper label={label} className={className}>
      <div className="flex items-center gap-1">
        <input
          type="number"
          min={min}
          max={max}
          step={step ?? "any"}
          required={required}
          disabled={disabled}
          value={rawValue}
          onChange={(e) => {
            const raw = e.target.value;
            setRawValue(raw);
            const parsed = parseFloat(raw);
            if (!isNaN(parsed)) onChange(parsed);
          }}
          className="nf-input w-full border rounded px-2.5 py-1.5 text-sm font-mono text-right focus:outline-none focus:ring-2 focus:ring-[var(--accent-color)]/50 disabled:cursor-not-allowed"
          style={{
            backgroundColor: "var(--bg-color)",
            borderColor: "var(--border-color)",
            color: disabled ? "var(--text-muted-color)" : accent ? "var(--accent-color)" : "var(--text-color)",
          }}
        />
        {!disabled && (
          <div className="flex flex-col shrink-0">
            <button
              type="button"
              tabIndex={-1}
              onClick={() => applyDelta(stepValue)}
              className="h-3 w-4 flex items-center justify-center rounded-t hover:bg-[var(--accent-color)]/20 cursor-pointer"
              style={{ color: "var(--text-muted-color)" }}
              aria-label="Increment"
            >
              <ChevronUp className="h-2.5 w-2.5" />
            </button>
            <button
              type="button"
              tabIndex={-1}
              onClick={() => applyDelta(-stepValue)}
              className="h-3 w-4 flex items-center justify-center rounded-b hover:bg-[var(--accent-color)]/20 cursor-pointer"
              style={{ color: "var(--text-muted-color)" }}
              aria-label="Decrement"
            >
              <ChevronDown className="h-2.5 w-2.5" />
            </button>
          </div>
        )}
        {unit && <span className="text-xs opacity-60 shrink-0">{unit}</span>}
      </div>
    </FieldWrapper>
  );
}
```

- [ ] **Step 3: Scope the webkit spinner-margin rule to exclude `.nf-input`, and hide `.nf-input`'s native spinner**

In `src/App.css`, change:
```css
input[type="number"]::-webkit-inner-spin-button,
input[type="number"]::-webkit-outer-spin-button {
  margin-right: -1.0rem !important; /* Pulls the spinner back to the right border */
  cursor: pointer;
}
```
to:
```css
/* Raw number inputs outside NumberField (Settings axis limits, EQ filter fields,
   Add/Edit Driver's Piston Diameter helper) keep their native spinner, pulled to
   the right border. NumberField's own spinner is fully replaced by its themed
   up/down buttons — see .nf-input below. */
input[type="number"]:not(.nf-input)::-webkit-inner-spin-button,
input[type="number"]:not(.nf-input)::-webkit-outer-spin-button {
  margin-right: -1.0rem !important;
  cursor: pointer;
}

.nf-input {
  -moz-appearance: textfield;
}

.nf-input::-webkit-inner-spin-button,
.nf-input::-webkit-outer-spin-button {
  -webkit-appearance: none;
  margin: 0;
}
```

- [ ] **Step 4: Verify and commit**

Run: `npm run build`
Expected: succeeds.

```bash
git add src/components/ui/Field.tsx src/App.css
git commit -m "feat: add themed spin buttons to NumberField, hide its native spinner"
```

---

## Task 11: `FieldWrapper` label min-height (Add/Edit Driver modal alignment fix)

**Files:**
- Modify: `src/components/ui/Field.tsx` (`FieldWrapper`)

**Interfaces:**
- Consumes: nothing new.
- Produces: no signature change — `TextField`, `NumberField`, and `Listbox` (all built on `FieldWrapper`) inherit this fix automatically.

The Add/Edit Driver modal's 13-field `grid-cols-3` grid (`AddDriverModal.tsx`, `NumberField`s like `"Sensitivity (dB @ 1W/1m) *"` next to `"Qts (Calculated)"`) misaligns because long labels wrap to two lines while short ones don't, shifting each row's input vertically relative to its neighbors. Giving the label a fixed min-height (room for 2 lines at `text-xs`) fixes every grid using these primitives, not just this one modal.

- [ ] **Step 1: Add a min-height to the label in `FieldWrapper`**

Change:
```tsx
export function FieldWrapper({ label, className, children }: FieldWrapperProps) {
  return (
    <div className={className}>
      {label && <label className="text-xs font-semibold opacity-70 uppercase tracking-wider block mb-1">{label}</label>}
      {children}
    </div>
  );
}
```
to:
```tsx
export function FieldWrapper({ label, className, children }: FieldWrapperProps) {
  return (
    <div className={className}>
      {label && (
        <label className="text-xs font-semibold opacity-70 uppercase tracking-wider block mb-1 min-h-8">
          {label}
        </label>
      )}
      {children}
    </div>
  );
}
```
(`min-h-8` is Tailwind's `2rem` utility — two lines of `text-xs` at its default `1rem` line-height.)

- [ ] **Step 2: Verify and commit**

Run: `npm run build`
Expected: succeeds.

```bash
git add src/components/ui/Field.tsx
git commit -m "fix: give FieldWrapper's label a min-height so wrapping labels don't misalign grid rows"
```

---

## Task 12: Sidebar resize + collapse

**Files:**
- Modify: `src/components/sidebar/Sidebar.tsx`

**Interfaces:**
- Consumes: nothing new (local `useState` only, per Global Constraints — no Context, no persistence).

Mirrors the existing drag-resize pattern already used for graph panel heights in `src/hooks/useGraphViewport.ts`'s `handleResizeStart` (window-level `mousemove`/`mouseup` listeners added on `mousedown`, removed on `mouseup`), applied locally inside `Sidebar.tsx` instead of lifted to a hook, since this state has exactly one consumer.

- [ ] **Step 1: Add imports and local state**

Change:
```tsx
import { ReactNode } from "react";
import { Activity, Database, Settings, FilePlus, FolderOpen, Save } from "lucide-react";
import { Tooltip, Button, TextField, CollapsibleSection } from "../ui";
import { useDriverDatabaseContext } from "../../context/DriverDatabaseContext";
import { useModalsContext } from "../../context/ModalsContext";
import { useProjectsContext } from "../../context/ProjectsContext";
import { useSimulationContext } from "../../context/SimulationContext";

export default function Sidebar({ children }: { children: ReactNode }) {
  const { setShowBrowser } = useDriverDatabaseContext();
  const { setShowSettings, sidebarTab, setSidebarTab, sidebarSectionState, toggleSidebarSection } = useModalsContext();
  const { activeProject, updateActiveProject, handleNewProject, handleOpenProject, handleSaveProject } = useProjectsContext();
  const { systemStats } = useSimulationContext();

  return (
    <div
      className="w-80 border-r flex flex-col overflow-hidden transition-colors duration-150 shrink-0"
      style={{ backgroundColor: "var(--sidebar-color)", borderRightColor: "var(--border-color)" }}
    >
```
to:
```tsx
import { ReactNode, useState } from "react";
import { Activity, Database, Settings, FilePlus, FolderOpen, Save, Speaker, Box, Waves, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { Tooltip, Button, TextField, CollapsibleSection } from "../ui";
import { useDriverDatabaseContext } from "../../context/DriverDatabaseContext";
import { useModalsContext } from "../../context/ModalsContext";
import { useProjectsContext } from "../../context/ProjectsContext";
import { useSimulationContext } from "../../context/SimulationContext";

const MIN_WIDTH = 240;
const MAX_WIDTH = 480;
const COLLAPSED_WIDTH = 56;

const SIDEBAR_TABS = [
  { id: "driver", label: "Driver", icon: Speaker },
  { id: "enclosure", label: "Enclosure", icon: Box },
  { id: "signal", label: "Signal", icon: Waves },
] as const;

export default function Sidebar({ children }: { children: ReactNode }) {
  const { setShowBrowser } = useDriverDatabaseContext();
  const { setShowSettings, sidebarTab, setSidebarTab, sidebarSectionState, toggleSidebarSection } = useModalsContext();
  const { activeProject, updateActiveProject, handleNewProject, handleOpenProject, handleSaveProject } = useProjectsContext();
  const { systemStats } = useSimulationContext();

  const [width, setWidth] = useState(320);
  const [collapsed, setCollapsed] = useState(false);

  const handleResizeStart = (e: React.MouseEvent) => {
    e.preventDefault();
    const startX = e.clientX;
    const startWidth = width;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const deltaX = moveEvent.clientX - startX;
      setWidth(Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, startWidth + deltaX)));
    };

    const handleMouseUp = () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
  };

  return (
    <div
      className="relative border-r flex flex-col overflow-hidden transition-[width] duration-150 shrink-0"
      style={{ backgroundColor: "var(--sidebar-color)", borderRightColor: "var(--border-color)", width: collapsed ? COLLAPSED_WIDTH : width }}
    >
```

- [ ] **Step 2: Add the collapse toggle button next to the header's icon buttons**

Change:
```tsx
      {/* Logo */}
      <div className="p-5 border-b flex items-center justify-between" style={{ borderColor: "var(--border-color)" }}>
        <div className="flex items-center gap-2">
          <Activity className="h-6 w-6" style={{ color: "var(--accent-color)" }} />
          <span className="font-bold tracking-wide">WinISD Modern</span>
        </div>
        <div className="flex gap-1.5">
          <Tooltip label="Driver Database">
            <Button variant="icon" onClick={() => setShowBrowser(true)}>
              <Database className="h-4.5 w-4.5" />
            </Button>
          </Tooltip>
          <Tooltip label="Settings">
            <Button variant="icon" onClick={() => setShowSettings(true)}>
              <Settings className="h-4.5 w-4.5" />
            </Button>
          </Tooltip>
        </div>
      </div>
```
to:
```tsx
      {/* Logo */}
      <div className={`p-5 border-b flex items-center ${collapsed ? "flex-col gap-3" : "justify-between"}`} style={{ borderColor: "var(--border-color)" }}>
        {!collapsed && (
          <div className="flex items-center gap-2 min-w-0">
            <Activity className="h-6 w-6 shrink-0" style={{ color: "var(--accent-color)" }} />
            <span className="font-bold tracking-wide truncate">WinISD Modern</span>
          </div>
        )}
        <div className={`flex gap-1.5 ${collapsed ? "flex-col" : ""}`}>
          <Tooltip label={collapsed ? "Expand sidebar" : "Collapse sidebar"}>
            <Button variant="icon" onClick={() => setCollapsed((c) => !c)}>
              {collapsed ? <PanelLeftOpen className="h-4.5 w-4.5" /> : <PanelLeftClose className="h-4.5 w-4.5" />}
            </Button>
          </Tooltip>
          <Tooltip label="Driver Database">
            <Button variant="icon" onClick={() => setShowBrowser(true)}>
              <Database className="h-4.5 w-4.5" />
            </Button>
          </Tooltip>
          <Tooltip label="Settings">
            <Button variant="icon" onClick={() => setShowSettings(true)}>
              <Settings className="h-4.5 w-4.5" />
            </Button>
          </Tooltip>
        </div>
      </div>
```

- [ ] **Step 3: Hide the Project Section while collapsed**

Change:
```tsx
      {/* Project Section */}
      <div className="p-5 border-b flex flex-col gap-3" style={{ borderColor: "var(--border-color)" }}>
```
to:
```tsx
      {/* Project Section */}
      {!collapsed && (
      <div className="p-5 border-b flex flex-col gap-3" style={{ borderColor: "var(--border-color)" }}>
```
and add the matching closing `)}` right after that section's existing closing `</div>` (the one currently right before the `{/* Sidebar Tabs */}` comment).

- [ ] **Step 4: Replace the Sidebar Tabs block with an icon-aware version that still works collapsed**

Change:
```tsx
      {/* Sidebar Tabs */}
      <div className="flex border-b text-xs font-semibold select-none shrink-0" style={{ borderColor: "var(--border-color)" }}>
        {[
          { id: "driver", label: "Driver" },
          { id: "enclosure", label: "Enclosure" },
          { id: "signal", label: "Signal" },
        ].map((tab) => {
          const isSelected = sidebarTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setSidebarTab(tab.id as typeof sidebarTab)}
              className={`flex-1 py-3 text-center border-b-2 transition-all font-bold cursor-pointer ${
                isSelected
                  ? "text-[var(--accent-color)] border-[var(--accent-color)] bg-black/5"
                  : "opacity-60 border-transparent hover:opacity-100"
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Scrollable inputs */}
      <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-5">
        {children}
      </div>

      {/* Permanently Docked System Statistics */}
      {systemStats.length > 0 && (
```
to:
```tsx
      {/* Sidebar Tabs */}
      <div className={`flex text-xs font-semibold select-none shrink-0 ${collapsed ? "flex-col border-b" : "border-b"}`} style={{ borderColor: "var(--border-color)" }}>
        {SIDEBAR_TABS.map((tab) => {
          const isSelected = sidebarTab === tab.id;
          const Icon = tab.icon;
          return (
            <Tooltip key={tab.id} label={collapsed ? tab.label : ""}>
              <button
                onClick={() => setSidebarTab(tab.id)}
                className={`${collapsed ? "w-full py-3" : "flex-1 py-3"} flex items-center justify-center gap-1.5 text-center border-b-2 transition-all font-bold cursor-pointer ${
                  isSelected
                    ? "text-[var(--accent-color)] border-[var(--accent-color)] bg-black/5"
                    : "opacity-60 border-transparent hover:opacity-100"
                }`}
              >
                {collapsed ? <Icon className="h-4.5 w-4.5" /> : tab.label}
              </button>
            </Tooltip>
          );
        })}
      </div>

      {/* Scrollable inputs */}
      {!collapsed && (
        <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-5">
          {children}
        </div>
      )}
      {collapsed && <div className="flex-1" />}

      {/* Permanently Docked System Statistics */}
      {!collapsed && systemStats.length > 0 && (
```
(`Tooltip label={collapsed ? tab.label : ""}` renders an empty tooltip when expanded — harmless, since `Tooltip` only shows its content on hover/focus and an empty `<span>` is invisible; this keeps the tab list's structure identical in both states without a second code path. The `{collapsed && <div className="flex-1" />}` keeps the flex layout's proportions stable so the Docked Stats panel — hidden while collapsed — doesn't cause the tab bar to visually jump.)

Also change the docked-stats block's own closing condition to match — it was previously `{systemStats.length > 0 && (`, now gated additionally on `!collapsed` as shown above. No other changes needed inside that block.

- [ ] **Step 5: Add the drag handle on the right edge**

Right before the component's final closing `</div>` (the outermost sidebar container's closing tag), add:
```tsx
      {/* Resize handle */}
      {!collapsed && (
        <div
          onMouseDown={handleResizeStart}
          className="absolute top-0 right-0 h-full w-1.5 cursor-col-resize hover:bg-[var(--accent-color)]/20 active:bg-[var(--accent-color)]/30 transition-colors z-10"
        />
      )}
    </div>
  );
}
```
(This relies on the outer container already being `className="relative ..."`, set in Step 1.)

- [ ] **Step 6: Verify and commit**

Run: `npm run build`
Expected: succeeds.

```bash
git add src/components/sidebar/Sidebar.tsx
git commit -m "feat: add sidebar drag-to-resize and icon-only collapse rail"
```

---

## Task 13: Manufacturer autocomplete

**Files:**
- Modify: `src/components/ui/Field.tsx` (`TextField` gains `list?: string`)
- Modify: `src/components/modals/AddDriverModal.tsx` (`<datalist>` + wiring)

**Interfaces:**
- Consumes: `useDriverDatabaseContext().drivers: Driver[]` (already used in `AddDriverModalContent`, `Driver.manufacturer: string`).
- Produces: `TextField`'s `list?: string` prop, passed through to the underlying `<input>`'s native `list` attribute.

- [ ] **Step 1: Add `list?: string` to `TextField`**

Change:
```tsx
interface TextFieldProps {
  label?: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  required?: boolean;
  className?: string;
  monospace?: boolean;
}

export function TextField({ label, value, onChange, placeholder, required, className, monospace }: TextFieldProps) {
  return (
    <FieldWrapper label={label} className={className}>
      <input
        type="text"
        required={required}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`w-full border rounded px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent-color)]/50 ${monospace ? "font-mono" : ""}`}
        style={{ backgroundColor: "var(--bg-color)", borderColor: "var(--border-color)", color: "var(--text-color)" }}
      />
    </FieldWrapper>
  );
}
```
to:
```tsx
interface TextFieldProps {
  label?: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  required?: boolean;
  className?: string;
  monospace?: boolean;
  list?: string;
}

export function TextField({ label, value, onChange, placeholder, required, className, monospace, list }: TextFieldProps) {
  return (
    <FieldWrapper label={label} className={className}>
      <input
        type="text"
        required={required}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        list={list}
        className={`w-full border rounded px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent-color)]/50 ${monospace ? "font-mono" : ""}`}
        style={{ backgroundColor: "var(--bg-color)", borderColor: "var(--border-color)", color: "var(--text-color)" }}
      />
    </FieldWrapper>
  );
}
```

- [ ] **Step 2: Wire the datalist into `AddDriverModal.tsx`**

Change the Manufacturer field:
```tsx
            <TextField label="Manufacturer *" required placeholder="e.g. B&C Speakers" value={newManufacturer} onChange={setNewManufacturer} />
```
to:
```tsx
            <TextField label="Manufacturer *" required placeholder="e.g. B&C Speakers" value={newManufacturer} onChange={setNewManufacturer} list="manufacturer-suggestions" />
```

Then, immediately after the `<form>`'s closing `</form>` tag but still inside the outer modal `<div>` (i.e. as a sibling of `<form>`, not inside it — `<datalist>` doesn't need to be inside the form it's associated with, only the `list`-attributed `<input>` needs to reference its `id`), add:
```tsx
        <datalist id="manufacturer-suggestions">
          {Array.from(new Set(drivers.map((d) => d.manufacturer))).sort().map((m) => (
            <option key={m} value={m} />
          ))}
        </datalist>
```
So the end of the file's `AddDriverModalContent` return statement becomes:
```tsx
        <form onSubmit={handleAddDriver} className="flex-1 overflow-y-auto p-6 flex flex-col gap-5">
          {/* ...unchanged form contents... */}
        </form>
        <datalist id="manufacturer-suggestions">
          {Array.from(new Set(drivers.map((d) => d.manufacturer))).sort().map((m) => (
            <option key={m} value={m} />
          ))}
        </datalist>
      </div>
    </div>
  );
}
```
(`drivers` is already destructured from `useDriverDatabaseContext()` at the top of `AddDriverModalContent` — no new import needed.)

- [ ] **Step 3: Verify and commit**

Run: `npm run build`
Expected: succeeds.

```bash
git add src/components/ui/Field.tsx src/components/modals/AddDriverModal.tsx
git commit -m "feat: add manufacturer autocomplete to Add/Edit Driver modal"
```

---

## Task 14: Drop shadows for depth

**Files:**
- Modify: `src/components/ui/CollapsibleSection.tsx`
- Modify: `src/components/sidebar/Sidebar.tsx`

**Interfaces:**
- Consumes: nothing new.

- [ ] **Step 1: Add a subtle shadow to `CollapsibleSection`'s panel body**

Change:
```tsx
      {open && (
        <div className="p-3 flex flex-col gap-3" style={{ backgroundColor: "var(--bg-color)" }}>
          {children}
        </div>
      )}
```
to:
```tsx
      {open && (
        <div className="p-3 flex flex-col gap-3 shadow-[inset_0_2px_6px_-2px_rgba(0,0,0,0.35)]" style={{ backgroundColor: "var(--bg-color)" }}>
          {children}
        </div>
      )}
```
(An inset shadow is used here rather than a drop shadow — this panel body sits flush inside the section's own border with no visible edge to cast a shadow onto, so an outward `shadow-md` would render invisible; the inset variant reads as the content sitting slightly recessed relative to the header, giving the same sense of depth without a stray shadow bleeding past the rounded border.)

- [ ] **Step 2: Add a drop shadow to `Sidebar.tsx`'s outer container**

In `src/components/sidebar/Sidebar.tsx`, add `shadow-xl` to the outer container's `className` (set up in Task 12 Step 1 as `className="relative border-r flex flex-col overflow-hidden transition-[width] duration-150 shrink-0"`):

Change:
```tsx
    <div
      className="relative border-r flex flex-col overflow-hidden transition-[width] duration-150 shrink-0"
      style={{ backgroundColor: "var(--sidebar-color)", borderRightColor: "var(--border-color)", width: collapsed ? COLLAPSED_WIDTH : width }}
    >
```
to:
```tsx
    <div
      className="relative border-r flex flex-col overflow-hidden transition-[width] duration-150 shrink-0 shadow-xl"
      style={{ backgroundColor: "var(--sidebar-color)", borderRightColor: "var(--border-color)", width: collapsed ? COLLAPSED_WIDTH : width }}
    >
```
(This task must land after Task 12, since it edits the exact container `className` string Task 12 introduces. If executed out of order, apply the same `shadow-xl` addition to whatever the current outer container `className` is.)

- [ ] **Step 3: Verify and commit**

Run: `npm run build`
Expected: succeeds.

```bash
git add src/components/ui/CollapsibleSection.tsx src/components/sidebar/Sidebar.tsx
git commit -m "style: add depth shadows to CollapsibleSection panels and the sidebar"
```

---

## Task 15: Final verification

**Files:** none (verification only)

**Interfaces:** none.

- [ ] **Step 1: Full build**

Run: `npm run build`
Expected: succeeds with zero TypeScript errors and a clean Vite production build.

- [ ] **Step 2: Test suite (unaffected by this batch, but confirms no regression)**

Run: `npm test`
Expected: all existing tests still pass (this batch touches no files under `src/lib/`, so the extracted pure-function test suite from the modularization plan should be unaffected).

- [ ] **Step 3: Confirm the token split is complete**

Run: `grep -rln "graph-grid-color" src`
Expected: exactly 3 files — `src/theme.ts` (the `graphGridColor` property name), `src/components/dashboard/GraphPanel.tsx` (its 2 legitimate SVG gridline `stroke` uses), `src/hooks/useSimulation.ts` (the SVG-export string substitution, intentionally unchanged).

- [ ] **Step 4: Confirm no native form controls remain where a themed primitive now exists**

Run: `grep -rn "<select" src`
Expected: no output.

Run: `grep -rn 'type="color"' src/components`
Expected: no output (the only remaining `type="color"` in the codebase, if any, should be inside `ColorPicker.tsx` itself — check that any match is there and nowhere else).

- [ ] **Step 5: Report**

No commit for this task — it's a verification-only gate. If all 4 steps pass, the batch is complete and ready for the final whole-branch review.
