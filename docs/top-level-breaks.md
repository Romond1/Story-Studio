# Top-level breaks and review boards

Breaks now appear as separate timeline containers between sections. New breaks insert after the selected section or group. A break cannot acquire section membership when dragged, duplicated or pasted. Loading older nested breaks clears membership without changing IDs, scene content or playback order. A legacy section interrupted by a break may appear as separate runs, preserving its original order.

The Break Inspector includes a review-media picker and caption field. Add multiple imported images or video clips; each media item and caption is independently movable, resizable and editable. Text, speech bubbles, background, drawings and audio use existing tools. Videos use their own manual native controls (no autoplay); playback is local to each displayed surface, not linked to the existing background-video transport. Leaving a review board pauses and releases its players. Timeline previews remain passive. Initial placement uses two columns/four slots; further items can be arranged manually.

Ungrouped and named sections collapse to a compact header. Ungrouped can be hidden and restored via Timeline actions. These are view preferences for the current editor session. Group actions offer removing a named section while retaining its scenes, deleting a section and its occurrences, or removing Ungrouped occurrences. Source scenes/assets and other linked uses remain; undo restores the change.

Changed areas:
- `shared/lesson/sections.ts`, `commands.ts`, `model.ts`: hierarchy, migration, ordering/removal, review-media creation.
- `shared/lesson/projection.ts`, `validation.ts`, `episode/validation.ts`, `content/mediaDependencies.ts`: video object projection, URL whitelist, source references and package compatibility.
- `renderer/lesson/LessonTimeline.tsx`, `timelineContainers.css`: sibling break containers, insertion, compact groups, removal/hide/restore actions.
- `renderer/lesson/SceneInspector.tsx`, `SceneSurface.tsx`, `LessonApp.tsx`: Break Inspector, caption creation and manually controlled video objects.

Validation: 634 unit tests pass, including hierarchy, empty-section ordering, dragging breaks past the last section, migration, deletion, video projection and actual portable export/import. Renderer/main builds and TypeScript check pass. `scripts/top-level-breaks-smoke.cjs` covers native insertion, image/video captions, playback and cleanup, group operations/undo, save/reload and actual Present rendering. Screenshots are in `output/playwright/top-level-breaks/`.


## Break editor tools

Review media now uses a searchable thumbnail picker with arrow-key navigation and Escape dismissal; introductory instructions were removed. Break-owned audio attaches from imported audio assets, with Play/Stop, per-track volume/loop and optional Alt+1..9 assignments. Alt+0 stops break audio. Only the selected break owns these shortcuts; typing, menus, modal previews, repeats and other scenes do not trigger them. The existing mixer handles playback; leaving the break stops it. Controls are available in Edit and Teach.

Break image objects and image backgrounds expose nondestructive zoom, blur, feather, opacity, matte color and white-frame width. Existing position/size fields resize the selected image. New review images have a 1px frame. Effects are validated and included in all scene render plans; portable export/import retains the metadata and original media bytes. Reset removes the effects. Source files remain untouched.

Dragging a video (or image) from the pool onto a break creates a review media/caption pair with one undo transaction. Right-click a break and choose Duplicate Break for a separate scene immediately after the original, carrying media, captions, image effects and audio settings.

New components: `BreakReviewTools.tsx`, `ImageAppearanceControls.tsx`, `SceneImageVisual.tsx`; shared appearance validation: `shared/lesson/imageAppearance.ts`. Integration touches the inspector, canvas drop handler, timeline menu, scene model/projection/validators and portable-media field whitelist. Cards are unchanged.

Validation: 635 unit tests pass; renderer/main builds and TypeScript pass. `scripts/break-editor-tools-smoke.cjs` verifies thumbnail selection, image/background effects (including actual Present), thin frames, real canvas video drop and undo/redo, mixer source start/stop, shortcuts with typing/navigation guards, saved metadata, independent adjacent duplication, and a narrow picker layout. Existing hierarchy and Media Pool smoke checks also pass. Evidence: `output/playwright/break-editor-tools/`.
