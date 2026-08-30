import { Listbox, NumberRow } from "../../ui";
import { useProjectsContext } from "../../../context/ProjectsContext";

/** Front and rear chamber sizing for a 4th-order bandpass (sealed rear, ported front). */
export default function Bandpass4Fields() {
  const { activeProject, updateActiveProject } = useProjectsContext();

  return (
    <div className="flex flex-col gap-3 text-xs">
      <div>
        <label className="text-xs opacity-70 block mb-1">Port Losses (Q factor)</label>
        <Listbox
          value={String(activeProject.portQ)}
          onChange={(val) => updateActiveProject({ portQ: parseFloat(val) })}
          buttonClassName="w-full border rounded px-2.5 py-1.5 text-xs focus:outline-none flex items-center justify-between gap-2 cursor-pointer text-left"
          options={[
            { value: "50", label: "Circular port (Q = 50)" },
            { value: "30", label: "Slot port (Q = 30)" },
            { value: "100", label: "Low-loss / rigid port (Q = 100)" },
          ]}
        />
      </div>
      <div className="border rounded p-2.5" style={{ backgroundColor: "var(--bg-color)", borderColor: "var(--border-color)" }}>
        <span className="font-semibold text-xs opacity-80 block mb-2">Rear Chamber (Sealed)</span>
        <NumberRow
          label="Volume (Vr)"
          unit="L"
          className="mb-1"
          value={activeProject.vRear}
          onChange={(v) => updateActiveProject({ vRear: v })}
        />
      </div>

      <div className="border rounded p-2.5" style={{ backgroundColor: "var(--bg-color)", borderColor: "var(--border-color)" }}>
        <span className="font-semibold text-xs opacity-80 block mb-2">Front Chamber (Ported)</span>
        <NumberRow
          label="Volume (Vf)"
          unit="L"
          className="mb-2"
          value={activeProject.vFront}
          onChange={(v) => updateActiveProject({ vFront: v })}
        />
        <NumberRow
          label="Tuning (Fb)"
          unit="Hz"
          className="mb-2"
          value={activeProject.frontTuningFreq}
          onChange={(v) => updateActiveProject({ frontTuningFreq: v })}
        />
        <NumberRow
          label="Port Diameter"
          unit="cm"
          step={0.1}
          value={activeProject.frontPortDiameter}
          onChange={(v) => updateActiveProject({ frontPortDiameter: v })}
        />
      </div>
    </div>
  );
}
