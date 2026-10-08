# Safe editing follow-up

Authorized scope: strengthen save verification, move drawing controls outside the
stage, and add Ctrl+Z / Ctrl+Shift+Z for persistent project edits in both modes.

Use a bounded in-memory history of immutable ProjectData references (100 undo
steps), with an explicit saved revision. Group pointer gestures and focused text
editing into single steps. New edits after undo clear redo. Undo/redo never writes
files, changes the active project folder, or deletes imported assets. Save retains
history and acknowledges only the written revision. New/Open reset history only
after successful activation; cancellation/failure retains history and dirty state.
Save As keeps history but moves the current folder. History is not in project.json.

Navigation, slide zoom, playback, transient highlighter strokes, and app settings
remain outside history. Text controls keep native undo and cut. Invalid selection
after undo is reconciled to an existing slide/section. Automatic normalization
must not generate undo entries or invalidate a valid saved revision.

Drawing controls occupy normal layout above the stage, keeping the existing
palette and controls. The stage shrinks to leave physical space for controls.
A floating popover would retain overlap risk; a new sidebar is unnecessary.

Save verification covers pending edits/imports, failed Open, cancellation,
failed temporary writes/sync/replacement, and Save As asset-copy success/failure.
Production episodes are read-only and hash-checked. No audio or presentation
architecture changes. Normal renderer/main builds and existing regression tests
must pass; pre-existing renderer type errors are reported separately.
