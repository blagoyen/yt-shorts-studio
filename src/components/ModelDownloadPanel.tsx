import { useEffect } from "react";
import { Download } from "lucide-react";
import { useStudio, whisperModelKey } from "../stores/studio";

interface ModelDownloadPanelProps {
  model: string;
  modelDir?: string | null;
}

export function ModelDownloadPanel({ model, modelDir = null }: ModelDownloadPanelProps) {
  const store = useStudio();
  const job = store.modelDownload;
  const active = job?.model === model ? job : null;
  const running = active?.status === "running";
  const key = whisperModelKey(model, modelDir ?? store.settings?.modelStorageDir ?? null);
  const ready =
    store.modelAvailability[key] ??
    (model === store.settings?.whisperModel ? store.dependencies?.whisperModel.ready ?? false : false);
  const sidecarReady = store.dependencies?.pythonSidecar.ready ?? true;
  const progress = active ? active.progress : ready ? 1 : 0;
  const stage = active ? active.stage : ready ? "Ready locally" : "Not downloaded";

  useEffect(() => {
    void store.checkWhisperModel(model, modelDir);
  }, [model, modelDir, store.checkWhisperModel, active?.status]);

  return (
    <div className="render-progress">
      <div className="property-row">
        <span className="field-label">{stage}</span>
        <span className="mono">{Math.round(progress * 100)}%</span>
      </div>
      <div className="progress-track">
        <span style={{ width: `${Math.max(2, progress * 100)}%` }} />
      </div>
      <div className="transport-hint" style={{ justifyContent: "space-between" }}>
        <span>{model.toUpperCase()} · {ready ? "available on this computer" : "not downloaded yet"}</span>
        <button
          className="btn btn-sm"
          disabled={running || !sidecarReady}
          onClick={() => void store.downloadWhisperModel(model, modelDir)}
        >
          <Download size={12} /> {running ? "Downloading…" : ready ? "Re-download" : "Download model"}
        </button>
      </div>
      {active?.error && <div className="render-error">{active.error}</div>}
      {!sidecarReady && (
        <div className="render-error">The local Python sidecar must be installed before downloading a model.</div>
      )}
    </div>
  );
}
