//! Everything that touches the disk: the driver database, project files, and the raw
//! file writers the export paths use.

use std::fs;
use std::path::PathBuf;
use tauri::{Manager, Runtime};
use tauri_plugin_fs::FsExt;
use base64::Engine;

use crate::model::{Driver, ProjectState};


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

#[tauri::command]
pub fn get_drivers(app: tauri::AppHandle) -> Vec<Driver> {
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
pub fn add_driver(app: tauri::AppHandle, driver: Driver) -> Result<Vec<Driver>, String> {
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
pub fn edit_driver(app: tauri::AppHandle, id: String, driver: Driver) -> Result<Vec<Driver>, String> {
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

/// Resolve a path the webview asked us to touch, or refuse it.
///
/// The webview is the untrusted side of this app: an injected script can call `invoke`
/// directly and never go near a dialog, so a caller-supplied path is not evidence the
/// user chose anything. `tauri-plugin-dialog` records every path the user actually
/// picks onto the filesystem scope, which makes that scope the list of files this
/// session is allowed to read or write. Everything else is refused.
///
/// `Scope::is_allowed` canonicalises and resolves symlinks itself, so `..` traversal and
/// symlink escapes are covered here rather than by hand. A path that does not exist yet
/// — a save dialog naming a new file — is matched literally, which is why saving works.
fn scoped_path<R: Runtime>(app: &tauri::AppHandle<R>, path: &str) -> Result<PathBuf, String> {
    if path.trim().is_empty() {
        return Err("No file path was given.".to_string());
    }
    let scope = app
        .try_fs_scope()
        .ok_or("File access is unavailable: the filesystem scope is not initialised.")?;
    if !scope.is_allowed(path) {
        return Err(format!(
            "Refused: {path} was not chosen in a file dialog this session."
        ));
    }
    Ok(PathBuf::from(path))
}

#[tauri::command]
pub fn save_project<R: Runtime>(
    app: tauri::AppHandle<R>,
    path: String,
    state: ProjectState,
) -> Result<(), String> {
    let path = scoped_path(&app, &path)?;
    let json = serde_json::to_string_pretty(&state).map_err(|e| e.to_string())?;
    fs::write(path, json).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn load_project<R: Runtime>(
    app: tauri::AppHandle<R>,
    path: String,
) -> Result<ProjectState, String> {
    let path = scoped_path(&app, &path)?;
    let content = fs::read_to_string(path).map_err(|e| e.to_string())?;
    let state = serde_json::from_str::<ProjectState>(&content).map_err(|e| e.to_string())?;
    Ok(state)
}


#[tauri::command]
pub fn write_text_file<R: Runtime>(
    app: tauri::AppHandle<R>,
    path: String,
    content: String,
) -> Result<(), String> {
    let path = scoped_path(&app, &path)?;
    fs::write(&path, content.as_bytes()).map_err(|e| e.to_string())
}

/// Read a UTF-8 text file. Used for workspace files, whose contents are a frontend
/// concern — graph layout, filters and room settings have no representation in Rust,
/// so the shape stays in TypeScript rather than being mirrored here.
#[tauri::command]
pub fn read_text_file<R: Runtime>(
    app: tauri::AppHandle<R>,
    path: String,
) -> Result<String, String> {
    let path = scoped_path(&app, &path)?;
    fs::read_to_string(&path).map_err(|e| e.to_string())
}

/// Accepts a base64 data URL (e.g. "data:image/png;base64,…") or a bare base64 string,
/// decodes it and writes the raw bytes to `path`.
#[tauri::command]
pub fn write_data_url_file<R: Runtime>(
    app: tauri::AppHandle<R>,
    path: String,
    data_url: String,
) -> Result<(), String> {
    let path = scoped_path(&app, &path)?;
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


#[cfg(test)]
mod tests {
    use super::*;

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

    // ── Path scoping ────────────────────────────────────────────────────────
    //
    // The webview is the untrusted side: an injected script can call `invoke`
    // directly and never go near a dialog. These pin the rule that a path is only
    // honoured once `tauri-plugin-dialog` has recorded it on the fs scope.

    use tauri::test::{mock_builder, mock_context, noop_assets};

    fn scoped_app() -> tauri::App<tauri::test::MockRuntime> {
        mock_builder()
            .plugin(tauri_plugin_fs::init())
            .build(mock_context(noop_assets()))
            .expect("mock app")
    }

    fn scratch(name: &str) -> PathBuf {
        let dir = std::env::temp_dir().join("winisd_scope_test");
        let _ = fs::create_dir_all(&dir);
        dir.join(name)
    }

    #[test]
    fn reading_a_path_no_dialog_returned_is_refused() {
        let app = scoped_app();
        let secret = scratch("not_picked.txt");
        fs::write(&secret, "sensitive").unwrap();

        let err = read_text_file(app.handle().clone(), secret.to_string_lossy().into_owned())
            .expect_err("a path the user never picked must be refused");

        assert!(err.contains("file dialog"), "unexpected message: {err}");
        let _ = fs::remove_file(&secret);
    }

    #[test]
    fn reading_a_path_the_dialog_granted_succeeds() {
        let app = scoped_app();
        let picked = scratch("picked.wsp");
        fs::write(&picked, "workspace contents").unwrap();
        app.fs_scope().allow_file(&picked).unwrap();

        let text = read_text_file(app.handle().clone(), picked.to_string_lossy().into_owned())
            .expect("a dialog-picked path must be readable");

        assert_eq!(text, "workspace contents");
        let _ = fs::remove_file(&picked);
    }

    #[test]
    fn writing_a_path_no_dialog_returned_leaves_the_file_untouched() {
        let app = scoped_app();
        let target = scratch("untouched.txt");
        fs::write(&target, "original").unwrap();

        let err = write_text_file(
            app.handle().clone(),
            target.to_string_lossy().into_owned(),
            "overwritten".to_string(),
        )
        .expect_err("writing to a path the user never picked must be refused");

        assert!(err.contains("file dialog"), "unexpected message: {err}");
        assert_eq!(fs::read_to_string(&target).unwrap(), "original");
        let _ = fs::remove_file(&target);
    }

    #[test]
    fn saving_to_a_granted_path_that_does_not_exist_yet_succeeds() {
        // A save dialog names a file before it exists, so the guard must not depend
        // on the path resolving on disk.
        let app = scoped_app();
        let fresh = scratch("brand_new.wsp");
        let _ = fs::remove_file(&fresh);
        app.fs_scope().allow_file(&fresh).unwrap();

        write_text_file(
            app.handle().clone(),
            fresh.to_string_lossy().into_owned(),
            "fresh contents".to_string(),
        )
        .expect("a dialog-picked save path must be writable before it exists");

        assert_eq!(fs::read_to_string(&fresh).unwrap(), "fresh contents");
        let _ = fs::remove_file(&fresh);
    }

    #[test]
    fn an_empty_path_is_refused() {
        let app = scoped_app();
        let err = read_text_file(app.handle().clone(), String::new())
            .expect_err("an empty path must be refused");
        assert!(err.contains("No file path"), "unexpected message: {err}");
    }
}
