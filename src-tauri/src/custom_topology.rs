use crate::circuit::*;
use std::f64::consts::PI;

#[derive(serde::Serialize, serde::Deserialize, Clone, Debug)]
pub struct CustomPortSpec {
    pub diameter_cm: f64,
    pub tuning_freq: f64,
}

#[derive(serde::Serialize, serde::Deserialize, Clone, Debug)]
pub struct CustomPRSpec {
    pub mms_g: f64,
    pub sd_cm2: f64,
    pub fs: f64,
    pub qms: f64,
}

#[derive(serde::Serialize, serde::Deserialize, Clone, Debug)]
pub struct CustomSideSpec {
    pub volume_liters: f64,           // 0 = no chamber (front open to air)
    pub port: Option<CustomPortSpec>, // external port connecting this side to outside
    pub pr: Option<CustomPRSpec>,     // passive radiator connecting this side to outside
}

#[derive(serde::Serialize, serde::Deserialize, Clone, Debug)]
pub struct CustomTopologySpec {
    pub rear: CustomSideSpec,
    pub front: CustomSideSpec,
    pub internal_port: Option<CustomPortSpec>, // cross-connects rear ↔ front (BP6S style)
}

fn port_area_m2(diameter_cm: f64) -> f64 {
    let r = (diameter_cm / 2.0) * 0.01;
    PI * r * r
}

fn port_length_m(area_m2: f64, tuning_freq: f64, vol_liters: f64) -> f64 {
    if tuning_freq <= 0.0 || area_m2 <= 0.0 || vol_liters <= 0.0 {
        return 0.15;
    }
    let v_m3 = vol_liters * 1e-3;
    let r_eq = (area_m2 / PI).sqrt();
    // Physical port length (end-correction added back by circuit solver)
    let l = (C_AIR * C_AIR * area_m2) / (4.0 * PI * PI * tuning_freq * tuning_freq * v_m3)
        - 0.732 * r_eq;
    l.max(0.01)
}

/// Build an AcousticCircuit from a custom topology specification.
///
/// Node layout:
/// - 0: rear face of driver (rear chamber if present)
/// - 1: front face of driver (front chamber, or outside when no front chamber)
/// - 2: outside radiation node (only created when front chamber exists)
///
/// `q_port` — port loss quality factor (50 = circular, 30 = slot)
/// `q_loss` — compliance loss quality factor (pass 200.0 for lossless)
pub fn build_custom_circuit(
    spec: &CustomTopologySpec,
    driver: &DriverParams,
    q_port: f64,
    q_loss: f64,
) -> AcousticCircuit {
    let has_front_chamber = spec.front.volume_liters > 0.0;

    let outside_node: i32 = if has_front_chamber { 2 } else { 1 };
    let num_nodes: usize = if has_front_chamber { 3 } else { 2 };

    let sd_m2 = driver.sd * 1e-4;
    let mut elements: Vec<CircuitElement> = Vec::new();
    let mut external_nodes: Vec<ExternalNode> = Vec::new();

    // Driver: front = node 1, rear = node 0
    elements.push(CircuitElement {
        element_type: ElementType::Driver { params: driver.clone() },
        node_a: 1,
        node_b: 0,
    });

    // Rear chamber compliance
    if spec.rear.volume_liters > 0.0 {
        elements.push(CircuitElement {
            element_type: ElementType::Compliance {
                volume_liters: spec.rear.volume_liters,
                q_loss,
            },
            node_a: 0,
            node_b: -1,
        });
    }

    // Front chamber compliance
    if has_front_chamber {
        elements.push(CircuitElement {
            element_type: ElementType::Compliance {
                volume_liters: spec.front.volume_liters,
                q_loss,
            },
            node_a: 1,
            node_b: -1,
        });
    }

    // Internal port: rear (node 0) ↔ front (node 1)  — enables series BP6S topology
    if let Some(ip) = &spec.internal_port {
        let a = port_area_m2(ip.diameter_cm);
        let ref_vol = spec.rear.volume_liters.max(spec.front.volume_liters).max(1.0);
        let len = port_length_m(a, ip.tuning_freq, ref_vol);
        elements.push(CircuitElement {
            element_type: ElementType::Port { area_m2: a, length_m: len, q_port },
            node_a: 0,
            node_b: 1,
        });
    }

    // Rear external port → outside
    if let Some(p) = &spec.rear.port {
        let a = port_area_m2(p.diameter_cm);
        let len = port_length_m(a, p.tuning_freq, spec.rear.volume_liters.max(1.0));
        elements.push(CircuitElement {
            element_type: ElementType::Port { area_m2: a, length_m: len, q_port },
            node_a: 0,
            node_b: outside_node,
        });
        elements.push(CircuitElement {
            element_type: ElementType::RadiationLoad { area_m2: a },
            node_a: outside_node,
            node_b: -1,
        });
        external_nodes.push(ExternalNode { node_idx: outside_node as usize, area_m2: a, is_port: true });
    }

    // Rear external PR → outside
    if let Some(pr) = &spec.rear.pr {
        let a = pr.sd_cm2 * 1e-4;
        elements.push(CircuitElement {
            element_type: ElementType::PassiveRadiator {
                mms_g: pr.mms_g,
                sd_cm2: pr.sd_cm2,
                fs_pr: pr.fs,
                qms_pr: pr.qms,
            },
            node_a: 0,
            node_b: outside_node,
        });
        elements.push(CircuitElement {
            element_type: ElementType::RadiationLoad { area_m2: a },
            node_a: outside_node,
            node_b: -1,
        });
        external_nodes.push(ExternalNode { node_idx: outside_node as usize, area_m2: a, is_port: true });
    }

    // Front external port → outside
    if let Some(p) = &spec.front.port {
        let a = port_area_m2(p.diameter_cm);
        let len = port_length_m(a, p.tuning_freq, spec.front.volume_liters.max(1.0));
        elements.push(CircuitElement {
            element_type: ElementType::Port { area_m2: a, length_m: len, q_port },
            node_a: 1,
            node_b: outside_node,
        });
        elements.push(CircuitElement {
            element_type: ElementType::RadiationLoad { area_m2: a },
            node_a: outside_node,
            node_b: -1,
        });
        external_nodes.push(ExternalNode { node_idx: outside_node as usize, area_m2: a, is_port: true });
    }

    // Front external PR → outside
    if let Some(pr) = &spec.front.pr {
        let a = pr.sd_cm2 * 1e-4;
        elements.push(CircuitElement {
            element_type: ElementType::PassiveRadiator {
                mms_g: pr.mms_g,
                sd_cm2: pr.sd_cm2,
                fs_pr: pr.fs,
                qms_pr: pr.qms,
            },
            node_a: 1,
            node_b: outside_node,
        });
        elements.push(CircuitElement {
            element_type: ElementType::RadiationLoad { area_m2: a },
            node_a: outside_node,
            node_b: -1,
        });
        external_nodes.push(ExternalNode { node_idx: outside_node as usize, area_m2: a, is_port: true });
    }

    // Cone radiation only when the front face is open to air (no front chamber)
    if !has_front_chamber {
        elements.push(CircuitElement {
            element_type: ElementType::RadiationLoad { area_m2: sd_m2 },
            node_a: 1,
            node_b: -1,
        });
        external_nodes.push(ExternalNode { node_idx: 1, area_m2: sd_m2, is_port: false });
    }

    AcousticCircuit { num_nodes, elements, external_nodes }
}

/// Sum of all external port/PR areas — used for air velocity calculation.
pub fn total_external_port_area(spec: &CustomTopologySpec) -> f64 {
    let mut area = 0.0;
    if let Some(p) = &spec.rear.port { area += port_area_m2(p.diameter_cm); }
    if let Some(pr) = &spec.rear.pr  { area += pr.sd_cm2 * 1e-4; }
    if let Some(p) = &spec.front.port { area += port_area_m2(p.diameter_cm); }
    if let Some(pr) = &spec.front.pr  { area += pr.sd_cm2 * 1e-4; }
    area
}
