# Phase 6D implementation plan

Implementation starts only after the native 6C gate passes. User authorization covers autonomous execution; no commits, pushes or branch changes.

## Authority and compatibility

Retain the single Control episode/history and the single interactive Present iframe. Add a required `bundled-modules-v1` capability, authored activity instances and ordered Challenge/Mastery occurrences to episodes. Existing scene-v1 and legacy game launches retain their compatibility path. Activity configuration contains no runtime checkpoint, participant names, accepted-event ledger or inventory.

Core validates authored configuration updates with expected document revision and acknowledges accepted changes. Saving must either wait for pending hosted configuration acknowledgment or report that it is still pending. Hosted setup receives the exact saved configuration; no device-save or sample-content fallback is allowed. Standalone import/export remains available separately.

## Shared boundary

Create static bundled module definitions for Activation cards, Language Snake and Final Boss, with strict versioned schemas, asset reference collection, input methods, lifecycle and result/reward capabilities. Define serializable messages carrying protocol/module versions, host generation, request ID, session/run/instance/occurrence identities and sequence. Use a pure lifecycle coordinator and transient accepted-event ledger with payload equality checks. Capture participants with the run; later selection cannot reassign a result.

Extend existing authenticated main-frame/active-instance checks in `presentWindow.ts`. Present forwards only validated iframe messages from the expected source. Keep activity configuration on a separate scoped channel rather than passive scene snapshots. The bundled frame remains trusted application code; do not represent same-origin sandboxing as a security boundary. Any stronger origin isolation must preserve packaged-file loading and be verified natively.

## Game adapters

Snake authored fields include questions, setup, input bindings, crown/enemy configuration, background settings and media references. The `game` subtree remains temporary. Inspect existing hosted mode before changing restoration: current App already skips automatic localStorage restoration when `instanceId` is present. Explicit device-load controls must also be separated from hosted config authority.

Final Boss authored fields are its encounter and card library. Preserve every module-specific setting and all five mini-game plugins. Its forgiving standalone importer replaces invalid/empty libraries with sample cards; implement a strict hosted path that reports errors instead. Map typed media-bearing fields to registry IDs, retaining explicit built-in references where supported. Never persist resolved grant URLs.

Pause must freeze simulation deadlines, animation clocks and audio while keeping state. Inventory all timer/RAF/Date.now/GSAP/media sites. A per-frame pausable scheduler may provide the common clock, but must preserve remaining timeout deadlines, cancellation and resumed elapsed time. Test this before wiring lifecycle controls; hiding or unmounting is not pause. Reset receives a new run ID. Stop/dispose are idempotent and release listeners, clocks and audio on failure too.

Activation uses existing scene/Card V2 data by reference, without making a second editable card store. Results and reward requests go through declared Core ports only.

## UI and verification

Use existing editor styling. Teachers can select an activity, edit its configuration, pick registry media and save through normal lesson Save. Present setup edits must submit validated authored changes and display acknowledgment/error. Add pause/resume/reset/stop to existing Control host controls and preserve correct lesson-return position.

Tests precede implementation for parser privacy/unknown-field rejection, media enumeration, lifecycle transitions, timer/audio freeze, stale/forged messages, duplicate results and config acknowledgment. Run standalone game checks, full app tests/typechecks/builds. Native acceptance must edit a hosted config, save, close/reopen, verify exact restoration, play a result-producing activity, pause/resume/reset and return to the correct lesson position. Do not proceed to packaging until those gates pass.
