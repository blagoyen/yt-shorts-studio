import { Download, FolderOpen, X } from "lucide-react";
import { pickExportSavePath, pickFolder } from "../../services/api";
import { useStudio } from "../../stores/studio";
import { formatTime } from "../../utils/project";

export function ExportPanel() {
  const store = useStudio();
  const settings = store.project?.exportSettings;
  const render = store.render;

  if (!settings || store.modal !== "export") return null;

  const busy = render?.status === "running";

  return (
    <div className="modal-overlay" onMouseDown={(event) => event.target === event.currentTarget && !busy && store.setModal(null)}>
      <div className="modal" style={{ width: "min(620px, 96vw)" }}>
        <div className="modal-head">
          <div>
            <span className="eyebrow">Render</span>
            <div style={{ fontSize: 16, fontWeight: 650, marginTop: 5 }}>Export 9:16 video</div>
          </div>
          <button className="icon-btn" disabled={busy} onClick={() => store.setModal(null)}><X size={15} /></button>
        </div>

        <div className="modal-body">
          <div className="property-group">
            <span className="field-label">Resolution</span>
            <select
              className="select"
              disabled={busy}
              value={`${settings.width}x${settings.height}`}
              onChange={(event) => {
                const [width, height] = event.target.value.split("x").map(Number);
                store.updateExportSettings({ width, height });
              }}
            >
              <option value="1080x1920">1080 × 1920 · High</option>
              <option value="720x1280">720 × 1280 · Standard</option>
            </select>
          </div>
          <div className="property-group">
            <span className="field-label">Frame rate</span>
            <select className="select" disabled={busy} value={settings.fps} onChange={(event) => store.updateExportSettings({ fps: Number(event.target.value) })}>
              <option value={30}>30 FPS</option>
              <option value={60}>60 FPS</option>
            </select>
          </div>
          <div className="property-group">
            <span className="field-label">Codec</span>
            <select className="select" disabled={busy} value={settings.codec} onChange={(event) => store.updateExportSettings({ codec: event.target.value as "h264" | "h265" })}>
              <option value="h264">H.264 · MP4</option>
              <option value="h265">H.265 · MP4</option>
            </select>
          </div>
          <div className="property-group">
            <span className="field-label">Quality</span>
            <select className="select" disabled={busy} value={settings.quality} onChange={(event) => store.updateExportSettings({ quality: event.target.value as "high" | "medium" | "low" })}>
              <option value="high">High · slower</option>
              <option value="medium">Medium</option>
              <option value="low">Low · faster</option>
            </select>
          </div>
          <div className="property-group">
            <span className="field-label">Hardware acceleration</span>
            <select className="select" disabled={busy} value={settings.hardware} onChange={(event) => store.updateExportSettings({ hardware: event.target.value as typeof settings.hardware })}>
              <option value="auto">Software · reliable</option>
              <option value="nvenc">NVIDIA NVENC</option>
              <option value="qsv">Intel Quick Sync</option>
              <option value="amf">AMD AMF</option>
              <option value="software">Software only</option>
            </select>
          </div>
          <div className="property-group">
            <span className="field-label">Output folder</span>
            <div style={{ display: "flex", gap: 6 }}>
              <input className="input" disabled={busy} value={settings.outputFolder} onChange={(event) => store.updateExportSettings({ outputFolder: event.target.value })} />
              <button className="btn btn-sm" disabled={busy} onClick={async () => {
                const folder = await pickFolder(settings.outputFolder || undefined);
                if (folder) store.updateExportSettings({ outputFolder: folder });
              }}><FolderOpen size={13} /></button>
            </div>
          </div>
          <div className="property-group">
            <span className="field-label">Filename</span>
            <input className="input" disabled={busy} value={settings.filename} onChange={(event) => store.updateExportSettings({ filename: event.target.value })} />
          </div>
          <p className="tiny muted">
            Output: {settings.outputFolder || "project folder"}\\{settings.filename}.mp4 · AAC audio · no watermark.
          </p>

          {render && (
            <div className="render-progress">
              <div className="property-row">
                <span className="field-label">{render.stage}</span>
                <span className="mono">{Math.round(render.progress * 100)}%</span>
              </div>
              <div className="progress-track">
                <span style={{ width: `${Math.max(2, render.progress * 100)}%` }} />
              </div>
              <div className="transport-hint">
                <span>{render.outputPath}</span>
                <span>
                  {formatTime(render.elapsedMs, false)}
                  {render.etaMs !== null ? ` · ${formatTime(render.etaMs, false)} left` : ""}
                </span>
              </div>
              {render.error && <div className="render-error">{render.error}</div>}
            </div>
          )}
        </div>

        <div className="modal-foot">
          {render && render.status !== "running" && (
            <button className="btn" onClick={store.clearRender} style={{ marginRight: "auto" }}>Clear status</button>
          )}
          {busy && (
            <button className="btn" onClick={store.cancelRender}>Cancel render</button>
          )}
          <button className="btn" disabled={busy} onClick={() => store.setModal(null)}>Close</button>
          <button
            className="btn btn-primary"
            disabled={busy}
            onClick={async () => {
              const path = await pickExportSavePath(settings.outputFolder || undefined, settings.filename);
              if (!path) return;
              await store.startRender(path);
            }}
          >
            <Download size={14} /> {busy ? "Rendering…" : "Choose output & export"}
          </button>
        </div>
      </div>
    </div>
  );
}
