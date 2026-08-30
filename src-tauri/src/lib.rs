use std::fs;
use std::path::PathBuf;
use tauri::Manager;
use base64::Engine;

mod alignment;
mod circuit;
mod custom_topology;
mod topologies;

use circuit::{DriverParams, solve_circuit, compute_spl};
use custom_topology::CustomTopologySpec;
use topologies::*;

#[derive(serde::Serialize, serde::Deserialize, Clone, Debug, PartialEq)]
pub struct Driver {
    pub id: String,
    pub manufacturer: String,
    pub model: String,
    pub fs: f64,
    pub qts: f64,
    pub qes: f64,
    pub qms: f64,
    pub vas: f64,
    pub re: f64,
    pub sd: f64,
    pub xmax: f64,
    pub mms: f64,
    pub le: f64,
    pub bl: f64,
    pub pe: f64,
    pub sens: f64,
}

#[derive(serde::Serialize, serde::Deserialize, Clone, Debug)]
pub struct ProjectState {
    pub project_name: String,
    #[serde(default)]
    pub notes: Option<String>,
    pub driver: Driver,
    pub v_box: f64,
    pub enclosure_type: String,
    pub tuning_freq: f64,
    pub port_diameter: f64,
    pub input_power: f64,
    pub distance: f64,
    pub num_drivers: i32,
    pub port_shape: Option<String>,
    pub port_count: Option<i32>,
    pub port_width: Option<f64>,
    pub port_height: Option<f64>,
    pub v_rear: Option<f64>,
    pub v_front: Option<f64>,
    pub front_tuning_freq: Option<f64>,
    pub rear_tuning_freq: Option<f64>,
    pub front_port_diameter: Option<f64>,
    pub rear_port_diameter: Option<f64>,
    pub internal_port_diameter: Option<f64>,
    pub pr_mms: Option<f64>,
    pub pr_sd: Option<f64>,
    pub pr_fs: Option<f64>,
    pub pr_qms: Option<f64>,
    pub port_q: Option<f64>,
    pub spl_environment: Option<String>,
    pub custom_topology: Option<CustomTopologySpec>,
    // Isobaric / push-pull configuration
    pub driver_config: Option<String>,
    // Second port group for dual-port ported enclosures
    pub port2_enabled: Option<bool>,
    pub port2_count: Option<i32>,
    pub port2_diameter: Option<f64>,
    pub port2_shape: Option<String>,
    pub port2_width: Option<f64>,
    pub port2_height: Option<f64>,
    // Passive crossover configuration
    pub passive_xo_enabled: Option<bool>,
    pub passive_xo_type: Option<String>,
    pub passive_xo_inductance: Option<f64>,
    pub passive_xo_capacitance: Option<f64>,
    pub passive_xo_dcr: Option<f64>,
}

#[derive(serde::Serialize, serde::Deserialize)]
pub struct SimPoint {
    pub frequency: f64,
    pub db: f64,
    /// Phase of the acoustic output (total_radiated_velocity.arg()), in radians.
    /// Always the acoustic transfer function phase regardless of which curve is being computed.
    #[serde(default)]
    pub phase_rad: f64,
}

fn get_db_path(app: &tauri::AppHandle) -> PathBuf {
    let mut path = app.path().app_data_dir().unwrap_or_else(|_| PathBuf::from("."));
    let _ = fs::create_dir_all(&path);
    path.push("drivers.json");
    path
}

/// Map a spl_environment string to the env_gain multiplier used in compute_spl.
/// Each additional reflecting boundary halves the radiation solid angle, which doubles
/// pressure at a fixed distance (+6 dB) under the coherent low-frequency monopole model:
///   "free_field"  → 0.5  (4π sr, anechoic / elevated — −6 dB vs half-space)
///   "half_space"  → 1.0  (2π sr, one boundary — speaker in infinite baffle / wall mount)
///   "corner"      → 4.0  (π/2 sr, three reflecting boundaries — +12 dB vs half-space)
fn env_gain_from_str(s: Option<&str>) -> f64 {
    match s {
        Some("free_field") => 0.5,
        Some("corner")     => 4.0,
        _                  => 1.0, // default: half-space
    }
}


#[tauri::command]
fn simulate_system(
    driver: Driver,
    v_box: f64,
    enclosure_type: String,
    tuning_freq: f64,
    port_diameter: f64,
    input_power: f64,
    distance: f64,
    num_drivers: i32,
    curve_type: String,
    f_min: f64,
    f_max: f64,
    port_shape: String,
    port_count: i32,
    port_width: f64,
    port_height: f64,
    // Higher-order enclosure volumes / tuning
    v_rear: Option<f64>,
    v_front: Option<f64>,
    front_tuning_freq: Option<f64>,
    rear_tuning_freq: Option<f64>,
    front_port_diameter: Option<f64>,
    rear_port_diameter: Option<f64>,
    internal_port_diameter: Option<f64>,
    // Passive radiator parameters
    pr_mms: Option<f64>,
    pr_sd: Option<f64>,
    pr_fs: Option<f64>,
    pr_qms: Option<f64>,
    // Acoustic quality parameters
    port_q: Option<f64>,            // port loss Q (50 = circular, 30 = slot)
    spl_environment: Option<String>, // "half_space" | "free_field" | "corner"
    // Isobaric / push-pull
    driver_config: Option<String>,  // "standard" | "isobaric_series" | "isobaric_parallel"
    // Second port group (ported only)
    port2_enabled: Option<bool>,
    port2_count: Option<i32>,
    port2_diameter: Option<f64>,
    port2_shape: Option<String>,
    port2_width: Option<f64>,
    port2_height: Option<f64>,
    // Passive crossover parameters
    passive_xo_enabled: Option<bool>,
    passive_xo_type: Option<String>,
    passive_xo_inductance: Option<f64>,
    passive_xo_capacitance: Option<f64>,
    passive_xo_dcr: Option<f64>,
) -> Vec<SimPoint> {
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
    let q_loss = 200.0_f64; // box absorption not modelled; 200 ≈ lossless compliance
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

    // ── Port geometry ────────────────────────────────────────────────────────
    let port_count_val = if port_count > 0 { port_count } else { 1 };
    let single_port_area_m2 = if port_shape == "rectangular" {
        let w_m = port_width * 0.01;
        let h_m = port_height * 0.01;
        (w_m * h_m).max(1e-6)
    } else {
        let d_port_cm = if port_diameter > 0.0 { port_diameter } else { 10.0 };
        let r_port_m = (d_port_cm / 2.0) * 0.01;
        (std::f64::consts::PI * r_port_m * r_port_m).max(1e-6)
    };
    let total_port_area = single_port_area_m2 * (port_count_val as f64);

    // ── Port 2 geometry (ported enclosure only) ──────────────────────────────
    let p2_enabled = port2_enabled.unwrap_or(false);
    let p2_count = port2_count.unwrap_or(1).max(1) as f64;
    let p2_shape = port2_shape.as_deref().unwrap_or("circular");
    let p2_single_area = if p2_enabled {
        if p2_shape == "rectangular" {
            let w_m = port2_width.unwrap_or(10.0) * 0.01;
            let h_m = port2_height.unwrap_or(5.0) * 0.01;
            (w_m * h_m).max(1e-6)
        } else {
            let d_cm = port2_diameter.unwrap_or(10.0);
            let r_m = (d_cm / 2.0) * 0.01;
            (std::f64::consts::PI * r_m * r_m).max(1e-6)
        }
    } else { 0.0 };
    let p2_total_area = p2_single_area * p2_count;

    // Q for port2 — auto-scale for rectangular (higher perimeter-to-area ratio → more loss)
    let q_port2 = if p2_shape == "rectangular" && p2_enabled {
        let w_m = port2_width.unwrap_or(10.0) * 0.01;
        let h_m = port2_height.unwrap_or(5.0) * 0.01;
        let perim = 2.0 * (w_m + h_m);
        let r_h = 4.0 * p2_single_area / perim; // hydraulic diameter
        let r_circ = 2.0 * (p2_single_area / std::f64::consts::PI).sqrt();
        let ratio = (r_h / r_circ).min(1.0);
        (q_port * ratio).max(10.0)
    } else { q_port };

    let v_box_effective = (v_box / num).max(0.001);
    let v_box_m3 = v_box_effective * 1e-3;

    // Port length from tuning frequency — use combined area of port1 + port2 so both
    // groups share the same physical length (common manufacturing practice).
    let combined_port_area = total_port_area + p2_total_area;
    let port_length_m = circuit::derive_port_length_m(combined_port_area, tuning_freq, v_box_m3);

    // Helper port areas for bandpass configurations
    let make_port_area = |d_cm: f64| -> f64 {
        let r = (d_cm / 2.0) * 0.01;
        (std::f64::consts::PI * r * r).max(1e-6)
    };
    let front_port_area_m2    = make_port_area(front_port_diameter.unwrap_or(port_diameter));
    let rear_port_area_m2     = make_port_area(rear_port_diameter.unwrap_or(port_diameter));
    let internal_port_area_m2 = make_port_area(internal_port_diameter.unwrap_or(port_diameter));

    // Port length helper for bandpass configs
    let calc_port_len = |area: f64, tune_f: f64, vol_liters: f64| -> f64 {
        circuit::derive_port_length_m(area, tune_f, vol_liters * 1e-3)
    };

    let v_r = v_rear.unwrap_or(v_box_effective).max(0.001);
    let v_f = v_front.unwrap_or(v_box_effective).max(0.001);
    let f_front = front_tuning_freq.unwrap_or(tuning_freq).max(0.1);
    let f_rear  = rear_tuning_freq.unwrap_or(tuning_freq).max(0.1);

    let front_port_len    = calc_port_len(front_port_area_m2,    f_front, v_f);
    let rear_port_len     = calc_port_len(rear_port_area_m2,     f_rear,  v_r);
    let internal_port_len = calc_port_len(internal_port_area_m2, f_rear,  v_r);

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

    // ── Simulate at each frequency point ────────────────────────────────────
    for i in 0..n_points {
        let log_f = log_min + i as f64 * step;
        let freq = 10.0_f64.powf(log_f);

        let solution = solve_circuit(&ac_circuit, freq, e_g, &dp, &xo);

        let val = match curve_type.as_str() {
            "excursion" => circuit::peak_displacement_mm(solution.driver_displacement),
            "velocity" => {
                if solution.port_velocities.is_empty() {
                    0.0
                } else if enclosure_type == "ported" && p2_enabled && solution.port_velocities.len() >= 2 {
                    // Show the maximum individual port velocity (worst case for chuffing)
                    let v1 = solution.port_velocities[0].norm() / total_port_area.max(1e-9);
                    let v2 = solution.port_velocities[1].norm() / p2_total_area.max(1e-9);
                    v1.max(v2)
                } else {
                    let total_port_u: num_complex::Complex64 = solution.port_velocities.iter().sum();
                    let port_area = match enclosure_type.as_str() {
                        "ported"             => total_port_area,
                        "bandpass4"
                        | "bandpass6_series" => front_port_area_m2,
                        "bandpass6_parallel" => front_port_area_m2 + rear_port_area_m2,
                        "passive_radiator"   => (pr_sd.unwrap_or(driver.sd) * 1e-4).max(1e-6),
                        _                    => total_port_area.max(0.001),
                    };
                    if port_area > 0.0 { total_port_u.norm() / port_area } else { 0.0 }
                }
            }
            "impedance" => solution.input_impedance.norm(),
            "spl" => {
                let total_u = solution.total_radiated_velocity;
                compute_spl(total_u * num, freq, d, env_gain)
            }
            _ => {
                // "gain" / "transfer" — relative, always half-space
                let total_u = solution.total_radiated_velocity;
                let spl = compute_spl(total_u, freq, d, 1.0);
                let s_ref = if driver.sens > 0.0 { driver.sens } else { 90.0 };
                spl - (s_ref + 10.0 * p_per_driver.log10())
            }
        };
        let phase_rad = solution.total_radiated_velocity.arg();

        points.push(SimPoint { frequency: freq, db: val, phase_rad });
    }

    points
}

/// Convert a Driver struct to DriverParams for the circuit solver
pub(crate) fn driver_to_params(driver: &Driver) -> DriverParams {
    DriverParams {
        fs: driver.fs,
        qts: driver.qts,
        qes: driver.qes,
        qms: driver.qms,
        vas: driver.vas,
        re: driver.re,
        sd: driver.sd,
        xmax: driver.xmax,
        mms: driver.mms,
        le: driver.le,
        bl: driver.bl,
        pe: driver.pe,
        sens: driver.sens,
    }
}

/// Apply isobaric / push-pull modification to DriverParams.
///
/// Both wirings couple the two cones mechanically, so the mechanical side is identical:
/// Mms doubles, and because the solver derives Cms from Fs and Mms, the compliance
/// halves on its own — Fs holds and effective Vas halves. Only the electrical side
/// differs, and Qes = ωs·Mms·Re/Bl² has to come out unchanged either way: series and
/// parallel connection of two identical coupled drivers cannot alter the damping.
///
/// Isobaric series: coils in series.  Re×2, Le×2, Mms×2, and Bl×2 — with the pair
///   carrying one shared current, the two motors' forces add against the doubled
///   voltage drop.   Qes = ωs(2·Mms)(2·Re)/(2·Bl)² = ωs·Mms·Re/Bl² ✓
///
/// Isobaric parallel: coils in parallel.  Re÷2, Le÷2, Mms×2, and Bl *unchanged* —
///   each coil sees the full voltage and carries half the total current, so the two
///   motors' forces add to the same total a single Bl produces against the halved
///   impedance.   Qes = ωs(2·Mms)(Re/2)/Bl² = ωs·Mms·Re/Bl² ✓
///
/// Both lose 3 dB of reference efficiency against a single driver, which is the
/// standard isobaric trade: half the box for the output of one cone.
pub(crate) fn apply_driver_config(mut dp: DriverParams, config: &str) -> DriverParams {
    match config {
        "isobaric_series" => {
            dp.mms *= 2.0;
            dp.bl  *= 2.0;
            dp.re  *= 2.0;
            dp.le  *= 2.0;
        }
        "isobaric_parallel" => {
            dp.mms *= 2.0;
            dp.re  /= 2.0;
            dp.le  /= 2.0;
        }
        _ => {} // "standard" — no change
    }
    dp
}

#[tauri::command]
fn simulate_custom(
    driver: Driver,
    custom_topology: CustomTopologySpec,
    input_power: f64,
    distance: f64,
    num_drivers: i32,
    curve_type: String,
    f_min: f64,
    f_max: f64,
    port_q: Option<f64>,
    spl_environment: Option<String>,
    driver_config: Option<String>,
    passive_xo_enabled: Option<bool>,
    passive_xo_type: Option<String>,
    passive_xo_inductance: Option<f64>,
    passive_xo_capacitance: Option<f64>,
    passive_xo_dcr: Option<f64>,
) -> Vec<SimPoint> {
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
    let q_loss = 200.0_f64; // box absorption not modelled
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
        points.push(SimPoint { frequency: freq, db: val, phase_rad });
    }
    points
}

#[tauri::command]
fn get_drivers(app: tauri::AppHandle) -> Vec<Driver> {
    let path = get_db_path(&app);
    if !path.exists() {
        let default_driver = Driver {
            id: "bc-21sw115-4".to_string(),
            manufacturer: "B&C Speakers".to_string(),
            model: "21SW115 (4Ω)".to_string(),
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
        let drivers = vec![default_driver];
        if let Ok(json) = serde_json::to_string_pretty(&drivers) {
            let _ = fs::write(&path, json);
        }
        return drivers;
    }

    if let Ok(content) = fs::read_to_string(&path) {
        if let Ok(drivers) = serde_json::from_str::<Vec<Driver>>(&content) {
            return drivers;
        }
    }
    Vec::new()
}

#[tauri::command]
fn add_driver(app: tauri::AppHandle, driver: Driver) -> Result<Vec<Driver>, String> {
    let mut drivers = get_drivers(app.clone());
    let mut new_driver = driver;
    if new_driver.id.is_empty() {
        new_driver.id = format!(
            "{}-{}",
            new_driver.manufacturer.to_lowercase().replace(" ", "-"),
            new_driver.model.to_lowercase().replace(" ", "-")
        );
    }
    drivers.push(new_driver);

    let path = get_db_path(&app);
    let json = serde_json::to_string_pretty(&drivers).map_err(|e| e.to_string())?;
    fs::write(&path, json).map_err(|e| e.to_string())?;

    Ok(drivers)
}

#[tauri::command]
fn edit_driver(app: tauri::AppHandle, id: String, driver: Driver) -> Result<Vec<Driver>, String> {
    let mut drivers = get_drivers(app.clone());
    if let Some(pos) = drivers.iter().position(|d| d.id == id) {
        let mut updated = driver;
        updated.id = id;
        drivers[pos] = updated;
    } else {
        return Err("Driver not found".to_string());
    }

    let path = get_db_path(&app);
    let json = serde_json::to_string_pretty(&drivers).map_err(|e| e.to_string())?;
    fs::write(&path, json).map_err(|e| e.to_string())?;

    Ok(drivers)
}

#[tauri::command]
fn save_project(path: String, state: ProjectState) -> Result<(), String> {
    let json = serde_json::to_string_pretty(&state).map_err(|e| e.to_string())?;
    fs::write(path, json).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
fn load_project(path: String) -> Result<ProjectState, String> {
    let content = fs::read_to_string(path).map_err(|e| e.to_string())?;
    let state = serde_json::from_str::<ProjectState>(&content).map_err(|e| e.to_string())?;
    Ok(state)
}

#[tauri::command]
fn auto_calculate_port(
    driver: Driver,
    v_box: f64,
    tuning_freq: f64,
    input_power: f64,
    num_drivers: i32,
    driver_config: Option<String>,
    port_q: Option<f64>,
    // Second port group, if the design already has one. Its area counts toward the
    // vent the box needs, and toward the tuning the length has to hit.
    port2_enabled: Option<bool>,
    port2_count: Option<i32>,
    port2_diameter: Option<f64>,
    port2_shape: Option<String>,
    port2_width: Option<f64>,
    port2_height: Option<f64>,
) -> PortRecommendation {
    let fs = driver.fs;
    let qts = driver.qts;
    let vas = driver.vas;

    if v_box <= 0.0 || vas <= 0.0 || qts <= 0.0 || fs <= 0.0 {
        return PortRecommendation {
            port_shape: "circular".to_string(),
            port_count: 1,
            port_diameter: 10.0,
            port_width: 0.0,
            port_height: 0.0,
            port_length: 15.0,
            peak_velocity: 0.0,
        };
    }

    let num = if num_drivers > 0 { num_drivers as f64 } else { 1.0 };
    let v_box_m3 = (v_box / num) * 1e-3;

    // Run simulation with a dummy circular port to find peak volume velocity
    let dummy_diameter = 10.0;
    let points = simulate_system(
        driver.clone(),
        v_box,
        "ported".to_string(),
        tuning_freq,
        dummy_diameter,
        input_power,
        1.0,
        num_drivers,
        "velocity".to_string(),
        10.0,
        2000.0,
        "circular".to_string(),
        1,
        0.0,
        0.0,
        None, None, None, None, None, None, None,
        None, None, None, None,
        port_q, None, // port_q, spl_environment
        // The probe deliberately runs as a single vent even when the design has two
        // groups: what is wanted here is the *total* volume velocity the box pushes
        // through its vents, which barely depends on how that area is split, and the
        // velocity curve switches to reporting per-port velocity once port 2 is on.
        driver_config, None, None, None, None, None, None,
        None, None, None, None, None, // passive crossover parameters
    );

    let dummy_r = (dummy_diameter / 2.0) * 0.01;
    let dummy_ap = std::f64::consts::PI * dummy_r * dummy_r;

    let max_vel = points.iter().map(|p| p.db).fold(0.0, f64::max);
    let u_p_max = max_vel * dummy_ap;

    let target_vel = 14.5;
    let total_ap_needed = if u_p_max > 0.0 { u_p_max / target_vel } else { 0.0078 };

    // Area already provided by the second group, which this recommendation does not
    // have to duplicate.
    let p2_area = if port2_enabled.unwrap_or(false) {
        let count = port2_count.unwrap_or(1).max(1) as f64;
        let single = if port2_shape.as_deref() == Some("rectangular") {
            (port2_width.unwrap_or(10.0) * 0.01) * (port2_height.unwrap_or(5.0) * 0.01)
        } else {
            let r = (port2_diameter.unwrap_or(10.0) / 2.0) * 0.01;
            std::f64::consts::PI * r * r
        };
        (single * count).max(0.0)
    } else {
        0.0
    };

    // Never recommend away the whole vent — leave at least a small port here even if
    // group 2 already covers the requirement on its own.
    let min_ap = (total_ap_needed - p2_area).max(0.002);

    // Tuning is set by the *combined* vent area, and the solver derives the length with
    // derive_port_length_m. Using the same function keeps the recommended length equal
    // to the length the simulation will actually run — the old inline formulas used a
    // 0.85 end correction for slots against the solver's 0.732, so they disagreed.
    let port_len_cm = |ap1: f64| circuit::derive_port_length_m(ap1 + p2_area, tuning_freq, v_box_m3) * 100.0;

    let (best_shape, best_count, best_diam, best_w, best_h, best_len) = if min_ap < 0.015 {
        let circular_options = vec![5.0, 7.5, 10.0, 12.5, 15.0];
        let mut d_opt = 10.0;
        let mut c_opt = 1;
        let mut len_opt = 15.0;
        let mut found = false;

        for d in circular_options {
            let r_m = (d / 2.0) * 0.01;
            let single_ap = std::f64::consts::PI * r_m * r_m;
            for count in 1..=3 {
                let ap = (count as f64) * single_ap;
                if ap >= min_ap {
                    let length_cm = port_len_cm(ap);
                    if length_cm > 5.0 && length_cm < 50.0 {
                        d_opt = d;
                        c_opt = count;
                        len_opt = length_cm;
                        found = true;
                        break;
                    }
                }
            }
            if found { break; }
        }
        if !found {
            let r_m = 0.05;
            let ap = std::f64::consts::PI * r_m * r_m;
            let length_cm = port_len_cm(ap);
            d_opt = 10.0;
            c_opt = 1;
            len_opt = length_cm.max(2.0);
        }
        ("circular".to_string(), c_opt, d_opt, 0.0, 0.0, len_opt)
    } else {
        let w_cm = 30.0;
        let w_m = w_cm * 0.01;
        let target_h_m = min_ap / w_m;
        let h_cm = (target_h_m * 100.0).max(2.0).min(30.0);
        let h_m = h_cm * 0.01;
        let ap = w_m * h_m;
        let length_cm = port_len_cm(ap);

        ("rectangular".to_string(), 1, 0.0, w_cm, h_cm, length_cm.max(2.0))
    };

    let actual_ap = if best_shape == "rectangular" {
        (best_count as f64) * (best_w * 0.01) * (best_h * 0.01)
    } else {
        (best_count as f64) * std::f64::consts::PI * ((best_diam / 2.0) * 0.01).powi(2)
    };

    PortRecommendation {
        port_shape: best_shape,
        port_count: best_count,
        port_diameter: best_diam,
        port_width: best_w,
        port_height: best_h,
        port_length: best_len,
        peak_velocity: if actual_ap > 0.0 { u_p_max / actual_ap } else { 0.0 },
    }
}

#[derive(serde::Serialize)]
struct PortRecommendation {
    port_shape: String,
    port_count: i32,
    port_diameter: f64,
    port_width: f64,
    port_height: f64,
    port_length: f64,
    peak_velocity: f64,
}

/// Solve for the enclosure parameters that best realise `alignment_target` for this
/// driver, searching the same circuit model that draws the response graphs.
///
/// Replaces the old closed-form Thiele/Small curve fits, which were only valid for
/// Qts ≈ 0.3–0.4 and produced wildly mis-tuned boxes outside that window.
#[tauri::command]
fn auto_align_enclosure(
    driver: Driver,
    enclosure_type: String,
    alignment_target: String,
    num_drivers: i32,
    input_power: f64,
    driver_config: Option<String>,
    port_q: Option<f64>,
    pr_mms: Option<f64>,
    pr_sd: Option<f64>,
    pr_qms: Option<f64>,
    constraints: Option<alignment::AlignConstraints>,
    passband: Option<alignment::PassbandTarget>,
) -> alignment::AlignmentRecommendation {
    let dp = apply_driver_config(
        driver_to_params(&driver),
        driver_config.as_deref().unwrap_or("standard"),
    );

    let req = alignment::AlignRequest {
        driver: dp,
        enclosure_type,
        num_drivers: if num_drivers > 0 { num_drivers as f64 } else { 1.0 },
        input_power: if input_power > 0.0 { input_power } else { 1.0 },
        q_port: port_q.unwrap_or(50.0).max(1.0),
        pr_mms: pr_mms.unwrap_or(200.0),
        pr_sd: pr_sd.unwrap_or(driver.sd),
        pr_qms: pr_qms.unwrap_or(5.0),
        target: alignment::AlignTarget::from_str(&alignment_target),
        constraints: constraints.unwrap_or_default(),
        passband,
    };

    alignment::solve_alignment(&req)
}

#[tauri::command]
fn write_text_file(path: String, content: String) -> Result<(), String> {
    fs::write(&path, content.as_bytes()).map_err(|e| e.to_string())
}

/// Accepts a base64 data URL (e.g. "data:image/png;base64,…") or a bare base64 string,
/// decodes it and writes the raw bytes to `path`.
#[tauri::command]
fn write_data_url_file(path: String, data_url: String) -> Result<(), String> {
    let b64 = if let Some(pos) = data_url.find(',') {
        &data_url[pos + 1..]
    } else {
        data_url.as_str()
    };
    let bytes = base64::engine::general_purpose::STANDARD
        .decode(b64.trim())
        .map_err(|e| e.to_string())?;
    fs::write(&path, bytes).map_err(|e| e.to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            simulate_system,
            simulate_custom,
            get_drivers,
            add_driver,
            edit_driver,
            save_project,
            load_project,
            auto_calculate_port,
            auto_align_enclosure,
            write_text_file,
            write_data_url_file
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

// ─── Tests ──────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;

    fn bc21() -> Driver {
        Driver {
            id: "bc-21".to_string(),
            manufacturer: "B&C".to_string(),
            model: "21".to_string(),
            fs: 33.0, qts: 0.36, qes: 0.37, qms: 7.7,
            vas: 278.0, re: 3.6, sd: 1680.0, xmax: 14.0,
            mms: 335.0, le: 1.7, bl: 24.8, pe: 1700.0, sens: 97.0,
        }
    }

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
        simulate_system(
            driver, v_box, enc.to_string(), tuning, port_diam, power, dist, n_drv,
            curve.to_string(), f_min, f_max,
            "circular".to_string(), 1, 0.0, 0.0,
            None, None, None, None, None, None, None,
            None, None, None, None,
            None, None,
            None, None, None, None, None, None, None,
            None, None, None, None, None,
        )
    }

    /// Re-derive Fs, Qts and Vas from the transformed parameters the way the solver
    /// does, and require them to match the isobaric identities. Parallel wiring used
    /// to double Bl as series does, which divided Qes by four.
    #[test]
    fn test_isobaric_preserves_fs_and_qts_and_halves_vas() {
        let d = bc21();
        let single = driver_to_params(&d);

        // Qts as the circuit model sees it: Cms and Rms are derived from Fs and Mms.
        let derived = |dp: &DriverParams| -> (f64, f64) {
            let ws = 2.0 * std::f64::consts::PI * dp.fs;
            let mms_kg = dp.mms / 1000.0;
            let qes = ws * mms_kg * dp.re / (dp.bl * dp.bl);
            let qts = qes * dp.qms / (qes + dp.qms);
            let sd_m2 = dp.sd * 1e-4;
            let vas_l = (circuit::RHO0 * circuit::C_AIR * circuit::C_AIR * sd_m2 * sd_m2)
                / (ws * ws * mms_kg)
                * 1000.0;
            (qts, vas_l)
        };

        let (qts_ref, vas_ref) = derived(&single);

        for cfg in ["isobaric_series", "isobaric_parallel"] {
            let dp = apply_driver_config(single.clone(), cfg);
            let (qts, vas) = derived(&dp);

            assert!(
                (dp.fs - single.fs).abs() < 1e-9,
                "{cfg}: Fs moved from {} to {}", single.fs, dp.fs
            );
            assert!(
                (qts - qts_ref).abs() / qts_ref < 1e-6,
                "{cfg}: Qts became {qts:.4}, but coupling two identical drivers leaves it at {qts_ref:.4}"
            );
            assert!(
                (vas - vas_ref / 2.0).abs() / vas_ref < 1e-6,
                "{cfg}: Vas became {vas:.1} L, expected half of {vas_ref:.1} L"
            );
        }
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
        simulate_system(
            d.clone(), 150.0, "sealed".to_string(), 33.0, 10.0, 100.0, 1.0, 1,
            "spl".to_string(), 20.0, 200.0, "circular".to_string(), 1, 0.0, 0.0,
            None, None, None, None, None, None, None,
            None, None, None, None,
            None, None,
            Some(cfg.to_string()), None, None, None, None, None, None,
            None, None, None, None, None,
        )
    }

    #[test]
    fn test_driver_database() {
        let temp_dir = std::env::temp_dir().join("winisd_test");
        let _ = fs::create_dir_all(&temp_dir);
        let db_path = temp_dir.join("drivers.json");
        let _ = fs::remove_file(&db_path);

        let test_driver = Driver {
            id: "test-driver-1".to_string(),
            manufacturer: "Test Manufacturer".to_string(),
            model: "Test Model".to_string(),
            fs: 30.0, qts: 0.4, qes: 0.45, qms: 5.0,
            vas: 50.0, re: 4.0, sd: 500.0, xmax: 10.0,
            mms: 100.0, le: 1.0, bl: 15.0, pe: 500.0, sens: 92.0,
        };

        let drivers = vec![test_driver.clone()];
        let json = serde_json::to_string_pretty(&drivers).unwrap();
        fs::write(&db_path, json).unwrap();

        let content = fs::read_to_string(&db_path).unwrap();
        let loaded_drivers: Vec<Driver> = serde_json::from_str(&content).unwrap();

        assert_eq!(loaded_drivers.len(), 1);
        assert_eq!(loaded_drivers[0], test_driver);
        let _ = fs::remove_file(&db_path);
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
        let points = simulate_system(
            bc21(), 100.0, "bandpass4".to_string(), 50.0, 10.0, 1.0, 1.0, 1,
            "spl".to_string(), 10.0, 1000.0,
            "circular".to_string(), 1, 0.0, 0.0,
            Some(80.0), Some(40.0), Some(55.0), None, Some(12.0), None, None,
            None, None, None, None,
            None, None,
            None, None, None, None, None, None, None,
            None, None, None, None, None,
        );

        let max_pt = points.iter().max_by(|a, b| a.db.partial_cmp(&b.db).unwrap()).unwrap();
        assert!(max_pt.frequency >= 30.0 && max_pt.frequency <= 90.0);
        let low_pt  = points.iter().find(|p| p.frequency < 20.0).unwrap();
        let high_pt = points.iter().find(|p| p.frequency > 500.0).unwrap();
        assert!(max_pt.db > low_pt.db  + 10.0);
        assert!(max_pt.db > high_pt.db + 10.0);
    }

    #[test]
    fn test_passive_radiator_simulation() {
        let points = simulate_system(
            bc21(), 150.0, "passive_radiator".to_string(), 30.0, 10.0, 1.0, 1.0, 1,
            "impedance".to_string(), 10.0, 1000.0,
            "circular".to_string(), 1, 0.0, 0.0,
            None, None, None, None, None, None, None,
            Some(400.0), Some(1680.0), Some(25.0), Some(5.0),
            None, None,
            None, None, None, None, None, None, None,
            None, None, None, None, None,
        );

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
        let points = simulate_system(
            bc21(), 100.0, "bandpass6_parallel".to_string(), 40.0, 10.0, 1.0, 1.0, 1,
            "spl".to_string(), 10.0, 1000.0,
            "circular".to_string(), 1, 0.0, 0.0,
            Some(80.0), Some(50.0), Some(55.0), Some(30.0), Some(12.0), Some(10.0), None,
            None, None, None, None,
            None, None,
            None, None, None, None, None, None, None,
            None, None, None, None, None,
        );

        let max_pt  = points.iter().max_by(|a, b| a.db.partial_cmp(&b.db).unwrap()).unwrap();
        let low_pt  = points.iter().find(|p| p.frequency < 15.0).unwrap();
        let high_pt = points.iter().find(|p| p.frequency > 400.0).unwrap();
        assert!(max_pt.db > low_pt.db  + 5.0, "BP6P should roll off below passband");
        assert!(max_pt.db > high_pt.db + 5.0, "BP6P should roll off above passband");
    }

    #[test]
    fn test_bandpass6_series_steep_rolloff() {
        let points = simulate_system(
            bc21(), 100.0, "bandpass6_series".to_string(), 40.0, 10.0, 1.0, 1.0, 1,
            "spl".to_string(), 10.0, 1000.0,
            "circular".to_string(), 1, 0.0, 0.0,
            Some(80.0), Some(50.0), Some(55.0), Some(30.0), Some(12.0), None, Some(10.0),
            None, None, None, None,
            None, None,
            None, None, None, None, None, None, None,
            None, None, None, None, None,
        );

        let max_pt  = points.iter().max_by(|a, b| a.db.partial_cmp(&b.db).unwrap()).unwrap();
        let low_pt  = points.iter().find(|p| p.frequency < 15.0).unwrap();
        let high_pt = points.iter().find(|p| p.frequency > 400.0).unwrap();
        assert!(max_pt.db > low_pt.db  + 5.0, "BP6S should roll off below passband");
        assert!(max_pt.db > high_pt.db + 5.0, "BP6S should roll off above passband");
    }

    #[test]
    fn test_auto_calculate_port_accuracy() {
        let rec = auto_calculate_port(
            bc21(), 200.0, 33.0, 1000.0, 1,
            None, None,
            None, None, None, None, None, None,
        );
        assert!(rec.port_length > 0.0);
        assert!(rec.peak_velocity >= 0.0);
    }

    /// The recommendation used to be computed as if the second port group did not
    /// exist, so a dual-port design got a first group sized to carry the whole vent
    /// requirement on its own — and a length derived from that group's area alone,
    /// which tunes the box above Fb once both groups are open.
    #[test]
    fn test_auto_calculate_port_accounts_for_second_port_group() {
        let solo = auto_calculate_port(
            bc21(), 200.0, 33.0, 1000.0, 1,
            None, None,
            None, None, None, None, None, None,
        );
        let with_p2 = auto_calculate_port(
            bc21(), 200.0, 33.0, 1000.0, 1,
            None, None,
            Some(true), Some(1), Some(10.0), Some("circular".to_string()), None, None,
        );

        let area = |r: &PortRecommendation| -> f64 {
            if r.port_shape == "rectangular" {
                (r.port_count as f64) * (r.port_width * 0.01) * (r.port_height * 0.01)
            } else {
                (r.port_count as f64) * std::f64::consts::PI * ((r.port_diameter / 2.0) * 0.01).powi(2)
            }
        };

        assert!(
            area(&with_p2) < area(&solo),
            "a second vent should reduce the area the first has to provide: {:.5} vs {:.5} m²",
            area(&with_p2), area(&solo)
        );

        // The recommended length must be the one the solver will actually use, which it
        // derives from the *combined* vent area.
        let p2_area = std::f64::consts::PI * 0.05_f64.powi(2);
        let expected =
            circuit::derive_port_length_m(area(&with_p2) + p2_area, 33.0, 0.2) * 100.0;
        assert!(
            (with_p2.port_length - expected).abs() < 0.5,
            "recommended length {:.1} cm does not match the simulated {:.1} cm",
            with_p2.port_length, expected
        );
    }

    #[test]
    fn test_spl_environment_scaling() {
        // half-space (1 boundary) should be +6 dB vs free-field (0 boundaries);
        // corner (3 boundaries, eighth-space) should be +12 dB vs half-space —
        // two more 6 dB boundary-reinforcement steps than half-space.
        let half = simulate_system(
            bc21(), 150.0, "sealed".to_string(), 33.0, 10.0, 1.0, 1.0, 1,
            "spl".to_string(), 100.0, 200.0,
            "circular".to_string(), 1, 0.0, 0.0,
            None, None, None, None, None, None, None, None, None, None, None,
            None, Some("half_space".to_string()),
            None, None, None, None, None, None, None,
            None, None, None, None, None,
        );
        let free = simulate_system(
            bc21(), 150.0, "sealed".to_string(), 33.0, 10.0, 1.0, 1.0, 1,
            "spl".to_string(), 100.0, 200.0,
            "circular".to_string(), 1, 0.0, 0.0,
            None, None, None, None, None, None, None, None, None, None, None,
            None, Some("free_field".to_string()),
            None, None, None, None, None, None, None,
            None, None, None, None, None,
        );
        let corner = simulate_system(
            bc21(), 150.0, "sealed".to_string(), 33.0, 10.0, 1.0, 1.0, 1,
            "spl".to_string(), 100.0, 200.0,
            "circular".to_string(), 1, 0.0, 0.0,
            None, None, None, None, None, None, None, None, None, None, None,
            None, Some("corner".to_string()),
            None, None, None, None, None, None, None,
            None, None, None, None, None,
        );

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
        
        let standard_points = simulate_system(
            driver.clone(), v_box, "sealed".to_string(), 33.0, 10.0, 1.0, 1.0, 1,
            "spl".to_string(), 10.0, 1000.0,
            "circular".to_string(), 1, 0.0, 0.0,
            None, None, None, None, None, None, None,
            None, None, None, None,
            None, None,
            None, None, None, None, None, None, None,
            None, None, None, None, None,
        );

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

        let custom_points = simulate_custom(
            driver, custom_spec, 1.0, 1.0, 1, "spl".to_string(), 10.0, 1000.0, None, None, None,
            None, None, None, None, None
        );

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

        let standard_points = simulate_system(
            driver.clone(), v_box, "ported".to_string(), fb, port_diam, 1.0, 1.0, 1,
            "spl".to_string(), 10.0, 1000.0,
            "circular".to_string(), 1, 0.0, 0.0,
            None, None, None, None, None, None, None,
            None, None, None, None,
            None, None,
            None, None, None, None, None, None, None,
            None, None, None, None, None,
        );

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

        let custom_points = simulate_custom(
            driver, custom_spec, 1.0, 1.0, 1, "spl".to_string(), 10.0, 1000.0, None, None, None,
            None, None, None, None, None
        );

        assert_eq!(standard_points.len(), custom_points.len());
        for (std_p, cust_p) in standard_points.iter().zip(custom_points.iter()) {
            assert!((std_p.frequency - cust_p.frequency).abs() < 1e-6);
            assert!((std_p.db - cust_p.db).abs() < 1e-4, "Vented custom vs std differ at {} Hz: {} vs {}", std_p.frequency, std_p.db, cust_p.db);
        }
    }
}
