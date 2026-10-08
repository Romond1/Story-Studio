# Timeline UX reconstruction and interaction fixes

The new request supersedes the earlier usability pass. Commit `1bfb10f` has section labels/dropdown assignment, a flat strip, single object selection, tall pool controls, Alt-wheel canvas zoom and drawing publication only after pointer release. These are the gaps this phase addresses.

## Design

Retain the unified scene/sequence model, stable entry IDs, ProjectHistory, Card content and Control-owned Present projection. Use horizontally arranged visual Section containers containing their scene tiles. The header is a whole-section drag handle; the body accepts image/video assets and scene entries, including when empty. A drop position inside a container explicitly supplies membership. Reordering a Section moves its entries atomically, preserving internal order, identity and the live target. Ungrouped scenes remain available and sequence order remains authoritative on save/reopen.

A single compact timeline toolbar holds add and zoom controls; per-scene and per-section actions live in context/overflow menus. Eliminate the separate section-label row and manual membership dropdown. Use actual thumbnails and clear insertion/drop feedback. Keep keyboard alternatives to drag.

Marquee selection starts on empty Edit canvas using left drag. Shift/Ctrl click toggles selection; selection supports group move, Delete/Backspace, Ctrl/Cmd+A/C/X/V/D, Undo/Redo (Z, Shift+Z, Y), arrow nudges and Escape. Text inputs, menus, dialogs and focused controls retain native shortcuts. Clipboard copies of Cards remain independent, and a group edit is one undo step. Timeline also supports multi-selection and group operations. Teach retains individual Card movement rather than authoring selection.

Media Pool shows a compact import/search header, thumbnails using remaining space, and optional filters/bin controls. Existing import, bins, multi-selection and audio support remain.

Normal wheel on Edit/Teach canvas zooms at the pointer without a modifier. Middle-button drag pans with every tool. Timeline wheel scrolls horizontally; Alt-wheel zooms. Left drag never pans. Live Teach drawing is projected before mouse-up, without adding a history entry for every point; commit adds one stroke, cancellation removes the transient stroke. Navigation and reset clear transient previews.

## Acceptance

Use a disposable lesson with Section 1, Section 2, image/video assets and several objects. New real Electron interaction checks must demonstrate media dragged from the pool into Section 2, scene movement between containers, whole Section 2 moved before Section 1 with every child, empty/collapsed targets, undo and save/reopen. Check marquee at a transformed viewport, group shortcuts, ordinary canvas wheel, timeline wheel semantics and Present ink while the mouse is still down. Capture before/after workspace, timeline and Media Pool screenshots at desktop and narrow sizes. Existing tests protect regressions only.

The prior separately named Timeline specification was not supplied in this chat; the user's latest explicit requirements are authoritative. No original Episodes are touched. Physical driver-specific wheel tilt remains a hardware limitation, not part of automated proof.
