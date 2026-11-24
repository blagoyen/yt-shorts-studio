use std::path::PathBuf;
use std::process::Stdio;
use std::sync::Arc;

use tauri::{AppHandle, Emitter};
use tokio::io::{AsyncBufReadExt, AsyncReadExt, BufReader};
use tokio::process::Command;
use tokio::sync::Mutex;

use crate::error::{CmdResult, CommandError};
use crate::models::transcription::{
    ModelDownloadProgressEvent, TranscriptionProgressEvent, TranscriptionResult,
};
use crate::models::AppSettings;
use crate::services::dependencies;
use crate::state::AppState;

pub enum TranscriptionOutcome {
    Completed(TranscriptionResult),
    Cancelled,
}

pub fn validate_sidecar(_settings: &AppSettings) -> CmdResult<()> {
    if dependencies::resolve_python().is_none() {
        return Err(CommandError::new(
            "PYTHON_MISSING",
            "The local Python sidecar is missing. Run transcription-engine/setup.ps1 in Settings.",
        ));
    }
    if dependencies::resolve_transcribe_script().is_none() {
        return Err(CommandError::new(
            "SIDECAR_MISSING",
            "transcribe.py could not be found next to the application.",
        ));
    }
    Ok(())
}

pub fn validate(settings: &AppSettings, media_path: &str) -> CmdResult<()> {
    validate_sidecar(settings)?;
    if !PathBuf::from(media_path).is_file() {
        return Err(CommandError::new(
            "MEDIA_MISSING",
            "The selected media file could not be found.",
        ));
    }
    Ok(())
}

fn detail_from_stderr(stderr: &str) -> String {
    if let Some(start) = stderr.rfind('{') {
        if let Ok(value) = serde_json::from_str::<serde_json::Value>(&stderr[start..]) {
            if let Some(detail) = value.get("detail").and_then(|item| item.as_str()) {
                return detail.to_string();
            }
            if let Some(error) = value.get("error").and_then(|item| item.as_str()) {
                return error.to_string();
            }
        }
    }
    let useful = stderr
        .lines()
        .filter(|line| !line.starts_with("PROGRESS "))
        .map(str::trim)
        .filter(|line| !line.is_empty())
        .collect::<Vec<_>>();
    useful.last().copied().unwrap_or("Transcription failed.").to_string()
}

fn parse_progress(line: &str) -> Option<(f64, String)> {
    let value = line.trim().strip_prefix("PROGRESS ")?;
    let mut parts = value.split_whitespace();
    let progress = parts.next()?.parse::<f64>().ok()?;
    let stage = parts.collect::<Vec<_>>().join(" ");
    Some((progress.clamp(0.0, 1.0), stage))
}

pub async fn transcribe(
    app: &AppHandle,
    state: AppState,
    job_id: &str,
    media_path: &str,
    model: &str,
    language: &str,
    device: &str,
) -> CmdResult<TranscriptionOutcome> {
    let python = dependencies::resolve_python().ok_or_else(|| {
        CommandError::new("PYTHON_MISSING", "The local Python sidecar is missing.")
    })?;
    let script = dependencies::resolve_transcribe_script().ok_or_else(|| {
        CommandError::new("SIDECAR_MISSING", "transcribe.py could not be found.")
    })?;
    let model_dir = dependencies::model_dir(&state.settings());
    std::fs::create_dir_all(&model_dir)?;

    let mut command = Command::new(&python);
    command
        .arg("-u")
        .arg(&script)
        .arg("--audio")
        .arg(media_path)
        .arg("--model")
        .arg(model)
        .arg("--model-dir")
        .arg(model_dir.to_string_lossy().as_ref())
        .arg("--language")
        .arg(language)
        .arg("--device")
        .arg(if device.is_empty() { "cpu" } else { device })
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());
    #[cfg(windows)]
    command.creation_flags(0x08000000);

    let mut child = command.spawn().map_err(|error| {
        CommandError::new("SIDECAR_START_FAILED", error.to_string())
    })?;
    let mut stdout = child.stdout.take().ok_or_else(|| {
        CommandError::new("SIDECAR_PIPE", "Could not read sidecar output.")
    })?;
    let mut stderr = child.stderr.take().ok_or_else(|| {
        CommandError::new("SIDECAR_PIPE", "Could not read sidecar progress.")
    })?;

    let stdout_task = tokio::spawn(async move {
        let mut buffer = Vec::new();
        let _ = stdout.read_to_end(&mut buffer).await;
        buffer
    });

    let child = Arc::new(Mutex::new(child));
    state
        .transcriptions
        .lock()
        .await
        .insert(job_id.to_string(), child.clone());
    let _ = app.emit(
        "transcription-progress",
        TranscriptionProgressEvent {
            job_id: job_id.to_string(),
            progress: 0.0,
            stage: "Starting".to_string(),
        },
    );

    let mut reader = BufReader::new(&mut stderr);
    let mut line = String::new();
    let mut stderr_tail = String::new();
    let mut reported = -1_i32;
    loop {
        line.clear();
        let bytes = reader.read_line(&mut line).await.map_err(|error| {
            CommandError::new("SIDECAR_READ", error.to_string())
        })?;
        if bytes == 0 {
            break;
        }
        let trimmed = line.trim();
        if let Some((progress, sidecar_stage)) = parse_progress(trimmed) {
            let percent = (progress * 100.0).round() as i32;
            if percent != reported {
                reported = percent;
                let stage = if sidecar_stage.is_empty() {
                    if progress < 0.12 {
                        "Loading model".to_string()
                    } else {
                        "Transcribing".to_string()
                    }
                } else {
                    sidecar_stage
                };
                let _ = app.emit(
                    "transcription-progress",
                    TranscriptionProgressEvent {
                        job_id: job_id.to_string(),
                        progress,
                        stage,
                    },
                );
            }
        } else {
            stderr_tail.push_str(trimmed);
            stderr_tail.push('\n');
            if stderr_tail.len() > 16_000 {
                stderr_tail = stderr_tail.split_off(stderr_tail.len() - 8_000);
            }
        }
    }

    let mut handle = child.lock().await;
    let status = handle.wait().await.map_err(|error| {
        CommandError::new("SIDECAR_WAIT", error.to_string())
    })?;
    drop(handle);
    state.transcriptions.lock().await.remove(job_id);
    let cancelled = state
        .transcription_cancelled
        .lock()
        .map(|mut set| set.remove(job_id))
        .unwrap_or(false);

    if cancelled {
        return Ok(TranscriptionOutcome::Cancelled);
    }

    if !status.success() {
        let detail = detail_from_stderr(&stderr_tail);
        return Err(
            CommandError::new("TRANSCRIBE_FAILED", "Faster-Whisper could not transcribe this file.")
                .with_detail(detail),
        );
    }

    let bytes = stdout_task.await.unwrap_or_default();
    let result = serde_json::from_slice::<TranscriptionResult>(&bytes).map_err(|error| {
        CommandError::new("TRANSCRIBE_PARSE", format!("Sidecar returned invalid JSON: {error}"))
    })?;

    Ok(TranscriptionOutcome::Completed(result))
}

pub async fn download_model(
    app: AppHandle,
    settings: AppSettings,
    model: &str,
    model_dir: Option<&str>,
) -> CmdResult<()> {
    validate_sidecar(&settings)?;

    let python = dependencies::resolve_python().ok_or_else(|| {
        CommandError::new("PYTHON_MISSING", "The local Python sidecar is missing.")
    })?;
    let script = dependencies::resolve_transcribe_script().ok_or_else(|| {
        CommandError::new("SIDECAR_MISSING", "transcribe.py could not be found.")
    })?;
    let directory = model_dir
        .map(PathBuf::from)
        .filter(|path| !path.as_os_str().is_empty())
        .map(dependencies::normalize_path)
        .unwrap_or_else(|| dependencies::model_dir(&settings));
    std::fs::create_dir_all(&directory)?;

    let mut command = Command::new(&python);
    command
        .arg("-u")
        .arg(&script)
        .arg("--download-only")
        .arg("--model")
        .arg(model)
        .arg("--model-dir")
        .arg(directory.to_string_lossy().as_ref())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());
    #[cfg(windows)]
    command.creation_flags(0x08000000);

    let mut child = command.spawn().map_err(|error| {
        CommandError::new("SIDECAR_START_FAILED", error.to_string())
    })?;
    let mut stdout = child.stdout.take().ok_or_else(|| {
        CommandError::new("SIDECAR_PIPE", "Could not read sidecar output.")
    })?;
    let mut stderr = child.stderr.take().ok_or_else(|| {
        CommandError::new("SIDECAR_PIPE", "Could not read sidecar progress.")
    })?;
    let stdout_task = tokio::spawn(async move {
        let mut buffer = Vec::new();
        let _ = stdout.read_to_end(&mut buffer).await;
        buffer
    });

    let emit_progress = |progress: f64, stage: &str| {
        let _ = app.emit(
            "model-download-progress",
            ModelDownloadProgressEvent {
                model: model.to_string(),
                progress,
                stage: stage.to_string(),
            },
        );
    };
    emit_progress(0.0, "Preparing");

    let mut reader = BufReader::new(&mut stderr);
    let mut line = String::new();
    let mut stderr_tail = String::new();
    let mut reported = -1_i32;
    loop {
        line.clear();
        let bytes = reader.read_line(&mut line).await.map_err(|error| {
            CommandError::new("SIDECAR_READ", error.to_string())
        })?;
        if bytes == 0 {
            break;
        }
        let trimmed = line.trim();
        if let Some((progress, sidecar_stage)) = parse_progress(trimmed) {
            let percent = (progress * 100.0).round() as i32;
            if percent != reported {
                reported = percent;
                emit_progress(
                    progress,
                    if sidecar_stage.is_empty() {
                        "Downloading model"
                    } else {
                        &sidecar_stage
                    },
                );
            }
        } else {
            stderr_tail.push_str(trimmed);
            stderr_tail.push('\n');
            if stderr_tail.len() > 16_000 {
                stderr_tail = stderr_tail.split_off(stderr_tail.len() - 8_000);
            }
        }
    }

    let status = child.wait().await.map_err(|error| {
        CommandError::new("SIDECAR_WAIT", error.to_string())
    })?;
    let _ = stdout_task.await;

    if !status.success() {
        let detail = detail_from_stderr(&stderr_tail);
        return Err(
            CommandError::new("MODEL_DOWNLOAD_FAILED", "Could not download the Whisper model.")
                .with_detail(detail),
        );
    }

    emit_progress(1.0, "Download complete");
    Ok(())
}

pub async fn cancel(app: &AppHandle, state: AppState, job_id: &str) -> CmdResult<bool> {
    if let Ok(mut set) = state.transcription_cancelled.lock() {
        set.insert(job_id.to_string());
    }
    let handle = state.transcriptions.lock().await.remove(job_id);
    if let Some(handle) = handle {
        let mut child = handle.lock().await;
        let _ = child.start_kill();
    }
    let _ = app.emit(
        "transcription-progress",
        TranscriptionProgressEvent {
            job_id: job_id.to_string(),
            progress: 0.0,
            stage: "Cancelling".to_string(),
        },
    );
    Ok(true)
}
