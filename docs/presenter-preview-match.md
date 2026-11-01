# Presenter frame matching and student display removal

The Teach preview now receives Presenter viewport dimensions from the existing status channel. PresenterPreviewFrame renders the scene at those CSS dimensions and uniformly scales the whole viewport into the available control space. A thin outline identifies the exact Presenter boundary, including matching letterboxes. The preview updates on Presenter resize; when closed it falls back to the authored scene ratio. Zoom/pan/drawing continue through the shared scene viewport.

The persistent bottom/top student strip and corner student/star display are removed. Presenter no longer reserves roster space, and Control no longer offers Presenter roster settings or publishes a roster packet. Participants and teacher-side reward recipient selection remain available.

Changed files: new src/renderer/lesson/PresenterPreviewFrame.tsx; LessonApp.tsx; WheelScene.tsx; renderer/present.tsx; new scripts/presenter-preview-match-smoke.cjs.

Native Electron verification passed: no strip/corner with participants selected; full Presenter area; matching normalized scene rectangles at 1200×600 and700×950; matching zoom/pan; narrow Control1000×850; Presenter reload. Screenshot evidence in output/playwright/presenter-preview/. Renderer/main builds and renderer TypeScript checked; full automated suite:722 passing. Existing camera/video/caption ownership is retained; the new frame matches scene geometry and does not open a second camera capture.

No commits or pushes. This supersedes the earlier student strip and Presenter roster-settings implementation.
