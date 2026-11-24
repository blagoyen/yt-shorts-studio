import type {
  CanvasRect,
  CaptionStyle,
  CropConfig,
  ExportSettings,
  FilterPresetId,
  LayoutPresetId,
  LayoutSettings,
  MediaItem,
  NormalizedRect,
  ProjectFile,
  ShapeKind,
  ShapeStyle,
  TextStyle,
  TimelineItem,
  TrackKind,
  VisualEffects,
} from "../types";

export const CANVAS = { width: 1080, height: 1920 } as const;
export const PROJECT_FORMAT = "yt-shorts-studio";
export const PROJECT_VERSION = 2;

export const TRACKS: { id: TrackKind; label: string }[] = [
  { id: "video", label: "VIDEO" },
  { id: "captions", label: "CAPTIONS" },
  { id: "overlays", label: "OVERLAYS" },
  { id: "music", label: "MUSIC" },
  { id: "sfx", label: "SOUND EFFECTS" },
  { id: "effects", label: "EFFECTS" },
];

export const FONT_CHOICES = [
  "Arial",
  "Arial Black",
  "Impact",
  "Trebuchet MS",
  "Verdana",
  "Georgia",
  "Courier New",
  "Consolas",
];

export function defaultVisualEffects(): VisualEffects {
  return {
    brightness: 0,
    contrast: 1,
    saturation: 1,
    hue: 0,
    blur: 0,
    vignette: 0,
    borderRadius: 0,
    blendMode: "normal",
    flipX: false,
    flipY: false,
    preset: "none",
  };
}

export function normalizeVisualEffects(value?: Partial<VisualEffects> | null): VisualEffects {
  const base = defaultVisualEffects();
  if (!value || typeof value !== "object") return base;
  return {
    ...base,
    ...value,
    brightness: clamp(value.brightness ?? base.brightness, -1, 1),
    contrast: clamp(value.contrast ?? base.contrast, 0, 2),
    saturation: clamp(value.saturation ?? base.saturation, 0, 2.5),
    hue: clamp(value.hue ?? base.hue, -180, 180),
    blur: clamp(value.blur ?? base.blur, 0, 40),
    vignette: clamp(value.vignette ?? base.vignette, 0, 1),
    borderRadius: clamp(value.borderRadius ?? base.borderRadius, 0, 200),
  };
}

export const FILTER_PRESETS: { id: FilterPresetId; name: string; effects: Partial<VisualEffects> }[] = [
  { id: "none", name: "Original", effects: { brightness: 0, contrast: 1, saturation: 1, hue: 0, blur: 0, vignette: 0 } },
  { id: "vivid", name: "Vivid Gaming", effects: { brightness: 0.04, contrast: 1.18, saturation: 1.42, hue: 0, vignette: 0.12 } },
  { id: "cyberpunk", name: "Cyberpunk Neon", effects: { brightness: 0.02, contrast: 1.28, saturation: 1.65, hue: -18, vignette: 0.3 } },
  { id: "cinematic", name: "Cinematic Teal", effects: { brightness: -0.04, contrast: 1.22, saturation: 0.88, hue: -8, vignette: 0.35 } },
  { id: "high-contrast", name: "High Contrast", effects: { brightness: 0, contrast: 1.45, saturation: 1.15, hue: 0, vignette: 0.2 } },
  { id: "warm", name: "Warm Sunset", effects: { brightness: 0.05, contrast: 1.12, saturation: 1.25, hue: 14, vignette: 0.18 } },
  { id: "noir", name: "Noir B&W", effects: { brightness: -0.02, contrast: 1.38, saturation: 0, hue: 0, vignette: 0.45 } },
  { id: "retro", name: "Retro VHS", effects: { brightness: 0.03, contrast: 0.92, saturation: 1.32, hue: 10, vignette: 0.4 } },
];

export function cssFilterFromEffects(effects?: Partial<VisualEffects> | null): string | undefined {
  if (!effects) return undefined;
  const fx = normalizeVisualEffects(effects);
  const parts: string[] = [];
  if (Math.abs(fx.brightness) > 0.005) parts.push(`brightness(${(1 + fx.brightness).toFixed(3)})`);
  if (Math.abs(fx.contrast - 1) > 0.005) parts.push(`contrast(${fx.contrast.toFixed(3)})`);
  if (Math.abs(fx.saturation - 1) > 0.005) parts.push(`saturate(${fx.saturation.toFixed(3)})`);
  if (Math.abs(fx.hue) > 0.5) parts.push(`hue-rotate(${fx.hue.toFixed(1)}deg)`);
  if (fx.blur > 0.1) parts.push(`blur(${fx.blur.toFixed(1)}px)`);
  return parts.length ? parts.join(" ") : undefined;
}

export function defaultShapeStyle(kind: ShapeKind = "rect"): ShapeStyle {
  switch (kind) {
    case "circle":
      return { kind, fill: "#E62E2D", fillOpacity: 0.9, stroke: "#FFFFFF", strokeWidth: 4, borderRadius: 999 };
    case "pill":
      return { kind, fill: "#101010", fillOpacity: 0.82, stroke: "#FFFFFF", strokeWidth: 3, borderRadius: 999 };
    case "badge":
      return { kind, fill: "#FFD84D", fillOpacity: 0.96, stroke: "#101010", strokeWidth: 5, borderRadius: 18 };
    default:
      return { kind: "rect", fill: "#E62E2D", fillOpacity: 0.85, stroke: "#FFFFFF", strokeWidth: 0, borderRadius: 12 };
  }
}

export function defaultTextStyle(): TextStyle {
  return {
    fontFamily: "Impact",
    fontSize: 82,
    fontWeight: 900,
    italic: false,
    underline: false,
    transform: "uppercase",
    letterSpacing: 0,
    lineHeight: 1.05,
    textAlign: "center",
    color: "#FFFFFF",
    outline: true,
    outlineWidth: 7,
    outlineColor: "#101010",
    shadow: true,
    shadowColor: "#000000",
    shadowBlur: 14,
    shadowX: 0,
    shadowY: 6,
    background: false,
    backgroundColor: "#101010",
    backgroundOpacity: 0.72,
    padding: 22,
  };
}

export function normalizeTextStyle(value?: Partial<TextStyle> | null): TextStyle {
  const base = defaultTextStyle();
  if (!value || typeof value !== "object") return base;
  return {
    ...base,
    ...value,
    fontSize: Math.max(12, Math.round(value.fontSize ?? base.fontSize)),
    fontWeight: Math.max(100, Math.min(900, Math.round(value.fontWeight ?? base.fontWeight))),
    outlineWidth: Math.max(0, Math.round(value.outlineWidth ?? base.outlineWidth)),
    letterSpacing: value.letterSpacing ?? base.letterSpacing,
    lineHeight: Math.max(0.8, value.lineHeight ?? base.lineHeight),
    backgroundOpacity: clamp(value.backgroundOpacity ?? base.backgroundOpacity, 0, 1),
    padding: Math.max(0, Math.round(value.padding ?? base.padding)),
  };
}

export const TEXT_PRESETS: { id: string; name: string; style: Partial<TextStyle> }[] = [
  { id: "gaming-bold", name: "Gaming Bold", style: { fontFamily: "Impact", fontSize: 84, fontWeight: 900, transform: "uppercase", color: "#FFFFFF", outline: true, outlineWidth: 8, outlineColor: "#101010", shadow: true } },
  { id: "meme", name: "Meme Text", style: { fontFamily: "Impact", fontSize: 96, fontWeight: 900, transform: "uppercase", color: "#FFFFFF", outline: true, outlineWidth: 10, outlineColor: "#101010", shadow: false, background: false } },
  { id: "minimal", name: "Minimal White", style: { fontFamily: "Arial", fontSize: 58, fontWeight: 400, transform: "none", color: "#FFFFFF", outline: false, shadow: true, shadowBlur: 10 } },
  { id: "impact", name: "Large Impact", style: { fontFamily: "Impact", fontSize: 120, fontWeight: 900, transform: "uppercase", color: "#FFFFFF", outline: true, outlineWidth: 12, outlineColor: "#101010", shadow: true } },
  { id: "red-highlight", name: "Red Highlight", style: { fontFamily: "Arial Black", fontSize: 76, fontWeight: 900, transform: "uppercase", color: "#EE302F", outline: true, outlineWidth: 6, outlineColor: "#FFFFFF", shadow: false } },
  { id: "yellow-highlight", name: "Yellow Highlight", style: { fontFamily: "Arial Black", fontSize: 76, fontWeight: 900, transform: "uppercase", color: "#FFD84D", outline: true, outlineWidth: 6, outlineColor: "#101010", shadow: false } },
  { id: "cinematic", name: "Cinematic", style: { fontFamily: "Georgia", fontSize: 70, fontWeight: 700, transform: "none", color: "#F8F7F4", outline: false, shadow: true, shadowBlur: 24, shadowY: 12 } },
  { id: "subtitle", name: "Clean Subtitle", style: { fontFamily: "Arial", fontSize: 56, fontWeight: 700, transform: "none", color: "#FFFFFF", outline: true, outlineWidth: 3, outlineColor: "#101010", shadow: false, background: true } },
];

export function wrapTextForBox(
  text: string,
  widthPx: number,
  fontSize: number,
  letterSpacing = 0,
): string {
  const unit = Math.max(6, fontSize * 0.58 + letterSpacing);
  const maxChars = Math.max(1, Math.floor(Math.max(24, widthPx) / unit));
  return text
    .split(/\r?\n/)
    .map((paragraph) => {
      if (!paragraph.trim()) return "";
      const lines: string[] = [];
      let line = "";
      for (const word of paragraph.trim().split(/\s+/)) {
        for (const chunk of word.length > maxChars ? word.match(new RegExp(`.{1,${maxChars}}`, "g")) ?? [word] : [word]) {
          if (!line) line = chunk;
          else if (`${line} ${chunk}`.length <= maxChars) line += ` ${chunk}`;
          else {
            lines.push(line);
            line = chunk;
          }
        }
      }
      if (line) lines.push(line);
      return lines.join("\n");
    })
    .join("\n");
}

export function rgba(hex: string, alpha: number): string {
  const text = hex.trim().replace("#", "");
  const full = text.length === 3 ? text.split("").map((char) => char + char).join("") : text;
  if (!/^[0-9a-f]{6}$/i.test(full)) return `rgba(16,16,16,${clamp(alpha, 0, 1)})`;
  const r = Number.parseInt(full.slice(0, 2), 16);
  const g = Number.parseInt(full.slice(2, 4), 16);
  const b = Number.parseInt(full.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${clamp(alpha, 0, 1)})`;
}

export function isVisualOverlay(item: TimelineItem): boolean {
  return Boolean(item.text?.trim()) || Boolean(item.mediaId) || Boolean(item.shape);
}

export function allVisualLayers(project: ProjectFile): TimelineItem[] {
  return [...project.tracks.overlays, ...project.tracks.effects]
    .filter(isVisualOverlay)
    .sort((a, b) => (a.zIndex ?? 0) - (b.zIndex ?? 0) || a.startMs - b.startMs || a.id.localeCompare(b.id));
}

export function nextLayerZ(project: ProjectFile): number {
  const values = [...project.tracks.overlays, ...project.tracks.effects]
    .map((item) => item.zIndex ?? 0)
    .filter(Number.isFinite);
  return values.length ? Math.max(...values) + 1 : 1;
}

export function isItemActive(item: TimelineItem, playheadMs: number): boolean {
  return !item.hidden && item.enabled !== false && playheadMs >= item.startMs && playheadMs < item.startMs + item.durationMs;
}

export function visualItems(project: ProjectFile, playheadMs: number): TimelineItem[] {
  return allVisualLayers(project).filter((item) => isItemActive(item, playheadMs));
}

export function uid(prefix = "id"): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function even(value: number): number {
  return Math.max(2, Math.round(value / 2) * 2);
}

export const FULL_RECT: NormalizedRect = { x: 0, y: 0, w: 1, h: 1 };

export function emptyCrop(): CropConfig {
  return { gameplay: null, facecam: null };
}

export function defaultRegion() {
  return { zoom: 1, offsetX: 0, offsetY: 0, fit: "fill" as const };
}

export const LAYOUT_PRESETS: { id: LayoutPresetId; label: string; hint: string }[] = [
  { id: "gameplay-top", label: "GAMEPLAY TOP", hint: "62% gameplay · 38% facecam" },
  { id: "facecam-top", label: "FACECAM TOP", hint: "38% facecam · 62% gameplay" },
  { id: "equal", label: "EQUAL SPLIT", hint: "50 / 50" },
  { id: "gameplay-full", label: "GAMEPLAY FULL", hint: "No facecam region" },
  { id: "facecam-pip", label: "FACECAM P.I.P.", hint: "Overlay in corner" },
  { id: "facecam-full", label: "FACECAM FULL", hint: "No gameplay region" },
];

export function defaultLayout(): LayoutSettings {
  return {
    preset: "gameplay-top",
    splitRatio: 0.62,
    gap: 0,
    borderWidth: 0,
    borderColor: "#101010",
    facecamRadius: 0,
    pip: { x: 0.55, y: 0.58, w: 0.4, h: 0.225 },
    background: { type: "solid", color: "#101010", imagePath: null, blur: 20 },
    gameplay: defaultRegion(),
    facecam: defaultRegion(),
    safeArea: true,
    colorGrade: defaultVisualEffects(),
  };
}

export function applyPreset(layout: LayoutSettings, preset: LayoutPresetId): LayoutSettings {
  const next: LayoutSettings = { ...layout, preset, gameplay: { ...layout.gameplay }, facecam: { ...layout.facecam }, pip: { ...layout.pip } };
  next.gameplay.fit = "fill";
  next.facecam.fit = "fill";
  switch (preset) {
    case "gameplay-top":
      next.splitRatio = 0.62;
      break;
    case "facecam-top":
      next.splitRatio = 0.62;
      break;
    case "equal":
      next.splitRatio = 0.5;
      break;
    case "gameplay-full":
    case "facecam-pip":
    case "facecam-full":
      break;
  }
  return next;
}

export function getLayoutRegions(layout: LayoutSettings): {
  gameplay: CanvasRect | null;
  facecam: CanvasRect | null;
} {
  const { width: w, height: h } = CANVAS;
  const gap = Math.round(clamp(layout.gap, 0, 200));
  const ratio = clamp(layout.splitRatio, 0.15, 0.85);
  const available = h - gap;

  switch (layout.preset) {
    case "gameplay-top": {
      const gameplayH = even(available * ratio);
      return {
        gameplay: { x: 0, y: 0, w, h: gameplayH },
        facecam: { x: 0, y: gameplayH + gap, w, h: h - gameplayH - gap },
      };
    }
    case "facecam-top": {
      const facecamH = even(available * (1 - ratio));
      return {
        gameplay: { x: 0, y: facecamH + gap, w, h: h - facecamH - gap },
        facecam: { x: 0, y: 0, w, h: facecamH },
      };
    }
    case "equal": {
      const half = even(available / 2);
      return {
        gameplay: { x: 0, y: 0, w, h: half },
        facecam: { x: 0, y: half + gap, w, h: h - half - gap },
      };
    }
    case "gameplay-full":
      return { gameplay: { x: 0, y: 0, w, h }, facecam: null };
    case "facecam-pip":
      return {
        gameplay: { x: 0, y: 0, w, h },
        facecam: {
          x: clamp(layout.pip.x, 0, 1) * w,
          y: clamp(layout.pip.y, 0, 1) * h,
          w: clamp(layout.pip.w, 0.05, 1) * w,
          h: clamp(layout.pip.h, 0.05, 1) * h,
        },
      };
    case "facecam-full":
      return { gameplay: null, facecam: { x: 0, y: 0, w, h } };
  }
}

export function defaultCaptionStyle(): CaptionStyle {
  return {
    preset: "Gaming Bold",
    fontFamily: "Inter",
    fontSize: 72,
    fontWeight: 800,
    uppercase: true,
    color: "#FFFFFF",
    highlightColor: "#EE302F",
    outlineWidth: 7,
    outlineColor: "#101010",
    shadow: true,
    background: false,
    backgroundColor: "rgba(16,16,16,0.72)",
    textAlign: "center",
    x: 0.5,
    y: 0.8,
    maxWordsPerLine: 5,
    animation: "pop",
  };
}

export function defaultExportSettings(): ExportSettings {
  return {
    width: 1080,
    height: 1920,
    fps: 30,
    format: "mp4",
    codec: "h264",
    quality: "high",
    hardware: "auto",
    outputFolder: "",
    filename: "yt-shorts-export",
  };
}

export function createProject(name = "Untitled Short"): ProjectFile {
  const now = new Date().toISOString();
  const tracks: Record<TrackKind, TimelineItem[]> = {
    video: [],
    captions: [],
    overlays: [],
    music: [],
    sfx: [],
    effects: [],
  };
  return {
    format: PROJECT_FORMAT,
    version: PROJECT_VERSION,
    id: uid("project"),
    name,
    createdAt: now,
    modifiedAt: now,
    canvas: { width: CANVAS.width, height: CANVAS.height, fps: 30 },
    media: [],
    tracks,
    groups: [],
    markers: [],
    layout: defaultLayout(),
    captionStyle: defaultCaptionStyle(),
    captions: [],
    exportSettings: defaultExportSettings(),
  };
}

export function normalizeProject(input: unknown): ProjectFile {
  const base = createProject();
  if (!input || typeof input !== "object") return base;
  const raw = input as Partial<ProjectFile>;
  const tracks = { ...base.tracks };
  if (raw.tracks && typeof raw.tracks === "object") {
    for (const track of Object.keys(tracks) as TrackKind[]) {
      const items = raw.tracks[track];
      if (!Array.isArray(items)) continue;
      tracks[track] = items.map((source, index) => {
        const item = source as TimelineItem;
        return {
          ...item,
          hidden: item.hidden ?? item.enabled === false,
          locked: item.locked ?? false,
          zIndex: item.zIndex ?? index + 1,
          audioDucking: item.audioDucking ?? (track === "music"),
          ...(item.text?.trim() ? { textStyle: normalizeTextStyle(item.textStyle) } : {}),
          ...(item.effects ? { effects: normalizeVisualEffects(item.effects) } : {}),
        };
      });
    }
  }
  const layout: LayoutSettings = {
    ...base.layout,
    ...(raw.layout ?? {}),
    background: { ...base.layout.background, ...(raw.layout?.background ?? {}) },
    colorGrade: normalizeVisualEffects(raw.layout?.colorGrade),
  };
  for (const key of ["gameplay", "facecam"] as const) {
    layout[key] = {
      ...base.layout[key],
      ...(raw.layout?.[key] ?? {}),
      fit: raw.layout?.[key]?.fit ?? "fill",
      zoom: Math.max(1, raw.layout?.[key]?.zoom ?? 1),
    };
  }
  return {
    ...base,
    ...raw,
    format: PROJECT_FORMAT,
    version: PROJECT_VERSION,
    canvas: { ...base.canvas, ...(raw.canvas ?? {}) },
    media: Array.isArray(raw.media) ? (raw.media as MediaItem[]) : [],
    tracks,
    groups: Array.isArray(raw.groups) ? raw.groups : [],
    markers: Array.isArray(raw.markers) ? raw.markers : [],
    layout,
    captionStyle: { ...base.captionStyle, ...(raw.captionStyle ?? {}) },
    captions: Array.isArray(raw.captions) ? (raw.captions as ProjectFile["captions"]) : [],
    exportSettings: { ...base.exportSettings, ...(raw.exportSettings ?? {}) },
  };
}

export function projectDuration(project: ProjectFile | null): number {
  if (!project) return 0;
  const trackEnd = Object.values(project.tracks)
    .flat()
    .map((item) => item.startMs + item.durationMs);
  const captionEnd = project.captions.map((word) => word.endMs);
  const values = [...trackEnd, ...captionEnd];
  return values.length ? Math.max(...values) : 0;
}

export function formatTime(ms: number, withMillis = true): string {
  const safe = Math.max(0, Math.round(ms));
  const hours = Math.floor(safe / 3_600_000);
  const minutes = Math.floor((safe % 3_600_000) / 60_000);
  const seconds = Math.floor((safe % 60_000) / 1000);
  const millis = safe % 1000;
  const core = `${hours > 0 ? `${String(hours).padStart(2, "0")}:` : ""}${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  return withMillis ? `${core}.${String(millis).padStart(3, "0")}` : core;
}

export function formatShortTime(ms: number): string {
  const seconds = Math.max(0, ms) / 1000;
  return `${seconds.toFixed(2)}s`;
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

export function formatDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" });
}

export function parseRect(value: unknown): NormalizedRect | null {
  if (!value || typeof value !== "object") return null;
  const rect = value as NormalizedRect;
  if ([rect.x, rect.y, rect.w, rect.h].some((n) => typeof n !== "number" || !Number.isFinite(n))) return null;
  return {
    x: clamp(rect.x, 0, 1),
    y: clamp(rect.y, 0, 1),
    w: clamp(rect.w, 0, 1),
    h: clamp(rect.h, 0, 1),
  };
}
