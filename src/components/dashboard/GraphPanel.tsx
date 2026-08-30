import { useEffect, useState } from "react";
import { Info } from "lucide-react";
import { findLFCrossover } from "../../lib/calculations";
import { CurveType } from "../../types";
import { useProjectsContext } from "../../context/ProjectsContext";
import { useGraphViewportContext } from "../../context/GraphViewportContext";
import { useSimulationContext } from "../../context/SimulationContext";

const paddingLeft = 55;
const paddingRight = 20;
const paddingTop = 45;
const paddingBottom = 40;

export default function GraphPanel({ mode }: { mode: CurveType }) {
  const { projects, activeProjectId, activeProject } = useProjectsContext();
  const {
    dashboardWidth, graphHeights, handleResizeStart, graphConfigs,
    getGraphXLimits, rulerFreq, setRulerFreq, hoveredFreq, setHoveredFreq,
  } = useGraphViewportContext();
  const {
    simulationResults, getDisplayValue, phaseGdData, svgRefsMap, kaWarningFreq,
    filterGainFn, roomCorrectionFn, filterLinearFn, cabinGainFn,
  } = useSimulationContext();

  // Draggable Ruler State (local to this graph panel's own drag interaction)
  const [isDraggingRuler, setIsDraggingRuler] = useState(false);

  // Release draggable ruler on global mouseup
  useEffect(() => {
    if (!isDraggingRuler) return;
    const handleMouseUp = () => setIsDraggingRuler(false);
    window.addEventListener("mouseup", handleMouseUp);
    return () => window.removeEventListener("mouseup", handleMouseUp);
  }, [isDraggingRuler]);

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
  : mode === "excursion"   ? "Cone Excursion (mm peak)"
  : mode === "velocity"    ? "Port Air Velocity (m/s)"
  :                          "System Electrical Impedance (Ω)";

  return (
    <div
      className="border rounded-xl p-5 flex flex-col gap-4 animate-fadeIn"
      style={{ backgroundColor: "var(--sidebar-color)", borderColor: "var(--border-color)" }}
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
                      <div key={project.id} className="flex items-center gap-1.5 border-l pl-4 first:border-none first:pl-0" style={{ borderColor: "var(--border-color)" }}>
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
            Peak one-way displacement at {activeProject.inputPower}W. Keep it below the driver's linear limit (Xmax = {activeProject.driver.xmax} mm).
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
}
