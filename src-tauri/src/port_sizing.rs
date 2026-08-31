//! Recommends a vent for a given box and tuning.
//!
//! Runs its own sweep through the solver to find the volume velocity the box pushes,
//! then sizes a port that keeps the air speed under the chuffing limit and still fits.

use crate::circuit;
use crate::model::Driver;
use crate::simulate::{SimulationRequest, simulate_system};

/// Payload for `auto_calculate_port`. It previously took thirteen positional
/// arguments, and dropping `driver_config` and the second port group into that tail is
/// how the recommendation came to ignore both.
#[derive(serde::Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase", default)]
pub struct PortSizingRequest {
    pub driver: Driver,
    pub v_box: f64,
    pub tuning_freq: f64,
    pub input_power: f64,
    pub num_drivers: i32,
    pub driver_config: Option<String>,
    pub port_q: Option<f64>,
    pub ql: Option<f64>,
    // Second port group, if the design already has one. Its area counts toward the vent
    // the box needs, and toward the tuning the length has to hit.
    pub port2_enabled: Option<bool>,
    pub port2_count: Option<i32>,
    pub port2_diameter: Option<f64>,
    pub port2_shape: Option<String>,
    pub port2_width: Option<f64>,
    pub port2_height: Option<f64>,
}

impl Default for PortSizingRequest {
    fn default() -> Self {
        Self {
            driver: Driver::default(),
            v_box: 0.0,
            tuning_freq: 0.0,
            input_power: 1.0,
            num_drivers: 1,
            driver_config: None,
            port_q: None,
            ql: None,
            port2_enabled: None,
            port2_count: None,
            port2_diameter: None,
            port2_shape: None,
            port2_width: None,
            port2_height: None,
        }
    }
}

#[tauri::command]
pub fn auto_calculate_port(request: PortSizingRequest) -> PortRecommendation {
    let PortSizingRequest {
        driver, v_box, tuning_freq, input_power, num_drivers, driver_config, port_q, ql,
        port2_enabled, port2_count, port2_diameter, port2_shape, port2_width, port2_height,
    } = request;

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
    // The probe deliberately runs as a single vent even when the design has two groups:
    // what is wanted here is the *total* volume velocity the box pushes through its
    // vents, which barely depends on how that area is split, and the velocity curve
    // switches to reporting per-port velocity once port 2 is on.
    let points = simulate_system(SimulationRequest {
        driver: driver.clone(),
        v_box,
        enclosure_type: "ported".to_string(),
        tuning_freq,
        port_diameter: dummy_diameter,
        input_power,
        num_drivers,
        curve_type: "velocity".to_string(),
        f_max: 2000.0,
        port_q,
        ql,
        driver_config,
        ..Default::default()
    });

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
            circuit::rect_port_area_m2(port2_width.unwrap_or(10.0), port2_height.unwrap_or(5.0))
        } else {
            circuit::circular_port_area_m2(port2_diameter.unwrap_or(10.0))
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
            let single_ap = circuit::circular_port_area_m2(d);
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
            let ap = circuit::circular_port_area_m2(10.0);
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
        (best_count as f64) * circuit::circular_port_area_m2(best_diam)
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
pub struct PortRecommendation {
    pub port_shape: String,
    pub port_count: i32,
    pub port_diameter: f64,
    pub port_width: f64,
    pub port_height: f64,
    pub port_length: f64,
    pub peak_velocity: f64,
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::circuit;
    use crate::test_support::bc21;

    #[test]
    fn test_port_sizing_request_deserializes_frontend_payload() {
        let payload = serde_json::json!({
            "driver": bc21(),
            "vBox": 200.0,
            "tuningFreq": 33.0,
            "inputPower": 1000.0,
            "numDrivers": 1,
            "driverConfig": "standard",
            "portQ": 50.0,
            "port2Enabled": true,
            "port2Count": 2,
            "port2Diameter": 10.0,
            "port2Shape": "circular",
            "port2Width": 20.0,
            "port2Height": 5.0,
        });
        let r: PortSizingRequest = serde_json::from_value(payload).expect("payload must parse");
        assert_eq!(r.v_box, 200.0);
        assert_eq!(r.tuning_freq, 33.0);
        assert_eq!(r.port2_enabled, Some(true));
        assert_eq!(r.port2_count, Some(2));
        assert_eq!(r.driver_config.as_deref(), Some("standard"));
    }

    #[test]
    #[ignore = "generator: emits reference values for src/lib/portGeometry.test.ts"]
    fn emit_port_length_reference() {
        // (area m2, tuning Hz, volume m3)
        let cases = [
            (0.00785, 33.0, 0.050),
            (0.00785, 20.0, 0.150),
            (0.0300, 32.0, 0.120),
            (0.0150, 45.0, 0.030),
            (0.0500, 25.0, 0.200),
            (0.0800, 40.0, 0.040),   // vent too large: must clamp
            (0.00196, 60.0, 0.015),
            (0.001, 100.0, 0.5),     // port far too small for this tuning: clamps
        ];
        for (a, f, v) in cases {
            println!("  [{a}, {f}, {v}, {:.9}],", circuit::derive_port_length_m(a, f, v));
        }
    }

    #[test]
    fn test_auto_calculate_port_accuracy() {
        let rec = auto_calculate_port(PortSizingRequest {
            driver: bc21(),
            v_box: 200.0,
            tuning_freq: 33.0,
            input_power: 1000.0,
            ..Default::default()
        });
        assert!(rec.port_length > 0.0);
        assert!(rec.peak_velocity >= 0.0);
    }

    /// The recommendation used to be computed as if the second port group did not
    /// exist, so a dual-port design got a first group sized to carry the whole vent
    /// requirement on its own — and a length derived from that group's area alone,
    /// which tunes the box above Fb once both groups are open.
    #[test]
    fn test_auto_calculate_port_accounts_for_second_port_group() {
        let base = PortSizingRequest {
            driver: bc21(),
            v_box: 200.0,
            tuning_freq: 33.0,
            input_power: 1000.0,
            ..Default::default()
        };
        let solo = auto_calculate_port(base.clone());
        let with_p2 = auto_calculate_port(PortSizingRequest {
            port2_enabled: Some(true),
            port2_count: Some(1),
            port2_diameter: Some(10.0),
            port2_shape: Some("circular".to_string()),
            ..base
        });

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
}
