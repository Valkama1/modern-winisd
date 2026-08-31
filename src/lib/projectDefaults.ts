import { Driver, Project, DEFAULT_CUSTOM, DEFAULT_DRIVER, DEFAULT_QL } from "../types";

/**
 * A complete Project with every field set.
 *
 * The single source of truth for what a project looks like. Used to create new
 * projects, to backfill sessions and files saved before a field existed, and by the
 * test fixtures — so a field added here reaches all three. A hand-maintained backfill
 * list is what let `ql` restore as undefined and leave its control blank.
 */
export const createDefaultProject = (id: string, name: string, color: string, driver?: Driver): Project => {
  const finalDriver = driver || DEFAULT_DRIVER;
  return {
    id,
    name: name || `${finalDriver.manufacturer} ${finalDriver.model}`,
    color,
    showOnGraph: true,
    driver: finalDriver,
    vBox: 150,
    enclosureType: "sealed",
    tuningFreq: 33,
    portDiameter: 10.0,
    portShape: "circular",
    portCount: 1,
    portWidth: 30.0,
    portHeight: 5.0,
    inputPower: 1,
    distance: 1,
    numDrivers: 1,
    vRear: 80,
    vFront: 40,
    frontTuningFreq: 55,
    rearTuningFreq: 30,
    frontPortDiameter: 10.0,
    rearPortDiameter: 10.0,
    internalPortDiameter: 10.0,
    prMms: 300,
    prSd: 1680,
    prFs: 25,
    prQms: 5.0,
    prXmax: 15.0,
    portQ: 50,
    ql: DEFAULT_QL,
    splEnvironment: "half_space",
    customTopology: DEFAULT_CUSTOM,
    notes: "",
    driverConfig: "standard",
    port2Enabled: false,
    port2Count: 1,
    port2Diameter: 10.0,
    port2Shape: "circular",
    port2Width: 20.0,
    port2Height: 5.0,
    passiveXoEnabled: false,
    passiveXoType: "lowpass_1st",
    passiveXoInductance: 1.5, // 1.5 mH default
    passiveXoCapacitance: 47.0, // 47 uF default
    passiveXoDcr: 0.2, // 0.2 ohms inductor resistance default
  };
};

/**
 * Fill in whatever a stored project is missing.
 *
 * Sessions and .wproj files can predate any field. Merging over a complete default
 * means a new field is backfilled automatically rather than needing to be remembered.
 */
export function withProjectDefaults(stored: Partial<Project>): Project {
  const base = createDefaultProject(
    stored.id ?? `project-${Date.now()}`,
    stored.name ?? "",
    stored.color ?? "#4f8ff7",
    stored.driver,
  );
  return { ...base, ...stored, driver: stored.driver ?? base.driver };
}
