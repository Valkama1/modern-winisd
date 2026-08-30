import { useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { save as saveDialogFile } from "@tauri-apps/plugin-dialog";
import { openPath } from "@tauri-apps/plugin-opener";
import { CurveType, EqFilter, Project } from "../types";
import { Stat } from "../lib/systemStats";

/**
 * Graph and report exporting: SVG, PNG, and the standalone HTML summary.
 *
 * Split out of useSimulation because none of it is simulation — it only reads the
 * finished project, its stats and the rendered SVG nodes. Keeping it here means the
 * summary's HTML template can grow without pushing the simulation logic further down
 * its own file.
 */
export function useSimulationExport(
  activeProject: Project,
  filters: EqFilter[],
  systemStats: Stat[],
) {

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

  return {
    svgRefsMap,
    showExportMenu,
    setShowExportMenu,
    handleExportSVG,
    handleExportPNG,
    handleExportSummary,
  };
}
