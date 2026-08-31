import { ReactNode, createContext, useContext, useState } from "react";
import { useUnits } from "../hooks/useUnits";
import { nextUnit } from "../lib/units";

type UnitsContextValue = ReturnType<typeof useUnits>;

const UnitsContext = createContext<UnitsContextValue | null>(null);

export function UnitsProvider({
  children,
  initial,
}: {
  children: ReactNode;
  initial?: Record<string, string>;
}) {
  const value = useUnits(initial);
  return <UnitsContext.Provider value={value}>{children}</UnitsContext.Provider>;
}

export function useUnitsContext(): UnitsContextValue {
  const ctx = useContext(UnitsContext);
  if (!ctx) throw new Error("useUnitsContext must be used within a UnitsProvider");
  return ctx;
}

/**
 * The display unit for one quantity, and a way to cycle it.
 *
 * Falls back to component-local state when there is no provider above. That is not a
 * convenience for tests so much as a statement about the field: a NumberField is a
 * self-contained control that happens to *share* a preference when something is there
 * to share it with. It keeps the 35 test files that render a field in isolation
 * working, and keeps the unit toggle functional in any of them.
 */
export function useDisplayUnit(canonical: string): [string, () => void] {
  const shared = useContext(UnitsContext);
  const [local, setLocal] = useState(canonical);

  if (shared) {
    return [shared.unitFor(canonical), () => shared.cycleUnit(canonical)];
  }
  return [local, () => setLocal((u) => nextUnit(canonical, u))];
}
