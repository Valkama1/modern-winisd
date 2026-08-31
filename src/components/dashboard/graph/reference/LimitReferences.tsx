import { memo } from "react";
import { formatWatts, limitTransition, xmaxHeadroom } from "../../../../lib/driverLimits";
import { GraphGeometry, PADDING } from "../graphGeometry";
import { useProjectsContext } from "../../../../context/ProjectsContext";
import { useSimulationContext } from "../../../../context/SimulationContext";

const { left: paddingLeft, right: paddingRight, top: paddingTop, bottom: paddingBottom } =
  PADDING;

/**
 * The physical ceilings a design runs into: port air speed, cone and radiator travel,
 * and which of power or excursion is binding on the max-SPL curve.
 */
function LimitReferences({ geo }: { geo: GraphGeometry }) {
  const { activeProject, activeProjectId } = useProjectsContext();
  const { simulationResults } = useSimulationContext();
  const { getX, getY, width, height, fMin, fMax, dbMin: currentDbMin, dbMax: currentDbMax, mode } = geo;

  return (
    <>
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

    {/* EXCURSION: the radiator's own travel limit, when the box has one */}
    {mode === "excursion"
      && activeProject.enclosureType === "passive_radiator"
      && activeProject.prXmax > 0
      && activeProject.prXmax >= currentDbMin
      && activeProject.prXmax <= currentDbMax
      && (() => {
      const y = getY(activeProject.prXmax);
      const prPts = simulationResults[activeProjectId]?.["pr_excursion"] ?? [];
      const peak = prPts.length ? Math.max(...prPts.map((p) => p.db)) : 0;
      const over = peak >= activeProject.prXmax;
      return (
        <g>
          <line
            x1={paddingLeft} y1={y} x2={width - paddingRight} y2={y}
            stroke={over ? "var(--danger-color)" : "var(--text-color)"}
            strokeWidth="1.25" strokeDasharray="6 3" opacity={over ? 0.9 : 0.45}
          />
          <text
            x={width - paddingRight - 4} y={y - 4} textAnchor="end" fontSize="10"
            fill={over ? "var(--danger-color)" : "var(--text-color)"}
            opacity={over ? 1 : 0.6}
          >
            PR Xmax {activeProject.prXmax} mm{over ? `  — exceeded (${peak.toFixed(1)} mm)` : ""}
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

export default memo(LimitReferences);
