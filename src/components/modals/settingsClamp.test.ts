import { describe, it, expect } from "vitest";
import { clampMin, clampMax } from "./settingsClamp";

describe("frequency range clamps", () => {
  it("leaves an ordinary value alone", () => {
    expect(clampMin(20, 2000)).toBe(20);
    expect(clampMax(2000, 20)).toBe(2000);
  });

  it("stops the minimum reaching the maximum", () => {
    // Both at 10 made logMax - logMin zero and every curve vanished silently.
    expect(clampMin(2000, 2000)).toBe(1999);
    expect(clampMin(5000, 2000)).toBe(1999);
  });

  it("stops the maximum reaching the minimum", () => {
    expect(clampMax(20, 20)).toBe(21);
    expect(clampMax(5, 20)).toBe(21);
  });

  it("holds the floors it always held", () => {
    expect(clampMin(-100, 2000)).toBe(1);
    expect(clampMin(0, 2000)).toBe(1);
    expect(clampMax(2, 1)).toBe(10);
  });

  it("rounds, since a fractional hertz is not a viewport the user set", () => {
    expect(clampMin(20.4, 2000)).toBe(20);
    expect(clampMax(1999.6, 20)).toBe(2000);
  });
});
