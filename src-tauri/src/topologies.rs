use crate::circuit::*;

/// Builds a 2nd-order closed box topology.
/// Nodes:
/// 0: Inside the sealed chamber (rear of driver)
/// 1: Outside (front of driver)
pub fn build_sealed(driver: &DriverParams, v_box_liters: f64, q_loss: f64) -> AcousticCircuit {
    let mut elements = Vec::new();

    elements.push(CircuitElement {
        element_type: ElementType::Driver { params: driver.clone() },
        node_a: 1,
        node_b: 0,
    });

    elements.push(CircuitElement {
        element_type: ElementType::Compliance { volume_liters: v_box_liters, q_loss },
        node_a: 0,
        node_b: -1,
    });

    let sd_m2 = driver.sd * 1e-4;

    elements.push(CircuitElement {
        element_type: ElementType::RadiationLoad { area_m2: sd_m2 },
        node_a: 1,
        node_b: -1,
    });

    let external_nodes = vec![
        ExternalNode { node_idx: 1, area_m2: sd_m2, is_port: false },
    ];

    AcousticCircuit { num_nodes: 2, elements, external_nodes }
}

/// Builds a 4th-order bass reflex topology.
/// Nodes:
/// 0: Inside the vented chamber
/// 1: Outside environment
pub fn build_vented(
    driver: &DriverParams,
    v_box_liters: f64,
    port_area_m2: f64,
    port_length_m: f64,
    port_count: i32,
    q_port: f64,
    q_loss: f64,
) -> AcousticCircuit {
    let mut elements = Vec::new();
    let total_port_area = port_area_m2 * (port_count as f64);

    elements.push(CircuitElement {
        element_type: ElementType::Driver { params: driver.clone() },
        node_a: 1,
        node_b: 0,
    });

    elements.push(CircuitElement {
        element_type: ElementType::Compliance { volume_liters: v_box_liters, q_loss },
        node_a: 0,
        node_b: -1,
    });

    elements.push(CircuitElement {
        element_type: ElementType::Port {
            area_m2: total_port_area,
            length_m: port_length_m,
            q_port,
        },
        node_a: 0,
        node_b: 1,
    });

    let sd_m2 = driver.sd * 1e-4;

    elements.push(CircuitElement {
        element_type: ElementType::RadiationLoad { area_m2: sd_m2 },
        node_a: 1,
        node_b: -1,
    });

    elements.push(CircuitElement {
        element_type: ElementType::RadiationLoad { area_m2: total_port_area },
        node_a: 1,
        node_b: -1,
    });

    let external_nodes = vec![
        ExternalNode { node_idx: 1, area_m2: sd_m2, is_port: false },
        ExternalNode { node_idx: 1, area_m2: total_port_area, is_port: true },
    ];

    AcousticCircuit { num_nodes: 2, elements, external_nodes }
}

/// Builds a 4th-order bandpass topology (sealed rear, ported front).
/// Nodes:
/// 0: Rear chamber (sealed)
/// 1: Front chamber (ported)
/// 2: Outside environment
pub fn build_bandpass4(
    driver: &DriverParams,
    v_rear_liters: f64,
    v_front_liters: f64,
    front_port_area_m2: f64,
    front_port_length_m: f64,
    q_port: f64,
    q_loss: f64,
) -> AcousticCircuit {
    let mut elements = Vec::new();

    elements.push(CircuitElement {
        element_type: ElementType::Driver { params: driver.clone() },
        node_a: 1,
        node_b: 0,
    });

    elements.push(CircuitElement {
        element_type: ElementType::Compliance { volume_liters: v_rear_liters, q_loss },
        node_a: 0,
        node_b: -1,
    });

    elements.push(CircuitElement {
        element_type: ElementType::Compliance { volume_liters: v_front_liters, q_loss },
        node_a: 1,
        node_b: -1,
    });

    elements.push(CircuitElement {
        element_type: ElementType::Port {
            area_m2: front_port_area_m2,
            length_m: front_port_length_m,
            q_port,
        },
        node_a: 1,
        node_b: 2,
    });

    elements.push(CircuitElement {
        element_type: ElementType::RadiationLoad { area_m2: front_port_area_m2 },
        node_a: 2,
        node_b: -1,
    });

    let external_nodes = vec![
        ExternalNode { node_idx: 2, area_m2: front_port_area_m2, is_port: true },
    ];

    AcousticCircuit { num_nodes: 3, elements, external_nodes }
}

/// Builds a 6th-order parallel bandpass topology (both chambers ported to outside).
/// Nodes:
/// 0: Rear chamber
/// 1: Front chamber
/// 2: Outside environment
pub fn build_bandpass6_parallel(
    driver: &DriverParams,
    v_rear_liters: f64,
    v_front_liters: f64,
    rear_port_area_m2: f64,
    rear_port_length_m: f64,
    front_port_area_m2: f64,
    front_port_length_m: f64,
    q_port: f64,
    q_loss: f64,
) -> AcousticCircuit {
    let mut elements = Vec::new();

    elements.push(CircuitElement {
        element_type: ElementType::Driver { params: driver.clone() },
        node_a: 1,
        node_b: 0,
    });

    elements.push(CircuitElement {
        element_type: ElementType::Compliance { volume_liters: v_rear_liters, q_loss },
        node_a: 0,
        node_b: -1,
    });

    elements.push(CircuitElement {
        element_type: ElementType::Compliance { volume_liters: v_front_liters, q_loss },
        node_a: 1,
        node_b: -1,
    });

    elements.push(CircuitElement {
        element_type: ElementType::Port {
            area_m2: rear_port_area_m2,
            length_m: rear_port_length_m,
            q_port,
        },
        node_a: 0,
        node_b: 2,
    });

    elements.push(CircuitElement {
        element_type: ElementType::Port {
            area_m2: front_port_area_m2,
            length_m: front_port_length_m,
            q_port,
        },
        node_a: 1,
        node_b: 2,
    });

    elements.push(CircuitElement {
        element_type: ElementType::RadiationLoad { area_m2: rear_port_area_m2 },
        node_a: 2,
        node_b: -1,
    });
    elements.push(CircuitElement {
        element_type: ElementType::RadiationLoad { area_m2: front_port_area_m2 },
        node_a: 2,
        node_b: -1,
    });

    let external_nodes = vec![
        ExternalNode { node_idx: 2, area_m2: rear_port_area_m2, is_port: true },
        ExternalNode { node_idx: 2, area_m2: front_port_area_m2, is_port: true },
    ];

    AcousticCircuit { num_nodes: 3, elements, external_nodes }
}

/// Builds a 6th-order series bandpass topology (rear vents into front, front vents to outside).
/// Nodes:
/// 0: Rear chamber
/// 1: Front chamber
/// 2: Outside environment
pub fn build_bandpass6_series(
    driver: &DriverParams,
    v_rear_liters: f64,
    v_front_liters: f64,
    internal_port_area_m2: f64,
    internal_port_length_m: f64,
    front_port_area_m2: f64,
    front_port_length_m: f64,
    q_port: f64,
    q_loss: f64,
) -> AcousticCircuit {
    let mut elements = Vec::new();

    elements.push(CircuitElement {
        element_type: ElementType::Driver { params: driver.clone() },
        node_a: 1,
        node_b: 0,
    });

    elements.push(CircuitElement {
        element_type: ElementType::Compliance { volume_liters: v_rear_liters, q_loss },
        node_a: 0,
        node_b: -1,
    });

    elements.push(CircuitElement {
        element_type: ElementType::Compliance { volume_liters: v_front_liters, q_loss },
        node_a: 1,
        node_b: -1,
    });

    elements.push(CircuitElement {
        element_type: ElementType::Port {
            area_m2: internal_port_area_m2,
            length_m: internal_port_length_m,
            q_port,
        },
        node_a: 0,
        node_b: 1,
    });

    elements.push(CircuitElement {
        element_type: ElementType::Port {
            area_m2: front_port_area_m2,
            length_m: front_port_length_m,
            q_port,
        },
        node_a: 1,
        node_b: 2,
    });

    elements.push(CircuitElement {
        element_type: ElementType::RadiationLoad { area_m2: front_port_area_m2 },
        node_a: 2,
        node_b: -1,
    });

    let external_nodes = vec![
        ExternalNode { node_idx: 2, area_m2: front_port_area_m2, is_port: true },
    ];

    AcousticCircuit { num_nodes: 3, elements, external_nodes }
}

/// Builds a 4th-order passive radiator topology.
/// Nodes:
/// 0: Inside chamber
/// 1: Outside environment
pub fn build_passive_radiator(
    driver: &DriverParams,
    v_box_liters: f64,
    pr_mms_g: f64,
    pr_sd_cm2: f64,
    pr_fs: f64,
    pr_qms: f64,
    q_loss: f64,
) -> AcousticCircuit {
    let mut elements = Vec::new();

    elements.push(CircuitElement {
        element_type: ElementType::Driver { params: driver.clone() },
        node_a: 1,
        node_b: 0,
    });

    elements.push(CircuitElement {
        element_type: ElementType::Compliance { volume_liters: v_box_liters, q_loss },
        node_a: 0,
        node_b: -1,
    });

    elements.push(CircuitElement {
        element_type: ElementType::PassiveRadiator {
            mms_g: pr_mms_g,
            sd_cm2: pr_sd_cm2,
            fs_pr: pr_fs,
            qms_pr: pr_qms,
        },
        node_a: 0,
        node_b: 1,
    });

    let sd_m2 = driver.sd * 1e-4;
    let pr_area_m2 = pr_sd_cm2 * 1e-4;

    elements.push(CircuitElement {
        element_type: ElementType::RadiationLoad { area_m2: sd_m2 },
        node_a: 1,
        node_b: -1,
    });
    elements.push(CircuitElement {
        element_type: ElementType::RadiationLoad { area_m2: pr_area_m2 },
        node_a: 1,
        node_b: -1,
    });

    let external_nodes = vec![
        ExternalNode { node_idx: 1, area_m2: sd_m2, is_port: false },
        ExternalNode { node_idx: 1, area_m2: pr_area_m2, is_port: true },
    ];

    AcousticCircuit { num_nodes: 2, elements, external_nodes }
}
