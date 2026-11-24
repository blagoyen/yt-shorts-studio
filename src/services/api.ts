import { convertFileSrc, invoke } from "@tauri-apps/api/core";
import { open, save } from "@tauri-apps/plugin-dialog";
import type {
  AppInfo,
  AppSettings,
  DependencyInfo,
  DependencyReport,
  MediaMetadata,
  ProjectFile,
  ProjectSummary,
} from "../types";

export class ApiError extends Error {
  code: string;
  detail: string | null;

  constructor(message: string, code = "UNKNOWN", detail: string | null = null) {
    super(message);
    this.name = "ApiError";
    this.code = code;
    this.detail = detail;
  }
}

async function call<T>(command: string, args: Record<string, unknown> = {}): Promise<T> {
  try {
    return await invoke<T>(command, args);
  } catch (error) {
    if (error instanceof ApiError) throw error;
    const value = error as { message?: string; code?: string; detail?: string };
    throw new ApiError(
      value?.message ?? String(error),
      value?.code ?? "UNKNOWN",
      value?.detail ?? null,
    );
  }
}

export const api = {
  getSettings: () => call<AppSettings>("get_settings"),
  updateSettings: (settings: AppSettings) =>
    call<AppSettings>("update_settings", { settings }),
  getAppInfo: () => call<AppInfo>("get_app_info"),
  checkDependencies: () => call<DependencyReport>("check_dependencies"),
  mediaExists: (paths: string[]) => call<boolean[]>("media_exists", { paths }),
  listMediaInFolder: (path: string) => call<string[]>("list_media_in_folder", { path }),
  probeMedia: (path: string) => call<MediaMetadata>("probe_media", { path }),
  generateThumbnail: (path: string, timeMs: number) =>
    call<string>("generate_thumbnail", { path, timeMs }),
  generateWaveform: (path: string, bins: number) =>
    call<number[]>("generate_waveform", { path, bins }),
  saveProject: (path: string, project: ProjectFile, summary: ProjectSummary) =>
    call<ProjectSummary[]>("save_project", { path, project, summary }),
  loadProject: (path: string) => call<ProjectFile>("load_project", { path }),
  listRecentProjects: () => call<ProjectSummary[]>("list_recent_projects"),
  removeRecentProject: (path: string) =>
    call<ProjectSummary[]>("remove_recent_project", { path }),
  startRender: (project: ProjectFile, outputPath: string, renderId: string) =>
    call<string>("start_render", { project, outputPath, renderId }),
  cancelRender: (renderId: string) => call<boolean>("cancel_render", { renderId }),
  transcribeMedia: (
    jobId: string,
    mediaPath: string,
    model: string,
    language: string,
    device: string,
  ) =>
    call<string>("transcribe_media", {
      jobId,
      mediaPath,
      model,
      language,
      device,
    }),
  cancelTranscription: (jobId: string) =>
    call<boolean>("cancel_transcription", { jobId }),
  downloadWhisperModel: (model: string, modelDir: string | null) =>
    call<void>("download_whisper_model", { model, modelDir }),
  checkWhisperModel: (model: string, modelDir: string | null) =>
    call<DependencyInfo>("check_whisper_model", { model, modelDir }),
};

const VIDEO_FILTERS = [
  { name: "Videos", extensions: ["mp4", "mov", "mkv", "webm", "avi", "m4v", "flv", "wmv"] },
  { name: "All files", extensions: ["*"] },
];
const IMAGE_FILTERS = [
  { name: "Images", extensions: ["png", "jpg", "jpeg", "webp", "gif"] },
  { name: "All files", extensions: ["*"] },
];
const AUDIO_FILTERS = [
  { name: "Audio", extensions: ["mp3", "wav", "aac", "flac", "ogg", "m4a", "opus"] },
  { name: "All files", extensions: ["*"] },
];

export async function pickVideos(): Promise<string[]> {
  const result = await open({ multiple: true, filters: VIDEO_FILTERS });
  if (!result) return [];
  return Array.isArray(result) ? result : [result];
}

export async function pickImages(): Promise<string[]> {
  const result = await open({ multiple: true, filters: IMAGE_FILTERS });
  if (!result) return [];
  return Array.isArray(result) ? result : [result];
}

export async function pickAudio(): Promise<string[]> {
  const result = await open({ multiple: true, filters: AUDIO_FILTERS });
  if (!result) return [];
  return Array.isArray(result) ? result : [result];
}

export async function pickFolder(defaultPath?: string): Promise<string | null> {
  const result = await open({ directory: true, defaultPath });
  return typeof result === "string" ? result : null;
}

export async function pickProjectSavePath(defaultPath?: string, name = "Untitled Short"): Promise<string | null> {
  const result = await save({
    defaultPath: defaultPath ? `${defaultPath}\\${name}.shortsproj` : `${name}.shortsproj`,
    filters: [{ name: "YT Shorts Studio Project", extensions: ["shortsproj"] }],
  });
  return result;
}

export async function pickProjectOpenPath(): Promise<string | null> {
  const result = await open({
    filters: [{ name: "YT Shorts Studio Project", extensions: ["shortsproj", "json"] }],
  });
  return typeof result === "string" ? result : null;
}

export async function pickExportSavePath(defaultPath?: string, filename = "yt-shorts-export"): Promise<string | null> {
  const result = await save({
    defaultPath: defaultPath ? `${defaultPath}\\${filename}.mp4` : `${filename}.mp4`,
    filters: [{ name: "MP4 Video", extensions: ["mp4"] }],
  });
  return result;
}

export function assetUrl(path: string): string {
  return convertFileSrc(path);
}
