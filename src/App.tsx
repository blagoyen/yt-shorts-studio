import { useEffect } from "react";
import { listen } from "@tauri-apps/api/event";
import type {
  ModelDownloadCompleteEvent,
  ModelDownloadProgressEvent,
  RenderCompleteEvent,
  RenderProgressEvent,
  TranscriptionCompleteEvent,
  TranscriptionProgressEvent,
} from "./types";
import { CommandPalette } from "./components/CommandPalette";
import { SettingsDrawer } from "./components/SettingsDrawer";
import { ShortcutsModal } from "./components/ShortcutsModal";
import { ExportPanel } from "./components/export/ExportPanel";
import { EditorWorkspace } from "./components/editor/EditorWorkspace";
import { LayoutSetupModal } from "./components/editor/LayoutSetupModal";
import { TranscriptionModal } from "./components/editor/TranscriptionModal";
import { ProjectLibrary } from "./components/library/ProjectLibrary";
import { Toasts } from "./components/Toasts";
import { TopBar } from "./components/TopBar";
import { selectedTimelineItem, selectedTimelineItems, useStudio } from "./stores/studio";
import { CANVAS } from "./utils/project";

export default function App() {
  const screen = useStudio((s) => s.screen);
  const modal = useStudio((s) => s.modal);
  const busy = useStudio((s) => s.busy);
  const theme = useStudio((s) => s.settings?.theme ?? "light");
  const autosaveIntervalSeconds = useStudio((s) => s.settings?.autosaveIntervalSeconds ?? 30);

  useEffect(() => {
    void useStudio.getState().initialize();
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  useEffect(() => {
    let disposed = false;
    const unlisteners: (() => void)[] = [];
    void Promise.all([
      listen<RenderProgressEvent>("render-progress", (event) => {
        useStudio.getState().applyRenderProgress(event.payload);
      }),
      listen<RenderCompleteEvent>("render-complete", (event) => {
        useStudio.getState().applyRenderComplete(event.payload);
      }),
      listen<TranscriptionProgressEvent>("transcription-progress", (event) => {
        useStudio.getState().applyTranscriptionProgress(event.payload);
      }),
      listen<TranscriptionCompleteEvent>("transcription-complete", (event) => {
        useStudio.getState().applyTranscriptionComplete(event.payload);
      }),
      listen<ModelDownloadProgressEvent>("model-download-progress", (event) => {
        useStudio.getState().applyModelDownloadProgress(event.payload);
      }),
      listen<ModelDownloadCompleteEvent>("model-download-complete", (event) => {
        useStudio.getState().applyModelDownloadComplete(event.payload);
      }),
    ]).then((listeners) => {
      if (disposed) listeners.forEach((unlisten) => unlisten());
      else unlisteners.push(...listeners);
    });
    return () => {
      disposed = true;
      unlisteners.forEach((unlisten) => unlisten());
    };
  }, []);

  useEffect(() => {
    const interval = Math.max(10, autosaveIntervalSeconds) * 1000;
    const timer = window.setInterval(() => {
      const state = useStudio.getState();
      if (state.screen === "editor" && state.projectPath && state.dirty) {
        void state.saveProject(false);
      }
    }, interval);
    return () => window.clearInterval(timer);
  }, [autosaveIntervalSeconds]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const editing = target && (
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.tagName === "SELECT" ||
        target.isContentEditable
      );
      const state = useStudio.getState();
      const mod = event.ctrlKey || event.metaKey;
      const key = event.key.toLowerCase();

      if (mod && key === "k") {
        event.preventDefault();
        if (state.screen === "editor") {
          state.setModal(state.modal === "palette" ? null : "palette");
        }
        return;
      }

      if (event.key === "Escape" && state.modal) {
        event.preventDefault();
        state.setModal(null);
        return;
      }

      if (editing) return;

      if (event.key === "?" || (event.shiftKey && event.key === "/")) {
        event.preventDefault();
        state.setModal(state.modal === "shortcuts" ? null : "shortcuts");
        return;
      }

      if (state.screen !== "editor" || state.modal) return;

      if (mod && key === "s") {
        event.preventDefault();
        void state.saveProject(true);
        return;
      }
      if (mod && key === "z") {
        event.preventDefault();
        if (event.shiftKey) state.redo();
        else state.undo();
        return;
      }
      if (mod && key === "y") {
        event.preventDefault();
        state.redo();
        return;
      }
      if (mod && key === "a") {
        event.preventDefault();
        state.selectAllOverlays();
        return;
      }
      if (mod && key === "g") {
        event.preventDefault();
        if (event.shiftKey && state.selection?.type === "group") {
          state.ungroup(state.selection.id);
        } else {
          state.groupSelected();
        }
        return;
      }
      if (mod && key === "d") {
        event.preventDefault();
        state.duplicateSelected();
        return;
      }
      if (mod && key === "c") {
        event.preventDefault();
        state.copyCanvasObject();
        return;
      }
      if (mod && key === "v") {
        event.preventDefault();
        state.pasteCanvasObject();
        return;
      }
      if (event.key === "Escape") {
        state.setSelection(null);
        return;
      }
      if (event.code === "Space") {
        event.preventDefault();
        state.setPlaying(!state.playing);
        return;
      }
      if (event.key === "Delete" || event.key === "Backspace") {
        if (state.selectedIds.length > 0 || (state.selection && ["clip", "overlay", "audio"].includes(state.selection.type))) {
          event.preventDefault();
          state.removeSelected();
        }
        return;
      }
      if (key === "s" && !mod) {
        state.splitClipAtPlayhead();
        return;
      }
      if (key === "m" && !mod) {
        state.addMarker();
        return;
      }
      if (event.key.startsWith("Arrow")) {
        const direction = event.key === "ArrowLeft" || event.key === "ArrowUp" ? -1 : 1;
        const horizontal = event.key === "ArrowLeft" || event.key === "ArrowRight";
        const step = event.shiftKey ? 10 : 1;
        const selection = state.selection;
        const multi = selectedTimelineItems(state).filter(
          (i) => (i.track === "overlays" || i.track === "effects") && !i.locked,
        );

        if (multi.length > 1) {
          event.preventDefault();
          const patches: Record<string, { x?: number; y?: number }> = {};
          for (const item of multi) {
            patches[item.id] = horizontal
              ? { x: (item.x ?? 0.5) + (direction * step) / CANVAS.width }
              : { y: (item.y ?? 0.5) + (direction * step) / CANVAS.height };
          }
          state.updateClipsBatch(patches);
          return;
        }

        const item = selectedTimelineItem(state);
        if (selection?.type === "region") {
          event.preventDefault();
          const current = state.project?.layout[selection.id];
          if (current) {
            const patch = horizontal
              ? { offsetX: current.offsetX + direction * step * 0.02 }
              : { offsetY: current.offsetY + direction * step * 0.02 };
            state.updateRegion(selection.id, patch);
          }
          return;
        }
        if (selection?.type === "captions") {
          event.preventDefault();
          const style = state.project?.captionStyle;
          if (style) {
            const patch = horizontal
              ? { x: style.x + (direction * step) / CANVAS.width }
              : { y: style.y + (direction * step) / CANVAS.height };
            state.updateCaptionStyle(patch);
          }
          return;
        }
        if (item && (item.track === "overlays" || item.track === "effects") && !item.locked) {
          event.preventDefault();
          const patch = horizontal
            ? { x: (item.x ?? 0.5) + (direction * step) / CANVAS.width }
            : { y: (item.y ?? 0.5) + (direction * step) / CANVAS.height };
          state.updateClip(item.id, patch);
          return;
        }
        event.preventDefault();
        state.setPlayhead(state.playheadMs + (horizontal ? direction : 0) * (1000 / (state.project?.canvas.fps ?? 30)));
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  return (
    <div className="app-shell">
      <TopBar />
      {screen === "library" ? <ProjectLibrary /> : <EditorWorkspace />}
      {modal === "layout" && <LayoutSetupModal />}
      {modal === "settings" && <SettingsDrawer />}
      {modal === "export" && <ExportPanel />}
      {modal === "transcribe" && <TranscriptionModal />}
      {modal === "palette" && <CommandPalette />}
      {modal === "shortcuts" && <ShortcutsModal />}
      <Toasts />
      {busy && <div className="busy-bar" />}
    </div>
  );
}
