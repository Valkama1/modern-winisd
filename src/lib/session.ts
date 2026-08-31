import { SavedSession } from "../types";

const SESSION_KEY = "winisd_session_state";

export const loadSavedSession = (): SavedSession | null => {
  try {
    const saved = localStorage.getItem(SESSION_KEY);
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

/**
 * How long the session has to stop changing before it is written.
 *
 * Long enough to cover a drag or a burst of typing, short enough that a crash loses
 * only the last moment of work.
 */
export const AUTOSAVE_DELAY_MS = 800;

let pending: ReturnType<typeof setTimeout> | undefined;

/**
 * Write the session once the caller stops changing it. Returns a cancel function, so
 * an effect can hand back its cleanup and get a trailing debounce for free.
 *
 * The autosave effect listed rulerFreq and graphHeights among its dependencies — the
 * first set on every pointer move, the second on every requestAnimationFrame while a
 * resize handle is held. So a drag serialised the entire projects array (a driver, a
 * custom topology and some forty numeric fields per project) and wrote it to
 * localStorage synchronously on the main thread, around sixty times a second, and
 * typing one character in any sidebar field did it once per character.
 */
export function scheduleSessionSave(session: SavedSession): () => void {
  clearTimeout(pending);
  pending = setTimeout(() => {
    try {
      localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    } catch (e) {
      // A full or unavailable quota must not take the app down with it.
      console.error("Failed to auto-save session state:", e);
    }
  }, AUTOSAVE_DELAY_MS);

  return () => clearTimeout(pending);
}
