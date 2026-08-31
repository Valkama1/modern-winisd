import { memo } from "react";
import { GraphGeometry, PADDING, RADIATION_DERIVED } from "./graphGeometry";
import { useSimulationContext } from "../../../context/SimulationContext";

const { top: paddingTop, right: paddingRight, bottom: paddingBottom } = PADDING;

/**
 * Shades the region where the radiation model stops applying.
 *
 * Above ka = 0.5 the cone is no longer a simple piston: it beams, and it breaks up.
 * The solver models neither, so the curve carries on flat or rising where a real
 * driver would be falling away. A line of warning text is easy to miss and does not
 * say *where* — this greys out the region so the curve is still readable but visibly
 * not to be trusted.
 *
 * Only for curves that come out of the radiation model. The transfer function divides
 * it out, and excursion, port velocity and impedance never involved it.
 */
function GraphModelLimit({ geo }: { geo: GraphGeometry }) {
  const { kaWarningFreq } = useSimulationContext();
  const { mode, getX, fMin, fMax, width, height } = geo;

  if (!RADIATION_DERIVED.includes(mode)) return null;
  // Nothing to mark if the limit falls outside what is on screen.
  if (!(kaWarningFreq > fMin && kaWarningFreq < fMax)) return null;

  const x = getX(kaWarningFreq);
  const right = width - paddingRight;
  const chartBottom = height - paddingBottom;
  if (right - x < 2) return null;

  return (
    <g style={{ pointerEvents: "none" }}>
      <rect
        x={x}
        y={paddingTop}
        width={right - x}
        height={chartBottom - paddingTop}
        fill="var(--sidebar-color)"
        opacity={0.62}
      />
      <line
        x1={x}
        y1={paddingTop}
        x2={x}
        y2={chartBottom}
        stroke="var(--text-color)"
        strokeWidth="1"
        strokeDasharray="3 3"
        opacity={0.35}
      />
      <text
        x={x + 6}
        y={paddingTop + 12}
        fill="var(--text-color)"
        fontSize="9"
        opacity={0.5}
        className="tracking-wide"
      >
        beyond piston model ({kaWarningFreq} Hz)
      </text>
    </g>
  );
}

// Depends only on the geometry and the driver's cone area, so it does not need to
// re-render while the pointer moves.
export default memo(GraphModelLimit);
