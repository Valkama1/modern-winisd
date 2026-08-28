import { createContext, ReactNode, useContext } from "react";
import { useDriverForm } from "../hooks/useDriverForm";

type DriverFormContextValue = ReturnType<typeof useDriverForm>;

const DriverFormContext = createContext<DriverFormContextValue | null>(null);

export function DriverFormProvider({ children }: { children: ReactNode }) {
  const value = useDriverForm();
  return <DriverFormContext.Provider value={value}>{children}</DriverFormContext.Provider>;
}

export function useDriverFormContext(): DriverFormContextValue {
  const ctx = useContext(DriverFormContext);
  if (!ctx) throw new Error("useDriverFormContext must be used within a DriverFormProvider");
  return ctx;
}
