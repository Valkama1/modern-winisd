import { describe, it, expect } from "vitest";
import {
  filterGainDb, totalFilterGainDb, findLFCrossover, computeRoomCorrection,
  cmsFromVasSd, mmsKgFromFsCms, blFromFsMmsQes, eta0FromFsVasQes,
} from "./calculations";
import type { EqFilter, SimPoint, RoomConfig } from "../types";

describe("filterGainDb", () => {
  it("returns 0 for a disabled filter", () => {
    const flt: EqFilter = { id: "1", enabled: false, type: "peak", freq: 100, q: 1, gain: 6 };
    expect(filterGainDb(flt, 100)).toBe(0);
  });

  it("returns 0 for a non-positive frequency", () => {
    const flt: EqFilter = { id: "1", enabled: true, type: "peak", freq: 100, q: 1, gain: 6 };
    expect(filterGainDb(flt, 0)).toBe(0);
  });

  it("peaks near the target gain at the filter's center frequency for a peak filter", () => {
    const flt: EqFilter = { id: "1", enabled: true, type: "peak", freq: 100, q: 1, gain: 6 };
    expect(filterGainDb(flt, 100)).toBeCloseTo(6, 1);
  });

  it("high-pass filter attenuates well below its corner frequency", () => {
    const flt: EqFilter = { id: "1", enabled: true, type: "hp", freq: 100, q: 0.707, gain: 0 };
    expect(filterGainDb(flt, 10)).toBeLessThan(-30);
  });

  it("low-pass filter attenuates well above its corner frequency", () => {
    const flt: EqFilter = { id: "1", enabled: true, type: "lp", freq: 100, q: 0.707, gain: 0 };
    expect(filterGainDb(flt, 1000)).toBeLessThan(-30);
  });
});

describe("totalFilterGainDb", () => {
  it("sums gain across enabled filters and ignores disabled ones", () => {
    const filters: EqFilter[] = [
      { id: "1", enabled: true,  type: "peak", freq: 100, q: 1, gain: 3 },
      { id: "2", enabled: false, type: "peak", freq: 100, q: 1, gain: 100 },
    ];
    const total = totalFilterGainDb(filters, 100);
    expect(total).toBeCloseTo(3, 1);
  });

  it("returns 0 for an empty filter list", () => {
    expect(totalFilterGainDb([], 100)).toBe(0);
  });
});

describe("findLFCrossover", () => {
  it("finds the frequency where the curve rises through peak - dropDb", () => {
    const pts: SimPoint[] = [
      { frequency: 10, db: 70 },
      { frequency: 20, db: 80 },
      { frequency: 40, db: 90 },
      { frequency: 80, db: 90 },
    ];
    // peak is 90, -3dB target is 87, crossed between 20Hz(80) and 40Hz(90)
    const f3 = findLFCrossover(pts, 3);
    expect(f3).not.toBeNull();
    expect(f3!).toBeGreaterThan(20);
    expect(f3!).toBeLessThan(40);
  });

  it("returns null when the drop is never reached", () => {
    const pts: SimPoint[] = [
      { frequency: 10, db: 90 },
      { frequency: 20, db: 91 },
    ];
    expect(findLFCrossover(pts, 20)).toBeNull();
  });

  it("returns null for fewer than 2 points", () => {
    expect(findLFCrossover([{ frequency: 10, db: 90 }], 3)).toBeNull();
  });
});

describe("computeRoomCorrection", () => {
  const baseRoom: Omit<RoomConfig, "speakers"> = {
    enabled: true,
    length: 5,
    width: 4,
    height: 3,
    listenerX: 2,
    listenerY: 3,
    listenerZ: 1.2,
    absorption: 0.3,
  };

  it("returns an array of zeros matching freqs.length when there are no speakers", () => {
    const cfg: RoomConfig = { ...baseRoom, speakers: [] };
    const result = computeRoomCorrection(cfg, [20, 80, 200, 1000]);
    expect(result).toEqual([0, 0, 0, 0]);
  });

  it("returns finite correction values for a single speaker at a known position", () => {
    const cfg: RoomConfig = { ...baseRoom, speakers: [{ x: 2, y: 1, z: 1 }] };
    const result = computeRoomCorrection(cfg, [20, 80, 200]);
    expect(result).toHaveLength(3);
    for (const v of result) {
      expect(Number.isFinite(v)).toBe(true);
    }
  });

  it("two identical co-located speakers add +20*log10(2) dB versus one speaker (coherent doubling)", () => {
    const lowAbsorptionRoom: Omit<RoomConfig, "speakers"> = { ...baseRoom, absorption: 0.1 };
    const oneSpeaker: RoomConfig = { ...lowAbsorptionRoom, speakers: [{ x: 2, y: 1, z: 1 }] };
    const twoSpeakers: RoomConfig = {
      ...lowAbsorptionRoom,
      speakers: [{ x: 2, y: 1, z: 1 }, { x: 2, y: 1, z: 1 }],
    };
    const freqs = [50];
    const [correction1] = computeRoomCorrection(oneSpeaker, freqs);
    const [correction2] = computeRoomCorrection(twoSpeakers, freqs);
    // Two identical, co-located speakers double the summed pressure amplitude
    // at every image source, which is a coherent +20*log10(2) ≈ +6.02 dB gain.
    expect(correction2 - correction1).toBeCloseTo(20 * Math.log10(2), 5);
  });
});

describe("T/S derivation helpers", () => {
  it("cmsFromVasSd / mmsKgFromFsCms / blFromFsMmsQes round-trip a known driver's Mms and Bl", () => {
    // B&C 21SW115: Fs=33, Qes=0.37, Vas=278L, Sd=1680cm², Re=3.6, actual Mms=335g, Bl=24.8
    const cms = cmsFromVasSd(278, 1680);
    const mmsKg = mmsKgFromFsCms(33, cms);
    const mmsG = mmsKg * 1000;
    expect(mmsG).toBeGreaterThan(250);
    expect(mmsG).toBeLessThan(420);

    const bl = blFromFsMmsQes(33, mmsKg, 3.6, 0.37);
    expect(bl).toBeGreaterThan(15);
    expect(bl).toBeLessThan(35);
  });

  it("eta0FromFsVasQes yields a positive reference efficiency for realistic inputs", () => {
    const eta0 = eta0FromFsVasQes(33, 278, 0.37);
    expect(eta0).toBeGreaterThan(0);
  });
});
