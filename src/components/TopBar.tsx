import { ArrowLeft, CheckCircle2, Command, Download, Keyboard, Moon, Redo2, Save, Settings2, Sun, Undo2 } from "lucide-react";
import { useStudio } from "../stores/studio";
import { BrandMark } from "./BrandMark";
import { WindowControls } from "./WindowControls";

export function TopBar() {
  const project = useStudio((s) => s.project);
  const dependencies = useStudio((s) => s.dependencies);
  const screen = useStudio((s) => s.screen);
  const dirty = useStudio((s) => s.dirty);
  const history = useStudio((s) => s.history);
  const settings = useStudio((s) => s.settings);
  const setScreen = useStudio((s) => s.setScreen);
  const setProjectName = useStudio((s) => s.setProjectName);
  const undo = useStudio((s) => s.undo);
  const redo = useStudio((s) => s.redo);
  const saveProject = useStudio((s) => s.saveProject);
  const setModal = useStudio((s) => s.setModal);
  const updateAppSettings = useStudio((s) => s.updateAppSettings);

  const depsReady = dependencies?.ready ?? false;
  const isDark = (settings?.theme ?? "dark") === "dark";

  return (
    <header className="topbar" data-tauri-drag-region>
      <div className="brand" data-tauri-drag-region>
        {screen === "editor" && (
          <button className="icon-btn icon-btn-round small" title="Back to project library" onClick={() => setScreen("library")}>
            <ArrowLeft size={13} />
          </button>
        )}
        <BrandMark size={24} />
        <span className="brand-wordmark" data-tauri-drag-region>Cutline Studio</span>
        {screen === "editor" && project && (
          <>
            <span className="topbar-divider" data-tauri-drag-region />
            <input
              className="project-name-input"
              value={project.name}
              onChange={(event) => setProjectName(event.target.value)}
              spellCheck={false}
              aria-label="Project name"
            />
          </>
        )}
      </div>

      <div className="topbar-center" data-tauri-drag-region>
        <div className="global-info" data-tauri-drag-region>
          <CheckCircle2 size={12} className="global-info-icon" />
          <span className="global-info-kicker">{screen === "editor" ? (dirty ? "UNSAVED" : "SAVED") : "STUDIO"}</span>
          <span className="global-info-text" data-tauri-drag-region>
            {screen === "editor"
              ? `${project?.media.length ?? 0} media · ${project?.captions.length ?? 0} words · 9:16 1080×1920`
              : "Cutline Studio — Local 9:16 Shorts Editor · Keyframes, FX & AI Captions"}
          </span>
        </div>
      </div>

      <div className="topbar-actions">
        {screen === "editor" && (
          <>
            <button className="btn btn-pill btn-sm" title="Command Palette (Ctrl+K)" onClick={() => setModal("palette")}>
              <Command size={12} /> Actions
            </button>
            <button className="icon-btn icon-btn-round" title="Undo (Ctrl+Z)" disabled={!history.past.length} onClick={undo}>
              <Undo2 size={14} />
            </button>
            <button className="icon-btn icon-btn-round" title="Redo (Ctrl+Y)" disabled={!history.future.length} onClick={redo}>
              <Redo2 size={14} />
            </button>
            <button className="icon-btn icon-btn-round" title="Save project (Ctrl+S)" onClick={() => void saveProject(true)}>
              <Save size={14} />
            </button>
          </>
        )}
        <button
          className={`dep-pill ${depsReady ? "dep-ok" : "dep-warn"}`}
          onClick={() => setModal("settings")}
          title="Check local FFmpeg & Whisper dependencies"
        >
          <span className={`dot ${depsReady ? "dot-ok" : "dot-warn"}`} />
          <span>{depsReady ? "Tools ready" : "Check tools"}</span>
        </button>
        <button
          className="icon-btn icon-btn-round"
          title={isDark ? "Switch to light theme" : "Switch to dark theme"}
          onClick={() => void updateAppSettings({ theme: isDark ? "light" : "dark" })}
        >
          {isDark ? <Sun size={14} /> : <Moon size={14} />}
        </button>
        <button className="icon-btn icon-btn-round" title="Keyboard shortcuts (?)" onClick={() => setModal("shortcuts")}>
          <Keyboard size={14} />
        </button>
        <button className="icon-btn icon-btn-round" title="Settings" onClick={() => setModal("settings")}>
          <Settings2 size={14} />
        </button>
        {screen === "editor" && project && (
          <button className="btn btn-cta btn-pill" onClick={() => setModal("export")}>
            <Download size={13} /> Export
          </button>
        )}
        <WindowControls />
      </div>
    </header>
  );
}
