# Phase 6 — Simple setup, Magic Hat and Mystery Cards

## Simpler starts
A named question is a valid spoken prompt. Empty/broken drafts remain authored but are excluded from a derived playable round; quotas/session length clamp to available ready activities. Authored content is never deleted. Show ready/draft counts and a short explanation, rather than a disabled Start Game and generic warning. Empty practice offers a clearly identified sample round. Quick-add question text creates playable content in one step. Advanced quota/segment settings remain in a disclosure; automatic round sizing is the default for new games. Existing explicit quotas are honored whenever ready content permits.

## One engine
Activate registry v2 for all three games using existing activity/segment references and runtime. Keep internal Wheel* names to avoid unnecessary migration. Both new games reuse phases, content projection, cues/effects, scoped commands, award ledger and media playback. Game-specific settings use the same JSON model: hat reveal style; mystery visible card count (3–5) and shuffle behavior. Retained drafts and classic mode remain non-destructive. A shared typed reveal cue is derived from the existing serializable selection timing.

## Hat
Original dimensional SVG hat on a magical stage, multiple deterministic reveal variations, shaking/float/squash then object emergence. Teacher Draw from Hat chooses once; local renderers sample shared reveal time. Question content stays private until existing Show transition. Complete/Skip/Next and replayed celebration reuse existing controls.

## Mystery Cards
Authoritative runtime deals eligible segment references into numbered stable slots before teacher selection. The public projection publishes only card slots/positions, not hidden mappings. Selecting a numbered card resolves its already-dealt segment, guarded by revision/scope; Present never picks outcomes. Shuffle replaces the deal and increments revision. The chosen card flips/enlarges; its used state remains until Next deals replacements. Quotas and no-repeat filtering are the existing engine's responsibility. Teach can click the stage or numbered controls. Static backs disclose no question/answer.

## Rendering contract
GameReveal {id,startedAt,durationMs,variant,selectedIndex?}; MysterySlot {id,index,selected,used}. New SVG stages accept shared reveal metadata plus phase; card stage also accepts slots, optional shuffle cue and optional onSelect(index). Passive Present gets no callbacks. Animations seek by epoch, respect reduced motion and cancel frames/listeners. No frame IPC, new rendering dependency, downloaded artwork or second economy.

## Validation
Test forgiving playable rounds, old and retained configs, hat draws, deterministic card mappings, shuffle/stale commands, quotas/no-repeat, private faces, replay and exactly-once scoring, reset/reconnect. Run full tests/types/builds and native Electron game cycles; inspect wide/narrow screenshots. No commit/push; stop after Phase 6.
