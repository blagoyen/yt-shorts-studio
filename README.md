# YT Shorts Studio

A local-first desktop 9:16 vertical video editor for gaming shorts, built with **Tauri 2**, **Rust**, **React 19**, **TypeScript**, **Zustand**, **FFmpeg**, and **Faster-Whisper**.

## Features

- **9:16 Vertical Composition Engine**: Gameplay + Facecam split-screen presets (`Gameplay Top`, `Facecam Top`, `Equal Split`, `Gameplay Full`, `Facecam P.I.P.`, `Facecam Full`) with live pan/zoom, rounded corners, borders, and blur/image backgrounds.
- **Multi-Select, Layer Groups & Smart Alignment**:
  - Marquee drag-selection on canvas and `Shift`/`Ctrl`+Click multi-select across Canvas, Layers, and Timeline.
  - Group & Ungroup (`Ctrl+G` / `Ctrl+Shift+G`) with collapsible layer folders, group visibility/locking, and batch transforms.
  - Magnetic snap guides (center, rule-of-thirds, edges, and sibling alignment) + 8-way Align & Distribute toolbar.
- **Animation & Keyframes Engine**:
  - Entrance, exit, and loop presets (`Fade`, `Slide`, `Pop`, `Zoom`, `Spin`, `Bounce`, `Pulse`, `Float`, `Shake`).
  - Per-property keyframes (`x`, `y`, `width`, `height`, `rotation`, `opacity`, `scale`) with easing curves (`linear`, `ease-in`, `ease-out`, `ease-in-out`, `bounce`, `elastic`) and interactive timeline keyframe diamonds.
  - Exported accurately to MP4/MKV via FFmpeg filter expressions & ASS subtitle animations.
- **Advanced Visual Editing**:
  - Per-clip and global color grading (`Brightness`, `Contrast`, `Saturation`, `Hue`, `Blur`, `Vignette`, `Flip H/V`, `Blend Modes`, `Corner Radius`) + 8 one-click filter presets (`Vivid Gaming`, `Cyberpunk Neon`, `Cinematic Teal`, `High Contrast`, `Warm Sunset`, `Noir B&W`, `Retro VHS`).
  - Vector Shapes & Callouts (`Rectangle`, `Circle`, `Pill Banner`, `Callout Badge`) rendered live and in FFmpeg export.
- **Local AI Captions**: Word-level transcription via Faster-Whisper sidecar with customizable highlight styles and animations.
- **Pro Workflow**:
  - Command Palette (`Ctrl+K`) and Keyboard Shortcuts reference (`?`).
  - Timeline beat/edit markers (`M`), track mute toggles, smart snapping, clip splitting (`S`), and 80-step Undo/Redo.
  - Light & Dark themes and Quick-Start Project Templates.

## Development

```bash
npm install
npm run app:dev
```

## Release Agent

Automatically audit (`tsc`, `vite build`, `render_check`), bump SemVer across `package.json`, `Cargo.toml`, and `tauri.conf.json`, build the Windows NSIS installer, tag, push, and publish a GitHub Release:

```bash
npm run release:patch   # 1.1.0 -> 1.1.1
npm run release:minor   # 1.1.0 -> 1.2.0
npm run release:major   # 1.1.0 -> 2.0.0
```

Or run directly with custom flags:

```powershell
.\scripts\release-agent.ps1 -Version 2.0.0
.\scripts\release-agent.ps1 -Bump patch -DryRun
```
