import { Listbox, Button, ColorPicker, NumberField } from "../ui";
import { X } from "lucide-react";
import { CurveType } from "../../types";
import { CURVE_LABELS, selectableCurvesFor } from "../../lib/curveCatalogue";
import { PRESETS } from "../../theme";
import { clampMax, clampMin } from "./settingsClamp";
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
              <ColorPicker
                value={currentTheme.bgColor}
                onChange={(hex) => handleCustomColorChange("bgColor", hex)}
                label="Background"
              />
              <ColorPicker
                value={currentTheme.sidebarColor}
                onChange={(hex) => handleCustomColorChange("sidebarColor", hex)}
                label="Sidebar"
              />
              <ColorPicker
                value={currentTheme.textColor}
                onChange={(hex) => handleCustomColorChange("textColor", hex)}
                label="Text Color"
              />
              <ColorPicker
                value={currentTheme.accentColor}
                onChange={(hex) => handleCustomColorChange("accentColor", hex)}
                label="Highlight Accent"
              />
              <ColorPicker
                value={currentTheme.graphLineColor}
                onChange={(hex) => handleCustomColorChange("graphLineColor", hex)}
                label="Graph Line"
              />
              <ColorPicker
                value={currentTheme.graphGridColor}
                onChange={(hex) => handleCustomColorChange("graphGridColor", hex)}
                label="Graph Grid"
              />
              <ColorPicker
                value={currentTheme.textMutedColor}
                onChange={(hex) => handleCustomColorChange("textMutedColor", hex)}
                label="Muted Text"
              />
              <ColorPicker
                value={currentTheme.warningColor}
                onChange={(hex) => handleCustomColorChange("warningColor", hex)}
                label="Warning"
              />
              <ColorPicker
                value={currentTheme.dangerColor}
                onChange={(hex) => handleCustomColorChange("dangerColor", hex)}
                label="Danger"
              />
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
                {/* Clamped against each other, not just against a floor. Independent
                    clamps let both land on the same value, which collapses the log
                    span to zero and makes every curve vanish without an error. */}
                <NumberField
                  label="Global Min Freq (Hz)"
                  min={1}
                  max={globalXMax - 1}
                  value={globalXMin}
                  onChange={(v) => setGlobalXMin(clampMin(v, globalXMax))}
                />
                <NumberField
                  label="Global Max Freq (Hz)"
                  min={globalXMin + 1}
                  value={globalXMax}
                  onChange={(v) => setGlobalXMax(clampMax(v, globalXMin))}
                />
              </div>
            </div>

            {/* Select graph to edit */}
            <Listbox
              label="Select Curve to Calibrate"
              value={configEditType}
              onChange={(val) => setConfigEditType(val as CurveType)}
              options={selectableCurvesFor(activeProject.enclosureType).map((c) => ({
                value: c,
                label: CURVE_LABELS[c],
              }))}
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
                  <NumberField
                    label="X-Axis Min Frequency (Hz)"
                    min={1}
                    max={graphConfigs[configEditType].xMax - 1}
                    value={graphConfigs[configEditType].xMin}
                    onChange={(v) => updateViewportConfig(configEditType, "xMin",
                      clampMin(v, graphConfigs[configEditType].xMax))}
                  />
                  <NumberField
                    label="X-Axis Max Frequency (Hz)"
                    min={graphConfigs[configEditType].xMin + 1}
                    value={graphConfigs[configEditType].xMax}
                    onChange={(v) => updateViewportConfig(configEditType, "xMax",
                      clampMax(v, graphConfigs[configEditType].xMin))}
                  />
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
                    <NumberField
                      label={`Y-Axis Floor (${yUnit})`}
                      value={graphConfigs[configEditType].yMin}
                      onChange={(v) => updateViewportConfig(configEditType, "yMin", v)}
                    />
                    <NumberField
                      label={`Y-Axis Ceiling (${yUnit})`}
                      value={graphConfigs[configEditType].yMax}
                      onChange={(v) => updateViewportConfig(configEditType, "yMax", v)}
                    />
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
