import { useStudio } from "../../stores/studio";
import { PreviewPanel } from "../preview/PreviewPanel";
import { Timeline } from "../timeline/Timeline";
import { LeftPanel } from "./LeftPanel";
import { RightInspector } from "./RightInspector";

export function EditorWorkspace() {
  const hasProject = useStudio((state) => !!state.project);
  if (!hasProject) return null;

  return (
    <main className="editor">
      <div className="editor-main">
        <LeftPanel />
        <PreviewPanel />
        <RightInspector />
      </div>
      <Timeline />
    </main>
  );
}
