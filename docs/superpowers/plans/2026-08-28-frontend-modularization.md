# Frontend Modularization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restructure `src/App.tsx` (5,759 lines, one component owning ~45 state slices, ~25 handlers, and the entire JSX tree) into types/lib/hooks/context/components, with a Vitest baseline covering the pure calculation functions and the relocated hook logic.

**Architecture:** Extract in dependency order — types and pure functions first (zero behavior risk), then domain hooks each paired with a React Context and Provider (state ownership moves, verified by hook tests), then presentational components that consume those contexts directly (JSX moves last, once the state it reads already lives in context). `App.tsx` ends as a thin composition root: mount providers, render top-level layout.

**Tech Stack:** React 19, TypeScript, Vite, Tauri v2, Vitest + `@testing-library/react` (new).

**Spec:** `docs/superpowers/specs/2026-08-28-frontend-modularization-design.md`

## Global Constraints

- No behavior changes, no new features, no visual changes (spec Non-goals).
- No change to `src-tauri/src/*.rs` (spec Non-goals).
- No new state-management library — `useState`/`useContext`/custom hooks only (spec Non-goals).
- Handlers move as close to verbatim as possible when relocated into hooks — this is a restructuring project, not a rewrite (spec Risks).
- Every task that touches `App.tsx` or any `src/**/*.tsx`/`*.ts` file ends with `npx tsc --noEmit --noUnusedLocals --noUnusedParameters` and `npm run build` passing before commit.
- Hook tests (via `@testing-library/react`'s `renderHook`/`act`) are written in the same task as that hook's extraction, not deferred (spec Testing strategy).
- Context providers scope to where they're needed — most wrap the app root; `useDriverForm`'s wraps only the Add/Edit Driver modal subtree (spec Architecture, Principles).
- Contexts stay domain-split — no single root "AppContext" (spec Architecture, Principles).

---

## File Structure

```
src/
  types.ts                          # Driver, Project, CurveType, EnclosureType, CustomTopologySpec
                                     # family, EqFilter, RoomConfig, CabinConfig, GraphViewportConfig
  lib/
    session.ts                      # loadSavedSession
    calculations.ts                 # T/S math, filter/room-correction math, port length, findLFCrossover
    calculations.test.ts
  hooks/
    useTheme.ts
    useModals.ts
    useDriverDatabase.ts
    useSignalProcessing.ts          # + useSignalProcessing.test.ts
    useProjects.ts                  # + useProjects.test.ts
    useGraphViewport.ts             # + useGraphViewport.test.ts
    useSimulation.ts
    useDriverForm.ts                # + useDriverForm.test.ts
  context/
    ThemeContext.tsx
    ModalsContext.tsx
    DriverDatabaseContext.tsx
    SignalProcessingContext.tsx
    ProjectsContext.tsx
    GraphViewportContext.tsx
    SimulationContext.tsx
    DriverFormContext.tsx           # provider wraps only the Add/Edit Driver modal subtree
    AppProviders.tsx                # composes the 7 app-root providers in dependency order
  components/
    ui/                             # existing primitives — untouched
    CustomTopologyDiagram.tsx
    sidebar/
      Sidebar.tsx                   # shell: logo header, project section, tab switcher
      DriverTab.tsx
      EnclosureTab.tsx
      DimensionCalculator.tsx       # owns its own local state
      SignalTab.tsx
    dashboard/
      Dashboard.tsx                 # dashboardContainerRef wrapper + Toolbar + GraphPanel list
      Toolbar.tsx
      GraphPanel.tsx
    modals/
      SettingsModal.tsx
      DriverBrowserModal.tsx
      AddDriverModal.tsx
  App.tsx                           # composition root
  theme.ts / App.css                # unchanged
```

### Provider nesting order (dependency-driven, established in Tasks 5-12)

```
<DriverDatabaseProvider>       (no deps)
  <ModalsProvider>              (no deps)
    <ThemeProvider>             (no deps)
      <ProjectsProvider>        (needs DriverDatabaseContext.openDriverBrowser)
        <SignalProcessingProvider>  (no deps)
          <GraphViewportProvider>  (needs ModalsContext.showSettings)
            <SimulationProvider>   (needs Projects + GraphViewport + SignalProcessing)
              <App content />
            </SimulationProvider>
          </GraphViewportProvider>
        </SignalProcessingProvider>
      </ProjectsProvider>
    </ThemeProvider>
  </ModalsProvider>
</DriverDatabaseProvider>
```

`DriverFormProvider` is not in this stack — it wraps only the Add/Edit Driver modal's JSX subtree (established in Task 12, travels with that JSX into `AddDriverModal.tsx` in Task 21).

**Why this order:** `useProjects`'s `handleNewProject`/`handleAddNewProject` call `openDriverBrowser` (opens the driver-picker modal with a callback) — that's owned by `useDriverDatabase`, so `DriverDatabaseProvider` must be an ancestor of `ProjectsProvider`. `useGraphViewport` has an effect that reads `useModals`'s `showSettings` (syncing the calibration dropdown when Settings opens) — so `ModalsProvider` must be an ancestor of `GraphViewportProvider`. `useSimulation` reads `activeProject`/`projects` (Projects), `graphConfigs`/`globalXMin`/`globalXMax`/`overrideXLimits`/`getGraphXLimits` (GraphViewport), and `filters`/`roomConfig`/`cabinConfig` (SignalProcessing) — so it nests inside all three.

---

## Task 1: `types.ts` — extract all type/interface declarations

**Files:**
- Create: `src/types.ts`
- Modify: `src/App.tsx:10-27, 29-33, 35, 37-44, 47-66, 76-83, 85-97, 101-107, 197-242, 751-754`

**Interfaces:**
- Produces: `Driver`, `SimPoint`, `CurveType`, `EnclosureType`, `CustomPortSpec`, `CustomPRSpec`, `CustomSideSpec`, `CustomTopologySpec`, `EqFilter`, `SpeakerPos`, `RoomConfig`, `CabinConfig`, `GraphViewportConfig`, `Project` — all exported from `src/types.ts`, imported by every later task that references them.

- [ ] **Step 1: Create `src/types.ts` with the type declarations moved verbatim**

Cut these declarations out of `src/App.tsx` and move them into a new `src/types.ts`, exactly as they read today (do not change field names, types, or comments):

- `interface Driver { ... }` (currently `App.tsx:10-27`)
- `interface SimPoint { ... }` (currently `App.tsx:29-33`)
- `type CurveType = ...` (currently `App.tsx:35`)
- `export type EnclosureType = ...` (currently `App.tsx:37-44`)
- `interface CustomPortSpec { ... }`, `interface CustomPRSpec { ... }`, `interface CustomSideSpec { ... }`, `interface CustomTopologySpec { ... }` (currently `App.tsx:47-66`, including the `// Custom topology types — field names match Rust serde snake_case` comment)
- `interface EqFilter { ... }` (currently `App.tsx:76-83`)
- `interface SpeakerPos { x: number; y: number; z: number; }` (currently `App.tsx:85`)
- `interface RoomConfig { ... }` (currently `App.tsx:87-97`)
- `interface GraphViewportConfig { ... }` (currently `App.tsx:101-107`)
- `export interface Project { ... }` (currently `App.tsx:197-242`)

Also move `CabinConfig`, which today is declared **inline inside the `App` function body** at `App.tsx:751-754`:

```tsx
interface CabinConfig {
  enabled: boolean;
  fCabin: number;
}
```

Add the `export` keyword to every interface/type in the new file (all of them need to be importable). Every field, comment, and union member must match the current file exactly — this is a pure relocation, not a rewrite.

The new `src/types.ts` should have no imports (none of these types reference anything outside themselves) and end with all of the above as named exports.

- [ ] **Step 2: Update `src/App.tsx` to import from `./types` instead of declaring locally**

Delete the moved declarations from `App.tsx` (including the now-inline `CabinConfig` block at its original location inside the component body — the type itself moves to `types.ts`, nothing about the `cabinConfig` *state* declaration on the next lines changes). Add an import line near the top of `App.tsx` (after the existing `"./theme"` import):

```tsx
import { Driver, SimPoint, CurveType, EnclosureType, CustomPortSpec, CustomPRSpec, CustomSideSpec, CustomTopologySpec, EqFilter, SpeakerPos, RoomConfig, CabinConfig, GraphViewportConfig, Project } from "./types";
```

Note: `App.tsx` currently has one `export type EnclosureType` and one `export interface Project` — after this change, `App.tsx` itself no longer defines or re-exports these; anything outside `App.tsx` that today imports `EnclosureType`/`Project` from `"./App"` needs to import from `"./types"` instead. Check for such imports with `grep -rn "from \"\./App\"" src/` before moving on — if any exist, update them.

- [ ] **Step 3: Verify**

Run: `npx tsc --noEmit --noUnusedLocals --noUnusedParameters` — expect clean, zero errors.
Run: `npm run build` — expect clean.

- [ ] **Step 4: Commit**

```bash
git add src/types.ts src/App.tsx
git commit -m "refactor: extract shared types to src/types.ts"
```

---

## Task 2: `lib/session.ts` — extract `loadSavedSession`

**Files:**
- Create: `src/lib/session.ts`
- Modify: `src/App.tsx:421-442`

**Interfaces:**
- Consumes: nothing from earlier tasks (pure `localStorage` read).
- Produces: `loadSavedSession(): any | null` — exported from `src/lib/session.ts`. (Kept as `any` for now, matching today's untyped return — later hook tasks each narrow the specific fields they read off it. Introducing a strict `SavedSession` type is out of scope for this plan; it would require auditing every field's optionality against what's actually written by the auto-save effect, which is a separate, later cleanup.)

- [ ] **Step 1: Create `src/lib/session.ts`**

Move `loadSavedSession` verbatim from `App.tsx:421-442`:

```tsx
export const loadSavedSession = () => {
  try {
    const saved = localStorage.getItem("winisd_session_state");
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed && Array.isArray(parsed.projects) && parsed.projects.length > 0) {
        parsed.projects = parsed.projects.map((p: any) => ({
          passiveXoEnabled: false,
          passiveXoType: "lowpass_1st",
          passiveXoInductance: 1.5,
          passiveXoCapacitance: 47.0,
          passiveXoDcr: 0.2,
          ...p
        }));
        return parsed;
      }
    }
  } catch (e) {
    console.error("Failed to load saved session:", e);
  }
  return null;
};
```

- [ ] **Step 2: Update `App.tsx`**

Delete the `loadSavedSession` declaration from `App.tsx`. Add to the import from `"./theme"`'s neighboring import block:

```tsx
import { loadSavedSession } from "./lib/session";
```

`App.tsx` still calls it the same way: `const savedSession = useMemo(() => loadSavedSession(), []);` (line unchanged, just the import source changes).

- [ ] **Step 3: Verify**

Run: `npx tsc --noEmit --noUnusedLocals --noUnusedParameters` — expect clean.
Run: `npm run build` — expect clean.

- [ ] **Step 4: Commit**

```bash
git add src/lib/session.ts src/App.tsx
git commit -m "refactor: extract loadSavedSession to src/lib/session.ts"
```

---

## Task 3: `lib/calculations.ts` — extract pure math + set up Vitest

**Files:**
- Create: `src/lib/calculations.ts`
- Create: `src/lib/calculations.test.ts`
- Modify: `src/App.tsx:312-419, 444-470`
- Modify: `package.json` (add `vitest`, `@testing-library/react`, `jsdom` devDependencies; add `test` script)
- Create: `vitest.config.ts`

**Interfaces:**
- Consumes: `EqFilter`, `RoomConfig`, `SimPoint` from `./types` (Task 1).
- Produces: `filterGainDb(flt: EqFilter, f: number): number`, `totalFilterGainDb(filters: EqFilter[], f: number): number`, `computeRoomCorrection(cfg: RoomConfig, freqs: number[]): number[]`, `findLFCrossover(pts: SimPoint[], dropDb: number): number | null`, `cmsFromVasSd(vasLiters: number, sdCm2: number): number`, `mmsKgFromFsCms(fs: number, cms: number): number`, `blFromFsMmsQes(fs: number, mmsKg: number, re: number, qes: number): number`, `eta0FromFsVasQes(fs: number, vasLiters: number, qes: number): number`, plus the constants `RHO_AIR = 1.18` and `SPEED_OF_SOUND = 343.0` — all exported from `src/lib/calculations.ts`. Later hook tasks (`useSimulation`, `useDriverForm`) import these.

- [ ] **Step 1: Install test dependencies**

```bash
npm install --save-dev vitest @testing-library/react jsdom
```

- [ ] **Step 2: Add `vitest.config.ts`**

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "jsdom",
    globals: true,
  },
});
```

- [ ] **Step 3: Add a `test` script to `package.json`**

In the `"scripts"` block, add:

```json
"test": "vitest run",
"test:watch": "vitest"
```

- [ ] **Step 4: Create `src/lib/calculations.ts` with the pure functions moved verbatim**

Move these from `App.tsx`, unchanged, into the new file:

From `App.tsx:312-347` (EQ filter frequency response):
```tsx
import { EqFilter, RoomConfig, SimPoint } from "../types";

// ── EQ filter frequency response ─────────────────────────────────────────────
export function filterGainDb(flt: EqFilter, f: number): number {
  if (!flt.enabled || f <= 0) return 0;
  const w  = 2 * Math.PI * f;
  const w0 = 2 * Math.PI * Math.max(1, flt.freq);
  const Q  = Math.max(0.1, flt.q);
  const dRe = w0 * w0 - w * w;
  const dIm = w * w0 / Q;

  if (flt.type === "lowshelf") {
    const G = Math.pow(10, flt.gain / 20);
    const t = w / w0;
    return 20 * Math.log10(Math.max(Math.sqrt(G * G + t * t) / Math.sqrt(1 + t * t), 1e-10));
  }
  if (flt.type === "highshelf") {
    const G = Math.pow(10, flt.gain / 20);
    const t = w / w0;
    return 20 * Math.log10(Math.max(Math.sqrt(1 + G * G * t * t) / Math.sqrt(1 + t * t), 1e-10));
  }

  let nRe: number, nIm: number;
  if (flt.type === "hp")   { nRe = -w * w;    nIm = 0; }
  else if (flt.type === "lp") { nRe = w0 * w0; nIm = 0; }
  else { // peak
    const G = Math.pow(10, flt.gain / 20);
    nRe = dRe; nIm = w * G * w0 / Q;
  }

  const dMagSq = dRe * dRe + dIm * dIm;
  if (dMagSq < 1e-30) return 0;
  return 10 * Math.log10(Math.max((nRe * nRe + nIm * nIm) / dMagSq, 1e-20));
}

export function totalFilterGainDb(filters: EqFilter[], f: number): number {
  return filters.filter(flt => flt.enabled).reduce((sum, flt) => sum + filterGainDb(flt, f), 0);
}
```

From `App.tsx:349-402` (Image Source Method room correction) — cut verbatim, add `export` to the function signature: `export function computeRoomCorrection(cfg: RoomConfig, freqs: number[]): number[] { ... }` (body unchanged, read the current file for the exact body if retyping — it's the full nested-loop image-source implementation).

From `App.tsx:404-419` (LF crossover finder) — cut verbatim, add `export`: `export function findLFCrossover(pts: SimPoint[], dropDb: number): number | null { ... }` (body unchanged).

From `App.tsx:444-470` (T/S derivation helpers) — cut verbatim, add `export` to each:
```tsx
export const RHO_AIR = 1.18; // kg/m³, standard air density
export const SPEED_OF_SOUND = 343.0; // m/s

/** Mechanical compliance implied by Vas and Sd: Cms = Vas / (rho * c² * Sd²), SI units. */
export function cmsFromVasSd(vasLiters: number, sdCm2: number): number {
  const sdM2 = sdCm2 * 1e-4;
  const vasM3 = vasLiters * 1e-3;
  return vasM3 / (RHO_AIR * SPEED_OF_SOUND * SPEED_OF_SOUND * sdM2 * sdM2);
}

/** Moving mass (kg) implied by Fs and Cms: Mms = 1 / (ws² * Cms). */
export function mmsKgFromFsCms(fs: number, cms: number): number {
  const ws = 2.0 * Math.PI * fs;
  return 1.0 / (ws * ws * cms);
}

/** Motor strength Bl (T·m) implied by Fs, moving mass (kg), Re and Qes. */
export function blFromFsMmsQes(fs: number, mmsKg: number, re: number, qes: number): number {
  const ws = 2.0 * Math.PI * fs;
  return Math.sqrt((ws * mmsKg * re) / qes);
}

/** Reference efficiency (eta0) implied by Fs, Vas and Qes; feeds the sensitivity formula. */
export function eta0FromFsVasQes(fs: number, vasLiters: number, qes: number): number {
  const vasM3 = vasLiters * 1e-3;
  return (4.0 * Math.PI * Math.PI / Math.pow(SPEED_OF_SOUND, 3)) * (Math.pow(fs, 3) * vasM3) / qes;
}
```

- [ ] **Step 5: Write `src/lib/calculations.test.ts`**

```ts
import { describe, it, expect } from "vitest";
import {
  filterGainDb, totalFilterGainDb, findLFCrossover,
  cmsFromVasSd, mmsKgFromFsCms, blFromFsMmsQes, eta0FromFsVasQes,
} from "./calculations";
import type { EqFilter, SimPoint } from "../types";

describe("filterGainDb", () => {
  it("returns 0 for a disabled filter", () => {
    const flt: EqFilter = { id: "1", enabled: false, type: "peak", freq: 100, q: 1, gain: 6 };
    expect(filterGainDb(flt, 100)).toBe(0);
  });

  it("returns 0 for a non-positive frequency", () => {
    const flt: EqFilter = { id: "1", enabled: true, type: "peak", freq: 100, q: 1, gain: 6 };
    expect(filterGainDb(flt, 0)).toBe(0);
  });

  it("peaks near the target gain at the filter's center frequency for a peak filter", () => {
    const flt: EqFilter = { id: "1", enabled: true, type: "peak", freq: 100, q: 1, gain: 6 };
    expect(filterGainDb(flt, 100)).toBeCloseTo(6, 1);
  });

  it("high-pass filter attenuates well below its corner frequency", () => {
    const flt: EqFilter = { id: "1", enabled: true, type: "hp", freq: 100, q: 0.707, gain: 0 };
    expect(filterGainDb(flt, 10)).toBeLessThan(-30);
  });

  it("low-pass filter attenuates well above its corner frequency", () => {
    const flt: EqFilter = { id: "1", enabled: true, type: "lp", freq: 100, q: 0.707, gain: 0 };
    expect(filterGainDb(flt, 1000)).toBeLessThan(-30);
  });
});

describe("totalFilterGainDb", () => {
  it("sums gain across enabled filters and ignores disabled ones", () => {
    const filters: EqFilter[] = [
      { id: "1", enabled: true,  type: "peak", freq: 100, q: 1, gain: 3 },
      { id: "2", enabled: false, type: "peak", freq: 100, q: 1, gain: 100 },
    ];
    const total = totalFilterGainDb(filters, 100);
    expect(total).toBeCloseTo(3, 1);
  });

  it("returns 0 for an empty filter list", () => {
    expect(totalFilterGainDb([], 100)).toBe(0);
  });
});

describe("findLFCrossover", () => {
  it("finds the frequency where the curve rises through peak - dropDb", () => {
    const pts: SimPoint[] = [
      { frequency: 10, db: 70 },
      { frequency: 20, db: 80 },
      { frequency: 40, db: 90 },
      { frequency: 80, db: 90 },
    ];
    // peak is 90, -3dB target is 87, crossed between 20Hz(80) and 40Hz(90)
    const f3 = findLFCrossover(pts, 3);
    expect(f3).not.toBeNull();
    expect(f3!).toBeGreaterThan(20);
    expect(f3!).toBeLessThan(40);
  });

  it("returns null when the drop is never reached", () => {
    const pts: SimPoint[] = [
      { frequency: 10, db: 90 },
      { frequency: 20, db: 91 },
    ];
    expect(findLFCrossover(pts, 20)).toBeNull();
  });

  it("returns null for fewer than 2 points", () => {
    expect(findLFCrossover([{ frequency: 10, db: 90 }], 3)).toBeNull();
  });
});

describe("T/S derivation helpers", () => {
  it("cmsFromVasSd / mmsKgFromFsCms / blFromFsMmsQes round-trip a known driver's Mms and Bl", () => {
    // B&C 21SW115: Fs=33, Qes=0.37, Vas=278L, Sd=1680cm², Re=3.6, actual Mms=335g, Bl=24.8
    const cms = cmsFromVasSd(278, 1680);
    const mmsKg = mmsKgFromFsCms(33, cms);
    const mmsG = mmsKg * 1000;
    expect(mmsG).toBeGreaterThan(250);
    expect(mmsG).toBeLessThan(420);

    const bl = blFromFsMmsQes(33, mmsKg, 3.6, 0.37);
    expect(bl).toBeGreaterThan(15);
    expect(bl).toBeLessThan(35);
  });

  it("eta0FromFsVasQes yields a positive reference efficiency for realistic inputs", () => {
    const eta0 = eta0FromFsVasQes(33, 278, 0.37);
    expect(eta0).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 6: Run the new tests**

Run: `npx vitest run src/lib/calculations.test.ts` — expect all tests PASS. If any fail, the extraction introduced a discrepancy (a typo, a dropped `Math.max`, a wrong constant) — fix the extracted function to match the original `App.tsx` code exactly, not the test.

- [ ] **Step 7: Update `App.tsx`**

Delete the moved functions/constants from `App.tsx`. Add an import:

```tsx
import { filterGainDb, totalFilterGainDb, computeRoomCorrection, findLFCrossover, cmsFromVasSd, mmsKgFromFsCms, blFromFsMmsQes, eta0FromFsVasQes } from "./lib/calculations";
```

`filterGainDb` is not called directly anywhere else in `App.tsx` (only via `totalFilterGainDb`) — check with `grep -n "filterGainDb(" src/App.tsx` after this edit; if the only remaining call is inside `totalFilterGainDb` itself (now in the new file), you don't need to keep `filterGainDb` in the import list, but importing it unused would fail `--noUnusedLocals` — only import what `App.tsx` still calls directly.

- [ ] **Step 8: Verify**

Run: `npx tsc --noEmit --noUnusedLocals --noUnusedParameters` — expect clean.
Run: `npm run build` — expect clean.
Run: `npx vitest run` — expect all tests passing.

- [ ] **Step 9: Commit**

```bash
git add src/lib/calculations.ts src/lib/calculations.test.ts src/App.tsx vitest.config.ts package.json package-lock.json
git commit -m "refactor: extract pure calculation functions to src/lib/calculations.ts, add Vitest"
```

---

## Task 4: `CustomTopologyDiagram.tsx` — extract the standalone diagram component

**Files:**
- Create: `src/components/CustomTopologyDiagram.tsx`
- Modify: `src/App.tsx:109-184`

**Interfaces:**
- Consumes: `CustomTopologySpec` from `./types` (Task 1).
- Produces: `CustomTopologyDiagram({ topo: CustomTopologySpec })` — a default export, imported by the future `EnclosureTab.tsx` (Task 15).

- [ ] **Step 1: Create `src/components/CustomTopologyDiagram.tsx`**

Move `App.tsx:109-184` verbatim (it already has zero dependency on `App`'s state — it only destructures its own `topo` prop):

```tsx
import { CustomTopologySpec } from "../types";

// ── Topology diagram shown inside the Custom Topology Builder ──
export default function CustomTopologyDiagram({ topo }: { topo: CustomTopologySpec }) {
  const { rear, front, internal_port } = topo;
  const hasFront = front.volume_liters > 0;

  const Block = ({ label, sub, dim }: { label: string; sub?: string; dim?: boolean }) => (
    <div className={`flex flex-col items-center justify-center border rounded px-1.5 py-1 min-w-0 ${dim ? "opacity-40" : ""}`}
      style={{ borderColor: "var(--graph-grid-color)", backgroundColor: "var(--bg-color)", fontSize: 11, lineHeight: 1.3 }}>
      <span className="font-bold truncate">{label}</span>
      {sub && <span className="opacity-60 truncate">{sub}</span>}
    </div>
  );

  const Arrow = ({ label, vertical }: { label?: string; vertical?: boolean }) => (
    <div className={`flex items-center justify-center ${vertical ? "flex-col" : ""} shrink-0`}
      style={{ color: "var(--accent-color)", fontSize: 11, gap: 1, opacity: 0.75 }}>
      {label && !vertical && <span>{label}</span>}
      <span>{vertical ? "↓" : "→"}</span>
      {label && vertical && <span>{label}</span>}
    </div>
  );

  return (
    <div className="border rounded p-2 flex flex-col gap-1.5"
      style={{ borderColor: "var(--graph-grid-color)", backgroundColor: "var(--bg-color)", fontSize: 11 }}>
      {/* Top row: [OUTSIDE?] ← Port ← Rear Ch ← DRIVER → FrontCh/Air → Port → OUTSIDE */}
      <div className="flex items-center gap-1 justify-center flex-wrap">
        {/* Rear side: outward path */}
        {rear.port && <>
          <Block label="OUTSIDE" />
          <Arrow label={`${rear.port.tuning_freq}Hz`} />
        </>}
        {rear.pr && <>
          <Block label="OUTSIDE" />
          <Arrow label="PR" />
        </>}
        <Block label={`Rear Ch.`} sub={`${rear.volume_liters}L`} />

        {/* Driver */}
        <div className="flex items-center gap-0.5 shrink-0">
          <span style={{ color: "var(--accent-color)", fontSize: 11 }}>◉</span>
          <span className="font-bold" style={{ fontSize: 11 }}>DRV</span>
          <span style={{ color: "var(--accent-color)", fontSize: 11 }}>◉</span>
        </div>

        {/* Front side */}
        {hasFront ? (
          <>
            <Block label="Front Ch." sub={`${front.volume_liters}L`} />
            {front.port && <>
              <Arrow label={`${front.port.tuning_freq}Hz`} />
              <Block label="OUTSIDE" />
            </>}
            {front.pr && <>
              <Arrow label="PR" />
              <Block label="OUTSIDE" />
            </>}
            {!front.port && !front.pr && <Block label="Sealed" dim />}
          </>
        ) : (
          <>
            <Arrow />
            <Block label="OUTSIDE" sub="open air" />
          </>
        )}
      </div>

      {/* Internal port row */}
      {internal_port && (
        <div className="flex items-center justify-center gap-1" style={{ color: "var(--accent-color)" }}>
          <span style={{ fontSize: 11, opacity: 0.7 }}>↕ internal port {internal_port.tuning_freq}Hz</span>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Update `App.tsx`**

Delete `App.tsx:109-184`. Add an import near the top:

```tsx
import CustomTopologyDiagram from "./components/CustomTopologyDiagram";
```

`App.tsx` currently renders `<CustomTopologyDiagram topo={activeProject.customTopology} />` somewhere in the Custom Topology Builder JSX (inside the `sidebarTab === "enclosure"` block) — that call site is unchanged, it now resolves to the imported component instead of the local function.

- [ ] **Step 3: Verify**

Run: `npx tsc --noEmit --noUnusedLocals --noUnusedParameters` — expect clean.
Run: `npm run build` — expect clean.

- [ ] **Step 4: Commit**

```bash
git add src/components/CustomTopologyDiagram.tsx src/App.tsx
git commit -m "refactor: extract CustomTopologyDiagram to its own file"
```

---

## Task 5: `useTheme` hook + `ThemeContext`

**Files:**
- Create: `src/hooks/useTheme.ts`
- Create: `src/context/ThemeContext.tsx`
- Modify: `src/App.tsx:474, 968-971, 2160-2182` (and the theme-related JSX in the Settings modal block, still inline in `App.tsx` at this stage — do not move it yet, just switch its data source)

**Interfaces:**
- Consumes: `AppTheme`, `PRESETS`, `applyTheme`, `saveTheme`, `loadSavedTheme` from `../theme` (existing, unchanged).
- Produces: `useThemeContext(): { currentTheme: AppTheme; setCurrentTheme: (t: AppTheme) => void; handleCustomColorChange: (key: keyof AppTheme, color: string) => void; activePresetKey: string }`, and `ThemeProvider({ children }: { children: ReactNode })` — both exported from `src/context/ThemeContext.tsx`. Later tasks (Settings modal, Task 19) call `useThemeContext()`.

- [ ] **Step 1: Create `src/hooks/useTheme.ts`**

```tsx
import { useEffect, useMemo, useState } from "react";
import { AppTheme, PRESETS, applyTheme, saveTheme, loadSavedTheme } from "../theme";

export function useTheme() {
  const [currentTheme, setCurrentTheme] = useState<AppTheme>(loadSavedTheme());

  // Apply theme when theme state changes
  useEffect(() => {
    applyTheme(currentTheme);
    saveTheme(currentTheme);
  }, [currentTheme]);

  const handleCustomColorChange = (key: keyof AppTheme, color: string) => {
    setCurrentTheme((prev) => ({
      ...prev,
      name: "Custom",
      [key]: color,
    }));
  };

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

  return { currentTheme, setCurrentTheme, handleCustomColorChange, activePresetKey };
}
```

This is `App.tsx:474` (the `useState`), `App.tsx:968-971` (the apply-theme effect), `App.tsx:2160-2166` (`handleCustomColorChange`), and `App.tsx:2168-2182` (`activePresetKey`) moved verbatim into one hook.

- [ ] **Step 2: Create `src/context/ThemeContext.tsx`**

```tsx
import { createContext, ReactNode, useContext } from "react";
import { useTheme } from "../hooks/useTheme";

type ThemeContextValue = ReturnType<typeof useTheme>;

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const value = useTheme();
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useThemeContext(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useThemeContext must be used within a ThemeProvider");
  return ctx;
}
```

- [ ] **Step 3: Wire `ThemeProvider` around `App`'s content and switch `App.tsx` to consume it**

In `App.tsx`:
1. Delete the `currentTheme`/`setCurrentTheme` state declaration (`App.tsx:474`), the apply-theme `useEffect` (`App.tsx:968-971`), `handleCustomColorChange` (`App.tsx:2160-2166`), and `activePresetKey` (`App.tsx:2168-2182`).
2. Add near the top: `import { ThemeProvider, useThemeContext } from "./context/ThemeContext";`
3. Inside the `App` function body, replace the deleted state with: `const { currentTheme, setCurrentTheme, handleCustomColorChange, activePresetKey } = useThemeContext();` — placed where `const [currentTheme, ...]` used to be. Every other reference to `currentTheme`/`setCurrentTheme`/`handleCustomColorChange`/`activePresetKey` elsewhere in `App.tsx` (the Settings modal JSX, still inline at this point) is unchanged — same variable names, same call sites.
4. `App` is exported as `export default function App() { ... }` — rename this function to `AppShell` (not exported), and add a new default export below it:

```tsx
export default function App() {
  return (
    <ThemeProvider>
      <AppShell />
    </ThemeProvider>
  );
}
```

This establishes the pattern every subsequent hook task extends: each task adds one more provider layer between `App` and `AppShell`, in the dependency order fixed by the Provider nesting order table above.

- [ ] **Step 4: Verify**

Run: `npx tsc --noEmit --noUnusedLocals --noUnusedParameters` — expect clean.
Run: `npm run build` — expect clean.

- [ ] **Step 5: Commit**

```bash
git add src/hooks/useTheme.ts src/context/ThemeContext.tsx src/App.tsx
git commit -m "refactor: extract theme state into useTheme hook + ThemeContext"
```

---

## Task 6: `useModals` hook + `ModalsContext`

**Files:**
- Create: `src/hooks/useModals.ts`
- Create: `src/context/ModalsContext.tsx`
- Modify: `src/App.tsx:710-731` (and wrap `ThemeProvider` inside it in the composition root)

**Interfaces:**
- Consumes: `useSectionState` from `./components/ui` (existing).
- Produces: `useModalsContext(): { showSettings: boolean; setShowSettings: (v: boolean) => void; sidebarTab: "driver" | "enclosure" | "signal"; setSidebarTab: (t: "driver" | "enclosure" | "signal") => void; sidebarSectionState: Record<string, boolean>; toggleSidebarSection: (key: string) => void }`, `ModalsProvider`.

- [ ] **Step 1: Create `src/hooks/useModals.ts`**

Move `App.tsx:709-731` (sidebar tab + persisted collapsible-section state) verbatim, plus the `savedSession` read they depend on:

```tsx
import { useMemo } from "react";
import { useSectionState } from "../components/ui";
import { loadSavedSession } from "../lib/session";

export function useModals() {
  const savedSession = useMemo(() => loadSavedSession(), []);

  // Sidebar active tab selection
  const [sidebarTab, setSidebarTab] = useState<"driver" | "enclosure" | "signal">(() => {
    return savedSession?.sidebarTab || "enclosure";
  });

  // Persisted open/closed state for collapsible sidebar sections
  const [sidebarSectionState, , toggleSidebarSection] = useSectionState(
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

  const [showSettings, setShowSettings] = useState(false);

  return { showSettings, setShowSettings, sidebarTab, setSidebarTab, sidebarSectionState, toggleSidebarSection };
}
```

Note: add `import { useState } from "react";` too. `showSettings` (currently `App.tsx:738`, in the "DB and UI states" block) moves here rather than into `useDriverDatabase` — it's the Settings modal's own visibility flag, unrelated to the driver database (see Task 7's note on why `showBrowser`/`showAddForm` move there instead, coupled as they are to `browserCallback`/`editingDriverId`).

- [ ] **Step 2: Create `src/context/ModalsContext.tsx`**

```tsx
import { createContext, ReactNode, useContext } from "react";
import { useModals } from "../hooks/useModals";

type ModalsContextValue = ReturnType<typeof useModals>;

const ModalsContext = createContext<ModalsContextValue | null>(null);

export function ModalsProvider({ children }: { children: ReactNode }) {
  const value = useModals();
  return <ModalsContext.Provider value={value}>{children}</ModalsContext.Provider>;
}

export function useModalsContext(): ModalsContextValue {
  const ctx = useContext(ModalsContext);
  if (!ctx) throw new Error("useModalsContext must be used within a ModalsProvider");
  return ctx;
}
```

- [ ] **Step 3: Wire into `App.tsx`**

1. Delete `sidebarTab`/`setSidebarTab` (`App.tsx:710-712`), `sidebarSectionState`/`toggleSidebarSection` (`App.tsx:715-731`), and `showSettings`/`setShowSettings` (`App.tsx:738`) from `AppShell`.
2. Import: `import { ModalsProvider, useModalsContext } from "./context/ModalsContext";`
3. In `AppShell`, add: `const { showSettings, setShowSettings, sidebarTab, setSidebarTab, sidebarSectionState, toggleSidebarSection } = useModalsContext();`
4. Update the composition root from Task 5 — `ModalsProvider` wraps `ThemeProvider` (per the Provider nesting order table: `DriverDatabaseProvider > ModalsProvider > ThemeProvider > ...`; `DriverDatabaseProvider` doesn't exist yet, so for now just nest `ModalsProvider` outside `ThemeProvider`):

```tsx
export default function App() {
  return (
    <ModalsProvider>
      <ThemeProvider>
        <AppShell />
      </ThemeProvider>
    </ModalsProvider>
  );
}
```

- [ ] **Step 4: Verify**

Run: `npx tsc --noEmit --noUnusedLocals --noUnusedParameters` — expect clean.
Run: `npm run build` — expect clean.

- [ ] **Step 5: Commit**

```bash
git add src/hooks/useModals.ts src/context/ModalsContext.tsx src/App.tsx
git commit -m "refactor: extract modal-visibility/sidebar-tab state into useModals hook + ModalsContext"
```

---

## Task 7: `useDriverDatabase` hook + `DriverDatabaseContext`

**Files:**
- Create: `src/hooks/useDriverDatabase.ts`
- Create: `src/context/DriverDatabaseContext.tsx`
- Modify: `src/App.tsx:734-740, 941-944, 1055-1067, 1289-1329, 2151-2159`

**Interfaces:**
- Consumes: `Driver` from `../types` (Task 1).
- Produces: `useDriverDatabaseContext(): { drivers: Driver[]; setDrivers: (d: Driver[]) => void; searchQuery: string; setSearchQuery: (q: string) => void; filteredDrivers: Driver[]; showBrowser: boolean; setShowBrowser: (v: boolean) => void; showAddForm: boolean; setShowAddForm: (v: boolean) => void; browserCallback: ((d: Driver) => void) | null; setBrowserCallback: (cb: ((d: Driver) => void) | null) => void; editingDriverId: string | null; setEditingDriverId: (id: string | null) => void; openDriverBrowser: (onSelect: (d: Driver) => void) => void; refreshDrivers: () => Promise<void> }`, `DriverDatabaseProvider`.

This hook is a wider net than the design doc's original table (which put `showBrowser`/`showAddForm`/`browserCallback` under `useModals`) — planning found `openDriverBrowser` couples `browserCallback` with `showBrowser`, and `handleStartEditDriver`/`handleStartAddDriver` couple `editingDriverId` with `showAddForm`, tightly enough that splitting them across two hooks would mean `useModals` and `useDriverDatabase` constantly reaching into each other. Consolidating all driver-picker/editor visibility state here, alongside the driver list itself, is a direct application of the design doc's own principle (minimize cross-hook coupling) — `useModals` stays limited to genuinely generic app chrome (Settings visibility, sidebar tab, section-collapse state).

- [ ] **Step 1: Create `src/hooks/useDriverDatabase.ts`**

```tsx
import { useEffect, useMemo, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Driver } from "../types";

export function useDriverDatabase() {
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [showBrowser, setShowBrowser] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [browserCallback, setBrowserCallback] = useState<((d: Driver) => void) | null>(null);
  const [editingDriverId, setEditingDriverId] = useState<string | null>(null);

  const refreshDrivers = async () => {
    try {
      const dbDrivers: Driver[] = await invoke("get_drivers");
      setDrivers(dbDrivers);
    } catch (err) {
      console.error("Failed to fetch drivers:", err);
    }
  };

  useEffect(() => {
    refreshDrivers();
  }, []);

  const filteredDrivers = useMemo(() => {
    return drivers.filter((d) => {
      const search = searchQuery.toLowerCase();
      return (
        d.manufacturer.toLowerCase().includes(search) ||
        d.model.toLowerCase().includes(search)
      );
    });
  }, [drivers, searchQuery]);

  const openDriverBrowser = (onSelect: (d: Driver) => void) => {
    setBrowserCallback(() => onSelect);
    setShowBrowser(true);
  };

  return {
    drivers, setDrivers, searchQuery, setSearchQuery, filteredDrivers,
    showBrowser, setShowBrowser, showAddForm, setShowAddForm,
    browserCallback, setBrowserCallback, editingDriverId, setEditingDriverId,
    openDriverBrowser, refreshDrivers,
  };
}
```

This is `App.tsx:734-740` (state), `App.tsx:941-944` (`openDriverBrowser`), `App.tsx:1055-1067` (`refreshDrivers` + its mount effect), and `App.tsx:2151-2159` (`filteredDrivers`) moved verbatim.

Note: `handleStartEditDriver` and `handleStartAddDriver` (`App.tsx:1289-1329`) are **not** moved here — they reset the 14 form fields (`newFs`..`newSens`) alongside setting `editingDriverId`/`showAddForm`, so they belong in `useDriverForm` (Task 12), which will read/write `editingDriverId`/`showAddForm` via this hook's context.

- [ ] **Step 2: Create `src/context/DriverDatabaseContext.tsx`**

```tsx
import { createContext, ReactNode, useContext } from "react";
import { useDriverDatabase } from "../hooks/useDriverDatabase";

type DriverDatabaseContextValue = ReturnType<typeof useDriverDatabase>;

const DriverDatabaseContext = createContext<DriverDatabaseContextValue | null>(null);

export function DriverDatabaseProvider({ children }: { children: ReactNode }) {
  const value = useDriverDatabase();
  return <DriverDatabaseContext.Provider value={value}>{children}</DriverDatabaseContext.Provider>;
}

export function useDriverDatabaseContext(): DriverDatabaseContextValue {
  const ctx = useContext(DriverDatabaseContext);
  if (!ctx) throw new Error("useDriverDatabaseContext must be used within a DriverDatabaseProvider");
  return ctx;
}
```

- [ ] **Step 3: Wire into `App.tsx`**

1. Delete `App.tsx:734-740` (state), `App.tsx:941-944` (`openDriverBrowser`), `App.tsx:1055-1067` (`refreshDrivers` + effect), `App.tsx:2151-2159` (`filteredDrivers`) from `AppShell`.
2. Import: `import { DriverDatabaseProvider, useDriverDatabaseContext } from "./context/DriverDatabaseContext";`
3. In `AppShell`: `const { drivers, setDrivers, searchQuery, setSearchQuery, filteredDrivers, showBrowser, setShowBrowser, showAddForm, setShowAddForm, browserCallback, setBrowserCallback, editingDriverId, setEditingDriverId, openDriverBrowser, refreshDrivers } = useDriverDatabaseContext();`
4. Update the composition root — `DriverDatabaseProvider` wraps everything (outermost, per the nesting order table):

```tsx
export default function App() {
  return (
    <DriverDatabaseProvider>
      <ModalsProvider>
        <ThemeProvider>
          <AppShell />
        </ThemeProvider>
      </ModalsProvider>
    </DriverDatabaseProvider>
  );
}
```

- [ ] **Step 4: Verify**

Run: `npx tsc --noEmit --noUnusedLocals --noUnusedParameters` — expect clean.
Run: `npm run build` — expect clean.

- [ ] **Step 5: Commit**

```bash
git add src/hooks/useDriverDatabase.ts src/context/DriverDatabaseContext.tsx src/App.tsx
git commit -m "refactor: extract driver-database state into useDriverDatabase hook + DriverDatabaseContext"
```

---

## Task 8: `useSignalProcessing` hook + `SignalProcessingContext`

**Files:**
- Create: `src/hooks/useSignalProcessing.ts`
- Create: `src/hooks/useSignalProcessing.test.ts`
- Create: `src/context/SignalProcessingContext.tsx`
- Modify: `src/App.tsx:741-763` (and wrap the new provider into the composition root)

**Interfaces:**
- Consumes: `EqFilter`, `RoomConfig`, `CabinConfig` from `../types` (Task 1); `loadSavedSession` from `../lib/session` (Task 2).
- Produces: `useSignalProcessingContext(): { filters: EqFilter[]; setFilters: React.Dispatch<React.SetStateAction<EqFilter[]>>; roomConfig: RoomConfig; setRoomConfig: React.Dispatch<React.SetStateAction<RoomConfig>>; roomDragging: {type:"speaker";idx:number}|{type:"listener"}|null; setRoomDragging: (d: {type:"speaker";idx:number}|{type:"listener"}|null) => void; cabinConfig: CabinConfig; setCabinConfig: React.Dispatch<React.SetStateAction<CabinConfig>> }`, `SignalProcessingProvider`.

Note: `roomDragging` stays in this hook rather than becoming local component state (as the design doc's default principle would suggest) because it needs to be read by both the floor-plan SVG editor (mouse-move handling) and the precise X/Y/Z number inputs elsewhere in the same tab — it's genuinely shared within the Signal tab, just not app-wide. `filters`/`setFilters` are kept as the raw `useState` setter (not wrapped in named `addFilter`/`removeFilter`/`updateFilter` actions) because that's how every call site in the JSX uses them today (`setFilters(prev => [...])`) — introducing named actions is a reasonable future cleanup but would mean rewriting call sites beyond what this task's "move verbatim" scope covers.

- [ ] **Step 1: Create `src/hooks/useSignalProcessing.ts`**

```tsx
import { useMemo, useState } from "react";
import { EqFilter, RoomConfig, CabinConfig } from "../types";
import { loadSavedSession } from "../lib/session";

export function useSignalProcessing() {
  const savedSession = useMemo(() => loadSavedSession(), []);

  const [filters, setFilters] = useState<EqFilter[]>(() => savedSession?.filters || []);

  const [roomConfig, setRoomConfig] = useState<RoomConfig>(() => savedSession?.roomConfig || {
    enabled: false,
    length: 5.0, width: 4.0, height: 2.5,
    speakers: [{ x: 0.5, y: 0.5, z: 0.9 }],
    listenerX: 2.0, listenerY: 3.5, listenerZ: 1.2,
    absorption: 0.15,
  });
  const [roomDragging, setRoomDragging] = useState<{ type: "speaker"; idx: number } | { type: "listener" } | null>(null);

  const [cabinConfig, setCabinConfig] = useState<CabinConfig>(() => savedSession?.cabinConfig || {
    enabled: false,
    fCabin: 60.0,
  });

  return { filters, setFilters, roomConfig, setRoomConfig, roomDragging, setRoomDragging, cabinConfig, setCabinConfig };
}
```

This is `App.tsx:741-763` moved verbatim.

- [ ] **Step 2: Write `src/hooks/useSignalProcessing.test.ts`**

```tsx
import { describe, it, expect, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useSignalProcessing } from "./useSignalProcessing";

describe("useSignalProcessing", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("defaults filters to an empty array with no saved session", () => {
    const { result } = renderHook(() => useSignalProcessing());
    expect(result.current.filters).toEqual([]);
  });

  it("adding a filter via setFilters appends to the array", () => {
    const { result } = renderHook(() => useSignalProcessing());
    act(() => {
      result.current.setFilters(prev => [...prev, { id: "f-1", enabled: true, type: "hp", freq: 80, q: 0.707, gain: 0 }]);
    });
    expect(result.current.filters).toHaveLength(1);
    expect(result.current.filters[0].id).toBe("f-1");
  });

  it("roomConfig defaults to disabled with one speaker", () => {
    const { result } = renderHook(() => useSignalProcessing());
    expect(result.current.roomConfig.enabled).toBe(false);
    expect(result.current.roomConfig.speakers).toHaveLength(1);
  });

  it("cabinConfig defaults to disabled at 60Hz", () => {
    const { result } = renderHook(() => useSignalProcessing());
    expect(result.current.cabinConfig.enabled).toBe(false);
    expect(result.current.cabinConfig.fCabin).toBe(60.0);
  });

  it("setCabinConfig updates fCabin", () => {
    const { result } = renderHook(() => useSignalProcessing());
    act(() => {
      result.current.setCabinConfig(prev => ({ ...prev, fCabin: 80 }));
    });
    expect(result.current.cabinConfig.fCabin).toBe(80);
  });
});
```

- [ ] **Step 3: Run the new tests**

Run: `npx vitest run src/hooks/useSignalProcessing.test.ts` — expect all PASS.

- [ ] **Step 4: Create `src/context/SignalProcessingContext.tsx`**

```tsx
import { createContext, ReactNode, useContext } from "react";
import { useSignalProcessing } from "../hooks/useSignalProcessing";

type SignalProcessingContextValue = ReturnType<typeof useSignalProcessing>;

const SignalProcessingContext = createContext<SignalProcessingContextValue | null>(null);

export function SignalProcessingProvider({ children }: { children: ReactNode }) {
  const value = useSignalProcessing();
  return <SignalProcessingContext.Provider value={value}>{children}</SignalProcessingContext.Provider>;
}

export function useSignalProcessingContext(): SignalProcessingContextValue {
  const ctx = useContext(SignalProcessingContext);
  if (!ctx) throw new Error("useSignalProcessingContext must be used within a SignalProcessingProvider");
  return ctx;
}
```

- [ ] **Step 5: Wire into `App.tsx`**

1. Delete `App.tsx:741-763` from `AppShell`.
2. Import: `import { SignalProcessingProvider, useSignalProcessingContext } from "./context/SignalProcessingContext";`
3. In `AppShell`: `const { filters, setFilters, roomConfig, setRoomConfig, roomDragging, setRoomDragging, cabinConfig, setCabinConfig } = useSignalProcessingContext();`
4. Update the composition root — per the nesting order, `SignalProcessingProvider` has no dependency on anything else and nests directly inside `ThemeProvider` (it doesn't need to be inside `ProjectsProvider`, which doesn't exist yet either — for now, place it as the innermost provider so far):

```tsx
export default function App() {
  return (
    <DriverDatabaseProvider>
      <ModalsProvider>
        <ThemeProvider>
          <SignalProcessingProvider>
            <AppShell />
          </SignalProcessingProvider>
        </ThemeProvider>
      </ModalsProvider>
    </DriverDatabaseProvider>
  );
}
```

- [ ] **Step 6: Verify**

Run: `npx tsc --noEmit --noUnusedLocals --noUnusedParameters` — expect clean.
Run: `npm run build` — expect clean.
Run: `npx vitest run` — expect all tests passing.

- [ ] **Step 7: Commit**

```bash
git add src/hooks/useSignalProcessing.ts src/hooks/useSignalProcessing.test.ts src/context/SignalProcessingContext.tsx src/App.tsx
git commit -m "refactor: extract EQ/room/cabin state into useSignalProcessing hook + SignalProcessingContext"
```

---

## Task 9: `useProjects` hook + `ProjectsContext`

**Files:**
- Create: `src/hooks/useProjects.ts`
- Create: `src/hooks/useProjects.test.ts`
- Create: `src/context/ProjectsContext.tsx`
- Modify: `src/App.tsx:480-617, 1468-1662` (and wrap the new provider into the composition root)

**Interfaces:**
- Consumes: `Project`, `Driver`, `CustomSideSpec`, `CustomPortSpec`, `CustomPRSpec` from `../types` (Task 1); `loadSavedSession` from `../lib/session` (Task 2); `useDriverDatabaseContext` from `../context/DriverDatabaseContext` (Task 7) — for `openDriverBrowser`; `useToast`, `useDialog` from `../components/ui` (existing).
- Produces: `useProjectsContext(): { projects: Project[]; activeProjectId: string; setActiveProjectId: (id: string) => void; activeProject: Project; canUndo: boolean; canRedo: boolean; undo: () => void; redo: () => void; setProjectsWithHistory: (p: Project[] | ((prev: Project[]) => Project[])) => void; updateActiveProject: (patch: Partial<Project>) => void; handleNewProject: () => Promise<void>; handleAddNewProject: () => void; handleDuplicateProject: (id: string) => void; handleRenameProject: (id: string) => Promise<void>; handleRemoveProject: (id: string) => void; handleSaveProject: () => Promise<void>; handleOpenProject: () => Promise<void> }`, `ProjectsProvider`.

Note: the six `updateCustomRear`/`updateCustomFront`/`updateCustomRearPort`/`updateCustomRearPR`/`updateCustomFrontPort`/`updateCustomFrontPR`/`updateCustomInternalPort` convenience wrappers (`App.tsx:543-616`) are **not** part of this hook's interface — they're pure thin wrappers around `updateActiveProject` + `activeProject.customTopology`, used only by the Custom Topology Builder JSX. They move to `EnclosureTab.tsx` in Task 15, defined locally there from `activeProject`/`updateActiveProject` (which `EnclosureTab` gets from this context). Keeping them out of `useProjects`'s return value keeps that interface focused on the actual data model rather than one UI region's convenience helpers.

- [ ] **Step 1: Create `src/hooks/useProjects.ts`**

```tsx
import { useMemo, useRef, useState } from "react";
import { open as openDialogFile, save as saveDialogFile } from "@tauri-apps/plugin-dialog";
import { invoke } from "@tauri-apps/api/core";
import { Project, DEFAULT_DRIVER } from "../types";
import { loadSavedSession } from "../lib/session";
import { useToast, useDialog } from "../components/ui";
import { useDriverDatabaseContext } from "../context/DriverDatabaseContext";

const PRESET_LINE_COLORS = [
  "#10b981", // Emerald
  "#06b6d4", // Cyan
  "#f43f5e", // Rose
  "#eab308", // Yellow
  "#6366f1", // Indigo
  "#f97316", // Orange
  "#ec4899", // Pink
  "#a855f7"  // Purple
];

const createDefaultProject = (id: string, name: string, color: string, driver?: Driver): Project => {
  const finalDriver = driver || DEFAULT_DRIVER;
  return {
    id,
    name: name || `${finalDriver.manufacturer} ${finalDriver.model}`,
    color,
    showOnGraph: true,
    driver: finalDriver,
    vBox: 150,
    enclosureType: "sealed",
    tuningFreq: 33,
    portDiameter: 10.0,
    portShape: "circular",
    portCount: 1,
    portWidth: 30.0,
    portHeight: 5.0,
    inputPower: 1,
    distance: 1,
    numDrivers: 1,
    vRear: 80,
    vFront: 40,
    frontTuningFreq: 55,
    rearTuningFreq: 30,
    frontPortDiameter: 10.0,
    rearPortDiameter: 10.0,
    internalPortDiameter: 10.0,
    prMms: 300,
    prSd: 1680,
    prFs: 25,
    prQms: 5.0,
    portQ: 50,
    splEnvironment: "half_space",
    customTopology: DEFAULT_CUSTOM,
    notes: "",
    driverConfig: "standard",
    port2Enabled: false,
    port2Count: 1,
    port2Diameter: 10.0,
    port2Shape: "circular",
    port2Width: 20.0,
    port2Height: 5.0,
    passiveXoEnabled: false,
    passiveXoType: "lowpass_1st",
    passiveXoInductance: 1.5, // 1.5 mH default
    passiveXoCapacitance: 47.0, // 47 uF default
    passiveXoDcr: 0.2, // 0.2 ohms inductor resistance default
  };
};

export function useProjects() {
  const toast = useToast();
  const { confirmDialog, promptDialog } = useDialog();
  const { openDriverBrowser } = useDriverDatabaseContext();

  const savedSession = useMemo(() => loadSavedSession(), []);

  const [projects, setProjects] = useState<Project[]>(() => {
    return savedSession?.projects || [createDefaultProject("project-1", "", PRESET_LINE_COLORS[0])];
  });
  const [activeProjectId, setActiveProjectId] = useState<string>(() => {
    return savedSession?.activeProjectId || "project-1";
  });

  const activeProject = useMemo(() => {
    return projects.find((p) => p.id === activeProjectId) || projects[0];
  }, [projects, activeProjectId]);

  // ── Undo / Redo ────────────────────────────────────────────────────────────
  const undoStackRef = useRef<Project[][]>([]);
  const redoStackRef = useRef<Project[][]>([]);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);

  const setProjectsWithHistory = (newProjects: Project[] | ((prev: Project[]) => Project[])) => {
    setProjects(prev => {
      const next = typeof newProjects === "function" ? newProjects(prev) : newProjects;
      undoStackRef.current.push(prev);
      if (undoStackRef.current.length > 20) undoStackRef.current.shift();
      redoStackRef.current = [];
      setCanUndo(true);
      setCanRedo(false);
      return next;
    });
  };

  const undo = () => {
    if (undoStackRef.current.length === 0) return;
    setProjects(prev => {
      const previous = undoStackRef.current[undoStackRef.current.length - 1];
      undoStackRef.current.pop();
      redoStackRef.current.push(prev);
      setCanUndo(undoStackRef.current.length > 0);
      setCanRedo(true);
      return previous;
    });
  };

  const redo = () => {
    if (redoStackRef.current.length === 0) return;
    setProjects(prev => {
      const next = redoStackRef.current[redoStackRef.current.length - 1];
      redoStackRef.current.pop();
      undoStackRef.current.push(prev);
      if (undoStackRef.current.length > 20) undoStackRef.current.shift();
      setCanUndo(true);
      setCanRedo(redoStackRef.current.length > 0);
      return next;
    });
  };

  const updateActiveProject = (patch: Partial<Project>) => {
    setProjectsWithHistory((prev) =>
      prev.map((p) => (p.id === activeProject.id ? { ...p, ...patch } : p))
    );
  };

  // Project Actions
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

  const handleAddNewProject = () => {
    openDriverBrowser((driver) => {
      const nextId = `project-${Date.now()}`;
      const nextColor = PRESET_LINE_COLORS[projects.length % PRESET_LINE_COLORS.length];
      const newProj = createDefaultProject(nextId, "", nextColor, driver);
      setProjectsWithHistory((prev) => [...prev, newProj]);
      setActiveProjectId(nextId);
    });
  };

  const handleDuplicateProject = (id: string) => {
    const source = projects.find((p) => p.id === id);
    if (!source) return;
    const nextId = `project-${Date.now()}`;
    const nextColor = PRESET_LINE_COLORS[projects.length % PRESET_LINE_COLORS.length];
    const duplicate: Project = {
      ...JSON.parse(JSON.stringify(source)),
      id: nextId,
      name: `${source.name} (Copy)`,
      color: nextColor,
    };
    setProjectsWithHistory((prev) => [...prev, duplicate]);
    setActiveProjectId(nextId);
  };

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

  const handleRemoveProject = (id: string) => {
    if (projects.length <= 1) return;
    const activeIdx = projects.findIndex((p) => p.id === id);
    const filtered = projects.filter((p) => p.id !== id);
    setProjectsWithHistory(filtered);
    if (activeProjectId === id) {
      const nextActive = filtered[Math.max(0, activeIdx - 1)];
      setActiveProjectId(nextActive.id);
    }
  };

  const handleSaveProject = async () => {
    try {
      const filePath = await saveDialogFile({
        filters: [{ name: "WinISD Project", extensions: ["wproj"] }],
        defaultPath: `${activeProject.name.replace(/\s+/g, "_")}.wproj`,
      });
      if (filePath) {
        await invoke("save_project", {
          path: filePath,
          state: {
            project_name: activeProject.name,
            notes: activeProject.notes,
            driver: activeProject.driver,
            v_box: activeProject.vBox,
            enclosure_type: activeProject.enclosureType,
            tuning_freq: activeProject.tuningFreq,
            port_diameter: activeProject.portDiameter,
            input_power: activeProject.inputPower,
            distance: activeProject.distance,
            num_drivers: activeProject.numDrivers,
            port_shape: activeProject.portShape,
            port_count: activeProject.portCount,
            port_width: activeProject.portWidth,
            port_height: activeProject.portHeight,
            v_rear: activeProject.vRear,
            v_front: activeProject.vFront,
            front_tuning_freq: activeProject.frontTuningFreq,
            rear_tuning_freq: activeProject.rearTuningFreq,
            front_port_diameter: activeProject.frontPortDiameter,
            rear_port_diameter: activeProject.rearPortDiameter,
            internal_port_diameter: activeProject.internalPortDiameter,
            pr_mms: activeProject.prMms,
            pr_sd: activeProject.prSd,
            pr_fs: activeProject.prFs,
            pr_qms: activeProject.prQms,
            port_q: activeProject.portQ,
            spl_environment: activeProject.splEnvironment,
            custom_topology: activeProject.customTopology,
            driver_config: activeProject.driverConfig,
            port2_enabled: activeProject.port2Enabled,
            port2_count: activeProject.port2Count,
            port2_diameter: activeProject.port2Diameter,
            port2_shape: activeProject.port2Shape,
            port2_width: activeProject.port2Width,
            port2_height: activeProject.port2Height,
            passive_xo_enabled: activeProject.passiveXoEnabled,
            passive_xo_type: activeProject.passiveXoType,
            passive_xo_inductance: activeProject.passiveXoInductance,
            passive_xo_capacitance: activeProject.passiveXoCapacitance,
            passive_xo_dcr: activeProject.passiveXoDcr,
          },
        });
        const name = filePath.split(/[/\\]/).pop() || "Project";
        const cleanName = name.replace(".wproj", "");
        updateActiveProject({ name: cleanName });
        toast.success("Project saved successfully!");
      }
    } catch (err) {
      toast.error("Error saving project: " + err);
    }
  };

  const handleOpenProject = async () => {
    try {
      const selected = await openDialogFile({
        filters: [{ name: "WinISD Project", extensions: ["wproj"] }],
        multiple: false,
      });
      if (selected && !Array.isArray(selected)) {
        const state: any = await invoke("load_project", { path: selected });

        const nextId = `project-${Date.now()}`;
        const nextColor = PRESET_LINE_COLORS[projects.length % PRESET_LINE_COLORS.length];
        const loadedProject: Project = {
          id: nextId,
          name: state.project_name || "Loaded Project",
          color: nextColor,
          showOnGraph: true,
          driver: state.driver || DEFAULT_DRIVER,
          vBox: state.v_box || 100,
          enclosureType: state.enclosure_type || "sealed",
          tuningFreq: state.tuning_freq || 33,
          portDiameter: state.port_diameter || 10.0,
          portShape: state.port_shape || "circular",
          portCount: state.port_count || 1,
          portWidth: state.port_width || 30.0,
          portHeight: state.port_height || 5.0,
          inputPower: state.input_power || 1,
          distance: state.distance || 1,
          numDrivers: state.num_drivers || 1,
          vRear: state.v_rear ?? 80,
          vFront: state.v_front ?? 40,
          frontTuningFreq: state.front_tuning_freq ?? 55,
          rearTuningFreq: state.rear_tuning_freq ?? 30,
          frontPortDiameter: state.front_port_diameter ?? 10.0,
          rearPortDiameter: state.rear_port_diameter ?? 10.0,
          internalPortDiameter: state.internal_port_diameter ?? 10.0,
          prMms: state.pr_mms ?? 300,
          prSd: state.pr_sd ?? 1680,
          prFs: state.pr_fs ?? 25,
          prQms: state.pr_qms ?? 5.0,
          portQ: state.port_q ?? 50,
          splEnvironment: state.spl_environment || "half_space",
          customTopology: state.custom_topology || DEFAULT_CUSTOM,
          notes: state.notes || "",
          driverConfig: state.driver_config || "standard",
          port2Enabled: state.port2_enabled ?? false,
          port2Count: state.port2_count ?? 1,
          port2Diameter: state.port2_diameter ?? 10.0,
          port2Shape: state.port2_shape || "circular",
          port2Width: state.port2_width ?? 20.0,
          port2Height: state.port2_height ?? 5.0,
          passiveXoEnabled: state.passive_xo_enabled ?? false,
          passiveXoType: state.passive_xo_type || "lowpass_1st",
          passiveXoInductance: state.passive_xo_inductance ?? 1.5,
          passiveXoCapacitance: state.passive_xo_capacitance ?? 47.0,
          passiveXoDcr: state.passive_xo_dcr ?? 0.2,
        };

        setProjectsWithHistory((prev) => [...prev, loadedProject]);
        setActiveProjectId(nextId);
        toast.success("Project loaded successfully!");
      }
    } catch (err) {
      toast.error("Error loading project: " + err);
    }
  };

  return {
    projects, activeProjectId, setActiveProjectId, activeProject,
    canUndo, canRedo, undo, redo, setProjectsWithHistory, updateActiveProject,
    handleNewProject, handleAddNewProject, handleDuplicateProject,
    handleRenameProject, handleRemoveProject, handleSaveProject, handleOpenProject,
  };
}
```

`DEFAULT_CUSTOM` (used by `createDefaultProject` and `handleOpenProject`'s fallback) and `DEFAULT_DRIVER` need to be importable — `DEFAULT_CUSTOM` currently lives at `App.tsx:68-72` and `DEFAULT_DRIVER` at `App.tsx:244-261`; neither moved in Tasks 1-4. Add both to `src/types.ts` in this task (append at the end of that file, exported), and delete them from `App.tsx`. Update the import in this hook file to `import { Project, Driver, DEFAULT_CUSTOM, DEFAULT_DRIVER } from "../types";` (also add `Driver` — `createDefaultProject`'s signature needs it).

Read `App.tsx:68-72` and `App.tsx:244-261` for their exact current content before moving (they haven't changed since Task 1's read).

- [ ] **Step 2: Write `src/hooks/useProjects.test.ts`**

```tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useProjects } from "./useProjects";

vi.mock("../context/DriverDatabaseContext", () => ({
  useDriverDatabaseContext: () => ({ openDriverBrowser: vi.fn() }),
}));

vi.mock("../components/ui", () => ({
  useToast: () => ({ success: vi.fn(), error: vi.fn() }),
  useDialog: () => ({ confirmDialog: vi.fn(), promptDialog: vi.fn() }),
}));

describe("useProjects", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("starts with one default project", () => {
    const { result } = renderHook(() => useProjects());
    expect(result.current.projects).toHaveLength(1);
    expect(result.current.activeProject.id).toBe(result.current.projects[0].id);
  });

  it("updateActiveProject merges a partial patch into the active project only", () => {
    const { result } = renderHook(() => useProjects());
    act(() => {
      result.current.updateActiveProject({ name: "Renamed" });
    });
    expect(result.current.activeProject.name).toBe("Renamed");
  });

  it("handleDuplicateProject adds a copy and makes it active", () => {
    const { result } = renderHook(() => useProjects());
    const originalCount = result.current.projects.length;
    act(() => {
      result.current.handleDuplicateProject(result.current.projects[0].id);
    });
    expect(result.current.projects).toHaveLength(originalCount + 1);
    expect(result.current.activeProject.name).toContain("(Copy)");
  });

  it("handleRemoveProject refuses to remove the last project", () => {
    const { result } = renderHook(() => useProjects());
    act(() => {
      result.current.handleRemoveProject(result.current.projects[0].id);
    });
    expect(result.current.projects).toHaveLength(1);
  });

  it("undo restores the previous projects state after updateActiveProject", () => {
    const { result } = renderHook(() => useProjects());
    const originalName = result.current.activeProject.name;
    act(() => {
      result.current.updateActiveProject({ name: "Changed" });
    });
    expect(result.current.activeProject.name).toBe("Changed");
    expect(result.current.canUndo).toBe(true);

    act(() => {
      result.current.undo();
    });
    expect(result.current.activeProject.name).toBe(originalName);
    expect(result.current.canRedo).toBe(true);
  });

  it("redo re-applies an undone change", () => {
    const { result } = renderHook(() => useProjects());
    act(() => {
      result.current.updateActiveProject({ name: "Changed" });
    });
    act(() => {
      result.current.undo();
    });
    act(() => {
      result.current.redo();
    });
    expect(result.current.activeProject.name).toBe("Changed");
  });
});
```

- [ ] **Step 3: Run the new tests**

Run: `npx vitest run src/hooks/useProjects.test.ts` — expect all PASS. If `useToast`/`useDialog`/`useDriverDatabaseContext` mocks don't match their real export shapes exactly, the test file will fail to compile — check `src/components/ui/index.ts` and `src/context/DriverDatabaseContext.tsx` (from Task 7) for their real signatures if so, and correct the mocks (not the hook).

- [ ] **Step 4: Create `src/context/ProjectsContext.tsx`**

```tsx
import { createContext, ReactNode, useContext } from "react";
import { useProjects } from "../hooks/useProjects";

type ProjectsContextValue = ReturnType<typeof useProjects>;

const ProjectsContext = createContext<ProjectsContextValue | null>(null);

export function ProjectsProvider({ children }: { children: ReactNode }) {
  const value = useProjects();
  return <ProjectsContext.Provider value={value}>{children}</ProjectsContext.Provider>;
}

export function useProjectsContext(): ProjectsContextValue {
  const ctx = useContext(ProjectsContext);
  if (!ctx) throw new Error("useProjectsContext must be used within a ProjectsProvider");
  return ctx;
}
```

- [ ] **Step 5: Wire into `App.tsx`**

1. Delete `App.tsx:480-541` (session read, projects/activeProjectId state, `activeProject`, undo/redo, `setProjectsWithHistory`, `updateActiveProject`) and `App.tsx:1468-1662` (the seven project-action handlers) from `AppShell`. **Do not delete** `App.tsx:543-616` (the `updateCustomRear*`/`updateCustomFront*` wrappers) — those stay in `AppShell` for now (they'll move to `EnclosureTab.tsx` in Task 15) and now read `activeProject`/`updateActiveProject` from the context instead of local scope — no code change needed in those seven functions themselves, only in where `activeProject`/`updateActiveProject` come from.
2. Also delete the standalone `PRESET_LINE_COLORS` array and `createDefaultProject` function from `App.tsx` if they're not otherwise referenced there — `grep -n "PRESET_LINE_COLORS\|createDefaultProject" src/App.tsx` after this task's other edits to confirm.
3. Import: `import { ProjectsProvider, useProjectsContext } from "./context/ProjectsContext";`
4. In `AppShell`: `const { projects, activeProjectId, setActiveProjectId, activeProject, canUndo, canRedo, undo, redo, setProjectsWithHistory, updateActiveProject, handleNewProject, handleAddNewProject, handleDuplicateProject, handleRenameProject, handleRemoveProject, handleSaveProject, handleOpenProject } = useProjectsContext();`
5. Update the composition root — `ProjectsProvider` must be inside `DriverDatabaseProvider` (dependency) and inside `ModalsProvider`/`ThemeProvider` (no ordering requirement between them, keep current order), and — per the target nesting order — outside `SignalProcessingProvider`:

```tsx
export default function App() {
  return (
    <DriverDatabaseProvider>
      <ModalsProvider>
        <ThemeProvider>
          <ProjectsProvider>
            <SignalProcessingProvider>
              <AppShell />
            </SignalProcessingProvider>
          </ProjectsProvider>
        </ThemeProvider>
      </ModalsProvider>
    </DriverDatabaseProvider>
  );
}
```

- [ ] **Step 6: Verify**

Run: `npx tsc --noEmit --noUnusedLocals --noUnusedParameters` — expect clean.
Run: `npm run build` — expect clean.
Run: `npx vitest run` — expect all tests passing.

- [ ] **Step 7: Commit**

```bash
git add src/hooks/useProjects.ts src/hooks/useProjects.test.ts src/context/ProjectsContext.tsx src/types.ts src/App.tsx
git commit -m "refactor: extract project CRUD + undo/redo into useProjects hook + ProjectsContext"
```

---

## Task 10: `useGraphViewport` hook + `GraphViewportContext`

**Files:**
- Create: `src/hooks/useGraphViewport.ts`
- Create: `src/hooks/useGraphViewport.test.ts`
- Create: `src/context/GraphViewportContext.tsx`
- Modify: `src/App.tsx:618-621, 626-707, 761-762, 1040-1045, 1028-1038, 2189-2197` (and wrap the new provider into the composition root)

**Interfaces:**
- Consumes: `CurveType`, `GraphViewportConfig` from `../types` (Task 1); `loadSavedSession` from `../lib/session` (Task 2); `useModalsContext` from `../context/ModalsContext` (Task 6) — for `showSettings`.
- Produces: `useGraphViewportContext(): { visibleGraphs: CurveType[]; setVisibleGraphs: (g: CurveType[]) => void; dashboardContainerRef: React.RefObject<HTMLDivElement>; dashboardWidth: number; graphHeights: Record<CurveType, number>; handleResizeStart: (e: React.MouseEvent, mode: CurveType) => void; graphConfigs: Record<CurveType, GraphViewportConfig>; updateViewportConfig: (curve: CurveType, key: keyof GraphViewportConfig, value: any) => void; globalXMin: number; setGlobalXMin: (v: number) => void; globalXMax: number; setGlobalXMax: (v: number) => void; overrideXLimits: Record<CurveType, boolean>; setOverrideXLimits: React.Dispatch<React.SetStateAction<Record<CurveType, boolean>>>; getGraphXLimits: (mode: CurveType) => { xMin: number; xMax: number }; configEditType: CurveType; setConfigEditType: (t: CurveType) => void; rulerFreq: number | null; setRulerFreq: (f: number | null) => void }`, `GraphViewportProvider`.

Note: `showExportMenu` and the export handlers (`handleExportSVG`/`handleExportPNG`/`handleExportSummary`) are **not** part of this hook, even though they're dashboard/toolbar-adjacent — `handleExportSummary` needs `systemStats`, which is computed in `useSimulation` (Task 11), and `useSimulation` itself needs `visibleGraphs`/`graphConfigs` from this hook. Putting the export handlers here would make `useGraphViewport` depend on `useSimulation` while `useSimulation` depends on `useGraphViewport` — a cycle. They move into `useSimulation` instead (Task 11), which can depend on this hook one-directionally.

`showDropdown` (the "Configure Graphs" dropdown's open/closed flag, `App.tsx:623`) is also **not** part of this hook — it's used at exactly one JSX call site (the dashboard header) and becomes local `useState` inside `Toolbar.tsx` in Task 17, per the "not everything global" principle.

`isDraggingRuler` (`App.tsx:763`) likewise stays out — it becomes local state inside `GraphPanel.tsx` (Task 18), where the ruler-drag mouse handling lives.

- [ ] **Step 1: Create `src/hooks/useGraphViewport.ts`**

```tsx
import { useEffect, useMemo, useRef, useState } from "react";
import { CurveType, GraphViewportConfig } from "../types";
import { loadSavedSession } from "../lib/session";
import { useModalsContext } from "../context/ModalsContext";

export function useGraphViewport() {
  const { showSettings } = useModalsContext();
  const savedSession = useMemo(() => loadSavedSession(), []);

  // Stacked Multi-Graph Dashboard States
  const [visibleGraphs, setVisibleGraphs] = useState<CurveType[]>(() => {
    return savedSession?.visibleGraphs || ["transfer", "spl"];
  });

  // Responsive & Resizable Heights properties
  const dashboardContainerRef = useRef<HTMLDivElement>(null);
  const [dashboardWidth, setDashboardWidth] = useState(800);
  const [graphHeights, setGraphHeights] = useState<Record<CurveType, number>>(() => {
    return savedSession?.graphHeights || {
      transfer: 250,
      spl: 250,
      excursion: 250,
      velocity: 250,
      impedance: 250,
      phase: 250,
      group_delay: 250,
    };
  });

  const handleResizeStart = (e: React.MouseEvent, mode: CurveType) => {
    e.preventDefault();
    const startY = e.clientY;
    const startHeight = graphHeights[mode];

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const deltaY = moveEvent.clientY - startY;
      setGraphHeights((prev) => ({
        ...prev,
        [mode]: Math.max(150, Math.min(600, startHeight + deltaY)),
      }));
    };

    const handleMouseUp = () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
  };

  // Viewport Configuration Limits per Graph Mode
  const [graphConfigs, setGraphConfigs] = useState<Record<CurveType, GraphViewportConfig>>(() => {
    const defaults: Record<CurveType, GraphViewportConfig> = {
      transfer:    { xMin: 10, xMax: 2000, yMin: -30,  yMax: 10,  autoScaleY: true  },
      spl:         { xMin: 10, xMax: 2000, yMin: 60,   yMax: 140, autoScaleY: true  },
      excursion:   { xMin: 10, xMax: 2000, yMin: 0,    yMax: 25,  autoScaleY: true  },
      velocity:    { xMin: 10, xMax: 2000, yMin: 0,    yMax: 40,  autoScaleY: true  },
      impedance:   { xMin: 10, xMax: 2000, yMin: 0,    yMax: 80,  autoScaleY: true  },
      phase:       { xMin: 10, xMax: 2000, yMin: -360, yMax: 45,  autoScaleY: false },
      group_delay: { xMin: 10, xMax: 2000, yMin: 0,    yMax: 100, autoScaleY: true  },
    };
    return { ...defaults, ...(savedSession?.graphConfigs || {}) };
  });

  const updateViewportConfig = (curve: CurveType, key: keyof GraphViewportConfig, value: any) => {
    setGraphConfigs((prev) => ({
      ...prev,
      [curve]: {
        ...prev[curve],
        [key]: value,
      },
    }));
  };

  // Global X-axis limits configuration states
  const [globalXMin, setGlobalXMin] = useState<number>(() => savedSession?.globalXMin || 10);
  const [globalXMax, setGlobalXMax] = useState<number>(() => savedSession?.globalXMax || 2000);
  const [overrideXLimits, setOverrideXLimits] = useState<Record<CurveType, boolean>>(() => {
    return savedSession?.overrideXLimits || {
      transfer: false,
      spl: false,
      excursion: false,
      velocity: false,
      impedance: false,
    };
  });

  const getGraphXLimits = (mode: CurveType) => {
    if (overrideXLimits[mode]) {
      return {
        xMin: graphConfigs[mode].xMin,
        xMax: graphConfigs[mode].xMax,
      };
    }
    return {
      xMin: globalXMin,
      xMax: globalXMax,
    };
  };

  // Settings sub-tab selection for editing limits
  const [configEditType, setConfigEditType] = useState<CurveType>("transfer");

  // Draggable Ruler State
  const [rulerFreq, setRulerFreq] = useState<number | null>(() => savedSession?.rulerFreq || null);

  // Monitor dashboard container width to make graphs fully responsive
  useEffect(() => {
    if (!dashboardContainerRef.current) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setDashboardWidth(Math.max(400, entry.contentRect.width - 24));
      }
    });
    observer.observe(dashboardContainerRef.current);
    return () => observer.disconnect();
  }, []);

  // Synchronize calibration dropdown in settings with active graph view when settings opens
  useEffect(() => {
    if (showSettings && visibleGraphs.length > 0) {
      setConfigEditType(visibleGraphs[0]);
    }
  }, [showSettings, visibleGraphs]);

  return {
    visibleGraphs, setVisibleGraphs,
    dashboardContainerRef, dashboardWidth, graphHeights, handleResizeStart,
    graphConfigs, updateViewportConfig,
    globalXMin, setGlobalXMin, globalXMax, setGlobalXMax, overrideXLimits, setOverrideXLimits,
    getGraphXLimits, configEditType, setConfigEditType,
    rulerFreq, setRulerFreq,
  };
}
```

This is `App.tsx:619-621` (`visibleGraphs`), `App.tsx:627-661` (resize state/ref/handler), `App.tsx:664-701` (`graphConfigs`/`updateViewportConfig` — note `updateViewportConfig` itself is currently at `App.tsx:2189-2197`, near the very end of the logic section; move it up alongside `graphConfigs` here since it operates on that same state), `App.tsx:678-700` (X-axis limits + `getGraphXLimits`), `App.tsx:707` (`configEditType`), `App.tsx:762` (`rulerFreq`), `App.tsx:1028-1038` (the `ResizeObserver` effect), and `App.tsx:1040-1045` (the settings-sync effect) — moved verbatim, reassembled into one hook.

Note one behavior-preserving adjustment: the original `overrideXLimits` default object only has 5 keys (`transfer`, `spl`, `excursion`, `velocity`, `impedance` — missing `phase`/`group_delay`/`impedance`'s sibling curve types that were added later). Do not "fix" this while moving it — copy the object exactly as it reads today, missing keys and all; if code elsewhere indexes a key this object doesn't have, that's pre-existing behavior, not something this task's move should change.

- [ ] **Step 2: Write `src/hooks/useGraphViewport.test.ts`**

```tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useGraphViewport } from "./useGraphViewport";

vi.mock("../context/ModalsContext", () => ({
  useModalsContext: () => ({ showSettings: false }),
}));

describe("useGraphViewport", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("defaults visibleGraphs to transfer + spl", () => {
    const { result } = renderHook(() => useGraphViewport());
    expect(result.current.visibleGraphs).toEqual(["transfer", "spl"]);
  });

  it("getGraphXLimits returns global limits when override is off", () => {
    const { result } = renderHook(() => useGraphViewport());
    const limits = result.current.getGraphXLimits("transfer");
    expect(limits.xMin).toBe(result.current.globalXMin);
    expect(limits.xMax).toBe(result.current.globalXMax);
  });

  it("getGraphXLimits returns per-curve limits when override is on", () => {
    const { result } = renderHook(() => useGraphViewport());
    act(() => {
      result.current.setOverrideXLimits(prev => ({ ...prev, transfer: true }));
      result.current.updateViewportConfig("transfer", "xMin", 40);
    });
    const limits = result.current.getGraphXLimits("transfer");
    expect(limits.xMin).toBe(40);
  });

  it("updateViewportConfig only mutates the targeted curve's config", () => {
    const { result } = renderHook(() => useGraphViewport());
    const splBefore = result.current.graphConfigs.spl;
    act(() => {
      result.current.updateViewportConfig("transfer", "yMax", 20);
    });
    expect(result.current.graphConfigs.transfer.yMax).toBe(20);
    expect(result.current.graphConfigs.spl).toEqual(splBefore);
  });
});
```

- [ ] **Step 3: Run the new tests**

Run: `npx vitest run src/hooks/useGraphViewport.test.ts` — expect all PASS.

- [ ] **Step 4: Create `src/context/GraphViewportContext.tsx`**

```tsx
import { createContext, ReactNode, useContext } from "react";
import { useGraphViewport } from "../hooks/useGraphViewport";

type GraphViewportContextValue = ReturnType<typeof useGraphViewport>;

const GraphViewportContext = createContext<GraphViewportContextValue | null>(null);

export function GraphViewportProvider({ children }: { children: ReactNode }) {
  const value = useGraphViewport();
  return <GraphViewportContext.Provider value={value}>{children}</GraphViewportContext.Provider>;
}

export function useGraphViewportContext(): GraphViewportContextValue {
  const ctx = useContext(GraphViewportContext);
  if (!ctx) throw new Error("useGraphViewportContext must be used within a GraphViewportProvider");
  return ctx;
}
```

- [ ] **Step 5: Wire into `App.tsx`**

1. Delete `App.tsx:618-621` (`visibleGraphs`), `App.tsx:626-701` (resize/graphConfigs/X-limits state and handlers), `App.tsx:707` (`configEditType`), `App.tsx:762` (`rulerFreq`), `App.tsx:1028-1045` (the two effects), and `App.tsx:2189-2197` (`updateViewportConfig`, now moved up into the hook) from `AppShell`.
2. Import: `import { GraphViewportProvider, useGraphViewportContext } from "./context/GraphViewportContext";`
3. In `AppShell`: `const { visibleGraphs, setVisibleGraphs, dashboardContainerRef, dashboardWidth, graphHeights, handleResizeStart, graphConfigs, updateViewportConfig, globalXMin, setGlobalXMin, globalXMax, setGlobalXMax, overrideXLimits, setOverrideXLimits, getGraphXLimits, configEditType, setConfigEditType, rulerFreq, setRulerFreq } = useGraphViewportContext();`
4. Update the composition root — `GraphViewportProvider` must be inside `ModalsProvider` (dependency) and, per the target order, inside `ProjectsProvider`/`SignalProcessingProvider` too (so `SimulationProvider`, added in Task 11, can nest inside all three):

```tsx
export default function App() {
  return (
    <DriverDatabaseProvider>
      <ModalsProvider>
        <ThemeProvider>
          <ProjectsProvider>
            <SignalProcessingProvider>
              <GraphViewportProvider>
                <AppShell />
              </GraphViewportProvider>
            </SignalProcessingProvider>
          </ProjectsProvider>
        </ThemeProvider>
      </ModalsProvider>
    </DriverDatabaseProvider>
  );
}
```

- [ ] **Step 6: Verify**

Run: `npx tsc --noEmit --noUnusedLocals --noUnusedParameters` — expect clean.
Run: `npm run build` — expect clean.
Run: `npx vitest run` — expect all tests passing.

- [ ] **Step 7: Commit**

```bash
git add src/hooks/useGraphViewport.ts src/hooks/useGraphViewport.test.ts src/context/GraphViewportContext.tsx src/App.tsx
git commit -m "refactor: extract graph viewport/config state into useGraphViewport hook + GraphViewportContext"
```

---

## Task 11: `useSimulation` hook + `SimulationContext`

**Files:**
- Create: `src/hooks/useSimulation.ts`
- Create: `src/context/SimulationContext.tsx`
- Modify: `src/App.tsx:704, 765-928, 1080-1176, 1665-1996, 1998-2125` (and wrap the new provider into the composition root)

**Interfaces:**
- Consumes: `CurveType`, `SimPoint` from `../types` (Task 1); `findLFCrossover` from `../lib/calculations` (Task 3); `useProjectsContext` (Task 9), `useGraphViewportContext` (Task 10), `useSignalProcessingContext` (Task 8); `useToast`, `useDialog` from `../components/ui`.
- Produces: `useSimulationContext(): { simulationResults: Record<string, Record<CurveType, SimPoint[]>>; calculatedPortLength: number; kaWarningFreq: number; systemStats: {label:string;value:string;accent?:boolean;warn?:boolean;danger?:boolean;fullWidth?:boolean}[]; getDisplayValue: (mode: CurveType, freq: number, rawVal: number) => number; phaseGdData: Record<string, {phase: SimPoint[]; group_delay: SimPoint[]}>; handleAutoCalculatePort: () => Promise<void>; handleApplyAlignment: (alignmentPref: "maximally_flat" | "extended_bass" | "boomy") => Promise<void>; svgRefsMap: React.RefObject<Map<CurveType, SVGSVGElement>>; showExportMenu: CurveType | null; setShowExportMenu: (m: CurveType | null) => void; handleExportSVG: (mode: CurveType) => Promise<void>; handleExportPNG: (mode: CurveType) => Promise<void>; handleExportSummary: () => Promise<void> }`, `SimulationProvider`.

This is the plan's most cross-cutting hook — it reads from three other contexts internally rather than receiving them as props, exactly as the design doc specifies. No test file for this one: it's almost entirely `invoke()` calls (mockable but not meaningfully so without a fuller Tauri test harness) and large derived `useMemo`s over `activeProject`/`simulationResults` shapes that are already covered indirectly by `lib/calculations.ts`'s tests for the pure math they call into (`findLFCrossover`, filter/room functions). Adding hook tests here would mean re-implementing a fake Tauri `invoke` and a full `Project` fixture for little additional confidence — flagged as a reasonable gap, not silently skipped.

- [ ] **Step 1: Create `src/hooks/useSimulation.ts`**

```tsx
import { useMemo, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { save as saveDialogFile } from "@tauri-apps/plugin-dialog";
import { openPath } from "@tauri-apps/plugin-opener";
import { CurveType, SimPoint } from "../types";
import { findLFCrossover, computeRoomCorrection, totalFilterGainDb } from "../lib/calculations";
import { useToast, useDialog } from "../components/ui";
import { useProjectsContext } from "../context/ProjectsContext";
import { useGraphViewportContext } from "../context/GraphViewportContext";
import { useSignalProcessingContext } from "../context/SignalProcessingContext";

export function useSimulation() {
  const toast = useToast();
  const { confirmDialog } = useDialog();
  const { activeProject, activeProjectId, projects, updateActiveProject } = useProjectsContext();
  const { visibleGraphs, graphConfigs, globalXMin, globalXMax, overrideXLimits, getGraphXLimits } = useGraphViewportContext();
  const { filters, roomConfig, cabinConfig } = useSignalProcessingContext();

  // Simulation Points Map Keyed by Project ID
  const [simulationResults, setSimulationResults] = useState<Record<string, Record<CurveType, SimPoint[]>>>({});

  // Run simulation for all comparison projects in parallel
  useEffect(() => {
    async function runAllSims() {
      try {
        const newResults: Record<string, Record<CurveType, SimPoint[]>> = {};
        await Promise.all(
          projects.map(async (project) => {
            const projectResults = {} as Record<CurveType, SimPoint[]>;
            // Phase and group_delay are derived in TypeScript from the transfer curve.
            // Ensure "transfer" is simulated whenever either derived mode is visible.
            const backendModes: CurveType[] = [
              ...new Set(
                visibleGraphs.map(m => (m === "phase" || m === "group_delay") ? "transfer" as CurveType : m)
              ),
            ];
            await Promise.all(
              backendModes.map(async (mode) => {
                const { xMin: fMin, xMax: fMax } = getGraphXLimits(mode);
                let result: SimPoint[];

                if (project.enclosureType === "custom") {
                  result = await invoke("simulate_custom", {
                    driver: project.driver,
                    customTopology: project.customTopology,
                    inputPower: parseFloat(String(project.inputPower)) || 1.0,
                    distance: parseFloat(String(project.distance)) || 1.0,
                    numDrivers: parseInt(String(project.numDrivers)) || 1,
                    curveType: mode,
                    fMin,
                    fMax,
                    portQ: project.portQ,
                    splEnvironment: project.splEnvironment,
                    driverConfig: project.driverConfig,
                    passiveXoEnabled: project.passiveXoEnabled,
                    passiveXoType: project.passiveXoType,
                    passiveXoInductance: parseFloat(String(project.passiveXoInductance)) || 0.0,
                    passiveXoCapacitance: parseFloat(String(project.passiveXoCapacitance)) || 0.0,
                    passiveXoDcr: parseFloat(String(project.passiveXoDcr)) || 0.0,
                  });
                } else {
                  result = await invoke("simulate_system", {
                    driver: project.driver,
                    vBox: parseFloat(String(project.vBox)) || 1.0,
                    enclosureType: project.enclosureType,
                    tuningFreq: parseFloat(String(project.tuningFreq)) || 1.0,
                    portDiameter: parseFloat(String(project.portDiameter)) || 10.0,
                    inputPower: parseFloat(String(project.inputPower)) || 1.0,
                    distance: parseFloat(String(project.distance)) || 1.0,
                    numDrivers: parseInt(String(project.numDrivers)) || 1,
                    curveType: mode,
                    fMin,
                    fMax,
                    portShape: project.portShape,
                    portCount: parseInt(String(project.portCount)) || 1,
                    portWidth: parseFloat(String(project.portWidth)) || 10.0,
                    portHeight: parseFloat(String(project.portHeight)) || 10.0,
                    vRear: parseFloat(String(project.vRear)) || 80.0,
                    vFront: parseFloat(String(project.vFront)) || 40.0,
                    frontTuningFreq: parseFloat(String(project.frontTuningFreq)) || 55.0,
                    rearTuningFreq: parseFloat(String(project.rearTuningFreq)) || 30.0,
                    frontPortDiameter: parseFloat(String(project.frontPortDiameter)) || 10.0,
                    rearPortDiameter: parseFloat(String(project.rearPortDiameter)) || 10.0,
                    internalPortDiameter: parseFloat(String(project.internalPortDiameter)) || 10.0,
                    prMms: parseFloat(String(project.prMms)) || 300.0,
                    prSd: parseFloat(String(project.prSd)) || 1680.0,
                    prFs: parseFloat(String(project.prFs)) || 25.0,
                    prQms: parseFloat(String(project.prQms)) || 5.0,
                    portQ: project.portQ,
                    splEnvironment: project.splEnvironment,
                    driverConfig: project.driverConfig,
                    port2Enabled: project.port2Enabled,
                    port2Count: parseInt(String(project.port2Count)) || 1,
                    port2Diameter: parseFloat(String(project.port2Diameter)) || 10.0,
                    port2Shape: project.port2Shape,
                    port2Width: parseFloat(String(project.port2Width)) || 20.0,
                    port2Height: parseFloat(String(project.port2Height)) || 5.0,
                    passiveXoEnabled: project.passiveXoEnabled,
                    passiveXoType: project.passiveXoType,
                    passiveXoInductance: parseFloat(String(project.passiveXoInductance)) || 0.0,
                    passiveXoCapacitance: parseFloat(String(project.passiveXoCapacitance)) || 0.0,
                    passiveXoDcr: parseFloat(String(project.passiveXoDcr)) || 0.0,
                  });
                }
                projectResults[mode] = result;
              })
            );
            newResults[project.id] = projectResults;
          })
        );
        setSimulationResults(newResults);
      } catch (err) {
        console.error("Simulation failed:", err);
      }
    }
    if (projects.length > 0 && visibleGraphs.length > 0) {
      runAllSims();
    }
  }, [projects, visibleGraphs, graphConfigs, globalXMin, globalXMax, overrideXLimits]);

  // ... calculatedPortLength, kaWarningFreq, systemStats, filterGainFn, roomCorrectionFn,
  // filterLinearFn, cabinGainFn, getDisplayValue, phaseGdData, handleAutoCalculatePort,
  // handleApplyAlignment, svgRefsMap, resolveSvgStyle, showExportMenu, handleExportSVG,
  // handleExportPNG, handleExportSummary go here — see Step 1b below.

  return {
    simulationResults, calculatedPortLength, kaWarningFreq, systemStats, getDisplayValue, phaseGdData,
    handleAutoCalculatePort, handleApplyAlignment,
    svgRefsMap, showExportMenu, setShowExportMenu, handleExportSVG, handleExportPNG, handleExportSummary,
  };
}
```

Add `import { useEffect } from "react";` alongside the existing React imports (the run-simulation effect needs it).

- [ ] **Step 1b: Fill in the remaining body, moved verbatim from `App.tsx`, in this order (insert between the run-simulation effect and the `return` statement above)**

From `App.tsx:1665-1708` (`calculatedPortLength`, `kaWarningFreq`) — moved verbatim, unchanged (both close over `activeProject` only, which this hook already has from `useProjectsContext`).

From `App.tsx:1712-1875` (`systemStats`) — moved verbatim. It closes over `activeProject`, `activeProjectId`, `simulationResults` (all in scope) and calls `findLFCrossover` (imported from `lib/calculations`).

From `App.tsx:1878-1933` (`filterGainFn`, `roomCorrectionFn`, `filterLinearFn`, `cabinGainFn`, `getDisplayValue`) — moved verbatim. These close over `filters`/`roomConfig`/`cabinConfig` (from `useSignalProcessingContext`, already in scope) and call `totalFilterGainDb`/`computeRoomCorrection` (imported from `lib/calculations`). Note: `getDisplayValue` currently uses `useCallback` — keep that.

From `App.tsx:1937-1973` (`phaseGdData`) — moved verbatim, closes over `projects`/`simulationResults` (in scope).

From `App.tsx:1976-1996` (`handleAutoCalculatePort`) — moved verbatim, closes over `activeProject`/`updateActiveProject` (from `useProjectsContext`) and `toast` (in scope).

From `App.tsx:1998-2125` (`handleApplyAlignment`) — moved with **one signature change**: the original is `const handleApplyAlignment = async () => { ... }`, reading `alignmentPref` from the enclosing `App` component's local state. That state (the Auto-Align radio-button preference) moves to `EnclosureTab.tsx`'s own local `useState` in Task 15, not into this hook — it's UI-only preference state with exactly one consumer. Change the signature to accept it as a parameter:

```tsx
const handleApplyAlignment = async (alignmentPref: "maximally_flat" | "extended_bass" | "boomy") => {
  // ...body identical to App.tsx:1999-2124, just remove `alignmentPref` from
  // the closure (it's a parameter now, not a captured variable — every
  // reference to `alignmentPref` inside the body reads the same way).
};
```

Everything else in the body (the enclosure-type branching, the `updateActiveProject` calls, the trailing `auto_calculate_port` follow-up) is unchanged — read `App.tsx:1998-2125` for the exact body to copy, only the function's own signature line changes.

From `App.tsx:765-928` (`svgRefsMap`, `resolveSvgStyle`, `handleExportSVG`, `handleExportPNG`, `handleExportSummary`) and `App.tsx:767` (`showExportMenu` state) — moved verbatim. `handleExportSummary` closes over `systemStats` (now in scope, computed above in this same hook), `filters` (from `useSignalProcessingContext`), and `activeProject` (from `useProjectsContext`) — all already available. `resolveSvgStyle` is a local helper only `handleExportSVG`/`handleExportPNG` call — keep it un-exported (not part of the hook's returned interface).

- [ ] **Step 2: Verify manually against `App.tsx`**

This hook is large and assembled from several non-contiguous regions — after writing it, read the finished `src/hooks/useSimulation.ts` back and check every function it exports is present, and that no function references a variable that isn't either a local declaration, a value from `useProjectsContext`/`useGraphViewportContext`/`useSignalProcessingContext`, or an import. `tsc` will catch a missing/misspelled reference as a compile error in the next step, but read it once yourself first — this is the highest-risk single file in this plan.

- [ ] **Step 3: Create `src/context/SimulationContext.tsx`**

```tsx
import { createContext, ReactNode, useContext } from "react";
import { useSimulation } from "../hooks/useSimulation";

type SimulationContextValue = ReturnType<typeof useSimulation>;

const SimulationContext = createContext<SimulationContextValue | null>(null);

export function SimulationProvider({ children }: { children: ReactNode }) {
  const value = useSimulation();
  return <SimulationContext.Provider value={value}>{children}</SimulationContext.Provider>;
}

export function useSimulationContext(): SimulationContextValue {
  const ctx = useContext(SimulationContext);
  if (!ctx) throw new Error("useSimulationContext must be used within a SimulationProvider");
  return ctx;
}
```

- [ ] **Step 4: Wire into `App.tsx`**

1. Delete `App.tsx:704` (`simulationResults`), `App.tsx:765-928` (SVG export refs/helpers), `App.tsx:1080-1176` (run-simulation effect), and `App.tsx:1665-2125` (`calculatedPortLength` through `handleApplyAlignment`) from `AppShell`.
2. Import: `import { SimulationProvider, useSimulationContext } from "./context/SimulationContext";`
3. In `AppShell`: `const { simulationResults, calculatedPortLength, kaWarningFreq, systemStats, getDisplayValue, phaseGdData, handleAutoCalculatePort, handleApplyAlignment, svgRefsMap, showExportMenu, setShowExportMenu, handleExportSVG, handleExportPNG, handleExportSummary } = useSimulationContext();`
4. Every remaining call site of `handleApplyAlignment` in `App.tsx`'s still-inline JSX (the Auto-Align button) must now pass `alignmentPref` explicitly: change `onClick={handleApplyAlignment}` to `onClick={() => handleApplyAlignment(alignmentPref)}` (where `alignmentPref`/`setAlignmentPref` — `App.tsx:624` — stays as local `AppShell` state for now; it moves to `EnclosureTab.tsx` in Task 15 alongside the rest of that tab's JSX). Find this call site with `grep -n "handleApplyAlignment" src/App.tsx`.
5. Update the composition root — `SimulationProvider` nests inside `ProjectsProvider`, `SignalProcessingProvider`, and `GraphViewportProvider` (all three dependencies), as the innermost provider:

```tsx
export default function App() {
  return (
    <DriverDatabaseProvider>
      <ModalsProvider>
        <ThemeProvider>
          <ProjectsProvider>
            <SignalProcessingProvider>
              <GraphViewportProvider>
                <SimulationProvider>
                  <AppShell />
                </SimulationProvider>
              </GraphViewportProvider>
            </SignalProcessingProvider>
          </ProjectsProvider>
        </ThemeProvider>
      </ModalsProvider>
    </DriverDatabaseProvider>
  );
}
```

This completes the app-root provider stack (matches the Provider nesting order table in full).

- [ ] **Step 5: Verify**

Run: `npx tsc --noEmit --noUnusedLocals --noUnusedParameters` — expect clean.
Run: `npm run build` — expect clean.
Run: `npx vitest run` — expect all tests passing.

- [ ] **Step 6: Commit**

```bash
git add src/hooks/useSimulation.ts src/context/SimulationContext.tsx src/App.tsx
git commit -m "refactor: extract simulation/derived-stats/export state into useSimulation hook + SimulationContext"
```

---

## Task 12: `useDriverForm` hook + `DriverFormContext` (scoped to the Add/Edit Driver modal)

**Files:**
- Create: `src/hooks/useDriverForm.ts`
- Create: `src/hooks/useDriverForm.test.ts`
- Create: `src/context/DriverFormContext.tsx`
- Modify: `src/App.tsx:930, 941 (n/a — already moved), 946-965, 1069-1077, 1179-1465, 2127-2149` (and wrap `DriverFormProvider` around the still-inline Add Driver Modal JSX block)

**Interfaces:**
- Consumes: `Driver` from `../types` (Task 1); `cmsFromVasSd`, `mmsKgFromFsCms`, `blFromFsMmsQes`, `eta0FromFsVasQes` from `../lib/calculations` (Task 3); `useDriverDatabaseContext` (Task 7) — for `editingDriverId`, `browserCallback`, `setDrivers`, `setShowAddForm`, `setShowBrowser`, `setBrowserCallback`, `setEditingDriverId`; `useProjectsContext` (Task 9) — for `updateActiveProject`, `setProjectsWithHistory`; `useToast`, `useDialog` from `../components/ui`.
- Produces: `useDriverFormContext(): { newManufacturer: string; setNewManufacturer: (v: string) => void; newModel: string; setNewModel: (v: string) => void; newFs: string; setNewFs: (v: string) => void; newQes: string; setNewQes: (v: string) => void; newQms: string; setNewQms: (v: string) => void; newQts: string; newVas: string; setNewVas: (v: string) => void; newRe: string; setNewRe: (v: string) => void; newSd: string; setNewSd: (v: string) => void; newXmax: string; setNewXmax: (v: string) => void; newMms: string; setNewMms: (v: string) => void; newLe: string; setNewLe: (v: string) => void; newBl: string; setNewBl: (v: string) => void; newPe: string; setNewPe: (v: string) => void; newSens: string; setNewSens: (v: string) => void; pistonDiameter: string; setPistonDiameter: (v: string) => void; nominalImpedance: string; setNominalImpedance: (v: string) => void; handleAddDriver: (e: React.FormEvent) => Promise<void>; handleAutoEstimateTS: () => Promise<void>; handleVerifyParameters: () => Promise<void>; checkDriverConsistency: (drv: Driver) => { cms: number; derivedVas: number; discrepancy: number; isInconsistent: boolean } | null }`, `DriverFormProvider`.

Note: `handleStartEditDriver`/`handleStartAddDriver` are **not** part of this hook's returned interface — they live in `useDriverDatabase` conceptually (Task 7 chose not to move them there, since they reset all 14 form fields, which don't exist in that hook). They stay as free functions defined in `AppShell` for now — see Step 4 — because they need to call `setShowAddForm` (from `useDriverDatabaseContext`, already available in `AppShell`) **and** all 14 `setNewX` setters (from `useDriverFormContext`, only available inside the `DriverFormProvider`'s subtree, which `AppShell` is not). This is exactly the kind of two-domain "workflow" function the design doc's Risks section flags — it gets resolved concretely when `AddDriverModal.tsx` is extracted in Task 21, at which point it can call both contexts directly since it renders inside both providers.

- [ ] **Step 1: Create `src/hooks/useDriverForm.ts`**

```tsx
import { useEffect, useState } from "react";
import { Driver } from "../types";
import { cmsFromVasSd, mmsKgFromFsCms, blFromFsMmsQes, eta0FromFsVasQes } from "../lib/calculations";
import { useToast, useDialog } from "../components/ui";
import { useDriverDatabaseContext } from "../context/DriverDatabaseContext";
import { useProjectsContext } from "../context/ProjectsContext";

export function useDriverForm() {
  const toast = useToast();
  const { confirmDialog } = useDialog();
  const { editingDriverId, browserCallback, setDrivers, setShowAddForm, setShowBrowser, setBrowserCallback, setEditingDriverId } = useDriverDatabaseContext();
  const { updateActiveProject, setProjectsWithHistory } = useProjectsContext();

  // Add Driver Form Fields
  const [newManufacturer, setNewManufacturer] = useState("");
  const [newModel, setNewModel] = useState("");
  const [newFs, setNewFs] = useState("33");
  const [newQes, setNewQes] = useState("0.37");
  const [newQms, setNewQms] = useState("7.7");
  const [newQts, setNewQts] = useState("0.36");
  const [newVas, setNewVas] = useState("278");
  const [newRe, setNewRe] = useState("3.6");
  const [newSd, setNewSd] = useState("1680");
  const [newXmax, setNewXmax] = useState("14");
  const [newMms, setNewMms] = useState("335");
  const [newLe, setNewLe] = useState("1.7");
  const [newBl, setNewBl] = useState("24.8");
  const [newPe, setNewPe] = useState("1700");
  const [newSens, setNewSens] = useState("97");

  // Helper inputs for estimation
  const [pistonDiameter, setPistonDiameter] = useState("");
  const [nominalImpedance, setNominalImpedance] = useState("4");

  // Recalculate Qts if Qes or Qms changes
  useEffect(() => {
    const qes = parseFloat(newQes);
    const qms = parseFloat(newQms);
    if (!isNaN(qes) && !isNaN(qms) && qes + qms > 0) {
      const calculatedQts = (qes * qms) / (qes + qms);
      setNewQts(calculatedQts.toFixed(3));
    }
  }, [newQes, newQms]);

  const checkDriverConsistency = (drv: Driver) => {
    if (!drv.fs || !drv.mms || !drv.sd || !drv.vas) return null;
    const fs = drv.fs;
    const mms = drv.mms;
    const sd = drv.sd;
    const vas = drv.vas;

    // 1. Calculate Cms in mm/N
    const cms = 1e6 / (Math.pow(2 * Math.PI * fs, 2) * mms);

    // 2. Calculate derived Vas in Liters
    const derivedVas = 0.00138813 * Math.pow(sd, 2) * cms;

    // Discrepancy ratio
    const discrepancy = Math.abs(derivedVas - vas) / vas;

    return {
      cms,
      derivedVas,
      discrepancy,
      isInconsistent: discrepancy > 0.15, // Warning threshold: >15% discrepancy
    };
  };

  // Add Driver Action
  const handleAddDriver = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newManufacturer || !newModel) {
      await confirmDialog({ title: "Missing Fields", body: "Manufacturer and Model are required.", okOnly: true });
      return;
    }

    const finalFs = parseFloat(newFs) || 30.0;
    const finalQes = parseFloat(newQes) || 0.4;
    const finalQms = parseFloat(newQms) || 5.0;
    const finalVas = parseFloat(newVas) || 50.0;
    const finalQts = parseFloat(newQts) || (finalQes * finalQms) / (finalQes + finalQms);

    let finalSd = parseFloat(newSd) || 0;
    if (finalSd <= 0) {
      if (pistonDiameter) {
        const diaCm = parseFloat(pistonDiameter) * 2.54;
        finalSd = Math.PI * Math.pow(diaCm / 2, 2);
      } else {
        finalSd = 530.0; // fallback standard 12 inch
      }
    }

    let finalRe = parseFloat(newRe) || 0;
    if (finalRe <= 0) {
      finalRe = nominalImpedance ? parseFloat(nominalImpedance) * 0.8 : 3.6;
    }

    let finalMms = parseFloat(newMms) || 0;
    let finalBl = parseFloat(newBl) || 0;
    let finalSens = parseFloat(newSens) || 0;

    const vasM3 = finalVas * 1e-3;
    const ws = 2.0 * Math.PI * finalFs;
    const cms = cmsFromVasSd(finalVas, finalSd);

    if (finalMms <= 0 && cms > 0 && ws > 0) {
      finalMms = mmsKgFromFsCms(finalFs, cms) * 1000.0;
    }
    const finalMmsKg = finalMms / 1000.0;

    if (finalBl <= 0 && ws > 0 && finalMmsKg > 0 && finalRe > 0 && finalQes > 0) {
      finalBl = blFromFsMmsQes(finalFs, finalMmsKg, finalRe, finalQes);
    }

    if (finalSens <= 0 && finalFs > 0 && vasM3 > 0 && finalQes > 0) {
      const eta0 = eta0FromFsVasQes(finalFs, finalVas, finalQes);
      if (eta0 > 0) {
        finalSens = 112.0 + 10.0 * Math.log10(eta0);
      } else {
        finalSens = 90.0;
      }
    }

    const finalLe = parseFloat(newLe) || 1.5; // typical default
    const finalPe = parseFloat(newPe) || 250.0;
    const finalXmax = parseFloat(newXmax) || 5.0;

    const driverData: Driver = {
      id: "",
      manufacturer: newManufacturer,
      model: newModel,
      fs: finalFs,
      qts: finalQts,
      qes: finalQes,
      qms: finalQms,
      vas: finalVas,
      re: finalRe,
      sd: finalSd,
      xmax: finalXmax,
      mms: finalMms,
      le: finalLe,
      bl: finalBl,
      pe: finalPe,
      sens: finalSens,
    };

    try {
      let updatedDrivers: Driver[];
      if (editingDriverId) {
        updatedDrivers = await invoke("edit_driver", { id: editingDriverId, driver: driverData });
        // Update all projects using this driver
        const savedDriver = updatedDrivers.find(d => d.id === editingDriverId) || driverData;
        setProjectsWithHistory((prev) =>
          prev.map((p) => (p.driver.id === editingDriverId ? { ...p, driver: { ...savedDriver, id: editingDriverId } } : p))
        );
      } else {
        updatedDrivers = await invoke("add_driver", { driver: driverData });
        const savedDriver = updatedDrivers[updatedDrivers.length - 1];
        if (browserCallback) {
          browserCallback(savedDriver);
        } else {
          updateActiveProject({
            driver: savedDriver,
            vBox: savedDriver.vas / 2,
          });
        }
      }
      setDrivers(updatedDrivers);
      setShowAddForm(false);
      setShowBrowser(false);
      setBrowserCallback(null);
      setEditingDriverId(null);
      setNewManufacturer("");
      setNewModel("");
    } catch (err) {
      toast.error("Error saving driver: " + err);
    }
  };

  const handleAutoEstimateTS = async () => {
    const fs = parseFloat(newFs);
    const qes = parseFloat(newQes);
    const qms = parseFloat(newQms);
    const vas = parseFloat(newVas);

    // Compute Qts
    if (qes && qms) {
      const qtsVal = (qes * qms) / (qes + qms);
      setNewQts(qtsVal.toFixed(4));
    }

    // Estimate Sd from piston diameter if provided
    let sdVal = parseFloat(newSd);
    if (pistonDiameter) {
      const diaCm = parseFloat(pistonDiameter) * 2.54;
      sdVal = Math.PI * Math.pow(diaCm / 2, 2);
      setNewSd(sdVal.toFixed(1));
    }

    // Estimate Re if not provided
    let reVal = parseFloat(newRe);
    if (!reVal) {
      reVal = nominalImpedance ? parseFloat(nominalImpedance) * 0.8 : 3.6;
      setNewRe(reVal.toFixed(2));
    }

    if (fs && qes && qms && vas && sdVal && reVal) {
      // Cms
      const cms = cmsFromVasSd(vas, sdVal);

      // Mms
      const mmsKg = mmsKgFromFsCms(fs, cms);
      const mmsG = mmsKg * 1000.0;
      setNewMms(mmsG.toFixed(1));

      // Bl
      const blVal = blFromFsMmsQes(fs, mmsKg, reVal, qes);
      setNewBl(blVal.toFixed(2));

      // Sensitivity
      const eta0 = eta0FromFsVasQes(fs, vas, qes);
      if (eta0 > 0) {
        const sensVal = 112.0 + 10.0 * Math.log10(eta0);
        setNewSens(sensVal.toFixed(1));
      }
    } else {
      await confirmDialog({
        title: "Missing Fields",
        body: "Please ensure Fs, Qes, Qms, Vas, and either Sd or Piston Diameter are populated first.",
        okOnly: true,
      });
    }
  };

  const handleVerifyParameters = async () => {
    const fs = parseFloat(newFs);
    const qes = parseFloat(newQes);
    const qms = parseFloat(newQms);
    const vas = parseFloat(newVas);

    let sd = parseFloat(newSd);
    if (!sd && pistonDiameter) {
      const diaCm = parseFloat(pistonDiameter) * 2.54;
      sd = Math.PI * Math.pow(diaCm / 2, 2);
    }

    if (!fs || !qes || !qms || !vas || !sd) {
      await confirmDialog({
        title: "Cannot Verify",
        body: "Verification requires at least Fs, Qes, Qms, Vas, and Sd (or Piston Diameter) to be filled in.",
        okOnly: true,
      });
      return;
    }

    const re = parseFloat(newRe) || 3.6;

    const rho = 1.18;
    const c_air = 343.0;
    const sdM2 = sd * 1e-4;
    const vasM3 = vas * 1e-3;
    const cms = vasM3 / (rho * c_air * c_air * sdM2 * sdM2);
    const ws = 2.0 * Math.PI * fs;
    const derivedMmsKg = 1.0 / (ws * ws * cms);
    const derivedMmsG = derivedMmsKg * 1000.0;

    const derivedBl = Math.sqrt((ws * derivedMmsKg * re) / qes);

    const enteredMms = parseFloat(newMms);
    const enteredBl = parseFloat(newBl);

    const anomalies: string[] = [];

    if (enteredMms > 0) {
      const cmsFromMms = 1.0 / (ws * ws * (enteredMms / 1000.0));
      const derivedVasL = 0.00138813 * Math.pow(sd, 2) * (cmsFromMms * 1000.0);
      const vasDiscrepancy = Math.abs(derivedVasL - vas) / vas;
      if (vasDiscrepancy > 0.15) {
        anomalies.push(
          `• Vas Discrepancy: Entered Vas is ${vas} L, but based on your entered Sd (${sd.toFixed(1)} cm²) and moving mass, it should mathematically be ${derivedVasL.toFixed(1)} L. This is a ${Math.round(vasDiscrepancy * 100)}% discrepancy. Please check if your Sd or Vas has a manufacturer copy-paste error.`
        );
      }

      const mmsDiscrepancy = Math.abs(enteredMms - derivedMmsG) / derivedMmsG;
      if (mmsDiscrepancy > 0.15) {
        anomalies.push(
          `• Mms Discrepancy: Entered Mms is ${enteredMms} g, but calculated moving mass from your Vas/Sd is ${derivedMmsG.toFixed(1)} g. (Difference: ${Math.round(mmsDiscrepancy * 100)}%).`
        );
      }
    }

    if (enteredBl > 0) {
      const blDiscrepancy = Math.abs(enteredBl - derivedBl) / derivedBl;
      if (blDiscrepancy > 0.15) {
        anomalies.push(
          `• BL Motor Strength Discrepancy: Entered BL is ${enteredBl} T·m, but calculated BL from Qes and moving mass is ${derivedBl.toFixed(2)} T·m. (Difference: ${Math.round(blDiscrepancy * 100)}%).`
        );
      }
    }

    if (anomalies.length > 0) {
      await confirmDialog({
        title: "Thiele-Small Verification Report",
        body: `${anomalies.join("\n\n")}\n\nNote: The backend simulation solver will automatically run with self-consistent derived parameters (best-effort alignment), but resolving these anomalies ensures that all graphs and parameters behave identically to the manufacturer's target.`,
        okOnly: true,
      });
    } else {
      await confirmDialog({
        title: "Thiele-Small Verification: Success",
        body: `All parameters (Fs, Qts, Vas, Sd, Mms, BL) are mathematically consistent within tolerances. Your driver is perfectly configured for simulation!`,
        okOnly: true,
      });
    }
  };

  return {
    newManufacturer, setNewManufacturer, newModel, setNewModel,
    newFs, setNewFs, newQes, setNewQes, newQms, setNewQms, newQts,
    newVas, setNewVas, newRe, setNewRe, newSd, setNewSd, newXmax, setNewXmax,
    newMms, setNewMms, newLe, setNewLe, newBl, setNewBl, newPe, setNewPe, newSens, setNewSens,
    pistonDiameter, setPistonDiameter, nominalImpedance, setNominalImpedance,
    handleAddDriver, handleAutoEstimateTS, handleVerifyParameters, checkDriverConsistency,
  };
}
```

Add `import { invoke } from "@tauri-apps/api/core";` alongside the other imports — `handleAddDriver` calls it directly. `newQts` intentionally has no exported setter in the return value beyond the internal `setNewQts` used by the Qts-recompute effect and `handleAutoEstimateTS`/`handleStartEditDriver`/`handleStartAddDriver` — but those last two live outside this hook (see the Note above) and need to *set* `newQts` directly (to pre-fill/reset it), so **do** export `setNewQts` too: add `newQts, setNewQts,` to the return statement (the snippet above has a gap — include it when writing the real file).

This hook body is `App.tsx:946-965` (all 16 field declarations), `App.tsx:1069-1077` (Qts-recompute effect), `App.tsx:2127-2149` (`checkDriverConsistency`), `App.tsx:1179-1287` (`handleAddDriver`), `App.tsx:1331-1384` (`handleAutoEstimateTS`), and `App.tsx:1386-1465` (`handleVerifyParameters`) — moved verbatim. **Do not** move `App.tsx:1289-1329` (`handleStartEditDriver`/`handleStartAddDriver`) here — see the Note above for why, and Step 4 for where they go instead.

- [ ] **Step 2: Write `src/hooks/useDriverForm.test.ts`**

```tsx
import { describe, it, expect, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useDriverForm } from "./useDriverForm";

vi.mock("../context/DriverDatabaseContext", () => ({
  useDriverDatabaseContext: () => ({
    editingDriverId: null, browserCallback: null,
    setDrivers: vi.fn(), setShowAddForm: vi.fn(), setShowBrowser: vi.fn(),
    setBrowserCallback: vi.fn(), setEditingDriverId: vi.fn(),
  }),
}));

vi.mock("../context/ProjectsContext", () => ({
  useProjectsContext: () => ({ updateActiveProject: vi.fn(), setProjectsWithHistory: vi.fn() }),
}));

vi.mock("../components/ui", () => ({
  useToast: () => ({ success: vi.fn(), error: vi.fn() }),
  useDialog: () => ({ confirmDialog: vi.fn(), promptDialog: vi.fn() }),
}));

describe("useDriverForm", () => {
  it("recomputes Qts from Qes and Qms", () => {
    const { result } = renderHook(() => useDriverForm());
    act(() => {
      result.current.setNewQes("0.4");
      result.current.setNewQms("5.0");
    });
    // Qts = (Qes*Qms)/(Qes+Qms) = (0.4*5.0)/5.4 = 0.3703...
    expect(parseFloat(result.current.newQts)).toBeCloseTo(0.370, 2);
  });

  it("checkDriverConsistency returns null for a driver missing required fields", () => {
    const { result } = renderHook(() => useDriverForm());
    expect(result.current.checkDriverConsistency({ id: "", manufacturer: "", model: "", fs: 0, qts: 0, qes: 0, qms: 0, vas: 0, re: 0, sd: 0, xmax: 0, mms: 0, le: 0, bl: 0, pe: 0, sens: 0 })).toBeNull();
  });

  it("checkDriverConsistency flags a large Vas/Mms/Sd discrepancy as inconsistent", () => {
    const { result } = renderHook(() => useDriverForm());
    // Deliberately inconsistent: fs/mms/sd imply a very different Vas than 278L
    const check = result.current.checkDriverConsistency({
      id: "", manufacturer: "", model: "", fs: 33, qts: 0.36, qes: 0.37, qms: 7.7,
      vas: 278, re: 3.6, sd: 1680, xmax: 14, mms: 50, le: 1.7, bl: 24.8, pe: 1700, sens: 97,
    });
    expect(check).not.toBeNull();
    expect(check!.isInconsistent).toBe(true);
  });

  it("checkDriverConsistency accepts internally-consistent parameters", () => {
    const { result } = renderHook(() => useDriverForm());
    // B&C 21SW115 parameters, known consistent
    const check = result.current.checkDriverConsistency({
      id: "", manufacturer: "", model: "", fs: 33, qts: 0.36, qes: 0.37, qms: 7.7,
      vas: 278, re: 3.6, sd: 1680, xmax: 14, mms: 335, le: 1.7, bl: 24.8, pe: 1700, sens: 97,
    });
    expect(check).not.toBeNull();
    expect(check!.isInconsistent).toBe(false);
  });
});
```

- [ ] **Step 3: Run the new tests**

Run: `npx vitest run src/hooks/useDriverForm.test.ts` — expect all PASS.

- [ ] **Step 4: Create `src/context/DriverFormContext.tsx`**

```tsx
import { createContext, ReactNode, useContext } from "react";
import { useDriverForm } from "../hooks/useDriverForm";

type DriverFormContextValue = ReturnType<typeof useDriverForm>;

const DriverFormContext = createContext<DriverFormContextValue | null>(null);

export function DriverFormProvider({ children }: { children: ReactNode }) {
  const value = useDriverForm();
  return <DriverFormContext.Provider value={value}>{children}</DriverFormContext.Provider>;
}

export function useDriverFormContext(): DriverFormContextValue {
  const ctx = useContext(DriverFormContext);
  if (!ctx) throw new Error("useDriverFormContext must be used within a DriverFormProvider");
  return ctx;
}
```

- [ ] **Step 5: Wire into `App.tsx` — scoped, not app-root**

Unlike Tasks 5-11, `DriverFormProvider` does **not** go in the composition root. `App.tsx` still renders the Add/Edit Driver Modal's JSX inline at this point (it moves to its own file in Task 21) — wrap just that JSX block in the provider:

1. Delete `App.tsx:946-965` (14+2 field declarations), `App.tsx:1069-1077` (Qts effect), `App.tsx:1179-1287` (`handleAddDriver`), `App.tsx:1331-1384` (`handleAutoEstimateTS`), `App.tsx:1386-1465` (`handleVerifyParameters`), and `App.tsx:2127-2149` (`checkDriverConsistency`) from `AppShell`. **Keep** `App.tsx:1289-1329` (`handleStartEditDriver`/`handleStartAddDriver`) in `AppShell` for now, but they can no longer reference the 14 `setNewX` setters directly (those moved into the provider-scoped hook) — see sub-step 3 below for the fix.
2. Import: `import { DriverFormProvider, useDriverFormContext } from "./context/DriverFormContext";`
3. `handleStartEditDriver`/`handleStartAddDriver` become **inline arrow functions passed as props** to wherever the JSX currently calls them, rather than named functions in `AppShell`'s scope — because the setters they need only exist inside `DriverFormProvider`'s subtree. Concretely: find their current call sites with `grep -n "handleStartEditDriver\|handleStartAddDriver" src/App.tsx` (there will be a handful — the "Add Driver" button, the driver-card "Edit" pencil icon in the Driver Browser modal, etc.). Delete the two named function declarations. In their place, wrap the Add/Edit Driver Modal's JSX block (the `{showAddForm && (...)}` block, still inline in `App.tsx`'s return) in `<DriverFormProvider>`, and inside that now-wrapped block, define the two handlers as local consts that call `useDriverFormContext()`'s setters directly:

```tsx
{showAddForm && (
  <DriverFormProvider>
    {(() => {
      const driverForm = useDriverFormContext();
      // ... but hooks cannot be called inside an IIFE conditionally like this — see the actual fix below.
    })()}
  </DriverFormProvider>
)}
```

The snippet above is **wrong** (calling a hook inside a conditionally-rendered inline function violates the Rules of Hooks) — do not write it that way. The correct fix: extract the Add/Edit Driver Modal's JSX into a small inline component defined once, above `AppShell`, that itself calls `useDriverFormContext()` at its top level:

```tsx
function AddDriverModalInline({ showAddForm, setShowAddForm, /* ...whatever other AppShell-level values this JSX block currently reads... */ }: { showAddForm: boolean; setShowAddForm: (v: boolean) => void; /* ... */ }) {
  const driverForm = useDriverFormContext();
  const handleStartEditDriver = (driver: Driver) => {
    driverForm.setEditingDriverId(driver.id);
    // ... rest of the original App.tsx:1289-1308 body, using driverForm.setNewX instead of bare setNewX
  };
  // ... the rest of the original inline JSX block, referencing driverForm.newFs etc. instead of bare newFs
}
```

This is more restructuring than a pure "cut and paste" — flagged deliberately, because the Rules of Hooks make the naive version impossible. **This is exactly the shape `AddDriverModal.tsx` will have once it's extracted for real in Task 21** — so treat this step as building that component's insides *now*, just still physically located inside `App.tsx` and not yet imported/exported as its own file. Wrap it in `<DriverFormProvider><AddDriverModalInline ... /></DriverFormProvider>` at the JSX call site (still inline in `App.tsx`'s return, replacing the old `{showAddForm && (...)}` block's contents). Task 21 then only needs to cut this already-correct function out into its own file — a much lower-risk move than what this step does.

Given the scope of "whatever other `AppShell`-level values this JSX block currently reads," read the live `App.tsx` at the Add/Edit Driver Modal's current location (originally `App.tsx:5653+` before this task's edits shift line numbers — search for `{/* Add Driver Modal */}`) to enumerate them precisely before writing `AddDriverModalInline`'s prop list; likely candidates based on earlier reads: `editingDriverId` (from `useDriverDatabaseContext`, already available either as a prop or by having `AddDriverModalInline` call `useDriverDatabaseContext()` itself — prefer the latter, since it's a context hook and this component is free to call it directly, avoiding a prop for something already contextually available).

- [ ] **Step 6: Verify**

Run: `npx tsc --noEmit --noUnusedLocals --noUnusedParameters` — expect clean.
Run: `npm run build` — expect clean.
Run: `npx vitest run` — expect all tests passing.

- [ ] **Step 7: Commit**

```bash
git add src/hooks/useDriverForm.ts src/hooks/useDriverForm.test.ts src/context/DriverFormContext.tsx src/App.tsx
git commit -m "refactor: extract Add/Edit Driver form state into useDriverForm hook + scoped DriverFormContext"
```

This completes hook extraction. Every state slice that started in `App.tsx` now lives in a hook; `AppShell` consumes all of them via `useXContext()` calls. The remaining tasks move JSX into its own files, each one switching from reading `AppShell`-local variables to calling the relevant `useXContext()` hooks directly.

**A note on line numbers for Tasks 13-21:** by this point, Tasks 1-12 have removed hundreds of lines from `App.tsx`, so any absolute line number from this plan's earlier reads (done before Task 1) is stale. Every remaining task locates its JSX region by the distinctive comment markers already present in the file (confirmed during planning, e.g. `{/* Sidebar */}`, `{/* Settings Modal */}`) — `grep -n` for the marker quoted in each task to find its current location before cutting anything.

---

## Task 13: `Sidebar.tsx` shell — logo header, project section, tab switcher

**Files:**
- Create: `src/components/sidebar/Sidebar.tsx`
- Modify: `src/App.tsx` (the region from `{/* Sidebar */}` through the start of the scrollable tab-content area, and its matching closing tags)

**Interfaces:**
- Consumes: `useDriverDatabaseContext` (for `setShowBrowser`), `useModalsContext` (for `setShowSettings`, `sidebarTab`, `setSidebarTab`), `useProjectsContext` (for `activeProject`, `updateActiveProject`, `handleNewProject`, `handleOpenProject`, `handleSaveProject`).
- Produces: `Sidebar({ children }: { children: ReactNode })` — default export. `children` is whichever of `DriverTab`/`EnclosureTab`/`SignalTab` (Tasks 14-16) is active; `Sidebar` itself doesn't decide which — that's `AppShell`'s job (it renders `<Sidebar>{sidebarTab === "driver" && <DriverTab />}{sidebarTab === "enclosure" && <EnclosureTab />}{sidebarTab === "signal" && <SignalTab />}</Sidebar>`).

- [ ] **Step 1: Find and read the current region**

Run: `grep -n '{/\* Sidebar \*/}\|{/\* Sidebar Tabs \*/}\|{/\* Scrollable inputs \*/}\|sidebarTab === "driver"' src/App.tsx`

Read from `{/* Sidebar */}` through the line that opens `{sidebarTab === "driver" && (` (exclusive) — this is: the outer sidebar `<div className="w-80 border-r ...">`, the Logo header block (`Activity` icon, "WinISD Modern" title, Driver Database + Settings icon buttons wrapped in `Tooltip`/`Button variant="icon"`), the Project Section block (Project Name `TextField`, Notes `textarea`, New/Open/Save button row), the Sidebar Tabs block (the three-tab switcher `.map()`), and the opening of the scrollable content wrapper `<div className="flex-1 overflow-y-auto p-5 flex flex-col gap-5">`.

- [ ] **Step 2: Create `src/components/sidebar/Sidebar.tsx`**

```tsx
import { ReactNode } from "react";
import { Activity, Database, Settings, FilePlus, FolderOpen, Save } from "lucide-react";
import { Tooltip, Button, TextField } from "../ui";
import { useDriverDatabaseContext } from "../../context/DriverDatabaseContext";
import { useModalsContext } from "../../context/ModalsContext";
import { useProjectsContext } from "../../context/ProjectsContext";

export default function Sidebar({ children }: { children: ReactNode }) {
  const { setShowBrowser } = useDriverDatabaseContext();
  const { setShowSettings, sidebarTab, setSidebarTab } = useModalsContext();
  const { activeProject, updateActiveProject, handleNewProject, handleOpenProject, handleSaveProject } = useProjectsContext();

  return (
    // ... exact JSX read in Step 1, from the outer <div className="w-80 border-r ..."> through
    // the Sidebar Tabs block, unchanged apart from removing the values now sourced from the
    // hooks above instead of App.tsx's local scope (they were already the same variable names) ...
    <div /* ...as read... */>
      {/* Logo, Project Section, Sidebar Tabs — cut verbatim from Step 1's read */}
      <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-5">
        {children}
      </div>
    </div>
  );
}
```

Fill in the JSX exactly as read in Step 1 — every className, every `style={{...}}`, every icon, unchanged. The three `sidebarTab === "..."` conditional blocks that currently follow the scrollable wrapper's opening tag are **not** part of this component — replace them with `{children}`, and close `Sidebar`'s scrollable `<div>` and outer `<div>` right after.

- [ ] **Step 3: Update `App.tsx`**

1. Delete the region read in Step 1 from `AppShell`'s JSX, **except** keep the three `{sidebarTab === "..." && (...)}` blocks — those are Tasks 14-16's territory, not yet extracted. For now, wrap them in the new `Sidebar`:

```tsx
<Sidebar>
  {sidebarTab === "driver" && ( /* ...unchanged, still inline... */ )}
  {sidebarTab === "enclosure" && ( /* ...unchanged, still inline... */ )}
  {sidebarTab === "signal" && ( /* ...unchanged, still inline... */ )}
</Sidebar>
```

2. Import: `import Sidebar from "./components/sidebar/Sidebar";`
3. Any imports that were only used by the JSX just removed (e.g. `Activity`, `Database`, `Settings` icons, if `AppShell` no longer references them elsewhere) should be deleted from `App.tsx`'s import list — `--noUnusedLocals` will catch anything missed as a build error, so this is self-checking.

- [ ] **Step 4: Verify**

Run: `npx tsc --noEmit --noUnusedLocals --noUnusedParameters` — expect clean.
Run: `npm run build` — expect clean.

- [ ] **Step 5: Commit**

```bash
git add src/components/sidebar/Sidebar.tsx src/App.tsx
git commit -m "refactor: extract sidebar shell (logo, project section, tab switcher) into Sidebar.tsx"
```

---

## Task 14: `DriverTab.tsx`

**Files:**
- Create: `src/components/sidebar/DriverTab.tsx`
- Modify: `src/App.tsx` (the `{sidebarTab === "driver" && (...)}` block)

**Interfaces:**
- Consumes: `useProjectsContext` (`activeProject`, `updateActiveProject`), `useDriverDatabaseContext` (`setShowBrowser` — for the "Change" driver button), whichever other context values the live JSX references (confirm in Step 1).
- Produces: `DriverTab()` — default export, no props (everything it needs comes from context).

- [ ] **Step 1: Find and read the current region**

Run: `grep -n 'sidebarTab === "driver"' src/App.tsx`

Read from that line through its matching closing `)}` — this is the "Active Driver specs" display block (Fs/Qts/Vas/etc. read-only grid, the Badge for consistency warnings using `checkDriverConsistency` — note this comes from `useDriverFormContext`, but `DriverTab` is outside `DriverFormProvider`'s subtree (that provider only wraps the Add/Edit Driver Modal) — check whether `DriverTab`'s consistency check calls `checkDriverConsistency` at all; if it does, this is a boundary problem to flag and resolve during this task (most likely: `checkDriverConsistency` needs to also be reachable from `useDriverDatabaseContext` or a plain exported function from `lib/calculations.ts` rather than living only inside the scoped `useDriverForm` hook — read the live code to confirm which is actually the case before assuming either resolution).

- [ ] **Step 2: Resolve the `checkDriverConsistency` boundary if it applies**

If Step 1 confirms `DriverTab`'s JSX calls `checkDriverConsistency`: this function (as placed in Task 12) has no dependency on any of `useDriverForm`'s state — it's a pure function of the `Driver` object passed to it. Move it out of `useDriverForm` (Task 12's hook) into `src/lib/calculations.ts` instead (as a plain exported function, not hook-scoped), and update `useDriverForm`'s hook body to import it from there rather than defining it locally, keeping it in `useDriverForm`'s returned interface too (for `AddDriverModal`'s own use) so Task 12's consumers don't need to change. `DriverTab.tsx` then imports it directly from `../../lib/calculations`, no context needed for this one function.

If Step 1 shows `DriverTab` does not call `checkDriverConsistency` (e.g. the consistency check only appears in the Add/Edit Driver form itself), skip this step — no boundary issue exists.

- [ ] **Step 3: Create `src/components/sidebar/DriverTab.tsx`**

```tsx
import { useProjectsContext } from "../../context/ProjectsContext";
import { useDriverDatabaseContext } from "../../context/DriverDatabaseContext";
// ... plus whatever primitives/icons the read JSX uses (Badge, Tooltip, Button, etc. — confirm from Step 1's read) ...

export default function DriverTab() {
  const { activeProject, updateActiveProject } = useProjectsContext();
  const { setShowBrowser } = useDriverDatabaseContext();
  // ... any other context values Step 1's read shows are actually referenced ...

  return (
    // ... exact JSX from Step 1's read, the <div className="flex flex-col gap-5"> body,
    // unchanged apart from Step 2's resolution if it applied ...
  );
}
```

- [ ] **Step 4: Update `App.tsx`**

Replace the `{sidebarTab === "driver" && (...)}` block inside `<Sidebar>` with `{sidebarTab === "driver" && <DriverTab />}`. Import: `import DriverTab from "./components/sidebar/DriverTab";`. Remove now-unused imports from `App.tsx` as flagged by `--noUnusedLocals`.

- [ ] **Step 5: Verify**

Run: `npx tsc --noEmit --noUnusedLocals --noUnusedParameters` — expect clean.
Run: `npm run build` — expect clean.

- [ ] **Step 6: Commit**

```bash
git add src/components/sidebar/DriverTab.tsx src/App.tsx src/lib/calculations.ts src/hooks/useDriverForm.ts
git commit -m "refactor: extract Driver tab JSX into DriverTab.tsx"
```

---

## Task 15: `EnclosureTab.tsx` + `DimensionCalculator.tsx`

**Files:**
- Create: `src/components/sidebar/EnclosureTab.tsx`
- Create: `src/components/sidebar/DimensionCalculator.tsx`
- Modify: `src/App.tsx` (the `{sidebarTab === "enclosure" && (...)}` block, `App.tsx`'s `updateCustomRear`/`updateCustomFront`/`updateCustomRearPort`/`updateCustomRearPR`/`updateCustomFrontPort`/`updateCustomFrontPR`/`updateCustomInternalPort` wrappers, and `alignmentPref`/`setAlignmentPref`)

**Interfaces:**
- Consumes: `useProjectsContext` (`activeProject`, `updateActiveProject`, `handleApplyAlignment`... wait, `handleApplyAlignment` is `useSimulationContext`'s — confirm exact source when reading), `useSimulationContext` (`calculatedPortLength`, `kaWarningFreq`, `handleAutoCalculatePort`, `handleApplyAlignment`), `useModalsContext` (`sidebarSectionState`, `toggleSidebarSection`), `CustomTopologyDiagram` (Task 4), `CustomSideSpec`/`CustomPortSpec`/`CustomPRSpec` types (Task 1).
- Produces: `EnclosureTab()` — default export, no props. `DimensionCalculator()` — default export, no props, owns its own local state entirely.

- [ ] **Step 1: Find and read the current region**

Run: `grep -n 'sidebarTab === "enclosure"\|Enclosure Dimension Calculator\|Custom Topology Builder' src/App.tsx`

Read from `sidebarTab === "enclosure"` through its matching closing `)}`. This is the largest single JSX region in the app — it contains, in order: Enclosure Settings (type selector, volume/tuning/port controls) wrapped in a `CollapsibleSection`, Auto-Align (nested inside per the existing design — an earlier pass in this codebase deliberately kept it nested rather than as a sibling `CollapsibleSection`, since the real JSX has it embedded mid-flow; preserve that nesting, don't restructure it), the Custom Topology Builder (Rear Side / Cross-Connect / Front Side, each its own `CollapsibleSection`, rendering `CustomTopologyDiagram`), and the Dimension Calculator (`CollapsibleSection`, Vb↔dims conversion).

- [ ] **Step 2: Create `src/components/sidebar/DimensionCalculator.tsx` first**

The Dimension Calculator is self-contained — it reads `activeProject.vBox` (for the "Apply to active project" button, via `updateActiveProject`) but otherwise owns all its own state (`calcMode`, `calcVb`, `calcRatioL/W/D`, `calcExtL/W/D`, `calcThickness` — currently `App.tsx:931-939`, plain local `useState` calls with no cross-component consumer). Move it out as its own component with fully local state:

```tsx
import { useState } from "react";
import { CollapsibleSection } from "../ui";
import { useProjectsContext } from "../../context/ProjectsContext";
import { useModalsContext } from "../../context/ModalsContext";

export default function DimensionCalculator() {
  const { activeProject, updateActiveProject } = useProjectsContext();
  const { sidebarSectionState, toggleSidebarSection } = useModalsContext();

  const [calcMode, setCalcMode] = useState<"vb-to-dims" | "dims-to-vb">("vb-to-dims");
  const [calcVb, setCalcVb] = useState("150");
  const [calcRatioL, setCalcRatioL] = useState("1.618");
  const [calcRatioW, setCalcRatioW] = useState("1");
  const [calcRatioD, setCalcRatioD] = useState("0.618");
  const [calcExtL, setCalcExtL] = useState("60");
  const [calcExtW, setCalcExtW] = useState("40");
  const [calcExtD, setCalcExtD] = useState("35");
  const [calcThickness, setCalcThickness] = useState("18");

  return (
    // ... the "Enclosure Dimension Calculator" CollapsibleSection block, cut verbatim from
    // Step 1's read, unchanged ...
  );
}
```

- [ ] **Step 3: Create `src/components/sidebar/EnclosureTab.tsx`**

```tsx
import { useState } from "react";
import { CollapsibleSection, Badge } from "../ui"; // confirm exact primitives used from Step 1's read
import CustomTopologyDiagram from "../CustomTopologyDiagram";
import DimensionCalculator from "./DimensionCalculator";
import { CustomSideSpec, CustomPortSpec, CustomPRSpec } from "../../types";
import { useProjectsContext } from "../../context/ProjectsContext";
import { useSimulationContext } from "../../context/SimulationContext";
import { useModalsContext } from "../../context/ModalsContext";

const DEFAULT_PORT: CustomPortSpec = { diameter_cm: 10, tuning_freq: 35 };
const DEFAULT_PR: CustomPRSpec = { mms_g: 300, sd_cm2: 1680, fs: 25, qms: 5 };

export default function EnclosureTab() {
  const { activeProject, updateActiveProject } = useProjectsContext();
  const { calculatedPortLength, kaWarningFreq, handleAutoCalculatePort, handleApplyAlignment } = useSimulationContext();
  const { sidebarSectionState, toggleSidebarSection } = useModalsContext();

  const [alignmentPref, setAlignmentPref] = useState<"maximally_flat" | "extended_bass" | "boomy">("maximally_flat");

  const updateCustomRear = (patch: Partial<CustomSideSpec>) => {
    updateActiveProject({
      customTopology: {
        ...activeProject.customTopology,
        rear: { ...activeProject.customTopology.rear, ...patch }
      }
    });
  };

  const updateCustomFront = (patch: Partial<CustomSideSpec>) => {
    updateActiveProject({
      customTopology: {
        ...activeProject.customTopology,
        front: { ...activeProject.customTopology.front, ...patch }
      }
    });
  };

  const updateCustomRearPort = (patch: Partial<CustomPortSpec>) => {
    updateActiveProject({
      customTopology: {
        ...activeProject.customTopology,
        rear: {
          ...activeProject.customTopology.rear,
          port: { ...(activeProject.customTopology.rear.port ?? DEFAULT_PORT), ...patch }
        }
      }
    });
  };

  const updateCustomRearPR = (patch: Partial<CustomPRSpec>) => {
    updateActiveProject({
      customTopology: {
        ...activeProject.customTopology,
        rear: {
          ...activeProject.customTopology.rear,
          pr: { ...(activeProject.customTopology.rear.pr ?? DEFAULT_PR), ...patch }
        }
      }
    });
  };

  const updateCustomFrontPort = (patch: Partial<CustomPortSpec>) => {
    updateActiveProject({
      customTopology: {
        ...activeProject.customTopology,
        front: {
          ...activeProject.customTopology.front,
          port: { ...(activeProject.customTopology.front.port ?? DEFAULT_PORT), ...patch }
        }
      }
    });
  };

  const updateCustomFrontPR = (patch: Partial<CustomPRSpec>) => {
    updateActiveProject({
      customTopology: {
        ...activeProject.customTopology,
        front: {
          ...activeProject.customTopology.front,
          pr: { ...(activeProject.customTopology.front.pr ?? DEFAULT_PR), ...patch }
        }
      }
    });
  };

  const updateCustomInternalPort = (patch: Partial<CustomPortSpec>) => {
    updateActiveProject({
      customTopology: {
        ...activeProject.customTopology,
        internal_port: { ...(activeProject.customTopology.internal_port ?? DEFAULT_PORT), ...patch }
      }
    });
  };

  return (
    <div className="flex flex-col gap-5">
      {/* Enclosure Settings + nested Auto-Align, cut verbatim from Step 1's read —
          the onClick for the Auto-Align "Apply" button changes from
          `onClick={handleApplyAlignment}` to `onClick={() => handleApplyAlignment(alignmentPref)}`
          per Task 11 Step 4's signature change. */}
      {/* Custom Topology Builder — cut verbatim, its update* calls now reference the
          local functions defined above instead of App.tsx-scope ones (same names, same
          behavior, just defined in this file now). */}
      <DimensionCalculator />
    </div>
  );
}
```

`DEFAULT_PORT`/`DEFAULT_PR` are currently defined once at `App.tsx:73-74` and used both by the `updateCustomRear*` wrappers and directly in the Custom Topology Builder's "+ Add Port"/"+ Add PR" button handlers (`updateCustomRear({ port: DEFAULT_PORT, ... })` etc., visible in Step 1's read) — since both consumers land in this same file, declaring them once at the top of `EnclosureTab.tsx` (as shown above) covers both; don't also import them from anywhere else.

- [ ] **Step 4: Update `App.tsx`**

1. Delete the `{sidebarTab === "enclosure" && (...)}` block's contents, the seven `updateCustomRear*`/`updateCustomFront*`/`updateCustomInternalPort` functions, `alignmentPref`/`setAlignmentPref` (`App.tsx:624`), `App.tsx:930-939` (Dimension Calculator state — now local to `DimensionCalculator.tsx`), and `DEFAULT_PORT`/`DEFAULT_PR` (`App.tsx:73-74`, if nothing else in `App.tsx` still uses them — confirm with `grep -n "DEFAULT_PORT\|DEFAULT_PR" src/App.tsx` first, since Task 9's `useProjects.ts` may also reference `DEFAULT_CUSTOM` which is a separate constant).
2. Replace with `{sidebarTab === "enclosure" && <EnclosureTab />}`.
3. Import: `import EnclosureTab from "./components/sidebar/EnclosureTab";`
4. Find and update the `handleApplyAlignment` call site fixed temporarily in Task 11 Step 4 — it now lives inside `EnclosureTab.tsx`, not `App.tsx`, so nothing further to do here (it moved with the JSX).
5. Remove now-unused imports as flagged by `--noUnusedLocals`.

- [ ] **Step 5: Verify**

Run: `npx tsc --noEmit --noUnusedLocals --noUnusedParameters` — expect clean.
Run: `npm run build` — expect clean.

- [ ] **Step 6: Commit**

```bash
git add src/components/sidebar/EnclosureTab.tsx src/components/sidebar/DimensionCalculator.tsx src/App.tsx
git commit -m "refactor: extract Enclosure tab JSX into EnclosureTab.tsx + DimensionCalculator.tsx"
```

---

## Task 16: `SignalTab.tsx`

**Files:**
- Create: `src/components/sidebar/SignalTab.tsx`
- Modify: `src/App.tsx` (the `{sidebarTab === "signal" && (...)}` block)

**Interfaces:**
- Consumes: `useProjectsContext` (`activeProject`, `updateActiveProject`), `useSignalProcessingContext` (`filters`, `setFilters`, `roomConfig`, `setRoomConfig`, `roomDragging`, `setRoomDragging`, `cabinConfig`, `setCabinConfig`), `useGraphViewportContext` (`rulerFreq` — only if the system-stats block or elsewhere in this tab reads it; confirm from the read), `useSimulationContext` (`systemStats`, `kaWarningFreq` — for the ka-radiation-model warning text), `useModalsContext` (`sidebarSectionState`, `toggleSidebarSection`).
- Produces: `SignalTab()` — default export, no props.

- [ ] **Step 1: Find and read the current region**

Run: `grep -n 'sidebarTab === "signal"\|── EQ Filters\|── Passive Crossover\|── Cabin Gain Estimation\|── Room Simulation\|── Floor-plan drag editor\|── Precise X / Y / Z inputs\|Permanently Docked System Statistics\|System Statistics' src/App.tsx`

Read from `sidebarTab === "signal"` through its matching closing `)}`. In order: SPL & Output Simulation (Total Input Power, Distance, SPL Environment — a plain, un-headered intro block, no `CollapsibleSection` wrapper around the intro itself but the EQ/Crossover/Cabin/Room sections below it each have one), EQ Filters, Passive Crossover, Cabin Gain Estimation, Room Simulation (including the floor-plan SVG drag editor's `onMouseDown`/`onMouseMove`/`onMouseUp` handlers reading/writing `roomDragging`/`roomConfig` — do not alter this interaction logic, only its wrapping/imports), the nested Precise X/Y/Z inputs `CollapsibleSection`, and the docked System Statistics footer (outside the scrollable list, per the earlier session's design — pinned below the other sections with its own `border-t`).

- [ ] **Step 2: Create `src/components/sidebar/SignalTab.tsx`**

```tsx
import { CollapsibleSection } from "../ui"; // confirm exact primitives from Step 1's read
import { useProjectsContext } from "../../context/ProjectsContext";
import { useSignalProcessingContext } from "../../context/SignalProcessingContext";
import { useSimulationContext } from "../../context/SimulationContext";
import { useModalsContext } from "../../context/ModalsContext";

export default function SignalTab() {
  const { activeProject, updateActiveProject } = useProjectsContext();
  const { filters, setFilters, roomConfig, setRoomConfig, roomDragging, setRoomDragging, cabinConfig, setCabinConfig } = useSignalProcessingContext();
  const { systemStats, kaWarningFreq } = useSimulationContext();
  const { sidebarSectionState, toggleSidebarSection } = useModalsContext();

  return (
    // ... exact JSX from Step 1's read, unchanged. The docked System Statistics footer sits
    // OUTSIDE the `<div className="flex flex-col gap-5">` scrollable-list wrapper the other
    // sections are inside — preserve that structural split exactly as read, it's intentional
    // (a "pinned footer" region, not part of the scrolling list).
  );
}
```

- [ ] **Step 3: Update `App.tsx`**

Replace the `{sidebarTab === "signal" && (...)}` block with `{sidebarTab === "signal" && <SignalTab />}`. Import: `import SignalTab from "./components/sidebar/SignalTab";`. Remove now-unused imports as flagged by `--noUnusedLocals`.

- [ ] **Step 4: Verify**

Run: `npx tsc --noEmit --noUnusedLocals --noUnusedParameters` — expect clean.
Run: `npm run build` — expect clean.

- [ ] **Step 5: Commit**

```bash
git add src/components/sidebar/SignalTab.tsx src/App.tsx
git commit -m "refactor: extract Signal tab JSX into SignalTab.tsx"
```

---

## Task 17: `Dashboard.tsx` + `Toolbar.tsx`

**Files:**
- Create: `src/components/dashboard/Dashboard.tsx`
- Create: `src/components/dashboard/Toolbar.tsx`
- Modify: `src/App.tsx` (the region from `{/* Main stacked graph list dashboard */}` through the opening of the `{visibleGraphs.map((mode) => {` loop, and that loop's wrapping `<div ref={dashboardContainerRef} ...>`)

**Interfaces:**
- Consumes: `useProjectsContext` (`projects`, `activeProjectId`, `setActiveProjectId`, `canUndo`, `canRedo`, `undo`, `redo`, `handleAddNewProject`, `handleDuplicateProject`, `handleRenameProject`, `handleRemoveProject`), `useGraphViewportContext` (`visibleGraphs`, `setVisibleGraphs`, `dashboardContainerRef`, `rulerFreq`, `setRulerFreq`), `useSimulationContext` (`showExportMenu`, `setShowExportMenu`, `handleExportSVG`, `handleExportPNG`, `handleExportSummary`), `useDialog` (for the "Remove project?" confirm).
- Produces: `Toolbar()` — default export, no props (owns `showDropdown` as local state). `Dashboard({ children }: { children: ReactNode })` — default export; `children` is the mapped `GraphPanel` list, built by `AppShell`/whoever calls `Dashboard` (matches the `Sidebar`/tab-component pattern from Task 13).

- [ ] **Step 1: Find and read the current region**

Run: `grep -n '{/\* Main stacked graph list dashboard \*/}\|{/\* Projects Tab Toolbar \*/}\|dashboardContainerRef' src/App.tsx`

Read from `{/* Main stacked graph list dashboard */}` through the line `<div ref={dashboardContainerRef} className="flex-1 overflow-y-auto flex flex-col gap-8 pr-2">` (inclusive of that opening tag, but not its contents — the `{visibleGraphs.map((mode) => { ... })}` body is Task 18's territory).

- [ ] **Step 2: Create `src/components/dashboard/Toolbar.tsx`**

```tsx
import { useState } from "react";
import { Undo2, Redo2, Ruler, Download, ChevronDown, FileText, Plus, Copy, Trash2 } from "lucide-react";
import { Tooltip } from "../ui";
import { useDialog } from "../ui";
import { useProjectsContext } from "../../context/ProjectsContext";
import { useGraphViewportContext } from "../../context/GraphViewportContext";
import { useSimulationContext } from "../../context/SimulationContext";
import { CurveType } from "../../types";

export default function Toolbar() {
  const { confirmDialog } = useDialog();
  const { projects, activeProjectId, setActiveProjectId, canUndo, canRedo, undo, redo, handleAddNewProject, handleDuplicateProject, handleRemoveProject } = useProjectsContext();
  const { visibleGraphs, setVisibleGraphs, rulerFreq, setRulerFreq } = useGraphViewportContext();
  const { showExportMenu, setShowExportMenu, handleExportSVG, handleExportPNG, handleExportSummary } = useSimulationContext();

  const [showDropdown, setShowDropdown] = useState(false);

  return (
    // ... exact JSX from Step 1's read: the "Simulation Dashboard" header + "Configure Graphs"
    // dropdown, then the "Projects Tab Toolbar" (project pills, each with duplicate/remove
    // buttons — note `handleRenameProject` is called from a rename UI somewhere in this same
    // block per the read; include it in this component's context destructuring if so), then
    // the Undo/Redo/Ruler/Export/New-Project action-buttons row. Unchanged.
  );
}
```

Confirm from Step 1's read whether `handleRenameProject` is actually called in this region (the project pill's name may be editable inline, or renaming might happen elsewhere) — if it is, add it to the `useProjectsContext()` destructuring above; if not, omit it (an unused import/destructure would fail `--noUnusedLocals`).

- [ ] **Step 3: Create `src/components/dashboard/Dashboard.tsx`**

```tsx
import { ReactNode } from "react";
import Toolbar from "./Toolbar";
import { useGraphViewportContext } from "../../context/GraphViewportContext";

export default function Dashboard({ children }: { children: ReactNode }) {
  const { dashboardContainerRef } = useGraphViewportContext();

  return (
    <div className="flex-1 p-8 flex flex-col gap-6 overflow-hidden">
      <Toolbar />
      <div ref={dashboardContainerRef} className="flex-1 overflow-y-auto flex flex-col gap-8 pr-2">
        {children}
      </div>
    </div>
  );
}
```

Confirm the outer wrapper's exact `className` against Step 1's read (`"flex-1 p-8 flex flex-col gap-6 overflow-hidden"` per planning, but re-verify) before finalizing.

- [ ] **Step 4: Update `App.tsx`**

1. Delete the region read in Step 1 from `AppShell`, **except** keep the `{visibleGraphs.map((mode) => { ... })}` loop's body inline for now (Task 18's territory) — wrap it in the new `Dashboard`:

```tsx
<Dashboard>
  {visibleGraphs.map((mode) => {
    /* ...unchanged, still inline... */
  })}
</Dashboard>
```

2. Import: `import Dashboard from "./components/dashboard/Dashboard";`
3. Remove now-unused imports as flagged by `--noUnusedLocals`.

- [ ] **Step 5: Verify**

Run: `npx tsc --noEmit --noUnusedLocals --noUnusedParameters` — expect clean.
Run: `npm run build` — expect clean.

- [ ] **Step 6: Commit**

```bash
git add src/components/dashboard/Dashboard.tsx src/components/dashboard/Toolbar.tsx src/App.tsx
git commit -m "refactor: extract dashboard shell and toolbar into Dashboard.tsx + Toolbar.tsx"
```

---

## Task 18: `GraphPanel.tsx`

**Files:**
- Create: `src/components/dashboard/GraphPanel.tsx`
- Modify: `src/App.tsx` (the `{visibleGraphs.map((mode) => { ... })}` body left inline by Task 17, and `App.tsx`'s `paddingLeft`/`paddingRight`/`paddingTop`/`paddingBottom` constants)

**Interfaces:**
- Consumes: `CurveType` from `../../types`; `useProjectsContext` (`projects`, `activeProjectId`, `setActiveProjectId`, `activeProject` — for per-project curve rendering and the driver's `xmax`/`fs` reference lines), `useGraphViewportContext` (`dashboardWidth`, `graphHeights`, `handleResizeStart`, `graphConfigs`, `getGraphXLimits`, `rulerFreq`, `setRulerFreq`), `useSimulationContext` (`simulationResults`, `getDisplayValue`, `phaseGdData`, `svgRefsMap`, `kaWarningFreq`).
- Produces: `GraphPanel({ mode }: { mode: CurveType })` — default export. This is the one component in this plan that takes a real prop (`mode`) rather than being fully context-driven — it's rendered once per visible graph type, so which graph it renders can't come from context (context is app-wide state, not "which instance of this component is this").

- [ ] **Step 1: Find and read the current region**

Run: `grep -n '{visibleGraphs.map((mode) => {\|paddingLeft = 55\|Drag Resizer Handle Bar' src/App.tsx`

Read from `{visibleGraphs.map((mode) => {` through its matching closing `})}`. This is the single largest JSX region in the file — it contains, per graph mode: the per-project curve line rendering (SVG `<path>` per project, colored by `project.color`), axis labels/gridlines, the F3/F6/F10 and Fs reference lines (transfer/gain graph only), the chuffing-limit and Xmax-limit reference lines (velocity/excursion graphs), the ka-radiation-model warning text, the draggable ruler crosshair and its mouse-drag handling (`isDraggingRuler` — becomes local `useState` in this component, since it's purely this component's own drag-interaction flag), the export-menu trigger wiring via `svgRefsMap`, and the resize handle bar at the bottom of each graph.

Also read `App.tsx`'s `paddingLeft`/`paddingRight`/`paddingTop`/`paddingBottom` constant declarations (currently right before the `updateViewportConfig` function, near the end of the logic section, now likely near wherever Task 10 left `updateViewportConfig`'s old location — search `grep -n "paddingLeft = 55" src/App.tsx`) — these are pure rendering constants with no state, move them to become local `const`s at the top of `GraphPanel.tsx`.

- [ ] **Step 2: Create `src/components/dashboard/GraphPanel.tsx`**

```tsx
import { useState } from "react";
import { CurveType } from "../../types";
import { useProjectsContext } from "../../context/ProjectsContext";
import { useGraphViewportContext } from "../../context/GraphViewportContext";
import { useSimulationContext } from "../../context/SimulationContext";
// ... plus whatever icons/primitives the read JSX uses ...

const paddingLeft = 55;
const paddingRight = 20;
const paddingTop = 45;
const paddingBottom = 40;

export default function GraphPanel({ mode }: { mode: CurveType }) {
  const { projects, activeProjectId, setActiveProjectId, activeProject } = useProjectsContext();
  const { dashboardWidth, graphHeights, handleResizeStart, graphConfigs, getGraphXLimits, rulerFreq, setRulerFreq } = useGraphViewportContext();
  const { simulationResults, getDisplayValue, phaseGdData, svgRefsMap, kaWarningFreq } = useSimulationContext();

  const [isDraggingRuler, setIsDraggingRuler] = useState(false);

  const width = dashboardWidth;
  const height = graphHeights[mode];
  const chartWidth = width - paddingLeft - paddingRight;
  const chartHeight = height - paddingTop - paddingBottom;

  return (
    // ... exact JSX from Step 1's read (everything that was the body of the `.map()` callback,
    // i.e. everything between `const chartHeight = ...;` and the callback's own closing
    // `return (...)` up through its end), unchanged. The `key={mode}` prop that was on the
    // outer element inside `.map()` is dropped here — `GraphPanel` itself doesn't need it,
    // `AppShell`'s `<GraphPanel key={mode} mode={mode} />` call site supplies it (see Step 3).
  );
}
```

Note: the original code's release-ruler-on-mouseup effect (`App.tsx:996-1002` in the original file, moved nowhere yet — check whether Task 10 or Task 11 already relocated it; if not, it belongs here alongside the newly-local `isDraggingRuler`):

```tsx
useEffect(() => {
  if (!isDraggingRuler) return;
  const handleMouseUp = () => setIsDraggingRuler(false);
  window.addEventListener("mouseup", handleMouseUp);
  return () => window.removeEventListener("mouseup", handleMouseUp);
}, [isDraggingRuler]);
```

Add `import { useEffect } from "react";` if this effect is added here. Confirm via `grep -n "isDraggingRuler" src/App.tsx` at the start of this task whether it's still sitting unclaimed in `App.tsx` (expected) or was already moved by an earlier task (in which case, move it from wherever it ended up instead).

- [ ] **Step 3: Update `App.tsx`**

1. Delete the `{visibleGraphs.map((mode) => { ... })}` body (keep the `.map()` wrapper structure, replace its callback) and the `paddingLeft`/`paddingRight`/`paddingTop`/`paddingBottom` constants from `AppShell`:

```tsx
{visibleGraphs.map((mode) => (
  <GraphPanel key={mode} mode={mode} />
))}
```

2. Import: `import GraphPanel from "./components/dashboard/GraphPanel";`
3. Remove now-unused imports as flagged by `--noUnusedLocals`.

- [ ] **Step 4: Verify**

Run: `npx tsc --noEmit --noUnusedLocals --noUnusedParameters` — expect clean.
Run: `npm run build` — expect clean.

- [ ] **Step 5: Commit**

```bash
git add src/components/dashboard/GraphPanel.tsx src/App.tsx
git commit -m "refactor: extract per-graph rendering into GraphPanel.tsx"
```

---

## Task 19: `SettingsModal.tsx`

**Files:**
- Create: `src/components/modals/SettingsModal.tsx`
- Modify: `src/App.tsx` (the `{/* Settings Modal */}` / `{showSettings && (...)}` block)

**Interfaces:**
- Consumes: `useModalsContext` (`showSettings`, `setShowSettings`), `useThemeContext` (`currentTheme`, `setCurrentTheme`, `handleCustomColorChange`, `activePresetKey`), `useGraphViewportContext` (`configEditType`, `setConfigEditType`, `graphConfigs`, `updateViewportConfig`, `globalXMin`, `setGlobalXMin`, `globalXMax`, `setGlobalXMax`, `overrideXLimits`, `setOverrideXLimits`), `PRESETS` from `../../theme`.
- Produces: `SettingsModal()` — default export, no props (returns `null` internally when `showSettings` is false, matching the original `{showSettings && (...)}` guard — or `AppShell` keeps that guard at the call site; confirm which reads more naturally against the live JSX and match the existing modal-visibility pattern already used elsewhere in the file, if any precedent exists from how `App.tsx` currently structures the `{showSettings && (` conditional).

- [ ] **Step 1: Find and read the current region**

Run: `grep -n '{/\* Settings Modal \*/}\|{showSettings &&' src/App.tsx`

Read from `{/* Settings Modal */}` through the matching closing `)}`. This is the theme customizer (preset `Select`, 9 color swatches), the Graph Viewport Calibration section (curve-to-calibrate `Select`, global X-axis limits, per-curve Auto-Scale-Y / Override-X-Limits toggles, Y-axis floor/ceiling), and the Close Settings button.

- [ ] **Step 2: Create `src/components/modals/SettingsModal.tsx`**

```tsx
import { Select, Button } from "../ui"; // confirm exact primitives from Step 1's read
import { X } from "lucide-react";
import { PRESETS } from "../../theme";
import { useModalsContext } from "../../context/ModalsContext";
import { useThemeContext } from "../../context/ThemeContext";
import { useGraphViewportContext } from "../../context/GraphViewportContext";

export default function SettingsModal() {
  const { showSettings, setShowSettings } = useModalsContext();
  const { currentTheme, setCurrentTheme, handleCustomColorChange, activePresetKey } = useThemeContext();
  const { configEditType, setConfigEditType, graphConfigs, updateViewportConfig, globalXMin, setGlobalXMin, globalXMax, setGlobalXMax, overrideXLimits, setOverrideXLimits } = useGraphViewportContext();

  if (!showSettings) return null;

  return (
    // ... exact JSX from Step 1's read (the modal overlay + panel body), unchanged ...
  );
}
```

- [ ] **Step 3: Update `App.tsx`**

Replace the `{showSettings && (...)}` block with `<SettingsModal />` (unconditional call site — the component's own internal `if (!showSettings) return null;` handles visibility, so `AppShell` no longer needs the guard). Import: `import SettingsModal from "./components/modals/SettingsModal";`. Remove now-unused imports as flagged by `--noUnusedLocals`.

- [ ] **Step 4: Verify**

Run: `npx tsc --noEmit --noUnusedLocals --noUnusedParameters` — expect clean.
Run: `npm run build` — expect clean.

- [ ] **Step 5: Commit**

```bash
git add src/components/modals/SettingsModal.tsx src/App.tsx
git commit -m "refactor: extract Settings modal JSX into SettingsModal.tsx"
```

---

## Task 20: `DriverBrowserModal.tsx`

**Files:**
- Create: `src/components/modals/DriverBrowserModal.tsx`
- Modify: `src/App.tsx` (the `{/* Driver Database Modal */}` / `{showBrowser && (...)}` block)

**Interfaces:**
- Consumes: `useDriverDatabaseContext` (`showBrowser`, `setShowBrowser`, `searchQuery`, `setSearchQuery`, `filteredDrivers`, `browserCallback`, `setBrowserCallback`, `setShowAddForm` — for the "Add Driver" button), `useProjectsContext` (`activeProject`, `updateActiveProject` — for "Load Driver" when there's no `browserCallback`), `Driver` from `../../types`. Also needs a way to trigger edit-mode on a driver — per Task 12's Note, `handleStartEditDriver` no longer exists as a plain `AppShell` function; this modal's "Edit" pencil icon button needs it. Resolve this the same way Task 21 resolves it for the Add form (see Task 21's Step 1) — read the live code to see exactly how `App.tsx` currently wires this button before this task started, since Task 12 may have already adapted it.

- [ ] **Step 1: Find and read the current region, and check how the Edit button currently calls into driver-form state**

Run: `grep -n '{/\* Driver Database Modal \*/}\|{showBrowser &&\|handleStartEditDriver' src/App.tsx`

Read from `{/* Driver Database Modal */}` through its matching closing `)}`: the search field + "Add Driver" button header, the driver-card grid (manufacturer/model/Fs/Qts/Vas/Sens display, "Active" badge, "Load Driver" + Edit-pencil buttons per card), and the empty state.

Also check how the "Edit" pencil button's `onClick` currently reads, post-Task-12 — it needs to set `editingDriverId` (in `useDriverDatabaseContext`) **and** pre-fill all 14 form fields (in `useDriverFormContext`, only reachable from inside `DriverFormProvider`'s subtree) **and** open the Add form (`setShowAddForm(true)`, also `useDriverDatabaseContext`). Since `DriverBrowserModal` is a sibling of `AddDriverModal`, not a descendant of `DriverFormProvider` (that provider wraps only the Add/Edit modal), `DriverBrowserModal`'s Edit button **cannot** call `useDriverFormContext()` directly to pre-fill fields.

- [ ] **Step 2: Resolve the Edit-button boundary**

The cleanest fix, consistent with this hook's scoping: have `DriverDatabaseContext`'s `setEditingDriverId` be the only thing `DriverBrowserModal`'s Edit button needs to call, plus `setShowAddForm(true)`. Move the *pre-fill* logic (setting all 14 `newX` fields from the clicked driver's values) into `AddDriverModal.tsx` itself, as an effect that runs when `editingDriverId` changes to a non-null value:

```tsx
// inside AddDriverModal.tsx (Task 21), not here:
useEffect(() => {
  if (!editingDriverId) return;
  const driver = drivers.find(d => d.id === editingDriverId);
  if (!driver) return;
  setNewManufacturer(driver.manufacturer);
  setNewModel(driver.model);
  setNewFs(driver.fs.toString());
  // ...one line per field, same assignments as the original handleStartEditDriver body...
  setPistonDiameter("");
}, [editingDriverId]);
```

This way, `DriverBrowserModal`'s Edit button only needs `useDriverDatabaseContext()`'s `setEditingDriverId`/`setShowAddForm` — both already in its natural context — and the actual field pre-fill lives where the fields themselves live (`AddDriverModal.tsx`, Task 21), triggered reactively rather than imperatively. This is a deliberate, small design improvement over a literal verbatim port (an imperative `handleStartEditDriver()` call site spanning two components' contexts has no clean home; an effect reacting to `editingDriverId` does) — flag it as such rather than presenting it as a mechanical move, since Global Constraints calls for verbatim moves as the default and this is a documented, justified exception.

The "Add Driver" (new, not edit) button's flow is simpler: it only needs `setEditingDriverId(null)` + `setShowAddForm(true)` from `DriverBrowserModal`'s own natural context — `AddDriverModal`'s reset-to-defaults behavior (the old `handleStartAddDriver`'s field-clearing) becomes a second small effect in `AddDriverModal.tsx`, or is simply the `useDriverForm` hook's initial `useState` defaults firing naturally each time the modal transitions from closed to open with `editingDriverId === null` — decide which based on whether the original `handleStartAddDriver` reset behavior is actually needed (re-opening the Add form after a previous Edit session, without a full remount, might otherwise leave stale field values) — read `App.tsx`'s current `handleStartAddDriver` body (or Task 12's captured version of it, `App.tsx:1310-1329` at planning time) to confirm exactly what it reset, and replicate that via a similar `useEffect` keyed on `showAddForm` transitioning to `true` with `editingDriverId === null`.

- [ ] **Step 3: Create `src/components/modals/DriverBrowserModal.tsx`**

```tsx
import { Database } from "lucide-react";
import { TextField, Button } from "../ui"; // confirm exact primitives from Step 1's read
import { useDriverDatabaseContext } from "../../context/DriverDatabaseContext";
import { useProjectsContext } from "../../context/ProjectsContext";

export default function DriverBrowserModal() {
  const { showBrowser, setShowBrowser, searchQuery, setSearchQuery, filteredDrivers, browserCallback, setBrowserCallback, setShowAddForm, setEditingDriverId } = useDriverDatabaseContext();
  const { activeProject, updateActiveProject } = useProjectsContext();

  if (!showBrowser) return null;

  return (
    // ... exact JSX from Step 1's read, with the Edit button's onClick now
    // `() => { setEditingDriverId(driver.id); setShowAddForm(true); }` per Step 2's resolution,
    // and the "Add Driver" header button's onClick now
    // `() => { setEditingDriverId(null); setShowAddForm(true); }` ...
  );
}
```

- [ ] **Step 4: Update `App.tsx`**

Replace the `{showBrowser && (...)}` block with `<DriverBrowserModal />`. Import: `import DriverBrowserModal from "./components/modals/DriverBrowserModal";`. Remove now-unused imports as flagged by `--noUnusedLocals`.

- [ ] **Step 5: Verify**

Run: `npx tsc --noEmit --noUnusedLocals --noUnusedParameters` — expect clean.
Run: `npm run build` — expect clean.

- [ ] **Step 6: Commit**

```bash
git add src/components/modals/DriverBrowserModal.tsx src/App.tsx
git commit -m "refactor: extract Driver Browser modal JSX into DriverBrowserModal.tsx"
```

---

## Task 21: `AddDriverModal.tsx`

**Files:**
- Create: `src/components/modals/AddDriverModal.tsx`
- Modify: `src/App.tsx` (the `AddDriverModalInline` component built inline during Task 12, and its `<DriverFormProvider>` wrapper)

**Interfaces:**
- Consumes: `useDriverDatabaseContext` (`showAddForm`, `setShowAddForm`, `editingDriverId`, `drivers`), `useDriverFormContext` (everything — all 14+2 fields, `handleAddDriver`, `handleAutoEstimateTS`, `handleVerifyParameters`, `checkDriverConsistency` if it's still here rather than moved to `lib/calculations.ts` by Task 14's Step 2), `DriverFormProvider`.
- Produces: `AddDriverModal()` — default export, no props, wraps its own contents in `DriverFormProvider` internally (so `AppShell`'s call site is just `<AddDriverModal />`, no provider wiring needed there).

- [ ] **Step 1: Locate `AddDriverModalInline` (built during Task 12) and the two pre-fill/reset effects (built during Task 20)**

By this point, `App.tsx` contains a function (named `AddDriverModalInline` per Task 12's Step 5, or whatever name that task actually used — check) that already: calls `useDriverFormContext()` at its top level, defines/uses the edit-mode pre-fill effect and add-mode reset effect from Task 20's Step 2, and renders the Add/Edit Driver Modal's full JSX (Manufacturer/Model fields, the 13 Thiele-Small `NumberField`s + Qts special case, Piston Diameter/Nominal Impedance raw inputs, Verify Parameters/Cancel/Save Driver buttons). Read it in full.

- [ ] **Step 2: Create `src/components/modals/AddDriverModal.tsx`**

Move the function found in Step 1 here almost unchanged — rename it `AddDriverModal` (from `AddDriverModalInline`), keep it a default export, and wrap its returned JSX in the `<DriverFormProvider>` that used to sit at its call site in `App.tsx`:

```tsx
import { useEffect } from "react";
import { X, Sliders, Info } from "lucide-react";
import { TextField, NumberField, Select, Button } from "../ui"; // confirm exact primitives
import { DriverFormProvider, useDriverFormContext } from "../../context/DriverFormContext";
import { useDriverDatabaseContext } from "../../context/DriverDatabaseContext";

function AddDriverModalContent() {
  // ... exact body from Step 1's read: the useDriverFormContext() call, the pre-fill/reset
  // effects, the `if (!showAddForm) return null;` guard (confirm this guard exists in the
  // Step 1 read — Task 12 may or may not have added one; if not, match the pattern
  // Tasks 19-20 used and add one here for consistency), and the full modal JSX ...
}

export default function AddDriverModal() {
  return (
    <DriverFormProvider>
      <AddDriverModalContent />
    </DriverFormProvider>
  );
}
```

- [ ] **Step 3: Update `App.tsx`**

Delete `AddDriverModalInline`/`AddDriverModalContent` and its `<DriverFormProvider>` wrapper from `AppShell`'s JSX entirely. Replace the call site with `<AddDriverModal />`. Import: `import AddDriverModal from "./components/modals/AddDriverModal";`. Remove now-unused imports as flagged by `--noUnusedLocals`.

- [ ] **Step 4: Verify**

Run: `npx tsc --noEmit --noUnusedLocals --noUnusedParameters` — expect clean.
Run: `npm run build` — expect clean.

- [ ] **Step 5: Commit**

```bash
git add src/components/modals/AddDriverModal.tsx src/App.tsx
git commit -m "refactor: extract Add/Edit Driver modal JSX into AddDriverModal.tsx"
```

---

## Task 22: Trim `App.tsx` to a thin composition root

**Files:**
- Modify: `src/App.tsx`

**Interfaces:**
- Consumes: everything produced by Tasks 5-21 (`ThemeProvider`, `ModalsProvider`, `DriverDatabaseProvider`, `SignalProcessingProvider`, `ProjectsProvider`, `GraphViewportProvider`, `SimulationProvider`, and their `useXContext()` counterparts; `Sidebar`, `DriverTab`, `EnclosureTab`, `SignalTab`, `Dashboard`, `GraphPanel`, `SettingsModal`, `DriverBrowserModal`, `AddDriverModal`).
- Produces: `App` — the default export, unchanged from the outside (same component, same behavior).

By this point `AppShell` should be nearly empty — Tasks 5-21 moved every state slice into a hook and every JSX region into a component. Two things never got explicitly assigned to any task, because they're genuinely cross-cutting composition-root concerns rather than any single domain's — this task gives them a home.

- [ ] **Step 1: Find and check the two unclaimed effects**

Run: `grep -n "Auto-save session state\|Keyboard shortcuts" src/App.tsx`

If either is still present in `AppShell` (expected — no earlier task claimed them), they stay in `AppShell`, but now read their inputs from the contexts `AppShell` already calls into (rather than local variables). Confirm both are still there before proceeding; if some earlier task's implementer already relocated one (e.g. folded the session-save effect into `useProjects` by mistake), stop and reconcile: pull it back out into `AppShell`, since these two effects each depend on state spanning 3+ hooks and don't belong inside any single one of them.

**The session-auto-save effect** — reads `projects`, `activeProjectId` (Task 9's `useProjectsContext`), `visibleGraphs`, `globalXMin`, `globalXMax`, `overrideXLimits`, `graphConfigs`, `rulerFreq`, `graphHeights` (Task 10's `useGraphViewportContext`), `sidebarTab`, `sidebarSectionState` (Task 6's `useModalsContext`), `filters`, `roomConfig`, `cabinConfig` (Task 8's `useSignalProcessingContext`) — writes them all into one `localStorage` blob. Its body (originally `App.tsx:1005-1027`) is unchanged; only the source of its dependency-array variables changes (now destructured from the four contexts above instead of local `useState`).

**The keyboard-shortcuts effect** — reads `undo`/`redo` (Task 9's `useProjectsContext`). Its body (originally `App.tsx:974-983`) is unchanged.

- [ ] **Step 2: Verify `AppShell`'s final shape**

After Step 1, `AppShell`'s body should be close to:

```tsx
function AppShell() {
  const { sidebarTab } = useModalsContext();
  const { visibleGraphs } = useGraphViewportContext();
  // ... plus whatever destructuring the two effects from Step 1 need ...

  // keyboard shortcuts effect
  // session auto-save effect

  return (
    <div className="flex h-screen w-screen overflow-hidden font-sans transition-colors duration-150"
      style={{ backgroundColor: "var(--bg-color)", color: "var(--text-color)" }}>
      <Sidebar>
        {sidebarTab === "driver" && <DriverTab />}
        {sidebarTab === "enclosure" && <EnclosureTab />}
        {sidebarTab === "signal" && <SignalTab />}
      </Sidebar>
      <Dashboard>
        {visibleGraphs.map((mode) => (
          <GraphPanel key={mode} mode={mode} />
        ))}
      </Dashboard>
      <SettingsModal />
      <DriverBrowserModal />
      <AddDriverModal />
    </div>
  );
}

export default function App() {
  return (
    <DriverDatabaseProvider>
      <ModalsProvider>
        <ThemeProvider>
          <ProjectsProvider>
            <SignalProcessingProvider>
              <GraphViewportProvider>
                <SimulationProvider>
                  <AppShell />
                </SimulationProvider>
              </GraphViewportProvider>
            </SignalProcessingProvider>
          </ProjectsProvider>
        </ThemeProvider>
      </ModalsProvider>
    </DriverDatabaseProvider>
  );
}
```

If `AppShell` still contains any JSX beyond the outer `<div>`/`<Sidebar>`/`<Dashboard>`/three modals structure above, or any state/handler declaration beyond the two effects from Step 1, that's a sign an earlier task's extraction was incomplete — go back and check which task's region it belongs to (match it against that task's "Interfaces: Produces" list) rather than leaving it here.

- [ ] **Step 3: Remove dead imports and unused code**

Run `npx tsc --noEmit --noUnusedLocals --noUnusedParameters` and fix every reported unused import/variable in `App.tsx` — by this point there are likely several (icons, primitives, types that were only used by JSX that's now in other files).

Run: `wc -l src/App.tsx` — expect well under 200 lines (down from 5,759 at the start of this plan). If it's still large, something wasn't fully extracted; re-check against Step 2's expected shape.

- [ ] **Step 4: Verify**

Run: `npx tsc --noEmit --noUnusedLocals --noUnusedParameters` — expect clean.
Run: `npm run build` — expect clean.
Run: `npx vitest run` — expect all tests passing.

- [ ] **Step 5: Commit**

```bash
git add src/App.tsx
git commit -m "refactor: trim App.tsx to a thin composition root"
```

---

## Task 23: Final verification pass

**Files:** None modified — verification only.

- [ ] **Step 1: Full build + typecheck**

Run: `npx tsc --noEmit --noUnusedLocals --noUnusedParameters`
Expected: succeeds with zero errors.

Run: `npm run build`
Expected: succeeds.

- [ ] **Step 2: Full test suite**

Run: `npx vitest run`
Expected: every test from Tasks 3, 8, 9, 10, 12 passes (calculations, useSignalProcessing, useProjects, useGraphViewport, useDriverForm).

- [ ] **Step 3: Confirm the file-size goal was met**

Run: `wc -l src/App.tsx src/hooks/*.ts src/context/*.tsx src/components/sidebar/*.tsx src/components/dashboard/*.tsx src/components/modals/*.tsx src/lib/*.ts src/types.ts`

Expected: `App.tsx` well under 200 lines; no single file in `hooks/`, `context/`, `components/sidebar/`, `components/dashboard/`, or `components/modals/` exceeds roughly 600 lines (the two largest are expected to be `EnclosureTab.tsx` and `GraphPanel.tsx`, given they were the two largest JSX regions in the original file — if either is dramatically larger than that, it's worth a look, though not automatically wrong).

- [ ] **Step 4: Confirm no behavior-affecting regression markers**

Run:
```bash
grep -rn "TODO\|FIXME\|XXX" src/
```
Expected: no output (or only pre-existing ones unrelated to this plan — check `git log -p` for any such comment's origin if one appears).

Run:
```bash
grep -c "useState" src/App.tsx
```
Expected: 0 — every `useState` call should have moved into a hook by Task 22.

- [ ] **Step 5: Confirm no unintended backend changes**

Run:
```bash
git status --short src-tauri/src/
git diff --stat main -- src-tauri/src/
```
Expected: both empty — this plan's Global Constraints forbade touching `src-tauri/src/*.rs`, and nothing in any task should have.

- [ ] **Step 6: Manual walkthrough — do this in the running app, not just by reading code**

This plan's execution environment has no interactive browser access, matching the same limitation the prior UI/UX overhaul plan hit — every task's `tsc`/`build`/test verification substitutes for it, but a real walkthrough is still the strongest signal for a restructuring of this size. Once this task's automated checks are clean, run `npm run tauri dev` and click through, at minimum:

- Switch between Driver / Enclosure / Signal sidebar tabs — confirm each renders its full content.
- Add a driver (Driver Database → Add Driver), edit an existing one, load one into the active project.
- Toggle a few `CollapsibleSection`s open/closed, reload the app, confirm the open/closed state persisted (this exercises the session-auto-save effect from Task 22 — the highest-risk leftover piece, since it was reassembled from four different contexts).
- Undo/redo a change (Ctrl+Z / Ctrl+Y) — confirms Task 22's keyboard-shortcut effect still reads the right `undo`/`redo`.
- Add/remove an EQ filter, toggle Room Simulation and drag a speaker on the floor plan, toggle Cabin Gain — confirms `useSignalProcessing`/`SignalTab` wiring.
- Switch enclosure type, try Auto-Align, try Auto-Calculate Venting — confirms `useSimulation`'s cross-context composition.
- Resize a graph panel, toggle a graph's visibility via "Configure Graphs", drag the ruler — confirms `useGraphViewport`/`GraphPanel`/`Toolbar` wiring.
- Open Settings, change a theme preset and a custom color, change a graph's calibration limits — confirms `useTheme`/`SettingsModal`/`useGraphViewport` wiring.
- Save a project to a `.wproj` file, then open it back up — confirms `useProjects`' save/load round-trip through the Rust backend is unaffected.

If any check above fails, go back to the task that owns the affected region (cross-reference against each task's "Interfaces: Produces" list), fix, and re-run this task's automated checks before considering the plan complete.

- [ ] **Step 7: Report**

No commit for this task (verification only). Summarize: final `App.tsx` line count vs. the starting 5,759; total new files created; test count; any manual-walkthrough findings and their resolution.

---

## Self-Review Notes

- **Spec coverage:** Directory structure (spec Architecture) → File Structure section + Tasks 1-21's file lists. Hook/Context ownership table (spec Architecture) → Tasks 5-12, each task's header cross-references the design doc's table and documents where planning refined it (Task 7's consolidation of driver-modal state; Task 11's exclusion of export handlers from `useGraphViewport` to avoid a hook cycle). Local-vs-shared-state principle (spec Architecture, Principles) → `DimensionCalculator.tsx` (Task 15), `showDropdown` in `Toolbar.tsx` (Task 17), `isDraggingRuler` in `GraphPanel.tsx` (Task 18) are all local `useState`, not hooks. Provider-scoping principle (spec Architecture, Principles) → `DriverFormProvider` wraps only `AddDriverModal` (Tasks 12, 21), never the app root. Testing strategy (spec Testing strategy) → Vitest+RTL setup and pure-function tests in Task 3; hook tests alongside extraction in Tasks 8, 9, 10, 12 (Task 11's `useSimulation` is the one hook without tests, with its gap explicitly justified in that task rather than silently skipped, consistent with the spec's Risks section on being upfront about coverage gaps). Migration order (spec Migration order) → Tasks 1-4 (types/lib/diagram) before Tasks 5-12 (hooks) before Tasks 13-21 (JSX), matching the spec's stated lowest-risk-first sequencing exactly.
- **Placeholder scan:** every task's JSX-extraction steps that couldn't be verbatim-quoted (Tasks 13-21, since absolute line numbers go stale after Tasks 1-12's edits) instead give an exact `grep` pattern to relocate the region live, plus a precise description of that region's contents confirmed during this plan's own reading pass — not a vague "move the relevant JSX." Every hook task (5-12) gives the complete, exact function bodies moved verbatim from a specific, cited line range read during planning. No task says "add appropriate error handling" or similar — every step either shows exact code or names an exact live-file search.
- **Type consistency:** every hook's return-value shape declared in its task's "Interfaces: Produces" line is used identically by every downstream task that consumes it (e.g. `useSimulationContext`'s `handleApplyAlignment: (alignmentPref: ...) => Promise<void>` signature, changed from the original's zero-arg closure in Task 11, is referenced consistently in Task 11's own `App.tsx` call-site fix and again in Task 15's `EnclosureTab.tsx`, which is the only other place it's called). Two gaps found and fixed during this self-review: the session-auto-save effect and the keyboard-shortcut effect (both cross-cutting, spanning 3+ hooks each) were not assigned to any of Tasks 5-21 during initial drafting — both are now explicitly handled in Task 22, with their exact dependencies and original line ranges documented.
