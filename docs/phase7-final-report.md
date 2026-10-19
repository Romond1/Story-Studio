# Phase 7 — Persistent Heroes and Student Management

Status: COMPLETE. Phases 7A–7F passed their required automated and native acceptance gates on 2026-10-13 (Asia/Tokyo).

## Preservation and prerequisites

Phase 6 completed before Phase 7 began. All work remains uncommitted on `phase-6-rebuild-integration`. The original branch `codex/presenter-camera-phase1` remains at `16ae31dc879ad3324a2d70bfdf8346fc3fe3d323`; the pre-rebuild checkpoint is `ac175d4f12b1100e54861ba445d67aa5baa25209`, tagged `phase-6-pre-rebuild-checkpoint`. There were no implementation commits, pushes, merges, or branch changes. Production lesson and student records were not used as writable fixtures.

The existing `story-studio-settings.json` roster remains the identity authority. Phase 6's private progression repository remains the reward/history authority. No second student database or reward engine was introduced.

## Sub-phase status

| Sub-phase | Status | Acceptance evidence |
| --- | --- | --- |
| 7A Persistent profiles | COMPLETE | Seven native groups; duplicate-name identity, editing, archive/restore, explicit mapping, restart and narrow layout. |
| 7B Classes and groups | COMPLETE | Five native groups; multiple enrollment, active class, participant loading, guests, archive/restore and restart. |
| 7C Hero Board | COMPLETE | Six selector tests and five native groups across three episodes/two adventures; filters, history, authored badges/relic stages and Core adjustments. |
| 7D Teach/Present roster | COMPLETE | Eight refreshed native groups, including real committed-but-unacknowledged reward retry across view remounts, responsive reserved roster space and existing game/video controls. |
| 7E Multi-adventure progress | COMPLETE | Three integrated service tests and four native groups; stable profiles with isolated reward/relic/completion state and Present projections across restart. |
| 7F Full integration | COMPLETE | Exact requested 20-step native workflow, four legacy groups and six media-return groups passed on the final production build. |

## Implemented features

- Permanent profiles retain stable IDs and creation dates. Teachers can edit display names, optional nicknames and preset avatars, and archive or restore profiles without deleting historical progress.
- Explicit legacy migration previews source IDs and asks for a chosen destination or separate new profile. Equal names never merge. Local roster backups can be previewed, but are never automatically imported. Mapping does not silently transfer legacy reward balances.
- Classes have stable IDs, editable names and enrollment. A student may belong to several classes. Archiving a class retains its membership; archived students remain in historical membership but are excluded from active teaching selection. The active class persists; guests remain temporary.
- Hero Board is a teacher-facing view of profile overview, adventure participation, recorded activity, completed episodes, inventory, earned badge achievements and authored relic stages. Filters combine student, class, adventure and episode. Session scores are labeled separately. Inventory totals remain explicitly adventure-wide when filtering history by episode.
- Teach has a persistent collapsible roster, class switching, participant selection, temporary guests, participation/progress summaries, student details, group adjustments and the existing individual approval/adjustment controls. Routine actions remain in the teaching window.
- Present has a configurable top/bottom roster strip. It receives only a reconstructed projection of nicknames or anonymous labels, allowlisted avatars and optional numeric indicators. It reserves space outside the story surface. Visibility defaults off. Private profile names, timestamps, reasons, histories and permanent student IDs are absent from this roster projection.
- Group adjustments capture recipients, definitions, amounts and command IDs before sending. Partial results are explicit. Retrying after a lost acknowledgement reuses the same commands, even after switching teaching views, and does not grant again.
- Finish lesson stops the active module/audio, clears the passive scene/roster and returns to Beginning while keeping authored work available.

## Changed files

Principal Phase 7 implementation files:

- `src/shared/students/`: profile/class contracts, Hero Board selectors, safe roster projection and group adjustment capture/retry helpers.
- `src/shared/types.ts`, `src/shared/relics.ts`, `src/shared/studentImport.ts`: compatible profile fields and strict legacy preview.
- `src/main/studentSettingsRepository.ts`, `src/main/studentService.ts`, `src/main/main.ts`: serialized private settings writes, recovery backup, strict validation and authenticated student/class IPC.
- `src/main/preload.ts`, `src/renderer/vite-env.d.ts`: typed Control APIs. Present receives no private student-management API.
- `src/renderer/students/`: profile/class workspace, Hero Board, Teach roster, group controls, passive Present roster and styles.
- `src/renderer/Beginning.tsx`, `src/renderer/lesson/LessonApp.tsx`: Users entry point and teaching integration.
- `src/renderer/App.tsx`: legacy profile edits now use scoped durable operations; stale bulk writes and silent fallback imports were removed.
- `src/shared/presentationSnapshot.ts`, `src/renderer/present.tsx`, `src/renderer/present.css`: whitelisted roster transport and reserved layout.
- New focused tests: `studentProfileSafety`, `studentImport`, `legacyRosterSafety`, `studentClasses`, `heroBoard`, `groupRewards`, `rosterPresentation`, `studentAdventureIntegration`.
- `scripts/phase7*-smoke.cjs`, phase reports and evidence directories contain the disposable native verification workflows and results.

Phase 6 changes are documented separately in `docs/phase6-final-report.md` and its linked sub-phase reports.

## Automated verification

The final application suite passed **576 tests**, with zero failures, cancellations or skips. The game suite passed **50 tests**, also with zero failures or skips. Logs: `.tmp-phase7-final-tests.log`, `.tmp-phase7-final-games.log`.

Final fresh renderer typechecking and renderer/main production builds passed. Logs: `.tmp-phase7-final-types.log`, `.tmp-phase7-final-renderer.log`, `.tmp-phase7-final-main.log`. The final native workflow and compatibility gates ran against that frozen build. Vite retained its non-blocking bundle-size warning.

The tests cover corrupt settings without overwriting them, unknown settings/audio preservation, serialization of concurrent writes, invalid enrollment, source-ID mapping conflicts, archive/history preservation, class and episode filtering, safe projection reconstruction, captured group retries, and durable reward/event replay.

## Native and compatibility evidence

- `docs/phase7a-evidence/native/`: seven profile/migration/restart groups and inspected 1184px/620px screenshots.
- `docs/phase7b-evidence/native/`: five class/selection/restart groups.
- `docs/phase7c-evidence/native/`: five Hero Board groups, actual Snake results, three episodes, two adventures and inspected desktop/narrow views.
- `docs/phase7d-evidence/native/`: eight final roster groups. Fault injection occurred only after a real Core reward commit. Retrying after navigation retained the exact command/student IDs and left the complete durable snapshot unchanged. Present/story bounds were checked at top and bottom at 944×560 and 620×360; actual Control game input and video playback passed.
- `docs/phase7e-evidence/native/`: four adventure-scope groups, including exact profile/class/progress persistence after a full Electron restart. An initial harness omission of Open Present was corrected; no application change was needed.
- `docs/phase7f-evidence/native/results.json`: all 20 requested steps passed in the requested sequence with zero renderer errors, plus separate archive/history, approval policy and stale-media checks. It includes actual game events and approval replay after restart with no further durable effects. Relic progress was updated before Mastery. Historical test-harness disclosure/ordering corrections are retained in `prior-selector-failure.json`; no product change was needed.
- `docs/phase7f-evidence/legacy/results.json`: four native legacy Media Pool, Card V2, dialogue audio and reward presentation groups passed.
- `docs/phase7f-evidence/media-return/results.json`: six actual video-return paths passed with no errors/failures; playback returned paused at its retained position.
- `docs/phase7f-evidence/`: fresh read-only audit and comparison with Phase 6G. All six production JSON hashes match, all 1,116 registered files exist, and there were no production writes. This checks registered-file existence, not every media file's content hash.

All mutation tests used disposable application profiles and synthetic lessons/students. Existing scene/media/audio/camera/translation controls were retained. Final native compatibility covered scoped legacy images, Card V2, dialogue/reward presentation, game keyboard control and actual video playback/return. Physical camera/microphone classroom operation was not newly certified.

## Known limits

- Avatars are safe presets, not uploaded portraits. Present displays up to eight selected participants with an additional-participant count; missing/unsafe nicknames use anonymous labels.
- Achievements are explicitly awarded badge rewards from adventure definitions. No automatic educational assessment or inferred achievement rules were added.
- Group adjustments are separate Core transactions, not an all-or-nothing batch. In-session navigation preserves pending retry commands. Closing the whole application loses the pending UI batch handle; durable receipts and history remain. Inspect history before creating a new adjustment after an interrupted batch.
- Legacy identity mapping does not automatically migrate lesson-local relic balances. Review the legacy source, choose the correct permanent profile and use a reasoned teacher adjustment in the intended adventure.
- Corrupt private files fail closed and are not automatically replaced from backup. Recovery backups remain private. The existing bounded local file stores are not a multi-device synchronization service.
- Roster projection privacy does not change the Phase 6 hosted-module technical run-context contract. Hosted games still receive the captured participant identifiers needed for authenticated event correlation, but no profile/history API; these identifiers are not rendered by the student-facing roster.
- Verification uses synthetic student data and isolated lessons. Production lessons were audited read-only; there was no destructive migration or installer/distribution certification.

## Unfinished work

None within the implemented Phase 7 scope. The limitations above remain explicit. User review and manual classroom testing are the next step; no commit or publication was performed.

## Teacher walkthrough

1. From Beginning, open **Users**. Enter a display name, optional nickname and avatar, then **Save profile**. Use **New student** for each additional profile. Equal names remain distinct.
2. In **Classes**, choose **New class**, enter its name and **Save class**. Check the students to enroll and **Save class** again. Choose **Use class for teaching**, then close Students. Students can also be enrolled in another class.
3. Open **Adventure**, then **Open project** and choose a complete episode. Enter **Teach**. In the **Students** panel, select **Active class** and **Load class participants**. Adjust individual selections or add temporary guests before launching an activity.
4. Open **Present**. Expand **Present roster settings**, enable **Show roster in Present**, and choose top or bottom placement. Optionally show session scores, reward totals or relic progress. Set nicknames in profiles when you want names shown to students.
5. Teach the story, run **Discovery/Activation**, then launch the episode's **Challenge** activity. Results belong to the participants captured at launch. In **Rewards and progress**, request a reward for the recorded completion and approve each pending grant. Scores alone do not grant permanent rewards.
6. For a manual correction, select **Progress student**, expand **Teacher adjustments**, choose the authored reward/relic and enter a reason. **Group rewards** applies a captured adjustment to selected permanent students; use **Retry remaining** after a partial failure instead of starting a second action.
7. Open **Mastery** to inspect the approved inventory. **Hero Board** shows the broader record; filter by student, class, adventure or episode. **Details** in the Teach roster opens the selected student's view without leaving the lesson.
8. When appropriate, mark the episode complete for selected participants, then **Finish lesson**. Reopen the application and class to continue. Archiving a profile removes it from active selection while preserving its Hero Board history; enable **Include archived** to restore it.
9. **Export portable episode** shares authored content and media, without the private roster, classes, decisions or progression repository. Use **Import portable episode** to create a verified editable copy elsewhere.
