import { CollapsibleSection, Listbox, NumberField } from "../../ui";
import { useProjectsContext } from "../../../context/ProjectsContext";
import { useModalsContext } from "../../../context/ModalsContext";

/**
 * A passive network in front of the driver, working against its real complex load
 * rather than a nominal resistance.
 */
export default function PassiveCrossoverSection() {
  const { activeProject, updateActiveProject } = useProjectsContext();
  const { sidebarSectionState, toggleSidebarSection } = useModalsContext();

  return (
    <CollapsibleSection
      title="Passive Crossover"
      open={sidebarSectionState["passive-crossover"]}
      onToggle={() => toggleSidebarSection("passive-crossover")}
      action={
        <button
          type="button"
          onClick={() => updateActiveProject({ passiveXoEnabled: !activeProject.passiveXoEnabled })}
          className={`text-2xs font-bold px-2.5 py-0.5 rounded border transition cursor-pointer ${activeProject.passiveXoEnabled ? "border-[var(--accent-color)] text-[var(--accent-color)]" : "opacity-55 border-current"}`}
          style={{ backgroundColor: "var(--bg-color)" }}
        >
          {activeProject.passiveXoEnabled ? "ON" : "OFF"}
        </button>
      }
    >
      {!activeProject.passiveXoEnabled && (
        <p className="text-2xs opacity-45 text-center py-1.5">Enable to simulate passive crossover network interaction with driver impedance.</p>
      )}

      {activeProject.passiveXoEnabled && (
        <div className="flex flex-col gap-2.5 text-2xs">
          {/* Validation Warning if Le is missing or 0 */}
          {activeProject.driver.le <= 0 && (
            <div className="p-2 rounded border text-2xs" style={{ backgroundColor: "var(--bg-color)", borderColor: "var(--warning-color)", color: "var(--warning-color)" }}>
              ⚠ Driver inductance Le is 0. A typical ratio of {activeProject.driver.re > 0 ? (activeProject.driver.re * 0.15).toFixed(2) : "0.60"} mH will be estimated.
            </div>
          )}

          <div className="flex flex-col gap-1">
            <span className="opacity-55">Crossover Type</span>
            <Listbox
              value={activeProject.passiveXoType}
              onChange={(passiveXoType) => updateActiveProject({ passiveXoType })}
              buttonClassName="w-full border rounded px-2.5 py-1.5 text-xs focus:outline-none flex items-center justify-between gap-2 cursor-pointer text-left"
              options={[
                { value: "lowpass_1st", label: "1st-Order Lowpass (Inductor L)" },
                { value: "highpass_1st", label: "1st-Order Highpass (Capacitor C)" },
                { value: "lowpass_2nd", label: "2nd-Order Lowpass (L-C Network)" },
                { value: "highpass_2nd", label: "2nd-Order Highpass (C-L Network)" },
              ]}
            />
          </div>

          <div className="grid grid-cols-3 gap-2">
            {/* Inductance Input: shown for lowpass, or 2nd order highpass */}
            {(activeProject.passiveXoType.includes("lowpass") || activeProject.passiveXoType.includes("2nd")) && (
              <NumberField
                label="Inductance (mH)"
                min={0.01}
                max={50}
                step={0.05}
                value={activeProject.passiveXoInductance}
                onChange={(v) => updateActiveProject({ passiveXoInductance: v })}
              />
            )}

            {/* Capacitance Input: shown for highpass, or 2nd order lowpass */}
            {(activeProject.passiveXoType.includes("highpass") || activeProject.passiveXoType.includes("2nd")) && (
              <NumberField
                label="Capacitance (µF)"
                min={0.1}
                max={1000}
                step={1.0}
                value={activeProject.passiveXoCapacitance}
                onChange={(v) => updateActiveProject({ passiveXoCapacitance: v })}
              />
            )}

            {/* Inductor DCR Input: shown if inductance is shown */}
            {(activeProject.passiveXoType.includes("lowpass") || activeProject.passiveXoType.includes("2nd")) && (
              <NumberField
                label="Inductor DCR (Ω)"
                min={0.0}
                max={10}
                step={0.05}
                value={activeProject.passiveXoDcr}
                onChange={(v) => updateActiveProject({ passiveXoDcr: v })}
              />
            )}
          </div>
        </div>
      )}
    </CollapsibleSection>
  );
}
