# Linked participants, game rewards and Presenter names

Follow-up to mini-game presentation tools, October25 2026. The user explicitly requested linking selection rather than maintaining separate activity/display lists, and displaying student names rather than anonymous labels.

Participant checkbox changes now synchronize Presenter selection, enable the roster strip, and show reward totals. Presenter checkboxes update the same participant group. All selected students appear together; the game corner still highlights the current reward recipient. Rewards & magic offers only selected participants and automatically switches to an eligible recipient when the previous recipient is deselected. No balance or accepted award is reset by selection changes. Practice keeps its own unrestricted sandbox roster.

Display names use a nickname when set, otherwise the student's name (bounded plain text); unsafe/empty values retain an anonymous fallback. Roster entries, reward bursts, celebrations and the game corner use this naming consistently. This supersedes the previous anonymous-name fallback and independent display-selection behavior.

Changed: LessonApp.tsx, LessonTeachControls.tsx, WheelTeachControls.tsx, WheelFeedbackControls.tsx, shared students/rosterPresentation.ts, lesson/rewards.ts, rosterPresentation.test.ts, and new scripts/linked-game-students-smoke.cjs.

Validation: renderer TypeScript and renderer/main builds passed; focused roster/reward tests passed; native Electron check passed selecting Alice+Ben (without nicknames), displaying both, restricting recipients to Alice+Ben, choosing/awarding Ben and synchronizing his name/total, then deselecting Ben and updating recipient choices/display without losing balances. Full automated suite:722 passing. No commits or pushes.
