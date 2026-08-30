import { Project, CurveType, SimPoint } from "../types";
import { findLFCrossover } from "./calculations";

/** One row in the derived-statistics panel. */
export type Stat = {
  label: string;
  value: string;
  accent?: boolean;
  warn?: boolean;
  danger?: boolean;
  fullWidth?: boolean;
};

/**
 * Statistics derived analytically from the T/S parameters and box geometry.
 *
 * Pure by design: everything here follows in closed form from the project, so it
 * updates instantly without waiting on a simulation round-trip. `simulationResults`
 * is only read for the few stats that need the solved curves.
 */
export function computeSystemStats(
  activeProject: Project,
  activeProjectId: string,
  simulationResults: Record<string, Record<CurveType, SimPoint[]>>,
): Stat[] {
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
}
