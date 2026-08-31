//! The data model shared across commands: a driver, a saved project, and one point of
//! a simulated curve, plus the conversion into the solver's own parameter struct.

use crate::circuit::DriverParams;
use crate::custom_topology::CustomTopologySpec;

#[derive(serde::Serialize, serde::Deserialize, Clone, Debug, Default, PartialEq)]
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
    /// Radiator travel limit in mm. Carried so the alignment solver can respect it;
    /// the curve itself is compared against it in the frontend.
    pub pr_xmax: Option<f64>,
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
    /// Which limit is binding at this frequency, for the max-SPL curve: "excursion"
    /// when the cone runs out of travel first, "power" when the voice coil's thermal
    /// rating does. Absent for every other curve.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub limited_by: Option<String>,
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


#[cfg(test)]
mod tests {
    use super::*;
    use crate::circuit;
    use crate::test_support::bc21;

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
}
