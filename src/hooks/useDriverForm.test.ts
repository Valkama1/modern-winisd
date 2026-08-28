import { describe, it, expect, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useDriverForm } from "./useDriverForm";

vi.mock("../context/DriverDatabaseContext", () => ({
  useDriverDatabaseContext: () => ({
    editingDriverId: null, browserCallback: null,
    setDrivers: vi.fn(), setShowAddForm: vi.fn(), setShowBrowser: vi.fn(),
    setBrowserCallback: vi.fn(), setEditingDriverId: vi.fn(),
  }),
}));

vi.mock("../context/ProjectsContext", () => ({
  useProjectsContext: () => ({ updateActiveProject: vi.fn(), setProjectsWithHistory: vi.fn() }),
}));

vi.mock("../components/ui", () => ({
  useToast: () => ({ success: vi.fn(), error: vi.fn() }),
  useDialog: () => ({ confirmDialog: vi.fn(), promptDialog: vi.fn() }),
}));

describe("useDriverForm", () => {
  it("recomputes Qts from Qes and Qms", () => {
    const { result } = renderHook(() => useDriverForm());
    act(() => {
      result.current.setNewQes("0.4");
      result.current.setNewQms("5.0");
    });
    // Qts = (Qes*Qms)/(Qes+Qms) = (0.4*5.0)/5.4 = 0.3703...
    expect(parseFloat(result.current.newQts)).toBeCloseTo(0.370, 2);
  });

  it("checkDriverConsistency returns null for a driver missing required fields", () => {
    const { result } = renderHook(() => useDriverForm());
    expect(result.current.checkDriverConsistency({ id: "", manufacturer: "", model: "", fs: 0, qts: 0, qes: 0, qms: 0, vas: 0, re: 0, sd: 0, xmax: 0, mms: 0, le: 0, bl: 0, pe: 0, sens: 0 })).toBeNull();
  });

  it("checkDriverConsistency flags a large Vas/Mms/Sd discrepancy as inconsistent", () => {
    const { result } = renderHook(() => useDriverForm());
    // Deliberately inconsistent: fs/mms/sd imply a very different Vas than 278L
    const check = result.current.checkDriverConsistency({
      id: "", manufacturer: "", model: "", fs: 33, qts: 0.36, qes: 0.37, qms: 7.7,
      vas: 278, re: 3.6, sd: 1680, xmax: 14, mms: 50, le: 1.7, bl: 24.8, pe: 1700, sens: 97,
    });
    expect(check).not.toBeNull();
    expect(check!.isInconsistent).toBe(true);
  });

  it("checkDriverConsistency accepts internally-consistent parameters", () => {
    const { result } = renderHook(() => useDriverForm());
    // B&C 21SW115 parameters, known consistent
    const check = result.current.checkDriverConsistency({
      id: "", manufacturer: "", model: "", fs: 33, qts: 0.36, qes: 0.37, qms: 7.7,
      vas: 278, re: 3.6, sd: 1680, xmax: 14, mms: 335, le: 1.7, bl: 24.8, pe: 1700, sens: 97,
    });
    expect(check).not.toBeNull();
    expect(check!.isInconsistent).toBe(false);
  });
});
