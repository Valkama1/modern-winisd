import { useEffect, useState } from "react";
import { CurveType } from "../../types";
import { useGraphViewportContext } from "../../context/GraphViewportContext";
import { useSimulationContext } from "../../context/SimulationContext";
import { useGraphGeometry } from "./graph/useGraphGeometry";
import GraphHeader from "./graph/GraphHeader";
import GraphLegend from "./graph/GraphLegend";
import GraphGrid from "./graph/GraphGrid";
import GraphCurves from "./graph/GraphCurves";
import GraphReferenceLines from "./graph/GraphReferenceLines";
import GraphRulerLayer from "./graph/GraphRulerLayer";
import GraphCaption from "./graph/GraphCaption";

/**
 * One response chart.
 *
 * This component owns the SVG shell, the ruler drag interaction and the layer order;
 * the geometry lives in useGraphGeometry and each layer draws itself from it.
 */
export default function GraphPanel({ mode }: { mode: CurveType }) {
  const { handleResizeStart, setRulerFreq, setHoveredFreq } = useGraphViewportContext();
  const { svgRefsMap } = useSimulationContext();

  // Draggable ruler state, local to this panel's own drag interaction.
  const [isDraggingRuler, setIsDraggingRuler] = useState(false);

  // Release the ruler on a global mouseup, so letting go outside the svg still ends it.
  useEffect(() => {
    if (!isDraggingRuler) return;
    const stop = () => setIsDraggingRuler(false);
    window.addEventListener("mouseup", stop);
    return () => window.removeEventListener("mouseup", stop);
  }, [isDraggingRuler]);

  const geo = useGraphGeometry(mode);
  const { width, height, fMin, fMax, freqAtX } = geo;

  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement, MouseEvent>) => {
    const svg = e.currentTarget;
    const pt = svg.createSVGPoint();
    pt.x = e.clientX;
    pt.y = e.clientY;
    const targetFreq = freqAtX(pt.matrixTransform(svg.getScreenCTM()?.inverse()).x);
    if (targetFreq < fMin || targetFreq > fMax) return;
    if (isDraggingRuler) setRulerFreq(targetFreq);
    else setHoveredFreq(targetFreq);
  };

  return (
    <div
      className="border rounded-xl p-5 flex flex-col gap-4 animate-fadeIn"
      style={{ backgroundColor: "var(--sidebar-color)", borderColor: "var(--border-color)" }}
    >
      <GraphHeader geo={geo} />

      {/* SVG Graph Canvas */}
      <div style={{ height: `${height}px` }} className="w-full bg-black/10 rounded-lg p-2">
        <svg
          ref={(el) => { if (el) svgRefsMap.current.set(mode, el); else svgRefsMap.current.delete(mode); }}
          viewBox={`0 0 ${width} ${height}`}
          className="w-full h-full select-none"
          onMouseMove={handleMouseMove}
          onMouseLeave={() => setHoveredFreq(null)}
        >
          <GraphLegend geo={geo} />

          <GraphGrid geo={geo} />
          <GraphCurves geo={geo} />
          <GraphReferenceLines geo={geo} />
          <GraphRulerLayer geo={geo} setIsDraggingRuler={setIsDraggingRuler} />
        </svg>
      </div>

      <GraphCaption mode={mode} />

      {/* Drag Resizer Handle Bar */}
      <div
        onMouseDown={(e) => handleResizeStart(e, mode)}
        className="h-3 w-full cursor-row-resize bg-transparent hover:bg-[var(--accent-color)]/10 active:bg-[var(--accent-color)]/20 border-t border-transparent hover:border-[var(--accent-color)]/10 rounded-b-xl transition flex items-center justify-center text-2xs tracking-widest opacity-60 hover:text-[var(--accent-color)] select-none mt-2"
      >
        ••••••••••••••••
      </div>
    </div>
  );
}
