# Phase 7D Teach roster and group adjustments

Status: COMPLETE. All eight native groups passed on the refreshed build after the retry lifetime correction.

## Integration

Teach provides class and participant controls, temporary guests, profile details, and captured group adjustments through Core. Guests are excluded from permanent rewards. Each target has a stable command ID; retries preserve the original definition, folder, reward, amount, reason and student identity. A root-owned intent Map keyed by folder/adventure/episode survives scene/game branch remounts, with a shared in-flight lock. Only completed intents can be cleared. Process restart loses this in-memory retry handle; this UI does not claim crash recovery.

The optional passive Present roster contains safe nicknames or anonymous labels, allowlisted avatars, optional numeric summaries and a remaining count. It caps visible entries at eight and reserves a separate story band. Privacy claims concern this roster projection, not hosted-module technical context, which legitimately carries captured participant IDs.

## Verification

The integration passed 572 application tests and 50 game checks before the final retry lifetime correction. After that correction, eight focused checks (four group and four roster), renderer/main typechecks and production builds passed. The complete refreshed native gate passed eight groups with zero renderer errors:

1. Profile details open the selected Hero Board in place; collapsed roster state survives navigation.
2. Real Snake receives Control keyboard movement while the game iframe fits outside the roster band.
3. Actual Core lost-acknowledgement replay survives branch remount without duplicate grants.
4. Group adjustment grants exactly to two selected permanent students and excludes the guest.
5. Passive raw snapshot excludes private IDs, full profile names and reasons; Present cannot access private student/progression APIs.
6. Top/bottom placement preserves actual scene surface bounds at 944x560 and 620x360; anonymous labels and eight-entry cap work.
7. Scene navigation and actual video playback remain usable; hiding roster restores full scene space.
8. Finish lesson clears passive media/roster, returns to Beginning and preserves authored JSON.

For the retry proof, the harness wrapped the real main adjustment IPC handler, awaited the durable Core commit, then threw once. It navigated Challenge / Return to lesson / Teach, changed selected students and retried. The same original student and command IDs were reused, Core returned duplicate=true, and the entire durable snapshot including revision, history, receipts and balances remained unchanged by retry. Both permanent recipients received exactly one grant. Screenshots were visually inspected. All profiles and episodes were disposable synthetic fixtures.

Evidence: [native results](phase7d-evidence/native/results.json), [top narrow layout](phase7d-evidence/native/present-top-620.png), [bottom narrow layout](phase7d-evidence/native/present-bottom-620.png). Harness: `scripts/phase7d-roster-smoke.cjs`.

## Final native acceptance

The latest native evidence passed 8/8 groups with no recorded errors, including a lost acknowledgement after an actual Core commit, branch remount, and retry with unchanged Core state. Other groups covered selected-student group grants excluding guests, private-field-free passive projection, keyboard movement in real Snake, responsive top/bottom roster placement, scene/video usability, details navigation, and lesson finish cleanup. Evidence: docs/phase7d-evidence/native/results.json. The explicit process-restart limitation for an unfinished manual batch is accepted; no automatic replay is claimed, while Core event receipts remain durable.

