import { Listbox, NumberRow } from "../../ui";
import { useProjectsContext } from "../../../context/ProjectsContext";
import { useSimulationContext } from "../../../context/SimulationContext";

/** Tuning, port geometry and the optional second port group for a vented box. */
export default function PortedFields() {
  const { activeProject, updateActiveProject } = useProjectsContext();
  const { calculatedPortLength, portLengthClamped, handleAutoCalculatePort } =
    useSimulationContext();

  return (
    <>
      <NumberRow
        label="Tuning Freq (Fb)"
        unit="Hz"
        value={activeProject.tuningFreq}
        onChange={(v) => updateActiveProject({ tuningFreq: v })}
      />
      <div>
        <label className="text-xs opacity-70 block mb-1">Port Shape</label>
        <Listbox
          value={activeProject.portShape}
          onChange={(val) => updateActiveProject({ portShape: val as "circular" | "rectangular" })}
          buttonClassName="w-full border rounded px-2.5 py-1.5 text-xs focus:outline-none flex items-center justify-between gap-2 cursor-pointer text-left"
          options={[
            { value: "circular", label: "Circular / Cylinder" },
            { value: "rectangular", label: "Rectangular / Slot" },
          ]}
        />
      </div>

      <NumberRow
        label="Port Count"
        min={1}
        max={8}
        value={activeProject.portCount}
        onChange={(v) => updateActiveProject({ portCount: Math.round(v) })}
      />

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

      {activeProject.portShape === "circular" ? (
        <NumberRow
          label="Port Diameter"
          unit="cm"
          step={0.1}
          value={activeProject.portDiameter}
          onChange={(v) => updateActiveProject({ portDiameter: v })}
        />
      ) : (
        <div className="flex flex-col gap-1.5">
          <NumberRow
            label="Slot Width (cm)"
            step={0.5}
            value={activeProject.portWidth}
            onChange={(v) => updateActiveProject({ portWidth: v })}
          />
          <NumberRow
            label="Slot Height (cm)"
            step={0.5}
            value={activeProject.portHeight}
            onChange={(v) => updateActiveProject({ portHeight: v })}
          />
        </div>
      )}

      {/* Port Length HUD & Calculator */}
      <div className="flex flex-col gap-2.5 mt-1 border-t pt-3" style={{ borderColor: "var(--border-color)" }}>
        <div className="border border-dashed rounded p-2.5 flex flex-col gap-1 text-2xs" style={{ borderColor: "var(--border-color)" }}>
          <div className="flex justify-between font-semibold">
            <span className="opacity-75">Required Length:</span>
            <span style={{ color: "var(--accent-color)" }}>{calculatedPortLength.toFixed(1)} cm</span>
          </div>
          <div className="opacity-65 text-2xs">
            Length represents the tube/slot length for *each* port to achieve Fb = {activeProject.tuningFreq}Hz.
          </div>
          {portLengthClamped && (
            <div className="text-2xs leading-snug" style={{ color: "var(--danger-color)" }}>
              ⚠ This vent is too small to reach {activeProject.tuningFreq} Hz in {activeProject.vBox} L —
              even with no duct at all, its end correction alone tunes lower than Fb. The simulation uses
              the minimum length, so the real tuning is below the figure above. Use a larger port, add
              ports, or use a smaller box.
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={handleAutoCalculatePort}
          className="w-full py-2 rounded text-xs font-semibold tracking-wide transition text-white hover:shadow-md cursor-pointer hover:brightness-110"
          style={{ backgroundColor: "var(--accent-color)" }}
        >
          Auto-Calculate Venting
        </button>
      </div>

      {/* Second port group */}
      <div className="border rounded p-2.5 flex flex-col gap-2 text-xs" style={{ backgroundColor: "var(--bg-color)", borderColor: "var(--border-color)" }}>
        <div className="flex justify-between items-center">
          <span className="font-semibold opacity-80">Second Port Group</span>
          <label className="flex items-center gap-1.5 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={activeProject.port2Enabled}
              onChange={(e) => updateActiveProject({ port2Enabled: e.target.checked })}
              className="w-3.5 h-3.5"
            />
            <span className="opacity-70">{activeProject.port2Enabled ? "Enabled" : "Disabled"}</span>
          </label>
        </div>
        {activeProject.port2Enabled && (
          <div className="flex flex-col gap-2">
            <div className="flex justify-between items-center">
              <span className="opacity-70">Port Shape</span>
              <Listbox
                value={activeProject.port2Shape}
                onChange={(val) => updateActiveProject({ port2Shape: val as "circular" | "rectangular" })}
                buttonClassName="border rounded px-1.5 py-0.5 text-xs focus:outline-none flex items-center gap-1.5 cursor-pointer"
                options={[
                  { value: "circular", label: "Circular" },
                  { value: "rectangular", label: "Rectangular / Slot" },
                ]}
              />
            </div>
            <NumberRow
              label="Count"
              min={1}
              max={8}
              value={activeProject.port2Count}
              onChange={(v) => updateActiveProject({ port2Count: Math.round(v) })}
            />
            {activeProject.port2Shape === "circular" ? (
              <NumberRow
                label="Diameter"
                unit="cm"
                step={0.1}
                value={activeProject.port2Diameter}
                onChange={(v) => updateActiveProject({ port2Diameter: v })}
              />
            ) : (
              <div className="flex flex-col gap-1.5">
                <NumberRow
                  label="Width (cm)"
                  step={0.5}
                  value={activeProject.port2Width}
                  onChange={(v) => updateActiveProject({ port2Width: v })}
                />
                <NumberRow
                  label="Height (cm)"
                  step={0.5}
                  value={activeProject.port2Height}
                  onChange={(v) => updateActiveProject({ port2Height: v })}
                />
              </div>
            )}
            <div className="opacity-60 text-2xs">
              Both port groups share the same computed length ({calculatedPortLength.toFixed(1)} cm) from combined total area.
            </div>
          </div>
        )}
      </div>
    </>
  );
}
