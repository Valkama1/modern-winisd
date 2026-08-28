import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Sliders, Activity, FolderOpen, Save, FilePlus, Database, X, Plus, Info, Settings, Copy, Trash2, Edit3, Undo2, Redo2, Download, FileText, ChevronDown, Ruler } from "lucide-react";
import { PRESETS } from "./theme";
import { findLFCrossover, cmsFromVasSd, mmsKgFromFsCms, blFromFsMmsQes, eta0FromFsVasQes } from "./lib/calculations";
import { useToast, useDialog, Tooltip, Button, TextField, NumberField, Select, Badge, CollapsibleSection } from "./components/ui";
import { Driver, CurveType, EnclosureType, CustomPortSpec, CustomPRSpec, CustomSideSpec, EqFilter, SpeakerPos, Project } from "./types";
import CustomTopologyDiagram from "./components/CustomTopologyDiagram";
import { ThemeProvider, useThemeContext } from "./context/ThemeContext";
import { ModalsProvider, useModalsContext } from "./context/ModalsContext";
import { DriverDatabaseProvider, useDriverDatabaseContext } from "./context/DriverDatabaseContext";
import { SignalProcessingProvider, useSignalProcessingContext } from "./context/SignalProcessingContext";
import { ProjectsProvider, useProjectsContext } from "./context/ProjectsContext";
import { GraphViewportProvider, useGraphViewportContext } from "./context/GraphViewportContext";
import { SimulationProvider, useSimulationContext } from "./context/SimulationContext";
import { PRESET_LINE_COLORS } from "./hooks/useProjects";
import "./App.css";

const SPEAKER_COLORS = ["#10b981", "#f59e0b", "#ef4444", "#a855f7", "#06b6d4", "#ec4899"];

const DEFAULT_PORT: CustomPortSpec = { diameter_cm: 10, tuning_freq: 35 };
const DEFAULT_PR: CustomPRSpec = { mms_g: 300, sd_cm2: 1680, fs: 25, qms: 5 };

function AppShell() {
  // Theme state
  const { currentTheme, setCurrentTheme, handleCustomColorChange, activePresetKey } = useThemeContext();

  const toast = useToast();
  const { confirmDialog } = useDialog();

  const {
    projects, activeProjectId, setActiveProjectId, activeProject,
    canUndo, canRedo, undo, redo, setProjectsWithHistory, updateActiveProject,
    handleNewProject, handleAddNewProject, handleDuplicateProject,
    handleRenameProject, handleRemoveProject, handleSaveProject, handleOpenProject,
  } = useProjectsContext();

  const updateCustomRear = (patch: Partial<CustomSideSpec>) => {
    updateActiveProject({
      customTopology: {
        ...activeProject.customTopology,
        rear: { ...activeProject.customTopology.rear, ...patch }
      }
    });
  };

  const updateCustomFront = (patch: Partial<CustomSideSpec>) => {
    updateActiveProject({
      customTopology: {
        ...activeProject.customTopology,
        front: { ...activeProject.customTopology.front, ...patch }
      }
    });
  };

  const updateCustomRearPort = (patch: Partial<CustomPortSpec>) => {
    updateActiveProject({
      customTopology: {
        ...activeProject.customTopology,
        rear: {
          ...activeProject.customTopology.rear,
          port: { ...(activeProject.customTopology.rear.port ?? DEFAULT_PORT), ...patch }
        }
      }
    });
  };

  const updateCustomRearPR = (patch: Partial<CustomPRSpec>) => {
    updateActiveProject({
      customTopology: {
        ...activeProject.customTopology,
        rear: {
          ...activeProject.customTopology.rear,
          pr: { ...(activeProject.customTopology.rear.pr ?? DEFAULT_PR), ...patch }
        }
      }
    });
  };

  const updateCustomFrontPort = (patch: Partial<CustomPortSpec>) => {
    updateActiveProject({
      customTopology: {
        ...activeProject.customTopology,
        front: {
          ...activeProject.customTopology.front,
          port: { ...(activeProject.customTopology.front.port ?? DEFAULT_PORT), ...patch }
        }
      }
    });
  };

  const updateCustomFrontPR = (patch: Partial<CustomPRSpec>) => {
    updateActiveProject({
      customTopology: {
        ...activeProject.customTopology,
        front: {
          ...activeProject.customTopology.front,
          pr: { ...(activeProject.customTopology.front.pr ?? DEFAULT_PR), ...patch }
        }
      }
    });
  };

  const updateCustomInternalPort = (patch: Partial<CustomPortSpec>) => {
    updateActiveProject({
      customTopology: {
        ...activeProject.customTopology,
        internal_port: { ...(activeProject.customTopology.internal_port ?? DEFAULT_PORT), ...patch }
      }
    });
  };

  const [hoveredFreq, setHoveredFreq] = useState<number | null>(null);
  const [showDropdown, setShowDropdown] = useState(false);
  const [alignmentPref, setAlignmentPref] = useState<"maximally_flat" | "extended_bass" | "boomy">("maximally_flat");

  const { showSettings, setShowSettings, sidebarTab, setSidebarTab, sidebarSectionState, toggleSidebarSection } = useModalsContext();

  const {
    setDrivers, searchQuery, setSearchQuery, filteredDrivers,
    showBrowser, setShowBrowser, showAddForm, setShowAddForm,
    browserCallback, setBrowserCallback, editingDriverId, setEditingDriverId,
    openDriverBrowser,
  } = useDriverDatabaseContext();

  const {
    filters, setFilters, roomConfig, setRoomConfig, roomDragging, setRoomDragging,
    cabinConfig, setCabinConfig,
  } = useSignalProcessingContext();

  const {
    visibleGraphs, setVisibleGraphs,
    dashboardContainerRef, dashboardWidth, graphHeights, handleResizeStart,
    graphConfigs, updateViewportConfig,
    globalXMin, setGlobalXMin, globalXMax, setGlobalXMax, overrideXLimits, setOverrideXLimits,
    getGraphXLimits, configEditType, setConfigEditType,
    rulerFreq, setRulerFreq,
  } = useGraphViewportContext();

  const {
    simulationResults, calculatedPortLength, kaWarningFreq, systemStats, getDisplayValue, phaseGdData,
    filterGainFn, roomCorrectionFn, filterLinearFn, cabinGainFn,
    handleAutoCalculatePort, handleApplyAlignment,
    svgRefsMap, showExportMenu, setShowExportMenu, handleExportSVG, handleExportPNG, handleExportSummary,
  } = useSimulationContext();

  // Draggable Ruler State
  const [isDraggingRuler, setIsDraggingRuler] = useState(false);

  // ── Dimension calculator state ─────────────────────────────────────────────
  const [calcMode, setCalcMode] = useState<"vb-to-dims" | "dims-to-vb">("vb-to-dims");
  const [calcVb, setCalcVb] = useState("150");
  const [calcRatioL, setCalcRatioL] = useState("1.618");
  const [calcRatioW, setCalcRatioW] = useState("1");
  const [calcRatioD, setCalcRatioD] = useState("0.618");
  const [calcExtL, setCalcExtL] = useState("60");
  const [calcExtW, setCalcExtW] = useState("40");
  const [calcExtD, setCalcExtD] = useState("35");
  const [calcThickness, setCalcThickness] = useState("18");

  // Add Driver Form Fields
  const [newManufacturer, setNewManufacturer] = useState("");
  const [newModel, setNewModel] = useState("");
  const [newFs, setNewFs] = useState("33");
  const [newQes, setNewQes] = useState("0.37");
  const [newQms, setNewQms] = useState("7.7");
  const [newQts, setNewQts] = useState("0.36");
  const [newVas, setNewVas] = useState("278");
  const [newRe, setNewRe] = useState("3.6");
  const [newSd, setNewSd] = useState("1680");
  const [newXmax, setNewXmax] = useState("14");
  const [newMms, setNewMms] = useState("335");
  const [newLe, setNewLe] = useState("1.7");
  const [newBl, setNewBl] = useState("24.8");
  const [newPe, setNewPe] = useState("1700");
  const [newSens, setNewSens] = useState("97");

  // Helper inputs for estimation
  const [pistonDiameter, setPistonDiameter] = useState("");
  const [nominalImpedance, setNominalImpedance] = useState("4");

  // Keyboard shortcuts: Ctrl+Z undo, Ctrl+Y / Ctrl+Shift+Z redo
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const el = document.activeElement as HTMLElement | null;
      if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT")) return;
      if (e.ctrlKey && e.key === "z" && !e.shiftKey) { e.preventDefault(); undo(); }
      if (e.ctrlKey && ((e.key === "y") || (e.key === "z" && e.shiftKey))) { e.preventDefault(); redo(); }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  // Close export menu on outside click
  useEffect(() => {
    if (showExportMenu === null) return;
    const handler = (e: MouseEvent) => {
      const t = e.target as HTMLElement;
      if (!t.closest("[data-export-menu]")) setShowExportMenu(null);
    };
    window.addEventListener("mousedown", handler);
    return () => window.removeEventListener("mousedown", handler);
  }, [showExportMenu]);

  // Release draggable ruler on global mouseup
  useEffect(() => {
    if (!isDraggingRuler) return;
    const handleMouseUp = () => setIsDraggingRuler(false);
    window.addEventListener("mouseup", handleMouseUp);
    return () => window.removeEventListener("mouseup", handleMouseUp);
  }, [isDraggingRuler]);

  // Auto-save session state to localStorage on state changes
  useEffect(() => {
    try {
      const sessionState = {
        projects,
        activeProjectId,
        visibleGraphs,
        sidebarTab,
        sidebarSectionState,
        globalXMin,
        globalXMax,
        overrideXLimits,
        graphConfigs,
        filters,
        roomConfig,
        cabinConfig,
        rulerFreq,
        graphHeights,
      };
      localStorage.setItem("winisd_session_state", JSON.stringify(sessionState));
    } catch (e) {
      console.error("Failed to auto-save session state:", e);
    }
  }, [projects, activeProjectId, visibleGraphs, sidebarTab, sidebarSectionState, globalXMin, globalXMax, overrideXLimits, graphConfigs, filters, roomConfig, cabinConfig, rulerFreq, graphHeights]);

  // Remove velocity graph when switching to sealed (no ports)
  useEffect(() => {
    const noPortTypes: EnclosureType[] = ["sealed"];
    if (noPortTypes.includes(activeProject.enclosureType) && visibleGraphs.includes("velocity")) {
      setVisibleGraphs(visibleGraphs.filter((g) => g !== "velocity"));
    }
  }, [activeProject.enclosureType, visibleGraphs]);

  // Recalculate Qts if Qes or Qms changes
  useEffect(() => {
    const qes = parseFloat(newQes);
    const qms = parseFloat(newQms);
    if (!isNaN(qes) && !isNaN(qms) && qes + qms > 0) {
      const calculatedQts = (qes * qms) / (qes + qms);
      setNewQts(calculatedQts.toFixed(3));
    }
  }, [newQes, newQms]);

  // Add Driver Action
  const handleAddDriver = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newManufacturer || !newModel) {
      await confirmDialog({ title: "Missing Fields", body: "Manufacturer and Model are required.", okOnly: true });
      return;
    }

    const finalFs = parseFloat(newFs) || 30.0;
    const finalQes = parseFloat(newQes) || 0.4;
    const finalQms = parseFloat(newQms) || 5.0;
    const finalVas = parseFloat(newVas) || 50.0;
    const finalQts = parseFloat(newQts) || (finalQes * finalQms) / (finalQes + finalQms);

    let finalSd = parseFloat(newSd) || 0;
    if (finalSd <= 0) {
      if (pistonDiameter) {
        const diaCm = parseFloat(pistonDiameter) * 2.54;
        finalSd = Math.PI * Math.pow(diaCm / 2, 2);
      } else {
        finalSd = 530.0; // fallback standard 12 inch
      }
    }

    let finalRe = parseFloat(newRe) || 0;
    if (finalRe <= 0) {
      finalRe = nominalImpedance ? parseFloat(nominalImpedance) * 0.8 : 3.6;
    }

    let finalMms = parseFloat(newMms) || 0;
    let finalBl = parseFloat(newBl) || 0;
    let finalSens = parseFloat(newSens) || 0;

    const vasM3 = finalVas * 1e-3;
    const ws = 2.0 * Math.PI * finalFs;
    const cms = cmsFromVasSd(finalVas, finalSd);

    if (finalMms <= 0 && cms > 0 && ws > 0) {
      finalMms = mmsKgFromFsCms(finalFs, cms) * 1000.0;
    }
    const finalMmsKg = finalMms / 1000.0;

    if (finalBl <= 0 && ws > 0 && finalMmsKg > 0 && finalRe > 0 && finalQes > 0) {
      finalBl = blFromFsMmsQes(finalFs, finalMmsKg, finalRe, finalQes);
    }

    if (finalSens <= 0 && finalFs > 0 && vasM3 > 0 && finalQes > 0) {
      const eta0 = eta0FromFsVasQes(finalFs, finalVas, finalQes);
      if (eta0 > 0) {
        finalSens = 112.0 + 10.0 * Math.log10(eta0);
      } else {
        finalSens = 90.0;
      }
    }

    const finalLe = parseFloat(newLe) || 1.5; // typical default
    const finalPe = parseFloat(newPe) || 250.0;
    const finalXmax = parseFloat(newXmax) || 5.0;

    const driverData: Driver = {
      id: "",
      manufacturer: newManufacturer,
      model: newModel,
      fs: finalFs,
      qts: finalQts,
      qes: finalQes,
      qms: finalQms,
      vas: finalVas,
      re: finalRe,
      sd: finalSd,
      xmax: finalXmax,
      mms: finalMms,
      le: finalLe,
      bl: finalBl,
      pe: finalPe,
      sens: finalSens,
    };

    try {
      let updatedDrivers: Driver[];
      if (editingDriverId) {
        updatedDrivers = await invoke("edit_driver", { id: editingDriverId, driver: driverData });
        // Update all projects using this driver
        const savedDriver = updatedDrivers.find(d => d.id === editingDriverId) || driverData;
        setProjectsWithHistory((prev) =>
          prev.map((p) => (p.driver.id === editingDriverId ? { ...p, driver: { ...savedDriver, id: editingDriverId } } : p))
        );
      } else {
        updatedDrivers = await invoke("add_driver", { driver: driverData });
        const savedDriver = updatedDrivers[updatedDrivers.length - 1];
        if (browserCallback) {
          browserCallback(savedDriver);
        } else {
          updateActiveProject({
            driver: savedDriver,
            vBox: savedDriver.vas / 2,
          });
        }
      }
      setDrivers(updatedDrivers);
      setShowAddForm(false);
      setShowBrowser(false);
      setBrowserCallback(null);
      setEditingDriverId(null);
      setNewManufacturer("");
      setNewModel("");
    } catch (err) {
      toast.error("Error saving driver: " + err);
    }
  };

  const handleStartEditDriver = (driver: Driver) => {
    setEditingDriverId(driver.id);
    setNewManufacturer(driver.manufacturer);
    setNewModel(driver.model);
    setNewFs(driver.fs.toString());
    setNewQes(driver.qes.toString());
    setNewQms(driver.qms.toString());
    setNewQts(driver.qts.toString());
    setNewVas(driver.vas.toString());
    setNewRe(driver.re.toString());
    setNewSd(driver.sd.toString());
    setNewXmax(driver.xmax.toString());
    setNewMms(driver.mms.toString());
    setNewLe(driver.le.toString());
    setNewBl(driver.bl.toString());
    setNewPe(driver.pe.toString());
    setNewSens(driver.sens.toString());
    setPistonDiameter("");
    setShowAddForm(true);
  };

  const handleStartAddDriver = () => {
    setEditingDriverId(null);
    setNewManufacturer("");
    setNewModel("");
    setNewFs("33");
    setNewQes("0.37");
    setNewQms("7.7");
    setNewQts("0.36");
    setNewVas("278");
    setNewRe("3.6");
    setNewSd("1680");
    setNewXmax("14");
    setNewMms("335");
    setNewLe("1.7");
    setNewBl("24.8");
    setNewPe("1700");
    setNewSens("97");
    setPistonDiameter("");
    setShowAddForm(true);
  };

  const handleAutoEstimateTS = async () => {
    const fs = parseFloat(newFs);
    const qes = parseFloat(newQes);
    const qms = parseFloat(newQms);
    const vas = parseFloat(newVas);

    // Compute Qts
    if (qes && qms) {
      const qtsVal = (qes * qms) / (qes + qms);
      setNewQts(qtsVal.toFixed(4));
    }

    // Estimate Sd from piston diameter if provided
    let sdVal = parseFloat(newSd);
    if (pistonDiameter) {
      const diaCm = parseFloat(pistonDiameter) * 2.54;
      sdVal = Math.PI * Math.pow(diaCm / 2, 2);
      setNewSd(sdVal.toFixed(1));
    }

    // Estimate Re if not provided
    let reVal = parseFloat(newRe);
    if (!reVal) {
      reVal = nominalImpedance ? parseFloat(nominalImpedance) * 0.8 : 3.6;
      setNewRe(reVal.toFixed(2));
    }

    if (fs && qes && qms && vas && sdVal && reVal) {
      // Cms
      const cms = cmsFromVasSd(vas, sdVal);

      // Mms
      const mmsKg = mmsKgFromFsCms(fs, cms);
      const mmsG = mmsKg * 1000.0;
      setNewMms(mmsG.toFixed(1));

      // Bl
      const blVal = blFromFsMmsQes(fs, mmsKg, reVal, qes);
      setNewBl(blVal.toFixed(2));

      // Sensitivity
      const eta0 = eta0FromFsVasQes(fs, vas, qes);
      if (eta0 > 0) {
        const sensVal = 112.0 + 10.0 * Math.log10(eta0);
        setNewSens(sensVal.toFixed(1));
      }
    } else {
      await confirmDialog({
        title: "Missing Fields",
        body: "Please ensure Fs, Qes, Qms, Vas, and either Sd or Piston Diameter are populated first.",
        okOnly: true,
      });
    }
  };

  const handleVerifyParameters = async () => {
    const fs = parseFloat(newFs);
    const qes = parseFloat(newQes);
    const qms = parseFloat(newQms);
    const vas = parseFloat(newVas);
    
    let sd = parseFloat(newSd);
    if (!sd && pistonDiameter) {
      const diaCm = parseFloat(pistonDiameter) * 2.54;
      sd = Math.PI * Math.pow(diaCm / 2, 2);
    }

    if (!fs || !qes || !qms || !vas || !sd) {
      await confirmDialog({
        title: "Cannot Verify",
        body: "Verification requires at least Fs, Qes, Qms, Vas, and Sd (or Piston Diameter) to be filled in.",
        okOnly: true,
      });
      return;
    }

    const re = parseFloat(newRe) || 3.6;

    const rho = 1.18;
    const c_air = 343.0;
    const sdM2 = sd * 1e-4;
    const vasM3 = vas * 1e-3;
    const cms = vasM3 / (rho * c_air * c_air * sdM2 * sdM2);
    const ws = 2.0 * Math.PI * fs;
    const derivedMmsKg = 1.0 / (ws * ws * cms);
    const derivedMmsG = derivedMmsKg * 1000.0;

    const derivedBl = Math.sqrt((ws * derivedMmsKg * re) / qes);

    const enteredMms = parseFloat(newMms);
    const enteredBl = parseFloat(newBl);

    const anomalies: string[] = [];

    if (enteredMms > 0) {
      const cmsFromMms = 1.0 / (ws * ws * (enteredMms / 1000.0));
      const derivedVasL = 0.00138813 * Math.pow(sd, 2) * (cmsFromMms * 1000.0);
      const vasDiscrepancy = Math.abs(derivedVasL - vas) / vas;
      if (vasDiscrepancy > 0.15) {
        anomalies.push(
          `• Vas Discrepancy: Entered Vas is ${vas} L, but based on your entered Sd (${sd.toFixed(1)} cm²) and moving mass, it should mathematically be ${derivedVasL.toFixed(1)} L. This is a ${Math.round(vasDiscrepancy * 100)}% discrepancy. Please check if your Sd or Vas has a manufacturer copy-paste error.`
        );
      }

      const mmsDiscrepancy = Math.abs(enteredMms - derivedMmsG) / derivedMmsG;
      if (mmsDiscrepancy > 0.15) {
        anomalies.push(
          `• Mms Discrepancy: Entered Mms is ${enteredMms} g, but calculated moving mass from your Vas/Sd is ${derivedMmsG.toFixed(1)} g. (Difference: ${Math.round(mmsDiscrepancy * 100)}%).`
        );
      }
    }

    if (enteredBl > 0) {
      const blDiscrepancy = Math.abs(enteredBl - derivedBl) / derivedBl;
      if (blDiscrepancy > 0.15) {
        anomalies.push(
          `• BL Motor Strength Discrepancy: Entered BL is ${enteredBl} T·m, but calculated BL from Qes and moving mass is ${derivedBl.toFixed(2)} T·m. (Difference: ${Math.round(blDiscrepancy * 100)}%).`
        );
      }
    }

    if (anomalies.length > 0) {
      await confirmDialog({
        title: "Thiele-Small Verification Report",
        body: `${anomalies.join("\n\n")}\n\nNote: The backend simulation solver will automatically run with self-consistent derived parameters (best-effort alignment), but resolving these anomalies ensures that all graphs and parameters behave identically to the manufacturer's target.`,
        okOnly: true,
      });
    } else {
      await confirmDialog({
        title: "Thiele-Small Verification: Success",
        body: `All parameters (Fs, Qts, Vas, Sd, Mms, BL) are mathematically consistent within tolerances. Your driver is perfectly configured for simulation!`,
        okOnly: true,
      });
    }
  };

  const checkDriverConsistency = (drv: Driver) => {
    if (!drv.fs || !drv.mms || !drv.sd || !drv.vas) return null;
    const fs = drv.fs;
    const mms = drv.mms;
    const sd = drv.sd;
    const vas = drv.vas;

    // 1. Calculate Cms in mm/N
    const cms = 1e6 / (Math.pow(2 * Math.PI * fs, 2) * mms);

    // 2. Calculate derived Vas in Liters
    const derivedVas = 0.00138813 * Math.pow(sd, 2) * cms;

    // Discrepancy ratio
    const discrepancy = Math.abs(derivedVas - vas) / vas;

    return {
      cms,
      derivedVas,
      discrepancy,
      isInconsistent: discrepancy > 0.15, // Warning threshold: >15% discrepancy
    };
  };

  // Graph Limits & Dimensions constants
  const paddingLeft = 55;
  const paddingRight = 20;
  const paddingTop = 45;
  const paddingBottom = 40;

  return (
    <div
      className="flex h-screen w-screen overflow-hidden font-sans transition-colors duration-150"
      style={{ backgroundColor: "var(--bg-color)", color: "var(--text-color)" }}
    >
      {/* Sidebar */}
      <div
        className="w-80 border-r flex flex-col overflow-hidden transition-colors duration-150 shrink-0"
        style={{ backgroundColor: "var(--sidebar-color)", borderRightColor: "var(--graph-grid-color)" }}
      >
        {/* Logo */}
        <div className="p-5 border-b flex items-center justify-between" style={{ borderColor: "var(--graph-grid-color)" }}>
          <div className="flex items-center gap-2">
            <Activity className="h-6 w-6" style={{ color: "var(--accent-color)" }} />
            <span className="font-bold tracking-wide">WinISD Modern</span>
          </div>
          <div className="flex gap-1.5">
            <Tooltip label="Driver Database">
              <Button variant="icon" onClick={() => setShowBrowser(true)}>
                <Database className="h-4.5 w-4.5" />
              </Button>
            </Tooltip>
            <Tooltip label="Settings">
              <Button variant="icon" onClick={() => setShowSettings(true)}>
                <Settings className="h-4.5 w-4.5" />
              </Button>
            </Tooltip>
          </div>
        </div>

        {/* Project Section */}
        <div className="p-5 border-b flex flex-col gap-3" style={{ borderColor: "var(--graph-grid-color)" }}>
          <TextField
            label="Project Name"
            value={activeProject.name}
            onChange={(v) => updateActiveProject({ name: v })}
          />
          <div>
            <label className="text-xs font-semibold opacity-70 uppercase tracking-wider block mb-1">
              Notes
            </label>
            <textarea
              value={activeProject.notes ?? ""}
              onChange={(e) => updateActiveProject({ notes: e.target.value })}
              placeholder="e.g. ported version, tuned for car install…"
              rows={3}
              className="w-full text-xs border rounded px-2.5 py-1.5 focus:outline-none resize-none leading-relaxed"
              style={{
                backgroundColor: "var(--bg-color)",
                borderColor: "var(--graph-grid-color)",
                color: "var(--text-color)",
              }}
            />
          </div>
          <div className="grid grid-cols-3 gap-2">
            <button
              onClick={handleNewProject}
              className="flex flex-col items-center justify-center gap-1 py-2 text-xs rounded border transition opacity-80 hover:opacity-100 cursor-pointer"
              style={{ backgroundColor: "var(--bg-color)", borderColor: "var(--graph-grid-color)", color: "var(--text-color)" }}
            >
              <FilePlus className="h-4 w-4" />
              New
            </button>
            <button
              onClick={handleOpenProject}
              className="flex flex-col items-center justify-center gap-1 py-2 text-xs rounded border transition opacity-80 hover:opacity-100 cursor-pointer"
              style={{ backgroundColor: "var(--bg-color)", borderColor: "var(--graph-grid-color)", color: "var(--text-color)" }}
            >
              <FolderOpen className="h-4 w-4" />
              Open
            </button>
            <button
              onClick={handleSaveProject}
              className="flex flex-col items-center justify-center gap-1 py-2 text-xs border rounded transition font-medium hover:opacity-90 cursor-pointer"
              style={{
                backgroundColor: "var(--bg-color)",
                borderColor: "var(--accent-color)",
                color: "var(--accent-color)",
              }}
            >
              <Save className="h-4 w-4" />
              Save
            </button>
          </div>
        </div>

        {/* Sidebar Tabs */}
        <div className="flex border-b text-xs font-semibold select-none shrink-0" style={{ borderColor: "var(--graph-grid-color)" }}>
          {[
            { id: "driver", label: "Driver" },
            { id: "enclosure", label: "Enclosure" },
            { id: "signal", label: "Signal" },
          ].map((tab) => {
            const isSelected = sidebarTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setSidebarTab(tab.id as typeof sidebarTab)}
                className={`flex-1 py-3 text-center border-b-2 transition-all font-bold cursor-pointer ${
                  isSelected
                    ? "text-[var(--accent-color)] border-[var(--accent-color)] bg-black/5"
                    : "opacity-60 border-transparent hover:opacity-100"
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Scrollable inputs */}
        <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-5">
          {sidebarTab === "driver" && (
            <div className="flex flex-col gap-5">
              {/* Active Driver specs */}
              <div>
                <div className="flex justify-between items-center mb-2">
                  <label className="text-xs font-semibold opacity-70 uppercase tracking-wider block">
                    Active Driver
                  </label>
                  <Badge tone="accent">{activeProject.driver.sens} dB @ 1W</Badge>
                </div>
                <div className="border rounded p-3 mb-3" style={{ backgroundColor: "var(--bg-color)", borderColor: "var(--graph-grid-color)" }}>
                  <div className="flex justify-between items-start gap-2 mb-2">
                    <div className="min-w-0">
                      <h3 className="text-sm font-bold truncate">{activeProject.driver.manufacturer}</h3>
                      <p className="text-xs opacity-75 truncate">{activeProject.driver.model}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => openDriverBrowser((d) => updateActiveProject({ driver: d, vBox: d.vas / 2 }))}
                      className="px-2 py-1 text-white rounded text-2xs font-semibold tracking-wide transition shrink-0 cursor-pointer hover:brightness-110"
                      style={{ backgroundColor: "var(--accent-color)" }}
                    >
                      Change
                    </button>
                  </div>

                  <div className="grid grid-cols-3 gap-y-3 gap-x-1.5 text-center mt-2.5 border-t pt-2.5" style={{ borderColor: "var(--graph-grid-color)" }}>
                    <div>
                      <div className="text-2xs opacity-60 font-mono">Fs</div>
                      <div className="text-xs font-semibold">{activeProject.driver.fs} Hz</div>
                    </div>
                    <div>
                      <div className="text-2xs opacity-60 font-mono">Qts</div>
                      <div className="text-xs font-semibold">{activeProject.driver.qts}</div>
                    </div>
                    <div>
                      <div className="text-2xs opacity-60 font-mono">Vas</div>
                      <div className="text-xs font-semibold">{activeProject.driver.vas} L</div>
                    </div>
                    <div>
                      <div className="text-2xs opacity-60 font-mono">Mms</div>
                      <div className="text-xs font-semibold">{activeProject.driver.mms} g</div>
                    </div>
                    <div>
                      <div className="text-2xs opacity-60 font-mono">Sd</div>
                      <div className="text-xs font-semibold">{activeProject.driver.sd} cm²</div>
                    </div>
                    <div>
                      <div className="text-2xs opacity-60 font-mono">Cms</div>
                      <div className="text-xs font-semibold">
                        {activeProject.driver.fs && activeProject.driver.mms
                          ? (1e6 / (Math.pow(2 * Math.PI * activeProject.driver.fs, 2) * activeProject.driver.mms)).toFixed(2)
                          : "—"}{" "}
                        mm/N
                      </div>
                    </div>
                  </div>

                  {(() => {
                    const check = checkDriverConsistency(activeProject.driver);
                    if (check && check.isInconsistent) {
                      return (
                        <div
                          className="mt-2.5 p-2 rounded border text-2xs leading-snug"
                          style={{ backgroundColor: "var(--bg-color)", borderColor: "var(--warning-color)", color: "var(--warning-color)" }}
                        >
                          ⚠ <strong>Inconsistent Specs:</strong> Entered Vas ({activeProject.driver.vas}L) differs from calculated Vas ({check.derivedVas.toFixed(1)}L) based on Sd ({activeProject.driver.sd} cm²) and Cms. This usually indicates a manufacturer copy-paste typo (e.g. mismatching Sd or Vas).
                        </div>
                      );
                    }
                    return null;
                  })()}
                </div>

                {/* Driver Count selector */}
                <div
                  className="flex justify-between items-center text-xs border rounded p-2.5 mb-3"
                  style={{ backgroundColor: "var(--bg-color)", borderColor: "var(--graph-grid-color)" }}
                >
                  <span className="opacity-75 font-semibold">Number of Drivers</span>
                  <input
                    type="number"
                    min="1"
                    max="16"
                    value={activeProject.numDrivers}
                    onChange={(e) => updateActiveProject({ numDrivers: parseInt(e.target.value) || 1 })}
                    className="w-16 border rounded px-1.5 py-0.5 text-right font-mono focus:outline-none text-xs"
                    style={{
                      backgroundColor: "var(--sidebar-color)",
                      borderColor: "var(--graph-grid-color)",
                      color: "var(--accent-color)",
                    }}
                  />
                </div>

                {/* Isobaric / push-pull configuration */}
                <div
                  className="flex flex-col gap-1.5 text-xs border rounded p-2.5 mb-3"
                  style={{ backgroundColor: "var(--bg-color)", borderColor: "var(--graph-grid-color)" }}
                >
                  <div className="flex justify-between items-center">
                    <span className="opacity-75 font-semibold">Driver Config</span>
                    <select
                      value={activeProject.driverConfig}
                      onChange={(e) => updateActiveProject({ driverConfig: e.target.value as Project["driverConfig"] })}
                      className="border rounded px-1.5 py-0.5 text-xs focus:outline-none"
                      style={{ backgroundColor: "var(--sidebar-color)", borderColor: "var(--graph-grid-color)", color: "var(--text-color)" }}
                    >
                      <option value="standard">Standard</option>
                      <option value="isobaric_series">Isobaric (series, 8Ω×2)</option>
                      <option value="isobaric_parallel">Isobaric (parallel, 2Ω×2)</option>
                    </select>
                  </div>
                  {activeProject.driverConfig !== "standard" && (
                    <div className="opacity-60 text-2xs leading-snug">
                      2 drivers per unit — effective Vas = {(activeProject.driver.vas / 2).toFixed(1)} L, Fs unchanged.
                      {activeProject.driverConfig === "isobaric_series" ? " Each unit draws 2×Re load." : " Each unit draws Re/2 load."}
                    </div>
                  )}
                </div>

                {/* Curve Color picker */}
                <div className="flex flex-col gap-2.5 border rounded p-3" style={{ backgroundColor: "var(--bg-color)", borderColor: "var(--graph-grid-color)" }}>
                  <span className="font-semibold text-xs opacity-75 uppercase tracking-wider block">Project Curve Color</span>
                  <div className="flex gap-1.5 flex-wrap">
                    {PRESET_LINE_COLORS.map(c => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => updateActiveProject({ color: c })}
                        className={`w-5 h-5 rounded-full border transition cursor-pointer ${activeProject.color === c ? "border-white scale-110" : "border-transparent opacity-60 hover:opacity-100"}`}
                        style={{ backgroundColor: c }}
                      />
                    ))}
                  </div>
                  <div className="flex items-center gap-1.5 mt-1 text-xs">
                    <span className="opacity-60 shrink-0">Hex code:</span>
                    <input
                      type="text"
                      value={activeProject.color}
                      onChange={e => updateActiveProject({ color: e.target.value })}
                      className="w-20 border rounded px-1.5 py-0.5 font-mono focus:outline-none text-2xs"
                      style={{ backgroundColor: "var(--sidebar-color)", borderColor: "var(--graph-grid-color)", color: "var(--text-color)" }}
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Enclosure settings */}
          {sidebarTab === "enclosure" && (
            <>
            <div className="flex flex-col gap-4">
            <CollapsibleSection
              title="Enclosure Settings"
              open={sidebarSectionState["enclosure-settings"]}
              onToggle={() => toggleSidebarSection("enclosure-settings")}
            >
            <div>
              <label className="text-xs opacity-70 block mb-1">Enclosure Type</label>
              <select
                value={activeProject.enclosureType}
                onChange={(e) => updateActiveProject({ enclosureType: e.target.value as EnclosureType })}
                className="w-full border rounded px-2.5 py-1.5 text-xs focus:outline-none"
                style={{
                  backgroundColor: "var(--bg-color)",
                  borderColor: "var(--graph-grid-color)",
                  color: "var(--text-color)",
                }}
              >
                <option value="sealed">Sealed (2nd Order Closed Box)</option>
                <option value="ported">Vented (4th Order Bass Reflex)</option>
                <option value="bandpass4">4th-Order Bandpass (BP4)</option>
                <option value="bandpass6_parallel">6th-Order Parallel Bandpass (BP6P)</option>
                <option value="bandpass6_series">6th-Order Series Bandpass (BP6S)</option>
                <option value="passive_radiator">Passive Radiator (4th Order PR)</option>
                <option value="custom">Custom Topology Builder</option>
              </select>
            </div>

            {activeProject.enclosureType !== "custom" && (
              <CollapsibleSection
                title="Auto-Align Enclosure"
                open={sidebarSectionState["auto-align"]}
                onToggle={() => toggleSidebarSection("auto-align")}
                action={
                  activeProject.driver.fs && activeProject.driver.qes ? (
                    <Badge tone="accent">EBP: {Math.round(activeProject.driver.fs / activeProject.driver.qes)}</Badge>
                  ) : undefined
                }
              >
                {activeProject.driver.fs && activeProject.driver.qes && (() => {
                  const ebp = activeProject.driver.fs / activeProject.driver.qes;
                  let guidance = "";
                  if (ebp > 80) guidance = "Ported enclosure preferred (strong motor).";
                  else if (ebp < 50) guidance = "Sealed enclosure preferred (acoustic suspension).";
                  else guidance = "Highly versatile — works well in Sealed or Ported.";
                  return (
                    <p className="text-2xs opacity-60 leading-snug">
                      ℹ {guidance}
                    </p>
                  );
                })()}

                <div className="flex flex-col gap-1">
                  <span className="opacity-55 text-2xs">Alignment Target</span>
                  <select
                    value={alignmentPref}
                    onChange={(e) => setAlignmentPref(e.target.value as any)}
                    className="w-full border rounded px-2.5 py-1 text-xs focus:outline-none"
                    style={{ backgroundColor: "var(--sidebar-color)", borderColor: "var(--graph-grid-color)", color: "var(--text-color)" }}
                  >
                    <option value="maximally_flat">Maximally Flat (Butterworth)</option>
                    <option value="extended_bass">Extended Bass Shelf</option>
                    <option value="boomy">High-Output / Boomy (Bass Boost)</option>
                  </select>
                </div>

                <button
                  type="button"
                  onClick={() => handleApplyAlignment(alignmentPref)}
                  className="w-full py-1.5 hover:brightness-110 active:brightness-95 rounded text-xs font-semibold tracking-wide transition text-white hover:shadow-md cursor-pointer mt-1"
                  style={{ backgroundColor: "var(--accent-color)" }}
                >
                  Apply Suggested Specs
                </button>
              </CollapsibleSection>
            )}

            {/* Sealed & Ported & PR single chamber volume */}
            {(activeProject.enclosureType === "sealed" || activeProject.enclosureType === "ported" || activeProject.enclosureType === "passive_radiator") && (
              <div>
                <div className="flex justify-between items-center text-xs mb-1">
                  <span className="opacity-70">Box Volume (Vb)</span>
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      value={activeProject.vBox}
                      onChange={(e) => updateActiveProject({ vBox: parseFloat(e.target.value) || 0 })}
                      className="w-16 border rounded px-1.5 py-0.5 text-right font-mono focus:outline-none text-xs"
                      style={{
                        backgroundColor: "var(--bg-color)",
                        borderColor: "var(--graph-grid-color)",
                        color: "var(--accent-color)",
                      }}
                    />
                    <span className="opacity-60">L</span>
                  </div>
                </div>
                <input
                  type="range"
                  min="2"
                  max={Math.max(200, activeProject.driver.vas * 1.5)}
                  step="0.5"
                  value={activeProject.vBox}
                  onChange={(e) => updateActiveProject({ vBox: parseFloat(e.target.value) })}
                  className="w-full h-1.5 rounded-lg appearance-none cursor-pointer mt-2"
                  style={{ accentColor: "var(--accent-color)", backgroundColor: "var(--bg-color)" }}
                />
              </div>
            )}

            {/* Ported Controls */}
            {activeProject.enclosureType === "ported" && (
              <>
                <div>
                  <div className="flex justify-between items-center text-xs mb-1">
                    <span className="opacity-70">Tuning Freq (Fb)</span>
                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        value={activeProject.tuningFreq}
                        onChange={(e) => updateActiveProject({ tuningFreq: parseFloat(e.target.value) || 0 })}
                        className="w-16 border rounded px-1.5 py-0.5 text-right font-mono focus:outline-none text-xs"
                        style={{
                          backgroundColor: "var(--bg-color)",
                          borderColor: "var(--graph-grid-color)",
                          color: "var(--accent-color)",
                        }}
                      />
                      <span className="opacity-60">Hz</span>
                    </div>
                  </div>
                  <input
                    type="range"
                    min="15"
                    max="100"
                    step="0.5"
                    value={activeProject.tuningFreq}
                    onChange={(e) => updateActiveProject({ tuningFreq: parseFloat(e.target.value) })}
                    className="w-full h-1.5 rounded-lg appearance-none cursor-pointer mt-2"
                    style={{ accentColor: "var(--accent-color)", backgroundColor: "var(--bg-color)" }}
                  />
                </div>
                <div>
                  <label className="text-xs opacity-70 block mb-1">Port Shape</label>
                  <select
                    value={activeProject.portShape}
                    onChange={(e) => updateActiveProject({ portShape: e.target.value as "circular" | "rectangular" })}
                    className="w-full border rounded px-2.5 py-1.5 text-xs focus:outline-none"
                    style={{
                      backgroundColor: "var(--bg-color)",
                      borderColor: "var(--graph-grid-color)",
                      color: "var(--text-color)",
                    }}
                  >
                    <option value="circular">Circular / Cylinder</option>
                    <option value="rectangular">Rectangular / Slot</option>
                  </select>
                </div>

                <div>
                  <div className="flex justify-between items-center text-xs mb-1">
                    <span className="opacity-70">Port Count</span>
                    <input
                      type="number"
                      min="1"
                      max="8"
                      value={activeProject.portCount}
                      onChange={(e) => updateActiveProject({ portCount: Math.max(1, Math.min(8, parseInt(e.target.value) || 1)) })}
                      className="w-16 border rounded px-1.5 py-0.5 text-right font-mono focus:outline-none text-xs"
                      style={{
                        backgroundColor: "var(--bg-color)",
                        borderColor: "var(--graph-grid-color)",
                        color: "var(--accent-color)",
                      }}
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs opacity-70 block mb-1">Port Losses (Q factor)</label>
                  <select
                    value={activeProject.portQ}
                    onChange={(e) => updateActiveProject({ portQ: parseFloat(e.target.value) })}
                    className="w-full border rounded px-2.5 py-1.5 text-xs focus:outline-none"
                    style={{ backgroundColor: "var(--bg-color)", borderColor: "var(--graph-grid-color)", color: "var(--text-color)" }}
                  >
                    <option value={50}>Circular port (Q = 50)</option>
                    <option value={30}>Slot port (Q = 30)</option>
                    <option value={100}>Low-loss / rigid port (Q = 100)</option>
                  </select>
                </div>

                {activeProject.portShape === "circular" ? (
                  <div>
                    <div className="flex justify-between items-center text-xs mb-1">
                      <span className="opacity-70">Port Diameter</span>
                      <div className="flex items-center gap-1">
                        <input
                          type="number"
                          step="0.1"
                          value={activeProject.portDiameter}
                          onChange={(e) => updateActiveProject({ portDiameter: parseFloat(e.target.value) || 0 })}
                          className="w-16 border rounded px-1.5 py-0.5 text-right font-mono focus:outline-none text-xs"
                          style={{
                            backgroundColor: "var(--bg-color)",
                            borderColor: "var(--graph-grid-color)",
                            color: "var(--accent-color)",
                          }}
                        />
                        <span className="opacity-60">cm</span>
                      </div>
                    </div>
                    <input
                      type="range"
                      min="3"
                      max="30"
                      step="0.1"
                      value={activeProject.portDiameter}
                      onChange={(e) => updateActiveProject({ portDiameter: parseFloat(e.target.value) })}
                      className="w-full h-1.5 rounded-lg appearance-none cursor-pointer mt-2"
                      style={{ accentColor: "var(--accent-color)", backgroundColor: "var(--bg-color)" }}
                    />
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <label className="opacity-70 block mb-1">Slot Width (cm)</label>
                      <input
                        type="number"
                        step="0.5"
                        value={activeProject.portWidth}
                        onChange={(e) => updateActiveProject({ portWidth: parseFloat(e.target.value) || 0 })}
                        className="w-full border rounded px-2 py-1 text-right font-mono focus:outline-none text-xs"
                        style={{
                          backgroundColor: "var(--bg-color)",
                          borderColor: "var(--graph-grid-color)",
                          color: "var(--accent-color)",
                        }}
                      />
                    </div>
                    <div>
                      <label className="opacity-70 block mb-1">Slot Height (cm)</label>
                      <input
                        type="number"
                        step="0.5"
                        value={activeProject.portHeight}
                        onChange={(e) => updateActiveProject({ portHeight: parseFloat(e.target.value) || 0 })}
                        className="w-full border rounded px-2 py-1 text-right font-mono focus:outline-none text-xs"
                        style={{
                          backgroundColor: "var(--bg-color)",
                          borderColor: "var(--graph-grid-color)",
                          color: "var(--accent-color)",
                        }}
                      />
                    </div>
                  </div>
                )}

                {/* Port Length HUD & Calculator */}
                <div className="flex flex-col gap-2.5 mt-1 border-t pt-3" style={{ borderColor: "var(--graph-grid-color)" }}>
                  <div className="border border-dashed rounded p-2.5 flex flex-col gap-1 text-2xs" style={{ borderColor: "var(--graph-grid-color)" }}>
                    <div className="flex justify-between font-semibold">
                      <span className="opacity-75">Required Length:</span>
                      <span style={{ color: "var(--accent-color)" }}>{calculatedPortLength.toFixed(1)} cm</span>
                    </div>
                    <div className="opacity-65 text-2xs">
                      Length represents the tube/slot length for *each* port to achieve Fb = {activeProject.tuningFreq}Hz.
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handleAutoCalculatePort}
                    className="w-full py-2 rounded text-xs font-semibold tracking-wide transition text-white hover:shadow-md cursor-pointer hover:brightness-110"
                    style={{ backgroundColor: "var(--accent-color)" }}
                  >
                    Auto-Calculate Venting
                  </button>
                </div>

                {/* Second port group */}
                <div className="border rounded p-2.5 flex flex-col gap-2 text-xs" style={{ backgroundColor: "var(--bg-color)", borderColor: "var(--graph-grid-color)" }}>
                  <div className="flex justify-between items-center">
                    <span className="font-semibold opacity-80">Second Port Group</span>
                    <label className="flex items-center gap-1.5 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={activeProject.port2Enabled}
                        onChange={(e) => updateActiveProject({ port2Enabled: e.target.checked })}
                        className="w-3.5 h-3.5"
                      />
                      <span className="opacity-70">{activeProject.port2Enabled ? "Enabled" : "Disabled"}</span>
                    </label>
                  </div>
                  {activeProject.port2Enabled && (
                    <div className="flex flex-col gap-2">
                      <div className="flex justify-between items-center">
                        <span className="opacity-70">Port Shape</span>
                        <select
                          value={activeProject.port2Shape}
                          onChange={(e) => updateActiveProject({ port2Shape: e.target.value as "circular" | "rectangular" })}
                          className="border rounded px-1.5 py-0.5 text-xs focus:outline-none"
                          style={{ backgroundColor: "var(--sidebar-color)", borderColor: "var(--graph-grid-color)", color: "var(--text-color)" }}
                        >
                          <option value="circular">Circular</option>
                          <option value="rectangular">Rectangular / Slot</option>
                        </select>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="opacity-70">Count</span>
                        <input
                          type="number"
                          min="1"
                          max="8"
                          value={activeProject.port2Count}
                          onChange={(e) => updateActiveProject({ port2Count: Math.max(1, parseInt(e.target.value) || 1) })}
                          className="w-16 border rounded px-1.5 py-0.5 text-right font-mono focus:outline-none text-xs"
                          style={{ backgroundColor: "var(--sidebar-color)", borderColor: "var(--graph-grid-color)", color: "var(--accent-color)" }}
                        />
                      </div>
                      {activeProject.port2Shape === "circular" ? (
                        <div className="flex justify-between items-center">
                          <span className="opacity-70">Diameter</span>
                          <div className="flex items-center gap-1">
                            <input
                              type="number"
                              step="0.1"
                              value={activeProject.port2Diameter}
                              onChange={(e) => updateActiveProject({ port2Diameter: parseFloat(e.target.value) || 0 })}
                              className="w-16 border rounded px-1.5 py-0.5 text-right font-mono focus:outline-none text-xs"
                              style={{ backgroundColor: "var(--sidebar-color)", borderColor: "var(--graph-grid-color)", color: "var(--accent-color)" }}
                            />
                            <span className="opacity-60">cm</span>
                          </div>
                        </div>
                      ) : (
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="opacity-70 block mb-0.5">Width (cm)</label>
                            <input
                              type="number"
                              step="0.5"
                              value={activeProject.port2Width}
                              onChange={(e) => updateActiveProject({ port2Width: parseFloat(e.target.value) || 0 })}
                              className="w-full border rounded px-2 py-1 text-right font-mono focus:outline-none text-xs"
                              style={{ backgroundColor: "var(--sidebar-color)", borderColor: "var(--graph-grid-color)", color: "var(--accent-color)" }}
                            />
                          </div>
                          <div>
                            <label className="opacity-70 block mb-0.5">Height (cm)</label>
                            <input
                              type="number"
                              step="0.5"
                              value={activeProject.port2Height}
                              onChange={(e) => updateActiveProject({ port2Height: parseFloat(e.target.value) || 0 })}
                              className="w-full border rounded px-2 py-1 text-right font-mono focus:outline-none text-xs"
                              style={{ backgroundColor: "var(--sidebar-color)", borderColor: "var(--graph-grid-color)", color: "var(--accent-color)" }}
                            />
                          </div>
                        </div>
                      )}
                      <div className="opacity-60 text-2xs">
                        Both port groups share the same computed length ({calculatedPortLength.toFixed(1)} cm) from combined total area.
                      </div>
                    </div>
                  )}
                </div>
              </>
            )}

            {/* 4th-Order Bandpass Controls */}
            {activeProject.enclosureType === "bandpass4" && (
              <div className="flex flex-col gap-3 text-xs">
                <div>
                  <label className="text-xs opacity-70 block mb-1">Port Losses (Q factor)</label>
                  <select
                    value={activeProject.portQ}
                    onChange={(e) => updateActiveProject({ portQ: parseFloat(e.target.value) })}
                    className="w-full border rounded px-2.5 py-1.5 text-xs focus:outline-none"
                    style={{ backgroundColor: "var(--bg-color)", borderColor: "var(--graph-grid-color)", color: "var(--text-color)" }}
                  >
                    <option value={50}>Circular port (Q = 50)</option>
                    <option value={30}>Slot port (Q = 30)</option>
                    <option value={100}>Low-loss / rigid port (Q = 100)</option>
                  </select>
                </div>
                <div className="border rounded p-2.5" style={{ backgroundColor: "var(--bg-color)", borderColor: "var(--graph-grid-color)" }}>
                  <span className="font-semibold text-xs opacity-80 block mb-2">Rear Chamber (Sealed)</span>
                  <div className="flex justify-between items-center mb-1">
                    <span className="opacity-70">Volume (Vr)</span>
                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        value={activeProject.vRear}
                        onChange={(e) => updateActiveProject({ vRear: parseFloat(e.target.value) || 0 })}
                        className="w-16 border rounded px-1.5 py-0.5 text-right font-mono focus:outline-none text-xs"
                        style={{ backgroundColor: "var(--sidebar-color)", borderColor: "var(--graph-grid-color)", color: "var(--accent-color)" }}
                      />
                      <span className="opacity-60">L</span>
                    </div>
                  </div>
                </div>

                <div className="border rounded p-2.5" style={{ backgroundColor: "var(--bg-color)", borderColor: "var(--graph-grid-color)" }}>
                  <span className="font-semibold text-xs opacity-80 block mb-2">Front Chamber (Ported)</span>
                  <div className="flex justify-between items-center mb-2">
                    <span className="opacity-70">Volume (Vf)</span>
                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        value={activeProject.vFront}
                        onChange={(e) => updateActiveProject({ vFront: parseFloat(e.target.value) || 0 })}
                        className="w-16 border rounded px-1.5 py-0.5 text-right font-mono focus:outline-none text-xs"
                        style={{ backgroundColor: "var(--sidebar-color)", borderColor: "var(--graph-grid-color)", color: "var(--accent-color)" }}
                      />
                      <span className="opacity-60">L</span>
                    </div>
                  </div>
                  <div className="flex justify-between items-center mb-2">
                    <span className="opacity-70">Tuning (Fb)</span>
                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        value={activeProject.frontTuningFreq}
                        onChange={(e) => updateActiveProject({ frontTuningFreq: parseFloat(e.target.value) || 0 })}
                        className="w-16 border rounded px-1.5 py-0.5 text-right font-mono focus:outline-none text-xs"
                        style={{ backgroundColor: "var(--sidebar-color)", borderColor: "var(--graph-grid-color)", color: "var(--accent-color)" }}
                      />
                      <span className="opacity-60">Hz</span>
                    </div>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="opacity-70">Port Diameter</span>
                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        step="0.1"
                        value={activeProject.frontPortDiameter}
                        onChange={(e) => updateActiveProject({ frontPortDiameter: parseFloat(e.target.value) || 0 })}
                        className="w-16 border rounded px-1.5 py-0.5 text-right font-mono focus:outline-none text-xs"
                        style={{ backgroundColor: "var(--sidebar-color)", borderColor: "var(--graph-grid-color)", color: "var(--accent-color)" }}
                      />
                      <span className="opacity-60">cm</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* 6th-Order Parallel Bandpass Controls */}
            {activeProject.enclosureType === "bandpass6_parallel" && (
              <div className="flex flex-col gap-3 text-xs">
                <div>
                  <label className="text-xs opacity-70 block mb-1">Port Losses (Q factor)</label>
                  <select
                    value={activeProject.portQ}
                    onChange={(e) => updateActiveProject({ portQ: parseFloat(e.target.value) })}
                    className="w-full border rounded px-2.5 py-1.5 text-xs focus:outline-none"
                    style={{ backgroundColor: "var(--bg-color)", borderColor: "var(--graph-grid-color)", color: "var(--text-color)" }}
                  >
                    <option value={50}>Circular port (Q = 50)</option>
                    <option value={30}>Slot port (Q = 30)</option>
                    <option value={100}>Low-loss / rigid port (Q = 100)</option>
                  </select>
                </div>
                <div className="border rounded p-2.5" style={{ backgroundColor: "var(--bg-color)", borderColor: "var(--graph-grid-color)" }}>
                  <span className="font-semibold text-xs opacity-80 block mb-2">Rear Chamber (Ported)</span>
                  <div className="flex justify-between items-center mb-2">
                    <span className="opacity-70">Volume (Vr)</span>
                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        value={activeProject.vRear}
                        onChange={(e) => updateActiveProject({ vRear: parseFloat(e.target.value) || 0 })}
                        className="w-16 border rounded px-1.5 py-0.5 text-right font-mono focus:outline-none text-xs"
                        style={{ backgroundColor: "var(--sidebar-color)", borderColor: "var(--graph-grid-color)", color: "var(--accent-color)" }}
                      />
                      <span className="opacity-60">L</span>
                    </div>
                  </div>
                  <div className="flex justify-between items-center mb-2">
                    <span className="opacity-70">Tuning (Fb,rear)</span>
                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        value={activeProject.rearTuningFreq}
                        onChange={(e) => updateActiveProject({ rearTuningFreq: parseFloat(e.target.value) || 0 })}
                        className="w-16 border rounded px-1.5 py-0.5 text-right font-mono focus:outline-none text-xs"
                        style={{ backgroundColor: "var(--sidebar-color)", borderColor: "var(--graph-grid-color)", color: "var(--accent-color)" }}
                      />
                      <span className="opacity-60">Hz</span>
                    </div>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="opacity-70">Port Diameter</span>
                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        step="0.1"
                        value={activeProject.rearPortDiameter}
                        onChange={(e) => updateActiveProject({ rearPortDiameter: parseFloat(e.target.value) || 0 })}
                        className="w-16 border rounded px-1.5 py-0.5 text-right font-mono focus:outline-none text-xs"
                        style={{ backgroundColor: "var(--sidebar-color)", borderColor: "var(--graph-grid-color)", color: "var(--accent-color)" }}
                      />
                      <span className="opacity-60">cm</span>
                    </div>
                  </div>
                </div>

                <div className="border rounded p-2.5" style={{ backgroundColor: "var(--bg-color)", borderColor: "var(--graph-grid-color)" }}>
                  <span className="font-semibold text-xs opacity-80 block mb-2">Front Chamber (Ported)</span>
                  <div className="flex justify-between items-center mb-2">
                    <span className="opacity-70">Volume (Vf)</span>
                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        value={activeProject.vFront}
                        onChange={(e) => updateActiveProject({ vFront: parseFloat(e.target.value) || 0 })}
                        className="w-16 border rounded px-1.5 py-0.5 text-right font-mono focus:outline-none text-xs"
                        style={{ backgroundColor: "var(--sidebar-color)", borderColor: "var(--graph-grid-color)", color: "var(--accent-color)" }}
                      />
                      <span className="opacity-60">L</span>
                    </div>
                  </div>
                  <div className="flex justify-between items-center mb-2">
                    <span className="opacity-70">Tuning (Fb,front)</span>
                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        value={activeProject.frontTuningFreq}
                        onChange={(e) => updateActiveProject({ frontTuningFreq: parseFloat(e.target.value) || 0 })}
                        className="w-16 border rounded px-1.5 py-0.5 text-right font-mono focus:outline-none text-xs"
                        style={{ backgroundColor: "var(--sidebar-color)", borderColor: "var(--graph-grid-color)", color: "var(--accent-color)" }}
                      />
                      <span className="opacity-60">Hz</span>
                    </div>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="opacity-70">Port Diameter</span>
                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        step="0.1"
                        value={activeProject.frontPortDiameter}
                        onChange={(e) => updateActiveProject({ frontPortDiameter: parseFloat(e.target.value) || 0 })}
                        className="w-16 border rounded px-1.5 py-0.5 text-right font-mono focus:outline-none text-xs"
                        style={{ backgroundColor: "var(--sidebar-color)", borderColor: "var(--graph-grid-color)", color: "var(--accent-color)" }}
                      />
                      <span className="opacity-60">cm</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* 6th-Order Series Bandpass Controls */}
            {activeProject.enclosureType === "bandpass6_series" && (
              <div className="flex flex-col gap-3 text-xs">
                <div>
                  <label className="text-xs opacity-70 block mb-1">Port Losses (Q factor)</label>
                  <select
                    value={activeProject.portQ}
                    onChange={(e) => updateActiveProject({ portQ: parseFloat(e.target.value) })}
                    className="w-full border rounded px-2.5 py-1.5 text-xs focus:outline-none"
                    style={{ backgroundColor: "var(--bg-color)", borderColor: "var(--graph-grid-color)", color: "var(--text-color)" }}
                  >
                    <option value={50}>Circular port (Q = 50)</option>
                    <option value={30}>Slot port (Q = 30)</option>
                    <option value={100}>Low-loss / rigid port (Q = 100)</option>
                  </select>
                </div>
                <div className="border rounded p-2.5" style={{ backgroundColor: "var(--bg-color)", borderColor: "var(--graph-grid-color)" }}>
                  <span className="font-semibold text-xs opacity-80 block mb-2">Rear Chamber (Vented into Front)</span>
                  <div className="flex justify-between items-center mb-2">
                    <span className="opacity-70">Volume (Vr)</span>
                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        value={activeProject.vRear}
                        onChange={(e) => updateActiveProject({ vRear: parseFloat(e.target.value) || 0 })}
                        className="w-16 border rounded px-1.5 py-0.5 text-right font-mono focus:outline-none text-xs"
                        style={{ backgroundColor: "var(--sidebar-color)", borderColor: "var(--graph-grid-color)", color: "var(--accent-color)" }}
                      />
                      <span className="opacity-60">L</span>
                    </div>
                  </div>
                  <div className="flex justify-between items-center mb-2">
                    <span className="opacity-70">Internal Tuning</span>
                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        value={activeProject.rearTuningFreq}
                        onChange={(e) => updateActiveProject({ rearTuningFreq: parseFloat(e.target.value) || 0 })}
                        className="w-16 border rounded px-1.5 py-0.5 text-right font-mono focus:outline-none text-xs"
                        style={{ backgroundColor: "var(--sidebar-color)", borderColor: "var(--graph-grid-color)", color: "var(--accent-color)" }}
                      />
                      <span className="opacity-60">Hz</span>
                    </div>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="opacity-70">Internal Port Diam</span>
                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        step="0.1"
                        value={activeProject.internalPortDiameter}
                        onChange={(e) => updateActiveProject({ internalPortDiameter: parseFloat(e.target.value) || 0 })}
                        className="w-16 border rounded px-1.5 py-0.5 text-right font-mono focus:outline-none text-xs"
                        style={{ backgroundColor: "var(--sidebar-color)", borderColor: "var(--graph-grid-color)", color: "var(--accent-color)" }}
                      />
                      <span className="opacity-60">cm</span>
                    </div>
                  </div>
                </div>

                <div className="border rounded p-2.5" style={{ backgroundColor: "var(--bg-color)", borderColor: "var(--graph-grid-color)" }}>
                  <span className="font-semibold text-xs opacity-80 block mb-2">Front Chamber (Vented Outside)</span>
                  <div className="flex justify-between items-center mb-2">
                    <span className="opacity-70">Volume (Vf)</span>
                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        value={activeProject.vFront}
                        onChange={(e) => updateActiveProject({ vFront: parseFloat(e.target.value) || 0 })}
                        className="w-16 border rounded px-1.5 py-0.5 text-right font-mono focus:outline-none text-xs"
                        style={{ backgroundColor: "var(--sidebar-color)", borderColor: "var(--graph-grid-color)", color: "var(--accent-color)" }}
                      />
                      <span className="opacity-60">L</span>
                    </div>
                  </div>
                  <div className="flex justify-between items-center mb-2">
                    <span className="opacity-70">Front Tuning (Fb)</span>
                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        value={activeProject.frontTuningFreq}
                        onChange={(e) => updateActiveProject({ frontTuningFreq: parseFloat(e.target.value) || 0 })}
                        className="w-16 border rounded px-1.5 py-0.5 text-right font-mono focus:outline-none text-xs"
                        style={{ backgroundColor: "var(--sidebar-color)", borderColor: "var(--graph-grid-color)", color: "var(--accent-color)" }}
                      />
                      <span className="opacity-60">Hz</span>
                    </div>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="opacity-70">Front Port Diam</span>
                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        step="0.1"
                        value={activeProject.frontPortDiameter}
                        onChange={(e) => updateActiveProject({ frontPortDiameter: parseFloat(e.target.value) || 0 })}
                        className="w-16 border rounded px-1.5 py-0.5 text-right font-mono focus:outline-none text-xs"
                        style={{ backgroundColor: "var(--sidebar-color)", borderColor: "var(--graph-grid-color)", color: "var(--accent-color)" }}
                      />
                      <span className="opacity-60">cm</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Passive Radiator Controls */}
            {activeProject.enclosureType === "passive_radiator" && (
              <div className="flex flex-col gap-2.5 border rounded p-2.5 text-xs" style={{ backgroundColor: "var(--bg-color)", borderColor: "var(--graph-grid-color)" }}>
                <span className="font-semibold text-xs opacity-80 block mb-1">Passive Radiator Parameters</span>
                <div className="flex justify-between items-center">
                  <span className="opacity-70">PR Moving Mass (Mms)</span>
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      value={activeProject.prMms}
                      onChange={(e) => updateActiveProject({ prMms: parseFloat(e.target.value) || 0 })}
                      className="w-16 border rounded px-1.5 py-0.5 text-right font-mono focus:outline-none text-xs"
                      style={{ backgroundColor: "var(--sidebar-color)", borderColor: "var(--graph-grid-color)", color: "var(--accent-color)" }}
                    />
                    <span className="opacity-60">g</span>
                  </div>
                </div>
                <div className="flex justify-between items-center">
                  <span className="opacity-70">PR Piston Area (Sd)</span>
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      value={activeProject.prSd}
                      onChange={(e) => updateActiveProject({ prSd: parseFloat(e.target.value) || 0 })}
                      className="w-16 border rounded px-1.5 py-0.5 text-right font-mono focus:outline-none text-xs"
                      style={{ backgroundColor: "var(--sidebar-color)", borderColor: "var(--graph-grid-color)", color: "var(--accent-color)" }}
                    />
                    <span className="opacity-60">cm²</span>
                  </div>
                </div>
                <div className="flex justify-between items-center">
                  <span className="opacity-70">PR Resonance (Fs)</span>
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      value={activeProject.prFs}
                      onChange={(e) => updateActiveProject({ prFs: parseFloat(e.target.value) || 0 })}
                      className="w-16 border rounded px-1.5 py-0.5 text-right font-mono focus:outline-none text-xs"
                      style={{ backgroundColor: "var(--sidebar-color)", borderColor: "var(--graph-grid-color)", color: "var(--accent-color)" }}
                    />
                    <span className="opacity-60">Hz</span>
                  </div>
                </div>
                <div className="flex justify-between items-center">
                  <span className="opacity-70">PR Mechanical Q (Qms)</span>
                  <input
                    type="number"
                    step="0.5"
                    value={activeProject.prQms}
                    onChange={(e) => updateActiveProject({ prQms: parseFloat(e.target.value) || 0 })}
                    className="w-16 border rounded px-1.5 py-0.5 text-right font-mono focus:outline-none text-xs"
                    style={{ backgroundColor: "var(--sidebar-color)", borderColor: "var(--graph-grid-color)", color: "var(--accent-color)" }}
                  />
                </div>
              </div>
            )}
            </CollapsibleSection>

          {/* ── Custom Topology Builder ── */}
          {activeProject.enclosureType === "custom" && (
            <div className="flex flex-col gap-3 text-xs">

              {/* Topology diagram */}
              <CustomTopologyDiagram topo={activeProject.customTopology} />

                {/* ── REAR SIDE ── */}
                <CollapsibleSection
                  title="Rear Side (behind cone)"
                  open={sidebarSectionState["custom-topology-rear"]}
                  onToggle={() => toggleSidebarSection("custom-topology-rear")}
                >
                  <div className="flex flex-col gap-2">
                    {/* Rear chamber volume */}
                    <div className="flex justify-between items-center">
                      <span className="opacity-70">Chamber Volume</span>
                      <div className="flex items-center gap-1">
                        <input type="number" value={activeProject.customTopology.rear.volume_liters}
                          onChange={e => updateCustomRear({ volume_liters: parseFloat(e.target.value) || 0 })}
                          className="w-16 border rounded px-1.5 py-0.5 text-right font-mono focus:outline-none text-xs"
                          style={{ backgroundColor: "var(--bg-color)", borderColor: "var(--graph-grid-color)", color: "var(--accent-color)" }} />
                        <span className="opacity-60">L</span>
                      </div>
                    </div>

                    {/* Rear port */}
                    {activeProject.customTopology.rear.port ? (
                      <div className="border rounded p-2 flex flex-col gap-1.5" style={{ borderColor: "var(--graph-grid-color)", backgroundColor: "var(--bg-color)" }}>
                        <div className="flex justify-between items-center">
                          <span className="font-semibold opacity-75">Port → Outside</span>
                          <button onClick={() => updateCustomRear({ port: null })}
                            className="text-2xs opacity-50 hover:opacity-100 hover:text-red-400 transition cursor-pointer">✕ Remove</button>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="opacity-60">Tuning (Fb)</span>
                          <div className="flex items-center gap-1">
                            <input type="number" value={activeProject.customTopology.rear.port.tuning_freq}
                              onChange={e => updateCustomRearPort({ tuning_freq: parseFloat(e.target.value) || 0 })}
                              className="w-16 border rounded px-1.5 py-0.5 text-right font-mono focus:outline-none text-xs"
                              style={{ backgroundColor: "var(--sidebar-color)", borderColor: "var(--graph-grid-color)", color: "var(--accent-color)" }} />
                            <span className="opacity-60">Hz</span>
                          </div>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="opacity-60">Diameter</span>
                          <div className="flex items-center gap-1">
                            <input type="number" step="0.1" value={activeProject.customTopology.rear.port.diameter_cm}
                              onChange={e => updateCustomRearPort({ diameter_cm: parseFloat(e.target.value) || 0 })}
                              className="w-16 border rounded px-1.5 py-0.5 text-right font-mono focus:outline-none text-xs"
                              style={{ backgroundColor: "var(--sidebar-color)", borderColor: "var(--graph-grid-color)", color: "var(--accent-color)" }} />
                            <span className="opacity-60">cm</span>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <button onClick={() => updateCustomRear({ port: DEFAULT_PORT, pr: null })}
                        className="text-left text-2xs opacity-60 hover:opacity-100 transition py-0.5 cursor-pointer hover:text-[var(--accent-color)]">
                        + Add Port to Outside
                      </button>
                    )}

                    {/* Rear PR */}
                    {activeProject.customTopology.rear.pr ? (
                      <div className="border rounded p-2 flex flex-col gap-1.5" style={{ borderColor: "var(--graph-grid-color)", backgroundColor: "var(--bg-color)" }}>
                        <div className="flex justify-between items-center">
                          <span className="font-semibold opacity-75">Passive Radiator → Outside</span>
                          <button onClick={() => updateCustomRear({ pr: null })}
                            className="text-2xs opacity-50 hover:opacity-100 hover:text-red-400 transition cursor-pointer">✕ Remove</button>
                        </div>
                        {[
                          { label: "Moving Mass", key: "mms_g" as const, unit: "g" },
                          { label: "Piston Area (Sd)", key: "sd_cm2" as const, unit: "cm²" },
                          { label: "Resonance (Fs)", key: "fs" as const, unit: "Hz" },
                          { label: "Mech. Q (Qms)", key: "qms" as const, unit: "" },
                        ].map(({ label, key, unit }) => (
                          <div key={key} className="flex justify-between items-center">
                            <span className="opacity-60">{label}</span>
                            <div className="flex items-center gap-1">
                              <input type="number" step="any" value={activeProject.customTopology.rear.pr![key]}
                                onChange={e => updateCustomRearPR({ [key]: parseFloat(e.target.value) || 0 })}
                                className="w-16 border rounded px-1.5 py-0.5 text-right font-mono focus:outline-none text-xs"
                                style={{ backgroundColor: "var(--sidebar-color)", borderColor: "var(--graph-grid-color)", color: "var(--accent-color)" }} />
                              {unit && <span className="opacity-60">{unit}</span>}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <button onClick={() => updateCustomRear({ pr: DEFAULT_PR, port: null })}
                        className="text-left text-2xs opacity-60 hover:opacity-100 transition py-0.5 cursor-pointer hover:text-[var(--accent-color)]">
                        + Add Passive Radiator to Outside
                      </button>
                    )}
                  </div>
                </CollapsibleSection>

                {/* ── INTERNAL PORT ── */}
                <CollapsibleSection
                  title="Cross-Connect (Rear ↔ Front)"
                  open={sidebarSectionState["custom-topology-cross-connect"]}
                  onToggle={() => toggleSidebarSection("custom-topology-cross-connect")}
                >
                    {activeProject.customTopology.internal_port ? (
                      <div className="border rounded p-2 flex flex-col gap-1.5" style={{ borderColor: "var(--graph-grid-color)", backgroundColor: "var(--bg-color)" }}>
                        <div className="flex justify-between items-center">
                          <span className="font-semibold opacity-75">Internal Port</span>
                          <button onClick={() => updateActiveProject({ customTopology: { ...activeProject.customTopology, internal_port: null } })}
                            className="text-2xs opacity-50 hover:opacity-100 hover:text-red-400 transition cursor-pointer">✕ Remove</button>
                        </div>
                        <div className="opacity-55 text-2xs mb-0.5">Connects rear chamber to front chamber — creates series bandpass behaviour.</div>
                        <div className="flex justify-between items-center">
                          <span className="opacity-60">Tuning (Fb)</span>
                          <div className="flex items-center gap-1">
                            <input type="number" value={activeProject.customTopology.internal_port.tuning_freq}
                              onChange={e => updateCustomInternalPort({ tuning_freq: parseFloat(e.target.value) || 0 })}
                              className="w-16 border rounded px-1.5 py-0.5 text-right font-mono focus:outline-none text-xs"
                              style={{ backgroundColor: "var(--sidebar-color)", borderColor: "var(--graph-grid-color)", color: "var(--accent-color)" }} />
                            <span className="opacity-60">Hz</span>
                          </div>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="opacity-60">Diameter</span>
                          <div className="flex items-center gap-1">
                            <input type="number" step="0.1" value={activeProject.customTopology.internal_port.diameter_cm}
                              onChange={e => updateCustomInternalPort({ diameter_cm: parseFloat(e.target.value) || 0 })}
                              className="w-16 border rounded px-1.5 py-0.5 text-right font-mono focus:outline-none text-xs"
                              style={{ backgroundColor: "var(--sidebar-color)", borderColor: "var(--graph-grid-color)", color: "var(--accent-color)" }} />
                            <span className="opacity-60">cm</span>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <button onClick={() => updateActiveProject({ customTopology: { ...activeProject.customTopology, internal_port: DEFAULT_PORT } })}
                        className="text-left text-2xs opacity-60 hover:opacity-100 transition py-0.5 cursor-pointer hover:text-[var(--accent-color)]">
                        + Add Internal Port (Rear → Front)
                      </button>
                    )}
                </CollapsibleSection>

                {/* ── FRONT SIDE ── */}
                <CollapsibleSection
                  title="Front Side (in front of cone)"
                  open={sidebarSectionState["custom-topology-front"]}
                  onToggle={() => toggleSidebarSection("custom-topology-front")}
                >
                  <div className="flex flex-col gap-2">
                    {/* Front chamber toggle */}
                    <div className="flex gap-2">
                      <button
                        onClick={() => updateCustomFront({ volume_liters: 0, port: null, pr: null })}
                        className={`flex-1 py-1 rounded text-2xs font-semibold border transition cursor-pointer ${activeProject.customTopology.front.volume_liters === 0
                          ? "border-[var(--accent-color)] text-[var(--accent-color)]"
                          : "opacity-50 border-transparent hover:opacity-80"}`}
                        style={{ backgroundColor: activeProject.customTopology.front.volume_liters === 0 ? "var(--bg-color)" : "transparent" }}>
                        Open Air
                      </button>
                      <button
                        onClick={() => updateCustomFront({ volume_liters: 40 })}
                        className={`flex-1 py-1 rounded text-2xs font-semibold border transition cursor-pointer ${activeProject.customTopology.front.volume_liters > 0
                          ? "border-[var(--accent-color)] text-[var(--accent-color)]"
                          : "opacity-50 border-transparent hover:opacity-80"}`}
                        style={{ backgroundColor: activeProject.customTopology.front.volume_liters > 0 ? "var(--bg-color)" : "transparent" }}>
                        Sealed Chamber
                      </button>
                    </div>

                    {activeProject.customTopology.front.volume_liters === 0 ? (
                      <p className="text-2xs opacity-50">Cone fires directly into the room. Use for sealed or vented designs.</p>
                    ) : (
                      <>
                        <div className="flex justify-between items-center">
                          <span className="opacity-70">Chamber Volume</span>
                          <div className="flex items-center gap-1">
                            <input type="number" value={activeProject.customTopology.front.volume_liters}
                              onChange={e => updateCustomFront({ volume_liters: parseFloat(e.target.value) || 0 })}
                              className="w-16 border rounded px-1.5 py-0.5 text-right font-mono focus:outline-none text-xs"
                              style={{ backgroundColor: "var(--bg-color)", borderColor: "var(--graph-grid-color)", color: "var(--accent-color)" }} />
                            <span className="opacity-60">L</span>
                          </div>
                        </div>

                        {/* Front port */}
                        {activeProject.customTopology.front.port ? (
                          <div className="border rounded p-2 flex flex-col gap-1.5" style={{ borderColor: "var(--graph-grid-color)", backgroundColor: "var(--bg-color)" }}>
                            <div className="flex justify-between items-center">
                              <span className="font-semibold opacity-75">Port → Outside</span>
                              <button onClick={() => updateCustomFront({ port: null })}
                                className="text-2xs opacity-50 hover:opacity-100 hover:text-red-400 transition cursor-pointer">✕ Remove</button>
                            </div>
                            <div className="flex justify-between items-center">
                              <span className="opacity-60">Tuning (Fb)</span>
                              <div className="flex items-center gap-1">
                                <input type="number" value={activeProject.customTopology.front.port.tuning_freq}
                                  onChange={e => updateCustomFrontPort({ tuning_freq: parseFloat(e.target.value) || 0 })}
                                  className="w-16 border rounded px-1.5 py-0.5 text-right font-mono focus:outline-none text-xs"
                                  style={{ backgroundColor: "var(--sidebar-color)", borderColor: "var(--graph-grid-color)", color: "var(--accent-color)" }} />
                                <span className="opacity-60">Hz</span>
                              </div>
                            </div>
                            <div className="flex justify-between items-center">
                              <span className="opacity-60">Diameter</span>
                              <div className="flex items-center gap-1">
                                <input type="number" step="0.1" value={activeProject.customTopology.front.port.diameter_cm}
                                  onChange={e => updateCustomFrontPort({ diameter_cm: parseFloat(e.target.value) || 0 })}
                                  className="w-16 border rounded px-1.5 py-0.5 text-right font-mono focus:outline-none text-xs"
                                  style={{ backgroundColor: "var(--sidebar-color)", borderColor: "var(--graph-grid-color)", color: "var(--accent-color)" }} />
                                <span className="opacity-60">cm</span>
                              </div>
                            </div>
                          </div>
                        ) : (
                          <button onClick={() => updateCustomFront({ port: DEFAULT_PORT, pr: null })}
                            className="text-left text-2xs opacity-60 hover:opacity-100 transition py-0.5 cursor-pointer hover:text-[var(--accent-color)]">
                            + Add Port to Outside
                          </button>
                        )}

                        {/* Front PR */}
                        {activeProject.customTopology.front.pr ? (
                          <div className="border rounded p-2 flex flex-col gap-1.5" style={{ borderColor: "var(--graph-grid-color)", backgroundColor: "var(--bg-color)" }}>
                            <div className="flex justify-between items-center">
                              <span className="font-semibold opacity-75">Passive Radiator → Outside</span>
                              <button onClick={() => updateCustomFront({ pr: null })}
                                className="text-2xs opacity-50 hover:opacity-100 hover:text-red-400 transition cursor-pointer">✕ Remove</button>
                            </div>
                            {[
                              { label: "Moving Mass", key: "mms_g" as const, unit: "g" },
                              { label: "Piston Area (Sd)", key: "sd_cm2" as const, unit: "cm²" },
                              { label: "Resonance (Fs)", key: "fs" as const, unit: "Hz" },
                              { label: "Mech. Q (Qms)", key: "qms" as const, unit: "" },
                            ].map(({ label, key, unit }) => (
                              <div key={key} className="flex justify-between items-center">
                                <span className="opacity-60">{label}</span>
                                <div className="flex items-center gap-1">
                                  <input type="number" step="any" value={activeProject.customTopology.front.pr![key]}
                                    onChange={e => updateCustomFrontPR({ [key]: parseFloat(e.target.value) || 0 })}
                                    className="w-16 border rounded px-1.5 py-0.5 text-right font-mono focus:outline-none text-xs"
                                    style={{ backgroundColor: "var(--sidebar-color)", borderColor: "var(--graph-grid-color)", color: "var(--accent-color)" }} />
                                  {unit && <span className="opacity-60">{unit}</span>}
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <button onClick={() => updateCustomFront({ pr: DEFAULT_PR, port: null })}
                            className="text-left text-2xs opacity-60 hover:opacity-100 transition py-0.5 cursor-pointer hover:text-[var(--accent-color)]">
                            + Add Passive Radiator to Outside
                          </button>
                        )}
                      </>
                    )}
                  </div>
                </CollapsibleSection>

              </div>
            )}
          </div>

          {/* ── Enclosure Dimension Calculator ── */}
            <CollapsibleSection
              title="Dimension Calculator"
              open={sidebarSectionState["dimension-calculator"]}
              onToggle={() => toggleSidebarSection("dimension-calculator")}
            >
              {(() => {
                // ── Vb → LxWxD ──────────────────────────────────────────
                const vbNum   = parseFloat(calcVb)  || 0;
                const rL      = parseFloat(calcRatioL) || 1.618;
                void calcRatioW; // rW = 1 is the reference denominator; formula uses rL and rD only
                const rD      = parseFloat(calcRatioD) || 0.618;
                const vCm3    = vbNum * 1000;
                const wCalc   = vCm3 > 0 ? Math.cbrt(vCm3 / (rL * rD)) : 0;
                const lCalc   = wCalc * rL;
                const dCalc   = wCalc * rD;

                // ── Dims → Vb ───────────────────────────────────────────
                const thMm  = parseFloat(calcThickness) || 18;
                const extL  = parseFloat(calcExtL) || 0;
                const extW  = parseFloat(calcExtW) || 0;
                const extD  = parseFloat(calcExtD) || 0;
                const intL  = Math.max(0, extL - 2 * thMm / 10); // cm
                const intW  = Math.max(0, extW - 2 * thMm / 10);
                const intD  = Math.max(0, extD - 2 * thMm / 10);
                const grossVb = intL * intW * intD / 1000; // litres

                const inputStyle = {
                  backgroundColor: "var(--bg-color)",
                  borderColor: "var(--graph-grid-color)",
                  color: "var(--accent-color)",
                };
                const labelStyle = { color: "var(--text-color)" };

                return (
                  <>
                    {/* Mode tabs */}
                    <div className="flex text-2xs rounded overflow-hidden border" style={{ borderColor: "var(--graph-grid-color)" }}>
                      {(["vb-to-dims", "dims-to-vb"] as const).map(m => (
                        <button key={m} onClick={() => setCalcMode(m)}
                          className={`flex-1 py-1.5 font-semibold cursor-pointer transition ${calcMode === m ? "text-white" : "opacity-60 hover:opacity-100"}`}
                          style={calcMode === m ? { backgroundColor: "var(--accent-color)" } : labelStyle}>
                          {m === "vb-to-dims" ? "Vb → L×W×D" : "L×W×D → Vb"}
                        </button>
                      ))}
                    </div>

                    {calcMode === "vb-to-dims" ? (
                      <div className="flex flex-col gap-2 text-xs">
                        <div className="flex justify-between items-center">
                          <span className="opacity-70" style={labelStyle}>Box Volume</span>
                          <div className="flex items-center gap-1">
                            <input type="number" step="1" value={calcVb} onChange={e => setCalcVb(e.target.value)}
                              className="w-16 border rounded px-1.5 py-0.5 text-right font-mono focus:outline-none"
                              style={inputStyle} />
                            <span className="opacity-60">L</span>
                          </div>
                        </div>
                        <div className="grid grid-cols-3 gap-1.5">
                          {[["L ratio", calcRatioL, setCalcRatioL], ["W ratio", calcRatioW, setCalcRatioW], ["D ratio", calcRatioD, setCalcRatioD]].map(([lbl, val, set]) => (
                            <div key={String(lbl)} className="flex flex-col gap-0.5">
                              <span className="opacity-60 text-2xs" style={labelStyle}>{String(lbl)}</span>
                              <input type="number" step="0.01" value={String(val)}
                                onChange={e => (set as (v: string) => void)(e.target.value)}
                                className="w-full border rounded px-1.5 py-0.5 text-right font-mono focus:outline-none text-2xs"
                                style={inputStyle} />
                            </div>
                          ))}
                        </div>
                        <div className="rounded-lg p-2.5 flex flex-col gap-1 text-2xs font-mono border"
                          style={{ backgroundColor: "var(--sidebar-color)", borderColor: "var(--graph-grid-color)" }}>
                          <div className="flex justify-between">
                            <span className="opacity-60">Length</span>
                            <span style={{ color: "var(--accent-color)" }}>{lCalc.toFixed(1)} cm</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="opacity-60">Width</span>
                            <span style={{ color: "var(--accent-color)" }}>{wCalc.toFixed(1)} cm</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="opacity-60">Depth</span>
                            <span style={{ color: "var(--accent-color)" }}>{dCalc.toFixed(1)} cm</span>
                          </div>
                        </div>
                        <button
                          onClick={() => updateActiveProject({ vBox: vbNum })}
                          className="text-2xs opacity-70 hover:opacity-100 cursor-pointer text-left transition"
                          style={{ color: "var(--accent-color)" }}>
                          ↩ Apply {calcVb} L to active project
                        </button>
                      </div>
                    ) : (
                      <div className="flex flex-col gap-2 text-xs">
                        <div className="grid grid-cols-3 gap-1.5">
                          {[["L (cm)", calcExtL, setCalcExtL], ["W (cm)", calcExtW, setCalcExtW], ["D (cm)", calcExtD, setCalcExtD]].map(([lbl, val, set]) => (
                            <div key={String(lbl)} className="flex flex-col gap-0.5">
                              <span className="opacity-60 text-2xs" style={labelStyle}>{String(lbl)}</span>
                              <input type="number" step="0.5" value={String(val)}
                                onChange={e => (set as (v: string) => void)(e.target.value)}
                                className="w-full border rounded px-1.5 py-0.5 text-right font-mono focus:outline-none text-2xs"
                                style={inputStyle} />
                            </div>
                          ))}
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="opacity-70" style={labelStyle}>Panel thickness</span>
                          <div className="flex items-center gap-1">
                            <input type="number" step="1" value={calcThickness} onChange={e => setCalcThickness(e.target.value)}
                              className="w-14 border rounded px-1.5 py-0.5 text-right font-mono focus:outline-none"
                              style={inputStyle} />
                            <span className="opacity-60">mm</span>
                          </div>
                        </div>
                        <div className="rounded-lg p-2.5 flex flex-col gap-1 text-2xs font-mono border"
                          style={{ backgroundColor: "var(--sidebar-color)", borderColor: "var(--graph-grid-color)" }}>
                          <div className="flex justify-between">
                            <span className="opacity-60">Interior</span>
                            <span className="opacity-80">{intL.toFixed(1)} × {intW.toFixed(1)} × {intD.toFixed(1)} cm</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="opacity-60">Gross Vb</span>
                            <span style={{ color: "var(--accent-color)" }}>{grossVb.toFixed(2)} L</span>
                          </div>
                        </div>
                        <button
                          onClick={() => updateActiveProject({ vBox: parseFloat(grossVb.toFixed(2)) })}
                          className="text-2xs opacity-70 hover:opacity-100 cursor-pointer text-left transition"
                          style={{ color: "var(--accent-color)" }}>
                          ↩ Apply {grossVb.toFixed(2)} L to active project
                        </button>
                      </div>
                    )}
                  </>
                );
              })()}
            </CollapsibleSection>
          </>
          )}



          {/* SPL Settings */}
          {sidebarTab === "signal" && (
            <div className="flex flex-col gap-4">
              <CollapsibleSection
                title="SPL & Output Simulation"
                open={sidebarSectionState["spl-settings"]}
                onToggle={() => toggleSidebarSection("spl-settings")}
              >
              <div>
                <div className="flex justify-between items-center text-xs mb-1">
                  <span className="opacity-70">Total Input Power</span>
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      value={activeProject.inputPower}
                      onChange={(e) => updateActiveProject({ inputPower: parseFloat(e.target.value) || 0 })}
                      className="w-18 border rounded px-1.5 py-0.5 text-right font-mono focus:outline-none text-xs"
                      style={{
                        backgroundColor: "var(--bg-color)",
                        borderColor: "var(--graph-grid-color)",
                        color: "var(--accent-color)",
                      }}
                    />
                    <span className="opacity-60">W</span>
                  </div>
                </div>
                <input
                  type="range"
                  min="1"
                  max={Math.max(100, activeProject.driver.pe * activeProject.numDrivers)}
                  step="5"
                  value={activeProject.inputPower}
                  onChange={(e) => updateActiveProject({ inputPower: parseFloat(e.target.value) })}
                  className="w-full h-1.5 rounded-lg appearance-none cursor-pointer mt-2"
                  style={{ accentColor: "var(--accent-color)", backgroundColor: "var(--bg-color)" }}
                />
              </div>

              <div>
                <label className="text-xs opacity-70 block mb-1">Distance (m)</label>
                <input
                  type="number"
                  step="0.1"
                  min="0.1"
                  value={activeProject.distance}
                  onChange={(e) => updateActiveProject({ distance: parseFloat(e.target.value) || 1.0 })}
                  className="w-full border rounded px-2.5 py-1.5 text-xs font-mono focus:outline-none"
                  style={{
                    backgroundColor: "var(--bg-color)",
                    borderColor: "var(--graph-grid-color)",
                    color: "var(--text-color)",
                  }}
                />
              </div>

              <div>
                <label className="text-xs opacity-70 block mb-1">SPL Environment</label>
                <select
                  value={activeProject.splEnvironment}
                  onChange={(e) => updateActiveProject({ splEnvironment: e.target.value as typeof activeProject.splEnvironment })}
                  className="w-full border rounded px-2.5 py-1.5 text-xs focus:outline-none"
                  style={{ backgroundColor: "var(--bg-color)", borderColor: "var(--graph-grid-color)", color: "var(--text-color)" }}
                >
                  <option value="half_space">Half-space — wall / floor mount</option>
                  <option value="free_field">Free-field — anechoic / elevated (−6 dB)</option>
                  <option value="corner">Corner placement — 3 boundaries (+12 dB)</option>
                </select>
                <p className="text-2xs opacity-50 mt-1">Affects SPL curve only. Gain and excursion are unaffected.</p>
              </div>
              </CollapsibleSection>

              {/* ── EQ Filters ───────────────────────────────────────── */}
              <CollapsibleSection
                title="EQ Filters"
                open={sidebarSectionState["eq-filters"]}
                onToggle={() => toggleSidebarSection("eq-filters")}
                action={
                  <button
                    type="button"
                    onClick={() => setFilters(prev => [...prev, { id: `f-${Date.now()}`, enabled: true, type: "hp", freq: 80, q: 0.707, gain: 0 }])}
                    className="text-2xs px-2 py-0.5 rounded border transition hover:opacity-90 cursor-pointer"
                    style={{ borderColor: "var(--accent-color)", color: "var(--accent-color)", backgroundColor: "var(--bg-color)" }}
                  >
                    + Add
                  </button>
                }
              >
                {filters.length === 0 && (
                  <p className="text-2xs opacity-45 text-center py-1.5">No filters — add HP/LP or peak EQ to shape the response.</p>
                )}

                <div className="flex flex-col gap-2">
                  {filters.map((flt, idx) => (
                    <div
                      key={flt.id}
                      className="border rounded p-2 flex flex-col gap-1.5"
                      style={{ backgroundColor: "var(--bg-color)", borderColor: flt.enabled ? "var(--accent-color)" : "var(--graph-grid-color)" }}
                    >
                      <div className="flex items-center gap-1.5">
                        <input
                          type="checkbox" checked={flt.enabled}
                          onChange={e => setFilters(prev => prev.map((f, i) => i === idx ? { ...f, enabled: e.target.checked } : f))}
                          className="rounded accent-[var(--accent-color)] h-3 w-3 cursor-pointer shrink-0"
                        />
                        <select
                          value={flt.type}
                          onChange={e => setFilters(prev => prev.map((f, i) => i === idx ? { ...f, type: e.target.value as EqFilter["type"] } : f))}
                          className="flex-1 border rounded px-1 py-0.5 text-2xs focus:outline-none cursor-pointer"
                          style={{ backgroundColor: "var(--sidebar-color)", borderColor: "var(--graph-grid-color)", color: "var(--text-color)" }}
                        >
                          <option value="hp">HP (2nd order)</option>
                          <option value="lp">LP (2nd order)</option>
                          <option value="peak">Peak EQ</option>
                          <option value="lowshelf">Low Shelf</option>
                          <option value="highshelf">High Shelf</option>
                        </select>
                        <button
                          type="button"
                          onClick={() => setFilters(prev => prev.filter((_, i) => i !== idx))}
                          className="text-2xs opacity-50 hover:opacity-100 hover:text-red-400 transition shrink-0 cursor-pointer px-0.5"
                        >✕</button>
                      </div>
                      <div className="grid grid-cols-3 gap-1 text-2xs">
                        <div className="flex flex-col gap-0.5">
                          <span className="opacity-55">Freq (Hz)</span>
                          <input
                            type="number" min="5" max="20000" step="1" value={flt.freq}
                            onChange={e => setFilters(prev => prev.map((f, i) => i === idx ? { ...f, freq: parseFloat(e.target.value) || 100 } : f))}
                            className="w-full border rounded px-1 py-0.5 text-right font-mono focus:outline-none text-2xs"
                            style={{ backgroundColor: "var(--sidebar-color)", borderColor: "var(--graph-grid-color)", color: "var(--accent-color)" }}
                          />
                        </div>
                        <div className="flex flex-col gap-0.5">
                          <span className="opacity-55">Q</span>
                          <input
                            type="number" min="0.1" max="20" step="0.05" value={flt.q}
                            onChange={e => setFilters(prev => prev.map((f, i) => i === idx ? { ...f, q: parseFloat(e.target.value) || 0.707 } : f))}
                            className="w-full border rounded px-1 py-0.5 text-right font-mono focus:outline-none text-2xs"
                            style={{ backgroundColor: "var(--sidebar-color)", borderColor: "var(--graph-grid-color)", color: "var(--accent-color)" }}
                          />
                        </div>
                        {(flt.type === "peak" || flt.type === "lowshelf" || flt.type === "highshelf") ? (
                          <div className="flex flex-col gap-0.5">
                            <span className="opacity-55">Gain (dB)</span>
                            <input
                              type="number" min="-30" max="30" step="0.5" value={flt.gain}
                              onChange={e => setFilters(prev => prev.map((f, i) => i === idx ? { ...f, gain: parseFloat(e.target.value) || 0 } : f))}
                              className="w-full border rounded px-1 py-0.5 text-right font-mono focus:outline-none text-2xs"
                              style={{ backgroundColor: "var(--sidebar-color)", borderColor: "var(--graph-grid-color)", color: flt.gain > 0 ? "#10b981" : flt.gain < 0 ? "#f87171" : "var(--accent-color)" }}
                            />
                          </div>
                        ) : <div />}
                      </div>
                    </div>
                  ))}
                </div>

                {filters.some(f => f.enabled) && (
                  <p className="text-2xs opacity-50 mt-1.5">— — dashed: filtered &nbsp;·· dotted: +room</p>
                )}
              </CollapsibleSection>

              {/* ── Passive Crossover ───────────────────────────────── */}
              <CollapsibleSection
                title="Passive Crossover"
                open={sidebarSectionState["passive-crossover"]}
                onToggle={() => toggleSidebarSection("passive-crossover")}
                action={
                  <button
                    type="button"
                    onClick={() => updateActiveProject({ passiveXoEnabled: !activeProject.passiveXoEnabled })}
                    className={`text-2xs font-bold px-2.5 py-0.5 rounded border transition cursor-pointer ${activeProject.passiveXoEnabled ? "border-[var(--accent-color)] text-[var(--accent-color)]" : "opacity-55 border-current"}`}
                    style={{ backgroundColor: "var(--bg-color)" }}
                  >
                    {activeProject.passiveXoEnabled ? "ON" : "OFF"}
                  </button>
                }
              >
                {!activeProject.passiveXoEnabled && (
                  <p className="text-2xs opacity-45 text-center py-1.5">Enable to simulate passive crossover network interaction with driver impedance.</p>
                )}

                {activeProject.passiveXoEnabled && (
                  <div className="flex flex-col gap-2.5 text-2xs">
                    {/* Validation Warning if Le is missing or 0 */}
                    {activeProject.driver.le <= 0 && (
                      <div className="p-2 rounded border text-2xs" style={{ backgroundColor: "var(--bg-color)", borderColor: "var(--warning-color)", color: "var(--warning-color)" }}>
                        ⚠ Driver inductance Le is 0. A typical ratio of {activeProject.driver.re > 0 ? (activeProject.driver.re * 0.15).toFixed(2) : "0.60"} mH will be estimated.
                      </div>
                    )}

                    <div className="flex flex-col gap-1">
                      <span className="opacity-55">Crossover Type</span>
                      <select
                        value={activeProject.passiveXoType}
                        onChange={(e) => updateActiveProject({ passiveXoType: e.target.value as any })}
                        className="w-full border rounded px-2.5 py-1.5 text-xs focus:outline-none"
                        style={{ backgroundColor: "var(--bg-color)", borderColor: "var(--graph-grid-color)", color: "var(--text-color)" }}
                      >
                        <option value="lowpass_1st">1st-Order Lowpass (Inductor L)</option>
                        <option value="highpass_1st">1st-Order Highpass (Capacitor C)</option>
                        <option value="lowpass_2nd">2nd-Order Lowpass (L-C Network)</option>
                        <option value="highpass_2nd">2nd-Order Highpass (C-L Network)</option>
                      </select>
                    </div>

                    <div className="grid grid-cols-3 gap-2">
                      {/* Inductance Input: shown for lowpass, or 2nd order highpass */}
                      {(activeProject.passiveXoType.includes("lowpass") || activeProject.passiveXoType.includes("2nd")) && (
                        <div className="flex flex-col gap-0.5">
                          <span className="opacity-55">Inductance (mH)</span>
                          <input
                            type="number"
                            min="0.01"
                            max="50"
                            step="0.05"
                            value={activeProject.passiveXoInductance}
                            onChange={(e) => updateActiveProject({ passiveXoInductance: parseFloat(e.target.value) || 0.1 })}
                            className="w-full border rounded px-1.5 py-1 text-right font-mono focus:outline-none text-2xs"
                            style={{ backgroundColor: "var(--bg-color)", borderColor: "var(--graph-grid-color)", color: "var(--accent-color)" }}
                          />
                        </div>
                      )}

                      {/* Capacitance Input: shown for highpass, or 2nd order lowpass */}
                      {(activeProject.passiveXoType.includes("highpass") || activeProject.passiveXoType.includes("2nd")) && (
                        <div className="flex flex-col gap-0.5">
                          <span className="opacity-55">Capacitance (µF)</span>
                          <input
                            type="number"
                            min="0.1"
                            max="1000"
                            step="1.0"
                            value={activeProject.passiveXoCapacitance}
                            onChange={(e) => updateActiveProject({ passiveXoCapacitance: parseFloat(e.target.value) || 1.0 })}
                            className="w-full border rounded px-1.5 py-1 text-right font-mono focus:outline-none text-2xs"
                            style={{ backgroundColor: "var(--bg-color)", borderColor: "var(--graph-grid-color)", color: "var(--accent-color)" }}
                          />
                        </div>
                      )}

                      {/* Inductor DCR Input: shown if inductance is shown */}
                      {(activeProject.passiveXoType.includes("lowpass") || activeProject.passiveXoType.includes("2nd")) && (
                        <div className="flex flex-col gap-0.5">
                          <span className="opacity-55">Inductor DCR (Ω)</span>
                          <input
                            type="number"
                            min="0.0"
                            max="10"
                            step="0.05"
                            value={activeProject.passiveXoDcr}
                            onChange={(e) => updateActiveProject({ passiveXoDcr: parseFloat(e.target.value) || 0.0 })}
                            className="w-full border rounded px-1.5 py-1 text-right font-mono focus:outline-none text-2xs"
                            style={{ backgroundColor: "var(--bg-color)", borderColor: "var(--graph-grid-color)", color: "var(--accent-color)" }}
                          />
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </CollapsibleSection>

              {/* ── Cabin Gain Estimation ───────────────────────────── */}
              <CollapsibleSection
                title="Cabin Gain"
                open={sidebarSectionState["cabin-gain"]}
                onToggle={() => toggleSidebarSection("cabin-gain")}
                action={
                  <button
                    type="button"
                    onClick={() => setCabinConfig(prev => ({ ...prev, enabled: !prev.enabled }))}
                    className={`text-2xs font-bold px-2.5 py-0.5 rounded border transition cursor-pointer ${cabinConfig.enabled ? "border-[var(--accent-color)] text-[var(--accent-color)]" : "opacity-55 border-current"}`}
                    style={{ backgroundColor: "var(--bg-color)" }}
                  >
                    {cabinConfig.enabled ? "ON" : "OFF"}
                  </button>
                }
              >
                {!cabinConfig.enabled && (
                  <p className="text-2xs opacity-45 text-center py-1.5">Enable to estimate vehicle pressure-zone cabin gain (12 dB/octave bass boost below F_cabin).</p>
                )}

                {cabinConfig.enabled && (
                  <div className="flex flex-col gap-2 text-2xs">
                    <div className="flex justify-between items-center text-xs mb-1">
                      <span className="opacity-70">Cabin Corner Freq (Hz)</span>
                      <div className="flex items-center gap-1">
                        <input
                          type="number"
                          min="20"
                          max="150"
                          step="1"
                          value={cabinConfig.fCabin}
                          onChange={(e) => setCabinConfig(prev => ({ ...prev, fCabin: parseInt(e.target.value) || 60 }))}
                          className="w-16 border rounded px-1.5 py-0.5 text-right font-mono focus:outline-none text-xs"
                          style={{
                            backgroundColor: "var(--bg-color)",
                            borderColor: "var(--graph-grid-color)",
                            color: "var(--accent-color)",
                          }}
                        />
                        <span className="opacity-60">Hz</span>
                      </div>
                    </div>
                    <input
                      type="range"
                      min="20"
                      max="150"
                      step="1"
                      value={cabinConfig.fCabin}
                      onChange={(e) => setCabinConfig(prev => ({ ...prev, fCabin: parseInt(e.target.value) }))}
                      className="w-full h-1.5 rounded-lg appearance-none cursor-pointer mt-1"
                      style={{ accentColor: "var(--accent-color)", backgroundColor: "var(--bg-color)" }}
                    />
                    <p className="text-2xs opacity-55 mt-1">
                      Typical turn-over: Compact Cars: 70-80 Hz, Midsize: 60-70 Hz, Large SUVs: 40-50 Hz.
                    </p>
                  </div>
                )}
              </CollapsibleSection>

              {/* ── Room Simulation ──────────────────────────────────── */}
              <CollapsibleSection
                title="Room Simulation"
                open={sidebarSectionState["room-simulation"]}
                onToggle={() => toggleSidebarSection("room-simulation")}
                action={
                  <button
                    type="button"
                    onClick={() => setRoomConfig(prev => ({ ...prev, enabled: !prev.enabled }))}
                    className={`text-2xs font-bold px-2.5 py-0.5 rounded border transition cursor-pointer ${roomConfig.enabled ? "border-[var(--accent-color)] text-[var(--accent-color)]" : "opacity-55 border-current"}`}
                    style={{ backgroundColor: "var(--bg-color)" }}
                  >
                    {roomConfig.enabled ? "ON" : "OFF"}
                  </button>
                }
              >
                {!roomConfig.enabled && (
                  <p className="text-2xs opacity-45 text-center py-1.5">Enable to estimate in-room SPL via Image Source Method (2nd order, 25 sources).</p>
                )}

                {roomConfig.enabled && (
                  <div className="flex flex-col gap-3">
                    <div>
                      <p className="text-2xs opacity-55 mb-1 font-semibold uppercase tracking-wider">Room Dimensions (m)</p>
                      <div className="grid grid-cols-3 gap-1.5 text-2xs">
                        {(["length", "width", "height"] as const).map(key => (
                          <div key={key} className="flex flex-col gap-0.5">
                            <span className="opacity-55 capitalize">{key}</span>
                            <input type="number" min="1" max="50" step="0.1" value={roomConfig[key]}
                              onChange={e => setRoomConfig(prev => ({ ...prev, [key]: parseFloat(e.target.value) || 1 }))}
                              className="w-full border rounded px-1 py-0.5 text-right font-mono focus:outline-none text-2xs"
                              style={{ backgroundColor: "var(--bg-color)", borderColor: "var(--graph-grid-color)", color: "var(--accent-color)" }} />
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* ── Floor-plan drag editor ─────────────────────────── */}
                    <div>
                      <div className="flex justify-between items-center text-2xs mb-1.5">
                        <span className="opacity-55 font-semibold uppercase tracking-wider">
                          Floor Plan — drag speakers &amp; <span style={{ color: "#60a5fa" }}>L</span>
                        </span>
                        <div className="flex items-center gap-2">
                          <span className="opacity-35 text-2xs">top-down</span>
                          <button type="button"
                            onClick={() => setRoomConfig(p => {
                              const corners: SpeakerPos[] = [
                                { x: 0.5,             y: 0.5,           z: p.speakers[0]?.z ?? 0.9 },
                                { x: p.length - 0.5, y: 0.5,           z: p.speakers[0]?.z ?? 0.9 },
                                { x: 0.5,             y: p.width - 0.5, z: p.speakers[0]?.z ?? 0.9 },
                                { x: p.length - 0.5, y: p.width - 0.5, z: p.speakers[0]?.z ?? 0.9 },
                              ];
                              const next = p.speakers.length < 4
                                ? corners[p.speakers.length]
                                : { x: +(p.length / 2).toFixed(2), y: +(p.width / 2).toFixed(2), z: p.speakers[0]?.z ?? 0.9 };
                              return { ...p, speakers: [...p.speakers, next] };
                            })}
                            className="text-2xs px-1.5 py-0.5 rounded border transition cursor-pointer"
                            style={{ borderColor: "var(--accent-color)", color: "var(--accent-color)", backgroundColor: "var(--bg-color)" }}
                          >+ Speaker</button>
                        </div>
                      </div>
                      {(() => {
                        const SVG_W = 220;
                        const aspect = Math.min(2.2, Math.max(0.35, roomConfig.width / roomConfig.length));
                        const SVG_H = Math.round(SVG_W * aspect);
                        const PAD = 16;
                        const iW = SVG_W - 2 * PAD;
                        const iH = SVG_H - 2 * PAD;
                        const toSx = (rx: number) => PAD + Math.max(0, Math.min(1, rx / roomConfig.length)) * iW;
                        const toSy = (ry: number) => PAD + Math.max(0, Math.min(1, ry / roomConfig.width))  * iH;
                        const lstSx = toSx(roomConfig.listenerX);
                        const lstSy = toSy(roomConfig.listenerY);
                        const onMove = (e: React.MouseEvent<SVGSVGElement>) => {
                          if (!roomDragging) return;
                          const rect = e.currentTarget.getBoundingClientRect();
                          const sx = (e.clientX - rect.left) * (SVG_W / rect.width);
                          const sy = (e.clientY - rect.top)  * (SVG_H / rect.height);
                          const rx = parseFloat(Math.max(0.05, Math.min(roomConfig.length - 0.05, ((sx - PAD) / iW) * roomConfig.length)).toFixed(2));
                          const ry = parseFloat(Math.max(0.05, Math.min(roomConfig.width  - 0.05, ((sy - PAD) / iH) * roomConfig.width)).toFixed(2));
                          if (roomDragging.type === "listener") {
                            setRoomConfig(p => ({ ...p, listenerX: rx, listenerY: ry }));
                          } else {
                            const i = roomDragging.idx;
                            setRoomConfig(p => ({ ...p, speakers: p.speakers.map((s, si) => si === i ? { ...s, x: rx, y: ry } : s) }));
                          }
                        };
                        const gridStep = roomConfig.length > 12 ? 2 : 1;
                        const gxs = Array.from({ length: Math.floor(roomConfig.length / gridStep) - 1 }, (_, i) => (i + 1) * gridStep);
                        const gys = Array.from({ length: Math.floor(roomConfig.width  / gridStep) - 1 }, (_, i) => (i + 1) * gridStep);
                        return (
                          <svg viewBox={`0 0 ${SVG_W} ${SVG_H}`}
                            className="w-full rounded border select-none"
                            style={{
                              borderColor: "var(--graph-grid-color)",
                              backgroundColor: "var(--bg-color)",
                              cursor: roomDragging ? "grabbing" : "default",
                              maxHeight: "220px",
                            }}
                            onMouseMove={onMove}
                            onMouseUp={() => setRoomDragging(null)}
                            onMouseLeave={() => setRoomDragging(null)}
                          >
                            <rect x={PAD} y={PAD} width={iW} height={iH} fill="var(--sidebar-color)" opacity={0.7} />
                            {gxs.map(gx => (
                              <line key={`gx${gx}`} x1={toSx(gx)} y1={PAD} x2={toSx(gx)} y2={PAD + iH}
                                stroke="var(--graph-grid-color)" strokeWidth={0.5} opacity={0.45} />
                            ))}
                            {gys.map(gy => (
                              <line key={`gy${gy}`} x1={PAD} y1={toSy(gy)} x2={PAD + iW} y2={toSy(gy)}
                                stroke="var(--graph-grid-color)" strokeWidth={0.5} opacity={0.45} />
                            ))}
                            <rect x={PAD} y={PAD} width={iW} height={iH}
                              fill="none" stroke="var(--graph-grid-color)" strokeWidth={1.5} />
                            <text x={SVG_W / 2} y={PAD - 3} textAnchor="middle" fontSize={7}
                              fill="var(--text-color)" opacity={0.45}>{roomConfig.length} m</text>
                            <text x={5} y={SVG_H / 2} textAnchor="middle" fontSize={7}
                              fill="var(--text-color)" opacity={0.45}
                              transform={`rotate(-90, 5, ${SVG_H / 2})`}>{roomConfig.width} m</text>
                            {/* Speaker→listener lines */}
                            {roomConfig.speakers.map((spk, si) => (
                              <line key={`dl${si}`}
                                x1={toSx(spk.x)} y1={toSy(spk.y)} x2={lstSx} y2={lstSy}
                                stroke={SPEAKER_COLORS[si % SPEAKER_COLORS.length]}
                                strokeWidth={0.75} strokeDasharray="3 3" opacity={0.25} />
                            ))}
                            {/* Speaker markers */}
                            {roomConfig.speakers.map((spk, si) => {
                              const col = SPEAKER_COLORS[si % SPEAKER_COLORS.length];
                              const cx = toSx(spk.x);
                              const cy = toSy(spk.y);
                              const active = roomDragging?.type === "speaker" && roomDragging.idx === si;
                              const lbl = roomConfig.speakers.length === 1 ? "S" : `S${si + 1}`;
                              return (
                                <g key={`spk${si}`}>
                                  <circle cx={cx} cy={cy} r={9}
                                    fill={active ? `${col}80` : `${col}30`}
                                    stroke={col} strokeWidth={1.5}
                                    style={{ cursor: "grab" }}
                                    onMouseDown={e => { e.preventDefault(); setRoomDragging({ type: "speaker", idx: si }); }}
                                  />
                                  <text x={cx} y={cy + 4} textAnchor="middle" fontSize={roomConfig.speakers.length < 10 ? 7 : 6}
                                    fontWeight="bold" fill={col} style={{ pointerEvents: "none" }}>{lbl}</text>
                                </g>
                              );
                            })}
                            {/* Listener marker */}
                            <circle cx={lstSx} cy={lstSy} r={9}
                              fill={roomDragging?.type === "listener" ? "#60a5fa80" : "#60a5fa30"}
                              stroke="#60a5fa" strokeWidth={1.5}
                              style={{ cursor: "grab" }}
                              onMouseDown={e => { e.preventDefault(); setRoomDragging({ type: "listener" }); }}
                            />
                            <text x={lstSx} y={lstSy + 4} textAnchor="middle" fontSize={8}
                              fontWeight="bold" fill="#60a5fa" style={{ pointerEvents: "none" }}>L</text>
                          </svg>
                        );
                      })()}
                    </div>

                    {/* ── Precise X / Y / Z inputs ───────────────────────── */}
                    <CollapsibleSection
                      title="Precise X / Y / Z Inputs"
                      open={sidebarSectionState["precise-xyz-inputs"]}
                      onToggle={() => toggleSidebarSection("precise-xyz-inputs")}
                    >
                    <div className="flex flex-col gap-1.5 text-2xs">
                      {roomConfig.speakers.map((spk, si) => {
                        const col = SPEAKER_COLORS[si % SPEAKER_COLORS.length];
                        const lbl = roomConfig.speakers.length === 1 ? "Speaker (S)" : `Speaker S${si + 1}`;
                        return (
                          <div key={si} className="border rounded p-1.5" style={{ borderColor: col + "55" }}>
                            <div className="flex items-center justify-between mb-1">
                              <span className="font-semibold" style={{ color: col }}>{lbl}</span>
                              {roomConfig.speakers.length > 1 && (
                                <button type="button"
                                  onClick={() => setRoomConfig(p => ({ ...p, speakers: p.speakers.filter((_, i) => i !== si) }))}
                                  className="opacity-45 hover:opacity-100 hover:text-red-400 transition cursor-pointer px-0.5"
                                >✕</button>
                              )}
                            </div>
                            <div className="flex gap-1">
                              {(["x", "y", "z"] as const).map(axis => (
                                <div key={axis} className="flex items-center gap-0.5 flex-1 min-w-0">
                                  <span className="opacity-50 shrink-0">{axis.toUpperCase()}</span>
                                  <input type="number" min="0.05" max="49" step="0.05" value={spk[axis]}
                                    onChange={e => {
                                      const v = parseFloat(e.target.value) || 0.1;
                                      setRoomConfig(p => ({ ...p, speakers: p.speakers.map((s, i) => i === si ? { ...s, [axis]: v } : s) }));
                                    }}
                                    className="w-full min-w-0 border rounded px-1 py-0.5 text-right font-mono focus:outline-none text-2xs"
                                    style={{ backgroundColor: "var(--bg-color)", borderColor: "var(--graph-grid-color)", color: col }} />
                                  <span className="opacity-40 shrink-0">m</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        );
                      })}
                      <div className="border rounded p-1.5" style={{ borderColor: "#60a5fa55" }}>
                        <p className="font-semibold mb-1" style={{ color: "#60a5fa" }}>Listener (L)</p>
                        <div className="flex gap-1">
                          {(["listenerX", "listenerY", "listenerZ"] as const).map(key => (
                            <div key={key} className="flex items-center gap-0.5 flex-1 min-w-0">
                              <span className="opacity-50 shrink-0">{key.slice(-1).toUpperCase()}</span>
                              <input type="number" min="0.05" max="49" step="0.05" value={roomConfig[key]}
                                onChange={e => setRoomConfig(prev => ({ ...prev, [key]: parseFloat(e.target.value) || 0.1 }))}
                                className="w-full min-w-0 border rounded px-1 py-0.5 text-right font-mono focus:outline-none text-2xs"
                                style={{ backgroundColor: "var(--bg-color)", borderColor: "var(--graph-grid-color)", color: "#60a5fa" }} />
                              <span className="opacity-40 shrink-0">m</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                    </CollapsibleSection>

                    <div>
                      <div className="flex justify-between text-2xs mb-1">
                        <span className="opacity-60">Wall Absorption (α)</span>
                        <span className="font-mono" style={{ color: "var(--accent-color)" }}>
                          {roomConfig.absorption.toFixed(2)}{" "}
                          <span className="opacity-60">{roomConfig.absorption < 0.1 ? "bare/hard" : roomConfig.absorption < 0.25 ? "typical" : "treated"}</span>
                        </span>
                      </div>
                      <input type="range" min="0.02" max="0.8" step="0.01" value={roomConfig.absorption}
                        onChange={e => setRoomConfig(prev => ({ ...prev, absorption: parseFloat(e.target.value) }))}
                        className="w-full h-1.5 rounded-lg appearance-none cursor-pointer"
                        style={{ accentColor: "var(--accent-color)", backgroundColor: "var(--bg-color)" }} />
                    </div>

                    <p className="text-2xs opacity-40">Dotted curves on SPL show estimated in-room response. Room gain and early reflections only — no late reverb.</p>
                  </div>
                )}
              </CollapsibleSection>
            </div>
          )}
        </div>

        {/* Permanently Docked System Statistics */}
        {systemStats.length > 0 && (
          <div className="p-5 border-t shrink-0 bg-black/10" style={{ borderColor: "var(--graph-grid-color)" }}>
            <CollapsibleSection
              title="System Statistics"
              open={sidebarSectionState["system-stats"]}
              onToggle={() => toggleSidebarSection("system-stats")}
            >
            <div className="text-2xs">
              {(() => {
                const full  = systemStats.filter(s => s.fullWidth);
                const pairs = systemStats.filter(s => !s.fullWidth);
                const rows: (typeof systemStats)[] = [];
                for (let i = 0; i < pairs.length; i += 2)
                  rows.push(pairs.slice(i, i + 2));
                return (
                  <>
                    {rows.map((row, ri) => (
                      <div
                        key={ri}
                        className="grid grid-cols-2"
                        style={{
                          borderBottom: (ri < rows.length - 1 || full.length > 0)
                            ? "1px solid var(--graph-grid-color)" : undefined,
                        }}
                      >
                        {row.map((stat, ci) => (
                          <div
                            key={stat.label}
                            className="flex flex-col gap-0.5 px-2 py-1.5"
                            style={{
                              backgroundColor: "var(--bg-color)",
                              borderLeft: ci > 0 ? "1px solid var(--graph-grid-color)" : undefined,
                            }}
                          >
                            <span className="text-2xs font-mono uppercase opacity-55 leading-none">
                              {stat.label}
                            </span>
                            <span
                              className="font-bold font-mono leading-tight text-xs"
                              style={{
                                color: stat.danger
                                  ? "var(--danger-color)"
                                  : stat.accent
                                  ? "var(--accent-color)"
                                  : stat.warn
                                  ? "var(--warning-color)"
                                  : "var(--text-color)",
                              }}
                            >
                              {stat.value}
                            </span>
                          </div>
                        ))}
                        {/* pad odd row to fill 2nd column */}
                        {row.length === 1 && (
                          <div className="px-2 py-1.5" style={{ backgroundColor: "var(--bg-color)", borderLeft: "1px solid var(--graph-grid-color)" }} />
                        )}
                      </div>
                    ))}
                    {full.map((stat, fi) => (
                      <div
                        key={stat.label}
                        className="flex flex-col gap-0.5 px-2 py-1.5"
                        style={{
                          backgroundColor: "var(--bg-color)",
                          borderTop: fi > 0 ? "1px solid var(--graph-grid-color)" : undefined,
                        }}
                      >
                        <span className="text-2xs font-mono uppercase opacity-55 leading-none">
                          {stat.label}
                        </span>
                        <span
                          className="font-bold font-mono leading-tight text-xs"
                          style={{
                            color: stat.danger
                              ? "#f87171"
                              : stat.accent
                              ? "var(--accent-color)"
                              : stat.warn
                              ? "#f59e0b"
                              : "var(--text-color)",
                          }}
                        >
                          {stat.value}
                        </span>
                      </div>
                    ))}
                  </>
                );
              })()}
            </div>
            </CollapsibleSection>
          </div>
        )}
      </div>

      {/* Main stacked graph list dashboard */}
      <div className="flex-1 p-8 flex flex-col gap-6 overflow-hidden">
        <div className="flex justify-between items-center shrink-0">
          <div>
            <h2 className="text-xl font-bold">Simulation Dashboard</h2>
            <p className="text-xs opacity-75">
              Scroll through active curves. Hover coordinate lines sync across all graphs simultaneously.
            </p>
          </div>

          {/* Multiselect Toggle Dropdown */}
          <div className="relative">
            <button
              onClick={() => setShowDropdown(!showDropdown)}
              className="border rounded px-4 py-1.5 text-xs font-semibold focus:outline-none flex items-center gap-1.5 transition hover:opacity-90 cursor-pointer"
              style={{
                backgroundColor: "var(--sidebar-color)",
                borderColor: "var(--graph-grid-color)",
                color: "var(--text-color)",
              }}
            >
              Configure Graphs ({visibleGraphs.length})
              <span className="text-2xs">▼</span>
            </button>

            {showDropdown && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setShowDropdown(false)} />
                <div
                  className="absolute right-0 mt-1.5 w-52 rounded-lg border shadow-xl p-3 flex flex-col gap-2.5 z-20 animate-fadeIn text-xs"
                  style={{
                    backgroundColor: "var(--sidebar-color)",
                    borderColor: "var(--graph-grid-color)",
                    color: "var(--text-color)",
                  }}
                >
                  <div className="font-bold border-b pb-1.5 mb-1 opacity-75" style={{ borderColor: "var(--graph-grid-color)" }}>
                    Visible Graphs
                  </div>
                  {[
                    { key: "transfer",    label: "Gain (dB)" },
                    { key: "spl",         label: "SPL (dB SPL)" },
                    { key: "phase",       label: "Phase Response (°)" },
                    { key: "group_delay", label: "Group Delay (ms)" },
                    { key: "excursion",   label: "Cone Excursion (mm)" },
                    ...(activeProject.enclosureType !== "sealed" ? [{ key: "velocity", label: "Port Air Velocity (m/s)" }] : []),
                    { key: "impedance",   label: "System Impedance (Ω)" },
                  ].map((item) => {
                    const isChecked = visibleGraphs.includes(item.key as CurveType);
                    return (
                      <label key={item.key} className="flex items-center gap-2.5 cursor-pointer py-1 hover:opacity-85">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => {
                            if (isChecked) {
                              if (visibleGraphs.length > 1) {
                                setVisibleGraphs(visibleGraphs.filter((g) => g !== item.key));
                              }
                            } else {
                              setVisibleGraphs([...visibleGraphs, item.key as CurveType]);
                            }
                          }}
                          className="rounded text-[var(--accent-color)] focus:ring-[var(--accent-color)] accent-[var(--accent-color)] h-4 w-4 cursor-pointer"
                        />
                        <span>{item.label}</span>
                      </label>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        </div>

        {/* Projects Tab Toolbar */}
        <div className="flex flex-wrap items-center gap-2 border-b pb-3.5" style={{ borderColor: "var(--graph-grid-color)" }}>
          {projects.map((project) => {
            const isActive = project.id === activeProjectId;
            return (
              <div
                key={project.id}
                onClick={() => setActiveProjectId(project.id)}
                className={`group flex items-center gap-2.5 px-3.5 py-2 rounded-lg border text-xs font-semibold cursor-pointer transition select-none ${
                  isActive
                    ? "border-[var(--accent-color)] shadow-md"
                    : "opacity-75 hover:opacity-100 hover:bg-black/10"
                }`}
                style={{
                  backgroundColor: isActive ? "var(--sidebar-color)" : "transparent",
                  borderColor: isActive ? "var(--accent-color)" : "var(--graph-grid-color)",
                  color: "var(--text-color)",
                }}
              >
                {/* Visibility Checkbox */}
                <input
                  type="checkbox"
                  checked={project.showOnGraph}
                  onClick={(e) => e.stopPropagation()}
                  onChange={() => {
                    setProjectsWithHistory(projects.map(p =>
                      p.id === project.id ? { ...p, showOnGraph: !p.showOnGraph } : p
                    ));
                  }}
                  className="rounded text-[var(--accent-color)] focus:ring-[var(--accent-color)] accent-[var(--accent-color)] h-3.5 w-3.5 cursor-pointer shrink-0"
                  title="Toggle visibility on graph"
                />

                {/* Project color circle with picker */}
                <div className="relative flex items-center shrink-0">
                  <input
                    type="color"
                    value={project.color}
                    onClick={(e) => e.stopPropagation()}
                    onChange={(e) => {
                      setProjectsWithHistory(projects.map(p =>
                        p.id === project.id ? { ...p, color: e.target.value } : p
                      ));
                    }}
                    className="w-5 h-5 rounded-full overflow-hidden border border-white/20 shadow-inner cursor-pointer p-0 shrink-0 bg-transparent transition-transform hover:scale-110"
                    style={{
                      WebkitAppearance: "none",
                      border: "none",
                    }}
                    title="Change project line color"
                  />
                </div>

                {/* Project Name (double click to rename) */}
                <span
                  onDoubleClick={() => handleRenameProject(project.id)}
                  className="truncate max-w-[120px]"
                  title="Double click to rename"
                >
                  {project.name}
                </span>

                {/* Active Controls: Rename, Duplicate, Delete */}
                <div className="flex items-center gap-1.5 ml-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleRenameProject(project.id);
                    }}
                    className="hover:text-sky-400 p-0.5"
                    title="Rename project"
                  >
                    <Edit3 className="h-3 w-3" />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDuplicateProject(project.id);
                    }}
                    className="hover:text-[var(--accent-color)] p-0.5"
                    title="Duplicate project"
                  >
                    <Copy className="h-3 w-3" />
                  </button>
                  {projects.length > 1 && (
                    <button
                      onClick={async (e) => {
                        e.stopPropagation();
                        const ok = await confirmDialog({
                          title: "Remove Project?",
                          body: `Remove project "${project.name}"? This cannot be undone.`,
                          confirmLabel: "Remove",
                        });
                        if (ok) handleRemoveProject(project.id);
                      }}
                      className="hover:text-red-400 p-0.5"
                      title="Remove project"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}

          {/* Action buttons */}
          <div className="flex items-center gap-2 ml-auto shrink-0">
            <Tooltip label="Undo (Ctrl+Z)">
              <button
                onClick={undo}
                disabled={!canUndo}
                className="p-1.5 rounded text-xs transition cursor-pointer disabled:opacity-25 hover:enabled:bg-black/20"
                style={{ color: "var(--text-color)" }}
              >
                <Undo2 className="h-3.5 w-3.5" />
              </button>
            </Tooltip>
            <Tooltip label="Redo (Ctrl+Y)">
              <button
                onClick={redo}
                disabled={!canRedo}
                className="p-1.5 rounded text-xs transition cursor-pointer disabled:opacity-25 hover:enabled:bg-black/20"
                style={{ color: "var(--text-color)" }}
              >
                <Redo2 className="h-3.5 w-3.5" />
              </button>
            </Tooltip>
            <Tooltip label="Toggle Draggable Measurement Ruler Line">
              <button
                onClick={() => setRulerFreq(prev => prev === null ? 80.0 : null)}
                className={`p-1.5 rounded transition-colors cursor-pointer flex items-center justify-center ${rulerFreq !== null ? "text-[var(--accent-color)] bg-[var(--accent-color)]/15 border border-[var(--accent-color)]/40" : "hover:bg-black/20"}`}
                style={{ color: rulerFreq !== null ? undefined : "var(--text-color)" }}
              >
                <Ruler className="h-3.5 w-3.5" />
              </button>
            </Tooltip>
            <div className="relative" data-export-menu>
              <Tooltip label="Export graph or design summary">
                <button
                  onClick={() => setShowExportMenu(showExportMenu ? null : (visibleGraphs[0] ?? "transfer"))}
                  className="p-1.5 rounded text-xs transition cursor-pointer hover:bg-black/20 flex items-center gap-1"
                  style={{ color: "var(--text-color)" }}
                >
                  <Download className="h-3.5 w-3.5" />
                  <ChevronDown className="h-2.5 w-2.5 opacity-60" />
                </button>
              </Tooltip>
              {showExportMenu !== null && (
                <div
                  className="absolute right-0 top-full mt-1 z-50 rounded-lg shadow-xl border text-xs min-w-[220px]"
                  style={{ backgroundColor: "var(--sidebar-color)", borderColor: "var(--graph-grid-color)", color: "var(--text-color)" }}
                >
                  <div className="px-3 pt-2.5 pb-1 text-2xs font-semibold opacity-50 uppercase tracking-wider">Graph</div>
                  <div className="flex flex-col px-1 pb-1">
                    {visibleGraphs.map(m => (
                      <div key={m} className="flex items-center gap-1">
                        <span className="flex-1 px-2 py-1 opacity-70 capitalize">{m.replace("_"," ")}</span>
                        <button onClick={() => { handleExportSVG(m); setShowExportMenu(null); }}
                          className="px-2 py-1 rounded hover:bg-black/20 cursor-pointer">SVG</button>
                        <button onClick={() => { handleExportPNG(m); setShowExportMenu(null); }}
                          className="px-2 py-1 rounded hover:bg-black/20 cursor-pointer">PNG</button>
                      </div>
                    ))}
                  </div>
                  <div className="border-t px-1 pb-1" style={{ borderColor: "var(--graph-grid-color)" }}>
                    <button
                      onClick={() => { handleExportSummary(); setShowExportMenu(null); }}
                      className="w-full flex items-center gap-2 px-2 py-1.5 rounded hover:bg-black/20 cursor-pointer"
                    >
                      <FileText className="h-3.5 w-3.5 opacity-70" />
                      Design Summary (HTML/PDF)
                    </button>
                  </div>
                </div>
              )}
            </div>
            <button
              onClick={handleAddNewProject}
              className="px-3 py-1.5 text-white font-semibold text-xs rounded-lg shadow transition flex items-center gap-1 cursor-pointer hover:brightness-110"
              style={{ backgroundColor: "var(--accent-color)" }}
            >
              <Plus className="h-3.5 w-3.5" />
              New Project
            </button>
          </div>
        </div>

        <div ref={dashboardContainerRef} className="flex-1 overflow-y-auto flex flex-col gap-8 pr-2">
          {visibleGraphs.map((mode) => {
            const width = dashboardWidth;
            const height = graphHeights[mode];
            const chartWidth = width - paddingLeft - paddingRight;
            const chartHeight = height - paddingTop - paddingBottom;

            const activeCfg = graphConfigs[mode];
            const { xMin: fMin, xMax: fMax } = getGraphXLimits(mode);

            // Calculate dynamic Y limits across all visible projects for this graph mode,
            // including any active filter or room-correction overlays so they never clip.
            let minVal = 0;
            let maxVal = 10;
            let hasAnyPoints = false;
            projects.filter(p => p.showOnGraph).forEach(project => {
              const pts = (mode === "phase"       ? phaseGdData[project.id]?.phase
                         : mode === "group_delay" ? phaseGdData[project.id]?.group_delay
                         : simulationResults[project.id]?.[mode]) || [];
              if (pts.length > 0) {
                let projectMin = Infinity, projectMax = -Infinity;
                for (const pt of pts) {
                  const base = pt.db;
                  let vRaw = base;
                  let vFlt = base;
                  let vEnv = base;

                  if (mode === "spl" || mode === "transfer") {
                    const fGain = filterGainFn ? filterGainFn(pt.frequency) : 0;
                    const rGain = roomCorrectionFn ? roomCorrectionFn(pt.frequency) : 0;
                    const cGain = cabinGainFn ? cabinGainFn(pt.frequency) : 0;
                    vFlt = base + fGain;
                    vEnv = base + fGain + rGain + cGain;
                  } else if (mode === "excursion" || mode === "velocity") {
                    const fLin = filterLinearFn ? filterLinearFn(pt.frequency) : 1;
                    vFlt = base * fLin;
                    vEnv = base * fLin;
                  }

                  projectMin = Math.min(projectMin, vRaw, vFlt, vEnv);
                  projectMax = Math.max(projectMax, vRaw, vFlt, vEnv);
                }
                if (!hasAnyPoints) {
                  minVal = projectMin;
                  maxVal = projectMax;
                  hasAnyPoints = true;
                } else {
                  minVal = Math.min(minVal, projectMin);
                  maxVal = Math.max(maxVal, projectMax);
                }
              }
            });

            const isSpl = mode === "spl";
            const isPhase = mode === "phase";
            const isGD    = mode === "group_delay";

            const currentDbMin = !activeCfg.autoScaleY
              ? activeCfg.yMin
              : Math.floor(
                  Math.max(
                    isSpl ? 20
                    : (mode === "excursion" || mode === "velocity" || mode === "impedance" || isGD) ? 0
                    : isPhase ? -540
                    : -100,
                    minVal
                  ) / 5
                ) * 5;

            const currentDbMax = !activeCfg.autoScaleY
              ? activeCfg.yMax
              : Math.max(
                  Math.ceil(
                    Math.min(
                      mode === "excursion" ? 100
                      : mode === "velocity" ? 200
                      : mode === "impedance" ? 1000
                      : isSpl ? 200
                      : isGD  ? 500
                      : isPhase ? 90
                      : 30,
                      maxVal
                    ) / 5
                  ) * 5,
                  currentDbMin + 5
                );

            const getX = (freq: number) => {
              const logF = Math.log10(freq);
              const logMin = Math.log10(fMin);
              const logMax = Math.log10(fMax);
              const pct = (logF - logMin) / (logMax - logMin);
              return paddingLeft + pct * chartWidth;
            };

            const getY = (db: number) => {
              const clampedDb = Math.max(currentDbMin, Math.min(currentDbMax, db));
              const pct = (clampedDb - currentDbMin) / (currentDbMax - currentDbMin);
              return paddingTop + (1 - pct) * chartHeight;
            };

            const xGridFreqs = (() => {
              const ticks = [
                10, 20, 30, 40, 50, 70, 100, 200, 300, 400, 500, 700, 1000, 1500, 2000, 3000, 5000, 10000
              ];
              let filtered = ticks.filter((t) => t >= fMin && t <= fMax);
              if (!filtered.includes(fMin)) filtered.unshift(fMin);
              if (!filtered.includes(fMax)) filtered.push(fMax);
              return Array.from(new Set(filtered)).sort((a, b) => a - b);
            })();

            const yGridDbs = (() => {
              const grids = [];
              const range = currentDbMax - currentDbMin;
              let step = 10;
              if (range <= 10) step = 1;
              else if (range <= 25) step = 5;
              else if (range <= 50) step = 10;
              else if (range <= 150) step = 20;
              else step = 50;

              for (let db = currentDbMax; db >= currentDbMin; db -= step) {
                grids.push(db);
              }
              return grids;
            })();

            const unit =
              mode === "phase"       ? "°"
            : mode === "group_delay" ? "ms"
            : mode === "excursion"   ? "mm"
            : mode === "velocity"    ? "m/s"
            : mode === "impedance"   ? "Ω"
            : isSpl                  ? "dB SPL"
            :                          "dB";

            const handleMouseMove = (e: React.MouseEvent<SVGSVGElement, MouseEvent>) => {
              const svg = e.currentTarget;
              const pt = svg.createSVGPoint();
              pt.x = e.clientX;
              pt.y = e.clientY;
              const svgPoint = pt.matrixTransform(svg.getScreenCTM()?.inverse());
              const mouseX = svgPoint.x;

              const relativeX = (mouseX - paddingLeft) / chartWidth;
              const logMin = Math.log10(fMin);
              const logMax = Math.log10(fMax);
              const targetLogF = logMin + relativeX * (logMax - logMin);
              const targetFreq = Math.pow(10, targetLogF);
              if (targetFreq >= fMin && targetFreq <= fMax) {
                if (isDraggingRuler) {
                  setRulerFreq(targetFreq);
                } else {
                  setHoveredFreq(targetFreq);
                }
              }
            };

            const title =
              mode === "transfer"    ? "Relative Gain (dB)"
            : mode === "spl"         ? "Sound Pressure Level (SPL)"
            : mode === "phase"       ? "Phase Response (°)"
            : mode === "group_delay" ? "Group Delay (ms)"
            : mode === "excursion"   ? "Cone Excursion (mm)"
            : mode === "velocity"    ? "Port Air Velocity (m/s)"
            :                          "System Electrical Impedance (Ω)";

            return (
              <div
                key={mode}
                className="border rounded-xl p-5 flex flex-col gap-4 animate-fadeIn"
                style={{ backgroundColor: "var(--sidebar-color)", borderColor: "var(--graph-grid-color)" }}
              >
                {/* Chart Header */}
                <div className="flex flex-col gap-3">
                  <div className="flex flex-col gap-1 items-start w-full">
                    <h3 className="text-sm font-bold tracking-wide">{title}</h3>
                    {/* Radiation model accuracy warning — shown for gain/SPL graphs */}
                    {(mode === "transfer" || mode === "spl") && kaWarningFreq < fMax && (
                      <p className="text-2xs opacity-70" style={{ color: "var(--accent-color)" }}>
                        ⚠ Radiation model less accurate above ~{kaWarningFreq} Hz for this driver (ka = 0.5)
                      </p>
                    )}
                  </div>
                  
                  {/* Multi-project hover coordinate panel - Centered on its own row */}
                  <div className="flex justify-center w-full">
                    <div className="text-2xs font-mono flex flex-wrap justify-center items-center gap-x-4 gap-y-1.5 px-4.5 py-1.5 rounded-lg bg-black/35 border border-white/5 shrink-0 max-w-full">
                      {(() => {
                        const activeFreq = hoveredFreq || rulerFreq;
                        return (
                          <>
                            <div>
                              <span className="opacity-50">{hoveredFreq ? "Freq:" : "Ruler:"}</span>{" "}
                              <span className="font-semibold text-[var(--accent-color)]">
                                {activeFreq ? `${activeFreq.toFixed(1)} Hz` : "-- Hz"}
                              </span>
                            </div>
                            {projects.filter(p => p.showOnGraph).map(project => {
                              const pts = (mode === "phase"       ? phaseGdData[project.id]?.phase
                                         : mode === "group_delay" ? phaseGdData[project.id]?.group_delay
                                         : simulationResults[project.id]?.[mode]) || [];
                              const hp = activeFreq && pts.length > 0
                                ? pts.reduce((prev, curr) =>
                                    Math.abs(Math.log10(curr.frequency) - Math.log10(activeFreq)) < Math.abs(Math.log10(prev.frequency) - Math.log10(activeFreq)) ? curr : prev
                                  )
                                : null;
                              const isActive = project.id === activeProjectId;
                              return (
                                <div key={project.id} className="flex items-center gap-1.5 border-l pl-4 first:border-none first:pl-0" style={{ borderColor: "var(--graph-grid-color)" }}>
                                  <span className="w-2 h-2 rounded-full inline-block shrink-0 shadow-sm" style={{ backgroundColor: project.color }} />
                                  <span className={`opacity-70 max-w-[120px] truncate ${isActive ? "font-bold underline underline-offset-2 decoration-[var(--accent-color)]/55" : ""}`} style={isActive ? { color: "var(--text-color)" } : undefined} title={project.name}>{project.name}:</span>
                                  <span className="font-semibold font-mono" style={{ color: project.color }}>
                                    {hp ? `${getDisplayValue(mode, hp.frequency, hp.db).toFixed(2)} ${unit}` : `-- ${unit}`}
                                  </span>
                                </div>
                              );
                            })}
                          </>
                        );
                      })()}
                    </div>
                  </div>
                </div>

                {/* SVG Graph Canvas */}
                <div style={{ height: `${height}px` }} className="w-full bg-black/10 rounded-lg p-2">
                  <svg
                    ref={(el) => { if (el) svgRefsMap.current.set(mode, el); else svgRefsMap.current.delete(mode); }}
                    viewBox={`0 0 ${width} ${height}`}
                    className="w-full h-full select-none"
                    onMouseMove={handleMouseMove}
                    onMouseLeave={() => setHoveredFreq(null)}
                  >
                    {/* SVG Chart Title */}
                    <text
                      x={paddingLeft}
                      y={26}
                      fill="var(--text-color)"
                      fontSize="12.5"
                      fontWeight="bold"
                      className="opacity-90 tracking-wide"
                    >
                      {title}
                    </text>

                    {/* SVG Chart Legend */}
                    {projects.filter(p => p.showOnGraph).map((project, idx) => {
                      const spacing = 125;
                      const activeProjs = projects.filter(p => p.showOnGraph);
                      const x = width - paddingRight - (activeProjs.length - idx) * spacing;
                      const isActive = project.id === activeProjectId;
                      return (
                        <g key={`legend-${project.id}`} transform={`translate(${x}, 18)`}>
                          <circle
                            cx="5"
                            cy="7"
                            r="3.5"
                            fill={project.color}
                          />
                          <text
                            x="14"
                            y="10.5"
                            fill="var(--text-color)"
                            fontSize="9.5"
                            fontWeight={isActive ? "bold" : "normal"}
                            className="font-sans opacity-75"
                          >
                            {project.name.length > 18 ? `${project.name.slice(0, 15)}...` : project.name}
                          </text>
                        </g>
                      );
                    })}
                    {/* Grid - Horizontal lines */}
                    {yGridDbs.map((db) => {
                      const y = getY(db);
                      const isZeroLine = !isSpl && db === 0;
                      return (
                        <g key={`y-grid-${mode}-${db}`}>
                          <line
                            x1={paddingLeft}
                            y1={y}
                            x2={width - paddingRight}
                            y2={y}
                            stroke="var(--graph-grid-color)"
                            strokeWidth={isZeroLine ? 2 : 1}
                            strokeDasharray={isZeroLine ? undefined : "3 3"}
                          />
                          <text
                            x={paddingLeft - 8}
                            y={y + 3}
                            fill="var(--text-color)"
                            fontSize="9"
                            textAnchor="end"
                            className="font-mono opacity-70"
                          >
                            {db}
                          </text>
                        </g>
                      );
                    })}

                    {/* Grid - Vertical lines */}
                    {xGridFreqs.map((freq) => {
                      const x = getX(freq);
                      return (
                        <g key={`x-grid-${mode}-${freq}`}>
                          <line
                            x1={x}
                            y1={paddingTop}
                            x2={x}
                            y2={height - paddingBottom}
                            stroke="var(--graph-grid-color)"
                            strokeWidth={1}
                            strokeDasharray="3 3"
                          />
                          <text
                            x={x}
                            y={height - paddingBottom + 16}
                            fill="var(--text-color)"
                            fontSize="9"
                            textAnchor="middle"
                            className="font-mono opacity-70"
                          >
                            {Math.round(freq)}
                          </text>
                        </g>
                      );
                    })}

                    {/* Response Curve Paths for all visible projects */}
                    {projects.filter(p => p.showOnGraph).map(project => {
                      const pts = (mode === "phase"       ? phaseGdData[project.id]?.phase
                                 : mode === "group_delay" ? phaseGdData[project.id]?.group_delay
                                 : simulationResults[project.id]?.[mode]) || [];
                      if (pts.length === 0) return null;
                      const isActive = project.id === activeProjectId;
                      const sw = isActive ? 3 : 1.75;
                      const op = isActive ? 1.0 : 0.65;

                       const buildPath = (applyFilters: boolean, applyEnv: boolean) =>
                        pts.map((p, idx) => {
                          const x = getX(p.frequency);
                          let val = p.db;
                          if (applyFilters && filterGainFn) {
                            if (mode === "spl" || mode === "transfer") {
                              val += filterGainFn(p.frequency);
                            } else if (mode === "excursion" || mode === "velocity") {
                              val *= filterLinearFn ? filterLinearFn(p.frequency) : 1;
                            }
                          }
                          if (applyEnv && mode === "spl") {
                            if (roomCorrectionFn) {
                              val += roomCorrectionFn(p.frequency);
                            }
                            if (cabinGainFn) {
                              val += cabinGainFn(p.frequency);
                            }
                          }
                          const y = getY(val);
                          return `${idx === 0 ? "M" : "L"} ${x} ${y}`;
                        }).join(" ");

                      const showFilter = (filterGainFn !== null) && (mode === "spl" || mode === "transfer" || mode === "excursion" || mode === "velocity");
                      const showEnv    = (roomCorrectionFn !== null || cabinGainFn !== null) && mode === "spl";

                      return (
                        <g key={project.id} className="transition-all duration-150">
                          {/* original solid curve */}
                          <path d={buildPath(false, false)} fill="none" stroke={project.color}
                            strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" opacity={op} />

                          {/* filter-only dashed overlay (SPL + transfer + excursion + velocity) */}
                          {showFilter && (
                            <path d={buildPath(true, false)} fill="none" stroke={project.color}
                              strokeWidth={sw * 0.85} strokeLinecap="round" strokeLinejoin="round"
                              strokeDasharray="8 4" opacity={op * 0.85} />
                          )}

                          {/* filter+environment dotted overlay (SPL only) */}
                          {showEnv && (
                            <path d={buildPath(showFilter, true)} fill="none" stroke={project.color}
                              strokeWidth={sw * 0.75} strokeLinecap="round" strokeLinejoin="round"
                              strokeDasharray="2 4" opacity={op * 0.75} />
                          )}
                        </g>
                      );
                    })}

                    {/* ── Reference lines ─────────────────────────────────────────── */}

                    {/* PHASE: 0° and −180° horizontal guide lines */}
                    {mode === "phase" && (() => {
                      const lines: { val: number; label: string }[] = [
                        { val: 0,    label: "0°"    },
                        { val: -90,  label: "−90°"  },
                        { val: -180, label: "−180°" },
                        { val: -270, label: "−270°" },
                        { val: -360, label: "−360°" },
                      ];
                      return (
                        <g>
                          {lines.filter(l => l.val >= currentDbMin && l.val <= currentDbMax).map(l => {
                            const y = getY(l.val);
                            return (
                              <g key={l.val}>
                                <line x1={paddingLeft} y1={y} x2={width - paddingRight} y2={y}
                                  stroke="var(--accent-color)" strokeWidth={1}
                                  strokeDasharray={l.val === 0 ? "6 3" : "3 5"} opacity={l.val === 0 ? 0.45 : 0.25} />
                                <text x={paddingLeft + 4} y={y - 3} fill="var(--accent-color)"
                                  fontSize={8} opacity={l.val === 0 ? 0.7 : 0.4}>{l.label}</text>
                              </g>
                            );
                          })}
                        </g>
                      );
                    })()}

                    {/* GROUP DELAY: 0 ms base line */}
                    {mode === "group_delay" && 0 >= currentDbMin && 0 <= currentDbMax && (() => {
                      const y = getY(0);
                      return (
                        <line x1={paddingLeft} y1={y} x2={width - paddingRight} y2={y}
                          stroke="var(--accent-color)" strokeWidth={1} strokeDasharray="4 4" opacity={0.3} />
                      );
                    })()}

                    {/* GAIN: F3 / F6 / F10 horizontal reference lines */}
                    {mode === "transfer" && (() => {
                      const activeTxPts = simulationResults[activeProjectId]?.["transfer"] ?? [];
                      const maxDb = activeTxPts.length > 0 ? Math.max(...activeTxPts.map(p => p.db)) : 0;
                      const markers: Array<{ drop: number; color: string; dash: string; opacity: number; bold: boolean }> = [
                        { drop: 3,  color: "var(--accent-color)", dash: "7 4", opacity: 0.70, bold: true  },
                        { drop: 6,  color: "#a78bfa",             dash: "5 4", opacity: 0.55, bold: false },
                        { drop: 10, color: "#64748b",             dash: "4 4", opacity: 0.45, bold: false },
                      ];
                      return (
                        <g>
                          {markers.map(({ drop, color, dash, opacity, bold }) => {
                            const lineDb = maxDb - drop;
                            if (lineDb < currentDbMin || lineDb > currentDbMax) return null;
                            const fHz = findLFCrossover(activeTxPts, drop);
                            const y = getY(lineDb);
                            const label = fHz !== null
                              ? `−${drop} dB  F${drop === 3 ? "3" : drop === 6 ? "6" : "10"} = ${fHz < 100 ? fHz.toFixed(1) : Math.round(fHz)} Hz`
                              : `−${drop} dB`;
                            const lblW = label.length * 5.4 + 6;
                            return (
                              <g key={drop}>
                                <line x1={paddingLeft} y1={y} x2={width - paddingRight} y2={y}
                                  stroke={color} strokeWidth={bold ? 1.5 : 1} strokeDasharray={dash} opacity={opacity} />
                                {/* vertical crosshair at detected frequency */}
                                {fHz !== null && fHz >= fMin && fHz <= fMax && (
                                  <line
                                    x1={getX(fHz)} y1={paddingTop}
                                    x2={getX(fHz)} y2={height - paddingBottom}
                                    stroke={color} strokeWidth={0.75} strokeDasharray="3 4" opacity={opacity * 0.6}
                                  />
                                )}
                                <rect x={width - paddingRight - lblW - 2} y={y - 14} width={lblW} height={13} rx={2}
                                  fill="var(--sidebar-color)" opacity={0.92} />
                                <text x={width - paddingRight - 4} y={y - 4}
                                  fill={color} fontSize={9} textAnchor="end"
                                  fontWeight={bold ? "bold" : "normal"} opacity={opacity + 0.1}>
                                  {label}
                                </text>
                              </g>
                            );
                          })}
                        </g>
                      );
                    })()}

                    {/* GAIN: active driver Fs vertical line */}
                    {mode === "transfer" && activeProject.driver.fs >= fMin && activeProject.driver.fs <= fMax && (() => {
                      const xFs = getX(activeProject.driver.fs);
                      const nearRight = xFs > (width - paddingRight - 80);
                      return (
                        <g>
                          <line x1={xFs} y1={paddingTop} x2={xFs} y2={height - paddingBottom}
                            stroke="var(--accent-color)" strokeWidth={1.5} strokeDasharray="7 4" opacity={0.45} />
                          <rect
                            x={nearRight ? xFs - 76 : xFs + 2}
                            y={paddingTop + 2} width={72} height={13} rx={2}
                            fill="var(--sidebar-color)" opacity={0.92}
                          />
                          <text
                            x={nearRight ? xFs - 4 : xFs + 4}
                            y={paddingTop + 13}
                            fill="var(--accent-color)" fontSize={9}
                            textAnchor={nearRight ? "end" : "start"} fontWeight="bold" opacity={0.9}
                          >
                            Fs = {activeProject.driver.fs} Hz
                          </text>
                        </g>
                      );
                    })()}

                    {/* VELOCITY: 17 m/s chuffing limit */}
                    {mode === "velocity" && 17 >= currentDbMin && 17 <= currentDbMax && (() => {
                      const y = getY(17);
                      return (
                        <g>
                          <line x1={paddingLeft} y1={y} x2={width - paddingRight} y2={y}
                            stroke="var(--warning-color)" strokeWidth={1.5} strokeDasharray="7 4" opacity={0.8} />
                          <rect x={width - paddingRight - 108} y={y - 14} width={106} height={13} rx={2}
                            fill="var(--sidebar-color)" opacity={0.92} />
                          <text x={width - paddingRight - 4} y={y - 4}
                            fill="var(--warning-color)" fontSize={9} textAnchor="end" fontWeight="bold" opacity={0.95}>
                            Chuffing limit  17 m/s
                          </text>
                        </g>
                      );
                    })()}

                    {/* EXCURSION: Xmax limit */}
                    {mode === "excursion" && activeProject.driver.xmax >= currentDbMin && activeProject.driver.xmax <= currentDbMax && (() => {
                      const y = getY(activeProject.driver.xmax);
                      // Build annotation suffix showing power-at-Xmax if excursion data available
                      let suffix = "";
                      const excPts2 = simulationResults[activeProjectId]?.["excursion"] ?? [];
                      const splPts2  = simulationResults[activeProjectId]?.["spl"] ?? [];
                      if (excPts2.length >= 2) {
                        const peakMm = Math.max(...excPts2.map(p => p.db));
                        if (peakMm > 0) {
                          const pIn = Math.max(1e-6, parseFloat(String(activeProject.inputPower)) || 1);
                          const pXmax = pIn * Math.pow(activeProject.driver.xmax / peakMm, 2);
                          const wStr = pXmax < 1 ? pXmax.toFixed(2) : pXmax.toFixed(1);
                          let splStr = "";
                          if (splPts2.length >= 10) {
                            const topSlice = splPts2.slice(Math.floor(splPts2.length * 0.6)).map(p => p.db).sort((a, b) => a - b);
                            const passband = topSlice[Math.floor(topSlice.length / 2)];
                            const splX = passband + 10 * Math.log10(Math.max(1e-12, pXmax / pIn));
                            splStr = ` / ${splX.toFixed(0)} dB`;
                          }
                          suffix = `  @ ${wStr}W${splStr}`;
                        }
                      }
                      const label = `Xmax  ${activeProject.driver.xmax} mm${suffix}`;
                      const lblW = label.length * 5.0 + 6;
                      const color = suffix ? "var(--danger-color)" : "var(--warning-color)";
                      return (
                        <g>
                          <line x1={paddingLeft} y1={y} x2={width - paddingRight} y2={y}
                            stroke={color} strokeWidth={1.5} strokeDasharray="7 4" opacity={0.8} />
                          <rect x={width - paddingRight - lblW - 2} y={y - 14} width={lblW} height={13} rx={2}
                            fill="var(--sidebar-color)" opacity={0.92} />
                          <text x={width - paddingRight - 4} y={y - 4}
                            fill={color} fontSize={9} textAnchor="end" fontWeight="bold" opacity={0.95}>
                            {label}
                          </text>
                        </g>
                      );
                    })()}

                    {/* Hover Pointer markers for each visible project */}
                    {hoveredFreq && projects.filter(p => p.showOnGraph).map(project => {
                      const pts = (mode === "phase"       ? phaseGdData[project.id]?.phase
                                 : mode === "group_delay" ? phaseGdData[project.id]?.group_delay
                                 : simulationResults[project.id]?.[mode]) || [];
                      if (pts.length === 0) return null;
                      const hp = pts.reduce((prev, curr) =>
                        Math.abs(Math.log10(curr.frequency) - Math.log10(hoveredFreq)) < Math.abs(Math.log10(prev.frequency) - Math.log10(hoveredFreq)) ? curr : prev
                      );
                      const isActive = project.id === activeProjectId;
                      const displayVal = getDisplayValue(mode, hp.frequency, hp.db);
                      return (
                        <circle
                          key={project.id}
                          cx={getX(hp.frequency)}
                          cy={getY(displayVal)}
                          r={isActive ? 5.5 : 4.5}
                          fill={project.color}
                          stroke="var(--text-color)"
                          strokeWidth={isActive ? 2 : 1.5}
                        />
                      );
                    })}

                    {/* Draggable measurement ruler overlay */}
                    {rulerFreq !== null && rulerFreq >= fMin && rulerFreq <= fMax && (() => {
                      const rulerX = getX(rulerFreq);
                      return (
                        <g>
                          {/* Invisible thick line for easier grabbing */}
                          <line
                            x1={rulerX}
                            y1={paddingTop}
                            x2={rulerX}
                            y2={height - paddingBottom}
                            stroke="transparent"
                            strokeWidth={10}
                            className="cursor-col-resize select-none"
                            onMouseDown={(e) => {
                              e.preventDefault();
                              setIsDraggingRuler(true);
                            }}
                          />
                          {/* Dashed ruler line */}
                          <line
                            x1={rulerX}
                            y1={paddingTop}
                            x2={rulerX}
                            y2={height - paddingBottom}
                            stroke="var(--accent-color)"
                            strokeWidth={1.5}
                            strokeDasharray="4 2"
                            className="cursor-col-resize select-none"
                            style={{ pointerEvents: "none" }}
                          />
                          {/* Top drag handle circle */}
                          <circle
                            cx={rulerX}
                            cy={paddingTop}
                            r={5.5}
                            fill="var(--bg-color)"
                            stroke="var(--accent-color)"
                            strokeWidth={2}
                            className="cursor-col-resize select-none"
                            onMouseDown={(e) => {
                              e.preventDefault();
                              setIsDraggingRuler(true);
                            }}
                          />
                          {/* Bottom drag handle circle */}
                          <circle
                            cx={rulerX}
                            cy={height - paddingBottom}
                            r={5.5}
                            fill="var(--bg-color)"
                            stroke="var(--accent-color)"
                            strokeWidth={2}
                            className="cursor-col-resize select-none"
                            onMouseDown={(e) => {
                              e.preventDefault();
                              setIsDraggingRuler(true);
                            }}
                          />
                          {/* Ruler frequency text label at the bottom */}
                          <text
                            x={rulerX}
                            y={height - paddingBottom + 13}
                            fill="var(--accent-color)"
                            fontSize="9"
                            fontWeight="bold"
                            textAnchor="middle"
                            className="font-mono select-none"
                            style={{
                              paintOrder: "stroke",
                              stroke: "var(--bg-color)",
                              strokeWidth: 2.5,
                            }}
                          >
                            {rulerFreq.toFixed(1)} Hz
                          </text>

                          {/* Intersection circles and value callouts for each visible curve */}
                          {projects.filter(p => p.showOnGraph).map(project => {
                            const pts = (mode === "phase"       ? phaseGdData[project.id]?.phase
                                       : mode === "group_delay" ? phaseGdData[project.id]?.group_delay
                                       : simulationResults[project.id]?.[mode]) || [];
                            if (pts.length === 0) return null;
                            const hp = pts.reduce((prev, curr) =>
                              Math.abs(Math.log10(curr.frequency) - Math.log10(rulerFreq)) < Math.abs(Math.log10(prev.frequency) - Math.log10(rulerFreq)) ? curr : prev
                            );
                            const displayVal = getDisplayValue(mode, hp.frequency, hp.db);
                            const yVal = getY(displayVal);
                            const isActive = project.id === activeProjectId;
                            return (
                              <g key={`ruler-mark-${project.id}`}>
                                <circle
                                  cx={rulerX}
                                  cy={yVal}
                                  r={isActive ? 5.5 : 4.5}
                                  fill={project.color}
                                  stroke="var(--bg-color)"
                                  strokeWidth={1.5}
                                />
                                <text
                                  x={rulerX + 8}
                                  y={yVal + 3}
                                  fill={project.color}
                                  fontSize="9.5"
                                  fontWeight="bold"
                                  className="font-mono select-none"
                                  style={{
                                    paintOrder: "stroke",
                                    stroke: "var(--bg-color)",
                                    strokeWidth: 2.5,
                                  }}
                                >
                                  {displayVal.toFixed(1)}
                                </text>
                              </g>
                            );
                          })}
                        </g>
                      );
                    })()}
                  </svg>
                </div>

                {/* Individual Explainer caption */}
                <div className="flex gap-2 text-xs opacity-75 items-start">
                  <Info className="h-4 w-4 mt-0.5 shrink-0" style={{ color: "var(--accent-color)" }} />
                  {mode === "excursion" && (
                    <p>
                      Keep displacement below the mechanical limit (Xmax = {activeProject.driver.xmax} mm) at input power {activeProject.inputPower}W.
                    </p>
                  )}
                  {mode === "velocity" && (
                    <p>
                      Vent air velocity should stay under 17 m/s to prevent port chuffing and compression.
                    </p>
                  )}
                  {mode === "impedance" && (
                    <p>
                      Shows electrical cabinet loading including coil inductance Le = {activeProject.driver.le} mH. Saddle point marks Fb = {activeProject.tuningFreq}Hz.
                    </p>
                  )}
                  {mode === "transfer" && (
                    <p>
                      Displays system alignment and roll-off slope (-12dB/octave closed, -24dB/octave ported).
                    </p>
                  )}
                  {mode === "spl" && (
                    <p>
                      Predicts maximum acoustic output in dB SPL at {activeProject.distance}m under total load {activeProject.inputPower}W.
                    </p>
                  )}
                </div>
                {/* Drag Resizer Handle Bar */}
                <div
                  onMouseDown={(e) => handleResizeStart(e, mode)}
                  className="h-3 w-full cursor-row-resize bg-transparent hover:bg-[var(--accent-color)]/10 active:bg-[var(--accent-color)]/20 border-t border-transparent hover:border-[var(--accent-color)]/10 rounded-b-xl transition flex items-center justify-center text-2xs tracking-widest opacity-60 hover:text-[var(--accent-color)] select-none mt-2"
                >
                  ••••••••••••••••
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Settings Modal */}
      {showSettings && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-6 overflow-y-auto animate-fadeIn" style={{ color: "var(--text-color)" }}>
          <div className="border w-full max-w-lg rounded-xl shadow-2xl overflow-hidden flex flex-col my-8" style={{ backgroundColor: "var(--sidebar-color)", borderColor: "var(--graph-grid-color)" }}>
            <div className="p-5 border-b flex items-center justify-between" style={{ borderColor: "var(--graph-grid-color)" }}>
              <h3 className="text-lg font-bold">App Settings</h3>
              <button
                onClick={() => setShowSettings(false)}
                className="p-1 rounded transition cursor-pointer opacity-70 hover:opacity-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-6 flex flex-col gap-6 max-h-[70vh] overflow-y-auto">
              {/* Theme Settings */}
              <div className="flex flex-col gap-4 border-b pb-5" style={{ borderColor: "var(--graph-grid-color)" }}>
                <h4 className="text-sm font-bold uppercase tracking-wider" style={{ color: "var(--accent-color)" }}>Appearance & Color Customizer</h4>

                {/* Theme presets */}
                <Select
                  label="Theme Presets"
                  value={activePresetKey}
                  onChange={(val) => {
                    if (val && val !== "custom") {
                      setCurrentTheme(PRESETS[val]);
                    }
                  }}
                  options={[
                    ...Object.keys(PRESETS).map((key) => ({ value: key, label: PRESETS[key].name })),
                    ...(activePresetKey === "custom" ? [{ value: "custom", label: "Custom Theme" }] : []),
                  ]}
                />

                {/* Customizer grid */}
                <div className="grid grid-cols-2 gap-4 text-xs">
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={currentTheme.bgColor}
                      onChange={(e) => handleCustomColorChange("bgColor", e.target.value)}
                      className="w-7 h-7 rounded border bg-transparent cursor-pointer"
                      style={{ borderColor: "var(--graph-grid-color)" }}
                    />
                    <span>Background</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={currentTheme.sidebarColor}
                      onChange={(e) => handleCustomColorChange("sidebarColor", e.target.value)}
                      className="w-7 h-7 rounded border bg-transparent cursor-pointer"
                      style={{ borderColor: "var(--graph-grid-color)" }}
                    />
                    <span>Sidebar</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={currentTheme.textColor}
                      onChange={(e) => handleCustomColorChange("textColor", e.target.value)}
                      className="w-7 h-7 rounded border bg-transparent cursor-pointer"
                      style={{ borderColor: "var(--graph-grid-color)" }}
                    />
                    <span>Text Color</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={currentTheme.accentColor}
                      onChange={(e) => handleCustomColorChange("accentColor", e.target.value)}
                      className="w-7 h-7 rounded border bg-transparent cursor-pointer"
                      style={{ borderColor: "var(--graph-grid-color)" }}
                    />
                    <span>Highlight Accent</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={currentTheme.graphLineColor}
                      onChange={(e) => handleCustomColorChange("graphLineColor", e.target.value)}
                      className="w-7 h-7 rounded border bg-transparent cursor-pointer"
                      style={{ borderColor: "var(--graph-grid-color)" }}
                    />
                    <span>Graph Line</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={currentTheme.graphGridColor}
                      onChange={(e) => handleCustomColorChange("graphGridColor", e.target.value)}
                      className="w-7 h-7 rounded border bg-transparent cursor-pointer"
                      style={{ borderColor: "var(--graph-grid-color)" }}
                    />
                    <span>Graph Grid</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={currentTheme.textMutedColor}
                      onChange={(e) => handleCustomColorChange("textMutedColor", e.target.value)}
                      className="w-7 h-7 rounded border bg-transparent cursor-pointer"
                      style={{ borderColor: "var(--graph-grid-color)" }}
                    />
                    <span>Muted Text</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={currentTheme.warningColor}
                      onChange={(e) => handleCustomColorChange("warningColor", e.target.value)}
                      className="w-7 h-7 rounded border bg-transparent cursor-pointer"
                      style={{ borderColor: "var(--graph-grid-color)" }}
                    />
                    <span>Warning</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={currentTheme.dangerColor}
                      onChange={(e) => handleCustomColorChange("dangerColor", e.target.value)}
                      className="w-7 h-7 rounded border bg-transparent cursor-pointer"
                      style={{ borderColor: "var(--graph-grid-color)" }}
                    />
                    <span>Danger</span>
                  </div>
                </div>
              </div>

              {/* Calibration Settings for Graph Viewport limits */}
              <div className="flex flex-col gap-4">
                <h4 className="text-sm font-bold uppercase tracking-wider" style={{ color: "var(--accent-color)" }}>Graph Viewport Calibration</h4>

                {/* Global X-Axis settings */}
                <div className="p-4 rounded border flex flex-col gap-3"
                  style={{ backgroundColor: "var(--bg-color)", borderColor: "var(--graph-grid-color)" }}>
                  <div className="text-xs font-semibold block opacity-70">Global X-Axis Limits</div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-2xs opacity-70 block mb-1">Global Min Freq (Hz)</label>
                      <input
                        type="number"
                        min="1"
                        value={globalXMin}
                        onChange={(e) => setGlobalXMin(Math.max(1, parseInt(e.target.value) || 10))}
                        className="w-full border rounded px-2.5 py-1.5 text-xs font-mono"
                        style={{ backgroundColor: "var(--bg-color)", borderColor: "var(--graph-grid-color)", color: "var(--text-color)" }}
                      />
                    </div>
                    <div>
                      <label className="text-2xs opacity-70 block mb-1">Global Max Freq (Hz)</label>
                      <input
                        type="number"
                        min="10"
                        value={globalXMax}
                        onChange={(e) => setGlobalXMax(Math.max(10, parseInt(e.target.value) || 2000))}
                        className="w-full border rounded px-2.5 py-1.5 text-xs font-mono"
                        style={{ backgroundColor: "var(--bg-color)", borderColor: "var(--graph-grid-color)", color: "var(--text-color)" }}
                      />
                    </div>
                  </div>
                </div>

                {/* Select graph to edit */}
                <Select
                  label="Select Curve to Calibrate"
                  value={configEditType}
                  onChange={(val) => setConfigEditType(val as CurveType)}
                  options={[
                    { value: "transfer", label: "Gain (dB)" },
                    { value: "spl", label: "SPL (dB SPL)" },
                    { value: "phase", label: "Phase Response (°)" },
                    { value: "group_delay", label: "Group Delay (ms)" },
                    { value: "excursion", label: "Cone Excursion (mm)" },
                    ...(activeProject.enclosureType !== "sealed" ? [{ value: "velocity", label: "Port Air Velocity (m/s)" }] : []),
                    { value: "impedance", label: "System Impedance (Ω)" },
                  ]}
                />

                <div className="p-4 rounded border flex flex-col gap-4"
                  style={{ backgroundColor: "var(--bg-color)", borderColor: "var(--graph-grid-color)" }}>
                  {/* Auto-Scale Y */}
                  <div className="flex items-center justify-between border-b pb-3" style={{ borderColor: "var(--graph-grid-color)" }}>
                    <div>
                      <span className="text-xs font-semibold block">Auto-Scale Y-Axis</span>
                      <span className="text-2xs opacity-60">Fits values dynamically to fit screen</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => updateViewportConfig(configEditType, "autoScaleY", !graphConfigs[configEditType].autoScaleY)}
                      className="w-10 h-5.5 flex items-center rounded-full p-0.5 transition-colors duration-200 focus:outline-none cursor-pointer"
                      style={{ backgroundColor: graphConfigs[configEditType].autoScaleY ? "var(--accent-color)" : "var(--graph-grid-color)" }}
                    >
                      <span
                        className={`bg-white w-4.5 h-4.5 rounded-full shadow transform transition-transform duration-200 ${
                          graphConfigs[configEditType].autoScaleY ? "translate-x-4.5" : "translate-x-0"
                         }`}
                      />
                    </button>
                  </div>

                  {/* Override X Limits Toggle */}
                  <div className="flex items-center justify-between border-b pb-3" style={{ borderColor: "var(--graph-grid-color)" }}>
                    <div>
                      <span className="text-xs font-semibold block">Override Global X-Axis</span>
                      <span className="text-2xs opacity-60">Set custom min/max freq just for this curve</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setOverrideXLimits(prev => ({ ...prev, [configEditType]: !prev[configEditType] }))}
                      className="w-10 h-5.5 flex items-center rounded-full p-0.5 transition-colors duration-200 focus:outline-none cursor-pointer"
                      style={{ backgroundColor: overrideXLimits[configEditType] ? "var(--accent-color)" : "var(--graph-grid-color)" }}
                    >
                      <span
                        className={`bg-white w-4.5 h-4.5 rounded-full shadow transform transition-transform duration-200 ${
                          overrideXLimits[configEditType] ? "translate-x-4.5" : "translate-x-0"
                        }`}
                      />
                    </button>
                  </div>

                  {/* X Axis boundaries (Only visible if override is checked) */}
                  {overrideXLimits[configEditType] ? (
                    <div className="grid grid-cols-2 gap-3 animate-fadeIn">
                      <div>
                        <label className="text-2xs opacity-70 block mb-1">X-Axis Min Frequency (Hz)</label>
                        <input
                          type="number"
                          min="1"
                          value={graphConfigs[configEditType].xMin}
                          onChange={(e) => updateViewportConfig(configEditType, "xMin", Math.max(1, parseInt(e.target.value) || 10))}
                          className="w-full border rounded px-2.5 py-1.5 text-xs font-mono"
                          style={{ backgroundColor: "var(--bg-color)", borderColor: "var(--graph-grid-color)", color: "var(--text-color)" }}
                        />
                      </div>
                      <div>
                        <label className="text-2xs opacity-70 block mb-1">X-Axis Max Frequency (Hz)</label>
                        <input
                          type="number"
                          min="10"
                          value={graphConfigs[configEditType].xMax}
                          onChange={(e) => updateViewportConfig(configEditType, "xMax", Math.max(10, parseInt(e.target.value) || 2000))}
                          className="w-full border rounded px-2.5 py-1.5 text-xs font-mono"
                          style={{ backgroundColor: "var(--bg-color)", borderColor: "var(--graph-grid-color)", color: "var(--text-color)" }}
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="text-2xs opacity-60 font-medium italic py-2 text-center border rounded animate-fadeIn select-none" style={{ backgroundColor: "var(--bg-color)", borderColor: "var(--graph-grid-color)" }}>
                      Using global X-limits ({globalXMin} Hz - {globalXMax} Hz)
                    </div>
                  )}

                  {/* Y Axis boundaries */}
                  {!graphConfigs[configEditType].autoScaleY && (() => {
                    const yUnit = configEditType === "phase"       ? "°"
                                : configEditType === "group_delay" ? "ms"
                                : configEditType === "excursion"   ? "mm"
                                : configEditType === "velocity"    ? "m/s"
                                : configEditType === "impedance"   ? "Ω"
                                : configEditType === "spl"         ? "dB SPL"
                                :                                    "dB";
                    return (
                      <div className="grid grid-cols-2 gap-3 animate-fadeIn">
                        <div>
                          <label className="text-2xs opacity-70 block mb-1">Y-Axis Floor ({yUnit})</label>
                          <input
                            type="number"
                            value={graphConfigs[configEditType].yMin}
                            onChange={(e) => updateViewportConfig(configEditType, "yMin", parseFloat(e.target.value) || 0)}
                            className="w-full border rounded px-2.5 py-1.5 text-xs font-mono"
                          style={{ backgroundColor: "var(--bg-color)", borderColor: "var(--graph-grid-color)", color: "var(--text-color)" }}
                          />
                        </div>
                        <div>
                          <label className="text-2xs opacity-70 block mb-1">Y-Axis Ceiling ({yUnit})</label>
                          <input
                            type="number"
                            value={graphConfigs[configEditType].yMax}
                            onChange={(e) => updateViewportConfig(configEditType, "yMax", parseFloat(e.target.value) || 10)}
                            className="w-full border rounded px-2.5 py-1.5 text-xs font-mono"
                          style={{ backgroundColor: "var(--bg-color)", borderColor: "var(--graph-grid-color)", color: "var(--text-color)" }}
                          />
                        </div>
                      </div>
                    );
                  })()}
                </div>
              </div>
            </div>

            <div className="p-5 border-t flex justify-end" style={{ borderColor: "var(--graph-grid-color)", backgroundColor: "var(--bg-color)" }}>
              <Button variant="primary" onClick={() => setShowSettings(false)}>
                Close Settings
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Driver Database Modal */}
      {showBrowser && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-6" style={{ color: "var(--text-color)" }}>
          <div className="border w-full max-w-3xl rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]" style={{ backgroundColor: "var(--sidebar-color)", borderColor: "var(--graph-grid-color)" }}>
            <div className="p-5 border-b flex items-center justify-between" style={{ borderColor: "var(--graph-grid-color)" }}>
              <div>
                <h3 className="text-lg font-bold">Driver Database</h3>
                <p className="text-xs opacity-70">Select an existing driver or add a new one to the database</p>
              </div>
              <button
                onClick={() => setShowBrowser(false)}
                className="p-1 rounded transition cursor-pointer opacity-70 hover:opacity-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-5 border-b flex gap-3 items-center" style={{ borderColor: "var(--graph-grid-color)" }}>
              <TextField
                className="flex-1"
                placeholder="Search by manufacturer or model..."
                value={searchQuery}
                onChange={setSearchQuery}
              />
              <Button variant="primary" onClick={handleStartAddDriver} className="flex items-center gap-1.5 animate-fadeIn">
                <Plus className="h-4 w-4" />
                Add Driver
              </Button>
            </div>

            <div className="flex-1 overflow-y-auto p-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {filteredDrivers.map((driver) => (
                  <div
                    key={driver.id}
                    className="border rounded-lg p-4 transition duration-150 flex flex-col justify-between"
                    style={{
                      backgroundColor: "var(--bg-color)",
                      borderColor: activeProject.driver.id === driver.id ? "var(--accent-color)" : "var(--graph-grid-color)",
                    }}
                  >
                    <div>
                      <div className="flex justify-between items-start">
                        <h4 className="font-bold text-sm">{driver.manufacturer}</h4>
                        {activeProject.driver.id === driver.id && (
                          <span className="text-2xs font-semibold border px-2 py-0.5 rounded-full" style={{ color: "var(--accent-color)", borderColor: "var(--accent-color)" }}>
                            Active
                          </span>
                        )}
                      </div>
                      <p className="text-xs opacity-70 font-medium mb-3">{driver.model}</p>

                      <div className="grid grid-cols-3 gap-2 border-t pt-2.5 text-xs opacity-70 font-mono" style={{ borderColor: "var(--graph-grid-color)" }}>
                        <div>Fs: <span style={{ color: "var(--text-color)" }}>{driver.fs}Hz</span></div>
                        <div>Qts: <span style={{ color: "var(--text-color)" }}>{driver.qts}</span></div>
                        <div>Vas: <span style={{ color: "var(--text-color)" }}>{driver.vas}L</span></div>
                        <div className="col-span-3 mt-1 text-2xs opacity-60">
                          Sens: <span className="font-semibold" style={{ color: "var(--accent-color)" }}>{driver.sens} dB @ 1W/1m</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex gap-2 mt-4 shrink-0">
                      <button
                        onClick={() => {
                          if (browserCallback) {
                            browserCallback(driver);
                          } else {
                            updateActiveProject({
                              driver,
                              vBox: driver.vas / 2,
                            });
                          }
                          setShowBrowser(false);
                          setBrowserCallback(null);
                        }}
                        className="flex-1 py-1.5 text-xs rounded border transition font-medium cursor-pointer hover:brightness-110"
                        style={{ backgroundColor: "var(--sidebar-color)", borderColor: "var(--graph-grid-color)", color: "var(--text-color)" }}
                      >
                        Load Driver
                      </button>
                      <button
                        type="button"
                        onClick={() => handleStartEditDriver(driver)}
                        className="px-2.5 py-1.5 text-xs hover:bg-sky-600 hover:text-white rounded border hover:border-sky-500 transition cursor-pointer flex items-center justify-center shrink-0"
                        style={{ backgroundColor: "var(--sidebar-color)", borderColor: "var(--graph-grid-color)", color: "var(--text-color)" }}
                        title="Edit driver specs"
                      >
                        <Edit3 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
                {filteredDrivers.length === 0 && (
                  <div className="col-span-2 flex flex-col items-center gap-2 text-center py-10 opacity-60">
                    <Database className="h-6 w-6" />
                    <span className="text-sm">No drivers found matching your search.</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add Driver Modal */}
      {showAddForm && (
        <div className="fixed inset-0 z-55 bg-black/70 backdrop-blur-sm flex items-center justify-center p-6" style={{ color: "var(--text-color)" }}>
          <div className="border w-full max-w-2xl rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]" style={{ backgroundColor: "var(--sidebar-color)", borderColor: "var(--graph-grid-color)" }}>
            <div className="p-5 border-b flex items-center justify-between" style={{ borderColor: "var(--graph-grid-color)" }}>
              <h3 className="text-lg font-bold">{editingDriverId ? "Edit Driver" : "Add Custom Driver"}</h3>
              <button
                onClick={() => setShowAddForm(false)}
                className="p-1 rounded transition cursor-pointer opacity-70 hover:opacity-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleAddDriver} className="flex-1 overflow-y-auto p-6 flex flex-col gap-5">
              <div className="grid grid-cols-2 gap-4">
                <TextField label="Manufacturer *" required placeholder="e.g. B&C Speakers" value={newManufacturer} onChange={setNewManufacturer} />
                <TextField label="Model / Name *" required placeholder="e.g. 21SW115" value={newModel} onChange={setNewModel} />
              </div>

              <div className="border-t pt-4" style={{ borderColor: "var(--graph-grid-color)" }}>
                <div className="flex justify-between items-center mb-3">
                  <div className="flex gap-1.5 items-center text-xs font-bold uppercase tracking-wider" style={{ color: "var(--accent-color)" }}>
                    <Sliders className="h-4 w-4" />
                    <span>Thiele-Small Parameters</span>
                  </div>

                  {/* Quick helper inputs for estimation */}
                  <div className="flex items-center gap-2 text-xs border rounded px-2.5 py-1" style={{ borderColor: "var(--graph-grid-color)", backgroundColor: "var(--bg-color)" }}>
                    <span className="opacity-60 font-semibold uppercase text-2xs tracking-wider shrink-0">Estimator Helpers:</span>
                    <div className="flex items-center gap-1">
                      <span className="opacity-50">Dia:</span>
                      <input
                        type="number"
                        placeholder="Piston (in)"
                        value={pistonDiameter}
                        onChange={(e) => setPistonDiameter(e.target.value)}
                        className="w-16 border rounded px-1.5 py-0.5 text-center focus:outline-none text-2xs"
                        style={{ backgroundColor: "var(--sidebar-color)", borderColor: "var(--graph-grid-color)", color: "var(--text-color)" }}
                      />
                    </div>
                    <div className="flex items-center gap-1 border-l pl-2" style={{ borderColor: "var(--graph-grid-color)" }}>
                      <span className="opacity-50">Imp:</span>
                      <select
                        value={nominalImpedance}
                        onChange={(e) => setNominalImpedance(e.target.value)}
                        className="rounded px-1.5 py-0.5 focus:outline-none text-2xs"
                      >
                        <option value="1">1 Ω</option>
                        <option value="2">2 Ω</option>
                        <option value="4">4 Ω</option>
                        <option value="8">8 Ω</option>
                        <option value="16">16 Ω</option>
                      </select>
                    </div>
                    <button
                      type="button"
                      onClick={handleAutoEstimateTS}
                      className="ml-1.5 px-2 py-0.5 transition text-2xs rounded font-bold uppercase shrink-0 cursor-pointer hover:brightness-110"
                      style={{ backgroundColor: "var(--accent-color)", color: "#fff" }}
                    >
                      Estimate T/S
                    </button>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <NumberField label="Fs (Hz) *" required value={newFs} onChange={(v) => setNewFs(v.toString())} accent={false} />
                  <NumberField label="Qes *" required value={newQes} onChange={(v) => setNewQes(v.toString())} accent={false} />
                  <NumberField label="Qms *" required value={newQms} onChange={(v) => setNewQms(v.toString())} accent={false} />
                  <NumberField label="Qts (Calculated)" disabled value={newQts} onChange={() => {}} />
                  <NumberField label="Vas (Liters) *" required value={newVas} onChange={(v) => setNewVas(v.toString())} accent={false} />
                  <NumberField label="Re (Ω)" value={newRe} onChange={(v) => setNewRe(v.toString())} accent={false} />
                  <NumberField label="Sd (cm²)" value={newSd} onChange={(v) => setNewSd(v.toString())} accent={false} />
                  <NumberField label="Xmax (mm)" value={newXmax} onChange={(v) => setNewXmax(v.toString())} accent={false} />
                  <NumberField label="Sensitivity (dB @ 1W/1m) *" required value={newSens} onChange={(v) => setNewSens(v.toString())} accent={false} />
                  <NumberField label="Mms (grams)" value={newMms} onChange={(v) => setNewMms(v.toString())} accent={false} />
                  <NumberField label="Le (mH)" value={newLe} onChange={(v) => setNewLe(v.toString())} accent={false} />
                  <NumberField label="Bl (Tm)" value={newBl} onChange={(v) => setNewBl(v.toString())} accent={false} />
                  <NumberField label="Pe (Watts)" value={newPe} onChange={(v) => setNewPe(v.toString())} accent={false} />
                </div>
              </div>

              <div className="border p-4.5 rounded-lg flex gap-3 text-xs opacity-80 items-start" style={{ backgroundColor: "var(--bg-color)", borderColor: "var(--graph-grid-color)" }}>
                <Info className="h-5 w-5 shrink-0 mt-0.5" style={{ color: "var(--accent-color)" }} />
                <p>
                  * indicates a required field. Providing Qes and Qms automatically computes Qts. Sensitivity value is essential for accurate absolute dB SPL simulation.
                </p>
              </div>

              <div className="border-t pt-5 flex justify-end gap-3" style={{ borderColor: "var(--graph-grid-color)" }}>
                <Button type="button" onClick={handleVerifyParameters} className="mr-auto">
                  Verify Parameters
                </Button>
                <Button type="button" onClick={() => setShowAddForm(false)}>
                  Cancel
                </Button>
                <Button type="submit" variant="primary">
                  Save Driver
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default function App() {
  return (
    <DriverDatabaseProvider>
      <ModalsProvider>
        <ThemeProvider>
          <ProjectsProvider>
            <SignalProcessingProvider>
              <GraphViewportProvider>
                <SimulationProvider>
                  <AppShell />
                </SimulationProvider>
              </GraphViewportProvider>
            </SignalProcessingProvider>
          </ProjectsProvider>
        </ThemeProvider>
      </ModalsProvider>
    </DriverDatabaseProvider>
  );
}
