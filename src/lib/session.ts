import { SavedSession } from "../types";

export const loadSavedSession = (): SavedSession | null => {
  try {
    const saved = localStorage.getItem("winisd_session_state");
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed && Array.isArray(parsed.projects) && parsed.projects.length > 0) {
        return parsed;
      }
    }
  } catch (e) {
    console.error("Failed to load saved session:", e);
  }
  return null;
};
