import { describe, it, expect, vi } from "vitest";
import { useState } from "react";
import { render, act } from "@testing-library/react";

const setRulerFreq = vi.fn();

vi.mock("../components/ui", () => ({
  useToast: () => ({ success: vi.fn(), error: vi.fn() }),
  useDialog: () => ({ confirmDialog: vi.fn() }),
}));
// Each of these returns a fresh object every call, exactly as the real hooks do —
// which is the condition the memoisation has to survive.
vi.mock("./ProjectsContext", () => ({
  useProjectsContext: () => ({
    projects: [], activeProjectId: "p0", setActiveProjectId: vi.fn(),
    setProjectsWithHistory: vi.fn(), handleNewProject: vi.fn(),
  }),
}));
vi.mock("./GraphViewportContext", () => ({
  useGraphViewportContext: () => ({
    visibleGraphs: [], setVisibleGraphs: vi.fn(), graphConfigs: {}, setGraphConfigs: vi.fn(),
    graphHeights: {}, setGraphHeights: vi.fn(), overrideXLimits: {}, setOverrideXLimits: vi.fn(),
    globalXMin: 10, setGlobalXMin: vi.fn(), globalXMax: 2000, setGlobalXMax: vi.fn(),
  }),
}));
vi.mock("./SignalProcessingContext", () => ({
  useSignalProcessingContext: () => ({
    filters: [], setFilters: vi.fn(), roomConfig: {}, setRoomConfig: vi.fn(),
    cabinConfig: {}, setCabinConfig: vi.fn(),
  }),
}));
vi.mock("./GraphPointerContext", () => ({
  useRulerFreq: () => null,
  useGraphPointerActions: () => ({ setRulerFreq }),
}));
vi.mock("./UnitsContext", () => ({
  useUnitsContext: () => ({ displayUnits: {}, setDisplayUnits: vi.fn() }),
}));

import { WorkspaceProvider, useWorkspaceContext } from "./WorkspaceContext";

describe("WorkspaceProvider", () => {
  it("hands consumers the same value across an unrelated re-render", () => {
    // The provider passed an inline object literal, so every render of it gave the
    // Sidebar three new function identities and re-rendered it. The provider itself
    // renders whenever any of the four contexts it reads changes — which, before the
    // pointer-context split, included every pointer move.
    const seen: unknown[] = [];
    let bump: () => void = () => {};

    function Consumer() {
      seen.push(useWorkspaceContext());
      return null;
    }
    function Host() {
      const [, setN] = useState(0);
      bump = () => setN((n) => n + 1);
      return (
        <WorkspaceProvider>
          <Consumer />
        </WorkspaceProvider>
      );
    }

    render(<Host />);
    act(() => bump());
    act(() => bump());

    expect(seen.length).toBeGreaterThan(1);
    expect(new Set(seen).size).toBe(1);
  });
});
