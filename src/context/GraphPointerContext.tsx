import { Dispatch, ReactNode, SetStateAction, createContext, useContext, useMemo, useState } from "react";
import { loadSavedSession } from "../lib/session";

/**
 * Pointer position over the graphs, kept apart from the rest of the viewport state.
 *
 * hoveredFreq updates on every pointer move. While it lived in GraphViewportContext
 * that churn reached every consumer of that context — including useSimulation, whose
 * own context value is rebuilt each render, which in turn re-rendered every graph
 * layer and defeated their memoisation. Isolating it here means a pointer move only
 * reaches the two layers that actually draw from it.
 */
type GraphPointerValue = {
  /** Frequency under the cursor, or null when the pointer is away. */
  hoveredFreq: number | null;
  setHoveredFreq: Dispatch<SetStateAction<number | null>>;
  /** Frequency of the pinned measurement ruler, or null when it is not placed. */
  rulerFreq: number | null;
  setRulerFreq: Dispatch<SetStateAction<number | null>>;
};

const GraphPointerContext = createContext<GraphPointerValue | null>(null);

export function GraphPointerProvider({ children }: { children: ReactNode }) {
  const savedSession = useMemo(() => loadSavedSession(), []);
  const [rulerFreq, setRulerFreq] = useState<number | null>(
    () => savedSession?.rulerFreq || null,
  );
  const [hoveredFreq, setHoveredFreq] = useState<number | null>(null);

  const value = useMemo(
    () => ({ hoveredFreq, setHoveredFreq, rulerFreq, setRulerFreq }),
    [hoveredFreq, rulerFreq],
  );

  return (
    <GraphPointerContext.Provider value={value}>{children}</GraphPointerContext.Provider>
  );
}

export function useGraphPointerContext(): GraphPointerValue {
  const ctx = useContext(GraphPointerContext);
  if (!ctx) throw new Error("useGraphPointerContext must be used within a GraphPointerProvider");
  return ctx;
}
