# Game media controls implementation plan

**Goal:** Connect both game controllers to lesson media and presentation controls.

**Architecture:** Reuse LessonMediaPool, EpisodeActivities, CameraControls and TranslationControls. Keep stable asset references and flush the running module before setup edits.

**Tech stack:** React, TypeScript, Electron.

- [x] Add tested shared media assignment helper for Mastery cards/videos and Challenge backgrounds.
- [x] Add game navigation, scrollable controller columns, media import and explicit setup transition in LessonApp.
- [x] Extend activity selectors and pool action labels for game setup.
- [x] Run TypeScript, game checks and native Electron workflow with desktop and narrow screenshots.

Validation: 576 shared tests, 50 game tests, two new media assignment tests, renderer TypeScript, renderer/main builds, and native game-media smoke. Screenshots are in `docs/game-media-evidence`. Both games displayed the synthetic camera feed. Translation controls are mounted and use the existing caption service; speech recognition and translation model execution were not exercised. Existing scene projects retain the explicit conversion-copy workflow before shared activity authoring.
