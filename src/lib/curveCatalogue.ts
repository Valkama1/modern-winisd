import { CURVE_TYPES, CurveType, EnclosureType } from "../types";

/**
 * One name per curve, in one place.
 *
 * The Toolbar's picker and the Settings calibration picker each carried their own
 * hand-written copy of this list, and they had drifted: the Toolbar offered nine
 * curves and Settings seven, so Max SPL and Transfer Function could be displayed but
 * never have their axes configured. Typing this as `Record<CurveType, string>` means a
 * curve added to CURVE_TYPES without a label here is a compile error.
 */
export const CURVE_LABELS: Record<CurveType, string> = {
  transfer: "Gain (dB)",
  transfer_function: "Transfer Function (dB)",
  spl: "SPL (dB SPL)",
  phase: "Phase Response (°)",
  group_delay: "Group Delay (ms)",
  max_spl: "Maximum SPL (dB)",
  excursion: "Cone Excursion (mm peak)",
  velocity: "Port Air Velocity (m/s)",
  impedance: "System Impedance (Ω)",
  pr_excursion: "Radiator Excursion (mm peak)",
};

/**
 * Curves a user can choose to show. pr_excursion is absent because it is not picked
 * on its own — it is drawn onto the excursion graph when the enclosure has a passive
 * radiator, beside the cone's own travel.
 */
export const SELECTABLE_CURVES: CurveType[] = CURVE_TYPES.filter(
  (c) => c !== "pr_excursion",
);

/** Curves that need somewhere for air to move through. */
const PORTED_ONLY: CurveType[] = ["velocity"];

/** What this enclosure can actually show: a sealed box has no vent to measure. */
export function selectableCurvesFor(enclosureType: EnclosureType | string): CurveType[] {
  const hasPort = enclosureType !== "sealed";
  return SELECTABLE_CURVES.filter((c) => hasPort || !PORTED_ONLY.includes(c));
}
