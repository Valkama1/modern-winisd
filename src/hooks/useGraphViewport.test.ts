import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useGraphViewport } from "./useGraphViewport";

vi.mock("../context/ModalsContext", () => ({
  useModalsContext: () => ({ showSettings: false }),
}));

describe("useGraphViewport", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("defaults visibleGraphs to transfer + spl", () => {
    const { result } = renderHook(() => useGraphViewport());
    expect(result.current.visibleGraphs).toEqual(["transfer", "spl"]);
  });

  it("getGraphXLimits returns global limits when override is off", () => {
    const { result } = renderHook(() => useGraphViewport());
    const limits = result.current.getGraphXLimits("transfer");
    expect(limits.xMin).toBe(result.current.globalXMin);
    expect(limits.xMax).toBe(result.current.globalXMax);
  });

  it("getGraphXLimits returns per-curve limits when override is on", () => {
    const { result } = renderHook(() => useGraphViewport());
    act(() => {
      result.current.setOverrideXLimits(prev => ({ ...prev, transfer: true }));
      result.current.updateViewportConfig("transfer", "xMin", 40);
    });
    const limits = result.current.getGraphXLimits("transfer");
    expect(limits.xMin).toBe(40);
  });

  it("updateViewportConfig only mutates the targeted curve's config", () => {
    const { result } = renderHook(() => useGraphViewport());
    const splBefore = result.current.graphConfigs.spl;
    act(() => {
      result.current.updateViewportConfig("transfer", "yMax", 20);
    });
    expect(result.current.graphConfigs.transfer.yMax).toBe(20);
    expect(result.current.graphConfigs.spl).toEqual(splBefore);
  });
});
