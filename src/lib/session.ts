export const loadSavedSession = () => {
  try {
    const saved = localStorage.getItem("winisd_session_state");
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed && Array.isArray(parsed.projects) && parsed.projects.length > 0) {
        parsed.projects = parsed.projects.map((p: any) => ({
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
