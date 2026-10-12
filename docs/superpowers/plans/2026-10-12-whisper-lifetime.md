# Whisper Lifetime Implementation Plan

> Use subagent-driven-development for the isolated native helper and independent spec/quality reviews; integrate the service in this session. No commits.

**Goal:** Pay model initialization on enable, retain selected engines between utterances, and safely release on disable.

**Architecture:** Measure a private native pipe wrapper around pinned whisper.cpp 1.8.2 DLLs; split its ownership from the existing Mozilla worker. Add prepare/state IPC and a teacher-facing OFF/PREPARING/READY flow.

**Tech Stack:** Electron, TypeScript, Node workers, Windows x64 C++ helper, existing whisper.cpp CUDA/CPU runtimes.

- [x] Inspect service/provider/UI/owner lifecycle; preserve baseline compiled service and source evidence.
- [x] Prototype native persistence and benchmark identical WAVs against saved CLI. Native GPU Base repeat108ms vs CLI985ms justified adoption; pinned decoder defaults, allocations, cancellation/reuse and parentdeath verified.
- [x] Add failing lifecycle tests for retained PID, separate target/recognition lifetime, cancellation barriers, stale output, crash and Auto preparation/inference fallback recovery. Initial RED and regression RED logs retained.
- [x] Implement bounded pipe controller and separate service prepare/run/cancel lifetimes. Existing Mozilla load(target) prepares without translation; model/formatter algorithms remain unchanged.
- [x] Add typed prepare/state IPC and OFF/PREPARING/READY UI; model/target switching, Presenter close/owner loss/app exit release and synchronize resources.
- [x] Run before/after five-recording benchmarks, ten-second idle windows, real switches/cancellation/crash/device masking/release checks; retain variable SmallGPU results without dropping outliers.
- [x] Run camera/chroma/full-face/video contention for Base/Small CUDA, plus quiet Base repeat to resolve a Control frame-time anomaly; spec and quality reviews approved. 440 app and 48 translation/native tests passed; builds/typecheck and unsigned packaged offline CPU/GPU/Auto microphone, Presenter-close and exit cleanup checks passed.
- [x] Write final report `docs/whisper-model-lifetime.md` with lifecycle answers, latency/RAM/VRAM/idle/switch/release measurements, limits and manual use. Preserved Phase 3.1 package supplied an additional before UI comparison. No commits, merges or pushes.
