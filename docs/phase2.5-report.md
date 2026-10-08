# Phase 2.5 — Teach workspace implementation

## Workspace architecture

Edit retains its existing large stage, vertical lesson navigator and authoring panels. Teach uses the same mounted stage subtree in a separate preview/control composition, with a horizontal semantic lesson navigator. Existing Core PresentationSession, target identity, runtime cards, drawing commands, reward commands and AudioController remain authoritative.

Workspace state is explicit `appMode`; closing Present does not leave Teach. Opening Present enters Teach. Switching to Teach alone does not automatically launch a window. Returning to Edit leaves Present open and retains lesson position.

The primary divider starts at 42% preview and supports pointer dragging and keyboard Left/Right/Home/End. Its preference is stored in localStorage, clamped to 30–65%, with minimum preview/control widths. The bottom navigator also has a locally persisted height divider, supporting one, two or three thumbnail rows and horizontal mouse-wheel scrolling. Divider positions, drawer visibility and reported Present viewport are not written to lesson files.

## Teach controls

- **Persistent header:** active student, reward count, +1 Spark, mic/master mute, Previous/Next, Present status/open/reopen, lesson name, workspace switch.
- **Operational panel:** existing reward variants, audio meter/status and media/master volumes, section music and slide audio play/pause/stop or configured fade, runtime clip volume, settings access.
- **Contextual:** drawing toggle, marker undo, clear and pen options; zoom buttons/reset and middle-drag pan; video transport; break timer; board selection and existing card toolbar/shuffle after card selection; booster tabs/item progress/return; quick Movement trigger/random/stop alongside Rewards. Draw mode retains mouse-wheel zoom.
- **Secondary:** existing Teach badge/student panel; operational relic progress/visibility/reward controls. Relic image/configuration editing remains in Edit. Full routing/device settings remain in Audio Settings. No new session-end operation was invented.
- **Navigation:** section groups, image thumbnails, video labels, distinct breaks, actual booster prompt/board/activity types and occurrence-aware LIVE labels. Direct selection uses the existing session controllers. Existing Previous/Next semantics are preserved.

## Preview geometry and effects

Present reports the dimensions of its `.present-surface` through its restricted preload and authenticated IPC bridge. Outer window chrome is excluded. Control retains the last reported viewport when Present closes; before the first report it uses 16:9.

The Teach preview uniformly fits that viewport inside the available region. Its scene uses the existing stable logical frame, including the existing fixed break frame. Both renderers therefore apply the same contain transform inside proportional viewports. Letterboxing of the logical scene itself is retained in both windows. Fractional ResizeObserver dimensions avoid premature rounding.

Moving the divider or resizing Control changes preview scale only. Resizing Present changes preview shape without changing authored coordinates. Padding has no interaction descendants; drawing, pan and card input remain on their existing logical content rectangles. Marker strokes retain their established persistence behavior; ordinary layout changes do not author lesson geometry.

The preview continues to use passive video stream playback and existing projected reward/movement state. It does not introduce another media/audio engine, timer owner, random shuffle or reward authority. Present remains a normal, separate student-only BrowserWindow; window flags and shareability were not changed.

## Verification

- **247/247 node tests passed**, including six new geometry/split/wheel tests and expanded Present IPC lifecycle tests for viewport validation, sender/frame checks, state preservation and retained geometry after close.
- Renderer TypeScript check passed: `npx tsc --noEmit --pretty false`.
- Production renderer and main builds passed: `npm run build:renderer`, `npm run build:main`.
- Focused real Electron check with an isolated synthetic lesson/profile: 1366×768 and 1920×1080 Control; 1280×720, 500×900 and 1600×600 Present; five marker strokes at corner/center locations; padding clicks; zoom and middle-drag pan; divider keyboard resizing without changing Present; Edit/Teach target/drawing preservation; Present close/reopen while retaining Teach. No renderer page errors.
- The complete installer/package build, conferencing capture, real lesson media/card interaction and live audio routing/quality remain manual checks. No audio routing architecture was changed.

Evidence: [laptop Teach](phase2.5-evidence/teach-laptop.png), [wide Teach](phase2.5-evidence/teach-wide.png), [tall Present preview](phase2.5-evidence/teach-tall-present.png), [Edit](phase2.5-evidence/edit.png).

## Manual review checklist

1. Open an existing episode; select Edit and confirm the large authoring stage and tools.
2. Switch to Teach; confirm lesson position and active student. Open Present and share that window in Meet.
3. Navigate slides and breaks from the horizontal strip and Previous/Next; compare LIVE context with Present.
4. Draw at corners/center, undo a marker and clear. Click surrounding padding; confirm no new strokes.
5. Zoom, middle-drag pan and reset; compare Control with Present.
6. Resize Present tall/wide after drawing, resize Control and drag the divider; confirm alignment and unchanged Present size when only Control changes.
7. Play/pause/seek/restart video; test slide audio, section music/fade and operational volumes.
8. Switch students and award Sparks; test mic/master mute and microphone indication.
9. Enter/exit a booster, manipulate cards, use board shuffle/reveal and break timer.
10. Open badge/student, relic and movement tools; close the secondary panel and check student output remains clean.
11. Close/reopen Present; verify Teach remains active and reselect the new shared window in Meet when required.
12. Return to Edit, save/reopen, and confirm no unexpected authored changes (intentional persistent markers/rewards retain existing behavior).

## Deferred

Temporary Focus Preview button, teaching notes, custom docking/layouts, timeline authoring, waveform editing and expanded session controls. No games, Final Boss, Hero Board, installer/onboarding or broader redesign work was started.


## Follow-up: Draw zoom, navigator resizing and Movement

- Draw-mode wheel events now reach the existing media zoom owner through the shared logical preview frame; no second zoom state or fake forwarded event is introduced.
- Drag the horizontal handle above the lesson navigator upward for two or three rows. Up/Down and Home/End work when the divider is focused. Height stays local, is capped to keep the upper workspace usable, and never resizes Present. Mouse wheel and horizontal trackpad gestures browse the strip.
- Quick Movement sits directly after Rewards in the main control grid: enabled activity buttons, Random, active event name and Stop. These call the existing Core commands without leaving the current target. The full Movement editor remains available in Edit.
- Focused Electron follow-up passed: wheel zoom with Draw active, five subsequent mapped marker strokes, mouse-wheel thumbnail scrolling, pointer resize to two rows, keyboard resize to three physical rows, local preference storage, unchanged Present dimensions, and Movement trigger/random/stop while preserving the live target. Renderer typecheck and renderer/main builds passed.

Evidence: [three navigator rows](phase2.5-evidence/teach-three-rows.png), [quick Movement beside Rewards](phase2.5-evidence/teach-quick-movement.png).
