import { useState } from "react";
import { Badge, CollapsibleSection, Listbox, NumberRow } from "../../ui";
import { AlignmentRecommendation, AlignmentTarget } from "../../../types";
import { useProjectsContext } from "../../../context/ProjectsContext";
import { useSimulationContext } from "../../../context/SimulationContext";
import { useModalsContext } from "../../../context/ModalsContext";

function CheckRow({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  return (
  <label className="flex items-center gap-1.5 cursor-pointer select-none text-2xs">
    <input
      type="checkbox"
      checked={checked}
      onChange={(e) => onChange(e.target.checked)}
      className="w-3.5 h-3.5"
    />
    <span className="opacity-70">{label}</span>
  </label>
);
}

/**
 * Solver-backed enclosure alignment: pick a target, optionally constrain the result,
 * and read back what was achieved. Offered for every enclosure type except custom.
 */
export default function AutoAlignSection() {
const { activeProject } = useProjectsContext();
const { handleApplyAlignment } = useSimulationContext();
const { sidebarSectionState, toggleSidebarSection } = useModalsContext();

const [alignmentPref, setAlignmentPref] = useState<AlignmentTarget>("maximally_flat");
const [respectXmax, setRespectXmax] = useState(true);
const [buildablePort, setBuildablePort] = useState(true);
const [limitVolume, setLimitVolume] = useState(false);
const [maxVolume, setMaxVolume] = useState(120);
const [limitF3, setLimitF3] = useState(false);
const [targetF3, setTargetF3] = useState(30);
const [targetPassband, setTargetPassband] = useState(false);
const [passbandLow, setPassbandLow] = useState(25);
const [passbandHigh, setPassbandHigh] = useState(80);
const [alignResult, setAlignResult] = useState<AlignmentRecommendation | null>(null);
const [aligning, setAligning] = useState(false);

// A bandpass is specified by its passband rather than by a corner frequency and a
// rolloff shape, so it gets its own preset names and its own target fields.
const isBandpass = activeProject.enclosureType.startsWith("bandpass");

const applyAlignment = async () => {
  setAligning(true);
  try {
    setAlignResult(
      await handleApplyAlignment(
        alignmentPref,
        {
          respectXmax,
          buildablePort,
          maxVolume: limitVolume ? maxVolume : null,
          targetF3: !isBandpass && limitF3 ? targetF3 : null,
        },
        isBandpass && targetPassband ? { low: passbandLow, high: passbandHigh } : null,
      ),
    );
  } finally {
    setAligning(false);
  }
};

return (
    <CollapsibleSection
      title="Auto-Align Enclosure"
      open={sidebarSectionState["auto-align"]}
      onToggle={() => toggleSidebarSection("auto-align")}
      action={
        activeProject.driver.fs && activeProject.driver.qes ? (
          <Badge tone="accent">EBP: {Math.round(activeProject.driver.fs / activeProject.driver.qes)}</Badge>
        ) : undefined
      }
    >
      {activeProject.driver.fs && activeProject.driver.qes && (() => {
        const ebp = activeProject.driver.fs / activeProject.driver.qes;
        const guidance =
          ebp > 80 ? "Ported enclosure preferred (strong motor)."
          : ebp < 50 ? "Sealed enclosure preferred (acoustic suspension)."
          : "Highly versatile — works well in Sealed or Ported.";
        return (
          <p className="text-2xs opacity-60 leading-snug">
            ℹ {guidance}
          </p>
        );
      })()}

      <div className="flex flex-col gap-1">
        <span className="opacity-55 text-2xs">Alignment Target</span>
        <Listbox
          value={alignmentPref}
          onChange={setAlignmentPref}
          buttonClassName="w-full border rounded px-2.5 py-1 text-xs focus:outline-none flex items-center justify-between gap-2 cursor-pointer text-left"
          options={
            isBandpass
              ? [
                  { value: "maximally_flat", label: "Maximum Flatness" },
                  { value: "extended_bass", label: "Balanced (wide band)" },
                  { value: "boomy", label: "Maximum Output (narrow band)" },
                ]
              : [
                  { value: "maximally_flat", label: "Maximally Flat (Butterworth)" },
                  { value: "extended_bass", label: "Extended Bass Shelf" },
                  { value: "boomy", label: "High-Output / Boomy (Bass Boost)" },
                ]
          }
        />
      </div>

      <div className="flex flex-col gap-1 mt-0.5">
        <CheckRow
          checked={respectXmax}
          onChange={setRespectXmax}
          label="Respect Xmax at rated power"
        />
        {activeProject.enclosureType !== "sealed" && (
          <CheckRow
            checked={buildablePort}
            onChange={setBuildablePort}
            label="Require buildable port (≤ 17 m/s)"
          />
        )}
        <CheckRow checked={limitVolume} onChange={setLimitVolume} label="Limit box volume" />
        {limitVolume && (
          <NumberRow
            label="Max volume"
            unit="L"
            step={1}
            value={maxVolume}
            onChange={setMaxVolume}
          />
        )}
        {isBandpass ? (
          <>
            <CheckRow
              checked={targetPassband}
              onChange={setTargetPassband}
              label="Target passband"
            />
            {targetPassband && (
              <>
                <NumberRow
                  label="Low corner"
                  unit="Hz"
                  step={1}
                  value={passbandLow}
                  onChange={setPassbandLow}
                />
                <NumberRow
                  label="High corner"
                  unit="Hz"
                  step={1}
                  value={passbandHigh}
                  onChange={setPassbandHigh}
                />
              </>
            )}
          </>
        ) : (
          <>
            <CheckRow checked={limitF3} onChange={setLimitF3} label="Target F3" />
            {limitF3 && (
              <NumberRow
                label="Target F3"
                unit="Hz"
                step={1}
                value={targetF3}
                onChange={setTargetF3}
              />
            )}
          </>
        )}
      </div>

      <button
        type="button"
        onClick={applyAlignment}
        disabled={aligning}
        className="w-full py-1.5 hover:brightness-110 active:brightness-95 rounded text-xs font-semibold tracking-wide transition text-white hover:shadow-md cursor-pointer mt-1 disabled:opacity-60 disabled:cursor-wait"
        style={{ backgroundColor: "var(--accent-color)" }}
      >
        {aligning ? "Solving…" : "Apply Suggested Specs"}
      </button>

      {alignResult && (
        <div className="flex flex-col gap-0.5 text-2xs leading-snug mt-0.5">
          <span className="opacity-70">
            {alignResult.alignment_name} ·{" "}
            {alignResult.f_high > 0
              ? `${alignResult.f3}–${alignResult.f_high} Hz`
              : `F3 ${alignResult.f3} Hz`}{" "}
            · ripple {alignResult.ripple_db} dB
            {alignResult.port_velocity > 0 && ` · port ${alignResult.port_velocity} m/s`}
            {alignResult.excursion_ratio > 0 &&
              ` · ${Math.round(alignResult.excursion_ratio * 100)}% Xmax`}
          </span>
          {alignResult.notes.map((note, i) => (
            <span key={i} className="opacity-85">
              ⚠ {note}
            </span>
          ))}
        </div>
      )}
    </CollapsibleSection>
  );
}
