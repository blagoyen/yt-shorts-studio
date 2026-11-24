import { useEffect, useRef, useState } from "react";
import type { CSSProperties, PointerEvent as ReactPointerEvent } from "react";
import { Crop, RotateCcw, X } from "lucide-react";
import { assetUrl } from "../../services/api";
import { useStudio } from "../../stores/studio";
import type { CropConfig, NormalizedRect } from "../../types";
import { clamp, formatTime, LAYOUT_PRESETS } from "../../utils/project";

type Kind = "gameplay" | "facecam";
type Handle = "nw" | "ne" | "sw" | "se";
interface DragState {
  mode: "create" | "move" | "resize";
  kind: Kind;
  start: { x: number; y: number };
  original: NormalizedRect | null;
  handle?: Handle;
}

const PRESET_KEY = "yt-shorts-studio.crop-presets.v1";

interface SavedPreset {
  id: string;
  name: string;
  crop: CropConfig;
}

function loadPresets(): SavedPreset[] {
  try {
    const raw = localStorage.getItem(PRESET_KEY);
    return raw ? (JSON.parse(raw) as SavedPreset[]) : [];
  } catch {
    return [];
  }
}

function normalizeRect(a: { x: number; y: number }, b: { x: number; y: number }): NormalizedRect {
  return {
    x: clamp(Math.min(a.x, b.x), 0, 1),
    y: clamp(Math.min(a.y, b.y), 0, 1),
    w: clamp(Math.abs(a.x - b.x), 0.01, 1),
    h: clamp(Math.abs(a.y - b.y), 0.01, 1),
  };
}

export function LayoutSetupModal() {
  const store = useStudio();
  const project = store.project;
  const mediaItems = project?.media.filter((item) => item.kind === "video") ?? [];
  const [mediaId, setMediaId] = useState<string>("");
  const media = mediaItems.find((item) => item.id === mediaId) ?? mediaItems[0] ?? null;
  const [kind, setKind] = useState<Kind>("gameplay");
  const [draft, setDraft] = useState<CropConfig>({ gameplay: null, facecam: null });
  const draftRef = useRef<CropConfig>(draft);
  const [sourceTime, setSourceTime] = useState(0);
  const [presets, setPresets] = useState<SavedPreset[]>(loadPresets);
  const [presetName, setPresetName] = useState("");
  const drag = useRef<DragState | null>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (!media && mediaItems[0]) setMediaId(mediaItems[0].id);
  }, [media, mediaItems]);

  useEffect(() => {
    const next = media ? structuredClone(media.crop) : { gameplay: null, facecam: null };
    draftRef.current = next;
    setDraft(next);
    setSourceTime(0);
  }, [media?.id]);

  if (!project) return null;

  const pointFromEvent = (event: ReactPointerEvent): { x: number; y: number } => {
    // Crop coordinates are normalized against the *source media*, not the
    // letterboxed 16:9 frame. The stage's bounding rect already includes the
    // active region's zoom, so the visible fraction is the source fraction.
    const rect = (stageRef.current ?? frameRef.current)!.getBoundingClientRect();
    return {
      x: clamp((event.clientX - rect.left) / rect.width, 0, 1),
      y: clamp((event.clientY - rect.top) / rect.height, 0, 1),
    };
  };

  // This is the same zoom the preview and FFmpeg export use. Keeping a local
  // selector-only zoom made the drawn crop disagree with the rendered result.
  const region = project.layout[kind];
  const zoom = clamp(region.zoom, 1, 3);
  const sourceAspect = media && media.height > 0 ? media.width / media.height : 16 / 9;
  const stageStyle: CSSProperties = {
    aspectRatio: `${media?.width || 16} / ${media?.height || 9}`,
    transform: `scale(${zoom})`,
    ...(sourceAspect >= 16 / 9
      ? { width: "100%", height: "auto" }
      : { width: "auto", height: "100%" }),
  };

  const commitDraft = (next: CropConfig) => {
    draftRef.current = next;
    setDraft(next);
    if (media) store.setCropConfig(media.id, next);
  };

  const updateDraft = (recipe: (current: CropConfig) => CropConfig) => {
    // Keep the ref authoritative so pointer-up always commits the last rect,
    // even when React batches several pointer moves into one render.
    const next = recipe(draftRef.current);
    draftRef.current = next;
    setDraft(next);
  };

  const startCreate = (event: ReactPointerEvent) => {
    if (!media) return;
    const point = pointFromEvent(event);
    drag.current = { mode: "create", kind, start: point, original: null };
    updateDraft((current) => ({ ...current, [kind]: { ...point, w: 0.001, h: 0.001 } }));
    frameRef.current?.setPointerCapture(event.pointerId);
  };

  const startRectDrag = (event: ReactPointerEvent, target: Kind, mode: "move" | "resize", handle?: Handle) => {
    event.stopPropagation();
    if (!media) return;
    const rect = draft[target];
    if (!rect) return;
    setKind(target);
    drag.current = { mode, kind: target, start: pointFromEvent(event), original: { ...rect }, handle };
    frameRef.current?.setPointerCapture(event.pointerId);
  };

  const onPointerMove = (event: ReactPointerEvent) => {
    const state = drag.current;
    if (!state) return;
    const point = pointFromEvent(event);
    updateDraft((current) => {
      const next = { ...current };
      if (state.mode === "create") {
        next[state.kind] = normalizeRect(state.start, point);
        return next;
      }
      const original = state.original;
      if (!original) return current;
      if (state.mode === "move") {
        const dx = point.x - state.start.x;
        const dy = point.y - state.start.y;
        next[state.kind] = {
          ...original,
          x: clamp(original.x + dx, 0, 1 - original.w),
          y: clamp(original.y + dy, 0, 1 - original.h),
        };
        return next;
      }
      let { x, y, w, h } = original;
      const right = x + w;
      const bottom = y + h;
      if (state.handle === "nw") {
        x = clamp(point.x, 0, right - 0.01);
        y = clamp(point.y, 0, bottom - 0.01);
      } else if (state.handle === "ne") {
        w = clamp(point.x - x, 0.01, 1 - x);
        y = clamp(point.y, 0, bottom - 0.01);
        h = bottom - y;
      } else if (state.handle === "sw") {
        x = clamp(point.x, 0, right - 0.01);
        w = right - x;
        h = clamp(point.y - y, 0.01, 1 - y);
      } else {
        w = clamp(point.x - x, 0.01, 1 - x);
        h = clamp(point.y - y, 0.01, 1 - y);
      }
      next[state.kind] = { x, y, w, h };
      return next;
    });
  };

  const onPointerUp = () => {
    if (!drag.current) return;
    drag.current = null;
    commitDraft(draftRef.current);
  };

  const reset = () => {
    const empty: CropConfig = { gameplay: null, facecam: null };
    draftRef.current = empty;
    setDraft(empty);
    if (media) store.resetCrop(media.id);
  };

  const savePreset = () => {
    const name = presetName.trim() || `Layout ${presets.length + 1}`;
    const next = [...presets, { id: `preset-${Date.now()}`, name, crop: structuredClone(draft) }];
    setPresets(next);
    localStorage.setItem(PRESET_KEY, JSON.stringify(next));
    setPresetName("");
    store.notify("success", `Saved crop preset “${name}”`);
  };

  const applyPresetCrop = (preset: SavedPreset) => {
    setDraft(structuredClone(preset.crop));
    if (media) commitDraft(preset.crop);
  };

  const rectStyle = (rect: NormalizedRect): CSSProperties => ({
    left: `${rect.x * 100}%`,
    top: `${rect.y * 100}%`,
    width: `${rect.w * 100}%`,
    height: `${rect.h * 100}%`,
  });

  return (
    <div className="modal-overlay" onMouseDown={(event) => event.target === event.currentTarget && store.setModal(null)}>
      <div className="modal">
        <div className="modal-head">
          <div>
            <span className="eyebrow">Source layout</span>
            <div style={{ fontSize: 16, fontWeight: 650, marginTop: 5 }}>Select gameplay and facecam regions</div>
          </div>
          <button className="icon-btn" onClick={() => store.setModal(null)}><X size={15} /></button>
        </div>

        <div className="modal-body">
          <div className="layout-setup">
            <div>
              <div style={{ display: "flex", gap: 7, alignItems: "center", marginBottom: 10 }}>
                <select className="select" style={{ width: 200 }} value={media?.id ?? ""} onChange={(event) => setMediaId(event.target.value)}>
                  {mediaItems.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                </select>
                <span className="tiny muted mono">{media ? `${media.width}×${media.height}` : "no video"}</span>
              </div>

              <div className="source-frame" ref={frameRef} onPointerDown={startCreate} onPointerMove={onPointerMove} onPointerUp={onPointerUp}>
                <div className="source-stage" ref={stageRef} style={stageStyle}>
                  {media && (
                    <video
                      ref={videoRef}
                      src={assetUrl(media.path)}
                      style={{ width: "100%", height: "100%", objectFit: "fill" }}
                      onLoadedMetadata={(event) => {
                        event.currentTarget.currentTime = Math.min(sourceTime, Math.max(0, event.currentTarget.duration - 0.1));
                      }}
                    />
                  )}
                  {(["gameplay", "facecam"] as Kind[]).map((entry) => {
                    const rect = draft[entry];
                    if (!rect) return null;
                    return (
                      <div
                        key={entry}
                        className={`crop-rect ${entry === "facecam" ? "facecam" : ""} ${entry === kind ? "active" : ""}`}
                        style={{ ...rectStyle(rect), pointerEvents: entry === kind ? "auto" : "none" }}
                        onPointerDown={(event) => startRectDrag(event, entry, "move")}
                      >
                        <span className="crop-label">{entry === "gameplay" ? "GAMEPLAY" : "FACECAM"}</span>
                        {(["nw", "ne", "sw", "se"] as Handle[]).map((handle) => (
                          <span
                            key={handle}
                            className={`crop-handle ${handle}`}
                            onPointerDown={(event) => startRectDrag(event, entry, "resize", handle)}
                          />
                        ))}
                      </div>
                    );
                  })}
                </div>
              </div>

              <div style={{ display: "flex", gap: 7, marginTop: 10, flexWrap: "wrap" }}>
                <button className={`btn btn-sm ${kind === "gameplay" ? "btn-primary" : ""}`} onClick={() => setKind("gameplay")}>
                  <Crop size={13} /> Select gameplay
                </button>
                <button className={`btn btn-sm ${kind === "facecam" ? "btn-primary" : ""}`} onClick={() => setKind("facecam")} disabled={!media}>
                  Select facecam
                </button>
                <button className="btn btn-sm" onClick={reset}><RotateCcw size={13} /> Reset</button>
                <button className="btn btn-sm" onClick={() => media && store.applyCropToSource(media.id)} disabled={!media}>
                  Apply to all from source
                </button>
              </div>

              <div className="property-row" style={{ marginTop: 14 }}>
                <span className="field-label">{kind === "facecam" ? "Facecam" : "Gameplay"} source zoom {zoom.toFixed(1)}×</span>
                <input
                  className="range"
                  style={{ width: 180 }}
                  type="range"
                  min={1}
                  max={3}
                  step={0.1}
                  value={zoom}
                  onChange={(event) =>
                    store.updateLayout({ [kind]: { ...region, zoom: Number(event.target.value) } })
                  }
                />
              </div>
              <div className="property-row">
                <span className="field-label">Inspect frame {formatTime(sourceTime)}</span>
                <input
                  className="range"
                  style={{ width: 180 }}
                  type="range"
                  min={0}
                  max={Math.max(1, (media?.durationMs ?? 1000) / 1000)}
                  step={0.1}
                  value={sourceTime}
                  onChange={(event) => {
                    const value = Number(event.target.value);
                    setSourceTime(value);
                    if (videoRef.current) videoRef.current.currentTime = value;
                  }}
                />
              </div>
            </div>

            <div>
              <span className="section-title">Composition presets</span>
              <div className="preset-grid" style={{ marginTop: 10 }}>
                {LAYOUT_PRESETS.map((preset) => (
                  <button
                    key={preset.id}
                    className={`preset-item ${project.layout.preset === preset.id ? "active" : ""}`}
                    onClick={() => store.setLayoutPreset(preset.id)}
                  >
                    <strong>{preset.label}</strong>
                    <span>{preset.hint}</span>
                  </button>
                ))}
              </div>

              <div className="panel-divider" />
              <span className="section-title">Crop presets</span>
              <div style={{ display: "flex", gap: 6, marginTop: 9 }}>
                <input
                  className="input"
                  placeholder="Preset name"
                  value={presetName}
                  onChange={(event) => setPresetName(event.target.value)}
                />
                <button className="btn btn-sm" onClick={savePreset}>Save</button>
              </div>
              <div style={{ display: "grid", gap: 5, marginTop: 8 }}>
                {presets.length === 0 && <span className="tiny muted">No saved crop presets yet.</span>}
                {presets.map((preset) => (
                  <div key={preset.id} className="preset-item" role="button" tabIndex={0} onClick={() => applyPresetCrop(preset)}>
                    <strong>{preset.name}</strong>
                    <button
                      className="icon-btn small"
                      title="Delete preset"
                      onClick={(event) => {
                        event.stopPropagation();
                        const next = presets.filter((item) => item.id !== preset.id);
                        setPresets(next);
                        localStorage.setItem(PRESET_KEY, JSON.stringify(next));
                      }}
                    >
                      <X size={11} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="modal-foot">
          <span className="tiny muted" style={{ marginRight: "auto" }}>
            Coordinates are normalized 0–1, so the layout survives resolution changes.
          </span>
          <button className="btn btn-primary" onClick={() => store.setModal(null)}>Done</button>
        </div>
      </div>
    </div>
  );
}
