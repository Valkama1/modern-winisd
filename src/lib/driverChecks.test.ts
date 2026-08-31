import { describe, it, expect } from "vitest";
import { checkDriverParameters, DriverCheckInput } from "./driverChecks";

/** DD Audio 715f-D2 as published, with Mms/BL/Le/Re derived or assumed. */
const dd715f: DriverCheckInput = {
  fs: 30.25, qes: 0.6854, qms: 7.353, qts: 0.627, vas: 62.47, sd: 823.7,
  re: 0.8, mms: 417.4, bl: 9.62, le: 1.7, xmax: 22, pe: 1500, sens: 85.9,
};

/** Dayton UMII18-22 as stored — its sensitivity does not follow from the rest. */
const dayton: DriverCheckInput = {
  fs: 22.0, qes: 0.67, qms: 2.53, qts: 0.53, vas: 248.2, sd: 1184,
  re: 4.2, mms: 420, bl: 19.2, le: 1.15, xmax: 28, pe: 1200, sens: 90.7,
};

/**
 * Sundown SS12-22 as published, voice coils in series.
 *
 * Its sheet quotes every parameter the Thiele/Small identities relate, so it is
 * over-determined and genuinely self-consistent — the identities close to between
 * 0.2% and 2.1%. That makes it the case that says whether this checker's tolerances
 * are calibrated: a driver this well specified must come back clean, or the checker
 * is crying wolf on the best data it will ever see.
 *
 * `sens` is the sheet's 88.1 dB @ 2.83 V / 1 m converted to the 1 W / 1 m figure this
 * field means — 2.83 V into 4.9 Ω is 1.634 W, so 2.13 dB of it is the convention.
 */
const ss12_22: DriverCheckInput = {
  fs: 27, qes: 0.39, qms: 3.47, qts: 0.35, vas: 49.4, sd: 528,
  re: 4.9, mms: 275, bl: 24.3, le: 1.8, xmax: 23, pe: 900, sens: 85.97,
};

const anomaly = (r: ReturnType<typeof checkDriverParameters>, needle: string) =>
  r.anomalies.some((a) => a.includes(needle));

describe("checkDriverParameters", () => {
  it("passes a self-consistent driver", () => {
    expect(checkDriverParameters(dd715f).anomalies).toEqual([]);
  });

  it("passes a driver whose published sheet closes on every identity", () => {
    // If the best-specified driver available trips a check, the check is wrong.
    expect(checkDriverParameters(ss12_22).anomalies).toEqual([]);
  });

  it("flags the 2.83 V sensitivity figure entered as though it were 1 W", () => {
    // Car-audio sheets quote 2.83 V/1 m, this field is 1 W/1 m, and for a 4.9 Ω
    // driver the two differ by 2.13 dB. Entering the printed number unconverted
    // overstates the driver everywhere sensitivity is used, and nothing else in the
    // parameter set contradicts it — this check is the only thing that can notice.
    const asPrinted = { ...ss12_22, sens: 88.1 };
    expect(anomaly(checkDriverParameters(asPrinted), "Sensitivity Discrepancy")).toBe(true);
  });

  it("catches a sensitivity that does not follow from Fs, Vas and Qes", () => {
    // 90.7 dB stated against 87.9 implied — the simulation follows the derived figure,
    // so the graphs sit 2.8 dB below what the datasheet promises.
    //
    // That implied figure was 88.1 until the half-space reference was corrected from
    // 112.2 to its exact 112.02, which moved every implied sensitivity down 0.18 dB.
    const r = checkDriverParameters(dayton);
    expect(anomaly(r, "Sensitivity Discrepancy")).toBe(true);
    expect(r.anomalies.join(" ")).toContain("87.9");
  });

  it("warns when Le is missing, since it sets the whole top end", () => {
    const r = checkDriverParameters({ ...dd715f, le: 0 });
    expect(anomaly(r, "Inductance")).toBe(true);
    // And tells you what will be assumed instead.
    expect(r.anomalies.join(" ")).toContain("0.12 mH");
  });

  it("catches a Qts that disagrees with Qes and Qms", () => {
    const r = checkDriverParameters({ ...dd715f, qts: 0.45 });
    expect(anomaly(r, "Qts Discrepancy")).toBe(true);
  });

  it("catches a transposed Vas", () => {
    const r = checkDriverParameters({ ...dd715f, vas: 26.47 });
    expect(anomaly(r, "Vas Discrepancy")).toBe(true);
  });

  it("catches a BL that does not match Qes", () => {
    const r = checkDriverParameters({ ...dd715f, bl: 20 });
    expect(anomaly(r, "BL Motor Strength")).toBe(true);
  });

  it("names the values nothing here can corroborate", () => {
    const r = checkDriverParameters(dd715f);
    expect(r.unverifiable).toEqual(["Le", "Re", "Xmax", "Pe"]);
  });

  it("omits a value that was not entered from that list", () => {
    const r = checkDriverParameters({ ...dd715f, xmax: 0 });
    expect(r.unverifiable).not.toContain("Xmax");
  });
});
