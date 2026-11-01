# Shared Adventure — first milestone

Historical first-milestone notes. The workspace is now named **Team Play**; see [current usage, integrations and compatibility](team-play.md). Earlier saved Shared Adventure folders remain supported without migration.

Choose **Shared Adventure** from Story Studio's Beginning screen. It creates an unsaved, dedicated group lesson. Use **Save group lesson** to choose its own empty folder. Reopen that folder with **Open group lesson**. The folder uses the existing `project.json` and `assets/` layout; existing episode folders are not changed.

## Teach a group lesson

1. Name the group and students, or add an existing saved profile. Participation controls whether a student can receive new awards. Profile references do not create accounts or modify permanent rewards.
2. Add locations such as Italy and Japan. Assign both siblings to Italy and the third student to Japan. These are preparation labels, not network connections.
3. Enter the team's target and objectives. Check objectives off as children complete them; points and objective completion are independent teacher decisions.
4. Import group media from your computer. Choose an image and enter a shared prompt. Imported files are copied into this lesson's assets folder. You can import files from another episode's assets folder without changing that episode.
5. Open Present and share that window in Zoom. **Reveal content** sends the image/prompt; **Hide content** replaces it with a listening instruction. Hidden image URLs and prompt text are absent from the student scene plan. The teacher preview shows the public view.
6. Check recipients' Award boxes and choose **Award selected**, or award every participating child with **Award team**. The points value is per student: 5 points to three students adds 15 to the team. **Undo points** reverses the last scoring action exactly, including after save/reopen.
7. **Show scoreboard / Hide scoreboard** toggles scores without changing the clue or mission state. No global Tab binding is added.
8. Save to retain preparation, scores, objective completion, visibility and scoring history. **Reset group session** clears live state while retaining the group, objectives, media and prompt. Reset before removing students who have a scoring history.

To return to an ordinary lesson, click **Story Studio**, choose Adventure or Discovery, and open that lesson's original folder. Switching remains subject to the normal unsaved-changes confirmation. Save before switching if you want to keep the current group state.

## Current scope

This is the Shared Adventure skeleton. It provides manual mission teaching, not the later activity engine. Secret Description and Ask Your Teammate rounds, role rotation, movement adaptation, reusable content packs, activity sequences, richer reward animations and private per-device delivery are subsequent milestones. Video/audio files can be imported and saved using the existing supported media pipeline; this workspace currently presents images and text. The scoreboard is designed for the initial small group; very large rosters need a paged public scoreboard before classroom use.

There is no browser classroom, remote admission or network A/V in this milestone. All children see the same Zoom-shared Present window. Analog secrets require the other children to turn away; a device/location label provides no privacy boundary by itself. Existing local camera/translation code and the old Broadcast Mirror branch are not remote classroom implementations.

## Verification

- Baseline before implementation: 731 tests passed.
- Updated full suite: 736 tests passed, including group identity, award deduplication, participation, undo/reset, saved-state validation and public snapshot projection. The audio effect test also verifies group-mode suspension and solo-mode restoration.
- Renderer TypeScript check and renderer/main builds passed. Vite continues to report large-bundle warnings.
- `node scripts/shared-adventure-smoke.cjs` exercises actual Electron Control/Present with disposable folders: three members across two locations, selected/team points, undo, media-byte copying, hidden/revealed content, save/reopen, picker cancellation, reset, Presenter reload and return to a solo lesson. It checks narrow overflow and captures screenshots under `output/playwright/shared-adventure/`.
- Code review identified stale recipient selection when deleting a checked student. Selection is now cleared on removal, with an Electron regression check.

Reproduce after `npm run build:renderer` and `npm run build:main`. The smoke script uses FFmpeg and Playwright from the bundled runtime, or `STORY_STUDIO_PLAYWRIGHT` pointing to a Playwright package.

## Later Broadcast acceptance

After the networking phase exists, test teacher plus one device, then Italy/Japan devices representing three children, then additional devices. Use separate networks rather than only localhost. Confirm admission expiry/rejection, microphone/camera permission handling, TURN-required connections, A/V quality, reconnect/refresh, revocation, private-clue isolation, synchronized reveal, score consistency and solo lesson delivery. Measure the actual Italy/Japan routes; local Electron success does not establish internet connectivity. Keep Zoom available throughout the rollout. No deployment or international A/V testing was performed here.

Architecture inspection and proposed later files/boundaries are recorded in `docs/superpowers/specs/2026-11-01-shared-adventure-design.md`; the first-slice task list is in `docs/superpowers/plans/2026-11-01-shared-adventure.md`.
