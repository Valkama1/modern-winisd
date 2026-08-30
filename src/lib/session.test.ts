import { describe, it, expect, beforeEach } from "vitest";
import { loadSavedSession } from "./session";
import { CURVE_TYPES, perCurve, oneOf, ENCLOSURE_TYPES, PORT_SHAPES, DEFAULT_QL, Project } from "../types";
import { withProjectDefaults } from "./projectDefaults";

describe("loadSavedSession", () => {
  beforeEach(() => localStorage.clear());

  it("returns null when nothing is stored", () => {
    expect(loadSavedSession()).toBeNull();
  });

  it("returns null rather than throwing on corrupt storage", () => {
    localStorage.setItem("winisd_session_state", "{not json");
    expect(loadSavedSession()).toBeNull();
  });

  it("returns the stored projects as they were written", () => {
    // Filling in missing fields is withProjectDefaults' job, not this function's.
    localStorage.setItem(
      "winisd_session_state",
      JSON.stringify({ projects: [{ id: "p0", vBox: 90 }], activeProjectId: "p0" }),
    );
    expect(loadSavedSession()!.projects![0].vBox).toBe(90);
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

describe("withProjectDefaults", () => {
  it("fills in a field the stored project predates", () => {
    // Sessions written before enclosure losses existed restored with ql undefined,
    // which left the Ql control blank with no indication of what was in effect.
    const restored = withProjectDefaults({ id: "p0", vBox: 90 } as Partial<Project>);
    expect(restored.ql).toBe(DEFAULT_QL);
    expect(restored.vBox).toBe(90);
  });

  it("leaves stored values alone", () => {
    const restored = withProjectDefaults({ id: "p0", vBox: 90, ql: 15 } as Partial<Project>);
    expect(restored.ql).toBe(15);
  });

  it("produces a project with every field a fresh one has", () => {
    const fresh = withProjectDefaults({});
    const sparse = withProjectDefaults({ vBox: 42 } as Partial<Project>);
    expect(Object.keys(sparse).sort()).toEqual(Object.keys(fresh).sort());
    for (const key of Object.keys(fresh)) {
      expect(sparse[key as keyof Project]).toBeDefined();
    }
  });
});
