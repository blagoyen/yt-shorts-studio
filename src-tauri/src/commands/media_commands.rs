use tauri::{AppHandle, Manager, State};

use crate::error::{CmdResult, CommandError};
use crate::models::MediaMetadata;
use crate::services::media;
use crate::state::AppState;

#[tauri::command]
pub async fn probe_media(
    path: String,
    state: State<'_, AppState>,
) -> CmdResult<MediaMetadata> {
    media::probe(&path, &state.settings()).await
}

#[tauri::command]
pub async fn generate_thumbnail(
    app: AppHandle,
    path: String,
    time_ms: u64,
    state: State<'_, AppState>,
) -> CmdResult<String> {
    let cache = app
        .path()
        .app_cache_dir()
        .map_err(|error| CommandError::new("CACHE_DIR", error.to_string()))?;
    media::thumbnail(&cache, &path, time_ms, &state.settings()).await
}

#[tauri::command]
pub async fn generate_waveform(
    path: String,
    bins: usize,
    state: State<'_, AppState>,
) -> CmdResult<Vec<f32>> {
    media::waveform(&path, bins, &state.settings()).await
}
