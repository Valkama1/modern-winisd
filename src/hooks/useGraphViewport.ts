import { useEffect, useMemo, useRef, useState } from "react";
import { CurveType, GraphViewportConfig, perCurve } from "../types";
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
  const [graphHeights, setGraphHeights] = useState<Record<CurveType, number>>(() => ({
    ...perCurve(() => 250),
    ...savedSession?.graphHeights,
  }));

  const MIN_GRAPH_HEIGHT = 150;
  const MAX_GRAPH_HEIGHT = 600;
  /** How close to the scroller's edge counts as asking for more room, in px. */
  const EDGE_ZONE = 36;
  /** How fast the panel grows while the pointer is held against the edge, px/frame. */
  const EDGE_SPEED = 9;

  /**
   * Drag one graph taller or shorter.
   *
   * The drag is measured in the scroller's content coordinates rather than the
   * viewport's, so scrolling mid-drag does not corrupt it. That matters because of the
   * behaviour below: when the pointer reaches the bottom of the panel there is no room
   * left to drag into, which used to make the last visible graph impossible to enlarge
   * — its handle sat at the edge of the window. Holding the pointer there now scrolls
   * the panel and keeps growing the graph, the same way dragging a selection past the
   * edge of a list scrolls it.
   */
  const handleResizeStart = (e: React.MouseEvent, mode: CurveType) => {
    e.preventDefault();

    const container = dashboardContainerRef.current;
    const scrollTop = () => container?.scrollTop ?? 0;

    // Baseline height, shifted by the edge-hold below so pointer movement and
    // edge growth compose instead of fighting.
    let baseHeight = graphHeights[mode];
    const startY = e.clientY + scrollTop();
    let pointerY = e.clientY;

    const apply = () => {
      const delta = pointerY + scrollTop() - startY;
      setGraphHeights((prev) => ({
        ...prev,
        [mode]: Math.max(MIN_GRAPH_HEIGHT, Math.min(MAX_GRAPH_HEIGHT, baseHeight + delta)),
      }));
    };

    const onMove = (moveEvent: MouseEvent) => {
      pointerY = moveEvent.clientY;
      apply();
    };

    let frame = 0;
    const tick = () => {
      const rect = container?.getBoundingClientRect();
      if (rect) {
        // Past the bottom edge grows, past the top shrinks; both scroll to follow so
        // the handle stays under the pointer.
        const past = pointerY - (rect.bottom - EDGE_ZONE);
        const above = rect.top + EDGE_ZONE - pointerY;
        if (past > 0) {
          baseHeight += EDGE_SPEED;
          if (container) container.scrollTop += EDGE_SPEED;
          apply();
        } else if (above > 0) {
          baseHeight -= EDGE_SPEED;
          if (container) container.scrollTop -= EDGE_SPEED;
          apply();
        }
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);

    const onUp = () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      document.body.style.removeProperty("cursor");
      document.body.style.removeProperty("user-select");
    };

    // Hold the resize cursor for the whole drag, not just over the 12 px handle.
    document.body.style.cursor = "row-resize";
    document.body.style.userSelect = "none";
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
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
      max_spl:     { xMin: 10, xMax: 2000, yMin: 80,   yMax: 140, autoScaleY: true  },
      transfer_function: { xMin: 10, xMax: 2000, yMin: -30, yMax: 15, autoScaleY: true },
      pr_excursion: { xMin: 10, xMax: 2000, yMin: 0, yMax: 25, autoScaleY: true },
    };
    return { ...defaults, ...(savedSession?.graphConfigs || {}) };
  });

  const updateViewportConfig = <K extends keyof GraphViewportConfig>(
    curve: CurveType,
    key: K,
    value: GraphViewportConfig[K],
  ) => {
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
  const [overrideXLimits, setOverrideXLimits] = useState<Record<CurveType, boolean>>(() => ({
    // Merge over a complete default rather than replacing it, so a session saved
    // before a curve existed still yields an entry for every curve.
    ...perCurve(() => false),
    ...savedSession?.overrideXLimits,
  }));

  /**
   * The single point both the global limits and a per-curve override leave through,
   * and so the place to hold the one invariant they share: the span has to be a real
   * one. An equal pair collapses every x coordinate to NaN and every curve silently
   * disappears; an inverted pair mirrors the axis, drawing plausible gridlines around
   * a curve running backwards. The Settings inputs clamp each pair against the other
   * so neither can be reached from the UI — this covers a restored session, which
   * carries whatever the file holds.
   */
  const getGraphXLimits = (mode: CurveType) => {
    const { xMin, xMax } = overrideXLimits[mode]
      ? { xMin: graphConfigs[mode].xMin, xMax: graphConfigs[mode].xMax }
      : { xMin: globalXMin, xMax: globalXMax };
    const lo = Math.max(1, Math.min(xMin, xMax));
    const hi = Math.max(xMin, xMax);
    return { xMin: lo, xMax: Math.max(hi, lo + 1) };
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
    graphConfigs, updateViewportConfig, setGraphConfigs, setGraphHeights,
    globalXMin, setGlobalXMin, globalXMax, setGlobalXMax, overrideXLimits, setOverrideXLimits,
    getGraphXLimits, configEditType, setConfigEditType,
  };
}
