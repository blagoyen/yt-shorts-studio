use std::path::PathBuf;

use serde_json::Value;
use tauri::{AppHandle, Manager};

use crate::error::{CmdResult, CommandError};
use crate::models::ProjectSummary;

fn recent_file(app: &AppHandle) -> CmdResult<PathBuf> {
    let dir = app
        .path()
        .app_config_dir()
        .map_err(|err| CommandError::new("CONFIG_DIR", err.to_string()))?;
    std::fs::create_dir_all(&dir)?;
    Ok(dir.join("recent_projects.json"))
}

pub fn save_project(path: &str, project: &Value) -> CmdResult<()> {
    let target = PathBuf::from(path);
    if let Some(parent) = target.parent() {
        std::fs::create_dir_all(parent)?;
    }
    let content = serde_json::to_string_pretty(project)?;
    std::fs::write(&target, content)?;
    Ok(())
}

pub fn load_project(path: &str) -> CmdResult<Value> {
    let target = PathBuf::from(path);
    if !target.is_file() {
        return Err(CommandError::new("PROJECT_NOT_FOUND", format!("Project not found: {path}")));
    }
    let content = std::fs::read_to_string(&target)?;
    let value: Value = serde_json::from_str(&content).map_err(|err| {
        CommandError::new("INVALID_PROJECT", err.to_string())
    })?;
    if !value.is_object() {
        return Err(CommandError::new("INVALID_PROJECT", "The project file is not a JSON object."));
    }
    Ok(value)
}

pub fn list_recent(app: &AppHandle) -> CmdResult<Vec<ProjectSummary>> {
    let file = recent_file(app)?;
    if !file.is_file() {
        return Ok(Vec::new());
    }
    let content = std::fs::read_to_string(file)?;
    let entries: Vec<ProjectSummary> = serde_json::from_str(&content).unwrap_or_default();
    Ok(entries
        .into_iter()
        .filter(|entry| PathBuf::from(&entry.path).is_file())
        .collect())
}

pub fn record_recent(app: &AppHandle, summary: ProjectSummary) -> CmdResult<Vec<ProjectSummary>> {
    let file = recent_file(app)?;
    let mut entries = list_recent(app)?;
    entries.retain(|entry| entry.path != summary.path);
    entries.insert(0, summary);
    entries.truncate(12);
    entries.sort_by(|a, b| b.modified_at.cmp(&a.modified_at));
    std::fs::write(file, serde_json::to_string_pretty(&entries)?)?;
    Ok(entries)
}

pub fn remove_recent(app: &AppHandle, path: &str) -> CmdResult<Vec<ProjectSummary>> {
    let file = recent_file(app)?;
    let mut entries = list_recent(app)?;
    entries.retain(|entry| entry.path != path);
    std::fs::write(file, serde_json::to_string_pretty(&entries)?)?;
    Ok(entries)
}
