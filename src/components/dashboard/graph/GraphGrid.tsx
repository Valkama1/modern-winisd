import { GraphGeometry, PADDING } from "./graphGeometry";

const { left: paddingLeft, right: paddingRight, top: paddingTop, bottom: paddingBottom } =
  PADDING;

/**
 * Log-spaced frequency gridlines and the value axis. Depends only on the geometry.
 */
export default function GraphGrid({ geo }: { geo: GraphGeometry }) {
  const { getX, getY, width, height, xGridFreqs, yGridDbs, mode } = geo;
  const isSpl = mode === "spl";

  return (
    <>
      {/* Grid - Horizontal lines */}
      {yGridDbs.map((db) => {
        const y = getY(db);
        const isZeroLine = !isSpl && db === 0;
        return (
          <g key={`y-grid-${mode}-${db}`}>
            <line
              x1={paddingLeft}
              y1={y}
              x2={width - paddingRight}
              y2={y}
              stroke="var(--graph-grid-color)"
              strokeWidth={isZeroLine ? 2 : 1}
              strokeDasharray={isZeroLine ? undefined : "3 3"}
            />
            <text
              x={paddingLeft - 8}
              y={y + 3}
              fill="var(--text-color)"
              fontSize="9"
              textAnchor="end"
              className="font-mono opacity-70"
            >
              {db}
            </text>
          </g>
        );
      })}

      {/* Grid - Vertical lines */}
      {xGridFreqs.map((freq) => {
        const x = getX(freq);
        return (
          <g key={`x-grid-${mode}-${freq}`}>
            <line
              x1={x}
              y1={paddingTop}
              x2={x}
              y2={height - paddingBottom}
              stroke="var(--graph-grid-color)"
              strokeWidth={1}
              strokeDasharray="3 3"
            />
            <text
              x={x}
              y={height - paddingBottom + 16}
              fill="var(--text-color)"
              fontSize="9"
              textAnchor="middle"
              className="font-mono opacity-70"
            >
              {Math.round(freq)}
            </text>
          </g>
        );
      })}

    </>
  );
}
