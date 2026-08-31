import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import DimensionCalculator from "./DimensionCalculator";
import { makeProject } from "../../test/fixtures";
import { occupiedVolumeLitres } from "../../lib/enclosureVolume";

const updateActiveProject = vi.fn();
const activeProject = makeProject({ enclosureType: "ported", numDrivers: 1 });

// The two contexts are module boundaries around hooks that own the whole app's state.
// Standing them up would be testing them, not this.
vi.mock("../../context/ProjectsContext", () => ({
  useProjectsContext: () => ({ activeProject, updateActiveProject }),
}));
vi.mock("../../context/ModalsContext", () => ({
  useModalsContext: () => ({
    sidebarSectionState: { "dimension-calculator": true },
    toggleSidebarSection: () => {},
  }),
}));

beforeEach(() => updateActiveProject.mockClear());

describe("DimensionCalculator, Vb → dimensions", () => {
  it("applies the net volume its own button offers", () => {
    // vBox is the net air behind the cone — the sibling mode applies
    // grossVb - occupied to it, which is what settles the question. This button
    // showed the net figure on its face and wrote the gross one, inflating the box
    // by the driver and port displacement every time it was pressed.
    render(<DimensionCalculator />);

    const button = screen.getByRole("button", { name: /Apply .* to active project/ });
    expect(button.textContent).toContain("150");
    fireEvent.click(button);

    expect(updateActiveProject).toHaveBeenCalledWith({ vBox: 150 });
  });

  it("does not drift upward when Vb is round-tripped through dimensions", () => {
    // Vb → dimensions → Vb added `occupied` on every pass.
    render(<DimensionCalculator />);
    fireEvent.click(screen.getByRole("button", { name: /Apply .* to active project/ }));

    const applied = updateActiveProject.mock.calls[0][0].vBox;
    expect(applied).toBe(150);
    expect(occupiedVolumeLitres(activeProject)).toBeGreaterThan(0.05);
  });
});
