import { DEFAULT_QL, Project, ProjectFile } from "../types";

/**
 * A Project as it is written to a .wproj file.
 *
 * This lived inline inside `handleSaveProject`, which is how it came to be missing a
 * field: nothing could reach it to check. `ql` was declared on ProjectFile and read
 * back on load, but never written and absent from the Rust `ProjectState` entirely, so
 * serde dropped it going in and never emitted it coming out. Saving a project silently
 * reset its enclosure loss Q to the default.
 *
 * The return type is `Required<ProjectFile>` on purpose: every key of the format must
 * be present here, so adding a field to ProjectFile without adding it to this function
 * fails to compile rather than failing quietly at someone's next load.
 */
export function toProjectFile(p: Project): Required<ProjectFile> {
  return {
    project_name: p.name,
    notes: p.notes,
    driver: p.driver,
    v_box: p.vBox,
    enclosure_type: p.enclosureType,
    tuning_freq: p.tuningFreq,
    port_diameter: p.portDiameter,
    input_power: p.inputPower,
    distance: p.distance,
    num_drivers: p.numDrivers,
    port_shape: p.portShape,
    port_count: p.portCount,
    port_width: p.portWidth,
    port_height: p.portHeight,
    v_rear: p.vRear,
    v_front: p.vFront,
    front_tuning_freq: p.frontTuningFreq,
    rear_tuning_freq: p.rearTuningFreq,
    front_port_diameter: p.frontPortDiameter,
    rear_port_diameter: p.rearPortDiameter,
    internal_port_diameter: p.internalPortDiameter,
    pr_mms: p.prMms,
    pr_sd: p.prSd,
    pr_fs: p.prFs,
    pr_qms: p.prQms,
    pr_xmax: p.prXmax,
    port_q: p.portQ,
    ql: p.ql ?? DEFAULT_QL,
    spl_environment: p.splEnvironment,
    custom_topology: p.customTopology,
    driver_config: p.driverConfig,
    port2_enabled: p.port2Enabled,
    port2_count: p.port2Count,
    port2_diameter: p.port2Diameter,
    port2_shape: p.port2Shape,
    port2_width: p.port2Width,
    port2_height: p.port2Height,
    passive_xo_enabled: p.passiveXoEnabled,
    passive_xo_type: p.passiveXoType,
    passive_xo_inductance: p.passiveXoInductance,
    passive_xo_capacitance: p.passiveXoCapacitance,
    passive_xo_dcr: p.passiveXoDcr,
  };
}
