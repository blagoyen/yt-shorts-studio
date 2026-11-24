import { useEffect, useState } from "react";
import { RefreshCw, X } from "lucide-react";
import { ModelDownloadPanel } from "./ModelDownloadPanel";
import { useStudio } from "../stores/studio";
import type { AppSettings } from "../types";

const SECTIONS = ["General", "Video", "AI captions", "Dependencies"] as const;
type Section = (typeof SECTIONS)[number];

function DependencyRow({ label, ready, detail }: { label: string; ready: boolean; detail: string | null }) {
  return (
    <div className="dependency-row">
      <div>
        <div className="dependency-name">{label}</div>
        <div className="dependency-path">{detail ?? "Not detected"}</div>
      </div>
      <span className={`status-pill ${ready ? "ok" : "warn"}`}>{ready ? "READY" : "MISSING"}</span>
    </div>
  );
}

export function SettingsDrawer() {
  const store = useStudio();
  const [section, setSection] = useState<Section>("General");
  const [draft, setDraft] = useState<AppSettings | null>(store.settings);

  useEffect(() => setDraft(store.settings), [store.settings]);

  if (!draft || !store.settings || store.modal !== "settings") return null;

  const patch = (value: Partial<AppSettings>) => setDraft({ ...draft, ...value });
  const deps = store.dependencies;

  return (
    <div className="modal-overlay" onMouseDown={(event) => event.target === event.currentTarget && store.setModal(null)}>
      <div className="modal" style={{ width: "min(860px, 96vw)" }}>
        <div className="modal-head">
          <div>
            <span className="eyebrow">Application</span>
            <div style={{ fontSize: 16, fontWeight: 650, marginTop: 5 }}>Settings</div>
          </div>
          <button className="icon-btn" onClick={() => store.setModal(null)}><X size={15} /></button>
        </div>
        <div className="modal-body">
          <div className="settings-grid">
            <nav className="settings-nav">
              {SECTIONS.map((item) => (
                <button key={item} className={section === item ? "active" : ""} onClick={() => setSection(item)}>{item}</button>
              ))}
            </nav>
            <div>
              {section === "General" && (
                <>
                  <div className="property-group">
                    <span className="field-label">Default project folder</span>
                    <input className="input" value={draft.defaultProjectFolder ?? ""} placeholder={store.appInfo?.defaultProjectFolder ?? ""} onChange={(event) => patch({ defaultProjectFolder: event.target.value || null })} />
                  </div>
                  <div className="property-group">
                    <span className="field-label">Default export folder</span>
                    <input className="input" value={draft.defaultExportFolder ?? ""} placeholder={store.appInfo?.defaultExportFolder ?? ""} onChange={(event) => patch({ defaultExportFolder: event.target.value || null })} />
                  </div>
                  <div className="property-group">
                    <span className="field-label">YT Cutter output folder</span>
                    <input className="input" value={draft.ytCutterOutputFolder ?? ""} placeholder="Folder containing downloaded clips" onChange={(event) => patch({ ytCutterOutputFolder: event.target.value || null })} />
                  </div>
                  <div className="property-group">
                    <div className="property-row">
                      <span className="field-label">Autosave interval</span>
                      <span className="mono">{draft.autosaveIntervalSeconds}s</span>
                    </div>
                    <input className="range" type="range" min={10} max={300} step={5} value={draft.autosaveIntervalSeconds} onChange={(event) => patch({ autosaveIntervalSeconds: Number(event.target.value) })} />
                  </div>
                  <div className="property-group">
                    <span className="field-label">Theme</span>
                    <select className="select" value={draft.theme} onChange={(event) => patch({ theme: event.target.value as AppSettings["theme"] })}>
                      <option value="light">Light · YT Cutter</option>
                      <option value="dark">Dark</option>
                    </select>
                  </div>
                </>
              )}

              {section === "Video" && (
                <>
                  <div className="property-group">
                    <span className="field-label">Default resolution</span>
                    <select className="select" defaultValue="1080x1920">
                      <option value="1080x1920">1080 × 1920 · 9:16</option>
                    </select>
                  </div>
                  <div className="property-group">
                    <span className="field-label">Hardware acceleration</span>
                    <select className="select" value={draft.hardwareAcceleration} onChange={(event) => patch({ hardwareAcceleration: event.target.value as AppSettings["hardwareAcceleration"] })}>
                      <option value="auto">Automatic</option>
                      <option value="software">Software only</option>
                      <option value="nvenc">NVIDIA NVENC</option>
                      <option value="qsv">Intel Quick Sync</option>
                      <option value="amf">AMD AMF</option>
                    </select>
                  </div>
                  <div className="property-group">
                    <span className="field-label">FFmpeg path (optional)</span>
                    <input className="input" value={draft.ffmpegPath ?? ""} placeholder="Bundled binary is used by default" onChange={(event) => patch({ ffmpegPath: event.target.value || null })} />
                  </div>
                  <div className="property-group">
                    <span className="field-label">FFprobe path (optional)</span>
                    <input className="input" value={draft.ffprobePath ?? ""} placeholder="Bundled binary is used by default" onChange={(event) => patch({ ffprobePath: event.target.value || null })} />
                  </div>
                </>
              )}

              {section === "AI captions" && (
                <>
                  <div className="property-group">
                    <span className="field-label">Whisper model</span>
                    <select className="select" value={draft.whisperModel} onChange={(event) => patch({ whisperModel: event.target.value })}>
                      {["tiny", "base", "small", "medium", "large"].map((model) => <option key={model} value={model}>{model.toUpperCase()}</option>)}
                    </select>
                    <p className="tiny muted" style={{ marginTop: 6 }}>Small is the recommended default. Models download locally on first use.</p>
                  </div>
                  <div className="property-group">
                    <span className="field-label">Model storage directory</span>
                    <input className="input" value={draft.modelStorageDir ?? ""} placeholder="resources/models" onChange={(event) => patch({ modelStorageDir: event.target.value || null })} />
                  </div>
                  <ModelDownloadPanel model={draft.whisperModel} modelDir={draft.modelStorageDir} />
                </>
              )}

              {section === "Dependencies" && (
                <>
                  <div className="panel-section-head">
                    <span className="section-title">Dependency status</span>
                    <button className="btn btn-sm" onClick={store.refreshDependencies}><RefreshCw size={12} /> Check</button>
                  </div>
                  <div className="dependency-list">
                    <DependencyRow label="FFmpeg" ready={deps?.ffmpeg.ready ?? false} detail={deps?.ffmpeg.version ? `${deps.ffmpeg.version} · ${deps.ffmpeg.source}` : deps?.ffmpeg.path ?? null} />
                    <DependencyRow label="FFprobe" ready={deps?.ffprobe.ready ?? false} detail={deps?.ffprobe.version ? `${deps.ffprobe.version} · ${deps.ffprobe.source}` : deps?.ffprobe.path ?? null} />
                    <DependencyRow label="Faster-Whisper sidecar" ready={deps?.pythonSidecar.ready ?? false} detail={deps?.pythonSidecar.path ?? null} />
                    <DependencyRow label="Whisper model" ready={deps?.whisperModel.ready ?? false} detail={deps?.whisperModel.path ?? null} />
                    <DependencyRow label="GPU acceleration" ready={deps?.gpuAcceleration.ready ?? false} detail={deps?.gpuAcceleration.path ?? null} />
                  </div>
                  <p className="tiny muted" style={{ marginTop: 12 }}>
                    FFmpeg and FFprobe are bundled with the app. CPU rendering is always available as a fallback.
                  </p>
                </>
              )}
            </div>
          </div>
        </div>
        <div className="modal-foot">
          <button className="btn" onClick={() => store.setModal(null)}>Cancel</button>
          <button className="btn btn-primary" onClick={() => { void store.updateAppSettings(draft); store.setModal(null); }}>Save settings</button>
        </div>
      </div>
    </div>
  );
}
