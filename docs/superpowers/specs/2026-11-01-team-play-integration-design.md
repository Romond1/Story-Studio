# Team Play integration

Scope: rename the existing Shared Adventure UI and add a small activity integration layer. Keep `sharedAdventure`, version 1 and saved group identity/scoring contracts. No Broadcast, commits, pushes or deployment.

## Inspection and integration choice

Beginning already lists Shared Adventure beside Adventure, Discovery, Challenge and Mastery. `LessonApp` owns the active document and the single Present publisher. Group lessons use scene-v1 project.json plus an independent assets folder. Existing defaults can be renamed on display without rewriting saved names.

The activity implementations differ:

| Activity/source | Classification | Integration |
| --- | --- | --- |
| Adventure scene/card teaching | Adaptable | Existing SceneSurface/projectScene are usable, but a prepared scene selection/import adapter is not part of this slice |
| Discovery Spinning Wheel | Adaptable, implemented | Build a temporary Break scene from explicitly selected Team Play questions; reuse WheelTeachControls, actOnMiniGame, projectScene and WheelScene |
| Discovery Magic Hat/Mystery Cards | Adaptable, not enabled | Same runtime family exists, but no Team Play adapter tested in this slice |
| Discovery Activation activities | Unsupported here | Completion and progression use episode-authorized runs; a group scene-sequence adapter is required |
| Challenge Language Snake | Unsupported here | Hosted initialization/config/result handling uses episode/adventure-authorized runs. Do not launch its standalone local-storage mode as a shortcut |
| Mastery Hero Dash | Adaptable, implemented | Reuse createDash/dashAction/dashProjection and native HeroDashPresent; two racer roles are not student identities; group points remain manual |
| Mastery Final Boss Hero | Unsupported here | Episode module host, card configuration/media mapping and progression need a dedicated group adapter |
| Team Play exclusive | Unsupported/future | Reserved category; no invented playable game |

No existing game is claimed Ready without an adapter. Activity definitions expose compatibility separately from actual launch availability. Definitions reuse names/descriptions from the existing registries and add explicit requirements/exit behavior.

## Persistence and content

Optional `preparation.activities` contains stable sequence entry IDs, registry IDs, titles, launch settings and a versioned content object with question IDs, prompt text and local image asset IDs. Existing files without this field load unchanged. Image references must belong to the Team Play lesson; no episode pool is modified. Each entry snapshots selected content. Future packs can resolve into the same content contract.

Running activity state is transient, isolated from group state. Saving while running saves group scores and the prepared sequence; reopening returns to the mission, and launching starts a fresh game. Leaving/completing a game never translates its local rewards/scores into group points. The teacher retains scoring and sequence progression authority.

## Presentation ownership and lifecycle

Keep one publisher in LessonApp. A running adapter owns the base target; otherwise the group mission owns it. Native Hero Dash enters through existing launch-game IPC. Wheel uses the existing scene target. A validated optional public scoreboard on PresentSnapshot overlays either base target with pointer-events disabled; it never swaps the target or remounts its activity. On hide, scores remain in the group session. Completion/exit restores the mission. Close/reload retires a native game through existing game-ended events; wheel scene reconnect can recover from its current authoritative plan.

Team Play file switching/new/reset/home ends the current transient run safely. New/open cancellation preserves it. Save As preserves group data and ends a run after a successful root change to avoid stale media grants. Preparation is locked during an activity; scoring, undo and scoreboard controls remain usable.

## Files and checks

Add `shared/teamPlay/activities.ts`, `runtime.ts`, `scoreboard.ts`, `teamPlay.test.ts`; add renderer library, adapter controls, hook and scoreboard overlay components. Extend existing group validation, scene-document image validation, snapshot whitelist and single publisher only at their boundaries. Keep solo defaults unchanged.

Tests cover old saved sessions, compatibility filtering, explicit content selection, real wheel/dash actions and public projections, rejected image references, manual scoring isolation, overlay whitelist, and lifecycle restoration. Electron checks run both adapters, scoring while active, overlay mount stability, sequence persistence, cancellation, exit/reopen and solo regression. Capture desktop/narrow UI and Present evidence. Report actual command results.
