# UI/UX Overhaul Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the WinISD-style enclosure design app (Tauri + React) feel polished and intuitive: fix inconsistent/tiny text, verify and fix theme contrast across all 4 presets, replace jarring native browser dialogs with themed equivalents, add real hover tooltips and section collapsing to tame the dense sidebar, and make Ctrl+ zoom actually work.

**Architecture:** No rewrite. Everything lives in the existing single-page structure (`src/App.tsx`, `src/theme.ts`, `src/App.css`). Two changes create most of the leverage: (1) redefining Tailwind's type-scale tokens in `App.css` — since the app already uses `text-xs`/`text-sm`/`text-base`/`text-lg` extensively, retuning those tokens once reflows sizing sitewide with no per-callsite edits; (2) a small set of new shared primitives (`src/components/ui/`) — `TextField`/`NumberField`/`Select`, `Button`, `PanelHeader`, `Badge`, `Tooltip`, `CollapsibleSection`, `Toast`, `ConfirmDialog`/`PromptDialog` — that replace the ~50+ repeated inline `style={{...}}` blocks and the 13 native `alert()`/`confirm()`/`prompt()` call sites. Remaining tasks apply these region by region.

**Tech Stack:** React 19, TypeScript, Tailwind CSS v4 (CSS-first `@theme` config via `@tailwindcss/vite`), Tauri v2, lucide-react icons.

**Spec:** `docs/superpowers/specs/2026-08-28-ui-ux-overhaul-design.md`

## Global Constraints

- No new features, no new calculators/graphs/parameters (spec Non-goals).
- No split of `App.tsx` into many files; no componentization beyond the primitives listed above (spec Non-goals).
- Do not touch `src-tauri/src/*.rs` — these already show modified in `git status` from prior unrelated work; leave them alone (spec Non-goals).
- No new top-level navigation paradigm — Driver/Enclosure/Signal tabs and fixed sidebar stay (spec Non-goals).
- Floor for any text size is 11px (`text-2xs`); nothing smaller (spec Section 1).
- Every theme (Slate Dark, Classic WinISD, Cyberpunk, Solarized Light) must pass the WCAG contrast script from Task 3 before Task 3 is considered done (spec Section 2, Testing).
- All new/touched UI must read CSS custom properties (`var(--...)`) for color — never hardcode a hex value or a `bg-slate-*`/`text-slate-*` Tailwind color class for anything that should follow the active theme (spec Section 2; this fixes real existing bugs, see Task 20).
- Every task that touches `App.tsx` ends with `npm run build` passing (TypeScript compiles) before commit.

---

## File Structure

**New files:**
- `src/components/ui/Field.tsx` — `TextField`, `NumberField`, `Select`
- `src/components/ui/Button.tsx` — `Button` (primary/secondary/icon variants)
- `src/components/ui/PanelHeader.tsx` — `PanelHeader`
- `src/components/ui/Badge.tsx` — `Badge`
- `src/components/ui/Tooltip.tsx` — `Tooltip`
- `src/components/ui/CollapsibleSection.tsx` — `CollapsibleSection`, `useSectionState`
- `src/components/ui/Toast.tsx` — `ToastProvider`, `useToast`
- `src/components/ui/Dialog.tsx` — `DialogProvider`, `useDialog` (confirm + prompt)
- `src/components/ui/index.ts` — barrel export
- `scripts/check-theme-contrast.mjs` — one-off WCAG contrast verification tool (not part of the app build; a dev-time script per spec's Testing section, intentionally holds its own copy of draft color values rather than importing TypeScript)

**Modified files:**
- `src-tauri/tauri.conf.json` — enable zoom hotkeys
- `src/theme.ts` — extend `AppTheme`, all 4 presets, `applyTheme`
- `src/App.css` — new CSS var defaults, Tailwind `@theme` type-scale overrides, color-scheme wiring
- `src/main.tsx` — mount `ToastProvider`/`DialogProvider`
- `src/App.tsx` — extensively, region by region (Tasks 8–22)

---

## Task 1: Enable native zoom in the Tauri webview

**Files:**
- Modify: `src-tauri/tauri.conf.json`

**Interfaces:** None (config-only).

- [ ] **Step 1: Add the zoom hotkeys option**

In `src-tauri/tauri.conf.json`, inside the first (and only) object under `app.windows`, add `"zoomHotkeysEnabled": true`:

```json
{
  "$schema": "https://schema.tauri.app/config/2",
  "productName": "tauri-appwinisd",
  "version": "0.1.0",
  "identifier": "com.winisd.modern",
  "build": {
    "beforeDevCommand": "npm run dev",
    "devUrl": "http://localhost:1420",
    "beforeBuildCommand": "npm run build",
    "frontendDist": "../dist"
  },
  "app": {
    "windows": [
      {
        "title": "tauri-appwinisd",
        "width": 800,
        "height": 600,
        "zoomHotkeysEnabled": true
      }
    ],
    "security": {
      "csp": null
    }
  },
  "bundle": {
    "active": true,
    "targets": "all",
    "icon": [
      "icons/32x32.png",
      "icons/128x128.png",
      "icons/128x128@2x.png",
      "icons/icon.icns",
      "icons/icon.ico"
    ]
  }
}
```

- [ ] **Step 2: Verify in the running app**

Run: `npm run tauri dev`
In the window that opens, press `Ctrl+` / `Ctrl-` (or `Cmd+`/`Cmd-` on macOS) and Ctrl+scroll.
Expected: the UI zooms in/out; `Ctrl+0` resets zoom.

- [ ] **Step 3: Commit**

```bash
git add src-tauri/tauri.conf.json
git commit -m "fix: enable native zoom hotkeys in Tauri webview"
```

---

## Task 2: Extend theme tokens (textMuted/warning/danger) + fix light-theme input color-scheme

**Files:**
- Modify: `src/theme.ts` (full file, 75 lines)
- Modify: `src/App.tsx:2127-2138` (`activePresetKey` comparison)

**Interfaces:**
- Produces: `AppTheme` gains `textMutedColor: string`, `warningColor: string`, `dangerColor: string`. `applyTheme()` now also sets CSS vars `--text-muted-color`, `--warning-color`, `--danger-color`, `--color-scheme`.
- Consumed by: Task 5's `Badge`, Task 7's `Toast`/`Dialog`, and every later App.tsx task that replaces `opacity-*` secondary text or hardcoded `#f59e0b`/`#f87171` with these vars.

- [ ] **Step 1: Rewrite `src/theme.ts`**

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
  warningColor: string;
  dangerColor: string;
}

export const PRESETS: Record<string, AppTheme> = {
  slate: {
    name: "Slate Dark",
    bgColor: "#020617",
    sidebarColor: "#0f172a",
    textColor: "#f8fafc",
    textMutedColor: "#94a3b8",
    accentColor: "#10b981",
    graphLineColor: "#06b6d4",
    graphGridColor: "#1e293b",
    warningColor: "#f59e0b",
    dangerColor: "#f87171",
  },
  classic: {
    name: "Classic WinISD",
    bgColor: "#d1d5db",
    sidebarColor: "#9ca3af",
    textColor: "#111827",
    textMutedColor: "#374151",
    accentColor: "#2563eb",
    graphLineColor: "#10b981",
    graphGridColor: "#6b7280",
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
    graphGridColor: "#5b21b6",
    warningColor: "#fbbf24",
    dangerColor: "#f87171",
  },
  solarized: {
    name: "Solarized Light",
    bgColor: "#fdf6e3",
    sidebarColor: "#eee8d5",
    textColor: "#073642",
    textMutedColor: "#586e75",
    accentColor: "#b58900",
    graphLineColor: "#268bd2",
    graphGridColor: "#93a1a1",
    warningColor: "#cb4b16",
    dangerColor: "#dc322f",
  },
};

function relativeLuminance(hex: string): number {
  const c = hex.replace("#", "");
  const r = parseInt(c.substring(0, 2), 16) / 255;
  const g = parseInt(c.substring(2, 4), 16) / 255;
  const b = parseInt(c.substring(4, 6), 16) / 255;
  const lin = (v: number) => (v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4));
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

export function applyTheme(theme: AppTheme) {
  const root = document.documentElement;
  root.style.setProperty("--bg-color", theme.bgColor);
  root.style.setProperty("--sidebar-color", theme.sidebarColor);
  root.style.setProperty("--text-color", theme.textColor);
  root.style.setProperty("--text-muted-color", theme.textMutedColor);
  root.style.setProperty("--accent-color", theme.accentColor);
  root.style.setProperty("--graph-line-color", theme.graphLineColor);
  root.style.setProperty("--graph-grid-color", theme.graphGridColor);
  root.style.setProperty("--warning-color", theme.warningColor);
  root.style.setProperty("--danger-color", theme.dangerColor);
  root.style.setProperty("--color-scheme", relativeLuminance(theme.bgColor) > 0.5 ? "light" : "dark");
}

export function saveTheme(theme: AppTheme) {
  localStorage.setItem("winisd_custom_theme", JSON.stringify(theme));
}

export function loadSavedTheme(): AppTheme {
  const saved = localStorage.getItem("winisd_custom_theme");
  if (saved) {
    try {
      return JSON.parse(saved);
    } catch (_) {
      // Fallback
    }
  }
  return PRESETS.slate;
}
```

Note: the `graphGridColor` for `cyberpunk` and `solarized` changed from the original values — this is the Section 2 contrast fix. These are draft values; Task 3 verifies and may adjust them further.

- [ ] **Step 2: Extend `activePresetKey` to compare the new fields**

In `src/App.tsx`, find (around line 2127):

```ts
  const activePresetKey = useMemo(() => {
    const matched = Object.keys(PRESETS).find(
      (key) =>
        PRESETS[key].bgColor === currentTheme.bgColor &&
        PRESETS[key].sidebarColor === currentTheme.sidebarColor &&
        PRESETS[key].textColor === currentTheme.textColor &&
        PRESETS[key].accentColor === currentTheme.accentColor &&
        PRESETS[key].graphLineColor === currentTheme.graphLineColor &&
        PRESETS[key].graphGridColor === currentTheme.graphGridColor
    );
    return matched || "custom";
  }, [currentTheme]);
```

Replace with:

```ts
  const activePresetKey = useMemo(() => {
    const matched = Object.keys(PRESETS).find(
      (key) =>
        PRESETS[key].bgColor === currentTheme.bgColor &&
        PRESETS[key].sidebarColor === currentTheme.sidebarColor &&
        PRESETS[key].textColor === currentTheme.textColor &&
        PRESETS[key].textMutedColor === currentTheme.textMutedColor &&
        PRESETS[key].accentColor === currentTheme.accentColor &&
        PRESETS[key].graphLineColor === currentTheme.graphLineColor &&
        PRESETS[key].graphGridColor === currentTheme.graphGridColor &&
        PRESETS[key].warningColor === currentTheme.warningColor &&
        PRESETS[key].dangerColor === currentTheme.dangerColor
    );
    return matched || "custom";
  }, [currentTheme]);
```

- [ ] **Step 3: Update `App.css` CSS var defaults and color-scheme (see Task 4 — do together or in either order, both must land before build is verified)**

This step is completed as part of Task 4, Step 1, since both edit `App.css`. Skip ahead only if doing these two tasks in the same sitting; otherwise `npm run build` will still pass (TypeScript doesn't check CSS), but the app will show unstyled `var(--text-muted-color)` etc. until Task 4 lands.

- [ ] **Step 4: Verify build**

Run: `npm run build`
Expected: succeeds with no TypeScript errors (confirms `AppTheme` usages across `App.tsx` still type-check — `handleCustomColorChange(key: keyof AppTheme, ...)` accepts the new keys automatically since it's typed generically).

- [ ] **Step 5: Commit**

```bash
git add src/theme.ts src/App.tsx
git commit -m "feat: add textMuted/warning/danger theme tokens, fix cyberpunk/solarized grid contrast"
```

---

## Task 3: WCAG contrast verification script

**Files:**
- Create: `scripts/check-theme-contrast.mjs`

**Interfaces:**
- Consumes: the final color values from Task 2's `src/theme.ts` (copied in manually — see note in File Structure).
- Produces: pass/fail console report; no runtime dependency for the app.

- [ ] **Step 1: Write the script**

```js
#!/usr/bin/env node
// One-off dev tool: verifies WCAG contrast ratios for each theme's color
// pairs. Not wired into CI or the app build — run manually after editing
// src/theme.ts, and keep the THEMES constant below in sync with it.

const THEMES = {
  slate: {
    bg: "#020617", sidebar: "#0f172a", text: "#f8fafc", textMuted: "#94a3b8",
    accent: "#10b981", graphGrid: "#1e293b", warning: "#f59e0b", danger: "#f87171",
  },
  classic: {
    bg: "#d1d5db", sidebar: "#9ca3af", text: "#111827", textMuted: "#374151",
    accent: "#2563eb", graphGrid: "#6b7280", warning: "#b45309", danger: "#b91c1c",
  },
  cyberpunk: {
    bg: "#0f051d", sidebar: "#1b0a2f", text: "#fdf4ff", textMuted: "#c4b5fd",
    accent: "#f43f5e", graphGrid: "#5b21b6", warning: "#fbbf24", danger: "#f87171",
  },
  solarized: {
    bg: "#fdf6e3", sidebar: "#eee8d5", text: "#073642", textMuted: "#586e75",
    accent: "#b58900", graphGrid: "#93a1a1", warning: "#cb4b16", danger: "#dc322f",
  },
};

function luminance(hex) {
  const c = hex.replace("#", "");
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(c.substring(i, i + 2), 16) / 255);
  const lin = (v) => (v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4));
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

function contrastRatio(hex1, hex2) {
  const l1 = luminance(hex1);
  const l2 = luminance(hex2);
  const [lighter, darker] = l1 > l2 ? [l1, l2] : [l2, l1];
  return (lighter + 0.05) / (darker + 0.05);
}

// [label, foreground key, background key, minimum ratio]
const CHECKS = [
  ["body text on bg", "text", "bg", 4.5],
  ["body text on sidebar", "text", "sidebar", 4.5],
  ["muted text on bg", "textMuted", "bg", 4.5],
  ["muted text on sidebar", "textMuted", "sidebar", 4.5],
  ["accent on bg", "accent", "bg", 3.0],
  ["accent on sidebar", "accent", "sidebar", 3.0],
  ["warning on bg", "warning", "bg", 3.0],
  ["danger on bg", "danger", "bg", 3.0],
  ["grid lines on bg", "graphGrid", "bg", 3.0],
];

let anyFailed = false;

for (const [themeName, colors] of Object.entries(THEMES)) {
  console.log(`\n${themeName}`);
  for (const [label, fgKey, bgKey, minRatio] of CHECKS) {
    const ratio = contrastRatio(colors[fgKey], colors[bgKey]);
    const pass = ratio >= minRatio;
    if (!pass) anyFailed = true;
    console.log(
      `  ${pass ? "PASS" : "FAIL"}  ${label.padEnd(24)} ${ratio.toFixed(2)}:1  (need >= ${minRatio}:1)`
    );
  }
}

console.log();
if (anyFailed) {
  console.error("One or more contrast checks failed. Adjust src/theme.ts and this script's THEMES constant, then re-run.");
  process.exit(1);
} else {
  console.log("All contrast checks passed.");
  process.exit(0);
}
```

- [ ] **Step 2: Run it**

Run: `node scripts/check-theme-contrast.mjs`
Expected: a per-theme report. If anything prints `FAIL`, adjust the failing color in both `scripts/check-theme-contrast.mjs`'s `THEMES` constant and `src/theme.ts`'s matching `PRESETS` entry (they must stay in sync manually — this is a one-off verification tool, not a build-time check), then re-run until all checks print `PASS`.

Known likely adjustment point: `cyberpunk`'s `graphGrid` (`#5b21b6`) against `bg` (`#0f051d`) — if it fails the 3.0:1 minimum, lighten it further (e.g. toward `#7c3aed`) and re-check it doesn't overpower the neon line colors by eye in Task 1's manual run.

- [ ] **Step 3: Commit**

```bash
git add scripts/check-theme-contrast.mjs src/theme.ts
git commit -m "test: add WCAG contrast verification script for theme presets"
```

---

## Task 4: Tailwind type-scale tokens + global tiny-text sweep

**Files:**
- Modify: `src/App.css` (full file, 68 lines)
- Modify: `src/App.tsx` (global find/replace across ~101 sites)

**Interfaces:** None (Tailwind utility classes + CSS vars only).

- [ ] **Step 1: Rewrite `src/App.css`**

```css
@import "tailwindcss";

@theme {
  --text-2xs: 0.6875rem;       /* 11px — micro-labels, badges, unit suffixes */
  --text-2xs--line-height: 1rem;
  --text-sm: 0.8125rem;        /* 13px, was Tailwind's default 14px */
  --text-sm--line-height: 1.25rem;
  --text-base: 0.875rem;       /* 14px, was Tailwind's default 16px */
  --text-base--line-height: 1.375rem;
  --text-lg: 1rem;             /* 16px, was Tailwind's default 18px */
  --text-lg--line-height: 1.5rem;
}

:root {
  --bg-color: #020617;
  --sidebar-color: #0f172a;
  --text-color: #f8fafc;
  --text-muted-color: #94a3b8;
  --accent-color: #10b981;
  --graph-line-color: #06b6d4;
  --graph-grid-color: #1e293b;
  --warning-color: #f59e0b;
  --danger-color: #f87171;
  --color-scheme: dark;
}

body {
  background-color: var(--bg-color);
  color: var(--text-color);
  transition: background-color 0.15s ease, color 0.15s ease;
  margin: 0;
  padding: 0;
  width: 100vw;
  height: 100vh;
  overflow: hidden;
}

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

/* Align input text vertically and skin number spinners to match the active theme.
   color-scheme drives native browser chrome (e.g. the number spinner arrows) —
   it must follow the theme's actual brightness, not be hardcoded dark, or those
   controls render dark-on-light in light themes (Classic, Solarized). */
input[type="number"],
input[type="text"] {
  line-height: 1.25rem !important; /* Forces a consistent centered line-height height matching padding */
  color-scheme: var(--color-scheme, dark);
  vertical-align: middle;
  box-sizing: border-box;
}

input[type="number"] {
  text-align: left !important; /* Left-aligns number text to match other form fields and prevent spinner collisions */
  padding-left: 0.5rem !important;
  padding-right: 1.25rem !important; /* Reduces parent padding, allowing space for text */
  width: 5.5rem !important; /* Enforces a comfortable width to prevent spinner overlap */
}

input[type="number"]::-webkit-inner-spin-button,
input[type="number"]::-webkit-outer-spin-button {
  margin-right: -1.0rem !important; /* Pulls the spinner back to the right border */
  cursor: pointer;
}
```

(Everything past this point in the original file — verify with `wc -l src/App.css` before and after; the original is 68 lines total, so the above is the complete file. If `git diff` shows more lines below this in your checkout, append them unchanged after the last rule shown here.)

- [ ] **Step 2: Global mechanical replacement in `src/App.tsx`**

Every arbitrary-value tiny text size class becomes `text-2xs`. Run:

```bash
grep -c 'text-\[7px\]\|text-\[8px\]\|text-\[9px\]\|text-\[10px\]\|text-\[11px\]' src/App.tsx
```

Expected before: ~101 (74×10px + 20×11px + 4×9px + 2×8px + 1×7px, per the brainstorming audit — exact count may drift slightly from prior edits, that's fine).

Replace every occurrence of each of these five literal strings with `text-2xs`:
- `text-[7px]` → `text-2xs`
- `text-[8px]` → `text-2xs`
- `text-[9px]` → `text-2xs`
- `text-[10px]` → `text-2xs`
- `text-[11px]` → `text-2xs`

This is a pure string substitution — every one of these classes appears standalone (not combined with other bracket modifiers in this codebase, confirmed by the grep above), so a global find/replace for each of the 5 literal strings is safe. Use your editor's find/replace or:

```bash
sed -i \
  -e 's/text-\[7px\]/text-2xs/g' \
  -e 's/text-\[8px\]/text-2xs/g' \
  -e 's/text-\[9px\]/text-2xs/g' \
  -e 's/text-\[10px\]/text-2xs/g' \
  -e 's/text-\[11px\]/text-2xs/g' \
  src/App.tsx
```

- [ ] **Step 3: Verify the sweep**

Run:
```bash
grep -c 'text-\[7px\]\|text-\[8px\]\|text-\[9px\]\|text-\[10px\]\|text-\[11px\]' src/App.tsx
```
Expected: `0`.

- [ ] **Step 4: Verify build and visually spot-check**

Run: `npm run build` — expected: succeeds.
Run: `npm run tauri dev`, open the app, and look at the sidebar's stat labels (e.g. Fs/Qts/Vas under Active Driver) and the graph dashboard's stat grid. Expected: text is legibly larger than before, nothing overlaps or clips (11px vs the old 7–10px is a small enough delta that layouts built for those slots should still fit; if anything clips, note it — it gets fixed in the region-specific task that touches that area, Tasks 10–22).

- [ ] **Step 5: Commit**

```bash
git add src/App.css src/App.tsx
git commit -m "feat: define type-scale tokens, replace all sub-11px text with 11px floor"
```

---

## Task 5: UI primitives — form fields, button, panel header, badge

**Files:**
- Create: `src/components/ui/Field.tsx`
- Create: `src/components/ui/Button.tsx`
- Create: `src/components/ui/PanelHeader.tsx`
- Create: `src/components/ui/Badge.tsx`

**Interfaces:**
- Produces: `TextField({label?, value: string, onChange: (v: string) => void, placeholder?, required?, className?, monospace?})`, `NumberField({label?, value: number|string, onChange: (v: number) => void, min?, max?, step?, required?, disabled?, unit?, className?, accent?})`, `Select({label?, value: string, onChange: (v: string) => void, options: {value, label}[], className?})`, `Button({variant?: "primary"|"secondary"|"icon", ...ButtonHTMLAttributes, children})`, `PanelHeader({children, action?})`, `Badge({children, tone?: "default"|"accent"|"warning"|"danger"})`.
- Consumed by: Tasks 8–22.

- [ ] **Step 1: Create `src/components/ui/Field.tsx`**

```tsx
import { ReactNode } from "react";

interface FieldWrapperProps {
  label?: string;
  className?: string;
  children: ReactNode;
}

function FieldWrapper({ label, className, children }: FieldWrapperProps) {
  return (
    <div className={className}>
      {label && <label className="text-xs opacity-70 block mb-1">{label}</label>}
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
        style={{ backgroundColor: "var(--bg-color)", borderColor: "var(--graph-grid-color)", color: "var(--text-color)" }}
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
          value={value}
          onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
          className="w-full border rounded px-2.5 py-1.5 text-sm font-mono text-right focus:outline-none focus:ring-2 focus:ring-[var(--accent-color)]/50 disabled:cursor-not-allowed"
          style={{
            backgroundColor: "var(--bg-color)",
            borderColor: "var(--graph-grid-color)",
            color: disabled ? "var(--text-muted-color)" : accent ? "var(--accent-color)" : "var(--text-color)",
          }}
        />
        {unit && <span className="text-xs opacity-60 shrink-0">{unit}</span>}
      </div>
    </FieldWrapper>
  );
}

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
        style={{ backgroundColor: "var(--bg-color)", borderColor: "var(--graph-grid-color)", color: "var(--text-color)" }}
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>
    </FieldWrapper>
  );
}
```

Note on `NumberField`'s `onChange`: it always reports `parseFloat(value) || 0`. Call sites that need a different fallback than `0` (e.g. "Number of Drivers" needs `|| 1`) apply it themselves: `onChange={(v) => updateActiveProject({ numDrivers: v || 1 })}` — `0 || 1` still evaluates to `1`, so no flexibility is lost.

- [ ] **Step 2: Create `src/components/ui/Button.tsx`**

```tsx
import { ButtonHTMLAttributes, ReactNode } from "react";

type ButtonVariant = "primary" | "secondary" | "icon";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  children: ReactNode;
}

const base = "rounded transition cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed";

export function Button({ variant = "secondary", className = "", children, style, ...rest }: ButtonProps) {
  if (variant === "primary") {
    return (
      <button
        {...rest}
        className={`${base} px-4 py-2 text-sm font-semibold border hover:brightness-110 active:brightness-95 ${className}`}
        style={{ backgroundColor: "var(--accent-color)", borderColor: "var(--accent-color)", color: "#fff", ...style }}
      >
        {children}
      </button>
    );
  }
  if (variant === "icon") {
    return (
      <button
        {...rest}
        className={`${base} p-1.5 border hover:opacity-80 flex items-center justify-center ${className}`}
        style={{ backgroundColor: "var(--bg-color)", borderColor: "var(--graph-grid-color)", color: "var(--accent-color)", ...style }}
      >
        {children}
      </button>
    );
  }
  return (
    <button
      {...rest}
      className={`${base} px-4 py-2 text-sm font-medium border hover:opacity-90 ${className}`}
      style={{ backgroundColor: "var(--bg-color)", borderColor: "var(--graph-grid-color)", color: "var(--text-color)", ...style }}
    >
      {children}
    </button>
  );
}
```

- [ ] **Step 3: Create `src/components/ui/PanelHeader.tsx`**

```tsx
import { ReactNode } from "react";

interface PanelHeaderProps {
  children: ReactNode;
  action?: ReactNode;
}

export function PanelHeader({ children, action }: PanelHeaderProps) {
  return (
    <div className="flex justify-between items-center">
      <h4 className="text-xs font-semibold opacity-70 uppercase tracking-wider">{children}</h4>
      {action}
    </div>
  );
}
```

- [ ] **Step 4: Create `src/components/ui/Badge.tsx`**

```tsx
import { ReactNode } from "react";

interface BadgeProps {
  children: ReactNode;
  tone?: "default" | "accent" | "warning" | "danger";
}

const toneVar: Record<string, string> = {
  default: "var(--text-muted-color)",
  accent: "var(--accent-color)",
  warning: "var(--warning-color)",
  danger: "var(--danger-color)",
};

export function Badge({ children, tone = "default" }: BadgeProps) {
  const color = toneVar[tone];
  return (
    <span
      className="text-2xs font-mono font-bold border px-1.5 py-0.5 rounded"
      style={{ backgroundColor: "var(--bg-color)", borderColor: color, color }}
    >
      {children}
    </span>
  );
}
```

- [ ] **Step 5: Verify build**

Run: `npm run build`
Expected: succeeds (these files aren't imported anywhere yet, so this just confirms they compile standalone — TypeScript still checks unreferenced files that are part of the project).

- [ ] **Step 6: Commit**

```bash
git add src/components/ui/Field.tsx src/components/ui/Button.tsx src/components/ui/PanelHeader.tsx src/components/ui/Badge.tsx
git commit -m "feat: add TextField/NumberField/Select/Button/PanelHeader/Badge primitives"
```

---

## Task 6: UI primitives — Tooltip, CollapsibleSection

**Files:**
- Create: `src/components/ui/Tooltip.tsx`
- Create: `src/components/ui/CollapsibleSection.tsx`

**Interfaces:**
- Produces: `Tooltip({label: string, children})` (hover/focus-triggered, CSS-only positioning, no library). `CollapsibleSection({title: string, open: boolean, onToggle: () => void, action?, children})` and `useSectionState(initial: Record<string, boolean>): [Record<string, boolean>, (key: string) => void]`.
- Consumed by: Tasks 8 (header icon tooltips), 10–17 (sidebar section collapsing).

- [ ] **Step 1: Create `src/components/ui/Tooltip.tsx`**

```tsx
import { ReactNode, useState } from "react";

interface TooltipProps {
  label: string;
  children: ReactNode;
}

export function Tooltip({ label, children }: TooltipProps) {
  const [visible, setVisible] = useState(false);
  return (
    <span
      className="relative inline-flex"
      onMouseEnter={() => setVisible(true)}
      onMouseLeave={() => setVisible(false)}
      onFocus={() => setVisible(true)}
      onBlur={() => setVisible(false)}
    >
      {children}
      {visible && (
        <span
          role="tooltip"
          className="absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-1.5 px-2 py-1 rounded text-2xs font-medium whitespace-nowrap shadow-lg pointer-events-none"
          style={{ backgroundColor: "var(--sidebar-color)", color: "var(--text-color)", border: "1px solid var(--graph-grid-color)" }}
        >
          {label}
        </span>
      )}
    </span>
  );
}
```

- [ ] **Step 2: Create `src/components/ui/CollapsibleSection.tsx`**

```tsx
import { ReactNode, useCallback, useState } from "react";
import { ChevronDown } from "lucide-react";

interface CollapsibleSectionProps {
  title: string;
  open: boolean;
  onToggle: () => void;
  action?: ReactNode;
  children: ReactNode;
}

export function CollapsibleSection({ title, open, onToggle, action, children }: CollapsibleSectionProps) {
  return (
    <div className="border rounded-lg overflow-hidden" style={{ borderColor: "var(--graph-grid-color)" }}>
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center justify-between px-3 py-2 text-xs font-semibold uppercase tracking-wider cursor-pointer hover:bg-black/10 transition"
        style={{ backgroundColor: "var(--sidebar-color)", color: "var(--text-color)" }}
      >
        <span>{title}</span>
        <span className="flex items-center gap-2">
          {action && <span onClick={(e) => e.stopPropagation()}>{action}</span>}
          <ChevronDown className={`h-3.5 w-3.5 opacity-60 transition-transform ${open ? "rotate-180" : ""}`} />
        </span>
      </button>
      {open && (
        <div className="p-3 flex flex-col gap-3" style={{ backgroundColor: "var(--bg-color)" }}>
          {children}
        </div>
      )}
    </div>
  );
}

/** Tracks open/closed state for a set of named sections, keyed by string id. */
export function useSectionState(initial: Record<string, boolean>) {
  const [state, setState] = useState(initial);
  const toggle = useCallback((key: string) => {
    setState((prev) => ({ ...prev, [key]: !prev[key] }));
  }, []);
  return [state, setState, toggle] as const;
}
```

- [ ] **Step 3: Verify build and commit**

Run: `npm run build` — expected: succeeds.

```bash
git add src/components/ui/Tooltip.tsx src/components/ui/CollapsibleSection.tsx
git commit -m "feat: add Tooltip and CollapsibleSection primitives"
```

---

## Task 7: UI primitives — Toast and Dialog (confirm/prompt) + mount at app root

**Files:**
- Create: `src/components/ui/Toast.tsx`
- Create: `src/components/ui/Dialog.tsx`
- Create: `src/components/ui/index.ts`
- Modify: `src/main.tsx`

**Interfaces:**
- Produces: `useToast(): { success: (msg: string) => void; error: (msg: string) => void }`. `useDialog(): { confirmDialog: (opts: {title, body, confirmLabel?, cancelLabel?, okOnly?}) => Promise<boolean>; promptDialog: (opts: {title, label, defaultValue?, confirmLabel?}) => Promise<string | null> }`.
- Consumed by: Tasks 8–9 (replacing all `alert()`/`confirm()`/`prompt()` call sites) and any later task that wants a save-confirmation toast.

- [ ] **Step 1: Create `src/components/ui/Toast.tsx`**

```tsx
import { createContext, ReactNode, useCallback, useContext, useRef, useState } from "react";
import { CheckCircle2, X, XCircle } from "lucide-react";

type ToastTone = "success" | "error";
interface ToastItem {
  id: number;
  tone: ToastTone;
  message: string;
}

interface ToastContextValue {
  success: (message: string) => void;
  error: (message: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const nextId = useRef(0);

  const dismiss = useCallback((id: number) => {
    setItems((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const push = useCallback(
    (tone: ToastTone, message: string) => {
      const id = nextId.current++;
      setItems((prev) => [...prev, { id, tone, message }]);
      const duration = tone === "success" ? 3000 : 6000;
      setTimeout(() => dismiss(id), duration);
    },
    [dismiss]
  );

  const value: ToastContextValue = {
    success: (message) => push("success", message),
    error: (message) => push("error", message),
  };

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="fixed bottom-5 right-5 z-100 flex flex-col gap-2 w-80">
        {items.map((item) => (
          <div
            key={item.id}
            className="flex items-start gap-2 rounded-lg border shadow-xl p-3 text-sm animate-fadeIn"
            style={{
              backgroundColor: "var(--sidebar-color)",
              borderColor: item.tone === "error" ? "var(--danger-color)" : "var(--accent-color)",
              color: "var(--text-color)",
            }}
          >
            {item.tone === "success" ? (
              <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" style={{ color: "var(--accent-color)" }} />
            ) : (
              <XCircle className="h-4 w-4 shrink-0 mt-0.5" style={{ color: "var(--danger-color)" }} />
            )}
            <span className="flex-1 whitespace-pre-line">{item.message}</span>
            <button onClick={() => dismiss(item.id)} className="opacity-60 hover:opacity-100 cursor-pointer shrink-0">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
```

- [ ] **Step 2: Create `src/components/ui/Dialog.tsx`**

```tsx
import { createContext, ReactNode, useCallback, useContext, useState } from "react";

interface ConfirmOptions {
  title: string;
  body: string;
  confirmLabel?: string;
  cancelLabel?: string;
  okOnly?: boolean;
}
interface PromptOptions {
  title: string;
  label: string;
  defaultValue?: string;
  confirmLabel?: string;
}

interface DialogContextValue {
  confirmDialog: (opts: ConfirmOptions) => Promise<boolean>;
  promptDialog: (opts: PromptOptions) => Promise<string | null>;
}

const DialogContext = createContext<DialogContextValue | null>(null);

export function useDialog(): DialogContextValue {
  const ctx = useContext(DialogContext);
  if (!ctx) throw new Error("useDialog must be used within DialogProvider");
  return ctx;
}

type Pending =
  | (ConfirmOptions & { kind: "confirm"; resolve: (v: boolean) => void })
  | (PromptOptions & { kind: "prompt"; resolve: (v: string | null) => void });

export function DialogProvider({ children }: { children: ReactNode }) {
  const [pending, setPending] = useState<Pending | null>(null);
  const [promptValue, setPromptValue] = useState("");

  const confirmDialog = useCallback((opts: ConfirmOptions) => {
    return new Promise<boolean>((resolve) => {
      setPending({ ...opts, kind: "confirm", resolve });
    });
  }, []);

  const promptDialog = useCallback((opts: PromptOptions) => {
    setPromptValue(opts.defaultValue ?? "");
    return new Promise<string | null>((resolve) => {
      setPending({ ...opts, kind: "prompt", resolve });
    });
  }, []);

  const closeConfirm = (result: boolean) => {
    if (!pending || pending.kind !== "confirm") return;
    pending.resolve(result);
    setPending(null);
  };

  const closePrompt = (result: string | null) => {
    if (!pending || pending.kind !== "prompt") return;
    pending.resolve(result);
    setPending(null);
  };

  return (
    <DialogContext.Provider value={{ confirmDialog, promptDialog }}>
      {children}
      {pending && (
        <div className="fixed inset-0 z-200 bg-black/60 backdrop-blur-sm flex items-center justify-center p-6">
          <div
            className="border w-full max-w-sm rounded-xl shadow-2xl p-5 flex flex-col gap-4"
            style={{ backgroundColor: "var(--sidebar-color)", borderColor: "var(--graph-grid-color)", color: "var(--text-color)" }}
          >
            <h3 className="text-base font-bold">{pending.title}</h3>
            {pending.kind === "confirm" ? (
              <p className="text-sm opacity-80 whitespace-pre-line">{pending.body}</p>
            ) : (
              <div>
                <label className="text-xs opacity-70 block mb-1">{pending.label}</label>
                <input
                  autoFocus
                  type="text"
                  value={promptValue}
                  onChange={(e) => setPromptValue(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") closePrompt(promptValue.trim());
                  }}
                  className="w-full border rounded px-2.5 py-1.5 text-sm focus:outline-none"
                  style={{ backgroundColor: "var(--bg-color)", borderColor: "var(--graph-grid-color)", color: "var(--text-color)" }}
                />
              </div>
            )}
            <div className="flex justify-end gap-2 mt-1">
              {pending.kind === "confirm" && !pending.okOnly && (
                <button
                  onClick={() => closeConfirm(false)}
                  className="px-4 py-2 rounded text-sm font-medium cursor-pointer hover:opacity-90"
                  style={{ backgroundColor: "var(--bg-color)", color: "var(--text-color)" }}
                >
                  {pending.cancelLabel ?? "Cancel"}
                </button>
              )}
              {pending.kind === "prompt" && (
                <button
                  onClick={() => closePrompt(null)}
                  className="px-4 py-2 rounded text-sm font-medium cursor-pointer hover:opacity-90"
                  style={{ backgroundColor: "var(--bg-color)", color: "var(--text-color)" }}
                >
                  Cancel
                </button>
              )}
              <button
                onClick={() => (pending.kind === "confirm" ? closeConfirm(true) : closePrompt(promptValue.trim()))}
                className="px-4 py-2 rounded text-sm font-semibold cursor-pointer hover:brightness-110"
                style={{ backgroundColor: "var(--accent-color)", color: "#fff" }}
              >
                {pending.confirmLabel ?? "OK"}
              </button>
            </div>
          </div>
        </div>
      )}
    </DialogContext.Provider>
  );
}
```

- [ ] **Step 3: Create the barrel export `src/components/ui/index.ts`**

```ts
export { TextField, NumberField, Select } from "./Field";
export { Button } from "./Button";
export { PanelHeader } from "./PanelHeader";
export { Badge } from "./Badge";
export { Tooltip } from "./Tooltip";
export { CollapsibleSection, useSectionState } from "./CollapsibleSection";
export { ToastProvider, useToast } from "./Toast";
export { DialogProvider, useDialog } from "./Dialog";
```

- [ ] **Step 4: Mount the providers in `src/main.tsx`**

Replace the full file:

```tsx
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { ToastProvider, DialogProvider } from "./components/ui";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <ToastProvider>
      <DialogProvider>
        <App />
      </DialogProvider>
    </ToastProvider>
  </React.StrictMode>,
);
```

- [ ] **Step 5: Verify build**

Run: `npm run build` — expected: succeeds.

- [ ] **Step 6: Commit**

```bash
git add src/components/ui/Toast.tsx src/components/ui/Dialog.tsx src/components/ui/index.ts src/main.tsx
git commit -m "feat: add Toast and Dialog (confirm/prompt) primitives, mount providers at app root"
```

---

## Task 8: Wire project-management actions to Toast/ConfirmDialog/PromptDialog

Replaces the app's `alert()`/`confirm()`/`prompt()` usage for project save/open/new/rename/remove — the most user-visible native-dialog jank, since Save/Open currently show a plain OS `alert()` on every use.

**Files:**
- Modify: `src/App.tsx:1440-1623` (handlers: `handleNewProject`, `handleSaveProject`, `handleOpenProject`, `handleRenameProject`, `handleRemoveProject`)
- Modify: `src/App.tsx` near line 473 (add hook calls)
- Modify: `src/App.tsx:4382` (remove-project confirm call site, inside the project tabs toolbar JSX)

**Interfaces:**
- Consumes: `useToast`, `useDialog` from `src/components/ui`.

- [ ] **Step 1: Import and call the hooks**

Near the top of the `App` component body (right after the existing `useState` block that begins around line 473 with `const [currentTheme, setCurrentTheme] = useState<AppTheme>(loadSavedTheme());`), add:

```tsx
  const toast = useToast();
  const { confirmDialog, promptDialog } = useDialog();
```

Add the import at the top of the file alongside the other local imports:

```tsx
import { useToast, useDialog } from "./components/ui";
```

- [ ] **Step 2: Rewrite `handleNewProject` (was line 1440)**

Before:
```tsx
  const handleNewProject = () => {
    if (confirm("Are you sure you want to start a new project? All unsaved changes will be lost.")) {
      openDriverBrowser((driver) => {
        const defaultId = "project-1";
        setProjectsWithHistory([
          createDefaultProject(defaultId, "", PRESET_LINE_COLORS[0], driver)
        ]);
        setActiveProjectId(defaultId);
      });
    }
  };
```

After:
```tsx
  const handleNewProject = async () => {
    const ok = await confirmDialog({
      title: "Start New Project?",
      body: "All unsaved changes will be lost.",
      confirmLabel: "Start New",
    });
    if (ok) {
      openDriverBrowser((driver) => {
        const defaultId = "project-1";
        setProjectsWithHistory([
          createDefaultProject(defaultId, "", PRESET_LINE_COLORS[0], driver)
        ]);
        setActiveProjectId(defaultId);
      });
    }
  };
```

(The button that calls `handleNewProject` doesn't need changes — an `onClick={handleNewProject}` handler works the same whether or not it's async.)

- [ ] **Step 3: Rewrite `handleRenameProject` (was line 1477)**

Before:
```tsx
  const handleRenameProject = (id: string) => {
    const project = projects.find((p) => p.id === id);
    if (!project) return;
    const newName = prompt("Enter a new name for the project:", project.name);
    if (newName && newName.trim() !== "") {
      setProjectsWithHistory((prev) =>
        prev.map((p) => (p.id === id ? { ...p, name: newName.trim() } : p))
      );
    }
  };
```

After:
```tsx
  const handleRenameProject = async (id: string) => {
    const project = projects.find((p) => p.id === id);
    if (!project) return;
    const newName = await promptDialog({
      title: "Rename Project",
      label: "Project name",
      defaultValue: project.name,
    });
    if (newName && newName.trim() !== "") {
      setProjectsWithHistory((prev) =>
        prev.map((p) => (p.id === id ? { ...p, name: newName.trim() } : p))
      );
    }
  };
```

- [ ] **Step 4: Rewrite `handleSaveProject` (was line 1499)**

Change only the two `alert(...)` calls (keep everything else — the Tauri dialog/invoke logic — unchanged):

```tsx
        const name = filePath.split(/[/\\]/).pop() || "Project";
        const cleanName = name.replace(".wproj", "");
        updateActiveProject({ name: cleanName });
        toast.success("Project saved successfully!");
      }
    } catch (err) {
      toast.error("Error saving project: " + err);
    }
  };
```

- [ ] **Step 5: Rewrite `handleOpenProject`'s two `alert()` calls (was lines 1620, 1623)**

```tsx
        toast.success("Project loaded successfully!");
      }
    } catch (err) {
      toast.error("Error loading project: " + err);
    }
  };
```

(Read the surrounding function first — `handleOpenProject` builds a `state` object and applies it via `setProjectsWithHistory`/`updateActiveProject` before this success line; only the two `alert()` calls change, not the loading logic.)

- [ ] **Step 6: Rewrite `handleRemoveProject`'s confirm call site (was line 4382, inside the project tabs toolbar)**

Before:
```tsx
                  {projects.length > 1 && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (confirm(`Remove project "${project.name}"?`)) {
                          handleRemoveProject(project.id);
                        }
                      }}
                      className="hover:text-red-400 p-0.5"
                      title="Remove project"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  )}
```

After:
```tsx
                  {projects.length > 1 && (
                    <button
                      onClick={async (e) => {
                        e.stopPropagation();
                        const ok = await confirmDialog({
                          title: "Remove Project?",
                          body: `Remove project "${project.name}"? This cannot be undone.`,
                          confirmLabel: "Remove",
                        });
                        if (ok) handleRemoveProject(project.id);
                      }}
                      className="hover:text-red-400 p-0.5"
                      title="Remove project"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  )}
```

- [ ] **Step 7: Verify build**

Run: `npm run build` — expected: succeeds.

- [ ] **Step 8: Manual verification**

Run: `npm run tauri dev`. Try: New Project (see themed confirm, Cancel and Confirm both work), rename a project via double-click (themed prompt, Enter key submits), Save Project (themed success toast appears bottom-right and auto-dismisses), remove a project (themed confirm).

- [ ] **Step 9: Commit**

```bash
git add src/App.tsx
git commit -m "feat: replace native alert/confirm/prompt with themed Toast/Dialog for project actions"
```

---

## Task 9: Wire driver-management alert() sites to Toast/ConfirmDialog

**Files:**
- Modify: `src/App.tsx:1156-1437` (`handleAddDriver`, `handleAutoEstimateTS`, `handleVerifyParameters`)
- Modify: `src/App.tsx:1938-1966` (`handleAutoCalculatePort`, `handleApplyAlignment`)

**Interfaces:**
- Consumes: `toast`, `confirmDialog` (already in scope from Task 8, Step 1 — no new hook calls needed).

- [ ] **Step 1: `handleAddDriver` (line ~1159 and ~1262)**

Before:
```tsx
    if (!newManufacturer || !newModel) {
      alert("Manufacturer and Model are required.");
      return;
    }
```
After:
```tsx
    if (!newManufacturer || !newModel) {
      await confirmDialog({ title: "Missing Fields", body: "Manufacturer and Model are required.", okOnly: true });
      return;
    }
```
(`handleAddDriver` is already `async` — `e: React.FormEvent`, defined as `const handleAddDriver = async (e: React.FormEvent) => {`, confirmed at line 1156 — so `await` here is valid.)

Before:
```tsx
    } catch (err) {
      alert("Error saving driver: " + err);
    }
```
After:
```tsx
    } catch (err) {
      toast.error("Error saving driver: " + err);
    }
```

- [ ] **Step 2: `handleAutoEstimateTS` (line ~1355)**

`handleAutoEstimateTS` is currently synchronous (`const handleAutoEstimateTS = () => {`). Make it `async` so it can await the dialog:

Before:
```tsx
  const handleAutoEstimateTS = () => {
```
After:
```tsx
  const handleAutoEstimateTS = async () => {
```

Before:
```tsx
    } else {
      alert("Please ensure Fs, Qes, Qms, Vas, and either Sd or Piston Diameter are populated first.");
    }
  };
```
After:
```tsx
    } else {
      await confirmDialog({
        title: "Missing Fields",
        body: "Please ensure Fs, Qes, Qms, Vas, and either Sd or Piston Diameter are populated first.",
        okOnly: true,
      });
    }
  };
```

Its call site (`onClick={handleAutoEstimateTS}` on the "Estimate T/S" button, around line 5691) needs no change — `onClick` accepts an async handler.

- [ ] **Step 3: `handleVerifyParameters` (lines ~1359-1437)**

Make it `async` (currently `const handleVerifyParameters = () => {`):
```tsx
  const handleVerifyParameters = async () => {
```

Before:
```tsx
    if (!(fs > 0) || !(qes > 0) || !(vas > 0) || !(sd > 0)) {
      alert("Verification requires at least Fs, Qes, Vas, and Sd (or Piston Diameter) to be filled in with positive values.");
      return;
    }
```
After:
```tsx
    if (!(fs > 0) || !(qes > 0) || !(vas > 0) || !(sd > 0)) {
      await confirmDialog({
        title: "Cannot Verify",
        body: "Verification requires at least Fs, Qes, Vas, and Sd (or Piston Diameter) to be filled in with positive values.",
        okOnly: true,
      });
      return;
    }
```

Before (the two-branch report at the end of the function):
```tsx
    if (anomalies.length > 0) {
      alert(
        `Thiele-Small Verification Report:\n\n${anomalies.join("\n\n")}\n\nNote: The backend simulation solver will automatically run with self-consistent derived parameters (best-effort alignment), but resolving these anomalies ensures that all graphs and parameters behave identically to the manufacturer's target.${skippedNote}`
      );
    } else {
      alert(
        `✅ Thiele-Small Verification: SUCCESS!\n\n${checkedFields.join(", ")} are mathematically consistent within tolerances.${skippedNote}`
      );
    }
  };
```
After:
```tsx
    if (anomalies.length > 0) {
      await confirmDialog({
        title: "Thiele-Small Verification Report",
        body: `${anomalies.join("\n\n")}\n\nNote: The backend simulation solver will automatically run with self-consistent derived parameters (best-effort alignment), but resolving these anomalies ensures that all graphs and parameters behave identically to the manufacturer's target.${skippedNote}`,
        okOnly: true,
      });
    } else {
      await confirmDialog({
        title: "Thiele-Small Verification: Success",
        body: `${checkedFields.join(", ")} are mathematically consistent within tolerances.${skippedNote}`,
        okOnly: true,
      });
    }
  };
```

This keeps the multi-line report readable in the dialog body (`ConfirmDialog` already renders `body` with `whitespace-pre-line`, so the existing `\n\n` separators still produce paragraph breaks).

- [ ] **Step 4: `handleAutoCalculatePort` (line ~1957)**

Before:
```tsx
    } catch (err) {
      console.error("Auto-calculate port venting failed:", err);
      alert("Failed to auto-calculate: " + err);
    }
```
After:
```tsx
    } catch (err) {
      console.error("Auto-calculate port venting failed:", err);
      toast.error("Failed to auto-calculate: " + err);
    }
```

- [ ] **Step 5: `handleApplyAlignment` (line ~1964)**

`handleApplyAlignment` is currently synchronous. Make it `async`:
```tsx
  const handleApplyAlignment = async () => {
```
Before:
```tsx
    if (!drv.fs || !drv.qts || !drv.vas) {
      alert("Active driver is missing key TS parameters (Fs, Qts, Vas) required for alignment.");
      return;
    }
```
After:
```tsx
    if (!drv.fs || !drv.qts || !drv.vas) {
      await confirmDialog({
        title: "Cannot Auto-Align",
        body: "Active driver is missing key TS parameters (Fs, Qts, Vas) required for alignment.",
        okOnly: true,
      });
      return;
    }
```

- [ ] **Step 6: Confirm no `alert(`, `confirm(`, or `prompt(` calls remain**

Run:
```bash
grep -n '\balert(\|\bconfirm(\|\bprompt(' src/App.tsx
```
Expected: no output.

- [ ] **Step 7: Verify build**

Run: `npm run build` — expected: succeeds.

- [ ] **Step 8: Manual verification**

Run: `npm run tauri dev`. Trigger each path: try adding a driver with blank Manufacturer/Model (themed OK-only dialog), click "Estimate T/S" with fields blank, click "Verify Parameters" with a driver that has a Vas/Sd mismatch (themed report dialog with the anomaly text readable) and with consistent values (themed success dialog).

- [ ] **Step 9: Commit**

```bash
git add src/App.tsx
git commit -m "feat: replace remaining native alert() sites with themed dialogs/toasts"
```

---

## Task 10: Sidebar chrome — header, project section

**Files:**
- Modify: `src/App.tsx:2160-2264`

**Interfaces:**
- Consumes: `Button`, `Tooltip`, `TextField` from `src/components/ui`.

- [ ] **Step 1: Header icon buttons (Database, Settings) get real tooltips**

Before (lines 2166-2197):
```tsx
        <div className="p-5 border-b flex items-center justify-between" style={{ borderColor: "var(--graph-grid-color)" }}>
          <div className="flex items-center gap-2">
            <Activity className="h-6 w-6" style={{ color: "var(--accent-color)" }} />
            <span className="font-bold tracking-wide">WinISD Modern</span>
          </div>
          <div className="flex gap-1.5">
            <button
              onClick={() => setShowBrowser(true)}
              className="p-1.5 hover:opacity-80 rounded-md border transition cursor-pointer"
              style={{
                backgroundColor: "var(--bg-color)",
                borderColor: "var(--graph-grid-color)",
                color: "var(--accent-color)",
              }}
              title="Driver Database"
            >
              <Database className="h-4.5 w-4.5" />
            </button>
            <button
              onClick={() => setShowSettings(true)}
              className="p-1.5 hover:opacity-80 rounded-md border transition cursor-pointer"
              style={{
                backgroundColor: "var(--bg-color)",
                borderColor: "var(--graph-grid-color)",
                color: "var(--accent-color)",
              }}
              title="Settings"
            >
              <Settings className="h-4.5 w-4.5" />
            </button>
          </div>
        </div>
```

After:
```tsx
        <div className="p-5 border-b flex items-center justify-between" style={{ borderColor: "var(--graph-grid-color)" }}>
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

- [ ] **Step 2: Project Name field uses `TextField`**

Before (lines 2200-2216):
```tsx
        <div className="p-5 border-b flex flex-col gap-3" style={{ borderColor: "var(--graph-grid-color)" }}>
          <div>
            <label className="text-xs font-semibold opacity-70 uppercase tracking-wider block mb-1">
              Project Name
            </label>
            <input
              type="text"
              value={activeProject.name}
              onChange={(e) => updateActiveProject({ name: e.target.value })}
              className="w-full text-sm border rounded px-2.5 py-1.5 focus:outline-none"
              style={{
                backgroundColor: "var(--bg-color)",
                borderColor: "var(--graph-grid-color)",
                color: "var(--text-color)",
              }}
            />
          </div>
```

After:
```tsx
        <div className="p-5 border-b flex flex-col gap-3" style={{ borderColor: "var(--graph-grid-color)" }}>
          <TextField
            label="Project Name"
            value={activeProject.name}
            onChange={(v) => updateActiveProject({ name: v })}
          />
```

(Leave the `<textarea>` Notes field below it as-is — `TextField` doesn't cover multi-line text and adding a `TextArea` primitive isn't warranted for a single call site; just leave its existing markup untouched.)

- [ ] **Step 3: New/Open/Save buttons use `Button`**

Before (lines 2234-2262):
```tsx
          <div className="grid grid-cols-3 gap-2">
            <button
              onClick={handleNewProject}
              className="flex flex-col items-center justify-center gap-1 py-2 text-xs rounded transition opacity-80 hover:opacity-100 cursor-pointer"
              style={{ backgroundColor: "var(--bg-color)", color: "var(--text-color)" }}
            >
              <FilePlus className="h-4 w-4" />
              New
            </button>
            <button
              onClick={handleOpenProject}
              className="flex flex-col items-center justify-center gap-1 py-2 text-xs rounded transition opacity-80 hover:opacity-100 cursor-pointer"
              style={{ backgroundColor: "var(--bg-color)", color: "var(--text-color)" }}
            >
              <FolderOpen className="h-4 w-4" />
              Open
            </button>
            <button
              onClick={handleSaveProject}
              className="flex flex-col items-center justify-center gap-1 py-2 text-xs border rounded transition font-medium hover:opacity-90 cursor-pointer"
              style={{
                backgroundColor: "var(--bg-color)",
                borderColor: "var(--accent-color)",
                color: "var(--accent-color)",
              }}
            >
              <Save className="h-4 w-4" />
              Save
            </button>
          </div>
```

After — keep the 3-column grid and icon-over-label layout (that's a deliberate, working pattern; `Button`'s variants render horizontal `px-4 py-2` layouts that don't fit a compact 3-up icon grid), but pull colors from the same tone system instead of ad hoc styling:
```tsx
          <div className="grid grid-cols-3 gap-2">
            <button
              onClick={handleNewProject}
              className="flex flex-col items-center justify-center gap-1 py-2 text-xs rounded border transition opacity-80 hover:opacity-100 cursor-pointer"
              style={{ backgroundColor: "var(--bg-color)", borderColor: "var(--graph-grid-color)", color: "var(--text-color)" }}
            >
              <FilePlus className="h-4 w-4" />
              New
            </button>
            <button
              onClick={handleOpenProject}
              className="flex flex-col items-center justify-center gap-1 py-2 text-xs rounded border transition opacity-80 hover:opacity-100 cursor-pointer"
              style={{ backgroundColor: "var(--bg-color)", borderColor: "var(--graph-grid-color)", color: "var(--text-color)" }}
            >
              <FolderOpen className="h-4 w-4" />
              Open
            </button>
            <button
              onClick={handleSaveProject}
              className="flex flex-col items-center justify-center gap-1 py-2 text-xs border rounded transition font-medium hover:opacity-90 cursor-pointer"
              style={{ backgroundColor: "var(--bg-color)", borderColor: "var(--accent-color)", color: "var(--accent-color)" }}
            >
              <Save className="h-4 w-4" />
              Save
            </button>
          </div>
```
(This step only adds a visible border to New/Open, matching Save's existing border, for consistency — small, low-risk. If you judge this unnecessary after seeing it rendered, it's fine to skip; the primitives sweep here is intentionally light since this exact 3-button grid already works well.)

- [ ] **Step 2: Verify build and manual check**

Run: `npm run build` — expected: succeeds.
Run app, confirm header tooltips appear on hover, project name field still edits correctly.

- [ ] **Step 3: Commit**

```bash
git add src/App.tsx
git commit -m "refactor: apply Tooltip/Button/TextField primitives to sidebar header and project section"
```

---

## Task 11: Driver tab — apply primitives

**Files:**
- Modify: `src/App.tsx:2292-2446`

**Interfaces:**
- Consumes: `Badge` from `src/components/ui`.

This section (Active Driver card, Number of Drivers, Driver Config, Curve Color) is short and already fairly clean after Task 4's global text-size sweep. Scope here is narrow:

- [ ] **Step 1: Replace the two hand-rolled badge-style spans with `Badge`**

Before (lines 2300-2309, the sensitivity badge):
```tsx
                  <span
                    className="text-2xs font-mono font-bold border px-1.5 py-0.5 rounded"
                    style={{
                      backgroundColor: "var(--bg-color)",
                      borderColor: "var(--graph-grid-color)",
                      color: "var(--accent-color)",
                    }}
                  >
                    {activeProject.driver.sens} dB @ 1W
                  </span>
```
After:
```tsx
                  <Badge tone="accent">{activeProject.driver.sens} dB @ 1W</Badge>
```

- [ ] **Step 2: Route the consistency-warning banner through the danger/warning tokens**

Before (lines 2359-2369):
```tsx
                  {(() => {
                    const check = checkDriverConsistency(activeProject.driver);
                    if (check && check.isInconsistent) {
                      return (
                        <div className="mt-2.5 p-2 rounded bg-amber-950/20 border border-amber-900/60 text-amber-300 text-2xs leading-snug">
                          ⚠ <strong>Inconsistent Specs:</strong> Entered Vas ({activeProject.driver.vas}L) differs from calculated Vas ({check.derivedVas.toFixed(1)}L) based on Sd ({activeProject.driver.sd} cm²) and Cms. This usually indicates a manufacturer copy-paste typo (e.g. mismatching Sd or Vas).
                        </div>
                      );
                    }
                    return null;
                  })()}
```
After (drop the hardcoded `amber-*` Tailwind color classes in favor of the theme's `warningColor`, so this banner is legible in all 4 themes, not just dark ones):
```tsx
                  {(() => {
                    const check = checkDriverConsistency(activeProject.driver);
                    if (check && check.isInconsistent) {
                      return (
                        <div
                          className="mt-2.5 p-2 rounded border text-2xs leading-snug"
                          style={{ backgroundColor: "var(--bg-color)", borderColor: "var(--warning-color)", color: "var(--warning-color)" }}
                        >
                          ⚠ <strong>Inconsistent Specs:</strong> Entered Vas ({activeProject.driver.vas}L) differs from calculated Vas ({check.derivedVas.toFixed(1)}L) based on Sd ({activeProject.driver.sd} cm²) and Cms. This usually indicates a manufacturer copy-paste typo (e.g. mismatching Sd or Vas).
                        </div>
                      );
                    }
                    return null;
                  })()}
```

- [ ] **Step 3: Import `Badge` if not already imported in this file scope (it will be, from Task 8's `./components/ui` import — just add `Badge` to that same import list)**

Update the import added in Task 8, Step 1 to:
```tsx
import { useToast, useDialog, Badge } from "./components/ui";
```
(Later tasks add more names to this same import line as they introduce more primitives — always check what's already imported before adding, rather than creating a second import statement.)

- [ ] **Step 4: Verify build, run app, confirm the sensitivity badge and (if you have a driver with mismatched Vas/Sd) the warning banner render correctly in at least 2 themes (e.g. Slate Dark and Classic WinISD).**

Run: `npm run build`

- [ ] **Step 5: Commit**

```bash
git add src/App.tsx
git commit -m "refactor: apply Badge primitive and theme-aware warning color in Driver tab"
```

---

## Task 12: Enclosure tab pt.1 — Enclosure Settings + Auto-Align → CollapsibleSection

**Files:**
- Modify: `src/App.tsx:2449-3167`

**Interfaces:**
- Consumes: `CollapsibleSection`, `useSectionState` from `src/components/ui`.
- Produces: adds `sidebarSectionState` + `toggleSidebarSection` to the App component's state (used by this task and Tasks 13–17).

- [ ] **Step 1: Add persisted section-open state**

Near the other sidebar-related `useState` calls (around line 706, right after `const [sidebarTab, setSidebarTab] = useState<...>(...)`), add:

```tsx
  const [sidebarSectionState, setSidebarSectionState, toggleSidebarSection] = useSectionState(
    savedSession?.sidebarSectionState ?? {
      "enclosure-settings": true,
      "auto-align": false,
      "custom-topology-rear": true,
      "custom-topology-cross-connect": false,
      "custom-topology-front": true,
      "dimension-calculator": false,
      "spl-settings": true,
      "eq-filters": true,
      "passive-crossover": false,
      "cabin-gain": false,
      "room-simulation": false,
      "precise-xyz-inputs": false,
      "system-stats": true,
    }
  );
```

Add `sidebarSectionState` to the session-save `useEffect` (around line 989, in the `sessionState` object literal alongside `sidebarTab,`):
```tsx
        sidebarTab,
        sidebarSectionState,
```
and to that `useEffect`'s dependency array (around line 1004):
```tsx
  }, [projects, activeProjectId, visibleGraphs, sidebarTab, sidebarSectionState, globalXMin, globalXMax, overrideXLimits, graphConfigs, filters, roomConfig, cabinConfig, rulerFreq, graphHeights]);
```

`setSidebarSectionState` is unused for now (only `toggleSidebarSection` is used by the wrapping steps below) — that's fine, it's exported for potential future use (e.g. an "expand all" control) and TypeScript won't flag an unused destructured variable that's part of a tuple you're intentionally keeping for symmetry; if your linter does flag it, prefix with `_setSidebarSectionState` or drop it from the destructure (`const [sidebarSectionState, , toggleSidebarSection] = ...`).

- [ ] **Step 2: Wrap "Enclosure Settings" in a `CollapsibleSection`**

Before (lines 2451-2454, the section start — note the type selector and all the volume/tuning/topology-specific controls that follow stay inside, down to line 2478 where "Auto-Align Enclosure" begins):
```tsx
            <div className="flex flex-col gap-4">
            <h4 className="text-xs font-semibold opacity-70 uppercase tracking-wider block">
              Enclosure Settings
            </h4>

            <div>
              <label className="text-xs opacity-70 block mb-1">Enclosure Type</label>
```

After:
```tsx
            <div className="flex flex-col gap-4">
            <CollapsibleSection
              title="Enclosure Settings"
              open={sidebarSectionState["enclosure-settings"]}
              onToggle={() => toggleSidebarSection("enclosure-settings")}
            >
            <div>
              <label className="text-xs opacity-70 block mb-1">Enclosure Type</label>
```

Then find where this group of controls ends — everything from the type `<select>` (line 2457) through the ported/bandpass/PR-specific volume and tuning controls, up to (but not including) the `{/* Sealed & Ported & PR single chamber volume */}` block's sibling content that continues past what you've read. Read `src/App.tsx` from line 2449 to line 3167 in full before doing this step (this plan only quoted the first ~140 and last ~130 lines of that range during planning) to find the exact line where the last enclosure-type-specific control block closes and insert:
```tsx
            </CollapsibleSection>
```
immediately before the line that currently reads `{/* Sealed & Ported & PR single chamber volume */}` if that comment is NOT already inside what you just wrapped — check by matching brace/JSX-tag balance. If your editor's JSX auto-formatting or a `tsc`/build error after Step 4 flags an unclosed tag, that's the signal to move the closing `</CollapsibleSection>` to the correct line — use the compiler error's line number to locate it precisely.

- [ ] **Step 3: Wrap "Auto-Align Enclosure" in its own `CollapsibleSection`**

Before (lines 2478-2525):
```tsx
            {activeProject.enclosureType !== "custom" && (
              <div className="border rounded p-3 flex flex-col gap-2.5 text-xs" style={{ backgroundColor: "var(--bg-color)", borderColor: "var(--graph-grid-color)" }}>
                <div className="flex justify-between items-center">
                  <span className="font-semibold opacity-85 uppercase tracking-wider text-2xs">Auto-Align Enclosure</span>
                  {activeProject.driver.fs && activeProject.driver.qes && (
                    <span className="text-2xs px-1.5 py-0.5 rounded font-mono font-bold bg-[var(--accent-color)]/15 border border-[var(--accent-color)]/40 text-[var(--accent-color)]">
                      EBP: {Math.round(activeProject.driver.fs / activeProject.driver.qes)}
                    </span>
                  )}
                </div>

                {activeProject.driver.fs && activeProject.driver.qes && (() => {
                  ...
                })()}

                <div className="flex flex-col gap-1">
                  ...
                </div>

                <button
                  type="button"
                  onClick={handleApplyAlignment}
                  ...
                >
                  Apply Suggested Specs
                </button>
              </div>
            )}
```
(Note: `text-[10px]`/`text-[11px]` in this excerpt already read as `text-2xs` above because Task 4 ran first — you're reading the post-Task-4 state of the file.)

After — the EBP badge moves into `CollapsibleSection`'s `action` slot (it's meaningful even when collapsed, so it stays visible in the header), everything else becomes the collapsible body:
```tsx
            {activeProject.enclosureType !== "custom" && (
              <CollapsibleSection
                title="Auto-Align Enclosure"
                open={sidebarSectionState["auto-align"]}
                onToggle={() => toggleSidebarSection("auto-align")}
                action={
                  activeProject.driver.fs && activeProject.driver.qes ? (
                    <Badge tone="accent">EBP: {Math.round(activeProject.driver.fs / activeProject.driver.qes)}</Badge>
                  ) : undefined
                }
              >
                {activeProject.driver.fs && activeProject.driver.qes && (() => {
                  const ebp = activeProject.driver.fs / activeProject.driver.qes;
                  let guidance = "";
                  if (ebp > 80) guidance = "Ported enclosure preferred (strong motor).";
                  else if (ebp < 50) guidance = "Sealed enclosure preferred (acoustic suspension).";
                  else guidance = "Highly versatile — works well in Sealed or Ported.";
                  return (
                    <p className="text-2xs opacity-60 leading-snug">
                      ℹ {guidance}
                    </p>
                  );
                })()}

                <div className="flex flex-col gap-1">
                  <span className="opacity-55 text-2xs">Alignment Target</span>
                  <select
                    value={alignmentPref}
                    onChange={(e) => setAlignmentPref(e.target.value as any)}
                    className="w-full border rounded px-2.5 py-1 text-xs focus:outline-none"
                    style={{ backgroundColor: "var(--sidebar-color)", borderColor: "var(--graph-grid-color)", color: "var(--text-color)" }}
                  >
                    <option value="maximally_flat">Maximally Flat (Butterworth)</option>
                    <option value="extended_bass">Extended Bass Shelf</option>
                    <option value="boomy">High-Output / Boomy (Bass Boost)</option>
                  </select>
                </div>

                <button
                  type="button"
                  onClick={handleApplyAlignment}
                  className="w-full py-1.5 rounded text-xs font-semibold tracking-wide transition text-white hover:shadow-md cursor-pointer mt-1 hover:brightness-110"
                  style={{ backgroundColor: "var(--accent-color)" }}
                >
                  Apply Suggested Specs
                </button>
              </CollapsibleSection>
            )}
```

- [ ] **Step 4: Update the `./components/ui` import to include `CollapsibleSection`, `useSectionState`**

```tsx
import { useToast, useDialog, Badge, CollapsibleSection, useSectionState } from "./components/ui";
```

- [ ] **Step 5: Verify build**

Run: `npm run build` — expected: succeeds. This is the step most likely to surface a mismatched JSX closing tag from Step 2 — fix per that step's guidance if so.

- [ ] **Step 6: Manual verification**

Run app, go to Enclosure tab. Confirm: "Enclosure Settings" section is open by default and its contents (type selector, volume/tuning controls) work as before; "Auto-Align Enclosure" starts collapsed, shows the EBP badge in its header even collapsed, expands on click, and "Apply Suggested Specs" still works. Toggle both, reload the app (or just re-render — session autosave runs on state change), confirm the open/closed state persisted.

- [ ] **Step 7: Commit**

```bash
git add src/App.tsx
git commit -m "refactor: wrap Enclosure Settings and Auto-Align in persisted CollapsibleSections"
```

---

## Task 13: Enclosure tab pt.2 — Custom Topology Builder → CollapsibleSection

**Files:**
- Modify: `src/App.tsx:3168-3428` (the "Custom Topology Builder" block: REAR SIDE, INTERNAL PORT / Cross-Connect, FRONT SIDE sub-sections)

**Interfaces:**
- Consumes: `CollapsibleSection` (already imported by Task 12).

- [ ] **Step 1: Read the full block first**

Read `src/App.tsx` lines 3168–3428 in full (this plan quoted only the REAR SIDE and part of INTERNAL PORT sub-blocks during planning — FRONT SIDE, at comment `{/* ── FRONT SIDE ── */}` around line 3310, mirrors REAR SIDE's structure per the earlier grep but wasn't read verbatim). Confirm the outer wrapper (`{/* ── Custom Topology Builder ── */}` at line 3168) and where it's conditionally rendered (likely `{activeProject.enclosureType === "custom" && (...)}` — confirm the exact condition by reading the code directly above line 3168).

- [ ] **Step 2: Convert the three existing bordered sub-blocks (Rear Side, Cross-Connect, Front Side) to `CollapsibleSection`**

Each currently looks like (using Rear Side as the confirmed example from planning, lines 3176-3263):
```tsx
                <div className="border rounded-lg overflow-hidden" style={{ borderColor: "var(--graph-grid-color)" }}>
                  <div className="px-2.5 py-1.5 text-2xs font-bold uppercase tracking-wider opacity-60"
                    style={{ backgroundColor: "var(--bg-color)" }}>
                    Rear Side (behind cone)
                  </div>
                  <div className="p-2.5 flex flex-col gap-2" style={{ backgroundColor: "var(--sidebar-color)" }}>
                    {/* ...chamber volume, port, PR controls... */}
                  </div>
                </div>
```

Replace the outer `<div className="border rounded-lg overflow-hidden" ...>` / static header `<div>` / content `<div>` structure with `CollapsibleSection`, keeping everything inside the innermost content `<div>` as `CollapsibleSection`'s children (drop that innermost wrapper `<div>`'s own styling since `CollapsibleSection` already provides the `p-3 flex flex-col gap-3` body wrapper — if the existing content relies on `gap-2` specifically instead of `gap-3`, keep a nested `<div className="flex flex-col gap-2">` around just the children to preserve the tighter spacing, since that's an intentional density choice for this dense sub-panel):

```tsx
                <CollapsibleSection
                  title="Rear Side (behind cone)"
                  open={sidebarSectionState["custom-topology-rear"]}
                  onToggle={() => toggleSidebarSection("custom-topology-rear")}
                >
                  <div className="flex flex-col gap-2">
                    {/* ...chamber volume, port, PR controls, unchanged... */}
                  </div>
                </CollapsibleSection>
```

Apply the same transformation to:
- The "Cross-Connect (Rear ↔ Front)" block (comment `{/* ── INTERNAL PORT ── */}`, line ~3265) → key `"custom-topology-cross-connect"`.
- The "Front Side" block (comment `{/* ── FRONT SIDE ── */}`, line ~3310) → key `"custom-topology-front"`. Confirm its header text from the actual code (planning saw only the opening comment, not its rendered title string — it should mirror Rear Side's title convention, e.g. "Front Side (facing outward)" or similar; use whatever string is already there, just move it into `title=`).

- [ ] **Step 3: Verify build**

Run: `npm run build`.

- [ ] **Step 4: Manual verification**

Run app, set Enclosure Type to "Custom Topology Builder". Confirm Rear Side and Front Side start expanded, Cross-Connect starts collapsed, and all the port/PR add/remove buttons inside each still work identically to before.

- [ ] **Step 5: Commit**

```bash
git add src/App.tsx
git commit -m "refactor: wrap Custom Topology Builder sub-panels in persisted CollapsibleSections"
```

---

## Task 14: Enclosure tab pt.3 — Dimension Calculator → CollapsibleSection

**Files:**
- Modify: `src/App.tsx:3429-3577`
- Modify: `src/App.tsx` — remove the now-redundant `showCalc` state (search for `showCalc` and `setShowCalc` — it's a local `useState<boolean>` that this task's `sidebarSectionState["dimension-calculator"]` replaces).

**Interfaces:**
- Consumes: `CollapsibleSection`.

- [ ] **Step 1: Find and remove the `showCalc` state declaration**

Run: `grep -n 'showCalc' src/App.tsx` to find its `useState` declaration (near the other calculator-related state, close to `calcMode`/`calcVb`/etc.) and remove that one line (leave `calcMode`, `calcVb`, `calcRatioL`, etc. untouched — only `showCalc`/`setShowCalc` is replaced).

- [ ] **Step 2: Replace the manual toggle button with `CollapsibleSection`**

Before (lines 3430-3441, plus the closing structure at 3568-3571):
```tsx
            <div className="border rounded-lg overflow-hidden" style={{ borderColor: "var(--graph-grid-color)" }}>
              <button
                onClick={() => setShowCalc(v => !v)}
                className="w-full flex items-center justify-between px-3 py-2 text-xs font-semibold cursor-pointer hover:bg-black/10 transition"
                style={{ backgroundColor: "var(--sidebar-color)", color: "var(--text-color)" }}
              >
                <span className="flex items-center gap-1.5">
                  <Ruler className="h-3.5 w-3.5 opacity-70" />
                  Dimension Calculator
                </span>
                <ChevronDown className={`h-3.5 w-3.5 opacity-60 transition-transform ${showCalc ? "rotate-180" : ""}`} />
              </button>
              {showCalc && (() => {
                // ... vb-to-dims / dims-to-vb calculation logic and JSX ...
                return (
                  <div className="p-3 flex flex-col gap-3" style={{ backgroundColor: "var(--bg-color)" }}>
                    {/* mode tabs, inputs, results ... */}
                  </div>
                );
              })()}
            </div>
```

After — `CollapsibleSection` replaces the outer border/header/toggle chrome; the calculation IIFE and its returned JSX become the children directly (drop the IIFE's own `return (<div className="p-3 ...">...</div>)` wrapper since `CollapsibleSection` already supplies that body padding — keep everything between that div's opening and closing tag):
```tsx
            <CollapsibleSection
              title="Dimension Calculator"
              open={sidebarSectionState["dimension-calculator"]}
              onToggle={() => toggleSidebarSection("dimension-calculator")}
            >
              {(() => {
                // ... same vb-to-dims / dims-to-vb calculation logic, unchanged ...
                return (
                  <>
                    {/* same mode tabs, inputs, results JSX that was inside the old wrapper div, unchanged */}
                  </>
                );
              })()}
            </CollapsibleSection>
```

Note the `Ruler`/`ChevronDown` icon-plus-label header is dropped in favor of `CollapsibleSection`'s standard chevron — if you want to keep the `Ruler` icon specifically (it's a nice visual cue distinguishing this from other sections), pass it via a small change to how `title` is rendered: since `CollapsibleSection`'s `title` prop is typed `string`, either (a) accept the icon is dropped for consistency with every other section (recommended — keeps all section headers visually uniform), or (b) skip this one section's conversion and leave its existing custom button as-is. Given the whole point of Section 4 is a *consistent* collapsible pattern, prefer (a).

- [ ] **Step 3: Verify build**

Run: `npm run build`.

- [ ] **Step 4: Manual verification**

Run app, Enclosure tab, confirm Dimension Calculator starts collapsed, expands on click, both Vb→Dims and Dims→Vb modes still compute correctly, and "Apply ... to active project" buttons still work.

- [ ] **Step 5: Commit**

```bash
git add src/App.tsx
git commit -m "refactor: migrate Dimension Calculator to persisted CollapsibleSection"
```

---

## Task 15: Signal tab pt.1 — SPL Settings, EQ Filters, Passive Crossover → CollapsibleSection

**Files:**
- Modify: `src/App.tsx:3578-3832`

**Interfaces:**
- Consumes: `CollapsibleSection`.

- [ ] **Step 1: Read the Passive Crossover block in full**

This plan verbatim-read SPL Settings (3578-3644) and EQ Filters' opening (3646-3717+) during planning, but not the full EQ Filters gain/enabled-row rest, nor Passive Crossover (comment `{/* ── Passive Crossover ───── */}` at line 3735) at all. Read `src/App.tsx` lines 3717–3832 before starting this task.

- [ ] **Step 2: Wrap "SPL & Output Simulation" (the tab's un-headered intro block) in a `CollapsibleSection`**

Before (lines 3579-3645 — Total Input Power, Distance, SPL Environment controls, currently just a bare `<h4>` label with no collapse):
```tsx
            <div className="flex flex-col gap-4">
              <h4 className="text-xs font-semibold opacity-70 uppercase tracking-wider block">
                SPL & Output Simulation
              </h4>

              <div>
                <div className="flex justify-between items-center text-xs mb-1">
                  <span className="opacity-70">Total Input Power</span>
                  ...
```
After:
```tsx
            <div className="flex flex-col gap-4">
              <CollapsibleSection
                title="SPL & Output Simulation"
                open={sidebarSectionState["spl-settings"]}
                onToggle={() => toggleSidebarSection("spl-settings")}
              >
              <div>
                <div className="flex justify-between items-center text-xs mb-1">
                  <span className="opacity-70">Total Input Power</span>
                  ...
```
Close it with `</CollapsibleSection>` immediately before the `{/* ── EQ Filters ─── */}` comment (line 3646) — this block's end is precisely where EQ Filters begins, confirmed from planning reads, so this boundary is exact (no ambiguity like Task 12's Step 2 had).

- [ ] **Step 3: Wrap "EQ Filters" in a `CollapsibleSection`**

Before (lines 3647-3658, header + Add button; the filters list and empty-state message that follow, through line ~3832 where Passive Crossover's comment begins, stay inside):
```tsx
              <div className="border-t pt-4" style={{ borderColor: "var(--graph-grid-color)" }}>
                <div className="flex justify-between items-center mb-3">
                  <span className="text-xs font-semibold opacity-70 uppercase tracking-wider">EQ Filters</span>
                  <button
                    type="button"
                    onClick={() => setFilters(prev => [...prev, { id: `f-${Date.now()}`, enabled: true, type: "hp", freq: 80, q: 0.707, gain: 0 }])}
                    className="text-2xs px-2 py-0.5 rounded border transition hover:opacity-90 cursor-pointer"
                    style={{ borderColor: "var(--accent-color)", color: "var(--accent-color)", backgroundColor: "var(--bg-color)" }}
                  >
                    + Add
                  </button>
                </div>

                {filters.length === 0 && (
                  <p className="text-2xs opacity-45 text-center py-1.5">No filters — add HP/LP or peak EQ to shape the response.</p>
                )}

                <div className="flex flex-col gap-2">
                  {filters.map((flt, idx) => ( /* ...unchanged... */ ))}
                </div>
              </div>
```
After — the "+ Add" button moves into `CollapsibleSection`'s `action` slot (useful even collapsed):
```tsx
              <CollapsibleSection
                title="EQ Filters"
                open={sidebarSectionState["eq-filters"]}
                onToggle={() => toggleSidebarSection("eq-filters")}
                action={
                  <button
                    type="button"
                    onClick={() => setFilters(prev => [...prev, { id: `f-${Date.now()}`, enabled: true, type: "hp", freq: 80, q: 0.707, gain: 0 }])}
                    className="text-2xs px-2 py-0.5 rounded border transition hover:opacity-90 cursor-pointer"
                    style={{ borderColor: "var(--accent-color)", color: "var(--accent-color)", backgroundColor: "var(--bg-color)" }}
                  >
                    + Add
                  </button>
                }
              >
                {filters.length === 0 && (
                  <p className="text-2xs opacity-45 text-center py-1.5">No filters — add HP/LP or peak EQ to shape the response.</p>
                )}

                <div className="flex flex-col gap-2">
                  {filters.map((flt, idx) => ( /* ...unchanged... */ ))}
                </div>
              </CollapsibleSection>
```
(Drop the old `<div className="border-t pt-4">` wrapper — `CollapsibleSection` supplies its own border via the outer bordered box, so the manual `border-t` divider is redundant once this is a distinct boxed section.)

- [ ] **Step 4: Wrap "Passive Crossover" the same way**

Follow the same pattern as Step 3 (header label → `title`, any add/enable control → `action` if present, body content → children). Use key `"passive-crossover"`. Since this plan didn't verbatim-read this block, apply the mechanical rule directly from the actual code you read in Step 1 — the pattern is identical to every other section in this file (a `border-t pt-4` wrapper div, a header row with a label span and maybe a toggle/add button, then content).

- [ ] **Step 5: Verify build**

Run: `npm run build`.

- [ ] **Step 6: Manual verification**

Run app, Signal tab. Confirm SPL Settings and EQ Filters start open, Passive Crossover starts collapsed; adding/removing/editing EQ filters still works; the "+ Add" button is visible and functional even with the section expanded or collapsed.

- [ ] **Step 7: Commit**

```bash
git add src/App.tsx
git commit -m "refactor: wrap SPL Settings, EQ Filters, Passive Crossover in persisted CollapsibleSections"
```

---

## Task 16: Signal tab pt.2 — Cabin Gain, Room Simulation (incl. floor-plan editor) → CollapsibleSection

**Files:**
- Modify: `src/App.tsx:3833-4099` (approximate end — confirm against the "Precise X/Y/Z inputs" comment at line 4049 and where that sub-block ends, before the stats block that Task 17 handles)

**Interfaces:**
- Consumes: `CollapsibleSection`.

- [ ] **Step 1: Read the full Room Simulation block, including the floor-plan drag editor and precise X/Y/Z inputs sub-section**

This plan verbatim-read Cabin Gain (3833-3888) and the start of Room Simulation through the floor-plan editor's opening (3890-3932) during planning, but not the drag-editor's SVG/pointer-event internals nor the "Precise X / Y / Z inputs" sub-block (comment at line 4049). Read `src/App.tsx` lines 3932–4140 in full before starting.

- [ ] **Step 2: Wrap "Cabin Gain" in a `CollapsibleSection`**

Before (lines 3834-3888 — the ON/OFF toggle button stays meaningful in the header even collapsed, so it moves to `action`):
```tsx
              <div className="border-t pt-4" style={{ borderColor: "var(--graph-grid-color)" }}>
                <div className="flex justify-between items-center mb-3">
                  <span className="text-xs font-semibold opacity-70 uppercase tracking-wider">Cabin Gain</span>
                  <button
                    type="button"
                    onClick={() => setCabinConfig(prev => ({ ...prev, enabled: !prev.enabled }))}
                    className={`text-2xs font-bold px-2.5 py-0.5 rounded border transition cursor-pointer ${cabinConfig.enabled ? "border-[var(--accent-color)] text-[var(--accent-color)]" : "opacity-55 border-current"}`}
                    style={{ backgroundColor: "var(--bg-color)" }}
                  >
                    {cabinConfig.enabled ? "ON" : "OFF"}
                  </button>
                </div>

                {!cabinConfig.enabled && (
                  <p className="text-2xs opacity-45 text-center py-1.5">Enable to estimate vehicle pressure-zone cabin gain (12 dB/octave bass boost below F_cabin).</p>
                )}

                {cabinConfig.enabled && (
                  <div className="flex flex-col gap-2 text-2xs">
                    {/* ...Cabin Corner Freq slider + input, typical turn-over note... */}
                  </div>
                )}
              </div>
```
After:
```tsx
              <CollapsibleSection
                title="Cabin Gain"
                open={sidebarSectionState["cabin-gain"]}
                onToggle={() => toggleSidebarSection("cabin-gain")}
                action={
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); setCabinConfig(prev => ({ ...prev, enabled: !prev.enabled })); }}
                    className={`text-2xs font-bold px-2.5 py-0.5 rounded border transition cursor-pointer ${cabinConfig.enabled ? "border-[var(--accent-color)] text-[var(--accent-color)]" : "opacity-55 border-current"}`}
                    style={{ backgroundColor: "var(--bg-color)" }}
                  >
                    {cabinConfig.enabled ? "ON" : "OFF"}
                  </button>
                }
              >
                {!cabinConfig.enabled && (
                  <p className="text-2xs opacity-45 text-center py-1.5">Enable to estimate vehicle pressure-zone cabin gain (12 dB/octave bass boost below F_cabin).</p>
                )}

                {cabinConfig.enabled && (
                  <div className="flex flex-col gap-2 text-2xs">
                    {/* ...Cabin Corner Freq slider + input, typical turn-over note, unchanged... */}
                  </div>
                )}
              </CollapsibleSection>
```
(`CollapsibleSection`'s `action` wrapper already calls `e.stopPropagation()` per Task 6's implementation, but the ON/OFF button itself toggles `cabinConfig`, not the section — keeping an explicit `e.stopPropagation()` on the button too is redundant-but-harmless defense; leave it in as shown, matching the pattern used for the EBP badge in Task 12 not needing it since that badge has no onClick. If you find the double stopPropagation unnecessary after testing, it's safe either way — this button's own click doesn't bubble to anything else regardless.)

- [ ] **Step 3: Wrap "Room Simulation" (including the floor-plan editor and Precise X/Y/Z inputs) the same way**

Same ON/OFF-toggle-in-action pattern as Step 2, key `"room-simulation"`. Everything from "Room Dimensions" through the floor-plan drag editor down to (but not including) whatever comes after the room-simulation block closes — check against your Step 1 read for the exact end boundary — becomes the `CollapsibleSection`'s children.

- [ ] **Step 4: Wrap "Precise X / Y / Z inputs" (comment at line 4049) as a nested `CollapsibleSection` inside Room Simulation**

This is a sub-section of Room Simulation, not a sibling in the top-level `sidebarSectionState` list at the same tier as the others — but it's still listed with its own key (`"precise-xyz-inputs"`) in Task 12 Step 1's initial state object, so use it: wrap just this inner block in its own nested `CollapsibleSection` (nesting is fine — `CollapsibleSection` has no assumption about depth) so users can dig into exact coordinate entry without it always taking space under Room Simulation.

- [ ] **Step 5: Verify build**

Run: `npm run build`.

- [ ] **Step 6: Manual verification**

Run app, Signal tab, enable Room Simulation, confirm the floor-plan drag editor (drag speakers and listener) still works, confirm Precise X/Y/Z nested section expands/collapses independently and still edits the same underlying `roomConfig` state as the drag editor (dragging should update the precise inputs and vice versa).

- [ ] **Step 7: Commit**

```bash
git add src/App.tsx
git commit -m "refactor: wrap Cabin Gain and Room Simulation (incl. floor-plan editor) in persisted CollapsibleSections"
```

---

## Task 17: Signal tab pt.3 — System stats block → CollapsibleSection + fix hardcoded warn/danger colors

**Files:**
- Modify: `src/App.tsx:4100-4217` (approximate — the stats grid block ending the Signal tab, immediately before `{/* Main stacked graph list dashboard */}`)

**Interfaces:**
- Consumes: `CollapsibleSection`.

- [ ] **Step 1: Replace the hardcoded hex colors with theme tokens**

There are two identical occurrences (rows 4164-4170 and 4198-4204, from the `rows.map`/`full.map` render paths):

Before:
```tsx
                              style={{
                                color: stat.danger
                                  ? "#f87171"
                                  : stat.accent
                                  ? "var(--accent-color)"
                                  : stat.warn
                                  ? "#f59e0b"
                                  : "var(--text-color)",
                              }}
```
After:
```tsx
                              style={{
                                color: stat.danger
                                  ? "var(--danger-color)"
                                  : stat.accent
                                  ? "var(--accent-color)"
                                  : stat.warn
                                  ? "var(--warning-color)"
                                  : "var(--text-color)",
                              }}
```
Apply this to both occurrences.

- [ ] **Step 2: Read the full stats block to find its outer wrapper**

This plan verbatim-read only the tail (4140-4217) of this block during planning — the part shown above with `rows.map`/`full.map` is itself inside a larger IIFE and container `<div>` that starts earlier (its opening isn't in what was read). Read `src/App.tsx` from wherever the Signal tab's Room Simulation block ends (per Task 16) through line 4217 to find this stats block's title/header and outer wrapper.

- [ ] **Step 3: Wrap the whole stats block in a `CollapsibleSection`**

Apply the same pattern as prior tasks: whatever header/label currently introduces this stats grid becomes `title`, key `"system-stats"`, defaulting open (it's a quick-reference summary, not an editing surface, valuable to see at a glance).

- [ ] **Step 4: Verify build**

Run: `npm run build`.

- [ ] **Step 5: Manual verification**

Run app, Signal tab, scroll to the stats grid at the bottom. Confirm any stat flagged as a warning or danger (try an enclosure configuration that trips one — e.g. an undersized port causing high air velocity, if that's one of the flagged stats) now renders in the theme's warning/danger color rather than the old hardcoded amber/red, and check this in at least Slate Dark and Solarized Light to confirm both are legible.

- [ ] **Step 6: Commit**

```bash
git add src/App.tsx
git commit -m "fix: use theme warning/danger tokens in stats block, wrap in persisted CollapsibleSection"
```

---

## Task 18: Main dashboard header/toolbar — apply Button/Tooltip primitives

**Files:**
- Modify: `src/App.tsx:4219-4475`

**Interfaces:**
- Consumes: `Button`, `Tooltip`.

- [ ] **Step 1: Add tooltips to the icon-only toolbar buttons (Undo, Redo, Ruler, Export)**

These already have a `title=` attribute (native tooltip). Read lines 4219-4475 (this plan verbatim-read most of it already — Undo/Redo/Ruler/Export buttons were shown around lines 4358-4460). For each of the 4 icon buttons (`Undo2`, `Redo2`, `Ruler`, `Download`+`ChevronDown`), wrap in `Tooltip` using the same text currently in `title=`, and remove the now-redundant `title=` attribute (keep `title=` only where it's already the sole indicator and wrapping would be awkward — these 4 are straightforward wraps).

Example (Undo button, confirmed from planning read):
Before:
```tsx
             <button
              onClick={undo}
              disabled={!canUndo}
              title="Undo (Ctrl+Z)"
              className="p-1.5 rounded text-xs transition cursor-pointer disabled:opacity-25 hover:enabled:bg-black/20"
              style={{ color: "var(--text-color)" }}
            >
              <Undo2 className="h-3.5 w-3.5" />
            </button>
```
After:
```tsx
            <Tooltip label="Undo (Ctrl+Z)">
              <button
                onClick={undo}
                disabled={!canUndo}
                className="p-1.5 rounded text-xs transition cursor-pointer disabled:opacity-25 hover:enabled:bg-black/20"
                style={{ color: "var(--text-color)" }}
              >
                <Undo2 className="h-3.5 w-3.5" />
              </button>
            </Tooltip>
```
Apply the same transform to Redo (`title="Redo (Ctrl+Y)"`), Ruler (`title="Toggle Draggable Measurement Ruler Line"`), and Export (`title="Export graph or design summary"`).

- [ ] **Step 2: Leave the "Configure Graphs" dropdown button and project-tab pills as-is**

These aren't icon-only (they have visible text labels), so a hover tooltip adds little — skip them, don't force every button through `Tooltip`/`Button` mechanically. This keeps the diff proportional to actual UX value.

- [ ] **Step 3: Verify build and manual check**

Run: `npm run build`. Run app, hover each of the 4 toolbar icon buttons, confirm the themed tooltip appears (not the browser's native delayed tooltip).

- [ ] **Step 4: Commit**

```bash
git add src/App.tsx
git commit -m "refactor: add themed Tooltip to dashboard toolbar icon buttons"
```

---

## Task 19: Graph panel render block — confirm type-scale coverage, add radiation-warning tooltip

**Files:**
- Modify: `src/App.tsx:4476-5219`

**Interfaces:**
- Consumes: `Tooltip` (optional, see Step 2).

This region is the least changed by this plan — its styling already reads CSS vars consistently (confirmed from the chart-header excerpt read during planning), and Task 4's global sweep already fixed any sub-11px axis/tick label text within it.

- [ ] **Step 1: Confirm no lingering hardcoded colors**

Run:
```bash
grep -n '#[0-9a-fA-F]\{6\}\|#[0-9a-fA-F]\{3\}\b' src/App.tsx | awk -F: '$1 >= 4476 && $1 <= 5219'
```
Review any hits. From planning, one is already known: line ~3929's `style={{ color: "#60a5fa" }}` for the Listener ("L") label in the floor-plan legend text (outside this range, already out of scope — leave it, it's a fixed accent-independent color choice for a specific marker, not a theme-integration bug, since it's distinguishing a UI element by a fixed hue on purpose). For any hit found in the 4476-5219 range, replace with the appropriate `var(--...)` token following the same judgment used throughout Tasks 11-17 (if it's meant to track the theme, replace it; if it's a fixed semantic color like a specific curve/line marker meant to stay recognizable across themes, leave it and note why in the commit).

- [ ] **Step 2: Optional — wrap the ka radiation-model warning in `Tooltip` for the full explanation**

The warning text at line ~4654 (`⚠ Radiation model less accurate above ~{kaWarningFreq} Hz for this driver (ka = 0.5)`) is already fully visible inline (not truncated), so a tooltip isn't filling a real gap here — skip this unless, after Step 1's review, you find a genuinely truncated/icon-only warning indicator elsewhere in this block that would benefit. Don't force a change for its own sake.

- [ ] **Step 3: Verify build**

Run: `npm run build`.

- [ ] **Step 4: Manual verification**

Run app, view each of the 7 graph types (toggle via "Configure Graphs") in at least 2 themes, confirm axis labels, legends, and the ka-warning text are legible and nothing looks clipped or misaligned after Task 4's font-size changes.

- [ ] **Step 5: Commit (only if Step 1 found something to fix)**

```bash
git add src/App.tsx
git commit -m "fix: replace any remaining hardcoded colors in graph panel with theme tokens"
```
If Step 1 found nothing, skip the commit — no changes to make in this task.

---

## Task 20: Settings modal — primitives, new color pickers, fix hardcoded selects

**Files:**
- Modify: `src/App.tsx:5220-5502`

**Interfaces:**
- Consumes: `Button`, `Select`.

This modal has two concrete bugs found during planning: the theme-preset `<select>` (line 5249) and the "Select Curve to Calibrate" `<select>` (line 5365) both use hardcoded `bg-slate-950 border-slate-800 text-slate-200` Tailwind classes instead of the theme CSS vars — meaning in any non-dark theme (Classic, Solarized), these two dropdowns render with dark-slate colors that clash with the rest of the modal.

- [ ] **Step 1: Fix the theme-preset select (line ~5241-5257)**

Before:
```tsx
                <div className="flex flex-col gap-2">
                  <label className="text-xs opacity-70">Theme Presets</label>
                  <select
                    value={activePresetKey}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val && val !== "custom") {
                        setCurrentTheme(PRESETS[val]);
                      }
                    }}
                    className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-xs text-slate-200 focus:outline-none"
                  >
                    {Object.keys(PRESETS).map((key) => (
                      <option key={key} value={key}>
                        {PRESETS[key].name}
                      </option>
                    ))}
                    {activePresetKey === "custom" && <option value="custom">Custom Theme</option>}
                  </select>
                </div>
```
After (using the `Select` primitive):
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

- [ ] **Step 2: Add 3 new color pickers for `textMutedColor`, `warningColor`, `dangerColor`**

Before (lines 5312-5322, the last existing swatch — "Graph Grid" — and the closing of the customizer grid):
```tsx
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={currentTheme.graphGridColor}
                      onChange={(e) => handleCustomColorChange("graphGridColor", e.target.value)}
                      className="w-7 h-7 rounded border bg-transparent cursor-pointer"
                      style={{ borderColor: "var(--graph-grid-color)" }}
                    />
                    <span>Graph Grid</span>
                  </div>
                </div>
              </div>
```
After — insert 3 more swatches following the exact same pattern before the closing `</div></div>`:
```tsx
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={currentTheme.graphGridColor}
                      onChange={(e) => handleCustomColorChange("graphGridColor", e.target.value)}
                      className="w-7 h-7 rounded border bg-transparent cursor-pointer"
                      style={{ borderColor: "var(--graph-grid-color)" }}
                    />
                    <span>Graph Grid</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={currentTheme.textMutedColor}
                      onChange={(e) => handleCustomColorChange("textMutedColor", e.target.value)}
                      className="w-7 h-7 rounded border bg-transparent cursor-pointer"
                      style={{ borderColor: "var(--graph-grid-color)" }}
                    />
                    <span>Muted Text</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={currentTheme.warningColor}
                      onChange={(e) => handleCustomColorChange("warningColor", e.target.value)}
                      className="w-7 h-7 rounded border bg-transparent cursor-pointer"
                      style={{ borderColor: "var(--graph-grid-color)" }}
                    />
                    <span>Warning</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={currentTheme.dangerColor}
                      onChange={(e) => handleCustomColorChange("dangerColor", e.target.value)}
                      className="w-7 h-7 rounded border bg-transparent cursor-pointer"
                      style={{ borderColor: "var(--graph-grid-color)" }}
                    />
                    <span>Danger</span>
                  </div>
                </div>
              </div>
```

- [ ] **Step 3: Fix the "Select Curve to Calibrate" select (line ~5362-5374)**

Before:
```tsx
                <div className="flex flex-col gap-2">
                  <label className="text-xs opacity-70">Select Curve to Calibrate</label>
                  <select
                    value={configEditType}
                    onChange={(e) => setConfigEditType(e.target.value as CurveType)}
                    className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-xs focus:outline-none"
                  >
                    <option value="transfer">Gain (dB)</option>
                    <option value="spl">SPL (dB SPL)</option>
                    <option value="phase">Phase Response (°)</option>
                    <option value="group_delay">Group Delay (ms)</option>
                    <option value="excursion">Cone Excursion (mm)</option>
                    {activeProject.enclosureType !== "sealed" && <option value="velocity">Port Air Velocity (m/s)</option>}
                    <option value="impedance">System Impedance (Ω)</option>
                  </select>
                </div>
```
After:
```tsx
                <Select
                  label="Select Curve to Calibrate"
                  value={configEditType}
                  onChange={(val) => setConfigEditType(val as CurveType)}
                  options={[
                    { value: "transfer", label: "Gain (dB)" },
                    { value: "spl", label: "SPL (dB SPL)" },
                    { value: "phase", label: "Phase Response (°)" },
                    { value: "group_delay", label: "Group Delay (ms)" },
                    { value: "excursion", label: "Cone Excursion (mm)" },
                    ...(activeProject.enclosureType !== "sealed" ? [{ value: "velocity", label: "Port Air Velocity (m/s)" }] : []),
                    { value: "impedance", label: "System Impedance (Ω)" },
                  ]}
                />
```

- [ ] **Step 4: Apply `Button` to the "Close Settings" button (line ~5489-5496)**

Before:
```tsx
              <button
                onClick={() => setShowSettings(false)}
                className="px-5 py-2 rounded text-sm font-semibold transition cursor-pointer hover:brightness-110 active:brightness-95"
                style={{ backgroundColor: "var(--accent-color)", color: "#fff" }}
              >
                Close Settings
              </button>
```
After:
```tsx
              <Button variant="primary" onClick={() => setShowSettings(false)}>
                Close Settings
              </Button>
```

- [ ] **Step 5: Update the `./components/ui` import**

```tsx
import { useToast, useDialog, Badge, CollapsibleSection, useSectionState, Button, Select } from "./components/ui";
```

- [ ] **Step 6: Verify build**

Run: `npm run build`.

- [ ] **Step 7: Manual verification**

Run app, open Settings in each of the 4 themes. Confirm: the theme-preset and curve-calibration dropdowns now match the active theme's colors (not a fixed dark slate) in Classic WinISD and Solarized Light specifically. Confirm the 3 new color swatches (Muted Text, Warning, Danger) show correct current values and editing them updates the app live and flips the preset selector to "Custom Theme".

- [ ] **Step 8: Commit**

```bash
git add src/App.tsx
git commit -m "fix: theme-aware Settings modal selects, add textMuted/warning/danger color pickers"
```

---

## Task 21: Driver Browser modal — primitives + empty state styling

**Files:**
- Modify: `src/App.tsx:5503-5610`

**Interfaces:**
- Consumes: `TextField`, `Button`.

- [ ] **Step 1: Search field uses `TextField`**

Before (lines 5519-5527):
```tsx
            <div className="p-5 border-b flex gap-3 items-center" style={{ borderColor: "var(--graph-grid-color)" }}>
              <input
                type="text"
                placeholder="Search by manufacturer or model..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="flex-1 text-sm border rounded px-3 py-2 focus:outline-none"
                style={{ backgroundColor: "var(--bg-color)", borderColor: "var(--graph-grid-color)", color: "var(--text-color)" }}
              />
              <button
                onClick={handleStartAddDriver}
                className="flex items-center gap-1.5 px-4 py-2 rounded text-sm font-semibold transition cursor-pointer animate-fadeIn hover:brightness-110 active:brightness-95"
                style={{ backgroundColor: "var(--accent-color)", color: "#fff" }}
              >
                <Plus className="h-4 w-4" />
                Add Driver
              </button>
            </div>
```
After:
```tsx
            <div className="p-5 border-b flex gap-3 items-center" style={{ borderColor: "var(--graph-grid-color)" }}>
              <TextField
                className="flex-1"
                placeholder="Search by manufacturer or model..."
                value={searchQuery}
                onChange={setSearchQuery}
              />
              <Button variant="primary" onClick={handleStartAddDriver} className="flex items-center gap-1.5 animate-fadeIn">
                <Plus className="h-4 w-4" />
                Add Driver
              </Button>
            </div>
```

- [ ] **Step 2: Style the existing empty state with theme tokens (it already exists functionally — line 5601-5605 — just needs the token treatment, not new logic)**

Before:
```tsx
                {filteredDrivers.length === 0 && (
                  <div className="col-span-2 text-center py-8 opacity-60 text-sm">
                    No drivers found matching your search.
                  </div>
                )}
```
After (adds a subtle icon for visual weight, consistent with how empty states typically read; `Database` is already imported for the header icon button elsewhere in the file):
```tsx
                {filteredDrivers.length === 0 && (
                  <div className="col-span-2 flex flex-col items-center gap-2 text-center py-10 opacity-60">
                    <Database className="h-6 w-6" />
                    <span className="text-sm">No drivers found matching your search.</span>
                  </div>
                )}
```

- [ ] **Step 3: Update the `./components/ui` import**

```tsx
import { useToast, useDialog, Badge, CollapsibleSection, useSectionState, Button, Select, TextField } from "./components/ui";
```

- [ ] **Step 4: Verify build**

Run: `npm run build`.

- [ ] **Step 5: Manual verification**

Run app, open Driver Database, search for something that matches nothing, confirm the empty state renders centered with the icon; search normally and confirm results still filter and "Load Driver"/edit buttons still work.

- [ ] **Step 6: Commit**

```bash
git add src/App.tsx
git commit -m "refactor: apply TextField/Button primitives to Driver Browser modal, polish empty state"
```

---

## Task 22: Add/Edit Driver modal — apply NumberField/TextField primitives

**Files:**
- Modify: `src/App.tsx:5612-5885`

**Interfaces:**
- Consumes: `TextField`, `NumberField`, `Button`.

This modal has the highest concentration of near-duplicate field blocks in the app (14 Thiele-Small parameter inputs, all following the identical `<label>` + `<input type="number">` pattern read in full during planning).

- [ ] **Step 1: Read the remainder not yet seen**

Planning read lines 5612-5820 in full (Manufacturer/Model, Estimator Helpers, and the Fs/Qes/Qms/Qts/Vas/Re/Sd/Xmax/Sensitivity/Mms fields) plus the tail (5860-5889, Verify Parameters / Cancel / Save Driver buttons). Read lines 5820-5860 (the remaining fields — Le, Bl, Pe, and whatever else completes the 3-column grid) before starting.

- [ ] **Step 2: Convert Manufacturer/Model to `TextField`**

Before (lines 5628-5651):
```tsx
                <div>
                  <label className="text-xs font-semibold opacity-70 block mb-1">Manufacturer *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. B&C Speakers"
                    value={newManufacturer}
                    onChange={(e) => setNewManufacturer(e.target.value)}
                    className="w-full border rounded px-3 py-2 text-sm focus:outline-none"
                    style={{ backgroundColor: "var(--bg-color)", borderColor: "var(--graph-grid-color)", color: "var(--text-color)" }}
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold opacity-70 block mb-1">Model / Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. 21SW115"
                    value={newModel}
                    onChange={(e) => setNewModel(e.target.value)}
                    className="w-full border rounded px-3 py-2 text-sm focus:outline-none"
                    style={{ backgroundColor: "var(--bg-color)", borderColor: "var(--graph-grid-color)", color: "var(--text-color)" }}
                  />
                </div>
```
After:
```tsx
                <TextField label="Manufacturer *" required placeholder="e.g. B&C Speakers" value={newManufacturer} onChange={setNewManufacturer} />
                <TextField label="Model / Name *" required placeholder="e.g. 21SW115" value={newModel} onChange={setNewModel} />
```

- [ ] **Step 3: Convert each Thiele-Small numeric field to `NumberField`**

Worked example (Fs, lines 5700-5711 — required field):
Before:
```tsx
                  <div>
                    <label className="text-xs opacity-70 block mb-1">Fs (Hz) *</label>
                    <input
                      type="number"
                      step="any"
                      required
                      value={newFs}
                      onChange={(e) => setNewFs(e.target.value)}
                      className="w-full border rounded px-3 py-1.5 text-sm font-mono focus:outline-none"
                      style={{ backgroundColor: "var(--bg-color)", borderColor: "var(--graph-grid-color)", color: "var(--text-color)" }}
                    />
                  </div>
```
After:
```tsx
                  <NumberField label="Fs (Hz) *" required value={newFs} onChange={(v) => setNewFs(v.toString())} accent={false} />
```
(`newFs` etc. are `string` state, set via `setNewFs(e.target.value)` in the original — `NumberField`'s `onChange` gives a parsed `number`, so call sites convert back with `.toString()` to keep the existing string-state design unchanged. `accent={false}` because these fields render in plain `text-color` in the original, not accent — check each field's original `color:` style value and pass `accent={false}` to match unless the original was accent-colored.)

Apply the same transform to every remaining Thiele-Small field: Qes, Qms, Vas, Re, Sd, Xmax, Sensitivity, Mms, Le, Bl, Pe (all follow the identical pattern; copy the `required` attribute only where the original had it — from the planning read, Fs/Qes/Qms/Vas/Sensitivity are `required`, the rest are not).

Special case — Qts (line 5737-5746), which is `disabled` and auto-computed:
Before:
```tsx
                  <div>
                    <label className="text-xs opacity-70 block mb-1">Qts (Calculated)</label>
                    <input
                      type="number"
                      step="any"
                      disabled
                      value={newQts}
                      className="w-full border rounded px-3 py-1.5 text-sm font-mono cursor-not-allowed"
                      style={{ backgroundColor: "var(--bg-color)", borderColor: "var(--graph-grid-color)", color: "var(--accent-color)" }}
                    />
                  </div>
```
After:
```tsx
                  <NumberField label="Qts (Calculated)" disabled value={newQts} onChange={() => {}} />
```
(`NumberField` always renders `disabled ? "var(--text-muted-color)" : ...` for a disabled field's text color per Task 5's implementation — this changes Qts's disabled-state color from `var(--accent-color)` to `var(--text-muted-color)`, which is more conventional for a disabled/read-only field and consistent with how disabled fields should look; note this as an intentional small visual change, not a bug, when you see it in Step 5's manual check.)

- [ ] **Step 4: Convert Estimator Helpers' Piston Diameter field and Nominal Impedance select (lines ~5661-5697)**

Piston Diameter → `NumberField` (no unit label needed inline since the surrounding "Dia:" text already labels it — pass no `label`, keep the existing adjacent `<span>` text as-is, just replace the `<input>`):
Before:
```tsx
                    <div className="flex items-center gap-1">
                      <span className="opacity-50">Dia:</span>
                      <input
                        type="number"
                        placeholder="Piston (in)"
                        value={pistonDiameter}
                        onChange={(e) => setPistonDiameter(e.target.value)}
                        className="w-16 border rounded px-1.5 py-0.5 text-center focus:outline-none text-xs"
                        style={{ backgroundColor: "var(--sidebar-color)", borderColor: "var(--graph-grid-color)", color: "var(--text-color)" }}
                      />
                    </div>
```
This one has a distinct compact style (`w-16`, centered, `sidebar-color` background) that doesn't match `NumberField`'s default full-width/right-aligned/`bg-color` styling — leave this specific input as raw markup rather than forcing an ill-fitting primitive; it's a one-off. Skip converting this field.

Nominal Impedance `<select>` (lines 5677-5687) → `Select`:
Before:
```tsx
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
```
This also has compact one-off styling inconsistent with `Select`'s default full-width block layout — skip converting it too, same reasoning as Piston Diameter. Not every input needs to go through a primitive; the goal is removing *repeated* duplication, and these two compact inline fields are each used once with bespoke sizing.

- [ ] **Step 5: Convert Cancel/Save Driver buttons (lines ~5867-5883)**

Before:
```tsx
                <button
                  type="button"
                  onClick={() => setShowAddForm(false)}
                  className="px-4 py-2 rounded text-sm font-semibold transition cursor-pointer hover:brightness-110"
                  style={{ backgroundColor: "var(--bg-color)", color: "var(--text-color)" }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded text-sm font-semibold transition shadow-md cursor-pointer hover:brightness-110 active:brightness-95"
                  style={{ backgroundColor: "var(--accent-color)", color: "#fff" }}
                >
                  Save Driver
                </button>
```
After:
```tsx
                <Button type="button" onClick={() => setShowAddForm(false)}>
                  Cancel
                </Button>
                <Button type="submit" variant="primary">
                  Save Driver
                </Button>
```
(Leave the "Verify Parameters" button, lines 5860-5865, as raw markup — it uses `mr-auto` for left-alignment within the same flex row, which `Button`'s variants don't specifically account for; either add `className="mr-auto"` to a `Button` usage — `Button` forwards `className` — or leave as-is. Prefer converting it too for consistency: `<Button type="button" onClick={handleVerifyParameters} className="mr-auto">Verify Parameters</Button>`.)

- [ ] **Step 6: Update the `./components/ui` import**

```tsx
import { useToast, useDialog, Badge, CollapsibleSection, useSectionState, Button, Select, TextField, NumberField } from "./components/ui";
```

- [ ] **Step 7: Verify build**

Run: `npm run build`.

- [ ] **Step 8: Manual verification**

Run app, open Add Custom Driver, fill in all fields, confirm Estimate T/S and Verify Parameters both still work (they read from the same `newFs`/`newQes`/etc. state, untouched by this task), Save Driver persists correctly, and Edit Driver (via the pencil icon in Driver Browser) correctly pre-fills all the now-`NumberField`-based inputs.

- [ ] **Step 9: Commit**

```bash
git add src/App.tsx
git commit -m "refactor: apply NumberField/TextField/Button primitives to Add/Edit Driver modal"
```

---

## Task 23: Final verification pass

**Files:** None modified — verification only.

- [ ] **Step 1: Full build + typecheck**

Run: `npm run build`
Expected: succeeds with zero TypeScript errors.

- [ ] **Step 2: Confirm no native dialogs remain**

Run:
```bash
grep -n '\balert(\|\bconfirm(\|\bprompt(' src/App.tsx
```
Expected: no output.

- [ ] **Step 3: Confirm no sub-11px text remains**

Run:
```bash
grep -n 'text-\[[0-9]px\]\|text-\[10px\]' src/App.tsx
```
Expected: no output (7-10px arbitrary values). `text-[11px]` was also swept in Task 4, so check for it too:
```bash
grep -n 'text-\[11px\]' src/App.tsx
```
Expected: no output.

- [ ] **Step 4: Re-run the contrast script**

Run: `node scripts/check-theme-contrast.mjs`
Expected: all checks print `PASS` (colors shouldn't have changed since Task 3, but this confirms nothing drifted).

- [ ] **Step 5: Manual walkthrough — do this in the running app, not just by reading code**

Run: `npm run tauri dev`. For each of the 4 themes (switch via Settings → Theme Presets):
- Confirm text is legible everywhere (sidebar, dashboard, modals) with no obvious contrast failures.
- Confirm Ctrl+/Ctrl-/Ctrl+scroll zoom works.
- Open each sidebar tab (Driver/Enclosure/Signal), expand/collapse a few `CollapsibleSection`s, reload the app, confirm the open/closed state persisted.
- Trigger Save Project, New Project, Rename Project, Remove Project — confirm themed toast/dialogs appear (no native browser popups).
- Open Driver Database, search for a nonexistent driver, confirm the empty state.
- Open Add Custom Driver, submit with Manufacturer/Model blank, confirm the themed validation dialog.
- Open Settings, confirm all color swatches (including the 3 new ones) work and the two previously-hardcoded-dark dropdowns now match the active theme.

- [ ] **Step 6: Confirm no unintended backend changes**

Run:
```bash
git status --short src-tauri/src/
git diff --stat main -- src-tauri/src/
```
Expected: only the files that were already modified before this plan started (`circuit.rs`, `custom_topology.rs`, `lib.rs`, `topologies.rs`, per the pre-existing `git status` from before this work began) show changes, and their diffs are unchanged from before this plan's work — this plan's tasks never touched `src-tauri/src/`.

- [ ] **Step 7: Report**

No commit for this task (verification only). If any check above fails, go back to the relevant task, fix, and re-run this task's checks before considering the overall plan complete.

---

## Self-Review Notes

- **Spec coverage:** Section 1 (type scale/spacing) → Task 4 (+ spacing left intentionally light-touch per the task's own scope note, applied only to new/touched structure, not a blanket sweep — flagging this as a deliberate deviation from a literal reading of the spec's spacing table, justified by regression risk in dense existing grids). Section 2 (theme palettes) → Tasks 2-3. Section 3 (primitives) → Tasks 5-7. Section 4 (sidebar reorg) → Tasks 12-17 (note: Driver tab has no collapsible sections, per Task 11's finding that it's already short and cohesive — a deliberate, evidence-based deviation from assuming every tab needs collapsing). Section 5 (functional UX) → Tasks 1, 8-9 (alert/confirm/prompt — broader than the spec's original wording since planning found 11 `alert()` sites, not the "silent save" the spec first assumed; the spec was corrected inline during brainstorming to match), 10, 18 (tooltips), 21 (empty state, found to already exist — just restyled).
- **Placeholder scan:** no TBD/TODO; every code step has real code or an exact anchor + worked example plus an explicit mechanical rule for the parts of large regions not verbatim-quoted (Tasks 12, 13, 15, 16, 17, 22 each say plainly what wasn't read during planning and instruct reading it before editing — this is a deliberate, bounded gap given the file is 5,889 lines, not a vague placeholder).
- **Type consistency:** `AppTheme` fields (`textMutedColor`, `warningColor`, `dangerColor`) introduced in Task 2 are used identically in Tasks 3 (contrast script, plain-JS copy), 11 (Badge/warning banner), 17 (stats block), 20 (color pickers). Primitive prop names (`TextField`/`NumberField`/`Select`/`Button`/`Badge`/`Tooltip`/`CollapsibleSection`/`useSectionState`/`useToast`/`useDialog`) are defined once in Tasks 5-7 and referenced with matching signatures in every later task — verified no drift (e.g. `NumberField`'s `onChange: (v: number) => void` is used consistently as `(v) => setX(v...)` throughout Task 22, never as `(e) => ...`).
