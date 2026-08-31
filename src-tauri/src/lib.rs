//! Command surface and app bootstrap.
//!
//! The physics lives in `circuit` (the solver), `topologies` (how each enclosure is
//! wired) and `alignment` (searching that model for a box). Everything above them is
//! split by what it touches: `model` for the shared data, `simulate` for the response
//! commands, `port_sizing` for vent recommendations, and `storage` for the disk.

mod alignment;
mod circuit;
mod custom_topology;
mod model;
mod port_sizing;
mod simulate;
mod storage;
mod topologies;

#[cfg(test)]
mod test_support;

use model::{Driver, apply_driver_config, driver_to_params};

/// Everything `auto_align_enclosure` needs, as one payload.
///
/// It took 14 positional parameters with eight consecutive `Option`s in the tail —
/// the exact shape `port_sizing.rs` records as how `auto_calculate_port` came to
/// silently drop `driver_config` and the whole second port group. Miscount that tail
/// and the compiler cannot help you, because every one of them is an `Option<f64>`.
///
/// Named fields plus `#[serde(default)]` make that impossible: a field the frontend
/// stops sending falls back to its default rather than shifting everything after it
/// along by one, and adding a parameter no longer touches any caller.
#[derive(serde::Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase", default)]
pub struct AlignEnclosureRequest {
    pub driver: Driver,
    pub enclosure_type: String,
    pub alignment_target: String,
    pub num_drivers: i32,
    pub input_power: f64,
    pub driver_config: Option<String>,
    pub port_q: Option<f64>,
    pub ql: Option<f64>,
    pub pr_mms: Option<f64>,
    pub pr_sd: Option<f64>,
    pub pr_qms: Option<f64>,
    pub pr_xmax: Option<f64>,
    pub constraints: Option<alignment::AlignConstraints>,
    pub passband: Option<alignment::PassbandTarget>,
}

impl Default for AlignEnclosureRequest {
    fn default() -> Self {
        Self {
            driver: Driver::default(),
            enclosure_type: String::new(),
            alignment_target: String::new(),
            num_drivers: 1,
            input_power: 1.0,
            driver_config: None,
            port_q: None,
            ql: None,
            pr_mms: None,
            pr_sd: None,
            pr_qms: None,
            pr_xmax: None,
            constraints: None,
            passband: None,
        }
    }
}

// Runs off the IPC thread. A synchronous command executes inline on the thread that
// received the invoke, so the webview is frozen for its whole duration — it cannot
// even paint a spinner. `(async)` on a non-async fn hands it to the async runtime
// instead; no signature change and nothing to await.
#[tauri::command(async)]
fn auto_align_enclosure(request: AlignEnclosureRequest) -> alignment::AlignmentRecommendation {
    let AlignEnclosureRequest {
        driver,
        enclosure_type,
        alignment_target,
        num_drivers,
        input_power,
        driver_config,
        port_q,
        ql,
        pr_mms,
        pr_sd,
        pr_qms,
        pr_xmax,
        constraints,
        passband,
    } = request;

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
        q_loss: simulate::resolve_q_loss(ql),
        pr_xmax: pr_xmax.unwrap_or(0.0),
        pr_mms: pr_mms.unwrap_or(200.0),
        pr_sd: pr_sd.unwrap_or(driver.sd),
        pr_qms: pr_qms.unwrap_or(5.0),
        target: alignment::AlignTarget::from_str(&alignment_target),
        constraints: constraints.unwrap_or_default(),
        passband,
    };

    alignment::solve_alignment(&req)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        // Registered for its scope, not its commands. The dialog plugin records every
        // path the user picks onto this scope, which is what `storage::scoped_path`
        // checks against. No `fs:` permission is granted in `capabilities/default.json`,
        // so the plugin's own read/write commands stay unreachable from the webview.
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            simulate::simulate_system,
            simulate::simulate_custom,
            storage::get_drivers,
            storage::add_driver,
            storage::edit_driver,
            storage::save_project,
            storage::load_project,
            port_sizing::auto_calculate_port,
            auto_align_enclosure,
            storage::write_text_file,
            storage::read_text_file,
            storage::write_data_url_file
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

// ─── Tests ──────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;

    /// The payload the frontend actually sends, parsed as one struct.
    ///
    /// This command took 14 positional parameters with eight consecutive Options in the
    /// tail — the shape port_sizing.rs records as how `auto_calculate_port` came to
    /// silently drop `driver_config` and the whole second port group. A field the
    /// frontend stops sending now falls back to Default rather than shifting everything
    /// after it along by one.
    #[test]
    fn align_request_deserializes_frontend_payload() {
        let payload = serde_json::json!({
            "driver": { "id": "d", "manufacturer": "", "model": "", "fs": 33.0,
                        "qts": 0.36, "qes": 0.37, "qms": 7.7, "vas": 278.0, "re": 3.6,
                        "sd": 1680.0, "xmax": 14.0, "mms": 335.0, "le": 1.7,
                        "bl": 24.8, "pe": 1700.0, "sens": 97.0 },
            "enclosureType": "ported",
            "alignmentTarget": "maximally_flat",
            "numDrivers": 2,
            "inputPower": 500.0,
            "driverConfig": "isobaric_series",
            "portQ": 45.0,
            "ql": 15.0,
            "prMms": 300.0,
            "prSd": 1680.0,
            "prQms": 5.0,
            "prXmax": 22.0,
        });

        let r: AlignEnclosureRequest =
            serde_json::from_value(payload).expect("payload must parse");

        assert_eq!(r.enclosure_type, "ported");
        assert_eq!(r.num_drivers, 2);
        assert_eq!(r.input_power, 500.0);
        assert_eq!(r.driver_config.as_deref(), Some("isobaric_series"));
        assert_eq!(r.port_q, Some(45.0));
        assert_eq!(r.ql, Some(15.0));
        assert_eq!(r.pr_xmax, Some(22.0));
        assert_eq!(r.driver.fs, 33.0);
    }

    /// Everything but the driver is optional, so a caller that omits a field gets the
    /// documented default rather than a failed call.
    #[test]
    fn an_omitted_field_falls_back_rather_than_shifting_the_rest() {
        let payload = serde_json::json!({
            "driver": { "id": "d", "manufacturer": "", "model": "", "fs": 33.0,
                        "qts": 0.36, "qes": 0.37, "qms": 7.7, "vas": 278.0, "re": 3.6,
                        "sd": 1680.0, "xmax": 14.0, "mms": 335.0, "le": 1.7,
                        "bl": 24.8, "pe": 1700.0, "sens": 97.0 },
            "enclosureType": "sealed",
            "alignmentTarget": "maximally_flat",
        });

        let r: AlignEnclosureRequest =
            serde_json::from_value(payload).expect("a sparse payload must still parse");

        assert_eq!(r.num_drivers, 1, "num_drivers should default to one driver");
        assert_eq!(r.input_power, 1.0);
        assert_eq!(r.port_q, None);
        assert!(r.constraints.is_none());
    }
}
