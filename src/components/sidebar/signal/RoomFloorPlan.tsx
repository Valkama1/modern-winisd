import { useState } from "react";
import { SpeakerPos } from "../../../types";
import { SPEAKER_COLORS } from "./speakerColors";
import { useSignalProcessingContext } from "../../../context/SignalProcessingContext";

/**
 * Plan view of the room with draggable speaker and listener markers.
 *
 * The drag state lives here rather than with the rest of the room settings, since
 * nothing outside this view needs to know what is being dragged.
 */
export default function RoomFloorPlan() {
  const { roomConfig, setRoomConfig } = useSignalProcessingContext();
  const [roomDragging, setRoomDragging] =
    useState<{ type: "speaker"; idx: number } | { type: "listener" } | null>(null);

  return (
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
  );
}
