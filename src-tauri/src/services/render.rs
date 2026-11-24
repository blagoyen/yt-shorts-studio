use std::collections::{BTreeMap, HashMap};
use std::path::{Path, PathBuf};
use std::process::Stdio;
use std::sync::Arc;
use std::time::{Duration, Instant};

use tauri::{AppHandle, Emitter, Manager};
use tokio::io::{AsyncBufReadExt, AsyncReadExt, BufReader};
use tokio::process::{Child, Command};
use tokio::sync::Mutex;

use crate::error::{CmdResult, CommandError};
use crate::models::render::{
    RenderCompleteEvent, RenderItem, RenderLayout, RenderMedia, RenderProgressEvent, RenderProject,
    RenderRect, RenderRegion, RenderVisualEffects,
};
use crate::models::AppSettings;
use crate::services::binaries::{self, Tool};
use crate::state::AppState;

#[derive(Clone, Copy)]
struct Rect {
    x: f64,
    y: f64,
    w: f64,
    h: f64,
}

pub struct RenderHandle {
    pub child: Arc<Mutex<Child>>,
}

pub struct RenderPlan {
    pub args: Vec<String>,
    pub total_seconds: f64,
}

fn clamp(value: f64, min: f64, max: f64) -> f64 {
    value.min(max).max(min)
}

fn even(value: f64) -> u32 {
    let rounded = value.round().max(2.0) as u32;
    if rounded % 2 == 0 { rounded } else { rounded - 1 }
}

fn seconds(ms: u64) -> f64 {
    ms as f64 / 1000.0
}

fn ffmpeg_color(value: &str, fallback: &str) -> String {
    let text = value.trim();
    let hex = text.strip_prefix('#').unwrap_or(text);
    if hex.len() >= 6 {
        if let (Ok(r), Ok(g), Ok(b)) = (
            u8::from_str_radix(&hex[0..2], 16),
            u8::from_str_radix(&hex[2..4], 16),
            u8::from_str_radix(&hex[4..6], 16),
        ) {
            return format!("0x{r:02X}{g:02X}{b:02X}");
        }
    }
    ffmpeg_color(fallback, "#101010")
}

fn parse_rgb_triplet(value: &str) -> Option<(u8, u8, u8, Option<f64>)> {
    let text = value.trim();
    if let Some(inner) = text
        .strip_prefix("rgba(")
        .or_else(|| text.strip_prefix("rgb("))
        .and_then(|s| s.strip_suffix(')'))
    {
        let parts: Vec<&str> = inner.split(',').map(str::trim).collect();
        if parts.len() >= 3 {
            let r = parts[0].parse::<f64>().ok()?.clamp(0.0, 255.0).round() as u8;
            let g = parts[1].parse::<f64>().ok()?.clamp(0.0, 255.0).round() as u8;
            let b = parts[2].parse::<f64>().ok()?.clamp(0.0, 255.0).round() as u8;
            let a = parts.get(3).and_then(|v| v.parse::<f64>().ok()).map(|v| v.clamp(0.0, 1.0));
            return Some((r, g, b, a));
        }
    }
    let hex = text.strip_prefix('#').unwrap_or(text);
    if hex.len() == 3 {
        let mut chars = hex.chars();
        let r = u8::from_str_radix(&format!("{0}{0}", chars.next()?), 16).ok()?;
        let g = u8::from_str_radix(&format!("{0}{0}", chars.next()?), 16).ok()?;
        let b = u8::from_str_radix(&format!("{0}{0}", chars.next()?), 16).ok()?;
        return Some((r, g, b, None));
    }
    if hex.len() >= 6 {
        let r = u8::from_str_radix(&hex[0..2], 16).ok()?;
        let g = u8::from_str_radix(&hex[2..4], 16).ok()?;
        let b = u8::from_str_radix(&hex[4..6], 16).ok()?;
        return Some((r, g, b, None));
    }
    None
}

fn ass_color(value: &str, alpha: u8, fallback: &str) -> String {
    let parsed = parse_rgb_triplet(value)
        .or_else(|| parse_rgb_triplet(fallback))
        .unwrap_or((255, 255, 255, None));
    let final_alpha = parsed
        .3
        .map(|a| ((1.0 - a) * 255.0).round() as u8)
        .unwrap_or(alpha);
    format!("&H{final_alpha:02X}{:02X}{:02X}{:02X}&", parsed.2, parsed.1, parsed.0)
}

fn visual_effects_filters(effects: Option<&RenderVisualEffects>) -> String {
    let Some(fx) = effects else {
        return String::new();
    };
    let mut parts: Vec<String> = Vec::new();
    if fx.flip_x {
        parts.push("hflip".to_string());
    }
    if fx.flip_y {
        parts.push("vflip".to_string());
    }
    let b = clamp(fx.brightness, -1.0, 1.0);
    let c = clamp(fx.contrast, 0.0, 2.0);
    let s = clamp(fx.saturation, 0.0, 2.5);
    if b.abs() > 0.005 || (c - 1.0).abs() > 0.005 || (s - 1.0).abs() > 0.005 {
        parts.push(format!("eq=brightness={b:.3}:contrast={c:.3}:saturation={s:.3}"));
    }
    if fx.hue.abs() > 0.5 {
        parts.push(format!("hue=h={:.1}", clamp(fx.hue, -180.0, 180.0)));
    }
    if fx.blur > 0.2 {
        let sigma = clamp(fx.blur * 0.6, 0.2, 20.0);
        parts.push(format!("gblur=sigma={sigma:.2}"));
    }
    if fx.vignette > 0.02 {
        let angle = clamp(fx.vignette, 0.0, 1.0) * std::f64::consts::FRAC_PI_3;
        parts.push(format!("vignette=angle={angle:.3}"));
    }
    if parts.is_empty() {
        String::new()
    } else {
        format!(",{}", parts.join(","))
    }
}

fn keyframe_value(item: &RenderItem, property: &str) -> Option<(f64, f64, u64, u64)> {
    let mut kfs: Vec<&crate::models::render::RenderKeyframe> = item
        .keyframes
        .iter()
        .filter(|kf| kf.property == property)
        .collect();
    if kfs.len() < 2 {
        return None;
    }
    kfs.sort_by_key(|kf| kf.time_ms);
    let first = kfs.first()?;
    let last = kfs.last()?;
    Some((first.value, last.value, first.time_ms, last.time_ms))
}

fn overlay_position_expr(
    item: &RenderItem,
    axis: char,
    width: u32,
    height: u32,
) -> String {
    let base = if axis == 'x' {
        clamp(item.x.unwrap_or(0.5), 0.0, 1.0)
    } else {
        clamp(item.y.unwrap_or(0.5), 0.0, 1.0)
    };
    let dim = if axis == 'x' { width as f64 } else { height as f64 };
    let half = if axis == 'x' { "w/2" } else { "h/2" };
    let start_s = seconds(item.start_ms);
    let anim_s = seconds(item.animation_duration_ms.clamp(80, 2000));
    let prop = if axis == 'x' { "x" } else { "y" };

    if let Some((v0, v1, t0, t1)) = keyframe_value(item, prop) {
        let ks0 = seconds(item.start_ms + t0);
        let ks1 = seconds(item.start_ms + t1.max(t0 + 1));
        let p0 = v0 * dim;
        let p1 = v1 * dim;
        return format!(
            "({p0:.1}+({p1:.1}-{p0:.1})*clip((t-{ks0:.3})/{:.3},0,1))-{half}",
            (ks1 - ks0).max(0.01)
        );
    }

    let center = base * dim;
    match item.animation.as_deref().unwrap_or("none") {
        "slide-up" if axis == 'y' => format!(
            "({center:.1}+(1-clip((t-{start_s:.3})/{anim_s:.3},0,1))*{:.1})-{half}",
            0.14 * dim
        ),
        "slide-down" if axis == 'y' => format!(
            "({center:.1}-(1-clip((t-{start_s:.3})/{anim_s:.3},0,1))*{:.1})-{half}",
            0.14 * dim
        ),
        "slide-left" if axis == 'x' => format!(
            "({center:.1}+(1-clip((t-{start_s:.3})/{anim_s:.3},0,1))*{:.1})-{half}",
            0.22 * dim
        ),
        "slide-right" if axis == 'x' => format!(
            "({center:.1}-(1-clip((t-{start_s:.3})/{anim_s:.3},0,1))*{:.1})-{half}",
            0.22 * dim
        ),
        "float" if axis == 'y' => format!(
            "({center:.1}+sin((t-{start_s:.3})*5.026)*{:.1})-{half}",
            0.015 * dim
        ),
        "shake" if axis == 'x' => format!(
            "({center:.1}+sin((t-{start_s:.3})*50.26)*{:.1})-{half}",
            0.008 * dim
        ),
        _ => format!("{center:.1}-{half}"),
    }
}

fn ass_time(ms: u64) -> String {
    let centiseconds = ms / 10;
    let hours = centiseconds / 360_000;
    let minutes = (centiseconds % 360_000) / 6_000;
    let secs = (centiseconds % 6_000) / 100;
    let cs = centiseconds % 100;
    format!("{hours}:{minutes:02}:{secs:02}.{cs:02}")
}

fn transformed_text(text: &str, transform: &str) -> String {
    match transform {
        "uppercase" => text.to_uppercase(),
        "lowercase" => text.to_lowercase(),
        _ => text.to_string(),
    }
}

fn ass_text(text: &str, uppercase: bool) -> String {
    let value = if uppercase { text.to_uppercase() } else { text.to_string() };
    value
        .replace('\\', "/")
        .replace('{', "(")
        .replace('}', ")")
        .replace('\r', " ")
        .replace('\n', "\\N")
}

fn ass_text_styled(text: &str, transform: &str) -> String {
    transformed_text(text, transform)
        .replace('\\', "/")
        .replace('{', "(")
        .replace('}', ")")
        .replace('\r', " ")
        .replace('\n', "\\N")
}

fn ass_font_name(value: &str) -> String {
    value.replace(',', " ").trim().to_string()
}

fn wrap_text_for_box(text: &str, width_px: f64, font_size: u32, letter_spacing: f64) -> String {
    let unit = (font_size as f64 * 0.58 + letter_spacing).max(6.0);
    let max_chars = ((width_px.max(24.0)) / unit).floor().max(1.0) as usize;
    text.lines()
        .map(|paragraph| {
            if paragraph.trim().is_empty() {
                return String::new();
            }
            let mut lines: Vec<String> = Vec::new();
            let mut line = String::new();
            for word in paragraph.trim().split_whitespace() {
                let chunks: Vec<String> = if word.chars().count() > max_chars {
                    let chars: Vec<char> = word.chars().collect();
                    chars.chunks(max_chars).map(|chunk| chunk.iter().collect()).collect()
                } else {
                    vec![word.to_string()]
                };
                for chunk in chunks {
                    if line.is_empty() {
                        line = chunk;
                    } else if line.chars().count() + 1 + chunk.chars().count() <= max_chars {
                        line.push(' ');
                        line.push_str(&chunk);
                    } else {
                        lines.push(std::mem::take(&mut line));
                        line = chunk;
                    }
                }
            }
            if !line.is_empty() {
                lines.push(line);
            }
            lines.join("\n")
        })
        .collect::<Vec<_>>()
        .join("\n")
}

fn layout_regions(layout: &RenderLayout, width: u32, height: u32) -> (Option<Rect>, Option<Rect>) {
    let sy = height as f64 / 1920.0;
    let gap = (clamp(layout.gap as f64, 0.0, 200.0) * sy).round();
    let ratio = clamp(layout.split_ratio, 0.15, 0.85);
    let available = height as f64 - gap;
    let w = width as f64;

    match layout.preset.as_str() {
        "gameplay-top" => {
            let gameplay_h = even(available * ratio) as f64;
            (
                Some(Rect { x: 0.0, y: 0.0, w, h: gameplay_h }),
                Some(Rect { x: 0.0, y: gameplay_h + gap, w, h: height as f64 - gameplay_h - gap }),
            )
        }
        "facecam-top" => {
            let facecam_h = even(available * (1.0 - ratio)) as f64;
            (
                Some(Rect { x: 0.0, y: facecam_h + gap, w, h: height as f64 - facecam_h - gap }),
                Some(Rect { x: 0.0, y: 0.0, w, h: facecam_h }),
            )
        }
        "equal" => {
            let half = even(available / 2.0) as f64;
            (
                Some(Rect { x: 0.0, y: 0.0, w, h: half }),
                Some(Rect { x: 0.0, y: half + gap, w, h: height as f64 - half - gap }),
            )
        }
        "gameplay-full" => (Some(Rect { x: 0.0, y: 0.0, w, h: height as f64 }), None),
        "facecam-pip" => {
            let pip = &layout.pip;
            (
                Some(Rect { x: 0.0, y: 0.0, w, h: height as f64 }),
                Some(Rect {
                    x: clamp(pip.x, 0.0, 1.0) * w,
                    y: clamp(pip.y, 0.0, 1.0) * height as f64,
                    w: clamp(pip.w, 0.05, 1.0) * w,
                    h: clamp(pip.h, 0.05, 1.0) * height as f64,
                }),
            )
        }
        "facecam-full" => (None, Some(Rect { x: 0.0, y: 0.0, w, h: height as f64 })),
        _ => (Some(Rect { x: 0.0, y: 0.0, w, h: height as f64 }), None),
    }
}

fn crop_source(rect: Option<&RenderRect>, media: &RenderMedia) -> String {
    let source_w = media.width.max(16) as f64;
    let source_h = media.height.max(16) as f64;
    let (x, y, w, h) = match rect {
        Some(r) => {
            // Clamp in normalized space first. Clamping only the final pixel
            // x/y silently shifts a crop whose right/bottom edge passed 1.0.
            let nx = clamp(r.x, 0.0, 0.999);
            let ny = clamp(r.y, 0.0, 0.999);
            let nw = clamp(r.w, 0.01, 1.0 - nx);
            let nh = clamp(r.h, 0.01, 1.0 - ny);
            (nx * source_w, ny * source_h, nw * source_w, nh * source_h)
        }
        None => (0.0, 0.0, source_w, source_h),
    };
    let w = even(w).min(source_w as u32).max(2);
    let h = even(h).min(source_h as u32).max(2);
    let x = even(x).min(source_w as u32 - w) as i64;
    let y = even(y).min(source_h as u32 - h) as i64;
    format!("crop={w}:{h}:{x}:{y}")
}

fn fit_region(region: &RenderRegion, target: Rect, background: &str) -> String {
    let tw = even(target.w);
    let th = even(target.h);
    let base = if region.fit == "fit" {
        format!(
            "scale={tw}:{th}:force_original_aspect_ratio=decrease:flags=lanczos,format=rgba,pad={tw}:{th}:(ow-iw)/2:(oh-ih)/2:color={background}@0"
        )
    } else {
        format!("scale={tw}:{th}:force_original_aspect_ratio=increase:flags=lanczos,crop={tw}:{th}")
    };

    // Zoom only magnifies a filled slot. Allowing zoom < 1 would require
    // padding and is what produced empty/black bands inside a slot.
    let zoom = clamp(region.zoom, 1.0, 6.0);
    if (zoom - 1.0).abs() < 0.001 {
        return base;
    }
    let scaled_w = even(tw as f64 * zoom);
    let scaled_h = even(th as f64 * zoom);
    let overflow_x = scaled_w.saturating_sub(tw) as f64;
    let overflow_y = scaled_h.saturating_sub(th) as f64;
    // Symmetric pan: -1 => left edge, 0 => centre, +1 => right edge of the
    // extra area created by zoom. The preview applies the same offset with the
    // opposite sign because it moves the video instead of the crop window.
    let ox = clamp(region.offset_x, -1.0, 1.0);
    let oy = clamp(region.offset_y, -1.0, 1.0);
    let x = (((ox + 1.0) / 2.0) * overflow_x).round() as u32;
    let y = (((oy + 1.0) / 2.0) * overflow_y).round() as u32;
    format!("{base},scale={scaled_w}:{scaled_h}:flags=lanczos,crop={tw}:{th}:{x}:{y}")
}

fn rounded_alpha(width: u32, height: u32, radius: i64) -> String {
    let r = clamp(radius as f64, 0.0, width.min(height) as f64 / 2.0).round() as u32;
    if r < 2 {
        return String::new();
    }
    let w = width as f64;
    let h = height as f64;
    let right = w - r as f64;
    let bottom = h - r as f64;
    let inside = |cx: f64, cy: f64| {
        format!("if(lte(sqrt((X-{cx})*(X-{cx})+(Y-{cy})*(Y-{cy})),{r}),255,0)")
    };
    format!(
        ",format=rgba,geq=r='r(X,Y)':g='g(X,Y)':b='b(X,Y)':a='if(lt(X,{r}),if(lt(Y,{r}),{tl},255),if(gte(X,{right}),if(lt(Y,{r}),{tr},255),if(lt(X,{r}),if(gte(Y,{bottom}),{bl},255),if(gte(X,{right}),if(gte(Y,{bottom}),{br},255),255))))'",
        tl = inside(r as f64, r as f64),
        tr = inside(right, r as f64),
        bl = inside(r as f64, bottom),
        br = inside(right, bottom),
    )
}

fn atempo_chain(speed: f64) -> Vec<String> {
    let mut speed = clamp(speed, 0.25, 4.0);
    let mut filters = Vec::new();
    while speed > 2.0 + f64::EPSILON {
        filters.push("atempo=2.0".to_string());
        speed /= 2.0;
    }
    while speed < 0.5 - f64::EPSILON {
        filters.push("atempo=0.5".to_string());
        speed *= 2.0;
    }
    if (speed - 1.0).abs() > 0.001 {
        filters.push(format!("atempo={speed:.4}"));
    }
    filters
}

fn audio_fades(item: &RenderItem) -> String {
    let mut filters = Vec::new();
    if item.fade_in_ms > 0 {
        filters.push(format!("afade=t=in:st=0:d={}", seconds(item.fade_in_ms)));
    }
    if item.fade_out_ms > 0 {
        let duration = item.duration_ms.max(1);
        let start = duration.saturating_sub(item.fade_out_ms);
        let start = seconds(start);
        filters.push(format!("afade=t=out:st={start:.3}:d={}", seconds(item.fade_out_ms)));
    }
    if filters.is_empty() { String::new() } else { format!(",{}", filters.join(",")) }
}

fn duck_expression(ranges: &[(u64, u64)]) -> Option<String> {
    if ranges.is_empty() {
        return None;
    }
    let mut expr = "1".to_string();
    for &(start, end) in ranges.iter().rev() {
        expr = format!("if(between(t,{},{}),0.34,{expr})", seconds(start), seconds(end));
    }
    Some(expr)
}

fn build_ass(cache: &Path, render_id: &str, project: &RenderProject, width: u32, height: u32) -> CmdResult<Option<String>> {
    std::fs::create_dir_all(cache)?;
    let file_name = format!("captions_{}.ass", render_id.chars().filter(|c| c.is_ascii_alphanumeric() || *c == '-' || *c == '_').collect::<String>());
    let path = cache.join(&file_name);
    let style = &project.caption_style;
    let scale = height as f64 / 1920.0;
    let font_size = ((style.font_size as f64 * scale).round() as u32).max(18);
    let outline = ((style.outline_width as f64 * scale).round() as u32).max(0);
    let alignment = match style.text_align.as_str() {
        "left" => 1,
        "right" => 3,
        _ => 2,
    };
    let margin_v = ((1.0 - clamp(style.y, 0.0, 1.0)) * height as f64).round() as u32;
    let primary = ass_color(&style.color, 0, "#FFFFFF");
    let highlight = ass_color(&style.highlight_color, 0, "#EE302F");
    let outline_color = ass_color(&style.outline_color, 0, "#101010");
    let back_color = if style.background {
        ass_color(&style.background_color, 0x99, "#101010")
    } else {
        "&H80000000&".to_string()
    };
    let border_style = if style.background { 3 } else { 1 };
    let bold = if style.font_weight >= 600 { -1 } else { 0 };

    let mut groups: BTreeMap<String, Vec<&crate::models::render::RenderCaption>> = BTreeMap::new();
    for caption in &project.captions {
        groups.entry(caption.group_id.clone()).or_default().push(caption);
    }
    for words in groups.values_mut() {
        words.sort_by_key(|word| word.start_ms);
    }

    let mut lines: Vec<String> = Vec::new();
    for word in &project.captions {
        if word.end_ms <= word.start_ms {
            continue;
        }
        let Some(words) = groups.get(&word.group_id) else { continue };
        let mut text = String::new();
        for entry in words {
            let color = if entry.id == word.id { &highlight } else { &primary };
            text.push_str(&format!("{{\\c{color}}}{}", ass_text(&entry.text, style.uppercase)));
            text.push(' ');
        }
        text.push_str(&format!("{{\\c{primary}}}"));
        lines.push(format!(
            "Dialogue: 0,{},{},Default,,0,0,0,,{}",
            ass_time(word.start_ms),
            ass_time(word.end_ms),
            text.trim_end()
        ));
    }

    let mut overlay_items: Vec<&RenderItem> = Vec::new();
    overlay_items.extend(project.tracks.overlays.iter().filter(|item| {
        !item.hidden && item.text.as_deref().map(str::trim).is_some_and(|text| !text.is_empty())
    }));
    overlay_items.extend(project.tracks.effects.iter().filter(|item| {
        !item.hidden && item.text.as_deref().map(str::trim).is_some_and(|text| !text.is_empty())
    }));
    overlay_items.sort_by_key(|item| (item.z_index, item.start_ms));

    let caption_font = if style.font_family.trim().is_empty() {
        "Arial".to_string()
    } else {
        ass_font_name(&style.font_family)
    };
    let mut style_lines = vec![
        format!(
            "Style: Default,{caption_font},{font_size},{primary},{highlight},{outline_color},{back_color},{bold},0,0,0,100,100,0,0,{border_style},{outline},{},{alignment},48,48,{margin_v},1",
            if style.shadow { 1 } else { 0 }
        ),
    ];

    for (index, item) in overlay_items.iter().enumerate() {
        if item.duration_ms == 0 {
            continue;
        }
        let text_style = item.text_style.clone().unwrap_or_default();
        let x = clamp(item.x.unwrap_or(0.5), 0.0, 1.0) * width as f64;
        let y = clamp(item.y.unwrap_or(0.5), 0.0, 1.0) * height as f64;
        let opacity = item.opacity.unwrap_or(1.0).clamp(0.0, 1.0);
        let alpha = ((1.0 - opacity) * 255.0).round() as u8;
        let color = item
            .color
            .as_deref()
            .map(|value| ass_color(value, alpha, "#FFFFFF"))
            .unwrap_or_else(|| ass_color(&text_style.color, alpha, "#FFFFFF"));
        let outline_color = ass_color(&text_style.outline_color, alpha, "#101010");
        let shadow_color = ass_color(&text_style.shadow_color, alpha, "#000000");
        let back_color = if text_style.background {
            let plate_alpha = ((1.0 - text_style.background_opacity.clamp(0.0, 1.0)) * 255.0).round() as u8;
            ass_color(&text_style.background_color, plate_alpha, "#101010")
        } else if text_style.shadow {
            shadow_color.clone()
        } else {
            "&H80000000&".to_string()
        };
        let item_font_size = ((text_style.font_size as f64 * scale).round() as u32).max(12);
        let item_outline = if text_style.background {
            ((text_style.padding as f64 * scale).round() as u32).max(0)
        } else if text_style.outline {
            ((text_style.outline_width as f64 * scale).round() as u32).max(0)
        } else {
            0
        };
        let shadow_blur = if text_style.shadow {
            ((text_style.shadow_blur as f64 * scale).round() as u32).max(1)
        } else {
            0
        };
        let shadow_x = if text_style.shadow { (text_style.shadow_x * scale).round() as i32 } else { 0 };
        let shadow_y = if text_style.shadow { (text_style.shadow_y * scale).round() as i32 } else { 0 };
        let alignment = match text_style.text_align.as_str() {
            "left" => 4,
            "right" => 6,
            _ => 5,
        };
        let item_bold = if text_style.font_weight >= 600 { -1 } else { 0 };
        let item_italic = if text_style.italic { -1 } else { 0 };
        let item_underline = if text_style.underline { -1 } else { 0 };
        let spacing = (text_style.letter_spacing * scale).round() as i32;
        let item_border_style = if text_style.background { 3 } else { 1 };
        let style_name = format!("Text{index}");
        style_lines.push(format!(
            "Style: {style_name},{},{},{},{},{},{},{},{},{},0,100,100,{spacing},0,{item_border_style},{item_outline},{shadow_blur},{alignment},0,0,0,1",
            ass_font_name(&text_style.font_family),
            item_font_size,
            color,
            color,
            outline_color,
            back_color,
            item_bold,
            item_italic,
            item_underline
        ));
        let box_width = item.width.unwrap_or(0.4).clamp(0.02, 1.0) * width as f64;
        let wrapped = wrap_text_for_box(
            item.text.as_deref().unwrap_or(""),
            box_width,
            item_font_size,
            text_style.letter_spacing * scale,
        );
        let text = ass_text_styled(&wrapped, &text_style.transform);
        // CSS rotate() is clockwise; ASS \frz is counter-clockwise.
        let rotation = -item.rotation.unwrap_or(0.0);
        let rotation_tag = if rotation.abs() > 0.01 {
            format!("\\frz{rotation:.2}")
        } else {
            String::new()
        };
        let anim_ms = item.animation_duration_ms.clamp(80, item.duration_ms.max(80) / 2);
        let entrance = item.animation.as_deref().unwrap_or("none");
        let exit = item.exit_animation.as_deref().unwrap_or("none");
        let fade_in = if matches!(entrance, "fade-in" | "slide-up" | "slide-down" | "slide-left" | "slide-right" | "pop" | "zoom-in" | "spin-in" | "bounce-in") {
            anim_ms
        } else {
            0
        };
        let fade_out = if exit != "none" { anim_ms } else { 0 };
        let fad_tag = if fade_in > 0 || fade_out > 0 {
            format!("\\fad({fade_in},{fade_out})")
        } else {
            String::new()
        };
        let pos_tag = if let (Some((x0, x1, tx0, tx1)), Some((y0, y1, _, _))) =
            (keyframe_value(item, "x"), keyframe_value(item, "y"))
        {
            format!(
                "\\move({:.0},{:.0},{:.0},{:.0},{tx0},{tx1})",
                x0 * width as f64,
                y0 * height as f64,
                x1 * width as f64,
                y1 * height as f64
            )
        } else {
            match entrance {
                "slide-up" => format!("\\move({x:.0},{:.0},{x:.0},{y:.0},0,{anim_ms})", y + 0.14 * height as f64),
                "slide-down" => format!("\\move({x:.0},{:.0},{x:.0},{y:.0},0,{anim_ms})", y - 0.14 * height as f64),
                "slide-left" => format!("\\move({:.0},{y:.0},{x:.0},{y:.0},0,{anim_ms})", x + 0.22 * width as f64),
                "slide-right" => format!("\\move({:.0},{y:.0},{x:.0},{y:.0},0,{anim_ms})", x - 0.22 * width as f64),
                "bounce-in" => format!("\\move({x:.0},{:.0},{x:.0},{y:.0},0,{anim_ms})", y - 0.16 * height as f64),
                _ => format!("\\pos({x:.0},{y:.0})"),
            }
        };
        let transform_tag = match entrance {
            "pop" | "zoom-in" => format!("\\fscx30\\fscy30\\t(0,{anim_ms},\\fscx100\\fscy100)"),
            "spin-in" => format!("\\fscx40\\fscy40\\frz{:.2}\\t(0,{anim_ms},\\fscx100\\fscy100\\frz{rotation:.2})", rotation + 180.0),
            _ => String::new(),
        };
        lines.push(format!(
            "Dialogue: 0,{},{},{},,0,0,0,,{{{pos_tag}\\xshad{shadow_x}\\yshad{shadow_y}{rotation_tag}{fad_tag}{transform_tag}}}{text}",
            ass_time(item.start_ms),
            ass_time(item.start_ms + item.duration_ms),
            style_name
        ));
    }

    if lines.is_empty() {
        return Ok(None);
    }

    let content = format!(
        "[Script Info]\nScriptType: v4.00+\nPlayResX: {width}\nPlayResY: {height}\nWrapStyle: 2\nScaledBorderAndShadow: yes\nYCbCr Matrix: TV.709\n\n[V4+ Styles]\nFormat: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding\n{}\n\n[Events]\nFormat: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text\n{}\n",
        style_lines.join("\n"),
        lines.join("\n")
    );
    std::fs::write(&path, content)?;
    Ok(Some(file_name))
}

fn encoder_args(settings: &crate::models::render::RenderExportSettings) -> Vec<String> {
    let quality = match settings.quality.as_str() {
        "low" => 28,
        "medium" => 24,
        _ => 20,
    };
    let h265 = settings.codec == "h265";
    let (codec, preset_flag, preset, quality_flag) = match settings.hardware.as_str() {
        "nvenc" => (
            if h265 { "hevc_nvenc" } else { "h264_nvenc" },
            "-preset",
            "p4",
            "-cq",
        ),
        "qsv" => (
            if h265 { "hevc_qsv" } else { "h264_qsv" },
            "-preset",
            "medium",
            "-global_quality",
        ),
        "amf" => (
            if h265 { "hevc_amf" } else { "h264_amf" },
            "-quality",
            "balanced",
            "-qp",
        ),
        _ => (
            if h265 { "libx265" } else { "libx264" },
            "-preset",
            if h265 { "fast" } else { "veryfast" },
            "-crf",
        ),
    };
    vec![
        "-c:v".to_string(),
        codec.to_string(),
        preset_flag.to_string(),
        preset.to_string(),
        quality_flag.to_string(),
        quality.to_string(),
        "-pix_fmt".to_string(),
        "yuv420p".to_string(),
    ]
}

fn parse_progress(line: &str) -> Option<u64> {
    let (key, value) = line.trim().split_once('=')?;
    match key {
        "out_time_us" | "out_time_ms" => value.parse::<u64>().ok(),
        _ => None,
    }
}

fn cleanup_failed_render(output_path: &str) {
    let _ = std::fs::remove_file(output_path);
}

/// Build the complete FFmpeg command line and timeline duration for a project.
pub fn build_args(
    cache: &Path,
    render_id: &str,
    project: &RenderProject,
    output_path: &str,
) -> CmdResult<RenderPlan> {
    let export = &project.export_settings;
    let width = export.width.max(320);
    let height = export.height.max(320);
    let fps = export.fps.clamp(1, 120);
    let scale_x = width as f64 / 1080.0;
    let total_ms = project
        .tracks
        .video
        .iter()
        .chain(project.tracks.overlays.iter())
        .chain(project.tracks.music.iter())
        .chain(project.tracks.sfx.iter())
        .chain(project.tracks.effects.iter())
        .map(|item| item.start_ms + item.duration_ms)
        .chain(project.captions.iter().map(|word| word.end_ms))
        .max()
        .unwrap_or(0)
        .max(1000);
    let total_seconds = seconds(total_ms);

    let output = PathBuf::from(output_path);
    if let Some(parent) = output.parent() {
        std::fs::create_dir_all(parent)?;
    }
    std::fs::create_dir_all(cache)?;

    let mut args: Vec<String> = vec![
        "-y".to_string(),
        "-hide_banner".to_string(),
        "-nostats".to_string(),
        "-progress".to_string(),
        "pipe:1".to_string(),
    ];
    let mut input_count = 0usize;
    let mut filters: Vec<String> = Vec::new();
    let mut current = "base".to_string();
    let mut audio_inputs: Vec<String> = Vec::new();
    let background_color = ffmpeg_color(&project.layout.background.color, "#101010");

    if project.layout.background.kind == "image" {
        if let Some(path) = project.layout.background.image_path.as_deref().filter(|value| PathBuf::from(value).is_file()) {
            let index = input_count;
            input_count += 1;
            args.extend(["-loop".to_string(), "1".to_string(), "-framerate".to_string(), fps.to_string(), "-i".to_string(), path.to_string()]);
            filters.push(format!(
                "[{index}:v]scale={width}:{height}:force_original_aspect_ratio=increase:flags=lanczos,crop={width}:{height},fps={fps},format=yuv420p[bgimg]"
            ));
        }
    }

    filters.push(format!(
        "color=c={background_color}:s={width}x{height}:r={fps}:d={total_seconds:.3},format=yuv420p[base]"
    ));
    if filters.iter().any(|filter| filter.contains("[bgimg]")) {
        filters.push("[base][bgimg]overlay=0:0[bgbase]".to_string());
        current = "bgbase".to_string();
    }

    let (gameplay_region, facecam_region) = layout_regions(&project.layout, width, height);
    let media_map: HashMap<&str, &RenderMedia> = project.media.iter().map(|item| (item.id.as_str(), item)).collect();
    let video_ranges: Vec<(u64, u64)> = project.tracks.video.iter().map(|item| (item.start_ms, item.start_ms + item.duration_ms)).collect();
    let mut audio_index = 0usize;

    for (clip_number, item) in project.tracks.video.iter().enumerate() {
        let Some(media) = item.media_id.as_deref().and_then(|id| media_map.get(id)) else { continue };
        if !PathBuf::from(&media.path).is_file() {
            continue;
        }
        let speed = item.speed.clamp(0.25, 4.0);
        let source_duration = (item.duration_ms as f64 * speed).max(100.0);
        let index = input_count;
        input_count += 1;
        args.extend([
            "-ss".to_string(),
            format!("{:.3}", seconds(item.in_ms)),
            "-t".to_string(),
            format!("{:.3}", seconds(source_duration as u64)),
            "-i".to_string(),
            media.path.clone(),
        ]);

        let wants_background = project.layout.background.kind == "blur" && gameplay_region.is_some();
        let branches = usize::from(gameplay_region.is_some())
            + usize::from(facecam_region.is_some())
            + usize::from(wants_background);
        let mut split_labels = Vec::new();
        for n in 0..branches {
            split_labels.push(format!("v{}_{n}", clip_number));
        }
        filters.push(format!(
            "[{index}:v]fps={fps},setpts=(PTS-STARTPTS)/{speed:.4},split={branches}{}",
            split_labels.iter().map(|label| format!("[{label}]")).collect::<String>()
        ));

        let offset = format!("PTS+{:.3}/TB", seconds(item.start_ms));
        let enable = format!("between(t,{},{})", seconds(item.start_ms), seconds(item.start_ms + item.duration_ms));

        if wants_background {
            let blur = project.layout.background.blur.clamp(1, 40);
            filters.push(format!(
                "[{}]scale={width}:{height}:force_original_aspect_ratio=increase:flags=lanczos,crop={width}:{height},boxblur={blur}:2,eq=brightness=-0.14,setpts={offset}[bgb{clip_number}]",
                split_labels[0]
            ));
            filters.push(format!("[{current}][bgb{clip_number}]overlay=0:0:enable='{enable}'[base{clip_number}b]"));
            current = format!("base{clip_number}b");
        }

        let fx_chain = visual_effects_filters(
            item.effects.as_ref().or(project.layout.color_grade.as_ref()),
        );
        let mut branch = usize::from(wants_background);
        if let Some(region) = gameplay_region {
            let label = format!("gp{clip_number}");
            let crop = crop_source(media.crop.gameplay.as_ref(), media);
            let fit = fit_region(&project.layout.gameplay, region, &background_color);
            filters.push(format!(
                "[{}]{crop},{fit}{fx_chain},setpts={offset}[{label}]",
                split_labels[branch]
            ));
            filters.push(format!(
                "[{current}][{label}]overlay={}:{}:enable='{enable}'[base{clip_number}g]",
                region.x.round() as u32,
                region.y.round() as u32
            ));
            current = format!("base{clip_number}g");
            branch += 1;
        }
        if let Some(region) = facecam_region {
            let label = format!("fc{clip_number}");
            let crop = crop_source(media.crop.facecam.as_ref(), media);
            let fit = fit_region(&project.layout.facecam, region, &background_color);
            let radius = rounded_alpha(even(region.w), even(region.h), project.layout.facecam_radius);
            filters.push(format!(
                "[{}]{crop},{fit}{fx_chain}{radius},setpts={offset}[{label}]",
                split_labels[branch]
            ));
            filters.push(format!(
                "[{current}][{label}]overlay={}:{}:enable='{enable}'[base{clip_number}f]",
                region.x.round() as u32,
                region.y.round() as u32
            ));
            current = format!("base{clip_number}f");
        }

        if project.layout.border_width > 0 {
            let border = ffmpeg_color(&project.layout.border_color, "#101010");
            let thickness = (project.layout.border_width as f64 * scale_x).round().max(1.0) as u32;
            for (name, region) in [("g", gameplay_region), ("f", facecam_region)] {
                if let Some(rect) = region {
                    let x = rect.x.round() as u32;
                    let y = rect.y.round() as u32;
                    let w = (rect.w.round() as u32).saturating_sub(1);
                    let h = (rect.h.round() as u32).saturating_sub(1);
                    let target = format!("base{clip_number}{name}border");
                    filters.push(format!(
                        "[{current}]drawbox=x={x}:y={y}:w={w}:h={h}:t={thickness}:color={border}:enable='{enable}'[{target}]"
                    ));
                    current = target;
                }
            }
        }

        if media.has_audio && item.volume > 0.001 {
            let label = format!("audio{audio_index}");
            let tempo = atempo_chain(speed).join(",");
            let tempo = if tempo.is_empty() { String::new() } else { format!(",{tempo}") };
            let delay = item.start_ms.max(1);
            filters.push(format!(
                "[{index}:a]asetpts=PTS-STARTPTS{tempo}{},volume={:.3},adelay={delay}|{delay},aformat=sample_rates=48000:channel_layouts=stereo[{label}]",
                audio_fades(item),
                item.volume.clamp(0.0, 4.0)
            ));
            audio_inputs.push(label);
            audio_index += 1;
        }
    }

    let mut graphic_overlays: Vec<&RenderItem> = project
        .tracks
        .overlays
        .iter()
        .chain(project.tracks.effects.iter())
        .filter(|item| !item.hidden && (item.media_id.is_some() || item.shape.is_some()))
        .collect();
    graphic_overlays.sort_by_key(|item| (item.z_index, item.start_ms));
    for (overlay_number, item) in graphic_overlays.into_iter().enumerate() {
        if item.duration_ms == 0 {
            continue;
        }
        let tw = even((item.width.unwrap_or(0.4).clamp(0.02, 1.0) * width as f64).max(16.0));
        let th = even((item.height.unwrap_or(0.2).clamp(0.01, 1.0) * height as f64).max(16.0));
        let opacity = item.opacity.unwrap_or(1.0).clamp(0.0, 1.0);
        let rotation = item.rotation.unwrap_or(0.0);
        let rotate = if rotation.abs() > 0.01 {
            format!(",rotate={}:c=0x000000@0", rotation.to_radians())
        } else {
            String::new()
        };
        let fx_chain = visual_effects_filters(item.effects.as_ref());
        let fx_radius = item
            .effects
            .as_ref()
            .map(|e| (e.border_radius * scale_x).round() as i64)
            .unwrap_or(0);
        let anim_s = seconds(item.animation_duration_ms.clamp(80, item.duration_ms.max(80) / 2));
        let entrance = item.animation.as_deref().unwrap_or("none");
        let exit = item.exit_animation.as_deref().unwrap_or("none");
        let fade_in_filter = if matches!(entrance, "fade-in" | "slide-up" | "slide-down" | "slide-left" | "slide-right" | "pop" | "zoom-in" | "spin-in" | "bounce-in") {
            format!(",fade=t=in:st=0:d={anim_s:.3}:alpha=1")
        } else {
            String::new()
        };
        let fade_out_filter = if exit != "none" {
            let st = seconds(item.duration_ms.saturating_sub(item.animation_duration_ms.min(item.duration_ms)));
            format!(",fade=t=out:st={st:.3}:d={anim_s:.3}:alpha=1")
        } else {
            String::new()
        };
        let label = format!("overlay{overlay_number}");
        let offset = format!("PTS+{:.3}/TB", seconds(item.start_ms));
        let enable = format!("between(t,{},{})", seconds(item.start_ms), seconds(item.start_ms + item.duration_ms));
        let expr_x = overlay_position_expr(item, 'x', width, height);
        let expr_y = overlay_position_expr(item, 'y', width, height);

        if let Some(shape) = item.shape.as_ref() {
            let fill = ffmpeg_color(&shape.fill, "#E62E2D");
            let alpha = clamp(shape.fill_opacity * opacity, 0.0, 1.0);
            let shape_radius = if shape.kind == "circle" || shape.kind == "pill" {
                (tw.min(th) / 2) as i64
            } else {
                (shape.border_radius as f64 * scale_x).round() as i64
            };
            let rounded = rounded_alpha(tw, th, shape_radius.max(fx_radius));
            let stroke_filter = if shape.stroke_width > 0 && shape.kind != "circle" {
                let sw = ((shape.stroke_width as f64 * scale_x).round() as u32).max(1);
                let sc = ffmpeg_color(&shape.stroke, "#FFFFFF");
                format!(",drawbox=x=0:y=0:w={tw}:h={th}:t={sw}:color={sc}")
            } else {
                String::new()
            };
            filters.push(format!(
                "color=c={fill}:s={tw}x{th}:r={fps}:d={:.3},format=rgba{stroke_filter},colorchannelmixer=aa={alpha:.3}{rounded}{fx_chain}{fade_in_filter}{fade_out_filter}{rotate},setpts={offset}[{label}]",
                seconds(item.duration_ms)
            ));
        } else if let Some(media_id) = item.media_id.as_deref() {
            let Some(media) = media_map.get(media_id) else { continue };
            if media.kind != "image" || !PathBuf::from(&media.path).is_file() {
                continue;
            }
            let is_gif = media.path.to_lowercase().ends_with(".gif");
            let index = input_count;
            input_count += 1;
            if is_gif {
                args.extend(["-stream_loop".to_string(), "-1".to_string(), "-i".to_string(), media.path.clone()]);
            } else {
                args.extend(["-loop".to_string(), "1".to_string(), "-framerate".to_string(), fps.to_string(), "-i".to_string(), media.path.clone()]);
            }
            let rounded = rounded_alpha(tw, th, fx_radius);
            filters.push(format!(
                "[{index}:v]trim=duration={:.3},fps={fps},scale={tw}:{th}:force_original_aspect_ratio=decrease:flags=lanczos,format=rgba,pad={tw}:{th}:(ow-iw)/2:(oh-ih)/2:color=0x000000@0{fx_chain},colorchannelmixer=aa={opacity:.3}{rounded}{fade_in_filter}{fade_out_filter}{rotate},setpts={offset}[{label}]",
                seconds(item.duration_ms)
            ));
        } else {
            continue;
        }

        let next = format!("base{overlay_number}o");
        filters.push(format!(
            "[{current}][{label}]overlay=x='{expr_x}':y='{expr_y}':enable='{enable}'[{next}]"
        ));
        current = next;
    }

    for (track_name, items) in [("music", &project.tracks.music), ("sfx", &project.tracks.sfx)] {
        for (index_in_track, item) in items.iter().enumerate() {
            let Some(media_id) = item.media_id.as_deref() else { continue };
            let Some(media) = media_map.get(media_id) else { continue };
            if media.kind != "audio" || !PathBuf::from(&media.path).is_file() || item.volume <= 0.001 || item.hidden {
                continue;
            }
            let speed = item.speed.clamp(0.25, 4.0);
            let index = input_count;
            input_count += 1;
            args.extend([
                "-ss".to_string(),
                format!("{:.3}", seconds(item.in_ms)),
                "-t".to_string(),
                format!("{:.3}", seconds((item.duration_ms as f64 * speed) as u64)),
                "-i".to_string(),
                media.path.clone(),
            ]);
            let label = format!("audio_{track_name}_{index_in_track}");
            let tempo = atempo_chain(speed).join(",");
            let tempo = if tempo.is_empty() { String::new() } else { format!(",{tempo}") };
            let delay = item.start_ms.max(1);
            let should_duck = item.audio_ducking.unwrap_or(track_name == "music");
            let duck = if should_duck {
                duck_expression(&video_ranges).unwrap_or_else(|| "1".to_string())
            } else {
                "1".to_string()
            };
            let volume = item.volume.clamp(0.0, 4.0);
            filters.push(format!(
                "[{index}:a]asetpts=PTS-STARTPTS{tempo}{},adelay={delay}|{delay},volume='{volume:.3}*{duck}':eval=frame,aformat=sample_rates=48000:channel_layouts=stereo[{label}]",
                audio_fades(item)
            ));
            audio_inputs.push(label);
        }
    }

    let ass_file = build_ass(cache, render_id, project, width, height)?;
    let final_video = if let Some(file_name) = ass_file {
        filters.push(format!("[{current}]ass=filename={file_name},format=yuv420p[vout]"));
        "vout".to_string()
    } else {
        filters.push(format!("[{current}]format=yuv420p[vout]"));
        "vout".to_string()
    };

    if audio_inputs.is_empty() {
        filters.push(format!(
            "anullsrc=r=48000:cl=stereo,atrim=duration={total_seconds:.3},asetpts=PTS-STARTPTS[aout]"
        ));
    } else {
        filters.push("anullsrc=r=48000:cl=stereo,asetpts=PTS-STARTPTS[asilence]".to_string());
        let all = std::iter::once("asilence".to_string()).chain(audio_inputs.iter().cloned()).collect::<Vec<_>>();
        let links = all.iter().map(|label| format!("[{label}]")).collect::<String>();
        filters.push(format!(
            "{links}amix=inputs={}:duration=longest:normalize=0,atrim=duration={total_seconds:.3},asetpts=PTS-STARTPTS[aout]",
            all.len()
        ));
    }

    args.push("-filter_complex".to_string());
    args.push(filters.join(";"));
    args.extend([
        "-map".to_string(),
        format!("[{final_video}]"),
        "-map".to_string(),
        "[aout]".to_string(),
        "-t".to_string(),
        format!("{total_seconds:.3}"),
    ]);
    args.extend(encoder_args(export));
    args.extend([
        "-r".to_string(),
        fps.to_string(),
        "-c:a".to_string(),
        "aac".to_string(),
        "-b:a".to_string(),
        "192k".to_string(),
        "-movflags".to_string(),
        "+faststart".to_string(),
        output_path.to_string(),
    ]);
    Ok(RenderPlan { args, total_seconds })
}

pub async fn render(
    app: AppHandle,
    state: AppState,
    render_id: String,
    project: RenderProject,
    output_path: String,
) -> CmdResult<()> {
    let started = Instant::now();
    let settings = state.settings();
    let ffmpeg = binaries::resolve(Tool::Ffmpeg, &settings).ok_or_else(|| {
        CommandError::new("FFMPEG_MISSING", "FFmpeg was not found. Check Settings → Dependencies.")
    })?;

    let cache = app
        .path()
        .app_cache_dir()
        .map_err(|err| CommandError::new("CACHE_DIR", err.to_string()))?;
    std::fs::create_dir_all(&cache)?;
    let plan = build_args(&cache, &render_id, &project, &output_path)?;
    let total_seconds = plan.total_seconds;

    let mut command = Command::new(&ffmpeg);
    command.args(&plan.args).current_dir(&cache).stdout(Stdio::piped()).stderr(Stdio::piped());
    #[cfg(windows)]
    command.creation_flags(0x08000000);

    let mut child = command.spawn().map_err(|err| {
        cleanup_failed_render(&output_path);
        CommandError::new("RENDER_START_FAILED", err.to_string())
    })?;
    let mut stdout = child.stdout.take().ok_or_else(|| CommandError::new("RENDER_PIPE", "Could not read FFmpeg progress."))?;
    let mut stderr = child.stderr.take().ok_or_else(|| CommandError::new("RENDER_PIPE", "Could not read FFmpeg output."))?;
    let stderr_task = tokio::spawn(async move {
        let mut buffer = Vec::new();
        let _ = stderr.read_to_end(&mut buffer).await;
        String::from_utf8_lossy(&buffer).into_owned()
    });

    let child = Arc::new(Mutex::new(child));
    state.renders.lock().await.insert(render_id.clone(), RenderHandle { child: child.clone() });
    let _ = app.emit(
        "render-progress",
        RenderProgressEvent {
            render_id: render_id.clone(),
            progress: 0.0,
            stage: "Rendering".to_string(),
            elapsed_ms: 0,
            eta_ms: None,
        },
    );

    let mut reader = BufReader::new(&mut stdout);
    let mut line = String::new();
    let mut last_emit = Instant::now();
    let mut emitted_percent = 0.0_f64;
    loop {
        line.clear();
        let bytes = reader.read_line(&mut line).await.map_err(|err| CommandError::new("RENDER_READ", err.to_string()))?;
        if bytes == 0 {
            break;
        }
        if let Some(time_us) = parse_progress(&line) {
            let progress = clamp(time_us as f64 / (total_seconds * 1_000_000.0), 0.0, 0.995);
            let percent = (progress * 100.0).floor();
            if percent > emitted_percent || last_emit.elapsed() > Duration::from_millis(700) {
                emitted_percent = percent;
                let elapsed = started.elapsed();
                let eta = if progress > 0.01 {
                    Some(((elapsed.as_secs_f64() / progress) * (1.0 - progress) * 1000.0).round() as u64)
                } else {
                    None
                };
                let _ = app.emit(
                    "render-progress",
                    RenderProgressEvent {
                        render_id: render_id.clone(),
                        progress,
                        stage: "Rendering".to_string(),
                        elapsed_ms: elapsed.as_millis() as u64,
                        eta_ms: eta,
                    },
                );
                last_emit = Instant::now();
            }
        }
    }

    let mut handle = child.lock().await;
    let status = handle.wait().await.map_err(|err| CommandError::new("RENDER_WAIT", err.to_string()))?;
    drop(handle);
    state.renders.lock().await.remove(&render_id);
    let stderr_text = stderr_task.await.unwrap_or_default();
    let cancelled = state.cancelled.lock().map(|mut set| set.remove(&render_id)).unwrap_or(false);

    if cancelled {
        let _ = std::fs::remove_file(&output_path);
        let _ = app.emit(
            "render-complete",
            RenderCompleteEvent {
                render_id: render_id.clone(),
                output_path,
                success: false,
                cancelled: true,
                error: None,
            },
        );
        return Ok(());
    }

    if !status.success() {
        let detail = stderr_text.trim().to_string();
        cleanup_failed_render(&output_path);
        return Err(CommandError::new("RENDER_FAILED", "FFmpeg could not render this project.").with_detail(detail));
    }

    let _ = app.emit(
        "render-complete",
        RenderCompleteEvent {
            render_id,
            output_path,
            success: true,
            cancelled: false,
            error: None,
        },
    );
    Ok(())
}

pub async fn cancel(app: &AppHandle, state: AppState, render_id: &str) -> CmdResult<bool> {
    if let Ok(mut set) = state.cancelled.lock() {
        set.insert(render_id.to_string());
    }
    let handle = state.renders.lock().await.remove(render_id);
    if let Some(handle) = handle {
        let mut child = handle.child.lock().await;
        let _ = child.start_kill();
    }
    let _ = app.emit(
        "render-progress",
        RenderProgressEvent {
            render_id: render_id.to_string(),
            progress: 0.0,
            stage: "Cancelling".to_string(),
            elapsed_ms: 0,
            eta_ms: None,
        },
    );
    Ok(true)
}

pub fn validate(project: &RenderProject, settings: &AppSettings) -> CmdResult<String> {
    if project.tracks.video.is_empty() && project.tracks.overlays.is_empty() && project.captions.is_empty() {
        return Err(CommandError::new("EMPTY_PROJECT", "Add media or captions before exporting."));
    }
    if binaries::resolve(Tool::Ffmpeg, settings).is_none() {
        return Err(CommandError::new("FFMPEG_MISSING", "FFmpeg was not found. Check Settings → Dependencies."));
    }
    for item in project.tracks.video.iter() {
        if let Some(id) = item.media_id.as_deref() {
            if !project.media.iter().any(|media| media.id == id && PathBuf::from(&media.path).is_file()) {
                return Err(CommandError::new("MISSING_MEDIA", format!("A timeline clip references missing media: {}", item.label)));
            }
        }
    }
    Ok("ready".to_string())
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;
    use std::process::Command as StdCommand;

    fn bundled_tool(name: &str) -> PathBuf {
        Path::new(env!("CARGO_MANIFEST_DIR"))
            .join("..")
            .join("resources")
            .join("ffmpeg")
            .join(name)
    }

    fn run(program: &Path, args: &[&str]) -> std::process::Output {
        StdCommand::new(program)
            .args(args)
            .output()
            .expect("failed to run bundled tool")
    }

    #[test]
    fn builds_and_renders_a_vertical_project() {
        let ffmpeg = bundled_tool("ffmpeg.exe");
        let ffprobe = bundled_tool("ffprobe.exe");
        assert!(ffmpeg.is_file(), "missing ffmpeg at {}", ffmpeg.display());
        assert!(ffprobe.is_file(), "missing ffprobe at {}", ffprobe.display());

        let root = Path::new(env!("CARGO_MANIFEST_DIR"))
            .join("..")
            .join("target")
            .join("render-test");
        let cache = root.join("cache");
        std::fs::create_dir_all(&cache).unwrap();
        let source = root.join("source.mp4");
        let output = root.join("output.mp4");
        let _ = std::fs::remove_file(&output);

        let source_path = source.to_string_lossy().into_owned();
        let made = run(
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
        );
        assert!(
            made.status.success(),
            "could not make test source: {}",
            String::from_utf8_lossy(&made.stderr)
        );
        assert!(source.is_file());

        let project: RenderProject = serde_json::from_value(json!({
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
                "facecamRadius": 0,
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
        }))
        .unwrap();

        let output_path = output.to_string_lossy().into_owned();
        let plan = build_args(&cache, "unit-test", &project, &output_path).unwrap();
        assert!((plan.total_seconds - 1.0).abs() < 0.001);

        let mut command = StdCommand::new(&ffmpeg);
        let rendered = command
            .args(&plan.args)
            .current_dir(&cache)
            .output()
            .expect("failed to run ffmpeg render");
        assert!(
            rendered.status.success(),
            "ffmpeg render failed:\n{}",
            String::from_utf8_lossy(&rendered.stderr)
        );
        assert!(output.is_file(), "render output was not created");
        assert!(std::fs::metadata(&output).unwrap().len() > 10_000);

        let probe_path = output.to_string_lossy().into_owned();
        let probe = run(
            &ffprobe,
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
        );
        assert!(probe.status.success());
        let dimensions = String::from_utf8_lossy(&probe.stdout).trim().to_string();
        assert_eq!(dimensions, "720,1280", "unexpected output dimensions");
    }
}
