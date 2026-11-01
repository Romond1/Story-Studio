# Teacher feedback and lesson video repair

## Implemented
- Card faces animate independently of the activity panel in 1.7 seconds; removed the gold bars.
- Rewards & magic now contains appearance and celebration controls. Reward size and intensity reach 300%; magic has independent size, sparkle and duration controls.
- Teach shortcuts: F1 changes reward recipient, F2 changes magic, 5 plays magic, 1–4 award ordinary stars/crowns throughout lessons and mini-games, independently of game magic. Typing and dialog guards remain active.
- Teacher notifications appear below the header for important state changes and shortcuts, without appearing in Present.
- Richer original synthesized game sounds: prominent wheel ticks, longer start/reveal sounds and layered reward fanfares. Existing mixer controls remain effective.
- Larger reward emblems, halos, shockwaves, sparkles and personal reward popups. Corner anchors reserve room for larger emblems.

## Lesson video failure
Concurrent copies of an offer could both generate an answer on the same receiver, producing `Failed to set local answer sdp: Called in wrong state: stable`. The receiver now claims its one negotiation before awaiting SDP operations. New bridge epochs still create new receivers, preserving seek/replay/recovery behavior.

## Validation
- Regression reproduces the reported stable-state error before the fix and passes afterward.
- Native Electron scene-video-trim smoke passes Play/Pause, actual Present decoder seeking, scene navigation, saved trim endpoints, Edit controls and save/reload.
- Native teacher-feedback smoke passes shortcut notices, input guard, scaled magic, independent 1.7-second Card animation, explicit repeated awards with duplicate-command protection, cleanup and absence of teacher notices in Present.
- Full suite: 728 passing, 0 failures. Audio tests: 8 passing. Main and renderer builds and renderer type check verified.

No commit or push. No new game phase implemented.

## Selected reward recipients
The normal reward controls previously exposed every saved profile, even though game recipients used checked participants. The persistent teacher badge read that same unfiltered active ID. All reward menus, the badge and F1 now share a participant-filtered selection. Removing the active participant falls back to a remaining checked student; an empty selection disables awarding and shows No student selected. Existing balances are retained when participation changes. The separate session-only Add student form is hidden when participant selection is authoritative.

Regression checks cover an unchecked third student, both normal and game menus, repeated F1, menu selection, removing the active student and an empty selection. The native teacher-feedback smoke passes; focused reward tests pass (11 tests).

Selected-recipient follow-up validation: full suite 729 passing, renderer/main builds and renderer type check passing.

## Earlier game shortcut correction (superseded below)
Within mini-game rewards controls, keys 1–4 are reserved and cause no award, popup or magic cue. F2 cycles magic and 5 plays the chosen animation. Manual Award reward remains available. Ordinary lesson reward shortcuts remain unchanged. A native regression reproduced key 1 launching a star effect before the fix.

## Repeated teacher awards
An activity no longer locks awarding after its first outcome. The reward controls stay available so the teacher can change recipients and award each student, including further intentional awards to the same student. Each accepted command uses its turn and revision as a distinct ledger identity. Replaying the identical command is still ignored. Reset, next and skip animation clear all popups for that turn without undoing balances. Magic remains replayable without scoring.

Native verification passes: keys 1–4 do nothing in a game; 5 plays selected magic; Ben, Alice and Ben can each receive successive explicit awards during one activity; replaying magic does not add rewards. Focused runtime tests pass, including ten awards split across two students, unique popup IDs, stale-command rejection, and cleanup.

Latest validation: 730 tests passing, 0 failures; renderer/main builds, renderer type check and native teacher-feedback smoke pass.

## Restored independent normal reward shortcuts
Clarified behavior: 1–4 always award normal stars/crowns to the checked active recipient in Teach, including throughout a mini-game and after completing an activity. They call the ordinary reward command directly, without changing the activity outcome or creating a game magic cue. F1 remains owned by the game controls there, avoiding duplicate student cycling. F2 and 5 remain separate game-magic controls. The earlier removal of 1–4 is superseded by this correction.

Starburst particles now keep spreading with a gentle deceleration until they fade. Removed the late trajectory that collected stars into the top-right corner. The configured duration still controls the fade-out.

Final verification for independent rewards and starburst fade: 731 tests passing, renderer/main builds and renderer type check passing. Native smoke verifies 1 before starting a game, all four reward keys during the activity, and 1 after completion, without a magic cue.

## Visible teaching actions and game reset
Added a shared high-contrast blue button treatment for primary game progression (Start Game, Spin Wheel, Reveal, Complete Activity, Next Activity and Continue lesson), Draw on scene, Camera and Translation toggles. Related Hat/Card progression uses the same treatment. Skip, Finish and Reset retain secondary styling.

Removed Test game sound. The Game sounds checkbox remains. Reset Game now uses an immediate confirmation dialog rather than a confirmation placed below the long rewards panel. Confirmation starts a fresh round, clears game progress/effects and keeps student scores. Native regression reproduced the missing immediate confirmation before the fix and verifies the rendered Present returns to ready with zero consumed activities and unchanged reward total afterward.

Renderer build, renderer type check and native teacher-feedback smoke pass. Desktop button screenshots are saved under output/playwright/teacher-feedback/blue-*.png.
