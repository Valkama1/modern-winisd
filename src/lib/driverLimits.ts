import { SimPoint } from "../types";
import { SPEED_OF_SOUND } from "./calculations";

/**
 * Output limits derived from a simulated response — shared by the statistics panel and
 * the excursion graph's Xmax annotation, which previously each carried their own copy
 * of these formulas.
 */

/**
 * Representative passband level, in dB.
 *
 * The median of the upper 40 % of the sweep: high enough to be clear of the rolloff,
 * and a median rather than a mean so a single resonance cannot drag it.
 * Returns null when there are too few points to be meaningful.
 */
export function passbandLevelDb(splPts: SimPoint[]): number | null {
  if (splPts.length < 10) return null;
  const top = splPts
    .slice(Math.floor(splPts.length * 0.6))
    .map((p) => p.db)
    .sort((a, b) => a - b);
  return top[Math.floor(top.length / 2)];
}

export type XmaxHeadroom = {
  /** Highest excursion anywhere in the sweep, in mm peak. */
  peakExcursionMm: number;
  /** Input power at which that peak would just reach Xmax, in W. */
  powerAtXmax: number;
  /** Passband SPL at that power, in dB. Null when SPL data was unavailable. */
  splAtXmax: number | null;
  /** True when the driver is already past Xmax at the current input power. */
  exceeded: boolean;
};

/**
 * How much power the driver takes before its peak excursion reaches Xmax.
 *
 * Excursion scales with voltage and power with voltage squared, so the ratio is
 * quadratic. Returns null when there is nothing to measure.
 */
export function xmaxHeadroom(
  xmaxMm: number,
  inputPowerW: number,
  excursionPts: SimPoint[],
  splPts: SimPoint[],
): XmaxHeadroom | null {
  if (xmaxMm <= 0 || excursionPts.length < 2) return null;

  const peakExcursionMm = Math.max(...excursionPts.map((p) => p.db));
  if (peakExcursionMm <= 0) return null;

  const pIn = Math.max(1e-6, inputPowerW);
  const powerAtXmax = pIn * Math.pow(xmaxMm / peakExcursionMm, 2);

  const passband = passbandLevelDb(splPts);
  const splAtXmax =
    passband === null ? null : passband + 10 * Math.log10(Math.max(1e-12, powerAtXmax / pIn));

  return {
    peakExcursionMm,
    powerAtXmax,
    splAtXmax,
    exceeded: peakExcursionMm >= xmaxMm,
  };
}

/** Power figures span a wide range; sub-watt values need a second decimal. */
export function formatWatts(w: number): string {
  return w < 1 ? w.toFixed(2) : w.toFixed(1);
}

/**
 * Frequency at which ka = 0.5 for a piston of area `sdCm2`, in Hz.
 *
 * The low-frequency piston radiation model the solver uses starts losing accuracy
 * above this, so the SPL and gain graphs warn past it.
 */
export function pistonModelLimitHz(sdCm2: number): number {
  const radiusM = Math.sqrt((sdCm2 * 1e-4) / Math.PI);
  return Math.round((0.5 * SPEED_OF_SOUND) / (2 * Math.PI * radiusM));
}
