import { describe, it, expect } from "vitest";
import { effectiveVasLitres } from "./calculations";
import { DEFAULT_DRIVER, Driver, DriverConfig } from "../types";

/**
 * Reference values produced by the Rust solver's own effective_vas.
 * Regenerate with:
 *   cargo test --lib -- --ignored --nocapture emit_effective_vas_reference
 *
 * Same pinning contract as portGeometry.test.ts, and for the same reason: this
 * number decides what the statistics panel calls Qtc, and it has to be the number
 * the solver simulated, not a second opinion.
 * [fs Hz, sd cm², mms g, nameplate vas L, driverConfig, expected effective vas L]
 */
const RUST_REFERENCE: [number, number, number, number, DriverConfig, number][] = [
  [33, 1680, 335, 278, "standard", 272.054796585],
  [33, 1680, 335, 278, "isobaric_series", 136.027398293],
  [33, 1680, 335, 278, "isobaric_parallel", 136.027398293],
  [19.5, 330, 95, 40, "standard", 106.009689486],
  [26.4, 500, 220, 53, "standard", 57.335022171],
  [30, 800, 0, 120, "standard", 120.0],
  [30, 800, 0, 120, "isobaric_series", 120.0],
];

const driver = (fs: number, sd: number, mms: number, vas: number): Driver =>
  ({ ...DEFAULT_DRIVER, fs, sd, mms, vas });

describe("effectiveVasLitres", () => {
  it("matches the Rust solver to nine decimals", () => {
    for (const [fs, sd, mms, vas, config, expected] of RUST_REFERENCE) {
      expect(effectiveVasLitres(driver(fs, sd, mms, vas), config)).toBeCloseTo(expected, 9);
    }
  });

  it("derives from Fs, Mms and Sd rather than trusting the nameplate", () => {
    // solve_circuit takes compliance from Fs and Mms and never reads Vas, so a driver
    // whose nameplate disagrees is simulated as the derived figure. driverChecks
    // tolerates up to 15% of this silently, which is what makes it the normal case.
    const d = driver(33, 1680, 335, 999);
    expect(effectiveVasLitres(d, "standard")).toBeCloseTo(272.054796585, 6);
  });

  it("halves for an isobaric pair, which doubles Mms", () => {
    const d = driver(33, 1680, 335, 278);
    expect(effectiveVasLitres(d, "isobaric_series"))
      .toBeCloseTo(effectiveVasLitres(d, "standard") / 2, 9);
  });

  it("falls back to the nameplate when there is no Mms to derive from", () => {
    expect(effectiveVasLitres(driver(30, 800, 0, 120), "standard")).toBe(120);
  });

  it("never returns zero, so a caller can divide by it", () => {
    expect(effectiveVasLitres(driver(30, 800, 0, 0), "standard")).toBeGreaterThan(0);
    expect(effectiveVasLitres(driver(0, 0, 0, 0), "standard")).toBeGreaterThan(0);
  });
});
