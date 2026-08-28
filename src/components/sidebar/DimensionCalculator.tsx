import { useState } from "react";
import { CollapsibleSection } from "../ui";
import { useProjectsContext } from "../../context/ProjectsContext";
import { useModalsContext } from "../../context/ModalsContext";

export default function DimensionCalculator() {
  const { updateActiveProject } = useProjectsContext();
  const { sidebarSectionState, toggleSidebarSection } = useModalsContext();

  const [calcMode, setCalcMode] = useState<"vb-to-dims" | "dims-to-vb">("vb-to-dims");
  const [calcVb, setCalcVb] = useState("150");
  const [calcRatioL, setCalcRatioL] = useState("1.618");
  const [calcRatioW, setCalcRatioW] = useState("1");
  const [calcRatioD, setCalcRatioD] = useState("0.618");
  const [calcExtL, setCalcExtL] = useState("60");
  const [calcExtW, setCalcExtW] = useState("40");
  const [calcExtD, setCalcExtD] = useState("35");
  const [calcThickness, setCalcThickness] = useState("18");

  return (
            <CollapsibleSection
              title="Dimension Calculator"
              open={sidebarSectionState["dimension-calculator"]}
              onToggle={() => toggleSidebarSection("dimension-calculator")}
            >
              {(() => {
                // ── Vb → LxWxD ──────────────────────────────────────────
                const vbNum   = parseFloat(calcVb)  || 0;
                const rL      = parseFloat(calcRatioL) || 1.618;
                void calcRatioW; // rW = 1 is the reference denominator; formula uses rL and rD only
                const rD      = parseFloat(calcRatioD) || 0.618;
                const vCm3    = vbNum * 1000;
                const wCalc   = vCm3 > 0 ? Math.cbrt(vCm3 / (rL * rD)) : 0;
                const lCalc   = wCalc * rL;
                const dCalc   = wCalc * rD;

                // ── Dims → Vb ───────────────────────────────────────────
                const thMm  = parseFloat(calcThickness) || 18;
                const extL  = parseFloat(calcExtL) || 0;
                const extW  = parseFloat(calcExtW) || 0;
                const extD  = parseFloat(calcExtD) || 0;
                const intL  = Math.max(0, extL - 2 * thMm / 10); // cm
                const intW  = Math.max(0, extW - 2 * thMm / 10);
                const intD  = Math.max(0, extD - 2 * thMm / 10);
                const grossVb = intL * intW * intD / 1000; // litres

                const inputStyle = {
                  backgroundColor: "var(--bg-color)",
                  borderColor: "var(--border-color)",
                  color: "var(--accent-color)",
                };
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
                        <div className="flex justify-between items-center">
                          <span className="opacity-70" style={labelStyle}>Box Volume</span>
                          <div className="flex items-center gap-1">
                            <input type="number" step="1" value={calcVb} onChange={e => setCalcVb(e.target.value)}
                              className="w-16 border rounded px-1.5 py-0.5 text-right font-mono focus:outline-none"
                              style={inputStyle} />
                            <span className="opacity-60">L</span>
                          </div>
                        </div>
                        <div className="grid grid-cols-3 gap-1.5">
                          {[["L ratio", calcRatioL, setCalcRatioL], ["W ratio", calcRatioW, setCalcRatioW], ["D ratio", calcRatioD, setCalcRatioD]].map(([lbl, val, set]) => (
                            <div key={String(lbl)} className="flex flex-col gap-0.5">
                              <span className="opacity-60 text-2xs" style={labelStyle}>{String(lbl)}</span>
                              <input type="number" step="0.01" value={String(val)}
                                onChange={e => (set as (v: string) => void)(e.target.value)}
                                className="w-full border rounded px-1.5 py-0.5 text-right font-mono focus:outline-none text-2xs"
                                style={inputStyle} />
                            </div>
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
                          onClick={() => updateActiveProject({ vBox: vbNum })}
                          className="text-2xs opacity-70 hover:opacity-100 cursor-pointer text-left transition"
                          style={{ color: "var(--accent-color)" }}>
                          ↩ Apply {calcVb} L to active project
                        </button>
                      </div>
                    ) : (
                      <div className="flex flex-col gap-2 text-xs">
                        <div className="grid grid-cols-3 gap-1.5">
                          {[["L (cm)", calcExtL, setCalcExtL], ["W (cm)", calcExtW, setCalcExtW], ["D (cm)", calcExtD, setCalcExtD]].map(([lbl, val, set]) => (
                            <div key={String(lbl)} className="flex flex-col gap-0.5">
                              <span className="opacity-60 text-2xs" style={labelStyle}>{String(lbl)}</span>
                              <input type="number" step="0.5" value={String(val)}
                                onChange={e => (set as (v: string) => void)(e.target.value)}
                                className="w-full border rounded px-1.5 py-0.5 text-right font-mono focus:outline-none text-2xs"
                                style={inputStyle} />
                            </div>
                          ))}
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="opacity-70" style={labelStyle}>Panel thickness</span>
                          <div className="flex items-center gap-1">
                            <input type="number" step="1" value={calcThickness} onChange={e => setCalcThickness(e.target.value)}
                              className="w-14 border rounded px-1.5 py-0.5 text-right font-mono focus:outline-none"
                              style={inputStyle} />
                            <span className="opacity-60">mm</span>
                          </div>
                        </div>
                        <div className="rounded-lg p-2.5 flex flex-col gap-1 text-2xs font-mono border"
                          style={{ backgroundColor: "var(--sidebar-color)", borderColor: "var(--border-color)" }}>
                          <div className="flex justify-between">
                            <span className="opacity-60">Interior</span>
                            <span className="opacity-80">{intL.toFixed(1)} × {intW.toFixed(1)} × {intD.toFixed(1)} cm</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="opacity-60">Gross Vb</span>
                            <span style={{ color: "var(--accent-color)" }}>{grossVb.toFixed(2)} L</span>
                          </div>
                        </div>
                        <button
                          onClick={() => updateActiveProject({ vBox: parseFloat(grossVb.toFixed(2)) })}
                          className="text-2xs opacity-70 hover:opacity-100 cursor-pointer text-left transition"
                          style={{ color: "var(--accent-color)" }}>
                          ↩ Apply {grossVb.toFixed(2)} L to active project
                        </button>
                      </div>
                    )}
                  </>
                );
              })()}
            </CollapsibleSection>
  );
}
