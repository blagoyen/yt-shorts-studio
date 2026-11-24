use serde::Deserialize;

fn one() -> f64 { 1.0 }
fn point_five() -> f64 { 0.5 }
fn split() -> f64 { 0.62 }
fn fps() -> u32 { 30 }
fn dimension() -> u32 { 1080 }
fn height() -> u32 { 1920 }
fn speed() -> f64 { 1.0 }
fn font_size() -> u32 { 72 }
fn font_weight() -> u32 { 800 }
fn words_per_line() -> usize { 5 }
fn caption_y() -> f64 { 0.8 }
fn white() -> String { "#FFFFFF".to_string() }
fn accent() -> String { "#EE302F".to_string() }
fn ink() -> String { "#101010".to_string() }
fn plate() -> String { "rgba(16,16,16,0.72)".to_string() }
fn fill() -> String { "fill".to_string() }
fn solid() -> String { "solid".to_string() }
fn center() -> String { "center".to_string() }
fn h264() -> String { "h264".to_string() }
fn auto() -> String { "auto".to_string() }
fn high() -> String { "high".to_string() }
fn zero_f64() -> f64 { 0.0 }
fn line_height() -> f64 { 1.05 }
fn padding() -> u32 { 22 }
fn background_opacity() -> f64 { 0.72 }
fn black() -> String { "#000000".to_string() }
fn none() -> String { "none".to_string() }
fn font_family() -> String { "Impact".to_string() }
fn anim_duration() -> u64 { 380 }
fn normal_blend() -> String { "normal".to_string() }
fn rect_kind() -> String { "rect".to_string() }

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RenderProject {
    #[serde(default)]
    pub canvas: RenderCanvas,
    #[serde(default)]
    pub media: Vec<RenderMedia>,
    #[serde(default)]
    pub tracks: RenderTracks,
    #[serde(default)]
    pub layout: RenderLayout,
    #[serde(default)]
    pub caption_style: RenderCaptionStyle,
    #[serde(default)]
    pub captions: Vec<RenderCaption>,
    #[serde(default)]
    pub export_settings: RenderExportSettings,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RenderCanvas {
    #[serde(default = "dimension")]
    pub width: u32,
    #[serde(default = "height")]
    pub height: u32,
    #[serde(default = "fps")]
    pub fps: u32,
}

impl Default for RenderCanvas {
    fn default() -> Self { Self { width: dimension(), height: height(), fps: fps() } }
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RenderRect {
    #[serde(default)]
    pub x: f64,
    #[serde(default)]
    pub y: f64,
    #[serde(default = "one")]
    pub w: f64,
    #[serde(default = "one")]
    pub h: f64,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RenderCrop {
    #[serde(default)]
    pub gameplay: Option<RenderRect>,
    #[serde(default)]
    pub facecam: Option<RenderRect>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RenderVisualEffects {
    #[serde(default)]
    pub brightness: f64,
    #[serde(default = "one")]
    pub contrast: f64,
    #[serde(default = "one")]
    pub saturation: f64,
    #[serde(default)]
    pub hue: f64,
    #[serde(default)]
    pub blur: f64,
    #[serde(default)]
    pub vignette: f64,
    #[serde(default)]
    pub border_radius: f64,
    #[serde(default = "normal_blend")]
    pub blend_mode: String,
    #[serde(default)]
    pub flip_x: bool,
    #[serde(default)]
    pub flip_y: bool,
}

impl Default for RenderVisualEffects {
    fn default() -> Self {
        Self {
            brightness: 0.0,
            contrast: 1.0,
            saturation: 1.0,
            hue: 0.0,
            blur: 0.0,
            vignette: 0.0,
            border_radius: 0.0,
            blend_mode: normal_blend(),
            flip_x: false,
            flip_y: false,
        }
    }
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RenderKeyframe {
    #[serde(default)]
    pub time_ms: u64,
    #[serde(default)]
    pub property: String,
    #[serde(default)]
    pub value: f64,
    #[serde(default)]
    pub easing: String,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RenderShapeStyle {
    #[serde(default = "rect_kind")]
    pub kind: String,
    #[serde(default = "accent")]
    pub fill: String,
    #[serde(default = "one")]
    pub fill_opacity: f64,
    #[serde(default = "white")]
    pub stroke: String,
    #[serde(default)]
    pub stroke_width: u32,
    #[serde(default)]
    pub border_radius: i64,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RenderMedia {
    pub id: String,
    pub path: String,
    #[serde(default)]
    pub kind: String,
    #[serde(default)]
    pub duration_ms: u64,
    #[serde(default)]
    pub width: u32,
    #[serde(default)]
    pub height: u32,
    #[serde(default)]
    pub has_audio: bool,
    #[serde(default)]
    pub crop: RenderCrop,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RenderTracks {
    #[serde(default)]
    pub video: Vec<RenderItem>,
    #[serde(default)]
    pub captions: Vec<RenderItem>,
    #[serde(default)]
    pub overlays: Vec<RenderItem>,
    #[serde(default)]
    pub music: Vec<RenderItem>,
    #[serde(default)]
    pub sfx: Vec<RenderItem>,
    #[serde(default)]
    pub effects: Vec<RenderItem>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RenderItem {
    #[serde(default)]
    pub id: String,
    #[serde(default)]
    pub media_id: Option<String>,
    #[serde(default)]
    pub label: String,
    #[serde(default)]
    pub start_ms: u64,
    #[serde(default)]
    pub duration_ms: u64,
    #[serde(default)]
    pub in_ms: u64,
    #[serde(default = "speed")]
    pub speed: f64,
    #[serde(default = "one")]
    pub volume: f64,
    #[serde(default)]
    pub audio_ducking: Option<bool>,
    #[serde(default)]
    pub fade_in_ms: u64,
    #[serde(default)]
    pub fade_out_ms: u64,
    #[serde(default)]
    pub x: Option<f64>,
    #[serde(default)]
    pub y: Option<f64>,
    #[serde(default)]
    pub width: Option<f64>,
    #[serde(default)]
    pub height: Option<f64>,
    #[serde(default)]
    pub rotation: Option<f64>,
    #[serde(default)]
    pub opacity: Option<f64>,
    #[serde(default)]
    pub color: Option<String>,
    #[serde(default)]
    pub text: Option<String>,
    #[serde(default)]
    pub animation: Option<String>,
    #[serde(default)]
    pub exit_animation: Option<String>,
    #[serde(default = "anim_duration")]
    pub animation_duration_ms: u64,
    #[serde(default)]
    pub keyframes: Vec<RenderKeyframe>,
    #[serde(default)]
    pub effects: Option<RenderVisualEffects>,
    #[serde(default)]
    pub shape: Option<RenderShapeStyle>,
    #[serde(default)]
    pub hidden: bool,
    #[serde(default)]
    pub locked: bool,
    #[serde(default)]
    pub z_index: i32,
    #[serde(default)]
    pub text_style: Option<RenderTextStyle>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RenderTextStyle {
    #[serde(default = "font_family")]
    pub font_family: String,
    #[serde(default = "font_size")]
    pub font_size: u32,
    #[serde(default = "font_weight")]
    pub font_weight: u32,
    #[serde(default)]
    pub italic: bool,
    #[serde(default)]
    pub underline: bool,
    #[serde(default = "none")]
    pub transform: String,
    #[serde(default)]
    pub letter_spacing: f64,
    #[serde(default = "line_height")]
    pub line_height: f64,
    #[serde(default = "center")]
    pub text_align: String,
    #[serde(default = "white")]
    pub color: String,
    #[serde(default)]
    pub outline: bool,
    #[serde(default)]
    pub outline_width: u32,
    #[serde(default = "ink")]
    pub outline_color: String,
    #[serde(default)]
    pub shadow: bool,
    #[serde(default = "black")]
    pub shadow_color: String,
    #[serde(default)]
    pub shadow_blur: u32,
    #[serde(default)]
    pub shadow_x: f64,
    #[serde(default)]
    pub shadow_y: f64,
    #[serde(default)]
    pub background: bool,
    #[serde(default = "ink")]
    pub background_color: String,
    #[serde(default = "background_opacity")]
    pub background_opacity: f64,
    #[serde(default = "padding")]
    pub padding: u32,
}

impl Default for RenderTextStyle {
    fn default() -> Self {
        Self {
            font_family: "Impact".to_string(),
            font_size: font_size(),
            font_weight: font_weight(),
            italic: false,
            underline: false,
            transform: "none".to_string(),
            letter_spacing: 0.0,
            line_height: line_height(),
            text_align: center(),
            color: white(),
            outline: false,
            outline_width: 0,
            outline_color: ink(),
            shadow: false,
            shadow_color: black(),
            shadow_blur: 0,
            shadow_x: zero_f64(),
            shadow_y: zero_f64(),
            background: false,
            background_color: ink(),
            background_opacity: background_opacity(),
            padding: padding(),
        }
    }
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RenderRegion {
    #[serde(default = "one")]
    pub zoom: f64,
    #[serde(default)]
    pub offset_x: f64,
    #[serde(default)]
    pub offset_y: f64,
    #[serde(default = "fill")]
    pub fit: String,
}

impl Default for RenderRegion {
    fn default() -> Self { Self { zoom: 1.0, offset_x: 0.0, offset_y: 0.0, fit: "fill".to_string() } }
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RenderBackground {
    #[serde(rename = "type", default = "solid")]
    pub kind: String,
    #[serde(default = "ink")]
    pub color: String,
    #[serde(default)]
    pub image_path: Option<String>,
    #[serde(default = "blur_default")]
    pub blur: u32,
}

fn blur_default() -> u32 { 20 }

impl Default for RenderBackground {
    fn default() -> Self {
        Self { kind: solid(), color: ink(), image_path: None, blur: blur_default() }
    }
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RenderLayout {
    #[serde(default)]
    pub preset: String,
    #[serde(default = "split")]
    pub split_ratio: f64,
    #[serde(default)]
    pub gap: i64,
    #[serde(default)]
    pub border_width: i64,
    #[serde(default = "ink")]
    pub border_color: String,
    #[serde(default)]
    pub facecam_radius: i64,
    #[serde(default)]
    pub pip: RenderRect,
    #[serde(default)]
    pub background: RenderBackground,
    #[serde(default)]
    pub gameplay: RenderRegion,
    #[serde(default)]
    pub facecam: RenderRegion,
    #[serde(default)]
    pub color_grade: Option<RenderVisualEffects>,
}

impl Default for RenderLayout {
    fn default() -> Self {
        Self {
            preset: "gameplay-top".to_string(),
            split_ratio: split(),
            gap: 0,
            border_width: 0,
            border_color: ink(),
            facecam_radius: 0,
            pip: RenderRect { x: 0.55, y: 0.58, w: 0.4, h: 0.225 },
            background: RenderBackground::default(),
            gameplay: RenderRegion::default(),
            facecam: RenderRegion::default(),
            color_grade: None,
        }
    }
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RenderCaptionStyle {
    #[serde(default)]
    pub preset: String,
    #[serde(default)]
    pub font_family: String,
    #[serde(default = "font_size")]
    pub font_size: u32,
    #[serde(default = "font_weight")]
    pub font_weight: u32,
    #[serde(default)]
    pub uppercase: bool,
    #[serde(default = "white")]
    pub color: String,
    #[serde(default = "accent")]
    pub highlight_color: String,
    #[serde(default)]
    pub outline_width: u32,
    #[serde(default = "ink")]
    pub outline_color: String,
    #[serde(default)]
    pub shadow: bool,
    #[serde(default)]
    pub background: bool,
    #[serde(default = "plate")]
    pub background_color: String,
    #[serde(default = "center")]
    pub text_align: String,
    #[serde(default = "point_five")]
    pub x: f64,
    #[serde(default = "caption_y")]
    pub y: f64,
    #[serde(default = "words_per_line")]
    pub max_words_per_line: usize,
    #[serde(default)]
    pub animation: String,
}

impl Default for RenderCaptionStyle {
    fn default() -> Self {
        Self {
            preset: "Gaming Bold".to_string(),
            font_family: "Arial".to_string(),
            font_size: font_size(),
            font_weight: font_weight(),
            uppercase: true,
            color: white(),
            highlight_color: accent(),
            outline_width: 0,
            outline_color: ink(),
            shadow: true,
            background: false,
            background_color: plate(),
            text_align: center(),
            x: point_five(),
            y: caption_y(),
            max_words_per_line: words_per_line(),
            animation: "pop".to_string(),
        }
    }
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RenderCaption {
    pub id: String,
    #[serde(default)]
    pub text: String,
    #[serde(default)]
    pub start_ms: u64,
    #[serde(default)]
    pub end_ms: u64,
    #[serde(default)]
    pub group_id: String,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RenderExportSettings {
    #[serde(default = "dimension")]
    pub width: u32,
    #[serde(default = "height")]
    pub height: u32,
    #[serde(default = "fps")]
    pub fps: u32,
    #[serde(default)]
    pub format: String,
    #[serde(default = "h264")]
    pub codec: String,
    #[serde(default = "high")]
    pub quality: String,
    #[serde(default = "auto")]
    pub hardware: String,
}

impl Default for RenderExportSettings {
    fn default() -> Self {
        Self {
            width: dimension(),
            height: height(),
            fps: fps(),
            format: "mp4".to_string(),
            codec: h264(),
            quality: high(),
            hardware: auto(),
        }
    }
}

#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RenderProgressEvent {
    pub render_id: String,
    pub progress: f64,
    pub stage: String,
    pub elapsed_ms: u64,
    pub eta_ms: Option<u64>,
}

#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RenderCompleteEvent {
    pub render_id: String,
    pub output_path: String,
    pub success: bool,
    pub cancelled: bool,
    pub error: Option<String>,
}
