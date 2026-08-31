import { useState } from "react";
import { CollapsibleSection, NumberField, NumberRow } from "../ui";
import { useProjectsContext } from "../../context/ProjectsContext";
import { useModalsContext } from "../../context/ModalsContext";
import { occupiedVolumeLitres } from "../../lib/enclosureVolume";

export default function DimensionCalculator() {
  const { activeProject, updateActiveProject } = useProjectsContext();
  const { sidebarSectionState, toggleSidebarSection } = useModalsContext();

  const [calcMode, setCalcMode] = useState<"vb-to-dims" | "dims-to-vb">("vb-to-dims");
  const [calcVb, setCalcVb] = useState(150);
  const [calcRatioL, setCalcRatioL] = useState(1.618);
  const [calcRatioW, setCalcRatioW] = useState(1);
  const [calcRatioD, setCalcRatioD] = useState(0.618);
  const [calcExtL, setCalcExtL] = useState(60);
  const [calcExtW, setCalcExtW] = useState(40);
  const [calcExtD, setCalcExtD] = useState(35);
  const [calcThickness, setCalcThickness] = useState(18);

  return (
            <CollapsibleSection
              title="Dimension Calculator"
              open={sidebarSectionState["dimension-calculator"]}
              onToggle={() => toggleSidebarSection("dimension-calculator")}
            >
              {(() => {
                // ── Vb → LxWxD ──────────────────────────────────────────
                // vBox is net air behind the cone, so a cabinet sized to exactly that
                // would come up short once the driver and ducts are inside it.
                const occupied = occupiedVolumeLitres(activeProject);
                const vbNum   = calcVb + occupied;
                const rL      = calcRatioL;
                void calcRatioW; // rW = 1 is the reference denominator; formula uses rL and rD only
                const rD      = calcRatioD;
                const vCm3    = vbNum * 1000;
                const wCalc   = vCm3 > 0 ? Math.cbrt(vCm3 / (rL * rD)) : 0;
                const lCalc   = wCalc * rL;
                const dCalc   = wCalc * rD;

                // ── Dims → Vb ───────────────────────────────────────────
                const thMm  = calcThickness;
                const extL  = calcExtL;
                const extW  = calcExtW;
                const extD  = calcExtD;
                const intL  = Math.max(0, extL - 2 * thMm / 10); // cm
                const intW  = Math.max(0, extW - 2 * thMm / 10);
                const intD  = Math.max(0, extD - 2 * thMm / 10);
                const grossVb = intL * intW * intD / 1000; // litres
                const netVb = Math.max(0, grossVb - occupied);

                const labelStyle = { color: "var(--text-color)" };

                return (
                  <>
                    {/* Mode tabs */}
                    <div className="flex text-2xs rounded overflow-hidden border" style={{ borderColor: "var(--border-color)" }}>
                      {(["vb-to-dims", "dims-to-vb"] as const).map(m => (
                        <button key={m} onClick={() => setCalcMode(m)}
                          className={`flex-1 py-1.5 font-semibold cursor-pointer transition ${calcMode === m ? "text-white" : "opacity-60 hover:opacity-100"}`}
                          style={calcMode === m ? { backgroundColor: "var(--accent-color)" } : labelStyle}>
                          {m === "vb-to-dims" ? "Vb → L×W×D" : "L×W×D → Vb"}
                        </button>
                      ))}
                    </div>

                    {calcMode === "vb-to-dims" ? (
                      <div className="flex flex-col gap-2 text-xs">
                        <NumberRow label="Net Vb (target)" unit="L" step={1} value={calcVb} onChange={setCalcVb} />
                        <p className="text-2xs opacity-55 leading-snug">
                          Interior dimensions below enclose {vbNum.toFixed(1)} L, leaving {calcVb.toFixed(1)} L
                          of air once the driver, radiator and ports take their {occupied.toFixed(1)} L.
                        </p>
                        <div className="grid grid-cols-3 gap-1.5">
                          {(
                            [
                              ["L ratio", calcRatioL, setCalcRatioL],
                              ["W ratio", calcRatioW, setCalcRatioW],
                              ["D ratio", calcRatioD, setCalcRatioD],
                            ] as const
                          ).map(([lbl, val, set]) => (
                            <NumberField key={lbl} label={lbl} step={0.01} value={val} onChange={set} />
                          ))}
                        </div>
                        <div className="rounded-lg p-2.5 flex flex-col gap-1 text-2xs font-mono border"
                          style={{ backgroundColor: "var(--sidebar-color)", borderColor: "var(--border-color)" }}>
                          <div className="flex justify-between">
                            <span className="opacity-60">Length</span>
                            <span style={{ color: "var(--accent-color)" }}>{lCalc.toFixed(1)} cm</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="opacity-60">Width</span>
                            <span style={{ color: "var(--accent-color)" }}>{wCalc.toFixed(1)} cm</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="opacity-60">Depth</span>
                            <span style={{ color: "var(--accent-color)" }}>{dCalc.toFixed(1)} cm</span>
                          </div>
                        </div>
                        <button
                          // vBox is the net figure — the sibling mode applies
                          // grossVb - occupied to it. vbNum is the gross interior the
                          // cabinet has to enclose, which is the right number for the
                          // dimensions above and the wrong one for this field: writing
                          // it here inflated the box by the driver and port
                          // displacement on every press, so Vb → dimensions → Vb drifted
                          // upward by `occupied` each round trip.
                          onClick={() => updateActiveProject({ vBox: calcVb })}
                          className="text-2xs opacity-70 hover:opacity-100 cursor-pointer text-left transition"
                          style={{ color: "var(--accent-color)" }}>
                          ↩ Apply {calcVb} L to active project
                        </button>
                      </div>
                    ) : (
                      <div className="flex flex-col gap-2 text-xs">
                        <div className="grid grid-cols-3 gap-1.5">
                          {(
                            [
                              ["L (cm)", calcExtL, setCalcExtL],
                              ["W (cm)", calcExtW, setCalcExtW],
                              ["D (cm)", calcExtD, setCalcExtD],
                            ] as const
                          ).map(([lbl, val, set]) => (
                            <NumberField key={lbl} label={lbl} step={0.5} value={val} onChange={set} />
                          ))}
                        </div>
                        <NumberRow label="Panel thickness" unit="mm" step={1} value={calcThickness} onChange={setCalcThickness} />
                        <div className="rounded-lg p-2.5 flex flex-col gap-1 text-2xs font-mono border"
                          style={{ backgroundColor: "var(--sidebar-color)", borderColor: "var(--border-color)" }}>
                          <div className="flex justify-between">
                            <span className="opacity-60">Interior</span>
                            <span className="opacity-80">{intL.toFixed(1)} × {intW.toFixed(1)} × {intD.toFixed(1)} cm</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="opacity-60">Interior volume</span>
                            <span className="opacity-80">{grossVb.toFixed(2)} L</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="opacity-60">Driver, radiator &amp; ports</span>
                            <span className="opacity-80">−{occupied.toFixed(2)} L</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="opacity-60">Net Vb</span>
                            <span style={{ color: "var(--accent-color)" }}>{netVb.toFixed(2)} L</span>
                          </div>
                        </div>
                        <button
                          onClick={() => updateActiveProject({ vBox: parseFloat(netVb.toFixed(2)) })}
                          className="text-2xs opacity-70 hover:opacity-100 cursor-pointer text-left transition"
                          style={{ color: "var(--accent-color)" }}>
                          ↩ Apply {netVb.toFixed(2)} L to active project
                        </button>
                      </div>
                    )}
                  </>
                );
              })()}
            </CollapsibleSection>
  );
}
