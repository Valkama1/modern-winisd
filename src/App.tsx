import { useState, useEffect } from "react";
import { Sliders, Database, X, Plus, Info, Copy, Trash2, Edit3, Undo2, Redo2, Download, FileText, ChevronDown, Ruler } from "lucide-react";
import { PRESETS } from "./theme";
import { findLFCrossover } from "./lib/calculations";
import { useDialog, Tooltip, Button, TextField, NumberField, Select, CollapsibleSection } from "./components/ui";
import { Driver, CurveType, EnclosureType, EqFilter, SpeakerPos } from "./types";
import Sidebar from "./components/sidebar/Sidebar";
import DriverTab from "./components/sidebar/DriverTab";
import EnclosureTab from "./components/sidebar/EnclosureTab";
import { ThemeProvider, useThemeContext } from "./context/ThemeContext";
import { ModalsProvider, useModalsContext } from "./context/ModalsContext";
import { DriverDatabaseProvider, useDriverDatabaseContext } from "./context/DriverDatabaseContext";
import { SignalProcessingProvider, useSignalProcessingContext } from "./context/SignalProcessingContext";
import { ProjectsProvider, useProjectsContext } from "./context/ProjectsContext";
import { GraphViewportProvider, useGraphViewportContext } from "./context/GraphViewportContext";
import { SimulationProvider, useSimulationContext } from "./context/SimulationContext";
import { DriverFormProvider, useDriverFormContext } from "./context/DriverFormContext";
import "./App.css";

const SPEAKER_COLORS = ["#10b981", "#f59e0b", "#ef4444", "#a855f7", "#06b6d4", "#ec4899"];

// Add/Edit Driver Modal — rendered only while showAddForm is true, inside
// DriverFormProvider's subtree. It calls useDriverFormContext() at its own top level
// (always safe, even though the whole component is conditionally mounted — this is
// how the Rules of Hooks are satisfied here). editingDriverId/setShowAddForm/drivers
// come from useDriverDatabaseContext(), which this component is also free to call
// directly since it's a context hook, not app-root-local state.
//
// NOTE for Task 21: this component is written to be lifted verbatim into its own
// AddDriverModal.tsx file — keep its name and shape stable.
function AddDriverModalInline() {
  const driverForm = useDriverFormContext();
  const { editingDriverId, setShowAddForm, drivers } = useDriverDatabaseContext();

  // Pre-fill the 14 form fields from the driver being edited. DriverFormProvider (and
  // therefore this hook's state) mounts fresh each time the modal opens, so the fields
  // already sit at their defaults (which match the "Add New Driver" reset values) —
  // this effect only needs to override them when editingDriverId is non-null.
  useEffect(() => {
    if (!editingDriverId) return;
    const driver = drivers.find((d) => d.id === editingDriverId);
    if (!driver) return;
    driverForm.setNewManufacturer(driver.manufacturer);
    driverForm.setNewModel(driver.model);
    driverForm.setNewFs(driver.fs.toString());
    driverForm.setNewQes(driver.qes.toString());
    driverForm.setNewQms(driver.qms.toString());
    driverForm.setNewQts(driver.qts.toString());
    driverForm.setNewVas(driver.vas.toString());
    driverForm.setNewRe(driver.re.toString());
    driverForm.setNewSd(driver.sd.toString());
    driverForm.setNewXmax(driver.xmax.toString());
    driverForm.setNewMms(driver.mms.toString());
    driverForm.setNewLe(driver.le.toString());
    driverForm.setNewBl(driver.bl.toString());
    driverForm.setNewPe(driver.pe.toString());
    driverForm.setNewSens(driver.sens.toString());
    driverForm.setPistonDiameter("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editingDriverId]);

  const {
    newManufacturer, setNewManufacturer, newModel, setNewModel,
    newFs, setNewFs, newQes, setNewQes, newQms, setNewQms, newQts,
    newVas, setNewVas, newRe, setNewRe, newSd, setNewSd, newXmax, setNewXmax,
    newMms, setNewMms, newLe, setNewLe, newBl, setNewBl, newPe, setNewPe, newSens, setNewSens,
    pistonDiameter, setPistonDiameter, nominalImpedance, setNominalImpedance,
    handleAddDriver, handleAutoEstimateTS, handleVerifyParameters,
  } = driverForm;

  return (
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
  );
}

function AppShell() {
  // Theme state
  const { currentTheme, setCurrentTheme, handleCustomColorChange, activePresetKey } = useThemeContext();

  const { confirmDialog } = useDialog();

  const {
    projects, activeProjectId, setActiveProjectId, activeProject,
    canUndo, canRedo, undo, redo, setProjectsWithHistory, updateActiveProject,
    handleAddNewProject, handleDuplicateProject,
    handleRenameProject, handleRemoveProject,
  } = useProjectsContext();

  const [hoveredFreq, setHoveredFreq] = useState<number | null>(null);
  const [showDropdown, setShowDropdown] = useState(false);

  const { showSettings, setShowSettings, sidebarTab, sidebarSectionState, toggleSidebarSection } = useModalsContext();

  const {
    searchQuery, setSearchQuery, filteredDrivers,
    showBrowser, setShowBrowser, showAddForm, setShowAddForm,
    browserCallback, setBrowserCallback, setEditingDriverId,
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
    simulationResults, kaWarningFreq, getDisplayValue, phaseGdData,
    filterGainFn, roomCorrectionFn, filterLinearFn, cabinGainFn,
    svgRefsMap, showExportMenu, setShowExportMenu, handleExportSVG, handleExportPNG, handleExportSummary,
  } = useSimulationContext();

  // Draggable Ruler State
  const [isDraggingRuler, setIsDraggingRuler] = useState(false);

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

  // handleStartEditDriver/handleStartAddDriver: the 14 Add/Edit Driver form fields now
  // live inside useDriverForm, which is only reachable within DriverFormProvider's
  // subtree (scoped to the Add/Edit Driver Modal, mounted only while showAddForm is
  // true). These two handlers only touch state that's still reachable from AppShell
  // (editingDriverId/showAddForm, via useDriverDatabaseContext). Because
  // DriverFormProvider mounts fresh each time the modal opens, useDriverForm's fields
  // already reset to their defaults on mount (which match handleStartAddDriver's old
  // reset values exactly); AddDriverModalInline's own effect pre-fills them from the
  // driver being edited whenever editingDriverId is non-null on mount.
  const handleStartEditDriver = (driver: Driver) => {
    setEditingDriverId(driver.id);
    setShowAddForm(true);
  };

  const handleStartAddDriver = () => {
    setEditingDriverId(null);
    setShowAddForm(true);
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
      <Sidebar>
          {sidebarTab === "driver" && <DriverTab />}

          {sidebarTab === "enclosure" && <EnclosureTab />}

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
      </Sidebar>

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
        <DriverFormProvider>
          <AddDriverModalInline />
        </DriverFormProvider>
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
