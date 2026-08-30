import { useCallback, useEffect, useMemo, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import {
  AlignmentConstraints,
  AlignmentRecommendation,
  AlignmentTarget,
  CurveType,
  PassbandTarget,
  SimPoint,
} from "../types";
import { computeRoomCorrection, totalFilterGainDb } from "../lib/calculations";
import { computeSystemStats } from "../lib/systemStats";
import { useSimulationExport } from "./useSimulationExport";

// Shortest port the solver will model, in metres. Mirrors derive_port_length_m in
// circuit.rs — the two must agree or the displayed length is not the simulated one.
const MIN_PORT_LENGTH_M = 0.01;
import { useToast, useDialog } from "../components/ui";
import { useProjectsContext } from "../context/ProjectsContext";
import { useGraphViewportContext } from "../context/GraphViewportContext";
import { useSignalProcessingContext } from "../context/SignalProcessingContext";

export function useSimulation() {
  const toast = useToast();
  const { confirmDialog } = useDialog();
  const { activeProject, activeProjectId, projects, updateActiveProject } = useProjectsContext();
  const { visibleGraphs, graphConfigs, globalXMin, globalXMax, overrideXLimits, getGraphXLimits } = useGraphViewportContext();
  const { filters, roomConfig, cabinConfig } = useSignalProcessingContext();

  // Simulation Points Map Keyed by Project ID
  const [simulationResults, setSimulationResults] = useState<Record<string, Record<CurveType, SimPoint[]>>>({});

  // Run simulation for all comparison projects in parallel
  useEffect(() => {
    async function runAllSims() {
      try {
        const newResults: Record<string, Record<CurveType, SimPoint[]>> = {};
        await Promise.all(
          projects.map(async (project) => {
            const projectResults = {} as Record<CurveType, SimPoint[]>;
            // Phase and group_delay are derived in TypeScript from the transfer curve.
            // Ensure "transfer" is simulated whenever either derived mode is visible.
            const backendModes: CurveType[] = [
              ...new Set(
                visibleGraphs.map(m => (m === "phase" || m === "group_delay") ? "transfer" as CurveType : m)
              ),
            ];
            await Promise.all(
              backendModes.map(async (mode) => {
                const { xMin: fMin, xMax: fMax } = getGraphXLimits(mode);
                let result: SimPoint[];

                if (project.enclosureType === "custom") {
                  result = await invoke("simulate_custom", { request: {
                    driver: project.driver,
                    customTopology: project.customTopology,
                    inputPower: parseFloat(String(project.inputPower)) || 1.0,
                    distance: parseFloat(String(project.distance)) || 1.0,
                    numDrivers: parseInt(String(project.numDrivers)) || 1,
                    curveType: mode,
                    fMin,
                    fMax,
                    portQ: project.portQ,
                    splEnvironment: project.splEnvironment,
                    driverConfig: project.driverConfig,
                    passiveXoEnabled: project.passiveXoEnabled,
                    passiveXoType: project.passiveXoType,
                    passiveXoInductance: parseFloat(String(project.passiveXoInductance)) || 0.0,
                    passiveXoCapacitance: parseFloat(String(project.passiveXoCapacitance)) || 0.0,
                    passiveXoDcr: parseFloat(String(project.passiveXoDcr)) || 0.0,
                  } });
                } else {
                  result = await invoke("simulate_system", { request: {
                    driver: project.driver,
                    vBox: parseFloat(String(project.vBox)) || 1.0,
                    enclosureType: project.enclosureType,
                    tuningFreq: parseFloat(String(project.tuningFreq)) || 1.0,
                    portDiameter: parseFloat(String(project.portDiameter)) || 10.0,
                    inputPower: parseFloat(String(project.inputPower)) || 1.0,
                    distance: parseFloat(String(project.distance)) || 1.0,
                    numDrivers: parseInt(String(project.numDrivers)) || 1,
                    curveType: mode,
                    fMin,
                    fMax,
                    portShape: project.portShape,
                    portCount: parseInt(String(project.portCount)) || 1,
                    portWidth: parseFloat(String(project.portWidth)) || 10.0,
                    portHeight: parseFloat(String(project.portHeight)) || 10.0,
                    vRear: parseFloat(String(project.vRear)) || 80.0,
                    vFront: parseFloat(String(project.vFront)) || 40.0,
                    frontTuningFreq: parseFloat(String(project.frontTuningFreq)) || 55.0,
                    rearTuningFreq: parseFloat(String(project.rearTuningFreq)) || 30.0,
                    frontPortDiameter: parseFloat(String(project.frontPortDiameter)) || 10.0,
                    rearPortDiameter: parseFloat(String(project.rearPortDiameter)) || 10.0,
                    internalPortDiameter: parseFloat(String(project.internalPortDiameter)) || 10.0,
                    prMms: parseFloat(String(project.prMms)) || 300.0,
                    prSd: parseFloat(String(project.prSd)) || 1680.0,
                    prFs: parseFloat(String(project.prFs)) || 25.0,
                    prQms: parseFloat(String(project.prQms)) || 5.0,
                    portQ: project.portQ,
                    splEnvironment: project.splEnvironment,
                    driverConfig: project.driverConfig,
                    port2Enabled: project.port2Enabled,
                    port2Count: parseInt(String(project.port2Count)) || 1,
                    port2Diameter: parseFloat(String(project.port2Diameter)) || 10.0,
                    port2Shape: project.port2Shape,
                    port2Width: parseFloat(String(project.port2Width)) || 20.0,
                    port2Height: parseFloat(String(project.port2Height)) || 5.0,
                    passiveXoEnabled: project.passiveXoEnabled,
                    passiveXoType: project.passiveXoType,
                    passiveXoInductance: parseFloat(String(project.passiveXoInductance)) || 0.0,
                    passiveXoCapacitance: parseFloat(String(project.passiveXoCapacitance)) || 0.0,
                    passiveXoDcr: parseFloat(String(project.passiveXoDcr)) || 0.0,
                  } });
                }
                projectResults[mode] = result;
              })
            );
            newResults[project.id] = projectResults;
          })
        );
        setSimulationResults(newResults);
      } catch (err) {
        console.error("Simulation failed:", err);
      }
    }
    if (projects.length > 0 && visibleGraphs.length > 0) {
      runAllSims();
    }
  }, [projects, visibleGraphs, graphConfigs, globalXMin, globalXMax, overrideXLimits]);

  // Physical port length calculation (cm) — uses combined area of port1 + port2
  const portLength = useMemo(() => {
    if (activeProject.enclosureType !== "ported") return { lengthCm: 0, clamped: false };
    const num = activeProject.numDrivers > 0 ? activeProject.numDrivers : 1;
    const vBoxM3 = (activeProject.vBox / num) * 1e-3;
    const count = activeProject.portCount > 0 ? activeProject.portCount : 1;

    let ap = 0;
    if (activeProject.portShape === "rectangular") {
      const wM = activeProject.portWidth * 0.01;
      const hM = activeProject.portHeight * 0.01;
      ap = count * wM * hM;
    } else {
      const rPortM = (activeProject.portDiameter / 2.0) * 0.01;
      ap = count * Math.PI * rPortM * rPortM;
    }

    // Add port2 area if enabled
    if (activeProject.port2Enabled) {
      const p2count = activeProject.port2Count > 0 ? activeProject.port2Count : 1;
      if (activeProject.port2Shape === "rectangular") {
        const wM = activeProject.port2Width * 0.01;
        const hM = activeProject.port2Height * 0.01;
        ap += p2count * wM * hM;
      } else {
        const rM = (activeProject.port2Diameter / 2.0) * 0.01;
        ap += p2count * Math.PI * rM * rM;
      }
    }

    if (ap <= 0 || activeProject.tuningFreq <= 0 || vBoxM3 <= 0) return { lengthCm: 0, clamped: false };
    const rEq = Math.sqrt(ap / Math.PI);
    const c = 343.0;
    const term1 = (c * c * ap) / (4.0 * Math.PI * Math.PI * activeProject.tuningFreq * activeProject.tuningFreq * vBoxM3);
    const lengthM = term1 - 0.732 * rEq;
    // Floor must match derive_port_length_m in circuit.rs, or the length shown here is
    // not the length being simulated. Below it the vent is too large for this box at
    // this Fb: the end correction alone already overshoots the target tuning.
    const clamped = lengthM < MIN_PORT_LENGTH_M;
    return { lengthCm: Math.max(MIN_PORT_LENGTH_M, lengthM) * 100.0, clamped };
  }, [activeProject]);

  // Frequency at which ka = 0.5 — the low-frequency piston radiation model starts breaking down
  // above this point for the active driver.
  const kaWarningFreq = useMemo(() => {
    const sd_m2 = activeProject.driver.sd * 1e-4;
    const a_rad = Math.sqrt(sd_m2 / Math.PI);
    return Math.round((0.5 * 343) / (2 * Math.PI * a_rad));
  }, [activeProject.driver.sd]);

  // Derived system statistics — computed analytically from T/S params + box params.
  // These update instantly without a simulation round-trip.
  // Derived system statistics — computed analytically from T/S params + box params.
  // These update instantly without a simulation round-trip.
  const systemStats = useMemo(
    () => computeSystemStats(activeProject, activeProjectId, simulationResults),
    [activeProject, activeProjectId, simulationResults],
  );

  // Exporting reads the finished project and its stats; it has no simulation state of
  // its own, so it lives in its own hook and is re-exposed here for existing callers.
  const exports = useSimulationExport(activeProject, filters, systemStats);

  // Memoised filter gain function — recreated when the filter list changes.
  const filterGainFn = useMemo((): ((f: number) => number) | null => {
    const active = filters.filter(flt => flt.enabled);
    if (active.length === 0) return null;
    return (f: number) => totalFilterGainDb(active, f);
  }, [filters]);

  // Memoised room correction function — lazy cache so each frequency is computed once.
  const roomCorrectionFn = useMemo((): ((f: number) => number) | null => {
    if (!roomConfig.enabled) return null;
    const cache = new Map<number, number>();
    return (f: number) => {
      let v = cache.get(f);
      if (v === undefined) {
        [v] = computeRoomCorrection(roomConfig, [f]);
        cache.set(f, v);
      }
      return v;
    };
  }, [roomConfig]);

  // Memoised linear filter gain factor — recreated when the filter list changes.
  const filterLinearFn = useMemo((): ((f: number) => number) | null => {
    const active = filters.filter(flt => flt.enabled);
    if (active.length === 0) return null;
    return (f: number) => {
      const db = totalFilterGainDb(active, f);
      return Math.pow(10, db / 20);
    };
  }, [filters]);

  // Memoised cabin gain function
  const cabinGainFn = useMemo((): ((f: number) => number) | null => {
    if (!cabinConfig.enabled) return null;
    return (f: number) => {
      if (f <= 0) return 0;
      const ratio = cabinConfig.fCabin / f;
      const ratio4 = ratio * ratio * ratio * ratio;
      return 10 * Math.log10(1 + ratio4);
    };
  }, [cabinConfig]);

  const getDisplayValue = useCallback((mode: CurveType, freq: number, rawVal: number) => {
    let val = rawVal;
    if (filterGainFn && (mode === "spl" || mode === "transfer")) {
      val += filterGainFn(freq);
    } else if (filterLinearFn && (mode === "excursion" || mode === "velocity")) {
      val *= filterLinearFn(freq);
    }
    if (roomCorrectionFn && mode === "spl") {
      val += roomCorrectionFn(freq);
    }
    if (cabinGainFn && mode === "spl") {
      val += cabinGainFn(freq);
    }
    return val;
  }, [filterGainFn, filterLinearFn, roomCorrectionFn, cabinGainFn]);

  // Derive phase (degrees, unwrapped, passband-normalised to 0°) and group delay (ms)
  // from the "transfer" simulation data. No extra backend calls needed.
  const phaseGdData = useMemo((): Record<string, { phase: SimPoint[]; group_delay: SimPoint[] }> => {
    const out: Record<string, { phase: SimPoint[]; group_delay: SimPoint[] }> = {};
    for (const project of projects) {
      const pts = simulationResults[project.id]?.["transfer"];
      if (!pts || pts.length < 3) continue;

      // Step 1: unwrap phase in radians using consecutive-difference unwrapping
      const raw = pts.map(p => p.phase_rad ?? 0);
      const unwrapped: number[] = [raw[0]];
      for (let i = 1; i < raw.length; i++) {
        let delta = raw[i] - raw[i - 1];
        while (delta >  Math.PI) delta -= 2 * Math.PI;
        while (delta < -Math.PI) delta += 2 * Math.PI;
        unwrapped.push(unwrapped[i - 1] + delta);
      }

      // Step 2: normalise so the passband (top 15% of frequency range) sits near 0°
      const refRad = unwrapped[Math.floor(unwrapped.length * 0.88)] ?? 0;
      const phaseDeg = unwrapped.map(r => (r - refRad) * (180 / Math.PI));

      // Step 3: group delay τ_g = -dφ/dω  (central differences, result in ms)
      const gdMs = pts.map((_, i) => {
        const i0 = Math.max(0, i - 1);
        const i1 = Math.min(pts.length - 1, i + 1);
        const dOmega = 2 * Math.PI * (pts[i1].frequency - pts[i0].frequency);
        if (Math.abs(dOmega) < 1e-9) return 0;
        const ms = -(unwrapped[i1] - unwrapped[i0]) / dOmega * 1000;
        return Math.max(0, isFinite(ms) ? ms : 0);
      });

      out[project.id] = {
        phase:       pts.map((p, i) => ({ frequency: p.frequency, db: phaseDeg[i] })),
        group_delay: pts.map((p, i) => ({ frequency: p.frequency, db: gdMs[i]     })),
      };
    }
    return out;
  }, [projects, simulationResults]);

  // Call Tauri to optimize venting dimensions based on driver excursion and power compression limits
  const handleAutoCalculatePort = async () => {
    try {
      const rec: any = await invoke("auto_calculate_port", { request: {
        driver: activeProject.driver,
        vBox: parseFloat(String(activeProject.vBox)) || 1.0,
        tuningFreq: parseFloat(String(activeProject.tuningFreq)) || 33.0,
        inputPower: parseFloat(String(activeProject.inputPower)) || 1.0,
        numDrivers: parseInt(String(activeProject.numDrivers)) || 1,
        driverConfig: activeProject.driverConfig,
        portQ: activeProject.portQ,
        port2Enabled: activeProject.port2Enabled,
        port2Count: activeProject.port2Count,
        port2Diameter: activeProject.port2Diameter,
        port2Shape: activeProject.port2Shape,
        port2Width: activeProject.port2Width,
        port2Height: activeProject.port2Height,
      } });
      updateActiveProject({
        portShape: rec.port_shape,
        portCount: rec.port_count,
        portWidth: rec.port_shape === "rectangular" ? rec.port_width : activeProject.portWidth,
        portHeight: rec.port_shape === "rectangular" ? rec.port_height : activeProject.portHeight,
        portDiameter: rec.port_shape === "circular" ? rec.port_diameter : activeProject.portDiameter,
      });
    } catch (err) {
      console.error("Auto-calculate port venting failed:", err);
      toast.error("Failed to auto-calculate: " + err);
    }
  };

  const handleApplyAlignment = async (
    alignmentPref: AlignmentTarget,
    constraints: AlignmentConstraints = {},
    passband: PassbandTarget | null = null,
  ): Promise<AlignmentRecommendation | null> => {
    const drv = activeProject.driver;
    if (!drv.fs || !drv.qts || !drv.vas) {
      await confirmDialog({
        title: "Cannot Auto-Align",
        body: "Active driver is missing key TS parameters (Fs, Qts, Vas) required for alignment.",
        okOnly: true,
      });
      return null;
    }

    try {
      // The solver searches the same circuit model that draws the graphs, so the
      // recommendation always matches the curve that comes back.
      const rec: AlignmentRecommendation = await invoke("auto_align_enclosure", {
        driver: drv,
        enclosureType: activeProject.enclosureType,
        alignmentTarget: alignmentPref,
        numDrivers: parseInt(String(activeProject.numDrivers)) || 1,
        inputPower: parseFloat(String(activeProject.inputPower)) || 1.0,
        driverConfig: activeProject.driverConfig,
        portQ: activeProject.portQ,
        prMms: activeProject.prMms,
        prSd: activeProject.prSd,
        prQms: activeProject.prQms,
        constraints,
        passband,
      });

      const patch: Partial<typeof activeProject> = {};
      if (activeProject.enclosureType === "sealed") {
        patch.vBox = rec.v_box;
      } else if (activeProject.enclosureType === "passive_radiator") {
        patch.vBox = rec.v_box;
        // A passive radiator is tuned by its own Fs — simulate_system reads prFs, not
        // tuningFreq, so writing only tuningFreq here would leave the box untuned.
        patch.prFs = rec.tuning_freq;
        patch.tuningFreq = rec.tuning_freq;
      } else if (activeProject.enclosureType === "ported") {
        patch.vBox = rec.v_box;
        patch.tuningFreq = rec.tuning_freq;
      } else {
        patch.vRear = rec.v_rear;
        patch.vFront = rec.v_front;
        patch.frontTuningFreq = rec.front_tuning_freq;
        if (rec.rear_tuning_freq > 0) patch.rearTuningFreq = rec.rear_tuning_freq;
      }
      updateActiveProject(patch);

      if (activeProject.enclosureType === "ported") {
        try {
          const port: any = await invoke("auto_calculate_port", { request: {
            driver: drv,
            vBox: rec.v_box,
            tuningFreq: rec.tuning_freq,
            inputPower: parseFloat(String(activeProject.inputPower)) || 1.0,
            numDrivers: parseInt(String(activeProject.numDrivers)) || 1,
            driverConfig: activeProject.driverConfig,
            portQ: activeProject.portQ,
            port2Enabled: activeProject.port2Enabled,
            port2Count: activeProject.port2Count,
            port2Diameter: activeProject.port2Diameter,
            port2Shape: activeProject.port2Shape,
            port2Width: activeProject.port2Width,
            port2Height: activeProject.port2Height,
          } });
          updateActiveProject({
            portShape: port.port_shape,
            portCount: port.port_count,
            portWidth: port.port_shape === "rectangular" ? port.port_width : activeProject.portWidth,
            portHeight: port.port_shape === "rectangular" ? port.port_height : activeProject.portHeight,
            portDiameter: port.port_shape === "circular" ? port.port_diameter : activeProject.portDiameter,
          });
        } catch (err) {
          console.error("Auto port sizing after box alignment failed:", err);
        }
      }

      return rec;
    } catch (err) {
      console.error("Auto-align failed:", err);
      toast.error("Auto-align failed: " + err);
      return null;
    }
  };

  return {
    simulationResults,
    calculatedPortLength: portLength.lengthCm,
    portLengthClamped: portLength.clamped,
    kaWarningFreq, systemStats, getDisplayValue, phaseGdData,
    filterGainFn, roomCorrectionFn, filterLinearFn, cabinGainFn,
    handleAutoCalculatePort, handleApplyAlignment,
    ...exports,
  };
}
