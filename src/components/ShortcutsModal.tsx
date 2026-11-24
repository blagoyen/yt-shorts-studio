import { Keyboard, X } from "lucide-react";
import { useStudio } from "../stores/studio";

const GROUPS = [
  {
    title: "Playback & Timeline",
    items: [
      { keys: "Space", desc: "Play / pause preview" },
      { keys: "← / →", desc: "Step 1 frame (or nudge selected layer)" },
      { keys: "S", desc: "Split clip at playhead" },
      { keys: "M", desc: "Add marker at playhead" },
    ],
  },
  {
    title: "Selection & Groups",
    items: [
      { keys: "Shift + Click", desc: "Toggle item in multi-selection" },
      { keys: "Drag Canvas", desc: "Marquee select multiple layers" },
      { keys: "Ctrl + A", desc: "Select all overlay layers" },
      { keys: "Ctrl + G", desc: "Group selected layers" },
      { keys: "Ctrl + Shift + G", desc: "Ungroup selected group" },
      { keys: "Esc", desc: "Clear selection / close modal" },
    ],
  },
  {
    title: "Editing & Workflow",
    items: [
      { keys: "Ctrl + K", desc: "Open Command Palette" },
      { keys: "Ctrl + Z / Y", desc: "Undo / Redo" },
      { keys: "Ctrl + C / V", desc: "Copy / Paste selected layers" },
      { keys: "Ctrl + D", desc: "Duplicate selected layers" },
      { keys: "Delete", desc: "Delete selected layers" },
      { keys: "Shift + Arrows", desc: "Nudge layer by 10px" },
      { keys: "Ctrl + S", desc: "Save project" },
      { keys: "?", desc: "Show keyboard shortcuts" },
    ],
  },
];

export function ShortcutsModal() {
  const modal = useStudio((s) => s.modal);
  const setModal = useStudio((s) => s.setModal);
  if (modal !== "shortcuts") return null;

  return (
    <div className="modal-overlay" onMouseDown={(e) => e.target === e.currentTarget && setModal(null)}>
      <div className="modal" style={{ width: "min(680px, 94vw)" }}>
        <div className="modal-head">
          <div>
            <span className="eyebrow"><Keyboard size={11} /> Reference</span>
            <div style={{ fontSize: 16, fontWeight: 650, marginTop: 4 }}>Keyboard shortcuts</div>
          </div>
          <button className="icon-btn" onClick={() => setModal(null)}><X size={15} /></button>
        </div>
        <div className="modal-body">
          <div className="shortcuts-grid">
            {GROUPS.map((group) => (
              <div key={group.title} className="property-group">
                <span className="section-title">{group.title}</span>
                <div style={{ marginTop: 10, display: "grid", gap: 8 }}>
                  {group.items.map((item) => (
                    <div key={item.keys} className="property-row" style={{ marginBottom: 0 }}>
                      <span className="tiny" style={{ color: "var(--text-primary)" }}>{item.desc}</span>
                      <kbd className="kbd">{item.keys}</kbd>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="modal-foot">
          <button className="btn btn-primary" onClick={() => setModal(null)}>Done</button>
        </div>
      </div>
    </div>
  );
}
