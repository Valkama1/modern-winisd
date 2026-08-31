import { describe, it, expect } from "vitest";
import { ebp } from "./calculations";
import { DEFAULT_DRIVER } from "../types";

describe("ebp", () => {
  it("is Fs over Qes", () => {
    // bc21: 33 / 0.37 = 89.2, comfortably a ported driver.
    expect(ebp(DEFAULT_DRIVER)).toBeCloseTo(89.19, 2);
  });

  it("is zero rather than infinite when Qes is missing", () => {
    // Qes is optional on a part-filled driver, and Infinity would render as "Infinity"
    // on the browser card.
    expect(ebp({ ...DEFAULT_DRIVER, qes: 0 })).toBe(0);
    expect(ebp({ ...DEFAULT_DRIVER, qes: -1 })).toBe(0);
  });
});
