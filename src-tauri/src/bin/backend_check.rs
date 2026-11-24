use std::path::{Path, PathBuf};

use serde_json::json;
use yt_shorts_studio_lib::error::CmdResult;
use yt_shorts_studio_lib::models::AppSettings;
use yt_shorts_studio_lib::services::{dependencies, media, project};

fn unwrap<T>(result: CmdResult<T>) -> Result<T, String> {
    result.map_err(|error| {
        if let Some(detail) = error.detail {
            format!("{}: {} ({detail})", error.code, error.message)
        } else {
            format!("{}: {}", error.code, error.message)
        }
    })
}

#[tokio::main]
async fn main() {
    match run().await {
        Ok(checks) => println!("backend checks passed: {}", checks.join(", ")),
        Err(error) => {
            eprintln!("backend check failed: {error}");
            std::process::exit(1);
        }
    }
}

async fn run() -> Result<Vec<&'static str>, String> {
    let settings = AppSettings::default();
    let root = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .join("..")
        .join("target")
        .join("backend-check");
    std::fs::create_dir_all(&root).map_err(|error| error.to_string())?;

    let media_path = std::env::args().nth(1).unwrap_or_else(|| {
        r"C:\Users\blago\Desktop\apps\69827b0f56ada30c28322d6f.mp4".to_string()
    });
    if !Path::new(&media_path).is_file() {
        return Err(format!("media file not found: {media_path}"));
    }

    let deps = dependencies::report(&settings).await;
    if !deps.ffmpeg.ready || !deps.ffprobe.ready {
        return Err(format!(
            "FFmpeg/FFprobe unavailable: {} / {}",
            deps.ffmpeg.version.unwrap_or_default(),
            deps.ffprobe.version.unwrap_or_default()
        ));
    }
    if !deps.python_sidecar.ready {
        return Err(format!(
            "Faster-Whisper sidecar unavailable: {}",
            deps.python_sidecar.path.unwrap_or_default()
        ));
    }
    println!(
        "[dependencies] ffmpeg {} · ffprobe {} · whisper {}",
        deps.ffmpeg.version.unwrap_or_default(),
        deps.ffprobe.version.unwrap_or_default(),
        deps.python_sidecar.version.unwrap_or_default()
    );

    let mut tiny_settings = AppSettings::default();
    tiny_settings.whisper_model = "tiny".to_string();
    let tiny_model = dependencies::whisper_model(&tiny_settings);
    if !tiny_model.ready {
        return Err("cached tiny Whisper model was not detected".to_string());
    }
    println!("[model] selected tiny model detected");

    let metadata = unwrap(media::probe(&media_path, &settings).await)?;
    if metadata.duration_ms == 0 || metadata.width == 0 || metadata.height == 0 {
        return Err(format!("probe returned invalid metadata: {metadata:?}"));
    }
    println!(
        "[probe] {} · {} ms · {}x{} · audio={}",
        metadata.name, metadata.duration_ms, metadata.width, metadata.height, metadata.has_audio
    );

    let waveform = unwrap(media::waveform(&media_path, 256, &settings).await)?;
    if waveform.len() != 256 || waveform.iter().copied().fold(0.0_f32, f32::max) <= 0.0 {
        return Err("waveform does not contain 256 non-silent peaks".to_string());
    }
    println!("[waveform] {} bins", waveform.len());

    let thumbnail_path = unwrap(
        media::thumbnail(
            &root,
            &media_path,
            metadata.duration_ms / 2,
            &settings,
        )
        .await,
    )?;
    let thumbnail = Path::new(&thumbnail_path);
    if !thumbnail.is_file() || std::fs::metadata(thumbnail).map_err(|e| e.to_string())?.len() < 1000 {
        return Err("thumbnail was not generated correctly".to_string());
    }
    println!("[thumbnail] {} bytes", std::fs::metadata(thumbnail).map_err(|e| e.to_string())?.len());

    let value = json!({
        "version": 1,
        "name": "Backend Check",
        "media": [{
            "id": "media-check",
            "path": media_path,
            "kind": metadata.kind,
            "durationMs": metadata.duration_ms,
            "width": metadata.width,
            "height": metadata.height,
            "fps": metadata.fps,
            "hasAudio": metadata.has_audio,
            "codec": metadata.codec,
            "sizeBytes": metadata.size_bytes,
            "thumbnail": thumbnail_path,
            "waveform": waveform,
            "crop": {}
        }],
        "captions": [],
    });
    let project_path = root.join("roundtrip.shortproj");
    unwrap(project::save_project(
        &project_path.to_string_lossy(),
        &value,
    ))?;
    let loaded = unwrap(project::load_project(&project_path.to_string_lossy()))?;
    if loaded.get("name").and_then(|item| item.as_str()) != Some("Backend Check") {
        return Err("project round-trip returned the wrong project".to_string());
    }
    println!("[project] round-trip ok");

    Ok(vec![
        "dependencies",
        "probe",
        "waveform",
        "thumbnail",
        "project-roundtrip",
    ])
}
