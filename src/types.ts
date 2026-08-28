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
}

export type CurveType = "transfer" | "spl" | "excursion" | "velocity" | "impedance" | "phase" | "group_delay";

export type EnclosureType =
  | "sealed"
  | "ported"
  | "bandpass4"
  | "bandpass6_parallel"
  | "bandpass6_series"
  | "passive_radiator"
  | "custom";

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
  portShape: "circular" | "rectangular";
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
  splEnvironment: "half_space" | "free_field" | "corner";
  customTopology: CustomTopologySpec;
  notes: string;
  driverConfig: "standard" | "isobaric_series" | "isobaric_parallel";
  port2Enabled: boolean;
  port2Count: number;
  port2Diameter: number;
  port2Shape: "circular" | "rectangular";
  port2Width: number;
  port2Height: number;
  // Passive crossover parameters
  passiveXoEnabled: boolean;
  passiveXoType: "lowpass_1st" | "highpass_1st" | "lowpass_2nd" | "highpass_2nd";
  passiveXoInductance: number;
  passiveXoCapacitance: number;
  passiveXoDcr: number;
}
