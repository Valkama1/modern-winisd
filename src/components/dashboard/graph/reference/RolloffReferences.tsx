import { memo } from "react";
import { findLFCrossover } from "../../../../lib/calculations";
import { GraphGeometry, PADDING } from "../graphGeometry";
import { useProjectsContext } from "../../../../context/ProjectsContext";
import { useSimulationContext } from "../../../../context/SimulationContext";

const { left: paddingLeft, right: paddingRight, top: paddingTop, bottom: paddingBottom } =
  PADDING;

/**
 * Where the response gives out: the −3, −6 and −10 dB corners, and the driver's own
 * free-air resonance for comparison against them.
 */
function RolloffReferences({ geo }: { geo: GraphGeometry }) {
  const { activeProject, activeProjectId } = useProjectsContext();
  const { simulationResults } = useSimulationContext();
  const { getX, getY, width, height, fMin, fMax, dbMin: currentDbMin, dbMax: currentDbMax, mode } = geo;

  return (
    <>
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
    </>
  );
}

export default memo(RolloffReferences);
