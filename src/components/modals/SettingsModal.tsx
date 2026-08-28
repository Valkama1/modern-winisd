import { Listbox, Button } from "../ui";
import { X } from "lucide-react";
import { CurveType } from "../../types";
import { PRESETS } from "../../theme";
import { useModalsContext } from "../../context/ModalsContext";
import { useThemeContext } from "../../context/ThemeContext";
import { useProjectsContext } from "../../context/ProjectsContext";
import { useGraphViewportContext } from "../../context/GraphViewportContext";

export default function SettingsModal() {
  const { showSettings, setShowSettings } = useModalsContext();
  const { currentTheme, setCurrentTheme, handleCustomColorChange, activePresetKey } = useThemeContext();
  const { activeProject } = useProjectsContext();
  const {
    configEditType, setConfigEditType, graphConfigs, updateViewportConfig,
    globalXMin, setGlobalXMin, globalXMax, setGlobalXMax,
    overrideXLimits, setOverrideXLimits,
  } = useGraphViewportContext();

  if (!showSettings) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-6 overflow-y-auto animate-fadeIn" style={{ color: "var(--text-color)" }}>
      <div className="border w-full max-w-lg rounded-xl shadow-2xl overflow-hidden flex flex-col my-8" style={{ backgroundColor: "var(--sidebar-color)", borderColor: "var(--border-color)" }}>
        <div className="p-5 border-b flex items-center justify-between" style={{ borderColor: "var(--border-color)" }}>
          <h3 className="text-lg font-bold">App Settings</h3>
          <button
            onClick={() => setShowSettings(false)}
            className="p-1 rounded transition cursor-pointer opacity-70 hover:opacity-100"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-6 flex flex-col gap-6 max-h-[70vh] overflow-y-auto">
          {/* Theme Settings */}
          <div className="flex flex-col gap-4 border-b pb-5" style={{ borderColor: "var(--border-color)" }}>
            <h4 className="text-sm font-bold uppercase tracking-wider" style={{ color: "var(--accent-color)" }}>Appearance & Color Customizer</h4>

            {/* Theme presets */}
            <Listbox
              label="Theme Presets"
              value={activePresetKey}
              onChange={(val) => {
                if (val && val !== "custom") {
                  setCurrentTheme(PRESETS[val]);
                }
              }}
              options={[
                ...Object.keys(PRESETS).map((key) => ({ value: key, label: PRESETS[key].name })),
                ...(activePresetKey === "custom" ? [{ value: "custom", label: "Custom Theme" }] : []),
              ]}
            />

            {/* Customizer grid */}
            <div className="grid grid-cols-2 gap-4 text-xs">
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={currentTheme.bgColor}
                  onChange={(e) => handleCustomColorChange("bgColor", e.target.value)}
                  className="w-7 h-7 rounded border bg-transparent cursor-pointer"
                  style={{ borderColor: "var(--border-color)" }}
                />
                <span>Background</span>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={currentTheme.sidebarColor}
                  onChange={(e) => handleCustomColorChange("sidebarColor", e.target.value)}
                  className="w-7 h-7 rounded border bg-transparent cursor-pointer"
                  style={{ borderColor: "var(--border-color)" }}
                />
                <span>Sidebar</span>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={currentTheme.textColor}
                  onChange={(e) => handleCustomColorChange("textColor", e.target.value)}
                  className="w-7 h-7 rounded border bg-transparent cursor-pointer"
                  style={{ borderColor: "var(--border-color)" }}
                />
                <span>Text Color</span>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={currentTheme.accentColor}
                  onChange={(e) => handleCustomColorChange("accentColor", e.target.value)}
                  className="w-7 h-7 rounded border bg-transparent cursor-pointer"
                  style={{ borderColor: "var(--border-color)" }}
                />
                <span>Highlight Accent</span>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={currentTheme.graphLineColor}
                  onChange={(e) => handleCustomColorChange("graphLineColor", e.target.value)}
                  className="w-7 h-7 rounded border bg-transparent cursor-pointer"
                  style={{ borderColor: "var(--border-color)" }}
                />
                <span>Graph Line</span>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={currentTheme.graphGridColor}
                  onChange={(e) => handleCustomColorChange("graphGridColor", e.target.value)}
                  className="w-7 h-7 rounded border bg-transparent cursor-pointer"
                  style={{ borderColor: "var(--border-color)" }}
                />
                <span>Graph Grid</span>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={currentTheme.textMutedColor}
                  onChange={(e) => handleCustomColorChange("textMutedColor", e.target.value)}
                  className="w-7 h-7 rounded border bg-transparent cursor-pointer"
                  style={{ borderColor: "var(--border-color)" }}
                />
                <span>Muted Text</span>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={currentTheme.warningColor}
                  onChange={(e) => handleCustomColorChange("warningColor", e.target.value)}
                  className="w-7 h-7 rounded border bg-transparent cursor-pointer"
                  style={{ borderColor: "var(--border-color)" }}
                />
                <span>Warning</span>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={currentTheme.dangerColor}
                  onChange={(e) => handleCustomColorChange("dangerColor", e.target.value)}
                  className="w-7 h-7 rounded border bg-transparent cursor-pointer"
                  style={{ borderColor: "var(--border-color)" }}
                />
                <span>Danger</span>
              </div>
            </div>
          </div>

          {/* Calibration Settings for Graph Viewport limits */}
          <div className="flex flex-col gap-4">
            <h4 className="text-sm font-bold uppercase tracking-wider" style={{ color: "var(--accent-color)" }}>Graph Viewport Calibration</h4>

            {/* Global X-Axis settings */}
            <div className="p-4 rounded border flex flex-col gap-3"
              style={{ backgroundColor: "var(--bg-color)", borderColor: "var(--border-color)" }}>
              <div className="text-xs font-semibold block opacity-70">Global X-Axis Limits</div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-2xs opacity-70 block mb-1">Global Min Freq (Hz)</label>
                  <input
                    type="number"
                    min="1"
                    value={globalXMin}
                    onChange={(e) => setGlobalXMin(Math.max(1, parseInt(e.target.value) || 10))}
                    className="w-full border rounded px-2.5 py-1.5 text-xs font-mono"
                    style={{ backgroundColor: "var(--bg-color)", borderColor: "var(--border-color)", color: "var(--text-color)" }}
                  />
                </div>
                <div>
                  <label className="text-2xs opacity-70 block mb-1">Global Max Freq (Hz)</label>
                  <input
                    type="number"
                    min="10"
                    value={globalXMax}
                    onChange={(e) => setGlobalXMax(Math.max(10, parseInt(e.target.value) || 2000))}
                    className="w-full border rounded px-2.5 py-1.5 text-xs font-mono"
                    style={{ backgroundColor: "var(--bg-color)", borderColor: "var(--border-color)", color: "var(--text-color)" }}
                  />
                </div>
              </div>
            </div>

            {/* Select graph to edit */}
            <Listbox
              label="Select Curve to Calibrate"
              value={configEditType}
              onChange={(val) => setConfigEditType(val as CurveType)}
              options={[
                { value: "transfer", label: "Gain (dB)" },
                { value: "spl", label: "SPL (dB SPL)" },
                { value: "phase", label: "Phase Response (°)" },
                { value: "group_delay", label: "Group Delay (ms)" },
                { value: "excursion", label: "Cone Excursion (mm)" },
                ...(activeProject.enclosureType !== "sealed" ? [{ value: "velocity", label: "Port Air Velocity (m/s)" }] : []),
                { value: "impedance", label: "System Impedance (Ω)" },
              ]}
            />

            <div className="p-4 rounded border flex flex-col gap-4"
              style={{ backgroundColor: "var(--bg-color)", borderColor: "var(--border-color)" }}>
              {/* Auto-Scale Y */}
              <div className="flex items-center justify-between border-b pb-3" style={{ borderColor: "var(--border-color)" }}>
                <div>
                  <span className="text-xs font-semibold block">Auto-Scale Y-Axis</span>
                  <span className="text-2xs opacity-60">Fits values dynamically to fit screen</span>
                </div>
                <button
                  type="button"
                  onClick={() => updateViewportConfig(configEditType, "autoScaleY", !graphConfigs[configEditType].autoScaleY)}
                  className="w-10 h-5.5 flex items-center rounded-full p-0.5 transition-colors duration-200 focus:outline-none cursor-pointer"
                  style={{ backgroundColor: graphConfigs[configEditType].autoScaleY ? "var(--accent-color)" : "var(--border-color)" }}
                >
                  <span
                    className={`bg-white w-4.5 h-4.5 rounded-full shadow transform transition-transform duration-200 ${
                      graphConfigs[configEditType].autoScaleY ? "translate-x-4.5" : "translate-x-0"
                     }`}
                  />
                </button>
              </div>

              {/* Override X Limits Toggle */}
              <div className="flex items-center justify-between border-b pb-3" style={{ borderColor: "var(--border-color)" }}>
                <div>
                  <span className="text-xs font-semibold block">Override Global X-Axis</span>
                  <span className="text-2xs opacity-60">Set custom min/max freq just for this curve</span>
                </div>
                <button
                  type="button"
                  onClick={() => setOverrideXLimits(prev => ({ ...prev, [configEditType]: !prev[configEditType] }))}
                  className="w-10 h-5.5 flex items-center rounded-full p-0.5 transition-colors duration-200 focus:outline-none cursor-pointer"
                  style={{ backgroundColor: overrideXLimits[configEditType] ? "var(--accent-color)" : "var(--border-color)" }}
                >
                  <span
                    className={`bg-white w-4.5 h-4.5 rounded-full shadow transform transition-transform duration-200 ${
                      overrideXLimits[configEditType] ? "translate-x-4.5" : "translate-x-0"
                    }`}
                  />
                </button>
              </div>

              {/* X Axis boundaries (Only visible if override is checked) */}
              {overrideXLimits[configEditType] ? (
                <div className="grid grid-cols-2 gap-3 animate-fadeIn">
                  <div>
                    <label className="text-2xs opacity-70 block mb-1">X-Axis Min Frequency (Hz)</label>
                    <input
                      type="number"
                      min="1"
                      value={graphConfigs[configEditType].xMin}
                      onChange={(e) => updateViewportConfig(configEditType, "xMin", Math.max(1, parseInt(e.target.value) || 10))}
                      className="w-full border rounded px-2.5 py-1.5 text-xs font-mono"
                      style={{ backgroundColor: "var(--bg-color)", borderColor: "var(--border-color)", color: "var(--text-color)" }}
                    />
                  </div>
                  <div>
                    <label className="text-2xs opacity-70 block mb-1">X-Axis Max Frequency (Hz)</label>
                    <input
                      type="number"
                      min="10"
                      value={graphConfigs[configEditType].xMax}
                      onChange={(e) => updateViewportConfig(configEditType, "xMax", Math.max(10, parseInt(e.target.value) || 2000))}
                      className="w-full border rounded px-2.5 py-1.5 text-xs font-mono"
                      style={{ backgroundColor: "var(--bg-color)", borderColor: "var(--border-color)", color: "var(--text-color)" }}
                    />
                  </div>
                </div>
              ) : (
                <div className="text-2xs opacity-60 font-medium italic py-2 text-center border rounded animate-fadeIn select-none" style={{ backgroundColor: "var(--bg-color)", borderColor: "var(--border-color)" }}>
                  Using global X-limits ({globalXMin} Hz - {globalXMax} Hz)
                </div>
              )}

              {/* Y Axis boundaries */}
              {!graphConfigs[configEditType].autoScaleY && (() => {
                const yUnit = configEditType === "phase"       ? "°"
                            : configEditType === "group_delay" ? "ms"
                            : configEditType === "excursion"   ? "mm"
                            : configEditType === "velocity"    ? "m/s"
                            : configEditType === "impedance"   ? "Ω"
                            : configEditType === "spl"         ? "dB SPL"
                            :                                    "dB";
                return (
                  <div className="grid grid-cols-2 gap-3 animate-fadeIn">
                    <div>
                      <label className="text-2xs opacity-70 block mb-1">Y-Axis Floor ({yUnit})</label>
                      <input
                        type="number"
                        value={graphConfigs[configEditType].yMin}
                        onChange={(e) => updateViewportConfig(configEditType, "yMin", parseFloat(e.target.value) || 0)}
                        className="w-full border rounded px-2.5 py-1.5 text-xs font-mono"
                      style={{ backgroundColor: "var(--bg-color)", borderColor: "var(--border-color)", color: "var(--text-color)" }}
                      />
                    </div>
                    <div>
                      <label className="text-2xs opacity-70 block mb-1">Y-Axis Ceiling ({yUnit})</label>
                      <input
                        type="number"
                        value={graphConfigs[configEditType].yMax}
                        onChange={(e) => updateViewportConfig(configEditType, "yMax", parseFloat(e.target.value) || 10)}
                        className="w-full border rounded px-2.5 py-1.5 text-xs font-mono"
                      style={{ backgroundColor: "var(--bg-color)", borderColor: "var(--border-color)", color: "var(--text-color)" }}
                      />
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>
        </div>

        <div className="p-5 border-t flex justify-end" style={{ borderColor: "var(--border-color)", backgroundColor: "var(--bg-color)" }}>
          <Button variant="primary" onClick={() => setShowSettings(false)}>
            Close Settings
          </Button>
        </div>
      </div>
    </div>
  );
}
