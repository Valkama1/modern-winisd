import { describe, it, expect, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useSignalProcessing } from "./useSignalProcessing";

describe("useSignalProcessing", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("defaults filters to an empty array with no saved session", () => {
    const { result } = renderHook(() => useSignalProcessing());
    expect(result.current.filters).toEqual([]);
  });

  it("adding a filter via setFilters appends to the array", () => {
    const { result } = renderHook(() => useSignalProcessing());
    act(() => {
      result.current.setFilters(prev => [...prev, { id: "f-1", enabled: true, type: "hp", freq: 80, q: 0.707, gain: 0 }]);
    });
    expect(result.current.filters).toHaveLength(1);
    expect(result.current.filters[0].id).toBe("f-1");
  });

  it("roomConfig defaults to disabled with one speaker", () => {
    const { result } = renderHook(() => useSignalProcessing());
    expect(result.current.roomConfig.enabled).toBe(false);
    expect(result.current.roomConfig.speakers).toHaveLength(1);
  });

  it("cabinConfig defaults to disabled at 60Hz", () => {
    const { result } = renderHook(() => useSignalProcessing());
    expect(result.current.cabinConfig.enabled).toBe(false);
    expect(result.current.cabinConfig.fCabin).toBe(60.0);
  });

  it("setCabinConfig updates fCabin", () => {
    const { result } = renderHook(() => useSignalProcessing());
    act(() => {
      result.current.setCabinConfig(prev => ({ ...prev, fCabin: 80 }));
    });
    expect(result.current.cabinConfig.fCabin).toBe(80);
  });
});
