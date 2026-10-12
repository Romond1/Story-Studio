# Whisper GPU Implementation Plan

**Goal:** Verify optional CUDA Whisper acceleration on RTX 4070 Ti while retaining CPU fallback.

**Architecture:** Existing whisper.cpp CLI child process with a backend descriptor and verified native log evidence. Worker owns optional runtime installation and memoized preparation. Existing translation engine is unchanged.

**Tech Stack:** Electron, TypeScript, Node workers/child processes, whisper.cpp 1.8.2 CUDA 12.4.

- [x] Backend integration: add failing tests for CPU flags, CUDA verification, forced-GPU errors and Auto fallback. Extend `src/main/translation/whisper.cjs`, add backend helpers, update `inference.cjs` and `service.ts`. Run `node --test scripts/translation-service.test.cjs scripts/whisper-backend.test.cjs` before/after. Also verify installed runtime files against pinned hashes to avoid repeated extraction; reviewed worker-failure/cancellation recovery.
- [x] Settings: extend shared request/result types and TranslationControls with Auto/GPU/CPU and actual backend diagnostics. Changing execution/model unloads safely. Run TypeScript checks.
- [x] Benchmark: preserve baseline source, reuse exact WAVs in legacy CPU and new CPU/CUDA configurations, one cold and at least five warm trials, capture model load and inference separately, translation time and resource samples. Save raw evidence under `docs/phase3.1-evidence`. Completed synthesized and user-recorded speech comparisons.
- [x] Contention: used the isolated profiling build to compare camera/chroma/tracking/lesson-video responsiveness with CPU/CUDA inference. Physical capture and a controlled moving-face fixture remained near 30 fps; the dark physical feed's lack of face detections is documented. No production camera/tracking changes.
- [x] Verify: 40 translation tests and 440 app tests passed; main/renderer builds, type checking, native fallback/offline/switch/cancellation checks, and development/packaged UI microphone-to-caption checks passed. Spec and quality reviews completed. Exact dependencies, measurements, limitations and manual instructions are in `docs/phase3.1-whisper-gpu.md`. No commit, merge or push.
