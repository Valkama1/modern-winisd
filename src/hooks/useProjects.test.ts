import { describe, it, expect, beforeEach, vi } from "vitest";
import { StrictMode } from "react";
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

  it("coalesces a run of edits to one field into a single undo", () => {
    // updateActiveProject is called once per keystroke, so typing "150" pushed three
    // history entries and the 20-slot stack held about six real edits. Ctrl+Z walked
    // back one character at a time.
    const { result } = renderHook(() => useProjects());
    const originalVb = result.current.activeProject.vBox;

    for (const vBox of [1, 15, 150]) {
      act(() => result.current.updateActiveProject({ vBox }));
    }
    expect(result.current.activeProject.vBox).toBe(150);

    act(() => result.current.undo());
    expect(result.current.activeProject.vBox).toBe(originalVb);
    expect(result.current.canUndo).toBe(false);
  });

  it("starts a new undo entry when the edit moves to another field", () => {
    const { result } = renderHook(() => useProjects());
    const original = result.current.activeProject;

    act(() => result.current.updateActiveProject({ vBox: 200 }));
    act(() => result.current.updateActiveProject({ tuningFreq: 40 }));

    act(() => result.current.undo());
    expect(result.current.activeProject.tuningFreq).toBe(original.tuningFreq);
    expect(result.current.activeProject.vBox).toBe(200);

    act(() => result.current.undo());
    expect(result.current.activeProject.vBox).toBe(original.vBox);
  });

  it("starts a new undo entry after a pause on the same field", () => {
    vi.useFakeTimers();
    try {
      const { result } = renderHook(() => useProjects());
      const originalVb = result.current.activeProject.vBox;

      act(() => result.current.updateActiveProject({ vBox: 200 }));
      act(() => vi.advanceTimersByTime(5000));
      act(() => result.current.updateActiveProject({ vBox: 300 }));

      act(() => result.current.undo());
      expect(result.current.activeProject.vBox).toBe(200);

      act(() => result.current.undo());
      expect(result.current.activeProject.vBox).toBe(originalVb);
    } finally {
      vi.useRealTimers();
    }
  });

  it("does not fold a later edit into an entry that undo already stepped past", () => {
    const { result } = renderHook(() => useProjects());
    const originalVb = result.current.activeProject.vBox;

    act(() => result.current.updateActiveProject({ vBox: 200 }));
    act(() => result.current.undo());
    expect(result.current.activeProject.vBox).toBe(originalVb);

    act(() => result.current.updateActiveProject({ vBox: 300 }));
    act(() => result.current.undo());
    expect(result.current.activeProject.vBox).toBe(originalVb);
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

  it("undoes one edit with one undo, even under StrictMode", () => {
    // StrictMode invokes state updaters twice in development, so these run the hook
    // under it: history bookkeeping lives outside the updater and must stay there.
    const { result } = renderHook(() => useProjects(), { wrapper: StrictMode });
    const originalVb = result.current.activeProject.vBox;

    act(() => result.current.updateActiveProject({ vBox: originalVb + 55 }));
    expect(result.current.activeProject.vBox).toBe(originalVb + 55);
    expect(result.current.canUndo).toBe(true);

    act(() => result.current.undo());
    expect(result.current.activeProject.vBox).toBe(originalVb);
    // One edit means exactly one history entry — no stray no-op undo left behind.
    expect(result.current.canUndo).toBe(false);
  });

  it("redoes what it undid", () => {
    const { result } = renderHook(() => useProjects(), { wrapper: StrictMode });
    const originalVb = result.current.activeProject.vBox;

    act(() => result.current.updateActiveProject({ vBox: 999 }));
    act(() => result.current.undo());
    expect(result.current.activeProject.vBox).toBe(originalVb);

    act(() => result.current.redo());
    expect(result.current.activeProject.vBox).toBe(999);
  });

  it("caps the undo stack rather than growing without bound", () => {
    const { result } = renderHook(() => useProjects(), { wrapper: StrictMode });
    for (let i = 1; i <= 25; i++) {
      act(() => result.current.updateActiveProject({ vBox: i }));
    }
    // 20 entries are kept, so 20 undos are available and the 21st is a no-op.
    for (let i = 0; i < 20; i++) act(() => result.current.undo());
    expect(result.current.canUndo).toBe(false);
  });
});