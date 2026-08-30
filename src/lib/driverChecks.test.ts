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

const anomaly = (r: ReturnType<typeof checkDriverParameters>, needle: string) =>
  r.anomalies.some((a) => a.includes(needle));

describe("checkDriverParameters", () => {
  it("passes a self-consistent driver", () => {
    expect(checkDriverParameters(dd715f).anomalies).toEqual([]);
  });

  it("catches a sensitivity that does not follow from Fs, Vas and Qes", () => {
    // 90.7 dB stated against 88.1 implied — the simulation follows the derived figure,
    // so the graphs sit 2.6 dB below what the datasheet promises.
    const r = checkDriverParameters(dayton);
    expect(anomaly(r, "Sensitivity Discrepancy")).toBe(true);
    expect(r.anomalies.join(" ")).toContain("88.1");
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
