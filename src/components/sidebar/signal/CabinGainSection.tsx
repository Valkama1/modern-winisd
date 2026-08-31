import { CollapsibleSection, NumberRow } from "../../ui";
import { useSignalProcessingContext } from "../../../context/SignalProcessingContext";
import { useModalsContext } from "../../../context/ModalsContext";

/**
 * Pressure-zone gain from a vehicle cabin, rising below its corner frequency.
 */
export default function CabinGainSection() {
  const { cabinConfig, setCabinConfig } = useSignalProcessingContext();
  const { sidebarSectionState, toggleSidebarSection } = useModalsContext();

  return (
    <CollapsibleSection
      title="Cabin Gain"
      open={sidebarSectionState["cabin-gain"]}
      onToggle={() => toggleSidebarSection("cabin-gain")}
      action={
        <button
          type="button"
          onClick={() => setCabinConfig(prev => ({ ...prev, enabled: !prev.enabled }))}
          className={`text-2xs font-bold px-2.5 py-0.5 rounded border transition cursor-pointer ${cabinConfig.enabled ? "border-[var(--accent-color)] text-[var(--accent-color)]" : "opacity-55 border-current"}`}
          style={{ backgroundColor: "var(--bg-color)" }}
        >
          {cabinConfig.enabled ? "ON" : "OFF"}
        </button>
      }
    >
      {!cabinConfig.enabled && (
        <p className="text-2xs opacity-45 text-center py-1.5">Enable to estimate vehicle pressure-zone cabin gain (12 dB/octave bass boost below F_cabin).</p>
      )}

      {cabinConfig.enabled && (
        <div className="flex flex-col gap-2 text-2xs">
          <NumberRow
            label="Cabin Corner Freq (Hz)"
            min={20}
            max={150}
            value={cabinConfig.fCabin}
            onChange={(v) => setCabinConfig(prev => ({ ...prev, fCabin: Math.round(v) }))}
          />
          <p className="text-2xs opacity-55 mt-1">
            Typical turn-over: Compact Cars: 70-80 Hz, Midsize: 60-70 Hz, Large SUVs: 40-50 Hz.
          </p>
        </div>
      )}
    </CollapsibleSection>
  );
}
