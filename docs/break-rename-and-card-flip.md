# Break naming and game question Cards

Added Rename Break to the timeline menu for Break headers and tiles. The existing section menu continues to expose Rename section. Both use the inline name form and normal project history/save pipeline. A renamed Break also updates its timeline group header.

Game questions with attached Cards now show the rendered Card first, above attached picture/video/audio. The separate prompt and activity label are suppressed for Card questions to avoid duplicate question text. Questions without Cards retain their previous prompt behavior.

Click the Card in Teach's control preview or Test game to cycle its faces. Enter/Space work too. The command reuses the scoped authoritative face transition, so Present follows the selected face and unselected faces remain private. Cycling wraps to the first face. Drawing mode disables Card interaction to preserve ink gestures. Flip motion respects reduced motion; the existing Card face selector remains available.

Files: LessonTimeline.tsx, miniGameCommands.ts, SceneSurface.tsx, WheelScene.tsx, LessonApp.tsx, WheelPractice.tsx, wheelRuntime.css, and new scripts/card-flip-rename-smoke.cjs.

Native Electron validation: rename Break/section and save, click-to-flip forward/back, Present synchronization, vertical Card/media geometry, suppressed duplicate prompt, question-only content, imported image persistence, audio/video controls, reload seek and answer privacy. Screenshot: output/playwright/card-flip-rename/card-and-picture-present.png. Renderer/main production builds and TypeScript passed; full automated suite:722 passing. No commits or pushes.
