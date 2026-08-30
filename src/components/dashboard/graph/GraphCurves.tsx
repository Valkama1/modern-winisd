import { memo, useMemo } from "react";
import { GraphGeometry } from "./graphGeometry";
import { useProjectsContext } from "../../../context/ProjectsContext";
import { useSimulationContext } from "../../../context/SimulationContext";

/**
 * One response path per visible project, plus the filter and environment overlays.
 */
function GraphCurves({ geo }: { geo: GraphGeometry }) {
  const { projects, activeProjectId } = useProjectsContext();
  const {
    simulationResults, phaseGdData,
    filterGainFn, roomCorrectionFn, filterLinearFn, cabinGainFn,
  } = useSimulationContext();
  const { getX, getY, mode } = geo;

  // Path strings are rebuilt only when the data or scales change. Building them during
  // render meant three 150-point map-and-join passes per project on every pointer move.
  const curves = useMemo(() => projects.filter(p => p.showOnGraph).map(project => {
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

        return {
          project, sw, op, showFilter, showEnv,
          base: buildPath(false, false),
          filtered: showFilter ? buildPath(true, false) : null,
          environment: showEnv ? buildPath(showFilter, true) : null,
        };
      }).filter(c => c !== null),
      [projects, activeProjectId, simulationResults, phaseGdData, mode, getX, getY,
       filterGainFn, roomCorrectionFn, filterLinearFn, cabinGainFn]);

  return (
    <>
      {/* Response Curve Paths for all visible projects */}
      {curves.map(({ project, sw, op, showFilter, showEnv, base, filtered, environment }) => (
          <g key={project.id} className="transition-all duration-150">
            {/* original solid curve */}
            <path d={base} fill="none" stroke={project.color}
              strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" opacity={op} />

            {/* filter-only dashed overlay (SPL + transfer + excursion + velocity) */}
            {showFilter && (
              <path d={filtered!} fill="none" stroke={project.color}
                strokeWidth={sw * 0.85} strokeLinecap="round" strokeLinejoin="round"
                strokeDasharray="8 4" opacity={op * 0.85} />
            )}

            {/* filter+environment dotted overlay (SPL only) */}
            {showEnv && (
              <path d={environment!} fill="none" stroke={project.color}
                strokeWidth={sw * 0.75} strokeLinecap="round" strokeLinejoin="round"
                strokeDasharray="2 4" opacity={op * 0.75} />
            )}
          </g>
      ))}
    </>
  );
}

// Only the header and ruler layers depend on pointer position, so with a memoised
// geometry object this layer stops re-rendering entirely while the pointer moves.
export default memo(GraphCurves);
