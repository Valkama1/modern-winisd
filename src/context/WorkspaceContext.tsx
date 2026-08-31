import { ReactNode, createContext, useCallback, useContext, useEffect, useMemo, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { open as openDialogFile, save as saveDialogFile } from "@tauri-apps/plugin-dialog";
import { useToast, useDialog } from "../components/ui";
import { useProjectsContext } from "./ProjectsContext";
import { useGraphViewportContext } from "./GraphViewportContext";
import { useSignalProcessingContext } from "./SignalProcessingContext";
import { useGraphPointerActions, useRulerFreq } from "./GraphPointerContext";
import { useUnitsContext } from "./UnitsContext";
import {
  WORKSPACE_EXTENSION,
  deserializeWorkspace,
  serializeWorkspace,
} from "../lib/workspace";

/**
 * Workspace-level actions: the whole bench rather than a single design.
 *
 * A project (.wproj) is one driver in one enclosure. A workspace (.wsp) is every
 * project being compared, how the graphs are framed, and the signal chain applied
 * across them. Saving a project used to be the only option, which silently dropped
 * every other curve on the dashboard.
 */
type WorkspaceValue = {
  newWorkspace: () => Promise<void>;
  openWorkspace: () => Promise<void>;
  saveWorkspace: () => Promise<void>;
};

const WorkspaceContext = createContext<WorkspaceValue | null>(null);

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const toast = useToast();
  const { confirmDialog } = useDialog();
  const { projects, activeProjectId, setActiveProjectId, setProjectsWithHistory, handleNewProject } =
    useProjectsContext();
  const {
    visibleGraphs, setVisibleGraphs, graphConfigs, setGraphConfigs,
    graphHeights, setGraphHeights, overrideXLimits, setOverrideXLimits,
    globalXMin, setGlobalXMin, globalXMax, setGlobalXMax,
  } = useGraphViewportContext();
  const { filters, setFilters, roomConfig, setRoomConfig, cabinConfig, setCabinConfig } =
    useSignalProcessingContext();
  const rulerFreq = useRulerFreq();
  const { setRulerFreq } = useGraphPointerActions();
  const { displayUnits, setDisplayUnits } = useUnitsContext();

  const snapshot = () => ({
    projects, activeProjectId, visibleGraphs, graphConfigs, graphHeights,
    overrideXLimits, globalXMin, globalXMax, filters, roomConfig, cabinConfig, rulerFreq,
    displayUnits,
  });

  /**
   * Everything the three handlers need, behind a ref.
   *
   * They run on a click, never during render, so they have no reason to close over
   * this render's values — and closing over them was what forced a new function
   * identity per render and, with the inline object literal below, handed the Sidebar
   * three new callbacks every time any of the four contexts above changed. Reading
   * through a ref instead lets all three be created once, so the context value is
   * stable for the life of the provider.
   *
   * Written in an effect rather than during render: a ref assigned while rendering is
   * a tear under concurrent React, and a click is always after a paint.
   */
  const live = {
    snapshot, toast, confirmDialog, projects, handleNewProject,
    apply: (w: Omit<import("../lib/workspace").WorkspaceFile, "version">) => {
      setProjectsWithHistory(w.projects);
      setActiveProjectId(w.activeProjectId);
      setVisibleGraphs(w.visibleGraphs);
      setGraphConfigs(w.graphConfigs);
      setGraphHeights(w.graphHeights);
      setOverrideXLimits(w.overrideXLimits);
      setGlobalXMin(w.globalXMin);
      setGlobalXMax(w.globalXMax);
      setFilters(w.filters);
      setRoomConfig(w.roomConfig);
      setCabinConfig(w.cabinConfig);
      setRulerFreq(w.rulerFreq);
      setDisplayUnits(w.displayUnits ?? {});
    },
  };
  const liveRef = useRef(live);
  useEffect(() => {
    liveRef.current = live;
  });

  const saveWorkspace = useCallback(async () => {
    const { snapshot, toast, projects } = liveRef.current;
    try {
      const path = await saveDialogFile({
        filters: [{ name: "WinISD Workspace", extensions: [WORKSPACE_EXTENSION] }],
        defaultPath: `workspace.${WORKSPACE_EXTENSION}`,
      });
      if (!path) return;
      await invoke("write_text_file", { path, content: serializeWorkspace(snapshot()) });
      toast.success(`Workspace saved — ${projects.length} project${projects.length === 1 ? "" : "s"}.`);
    } catch (err) {
      console.error("Failed to save workspace:", err);
      toast.error("Failed to save workspace: " + err);
    }
  }, []);

  const openWorkspace = useCallback(async () => {
    const { snapshot, toast, confirmDialog, projects, apply } = liveRef.current;
    try {
      const selected = await openDialogFile({
        filters: [{ name: "WinISD Workspace", extensions: [WORKSPACE_EXTENSION] }],
        multiple: false,
      });
      if (!selected || Array.isArray(selected)) return;

      const text: string = await invoke("read_text_file", { path: selected });
      const w = deserializeWorkspace(text, snapshot());
      if (!w) {
        toast.error("That file is not a readable workspace.");
        return;
      }

      // Replacing the bench discards whatever is on it, so ask first.
      const ok = await confirmDialog({
        title: "Open Workspace?",
        body: `This replaces the ${projects.length} project${projects.length === 1 ? "" : "s"} currently open. Unsaved changes will be lost.`,
        confirmLabel: "Open",
      });
      if (!ok) return;

      apply(w);
      toast.success(`Workspace loaded — ${w.projects.length} project${w.projects.length === 1 ? "" : "s"}.`);
    } catch (err) {
      console.error("Failed to open workspace:", err);
      toast.error("Failed to open workspace: " + err);
    }
  }, []);

  const newWorkspace = useCallback(() => liveRef.current.handleNewProject(), []);

  const value = useMemo(
    () => ({ newWorkspace, openWorkspace, saveWorkspace }),
    [newWorkspace, openWorkspace, saveWorkspace],
  );

  return (
    <WorkspaceContext.Provider value={value}>
      {children}
    </WorkspaceContext.Provider>
  );
}

export function useWorkspaceContext(): WorkspaceValue {
  const ctx = useContext(WorkspaceContext);
  if (!ctx) throw new Error("useWorkspaceContext must be used within a WorkspaceProvider");
  return ctx;
}
