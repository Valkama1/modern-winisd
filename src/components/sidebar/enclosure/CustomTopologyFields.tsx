import { CollapsibleSection, NumberRow } from "../../ui";
import CustomTopologyDiagram from "../../CustomTopologyDiagram";
import { CustomSideSpec, CustomPortSpec, CustomPRSpec } from "../../../types";
import { useProjectsContext } from "../../../context/ProjectsContext";
import { useModalsContext } from "../../../context/ModalsContext";

const DEFAULT_PORT: CustomPortSpec = { diameter_cm: 10, tuning_freq: 35 };
const DEFAULT_PR: CustomPRSpec = { mms_g: 300, sd_cm2: 1680, fs: 25, qms: 5 };

/** Node-and-element builder for enclosures the standard topologies do not cover. */
export default function CustomTopologyFields() {
  const { activeProject, updateActiveProject } = useProjectsContext();
  const { sidebarSectionState, toggleSidebarSection } = useModalsContext();

  const updateCustomRear = (patch: Partial<CustomSideSpec>) => {
    updateActiveProject({
      customTopology: {
        ...activeProject.customTopology,
        rear: { ...activeProject.customTopology.rear, ...patch }
      }
    });
  };

  const updateCustomFront = (patch: Partial<CustomSideSpec>) => {
    updateActiveProject({
      customTopology: {
        ...activeProject.customTopology,
        front: { ...activeProject.customTopology.front, ...patch }
      }
    });
  };

  const updateCustomRearPort = (patch: Partial<CustomPortSpec>) => {
    updateActiveProject({
      customTopology: {
        ...activeProject.customTopology,
        rear: {
          ...activeProject.customTopology.rear,
          port: { ...(activeProject.customTopology.rear.port ?? DEFAULT_PORT), ...patch }
        }
      }
    });
  };

  const updateCustomRearPR = (patch: Partial<CustomPRSpec>) => {
    updateActiveProject({
      customTopology: {
        ...activeProject.customTopology,
        rear: {
          ...activeProject.customTopology.rear,
          pr: { ...(activeProject.customTopology.rear.pr ?? DEFAULT_PR), ...patch }
        }
      }
    });
  };

  const updateCustomFrontPort = (patch: Partial<CustomPortSpec>) => {
    updateActiveProject({
      customTopology: {
        ...activeProject.customTopology,
        front: {
          ...activeProject.customTopology.front,
          port: { ...(activeProject.customTopology.front.port ?? DEFAULT_PORT), ...patch }
        }
      }
    });
  };

  const updateCustomFrontPR = (patch: Partial<CustomPRSpec>) => {
    updateActiveProject({
      customTopology: {
        ...activeProject.customTopology,
        front: {
          ...activeProject.customTopology.front,
          pr: { ...(activeProject.customTopology.front.pr ?? DEFAULT_PR), ...patch }
        }
      }
    });
  };

  const updateCustomInternalPort = (patch: Partial<CustomPortSpec>) => {
    updateActiveProject({
      customTopology: {
        ...activeProject.customTopology,
        internal_port: { ...(activeProject.customTopology.internal_port ?? DEFAULT_PORT), ...patch }
      }
    });
  };

  return (
    <div className="flex flex-col gap-3 text-xs">

      {/* Topology diagram */}
      <CustomTopologyDiagram topo={activeProject.customTopology} />

        {/* ── REAR SIDE ── */}
        <CollapsibleSection
          title="Rear Side (behind cone)"
          open={sidebarSectionState["custom-topology-rear"]}
          onToggle={() => toggleSidebarSection("custom-topology-rear")}
        >
          <div className="flex flex-col gap-2">
            {/* Rear chamber volume */}
            <NumberRow
              label="Chamber Volume"
              unit="L"
              value={activeProject.customTopology.rear.volume_liters}
              onChange={(v) => updateCustomRear({ volume_liters: v })}
            />

            {/* Rear port */}
            {activeProject.customTopology.rear.port ? (
              <div className="border rounded p-2 flex flex-col gap-1.5" style={{ borderColor: "var(--border-color)", backgroundColor: "var(--bg-color)" }}>
                <div className="flex justify-between items-center">
                  <span className="font-semibold opacity-75">Port → Outside</span>
                  <button onClick={() => updateCustomRear({ port: null })}
                    className="text-2xs opacity-50 hover:opacity-100 hover:text-red-400 transition cursor-pointer">✕ Remove</button>
                </div>
                <NumberRow
                  label="Tuning (Fb)"
                  unit="Hz"
                  value={activeProject.customTopology.rear.port.tuning_freq}
                  onChange={(v) => updateCustomRearPort({ tuning_freq: v })}
                />
                <NumberRow
                  label="Diameter"
                  unit="cm"
                  step={0.1}
                  value={activeProject.customTopology.rear.port.diameter_cm}
                  onChange={(v) => updateCustomRearPort({ diameter_cm: v })}
                />
              </div>
            ) : (
              <button onClick={() => updateCustomRear({ port: DEFAULT_PORT, pr: null })}
                className="text-left text-2xs opacity-60 hover:opacity-100 transition py-0.5 cursor-pointer hover:text-[var(--accent-color)]">
                + Add Port to Outside
              </button>
            )}

            {/* Rear PR */}
            {activeProject.customTopology.rear.pr ? (
              <div className="border rounded p-2 flex flex-col gap-1.5" style={{ borderColor: "var(--border-color)", backgroundColor: "var(--bg-color)" }}>
                <div className="flex justify-between items-center">
                  <span className="font-semibold opacity-75">Passive Radiator → Outside</span>
                  <button onClick={() => updateCustomRear({ pr: null })}
                    className="text-2xs opacity-50 hover:opacity-100 hover:text-red-400 transition cursor-pointer">✕ Remove</button>
                </div>
                {[
                  { label: "Moving Mass", key: "mms_g" as const, unit: "g" },
                  { label: "Piston Area (Sd)", key: "sd_cm2" as const, unit: "cm²" },
                  { label: "Resonance (Fs)", key: "fs" as const, unit: "Hz" },
                  { label: "Mech. Q (Qms)", key: "qms" as const, unit: "" },
                ].map(({ label, key, unit }) => (
                  <NumberRow
                    key={key}
                    label={label}
                    unit={unit || undefined}
                    step="any"
                    value={activeProject.customTopology.rear.pr![key]}
                    onChange={(v) => updateCustomRearPR({ [key]: v })}
                  />
                ))}
              </div>
            ) : (
              <button onClick={() => updateCustomRear({ pr: DEFAULT_PR, port: null })}
                className="text-left text-2xs opacity-60 hover:opacity-100 transition py-0.5 cursor-pointer hover:text-[var(--accent-color)]">
                + Add Passive Radiator to Outside
              </button>
            )}
          </div>
        </CollapsibleSection>

        {/* ── INTERNAL PORT ── */}
        <CollapsibleSection
          title="Cross-Connect (Rear ↔ Front)"
          open={sidebarSectionState["custom-topology-cross-connect"]}
          onToggle={() => toggleSidebarSection("custom-topology-cross-connect")}
        >
            {activeProject.customTopology.internal_port ? (
              <div className="border rounded p-2 flex flex-col gap-1.5" style={{ borderColor: "var(--border-color)", backgroundColor: "var(--bg-color)" }}>
                <div className="flex justify-between items-center">
                  <span className="font-semibold opacity-75">Internal Port</span>
                  <button onClick={() => updateActiveProject({ customTopology: { ...activeProject.customTopology, internal_port: null } })}
                    className="text-2xs opacity-50 hover:opacity-100 hover:text-red-400 transition cursor-pointer">✕ Remove</button>
                </div>
                <div className="opacity-55 text-2xs mb-0.5">Connects rear chamber to front chamber — creates series bandpass behaviour.</div>
                <NumberRow
                  label="Tuning (Fb)"
                  unit="Hz"
                  value={activeProject.customTopology.internal_port.tuning_freq}
                  onChange={(v) => updateCustomInternalPort({ tuning_freq: v })}
                />
                <NumberRow
                  label="Diameter"
                  unit="cm"
                  step={0.1}
                  value={activeProject.customTopology.internal_port.diameter_cm}
                  onChange={(v) => updateCustomInternalPort({ diameter_cm: v })}
                />
              </div>
            ) : (
              <button onClick={() => updateActiveProject({ customTopology: { ...activeProject.customTopology, internal_port: DEFAULT_PORT } })}
                className="text-left text-2xs opacity-60 hover:opacity-100 transition py-0.5 cursor-pointer hover:text-[var(--accent-color)]">
                + Add Internal Port (Rear → Front)
              </button>
            )}
        </CollapsibleSection>

        {/* ── FRONT SIDE ── */}
        <CollapsibleSection
          title="Front Side (in front of cone)"
          open={sidebarSectionState["custom-topology-front"]}
          onToggle={() => toggleSidebarSection("custom-topology-front")}
        >
          <div className="flex flex-col gap-2">
            {/* Front chamber toggle */}
            <div className="flex gap-2">
              <button
                onClick={() => updateCustomFront({ volume_liters: 0, port: null, pr: null })}
                className={`flex-1 py-1 rounded text-2xs font-semibold border transition cursor-pointer ${activeProject.customTopology.front.volume_liters === 0
                  ? "border-[var(--accent-color)] text-[var(--accent-color)]"
                  : "opacity-50 border-transparent hover:opacity-80"}`}
                style={{ backgroundColor: activeProject.customTopology.front.volume_liters === 0 ? "var(--bg-color)" : "transparent" }}>
                Open Air
              </button>
              <button
                onClick={() => updateCustomFront({ volume_liters: 40 })}
                className={`flex-1 py-1 rounded text-2xs font-semibold border transition cursor-pointer ${activeProject.customTopology.front.volume_liters > 0
                  ? "border-[var(--accent-color)] text-[var(--accent-color)]"
                  : "opacity-50 border-transparent hover:opacity-80"}`}
                style={{ backgroundColor: activeProject.customTopology.front.volume_liters > 0 ? "var(--bg-color)" : "transparent" }}>
                Sealed Chamber
              </button>
            </div>

            {activeProject.customTopology.front.volume_liters === 0 ? (
              <p className="text-2xs opacity-50">Cone fires directly into the room. Use for sealed or vented designs.</p>
            ) : (
              <>
                <NumberRow
                  label="Chamber Volume"
                  unit="L"
                  value={activeProject.customTopology.front.volume_liters}
                  onChange={(v) => updateCustomFront({ volume_liters: v })}
                />

                {/* Front port */}
                {activeProject.customTopology.front.port ? (
                  <div className="border rounded p-2 flex flex-col gap-1.5" style={{ borderColor: "var(--border-color)", backgroundColor: "var(--bg-color)" }}>
                    <div className="flex justify-between items-center">
                      <span className="font-semibold opacity-75">Port → Outside</span>
                      <button onClick={() => updateCustomFront({ port: null })}
                        className="text-2xs opacity-50 hover:opacity-100 hover:text-red-400 transition cursor-pointer">✕ Remove</button>
                    </div>
                    <NumberRow
                      label="Tuning (Fb)"
                      unit="Hz"
                      value={activeProject.customTopology.front.port.tuning_freq}
                      onChange={(v) => updateCustomFrontPort({ tuning_freq: v })}
                    />
                    <NumberRow
                      label="Diameter"
                      unit="cm"
                      step={0.1}
                      value={activeProject.customTopology.front.port.diameter_cm}
                      onChange={(v) => updateCustomFrontPort({ diameter_cm: v })}
                    />
                  </div>
                ) : (
                  <button onClick={() => updateCustomFront({ port: DEFAULT_PORT, pr: null })}
                    className="text-left text-2xs opacity-60 hover:opacity-100 transition py-0.5 cursor-pointer hover:text-[var(--accent-color)]">
                    + Add Port to Outside
                  </button>
                )}

                {/* Front PR */}
                {activeProject.customTopology.front.pr ? (
                  <div className="border rounded p-2 flex flex-col gap-1.5" style={{ borderColor: "var(--border-color)", backgroundColor: "var(--bg-color)" }}>
                    <div className="flex justify-between items-center">
                      <span className="font-semibold opacity-75">Passive Radiator → Outside</span>
                      <button onClick={() => updateCustomFront({ pr: null })}
                        className="text-2xs opacity-50 hover:opacity-100 hover:text-red-400 transition cursor-pointer">✕ Remove</button>
                    </div>
                    {[
                      { label: "Moving Mass", key: "mms_g" as const, unit: "g" },
                      { label: "Piston Area (Sd)", key: "sd_cm2" as const, unit: "cm²" },
                      { label: "Resonance (Fs)", key: "fs" as const, unit: "Hz" },
                      { label: "Mech. Q (Qms)", key: "qms" as const, unit: "" },
                    ].map(({ label, key, unit }) => (
                      <NumberRow
                        key={key}
                        label={label}
                        unit={unit || undefined}
                        step="any"
                        value={activeProject.customTopology.front.pr![key]}
                        onChange={(v) => updateCustomFrontPR({ [key]: v })}
                      />
                    ))}
                  </div>
                ) : (
                  <button onClick={() => updateCustomFront({ pr: DEFAULT_PR, port: null })}
                    className="text-left text-2xs opacity-60 hover:opacity-100 transition py-0.5 cursor-pointer hover:text-[var(--accent-color)]">
                    + Add Passive Radiator to Outside
                  </button>
                )}
              </>
            )}
          </div>
        </CollapsibleSection>

      </div>
  );
}
