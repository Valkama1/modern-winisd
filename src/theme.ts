export interface AppTheme {
  name: string;
  bgColor: string;
  sidebarColor: string;
  textColor: string;
  accentColor: string;
  graphLineColor: string;
  graphGridColor: string;
}

export const PRESETS: Record<string, AppTheme> = {
  slate: {
    name: "Slate Dark",
    bgColor: "#020617",
    sidebarColor: "#0f172a",
    textColor: "#f8fafc",
    accentColor: "#10b981",
    graphLineColor: "#06b6d4",
    graphGridColor: "#1e293b",
  },
  classic: {
    name: "Classic WinISD",
    bgColor: "#d1d5db",
    sidebarColor: "#9ca3af",
    textColor: "#111827",
    accentColor: "#2563eb",
    graphLineColor: "#10b981",
    graphGridColor: "#6b7280",
  },
  cyberpunk: {
    name: "Cyberpunk",
    bgColor: "#0f051d",
    sidebarColor: "#1b0a2f",
    textColor: "#fdf4ff",
    accentColor: "#f43f5e",
    graphLineColor: "#06b6d4",
    graphGridColor: "#3b0764",
  },
  solarized: {
    name: "Solarized Light",
    bgColor: "#fdf6e3",
    sidebarColor: "#eee8d5",
    textColor: "#073642",
    accentColor: "#b58900",
    graphLineColor: "#268bd2",
    graphGridColor: "#d3c7a1",
  },
};

export function applyTheme(theme: AppTheme) {
  const root = document.documentElement;
  root.style.setProperty("--bg-color", theme.bgColor);
  root.style.setProperty("--sidebar-color", theme.sidebarColor);
  root.style.setProperty("--text-color", theme.textColor);
  root.style.setProperty("--accent-color", theme.accentColor);
  root.style.setProperty("--graph-line-color", theme.graphLineColor);
  root.style.setProperty("--graph-grid-color", theme.graphGridColor);
}

export function saveTheme(theme: AppTheme) {
  localStorage.setItem("winisd_custom_theme", JSON.stringify(theme));
}

export function loadSavedTheme(): AppTheme {
  const saved = localStorage.getItem("winisd_custom_theme");
  if (saved) {
    try {
      return JSON.parse(saved);
    } catch (_) {
      // Fallback
    }
  }
  return PRESETS.slate;
}
