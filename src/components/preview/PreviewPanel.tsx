import { useEffect, useMemo } from "react";
import { LayoutTemplate, Pause, Play, SkipBack, SkipForward } from "lucide-react";
import { useStudio } from "../../stores/studio";
import { formatTime, projectDuration } from "../../utils/project";
import { VerticalCanvas } from "./VerticalCanvas";

export function PreviewPanel() {
  const store = useStudio();
  const { project, playheadMs, playing, settings } = store;
  const duration = projectDuration(project);
  const frameMs = 1000 / (project?.canvas.fps || 30);

  const hasVideo = useMemo(
    () =>
      !!project?.tracks.video.some(
        (clip) => playheadMs >= clip.startMs && playheadMs < clip.startMs + clip.durationMs,
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
            style={{ width: 104, height: 28, fontSize: 10 }}
            value={settings?.previewQuality ?? "medium"}
            onChange={(event) =>
              store.updateAppSettings({ previewQuality: event.target.value as "low" | "medium" | "high" })
            }
            title="Preview quality"
          >
            <option value="low">Quality · low</option>
            <option value="medium">Quality · med</option>
            <option value="high">Quality · high</option>
          </select>
          <button className="btn btn-sm" onClick={() => store.setModal("layout")}>
            <LayoutTemplate size={13} /> Set up layout
          </button>
        </div>
      </div>

      <div className="preview-stage">
        <VerticalCanvas
          project={project}
          playheadMs={playheadMs}
          playing={playing}
          onTimeChange={store.setPlayhead}
        />
      </div>

      <div className="preview-transport">
        <div className="transport-row">
          <button className="icon-btn small" title="Previous frame (Left)" onClick={() => store.setPlayhead(playheadMs - frameMs)}>
            <SkipBack size={13} />
          </button>
          <button
            className="icon-btn"
            title="Play / pause (Space)"
            onClick={() => {
              if (playheadMs >= duration && duration > 0) store.setPlayhead(0);
              store.setPlaying(!playing);
            }}
          >
            {playing ? <Pause size={15} /> : <Play size={15} />}
          </button>
          <button className="icon-btn small" title="Next frame (Right)" onClick={() => store.setPlayhead(playheadMs + frameMs)}>
            <SkipForward size={13} />
          </button>
          <div className="transport-time">
            {formatTime(playheadMs)} <span className="muted">/ {formatTime(duration)}</span>
          </div>
          <input
            className="scrub"
            type="range"
            min={0}
            max={Math.max(1, duration)}
            step={1}
            value={Math.min(playheadMs, Math.max(1, duration))}
            onChange={(event) => store.setPlayhead(Number(event.target.value))}
            style={{ appearance: "none" }}
          />
        </div>
        <div className="transport-hint">
          <span>Canvas 1080 × 1920 · {project.canvas.fps} FPS</span>
          <span>Space play · S split · Ctrl+Z undo</span>
        </div>
      </div>
    </section>
  );
}
