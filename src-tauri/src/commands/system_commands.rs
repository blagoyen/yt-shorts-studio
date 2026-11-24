use std::path::PathBuf;

use tauri::{AppHandle, Manager, State};

use crate::error::CmdResult;
use crate::models::{AppInfo, AppSettings, DependencyReport};
use crate::services::dependencies;
use crate::state::AppState;

#[tauri::command]
pub fn get_settings(state: State<'_, AppState>) -> AppSettings {
    state.settings()
}

#[tauri::command]
pub fn update_settings(
    app: AppHandle,
    state: State<'_, AppState>,
    settings: AppSettings,
) -> CmdResult<AppSettings> {
    state.set_settings(&app, settings)
}

fn default_folder(app: &AppHandle, name: &str) -> String {
    let base = app
        .path()
        .document_dir()
        .ok()
        .or_else(std::env::home_dir)
        .unwrap_or_else(|| PathBuf::from("."));
    base.join("YT Shorts Studio").join(name).to_string_lossy().into_owned()
}

#[tauri::command]
pub fn get_app_info(app: AppHandle, state: State<'_, AppState>) -> CmdResult<AppInfo> {
    let settings = state.settings();
    let config_dir = app
        .path()
        .app_config_dir()
        .map_err(|err| crate::error::CommandError::new("CONFIG_DIR", err.to_string()))?;
    let cache_dir = app
        .path()
        .app_cache_dir()
        .map_err(|err| crate::error::CommandError::new("CACHE_DIR", err.to_string()))?;
    Ok(AppInfo {
        version: env!("CARGO_PKG_VERSION").to_string(),
        config_dir: config_dir.to_string_lossy().into_owned(),
        cache_dir: cache_dir.to_string_lossy().into_owned(),
        default_project_folder: settings
            .default_project_folder
            .clone()
            .unwrap_or_else(|| default_folder(&app, "Projects")),
        default_export_folder: settings
            .default_export_folder
            .clone()
            .unwrap_or_else(|| default_folder(&app, "Exports")),
    })
}

#[tauri::command]
pub async fn check_dependencies(state: State<'_, AppState>) -> CmdResult<DependencyReport> {
    Ok(dependencies::report(&state.settings()).await)
}

#[tauri::command]
pub fn media_exists(paths: Vec<String>) -> Vec<bool> {
    paths
        .into_iter()
        .map(|path| PathBuf::from(path).is_file())
        .collect()
}

#[tauri::command]
pub fn list_media_in_folder(path: String) -> CmdResult<Vec<String>> {
    let root = PathBuf::from(&path);
    if !root.is_dir() {
        return Err(crate::error::CommandError::new(
            "FOLDER_NOT_FOUND",
            format!("Folder not found: {path}"),
        ));
    }
    const MEDIA_EXTENSIONS: &[&str] = &[
        "mp4", "mov", "mkv", "webm", "avi", "m4v", "png", "jpg", "jpeg", "webp", "gif",
        "mp3", "wav", "aac", "flac", "ogg", "m4a",
    ];
    let mut files = Vec::new();
    for entry in std::fs::read_dir(&root)? {
        let entry = entry?;
        let path = entry.path();
        if !path.is_file() {
            continue;
        }
        let extension = path
            .extension()
            .unwrap_or_default()
            .to_string_lossy()
            .to_lowercase();
        if MEDIA_EXTENSIONS.contains(&extension.as_str()) {
            files.push(path.to_string_lossy().into_owned());
        }
    }
    files.sort();
    Ok(files)
}

