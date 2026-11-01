# Wheel usability, question media and Edit practice

## Fixes and controls
1. **Teach / Present visibility.** Reproduced the failure with a plain scene already live, then a different wheel authored/selected in Edit. Teach resumed the previous cursor, so neither its preview nor Present showed the wheel. `enterTeach` now explicitly selects the authored mini-game Break when entering Teach. Ordinary Edit browsing and ordinary-scene Teach resume remain isolated. Open Present and Show in Present keep their existing explicit behavior.
2. **Compact Break menus.** Scoped overrides remove accumulated panel/details/label margins and gaps in Break Inspector. Mini-game forms use 6–8 px gaps, tighter fieldsets and compact activity summaries. Classic Break review settings are collapsed when a mini-game is selected. They remain available, and Classic keeps its original review controls.
3. **Flexible question content.** Each question can use optional existing Card content, optional question text, and one picture/video/audio attachment. A Card can be combined with media; Card and attachment share the challenge panel side by side. `Import question media` uses the normal import pipeline; select the imported item from `Picture, video or audio`. Existing media pool IDs and Card definition IDs are retained. No duplicate question records, new editors, raw embeds or remote URL inputs.
4. **Test game in Edit.** The button beside Wheel preview/Edit review board opens an isolated dialog with the real spin/reveal/answer/reward controls. Practice has its own session and Class-only scores, never publishes snapshots and never writes real rewards or authored content. Close test or Escape removes its timers/effects/media. Old v1 wheels are upgraded in the practice sandbox only, preserving the authored document.

## Media behavior
Question text and attachment URLs enter the public plan only for the selected active question. Hidden Card faces and teacher instructions remain private. Missing Card/media references produce readiness warnings. Images join the existing Present image-readiness list.

Video and audio have Play, Pause and Restart question media controls in Teach and practice. The existing scoped wheel command boundary records a serializable playback intent (position, playing flag, epoch). Both views seek from that intent; Present reload reconstructs the position. Present remains muted; Teach alone uses the existing audio mixer. Completion, skip, reset, navigation or dialog closure pause/unload media and detach audio. Transient mixer elements use an opt-in weak cache so unmounted question elements do not remain strongly retained by the active mixer map. Playback never advances or completes an activity automatically.

Attachment references in both active wheels and retained drafts join the media dependency walker, so portable remapping and asset-use analysis can see them. Malformed retained drafts are guarded without destroying opaque saved data. Saved settings remain in the Phase 1 activity config model (`prompt`, `mediaAssetId`); existing Card references and duplication behavior remain intact.

## Verification
- Reproduced the original previous-live-scene failure in Electron before the fix (wheel controls absent after Teach).
- `npm test`: **706 passing**, zero failures.
- `npx tsc --noEmit -p tsconfig.json`: passed.
- `npm run build:renderer`: passed; existing large-chunk advisory only.
- `npm run build:main`: passed.
- `wheel-authoring-usability-smoke.cjs`: passed selected-wheel Teach/Present regression, isolated practice spins and rewards with unchanged live snapshot, Escape/close cleanup, compact computed spacing, old-wheel sandbox, narrow practice layout, existing gameplay/Classic/fallback regression checks and unchanged authored file.
- `wheel-question-media-smoke.cjs`: passed actual picture import/save, Card+picture combination, video/audio/text-only questions, selected-wheel Teach, synchronized play/pause/restart, muted Present, reload seek and hidden-answer privacy. Test assets were generated locally with FFmpeg.
- `spinning-wheel-editor-smoke.cjs`: passed pool/session/segments, existing/new Cards, retained drafts, save/reload, Classic/future/invalid fallback and narrow view checks.
- New domain tests cover Teach targeting, image/text-only readiness and privacy, public media validation, image readiness, active/retained dependency references, video/audio playback and stale commands, old-wheel practice upgrade, and malformed retained drafts.
- Existing renderer-boundary tests initially exposed a server-loading issue from a static mixer import. Mixer loading now occurs only inside mounted audible Teach media effects; those renderer tests pass again. Review also caught the legacy practice and malformed-draft cases; both have regression tests and fixes. Final independent review found no further actionable issues.

Screenshots inspected under `output/playwright/wheel-authoring-usability/` (`edit-practice.png`, `edit-practice-narrow.png`, `compact-break-editor.png`) and `output/playwright/wheel-question-media/` (`card-and-picture-present.png`, `video-present.png`, `audio-present.png`, `text-present.png`). Practice uses the same game display as live Present. The compact inspector and combined Card/media layout were visually checked.

## Files in this change
- `src/shared/lesson/session.ts`, `spinningWheel.ts`, `wheelRuntime.ts`, `wheelPresentation.ts`, `projection.ts`, new `questionPlayback.ts`.
- `src/shared/content/mediaDependencies.ts`, new `src/shared/wheelUsability.test.ts`, `tsconfig.test.json`.
- `src/renderer/lesson/LessonApp.tsx`, `SceneInspector.tsx`, `MiniGameBreakEditor.tsx`, `SpinningWheelPreview.tsx`, `WheelScene.tsx`, `WheelTeachControls.tsx`, `SceneSurface.tsx`, `miniGameEditor.css`, `wheelRuntime.css`.
- New `src/renderer/lesson/WheelPractice.tsx`, `wheelPractice.css`, `WheelQuestionMedia.tsx`.
- `src/renderer/audio/AudioController.ts`: transient media attachment lifecycle, opt-in only.
- New `scripts/wheel-authoring-usability-smoke.cjs`, `scripts/wheel-question-media-smoke.cjs` and the usability design/plan documents in `docs/superpowers/`.

## Limits
A question has one media attachment plus its optional Card and text; arbitrary embedded applications and multiple simultaneous video tracks are not added. Media playback depends on Electron-supported codecs. Live scores and practice progress remain transient, as before. A new practice run starts fresh; practicing never changes saved settings. A running older app window may need a reload/restart to load the rebuilt renderer. No commit or push; prior uncommitted work is preserved.
