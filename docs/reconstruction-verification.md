# Story Studio reconstruction — implementation and acceptance

Verified on Windows on 2026-10-08, on `story-studio-rebuild`.

The reconstructed application is implemented at `a109304`. It creates and teaches new Story/Activation lessons through one scene editor. The complete pre-reconstruction application remains recoverable at `be7f47b`.

## Architecture

A lesson contains one Media Pool, reusable Card content, scene records, and two ordered sequences. Story and Activation entries refer to scenes by stable IDs. A scene owns its background, logical canvas dimensions, ordered objects, drawings, audio, transition and notes.

Card content, its position in a scene, and its temporary teaching state are separate. The saved lesson contains content and initial presentation settings. A live session contains the current sequence entry, displayed faces, concealment, drawings, viewport and rewards. Selecting something in Edit does not silently navigate Live.

`projectScene` resolves the current authored scene and live state into a validated, student-safe visual plan. Edit, Teach and Present use the same `SceneSurface` and logical frame. Present receives the visible composition rather than the entire project, teacher notes or inactive Card faces. Authored deletion immediately changes that composition, including while the teacher remains in Edit.

The investigation and alternatives were recorded before implementation in [the architecture decision](superpowers/specs/2026-10-08-reconstruction-design.md), committed as `6a25c6e`.

## Root causes addressed

- The previous `App` mixed editing, teaching, navigation, media, Cards and host routing. `EditWorkspace` docked controls but did not establish ownership.
- V2's live module cache refreshed only in Teach, while placement identity came from current authored data. Present could receive a current placement with stale content.
- Activation could display nested library/board content whose deletion command targeted a different host. Scene-owned placements now define exactly what deletion removes.
- Measured stage dimensions, break frames and Card activity frames were scaled separately. All new scene objects now share one authored coordinate system and contain transform.
- Basic Cards previously required library/set/activity concepts. Add Card now creates usable content and its scene placement in one command.

## Replaced, consolidated and retained

| Area | Result |
| --- | --- |
| New lesson authoring | A dedicated scene application replaces the old host/Booster orchestration for new-format documents. |
| Activation | Uses the same timeline, Media Pool, canvas, object commands and Inspector as Story. |
| Card placement | Direct scene ownership; Sets and Library reuse are optional. |
| Visual projection | One new scene contract and one renderer for all three surfaces. |
| History and persistence | Existing immutable history and atomic writes retained; new validated IPC/file boundary added. |
| Media | Existing imports, asset identities, project-scoped URLs and Present-owned video transport retained. |
| Audio | Existing singleton mixer, monitoring and device settings retained; scene audio has cancellable ownership. |
| Rewards | Existing scoring and spark/badge visuals retained through session state; no second reward provider. |
| Legacy application | Retained as a separately mounted Legacy mode and a GitHub recovery checkpoint. |

Only one application root mounts at a time. New lessons do not write through legacy Slide, Booster or board arrays.

## Story, Activation, Cards and Inspector

Both phases support image/video scenes, direct Card/Text/Bubble insertion, image overlays, selection, movement, resizing, duplication, deletion, layers and undo/redo. The shared structural timeline supports media drop/insertion, reorder, section labels, zoom/pan and separate Edit/Live markers. Removing a scene entry retains its media.

Select a scene, click **Add Card**, and type in the Inspector. Named faces have stable IDs; add, rename, reorder or remove them. Drag or resize the selected Card on the canvas. Duplicate creates independent content. Delete removes its placement and participates in history. Teach offers Show Face, Next/Previous Face, Conceal, Reveal and Reset. Direct clicking follows the configured cycle, reveal or manual interaction.

The Inspector follows the selected object. Its persistent object list allows selecting hidden objects. **Scene properties** returns to background, frame, transition, notes and audio. Object sections expose content, geometry, appearance and presentation settings. Advanced Library/Set controls are optional: linked reuse shares content; independent reuse clones it. A Set builds an activity by inserting ordinary independent Cards.

Linked scene reuse is explicitly labelled and displays a shared-edit warning. Independent Story-to-Activation copies receive new scene/object/Card/face identities while reusing media assets. Activation entry stores a stable Story return location. Return does not depend on an array index.

Teach has navigation, Cards, drawing, zoom/pan, media/audio and student rewards. Authoring history shortcuts run only in Edit. Language and Final Boss remain disabled future phases; rewards are separate from Final Boss.

## Core and Present behavior

Every authored visual is projected in scene order with the same geometry and visibility on all surfaces. Speech, thought and shout bubbles use shared vector shapes. Logical drawing coordinates convert once at the retained drawing renderer boundary. Wide, 4:3, portrait and custom frames use the same scaling logic.

Present owns the live video file decoder. Teach consumes a muted stream of its decoded frames; the video's audio enters the existing Control mixer once. Edit's local video preview is muted and has playback controls, disabled during drawing. Student Present has no editing or teaching controls.

Navigating resets scene-local faces, drawing and viewport, and stops prior scene media/audio. Rewards remain session-scoped across navigation. Reward event IDs prevent duplicate scoring, and audio plays outside React state updaters. Opening another lesson creates a fresh session.

## Executed verification

| Check | Actual result |
| --- | --- |
| `npm test` | **383 passed, 0 failed, 0 skipped**; includes existing regressions and new domain, limits, persistence, lifecycle, audio, session, rewards and renderer tests. |
| `npx tsc --noEmit -p tsconfig.json` | Passed. |
| `npm run build:renderer` | Passed. Vite reports a main chunk of about 542 kB after minification; its chunk-size warning remains. |
| `npm run build:main` | Passed. |
| `git diff --check` | Passed for the committed implementation. |
| Actual Electron acceptance | **9 workflow groups passed**, zero renderer page errors; both Control and Present were real Electron windows using built production code. |
| Additional Chromium authoring checks | Direct Cards, hidden-object selection and optional Library/Set workflows passed; independent insertion verified in Story and Activation. Persistence was mocked for these UI-only checks. |
| Responsive UI inspection | Captured at 1440×1000, 1184×695 and 390×844, with no horizontal page overflow. This does not certify every viewport. |

The Electron test creates synthetic image/video media with FFmpeg and a disposable Episode-7 folder. Only native folder/file selection dialogs are replaced. Authoring and teaching actions use the normal controls. Disk save/reopen, local media loading, IPC, scene projection, video decoding and the Present window are real.

The final disposable sample is `D:\Temp\story-scene-acceptance-hkzxMg\Episode-7`. The script is [reconstruction-smoke.cjs](../scripts/reconstruction-smoke.cjs); [machine-readable results](reconstruction-evidence/smoke-results.json) record the generated path and passed groups.

The sample contains two Story scenes and two Activation scenes using shared image/video assets; multi-face Cards; speech bubbles; independently moved/resized and duplicated Cards; a 4:3 Activation scene; drawing and a fade transition. The test proves face changes/conceal/reveal, deletion in actual Present, undo/redo, independent Edit selection, return to the stored Story scene, and complete save/reopen. It also verifies one Present video decoder, a muted stream in Teach, visible drawing pixels and reward content fitting its frame.

Final screenshots:

- [Activation Edit](reconstruction-evidence/smoke-activation-edit.png) and [Activation Present](reconstruction-evidence/smoke-activation-present.png).
- [Video Teach](reconstruction-evidence/smoke-video-teach.png) and [video Present](reconstruction-evidence/smoke-video-present.png).
- [Multi-face Card Present](reconstruction-evidence/smoke-story-present.png) and [student rewards](reconstruction-evidence/smoke-rewards-present.png).

The acceptance script initially read the file immediately after clicking Save. That race was corrected to wait for the application's save completion before comparing disk contents. The final run passed. Review also found and fixed active-Story-tab resets, authored Undo in Teach, and object-capacity commands that could otherwise create unsavable lessons.

## Compatibility and recovery

Original Episodes 1–6 were not opened, migrated or modified. Their native editing compatibility with the new scene format is **not claimed**. No converter was added.

The previous application is available from the welcome screen through **Earlier projects → Open Legacy mode**. Legacy regression tests pass, but the six real episodes were not individually exercised. Scene-format create/Save As requires an empty target folder. Saving checks the active folder, document identity and on-disk format, and refuses legacy data.

Verified GitHub recovery references:

- `new-layout` → `be7f47b`.
- `new-layout-checkpoint-2026-10-08` → `be7f47b` (annotated tag).
- `rebuild-from-v20.1` → `bd7440c`, unchanged.

To inspect the earlier application without replacing this checkout, use a separate worktree at `new-layout-checkpoint-2026-10-08`. Reconstruction work remains on `story-studio-rebuild`.

## Short manual acceptance checklist

1. Run `npm run dev`. Create a new lesson in an empty Episode-7-style folder; import one image, one video and an audio file.
2. Drag the image and video into Story. Add a Card and Bubble. Edit Prompt/Answer, move/resize, duplicate and undo a deletion.
3. Copy the image scene independently to Activation; add a second scene there using the same pool. Edit the copy and confirm Story stays unchanged.
4. Open Present, switch to Teach, change faces and reveal/conceal. Start Activation, navigate its scenes and return to the stored Story scene.
5. While Present is open, delete a visible Card in Edit. Confirm it disappears in Present, then undo. Save and reopen the lesson.
6. On the teaching machine, verify microphone input, monitoring, scene/video audio and the chosen virtual output device in the actual conferencing setup.

## Remaining work and limits

- Physical microphones, monitoring latency and virtual audio-device/conferencing routing need the hardware check above. Automated tests do not prove audible output on that hardware.
- Real Episodes 1–6 remain a Legacy-mode acceptance task; migration would be a separate, copy-only project with unsupported-content reporting.
- New scene transitions are currently none/fade. Specialty legacy board/relic tools, custom reward configuration and advanced activity engines remain in Legacy mode; they were not reimplemented as new scene features.
- Rewards are teaching-session state and do not persist scores into lesson files. The new reward controls use existing default visuals and the saved roster, with optional session-only students.
- Language Game and Final Boss were not implemented.
- Packaged installer/release generation and extended classroom soak testing were not performed. The main JavaScript chunk warning remains a performance follow-up.
