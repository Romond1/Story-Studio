# Story Studio (Electron + React + TypeScript)

Visual lesson authoring and live teaching through Adventure → Discovery → Challenge → Mastery, with a shared Adventure/Discovery scene editor.

## Features
- Project format is always:
  - `<project>/project.json`
  - `<project>/assets/*`
- Import media (images/videos) by copying files into `assets/` with UUID filenames.
- `project.json` stores only relative paths + metadata (no base64/blobs).
- Atomic save (unique temporary file, flush, then replace `project.json`). New projects require an empty folder and never replace an existing project file.
- Undo/redo persistent lesson edits with Ctrl+Z / Ctrl+Shift+Z or the Undo/Redo buttons in Edit. History keeps up to 100 steps for the open project; Save retains it and opening another project resets it. Text fields keep native undo/cut. Live navigation, viewport, playback and drawing are separate from authored history.
- New lessons use `format: "story-studio-scene", version: 1` with explicit scene objects and ordered Adventure/Discovery sequences. Their serialized identifiers remain `story` and `activation` for saved-lesson compatibility.
- Both phases share the Media Pool, timeline, canvas and selected-object Inspector. Add Cards or Bubbles directly; duplicate, delete, move, resize and reorder objects with undo/redo.
- Cards have named faces and optional linked Library reuse. Optional Sets insert ordinary independent scene Cards.
- Edit selection is separate from Live. Teach controls navigation, faces, drawing, viewport, scene audio and rewards. Present renders the same scene composition without teacher tools.
- Present owns live video decoding; Teach receives muted decoded frames, and audio enters the existing Control mixer once.
- Logical scene dimensions support wide, 4:3, portrait and custom frames. A single contain transform preserves object geometry across windows.
- Scene deletion retains source media. Linked scene reuse shares authoring; independent copies clone Card content and object identities.

## Earlier projects and recovery

From the welcome screen, expand **Earlier projects** and choose **Open Legacy mode**. The old editor opens existing episode formats without automatic conversion. A scene-format save cannot overwrite an active legacy document or a legacy `project.json` on disk. Keep original episode folders unchanged; no converter is provided in this reconstruction.

The complete pre-reconstruction application is preserved at commit `be7f47b`, branch `new-layout`, and tag `new-layout-checkpoint-2026-10-08`. The older `rebuild-from-v20.1` branch remains separate. To inspect the checkpoint without replacing this checkout, create a separate Git worktree at that tag.

Challenge offers Language Snake and Mastery offers Final Boss Hero through the shared Game Host. Choose a game and launch it to run its single interactive instance in Present; Control provides the game information, keyboard forwarding, restart and exit controls. Game sound uses Present's audio output. Badges remain separate lesson rewards.

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

## Verification

```bash
npm test
npx tsc --noEmit -p tsconfig.json
npm run build:renderer
npm run build:main
```

`scripts/reconstruction-smoke.cjs` runs actual Electron Control/Present acceptance against generated image/video media and a disposable project. It requires FFmpeg and Playwright; set `STORY_STUDIO_PLAYWRIGHT` to a Playwright package directory if it is supplied by an external runtime. Run after both builds. Evidence is written to `docs/reconstruction-evidence/`; the temporary sample path is printed. Physical microphone and virtual-device routing need verification on the teaching machine.

## Authoring and teaching usability

Middle-mouse drag pans the Edit/Teach canvas and timeline with every tool; Alt+wheel zooms. Left-drag selects/manipulates or draws, and right-click opens the mode's context menu. Teaching changes survive scene navigation until Reset Scene or New teaching session.

Sections, editable review Breaks, local resizable panels, a drawing toolbox and independent Card copy/move between scenes are available. See [verification and manual acceptance](docs/authoring-teaching-verification.md) and the disposable lesson in `docs/usability-demo`.
