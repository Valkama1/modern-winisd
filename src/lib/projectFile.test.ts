import { describe, it, expect } from "vitest";
import { toProjectFile } from "./projectFile";
import { makeProject } from "../test/fixtures";
import { DEFAULT_QL } from "../types";

describe("toProjectFile", () => {
  it("writes the enclosure loss Q", () => {
    // It did not, and nothing said so: useProjects read `ql` back on load and
    // defaulted it to 7 when absent, but the save payload never emitted it. Tuning QL
    // to 15 and saving gave 7 back — a different simulation, silently.
    expect(toProjectFile(makeProject({ ql: 15 })).ql).toBe(15);
  });

  it("round-trips every value the loader reads back", () => {
    const project = makeProject({
      ql: 12,
      portQ: 32,
      vBox: 175,
      tuningFreq: 28,
      driverConfig: "isobaric_parallel",
      splEnvironment: "corner",
      prXmax: 22,
      port2Enabled: true,
    });
    const file = toProjectFile(project);

    expect(file.ql).toBe(12);
    expect(file.port_q).toBe(32);
    expect(file.v_box).toBe(175);
    expect(file.tuning_freq).toBe(28);
    expect(file.driver_config).toBe("isobaric_parallel");
    expect(file.spl_environment).toBe("corner");
    expect(file.pr_xmax).toBe(22);
    expect(file.port2_enabled).toBe(true);
  });

  it("leaves no field undefined, so serde cannot drop one on the way in", () => {
    // The return type is Required<ProjectFile>, so a field added to the format
    // without being added here is a compile error. This covers the other direction:
    // a key that is present but carries undefined disappears through JSON.stringify
    // just as surely as one that was never written.
    const file = toProjectFile(makeProject());
    const undefinedKeys = Object.entries(file)
      .filter(([, v]) => v === undefined)
      .map(([k]) => k);
    expect(undefinedKeys).toEqual([]);
  });

  it("defaults a project with no ql of its own to the documented figure", () => {
    const { ql, ...rest } = makeProject();
    void ql;
    expect(toProjectFile({ ...rest, ql: undefined as unknown as number }).ql).toBe(DEFAULT_QL);
  });
});
