import { useState } from "react";
import type { ReactNode } from "react";
import {
  ArrowDown,
  ArrowUp,
  Captions,
  ChevronDown,
  ChevronRight,
  Copy,
  Eye,
  EyeOff,
  Film,
  Folder,
  FolderOpen,
  Group,
  Image as ImageIcon,
  Lock,
  Shapes,
  Trash2,
  Type,
  Ungroup,
  Unlock,
} from "lucide-react";
import { useStudio } from "../../stores/studio";
import type { LayerGroup, Selection, TimelineItem } from "../../types";
import { allVisualLayers } from "../../utils/project";

function iconFor(item: TimelineItem) {
  if (item.shape) return <Shapes size={13} />;
  return item.text?.trim() ? <Type size={13} /> : <ImageIcon size={13} />;
}

export function LayersPanel() {
  const project = useStudio((s) => s.project);
  const selection = useStudio((s) => s.selection);
  const selectedIds = useStudio((s) => s.selectedIds);
  const setSelection = useStudio((s) => s.setSelection);
  const toggleSelectId = useStudio((s) => s.toggleSelectId);
  const setLayerProperty = useStudio((s) => s.setLayerProperty);
  const moveLayer = useStudio((s) => s.moveLayer);
  const duplicateClip = useStudio((s) => s.duplicateClip);
  const removeClip = useStudio((s) => s.removeClip);
  const groupSelected = useStudio((s) => s.groupSelected);
  const ungroup = useStudio((s) => s.ungroup);
  const setGroupProperty = useStudio((s) => s.setGroupProperty);
  const selectGroup = useStudio((s) => s.selectGroup);

  const [editing, setEditing] = useState<string | null>(null);
  const [draftName, setDraftName] = useState("");
  if (!project) return null;

  const layers = allVisualLayers(project).reverse();
  const groups = project.groups ?? [];
  const groupedItemIds = new Set(groups.flatMap((g) => g.itemIds));
  const ungroupedLayers = layers.filter((item) => !groupedItemIds.has(item.id));

  const commitName = (id: string, isGroup = false) => {
    const name = draftName.trim();
    if (name) {
      if (isGroup) setGroupProperty(id, { name });
      else setLayerProperty(id, { label: name });
    }
    setEditing(null);
  };

  const renderLayerRow = (item: TimelineItem, indented = false) => {
    const isSelected = selectedIds.includes(item.id) || (selection?.type === "overlay" && selection.id === item.id);
    return (
      <div
        key={item.id}
        className={`layer-row ${isSelected ? "selected" : ""} ${item.hidden ? "hidden-layer" : ""} ${indented ? "indented" : ""}`}
      >
        <button
          className="icon-btn small"
          title={item.hidden ? "Show layer" : "Hide layer"}
          onClick={(event) => {
            event.stopPropagation();
            setLayerProperty(item.id, { hidden: !item.hidden });
          }}
        >
          {item.hidden ? <EyeOff size={12} /> : <Eye size={12} />}
        </button>
        <button
          className="icon-btn small"
          title={item.locked ? "Unlock layer" : "Lock layer"}
          onClick={(event) => {
            event.stopPropagation();
            setLayerProperty(item.id, { locked: !item.locked });
          }}
        >
          {item.locked ? <Lock size={12} /> : <Unlock size={12} />}
        </button>
        <button
          className="layer-select"
          onClick={(event) => {
            if (event.shiftKey || event.ctrlKey || event.metaKey) {
              toggleSelectId(item.id);
            } else {
              setSelection({ type: "overlay", id: item.id });
            }
          }}
        >
          <span className="layer-icon">{iconFor(item)}</span>
          {editing === item.id ? (
            <input
              className="input layer-name-input"
              autoFocus
              value={draftName}
              onChange={(event) => setDraftName(event.target.value)}
              onBlur={() => commitName(item.id)}
              onKeyDown={(event) => {
                if (event.key === "Enter") commitName(item.id);
                if (event.key === "Escape") setEditing(null);
              }}
              onClick={(event) => event.stopPropagation()}
            />
          ) : (
            <span
              className="layer-name"
              title="Double-click to rename · Shift-click to multi-select"
              onDoubleClick={(event) => {
                event.stopPropagation();
                setEditing(item.id);
                setDraftName(item.label);
              }}
            >
              {item.label}
            </span>
          )}
        </button>
        {(item.keyframes?.length ?? 0) > 0 && (
          <span className="layer-kf-dot" title={`${item.keyframes!.length} keyframes`}>◆</span>
        )}
        <span className="layer-badge">{item.zIndex ?? 0}</span>
        <button className="icon-btn small" title="Move up" onClick={(event) => { event.stopPropagation(); moveLayer(item.id, 1); }}>
          <ArrowUp size={12} />
        </button>
        <button className="icon-btn small" title="Move down" onClick={(event) => { event.stopPropagation(); moveLayer(item.id, -1); }}>
          <ArrowDown size={12} />
        </button>
        <button className="icon-btn small" title="Duplicate" onClick={(event) => { event.stopPropagation(); duplicateClip(item.id); }}>
          <Copy size={12} />
        </button>
        <button className="icon-btn small" title="Delete" onClick={(event) => { event.stopPropagation(); removeClip(item.id); }}>
          <Trash2 size={12} />
        </button>
      </div>
    );
  };

  const renderGroup = (group: LayerGroup) => {
    const members = layers.filter((item) => group.itemIds.includes(item.id));
    const isSelected = selection?.type === "group" && selection.id === group.id;
    return (
      <div key={group.id} className="layer-group-block">
        <div className={`layer-row group-row ${isSelected ? "selected" : ""} ${group.hidden ? "hidden-layer" : ""}`}>
          <button
            className="icon-btn small"
            title={group.collapsed ? "Expand group" : "Collapse group"}
            onClick={() => setGroupProperty(group.id, { collapsed: !group.collapsed })}
          >
            {group.collapsed ? <ChevronRight size={12} /> : <ChevronDown size={12} />}
          </button>
          <button
            className="icon-btn small"
            title={group.hidden ? "Show group" : "Hide group"}
            onClick={() => setGroupProperty(group.id, { hidden: !group.hidden })}
          >
            {group.hidden ? <EyeOff size={12} /> : <Eye size={12} />}
          </button>
          <button
            className="icon-btn small"
            title={group.locked ? "Unlock group" : "Lock group"}
            onClick={() => setGroupProperty(group.id, { locked: !group.locked })}
          >
            {group.locked ? <Lock size={12} /> : <Unlock size={12} />}
          </button>
          <button className="layer-select" onClick={() => selectGroup(group.id)}>
            <span className="layer-icon">{group.collapsed ? <Folder size={13} /> : <FolderOpen size={13} />}</span>
            {editing === group.id ? (
              <input
                className="input layer-name-input"
                autoFocus
                value={draftName}
                onChange={(event) => setDraftName(event.target.value)}
                onBlur={() => commitName(group.id, true)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") commitName(group.id, true);
                  if (event.key === "Escape") setEditing(null);
                }}
                onClick={(event) => event.stopPropagation()}
              />
            ) : (
              <span
                className="layer-name"
                onDoubleClick={(event) => {
                  event.stopPropagation();
                  setEditing(group.id);
                  setDraftName(group.name);
                }}
              >
                {group.name}
              </span>
            )}
          </button>
          <span className="layer-badge">{members.length}</span>
          <button className="icon-btn small" title="Ungroup (Ctrl+Shift+G)" onClick={() => ungroup(group.id)}>
            <Ungroup size={12} />
          </button>
        </div>
        {!group.collapsed && members.map((member) => renderLayerRow(member, true))}
      </div>
    );
  };

  const fixedRow = (id: string, name: string, icon: ReactNode, target: Selection) => {
    const selected = selection?.type === target?.type && (selection && "id" in selection ? selection.id : null) === (target && "id" in target ? target.id : null);
    return (
      <div key={id} className={`layer-row fixed ${selected ? "selected" : ""}`} onClick={() => setSelection(target)}>
        <span className="layer-icon">{icon}</span>
        <span className="layer-name">{name}</span>
        <span className="layer-badge">BASE</span>
      </div>
    );
  };

  return (
    <div className="panel-section">
      <div className="panel-section-head">
        <span className="section-title">Layers</span>
        <span className="tiny muted">
          {selectedIds.length > 1 ? `${selectedIds.length} selected` : `${layers.length} objects`}
        </span>
      </div>
      <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
        <button
          className="btn btn-xs"
          style={{ flex: 1 }}
          disabled={selectedIds.length < 2}
          onClick={groupSelected}
          title="Group selected layers (Ctrl+G)"
        >
          <Group size={11} /> Group ({selectedIds.length})
        </button>
        {selection?.type === "group" && (
          <button className="btn btn-xs" onClick={() => ungroup(selection.id)} title="Ungroup (Ctrl+Shift+G)">
            <Ungroup size={11} /> Ungroup
          </button>
        )}
      </div>
      <p className="tiny muted" style={{ lineHeight: 1.5, marginTop: 8 }}>
        Shift+click to multi-select or drag a box on the canvas. Double-click a name to rename.
      </p>
      <div className="layer-list">
        {groups.map(renderGroup)}
        {ungroupedLayers.map((item) => renderLayerRow(item, false))}
        {fixedRow("gameplay", "Gameplay", <Film size={13} />, { type: "region", id: "gameplay" })}
        {fixedRow("facecam", "Facecam", <Film size={13} />, { type: "region", id: "facecam" })}
        {fixedRow("captions", "Captions", <Captions size={13} />, { type: "captions", id: "captions" })}
      </div>
    </div>
  );
}
