import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { makeProject } from "../test/fixtures";
import { CurveType, GraphViewportConfig, Project } from "../types";

const invoke = vi.fn(async () => [{ frequency: 10, db: 90, phase_rad: 0 }]);
vi.mock("@tauri-apps/api/core", () => ({ invoke: (...a: unknown[]) => invoke(...(a as [])) }));

const toastError = vi.fn();
// One object, as ToastProvider now hands out — a fresh one per call would make
// `toast` change every render and re-run the sweep, which is the thing under test.
const toast = { success: vi.fn(), error: toastError };
vi.mock("../components/ui", () => ({
  useToast: () => toast,
  useDialog: () => ({ confirmDialog: vi.fn(), promptDialog: vi.fn() }),
}));
vi.mock("./useSimulationExport", () => ({ useSimulationExport: () => ({}) }));

const CURVES: CurveType[] = ["transfer", "spl"];
let projects: Project[] = [makeProject({ id: "p0" })];
let graphConfigs: Record<string, GraphViewportConfig> = {
  transfer: { xMin: 10, xMax: 2000, yMin: -30, yMax: 10, autoScaleY: true },
  spl: { xMin: 10, xMax: 2000, yMin: 60, yMax: 140, autoScaleY: true },
};

vi.mock("../context/ProjectsContext", () => ({
  useProjectsContext: () => ({
    activeProject: projects[0], activeProjectId: projects[0].id, projects,
    updateActiveProject: vi.fn(),
  }),
}));
vi.mock("../context/GraphViewportContext", () => ({
  useGraphViewportContext: () => ({
    visibleGraphs: CURVES,
    graphConfigs,
    globalXMin: 10,
    globalXMax: 2000,
    overrideXLimits: {},
    getGraphXLimits: (m: CurveType) => ({
      xMin: graphConfigs[m].xMin, xMax: graphConfigs[m].xMax,
    }),
  }),
}));
vi.mock("../context/SignalProcessingContext", () => ({
  useSignalProcessingContext: () => ({
    filters: [], roomConfig: { enabled: false }, cabinConfig: { enabled: false },
  }),
}));

import { useSimulation } from "./useSimulation";

describe("useSimulation dispatch", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    invoke.mockClear();
    toastError.mockClear();
    projects = [makeProject({ id: "p0" })];
    graphConfigs = {
      transfer: { xMin: 10, xMax: 2000, yMin: -30, yMax: 10, autoScaleY: true },
      spl: { xMin: 10, xMax: 2000, yMin: 60, yMax: 140, autoScaleY: true },
    };
  });
  afterEach(() => vi.useRealTimers());

  const settle = async () => {
    await act(async () => { vi.advanceTimersByTime(500); });
  };

  it("simulates once per visible curve", async () => {
    renderHook(() => useSimulation());
    await settle();
    expect(invoke).toHaveBeenCalledTimes(CURVES.length);
  });

  it("coalesces a burst of edits into a single sweep", async () => {
    // Typing "150" into a field is three project updates. Without debouncing each one
    // dispatched a full sweep of every curve for every project.
    const { rerender } = renderHook(() => useSimulation());
    for (const vBox of [1, 15, 150]) {
      projects = [makeProject({ id: "p0", vBox })];
      rerender();
    }
    await settle();
    expect(invoke).toHaveBeenCalledTimes(CURVES.length);
  });

  it("does not re-simulate when only a Y axis changed", async () => {
    const { rerender } = renderHook(() => useSimulation());
    await settle();
    invoke.mockClear();

    // The backend is never told about Y scaling, so this must not reach it.
    graphConfigs = {
      ...graphConfigs,
      spl: { ...graphConfigs.spl, yMin: 0, yMax: 200, autoScaleY: false },
    };
    rerender();
    await settle();
    expect(invoke).not.toHaveBeenCalled();
  });

  it("does re-simulate when the frequency span changes", async () => {
    const { rerender } = renderHook(() => useSimulation());
    await settle();
    invoke.mockClear();

    graphConfigs = { ...graphConfigs, spl: { ...graphConfigs.spl, xMax: 500 } };
    rerender();
    await settle();
    expect(invoke).toHaveBeenCalled();
  });

  it("reports a failed simulation instead of leaving stale graphs unexplained", async () => {
    invoke.mockRejectedValueOnce(new Error("backend exploded"));
    renderHook(() => useSimulation());
    await settle();
    expect(toastError).toHaveBeenCalled();
  });

  it("keeps the curves that did come back when one of them fails", async () => {
    // The sweep is up to 18 invokes behind a single Promise.all, so one rejection
    // discarded every project's results and left every graph showing the previous
    // sweep with only a toast to say why. That mattered more once solve_circuit
    // started reporting a singular system instead of quietly returning zeros.
    let calls = 0;
    invoke.mockImplementation(async () => {
      calls += 1;
      if (calls === 1) throw new Error("no solution at 41.2 Hz");
      return [{ frequency: 10, db: 90, phase_rad: 0 }];
    });

    const { result } = renderHook(() => useSimulation());
    await settle();

    const curves = result.current.simulationResults["p0"] ?? {};
    expect(Object.keys(curves).length).toBeGreaterThan(0);
    expect(toastError).toHaveBeenCalled();
  });
});
