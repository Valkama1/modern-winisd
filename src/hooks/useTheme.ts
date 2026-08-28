import { useEffect, useMemo, useState } from "react";
import { AppTheme, PRESETS, applyTheme, saveTheme, loadSavedTheme } from "../theme";

export function useTheme() {
  const [currentTheme, setCurrentTheme] = useState<AppTheme>(loadSavedTheme());

  // Apply theme when theme state changes
  useEffect(() => {
    applyTheme(currentTheme);
    saveTheme(currentTheme);
  }, [currentTheme]);

  const handleCustomColorChange = (key: keyof AppTheme, color: string) => {
    setCurrentTheme((prev) => ({
      ...prev,
      name: "Custom",
      [key]: color,
    }));
  };

  const activePresetKey = useMemo(() => {
    const matched = Object.keys(PRESETS).find(
      (key) =>
        PRESETS[key].bgColor === currentTheme.bgColor &&
        PRESETS[key].sidebarColor === currentTheme.sidebarColor &&
        PRESETS[key].textColor === currentTheme.textColor &&
        PRESETS[key].textMutedColor === currentTheme.textMutedColor &&
        PRESETS[key].accentColor === currentTheme.accentColor &&
        PRESETS[key].graphLineColor === currentTheme.graphLineColor &&
        PRESETS[key].graphGridColor === currentTheme.graphGridColor &&
        PRESETS[key].warningColor === currentTheme.warningColor &&
        PRESETS[key].dangerColor === currentTheme.dangerColor
    );
    return matched || "custom";
  }, [currentTheme]);

  return { currentTheme, setCurrentTheme, handleCustomColorChange, activePresetKey };
}
