/**
 * Keep a frequency-range pair from meeting or crossing.
 *
 * Min and max were each clamped only against their own floor — Math.max(1, …) and
 * Math.max(10, …) — with nothing comparing them. Setting both to 10 gave the axis a
 * zero-width log span, and every curve disappeared with no error to say why.
 * getGraphXLimits holds the same invariant for ranges arriving from a restored
 * session; these two stop it being created in the first place.
 */
export const clampMin = (value: number, max: number) =>
  Math.min(Math.max(1, Math.round(value)), max - 1);

export const clampMax = (value: number, min: number) =>
  Math.max(Math.round(value), min + 1, 10);
