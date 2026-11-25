import { Film, Flame, FolderOpen, LayoutGrid, Plus, Scissors, ShieldCheck, Sparkles, Trash2 } from "lucide-react";
import { useStudio, type ProjectTemplateId } from "../../stores/studio";
import { assetUrl } from "../../services/api";
import { formatDate, formatTime } from "../../utils/project";
import { AsciiBackdrop } from "../AsciiBackdrop";

const TEMPLATES: { id: ProjectTemplateId; name: string; desc: string; icon: typeof Flame }[] = [
  { id: "gaming-highlight", name: "Gaming Clutch", desc: "62/38 split · Vivid grade · Pop title", icon: Flame },
  { id: "reaction-split", name: "Reaction Split", desc: "50/50 split · Rounded cam · Live badge", icon: LayoutGrid },
  { id: "meme-caption", name: "Meme Short", desc: "Full frame · Bold top banner · Bounce", icon: Sparkles },
  { id: "cinematic-reel", name: "Cinematic Reel", desc: "Teal grade · Vignette · Fade title", icon: Film },
];

export function ProjectLibrary() {
  const recent = useStudio((s) => s.recent);
  const appInfo = useStudio((s) => s.appInfo);
  const dependencies = useStudio((s) => s.dependencies);
  const newProject = useStudio((s) => s.newProject);
  const openProject = useStudio((s) => s.openProject);
  const openProjectAt = useStudio((s) => s.openProjectAt);
  const removeRecent = useStudio((s) => s.removeRecent);

  return (
    <main className="library">
      <div className="library-inner">
        <section className="editorial-hero">
          <div className="editorial-hero-top">
            <div>
              <h1 className="editorial-headline">
                The shorts studio
                <br />
                you can <em>cut on</em>
              </h1>
              <p className="editorial-lede">
                Compose gameplay and facecam from a single recording, animate overlays with keyframes,
                grade color, and burn local Whisper captions — entirely on your machine.
              </p>
              <div className="library-actions">
                <button className="btn btn-cta btn-pill" onClick={() => void newProject()}>
                  <Plus size={14} /> New project
                </button>
                <button className="btn btn-pill" onClick={() => void openProject()}>
                  <FolderOpen size={14} /> Open project
                </button>
              </div>
            </div>

            <div className="hero-band-card">
              <AsciiBackdrop variant="band" />
              <div className="hero-band-overlay">
                <div className="hero-band-row">
                  <span className="section-title">Studio engine</span>
                  <span className="mono tiny">v{appInfo?.version ?? "1.1.0"}</span>
                </div>
                <div className="hero-band-stats">
                  <div>
                    <span className="tiny muted">FFMPEG</span>
                    <strong className="mono">{dependencies?.ffmpeg.ready ? "READY" : "MISSING"}</strong>
                  </div>
                  <div>
                    <span className="tiny muted">WHISPER</span>
                    <strong className="mono">{dependencies?.pythonSidecar.ready ? "LOCAL" : "SETUP"}</strong>
                  </div>
                  <div>
                    <span className="tiny muted">CANVAS</span>
                    <strong className="mono">1080×1920</strong>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="editorial-meta-row">
            <div className="source-pills">
              <span className="source-pill source-pill-indigo">
                <Scissors size={11} /> 9:16 SPLIT-SCREEN
              </span>
              <span className="source-pill source-pill-purple">
                <Sparkles size={11} /> KEYFRAMES &amp; FX
              </span>
              <span className="source-pill">
                <ShieldCheck size={11} /> 100% LOCAL
              </span>
            </div>
            <span className="editorial-kicker">
              <span className="dot dot-ok" />
              FRAME-ACCURATE · ZERO CLOUD UPLOADS
            </span>
          </div>
        </section>

        <div className="library-section-head">
          <span className="section-title">Quick-start templates</span>
          <span className="tiny muted">Pre-configured layouts, animations &amp; color grades</span>
        </div>
        <div className="template-grid">
          {TEMPLATES.map((tpl) => (
            <button key={tpl.id} className="template-card" onClick={() => void newProject(tpl.name, tpl.id)}>
              <span className="template-icon"><tpl.icon size={15} /></span>
              <div>
                <div className="template-name">{tpl.name}</div>
                <div className="tiny muted">{tpl.desc}</div>
              </div>
            </button>
          ))}
        </div>

        <div className="library-section-head">
          <span className="section-title">Recent projects</span>
          <span className="tiny muted">{recent.length} saved locally</span>
        </div>

        {recent.length === 0 ? (
          <div className="empty-state">
            No projects yet. Start a new project or pick a template above to build your first 9:16 short.
          </div>
        ) : (
          <div className="recent-grid">
            {recent.map((project) => (
              <div key={project.path} style={{ position: "relative" }}>
                <button className="project-card" onClick={() => void openProjectAt(project.path)}>
                  <div className={`project-thumb ${project.thumbnailPath ? "" : "empty"}`}>
                    {project.thumbnailPath ? (
                      <img src={assetUrl(project.thumbnailPath)} alt="" />
                    ) : (
                      <span>NO PREVIEW</span>
                    )}
                  </div>
                  <div className="project-card-body">
                    <div className="project-card-name">{project.name}</div>
                    <div className="project-card-meta">
                      <span>{formatDate(project.modifiedAt)}</span>
                      <span>{formatTime(project.durationMs, false)}</span>
                    </div>
                    <div className="project-card-meta">
                      <span>{project.mediaCount} media</span>
                      <span className="mono">.shortsproj</span>
                    </div>
                  </div>
                </button>
                <button
                  className="icon-btn icon-btn-round small"
                  title="Remove from recent"
                  style={{ position: "absolute", top: 8, right: 8 }}
                  onClick={() => void removeRecent(project.path)}
                >
                  <Trash2 size={12} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
