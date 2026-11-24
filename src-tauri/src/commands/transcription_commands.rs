use tauri::{AppHandle, Emitter, State};

use crate::error::CmdResult;
use crate::models::transcription::{
    ModelDownloadCompleteEvent, TranscriptionCompleteEvent, TranscriptionResult,
};
use crate::models::DependencyInfo;
use crate::services::{dependencies, transcription};
use crate::services::transcription::TranscriptionOutcome;
use crate::state::AppState;

#[tauri::command]
pub async fn transcribe_media(
    app: AppHandle,
    state: State<'_, AppState>,
    job_id: String,
    media_path: String,
    model: String,
    language: String,
    device: String,
) -> CmdResult<String> {
    let settings = state.settings();
    transcription::validate(&settings, &media_path)?;
    let id = if job_id.trim().is_empty() {
        uuid::Uuid::new_v4().to_string()
    } else {
        job_id
    };

    let owned_state = state.inner().clone();
    let emit_app = app.clone();
    let owned_job = id.clone();
    let owned_path = media_path;
    tokio::spawn(async move {
        match transcription::transcribe(
            &app,
            owned_state,
            &owned_job,
            &owned_path,
            &model,
            &language,
            &device,
        )
        .await
        {
            Ok(TranscriptionOutcome::Completed(result)) => {
                emit_complete(&emit_app, &owned_job, true, false, None, Some(result));
            }
            Ok(TranscriptionOutcome::Cancelled) => {
                emit_complete(&emit_app, &owned_job, false, true, None, None);
            }
            Err(error) => {
                let detail = error
                    .detail
                    .clone()
                    .unwrap_or_else(|| error.message.clone());
                emit_complete(&emit_app, &owned_job, false, false, Some(detail), None);
            }
        }
    });

    Ok(id)
}

#[tauri::command]
pub async fn download_whisper_model(
    app: AppHandle,
    state: State<'_, AppState>,
    model: String,
    model_dir: Option<String>,
) -> CmdResult<()> {
    let settings = state.settings();
    transcription::validate_sidecar(&settings)?;

    let emit_app = app.clone();
    let owned_model = model.clone();
    let owned_dir = model_dir.clone();
    tokio::spawn(async move {
        match transcription::download_model(
            emit_app.clone(),
            settings,
            &owned_model,
            owned_dir.as_deref(),
        )
        .await
        {
            Ok(()) => emit_download_complete(&emit_app, &owned_model, true, None),
            Err(error) => {
                let detail = error
                    .detail
                    .clone()
                    .unwrap_or_else(|| error.message.clone());
                emit_download_complete(&emit_app, &owned_model, false, Some(detail));
            }
        }
    });

    Ok(())
}

#[tauri::command]
pub fn check_whisper_model(
    state: State<'_, AppState>,
    model: String,
    model_dir: Option<String>,
) -> DependencyInfo {
    dependencies::whisper_model_at(&model, model_dir.as_deref(), &state.settings())
}

#[tauri::command]
pub async fn cancel_transcription(
    app: AppHandle,
    state: State<'_, AppState>,
    job_id: String,
) -> CmdResult<bool> {
    transcription::cancel(&app, state.inner().clone(), &job_id).await
}

fn emit_download_complete(app: &AppHandle, model: &str, success: bool, error: Option<String>) {
    let _ = app.emit(
        "model-download-complete",
        ModelDownloadCompleteEvent {
            model: model.to_string(),
            success,
            error,
        },
    );
}

fn emit_complete(
    app: &AppHandle,
    job_id: &str,
    success: bool,
    cancelled: bool,
    error: Option<String>,
    result: Option<TranscriptionResult>,
) {
    let _ = app.emit(
        "transcription-complete",
        TranscriptionCompleteEvent {
            job_id: job_id.to_string(),
            success,
            cancelled,
            error,
            result,
        },
    );
}

