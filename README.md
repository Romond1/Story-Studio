# Story Studio (Electron + React + TypeScript)

Minimal, reliability-first presentation viewer.

## Features
- Project format is always:
  - `<project>/project.json`
  - `<project>/assets/*`
- Import media (images/videos) by copying files into `assets/` with UUID filenames.
- `project.json` stores only relative paths + metadata (no base64/blobs).
- Atomic save (`project.tmp.json` then rename to `project.json`).
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


## Build version
- Current iteration: **V4**
- The app shows this build marker in the bottom-right of Project Status so installed builds can be matched to GitHub notes.
