import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { makeProject } from "../../test/fixtures";
import { CURVE_TYPES, CurveType, Project } from "../../types";
import { CURVE_LABELS, selectableCurvesFor } from "../../lib/curveCatalogue";

let projects: Project[] = [makeProject({ id: "a", name: "First" })];
let activeProjectId = "a";
let visibleGraphs: CurveType[] = ["transfer", "spl"];
let rulerFreq: number | null = null;

const setVisibleGraphs = vi.fn();
const setRulerFreq = vi.fn();
const handleAddNewProject = vi.fn();
const handleOpenProject = vi.fn();
const handleSaveProject = vi.fn();
const handleRemoveProject = vi.fn();
const setActiveProjectId = vi.fn();
const undo = vi.fn();

vi.mock("../../context/ProjectsContext", () => ({
  useProjectsContext: () => ({
    projects, activeProjectId, setActiveProjectId,
    activeProject: projects.find((p) => p.id === activeProjectId) ?? projects[0],
    setProjectsWithHistory: vi.fn(),
    canUndo: true, canRedo: false, undo, redo: vi.fn(),
    handleAddNewProject, handleDuplicateProject: vi.fn(),
    handleRenameProject: vi.fn(), handleRemoveProject,
    handleOpenProject, handleSaveProject,
  }),
}));
vi.mock("../../context/GraphViewportContext", () => ({
  useGraphViewportContext: () => ({ visibleGraphs, setVisibleGraphs }),
}));
vi.mock("../../context/GraphPointerContext", () => ({
  useRulerFreq: () => rulerFreq,
  useGraphPointerActions: () => ({ setRulerFreq }),
}));
vi.mock("../../context/SimulationContext", () => ({
  useSimulationContext: () => ({
    showExportMenu: null, setShowExportMenu: vi.fn(),
    handleExportSVG: vi.fn(), handleExportPNG: vi.fn(), handleExportSummary: vi.fn(),
  }),
}));
vi.mock("../ui", async (orig) => {
  const actual = await orig<typeof import("../ui")>();
  return { ...actual, useDialog: () => ({ confirmDialog: vi.fn(async () => true) }) };
});

import Toolbar from "./Toolbar";

describe("Toolbar", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    projects = [makeProject({ id: "a", name: "First" })];
    activeProjectId = "a";
    visibleGraphs = ["transfer", "spl"];
    rulerFreq = null;
  });

  it("shows a tab per project", () => {
    projects = [
      makeProject({ id: "a", name: "First" }),
      makeProject({ id: "b", name: "Second" }),
      makeProject({ id: "c", name: "Third" }),
    ];
    render(<Toolbar />);
    for (const name of ["First", "Second", "Third"]) {
      expect(screen.getAllByText(name).length).toBeGreaterThan(0);
    }
  });

  it("separates project actions from adding one", () => {
    // Project-scoped open and save live beside the tabs; the sidebar's are workspace
    // scoped. Confusing the two is what prompted splitting them.
    render(<Toolbar />);
    expect(screen.getAllByText("New Project").length).toBe(1);
    expect(screen.getAllByText("Open").length).toBe(1);
    expect(screen.getAllByText("Save").length).toBe(1);
  });

  it("adds a comparison project rather than replacing the workspace", () => {
    render(<Toolbar />);
    fireEvent.click(screen.getByText("New Project"));
    expect(handleAddNewProject).toHaveBeenCalledTimes(1);
  });

  it("saves and opens single projects from here", () => {
    render(<Toolbar />);
    fireEvent.click(screen.getByText("Save"));
    expect(handleSaveProject).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByText("Open"));
    expect(handleOpenProject).toHaveBeenCalledTimes(1);
  });

  it("offers every selectable curve once the picker is open", () => {
    // A ported box has all of them; a sealed one has no port to measure.
    projects = [makeProject({ id: "a", enclosureType: "ported" })];
    render(<Toolbar />);
    fireEvent.click(screen.getByText(/Configure Graphs/));

    // From the shared catalogue the picker itself is built from, so the two cannot
    // drift — which is exactly how the Settings picker fell two curves behind this one.
    const selectable = selectableCurvesFor("ported");
    expect(selectable.length).toBe(CURVE_TYPES.length - 1);
    for (const curve of selectable) {
      expect(screen.getAllByText(CURVE_LABELS[curve]).length, curve).toBe(1);
    }
  });

  it("hides port velocity for a sealed box", () => {
    projects = [makeProject({ id: "a", enclosureType: "sealed" })];
    const { unmount } = render(<Toolbar />);
    fireEvent.click(screen.getByText(/Configure Graphs/));
    expect(screen.queryByText("Port Air Velocity (m/s)")).toBeNull();
    unmount();

    projects = [makeProject({ id: "a", enclosureType: "ported" })];
    render(<Toolbar />);
    fireEvent.click(screen.getByText(/Configure Graphs/));
    expect(screen.getAllByText("Port Air Velocity (m/s)").length).toBe(1);
  });
});
