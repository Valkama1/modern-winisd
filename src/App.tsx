import { useEffect } from "react";
import { Sliders, Database, X, Plus, Info, Edit3 } from "lucide-react";
import { Button, TextField, NumberField } from "./components/ui";
import { Driver, EnclosureType } from "./types";
import Sidebar from "./components/sidebar/Sidebar";
import DriverTab from "./components/sidebar/DriverTab";
import EnclosureTab from "./components/sidebar/EnclosureTab";
import SignalTab from "./components/sidebar/SignalTab";
import Dashboard from "./components/dashboard/Dashboard";
import GraphPanel from "./components/dashboard/GraphPanel";
import SettingsModal from "./components/modals/SettingsModal";
import { ThemeProvider } from "./context/ThemeContext";
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
  const {
    projects, activeProjectId, activeProject,
    undo, redo, updateActiveProject,
  } = useProjectsContext();

  const { sidebarTab, sidebarSectionState } = useModalsContext();

  const {
    searchQuery, setSearchQuery, filteredDrivers,
    showBrowser, setShowBrowser, showAddForm, setShowAddForm,
    browserCallback, setBrowserCallback, setEditingDriverId,
  } = useDriverDatabaseContext();

  const { filters, roomConfig, cabinConfig } = useSignalProcessingContext();

  const {
    visibleGraphs, setVisibleGraphs,
    graphHeights,
    graphConfigs,
    globalXMin, globalXMax, overrideXLimits,
    rulerFreq,
  } = useGraphViewportContext();

  const { showExportMenu, setShowExportMenu } = useSimulationContext();

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
        {visibleGraphs.map((mode) => (
          <GraphPanel key={mode} mode={mode} />
        ))}
      </Dashboard>

      <SettingsModal />

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
