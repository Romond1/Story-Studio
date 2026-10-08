# Phase 2 engineering progress

This is a running checkpoint record, not a Phase 2 completion claim.

## Verified baseline

169 tests passed before Phase 2. Five pre-existing renderer typing errors were
confirmed, then corrected with type-only changes (DOM event, divider item union,
Web Audio buffer type and route-disposal receiver). Full renderer typecheck is
now clean at the static checkpoint. All five production project hashes matched
the Phase 1 baseline; originals are not used as automated fixtures.

## Static checkpoint

Control teaching mode and Present reuse passive image-adjustment and student-text
renderers. The Main boundary whitelists visible overlay data and local graphics;
teacher editing metadata is not projected. Present uses a uniform contain
transform over the Control stage's logical frame. This first checkpoint still
allows Control resize to reflow the frame; full canonical geometry is part of the
drawing/viewport follow-up, now completed for image targets as described below.

Present readiness is tied to the mounted scene's base image and bubble graphics,
not an old URL cache. Reload/close/reopen continues using full ordered snapshots.
Control shows readiness, pending, closed and error states, plus a reminder to
reselect a recreated window in conferencing software. Monitor removal moves an
offscreen Present into a reachable work area.

Booster entry captures an explicit story/section checkpoint. Return through Story,
Movement or Relics restores and consumes it; hidden story selection changes do
not move the checkpoint. Project reset clears it.

Checks: static projection/contain/readiness tests, lifecycle IPC tests, booster
checkpoint tests; renderer and Main builds; full typecheck; isolated actual
Electron Control/Present story/booster navigation and close/reopen smoke checks.

## Audio design gate

Present cannot attach a DOM video element directly to Control's AudioContext.
The preferred incremental candidate is one Present video decoder/source adapter
feeding Control's existing mixer over a local WebRTC audio stream. Present's
source adapter has no local audible destination and no AudioController/microphone.
This must pass an isolated origin/capture and latency probe before production
integration. The alternative is a larger facade/lease migration of the entire
mixer. Duplicate live playback is not an acceptable fallback.

The isolated probe has now passed; see `phase2-media-feasibility.md`. Production
media integration remains a separate feature-family gate.

## Image drawing/viewport checkpoint

Present mode captures the current logical stage once and uniformly contains it in
both Control and Present. The small **Use normal teaching** action releases that
frame. A target epoch, separate from overlay/session revisions, fences delayed
commands without resetting the base view when movement is triggered.

Committed markers retain existing authored content ownership and persistence.
Live marker/highlighter updates are coalesced at approximately 30 Hz, with a
reliable finish update. Both renderers use the same bounded transient reduction
and painter; highlighter timestamps use the shared wall clock. Zoom, pan and reset
project logical-frame coordinates. Present reload recovers the current committed
and transient scene rather than creating a second drawing store.

182 tests passed at this checkpoint; full TypeScript and both production builds
passed. Actual isolated Electron checks passed live marker, committed recovery,
highlighter fade, middle-button pan, wheel zoom, reset, clear, target return,
Control/Present resize, release to legacy sizing, and Ready/Closed lifecycle.
Control was resized from 1400×1000 to 1150×850 while Present used 700×950. Screenshot
comparisons confirmed normalized marker placement. Break drawing/viewport is part
of the subsequent break family, not included in this image checkpoint.

## Manual checkpoint

Open a lesson, launch Present, navigate static images with text/bubbles, resize
Present and close/reopen. Compare image adjustments and text placement. Continue
using the normal teaching window for systems not yet migrated. This checkpoint
does not establish full lesson parity or real conferencing/audio acceptance.

## Breaks, boards and cards checkpoint

Control's runtime now holds card layout/reveal state per occurrence and reference.
Shuffle randomness resolves once; teaching moves do not change authored instances.
Editor shuffle retains its authored behavior. Commands capture an activation token,
so a delayed drag cannot change a different target or a later visit to the same one.
Authored changes reconcile into runtime instances without resetting unchanged cards.

Present receives a whitelisted activity projection, with only referenced card/image
content. Both teaching surfaces use the same positioned card layout; Control adds
logical pointer movement and Present has no drag/resize/provider mutation. This
removed measured fractional-scale drift from the previous drag library layout.
Language boards retain image/break backdrops and half-stage composition.

Break drawing and viewport use the existing 1920×1080 content frame. Control now
offers Draw/Reset on breaks. Board timers retain an occurrence start time; breaks
retain their shared pause/run anchor. Present reload does not restart either.
Activity readiness includes card images, thumbnails and CSS backgrounds. Projection
URLs carry project/load identity to avoid reuse of prior lesson imagery.

The checkpoint passed 189 tests, full TypeScript, renderer and Main builds. Actual
Electron checks covered board reveal/shuffle/drag/reload, break live/committed
drawing/zoom/timer recovery, duplicate references/revisit, and language image/break
backdrops. Normalized card geometry matched within 0.0000002 across window sizes.

Manual testing is now appropriate for breaks and boards: reveal, drag, shuffle,
timer, draw/zoom on a break, navigate away and return, then reload/reopen Present.
Video, transitions and rewards are not included in this checkpoint.

## Transitions checkpoint

Core now creates one immutable transition event for an actual target change,
including frozen outgoing image/text, viewport, adjustments, direction, duration
and start time. Panel changes retaining the same target do not restart it. An old
completion cannot clear a newer event. Present and Control share visual layers;
cards and drawing remain above the transitioning media. Outgoing media is passive.

Late rendering applies a negative CSS delay or settles immediately. Fade-black's
existing incoming delay is included in its effective duration. Completion keeps
the incoming DOM media node mounted. First targets and unsupported media cut
safely; video transitions are part of the following media family.

194 tests, full TypeScript and both builds passed. Actual Electron verification
covered a five-second crossfade, rapid supersession, active reload with retained
identity/start time, expired reload without replay, and stable incoming DOM nodes
through completion. The root independently re-ran the final C card/break/reference
checks after its final gesture guards and layer wrappers; all passed.

## Media checkpoint

Present owns the sole playing lesson video. Control renders a paused, muted preview
and sends intent commands through Core. Identity includes the content occurrence;
monotonic command/bridge epochs reject retired events, including A→B→A visits.
Gain changes preserve playback; seek/replay/trim rebuild the local bridge. Actual
status anchors trim changes and recovery. Image-to-video navigation retains normal
autoplay, while handoff, reload, crash, reopen and fallback restore safely paused.

The existing Control AudioController remains the only mixer and microphone owner.
Present uses a source-only Web Audio graph with a silent sink and local WebRTC
transport. One received stream enters the existing media bus. Source/receiver
readiness gates playback; teardown silences/disconnects the receiver and retires
its tracks. Mixer restart reconnects only active registrations, so detached legacy
previews cannot revive through a volume update. Existing selected routes remain.

211 tests, full TypeScript and both builds passed. Production-bundle Electron QA
verified nonzero signal at the mixer, one live receiver track, pause gate zero,
volume/mute without rewinding, seek/replay, authored trim, crash/reload recovery,
normal autoplay after fallback, position-preserving handoff, and decorative image
failure/recovery without falsely declaring the video unplayable. The transition
fixture was independently rerun against the media build and passed.

Outgoing video currently cuts safely; it is not retained as another live player.
The isolated audio probe measured approximately 69–103 ms transport delay. Real
microphone/monitor/broadcast routing, lip sync and conferencing capture require
manual acceptance using the checklist. No production episodes or physical audio
devices were used by automated QA. Manual media testing is appropriate now.

## Movement checkpoint

Movement now freezes one event ID, visual configuration, logical frame and absolute
start/expiry in Core. Both windows render that event with elapsed CSS animation
time; a retired expiry cannot clear its replacement. Control claims the event ID
before playing its jingle through the existing mixer. Snapshot/reload has no audio
side effect. Captured project/load scope rejects stale callbacks, and custom
jingle URLs are scoped so another lesson cannot reuse the previous decoded clip.

The six builtin GIFs and explicitly selected builtin jingle are Vite-imported into packaged output.
An unset jingle retains the original generated chime.
Lesson-owned paths stay separate, including legacy backslashes and encoded
filename characters. Transparent canonical overlay frames preserve the live base
media node and provide matching composition across window sizes.

222 tests, full TypeScript and both builds passed. The Electron fixture verified
builtin loading, two-size geometry, active reload catch-up, replacement, expiry,
late reload, stable base image and exactly two mixer starts for two triggers.
Screenshots were independently inspected. Native GIF decoders restart their frame
phase after reload; CSS timing and the event deadline still catch up correctly.
Manual movement testing is appropriate now, including the configured jingle.

## Rewards checkpoint

Reward commands now run through a session/load-scoped acceptance ledger and the
latest synchronous document transaction. Distinct rapid commands accumulate;
duplicate IDs remain rejected after visual expiry or undo. Relic progress and
stage/completion classification come from that same transaction. Present never
receives the ledger, project mutation API or reward provider.

Core separately retains frozen Spark effects, badge celebration anchors, Relic
visibility/progress/reward anchors and deterministic particle seeds. Counter and
crown lifetimes are preserved independently. Shared passive visuals retain class
totals, four authored badge sprite variants, score reveal, backgrounds, Relic
progress/art and animation configuration. Control retains editing, dragging and
Close actions; Present has none. Reward asset readiness is combined with base
readiness so a ready base cannot hide a failed reward image.

232 tests, full TypeScript and both builds passed. Actual Electron checks covered
rapid awards and duplicate IDs through the mounted Control adapter, reload timing,
final expiry and retained score reveal, four authored sprite positions at two
window sizes (within 0.15 logical pixels), and Relic stage/reload/completion. A
timing regression verifies that returning from a progress effect does not restart
the widget entrance. Visible-window screenshots confirmed settled badge opacity
and composition; hidden fixture compositor suspension was excluded from that check.

Read-only checks accepted existing reward configurations from Episodes 1–5; all
five project files still matched baseline SHA-256 hashes. Manual reward testing is
appropriate now. No production episode was opened in automated UI tests or saved.

## Booster, recovery and final integration checkpoint

Existing prompt cards now share one passive visual and card overlay path. Booster
Prev/Next operates across prompt, image/video, board, break and missing-reference
branches. Entry retains an explicit story checkpoint; return consumes that
checkpoint instead of following incidental teacher selection. Future mini-games
remain an explicit unsupported target.

Display-only media URLs include project/load identity across images, card faces,
custom bubbles, break backgrounds and badge previews. Same-filename reopen checks
show fresh pixels, while captured saves preserve authored path strings. Keyboard
handlers reject typing, composition and repeats, and claim handled commands to
prevent movement/reward/navigation collisions. The drawing chord stays reserved.

Present lifecycle status is generation/sequence fenced, includes recoverable
render errors and recreated-window sharing guidance, and handles display changes.
The existing default movement chime is preserved; an explicitly selected bundled
jingle resolves to packaged output. Long badge lists now scroll from Control via
the same celebration state; Present restores the offset on reload without input
handlers, another award or an animation restart.

Final H/I gate: 236/236 tests, full TypeScript check and renderer/main builds passed.
Actual Electron checks passed prompt geometry, card flip/reload, all booster
navigation branches, story return, reopened asset pixels, saved-path preservation,
shortcut conflicts/repeats/typing, passive Present input and movement execution.
Independent read-only integration review found no additional actionable issues.
Root inspected both prompt screenshots and independently passed actual wheel
scroll/reload and the final production video/audio bridge regression, including
forced renderer crash, track retirement, paused reopening and legacy fallback.
The final drawing regression also passed live/committed strokes, resized geometry,
reload, zoom/pan/reset, highlighter fade, navigation return, clear and fallback.

All five production project files were rehashed after integration and remain
unchanged against the saved Phase 1 baselines. Real-episode walkthroughs, physical
audio routes, lip sync and conferencing remain manual acceptance tasks. See
[the final report](phase2-report.md) and [manual checklist](phase2-manual-checklist.md).

## Manual video regression repair

The user found choppy preview, delayed/distorted audio and uneven bars. Control now
receives a full-resolution passive video stream instead of repeated file seeks;
the local audio profile preserves stereo, and the layout no longer expands with
transport controls. The user confirmed the bars are gone and both windows look
similar. 241 tests, typecheck and both builds pass. Real test-media measurements
show 1280×720 at 24 fps and about 80 ms audio transfer into the mixer, excluding
physical output. See [repair details](video-playback-repair.md).
