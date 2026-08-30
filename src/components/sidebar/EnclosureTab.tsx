import { useState } from "react";
import { CollapsibleSection, Badge, Listbox, NumberRow } from "../ui";
import CustomTopologyDiagram from "../CustomTopologyDiagram";
import DimensionCalculator from "./DimensionCalculator";
import {
  AlignmentRecommendation,
  AlignmentTarget,
  CustomSideSpec,
  CustomPortSpec,
  CustomPRSpec,
  EnclosureType,
} from "../../types";
import { useProjectsContext } from "../../context/ProjectsContext";
import { useSimulationContext } from "../../context/SimulationContext";
import { useModalsContext } from "../../context/ModalsContext";

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

const DEFAULT_PORT: CustomPortSpec = { diameter_cm: 10, tuning_freq: 35 };
const DEFAULT_PR: CustomPRSpec = { mms_g: 300, sd_cm2: 1680, fs: 25, qms: 5 };

export default function EnclosureTab() {
  const { activeProject, updateActiveProject } = useProjectsContext();
  const { calculatedPortLength, portLengthClamped, handleAutoCalculatePort, handleApplyAlignment } =
    useSimulationContext();
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
                value={activeProject.enclosureType}
                onChange={(val) => updateActiveProject({ enclosureType: val as EnclosureType })}
                buttonClassName="w-full border rounded px-2.5 py-1.5 text-xs focus:outline-none flex items-center justify-between gap-2 cursor-pointer text-left"
                options={[
                  { value: "sealed", label: "Sealed (2nd Order Closed Box)" },
                  { value: "ported", label: "Vented (4th Order Bass Reflex)" },
                  { value: "bandpass4", label: "4th-Order Bandpass (BP4)" },
                  { value: "bandpass6_parallel", label: "6th-Order Parallel Bandpass (BP6P)" },
                  { value: "bandpass6_series", label: "6th-Order Series Bandpass (BP6S)" },
                  { value: "passive_radiator", label: "Passive Radiator (4th Order PR)" },
                  { value: "custom", label: "Custom Topology Builder" },
                ]}
              />
            </div>

            {activeProject.enclosureType !== "custom" && (
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
                  let guidance = "";
                  if (ebp > 80) guidance = "Ported enclosure preferred (strong motor).";
                  else if (ebp < 50) guidance = "Sealed enclosure preferred (acoustic suspension).";
                  else guidance = "Highly versatile — works well in Sealed or Ported.";
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
                    onChange={(val) => setAlignmentPref(val as any)}
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
            )}

            {/* Sealed & Ported & PR single chamber volume */}
            {(activeProject.enclosureType === "sealed" || activeProject.enclosureType === "ported" || activeProject.enclosureType === "passive_radiator") && (
              <NumberRow
                label="Box Volume (Vb)"
                unit="L"
                value={activeProject.vBox}
                onChange={(v) => updateActiveProject({ vBox: v })}
              />
            )}

            {/* Ported Controls */}
            {activeProject.enclosureType === "ported" && (
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
                        ⚠ This vent is too large for {activeProject.vBox} L at {activeProject.tuningFreq} Hz — its end
                        correction alone already tunes above Fb. The simulation uses the minimum length, so the
                        actual tuning is higher than shown. Use a smaller or fewer ports, or a larger box.
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
            )}

            {/* 4th-Order Bandpass Controls */}
            {activeProject.enclosureType === "bandpass4" && (
              <div className="flex flex-col gap-3 text-xs">
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
                <div className="border rounded p-2.5" style={{ backgroundColor: "var(--bg-color)", borderColor: "var(--border-color)" }}>
                  <span className="font-semibold text-xs opacity-80 block mb-2">Rear Chamber (Sealed)</span>
                  <NumberRow
                    label="Volume (Vr)"
                    unit="L"
                    className="mb-1"
                    value={activeProject.vRear}
                    onChange={(v) => updateActiveProject({ vRear: v })}
                  />
                </div>

                <div className="border rounded p-2.5" style={{ backgroundColor: "var(--bg-color)", borderColor: "var(--border-color)" }}>
                  <span className="font-semibold text-xs opacity-80 block mb-2">Front Chamber (Ported)</span>
                  <NumberRow
                    label="Volume (Vf)"
                    unit="L"
                    className="mb-2"
                    value={activeProject.vFront}
                    onChange={(v) => updateActiveProject({ vFront: v })}
                  />
                  <NumberRow
                    label="Tuning (Fb)"
                    unit="Hz"
                    className="mb-2"
                    value={activeProject.frontTuningFreq}
                    onChange={(v) => updateActiveProject({ frontTuningFreq: v })}
                  />
                  <NumberRow
                    label="Port Diameter"
                    unit="cm"
                    step={0.1}
                    value={activeProject.frontPortDiameter}
                    onChange={(v) => updateActiveProject({ frontPortDiameter: v })}
                  />
                </div>
              </div>
            )}

            {/* 6th-Order Parallel Bandpass Controls */}
            {activeProject.enclosureType === "bandpass6_parallel" && (
              <div className="flex flex-col gap-3 text-xs">
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
                <div className="border rounded p-2.5" style={{ backgroundColor: "var(--bg-color)", borderColor: "var(--border-color)" }}>
                  <span className="font-semibold text-xs opacity-80 block mb-2">Rear Chamber (Ported)</span>
                  <NumberRow
                    label="Volume (Vr)"
                    unit="L"
                    className="mb-2"
                    value={activeProject.vRear}
                    onChange={(v) => updateActiveProject({ vRear: v })}
                  />
                  <NumberRow
                    label="Tuning (Fb,rear)"
                    unit="Hz"
                    className="mb-2"
                    value={activeProject.rearTuningFreq}
                    onChange={(v) => updateActiveProject({ rearTuningFreq: v })}
                  />
                  <NumberRow
                    label="Port Diameter"
                    unit="cm"
                    step={0.1}
                    value={activeProject.rearPortDiameter}
                    onChange={(v) => updateActiveProject({ rearPortDiameter: v })}
                  />
                </div>

                <div className="border rounded p-2.5" style={{ backgroundColor: "var(--bg-color)", borderColor: "var(--border-color)" }}>
                  <span className="font-semibold text-xs opacity-80 block mb-2">Front Chamber (Ported)</span>
                  <NumberRow
                    label="Volume (Vf)"
                    unit="L"
                    className="mb-2"
                    value={activeProject.vFront}
                    onChange={(v) => updateActiveProject({ vFront: v })}
                  />
                  <NumberRow
                    label="Tuning (Fb,front)"
                    unit="Hz"
                    className="mb-2"
                    value={activeProject.frontTuningFreq}
                    onChange={(v) => updateActiveProject({ frontTuningFreq: v })}
                  />
                  <NumberRow
                    label="Port Diameter"
                    unit="cm"
                    step={0.1}
                    value={activeProject.frontPortDiameter}
                    onChange={(v) => updateActiveProject({ frontPortDiameter: v })}
                  />
                </div>
              </div>
            )}

            {/* 6th-Order Series Bandpass Controls */}
            {activeProject.enclosureType === "bandpass6_series" && (
              <div className="flex flex-col gap-3 text-xs">
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
                <div className="border rounded p-2.5" style={{ backgroundColor: "var(--bg-color)", borderColor: "var(--border-color)" }}>
                  <span className="font-semibold text-xs opacity-80 block mb-2">Rear Chamber (Vented into Front)</span>
                  <NumberRow
                    label="Volume (Vr)"
                    unit="L"
                    className="mb-2"
                    value={activeProject.vRear}
                    onChange={(v) => updateActiveProject({ vRear: v })}
                  />
                  <NumberRow
                    label="Internal Tuning"
                    unit="Hz"
                    className="mb-2"
                    value={activeProject.rearTuningFreq}
                    onChange={(v) => updateActiveProject({ rearTuningFreq: v })}
                  />
                  <NumberRow
                    label="Internal Port Diam"
                    unit="cm"
                    step={0.1}
                    value={activeProject.internalPortDiameter}
                    onChange={(v) => updateActiveProject({ internalPortDiameter: v })}
                  />
                </div>

                <div className="border rounded p-2.5" style={{ backgroundColor: "var(--bg-color)", borderColor: "var(--border-color)" }}>
                  <span className="font-semibold text-xs opacity-80 block mb-2">Front Chamber (Vented Outside)</span>
                  <NumberRow
                    label="Volume (Vf)"
                    unit="L"
                    className="mb-2"
                    value={activeProject.vFront}
                    onChange={(v) => updateActiveProject({ vFront: v })}
                  />
                  <NumberRow
                    label="Front Tuning (Fb)"
                    unit="Hz"
                    className="mb-2"
                    value={activeProject.frontTuningFreq}
                    onChange={(v) => updateActiveProject({ frontTuningFreq: v })}
                  />
                  <NumberRow
                    label="Front Port Diam"
                    unit="cm"
                    step={0.1}
                    value={activeProject.frontPortDiameter}
                    onChange={(v) => updateActiveProject({ frontPortDiameter: v })}
                  />
                </div>
              </div>
            )}

            {/* Passive Radiator Controls */}
            {activeProject.enclosureType === "passive_radiator" && (
              <div className="flex flex-col gap-2.5 border rounded p-2.5 text-xs" style={{ backgroundColor: "var(--bg-color)", borderColor: "var(--border-color)" }}>
                <span className="font-semibold text-xs opacity-80 block mb-1">Passive Radiator Parameters</span>
                <NumberRow
                  label="PR Moving Mass (Mms)"
                  unit="g"
                  value={activeProject.prMms}
                  onChange={(v) => updateActiveProject({ prMms: v })}
                />
                <NumberRow
                  label="PR Piston Area (Sd)"
                  unit="cm²"
                  value={activeProject.prSd}
                  onChange={(v) => updateActiveProject({ prSd: v })}
                />
                <NumberRow
                  label="PR Resonance (Fs)"
                  unit="Hz"
                  value={activeProject.prFs}
                  onChange={(v) => updateActiveProject({ prFs: v })}
                />
                <NumberRow
                  label="PR Mechanical Q (Qms)"
                  step={0.5}
                  value={activeProject.prQms}
                  onChange={(v) => updateActiveProject({ prQms: v })}
                />
              </div>
            )}
            </CollapsibleSection>

          {/* ── Custom Topology Builder ── */}
          {activeProject.enclosureType === "custom" && (
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
            )}
      </div>

      <DimensionCalculator />
    </>
  );
}
