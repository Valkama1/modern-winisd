import { Project, SavedSession } from "../types";

export const loadSavedSession = (): SavedSession | null => {
  try {
    const saved = localStorage.getItem("winisd_session_state");
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed && Array.isArray(parsed.projects) && parsed.projects.length > 0) {
        // Older sessions predate the passive crossover fields; fill them in.
        parsed.projects = parsed.projects.map((p: Partial<Project>) => ({
          passiveXoEnabled: false,
          passiveXoType: "lowpass_1st",
          passiveXoInductance: 1.5,
          passiveXoCapacitance: 47.0,
          passiveXoDcr: 0.2,
          ...p
        }));
        return parsed;
      }
    }
  } catch (e) {
    console.error("Failed to load saved session:", e);
  }
  return null;
};
