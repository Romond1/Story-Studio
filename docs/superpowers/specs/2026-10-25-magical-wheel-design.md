# Phase 5 — Enchanted observatory

## Art direction
Original vector/Canvas materials: indigo night sky, gilded astrolabe rim, enamel jewel segments, luminous cyan compass crystal, parchment scroll with gold cornerwork. Keep the wheel dominant at left and readable challenges at right. Ambient motion is slow and subtle; dramatic motion belongs to state changes. No strobing, fullscreen flashes or screen shake.

## Boundaries
Retain the Phase 4 SVG wheel and timing curve. Add a reusable typed effect cue (identity, kind, epoch, duration, intensity, sound, caption) to the existing wheel runtime and public whitelist. At most one cue is active; replay replaces it with a new visual identity, skip removes it. Canvas samples deterministic seeds and elapsed time locally with capped particles. Late Present seeks; expired cues never restart. Reduced motion uses a static emblem. Cleanup cancels frames/timers/listeners. No frame IPC and no gameplay from animation callbacks.

Implement Coin Shower (ballistic rotating coins with bounce), Star Explosion (radial stars converge to the reward indicator), and Magic Surprise (portal/chest/sprite variants), plus a crown emblem. Event reveal includes a short suspense interval before public text appears. Authored event category is an optional existing activity-config field, with safe default. Teacher notes remain private. Questions use the existing Card inside a scroll; intentional face controls remain authoritative.

## Rewards
Use existing LessonRewardState, active roster and awardLessonReward acceptance ledger. Add optional bounded batch amount to the existing primitive (default one for legacy callers). Wheel award decisions are guarded by scope/revision and a stable selected-turn identity; one decision per turn survives navigation/reconnection. Replay, encouragement and surprises never score. Awards use the existing variant counters; coins are purely decorative. Wheel-specific visuals replace the duplicate generic award popup, not the economy. Reset starts a new game, preserving previously awarded session totals and the acceptance ledger. No disk-persistent progress is introduced.

## Verification
Test pure effect parsing/sampling, idempotent awards, invalid commands, explicit skip/confirm, replay without score, reset and navigation. Run full tests, types, renderer/main builds; native Electron playthrough exercises all effects, answers, rapid actions, reload/reconnect, cancellation and Classic. Inspect representative screenshots at shared-screen and narrow sizes before judging visual quality. Preserve prior uncommitted work; no commit/push and stop after Phase 5.
