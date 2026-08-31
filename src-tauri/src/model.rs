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
    /// Enclosure loss Q — leakage and absorption. Optional so a project saved before
    /// the field existed still loads; the frontend supplies DEFAULT_QL when it is
    /// absent. `SimulationRequest` has carried this since losses were modelled, but
    /// the saved format did not, so every save quietly reset it.
    pub ql: Option<f64>,
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

    /// Enclosure loss Q has to survive a save/load cycle.
    ///
    /// It did not: the frontend read `ql` back on load and defaulted it to 7 when
    /// absent, but never wrote it, and `ProjectState` had no field to write it into —
    /// so serde dropped it silently on the way in and never emitted it on the way out.
    /// A user who tuned QL to 15 and saved got 7 back: a different simulation, with
    /// nothing on screen to say so.
    #[test]
    fn ql_survives_a_save_and_load_cycle() {
        let saved = ProjectState {
            ql: Some(15.0),
            ..project_state(bc21())
        };

        let json = serde_json::to_string(&saved).expect("serialises");
        assert!(json.contains("\"ql\":15"), "ql must reach the file: {json}");

        let loaded: ProjectState = serde_json::from_str(&json).expect("deserialises");
        assert_eq!(loaded.ql, Some(15.0));
    }

    /// A file written before the field existed must still load, with ql absent rather
    /// than the parse failing.
    #[test]
    fn a_project_saved_without_ql_still_loads() {
        let json = serde_json::to_string(&project_state(bc21())).expect("serialises");
        let stripped = json.replace("\"ql\":null,", "");
        let loaded: ProjectState = serde_json::from_str(&stripped).expect("deserialises");
        assert_eq!(loaded.ql, None);
    }

    fn project_state(driver: Driver) -> ProjectState {
        ProjectState {
            project_name: "Test".into(),
            notes: None,
            driver,
            v_box: 150.0,
            enclosure_type: "ported".into(),
            tuning_freq: 33.0,
            port_diameter: 10.0,
            input_power: 1.0,
            distance: 1.0,
            num_drivers: 1,
            port_shape: None,
            port_count: None,
            port_width: None,
            port_height: None,
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
            custom_topology: None,
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
