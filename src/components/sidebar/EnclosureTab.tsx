import { useState } from "react";
import { CollapsibleSection, Badge } from "../ui";
import CustomTopologyDiagram from "../CustomTopologyDiagram";
import DimensionCalculator from "./DimensionCalculator";
import { CustomSideSpec, CustomPortSpec, CustomPRSpec, EnclosureType } from "../../types";
import { useProjectsContext } from "../../context/ProjectsContext";
import { useSimulationContext } from "../../context/SimulationContext";
import { useModalsContext } from "../../context/ModalsContext";

const DEFAULT_PORT: CustomPortSpec = { diameter_cm: 10, tuning_freq: 35 };
const DEFAULT_PR: CustomPRSpec = { mms_g: 300, sd_cm2: 1680, fs: 25, qms: 5 };

export default function EnclosureTab() {
  const { activeProject, updateActiveProject } = useProjectsContext();
  const { calculatedPortLength, handleAutoCalculatePort, handleApplyAlignment } = useSimulationContext();
  const { sidebarSectionState, toggleSidebarSection } = useModalsContext();

  const [alignmentPref, setAlignmentPref] = useState<"maximally_flat" | "extended_bass" | "boomy">("maximally_flat");

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
              <select
                value={activeProject.enclosureType}
                onChange={(e) => updateActiveProject({ enclosureType: e.target.value as EnclosureType })}
                className="w-full border rounded px-2.5 py-1.5 text-xs focus:outline-none"
                style={{
                  backgroundColor: "var(--bg-color)",
                  borderColor: "var(--graph-grid-color)",
                  color: "var(--text-color)",
                }}
              >
                <option value="sealed">Sealed (2nd Order Closed Box)</option>
                <option value="ported">Vented (4th Order Bass Reflex)</option>
                <option value="bandpass4">4th-Order Bandpass (BP4)</option>
                <option value="bandpass6_parallel">6th-Order Parallel Bandpass (BP6P)</option>
                <option value="bandpass6_series">6th-Order Series Bandpass (BP6S)</option>
                <option value="passive_radiator">Passive Radiator (4th Order PR)</option>
                <option value="custom">Custom Topology Builder</option>
              </select>
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
                  <select
                    value={alignmentPref}
                    onChange={(e) => setAlignmentPref(e.target.value as any)}
                    className="w-full border rounded px-2.5 py-1 text-xs focus:outline-none"
                    style={{ backgroundColor: "var(--sidebar-color)", borderColor: "var(--graph-grid-color)", color: "var(--text-color)" }}
                  >
                    <option value="maximally_flat">Maximally Flat (Butterworth)</option>
                    <option value="extended_bass">Extended Bass Shelf</option>
                    <option value="boomy">High-Output / Boomy (Bass Boost)</option>
                  </select>
                </div>

                <button
                  type="button"
                  onClick={() => handleApplyAlignment(alignmentPref)}
                  className="w-full py-1.5 hover:brightness-110 active:brightness-95 rounded text-xs font-semibold tracking-wide transition text-white hover:shadow-md cursor-pointer mt-1"
                  style={{ backgroundColor: "var(--accent-color)" }}
                >
                  Apply Suggested Specs
                </button>
              </CollapsibleSection>
            )}

            {/* Sealed & Ported & PR single chamber volume */}
            {(activeProject.enclosureType === "sealed" || activeProject.enclosureType === "ported" || activeProject.enclosureType === "passive_radiator") && (
              <div>
                <div className="flex justify-between items-center text-xs mb-1">
                  <span className="opacity-70">Box Volume (Vb)</span>
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      value={activeProject.vBox}
                      onChange={(e) => updateActiveProject({ vBox: parseFloat(e.target.value) || 0 })}
                      className="w-16 border rounded px-1.5 py-0.5 text-right font-mono focus:outline-none text-xs"
                      style={{
                        backgroundColor: "var(--bg-color)",
                        borderColor: "var(--graph-grid-color)",
                        color: "var(--accent-color)",
                      }}
                    />
                    <span className="opacity-60">L</span>
                  </div>
                </div>
                <input
                  type="range"
                  min="2"
                  max={Math.max(200, activeProject.driver.vas * 1.5)}
                  step="0.5"
                  value={activeProject.vBox}
                  onChange={(e) => updateActiveProject({ vBox: parseFloat(e.target.value) })}
                  className="w-full h-1.5 rounded-lg appearance-none cursor-pointer mt-2"
                  style={{ accentColor: "var(--accent-color)", backgroundColor: "var(--bg-color)" }}
                />
              </div>
            )}

            {/* Ported Controls */}
            {activeProject.enclosureType === "ported" && (
              <>
                <div>
                  <div className="flex justify-between items-center text-xs mb-1">
                    <span className="opacity-70">Tuning Freq (Fb)</span>
                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        value={activeProject.tuningFreq}
                        onChange={(e) => updateActiveProject({ tuningFreq: parseFloat(e.target.value) || 0 })}
                        className="w-16 border rounded px-1.5 py-0.5 text-right font-mono focus:outline-none text-xs"
                        style={{
                          backgroundColor: "var(--bg-color)",
                          borderColor: "var(--graph-grid-color)",
                          color: "var(--accent-color)",
                        }}
                      />
                      <span className="opacity-60">Hz</span>
                    </div>
                  </div>
                  <input
                    type="range"
                    min="15"
                    max="100"
                    step="0.5"
                    value={activeProject.tuningFreq}
                    onChange={(e) => updateActiveProject({ tuningFreq: parseFloat(e.target.value) })}
                    className="w-full h-1.5 rounded-lg appearance-none cursor-pointer mt-2"
                    style={{ accentColor: "var(--accent-color)", backgroundColor: "var(--bg-color)" }}
                  />
                </div>
                <div>
                  <label className="text-xs opacity-70 block mb-1">Port Shape</label>
                  <select
                    value={activeProject.portShape}
                    onChange={(e) => updateActiveProject({ portShape: e.target.value as "circular" | "rectangular" })}
                    className="w-full border rounded px-2.5 py-1.5 text-xs focus:outline-none"
                    style={{
                      backgroundColor: "var(--bg-color)",
                      borderColor: "var(--graph-grid-color)",
                      color: "var(--text-color)",
                    }}
                  >
                    <option value="circular">Circular / Cylinder</option>
                    <option value="rectangular">Rectangular / Slot</option>
                  </select>
                </div>

                <div>
                  <div className="flex justify-between items-center text-xs mb-1">
                    <span className="opacity-70">Port Count</span>
                    <input
                      type="number"
                      min="1"
                      max="8"
                      value={activeProject.portCount}
                      onChange={(e) => updateActiveProject({ portCount: Math.max(1, Math.min(8, parseInt(e.target.value) || 1)) })}
                      className="w-16 border rounded px-1.5 py-0.5 text-right font-mono focus:outline-none text-xs"
                      style={{
                        backgroundColor: "var(--bg-color)",
                        borderColor: "var(--graph-grid-color)",
                        color: "var(--accent-color)",
                      }}
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs opacity-70 block mb-1">Port Losses (Q factor)</label>
                  <select
                    value={activeProject.portQ}
                    onChange={(e) => updateActiveProject({ portQ: parseFloat(e.target.value) })}
                    className="w-full border rounded px-2.5 py-1.5 text-xs focus:outline-none"
                    style={{ backgroundColor: "var(--bg-color)", borderColor: "var(--graph-grid-color)", color: "var(--text-color)" }}
                  >
                    <option value={50}>Circular port (Q = 50)</option>
                    <option value={30}>Slot port (Q = 30)</option>
                    <option value={100}>Low-loss / rigid port (Q = 100)</option>
                  </select>
                </div>

                {activeProject.portShape === "circular" ? (
                  <div>
                    <div className="flex justify-between items-center text-xs mb-1">
                      <span className="opacity-70">Port Diameter</span>
                      <div className="flex items-center gap-1">
                        <input
                          type="number"
                          step="0.1"
                          value={activeProject.portDiameter}
                          onChange={(e) => updateActiveProject({ portDiameter: parseFloat(e.target.value) || 0 })}
                          className="w-16 border rounded px-1.5 py-0.5 text-right font-mono focus:outline-none text-xs"
                          style={{
                            backgroundColor: "var(--bg-color)",
                            borderColor: "var(--graph-grid-color)",
                            color: "var(--accent-color)",
                          }}
                        />
                        <span className="opacity-60">cm</span>
                      </div>
                    </div>
                    <input
                      type="range"
                      min="3"
                      max="30"
                      step="0.1"
                      value={activeProject.portDiameter}
                      onChange={(e) => updateActiveProject({ portDiameter: parseFloat(e.target.value) })}
                      className="w-full h-1.5 rounded-lg appearance-none cursor-pointer mt-2"
                      style={{ accentColor: "var(--accent-color)", backgroundColor: "var(--bg-color)" }}
                    />
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <label className="opacity-70 block mb-1">Slot Width (cm)</label>
                      <input
                        type="number"
                        step="0.5"
                        value={activeProject.portWidth}
                        onChange={(e) => updateActiveProject({ portWidth: parseFloat(e.target.value) || 0 })}
                        className="w-full border rounded px-2 py-1 text-right font-mono focus:outline-none text-xs"
                        style={{
                          backgroundColor: "var(--bg-color)",
                          borderColor: "var(--graph-grid-color)",
                          color: "var(--accent-color)",
                        }}
                      />
                    </div>
                    <div>
                      <label className="opacity-70 block mb-1">Slot Height (cm)</label>
                      <input
                        type="number"
                        step="0.5"
                        value={activeProject.portHeight}
                        onChange={(e) => updateActiveProject({ portHeight: parseFloat(e.target.value) || 0 })}
                        className="w-full border rounded px-2 py-1 text-right font-mono focus:outline-none text-xs"
                        style={{
                          backgroundColor: "var(--bg-color)",
                          borderColor: "var(--graph-grid-color)",
                          color: "var(--accent-color)",
                        }}
                      />
                    </div>
                  </div>
                )}

                {/* Port Length HUD & Calculator */}
                <div className="flex flex-col gap-2.5 mt-1 border-t pt-3" style={{ borderColor: "var(--graph-grid-color)" }}>
                  <div className="border border-dashed rounded p-2.5 flex flex-col gap-1 text-2xs" style={{ borderColor: "var(--graph-grid-color)" }}>
                    <div className="flex justify-between font-semibold">
                      <span className="opacity-75">Required Length:</span>
                      <span style={{ color: "var(--accent-color)" }}>{calculatedPortLength.toFixed(1)} cm</span>
                    </div>
                    <div className="opacity-65 text-2xs">
                      Length represents the tube/slot length for *each* port to achieve Fb = {activeProject.tuningFreq}Hz.
                    </div>
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
                <div className="border rounded p-2.5 flex flex-col gap-2 text-xs" style={{ backgroundColor: "var(--bg-color)", borderColor: "var(--graph-grid-color)" }}>
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
                        <select
                          value={activeProject.port2Shape}
                          onChange={(e) => updateActiveProject({ port2Shape: e.target.value as "circular" | "rectangular" })}
                          className="border rounded px-1.5 py-0.5 text-xs focus:outline-none"
                          style={{ backgroundColor: "var(--sidebar-color)", borderColor: "var(--graph-grid-color)", color: "var(--text-color)" }}
                        >
                          <option value="circular">Circular</option>
                          <option value="rectangular">Rectangular / Slot</option>
                        </select>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="opacity-70">Count</span>
                        <input
                          type="number"
                          min="1"
                          max="8"
                          value={activeProject.port2Count}
                          onChange={(e) => updateActiveProject({ port2Count: Math.max(1, parseInt(e.target.value) || 1) })}
                          className="w-16 border rounded px-1.5 py-0.5 text-right font-mono focus:outline-none text-xs"
                          style={{ backgroundColor: "var(--sidebar-color)", borderColor: "var(--graph-grid-color)", color: "var(--accent-color)" }}
                        />
                      </div>
                      {activeProject.port2Shape === "circular" ? (
                        <div className="flex justify-between items-center">
                          <span className="opacity-70">Diameter</span>
                          <div className="flex items-center gap-1">
                            <input
                              type="number"
                              step="0.1"
                              value={activeProject.port2Diameter}
                              onChange={(e) => updateActiveProject({ port2Diameter: parseFloat(e.target.value) || 0 })}
                              className="w-16 border rounded px-1.5 py-0.5 text-right font-mono focus:outline-none text-xs"
                              style={{ backgroundColor: "var(--sidebar-color)", borderColor: "var(--graph-grid-color)", color: "var(--accent-color)" }}
                            />
                            <span className="opacity-60">cm</span>
                          </div>
                        </div>
                      ) : (
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="opacity-70 block mb-0.5">Width (cm)</label>
                            <input
                              type="number"
                              step="0.5"
                              value={activeProject.port2Width}
                              onChange={(e) => updateActiveProject({ port2Width: parseFloat(e.target.value) || 0 })}
                              className="w-full border rounded px-2 py-1 text-right font-mono focus:outline-none text-xs"
                              style={{ backgroundColor: "var(--sidebar-color)", borderColor: "var(--graph-grid-color)", color: "var(--accent-color)" }}
                            />
                          </div>
                          <div>
                            <label className="opacity-70 block mb-0.5">Height (cm)</label>
                            <input
                              type="number"
                              step="0.5"
                              value={activeProject.port2Height}
                              onChange={(e) => updateActiveProject({ port2Height: parseFloat(e.target.value) || 0 })}
                              className="w-full border rounded px-2 py-1 text-right font-mono focus:outline-none text-xs"
                              style={{ backgroundColor: "var(--sidebar-color)", borderColor: "var(--graph-grid-color)", color: "var(--accent-color)" }}
                            />
                          </div>
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
                  <select
                    value={activeProject.portQ}
                    onChange={(e) => updateActiveProject({ portQ: parseFloat(e.target.value) })}
                    className="w-full border rounded px-2.5 py-1.5 text-xs focus:outline-none"
                    style={{ backgroundColor: "var(--bg-color)", borderColor: "var(--graph-grid-color)", color: "var(--text-color)" }}
                  >
                    <option value={50}>Circular port (Q = 50)</option>
                    <option value={30}>Slot port (Q = 30)</option>
                    <option value={100}>Low-loss / rigid port (Q = 100)</option>
                  </select>
                </div>
                <div className="border rounded p-2.5" style={{ backgroundColor: "var(--bg-color)", borderColor: "var(--graph-grid-color)" }}>
                  <span className="font-semibold text-xs opacity-80 block mb-2">Rear Chamber (Sealed)</span>
                  <div className="flex justify-between items-center mb-1">
                    <span className="opacity-70">Volume (Vr)</span>
                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        value={activeProject.vRear}
                        onChange={(e) => updateActiveProject({ vRear: parseFloat(e.target.value) || 0 })}
                        className="w-16 border rounded px-1.5 py-0.5 text-right font-mono focus:outline-none text-xs"
                        style={{ backgroundColor: "var(--sidebar-color)", borderColor: "var(--graph-grid-color)", color: "var(--accent-color)" }}
                      />
                      <span className="opacity-60">L</span>
                    </div>
                  </div>
                </div>

                <div className="border rounded p-2.5" style={{ backgroundColor: "var(--bg-color)", borderColor: "var(--graph-grid-color)" }}>
                  <span className="font-semibold text-xs opacity-80 block mb-2">Front Chamber (Ported)</span>
                  <div className="flex justify-between items-center mb-2">
                    <span className="opacity-70">Volume (Vf)</span>
                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        value={activeProject.vFront}
                        onChange={(e) => updateActiveProject({ vFront: parseFloat(e.target.value) || 0 })}
                        className="w-16 border rounded px-1.5 py-0.5 text-right font-mono focus:outline-none text-xs"
                        style={{ backgroundColor: "var(--sidebar-color)", borderColor: "var(--graph-grid-color)", color: "var(--accent-color)" }}
                      />
                      <span className="opacity-60">L</span>
                    </div>
                  </div>
                  <div className="flex justify-between items-center mb-2">
                    <span className="opacity-70">Tuning (Fb)</span>
                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        value={activeProject.frontTuningFreq}
                        onChange={(e) => updateActiveProject({ frontTuningFreq: parseFloat(e.target.value) || 0 })}
                        className="w-16 border rounded px-1.5 py-0.5 text-right font-mono focus:outline-none text-xs"
                        style={{ backgroundColor: "var(--sidebar-color)", borderColor: "var(--graph-grid-color)", color: "var(--accent-color)" }}
                      />
                      <span className="opacity-60">Hz</span>
                    </div>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="opacity-70">Port Diameter</span>
                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        step="0.1"
                        value={activeProject.frontPortDiameter}
                        onChange={(e) => updateActiveProject({ frontPortDiameter: parseFloat(e.target.value) || 0 })}
                        className="w-16 border rounded px-1.5 py-0.5 text-right font-mono focus:outline-none text-xs"
                        style={{ backgroundColor: "var(--sidebar-color)", borderColor: "var(--graph-grid-color)", color: "var(--accent-color)" }}
                      />
                      <span className="opacity-60">cm</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* 6th-Order Parallel Bandpass Controls */}
            {activeProject.enclosureType === "bandpass6_parallel" && (
              <div className="flex flex-col gap-3 text-xs">
                <div>
                  <label className="text-xs opacity-70 block mb-1">Port Losses (Q factor)</label>
                  <select
                    value={activeProject.portQ}
                    onChange={(e) => updateActiveProject({ portQ: parseFloat(e.target.value) })}
                    className="w-full border rounded px-2.5 py-1.5 text-xs focus:outline-none"
                    style={{ backgroundColor: "var(--bg-color)", borderColor: "var(--graph-grid-color)", color: "var(--text-color)" }}
                  >
                    <option value={50}>Circular port (Q = 50)</option>
                    <option value={30}>Slot port (Q = 30)</option>
                    <option value={100}>Low-loss / rigid port (Q = 100)</option>
                  </select>
                </div>
                <div className="border rounded p-2.5" style={{ backgroundColor: "var(--bg-color)", borderColor: "var(--graph-grid-color)" }}>
                  <span className="font-semibold text-xs opacity-80 block mb-2">Rear Chamber (Ported)</span>
                  <div className="flex justify-between items-center mb-2">
                    <span className="opacity-70">Volume (Vr)</span>
                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        value={activeProject.vRear}
                        onChange={(e) => updateActiveProject({ vRear: parseFloat(e.target.value) || 0 })}
                        className="w-16 border rounded px-1.5 py-0.5 text-right font-mono focus:outline-none text-xs"
                        style={{ backgroundColor: "var(--sidebar-color)", borderColor: "var(--graph-grid-color)", color: "var(--accent-color)" }}
                      />
                      <span className="opacity-60">L</span>
                    </div>
                  </div>
                  <div className="flex justify-between items-center mb-2">
                    <span className="opacity-70">Tuning (Fb,rear)</span>
                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        value={activeProject.rearTuningFreq}
                        onChange={(e) => updateActiveProject({ rearTuningFreq: parseFloat(e.target.value) || 0 })}
                        className="w-16 border rounded px-1.5 py-0.5 text-right font-mono focus:outline-none text-xs"
                        style={{ backgroundColor: "var(--sidebar-color)", borderColor: "var(--graph-grid-color)", color: "var(--accent-color)" }}
                      />
                      <span className="opacity-60">Hz</span>
                    </div>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="opacity-70">Port Diameter</span>
                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        step="0.1"
                        value={activeProject.rearPortDiameter}
                        onChange={(e) => updateActiveProject({ rearPortDiameter: parseFloat(e.target.value) || 0 })}
                        className="w-16 border rounded px-1.5 py-0.5 text-right font-mono focus:outline-none text-xs"
                        style={{ backgroundColor: "var(--sidebar-color)", borderColor: "var(--graph-grid-color)", color: "var(--accent-color)" }}
                      />
                      <span className="opacity-60">cm</span>
                    </div>
                  </div>
                </div>

                <div className="border rounded p-2.5" style={{ backgroundColor: "var(--bg-color)", borderColor: "var(--graph-grid-color)" }}>
                  <span className="font-semibold text-xs opacity-80 block mb-2">Front Chamber (Ported)</span>
                  <div className="flex justify-between items-center mb-2">
                    <span className="opacity-70">Volume (Vf)</span>
                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        value={activeProject.vFront}
                        onChange={(e) => updateActiveProject({ vFront: parseFloat(e.target.value) || 0 })}
                        className="w-16 border rounded px-1.5 py-0.5 text-right font-mono focus:outline-none text-xs"
                        style={{ backgroundColor: "var(--sidebar-color)", borderColor: "var(--graph-grid-color)", color: "var(--accent-color)" }}
                      />
                      <span className="opacity-60">L</span>
                    </div>
                  </div>
                  <div className="flex justify-between items-center mb-2">
                    <span className="opacity-70">Tuning (Fb,front)</span>
                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        value={activeProject.frontTuningFreq}
                        onChange={(e) => updateActiveProject({ frontTuningFreq: parseFloat(e.target.value) || 0 })}
                        className="w-16 border rounded px-1.5 py-0.5 text-right font-mono focus:outline-none text-xs"
                        style={{ backgroundColor: "var(--sidebar-color)", borderColor: "var(--graph-grid-color)", color: "var(--accent-color)" }}
                      />
                      <span className="opacity-60">Hz</span>
                    </div>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="opacity-70">Port Diameter</span>
                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        step="0.1"
                        value={activeProject.frontPortDiameter}
                        onChange={(e) => updateActiveProject({ frontPortDiameter: parseFloat(e.target.value) || 0 })}
                        className="w-16 border rounded px-1.5 py-0.5 text-right font-mono focus:outline-none text-xs"
                        style={{ backgroundColor: "var(--sidebar-color)", borderColor: "var(--graph-grid-color)", color: "var(--accent-color)" }}
                      />
                      <span className="opacity-60">cm</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* 6th-Order Series Bandpass Controls */}
            {activeProject.enclosureType === "bandpass6_series" && (
              <div className="flex flex-col gap-3 text-xs">
                <div>
                  <label className="text-xs opacity-70 block mb-1">Port Losses (Q factor)</label>
                  <select
                    value={activeProject.portQ}
                    onChange={(e) => updateActiveProject({ portQ: parseFloat(e.target.value) })}
                    className="w-full border rounded px-2.5 py-1.5 text-xs focus:outline-none"
                    style={{ backgroundColor: "var(--bg-color)", borderColor: "var(--graph-grid-color)", color: "var(--text-color)" }}
                  >
                    <option value={50}>Circular port (Q = 50)</option>
                    <option value={30}>Slot port (Q = 30)</option>
                    <option value={100}>Low-loss / rigid port (Q = 100)</option>
                  </select>
                </div>
                <div className="border rounded p-2.5" style={{ backgroundColor: "var(--bg-color)", borderColor: "var(--graph-grid-color)" }}>
                  <span className="font-semibold text-xs opacity-80 block mb-2">Rear Chamber (Vented into Front)</span>
                  <div className="flex justify-between items-center mb-2">
                    <span className="opacity-70">Volume (Vr)</span>
                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        value={activeProject.vRear}
                        onChange={(e) => updateActiveProject({ vRear: parseFloat(e.target.value) || 0 })}
                        className="w-16 border rounded px-1.5 py-0.5 text-right font-mono focus:outline-none text-xs"
                        style={{ backgroundColor: "var(--sidebar-color)", borderColor: "var(--graph-grid-color)", color: "var(--accent-color)" }}
                      />
                      <span className="opacity-60">L</span>
                    </div>
                  </div>
                  <div className="flex justify-between items-center mb-2">
                    <span className="opacity-70">Internal Tuning</span>
                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        value={activeProject.rearTuningFreq}
                        onChange={(e) => updateActiveProject({ rearTuningFreq: parseFloat(e.target.value) || 0 })}
                        className="w-16 border rounded px-1.5 py-0.5 text-right font-mono focus:outline-none text-xs"
                        style={{ backgroundColor: "var(--sidebar-color)", borderColor: "var(--graph-grid-color)", color: "var(--accent-color)" }}
                      />
                      <span className="opacity-60">Hz</span>
                    </div>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="opacity-70">Internal Port Diam</span>
                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        step="0.1"
                        value={activeProject.internalPortDiameter}
                        onChange={(e) => updateActiveProject({ internalPortDiameter: parseFloat(e.target.value) || 0 })}
                        className="w-16 border rounded px-1.5 py-0.5 text-right font-mono focus:outline-none text-xs"
                        style={{ backgroundColor: "var(--sidebar-color)", borderColor: "var(--graph-grid-color)", color: "var(--accent-color)" }}
                      />
                      <span className="opacity-60">cm</span>
                    </div>
                  </div>
                </div>

                <div className="border rounded p-2.5" style={{ backgroundColor: "var(--bg-color)", borderColor: "var(--graph-grid-color)" }}>
                  <span className="font-semibold text-xs opacity-80 block mb-2">Front Chamber (Vented Outside)</span>
                  <div className="flex justify-between items-center mb-2">
                    <span className="opacity-70">Volume (Vf)</span>
                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        value={activeProject.vFront}
                        onChange={(e) => updateActiveProject({ vFront: parseFloat(e.target.value) || 0 })}
                        className="w-16 border rounded px-1.5 py-0.5 text-right font-mono focus:outline-none text-xs"
                        style={{ backgroundColor: "var(--sidebar-color)", borderColor: "var(--graph-grid-color)", color: "var(--accent-color)" }}
                      />
                      <span className="opacity-60">L</span>
                    </div>
                  </div>
                  <div className="flex justify-between items-center mb-2">
                    <span className="opacity-70">Front Tuning (Fb)</span>
                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        value={activeProject.frontTuningFreq}
                        onChange={(e) => updateActiveProject({ frontTuningFreq: parseFloat(e.target.value) || 0 })}
                        className="w-16 border rounded px-1.5 py-0.5 text-right font-mono focus:outline-none text-xs"
                        style={{ backgroundColor: "var(--sidebar-color)", borderColor: "var(--graph-grid-color)", color: "var(--accent-color)" }}
                      />
                      <span className="opacity-60">Hz</span>
                    </div>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="opacity-70">Front Port Diam</span>
                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        step="0.1"
                        value={activeProject.frontPortDiameter}
                        onChange={(e) => updateActiveProject({ frontPortDiameter: parseFloat(e.target.value) || 0 })}
                        className="w-16 border rounded px-1.5 py-0.5 text-right font-mono focus:outline-none text-xs"
                        style={{ backgroundColor: "var(--sidebar-color)", borderColor: "var(--graph-grid-color)", color: "var(--accent-color)" }}
                      />
                      <span className="opacity-60">cm</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Passive Radiator Controls */}
            {activeProject.enclosureType === "passive_radiator" && (
              <div className="flex flex-col gap-2.5 border rounded p-2.5 text-xs" style={{ backgroundColor: "var(--bg-color)", borderColor: "var(--graph-grid-color)" }}>
                <span className="font-semibold text-xs opacity-80 block mb-1">Passive Radiator Parameters</span>
                <div className="flex justify-between items-center">
                  <span className="opacity-70">PR Moving Mass (Mms)</span>
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      value={activeProject.prMms}
                      onChange={(e) => updateActiveProject({ prMms: parseFloat(e.target.value) || 0 })}
                      className="w-16 border rounded px-1.5 py-0.5 text-right font-mono focus:outline-none text-xs"
                      style={{ backgroundColor: "var(--sidebar-color)", borderColor: "var(--graph-grid-color)", color: "var(--accent-color)" }}
                    />
                    <span className="opacity-60">g</span>
                  </div>
                </div>
                <div className="flex justify-between items-center">
                  <span className="opacity-70">PR Piston Area (Sd)</span>
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      value={activeProject.prSd}
                      onChange={(e) => updateActiveProject({ prSd: parseFloat(e.target.value) || 0 })}
                      className="w-16 border rounded px-1.5 py-0.5 text-right font-mono focus:outline-none text-xs"
                      style={{ backgroundColor: "var(--sidebar-color)", borderColor: "var(--graph-grid-color)", color: "var(--accent-color)" }}
                    />
                    <span className="opacity-60">cm²</span>
                  </div>
                </div>
                <div className="flex justify-between items-center">
                  <span className="opacity-70">PR Resonance (Fs)</span>
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      value={activeProject.prFs}
                      onChange={(e) => updateActiveProject({ prFs: parseFloat(e.target.value) || 0 })}
                      className="w-16 border rounded px-1.5 py-0.5 text-right font-mono focus:outline-none text-xs"
                      style={{ backgroundColor: "var(--sidebar-color)", borderColor: "var(--graph-grid-color)", color: "var(--accent-color)" }}
                    />
                    <span className="opacity-60">Hz</span>
                  </div>
                </div>
                <div className="flex justify-between items-center">
                  <span className="opacity-70">PR Mechanical Q (Qms)</span>
                  <input
                    type="number"
                    step="0.5"
                    value={activeProject.prQms}
                    onChange={(e) => updateActiveProject({ prQms: parseFloat(e.target.value) || 0 })}
                    className="w-16 border rounded px-1.5 py-0.5 text-right font-mono focus:outline-none text-xs"
                    style={{ backgroundColor: "var(--sidebar-color)", borderColor: "var(--graph-grid-color)", color: "var(--accent-color)" }}
                  />
                </div>
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
                    <div className="flex justify-between items-center">
                      <span className="opacity-70">Chamber Volume</span>
                      <div className="flex items-center gap-1">
                        <input type="number" value={activeProject.customTopology.rear.volume_liters}
                          onChange={e => updateCustomRear({ volume_liters: parseFloat(e.target.value) || 0 })}
                          className="w-16 border rounded px-1.5 py-0.5 text-right font-mono focus:outline-none text-xs"
                          style={{ backgroundColor: "var(--bg-color)", borderColor: "var(--graph-grid-color)", color: "var(--accent-color)" }} />
                        <span className="opacity-60">L</span>
                      </div>
                    </div>

                    {/* Rear port */}
                    {activeProject.customTopology.rear.port ? (
                      <div className="border rounded p-2 flex flex-col gap-1.5" style={{ borderColor: "var(--graph-grid-color)", backgroundColor: "var(--bg-color)" }}>
                        <div className="flex justify-between items-center">
                          <span className="font-semibold opacity-75">Port → Outside</span>
                          <button onClick={() => updateCustomRear({ port: null })}
                            className="text-2xs opacity-50 hover:opacity-100 hover:text-red-400 transition cursor-pointer">✕ Remove</button>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="opacity-60">Tuning (Fb)</span>
                          <div className="flex items-center gap-1">
                            <input type="number" value={activeProject.customTopology.rear.port.tuning_freq}
                              onChange={e => updateCustomRearPort({ tuning_freq: parseFloat(e.target.value) || 0 })}
                              className="w-16 border rounded px-1.5 py-0.5 text-right font-mono focus:outline-none text-xs"
                              style={{ backgroundColor: "var(--sidebar-color)", borderColor: "var(--graph-grid-color)", color: "var(--accent-color)" }} />
                            <span className="opacity-60">Hz</span>
                          </div>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="opacity-60">Diameter</span>
                          <div className="flex items-center gap-1">
                            <input type="number" step="0.1" value={activeProject.customTopology.rear.port.diameter_cm}
                              onChange={e => updateCustomRearPort({ diameter_cm: parseFloat(e.target.value) || 0 })}
                              className="w-16 border rounded px-1.5 py-0.5 text-right font-mono focus:outline-none text-xs"
                              style={{ backgroundColor: "var(--sidebar-color)", borderColor: "var(--graph-grid-color)", color: "var(--accent-color)" }} />
                            <span className="opacity-60">cm</span>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <button onClick={() => updateCustomRear({ port: DEFAULT_PORT, pr: null })}
                        className="text-left text-2xs opacity-60 hover:opacity-100 transition py-0.5 cursor-pointer hover:text-[var(--accent-color)]">
                        + Add Port to Outside
                      </button>
                    )}

                    {/* Rear PR */}
                    {activeProject.customTopology.rear.pr ? (
                      <div className="border rounded p-2 flex flex-col gap-1.5" style={{ borderColor: "var(--graph-grid-color)", backgroundColor: "var(--bg-color)" }}>
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
                          <div key={key} className="flex justify-between items-center">
                            <span className="opacity-60">{label}</span>
                            <div className="flex items-center gap-1">
                              <input type="number" step="any" value={activeProject.customTopology.rear.pr![key]}
                                onChange={e => updateCustomRearPR({ [key]: parseFloat(e.target.value) || 0 })}
                                className="w-16 border rounded px-1.5 py-0.5 text-right font-mono focus:outline-none text-xs"
                                style={{ backgroundColor: "var(--sidebar-color)", borderColor: "var(--graph-grid-color)", color: "var(--accent-color)" }} />
                              {unit && <span className="opacity-60">{unit}</span>}
                            </div>
                          </div>
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
                      <div className="border rounded p-2 flex flex-col gap-1.5" style={{ borderColor: "var(--graph-grid-color)", backgroundColor: "var(--bg-color)" }}>
                        <div className="flex justify-between items-center">
                          <span className="font-semibold opacity-75">Internal Port</span>
                          <button onClick={() => updateActiveProject({ customTopology: { ...activeProject.customTopology, internal_port: null } })}
                            className="text-2xs opacity-50 hover:opacity-100 hover:text-red-400 transition cursor-pointer">✕ Remove</button>
                        </div>
                        <div className="opacity-55 text-2xs mb-0.5">Connects rear chamber to front chamber — creates series bandpass behaviour.</div>
                        <div className="flex justify-between items-center">
                          <span className="opacity-60">Tuning (Fb)</span>
                          <div className="flex items-center gap-1">
                            <input type="number" value={activeProject.customTopology.internal_port.tuning_freq}
                              onChange={e => updateCustomInternalPort({ tuning_freq: parseFloat(e.target.value) || 0 })}
                              className="w-16 border rounded px-1.5 py-0.5 text-right font-mono focus:outline-none text-xs"
                              style={{ backgroundColor: "var(--sidebar-color)", borderColor: "var(--graph-grid-color)", color: "var(--accent-color)" }} />
                            <span className="opacity-60">Hz</span>
                          </div>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="opacity-60">Diameter</span>
                          <div className="flex items-center gap-1">
                            <input type="number" step="0.1" value={activeProject.customTopology.internal_port.diameter_cm}
                              onChange={e => updateCustomInternalPort({ diameter_cm: parseFloat(e.target.value) || 0 })}
                              className="w-16 border rounded px-1.5 py-0.5 text-right font-mono focus:outline-none text-xs"
                              style={{ backgroundColor: "var(--sidebar-color)", borderColor: "var(--graph-grid-color)", color: "var(--accent-color)" }} />
                            <span className="opacity-60">cm</span>
                          </div>
                        </div>
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
                        <div className="flex justify-between items-center">
                          <span className="opacity-70">Chamber Volume</span>
                          <div className="flex items-center gap-1">
                            <input type="number" value={activeProject.customTopology.front.volume_liters}
                              onChange={e => updateCustomFront({ volume_liters: parseFloat(e.target.value) || 0 })}
                              className="w-16 border rounded px-1.5 py-0.5 text-right font-mono focus:outline-none text-xs"
                              style={{ backgroundColor: "var(--bg-color)", borderColor: "var(--graph-grid-color)", color: "var(--accent-color)" }} />
                            <span className="opacity-60">L</span>
                          </div>
                        </div>

                        {/* Front port */}
                        {activeProject.customTopology.front.port ? (
                          <div className="border rounded p-2 flex flex-col gap-1.5" style={{ borderColor: "var(--graph-grid-color)", backgroundColor: "var(--bg-color)" }}>
                            <div className="flex justify-between items-center">
                              <span className="font-semibold opacity-75">Port → Outside</span>
                              <button onClick={() => updateCustomFront({ port: null })}
                                className="text-2xs opacity-50 hover:opacity-100 hover:text-red-400 transition cursor-pointer">✕ Remove</button>
                            </div>
                            <div className="flex justify-between items-center">
                              <span className="opacity-60">Tuning (Fb)</span>
                              <div className="flex items-center gap-1">
                                <input type="number" value={activeProject.customTopology.front.port.tuning_freq}
                                  onChange={e => updateCustomFrontPort({ tuning_freq: parseFloat(e.target.value) || 0 })}
                                  className="w-16 border rounded px-1.5 py-0.5 text-right font-mono focus:outline-none text-xs"
                                  style={{ backgroundColor: "var(--sidebar-color)", borderColor: "var(--graph-grid-color)", color: "var(--accent-color)" }} />
                                <span className="opacity-60">Hz</span>
                              </div>
                            </div>
                            <div className="flex justify-between items-center">
                              <span className="opacity-60">Diameter</span>
                              <div className="flex items-center gap-1">
                                <input type="number" step="0.1" value={activeProject.customTopology.front.port.diameter_cm}
                                  onChange={e => updateCustomFrontPort({ diameter_cm: parseFloat(e.target.value) || 0 })}
                                  className="w-16 border rounded px-1.5 py-0.5 text-right font-mono focus:outline-none text-xs"
                                  style={{ backgroundColor: "var(--sidebar-color)", borderColor: "var(--graph-grid-color)", color: "var(--accent-color)" }} />
                                <span className="opacity-60">cm</span>
                              </div>
                            </div>
                          </div>
                        ) : (
                          <button onClick={() => updateCustomFront({ port: DEFAULT_PORT, pr: null })}
                            className="text-left text-2xs opacity-60 hover:opacity-100 transition py-0.5 cursor-pointer hover:text-[var(--accent-color)]">
                            + Add Port to Outside
                          </button>
                        )}

                        {/* Front PR */}
                        {activeProject.customTopology.front.pr ? (
                          <div className="border rounded p-2 flex flex-col gap-1.5" style={{ borderColor: "var(--graph-grid-color)", backgroundColor: "var(--bg-color)" }}>
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
                              <div key={key} className="flex justify-between items-center">
                                <span className="opacity-60">{label}</span>
                                <div className="flex items-center gap-1">
                                  <input type="number" step="any" value={activeProject.customTopology.front.pr![key]}
                                    onChange={e => updateCustomFrontPR({ [key]: parseFloat(e.target.value) || 0 })}
                                    className="w-16 border rounded px-1.5 py-0.5 text-right font-mono focus:outline-none text-xs"
                                    style={{ backgroundColor: "var(--sidebar-color)", borderColor: "var(--graph-grid-color)", color: "var(--accent-color)" }} />
                                  {unit && <span className="opacity-60">{unit}</span>}
                                </div>
                              </div>
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
