import { createContext, ReactNode, useContext } from "react";
import { useDriverDatabase } from "../hooks/useDriverDatabase";

type DriverDatabaseContextValue = ReturnType<typeof useDriverDatabase>;

const DriverDatabaseContext = createContext<DriverDatabaseContextValue | null>(null);

export function DriverDatabaseProvider({ children }: { children: ReactNode }) {
  const value = useDriverDatabase();
  return <DriverDatabaseContext.Provider value={value}>{children}</DriverDatabaseContext.Provider>;
}

export function useDriverDatabaseContext(): DriverDatabaseContextValue {
  const ctx = useContext(DriverDatabaseContext);
  if (!ctx) throw new Error("useDriverDatabaseContext must be used within a DriverDatabaseProvider");
  return ctx;
}
