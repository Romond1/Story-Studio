# Language Snake integration design

The current scene workspace remains the lesson authority. Game and Mastery use one registry and one Game Host. Language Snake is a maintained local copy of the original React application, separately bundled and isolated from Story Studio shortcuts and CSS in an iframe.

## Session ownership

Use an explicit teacher-controlled presentation model. Present owns the only interactive iframe. Control contains game selection and launch, restart, focus, keyboard forwarding, and exit controls; it never imports or mounts the game runtime. A projection contains only the registered game ID and a unique instance ID. There is no state mirroring, save-file synchronization, Control fallback, or runtime migration.

Closing, crashing, or reloading Present ends the run. Control returns to selection and restores the retained lesson projection. Restart creates a fresh instance ID and tears down the old iframe. All lesson state, authored changes, cursor, temporary cards, and drawings stay in the existing LessonApp. Leaving the game workspace also ends the run.

## Alternatives considered

Control-owned runtime with passive Present rendering would preserve gameplay across window closure, but Snake renders extensive DOM and overlays without a passive view contract. Copying its partial save payload omits active questions, crowns, enemies, and timers. Two live components would diverge. Present-only ownership preserves the original mechanics with a small, explicit workflow limitation.

## Boundaries

- Typed registry: known local game IDs, title, description, modes, sections, and local launch URL.
- Shared Game Host: selection, lifecycle, errors, and teacher controls for both sections. Only In Game offers Snake now; Mastery has a truthful empty library.
- Present game surface: one iframe selected by registry ID, readiness/error bridge, and whitelisted input forwarding. Following the user's edge-to-edge and resolution feedback, the iframe fills the native window with no fixed rendering size or scaling transform. Layout responds to the window and display pixel density.
- IPC: authenticated Control-to-Present keyboard packets fenced by the active instance ID. Launch atomically commits the registered game projection and opens/focuses Present in the main process, so closing during restart ends the new owner. Never accepts an arbitrary game URL.
- Vendored Snake: unchanged mechanics; host bridge, isolated persistence namespace, explicit saved-state loading instead of auto-restoring a hosted run, native responsive layout with hidden scrollbars and reachable controls, and local build entry.

Entering the library pauses lesson media and retains its identity and playback position. Returning restores that position, independent of game launch/restart, and leaves the video paused for the teacher to resume.

## Audio and input

Mouse settings and gameplay remain available in Present; Control can forward physical keyboard controls and focus Present. Iframe isolation prevents keyboard events reaching Story Studio. Snake audio originates in Present through its original Web Audio system and browser output, outside Story Studio's custom device routing. Conferencing capture and specific devices require manual verification and must not be claimed supported by automated tests.

## Validation

Unit coverage verifies allowlisted projections and stale input rejection. Real Electron acceptance checks a single iframe across both windows; actual gameplay; keyboard routing; restart teardown; exit; close/reopen; viewport fit; and unchanged lesson data. Run the existing tests, renderer type check, renderer/main production builds, and lesson regression acceptance. Record actual results and remaining manual audio checks.

## Existing work protection

Stay on story-studio-rebuild, HEAD f6f6fb59c5fa74b2d2d6f5e4c9167d410839a530. Existing tracked changes and directly touched file baselines were copied to D:\Temp\story-studio-language-snake-20261009. Do not commit unrelated work or modify the original Snake folder.
