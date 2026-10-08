# Edit workspace capability inventory and acceptance gate

Source audit: 2026-10-06. This inventory records the existing Edit controls before layout migration. Locations name components and UI regions rather than unstable line numbers. It is a source-level reachability inventory, **not a claim of runtime parity**. Production-project round trips, pointer geometry, audio devices, and a separate Present window still require manual acceptance. Keep a reachable legacy layout until that acceptance is complete.

## Project and global operations

Source: `src/renderer/App.tsx`, global top bar and application drop handlers.

- Create Project, Open Project, Import Media, Save (dirty/in-progress state), Refresh App where available.
- Import media through the native picker and application file drop; preserve existing section-aware import and asset semantics.
- Edit/Teach switching; Present launch/reopen, presentation status and existing normal-teaching recovery.
- Undo/redo buttons and history keyboard shortcuts; retain focus/typing exclusions.
- Story, Boost, Badge, Relics, Movement, Boards context access.
- Audio settings entry and compact audio status; active student and build/global status.
- Previous/next navigation and break timer access where currently exposed.

## Lesson structure

Source: `App.tsx`, Sections sidebar, slide list, context menu and `selectSection`, `reorderSlidesWithinSection`, `moveSection` commands.

- Select/expand sections; show section names and content counts; rename section by double-click, commit/escape handling.
- Create section, create Break, move section up/down, delete section with confirmation.
- Select slides; thumbnail/name/type display; double-click rename with commit/cancel; delete slide.
- Reorder slides using existing drag insertion targets or Move Slide Up/Down commands **within the existing supported section semantics**.
- Import/Add Slide and Add/Delete/Move Break context-menu commands.
- Break duplication is present in the break editor. A generic slide-duplicate command or arbitrary cross-section slide move must not be assumed from the requirements; do not invent structural behavior for layout parity.
- Previous/next slide and previous/next break context navigation.

## Stage and image/video editing

Source: `App.tsx`, interactive Stage/MediaRenderer, image adjustment and video trim editors.

- Preserve the interactive canvas, selection, overlay dragging and four-corner resizing, editable text and authoring hit targets.
- Preserve image/video viewport zoom and pan, and Reset view, using the current logical-coordinate conversion.
- Image controls: horizontal flip, brightness, contrast, saturation, Reset adjustments.
- Video playback preview/native controls and trim in/out handles, elapsed/trim times and stopping at the authored out point.
- Existing image/video fit and canonical scene geometry are renderer behavior; no separate generic fit selector was identified in this audit.
- Drawing on slides and breaks: enable/disable, marker/highlighter, size, opacity, highlighter fade duration, color, rainbow, sparkle, glow, clear drawing; keyboard drawing toggle and existing drawing history/lifecycle.
- Transition selector: none, fade, crossfade, fade-black, cinematic, blur, pixel reveal, card slide; direction left/right/up/down; duration; Apply to Slide and Apply to Section. Stage context menu also applies transitions at slide/section scope.

## Bubbles, text and tags

Source: `App.tsx`, selected bubble inspector, Stage bubble list/context menu, copy picker and tag editor.

- Add, select, delete and duplicate bubble; edit text on canvas, drag/resize; copy to one or multiple target slides with Select All/Clear and confirmation.
- Built-in bubble types; import custom PNG template, choose it, remove custom template through the inspector or context command.
- Locked state; font size, horizontal alignment, family, bold strength, italic; horizontal/vertical flip; text color.
- Bubble tags as comma-separated values, independently of slide tags.
- Advanced normalized TextRect x/y/width/height controls.
- Slide tags: enter-to-add and per-tag removal; retain any tag display used by media/reference searches.

## Slide and section audio authoring

Source: `App.tsx`, `AudioClipPlayer`, Slide Audio, Section Music and Break Music.

- Import/add/remove multiple Dialogue and SFX clips, one Slide BGM, multiple Section Music tracks and Break Music.
- Video Audio Sound On and authored volume (disabled volume control while sound is off).
- Each audio clip: editable name, play/pause, stop, seek, elapsed/duration, volume, settings disclosure, assign/clear keyboard shortcut, fade enable, color and remove.
- BGM loops and section singleton playback continue through the existing `audioManager`; do not create a second engine.
- Audio routing remains shared operational tooling: `audio/CompactAudioPanel.tsx` and `audio/AudioSettingsWorkspace.tsx` expose microphone/monitor/mix output routing, mixer, signal meters, testing/recovery and Stage panel configuration. These are distinct from authored clip properties and remain accessible through global Audio.

## Break editor

Source: `App.tsx`, break editor, slide/background pickers and interactive break canvas.

- Open/close editor, duplicate break; title/name, questions, font family, question/title size, text color.
- Solid background color; two-color gradient; image background via Project Library or Import File.
- Background image scale, blur and x/y offsets.
- Break media: add using existing slide/media selection or import, remove; position x/y, scale and increment/decrement controls; retain direct stage manipulation.
- Timer: countup/countdown, size, countdown minutes/seconds, start/stop, reset, Show timer to viewers.
- Break music imports and full clip controls; section audio assignment and existing scene attachments remain reachable.
- Drawing and existing section transition application remain available without showing unrelated slide-only controls.

## Story scene attachments and reusable boards/cards

Source: `App.tsx` Story Scene Attachments; `acards/ACardSidebar.tsx`, `ACardEditor.tsx`, `BCardEditor.tsx`, `ACardStageRenderer.tsx`, `BCardInstanceLayer.tsx`.

- Attach ACard Board references to supported story targets; select, reorder, remove and choose referenced ACard; embedded ACard editor.
- Add/remove/select BCard overlays on supported slide, break and booster targets; choose library card; width, height, z-index and Overlay/Board Shell frame style.
- Preview flip, blur, cover, zoom, reset; configurable card click action (none/flip/blur/cover/zoom). These preview states must not be confused with authored properties.
- Boards library: select/create/delete ACard stages; select/create/duplicate/delete BCard library entries.
- ACard identity: stage name, full/half stage mode.
- ACard title/questions: text, font, text color, title/question size, alignment, position, bold, italic.
- ACard timer: visibility, countup/countdown mode, size, duration.
- ACard background: type, solid color, gradient direction/start/end, image picker/import/clear and image transform controls (scale/blur/position).
- BCard library inside board editor: create, place, duplicate, delete; placed-card list select/remove.
- Selected placed card: name, width/height/z-index; front/back text, fill/text color, font size, horizontal/vertical alignment, image choice/import/clear; animation preset and audio reference; duplicate to stage/remove from stage.
- Standalone BCard editor: name, animation preset, audio reference; front/back text, background, text color, font size, text/vertical alignment, image and emoji/sticker.
- Preserve direct card placement and selection on Stage and runtime preview behavior; retain editor components rather than rebuilding their fields.

## Boosters

Source: `App.tsx`, Boost Sequences sidebar and active item inspector.

- Activation, Language, Games and existing Badge sequence contexts; select item, move up/down, remove.
- Add SlideRef, BreakRef, Prompt, Game, ACard and BCard Overlay using existing commands.
- Slide reference search/picker; break reference picker; prompt title/body; ACard reference picker and editor.
- Existing mini-game item behavior must remain as implemented; do not invent a new game configuration model.
- Overlay card instance authoring and preview actions as listed above; previous/next booster sequence navigation.

## Movement library

Source: `movement/MovementPanel.tsx` and movement presentation components.

- Add, duplicate, remove, enable events; trigger event or random movement.
- Random-shortcut enable/key; event name, instruction, duration, shortcut.
- Jingle on/off, volume, upload and clear; built-in or uploaded GIF.
- Animation selection (color burst, runner, hero flash, head bounce, nose bounce).
- Overlay opacity, wheel speed, intensity, GIF scale and three colors.

## Badges, students and sparks

Source: `sparks/BadgePanel.tsx`, `SparkProvider.tsx`, App spark settings and reward Stage surfaces.

- Student select/add/remove/rename and existing active participation controls; per-student spark counts and totals; reset and trigger reward actions.
- Reward layout/sprite selection; individual PNG import or shared-image fallback; sprite size, layer backward/forward and stage positioning.
- Congratulations text (`{n}` substitution); show/hide final badge; scores after final reveal.
- Regular/final backgrounds: color/image controls, import/remove, x/y positioning, scale, blur, brightness.
- Student badge PNG and per-variant star/crown PNG imports; sprite motion (spin/breathe/zoom), duration, intensity.
- Final badge: student-name visibility, text size, confetti count, celebration duration/always-display, animation duration/type, rotation, glow, color intensity, motion amplitude.
- Reward variant shape (star/diamond/circle/heart/crown), custom PNG import/remove and preview triggers.
- Spark settings: burst duration, particle count, glow/color intensity, counter visibility duration, pop scale, counter/spark size, top/right position and Gold/Blue/Pink/Crown previews.

## Relics

Source: `relics/RelicsPanel.tsx` and reward surfaces.

- Shared student roster add/rename/archive, active participants and progress.
- Increase/decrease/reset/complete progress; session display controls; show reward card.
- Widget visibility, anchor position, x/y offset, scale, existing widget display options.
- Entrance/reward animation choices, duration/intensity, RGB flow; animate on progress/stage change/completion.
- Relic title/description, three stage titles; main and stage 1/2/3 image imports.

## Manual acceptance checklist (required before retiring legacy layout)

Use a copy of a production episode. Record failures and verify saved values by reopening the project. A checked box means a human actually exercised the behavior; source inspection alone does not satisfy this gate.

- [ ] 1. Open production episode without conversion or missing content.
- [ ] 2. Navigate Edit timeline; confirm one horizontal sequence and selected label.
- [ ] 3. Jump sections; verify boundaries, empty sections and breaks.
- [ ] 4. Select image slide; adjust image and manipulate viewport.
- [ ] 5. Select video slide; preview, trim and edit video audio.
- [ ] 6. Select Break; edit content, background, media and timer.
- [ ] 7. Edit transition/direction/duration; apply to slide and section.
- [ ] 8. Edit slide and bubble tags.
- [ ] 9. Edit Dialogue/SFX/Slide BGM including clip settings.
- [ ] 10. Edit Section Music and Break Music.
- [ ] 11. Add/edit/resize/copy bubble/text, including a custom template.
- [ ] 12. Draw and edit viewport; verify pointer alignment at multiple divider widths.
- [ ] 13. Access Booster tools and each existing item context.
- [ ] 14. Access Boards, edit front/back cards and story attachments.
- [ ] 15. Access Movement; edit and preview an event.
- [ ] 16. Access Badges/Relics and advanced settings.
- [ ] 17. Reorder/add/delete using supported structural tools; undo/redo.
- [ ] 18. Save, reopen, confirm dirty/save state and persistence of all edited values.
- [ ] 19. Switch Edit to Teach and back; verify selection/LIVE target semantics.
- [ ] 20. Launch Present; verify reconnect/status and canonical geometry.
- [ ] 21. Verify lesson presents correctly, including video, break, board, booster, drawing and audio; navigator remains in true sequence.

## Verification boundary

Automated checks should cover shared timeline ordering/types, editing-versus-teaching capability gating and layout defaults. Existing project/history/audio/scene tests continue to protect semantics. Runtime acceptance above remains explicitly unverified until performed; passing unit tests or retaining JSX does not certify visual reachability, device routing or production-project parity.
