import { CustomTopologySpec } from "../types";

// ── Topology diagram shown inside the Custom Topology Builder ──
export default function CustomTopologyDiagram({ topo }: { topo: CustomTopologySpec }) {
  const { rear, front, internal_port } = topo;
  const hasFront = front.volume_liters > 0;

  const Block = ({ label, sub, dim }: { label: string; sub?: string; dim?: boolean }) => (
    <div className={`flex flex-col items-center justify-center border rounded px-1.5 py-1 min-w-0 ${dim ? "opacity-40" : ""}`}
      style={{ borderColor: "var(--graph-grid-color)", backgroundColor: "var(--bg-color)", fontSize: 11, lineHeight: 1.3 }}>
      <span className="font-bold truncate">{label}</span>
      {sub && <span className="opacity-60 truncate">{sub}</span>}
    </div>
  );

  const Arrow = ({ label, vertical }: { label?: string; vertical?: boolean }) => (
    <div className={`flex items-center justify-center ${vertical ? "flex-col" : ""} shrink-0`}
      style={{ color: "var(--accent-color)", fontSize: 11, gap: 1, opacity: 0.75 }}>
      {label && !vertical && <span>{label}</span>}
      <span>{vertical ? "↓" : "→"}</span>
      {label && vertical && <span>{label}</span>}
    </div>
  );

  return (
    <div className="border rounded p-2 flex flex-col gap-1.5"
      style={{ borderColor: "var(--graph-grid-color)", backgroundColor: "var(--bg-color)", fontSize: 11 }}>
      {/* Top row: [OUTSIDE?] ← Port ← Rear Ch ← DRIVER → FrontCh/Air → Port → OUTSIDE */}
      <div className="flex items-center gap-1 justify-center flex-wrap">
        {/* Rear side: outward path */}
        {rear.port && <>
          <Block label="OUTSIDE" />
          <Arrow label={`${rear.port.tuning_freq}Hz`} />
        </>}
        {rear.pr && <>
          <Block label="OUTSIDE" />
          <Arrow label="PR" />
        </>}
        <Block label={`Rear Ch.`} sub={`${rear.volume_liters}L`} />

        {/* Driver */}
        <div className="flex items-center gap-0.5 shrink-0">
          <span style={{ color: "var(--accent-color)", fontSize: 11 }}>◉</span>
          <span className="font-bold" style={{ fontSize: 11 }}>DRV</span>
          <span style={{ color: "var(--accent-color)", fontSize: 11 }}>◉</span>
        </div>

        {/* Front side */}
        {hasFront ? (
          <>
            <Block label="Front Ch." sub={`${front.volume_liters}L`} />
            {front.port && <>
              <Arrow label={`${front.port.tuning_freq}Hz`} />
              <Block label="OUTSIDE" />
            </>}
            {front.pr && <>
              <Arrow label="PR" />
              <Block label="OUTSIDE" />
            </>}
            {!front.port && !front.pr && <Block label="Sealed" dim />}
          </>
        ) : (
          <>
            <Arrow />
            <Block label="OUTSIDE" sub="open air" />
          </>
        )}
      </div>

      {/* Internal port row */}
      {internal_port && (
        <div className="flex items-center justify-center gap-1" style={{ color: "var(--accent-color)" }}>
          <span style={{ fontSize: 11, opacity: 0.7 }}>↕ internal port {internal_port.tuning_freq}Hz</span>
        </div>
      )}
    </div>
  );
}
