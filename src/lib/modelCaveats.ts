import { CurveType, Project } from "../types";
import { RADIATION_DERIVED } from "../components/dashboard/graph/graphGeometry";
import { effectiveVasLitres } from "./calculations";

export type CaveatTier = "derived" | "warning";

export type Caveat = {
  /** Stable across renders and versions — React keys and test assertions use it. */
  id: string;
  tier: CaveatTier;
  /** Short label for the popover list. */
  title: string;
  /** One sentence: what was assumed, and what it does to the curve. */
  detail: string;
  /** Curves this affects. Omitted means every curve. */
  curves?: CurveType[];
  /** Only relevant above this frequency; dropped when the band ends below it. */
  aboveHz?: number;
};

/** Past this disagreement the stored Vas and the simulated one are a real difference. */
const VAS_DISAGREEMENT = 0.1;

/**
 * What the solver had to assume, and what that costs.
 *
 * Two tiers, because "assumed" is two different things. A *derived* value comes out of
 * an exact Thiele/Small identity — the curve is no less correct for it. A *warning*
 * means a number was invented, and the curve is only as good as the guess. Reporting
 * both the same way would teach people to dismiss the indicator, which costs more than
 * saying nothing at all.
 *
 * Pure, and deliberately so: everything `solve_circuit` substitutes is determinable
 * from the `Driver` alone, so this needs no round trip and cannot fall out of step with
 * a solve in flight.
 */
export function modelCaveats(project: Project, kaLimitHz: number): Caveat[] {
  const d = project.driver;
  const out: Caveat[] = [];

  if (!(d.le > 0)) {
    out.push({
      id: "le-assumed",
      tier: "warning",
      title: "Voice coil inductance assumed",
      detail:
        `Le is not set, so the solver uses Re × 0.15 mH (${(d.re * 0.15).toFixed(2)} mH). ` +
        "Le alone governs how fast output falls above the passband, so the response " +
        "stays flat far higher than a real driver does.",
    });
  }

  if (!(d.re > 0)) {
    out.push({
      id: "re-assumed",
      tier: "warning",
      title: "Voice coil resistance assumed",
      detail:
        "Re is not set, so the solver uses 4 Ω. Drive voltage comes from Re, so every " +
        "absolute level on this graph is a guess.",
      curves: ["spl", "max_spl", "excursion", "impedance"],
    });
  }

  if (!(d.qms > 0)) {
    out.push({
      id: "qms-missing",
      tier: "warning",
      title: "Mechanical Q missing",
      detail:
        "Qms is not set, and the solver divides by it to get mechanical resistance. " +
        "The curve is not meaningful until it is supplied.",
    });
  }

  if (!(d.mms > 0)) {
    const derivable = d.vas > 0 && d.sd > 0 && d.fs > 0;
    out.push(
      derivable
        ? {
            id: "mms-derived",
            tier: "derived",
            title: "Moving mass derived",
            detail:
              "Mms is not set, so it is computed from Fs, Sd and Vas. That is an exact " +
              "identity, not an estimate — the curve is unaffected.",
          }
        : {
            id: "mms-placeholder",
            tier: "warning",
            title: "Moving mass assumed",
            detail:
              "Mms is not set and there is no Vas or Sd to derive it from, so the solver " +
              "uses a flat 100 g. Resonance and excursion follow directly from it.",
          },
    );
  }

  if (!(d.bl > 0)) {
    const derivable = d.qes > 0 && d.fs > 0;
    out.push(
      derivable
        ? {
            id: "bl-derived",
            tier: "derived",
            title: "Motor strength derived",
            detail:
              "Bl is not set, so it is computed from Qes, moving mass and Re. That is an " +
              "exact identity, not an estimate — the curve is unaffected.",
          }
        : {
            id: "bl-placeholder",
            tier: "warning",
            title: "Motor strength assumed",
            detail:
              "Bl is not set and there is no Qes to derive it from, so the solver uses a " +
              "flat 10 T·m. Damping and sensitivity both follow from it.",
          },
    );
  }

  // The stored Vas is not what gets simulated when Mms is present, and past a real
  // disagreement that is worth saying out loud.
  if (d.mms > 0 && d.vas > 0) {
    const derived = effectiveVasLitres(d, project.driverConfig);
    if (Math.abs(derived - d.vas) / d.vas > VAS_DISAGREEMENT) {
      out.push({
        id: "vas-not-used",
        tier: "derived",
        title: "Stored Vas is not the one simulated",
        detail:
          `Compliance comes from Fs and Mms, which imply ${derived.toFixed(1)} L rather ` +
          `than the ${d.vas} L on file. The graph follows the derived figure.`,
      });
    }
  }

  out.push({
    id: "radiation-model",
    tier: "warning",
    title: "Radiation model beyond its range",
    detail:
      `Above about ${kaLimitHz} Hz this cone is no longer a simple piston (ka = 0.5): it ` +
      "beams and it breaks up, and the solver models neither. The curve carries on flat " +
      "or rising where a real driver would be falling away.",
    curves: RADIATION_DERIVED,
    aboveHz: kaLimitHz,
  });

  if (project.enclosureType === "passive_radiator") {
    const prCurves: CurveType[] = ["spl", "max_spl", "transfer", "pr_excursion", "excursion"];
    if (!(project.prMms > 0)) {
      out.push({
        id: "pr-mms-assumed",
        tier: "warning",
        title: "Radiator mass assumed",
        detail:
          "The passive radiator has no moving mass set, so the solver uses 200 g. " +
          "Radiator mass is what sets the tuning.",
        curves: prCurves,
      });
    }
    if (!(project.prQms > 0)) {
      out.push({
        id: "pr-qms-assumed",
        tier: "warning",
        title: "Radiator Q assumed",
        detail:
          "The passive radiator has no Qms set, so the solver uses 5.0, which decides how " +
          "sharply it resonates.",
        curves: prCurves,
      });
    }
  }

  return out;
}

/** The caveats that apply to one curve over one frequency span. */
export function caveatsFor(all: Caveat[], mode: CurveType, fMax: number): Caveat[] {
  return all.filter((c) => {
    if (c.curves && !c.curves.includes(mode)) return false;
    // Nothing to warn about when the untrustworthy region is off the right-hand edge.
    if (c.aboveHz !== undefined && c.aboveHz >= fMax) return false;
    return true;
  });
}

/** The tier the glyph should take: a single warning outranks any number of derived notes. */
export function worstTier(caveats: Caveat[]): CaveatTier | null {
  if (caveats.length === 0) return null;
  return caveats.some((c) => c.tier === "warning") ? "warning" : "derived";
}
