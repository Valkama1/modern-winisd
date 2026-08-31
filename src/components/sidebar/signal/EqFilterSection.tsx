import { CollapsibleSection, Listbox, NumberField } from "../../ui";
import { EqFilter } from "../../../types";
import { useSignalProcessingContext } from "../../../context/SignalProcessingContext";
import { useModalsContext } from "../../../context/ModalsContext";

/**
 * Parametric EQ applied on top of the enclosure's own response.
 */
export default function EqFilterSection() {
  const { filters, setFilters } = useSignalProcessingContext();
  const { sidebarSectionState, toggleSidebarSection } = useModalsContext();

  return (
    <CollapsibleSection
      title="EQ Filters"
      open={sidebarSectionState["eq-filters"]}
      onToggle={() => toggleSidebarSection("eq-filters")}
      action={
        <button
          type="button"
          onClick={() => setFilters(prev => [...prev, { id: `f-${Date.now()}`, enabled: true, type: "hp", freq: 80, q: 0.707, gain: 0 }])}
          className="text-2xs px-2 py-0.5 rounded border transition hover:opacity-90 cursor-pointer"
          style={{ borderColor: "var(--accent-color)", color: "var(--accent-color)", backgroundColor: "var(--bg-color)" }}
        >
          + Add
        </button>
      }
    >
      {filters.length === 0 && (
        <p className="text-2xs opacity-45 text-center py-1.5">No filters — add HP/LP or peak EQ to shape the response.</p>
      )}

      <div className="flex flex-col gap-2">
        {filters.map((flt, idx) => (
          <div
            key={flt.id}
            className="border rounded p-2 flex flex-col gap-1.5"
            style={{ backgroundColor: "var(--bg-color)", borderColor: flt.enabled ? "var(--accent-color)" : "var(--border-color)" }}
          >
            <div className="flex items-center gap-1.5">
              <input
                type="checkbox" checked={flt.enabled}
                onChange={e => setFilters(prev => prev.map((f, i) => i === idx ? { ...f, enabled: e.target.checked } : f))}
                className="rounded accent-[var(--accent-color)] h-3 w-3 cursor-pointer shrink-0"
              />
              <Listbox
                value={flt.type}
                onChange={(val) => setFilters(prev => prev.map((f, i) => i === idx ? { ...f, type: val as EqFilter["type"] } : f))}
                className="flex-1"
                buttonClassName="w-full border rounded px-1 py-0.5 text-2xs focus:outline-none cursor-pointer flex items-center justify-between gap-1"
                options={[
                  { value: "hp", label: "HP (2nd order)" },
                  { value: "lp", label: "LP (2nd order)" },
                  { value: "peak", label: "Peak EQ" },
                  { value: "lowshelf", label: "Low Shelf" },
                  { value: "highshelf", label: "High Shelf" },
                ]}
              />
              <button
                type="button"
                onClick={() => setFilters(prev => prev.filter((_, i) => i !== idx))}
                className="text-2xs opacity-50 hover:opacity-100 hover:text-red-400 transition shrink-0 cursor-pointer px-0.5"
              >✕</button>
            </div>
            <div className="grid grid-cols-3 gap-1 text-2xs">
              <NumberField
                label="Freq (Hz)"
                min={5}
                max={20000}
                step={1}
                value={flt.freq}
                onChange={(v) => setFilters(prev => prev.map((f, i) => i === idx ? { ...f, freq: v } : f))}
              />
              <NumberField
                label="Q"
                min={0.1}
                max={20}
                step={0.05}
                value={flt.q}
                onChange={(v) => setFilters(prev => prev.map((f, i) => i === idx ? { ...f, q: v } : f))}
              />
              {(flt.type === "peak" || flt.type === "lowshelf" || flt.type === "highshelf") ? (
                <NumberField
                  label="Gain (dB)"
                  min={-30}
                  max={30}
                  step={0.5}
                  value={flt.gain}
                  onChange={(v) => setFilters(prev => prev.map((f, i) => i === idx ? { ...f, gain: v } : f))}
                />
              ) : <div />}
            </div>
          </div>
        ))}
      </div>

      {filters.some(f => f.enabled) && (
        <p className="text-2xs opacity-50 mt-1.5">— — dashed: filtered &nbsp;·· dotted: +room</p>
      )}
    </CollapsibleSection>
  );
}
