# Story Studio Phase 2 implementation report

Phase 2 implementation is ready for manual teaching acceptance. Automated checks
use synthetic lessons; the real Episodes 1–5 and physical conferencing/audio
setup still need the ordered checks in [the manual checklist](phase2-manual-checklist.md).
Phase 3 has not been started.

**Manual-test follow-up:** video preview, audio quality and layout were repaired
after this initial gate. See [the video repair report](video-playback-repair.md)
for the current 241-test gate and measured full-resolution stream preview.

## Architecture now

Core authority lives in the Control renderer's composed session/runtime models:
lesson target and occurrence, drawing and viewport, card layouts and timer anchors,
transition state, media intent, movement events and reward acceptance/visual state.
Control sends commands to those models. Present receives a whitelisted rendering
snapshot, not a project document or a second lesson store.

Control owns authoring, teacher interaction, the existing project transaction and
undo path, the sole AudioController, microphone and music/dialogue/SFX routes.
Present owns passive scene rendering and the designated live video decoder. Its
narrow preload permits snapshots, readiness and scoped media signaling; it cannot
mutate lessons, award rewards or capture the microphone.

Main validates and relays snapshots with generation/sequence fencing. Target
revisions and occurrence identities reject stale gestures and callbacks. Timed
visuals retain event IDs, frozen configuration and absolute start/expiry anchors;
reload renders the remaining state without repeating effects. Media adds renderer
generation and intent/bridge epochs to reject retired status and signaling.
Close/crash/reload retires media execution and recovers paused. Control keeps the
lesson, reports readiness/error/closed state, and warns when a recreated window
must be selected again in conferencing. Present rendering failures have a neutral
student fallback and a teacher-side error.

## Feature parity

“Complete” below means implemented and checked with synthetic automated fixtures,
not yet accepted against every real lesson.

| Feature | Status | Scope or limit |
|---|---|---|
| Slides | Complete | Shared images, text/bubbles, adjustments and canonical layout. Missing pre-existing builtin bubble art gets a readable fallback and teacher error. |
| Breaks | Complete | Existing layouts, timer anchors, drawing and half-stage backdrops. |
| Drawing | Complete | Live and committed strokes, clear/reset and occurrence fencing. |
| Viewport | Complete | Shared logical zoom/pan/reset with uniform containment across window sizes. |
| Boards/cards | Complete | Reveal, drag, shuffle once, reference-scoped layouts and reload continuity. |
| Transitions | Partial | Shared timed static-scene transitions, supersession and reload settlement; outgoing video cuts safely instead of retaining another live player. |
| Video | Complete | One live decoder, transport/trim/volume, one mixer input and paused recovery. Physical lip sync remains a manual gate. |
| Movement | Complete | Shared event, canonical geometry and once-only jingle. Native GIF frame phase restarts on reload; CSS age and expiry remain correct. |
| Sparks | Complete | Idempotent awards, accumulated totals, deterministic passive effects and independent effect lifetimes. |
| Badges | Complete | Authored sprites, class/student totals, reveal/celebration timing and Control-driven shared list scroll. |
| Relics | Complete | Authoritative progress/stage/completion with shared visual anchors; teacher actions remain in Control. |
| Boosters | Complete | Existing prompt/media/board/break/badge content, common navigation and exact story checkpoint return. |
| Future mini-games | Deliberately unsupported | Clear fallback; no new game engine or Phase 3 activity was added. |

## Audio and video execution

The existing Control AudioController remains the only mixer. Present's one live
video feeds a source-only Web Audio context with a non-audible sink, then a local
WebRTC stream into Control's existing media bus. There is no external signaling
service or STUN dependency. Control's preview receives a muted video-only stream
from Present and stays detached from the mixer. The muted receiver audio element activates Chromium decoding;
audible output comes only from the mixer graph.

Receiver readiness gates playback. Epoch/generation checks, attachment guards and
track retirement prevent old bridges from becoming audible after seek, navigation,
reload or crash. Gain changes do not recreate the bridge or rewind the decoder.
Movement execution is claimed by event ID before playing through Control; reward
results have a session/load-scoped acceptance ledger. Rendering a snapshot never
replays an award or sound. Existing microphone and selected output routing remain
in place through these operations.

The isolated bridge probe measured approximately 69–103 ms transport delay and
one receiving audio track. This is not a physical lip-sync measurement. VB-CABLE
availability, monitor/broadcast device behavior and conferencing capture must be
checked on the teaching machine; no virtual-driver replacement was attempted.
See [bridge evidence](phase2-media-feasibility.md).

## Validation

Final gate: **236/236 tests passed**, full `npx tsc --noEmit` passed, and both
`npm run build:renderer` and `npm run build:main` passed. There are no known failing
automated checks at this gate. The baseline suite contained 169 tests; the final
suite has 67 additional tests. Family results are recorded in
[the checkpoint log](phase2-progress.md).
Added coverage includes canonical scene geometry/drawing, occurrence-scoped cards,
transition settlement, media epoch and bridge lifecycle, AudioController external
inputs, movement timing, reward idempotency/visual timing/scroll, keyboard command
ownership, scoped visual URLs, booster checkpoint behavior and Main recovery.
The full existing shared suite is run, including project persistence/history,
section mutation, audio compatibility/routing/lifecycle, trims, rewards and Relics.

Actual Electron fixtures exercise both windows, reload/crash/reopen, different
sizes, image/drawing/card interaction, transitions, video stream samples and track
retirement, movement execution counts, reward totals/timing and booster navigation.
Screenshots and normalized geometry supplement state assertions. The scene error
boundary and display/recovery paths also have focused checks.

No installer/release package was produced. Known acceptance limits are the partial
outgoing-video transition, native GIF frame-phase restart, absent legacy builtin
bubble artwork and the unperformed real-device/real-lesson checks above.

## Compatibility

No project schema migration or content rebuild is required. Runtime IDs, snapshots,
media bridge state and render-only URL cache scopes are not saved into lesson
documents. Authored relative media references remain unchanged. Existing episode
reward settings were read through the current compatibility cleaners.

All five production `project.json` files matched their saved Phase 1 SHA-256
baselines in read-only checks. Automated UI fixtures did not open or save these
production originals. Hash integrity does not replace a real lesson walkthrough.
The explicit **Use normal teaching** fallback remains available; leaving Present
revokes its media executor and requires deliberate resumption of the current video.

## Manual acceptance and later work

Follow the [10-step manual checklist](phase2-manual-checklist.md): share Present;
check slides/drawing/viewport; breaks/cards; video and actual audio routes; movement
and rewards; boosters; reload/crash/reopen; fallback/second monitor; shortcuts; then
representative checks across Episodes 1–5.

For Phase 3, first address measured regressions from that acceptance pass. Consider
video transition snapshots and any measured lip-sync adjustment only with clear
acceptance criteria. Games, Final Boss, Ready Check, Hero Board, installer work and
teacher UI redesign remain separate future decisions and were not implemented.
