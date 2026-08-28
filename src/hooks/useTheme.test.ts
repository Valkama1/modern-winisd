import { describe, it, expect, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useTheme } from "./useTheme";
import { PRESETS } from "../theme";

describe("useTheme", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("activePresetKey matches the currently-loaded preset exactly", () => {
    const { result } = renderHook(() => useTheme());
    // currentTheme initializes from loadSavedTheme(), which falls back to a known preset
    // when nothing is saved — find which preset key matches result.current.currentTheme.
    const matchedKey = Object.keys(PRESETS).find(
      (key) => PRESETS[key].bgColor === result.current.currentTheme.bgColor
        && PRESETS[key].accentColor === result.current.currentTheme.accentColor
    );
    expect(result.current.activePresetKey).toBe(matchedKey);
  });

  it("activePresetKey becomes 'custom' when a single field diverges from every preset", () => {
    const { result } = renderHook(() => useTheme());
    act(() => {
      result.current.setCurrentTheme({ ...result.current.currentTheme, accentColor: "#123456" });
    });
    expect(result.current.activePresetKey).toBe("custom");
  });

  it("handleCustomColorChange sets activePresetKey to 'custom'", () => {
    const { result } = renderHook(() => useTheme());
    act(() => {
      result.current.handleCustomColorChange("bgColor", "#abcdef");
    });
    expect(result.current.currentTheme.bgColor).toBe("#abcdef");
    expect(result.current.currentTheme.name).toBe("Custom");
    expect(result.current.activePresetKey).toBe("custom");
  });
});
