import { describe, it, expect, beforeEach } from "vitest";
import { loadSavedSession } from "./session";
import { CURVE_TYPES, perCurve, oneOf, ENCLOSURE_TYPES, PORT_SHAPES } from "../types";

describe("loadSavedSession", () => {
  beforeEach(() => localStorage.clear());

  it("returns null when nothing is stored", () => {
    expect(loadSavedSession()).toBeNull();
  });

  it("returns null rather than throwing on corrupt storage", () => {
    localStorage.setItem("winisd_session_state", "{not json");
    expect(loadSavedSession()).toBeNull();
  });

  it("backfills passive crossover fields absent from older sessions", () => {
    localStorage.setItem(
      "winisd_session_state",
      JSON.stringify({ projects: [{ id: "p0", vBox: 90 }], activeProjectId: "p0" }),
    );
    const session = loadSavedSession()!;
    const project = session.projects![0];
    expect(project.vBox).toBe(90);            // the stored value survives
    expect(project.passiveXoEnabled).toBe(false);
    expect(project.passiveXoType).toBe("lowpass_1st");
  });

  it("ignores a session with no projects", () => {
    localStorage.setItem("winisd_session_state", JSON.stringify({ projects: [] }));
    expect(loadSavedSession()).toBeNull();
  });
});

describe("perCurve", () => {
  it("covers every curve the dashboard can show", () => {
    // Per-curve records used to be written out by hand and had drifted: the X-override
    // defaults were missing phase and group_delay.
    const record = perCurve(() => false);
    for (const curve of CURVE_TYPES) {
      expect(record).toHaveProperty(curve);
    }
    expect(Object.keys(record)).toHaveLength(CURVE_TYPES.length);
  });
});

describe("oneOf", () => {
  it("passes through a known value", () => {
    expect(oneOf(ENCLOSURE_TYPES, "bandpass4", "sealed")).toBe("bandpass4");
  });

  it("falls back for anything a saved file should not contain", () => {
    expect(oneOf(ENCLOSURE_TYPES, "horn", "sealed")).toBe("sealed");
    expect(oneOf(PORT_SHAPES, undefined, "circular")).toBe("circular");
    expect(oneOf(PORT_SHAPES, null, "circular")).toBe("circular");
    expect(oneOf(PORT_SHAPES, 7, "circular")).toBe("circular");
  });
});
