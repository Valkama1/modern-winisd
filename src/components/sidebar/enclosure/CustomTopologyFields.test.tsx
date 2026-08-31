import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { makeProject } from "../../../test/fixtures";
import { Project } from "../../../types";

let activeProject: Project = makeProject({ enclosureType: "custom" });
const updateActiveProject = vi.fn();

vi.mock("../../../context/ProjectsContext", () => ({
  useProjectsContext: () => ({ activeProject, updateActiveProject }),
}));
vi.mock("../../../context/ModalsContext", () => ({
  useModalsContext: () => ({
    sidebarSectionState: new Proxy({}, { get: () => true }),
    toggleSidebarSection: vi.fn(),
  }),
}));

import CustomTopologyFields from "./CustomTopologyFields";

const custom = (over: Partial<Project["customTopology"]> = {}) =>
  makeProject({
    enclosureType: "custom",
    customTopology: {
      rear: { volume_liters: 80, port: null, pr: null },
      front: { volume_liters: 0, port: null, pr: null },
      internal_port: null,
      ...over,
    },
  });

describe("CustomTopologyFields", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    activeProject = custom();
  });

  it("always offers the rear chamber", () => {
    render(<CustomTopologyFields />);
    expect(screen.getAllByText("Chamber Volume").length).toBeGreaterThan(0);
  });

  it("offers a chamber a port or a radiator, not both at once", () => {
    // They are mutually exclusive: adding one clears the other.
    activeProject = custom({ rear: { volume_liters: 80, port: { diameter_cm: 10, tuning_freq: 35 }, pr: null } });
    const { unmount } = render(<CustomTopologyFields />);
    expect(screen.getAllByText("Tuning (Fb)").length).toBeGreaterThan(0);
    unmount();

    activeProject = custom({
      rear: { volume_liters: 80, port: null, pr: { mms_g: 300, sd_cm2: 1680, fs: 25, qms: 5 } },
    });
    render(<CustomTopologyFields />);
    expect(screen.getAllByText("Moving Mass").length).toBeGreaterThan(0);
  });

  it("clears the radiator when a port is added to the same chamber", () => {
    activeProject = custom({
      rear: { volume_liters: 80, port: null, pr: { mms_g: 300, sd_cm2: 1680, fs: 25, qms: 5 } },
    });
    render(<CustomTopologyFields />);
    const addPort = screen.getAllByText(/Add Port/i)[0];
    fireEvent.click(addPort);
    const patch = updateActiveProject.mock.calls[0][0];
    expect(patch.customTopology.rear.pr).toBeNull();
    expect(patch.customTopology.rear.port).not.toBeNull();
  });

  it("only shows front chamber controls once it has a volume", () => {
    const { unmount } = render(<CustomTopologyFields />);
    const withoutFront = screen.getAllByText("Chamber Volume").length;
    unmount();

    activeProject = custom({ front: { volume_liters: 40, port: null, pr: null } });
    render(<CustomTopologyFields />);
    expect(screen.getAllByText("Chamber Volume").length).toBeGreaterThan(withoutFront);
  });

  it("draws the topology alongside the controls", () => {
    const { container } = render(<CustomTopologyFields />);
    expect(container.querySelectorAll("svg").length).toBeGreaterThan(0);
  });
});
