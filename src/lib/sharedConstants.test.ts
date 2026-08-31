import { describe, it, expect } from "vitest";
import { RHO_AIR, SPEED_OF_SOUND, cmsFromVasSd, vasLitresFromCmsSd } from "./calculations";
import { END_CORRECTION } from "./portGeometry";
import { DEFAULT_QL } from "../types";

/**
 * Values emitted by the Rust side, which is where the solver reads them from.
 * Regenerate with:
 *   cargo test --lib -- --ignored --nocapture emit_shared_constants
 *
 * Four constants are declared once per language here, and nothing but this test holds
 * them together. The same pattern as portGeometry.test.ts, and for the same reason:
 * the two sides have already drifted twice, once on the end correction — a 0.85
 * against the solver's 0.732.
 *
 * A build.rs generating a .ts file would remove the duplication outright rather than
 * detect it, but it would also make `tsc` depend on having run `cargo` first, in a
 * repo where the two builds are otherwise independent. This catches the same drift in
 * CI without that coupling.
 */
const RUST_REFERENCE = {
  RHO_AIR: 1.18,
  SPEED_OF_SOUND: 343.0,
  END_CORRECTION: 0.732,
  DEFAULT_QL: 7.0,
};

describe("constants shared with the Rust solver", () => {
  it("matches the values the solver uses", () => {
    expect(RHO_AIR).toBe(RUST_REFERENCE.RHO_AIR);
    expect(SPEED_OF_SOUND).toBe(RUST_REFERENCE.SPEED_OF_SOUND);
    expect(END_CORRECTION).toBe(RUST_REFERENCE.END_CORRECTION);
    expect(DEFAULT_QL).toBe(RUST_REFERENCE.DEFAULT_QL);
  });
});

describe("vasLitresFromCmsSd", () => {
  it("inverts cmsFromVasSd", () => {
    for (const [vas, sd] of [[278, 1680], [40, 330], [53, 500], [0.5, 20]]) {
      expect(vasLitresFromCmsSd(cmsFromVasSd(vas, sd), sd)).toBeCloseTo(vas, 9);
    }
  });

  it("derives Vas from the constants rather than a pre-multiplied literal", () => {
    // driverChecks spelled this as 0.00138813 · sd² · (Cms·1000), which is ρ·c²·1e-8
    // rounded — and 0.0092% stale — in a file importing both constants on line 1.
    const cms = 1e-4;
    const sd = 1680;
    const fromConstants = RHO_AIR * SPEED_OF_SOUND ** 2 * (sd * 1e-4) ** 2 * cms * 1000;
    const fromStaleLiteral = 0.00138813 * sd ** 2 * cms * 1000;

    expect(vasLitresFromCmsSd(cms, sd)).toBeCloseTo(fromConstants, 9);
    // Far enough apart that the assertion above is not merely rounding.
    expect(Math.abs(vasLitresFromCmsSd(cms, sd) - fromStaleLiteral)).toBeGreaterThan(1e-3);
  });
});
