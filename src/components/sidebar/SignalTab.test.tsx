import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { makeProject } from "../../test/fixtures";
import { CabinConfig, EqFilter, Project, RoomConfig } from "../../types";

let activeProject: Project = makeProject();
let filters: EqFilter[] = [];
let roomConfig: RoomConfig = {
  enabled: false, length: 5, width: 4, height: 2.5,
  speakers: [{ x: 1, y: 1, z: 0.5 }], listenerX: 2.5, listenerY: 3, listenerZ: 1.2,
  absorption: 0.2,
};
let cabinConfig: CabinConfig = { enabled: false, fCabin: 45 };

const setFilters = vi.fn();
const updateActiveProject = vi.fn();

vi.mock("../../context/ProjectsContext", () => ({
  useProjectsContext: () => ({ activeProject, updateActiveProject }),
}));
vi.mock("../../context/SignalProcessingContext", () => ({
  useSignalProcessingContext: () => ({
    filters, setFilters,
    roomConfig, setRoomConfig: vi.fn(),
    cabinConfig, setCabinConfig: vi.fn(),
  }),
}));
vi.mock("../../context/ModalsContext", () => ({
  useModalsContext: () => ({
    // Everything open, so each section's controls are actually in the tree.
    sidebarSectionState: new Proxy({}, { get: () => true }),
    toggleSidebarSection: vi.fn(),
  }),
}));

import SignalTab from "./SignalTab";

const eq = (over: Partial<EqFilter> = {}): EqFilter => ({
  id: "f1", enabled: true, type: "peak", freq: 60, q: 1.0, gain: 3, ...over,
});

/**
 * Pins what the signal tab renders. It drives EQ, room correction and the passive
 * crossover — everything that reshapes the graphs — and had no coverage at all.
 */
describe("SignalTab", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    activeProject = makeProject();
    filters = [];
    roomConfig = { ...roomConfig, enabled: false };
    cabinConfig = { enabled: false, fCabin: 45 };
  });

  it("shows every section", () => {
    render(<SignalTab />);
    for (const title of [
      "SPL & Output Simulation", "EQ Filters", "Passive Crossover",
      "Cabin Gain", "Room Simulation",
    ]) {
      expect(screen.getAllByText(title).length).toBeGreaterThan(0);
    }
  });

  it("offers drive level and distance", () => {
    render(<SignalTab />);
    expect(screen.getAllByText("Total Input Power").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Distance (m)").length).toBeGreaterThan(0);
  });

  it("renders a control set per EQ filter", () => {
    filters = [eq({ id: "a" }), eq({ id: "b", type: "hp" })];
    render(<SignalTab />);
    expect(screen.getAllByText("Freq (Hz)")).toHaveLength(2);
    expect(screen.getAllByText("Q")).toHaveLength(2);
  });

  it("offers gain only for filters that have one", () => {
    // A high-pass has no gain; a peaking filter does.
    filters = [eq({ type: "hp" })];
    const { unmount } = render(<SignalTab />);
    expect(screen.queryByText("Gain (dB)")).toBeNull();
    unmount();

    filters = [eq({ type: "peak" })];
    render(<SignalTab />);
    expect(screen.getAllByText("Gain (dB)").length).toBe(1);
  });

  it("shows crossover component values only once one is enabled", () => {
    const { unmount } = render(<SignalTab />);
    expect(screen.queryByText("Inductance (mH)")).toBeNull();
    unmount();

    activeProject = makeProject({ passiveXoEnabled: true, passiveXoType: "lowpass_1st" });
    render(<SignalTab />);
    expect(screen.getAllByText("Inductance (mH)").length).toBe(1);
    expect(screen.getAllByText("Inductor DCR (Ω)").length).toBe(1);
  });

  it("asks for a capacitor on a high-pass and an inductor on a low-pass", () => {
    activeProject = makeProject({ passiveXoEnabled: true, passiveXoType: "highpass_1st" });
    const { unmount } = render(<SignalTab />);
    expect(screen.getAllByText("Capacitance (µF)").length).toBe(1);
    expect(screen.queryByText("Inductance (mH)")).toBeNull();
    unmount();

    activeProject = makeProject({ passiveXoEnabled: true, passiveXoType: "lowpass_2nd" });
    render(<SignalTab />);
    // Second order needs both.
    expect(screen.getAllByText("Inductance (mH)").length).toBe(1);
    expect(screen.getAllByText("Capacitance (µF)").length).toBe(1);
  });

  it("shows the cabin corner only when cabin gain is on", () => {
    const { unmount } = render(<SignalTab />);
    expect(screen.queryByText("Cabin Corner Freq (Hz)")).toBeNull();
    unmount();

    cabinConfig = { enabled: true, fCabin: 45 };
    render(<SignalTab />);
    expect(screen.getAllByText("Cabin Corner Freq (Hz)").length).toBe(1);
  });

  it("draws the floor plan only when room simulation is on", () => {
    const { container, unmount } = render(<SignalTab />);
    const before = container.querySelectorAll("svg").length;
    unmount();

    roomConfig = { ...roomConfig, enabled: true };
    const { container: after } = render(<SignalTab />);
    expect(after.querySelectorAll("svg").length).toBeGreaterThan(before);
  });

  it("places a marker for every speaker plus the listener", () => {
    roomConfig = {
      ...roomConfig, enabled: true,
      speakers: [{ x: 1, y: 1, z: 0.5 }, { x: 3, y: 1, z: 0.5 }, { x: 2, y: 2, z: 0.5 }],
    };
    const { container } = render(<SignalTab />);
    expect(container.querySelectorAll("circle").length).toBeGreaterThanOrEqual(4);
  });
});
