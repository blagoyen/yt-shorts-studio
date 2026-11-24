use std::path::{Path, PathBuf};

use crate::error::CmdResult;
use crate::models::AppSettings;
use crate::services::process_manager::run_capture;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Tool {
    Ffmpeg,
    Ffprobe,
}

impl Tool {
    pub fn file_name(self) -> &'static str {
        match self {
            Tool::Ffmpeg => if cfg!(windows) { "ffmpeg.exe" } else { "ffmpeg" },
            Tool::Ffprobe => if cfg!(windows) { "ffprobe.exe" } else { "ffprobe" },
        }
    }

    pub fn label(self) -> &'static str {
        match self {
            Tool::Ffmpeg => "FFmpeg",
            Tool::Ffprobe => "FFprobe",
        }
    }

    fn configured(self, settings: &AppSettings) -> Option<&str> {
        match self {
            Tool::Ffmpeg => settings.ffmpeg_path.as_deref(),
            Tool::Ffprobe => settings.ffprobe_path.as_deref(),
        }
    }
}

fn resource_dirs() -> Vec<PathBuf> {
    let mut dirs = Vec::new();

    // Development: binaries live in <project>/resources/ffmpeg.
    let manifest = PathBuf::from(env!("CARGO_MANIFEST_DIR"));
    dirs.push(manifest.join("..").join("resources").join("ffmpeg"));

    // Packaged application: resources are copied next to the executable.
    if let Ok(exe) = std::env::current_exe() {
        if let Some(parent) = exe.parent() {
            dirs.push(parent.join("resources").join("ffmpeg"));
            dirs.push(parent.join("resources"));
            dirs.push(parent.to_path_buf());
        }
    }

    dirs
}

pub fn resolve(tool: Tool, settings: &AppSettings) -> Option<PathBuf> {
    if let Some(configured) = tool.configured(settings) {
        let candidate = PathBuf::from(configured);
        if candidate.is_file() {
            return Some(candidate);
        }
    }

    // FFprobe commonly sits beside a manually configured FFmpeg.
    if tool == Tool::Ffprobe {
        if let Some(ffmpeg) = settings.ffmpeg_path.as_deref() {
            if let Some(parent) = Path::new(ffmpeg).parent() {
                let sibling = parent.join(Tool::Ffprobe.file_name());
                if sibling.is_file() {
                    return Some(sibling);
                }
            }
        }
    }

    let name = tool.file_name();
    for dir in resource_dirs() {
        let candidate = dir.join(name);
        if candidate.is_file() {
            return Some(candidate);
        }
    }

    if let Some(path) = std::env::var_os("PATH") {
        for dir in std::env::split_paths(&path) {
            let candidate = dir.join(name);
            if candidate.is_file() {
                return Some(candidate);
            }
        }
    }

    None
}

pub fn source_of(path: &Path, settings: &AppSettings) -> String {
    if let Some(configured) = Tool::Ffmpeg.configured(settings) {
        if Path::new(configured) == path {
            return "custom".to_string();
        }
    }
    if let Some(configured) = Tool::Ffprobe.configured(settings) {
        if Path::new(configured) == path {
            return "custom".to_string();
        }
    }
    if resource_dirs().iter().any(|dir| path.starts_with(dir)) {
        return "bundled".to_string();
    }
    "system".to_string()
}

pub async fn version(_tool: Tool, path: &Path) -> CmdResult<Option<String>> {
    let args = vec!["-version".to_string()];
    let output = run_capture(path, &args, std::time::Duration::from_secs(10)).await?;
    if !output.success {
        return Err(crate::error::CommandError::new(
            "BINARY_NOT_EXECUTABLE",
            output.stderr.trim().to_string(),
        ));
    }
    let first = output
        .stdout
        .lines()
        .find(|line| !line.trim().is_empty())
        .unwrap_or("")
        .trim();
    let version = first.split_whitespace().nth(2).unwrap_or(first).to_string();
    Ok(if version.is_empty() { None } else { Some(version) })
}
