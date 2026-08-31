import {
  CURVE_TYPES,
  CurveType,
  EqFilter,
  GraphViewportConfig,
  Project,
  RoomConfig,
  CabinConfig,
  oneOf,
  perCurve,
} from "../types";
import { withProjectDefaults } from "./projectDefaults";

/**
 * A saved workspace: everything the dashboard was showing, not just one design.
 *
 * A .wproj file holds a single project — one driver in one enclosure — which is the
 * right unit to share or compare against. A workspace is the whole bench: every
 * project being overlaid, how the graphs were framed, and the signal chain applied
 * across them.
 */
export const WORKSPACE_EXTENSION = "wsp";

/** Bumped only for a change old readers could not handle. */
export const WORKSPACE_VERSION = 1;

export type WorkspaceFile = {
  version: number;
  projects: Project[];
  activeProjectId: string;
  visibleGraphs: CurveType[];
  graphConfigs: Record<CurveType, GraphViewportConfig>;
  graphHeights: Record<CurveType, number>;
  overrideXLimits: Record<CurveType, boolean>;
  globalXMin: number;
  globalXMax: number;
  filters: EqFilter[];
  roomConfig: RoomConfig;
  cabinConfig: CabinConfig;
  rulerFreq: number | null;
  /**
   * Chosen display unit per quantity, keyed by canonical symbol — absent means
   * canonical, so a workspace written before this existed loads unchanged and the
   * version does not need bumping.
   */
  displayUnits?: Record<string, string>;
};

export function serializeWorkspace(w: Omit<WorkspaceFile, "version">): string {
  return JSON.stringify({ version: WORKSPACE_VERSION, ...w }, null, 2);
}

/**
 * Read a workspace, filling in anything the file predates.
 *
 * Files are user data that may have been written by an older build, so every field is
 * treated as possibly absent and every enumerated value is narrowed rather than
 * trusted. Returns null when the text is not a workspace at all.
 */
export function deserializeWorkspace(
  text: string,
  defaults: Omit<WorkspaceFile, "version">,
): Omit<WorkspaceFile, "version"> | null {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return null;
  }
  if (!raw || typeof raw !== "object") return null;

  const f = raw as Partial<WorkspaceFile>;
  if (!Array.isArray(f.projects) || f.projects.length === 0) return null;

  const projects = f.projects.map(withProjectDefaults);
  const activeProjectId = projects.some((p) => p.id === f.activeProjectId)
    ? f.activeProjectId!
    : projects[0].id;

  const visibleGraphs = Array.isArray(f.visibleGraphs)
    ? [...new Set(f.visibleGraphs.map((g) => oneOf(CURVE_TYPES, g, "spl")))]
    : defaults.visibleGraphs;

  return {
    projects,
    activeProjectId,
    visibleGraphs,
    // Merged over a complete record so a file written before a curve existed still
    // yields an entry for every curve.
    graphConfigs: { ...defaults.graphConfigs, ...f.graphConfigs },
    graphHeights: { ...perCurve(() => 250), ...f.graphHeights },
    overrideXLimits: { ...perCurve(() => false), ...f.overrideXLimits },
    globalXMin: typeof f.globalXMin === "number" ? f.globalXMin : defaults.globalXMin,
    globalXMax: typeof f.globalXMax === "number" ? f.globalXMax : defaults.globalXMax,
    filters: Array.isArray(f.filters) ? f.filters : defaults.filters,
    roomConfig: f.roomConfig ?? defaults.roomConfig,
    cabinConfig: f.cabinConfig ?? defaults.cabinConfig,
    rulerFreq: typeof f.rulerFreq === "number" ? f.rulerFreq : null,
    // Absent, or written by a build with different units, is simply canonical —
    // useUnits drops anything it cannot render.
    displayUnits: f.displayUnits ?? defaults.displayUnits ?? {},
  };
}
