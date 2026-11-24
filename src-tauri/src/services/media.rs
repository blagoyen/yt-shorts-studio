use std::path::{Path, PathBuf};

use serde_json::Value;
use tokio::process::Command;

use crate::error::{CmdResult, CommandError};
use crate::models::{AppSettings, MediaMetadata};
use crate::services::binaries::{self, Tool};

fn extension(path: &Path) -> String {
    path.extension()
        .unwrap_or_default()
        .to_string_lossy()
        .to_lowercase()
}

fn media_kind(path: &Path) -> &'static str {
    match extension(path).as_str() {
        "png" | "jpg" | "jpeg" | "webp" | "gif" | "bmp" => "image",
        "mp3" | "wav" | "aac" | "flac" | "ogg" | "opus" | "m4a" | "wma" => "audio",
        _ => "video",
    }
}

fn parse_fps(value: Option<&str>) -> f64 {
    let Some(value) = value else { return 0.0 };
    if let Some((num, den)) = value.split_once('/') {
        let num: f64 = num.trim().parse().unwrap_or(0.0);
        let den: f64 = den.trim().parse().unwrap_or(1.0);
        if den > 0.0 && num > 0.0 { num / den } else { 0.0 }
    } else {
        value.parse().unwrap_or(0.0)
    }
}

fn number(value: Option<&Value>) -> f64 {
    value
        .and_then(Value::as_str)
        .and_then(|text| text.parse::<f64>().ok())
        .or_else(|| value.and_then(Value::as_f64))
        .unwrap_or(0.0)
}

pub async fn probe(path: &str, settings: &AppSettings) -> CmdResult<MediaMetadata> {
    let file = PathBuf::from(path);
    if !file.is_file() {
        return Err(CommandError::new("FILE_NOT_FOUND", format!("File not found: {path}")));
    }

    let ffprobe = binaries::resolve(Tool::Ffprobe, settings).ok_or_else(|| {
        CommandError::new("FFPROBE_MISSING", "FFprobe was not found. Check Settings → Dependencies.")
    })?;

    let args = vec![
        "-v".to_string(),
        "error".to_string(),
        "-print_format".to_string(),
        "json".to_string(),
        "-show_format".to_string(),
        "-show_streams".to_string(),
        path.to_string(),
    ];
    let output = Command::new(&ffprobe).args(&args).output().await.map_err(|err| {
        CommandError::new("PROBE_FAILED", err.to_string())
    })?;
    if !output.status.success() {
        return Err(CommandError::new(
            "PROBE_FAILED",
            String::from_utf8_lossy(&output.stderr).trim().to_string(),
        ));
    }

    let json: Value = serde_json::from_slice(&output.stdout).map_err(CommandError::from)?;
    let streams = json.get("streams").and_then(Value::as_array);
    let video_stream = streams.and_then(|items| {
        items
            .iter()
            .find(|stream| stream.get("codec_type").and_then(Value::as_str) == Some("video"))
    });
    let has_audio = streams
        .map(|items| {
            items
                .iter()
                .any(|stream| stream.get("codec_type").and_then(Value::as_str) == Some("audio"))
        })
        .unwrap_or(false);

    let duration_seconds = number(json.get("format").and_then(|f| f.get("duration")));
    let stream_duration = video_stream
        .and_then(|stream| stream.get("duration"))
        .and_then(Value::as_str)
        .and_then(|text| text.parse::<f64>().ok())
        .unwrap_or(0.0);
    let duration_seconds = if duration_seconds > 0.0 {
        duration_seconds
    } else {
        stream_duration
    };

    let name = file
        .file_name()
        .unwrap_or_default()
        .to_string_lossy()
        .into_owned();
    let size_bytes = std::fs::metadata(&file).map(|m| m.len()).unwrap_or(0);

    Ok(MediaMetadata {
        path: path.to_string(),
        name,
        kind: media_kind(&file).to_string(),
        duration_ms: (duration_seconds * 1000.0).round() as u64,
        width: video_stream
            .and_then(|stream| stream.get("width"))
            .and_then(Value::as_u64)
            .unwrap_or(0) as u32,
        height: video_stream
            .and_then(|stream| stream.get("height"))
            .and_then(Value::as_u64)
            .unwrap_or(0) as u32,
        fps: parse_fps(video_stream.and_then(|s| s.get("r_frame_rate")).and_then(Value::as_str)),
        has_audio,
        codec: video_stream
            .and_then(|stream| stream.get("codec_name"))
            .and_then(Value::as_str)
            .map(str::to_string),
        size_bytes,
    })
}

fn stable_hash(text: &str) -> String {
    let mut hash: u64 = 0xcbf29ce484222325;
    for byte in text.as_bytes() {
        hash ^= *byte as u64;
        hash = hash.wrapping_mul(0x100000001b3);
    }
    format!("{hash:016x}")
}

pub async fn thumbnail(
    cache_root: &Path,
    path: &str,
    time_ms: u64,
    settings: &AppSettings,
) -> CmdResult<String> {
    let ffmpeg = binaries::resolve(Tool::Ffmpeg, settings).ok_or_else(|| {
        CommandError::new("FFMPEG_MISSING", "FFmpeg was not found. Check Settings → Dependencies.")
    })?;
    let cache = cache_root.join("thumbnails");
    std::fs::create_dir_all(&cache)?;
    let output = cache.join(format!("{}.jpg", stable_hash(&format!("{path}:{time_ms}"))));
    if output.is_file() {
        return Ok(output.to_string_lossy().into_owned());
    }

    let seconds = time_ms as f64 / 1000.0;
    let args = vec![
        "-y".to_string(),
        "-v".to_string(),
        "error".to_string(),
        "-ss".to_string(),
        seconds.to_string(),
        "-i".to_string(),
        path.to_string(),
        "-frames:v".to_string(),
        "1".to_string(),
        "-vf".to_string(),
        "scale=360:-2".to_string(),
        "-q:v".to_string(),
        "4".to_string(),
        output.to_string_lossy().into_owned(),
    ];
    let result = Command::new(&ffmpeg).args(&args).output().await.map_err(|err| {
        CommandError::new("THUMBNAIL_FAILED", err.to_string())
    })?;
    if !result.status.success() {
        return Err(CommandError::new(
            "THUMBNAIL_FAILED",
            String::from_utf8_lossy(&result.stderr).trim().to_string(),
        ));
    }
    Ok(output.to_string_lossy().into_owned())
}

/// Peak waveform data derived from the real audio stream.
pub async fn waveform(
    path: &str,
    bins: usize,
    settings: &AppSettings,
) -> CmdResult<Vec<f32>> {
    let bins = bins.clamp(32, 4096);
    let ffmpeg = binaries::resolve(Tool::Ffmpeg, settings).ok_or_else(|| {
        CommandError::new("FFMPEG_MISSING", "FFmpeg was not found. Check Settings → Dependencies.")
    })?;
    let args = vec![
        "-v".to_string(),
        "error".to_string(),
        "-i".to_string(),
        path.to_string(),
        "-vn".to_string(),
        "-ac".to_string(),
        "1".to_string(),
        "-ar".to_string(),
        "2000".to_string(),
        "-f".to_string(),
        "f32le".to_string(),
        "pipe:1".to_string(),
    ];
    let result = Command::new(&ffmpeg).args(&args).output().await.map_err(|err| {
        CommandError::new("WAVEFORM_FAILED", err.to_string())
    })?;
    if !result.status.success() {
        return Err(CommandError::new(
            "WAVEFORM_FAILED",
            String::from_utf8_lossy(&result.stderr).trim().to_string(),
        ));
    }

    let bytes = &result.stdout;
    let samples: Vec<f32> = bytes
        .chunks_exact(4)
        .map(|chunk| f32::from_le_bytes([chunk[0], chunk[1], chunk[2], chunk[3]]))
        .collect();
    if samples.is_empty() {
        return Err(CommandError::new("WAVEFORM_EMPTY", "This file has no audio stream."));
    }

    let mut peaks = vec![0.0_f32; bins];
    let step = samples.len() as f64 / bins as f64;
    for index in 0..bins {
        let start = (index as f64 * step) as usize;
        let end = (((index + 1) as f64 * step) as usize).min(samples.len());
        let mut peak = 0.0_f32;
        for sample in &samples[start..end.max(start + 1).min(samples.len())] {
            peak = peak.max(sample.abs());
        }
        peaks[index] = peak;
    }
    let max = peaks.iter().copied().fold(0.0_f32, f32::max);
    if max > 0.0 {
        for peak in &mut peaks {
            *peak /= max;
        }
    }
    Ok(peaks)
}
