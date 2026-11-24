use tauri::{AppHandle, Emitter, State};

use crate::error::CmdResult;
use crate::models::render::{RenderCompleteEvent, RenderProject};
use crate::services::render;
use crate::state::AppState;

#[tauri::command]
pub async fn start_render(
    app: AppHandle,
    state: State<'_, AppState>,
    render_id: String,
    project: RenderProject,
    output_path: String,
) -> CmdResult<String> {
    render::validate(&project, &state.settings())?;
    let id = if render_id.trim().is_empty() {
        uuid::Uuid::new_v4().to_string()
    } else {
        render_id
    };
    let owned_state = state.inner().clone();
    let owned_project = project;
    let owned_output = output_path;
    let spawned_id = id.clone();
    let emit_app = app.clone();
    tokio::spawn(async move {
        let render_id = spawned_id;
        let error_app = emit_app.clone();
        if let Err(error) = render::render(
            app,
            owned_state,
            render_id.clone(),
            owned_project,
            owned_output.clone(),
        )
        .await
        {
            let detail = error
                .detail
                .clone()
                .unwrap_or_else(|| error.message.clone());
            let _ = error_app.emit(
                "render-complete",
                RenderCompleteEvent {
                    render_id,
                    output_path: owned_output,
                    success: false,
                    cancelled: false,
                    error: Some(detail),
                },
            );
        }
    });
    Ok(id)
}

#[tauri::command]
pub async fn cancel_render(
    app: AppHandle,
    state: State<'_, AppState>,
    render_id: String,
) -> CmdResult<bool> {
    render::cancel(&app, state.inner().clone(), &render_id).await
}
