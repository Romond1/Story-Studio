# Team Play

Team Play is the new name for Shared Adventure. Choose it alongside Adventure, Discovery, Challenge and Mastery on Beginning. The original group configuration, devices, scoring ledger, mission, independent imports and save/open workflow remain available.

## Saved-session compatibility

Existing Shared Adventure lesson folders open directly through **Open group lesson**. Storage remains scene-v1 `project.json` with the `sharedAdventure` version-1 field. Existing student IDs, device assignments, scores and scoring history are preserved. Opening does not rewrite the file. The exact old default group name displays as Team Play; custom names are retained, and the saved name is not silently migrated. No episode conversion is required.

Prepared activities are stored in optional `sharedAdventure.preparation.activities`. Teacher-marked completion is stored separately in `live.completedActivityIds`. Earlier files without either field remain valid.

## Prepare and teach a sequence

1. Import images into this Team Play lesson's own media folder. Images from another episode may be imported as independent copies; the source episode is unchanged.
2. In **Activity library**, filter by source module or **Playable integrations only**. Compatibility and actual integration availability are shown separately.
3. Select Spinning Wheel or Hero Dash. Configure question text and explicitly selected images. The initial draft copies the current mission prompt/image as a starting point; subsequent mission edits do not overwrite prepared questions.
4. Choose **Add to lesson sequence**. Expand an entry to edit its saved questions/settings, move it earlier/later, remove it or load its configuration into a new draft. Every entry has a stable ID independent of its position.
5. **Launch next prepared activity** starts the first available, uncompleted entry. A specific entry can also be launched directly. Draft questions with missing content are marked **Needs preparation** and cannot launch.
6. Use the activity's teacher controls. For Wheel, Start Game → Spin Wheel → Complete Activity → Next Activity uses the existing mini-game runtime. For Hero Dash, start/pause/resume the race, select one of two racer roles, move a racer, show/hide questions and undo race actions.
7. Group points remain manual. Award one student, multiple checked students or the participating team while the activity runs. Race points and mini-game outcomes never become group points automatically. Group point undo remains independent of game undo.
8. **Show scoreboard** displays a passive overlay above the existing Presenter activity. Showing, hiding or updating it preserves the activity instance. It does not replace the activity with a mission slide. **Exit activity to mission** keeps the prepared entry uncompleted; **Complete and return to Team Play** marks it completed. Launch the next prepared entry when ready.

The library is locked while an activity runs. Mission/group controls remain available; edits to mission content apply to the mission screen, not the captured activity configuration. The teacher preview reuses SceneSurface for Wheel. Hero Dash has one native runtime in Present; Control displays its controls/status rather than a second race engine.

## Supported activities

| Source | Activity | Status in Team Play |
| --- | --- | --- |
| Discovery / existing Break mini-games | Spinning Wheel | Integrated adapter. Text or image questions, up to 40 per prepared entry. Teacher-led turns and manual group points |
| Mastery | Hero Dash | Integrated adapter. Each question requires a local image; two configurable racer roles and a 10–30 checkpoint course. Student identities/scores remain separate from racers |
| Adventure | Scene & Card teaching | Adaptable, not integrated. Needs an explicit authored-scene selection/import adapter |
| Discovery | Magic Hat, Mystery Cards | Adaptable, not integrated/tested through this hub |
| Discovery | Activation activities | Unsupported here. Existing completion/progression requires episode-authorized runs |
| Challenge | Language Snake | Unsupported here. Needs group-safe initialization, configuration/media and result handling around the episode module host |
| Mastery | Final Boss Hero | Unsupported here. Needs episode-host authorization and explicit Card/media mapping |
| Team Play | Exclusive cooperative activities | Reserved category; no new game advertised as playable |

Original activity entry points remain unchanged. Nothing is marked Ready merely because its original solo implementation exists.

## Lifecycle and limits

Group scores, profiles, device assignments, objectives, visibility and prepared sequence survive activity changes and save/reopen. **Save group lesson** works during an activity. Game runtime itself is transient: reopening restores the mission and saved preparation, then launching starts a fresh game. A successful Save As ends the current activity because its media root changes; cancellation preserves it. New/open cancellation also preserves the running activity. Resetting the group ends the activity and clears live group progress while retaining preparation/media.

Presenter refresh recovers the current Wheel scene snapshot. Closing/restarting Present retires a native Hero Dash run, reports the interruption and restores the mission; relaunch it explicitly. No automatic recording, Broadcast, browser student connections or networking are added.

Public scoreboards target small teaching groups. Very large rosters still need public scoreboard pagination. Imported video/audio remains saved by the existing pipeline, but these two adapters deliberately accept text/images only. No automatic answer checking or game-to-group score mapping is implemented.

## Register another activity

1. Inspect its actual ownership, media, authorization and completion contracts. Do not bypass episode run authorization or use standalone local-storage game modes as shortcuts.
2. Add metadata to `src/shared/teamPlay/activities.ts`: stable ID, existing display name/source, compatibility, content requirements, Presenter capability and exit behavior. Leave `playable: false` until its adapter is implemented and tested.
3. Resolve prepared content into the versioned `TeamContent` interface. It contains question IDs, text and local asset IDs, with an optional future pack-source ID. Never persist resolved grant URLs or reference another active episode's pool. Extend settings validation compatibly if new settings are needed.
4. Add an explicit run construction/projection branch to `src/shared/teamPlay/runtime.ts` and controls to `TeamPlayRunControls.tsx`, preferably delegating to the activity's existing pure actions/renderer. If new asynchronous events are needed, scope them to the current run instance in `useTeamPlayActivity.ts`.
5. Keep LessonApp's single publisher and the optional validated scoreboard overlay. Never mount a second Presenter or translate scores without a separately tested mapping.
6. Test malformed/old saved data, missing media, state isolation, completion/exit, cancellation, reopen and scoreboard mount stability in the real Presenter. Then enable `playable`.

Future reusable packs can populate the same content object after importing/remapping assets. They do not need to change existing adapters.

## Validation

The full suite passed **743 tests**, and `npm run check:games` passed **62 game regression tests**. Focused tests cover old sessions, registry filtering, prepared content references, actual Wheel/Dash actions, group-score isolation, long question IDs and public scoreboard whitelisting. Existing lifecycle tests now explicitly cover successful versus cancelled/failed Save As with transient Team Play ownership.

TypeScript and renderer/main builds passed. Vite retains the existing large-bundle warning. `node scripts/team-play-smoke.cjs` exercises an old Shared Adventure fixture through actual Electron Control/Present: both adapters, two-question Wheel progression, scoring/undo during play, stable game mounts across scoreboard changes, cancellation, completion/exit and sequence save/reopen. `node scripts/shared-adventure-smoke.cjs` retains the original group/solo workflow checks under the new UI name. Screenshots are written to `output/playwright/team-play/` and `output/playwright/shared-adventure/`.

Build before running the Electron scripts. They use FFmpeg and bundled Playwright, or the `STORY_STUDIO_PLAYWRIGHT` package-path override. All lessons used for testing are disposable copies. No commit, push or deployment is performed.
