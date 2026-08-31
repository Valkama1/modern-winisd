import { NumberRow } from "../../ui";
import { useProjectsContext } from "../../../context/ProjectsContext";

/**
 * Passive radiator parameters. The PR's own Fs is what tunes the box, not tuningFreq.
 *
 * Xmax matters here as much as it does for the driver: a radiator normally runs out of
 * travel before the cone does, since it carries the port's work with no motor of its
 * own to control it.
 */
export default function PassiveRadiatorFields() {
  const { activeProject, updateActiveProject } = useProjectsContext();

  return (
    <div className="flex flex-col gap-2.5 border rounded p-2.5 text-xs" style={{ backgroundColor: "var(--bg-color)", borderColor: "var(--border-color)" }}>
      <span className="font-semibold text-xs opacity-80 block mb-1">Passive Radiator Parameters</span>
      <NumberRow
        label="PR Moving Mass (Mms)"
        unit="g"
        value={activeProject.prMms}
        onChange={(v) => updateActiveProject({ prMms: v })}
      />
      <NumberRow
        label="PR Piston Area (Sd)"
        unit="cm²"
        value={activeProject.prSd}
        onChange={(v) => updateActiveProject({ prSd: v })}
      />
      <NumberRow
        label="PR Resonance (Fs)"
        unit="Hz"
        value={activeProject.prFs}
        onChange={(v) => updateActiveProject({ prFs: v })}
      />
      <NumberRow
        label="PR Travel Limit (Xmax)"
        unit="mm"
        value={activeProject.prXmax}
        onChange={(v) => updateActiveProject({ prXmax: v })}
      />
      <NumberRow
        label="PR Mechanical Q (Qms)"
        step={0.5}
        value={activeProject.prQms}
        onChange={(v) => updateActiveProject({ prQms: v })}
      />
    </div>
  );
}
