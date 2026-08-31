import { describe, it, vi } from "vitest";
import { render, cleanup } from "@testing-library/react";
import { makeProject } from "./fixtures";
import { CURVE_TYPES, CurveType, GraphViewportConfig, SimPoint } from "../types";

/**
 * Hover-frame cost for the graph dashboard.
 *
 * Not part of the normal suite — the filename does not match vitest's test glob.
 * Run with:  npx vitest run --include "src/test/*.bench.tsx"
 *
 * Moving the pointer over a graph updates hoveredFreq in shared viewport context,
 * which re-renders every visible panel. This measures one such frame for a realistic
 * dashboard: two graphs, three comparison projects, and an active EQ.
 */
// From the shared list, so a new curve reaches the mocks automatically.
const CURVES: readonly CurveType[] = CURVE_TYPES;
const cfg: GraphViewportConfig = { xMin: 10, xMax: 2000, yMin: 0, yMax: 140, autoScaleY: true };
const sweep = (): SimPoint[] => Array.from({ length: 150 }, (_, i) => ({
  frequency: 10 * Math.pow(200, i / 149), db: 90 + 10 * Math.sin(i / 4), phase_rad: Math.sin(i / 6),
}));

const projects = [0, 1, 2].map((i) => makeProject({ id: `p${i}`, name: `P${i}` }));
const results = Object.fromEntries(projects.map((p) => [p.id, Object.fromEntries(CURVES.map((c) => [c, sweep()]))]));
const phaseGd = Object.fromEntries(projects.map((p) => [p.id, { phase: sweep(), group_delay: sweep() }]));

// Stable identities, as the real providers give: only hoveredFreq moves per frame.
let hovered = 80;
const viewport = {
  dashboardWidth: 1200,
  graphHeights: Object.fromEntries(CURVES.map((c) => [c, 300])),
  handleResizeStart: vi.fn(),
  graphConfigs: Object.fromEntries(CURVES.map((c) => [c, cfg])),
  getGraphXLimits: () => ({ xMin: 10, xMax: 2000 }),
};
const pointerSetters = { setRulerFreq: vi.fn(), setHoveredFreq: vi.fn() };
const simulation = {
  simulationResults: results,
  phaseGdData: phaseGd,
  getDisplayValue: (_m: CurveType, _f: number, raw: number) => raw,
  svgRefsMap: { current: new Map() },
  kaWarningFreq: 380,
  kaLimitByProject: Object.fromEntries(projects.map((p) => [p.id, 380])),
  filterGainFn: (f: number) => Math.sin(f / 100),
  roomCorrectionFn: (f: number) => Math.cos(f / 90),
  filterLinearFn: (f: number) => 1 + 0.1 * Math.sin(f / 70),
  cabinGainFn: (_f: number) => 0,
};

vi.mock("../context/ProjectsContext", () => ({
  useProjectsContext: () => ({ projects, activeProjectId: "p0", activeProject: projects[0] }),
}));
vi.mock("../context/GraphViewportContext", () => ({
  useGraphViewportContext: () => viewport,
}));
vi.mock("../context/GraphPointerContext", () => ({
  useRulerFreq: () => 50,
  useHoveredFreq: () => hovered,
  useGraphPointerActions: () => pointerSetters,
}));
vi.mock("../context/SimulationContext", () => ({
  useSimulationContext: () => simulation,
}));

import GraphPanel from "../components/dashboard/GraphPanel";

describe("graph render cost", () => {
  it("measures a hover-driven re-render", () => {
    const N = 120;

    // Mount once and then re-render: hovering updates a mounted tree, so measuring
    // fresh mounts would time work that memoisation is not meant to avoid.
    const spl = render(<GraphPanel mode="spl" />);
    const transfer = render(<GraphPanel mode="transfer" />);

    for (let i = 0; i < 10; i++) {         // warm up
      hovered = i;
      spl.rerender(<GraphPanel mode="spl" />);
      transfer.rerender(<GraphPanel mode="transfer" />);
    }

    const t0 = performance.now();
    for (let i = 0; i < N; i++) {
      hovered = 50 + i;
      spl.rerender(<GraphPanel mode="spl" />);
      transfer.rerender(<GraphPanel mode="transfer" />);
    }
    const per = (performance.now() - t0) / N;
    cleanup();

    console.log(`\n  2 graphs x 3 projects: ${per.toFixed(3)} ms per hover frame`);
    console.log(`  share of a 60fps frame: ${((per / 16.7) * 100).toFixed(1)}%\n`);
  });

  it("measures a cold mount for reference", () => {
    const N = 40;
    const t0 = performance.now();
    for (let i = 0; i < N; i++) {
      render(<GraphPanel mode="spl" />);
      cleanup();
    }
    console.log(`  cold mount, one graph: ${((performance.now() - t0) / N).toFixed(3)} ms\n`);
  });
});
