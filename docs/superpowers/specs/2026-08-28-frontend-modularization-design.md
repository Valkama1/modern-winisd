# Frontend Modularization Design

Date: 2026-08-28

## Goal

`src/App.tsx` is 5,759 lines: a single component that owns roughly 45
`useState` slices, ~25 handler functions, a dozen `useMemo`/`useCallback`
derived values, one standalone helper component, and ~4,600 lines of JSX
covering the entire UI surface (three sidebar tabs, the graph dashboard, and
three modals). This makes the codebase hard to navigate, hard to reason
about (any change risks an unrelated part of the file), and hard to test
(nothing in it is isolated enough to test in isolation).

This project restructures the frontend into focused modules — types, pure
calculation functions, custom hooks that own state by domain, React Context
to distribute that state without prop-drilling, and presentational
components per UI region — without changing what the app does or how it
looks. It also adds a baseline test setup (Vitest + `@testing-library/react`)
so the riskiest part of this move (state logic relocation) has real
verification beyond "it compiles."

Priority is long-term maintainability and readability, not minimizing this
project's diff size — where a choice trades a bit more work now for a
meaningfully better resulting structure, take it.

## Non-goals

- No behavior changes, no new features, no visual changes. This is a pure
  restructuring of already-working code.
- No change to the Rust backend (`src-tauri/src/*.rs`).
- No full component/DOM rendering test suite (would require mocking Tauri's
  `invoke`, canvas/SVG rendering — a separate, larger investment). Testing
  here targets pure functions and hook logic, not rendered output.
- No new state-management library (Redux, Zustand, etc.) — React's built-in
  `useState`/`useContext`/custom hooks are sufficient at this app's scale
  and keep the dependency surface small.
- Not touching `theme.ts` or `App.css` beyond what's needed to import from
  their new call sites — they're already reasonably scoped, standalone
  files.

## Architecture

### Directory structure

```
src/
  types.ts                     # Driver, Project, CurveType, EnclosureType, CustomTopologySpec
                                # family, EqFilter, RoomConfig, GraphViewportConfig
  lib/
    calculations.ts            # pure T/S math, filter/room-correction math, port length,
                                # findLFCrossover, getDisplayValue
    calculations.test.ts
    session.ts                 # loadSavedSession / session persistence
  hooks/
    useProjects.ts             # + useProjects.test.ts
    useTheme.ts
    useGraphViewport.ts        # + useGraphViewport.test.ts
    useSignalProcessing.ts     # + useSignalProcessing.test.ts
    useSimulation.ts
    useModals.ts
    useDriverDatabase.ts
    useDriverForm.ts           # + useDriverForm.test.ts
  context/
    ProjectsContext.tsx
    ThemeContext.tsx
    GraphViewportContext.tsx
    SignalProcessingContext.tsx
    SimulationContext.tsx
    ModalsContext.tsx
    DriverDatabaseContext.tsx
    DriverFormContext.tsx      # provider scoped to AddDriverModal only, not the app root
  components/
    ui/                        # existing primitives — untouched
    CustomTopologyDiagram.tsx
    sidebar/
      DriverTab.tsx
      EnclosureTab.tsx
      SignalTab.tsx
      DimensionCalculator.tsx  # owns its own local state (see below)
    dashboard/
      Toolbar.tsx
      GraphPanel.tsx
    modals/
      SettingsModal.tsx
      DriverBrowserModal.tsx
      AddDriverModal.tsx
  App.tsx                      # composition root: mounts providers, renders top-level layout
  theme.ts / App.css            # unchanged
```

### Hooks & Context — ownership table

| Hook / Context | Owns | Provider scope | Consumed by |
|---|---|---|---|
| `useProjects` | `projects`, `activeProjectId`, `activeProject` (derived), undo/redo stack, `updateActiveProject`, new/duplicate/rename/remove/save/open handlers | App root | almost everything |
| `useTheme` | `currentTheme`, preset selection, color customization | App root | Settings modal, theme-apply effect |
| `useGraphViewport` | `visibleGraphs`, `graphConfigs`, x/y-axis limits, `dashboardWidth`, `graphHeights`, resize handling, `rulerFreq` (shared: Toolbar toggles it, GraphPanel displays it), `showExportMenu` (per-graph, needs to be exclusive across graphs) | App root | Dashboard, GraphPanel, Settings (calibration) |
| `useSignalProcessing` | `filters` (EQ), `roomConfig`, `cabinConfig` + add/remove/update handlers | App root | SignalTab, `useSimulation` |
| `useSimulation` | `simulationResults`, `systemStats`, port length, ka-warning freq, filter/room/cabin response functions, `phaseGdData`, auto-port/auto-align handlers. Composed internally from `useProjects` + `useSignalProcessing` — does not receive them as props. | App root | GraphPanel, SignalTab, EnclosureTab |
| `useModals` | which full-screen modal is open (browser/add-form/settings), `sidebarTab`, `sidebarSectionState` | App root | Toolbar, sidebar tabs, all three modals |
| `useDriverDatabase` | `drivers` list, `searchQuery`, `filteredDrivers` | App root | DriverBrowserModal |
| `useDriverForm` | the 14 T/S form fields, estimate/verify/submit handlers | **Scoped to `AddDriverModal`'s subtree only** | AddDriverModal only |

Local `useState` (no hook, no context) for state that's genuinely scoped to
one region: the Dimension Calculator's fields (move into
`DimensionCalculator.tsx`), `roomDragging`/floor-plan pointer state,
`isDraggingRuler` (the ruler drag-in-progress flag — distinct from
`rulerFreq` itself, which is shared, see above), `hoveredFreq`. Promoting
these to shared state would add indirection with no consumer benefit, and —
for the frequently-updated ones (drag/hover) — would broaden Context
re-render domains unnecessarily.

### Principles

- **State ownership doesn't fragment across files silently.** Each hook is
  the single place its slice of state is declared, read, and mutated;
  components consume it via `useContext`, never via a prop path more than
  one level from that hook's provider.
- **Context providers scope to where they're needed.** Most wrap the app
  root since most state is broadly needed; `useDriverForm`'s wraps only
  `AddDriverModal`.
- **Contexts stay domain-split, not one root object.** Avoids a single
  "God context" whose consumers all re-render on any change anywhere.
- **Cross-domain composition happens inside hooks, not at call sites.**
  `useSimulation` reads `useProjects`/`useSignalProcessing`'s context values
  internally; components that need simulation output don't also need to
  know it depends on projects and filters.

## Testing strategy

- **Vitest**, added as a dev dependency, `npm test` → `vitest run`.
- **Pure functions** (`lib/calculations.ts`): direct unit tests — T/S
  parameter math, filter gain, room correction, port length derivation,
  `findLFCrossover`.
- **Custom hooks** with real logic (`useProjects`, `useGraphViewport`,
  `useSignalProcessing`, `useDriverForm`): tested via
  `@testing-library/react`'s `renderHook`/`act` — e.g. "adding a filter
  appends to `filters`," "undo restores the previous project state,"
  "`updateActiveProject` merges partial updates correctly." This is the
  actual risk surface of this project (state logic moved between
  closures) and is cheap to verify without rendering anything.
- **No full component/DOM tests** — see Non-goals. Presentational
  components are verified via `tsc --noEmit`, `npm run build`, and manual
  diffing of extracted JSX against the original, the same way the prior
  UI/UX pass verified its region extractions.
- Hook tests are written in the same task as that hook's extraction, not
  deferred to a later pass — a broken extraction should fail immediately.

## Migration order

Lowest-risk first, each step independently buildable and typecheckable:

1. `types.ts` — pure type/interface extraction.
2. `lib/calculations.ts` + `lib/session.ts` + Vitest/RTL setup + first
   tests. These functions are already module-level in `App.tsx` (outside
   the component), so this is a file move plus import fix-ups, not a
   logic change.
3. `CustomTopologyDiagram` → its own file — already a standalone component
   with no closure dependency on `App`'s state.
4. Hooks + their Context providers, one domain at a time, in the order
   listed in the ownership table above (`useProjects` first, since almost
   everything depends on it; `useDriverForm` last, since it's the most
   self-contained). At this stage `App.tsx` still assembles the top-level
   JSX itself, now calling hooks instead of declaring `useState` directly
   — this isolates "did the state move correctly" (verified by that hook's
   tests) from "did the components get rewired correctly" (next step).
5. Presentational components, one region at a time (DriverTab →
   EnclosureTab → SignalTab → Toolbar → GraphPanel → SettingsModal →
   DriverBrowserModal → AddDriverModal), each rewritten to consume context
   directly rather than receiving everything via props.
6. Final pass: confirm `App.tsx` is now a thin composition root (mounts
   providers, renders the top-level layout), remove any prop-threading
   that's no longer needed, full verification sweep (`tsc`, `build`,
   `vitest run`).

## Risks & mitigations

- **Largest risk: subtle logic changes when handlers move into hooks**
  (stale closures, changed dependency arrays, effect timing). Mitigated by
  hook tests written alongside each extraction, and by moving handlers
  as close to verbatim as possible — this is a restructuring project, not
  a rewrite; don't "improve" logic while relocating it.
- **No live browser in this environment** to catch visual/interactive
  regressions. Mitigated by `tsc`'s strong wiring guarantees (missing/
  mismatched props and context values are compile errors here, not silent
  runtime bugs), hook tests for logic, and a recommendation that the user
  do a manual smoke-test pass once this lands.
- **Context re-render cost**: domain-split contexts and keeping
  high-frequency local state (drag/hover) out of them keeps re-render
  domains reasonably tight; not doing a memoization pass as part of this
  project — flag as a follow-up only if it turns out to matter.
