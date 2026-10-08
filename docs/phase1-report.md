# Phase 1 implementation report

## 1A — Audio feasibility

The isolated harness in `prototypes/audio-feasibility` feeds microphone, generated
tone, dialogue, music and SFX through Web Audio → stream destination → audio element
→ setSinkId. Production AudioController and existing cable routing are untouched.
Six lifecycle tests and a Chromium producer smoke test passed. The browser test
used synthetic microphone input and muted output; it does not prove downstream
capture, conferencing reception, latency or driver crash-silence behavior.

**Simple paired-endpoint path remains preferred.** VAC OEM and VB-CABLE remain
candidates, subject to exact commercial terms, signing, supported Windows builds
and downstream testing. No drivers were installed and no vendor was contacted.
See [the candidate assessment and manual proof matrix](phase1-audio-feasibility.md).

## 1B — Core foundation

`presentationSession.ts` owns runtime identity, monotonically increasing revision,
stable story/section/booster/board selections, and a separate movement overlay.
One resolver exposes the live target, content and occurrence identities, drawing
destination, navigation context and capabilities. Duplicate booster references
have distinct occurrences while permanent drawing remains content-scoped.

Existing UI setters now adapt into this session. The old story array index is
derived from its stable ID. Booster navigation uses sequence occurrence IDs;
drawing and viewport callbacks validate captured target tokens. Drawing no longer
writes to the hidden story cursor. Break drawing uses the same guarded boundary.
Target changes, project resets and retargeted references invalidate old commands.

Compatibility review also corrected deletion fallback after switching to stable
IDs, booster references to break-owned media, and booster context-menu bounds.
Relics/Movement side panels retain the existing story stage. Movement remains an
overlay rather than replacing the base target.

Remaining adapters are explicit: React still owns media elements, viewport effects,
timers, card-provider state and reward effects. Most authored editing callbacks
remain in App; this is not a complete command conversion or a Main-hosted Core.
Temporary highlighter and runtime presentation state do not enter undo history.

## 1C — Passive Present prototype

Control's renderer is the single authority. Main validates and relays full
student-safe snapshots; it does not navigate or mutate lessons. A narrow separate
preload gives Present only snapshot subscription/recovery and readiness reporting.
It has context isolation, no Node integration, no project APIs and no AudioController.

Use **Present (preview)**. It opens an opaque, resizable, separately titled window
with reachable default placement. Bounds are revalidated on reopening. Present
currently shows **base images only**, including image references in booster
sequences. It does not reproduce zoom, image adjustments, annotations, cards,
transitions, movement or rewards. Breaks, video and other unsupported base targets
clear the previous image and show a fallback message. Use the normal teaching
window for those features; audio stays there and is not duplicated.

Snapshot revisions include projection changes; Main adds transport generation and
sequence. Stale updates are ignored, gaps request a full snapshot, and reload or
close/reopen restores the current state. Control reload/crash clears stale output;
after Control starts its session again, it publishes a fresh projection. This is
not independent recovery of unsaved lesson state in Main. Project identity is
included in image cache keys so identical relative paths in different lessons
cannot reuse another lesson's cached image.

## Verification and compatibility

- 160 repository tests passed, including 17 Core model tests, four snapshot/window
  tests, and the existing persistence/history regression tests.
- Six isolated audio harness lifecycle tests passed.
- Renderer and Main production builds passed.
- Full renderer typecheck still reports the five pre-existing errors captured
  before Phase 1: two DOM mouse-listener errors, context-menu item typing, and two
  AudioController errors. No new typecheck errors were introduced.
- Focused browser checks passed for booster drawing/navigation, duplicate content
  drawing, Save/Undo/Redo, deletion fallback and the floating drawing menu.
- Real Electron checks covered initial image, rapid revisions, resizing, reload,
  close/reopen, restricted preload, unsupported clearing, and Control reload.
  Actual Control UI navigation was also exercised against the Present window with
  isolated fixture data, without opening production episodes.
- Project schema and dependencies are unchanged by Phase 1. All five production
  project JSON hashes match the fresh pre-Phase-1 baseline. The existing
  single-window teaching path remains available. No release was packaged or
  driver integrated; changes remain in the working tree.

## Owner's manual acceptance checks

1. Open an existing episode and teach in the normal window: story/break/booster
   navigation, boards/cards, drawing, zoom, video/audio, rewards and movement.
2. Check Save, close/reopen, and undo/redo after an ordinary edit or permanent stroke.
3. Open Present on an image. Navigate in Control, including rapid previous/next;
   resize, reload, close and reopen Present. Confirm Control keeps the lesson.
4. Share Present in your conferencing app on one monitor, then return to Control.
   Confirm actual student reception. Do not rely on minimized-window capture.
5. Follow the audio assessment's recorder/vendor steps before declaring a virtual
   component technically and commercially accepted.

These real teaching and conferencing gates have not been claimed as passed.

## Phase 2 recommendations — not implemented

1. Settle media ownership and clock semantics before moving video/audio/effects.
2. Extend snapshots with viewport/drawing, then card/board interaction state.
3. Add revisioned timing for transitions, movement and reward/badge/Relic events.
4. Complete booster parity and decide when to move the pure authority into Main.
5. Integrate a licensed signed audio component only after vendor/downstream proof;
   do not introduce a PCM bridge without measured need.

Games, Counter, Final Boss, Ready Check, commercial installer and UI redesign remain
deferred. Phase 1 engineering work stops here for owner acceptance.
