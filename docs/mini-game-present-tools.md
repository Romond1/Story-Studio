# Mini-game presentation tools and media usability

Implemented October 25, 2026. No commits or pushes. Existing uncommitted work preserved.

## Teacher workflow

- In the Students panel, open Present roster settings. Enable Show roster in Present and tick the students under Show in Present. Select all / Clear Present selection are available. Choices are remembered per class and are separate from activity participants and reward recipients.
- Selected students appear in a wrapped Presenter strip rather than stopping after eight. The public projection supports up to 200 entries; longer lists are bounded and show a remaining count. Larger/narrow rosters can scroll within their reserved strip.
- Selected students govern the public reward indicator, spark bursts and celebration board as well as roster entries. Hiding a student never removes scores. Public names use nicknames or anonymous labels. The teacher's recipient controls retain their existing names and workflow.
- Picture, video or audio now opens a compact searchable chooser with 48×36 thumbnails, current selection, clear attachment, missing-file state and bounded scrolling/loading. Videos show a muted preview frame; audio uses a music symbol. Selection continues to reference the same media asset IDs.
- Enable Game sounds to unlock the audio context and hear a confirmation. Test game sound retries playback and shows output/mute guidance. Mixer routing and existing mutes are respected. This is game audio, not spoken narration.
- In Teach, Draw and explore now works during mini-games: zoom up to 4×, pan, reset, pen, highlighter, eraser, color/size, rainbow/fade, undo/redo/clear. Wheel zoom at the pointer and middle-drag pan also work. Preview and Present use the same viewport and live ink. Camera and translation stay available above the game.
- Test game has its own Zoom & draw disclosure and local drawing history. These practice changes remain isolated from the real lesson and Present.

## Root causes and implementation

Game sounds scheduled oscillators but never resumed a suspended AudioContext. The sound checkbox now resumes within the user's gesture; the shared oscillator path also retries interrupted audio. An explicit test and status avoid silent failure.

Mini-games returned early from SceneSurface, bypassing pointer gestures, ink and viewport transforms. Projection forced viewport1 and discarded drawings, and its parser rejected all wheel drawings. Games now render inside the shared canvas. Only live game ink crosses to students; authored review-board objects and drawings remain private. Rewards remain outside the zoom transform. Real-time drawing previews use the normal snapshot transport.

The media registry already served original image bytes. No thumbnail replacement or image recompression was needed. The redundant inner game frame was removed when hosted by SceneSurface. Native verification decoded a 2400×1600 source at those exact dimensions. Zoom enlarges that original; it cannot recover detail absent from an originally small file.

Roster projection previously took activity participants and truncated at8. Display selection is independent and supports more students, while live reward totals reuse getStudentRewardTotal to avoid double-counting aggregate stars. Reward visuals now use a public selection policy; optional private spark ownership stays in runtime and is stripped by the existing public parser. Explicit empty/removed rosters cannot expose former students' names. Generic Class remains available for sessions without a student roster.

## Files changed in this request

Roster/rewards:
- `src/renderer/lesson/LessonApp.tsx`
- `src/renderer/students/PresentRoster.tsx`
- `src/renderer/present.tsx`, `present.css`
- `src/shared/students/rosterPresentation.ts`, `rosterPresentation.test.ts`
- `src/shared/lesson/rewards.ts`
- `src/shared/lessonRewards.test.ts`

Media/canvas:
- `src/renderer/lesson/QuestionMediaPicker.tsx`, `questionMediaPicker.css` (new)
- `src/renderer/lesson/MiniGameBreakEditor.tsx`, `SceneInspector.tsx`
- `src/renderer/lesson/SceneSurface.tsx`, `WheelScene.tsx`, `WheelQuestionMedia.tsx`
- `src/renderer/lesson/WheelPractice.tsx`, `LessonTeachControls.tsx`
- `src/shared/lesson/projection.ts`
- `src/shared/wheelUsability.test.ts`

Audio:
- `src/renderer/audio/AudioController.ts`
- `src/renderer/lesson/WheelTeachControls.tsx`
- `scripts/game-sounds.test.cjs` (new)

Native checks:
- `scripts/mini-game-present-tools-smoke.cjs` (new)
- `scripts/present-student-selection-smoke.cjs` (new)
- `scripts/wheel-question-media-smoke.cjs` (adapted to the thumbnail picker)
- This report plus design and plan under `docs/superpowers/`.

## Validation

- Full automated suite: 721 passing, zero failures.
- Audio regression suite: 4 passing, including suspended-context activation, running context, blocked activation, and unchanged mixer settings.
- Final focused projection/roster/reward suite: 22 passing after explicit empty-roster privacy correction.
- Renderer TypeScript check and renderer/main builds passed. Existing renderer chunk-size advisory remains.
- Native tools check: thumbnail search/selection; actual 2400×1600 decoded image; isolated practice zoom/ink/undo/redo/clear; live zoom with drawing and Present reload; real AudioContext running and oscillators scheduled on toggle/Test sound; synthetic camera live over a game; published Italian caption over the same game; desktop and true narrow screenshots. No physical camera was opened, no speech model download was required, and speaker hardware audibility cannot be measured by this automation.
- Native student check: all12 display independently from one participant; class/reload persistence; selection applies to reward bursts/celebrations without changing balances; nickname privacy in the whole snapshot; desktop/narrow layout.
- Native question-media regression passed import/save, Card plus picture, video/audio/text questions, playback, pause/restart, muted Present, reload seek and answer privacy.
- Existing game variety native regression checks Wheel, Hat, Cards, isolated practice, card selection mapping, reload, rewards and privacy.

Evidence: `output/playwright/mini-game-present-tools/`, `output/playwright/present-student-selection/`, and `output/playwright/mini-game-variety/`.
