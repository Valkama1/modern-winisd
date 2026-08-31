import { describe, it, expect } from "vitest";
import { PADDING, axisTitle, axisUnit, clampYRange, makeScales, xTicks, yTicks } from "./graphGeometry";

describe("makeScales", () => {
  const { getX, getY, freqAtX } = makeScales(500, 200, 10, 2000, 0, 100);

  it("places the range edges at the chart edges", () => {
    expect(getX(10)).toBeCloseTo(PADDING.left, 6);
    expect(getX(2000)).toBeCloseTo(PADDING.left + 500, 6);
    expect(getY(100)).toBeCloseTo(PADDING.top, 6);
    expect(getY(0)).toBeCloseTo(PADDING.top + 200, 6);
  });

  it("spaces frequency logarithmically", () => {
    // Decades must be evenly spaced: 10→100 and 100→1000 span the same pixels.
    expect(getX(100) - getX(10)).toBeCloseTo(getX(1000) - getX(100), 6);
  });

  it("clamps values outside the visible range rather than drawing off-canvas", () => {
    expect(getY(1e6)).toBeCloseTo(getY(100), 6);
    expect(getY(-1e6)).toBeCloseTo(getY(0), 6);
  });

  it("freqAtX inverts getX", () => {
    for (const f of [12, 45, 300, 1750]) {
      expect(freqAtX(getX(f))).toBeCloseTo(f, 6);
    }
  });
});

describe("makeScales with a degenerate frequency span", () => {
  // Setting the global min and max to the same value made logMax - logMin zero, so
  // every path became "M NaN NaN L NaN NaN…" and all the curves vanished with no
  // error anywhere. Inverting them mirrored the axis instead: gridlines still looked
  // plausible while the curve ran backwards.
  it("still produces finite pixels when min and max are equal", () => {
    const { getX, freqAtX } = makeScales(500, 200, 10, 10, 0, 100);
    for (const f of [5, 10, 100, 2000]) {
      expect(Number.isFinite(getX(f))).toBe(true);
    }
    expect(Number.isFinite(freqAtX(PADDING.left + 250))).toBe(true);
  });

  it("still produces finite pixels when min is above max", () => {
    const { getX } = makeScales(500, 200, 2000, 10, 0, 100);
    for (const f of [10, 100, 2000]) {
      expect(Number.isFinite(getX(f))).toBe(true);
    }
  });

  it("keeps frequency increasing left to right when the range is inverted", () => {
    const { getX } = makeScales(500, 200, 2000, 10, 0, 100);
    expect(getX(2000)).toBeGreaterThan(getX(20));
  });
});

describe("clampYRange", () => {
  it("never lets a curve dictate an unreadable range", () => {
    // Impedance spikes are capped so the rest of the curve is not flattened.
    const { dbMax } = clampYRange("impedance", 0, 99999);
    expect(dbMax).toBe(1000);
  });

  it("holds a floor per curve type", () => {
    expect(clampYRange("excursion", -50, 10).dbMin).toBe(0);
    expect(clampYRange("spl", 0, 120).dbMin).toBe(20);
  });

  it("rounds outward to a multiple of five", () => {
    const { dbMin, dbMax } = clampYRange("spl", 83.2, 118.4);
    expect(dbMin).toBe(80);
    expect(dbMax).toBe(120);
  });

  it("always leaves a non-zero span", () => {
    const { dbMin, dbMax } = clampYRange("spl", 100, 100);
    expect(dbMax).toBeGreaterThan(dbMin);
  });
});

describe("xTicks", () => {
  it("keeps only ticks inside the span and pins both edges", () => {
    const ticks = xTicks(20, 500);
    expect(ticks[0]).toBe(20);
    expect(ticks[ticks.length - 1]).toBe(500);
    expect(ticks.every((t) => t >= 20 && t <= 500)).toBe(true);
  });

  it("does not duplicate an edge that is already a tick", () => {
    const ticks = xTicks(10, 2000);
    expect(new Set(ticks).size).toBe(ticks.length);
  });
});

describe("yTicks", () => {
  it("keeps the line count manageable however tall the range", () => {
    expect(yTicks(0, 10).length).toBeLessThanOrEqual(12);
    expect(yTicks(0, 1000).length).toBeLessThanOrEqual(25);
  });

  it("starts at the top of the range", () => {
    expect(yTicks(20, 120)[0]).toBe(120);
  });
});

describe("axis labels", () => {
  it("names excursion as a peak measurement", () => {
    expect(axisTitle("excursion")).toContain("peak");
    expect(axisUnit("excursion")).toBe("mm");
  });

  it("gives every curve a unit", () => {
    for (const m of ["transfer", "spl", "excursion", "velocity", "impedance", "phase", "group_delay"] as const) {
      expect(axisUnit(m).length).toBeGreaterThan(0);
      expect(axisTitle(m).length).toBeGreaterThan(0);
    }
  });
});
