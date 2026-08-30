import { describe, it, expect } from "vitest";
import { dominantLimit, formatWatts, limitTransition, passbandLevelDb, xmaxHeadroom } from "./driverLimits";
import { SimPoint } from "../types";

const pts = (dbs: number[]): SimPoint[] =>
  dbs.map((db, i) => ({ frequency: 10 * Math.pow(1.1, i), db, phase_rad: 0 }));

describe("passbandLevelDb", () => {
  it("takes the median of the upper 40 percent", () => {
    // Rolloff at the bottom, flat 100 dB on top: the rolloff must not drag it down.
    const level = passbandLevelDb(pts([60, 70, 80, 90, 100, 100, 100, 100, 100, 100]));
    expect(level).toBe(100);
  });

  it("is unmoved by a single resonance, unlike a mean", () => {
    const withSpike = passbandLevelDb(pts([90, 90, 90, 90, 90, 90, 90, 90, 90, 130]));
    expect(withSpike).toBe(90);
  });

  it("returns null when there is too little data to be meaningful", () => {
    expect(passbandLevelDb(pts([90, 90, 90]))).toBeNull();
  });
});

describe("xmaxHeadroom", () => {
  const spl = pts(Array(20).fill(100));

  it("scales power quadratically with the excursion ratio", () => {
    // Half of Xmax at 100 W means four times the power is available.
    const h = xmaxHeadroom(10, 100, pts(Array(20).fill(5)), spl)!;
    expect(h.peakExcursionMm).toBe(5);
    expect(h.powerAtXmax).toBeCloseTo(400, 6);
    expect(h.exceeded).toBe(false);
  });

  it("converts that power headroom into dB", () => {
    // 4x the power is +6.02 dB on the passband.
    const h = xmaxHeadroom(10, 100, pts(Array(20).fill(5)), spl)!;
    expect(h.splAtXmax).toBeCloseTo(106.02, 2);
  });

  it("flags a driver already past its limit", () => {
    const h = xmaxHeadroom(10, 100, pts(Array(20).fill(12)), spl)!;
    expect(h.exceeded).toBe(true);
    expect(h.powerAtXmax).toBeLessThan(100);
  });

  it("still reports power when SPL data is unavailable", () => {
    const h = xmaxHeadroom(10, 100, pts(Array(20).fill(5)), [])!;
    expect(h.powerAtXmax).toBeCloseTo(400, 6);
    expect(h.splAtXmax).toBeNull();
  });

  it("returns null when there is nothing to measure", () => {
    expect(xmaxHeadroom(0, 100, pts([5, 5]), spl)).toBeNull();
    expect(xmaxHeadroom(10, 100, [], spl)).toBeNull();
  });
});

describe("formatWatts", () => {
  it("gives sub-watt values a second decimal", () => {
    expect(formatWatts(0.42)).toBe("0.42");
    expect(formatWatts(120.456)).toBe("120.5");
  });
});

const tagged = (limits: ("excursion" | "power")[]): SimPoint[] =>
  limits.map((limited_by, i) => ({
    frequency: 10 * Math.pow(1.1, i), db: 100, phase_rad: 0, limited_by,
  }));

describe("limitTransition", () => {
  it("finds where cone travel gives way to coil heating", () => {
    const pts = tagged(["excursion", "excursion", "excursion", "power", "power"]);
    const t = limitTransition(pts)!;
    expect(t.frequencyHz).toBeCloseTo(pts[3].frequency, 9);
    expect(t.belowIsExcursion).toBe(true);
  });

  it("reports the direction when the order is reversed", () => {
    const t = limitTransition(tagged(["power", "power", "excursion"]))!;
    expect(t.belowIsExcursion).toBe(false);
  });

  it("returns null when one limit binds throughout", () => {
    expect(limitTransition(tagged(["excursion", "excursion"]))).toBeNull();
  });

  it("returns null for a curve that carries no limits", () => {
    expect(limitTransition([{ frequency: 20, db: 90, phase_rad: 0 }])).toBeNull();
  });
});

describe("dominantLimit", () => {
  it("names the single binding limit", () => {
    expect(dominantLimit(tagged(["power", "power"]))).toBe("power");
  });

  it("reports mixed when both bind somewhere", () => {
    expect(dominantLimit(tagged(["excursion", "power"]))).toBe("mixed");
  });

  it("returns null for an untagged curve", () => {
    expect(dominantLimit([{ frequency: 20, db: 90, phase_rad: 0 }])).toBeNull();
  });
});
