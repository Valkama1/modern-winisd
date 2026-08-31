use nalgebra::{DMatrix, DVector};
use num_complex::Complex64;
use std::f64::consts::PI;

pub const RHO0: f64 = 1.18;   // air density kg/m³
pub const C_AIR: f64 = 343.0;  // speed of sound m/s
/// Flanged-end correction for a duct, as a multiple of its equivalent radius. Named
/// rather than inlined because src/lib/portGeometry.ts mirrors it, and the two have
/// already drifted once — a 0.85 against this 0.732.
pub const END_CORRECTION: f64 = 0.732;

/// Semi-inductance electrical impedance model (Leach / Wright 1990).
/// Below f_meas (1 kHz): Le is constant — standard jωLe behavior, no change to bass response.
/// Above f_meas: Le decreases as 1/√f, so Im(Ze) grows as √f instead of f.
/// No resistive component is added — the datasheet Le already bakes in the DC winding resistance.
/// This keeps the bass-reflex alignment correct while fixing the too-steep high-f impedance rise.
#[inline]
fn semi_le_ze(re: f64, le_h: f64, w: f64) -> Complex64 {
    let w_meas = 2.0 * PI * 1000.0; // Le calibration frequency (1 kHz per IEC/AES)
    // Standard below f_meas, semi-inductance above: take whichever is smaller.
    let z_le_im = le_h * w.min((w_meas * w).sqrt());
    Complex64::new(re, z_le_im)
}

/// Cross-sectional area of a circular port, in m², from its diameter in cm.
pub fn circular_port_area_m2(diameter_cm: f64) -> f64 {
    let r = (diameter_cm / 2.0) * 0.01;
    (PI * r * r).max(1e-6)
}

/// Cross-sectional area of a rectangular port (slot), in m², from cm dimensions.
pub fn rect_port_area_m2(width_cm: f64, height_cm: f64) -> f64 {
    ((width_cm * 0.01) * (height_cm * 0.01)).max(1e-6)
}

/// Physical port length from tuning frequency (Helmholtz resonator formula),
/// before the end-correction the circuit solver adds back for acoustic mass:
/// L_physical = c²·Ap / (4π²·fb²·Vb) - δ·r_eq
/// Falls back to 0.15 m when tuning/area/volume aren't usable.
pub fn derive_port_length_m(area_m2: f64, tuning_freq: f64, vol_m3: f64) -> f64 {
    if tuning_freq <= 0.0 || area_m2 <= 0.0 || vol_m3 <= 0.0 {
        return 0.15;
    }
    let r_eq = (area_m2 / PI).sqrt();
    let l = (C_AIR * C_AIR * area_m2) / (4.0 * PI * PI * tuning_freq * tuning_freq * vol_m3)
        - END_CORRECTION * r_eq;
    l.max(0.01)
}

#[derive(Clone, Debug, serde::Serialize, serde::Deserialize)]
pub struct PassiveCrossoverSpec {
    pub enabled: bool,
    pub filter_type: String, // "lowpass_1st", "highpass_1st", "lowpass_2nd", "highpass_2nd"
    pub inductance_mh: f64,
    pub capacitance_uf: f64,
    pub r_series: f64, // series resistance of inductor (DCR)
}

/// Driver Thiele-Small parameters (mirrors the Driver struct in lib.rs)
#[derive(Clone, Debug)]
pub struct DriverParams {
    pub fs: f64,
    pub qts: f64,
    pub qes: f64,
    pub qms: f64,
    pub vas: f64,   // liters
    pub re: f64,
    pub sd: f64,    // cm²
    pub xmax: f64,  // mm
    pub mms: f64,   // grams
    pub le: f64,    // mH
    pub bl: f64,
    // Carried so DriverParams mirrors the Driver struct one-for-one; the solver itself
    // works from the electro-mechanical parameters above.
    #[allow(dead_code)]
    pub pe: f64,
    #[allow(dead_code)]
    pub sens: f64,
}

#[derive(Clone, Debug)]
pub enum ElementType {
    Compliance { volume_liters: f64, q_loss: f64 },
    Port { area_m2: f64, length_m: f64, q_port: f64 },
    PassiveRadiator { mms_g: f64, sd_cm2: f64, fs_pr: f64, qms_pr: f64 },
    Driver {
        #[allow(dead_code)]
        params: DriverParams
    },
    RadiationLoad { area_m2: f64 },
}

/// A circuit element connecting node_a to node_b.
/// Use node index >= 0 for real nodes, and -1 for ground (reference pressure).
#[derive(Clone, Debug)]
pub struct CircuitElement {
    pub element_type: ElementType,
    pub node_a: i32,
    pub node_b: i32,  // -1 = ground
}

#[derive(Clone, Debug)]
pub struct ExternalNode {
    pub node_idx: usize,
    pub area_m2: f64,     // radiating area for radiation impedance
    // Cone and port output are summed identically by the solver, so this only labels
    // the node for callers; nothing in the solve branches on it.
    #[allow(dead_code)]
    pub is_port: bool,    // true = port output, false = cone output
}

#[derive(Clone, Debug)]
pub struct AcousticCircuit {
    pub num_nodes: usize,
    pub elements: Vec<CircuitElement>,
    pub external_nodes: Vec<ExternalNode>,  // nodes that radiate to the outside
}

#[derive(Clone, Debug)]
pub struct CircuitSolution {
    // Full node solution, kept for inspection and debugging rather than consumed by
    // any curve; the curves are all derived from the quantities below.
    #[allow(dead_code)]
    pub pressures: Vec<Complex64>,      // pressure at each node
    #[allow(dead_code)]
    pub driver_velocity: Complex64,     // Ud = Sd * vd (volume velocity of cone)
    pub driver_displacement: Complex64, // vd / jω (cone displacement)
    pub port_velocities: Vec<Complex64>, // volume velocity through each port/PR
    pub total_radiated_velocity: Complex64, // sum of all external volume velocities
    pub input_impedance: Complex64,     // Zin = Eg / Ie
}

/// Helper: convert node index to matrix index. Returns None for ground (-1).
fn node_idx(n: i32) -> Option<usize> {
    if n >= 0 { Some(n as usize) } else { None }
}

/// Helper: get pressure at a node from the solution vector, returning 0 for ground.
fn pressure_at(pressures: &[Complex64], n: i32) -> Complex64 {
    if n >= 0 && (n as usize) < pressures.len() {
        pressures[n as usize]
    } else {
        Complex64::new(0.0, 0.0)
    }
}

/// Stamp an admittance Y between node_a and node_b into the matrix.
/// If a node is ground (-1), only the diagonal entry of the other node is stamped.
fn stamp_admittance(
    y_mat: &mut DMatrix<Complex64>,
    node_a: i32,
    node_b: i32,
    y: Complex64,
    num_nodes: usize,
) {
    let a = node_idx(node_a);
    let b = node_idx(node_b);

    if let Some(ai) = a {
        if ai < num_nodes {
            y_mat[(ai, ai)] += y;
        }
    }
    if let Some(bi) = b {
        if bi < num_nodes {
            y_mat[(bi, bi)] += y;
        }
    }
    if let (Some(ai), Some(bi)) = (a, b) {
        if ai < num_nodes && bi < num_nodes {
            y_mat[(ai, bi)] -= y;
            y_mat[(bi, ai)] -= y;
        }
    }
}

// ── Piston radiation ─────────────────────────────────────────────────────────

/// Bessel function of the first kind, order 1. Rational approximation, accurate to
/// about 1e-10 across the range — verified against quadrature in the tests below.
fn bessel_j1(x: f64) -> f64 {
    let ax = x.abs();
    if ax < 8.0 {
        let y = x * x;
        let num = x * (72362614232.0
            + y * (-7895059235.0
                + y * (242396853.1 + y * (-2972611.439 + y * (15704.48260 + y * -30.16036606)))));
        let den = 144725228442.0
            + y * (2300535178.0
                + y * (18583304.74 + y * (99447.43394 + y * (376.9991397 + y))));
        num / den
    } else {
        let z = 8.0 / ax;
        let y = z * z;
        let xx = ax - 2.356194491;
        let p1 = 1.0
            + y * (0.183105e-2
                + y * (-0.3516396496e-4 + y * (0.2457520174e-5 + y * -0.240337019e-6)));
        let p2 = 0.04687499995
            + y * (-0.2002690873e-3
                + y * (0.8449199096e-5 + y * (-0.88228987e-6 + y * 0.105787412e-6)));
        // 0.636619772 in the original tables is 2/π.
        let r = (std::f64::consts::FRAC_2_PI / ax).sqrt() * (xx.cos() * p1 - z * xx.sin() * p2);
        if x < 0.0 { -r } else { r }
    }
}

/// Struve function of order 1.
///
/// The series converges everywhere but loses its significant digits to cancellation
/// past roughly x = 24 in f64. Beyond that the leading asymptote is used: by then the
/// reactance is a few percent of a resistance that has saturated at 1, and the lumped
/// model stopped meaning anything far below it — the dashboard shades everything past
/// ka = 0.5 for exactly that reason.
fn struve_h1(x: f64) -> f64 {
    if x > 24.0 {
        return 2.0 / PI;
    }
    let h = x / 2.0;
    // Γ(m + 3/2) and Γ(m + 5/2), built up rather than called for.
    let mut g_a = PI.sqrt() * 0.5;
    let mut g_b = PI.sqrt() * 0.75;
    let mut term = 1.0;
    let mut sum = 0.0;
    for m in 0..60 {
        let t = term / (g_a * g_b);
        sum += if m % 2 == 0 { t } else { -t };
        term *= h * h;
        g_a *= m as f64 + 1.5;
        g_b *= m as f64 + 2.5;
    }
    h * h * sum
}

/// Radiation impedance of a rigid circular piston in an infinite baffle.
///
/// The exact result, `Z = (ρc/S)·[R₁(2ka) + j·X₁(2ka)]`, rather than its ka ≪ 1
/// expansion `ka²/2 + j·8ka/(3π)`.
///
/// Both terms of that expansion grow without bound; the true normalised resistance
/// saturates at 1, and the reactance peaks near ka = 0.7 and decays. For this
/// project's own reference driver — Sd 1680 cm² — the default 2 kHz upper limit is
/// ka = 8.5, where the expansion gave a normalised resistance of 36 against a true
/// value of 1.01. That load is not negligible against the driver's own admittance, so
/// it was not a cosmetic error at the top of the plot: it changed the solve. The two
/// pass 3 dB apart around ka = 1.4, roughly 350 Hz for that driver, well inside the
/// plotted band and far below the ka = 0.5 line the dashboard already shades.
pub fn radiation_impedance(area_m2: f64, w: f64) -> Complex64 {
    let a_rad = (area_m2 / PI).sqrt();
    let arg = 2.0 * (w / C_AIR) * a_rad;
    if arg < 1e-9 {
        // Both series start at zero here, so the ratios are 0/0.
        return Complex64::new(0.0, 0.0);
    }
    let r1 = 1.0 - 2.0 * bessel_j1(arg) / arg;
    let x1 = 2.0 * struve_h1(arg) / arg;
    (RHO0 * C_AIR / area_m2) * Complex64::new(r1, x1)
}

/// Why a solve could not produce an answer.
///
/// A singular admittance matrix means the circuit as described has a node nothing is
/// connected to — a topology bug, not a degenerate driver — so it is worth naming
/// rather than papering over.
#[derive(Debug, Clone, PartialEq)]
pub enum SolveError {
    Singular { freq: f64, nodes: usize },
}

impl std::fmt::Display for SolveError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            SolveError::Singular { freq, nodes } => write!(
                f,
                "the circuit has no solution at {freq:.1} Hz: its {nodes}-node admittance \
                 matrix is singular, which means a node nothing is connected to"
            ),
        }
    }
}

pub fn solve_circuit(
    circuit: &AcousticCircuit,
    freq: f64,
    e_g: f64,  // RMS amplifier voltage
    driver_params: &DriverParams,
    xo: &PassiveCrossoverSpec,
) -> Result<CircuitSolution, SolveError> {
    let w = 2.0 * PI * freq;
    let j = Complex64::new(0.0, 1.0);
    let n = circuit.num_nodes;

    let mut y_mat = DMatrix::<Complex64>::zeros(n, n);
    let mut b_vec = DVector::<Complex64>::zeros(n);

    // Compute voice coil parameters and fallback if Le <= 0
    let re = driver_params.re;
    let le_h = if driver_params.le <= 0.0 {
        // Fallback: Re * 0.15 mH
        re * 0.15 * 1e-3
    } else {
        driver_params.le * 1e-3
    };

    // Voice coil electrical impedance
    let z_e = semi_le_ze(re, le_h, w);

    // Mechanical impedance of active driver
    let sd_m2 = driver_params.sd * 1e-4;
    let w_s = 2.0 * PI * driver_params.fs;

    // Derived moving mass if missing or 0
    let mms_kg = if driver_params.mms <= 0.0 {
        let vas_m3 = driver_params.vas * 1e-3;
        if w_s > 0.0 && vas_m3 > 0.0 && sd_m2 > 0.0 {
            (RHO0 * C_AIR * C_AIR * sd_m2 * sd_m2) / (w_s * w_s * vas_m3)
        } else {
            0.1 // fallback: 100 grams
        }
    } else {
        driver_params.mms / 1000.0
    };

    let cms = 1.0 / (w_s * w_s * mms_kg);
    let rms = w_s * mms_kg / driver_params.qms;
    let z_m = Complex64::new(rms, w * mms_kg - 1.0 / (w * cms));

    // Derived BL if missing or 0
    let bl_val = if driver_params.bl <= 0.0 {
        if driver_params.qes > 0.0 && w_s > 0.0 {
            (w_s * mms_kg * re / driver_params.qes).sqrt()
        } else {
            10.0 // fallback
        }
    } else {
        driver_params.bl
    };

    // Complex input impedance of the driver alone (Z_driver = Ze + Bl²/Zm)
    let z_driver = z_e + (bl_val * bl_val) / z_m;

    let mut e_g_driver = Complex64::new(e_g, 0.0);
    let mut z_system = z_driver;

    if xo.enabled {
        let l_h = xo.inductance_mh * 1e-3;
        let c_f = xo.capacitance_uf * 1e-6;

        let z_l = Complex64::new(xo.r_series, w * l_h);
        let z_c = if c_f > 0.0 {
            Complex64::new(0.0, -1.0 / (w * c_f))
        } else {
            Complex64::new(1e12, 0.0) // open circuit
        };

        match xo.filter_type.as_str() {
            "lowpass_1st" => {
                e_g_driver = e_g * z_driver / (z_driver + z_l);
                z_system = z_l + z_driver;
            }
            "highpass_1st" => {
                e_g_driver = e_g * z_driver / (z_driver + z_c);
                z_system = z_c + z_driver;
            }
            "lowpass_2nd" => {
                let z_p = (z_c * z_driver) / (z_c + z_driver);
                e_g_driver = e_g * z_p / (z_p + z_l);
                z_system = z_l + z_p;
            }
            "highpass_2nd" => {
                let z_p = (z_l * z_driver) / (z_l + z_driver);
                e_g_driver = e_g * z_p / (z_p + z_c);
                z_system = z_c + z_p;
            }
            _ => {}
        }
    }

    // Track driver Norton equivalent for post-solve extraction
    let mut p_gen_d = Complex64::new(0.0, 0.0);
    let mut y_a_d = Complex64::new(0.0, 0.0);
    let mut driver_front_node: i32 = -1;
    let mut driver_rear_node: i32 = -1;

    // Track port/PR admittances and their node connections for velocity extraction
    let mut port_admittances: Vec<(Complex64, i32, i32)> = Vec::new();

    for element in &circuit.elements {
        match &element.element_type {
            ElementType::Compliance { volume_liters, q_loss } => {
                let v_m3 = volume_liters * 1e-3;
                let cab = v_m3 / (RHO0 * C_AIR * C_AIR);
                // Admittance: reactive + loss conductance (shunt to ground)
                let y_val = j * (w * cab) + (w * cab / q_loss);
                stamp_admittance(&mut y_mat, element.node_a, element.node_b, y_val, n);
            }
            ElementType::Port { area_m2, length_m, q_port } => {
                // Add end-correction to physical port length to get effective acoustic length:
                // L_eff = L_physical + 0.732 * r_eq  (single unflanged end correction)
                let r_eq = (area_m2 / PI).sqrt();
                let l_eff = length_m + 0.732 * r_eq;
                let map = (RHO0 * l_eff) / area_m2;
                let rap = w * map / q_port;
                let z_port = Complex64::new(rap, w * map);
                let y_val = 1.0 / z_port;
                port_admittances.push((y_val, element.node_a, element.node_b));
                stamp_admittance(&mut y_mat, element.node_a, element.node_b, y_val, n);
            }
            ElementType::PassiveRadiator { mms_g, sd_cm2, fs_pr, qms_pr } => {
                let sd_m2 = sd_cm2 * 1e-4;
                let mms_kg = mms_g / 1000.0;
                let ma_pr = mms_kg / (sd_m2 * sd_m2);
                let ws_pr = 2.0 * PI * fs_pr;
                let ca_pr = 1.0 / (ws_pr * ws_pr * ma_pr);
                let ra_pr = ws_pr * ma_pr / qms_pr;

                let z_pr = Complex64::new(ra_pr, w * ma_pr - 1.0 / (w * ca_pr));
                let y_val = 1.0 / z_pr;
                port_admittances.push((y_val, element.node_a, element.node_b));
                stamp_admittance(&mut y_mat, element.node_a, element.node_b, y_val, n);
            }
            ElementType::Driver { params: _ } => {
                // Total acoustic impedance of driver (precalculated)
                let z_a_total = (z_m + (bl_val * bl_val) / z_e) / (sd_m2 * sd_m2);
                let y_val = 1.0 / z_a_total;

                // Norton equivalent source (driven by e_g_driver)
                let p_gen = (bl_val * e_g_driver) / (sd_m2 * z_e);
                let i_nrt = p_gen / z_a_total;

                p_gen_d = p_gen;
                y_a_d = y_val;
                driver_front_node = element.node_a;
                driver_rear_node = element.node_b;

                // Stamp admittance
                stamp_admittance(&mut y_mat, element.node_a, element.node_b, y_val, n);

                // Stamp Norton current source
                if let Some(ai) = node_idx(element.node_a) {
                    if ai < n { b_vec[ai] += i_nrt; }
                }
                if let Some(bi) = node_idx(element.node_b) {
                    if bi < n { b_vec[bi] -= i_nrt; }
                }
            }
            ElementType::RadiationLoad { area_m2 } => {
                let z_rad = radiation_impedance(*area_m2, w);
                let y_val = 1.0 / z_rad;
                // Radiation load is always shunt to ground
                stamp_admittance(&mut y_mat, element.node_a, -1, y_val, n);
            }
        }
    }

    // Solve the system Y * P = b.
    //
    // A failure here used to become a vector of zeros, which is worse than no answer:
    // with every pressure zero, delta_p is zero, so `ud` collapses to the Norton
    // source — the driver's *free-air* velocity. Excursion and impedance then describe
    // a driver hanging in open air, with nothing anywhere to say the solve failed.
    let pressures_vec = if n > 0 {
        let decomp = y_mat.lu();
        decomp.solve(&b_vec).ok_or(SolveError::Singular { freq, nodes: n })?
    } else {
        DVector::zeros(0)
    };

    let pressures: Vec<Complex64> = pressures_vec.iter().cloned().collect();

    // Calculate driver volume velocity (Ud)
    let p_front = pressure_at(&pressures, driver_front_node);
    let p_rear = pressure_at(&pressures, driver_rear_node);
    let delta_p = p_front - p_rear;

    let i_norton_driver = p_gen_d * y_a_d;
    let ud = i_norton_driver - y_a_d * delta_p;

    let sd_m2 = driver_params.sd * 1e-4;
    let vd = ud / sd_m2;
    let xd = vd / (j * w);

    // Port/PR volume velocities
    let mut port_velocities = Vec::new();
    for (y_port, a, b) in &port_admittances {
        let p_a = pressure_at(&pressures, *a);
        let p_b = pressure_at(&pressures, *b);
        let u_port = *y_port * (p_a - p_b);
        port_velocities.push(u_port);
    }

    // Input impedance: reuse the same Le/BL (including fallback derivations) used for stamping,
    // so the impedance curve stays consistent with the SPL/excursion solve above.
    let i_e = (e_g - bl_val * vd) / z_e;
    let z_in = if xo.enabled {
        z_system
    } else {
        if i_e.norm() > 1e-12 { e_g / i_e } else { z_e }
    };

    // Total radiated velocity from external nodes
    let mut total_u = Complex64::new(0.0, 0.0);
    for ext_node in &circuit.external_nodes {
        if ext_node.node_idx < n {
            let y_rad = 1.0 / radiation_impedance(ext_node.area_m2, w);
            let u_rad = pressures[ext_node.node_idx] * y_rad;
            total_u += u_rad;
        }
    }

    Ok(CircuitSolution {
        pressures,
        driver_velocity: ud,
        driver_displacement: xd,
        port_velocities,
        total_radiated_velocity: total_u,
        input_impedance: z_in,
    })
}

/// Peak cone displacement in mm from the solved phasor displacement.
///
/// The circuit is driven with an RMS voltage (`e_g = √(P·Re)`), so `driver_displacement`
/// is an RMS magnitude. Xmax, however, is specified as a one-way *peak* excursion, so
/// comparing the two directly understates cone travel by √2 — which reports roughly
/// twice the power the driver can actually take before leaving its linear range.
/// Everything user-facing is in peak mm, so the conversion lives here rather than being
/// repeated (or forgotten) at each call site.
pub fn peak_displacement_mm(displacement: Complex64) -> f64 {
    displacement.norm() * std::f64::consts::SQRT_2 * 1000.0
}

/// Compute SPL in dB at a given distance from the total radiated volume velocity.
///
/// `env_gain` scales for the listening environment. Each additional reflecting boundary
/// halves the radiation solid angle, doubling pressure (+6 dB) at a fixed distance:
///   1.0 = half-space (2π sr,   one boundary — infinite baffle / wall mount) — default
///   0.5 = free-field  (4π sr,  no boundaries — anechoic / elevated)         — −6 dB vs half-space
///   4.0 = corner      (π/2 sr, three reflecting boundaries)                 — +12 dB vs half-space
pub fn compute_spl(
    total_radiated_velocity: Complex64,
    freq: f64,
    distance: f64,
    env_gain: f64,
) -> f64 {
    let w = 2.0 * PI * freq;
    // |P(r)| = ω·ρ₀·|U|·env_gain / (2π·r)
    let p_mag = (w * RHO0 * total_radiated_velocity.norm() * env_gain) / (2.0 * PI * distance);
    let p_ref = 20e-6; // 20 µPa reference
    if p_mag > 1e-12 {
        20.0 * (p_mag / p_ref).log10()
    } else {
        0.0
    }
}

#[cfg(test)]
mod tests {
    /// Reference values for the rigid circular piston in an infinite baffle, computed
    /// by quadrature rather than by another series that could be wrong the same way:
    ///   R₁(w) = 1 − 2·J₁(w)/w  with  J₁(w) = (1/π)∫₀^π cos(t − w·sin t) dt
    ///   X₁(w) = (4/π)∫₀^{π/2} sin(w·cos α)·sin²α dα
    /// (ka, R₁(2ka), X₁(2ka))
    const PISTON_REFERENCE: [(f64, f64, f64); 13] = [
        (0.05, 0.001249479, 0.042413032),
        (0.10, 0.004991674, 0.084656541),
        (0.25, 0.030926169, 0.208694977),
        (0.50, 0.119898829, 0.396914672),
        (0.70, 0.225788980, 0.520754315),
        (1.00, 0.423275192, 0.646763728),
        (1.40, 0.707350538, 0.690356991),
        (2.00, 1.033021664, 0.534863331),
        (3.00, 1.092227953, 0.159391750),
        (4.00, 0.941340913, 0.122029012),
        (6.00, 1.037241184, 0.097309554),
        (8.50, 1.011490411, 0.094824217),
        (12.00, 1.012836505, 0.057564931),
    ];

    /// Normalise back out of the (ρc/S) scaling so the table can be read directly.
    fn normalised(ka: f64) -> (f64, f64) {
        let area = 0.1_f64; // any area; ka is what the answer depends on
        let a_rad = (area / PI).sqrt();
        let w = ka * C_AIR / a_rad;
        let z = radiation_impedance(area, w) / (RHO0 * C_AIR / area);
        (z.re, z.im)
    }

    #[test]
    fn piston_radiation_matches_the_exact_result() {
        for (ka, r_ref, x_ref) in PISTON_REFERENCE {
            let (r, x) = normalised(ka);
            assert!(
                (r - r_ref).abs() < 1e-6,
                "ka {ka}: resistance {r:.9} against {r_ref:.9}"
            );
            assert!(
                (x - x_ref).abs() < 1e-6,
                "ka {ka}: reactance {x:.9} against {x_ref:.9}"
            );
        }
    }

    /// The property the old model got wrong, stated on its own: a piston cannot
    /// radiate more efficiently than a plane wave, so the normalised resistance
    /// approaches 1 and stays there. The ka ≪ 1 expansion had it growing as ka²/2 —
    /// 36 at the reference driver's 2 kHz, where the true figure is 1.01.
    #[test]
    fn radiation_resistance_saturates_rather_than_growing_without_bound() {
        for ka in [2.0, 4.0, 8.5, 16.0, 40.0, 200.0] {
            let (r, x) = normalised(ka);
            assert!(
                (0.85..=1.15).contains(&r),
                "ka {ka}: normalised resistance {r:.3} left the neighbourhood of 1"
            );
            assert!((0.0..0.6).contains(&x), "ka {ka}: reactance {x:.3} should be small and positive");
            assert!(
                x < r,
                "ka {ka}: radiation should be resistance-dominated once the piston is large"
            );
        }
    }

    #[test]
    fn radiation_still_agrees_with_the_low_frequency_expansion_where_that_holds() {
        // Below ka ≈ 0.1 the old expansion was right, and the new model must not have
        // moved the region the whole app actually works in.
        for ka in [0.01, 0.05, 0.1] {
            let (r, x) = normalised(ka);
            assert!((r - ka * ka / 2.0).abs() / (ka * ka / 2.0) < 0.02, "ka {ka}: R {r}");
            assert!((x - 8.0 * ka / (3.0 * PI)).abs() / x < 0.02, "ka {ka}: X {x}");
        }
    }

    use super::*;

    fn dummy_driver() -> DriverParams {
        DriverParams {
            fs: 30.0,
            qts: 0.35,
            qes: 0.38,
            qms: 5.0,
            vas: 100.0,
            re: 6.0,
            sd: 500.0,
            xmax: 8.0,
            mms: 80.0,
            le: 1.0,
            bl: 15.0,
            pe: 250.0,
            sens: 90.0,
        }
    }

    #[test]
    fn test_passive_crossover_lowpass_attenuation() {
        let circuit = AcousticCircuit {
            num_nodes: 2,
            elements: vec![
                CircuitElement {
                    element_type: ElementType::Driver { params: dummy_driver() },
                    node_a: 1,
                    node_b: 0,
                },
                CircuitElement {
                    element_type: ElementType::Compliance { volume_liters: 50.0, q_loss: 10.0 },
                    node_a: 0,
                    node_b: -1,
                },
                CircuitElement {
                    element_type: ElementType::RadiationLoad { area_m2: dummy_driver().sd * 1e-4 },
                    node_a: 1,
                    node_b: -1,
                },
            ],
            external_nodes: vec![ExternalNode { node_idx: 1, area_m2: dummy_driver().sd * 1e-4, is_port: false }],
        };

        // Standard lowpass: 3 mH series inductor, 0.5 ohms series resistance
        let xo_enabled = PassiveCrossoverSpec {
            enabled: true,
            filter_type: "lowpass_1st".to_string(),
            inductance_mh: 3.0,
            capacitance_uf: 0.0,
            r_series: 0.5,
        };
        let xo_disabled = PassiveCrossoverSpec {
            enabled: false,
            filter_type: "lowpass_1st".to_string(),
            inductance_mh: 3.0,
            capacitance_uf: 0.0,
            r_series: 0.5,
        };

        let dp = dummy_driver();

        // Solve at high frequency (1000 Hz) with and without filter
        let sol_filtered = solve_circuit(&circuit, 1000.0, 2.83, &dp, &xo_enabled).expect("the test circuit must solve");
        let sol_raw = solve_circuit(&circuit, 1000.0, 2.83, &dp, &xo_disabled).expect("the test circuit must solve");

        assert!(sol_raw.driver_velocity.norm() > sol_filtered.driver_velocity.norm() * 2.0,
                "High frequency velocity should be significantly attenuated by 1st-order lowpass crossover");
    }

    #[test]
    fn test_passive_crossover_highpass_attenuation() {
        let circuit = AcousticCircuit {
            num_nodes: 2,
            elements: vec![
                CircuitElement {
                    element_type: ElementType::Driver { params: dummy_driver() },
                    node_a: 1,
                    node_b: 0,
                },
                CircuitElement {
                    element_type: ElementType::Compliance { volume_liters: 50.0, q_loss: 10.0 },
                    node_a: 0,
                    node_b: -1,
                },
                CircuitElement {
                    element_type: ElementType::RadiationLoad { area_m2: dummy_driver().sd * 1e-4 },
                    node_a: 1,
                    node_b: -1,
                },
            ],
            external_nodes: vec![ExternalNode { node_idx: 1, area_m2: dummy_driver().sd * 1e-4, is_port: false }],
        };

        // Standard highpass: 100 uF series capacitor
        let xo_enabled = PassiveCrossoverSpec {
            enabled: true,
            filter_type: "highpass_1st".to_string(),
            inductance_mh: 0.0,
            capacitance_uf: 100.0,
            r_series: 0.0,
        };
        let xo_disabled = PassiveCrossoverSpec {
            enabled: false,
            filter_type: "highpass_1st".to_string(),
            inductance_mh: 0.0,
            capacitance_uf: 100.0,
            r_series: 0.0,
        };

        let dp = dummy_driver();

        // Solve at low frequency (10 Hz) with and without filter
        let sol_filtered = solve_circuit(&circuit, 10.0, 2.83, &dp, &xo_enabled).expect("the test circuit must solve");
        let sol_raw = solve_circuit(&circuit, 10.0, 2.83, &dp, &xo_disabled).expect("the test circuit must solve");

        assert!(sol_raw.driver_velocity.norm() > sol_filtered.driver_velocity.norm() * 5.0,
                "Low frequency velocity should be significantly attenuated by 1st-order highpass crossover");
    }
}
