pub mod render;
pub mod transcription;

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AppSettings {
    pub default_project_folder: Option<String>,
    pub default_export_folder: Option<String>,
    pub autosave_interval_seconds: u64,
    pub preview_quality: String,
    pub theme: String,
    pub ffmpeg_path: Option<String>,
    pub ffprobe_path: Option<String>,
    pub whisper_model: String,
    pub model_storage_dir: Option<String>,
    pub hardware_acceleration: String,
    pub yt_cutter_output_folder: Option<String>,
}

impl Default for AppSettings {
    fn default() -> Self {
        Self {
            default_project_folder: None,
            default_export_folder: None,
            autosave_interval_seconds: 30,
            preview_quality: "medium".to_string(),
            theme: "dark".to_string(),
            ffmpeg_path: None,
            ffprobe_path: None,
            whisper_model: "small".to_string(),
            model_storage_dir: None,
            hardware_acceleration: "auto".to_string(),
            yt_cutter_output_folder: None,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MediaMetadata {
    pub path: String,
    pub name: String,
    pub kind: String,
    pub duration_ms: u64,
    pub width: u32,
    pub height: u32,
    pub fps: f64,
    pub has_audio: bool,
    pub codec: Option<String>,
    pub size_bytes: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProjectSummary {
    pub path: String,
    pub name: String,
    pub modified_at: String,
    pub duration_ms: u64,
    pub media_count: u32,
    pub thumbnail_path: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DependencyInfo {
    pub name: String,
    pub found: bool,
    pub ready: bool,
    pub path: Option<String>,
    pub version: Option<String>,
    pub source: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DependencyReport {
    pub ffmpeg: DependencyInfo,
    pub ffprobe: DependencyInfo,
    pub python_sidecar: DependencyInfo,
    pub whisper_model: DependencyInfo,
    pub gpu_acceleration: DependencyInfo,
    pub ready: bool,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AppInfo {
    pub version: String,
    pub config_dir: String,
    pub cache_dir: String,
    pub default_project_folder: String,
    pub default_export_folder: String,
}
