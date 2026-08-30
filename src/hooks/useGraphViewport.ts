import { useEffect, useMemo, useRef, useState } from "react";
import { CurveType, GraphViewportConfig } from "../types";
import { loadSavedSession } from "../lib/session";
import { useModalsContext } from "../context/ModalsContext";

export function useGraphViewport() {
  const { showSettings } = useModalsContext();
  const savedSession = useMemo(() => loadSavedSession(), []);

  // Stacked Multi-Graph Dashboard States
  const [visibleGraphs, setVisibleGraphs] = useState<CurveType[]>(() => {
    return savedSession?.visibleGraphs || ["transfer", "spl"];
  });

  // Responsive & Resizable Heights properties
  const dashboardContainerRef = useRef<HTMLDivElement>(null);
  const [dashboardWidth, setDashboardWidth] = useState(800);
  const [graphHeights, setGraphHeights] = useState<Record<CurveType, number>>(() => {
    return savedSession?.graphHeights || {
      transfer: 250,
      spl: 250,
      excursion: 250,
      velocity: 250,
      impedance: 250,
      phase: 250,
      group_delay: 250,
    };
  });

  const handleResizeStart = (e: React.MouseEvent, mode: CurveType) => {
    e.preventDefault();
    const startY = e.clientY;
    const startHeight = graphHeights[mode];

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const deltaY = moveEvent.clientY - startY;
      setGraphHeights((prev) => ({
        ...prev,
        [mode]: Math.max(150, Math.min(600, startHeight + deltaY)),
      }));
    };

    const handleMouseUp = () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
  };

  // Viewport Configuration Limits per Graph Mode
  const [graphConfigs, setGraphConfigs] = useState<Record<CurveType, GraphViewportConfig>>(() => {
    const defaults: Record<CurveType, GraphViewportConfig> = {
      transfer:    { xMin: 10, xMax: 2000, yMin: -30,  yMax: 10,  autoScaleY: true  },
      spl:         { xMin: 10, xMax: 2000, yMin: 60,   yMax: 140, autoScaleY: true  },
      excursion:   { xMin: 10, xMax: 2000, yMin: 0,    yMax: 25,  autoScaleY: true  },
      velocity:    { xMin: 10, xMax: 2000, yMin: 0,    yMax: 40,  autoScaleY: true  },
      impedance:   { xMin: 10, xMax: 2000, yMin: 0,    yMax: 80,  autoScaleY: true  },
      phase:       { xMin: 10, xMax: 2000, yMin: -360, yMax: 45,  autoScaleY: false },
      group_delay: { xMin: 10, xMax: 2000, yMin: 0,    yMax: 100, autoScaleY: true  },
    };
    return { ...defaults, ...(savedSession?.graphConfigs || {}) };
  });

  const updateViewportConfig = (curve: CurveType, key: keyof GraphViewportConfig, value: any) => {
    setGraphConfigs((prev) => ({
      ...prev,
      [curve]: {
        ...prev[curve],
        [key]: value,
      },
    }));
  };

  // Global X-axis limits configuration states
  const [globalXMin, setGlobalXMin] = useState<number>(() => savedSession?.globalXMin || 10);
  const [globalXMax, setGlobalXMax] = useState<number>(() => savedSession?.globalXMax || 2000);
  const [overrideXLimits, setOverrideXLimits] = useState<Record<CurveType, boolean>>(() => {
    return savedSession?.overrideXLimits || {
      transfer: false,
      spl: false,
      excursion: false,
      velocity: false,
      impedance: false,
    };
  });

  const getGraphXLimits = (mode: CurveType) => {
    if (overrideXLimits[mode]) {
      return {
        xMin: graphConfigs[mode].xMin,
        xMax: graphConfigs[mode].xMax,
      };
    }
    return {
      xMin: globalXMin,
      xMax: globalXMax,
    };
  };

  // Settings sub-tab selection for editing limits
  const [configEditType, setConfigEditType] = useState<CurveType>("transfer");

  // Monitor dashboard container width to make graphs fully responsive
  useEffect(() => {
    if (!dashboardContainerRef.current) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setDashboardWidth(Math.max(400, entry.contentRect.width - 24));
      }
    });
    observer.observe(dashboardContainerRef.current);
    return () => observer.disconnect();
  }, []);

  // Synchronize calibration dropdown in settings with active graph view when settings opens
  useEffect(() => {
    if (showSettings && visibleGraphs.length > 0) {
      setConfigEditType(visibleGraphs[0]);
    }
  }, [showSettings, visibleGraphs]);

  return {
    visibleGraphs, setVisibleGraphs,
    dashboardContainerRef, dashboardWidth, graphHeights, handleResizeStart,
    graphConfigs, updateViewportConfig,
    globalXMin, setGlobalXMin, globalXMax, setGlobalXMax, overrideXLimits, setOverrideXLimits,
    getGraphXLimits, configEditType, setConfigEditType,
  };
}
