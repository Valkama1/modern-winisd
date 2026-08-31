/**
 * Display units for numeric fields.
 *
 * Values are stored, simulated and saved in one canonical unit per quantity — litres,
 * cm², millimetres, grams — and only ever *displayed* in another. Nothing downstream of
 * a field sees anything but the canonical value, which is why toggling a unit cannot
 * change a design.
 *
 * The registry is keyed by the canonical symbol a field already declares through its
 * `unit` prop, so a field opts in by virtue of the quantity it holds rather than by a
 * flag someone has to remember to add. A unit with no entry here is simply not
 * toggleable, and its field behaves exactly as it did before.
 */
export type UnitOption = {
  symbol: string;
  /** How many canonical units make one of these. Exact by definition, not measured. */
  canonicalPer: number;
  /** Decimal places when showing a converted value. */
  decimals: number;
};

/**
 * Every quantity with a second unit worth offering, canonical first.
 *
 * Deliberately short. Hz, watts, ohms, dB, milliseconds and m/s are the same figure
 * everywhere, so offering a toggle on them would be clutter with nothing behind it.
 */
export const UNIT_ALTERNATIVES: Record<string, UnitOption[]> = {
  L: [
    { symbol: "L", canonicalPer: 1, decimals: 2 },
    // A foot is 0.3048 m exactly, so a cubic foot is 28.316846592 L.
    { symbol: "ft³", canonicalPer: 28.316846592, decimals: 3 },
  ],
  "cm²": [
    { symbol: "cm²", canonicalPer: 1, decimals: 1 },
    // An inch is 2.54 cm exactly.
    { symbol: "in²", canonicalPer: 6.4516, decimals: 2 },
  ],
  cm: [
    { symbol: "cm", canonicalPer: 1, decimals: 1 },
    { symbol: "in", canonicalPer: 2.54, decimals: 3 },
  ],
  mm: [
    { symbol: "mm", canonicalPer: 1, decimals: 1 },
    { symbol: "in", canonicalPer: 25.4, decimals: 3 },
  ],
  m: [
    { symbol: "m", canonicalPer: 1, decimals: 2 },
    { symbol: "ft", canonicalPer: 0.3048, decimals: 3 },
  ],
  g: [
    { symbol: "g", canonicalPer: 1, decimals: 1 },
    // An ounce is 28.349523125 g exactly.
    { symbol: "oz", canonicalPer: 28.349523125, decimals: 2 },
  ],
};

/** The units this quantity can be shown in, or none if it has only the one. */
export function alternativesFor(canonical: string): UnitOption[] {
  return UNIT_ALTERNATIVES[canonical] ?? [];
}

/** The chosen option, falling back to the canonical one for anything unrecognised. */
function optionFor(canonical: string, symbol: string): UnitOption {
  const opts = alternativesFor(canonical);
  return (
    opts.find((o) => o.symbol === symbol) ??
    opts[0] ?? { symbol: canonical, canonicalPer: 1, decimals: 2 }
  );
}

/** Canonical value → the number to show in `symbol`. */
export function toDisplay(canonical: string, symbol: string, value: number): number {
  return value / optionFor(canonical, symbol).canonicalPer;
}

/** A number the user typed in `symbol` → the canonical value to store. */
export function toCanonical(canonical: string, symbol: string, value: number): number {
  return value * optionFor(canonical, symbol).canonicalPer;
}

/**
 * The text for the value box.
 *
 * In the canonical unit this is `String(value)` and nothing else — the box has always
 * rendered exactly what it was given, and rounding it now would visibly change every
 * field in the app that nobody ever toggled. Rounding applies only once a value has
 * been converted, where some bound is unavoidable.
 */
export function formatInUnit(canonical: string, symbol: string, value: number): string {
  if (symbol === canonical) return String(value);
  const opt = optionFor(canonical, symbol);
  return String(Number(toDisplay(canonical, symbol, value).toFixed(opt.decimals)));
}

/** The next unit in the cycle, or the same one when there is nothing to cycle to. */
export function nextUnit(canonical: string, symbol: string): string {
  const opts = alternativesFor(canonical);
  if (opts.length < 2) return canonical;
  const i = opts.findIndex((o) => o.symbol === symbol);
  // An unrecognised symbol — a workspace saved with a unit since dropped — restarts
  // the cycle rather than stranding the field on something it cannot show.
  return opts[i === -1 ? 0 : (i + 1) % opts.length].symbol;
}
