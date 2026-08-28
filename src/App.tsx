import { useState, useEffect } from "react";
import { Sliders, Database, X, Plus, Info, Edit3 } from "lucide-react";
import { PRESETS } from "./theme";
import { findLFCrossover } from "./lib/calculations";
import { Button, TextField, NumberField, Select } from "./components/ui";
import { Driver, CurveType, EnclosureType } from "./types";
import Sidebar from "./components/sidebar/Sidebar";
import DriverTab from "./components/sidebar/DriverTab";
import EnclosureTab from "./components/sidebar/EnclosureTab";
import SignalTab from "./components/sidebar/SignalTab";
import Dashboard from "./components/dashboard/Dashboard";
import { ThemeProvider, useThemeContext } from "./context/ThemeContext";
import { ModalsProvider, useModalsContext } from "./context/ModalsContext";
import { DriverDatabaseProvider, useDriverDatabaseContext } from "./context/DriverDatabaseContext";
import { SignalProcessingProvider, useSignalProcessingContext } from "./context/SignalProcessingContext";
import { ProjectsProvider, useProjectsContext } from "./context/ProjectsContext";
import { GraphViewportProvider, useGraphViewportContext } from "./context/GraphViewportContext";
import { SimulationProvider, useSimulationContext } from "./context/SimulationContext";
import { DriverFormProvider, useDriverFormContext } from "./context/DriverFormContext";
import "./App.css";

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

  const {
    projects, activeProjectId, activeProject,
    undo, redo, updateActiveProject,
  } = useProjectsContext();

  const [hoveredFreq, setHoveredFreq] = useState<number | null>(null);

  const { showSettings, setShowSettings, sidebarTab, sidebarSectionState } = useModalsContext();

  const {
    searchQuery, setSearchQuery, filteredDrivers,
    showBrowser, setShowBrowser, showAddForm, setShowAddForm,
    browserCallback, setBrowserCallback, setEditingDriverId,
  } = useDriverDatabaseContext();

  const { filters, roomConfig, cabinConfig } = useSignalProcessingContext();

  const {
    visibleGraphs, setVisibleGraphs,
    dashboardWidth, graphHeights, handleResizeStart,
    graphConfigs, updateViewportConfig,
    globalXMin, setGlobalXMin, globalXMax, setGlobalXMax, overrideXLimits, setOverrideXLimits,
    getGraphXLimits, configEditType, setConfigEditType,
    rulerFreq, setRulerFreq,
  } = useGraphViewportContext();

  const {
    simulationResults, kaWarningFreq, getDisplayValue, phaseGdData,
    filterGainFn, roomCorrectionFn, filterLinearFn, cabinGainFn,
    svgRefsMap, showExportMenu, setShowExportMenu,
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

          {sidebarTab === "signal" && <SignalTab />}
      </Sidebar>

      {/* Main stacked graph list dashboard */}
      <Dashboard>
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
      </Dashboard>

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
