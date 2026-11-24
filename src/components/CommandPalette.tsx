import { useMemo, useState } from "react";
import { Command, Search, X } from "lucide-react";
import { useStudio } from "../stores/studio";
import { FILTER_PRESETS, LAYOUT_PRESETS } from "../utils/project";

interface PaletteAction {
  id: string;
  label: string;
  category: string;
  shortcut?: string;
  run: () => void;
}

export function CommandPalette() {
  const modal = useStudio((s) => s.modal);
  const setModal = useStudio((s) => s.setModal);
  const project = useStudio((s) => s.project);
  const settings = useStudio((s) => s.settings);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);

  const actions = useMemo<PaletteAction[]>(() => {
    const s = useStudio.getState();
    const list: PaletteAction[] = [
      { id: "add-text", label: "Add Text Overlay", category: "Create", run: () => s.addTextObject() },
      { id: "add-rect", label: "Add Rectangle Shape", category: "Create", run: () => s.addShapeObject("rect") },
      { id: "add-circle", label: "Add Circle Shape", category: "Create", run: () => s.addShapeObject("circle") },
      { id: "add-pill", label: "Add Pill Banner", category: "Create", run: () => s.addShapeObject("pill") },
      { id: "add-badge", label: "Add Callout Badge", category: "Create", run: () => s.addShapeObject("badge") },
      { id: "add-caption", label: "Add Caption Word", category: "Create", run: () => s.addCaption() },
      { id: "add-marker", label: "Add Timeline Marker at Playhead", category: "Timeline", shortcut: "M", run: () => s.addMarker() },
      { id: "split", label: "Split Clip at Playhead", category: "Timeline", shortcut: "S", run: () => s.splitClipAtPlayhead() },
      { id: "select-all", label: "Select All Overlay Layers", category: "Selection", shortcut: "Ctrl+A", run: () => s.selectAllOverlays() },
      { id: "group", label: "Group Selected Layers", category: "Selection", shortcut: "Ctrl+G", run: () => s.groupSelected() },
      { id: "align-cx", label: "Center Selected Horizontally", category: "Align", run: () => s.alignSelected("center-h") },
      { id: "align-cy", label: "Center Selected Vertically", category: "Align", run: () => s.alignSelected("center-v") },
      { id: "import-video", label: "Import Videos", category: "Media", run: () => void s.importVideos() },
      { id: "import-image", label: "Import Images / GIFs", category: "Media", run: () => void s.importImages() },
      { id: "import-audio", label: "Import Music / SFX", category: "Media", run: () => void s.importAudio() },
      { id: "transcribe", label: "Transcribe Audio with Whisper", category: "AI", run: () => s.setModal("transcribe") },
      { id: "layout-modal", label: "Open Layout & Crop Region Selector", category: "Layout", run: () => s.setModal("layout") },
      { id: "export", label: "Export 9:16 Video", category: "Project", run: () => s.setModal("export") },
      { id: "save", label: "Save Project", category: "Project", shortcut: "Ctrl+S", run: () => void s.saveProject(true) },
      { id: "settings", label: "Open Settings", category: "App", run: () => s.setModal("settings") },
      { id: "shortcuts", label: "Show Keyboard Shortcuts", category: "App", shortcut: "?", run: () => s.setModal("shortcuts") },
      {
        id: "toggle-theme",
        label: `Switch to ${settings?.theme === "dark" ? "Light" : "Dark"} Theme`,
        category: "App",
        run: () => void s.updateAppSettings({ theme: settings?.theme === "dark" ? "light" : "dark" }),
      },
    ];
    for (const preset of LAYOUT_PRESETS) {
      list.push({
        id: `layout-${preset.id}`,
        label: `Layout: ${preset.label}`,
        category: "Layout",
        run: () => s.setLayoutPreset(preset.id),
      });
    }
    for (const preset of FILTER_PRESETS) {
      list.push({
        id: `grade-${preset.id}`,
        label: `Color Grade: ${preset.name}`,
        category: "Color",
        run: () => s.updateGlobalColorGrade({ ...preset.effects, preset: preset.id }),
      });
    }
    return list;
  }, [settings?.theme, project?.id]);

  if (modal !== "palette") return null;

  const q = query.trim().toLowerCase();
  const filtered = q
    ? actions.filter((a) => `${a.category} ${a.label}`.toLowerCase().includes(q))
    : actions;

  const execute = (action: PaletteAction | undefined) => {
    if (!action) return;
    setModal(null);
    action.run();
  };

  return (
    <div className="modal-overlay" onMouseDown={(e) => e.target === e.currentTarget && setModal(null)}>
      <div className="modal palette-modal">
        <div className="palette-search">
          <Search size={14} className="muted" />
          <input
            autoFocus
            className="palette-input"
            placeholder="Type a command, layout, filter, or tool…"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setActiveIndex(0);
            }}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setActiveIndex((i) => Math.min(filtered.length - 1, i + 1));
              } else if (e.key === "ArrowUp") {
                e.preventDefault();
                setActiveIndex((i) => Math.max(0, i - 1));
              } else if (e.key === "Enter") {
                e.preventDefault();
                execute(filtered[activeIndex]);
              } else if (e.key === "Escape") {
                setModal(null);
              }
            }}
          />
          <button className="icon-btn small" onClick={() => setModal(null)}><X size={13} /></button>
        </div>
        <div className="palette-list">
          {filtered.length === 0 && (
            <div className="tiny muted" style={{ padding: 18, textAlign: "center" }}>No matching commands.</div>
          )}
          {filtered.slice(0, 14).map((action, index) => (
            <button
              key={action.id}
              className={`palette-item ${index === activeIndex ? "active" : ""}`}
              onMouseEnter={() => setActiveIndex(index)}
              onClick={() => execute(action)}
            >
              <span className="palette-cat">{action.category}</span>
              <span className="palette-label">{action.label}</span>
              {action.shortcut && <kbd className="kbd">{action.shortcut}</kbd>}
            </button>
          ))}
        </div>
        <div className="palette-foot">
          <span><Command size={10} style={{ verticalAlign: -1 }} /> Enter to run · Esc to close</span>
        </div>
      </div>
    </div>
  );
}
