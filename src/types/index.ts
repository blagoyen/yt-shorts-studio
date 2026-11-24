export type TrackKind = "video" | "captions" | "overlays" | "music" | "sfx" | "effects";

export type MediaKind = "video" | "image" | "audio";

export interface MediaMetadata {
  path: string;
  name: string;
  kind: MediaKind;
  durationMs: number;
  width: number;
  height: number;
  fps: number;
  hasAudio: boolean;
  codec: string | null;
  sizeBytes: number;
}

export interface NormalizedRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface CanvasRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface CropConfig {
  gameplay: NormalizedRect | null;
  facecam: NormalizedRect | null;
}

export type LayoutPresetId =
  | "gameplay-top"
  | "facecam-top"
  | "equal"
  | "gameplay-full"
  | "facecam-pip"
  | "facecam-full";

export type FitMode = "fill" | "fit";

export interface RegionSettings {
  zoom: number;
  offsetX: number;
  offsetY: number;
  fit: FitMode;
}

export type BlendMode =
  | "normal"
  | "multiply"
  | "screen"
  | "overlay"
  | "darken"
  | "lighten";

export type FilterPresetId =
  | "none"
  | "vivid"
  | "cyberpunk"
  | "cinematic"
  | "high-contrast"
  | "warm"
  | "noir"
  | "retro";

export interface VisualEffects {
  brightness: number; // -1 to 1 (0 default)
  contrast: number; // 0 to 2 (1 default)
  saturation: number; // 0 to 2.5 (1 default)
  hue: number; // -180 to 180 (0 default)
  blur: number; // 0 to 40 (0 default)
  vignette: number; // 0 to 1 (0 default)
  borderRadius: number; // 0 to 200 px (0 default)
  blendMode: BlendMode;
  flipX: boolean;
  flipY: boolean;
  preset: FilterPresetId;
}

export interface LayoutSettings {
  preset: LayoutPresetId;
  splitRatio: number;
  gap: number;
  borderWidth: number;
  borderColor: string;
  facecamRadius: number;
  pip: { x: number; y: number; w: number; h: number };
  background: {
    type: "solid" | "blur" | "image";
    color: string;
    imagePath: string | null;
    blur: number;
  };
  gameplay: RegionSettings;
  facecam: RegionSettings;
  safeArea: boolean;
  colorGrade?: VisualEffects;
}

export interface MediaItem {
  id: string;
  name: string;
  path: string;
  kind: MediaKind;
  durationMs: number;
  width: number;
  height: number;
  fps: number;
  hasAudio: boolean;
  codec: string | null;
  sizeBytes: number;
  thumbnail: string | null;
  waveform: number[] | null;
  crop: CropConfig;
  missing?: boolean;
}

export type TextStyleTransform = "none" | "uppercase" | "lowercase";

export interface TextStyle {
  fontFamily: string;
  fontSize: number;
  fontWeight: number;
  italic: boolean;
  underline: boolean;
  transform: TextStyleTransform;
  letterSpacing: number;
  lineHeight: number;
  textAlign: "left" | "center" | "right";
  color: string;
  outline: boolean;
  outlineWidth: number;
  outlineColor: string;
  shadow: boolean;
  shadowColor: string;
  shadowBlur: number;
  shadowX: number;
  shadowY: number;
  background: boolean;
  backgroundColor: string;
  backgroundOpacity: number;
  padding: number;
}

export type KeyframeProperty =
  | "x"
  | "y"
  | "width"
  | "height"
  | "rotation"
  | "opacity"
  | "scale";

export type EasingType =
  | "linear"
  | "ease-in"
  | "ease-out"
  | "ease-in-out"
  | "bounce"
  | "elastic";

export interface Keyframe {
  id: string;
  timeMs: number; // relative to item.startMs
  property: KeyframeProperty;
  value: number;
  easing: EasingType;
}

export type AnimationPreset =
  | "none"
  | "fade-in"
  | "slide-up"
  | "slide-down"
  | "slide-left"
  | "slide-right"
  | "pop"
  | "zoom-in"
  | "spin-in"
  | "bounce-in"
  | "pulse"
  | "float"
  | "shake";

export type ShapeKind = "rect" | "circle" | "pill" | "badge";

export interface ShapeStyle {
  kind: ShapeKind;
  fill: string;
  fillOpacity: number;
  stroke: string;
  strokeWidth: number;
  borderRadius: number;
}

export interface TimelineItem {
  id: string;
  track: TrackKind;
  mediaId: string | null;
  label: string;
  startMs: number;
  durationMs: number;
  inMs: number;
  speed: number;
  color?: string;
  text?: string;
  animation?: AnimationPreset;
  exitAnimation?: AnimationPreset;
  animationDurationMs?: number;
  keyframes?: Keyframe[];
  effects?: VisualEffects;
  shape?: ShapeStyle;
  groupId?: string | null;
  volume?: number;
  audioDucking?: boolean;
  fadeInMs?: number;
  fadeOutMs?: number;
  enabled?: boolean;
  hidden?: boolean;
  locked?: boolean;
  zIndex?: number;
  textStyle?: TextStyle;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  rotation?: number;
  opacity?: number;
  cropOverride?: CropConfig;
}

export interface LayerGroup {
  id: string;
  name: string;
  itemIds: string[];
  locked: boolean;
  hidden: boolean;
  collapsed: boolean;
}

export interface TimelineMarker {
  id: string;
  timeMs: number;
  label: string;
  color: string;
}

export interface CaptionWord {
  id: string;
  text: string;
  startMs: number;
  endMs: number;
  groupId: string;
}

export interface CaptionStyle {
  preset: string;
  fontFamily: string;
  fontSize: number;
  fontWeight: number;
  uppercase: boolean;
  color: string;
  highlightColor: string;
  outlineWidth: number;
  outlineColor: string;
  shadow: boolean;
  background: boolean;
  backgroundColor: string;
  textAlign: "left" | "center" | "right";
  x: number;
  y: number;
  maxWordsPerLine: number;
  animation: "none" | "pop" | "bounce" | "fade" | "scale";
}

export interface ExportSettings {
  width: number;
  height: number;
  fps: number;
  format: "mp4" | "mkv";
  codec: "h264" | "h265";
  quality: "high" | "medium" | "low";
  hardware: "auto" | "software" | "nvenc" | "qsv" | "amf";
  outputFolder: string;
  filename: string;
}

export interface ProjectFile {
  format: "yt-shorts-studio";
  version: number;
  id: string;
  name: string;
  createdAt: string;
  modifiedAt: string;
  canvas: { width: number; height: number; fps: number };
  media: MediaItem[];
  tracks: Record<TrackKind, TimelineItem[]>;
  groups?: LayerGroup[];
  markers?: TimelineMarker[];
  layout: LayoutSettings;
  captionStyle: CaptionStyle;
  captions: CaptionWord[];
  exportSettings: ExportSettings;
}

export interface ProjectSummary {
  path: string;
  name: string;
  modifiedAt: string;
  durationMs: number;
  mediaCount: number;
  thumbnailPath: string | null;
}

export interface AppSettings {
  defaultProjectFolder: string | null;
  defaultExportFolder: string | null;
  autosaveIntervalSeconds: number;
  previewQuality: "low" | "medium" | "high";
  theme: "light" | "dark";
  ffmpegPath: string | null;
  ffprobePath: string | null;
  whisperModel: string;
  modelStorageDir: string | null;
  hardwareAcceleration: "auto" | "software" | "nvenc" | "qsv" | "amf";
  ytCutterOutputFolder: string | null;
}

export interface DependencyInfo {
  name: string;
  found: boolean;
  ready: boolean;
  path: string | null;
  version: string | null;
  source: string;
}

export interface DependencyReport {
  ffmpeg: DependencyInfo;
  ffprobe: DependencyInfo;
  pythonSidecar: DependencyInfo;
  whisperModel: DependencyInfo;
  gpuAcceleration: DependencyInfo;
  ready: boolean;
}

export interface AppInfo {
  version: string;
  configDir: string;
  cacheDir: string;
  defaultProjectFolder: string;
  defaultExportFolder: string;
}

export interface Toast {
  id: string;
  tone: "info" | "success" | "error";
  message: string;
  detail?: string;
}

export interface RenderJob {
  id: string;
  outputPath: string;
  progress: number;
  stage: string;
  elapsedMs: number;
  etaMs: number | null;
  status: "running" | "done" | "cancelled" | "error";
  error?: string;
}

export type RenderProgressEvent = {
  renderId: string;
  progress: number;
  stage: string;
  elapsedMs: number;
  etaMs: number | null;
};

export type RenderCompleteEvent = {
  renderId: string;
  outputPath: string;
  success: boolean;
  cancelled: boolean;
  error: string | null;
};

export interface TranscriptionWord {
  text: string;
  startMs: number;
  endMs: number;
}

export interface TranscriptionResult {
  language: string;
  durationMs: number;
  words: TranscriptionWord[];
}

export interface TranscriptionJob {
  id: string;
  mediaId: string;
  progress: number;
  stage: string;
  status: "running" | "done" | "cancelled" | "error";
  error?: string;
  wordCount?: number;
}

export type TranscriptionProgressEvent = {
  jobId: string;
  progress: number;
  stage: string;
};

export type TranscriptionCompleteEvent = {
  jobId: string;
  success: boolean;
  cancelled: boolean;
  error: string | null;
  result: TranscriptionResult | null;
};

export interface ModelDownloadJob {
  model: string;
  modelDir?: string | null;
  progress: number;
  stage: string;
  status: "running" | "done" | "error";
  error?: string;
}

export type ModelDownloadProgressEvent = {
  model: string;
  progress: number;
  stage: string;
};

export type ModelDownloadCompleteEvent = {
  model: string;
  success: boolean;
  error: string | null;
};

export type Selection =
  | { type: "clip"; id: string }
  | { type: "media"; id: string }
  | { type: "caption"; id: string }
  | { type: "captions"; id: "captions" }
  | { type: "region"; id: "gameplay" | "facecam" }
  | { type: "overlay"; id: string }
  | { type: "audio"; id: string }
  | { type: "group"; id: string }
  | null;

export type AlignMode =
  | "left"
  | "center-h"
  | "right"
  | "top"
  | "center-v"
  | "bottom"
  | "distribute-h"
  | "distribute-v";
