import { CollapsibleSection, NumberField, NumberRow } from "../../ui";
import { SPEAKER_COLORS } from "./speakerColors";
import { useSignalProcessingContext } from "../../../context/SignalProcessingContext";
import { useModalsContext } from "../../../context/ModalsContext";
import RoomFloorPlan from "./RoomFloorPlan";

/**
 * In-room response from boundary reflections, with the speakers and listener placed
 * on a floor plan you can drag.
 */
export default function RoomSimulationSection() {
  const { roomConfig, setRoomConfig } = useSignalProcessingContext();
  const { sidebarSectionState, toggleSidebarSection } = useModalsContext();

  return (
    <CollapsibleSection
      title="Room Simulation"
      open={sidebarSectionState["room-simulation"]}
      onToggle={() => toggleSidebarSection("room-simulation")}
      action={
        <button
          type="button"
          onClick={() => setRoomConfig(prev => ({ ...prev, enabled: !prev.enabled }))}
          className={`text-2xs font-bold px-2.5 py-0.5 rounded border transition cursor-pointer ${roomConfig.enabled ? "border-[var(--accent-color)] text-[var(--accent-color)]" : "opacity-55 border-current"}`}
          style={{ backgroundColor: "var(--bg-color)" }}
        >
          {roomConfig.enabled ? "ON" : "OFF"}
        </button>
      }
    >
      {!roomConfig.enabled && (
        <p className="text-2xs opacity-45 text-center py-1.5">Enable to estimate in-room SPL via Image Source Method (2nd order, 25 sources).</p>
      )}

      {roomConfig.enabled && (
        <div className="flex flex-col gap-3">
          <div>
            <p className="text-2xs opacity-55 mb-1 font-semibold uppercase tracking-wider">Room Dimensions (m)</p>
            <div className="grid grid-cols-3 gap-1.5 text-2xs">
              {(
                [
                  ["length", "Length"],
                  ["width", "Width"],
                  ["height", "Height"],
                ] as const
              ).map(([key, label]) => (
                <NumberField
                  key={key}
                  label={label}
                  min={1}
                  max={50}
                  step={0.1}
                  value={roomConfig[key]}
                  onChange={(v) => setRoomConfig(prev => ({ ...prev, [key]: v }))}
                />
              ))}
            </div>
          </div>

          <RoomFloorPlan />

          {/* ── Precise X / Y / Z inputs ───────────────────────── */}
          <CollapsibleSection
            title="Precise X / Y / Z Inputs"
            open={sidebarSectionState["precise-xyz-inputs"]}
            onToggle={() => toggleSidebarSection("precise-xyz-inputs")}
          >
          <div className="flex flex-col gap-1.5 text-2xs">
            {roomConfig.speakers.map((spk, si) => {
              const col = SPEAKER_COLORS[si % SPEAKER_COLORS.length];
              const lbl = roomConfig.speakers.length === 1 ? "Speaker (S)" : `Speaker S${si + 1}`;
              return (
                <div key={si} className="border rounded p-1.5" style={{ borderColor: col + "55" }}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-semibold" style={{ color: col }}>{lbl}</span>
                    {roomConfig.speakers.length > 1 && (
                      <button type="button"
                        onClick={() => setRoomConfig(p => ({ ...p, speakers: p.speakers.filter((_, i) => i !== si) }))}
                        className="opacity-45 hover:opacity-100 hover:text-red-400 transition cursor-pointer px-0.5"
                      >✕</button>
                    )}
                  </div>
                  <div className="flex gap-1">
                    {(["x", "y", "z"] as const).map(axis => (
                      <NumberRow
                        key={axis}
                        label={axis.toUpperCase()}
                        unit="m"
                        min={0.05}
                        max={49}
                        step={0.05}
                        className="flex-1 min-w-0 gap-0.5"
                        boxClassName="w-full min-w-0"
                        value={spk[axis]}
                        onChange={(v) => setRoomConfig(p => ({ ...p, speakers: p.speakers.map((s, i) => i === si ? { ...s, [axis]: v } : s) }))}
                      />
                    ))}
                  </div>
                </div>
              );
            })}
            <div className="border rounded p-1.5" style={{ borderColor: "#60a5fa55" }}>
              <p className="font-semibold mb-1" style={{ color: "#60a5fa" }}>Listener (L)</p>
              <div className="flex gap-1">
                {(["listenerX", "listenerY", "listenerZ"] as const).map(key => (
                  <NumberRow
                    key={key}
                    label={key.slice(-1).toUpperCase()}
                    unit="m"
                    min={0.05}
                    max={49}
                    step={0.05}
                    className="flex-1 min-w-0 gap-0.5"
                    boxClassName="w-full min-w-0"
                    value={roomConfig[key]}
                    onChange={(v) => setRoomConfig(prev => ({ ...prev, [key]: v }))}
                  />
                ))}
              </div>
            </div>
          </div>
          </CollapsibleSection>

          <div>
            <div className="flex justify-between text-2xs mb-1">
              <span className="opacity-60">Wall Absorption (α)</span>
              <span className="font-mono" style={{ color: "var(--accent-color)" }}>
                {roomConfig.absorption.toFixed(2)}{" "}
                <span className="opacity-60">{roomConfig.absorption < 0.1 ? "bare/hard" : roomConfig.absorption < 0.25 ? "typical" : "treated"}</span>
              </span>
            </div>
            <input type="range" min="0.02" max="0.8" step="0.01" value={roomConfig.absorption}
              onChange={e => setRoomConfig(prev => ({ ...prev, absorption: parseFloat(e.target.value) }))}
              className="w-full h-1.5 rounded-lg appearance-none cursor-pointer"
              style={{ accentColor: "var(--accent-color)", backgroundColor: "var(--border-color)" }} />
          </div>

          <p className="text-2xs opacity-40">Dotted curves on SPL show estimated in-room response. Room gain and early reflections only — no late reverb.</p>
        </div>
      )}
    </CollapsibleSection>
  );
}
