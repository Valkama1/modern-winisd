//! The simulation commands.
//!
//! Both take a single request struct rather than a long positional list: that list was
//! forty parameters deep and miscounting it silently dropped arguments.

use crate::circuit::{self, DriverParams, compute_spl, solve_circuit};
use crate::custom_topology::{self, CustomTopologySpec};
use crate::model::{Driver, SimPoint, apply_driver_config, driver_to_params};
use crate::topologies::*;

///   "corner"      → 4.0  (π/2 sr, three reflecting boundaries — +12 dB vs half-space)
/// Enclosure loss Q: how much energy the box itself absorbs and leaks.
///
/// 7 is the conventional figure for a well-built cabinet and is what Thiele/Small
/// alignment tables assume; 3–5 is a leaky or heavily stuffed box, 10–15 a very tight
/// one, and 100+ approaches a lossless ideal that no real enclosure reaches. Losses
/// mostly damp the impedance peaks and fill in the saddle between them.
pub(crate) const DEFAULT_Q_LOSS: f64 = 7.0;

/// Stand-in for an infinite baffle when normalising the transfer function, in litres.
/// Large enough that the enclosure contributes nothing measurable for any real driver:
/// even a 450 L Vas sees Vas/Vb below 0.5 %, moving its resonance by under 0.3 %.
const FREE_AIR_VOLUME_L: f64 = 100_000.0;

pub(crate) fn resolve_q_loss(ql: Option<f64>) -> f64 {
    match ql {
        Some(q) if q > 0.0 => q.clamp(1.0, 1000.0),
        _ => DEFAULT_Q_LOSS,
    }
}

fn env_gain_from_str(s: Option<&str>) -> f64 {
    match s {
        Some("free_field") => 0.5,
        Some("corner")     => 4.0,
        _                  => 1.0, // default: half-space
    }
}


/// Everything `simulate_system` needs, as one payload.
///
/// This was forty positional parameters, most of them `Option`, which meant every call
/// site was a wall of `None` kept in order by comments — and miscounting that wall is
/// exactly how `auto_calculate_port` came to silently drop `driver_config` and the whole
/// second port group. Named fields plus `..Default::default()` make that failure mode
/// impossible, and adding a parameter no longer touches every caller.
///
/// `#[serde(default)]` means an absent key falls back to `Default` rather than failing
/// the whole call, and `rename_all` matches the camelCase payload the frontend already

/// sends, so the wire format is unchanged.
#[derive(serde::Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase", default)]
pub struct SimulationRequest {
    pub driver: Driver,
    pub v_box: f64,
    pub enclosure_type: String,
    pub tuning_freq: f64,
    pub port_diameter: f64,
    pub input_power: f64,
    pub distance: f64,
    pub num_drivers: i32,
    pub curve_type: String,
    pub f_min: f64,
    pub f_max: f64,
    pub port_shape: String,
    pub port_count: i32,
    pub port_width: f64,
    pub port_height: f64,
    // Higher-order enclosure volumes / tuning
    pub v_rear: Option<f64>,
    pub v_front: Option<f64>,
    pub front_tuning_freq: Option<f64>,
    pub rear_tuning_freq: Option<f64>,
    pub front_port_diameter: Option<f64>,
    pub rear_port_diameter: Option<f64>,
    pub internal_port_diameter: Option<f64>,
    // Passive radiator parameters
    pub pr_mms: Option<f64>,
    pub pr_sd: Option<f64>,
    pub pr_fs: Option<f64>,
    pub pr_qms: Option<f64>,
    /// Radiator travel limit in mm. Carried so the alignment solver can respect it;
    /// the curve itself is compared against it in the frontend.
    pub pr_xmax: Option<f64>,
    // Acoustic quality parameters
    pub port_q: Option<f64>,             // port loss Q (50 = circular, 30 = slot)
    pub ql: Option<f64>,                 // enclosure loss Q — leakage and absorption
    pub spl_environment: Option<String>, // "half_space" | "free_field" | "corner"
    // Isobaric / push-pull
    pub driver_config: Option<String>,   // "standard" | "isobaric_series" | "isobaric_parallel"
    // Second port group (ported only)
    pub port2_enabled: Option<bool>,
    pub port2_count: Option<i32>,
    pub port2_diameter: Option<f64>,
    pub port2_shape: Option<String>,
    pub port2_width: Option<f64>,
    pub port2_height: Option<f64>,
    // Passive crossover parameters
    pub passive_xo_enabled: Option<bool>,
    pub passive_xo_type: Option<String>,
    pub passive_xo_inductance: Option<f64>,
    pub passive_xo_capacitance: Option<f64>,
    pub passive_xo_dcr: Option<f64>,
}

impl Default for SimulationRequest {
    /// Mirrors the fallbacks the function body already applies, so an omitted field
    /// behaves the same as it did when the caller passed `None`. `v_box` is left at
    /// zero deliberately: the body's validation rejects it into an empty result, so a
    /// forgotten volume fails visibly rather than simulating some other box.
    fn default() -> Self {
        Self {
            driver: Driver::default(),
            v_box: 0.0,
            enclosure_type: "sealed".to_string(),
            tuning_freq: 0.0,
            port_diameter: 10.0,
            input_power: 1.0,
            distance: 1.0,
            num_drivers: 1,
            curve_type: "spl".to_string(),
            f_min: 10.0,
            f_max: 2000.0,
            port_shape: "circular".to_string(),
            port_count: 1,
            port_width: 0.0,
            port_height: 0.0,
            v_rear: None,
            v_front: None,
            front_tuning_freq: None,
            rear_tuning_freq: None,
            front_port_diameter: None,
            rear_port_diameter: None,
            internal_port_diameter: None,
            pr_mms: None,
            pr_sd: None,
            pr_fs: None,
            pr_qms: None,
            pr_xmax: None,
            port_q: None,
            ql: None,
            spl_environment: None,
            driver_config: None,
            port2_enabled: None,
            port2_count: None,
            port2_diameter: None,
            port2_shape: None,
            port2_width: None,
            port2_height: None,
            passive_xo_enabled: None,
            passive_xo_type: None,
            passive_xo_inductance: None,
            passive_xo_capacitance: None,
            passive_xo_dcr: None,
        }
    }
}


/// Vent areas, duct lengths and chamber volumes worked out from a request.
///
/// Sizing the ports is a separate job from wiring up the circuit, and both used to sit
/// inline in `simulate_system`. The bandpass fields are computed for every enclosure
/// and ignored by the ones that have no such chamber, which is cheap and keeps the
/// topology match below to one line per enclosure.
struct EnclosureGeometry {
    port_count: i32,
    /// One port of group 1. Group 1's total is this times the count.
    single_port_area_m2: f64,
    total_port_area_m2: f64,
    port2_enabled: bool,
    port2_area_m2: f64,
    /// Port 2's loss Q, reduced for a slot's greater wetted perimeter.
    q_port2: f64,
    /// Length shared by every duct, derived from the combined area so both groups can
    /// physically be the same length — which is how they are usually built.
    port_length_m: f64,
    box_volume_l: f64,
    front_port_area_m2: f64,
    rear_port_area_m2: f64,
    internal_port_area_m2: f64,
    front_port_len_m: f64,
    rear_port_len_m: f64,
    internal_port_len_m: f64,
    v_rear_l: f64,
    v_front_l: f64,
}

impl EnclosureGeometry {
    fn from_request(r: &SimulationRequest, num: f64, q_port: f64) -> Self {
        let port_count = if r.port_count > 0 { r.port_count } else { 1 };
        let single_port_area_m2 = if r.port_shape == "rectangular" {
            circuit::rect_port_area_m2(r.port_width, r.port_height)
        } else {
            circuit::circular_port_area_m2(if r.port_diameter > 0.0 { r.port_diameter } else { 10.0 })
        };
        let total_port_area_m2 = single_port_area_m2 * (port_count as f64);

        let port2_enabled = r.port2_enabled.unwrap_or(false);
        let p2_shape = r.port2_shape.as_deref().unwrap_or("circular");
        let p2_width = r.port2_width.unwrap_or(10.0);
        let p2_height = r.port2_height.unwrap_or(5.0);
        let p2_single = if !port2_enabled {
            0.0
        } else if p2_shape == "rectangular" {
            circuit::rect_port_area_m2(p2_width, p2_height)
        } else {
            circuit::circular_port_area_m2(r.port2_diameter.unwrap_or(10.0))
        };
        let port2_area_m2 = p2_single * r.port2_count.unwrap_or(1).max(1) as f64;

        // A slot has more wetted perimeter for its area than a round duct, so it loses
        // more. Scale the loss Q by how far its hydraulic diameter falls short.
        let q_port2 = if port2_enabled && p2_shape == "rectangular" {
            let perimeter = 2.0 * (p2_width * 0.01 + p2_height * 0.01);
            let hydraulic = 4.0 * p2_single / perimeter;
            let equivalent_round = 2.0 * (p2_single / std::f64::consts::PI).sqrt();
            (q_port * (hydraulic / equivalent_round).min(1.0)).max(10.0)
        } else {
            q_port
        };

        let box_volume_l = (r.v_box / num).max(0.001);
        let port_length_m = circuit::derive_port_length_m(
            total_port_area_m2 + port2_area_m2,
            r.tuning_freq,
            box_volume_l * 1e-3,
        );

        let area = circuit::circular_port_area_m2;
        let front_port_area_m2 = area(r.front_port_diameter.unwrap_or(r.port_diameter));
        let rear_port_area_m2 = area(r.rear_port_diameter.unwrap_or(r.port_diameter));
        let internal_port_area_m2 = area(r.internal_port_diameter.unwrap_or(r.port_diameter));

        let v_rear_l = r.v_rear.unwrap_or(box_volume_l).max(0.001);
        let v_front_l = r.v_front.unwrap_or(box_volume_l).max(0.001);
        let f_front = r.front_tuning_freq.unwrap_or(r.tuning_freq).max(0.1);
        let f_rear = r.rear_tuning_freq.unwrap_or(r.tuning_freq).max(0.1);
        let length = |a: f64, f: f64, litres: f64| circuit::derive_port_length_m(a, f, litres * 1e-3);

        Self {
            port_count,
            single_port_area_m2,
            total_port_area_m2,
            port2_enabled,
            port2_area_m2,
            q_port2,
            port_length_m,
            box_volume_l,
            front_port_area_m2,
            rear_port_area_m2,
            internal_port_area_m2,
            front_port_len_m: length(front_port_area_m2, f_front, v_front_l),
            rear_port_len_m: length(rear_port_area_m2, f_rear, v_rear_l),
            internal_port_len_m: length(internal_port_area_m2, f_rear, v_rear_l),
            v_rear_l,
            v_front_l,
        }
    }
}


/// Everything one curve needs from the surrounding simulation.
///
/// Each curve is a small piece of arithmetic over the solved circuit, but they need
/// different slices of the setup around them. Gathering that slice here lets the
/// curves live away from the assembly of the circuit, which is the other half of what
/// `simulate_system` does.
struct CurveContext<'a> {
    curve: &'a str,
    driver: &'a Driver,
    dp: &'a DriverParams,
    xo: &'a circuit::PassiveCrossoverSpec,
    /// The same driver with no enclosure, for the normalised transfer function.
    free_air: Option<&'a circuit::AcousticCircuit>,
    e_g: f64,
    num: f64,
    power: f64,
    power_per_driver: f64,
    distance: f64,
    env_gain: f64,
    /// Vent area the velocity curve divides by, already resolved for this enclosure.
    vent_area_m2: f64,
    /// The two port groups separately, when a vented box has both: their velocities
    /// differ and the worse one is what chuffs.
    split_vents: Option<(f64, f64)>,
    radiator_area_m2: f64,
}

impl CurveContext<'_> {
    /// Power the system can take at this frequency before it runs out of cone travel,
    /// and before it runs out of thermal rating. Whichever is lower is the ceiling.
    fn power_ceilings(&self, excursion_mm: f64) -> (f64, f64) {
        let thermal = if self.driver.pe > 0.0 {
            self.driver.pe * self.num
        } else {
            f64::INFINITY
        };
        // Excursion tracks voltage and power tracks voltage squared, so the headroom
        // before Xmax is quadratic in the ratio.
        let travel = if self.driver.xmax > 0.0 && excursion_mm > 1e-9 {
            self.power * (self.driver.xmax / excursion_mm).powi(2)
        } else {
            f64::INFINITY
        };
        (thermal, travel)
    }

    fn port_velocity(&self, solution: &circuit::CircuitSolution) -> f64 {
        if solution.port_velocities.is_empty() {
            return 0.0;
        }
        // With two groups, report the faster one: that is the one that whistles.
        if let Some((a, b)) = self.split_vents {
            if solution.port_velocities.len() >= 2 {
                let v1 = solution.port_velocities[0].norm() / a.max(1e-9);
                let v2 = solution.port_velocities[1].norm() / b.max(1e-9);
                return v1.max(v2);
            }
        }
        let total: num_complex::Complex64 = solution.port_velocities.iter().sum();
        if self.vent_area_m2 > 0.0 { total.norm() / self.vent_area_m2 } else { 0.0 }
    }

    /// Travel of the passive radiator, in the same peak convention as cone excursion.
    fn radiator_excursion_mm(&self, solution: &circuit::CircuitSolution, freq: f64) -> f64 {
        match solution.port_velocities.first() {
            None => 0.0,
            Some(u) => {
                let w = 2.0 * std::f64::consts::PI * freq;
                let j = num_complex::Complex64::new(0.0, 1.0);
                circuit::peak_displacement_mm(u / (j * w * self.radiator_area_m2))
            }
        }
    }

    fn value(&self, solution: &circuit::CircuitSolution, freq: f64) -> f64 {
        let spl = |gain: f64| compute_spl(solution.total_radiated_velocity * gain, freq, self.distance, self.env_gain);

        match self.curve {
            "excursion" => circuit::peak_displacement_mm(solution.driver_displacement),
            "pr_excursion" => self.radiator_excursion_mm(solution, freq),
            "velocity" => self.port_velocity(solution),
            "impedance" => solution.input_impedance.norm(),
            "spl" => spl(self.num),

            // What the enclosure alone contributes: the same driver with no box divides
            // out its coil, its sensitivity and the radiation model.
            "transfer_function" => match self.free_air {
                None => 0.0,
                Some(reference) => {
                    let free = solve_circuit(reference, freq, self.e_g, self.dp, self.xo);
                    spl(1.0) - compute_spl(free.total_radiated_velocity, freq, self.distance, self.env_gain)
                }
            },

            // The most the system reaches before whichever ceiling binds first. Output
            // is assumed to track power, which holds while the system stays linear —
            // it does not model thermal compression.
            "max_spl" => {
                let at_power = spl(self.num);
                let excursion = circuit::peak_displacement_mm(solution.driver_displacement);
                let (thermal, travel) = self.power_ceilings(excursion);
                let ceiling = thermal.min(travel);
                if ceiling.is_finite() && ceiling > 0.0 {
                    at_power + 10.0 * (ceiling / self.power).log10()
                } else {
                    at_power
                }
            }

            // "gain" / "transfer" — relative to the driver's rating, always half-space.
            _ => {
                let reference = if self.driver.sens > 0.0 { self.driver.sens } else { 90.0 };
                compute_spl(solution.total_radiated_velocity, freq, self.distance, 1.0)
                    - (reference + 10.0 * self.power_per_driver.log10())
            }
        }
    }

    /// Which ceiling binds, for the curves where that means something.
    fn limiting_factor(&self, solution: &circuit::CircuitSolution) -> Option<String> {
        if self.curve != "max_spl" {
            return None;
        }
        let excursion = circuit::peak_displacement_mm(solution.driver_displacement);
        let (thermal, travel) = self.power_ceilings(excursion);
        Some(if travel <= thermal { "excursion" } else { "power" }.to_string())
    }
}

#[tauri::command]
pub fn simulate_system(request: SimulationRequest) -> Vec<SimPoint> {
    // Worked out before the request is taken apart, since it needs the whole of it.
    let driver_count = if request.num_drivers > 0 { request.num_drivers as f64 } else { 1.0 };
    let vent_loss_q = request.port_q.unwrap_or(50.0).max(1.0);
    let geometry = EnclosureGeometry::from_request(&request, driver_count, vent_loss_q);

    // Destructured into the same names the body already uses, so the simulation code
    // below is untouched by this change.
    let SimulationRequest {
        driver, v_box, enclosure_type, tuning_freq, input_power, distance,
        num_drivers, curve_type, f_min, f_max,
        v_rear, v_front, front_tuning_freq,
        pr_mms, pr_sd, pr_fs, pr_qms,
        port_q, ql, spl_environment, driver_config,
        passive_xo_enabled, passive_xo_type, passive_xo_inductance, passive_xo_capacitance,
        passive_xo_dcr,

        // Every port dimension is EnclosureGeometry's business, and it has already
        // taken what it needs from the request above.
        port_diameter: _, port_shape: _, port_count: _, port_width: _, port_height: _,
        front_port_diameter: _, rear_port_diameter: _, internal_port_diameter: _,
        rear_tuning_freq: _,
        port2_enabled: _, port2_count: _, port2_diameter: _, port2_shape: _,
        port2_width: _, port2_height: _,

        // Only the alignment solver needs the radiator's travel limit; here the curve
        // is compared against it in the frontend.
        pr_xmax: _,
    } = request;

    let mut points = Vec::new();

    // ── Input validation ────────────────────────────────────────────────────
    let actual_f_min = if f_min > 0.0 { f_min } else { 10.0 };
    let actual_f_max = if f_max > actual_f_min { f_max } else { 2000.0 };

    if v_box <= 0.0 || driver.vas <= 0.0 || driver.qts <= 0.0 || driver.fs <= 0.0 {
        return points;
    }

    // Bandpass-specific validation
    if enclosure_type.starts_with("bandpass") {
        let vr = v_rear.unwrap_or(v_box);
        let vf = v_front.unwrap_or(v_box);
        if vr <= 0.0 || vf <= 0.0 { return points; }
        let ft = front_tuning_freq.unwrap_or(tuning_freq);
        if ft <= 0.0 { return points; }
    }

    // Ported validation
    if enclosure_type == "ported" && tuning_freq <= 0.0 {
        return points;
    }

    // ── Derived simulation parameters ───────────────────────────────────────
    let n_points = 150;
    let log_min = actual_f_min.log10();
    let log_max = actual_f_max.log10();
    let step = (log_max - log_min) / (n_points - 1) as f64;

    let num = if num_drivers > 0 { num_drivers as f64 } else { 1.0 };
    let p = if input_power > 0.0 { input_power } else { 1.0 };
    let p_per_driver = p / num;
    let d = if distance > 0.0 { distance } else { 1.0 };

    let q_port = port_q.unwrap_or(50.0).max(1.0);
    let q_loss = resolve_q_loss(ql);
    let env_gain = env_gain_from_str(spl_environment.as_deref());

    let dp = {
        let base = driver_to_params(&driver);
        apply_driver_config(base, driver_config.as_deref().unwrap_or("standard"))
    };

    // Drive voltage has to come from the *configured* Re. An isobaric pair presents
    // 2·Re in series or Re/2 in parallel, so deriving it from the raw driver Re would
    // under-drive one wiring and over-drive the other by 6 dB at the same input power.
    let re = if dp.re > 0.0 { dp.re } else { 4.0 };
    let e_g = (p_per_driver * re).sqrt();

    let EnclosureGeometry {
        port_count: port_count_val,
        single_port_area_m2,
        total_port_area_m2: total_port_area,
        port2_enabled: p2_enabled,
        port2_area_m2: p2_total_area,
        q_port2,
        port_length_m,
        box_volume_l: v_box_effective,
        front_port_area_m2,
        rear_port_area_m2,
        internal_port_area_m2,
        front_port_len_m: front_port_len,
        rear_port_len_m: rear_port_len,
        internal_port_len_m: internal_port_len,
        v_rear_l: v_r,
        v_front_l: v_f,
    } = geometry;

    // ── Build circuit ────────────────────────────────────────────────────────
    let mut ac_circuit = match enclosure_type.as_str() {
        "ported" => build_vented(
            &dp, v_box_effective, single_port_area_m2, port_length_m, port_count_val,
            q_port, q_loss,
        ),
        "bandpass4" => build_bandpass4(
            &dp, v_r, v_f, front_port_area_m2, front_port_len,
            q_port, q_loss,
        ),
        "bandpass6_parallel" => build_bandpass6_parallel(
            &dp, v_r, v_f,
            rear_port_area_m2, rear_port_len,
            front_port_area_m2, front_port_len,
            q_port, q_loss,
        ),
        "bandpass6_series" => build_bandpass6_series(
            &dp, v_r, v_f,
            internal_port_area_m2, internal_port_len,
            front_port_area_m2, front_port_len,
            q_port, q_loss,
        ),
        "passive_radiator" => build_passive_radiator(
            &dp, v_box_effective,
            pr_mms.unwrap_or(200.0),
            pr_sd.unwrap_or(driver.sd),
            pr_fs.unwrap_or(tuning_freq.max(0.1)),
            pr_qms.unwrap_or(5.0),
            q_loss,
        ),
        _ => build_sealed(&dp, v_box_effective, q_loss),
    };

    // ── Inject second port group for ported enclosures ───────────────────────
    if enclosure_type == "ported" && p2_enabled && p2_total_area > 0.0 {
        use circuit::{CircuitElement, ElementType, ExternalNode};
        ac_circuit.elements.push(CircuitElement {
            element_type: ElementType::Port {
                area_m2: p2_total_area,
                length_m: port_length_m,
                q_port: q_port2,
            },
            node_a: 0,
            node_b: 1,
        });
        ac_circuit.elements.push(CircuitElement {
            element_type: ElementType::RadiationLoad { area_m2: p2_total_area },
            node_a: 1,
            node_b: -1,
        });
        ac_circuit.external_nodes.push(ExternalNode {
            node_idx: 1,
            area_m2: p2_total_area,
            is_port: true,
        });
    }

    let xo = circuit::PassiveCrossoverSpec {
        enabled: passive_xo_enabled.unwrap_or(false),
        filter_type: passive_xo_type.unwrap_or_else(|| "lowpass_1st".to_string()),
        inductance_mh: passive_xo_inductance.unwrap_or(0.0),
        capacitance_uf: passive_xo_capacitance.unwrap_or(0.0),
        r_series: passive_xo_dcr.unwrap_or(0.0),
    };

    // The transfer function is the box's own contribution, so it needs the same driver
    // with no enclosure to divide out. Solving both and taking the difference cancels
    // everything driver-specific — voice coil inductance, sensitivity, radiation model
    // — and leaves only what the enclosure did.
    let free_air = if curve_type == "transfer_function" {
        Some(build_sealed(&dp, FREE_AIR_VOLUME_L, q_loss))
    } else {
        None
    };

    // Everything each curve needs, gathered once rather than reached for inside the
    // sweep. The vent area is resolved here because it differs per enclosure.
    let vent_area_m2 = match enclosure_type.as_str() {
        "ported" => total_port_area,
        "bandpass4" | "bandpass6_series" => front_port_area_m2,
        "bandpass6_parallel" => front_port_area_m2 + rear_port_area_m2,
        "passive_radiator" => (pr_sd.unwrap_or(driver.sd) * 1e-4).max(1e-6),
        _ => total_port_area.max(0.001),
    };
    let context = CurveContext {
        curve: curve_type.as_str(),
        driver: &driver,
        dp: &dp,
        xo: &xo,
        free_air: free_air.as_ref(),
        e_g,
        num,
        power: p,
        power_per_driver: p_per_driver,
        distance: d,
        env_gain,
        vent_area_m2,
        split_vents: if enclosure_type == "ported" && p2_enabled {
            Some((total_port_area, p2_total_area))
        } else {
            None
        },
        radiator_area_m2: (pr_sd.unwrap_or(driver.sd) * 1e-4).max(1e-6),
    };

    // ── Simulate at each frequency point ────────────────────────────────────
    for i in 0..n_points {
        let freq = 10.0_f64.powf(log_min + i as f64 * step);
        let solution = solve_circuit(&ac_circuit, freq, e_g, &dp, &xo);

        points.push(SimPoint {
            frequency: freq,
            db: context.value(&solution, freq),
            phase_rad: solution.total_radiated_velocity.arg(),
            limited_by: context.limiting_factor(&solution),
        });
    }

    points
}


/// Payload for `simulate_custom`. Same reasoning as [`SimulationRequest`]: named
/// fields and a `Default` beat a positional tail of `Option`s.
#[derive(serde::Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase", default)]
pub struct CustomSimulationRequest {
    pub driver: Driver,
    pub custom_topology: CustomTopologySpec,
    pub input_power: f64,
    pub distance: f64,
    pub num_drivers: i32,
    pub curve_type: String,
    pub f_min: f64,
    pub f_max: f64,
    pub port_q: Option<f64>,
    pub ql: Option<f64>,
    pub spl_environment: Option<String>,
    pub driver_config: Option<String>,
    pub passive_xo_enabled: Option<bool>,
    pub passive_xo_type: Option<String>,
    pub passive_xo_inductance: Option<f64>,
    pub passive_xo_capacitance: Option<f64>,
    pub passive_xo_dcr: Option<f64>,
}

impl Default for CustomSimulationRequest {
    fn default() -> Self {
        Self {
            driver: Driver::default(),
            custom_topology: CustomTopologySpec::default(),
            input_power: 1.0,
            distance: 1.0,
            num_drivers: 1,
            curve_type: "spl".to_string(),
            f_min: 10.0,
            f_max: 2000.0,
            port_q: None,
            ql: None,
            spl_environment: None,
            driver_config: None,
            passive_xo_enabled: None,
            passive_xo_type: None,
            passive_xo_inductance: None,
            passive_xo_capacitance: None,
            passive_xo_dcr: None,
        }
    }
}

#[tauri::command]
pub fn simulate_custom(request: CustomSimulationRequest) -> Vec<SimPoint> {
    // Destructured into the names the body already uses; the body is unchanged.
    let CustomSimulationRequest {
        driver, custom_topology, input_power, distance, num_drivers, curve_type, f_min, f_max,
        port_q, ql, spl_environment, driver_config,
        passive_xo_enabled, passive_xo_type, passive_xo_inductance, passive_xo_capacitance,
        passive_xo_dcr,
    } = request;

    let actual_f_min = if f_min > 0.0 { f_min } else { 10.0 };
    let actual_f_max = if f_max > actual_f_min { f_max } else { 2000.0 };

    if driver.vas <= 0.0 || driver.qts <= 0.0 || driver.fs <= 0.0 {
        return Vec::new();
    }

    let n_points = 150;
    let log_min = actual_f_min.log10();
    let log_max = actual_f_max.log10();
    let step = (log_max - log_min) / (n_points - 1) as f64;

    let num = if num_drivers > 0 { num_drivers as f64 } else { 1.0 };
    let p = if input_power > 0.0 { input_power } else { 1.0 };
    let p_per_driver = p / num;
    let d = if distance > 0.0 { distance } else { 1.0 };

    let q_port = port_q.unwrap_or(50.0).max(1.0);
    let q_loss = resolve_q_loss(ql);
    let env_gain = env_gain_from_str(spl_environment.as_deref());

    let dp = {
        let base = driver_to_params(&driver);
        apply_driver_config(base, driver_config.as_deref().unwrap_or("standard"))
    };

    // Drive voltage comes from the configured Re — see simulate_system.
    let re = if dp.re > 0.0 { dp.re } else { 4.0 };
    let e_g = (p_per_driver * re).sqrt();

    let ac = custom_topology::build_custom_circuit(&custom_topology, &dp, q_port, q_loss);
    let port_area = custom_topology::total_external_port_area(&custom_topology);

    let xo = circuit::PassiveCrossoverSpec {
        enabled: passive_xo_enabled.unwrap_or(false),
        filter_type: passive_xo_type.unwrap_or_else(|| "lowpass_1st".to_string()),
        inductance_mh: passive_xo_inductance.unwrap_or(0.0),
        capacitance_uf: passive_xo_capacitance.unwrap_or(0.0),
        r_series: passive_xo_dcr.unwrap_or(0.0),
    };

    let mut points = Vec::new();
    for i in 0..n_points {
        let freq = 10.0_f64.powf(log_min + i as f64 * step);
        let sol = solve_circuit(&ac, freq, e_g, &dp, &xo);

        let val = match curve_type.as_str() {
            "excursion" => circuit::peak_displacement_mm(sol.driver_displacement),
            "velocity" => {
                if sol.port_velocities.is_empty() || port_area <= 0.0 {
                    0.0
                } else {
                    let u: num_complex::Complex64 = sol.port_velocities.iter().sum();
                    u.norm() / port_area
                }
            }
            "impedance" => sol.input_impedance.norm(),
            "spl" => compute_spl(sol.total_radiated_velocity * num, freq, d, env_gain),
            _ => {
                let spl = compute_spl(sol.total_radiated_velocity, freq, d, 1.0);
                let s_ref = if driver.sens > 0.0 { driver.sens } else { 90.0 };
                spl - (s_ref + 10.0 * p_per_driver.log10())
            }
        };
        let phase_rad = sol.total_radiated_velocity.arg();
        points.push(SimPoint { frequency: freq, db: val, phase_rad, limited_by: None });
    }
    points
}


#[cfg(test)]
mod tests {
    use super::*;
    use crate::model::{Driver, SimPoint};
    use crate::test_support::bc21;

    /// Helper — simulate_system with only the first 15 required params;
    /// all optional params default to None.
    fn sim(
        driver: Driver,
        v_box: f64,
        enc: &str,
        tuning: f64,
        port_diam: f64,
        power: f64,
        dist: f64,
        n_drv: i32,
        curve: &str,
        f_min: f64,
        f_max: f64,
    ) -> Vec<SimPoint> {
        simulate_system(SimulationRequest {
            driver,
            v_box,
            enclosure_type: enc.to_string(),
            tuning_freq: tuning,
            port_diameter: port_diam,
            input_power: power,
            distance: dist,
            num_drivers: n_drv,
            curve_type: curve.to_string(),
            f_min,
            f_max,
            ..Default::default()
        })
    }

    /// Series and parallel differ only in wiring, so every acoustic quantity — and
    /// therefore the whole simulated response — must be identical between them.
    #[test]
    fn test_isobaric_series_and_parallel_agree_acoustically() {
        let d = bc21();
        let series = sim_cfg(&d, "isobaric_series");
        let parallel = sim_cfg(&d, "isobaric_parallel");

        for (a, b) in series.iter().zip(parallel.iter()) {
            assert!(
                (a.db - b.db).abs() < 0.01,
                "at {:.1} Hz series gives {:.2} dB but parallel gives {:.2} dB",
                a.frequency, a.db, b.db
            );
        }
    }

    fn sim_cfg(d: &Driver, cfg: &str) -> Vec<SimPoint> {
        simulate_system(SimulationRequest {
            driver: d.clone(),
            v_box: 150.0,
            tuning_freq: 33.0,
            input_power: 100.0,
            f_min: 20.0,
            f_max: 200.0,
            driver_config: Some(cfg.to_string()),
            ..Default::default()
        })
    }

    /// Full-parameter probe covering the optional argument groups too, so the
    /// characterization table exercises port 2, the crossover and isobaric paths and
    /// not just the happy path.
    fn characterization_case(enc: &str, curve: &str, variant: &str) -> Vec<SimPoint> {
        let port2 = variant == "port2";
        let xo = variant == "xo";
        let iso = variant == "isobaric";
        simulate_system(SimulationRequest {
            driver: bc21(),
            v_box: 120.0,
            enclosure_type: enc.to_string(),
            tuning_freq: 32.0,
            input_power: 100.0,
            curve_type: curve.to_string(),
            port_count: 2,
            v_rear: Some(80.0),
            v_front: Some(40.0),
            front_tuning_freq: Some(55.0),
            rear_tuning_freq: Some(30.0),
            front_port_diameter: Some(10.0),
            rear_port_diameter: Some(10.0),
            internal_port_diameter: Some(10.0),
            pr_mms: Some(300.0),
            pr_sd: Some(1680.0),
            pr_fs: Some(25.0),
            pr_qms: Some(5.0),
            port_q: Some(45.0),
            // Pinned to the lossless compliance the golden values were captured under,
            // so this keeps verifying that the refactors changed nothing. Box losses
            // arrived later and are covered by their own tests.
            ql: Some(200.0),
            spl_environment: Some("corner".to_string()),
            driver_config: Some(
                if iso { "isobaric_parallel" } else { "standard" }.to_string(),
            ),
            port2_enabled: Some(port2),
            port2_count: Some(1),
            port2_diameter: Some(8.0),
            port2_shape: Some("rectangular".to_string()),
            port2_width: Some(20.0),
            port2_height: Some(5.0),
            passive_xo_enabled: Some(xo),
            passive_xo_type: Some("lowpass_2nd".to_string()),
            passive_xo_inductance: Some(1.2),
            passive_xo_capacitance: Some(45.0),
            passive_xo_dcr: Some(0.3),
            ..Default::default()
        })
    }

    const CHAR_CASES: [(&str, &str, &str); 9] = [
        ("sealed", "spl", "plain"),
        ("sealed", "impedance", "xo"),
        ("sealed", "excursion", "isobaric"),
        ("ported", "spl", "plain"),
        ("ported", "velocity", "port2"),
        ("bandpass4", "spl", "plain"),
        ("bandpass6_parallel", "spl", "plain"),
        ("bandpass6_series", "impedance", "plain"),
        ("passive_radiator", "spl", "plain"),
    ];

    const CHAR_INDICES: [usize; 5] = [0, 37, 74, 111, 149];

    /// Golden values captured from this code before the request-struct refactor.
    ///
    /// The refactor changes only how arguments reach `simulate_system`, never any
    /// arithmetic, so every one of these must still match to the last decimal. Regenerate
    /// with `emit_characterization_table` only when a physics change is *intended* — a
    /// diff here otherwise means the plumbing altered a result.
    const CHAR_EXPECTED: [(&str, &str, &str, [f64; 5]); 9] = [
        ("sealed", "spl", "plain", [96.752201, 118.711427, 127.833706, 122.126194, 113.185279]),
        ("sealed", "impedance", "xo", [5.144724, 25.498718, 3.703777, 10.768660, 13.095581]),
        ("sealed", "excursion", "isobaric", [4.114422, 2.909240, 0.516877, 0.020383, 0.000526]),
        ("ported", "spl", "plain", [87.417067, 122.297480, 128.249804, 122.039439, 113.285535]),
        ("ported", "velocity", "port2", [3.955145, 4.244089, 0.075362, 0.017760, 0.003952]),
        ("bandpass4", "spl", "plain", [95.130726, 121.140303, 115.767803, 83.013379, 50.899526]),
        ("bandpass6_parallel", "spl", "plain", [87.808894, 129.281427, 113.602092, 80.310010, 48.210782]),
        ("bandpass6_series", "impedance", "plain", [7.037130, 4.970519, 10.467120, 6.115410, 15.386410]),
        ("passive_radiator", "spl", "plain", [87.536417, 111.806464, 129.127595, 122.210058, 113.054191]),
    ];

    #[test]
    fn test_simulation_output_is_unchanged() {
        for (enc, curve, variant, expected) in CHAR_EXPECTED {
            let pts = characterization_case(enc, curve, variant);
            assert_eq!(pts.len(), 150, "{enc}/{curve}/{variant}: sweep length changed");
            for (slot, &i) in CHAR_INDICES.iter().enumerate() {
                let got = pts[i].db;
                assert!(
                    (got - expected[slot]).abs() < 1e-6,
                    "{enc}/{curve}/{variant} at {:.2} Hz: expected {:.6}, got {:.6}",
                    pts[i].frequency, expected[slot], got
                );
            }
        }
    }

    #[test]
    #[ignore = "generator: cargo test -- --ignored --nocapture emit_characterization_table"]
    fn emit_characterization_table() {
        for (enc, curve, variant) in CHAR_CASES {
            let pts = characterization_case(enc, curve, variant);
            let vals: Vec<String> = CHAR_INDICES
                .iter()
                .map(|&i| format!("{:.6}", pts[i].db))
                .collect();
            println!("        ({enc:?}, {curve:?}, {variant:?}, [{}]),", vals.join(", "));
        }
    }

    /// The camelCase payload the frontend sends must still land in the right fields.
    ///
    /// Tauri used to convert each argument name itself; now serde's `rename_all` does
    /// it, and nothing in the type system checks that the two agree. This asserts the
    /// wire contract directly, using the exact keys `useSimulation.ts` sends.
    #[test]
    fn test_simulation_request_deserializes_frontend_payload() {
        let payload = serde_json::json!({
            "driver": bc21(),
            "vBox": 120.0,
            "enclosureType": "ported",
            "tuningFreq": 32.0,
            "portDiameter": 10.0,
            "inputPower": 100.0,
            "distance": 2.0,
            "numDrivers": 2,
            "curveType": "spl",
            "fMin": 10.0,
            "fMax": 2000.0,
            "portShape": "rectangular",
            "portCount": 2,
            "portWidth": 20.0,
            "portHeight": 5.0,
            "vRear": 80.0,
            "vFront": 40.0,
            "frontTuningFreq": 55.0,
            "rearTuningFreq": 30.0,
            "frontPortDiameter": 11.0,
            "rearPortDiameter": 12.0,
            "internalPortDiameter": 13.0,
            "prMms": 300.0,
            "prSd": 1680.0,
            "prFs": 25.0,
            "prQms": 5.0,
            "portQ": 45.0,
            "splEnvironment": "corner",
            "driverConfig": "isobaric_series",
            "port2Enabled": true,
            "port2Count": 3,
            "port2Diameter": 8.0,
            "port2Shape": "circular",
            "port2Width": 21.0,
            "port2Height": 6.0,
            "passiveXoEnabled": true,
            "passiveXoType": "lowpass_2nd",
            "passiveXoInductance": 1.2,
            "passiveXoCapacitance": 45.0,
            "passiveXoDcr": 0.3,
        });

        let r: SimulationRequest = serde_json::from_value(payload).expect("payload must parse");

        assert_eq!(r.v_box, 120.0);
        assert_eq!(r.enclosure_type, "ported");
        assert_eq!(r.num_drivers, 2);
        assert_eq!(r.port_shape, "rectangular");
        assert_eq!(r.port_count, 2);
        assert_eq!(r.v_rear, Some(80.0));
        assert_eq!(r.internal_port_diameter, Some(13.0));
        assert_eq!(r.pr_qms, Some(5.0));
        assert_eq!(r.port_q, Some(45.0));
        assert_eq!(r.spl_environment.as_deref(), Some("corner"));
        assert_eq!(r.driver_config.as_deref(), Some("isobaric_series"));
        assert_eq!(r.port2_enabled, Some(true));
        assert_eq!(r.port2_count, Some(3));
        assert_eq!(r.port2_height, Some(6.0));
        assert_eq!(r.passive_xo_enabled, Some(true));
        assert_eq!(r.passive_xo_dcr, Some(0.3));
        assert_eq!(r.driver.model, bc21().model);
    }

    /// An omitted key must fall back to the documented default rather than failing the
    /// whole call — that is what makes `..Default::default()` safe at call sites.
    #[test]
    fn test_simulation_request_defaults_missing_fields() {
        let r: SimulationRequest =
            serde_json::from_value(serde_json::json!({ "vBox": 50.0 })).expect("must parse");
        assert_eq!(r.v_box, 50.0);
        assert_eq!(r.enclosure_type, "sealed");
        assert_eq!(r.curve_type, "spl");
        assert_eq!(r.f_min, 10.0);
        assert_eq!(r.f_max, 2000.0);
        assert_eq!(r.num_drivers, 1);
        assert_eq!(r.port_shape, "circular");
        assert_eq!(r.port_q, None);
    }

    #[test]
    fn test_custom_simulation_request_deserializes_frontend_payload() {
        let payload = serde_json::json!({
            "driver": bc21(),
            "customTopology": {
                "rear":  { "volume_liters": 80.0, "port": null, "pr": null },
                "front": { "volume_liters": 0.0,  "port": null, "pr": null },
                "internal_port": null,
            },
            "inputPower": 100.0,
            "distance": 1.0,
            "numDrivers": 1,
            "curveType": "spl",
            "fMin": 10.0,
            "fMax": 1000.0,
            "portQ": 50.0,
            "splEnvironment": "half_space",
            "driverConfig": "standard",
            "passiveXoEnabled": false,
            "passiveXoType": "lowpass_1st",
            "passiveXoInductance": 0.0,
            "passiveXoCapacitance": 0.0,
            "passiveXoDcr": 0.0,
        });
        let r: CustomSimulationRequest =
            serde_json::from_value(payload).expect("payload must parse");
        assert_eq!(r.input_power, 100.0);
        assert_eq!(r.f_max, 1000.0);
        assert_eq!(r.custom_topology.rear.volume_liters, 80.0);
        assert_eq!(r.spl_environment.as_deref(), Some("half_space"));
    }

    /// Box losses damp the two impedance peaks of a vented system and fill in the
    /// saddle between them. A tight cabinet should therefore show taller peaks than a
    /// leaky one, and the default should sit between the extremes.
    #[test]
    fn test_enclosure_losses_damp_the_impedance_peaks() {
        let peak_height = |ql: Option<f64>| -> f64 {
            simulate_system(SimulationRequest {
                driver: bc21(),
                v_box: 150.0,
                enclosure_type: "ported".to_string(),
                tuning_freq: 30.0,
                curve_type: "impedance".to_string(),
                f_max: 200.0,
                ql,
                ..Default::default()
            })
            .iter()
            .map(|p| p.db)
            .fold(0.0, f64::max)
        };

        let leaky = peak_height(Some(3.0));
        let normal = peak_height(None); // the default
        let tight = peak_height(Some(200.0));

        assert!(leaky < normal, "a leaky box should damp more: {leaky:.1} vs {normal:.1} Ω");
        assert!(normal < tight, "the default should be lossier than near-lossless: {normal:.1} vs {tight:.1} Ω");
    }

    #[test]
    fn test_default_enclosure_loss_is_applied_when_absent() {
        // An omitted ql must land on the documented default, not on lossless.
        let with_default = simulate_system(SimulationRequest {
            driver: bc21(), v_box: 150.0, enclosure_type: "ported".to_string(),
            tuning_freq: 30.0, curve_type: "impedance".to_string(), f_max: 200.0,
            ..Default::default()
        });
        let explicit = simulate_system(SimulationRequest {
            driver: bc21(), v_box: 150.0, enclosure_type: "ported".to_string(),
            tuning_freq: 30.0, curve_type: "impedance".to_string(), f_max: 200.0,
            ql: Some(DEFAULT_Q_LOSS),
            ..Default::default()
        });
        for (a, b) in with_default.iter().zip(explicit.iter()) {
            assert!((a.db - b.db).abs() < 1e-9);
        }
    }

    /// The max-SPL curve is the lower of two ceilings, and says which one it hit.
    #[test]
    fn test_max_spl_takes_the_lower_of_excursion_and_power() {
        let sweep = |xmax: f64, pe: f64| {
            let mut d = bc21();
            d.xmax = xmax;
            d.pe = pe;
            simulate_system(SimulationRequest {
                driver: d,
                v_box: 150.0,
                enclosure_type: "ported".to_string(),
                tuning_freq: 30.0,
                input_power: 100.0,
                curve_type: "max_spl".to_string(),
                f_min: 15.0,
                f_max: 200.0,
                ..Default::default()
            })
        };

        // A short-throw, high-power driver runs out of travel long before it runs out
        // of thermal headroom, so excursion binds everywhere.
        let cone_bound = sweep(2.0, 5000.0);
        assert!(
            cone_bound.iter().all(|p| p.limited_by.as_deref() == Some("excursion")),
            "a 2 mm driver rated 5 kW should be excursion limited across the band"
        );

        // Reverse it and the coil's rating binds instead.
        let coil_bound = sweep(60.0, 50.0);
        assert!(
            coil_bound.iter().all(|p| p.limited_by.as_deref() == Some("power")),
            "a 60 mm driver rated 50 W should be power limited across the band"
        );

        // A realistic driver hits its cone near tuning and its coil further up, so the
        // curve should report both somewhere.
        let mixed = sweep(14.0, 1700.0);
        let kinds: std::collections::HashSet<_> =
            mixed.iter().filter_map(|p| p.limited_by.as_deref()).collect();
        assert_eq!(kinds.len(), 2, "expected both limits to bind somewhere, saw {kinds:?}");
    }

    #[test]
    fn test_max_spl_sits_above_the_rated_power_response() {
        let base = SimulationRequest {
            driver: bc21(), v_box: 150.0, enclosure_type: "ported".to_string(),
            tuning_freq: 30.0, input_power: 1.0, f_min: 20.0, f_max: 200.0,
            ..Default::default()
        };
        let at_1w = simulate_system(SimulationRequest { curve_type: "spl".to_string(), ..base.clone() });
        let max = simulate_system(SimulationRequest { curve_type: "max_spl".to_string(), ..base });

        // bc21 takes far more than a watt, so its ceiling is well above its 1 W curve.
        for (a, b) in at_1w.iter().zip(max.iter()) {
            assert!(b.db > a.db, "at {:.1} Hz max SPL {:.1} is not above 1 W {:.1}", a.frequency, b.db, a.db);
        }
    }

    /// Only the max-SPL curve carries a limit tag; the field is absent elsewhere.
    #[test]
    fn test_other_curves_carry_no_limit_tag() {
        for curve in ["spl", "excursion", "impedance", "velocity", "transfer"] {
            let pts = simulate_system(SimulationRequest {
                driver: bc21(), v_box: 150.0, enclosure_type: "ported".to_string(),
                tuning_freq: 30.0, curve_type: curve.to_string(),
                ..Default::default()
            });
            assert!(pts.iter().all(|p| p.limited_by.is_none()), "{curve} should not be tagged");
        }
    }

    /// The transfer function isolates the enclosure by dividing out the same driver
    /// with no box, so nothing driver-specific should survive.
    #[test]
    fn test_transfer_function_isolates_the_enclosure() {
        let curve = |driver: Driver, vb: f64, fb: f64| {
            simulate_system(SimulationRequest {
                driver, v_box: vb, enclosure_type: "ported".to_string(), tuning_freq: fb,
                input_power: 1.0, curve_type: "transfer_function".to_string(),
                f_min: 10.0, f_max: 2000.0, ..Default::default()
            })
        };

        let pts = curve(bc21(), 150.0, 30.0);

        // Well above the passband the box does nothing, so the curve must return to 0.
        let top = pts.iter().filter(|p| p.frequency > 500.0);
        for p in top {
            assert!(p.db.abs() < 0.5, "at {:.0} Hz the box still shows {:.2} dB", p.frequency, p.db);
        }

        // The port contributes at tuning and cuts off below it, so the box must be
        // worth more at Fb than an octave down.
        let at = |t: f64| pts.iter().min_by(|a, b|
            (a.frequency - t).abs().partial_cmp(&(b.frequency - t).abs()).unwrap()).unwrap().db;
        assert!(
            at(30.0) > at(15.0) + 3.0,
            "at tuning {:.2} dB against {:.2} dB an octave below", at(30.0), at(15.0)
        );
    }

    /// Voice coil inductance dominates the plain SPL curve above the passband. It is
    /// present on both sides of the division here, so it should all but vanish.
    #[test]
    fn test_transfer_function_is_blind_to_voice_coil_inductance() {
        let sweep = |curve: &str, le: f64| {
            let mut d = bc21();
            d.le = le;
            simulate_system(SimulationRequest {
                driver: d, v_box: 150.0, enclosure_type: "ported".to_string(),
                tuning_freq: 30.0, input_power: 1.0, curve_type: curve.to_string(),
                f_min: 10.0, f_max: 2000.0, ..Default::default()
            })
        };
        let worst = |curve: &str, from: f64| {
            sweep(curve, 0.3).iter().zip(sweep(curve, 4.0).iter())
                .filter(|(a, _)| a.frequency >= from)
                .map(|(a, b)| (a.db - b.db).abs())
                .fold(0.0, f64::max)
        };

        // Where inductance rules the response, it disappears almost entirely.
        let above_passband_spl = worst("spl", 100.0);
        let above_passband_tf = worst("transfer_function", 100.0);
        assert!(
            above_passband_spl > 10.0,
            "test premise: a 13x change in Le should move the SPL curve, saw {above_passband_spl:.2} dB"
        );
        // Cancellation is very good rather than exact: the box loads the cone somewhat
        // differently from free air, so a trace of Le survives. The claim worth making
        // is the size of the reduction, not an absolute figure.
        assert!(
            above_passband_tf < above_passband_spl * 0.05,
            "transfer function moved {above_passband_tf:.2} dB against {above_passband_spl:.2} dB on SPL \
             — expected under 5% of it"
        );
        // Below tuning the box and free air load the cone quite differently, so a
        // trace survives there — around 1.4 dB against 18 dB on SPL. The claim worth
        // asserting is where inductance actually rules the response.
    }

    /// Sensitivity and drive level cancel too, so two identical boxes compare directly
    /// however the drivers are rated.
    #[test]
    fn test_transfer_function_ignores_sensitivity_and_power() {
        let variant = |sens: f64, power: f64| {
            let mut d = bc21();
            d.sens = sens;
            simulate_system(SimulationRequest {
                driver: d, v_box: 150.0, enclosure_type: "ported".to_string(),
                tuning_freq: 30.0, input_power: power,
                curve_type: "transfer_function".to_string(), f_min: 10.0, f_max: 500.0,
                ..Default::default()
            })
        };
        for (a, b) in variant(85.0, 1.0).iter().zip(variant(99.0, 500.0).iter()) {
            assert!((a.db - b.db).abs() < 1e-9, "at {:.0} Hz: {:.4} vs {:.4}", a.frequency, a.db, b.db);
        }
    }

    /// A sealed box has no port, so it cannot add the gain a vented one does. It can
    /// still rise slightly around its corner, because sealing the box raises system Q
    /// above the driver's free-air value — here from 0.36 to 0.70.
    #[test]
    fn test_sealed_transfer_function_attenuates_without_port_gain() {
        let pts = simulate_system(SimulationRequest {
            driver: bc21(), v_box: 100.0, enclosure_type: "sealed".to_string(),
            input_power: 1.0, curve_type: "transfer_function".to_string(),
            f_min: 10.0, f_max: 500.0, ..Default::default()
        });
        let at = |t: f64| pts.iter().min_by(|a, b|
            (a.frequency - t).abs().partial_cmp(&(b.frequency - t).abs()).unwrap()).unwrap().db;

        assert!(
            pts.iter().all(|p| p.db < 2.0),
            "a sealed box should not approach port-like gain, peak was {:.2} dB",
            pts.iter().map(|p| p.db).fold(f64::MIN, f64::max)
        );
        // Well below the corner the box is pure loss.
        assert!(at(15.0) < -6.0, "expected clear attenuation below the corner, saw {:.2} dB", at(15.0));
    }

    /// A passive radiator moves far more than the cone that drives it, which is why it
    /// needs its own excursion limit rather than being assumed safe.
    #[test]
    fn test_pr_excursion_exceeds_cone_excursion_near_tuning() {
        let sweep = |curve: &str| simulate_system(SimulationRequest {
            driver: bc21(), v_box: 150.0, enclosure_type: "passive_radiator".to_string(),
            input_power: 100.0, curve_type: curve.to_string(), f_min: 10.0, f_max: 200.0,
            pr_mms: Some(300.0), pr_sd: Some(1680.0), pr_fs: Some(25.0), pr_qms: Some(5.0),
            ..Default::default()
        });
        let cone = sweep("excursion");
        let pr = sweep("pr_excursion");

        let at = |pts: &[SimPoint], t: f64| pts.iter().min_by(|a, b|
            (a.frequency - t).abs().partial_cmp(&(b.frequency - t).abs()).unwrap()).unwrap().db;

        // System tuning is where the cone unloads — its excursion minimum. There the
        // radiator is doing the work, and moves several times further than the cone.
        let tuning = cone.iter().enumerate()
            .filter(|(_, p)| p.frequency > 15.0 && p.frequency < 100.0)
            .min_by(|(_, a), (_, b)| a.db.partial_cmp(&b.db).unwrap())
            .map(|(i, _)| i)
            .expect("the cone should have an excursion minimum");

        assert!(
            pr[tuning].db > cone[tuning].db * 2.0,
            "at tuning ({:.1} Hz) the radiator moved {:.2} mm against the cone's {:.2} mm",
            cone[tuning].frequency, pr[tuning].db, cone[tuning].db
        );
        assert!(pr.iter().all(|p| p.db.is_finite() && p.db >= 0.0));

        // Well above tuning the radiator falls still while the cone keeps working, so
        // neither one is simply "the larger" — which is why both need watching.
        let high = cone.len() - 1;
        assert!(pr[high].db < cone[high].db, "the radiator should settle above tuning");
    }

    /// A heavier radiator tunes lower and travels less at any given frequency above it.
    #[test]
    fn test_pr_excursion_responds_to_radiator_mass() {
        let with_mass = |mms: f64| simulate_system(SimulationRequest {
            driver: bc21(), v_box: 150.0, enclosure_type: "passive_radiator".to_string(),
            input_power: 100.0, curve_type: "pr_excursion".to_string(),
            f_min: 10.0, f_max: 200.0,
            pr_mms: Some(mms), pr_sd: Some(1680.0), pr_fs: Some(25.0), pr_qms: Some(5.0),
            ..Default::default()
        });
        let peak = |pts: Vec<SimPoint>| pts.iter().map(|p| p.db).fold(0.0, f64::max);
        assert!(peak(with_mass(150.0)) > peak(with_mass(600.0)));
    }

    /// Only a passive radiator has one, so nothing else should report movement.
    #[test]
    fn test_pr_excursion_is_zero_without_a_radiator() {
        let pts = simulate_system(SimulationRequest {
            driver: bc21(), v_box: 150.0, enclosure_type: "sealed".to_string(),
            input_power: 100.0, curve_type: "pr_excursion".to_string(),
            f_min: 10.0, f_max: 200.0, ..Default::default()
        });
        assert!(pts.iter().all(|p| p.db == 0.0));
    }

    #[test]
    fn test_sealed_analytical_accuracy() {
        let points = sim(bc21(), 100.0, "sealed", 33.0, 10.0, 1.0, 1.0, 1, "gain", 10.0, 2000.0);

        let fc = 64.159;
        let closest = points.iter().min_by(|a, b| {
            (a.frequency - fc).abs().partial_cmp(&(b.frequency - fc).abs()).unwrap()
        }).unwrap();

        assert!((closest.frequency - fc).abs() < 2.0);
        assert!((closest.db - -3.10).abs() < 2.0);
    }

    #[test]
    fn test_spl_scaling_accuracy() {
        let points = sim(bc21(), 150.0, "sealed", 33.0, 10.0, 100.0, 2.0, 2, "spl", 10.0, 2000.0);
        let high_f = points.iter().find(|p| p.frequency > 100.0 && p.frequency < 200.0).unwrap();
        assert!(high_f.db > 100.0 && high_f.db < 125.0);
    }

    #[test]
    fn test_ported_excursion_dip() {
        let fb = 33.0;
        let points = sim(bc21(), 200.0, "ported", fb, 10.0, 100.0, 1.0, 1, "excursion", 10.0, 2000.0);
        let closest = points.iter().min_by(|a, b| {
            (a.frequency - fb).abs().partial_cmp(&(b.frequency - fb).abs()).unwrap()
        }).unwrap();
        assert!((closest.frequency - fb).abs() < 2.0);
        assert!(closest.db < 5.0);
    }

    #[test]
    fn test_impedance_double_peak() {
        let points = sim(bc21(), 200.0, "ported", 33.0, 10.0, 1.0, 1.0, 1, "impedance", 10.0, 2000.0);
        let mut peaks = 0;
        for i in 1..(points.len() - 1) {
            if points[i].db > points[i - 1].db && points[i].db > points[i + 1].db {
                peaks += 1;
            }
        }
        assert!(peaks >= 2);
    }

    #[test]
    fn test_bandpass4_bandpass_shape() {
        let points = simulate_system(SimulationRequest {
            driver: bc21(),
            v_box: 100.0,
            enclosure_type: "bandpass4".to_string(),
            tuning_freq: 50.0,
            f_max: 1000.0,
            v_rear: Some(80.0),
            v_front: Some(40.0),
            front_tuning_freq: Some(55.0),
            front_port_diameter: Some(12.0),
            ..Default::default()
        });

        let max_pt = points.iter().max_by(|a, b| a.db.partial_cmp(&b.db).unwrap()).unwrap();
        assert!(max_pt.frequency >= 30.0 && max_pt.frequency <= 90.0);
        let low_pt  = points.iter().find(|p| p.frequency < 20.0).unwrap();
        let high_pt = points.iter().find(|p| p.frequency > 500.0).unwrap();
        assert!(max_pt.db > low_pt.db  + 10.0);
        assert!(max_pt.db > high_pt.db + 10.0);
    }

    #[test]
    fn test_passive_radiator_simulation() {
        let points = simulate_system(SimulationRequest {
            driver: bc21(),
            v_box: 150.0,
            enclosure_type: "passive_radiator".to_string(),
            tuning_freq: 30.0,
            curve_type: "impedance".to_string(),
            f_max: 1000.0,
            pr_mms: Some(400.0),
            pr_sd: Some(1680.0),
            pr_fs: Some(25.0),
            pr_qms: Some(5.0),
            ..Default::default()
        });

        let mut peaks = 0;
        for i in 1..(points.len() - 1) {
            if points[i].db > points[i - 1].db && points[i].db > points[i + 1].db {
                peaks += 1;
            }
        }
        assert!(peaks >= 2);
    }

    #[test]
    fn test_bandpass6_parallel_dual_peaks() {
        let points = simulate_system(SimulationRequest {
            driver: bc21(),
            v_box: 100.0,
            enclosure_type: "bandpass6_parallel".to_string(),
            tuning_freq: 40.0,
            f_max: 1000.0,
            v_rear: Some(80.0),
            v_front: Some(50.0),
            front_tuning_freq: Some(55.0),
            rear_tuning_freq: Some(30.0),
            front_port_diameter: Some(12.0),
            rear_port_diameter: Some(10.0),
            ..Default::default()
        });

        let max_pt  = points.iter().max_by(|a, b| a.db.partial_cmp(&b.db).unwrap()).unwrap();
        let low_pt  = points.iter().find(|p| p.frequency < 15.0).unwrap();
        let high_pt = points.iter().find(|p| p.frequency > 400.0).unwrap();
        assert!(max_pt.db > low_pt.db  + 5.0, "BP6P should roll off below passband");
        assert!(max_pt.db > high_pt.db + 5.0, "BP6P should roll off above passband");
    }

    #[test]
    fn test_bandpass6_series_steep_rolloff() {
        let points = simulate_system(
            SimulationRequest {
            driver: bc21(),
            v_box: 100.0,
            enclosure_type: "bandpass6_series".to_string(),
            tuning_freq: 40.0,
            f_max: 1000.0,
            v_rear: Some(80.0),
            v_front: Some(50.0),
            front_tuning_freq: Some(55.0),
            rear_tuning_freq: Some(30.0),
            front_port_diameter: Some(12.0),
            internal_port_diameter: Some(10.0),
            ..Default::default()
        });

        let max_pt  = points.iter().max_by(|a, b| a.db.partial_cmp(&b.db).unwrap()).unwrap();
        let low_pt  = points.iter().find(|p| p.frequency < 15.0).unwrap();
        let high_pt = points.iter().find(|p| p.frequency > 400.0).unwrap();
        assert!(max_pt.db > low_pt.db  + 5.0, "BP6S should roll off below passband");
        assert!(max_pt.db > high_pt.db + 5.0, "BP6S should roll off above passband");
    }

    #[test]
    fn test_spl_environment_scaling() {
        // half-space (1 boundary) should be +6 dB vs free-field (0 boundaries);
        // corner (3 boundaries, eighth-space) should be +12 dB vs half-space —
        // two more 6 dB boundary-reinforcement steps than half-space.
        let half = simulate_system(
SimulationRequest {
            driver: bc21(),
            v_box: 150.0,
            tuning_freq: 33.0,
            f_min: 100.0,
            f_max: 200.0,
            spl_environment: Some("half_space".to_string()),
            ..Default::default()
        });
        let free = simulate_system(
SimulationRequest {
            driver: bc21(),
            v_box: 150.0,
            tuning_freq: 33.0,
            f_min: 100.0,
            f_max: 200.0,
            spl_environment: Some("free_field".to_string()),
            ..Default::default()
        });
        let corner = simulate_system(
SimulationRequest {
            driver: bc21(),
            v_box: 150.0,
            tuning_freq: 33.0,
            f_min: 100.0,
            f_max: 200.0,
            spl_environment: Some("corner".to_string()),
            ..Default::default()
        });

        // Pick a mid-range point for comparison
        let h = half.iter().find(|p| p.frequency > 130.0).unwrap().db;
        let f = free.iter().find(|p| p.frequency > 130.0).unwrap().db;
        let c = corner.iter().find(|p| p.frequency > 130.0).unwrap().db;
        assert!((h - f - 6.0).abs() < 0.5, "half vs free should be ~6 dB");
        assert!((c - h - 12.0).abs() < 0.5, "corner vs half should be ~12 dB");
    }

    #[test]
    fn test_custom_vs_standard_sealed() {
        let driver = bc21();
        let v_box = 100.0;
        
        let standard_points = simulate_system(SimulationRequest {
            driver: driver.clone(),
            v_box,
            tuning_freq: 33.0,
            f_max: 1000.0,
            ..Default::default()
        });

        let custom_spec = CustomTopologySpec {
            rear: custom_topology::CustomSideSpec {
                volume_liters: v_box,
                port: None,
                pr: None,
            },
            front: custom_topology::CustomSideSpec {
                volume_liters: 0.0,
                port: None,
                pr: None,
            },
            internal_port: None,
        };

        let custom_points = simulate_custom(CustomSimulationRequest {
            driver,
            custom_topology: custom_spec,
            f_max: 1000.0,
            ..Default::default()
        });

        assert_eq!(standard_points.len(), custom_points.len());
        for (std_p, cust_p) in standard_points.iter().zip(custom_points.iter()) {
            assert!((std_p.frequency - cust_p.frequency).abs() < 1e-6);
            assert!((std_p.db - cust_p.db).abs() < 1e-4, "Sealed custom vs std differ at {} Hz: {} vs {}", std_p.frequency, std_p.db, cust_p.db);
        }
    }

    #[test]
    fn test_custom_vs_standard_vented() {
        let driver = bc21();
        let v_box = 200.0;
        let fb = 33.0;
        let port_diam = 10.0;

        let standard_points = simulate_system(SimulationRequest {
            driver: driver.clone(),
            v_box,
            enclosure_type: "ported".to_string(),
            tuning_freq: fb,
            port_diameter: port_diam,
            f_max: 1000.0,
            ..Default::default()
        });

        let custom_spec = CustomTopologySpec {
            rear: custom_topology::CustomSideSpec {
                volume_liters: v_box,
                port: Some(custom_topology::CustomPortSpec {
                    diameter_cm: port_diam,
                    tuning_freq: fb,
                }),
                pr: None,
            },
            front: custom_topology::CustomSideSpec {
                volume_liters: 0.0,
                port: None,
                pr: None,
            },
            internal_port: None,
        };

        let custom_points = simulate_custom(CustomSimulationRequest {
            driver,
            custom_topology: custom_spec,
            f_max: 1000.0,
            ..Default::default()
        });

        assert_eq!(standard_points.len(), custom_points.len());
        for (std_p, cust_p) in standard_points.iter().zip(custom_points.iter()) {
            assert!((std_p.frequency - cust_p.frequency).abs() < 1e-6);
            assert!((std_p.db - cust_p.db).abs() < 1e-4, "Vented custom vs std differ at {} Hz: {} vs {}", std_p.frequency, std_p.db, cust_p.db);
        }
    }
}
