import { ArrowLeft, Command, Download, Keyboard, Moon, Redo2, Settings2, Sun, Undo2 } from "lucide-react";
import { useStudio } from "../stores/studio";
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
  const isDark = settings?.theme === "dark";

  return (
    <header className="topbar" data-tauri-drag-region>
      <div className="brand" data-tauri-drag-region>
        {screen === "editor" && (
          <button className="icon-btn small" title="Back to project library" onClick={() => setScreen("library")}>
            <ArrowLeft size={13} />
          </button>
        )}
        <div className="brand-mark" data-tauri-drag-region>YS</div>
        <div data-tauri-drag-region>
          <div className="brand-name" data-tauri-drag-region>YT Shorts Studio</div>
          <span className="brand-tag" data-tauri-drag-region>Local gaming shorts editor</span>
        </div>
      </div>

      <div className="topbar-divider" data-tauri-drag-region />

      <div className="topbar-project">
        {screen === "editor" && project ? (
          <input
            className="project-name-input"
            value={project.name}
            onChange={(event) => setProjectName(event.target.value)}
            spellCheck={false}
            aria-label="Project name"
          />
        ) : (
          <span className="topbar-status">Project library</span>
        )}
      </div>

      <div className="topbar-center" data-tauri-drag-region>
        <span className="topbar-status" data-tauri-drag-region>
          {screen === "editor"
            ? `${project?.media.length ?? 0} media · ${project?.captions.length ?? 0} words · ${dirty ? "unsaved" : "saved"}`
            : depsReady
              ? "FFmpeg ready · all processing stays local"
              : "FFmpeg missing · check dependencies"}
        </span>
      </div>

      <div className="topbar-actions">
        {screen === "editor" && (
          <>
            <button
              className="btn btn-sm"
              title="Command Palette (Ctrl+K)"
              onClick={() => setModal("palette")}
            >
              <Command size={12} /> Actions
            </button>
            <button
              className="icon-btn"
              title="Undo (Ctrl+Z)"
              disabled={!history.past.length}
              onClick={undo}
            >
              <Undo2 size={15} />
            </button>
            <button
              className="icon-btn"
              title="Redo (Ctrl+Y)"
              disabled={!history.future.length}
              onClick={redo}
            >
              <Redo2 size={15} />
            </button>
            <button className="btn btn-sm" title="Save project (Ctrl+S)" onClick={() => void saveProject(true)}>
              Save
            </button>
          </>
        )}
        <button
          className="icon-btn"
          title={isDark ? "Switch to light theme" : "Switch to dark theme"}
          onClick={() => void updateAppSettings({ theme: isDark ? "light" : "dark" })}
        >
          {isDark ? <Sun size={15} /> : <Moon size={15} />}
        </button>
        <button className="icon-btn" title="Keyboard shortcuts (?)" onClick={() => setModal("shortcuts")}>
          <Keyboard size={15} />
        </button>
        <button className="icon-btn" title="Settings" onClick={() => setModal("settings")}>
          <Settings2 size={15} />
        </button>
        <button
          className="btn btn-primary"
          disabled={screen !== "editor" || !project}
          onClick={() => setModal("export")}
        >
          <Download size={14} /> Export
        </button>
        <WindowControls />
      </div>
    </header>
  );
}
