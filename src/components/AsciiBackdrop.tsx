import { memo, useEffect, useRef } from "react";

interface AsciiBackdropProps {
  variant?: "ambient" | "band";
}

const clamp = (v: number, a = 0, b = 1) => (v < a ? a : v > b ? b : v);
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const smooth = (t: number) => t * t * (3 - 2 * t);
const TAU = Math.PI * 2;

function rng(seed = 7) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hash2(x: number, y: number, s: number): number {
  let h = (x * 374761393 + y * 668265263 + s * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

function noise2(x: number, y: number, seed = 0): number {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const xf = smooth(x - xi);
  const yf = smooth(y - yi);
  const a = hash2(xi, yi, seed);
  const b = hash2(xi + 1, yi, seed);
  const c = hash2(xi, yi + 1, seed);
  const d = hash2(xi + 1, yi + 1, seed);
  return lerp(lerp(a, b, xf), lerp(c, d, xf), yf);
}

function fbm(x: number, y: number, octaves = 4, seed = 0): number {
  let v = 0;
  let amp = 0.5;
  let f = 1;
  let norm = 0;
  for (let i = 0; i < octaves; i++) {
    v += amp * noise2(x * f, y * f, seed + i * 17);
    norm += amp;
    amp *= 0.5;
    f *= 2;
  }
  return v / norm;
}

function gradient(stops: string[], n: number): string[] {
  const rgb = stops.map((h) => [
    parseInt(h.slice(1, 3), 16),
    parseInt(h.slice(3, 5), 16),
    parseInt(h.slice(5, 7), 16),
  ]);
  const out: string[] = [];
  for (let i = 0; i < n; i++) {
    const t = (i / (n - 1)) * (rgb.length - 1);
    const j = Math.min(rgb.length - 2, Math.floor(t));
    const f = t - j;
    const c = rgb[j].map((v, k) => Math.round(lerp(v, rgb[j + 1][k], f)));
    out.push("#" + c.map((v) => v.toString(16).padStart(2, "0")).join(""));
  }
  return out;
}

const SKY = gradient(["#0e1838", "#24396e", "#4a6aa8", "#8aa6d6"], 10);
const SEA = gradient(["#071226", "#123063", "#2c5a9a", "#6b93cc"], 10);
const MOON = gradient(["#f7e7a8", "#fff8e0"], 4);
const STAR_COLOR = "#dfe8ff";
const PALETTE = [...SKY, ...SEA, ...MOON, STAR_COLOR];

const TARGET_FPS = 18;
const FRAME_INTERVAL_MS = 1000 / TARGET_FPS;

export const AsciiBackdrop = memo(function AsciiBackdrop({
  variant = "ambient",
}: AsciiBackdropProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d", { alpha: true });
    if (!ctx) return;

    const pitch = variant === "band" ? 9 : 14;
    let width = 0;
    let height = 0;
    let cols = 0;
    let rows = 0;
    let offsetX = 0;
    let offsetY = 0;
    let stars: Array<[number, number, number]> = [];
    let radii = new Float32Array(0);
    let colors = new Uint8Array(0);

    const resize = () => {
      const parent = variant === "band" ? canvas.parentElement : null;
      const cssW = parent ? parent.clientWidth : window.innerWidth;
      const cssH = parent ? parent.clientHeight : window.innerHeight;
      if (cssW <= 0 || cssH <= 0) return;

      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = cssW;
      height = cssH;
      canvas.width = Math.round(cssW * dpr);
      canvas.height = Math.round(cssH * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      cols = Math.max(16, Math.floor(cssW / pitch));
      rows = Math.max(10, Math.floor(cssH / pitch));
      offsetX = (cssW - cols * pitch) * 0.5 + pitch * 0.5;
      offsetY = (cssH - rows * pitch) * 0.5 + pitch * 0.5;

      radii = new Float32Array(cols * rows);
      colors = new Uint8Array(cols * rows);

      const horizon = Math.floor(rows * 0.56);
      const r = rng(7);
      const starCount = variant === "band" ? 45 : 75;
      stars = Array.from({ length: starCount }, () => [
        Math.floor(r() * cols),
        Math.floor(r() * Math.max(1, horizon - 3)),
        r() * TAU,
      ]);
    };

    resize();
    const observer =
      variant === "band" && canvas.parentElement
        ? new ResizeObserver(resize)
        : null;
    if (observer && canvas.parentElement) observer.observe(canvas.parentElement);
    window.addEventListener("resize", resize);

    const drawFrame = (t: number) => {
      if (width <= 0 || height <= 0 || cols === 0 || rows === 0) return;

      const horizon = Math.floor(rows * 0.56);
      const mx = cols * (variant === "band" ? 0.68 : 0.72);
      const my = rows * 0.27;
      const mr = Math.max(3.6, Math.min(cols, rows) * (variant === "band" ? 0.19 : 0.14));
      const maxR = pitch * 0.46;
      const sxScale = 96 / cols;
      const syScale = 36 / rows;

      for (let y = 0; y < horizon; y++) {
        const yOff = y * cols;
        const ny = y * syScale;
        for (let x = 0; x < cols; x++) {
          const nx = x * sxScale;
          const dm = Math.hypot((x - mx) * sxScale * 0.5, (y - my) * syScale);
          const glow = Math.exp(-dm / 9);
          const cloud = fbm(nx * 0.035 + t * 0.04, ny * 0.16, 4);
          const v = clamp(0.22 + (y / Math.max(1, horizon)) * 0.35 + glow * 0.52 + (cloud - 0.5) * 0.58);
          radii[yOff + x] = maxR * (0.16 + v * 0.78);
          colors[yOff + x] = Math.min(9, Math.floor(v * 10));
        }
      }

      for (let i = 0; i < stars.length; i++) {
        const [sx, sy, ph] = stars[i];
        const tw = Math.sin(t * 1.6 + ph);
        if (tw > 0.15 && sx < cols && sy < horizon) {
          radii[sy * cols + sx] = maxR * (0.36 + tw * 0.44);
          colors[sy * cols + sx] = 24;
        }
      }

      const minMy = Math.max(0, Math.floor(my - mr - 1));
      const maxMy = Math.min(horizon - 1, Math.ceil(my + mr + 1));
      const minMx = Math.max(0, Math.floor(mx - mr - 1));
      const maxMx = Math.min(cols - 1, Math.ceil(mx + mr + 1));
      for (let y = minMy; y <= maxMy; y++) {
        const yOff = y * cols;
        for (let x = minMx; x <= maxMx; x++) {
          const d = Math.hypot(x - mx, y - my) / mr;
          if (d < 1) {
            const crater = fbm(x * sxScale * 0.4, y * syScale * 0.8, 2) > 0.62;
            const limb = 1 - d * 0.32;
            radii[yOff + x] = maxR * clamp((crater ? 0.72 : 0.96) * limb, 0.35, 1.0);
            colors[yOff + x] =
              20 + Math.min(3, Math.max(0, Math.floor((1 - d) * 4 + (crater ? -1 : 0))));
          }
        }
      }

      for (let y = horizon; y < rows; y++) {
        const yOff = y * cols;
        const ny = y * syScale;
        const depth = (y - horizon) / Math.max(1, rows - horizon);
        for (let x = 0; x < cols; x++) {
          const nx = x * sxScale;
          const w = fbm(nx * 0.07 - t * 0.3, ny * 0.6 + t * 0.1, 3);
          const beam = Math.exp(-((((x - mx) * sxScale) / (4 + depth * 12)) ** 2));
          const glint =
            beam *
            (0.55 + 0.45 * Math.sin(t * 2.6 + nx * 0.6 + ny * 1.3)) *
            (w > 0.45 ? 1 : 0.4);
          if (glint > 0.48) {
            radii[yOff + x] = maxR * (0.58 + clamp(glint, 0, 1) * 0.4);
            colors[yOff + x] = 20 + (glint > 0.78 ? 3 : 1);
          } else {
            const v = clamp(0.54 - depth * 0.34 + (w - 0.5) * 0.88);
            radii[yOff + x] = maxR * (0.14 + v * 0.76);
            colors[yOff + x] = 10 + Math.min(9, Math.floor(v * 10));
          }
        }
      }

      ctx.clearRect(0, 0, width, height);
      for (let ci = 0; ci < PALETTE.length; ci++) {
        let hasAny = false;
        for (let y = 0; y < rows; y++) {
          const yOff = y * cols;
          const cy = offsetY + y * pitch;
          for (let x = 0; x < cols; x++) {
            const idx = yOff + x;
            if (colors[idx] !== ci) continue;
            const rad = radii[idx];
            if (rad < 0.35) continue;
            if (!hasAny) {
              ctx.beginPath();
              hasAny = true;
            }
            const cx = offsetX + x * pitch;
            ctx.moveTo(cx + rad, cy);
            ctx.arc(cx, cy, rad, 0, TAU);
          }
        }
        if (hasAny) {
          ctx.fillStyle = PALETTE[ci];
          ctx.fill();
        }
      }
    };

    const reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    const start = performance.now();
    drawFrame(0);
    if (reducedMotion) {
      return () => {
        observer?.disconnect();
        window.removeEventListener("resize", resize);
      };
    }

    let raf = 0;
    let lastDraw = start;
    const loop = (now: number) => {
      if (!document.hidden && now - lastDraw >= FRAME_INTERVAL_MS) {
        lastDraw = now;
        drawFrame((now - start) / 1000);
      }
      raf = window.requestAnimationFrame(loop);
    };
    raf = window.requestAnimationFrame(loop);

    return () => {
      window.cancelAnimationFrame(raf);
      observer?.disconnect();
      window.removeEventListener("resize", resize);
    };
  }, [variant]);

  return (
    <canvas
      ref={canvasRef}
      className={`ascii-field ascii-field-${variant}`}
      aria-hidden="true"
    />
  );
});
