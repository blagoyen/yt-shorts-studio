import type {
  AnimationPreset,
  EasingType,
  Keyframe,
  KeyframeProperty,
  TimelineItem,
} from "../types";
import { clamp } from "./project";

export interface EvaluatedTransform {
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  opacity: number;
  scale: number;
}

export const ANIMATION_PRESETS: {
  id: AnimationPreset;
  label: string;
  category: "none" | "entrance" | "loop";
}[] = [
  { id: "none", label: "None", category: "none" },
  { id: "fade-in", label: "Fade", category: "entrance" },
  { id: "slide-up", label: "Slide Up", category: "entrance" },
  { id: "slide-down", label: "Slide Down", category: "entrance" },
  { id: "slide-left", label: "Slide Left", category: "entrance" },
  { id: "slide-right", label: "Slide Right", category: "entrance" },
  { id: "pop", label: "Pop In", category: "entrance" },
  { id: "zoom-in", label: "Zoom In", category: "entrance" },
  { id: "spin-in", label: "Spin In", category: "entrance" },
  { id: "bounce-in", label: "Bounce In", category: "entrance" },
  { id: "pulse", label: "Pulse (Loop)", category: "loop" },
  { id: "float", label: "Float (Loop)", category: "loop" },
  { id: "shake", label: "Shake (Loop)", category: "loop" },
];

export const EASING_CHOICES: { id: EasingType; label: string }[] = [
  { id: "linear", label: "Linear" },
  { id: "ease-in", label: "Ease In" },
  { id: "ease-out", label: "Ease Out" },
  { id: "ease-in-out", label: "Ease In-Out" },
  { id: "bounce", label: "Bounce" },
  { id: "elastic", label: "Elastic" },
];

export function applyEasing(t: number, easing: EasingType): number {
  const x = clamp(t, 0, 1);
  switch (easing) {
    case "linear":
      return x;
    case "ease-in":
      return x * x * x;
    case "ease-out":
      return 1 - Math.pow(1 - x, 3);
    case "ease-in-out":
      return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
    case "bounce": {
      const n1 = 7.5625;
      const d1 = 2.75;
      if (x < 1 / d1) return n1 * x * x;
      if (x < 2 / d1) {
        const y = x - 1.5 / d1;
        return n1 * y * y + 0.75;
      }
      if (x < 2.5 / d1) {
        const y = x - 2.25 / d1;
        return n1 * y * y + 0.9375;
      }
      const y = x - 2.625 / d1;
      return n1 * y * y + 0.984375;
    }
    case "elastic": {
      if (x === 0 || x === 1) return x;
      const c4 = (2 * Math.PI) / 3;
      return Math.pow(2, -10 * x) * Math.sin((x * 10 - 0.75) * c4) + 1;
    }
  }
}

export function interpolateKeyframes(
  keyframes: Keyframe[] | undefined,
  property: KeyframeProperty,
  localMs: number,
  fallback: number,
): number {
  if (!keyframes || keyframes.length === 0) return fallback;
  const list = keyframes
    .filter((kf) => kf.property === property)
    .sort((a, b) => a.timeMs - b.timeMs);
  if (list.length === 0) return fallback;
  if (localMs <= list[0].timeMs) return list[0].value;
  if (localMs >= list[list.length - 1].timeMs) return list[list.length - 1].value;

  for (let i = 0; i < list.length - 1; i++) {
    const a = list[i];
    const b = list[i + 1];
    if (localMs >= a.timeMs && localMs <= b.timeMs) {
      const span = Math.max(1, b.timeMs - a.timeMs);
      const t = applyEasing((localMs - a.timeMs) / span, b.easing ?? "ease-out");
      return a.value + (b.value - a.value) * t;
    }
  }
  return fallback;
}

function applyPresetDelta(
  preset: AnimationPreset,
  progress: number, // 0 = start of transition, 1 = fully settled
  localMs: number,
  out: EvaluatedTransform,
) {
  const e = applyEasing(progress, "ease-out");
  const inv = 1 - e;
  switch (preset) {
    case "none":
      break;
    case "fade-in":
      out.opacity *= e;
      break;
    case "slide-up":
      out.y += inv * 0.14;
      out.opacity *= e;
      break;
    case "slide-down":
      out.y -= inv * 0.14;
      out.opacity *= e;
      break;
    case "slide-left":
      out.x += inv * 0.22;
      out.opacity *= e;
      break;
    case "slide-right":
      out.x -= inv * 0.22;
      out.opacity *= e;
      break;
    case "pop": {
      const p = applyEasing(progress, "elastic");
      out.scale *= 0.2 + 0.8 * p;
      out.opacity *= clamp(progress * 2.5, 0, 1);
      break;
    }
    case "zoom-in":
      out.scale *= 0.35 + 0.65 * e;
      out.opacity *= e;
      break;
    case "spin-in":
      out.rotation -= inv * 180;
      out.scale *= 0.4 + 0.6 * e;
      out.opacity *= e;
      break;
    case "bounce-in": {
      const b = applyEasing(progress, "bounce");
      out.y -= (1 - b) * 0.16;
      out.opacity *= clamp(progress * 3, 0, 1);
      break;
    }
    case "pulse": {
      const wave = Math.sin((localMs / 1000) * Math.PI * 3);
      out.scale *= 1 + wave * 0.06;
      break;
    }
    case "float": {
      const wave = Math.sin((localMs / 1000) * Math.PI * 1.6);
      out.y += wave * 0.015;
      break;
    }
    case "shake": {
      const wave = Math.sin((localMs / 1000) * Math.PI * 16);
      out.x += wave * 0.008;
      out.rotation += wave * 2.5;
      break;
    }
  }
}

export function evaluateItemAtTime(
  item: TimelineItem,
  playheadMs: number,
): EvaluatedTransform {
  const localMs = Math.max(0, playheadMs - item.startMs);
  const duration = Math.max(1, item.durationMs);
  const animMs = clamp(item.animationDurationMs ?? 380, 80, Math.min(2000, duration / 2));

  const result: EvaluatedTransform = {
    x: interpolateKeyframes(item.keyframes, "x", localMs, item.x ?? 0.5),
    y: interpolateKeyframes(item.keyframes, "y", localMs, item.y ?? 0.5),
    width: interpolateKeyframes(item.keyframes, "width", localMs, item.width ?? 0.4),
    height: interpolateKeyframes(item.keyframes, "height", localMs, item.height ?? 0.2),
    rotation: interpolateKeyframes(item.keyframes, "rotation", localMs, item.rotation ?? 0),
    opacity: clamp(
      interpolateKeyframes(item.keyframes, "opacity", localMs, item.opacity ?? 1),
      0,
      1,
    ),
    scale: Math.max(
      0.05,
      interpolateKeyframes(item.keyframes, "scale", localMs, 1),
    ),
  };

  const entrance = item.animation ?? "none";
  if (entrance !== "none") {
    const isLoop = entrance === "pulse" || entrance === "float" || entrance === "shake";
    const progress = isLoop ? 1 : clamp(localMs / animMs, 0, 1);
    applyPresetDelta(entrance, progress, localMs, result);
  }

  const exit = item.exitAnimation ?? "none";
  if (exit !== "none") {
    const remaining = duration - localMs;
    if (remaining < animMs) {
      const progress = clamp(remaining / animMs, 0, 1);
      applyPresetDelta(exit, progress, localMs, result);
    }
  }

  result.opacity = clamp(result.opacity, 0, 1);
  return result;
}
