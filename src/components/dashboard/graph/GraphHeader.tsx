import { GraphGeometry, RADIATION_DERIVED } from "./graphGeometry";
import { useProjectsContext } from "../../../context/ProjectsContext";
import { useGraphPointerContext } from "../../../context/GraphPointerContext";
import { useSimulationContext } from "../../../context/SimulationContext";

/**
 * Title, the radiation-model warning, and the multi-project readout at the cursor.
 */
export default function GraphHeader({ geo }: { geo: GraphGeometry }) {
  const { projects, activeProjectId } = useProjectsContext();
  const { rulerFreq, hoveredFreq } = useGraphPointerContext();
  const { simulationResults, phaseGdData, getDisplayValue, kaWarningFreq } =
    useSimulationContext();
  const { mode, fMax, title, unit } = geo;

  return (
    <>
      {/* Chart Header */}
      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-1 items-start w-full">
          <h3 className="text-sm font-bold tracking-wide">{title}</h3>
          {/* Radiation model accuracy warning — shown for gain/SPL graphs */}
          {RADIATION_DERIVED.includes(mode) && kaWarningFreq < fMax && (
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
    </>
  );
}
