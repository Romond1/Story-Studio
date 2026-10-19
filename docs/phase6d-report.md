# Phase 6D — Bundled modules and hosted authoring

Status: COMPLETE — implementation, regression checks, and native acceptance passed.

## Implemented

- Capability-gated episode activities and ordered occurrences, with strict versioned schemas for Activation scenes, Snake authored setup/questions/media and Final Boss encounter/card-library configuration.
- Typed media enumeration and stable `asset:` / explicitly recognized `builtin:` references. Runtime grants cannot be saved as authored game settings.
- Authenticated Control/main/Present module transport with generation, run, instance, occurrence, request and sequence checks. Main fences result events by lifecycle. Interactive configuration travels separately from passive scene snapshots.
- Shared per-frame hosted timer/RAF/audio scheduler and lifecycle bridge. Hosted game modules initialize from Core configuration before mounting the native game. Reset uses a fresh iframe/run.
- Native game editing submits strict authored proposals and waits for Core acknowledgment. Normal lesson Save requests the latest hosted configuration and waits for acknowledgment; a failed flush prevents Save. Standalone game import/export paths remain separate.
- Control activity creation from explicit bundled templates, question editing and registry image selectors; existing native game editors preserve their detailed settings. Participants are captured when a run starts. Results remain temporary in 6D.
- Activation adapter references existing scene/Card V2 definitions and uses the common lifecycle/event contracts without copying the card store.

## Verification

- Full application regression: 506 checks passed; game checks: 49 passed. Renderer/main typechecks and production builds passed.
- Native hosted acceptance: eight groups passed with no renderer errors. Actual Activation authoring and pause/resume/next/reset/completion, native Snake editing and ordinary lesson Save, registry background rendering, frozen simulation clock/state while paused, real Snake completion for two captured participants, and fresh runtime reset all passed.
- Native Boss editing and ordinary lesson Save retained authored registry references. Four actual Memory Reveal rounds emitted score, completion and reward requests accepted by Control for both captured participants. Close/reopen restored authored edits without runtime grants or guest IDs in saved JSON; physical source media hashes remained unchanged.
- Existing game/media-return native gate: six checks passed, preserving video position across selection, launch, restart, edit launch, return to game selection and relaunch.
- After the final fatal-error recovery adjustment, eight focused tests passed. The native run preceded this final adjustment; that adjustment was verified by those focused tests, not by another native run.
- A subsequent test executes the actual hosted hook, injects a valid fatal adapter error during a pending Save, and verifies rejection plus run retirement and recovery. It passes, and is included in the later 524-test regression run.

Native evidence: `docs/phase6d-evidence/native/results.json`, `events.json`, and `boss-complete.png`. Compatibility evidence: `docs/phase6d-evidence/media-return/results.json` and screenshots. Native fixtures and profiles were disposable; production files were not modified.
## Changed areas and limits

`src/shared/modules/`, episode models/commands/validation and media dependency scanner; `src/main/moduleTransport.ts`, `presentWindow.ts`, both preloads; `src/renderer/episode/{EpisodeActivities,useEpisodeModuleHost,ActivationActivities}`, LessonApp, GameHost/PresentGame; shared hosted runtime under `games/shared/`; Snake and Boss hosted adapters and entrypoints. Test registrations now include hosted scheduler, bridge and adapter checks.

No permanent reward grant or progression repository is introduced here. The bundled iframe is trusted application code; same-origin sandboxing is not represented as isolation from malicious bundled code. Legacy standalone launches remain a compatibility path. Only recognized built-in media and registered episode assets are accepted by hosted configuration; hosted direct file uploads/device recovery are refused with instructions to use Core imports. Production lessons/student records have not been written. No implementation commits, push or merge.

Migration risk: episodes declaring `bundled-modules-v1` require this reader. Unsupported capabilities must reject before activation. Existing scene-v1 and legacy projects are not automatically converted.

