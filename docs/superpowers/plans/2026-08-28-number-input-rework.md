# Number Input Rework Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace ~63 hand-rolled number-input call sites across 6 sidebar/modal files with two shared, consistent components (`NumberField` for label-above contexts, a new `NumberRow` for label-left single-line rows); replace the just-added spin buttons with scroll-to-adjust; fuse unit labels into the input box instead of floating them outside it; remove 5 of 6 redundant range sliders (fixing the 6th's invisible track); and make the sidebar's drag-resize snap to fully collapsed below a sensible width instead of clamping to a cramped expanded state.

**Architecture:** One new internal `NumberInputBox` (inside `Field.tsx`, not exported) holds all the actual behavior — raw-string typing tolerance, scroll-to-adjust via a native (non-passive) wheel listener, and the fused unit suffix — so both `NumberField` (label above, via the existing `FieldWrapper`) and the new `NumberRow` (label to the left, inline) share one implementation. Every raw `<input type="number">` in `EnclosureTab.tsx`, `SignalTab.tsx`, `DriverTab.tsx`, `SettingsModal.tsx`, and `DimensionCalculator.tsx` is migrated to one or the other, matching whichever layout that field already used (label-above → `NumberField`, label-left → `NumberRow`). `Sidebar.tsx`'s drag handler gains a live-cursor-position collapse trigger, independent of the existing width clamp.

**Tech Stack:** React 19 + TypeScript, Tailwind CSS v4, lucide-react. No new dependencies.

**Spec:** `docs/superpowers/specs/2026-08-28-number-input-rework-design.md`

## Global Constraints

- No changes to `src-tauri/` (Rust backend).
- `NumberField`'s existing public prop signature (`label?`, `value`, `onChange: (value: number) => void`, `min?`, `max?`, `step?`, `required?`, `disabled?`, `unit?`, `className?`, `accent?`) does not change — every existing call site (all 13 in `AddDriverModal.tsx`) keeps working unmodified.
- `NumberRow`'s props: `label: string` (always required — it's the compact inline variant, a label-less row has nothing to align against), `value: number | string`, `onChange: (value: number) => void`, `min?`, `max?`, `step?`, `unit?`, `className?` (outer row), `boxClassName?` (override the value box's default width), `accent?`.
- Scroll-to-adjust only fires while the specific input is focused (never on hover alone) — implemented via a native `wheel` listener attached with `{ passive: false }` (React's JSX `onWheel` prop is passive by default and cannot `preventDefault()`).
- Unit suffix renders **inside** the same bordered box as the number (dimmed, right-padded), not as a separate element after it.
- Five sliders are removed (Input Power, Cabin Corner Freq, Box Volume, Tuning Freq, Port Diameter); the Wall Absorption slider is kept, with its track color fixed (`var(--bg-color)` → `var(--border-color)`, since the track currently matches its own panel's background and is invisible).
- Sidebar resize: floor raised from 240px to 280px while expanded; dragging past a **live cursor position** of 200px (not the clamped rendered width) snaps to the collapsed 56px rail; a resize handle is available in both expanded and collapsed states so the rail itself can be dragged back out.
- **Deviation from the spec, decided during plan-writing:** the spec's `FieldWrapper` "always reserve label space" hardening is dropped. Auditing every current `FieldWrapper` consumer (`TextField`/`NumberField`/`Listbox`) found exactly one call site with no label — `DriverBrowserModal.tsx`'s search field — and it is standalone (no labeled sibling in a grid), not part of any group this bug could affect. Forcing an always-present label slot would add unwanted empty space above that field for no benefit, since the actual reported misalignment (traced to `EnclosureTab.tsx`'s ~40 independently-drifted raw inputs) is fully fixed by this plan's migration to two consistent shared components — the root cause was inconsistent components, not `FieldWrapper`'s conditional label. No task in this plan touches `FieldWrapper`.
- Verification throughout is `npm run build` (`tsc` + `vite build`) and `npm test` (the pre-existing `src/lib/` suite, unaffected by this batch) — no live browser in this environment, so a careful diff read is the primary quality gate, as in the prior two UI-polish rounds. The scroll-adjust wheel listener and the sidebar's live-cursor collapse-trigger math are the two pieces of genuinely new interaction logic in this batch — worth an especially careful trace during task review, the same way the prior round's `Listbox`/`ColorPicker` interaction logic was.

---

## Task 1: `NumberInputBox` core + `NumberField` rewrite

**Files:**
- Modify: `src/components/ui/Field.tsx`

**Interfaces:**
- Produces: an internal (not exported) `NumberInputBox` component — `{ value: number | string; onChange: (value: number) => void; min?: number; max?: number; step?: number | "any"; required?: boolean; disabled?: boolean; unit?: string; accent?: boolean; className?: string }`. Task 2's `NumberRow` depends on this exact shape/name.
- `NumberField`'s public prop signature is unchanged (see Global Constraints) — only its internals change.

- [ ] **Step 1: Replace `Field.tsx`'s imports and `NumberField`/add `NumberInputBox`**

Read the current file first (`src/components/ui/Field.tsx`) to confirm it still matches this "before" — it should be unchanged since the prior round's Task 11 (`FieldWrapper`'s `min-h-8`) and Task 13 (`TextField`'s `list` prop):

```tsx
import { ReactNode, useEffect, useState } from "react";
import { ChevronUp, ChevronDown } from "lucide-react";

interface FieldWrapperProps {
  label?: string;
  className?: string;
  children: ReactNode;
}

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

interface NumberFieldProps {
  label?: string;
  value: number | string;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number | "any";
  required?: boolean;
  disabled?: boolean;
  unit?: string;
  className?: string;
  accent?: boolean;
}

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

Replace the `import` line and everything from `interface NumberFieldProps` to the end of `NumberField` with:

```tsx
import { ReactNode, useEffect, useRef, useState } from "react";
```

(drop the `ChevronUp`/`ChevronDown` import — the spin buttons are gone, nothing else in the file uses lucide-react icons)

```tsx
interface NumberInputBoxProps {
  value: number | string;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number | "any";
  required?: boolean;
  disabled?: boolean;
  unit?: string;
  accent?: boolean;
  className?: string;
}

// Shared by NumberField (label-above) and NumberRow (label-left): the actual
// bordered value box. Keeps the raw-string typing tolerance that fixed an
// earlier Critical bug (intermediate states like "30." or "" no longer get
// clobbered mid-keystroke), adds scroll-to-adjust while focused, and fuses
// the unit suffix inside the same box instead of floating it outside.
function NumberInputBox({
  value, onChange, min, max, step, required, disabled, unit, accent = true, className,
}: NumberInputBoxProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [rawValue, setRawValue] = useState(String(value));
  const rawValueRef = useRef(rawValue);
  rawValueRef.current = rawValue;

  useEffect(() => {
    const parsedRaw = parseFloat(rawValue);
    const parsedValue = typeof value === "number" ? value : parseFloat(value);
    if (isNaN(parsedRaw) || parsedRaw !== parsedValue) {
      setRawValue(String(value));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const stepValue = typeof step === "number" ? step : 1;

  // React's onWheel prop attaches a passive listener by default, so calling
  // preventDefault() from it is silently ignored (and warns) — only a
  // manually-attached, { passive: false } native listener can actually stop
  // the page from also scrolling while a focused field is being adjusted.
  // Scroll-adjust only fires while this exact input is focused, so normal
  // page/sidebar scrolling is untouched otherwise.
  useEffect(() => {
    const el = inputRef.current;
    if (!el || disabled) return;
    const handleWheel = (e: WheelEvent) => {
      if (document.activeElement !== el) return;
      e.preventDefault();
      const current = parseFloat(rawValueRef.current);
      const base = isNaN(current) ? (typeof value === "number" ? value : parseFloat(value) || 0) : current;
      let next = base + (e.deltaY < 0 ? stepValue : -stepValue);
      if (min !== undefined) next = Math.max(min, next);
      if (max !== undefined) next = Math.min(max, next);
      setRawValue(String(next));
      onChange(next);
    };
    el.addEventListener("wheel", handleWheel, { passive: false });
    return () => el.removeEventListener("wheel", handleWheel);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [min, max, stepValue, onChange, value, disabled]);

  return (
    <div
      className={`flex items-center border rounded overflow-hidden ${className ?? "w-24"}`}
      style={{ backgroundColor: "var(--bg-color)", borderColor: "var(--border-color)" }}
    >
      <input
        ref={inputRef}
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
        className="nf-input min-w-0 flex-1 border-none bg-transparent px-1.5 py-1 text-right font-mono text-xs focus:outline-none disabled:cursor-not-allowed"
        style={{ color: disabled ? "var(--text-muted-color)" : accent ? "var(--accent-color)" : "var(--text-color)" }}
      />
      {unit && (
        <span className="pr-1.5 text-2xs shrink-0" style={{ color: "var(--text-muted-color)" }}>
          {unit}
        </span>
      )}
    </div>
  );
}

interface NumberFieldProps {
  label?: string;
  value: number | string;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number | "any";
  required?: boolean;
  disabled?: boolean;
  unit?: string;
  className?: string;
  accent?: boolean;
}

export function NumberField({
  label, value, onChange, min, max, step, required, disabled, unit, className, accent = true,
}: NumberFieldProps) {
  return (
    <FieldWrapper label={label} className={className}>
      <NumberInputBox
        value={value}
        onChange={onChange}
        min={min}
        max={max}
        step={step}
        required={required}
        disabled={disabled}
        unit={unit}
        accent={accent}
        className="w-full"
      />
    </FieldWrapper>
  );
}
```

The `.nf-input` CSS in `src/App.css` (added in the prior round) still applies unchanged — it hides the native spinner on any input carrying that class, which `NumberInputBox`'s `<input>` still does.

- [ ] **Step 2: Verify and commit**

Run: `npm run build`
Expected: succeeds. `AddDriverModal.tsx`'s 13 existing `NumberField` call sites are unaffected (same public props), so this is a safe internal rewrite.

```bash
git add src/components/ui/Field.tsx
git commit -m "refactor: extract NumberInputBox core, replace NumberField's spin buttons with scroll-to-adjust"
```

---

## Task 2: `NumberRow` component

**Files:**
- Modify: `src/components/ui/Field.tsx`
- Modify: `src/components/ui/index.ts`

**Interfaces:**
- Consumes: `NumberInputBox` from Task 1 (same file, no import needed).
- Produces: `NumberRow` — `{ label: string; value: number | string; onChange: (value: number) => void; min?: number; max?: number; step?: number | "any"; unit?: string; className?: string; boxClassName?: string; accent?: boolean }`. Every migration task (3 onward) depends on this exact shape.

- [ ] **Step 1: Add `NumberRow` to `Field.tsx`**

Append after `NumberField`:

```tsx
interface NumberRowProps {
  label: string;
  value: number | string;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number | "any";
  unit?: string;
  className?: string;
  boxClassName?: string;
  accent?: boolean;
}

// Compact single-line variant: label to the left, fixed-width value box to
// the right (default w-24, override via boxClassName for narrower contexts).
// Used wherever a field sits in a "label left, value right" row instead of
// a label-above grid — see NumberField for that shape.
export function NumberRow({ label, value, onChange, min, max, step, unit, className, boxClassName, accent = true }: NumberRowProps) {
  return (
    <div className={`flex justify-between items-center text-xs ${className ?? ""}`}>
      <span className="opacity-70">{label}</span>
      <NumberInputBox
        value={value}
        onChange={onChange}
        min={min}
        max={max}
        step={step}
        unit={unit}
        accent={accent}
        className={boxClassName}
      />
    </div>
  );
}
```

- [ ] **Step 2: Export `NumberRow` from `index.ts`**

Change:
```ts
export { TextField, NumberField } from "./Field";
```
to:
```ts
export { TextField, NumberField, NumberRow } from "./Field";
```

- [ ] **Step 3: Verify and commit**

Run: `npm run build`
Expected: succeeds — `NumberRow` is additive, no consumers yet.

```bash
git add src/components/ui/Field.tsx src/components/ui/index.ts
git commit -m "feat: add NumberRow, the compact label-left number input variant"
```

---

## Task 3: `SettingsModal.tsx` — migrate 6 fields to `NumberField`

**Files:**
- Modify: `src/components/modals/SettingsModal.tsx`

**Interfaces:**
- Consumes: `NumberField` from `../ui` (already imported there? No — currently only `Listbox, Button, ColorPicker` are imported; add `NumberField`).

All 6 of this file's raw number inputs already use the "label above, full width" shape (each `<div><label>...</label><input.../></div>` inside a `grid-cols-2`) — this is exactly `NumberField`'s existing block layout, so migration is a direct swap with no layout restructuring. `NumberField` guarantees a valid parsed number on every `onChange` call, so the `|| default` fallbacks in the original `onChange` handlers (needed only because raw `parseInt`/`parseFloat` on a DOM event value can yield `NaN`) are no longer needed.

- [ ] **Step 1: Add `NumberField` to the import**

Change:
```tsx
import { Listbox, Button, ColorPicker } from "../ui";
```
to:
```tsx
import { Listbox, Button, ColorPicker, NumberField } from "../ui";
```

- [ ] **Step 2: Global Min/Max Freq**

Change:
```tsx
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-2xs opacity-70 block mb-1">Global Min Freq (Hz)</label>
                  <input
                    type="number"
                    min="1"
                    value={globalXMin}
                    onChange={(e) => setGlobalXMin(Math.max(1, parseInt(e.target.value) || 10))}
                    className="w-full border rounded px-2.5 py-1.5 text-xs font-mono"
                    style={{ backgroundColor: "var(--bg-color)", borderColor: "var(--border-color)", color: "var(--text-color)" }}
                  />
                </div>
                <div>
                  <label className="text-2xs opacity-70 block mb-1">Global Max Freq (Hz)</label>
                  <input
                    type="number"
                    min="10"
                    value={globalXMax}
                    onChange={(e) => setGlobalXMax(Math.max(10, parseInt(e.target.value) || 2000))}
                    className="w-full border rounded px-2.5 py-1.5 text-xs font-mono"
                    style={{ backgroundColor: "var(--bg-color)", borderColor: "var(--border-color)", color: "var(--text-color)" }}
                  />
                </div>
              </div>
```
to:
```tsx
              <div className="grid grid-cols-2 gap-3">
                <NumberField
                  label="Global Min Freq (Hz)"
                  min={1}
                  value={globalXMin}
                  onChange={(v) => setGlobalXMin(Math.max(1, Math.round(v)))}
                />
                <NumberField
                  label="Global Max Freq (Hz)"
                  min={10}
                  value={globalXMax}
                  onChange={(v) => setGlobalXMax(Math.max(10, Math.round(v)))}
                />
              </div>
```

- [ ] **Step 3: X-Axis Min/Max Frequency (conditional block)**

Change:
```tsx
                <div className="grid grid-cols-2 gap-3 animate-fadeIn">
                  <div>
                    <label className="text-2xs opacity-70 block mb-1">X-Axis Min Frequency (Hz)</label>
                    <input
                      type="number"
                      min="1"
                      value={graphConfigs[configEditType].xMin}
                      onChange={(e) => updateViewportConfig(configEditType, "xMin", Math.max(1, parseInt(e.target.value) || 10))}
                      className="w-full border rounded px-2.5 py-1.5 text-xs font-mono"
                      style={{ backgroundColor: "var(--bg-color)", borderColor: "var(--border-color)", color: "var(--text-color)" }}
                    />
                  </div>
                  <div>
                    <label className="text-2xs opacity-70 block mb-1">X-Axis Max Frequency (Hz)</label>
                    <input
                      type="number"
                      min="10"
                      value={graphConfigs[configEditType].xMax}
                      onChange={(e) => updateViewportConfig(configEditType, "xMax", Math.max(10, parseInt(e.target.value) || 2000))}
                      className="w-full border rounded px-2.5 py-1.5 text-xs font-mono"
                      style={{ backgroundColor: "var(--bg-color)", borderColor: "var(--border-color)", color: "var(--text-color)" }}
                    />
                  </div>
                </div>
```
to:
```tsx
                <div className="grid grid-cols-2 gap-3 animate-fadeIn">
                  <NumberField
                    label="X-Axis Min Frequency (Hz)"
                    min={1}
                    value={graphConfigs[configEditType].xMin}
                    onChange={(v) => updateViewportConfig(configEditType, "xMin", Math.max(1, Math.round(v)))}
                  />
                  <NumberField
                    label="X-Axis Max Frequency (Hz)"
                    min={10}
                    value={graphConfigs[configEditType].xMax}
                    onChange={(v) => updateViewportConfig(configEditType, "xMax", Math.max(10, Math.round(v)))}
                  />
                </div>
```

- [ ] **Step 4: Y-Axis Floor/Ceiling (conditional block)**

Change:
```tsx
                  <div className="grid grid-cols-2 gap-3 animate-fadeIn">
                    <div>
                      <label className="text-2xs opacity-70 block mb-1">Y-Axis Floor ({yUnit})</label>
                      <input
                        type="number"
                        value={graphConfigs[configEditType].yMin}
                        onChange={(e) => updateViewportConfig(configEditType, "yMin", parseFloat(e.target.value) || 0)}
                        className="w-full border rounded px-2.5 py-1.5 text-xs font-mono"
                      style={{ backgroundColor: "var(--bg-color)", borderColor: "var(--border-color)", color: "var(--text-color)" }}
                      />
                    </div>
                    <div>
                      <label className="text-2xs opacity-70 block mb-1">Y-Axis Ceiling ({yUnit})</label>
                      <input
                        type="number"
                        value={graphConfigs[configEditType].yMax}
                        onChange={(e) => updateViewportConfig(configEditType, "yMax", parseFloat(e.target.value) || 10)}
                        className="w-full border rounded px-2.5 py-1.5 text-xs font-mono"
                      style={{ backgroundColor: "var(--bg-color)", borderColor: "var(--border-color)", color: "var(--text-color)" }}
                      />
                    </div>
                  </div>
```
to:
```tsx
                  <div className="grid grid-cols-2 gap-3 animate-fadeIn">
                    <NumberField
                      label={`Y-Axis Floor (${yUnit})`}
                      value={graphConfigs[configEditType].yMin}
                      onChange={(v) => updateViewportConfig(configEditType, "yMin", v)}
                    />
                    <NumberField
                      label={`Y-Axis Ceiling (${yUnit})`}
                      value={graphConfigs[configEditType].yMax}
                      onChange={(v) => updateViewportConfig(configEditType, "yMax", v)}
                    />
                  </div>
```

- [ ] **Step 5: Verify no raw `<input type="number">` remains, and build**

Run: `grep -n 'type="number"' src/components/modals/SettingsModal.tsx`
Expected: no output.

Run: `npm run build`
Expected: succeeds.

- [ ] **Step 6: Commit**

```bash
git add src/components/modals/SettingsModal.tsx
git commit -m "refactor: migrate SettingsModal's 6 number inputs to NumberField"
```

---

## Task 4: `DimensionCalculator.tsx` and `DriverTab.tsx` migration

**Files:**
- Modify: `src/components/sidebar/DimensionCalculator.tsx`
- Modify: `src/components/sidebar/DriverTab.tsx`

**Interfaces:**
- Consumes: `NumberField`, `NumberRow` from `../ui`.

`DimensionCalculator.tsx` currently stores its 8 editable values as `useState<string>` (`calcVb`, `calcRatioL`, `calcRatioW`, `calcRatioD`, `calcExtL`, `calcExtW`, `calcExtD`, `calcThickness`), each re-parsed with `parseFloat(...) || default` on every use — a local reimplementation of the exact raw-string-tolerance problem `NumberInputBox` already solves internally. Migrating to `NumberField`/`NumberRow` (which take a numeric `value`/`onChange`) means these can become `useState<number>`, dropping every `parseFloat(...) || default` call site in favor of the state's own guaranteed-valid value.

- [ ] **Step 1: Add the import to `DimensionCalculator.tsx`**

Change:
```tsx
import { CollapsibleSection } from "../ui";
```
to:
```tsx
import { CollapsibleSection, NumberField, NumberRow } from "../ui";
```

- [ ] **Step 2: Convert the 8 local states from string to number**

Change:
```tsx
  const [calcMode, setCalcMode] = useState<"vb-to-dims" | "dims-to-vb">("vb-to-dims");
  const [calcVb, setCalcVb] = useState("150");
  const [calcRatioL, setCalcRatioL] = useState("1.618");
  const [calcRatioW, setCalcRatioW] = useState("1");
  const [calcRatioD, setCalcRatioD] = useState("0.618");
  const [calcExtL, setCalcExtL] = useState("60");
  const [calcExtW, setCalcExtW] = useState("40");
  const [calcExtD, setCalcExtD] = useState("35");
  const [calcThickness, setCalcThickness] = useState("18");
```
to:
```tsx
  const [calcMode, setCalcMode] = useState<"vb-to-dims" | "dims-to-vb">("vb-to-dims");
  const [calcVb, setCalcVb] = useState(150);
  const [calcRatioL, setCalcRatioL] = useState(1.618);
  const [calcRatioW, setCalcRatioW] = useState(1);
  const [calcRatioD, setCalcRatioD] = useState(0.618);
  const [calcExtL, setCalcExtL] = useState(60);
  const [calcExtW, setCalcExtW] = useState(40);
  const [calcExtD, setCalcExtD] = useState(35);
  const [calcThickness, setCalcThickness] = useState(18);
```

- [ ] **Step 3: Simplify the derived calculations to drop the now-unneeded `parseFloat(...) || default`**

Change:
```tsx
                // ── Vb → LxWxD ──────────────────────────────────────────
                const vbNum   = parseFloat(calcVb)  || 0;
                const rL      = parseFloat(calcRatioL) || 1.618;
                void calcRatioW; // rW = 1 is the reference denominator; formula uses rL and rD only
                const rD      = parseFloat(calcRatioD) || 0.618;
                const vCm3    = vbNum * 1000;
                const wCalc   = vCm3 > 0 ? Math.cbrt(vCm3 / (rL * rD)) : 0;
                const lCalc   = wCalc * rL;
                const dCalc   = wCalc * rD;

                // ── Dims → Vb ───────────────────────────────────────────
                const thMm  = parseFloat(calcThickness) || 18;
                const extL  = parseFloat(calcExtL) || 0;
                const extW  = parseFloat(calcExtW) || 0;
                const extD  = parseFloat(calcExtD) || 0;
                const intL  = Math.max(0, extL - 2 * thMm / 10); // cm
                const intW  = Math.max(0, extW - 2 * thMm / 10);
                const intD  = Math.max(0, extD - 2 * thMm / 10);
                const grossVb = intL * intW * intD / 1000; // litres
```
to:
```tsx
                // ── Vb → LxWxD ──────────────────────────────────────────
                const vbNum   = calcVb;
                const rL      = calcRatioL;
                void calcRatioW; // rW = 1 is the reference denominator; formula uses rL and rD only
                const rD      = calcRatioD;
                const vCm3    = vbNum * 1000;
                const wCalc   = vCm3 > 0 ? Math.cbrt(vCm3 / (rL * rD)) : 0;
                const lCalc   = wCalc * rL;
                const dCalc   = wCalc * rD;

                // ── Dims → Vb ───────────────────────────────────────────
                const thMm  = calcThickness;
                const extL  = calcExtL;
                const extW  = calcExtW;
                const extD  = calcExtD;
                const intL  = Math.max(0, extL - 2 * thMm / 10); // cm
                const intW  = Math.max(0, extW - 2 * thMm / 10);
                const intD  = Math.max(0, extD - 2 * thMm / 10);
                const grossVb = intL * intW * intD / 1000; // litres
```

- [ ] **Step 4: Box Volume (Vb → L×W×D mode)**

Change:
```tsx
                        <div className="flex justify-between items-center">
                          <span className="opacity-70" style={labelStyle}>Box Volume</span>
                          <div className="flex items-center gap-1">
                            <input type="number" step="1" value={calcVb} onChange={e => setCalcVb(e.target.value)}
                              className="w-16 border rounded px-1.5 py-0.5 text-right font-mono focus:outline-none"
                              style={inputStyle} />
                            <span className="opacity-60">L</span>
                          </div>
                        </div>
```
to:
```tsx
                        <NumberRow label="Box Volume" unit="L" step={1} value={calcVb} onChange={setCalcVb} />
```

- [ ] **Step 5: L/W/D ratio triplet**

Change:
```tsx
                        <div className="grid grid-cols-3 gap-1.5">
                          {[["L ratio", calcRatioL, setCalcRatioL], ["W ratio", calcRatioW, setCalcRatioW], ["D ratio", calcRatioD, setCalcRatioD]].map(([lbl, val, set]) => (
                            <div key={String(lbl)} className="flex flex-col gap-0.5">
                              <span className="opacity-60 text-2xs" style={labelStyle}>{String(lbl)}</span>
                              <input type="number" step="0.01" value={String(val)}
                                onChange={e => (set as (v: string) => void)(e.target.value)}
                                className="w-full border rounded px-1.5 py-0.5 text-right font-mono focus:outline-none text-2xs"
                                style={inputStyle} />
                            </div>
                          ))}
                        </div>
```
to:
```tsx
                        <div className="grid grid-cols-3 gap-1.5">
                          {(
                            [
                              ["L ratio", calcRatioL, setCalcRatioL],
                              ["W ratio", calcRatioW, setCalcRatioW],
                              ["D ratio", calcRatioD, setCalcRatioD],
                            ] as const
                          ).map(([lbl, val, set]) => (
                            <NumberField key={lbl} label={lbl} step={0.01} value={val} onChange={set} />
                          ))}
                        </div>
```
(`as const` on the tuple array gives each `set` its precise `(v: number) => void` type — matching `calcRatioL`/`calcRatioW`/`calcRatioD`'s setters — so `set(val)` type-checks without the old `as (v: string) => void` cast, which is dropped entirely.)

- [ ] **Step 6: L/W/D dimension triplet (dims → Vb mode)**

Change:
```tsx
                        <div className="grid grid-cols-3 gap-1.5">
                          {[["L (cm)", calcExtL, setCalcExtL], ["W (cm)", calcExtW, setCalcExtW], ["D (cm)", calcExtD, setCalcExtD]].map(([lbl, val, set]) => (
                            <div key={String(lbl)} className="flex flex-col gap-0.5">
                              <span className="opacity-60 text-2xs" style={labelStyle}>{String(lbl)}</span>
                              <input type="number" step="0.5" value={String(val)}
                                onChange={e => (set as (v: string) => void)(e.target.value)}
                                className="w-full border rounded px-1.5 py-0.5 text-right font-mono focus:outline-none text-2xs"
                                style={inputStyle} />
                            </div>
                          ))}
                        </div>
```
to:
```tsx
                        <div className="grid grid-cols-3 gap-1.5">
                          {(
                            [
                              ["L (cm)", calcExtL, setCalcExtL],
                              ["W (cm)", calcExtW, setCalcExtW],
                              ["D (cm)", calcExtD, setCalcExtD],
                            ] as const
                          ).map(([lbl, val, set]) => (
                            <NumberField key={lbl} label={lbl} step={0.5} value={val} onChange={set} />
                          ))}
                        </div>
```

- [ ] **Step 7: Panel thickness**

Change:
```tsx
                        <div className="flex justify-between items-center">
                          <span className="opacity-70" style={labelStyle}>Panel thickness</span>
                          <div className="flex items-center gap-1">
                            <input type="number" step="1" value={calcThickness} onChange={e => setCalcThickness(e.target.value)}
                              className="w-14 border rounded px-1.5 py-0.5 text-right font-mono focus:outline-none"
                              style={inputStyle} />
                            <span className="opacity-60">mm</span>
                          </div>
                        </div>
```
to:
```tsx
                        <NumberRow label="Panel thickness" unit="mm" step={1} value={calcThickness} onChange={setCalcThickness} />
```

- [ ] **Step 8: Remove the now-unused `inputStyle`/`labelStyle` if nothing else references them**

`inputStyle` was only used by the 5 raw `<input>` elements just replaced; `labelStyle` was used by those same elements' `<span>` labels AND by the mode-tab buttons (`style={calcMode === m ? {...} : labelStyle}`) and the "Box Volume"/"Panel thickness" labels (also just replaced). Check the file after Steps 4-7: if `labelStyle` still has a live reference (the mode-tab buttons), keep its declaration; `inputStyle` should have zero remaining references — remove its declaration:

```tsx
                const inputStyle = {
                  backgroundColor: "var(--bg-color)",
                  borderColor: "var(--border-color)",
                  color: "var(--accent-color)",
                };
```
Delete this block if `grep -n "inputStyle" src/components/sidebar/DimensionCalculator.tsx` (after Steps 4-7) shows only its own declaration line.

- [ ] **Step 9: `DriverTab.tsx` — Number of Drivers**

Change the import:
```tsx
import { Badge, Listbox } from "../ui";
```
to:
```tsx
import { Badge, Listbox, NumberRow } from "../ui";
```

Change:
```tsx
        {/* Driver Count selector */}
        <div
          className="flex justify-between items-center text-xs border rounded p-2.5 mb-3"
          style={{ backgroundColor: "var(--bg-color)", borderColor: "var(--border-color)" }}
        >
          <span className="opacity-75 font-semibold">Number of Drivers</span>
          <input
            type="number"
            min="1"
            max="16"
            value={activeProject.numDrivers}
            onChange={(e) => updateActiveProject({ numDrivers: parseInt(e.target.value) || 1 })}
            className="w-16 border rounded px-1.5 py-0.5 text-right font-mono focus:outline-none text-xs"
            style={{
              backgroundColor: "var(--sidebar-color)",
              borderColor: "var(--border-color)",
              color: "var(--accent-color)",
            }}
          />
        </div>
```
to (the wrapping `<div>` and its `<span>` label are replaced entirely — `NumberRow` supplies its own "label left, box right" row layout, so the outer div only needs to keep the card's border/background/padding):

```tsx
        {/* Driver Count selector */}
        <div className="border rounded p-2.5 mb-3" style={{ backgroundColor: "var(--bg-color)", borderColor: "var(--border-color)" }}>
          <NumberRow
            label="Number of Drivers"
            className="font-semibold"
            min={1}
            max={16}
            value={activeProject.numDrivers}
            onChange={(v) => updateActiveProject({ numDrivers: Math.round(v) })}
          />
        </div>
```
(The outer `<div>` keeps its border/background/padding for the card look; `NumberRow`'s own `flex justify-between items-center` supplies the row layout that used to be on that div. `className="font-semibold"` on `NumberRow` reproduces the original label's `font-semibold` — `NumberRow`'s default label styling is `opacity-70` with no explicit weight, so this override preserves the original's bolder look for this one card-style row.)

- [ ] **Step 10: Verify no raw `<input type="number">` remains in either file, and build**

Run: `grep -n 'type="number"' src/components/sidebar/DimensionCalculator.tsx src/components/sidebar/DriverTab.tsx`
Expected: no output.

Run: `npm run build`
Expected: succeeds. Pay attention to any TypeScript error on the two `.map()` triplets in `DimensionCalculator.tsx` — if `set(val)` doesn't type-check, double check the `as const` was applied to the outer array literal (not just the tuples) as shown in Steps 5-6.

- [ ] **Step 11: Commit**

```bash
git add src/components/sidebar/DimensionCalculator.tsx src/components/sidebar/DriverTab.tsx
git commit -m "refactor: migrate DimensionCalculator and DriverTab to NumberField/NumberRow"
```

---

## Task 5: `SignalTab.tsx` — migrate 12 fields, remove 2 sliders, fix the 6th slider's track

**Files:**
- Modify: `src/components/sidebar/SignalTab.tsx`

**Interfaces:**
- Consumes: `NumberField`, `NumberRow` from `../ui`.

- [ ] **Step 1: Add the import**

Change:
```tsx
import { CollapsibleSection, Listbox } from "../ui";
```
to:
```tsx
import { CollapsibleSection, Listbox, NumberField, NumberRow } from "../ui";
```

- [ ] **Step 2: Total Input Power — migrate to `NumberRow`, remove its slider**

Change:
```tsx
              <div>
                <div className="flex justify-between items-center text-xs mb-1">
                  <span className="opacity-70">Total Input Power</span>
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      value={activeProject.inputPower}
                      onChange={(e) => updateActiveProject({ inputPower: parseFloat(e.target.value) || 0 })}
                      className="w-18 border rounded px-1.5 py-0.5 text-right font-mono focus:outline-none text-xs"
                      style={{
                        backgroundColor: "var(--bg-color)",
                        borderColor: "var(--border-color)",
                        color: "var(--accent-color)",
                      }}
                    />
                    <span className="opacity-60">W</span>
                  </div>
                </div>
                <input
                  type="range"
                  min="1"
                  max={Math.max(100, activeProject.driver.pe * activeProject.numDrivers)}
                  step="5"
                  value={activeProject.inputPower}
                  onChange={(e) => updateActiveProject({ inputPower: parseFloat(e.target.value) })}
                  className="w-full h-1.5 rounded-lg appearance-none cursor-pointer mt-2"
                  style={{ accentColor: "var(--accent-color)", backgroundColor: "var(--bg-color)" }}
                />
              </div>
```
to:
```tsx
              <NumberRow
                label="Total Input Power"
                unit="W"
                value={activeProject.inputPower}
                onChange={(v) => updateActiveProject({ inputPower: v })}
              />
```

- [ ] **Step 3: Distance — migrate to `NumberField`**

Change:
```tsx
              <div>
                <label className="text-xs opacity-70 block mb-1">Distance (m)</label>
                <input
                  type="number"
                  step="0.1"
                  min="0.1"
                  value={activeProject.distance}
                  onChange={(e) => updateActiveProject({ distance: parseFloat(e.target.value) || 1.0 })}
                  className="w-full border rounded px-2.5 py-1.5 text-xs font-mono focus:outline-none"
                  style={{
                    backgroundColor: "var(--bg-color)",
                    borderColor: "var(--text-color)",
                    color: "var(--text-color)",
                  }}
                />
              </div>
```
to:
```tsx
              <NumberField
                label="Distance (m)"
                step={0.1}
                min={0.1}
                accent={false}
                value={activeProject.distance}
                onChange={(v) => updateActiveProject({ distance: v })}
              />
```
(This is one of the few raw inputs whose text color was `var(--text-color)` rather than the usual `var(--accent-color)` — `NumberField`'s `accent={false}` reproduces that.)

- [ ] **Step 4: EQ filter Freq/Q/Gain triplet**

Change:
```tsx
                      <div className="grid grid-cols-3 gap-1 text-2xs">
                        <div className="flex flex-col gap-0.5">
                          <span className="opacity-55">Freq (Hz)</span>
                          <input
                            type="number" min="5" max="20000" step="1" value={flt.freq}
                            onChange={e => setFilters(prev => prev.map((f, i) => i === idx ? { ...f, freq: parseFloat(e.target.value) || 100 } : f))}
                            className="w-full border rounded px-1 py-0.5 text-right font-mono focus:outline-none text-2xs"
                            style={{ backgroundColor: "var(--sidebar-color)", borderColor: "var(--border-color)", color: "var(--accent-color)" }}
                          />
                        </div>
                        <div className="flex flex-col gap-0.5">
                          <span className="opacity-55">Q</span>
                          <input
                            type="number" min="0.1" max="20" step="0.05" value={flt.q}
                            onChange={e => setFilters(prev => prev.map((f, i) => i === idx ? { ...f, q: parseFloat(e.target.value) || 0.707 } : f))}
                            className="w-full border rounded px-1 py-0.5 text-right font-mono focus:outline-none text-2xs"
                            style={{ backgroundColor: "var(--sidebar-color)", borderColor: "var(--border-color)", color: "var(--accent-color)" }}
                          />
                        </div>
                        {(flt.type === "peak" || flt.type === "lowshelf" || flt.type === "highshelf") ? (
                          <div className="flex flex-col gap-0.5">
                            <span className="opacity-55">Gain (dB)</span>
                            <input
                              type="number" min="-30" max="30" step="0.5" value={flt.gain}
                              onChange={e => setFilters(prev => prev.map((f, i) => i === idx ? { ...f, gain: parseFloat(e.target.value) || 0 } : f))}
                              className="w-full border rounded px-1 py-0.5 text-right font-mono focus:outline-none text-2xs"
                              style={{ backgroundColor: "var(--sidebar-color)", borderColor: "var(--border-color)", color: flt.gain > 0 ? "#10b981" : flt.gain < 0 ? "#f87171" : "var(--accent-color)" }}
                            />
                          </div>
                        ) : <div />}
                      </div>
```
to:
```tsx
                      <div className="grid grid-cols-3 gap-1 text-2xs">
                        <NumberField
                          label="Freq (Hz)"
                          min={5}
                          max={20000}
                          step={1}
                          value={flt.freq}
                          onChange={(v) => setFilters(prev => prev.map((f, i) => i === idx ? { ...f, freq: v } : f))}
                        />
                        <NumberField
                          label="Q"
                          min={0.1}
                          max={20}
                          step={0.05}
                          value={flt.q}
                          onChange={(v) => setFilters(prev => prev.map((f, i) => i === idx ? { ...f, q: v } : f))}
                        />
                        {(flt.type === "peak" || flt.type === "lowshelf" || flt.type === "highshelf") ? (
                          <NumberField
                            label="Gain (dB)"
                            min={-30}
                            max={30}
                            step={0.5}
                            value={flt.gain}
                            onChange={(v) => setFilters(prev => prev.map((f, i) => i === idx ? { ...f, gain: v } : f))}
                          />
                        ) : <div />}
                      </div>
```
(The Gain field's dynamic color, `flt.gain > 0 ? "#10b981" : flt.gain < 0 ? "#f87171" : "var(--accent-color)"`, is dropped — `NumberField` doesn't accept a per-value color override, only the boolean `accent` prop. This is a deliberate, disclosed simplification: the gain box now always uses the standard accent color like every other field, rather than flashing green/red based on sign. Flag this for review — if it turns out load-bearing (a real usability signal, not just decoration), the fix is a small addition to `NumberInputBoxProps` for an optional color override, not a blocker for this task.)

- [ ] **Step 5: Passive crossover Inductance/Capacitance/Inductor DCR**

Change:
```tsx
                    <div className="grid grid-cols-3 gap-2">
                      {/* Inductance Input: shown for lowpass, or 2nd order highpass */}
                      {(activeProject.passiveXoType.includes("lowpass") || activeProject.passiveXoType.includes("2nd")) && (
                        <div className="flex flex-col gap-0.5">
                          <span className="opacity-55">Inductance (mH)</span>
                          <input
                            type="number"
                            min="0.01"
                            max="50"
                            step="0.05"
                            value={activeProject.passiveXoInductance}
                            onChange={(e) => updateActiveProject({ passiveXoInductance: parseFloat(e.target.value) || 0.1 })}
                            className="w-full border rounded px-1.5 py-1 text-right font-mono focus:outline-none text-2xs"
                            style={{ backgroundColor: "var(--bg-color)", borderColor: "var(--border-color)", color: "var(--accent-color)" }}
                          />
                        </div>
                      )}

                      {/* Capacitance Input: shown for highpass, or 2nd order lowpass */}
                      {(activeProject.passiveXoType.includes("highpass") || activeProject.passiveXoType.includes("2nd")) && (
                        <div className="flex flex-col gap-0.5">
                          <span className="opacity-55">Capacitance (µF)</span>
                          <input
                            type="number"
                            min="0.1"
                            max="1000"
                            step="1.0"
                            value={activeProject.passiveXoCapacitance}
                            onChange={(e) => updateActiveProject({ passiveXoCapacitance: parseFloat(e.target.value) || 1.0 })}
                            className="w-full border rounded px-1.5 py-1 text-right font-mono focus:outline-none text-2xs"
                            style={{ backgroundColor: "var(--bg-color)", borderColor: "var(--border-color)", color: "var(--accent-color)" }}
                          />
                        </div>
                      )}

                      {/* Inductor DCR Input: shown if inductance is shown */}
                      {(activeProject.passiveXoType.includes("lowpass") || activeProject.passiveXoType.includes("2nd")) && (
                        <div className="flex flex-col gap-0.5">
                          <span className="opacity-55">Inductor DCR (Ω)</span>
                          <input
                            type="number"
                            min="0.0"
                            max="10"
                            step="0.05"
                            value={activeProject.passiveXoDcr}
                            onChange={(e) => updateActiveProject({ passiveXoDcr: parseFloat(e.target.value) || 0.0 })}
                            className="w-full border rounded px-1.5 py-1 text-right font-mono focus:outline-none text-2xs"
                            style={{ backgroundColor: "var(--bg-color)", borderColor: "var(--border-color)", color: "var(--accent-color)" }}
                          />
                        </div>
                      )}
                    </div>
```
to:
```tsx
                    <div className="grid grid-cols-3 gap-2">
                      {/* Inductance Input: shown for lowpass, or 2nd order highpass */}
                      {(activeProject.passiveXoType.includes("lowpass") || activeProject.passiveXoType.includes("2nd")) && (
                        <NumberField
                          label="Inductance (mH)"
                          min={0.01}
                          max={50}
                          step={0.05}
                          value={activeProject.passiveXoInductance}
                          onChange={(v) => updateActiveProject({ passiveXoInductance: v })}
                        />
                      )}

                      {/* Capacitance Input: shown for highpass, or 2nd order lowpass */}
                      {(activeProject.passiveXoType.includes("highpass") || activeProject.passiveXoType.includes("2nd")) && (
                        <NumberField
                          label="Capacitance (µF)"
                          min={0.1}
                          max={1000}
                          step={1.0}
                          value={activeProject.passiveXoCapacitance}
                          onChange={(v) => updateActiveProject({ passiveXoCapacitance: v })}
                        />
                      )}

                      {/* Inductor DCR Input: shown if inductance is shown */}
                      {(activeProject.passiveXoType.includes("lowpass") || activeProject.passiveXoType.includes("2nd")) && (
                        <NumberField
                          label="Inductor DCR (Ω)"
                          min={0.0}
                          max={10}
                          step={0.05}
                          value={activeProject.passiveXoDcr}
                          onChange={(v) => updateActiveProject({ passiveXoDcr: v })}
                        />
                      )}
                    </div>
```

- [ ] **Step 6: Cabin Corner Freq — migrate to `NumberRow`, remove its slider**

Change:
```tsx
                    <div className="flex justify-between items-center text-xs mb-1">
                      <span className="opacity-70">Cabin Corner Freq (Hz)</span>
                      <div className="flex items-center gap-1">
                        <input
                          type="number"
                          min="20"
                          max="150"
                          step="1"
                          value={cabinConfig.fCabin}
                          onChange={(e) => setCabinConfig(prev => ({ ...prev, fCabin: parseInt(e.target.value) || 60 }))}
                          className="w-16 border rounded px-1.5 py-0.5 text-right font-mono focus:outline-none text-xs"
                          style={{
                            backgroundColor: "var(--bg-color)",
                            borderColor: "var(--border-color)",
                            color: "var(--accent-color)",
                          }}
                        />
                        <span className="opacity-60">Hz</span>
                      </div>
                    </div>
                    <input
                      type="range"
                      min="20"
                      max="150"
                      step="1"
                      value={cabinConfig.fCabin}
                      onChange={(e) => setCabinConfig(prev => ({ ...prev, fCabin: parseInt(e.target.value) }))}
                      className="w-full h-1.5 rounded-lg appearance-none cursor-pointer mt-1"
                      style={{ accentColor: "var(--accent-color)", backgroundColor: "var(--bg-color)" }}
                    />
```
to:
```tsx
                    <NumberRow
                      label="Cabin Corner Freq (Hz)"
                      min={20}
                      max={150}
                      value={cabinConfig.fCabin}
                      onChange={(v) => setCabinConfig(prev => ({ ...prev, fCabin: Math.round(v) }))}
                    />
```
(The wrapping `text-xs mb-1` classes were on the removed row `<div>` — `NumberRow` already renders `text-xs` by default, and the slider's removal means the `mt-1`/`mb-1` spacing that separated the row from its slider is no longer needed; the parent `<div className="flex flex-col gap-2 text-2xs">` already supplies consistent spacing between this row and its neighbors.)

- [ ] **Step 7: Room Dimensions L/W/H triplet**

Change:
```tsx
                      <div className="grid grid-cols-3 gap-1.5 text-2xs">
                        {(["length", "width", "height"] as const).map(key => (
                          <div key={key} className="flex flex-col gap-0.5">
                            <span className="opacity-55 capitalize">{key}</span>
                            <input type="number" min="1" max="50" step="0.1" value={roomConfig[key]}
                              onChange={e => setRoomConfig(prev => ({ ...prev, [key]: parseFloat(e.target.value) || 1 }))}
                              className="w-full border rounded px-1 py-0.5 text-right font-mono focus:outline-none text-2xs"
                              style={{ backgroundColor: "var(--bg-color)", borderColor: "var(--border-color)", color: "var(--accent-color)" }} />
                          </div>
                        ))}
                      </div>
```
to:
```tsx
                      <div className="grid grid-cols-3 gap-1.5 text-2xs">
                        {(
                          [
                            ["length", "Length"],
                            ["width", "Width"],
                            ["height", "Height"],
                          ] as const
                        ).map(([key, label]) => (
                          <NumberField
                            key={key}
                            label={label}
                            min={1}
                            max={50}
                            step={0.1}
                            value={roomConfig[key]}
                            onChange={(v) => setRoomConfig(prev => ({ ...prev, [key]: v }))}
                          />
                        ))}
                      </div>
```
(The original derived its label from `key` via CSS `capitalize` on a lowercase string; `NumberField`'s label is plain text with no CSS transform applied to it, so the label pairs are spelled out explicitly instead.)

- [ ] **Step 8: Speaker X/Y/Z triplet**

Change:
```tsx
                            <div className="flex gap-1">
                              {(["x", "y", "z"] as const).map(axis => (
                                <div key={axis} className="flex items-center gap-0.5 flex-1 min-w-0">
                                  <span className="opacity-50 shrink-0">{axis.toUpperCase()}</span>
                                  <input type="number" min="0.05" max="49" step="0.05" value={spk[axis]}
                                    onChange={e => {
                                      const v = parseFloat(e.target.value) || 0.1;
                                      setRoomConfig(p => ({ ...p, speakers: p.speakers.map((s, i) => i === si ? { ...s, [axis]: v } : s) }));
                                    }}
                                    className="w-full min-w-0 border rounded px-1 py-0.5 text-right font-mono focus:outline-none text-2xs"
                                    style={{ backgroundColor: "var(--bg-color)", borderColor: "var(--border-color)", color: col }} />
                                  <span className="opacity-40 shrink-0">m</span>
                                </div>
                              ))}
                            </div>
```
to:
```tsx
                            <div className="flex gap-1">
                              {(["x", "y", "z"] as const).map(axis => (
                                <NumberRow
                                  key={axis}
                                  label={axis.toUpperCase()}
                                  unit="m"
                                  min={0.05}
                                  max={49}
                                  step={0.05}
                                  className="flex-1 min-w-0 gap-0.5"
                                  boxClassName="w-full min-w-0"
                                  value={spk[axis]}
                                  onChange={(v) => setRoomConfig(p => ({ ...p, speakers: p.speakers.map((s, i) => i === si ? { ...s, [axis]: v } : s) }))}
                                />
                              ))}
                            </div>
```
(`boxClassName="w-full min-w-0"` overrides `NumberInputBox`'s default `w-24`, letting the box shrink to fit the narrow `flex-1` slot three of these share — same intent as the original's `w-full min-w-0` on the raw `<input>`. `NumberRow`'s `color: col` per-speaker tint is dropped from the input text — `NumberRow`/`NumberInputBox` don't accept an arbitrary color override, only `accent`. This is a minor, disclosed loss of per-speaker color-coding in the number itself; the speaker's colored label/marker elsewhere on the floor-plan diagram still carries that color.)

- [ ] **Step 9: Listener X/Y/Z triplet**

Change:
```tsx
                        <div className="flex gap-1">
                          {(["listenerX", "listenerY", "listenerZ"] as const).map(key => (
                            <div key={key} className="flex items-center gap-0.5 flex-1 min-w-0">
                              <span className="opacity-50 shrink-0">{key.slice(-1).toUpperCase()}</span>
                              <input type="number" min="0.05" max="49" step="0.05" value={roomConfig[key]}
                                onChange={e => setRoomConfig(prev => ({ ...prev, [key]: parseFloat(e.target.value) || 0.1 }))}
                                className="w-full min-w-0 border rounded px-1 py-0.5 text-right font-mono focus:outline-none text-2xs"
                                style={{ backgroundColor: "var(--bg-color)", borderColor: "var(--border-color)", color: "#60a5fa" }} />
                              <span className="opacity-40 shrink-0">m</span>
                            </div>
                          ))}
                        </div>
```
to:
```tsx
                        <div className="flex gap-1">
                          {(["listenerX", "listenerY", "listenerZ"] as const).map(key => (
                            <NumberRow
                              key={key}
                              label={key.slice(-1).toUpperCase()}
                              unit="m"
                              min={0.05}
                              max={49}
                              step={0.05}
                              className="flex-1 min-w-0 gap-0.5"
                              boxClassName="w-full min-w-0"
                              value={roomConfig[key]}
                              onChange={(v) => setRoomConfig(prev => ({ ...prev, [key]: v }))}
                            />
                          ))}
                        </div>
```
(Same disclosed loss of the listener's `#60a5fa` blue tint on the number itself as Step 8 — the listener marker on the floor-plan diagram keeps its color.)

- [ ] **Step 10: Remove the Wall Absorption slider's invisible-track bug — the ONE slider that stays**

Change:
```tsx
                      <input type="range" min="0.02" max="0.8" step="0.01" value={roomConfig.absorption}
                        onChange={e => setRoomConfig(prev => ({ ...prev, absorption: parseFloat(e.target.value) }))}
                        className="w-full h-1.5 rounded-lg appearance-none cursor-pointer"
                        style={{ accentColor: "var(--accent-color)", backgroundColor: "var(--bg-color)" }} />
```
to:
```tsx
                      <input type="range" min="0.02" max="0.8" step="0.01" value={roomConfig.absorption}
                        onChange={e => setRoomConfig(prev => ({ ...prev, absorption: parseFloat(e.target.value) }))}
                        className="w-full h-1.5 rounded-lg appearance-none cursor-pointer"
                        style={{ accentColor: "var(--accent-color)", backgroundColor: "var(--border-color)" }} />
```
(Only the track's `backgroundColor` changes, from `var(--bg-color)` — identical to the panel it sits inside, making it invisible — to `var(--border-color)`, giving the track a visible boundary distinct from its background while the thumb still reads as the interactive element via `accentColor`. This is the only slider in the file that is NOT removed.)

- [ ] **Step 11: Verify no raw `<input type="number">` or the two removed `<input type="range">`s remain, and build**

Run: `grep -n 'type="number"' src/components/sidebar/SignalTab.tsx`
Expected: no output.

Run: `grep -c 'type="range"' src/components/sidebar/SignalTab.tsx`
Expected: `1` (only the Wall Absorption slider remains).

Run: `npm run build`
Expected: succeeds.

- [ ] **Step 12: Commit**

```bash
git add src/components/sidebar/SignalTab.tsx
git commit -m "refactor: migrate SignalTab to NumberField/NumberRow, remove 2 redundant sliders, fix Wall Absorption track"
```

---

## Task 6: `EnclosureTab.tsx` Part A — Common fields, Ported controls, Second Port Group

**Files:**
- Modify: `src/components/sidebar/EnclosureTab.tsx`

**Interfaces:**
- Consumes: `NumberField`, `NumberRow` from `../ui`.

This is the first of 3 tasks migrating `EnclosureTab.tsx` (40 raw number inputs total, split by natural section boundaries to keep each task reviewable). This task covers: Box Volume (shared across sealed/ported/passive_radiator), and everything under the Ported-only block (Tuning Freq, Port Count, Port Diameter, Slot Width/Height, Second Port Group's Count/Diameter/Width/Height) — 10 fields, 3 sliders removed.

- [ ] **Step 1: Add the import**

Change:
```tsx
import { CollapsibleSection, Badge, Listbox } from "../ui";
```
to:
```tsx
import { CollapsibleSection, Badge, Listbox, NumberField, NumberRow } from "../ui";
```

- [ ] **Step 2: Box Volume (Vb) — migrate to `NumberRow`, remove its slider**

Change:
```tsx
            {(activeProject.enclosureType === "sealed" || activeProject.enclosureType === "ported" || activeProject.enclosureType === "passive_radiator") && (
              <div>
                <div className="flex justify-between items-center text-xs mb-1">
                  <span className="opacity-70">Box Volume (Vb)</span>
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      value={activeProject.vBox}
                      onChange={(e) => updateActiveProject({ vBox: parseFloat(e.target.value) || 0 })}
                      className="w-16 border rounded px-1.5 py-0.5 text-right font-mono focus:outline-none text-xs"
                      style={{
                        backgroundColor: "var(--bg-color)",
                        borderColor: "var(--border-color)",
                        color: "var(--accent-color)",
                      }}
                    />
                    <span className="opacity-60">L</span>
                  </div>
                </div>
                <input
                  type="range"
                  min="2"
                  max={Math.max(200, activeProject.driver.vas * 1.5)}
                  step="0.5"
                  value={activeProject.vBox}
                  onChange={(e) => updateActiveProject({ vBox: parseFloat(e.target.value) })}
                  className="w-full h-1.5 rounded-lg appearance-none cursor-pointer mt-2"
                  style={{ accentColor: "var(--accent-color)", backgroundColor: "var(--bg-color)" }}
                />
              </div>
            )}
```
to:
```tsx
            {(activeProject.enclosureType === "sealed" || activeProject.enclosureType === "ported" || activeProject.enclosureType === "passive_radiator") && (
              <NumberRow
                label="Box Volume (Vb)"
                unit="L"
                value={activeProject.vBox}
                onChange={(v) => updateActiveProject({ vBox: v })}
              />
            )}
```

- [ ] **Step 3: Tuning Freq (Fb) — migrate to `NumberRow`, remove its slider**

Change:
```tsx
                <div>
                  <div className="flex justify-between items-center text-xs mb-1">
                    <span className="opacity-70">Tuning Freq (Fb)</span>
                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        value={activeProject.tuningFreq}
                        onChange={(e) => updateActiveProject({ tuningFreq: parseFloat(e.target.value) || 0 })}
                        className="w-16 border rounded px-1.5 py-0.5 text-right font-mono focus:outline-none text-xs"
                        style={{
                          backgroundColor: "var(--bg-color)",
                          borderColor: "var(--border-color)",
                          color: "var(--accent-color)",
                        }}
                      />
                      <span className="opacity-60">Hz</span>
                    </div>
                  </div>
                  <input
                    type="range"
                    min="15"
                    max="100"
                    step="0.5"
                    value={activeProject.tuningFreq}
                    onChange={(e) => updateActiveProject({ tuningFreq: parseFloat(e.target.value) })}
                    className="w-full h-1.5 rounded-lg appearance-none cursor-pointer mt-2"
                    style={{ accentColor: "var(--accent-color)", backgroundColor: "var(--bg-color)" }}
                  />
                </div>
```
to:
```tsx
                <NumberRow
                  label="Tuning Freq (Fb)"
                  unit="Hz"
                  value={activeProject.tuningFreq}
                  onChange={(v) => updateActiveProject({ tuningFreq: v })}
                />
```

- [ ] **Step 4: Port Count — migrate to `NumberRow`**

Change:
```tsx
                <div>
                  <div className="flex justify-between items-center text-xs mb-1">
                    <span className="opacity-70">Port Count</span>
                    <input
                      type="number"
                      min="1"
                      max="8"
                      value={activeProject.portCount}
                      onChange={(e) => updateActiveProject({ portCount: Math.max(1, Math.min(8, parseInt(e.target.value) || 1)) })}
                      className="w-16 border rounded px-1.5 py-0.5 text-right font-mono focus:outline-none text-xs"
                      style={{
                        backgroundColor: "var(--bg-color)",
                        borderColor: "var(--border-color)",
                        color: "var(--accent-color)",
                      }}
                    />
                  </div>
                </div>
```
to:
```tsx
                <NumberRow
                  label="Port Count"
                  min={1}
                  max={8}
                  value={activeProject.portCount}
                  onChange={(v) => updateActiveProject({ portCount: Math.round(v) })}
                />
```

- [ ] **Step 5: Port Diameter — migrate to `NumberRow`, remove its slider**

Change:
```tsx
                {activeProject.portShape === "circular" ? (
                  <div>
                    <div className="flex justify-between items-center text-xs mb-1">
                      <span className="opacity-70">Port Diameter</span>
                      <div className="flex items-center gap-1">
                        <input
                          type="number"
                          step="0.1"
                          value={activeProject.portDiameter}
                          onChange={(e) => updateActiveProject({ portDiameter: parseFloat(e.target.value) || 0 })}
                          className="w-16 border rounded px-1.5 py-0.5 text-right font-mono focus:outline-none text-xs"
                          style={{
                            backgroundColor: "var(--bg-color)",
                            borderColor: "var(--border-color)",
                            color: "var(--accent-color)",
                          }}
                        />
                        <span className="opacity-60">cm</span>
                      </div>
                    </div>
                    <input
                      type="range"
                      min="3"
                      max="30"
                      step="0.1"
                      value={activeProject.portDiameter}
                      onChange={(e) => updateActiveProject({ portDiameter: parseFloat(e.target.value) })}
                      className="w-full h-1.5 rounded-lg appearance-none cursor-pointer mt-2"
                      style={{ accentColor: "var(--accent-color)", backgroundColor: "var(--bg-color)" }}
                    />
                  </div>
                ) : (
```
to:
```tsx
                {activeProject.portShape === "circular" ? (
                  <NumberRow
                    label="Port Diameter"
                    unit="cm"
                    step={0.1}
                    value={activeProject.portDiameter}
                    onChange={(v) => updateActiveProject({ portDiameter: v })}
                  />
                ) : (
```

- [ ] **Step 6: Slot Width/Height — migrate the grid to two stacked `NumberField`s**

Change:
```tsx
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <label className="opacity-70 block mb-1">Slot Width (cm)</label>
                      <input
                        type="number"
                        step="0.5"
                        value={activeProject.portWidth}
                        onChange={(e) => updateActiveProject({ portWidth: parseFloat(e.target.value) || 0 })}
                        className="w-full border rounded px-2 py-1 text-right font-mono focus:outline-none text-xs"
                        style={{
                          backgroundColor: "var(--bg-color)",
                          borderColor: "var(--border-color)",
                          color: "var(--accent-color)",
                        }}
                      />
                    </div>
                    <div>
                      <label className="opacity-70 block mb-1">Slot Height (cm)</label>
                      <input
                        type="number"
                        step="0.5"
                        value={activeProject.portHeight}
                        onChange={(e) => updateActiveProject({ portHeight: parseFloat(e.target.value) || 0 })}
                        className="w-full border rounded px-2 py-1 text-right font-mono focus:outline-none text-xs"
                        style={{
                          backgroundColor: "var(--bg-color)",
                          borderColor: "var(--border-color)",
                          color: "var(--accent-color)",
                        }}
                      />
                    </div>
                  </div>
                )}
```
to:
```tsx
                  <div className="flex flex-col gap-1.5">
                    <NumberRow
                      label="Slot Width (cm)"
                      step={0.5}
                      value={activeProject.portWidth}
                      onChange={(v) => updateActiveProject({ portWidth: v })}
                    />
                    <NumberRow
                      label="Slot Height (cm)"
                      step={0.5}
                      value={activeProject.portHeight}
                      onChange={(v) => updateActiveProject({ portHeight: v })}
                    />
                  </div>
                )}
```
(Per the approved mockup, paired Width/Height fields stack as two `NumberRow`s rather than sitting in a 2-column grid — this matches every other single-value field in the file, closing the exact inconsistency the redesign set out to fix.)

- [ ] **Step 7: Second Port Group's Count**

Change:
```tsx
                      <div className="flex justify-between items-center">
                        <span className="opacity-70">Count</span>
                        <input
                          type="number"
                          min="1"
                          max="8"
                          value={activeProject.port2Count}
                          onChange={(e) => updateActiveProject({ port2Count: Math.max(1, parseInt(e.target.value) || 1) })}
                          className="w-16 border rounded px-1.5 py-0.5 text-right font-mono focus:outline-none text-xs"
                          style={{ backgroundColor: "var(--sidebar-color)", borderColor: "var(--border-color)", color: "var(--accent-color)" }}
                        />
                      </div>
```
to:
```tsx
                      <NumberRow
                        label="Count"
                        min={1}
                        max={8}
                        value={activeProject.port2Count}
                        onChange={(v) => updateActiveProject({ port2Count: Math.round(v) })}
                      />
```

- [ ] **Step 8: Second Port Group's Diameter**

Change:
```tsx
                      {activeProject.port2Shape === "circular" ? (
                        <div className="flex justify-between items-center">
                          <span className="opacity-70">Diameter</span>
                          <div className="flex items-center gap-1">
                            <input
                              type="number"
                              step="0.1"
                              value={activeProject.port2Diameter}
                              onChange={(e) => updateActiveProject({ port2Diameter: parseFloat(e.target.value) || 0 })}
                              className="w-16 border rounded px-1.5 py-0.5 text-right font-mono focus:outline-none text-xs"
                              style={{ backgroundColor: "var(--sidebar-color)", borderColor: "var(--border-color)", color: "var(--accent-color)" }}
                            />
                            <span className="opacity-60">cm</span>
                          </div>
                        </div>
                      ) : (
```
to:
```tsx
                      {activeProject.port2Shape === "circular" ? (
                        <NumberRow
                          label="Diameter"
                          unit="cm"
                          step={0.1}
                          value={activeProject.port2Diameter}
                          onChange={(v) => updateActiveProject({ port2Diameter: v })}
                        />
                      ) : (
```

- [ ] **Step 9: Second Port Group's Width/Height**

Change:
```tsx
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="opacity-70 block mb-0.5">Width (cm)</label>
                            <input
                              type="number"
                              step="0.5"
                              value={activeProject.port2Width}
                              onChange={(e) => updateActiveProject({ port2Width: parseFloat(e.target.value) || 0 })}
                              className="w-full border rounded px-2 py-1 text-right font-mono focus:outline-none text-xs"
                              style={{ backgroundColor: "var(--sidebar-color)", borderColor: "var(--border-color)", color: "var(--accent-color)" }}
                            />
                          </div>
                          <div>
                            <label className="opacity-70 block mb-0.5">Height (cm)</label>
                            <input
                              type="number"
                              step="0.5"
                              value={activeProject.port2Height}
                              onChange={(e) => updateActiveProject({ port2Height: parseFloat(e.target.value) || 0 })}
                              className="w-full border rounded px-2 py-1 text-right font-mono focus:outline-none text-xs"
                              style={{ backgroundColor: "var(--sidebar-color)", borderColor: "var(--border-color)", color: "var(--accent-color)" }}
                            />
                          </div>
                        </div>
                      )}
```
to:
```tsx
                        <div className="flex flex-col gap-1.5">
                          <NumberRow
                            label="Width (cm)"
                            step={0.5}
                            value={activeProject.port2Width}
                            onChange={(v) => updateActiveProject({ port2Width: v })}
                          />
                          <NumberRow
                            label="Height (cm)"
                            step={0.5}
                            value={activeProject.port2Height}
                            onChange={(v) => updateActiveProject({ port2Height: v })}
                          />
                        </div>
                      )}
```

- [ ] **Step 10: Verify and build**

Run: `npm run build`
Expected: succeeds. This task does not yet bring the file's raw-`<select>`-equivalent grep counts to zero — Part B and Part C (Tasks 7-8) still have raw `<input type="number">` and 0 remaining sliders (all 3 in this section removed) is the only thing to confirm here:

Run: `grep -c 'type="range"' src/components/sidebar/EnclosureTab.tsx`
Expected: `0` (this file has no sliders of its own left — EnclosureTab never had the kept Wall Absorption slider, that's in SignalTab.tsx).

- [ ] **Step 11: Commit**

```bash
git add src/components/sidebar/EnclosureTab.tsx
git commit -m "refactor: migrate EnclosureTab Part A (common fields, ported controls) to NumberField/NumberRow"
```

---

## Task 7: `EnclosureTab.tsx` Part B — Bandpass4/6 controls

**Files:**
- Modify: `src/components/sidebar/EnclosureTab.tsx`

**Interfaces:**
- Consumes: `NumberField`, `NumberRow` from `../ui` (already imported by Task 6).

16 fields across the Bandpass4, Bandpass6-Parallel, and Bandpass6-Series conditional blocks — all identical in shape to Task 6's compact-row pattern, no sliders in this section.

- [ ] **Step 1: Bandpass4 — Rear Chamber Volume (Vr)**

Change:
```tsx
                  <div className="flex justify-between items-center mb-1">
                    <span className="opacity-70">Volume (Vr)</span>
                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        value={activeProject.vRear}
                        onChange={(e) => updateActiveProject({ vRear: parseFloat(e.target.value) || 0 })}
                        className="w-16 border rounded px-1.5 py-0.5 text-right font-mono focus:outline-none text-xs"
                        style={{ backgroundColor: "var(--sidebar-color)", borderColor: "var(--border-color)", color: "var(--accent-color)" }}
                      />
                      <span className="opacity-60">L</span>
                    </div>
                  </div>
                </div>

                <div className="border rounded p-2.5" style={{ backgroundColor: "var(--bg-color)", borderColor: "var(--border-color)" }}>
                  <span className="font-semibold text-xs opacity-80 block mb-2">Front Chamber (Ported)</span>
                  <div className="flex justify-between items-center mb-2">
                    <span className="opacity-70">Volume (Vf)</span>
                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        value={activeProject.vFront}
                        onChange={(e) => updateActiveProject({ vFront: parseFloat(e.target.value) || 0 })}
                        className="w-16 border rounded px-1.5 py-0.5 text-right font-mono focus:outline-none text-xs"
                        style={{ backgroundColor: "var(--sidebar-color)", borderColor: "var(--border-color)", color: "var(--accent-color)" }}
                      />
                      <span className="opacity-60">L</span>
                    </div>
                  </div>
                  <div className="flex justify-between items-center mb-2">
                    <span className="opacity-70">Tuning (Fb)</span>
                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        value={activeProject.frontTuningFreq}
                        onChange={(e) => updateActiveProject({ frontTuningFreq: parseFloat(e.target.value) || 0 })}
                        className="w-16 border rounded px-1.5 py-0.5 text-right font-mono focus:outline-none text-xs"
                        style={{ backgroundColor: "var(--sidebar-color)", borderColor: "var(--border-color)", color: "var(--accent-color)" }}
                      />
                      <span className="opacity-60">Hz</span>
                    </div>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="opacity-70">Port Diameter</span>
                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        step="0.1"
                        value={activeProject.frontPortDiameter}
                        onChange={(e) => updateActiveProject({ frontPortDiameter: parseFloat(e.target.value) || 0 })}
                        className="w-16 border rounded px-1.5 py-0.5 text-right font-mono focus:outline-none text-xs"
                        style={{ backgroundColor: "var(--sidebar-color)", borderColor: "var(--border-color)", color: "var(--accent-color)" }}
                      />
                      <span className="opacity-60">cm</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* 6th-Order Parallel Bandpass Controls */}
```
to:
```tsx
                  <NumberRow
                    label="Volume (Vr)"
                    unit="L"
                    className="mb-1"
                    value={activeProject.vRear}
                    onChange={(v) => updateActiveProject({ vRear: v })}
                  />
                </div>

                <div className="border rounded p-2.5" style={{ backgroundColor: "var(--bg-color)", borderColor: "var(--border-color)" }}>
                  <span className="font-semibold text-xs opacity-80 block mb-2">Front Chamber (Ported)</span>
                  <NumberRow
                    label="Volume (Vf)"
                    unit="L"
                    className="mb-2"
                    value={activeProject.vFront}
                    onChange={(v) => updateActiveProject({ vFront: v })}
                  />
                  <NumberRow
                    label="Tuning (Fb)"
                    unit="Hz"
                    className="mb-2"
                    value={activeProject.frontTuningFreq}
                    onChange={(v) => updateActiveProject({ frontTuningFreq: v })}
                  />
                  <NumberRow
                    label="Port Diameter"
                    unit="cm"
                    step={0.1}
                    value={activeProject.frontPortDiameter}
                    onChange={(v) => updateActiveProject({ frontPortDiameter: v })}
                  />
                </div>
              </div>
            )}

            {/* 6th-Order Parallel Bandpass Controls */}
```
(`className="mb-1"`/`className="mb-2"` on `NumberRow` reproduce the original rows' own bottom-margin classes, now moved from the removed wrapper `<div>` onto `NumberRow` itself — necessary since these fields sit directly above a sibling, not inside a `flex flex-col gap-*` container that would otherwise supply that spacing.)

- [ ] **Step 2: Bandpass6-Parallel — Rear Chamber (Vr, Tuning, Port Diameter)**

Change:
```tsx
                <div className="border rounded p-2.5" style={{ backgroundColor: "var(--bg-color)", borderColor: "var(--border-color)" }}>
                  <span className="font-semibold text-xs opacity-80 block mb-2">Rear Chamber (Ported)</span>
                  <div className="flex justify-between items-center mb-2">
                    <span className="opacity-70">Volume (Vr)</span>
                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        value={activeProject.vRear}
                        onChange={(e) => updateActiveProject({ vRear: parseFloat(e.target.value) || 0 })}
                        className="w-16 border rounded px-1.5 py-0.5 text-right font-mono focus:outline-none text-xs"
                        style={{ backgroundColor: "var(--sidebar-color)", borderColor: "var(--border-color)", color: "var(--accent-color)" }}
                      />
                      <span className="opacity-60">L</span>
                    </div>
                  </div>
                  <div className="flex justify-between items-center mb-2">
                    <span className="opacity-70">Tuning (Fb,rear)</span>
                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        value={activeProject.rearTuningFreq}
                        onChange={(e) => updateActiveProject({ rearTuningFreq: parseFloat(e.target.value) || 0 })}
                        className="w-16 border rounded px-1.5 py-0.5 text-right font-mono focus:outline-none text-xs"
                        style={{ backgroundColor: "var(--sidebar-color)", borderColor: "var(--border-color)", color: "var(--accent-color)" }}
                      />
                      <span className="opacity-60">Hz</span>
                    </div>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="opacity-70">Port Diameter</span>
                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        step="0.1"
                        value={activeProject.rearPortDiameter}
                        onChange={(e) => updateActiveProject({ rearPortDiameter: parseFloat(e.target.value) || 0 })}
                        className="w-16 border rounded px-1.5 py-0.5 text-right font-mono focus:outline-none text-xs"
                        style={{ backgroundColor: "var(--sidebar-color)", borderColor: "var(--border-color)", color: "var(--accent-color)" }}
                      />
                      <span className="opacity-60">cm</span>
                    </div>
                  </div>
                </div>

                <div className="border rounded p-2.5" style={{ backgroundColor: "var(--bg-color)", borderColor: "var(--border-color)" }}>
                  <span className="font-semibold text-xs opacity-80 block mb-2">Front Chamber (Ported)</span>
                  <div className="flex justify-between items-center mb-2">
                    <span className="opacity-70">Volume (Vf)</span>
                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        value={activeProject.vFront}
                        onChange={(e) => updateActiveProject({ vFront: parseFloat(e.target.value) || 0 })}
                        className="w-16 border rounded px-1.5 py-0.5 text-right font-mono focus:outline-none text-xs"
                        style={{ backgroundColor: "var(--sidebar-color)", borderColor: "var(--border-color)", color: "var(--accent-color)" }}
                      />
                      <span className="opacity-60">L</span>
                    </div>
                  </div>
                  <div className="flex justify-between items-center mb-2">
                    <span className="opacity-70">Tuning (Fb,front)</span>
                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        value={activeProject.frontTuningFreq}
                        onChange={(e) => updateActiveProject({ frontTuningFreq: parseFloat(e.target.value) || 0 })}
                        className="w-16 border rounded px-1.5 py-0.5 text-right font-mono focus:outline-none text-xs"
                        style={{ backgroundColor: "var(--sidebar-color)", borderColor: "var(--border-color)", color: "var(--accent-color)" }}
                      />
                      <span className="opacity-60">Hz</span>
                    </div>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="opacity-70">Port Diameter</span>
                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        step="0.1"
                        value={activeProject.frontPortDiameter}
                        onChange={(e) => updateActiveProject({ frontPortDiameter: parseFloat(e.target.value) || 0 })}
                        className="w-16 border rounded px-1.5 py-0.5 text-right font-mono focus:outline-none text-xs"
                        style={{ backgroundColor: "var(--sidebar-color)", borderColor: "var(--border-color)", color: "var(--accent-color)" }}
                      />
                      <span className="opacity-60">cm</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* 6th-Order Series Bandpass Controls */}
```
to:
```tsx
                <div className="border rounded p-2.5" style={{ backgroundColor: "var(--bg-color)", borderColor: "var(--border-color)" }}>
                  <span className="font-semibold text-xs opacity-80 block mb-2">Rear Chamber (Ported)</span>
                  <NumberRow
                    label="Volume (Vr)"
                    unit="L"
                    className="mb-2"
                    value={activeProject.vRear}
                    onChange={(v) => updateActiveProject({ vRear: v })}
                  />
                  <NumberRow
                    label="Tuning (Fb,rear)"
                    unit="Hz"
                    className="mb-2"
                    value={activeProject.rearTuningFreq}
                    onChange={(v) => updateActiveProject({ rearTuningFreq: v })}
                  />
                  <NumberRow
                    label="Port Diameter"
                    unit="cm"
                    step={0.1}
                    value={activeProject.rearPortDiameter}
                    onChange={(v) => updateActiveProject({ rearPortDiameter: v })}
                  />
                </div>

                <div className="border rounded p-2.5" style={{ backgroundColor: "var(--bg-color)", borderColor: "var(--border-color)" }}>
                  <span className="font-semibold text-xs opacity-80 block mb-2">Front Chamber (Ported)</span>
                  <NumberRow
                    label="Volume (Vf)"
                    unit="L"
                    className="mb-2"
                    value={activeProject.vFront}
                    onChange={(v) => updateActiveProject({ vFront: v })}
                  />
                  <NumberRow
                    label="Tuning (Fb,front)"
                    unit="Hz"
                    className="mb-2"
                    value={activeProject.frontTuningFreq}
                    onChange={(v) => updateActiveProject({ frontTuningFreq: v })}
                  />
                  <NumberRow
                    label="Port Diameter"
                    unit="cm"
                    step={0.1}
                    value={activeProject.frontPortDiameter}
                    onChange={(v) => updateActiveProject({ frontPortDiameter: v })}
                  />
                </div>
              </div>
            )}

            {/* 6th-Order Series Bandpass Controls */}
```

- [ ] **Step 3: Bandpass6-Series — Rear Chamber (Vr, Internal Tuning, Internal Port Diam) and Front Chamber (Vf, Front Tuning, Front Port Diam)**

Change:
```tsx
                <div className="border rounded p-2.5" style={{ backgroundColor: "var(--bg-color)", borderColor: "var(--border-color)" }}>
                  <span className="font-semibold text-xs opacity-80 block mb-2">Rear Chamber (Vented into Front)</span>
                  <div className="flex justify-between items-center mb-2">
                    <span className="opacity-70">Volume (Vr)</span>
                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        value={activeProject.vRear}
                        onChange={(e) => updateActiveProject({ vRear: parseFloat(e.target.value) || 0 })}
                        className="w-16 border rounded px-1.5 py-0.5 text-right font-mono focus:outline-none text-xs"
                        style={{ backgroundColor: "var(--sidebar-color)", borderColor: "var(--border-color)", color: "var(--accent-color)" }}
                      />
                      <span className="opacity-60">L</span>
                    </div>
                  </div>
                  <div className="flex justify-between items-center mb-2">
                    <span className="opacity-70">Internal Tuning</span>
                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        value={activeProject.rearTuningFreq}
                        onChange={(e) => updateActiveProject({ rearTuningFreq: parseFloat(e.target.value) || 0 })}
                        className="w-16 border rounded px-1.5 py-0.5 text-right font-mono focus:outline-none text-xs"
                        style={{ backgroundColor: "var(--sidebar-color)", borderColor: "var(--border-color)", color: "var(--accent-color)" }}
                      />
                      <span className="opacity-60">Hz</span>
                    </div>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="opacity-70">Internal Port Diam</span>
                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        step="0.1"
                        value={activeProject.internalPortDiameter}
                        onChange={(e) => updateActiveProject({ internalPortDiameter: parseFloat(e.target.value) || 0 })}
                        className="w-16 border rounded px-1.5 py-0.5 text-right font-mono focus:outline-none text-xs"
                        style={{ backgroundColor: "var(--sidebar-color)", borderColor: "var(--border-color)", color: "var(--accent-color)" }}
                      />
                      <span className="opacity-60">cm</span>
                    </div>
                  </div>
                </div>

                <div className="border rounded p-2.5" style={{ backgroundColor: "var(--bg-color)", borderColor: "var(--border-color)" }}>
                  <span className="font-semibold text-xs opacity-80 block mb-2">Front Chamber (Vented Outside)</span>
                  <div className="flex justify-between items-center mb-2">
                    <span className="opacity-70">Volume (Vf)</span>
                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        value={activeProject.vFront}
                        onChange={(e) => updateActiveProject({ vFront: parseFloat(e.target.value) || 0 })}
                        className="w-16 border rounded px-1.5 py-0.5 text-right font-mono focus:outline-none text-xs"
                        style={{ backgroundColor: "var(--sidebar-color)", borderColor: "var(--border-color)", color: "var(--accent-color)" }}
                      />
                      <span className="opacity-60">L</span>
                    </div>
                  </div>
                  <div className="flex justify-between items-center mb-2">
                    <span className="opacity-70">Front Tuning (Fb)</span>
                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        value={activeProject.frontTuningFreq}
                        onChange={(e) => updateActiveProject({ frontTuningFreq: parseFloat(e.target.value) || 0 })}
                        className="w-16 border rounded px-1.5 py-0.5 text-right font-mono focus:outline-none text-xs"
                        style={{ backgroundColor: "var(--sidebar-color)", borderColor: "var(--border-color)", color: "var(--accent-color)" }}
                      />
                      <span className="opacity-60">Hz</span>
                    </div>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="opacity-70">Front Port Diam</span>
                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        step="0.1"
                        value={activeProject.frontPortDiameter}
                        onChange={(e) => updateActiveProject({ frontPortDiameter: parseFloat(e.target.value) || 0 })}
                        className="w-16 border rounded px-1.5 py-0.5 text-right font-mono focus:outline-none text-xs"
                        style={{ backgroundColor: "var(--sidebar-color)", borderColor: "var(--border-color)", color: "var(--accent-color)" }}
                      />
                      <span className="opacity-60">cm</span>
                    </div>
                  </div>
                </div>
              </div>
            )}
```
to:
```tsx
                <div className="border rounded p-2.5" style={{ backgroundColor: "var(--bg-color)", borderColor: "var(--border-color)" }}>
                  <span className="font-semibold text-xs opacity-80 block mb-2">Rear Chamber (Vented into Front)</span>
                  <NumberRow
                    label="Volume (Vr)"
                    unit="L"
                    className="mb-2"
                    value={activeProject.vRear}
                    onChange={(v) => updateActiveProject({ vRear: v })}
                  />
                  <NumberRow
                    label="Internal Tuning"
                    unit="Hz"
                    className="mb-2"
                    value={activeProject.rearTuningFreq}
                    onChange={(v) => updateActiveProject({ rearTuningFreq: v })}
                  />
                  <NumberRow
                    label="Internal Port Diam"
                    unit="cm"
                    step={0.1}
                    value={activeProject.internalPortDiameter}
                    onChange={(v) => updateActiveProject({ internalPortDiameter: v })}
                  />
                </div>

                <div className="border rounded p-2.5" style={{ backgroundColor: "var(--bg-color)", borderColor: "var(--border-color)" }}>
                  <span className="font-semibold text-xs opacity-80 block mb-2">Front Chamber (Vented Outside)</span>
                  <NumberRow
                    label="Volume (Vf)"
                    unit="L"
                    className="mb-2"
                    value={activeProject.vFront}
                    onChange={(v) => updateActiveProject({ vFront: v })}
                  />
                  <NumberRow
                    label="Front Tuning (Fb)"
                    unit="Hz"
                    className="mb-2"
                    value={activeProject.frontTuningFreq}
                    onChange={(v) => updateActiveProject({ frontTuningFreq: v })}
                  />
                  <NumberRow
                    label="Front Port Diam"
                    unit="cm"
                    step={0.1}
                    value={activeProject.frontPortDiameter}
                    onChange={(v) => updateActiveProject({ frontPortDiameter: v })}
                  />
                </div>
              </div>
            )}
```

- [ ] **Step 4: Verify and build**

Run: `npm run build`
Expected: succeeds.

- [ ] **Step 5: Commit**

```bash
git add src/components/sidebar/EnclosureTab.tsx
git commit -m "refactor: migrate EnclosureTab Part B (bandpass4/6 controls) to NumberRow"
```

---

## Task 8: `EnclosureTab.tsx` Part C — Passive Radiator and Custom Topology Builder

**Files:**
- Modify: `src/components/sidebar/EnclosureTab.tsx`

**Interfaces:**
- Consumes: `NumberField`, `NumberRow` from `../ui` (already imported by Task 6).

The remaining 14 source-level fields: Passive Radiator's 4 fields, and the Custom Topology Builder's rear chamber (volume, port tuning/diameter, and the PR moving-mass/piston-area/resonance/Q template), the internal cross-connect port (tuning/diameter), and the front chamber (volume, port tuning/diameter, and its own PR template).

- [ ] **Step 1: Passive Radiator — Moving Mass, Piston Area, Resonance, Mechanical Q**

Change:
```tsx
              <div className="flex flex-col gap-2.5 border rounded p-2.5 text-xs" style={{ backgroundColor: "var(--bg-color)", borderColor: "var(--border-color)" }}>
                <span className="font-semibold text-xs opacity-80 block mb-1">Passive Radiator Parameters</span>
                <div className="flex justify-between items-center">
                  <span className="opacity-70">PR Moving Mass (Mms)</span>
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      value={activeProject.prMms}
                      onChange={(e) => updateActiveProject({ prMms: parseFloat(e.target.value) || 0 })}
                      className="w-16 border rounded px-1.5 py-0.5 text-right font-mono focus:outline-none text-xs"
                      style={{ backgroundColor: "var(--sidebar-color)", borderColor: "var(--border-color)", color: "var(--accent-color)" }}
                    />
                    <span className="opacity-60">g</span>
                  </div>
                </div>
                <div className="flex justify-between items-center">
                  <span className="opacity-70">PR Piston Area (Sd)</span>
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      value={activeProject.prSd}
                      onChange={(e) => updateActiveProject({ prSd: parseFloat(e.target.value) || 0 })}
                      className="w-16 border rounded px-1.5 py-0.5 text-right font-mono focus:outline-none text-xs"
                      style={{ backgroundColor: "var(--sidebar-color)", borderColor: "var(--border-color)", color: "var(--accent-color)" }}
                    />
                    <span className="opacity-60">cm²</span>
                  </div>
                </div>
                <div className="flex justify-between items-center">
                  <span className="opacity-70">PR Resonance (Fs)</span>
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      value={activeProject.prFs}
                      onChange={(e) => updateActiveProject({ prFs: parseFloat(e.target.value) || 0 })}
                      className="w-16 border rounded px-1.5 py-0.5 text-right font-mono focus:outline-none text-xs"
                      style={{ backgroundColor: "var(--sidebar-color)", borderColor: "var(--border-color)", color: "var(--accent-color)" }}
                    />
                    <span className="opacity-60">Hz</span>
                  </div>
                </div>
                <div className="flex justify-between items-center">
                  <span className="opacity-70">PR Mechanical Q (Qms)</span>
                  <input
                    type="number"
                    step="0.5"
                    value={activeProject.prQms}
                    onChange={(e) => updateActiveProject({ prQms: parseFloat(e.target.value) || 0 })}
                    className="w-16 border rounded px-1.5 py-0.5 text-right font-mono focus:outline-none text-xs"
                    style={{ backgroundColor: "var(--sidebar-color)", borderColor: "var(--border-color)", color: "var(--accent-color)" }}
                  />
                </div>
              </div>
            )}
```
to:
```tsx
              <div className="flex flex-col gap-2.5 border rounded p-2.5 text-xs" style={{ backgroundColor: "var(--bg-color)", borderColor: "var(--border-color)" }}>
                <span className="font-semibold text-xs opacity-80 block mb-1">Passive Radiator Parameters</span>
                <NumberRow
                  label="PR Moving Mass (Mms)"
                  unit="g"
                  value={activeProject.prMms}
                  onChange={(v) => updateActiveProject({ prMms: v })}
                />
                <NumberRow
                  label="PR Piston Area (Sd)"
                  unit="cm²"
                  value={activeProject.prSd}
                  onChange={(v) => updateActiveProject({ prSd: v })}
                />
                <NumberRow
                  label="PR Resonance (Fs)"
                  unit="Hz"
                  value={activeProject.prFs}
                  onChange={(v) => updateActiveProject({ prFs: v })}
                />
                <NumberRow
                  label="PR Mechanical Q (Qms)"
                  step={0.5}
                  value={activeProject.prQms}
                  onChange={(v) => updateActiveProject({ prQms: v })}
                />
              </div>
            )}
```

- [ ] **Step 2: Custom Topology — Rear Chamber Volume**

Change:
```tsx
                    {/* Rear chamber volume */}
                    <div className="flex justify-between items-center">
                      <span className="opacity-70">Chamber Volume</span>
                      <div className="flex items-center gap-1">
                        <input type="number" value={activeProject.customTopology.rear.volume_liters}
                          onChange={e => updateCustomRear({ volume_liters: parseFloat(e.target.value) || 0 })}
                          className="w-16 border rounded px-1.5 py-0.5 text-right font-mono focus:outline-none text-xs"
                          style={{ backgroundColor: "var(--bg-color)", borderColor: "var(--border-color)", color: "var(--accent-color)" }} />
                        <span className="opacity-60">L</span>
                      </div>
                    </div>
```
to:
```tsx
                    {/* Rear chamber volume */}
                    <NumberRow
                      label="Chamber Volume"
                      unit="L"
                      value={activeProject.customTopology.rear.volume_liters}
                      onChange={(v) => updateCustomRear({ volume_liters: v })}
                    />
```

- [ ] **Step 3: Custom Topology — Rear Port Tuning/Diameter**

Change:
```tsx
                        <div className="flex justify-between items-center">
                          <span className="opacity-60">Tuning (Fb)</span>
                          <div className="flex items-center gap-1">
                            <input type="number" value={activeProject.customTopology.rear.port.tuning_freq}
                              onChange={e => updateCustomRearPort({ tuning_freq: parseFloat(e.target.value) || 0 })}
                              className="w-16 border rounded px-1.5 py-0.5 text-right font-mono focus:outline-none text-xs"
                              style={{ backgroundColor: "var(--sidebar-color)", borderColor: "var(--border-color)", color: "var(--accent-color)" }} />
                            <span className="opacity-60">Hz</span>
                          </div>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="opacity-60">Diameter</span>
                          <div className="flex items-center gap-1">
                            <input type="number" step="0.1" value={activeProject.customTopology.rear.port.diameter_cm}
                              onChange={e => updateCustomRearPort({ diameter_cm: parseFloat(e.target.value) || 0 })}
                              className="w-16 border rounded px-1.5 py-0.5 text-right font-mono focus:outline-none text-xs"
                              style={{ backgroundColor: "var(--sidebar-color)", borderColor: "var(--border-color)", color: "var(--accent-color)" }} />
                            <span className="opacity-60">cm</span>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <button onClick={() => updateCustomRear({ port: DEFAULT_PORT, pr: null })}
```
to:
```tsx
                        <NumberRow
                          label="Tuning (Fb)"
                          unit="Hz"
                          value={activeProject.customTopology.rear.port.tuning_freq}
                          onChange={(v) => updateCustomRearPort({ tuning_freq: v })}
                        />
                        <NumberRow
                          label="Diameter"
                          unit="cm"
                          step={0.1}
                          value={activeProject.customTopology.rear.port.diameter_cm}
                          onChange={(v) => updateCustomRearPort({ diameter_cm: v })}
                        />
                      </div>
                    ) : (
                      <button onClick={() => updateCustomRear({ port: DEFAULT_PORT, pr: null })}
```

- [ ] **Step 4: Custom Topology — Rear PR template (Moving Mass, Piston Area, Resonance, Mech. Q)**

Change:
```tsx
                        {[
                          { label: "Moving Mass", key: "mms_g" as const, unit: "g" },
                          { label: "Piston Area (Sd)", key: "sd_cm2" as const, unit: "cm²" },
                          { label: "Resonance (Fs)", key: "fs" as const, unit: "Hz" },
                          { label: "Mech. Q (Qms)", key: "qms" as const, unit: "" },
                        ].map(({ label, key, unit }) => (
                          <div key={key} className="flex justify-between items-center">
                            <span className="opacity-60">{label}</span>
                            <div className="flex items-center gap-1">
                              <input type="number" step="any" value={activeProject.customTopology.rear.pr![key]}
                                onChange={e => updateCustomRearPR({ [key]: parseFloat(e.target.value) || 0 })}
                                className="w-16 border rounded px-1.5 py-0.5 text-right font-mono focus:outline-none text-xs"
                                style={{ backgroundColor: "var(--sidebar-color)", borderColor: "var(--border-color)", color: "var(--accent-color)" }} />
                              {unit && <span className="opacity-60">{unit}</span>}
                            </div>
                          </div>
                        ))}
```
to:
```tsx
                        {[
                          { label: "Moving Mass", key: "mms_g" as const, unit: "g" },
                          { label: "Piston Area (Sd)", key: "sd_cm2" as const, unit: "cm²" },
                          { label: "Resonance (Fs)", key: "fs" as const, unit: "Hz" },
                          { label: "Mech. Q (Qms)", key: "qms" as const, unit: "" },
                        ].map(({ label, key, unit }) => (
                          <NumberRow
                            key={key}
                            label={label}
                            unit={unit || undefined}
                            step="any"
                            value={activeProject.customTopology.rear.pr![key]}
                            onChange={(v) => updateCustomRearPR({ [key]: v })}
                          />
                        ))}
```
(`unit={unit || undefined}` turns the template's empty-string unit for "Mech. Q (Qms)" into `undefined`, so `NumberRow`/`NumberInputBox`'s `{unit && (...)}` check correctly renders no suffix segment for that one row, matching the original's `{unit && <span>...}` behavior.)

- [ ] **Step 5: Custom Topology — Internal Port Tuning/Diameter**

Change:
```tsx
                        <div className="flex justify-between items-center">
                          <span className="opacity-60">Tuning (Fb)</span>
                          <div className="flex items-center gap-1">
                            <input type="number" value={activeProject.customTopology.internal_port.tuning_freq}
                              onChange={e => updateCustomInternalPort({ tuning_freq: parseFloat(e.target.value) || 0 })}
                              className="w-16 border rounded px-1.5 py-0.5 text-right font-mono focus:outline-none text-xs"
                              style={{ backgroundColor: "var(--sidebar-color)", borderColor: "var(--border-color)", color: "var(--accent-color)" }} />
                            <span className="opacity-60">Hz</span>
                          </div>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="opacity-60">Diameter</span>
                          <div className="flex items-center gap-1">
                            <input type="number" step="0.1" value={activeProject.customTopology.internal_port.diameter_cm}
                              onChange={e => updateCustomInternalPort({ diameter_cm: parseFloat(e.target.value) || 0 })}
                              className="w-16 border rounded px-1.5 py-0.5 text-right font-mono focus:outline-none text-xs"
                              style={{ backgroundColor: "var(--sidebar-color)", borderColor: "var(--border-color)", color: "var(--accent-color)" }} />
                            <span className="opacity-60">cm</span>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <button onClick={() => updateActiveProject({ customTopology: { ...activeProject.customTopology, internal_port: DEFAULT_PORT } })}
```
to:
```tsx
                        <NumberRow
                          label="Tuning (Fb)"
                          unit="Hz"
                          value={activeProject.customTopology.internal_port.tuning_freq}
                          onChange={(v) => updateCustomInternalPort({ tuning_freq: v })}
                        />
                        <NumberRow
                          label="Diameter"
                          unit="cm"
                          step={0.1}
                          value={activeProject.customTopology.internal_port.diameter_cm}
                          onChange={(v) => updateCustomInternalPort({ diameter_cm: v })}
                        />
                      </div>
                    ) : (
                      <button onClick={() => updateActiveProject({ customTopology: { ...activeProject.customTopology, internal_port: DEFAULT_PORT } })}
```

- [ ] **Step 6: Custom Topology — Front Chamber Volume**

Change:
```tsx
                        <div className="flex justify-between items-center">
                          <span className="opacity-70">Chamber Volume</span>
                          <div className="flex items-center gap-1">
                            <input type="number" value={activeProject.customTopology.front.volume_liters}
                              onChange={e => updateCustomFront({ volume_liters: parseFloat(e.target.value) || 0 })}
                              className="w-16 border rounded px-1.5 py-0.5 text-right font-mono focus:outline-none text-xs"
                              style={{ backgroundColor: "var(--bg-color)", borderColor: "var(--border-color)", color: "var(--accent-color)" }} />
                            <span className="opacity-60">L</span>
                          </div>
                        </div>
```
to:
```tsx
                        <NumberRow
                          label="Chamber Volume"
                          unit="L"
                          value={activeProject.customTopology.front.volume_liters}
                          onChange={(v) => updateCustomFront({ volume_liters: v })}
                        />
```

- [ ] **Step 7: Custom Topology — Front Port Tuning/Diameter**

Change:
```tsx
                            <div className="flex justify-between items-center">
                              <span className="opacity-60">Tuning (Fb)</span>
                              <div className="flex items-center gap-1">
                                <input type="number" value={activeProject.customTopology.front.port.tuning_freq}
                                  onChange={e => updateCustomFrontPort({ tuning_freq: parseFloat(e.target.value) || 0 })}
                                  className="w-16 border rounded px-1.5 py-0.5 text-right font-mono focus:outline-none text-xs"
                                  style={{ backgroundColor: "var(--sidebar-color)", borderColor: "var(--border-color)", color: "var(--accent-color)" }} />
                                <span className="opacity-60">Hz</span>
                              </div>
                            </div>
                            <div className="flex justify-between items-center">
                              <span className="opacity-60">Diameter</span>
                              <div className="flex items-center gap-1">
                                <input type="number" step="0.1" value={activeProject.customTopology.front.port.diameter_cm}
                                  onChange={e => updateCustomFrontPort({ diameter_cm: parseFloat(e.target.value) || 0 })}
                                  className="w-16 border rounded px-1.5 py-0.5 text-right font-mono focus:outline-none text-xs"
                                  style={{ backgroundColor: "var(--sidebar-color)", borderColor: "var(--border-color)", color: "var(--accent-color)" }} />
                                <span className="opacity-60">cm</span>
                              </div>
                            </div>
                          </div>
                        ) : (
                          <button onClick={() => updateCustomFront({ port: DEFAULT_PORT, pr: null })}
```
to:
```tsx
                            <NumberRow
                              label="Tuning (Fb)"
                              unit="Hz"
                              value={activeProject.customTopology.front.port.tuning_freq}
                              onChange={(v) => updateCustomFrontPort({ tuning_freq: v })}
                            />
                            <NumberRow
                              label="Diameter"
                              unit="cm"
                              step={0.1}
                              value={activeProject.customTopology.front.port.diameter_cm}
                              onChange={(v) => updateCustomFrontPort({ diameter_cm: v })}
                            />
                          </div>
                        ) : (
                          <button onClick={() => updateCustomFront({ port: DEFAULT_PORT, pr: null })}
```

- [ ] **Step 8: Custom Topology — Front PR template (Moving Mass, Piston Area, Resonance, Mech. Q)**

Change:
```tsx
                            {[
                              { label: "Moving Mass", key: "mms_g" as const, unit: "g" },
                              { label: "Piston Area (Sd)", key: "sd_cm2" as const, unit: "cm²" },
                              { label: "Resonance (Fs)", key: "fs" as const, unit: "Hz" },
                              { label: "Mech. Q (Qms)", key: "qms" as const, unit: "" },
                            ].map(({ label, key, unit }) => (
                              <div key={key} className="flex justify-between items-center">
                                <span className="opacity-60">{label}</span>
                                <div className="flex items-center gap-1">
                                  <input type="number" step="any" value={activeProject.customTopology.front.pr![key]}
                                    onChange={e => updateCustomFrontPR({ [key]: parseFloat(e.target.value) || 0 })}
                                    className="w-16 border rounded px-1.5 py-0.5 text-right font-mono focus:outline-none text-xs"
                                    style={{ backgroundColor: "var(--sidebar-color)", borderColor: "var(--border-color)", color: "var(--accent-color)" }} />
                                  {unit && <span className="opacity-60">{unit}</span>}
                                </div>
                              </div>
                            ))}
```
to:
```tsx
                            {[
                              { label: "Moving Mass", key: "mms_g" as const, unit: "g" },
                              { label: "Piston Area (Sd)", key: "sd_cm2" as const, unit: "cm²" },
                              { label: "Resonance (Fs)", key: "fs" as const, unit: "Hz" },
                              { label: "Mech. Q (Qms)", key: "qms" as const, unit: "" },
                            ].map(({ label, key, unit }) => (
                              <NumberRow
                                key={key}
                                label={label}
                                unit={unit || undefined}
                                step="any"
                                value={activeProject.customTopology.front.pr![key]}
                                onChange={(v) => updateCustomFrontPR({ [key]: v })}
                              />
                            ))}
```

- [ ] **Step 9: Verify zero raw `<input type="number">` remain in the whole file, and build**

Run: `grep -n 'type="number"' src/components/sidebar/EnclosureTab.tsx`
Expected: no output — this confirms all 40 of the file's original raw number inputs (across Tasks 6, 7, and this task) are gone.

Run: `npm run build`
Expected: succeeds.

- [ ] **Step 10: Commit**

```bash
git add src/components/sidebar/EnclosureTab.tsx
git commit -m "refactor: migrate EnclosureTab Part C (passive radiator, custom topology) to NumberRow"
```

---

## Task 9: Sidebar — collapse below a live-cursor threshold instead of clamping

**Files:**
- Modify: `src/components/sidebar/Sidebar.tsx`

**Interfaces:**
- Consumes: nothing new (local `useState` only, matching the prior round's Global Constraint against lifting this state or persisting it).

- [ ] **Step 1: Raise the floor, add the collapse-trigger constant, add a `dragging` flag**

Change:
```tsx
const MIN_WIDTH = 240;
const MAX_WIDTH = 480;
const COLLAPSED_WIDTH = 56;
```
to:
```tsx
const MIN_WIDTH = 280;
const MAX_WIDTH = 480;
const COLLAPSED_WIDTH = 56;
const COLLAPSE_TRIGGER_WIDTH = 200;
```

Change:
```tsx
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
```
to:
```tsx
  const [width, setWidth] = useState(320);
  const [collapsed, setCollapsed] = useState(false);
  const [dragging, setDragging] = useState(false);

  const handleResizeStart = (e: React.MouseEvent) => {
    e.preventDefault();
    setDragging(true);
    const startX = e.clientX;
    // Dragging from the collapsed rail starts the delta from its actual
    // rendered width (56px), not the stale preserved expanded width —
    // otherwise the very first pixel of movement would jump the sidebar
    // to the old expanded width before the user has dragged anywhere.
    const startWidth = collapsed ? COLLAPSED_WIDTH : width;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      // liveWidth tracks the raw cursor-implied width, unclamped — the
      // collapse decision below must use this, not the clamped `width`
      // state, or the MIN_WIDTH floor would absorb the extra drag
      // distance and collapse could never trigger.
      const liveWidth = startWidth + (moveEvent.clientX - startX);
      if (liveWidth < COLLAPSE_TRIGGER_WIDTH) {
        setCollapsed(true);
      } else {
        setCollapsed(false);
        setWidth(Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, liveWidth)));
      }
    };

    const handleMouseUp = () => {
      setDragging(false);
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
  };
```

- [ ] **Step 2: Suppress the width transition while actively dragging**

Change:
```tsx
    <div
      className="relative border-r flex flex-col overflow-hidden transition-[width] duration-150 shrink-0 shadow-xl"
      style={{ backgroundColor: "var(--sidebar-color)", borderRightColor: "var(--border-color)", width: collapsed ? COLLAPSED_WIDTH : width }}
    >
```
to:
```tsx
    <div
      className={`relative border-r flex flex-col overflow-hidden shrink-0 shadow-xl ${dragging ? "" : "transition-[width] duration-150"}`}
      style={{ backgroundColor: "var(--sidebar-color)", borderRightColor: "var(--border-color)", width: collapsed ? COLLAPSED_WIDTH : width }}
    >
```
(Without this, every `mousemove` during a drag would animate over the 150ms transition instead of tracking the cursor 1:1, making the resize — and especially the collapse snap — feel laggy. The transition still applies for the icon-button-triggered collapse/expand toggle, and for the initial mount, since `dragging` is only ever `true` during an active pointer drag.)

- [ ] **Step 3: Make the resize handle available in both expanded and collapsed states**

Change:
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
to:
```tsx
      {/* Resize handle — present even while collapsed, so the rail itself can be dragged back out */}
      <div
        onMouseDown={handleResizeStart}
        className="absolute top-0 right-0 h-full w-1.5 cursor-col-resize hover:bg-[var(--accent-color)]/20 active:bg-[var(--accent-color)]/30 transition-colors z-10"
      />
    </div>
  );
}
```

- [ ] **Step 4: Verify and build**

Run: `npm run build`
Expected: succeeds.

Trace through the logic once more before moving on (no live browser to test drag interactions here):
- Starting expanded at 320px, dragging left by 60px → `liveWidth = 260`, which is `< 280` (MIN_WIDTH) but `>= 200` (COLLAPSE_TRIGGER_WIDTH) → stays expanded, clamped to `width = 280`. Correct — the "give" zone.
- Continuing to drag left past that point until `liveWidth < 200` → `collapsed` flips `true`, rendered width jumps to 56px. Correct.
- From collapsed, dragging right: `startWidth = COLLAPSED_WIDTH = 56`, so `liveWidth = 56 + delta` grows naturally with the cursor; once it crosses back above 200, `collapsed` flips `false` again and `width` resumes normal clamped tracking. Correct — no discontinuous jump.
- Releasing the mouse at any point simply stops updating state further; whatever `collapsed`/`width` values were last set stay in effect. Correct.

- [ ] **Step 5: Commit**

```bash
git add src/components/sidebar/Sidebar.tsx
git commit -m "feat: sidebar snaps to collapsed below a live-cursor width threshold instead of clamping"
```

---

## Task 10: Final verification

**Files:** none (verification only)

**Interfaces:** none.

- [ ] **Step 1: Full build**

Run: `npm run build`
Expected: succeeds with zero TypeScript errors and a clean Vite production build.

- [ ] **Step 2: Test suite (unaffected by this batch, but confirms no regression)**

Run: `npm test`
Expected: all existing tests still pass (this batch touches no files under `src/lib/`).

- [ ] **Step 3: Confirm no raw number inputs remain outside their intentional exceptions**

Run: `grep -rn 'type="number"' src/components`
Expected: zero matches inside `EnclosureTab.tsx`, `SignalTab.tsx`, `DriverTab.tsx`, `SettingsModal.tsx`, `DimensionCalculator.tsx` (all migrated by this plan). `AddDriverModal.tsx`'s 13 `NumberField` call sites and its one deliberately-untouched Piston Diameter helper `<input type="number">` are out of scope for this plan (per the prior round's non-goals, still valid) and will still show up if you grep the whole `src/components` tree — that's expected, not a leftover.

- [ ] **Step 4: Confirm slider count**

Run: `grep -rc 'type="range"' src/components/sidebar/EnclosureTab.tsx src/components/sidebar/SignalTab.tsx`
Expected: `EnclosureTab.tsx:0`, `SignalTab.tsx:1` (only Wall Absorption remains).

- [ ] **Step 5: Report**

No commit for this task — it's a verification-only gate. If all 4 steps pass, the batch is complete and ready for the final whole-branch review.
