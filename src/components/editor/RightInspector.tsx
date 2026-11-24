import {
  AlignCenterHorizontal,
  AlignCenterVertical,
  AlignEndHorizontal,
  AlignEndVertical,
  AlignHorizontalSpaceAround,
  AlignStartHorizontal,
  AlignStartVertical,
  AlignVerticalSpaceAround,
  ArrowDown,
  ArrowUp,
  Diamond,
  Eye,
  EyeOff,
  FlipHorizontal,
  FlipVertical,
  Group,
  Lock,
  Plus,
  RotateCcw,
  SlidersHorizontal,
  Sparkles,
  Trash2,
  Ungroup,
  Unlock,
} from "lucide-react";
import { selectedTimelineItem, selectedTimelineItems, useStudio } from "../../stores/studio";
import type {
  AlignMode,
  AnimationPreset,
  BlendMode,
  CaptionStyle,
  EasingType,
  FilterPresetId,
  KeyframeProperty,
  ShapeStyle,
  TextStyle,
  TimelineItem,
  VisualEffects,
} from "../../types";
import { ANIMATION_PRESETS, EASING_CHOICES } from "../../utils/animation";
import {
  FILTER_PRESETS,
  FONT_CHOICES,
  TEXT_PRESETS,
  defaultVisualEffects,
  formatShortTime,
  formatTime,
  normalizeTextStyle,
  normalizeVisualEffects,
} from "../../utils/project";

function NumberField({ label, value, onChange, step = 1, min, max }: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  step?: number;
  min?: number;
  max?: number;
}) {
  return (
    <div className="property-row">
      <span className="field-label">{label}</span>
      <input
        className="input"
        type="number"
        style={{ width: 92, height: 28, textAlign: "right" }}
        value={Number.isFinite(value) ? Math.round(value * 100) / 100 : 0}
        step={step}
        min={min}
        max={max}
        onChange={(event) => {
          const parsed = Number(event.target.value);
          if (Number.isFinite(parsed)) onChange(parsed);
        }}
      />
    </div>
  );
}

function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  const safeHex = /^#[0-9a-f]{6}$/i.test(value) ? value : "#101010";
  return (
    <div className="property-row">
      <span className="field-label">{label}</span>
      <div className="color-row">
        <input type="color" value={safeHex} onChange={(event) => onChange(event.target.value)} />
        <input
          className="input mono"
          style={{ width: 82, height: 26 }}
          value={value}
          onChange={(event) => onChange(event.target.value)}
        />
      </div>
    </div>
  );
}

function ToggleField({ label, value, onChange }: { label: string; value: boolean; onChange: (value: boolean) => void }) {
  return (
    <div className="property-row">
      <span className="field-label">{label}</span>
      <button className={`btn btn-xs ${value ? "btn-primary" : ""}`} onClick={() => onChange(!value)}>
        {value ? "ON" : "OFF"}
      </button>
    </div>
  );
}

function SliderField({ label, value, min, max, step, display, onChange }: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  display?: string;
  onChange: (value: number) => void;
}) {
  return (
    <>
      <div className="property-row">
        <span className="field-label">{label}</span>
        <span className="mono">{display ?? value.toFixed(2)}</span>
      </div>
      <input
        className="range"
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </>
  );
}

function AlignmentBar({ count }: { count: number }) {
  const alignSelected = useStudio((s) => s.alignSelected);
  const actions: { mode: AlignMode; icon: typeof AlignStartHorizontal; title: string; minCount?: number }[] = [
    { mode: "left", icon: AlignStartHorizontal, title: "Align left" },
    { mode: "center-h", icon: AlignCenterHorizontal, title: "Align center horizontally" },
    { mode: "right", icon: AlignEndHorizontal, title: "Align right" },
    { mode: "top", icon: AlignStartVertical, title: "Align top" },
    { mode: "center-v", icon: AlignCenterVertical, title: "Align center vertically" },
    { mode: "bottom", icon: AlignEndVertical, title: "Align bottom" },
    { mode: "distribute-h", icon: AlignHorizontalSpaceAround, title: "Distribute horizontally (3+)", minCount: 3 },
    { mode: "distribute-v", icon: AlignVerticalSpaceAround, title: "Distribute vertically (3+)", minCount: 3 },
  ];
  return (
    <div className="align-bar">
      {actions.map(({ mode, icon: Icon, title, minCount }) => (
        <button
          key={mode}
          className="icon-btn small"
          title={title}
          disabled={minCount !== undefined && count < minCount}
          onClick={() => alignSelected(mode)}
        >
          <Icon size={12} />
        </button>
      ))}
    </div>
  );
}

function RegionControls({ region, patch }: { region: { fit: "fill" | "fit"; zoom: number; offsetX: number; offsetY: number }; patch: (value: Partial<typeof region>) => void }) {
  return (
    <>
      <div className="property-row">
        <span className="field-label">Fit behavior</span>
        <select className="select" style={{ width: 100, height: 28 }} value={region.fit} onChange={(event) => patch({ fit: event.target.value as "fill" | "fit" })}>
          <option value="fill">Fill</option>
          <option value="fit">Fit</option>
        </select>
      </div>
      <SliderField label="Zoom" value={Math.max(1, region.zoom)} min={1} max={3} step={0.01} display={`${region.zoom.toFixed(2)}×`} onChange={(v) => patch({ zoom: v })} />
      <NumberField label="Offset X" value={region.offsetX} step={0.01} min={-1} max={1} onChange={(value) => patch({ offsetX: value })} />
      <NumberField label="Offset Y" value={region.offsetY} step={0.01} min={-1} max={1} onChange={(value) => patch({ offsetY: value })} />
    </>
  );
}

function VisualEffectsControls({
  title,
  effects,
  showBlend = true,
  onChange,
}: {
  title: string;
  effects?: VisualEffects;
  showBlend?: boolean;
  onChange: (patch: Partial<VisualEffects>) => void;
}) {
  const fx = normalizeVisualEffects(effects);
  return (
    <div className="property-group">
      <div className="panel-section-head">
        <span className="section-title">{title}</span>
        <button
          className="icon-btn small"
          title="Reset visual effects"
          onClick={() => onChange(defaultVisualEffects())}
        >
          <RotateCcw size={11} />
        </button>
      </div>
      <div style={{ marginTop: 10 }}>
        <div className="property-row">
          <span className="field-label">Filter preset</span>
          <select
            className="select"
            style={{ width: 132, height: 28 }}
            value={fx.preset}
            onChange={(event) => {
              const presetId = event.target.value as FilterPresetId;
              const found = FILTER_PRESETS.find((p) => p.id === presetId);
              if (found) onChange({ ...found.effects, preset: presetId });
            }}
          >
            {FILTER_PRESETS.map((preset) => (
              <option key={preset.id} value={preset.id}>{preset.name}</option>
            ))}
          </select>
        </div>
        <SliderField label="Brightness" value={fx.brightness} min={-0.6} max={0.6} step={0.01} onChange={(v) => onChange({ brightness: v, preset: "none" })} />
        <SliderField label="Contrast" value={fx.contrast} min={0.3} max={2} step={0.01} onChange={(v) => onChange({ contrast: v, preset: "none" })} />
        <SliderField label="Saturation" value={fx.saturation} min={0} max={2.4} step={0.02} onChange={(v) => onChange({ saturation: v, preset: "none" })} />
        <SliderField label="Hue shift" value={fx.hue} min={-180} max={180} step={1} display={`${Math.round(fx.hue)}°`} onChange={(v) => onChange({ hue: v, preset: "none" })} />
        <SliderField label="Blur" value={fx.blur} min={0} max={24} step={0.5} display={`${fx.blur.toFixed(1)}px`} onChange={(v) => onChange({ blur: v })} />
        <SliderField label="Vignette" value={fx.vignette} min={0} max={1} step={0.02} display={`${Math.round(fx.vignette * 100)}%`} onChange={(v) => onChange({ vignette: v })} />
        {showBlend && (
          <>
            <SliderField label="Corner radius" value={fx.borderRadius} min={0} max={120} step={1} display={`${Math.round(fx.borderRadius)}px`} onChange={(v) => onChange({ borderRadius: v })} />
            <div className="property-row">
              <span className="field-label">Blend mode</span>
              <select
                className="select"
                style={{ width: 120, height: 28 }}
                value={fx.blendMode}
                onChange={(event) => onChange({ blendMode: event.target.value as BlendMode })}
              >
                {(["normal", "multiply", "screen", "overlay", "darken", "lighten"] as BlendMode[]).map((mode) => (
                  <option key={mode} value={mode}>{mode}</option>
                ))}
              </select>
            </div>
          </>
        )}
        <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
          <button className={`btn btn-xs ${fx.flipX ? "btn-primary" : ""}`} style={{ flex: 1 }} onClick={() => onChange({ flipX: !fx.flipX })}>
            <FlipHorizontal size={11} /> Flip H
          </button>
          <button className={`btn btn-xs ${fx.flipY ? "btn-primary" : ""}`} style={{ flex: 1 }} onClick={() => onChange({ flipY: !fx.flipY })}>
            <FlipVertical size={11} /> Flip V
          </button>
        </div>
      </div>
    </div>
  );
}

function AnimationAndKeyframeControls({ item }: { item: TimelineItem }) {
  const playheadMs = useStudio((s) => s.playheadMs);
  const updateClip = useStudio((s) => s.updateClip);
  const addKeyframe = useStudio((s) => s.addKeyframe);
  const updateKeyframe = useStudio((s) => s.updateKeyframe);
  const removeKeyframe = useStudio((s) => s.removeKeyframe);
  const clearKeyframes = useStudio((s) => s.clearKeyframes);
  const setPlayhead = useStudio((s) => s.setPlayhead);

  const localMs = Math.max(0, Math.min(item.durationMs, Math.round(playheadMs - item.startMs)));
  const keyframes = item.keyframes ?? [];

  const quickProps: { prop: KeyframeProperty; label: string; value: number }[] = [
    { prop: "x", label: "Pos X", value: item.x ?? 0.5 },
    { prop: "y", label: "Pos Y", value: item.y ?? 0.5 },
    { prop: "scale", label: "Scale", value: 1 },
    { prop: "rotation", label: "Rotate", value: item.rotation ?? 0 },
    { prop: "opacity", label: "Opacity", value: item.opacity ?? 1 },
  ];

  return (
    <div className="property-group">
      <div className="panel-section-head">
        <span className="section-title"><Sparkles size={10} style={{ verticalAlign: -1, marginRight: 4 }} />Animation & Keyframes</span>
        <span className="tiny muted">{keyframes.length} kf</span>
      </div>
      <div style={{ marginTop: 10 }}>
        <div className="property-row">
          <span className="field-label">Entrance / Loop</span>
          <select
            className="select"
            style={{ width: 132, height: 28 }}
            value={item.animation ?? "none"}
            onChange={(event) => updateClip(item.id, { animation: event.target.value as AnimationPreset })}
          >
            {ANIMATION_PRESETS.map((preset) => (
              <option key={preset.id} value={preset.id}>{preset.label}</option>
            ))}
          </select>
        </div>
        <div className="property-row">
          <span className="field-label">Exit</span>
          <select
            className="select"
            style={{ width: 132, height: 28 }}
            value={item.exitAnimation ?? "none"}
            onChange={(event) => updateClip(item.id, { exitAnimation: event.target.value as AnimationPreset })}
          >
            {ANIMATION_PRESETS.filter((p) => p.category !== "loop").map((preset) => (
              <option key={preset.id} value={preset.id}>{preset.label}</option>
            ))}
          </select>
        </div>
        <SliderField
          label="Transition speed"
          value={item.animationDurationMs ?? 380}
          min={100}
          max={1500}
          step={20}
          display={`${item.animationDurationMs ?? 380}ms`}
          onChange={(v) => updateClip(item.id, { animationDurationMs: v })}
        />

        <div className="panel-divider" />
        <div className="panel-section-head" style={{ marginBottom: 6 }}>
          <span className="field-label" style={{ margin: 0 }}>Keyframe at {formatShortTime(localMs)}</span>
          {keyframes.length > 0 && (
            <button className="btn btn-xs btn-quiet" onClick={() => clearKeyframes(item.id)}>Clear all</button>
          )}
        </div>
        <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginBottom: 8 }}>
          {quickProps.map((entry) => (
            <button
              key={entry.prop}
              className="btn btn-xs"
              title={`Add ${entry.label} keyframe at current playhead`}
              onClick={() => addKeyframe(item.id, entry.prop, entry.value, localMs)}
            >
              <Plus size={10} /> {entry.label}
            </button>
          ))}
        </div>

        {keyframes.length > 0 && (
          <div className="keyframe-list">
            {keyframes.map((kf) => (
              <div key={kf.id} className="keyframe-row">
                <button
                  className="kf-jump"
                  title="Jump playhead to keyframe"
                  onClick={() => setPlayhead(item.startMs + kf.timeMs)}
                >
                  <Diamond size={10} />
                  <span>{kf.property}</span>
                  <span className="mono muted">{formatShortTime(kf.timeMs)}</span>
                </button>
                <input
                  className="input mono"
                  type="number"
                  step={kf.property === "rotation" ? 5 : 0.05}
                  style={{ width: 56, height: 22, padding: "0 4px", textAlign: "right", fontSize: 10 }}
                  value={Math.round(kf.value * 100) / 100}
                  onChange={(event) => {
                    const parsed = Number(event.target.value);
                    if (Number.isFinite(parsed)) updateKeyframe(item.id, kf.id, { value: parsed });
                  }}
                />
                <select
                  className="select"
                  style={{ width: 70, height: 22, fontSize: 9, padding: "0 16px 0 4px" }}
                  value={kf.easing}
                  onChange={(event) => updateKeyframe(item.id, kf.id, { easing: event.target.value as EasingType })}
                >
                  {EASING_CHOICES.map((e) => <option key={e.id} value={e.id}>{e.label}</option>)}
                </select>
                <button className="icon-btn small" style={{ width: 20, height: 20 }} onClick={() => removeKeyframe(item.id, kf.id)}>
                  <Trash2 size={10} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function ShapeStyleControls({ item }: { item: TimelineItem }) {
  const updateShapeStyle = useStudio((s) => s.updateShapeStyle);
  if (!item.shape) return null;
  const shape = item.shape;
  const patch = (value: Partial<ShapeStyle>) => updateShapeStyle(item.id, value);
  return (
    <div className="property-group">
      <span className="section-title">Shape style</span>
      <div style={{ marginTop: 10 }}>
        <ColorField label="Fill color" value={shape.fill} onChange={(v) => patch({ fill: v })} />
        <SliderField label="Fill opacity" value={shape.fillOpacity} min={0} max={1} step={0.02} display={`${Math.round(shape.fillOpacity * 100)}%`} onChange={(v) => patch({ fillOpacity: v })} />
        <ColorField label="Stroke color" value={shape.stroke} onChange={(v) => patch({ stroke: v })} />
        <NumberField label="Stroke width" value={shape.strokeWidth} min={0} max={40} onChange={(v) => patch({ strokeWidth: Math.max(0, v) })} />
        {shape.kind !== "circle" && shape.kind !== "pill" && (
          <NumberField label="Corner radius" value={shape.borderRadius} min={0} max={200} onChange={(v) => patch({ borderRadius: Math.max(0, v) })} />
        )}
      </div>
    </div>
  );
}

function TransformControls({ item }: { item: TimelineItem }) {
  const updateClip = useStudio((s) => s.updateClip);
  const setLayerProperty = useStudio((s) => s.setLayerProperty);
  const moveLayer = useStudio((s) => s.moveLayer);
  const bringToFront = useStudio((s) => s.bringToFront);
  const sendToBack = useStudio((s) => s.sendToBack);
  const patch = (value: Partial<TimelineItem>) => updateClip(item.id, value);
  return (
    <>
      <div className="property-group">
        <div className="panel-section-head">
          <span className="section-title">Transform & Align</span>
          <span className="tiny muted">normalized</span>
        </div>
        <div style={{ marginTop: 8 }}>
          <AlignmentBar count={1} />
        </div>
        <div style={{ marginTop: 10 }}>
          <NumberField label="X" value={item.x ?? 0.5} step={0.005} onChange={(value) => patch({ x: value })} />
          <NumberField label="Y" value={item.y ?? 0.5} step={0.005} onChange={(value) => patch({ y: value })} />
          <NumberField label="Width" value={item.width ?? 0.4} step={0.005} min={0.02} onChange={(value) => patch({ width: Math.max(0.02, value) })} />
          <NumberField label="Height" value={item.height ?? 0.2} step={0.005} min={0.01} onChange={(value) => patch({ height: Math.max(0.01, value) })} />
          <NumberField label="Rotation" value={item.rotation ?? 0} step={1} onChange={(value) => patch({ rotation: value })} />
          <NumberField label="Opacity" value={item.opacity ?? 1} step={0.05} min={0} max={1} onChange={(value) => patch({ opacity: Math.max(0, Math.min(1, value)) })} />
        </div>
      </div>
      <div className="property-group">
        <span className="section-title">Layer</span>
        <div style={{ marginTop: 10 }}>
          <div className="property-row">
            <span className="field-label">Visible</span>
            <button className="icon-btn small" title={item.hidden ? "Show" : "Hide"} onClick={() => setLayerProperty(item.id, { hidden: !item.hidden })}>
              {item.hidden ? <EyeOff size={13} /> : <Eye size={13} />}
            </button>
          </div>
          <div className="property-row">
            <span className="field-label">Position locked</span>
            <button className="icon-btn small" title={item.locked ? "Unlock" : "Lock"} onClick={() => setLayerProperty(item.id, { locked: !item.locked })}>
              {item.locked ? <Lock size={13} /> : <Unlock size={13} />}
            </button>
          </div>
          <div className="property-row">
            <span className="field-label">Stacking order</span>
            <span className="mono">z {item.zIndex ?? 0}</span>
          </div>
          <div style={{ display: "flex", gap: 5, marginTop: 8, flexWrap: "wrap" }}>
            <button className="btn btn-xs" onClick={() => moveLayer(item.id, 1)}><ArrowUp size={11} /> Up</button>
            <button className="btn btn-xs" onClick={() => moveLayer(item.id, -1)}><ArrowDown size={11} /> Down</button>
            <button className="btn btn-xs" onClick={() => bringToFront(item.id)}>Front</button>
            <button className="btn btn-xs" onClick={() => sendToBack(item.id)}>Back</button>
          </div>
        </div>
      </div>
    </>
  );
}

function TextStyleControls({ item }: { item: TimelineItem }) {
  const updateClip = useStudio((s) => s.updateClip);
  const updateTextStyle = useStudio((s) => s.updateTextStyle);
  const style = normalizeTextStyle(item.textStyle);
  const patch = (value: Partial<TextStyle>) => updateTextStyle(item.id, value);

  return (
    <>
      <div className="property-group">
        <div className="panel-section-head">
          <span className="section-title">Text</span>
          <span className="tiny muted">live object</span>
        </div>
        <div style={{ marginTop: 10 }}>
          <textarea
            className="input"
            style={{ minHeight: 64, resize: "vertical" }}
            value={item.text ?? ""}
            onChange={(event) => updateClip(item.id, { text: event.target.value, label: event.target.value.split("\n")[0].slice(0, 28) || "Text" })}
          />
        </div>
        <div className="font-preview" style={{
          fontFamily: style.fontFamily,
          fontWeight: style.fontWeight,
          fontStyle: style.italic ? "italic" : "normal",
          fontSize: Math.min(34, Math.max(18, style.fontSize / 3)),
          color: style.color,
          textShadow: style.shadow ? `1px 2px 5px ${style.shadowColor}` : undefined,
        }}>
          Aa THAT WAS INSANE
        </div>
        <div className="property-row">
          <span className="field-label">Preset</span>
          <select
            className="select"
            style={{ width: 130 }}
            value=""
            onChange={(event) => {
              const preset = TEXT_PRESETS.find((candidate) => candidate.id === event.target.value);
              if (preset) patch({ ...preset.style });
            }}
          >
            <option value="">Choose preset…</option>
            {TEXT_PRESETS.map((preset) => <option key={preset.id} value={preset.id}>{preset.name}</option>)}
          </select>
        </div>
        <div className="property-row">
          <span className="field-label">Font</span>
          <input
            className="input"
            list="yt-font-faces"
            style={{ width: 130 }}
            value={style.fontFamily}
            onChange={(event) => patch({ fontFamily: event.target.value })}
          />
          <datalist id="yt-font-faces">
            {FONT_CHOICES.map((font) => <option key={font} value={font} />)}
          </datalist>
        </div>
        <NumberField label="Font size" value={style.fontSize} min={12} onChange={(value) => patch({ fontSize: Math.max(12, value) })} />
        <NumberField label="Weight" value={style.fontWeight} step={100} min={100} max={900} onChange={(value) => patch({ fontWeight: Math.max(100, Math.min(900, value)) })} />
        <div className="property-row">
          <span className="field-label">Case</span>
          <select className="select" style={{ width: 130 }} value={style.transform} onChange={(event) => patch({ transform: event.target.value as TextStyle["transform"] })}>
            <option value="none">As typed</option>
            <option value="uppercase">UPPERCASE</option>
            <option value="lowercase">lowercase</option>
          </select>
        </div>
        <div className="property-row">
          <span className="field-label">Align</span>
          <select className="select" style={{ width: 130 }} value={style.textAlign} onChange={(event) => patch({ textAlign: event.target.value as TextStyle["textAlign"] })}>
            <option value="left">Left</option>
            <option value="center">Center</option>
            <option value="right">Right</option>
          </select>
        </div>
        <ToggleField label="Italic" value={style.italic} onChange={(value) => patch({ italic: value })} />
        <ToggleField label="Underline" value={style.underline} onChange={(value) => patch({ underline: value })} />
        <NumberField label="Letter spacing" value={style.letterSpacing} step={0.5} onChange={(value) => patch({ letterSpacing: value })} />
        <NumberField label="Line height" value={style.lineHeight} step={0.05} min={0.8} onChange={(value) => patch({ lineHeight: Math.max(0.8, value) })} />
      </div>

      <div className="property-group">
        <span className="section-title">Text color & effects</span>
        <div style={{ marginTop: 10 }}>
          <ColorField label="Text color" value={style.color} onChange={(value) => patch({ color: value })} />
          <ToggleField label="Outline" value={style.outline} onChange={(value) => patch({ outline: value })} />
          {style.outline && (
            <>
              <NumberField label="Outline width" value={style.outlineWidth} min={0} onChange={(value) => patch({ outlineWidth: Math.max(0, value) })} />
              <ColorField label="Outline color" value={style.outlineColor} onChange={(value) => patch({ outlineColor: value })} />
            </>
          )}
          <ToggleField label="Shadow" value={style.shadow} onChange={(value) => patch({ shadow: value })} />
          {style.shadow && (
            <>
              <ColorField label="Shadow color" value={style.shadowColor} onChange={(value) => patch({ shadowColor: value })} />
              <NumberField label="Shadow blur" value={style.shadowBlur} min={0} onChange={(value) => patch({ shadowBlur: Math.max(0, value) })} />
              <NumberField label="Shadow X" value={style.shadowX} onChange={(value) => patch({ shadowX: value })} />
              <NumberField label="Shadow Y" value={style.shadowY} onChange={(value) => patch({ shadowY: value })} />
            </>
          )}
          <ToggleField label="Text background" value={style.background} onChange={(value) => patch({ background: value })} />
          {style.background && (
            <>
              <ColorField label="Background" value={style.backgroundColor} onChange={(value) => patch({ backgroundColor: value })} />
              <NumberField label="Opacity" value={style.backgroundOpacity} step={0.05} min={0} max={1} onChange={(value) => patch({ backgroundOpacity: Math.max(0, Math.min(1, value)) })} />
              <NumberField label="Padding" value={style.padding} min={0} onChange={(value) => patch({ padding: Math.max(0, value) })} />
            </>
          )}
        </div>
      </div>
    </>
  );
}

function CaptionGroupControls({ style }: { style: CaptionStyle }) {
  const updateCaptionStyle = useStudio((s) => s.updateCaptionStyle);
  const patch = (value: Partial<CaptionStyle>) => updateCaptionStyle({ ...value, preset: "Custom" });
  return (
    <div className="property-group">
      <span className="section-title">Caption style</span>
      <div style={{ marginTop: 10 }}>
        <div className="property-row">
          <span className="field-label">Font</span>
          <input className="input" list="yt-font-faces" style={{ width: 130 }} value={style.fontFamily} onChange={(event) => patch({ fontFamily: event.target.value })} />
        </div>
        <NumberField label="Font size" value={style.fontSize} min={12} onChange={(value) => patch({ fontSize: Math.max(12, value) })} />
        <ColorField label="Text color" value={style.color} onChange={(value) => patch({ color: value })} />
        <ColorField label="Word highlight" value={style.highlightColor} onChange={(value) => patch({ highlightColor: value })} />
        <NumberField label="Outline" value={style.outlineWidth} min={0} onChange={(value) => patch({ outlineWidth: Math.max(0, value) })} />
        <ColorField label="Outline color" value={style.outlineColor} onChange={(value) => patch({ outlineColor: value })} />
        <ToggleField label="Shadow" value={style.shadow} onChange={(value) => patch({ shadow: value })} />
        <ToggleField label="Background plate" value={style.background} onChange={(value) => patch({ background: value })} />
        {style.background && <ColorField label="Plate color" value={style.backgroundColor} onChange={(value) => patch({ backgroundColor: value })} />}
        <div className="property-row">
          <span className="field-label">Alignment</span>
          <select className="select" style={{ width: 130 }} value={style.textAlign} onChange={(event) => patch({ textAlign: event.target.value as CaptionStyle["textAlign"] })}>
            <option value="left">Left</option>
            <option value="center">Center</option>
            <option value="right">Right</option>
          </select>
        </div>
        <div className="property-row">
          <span className="field-label">Animation</span>
          <select className="select" style={{ width: 130 }} value={style.animation} onChange={(event) => patch({ animation: event.target.value as CaptionStyle["animation"] })}>
            {["none", "pop", "bounce", "fade", "scale"].map((value) => <option key={value} value={value}>{value.toUpperCase()}</option>)}
          </select>
        </div>
        <NumberField label="X" value={style.x} step={0.005} onChange={(value) => patch({ x: value })} />
        <NumberField label="Y" value={style.y} step={0.005} onChange={(value) => patch({ y: value })} />
      </div>
    </div>
  );
}

export function RightInspector() {
  const project = useStudio((s) => s.project);
  const selection = useStudio((s) => s.selection);
  const selectedIds = useStudio((s) => s.selectedIds);
  const updateClip = useStudio((s) => s.updateClip);
  const updateClipsBatch = useStudio((s) => s.updateClipsBatch);
  const updateClipEffects = useStudio((s) => s.updateClipEffects);
  const updateGlobalColorGrade = useStudio((s) => s.updateGlobalColorGrade);
  const updateRegion = useStudio((s) => s.updateRegion);
  const updateCaption = useStudio((s) => s.updateCaption);
  const setPlayhead = useStudio((s) => s.setPlayhead);
  const splitClipAtPlayhead = useStudio((s) => s.splitClipAtPlayhead);
  const duplicateClip = useStudio((s) => s.duplicateClip);
  const duplicateSelected = useStudio((s) => s.duplicateSelected);
  const removeClip = useStudio((s) => s.removeClip);
  const removeSelected = useStudio((s) => s.removeSelected);
  const groupSelected = useStudio((s) => s.groupSelected);
  const ungroup = useStudio((s) => s.ungroup);
  const addToTimeline = useStudio((s) => s.addToTimeline);
  const setModal = useStudio((s) => s.setModal);

  const clip = useStudio(selectedTimelineItem);
  const multiItems = useStudio(selectedTimelineItems);
  const media = project?.media.find((item) => item.id === clip?.mediaId || (selection?.type === "media" && selection.id === item.id));
  const caption = project?.captions.find((word) => word.id === selection?.id && selection?.type === "caption");
  const activeGroup = selection?.type === "group" ? project?.groups?.find((g) => g.id === selection.id) : null;

  const isMulti = selectedIds.length > 1 || Boolean(activeGroup);

  return (
    <aside className="inspector">
      <div className="inspector-head">
        <span className="section-title">Properties</span>
        <SlidersHorizontal size={14} className="muted" />
      </div>
      <div className="inspector-body">
        {!project ? null : isMulti ? (
          <>
            <div className="property-group">
              <div className="panel-section-head">
                <span className="section-title">{activeGroup ? activeGroup.name : "Multi-selection"}</span>
                <span className="tiny muted">{multiItems.length} layers</span>
              </div>
              <div style={{ marginTop: 10 }}>
                <AlignmentBar count={multiItems.length} />
              </div>
              <div style={{ display: "flex", gap: 6, marginTop: 10, flexWrap: "wrap" }}>
                {activeGroup ? (
                  <button className="btn btn-sm" onClick={() => ungroup(activeGroup.id)}><Ungroup size={12} /> Ungroup</button>
                ) : (
                  <button className="btn btn-sm btn-primary" onClick={groupSelected}><Group size={12} /> Group</button>
                )}
                <button className="btn btn-sm" onClick={duplicateSelected}>Duplicate all</button>
                <button className="btn btn-sm" onClick={removeSelected}>Delete all</button>
              </div>
            </div>
            <div className="property-group">
              <span className="section-title">Batch opacity</span>
              <div style={{ marginTop: 8 }}>
                <SliderField
                  label="Opacity"
                  value={multiItems[0]?.opacity ?? 1}
                  min={0}
                  max={1}
                  step={0.05}
                  onChange={(value) => {
                    const patches: Record<string, Partial<TimelineItem>> = {};
                    multiItems.forEach((item) => { patches[item.id] = { opacity: value }; });
                    updateClipsBatch(patches);
                  }}
                />
              </div>
            </div>
          </>
        ) : !selection ? (
          <>
            <div className="inspector-empty" style={{ marginBottom: 14 }}>
              Select a clip, layer, or caption to edit it, or adjust the global look below.
            </div>
            <VisualEffectsControls
              title="Global color grade"
              effects={project.layout.colorGrade}
              showBlend={false}
              onChange={updateGlobalColorGrade}
            />
          </>
        ) : selection.type === "region" ? (
          <>
            <div className="property-group">
              <span className="section-title">{selection.id === "gameplay" ? "Gameplay" : "Facecam"}</span>
              <p className="tiny muted" style={{ lineHeight: 1.6, marginTop: 8 }}>
                Drag the region directly on the preview to pan inside its crop. Zoom in first to reveal pan room.
              </p>
              <div style={{ marginTop: 8 }}>
                <RegionControls
                  region={project.layout[selection.id]}
                  patch={(value) => updateRegion(selection.id, value)}
                />
              </div>
            </div>
            <VisualEffectsControls
              title="Global color grade"
              effects={project.layout.colorGrade}
              showBlend={false}
              onChange={updateGlobalColorGrade}
            />
          </>
        ) : selection.type === "captions" ? (
          <CaptionGroupControls style={project.captionStyle} />
        ) : caption ? (
          <>
            <div className="property-group">
              <span className="section-title">Caption word</span>
              <div style={{ marginTop: 10 }}>
                <span className="field-label">Text</span>
                <input className="input" value={caption.text} onChange={(event) => updateCaption(caption.id, { text: event.target.value })} />
              </div>
              <NumberField label="Start (ms)" value={caption.startMs} onChange={(value) => updateCaption(caption.id, { startMs: Math.max(0, value) })} />
              <NumberField label="End (ms)" value={caption.endMs} onChange={(value) => updateCaption(caption.id, { endMs: Math.max(0, value) })} />
              <button className="btn btn-sm" style={{ width: "100%" }} onClick={() => setPlayhead(caption.startMs)}>
                Go to word
              </button>
            </div>
            <CaptionGroupControls style={project.captionStyle} />
          </>
        ) : clip ? (
          <>
            {Boolean(clip.text?.trim()) ? (
              <>
                <TextStyleControls item={clip} />
                <TransformControls item={clip} />
                <AnimationAndKeyframeControls item={clip} />
                <VisualEffectsControls title="Visual FX" effects={clip.effects} onChange={(p) => updateClipEffects(clip.id, p)} />
              </>
            ) : clip.shape ? (
              <>
                <ShapeStyleControls item={clip} />
                <TransformControls item={clip} />
                <AnimationAndKeyframeControls item={clip} />
                <VisualEffectsControls title="Visual FX" effects={clip.effects} onChange={(p) => updateClipEffects(clip.id, p)} />
              </>
            ) : clip.track === "overlays" || clip.track === "effects" ? (
              <>
                <TransformControls item={clip} />
                <AnimationAndKeyframeControls item={clip} />
                <VisualEffectsControls title="Visual FX" effects={clip.effects} onChange={(p) => updateClipEffects(clip.id, p)} />
              </>
            ) : null}

            <div className="property-group">
              <span className="section-title">Timing</span>
              <div className="property-value" title={clip.label} style={{ marginTop: 8 }}>{clip.label}</div>
              <NumberField label="Start (ms)" value={clip.startMs} onChange={(value) => updateClip(clip.id, { startMs: Math.max(0, value) })} />
              <NumberField label="Duration (ms)" value={clip.durationMs} onChange={(value) => updateClip(clip.id, { durationMs: Math.max(100, value) })} />
              <NumberField label="Source in (ms)" value={clip.inMs} onChange={(value) => updateClip(clip.id, { inMs: Math.max(0, value) })} />
              <div className="property-value">Ends at {formatTime(clip.startMs + clip.durationMs)}</div>
            </div>

            {clip.track === "video" && (
              <>
                <div className="property-group">
                  <span className="section-title">Playback</span>
                  <NumberField label="Speed" value={clip.speed} step={0.05} min={0.25} max={4} onChange={(value) => updateClip(clip.id, { speed: Math.max(0.25, value) })} />
                  <NumberField label="Volume" value={clip.volume ?? 1} step={0.05} min={0} max={2} onChange={(value) => updateClip(clip.id, { volume: Math.max(0, value) })} />
                </div>
                <VisualEffectsControls
                  title="Clip color grade"
                  effects={clip.effects ?? project.layout.colorGrade}
                  showBlend={false}
                  onChange={(p) => updateClipEffects(clip.id, p)}
                />
                <div className="property-group">
                  <span className="section-title">Gameplay region</span>
                  <RegionControls region={project.layout.gameplay} patch={(value) => updateRegion("gameplay", value)} />
                  <div className="panel-divider" />
                  <span className="section-title">Facecam region</span>
                  <RegionControls region={project.layout.facecam} patch={(value) => updateRegion("facecam", value)} />
                </div>
              </>
            )}

            {(clip.track === "music" || clip.track === "sfx") && (
              <div className="property-group">
                <span className="section-title">Audio</span>
                <NumberField label="Volume" value={clip.volume ?? 1} step={0.05} min={0} max={2} onChange={(value) => updateClip(clip.id, { volume: Math.max(0, value) })} />
                <NumberField label="Fade in (ms)" value={clip.fadeInMs ?? 0} onChange={(value) => updateClip(clip.id, { fadeInMs: Math.max(0, value) })} />
                <NumberField label="Fade out (ms)" value={clip.fadeOutMs ?? 0} onChange={(value) => updateClip(clip.id, { fadeOutMs: Math.max(0, value) })} />
                <ToggleField
                  label="Auto-duck under speech"
                  value={clip.audioDucking ?? (clip.track === "music")}
                  onChange={(value) => updateClip(clip.id, { audioDucking: value })}
                />
              </div>
            )}

            <div className="property-group">
              <span className="section-title">Actions</span>
              <div style={{ display: "flex", gap: 6, marginTop: 10, flexWrap: "wrap" }}>
                <button className="btn btn-sm" onClick={splitClipAtPlayhead}>Split</button>
                <button className="btn btn-sm" onClick={() => duplicateClip(clip.id)}>Duplicate</button>
                <button className="btn btn-sm" onClick={() => removeClip(clip.id)}>Delete</button>
              </div>
            </div>
          </>
        ) : media ? (
          <>
            <div className="property-group">
              <span className="section-title">Media</span>
              <div className="property-value" title={media.path}>{media.name}</div>
              <div className="property-value">{media.width}×{media.height} · {media.fps.toFixed(2)} FPS</div>
              <div className="property-value">{formatTime(media.durationMs, false)} · {media.hasAudio ? "audio" : "no audio"}</div>
              <button className="btn btn-sm" style={{ width: "100%", marginTop: 9 }} onClick={() => addToTimeline(media.id)}>
                Add to timeline
              </button>
            </div>
            {media.kind === "video" && (
              <div className="property-group">
                <span className="section-title">Crop regions</span>
                <button className="btn btn-sm" style={{ width: "100%" }} onClick={() => setModal("layout")}>Set up layout</button>
                <div className="property-value" style={{ marginTop: 8 }}>
                  Gameplay: {media.crop.gameplay ? "set" : "full frame"}
                </div>
                <div className="property-value">Facecam: {media.crop.facecam ? "set" : "full frame"}</div>
              </div>
            )}
          </>
        ) : null}
      </div>
    </aside>
  );
}
