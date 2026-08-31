import { describe, it, expect } from "vitest";
import {
  driverDisplacementLitres,
  grossVolumeLitres,
  occupiedVolumeLitres,
  radiatorDisplacementLitres,
} from "./enclosureVolume";
import { makeProject } from "../test/fixtures";

describe("enclosure volume", () => {
  it("counts one body per driver", () => {
    const one = driverDisplacementLitres(makeProject({ numDrivers: 1 }));
    const two = driverDisplacementLitres(makeProject({ numDrivers: 2 }));
    expect(two).toBeCloseTo(one * 2, 9);
  });

  it("counts both halves of an isobaric pair", () => {
    // Isobaric puts a second driver inside the same cabinet, so it displaces twice.
    const standard = driverDisplacementLitres(makeProject({ driverConfig: "standard" }));
    const isobaric = driverDisplacementLitres(
      makeProject({ driverConfig: "isobaric_series" }),
    );
    expect(isobaric).toBeCloseTo(standard * 2, 9);
  });

  it("only counts a radiator when the box has one", () => {
    expect(radiatorDisplacementLitres(makeProject({ enclosureType: "sealed" }))).toBe(0);
    expect(
      radiatorDisplacementLitres(makeProject({ enclosureType: "passive_radiator" })),
    ).toBeGreaterThan(0);
  });

  it("counts ducts only where there are ports", () => {
    const sealed = occupiedVolumeLitres(makeProject({ enclosureType: "sealed" }));
    const ported = occupiedVolumeLitres(
      makeProject({ enclosureType: "ported", vBox: 100, tuningFreq: 32 }),
    );
    expect(ported).toBeGreaterThan(sealed);
  });

  it("gross is the net volume plus whatever is inside it", () => {
    // vBox is what the solver simulates; gross is what has to be built.
    const project = makeProject({ enclosureType: "ported", vBox: 100, tuningFreq: 32 });
    expect(grossVolumeLitres(project)).toBeCloseTo(
      project.vBox + occupiedVolumeLitres(project),
      9,
    );
    expect(grossVolumeLitres(project)).toBeGreaterThan(project.vBox);
  });

  it("has nothing to displace without a driver area", () => {
    const project = makeProject();
    expect(
      driverDisplacementLitres({ ...project, driver: { ...project.driver, sd: 0 } }),
    ).toBe(0);
  });
});
