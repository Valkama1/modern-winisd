import { useState } from "react";
import { CollapsibleSection, Listbox, NumberField, NumberRow } from "../ui";
import { EqFilter, SpeakerPos } from "../../types";
import { useProjectsContext } from "../../context/ProjectsContext";
import { useSignalProcessingContext } from "../../context/SignalProcessingContext";
import { useModalsContext } from "../../context/ModalsContext";

const SPEAKER_COLORS = ["#10b981", "#f59e0b", "#ef4444", "#a855f7", "#06b6d4", "#ec4899"];

export default function SignalTab() {
  const { activeProject, updateActiveProject } = useProjectsContext();
  const {
    filters, setFilters, roomConfig, setRoomConfig,
    cabinConfig, setCabinConfig,
  } = useSignalProcessingContext();
  const { sidebarSectionState, toggleSidebarSection } = useModalsContext();
  const [roomDragging, setRoomDragging] = useState<{ type: "speaker"; idx: number } | { type: "listener" } | null>(null);

  return (
            <div className="flex flex-col gap-4">
              <CollapsibleSection
                title="SPL & Output Simulation"
                open={sidebarSectionState["spl-settings"]}
                onToggle={() => toggleSidebarSection("spl-settings")}
              >
              <NumberRow
                label="Total Input Power"
                unit="W"
                value={activeProject.inputPower}
                onChange={(v) => updateActiveProject({ inputPower: v })}
              />

              <NumberField
                label="Distance (m)"
                step={0.1}
                min={0.1}
                accent={false}
                value={activeProject.distance}
                onChange={(v) => updateActiveProject({ distance: v })}
              />

              <div>
                <label className="text-xs opacity-70 block mb-1">SPL Environment</label>
                <Listbox
                  value={activeProject.splEnvironment}
                  onChange={(val) => updateActiveProject({ splEnvironment: val as typeof activeProject.splEnvironment })}
                  buttonClassName="w-full border rounded px-2.5 py-1.5 text-xs focus:outline-none flex items-center justify-between gap-2 cursor-pointer text-left"
                  options={[
                    { value: "half_space", label: "Half-space — wall / floor mount" },
                    { value: "free_field", label: "Free-field — anechoic / elevated (−6 dB)" },
                    { value: "corner", label: "Corner placement — 3 boundaries (+12 dB)" },
                  ]}
                />
                <p className="text-2xs opacity-50 mt-1">Affects SPL curve only. Gain and excursion are unaffected.</p>
              </div>
              </CollapsibleSection>

              {/* ── EQ Filters ───────────────────────────────────────── */}
              <CollapsibleSection
                title="EQ Filters"
                open={sidebarSectionState["eq-filters"]}
                onToggle={() => toggleSidebarSection("eq-filters")}
                action={
                  <button
                    type="button"
                    onClick={() => setFilters(prev => [...prev, { id: `f-${Date.now()}`, enabled: true, type: "hp", freq: 80, q: 0.707, gain: 0 }])}
                    className="text-2xs px-2 py-0.5 rounded border transition hover:opacity-90 cursor-pointer"
                    style={{ borderColor: "var(--accent-color)", color: "var(--accent-color)", backgroundColor: "var(--bg-color)" }}
                  >
                    + Add
                  </button>
                }
              >
                {filters.length === 0 && (
                  <p className="text-2xs opacity-45 text-center py-1.5">No filters — add HP/LP or peak EQ to shape the response.</p>
                )}

                <div className="flex flex-col gap-2">
                  {filters.map((flt, idx) => (
                    <div
                      key={flt.id}
                      className="border rounded p-2 flex flex-col gap-1.5"
                      style={{ backgroundColor: "var(--bg-color)", borderColor: flt.enabled ? "var(--accent-color)" : "var(--border-color)" }}
                    >
                      <div className="flex items-center gap-1.5">
                        <input
                          type="checkbox" checked={flt.enabled}
                          onChange={e => setFilters(prev => prev.map((f, i) => i === idx ? { ...f, enabled: e.target.checked } : f))}
                          className="rounded accent-[var(--accent-color)] h-3 w-3 cursor-pointer shrink-0"
                        />
                        <Listbox
                          value={flt.type}
                          onChange={(val) => setFilters(prev => prev.map((f, i) => i === idx ? { ...f, type: val as EqFilter["type"] } : f))}
                          className="flex-1"
                          buttonClassName="w-full border rounded px-1 py-0.5 text-2xs focus:outline-none cursor-pointer flex items-center justify-between gap-1"
                          options={[
                            { value: "hp", label: "HP (2nd order)" },
                            { value: "lp", label: "LP (2nd order)" },
                            { value: "peak", label: "Peak EQ" },
                            { value: "lowshelf", label: "Low Shelf" },
                            { value: "highshelf", label: "High Shelf" },
                          ]}
                        />
                        <button
                          type="button"
                          onClick={() => setFilters(prev => prev.filter((_, i) => i !== idx))}
                          className="text-2xs opacity-50 hover:opacity-100 hover:text-red-400 transition shrink-0 cursor-pointer px-0.5"
                        >✕</button>
                      </div>
                      <div className="grid grid-cols-3 gap-1 text-2xs">
                        <NumberField
                          label="Freq (Hz)"
                          min={5}
                          max={20000}
                          step={1}
                          value={flt.freq}
                          onChange={(v) => setFilters(prev => prev.map((f, i) => i === idx ? { ...f, freq: v } : f))}
                        />
                        <NumberField
                          label="Q"
                          min={0.1}
                          max={20}
                          step={0.05}
                          value={flt.q}
                          onChange={(v) => setFilters(prev => prev.map((f, i) => i === idx ? { ...f, q: v } : f))}
                        />
                        {(flt.type === "peak" || flt.type === "lowshelf" || flt.type === "highshelf") ? (
                          <NumberField
                            label="Gain (dB)"
                            min={-30}
                            max={30}
                            step={0.5}
                            value={flt.gain}
                            onChange={(v) => setFilters(prev => prev.map((f, i) => i === idx ? { ...f, gain: v } : f))}
                          />
                        ) : <div />}
                      </div>
                    </div>
                  ))}
                </div>

                {filters.some(f => f.enabled) && (
                  <p className="text-2xs opacity-50 mt-1.5">— — dashed: filtered &nbsp;·· dotted: +room</p>
                )}
              </CollapsibleSection>

              {/* ── Passive Crossover ───────────────────────────────── */}
              <CollapsibleSection
                title="Passive Crossover"
                open={sidebarSectionState["passive-crossover"]}
                onToggle={() => toggleSidebarSection("passive-crossover")}
                action={
                  <button
                    type="button"
                    onClick={() => updateActiveProject({ passiveXoEnabled: !activeProject.passiveXoEnabled })}
                    className={`text-2xs font-bold px-2.5 py-0.5 rounded border transition cursor-pointer ${activeProject.passiveXoEnabled ? "border-[var(--accent-color)] text-[var(--accent-color)]" : "opacity-55 border-current"}`}
                    style={{ backgroundColor: "var(--bg-color)" }}
                  >
                    {activeProject.passiveXoEnabled ? "ON" : "OFF"}
                  </button>
                }
              >
                {!activeProject.passiveXoEnabled && (
                  <p className="text-2xs opacity-45 text-center py-1.5">Enable to simulate passive crossover network interaction with driver impedance.</p>
                )}

                {activeProject.passiveXoEnabled && (
                  <div className="flex flex-col gap-2.5 text-2xs">
                    {/* Validation Warning if Le is missing or 0 */}
                    {activeProject.driver.le <= 0 && (
                      <div className="p-2 rounded border text-2xs" style={{ backgroundColor: "var(--bg-color)", borderColor: "var(--warning-color)", color: "var(--warning-color)" }}>
                        ⚠ Driver inductance Le is 0. A typical ratio of {activeProject.driver.re > 0 ? (activeProject.driver.re * 0.15).toFixed(2) : "0.60"} mH will be estimated.
                      </div>
                    )}

                    <div className="flex flex-col gap-1">
                      <span className="opacity-55">Crossover Type</span>
                      <Listbox
                        value={activeProject.passiveXoType}
                        onChange={(passiveXoType) => updateActiveProject({ passiveXoType })}
                        buttonClassName="w-full border rounded px-2.5 py-1.5 text-xs focus:outline-none flex items-center justify-between gap-2 cursor-pointer text-left"
                        options={[
                          { value: "lowpass_1st", label: "1st-Order Lowpass (Inductor L)" },
                          { value: "highpass_1st", label: "1st-Order Highpass (Capacitor C)" },
                          { value: "lowpass_2nd", label: "2nd-Order Lowpass (L-C Network)" },
                          { value: "highpass_2nd", label: "2nd-Order Highpass (C-L Network)" },
                        ]}
                      />
                    </div>

                    <div className="grid grid-cols-3 gap-2">
                      {/* Inductance Input: shown for lowpass, or 2nd order highpass */}
                      {(activeProject.passiveXoType.includes("lowpass") || activeProject.passiveXoType.includes("2nd")) && (
                        <NumberField
                          label="Inductance (mH)"
                          min={0.01}
                          max={50}
                          step={0.05}
                          value={activeProject.passiveXoInductance}
                          onChange={(v) => updateActiveProject({ passiveXoInductance: v })}
                        />
                      )}

                      {/* Capacitance Input: shown for highpass, or 2nd order lowpass */}
                      {(activeProject.passiveXoType.includes("highpass") || activeProject.passiveXoType.includes("2nd")) && (
                        <NumberField
                          label="Capacitance (µF)"
                          min={0.1}
                          max={1000}
                          step={1.0}
                          value={activeProject.passiveXoCapacitance}
                          onChange={(v) => updateActiveProject({ passiveXoCapacitance: v })}
                        />
                      )}

                      {/* Inductor DCR Input: shown if inductance is shown */}
                      {(activeProject.passiveXoType.includes("lowpass") || activeProject.passiveXoType.includes("2nd")) && (
                        <NumberField
                          label="Inductor DCR (Ω)"
                          min={0.0}
                          max={10}
                          step={0.05}
                          value={activeProject.passiveXoDcr}
                          onChange={(v) => updateActiveProject({ passiveXoDcr: v })}
                        />
                      )}
                    </div>
                  </div>
                )}
              </CollapsibleSection>

              {/* ── Cabin Gain Estimation ───────────────────────────── */}
              <CollapsibleSection
                title="Cabin Gain"
                open={sidebarSectionState["cabin-gain"]}
                onToggle={() => toggleSidebarSection("cabin-gain")}
                action={
                  <button
                    type="button"
                    onClick={() => setCabinConfig(prev => ({ ...prev, enabled: !prev.enabled }))}
                    className={`text-2xs font-bold px-2.5 py-0.5 rounded border transition cursor-pointer ${cabinConfig.enabled ? "border-[var(--accent-color)] text-[var(--accent-color)]" : "opacity-55 border-current"}`}
                    style={{ backgroundColor: "var(--bg-color)" }}
                  >
                    {cabinConfig.enabled ? "ON" : "OFF"}
                  </button>
                }
              >
                {!cabinConfig.enabled && (
                  <p className="text-2xs opacity-45 text-center py-1.5">Enable to estimate vehicle pressure-zone cabin gain (12 dB/octave bass boost below F_cabin).</p>
                )}

                {cabinConfig.enabled && (
                  <div className="flex flex-col gap-2 text-2xs">
                    <NumberRow
                      label="Cabin Corner Freq (Hz)"
                      min={20}
                      max={150}
                      value={cabinConfig.fCabin}
                      onChange={(v) => setCabinConfig(prev => ({ ...prev, fCabin: Math.round(v) }))}
                    />
                    <p className="text-2xs opacity-55 mt-1">
                      Typical turn-over: Compact Cars: 70-80 Hz, Midsize: 60-70 Hz, Large SUVs: 40-50 Hz.
                    </p>
                  </div>
                )}
              </CollapsibleSection>

              {/* ── Room Simulation ──────────────────────────────────── */}
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

                    {/* ── Floor-plan drag editor ─────────────────────────── */}
                    <div>
                      <div className="flex justify-between items-center text-2xs mb-1.5">
                        <span className="opacity-55 font-semibold uppercase tracking-wider">
                          Floor Plan — drag speakers &amp; <span style={{ color: "#60a5fa" }}>L</span>
                        </span>
                        <div className="flex items-center gap-2">
                          <span className="opacity-35 text-2xs">top-down</span>
                          <button type="button"
                            onClick={() => setRoomConfig(p => {
                              const corners: SpeakerPos[] = [
                                { x: 0.5,             y: 0.5,           z: p.speakers[0]?.z ?? 0.9 },
                                { x: p.length - 0.5, y: 0.5,           z: p.speakers[0]?.z ?? 0.9 },
                                { x: 0.5,             y: p.width - 0.5, z: p.speakers[0]?.z ?? 0.9 },
                                { x: p.length - 0.5, y: p.width - 0.5, z: p.speakers[0]?.z ?? 0.9 },
                              ];
                              const next = p.speakers.length < 4
                                ? corners[p.speakers.length]
                                : { x: +(p.length / 2).toFixed(2), y: +(p.width / 2).toFixed(2), z: p.speakers[0]?.z ?? 0.9 };
                              return { ...p, speakers: [...p.speakers, next] };
                            })}
                            className="text-2xs px-1.5 py-0.5 rounded border transition cursor-pointer"
                            style={{ borderColor: "var(--accent-color)", color: "var(--accent-color)", backgroundColor: "var(--bg-color)" }}
                          >+ Speaker</button>
                        </div>
                      </div>
                      {(() => {
                        const SVG_W = 220;
                        const aspect = Math.min(2.2, Math.max(0.35, roomConfig.width / roomConfig.length));
                        const SVG_H = Math.round(SVG_W * aspect);
                        const PAD = 16;
                        const iW = SVG_W - 2 * PAD;
                        const iH = SVG_H - 2 * PAD;
                        const toSx = (rx: number) => PAD + Math.max(0, Math.min(1, rx / roomConfig.length)) * iW;
                        const toSy = (ry: number) => PAD + Math.max(0, Math.min(1, ry / roomConfig.width))  * iH;
                        const lstSx = toSx(roomConfig.listenerX);
                        const lstSy = toSy(roomConfig.listenerY);
                        const onMove = (e: React.MouseEvent<SVGSVGElement>) => {
                          if (!roomDragging) return;
                          const rect = e.currentTarget.getBoundingClientRect();
                          const sx = (e.clientX - rect.left) * (SVG_W / rect.width);
                          const sy = (e.clientY - rect.top)  * (SVG_H / rect.height);
                          const rx = parseFloat(Math.max(0.05, Math.min(roomConfig.length - 0.05, ((sx - PAD) / iW) * roomConfig.length)).toFixed(2));
                          const ry = parseFloat(Math.max(0.05, Math.min(roomConfig.width  - 0.05, ((sy - PAD) / iH) * roomConfig.width)).toFixed(2));
                          if (roomDragging.type === "listener") {
                            setRoomConfig(p => ({ ...p, listenerX: rx, listenerY: ry }));
                          } else {
                            const i = roomDragging.idx;
                            setRoomConfig(p => ({ ...p, speakers: p.speakers.map((s, si) => si === i ? { ...s, x: rx, y: ry } : s) }));
                          }
                        };
                        const gridStep = roomConfig.length > 12 ? 2 : 1;
                        const gxs = Array.from({ length: Math.floor(roomConfig.length / gridStep) - 1 }, (_, i) => (i + 1) * gridStep);
                        const gys = Array.from({ length: Math.floor(roomConfig.width  / gridStep) - 1 }, (_, i) => (i + 1) * gridStep);
                        return (
                          <svg viewBox={`0 0 ${SVG_W} ${SVG_H}`}
                            className="w-full rounded border select-none"
                            style={{
                              borderColor: "var(--border-color)",
                              backgroundColor: "var(--bg-color)",
                              cursor: roomDragging ? "grabbing" : "default",
                              maxHeight: "220px",
                            }}
                            onMouseMove={onMove}
                            onMouseUp={() => setRoomDragging(null)}
                            onMouseLeave={() => setRoomDragging(null)}
                          >
                            <rect x={PAD} y={PAD} width={iW} height={iH} fill="var(--sidebar-color)" opacity={0.7} />
                            {gxs.map(gx => (
                              <line key={`gx${gx}`} x1={toSx(gx)} y1={PAD} x2={toSx(gx)} y2={PAD + iH}
                                stroke="var(--border-color)" strokeWidth={0.5} opacity={0.45} />
                            ))}
                            {gys.map(gy => (
                              <line key={`gy${gy}`} x1={PAD} y1={toSy(gy)} x2={PAD + iW} y2={toSy(gy)}
                                stroke="var(--border-color)" strokeWidth={0.5} opacity={0.45} />
                            ))}
                            <rect x={PAD} y={PAD} width={iW} height={iH}
                              fill="none" stroke="var(--border-color)" strokeWidth={1.5} />
                            <text x={SVG_W / 2} y={PAD - 3} textAnchor="middle" fontSize={7}
                              fill="var(--text-color)" opacity={0.45}>{roomConfig.length} m</text>
                            <text x={5} y={SVG_H / 2} textAnchor="middle" fontSize={7}
                              fill="var(--text-color)" opacity={0.45}
                              transform={`rotate(-90, 5, ${SVG_H / 2})`}>{roomConfig.width} m</text>
                            {/* Speaker→listener lines */}
                            {roomConfig.speakers.map((spk, si) => (
                              <line key={`dl${si}`}
                                x1={toSx(spk.x)} y1={toSy(spk.y)} x2={lstSx} y2={lstSy}
                                stroke={SPEAKER_COLORS[si % SPEAKER_COLORS.length]}
                                strokeWidth={0.75} strokeDasharray="3 3" opacity={0.25} />
                            ))}
                            {/* Speaker markers */}
                            {roomConfig.speakers.map((spk, si) => {
                              const col = SPEAKER_COLORS[si % SPEAKER_COLORS.length];
                              const cx = toSx(spk.x);
                              const cy = toSy(spk.y);
                              const active = roomDragging?.type === "speaker" && roomDragging.idx === si;
                              const lbl = roomConfig.speakers.length === 1 ? "S" : `S${si + 1}`;
                              return (
                                <g key={`spk${si}`}>
                                  <circle cx={cx} cy={cy} r={9}
                                    fill={active ? `${col}80` : `${col}30`}
                                    stroke={col} strokeWidth={1.5}
                                    style={{ cursor: "grab" }}
                                    onMouseDown={e => { e.preventDefault(); setRoomDragging({ type: "speaker", idx: si }); }}
                                  />
                                  <text x={cx} y={cy + 4} textAnchor="middle" fontSize={roomConfig.speakers.length < 10 ? 7 : 6}
                                    fontWeight="bold" fill={col} style={{ pointerEvents: "none" }}>{lbl}</text>
                                </g>
                              );
                            })}
                            {/* Listener marker */}
                            <circle cx={lstSx} cy={lstSy} r={9}
                              fill={roomDragging?.type === "listener" ? "#60a5fa80" : "#60a5fa30"}
                              stroke="#60a5fa" strokeWidth={1.5}
                              style={{ cursor: "grab" }}
                              onMouseDown={e => { e.preventDefault(); setRoomDragging({ type: "listener" }); }}
                            />
                            <text x={lstSx} y={lstSy + 4} textAnchor="middle" fontSize={8}
                              fontWeight="bold" fill="#60a5fa" style={{ pointerEvents: "none" }}>L</text>
                          </svg>
                        );
                      })()}
                    </div>

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
            </div>
  );
}
