import { useEffect, useMemo } from "react";
import { LayoutTemplate, Pause, Play, SkipBack, SkipForward } from "lucide-react";
import { useStudio } from "../../stores/studio";
import { formatTime, projectDuration } from "../../utils/project";
import { VerticalCanvas } from "./VerticalCanvas";

export function PreviewPanel() {
  const project = useStudio((s) => s.project);
  const playheadMs = useStudio((s) => s.playheadMs);
  const playing = useStudio((s) => s.playing);
  const previewQuality = useStudio((s) => s.settings?.previewQuality ?? "medium");
  const updateAppSettings = useStudio((s) => s.updateAppSettings);
  const setModal = useStudio((s) => s.setModal);
  const setPlayhead = useStudio((s) => s.setPlayhead);
  const setPlaying = useStudio((s) => s.setPlaying);

  const duration = projectDuration(project);
  const frameMs = 1000 / (project?.canvas.fps || 30);

  const hasVideo = useMemo(
    () =>
      !!project?.tracks.video.some(
        (clip) => !clip.hidden && playheadMs >= clip.startMs && playheadMs < clip.startMs + clip.durationMs,
      ),
    [project?.tracks.video, playheadMs],
  );

  useEffect(() => {
    if (!playing || !project || hasVideo) return;
    let last = performance.now();
    let frame = 0;
    const tick = (now: number) => {
      const delta = now - last;
      last = now;
      const next = useStudio.getState().playheadMs + delta;
      if (next >= duration) {
        useStudio.getState().setPlaying(false);
        useStudio.getState().setPlayhead(duration);
        return;
      }
      useStudio.getState().setPlayhead(next);
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [playing, hasVideo, duration, project]);

  if (!project) return null;

  return (
    <section className="preview-panel">
      <div className="preview-head">
        <span className="section-title">9:16 composition preview</span>
        <div style={{ display: "flex", gap: 7, alignItems: "center" }}>
          <select
            className="select"
            style={{ width: 112, height: 28, fontSize: 10 }}
            value={previewQuality}
            onChange={(event) =>
              void updateAppSettings({ previewQuality: event.target.value as "low" | "medium" | "high" })
            }
            title="Preview quality"
          >
            <option value="low">Quality · low</option>
            <option value="medium">Quality · med</option>
            <option value="high">Quality · high</option>
          </select>
          <button className="btn btn-sm btn-pill" onClick={() => setModal("layout")}>
            <LayoutTemplate size={12} /> Layout
          </button>
        </div>
      </div>

      <div className="preview-stage">
        <VerticalCanvas
          project={project}
          playheadMs={playheadMs}
          playing={playing}
          onTimeChange={setPlayhead}
        />
      </div>

      <div className="preview-transport">
        <div className="transport-row">
          <button
            className="play-btn-circle"
            title="Play / pause (Space)"
            onClick={() => {
              if (playheadMs >= duration && duration > 0) setPlayhead(0);
              setPlaying(!playing);
            }}
          >
            {playing ? <Pause size={15} /> : <Play size={15} style={{ marginLeft: 2 }} />}
          </button>
          <button className="icon-btn icon-btn-round small" title="Previous frame (Left)" onClick={() => setPlayhead(playheadMs - frameMs)}>
            <SkipBack size={12} />
          </button>
          <button className="icon-btn icon-btn-round small" title="Next frame (Right)" onClick={() => setPlayhead(playheadMs + frameMs)}>
            <SkipForward size={12} />
          </button>
          <div className="transport-time-pill">
            <strong>{formatTime(playheadMs)}</strong>
            <span className="muted"> / {formatTime(duration)}</span>
          </div>
          <input
            className="scrub"
            type="range"
            min={0}
            max={Math.max(1, duration)}
            step={1}
            value={Math.min(playheadMs, Math.max(1, duration))}
            onChange={(event) => setPlayhead(Number(event.target.value))}
            style={{ appearance: "none" }}
          />
        </div>
        <div className="transport-hint">
          <span>Canvas 1080 × 1920 · {project.canvas.fps} FPS</span>
          <span><kbd className="kbd">Space</kbd> Play · <kbd className="kbd">S</kbd> Split · <kbd className="kbd">Ctrl+K</kbd> Actions</span>
        </div>
      </div>
    </section>
  );
}
