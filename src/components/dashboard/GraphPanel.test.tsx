import { describe, it, expect, vi } from "vitest";
import { render } from "@testing-library/react";
import { makeProject } from "../../test/fixtures";
import { CURVE_TYPES, CurveType, GraphViewportConfig, Project, SimPoint } from "../../types";

const project: Project = makeProject();

/** A plausible log-spaced sweep so curve paths, grids and the ruler have real data. */
function sweep(n = 60): SimPoint[] {
  return Array.from({ length: n }, (_, i) => {
    const frequency = 10 * Math.pow(200, i / (n - 1));
    return { frequency, db: 90 + 10 * Math.sin(i / 4), phase_rad: Math.sin(i / 6) };
  });
}

// From the shared list, so a new curve reaches the mocks automatically.
const CURVES: readonly CurveType[] = CURVE_TYPES;

const cfg: GraphViewportConfig = { xMin: 10, xMax: 2000, yMin: 0, yMax: 140, autoScaleY: true };

/** Shared with the SimulationContext mock so the export-registration test can read it. */
const svgRefsMap = { current: new Map<CurveType, SVGSVGElement>() };

vi.mock("../../context/ProjectsContext", () => ({
  useProjectsContext: () => ({
    projects: [project],
    activeProjectId: project.id,
    activeProject: project,
  }),
}));

vi.mock("../../context/GraphViewportContext", () => ({
  useGraphViewportContext: () => ({
    dashboardWidth: 900,
    graphHeights: Object.fromEntries(CURVES.map((c) => [c, 300])),
    handleResizeStart: vi.fn(),
    graphConfigs: Object.fromEntries(CURVES.map((c) => [c, cfg])),
    getGraphXLimits: () => ({ xMin: 10, xMax: 2000 }),
  }),
}));

vi.mock("../../context/GraphPointerContext", () => ({
  useGraphPointerContext: () => ({
    rulerFreq: 50,
    setRulerFreq: vi.fn(),
    hoveredFreq: 80,
    setHoveredFreq: vi.fn(),
  }),
}));

// Hoisted so a test can vary a field — and so identities stay stable between renders,
// which is what the memoised layers rely on.
const simulation = {
  simulationResults: {
    [project.id]: Object.fromEntries(CURVES.map((c) => [c, sweep()])),
  },
  getDisplayValue: (_m: CurveType, _f: number, raw: number) => raw,
  phaseGdData: {
    [project.id]: { phase: sweep(), group_delay: sweep() },
  },
  svgRefsMap,
  kaWarningFreq: 380,
  filterGainFn: null,
  roomCorrectionFn: null,
  filterLinearFn: null,
  cabinGainFn: null,
};

vi.mock("../../context/SimulationContext", () => ({
  useSimulationContext: () => simulation,
}));

import GraphPanel from "./GraphPanel";

describe("GraphPanel", () => {
  it.each(CURVES)("renders a populated chart for %s", (mode) => {
    const { container } = render(<GraphPanel mode={mode} />);

    const svg = container.querySelector("svg");
    expect(svg).not.toBeNull();

    // Curve paths, grid lines and axis labels should all be present — an empty SVG
    // would still satisfy a bare "it rendered" assertion.
    expect(container.querySelectorAll("path").length).toBeGreaterThan(0);
    expect(container.querySelectorAll("line").length).toBeGreaterThan(0);
    expect(container.querySelectorAll("text").length).toBeGreaterThan(3);
  });

  it("draws the Xmax reference line only on the excursion graph", () => {
    const exc = render(<GraphPanel mode="excursion" />);
    expect(exc.container.textContent).toContain("Xmax");
    exc.unmount();

    const spl = render(<GraphPanel mode="spl" />);
    expect(spl.container.textContent).not.toContain("Xmax");
  });

  it("draws the chuffing limit only on the velocity graph", () => {
    const vel = render(<GraphPanel mode="velocity" />);
    expect(vel.container.textContent).toContain("17");
    vel.unmount();

    const imp = render(<GraphPanel mode="impedance" />);
    expect(imp.container.textContent).not.toContain("Chuffing");
  });

  it("registers its svg node so export can find it", () => {
    svgRefsMap.current.clear();
    render(<GraphPanel mode="spl" />);
    expect(svgRefsMap.current.get("spl")).toBeInstanceOf(SVGElement);
  });

  it("warns about the radiation model on curves that come from it", () => {
    // Max SPL is the one that matters: it keeps climbing past where the piston model
    // holds, so it reads as more output than the driver can actually deliver.
    for (const mode of ["spl", "transfer", "max_spl"] as CurveType[]) {
      const { container, unmount } = render(<GraphPanel mode={mode} />);
      expect(container.textContent, mode).toContain("Radiation model less accurate");
      unmount();
    }
  });

  it("does not warn on curves the radiation model does not produce", () => {
    // Transfer function is excluded on purpose: normalising divides the radiation
    // model out on both sides, so it stays trustworthy past where SPL does not.
    for (const mode of ["excursion", "velocity", "impedance", "transfer_function"] as CurveType[]) {
      const { container, unmount } = render(<GraphPanel mode={mode} />);
      expect(container.textContent, mode).not.toContain("Radiation model less accurate");
      unmount();
    }
  });

  it("shades the region past the piston model on radiation-derived curves", () => {
    // kaWarningFreq is 380 in these mocks, inside the 10-2000 Hz span.
    for (const mode of ["spl", "transfer", "max_spl"] as CurveType[]) {
      const { container, unmount } = render(<GraphPanel mode={mode} />);
      expect(container.textContent, mode).toContain("beyond piston model");
      unmount();
    }
  });

  it("does not shade curves the radiation model never touched", () => {
    // The transfer function divides it out; the rest never involved it.
    for (const mode of ["transfer_function", "excursion", "impedance"] as CurveType[]) {
      const { container, unmount } = render(<GraphPanel mode={mode} />);
      expect(container.textContent, mode).not.toContain("beyond piston model");
      unmount();
    }
  });

  it("shades nothing when the limit sits beyond the visible span", () => {
    // A small driver's piston limit can be above the top of the sweep, leaving
    // nothing to mark.
    simulation.kaWarningFreq = 9000;
    const { container } = render(<GraphPanel mode="spl" />);
    expect(container.textContent).not.toContain("beyond piston model");
    simulation.kaWarningFreq = 380;
  });
});