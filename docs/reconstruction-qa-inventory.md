# Reconstruction acceptance inventory

All source lesson folders are excluded. Use a disposable folder below the system temporary directory.

- File lifecycle: New chooses empty directory; import image/video/audio; save; open same project; Save As creates independent assets. Wrong-format overwrite and cancelled candidates are covered by real-file automated tests.
- Shared authoring: Story image/video scenes; add bubble and two-face card; edit text; move/resize; duplicate/delete; undo/redo; change layer; select hidden object; repeat in Activation. Inspect same workspace and logical dimensions.
- Scene reuse: independent copy and linked reuse are named; editing/deleting independent copy leaves source unchanged.
- Media and timeline: search/filter/insert/drop, reorder, density/zoom and live/edit markers. Scene deletion retains media.
- Live: open actual Present; verify visible image/video + card + bubble, no teacher controls; Next/Previous face, conceal/reveal; edit deletion updates Present without toggling Teach; edit selection does not navigate Live.
- Navigation: Story → Activation → Return to stored Story; reorder while return checkpoint exists; reset live card/drawing state.
- Geometry: normal and smaller Control window, 4:3/custom scene and separately resized Present. Compare logical object geometry and visual aspect fit.
- Audio: existing mixer/settings opens; actual video advances in Present and uses one decoder; Teach preview is a muted received stream. Async scene audio stop/dedup is tested with the actual owner. Physical microphone/virtual device output requires user hardware verification.
- Persistence proof: save/reopen synthetic complete lesson, replay selected faces and verify authored content survives.
- Exploratory cases: delete current live/return scene; remove currently selected card face; rapid scene navigation during media preload; cancel unsaved-project replacement.

Capture actual Control Edit, Teach and student Present screenshots. Record observed results and any remaining manual checks in reconstruction-verification.md. DOM staging is permitted only for fixture/dialog setup; critical authoring and teaching actions must use normal controls.
