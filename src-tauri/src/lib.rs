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

// Runs off the IPC thread. A synchronous command executes inline on the thread that
// received the invoke, so the webview is frozen for its whole duration — it cannot
// even paint a spinner. `(async)` on a non-async fn hands it to the async runtime
// instead; no signature change and nothing to await.
#[tauri::command(async)]
// 14 positional parameters, eight of them consecutive Options — the exact shape
// `port_sizing.rs` documents as how `auto_calculate_port` came to silently drop
// `driver_config` and the whole second port group. The fix is the named-payload
// struct the other two commands already take; until then the lint would only be
// silenced crate-wide, which would stop it catching the next one.
#[allow(clippy::too_many_arguments)]
fn auto_align_enclosure(
    driver: Driver,
    enclosure_type: String,
    alignment_target: String,
    num_drivers: i32,
    input_power: f64,
    driver_config: Option<String>,
    port_q: Option<f64>,
    ql: Option<f64>,
    pr_mms: Option<f64>,
    pr_sd: Option<f64>,
    pr_qms: Option<f64>,
    pr_xmax: Option<f64>,
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
