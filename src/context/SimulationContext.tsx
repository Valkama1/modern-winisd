import { createContext, ReactNode, useContext } from "react";
import { useSimulation } from "../hooks/useSimulation";

type SimulationContextValue = ReturnType<typeof useSimulation>;

const SimulationContext = createContext<SimulationContextValue | null>(null);

export function SimulationProvider({ children }: { children: ReactNode }) {
  const value = useSimulation();
  return <SimulationContext.Provider value={value}>{children}</SimulationContext.Provider>;
}

export function useSimulationContext(): SimulationContextValue {
  const ctx = useContext(SimulationContext);
  if (!ctx) throw new Error("useSimulationContext must be used within a SimulationProvider");
  return ctx;
}
