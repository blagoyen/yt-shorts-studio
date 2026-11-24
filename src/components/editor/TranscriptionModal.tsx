import { useMemo, useState } from "react";
import { Sparkles, X } from "lucide-react";
import { ModelDownloadPanel } from "../ModelDownloadPanel";
import { useStudio, whisperModelKey } from "../../stores/studio";

export function TranscriptionModal() {
  const store = useStudio();
  const project = store.project;
  const job = store.transcription;
  const deps = store.dependencies;

  const sources = useMemo(
    () => (project?.media ?? []).filter((item) => item.kind !== "image" && !item.missing),
    [project?.media],
  );
  const [mediaId, setMediaId] = useState(() => sources[0]?.id ?? "");
  const [language, setLanguage] = useState("");
  const [model, setModel] = useState(() => store.settings?.whisperModel ?? "small");
  const running = job?.status === "running";

  if (store.modal !== "transcribe" || !project) return null;

  const selected = sources.find((item) => item.id === mediaId) ?? sources[0];
  const sidecarReady = deps?.pythonSidecar.ready ?? false;
  const modelReady =
    store.modelAvailability[whisperModelKey(model, store.settings?.modelStorageDir ?? null)] ??
    (model === store.settings?.whisperModel ? deps?.whisperModel.ready ?? false : false);
  const modelDownloadVisible =
    !modelReady || store.modelDownload?.model === model;

  return (
    <div
      className="modal-overlay"
      onMouseDown={(event) => event.target === event.currentTarget && !running && store.setModal(null)}
    >
      <div className="modal" style={{ width: "min(580px, 96vw)" }}>
        <div className="modal-head">
          <div>
            <span className="eyebrow">Local AI captions</span>
            <div style={{ fontSize: 16, fontWeight: 650, marginTop: 5 }}>Transcribe media</div>
          </div>
          <button className="icon-btn" disabled={running} onClick={() => store.setModal(null)}>
            <X size={15} />
          </button>
        </div>

        <div className="modal-body">
          <div className="property-group">
            <span className="field-label">Source media</span>
            <select className="select" disabled={running} value={selected?.id ?? ""} onChange={(event) => setMediaId(event.target.value)}>
              {sources.length === 0 && <option value="">Import a video or audio file first</option>}
              {sources.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name} · {item.kind}
                </option>
              ))}
            </select>
          </div>
          <div className="property-group">
            <span className="field-label">Model</span>
            <select className="select" disabled={running} value={model} onChange={(event) => setModel(event.target.value)}>
              {["tiny", "base", "small", "medium", "large"].map((name) => (
                <option key={name} value={name}>{name.toUpperCase()}</option>
              ))}
            </select>
            <p className="tiny muted" style={{ marginTop: 6 }}>
              Models stay on this computer. The first run downloads the selected model locally.
            </p>
          </div>
          <div className="property-group">
            <span className="field-label">Language (optional)</span>
            <input
              className="input"
              disabled={running}
              value={language}
              placeholder="Auto-detect · e.g. en, es, de"
              onChange={(event) => setLanguage(event.target.value.trim().toLowerCase())}
            />
          </div>

          {!sidecarReady && (
            <div className="render-error">
              Faster-Whisper sidecar is not installed. Run transcription-engine/setup.ps1, then check Settings → Dependencies.
            </div>
          )}

          {modelDownloadVisible && (
            <ModelDownloadPanel model={model} modelDir={store.settings?.modelStorageDir ?? null} />
          )}

          {job && (
            <div className="render-progress">
              <div className="property-row">
                <span className="field-label">{job.stage}</span>
                <span className="mono">{Math.round(job.progress * 100)}%</span>
              </div>
              <div className="progress-track">
                <span style={{ width: `${Math.max(2, job.progress * 100)}%` }} />
              </div>
              <div className="transport-hint">
                <span>{sources.find((item) => item.id === job.mediaId)?.name ?? job.mediaId}</span>
                {job.wordCount !== undefined && <span>{job.wordCount} words imported</span>}
              </div>
              {job.error && <div className="render-error">{job.error}</div>}
            </div>
          )}

          <p className="tiny muted" style={{ marginTop: 12, lineHeight: 1.6 }}>
            Word-level results replace the current transcript and remain fully editable in the Text panel.
            Audio is processed only on this machine.
          </p>
        </div>

        <div className="modal-foot">
          {job && job.status !== "running" && (
            <button className="btn" style={{ marginRight: "auto" }} onClick={store.clearTranscription}>
              Clear status
            </button>
          )}
          {running && <button className="btn" onClick={store.cancelTranscription}>Cancel</button>}
          <button className="btn" disabled={running} onClick={() => store.setModal(null)}>Close</button>
          <button
            className="btn btn-primary"
            disabled={running || !selected}
            onClick={() => selected && void store.startTranscription(selected.id, model, language)}
          >
            <Sparkles size={14} /> {running ? "Transcribing…" : "Transcribe"}
          </button>
        </div>
      </div>
    </div>
  );
}
