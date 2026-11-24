use serde_json::Value;
use tauri::AppHandle;

use crate::error::CmdResult;
use crate::models::ProjectSummary;
use crate::services::project;

#[tauri::command]
pub fn save_project(
    app: AppHandle,
    path: String,
    project: Value,
    summary: ProjectSummary,
) -> CmdResult<Vec<ProjectSummary>> {
    project::save_project(&path, &project)?;
    project::record_recent(&app, summary)
}

#[tauri::command]
pub fn load_project(path: String) -> CmdResult<Value> {
    project::load_project(&path)
}

#[tauri::command]
pub fn list_recent_projects(app: AppHandle) -> CmdResult<Vec<ProjectSummary>> {
    project::list_recent(&app)
}

#[tauri::command]
pub fn remove_recent_project(app: AppHandle, path: String) -> CmdResult<Vec<ProjectSummary>> {
    project::remove_recent(&app, &path)
}
