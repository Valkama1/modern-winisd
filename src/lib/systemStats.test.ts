import { describe, it, expect } from "vitest";
import { computeSystemStats } from "./systemStats";
import { makeProject } from "../test/fixtures";
import { DEFAULT_DRIVER } from "../types";

const find = (stats: ReturnType<typeof computeSystemStats>, label: string) =>
  stats.find((s) => s.label === label);

describe("computeSystemStats", () => {
  it("derives Qtc and alpha for a sealed box from closed form", () => {
    // Qtc = Qts·√(Vas/Vb + 1). The Vas is the one the solver derives from Fs, Mms and
    // Sd — 272.05 L for the default driver, not its 278 L nameplate — so in 150 L that
    // is α = 1.81 and Qtc = 0.36·√(2.814) = 0.604.
    const stats = computeSystemStats(
      makeProject({ enclosureType: "sealed", vBox: 150 }),
      "test-project",
      {},
    );
    expect(find(stats, "α = Vas/Vb")?.value).toBe("1.81");
    expect(Number(find(stats, "Qtc")?.value)).toBeCloseTo(0.604, 3);
  });

  it("halves the effective volume per driver when two are fitted", () => {
    // vbEff = Vb / n, so α doubles for the same box with two drivers.
    const stats = computeSystemStats(
      makeProject({ enclosureType: "sealed", vBox: 150, numDrivers: 2 }),
      "test-project",
      {},
    );
    expect(find(stats, "α = Vas/Vb")?.value).toBe("3.63");
  });

  it("sizes the box from the Vas the solver uses, not the nameplate", () => {
    // solve_circuit takes compliance from Fs and Mms and never reads Vas. A driver
    // whose nameplate says 999 L is still simulated at the 272 L its Mms implies, so
    // every figure here has to agree — α = 272.05/150, not 999/150.
    const stats = computeSystemStats(
      makeProject({
        enclosureType: "sealed",
        vBox: 150,
        driver: { ...DEFAULT_DRIVER, vas: 999 },
      }),
      "test-project",
      {},
    );
    expect(find(stats, "α = Vas/Vb")?.value).toBe("1.81");
  });

  it("halves alpha for an isobaric pair", () => {
    // apply_driver_config doubles Mms for both wirings, so effective Vas halves.
    const stats = computeSystemStats(
      makeProject({ enclosureType: "sealed", vBox: 150, driverConfig: "isobaric_series" }),
      "test-project",
      {},
    );
    expect(find(stats, "α = Vas/Vb")?.value).toBe("0.91");
  });

  it("reports Vb/Vas against the derived figure for a vented box", () => {
    const stats = computeSystemStats(
      makeProject({
        enclosureType: "ported",
        vBox: 150,
        driver: { ...DEFAULT_DRIVER, vas: 999 },
      }),
      "test-project",
      {},
    );
    // 150 / 272.05, not 150 / 999.
    expect(find(stats, "Vb / Vas")?.value).toBe("0.55");
  });

  it("reports the tuning ratio for a vented box", () => {
    // h = Fb/Fs = 33/33 = 1 for the default driver at its own resonance.
    const stats = computeSystemStats(
      makeProject({ enclosureType: "ported", tuningFreq: 33 }),
      "test-project",
      {},
    );
    expect(find(stats, "Fb")?.value).toBe("33 Hz");
    expect(Number(find(stats, "h = Fb / Fs")?.value)).toBeCloseTo(1.0, 3);
  });

  it("describes a bandpass by its centre frequency and bandwidth", () => {
    const stats = computeSystemStats(
      makeProject({
        enclosureType: "bandpass6_parallel",
        rearTuningFreq: 30,
        frontTuningFreq: 60,
      }),
      "test-project",
      {},
    );
    // Geometric centre of 30 and 60 Hz is √1800 = 42.4 Hz, spanning one octave.
    expect(find(stats, "Geo. center")?.value).toBe("42.4 Hz");
    expect(find(stats, "BW")?.value).toBe("1.0 oct");
  });

  it("uses the passive radiator's own Fs as the tuning", () => {
    const stats = computeSystemStats(
      makeProject({ enclosureType: "passive_radiator", prFs: 25 }),
      "test-project",
      {},
    );
    expect(find(stats, "PR Fs")?.value).toBe("25 Hz");
  });

  it("returns stats without simulation results present", () => {
    const stats = computeSystemStats(makeProject(), "missing-id", {});
    expect(stats.length).toBeGreaterThan(0);
  });
});
