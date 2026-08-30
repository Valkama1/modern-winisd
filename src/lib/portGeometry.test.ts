import { describe, it, expect } from "vitest";
import {
  MIN_PORT_LENGTH_M,
  portAreaM2,
  portDisplacementLitres,
  portLengthM,
  projectPortLength,
  totalPortAreaM2,
} from "./portGeometry";
import { makeProject } from "../test/fixtures";

/**
 * Reference values produced by the Rust solver's own derive_port_length_m.
 * Regenerate with:
 *   cargo test --lib -- --ignored --nocapture emit_port_length_reference
 *
 * The two implementations drifting apart is not hypothetical — it has happened twice,
 * once as mismatched length floors and once as different end corrections. This pins
 * them together: [area m², tuning Hz, volume m³, expected length m].
 */
const RUST_REFERENCE: [number, number, number, number][] = [
  [0.00785, 33, 0.05, 0.393044894],
  [0.00785, 20, 0.15, 0.3533036],
  [0.03, 32, 0.12, 0.656028159],
  [0.015, 45, 0.03, 0.685242862],
  [0.05, 25, 0.2, 1.099686943],
  [0.08, 40, 0.04, 3.60829468],
  [0.00196, 60, 0.015, 0.089882307],
  [0.001, 100, 0.5, 0.01],
];

describe("portLengthM", () => {
  it("matches the Rust solver to nine decimals", () => {
    for (const [area, tuning, volume, expected] of RUST_REFERENCE) {
      expect(portLengthM(area, tuning, volume)).toBeCloseTo(expected, 9);
    }
  });

  it("never returns a duct shorter than the solver will model", () => {
    // A vent far too small for the wanted tuning: no physical duct reaches it.
    expect(portLengthM(0.001, 100, 0.5)).toBe(MIN_PORT_LENGTH_M);
  });

  it("falls back rather than returning nonsense for unusable input", () => {
    expect(portLengthM(0, 33, 0.05)).toBe(0.15);
    expect(portLengthM(0.008, 0, 0.05)).toBe(0.15);
    expect(portLengthM(0.008, 33, 0)).toBe(0.15);
  });

  it("needs a longer duct for a lower tuning", () => {
    expect(portLengthM(0.008, 25, 0.06)).toBeGreaterThan(portLengthM(0.008, 40, 0.06));
  });
});

describe("portAreaM2", () => {
  it("computes a circular port from its diameter", () => {
    expect(portAreaM2("circular", 10, 0, 0)).toBeCloseTo(Math.PI * 0.05 * 0.05, 9);
  });

  it("computes a slot from width and height", () => {
    expect(portAreaM2("rectangular", 0, 30, 5)).toBeCloseTo(0.3 * 0.05, 9);
  });
});

describe("totalPortAreaM2", () => {
  it("counts every port in the group", () => {
    const one = totalPortAreaM2(makeProject({ portCount: 1, portDiameter: 10 }));
    const two = totalPortAreaM2(makeProject({ portCount: 2, portDiameter: 10 }));
    expect(two).toBeCloseTo(one * 2, 9);
  });

  it("includes the second port group when it is enabled", () => {
    const without = totalPortAreaM2(makeProject({ port2Enabled: false }));
    const with2 = totalPortAreaM2(
      makeProject({ port2Enabled: true, port2Count: 1, port2Shape: "circular", port2Diameter: 10 }),
    );
    expect(with2).toBeGreaterThan(without);
  });
});

describe("portDisplacementLitres", () => {
  it("grows when a second port group is added", () => {
    // The old net-volume stat sized ducts from a single port's area and ignored group
    // two, so it under-reported displacement badly for multi-port boxes.
    const base = makeProject({ enclosureType: "ported", vBox: 100, tuningFreq: 32, portCount: 1 });
    const dual = makeProject({
      ...base, port2Enabled: true, port2Count: 1, port2Shape: "circular", port2Diameter: 10,
    });
    expect(portDisplacementLitres(dual)).toBeGreaterThan(portDisplacementLitres(base));
  });

  it("is zero when there is nothing to compute from", () => {
    expect(portDisplacementLitres(makeProject({ vBox: 0 }))).toBe(0);
    expect(portDisplacementLitres(makeProject({ tuningFreq: 0 }))).toBe(0);
  });
});

describe("projectPortLength", () => {
  it("reports the same length the solver will use", () => {
    const project = makeProject({ enclosureType: "ported", vBox: 100, tuningFreq: 32, portCount: 2 });
    const expected = portLengthM(
      totalPortAreaM2(project),
      project.tuningFreq,
      (project.vBox / project.numDrivers) * 1e-3,
    );
    expect(projectPortLength(project).lengthCm).toBeCloseTo(expected * 100, 9);
  });

  it("flags a vent that cannot reach the requested tuning", () => {
    const tiny = makeProject({
      enclosureType: "ported", vBox: 500, tuningFreq: 100, portDiameter: 3.6, portCount: 1,
    });
    expect(projectPortLength(tiny).clamped).toBe(true);
  });
});
