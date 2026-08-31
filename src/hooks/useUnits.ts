import { useCallback, useMemo, useState } from "react";
import { alternativesFor, nextUnit } from "../lib/units";

/** Which unit each quantity is currently shown in, keyed by its canonical symbol. */
export type DisplayUnits = Record<string, string>;

/**
 * The display unit chosen for each quantity.
 *
 * Per quantity rather than per field: toggling any litres field switches every litres
 * field. Per-field would need a stable identity for each of the ~125 call sites, which
 * does not exist and would have to be invented and then persisted — and someone
 * working from imperial plans wants all of them switched anyway.
 *
 * Only selections that differ from canonical are stored, so a session that never
 * touched a unit serialises nothing and older files load with no migration.
 */
export function useUnits(initial?: DisplayUnits) {
  const [displayUnits, setDisplayUnits] = useState<DisplayUnits>(() => sanitise(initial));

  const unitFor = useCallback(
    (canonical: string) => displayUnits[canonical] ?? canonical,
    [displayUnits],
  );

  const cycleUnit = useCallback((canonical: string) => {
    setDisplayUnits((prev) => {
      const next = nextUnit(canonical, prev[canonical] ?? canonical);
      const out = { ...prev };
      // Canonical is the absence of an entry, not an entry saying "canonical".
      if (next === canonical) delete out[canonical];
      else out[canonical] = next;
      return out;
    });
  }, []);

  return useMemo(
    () => ({ displayUnits, unitFor, cycleUnit, setDisplayUnits }),
    [displayUnits, unitFor, cycleUnit],
  );
}

/**
 * Drop anything the current build cannot render.
 *
 * A workspace may name a unit this version never had or has since dropped; falling
 * back to canonical shows the right number in the wrong unit's absence, rather than
 * stranding the field on a symbol with no conversion behind it.
 */
function sanitise(saved?: DisplayUnits): DisplayUnits {
  if (!saved) return {};
  const out: DisplayUnits = {};
  for (const [canonical, symbol] of Object.entries(saved)) {
    const known = alternativesFor(canonical).some((o) => o.symbol === symbol);
    if (known && symbol !== canonical) out[canonical] = symbol;
  }
  return out;
}
