# Story Studio (Electron + React + TypeScript)

Minimal, reliability-first presentation viewer.

## Features
- Project format is always:
  - `<project>/project.json`
  - `<project>/assets/*`
- Import media (images/videos) by copying files into `assets/` with UUID filenames.
- `project.json` stores only relative paths + metadata (no base64/blobs).
- Atomic save (unique temporary file, flush, then replace `project.json`). New projects require an empty folder and never replace an existing project file.
- Undo/redo persistent lesson edits with Ctrl+Z / Ctrl+Shift+Z (or the arrow buttons), in Edit or Teach mode. History keeps up to 100 steps for the open project; Save retains it and opening another project resets it. Text fields keep native undo/cut. Navigation, slide zoom, playback and temporary highlighter strokes are not project history.
- Simple UI:
  - Top bar: Create Project / Open Project / Import Media / Save
  - Left sidebar: slide list
  - Center stage: media viewer with Prev/Next
  - Transition selector: Fade / Crossfade
  - Project Status: folder path, slides, assets, last saved time

## Run
```bash
npm install
npm run dev
```

## Build / package
```bash
npm run build
```

Packaged output is generated in `release/`.
