# Phase 3 local speech translation implementation plan

Goal: English microphone utterances become privately reviewed local translations and explicitly published Presenter captions.

Architecture: retain the existing AudioController microphone owner and Presenter DOM. A supervised Node worker manages verified Mozilla model downloads and Bergamot WASM; a supervised whisper.cpp CPU helper handles bounded mono 16 kHz utterances. Only sanitized published caption tokens cross into Presenter. No lesson schema changes.

User-authorized inline implementation; no commits, merges, or pushes. Recoverable pre-edit binary patches and all nonignored untracked files are in D:/AI/GitHub/Story-Studio-phase3-checkpoint-20261012.

- [x] 3A: pin Mozilla en-ja/en-it/en-ro manifests and hashes, implement disk cache and single-language Bergamot provider; execute the six requested examples for all languages, including offline reuse.
- [x] 3B: pin whisper.cpp Windows CPU binaries and Base English; reuse microphone stream through a bounded recorder and offline resampler; supervise cancellation, timeouts, silence checks, device replacement and process cleanup.
- [x] 3C: compact optional Teach controls in both lesson architectures, private drafts, revision-guarded publication, isolated caption IPC and React layer with adjustable size/placement.
- [x] 3D: lazy local Kuromoji reading analyzer; plain token output, native ruby, editable readings before publication.
- [x] 3E: regression tests for protocol/silence/cancellation, actual local translation and recorded audio smoke runs, existing build/tests/game checks and combined Electron evidence where equipment permits. Report physical microphone and language evaluation gaps explicitly.

Results and outstanding manual acceptance: docs/phase3-translation.md. Physical hardware, live meeting audio and native-speaker quality acceptance remain unverified; synthetic-media and packaged-app tests passed.

Verification: npm test; npm run build:main; npm run build:renderer; npx tsc --noEmit; npm run check:games; new translation smoke scripts. Retain measured raw outputs and model provenance in docs/phase3-evidence. Preserve baseline failures separately.
