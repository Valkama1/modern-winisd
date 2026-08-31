import { describe, it, expect } from "vitest";
import {
  UNIT_ALTERNATIVES,
  alternativesFor,
  formatInUnit,
  nextUnit,
  toCanonical,
  toDisplay,
} from "./units";

describe("unit alternatives", () => {
  it("offers nothing for a unit with no sensible alternative", () => {
    // Hz, watts and ohms are the same everywhere; those fields stay plain text.
    for (const u of ["Hz", "W", "Ω", "dB", "ms", "m/s"]) {
      expect(alternativesFor(u), u).toEqual([]);
    }
  });

  it("lists the canonical unit first, so it is what a fresh field shows", () => {
    for (const [canonical, opts] of Object.entries(UNIT_ALTERNATIVES)) {
      expect(opts[0].symbol, canonical).toBe(canonical);
      expect(opts[0].canonicalPer, canonical).toBe(1);
    }
  });
});

describe("conversion", () => {
  // Exact definitions: an inch is 2.54 cm, a foot 0.3048 m, an ounce 28.349523125 g.
  const CASES: [string, string, number, number][] = [
    ["L", "ft³", 28.316846592, 1],
    ["cm²", "in²", 6.4516, 1],
    ["cm", "in", 2.54, 1],
    ["mm", "in", 25.4, 1],
    ["m", "ft", 0.3048, 1],
    ["g", "oz", 28.349523125, 1],
  ];

  it("matches the defining conversion factors", () => {
    for (const [canonical, symbol, canonicalValue, expected] of CASES) {
      expect(toDisplay(canonical, symbol, canonicalValue), `${canonical}→${symbol}`)
        .toBeCloseTo(expected, 12);
    }
  });

  it("inverts itself", () => {
    for (const [canonical, symbol] of CASES) {
      for (const v of [0, 0.001, 1, 33, 278.4, 1680, 99999]) {
        expect(toCanonical(canonical, symbol, toDisplay(canonical, symbol, v))).toBeCloseTo(v, 9);
      }
    }
  });

  it("is the identity for the canonical unit itself", () => {
    expect(toDisplay("L", "L", 278)).toBe(278);
    expect(toCanonical("L", "L", 278)).toBe(278);
  });

  it("passes a value through unchanged for a unit it does not know", () => {
    // A field whose unit has no registry entry must behave exactly as before.
    expect(toDisplay("Hz", "Hz", 33)).toBe(33);
    expect(toCanonical("Ω", "Ω", 4.9)).toBe(4.9);
  });
});

describe("formatInUnit", () => {
  it("leaves the canonical unit's text exactly as it was", () => {
    // The value box used to render String(value); anything else would visibly change
    // every field in the app that was never toggled.
    expect(formatInUnit("L", "L", 278)).toBe("278");
    expect(formatInUnit("Hz", "Hz", 33.5)).toBe("33.5");
    expect(formatInUnit("cm", "cm", 0)).toBe("0");
  });

  it("rounds a converted value to something readable", () => {
    expect(formatInUnit("L", "ft³", 278)).toBe("9.817");
    expect(formatInUnit("mm", "in", 14)).toBe("0.551");
    expect(formatInUnit("g", "oz", 335)).toBe("11.82");
  });
});

describe("nextUnit", () => {
  it("cycles through the alternatives and back", () => {
    expect(nextUnit("L", "L")).toBe("ft³");
    expect(nextUnit("L", "ft³")).toBe("L");
  });

  it("stays put when there is nothing to cycle to", () => {
    expect(nextUnit("Hz", "Hz")).toBe("Hz");
  });

  it("recovers from a symbol that is no longer offered", () => {
    // A workspace saved with a unit a later version dropped must not strand the field.
    expect(nextUnit("L", "gallons")).toBe("L");
  });
});
