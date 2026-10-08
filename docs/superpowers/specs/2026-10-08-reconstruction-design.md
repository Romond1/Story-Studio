# Story Studio reconstruction decision

## Recovery and scope

The starting point is `be7f47b` on `story-studio-rebuild`, also saved on GitHub as `new-layout` and the annotated tag `new-layout-checkpoint-2026-10-08`. The original `rebuild-from-v20.1` branch remains at `bd7440c`. Original lesson folders are not migration inputs and will not be edited. New work uses synthetic lessons and a separate format. Language Game and Final Boss are disabled future phases.

## Investigation and choices

The current App owns authoring, live navigation, persistence, selection, media, cards and overlay routing. EditWorkspace docks controls through portals but does not establish ownership. Activation media creation adds a Story Slide then references it from a Booster; the two timelines expose different operations. Nested board cards can be displayed from the board library while deletion targets the selected Booster item. V2 placements reference shared activities, so ownership is indirect there too.

App's liveV2ModuleRef is refreshed only in Teach, while the live placement ID comes from current authored data. Edit can therefore publish a new placement with an old module, or delete an instance while Present still sees the previous module. Card projection itself exists; its source is inconsistent. Scene geometry also diverges: measured stage dimensions, 1920×1080 breaks and 1280×720 Card activities are separately scaled. V2 cards sit outside the image/bubble frame and viewport.

Three approaches were considered. Continuing adapters retains these ownership conflicts. Rewriting all infrastructure discards mature file and audio handling. The selected approach establishes a new scene format and editor at an explicit boundary, retaining the legacy application as a separately mounted mode and preserving reusable low-level infrastructure.

## One authored model

`LessonProject` has a format discriminator and version, project assets, reusable Card V2 content, scene records, and two ordered sequences: Story and Activation. Each sequence entry has its own stable identity and references a scene. Scenes own their ordered object placements, logical frame, background, drawing, audio and transition. Scene references are explicitly linked; independent copies clone objects and card content. Removing an entry never removes media. Removing an object removes only that scene placement.

Card content retains tested V2 faces, styles and deterministic text fitting. A scene's card placement refers directly to content with initial face and concealment, without requiring a set/activity. Live face/concealment/geometry belongs to the session. Library reuse is optional and distinguishes linked content from independent copies.

## Rendering and session

A pure projection resolves scene objects, card faces and local asset URLs into one student-safe scene plan. Edit, Teach and Present mount one shared scene renderer inside one logical frame. Editor handles are a separate input layer; Present never receives Inspector controls or the authored project. All geometry is in scene units; a single contain transform handles window resizing. Frame alternatives include 16:9, 4:3 and portrait.

The new session owns a stable sequence-entry cursor, explicit Story return checkpoint, visit-scoped card state, drawing and viewport. Edit selection is independent. Navigation resets live state and stops scene audio/video; returning from Activation uses a stored entry identity. Authored edits reproject the active scene immediately, with runtime state retained only for surviving placements/faces.

## Product workspace

Both sequences use the same Media Pool, structural timeline, canvas, add tools and selection Inspector. Timeline supports insertion, drop, reorder, section labels, density/zoom and horizontal scrolling, with distinct edit/live markers. Add Card immediately creates content and placement. Text/bubble/card/media objects share select, move, resize, duplicate, delete and layer operations. Inspector edits the selected object or scene; advanced reuse remains collapsed. Teach substitutes navigation, card face controls, drawing, viewport, media/audio and rewards for authoring controls.

## Infrastructure retained

Retain the single Web Audio controller, device routing/settings UI, local media protocol and imports, atomic file writes, prepared activation/current-folder guards, immutable ProjectHistory, logical frame math, bubble graphics, Card V2 face layout, Present relay/status ordering and live video WebRTC transport. Present remains the only live video file decoder; Teach consumes its video-only preview stream, and its audio feeds Control's existing mixer. Edit video preview is muted and does not own live audio.

## Persistence boundary

New-format channels validate a distinct document and never normalize it into legacy ProjectData. Create and Save As require an empty target folder; save checks the active folder and on-disk format. Atomic writes and import/save exclusion remain. Legacy projects can be opened through the retained legacy mode; no automatic conversion or claim of native compatibility. New-format save must reject a legacy folder even if called with a crafted payload.

## Verification and milestones

R0 records this decision and checkpoint. R1 establishes validated domain/commands/history/session. R2 establishes shared rendering and safe transport. R3–R6 connect file lifecycle, identical authoring, direct cards/bubbles and Inspector. R7 verifies live media and interactions. R8 creates a disposable image/video Story and Activation lesson, saves/reopens it, exercises faces/deletion/return, and checks actual Control and Present renderer output. Focused tests precede each integration checkpoint. Existing test/build results and unautomated physical audio/device checks are recorded honestly.
