import { describe, it, expect } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useUnits } from "./useUnits";

describe("useUnits", () => {
  it("starts every quantity in its canonical unit", () => {
    const { result } = renderHook(() => useUnits());
    expect(result.current.unitFor("L")).toBe("L");
    expect(result.current.unitFor("mm")).toBe("mm");
    expect(result.current.unitFor("Hz")).toBe("Hz");
  });

  it("cycles a quantity, not a single field", () => {
    // The preference is per quantity: switching one litres field switches every
    // litres field. Per-field would need a stable identity for each of the ~125
    // call sites, and someone working in imperial wants all of them anyway.
    const { result } = renderHook(() => useUnits());
    act(() => result.current.cycleUnit("L"));
    expect(result.current.unitFor("L")).toBe("ft³");
    // A different quantity is untouched.
    expect(result.current.unitFor("mm")).toBe("mm");
  });

  it("cycles back round", () => {
    const { result } = renderHook(() => useUnits());
    act(() => result.current.cycleUnit("L"));
    act(() => result.current.cycleUnit("L"));
    expect(result.current.unitFor("L")).toBe("L");
  });

  it("stores only what differs from canonical, so a default session carries nothing", () => {
    const { result } = renderHook(() => useUnits());
    expect(result.current.displayUnits).toEqual({});
    act(() => result.current.cycleUnit("L"));
    expect(result.current.displayUnits).toEqual({ L: "ft³" });
    act(() => result.current.cycleUnit("L"));
    expect(result.current.displayUnits).toEqual({});
  });

  it("restores a saved selection", () => {
    const { result } = renderHook(() => useUnits({ L: "ft³", mm: "in" }));
    expect(result.current.unitFor("L")).toBe("ft³");
    expect(result.current.unitFor("mm")).toBe("in");
  });

  it("ignores a saved unit the current version no longer offers", () => {
    // A workspace written by a later build, or one whose unit was dropped.
    const { result } = renderHook(() => useUnits({ L: "gallons", Hz: "kHz" }));
    expect(result.current.unitFor("L")).toBe("L");
    expect(result.current.unitFor("Hz")).toBe("Hz");
  });
});
