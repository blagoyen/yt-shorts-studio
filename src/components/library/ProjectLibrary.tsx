import { Film, Flame, FolderOpen, LayoutGrid, Plus, Settings2, Sparkles, Trash2 } from "lucide-react";
import { useStudio, type ProjectTemplateId } from "../../stores/studio";
import { assetUrl } from "../../services/api";
import { formatDate, formatTime } from "../../utils/project";

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
  const setModal = useStudio((s) => s.setModal);

  return (
    <main className="library">
      <div className="library-inner">
        <section className="library-hero">
          <div>
            <div className="eyebrow">Local editing studio</div>
            <h1 className="library-title">
              Turn gameplay into <em>shorts.</em>
            </h1>
            <p className="library-lede">
              Compose gameplay and facecam from a single recording, animate overlays with keyframes,
              grade color, generate local AI captions, and export crisp 9:16 video — all on this machine.
            </p>
            <div className="library-actions">
              <button className="btn btn-primary" onClick={() => void newProject()}>
                <Plus size={15} /> New project
              </button>
              <button className="btn" onClick={() => void openProject()}>
                <FolderOpen size={15} /> Open project
              </button>
              <button className="btn btn-quiet" onClick={() => setModal("settings")}>
                <Settings2 size={15} /> Settings
              </button>
            </div>
          </div>

          <aside className="library-aside">
            <span className="section-title">Studio status</span>
            <div style={{ marginTop: 14 }}>
              <div className="library-stat">
                <span>Version</span>
                <span>{appInfo?.version ?? "—"}</span>
              </div>
              <div className="library-stat">
                <span>FFmpeg</span>
                <span className={dependencies?.ffmpeg.ready ? "mono" : "mono muted"}>
                  {dependencies?.ffmpeg.ready ? "READY" : "MISSING"}
                </span>
              </div>
              <div className="library-stat">
                <span>FFprobe</span>
                <span className="mono">{dependencies?.ffprobe.ready ? "READY" : "MISSING"}</span>
              </div>
              <div className="library-stat">
                <span>Default folder</span>
                <span title={appInfo?.defaultProjectFolder}>{appInfo?.defaultProjectFolder?.split("\\").pop() ?? "—"}</span>
              </div>
              <div className="library-stat">
                <span>FFmpeg version</span>
                <span>{dependencies?.ffmpeg.version ?? "—"}</span>
              </div>
            </div>
          </aside>
        </section>

        <div className="library-section-head">
          <span className="section-title">Quick-start templates</span>
          <span className="tiny muted">9:16 presets with animations & grading</span>
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
          <div>
            <span className="section-title">Recent projects</span>
          </div>
          <span className="tiny muted">{recent.length} saved locally</span>
        </div>

        {recent.length === 0 ? (
          <div className="empty-state">
            No projects yet. Create a new project or pick a template above to start building your first 9:16 short.
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
                  className="icon-btn small"
                  title="Remove from recent"
                  style={{ position: "absolute", top: 6, right: 6, background: "var(--surface)" }}
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
