import { Dispatch, ReactNode, SetStateAction, createContext, useContext, useMemo, useState } from "react";
import { loadSavedSession } from "../lib/session";

/**
 * Pointer position over the graphs, kept apart from the rest of the viewport state.
 *
 * hoveredFreq updates on every pointer move. While it lived in GraphViewportContext
 * that churn reached every consumer of that context — including useSimulation, whose
 * own context value is rebuilt each render, which in turn re-rendered every graph
 * layer and defeated their memoisation. Isolating it here means a pointer move only
 * reaches the layers that actually draw from it.
 *
 * Three contexts rather than one, because a context subscription is all-or-nothing:
 * while a single value carried both frequencies, reading `rulerFreq` subscribed you to
 * `hoveredFreq` as well. AppShell did exactly that — for the autosave effect, never to
 * render — and so re-rendered the whole application at pointer-event rate, recreating
 * the sidebar, every tab, the dashboard, a panel per visible curve and three modals,
 * which left nothing downstream able to bail out on reference equality.
 *
 * So take only what you need:
 *   useHoveredFreq()          — re-renders on every pointer move
 *   useRulerFreq()            — re-renders only when the ruler is placed or moved
 *   useGraphPointerActions()  — never re-renders; the setters are stable for the
 *                               lifetime of the provider
 */
type PointerActions = {
  setHoveredFreq: Dispatch<SetStateAction<number | null>>;
  setRulerFreq: Dispatch<SetStateAction<number | null>>;
};

/** Frequency under the cursor, or null when the pointer is away. */
const HoveredFreqContext = createContext<number | null>(null);
/** Frequency of the pinned measurement ruler, or null when it is not placed. */
const RulerFreqContext = createContext<number | null>(null);
const PointerActionsContext = createContext<PointerActions | null>(null);

export function GraphPointerProvider({ children }: { children: ReactNode }) {
  const savedSession = useMemo(() => loadSavedSession(), []);
  const [rulerFreq, setRulerFreq] = useState<number | null>(
    () => savedSession?.rulerFreq || null,
  );
  const [hoveredFreq, setHoveredFreq] = useState<number | null>(null);

  // useState setters are stable, so this object is built once and never again — which
  // is what lets a consumer take the setters without subscribing to either value.
  const actions = useMemo(() => ({ setHoveredFreq, setRulerFreq }), []);

  return (
    <PointerActionsContext.Provider value={actions}>
      <RulerFreqContext.Provider value={rulerFreq}>
        <HoveredFreqContext.Provider value={hoveredFreq}>
          {children}
        </HoveredFreqContext.Provider>
      </RulerFreqContext.Provider>
    </PointerActionsContext.Provider>
  );
}

export function useHoveredFreq(): number | null {
  return useContext(HoveredFreqContext);
}

export function useRulerFreq(): number | null {
  return useContext(RulerFreqContext);
}

export function useGraphPointerActions(): PointerActions {
  const ctx = useContext(PointerActionsContext);
  if (!ctx) throw new Error("useGraphPointerActions must be used within a GraphPointerProvider");
  return ctx;
}
