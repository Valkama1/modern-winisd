//! Everything that touches the disk: the driver database, project files, and the raw
//! file writers the export paths use.

use std::fs;
use std::path::PathBuf;
use tauri::Manager;
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

#[tauri::command]
pub fn save_project(path: String, state: ProjectState) -> Result<(), String> {
    let json = serde_json::to_string_pretty(&state).map_err(|e| e.to_string())?;
    fs::write(path, json).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn load_project(path: String) -> Result<ProjectState, String> {
    let content = fs::read_to_string(path).map_err(|e| e.to_string())?;
    let state = serde_json::from_str::<ProjectState>(&content).map_err(|e| e.to_string())?;
    Ok(state)
}


#[tauri::command]
pub fn write_text_file(path: String, content: String) -> Result<(), String> {
    fs::write(&path, content.as_bytes()).map_err(|e| e.to_string())
}

/// Read a UTF-8 text file. Used for workspace files, whose contents are a frontend
/// concern — graph layout, filters and room settings have no representation in Rust,
/// so the shape stays in TypeScript rather than being mirrored here.
#[tauri::command]
pub fn read_text_file(path: String) -> Result<String, String> {
    fs::read_to_string(&path).map_err(|e| e.to_string())
}

/// Accepts a base64 data URL (e.g. "data:image/png;base64,…") or a bare base64 string,
/// decodes it and writes the raw bytes to `path`.
#[tauri::command]
pub fn write_data_url_file(path: String, data_url: String) -> Result<(), String> {
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
}
