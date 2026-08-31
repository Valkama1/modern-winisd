import { CurveType } from "../../../types";

export const PADDING = { left: 55, right: 20, top: 45, bottom: 40 } as const;

/** Everything the chart's subcomponents need to place something on the canvas. */
export type GraphGeometry = {
  mode: CurveType;
  width: number;
  height: number;
  chartWidth: number;
  chartHeight: number;
  fMin: number;
  fMax: number;
  dbMin: number;
  dbMax: number;
  /** Frequency (Hz) → x pixel. Logarithmic. */
  getX: (freq: number) => number;
  /** Value → y pixel, clamped to the visible range. */
  getY: (db: number) => number;
  xGridFreqs: number[];
  yGridDbs: number[];
  unit: string;
  title: string;
};

export function axisTitle(mode: CurveType): string {
  return mode === "transfer_function" ? "Transfer Function (dB)"
       : mode === "transfer"    ? "Relative Gain (dB)"
       : mode === "spl"         ? "Sound Pressure Level (SPL)"
       : mode === "phase"       ? "Phase Response (°)"
       : mode === "group_delay" ? "Group Delay (ms)"
       : mode === "max_spl"     ? "Maximum SPL (Xmax / power limited)"
       : mode === "excursion"   ? "Cone Excursion (mm peak)"
       : mode === "velocity"    ? "Port Air Velocity (m/s)"
       :                          "System Electrical Impedance (Ω)";
}

export function axisUnit(mode: CurveType): string {
  return mode === "phase"       ? "°"
       : mode === "group_delay" ? "ms"
       : mode === "excursion"   ? "mm"
       : mode === "velocity"    ? "m/s"
       : mode === "impedance"   ? "Ω"
       : mode === "spl" || mode === "max_spl" ? "dB SPL"
       :                          "dB";
}

/** Decade-ish ticks inside the visible span, with the span's own edges pinned on. */
export function xTicks(fMin: number, fMax: number): number[] {
  const ticks = [
    10, 20, 30, 40, 50, 70, 100, 200, 300, 400, 500, 700, 1000, 1500, 2000, 3000, 5000, 10000,
  ];
  const filtered = ticks.filter((t) => t >= fMin && t <= fMax);
  if (!filtered.includes(fMin)) filtered.unshift(fMin);
  if (!filtered.includes(fMax)) filtered.push(fMax);
  return Array.from(new Set(filtered)).sort((a, b) => a - b);
}

/** Horizontal gridlines, stepped so a tall range does not turn into a hundred lines. */
export function yTicks(dbMin: number, dbMax: number): number[] {
  const range = dbMax - dbMin;
  const step = range <= 10 ? 1 : range <= 25 ? 5 : range <= 50 ? 10 : range <= 150 ? 20 : 50;
  const grids: number[] = [];
  for (let db = dbMax; db >= dbMin; db -= step) grids.push(db);
  return grids;
}

/**
 * Clamp an observed data range to something sensible for the curve being drawn, then
 * round outward to a multiple of 5. Each curve has a floor and ceiling beyond which
 * autoscaling stops being informative — impedance spikes and excursion below tuning
 * would otherwise flatten everything else against the axis.
 */
export function clampYRange(
  mode: CurveType,
  minVal: number,
  maxVal: number,
): { dbMin: number; dbMax: number } {
  // Max SPL shares the SPL axis conventions.
  const isSpl = mode === "spl" || mode === "max_spl";
  const isPhase = mode === "phase";
  const isGD = mode === "group_delay";

  const floor =
    isSpl ? 20
    : mode === "excursion" || mode === "velocity" || mode === "impedance" || isGD ? 0
    : isPhase ? -540
    : -100;

  const ceiling =
    mode === "excursion" ? 100
    : mode === "velocity" ? 200
    : mode === "impedance" ? 1000
    : isSpl ? 200
    : isGD ? 500
    : isPhase ? 90
    : 30;

  const dbMin = Math.floor(Math.max(floor, minVal) / 5) * 5;
  const dbMax = Math.max(Math.ceil(Math.min(ceiling, maxVal) / 5) * 5, dbMin + 5);
  return { dbMin, dbMax };
}

/** Frequency ↔ pixel mappings for a given canvas and visible range. */
export function makeScales(
  chartWidth: number,
  chartHeight: number,
  fMin: number,
  fMax: number,
  dbMin: number,
  dbMax: number,
) {
  const logMin = Math.log10(fMin);
  const logMax = Math.log10(fMax);

  const getX = (freq: number) =>
    PADDING.left + ((Math.log10(freq) - logMin) / (logMax - logMin)) * chartWidth;

  const getY = (db: number) => {
    const clamped = Math.max(dbMin, Math.min(dbMax, db));
    return PADDING.top + (1 - (clamped - dbMin) / (dbMax - dbMin)) * chartHeight;
  };

  /** Inverse of getX — used to turn a pointer position back into a frequency. */
  const freqAtX = (x: number) =>
    Math.pow(10, logMin + ((x - PADDING.left) / chartWidth) * (logMax - logMin));

  return { getX, getY, freqAtX };
}
