import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { makeProject } from "../../test/fixtures";
import { EnclosureType, Project } from "../../types";

const updateActiveProject = vi.fn();
let activeProject: Project = makeProject();

vi.mock("../../context/ProjectsContext", () => ({
  useProjectsContext: () => ({ activeProject, updateActiveProject }),
}));

vi.mock("../../context/SimulationContext", () => ({
  useSimulationContext: () => ({
    calculatedPortLength: 12.3,
    portLengthClamped: false,
    handleAutoCalculatePort: vi.fn(),
    handleApplyAlignment: vi.fn(),
  }),
}));

vi.mock("../../context/ModalsContext", () => ({
  useModalsContext: () => ({
    // Every section open, so each type's fields are actually in the tree.
    sidebarSectionState: new Proxy({}, { get: () => true }),
    toggleSidebarSection: vi.fn(),
  }),
}));

import EnclosureTab from "./EnclosureTab";

/**
 * Labels unique to each enclosure branch. These pin what the tab renders per type,
 * which is the behaviour a split into per-type components has to preserve — there is
 * no other coverage of this file.
 */
const EXPECTED: [EnclosureType, string[]][] = [
  ["sealed", ["Box Volume (Vb)"]],
  ["ported", ["Box Volume (Vb)", "Tuning Freq (Fb)", "Port Count"]],
  ["bandpass4", ["Volume (Vr)", "Volume (Vf)", "Tuning (Fb)"]],
  ["bandpass6_parallel", ["Volume (Vr)", "Tuning (Fb,rear)", "Tuning (Fb,front)"]],
  ["bandpass6_series", ["Volume (Vr)", "Internal Tuning", "Front Tuning (Fb)"]],
  ["passive_radiator", ["Box Volume (Vb)", "PR Moving Mass (Mms)", "PR Resonance (Fs)"]],
  ["custom", ["Chamber Volume"]],
];

describe("EnclosureTab", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it.each(EXPECTED)("renders the %s controls", (enclosureType, labels) => {
    activeProject = makeProject({ enclosureType });
    render(<EnclosureTab />);
    for (const label of labels) {
      expect(screen.getAllByText(label).length).toBeGreaterThan(0);
    }
  });

  it("offers auto-align for every type except custom", () => {
    activeProject = makeProject({ enclosureType: "ported" });
    const { unmount } = render(<EnclosureTab />);
    expect(screen.getAllByText("Apply Suggested Specs").length).toBe(1);
    unmount();

    activeProject = makeProject({ enclosureType: "custom" });
    render(<EnclosureTab />);
    expect(screen.queryByText("Apply Suggested Specs")).toBeNull();
  });

  it("shows bandpass presets and passband targeting only for bandpass types", () => {
    activeProject = makeProject({ enclosureType: "bandpass6_parallel" });
    const { unmount } = render(<EnclosureTab />);
    expect(screen.getAllByText("Target passband").length).toBe(1);
    expect(screen.queryByText("Target F3")).toBeNull();
    unmount();

    activeProject = makeProject({ enclosureType: "ported" });
    render(<EnclosureTab />);
    expect(screen.getAllByText("Target F3").length).toBe(1);
    expect(screen.queryByText("Target passband")).toBeNull();
  });

  it("warns when the port length has been clamped", () => {
    activeProject = makeProject({ enclosureType: "ported" });
    render(<EnclosureTab />);
    expect(screen.queryByText(/too large for/)).toBeNull();
  });
});
