import { describe, it, expect } from "vitest";
import { deserializeWorkspace, serializeWorkspace, WORKSPACE_VERSION } from "./workspace";
import { makeProject } from "../test/fixtures";
import { CURVE_TYPES, perCurve, CurveType, GraphViewportConfig } from "../types";

const cfg: GraphViewportConfig = { xMin: 10, xMax: 2000, yMin: 0, yMax: 140, autoScaleY: true };

const defaults = () => ({
  projects: [makeProject({ id: "fallback" })],
  activeProjectId: "fallback",
  visibleGraphs: ["transfer", "spl"] as CurveType[],
  graphConfigs: perCurve(() => cfg),
  graphHeights: perCurve(() => 250),
  overrideXLimits: perCurve(() => false),
  globalXMin: 10,
  globalXMax: 2000,
  filters: [],
  roomConfig: {
    enabled: false,
    length: 5, width: 4, height: 2.5,
    speakers: [],
    listenerX: 2.5, listenerY: 1, listenerZ: 1.2,
    absorption: 0.2,
  },
  cabinConfig: { enabled: false, fCabin: 40 },
  rulerFreq: null,
  displayUnits: {},
});

const workspace = () => ({
  ...defaults(),
  projects: [
    makeProject({ id: "a", name: "B&C", vBox: 100 }),
    makeProject({ id: "b", name: "DD", vBox: 200 }),
    makeProject({ id: "c", name: "Dayton", vBox: 355 }),
  ],
  activeProjectId: "b",
  rulerFreq: 27.8,
});

describe("workspace round trip", () => {
  it("keeps every project, not just the active one", () => {
    // The whole point: saving a project used to drop the other curves silently.
    const w = deserializeWorkspace(serializeWorkspace(workspace()), defaults())!;
    expect(w.projects.map((p) => p.name)).toEqual(["B&C", "DD", "Dayton"]);
    expect(w.projects.map((p) => p.vBox)).toEqual([100, 200, 355]);
  });

  it("preserves the active project, graph framing and ruler", () => {
    const w = deserializeWorkspace(serializeWorkspace(workspace()), defaults())!;
    expect(w.activeProjectId).toBe("b");
    expect(w.rulerFreq).toBe(27.8);
    expect(w.globalXMax).toBe(2000);
  });

  it("stamps a version", () => {
    expect(JSON.parse(serializeWorkspace(workspace())).version).toBe(WORKSPACE_VERSION);
  });
});

describe("reading a workspace defensively", () => {
  it("rejects text that is not JSON", () => {
    expect(deserializeWorkspace("{not json", defaults())).toBeNull();
  });

  it("rejects JSON that is not a workspace", () => {
    expect(deserializeWorkspace('{"hello":"world"}', defaults())).toBeNull();
    expect(deserializeWorkspace('{"projects":[]}', defaults())).toBeNull();
  });

  it("falls back when the active id names a project that is not there", () => {
    const w = deserializeWorkspace(
      JSON.stringify({ projects: [makeProject({ id: "a" })], activeProjectId: "ghost" }),
      defaults(),
    )!;
    expect(w.activeProjectId).toBe("a");
  });

  it("fills in a curve the file predates", () => {
    // A workspace written before max_spl existed must still yield an entry for it.
    const w = deserializeWorkspace(
      JSON.stringify({
        projects: [makeProject({ id: "a" })],
        activeProjectId: "a",
        graphHeights: { spl: 400 },
        overrideXLimits: { spl: true },
      }),
      defaults(),
    )!;
    expect(w.graphHeights.spl).toBe(400);
    for (const curve of CURVE_TYPES) {
      expect(w.graphHeights[curve]).toBeDefined();
      expect(w.overrideXLimits[curve]).toBeDefined();
    }
  });

  it("drops a curve name it does not recognise", () => {
    const w = deserializeWorkspace(
      JSON.stringify({
        projects: [makeProject({ id: "a" })], activeProjectId: "a",
        visibleGraphs: ["spl", "waterfall"],
      }),
      defaults(),
    )!;
    expect(w.visibleGraphs).not.toContain("waterfall");
    expect(w.visibleGraphs).toContain("spl");
  });

  it("backfills project fields the file predates", () => {
    const w = deserializeWorkspace(
      JSON.stringify({ projects: [{ id: "a", vBox: 77 }], activeProjectId: "a" }),
      defaults(),
    )!;
    expect(w.projects[0].vBox).toBe(77);
    expect(w.projects[0].ql).toBeDefined();
  });
});

describe("display units", () => {
  it("round-trips a chosen unit", () => {
    const w = { ...workspace(), displayUnits: { L: "ft³", mm: "in" } };
    const back = deserializeWorkspace(serializeWorkspace(w), defaults());
    expect(back!.displayUnits).toEqual({ L: "ft³", mm: "in" });
  });

  it("loads a workspace written before units existed", () => {
    // Absent means canonical, which is why this needed no version bump.
    const { displayUnits, ...older } = workspace();
    void displayUnits;
    const back = deserializeWorkspace(JSON.stringify({ version: 1, ...older }), defaults());
    expect(back).not.toBeNull();
    expect(back!.displayUnits).toEqual({});
  });
});
