import { Badge, Listbox, NumberRow } from "../ui";
import { Project } from "../../types";
import { useProjectsContext } from "../../context/ProjectsContext";
import { useDriverDatabaseContext } from "../../context/DriverDatabaseContext";
import { checkDriverConsistency } from "../../hooks/useDriverForm";
import { PRESET_LINE_COLORS } from "../../hooks/useProjects";

export default function DriverTab() {
  const { activeProject, updateActiveProject } = useProjectsContext();
  const { openDriverBrowser } = useDriverDatabaseContext();

  return (
    <div className="flex flex-col gap-5">
      {/* Active Driver specs */}
      <div>
        <div className="flex justify-between items-center mb-2">
          <label className="text-xs font-semibold opacity-70 uppercase tracking-wider block">
            Active Driver
          </label>
          <Badge tone="accent">{activeProject.driver.sens} dB @ 1W</Badge>
        </div>
        <div className="border rounded p-3 mb-3" style={{ backgroundColor: "var(--bg-color)", borderColor: "var(--border-color)" }}>
          <div className="flex justify-between items-start gap-2 mb-2">
            <div className="min-w-0">
              <h3 className="text-sm font-bold truncate">{activeProject.driver.manufacturer}</h3>
              <p className="text-xs opacity-75 truncate">{activeProject.driver.model}</p>
            </div>
            <button
              type="button"
              onClick={() => openDriverBrowser((d) => updateActiveProject({ driver: d, vBox: d.vas / 2 }))}
              className="px-2 py-1 text-white rounded text-2xs font-semibold tracking-wide transition shrink-0 cursor-pointer hover:brightness-110"
              style={{ backgroundColor: "var(--accent-color)" }}
            >
              Change
            </button>
          </div>

          <div className="grid grid-cols-3 gap-y-3 gap-x-1.5 text-center mt-2.5 border-t pt-2.5" style={{ borderColor: "var(--border-color)" }}>
            <div>
              <div className="text-2xs opacity-60 font-mono">Fs</div>
              <div className="text-xs font-semibold">{activeProject.driver.fs} Hz</div>
            </div>
            <div>
              <div className="text-2xs opacity-60 font-mono">Qts</div>
              <div className="text-xs font-semibold">{activeProject.driver.qts}</div>
            </div>
            <div>
              <div className="text-2xs opacity-60 font-mono">Vas</div>
              <div className="text-xs font-semibold">{activeProject.driver.vas} L</div>
            </div>
            <div>
              <div className="text-2xs opacity-60 font-mono">Mms</div>
              <div className="text-xs font-semibold">{activeProject.driver.mms} g</div>
            </div>
            <div>
              <div className="text-2xs opacity-60 font-mono">Sd</div>
              <div className="text-xs font-semibold">{activeProject.driver.sd} cm²</div>
            </div>
            <div>
              <div className="text-2xs opacity-60 font-mono">Cms</div>
              <div className="text-xs font-semibold">
                {activeProject.driver.fs && activeProject.driver.mms
                  ? (1e6 / (Math.pow(2 * Math.PI * activeProject.driver.fs, 2) * activeProject.driver.mms)).toFixed(2)
                  : "—"}{" "}
                mm/N
              </div>
            </div>
          </div>

          {(() => {
            const check = checkDriverConsistency(activeProject.driver);
            if (check && check.isInconsistent) {
              return (
                <div
                  className="mt-2.5 p-2 rounded border text-2xs leading-snug"
                  style={{ backgroundColor: "var(--bg-color)", borderColor: "var(--warning-color)", color: "var(--warning-color)" }}
                >
                  ⚠ <strong>Inconsistent Specs:</strong> Entered Vas ({activeProject.driver.vas}L) differs from calculated Vas ({check.derivedVas.toFixed(1)}L) based on Sd ({activeProject.driver.sd} cm²) and Cms. This usually indicates a manufacturer copy-paste typo (e.g. mismatching Sd or Vas).
                </div>
              );
            }
            return null;
          })()}
        </div>

        {/* Driver Count selector */}
        <div className="border rounded p-2.5 mb-3" style={{ backgroundColor: "var(--bg-color)", borderColor: "var(--border-color)" }}>
          <NumberRow
            label="Number of Drivers"
            className="font-semibold"
            min={1}
            max={16}
            value={activeProject.numDrivers}
            onChange={(v) => updateActiveProject({ numDrivers: Math.round(v) })}
          />
        </div>

        {/* Isobaric / push-pull configuration */}
        <div
          className="flex flex-col gap-1.5 text-xs border rounded p-2.5 mb-3"
          style={{ backgroundColor: "var(--bg-color)", borderColor: "var(--border-color)" }}
        >
          <div className="flex justify-between items-center">
            <span className="opacity-75 font-semibold">Driver Config</span>
            <Listbox
              value={activeProject.driverConfig}
              onChange={(val) => updateActiveProject({ driverConfig: val as Project["driverConfig"] })}
              buttonClassName="border rounded px-1.5 py-0.5 text-xs focus:outline-none flex items-center gap-1.5 cursor-pointer"
              options={[
                { value: "standard", label: "Standard" },
                { value: "isobaric_series", label: "Isobaric (series, 8Ω×2)" },
                { value: "isobaric_parallel", label: "Isobaric (parallel, 2Ω×2)" },
              ]}
            />
          </div>
          {activeProject.driverConfig !== "standard" && (
            <div className="opacity-60 text-2xs leading-snug">
              2 drivers per unit — effective Vas = {(activeProject.driver.vas / 2).toFixed(1)} L, Fs unchanged.
              {activeProject.driverConfig === "isobaric_series" ? " Each unit draws 2×Re load." : " Each unit draws Re/2 load."}
            </div>
          )}
        </div>

        {/* Curve Color picker */}
        <div className="flex flex-col gap-2.5 border rounded p-3" style={{ backgroundColor: "var(--bg-color)", borderColor: "var(--border-color)" }}>
          <span className="font-semibold text-xs opacity-75 uppercase tracking-wider block">Project Curve Color</span>
          <div className="flex gap-1.5 flex-wrap">
            {PRESET_LINE_COLORS.map(c => (
              <button
                key={c}
                type="button"
                onClick={() => updateActiveProject({ color: c })}
                className={`w-5 h-5 rounded-full border transition cursor-pointer ${activeProject.color === c ? "border-white scale-110" : "border-transparent opacity-60 hover:opacity-100"}`}
                style={{ backgroundColor: c }}
              />
            ))}
          </div>
          <div className="flex items-center gap-1.5 mt-1 text-xs">
            <span className="opacity-60 shrink-0">Hex code:</span>
            <input
              type="text"
              value={activeProject.color}
              onChange={e => updateActiveProject({ color: e.target.value })}
              className="w-20 border rounded px-1.5 py-0.5 font-mono focus:outline-none text-2xs"
              style={{ backgroundColor: "var(--sidebar-color)", borderColor: "var(--border-color)", color: "var(--text-color)" }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
