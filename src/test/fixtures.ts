import { Project, Driver, DEFAULT_DRIVER } from "../types";

/**
 * A complete Project for tests. The real factory lives inside useProjects and is not
 * exported, so this mirrors it — keep the two in step when Project gains a field.
 */
export function makeProject(overrides: Partial<Project> = {}): Project {
  const driver: Driver = DEFAULT_DRIVER;
  return {
    id: "test-project",
    name: "Test Project",
    color: "#4f8ff7",
    showOnGraph: true,
    driver,
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
    portQ: 50,
    ql: 7,
    splEnvironment: "half_space",
    customTopology: {
      rear: { volume_liters: 80, port: null, pr: null },
      front: { volume_liters: 0, port: null, pr: null },
      internal_port: null,
    },
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
    passiveXoInductance: 1.5,
    passiveXoCapacitance: 47.0,
    passiveXoDcr: 0.2,
    ...overrides,
  };
}
