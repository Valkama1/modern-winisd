import { useEffect, useMemo, useRef, useState } from "react";
import { open as openDialogFile, save as saveDialogFile } from "@tauri-apps/plugin-dialog";
import { invoke } from "@tauri-apps/api/core";
import {
  DEFAULT_CUSTOM,
  DEFAULT_DRIVER,
  DEFAULT_QL,
  DRIVER_CONFIGS,
  ENCLOSURE_TYPES,
  PASSIVE_XO_TYPES,
  PORT_SHAPES,
  Project,
  ProjectFile,
  SPL_ENVIRONMENTS,
  oneOf,
} from "../types";
import { createDefaultProject, withProjectDefaults } from "../lib/projectDefaults";
import { loadSavedSession } from "../lib/session";
import { toProjectFile } from "../lib/projectFile";
import { useToast, useDialog } from "../components/ui";
import { useDriverDatabaseContext } from "../context/DriverDatabaseContext";

export const PRESET_LINE_COLORS = [
  "#10b981", // Emerald
  "#06b6d4", // Cyan
  "#f43f5e", // Rose
  "#eab308", // Yellow
  "#6366f1", // Indigo
  "#f97316", // Orange
  "#ec4899", // Pink
  "#a855f7"  // Purple
];


export function useProjects() {
  const toast = useToast();
  const { confirmDialog, promptDialog } = useDialog();
  const { openDriverBrowser } = useDriverDatabaseContext();

  const savedSession = useMemo(() => loadSavedSession(), []);

  const [projects, setProjects] = useState<Project[]>(() => {
    // Backfill anything the stored session predates, so a project restored from an
    // older build is complete rather than missing fields its controls need.
    return savedSession?.projects?.map(withProjectDefaults)
      || [createDefaultProject("project-1", "", PRESET_LINE_COLORS[0])];
  });
  const [activeProjectId, setActiveProjectId] = useState<string>(() => {
    return savedSession?.activeProjectId || "project-1";
  });

  const activeProject = useMemo(() => {
    return projects.find((p) => p.id === activeProjectId) || projects[0];
  }, [projects, activeProjectId]);

  // ── Undo / Redo ────────────────────────────────────────────────────────────
  const undoStackRef = useRef<Project[][]>([]);
  const redoStackRef = useRef<Project[][]>([]);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);

  /**
   * Mirror of the committed projects array.
   *
   * History bookkeeping used to run inside the setProjects updater, which also called
   * setCanUndo from in there. React requires updaters to be pure and may invoke them
   * more than once — StrictMode does so in development precisely to surface this — so
   * mutating refs and queueing state from inside one is unsupported, even though it
   * happens to produce the right stack depth today. Keeping a mirror of the committed
   * value lets the bookkeeping run out here, once per call, where it is defined.
   */
  const projectsRef = useRef(projects);
  useEffect(() => {
    projectsRef.current = projects;
  }, [projects]);

  const HISTORY_LIMIT = 20;

  /**
   * How long a run of edits to one field keeps folding into a single undo entry.
   *
   * updateActiveProject is called once per keystroke, so typing "150" pushed three
   * entries and the 20-slot stack held about six real edits — Ctrl+Z walked back one
   * character at a time. A run of edits to the same field of the same project now
   * shares one entry, so undo lands where the field was before it was touched.
   *
   * A pause ends the run, the way it does in a text editor: it is the boundary a
   * person perceives between one edit and the next.
   */
  const COALESCE_MS = 600;
  const lastEditRef = useRef<{ key: string; at: number } | null>(null);

  const commit = (next: Project[]) => {
    projectsRef.current = next;
    setProjects(next);
  };

  /**
   * `coalesceKey` identifies which field is being edited. Two consecutive calls
   * carrying the same key within COALESCE_MS share one history entry; anything
   * without a key — adding, removing or loading a project — always gets its own and
   * ends whatever run was in progress.
   */
  const setProjectsWithHistory = (
    newProjects: Project[] | ((prev: Project[]) => Project[]),
    coalesceKey?: string,
  ) => {
    const prev = projectsRef.current;
    const next = typeof newProjects === "function" ? newProjects(prev) : newProjects;

    const now = Date.now();
    const last = lastEditRef.current;
    const continuesRun =
      coalesceKey !== undefined &&
      last !== null &&
      last.key === coalesceKey &&
      now - last.at < COALESCE_MS &&
      // Undo and redo clear the marker, so a run can never fold into an entry that
      // has already been stepped over.
      undoStackRef.current.length > 0;

    if (!continuesRun) {
      undoStackRef.current.push(prev);
      if (undoStackRef.current.length > HISTORY_LIMIT) undoStackRef.current.shift();
    }
    lastEditRef.current = coalesceKey === undefined ? null : { key: coalesceKey, at: now };

    redoStackRef.current = [];
    setCanUndo(true);
    setCanRedo(false);
    commit(next);
  };

  const undo = () => {
    const previous = undoStackRef.current.pop();
    if (previous === undefined) return;
    lastEditRef.current = null;

    redoStackRef.current.push(projectsRef.current);
    setCanUndo(undoStackRef.current.length > 0);
    setCanRedo(true);
    commit(previous);
  };

  const redo = () => {
    const next = redoStackRef.current.pop();
    if (next === undefined) return;
    lastEditRef.current = null;

    undoStackRef.current.push(projectsRef.current);
    if (undoStackRef.current.length > HISTORY_LIMIT) undoStackRef.current.shift();
    setCanUndo(true);
    setCanRedo(redoStackRef.current.length > 0);
    commit(next);
  };

  // Keyboard shortcuts: Ctrl+Z undo, Ctrl+Y / Ctrl+Shift+Z redo.
  //
  // undo and redo are rebuilt every render, so naming them here would re-register the
  // listener on every render. They go through a ref instead: the handler is installed
  // once and always calls the current pair.
  const historyRef = useRef({ undo, redo });
  useEffect(() => {
    historyRef.current = { undo, redo };
  });

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const el = document.activeElement as HTMLElement | null;
      if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT")) return;
      if (e.ctrlKey && e.key === "z" && !e.shiftKey) { e.preventDefault(); historyRef.current.undo(); }
      if (e.ctrlKey && ((e.key === "y") || (e.key === "z" && e.shiftKey))) { e.preventDefault(); historyRef.current.redo(); }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const updateActiveProject = (patch: Partial<Project>) => {
    // Same project, same field names: one continuous edit as far as undo is concerned.
    const key = `${activeProject.id}:${Object.keys(patch).sort().join(",")}`;
    setProjectsWithHistory(
      (prev) => prev.map((p) => (p.id === activeProject.id ? { ...p, ...patch } : p)),
      key,
    );
  };

  // Project Actions
  const handleNewProject = async () => {
    const ok = await confirmDialog({
      title: "New Workspace?",
      body: "This clears every project on the dashboard and starts one fresh design. Unsaved changes will be lost.",
      confirmLabel: "Start New",
    });
    if (ok) {
      openDriverBrowser((driver) => {
        const defaultId = "project-1";
        setProjectsWithHistory([
          createDefaultProject(defaultId, "", PRESET_LINE_COLORS[0], driver)
        ]);
        setActiveProjectId(defaultId);
      });
    }
  };

  const handleAddNewProject = () => {
    openDriverBrowser((driver) => {
      const nextId = `project-${Date.now()}`;
      const nextColor = PRESET_LINE_COLORS[projects.length % PRESET_LINE_COLORS.length];
      const newProj = createDefaultProject(nextId, "", nextColor, driver);
      setProjectsWithHistory((prev) => [...prev, newProj]);
      setActiveProjectId(nextId);
    });
  };

  const handleDuplicateProject = (id: string) => {
    const source = projects.find((p) => p.id === id);
    if (!source) return;
    const nextId = `project-${Date.now()}`;
    const nextColor = PRESET_LINE_COLORS[projects.length % PRESET_LINE_COLORS.length];
    const duplicate: Project = {
      ...JSON.parse(JSON.stringify(source)),
      id: nextId,
      name: `${source.name} (Copy)`,
      color: nextColor,
    };
    setProjectsWithHistory((prev) => [...prev, duplicate]);
    setActiveProjectId(nextId);
  };

  const handleRenameProject = async (id: string) => {
    const project = projects.find((p) => p.id === id);
    if (!project) return;
    const newName = await promptDialog({
      title: "Rename Project",
      label: "Project name",
      defaultValue: project.name,
    });
    if (newName && newName.trim() !== "") {
      setProjectsWithHistory((prev) =>
        prev.map((p) => (p.id === id ? { ...p, name: newName.trim() } : p))
      );
    }
  };

  const handleRemoveProject = (id: string) => {
    if (projects.length <= 1) return;
    const activeIdx = projects.findIndex((p) => p.id === id);
    const filtered = projects.filter((p) => p.id !== id);
    setProjectsWithHistory(filtered);
    if (activeProjectId === id) {
      const nextActive = filtered[Math.max(0, activeIdx - 1)];
      setActiveProjectId(nextActive.id);
    }
  };

  const handleSaveProject = async () => {
    try {
      const filePath = await saveDialogFile({
        filters: [{ name: "WinISD Project", extensions: ["wproj"] }],
        defaultPath: `${activeProject.name.replace(/\s+/g, "_")}.wproj`,
      });
      if (filePath) {
        await invoke("save_project", {
          path: filePath,
          state: toProjectFile(activeProject),
        });
        const name = filePath.split(/[/\\]/).pop() || "Project";
        const cleanName = name.replace(".wproj", "");
        updateActiveProject({ name: cleanName });
        // Say the scope out loud: this writes the active design only, not the
        // other curves on the dashboard.
        toast.success(`Saved "${activeProject.name}" — this project only. Use Save Workspace for all ${projects.length}.`);
      }
    } catch (err) {
      toast.error("Error saving project: " + err);
    }
  };

  const handleOpenProject = async () => {
    try {
      const selected = await openDialogFile({
        filters: [{ name: "WinISD Project", extensions: ["wproj"] }],
        multiple: false,
      });
      if (selected && !Array.isArray(selected)) {
        const state: ProjectFile = await invoke("load_project", { path: selected });

        const nextId = `project-${Date.now()}`;
        const nextColor = PRESET_LINE_COLORS[projects.length % PRESET_LINE_COLORS.length];
        const loadedProject: Project = {
          id: nextId,
          name: state.project_name || "Loaded Project",
          color: nextColor,
          showOnGraph: true,
          driver: state.driver || DEFAULT_DRIVER,
          vBox: state.v_box || 100,
          enclosureType: oneOf(ENCLOSURE_TYPES, state.enclosure_type, "sealed"),
          tuningFreq: state.tuning_freq || 33,
          portDiameter: state.port_diameter || 10.0,
          portShape: oneOf(PORT_SHAPES, state.port_shape, "circular"),
          portCount: state.port_count || 1,
          portWidth: state.port_width || 30.0,
          portHeight: state.port_height || 5.0,
          inputPower: state.input_power || 1,
          distance: state.distance || 1,
          numDrivers: state.num_drivers || 1,
          vRear: state.v_rear ?? 80,
          vFront: state.v_front ?? 40,
          frontTuningFreq: state.front_tuning_freq ?? 55,
          rearTuningFreq: state.rear_tuning_freq ?? 30,
          frontPortDiameter: state.front_port_diameter ?? 10.0,
          rearPortDiameter: state.rear_port_diameter ?? 10.0,
          internalPortDiameter: state.internal_port_diameter ?? 10.0,
          prMms: state.pr_mms ?? 300,
          prSd: state.pr_sd ?? 1680,
          prFs: state.pr_fs ?? 25,
          prQms: state.pr_qms ?? 5.0,
          prXmax: state.pr_xmax ?? 15.0,
          portQ: state.port_q ?? 50,
          ql: state.ql ?? DEFAULT_QL,
          splEnvironment: oneOf(SPL_ENVIRONMENTS, state.spl_environment, "half_space"),
          customTopology: state.custom_topology || DEFAULT_CUSTOM,
          notes: state.notes || "",
          driverConfig: oneOf(DRIVER_CONFIGS, state.driver_config, "standard"),
          port2Enabled: state.port2_enabled ?? false,
          port2Count: state.port2_count ?? 1,
          port2Diameter: state.port2_diameter ?? 10.0,
          port2Shape: oneOf(PORT_SHAPES, state.port2_shape, "circular"),
          port2Width: state.port2_width ?? 20.0,
          port2Height: state.port2_height ?? 5.0,
          passiveXoEnabled: state.passive_xo_enabled ?? false,
          passiveXoType: oneOf(PASSIVE_XO_TYPES, state.passive_xo_type, "lowpass_1st"),
          passiveXoInductance: state.passive_xo_inductance ?? 1.5,
          passiveXoCapacitance: state.passive_xo_capacitance ?? 47.0,
          passiveXoDcr: state.passive_xo_dcr ?? 0.2,
        };

        setProjectsWithHistory((prev) => [...prev, loadedProject]);
        setActiveProjectId(nextId);
        toast.success(`Added "${loadedProject.name}" to the workspace.`);
      }
    } catch (err) {
      toast.error("Error loading project: " + err);
    }
  };

  return {
    projects, activeProjectId, setActiveProjectId, activeProject,
    canUndo, canRedo, undo, redo, setProjectsWithHistory, updateActiveProject,
    handleNewProject, handleAddNewProject, handleDuplicateProject,
    handleRenameProject, handleRemoveProject, handleSaveProject, handleOpenProject,
  };
}
