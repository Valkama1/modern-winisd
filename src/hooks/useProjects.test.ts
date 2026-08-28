import { describe, it, expect, beforeEach, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useProjects } from "./useProjects";

vi.mock("../context/DriverDatabaseContext", () => ({
  useDriverDatabaseContext: () => ({ openDriverBrowser: vi.fn() }),
}));

vi.mock("../components/ui", () => ({
  useToast: () => ({ success: vi.fn(), error: vi.fn() }),
  useDialog: () => ({ confirmDialog: vi.fn(), promptDialog: vi.fn() }),
}));

describe("useProjects", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("starts with one default project", () => {
    const { result } = renderHook(() => useProjects());
    expect(result.current.projects).toHaveLength(1);
    expect(result.current.activeProject.id).toBe(result.current.projects[0].id);
  });

  it("updateActiveProject merges a partial patch into the active project only", () => {
    const { result } = renderHook(() => useProjects());
    act(() => {
      result.current.updateActiveProject({ name: "Renamed" });
    });
    expect(result.current.activeProject.name).toBe("Renamed");
  });

  it("handleDuplicateProject adds a copy and makes it active", () => {
    const { result } = renderHook(() => useProjects());
    const originalCount = result.current.projects.length;
    act(() => {
      result.current.handleDuplicateProject(result.current.projects[0].id);
    });
    expect(result.current.projects).toHaveLength(originalCount + 1);
    expect(result.current.activeProject.name).toContain("(Copy)");
  });

  it("handleRemoveProject refuses to remove the last project", () => {
    const { result } = renderHook(() => useProjects());
    act(() => {
      result.current.handleRemoveProject(result.current.projects[0].id);
    });
    expect(result.current.projects).toHaveLength(1);
  });

  it("undo restores the previous projects state after updateActiveProject", () => {
    const { result } = renderHook(() => useProjects());
    const originalName = result.current.activeProject.name;
    act(() => {
      result.current.updateActiveProject({ name: "Changed" });
    });
    expect(result.current.activeProject.name).toBe("Changed");
    expect(result.current.canUndo).toBe(true);

    act(() => {
      result.current.undo();
    });
    expect(result.current.activeProject.name).toBe(originalName);
    expect(result.current.canRedo).toBe(true);
  });

  it("redo re-applies an undone change", () => {
    const { result } = renderHook(() => useProjects());
    act(() => {
      result.current.updateActiveProject({ name: "Changed" });
    });
    act(() => {
      result.current.undo();
    });
    act(() => {
      result.current.redo();
    });
    expect(result.current.activeProject.name).toBe("Changed");
  });
});
