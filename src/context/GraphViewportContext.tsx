import { createContext, ReactNode, useContext } from "react";
import { useGraphViewport } from "../hooks/useGraphViewport";

type GraphViewportContextValue = ReturnType<typeof useGraphViewport>;

const GraphViewportContext = createContext<GraphViewportContextValue | null>(null);

export function GraphViewportProvider({ children }: { children: ReactNode }) {
  const value = useGraphViewport();
  return <GraphViewportContext.Provider value={value}>{children}</GraphViewportContext.Provider>;
}

export function useGraphViewportContext(): GraphViewportContextValue {
  const ctx = useContext(GraphViewportContext);
  if (!ctx) throw new Error("useGraphViewportContext must be used within a GraphViewportProvider");
  return ctx;
}
