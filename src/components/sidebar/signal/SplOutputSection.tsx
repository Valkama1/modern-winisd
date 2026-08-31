import { CollapsibleSection, Listbox, NumberField, NumberRow } from "../../ui";
import { useProjectsContext } from "../../../context/ProjectsContext";
import { useModalsContext } from "../../../context/ModalsContext";

/**
 * Drive level and measuring distance: what the absolute SPL figures are quoted at.
 */
export default function SplOutputSection() {
  const { activeProject, updateActiveProject } = useProjectsContext();
  const { sidebarSectionState, toggleSidebarSection } = useModalsContext();

  return (
    <CollapsibleSection
      title="SPL & Output Simulation"
      open={sidebarSectionState["spl-settings"]}
      onToggle={() => toggleSidebarSection("spl-settings")}
    >
    <NumberRow
      label="Total Input Power"
      unit="W"
      value={activeProject.inputPower}
      onChange={(v) => updateActiveProject({ inputPower: v })}
    />

    <NumberField
      label="Distance (m)"
      step={0.1}
      min={0.1}
      accent={false}
      value={activeProject.distance}
      onChange={(v) => updateActiveProject({ distance: v })}
    />

    <div>
      <label className="text-xs opacity-70 block mb-1">SPL Environment</label>
      <Listbox
        value={activeProject.splEnvironment}
        onChange={(val) => updateActiveProject({ splEnvironment: val as typeof activeProject.splEnvironment })}
        buttonClassName="w-full border rounded px-2.5 py-1.5 text-xs focus:outline-none flex items-center justify-between gap-2 cursor-pointer text-left"
        options={[
          { value: "half_space", label: "Half-space — wall / floor mount" },
          { value: "free_field", label: "Free-field — anechoic / elevated (−6 dB)" },
          { value: "corner", label: "Corner placement — 3 boundaries (+12 dB)" },
        ]}
      />
      <p className="text-2xs opacity-50 mt-1">Affects SPL curve only. Gain and excursion are unaffected.</p>
    </div>
    </CollapsibleSection>
  );
}
