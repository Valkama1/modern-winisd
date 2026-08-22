import { useState, useEffect, useMemo, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { open, save } from "@tauri-apps/plugin-dialog";
import { Sliders, Activity, FolderOpen, Save, FilePlus, Database, X, Plus, Info, Settings } from "lucide-react";
import { AppTheme, PRESETS, applyTheme, saveTheme, loadSavedTheme } from "./theme";
import "./App.css";

interface Driver {
  id: string;
  manufacturer: string;
  model: string;
  fs: number;
  qts: number;
  qes: number;
  qms: number;
  vas: number;
  re: number;
  sd: number;
  xmax: number;
  mms: number;
  le: number;
  bl: number;
  pe: number;
  sens: number;
}

interface SimPoint {
  frequency: number;
  db: number;
}

type CurveType = "transfer" | "spl" | "excursion" | "velocity" | "impedance";

export type EnclosureType =
  | "sealed"
  | "ported"
  | "bandpass4"
  | "bandpass6_parallel"
  | "bandpass6_series"
  | "passive_radiator"
  | "custom";

// Custom topology types — field names match Rust serde snake_case
interface CustomPortSpec {
  diameter_cm: number;
  tuning_freq: number;
}
interface CustomPRSpec {
  mms_g: number;
  sd_cm2: number;
  fs: number;
  qms: number;
}
interface CustomSideSpec {
  volume_liters: number;   // 0 = no chamber / open air
  port: CustomPortSpec | null;
  pr: CustomPRSpec | null;
}
interface CustomTopologySpec {
  rear: CustomSideSpec;
  front: CustomSideSpec;
  internal_port: CustomPortSpec | null;
}

const DEFAULT_CUSTOM: CustomTopologySpec = {
  rear:  { volume_liters: 80, port: null, pr: null },
  front: { volume_liters: 0,  port: null, pr: null },
  internal_port: null,
};
const DEFAULT_PORT: CustomPortSpec = { diameter_cm: 10, tuning_freq: 35 };
const DEFAULT_PR: CustomPRSpec = { mms_g: 300, sd_cm2: 1680, fs: 25, qms: 5 };

interface GraphViewportConfig {
  xMin: number;
  xMax: number;
  yMin: number;
  yMax: number;
  autoScaleY: boolean;
}

// ── Topology diagram shown inside the Custom Topology Builder ──
function CustomTopologyDiagram({ topo }: { topo: CustomTopologySpec }) {
  const { rear, front, internal_port } = topo;
  const hasFront = front.volume_liters > 0;

  const Block = ({ label, sub, dim }: { label: string; sub?: string; dim?: boolean }) => (
    <div className={`flex flex-col items-center justify-center border rounded px-1.5 py-1 min-w-0 ${dim ? "opacity-40" : ""}`}
      style={{ borderColor: "var(--graph-grid-color)", backgroundColor: "var(--bg-color)", fontSize: 9, lineHeight: 1.3 }}>
      <span className="font-bold truncate">{label}</span>
      {sub && <span className="opacity-60 truncate">{sub}</span>}
    </div>
  );

  const Arrow = ({ label, vertical }: { label?: string; vertical?: boolean }) => (
    <div className={`flex items-center justify-center ${vertical ? "flex-col" : ""} shrink-0`}
      style={{ color: "var(--accent-color)", fontSize: 9, gap: 1, opacity: 0.75 }}>
      {label && !vertical && <span>{label}</span>}
      <span>{vertical ? "↓" : "→"}</span>
      {label && vertical && <span>{label}</span>}
    </div>
  );

  return (
    <div className="border rounded p-2 flex flex-col gap-1.5"
      style={{ borderColor: "var(--graph-grid-color)", backgroundColor: "var(--bg-color)", fontSize: 9 }}>
      {/* Top row: [OUTSIDE?] ← Port ← Rear Ch ← DRIVER → FrontCh/Air → Port → OUTSIDE */}
      <div className="flex items-center gap-1 justify-center flex-wrap">
        {/* Rear side: outward path */}
        {rear.port && <>
          <Block label="OUTSIDE" />
          <Arrow label={`${rear.port.tuning_freq}Hz`} />
        </>}
        {rear.pr && <>
          <Block label="OUTSIDE" />
          <Arrow label="PR" />
        </>}
        <Block label={`Rear Ch.`} sub={`${rear.volume_liters}L`} />

        {/* Driver */}
        <div className="flex items-center gap-0.5 shrink-0">
          <span style={{ color: "var(--accent-color)", fontSize: 10 }}>◉</span>
          <span className="font-bold" style={{ fontSize: 9 }}>DRV</span>
          <span style={{ color: "var(--accent-color)", fontSize: 10 }}>◉</span>
        </div>

        {/* Front side */}
        {hasFront ? (
          <>
            <Block label="Front Ch." sub={`${front.volume_liters}L`} />
            {front.port && <>
              <Arrow label={`${front.port.tuning_freq}Hz`} />
              <Block label="OUTSIDE" />
            </>}
            {front.pr && <>
              <Arrow label="PR" />
              <Block label="OUTSIDE" />
            </>}
            {!front.port && !front.pr && <Block label="Sealed" dim />}
          </>
        ) : (
          <>
            <Arrow />
            <Block label="OUTSIDE" sub="open air" />
          </>
        )}
      </div>

      {/* Internal port row */}
      {internal_port && (
        <div className="flex items-center justify-center gap-1" style={{ color: "var(--accent-color)" }}>
          <span style={{ fontSize: 9, opacity: 0.7 }}>↕ internal port {internal_port.tuning_freq}Hz</span>
        </div>
      )}
    </div>
  );
}

export default function App() {
  // Theme state
  const [currentTheme, setCurrentTheme] = useState<AppTheme>(loadSavedTheme());

  // Active Project State
  const [projectName, setProjectName] = useState("Untitled Project");
  const [vBox, setVBox] = useState(100);
  const [enclosureType, setEnclosureType] = useState<EnclosureType>("sealed");
  const [tuningFreq, setTuningFreq] = useState(33);
  const [portDiameter, setPortDiameter] = useState(10.0);
  const [portShape, setPortShape] = useState<"circular" | "rectangular">("circular");
  const [portCount, setPortCount] = useState(1);
  const [portWidth, setPortWidth] = useState(30.0);
  const [portHeight, setPortHeight] = useState(5.0);
  const [inputPower, setInputPower] = useState(1);
  const [distance, setDistance] = useState(1);
  const [numDrivers, setNumDrivers] = useState(1);

  // Bandpass & Passive Radiator Parameters
  const [vRear, setVRear] = useState(80);
  const [vFront, setVFront] = useState(40);
  const [frontTuningFreq, setFrontTuningFreq] = useState(55);
  const [rearTuningFreq, setRearTuningFreq] = useState(30);
  const [frontPortDiameter, setFrontPortDiameter] = useState(10.0);
  const [rearPortDiameter, setRearPortDiameter] = useState(10.0);
  const [internalPortDiameter, setInternalPortDiameter] = useState(10.0);
  const [prMms, setPrMms] = useState(300);
  const [prSd, setPrSd] = useState(1680);
  const [prFs, setPrFs] = useState(25);
  const [prQms, setPrQms] = useState(5.0);

  // Custom topology builder state
  const [customTopology, setCustomTopology] = useState<CustomTopologySpec>(DEFAULT_CUSTOM);

  // Acoustic quality parameters (shared across all enclosure types)
  const [portQ, setPortQ] = useState(50);               // port loss Q factor
  const [splEnvironment, setSplEnvironment] = useState<"half_space" | "free_field" | "corner">("half_space");

  const updateCustomRear = (patch: Partial<CustomSideSpec>) =>
    setCustomTopology(prev => ({ ...prev, rear: { ...prev.rear, ...patch } }));
  const updateCustomFront = (patch: Partial<CustomSideSpec>) =>
    setCustomTopology(prev => ({ ...prev, front: { ...prev.front, ...patch } }));
  const updateCustomRearPort = (patch: Partial<CustomPortSpec>) =>
    setCustomTopology(prev => ({
      ...prev,
      rear: { ...prev.rear, port: { ...(prev.rear.port ?? DEFAULT_PORT), ...patch } },
    }));
  const updateCustomRearPR = (patch: Partial<CustomPRSpec>) =>
    setCustomTopology(prev => ({
      ...prev,
      rear: { ...prev.rear, pr: { ...(prev.rear.pr ?? DEFAULT_PR), ...patch } },
    }));
  const updateCustomFrontPort = (patch: Partial<CustomPortSpec>) =>
    setCustomTopology(prev => ({
      ...prev,
      front: { ...prev.front, port: { ...(prev.front.port ?? DEFAULT_PORT), ...patch } },
    }));
  const updateCustomFrontPR = (patch: Partial<CustomPRSpec>) =>
    setCustomTopology(prev => ({
      ...prev,
      front: { ...prev.front, pr: { ...(prev.front.pr ?? DEFAULT_PR), ...patch } },
    }));
  const updateCustomInternalPort = (patch: Partial<CustomPortSpec>) =>
    setCustomTopology(prev => ({
      ...prev,
      internal_port: { ...(prev.internal_port ?? DEFAULT_PORT), ...patch },
    }));

  // Stacked Multi-Graph Dashboard States
  const [visibleGraphs, setVisibleGraphs] = useState<CurveType[]>(["transfer", "spl"]);
  const [hoveredFreq, setHoveredFreq] = useState<number | null>(null);
  const [showDropdown, setShowDropdown] = useState(false);

  // Responsive & Resizable Heights properties
  const dashboardContainerRef = useRef<HTMLDivElement>(null);
  const [dashboardWidth, setDashboardWidth] = useState(800);
  const [graphHeights, setGraphHeights] = useState<Record<CurveType, number>>({
    transfer: 250,
    spl: 250,
    excursion: 250,
    velocity: 250,
    impedance: 250,
  });

  const handleResizeStart = (e: React.MouseEvent, mode: CurveType) => {
    e.preventDefault();
    const startY = e.clientY;
    const startHeight = graphHeights[mode];

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const deltaY = moveEvent.clientY - startY;
      setGraphHeights((prev) => ({
        ...prev,
        [mode]: Math.max(150, Math.min(600, startHeight + deltaY)),
      }));
    };

    const handleMouseUp = () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
  };

  // Viewport Configuration Limits per Graph Mode
  const [graphConfigs, setGraphConfigs] = useState<Record<CurveType, GraphViewportConfig>>({
    transfer: { xMin: 10, xMax: 2000, yMin: -30, yMax: 10, autoScaleY: false },
    spl: { xMin: 10, xMax: 2000, yMin: 60, yMax: 140, autoScaleY: false },
    excursion: { xMin: 10, xMax: 2000, yMin: 0, yMax: 25, autoScaleY: false },
    velocity: { xMin: 10, xMax: 2000, yMin: 0, yMax: 40, autoScaleY: false },
    impedance: { xMin: 10, xMax: 2000, yMin: 0, yMax: 80, autoScaleY: false },
  });

  // Simulation Points Map
  const [simulationData, setSimulationData] = useState<Record<CurveType, SimPoint[]>>({
    transfer: [],
    spl: [],
    excursion: [],
    velocity: [],
    impedance: [],
  });

  // Settings sub-tab selection for editing limits
  const [configEditType, setConfigEditType] = useState<CurveType>("transfer");

  // Active Driver State
  const [activeDriver, setActiveDriver] = useState<Driver>({
    id: "bc-21sw115-4",
    manufacturer: "B&C Speakers",
    model: "21SW115 (4Ω)",
    fs: 33.0,
    qts: 0.36,
    qes: 0.37,
    qms: 7.7,
    vas: 278.0,
    re: 3.6,
    sd: 1680.0,
    xmax: 14.0,
    mms: 335.0,
    le: 1.7,
    bl: 24.8,
    pe: 1700.0,
    sens: 97.0,
  });

  // DB and UI states
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [showBrowser, setShowBrowser] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

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

  // Apply theme when theme state changes
  useEffect(() => {
    applyTheme(currentTheme);
    saveTheme(currentTheme);
  }, [currentTheme]);
  // Monitor dashboard container width to make graphs fully responsive
  useEffect(() => {
    if (!dashboardContainerRef.current) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setDashboardWidth(Math.max(400, entry.contentRect.width - 24));
      }
    });
    observer.observe(dashboardContainerRef.current);
    return () => observer.disconnect();
  }, []);

  // Synchronize calibration dropdown in settings with active graph view when settings opens
  useEffect(() => {
    if (showSettings && visibleGraphs.length > 0) {
      setConfigEditType(visibleGraphs[0]);
    }
  }, [showSettings, visibleGraphs]);

  // Remove velocity graph when switching to sealed (no ports)
  useEffect(() => {
    const noPortTypes: EnclosureType[] = ["sealed"];
    if (noPortTypes.includes(enclosureType) && visibleGraphs.includes("velocity")) {
      setVisibleGraphs(visibleGraphs.filter((g) => g !== "velocity"));
    }
  }, [enclosureType, visibleGraphs]);

  // Load drivers from database
  const refreshDrivers = async () => {
    try {
      const dbDrivers: Driver[] = await invoke("get_drivers");
      setDrivers(dbDrivers);
    } catch (err) {
      console.error("Failed to fetch drivers:", err);
    }
  };

  useEffect(() => {
    refreshDrivers();
  }, []);

  // Recalculate Qts if Qes or Qms changes
  useEffect(() => {
    const qes = parseFloat(newQes);
    const qms = parseFloat(newQms);
    if (!isNaN(qes) && !isNaN(qms) && qes + qms > 0) {
      const calculatedQts = (qes * qms) / (qes + qms);
      setNewQts(calculatedQts.toFixed(3));
    }
  }, [newQes, newQms]);

  // Run simulation for all active graphs in parallel
  useEffect(() => {
    async function runSims() {
      try {
        const newSimData = { ...simulationData };
        await Promise.all(
          visibleGraphs.map(async (mode) => {
            const cfg = graphConfigs[mode];
            let result: SimPoint[];

            if (enclosureType === "custom") {
              result = await invoke("simulate_custom", {
                driver: activeDriver,
                customTopology,
                inputPower: parseFloat(String(inputPower)) || 1.0,
                distance: parseFloat(String(distance)) || 1.0,
                numDrivers: parseInt(String(numDrivers)) || 1,
                curveType: mode,
                fMin: cfg.xMin,
                fMax: cfg.xMax,
                portQ,
                splEnvironment,
              });
            } else {
              result = await invoke("simulate_system", {
                driver: activeDriver,
                vBox: parseFloat(String(vBox)) || 1.0,
                enclosureType,
                tuningFreq: parseFloat(String(tuningFreq)) || 1.0,
                portDiameter: parseFloat(String(portDiameter)) || 10.0,
                inputPower: parseFloat(String(inputPower)) || 1.0,
                distance: parseFloat(String(distance)) || 1.0,
                numDrivers: parseInt(String(numDrivers)) || 1,
                curveType: mode,
                fMin: cfg.xMin,
                fMax: cfg.xMax,
                portShape,
                portCount: parseInt(String(portCount)) || 1,
                portWidth: parseFloat(String(portWidth)) || 10.0,
                portHeight: parseFloat(String(portHeight)) || 10.0,
                vRear: parseFloat(String(vRear)) || 80.0,
                vFront: parseFloat(String(vFront)) || 40.0,
                frontTuningFreq: parseFloat(String(frontTuningFreq)) || 55.0,
                rearTuningFreq: parseFloat(String(rearTuningFreq)) || 30.0,
                frontPortDiameter: parseFloat(String(frontPortDiameter)) || 10.0,
                rearPortDiameter: parseFloat(String(rearPortDiameter)) || 10.0,
                internalPortDiameter: parseFloat(String(internalPortDiameter)) || 10.0,
                prMms: parseFloat(String(prMms)) || 300.0,
                prSd: parseFloat(String(prSd)) || 1680.0,
                prFs: parseFloat(String(prFs)) || 25.0,
                prQms: parseFloat(String(prQms)) || 5.0,
                portQ,
                splEnvironment,
              });
            }

            newSimData[mode] = result;
          })
        );
        setSimulationData(newSimData);
      } catch (err) {
        console.error("Simulation failed:", err);
      }
    }
    if (visibleGraphs.length > 0) {
      runSims();
    }
  }, [
    activeDriver,
    vBox,
    enclosureType,
    tuningFreq,
    portDiameter,
    portShape,
    portCount,
    portWidth,
    portHeight,
    inputPower,
    distance,
    numDrivers,
    vRear,
    vFront,
    frontTuningFreq,
    rearTuningFreq,
    frontPortDiameter,
    rearPortDiameter,
    internalPortDiameter,
    prMms,
    prSd,
    prFs,
    prQms,
    customTopology,
    portQ,
    splEnvironment,
    visibleGraphs,
    graphConfigs,
  ]);

  // Add Driver Action
  const handleAddDriver = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newManufacturer || !newModel) {
      alert("Manufacturer and Model are required.");
      return;
    }
    const driverData: Driver = {
      id: "",
      manufacturer: newManufacturer,
      model: newModel,
      fs: parseFloat(newFs) || 0,
      qts: parseFloat(newQts) || 0,
      qes: parseFloat(newQes) || 0,
      qms: parseFloat(newQms) || 0,
      vas: parseFloat(newVas) || 0,
      re: parseFloat(newRe) || 0,
      sd: parseFloat(newSd) || 0,
      xmax: parseFloat(newXmax) || 0,
      mms: parseFloat(newMms) || 0,
      le: parseFloat(newLe) || 0,
      bl: parseFloat(newBl) || 0,
      pe: parseFloat(newPe) || 0,
      sens: parseFloat(newSens) || 0,
    };

    try {
      const updatedDrivers: Driver[] = await invoke("add_driver", { driver: driverData });
      setDrivers(updatedDrivers);
      const savedDriver = updatedDrivers[updatedDrivers.length - 1];
      setActiveDriver(savedDriver);
      setVBox(savedDriver.vas / 2);
      setShowAddForm(false);
      setShowBrowser(false);
      setNewManufacturer("");
      setNewModel("");
    } catch (err) {
      alert("Error adding driver: " + err);
    }
  };

  // Project Actions
  const handleNewProject = () => {
    if (confirm("Are you sure you want to start a new project? All unsaved changes will be lost.")) {
      setProjectName("Untitled Project");
      const defaultB_C = drivers.find((d) => d.id === "bc-21sw115-4") || activeDriver;
      setActiveDriver(defaultB_C);
      setVBox(150);
      setEnclosureType("sealed");
      setTuningFreq(33);
      setPortDiameter(10.0);
      setInputPower(1);
      setDistance(1);
      setNumDrivers(1);
      setVisibleGraphs(["transfer", "spl"]);
    }
  };

  const handleSaveProject = async () => {
    try {
      const filePath = await save({
        filters: [{ name: "WinISD Project", extensions: ["wproj"] }],
        defaultPath: `${projectName.replace(/\s+/g, "_")}.wproj`,
      });
      if (filePath) {
        await invoke("save_project", {
          path: filePath,
          state: {
            project_name: projectName,
            driver: activeDriver,
            v_box: vBox,
            enclosure_type: enclosureType,
            tuning_freq: tuningFreq,
            port_diameter: portDiameter,
            input_power: inputPower,
            distance: distance,
            num_drivers: numDrivers,
          },
        });
        const name = filePath.split(/[/\\]/).pop() || "Project";
        setProjectName(name.replace(".wproj", ""));
        alert("Project saved successfully!");
      }
    } catch (err) {
      alert("Error saving project: " + err);
    }
  };

  const handleOpenProject = async () => {
    try {
      const selected = await open({
        filters: [{ name: "WinISD Project", extensions: ["wproj"] }],
        multiple: false,
      });
      if (selected && !Array.isArray(selected)) {
        const state: any = await invoke("load_project", { path: selected });
        setProjectName(state.project_name);
        setActiveDriver(state.driver);
        setVBox(state.v_box);
        setEnclosureType(state.enclosure_type || "sealed");
        setTuningFreq(state.tuning_freq || 33);
        setPortDiameter(state.port_diameter || 10.0);
        setInputPower(state.input_power || 1);
        setDistance(state.distance || 1);
        setNumDrivers(state.num_drivers || 1);
        alert("Project loaded successfully!");
      }
    } catch (err) {
      alert("Error loading project: " + err);
    }
  };

  // Physical port length calculation (cm)
  const calculatedPortLength = useMemo(() => {
    if (enclosureType !== "ported") return 0;
    const num = numDrivers > 0 ? numDrivers : 1;
    const vBoxM3 = (vBox / num) * 1e-3;
    const count = portCount > 0 ? portCount : 1;

    let ap = 0;
    let rEq = 0;
    let delta = 0.732;

    if (portShape === "rectangular") {
      const wM = portWidth * 0.01;
      const hM = portHeight * 0.01;
      ap = count * wM * hM;
      rEq = Math.sqrt(ap / Math.PI);
      delta = 0.85; // wall correction
    } else {
      const rPortM = (portDiameter / 2.0) * 0.01;
      ap = count * Math.PI * rPortM * rPortM;
      rEq = rPortM;
      delta = 0.732; // circular correction
    }

    if (ap <= 0 || tuningFreq <= 0 || vBoxM3 <= 0) return 0;

    const c = 343.0; // speed of sound
    const term1 = (c * c * ap) / (4.0 * Math.PI * Math.PI * tuningFreq * tuningFreq * vBoxM3);
    const lengthM = term1 - delta * rEq;
    return Math.max(0.1, lengthM * 100.0);
  }, [enclosureType, vBox, numDrivers, portShape, portCount, portWidth, portHeight, portDiameter, tuningFreq]);

  // Frequency at which ka = 0.5 — the low-frequency piston radiation model starts breaking down
  // above this point for the active driver.
  const kaWarningFreq = useMemo(() => {
    const sd_m2 = activeDriver.sd * 1e-4;
    const a_rad = Math.sqrt(sd_m2 / Math.PI);
    return Math.round((0.5 * 343) / (2 * Math.PI * a_rad));
  }, [activeDriver.sd]);

  // Derived system statistics — computed analytically from T/S params + box params.
  // These update instantly without a simulation round-trip.
  const systemStats = useMemo(() => {
    type Stat = { label: string; value: string; accent?: boolean; warn?: boolean; fullWidth?: boolean };
    const stats: Stat[] = [];
    const n = Math.max(1, numDrivers);

    if (enclosureType === "sealed") {
      const vbEff = vBox / n;
      if (vbEff > 0 && activeDriver.vas > 0) {
        const alpha = activeDriver.vas / vbEff;
        const qtc   = activeDriver.qts * Math.sqrt(1 + alpha);
        const fc    = activeDriver.fs  * Math.sqrt(1 + alpha);
        // F3 of 2nd-order HP: solve |H(jω)|²=0.5 → v²+v(2−1/Qtc²)−1=0
        const b  = 2 - 1 / (qtc * qtc);
        const v  = (-b + Math.sqrt(b * b + 4)) / 2;
        const f3 = fc * Math.sqrt(Math.max(0, v));
        let alignment: string;
        const isIdeal = qtc >= 0.65 && qtc <= 0.75;
        if      (qtc < 0.5)  alignment = "Overdamped";
        else if (qtc < 0.65) alignment = "Near-flat";
        else if (qtc <= 0.75) alignment = "Butterworth B2";
        else if (qtc <= 1.0)  alignment = "Underdamped";
        else                  alignment = "Peaked";
        stats.push(
          { label: "Qtc",        value: qtc.toFixed(3), accent: isIdeal },
          { label: "Fc",         value: `${fc.toFixed(1)} Hz` },
          { label: "Est. F3",    value: `${f3.toFixed(1)} Hz` },
          { label: "α = Vas/Vb", value: alpha.toFixed(2) },
          { label: "Alignment",  value: alignment, accent: isIdeal, fullWidth: true },
        );
      }

    } else if (enclosureType === "ported") {
      const vbEff = vBox / n;
      if (vbEff > 0 && activeDriver.fs > 0) {
        const h     = tuningFreq / activeDriver.fs;
        const alpha = activeDriver.vas / vbEff;
        stats.push(
          { label: "Fb",         value: `${tuningFreq} Hz` },
          { label: "h = Fb / Fs", value: h.toFixed(3) },
          { label: "α = Vas/Vb", value: alpha.toFixed(2) },
          { label: "Vb / Vas",   value: (vbEff / activeDriver.vas).toFixed(2) },
        );
      }

    } else if (enclosureType === "bandpass4") {
      const vf = vFront > 0 ? vFront : 1;
      const vr = vRear  > 0 ? vRear  : 1;
      stats.push(
        { label: "Front Fb",  value: `${frontTuningFreq} Hz` },
        { label: "Vr / Vf",  value: (vRear / vFront).toFixed(2) },
        { label: "Rear vol",  value: `${vr} L` },
        { label: "Front vol", value: `${vf} L` },
      );

    } else if (enclosureType === "bandpass6_parallel" || enclosureType === "bandpass6_series") {
      const centerF = Math.sqrt(frontTuningFreq * rearTuningFreq);
      const bwOct   = Math.abs(Math.log2(frontTuningFreq / rearTuningFreq));
      stats.push(
        { label: "Rear Fb",     value: `${rearTuningFreq} Hz` },
        { label: "Front Fb",    value: `${frontTuningFreq} Hz` },
        { label: "Geo. center", value: `${centerF.toFixed(1)} Hz` },
        { label: "BW",          value: `${bwOct.toFixed(1)} oct` },
      );

    } else if (enclosureType === "passive_radiator") {
      const vbEff = vBox / n;
      if (vbEff > 0 && activeDriver.fs > 0) {
        const h     = prFs / activeDriver.fs;
        const alpha = activeDriver.vas / vbEff;
        stats.push(
          { label: "PR Fs",       value: `${prFs} Hz` },
          { label: "h = Fb / Fs", value: h.toFixed(3) },
          { label: "α = Vas/Vb",  value: alpha.toFixed(2) },
          { label: "Vb / Vas",    value: (vbEff / activeDriver.vas).toFixed(2) },
        );
      }
    }

    return stats;
  }, [enclosureType, activeDriver, vBox, tuningFreq, frontTuningFreq, rearTuningFreq, prFs, vRear, vFront, numDrivers]);

  // Call Tauri to optimize venting dimensions based on driver excursion and power compression limits
  const handleAutoCalculatePort = async () => {
    try {
      const rec: any = await invoke("auto_calculate_port", {
        driver: activeDriver,
        vBox: parseFloat(String(vBox)) || 1.0,
        tuningFreq: parseFloat(String(tuningFreq)) || 33.0,
        inputPower: parseFloat(String(inputPower)) || 1.0,
        numDrivers: parseInt(String(numDrivers)) || 1,
      });
      setPortShape(rec.port_shape);
      setPortCount(rec.port_count);
      if (rec.port_shape === "rectangular") {
        setPortWidth(rec.port_width);
        setPortHeight(rec.port_height);
      } else {
        setPortDiameter(rec.port_diameter);
      }
    } catch (err) {
      console.error("Auto-calculate port venting failed:", err);
      alert("Failed to auto-calculate: " + err);
    }
  };

  const filteredDrivers = useMemo(() => {
    return drivers.filter((d) => {
      const search = searchQuery.toLowerCase();
      return (
        d.manufacturer.toLowerCase().includes(search) ||
        d.model.toLowerCase().includes(search)
      );
    });
  }, [drivers, searchQuery]);
  const handleCustomColorChange = (key: keyof AppTheme, color: string) => {
    setCurrentTheme((prev) => ({
      ...prev,
      name: "Custom",
      [key]: color,
    }));
  };

  const activePresetKey = useMemo(() => {
    const matched = Object.keys(PRESETS).find(
      (key) =>
        PRESETS[key].bgColor === currentTheme.bgColor &&
        PRESETS[key].sidebarColor === currentTheme.sidebarColor &&
        PRESETS[key].textColor === currentTheme.textColor &&
        PRESETS[key].accentColor === currentTheme.accentColor &&
        PRESETS[key].graphLineColor === currentTheme.graphLineColor &&
        PRESETS[key].graphGridColor === currentTheme.graphGridColor
    );
    return matched || "custom";
  }, [currentTheme]);
  // Graph Limits & Dimensions constants
  const paddingLeft = 55;
  const paddingRight = 20;
  const paddingTop = 20;
  const paddingBottom = 40;

  const updateViewportConfig = (curve: CurveType, key: keyof GraphViewportConfig, value: any) => {
    setGraphConfigs((prev) => ({
      ...prev,
      [curve]: {
        ...prev[curve],
        [key]: value,
      },
    }));
  };

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
            <button
              onClick={() => setShowBrowser(true)}
              className="p-1.5 hover:opacity-80 rounded-md border transition cursor-pointer"
              style={{
                backgroundColor: "var(--bg-color)",
                borderColor: "var(--graph-grid-color)",
                color: "var(--accent-color)",
              }}
              title="Driver Database"
            >
              <Database className="h-4.5 w-4.5" />
            </button>
            <button
              onClick={() => setShowSettings(true)}
              className="p-1.5 hover:opacity-80 rounded-md border transition cursor-pointer"
              style={{
                backgroundColor: "var(--bg-color)",
                borderColor: "var(--graph-grid-color)",
                color: "var(--accent-color)",
              }}
              title="Settings"
            >
              <Settings className="h-4.5 w-4.5" />
            </button>
          </div>
        </div>

        {/* Project Section */}
        <div className="p-5 border-b flex flex-col gap-3" style={{ borderColor: "var(--graph-grid-color)" }}>
          <div>
            <label className="text-xs font-semibold opacity-70 uppercase tracking-wider block mb-1">
              Project Name
            </label>
            <input
              type="text"
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
              className="w-full text-sm border rounded px-2.5 py-1.5 focus:outline-none"
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
              className="flex flex-col items-center justify-center gap-1 py-2 text-xs rounded transition opacity-80 hover:opacity-100 cursor-pointer"
              style={{ backgroundColor: "var(--bg-color)", color: "var(--text-color)" }}
            >
              <FilePlus className="h-4 w-4" />
              New
            </button>
            <button
              onClick={handleOpenProject}
              className="flex flex-col items-center justify-center gap-1 py-2 text-xs rounded transition opacity-80 hover:opacity-100 cursor-pointer"
              style={{ backgroundColor: "var(--bg-color)", color: "var(--text-color)" }}
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

        {/* Scrollable inputs */}
        <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-5">
          {/* Active Driver specs */}
          <div>
            <div className="flex justify-between items-center mb-2">
              <label className="text-xs font-semibold opacity-70 uppercase tracking-wider block">
                Active Driver
              </label>
              <span
                className="text-[10px] font-mono font-bold border px-1.5 py-0.5 rounded"
                style={{
                  backgroundColor: "var(--bg-color)",
                  borderColor: "var(--graph-grid-color)",
                  color: "var(--accent-color)",
                }}
              >
                {activeDriver.sens} dB @ 1W
              </span>
            </div>
            <div className="border rounded p-3 mb-3" style={{ backgroundColor: "var(--bg-color)", borderColor: "var(--graph-grid-color)" }}>
              <h3 className="text-sm font-bold truncate">{activeDriver.manufacturer}</h3>
              <p className="text-xs opacity-75 truncate mb-2">{activeDriver.model}</p>

              <div className="grid grid-cols-3 gap-y-2 gap-x-1.5 text-center mt-2.5 border-t pt-2.5" style={{ borderColor: "var(--graph-grid-color)" }}>
                <div>
                  <div className="text-[10px] opacity-60 font-mono">Fs</div>
                  <div className="text-xs font-semibold">{activeDriver.fs} Hz</div>
                </div>
                <div>
                  <div className="text-[10px] opacity-60 font-mono">Qts</div>
                  <div className="text-xs font-semibold">{activeDriver.qts}</div>
                </div>
                <div>
                  <div className="text-[10px] opacity-60 font-mono">Vas</div>
                  <div className="text-xs font-semibold">{activeDriver.vas} L</div>
                </div>
              </div>
            </div>

            {/* Driver Count selector */}
            <div
              className="flex justify-between items-center text-xs border rounded p-2.5"
              style={{ backgroundColor: "var(--bg-color)", borderColor: "var(--graph-grid-color)" }}
            >
              <span className="opacity-75 font-semibold">Number of Drivers</span>
              <input
                type="number"
                min="1"
                max="16"
                value={numDrivers}
                onChange={(e) => setNumDrivers(parseInt(e.target.value) || 1)}
                className="w-16 border rounded px-1.5 py-0.5 text-right font-mono focus:outline-none text-xs"
                style={{
                  backgroundColor: "var(--sidebar-color)",
                  borderColor: "var(--graph-grid-color)",
                  color: "var(--accent-color)",
                }}
              />
            </div>
          </div>

          {/* Enclosure settings */}
          <div className="border-t pt-4 flex flex-col gap-4" style={{ borderColor: "var(--graph-grid-color)" }}>
            <h4 className="text-xs font-semibold opacity-70 uppercase tracking-wider block">
              Enclosure Settings
            </h4>

            <div>
              <label className="text-xs opacity-70 block mb-1">Enclosure Type</label>
              <select
                value={enclosureType}
                onChange={(e) => setEnclosureType(e.target.value as EnclosureType)}
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

            {/* Sealed & Ported & PR single chamber volume */}
            {(enclosureType === "sealed" || enclosureType === "ported" || enclosureType === "passive_radiator") && (
              <div>
                <div className="flex justify-between items-center text-xs mb-1">
                  <span className="opacity-70">Box Volume (Vb)</span>
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      value={vBox}
                      onChange={(e) => setVBox(parseFloat(e.target.value) || 0)}
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
                  max={Math.max(200, activeDriver.vas * 1.5)}
                  step="0.5"
                  value={vBox}
                  onChange={(e) => setVBox(parseFloat(e.target.value))}
                  className="w-full h-1.5 rounded-lg appearance-none cursor-pointer mt-2"
                  style={{ accentColor: "var(--accent-color)", backgroundColor: "var(--bg-color)" }}
                />
              </div>
            )}

            {/* Ported Controls */}
            {enclosureType === "ported" && (
              <>
                <div>
                  <div className="flex justify-between items-center text-xs mb-1">
                    <span className="opacity-70">Tuning Freq (Fb)</span>
                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        value={tuningFreq}
                        onChange={(e) => setTuningFreq(parseFloat(e.target.value) || 0)}
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
                    value={tuningFreq}
                    onChange={(e) => setTuningFreq(parseFloat(e.target.value))}
                    className="w-full h-1.5 rounded-lg appearance-none cursor-pointer mt-2"
                    style={{ accentColor: "var(--accent-color)", backgroundColor: "var(--bg-color)" }}
                  />
                </div>
                <div>
                  <label className="text-xs opacity-70 block mb-1">Port Shape</label>
                  <select
                    value={portShape}
                    onChange={(e) => setPortShape(e.target.value as "circular" | "rectangular")}
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
                      value={portCount}
                      onChange={(e) => setPortCount(Math.max(1, Math.min(8, parseInt(e.target.value) || 1)))}
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
                    value={portQ}
                    onChange={(e) => setPortQ(parseFloat(e.target.value))}
                    className="w-full border rounded px-2.5 py-1.5 text-xs focus:outline-none"
                    style={{ backgroundColor: "var(--bg-color)", borderColor: "var(--graph-grid-color)", color: "var(--text-color)" }}
                  >
                    <option value={50}>Circular port (Q = 50)</option>
                    <option value={30}>Slot port (Q = 30)</option>
                    <option value={100}>Low-loss / rigid port (Q = 100)</option>
                  </select>
                </div>

                {portShape === "circular" ? (
                  <div>
                    <div className="flex justify-between items-center text-xs mb-1">
                      <span className="opacity-70">Port Diameter</span>
                      <div className="flex items-center gap-1">
                        <input
                          type="number"
                          step="0.1"
                          value={portDiameter}
                          onChange={(e) => setPortDiameter(parseFloat(e.target.value) || 0)}
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
                      value={portDiameter}
                      onChange={(e) => setPortDiameter(parseFloat(e.target.value))}
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
                        value={portWidth}
                        onChange={(e) => setPortWidth(parseFloat(e.target.value) || 0)}
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
                        value={portHeight}
                        onChange={(e) => setPortHeight(parseFloat(e.target.value) || 0)}
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
                  <div className="border border-dashed rounded p-2.5 flex flex-col gap-1 text-[11px]" style={{ borderColor: "var(--graph-grid-color)" }}>
                    <div className="flex justify-between font-semibold">
                      <span className="opacity-75">Required Length:</span>
                      <span style={{ color: "var(--accent-color)" }}>{calculatedPortLength.toFixed(1)} cm</span>
                    </div>
                    <div className="opacity-65 text-[10px]">
                      Length represents the tube/slot length for *each* port to achieve Fb = {tuningFreq}Hz.
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handleAutoCalculatePort}
                    className="w-full py-2 bg-emerald-600 hover:bg-emerald-555 rounded text-xs font-semibold tracking-wide transition text-white hover:shadow-md cursor-pointer"
                  >
                    Auto-Calculate Venting
                  </button>
                </div>
              </>
            )}

            {/* 4th-Order Bandpass Controls */}
            {enclosureType === "bandpass4" && (
              <div className="flex flex-col gap-3 text-xs">
                <div>
                  <label className="text-xs opacity-70 block mb-1">Port Losses (Q factor)</label>
                  <select
                    value={portQ}
                    onChange={(e) => setPortQ(parseFloat(e.target.value))}
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
                        value={vRear}
                        onChange={(e) => setVRear(parseFloat(e.target.value) || 0)}
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
                        value={vFront}
                        onChange={(e) => setVFront(parseFloat(e.target.value) || 0)}
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
                        value={frontTuningFreq}
                        onChange={(e) => setFrontTuningFreq(parseFloat(e.target.value) || 0)}
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
                        value={frontPortDiameter}
                        onChange={(e) => setFrontPortDiameter(parseFloat(e.target.value) || 0)}
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
            {enclosureType === "bandpass6_parallel" && (
              <div className="flex flex-col gap-3 text-xs">
                <div>
                  <label className="text-xs opacity-70 block mb-1">Port Losses (Q factor)</label>
                  <select
                    value={portQ}
                    onChange={(e) => setPortQ(parseFloat(e.target.value))}
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
                        value={vRear}
                        onChange={(e) => setVRear(parseFloat(e.target.value) || 0)}
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
                        value={rearTuningFreq}
                        onChange={(e) => setRearTuningFreq(parseFloat(e.target.value) || 0)}
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
                        value={rearPortDiameter}
                        onChange={(e) => setRearPortDiameter(parseFloat(e.target.value) || 0)}
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
                        value={vFront}
                        onChange={(e) => setVFront(parseFloat(e.target.value) || 0)}
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
                        value={frontTuningFreq}
                        onChange={(e) => setFrontTuningFreq(parseFloat(e.target.value) || 0)}
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
                        value={frontPortDiameter}
                        onChange={(e) => setFrontPortDiameter(parseFloat(e.target.value) || 0)}
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
            {enclosureType === "bandpass6_series" && (
              <div className="flex flex-col gap-3 text-xs">
                <div>
                  <label className="text-xs opacity-70 block mb-1">Port Losses (Q factor)</label>
                  <select
                    value={portQ}
                    onChange={(e) => setPortQ(parseFloat(e.target.value))}
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
                        value={vRear}
                        onChange={(e) => setVRear(parseFloat(e.target.value) || 0)}
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
                        value={rearTuningFreq}
                        onChange={(e) => setRearTuningFreq(parseFloat(e.target.value) || 0)}
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
                        value={internalPortDiameter}
                        onChange={(e) => setInternalPortDiameter(parseFloat(e.target.value) || 0)}
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
                        value={vFront}
                        onChange={(e) => setVFront(parseFloat(e.target.value) || 0)}
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
                        value={frontTuningFreq}
                        onChange={(e) => setFrontTuningFreq(parseFloat(e.target.value) || 0)}
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
                        value={frontPortDiameter}
                        onChange={(e) => setFrontPortDiameter(parseFloat(e.target.value) || 0)}
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
            {enclosureType === "passive_radiator" && (
              <div className="flex flex-col gap-2.5 border rounded p-2.5 text-xs" style={{ backgroundColor: "var(--bg-color)", borderColor: "var(--graph-grid-color)" }}>
                <span className="font-semibold text-xs opacity-80 block mb-1">Passive Radiator Parameters</span>
                <div className="flex justify-between items-center">
                  <span className="opacity-70">PR Moving Mass (Mms)</span>
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      value={prMms}
                      onChange={(e) => setPrMms(parseFloat(e.target.value) || 0)}
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
                      value={prSd}
                      onChange={(e) => setPrSd(parseFloat(e.target.value) || 0)}
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
                      value={prFs}
                      onChange={(e) => setPrFs(parseFloat(e.target.value) || 0)}
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
                    value={prQms}
                    onChange={(e) => setPrQms(parseFloat(e.target.value) || 0)}
                    className="w-16 border rounded px-1.5 py-0.5 text-right font-mono focus:outline-none text-xs"
                    style={{ backgroundColor: "var(--sidebar-color)", borderColor: "var(--graph-grid-color)", color: "var(--accent-color)" }}
                  />
                </div>
              </div>
            )}
          </div>

            {/* ── Custom Topology Builder ── */}
            {enclosureType === "custom" && (
              <div className="flex flex-col gap-3 text-xs">

                {/* Topology diagram */}
                <CustomTopologyDiagram topo={customTopology} />

                {/* ── REAR SIDE ── */}
                <div className="border rounded-lg overflow-hidden" style={{ borderColor: "var(--graph-grid-color)" }}>
                  <div className="px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-wider opacity-60"
                    style={{ backgroundColor: "var(--bg-color)" }}>
                    Rear Side (behind cone)
                  </div>
                  <div className="p-2.5 flex flex-col gap-2" style={{ backgroundColor: "var(--sidebar-color)" }}>
                    {/* Rear chamber volume */}
                    <div className="flex justify-between items-center">
                      <span className="opacity-70">Chamber Volume</span>
                      <div className="flex items-center gap-1">
                        <input type="number" value={customTopology.rear.volume_liters}
                          onChange={e => updateCustomRear({ volume_liters: parseFloat(e.target.value) || 0 })}
                          className="w-16 border rounded px-1.5 py-0.5 text-right font-mono focus:outline-none text-xs"
                          style={{ backgroundColor: "var(--bg-color)", borderColor: "var(--graph-grid-color)", color: "var(--accent-color)" }} />
                        <span className="opacity-60">L</span>
                      </div>
                    </div>

                    {/* Rear port */}
                    {customTopology.rear.port ? (
                      <div className="border rounded p-2 flex flex-col gap-1.5" style={{ borderColor: "var(--graph-grid-color)", backgroundColor: "var(--bg-color)" }}>
                        <div className="flex justify-between items-center">
                          <span className="font-semibold opacity-75">Port → Outside</span>
                          <button onClick={() => updateCustomRear({ port: null })}
                            className="text-[10px] opacity-50 hover:opacity-100 hover:text-red-400 transition cursor-pointer">✕ Remove</button>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="opacity-60">Tuning (Fb)</span>
                          <div className="flex items-center gap-1">
                            <input type="number" value={customTopology.rear.port.tuning_freq}
                              onChange={e => updateCustomRearPort({ tuning_freq: parseFloat(e.target.value) || 0 })}
                              className="w-16 border rounded px-1.5 py-0.5 text-right font-mono focus:outline-none text-xs"
                              style={{ backgroundColor: "var(--sidebar-color)", borderColor: "var(--graph-grid-color)", color: "var(--accent-color)" }} />
                            <span className="opacity-60">Hz</span>
                          </div>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="opacity-60">Diameter</span>
                          <div className="flex items-center gap-1">
                            <input type="number" step="0.1" value={customTopology.rear.port.diameter_cm}
                              onChange={e => updateCustomRearPort({ diameter_cm: parseFloat(e.target.value) || 0 })}
                              className="w-16 border rounded px-1.5 py-0.5 text-right font-mono focus:outline-none text-xs"
                              style={{ backgroundColor: "var(--sidebar-color)", borderColor: "var(--graph-grid-color)", color: "var(--accent-color)" }} />
                            <span className="opacity-60">cm</span>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <button onClick={() => updateCustomRear({ port: DEFAULT_PORT, pr: null })}
                        className="text-left text-[11px] opacity-60 hover:opacity-100 transition py-0.5 cursor-pointer hover:text-emerald-400">
                        + Add Port to Outside
                      </button>
                    )}

                    {/* Rear PR */}
                    {customTopology.rear.pr ? (
                      <div className="border rounded p-2 flex flex-col gap-1.5" style={{ borderColor: "var(--graph-grid-color)", backgroundColor: "var(--bg-color)" }}>
                        <div className="flex justify-between items-center">
                          <span className="font-semibold opacity-75">Passive Radiator → Outside</span>
                          <button onClick={() => updateCustomRear({ pr: null })}
                            className="text-[10px] opacity-50 hover:opacity-100 hover:text-red-400 transition cursor-pointer">✕ Remove</button>
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
                              <input type="number" step="any" value={customTopology.rear.pr![key]}
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
                        className="text-left text-[11px] opacity-60 hover:opacity-100 transition py-0.5 cursor-pointer hover:text-emerald-400">
                        + Add Passive Radiator to Outside
                      </button>
                    )}
                  </div>
                </div>

                {/* ── INTERNAL PORT ── */}
                <div className="border rounded-lg overflow-hidden" style={{ borderColor: "var(--graph-grid-color)" }}>
                  <div className="px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-wider opacity-60"
                    style={{ backgroundColor: "var(--bg-color)" }}>
                    Cross-Connect (Rear ↔ Front)
                  </div>
                  <div className="p-2.5" style={{ backgroundColor: "var(--sidebar-color)" }}>
                    {customTopology.internal_port ? (
                      <div className="border rounded p-2 flex flex-col gap-1.5" style={{ borderColor: "var(--graph-grid-color)", backgroundColor: "var(--bg-color)" }}>
                        <div className="flex justify-between items-center">
                          <span className="font-semibold opacity-75">Internal Port</span>
                          <button onClick={() => setCustomTopology(prev => ({ ...prev, internal_port: null }))}
                            className="text-[10px] opacity-50 hover:opacity-100 hover:text-red-400 transition cursor-pointer">✕ Remove</button>
                        </div>
                        <div className="opacity-55 text-[10px] mb-0.5">Connects rear chamber to front chamber — creates series bandpass behaviour.</div>
                        <div className="flex justify-between items-center">
                          <span className="opacity-60">Tuning (Fb)</span>
                          <div className="flex items-center gap-1">
                            <input type="number" value={customTopology.internal_port.tuning_freq}
                              onChange={e => updateCustomInternalPort({ tuning_freq: parseFloat(e.target.value) || 0 })}
                              className="w-16 border rounded px-1.5 py-0.5 text-right font-mono focus:outline-none text-xs"
                              style={{ backgroundColor: "var(--sidebar-color)", borderColor: "var(--graph-grid-color)", color: "var(--accent-color)" }} />
                            <span className="opacity-60">Hz</span>
                          </div>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="opacity-60">Diameter</span>
                          <div className="flex items-center gap-1">
                            <input type="number" step="0.1" value={customTopology.internal_port.diameter_cm}
                              onChange={e => updateCustomInternalPort({ diameter_cm: parseFloat(e.target.value) || 0 })}
                              className="w-16 border rounded px-1.5 py-0.5 text-right font-mono focus:outline-none text-xs"
                              style={{ backgroundColor: "var(--sidebar-color)", borderColor: "var(--graph-grid-color)", color: "var(--accent-color)" }} />
                            <span className="opacity-60">cm</span>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <button onClick={() => setCustomTopology(prev => ({ ...prev, internal_port: DEFAULT_PORT }))}
                        className="text-left text-[11px] opacity-60 hover:opacity-100 transition py-0.5 cursor-pointer hover:text-emerald-400">
                        + Add Internal Port (Rear → Front)
                      </button>
                    )}
                  </div>
                </div>

                {/* ── FRONT SIDE ── */}
                <div className="border rounded-lg overflow-hidden" style={{ borderColor: "var(--graph-grid-color)" }}>
                  <div className="px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-wider opacity-60"
                    style={{ backgroundColor: "var(--bg-color)" }}>
                    Front Side (in front of cone)
                  </div>
                  <div className="p-2.5 flex flex-col gap-2" style={{ backgroundColor: "var(--sidebar-color)" }}>
                    {/* Front chamber toggle */}
                    <div className="flex gap-2">
                      <button
                        onClick={() => updateCustomFront({ volume_liters: 0, port: null, pr: null })}
                        className={`flex-1 py-1 rounded text-[11px] font-semibold border transition cursor-pointer ${customTopology.front.volume_liters === 0
                          ? "border-emerald-500 text-emerald-400"
                          : "opacity-50 border-transparent hover:opacity-80"}`}
                        style={{ backgroundColor: customTopology.front.volume_liters === 0 ? "var(--bg-color)" : "transparent" }}>
                        Open Air
                      </button>
                      <button
                        onClick={() => updateCustomFront({ volume_liters: 40 })}
                        className={`flex-1 py-1 rounded text-[11px] font-semibold border transition cursor-pointer ${customTopology.front.volume_liters > 0
                          ? "border-emerald-500 text-emerald-400"
                          : "opacity-50 border-transparent hover:opacity-80"}`}
                        style={{ backgroundColor: customTopology.front.volume_liters > 0 ? "var(--bg-color)" : "transparent" }}>
                        Sealed Chamber
                      </button>
                    </div>

                    {customTopology.front.volume_liters === 0 ? (
                      <p className="text-[10px] opacity-50">Cone fires directly into the room. Use for sealed or vented designs.</p>
                    ) : (
                      <>
                        <div className="flex justify-between items-center">
                          <span className="opacity-70">Chamber Volume</span>
                          <div className="flex items-center gap-1">
                            <input type="number" value={customTopology.front.volume_liters}
                              onChange={e => updateCustomFront({ volume_liters: parseFloat(e.target.value) || 0 })}
                              className="w-16 border rounded px-1.5 py-0.5 text-right font-mono focus:outline-none text-xs"
                              style={{ backgroundColor: "var(--bg-color)", borderColor: "var(--graph-grid-color)", color: "var(--accent-color)" }} />
                            <span className="opacity-60">L</span>
                          </div>
                        </div>

                        {/* Front port */}
                        {customTopology.front.port ? (
                          <div className="border rounded p-2 flex flex-col gap-1.5" style={{ borderColor: "var(--graph-grid-color)", backgroundColor: "var(--bg-color)" }}>
                            <div className="flex justify-between items-center">
                              <span className="font-semibold opacity-75">Port → Outside</span>
                              <button onClick={() => updateCustomFront({ port: null })}
                                className="text-[10px] opacity-50 hover:opacity-100 hover:text-red-400 transition cursor-pointer">✕ Remove</button>
                            </div>
                            <div className="flex justify-between items-center">
                              <span className="opacity-60">Tuning (Fb)</span>
                              <div className="flex items-center gap-1">
                                <input type="number" value={customTopology.front.port.tuning_freq}
                                  onChange={e => updateCustomFrontPort({ tuning_freq: parseFloat(e.target.value) || 0 })}
                                  className="w-16 border rounded px-1.5 py-0.5 text-right font-mono focus:outline-none text-xs"
                                  style={{ backgroundColor: "var(--sidebar-color)", borderColor: "var(--graph-grid-color)", color: "var(--accent-color)" }} />
                                <span className="opacity-60">Hz</span>
                              </div>
                            </div>
                            <div className="flex justify-between items-center">
                              <span className="opacity-60">Diameter</span>
                              <div className="flex items-center gap-1">
                                <input type="number" step="0.1" value={customTopology.front.port.diameter_cm}
                                  onChange={e => updateCustomFrontPort({ diameter_cm: parseFloat(e.target.value) || 0 })}
                                  className="w-16 border rounded px-1.5 py-0.5 text-right font-mono focus:outline-none text-xs"
                                  style={{ backgroundColor: "var(--sidebar-color)", borderColor: "var(--graph-grid-color)", color: "var(--accent-color)" }} />
                                <span className="opacity-60">cm</span>
                              </div>
                            </div>
                          </div>
                        ) : (
                          <button onClick={() => updateCustomFront({ port: DEFAULT_PORT, pr: null })}
                            className="text-left text-[11px] opacity-60 hover:opacity-100 transition py-0.5 cursor-pointer hover:text-emerald-400">
                            + Add Port to Outside
                          </button>
                        )}

                        {/* Front PR */}
                        {customTopology.front.pr ? (
                          <div className="border rounded p-2 flex flex-col gap-1.5" style={{ borderColor: "var(--graph-grid-color)", backgroundColor: "var(--bg-color)" }}>
                            <div className="flex justify-between items-center">
                              <span className="font-semibold opacity-75">Passive Radiator → Outside</span>
                              <button onClick={() => updateCustomFront({ pr: null })}
                                className="text-[10px] opacity-50 hover:opacity-100 hover:text-red-400 transition cursor-pointer">✕ Remove</button>
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
                                  <input type="number" step="any" value={customTopology.front.pr![key]}
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
                            className="text-left text-[11px] opacity-60 hover:opacity-100 transition py-0.5 cursor-pointer hover:text-emerald-400">
                            + Add Passive Radiator to Outside
                          </button>
                        )}
                      </>
                    )}
                  </div>
                </div>

              </div>
            )}

          {/* System Statistics */}
          {systemStats.length > 0 && (
            <div className="border-t pt-4" style={{ borderColor: "var(--graph-grid-color)" }}>
              <h4 className="text-xs font-semibold opacity-70 uppercase tracking-wider block mb-2.5">
                System Statistics
              </h4>
              <div
                className="rounded overflow-hidden text-xs"
                style={{ border: "1px solid var(--graph-grid-color)" }}
              >
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
                              className="flex flex-col gap-0.5 px-2.5 py-2"
                              style={{
                                backgroundColor: "var(--bg-color)",
                                borderLeft: ci > 0 ? "1px solid var(--graph-grid-color)" : undefined,
                              }}
                            >
                              <span className="text-[9px] font-mono uppercase opacity-50 leading-none">
                                {stat.label}
                              </span>
                              <span
                                className="font-semibold font-mono leading-tight"
                                style={{
                                  color: stat.accent
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
                          {/* pad odd row to fill 2nd column */}
                          {row.length === 1 && (
                            <div className="px-2.5 py-2" style={{ backgroundColor: "var(--bg-color)", borderLeft: "1px solid var(--graph-grid-color)" }} />
                          )}
                        </div>
                      ))}
                      {full.map((stat, fi) => (
                        <div
                          key={stat.label}
                          className="flex flex-col gap-0.5 px-2.5 py-2"
                          style={{
                            backgroundColor: "var(--bg-color)",
                            borderTop: fi > 0 ? "1px solid var(--graph-grid-color)" : undefined,
                          }}
                        >
                          <span className="text-[9px] font-mono uppercase opacity-50 leading-none">
                            {stat.label}
                          </span>
                          <span
                            className="font-semibold font-mono leading-tight"
                            style={{
                              color: stat.accent
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
            </div>
          )}

          {/* SPL Settings */}
          <div className="border-t pt-4 flex flex-col gap-4" style={{ borderColor: "var(--graph-grid-color)" }}>
            <h4 className="text-xs font-semibold opacity-70 uppercase tracking-wider block">
              SPL & Output Simulation
            </h4>

            <div>
              <div className="flex justify-between items-center text-xs mb-1">
                <span className="opacity-70">Total Input Power</span>
                <div className="flex items-center gap-1">
                  <input
                    type="number"
                    value={inputPower}
                    onChange={(e) => setInputPower(parseFloat(e.target.value) || 0)}
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
                max={Math.max(100, activeDriver.pe * numDrivers)}
                step="5"
                value={inputPower}
                onChange={(e) => setInputPower(parseFloat(e.target.value))}
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
                value={distance}
                onChange={(e) => setDistance(parseFloat(e.target.value) || 1.0)}
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
                value={splEnvironment}
                onChange={(e) => setSplEnvironment(e.target.value as typeof splEnvironment)}
                className="w-full border rounded px-2.5 py-1.5 text-xs focus:outline-none"
                style={{ backgroundColor: "var(--bg-color)", borderColor: "var(--graph-grid-color)", color: "var(--text-color)" }}
              >
                <option value="half_space">Half-space — wall / floor mount</option>
                <option value="free_field">Free-field — anechoic / elevated (−6 dB)</option>
                <option value="corner">Corner placement — 3 boundaries (+6 dB)</option>
              </select>
              <p className="text-[10px] opacity-50 mt-1">Affects SPL curve only. Gain and excursion are unaffected.</p>
            </div>
          </div>
        </div>
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
              <span className="text-[10px]">▼</span>
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
                    { key: "transfer", label: "Gain (dB)" },
                    { key: "spl", label: "SPL (dB SPL)" },
                    { key: "excursion", label: "Cone Excursion (mm)" },
                    ...(enclosureType !== "sealed" ? [{ key: "velocity", label: "Port Air Velocity (m/s)" }] : []),
                    { key: "impedance", label: "System Impedance (Ω)" },
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
                          className="rounded text-emerald-500 focus:ring-emerald-500 accent-emerald-500 h-4 w-4 cursor-pointer"
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

        <div ref={dashboardContainerRef} className="flex-1 overflow-y-auto flex flex-col gap-8 pr-2">
          {visibleGraphs.map((mode) => {
            const width = dashboardWidth;
            const height = graphHeights[mode];
            const chartWidth = width - paddingLeft - paddingRight;
            const chartHeight = height - paddingTop - paddingBottom;

            const activeCfg = graphConfigs[mode];
            const fMin = activeCfg.xMin;
            const fMax = activeCfg.xMax;
            const points = simulationData[mode] || [];

            // Calculate dynamic Y limits for this graph mode
            const minVal = points.length > 0 ? Math.min(...points.map((p) => p.db)) : 0;
            const maxVal = points.length > 0 ? Math.max(...points.map((p) => p.db)) : 10;

            const isSpl = mode === "spl";

            const currentDbMin = !activeCfg.autoScaleY
              ? activeCfg.yMin
              : Math.floor(
                  Math.max(
                    isSpl
                      ? 20
                      : (mode === "excursion" || mode === "velocity" || mode === "impedance" ? 0 : -100),
                    minVal
                  ) / 5
                ) * 5;

            const currentDbMax = !activeCfg.autoScaleY
              ? activeCfg.yMax
              : Math.max(
                  Math.ceil(
                    Math.min(
                      mode === "excursion"
                        ? 100
                        : (mode === "velocity" ? 200 : (mode === "impedance" ? 1000 : (isSpl ? 200 : 30))),
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

            const pathD = points
              .map((p, idx) => {
                const x = getX(p.frequency);
                const y = getY(p.db);
                return `${idx === 0 ? "M" : "L"} ${x} ${y}`;
              })
              .join(" ");

            const unit =
              mode === "excursion"
                ? "mm"
                : mode === "velocity"
                ? "m/s"
                : mode === "impedance"
                ? "Ω"
                : isSpl
                ? "dB SPL"
                : "dB";

            const hoverPoint = (() => {
              if (hoveredFreq === null || points.length === 0) return null;
              const targetLog = Math.log10(hoveredFreq);
              return points.reduce((prev, curr) =>
                Math.abs(Math.log10(curr.frequency) - targetLog) < Math.abs(Math.log10(prev.frequency) - targetLog) ? curr : prev
              );
            })();

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
                setHoveredFreq(targetFreq);
              }
            };

            const title =
              mode === "transfer"
                ? "Relative Gain (dB)"
                : mode === "spl"
                ? "Sound Pressure Level (SPL)"
                : mode === "excursion"
                ? "Cone Excursion (mm)"
                : mode === "velocity"
                ? "Port Air Velocity (m/s)"
                : "System Electrical Impedance (Ω)";

            return (
              <div
                key={mode}
                className="border rounded-xl p-5 flex flex-col gap-4 animate-fadeIn"
                style={{ backgroundColor: "var(--sidebar-color)", borderColor: "var(--graph-grid-color)" }}
              >
                {/* Chart Header */}
                <div className="flex justify-between items-start gap-2">
                  <div className="flex flex-col gap-1">
                    <h3 className="text-sm font-bold tracking-wide">{title}</h3>
                    {/* Radiation model accuracy warning — shown for gain/SPL graphs */}
                    {(mode === "transfer" || mode === "spl") && kaWarningFreq < activeCfg.xMax && (
                      <p className="text-[10px] opacity-70" style={{ color: "var(--accent-color)" }}>
                        ⚠ Radiation model less accurate above ~{kaWarningFreq} Hz for this driver (ka = 0.5)
                      </p>
                    )}
                  </div>
                  <div className="text-[11px] font-mono flex gap-3 px-3 py-1 rounded bg-black/35 border border-white/5 shrink-0">
                    <div>
                      <span className="opacity-50">Freq:</span>{" "}
                      <span className="font-semibold">
                        {hoverPoint ? `${hoverPoint.frequency.toFixed(1)} Hz` : "-- Hz"}
                      </span>
                    </div>
                    <div>
                      <span className="opacity-50">Value:</span>{" "}
                      <span className="font-semibold" style={{ color: "var(--accent-color)" }}>
                        {hoverPoint ? `${hoverPoint.db.toFixed(2)} ${unit}` : `-- ${unit}`}
                      </span>
                    </div>
                  </div>
                </div>

                {/* SVG Graph Canvas */}
                <div style={{ height: `${height}px` }} className="w-full bg-black/10 rounded-lg p-2">
                  <svg
                    viewBox={`0 0 ${width} ${height}`}
                    className="w-full h-full select-none"
                    onMouseMove={handleMouseMove}
                    onMouseLeave={() => setHoveredFreq(null)}
                  >
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

                    {/* Response Curve Path */}
                    <path
                      d={pathD}
                      fill="none"
                      stroke="var(--graph-line-color)"
                      strokeWidth={3}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />

                    {/* ── Reference lines ─────────────────────────────────────────── */}

                    {/* GAIN: −3 dB horizontal line (F3) */}
                    {mode === "transfer" && -3.0 >= currentDbMin && -3.0 <= currentDbMax && (() => {
                      const y = getY(-3.0);
                      return (
                        <g>
                          <line x1={paddingLeft} y1={y} x2={width - paddingRight} y2={y}
                            stroke="var(--accent-color)" strokeWidth={1.5} strokeDasharray="7 4" opacity={0.55} />
                          <rect x={width - paddingRight - 66} y={y - 14} width={64} height={13} rx={2}
                            fill="var(--sidebar-color)" opacity={0.92} />
                          <text x={width - paddingRight - 4} y={y - 4}
                            fill="var(--accent-color)" fontSize={9} textAnchor="end" fontWeight="bold" opacity={0.9}>
                            −3 dB  (F3)
                          </text>
                        </g>
                      );
                    })()}

                    {/* GAIN: driver Fs vertical line */}
                    {mode === "transfer" && activeDriver.fs >= fMin && activeDriver.fs <= fMax && (() => {
                      const xFs = getX(activeDriver.fs);
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
                            Fs = {activeDriver.fs} Hz
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
                            stroke="#f59e0b" strokeWidth={1.5} strokeDasharray="7 4" opacity={0.8} />
                          <rect x={width - paddingRight - 108} y={y - 14} width={106} height={13} rx={2}
                            fill="var(--sidebar-color)" opacity={0.92} />
                          <text x={width - paddingRight - 4} y={y - 4}
                            fill="#f59e0b" fontSize={9} textAnchor="end" fontWeight="bold" opacity={0.95}>
                            Chuffing limit  17 m/s
                          </text>
                        </g>
                      );
                    })()}

                    {/* EXCURSION: Xmax limit */}
                    {mode === "excursion" && activeDriver.xmax >= currentDbMin && activeDriver.xmax <= currentDbMax && (() => {
                      const y = getY(activeDriver.xmax);
                      return (
                        <g>
                          <line x1={paddingLeft} y1={y} x2={width - paddingRight} y2={y}
                            stroke="#f59e0b" strokeWidth={1.5} strokeDasharray="7 4" opacity={0.8} />
                          <rect x={width - paddingRight - 82} y={y - 14} width={80} height={13} rx={2}
                            fill="var(--sidebar-color)" opacity={0.92} />
                          <text x={width - paddingRight - 4} y={y - 4}
                            fill="#f59e0b" fontSize={9} textAnchor="end" fontWeight="bold" opacity={0.95}>
                            Xmax  {activeDriver.xmax} mm
                          </text>
                        </g>
                      );
                    })()}

                    {/* Hover Pointer marker */}
                    {hoverPoint && (
                      <circle
                        cx={getX(hoverPoint.frequency)}
                        cy={getY(hoverPoint.db)}
                        r={5.5}
                        fill="var(--graph-line-color)"
                        stroke="var(--text-color)"
                        strokeWidth={2}
                      />
                    )}
                  </svg>
                </div>

                {/* Individual Explainer caption */}
                <div className="flex gap-2 text-xs opacity-75 items-start">
                  <Info className="h-4 w-4 mt-0.5 shrink-0" style={{ color: "var(--accent-color)" }} />
                  {mode === "excursion" && (
                    <p>
                      Keep displacement below the mechanical limit (Xmax = {activeDriver.xmax} mm) at input power {inputPower}W.
                    </p>
                  )}
                  {mode === "velocity" && (
                    <p>
                      Vent air velocity should stay under 17 m/s to prevent port chuffing and compression.
                    </p>
                  )}
                  {mode === "impedance" && (
                    <p>
                      Shows electrical cabinet loading including coil inductance Le = {activeDriver.le} mH. Saddle point marks Fb = {tuningFreq}Hz.
                    </p>
                  )}
                  {mode === "transfer" && (
                    <p>
                      Displays system alignment and roll-off slope (-12dB/octave closed, -24dB/octave ported).
                    </p>
                  )}
                  {mode === "spl" && (
                    <p>
                      Predicts maximum acoustic output in dB SPL at {distance}m under total load {inputPower}W.
                    </p>
                  )}
                </div>
                {/* Drag Resizer Handle Bar */}
                <div
                  onMouseDown={(e) => handleResizeStart(e, mode)}
                  className="h-3 w-full cursor-row-resize bg-transparent hover:bg-emerald-500/10 active:bg-emerald-500/20 border-t border-transparent hover:border-emerald-500/10 rounded-b-xl transition flex items-center justify-center text-[7px] tracking-widest text-slate-500 hover:text-emerald-400 select-none mt-2"
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
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-6 text-slate-100 overflow-y-auto animate-fadeIn">
          <div className="bg-slate-900 border border-slate-800 w-full max-w-lg rounded-xl shadow-2xl overflow-hidden flex flex-col my-8">
            <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/40">
              <h3 className="text-lg font-bold">App Settings</h3>
              <button
                onClick={() => setShowSettings(false)}
                className="text-slate-400 hover:text-white p-1 hover:bg-slate-800 rounded transition cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-6 flex flex-col gap-6 max-h-[70vh] overflow-y-auto">
              {/* Theme Settings */}
              <div className="flex flex-col gap-4 border-b border-slate-800 pb-5">
                <h4 className="text-sm font-bold text-emerald-400 uppercase tracking-wider">Appearance & Color Customizer</h4>
                
                {/* Theme presets */}
                <div className="flex flex-col gap-2">
                  <label className="text-xs text-slate-400">Theme Presets</label>
                  <select
                    value={activePresetKey}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val && val !== "custom") {
                        setCurrentTheme(PRESETS[val]);
                      }
                    }}
                    className="w-full bg-slate-955 border border-slate-800 rounded px-3 py-2 text-xs text-slate-200 focus:outline-none"
                  >
                    {Object.keys(PRESETS).map((key) => (
                      <option key={key} value={key}>
                        {PRESETS[key].name}
                      </option>
                    ))}
                    {activePresetKey === "custom" && <option value="custom">Custom Theme</option>}
                  </select>
                </div>

                {/* Customizer grid */}
                <div className="grid grid-cols-2 gap-4 text-xs">
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={currentTheme.bgColor}
                      onChange={(e) => handleCustomColorChange("bgColor", e.target.value)}
                      className="w-7 h-7 rounded border border-slate-700 bg-transparent cursor-pointer"
                    />
                    <span>Background</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={currentTheme.sidebarColor}
                      onChange={(e) => handleCustomColorChange("sidebarColor", e.target.value)}
                      className="w-7 h-7 rounded border border-slate-700 bg-transparent cursor-pointer"
                    />
                    <span>Sidebar</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={currentTheme.textColor}
                      onChange={(e) => handleCustomColorChange("textColor", e.target.value)}
                      className="w-7 h-7 rounded border border-slate-700 bg-transparent cursor-pointer"
                    />
                    <span>Text Color</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={currentTheme.accentColor}
                      onChange={(e) => handleCustomColorChange("accentColor", e.target.value)}
                      className="w-7 h-7 rounded border border-slate-700 bg-transparent cursor-pointer"
                    />
                    <span>Highlight Accent</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={currentTheme.graphLineColor}
                      onChange={(e) => handleCustomColorChange("graphLineColor", e.target.value)}
                      className="w-7 h-7 rounded border border-slate-700 bg-transparent cursor-pointer"
                    />
                    <span>Graph Line</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={currentTheme.graphGridColor}
                      onChange={(e) => handleCustomColorChange("graphGridColor", e.target.value)}
                      className="w-7 h-7 rounded border border-slate-700 bg-transparent cursor-pointer"
                    />
                    <span>Graph Grid</span>
                  </div>
                </div>
              </div>

              {/* Calibration Settings for Graph Viewport limits */}
              <div className="flex flex-col gap-4">
                <h4 className="text-sm font-bold text-emerald-400 uppercase tracking-wider">Graph Viewport Calibration</h4>
                
                {/* Select graph to edit */}
                <div className="flex flex-col gap-2">
                  <label className="text-xs text-slate-400">Select Curve to Calibrate</label>
                  <select
                    value={configEditType}
                    onChange={(e) => setConfigEditType(e.target.value as CurveType)}
                    className="w-full bg-slate-955 border border-slate-800 rounded px-3 py-2 text-xs focus:outline-none"
                  >
                    <option value="transfer">Gain (dB)</option>
                    <option value="spl">SPL (dB SPL)</option>
                    <option value="excursion">Cone Excursion (mm)</option>
                    {enclosureType !== "sealed" && <option value="velocity">Port Air Velocity (m/s)</option>}
                    <option value="impedance">System Impedance (Ω)</option>
                  </select>
                </div>

                <div className="bg-slate-955/50 p-4 rounded border border-slate-800 flex flex-col gap-4">
                  {/* Auto-Scale Y */}
                  <div className="flex items-center justify-between border-b border-slate-850 pb-3">
                    <div>
                      <span className="text-xs font-semibold block">Auto-Scale Y-Axis</span>
                      <span className="text-[10px] text-slate-500">Fits values dynamically to fit screen</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => updateViewportConfig(configEditType, "autoScaleY", !graphConfigs[configEditType].autoScaleY)}
                      className={`w-10 h-5.5 flex items-center rounded-full p-0.5 transition-colors duration-200 focus:outline-none cursor-pointer ${
                        graphConfigs[configEditType].autoScaleY ? "bg-emerald-600" : "bg-slate-800"
                      }`}
                    >
                      <span
                        className={`bg-white w-4.5 h-4.5 rounded-full shadow transform transition-transform duration-200 ${
                          graphConfigs[configEditType].autoScaleY ? "translate-x-4.5" : "translate-x-0"
                        }`}
                      />
                    </button>
                  </div>

                  {/* X Axis boundaries */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[10px] text-slate-400 block mb-1">X-Axis Min Frequency (Hz)</label>
                      <input
                        type="number"
                        min="1"
                        value={graphConfigs[configEditType].xMin}
                        onChange={(e) => updateViewportConfig(configEditType, "xMin", Math.max(1, parseInt(e.target.value) || 10))}
                        className="w-full bg-slate-950 border border-slate-800 rounded px-2.5 py-1.5 text-xs font-mono"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-slate-400 block mb-1">X-Axis Max Frequency (Hz)</label>
                      <input
                        type="number"
                        min="10"
                        value={graphConfigs[configEditType].xMax}
                        onChange={(e) => updateViewportConfig(configEditType, "xMax", Math.max(10, parseInt(e.target.value) || 2000))}
                        className="w-full bg-slate-950 border border-slate-800 rounded px-2.5 py-1.5 text-xs font-mono"
                      />
                    </div>
                  </div>

                  {/* Y Axis boundaries */}
                  {!graphConfigs[configEditType].autoScaleY && (
                    <div className="grid grid-cols-2 gap-3 animate-fadeIn">
                      <div>
                        <label className="text-[10px] text-slate-400 block mb-1">Y-Axis Floor Limit</label>
                        <input
                          type="number"
                          value={graphConfigs[configEditType].yMin}
                          onChange={(e) => updateViewportConfig(configEditType, "yMin", parseFloat(e.target.value) || 0)}
                          className="w-full bg-slate-950 border border-slate-800 rounded px-2.5 py-1.5 text-xs font-mono"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-slate-400 block mb-1">Y-Axis Ceiling Limit</label>
                        <input
                          type="number"
                          value={graphConfigs[configEditType].yMax}
                          onChange={(e) => updateViewportConfig(configEditType, "yMax", parseFloat(e.target.value) || 10)}
                          className="w-full bg-slate-950 border border-slate-800 rounded px-2.5 py-1.5 text-xs font-mono"
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="p-5 border-t border-slate-800 flex justify-end bg-slate-950/20">
              <button
                onClick={() => setShowSettings(false)}
                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 rounded text-sm font-semibold transition cursor-pointer"
              >
                Close Settings
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Driver Database Modal */}
      {showBrowser && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-6 text-slate-100">
          <div className="bg-slate-900 border border-slate-800 w-full max-w-3xl rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
            <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/40">
              <div>
                <h3 className="text-lg font-bold">Driver Database</h3>
                <p className="text-xs text-slate-400">Select an existing driver or add a new one to the database</p>
              </div>
              <button
                onClick={() => setShowBrowser(false)}
                className="text-slate-400 hover:text-white p-1 hover:bg-slate-800 rounded transition cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-5 border-b border-slate-850 flex gap-3 items-center bg-slate-900/50">
              <input
                type="text"
                placeholder="Search by manufacturer or model..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="flex-1 bg-slate-950 text-sm border border-slate-800 rounded px-3 py-2 focus:border-emerald-500 focus:outline-none"
              />
              <button
                onClick={() => setShowAddForm(true)}
                className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-sm font-semibold transition cursor-pointer animate-fadeIn"
              >
                <Plus className="h-4 w-4" />
                Add Driver
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {filteredDrivers.map((driver) => (
                  <div
                    key={driver.id}
                    className={`border rounded-lg p-4 bg-slate-955/50 transition duration-150 flex flex-col justify-between ${
                      activeDriver.id === driver.id ? "border-emerald-500 bg-emerald-950/5" : "border-slate-800 hover:border-slate-700"
                    }`}
                  >
                    <div>
                      <div className="flex justify-between items-start">
                        <h4 className="font-bold text-sm">{driver.manufacturer}</h4>
                        {activeDriver.id === driver.id && (
                          <span className="text-[10px] text-emerald-400 font-semibold bg-emerald-950/60 border border-emerald-900 px-2 py-0.5 rounded-full">
                            Active
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-400 font-medium mb-3">{driver.model}</p>

                      <div className="grid grid-cols-3 gap-2 border-t border-slate-800/80 pt-2.5 text-xs text-slate-400 font-mono">
                        <div>Fs: <span className="text-slate-200">{driver.fs}Hz</span></div>
                        <div>Qts: <span className="text-slate-200">{driver.qts}</span></div>
                        <div>Vas: <span className="text-slate-200">{driver.vas}L</span></div>
                        <div className="col-span-3 mt-1 text-[11px] text-slate-500">
                          Sens: <span className="text-emerald-400 font-semibold">{driver.sens} dB @ 1W/1m</span>
                        </div>
                      </div>
                    </div>

                    <button
                      onClick={() => {
                        setActiveDriver(driver);
                        setVBox(driver.vas / 2);
                        setShowBrowser(false);
                      }}
                      className="mt-4 w-full py-1.5 text-xs bg-slate-800 hover:bg-emerald-600 hover:text-white rounded border border-slate-700 hover:border-emerald-500 transition text-slate-350 font-medium cursor-pointer"
                    >
                      Load Driver
                    </button>
                  </div>
                ))}
                {filteredDrivers.length === 0 && (
                  <div className="col-span-2 text-center py-8 text-slate-500 text-sm">
                    No drivers found matching your search.
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add Driver Modal */}
      {showAddForm && (
        <div className="fixed inset-0 z-55 bg-black/70 backdrop-blur-sm flex items-center justify-center p-6 text-slate-100">
          <div className="bg-slate-900 border border-slate-800 w-full max-w-2xl rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/40">
              <h3 className="text-lg font-bold">Add Custom Driver</h3>
              <button
                onClick={() => setShowAddForm(false)}
                className="text-slate-400 hover:text-white p-1 hover:bg-slate-800 rounded transition cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleAddDriver} className="flex-1 overflow-y-auto p-6 flex flex-col gap-5">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-semibold text-slate-405 block mb-1">Manufacturer *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. B&C Speakers"
                    value={newManufacturer}
                    onChange={(e) => setNewManufacturer(e.target.value)}
                    className="w-full bg-slate-955 border border-slate-800 rounded px-3 py-2 text-sm text-slate-200 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-405 block mb-1">Model / Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. 21SW115"
                    value={newModel}
                    onChange={(e) => setNewModel(e.target.value)}
                    className="w-full bg-slate-955 border border-slate-800 rounded px-3 py-2 text-sm text-slate-200 focus:outline-none"
                  />
                </div>
              </div>

              <div className="border-t border-slate-800 pt-4">
                <div className="flex gap-1.5 items-center mb-3 text-emerald-400 text-xs font-bold uppercase tracking-wider">
                  <Sliders className="h-4 w-4" />
                  <span>Thiele-Small Parameters</span>
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="text-xs text-slate-405 block mb-1">Fs (Hz) *</label>
                    <input
                      type="number"
                      step="any"
                      required
                      value={newFs}
                      onChange={(e) => setNewFs(e.target.value)}
                      className="w-full bg-slate-955 border border-slate-800 rounded px-3 py-1.5 text-sm font-mono text-slate-200 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-slate-405 block mb-1">Qes *</label>
                    <input
                      type="number"
                      step="any"
                      required
                      value={newQes}
                      onChange={(e) => setNewQes(e.target.value)}
                      className="w-full bg-slate-955 border border-slate-800 rounded px-3 py-1.5 text-sm font-mono text-slate-200 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-slate-455 block mb-1">Qms *</label>
                    <input
                      type="number"
                      step="any"
                      required
                      value={newQms}
                      onChange={(e) => setNewQms(e.target.value)}
                      className="w-full bg-slate-955 border border-slate-800 rounded px-3 py-1.5 text-sm font-mono text-slate-200 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-slate-455 block mb-1">Qts (Calculated)</label>
                    <input
                      type="number"
                      step="any"
                      disabled
                      value={newQts}
                      className="w-full bg-slate-900 border border-slate-850 rounded px-3 py-1.5 text-sm font-mono text-emerald-400 cursor-not-allowed"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-slate-455 block mb-1">Vas (Liters) *</label>
                    <input
                      type="number"
                      step="any"
                      required
                      value={newVas}
                      onChange={(e) => setNewVas(e.target.value)}
                      className="w-full bg-slate-955 border border-slate-800 rounded px-3 py-1.5 text-sm font-mono text-slate-200 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-slate-455 block mb-1">Re (Ω)</label>
                    <input
                      type="number"
                      step="any"
                      value={newRe}
                      onChange={(e) => setNewRe(e.target.value)}
                      className="w-full bg-slate-955 border border-slate-800 rounded px-3 py-1.5 text-sm font-mono text-slate-200 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-slate-455 block mb-1">Sd (cm²)</label>
                    <input
                      type="number"
                      step="any"
                      value={newSd}
                      onChange={(e) => setNewSd(e.target.value)}
                      className="w-full bg-slate-955 border border-slate-800 rounded px-3 py-1.5 text-sm font-mono text-slate-200 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-slate-455 block mb-1">Xmax (mm)</label>
                    <input
                      type="number"
                      step="any"
                      value={newXmax}
                      onChange={(e) => setNewXmax(e.target.value)}
                      className="w-full bg-slate-955 border border-slate-800 rounded px-3 py-1.5 text-sm font-mono text-slate-200 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-slate-455 block mb-1">Sensitivity (dB @ 1W/1m) *</label>
                    <input
                      type="number"
                      step="any"
                      required
                      value={newSens}
                      onChange={(e) => setNewSens(e.target.value)}
                      className="w-full bg-slate-955 border border-slate-800 rounded px-3 py-1.5 text-sm font-mono text-slate-200 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-slate-455 block mb-1">Mms (grams)</label>
                    <input
                      type="number"
                      step="any"
                      value={newMms}
                      onChange={(e) => setNewMms(e.target.value)}
                      className="w-full bg-slate-955 border border-slate-800 rounded px-3 py-1.5 text-sm font-mono text-slate-200 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-slate-455 block mb-1">Le (mH)</label>
                    <input
                      type="number"
                      step="any"
                      value={newLe}
                      onChange={(e) => setNewLe(e.target.value)}
                      className="w-full bg-slate-955 border border-slate-800 rounded px-3 py-1.5 text-sm font-mono text-slate-200 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-slate-455 block mb-1">Bl (Tm)</label>
                    <input
                      type="number"
                      step="any"
                      value={newBl}
                      onChange={(e) => setNewBl(e.target.value)}
                      className="w-full bg-slate-955 border border-slate-800 rounded px-3 py-1.5 text-sm font-mono text-slate-200 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-slate-455 block mb-1">Pe (Watts)</label>
                    <input
                      type="number"
                      step="any"
                      value={newPe}
                      onChange={(e) => setNewPe(e.target.value)}
                      className="w-full bg-slate-955 border border-slate-800 rounded px-3 py-1.5 text-sm font-mono text-slate-200 focus:outline-none"
                    />
                  </div>
                </div>
              </div>

              <div className="bg-slate-955/40 border border-slate-855 p-4.5 rounded-lg flex gap-3 text-xs text-slate-400 items-start">
                <Info className="h-5 w-5 text-emerald-555 shrink-0 mt-0.5" />
                <p>
                  * indicates a required field. Providing Qes and Qms automatically computes Qts. Sensitivity value is essential for accurate absolute dB SPL simulation.
                </p>
              </div>

              <div className="border-t border-slate-800 pt-5 flex justify-end gap-3 bg-slate-900">
                <button
                  type="button"
                  onClick={() => setShowAddForm(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 rounded text-sm font-semibold transition text-slate-350 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-555 text-white rounded text-sm font-semibold transition shadow-md cursor-pointer"
                >
                  Save Driver
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
