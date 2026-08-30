import { CollapsibleSection, Listbox, NumberRow } from "../ui";
import DimensionCalculator from "./DimensionCalculator";
import { EnclosureType } from "../../types";
import { useProjectsContext } from "../../context/ProjectsContext";
import { useModalsContext } from "../../context/ModalsContext";
import AutoAlignSection from "./enclosure/AutoAlignSection";
import EnclosureLosses from "./enclosure/EnclosureLosses";
import PortedFields from "./enclosure/PortedFields";
import Bandpass4Fields from "./enclosure/Bandpass4Fields";
import Bandpass6ParallelFields from "./enclosure/Bandpass6ParallelFields";
import Bandpass6SeriesFields from "./enclosure/Bandpass6SeriesFields";
import PassiveRadiatorFields from "./enclosure/PassiveRadiatorFields";
import CustomTopologyFields from "./enclosure/CustomTopologyFields";

const ENCLOSURE_OPTIONS: { value: EnclosureType; label: string }[] = [
  { value: "sealed", label: "Sealed (2nd Order Closed Box)" },
  { value: "ported", label: "Vented (4th Order Bass Reflex)" },
  { value: "bandpass4", label: "4th-Order Bandpass (BP4)" },
  { value: "bandpass6_parallel", label: "6th-Order Parallel Bandpass (BP6P)" },
  { value: "bandpass6_series", label: "6th-Order Series Bandpass (BP6S)" },
  { value: "passive_radiator", label: "Passive Radiator (4th Order PR)" },
  { value: "custom", label: "Custom Topology Builder" },
];

/** Enclosure types whose only volume control is the single shared Vb row. */
const SINGLE_CHAMBER: EnclosureType[] = ["sealed", "ported", "passive_radiator"];

/**
 * Enclosure tab: pick a type, then render that type's controls.
 *
 * Each type's fields live in their own component under ./enclosure and read the
 * project straight from context, so adding an enclosure type means adding a file and
 * one line here rather than editing a thousand-line conditional.
 */
export default function EnclosureTab() {
  const { activeProject, updateActiveProject } = useProjectsContext();
  const { sidebarSectionState, toggleSidebarSection } = useModalsContext();
  const { enclosureType } = activeProject;

  return (
    <>
      <div className="flex flex-col gap-4">
        <CollapsibleSection
          title="Enclosure Settings"
          open={sidebarSectionState["enclosure-settings"]}
          onToggle={() => toggleSidebarSection("enclosure-settings")}
        >
          <div>
            <label className="text-xs opacity-70 block mb-1">Enclosure Type</label>
            <Listbox
              value={enclosureType}
              onChange={(enclosureType) => updateActiveProject({ enclosureType })}
              buttonClassName="w-full border rounded px-2.5 py-1.5 text-xs focus:outline-none flex items-center justify-between gap-2 cursor-pointer text-left"
              options={ENCLOSURE_OPTIONS}
            />
          </div>

          <EnclosureLosses />

          {enclosureType !== "custom" && <AutoAlignSection />}

          {SINGLE_CHAMBER.includes(enclosureType) && (
              <NumberRow
                label="Box Volume (Vb)"
                unit="L"
                value={activeProject.vBox}
                onChange={(v) => updateActiveProject({ vBox: v })}
              />
            )}

          {enclosureType === "ported" && <PortedFields />}
          {enclosureType === "bandpass4" && <Bandpass4Fields />}
          {enclosureType === "bandpass6_parallel" && <Bandpass6ParallelFields />}
          {enclosureType === "bandpass6_series" && <Bandpass6SeriesFields />}
          {enclosureType === "passive_radiator" && <PassiveRadiatorFields />}
        </CollapsibleSection>

        {enclosureType === "custom" && <CustomTopologyFields />}
      </div>

      <DimensionCalculator />
    </>
  );
}
