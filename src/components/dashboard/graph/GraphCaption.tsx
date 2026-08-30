import { Info } from "lucide-react";
import { CurveType } from "../../../types";
import { useProjectsContext } from "../../../context/ProjectsContext";

/**
 * The short explainer under each chart.
 */
export default function GraphCaption({ mode }: { mode: CurveType }) {
  const { activeProject } = useProjectsContext();

  return (
    <>
      {/* Individual Explainer caption */}
      <div className="flex gap-2 text-xs opacity-75 items-start">
        <Info className="h-4 w-4 mt-0.5 shrink-0" style={{ color: "var(--accent-color)" }} />
        {mode === "excursion" && (
          <p>
            Peak one-way displacement at {activeProject.inputPower}W. Keep it below the driver's linear limit (Xmax = {activeProject.driver.xmax} mm).
          </p>
        )}
        {mode === "velocity" && (
          <p>
            Vent air velocity should stay under 17 m/s to prevent port chuffing and compression.
          </p>
        )}
        {mode === "impedance" && (
          <p>
            Shows electrical cabinet loading including coil inductance Le = {activeProject.driver.le} mH. Saddle point marks Fb = {activeProject.tuningFreq}Hz.
          </p>
        )}
        {mode === "transfer" && (
          <p>
            Displays system alignment and roll-off slope (-12dB/octave closed, -24dB/octave ported).
          </p>
        )}
        {mode === "spl" && (
          <p>
            Predicts maximum acoustic output in dB SPL at {activeProject.distance}m under total load {activeProject.inputPower}W.
          </p>
        )}
      </div>
    </>
  );
}
