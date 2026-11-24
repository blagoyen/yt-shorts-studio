use std::path::{Path, PathBuf};

use crate::models::{AppSettings, DependencyInfo, DependencyReport};
use crate::services::binaries::{self, Tool};

fn missing(name: &str) -> DependencyInfo {
    DependencyInfo {
        name: name.to_string(),
        found: false,
        ready: false,
        path: None,
        version: None,
        source: "missing".to_string(),
    }
}

async fn tool_info(tool: Tool, settings: &AppSettings) -> DependencyInfo {
    let Some(path) = binaries::resolve(tool, settings) else {
        return missing(tool.label());
    };
    let (version, ready) = match binaries::version(tool, &path).await {
        Ok(version) => (version, true),
        Err(_) => (None, false),
    };
    DependencyInfo {
        name: tool.label().to_string(),
        found: true,
        ready,
        path: Some(path.to_string_lossy().into_owned()),
        version,
        source: binaries::source_of(&path, settings),
    }
}

fn find_in_path(file_name: &str) -> Option<PathBuf> {
    let path = std::env::var_os("PATH")?;
    for dir in std::env::split_paths(&path) {
        let candidate = dir.join(file_name);
        if candidate.is_file() {
            return Some(candidate);
        }
    }
    None
}

pub fn normalize_path(path: PathBuf) -> PathBuf {
    #[cfg(windows)]
    {
        let text = path.to_string_lossy();
        if let Some(rest) = text.strip_prefix(r"\\?\UNC\") {
            return PathBuf::from(format!(r"\\{rest}"));
        }
        if let Some(rest) = text.strip_prefix(r"\\?\") {
            return PathBuf::from(rest);
        }
    }
    path
}

pub fn project_root() -> PathBuf {
    let root = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("..");
    normalize_path(
        root.canonicalize()
            .unwrap_or_else(|_| PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("..")),
    )
}

pub fn resolve_python() -> Option<PathBuf> {
    let mut candidates = Vec::new();
    candidates.push(
        project_root()
            .join("transcription-engine")
            .join(".venv")
            .join("Scripts")
            .join("python.exe"),
    );
    candidates.push(
        project_root()
            .join("transcription-engine")
            .join(".venv")
            .join("bin")
            .join("python"),
    );
    if let Ok(exe) = std::env::current_exe() {
        if let Some(parent) = exe.parent() {
            candidates.push(
                parent
                    .join("resources")
                    .join("whisper")
                    .join("python.exe"),
            );
            candidates.push(parent.join("resources").join("whisper").join("python"));
        }
    }
    candidates
        .into_iter()
        .find(|path| path.is_file())
        .or_else(|| find_in_path("python.exe"))
        .or_else(|| find_in_path("python3.exe"))
        .or_else(|| find_in_path("python3"))
        .or_else(|| find_in_path("python"))
}

pub fn resolve_transcribe_script() -> Option<PathBuf> {
    let candidates = [
        project_root()
            .join("transcription-engine")
            .join("transcribe.py"),
        project_root().join("resources").join("whisper").join("transcribe.py"),
    ];
    candidates
        .into_iter()
        .find(|path| path.is_file())
        .or_else(|| {
            std::env::current_exe().ok().and_then(|exe| {
                exe.parent().map(|parent| {
                    parent
                        .join("resources")
                        .join("whisper")
                        .join("transcribe.py")
                })
            })
        })
        .filter(|path| path.is_file())
}

pub fn model_dir(settings: &AppSettings) -> PathBuf {
    if let Some(configured) = settings.model_storage_dir.as_ref() {
        return normalize_path(PathBuf::from(configured));
    }

    // Bundled builds keep models beside the executable. Local `cargo run` and
    // `tauri dev` binaries also get copied resources, but should reuse the
    // repository's model cache instead of an empty resources folder.
    if let Ok(exe) = std::env::current_exe() {
        if let Some(parent) = exe.parent() {
            if parent.join("resources").join("ffmpeg").is_dir() {
                let local_models = project_root().join("resources").join("models");
                let exe_text = exe.to_string_lossy();
                let is_local_target =
                    exe_text.contains("src-tauri\\target") || exe_text.contains("src-tauri/target");
                if is_local_target && local_models.is_dir() {
                    return local_models;
                }
                return parent.join("resources").join("models");
            }
        }
    }
    project_root().join("resources").join("models")
}

fn find_model_file(dir: &Path, depth: usize) -> Option<PathBuf> {
    let entries = std::fs::read_dir(dir).ok()?;
    for entry in entries.flatten() {
        let path = entry.path();
        if path.is_dir() {
            if depth > 0 {
                if let Some(found) = find_model_file(&path, depth - 1) {
                    return Some(found);
                }
            }
        } else {
            let name = path.file_name()?.to_string_lossy().to_lowercase();
            if name == "model.bin" || name.ends_with(".bin") {
                return Some(path);
            }
        }
    }
    None
}

fn find_selected_model(dir: &Path, model: &str) -> Option<PathBuf> {
    let local = Path::new(model);
    if local.is_dir() {
        if let Some(found) = find_model_file(local, 6) {
            return Some(found);
        }
    }

    let needle = model.trim().replace(['/', '\\'], "--");
    if needle.is_empty() {
        return None;
    }
    let entries = std::fs::read_dir(dir).ok()?;
    for entry in entries.flatten() {
        let path = entry.path();
        if !path.is_dir() {
            continue;
        }
        let name = entry.file_name().to_string_lossy().to_lowercase();
        if name.contains(&needle.to_lowercase()) {
            if let Some(found) = find_model_file(&path, 6) {
                return Some(found);
            }
        }
    }
    None
}

pub fn whisper_model_in(dir: &Path, model: &str) -> DependencyInfo {
    let found = find_selected_model(dir, model);
    DependencyInfo {
        name: "Whisper Model".to_string(),
        found: found.is_some(),
        ready: found.is_some(),
        path: found.as_ref().map(|path| path.to_string_lossy().into_owned()),
        version: Some(model.to_string()),
        source: if found.is_some() {
            "local".to_string()
        } else {
            "missing".to_string()
        },
    }
}

pub fn whisper_model(settings: &AppSettings) -> DependencyInfo {
    whisper_model_in(&model_dir(settings), &settings.whisper_model)
}

pub fn whisper_model_at(model: &str, model_dir: Option<&str>, settings: &AppSettings) -> DependencyInfo {
    let directory = model_dir
        .map(PathBuf::from)
        .filter(|path| !path.as_os_str().is_empty())
        .map(normalize_path)
        .unwrap_or_else(|| self::model_dir(settings));
    whisper_model_in(&directory, model)
}

async fn faster_whisper_version(python: &Path) -> Option<String> {
    let mut command = tokio::process::Command::new(python);
    command.args([
        "-c",
        "import importlib.metadata as m; print(m.version('faster-whisper'))",
    ]);
    #[cfg(windows)]
    command.creation_flags(0x08000000);
    let output = command.output().await.ok()?;
    if !output.status.success() {
        return None;
    }
    let version = String::from_utf8_lossy(&output.stdout).trim().to_string();
    if version.is_empty() {
        None
    } else {
        Some(version)
    }
}

pub async fn python_sidecar() -> DependencyInfo {
    let found = resolve_python();
    let script = resolve_transcribe_script();
    let version = match found.as_ref() {
        Some(python) => faster_whisper_version(python).await,
        None => None,
    };
    let ready = found.is_some() && script.is_some() && version.is_some();
    DependencyInfo {
        name: "Python Sidecar".to_string(),
        found: found.is_some(),
        ready,
        path: found.as_ref().map(|path| path.to_string_lossy().into_owned()),
        version: version.or_else(|| script.map(|_| "Faster-Whisper".to_string())),
        source: if ready {
            "local".to_string()
        } else {
            "missing".to_string()
        },
    }
}

fn gpu_acceleration() -> DependencyInfo {
    let path = find_in_path("nvidia-smi.exe")
        .or_else(|| find_in_path("nvidia-smi"))
        .or_else(|| {
            let candidate = Path::new("C:\\Windows\\System32\\nvidia-smi.exe");
            candidate.is_file().then(|| candidate.to_path_buf())
        });

    DependencyInfo {
        name: "GPU Acceleration".to_string(),
        found: path.is_some(),
        ready: path.is_some(),
        path: path.as_ref().map(|path| path.to_string_lossy().into_owned()),
        version: None,
        source: if path.is_some() {
            "system".to_string()
        } else {
            "unavailable".to_string()
        },
    }
}

pub async fn report(settings: &AppSettings) -> DependencyReport {
    let (ffmpeg, ffprobe) = tokio::join!(
        tool_info(Tool::Ffmpeg, settings),
        tool_info(Tool::Ffprobe, settings)
    );
    let python_sidecar = python_sidecar().await;
    let whisper_model = whisper_model(settings);
    let gpu_acceleration = gpu_acceleration();

    DependencyReport {
        ready: ffmpeg.ready && ffprobe.ready,
        ffmpeg,
        ffprobe,
        python_sidecar,
        whisper_model,
        gpu_acceleration,
    }
}
