import { createContext, ReactNode, useContext } from "react";
import { useModals } from "../hooks/useModals";

type ModalsContextValue = ReturnType<typeof useModals>;

const ModalsContext = createContext<ModalsContextValue | null>(null);

export function ModalsProvider({ children }: { children: ReactNode }) {
  const value = useModals();
  return <ModalsContext.Provider value={value}>{children}</ModalsContext.Provider>;
}

export function useModalsContext(): ModalsContextValue {
  const ctx = useContext(ModalsContext);
  if (!ctx) throw new Error("useModalsContext must be used within a ModalsProvider");
  return ctx;
}
