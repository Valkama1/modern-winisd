import { GraphGeometry } from "./graphGeometry";
import { useProjectsContext } from "../../../context/ProjectsContext";
import { useSimulationContext } from "../../../context/SimulationContext";

/**
 * One response path per visible project, plus the filter and environment overlays.
 */
export default function GraphCurves({ geo }: { geo: GraphGeometry }) {
  const { projects, activeProjectId } = useProjectsContext();
  const {
    simulationResults, phaseGdData,
    filterGainFn, roomCorrectionFn, filterLinearFn, cabinGainFn,
  } = useSimulationContext();
  const { getX, getY, mode } = geo;

  return (
    <>
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

    </>
  );
}
