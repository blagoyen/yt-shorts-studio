import { Maximize2, Minus, X } from "lucide-react";
import { getCurrentWindow } from "@tauri-apps/api/window";

export function WindowControls() {
  const appWindow = getCurrentWindow();

  return (
    <div className="window-controls">
      <button className="window-control" title="Minimize" onClick={() => appWindow.minimize()}>
        <Minus size={13} />
      </button>
      <button className="window-control" title="Maximize" onClick={() => appWindow.toggleMaximize()}>
        <Maximize2 size={12} />
      </button>
      <button className="window-control close" title="Close" onClick={() => appWindow.close()}>
        <X size={14} />
      </button>
    </div>
  );
}
