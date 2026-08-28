import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { save as saveDialogFile } from "@tauri-apps/plugin-dialog";
import { openPath } from "@tauri-apps/plugin-opener";
import { CurveType, SimPoint } from "../types";
import { findLFCrossover, computeRoomCorrection, totalFilterGainDb } from "../lib/calculations";
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

  // ── SVG export refs ────────────────────────────────────────────────────────
  const svgRefsMap = useRef<Map<CurveType, SVGSVGElement>>(new Map());
  const [showExportMenu, setShowExportMenu] = useState<CurveType | null>(null);

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

  const resolveSvgStyle = (svgEl: SVGSVGElement): string => {
    const rawText = new XMLSerializer().serializeToString(svgEl);
    const styles = getComputedStyle(document.documentElement);
    const textColor = styles.getPropertyValue("--text-color").trim() || "#f8fafc";
    const gridColor = styles.getPropertyValue("--graph-grid-color").trim() || "#334155";
    const accentColor = styles.getPropertyValue("--accent-color").trim() || "#059669";
    const sidebarColor = styles.getPropertyValue("--sidebar-color").trim() || "#1e293b";
    const bgColor = styles.getPropertyValue("--bg-color").trim() || "#0f172a";

    return rawText
      .replace(/var\(--text-color\)/g, textColor)
      .replace(/var\(--graph-grid-color\)/g, gridColor)
      .replace(/var\(--accent-color\)/g, accentColor)
      .replace(/var\(--sidebar-color\)/g, sidebarColor)
      .replace(/var\(--bg-color\)/g, bgColor);
  };

  const handleExportSVG = async (mode: CurveType) => {
    const svgEl = svgRefsMap.current.get(mode);
    if (!svgEl) return;
    const resolvedSvgText = resolveSvgStyle(svgEl);
    const svgText = '<?xml version="1.0" encoding="UTF-8"?>\n'
      + resolvedSvgText;
    const path = await saveDialogFile({
      filters: [{ name: "SVG Image", extensions: ["svg"] }],
      defaultPath: `${activeProject.name.replace(/\s+/g, "_")}-${mode}.svg`,
    });
    if (path) await invoke("write_text_file", { path, content: svgText });
  };

  const handleExportPNG = async (mode: CurveType) => {
    const svgEl = svgRefsMap.current.get(mode);
    if (!svgEl) return;
    const resolvedSvgText = resolveSvgStyle(svgEl);
    const blob = new Blob([resolvedSvgText], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    await new Promise<void>((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const vb = svgEl.viewBox.baseVal;
        const canvas = document.createElement("canvas");
        canvas.width  = vb.width  * 2; // 2× for retina quality
        canvas.height = vb.height * 2;
        const ctx = canvas.getContext("2d")!;

        // Resolve bg color
        const styles = getComputedStyle(document.documentElement);
        const bgColor = styles.getPropertyValue("--bg-color").trim() || "#0f172a";
        ctx.fillStyle = bgColor;

        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        URL.revokeObjectURL(url);
        const dataUrl = canvas.toDataURL("image/png");
        saveDialogFile({
          filters: [{ name: "PNG Image", extensions: ["png"] }],
          defaultPath: `${activeProject.name.replace(/\s+/g, "_")}-${mode}.png`,
        }).then(path => {
          if (path) invoke("write_data_url_file", { path, dataUrl }).then(() => resolve()).catch(reject);
          else resolve();
        }).catch(reject);
      };
      img.onerror = reject;
      img.src = url;
    });
  };

  const handleExportSummary = async () => {
    const stats = systemStats;
    const f3Str  = stats.find(s => s.label === "F3")?.value  ?? "—";
    const f6Str  = stats.find(s => s.label === "F6")?.value  ?? "—";
    const f10Str = stats.find(s => s.label === "F10")?.value ?? "—";
    const sensStr  = stats.find(s => s.label === "Sens 1W/1m")?.value  ?? "—";
    const maxSplStr = stats.find(s => s.label === "Max SPL (Xmax)")?.value ?? "—";
    const netVbStr  = stats.find(s => s.label === "Net Vb")?.value ?? "—";

    const rows = stats.map(s =>
      `<tr><td>${s.label}</td><td>${s.value}</td></tr>`
    ).join("\n");

    const filterRows = filters.filter(f => f.enabled).map(f =>
      `<tr><td>${f.type.toUpperCase()}</td><td>${f.freq} Hz</td><td>Q ${f.q}</td><td>${f.gain > 0 ? "+" : ""}${f.gain} dB</td></tr>`
    ).join("\n");

    const d = activeProject.driver;
    const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>WinISD Summary – ${activeProject.name}</title>
<style>
  body { font-family: system-ui, sans-serif; max-width: 800px; margin: 40px auto; color: #1e293b; }
  h1 { color: #059669; } h2 { color: #334155; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px; }
  table { border-collapse: collapse; width: 100%; margin-bottom: 24px; }
  td, th { border: 1px solid #e2e8f0; padding: 6px 10px; text-align: left; font-size: 13px; }
  th { background: #f8fafc; font-weight: 600; }
  .accent { color: #059669; font-weight: 700; }
  @media print { body { margin: 20px; } }
</style>
</head>
<body>
<h1>WinISD Design Summary</h1>
<p><strong>Project:</strong> ${activeProject.name} &nbsp;|&nbsp; <strong>Date:</strong> ${new Date().toLocaleDateString()}</p>

<h2>Driver</h2>
<table>
<tr><th>Parameter</th><th>Value</th><th>Parameter</th><th>Value</th></tr>
<tr><td>Manufacturer</td><td>${d.manufacturer}</td><td>Model</td><td>${d.model}</td></tr>
<tr><td>Fs</td><td>${d.fs} Hz</td><td>Qts</td><td>${d.qts}</td></tr>
<tr><td>Qes</td><td>${d.qes}</td><td>Qms</td><td>${d.qms}</td></tr>
<tr><td>Vas</td><td>${d.vas} L</td><td>Re</td><td>${d.re} Ω</td></tr>
<tr><td>Sd</td><td>${d.sd} cm²</td><td>Xmax</td><td>${d.xmax} mm</td></tr>
<tr><td>Mms</td><td>${d.mms} g</td><td>BL</td><td>${d.bl} T·m</td></tr>
<tr><td>Le</td><td>${d.le} mH</td><td>Pe (max)</td><td>${d.pe} W</td></tr>
<tr><td>Sensitivity</td><td>${d.sens} dB SPL</td><td></td><td></td></tr>
</table>

<h2>Enclosure</h2>
<table>
<tr><th>Parameter</th><th>Value</th></tr>
<tr><td>Type</td><td>${activeProject.enclosureType}</td></tr>
<tr><td>Box Volume (Vb)</td><td>${activeProject.vBox} L</td></tr>
<tr><td>Drivers</td><td>${activeProject.numDrivers}</td></tr>
${activeProject.enclosureType === "ported" ? `<tr><td>Tuning Freq</td><td>${activeProject.tuningFreq} Hz</td></tr>
<tr><td>Port</td><td>${activeProject.portCount}× Ø${activeProject.portDiameter} cm</td></tr>` : ""}
</table>

<h2>Simulation Results</h2>
<table>
<tr><th>Metric</th><th>Value</th></tr>
<tr><td class="accent">F3</td><td class="accent">${f3Str}</td></tr>
<tr><td>F6</td><td>${f6Str}</td></tr>
<tr><td>F10</td><td>${f10Str}</td></tr>
<tr><td>Sensitivity 1W/1m</td><td>${sensStr}</td></tr>
<tr><td>Max SPL @ Xmax</td><td>${maxSplStr}</td></tr>
<tr><td>Net Internal Volume</td><td>${netVbStr}</td></tr>
${rows}
</table>

${filterRows ? `<h2>EQ / Signal Chain</h2>
<table>
<tr><th>Type</th><th>Frequency</th><th>Q</th><th>Gain</th></tr>
${filterRows}
</table>` : ""}

${activeProject.notes ? `<h2>Notes</h2><p style="white-space:pre-wrap">${activeProject.notes.replace(/</g,"&lt;")}</p>` : ""}

<p style="color:#94a3b8;font-size:11px;margin-top:40px">Generated by WinISD Modern — ${new Date().toISOString()}</p>
</body>
</html>`;

    const path = await saveDialogFile({
      filters: [{ name: "HTML Report", extensions: ["html"] }],
      defaultPath: `${activeProject.name.replace(/\s+/g, "_")}-summary.html`,
    });
    if (path) {
      await invoke("write_text_file", { path, content: html });
      await openPath(path);
    }
  };

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
                  result = await invoke("simulate_custom", {
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
                  });
                } else {
                  result = await invoke("simulate_system", {
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
                  });
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
  const calculatedPortLength = useMemo(() => {
    if (activeProject.enclosureType !== "ported") return 0;
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

    if (ap <= 0 || activeProject.tuningFreq <= 0 || vBoxM3 <= 0) return 0;
    const rEq = Math.sqrt(ap / Math.PI);
    const c = 343.0;
    const term1 = (c * c * ap) / (4.0 * Math.PI * Math.PI * activeProject.tuningFreq * activeProject.tuningFreq * vBoxM3);
    const lengthM = term1 - 0.732 * rEq;
    return Math.max(0.1, lengthM * 100.0);
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
  const systemStats = useMemo(() => {
    type Stat = {
      label: string; value: string;
      accent?: boolean; warn?: boolean; danger?: boolean; fullWidth?: boolean;
    };
    const stats: Stat[] = [];
    const n = Math.max(1, activeProject.numDrivers);

    // ── Enclosure-specific analytical stats ──────────────────────────────────
    if (activeProject.enclosureType === "sealed") {
      const vbEff = activeProject.vBox / n;
      if (vbEff > 0 && activeProject.driver.vas > 0) {
        const alpha = activeProject.driver.vas / vbEff;
        const qtc   = activeProject.driver.qts * Math.sqrt(1 + alpha);
        const fc    = activeProject.driver.fs  * Math.sqrt(1 + alpha);
        const b  = 2 - 1 / (qtc * qtc);
        const v  = (-b + Math.sqrt(b * b + 4)) / 2;
        const f3Analytical = fc * Math.sqrt(Math.max(0, v));
        const isIdeal = qtc >= 0.65 && qtc <= 0.75;
        let alignment: string;
        if      (qtc < 0.5)   alignment = "Overdamped";
        else if (qtc < 0.65)  alignment = "Near-flat";
        else if (qtc <= 0.75) alignment = "Butterworth B2";
        else if (qtc <= 1.0)  alignment = "Underdamped";
        else                  alignment = "Peaked";
        stats.push(
          { label: "Qtc",        value: qtc.toFixed(3), accent: isIdeal },
          { label: "Fc",         value: `${fc.toFixed(1)} Hz` },
          { label: "Est. F3",    value: `${f3Analytical.toFixed(1)} Hz` },
          { label: "α = Vas/Vb", value: alpha.toFixed(2) },
          { label: "Alignment",  value: alignment, accent: isIdeal, fullWidth: true },
        );
      }

    } else if (activeProject.enclosureType === "ported") {
      const vbEff = activeProject.vBox / n;
      if (vbEff > 0 && activeProject.driver.fs > 0) {
        const h     = activeProject.tuningFreq / activeProject.driver.fs;
        const alpha = activeProject.driver.vas / vbEff;
        stats.push(
          { label: "Fb",          value: `${activeProject.tuningFreq} Hz` },
          { label: "h = Fb / Fs", value: h.toFixed(3) },
          { label: "α = Vas/Vb",  value: alpha.toFixed(2) },
          { label: "Vb / Vas",    value: (vbEff / activeProject.driver.vas).toFixed(2) },
        );
      }

    } else if (activeProject.enclosureType === "bandpass4") {
      const vf = activeProject.vFront > 0 ? activeProject.vFront : 1;
      const vr = activeProject.vRear  > 0 ? activeProject.vRear  : 1;
      stats.push(
        { label: "Front Fb",  value: `${activeProject.frontTuningFreq} Hz` },
        { label: "Vr / Vf",  value: (activeProject.vRear / activeProject.vFront).toFixed(2) },
        { label: "Rear vol",  value: `${vr} L` },
        { label: "Front vol", value: `${vf} L` },
      );

    } else if (activeProject.enclosureType === "bandpass6_parallel" || activeProject.enclosureType === "bandpass6_series") {
      const centerF = Math.sqrt(activeProject.frontTuningFreq * activeProject.rearTuningFreq);
      const bwOct   = Math.abs(Math.log2(activeProject.frontTuningFreq / activeProject.rearTuningFreq));
      stats.push(
        { label: "Rear Fb",     value: `${activeProject.rearTuningFreq} Hz` },
        { label: "Front Fb",    value: `${activeProject.frontTuningFreq} Hz` },
        { label: "Geo. center", value: `${centerF.toFixed(1)} Hz` },
        { label: "BW",          value: `${bwOct.toFixed(1)} oct` },
      );

    } else if (activeProject.enclosureType === "passive_radiator") {
      const vbEff = activeProject.vBox / n;
      if (vbEff > 0 && activeProject.driver.fs > 0) {
        const h     = activeProject.prFs / activeProject.driver.fs;
        const alpha = activeProject.driver.vas / vbEff;
        stats.push(
          { label: "PR Fs",       value: `${activeProject.prFs} Hz` },
          { label: "h = Fb / Fs", value: h.toFixed(3) },
          { label: "α = Vas/Vb",  value: alpha.toFixed(2) },
          { label: "Vb / Vas",    value: (vbEff / activeProject.driver.vas).toFixed(2) },
        );
      }
    }

    // ── F3 / F6 / F10 from simulation transfer curve ─────────────────────────
    const transferPts = simulationResults[activeProjectId]?.["transfer"] ?? [];
    if (transferPts.length >= 10) {
      const f3  = findLFCrossover(transferPts, 3);
      const f6  = findLFCrossover(transferPts, 6);
      const f10 = findLFCrossover(transferPts, 10);
      if (f3  !== null) stats.push({ label: "F3",  value: `${f3.toFixed(1)} Hz`,  accent: true });
      if (f6  !== null) stats.push({ label: "F6",  value: `${f6.toFixed(1)} Hz` });
      if (f10 !== null) stats.push({ label: "F10", value: `${f10.toFixed(1)} Hz` });
    }

    // ── Sensitivity @ 1 W / 1 m ──────────────────────────────────────────────
    const splPts = simulationResults[activeProjectId]?.["spl"] ?? [];
    let sens1w1m: number | null = null;
    if (splPts.length >= 10) {
      // Use median SPL from the upper 40 % of frequency points (flat passband)
      const topSlice = splPts.slice(Math.floor(splPts.length * 0.6)).map(p => p.db).sort((a, b) => a - b);
      const passband = topSlice[Math.floor(topSlice.length / 2)];
      const p = Math.max(1e-6, parseFloat(String(activeProject.inputPower)) || 1);
      const d = Math.max(0.01,  parseFloat(String(activeProject.distance))   || 1);
      sens1w1m = passband - 10 * Math.log10(p) + 20 * Math.log10(d);
    }
    if (sens1w1m !== null) {
      stats.push({ label: "Sens 1W/1m", value: `${sens1w1m.toFixed(1)} dB SPL` });
    }

    // ── Maximum SPL before Xmax ───────────────────────────────────────────────
    const excPts = simulationResults[activeProjectId]?.["excursion"] ?? [];
    if (excPts.length >= 2 && activeProject.driver.xmax > 0 && splPts.length >= 10) {
      const peakExcMm = Math.max(...excPts.map(p => p.db));
      if (peakExcMm > 0) {
        const pIn = Math.max(1e-6, parseFloat(String(activeProject.inputPower)) || 1);
        const pXmax = pIn * Math.pow(activeProject.driver.xmax / peakExcMm, 2);
        // Passband SPL (already computed above)
        const topSlice = splPts.slice(Math.floor(splPts.length * 0.6)).map(p => p.db).sort((a, b) => a - b);
        const passband = topSlice[Math.floor(topSlice.length / 2)];
        const splAtXmax = passband + 10 * Math.log10(Math.max(1e-12, pXmax / pIn));
        const already = peakExcMm >= activeProject.driver.xmax;
        stats.push(
          { label: "Xmax power",    value: `${pXmax < 1 ? pXmax.toFixed(2) : pXmax.toFixed(1)} W`,        warn: already, danger: already && pXmax < pIn },
          { label: "Max SPL (Xmax)", value: `${splAtXmax.toFixed(1)} dB SPL`, warn: !already, danger: already },
        );
      }
    }

    // ── Net internal volume (ported / bandpass) ───────────────────────────────
    const hasPort = ["ported", "bandpass4", "bandpass6_parallel", "bandpass6_series"].includes(activeProject.enclosureType);
    if (hasPort && activeProject.vBox > 0) {
      const c = 343.0;
      // Per-driver gross volume
      const vbEff_m3 = (activeProject.vBox / n) * 1e-3;

      // Cylindrical port area
      let ap_m2 = Math.PI * Math.pow((activeProject.portDiameter * 0.01) / 2, 2);
      if (activeProject.portShape === "rectangular")
        ap_m2 = (activeProject.portWidth * 0.01) * (activeProject.portHeight * 0.01);
      ap_m2 = Math.max(ap_m2, 1e-6);

      const fb = Math.max(1, activeProject.tuningFreq);
      const portLen_m = Math.max(0.005,
        (c * c * ap_m2) / (4 * Math.PI * Math.PI * fb * fb * vbEff_m3)
        - 0.732 * Math.sqrt(ap_m2 / Math.PI)
      );
      const nPorts = Math.max(1, activeProject.portCount);
      const portVol_L = n * nPorts * ap_m2 * portLen_m * 1000;

      // Driver displacement estimate: Sd × 80 % of cone radius
      const sd_m2 = (activeProject.driver.sd || 1) * 1e-4;
      const coneR = Math.sqrt(sd_m2 / Math.PI);
      const driverVol_L = n * sd_m2 * (coneR * 0.8) * 1000;

      const netVb = Math.max(0, activeProject.vBox - portVol_L - driverVol_L);
      const delta = portVol_L + driverVol_L;
      stats.push({
        label: "Net Vb",
        value: `${netVb.toFixed(1)} L  (−${delta.toFixed(1)} L)`,
        fullWidth: true,
        warn: delta / activeProject.vBox > 0.15,
      });
    }

    return stats;
  }, [activeProject, activeProjectId, simulationResults]);

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
      const rec: any = await invoke("auto_calculate_port", {
        driver: activeProject.driver,
        vBox: parseFloat(String(activeProject.vBox)) || 1.0,
        tuningFreq: parseFloat(String(activeProject.tuningFreq)) || 33.0,
        inputPower: parseFloat(String(activeProject.inputPower)) || 1.0,
        numDrivers: parseInt(String(activeProject.numDrivers)) || 1,
      });
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

  const handleApplyAlignment = async (alignmentPref: "maximally_flat" | "extended_bass" | "boomy") => {
    const drv = activeProject.driver;
    if (!drv.fs || !drv.qts || !drv.vas) {
      await confirmDialog({
        title: "Cannot Auto-Align",
        body: "Active driver is missing key TS parameters (Fs, Qts, Vas) required for alignment.",
        okOnly: true,
      });
      return;
    }

    const qts = drv.qts;
    const vas = activeProject.driverConfig === "standard" ? drv.vas : drv.vas / 2;
    const fs = drv.fs;
    const num = activeProject.numDrivers;

    let targetVb = activeProject.vBox;
    let targetFb = activeProject.tuningFreq;
    let targetVRear = activeProject.vRear;
    let targetVFront = activeProject.vFront;
    let targetRearFb = activeProject.rearTuningFreq;
    let targetFrontFb = activeProject.frontTuningFreq;

    if (activeProject.enclosureType === "sealed") {
      let qtc = 0.707;
      if (alignmentPref === "extended_bass") qtc = 0.8;
      if (alignmentPref === "boomy") qtc = 0.95;

      if (qts >= qtc) {
        targetVb = vas * 2.5 * num;
      } else {
        const ratio = qtc / qts;
        targetVb = (vas / (ratio * ratio - 1)) * num;
      }
      targetVb = Math.max(0.5, Math.min(2000, targetVb));
    } else if (activeProject.enclosureType === "ported" || activeProject.enclosureType === "passive_radiator") {
      if (alignmentPref === "maximally_flat") {
        targetVb = 15.0 * vas * Math.pow(qts, 2.87) * num;
        targetFb = fs * 0.42 * Math.pow(qts, -0.9);
      } else if (alignmentPref === "extended_bass") {
        targetVb = 22.0 * vas * Math.pow(qts, 2.5) * num;
        targetFb = fs * 0.35 * Math.pow(qts, -0.9);
      } else {
        targetVb = 10.0 * vas * Math.pow(qts, 3.0) * num;
        targetFb = fs * 0.55 * Math.pow(qts, -0.9);
      }
      targetVb = Math.max(1.0, Math.min(2000, targetVb));
      targetFb = Math.max(10, Math.min(150, targetFb));
    } else if (activeProject.enclosureType === "bandpass4") {
      let qtc = 0.707;
      let frontGainMultiplier = 2.0;
      let fbMultiplier = 1.0;

      if (alignmentPref === "extended_bass") {
        qtc = 0.85;
        frontGainMultiplier = 1.5;
        fbMultiplier = 0.85;
      } else if (alignmentPref === "boomy") {
        qtc = 1.0;
        frontGainMultiplier = 2.5;
        fbMultiplier = 1.15;
      }

      const ratio = qtc / qts;
      targetVRear = qts >= qtc ? vas * 2.5 * num : (vas / (ratio * ratio - 1)) * num;
      targetVFront = vas * frontGainMultiplier * qts * qtc * num;
      targetFrontFb = fs * (qtc / qts) * fbMultiplier;

      targetVRear = Math.max(0.5, Math.min(1000, targetVRear));
      targetVFront = Math.max(0.5, Math.min(1000, targetVFront));
      targetFrontFb = Math.max(10, Math.min(150, targetFrontFb));
    } else if (activeProject.enclosureType.includes("bandpass6")) {
      if (alignmentPref === "maximally_flat") {
        targetVRear = 10.0 * vas * Math.pow(qts, 2.87) * 0.8 * num;
        targetVFront = 10.0 * vas * Math.pow(qts, 2.87) * 1.2 * num;
        targetRearFb = fs * 0.7;
        targetFrontFb = fs * 1.4;
      } else if (alignmentPref === "extended_bass") {
        targetVRear = 15.0 * vas * Math.pow(qts, 2.5) * 0.7 * num;
        targetVFront = 15.0 * vas * Math.pow(qts, 2.5) * 1.3 * num;
        targetRearFb = fs * 0.6;
        targetFrontFb = fs * 1.2;
      } else {
        targetVRear = 8.0 * vas * Math.pow(qts, 3.0) * 0.9 * num;
        targetVFront = 8.0 * vas * Math.pow(qts, 3.0) * 1.1 * num;
        targetRearFb = fs * 0.8;
        targetFrontFb = fs * 1.6;
      }
      targetVRear = Math.max(1.0, Math.min(1000, targetVRear));
      targetVFront = Math.max(1.0, Math.min(1000, targetVFront));
      targetRearFb = Math.max(10, Math.min(150, targetRearFb));
      targetFrontFb = Math.max(10, Math.min(150, targetFrontFb));
    }

    const round1 = (val: number) => Math.round(val * 10) / 10;

    updateActiveProject({
      vBox: round1(targetVb),
      tuningFreq: round1(targetFb),
      vRear: round1(targetVRear),
      vFront: round1(targetVFront),
      rearTuningFreq: round1(targetRearFb),
      frontTuningFreq: round1(targetFrontFb),
    });

    if (activeProject.enclosureType === "ported") {
      (async () => {
        try {
          const rec: any = await invoke("auto_calculate_port", {
            driver: drv,
            vBox: round1(targetVb),
            tuningFreq: round1(targetFb),
            inputPower: parseFloat(String(activeProject.inputPower)) || 1.0,
            numDrivers: parseInt(String(activeProject.numDrivers)) || 1,
          });
          updateActiveProject({
            portShape: rec.port_shape,
            portCount: rec.port_count,
            portWidth: rec.port_shape === "rectangular" ? rec.port_width : activeProject.portWidth,
            portHeight: rec.port_shape === "rectangular" ? rec.port_height : activeProject.portHeight,
            portDiameter: rec.port_shape === "circular" ? rec.port_diameter : activeProject.portDiameter,
          });
        } catch (err) {
          console.error("Auto port sizing after box alignment failed:", err);
        }
      })();
    }
  };

  return {
    simulationResults, calculatedPortLength, kaWarningFreq, systemStats, getDisplayValue, phaseGdData,
    filterGainFn, roomCorrectionFn, filterLinearFn, cabinGainFn,
    handleAutoCalculatePort, handleApplyAlignment,
    svgRefsMap, showExportMenu, setShowExportMenu, handleExportSVG, handleExportPNG, handleExportSummary,
  };
}
