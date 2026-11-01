# Shared Adventure: repository inspection and first slice

Date: 2026-11-01. Inspected working tree on `codex/media-pool-editing-improvements`, HEAD `a433245`. Existing uncommitted lesson, rewards, wheel, camera and Presenter changes are part of the inspected baseline and must be preserved. No commit, push or deployment is authorized.

## Repository findings

| Responsibility | Existing implementation | Reuse |
| --- | --- | --- |
| Default Control | `src/renderer/main.tsx`, `lesson/LessonApp.tsx` | Add a Beginning destination and bounded workspace; retain existing project lifecycle |
| Legacy Control | `src/renderer/App.tsx`, selected by `?legacy=1` | Leave legacy authoring intact |
| Presenter | `src/main/presentWindow.ts`, `src/shared/presentationSnapshot.ts`, `src/renderer/present.tsx` | Keep authenticated IPC, revision ordering, readiness and scene rendering |
| Scene composition | `shared/lesson/projection.ts`, `renderer/lesson/SceneSurface.tsx` | Generate ordinary ScenePlans for group display; no new rendering engine |
| Media | `main/mediaImportService.ts`, `main/mediaRegistryService.ts`, `renderer/useMediaRegistry.ts`, `shared/lesson/mediaImport.ts` | Copy supported media into the active lesson's assets folder and resolve scoped grants |
| Saving/recovery | `main/lessonPersistence.ts`, `main/lessonRecovery.ts`, `renderer/lesson/useLessonAutosave.ts` | Reuse project.json, atomic writes, checkpoints, expected-folder guards and Save As |
| Profiles/classes | `main/studentService.ts`, `main/studentSettingsRepository.ts`, `renderer/students/StudentsWorkspace.tsx` | Offer existing permanent profiles as group members; local lesson members need no account |
| Rewards | `shared/lesson/rewards.ts`, `shared/students/groupRewards.ts`, `renderer/students/PresentRoster.tsx` | Existing rewards have different scope: transient lesson sparks versus adventure-bound permanent rewards; cooperative points must not silently change either |
| Activities | `shared/modules/model.ts`, `templates.ts`, `renderer/episode/useEpisodeModuleHost.ts` | Activation Cards, Snake, Final Boss and Hero Dash exist; module runs require episode/adventure identities, so do not manufacture those identities for group lessons |
| Movement | `shared/movement.ts`, `renderer/TeachMovementControls.tsx`, mini-game wheel work | Adapt movement prompts in milestone 2; preserve keyboard bindings and existing runtime ownership |

The current default product uses Adventure/Discovery/Challenge/Mastery labels. Legacy Boosters remain a separate compatibility workflow.

## Broadcast inspection

Current `cameraBroadcast.ts` and `translationBroadcast.ts` are Electron relays, not remote classrooms. `presentationMediaBridge.ts` uses local WebRTC with an empty ICE-server list to bridge Present media into Control. It is not suitable as an internet classroom connection manager.

Read-only inspection of local branch `salvage/broadcast-mess` found `broadcast:set-mode` creating a local program window and `broadcast:push-state` forwarding renderer payloads. No WebRTC signaling server, admission service or remote student browser was found in that prototype. Do not merge its permissive relay over the current validated Presenter.

## Architecture decision

The user selected dedicated Shared Adventure lesson folders with their own media, using existing save/open switching. The media registry has exactly one active root and invalidates grants on activation. Therefore, a group lesson is an ordinary scene-format document with a validated optional `sharedAdventure` extension. It owns its own assets and media bins. No parallel active project root or global arbitrary-file URL access is introduced. Existing episodes are unchanged; episode embedding is outside this slice.

Alternatives considered: embedding group preparation in episodes would couple it to episode media and require episode-format extension; multiple simultaneously active media stores would require broader grant/import/save lifecycle changes. Dedicated folders provide independence using the established lifecycle.

## Smallest practical usable milestone

Add a Shared Adventure destination, dedicated draft/new/open/save flow, configurable group members and named device/location assignments, participation flags, shared objective list and target, integer points for selected/all participating members, exact undo, reset, direct media import and image selection. Save preparation and live progress in separate nested records inside the lesson extension; do not overwrite lifetime student progression. Present a teacher-selected image/prompt with a toggleable individual/team scoreboard using the existing ScenePlan renderer. No global Tab shortcut: preserve focus navigation and existing teaching shortcuts.

Existing media may be imported from episode assets without modifying the source. Cross-episode pack/catalog import with identity remapping belongs to milestone 3, not an unsafe reference to another active root.

## Boundaries and future implementation order

1. Pure group model, validation, scoring, reset and scene projection; tests.
2. Dedicated workspace and normal file/media lifecycle integration; tests and Electron acceptance.
3. Data-driven rounds: Secret Description, Ask Your Teammate, movement. Separate teacher answers from public projections; then Shared Puzzle/Information Gap.
4. Reusable packs and ordered activity preparation, explicit asset dependency closure and ID remapping.
5. Broadcast architecture spike, then browser admission, secure signaling, A/V and reconnect tests.
6. Authorized per-device projections, Secret Mission waiting/send/cancel/reveal and reconnect isolation.

## Broadcast design constraints for the next phase

Do not select a vendor or promise NAT reliability based on local IPC tests. Evaluate a small peer mesh with teacher-mediated presentation against an SFU: mesh has fewer services but more uplink/peer churn; an SFU centralizes forwarding and is a candidate for reliable multi-party audio at the cost of hosting and operational complexity. Both need authenticated signaling, HTTPS/WSS, short-lived admission, ICE restart/reconnect policy and TURN fallback; budget and Japan/Italy network measurements must inform the final selection. Current local `media://` URLs cannot be sent to a browser; asset delivery needs expiring authorized HTTPS grants.

Maintain separate student, device, room-session and connection identities. The server must derive the current device from its admitted credential and project only that device's permitted state. Never broadcast every clue and hide it in CSS. Revocation and new admission invalidate private payloads; reconnect snapshots contain only currently authorized clues. The teacher alone advances activities and scores. Sharing siblings receive one device-private clue, not sibling-private content. No recording, public chat or file transfer.

## Risks and acceptance

Highest integration risks: single project-root ownership; two writers racing to publish Present; autosave mixing prepared/runtime state; stale imported media grants; active solo hotkeys firing inside group mode; accidentally extending strict episode schemas. Keep one publisher and gate existing solo handlers while the group workspace owns the display. Test cancellation of new/open, folder switching, Save As, score undo after persistence, absent members, two siblings sharing one device, invalid references and reset. Verify the full existing suite and TypeScript builds. Physical Zoom sharing and remote Japan/Italy A/V are manual future acceptance, not claims of this milestone.
