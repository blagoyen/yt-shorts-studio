use std::collections::{HashMap, HashSet};
use std::sync::{Arc, Mutex};

use tauri::{AppHandle, Manager};
use tokio::process::Child;
use tokio::sync::Mutex as AsyncMutex;

use crate::error::{CmdResult, CommandError};
use crate::models::AppSettings;
use crate::services::render::RenderHandle;

#[derive(Clone)]
pub struct AppState {
    pub settings: Arc<Mutex<AppSettings>>,
    pub renders: Arc<AsyncMutex<HashMap<String, RenderHandle>>>,
    pub cancelled: Arc<Mutex<HashSet<String>>>,
    pub transcriptions: Arc<AsyncMutex<HashMap<String, Arc<AsyncMutex<Child>>>>>,
    pub transcription_cancelled: Arc<Mutex<HashSet<String>>>,
}

fn settings_file(app: &AppHandle) -> CmdResult<std::path::PathBuf> {
    let dir = app
        .path()
        .app_config_dir()
        .map_err(|err| CommandError::new("CONFIG_DIR", err.to_string()))?;
    std::fs::create_dir_all(&dir)?;
    Ok(dir.join("settings.json"))
}

impl AppState {
    pub fn load(app: &AppHandle) -> Self {
        let settings = std::fs::read_to_string(settings_file(app).unwrap_or_default())
            .ok()
            .and_then(|text| serde_json::from_str::<AppSettings>(&text).ok())
            .unwrap_or_default();
        Self {
            settings: Arc::new(Mutex::new(settings)),
            renders: Arc::new(AsyncMutex::new(HashMap::new())),
            cancelled: Arc::new(Mutex::new(HashSet::new())),
            transcriptions: Arc::new(AsyncMutex::new(HashMap::new())),
            transcription_cancelled: Arc::new(Mutex::new(HashSet::new())),
        }
    }

    pub fn settings(&self) -> AppSettings {
        self.settings
            .lock()
            .map(|guard| guard.clone())
            .unwrap_or_default()
    }

    pub fn set_settings(&self, app: &AppHandle, settings: AppSettings) -> CmdResult<AppSettings> {
        let file = settings_file(app)?;
        std::fs::write(file, serde_json::to_string_pretty(&settings)?)?;
        let mut guard = self
            .settings
            .lock()
            .map_err(|_| CommandError::new("STATE_LOCK", "Settings are locked."))?;
        *guard = settings.clone();
        Ok(settings)
    }
}
