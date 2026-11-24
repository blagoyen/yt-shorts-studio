import { useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, PointerEvent as ReactPointerEvent } from "react";
import { assetUrl } from "../../services/api";
import { useStudio } from "../../stores/studio";
import type {
  CaptionStyle,
  CanvasRect,
  MediaItem,
  ProjectFile,
  RegionSettings,
  ShapeStyle,
  TextStyle,
  TimelineItem,
} from "../../types";
import { evaluateItemAtTime } from "../../utils/animation";
import {
  CANVAS,
  FULL_RECT,
  clamp,
  cssFilterFromEffects,
  even,
  getLayoutRegions,
  normalizeTextStyle,
  rgba,
  visualItems,
  wrapTextForBox,
} from "../../utils/project";

interface Props {
  project: ProjectFile;
  playheadMs: number;
  playing: boolean;
  onTimeChange: (ms: number) => void;
}

interface DragState {
  kind: "object" | "multi" | "region" | "captions" | "marquee";
  id: string;
  mode: "move" | "resize" | "rotate" | "marquee";
  pointerId: number;
  start: { x: number; y: number };
  item?: TimelineItem;
  multiItems?: Record<string, { x: number; y: number; width: number; height: number }>;
  region?: "gameplay" | "facecam";
  regionValue?: RegionSettings;
  captionValue?: CaptionStyle;
  sx?: number;
  sy?: number;
}

interface SnapGuide {
  axis: "x" | "y";
  pos: number; // normalized 0..1
}

type TextCss = CSSProperties & { WebkitTextStroke?: string; paintOrder?: string };

const SNAP_THRESHOLD = 0.012;
const STATIC_GUIDES = [0.5, 1 / 3, 2 / 3, 0.08, 0.92];

function videoStyle(
  media: MediaItem | undefined,
  crop: { x: number; y: number; w: number; h: number },
  target: CanvasRect,
  region: RegionSettings,
  filter?: string,
  flipX?: boolean,
  flipY?: boolean,
): CSSProperties {
  const sourceW = media?.width || 1920;
  const sourceH = media?.height || 1080;
  const cropW = Math.max(1, crop.w * sourceW);
  const cropH = Math.max(1, crop.h * sourceH);
  const base = region.fit === "fill"
    ? Math.max(target.w / cropW, target.h / cropH)
    : Math.min(target.w / cropW, target.h / cropH);
  const zoom = clamp(region.zoom, 1, 6);
  const scale = base * zoom;
  const videoW = sourceW * scale;
  const videoH = sourceH * scale;
  const cropCenterX = (crop.x + crop.w / 2) * sourceW;
  const cropCenterY = (crop.y + crop.h / 2) * sourceH;
  const overflowX = Math.max(0, even(target.w * zoom) - target.w);
  const overflowY = Math.max(0, even(target.h * zoom) - target.h);
  const panX = -clamp(region.offsetX, -1, 1) * overflowX / 2;
  const panY = -clamp(region.offsetY, -1, 1) * overflowY / 2;
  const desiredX = target.w / 2 + panX;
  const desiredY = target.h / 2 + panY;
  const flips: string[] = [];
  if (flipX) flips.push("scaleX(-1)");
  if (flipY) flips.push("scaleY(-1)");
  return {
    width: `${videoW}px`,
    height: `${videoH}px`,
    left: `${desiredX - cropCenterX * scale}px`,
    top: `${desiredY - cropCenterY * scale}px`,
    filter,
    transform: flips.length ? flips.join(" ") : undefined,
  };
}

function shapeCss(shape: ShapeStyle): CSSProperties {
  return {
    width: "100%",
    height: "100%",
    background: rgba(shape.fill, shape.fillOpacity),
    border: shape.strokeWidth > 0 ? `${shape.strokeWidth}px solid ${shape.stroke}` : "none",
    borderRadius: shape.kind === "circle" ? "50%" : shape.kind === "pill" ? 9999 : shape.borderRadius,
    boxSizing: "border-box",
  };
}

function textCss(value?: TextStyle): TextCss {
  const style = normalizeTextStyle(value);
  const stroke = style.outline && style.outlineWidth > 0
    ? `${style.outlineWidth}px ${style.outlineColor}`
    : undefined;
  return {
    width: "100%",
    height: "100%",
    display: "flex",
    alignItems: "center",
    justifyContent:
      style.textAlign === "left" ? "flex-start" : style.textAlign === "right" ? "flex-end" : "center",
    textAlign: style.textAlign,
    fontFamily: style.fontFamily,
    fontSize: style.fontSize,
    fontWeight: style.fontWeight,
    fontStyle: style.italic ? "italic" : "normal",
    textDecoration: style.underline ? "underline" : "none",
    textTransform: style.transform === "uppercase" ? "uppercase" : style.transform === "lowercase" ? "lowercase" : "none",
    letterSpacing: style.letterSpacing,
    lineHeight: style.lineHeight,
    color: style.color,
    whiteSpace: "pre-wrap",
    overflow: "visible",
    WebkitTextStroke: stroke,
    paintOrder: stroke ? "stroke fill" : undefined,
    textShadow: style.shadow
      ? `${style.shadowX}px ${style.shadowY}px ${style.shadowBlur}px ${style.shadowColor}`
      : undefined,
    background: style.background ? rgba(style.backgroundColor, style.backgroundOpacity) : undefined,
    padding: style.background ? style.padding : 0,
    boxSizing: "border-box",
  };
}

function normalizeAngle(degrees: number): number {
  return ((degrees % 360) + 360) % 360;
}

export function VerticalCanvas({ project, playheadMs, playing, onTimeChange }: Props) {
  const frameRef = useRef<HTMLDivElement>(null);
  const gameplayVideo = useRef<HTMLVideoElement>(null);
  const facecamVideo = useRef<HTMLVideoElement>(null);
  const backgroundVideo = useRef<HTMLVideoElement>(null);
  const dragRef = useRef<DragState | null>(null);
  const draftsRef = useRef<Record<string, Partial<TimelineItem>>>({});
  const regionDraftRef = useRef<{ which: "gameplay" | "facecam"; patch: Partial<RegionSettings> } | null>(null);
  const captionDraftRef = useRef<Partial<CaptionStyle> | null>(null);

  const [scale, setScale] = useState(0.25);
  const [failed, setFailed] = useState(false);
  const [drafts, setDrafts] = useState<Record<string, Partial<TimelineItem>>>({});
  const [regionDraft, setRegionDraft] = useState<{ which: "gameplay" | "facecam"; patch: Partial<RegionSettings> } | null>(null);
  const [captionDraft, setCaptionDraft] = useState<Partial<CaptionStyle> | null>(null);
  const [guides, setGuides] = useState<SnapGuide[]>([]);
  const [marquee, setMarquee] = useState<{ x: number; y: number; w: number; h: number } | null>(null);

  const selection = useStudio((s) => s.selection);
  const selectedIds = useStudio((s) => s.selectedIds);
  const snap = useStudio((s) => s.snap);
  const mutedTracks = useStudio((s) => s.mutedTracks);
  const setSelection = useStudio((s) => s.setSelection);
  const setSelectedIds = useStudio((s) => s.setSelectedIds);
  const toggleSelectId = useStudio((s) => s.toggleSelectId);
  const updateClip = useStudio((s) => s.updateClip);
  const updateClipsBatch = useStudio((s) => s.updateClipsBatch);
  const updateRegion = useStudio((s) => s.updateRegion);
  const updateCaptionStyle = useStudio((s) => s.updateCaptionStyle);

  useEffect(() => {
    const element = frameRef.current;
    if (!element) return;
    const update = () => setScale(element.clientWidth / CANVAS.width);
    update();
    const observer = new ResizeObserver(update);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const activeClip = useMemo(
    () =>
      project.tracks.video.find(
        (clip) => !clip.hidden && playheadMs >= clip.startMs && playheadMs < clip.startMs + clip.durationMs,
      ) ?? null,
    [project.tracks.video, playheadMs],
  );

  const media = project.media.find((item) => item.id === activeClip?.mediaId && item.kind === "video");
  const effectiveLayout = regionDraft
    ? {
        ...project.layout,
        [regionDraft.which]: { ...project.layout[regionDraft.which], ...regionDraft.patch },
      }
    : project.layout;
  const regions = useMemo(() => getLayoutRegions(effectiveLayout), [effectiveLayout]);
  const crop = media?.crop ?? { gameplay: FULL_RECT, facecam: FULL_RECT };
  const sourceUrl = media && !media.missing ? assetUrl(media.path) : undefined;
  const objects = useMemo(() => visualItems(project, playheadMs), [project, playheadMs]);
  const videoFilter = useMemo(
    () => cssFilterFromEffects(activeClip?.effects ?? project.layout.colorGrade),
    [activeClip?.effects, project.layout.colorGrade],
  );
  const vignetteStrength = activeClip?.effects?.vignette ?? project.layout.colorGrade?.vignette ?? 0;

  useEffect(() => {
    setFailed(false);
    for (const video of [gameplayVideo.current, facecamVideo.current, backgroundVideo.current]) {
      if (!video) continue;
      video.pause();
      if (sourceUrl) video.load();
    }
  }, [sourceUrl]);

  const sourceTime = activeClip
    ? (activeClip.inMs + Math.max(0, playheadMs - activeClip.startMs) * activeClip.speed) / 1000
    : 0;

  useEffect(() => {
    const rate = clamp(activeClip?.speed ?? 1, 0.25, 4);
    const vol = mutedTracks.video ? 0 : clamp(activeClip?.volume ?? 1, 0, 1);
    for (const video of [gameplayVideo.current, facecamVideo.current, backgroundVideo.current]) {
      if (!video || !media || !video.src) continue;
      if (Math.abs(video.playbackRate - rate) > 0.01) {
        try {
          video.playbackRate = rate;
        } catch {
          // Ignore unsupported rate.
        }
      }
      if (video === gameplayVideo.current || (!regions.gameplay && video === facecamVideo.current)) {
        video.volume = vol;
      }
      const delta = Math.abs(video.currentTime - sourceTime);
      if (!playing || delta > 0.35) {
        try {
          video.currentTime = Math.min(Math.max(0, sourceTime), Math.max(0, video.duration - 0.05) || sourceTime);
        } catch {
          // Wait for metadata.
        }
      }
    }
  }, [sourceTime, playing, sourceUrl, activeClip?.speed, activeClip?.volume, mutedTracks.video, media, regions.gameplay]);

  useEffect(() => {
    for (const video of [gameplayVideo.current, facecamVideo.current, backgroundVideo.current]) {
      if (!video || !media || !video.src) continue;
      if (playing) {
        void video.play().catch(() => setFailed(true));
      } else {
        video.pause();
      }
    }
  }, [playing, sourceUrl, media]);

  const handleTimeUpdate = (source: HTMLVideoElement | null) => {
    if (!source || !playing || !activeClip) return;
    const next = activeClip.startMs + (source.currentTime * 1000 - activeClip.inMs) / activeClip.speed;
    if (Math.abs(next - playheadMs) > 20) {
      onTimeChange(clamp(next, activeClip.startMs, activeClip.startMs + activeClip.durationMs));
    }
  };

  const pointFromEvent = (event: ReactPointerEvent): { x: number; y: number } => {
    const rect = frameRef.current?.getBoundingClientRect();
    if (!rect || rect.width === 0 || rect.height === 0) return { x: 0, y: 0 };
    return {
      x: clamp((event.clientX - rect.left) / rect.width, 0, 1),
      y: clamp((event.clientY - rect.top) / rect.height, 0, 1),
    };
  };

  const computeSnap = (
    targetX: number,
    targetY: number,
    excludeIds: Set<string>,
  ): { x: number; y: number; activeGuides: SnapGuide[] } => {
    if (!snap) return { x: targetX, y: targetY, activeGuides: [] };
    const xCandidates = [...STATIC_GUIDES];
    const yCandidates = [...STATIC_GUIDES];
    for (const other of objects) {
      if (excludeIds.has(other.id)) continue;
      xCandidates.push(other.x ?? 0.5);
      yCandidates.push(other.y ?? 0.5);
    }
    let sx = targetX;
    let sy = targetY;
    const activeGuides: SnapGuide[] = [];
    for (const c of xCandidates) {
      if (Math.abs(targetX - c) < SNAP_THRESHOLD) {
        sx = c;
        activeGuides.push({ axis: "x", pos: c });
        break;
      }
    }
    for (const c of yCandidates) {
      if (Math.abs(targetY - c) < SNAP_THRESHOLD) {
        sy = c;
        activeGuides.push({ axis: "y", pos: c });
        break;
      }
    }
    return { x: sx, y: sy, activeGuides };
  };

  const capture = (event: ReactPointerEvent, drag: DragState) => {
    event.stopPropagation();
    event.preventDefault();
    dragRef.current = drag;
    draftsRef.current = {};
    regionDraftRef.current = null;
    captionDraftRef.current = null;
    setDrafts({});
    setRegionDraft(null);
    setCaptionDraft(null);
    setGuides([]);
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      // Best-effort capture.
    }
  };

  const beginObjectDrag = (
    event: ReactPointerEvent,
    item: TimelineItem,
    mode: "move" | "resize" | "rotate",
    handle?: { sx: number; sy: number },
  ) => {
    if (event.shiftKey || event.ctrlKey || event.metaKey) {
      event.stopPropagation();
      toggleSelectId(item.id);
      return;
    }

    // If item belongs to a group and user clicks without Alt, select whole group.
    if (!event.altKey && item.groupId && mode === "move") {
      const group = project.groups?.find((g) => g.id === item.groupId);
      if (group && group.itemIds.length > 1) {
        const multiItems: Record<string, { x: number; y: number; width: number; height: number }> = {};
        for (const memberId of group.itemIds) {
          const member = objects.find((o) => o.id === memberId);
          if (member && !member.locked) {
            multiItems[member.id] = {
              x: member.x ?? 0.5,
              y: member.y ?? 0.5,
              width: member.width ?? 0.4,
              height: member.height ?? 0.2,
            };
          }
        }
        setSelection({ type: "group", id: group.id });
        if (Object.keys(multiItems).length > 0 && !group.locked) {
          capture(event, {
            kind: "multi",
            id: group.id,
            mode: "move",
            pointerId: event.pointerId,
            start: pointFromEvent(event),
            multiItems,
          });
        }
        return;
      }
    }

    // If item is part of an active multi-selection and mode is move, move all selected together.
    if (mode === "move" && selectedIds.length > 1 && selectedIds.includes(item.id)) {
      const multiItems: Record<string, { x: number; y: number; width: number; height: number }> = {};
      for (const id of selectedIds) {
        const target = objects.find((o) => o.id === id);
        if (target && !target.locked) {
          multiItems[target.id] = {
            x: target.x ?? 0.5,
            y: target.y ?? 0.5,
            width: target.width ?? 0.4,
            height: target.height ?? 0.2,
          };
        }
      }
      if (Object.keys(multiItems).length > 0) {
        capture(event, {
          kind: "multi",
          id: item.id,
          mode: "move",
          pointerId: event.pointerId,
          start: pointFromEvent(event),
          multiItems,
        });
        return;
      }
    }

    if (item.locked) {
      event.stopPropagation();
      setSelection({ type: "overlay", id: item.id });
      return;
    }

    setSelection({ type: "overlay", id: item.id });
    capture(event, {
      kind: "object",
      id: item.id,
      mode,
      pointerId: event.pointerId,
      start: pointFromEvent(event),
      item: { ...item },
      sx: handle?.sx,
      sy: handle?.sy,
    });
  };

  const beginMarquee = (event: ReactPointerEvent) => {
    const start = pointFromEvent(event);
    setSelection(null);
    setMarquee({ x: start.x, y: start.y, w: 0, h: 0 });
    capture(event, {
      kind: "marquee",
      id: "marquee",
      mode: "marquee",
      pointerId: event.pointerId,
      start,
    });
  };

  const beginRegionDrag = (event: ReactPointerEvent, which: "gameplay" | "facecam") => {
    if (event.shiftKey) {
      beginMarquee(event);
      return;
    }
    event.stopPropagation();
    setSelection({ type: "region", id: which });
    capture(event, {
      kind: "region",
      id: which,
      mode: "move",
      pointerId: event.pointerId,
      start: pointFromEvent(event),
      region: which,
      regionValue: { ...project.layout[which] },
    });
  };

  const beginCaptionDrag = (event: ReactPointerEvent) => {
    event.stopPropagation();
    setSelection({ type: "captions", id: "captions" });
    capture(event, {
      kind: "captions",
      id: "captions",
      mode: "move",
      pointerId: event.pointerId,
      start: pointFromEvent(event),
      captionValue: { ...project.captionStyle },
    });
  };

  const publishDrafts = (next: Record<string, Partial<TimelineItem>>) => {
    draftsRef.current = next;
    setDrafts(next);
  };

  const handlePointerMove = (event: ReactPointerEvent) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const point = pointFromEvent(event);
    const dx = point.x - drag.start.x;
    const dy = point.y - drag.start.y;

    if (drag.kind === "marquee") {
      const x = Math.min(drag.start.x, point.x);
      const y = Math.min(drag.start.y, point.y);
      const w = Math.abs(point.x - drag.start.x);
      const h = Math.abs(point.y - drag.start.y);
      setMarquee({ x, y, w, h });
      const hits = objects
        .filter((item) => {
          if (item.locked) return false;
          const ix = item.x ?? 0.5;
          const iy = item.y ?? 0.5;
          return ix >= x && ix <= x + w && iy >= y && iy <= y + h;
        })
        .map((item) => item.id);
      if (hits.length) setSelectedIds(hits);
      return;
    }

    if (drag.kind === "multi" && drag.multiItems) {
      const ids = Object.keys(drag.multiItems);
      const xs = ids.map((id) => drag.multiItems![id].x);
      const ys = ids.map((id) => drag.multiItems![id].y);
      const centerX = (Math.min(...xs) + Math.max(...xs)) / 2;
      const centerY = (Math.min(...ys) + Math.max(...ys)) / 2;
      const snapped = computeSnap(centerX + dx, centerY + dy, new Set(ids));
      const adjDx = snapped.x - centerX;
      const adjDy = snapped.y - centerY;
      setGuides(snapped.activeGuides);
      const next: Record<string, Partial<TimelineItem>> = {};
      for (const id of ids) {
        const orig = drag.multiItems[id];
        next[id] = {
          x: clamp(orig.x + adjDx, 0, 1),
          y: clamp(orig.y + adjDy, 0, 1),
        };
      }
      publishDrafts(next);
      return;
    }

    if (drag.kind === "object" && drag.item) {
      const item = drag.item;
      if (drag.mode === "move") {
        const rawX = clamp((item.x ?? 0.5) + dx, 0, 1);
        const rawY = clamp((item.y ?? 0.5) + dy, 0, 1);
        const snapped = computeSnap(rawX, rawY, new Set([drag.id]));
        setGuides(snapped.activeGuides);
        publishDrafts({ [drag.id]: { x: snapped.x, y: snapped.y } });
        return;
      }
      const centerX = (item.x ?? 0.5) * CANVAS.width;
      const centerY = (item.y ?? 0.5) * CANVAS.height;
      if (drag.mode === "rotate") {
        const angle = Math.atan2(
          (point.y - (item.y ?? 0.5)) * CANVAS.height,
          (point.x - (item.x ?? 0.5)) * CANVAS.width,
        ) * 180 / Math.PI + 90;
        let rotation = normalizeAngle(angle);
        if (event.shiftKey) rotation = Math.round(rotation / 15) * 15;
        publishDrafts({ [drag.id]: { rotation: Math.round(rotation * 10) / 10 } });
        return;
      }
      const sx = drag.sx ?? 1;
      const sy = drag.sy ?? 1;
      const width = (item.width ?? 0.4) * CANVAS.width;
      const height = (item.height ?? 0.2) * CANVAS.height;
      const fixedX = centerX - sx * width / 2;
      const fixedY = centerY - sy * height / 2;
      const pointerX = point.x * CANVAS.width;
      const pointerY = point.y * CANVAS.height;
      let nextWidth = sx === 0 ? width : Math.max(24, Math.abs(pointerX - fixedX));
      let nextHeight = sy === 0 ? height : Math.max(24, Math.abs(pointerY - fixedY));
      if (event.shiftKey && sx !== 0 && sy !== 0) {
        const aspect = width / Math.max(1, height);
        nextHeight = nextWidth / aspect;
      }
      const nextCenterX = fixedX + sx * nextWidth / 2;
      const nextCenterY = fixedY + sy * nextHeight / 2;
      publishDrafts({
        [drag.id]: {
          x: clamp(nextCenterX / CANVAS.width, 0, 1),
          y: clamp(nextCenterY / CANVAS.height, 0, 1),
          width: clamp(nextWidth / CANVAS.width, 0.02, 1),
          height: clamp(nextHeight / CANVAS.height, 0.01, 1),
        },
      });
      return;
    }

    if (drag.kind === "region" && drag.region && drag.regionValue) {
      const current = drag.regionValue;
      const stretch = Math.max(0.05, current.zoom - 1);
      const patch = {
        offsetX: clamp(current.offsetX - dx * 2 / stretch, -1, 1),
        offsetY: clamp(current.offsetY - dy * 2 / stretch, -1, 1),
      };
      const next = { which: drag.region, patch };
      regionDraftRef.current = next;
      setRegionDraft(next);
      return;
    }

    if (drag.kind === "captions" && drag.captionValue) {
      const style = drag.captionValue;
      const rawX = clamp(style.x + dx, 0, 1);
      const rawY = clamp(style.y + dy, 0, 1);
      const snapped = computeSnap(rawX, rawY, new Set());
      setGuides(snapped.activeGuides);
      const patch = { x: snapped.x, y: snapped.y };
      captionDraftRef.current = patch;
      setCaptionDraft(patch);
    }
  };

  const finishDrag = (event: ReactPointerEvent) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const pending = draftsRef.current;
    const pendingKeys = Object.keys(pending);
    if (drag.kind === "object" && pendingKeys.length === 1) {
      updateClip(pendingKeys[0], pending[pendingKeys[0]]);
    } else if (drag.kind === "multi" && pendingKeys.length > 0) {
      updateClipsBatch(pending);
    }
    const regionPending = regionDraftRef.current;
    if (drag.kind === "region" && regionPending) {
      updateRegion(regionPending.which, regionPending.patch);
    }
    const captionPending = captionDraftRef.current;
    if (drag.kind === "captions" && captionPending) {
      updateCaptionStyle(captionPending);
    }
    dragRef.current = null;
    draftsRef.current = {};
    regionDraftRef.current = null;
    captionDraftRef.current = null;
    setDrafts({});
    setRegionDraft(null);
    setCaptionDraft(null);
    setGuides([]);
    setMarquee(null);
    try {
      event.currentTarget.releasePointerCapture(event.pointerId);
    } catch {
      // Already released.
    }
  };

  const applied = (item: TimelineItem): TimelineItem =>
    drafts[item.id] ? { ...item, ...drafts[item.id] } : item;

  const renderVideoRegion = (
    id: "gameplay" | "facecam",
    region: CanvasRect | null,
    rect: { x: number; y: number; w: number; h: number },
    settings: RegionSettings,
    mirrored: boolean,
  ) => {
    if (!region || !media || media.missing) return null;
    const border = project.layout.borderWidth;
    const selected = selection?.type === "region" && selection.id === id;
    const isPrimaryAudio = !mirrored || !regions.gameplay;
    const flipX = activeClip?.effects?.flipX ?? project.layout.colorGrade?.flipX;
    const flipY = activeClip?.effects?.flipY ?? project.layout.colorGrade?.flipY;
    return (
      <div
        key={id}
        className={`canvas-region video ${selected ? "canvas-region-selected" : ""}`}
        style={{
          left: region.x,
          top: region.y,
          width: region.w,
          height: region.h,
          borderRadius: mirrored ? project.layout.facecamRadius : 0,
        }}
        onPointerDown={(event) => beginRegionDrag(event, id)}
      >
        <video
          ref={mirrored ? facecamVideo : gameplayVideo}
          src={sourceUrl}
          preload="auto"
          muted={!isPrimaryAudio || mutedTracks.video}
          playsInline
          style={videoStyle(media, rect, region, settings, videoFilter, flipX, flipY)}
          onTimeUpdate={isPrimaryAudio ? (e) => handleTimeUpdate(e.currentTarget) : undefined}
          onError={() => setFailed(true)}
        />
        {border > 0 && (
          <div
            className="canvas-region-border"
            style={{ border: `${border}px solid ${project.layout.borderColor}`, borderRadius: mirrored ? project.layout.facecamRadius : 0 }}
          />
        )}
      </div>
    );
  };

  const renderObject = (source: TimelineItem) => {
    const item = applied(source);
    const isDrafting = Boolean(drafts[item.id]);
    const evaluated = isDrafting
      ? {
          x: item.x ?? 0.5,
          y: item.y ?? 0.5,
          width: item.width ?? 0.4,
          height: item.height ?? 0.2,
          rotation: item.rotation ?? 0,
          opacity: item.opacity ?? 1,
          scale: 1,
        }
      : evaluateItemAtTime(item, playheadMs);

    const isSelected = selectedIds.includes(item.id) || (selection?.type === "overlay" && selection.id === item.id);
    const singleSelected = isSelected && selectedIds.length <= 1;
    const image = item.mediaId ? project.media.find((candidate) => candidate.id === item.mediaId) : undefined;
    const isText = Boolean(item.text?.trim());
    const isShape = Boolean(item.shape);
    const textStyle = isText ? normalizeTextStyle(item.textStyle) : null;
    const text = isText && textStyle
      ? wrapTextForBox(
          item.text ?? "",
          evaluated.width * CANVAS.width,
          textStyle.fontSize,
          textStyle.letterSpacing,
        )
      : "";

    const fx = item.effects;
    const itemFilter = cssFilterFromEffects(fx);
    const scaleX = (fx?.flipX ? -1 : 1) * evaluated.scale;
    const scaleY = (fx?.flipY ? -1 : 1) * evaluated.scale;

    const styleObj: CSSProperties = {
      position: "absolute",
      left: `${evaluated.x * 100}%`,
      top: `${evaluated.y * 100}%`,
      width: `${evaluated.width * 100}%`,
      height: `${evaluated.height * 100}%`,
      transform: `translate(-50%, -50%) rotate(${evaluated.rotation}deg) scale(${scaleX}, ${scaleY})`,
      transformOrigin: "center center",
      opacity: evaluated.opacity,
      filter: itemFilter,
      mixBlendMode: fx?.blendMode && fx.blendMode !== "normal" ? fx.blendMode : undefined,
      borderRadius: fx?.borderRadius ? `${fx.borderRadius}px` : undefined,
    };

    return (
      <div
        key={item.id}
        className={`canvas-object ${isSelected ? "selected" : ""} ${item.locked ? "locked" : ""}`}
        style={styleObj}
        onPointerDown={(event) => beginObjectDrag(event, item, "move")}
        data-canvas-object={item.id}
      >
        {isShape && item.shape ? (
          <div className="canvas-shape" style={shapeCss(item.shape)} />
        ) : isText && textStyle ? (
          <div className="canvas-text" style={textCss(textStyle)}>{text}</div>
        ) : image && !image.missing ? (
          <img
            className="canvas-image"
            src={assetUrl(image.path)}
            alt=""
            draggable={false}
            style={{ borderRadius: fx?.borderRadius ? `${fx.borderRadius}px` : undefined }}
          />
        ) : null}
        {singleSelected && !item.locked && (
          <>
            {[
              { key: "nw", sx: -1, sy: -1 },
              { key: "ne", sx: 1, sy: -1 },
              { key: "sw", sx: -1, sy: 1 },
              { key: "se", sx: 1, sy: 1 },
            ].map((handle) => (
              <div
                key={handle.key}
                className={`canvas-handle ${handle.key}`}
                onPointerDown={(event) => beginObjectDrag(event, item, "resize", handle)}
              />
            ))}
            <div
              className="canvas-rotate-handle"
              onPointerDown={(event) => beginObjectDrag(event, item, "rotate")}
              title="Drag to rotate (Shift = 15° snap)"
            />
          </>
        )}
      </div>
    );
  };

  // Multi-selection group bounding box
  const multiBounds = useMemo(() => {
    if (selectedIds.length < 2) return null;
    const selectedObjects = objects.filter((item) => selectedIds.includes(item.id)).map(applied);
    if (selectedObjects.length < 2) return null;
    let minX = 1;
    let minY = 1;
    let maxX = 0;
    let maxY = 0;
    for (const item of selectedObjects) {
      const x = item.x ?? 0.5;
      const y = item.y ?? 0.5;
      const w = item.width ?? 0.4;
      const h = item.height ?? 0.2;
      minX = Math.min(minX, x - w / 2);
      maxX = Math.max(maxX, x + w / 2);
      minY = Math.min(minY, y - h / 2);
      maxY = Math.max(maxY, y + h / 2);
    }
    return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
  }, [selectedIds, objects, drafts]);

  const activeWord = !mutedTracks.captions
    ? project.captions.find((word) => playheadMs >= word.startMs && playheadMs < word.endMs)
    : undefined;
  const activeGroup = activeWord
    ? project.captions.filter((word) => word.groupId === activeWord.groupId)
    : [];
  const style = { ...project.captionStyle, ...(captionDraft ?? {}) };
  const captionPosition = { left: `${style.x * 100}%`, top: `${style.y * 100}%` };
  const captionSelected = selection?.type === "captions";
  const captionTextShadow = [
    style.shadow ? "0 4px 14px rgba(0,0,0,.55)" : "",
    style.outlineWidth > 0
      ? `${style.outlineWidth}px ${style.outlineWidth}px 0 ${style.outlineColor}, -${style.outlineWidth}px -${style.outlineWidth}px 0 ${style.outlineColor}, ${style.outlineWidth}px -${style.outlineWidth}px 0 ${style.outlineColor}, -${style.outlineWidth}px ${style.outlineWidth}px 0 ${style.outlineColor}`
      : "",
  ]
    .filter(Boolean)
    .join(", ");

  return (
    <div
      className="canvas-frame"
      ref={frameRef}
      onPointerMove={handlePointerMove}
      onPointerUp={finishDrag}
      onPointerCancel={finishDrag}
    >
      <div className="canvas-root" style={{ width: CANVAS.width, height: CANVAS.height, transform: `scale(${scale})` }}>
        <div
          className="canvas-bg"
          style={{
            background:
              project.layout.background.type === "solid"
                ? project.layout.background.color
                : project.layout.background.type === "image" && project.layout.background.imagePath
                  ? `url("${assetUrl(project.layout.background.imagePath)}") center/cover`
                  : "#101010",
          }}
          onPointerDown={beginMarquee}
        />
        {project.layout.background.type === "blur" && media && (
          <video
            key="background"
            ref={backgroundVideo}
            muted
            playsInline
            preload="auto"
            src={sourceUrl}
            style={{
              position: "absolute",
              inset: -80,
              width: CANVAS.width + 160,
              height: CANVAS.height + 160,
              objectFit: "cover",
              filter: `blur(${project.layout.background.blur}px) brightness(0.55)`,
              opacity: 0.85,
              pointerEvents: "none",
            }}
          />
        )}
        {renderVideoRegion("gameplay", regions.gameplay, crop.gameplay ?? FULL_RECT, effectiveLayout.gameplay, false)}
        {renderVideoRegion("facecam", regions.facecam, crop.facecam ?? FULL_RECT, effectiveLayout.facecam, true)}

        {vignetteStrength > 0.01 && (
          <div
            className="canvas-vignette"
            style={{
              background: `radial-gradient(ellipse at center, transparent 42%, rgba(0,0,0,${clamp(vignetteStrength * 0.88, 0, 0.92).toFixed(2)}) 100%)`,
            }}
          />
        )}

        {!mutedTracks.overlays && objects.map(renderObject)}

        {activeGroup.length > 0 && (
          <div
            className={`canvas-caption ${captionSelected ? "selected" : ""}`}
            style={{
              ...captionPosition,
              transform: "translate(-50%, -50%)",
              fontFamily: style.fontFamily,
              fontSize: style.fontSize,
              fontWeight: style.fontWeight,
              color: style.color,
              textTransform: style.uppercase ? "uppercase" : "none",
              letterSpacing: "0.01em",
              textShadow: captionTextShadow || undefined,
              background: style.background ? style.backgroundColor : undefined,
              padding: style.background ? "12px 28px" : undefined,
              justifyContent:
                style.textAlign === "left" ? "flex-start" : style.textAlign === "right" ? "flex-end" : "center",
            }}
            onPointerDown={beginCaptionDrag}
          >
            {activeGroup.map((word) => {
              const isActive = word.id === activeWord?.id;
              return (
                <span
                  key={word.id}
                  className={`caption-word ${isActive ? "active" : ""}`}
                  style={{
                    color: isActive ? style.highlightColor : style.color,
                    transform:
                      isActive && (style.animation === "pop" || style.animation === "scale")
                        ? "scale(1.08)"
                        : isActive && style.animation === "bounce"
                          ? "translateY(-5px)"
                          : undefined,
                    opacity: style.animation === "fade" ? (isActive ? 1 : 0.65) : 1,
                  }}
                >
                  {word.text}{" "}
                </span>
              );
            })}
          </div>
        )}

        {multiBounds && (
          <div
            className="canvas-multi-box"
            style={{
              left: `${multiBounds.x * 100}%`,
              top: `${multiBounds.y * 100}%`,
              width: `${multiBounds.w * 100}%`,
              height: `${multiBounds.h * 100}%`,
            }}
          />
        )}

        {guides.map((guide, index) => (
          <div
            key={`${guide.axis}-${index}`}
            className={`snap-guide ${guide.axis}`}
            style={guide.axis === "x" ? { left: `${guide.pos * 100}%` } : { top: `${guide.pos * 100}%` }}
          />
        ))}

        {marquee && marquee.w > 0.005 && marquee.h > 0.005 && (
          <div
            className="canvas-marquee"
            style={{
              left: `${marquee.x * 100}%`,
              top: `${marquee.y * 100}%`,
              width: `${marquee.w * 100}%`,
              height: `${marquee.h * 100}%`,
            }}
          />
        )}

        {project.layout.safeArea && <div className="safe-area" />}
        {!media && objects.length === 0 && (
          <div className="canvas-placeholder">
            Import a clip, add text, or drop a shape to begin
          </div>
        )}
        {media && failed && (
          <div className="canvas-placeholder">Preview unavailable — check the source file</div>
        )}
      </div>
    </div>
  );
}
