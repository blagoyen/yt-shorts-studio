#![recursion_limit = "256"]

use std::path::{Path, PathBuf};
use std::process::{Command, Output};

use serde_json::json;
use yt_shorts_studio_lib::models::render::RenderProject;
use yt_shorts_studio_lib::services::render::build_args;

fn bundled_tool(name: &str) -> PathBuf {
    Path::new(env!("CARGO_MANIFEST_DIR"))
        .join("..")
        .join("resources")
        .join("ffmpeg")
        .join(name)
}

fn main() {
    match run() {
        Ok(names) => println!("render checks passed: {}", names.join(", ")),
        Err(error) => {
            eprintln!("render check failed: {error}");
            std::process::exit(1);
        }
    }
}

fn command_output(program: &Path, args: &[&str]) -> Result<Output, String> {
    Command::new(program)
        .args(args)
        .output()
        .map_err(|error| error.to_string())
}

fn run() -> Result<Vec<&'static str>, String> {
    let ffmpeg = bundled_tool("ffmpeg.exe");
    let ffprobe = bundled_tool("ffprobe.exe");
    let root = Path::new(env!("CARGO_MANIFEST_DIR"))
        .join("..")
        .join("target")
        .join("render-check");
    let cache = root.join("cache");
    std::fs::create_dir_all(&cache).map_err(|e| e.to_string())?;
    let source = root.join("source.mp4");
    let image = root.join("sticker.png");
    let source_path = source.to_string_lossy().into_owned();
    let image_path = image.to_string_lossy().into_owned();

    let made = command_output(
        &ffmpeg,
        &[
            "-y",
            "-hide_banner",
            "-loglevel",
            "error",
            "-f",
            "lavfi",
            "-i",
            "color=c=blue:s=640x360:r=30:d=1",
            "-f",
            "lavfi",
            "-i",
            "sine=frequency=440:duration=1",
            "-c:v",
            "libx264",
            "-preset",
            "ultrafast",
            "-c:a",
            "aac",
            "-shortest",
            &source_path,
        ],
    )?;
    if !made.status.success() {
        return Err(format!(
            "source creation failed: {}",
            String::from_utf8_lossy(&made.stderr)
        ));
    }
    let sticker = command_output(
        &ffmpeg,
        &[
            "-y",
            "-hide_banner",
            "-loglevel",
            "error",
            "-f",
            "lavfi",
            "-i",
            "color=c=red:s=200x200:d=1",
            "-frames:v",
            "1",
            &image_path,
        ],
    )?;
    if !sticker.status.success() {
        return Err(format!(
            "sticker creation failed: {}",
            String::from_utf8_lossy(&sticker.stderr)
        ));
    }

    let basic = json!({
        "canvas": { "width": 1080, "height": 1920, "fps": 30 },
        "media": [{
            "id": "media-1",
            "path": source_path,
            "kind": "video",
            "durationMs": 1000,
            "width": 640,
            "height": 360,
            "hasAudio": true,
            "crop": { "gameplay": { "x": 0, "y": 0, "w": 1, "h": 1 }, "facecam": null }
        }],
        "tracks": {
            "video": [{
                "id": "item-1",
                "mediaId": "media-1",
                "label": "clip",
                "startMs": 0,
                "durationMs": 1000,
                "inMs": 0,
                "speed": 1,
                "volume": 1
            }],
            "overlays": [],
            "music": [],
            "sfx": [],
            "effects": []
        },
        "layout": {
            "preset": "gameplay-top",
            "splitRatio": 0.62,
            "gap": 0,
            "borderWidth": 0,
            "borderColor": "#101010",
            "facecamRadius": 12,
            "pip": { "x": 0.55, "y": 0.58, "w": 0.4, "h": 0.225 },
            "background": { "type": "solid", "color": "#101010", "blur": 20 },
            "gameplay": { "zoom": 1, "offsetX": 0, "offsetY": 0, "fit": "fill" },
            "facecam": { "zoom": 1, "offsetX": 0, "offsetY": 0, "fit": "fill" }
        },
        "captionStyle": {
            "fontSize": 64,
            "uppercase": true,
            "color": "#FFFFFF",
            "highlightColor": "#EE302F",
            "shadow": true
        },
        "captions": [{
            "id": "word-1",
            "text": "HELLO",
            "startMs": 100,
            "endMs": 600,
            "groupId": "group-1"
        }],
        "exportSettings": {
            "width": 720,
            "height": 1280,
            "fps": 30,
            "format": "mp4",
            "codec": "h264",
            "quality": "low",
            "hardware": "software"
        }
    });

    let composite = json!({
        "canvas": { "width": 1080, "height": 1920, "fps": 30 },
        "media": [
            {
                "id": "media-game",
                "path": source_path,
                "kind": "video",
                "durationMs": 1000,
                "width": 640,
                "height": 360,
                "hasAudio": true,
                "crop": {
                    "gameplay": { "x": 0.05, "y": 0.1, "w": 0.9, "h": 0.8 },
                    "facecam": { "x": 0.3, "y": 0, "w": 0.4, "h": 0.6 }
                }
            },
            { "id": "media-sticker", "path": image_path, "kind": "image", "durationMs": 1000, "width": 200, "height": 200, "hasAudio": false, "crop": {} },
            { "id": "media-music", "path": source_path, "kind": "audio", "durationMs": 1000, "width": 0, "height": 0, "hasAudio": true, "crop": {} }
        ],
        "tracks": {
            "video": [
                { "id": "clip-a", "mediaId": "media-game", "label": "A", "startMs": 0, "durationMs": 500, "inMs": 0, "speed": 1, "volume": 0.8, "fadeInMs": 80, "fadeOutMs": 80 },
                { "id": "clip-b", "mediaId": "media-game", "label": "B", "startMs": 500, "durationMs": 500, "inMs": 500, "speed": 1, "volume": 0.8 }
            ],
            "overlays": [
                {
                    "id": "sticker", "mediaId": "media-sticker", "label": "sticker", "startMs": 200, "durationMs": 400,
                    "x": 0.5, "y": 0.12, "width": 0.22, "height": 0.12, "opacity": 0.85, "rotation": 5, "zIndex": 1
                },
                {
                    "id": "hidden-sticker", "mediaId": "media-sticker", "label": "hidden sticker", "startMs": 200, "durationMs": 400,
                    "x": 0.8, "y": 0.8, "width": 0.2, "height": 0.1, "zIndex": 5, "hidden": true
                }
            ],
            "music": [{
                "id": "music", "mediaId": "media-music", "label": "music", "startMs": 0, "durationMs": 1000,
                "inMs": 0, "speed": 1, "volume": 0.7, "fadeOutMs": 200
            }],
            "sfx": [],
            "effects": [
                {
                    "id": "top-text", "label": "TOP", "startMs": 0, "durationMs": 1000,
                    "text": "TOP TEXT LARGE", "x": 0.5, "y": 0.07, "zIndex": 6, "rotation": 7,
                    "width": 0.25, "height": 0.14, "opacity": 0.9,
                    "textStyle": {
                        "fontFamily": "Arial Black", "fontSize": 76, "fontWeight": 900,
                        "italic": false, "underline": false, "transform": "uppercase",
                        "letterSpacing": 0, "lineHeight": 1.05, "textAlign": "center",
                        "color": "#FFCC00", "outline": true, "outlineWidth": 6,
                        "outlineColor": "#101010", "shadow": true, "shadowColor": "#EE302F",
                        "shadowBlur": 12, "shadowX": 0, "shadowY": 6,
                        "background": true, "backgroundColor": "#101010",
                        "backgroundOpacity": 0.75, "padding": 22
                    }
                },
                {
                    "id": "hidden-text", "label": "HIDDEN", "startMs": 0, "durationMs": 1000,
                    "text": "SHOULD NOT RENDER", "x": 0.5, "y": 0.5, "zIndex": 7, "hidden": true
                }
            ]
        },
        "layout": {
            "preset": "facecam-pip",
            "splitRatio": 0.62,
            "gap": 16,
            "borderWidth": 2,
            "borderColor": "#FFFFFF",
            "facecamRadius": 24,
            "pip": { "x": 0.55, "y": 0.58, "w": 0.4, "h": 0.225 },
            "background": { "type": "blur", "color": "#101010", "blur": 12 },
            "gameplay": { "zoom": 1.1, "offsetX": 0.2, "offsetY": -0.1, "fit": "fit" },
            "facecam": { "zoom": 1, "offsetX": 0, "offsetY": 0, "fit": "fill" }
        },
        "captionStyle": {
            "fontSize": 60,
            "uppercase": true,
            "color": "#FFFFFF",
            "highlightColor": "#EE302F",
            "outlineWidth": 2,
            "shadow": true,
            "background": true,
            "backgroundColor": "rgba(16,16,16,0.72)",
            "textAlign": "left"
        },
        "captions": [
            { "id": "word-1", "text": "BIG", "startMs": 100, "endMs": 350, "groupId": "group-1" },
            { "id": "word-2", "text": "PLAY", "startMs": 350, "endMs": 700, "groupId": "group-1" }
        ],
        "exportSettings": {
            "width": 720,
            "height": 1280,
            "fps": 30,
            "format": "mp4",
            "codec": "h264",
            "quality": "low",
            "hardware": "software"
        }
    });

    let vertical = json!({
        "canvas": { "width": 1080, "height": 1920, "fps": 30 },
        "media": [{
            "id": "media-1",
            "path": source_path,
            "kind": "video",
            "durationMs": 1000,
            "width": 640,
            "height": 360,
            "hasAudio": false,
            "crop": {
                "gameplay": { "x": 0.2, "y": 0.1, "w": 0.6, "h": 0.7 },
                "facecam": { "x": 0.35, "y": 0, "w": 0.3, "h": 0.5 }
            }
        }],
        "tracks": {
            "video": [{
                "id": "item-1",
                "mediaId": "media-1",
                "label": "clip",
                "startMs": 0,
                "durationMs": 1000,
                "inMs": 0,
                "speed": 1,
                "volume": 1
            }]
        },
        "layout": {
            "preset": "facecam-top",
            "splitRatio": 0.62,
            "gap": 0,
            "borderWidth": 0,
            "borderColor": "#101010",
            "facecamRadius": 0,
            "pip": { "x": 0.55, "y": 0.58, "w": 0.4, "h": 0.225 },
            "background": { "type": "solid", "color": "#101010", "blur": 20 },
            "gameplay": { "zoom": 1.4, "offsetX": 0.5, "offsetY": -0.4, "fit": "fill" },
            "facecam": { "zoom": 1.2, "offsetX": -0.3, "offsetY": 0.4, "fit": "fill" }
        },
        "captionStyle": { "fontSize": 64, "uppercase": true, "color": "#FFFFFF", "shadow": true },
        "captions": [],
        "exportSettings": {
            "width": 720,
            "height": 1280,
            "fps": 30,
            "format": "mp4",
            "codec": "h264",
            "quality": "low",
            "hardware": "software"
        }
    });

    let advanced = json!({
        "canvas": { "width": 1080, "height": 1920, "fps": 30 },
        "media": [
            {
                "id": "media-1",
                "path": source_path,
                "kind": "video",
                "durationMs": 1000,
                "width": 640,
                "height": 360,
                "hasAudio": true,
                "crop": { "gameplay": { "x": 0, "y": 0, "w": 1, "h": 1 }, "facecam": null }
            },
            { "id": "media-sticker", "path": image_path, "kind": "image", "durationMs": 1000, "width": 200, "height": 200, "hasAudio": false, "crop": {} }
        ],
        "tracks": {
            "video": [{
                "id": "clip-1",
                "mediaId": "media-1",
                "label": "graded",
                "startMs": 0,
                "durationMs": 1000,
                "inMs": 0,
                "speed": 1,
                "volume": 1,
                "effects": {
                    "brightness": 0.04,
                    "contrast": 1.2,
                    "saturation": 1.35,
                    "hue": -10,
                    "blur": 0,
                    "vignette": 0.3,
                    "flipX": false,
                    "flipY": false
                }
            }],
            "overlays": [
                {
                    "id": "shape-badge",
                    "label": "Badge",
                    "startMs": 0,
                    "durationMs": 900,
                    "x": 0.5,
                    "y": 0.2,
                    "width": 0.4,
                    "height": 0.08,
                    "opacity": 0.95,
                    "zIndex": 1,
                    "animation": "slide-down",
                    "exitAnimation": "fade-in",
                    "animationDurationMs": 250,
                    "shape": {
                        "kind": "pill",
                        "fill": "#E62E2D",
                        "fillOpacity": 0.9,
                        "stroke": "#FFFFFF",
                        "strokeWidth": 3,
                        "borderRadius": 40
                    }
                },
                {
                    "id": "kf-sticker",
                    "mediaId": "media-sticker",
                    "label": "Keyframe Sticker",
                    "startMs": 100,
                    "durationMs": 800,
                    "x": 0.2,
                    "y": 0.5,
                    "width": 0.25,
                    "height": 0.14,
                    "opacity": 1,
                    "zIndex": 2,
                    "keyframes": [
                        { "timeMs": 0, "property": "x", "value": 0.2, "easing": "ease-out" },
                        { "timeMs": 700, "property": "x", "value": 0.8, "easing": "ease-out" }
                    ]
                },
                {
                    "id": "anim-text",
                    "label": "Animated Text",
                    "startMs": 0,
                    "durationMs": 1000,
                    "x": 0.5,
                    "y": 0.2,
                    "width": 0.6,
                    "height": 0.1,
                    "zIndex": 3,
                    "text": "CLUTCH MOMENT",
                    "animation": "pop",
                    "exitAnimation": "fade-in",
                    "animationDurationMs": 300
                }
            ],
            "music": [],
            "sfx": [],
            "effects": []
        },
        "layout": {
            "preset": "gameplay-full",
            "splitRatio": 0.62,
            "gap": 0,
            "borderWidth": 0,
            "borderColor": "#101010",
            "facecamRadius": 0,
            "pip": { "x": 0.55, "y": 0.58, "w": 0.4, "h": 0.225 },
            "background": { "type": "solid", "color": "#101010", "blur": 20 },
            "gameplay": { "zoom": 1, "offsetX": 0, "offsetY": 0, "fit": "fill" },
            "facecam": { "zoom": 1, "offsetX": 0, "offsetY": 0, "fit": "fill" }
        },
        "captionStyle": { "fontSize": 64, "uppercase": true, "color": "#FFFFFF", "shadow": true },
        "captions": [],
        "exportSettings": {
            "width": 720,
            "height": 1280,
            "fps": 30,
            "format": "mp4",
            "codec": "h264",
            "quality": "low",
            "hardware": "software"
        }
    });

    let mut passed = Vec::new();
    for (name, value, check_coverage) in [
        ("basic", basic, false),
        ("composite", composite, false),
        ("vertical", vertical, true),
        ("advanced", advanced, false),
    ] {
        let project: RenderProject = serde_json::from_value(value).map_err(|e| e.to_string())?;
        check_project(name, &ffmpeg, &ffprobe, &cache, &project, check_coverage)?;
        passed.push(name);
    }
    Ok(passed)
}

fn check_project(
    name: &str,
    ffmpeg: &Path,
    ffprobe: &Path,
    cache: &Path,
    project: &RenderProject,
    check_coverage: bool,
) -> Result<(), String> {
    let output = cache.join(format!("{name}.mp4"));
    let _ = std::fs::remove_file(&output);
    let output_path = output.to_string_lossy().into_owned();
    let plan = build_args(cache, name, project, &output_path)
        .map_err(|error| format!("{}: {}", error.code, error.message))?;
    println!("[{name}] {} ffmpeg arguments", plan.args.len());

    let rendered = Command::new(ffmpeg)
        .args(&plan.args)
        .current_dir(cache)
        .output()
        .map_err(|e| e.to_string())?;
    if !rendered.status.success() {
        return Err(format!(
            "[{name}] render failed: {}",
            String::from_utf8_lossy(&rendered.stderr)
        ));
    }
    if !output.is_file() || std::fs::metadata(&output).map_err(|e| e.to_string())?.len() < 2000 {
        return Err(format!("[{name}] output missing or too small"));
    }

    if name == "composite" {
        let ass_path = cache.join("captions_composite.ass");
        let ass = std::fs::read_to_string(&ass_path)
            .map_err(|e| format!("[{name}] missing subtitle file: {e}"))?;
        for expected in [
            "Style: Text0,Arial Black,51,",
            ",3,15,",
            "\\frz-7.00",
            "TOP\\NTEXT\\NLARGE",
        ] {
            if !ass.contains(expected) {
                return Err(format!("[{name}] subtitle output missing {expected:?}: {ass}"));
            }
        }
        if ass.contains("SHOULD NOT RENDER") {
            return Err(format!("[{name}] hidden text was rendered"));
        }
        println!("[{name}] text style, wrapping, rotation and hidden layers ok");
    }

    let probe_path = output.to_string_lossy().into_owned();
    let probe = command_output(
        ffprobe,
        &[
            "-v",
            "error",
            "-select_streams",
            "v:0",
            "-show_entries",
            "stream=width,height",
            "-of",
            "csv=p=0",
            &probe_path,
        ],
    )?;
    let dimensions = String::from_utf8_lossy(&probe.stdout).trim().to_string();
    if dimensions != "720,1280" {
        return Err(format!("[{name}] unexpected dimensions: {dimensions}"));
    }
    if check_coverage {
        let frame = command_output(
            ffmpeg,
            &[
                "-v", "error", "-i", &probe_path, "-frames:v", "1", "-f", "rawvideo", "-pix_fmt", "rgb24", "-",
            ],
        )?;
        let width = 720usize;
        let height = 1280usize;
        let stride = width * 3;
        if frame.stdout.len() < stride * height {
            return Err(format!("[{name}] incomplete raw frame"));
        }
        for y in 0..height {
            let row = &frame.stdout[y * stride..(y + 1) * stride];
            let brightness: u64 = row.chunks_exact(3).map(|p| p[0] as u64 + p[1] as u64 + p[2] as u64).sum();
            let average = brightness / width as u64 / 3;
            if average < 20 {
                return Err(format!("[{name}] black gap at row {y} (average {average})"));
            }
        }
        println!("[{name}] full-frame coverage ok (no black rows)");
    }
    println!("[{name}] ok ({dimensions}, {} bytes)", std::fs::metadata(&output).map_err(|e| e.to_string())?.len());
    Ok(())
}
