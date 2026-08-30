import { describe, it, expect } from "vitest";
import { computeSystemStats } from "./systemStats";
import { makeProject } from "../test/fixtures";

const find = (stats: ReturnType<typeof computeSystemStats>, label: string) =>
  stats.find((s) => s.label === label);

describe("computeSystemStats", () => {
  it("derives Qtc and alpha for a sealed box from closed form", () => {
    // Qtc = Qts·√(Vas/Vb + 1); with the default driver (Qts 0.36, Vas 278) in 150 L
    // that is 0.36·√(2.853) = 0.608, and α = 278/150 = 1.85.
    const stats = computeSystemStats(
      makeProject({ enclosureType: "sealed", vBox: 150 }),
      "test-project",
      {},
    );
    expect(find(stats, "α = Vas/Vb")?.value).toBe("1.85");
    expect(Number(find(stats, "Qtc")?.value)).toBeCloseTo(0.608, 2);
  });

  it("halves the effective volume per driver when two are fitted", () => {
    // vbEff = Vb / n, so α doubles for the same box with two drivers.
    const stats = computeSystemStats(
      makeProject({ enclosureType: "sealed", vBox: 150, numDrivers: 2 }),
      "test-project",
      {},
    );
    expect(find(stats, "α = Vas/Vb")?.value).toBe("3.71");
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
