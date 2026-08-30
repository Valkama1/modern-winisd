import { describe, it, expect, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import { makeProject } from "../../../test/fixtures";
import { CurveType, GraphViewportConfig, SimPoint } from "../../../types";

const CURVES: CurveType[] = ["transfer", "spl", "excursion", "velocity", "impedance", "phase", "group_delay"];
const cfg: GraphViewportConfig = { xMin: 10, xMax: 2000, yMin: 0, yMax: 140, autoScaleY: true };
const sweep = (): SimPoint[] => Array.from({ length: 150 }, (_, i) => ({
  frequency: 10 * Math.pow(200, i / 149), db: 90 + 10 * Math.sin(i / 4), phase_rad: 0,
}));

const project = makeProject({ id: "p0" });

// Hoisted, because the real provider holds these in useState and hands back the same
// references every render. Rebuilding them per call would break the memo in the test
// while the app was fine.
const graphHeights = Object.fromEntries(CURVES.map((c) => [c, 300]));
const graphConfigs = Object.fromEntries(CURVES.map((c) => [c, cfg]));
const projects = [project];
const phaseGdData = {};
let results: Record<string, Record<string, SimPoint[]>> = {
  p0: Object.fromEntries(CURVES.map((c) => [c, sweep()])),
};

vi.mock("../../../context/ProjectsContext", () => ({
  useProjectsContext: () => ({ projects, activeProjectId: "p0", activeProject: project }),
}));
vi.mock("../../../context/GraphViewportContext", () => ({
  useGraphViewportContext: () => ({
    dashboardWidth: 1200,
    graphHeights,
    graphConfigs,
    // Deliberately a fresh closure each call, as the real provider gives — the memo
    // must key on the returned limits, not on this function's identity.
    getGraphXLimits: () => ({ xMin: 10, xMax: 2000 }),
    handleResizeStart: vi.fn(),
  }),
}));
vi.mock("../../../context/SimulationContext", () => ({
  useSimulationContext: () => ({
    simulationResults: results,
    phaseGdData,
    filterGainFn: null, roomCorrectionFn: null, filterLinearFn: null, cabinGainFn: null,
  }),
}));

import { useGraphGeometry } from "./useGraphGeometry";

describe("useGraphGeometry", () => {
  it("keeps the same object across re-renders when nothing it reads changed", () => {
    // This is what makes memo() on the curve, grid and reference layers effective. If
    // the geometry took a new identity on every render, every layer would re-render
    // and rebuild its paths whenever anything above it re-rendered.
    const { result, rerender } = renderHook(() => useGraphGeometry("spl"));
    const first = result.current;

    rerender();
    expect(result.current).toBe(first);

    rerender();
    expect(result.current).toBe(first);
  });

  it("returns a new object when the simulated data changes", () => {
    const { result, rerender } = renderHook(() => useGraphGeometry("spl"));
    const first = result.current;

    results = { p0: Object.fromEntries(CURVES.map((c) => [c, sweep()])) };
    rerender();
    expect(result.current).not.toBe(first);
  });

  it("scales to the data it was given", () => {
    const { result } = renderHook(() => useGraphGeometry("spl"));
    const { getX, getY, fMin, fMax, dbMin, dbMax } = result.current;
    expect(getX(fMin)).toBeLessThan(getX(fMax));
    expect(getY(dbMax)).toBeLessThan(getY(dbMin)); // y grows downward in SVG
  });
});
