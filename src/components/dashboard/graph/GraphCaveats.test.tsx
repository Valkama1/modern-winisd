import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { makeProject } from "../../../test/fixtures";
import { DEFAULT_DRIVER, Project } from "../../../types";

let projects: Project[] = [makeProject({ id: "p0" })];
let kaLimitByProject: Record<string, number> = { p0: 380 };

vi.mock("../../../context/ProjectsContext", () => ({
  useProjectsContext: () => ({ projects, activeProjectId: "p0" }),
}));
vi.mock("../../../context/SimulationContext", () => ({
  useSimulationContext: () => ({ kaLimitByProject }),
}));

import GraphCaveats from "./GraphCaveats";

describe("GraphCaveats", () => {
  beforeEach(() => {
    // The multi-project test adds a p1 key to this map; without resetting it here that
    // key would leak into every later test in this file.
    projects = [makeProject({ id: "p0" })];
    kaLimitByProject = { p0: 380 };
  });

  it("renders nothing at all when the driver is complete and the band is clear", () => {
    // Zero pixels for a design with nothing wrong with it — the property that makes
    // this an indicator rather than more chrome.
    const { container } = render(<GraphCaveats mode="excursion" fMax={200} />);
    expect(container.innerHTML).toBe("");
  });

  it("shows a warning glyph when a value was invented", () => {
    projects = [makeProject({ id: "p0", driver: { ...DEFAULT_DRIVER, le: 0 } })];
    render(<GraphCaveats mode="spl" fMax={200} />);
    const btn = screen.getByRole("button", { name: /model caveats/i });
    expect(btn.dataset.tier).toBe("warning");
  });

  it("shows the quieter glyph when everything is merely derived", () => {
    // A derived Mms is an exact identity; it must not look like an invented Bl.
    projects = [makeProject({ id: "p0", driver: { ...DEFAULT_DRIVER, mms: 0 } })];
    render(<GraphCaveats mode="excursion" fMax={200} />);
    expect(screen.getByRole("button", { name: /model caveats/i }).dataset.tier)
      .toBe("derived");
  });

  it("explains itself on focus, not only on hover", () => {
    projects = [makeProject({ id: "p0", driver: { ...DEFAULT_DRIVER, le: 0 } })];
    render(<GraphCaveats mode="spl" fMax={200} />);
    const btn = screen.getByRole("button", { name: /model caveats/i });

    expect(screen.queryByText(/Voice coil inductance assumed/)).toBeNull();
    act(() => btn.focus());
    expect(screen.getByText(/Voice coil inductance assumed/)).toBeDefined();
    expect(btn.getAttribute("aria-expanded")).toBe("true");

    fireEvent.blur(btn);
    expect(screen.queryByText(/Voice coil inductance assumed/)).toBeNull();
  });

  it("names the project when more than one is on the graph", () => {
    projects = [
      makeProject({ id: "p0", name: "Clean" }),
      makeProject({ id: "p1", name: "No Le", driver: { ...DEFAULT_DRIVER, le: 0 } }),
    ];
    kaLimitByProject = { ...kaLimitByProject, p1: 380 };
    render(<GraphCaveats mode="spl" fMax={200} />);
    act(() => screen.getByRole("button", { name: /model caveats/i }).focus());
    expect(screen.getByText("No Le")).toBeDefined();
  });

  it("says nothing about the radiation model when the band stops below it", () => {
    render(<GraphCaveats mode="spl" fMax={200} />);
    expect(screen.queryByRole("button", { name: /model caveats/i })).toBeNull();
  });

  it("does mention it when the band runs past it", () => {
    render(<GraphCaveats mode="spl" fMax={2000} />);
    expect(screen.getByRole("button", { name: /model caveats/i })).toBeDefined();
  });
});
