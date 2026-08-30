import { memo } from "react";
import { findLFCrossover } from "../../../lib/calculations";
import { formatWatts, limitTransition, xmaxHeadroom } from "../../../lib/driverLimits";
import { GraphGeometry, PADDING } from "./graphGeometry";
import { useProjectsContext } from "../../../context/ProjectsContext";
import { useSimulationContext } from "../../../context/SimulationContext";

const { left: paddingLeft, right: paddingRight, top: paddingTop, bottom: paddingBottom } =
  PADDING;

/**
 * Curve-specific guides: phase wraps, the F3/F6/F10 marks, driver Fs, the chuffing
 * limit and Xmax.
 */
function GraphReferenceLines({ geo }: { geo: GraphGeometry }) {
  const { activeProject, activeProjectId } = useProjectsContext();
  const { simulationResults } = useSimulationContext();
  const {
    getX, getY, width, height, fMin, fMax,
    dbMin: currentDbMin, dbMax: currentDbMax, mode,
  } = geo;

  return (
    <>
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

      {/* MAX SPL: where the binding limit changes from cone travel to coil heating */}
      {mode === "max_spl" && (() => {
        const pts = simulationResults[activeProjectId]?.["max_spl"] ?? [];
        const transition = limitTransition(pts);
        if (!transition || transition.frequencyHz < fMin || transition.frequencyHz > fMax) return null;
        const x = getX(transition.frequencyHz);
        const lower = transition.belowIsExcursion ? "excursion" : "power";
        const upper = transition.belowIsExcursion ? "power" : "excursion";
        return (
          <g>
            <line
              x1={x} y1={paddingTop} x2={x} y2={height - paddingBottom}
              stroke="var(--danger-color)" strokeWidth="1.25" strokeDasharray="5 4" opacity={0.75}
            />
            <text
              x={x - 6} y={paddingTop + 14} textAnchor="end"
              fill="var(--danger-color)" fontSize="10" className="opacity-90"
            >
              {lower}-limited
            </text>
            <text
              x={x + 6} y={paddingTop + 14} textAnchor="start"
              fill="var(--danger-color)" fontSize="10" className="opacity-90"
            >
              {upper}-limited ({transition.frequencyHz.toFixed(0)} Hz)
            </text>
          </g>
        );
      })()}

      {/* EXCURSION: Xmax limit */}
      {mode === "excursion" && activeProject.driver.xmax >= currentDbMin && activeProject.driver.xmax <= currentDbMax && (() => {
        const y = getY(activeProject.driver.xmax);
        // Build annotation suffix showing power-at-Xmax if excursion data available
        let suffix = "";
        const headroom = xmaxHeadroom(
          activeProject.driver.xmax,
          Math.max(1e-6, parseFloat(String(activeProject.inputPower)) || 1),
          simulationResults[activeProjectId]?.["excursion"] ?? [],
          simulationResults[activeProjectId]?.["spl"] ?? [],
        );
        if (headroom) {
          const splStr =
            headroom.splAtXmax === null ? "" : ` / ${headroom.splAtXmax.toFixed(0)} dB`;
          suffix = `  @ ${formatWatts(headroom.powerAtXmax)}W${splStr}`;
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

    </>
  );
}

// Reads project and simulation context only — nothing that changes on pointer move.
export default memo(GraphReferenceLines);
