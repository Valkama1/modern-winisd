import { memo } from "react";
import { GraphGeometry, PADDING } from "../graphGeometry";

const { left: paddingLeft, right: paddingRight } = PADDING;

/**
 * Guides for the two curves read against a fixed scale rather than a level: phase
 * wraps at 0° and −180°, and the group-delay baseline.
 */
function PhaseReferences({ geo }: { geo: GraphGeometry }) {
  const { getY, width, dbMin: currentDbMin, dbMax: currentDbMax, mode } = geo;

  return (
    <>
    {/* PHASE: 0° and −180° horizontal guide lines */}
    {mode === "phase" && (() => {
      const lines: { val: number; label: string }[] = [
        { val: 0,    label: "0°"    },
        { val: -90,  label: "−90°"  },
        { val: -180, label: "−180°" },
        { val: -270, label: "−270°" },
        { val: -360, label: "−360°" },
      ];
      return (
        <g>
          {lines.filter(l => l.val >= currentDbMin && l.val <= currentDbMax).map(l => {
            const y = getY(l.val);
            return (
              <g key={l.val}>
                <line x1={paddingLeft} y1={y} x2={width - paddingRight} y2={y}
                  stroke="var(--accent-color)" strokeWidth={1}
                  strokeDasharray={l.val === 0 ? "6 3" : "3 5"} opacity={l.val === 0 ? 0.45 : 0.25} />
                <text x={paddingLeft + 4} y={y - 3} fill="var(--accent-color)"
                  fontSize={8} opacity={l.val === 0 ? 0.7 : 0.4}>{l.label}</text>
              </g>
            );
          })}
        </g>
      );
    })()}

    {/* GROUP DELAY: 0 ms base line */}
    {mode === "group_delay" && 0 >= currentDbMin && 0 <= currentDbMax && (() => {
      const y = getY(0);
      return (
        <line x1={paddingLeft} y1={y} x2={width - paddingRight} y2={y}
          stroke="var(--accent-color)" strokeWidth={1} strokeDasharray="4 4" opacity={0.3} />
      );
    })()}
    </>
  );
}

export default memo(PhaseReferences);
