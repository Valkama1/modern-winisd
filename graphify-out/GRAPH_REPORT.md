# Graph Report - winisd  (2026-08-31)

## Corpus Check
- 167 files · ~87,001 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 911 nodes · 2406 edges · 43 communities (29 shown, 7 thin omitted)
- Extraction: 96% EXTRACTED · 4% INFERRED · 0% AMBIGUOUS · INFERRED: 98 edges (avg confidence: 0.84)
- Token cost: 27,000 input · 9,000 output

## Community Hubs (Navigation)
- Sidebar Enclosure Forms
- Graph Rendering Layers
- Simulation Request Plumbing
- Alignment Solver Search
- Physics Helpers & Driver Limits
- Circuit Solver & Topologies
- Modals & UI Primitives
- Toolbar, Theme & Curve Catalogue
- Project Types & Persistence
- Filesystem Storage & Scope Guard
- README, CI & Cross-Language Pinning
- Tauri App Config & Icons
- TypeScript Compiler Config
- Dev Dependencies
- Sidebar & Simulation Tests
- Runtime Dependencies
- Graph Geometry Tests
- Port Sizing Recommendation
- Viewport & Workspace Tests
- Workspace & Project Defaults
- npm Scripts
- Tauri Capability Permissions
- Node Build Tsconfig
- Signal Tab Tests
- Render Cost Benchmark
- Session Autosave
- Package Identity
- Theme Contrast Checker
- Enclosure Tab Tests
- ESLint Core Package
- React Hooks Lint Plugin
- React Refresh Lint Plugin
- React Testing Library
- React Type Definitions
- TypeScript ESLint
- Cargo Package

## God Nodes (most connected - your core abstractions)
1. `useProjectsContext()` - 59 edges
2. `simulate_system()` - 44 edges
3. `bc21()` - 36 edges
4. `driver()` - 27 edges
5. `useModalsContext()` - 27 edges
6. `request()` - 26 edges
7. `solve_alignment()` - 25 edges
8. `useSimulationContext()` - 25 edges
9. `makeProject()` - 24 edges
10. `DriverParams` - 23 edges

## Surprising Connections (you probably didn't know these)
- `frontend job (TypeScript)` --references--> `Vite module entry /src/main.tsx`  [INFERRED]
  .github/workflows/ci.yml → index.html
- `rust job (Clippy + cargo test)` --references--> `Auto-alignment solver`  [INFERRED]
  .github/workflows/ci.yml → README.md
- `portGeometry (pinned across Rust/TS)` --conceptually_related_to--> `Enclosure topologies`  [INFERRED]
  .github/workflows/ci.yml → README.md
- `effectiveVas (pinned across Rust/TS)` --conceptually_related_to--> `Modified nodal analysis solver`  [INFERRED]
  .github/workflows/ci.yml → README.md
- `Vite module entry /src/main.tsx` --implements--> `Tauri + React/TypeScript + Rust stack`  [INFERRED]
  index.html → README.md

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Limits drawn on the model rather than left implicit** — readme_ka_0_5_piston_limit, readme_maximum_spl, readme_alignment_constraints, readme_driver_database, readme_lumped_parameter_simulation [INFERRED 0.85]
- **One nodal circuit model shared by curves, alignment and signal chain** — readme_modified_nodal_analysis, readme_auto_alignment_solver, readme_transfer_function_normalisation, readme_enclosure_topologies, readme_custom_topology_builder, readme_signal_chain [INFERRED 0.85]
- **Cross-language drift gate (Rust solver vs TypeScript mirror)** — _github_workflows_ci_frontend, _github_workflows_ci_rust, _github_workflows_ci_portgeometry, _github_workflows_ci_effectivevas, _github_workflows_ci_cross_language_pinning_tests [EXTRACTED 1.00]

## Communities (43 total, 7 thin omitted)

### Community 0 - "Sidebar Enclosure Forms"
Cohesion: 0.05
Nodes (59): CustomTopologyDiagram(), DimensionCalculator(), AutoAlignSection(), Bandpass4Fields(), Bandpass6ParallelFields(), Bandpass6SeriesFields(), CustomTopologyFields(), DEFAULT_PORT (+51 more)

### Community 1 - "Graph Rendering Layers"
Cohesion: 0.07
Nodes (60): AppShell(), Dashboard(), GraphCaption(), GraphCurves(), axisTitle(), axisUnit(), clampYRange(), GraphGeometry (+52 more)

### Community 2 - "Simulation Request Plumbing"
Cohesion: 0.06
Nodes (75): AlignmentRecommendation, PassbandTarget, SimPoint, emit_effective_vas_reference(), AlignEnclosureRequest, auto_align_enclosure(), Default, Driver (+67 more)

### Community 3 - "Alignment Solver Search"
Cohesion: 0.10
Nodes (66): HashMap, RefDriver, AlignConstraints, AlignmentRecommendation, AlignRequest, AlignTarget, axes_for(), Axis (+58 more)

### Community 4 - "Physics Helpers & Driver Limits"
Cohesion: 0.07
Nodes (51): LimitReferences(), activeProject, updateActiveProject, checkDriverConsistency(), useDriverForm(), useSimulation(), useSimulationExport(), blFromFsMmsQes() (+43 more)

### Community 5 - "Circuit Solver & Topologies"
Cohesion: 0.08
Nodes (55): Complex64, Display, DMatrix, Formatter, build_circuit(), nominal_port_area(), a_negligible_crossover_leaves_the_vented_impedance_alone(), AcousticCircuit (+47 more)

### Community 6 - "Modals & UI Primitives"
Cohesion: 0.07
Nodes (32): App(), AddDriverModal(), AddDriverModalContent(), DriverBrowserModal(), Button(), ButtonProps, ButtonVariant, ConfirmOptions (+24 more)

### Community 7 - "Toolbar, Theme & Curve Catalogue"
Cohesion: 0.08
Nodes (35): handleAddNewProject, handleOpenProject, handleRemoveProject, handleSaveProject, projects, setActiveProjectId, setRulerFreq, setVisibleGraphs (+27 more)

### Community 8 - "Project Types & Persistence"
Cohesion: 0.11
Nodes (22): PRESET_LINE_COLORS, toProjectFile(), AlignmentConstraints, AlignmentRecommendation, AlignmentTarget, CustomPortSpec, CustomPRSpec, CustomSideSpec (+14 more)

### Community 9 - "Filesystem Storage & Scope Guard"
Cohesion: 0.23
Nodes (26): App, AppHandle, MockRuntime, PathBuf, R, add_driver(), an_empty_path_is_refused(), edit_driver() (+18 more)

### Community 10 - "README, CI & Cross-Language Pinning"
Cohesion: 0.11
Nodes (25): CI Workflow, Cross-language pinning tests, effectiveVas (pinned across Rust/TS), frontend job (TypeScript), portGeometry (pinned across Rust/TS), rust job (Clippy + cargo test), Tauri system dependencies (GTK/WebKit), Vite module entry /src/main.tsx (+17 more)

### Community 11 - "Tauri App Config & Icons"
Cohesion: 0.08
Nodes (23): icons/128x128@2x.png, icons/128x128.png, icons/32x32.png, icons/icon.icns, icons/icon.ico, app, security, windows (+15 more)

### Community 12 - "TypeScript Compiler Config"
Cohesion: 0.09
Nodes (22): DOM, DOM.Iterable, ES2020, src, compilerOptions, allowImportingTsExtensions, isolatedModules, jsx (+14 more)

### Community 13 - "Dev Dependencies"
Cohesion: 0.11
Nodes (19): eslint, globals, jsdom, devDependencies, eslint, globals, jsdom, @tauri-apps/cli (+11 more)

### Community 14 - "Sidebar & Simulation Tests"
Cohesion: 0.12
Nodes (15): activeProject, updateActiveProject, activeProject, newWorkspace, openWorkspace, saveWorkspace, setSidebarTab, systemStats (+7 more)

### Community 15 - "Runtime Dependencies"
Cohesion: 0.12
Nodes (17): lucide-react, dependencies, lucide-react, react, react-dom, tailwindcss, @tailwindcss/vite, @tauri-apps/api (+9 more)

### Community 16 - "Graph Geometry Tests"
Cohesion: 0.12
Nodes (13): cfg, graphConfigs, graphHeights, phaseGdData, project, projects, results, cfg (+5 more)

### Community 17 - "Port Sizing Recommendation"
Cohesion: 0.21
Nodes (11): PortRecommendation, auto_calculate_port(), PortRecommendation, PortSizingRequest, Default, Driver, Option, Self (+3 more)

### Community 18 - "Viewport & Workspace Tests"
Cohesion: 0.26
Nodes (7): custom(), useGraphViewport(), cfg, defaults(), workspace(), makeProject(), perCurve()

### Community 19 - "Workspace & Project Defaults"
Cohesion: 0.29
Nodes (9): useProjects(), createDefaultProject(), withProjectDefaults(), deserializeWorkspace(), WORKSPACE_EXTENSION, WORKSPACE_VERSION, WorkspaceFile, CabinConfig (+1 more)

### Community 20 - "npm Scripts"
Cohesion: 0.20
Nodes (10): scripts, bench, build, dev, lint, preview, tauri, test (+2 more)

### Community 21 - "Tauri Capability Permissions"
Cohesion: 0.20
Nodes (9): core:default, dialog:default, main, opener:default, description, identifier, permissions, $schema (+1 more)

### Community 22 - "Node Build Tsconfig"
Cohesion: 0.22
Nodes (8): vite.config.ts, compilerOptions, allowSyntheticDefaultImports, composite, module, moduleResolution, skipLibCheck, include

### Community 23 - "Signal Tab Tests"
Cohesion: 0.22
Nodes (7): SignalTab(), activeProject, cabinConfig, filters, roomConfig, setFilters, updateActiveProject

### Community 24 - "Render Cost Benchmark"
Cohesion: 0.28
Nodes (8): cfg, phaseGd, pointerSetters, projects, results, simulation, sweep(), viewport

### Community 25 - "Session Autosave"
Cohesion: 0.33
Nodes (5): AUTOSAVE_DELAY_MS, session(), ENCLOSURE_TYPES, PORT_SHAPES, SavedSession

### Community 26 - "Package Identity"
Cohesion: 0.40
Nodes (4): name, private, type, version

### Community 27 - "Theme Contrast Checker"
Cohesion: 0.50
Nodes (4): CHECKS, contrastRatio(), luminance(), THEMES

### Community 28 - "Enclosure Tab Tests"
Cohesion: 0.40
Nodes (4): activeProject, EXPECTED, updateActiveProject, EnclosureType

## Knowledge Gaps
- **220 isolated node(s):** `name`, `private`, `version`, `type`, `dev` (+215 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 282 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **7 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `useProjectsContext()` connect `Graph Rendering Layers` to `Sidebar Enclosure Forms`, `Physics Helpers & Driver Limits`, `Modals & UI Primitives`, `Toolbar, Theme & Curve Catalogue`?**
  _High betweenness centrality (0.022) - this node is a cross-community bridge._
- **Why does `DriverParams` connect `Circuit Solver & Topologies` to `Simulation Request Plumbing`, `Alignment Solver Search`?**
  _High betweenness centrality (0.011) - this node is a cross-community bridge._
- **Why does `simulate_system()` connect `Simulation Request Plumbing` to `Port Sizing Recommendation`, `Circuit Solver & Topologies`?**
  _High betweenness centrality (0.008) - this node is a cross-community bridge._
- **Are the 10 inferred relationships involving `simulate_system()` (e.g. with `auto_calculate_port()` and `solve_circuit()`) actually correct?**
  _`simulate_system()` has 10 INFERRED edges - model-reasoned connections that need verification._
- **Are the 34 inferred relationships involving `bc21()` (e.g. with `a_project_saved_without_ql_still_loads()` and `ql_survives_a_save_and_load_cycle()`) actually correct?**
  _`bc21()` has 34 INFERRED edges - model-reasoned connections that need verification._
- **What connects `name`, `private`, `version` to the rest of the system?**
  _220 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Sidebar Enclosure Forms` be split into smaller, more focused modules?**
  _Cohesion score 0.05016797312430011 - nodes in this community are weakly interconnected._