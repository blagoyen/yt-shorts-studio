import { create } from "zustand";
import {
  api,
  ApiError,
  pickAudio,
  pickFolder,
  pickImages,
  pickProjectOpenPath,
  pickProjectSavePath,
  pickVideos,
} from "../services/api";
import type {
  AlignMode,
  AppInfo,
  AppSettings,
  CaptionStyle,
  CaptionWord,
  CropConfig,
  DependencyReport,
  EasingType,
  ExportSettings,
  Keyframe,
  KeyframeProperty,
  LayerGroup,
  LayoutPresetId,
  LayoutSettings,
  MediaItem,
  ModelDownloadCompleteEvent,
  ModelDownloadJob,
  ModelDownloadProgressEvent,
  ProjectFile,
  ProjectSummary,
  RenderCompleteEvent,
  RenderJob,
  RenderProgressEvent,
  Selection,
  ShapeKind,
  ShapeStyle,
  TextStyle,
  TimelineItem,
  TimelineMarker,
  Toast,
  TrackKind,
  TranscriptionCompleteEvent,
  TranscriptionJob,
  TranscriptionProgressEvent,
  TranscriptionWord,
  VisualEffects,
} from "../types";
import {
  allVisualLayers,
  applyPreset,
  clamp,
  createProject,
  defaultShapeStyle,
  defaultTextStyle,
  defaultVisualEffects,
  emptyCrop,
  formatTime,
  nextLayerZ,
  normalizeProject,
  normalizeVisualEffects,
  projectDuration,
  uid,
} from "../utils/project";

export type ModalName =
  | "settings"
  | "export"
  | "layout"
  | "transcribe"
  | "relink"
  | "shortcuts"
  | "palette"
  | null;
export type LeftTab = "media" | "captions" | "audio" | "overlays" | "layers" | "layouts";

export type ProjectTemplateId =
  | "blank"
  | "gaming-highlight"
  | "reaction-split"
  | "meme-caption"
  | "cinematic-reel";

export function whisperModelKey(model: string, modelDir?: string | null): string {
  return `${model}::${modelDir ?? ""}`;
}

interface History {
  past: ProjectFile[];
  future: ProjectFile[];
}

export interface StudioState {
  screen: "library" | "editor";
  project: ProjectFile | null;
  projectPath: string | null;
  recent: ProjectSummary[];
  appInfo: AppInfo | null;
  settings: AppSettings | null;
  dependencies: DependencyReport | null;
  selection: Selection;
  selectedIds: string[];
  playheadMs: number;
  playing: boolean;
  zoom: number;
  snap: boolean;
  timelineHeight: number;
  leftTab: LeftTab;
  modal: ModalName;
  dirty: boolean;
  busy: string | null;
  toasts: Toast[];
  history: History;
  render: RenderJob | null;
  transcription: TranscriptionJob | null;
  modelDownload: ModelDownloadJob | null;
  modelAvailability: Record<string, boolean>;
  clipboard: TimelineItem[];
  mutedTracks: Record<TrackKind, boolean>;

  initialize: () => Promise<void>;
  setScreen: (screen: "library" | "editor") => void;
  notify: (tone: Toast["tone"], message: string, detail?: string) => void;
  dismissToast: (id: string) => void;
  setModal: (modal: ModalName) => void;
  setLeftTab: (tab: LeftTab) => void;
  setSelection: (selection: Selection) => void;
  setSelectedIds: (ids: string[]) => void;
  toggleSelectId: (id: string) => void;
  selectAllOverlays: () => void;
  setPlayhead: (ms: number) => void;
  setPlaying: (playing: boolean) => void;
  setZoom: (zoom: number) => void;
  setSnap: (snap: boolean) => void;
  setTimelineHeight: (height: number) => void;
  setBusy: (busy: string | null) => void;
  toggleTrackMute: (track: TrackKind) => void;

  startRender: (outputPath: string) => Promise<void>;
  cancelRender: () => Promise<void>;
  applyRenderProgress: (event: RenderProgressEvent) => void;
  applyRenderComplete: (event: RenderCompleteEvent) => void;
  clearRender: () => void;
  startTranscription: (mediaId: string, model: string, language?: string) => Promise<void>;
  cancelTranscription: () => Promise<void>;
  applyTranscriptionProgress: (event: TranscriptionProgressEvent) => void;
  applyTranscriptionComplete: (event: TranscriptionCompleteEvent) => void;
  clearTranscription: () => void;
  downloadWhisperModel: (model: string, modelDir?: string | null) => Promise<void>;
  checkWhisperModel: (model: string, modelDir?: string | null) => Promise<boolean>;
  applyModelDownloadProgress: (event: ModelDownloadProgressEvent) => void;
  applyModelDownloadComplete: (event: ModelDownloadCompleteEvent) => void;
  clearModelDownload: () => void;

  newProject: (name?: string, template?: ProjectTemplateId) => Promise<void>;
  openProject: () => Promise<void>;
  openProjectAt: (path: string) => Promise<void>;
  saveProject: (promptIfNeeded?: boolean) => Promise<boolean>;
  removeRecent: (path: string) => Promise<void>;
  refreshDependencies: () => Promise<void>;
  updateAppSettings: (patch: Partial<AppSettings>) => Promise<void>;

  importVideos: () => Promise<void>;
  importImages: () => Promise<void>;
  importAudio: () => Promise<void>;
  importFolder: () => Promise<void>;
  importFromYtCutter: () => Promise<void>;
  importPaths: (paths: string[]) => Promise<void>;
  setCrop: (mediaId: string, kind: "gameplay" | "facecam", rect: CropConfig["gameplay"]) => void;
  setCropConfig: (mediaId: string, crop: CropConfig) => void;
  resetCrop: (mediaId: string) => void;
  applyCropToSource: (mediaId: string) => void;

  addToTimeline: (mediaId: string, track?: TrackKind, startMs?: number) => void;
  addTextObject: (text?: string) => void;
  addShapeObject: (kind?: ShapeKind) => void;
  updateClip: (id: string, patch: Partial<TimelineItem>) => void;
  updateClipsBatch: (patches: Record<string, Partial<TimelineItem>>) => void;
  updateTextStyle: (id: string, patch: Partial<TextStyle>) => void;
  updateShapeStyle: (id: string, patch: Partial<ShapeStyle>) => void;
  updateClipEffects: (id: string, patch: Partial<VisualEffects>) => void;
  updateGlobalColorGrade: (patch: Partial<VisualEffects>) => void;
  setLayerProperty: (id: string, patch: Partial<Pick<TimelineItem, "hidden" | "locked" | "zIndex" | "label">>) => void;
  moveLayer: (id: string, direction: -1 | 1) => void;
  bringToFront: (id: string) => void;
  sendToBack: (id: string) => void;

  groupSelected: () => void;
  ungroup: (groupId: string) => void;
  setGroupProperty: (groupId: string, patch: Partial<Pick<LayerGroup, "name" | "locked" | "hidden" | "collapsed">>) => void;
  selectGroup: (groupId: string) => void;
  alignSelected: (mode: AlignMode) => void;

  addKeyframe: (itemId: string, property: KeyframeProperty, value: number, timeMs?: number, easing?: EasingType) => void;
  updateKeyframe: (itemId: string, keyframeId: string, patch: Partial<Omit<Keyframe, "id">>) => void;
  removeKeyframe: (itemId: string, keyframeId: string) => void;
  clearKeyframes: (itemId: string, property?: KeyframeProperty) => void;

  addMarker: (label?: string, color?: string) => void;
  updateMarker: (id: string, patch: Partial<Omit<TimelineMarker, "id">>) => void;
  removeMarker: (id: string) => void;

  copyCanvasObject: () => void;
  pasteCanvasObject: () => void;
  updateRegion: (which: "gameplay" | "facecam", patch: Partial<LayoutSettings["gameplay"]>) => void;
  removeClip: (id: string) => void;
  removeSelected: () => void;
  duplicateClip: (id: string) => void;
  duplicateSelected: () => void;
  splitClipAtPlayhead: () => void;
  setCaptions: (captions: CaptionWord[]) => void;
  addCaption: () => void;
  updateCaption: (id: string, patch: Partial<CaptionWord>) => void;
  removeCaption: (id: string) => void;
  relinkMedia: (mediaId: string, path: string) => Promise<void>;

  setLayoutPreset: (preset: LayoutPresetId) => void;
  updateLayout: (patch: Partial<LayoutSettings>) => void;
  updateCaptionStyle: (patch: Partial<CaptionStyle>) => void;
  updateExportSettings: (patch: Partial<ExportSettings>) => void;
  setProjectName: (name: string) => void;

  undo: () => void;
  redo: () => void;
}

function cloneProject(project: ProjectFile): ProjectFile {
  return structuredClone(project);
}

function summaryFor(project: ProjectFile, path: string): ProjectSummary {
  const thumbnail = project.media.find((item) => item.thumbnail && item.kind !== "audio")?.thumbnail ?? null;
  return {
    path,
    name: project.name,
    modifiedAt: project.modifiedAt,
    durationMs: projectDuration(project),
    mediaCount: project.media.length,
    thumbnailPath: thumbnail,
  };
}

function fileName(path: string): string {
  return path.split(/[\\/]/).pop() ?? path;
}

function kindFromName(path: string): "video" | "image" | "audio" {
  const extension = fileName(path).split(".").pop()?.toLowerCase() ?? "";
  if (["png", "jpg", "jpeg", "webp", "gif", "bmp"].includes(extension)) return "image";
  if (["mp3", "wav", "aac", "flac", "ogg", "opus", "m4a", "wma"].includes(extension)) return "audio";
  return "video";
}

function errorMessage(error: unknown): { message: string; detail?: string } {
  if (error instanceof ApiError) return { message: error.message, detail: error.detail ?? undefined };
  const value = error as { message?: string };
  return { message: value?.message ?? String(error) };
}

function selectionForTrack(track: TrackKind, id: string): Selection {
  if (track === "video") return { type: "clip", id };
  if (track === "overlays" || track === "effects") return { type: "overlay", id };
  return { type: "audio", id };
}

function findItemById(project: ProjectFile, id: string): { item: TimelineItem; track: TrackKind } | null {
  for (const track of Object.keys(project.tracks) as TrackKind[]) {
    const item = project.tracks[track].find((clip) => clip.id === id);
    if (item) return { item, track };
  }
  return null;
}

function timelineWordPositions(
  project: ProjectFile,
  mediaId: string,
  word: TranscriptionWord,
): { startMs: number; endMs: number } | null {
  const clips = project.tracks.video.filter(
    (item) => item.mediaId === mediaId && item.durationMs > 0,
  );
  if (clips.length === 0) {
    return {
      startMs: word.startMs,
      endMs: Math.max(word.startMs + 1, word.endMs),
    };
  }

  const midpoint = (word.startMs + word.endMs) / 2;
  const clip = clips.find((item) => {
    const speed = Math.max(0.25, Math.min(4, item.speed || 1));
    const sourceEnd = item.inMs + item.durationMs * speed;
    return midpoint >= item.inMs && midpoint <= sourceEnd;
  });
  if (!clip) return null;

  const speed = Math.max(0.25, Math.min(4, clip.speed || 1));
  const start = clip.startMs + Math.max(0, Math.min(clip.durationMs, (word.startMs - clip.inMs) / speed));
  const end = clip.startMs + Math.max(0, Math.min(clip.durationMs, (word.endMs - clip.inMs) / speed));
  return {
    startMs: Math.round(start),
    endMs: Math.max(Math.round(start) + 1, Math.round(end)),
  };
}

function applyTemplate(project: ProjectFile, template: ProjectTemplateId) {
  switch (template) {
    case "gaming-highlight": {
      project.layout = applyPreset(project.layout, "gameplay-top");
      project.layout.borderWidth = 3;
      project.layout.borderColor = "#E62E2D";
      project.layout.colorGrade = { ...defaultVisualEffects(), preset: "vivid", contrast: 1.16, saturation: 1.35 };
      project.tracks.overlays.push({
        id: uid("text"),
        track: "overlays",
        mediaId: null,
        label: "INSANE CLUTCH",
        startMs: 0,
        durationMs: 3000,
        inMs: 0,
        speed: 1,
        enabled: true,
        hidden: false,
        locked: false,
        zIndex: 2,
        x: 0.5,
        y: 0.14,
        width: 0.82,
        height: 0.12,
        rotation: 0,
        opacity: 1,
        text: "INSANE CLUTCH!",
        animation: "pop",
        exitAnimation: "fade-in",
        animationDurationMs: 360,
        textStyle: { ...defaultTextStyle(), fontSize: 92, color: "#FFD84D" },
      });
      break;
    }
    case "reaction-split": {
      project.layout = applyPreset(project.layout, "equal");
      project.layout.gap = 8;
      project.layout.facecamRadius = 18;
      project.tracks.overlays.push({
        id: uid("shape"),
        track: "overlays",
        mediaId: null,
        label: "Live Badge",
        startMs: 0,
        durationMs: 5000,
        inMs: 0,
        speed: 1,
        enabled: true,
        hidden: false,
        locked: false,
        zIndex: 1,
        x: 0.22,
        y: 0.08,
        width: 0.28,
        height: 0.045,
        rotation: 0,
        opacity: 1,
        shape: defaultShapeStyle("pill"),
        animation: "slide-down",
      });
      project.tracks.overlays.push({
        id: uid("text"),
        track: "overlays",
        mediaId: null,
        label: "REACTION",
        startMs: 0,
        durationMs: 5000,
        inMs: 0,
        speed: 1,
        enabled: true,
        hidden: false,
        locked: false,
        zIndex: 2,
        x: 0.22,
        y: 0.08,
        width: 0.26,
        height: 0.045,
        rotation: 0,
        opacity: 1,
        text: "LIVE REACTION",
        animation: "slide-down",
        textStyle: { ...defaultTextStyle(), fontSize: 32, outline: false, shadow: false },
      });
      break;
    }
    case "meme-caption": {
      project.layout = applyPreset(project.layout, "gameplay-full");
      project.tracks.overlays.push({
        id: uid("text"),
        track: "overlays",
        mediaId: null,
        label: "Top Caption",
        startMs: 0,
        durationMs: 6000,
        inMs: 0,
        speed: 1,
        enabled: true,
        hidden: false,
        locked: false,
        zIndex: 1,
        x: 0.5,
        y: 0.16,
        width: 0.88,
        height: 0.16,
        rotation: 0,
        opacity: 1,
        text: "WAIT FOR THE END...",
        animation: "bounce-in",
        textStyle: { ...defaultTextStyle(), fontSize: 88, background: true, backgroundColor: "#FFFFFF", backgroundOpacity: 0.95, color: "#101010", outline: false, shadow: false, padding: 24 },
      });
      break;
    }
    case "cinematic-reel": {
      project.layout = applyPreset(project.layout, "gameplay-full");
      project.layout.colorGrade = { ...defaultVisualEffects(), preset: "cinematic", brightness: -0.04, contrast: 1.22, saturation: 0.88, vignette: 0.35 };
      project.tracks.overlays.push({
        id: uid("text"),
        track: "overlays",
        mediaId: null,
        label: "Title Card",
        startMs: 0,
        durationMs: 3500,
        inMs: 0,
        speed: 1,
        enabled: true,
        hidden: false,
        locked: false,
        zIndex: 1,
        x: 0.5,
        y: 0.5,
        width: 0.8,
        height: 0.14,
        rotation: 0,
        opacity: 1,
        text: "CHAPTER ONE",
        animation: "fade-in",
        exitAnimation: "fade-in",
        animationDurationMs: 650,
        textStyle: { ...defaultTextStyle(), fontFamily: "Georgia", fontSize: 74, fontWeight: 700, letterSpacing: 6, outline: false, shadow: true, shadowBlur: 24 },
      });
      break;
    }
    default:
      break;
  }
}

export const useStudio = create<StudioState>()((set, get) => {
  const commit = (recipe: (project: ProjectFile) => void) => {
    const current = get().project;
    if (!current) return;
    const previous = current;
    const next = cloneProject(current);
    recipe(next);
    next.modifiedAt = new Date().toISOString();
    set((state) => ({
      project: next,
      dirty: true,
      history: {
        past: [...state.history.past, previous].slice(-80),
        future: [],
      },
    }));
  };

  const refreshRecent = async () => {
    try {
      set({ recent: await api.listRecentProjects() });
    } catch {
      set({ recent: [] });
    }
  };

  return {
    screen: "library",
    project: null,
    projectPath: null,
    recent: [],
    appInfo: null,
    settings: null,
    dependencies: null,
    selection: null,
    selectedIds: [],
    playheadMs: 0,
    playing: false,
    zoom: 0.12,
    snap: true,
    timelineHeight: 320,
    leftTab: "media",
    modal: null,
    dirty: false,
    busy: null,
    toasts: [],
    history: { past: [], future: [] },
    render: null,
    transcription: null,
    modelDownload: null,
    modelAvailability: {},
    clipboard: [],
    mutedTracks: { video: false, captions: false, overlays: false, music: false, sfx: false, effects: false },

    initialize: async () => {
      try {
        const [settings, appInfo, recent, dependencies] = await Promise.all([
          api.getSettings(),
          api.getAppInfo(),
          api.listRecentProjects(),
          api.checkDependencies(),
        ]);
        set({
          settings,
          appInfo,
          recent,
          dependencies,
          modelAvailability: {
            [whisperModelKey(settings.whisperModel, settings.modelStorageDir)]:
              dependencies.whisperModel.ready,
          },
        });
      } catch (error) {
        const info = errorMessage(error);
        get().notify("error", "Could not load application settings", info.detail);
      }
    },

    setScreen: (screen) => set({ screen }),
    notify: (tone, message, detail) => {
      const toast: Toast = { id: uid("toast"), tone, message, detail };
      set((state) => ({ toasts: [...state.toasts.slice(-4), toast] }));
      window.setTimeout(() => get().dismissToast(toast.id), tone === "error" ? 7000 : 3500);
    },
    dismissToast: (id) => set((state) => ({ toasts: state.toasts.filter((toast) => toast.id !== id) })),
    setModal: (modal) => set({ modal }),
    setLeftTab: (leftTab) => set({ leftTab }),

    setSelection: (selection) => {
      if (!selection) {
        set({ selection: null, selectedIds: [] });
        return;
      }
      if (selection.type === "clip" || selection.type === "overlay" || selection.type === "audio") {
        set({ selection, selectedIds: [selection.id] });
      } else if (selection.type === "group") {
        const group = get().project?.groups?.find((g) => g.id === selection.id);
        set({ selection, selectedIds: group ? [...group.itemIds] : [] });
      } else {
        set({ selection, selectedIds: [] });
      }
    },

    setSelectedIds: (ids) => {
      const unique = Array.from(new Set(ids));
      if (unique.length === 0) {
        set({ selection: null, selectedIds: [] });
        return;
      }
      const project = get().project;
      const first = project ? findItemById(project, unique[0]) : null;
      set({
        selectedIds: unique,
        selection: first ? selectionForTrack(first.track, first.item.id) : get().selection,
      });
    },

    toggleSelectId: (id) => {
      const current = get().selectedIds;
      const exists = current.includes(id);
      const next = exists ? current.filter((entry) => entry !== id) : [...current, id];
      get().setSelectedIds(next);
    },

    selectAllOverlays: () => {
      const project = get().project;
      if (!project) return;
      const ids = allVisualLayers(project)
        .filter((item) => !item.hidden && !item.locked)
        .map((item) => item.id);
      if (ids.length) {
        get().setSelectedIds(ids);
        get().notify("info", `Selected ${ids.length} layers`);
      }
    },

    setPlayhead: (ms) => set({ playheadMs: Math.max(0, ms) }),
    setPlaying: (playing) => set({ playing }),
    setZoom: (zoom) => set({ zoom: Math.min(1.5, Math.max(0.02, zoom)) }),
    setSnap: (snap) => set({ snap }),
    setTimelineHeight: (timelineHeight) => set({ timelineHeight: Math.min(620, Math.max(210, timelineHeight)) }),
    setBusy: (busy) => set({ busy }),
    toggleTrackMute: (track) =>
      set((state) => ({
        mutedTracks: { ...state.mutedTracks, [track]: !state.mutedTracks[track] },
      })),

    startRender: async (outputPath) => {
      const project = get().project;
      if (!project) return;
      const id = uid("render");
      set({
        render: {
          id,
          outputPath,
          progress: 0,
          stage: "Starting",
          elapsedMs: 0,
          etaMs: null,
          status: "running",
        },
      });
      try {
        await api.startRender(project, outputPath, id);
        get().notify("info", "Render started", outputPath);
      } catch (error) {
        const info = errorMessage(error);
        set({ render: null });
        get().notify("error", "Could not start render", info.detail ?? info.message);
      }
    },

    cancelRender: async () => {
      const job = get().render;
      if (!job || job.status !== "running") return;
      try {
        await api.cancelRender(job.id);
        set({ render: { ...job, stage: "Cancelling" } });
      } catch (error) {
        const info = errorMessage(error);
        get().notify("error", "Could not cancel render", info.detail ?? info.message);
      }
    },

    applyRenderProgress: (event) => {
      set((state) =>
        state.render?.id === event.renderId
          ? {
              render: {
                ...state.render,
                progress: event.progress,
                stage: event.stage,
                elapsedMs: event.elapsedMs,
                etaMs: event.etaMs,
              },
            }
          : {},
      );
    },

    applyRenderComplete: (event) => {
      const job = get().render;
      if (!job || job.id !== event.renderId) return;
      const status = event.success ? "done" : event.cancelled ? "cancelled" : "error";
      set({
        render: {
          ...job,
          progress: event.success ? 1 : job.progress,
          stage: status === "done" ? "Complete" : status === "cancelled" ? "Cancelled" : "Failed",
          status,
          error: event.error ?? undefined,
        },
      });
      if (event.success) get().notify("success", "Export complete", event.outputPath);
      else if (event.cancelled) get().notify("info", "Render cancelled");
      else get().notify("error", "Render failed", event.error ?? undefined);
    },

    clearRender: () => set({ render: null }),

    startTranscription: async (mediaId, model, language = "") => {
      const state = get();
      const media = state.project?.media.find((item) => item.id === mediaId);
      if (!media) return;
      if (state.transcription?.status === "running") {
        state.notify("error", "A transcription is already running");
        return;
      }
      const id = uid("transcribe");
      set({
        transcription: {
          id,
          mediaId,
          progress: 0,
          stage: "Starting",
          status: "running",
        },
      });
      try {
        await api.transcribeMedia(
          id,
          media.path,
          model || state.settings?.whisperModel || "small",
          language,
          "cpu",
        );
      } catch (error) {
        const info = errorMessage(error);
        set({ transcription: null });
        state.notify("error", "Could not start transcription", info.detail ?? info.message);
      }
    },

    cancelTranscription: async () => {
      const job = get().transcription;
      if (!job || job.status !== "running") return;
      try {
        await api.cancelTranscription(job.id);
        set({ transcription: { ...job, stage: "Cancelling" } });
      } catch (error) {
        const info = errorMessage(error);
        get().notify("error", "Could not cancel transcription", info.detail ?? info.message);
      }
    },

    applyTranscriptionProgress: (event) => {
      set((state) =>
        state.transcription?.id === event.jobId
          ? {
              transcription: {
                ...state.transcription,
                progress: event.progress,
                stage: event.stage,
              },
            }
          : {},
      );
    },

    applyTranscriptionComplete: (event) => {
      const job = get().transcription;
      if (!job || job.id !== event.jobId) return;
      if (event.success && event.result) {
        const project = get().project;
        const perLine = Math.max(1, project?.captionStyle.maxWordsPerLine ?? 5);
        const positioned = event.result.words
          .map((word) => ({
            word,
            position: project
              ? timelineWordPositions(project, job.mediaId, word)
              : { startMs: word.startMs, endMs: Math.max(word.startMs + 1, word.endMs) },
          }))
          .filter((entry) => entry.position !== null);
        const captions: CaptionWord[] = positioned.map(({ word, position }, index) => ({
          id: uid("word"),
          text: word.text,
          startMs: position!.startMs,
          endMs: position!.endMs,
          groupId: `line-${Math.floor(index / perLine)}`,
        }));
        commit((next) => {
          next.captions = captions;
        });
        set({
          transcription: {
            ...job,
            progress: 1,
            stage: "Complete",
            status: "done",
            wordCount: captions.length,
          },
        });
        const detail = `${captions.length} words imported${event.result.language ? ` · ${event.result.language}` : ""}`;
        if (captions.length === 0) {
          get().notify("error", "No words placed on the timeline", "Transcribe media that is present on a video clip.");
        } else {
          get().notify("success", "Transcription complete", detail);
        }
        return;
      }
      const status = event.cancelled ? "cancelled" : "error";
      set({
        transcription: {
          ...job,
          status,
          stage: event.cancelled ? "Cancelled" : "Failed",
          error: event.error ?? undefined,
        },
      });
      if (event.cancelled) get().notify("info", "Transcription cancelled");
      else get().notify("error", "Transcription failed", event.error ?? undefined);
    },

    clearTranscription: () => set({ transcription: null }),

    downloadWhisperModel: async (model, modelDir = null) => {
      const current = get().modelDownload;
      if (current?.status === "running" && current.model === model) {
        get().notify("error", "A model download is already running");
        return;
      }
      const directory = modelDir ?? get().settings?.modelStorageDir ?? null;
      set({
        modelDownload: {
          model,
          modelDir: directory,
          progress: 0,
          stage: "Preparing",
          status: "running",
        },
      });
      try {
        await api.downloadWhisperModel(model, directory);
      } catch (error) {
        const info = errorMessage(error);
        set({
          modelDownload: {
            model,
            modelDir: directory,
            progress: 0,
            stage: "Failed",
            status: "error",
            error: info.detail ?? info.message,
          },
        });
        get().notify("error", "Could not start model download", info.detail ?? info.message);
      }
    },

    checkWhisperModel: async (model, modelDir = null) => {
      try {
        const directory = modelDir ?? get().settings?.modelStorageDir ?? null;
        const info = await api.checkWhisperModel(model, directory);
        set((state) => ({
          modelAvailability: {
            ...state.modelAvailability,
            [whisperModelKey(model, directory)]: info.ready,
          },
        }));
        return info.ready;
      } catch {
        return false;
      }
    },

    applyModelDownloadProgress: (event) => {
      set((state) =>
        state.modelDownload?.model === event.model && state.modelDownload.status === "running"
          ? {
              modelDownload: {
                ...state.modelDownload,
                progress: event.progress,
                stage: event.stage,
              },
            }
          : {},
      );
    },

    applyModelDownloadComplete: (event) => {
      const job = get().modelDownload;
      if (!job || job.model !== event.model) return;
      const key = whisperModelKey(event.model, job.modelDir);
      set({
        modelDownload: {
          ...job,
          progress: event.success ? 1 : job.progress,
          stage: event.success ? "Download complete" : "Failed",
          status: event.success ? "done" : "error",
          error: event.error ?? undefined,
        },
        modelAvailability: {
          ...get().modelAvailability,
          [key]: event.success,
        },
      });
      if (event.success) {
        const settings = get().settings;
        if (settings?.whisperModel === event.model) {
          void api.checkDependencies().then((dependencies) => set({ dependencies })).catch(() => undefined);
        }
        get().notify("success", `${event.model.toUpperCase()} model ready`);
      } else {
        get().notify("error", "Model download failed", event.error ?? undefined);
      }
    },

    clearModelDownload: () => set({ modelDownload: null }),

    newProject: async (name = "Untitled Short", template: ProjectTemplateId = "blank") => {
      const project = createProject(name);
      project.exportSettings.outputFolder = get().appInfo?.defaultExportFolder ?? "";
      applyTemplate(project, template);
      set({
        project,
        projectPath: null,
        screen: "editor",
        selection: null,
        selectedIds: [],
        playheadMs: 0,
        playing: false,
        dirty: true,
        history: { past: [], future: [] },
      });
      get().notify("info", template === "blank" ? "New 9:16 project created" : `Created from "${name}" template`);
    },

    openProject: async () => {
      try {
        const path = await pickProjectOpenPath();
        if (!path) return;
        await get().openProjectAt(path);
      } catch (error) {
        const info = errorMessage(error);
        get().notify("error", "Could not open project", info.detail);
      }
    },

    openProjectAt: async (path) => {
      try {
        set({ busy: "Opening project…" });
        const raw = await api.loadProject(path);
        const project = normalizeProject(raw);
        const exists = await api.mediaExists(project.media.map((item) => item.path));
        project.media.forEach((item, index) => {
          item.missing = !exists[index];
        });

        let dirty = false;
        let selection: Selection = null;
        let selectedIds: string[] = [];
        const firstVideo = project.media.find((item) => item.kind === "video" && !item.missing);
        if (firstVideo && project.tracks.video.length === 0) {
          const clip: TimelineItem = {
            id: uid("clip"),
            track: "video",
            mediaId: firstVideo.id,
            label: firstVideo.name,
            startMs: 0,
            durationMs: Math.max(100, firstVideo.durationMs),
            inMs: 0,
            speed: 1,
            volume: 1,
            fadeInMs: 0,
            fadeOutMs: 0,
            enabled: true,
          };
          project.tracks.video.push(clip);
          dirty = true;
          selection = { type: "clip", id: clip.id };
          selectedIds = [clip.id];
        }

        set({
          project,
          projectPath: path,
          screen: "editor",
          selection,
          selectedIds,
          playheadMs: 0,
          playing: false,
          dirty,
          history: { past: [], future: [] },
          busy: null,
        });
        if (dirty) get().notify("info", "Added the imported video to the timeline");
        const hasMissing = project.media.some((item) => item.missing);
        if (hasMissing) {
          get().notify("error", "Some source media is missing", "Use Relink Media in the Media panel.");
        }
      } catch (error) {
        set({ busy: null });
        const info = errorMessage(error);
        get().notify("error", "Could not open project", info.detail);
      }
    },

    saveProject: async (promptIfNeeded = true) => {
      const project = get().project;
      if (!project) return false;
      let path = get().projectPath;
      try {
        if (!path) {
          if (!promptIfNeeded) return false;
          const chosen = await pickProjectSavePath(
            get().appInfo?.defaultProjectFolder,
            project.name || "Untitled Short",
          );
          if (!chosen) return false;
          path = chosen;
        }
        set({ busy: "Saving project…" });
        const recent = await api.saveProject(path, project, summaryFor(project, path));
        set({ projectPath: path, dirty: false, busy: null, recent });
        get().notify("success", `Saved ${fileName(path)}`);
        return true;
      } catch (error) {
        set({ busy: null });
        const info = errorMessage(error);
        get().notify("error", "Could not save project", info.detail);
        return false;
      }
    },

    removeRecent: async (path) => {
      try {
        set({ recent: await api.removeRecentProject(path) });
      } catch {
        await refreshRecent();
      }
    },

    refreshDependencies: async () => {
      try {
        set({ dependencies: await api.checkDependencies() });
        get().notify("success", "Dependencies checked");
      } catch (error) {
        const info = errorMessage(error);
        get().notify("error", "Dependency check failed", info.detail);
      }
    },

    updateAppSettings: async (patch) => {
      const current = get().settings;
      if (!current) return;
      const next = { ...current, ...patch };
      try {
        const saved = await api.updateSettings(next);
        const key = whisperModelKey(saved.whisperModel, saved.modelStorageDir);
        set({
          settings: saved,
          modelAvailability: {
            ...get().modelAvailability,
            [key]: get().modelAvailability[key] ?? false,
          },
        });
        void api
          .checkDependencies()
          .then((dependencies) =>
            set({
              dependencies,
              modelAvailability: {
                ...get().modelAvailability,
                [key]: dependencies.whisperModel.ready,
              },
            }),
          )
          .catch(() => undefined);
        get().notify("success", "Settings saved");
      } catch (error) {
        const info = errorMessage(error);
        get().notify("error", "Could not save settings", info.detail);
      }
    },

    importVideos: async () => {
      try {
        const paths = await pickVideos();
        await get().importPaths(paths);
      } catch (error) {
        const info = errorMessage(error);
        get().notify("error", "Video import failed", info.detail);
      }
    },

    importImages: async () => {
      try {
        const paths = await pickImages();
        await get().importPaths(paths);
      } catch (error) {
        const info = errorMessage(error);
        get().notify("error", "Image import failed", info.detail);
      }
    },

    importAudio: async () => {
      try {
        const paths = await pickAudio();
        await get().importPaths(paths);
      } catch (error) {
        const info = errorMessage(error);
        get().notify("error", "Audio import failed", info.detail);
      }
    },

    importFolder: async () => {
      try {
        const folder = await pickFolder();
        if (!folder) return;
        const paths = await api.listMediaInFolder(folder);
        await get().importPaths(paths);
      } catch (error) {
        const info = errorMessage(error);
        get().notify("error", "Folder import failed", info.detail);
      }
    },

    importFromYtCutter: async () => {
      try {
        let folder = get().settings?.ytCutterOutputFolder ?? null;
        if (!folder) {
          const picked = await pickFolder();
          if (!picked) return;
          folder = picked;
          await get().updateAppSettings({ ytCutterOutputFolder: picked });
        }
        const paths = await api.listMediaInFolder(folder);
        if (paths.length === 0) {
          get().notify("info", "No supported media found in that folder");
          return;
        }
        await get().importPaths(paths);
      } catch (error) {
        const info = errorMessage(error);
        get().notify("error", "YT Cutter import failed", info.detail);
      }
    },

    importPaths: async (paths) => {
      if (!paths.length) return;
      set({ busy: `Importing ${paths.length} file${paths.length > 1 ? "s" : ""}…` });
      const imported: MediaItem[] = [];
      for (const path of paths) {
        const kind = kindFromName(path);
        try {
          const metadata = await api.probeMedia(path);
          let thumbnail: string | null = null;
          if (kind !== "audio") {
            try {
              thumbnail = await api.generateThumbnail(path, Math.min(800, metadata.durationMs / 2));
            } catch {
              thumbnail = null;
            }
          }
          imported.push({
            id: uid("media"),
            name: metadata.name || fileName(path),
            path: metadata.path,
            kind: metadata.kind || kind,
            durationMs: metadata.durationMs || (kind === "image" ? 5000 : 0),
            width: metadata.width,
            height: metadata.height,
            fps: metadata.fps,
            hasAudio: metadata.hasAudio,
            codec: metadata.codec,
            sizeBytes: metadata.sizeBytes,
            thumbnail,
            waveform: null,
            crop: emptyCrop(),
            missing: false,
          });
        } catch (error) {
          const info = errorMessage(error);
          get().notify("error", `Could not import ${fileName(path)}`, info.detail);
        }
      }
      if (imported.length) {
        const project = get().project;
        const playhead = Math.round(get().playheadMs);
        const trackEnd = (track: TrackKind, fallback: number) =>
          Math.max(fallback, ...(project?.tracks[track] ?? []).map((item) => item.startMs + item.durationMs));
        const cursors: Record<TrackKind, number> = {
          video: trackEnd("video", 0),
          captions: 0,
          overlays: trackEnd("overlays", playhead),
          music: trackEnd("music", playhead),
          sfx: trackEnd("sfx", playhead),
          effects: trackEnd("effects", playhead),
        };
        let zCursor = project ? nextLayerZ(project) : 1;
        const timelineItems = imported.map((media) => {
          const track: TrackKind = media.kind === "audio" ? "music" : media.kind === "image" ? "overlays" : "video";
          const duration = media.kind === "image" ? 5000 : Math.max(100, media.durationMs);
          const startMs = Math.round(cursors[track]);
          cursors[track] += duration;
          const aspect = media.width > 0 && media.height > 0 ? media.width / media.height : 1;
          const imgW = 0.36;
          const imgH = clamp((imgW * 1080) / (aspect * 1920), 0.08, 0.55);
          return {
            id: uid("clip"),
            track,
            mediaId: media.id,
            label: media.name,
            startMs,
            durationMs: duration,
            inMs: 0,
            speed: 1,
            volume: 1,
            audioDucking: track === "music",
            fadeInMs: 0,
            fadeOutMs: 0,
            enabled: true,
            hidden: false,
            locked: false,
            ...(track === "overlays"
              ? { zIndex: zCursor++, x: 0.5, y: 0.5, width: imgW, height: imgH, rotation: 0, opacity: 1 }
              : {}),
          } satisfies TimelineItem;
        });
        commit((next) => {
          next.media.push(...imported);
          for (const item of timelineItems) {
            next.tracks[item.track].push(item);
            next.tracks[item.track].sort((a, b) => a.startMs - b.startMs);
          }
        });
        const firstVideo = timelineItems.find((item) => item.track === "video") ?? timelineItems[0];
        if (firstVideo) {
          set({
            playheadMs: firstVideo.startMs,
            playing: false,
            selection: selectionForTrack(firstVideo.track, firstVideo.id),
            selectedIds: [firstVideo.id],
          });
        }
        get().notify("success", `Imported ${imported.length} file${imported.length > 1 ? "s" : ""} and added to timeline`);
      }
      set({ busy: null });
    },

    setCrop: (mediaId, kind, rect) => {
      commit((project) => {
        const media = project.media.find((item) => item.id === mediaId);
        if (!media) return;
        media.crop = { ...media.crop, [kind]: rect };
      });
    },

    setCropConfig: (mediaId, crop) => {
      commit((project) => {
        const media = project.media.find((item) => item.id === mediaId);
        if (media) media.crop = structuredClone(crop);
      });
    },

    resetCrop: (mediaId) => {
      commit((project) => {
        const media = project.media.find((item) => item.id === mediaId);
        if (media) media.crop = emptyCrop();
      });
    },

    applyCropToSource: (mediaId) => {
      const source = get().project?.media.find((item) => item.id === mediaId);
      if (!source) return;
      commit((project) => {
        project.media.forEach((item) => {
          if (item.path === source.path) item.crop = structuredClone(source.crop);
        });
      });
      get().notify("success", "Crop applied to all clips from this source");
    },

    addToTimeline: (mediaId, track, startMs) => {
      const project = get().project;
      const media = project?.media.find((item) => item.id === mediaId);
      if (!project || !media) return;
      const target: TrackKind = track ?? (media.kind === "audio" ? "music" : media.kind === "image" ? "overlays" : "video");
      const items = project.tracks[target] ?? [];
      const maxEnd = items.reduce((max, item) => Math.max(max, item.startMs + item.durationMs), 0);
      const beginning = startMs ?? (target === "video" ? maxEnd : Math.round(get().playheadMs));
      const duration = media.kind === "image" ? 5000 : Math.max(100, media.durationMs);
      const aspect = media.width > 0 && media.height > 0 ? media.width / media.height : 1;
      const imgW = 0.36;
      const imgH = clamp((imgW * 1080) / (aspect * 1920), 0.08, 0.55);
      const item: TimelineItem = {
        id: uid("clip"),
        track: target,
        mediaId,
        label: media.name,
        startMs: Math.round(beginning),
        durationMs: duration,
        inMs: 0,
        speed: 1,
        volume: 1,
        audioDucking: target === "music",
        fadeInMs: 0,
        fadeOutMs: 0,
        enabled: true,
        hidden: false,
        locked: false,
        ...(target === "overlays" || target === "effects" ? { zIndex: nextLayerZ(project) } : {}),
        ...(target === "overlays" && media.kind === "image"
          ? { x: 0.5, y: 0.5, width: imgW, height: imgH, rotation: 0, opacity: 1 }
          : {}),
      };
      commit((next) => {
        next.tracks[target].push(item);
        next.tracks[target].sort((a, b) => a.startMs - b.startMs);
      });
      set({ selection: selectionForTrack(target, item.id), selectedIds: [item.id] });
    },

    addTextObject: (text = "YOUR TEXT") => {
      const project = get().project;
      if (!project) return;
      const startMs = Math.round(get().playheadMs);
      const item: TimelineItem = {
        id: uid("text"),
        track: "overlays",
        mediaId: null,
        label: text.slice(0, 24) || "New text",
        startMs,
        durationMs: 4000,
        inMs: 0,
        speed: 1,
        enabled: true,
        hidden: false,
        locked: false,
        zIndex: nextLayerZ(project),
        x: 0.5,
        y: 0.5,
        width: 0.72,
        height: 0.14,
        rotation: 0,
        opacity: 1,
        text,
        animation: "none",
        exitAnimation: "none",
        animationDurationMs: 380,
        keyframes: [],
        textStyle: defaultTextStyle(),
      };
      commit((next) => {
        next.tracks.overlays.push(item);
        next.tracks.overlays.sort((a, b) => a.startMs - b.startMs);
      });
      set({ selection: { type: "overlay", id: item.id }, selectedIds: [item.id] });
    },

    addShapeObject: (kind = "rect") => {
      const project = get().project;
      if (!project) return;
      const startMs = Math.round(get().playheadMs);
      const labelMap: Record<ShapeKind, string> = {
        rect: "Rectangle",
        circle: "Circle",
        pill: "Pill Banner",
        badge: "Callout Badge",
      };
      const dims = kind === "circle"
        ? { width: 0.28, height: 0.1575 }
        : kind === "pill"
          ? { width: 0.55, height: 0.065 }
          : { width: 0.42, height: 0.14 };
      const item: TimelineItem = {
        id: uid("shape"),
        track: "overlays",
        mediaId: null,
        label: labelMap[kind],
        startMs,
        durationMs: 4000,
        inMs: 0,
        speed: 1,
        enabled: true,
        hidden: false,
        locked: false,
        zIndex: nextLayerZ(project),
        x: 0.5,
        y: 0.5,
        ...dims,
        rotation: 0,
        opacity: 1,
        animation: "none",
        exitAnimation: "none",
        animationDurationMs: 380,
        keyframes: [],
        shape: defaultShapeStyle(kind),
      };
      commit((next) => {
        next.tracks.overlays.push(item);
        next.tracks.overlays.sort((a, b) => a.startMs - b.startMs);
      });
      set({ selection: { type: "overlay", id: item.id }, selectedIds: [item.id] });
    },

    updateTextStyle: (id, patch) => {
      commit((project) => {
        const found = findItemById(project, id);
        if (!found) return;
        found.item.textStyle = { ...defaultTextStyle(), ...(found.item.textStyle ?? {}), ...patch };
      });
    },

    updateShapeStyle: (id, patch) => {
      commit((project) => {
        const found = findItemById(project, id);
        if (!found) return;
        found.item.shape = { ...defaultShapeStyle(), ...(found.item.shape ?? {}), ...patch };
      });
    },

    updateClipEffects: (id, patch) => {
      commit((project) => {
        const found = findItemById(project, id);
        if (!found) return;
        found.item.effects = normalizeVisualEffects({ ...(found.item.effects ?? defaultVisualEffects()), ...patch });
      });
    },

    updateGlobalColorGrade: (patch) => {
      commit((project) => {
        project.layout.colorGrade = normalizeVisualEffects({
          ...(project.layout.colorGrade ?? defaultVisualEffects()),
          ...patch,
        });
      });
    },

    setLayerProperty: (id, patch) => {
      commit((project) => {
        const found = findItemById(project, id);
        if (found) Object.assign(found.item, patch);
      });
    },

    moveLayer: (id, direction) => {
      const project = get().project;
      if (!project) return;
      const layers = allVisualLayers(project);
      const index = layers.findIndex((item) => item.id === id);
      if (index < 0) return;
      const targetIndex = index + direction;
      if (targetIndex < 0 || targetIndex >= layers.length) return;
      const current = layers[index];
      const target = layers[targetIndex];
      const currentZ = current.zIndex ?? index + 1;
      const targetZ = target.zIndex ?? targetIndex + 1;
      const resolvedTargetZ = targetZ === currentZ ? currentZ + direction : targetZ;
      commit((next) => {
        const a = findItemById(next, current.id)?.item;
        const b = findItemById(next, target.id)?.item;
        if (a && b) {
          a.zIndex = resolvedTargetZ;
          b.zIndex = currentZ;
        }
      });
    },

    bringToFront: (id) => {
      const project = get().project;
      if (!project) return;
      const topZ = nextLayerZ(project);
      commit((next) => {
        const found = findItemById(next, id);
        if (found) found.item.zIndex = topZ;
      });
    },

    sendToBack: (id) => {
      const project = get().project;
      if (!project) return;
      const layers = allVisualLayers(project);
      const minZ = layers.reduce((min, item) => Math.min(min, item.zIndex ?? 0), 1);
      commit((next) => {
        const found = findItemById(next, id);
        if (found) found.item.zIndex = minZ - 1;
      });
    },

    groupSelected: () => {
      const state = get();
      const project = state.project;
      if (!project) return;
      const overlayIds = state.selectedIds.filter((id) => {
        const found = findItemById(project, id);
        return found && (found.track === "overlays" || found.track === "effects");
      });
      if (overlayIds.length < 2) {
        state.notify("info", "Select at least 2 overlay layers to group");
        return;
      }
      const groupId = uid("group");
      const groupCount = (project.groups?.length ?? 0) + 1;
      const group: LayerGroup = {
        id: groupId,
        name: `Group ${groupCount}`,
        itemIds: overlayIds,
        locked: false,
        hidden: false,
        collapsed: false,
      };
      commit((next) => {
        next.groups = (next.groups ?? []).map((g) => ({
          ...g,
          itemIds: g.itemIds.filter((id) => !overlayIds.includes(id)),
        })).filter((g) => g.itemIds.length > 0);
        next.groups.push(group);
        for (const id of overlayIds) {
          const found = findItemById(next, id);
          if (found) found.item.groupId = groupId;
        }
      });
      set({ selection: { type: "group", id: groupId }, selectedIds: overlayIds });
      state.notify("success", `Grouped ${overlayIds.length} layers`);
    },

    ungroup: (groupId) => {
      const project = get().project;
      if (!project) return;
      const group = project.groups?.find((g) => g.id === groupId);
      if (!group) return;
      const members = [...group.itemIds];
      commit((next) => {
        next.groups = (next.groups ?? []).filter((g) => g.id !== groupId);
        for (const id of members) {
          const found = findItemById(next, id);
          if (found) found.item.groupId = null;
        }
      });
      get().setSelectedIds(members);
      get().notify("info", `Ungrouped "${group.name}"`);
    },

    setGroupProperty: (groupId, patch) => {
      commit((project) => {
        const group = (project.groups ?? []).find((g) => g.id === groupId);
        if (!group) return;
        Object.assign(group, patch);
        if (patch.hidden !== undefined || patch.locked !== undefined) {
          for (const id of group.itemIds) {
            const found = findItemById(project, id);
            if (!found) continue;
            if (patch.hidden !== undefined) found.item.hidden = patch.hidden;
            if (patch.locked !== undefined) found.item.locked = patch.locked;
          }
        }
      });
    },

    selectGroup: (groupId) => {
      const group = get().project?.groups?.find((g) => g.id === groupId);
      if (!group) return;
      set({ selection: { type: "group", id: groupId }, selectedIds: [...group.itemIds] });
    },

    alignSelected: (mode) => {
      const state = get();
      const project = state.project;
      if (!project) return;
      const items = state.selectedIds
        .map((id) => findItemById(project, id)?.item)
        .filter((item): item is TimelineItem => Boolean(item && !item.locked && (item.track === "overlays" || item.track === "effects")));
      if (items.length === 0) return;

      const patches: Record<string, Partial<TimelineItem>> = {};
      if (items.length === 1) {
        const item = items[0];
        const w = item.width ?? 0.4;
        const h = item.height ?? 0.2;
        if (mode === "left") patches[item.id] = { x: w / 2 };
        if (mode === "center-h") patches[item.id] = { x: 0.5 };
        if (mode === "right") patches[item.id] = { x: 1 - w / 2 };
        if (mode === "top") patches[item.id] = { y: h / 2 };
        if (mode === "center-v") patches[item.id] = { y: 0.5 };
        if (mode === "bottom") patches[item.id] = { y: 1 - h / 2 };
      } else {
        const bounds = items.map((item) => {
          const x = item.x ?? 0.5;
          const y = item.y ?? 0.5;
          const w = item.width ?? 0.4;
          const h = item.height ?? 0.2;
          return { item, left: x - w / 2, right: x + w / 2, top: y - h / 2, bottom: y + h / 2, cx: x, cy: y, w, h };
        });
        const minL = Math.min(...bounds.map((b) => b.left));
        const maxR = Math.max(...bounds.map((b) => b.right));
        const minT = Math.min(...bounds.map((b) => b.top));
        const maxB = Math.max(...bounds.map((b) => b.bottom));
        const midX = (minL + maxR) / 2;
        const midY = (minT + maxB) / 2;

        if (mode === "left") bounds.forEach((b) => { patches[b.item.id] = { x: minL + b.w / 2 }; });
        if (mode === "right") bounds.forEach((b) => { patches[b.item.id] = { x: maxR - b.w / 2 }; });
        if (mode === "center-h") bounds.forEach((b) => { patches[b.item.id] = { x: midX }; });
        if (mode === "top") bounds.forEach((b) => { patches[b.item.id] = { y: minT + b.h / 2 }; });
        if (mode === "bottom") bounds.forEach((b) => { patches[b.item.id] = { y: maxB - b.h / 2 }; });
        if (mode === "center-v") bounds.forEach((b) => { patches[b.item.id] = { y: midY }; });
        if (mode === "distribute-h" && bounds.length >= 3) {
          const sorted = [...bounds].sort((a, b) => a.cx - b.cx);
          const first = sorted[0].cx;
          const last = sorted[sorted.length - 1].cx;
          const step = (last - first) / (sorted.length - 1);
          sorted.forEach((b, i) => { patches[b.item.id] = { x: first + step * i }; });
        }
        if (mode === "distribute-v" && bounds.length >= 3) {
          const sorted = [...bounds].sort((a, b) => a.cy - b.cy);
          const first = sorted[0].cy;
          const last = sorted[sorted.length - 1].cy;
          const step = (last - first) / (sorted.length - 1);
          sorted.forEach((b, i) => { patches[b.item.id] = { y: first + step * i }; });
        }
      }

      if (Object.keys(patches).length) {
        get().updateClipsBatch(patches);
      }
    },

    addKeyframe: (itemId, property, value, timeMs, easing = "ease-out") => {
      const state = get();
      commit((project) => {
        const found = findItemById(project, itemId);
        if (!found) return;
        const item = found.item;
        const localMs = Math.round(clamp(timeMs ?? (state.playheadMs - item.startMs), 0, item.durationMs));
        const list = item.keyframes ? [...item.keyframes] : [];
        const existingIndex = list.findIndex(
          (kf) => kf.property === property && Math.abs(kf.timeMs - localMs) <= 25,
        );
        if (existingIndex >= 0) {
          list[existingIndex] = { ...list[existingIndex], value, easing, timeMs: localMs };
        } else {
          list.push({ id: uid("kf"), timeMs: localMs, property, value, easing });
        }
        list.sort((a, b) => a.timeMs - b.timeMs);
        item.keyframes = list;
      });
    },

    updateKeyframe: (itemId, keyframeId, patch) => {
      commit((project) => {
        const found = findItemById(project, itemId);
        if (!found || !found.item.keyframes) return;
        const kf = found.item.keyframes.find((entry) => entry.id === keyframeId);
        if (kf) {
          Object.assign(kf, patch);
          found.item.keyframes.sort((a, b) => a.timeMs - b.timeMs);
        }
      });
    },

    removeKeyframe: (itemId, keyframeId) => {
      commit((project) => {
        const found = findItemById(project, itemId);
        if (!found || !found.item.keyframes) return;
        found.item.keyframes = found.item.keyframes.filter((kf) => kf.id !== keyframeId);
      });
    },

    clearKeyframes: (itemId, property) => {
      commit((project) => {
        const found = findItemById(project, itemId);
        if (!found) return;
        if (!property) found.item.keyframes = [];
        else found.item.keyframes = (found.item.keyframes ?? []).filter((kf) => kf.property !== property);
      });
    },

    addMarker: (label, color = "#E62E2D") => {
      const timeMs = Math.round(get().playheadMs);
      const count = (get().project?.markers?.length ?? 0) + 1;
      commit((project) => {
        project.markers = project.markers ?? [];
        project.markers.push({
          id: uid("marker"),
          timeMs,
          label: label ?? `M${count}`,
          color,
        });
        project.markers.sort((a, b) => a.timeMs - b.timeMs);
      });
      get().notify("info", `Marker added at ${formatTime(timeMs, false)}`);
    },

    updateMarker: (id, patch) => {
      commit((project) => {
        const marker = (project.markers ?? []).find((m) => m.id === id);
        if (marker) {
          Object.assign(marker, patch);
          project.markers?.sort((a, b) => a.timeMs - b.timeMs);
        }
      });
    },

    removeMarker: (id) => {
      commit((project) => {
        project.markers = (project.markers ?? []).filter((m) => m.id !== id);
      });
    },

    copyCanvasObject: () => {
      const state = get();
      const project = state.project;
      if (!project) return;
      const ids = state.selectedIds.length
        ? state.selectedIds
        : state.selection && ["clip", "overlay", "audio"].includes(state.selection.type)
          ? [state.selection.id]
          : [];
      if (!ids.length) return;
      const items = ids
        .map((id) => findItemById(project, id)?.item)
        .filter((item): item is TimelineItem => Boolean(item))
        .map((item) => structuredClone(item));
      if (items.length) {
        set({ clipboard: items });
        state.notify("success", items.length === 1 ? "Object copied" : `Copied ${items.length} objects`);
      }
    },

    pasteCanvasObject: () => {
      const sources = get().clipboard;
      const project = get().project;
      if (!sources.length || !project) return;
      const playhead = Math.round(get().playheadMs);
      let zCursor = nextLayerZ(project);
      const newIds: string[] = [];
      let lastSelection: Selection = null;
      const minStart = Math.min(...sources.map((s) => s.startMs));

      commit((next) => {
        for (const source of sources) {
          const track = source.track;
          const copy: TimelineItem = {
            ...structuredClone(source),
            id: uid(source.text ? "text" : source.shape ? "shape" : "clip"),
            startMs: playhead + (source.startMs - minStart),
            label: `${source.label} copy`,
            zIndex: zCursor++,
            hidden: false,
            locked: false,
            groupId: null,
            ...(source.x !== undefined ? { x: clamp(source.x + 0.02, 0.05, 0.95) } : {}),
            ...(source.y !== undefined ? { y: clamp(source.y + 0.02, 0.05, 0.95) } : {}),
          };
          next.tracks[track].push(copy);
          next.tracks[track].sort((a, b) => a.startMs - b.startMs);
          newIds.push(copy.id);
          lastSelection = selectionForTrack(track, copy.id);
        }
      });
      set({ selection: lastSelection, selectedIds: newIds });
      get().notify("success", newIds.length === 1 ? "Object pasted" : `Pasted ${newIds.length} objects`);
    },

    updateRegion: (which, patch) => {
      commit((project) => {
        const current = project.layout[which];
        project.layout[which] = {
          ...current,
          ...patch,
          zoom: Math.max(1, patch.zoom ?? current.zoom),
        };
      });
    },

    updateClip: (id, patch) => {
      commit((project) => {
        for (const track of Object.keys(project.tracks) as TrackKind[]) {
          const item = project.tracks[track].find((clip) => clip.id === id);
          if (item) {
            Object.assign(item, patch);
            project.tracks[track].sort((a, b) => a.startMs - b.startMs);
            break;
          }
        }
      });
    },

    updateClipsBatch: (patches) => {
      const ids = Object.keys(patches);
      if (!ids.length) return;
      commit((project) => {
        for (const track of Object.keys(project.tracks) as TrackKind[]) {
          let touched = false;
          for (const item of project.tracks[track]) {
            const patch = patches[item.id];
            if (patch) {
              Object.assign(item, patch);
              touched = true;
            }
          }
          if (touched) project.tracks[track].sort((a, b) => a.startMs - b.startMs);
        }
      });
    },

    removeClip: (id) => {
      commit((project) => {
        for (const track of Object.keys(project.tracks) as TrackKind[]) {
          project.tracks[track] = project.tracks[track].filter((clip) => clip.id !== id);
        }
        if (project.groups) {
          project.groups = project.groups
            .map((g) => ({ ...g, itemIds: g.itemIds.filter((itemId) => itemId !== id) }))
            .filter((g) => g.itemIds.length > 0);
        }
      });
      set((state) => {
        const nextIds = state.selectedIds.filter((entry) => entry !== id);
        return {
          selectedIds: nextIds,
          selection: state.selection && "id" in state.selection && state.selection.id === id ? null : state.selection,
        };
      });
    },

    removeSelected: () => {
      const state = get();
      const ids = state.selectedIds.length
        ? state.selectedIds
        : state.selection && ["clip", "overlay", "audio"].includes(state.selection.type)
          ? [state.selection.id]
          : [];
      if (!ids.length) return;
      const idSet = new Set(ids);
      commit((project) => {
        for (const track of Object.keys(project.tracks) as TrackKind[]) {
          project.tracks[track] = project.tracks[track].filter((clip) => !idSet.has(clip.id));
        }
        if (project.groups) {
          project.groups = project.groups
            .map((g) => ({ ...g, itemIds: g.itemIds.filter((itemId) => !idSet.has(itemId)) }))
            .filter((g) => g.itemIds.length > 0);
        }
      });
      set({ selection: null, selectedIds: [] });
    },

    duplicateClip: (id) => {
      const project = get().project;
      if (!project) return;
      const found = findItemById(project, id);
      if (!found) return;
      const copy: TimelineItem = {
        ...structuredClone(found.item),
        id: uid(found.item.text ? "text" : found.item.shape ? "shape" : "clip"),
        startMs: found.item.startMs + found.item.durationMs,
        label: `${found.item.label} copy`,
        zIndex: nextLayerZ(project),
        hidden: false,
        locked: false,
        groupId: null,
      };
      commit((next) => {
        next.tracks[found.track].push(copy);
        next.tracks[found.track].sort((a, b) => a.startMs - b.startMs);
      });
      set({ selection: selectionForTrack(found.track, copy.id), selectedIds: [copy.id] });
    },

    duplicateSelected: () => {
      const state = get();
      const project = state.project;
      if (!project) return;
      const ids = state.selectedIds.length
        ? state.selectedIds
        : state.selection && ["clip", "overlay", "audio"].includes(state.selection.type)
          ? [state.selection.id]
          : [];
      if (ids.length === 1) {
        state.duplicateClip(ids[0]);
        return;
      }
      if (!ids.length) return;
      let zCursor = nextLayerZ(project);
      const newIds: string[] = [];
      let lastSelection: Selection = null;
      commit((next) => {
        for (const id of ids) {
          const found = findItemById(next, id);
          if (!found) continue;
          const copy: TimelineItem = {
            ...structuredClone(found.item),
            id: uid(found.item.text ? "text" : found.item.shape ? "shape" : "clip"),
            label: `${found.item.label} copy`,
            zIndex: zCursor++,
            hidden: false,
            locked: false,
            groupId: null,
            ...(found.item.x !== undefined ? { x: clamp(found.item.x + 0.03, 0.05, 0.95) } : {}),
            ...(found.item.y !== undefined ? { y: clamp(found.item.y + 0.03, 0.05, 0.95) } : {}),
          };
          next.tracks[found.track].push(copy);
          next.tracks[found.track].sort((a, b) => a.startMs - b.startMs);
          newIds.push(copy.id);
          lastSelection = selectionForTrack(found.track, copy.id);
        }
      });
      set({ selection: lastSelection, selectedIds: newIds });
    },

    splitClipAtPlayhead: () => {
      const state = get();
      const playhead = Math.round(state.playheadMs);
      const project = state.project;
      if (!project) return;

      const isSplittable = (item: TimelineItem) =>
        playhead > item.startMs + 80 && playhead < item.startMs + item.durationMs - 80;

      // Prioritize currently selected clip if it sits under the playhead.
      let target: { item: TimelineItem; track: TrackKind } | null = null;
      for (const id of state.selectedIds) {
        const found = findItemById(project, id);
        if (found && isSplittable(found.item)) {
          target = found;
          break;
        }
      }
      if (!target) {
        for (const track of Object.keys(project.tracks) as TrackKind[]) {
          const clip = project.tracks[track].find(isSplittable);
          if (clip) {
            target = { item: clip, track };
            break;
          }
        }
      }
      if (!target) {
        state.notify("info", "Move the playhead over a clip to split it");
        return;
      }

      const { item: clip, track } = target;
      const leftDuration = playhead - clip.startMs;
      const speed = Math.max(0.25, Math.min(4, clip.speed || 1));
      const rightKeyframes = (clip.keyframes ?? [])
        .filter((kf) => kf.timeMs >= leftDuration)
        .map((kf) => ({ ...kf, id: uid("kf"), timeMs: kf.timeMs - leftDuration }));
      const leftKeyframes = (clip.keyframes ?? []).filter((kf) => kf.timeMs <= leftDuration);

      const right: TimelineItem = {
        ...structuredClone(clip),
        id: uid(clip.text ? "text" : clip.shape ? "shape" : "clip"),
        startMs: playhead,
        durationMs: clip.durationMs - leftDuration,
        inMs: Math.round(clip.inMs + leftDuration * speed),
        keyframes: rightKeyframes,
        groupId: null,
      };
      commit((next) => {
        const list = next.tracks[track];
        const index = list.findIndex((item) => item.id === clip.id);
        if (index < 0) return;
        list[index].durationMs = leftDuration;
        list[index].keyframes = leftKeyframes;
        list.splice(index + 1, 0, right);
      });
      set({
        selection: selectionForTrack(track, right.id),
        selectedIds: [right.id],
      });
      state.notify("success", "Clip split at playhead");
    },

    setCaptions: (captions) => commit((project) => { project.captions = captions; }),

    addCaption: () => {
      const start = Math.round(get().playheadMs);
      const word: CaptionWord = {
        id: uid("word"),
        text: "NEW WORD",
        startMs: start,
        endMs: start + 400,
        groupId: uid("group"),
      };
      commit((project) => {
        project.captions.push(word);
        project.captions.sort((a, b) => a.startMs - b.startMs);
      });
      set({ selection: { type: "caption", id: word.id }, selectedIds: [] });
    },

    updateCaption: (id, patch) => {
      commit((project) => {
        const caption = project.captions.find((word) => word.id === id);
        if (caption) Object.assign(caption, patch);
      });
    },

    removeCaption: (id) => {
      commit((project) => {
        project.captions = project.captions.filter((word) => word.id !== id);
      });
      set({ selection: null, selectedIds: [] });
    },

    relinkMedia: async (mediaId, path) => {
      try {
        const metadata = await api.probeMedia(path);
        commit((project) => {
          const media = project.media.find((item) => item.id === mediaId);
          if (media) {
            media.path = metadata.path;
            media.width = metadata.width;
            media.height = metadata.height;
            media.fps = metadata.fps;
            media.durationMs = metadata.durationMs;
            media.hasAudio = metadata.hasAudio;
            media.missing = false;
          }
        });
        get().notify("success", "Source media relinked");
      } catch (error) {
        const info = errorMessage(error);
        get().notify("error", "Could not relink media", info.detail);
      }
    },

    setLayoutPreset: (preset) => commit((project) => { project.layout = applyPreset(project.layout, preset); }),
    updateLayout: (patch) => commit((project) => { project.layout = { ...project.layout, ...patch }; }),
    updateCaptionStyle: (patch) => commit((project) => { project.captionStyle = { ...project.captionStyle, ...patch }; }),
    updateExportSettings: (patch) => commit((project) => { project.exportSettings = { ...project.exportSettings, ...patch }; }),
    setProjectName: (name) => commit((project) => { project.name = name; }),

    undo: () => {
      const state = get();
      if (!state.history.past.length || !state.project) return;
      const previous = state.history.past[state.history.past.length - 1];
      set({
        project: previous,
        history: {
          past: state.history.past.slice(0, -1),
          future: [state.project, ...state.history.future].slice(0, 80),
        },
        dirty: true,
      });
    },

    redo: () => {
      const state = get();
      if (!state.history.future.length || !state.project) return;
      const next = state.history.future[0];
      set({
        project: next,
        history: {
          past: [...state.history.past, state.project].slice(-80),
          future: state.history.future.slice(1),
        },
        dirty: true,
      });
    },
  };
});

export function selectedTimelineItem(state: StudioState): TimelineItem | null {
  if (!state.selection || (state.selection.type !== "clip" && state.selection.type !== "overlay" && state.selection.type !== "audio")) return null;
  for (const track of Object.values(state.project?.tracks ?? {})) {
    const item = track.find((clip) => clip.id === state.selection?.id);
    if (item) return item;
  }
  return null;
}

export function selectedTimelineItems(state: StudioState): TimelineItem[] {
  if (!state.project || !state.selectedIds.length) return [];
  const idSet = new Set(state.selectedIds);
  return Object.values(state.project.tracks)
    .flat()
    .filter((item) => idSet.has(item.id));
}

export function formatPlayhead(ms: number): string {
  return formatTime(ms);
}
