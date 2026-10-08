# STORY STUDIO — AUTHORING & TEACHING USABILITY PASS

## Mission

The reconstructed Story Studio on `story-studio-rebuild` has passed initial hands-on acceptance. Its unified Story/Activation Scene architecture, Media Pool, direct Card/Bubble editing and Present behavior are substantially improved.

**Keep this architecture. Do not start another major reconstruction.**

Implement the following eight usability and teaching requirements before work begins on Language Games, Final Boss or advanced activities.

First inspect the current implementation, create a safe checkpoint, and reuse the existing scene, history, presentation and rendering systems. Work in verifiable stages and report any meaningful conflicts.

## 1. Preserve scene state during teaching

Currently navigation reportedly resets scene-local Card faces, drawings and viewport.

Change the default behavior so revisiting a scene in the same teaching session restores its previous state, including:

- Displayed Card faces and conceal/reveal state.
- Temporary Card positions.
- Live drawing annotations.
- Zoom and pan position.

Provide an explicit **Reset Scene** command that restores authored defaults.

A new teaching session starts fresh. Save/reopen of authored lessons must not accidentally persist temporary teaching state.

Identify scene occurrences by stable identity so reused scenes cannot accidentally share unintended temporary state.

Do not reset scene state merely because its rendering component unmounts.

## 2. Restore Sections and distinguish Breaks from Scenes

Preserve the unified Scene model.

Introduce first-class lesson timeline structure:

- **Scene:** reusable authored canvas/content.
- **Section:** named grouping of scenes, optionally with section-level settings.
- **Break:** distinct timeline item with a specialized interactive/review-oriented scene template, using the same underlying scene editor and renderer.

Breaks must support multiple pictures, text and other ordinary scene objects. Do not recreate the old legacy Break engine.

Provide:

- Add Section.
- Rename Section.
- Move/reorder Scenes within Sections.
- Move Scenes between Sections.
- Collapse/expand Section groups.
- Add Break between or within Sections where supported.
- Distinct Section and Break visuals in the timeline.
- Contextual insertion controls.
- Scenes outside named Sections for teachers who prefer an ungrouped lesson.

Sections and Breaks must also be navigable coherently in Teach.

Do not force every scene into a named Section.

Allow future scene templates or Save Scene as Template without implementing a complex cross-project template library in this phase.

Inspect existing music/section semantics before adding section-level settings; preserve current behavior and defer unimplemented settings explicitly.

Ensure Story and Activation remain compatible with the shared scene/sequence architecture.

## 3. Resizable workspace panels

Make the following adjustable using draggable splitters:

- Media Pool width.
- Inspector width.
- Timeline height.
- Central Preview area through the available remaining space.

Use sensible minimum and maximum dimensions.

Consider double-click-to-reset and optional layout reset.

Persist preferred workspace dimensions as local UI settings, not lesson content.

**Critical:** Preview must always preserve the authored Scene aspect ratio and match Present's logical composition. Resize the preview uniformly, letterbox as needed, and ensure pointer coordinate transforms remain correct.

Do not resize authored objects when the panels are resized.

## 4. Clear Inspector visual hierarchy

Improve the readability of the Inspector without changing its context-sensitive behavior.

Keep the excellent existing feature whereby selecting a Card, Bubble or other object opens its corresponding Inspector controls.

Improve separation through:

- Clear section boundaries.
- Stronger headings.
- Distinct nested groups.
- Subtle alternating or contrasting surfaces.
- Consistent padding and spacing.
- Obvious expand/collapse affordances.
- Clear selected-object identification.

Avoid excessive bright colors.

Avoid adding new navigation layers merely to solve styling.

Make the difference between Scene properties, selected-object properties and advanced options immediately recognizable.

## 5. Mouse-driven zoom, pan and context menus

Preserve existing Zoom/Pan buttons and slider as accessible alternatives.

Use consistent mouse interactions across the Edit canvas, Teach canvas and timeline. Preserve current functionality wherever possible.

### Shared mouse interaction contract

- Middle-mouse-button drag is the standard panning gesture across both the Edit/Teach canvas and the timeline.
- Do not change panning to left-drag by default.
- Left-click/drag remains dedicated to selection, Card interaction and drawing when Draw is active.
- Middle-mouse drag pans regardless of the selected drawing tool, including while Draw is active. It must not draw, select, move or flip a Card.
- Right-click opens the contextual menu appropriate to Edit or Teach.
- Mouse-wheel zoom and existing zoom buttons, pan controls and sliders remain available.

### Teach mode

- Mouse-wheel zoom, preferably anchored under the pointer, with an appropriate modifier if needed to avoid unwanted scrolling.
- Middle-mouse drag pans the canvas regardless of the selected drawing tool. Left-drag on empty canvas does not pan by default.
- Dragging a movable Card moves that Card rather than panning the background.
- Short Card clicks retain their configured flip/reveal behavior.
- Drawing mode uses left-drag for drawing; middle-mouse drag continues to pan.
- Right-click opens a compact contextual menu with navigation and current-tool actions.

### Edit mode

- Keep left-click selection and direct manipulation.
- Right-click the empty canvas to offer Add Card, Add Bubble, Add Text, Add Image and other supported authoring actions.
- Right-click an existing object for its relevant operations such as Duplicate, Copy to Scene and Delete.
- Prevent native Chromium context menus from interrupting the workflow where an application menu is supplied.

Keep left-click/drag for selection and direct manipulation in Edit. Use middle-mouse drag for panning in Edit, Teach and the timeline.

### Gesture safety

Distinguish click from drag using an appropriate movement threshold.

Prevent a drag from also triggering Card flipping.

Respect pointer cancellation and focus changes.

While an active lesson is open, prevent accidental Back/Forward navigation caused by mouse side buttons or wheel-tilt shortcuts. Scope this protection to those accidental mouse navigation gestures without interfering with normal text editing or intentional application navigation.

Keep all mouse actions correctly mapped at different canvas zoom levels, aspect ratios and window sizes.

## 6. Drawing toolbox

Expand Teach drawing into an accessible, compact toolbar or contextual menu.

Initial tools:

- Pen.
- Highlighter.
- Eraser.
- Brush size.
- Color selection.
- Undo/redo drawing where practical.
- Clear drawing with appropriate confirmation.
- Pan/navigation tool, with middle-mouse drag available regardless of the selected tool and no default left-drag panning.

A right-click drawing menu may expose the current drawing tools.

Preserve the existing drawing renderer and logical coordinate system.

Drawing should appear consistently in Control preview and Present.

Drawing state should survive scene navigation during the current session.

Do not turn this into a full vector illustration program.

## 7. Copy or move Cards between Scenes

Implement easier reuse of individual Cards without requiring the user to save them into the Card Library first.

Support:

- Copy selected Card.
- Paste into another Scene.
- Duplicate Card to another Scene.
- Copy to Scene from contextual menu.
- Drag a Card from the canvas onto a destination Scene thumbnail in the timeline where safe and practical.

Use sensible destination placement with visible selection and undo support.

Default cross-scene duplication should create independent editable Card content, unless the teacher explicitly chooses linked reuse.

Keep the existing Card Library as an optional reuse feature.

Do not let dragging accidentally delete the original Card.

Support Story-to-Activation copying where compatible with the current scene model.

## 8. Live Card movement in Teach

Allow individual Cards to be moved by the teacher while teaching.

Movement initiated through the Teach preview must update the authoritative live Card position and be reflected in Present.

If direct interaction with the Present window itself is supported, it must send validated input to the same live authority rather than maintain a separate local position.

Present remains student-safe and does not acquire authoring controls.

Important:

- Only Cards are draggable in Teach.
- Speech bubbles and ordinary text are not draggable in Teach.
- Live Card movement does not modify authored project geometry.
- Movement survives navigation away and back in the same session.
- Reset Scene restores authored Card positions.
- Edit mode continues to alter saved authored Card positions.
- Coordinate mapping remains correct at different preview and Present sizes.

Reuse the existing authoritative session/command pathway.

Do not create a separate Card movement runtime.

---

## Implementation stages

**P1 — Session-state preservation**

Prove Card faces, drawings, viewport and Card positions survive scene navigation.

**P2 — Sections and Breaks**

Implement the structural timeline model and distinct timeline UI while preserving Scenes.

**P3 — Workspace improvements**

Implement resizable splitters, aspect-safe preview, and Inspector hierarchy.

**P4 — Teach pointer controls**

Implement mouse-wheel zoom, consistent middle-mouse drag panning across Edit/Teach and the timeline, Card drag interactions, contextual menus and protection against accidental mouse Back/Forward navigation while a lesson is active.

**P5 — Drawing toolbox**

Implement improved controls and verify shared drawing geometry.

**P6 — Cross-scene Card operations**

Implement copy/paste, Copy to Scene and safe drag-to-timeline where feasible.

At each stage run relevant automated tests and appropriate application-level verification.

Do not claim full GUI acceptance based only on unit tests.

## Regression requirements

Do not break:

- Existing Story/Activation shared editing.
- Media Pool and media import.
- Timeline ordering.
- Add/Edit/Delete Card.
- Named Card faces.
- Speech bubbles.
- Edit/Teach/Present consistency.
- Save/reopen and undo/redo.
- Independent Edit selection and Live target.
- Existing audio/media ownership.
- Git recovery checkpoint.
- Legacy-mode isolation.

Do not modify original Episodes 1–6.

## Completion requirements

Create a disposable lesson demonstrating:

- Two Sections.
- One Break.
- Multiple Scenes.
- Multiple Cards.
- Card state retained across navigation.
- Resizable panels without geometry drift.
- Right-click menus.
- Mouse-wheel zoom and existing zoom controls.
- Middle-mouse drag panning in Edit, Teach and the timeline, including while each drawing tool is selected.
- Left-click/drag selection, Card interaction and drawing without default left-drag panning.
- Mouse side-button and wheel-tilt Back/Forward protection while a lesson is active, with normal text editing and intentional application navigation preserved.
- Drawing and erasing.
- Copying a Card to another Scene.
- Moving a Card live while Present mirrors it.
- Save/reopen of authored content.

Report completed work, test results, known limitations and a short manual acceptance checklist.

Do not implement Language Game or Final Boss.

**The success criterion is a Story Studio that is comfortable for real daily lesson preparation and live teaching, not simply an application with more features.**