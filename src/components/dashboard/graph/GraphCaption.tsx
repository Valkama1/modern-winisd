import { memo } from "react";
import { Info } from "lucide-react";
import { CurveType } from "../../../types";
import { useProjectsContext } from "../../../context/ProjectsContext";

/**
 * The short explainer under each chart.
 */
function GraphCaption({ mode }: { mode: CurveType }) {
  const { activeProject } = useProjectsContext();

  return (
    <>
      {/* Individual Explainer caption */}
      <div className="flex gap-2 text-xs opacity-75 items-start">
        <Info className="h-4 w-4 mt-0.5 shrink-0" style={{ color: "var(--accent-color)" }} />
        {mode === "transfer_function" && (
          <p>
            What the enclosure alone contributes, measured against this same driver in
            free air. Because the driver appears on both sides, its voice coil, its
            sensitivity and the radiation model all cancel — leaving 0 dB where the box
            does nothing and showing its gain and rolloff directly. This is the form
            Thiele/Small alignment tables are written in, and it is the fair way to
            compare boxes built around different drivers.
          </p>
        )}
        {mode === "max_spl" && (
          <p>
            The highest level the system reaches at each frequency before it runs into
            whichever ceiling binds first: cone travel (Xmax = {activeProject.driver.xmax} mm)
            or the drivers' thermal rating ({activeProject.driver.pe}W each ×{" "}
            {activeProject.numDrivers}). Where excursion is the limit, more amplifier buys
            nothing. Assumes output tracks power; real drivers compress as they heat.
          </p>
        )}
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

// Static text for the curve; re-renders only when the curve or driver changes.
export default memo(GraphCaption);
