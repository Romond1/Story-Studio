# Unified Stage Drawing Design

## Summary

Story Studio will use one modern drawing pipeline for normal story slides and break screens. The drawing surface will render above all presentation content, including media, break backgrounds and text, bubbles, ACards, BCards, and other visual stage overlays. `Ctrl+D` will toggle draw mode globally when the user is not typing in an editable control.

The active stroke must remain visible while the pointer is held down. Rainbow, sparkle, opacity, and vanishing-tail effects continue to animate live. Committing a completed marker stroke on pointer release is only a persistence optimization; it does not delay visual feedback.

## Current Problems

The break screen uses an older drawing implementation in `ZoomPanWrapper`, while normal slides use a newer implementation in `MediaView`.

The older implementation has three coupled defects:

1. It writes marker points into project state on every pointer movement. This causes full application rerenders, missed input samples, and visibly scattered or jagged strokes.
2. Its drawing effect starts a new `requestAnimationFrame` chain whenever drawing state changes, but cleanup cancels only the first scheduled frame. Old chains continue running. Repeated input multiplies the number of canvas loops until the renderer becomes unresponsive and the Electron window remains open with a black surface.
3. It uses a separate normalized 1920 by 1080 canvas transform and stroke-width calculation rather than the established normal-slide segment renderer. This produces inconsistent stroke appearance.

The current normal-slide canvas is also nested inside `MediaView`. ACards, BCards, rewards, movement effects, and some other presentation layers are later siblings, so increasing the canvas z-index inside `MediaView` cannot place drawing above them.

## Requirements

### Unified behavior

- Normal slides and breaks use the same drawing engine and stroke renderer.
- Pointer-down starts a live stroke immediately.
- Pointer movement extends and displays the active stroke immediately.
- Marker strokes are committed to the active slide or break when the pointer is released.
- Highlighter strokes retain their live fading tail, rainbow, and sparkle behavior.
- Existing color, size, opacity, fade duration, rainbow, sparkle, clear, zoom, and pan behavior remains available.
- Existing saved marker strokes remain compatible.

### Stability

- Each mounted drawing surface owns at most one animation loop.
- Cleanup cancels the latest scheduled animation frame and prevents rescheduling after unmount or effect replacement.
- Pointer movement does not write the entire project on every event.
- Switching slides, switching to or from a break, clearing drawings, and toggling draw mode must not leave an orphan loop.

### Layering

- The canvas is the final interactive layer over the active visual presentation viewport.
- It appears above media, break backgrounds, break images, break text, timers, bubbles and bubble text, ACards, BCards, relic visuals, movement visuals, spark effects, and final badge presentation visuals.
- When draw mode is active, pointer input over the visual presentation viewport belongs to drawing.
- Application chrome remains outside the drawing surface: sidebars, top-level controls, editor panels, dialogs, and text inputs are not drawing targets.

### Keyboard shortcut

- `Ctrl+D` toggles draw mode on and off.
- The shortcut applies on normal slides and breaks.
- It calls `preventDefault()` so Electron or the embedded browser does not handle the chord.
- It ignores repeated keydown events.
- It does nothing while focus is in an `input`, `textarea`, `select`, or content-editable element.
- Existing plain `D` navigation remains unchanged.

## Architecture

### Shared drawing engine

Extract the active-stroke lifecycle and canvas renderer from the modern normal-slide implementation into a shared drawing component or hook. It accepts:

- the current `DrawSettings`;
- persisted marker strokes;
- a callback that commits marker strokes;
- the clear signal;
- the active viewport transform;
- the coordinate bounds of the active visual presentation surface.

The shared engine owns only transient drawing state: the active marker, active highlighter, fading highlighter strokes, pointer-active state, and the current animation-frame handle.

### Live stroke data flow

1. Pointer-down creates an active stroke in a ref.
2. Pointer movement appends points to that ref without updating the project.
3. The single animation loop reads the active ref and renders the complete live stroke every frame.
4. Highlighter aging, rainbow color, and sparkle rendering continue on every frame.
5. Pointer-up copies a completed marker stroke into the active slide or break once. A highlighter remains transient and fades according to its configured duration.
6. Clear removes persisted marker strokes and transient highlighter state.

This preserves immediate visual feedback while eliminating project-wide writes during pointer movement.

### Stage-level placement

The drawing canvas will be hosted at the visual-stage level rather than inside the media layer. Its bounds follow the active presentation viewport, and its stacking level is above every presentation overlay. The drawing engine receives the active slide or break as its persistence target.

Normal slide media no longer owns the topmost drawing canvas. Break rendering no longer owns a separate legacy drawing algorithm. Both route their viewport and target stroke data into the shared drawing layer.

## Error and Lifecycle Handling

- If the canvas, its container, or the 2D context is unavailable, the frame exits safely without creating an additional loop.
- An active flag prevents callbacks from scheduling another frame after cleanup.
- The latest frame ID is stored and canceled during cleanup.
- A target change ends any in-progress transient stroke before switching persistence targets, preventing a stroke from being written to the wrong slide or break.
- A zero-length click does not create a persisted marker stroke, but it must remain safe and must not start additional loops.

## Testing

### Unit regression tests

- A managed animation loop schedules only one successor per frame.
- Cleanup cancels the latest frame, not only the initial frame.
- A callback cannot reschedule after cleanup.
- Active marker points remain transient during movement and commit once on release.
- A click without movement does not persist an empty stroke.
- The editable-target guard suppresses `Ctrl+D` in inputs, textareas, selects, and content-editable elements.
- `Ctrl+D` toggles drawing and prevents the default action outside editable controls.

### Structural and integration checks

- The drawing canvas is mounted after all visual presentation layers.
- Breaks and normal slides route through the shared drawing implementation.
- Existing saved marker-stroke data renders on its original slide or break.
- The existing Clear Drawings action clears the active target.

### Manual verification

- On a break, activate marker drawing and click once; the renderer remains responsive and does not turn black.
- Draw continuously on a break; the line follows the pointer smoothly.
- Use the rainbow vanishing highlighter; its tail is visible live and fades normally.
- Draw over break text, images, timer content, bubbles, bubble text, ACards, BCards, relics, movement effects, sparks, and final badge visuals.
- Repeat the equivalent checks on a normal slide.
- Toggle drawing on and off with `Ctrl+D` in both contexts.
- Confirm plain `D` still advances navigation.
- Confirm `Ctrl+D` does not toggle while typing in an editable control.
- Repeatedly enter and leave breaks, toggle drawing, and make strokes while monitoring responsiveness.
- Run the full automated test suite, renderer build, and main-process build.

## Non-Goals

- Changing drawing colors, tools, or control-panel layout.
- Adding pressure sensitivity, stroke smoothing algorithms, undo redesign, or new brush types.
- Drawing over application sidebars, editor panels, dialogs, or other non-presentation UI.
- Changing crash-recovery data behavior except for removing the drawing workload that currently causes the black renderer.

