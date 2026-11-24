import { useMemo, useRef, useState } from "react";
import type { CSSProperties, PointerEvent as ReactPointerEvent } from "react";
import { Copy, Flag, Magnet, Scissors, Trash2, Volume2, VolumeX, ZoomIn, ZoomOut } from "lucide-react";
import { selectedTimelineItem, useStudio } from "../../stores/studio";
import type { TimelineItem, TrackKind } from "../../types";
import { formatTime, TRACKS } from "../../utils/project";

interface DragState {
  mode: "move" | "trim-left" | "trim-right";
  id: string;
  startX: number;
  original: { startMs: number; durationMs: number; inMs: number; speed: number };
}

interface Draft {
  startMs: number;
  durationMs: number;
  inMs: number;
}

const TICK_STEPS_MS = [100, 250, 500, 1000, 2000, 5000, 10000, 30000, 60000];

export function Timeline() {
  const project = useStudio((s) => s.project);
  const playheadMs = useStudio((s) => s.playheadMs);
  const zoom = useStudio((s) => s.zoom);
  const snap = useStudio((s) => s.snap);
  const timelineHeight = useStudio((s) => s.timelineHeight);
  const selectedIds = useStudio((s) => s.selectedIds);
  const history = useStudio((s) => s.history);
  const mutedTracks = useStudio((s) => s.mutedTracks);
  const selected = useStudio(selectedTimelineItem);

  const setSelection = useStudio((s) => s.setSelection);
  const toggleSelectId = useStudio((s) => s.toggleSelectId);
  const setPlayhead = useStudio((s) => s.setPlayhead);
  const setZoom = useStudio((s) => s.setZoom);
  const setSnap = useStudio((s) => s.setSnap);
  const setTimelineHeight = useStudio((s) => s.setTimelineHeight);
  const updateClip = useStudio((s) => s.updateClip);
  const splitClipAtPlayhead = useStudio((s) => s.splitClipAtPlayhead);
  const duplicateSelected = useStudio((s) => s.duplicateSelected);
  const removeSelected = useStudio((s) => s.removeSelected);
  const addToTimeline = useStudio((s) => s.addToTimeline);
  const addMarker = useStudio((s) => s.addMarker);
  const removeMarker = useStudio((s) => s.removeMarker);
  const toggleTrackMute = useStudio((s) => s.toggleTrackMute);
  const undo = useStudio((s) => s.undo);
  const redo = useStudio((s) => s.redo);

  const scrollRef = useRef<HTMLDivElement>(null);
  const resizerRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState<DragState | null>(null);
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [scrubbing, setScrubbing] = useState(false);
  const [width, setWidth] = useState(1200);

  const pxPerMs = zoom;
  const duration = useMemo(() => {
    if (!project) return 60_000;
    const max = Object.values(project.tracks)
      .flat()
      .reduce((value, item) => Math.max(value, item.startMs + item.durationMs), 0);
    return Math.max(30_000, max + 10_000);
  }, [project]);
  const canvasWidth = Math.max(width, duration * pxPerMs + 200);

  const tickStep = TICK_STEPS_MS.find((step) => step * pxPerMs >= 78) ?? 120_000;
  const ticks: number[] = [];
  for (let ms = 0; ms <= duration; ms += tickStep) ticks.push(ms);

  const draftFor = (item: TimelineItem): Draft =>
    drafts[item.id] ?? { startMs: item.startMs, durationMs: item.durationMs, inMs: item.inMs };

  const snapValue = (value: number, excludeId: string): number => {
    if (!snap || !project) return Math.round(value);
    const thresholdMs = 9 / pxPerMs;
    const candidates: number[] = [playheadMs];
    for (const marker of project.markers ?? []) candidates.push(marker.timeMs);
    for (const item of Object.values(project.tracks).flat()) {
      if (item.id === excludeId) continue;
      const d = draftFor(item);
      candidates.push(d.startMs, d.startMs + d.durationMs);
    }
    for (const candidate of candidates) {
      if (Math.abs(candidate - value) < thresholdMs) return Math.round(candidate);
    }
    return Math.round(value / 50) * 50;
  };

  const onItemPointerDown = (event: ReactPointerEvent, item: TimelineItem, mode: DragState["mode"]) => {
    event.stopPropagation();
    if (event.shiftKey || event.ctrlKey || event.metaKey) {
      toggleSelectId(item.id);
      return;
    }
    setSelection({
      type: item.track === "video" ? "clip" : item.track === "overlays" || item.track === "effects" ? "overlay" : "audio",
      id: item.id,
    });
    setDragging({
      mode,
      id: item.id,
      startX: event.clientX,
      original: { startMs: item.startMs, durationMs: item.durationMs, inMs: item.inMs, speed: item.speed },
    });
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
  };

  const onPointerMove = (event: ReactPointerEvent) => {
    if (!dragging) return;
    const deltaMs = (event.clientX - dragging.startX) / pxPerMs;
    const original = dragging.original;
    let next: Draft;
    if (dragging.mode === "move") {
      next = {
        startMs: Math.max(0, snapValue(original.startMs + deltaMs, dragging.id)),
        durationMs: original.durationMs,
        inMs: original.inMs,
      };
    } else if (dragging.mode === "trim-left") {
      const startMs = Math.max(0, snapValue(original.startMs + deltaMs, dragging.id));
      const actualDelta = startMs - original.startMs;
      next = {
        startMs,
        durationMs: Math.max(100, original.durationMs - actualDelta),
        inMs: Math.max(0, original.inMs + actualDelta * original.speed),
      };
    } else {
      const rawEnd = original.startMs + original.durationMs + deltaMs;
      const snappedEnd = snapValue(rawEnd, dragging.id);
      next = {
        startMs: original.startMs,
        durationMs: Math.max(100, snappedEnd - original.startMs),
        inMs: original.inMs,
      };
    }
    setDrafts((current) => ({ ...current, [dragging.id]: next }));
  };

  const onPointerUp = () => {
    if (dragging && drafts[dragging.id]) {
      updateClip(dragging.id, drafts[dragging.id]);
    }
    setDragging(null);
    setDrafts({});
  };

  const beginScrub = (event: ReactPointerEvent) => {
    const rect = event.currentTarget.getBoundingClientRect();
    setPlayhead(Math.max(0, (event.clientX - rect.left) / pxPerMs));
    setScrubbing(true);
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
  };

  const moveScrub = (event: ReactPointerEvent) => {
    if (!scrubbing) return;
    const rect = event.currentTarget.getBoundingClientRect();
    setPlayhead(Math.max(0, (event.clientX - rect.left) / pxPerMs));
  };

  const beginResize = (event: ReactPointerEvent) => {
    event.preventDefault();
    const startY = event.clientY;
    const startHeight = timelineHeight;
    const target = resizerRef.current;
    target?.setPointerCapture(event.pointerId);
    const move = (moveEvent: PointerEvent) => setTimelineHeight(startHeight + startY - moveEvent.clientY);
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

  const gridStep = Math.max(40, tickStep * pxPerMs);
  const hasSelection = Boolean(selected) || selectedIds.length > 0;

  if (!project) return null;
  const markers = project.markers ?? [];

  return (
    <section className="timeline" style={{ height: timelineHeight }}>
      <div className="timeline-resizer" ref={resizerRef} onPointerDown={beginResize} />
      <div className="timeline-toolbar">
        <span className="timeline-title">Timeline</span>
        <span className="timeline-readout">{formatTime(playheadMs)} / {formatTime(Math.max(0, duration - 10_000))}</span>
        <button className="icon-btn small" title="Undo (Ctrl+Z)" disabled={!history.past.length} onClick={undo}><span style={{ fontSize: 11 }}>↶</span></button>
        <button className="icon-btn small" title="Redo (Ctrl+Y)" disabled={!history.future.length} onClick={redo}><span style={{ fontSize: 11 }}>↷</span></button>
        <button className="icon-btn small" title="Split at playhead (S)" onClick={splitClipAtPlayhead}><Scissors size={12} /></button>
        <button className="icon-btn small" title="Duplicate selected (Ctrl+D)" disabled={!hasSelection} onClick={duplicateSelected}><Copy size={12} /></button>
        <button className="icon-btn small" title="Delete selected (Delete)" disabled={!hasSelection} onClick={removeSelected}><Trash2 size={12} /></button>
        <button className="icon-btn small" title="Add marker at playhead (M)" onClick={() => addMarker()}><Flag size={12} /></button>
        <button className={`icon-btn small ${snap ? "active" : ""}`} title="Snapping" onClick={() => setSnap(!snap)}><Magnet size={12} /></button>
        <button className="icon-btn small" title="Zoom out" onClick={() => setZoom(zoom / 1.25)}><ZoomOut size={12} /></button>
        <button className="icon-btn small" title="Zoom in" onClick={() => setZoom(zoom * 1.25)}><ZoomIn size={12} /></button>
        <button className="btn btn-xs" onClick={() => setZoom(Math.max(0.02, (scrollRef.current?.clientWidth ?? 900) / Math.max(30_000, duration)))}>Fit</button>
      </div>

      <div className="timeline-body">
        <div className="track-labels">
          <div className="track-label-head" />
          {TRACKS.map((track) => {
            const muted = mutedTracks[track.id];
            return (
              <div key={track.id} className={`track-label ${muted ? "track-muted" : ""}`}>
                <span>{track.label}</span>
                <button
                  className="track-mute-btn"
                  title={muted ? `Unmute/show ${track.label}` : `Mute/hide ${track.label}`}
                  onClick={() => toggleTrackMute(track.id)}
                >
                  {muted ? <VolumeX size={10} /> : <Volume2 size={10} />}
                </button>
              </div>
            );
          })}
        </div>

        <div
          className="timeline-scroll"
          ref={scrollRef}
          onScroll={() => setWidth(scrollRef.current?.clientWidth ?? 1200)}
          onPointerMove={moveScrub}
          onPointerUp={() => setScrubbing(false)}
        >
          <div className="timeline-canvas" style={{ width: canvasWidth }}>
            <div className="ruler" onPointerDown={beginScrub}>
              {ticks.map((ms) => (
                <span key={ms} className="tick" style={{ left: ms * pxPerMs }}>{formatTime(ms, false)}</span>
              ))}
              {markers.map((marker) => (
                <div
                  key={marker.id}
                  className="timeline-marker"
                  style={{ left: marker.timeMs * pxPerMs, "--marker-color": marker.color } as CSSProperties}
                  title={`${marker.label} (${formatTime(marker.timeMs, false)}) — Click to jump, Right-click to remove`}
                  onPointerDown={(event) => {
                    event.stopPropagation();
                    setPlayhead(marker.timeMs);
                  }}
                  onContextMenu={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    removeMarker(marker.id);
                  }}
                >
                  <span>{marker.label}</span>
                </div>
              ))}
            </div>

            {TRACKS.map((track) => (
              <div
                key={track.id}
                className={`track ${mutedTracks[track.id] ? "track-muted" : ""}`}
                style={{ "--grid-step": `${gridStep}px` } as CSSProperties}
                onDragOver={(event) => event.preventDefault()}
                onDrop={(event) => {
                  event.preventDefault();
                  const mediaId = event.dataTransfer.getData("text/media-id");
                  if (!mediaId) return;
                  const rect = event.currentTarget.getBoundingClientRect();
                  addToTimeline(mediaId, track.id as TrackKind, Math.max(0, (event.clientX - rect.left) / pxPerMs));
                }}
              >
                {project.tracks[track.id].map((item) => {
                  const draft = draftFor(item);
                  const isSelected = selected?.id === item.id || selectedIds.includes(item.id);
                  const itemTypeClass =
                    track.id === "video"
                      ? ""
                      : track.id === "overlays" || track.id === "effects"
                        ? "overlay"
                        : track.id === "captions"
                          ? "caption"
                          : "audio";
                  return (
                    <div
                      key={item.id}
                      className={`timeline-item ${itemTypeClass} ${isSelected ? "selected" : ""}`}
                      style={{ left: draft.startMs * pxPerMs, width: Math.max(14, draft.durationMs * pxPerMs) }}
                      onPointerDown={(event) => onItemPointerDown(event, item, "move")}
                      onPointerMove={onPointerMove}
                      onPointerUp={onPointerUp}
                      title={`${item.label} · ${formatTime(draft.startMs)} → ${formatTime(draft.startMs + draft.durationMs)}`}
                    >
                      <span className="trim-handle left" onPointerDown={(event) => onItemPointerDown(event, item, "trim-left")} onPointerMove={onPointerMove} onPointerUp={onPointerUp} />
                      <span className="timeline-item-label">{item.label}</span>
                      {(item.keyframes ?? []).map((kf) => (
                        <span
                          key={kf.id}
                          className="timeline-kf-diamond"
                          style={{ left: Math.max(4, Math.min(draft.durationMs * pxPerMs - 6, kf.timeMs * pxPerMs)) }}
                          title={`Keyframe: ${kf.property} = ${kf.value.toFixed(2)} (${kf.easing})`}
                          onPointerDown={(event) => {
                            event.stopPropagation();
                            setPlayhead(draft.startMs + kf.timeMs);
                          }}
                        />
                      ))}
                      <span className="trim-handle right" onPointerDown={(event) => onItemPointerDown(event, item, "trim-right")} onPointerMove={onPointerMove} onPointerUp={onPointerUp} />
                    </div>
                  );
                })}
              </div>
            ))}

            <div className="playhead" style={{ left: playheadMs * pxPerMs }} />
          </div>
        </div>
      </div>
    </section>
  );
}
