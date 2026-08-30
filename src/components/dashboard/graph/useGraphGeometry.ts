import { useMemo } from "react";
import { CurveType } from "../../../types";
import { useProjectsContext } from "../../../context/ProjectsContext";
import { useGraphViewportContext } from "../../../context/GraphViewportContext";
import { useSimulationContext } from "../../../context/SimulationContext";
import {
  GraphGeometry,
  PADDING,
  axisTitle,
  axisUnit,
  clampYRange,
  makeScales,
  xTicks,
  yTicks,
} from "./graphGeometry";

/**
 * Resolve the chart's canvas, visible range and scales for one curve.
 *
 * Autoscaling has to consider the filter and environment overlays as well as the raw
 * curve, or an EQ boost draws outside the axes it was scaled to.
 */
export function useGraphGeometry(mode: CurveType): GraphGeometry & {
  freqAtX: (x: number) => number;
} {
  const { projects } = useProjectsContext();
  const { dashboardWidth, graphHeights, graphConfigs, getGraphXLimits } =
    useGraphViewportContext();
  const {
    simulationResults, phaseGdData,
    filterGainFn, roomCorrectionFn, filterLinearFn, cabinGainFn,
  } = useSimulationContext();

  const height = graphHeights[mode];
  const cfg = graphConfigs[mode];
  // Read the limits out here: getGraphXLimits is a fresh closure every render, so
  // depending on the function itself would invalidate the memo on every frame.
  const { xMin: fMin, xMax: fMax } = getGraphXLimits(mode);

  return useMemo(() => {
  const width = dashboardWidth;
  const chartWidth = width - PADDING.left - PADDING.right;
  const chartHeight = height - PADDING.top - PADDING.bottom;

  let minVal = 0;
  let maxVal = 10;
  let hasAnyPoints = false;

  projects.filter((p) => p.showOnGraph).forEach((project) => {
    const pts =
      (mode === "phase" ? phaseGdData[project.id]?.phase
       : mode === "group_delay" ? phaseGdData[project.id]?.group_delay
       : simulationResults[project.id]?.[mode]) || [];
    if (pts.length === 0) return;

    let projectMin = Infinity;
    let projectMax = -Infinity;
    for (const pt of pts) {
      const base = pt.db;
      let vFlt = base;
      let vEnv = base;

      if (mode === "spl" || mode === "transfer") {
        const fGain = filterGainFn ? filterGainFn(pt.frequency) : 0;
        const rGain = roomCorrectionFn ? roomCorrectionFn(pt.frequency) : 0;
        const cGain = cabinGainFn ? cabinGainFn(pt.frequency) : 0;
        vFlt = base + fGain;
        vEnv = base + fGain + rGain + cGain;
      } else if (mode === "excursion" || mode === "velocity") {
        const fLin = filterLinearFn ? filterLinearFn(pt.frequency) : 1;
        vFlt = base * fLin;
        vEnv = vFlt;
      }

      projectMin = Math.min(projectMin, base, vFlt, vEnv);
      projectMax = Math.max(projectMax, base, vFlt, vEnv);
    }

    if (!hasAnyPoints) {
      minVal = projectMin;
      maxVal = projectMax;
      hasAnyPoints = true;
    } else {
      minVal = Math.min(minVal, projectMin);
      maxVal = Math.max(maxVal, projectMax);
    }
  });

  const { dbMin, dbMax } = cfg.autoScaleY
    ? clampYRange(mode, minVal, maxVal)
    : { dbMin: cfg.yMin, dbMax: cfg.yMax };

  const { getX, getY, freqAtX } = makeScales(
    chartWidth, chartHeight, fMin, fMax, dbMin, dbMax,
  );

  return {
    mode,
    width,
    height,
    chartWidth,
    chartHeight,
    fMin,
    fMax,
    dbMin,
    dbMax,
    getX,
    getY,
    freqAtX,
    xGridFreqs: xTicks(fMin, fMax),
    yGridDbs: yTicks(dbMin, dbMax),
    unit: axisUnit(mode),
    title: axisTitle(mode),
  };
  // Hovering changes viewport context on every pointer move. Without this memo the
  // scan below — every point of every project, through the gain functions — and every
  // downstream path string would be rebuilt at pointer-event rate.
  }, [
    mode, dashboardWidth, height, cfg, fMin, fMax,
    projects, simulationResults, phaseGdData,
    filterGainFn, roomCorrectionFn, filterLinearFn, cabinGainFn,
  ]);
}
