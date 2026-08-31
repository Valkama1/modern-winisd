import { GraphGeometry, PADDING } from "./graphGeometry";
import { useProjectsContext } from "../../../context/ProjectsContext";
import { useHoveredFreq, useRulerFreq } from "../../../context/GraphPointerContext";
import { useSimulationContext } from "../../../context/SimulationContext";

const { top: paddingTop, bottom: paddingBottom } = PADDING;

/**
 * Hover markers and the draggable measurement ruler with its per-curve callouts.
 */
export default function GraphRulerLayer({ geo, setIsDraggingRuler }: {
  geo: GraphGeometry;
  setIsDraggingRuler: (v: boolean) => void;
}) {
  const { projects, activeProjectId } = useProjectsContext();
  const rulerFreq = useRulerFreq();
  const hoveredFreq = useHoveredFreq();
  const { simulationResults, phaseGdData, getDisplayValue } = useSimulationContext();
  const { getX, getY, height, fMin, fMax, mode } = geo;

  return (
    <>
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
    </>
  );
}
