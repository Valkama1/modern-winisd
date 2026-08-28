import { useMemo, useState } from "react";
import { useSectionState } from "../components/ui";
import { loadSavedSession } from "../lib/session";

export function useModals() {
  const savedSession = useMemo(() => loadSavedSession(), []);

  // Sidebar active tab selection
  const [sidebarTab, setSidebarTab] = useState<"driver" | "enclosure" | "signal">(() => {
    return savedSession?.sidebarTab || "enclosure";
  });

  // Persisted open/closed state for collapsible sidebar sections
  const [sidebarSectionState, , toggleSidebarSection] = useSectionState(
    savedSession?.sidebarSectionState ?? {
      "enclosure-settings": true,
      "auto-align": false,
      "custom-topology-rear": true,
      "custom-topology-cross-connect": false,
      "custom-topology-front": true,
      "dimension-calculator": false,
      "spl-settings": true,
      "eq-filters": true,
      "passive-crossover": false,
      "cabin-gain": false,
      "room-simulation": false,
      "precise-xyz-inputs": false,
      "system-stats": true,
    }
  );

  const [showSettings, setShowSettings] = useState(false);

  return { showSettings, setShowSettings, sidebarTab, setSidebarTab, sidebarSectionState, toggleSidebarSection };
}
