export interface Driver {
  id: string;
  manufacturer: string;
  model: string;
  fs: number;
  qts: number;
  qes: number;
  qms: number;
  vas: number;
  re: number;
  sd: number;
  xmax: number;
  mms: number;
  le: number;
  bl: number;
  pe: number;
  sens: number;
}

export interface SimPoint {
  frequency: number;
  db: number;
  phase_rad?: number;
  /** Which ceiling binds at this frequency. Only present on the max-SPL curve. */
  limited_by?: "excursion" | "power";
}

/** The vent cross-sections the solver models. */
export const PORT_SHAPES = ["circular", "rectangular"] as const;
export type PortShape = (typeof PORT_SHAPES)[number];

/** Radiation environment; each step adds a reflecting boundary. */
export const SPL_ENVIRONMENTS = ["half_space", "free_field", "corner"] as const;
export type SplEnvironment = (typeof SPL_ENVIRONMENTS)[number];

/** How multiple drivers are coupled and wired. */
export const DRIVER_CONFIGS = ["standard", "isobaric_series", "isobaric_parallel"] as const;
export type DriverConfig = (typeof DRIVER_CONFIGS)[number];

/** Passive crossover topologies the solver models. */
export const PASSIVE_XO_TYPES = [
  "lowpass_1st",
  "highpass_1st",
  "lowpass_2nd",
  "highpass_2nd",
] as const;
export type PassiveXoType = (typeof PASSIVE_XO_TYPES)[number];

/**
 * Narrow an untrusted value to one of `allowed`, falling back when it is not.
 *
 * Saved projects and restored sessions are user-supplied files: a value that is not a
 * member should land on a sane default rather than becoming an invalid project that
 * only misbehaves later.
 */
export function oneOf<T extends string>(
  allowed: readonly T[],
  value: unknown,
  fallback: T,
): T {
  return allowed.includes(value as T) ? (value as T) : fallback;
}

/**
 * Every curve the dashboard can show, as a runtime list. Per-curve records built by
 * hand had drifted from this union — the X-override defaults were missing phase and
 * group_delay, so overriding their frequency range silently did nothing.
 */
export const CURVE_TYPES = [
  "transfer",
  "spl",
  "excursion",
  "velocity",
  "impedance",
  "phase",
  "group_delay",
  "max_spl",
  "transfer_function",
] as const;
export type CurveType = (typeof CURVE_TYPES)[number];

/** Build a record covering every curve, so none can be forgotten. */
export function perCurve<T>(value: (curve: CurveType) => T): Record<CurveType, T> {
  return Object.fromEntries(CURVE_TYPES.map((c) => [c, value(c)])) as Record<CurveType, T>;
}

/**
 * Every enclosure the solver can build, as a runtime list so a value read from a saved
 * file or from localStorage can actually be checked against it. The union is derived
 * from the list rather than written twice.
 */
export const ENCLOSURE_TYPES = [
  "sealed",
  "ported",
  "bandpass4",
  "bandpass6_parallel",
  "bandpass6_series",
  "passive_radiator",
  "custom",
] as const;
export type EnclosureType = (typeof ENCLOSURE_TYPES)[number];

// Custom topology types — field names match Rust serde snake_case
export interface CustomPortSpec {
  diameter_cm: number;
  tuning_freq: number;
}
export interface CustomPRSpec {
  mms_g: number;
  sd_cm2: number;
  fs: number;
  qms: number;
}
export interface CustomSideSpec {
  volume_liters: number;   // 0 = no chamber / open air
  port: CustomPortSpec | null;
  pr: CustomPRSpec | null;
}
export interface CustomTopologySpec {
  rear: CustomSideSpec;
  front: CustomSideSpec;
  internal_port: CustomPortSpec | null;
}

export interface EqFilter {
  id: string;
  enabled: boolean;
  type: "hp" | "lp" | "peak" | "lowshelf" | "highshelf";
  freq: number;
  q: number;
  gain: number;
}

export interface SpeakerPos { x: number; y: number; z: number; }

export interface RoomConfig {
  enabled: boolean;
  length: number;
  width: number;
  height: number;
  speakers: SpeakerPos[];
  listenerX: number;
  listenerY: number;
  listenerZ: number;
  absorption: number;
}

export interface GraphViewportConfig {
  xMin: number;
  xMax: number;
  yMin: number;
  yMax: number;
  autoScaleY: boolean;
}

export interface CabinConfig {
  enabled: boolean;
  fCabin: number;
}

export interface Project {
  id: string;
  name: string;
  color: string;
  showOnGraph: boolean;
  driver: Driver;
  vBox: number;
  enclosureType: EnclosureType;
  tuningFreq: number;
  portDiameter: number;
  portShape: PortShape;
  portCount: number;
  portWidth: number;
  portHeight: number;
  inputPower: number;
  distance: number;
  numDrivers: number;
  vRear: number;
  vFront: number;
  frontTuningFreq: number;
  rearTuningFreq: number;
  frontPortDiameter: number;
  rearPortDiameter: number;
  internalPortDiameter: number;
  prMms: number;
  prSd: number;
  prFs: number;
  prQms: number;
  portQ: number;
  /** Enclosure loss Q — leakage and absorption. 7 ≈ a well-built cabinet. */
  ql: number;
  splEnvironment: SplEnvironment;
  customTopology: CustomTopologySpec;
  notes: string;
  driverConfig: DriverConfig;
  port2Enabled: boolean;
  port2Count: number;
  port2Diameter: number;
  port2Shape: PortShape;
  port2Width: number;
  port2Height: number;
  // Passive crossover parameters
  passiveXoEnabled: boolean;
  passiveXoType: PassiveXoType;
  passiveXoInductance: number;
  passiveXoCapacitance: number;
  passiveXoDcr: number;
}

export const DEFAULT_CUSTOM: CustomTopologySpec = {
  rear:  { volume_liters: 80, port: null, pr: null },
  front: { volume_liters: 0,  port: null, pr: null },
  internal_port: null,
};

export const DEFAULT_DRIVER: Driver = {
  id: "bc-21sw115-4",
  manufacturer: "B&C Speakers",
  model: "21SW115 (4Ω)",
  fs: 33.0,
  qts: 0.36,
  qes: 0.37,
  qms: 7.7,
  vas: 278.0,
  re: 3.6,
  sd: 1680.0,
  xmax: 14.0,
  mms: 335.0,
  le: 1.7,
  bl: 24.8,
  pe: 1700.0,
  sens: 97.0,
};

/** Which alignment family the auto-align solver should aim for. */
export type AlignmentTarget = "maximally_flat" | "extended_bass" | "boomy";

/**
 * Optional limits the alignment solver must respect. Anything left unset is not
 * constrained. If nothing satisfies every constraint the solver relaxes them one at a
 * time and reports what it had to give up in `notes`.
 */
export type AlignmentConstraints = {
  respectXmax?: boolean;
  buildablePort?: boolean;
  /** Hard cap on total box volume, in liters. */
  maxVolume?: number | null;
  /** Reject alignments that cannot reach this F3, in Hz. */
  targetF3?: number | null;
};

/** Desired −3 dB corners for a bandpass enclosure. Ignored for high-pass types. */
export type PassbandTarget = {
  low: number;
  high: number;
};

/** Result of `auto_align_enclosure`. Field names are the Rust struct's, as serialized. */
export type AlignmentRecommendation = {
  v_box: number;
  tuning_freq: number;
  v_rear: number;
  v_front: number;
  rear_tuning_freq: number;
  front_tuning_freq: number;
  f3: number;
  /** Upper −3 dB corner, in Hz. Zero for high-pass enclosures. */
  f_high: number;
  ripple_db: number;
  /** Rolloff knee sharpness (f10/f3); 0.76 is a textbook 4th-order Butterworth. */
  knee: number;
  excursion_ratio: number;
  port_velocity: number;
  alignment_name: string;
  notes: string[];
};

/** Result of `auto_calculate_port`. Field names are the Rust struct's, as serialized. */
export type PortRecommendation = {
  port_shape: PortShape;
  port_count: number;
  port_diameter: number;
  port_width: number;
  port_height: number;
  /** Duct length for each port, in cm. */
  port_length: number;
  /** Air speed through the recommended vent at rated power, in m/s. */
  peak_velocity: number;
};

/**
 * A project as it lives in a saved `.wproj` file.
 *
 * Mirrors the Rust `ProjectState`, so the field names are snake_case and the optional
 * fields are the ones Rust declares as `Option`. Anything added there needs adding
 * here, which is the point: this file is a format other people's saved work depends
 * on, and an untyped round-trip would let a mismatch fail silently at load time.
 */
export type ProjectFile = {
  project_name: string;
  notes?: string | null;
  driver: Driver;
  v_box: number;
  enclosure_type: string;   // narrowed with oneOf on load
  tuning_freq: number;
  port_diameter: number;
  input_power: number;
  distance: number;
  num_drivers: number;
  port_shape?: string | null;
  port_count?: number | null;
  port_width?: number | null;
  port_height?: number | null;
  v_rear?: number | null;
  v_front?: number | null;
  front_tuning_freq?: number | null;
  rear_tuning_freq?: number | null;
  front_port_diameter?: number | null;
  rear_port_diameter?: number | null;
  internal_port_diameter?: number | null;
  pr_mms?: number | null;
  pr_sd?: number | null;
  pr_fs?: number | null;
  pr_qms?: number | null;
  port_q?: number | null;
  ql?: number | null;
  spl_environment?: string | null;
  custom_topology?: CustomTopologySpec | null;
  driver_config?: string | null;
  port2_enabled?: boolean | null;
  port2_count?: number | null;
  port2_diameter?: number | null;
  port2_shape?: string | null;
  port2_width?: number | null;
  port2_height?: number | null;
  passive_xo_enabled?: boolean | null;
  passive_xo_type?: string | null;
  passive_xo_inductance?: number | null;
  passive_xo_capacitance?: number | null;
  passive_xo_dcr?: number | null;
};

/** Sidebar tabs, as a runtime list so a restored value can be checked. */
export const SIDEBAR_TABS = ["driver", "enclosure", "signal"] as const;
export type SidebarTab = (typeof SIDEBAR_TABS)[number];

/**
 * The autosaved session in localStorage.
 *
 * Every field is optional: the stored blob may predate any of them, and consumers
 * already fall back to a default for each. Typing it as Partial says exactly that,
 * rather than promising a shape the browser cannot guarantee.
 */
export type SavedSession = Partial<{
  projects: Project[];
  activeProjectId: string;
  visibleGraphs: CurveType[];
  sidebarTab: SidebarTab;
  sidebarSectionState: Record<string, boolean>;
  globalXMin: number;
  globalXMax: number;
  overrideXLimits: Partial<Record<CurveType, boolean>>;
  graphConfigs: Record<CurveType, GraphViewportConfig>;
  filters: EqFilter[];
  roomConfig: RoomConfig;
  cabinConfig: CabinConfig;
  rulerFreq: number | null;
  graphHeights: Record<CurveType, number>;
}>;

/**
 * Enclosure loss Q for a new project.
 *
 * 7 is the conventional figure for a well-built cabinet and the value Thiele/Small
 * alignment tables assume. Mirrors DEFAULT_Q_LOSS in src-tauri/src/lib.rs.
 */
export const DEFAULT_QL = 7;
