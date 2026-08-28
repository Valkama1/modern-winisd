export interface AppTheme {
  name: string;
  bgColor: string;
  sidebarColor: string;
  textColor: string;
  textMutedColor: string;
  accentColor: string;
  graphLineColor: string;
  graphGridColor: string;
  warningColor: string;
  dangerColor: string;
}

export const PRESETS: Record<string, AppTheme> = {
  slate: {
    name: "Slate Dark",
    bgColor: "#020617",
    sidebarColor: "#0f172a",
    textColor: "#f8fafc",
    textMutedColor: "#94a3b8",
    accentColor: "#10b981",
    graphLineColor: "#06b6d4",
    graphGridColor: "#1e293b",
    warningColor: "#f59e0b",
    dangerColor: "#f87171",
  },
  classic: {
    name: "Classic WinISD",
    bgColor: "#d1d5db",
    sidebarColor: "#9ca3af",
    textColor: "#111827",
    textMutedColor: "#374151",
    accentColor: "#2563eb",
    graphLineColor: "#10b981",
    graphGridColor: "#6b7280",
    warningColor: "#b45309",
    dangerColor: "#b91c1c",
  },
  cyberpunk: {
    name: "Cyberpunk",
    bgColor: "#0f051d",
    sidebarColor: "#1b0a2f",
    textColor: "#fdf4ff",
    textMutedColor: "#c4b5fd",
    accentColor: "#f43f5e",
    graphLineColor: "#06b6d4",
    graphGridColor: "#5b21b6",
    warningColor: "#fbbf24",
    dangerColor: "#f87171",
  },
  solarized: {
    name: "Solarized Light",
    bgColor: "#fdf6e3",
    sidebarColor: "#eee8d5",
    textColor: "#073642",
    textMutedColor: "#586e75",
    accentColor: "#b58900",
    graphLineColor: "#268bd2",
    graphGridColor: "#93a1a1",
    warningColor: "#cb4b16",
    dangerColor: "#dc322f",
  },
};

function relativeLuminance(hex: string): number {
  const c = hex.replace("#", "");
  const r = parseInt(c.substring(0, 2), 16) / 255;
  const g = parseInt(c.substring(2, 4), 16) / 255;
  const b = parseInt(c.substring(4, 6), 16) / 255;
  const lin = (v: number) => (v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4));
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

export function applyTheme(theme: AppTheme) {
  const root = document.documentElement;
  root.style.setProperty("--bg-color", theme.bgColor);
  root.style.setProperty("--sidebar-color", theme.sidebarColor);
  root.style.setProperty("--text-color", theme.textColor);
  root.style.setProperty("--text-muted-color", theme.textMutedColor);
  root.style.setProperty("--accent-color", theme.accentColor);
  root.style.setProperty("--graph-line-color", theme.graphLineColor);
  root.style.setProperty("--graph-grid-color", theme.graphGridColor);
  root.style.setProperty("--warning-color", theme.warningColor);
  root.style.setProperty("--danger-color", theme.dangerColor);
  root.style.setProperty("--color-scheme", relativeLuminance(theme.bgColor) > 0.5 ? "light" : "dark");
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
