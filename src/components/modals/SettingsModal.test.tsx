import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { makeProject } from "../../test/fixtures";
import { CurveType, GraphViewportConfig, perCurve } from "../../types";

let showSettings = true;
let configEditType: CurveType = "spl";
let overrideXLimits = perCurve(() => false);

const cfg: GraphViewportConfig = { xMin: 10, xMax: 2000, yMin: 60, yMax: 140, autoScaleY: true };
const setShowSettings = vi.fn();
const updateViewportConfig = vi.fn();
const setOverrideXLimits = vi.fn();
const setGlobalXMin = vi.fn();

vi.mock("../../context/ModalsContext", () => ({
  useModalsContext: () => ({ showSettings, setShowSettings }),
}));
vi.mock("../../context/ThemeContext", () => ({
  useThemeContext: () => ({
    currentTheme: { accent: "#4f8ff7" }, setCurrentTheme: vi.fn(),
    handleCustomColorChange: vi.fn(), activePresetKey: "midnight",
  }),
}));
vi.mock("../../context/ProjectsContext", () => ({
  useProjectsContext: () => ({ activeProject: makeProject() }),
}));
vi.mock("../../context/GraphViewportContext", () => ({
  useGraphViewportContext: () => ({
    configEditType, setConfigEditType: vi.fn(),
    graphConfigs: perCurve(() => cfg), updateViewportConfig,
    globalXMin: 10, setGlobalXMin, globalXMax: 2000, setGlobalXMax: vi.fn(),
    overrideXLimits, setOverrideXLimits,
  }),
}));

import SettingsModal from "./SettingsModal";

describe("SettingsModal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    showSettings = true;
    configEditType = "spl";
    overrideXLimits = perCurve(() => false);
  });

  it("renders nothing while closed", () => {
    showSettings = false;
    const { container } = render(<SettingsModal />);
    expect(container.innerHTML).toBe("");
  });

  it("shows its sections when open", () => {
    render(<SettingsModal />);
    for (const title of [
      "App Settings", "Appearance & Color Customizer", "Graph Viewport Calibration",
    ]) {
      expect(screen.getAllByText(title).length).toBeGreaterThan(0);
    }
  });

  it("can calibrate every curve the dashboard draws", () => {
    // The picker is a dropdown, so its options only exist once opened. Per-curve lists
    // written by hand had drifted before; this one comes from the shared type.
    render(<SettingsModal />);
    const picker = screen.getAllByRole("button").find((b) =>
      b.textContent?.includes("SPL") || b.textContent?.includes("Sound Pressure"),
    );
    expect(picker, "a curve picker should be present").toBeDefined();
    fireEvent.click(picker!);

    // Every curve should be offered; at minimum the ones with distinctive names.
    for (const label of ["Cone Excursion", "Impedance", "Group Delay"]) {
      expect(screen.getAllByText(new RegExp(label, "i")).length, label).toBeGreaterThan(0);
    }
  });

  it("closes when the dismiss control is used", () => {
    render(<SettingsModal />);
    // The X sits beside the title in the header.
    const header = screen.getByText("App Settings").parentElement!;
    const close = header.querySelector("button")!;
    fireEvent.click(close);
    expect(setShowSettings).toHaveBeenCalledWith(false);
  });
});
