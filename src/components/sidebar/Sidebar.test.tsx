import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { makeProject } from "../../test/fixtures";
import { Project } from "../../types";
import { Stat } from "../../lib/systemStats";

let activeProject: Project = makeProject();
let systemStats: Stat[] = [];
let sidebarTab: "driver" | "enclosure" | "signal" = "enclosure";

const newWorkspace = vi.fn();
const openWorkspace = vi.fn();
const saveWorkspace = vi.fn();
const setSidebarTab = vi.fn();

vi.mock("../../context/DriverDatabaseContext", () => ({
  useDriverDatabaseContext: () => ({ setShowBrowser: vi.fn() }),
}));
vi.mock("../../context/ModalsContext", () => ({
  useModalsContext: () => ({
    setShowSettings: vi.fn(), sidebarTab, setSidebarTab,
    sidebarSectionState: new Proxy({}, { get: () => true }),
    toggleSidebarSection: vi.fn(),
  }),
}));
vi.mock("../../context/ProjectsContext", () => ({
  useProjectsContext: () => ({ activeProject, updateActiveProject: vi.fn() }),
}));
vi.mock("../../context/WorkspaceContext", () => ({
  useWorkspaceContext: () => ({ newWorkspace, openWorkspace, saveWorkspace }),
}));
vi.mock("../../context/SimulationContext", () => ({
  useSimulationContext: () => ({ systemStats }),
}));
import Sidebar from "./Sidebar";

describe("Sidebar", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    activeProject = makeProject();
    systemStats = [];
    sidebarTab = "enclosure";
  });

  it("labels its file actions as workspace-scoped", () => {
    // These replace the whole bench; the per-project ones live beside the graph tabs.
    render(<Sidebar>{null}</Sidebar>);
    expect(screen.getAllByText("Workspace").length).toBe(1);
  });

  it("wires each file action to the workspace, not the active project", () => {
    render(<Sidebar>{null}</Sidebar>);
    fireEvent.click(screen.getByText("New"));
    fireEvent.click(screen.getByText("Open"));
    fireEvent.click(screen.getByText("Save"));
    expect(newWorkspace).toHaveBeenCalledTimes(1);
    expect(openWorkspace).toHaveBeenCalledTimes(1);
    expect(saveWorkspace).toHaveBeenCalledTimes(1);
  });

  it("renders whatever panel it is given as children", () => {
    // The tab panels are passed in rather than chosen here; the sidebar owns the
    // chrome and which tab reads as selected.
    render(<Sidebar><p>panel content</p></Sidebar>);
    expect(screen.getAllByText("panel content").length).toBe(1);
  });

  it("marks the selected tab", () => {
    const { unmount } = render(<Sidebar>{null}</Sidebar>);
    fireEvent.click(screen.getByText("Signal"));
    expect(setSidebarTab).toHaveBeenCalledWith("signal");
    unmount();

    sidebarTab = "driver";
    render(<Sidebar>{null}</Sidebar>);
    expect(screen.getAllByText("Driver").length).toBeGreaterThan(0);
  });

  it("renders whatever statistics the simulation produced", () => {
    systemStats = [
      { label: "Qtc", value: "0.707", accent: true },
      { label: "F3", value: "34.1 Hz" },
      { label: "Gross Vb", value: "118.7 L (+18.7 L)", fullWidth: true },
    ];
    render(<Sidebar>{null}</Sidebar>);
    for (const s of systemStats) {
      expect(screen.getAllByText(s.label).length).toBeGreaterThan(0);
      expect(screen.getAllByText(s.value).length).toBeGreaterThan(0);
    }
  });

  it("shows no statistics panel content when there is nothing to show", () => {
    render(<Sidebar>{null}</Sidebar>);
    expect(screen.queryByText("Qtc")).toBeNull();
  });
});
