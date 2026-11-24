import { useEffect, useState } from "react";
import {
  AudioLines,
  Captions,
  Circle,
  Crop,
  FileImage,
  Film,
  FolderInput,
  FolderOpen,
  Layers,
  LayoutTemplate,
  Music2,
  Plus,
  Sparkles,
  Square,
  Tag,
  Trash2,
} from "lucide-react";
import { LayersPanel } from "./LayersPanel";
import { api, assetUrl, pickVideos } from "../../services/api";
import { useStudio } from "../../stores/studio";
import type { MediaItem, TrackKind } from "../../types";
import { FILTER_PRESETS, formatTime, LAYOUT_PRESETS } from "../../utils/project";

const TABS = [
  { id: "media", label: "Media", icon: Film },
  { id: "captions", label: "Text", icon: Captions },
  { id: "audio", label: "Audio", icon: Music2 },
  { id: "overlays", label: "Overlays", icon: FileImage },
  { id: "layers", label: "Layers", icon: Layers },
  { id: "layouts", label: "Layouts", icon: LayoutTemplate },
] as const;

function MediaRow({ item }: { item: MediaItem }) {
  const selection = useStudio((s) => s.selection);
  const addToTimeline = useStudio((s) => s.addToTimeline);
  const setSelection = useStudio((s) => s.setSelection);
  const setModal = useStudio((s) => s.setModal);
  const relinkMedia = useStudio((s) => s.relinkMedia);

  const selected = selection?.type === "media" && selection.id === item.id;
  const label = item.kind === "video" ? "VIDEO" : item.kind === "image" ? "IMAGE" : "AUDIO";

  const relink = async () => {
    const paths = await pickVideos();
    if (paths[0]) await relinkMedia(item.id, paths[0]);
  };

  return (
    <div className={`media-item ${selected ? "selected" : ""} ${item.missing ? "missing" : ""}`}>
      <div className="media-thumb">
        {item.thumbnail ? <img src={assetUrl(item.thumbnail)} alt="" /> : item.kind === "audio" ? <AudioLines size={16} /> : <Film size={16} />}
      </div>
      <div style={{ minWidth: 0 }}>
        <div className="media-name" title={item.path}>{item.missing ? "MISSING · " : ""}{item.name}</div>
        <div className="media-meta">
          {label} · {formatTime(item.durationMs, false)} · {item.width}×{item.height}
        </div>
        <div className="media-actions">
          <button className="btn btn-xs" onClick={() => addToTimeline(item.id)} disabled={item.missing}>
            <Plus size={11} /> Timeline
          </button>
          {item.kind === "video" && (
            <button className="btn btn-xs" onClick={() => { setSelection({ type: "media", id: item.id }); setModal("layout"); }}>
              <Crop size={11} /> Crop
            </button>
          )}
          {item.missing ? (
            <button className="btn btn-xs" onClick={relink}>Relink</button>
          ) : (
            <button className="btn btn-xs btn-quiet" onClick={() => setSelection({ type: "media", id: item.id })}>
              Select
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export function LeftPanel() {
  const project = useStudio((s) => s.project);
  const leftTab = useStudio((s) => s.leftTab);
  const selection = useStudio((s) => s.selection);
  const setLeftTab = useStudio((s) => s.setLeftTab);
  const setSelection = useStudio((s) => s.setSelection);
  const setPlayhead = useStudio((s) => s.setPlayhead);
  const setModal = useStudio((s) => s.setModal);
  const notify = useStudio((s) => s.notify);
  const importVideos = useStudio((s) => s.importVideos);
  const importImages = useStudio((s) => s.importImages);
  const importAudio = useStudio((s) => s.importAudio);
  const importFolder = useStudio((s) => s.importFolder);
  const importFromYtCutter = useStudio((s) => s.importFromYtCutter);
  const addTextObject = useStudio((s) => s.addTextObject);
  const addShapeObject = useStudio((s) => s.addShapeObject);
  const addCaption = useStudio((s) => s.addCaption);
  const updateCaption = useStudio((s) => s.updateCaption);
  const removeCaption = useStudio((s) => s.removeCaption);
  const setLayoutPreset = useStudio((s) => s.setLayoutPreset);
  const updateLayout = useStudio((s) => s.updateLayout);
  const updateGlobalColorGrade = useStudio((s) => s.updateGlobalColorGrade);

  const [waveform, setWaveform] = useState<number[] | null>(null);
  const [waveformFor, setWaveformFor] = useState<string | null>(null);

  useEffect(() => {
    setWaveform(null);
    setWaveformFor(null);
  }, [leftTab]);

  if (!project) return null;

  const videos = project.media.filter((item) => item.kind === "video");
  const images = project.media.filter((item) => item.kind === "image");
  const audio = project.media.filter((item) => item.kind === "audio");

  const showWaveform = async (item: MediaItem) => {
    setSelection({ type: "media", id: item.id });
    if (waveformFor === item.id && waveform) return;
    try {
      const peaks = await api.generateWaveform(item.path, 220);
      setWaveform(peaks);
      setWaveformFor(item.id);
    } catch (error) {
      notify("error", "No waveform available", error instanceof Error ? error.message : String(error));
    }
  };

  return (
    <aside className="left-panel">
      <div className="panel-tabs">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            className={`panel-tab ${leftTab === tab.id ? "active" : ""}`}
            onClick={() => setLeftTab(tab.id)}
            title={tab.label}
          >
            <tab.icon size={12} style={{ verticalAlign: -2, marginRight: 4 }} />
            {tab.label}
          </button>
        ))}
      </div>

      <div className="panel-body">
        {leftTab === "media" && (
          <>
            <div className="panel-section">
              <span className="section-title">Import</span>
              <div className="import-grid" style={{ marginTop: 10 }}>
                <button className="btn btn-primary" onClick={importVideos}><Film size={13} /> Videos</button>
                <button className="btn" onClick={importImages}><FileImage size={13} /> Images</button>
                <button className="btn" onClick={importAudio}><Music2 size={13} /> Audio</button>
                <button className="btn" onClick={importFolder}><FolderOpen size={13} /> Folder</button>
              </div>
              <button className="btn" style={{ width: "100%" }} onClick={importFromYtCutter}>
                <FolderInput size={13} /> Import from YT Cutter
              </button>
            </div>

            <div className="panel-section">
              <div className="panel-section-head">
                <span className="section-title">Project media</span>
                <span className="tiny muted">{project.media.length}</span>
              </div>
              <div className="media-list" onDragStart={(event) => event.dataTransfer.setData("text/media-id", "")}>
                {project.media.length === 0 && <div className="tiny muted">No media yet. Import a gaming clip to begin.</div>}
                {project.media.map((item) => (
                  <div key={item.id} draggable onDragStart={(event) => event.dataTransfer.setData("text/media-id", item.id)}>
                    <MediaRow item={item} />
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        {leftTab === "captions" && (
          <>
            <div className="panel-section">
              <span className="section-title">Text & captions</span>
              <p className="tiny muted" style={{ lineHeight: 1.6 }}>
                Add animated text layers or generate word-level Whisper captions locally.
              </p>
              <button className="btn btn-primary" style={{ width: "100%", marginTop: 8 }} onClick={() => addTextObject()}>
                <Plus size={13} /> Add text
              </button>
              <button className="btn" style={{ width: "100%", marginTop: 6 }} onClick={addCaption}>
                <Plus size={13} /> Add caption word
              </button>
              <button className="btn" style={{ width: "100%", marginTop: 6 }} onClick={() => setModal("transcribe")}>
                <Sparkles size={13} /> Transcribe media
              </button>
              <button className="btn" style={{ width: "100%", marginTop: 6 }} onClick={() => setModal("settings")}>
                Set up local transcription
              </button>
            </div>

            <div className="panel-section">
              <div className="panel-section-head">
                <span className="section-title">Transcript</span>
                <span className="tiny muted">{project.captions.length} words</span>
              </div>
              <div className="media-list">
                {project.captions.length === 0 && <div className="tiny muted">No captions yet.</div>}
                {project.captions.map((word) => {
                  const active = selection?.type === "caption" && selection.id === word.id;
                  return (
                    <div
                      key={word.id}
                      className={`preset-item ${active ? "active" : ""}`}
                      onClick={() => { setSelection({ type: "caption", id: word.id }); setPlayhead(word.startMs); }}
                    >
                      <div style={{ minWidth: 0 }}>
                        <input
                          className="input"
                          style={{ height: 28, marginBottom: 5 }}
                          value={word.text}
                          onChange={(event) => updateCaption(word.id, { text: event.target.value })}
                        />
                        <span className="tiny muted mono">{formatTime(word.startMs)} → {formatTime(word.endMs)}</span>
                      </div>
                      <button className="icon-btn small" onClick={(event) => { event.stopPropagation(); removeCaption(word.id); }} title="Delete word">
                        <Trash2 size={11} />
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          </>
        )}

        {leftTab === "audio" && (
          <>
            <div className="panel-section">
              <span className="section-title">Music & sound effects</span>
              <div className="import-grid" style={{ marginTop: 10 }}>
                <button className="btn btn-primary" onClick={importAudio}><Music2 size={13} /> Import audio</button>
                <button className="btn" onClick={importFolder}><FolderOpen size={13} /> Folder</button>
              </div>
              <p className="tiny muted">Music auto-ducks under video speech. Toggle ducking per clip in the Inspector.</p>
            </div>
            <div className="panel-section">
              <span className="section-title">Audio library</span>
              <div className="media-list" style={{ marginTop: 10 }}>
                {audio.length === 0 && <div className="tiny muted">No audio imported.</div>}
                {audio.map((item) => (
                  <MediaRow key={item.id} item={item} />
                ))}
              </div>
            </div>
            {waveform && (
              <div className="panel-section">
                <span className="section-title">Waveform · {audio.find((item) => item.id === waveformFor)?.name}</span>
                <div style={{ display: "flex", alignItems: "flex-end", gap: 1, height: 66, marginTop: 10, background: "var(--surface-2)", border: "1px solid var(--border)", padding: 4 }}>
                  {waveform.map((peak, index) => (
                    <span key={index} style={{ flex: 1, height: `${Math.max(2, peak * 100)}%`, background: "var(--accent)", opacity: 0.8 }} />
                  ))}
                </div>
              </div>
            )}
            {audio.map((item) => (
              <button key={`wf-${item.id}`} className="btn btn-sm" style={{ marginTop: 5, width: "100%" }} onClick={() => showWaveform(item)}>
                <AudioLines size={12} /> Waveform · {item.name}
              </button>
            ))}
          </>
        )}

        {leftTab === "overlays" && (
          <>
            <div className="panel-section">
              <span className="section-title">Shapes & callouts</span>
              <div className="import-grid" style={{ marginTop: 10 }}>
                <button className="btn btn-sm" onClick={() => addShapeObject("rect")}><Square size={12} /> Rectangle</button>
                <button className="btn btn-sm" onClick={() => addShapeObject("circle")}><Circle size={12} /> Circle</button>
                <button className="btn btn-sm" onClick={() => addShapeObject("pill")}><Tag size={12} /> Pill bar</button>
                <button className="btn btn-sm" onClick={() => addShapeObject("badge")}><Sparkles size={12} /> Badge</button>
              </div>
            </div>

            <div className="panel-section">
              <span className="section-title">Images, memes & GIFs</span>
              <div className="import-grid" style={{ marginTop: 10 }}>
                <button className="btn btn-primary" onClick={importImages}><FileImage size={13} /> Import images</button>
                <button className="btn" onClick={importFolder}><FolderOpen size={13} /> Folder</button>
              </div>
              <button className="btn" style={{ width: "100%", marginTop: 8 }} onClick={() => addTextObject()}>
                <Plus size={13} /> Add text object
              </button>
            </div>
            <div className="panel-section">
              <span className="section-title">Image library</span>
              <div className="media-list" style={{ marginTop: 10 }}>
                {images.length === 0 && <div className="tiny muted">No images imported.</div>}
                {images.map((item) => <MediaRow key={item.id} item={item} />)}
              </div>
            </div>
          </>
        )}

        {leftTab === "layers" && <LayersPanel />}

        {leftTab === "layouts" && (
          <>
            <div className="panel-section">
              <span className="section-title">Layout preset</span>
              <div className="preset-grid" style={{ marginTop: 10 }}>
                {LAYOUT_PRESETS.map((preset) => (
                  <button
                    key={preset.id}
                    className={`preset-item ${project.layout.preset === preset.id ? "active" : ""}`}
                    onClick={() => setLayoutPreset(preset.id)}
                  >
                    <strong>{preset.label}</strong>
                    <span>{preset.hint}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="panel-section">
              <span className="section-title">Color grade look</span>
              <div className="import-grid" style={{ marginTop: 10 }}>
                {FILTER_PRESETS.map((preset) => (
                  <button
                    key={preset.id}
                    className={`btn btn-xs ${(project.layout.colorGrade?.preset ?? "none") === preset.id ? "btn-primary" : ""}`}
                    onClick={() => updateGlobalColorGrade({ ...preset.effects, preset: preset.id })}
                  >
                    {preset.name}
                  </button>
                ))}
              </div>
            </div>

            <div className="panel-section">
              <span className="section-title">Composition</span>
              <div className="property-row" style={{ marginTop: 10 }}>
                <span className="field-label">Gameplay split</span>
                <span className="mono">{Math.round(project.layout.splitRatio * 100)}%</span>
              </div>
              <input
                className="range"
                type="range"
                min={0.15}
                max={0.85}
                step={0.01}
                value={project.layout.splitRatio}
                onChange={(event) => updateLayout({ splitRatio: Number(event.target.value) })}
              />
              <div className="property-row">
                <span className="field-label">Gap</span>
                <span className="mono">{project.layout.gap}px</span>
              </div>
              <input className="range" type="range" min={0} max={80} value={project.layout.gap} onChange={(event) => updateLayout({ gap: Number(event.target.value) })} />
              <div className="property-row">
                <span className="field-label">Border</span>
                <span className="mono">{project.layout.borderWidth}px</span>
              </div>
              <input className="range" type="range" min={0} max={16} value={project.layout.borderWidth} onChange={(event) => updateLayout({ borderWidth: Number(event.target.value) })} />
              <div className="property-row">
                <span className="field-label">Facecam corners</span>
                <span className="mono">{project.layout.facecamRadius}px</span>
              </div>
              <input className="range" type="range" min={0} max={80} value={project.layout.facecamRadius} onChange={(event) => updateLayout({ facecamRadius: Number(event.target.value) })} />
              <div className="property-row">
                <span className="field-label">Safe-area guide</span>
                <button className={`btn btn-xs ${project.layout.safeArea ? "btn-primary" : ""}`} onClick={() => updateLayout({ safeArea: !project.layout.safeArea })}>
                  {project.layout.safeArea ? "ON" : "OFF"}
                </button>
              </div>
            </div>

            <div className="panel-section">
              <span className="section-title">Gameplay / facecam crop</span>
              <div className="preset-grid" style={{ marginTop: 9 }}>
                {videos.map((item) => (
                  <button key={item.id} className="preset-item" onClick={() => { setSelection({ type: "media", id: item.id }); setModal("layout"); }}>
                    <strong>{item.name}</strong>
                    <span>{item.crop.gameplay ? "Crop set" : "Full frame"}</span>
                  </button>
                ))}
                {videos.length === 0 && <span className="tiny muted">Import a video to set regions.</span>}
              </div>
              <button className="btn btn-sm" style={{ width: "100%", marginTop: 8 }} onClick={() => setModal("layout")}>
                Open region selector
              </button>
            </div>
          </>
        )}
      </div>
    </aside>
  );
}

export function trackForMedia(item: MediaItem): TrackKind {
  return item.kind === "audio" ? "music" : item.kind === "image" ? "overlays" : "video";
}
