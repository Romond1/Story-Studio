# Phase 3.1 — optional Whisper GPU acceleration

Development machine: Windows x64, Intel Core i7-7700K (8 logical CPUs), NVIDIA RTX 4070 Ti (12 GB), NVIDIA driver 610.88. Measurements are local to this machine. No commit, merge or push was made.

## Root cause and implementation

Phase 3 downloads whisper.cpp 1.8.2's CPU-only archive and unconditionally invokes `-ng` (`--no-gpu`). It also launches a fresh CLI process and verifies/extracts the runtime for every utterance. Neither Transformers.js nor an ONNX speech runtime is involved.

Phase 3.1 retains whisper.cpp 1.8.2, the existing exact GGML Base English and Small English models, two CPU threads, English recognition and all decoding options. Base stays the default. CUDA uses the upstream prebuilt CUDA 12.4 archive. CPU keeps its independent CPU-only archive, so CUDA DLLs are unnecessary for CPU operation.

`Auto` probes NVIDIA availability and tries CUDA; preparation errors, missing CUDA execution evidence, or native inference failure fall back to CPU with a visible reason. `GPU` reports an actionable error and does not silently fall back. `CPU` always passes `-ng`. Results report the actual backend. CUDA verification requires a positive CUDA model allocation, native CUDA backend initialization and positive encode compute-buffer allocation; device identity is matched to the selected CUDA ordinal in the native log.

Downloads, decompression and model/runtime integrity verification run in the existing worker. Native inference runs in the existing asynchronous child process, outside Electron main and both rendering threads. Preparation results are memoized in the worker. A pinned per-file SHA-256 manifest also permits reuse across worker/app lifetimes: missing/corrupt executable or DLL files cause verified archive extraction and re-verification. The exact verified executable path is used. Worker faults are distinct from user cancellation so Auto can recover, while explicit cancellation prevents stale fallback/restart. Native closure is awaited before private utterance cleanup or new runtime preparation.

The model still loads once per utterance and is released when its CLI exits. This keeps the current lifecycle and decoder behavior; a resident server was deliberately not added. “Warm” in this report means repeated processes with warm OS/driver caches, not a resident Whisper model. The translation worker remains warm between requests as before.

## Dependencies and packaging

No npm dependencies were added. Optional runtime source: [whisper.cpp 1.8.2 release](https://github.com/ggml-org/whisper.cpp/releases/tag/v1.8.2).

| Runtime | Archive bytes | SHA-256 |
|---|---:|---|
| CPU `whisper-bin-x64.zip` | 3,832,432 | `b1514ebc099765e39fa37eb780b92a140a94c86bb0b3b3d98226b38825979732` |
| CUDA `whisper-cublas-12.4.0-bin-x64.zip` | 457,274,520 | `54a3c012e6c567e2e8bed874cdf49c55f018ec8d90bb5d5271568aa573291b2d` |

CUDA archive contains `cudart64_12.dll`, `cublas64_12.dll`, `cublasLt64_12.dll`, `nvblas64_12.dll`, `nvrtc64_120_0.dll`, `nvrtc-builtins64_124.dll`, `ggml-cuda.dll` plus Whisper/ggml CPU libraries and the CLI. The installed executable/DLL hashes and sizes are in `src/main/translation/whisper-runtime-manifests.json`: 720,364,032 bytes for CUDA versus 4,664,832 bytes for CPU. A compatible NVIDIA driver is required. Native binaries also require the Microsoft Visual C++ x64 runtime (`MSVCP140.dll`, `VCRUNTIME140.dll`, `VCRUNTIME140_1.dll`) and Windows Universal CRT; a fresh Windows deployment must provision the runtime redistributable if absent. Teachers do not need CMake, Visual Studio, Python or the CUDA development toolkit. The optional archive downloads to the existing local model cache; it is not added to every platform's application bundle. Existing `prepare-translation.mjs` copies the new `.cjs`/`.json` helpers, and the existing translation ASAR-unpack rule covers them. NVIDIA DLL terms are linked in `THIRD_PARTY_NOTICES.md`; they are not MIT merely because whisper.cpp is MIT.

## Benchmark method and evidence

The user recorded five classroom phrases once via a local test window. Those exact 16 kHz mono PCM recordings are reused for every CPU/GPU/model configuration. Phrases cover directions, Mia/Oliver/dragon names, “do not,” “cannot,” and typical teaching language. Separate synthesized versions and a deterministic pink-noise stress fixture provide additional checks. Artificial noise is not a substitute for a room full of children.

Each configuration has a first-process trial and five subsequent warmed trials. Recordings and speech duration are excluded from transcription latency. `transcriptionMs` includes native process startup, model load, inference and JSON result reading; `whisperLoadMs` and native total/encode/batch-decode timing expose components. `speechInstallVerifyMs` is separate. `translationMs` is separate from translation model initialization. Service `totalMs` ends when the draft is ready; combined camera measurements additionally time caption publish and Presenter acknowledgement. These are not physical display scanout measurements.

Resource sampling reads native process CPU seconds/RAM approximately every 250–700 ms and NVIDIA system-wide GPU utilization/VRAM. CPU percentages are normalized across 8 logical CPUs. Short-lived allocation peaks can be missed. Windows WDDM does not provide reliable per-process VRAM here; system-wide GPU numbers include desktop composition, NVIDIA Broadcast and other apps and must not be attributed wholly to Whisper. Native CUDA initialization evidence is stronger than utilization alone.

Raw evidence lives in `docs/phase3.1-evidence`: `cuda-probe.log`, `baseline*.json`, `benchmark.json`, `live-test.json`, `live-baseline.json`, `live-benchmark.json`, resource logs, combined-camera results, and `summary.json`. The original service/provider source is preserved as `.txt` baseline evidence. Initial runs are retained even when slow; they are not removed from the evidence.

The first CUDA probe took 16.68 seconds natively and an early Base trial took 12.04 seconds. Later runs were much faster; first-use CUDA kernel/driver preparation is a plausible explanation, not independently proven. The live test also exposed 106 seconds of redundant archive extraction on its first GPU request. That specific repeat-installation cause was fixed with pinned installed-file verification. A genuinely fresh CUDA installation still has download/extraction cost and should be completed before a lesson.

## Recorded-utterance results

Five warmed trials per configuration, using the same five user recordings (4.08–5.76 seconds long). Means in seconds; no outliers removed. The legacy CPU columns use the saved pre-change implementation. Normal desktop background applications remained running, so this is a local teaching-machine comparison rather than a laboratory throughput claim.

| Model/backend | Transcription | Draft ready total | Translation only | Word errors |
|---|---:|---:|---:|---:|
| Base CPU, legacy | 7.134 | 8.224 | 0.044 | 0/49 |
| Base CPU, updated | 6.561 | 6.614 | 0.046 | 0/49 |
| Base CUDA | **1.532** | **1.654** | 0.050 | 0/49 |
| Small CPU, legacy | 19.064 | 21.320 | 0.043 | 1/49 |
| Small CPU, updated | 16.273 | 16.322 | 0.043 | 1/49 |
| Small CUDA | **2.019** | **2.146** | 0.050 | 1/49 |

Compared with the updated CPU path, Base transcription was 4.28× faster and Small 8.06× faster. Compared with the legacy full draft-ready pipeline, the reductions were 8.224→1.654 seconds and 21.320→2.146 seconds. GPU/CPU transcripts and their translated text matched within each model on all five recordings. Small changed “help” to “helped” in the name phrase on both backends; this corpus gives no reason to change the Base default. All four updated configurations also had zero word errors on the user-recorded phrase with added artificial noise. The initial synthesized noisy phrase had one Base error and zero Small errors, identically across backends.

| Updated configuration | First transcription | First preparation/verification | Mean model initialization | Warm preparation |
|---|---:|---:|---:|---:|
| Base CPU | 8.360 s | 0.556 s | 0.481 s | 0.50 ms |
| Base CUDA | 0.826 s | 2.259 s | 0.536 s | 0.44 ms |
| Small CPU | 17.111 s | 1.973 s | 1.024 s | 0.29 ms |
| Small CUDA | 1.226 s | 2.892 s | 1.198 s | 0.40 ms |

“First” here is a fresh service/process after earlier driver/OS cache warming, not a virgin driver installation. Native total (including load, excluding outer process overhead) averaged 6.404/1.106 seconds for Base CPU/CUDA and 16.185/1.554 seconds for Small. This exposes the remaining per-process overhead. Main-side PCM/WAV preparation averaged 3–5 ms; the large bottleneck was inference and repeated preparation, not that conversion. The existing renderer MediaRecorder decode/resample path is unchanged.

| Updated configuration | Native CPU % of machine | Peak sampled native RAM | Peak sampled host RSS | Mean system GPU util. | Peak system VRAM |
|---|---:|---:|---:|---:|---:|
| Base CPU | 21.57% | 298 MB | 587 MB | 21.45% | 1,169 MB |
| Base CUDA | 8.71% | 449 MB | 595 MB | 4.80% | 1,723 MB |
| Small CPU | 23.75% | 765 MB | 594 MB | 23.30% | 1,175 MB |
| Small CUDA | 10.64% | 448 MB | 615 MB | 5.74% | 2,195 MB |

The GPU utilization samples are short, system-wide and affected by background apps; they are not CUDA-only compute utilization or a comparative efficiency score. CUDA residency and selected-device logs verify acceleration. Model storage is unchanged: Base 147,964,211 bytes, Small 487,614,201 bytes. Native process exit releases its model and CUDA allocations after each utterance. Cancellation/setting changes also release the worker after pending native cleanup.

## Combined camera/video contention

The physical default device was UGREEN HDMI Capture at 1280×720/30 fps, with chroma key, MediaPipe inference, hat/marker settings enabled and a playing 1280×720/30 fps lesson video. Each configuration has at least 60 seconds of measurement after a 10-second warm-up and at least five STT trials. The camera image was dark and **no faces were detected** in this physical run, so these figures establish camera/video and face-detection-inference coexistence, not live facial landmark/overlay performance.

| Workload | Camera draw fps | Delivered camera fps | Tracking inference Hz | Presenter RAF p95 | PCM-ready to caption |
|---|---:|---:|---:|---:|---:|
| No STT | 30.01 | 29.98 | 10.01 | 16.8 ms | — |
| Base CPU | 29.95 | 29.07 | 10.01 | 16.8 ms | 10.30 s |
| Base CUDA | 30.00 | 29.75 | 10.00 | 16.8 ms | 1.83 s |
| Small CPU | 30.00 | 29.85 | 10.00 | 16.8 ms | 23.24 s |
| Small CUDA | 29.97 | 29.62 | 10.04 | 16.8 ms | 2.43 s |

Control RAF p95 was also 16.8 ms throughout. Presenter long tasks: 0 idle, 7 Base CPU, 0 Base CUDA, 4 Small CPU, 2 Small CUDA. These measurements show no significant sustained frame/cadence degradation from CUDA in this workload; they do not prove the absence of every visible stutter. Files `camera-benchmark.json`, `camera-resources.json`, and `camera-presenter.png` retain the conditions and limitations.

A second controlled run used a moving portrait on green background as the camera source, with the same actual MediaPipe model, chroma shader, hat/marker overlays, lesson video and recorded speech. It detected faces in 97.4–97.5% of inference results. This checks the complete landmark/overlay workload reproducibly without claiming that the portrait is a physical classroom camera.

| Moving-face workload | Draw fps | Delivered fps | Tracking Hz | Face inference mean | PCM-ready to caption |
|---|---:|---:|---:|---:|---:|
| No STT | 30.00 | 29.64 | 10.04 | 29.99 ms | — |
| Base CPU | 29.94 | 28.97 | 9.99 | 34.88 ms | 8.57 s |
| Base CUDA | 29.99 | 29.53 | 9.98 | 30.14 ms | 1.82 s |

Presenter and Control RAF p95 remained 16.8 ms in all three runs. CUDA had one Presenter long task and no Control long tasks during 62.1 seconds; CPU had seven and two respectively. No significant camera/tracking cadence regression was observed with CUDA in this controlled full-face workload. Physical tracking of the teacher in a lit classroom remains a manual follow-up because the live feed had no visible face. Raw evidence is in `synthetic-camera-benchmark.json` and `synthetic-camera-resources.json`.

## Acceptance checks

- Full app suite: **440/440 passed**; translation/cache/capture/backend/runtime suite: **40/40 passed**. Main and renderer builds and renderer type checking passed. The renderer build retains its existing bundle-size warning.
- Real native offline checks passed for CPU, Auto falling back after CUDA device masking, actionable forced-GPU failure, subsequent GPU recovery, and cancellation followed by CPU retry. Masking was process-local; no driver or global device configuration changed.
- Actual UI capture used the recorded WAV through Chromium's fake microphone and the existing AudioController/MediaRecorder path, then published to Presenter. CPU, GPU and Auto all reported the correct backend and published matching draft/caption text; turning translation off hid the caption. Stop-recording to displayed caption took **6.021 s CPU, 1.413 s GPU and 1.376 s Auto** in this smoke test. These are single acceptance samples, not benchmark means. The fake microphone loops continuously, so a captured interval may straddle phrase boundaries; accuracy claims use the complete identical WAV trials above.
- The final app-test run follows a lazy-loading correction for the native helper: ordinary startup does not eagerly require the speech backend. No unrelated test-loader or project-persistence code was changed.
- Windows x64 directory packaging passed in `output/phase31-release/win-unpacked`, preserving the existing release directory. The packaged executable passed the same offline microphone-to-Presenter smoke test in CPU, GPU and Auto, including actual CUDA device reporting and caption hide. Single stop-to-caption samples were **5.541 s CPU, 1.396 s GPU, 1.397 s Auto**. The package includes the verified runtime helper/manifests; CUDA/model downloads remain in the external cache. This is an unsigned directory package, not an installer/signing validation.

Evidence: `app-tests-final.log`, `translation-tests-final.log`, `renderer-build.log`, `typecheck.log`, `runtime-checks.json`, `ui-checks.json`, `ui-control.png`, `package-build.log`, `packaged-checks.json` and `packaged-control.png`. Earlier failed runs remain as diagnostic evidence where applicable.

## Files changed in this task

- STT integration: `src/main/translation/whisper.cjs`, `inference.cjs`, `service.ts`; new `whisper-runtime.cjs` and `whisper-runtime-manifests.json`.
- Settings and diagnostics: `src/shared/translation.ts`, `src/renderer/translation/TranslationControls.tsx`.
- Dependency notices: `src/main/translation/THIRD_PARTY_NOTICES.md`. No package dependency or lockfile changes were introduced by Phase 3.1; `package.json` only adds new tests to the existing translation test command.
- Regression tests: `scripts/translation-service.test.cjs`, new `whisper-backend.test.cjs`, `whisper-runtime.test.cjs`.
- Developer verification: `scripts/whisper-benchmark.cjs`, `whisper-summarize.cjs`, `whisper-runtime-check.cjs`, `whisper-camera-benchmark.cjs`, `whisper-ui-smoke.cjs`, `whisper-live-test.cjs` and its HTML.
- This report, raw evidence, and the Phase 3.1 design/plan under `docs/superpowers`. Pre-existing uncommitted Phase 2/3 changes were retained.

## Scope and hardware limits

Only STT integration, its settings/diagnostics, tests, benchmark harnesses and documentation changed in this task. Story rendering, camera composition, chroma key, face tracking, lesson schemas, game integration, audio routing, Mozilla translation models and kana/furigana processing were not changed. Transcripts are compared before translation so STT differences cannot be mistaken for changes to the translation engine.

Automatic native installation remains Windows x64 only, matching the existing implementation. CPU fallback is independent of NVIDIA on this supported platform; this change does not claim newly packaged macOS/Linux CPU support. CUDA discovery currently uses `nvidia-smi`; a broken/missing utility produces an actionable CPU fallback even if a GPU exists.

| Future backend | Investigation |
|---|---|
| Vulkan | whisper.cpp supports a separately compiled Vulkan backend, suitable for evaluating compatible Windows/Linux GPUs; requires driver/API and device-specific validation. Not shipped here. |
| Metal | Upstream supports Apple Silicon GPU execution; requires a separate macOS build/package and hardware validation. |
| DirectML | Not part of this selected whisper.cpp CUDA/CPU integration. Would require an appropriate alternate runtime/model path; not added merely for broader claims. |
| WebGPU | Not supported by the selected native binaries. A browser/ONNX implementation would require another runtime and likely model format. No extra heavy runtime introduced. |

See [upstream acceleration documentation](https://github.com/ggml-org/whisper.cpp/blob/v1.8.2/README.md) for CUDA/Vulkan/Metal support. Integrated GPUs are not treated as interchangeable with NVIDIA CUDA devices. Backend descriptors and the request execution setting allow future additions without changing the translation provider.

## Manual use and repeatable verification

1. Build with `npm run build:main` and `npm run build:renderer`, then launch Story Studio normally.
2. In Teach → Translation, turn translation on. Expand **Caption and recognition settings**; choose **Speech processing → Auto**, keeping **Base English**.
3. Enable the microphone using the existing Audio settings and speak a classroom phrase. Check **Last speech backend: NVIDIA CUDA · NVIDIA GeForce RTX 4070 Ti** after completion. Review and publish the translation normally.
4. Select CPU and repeat; the last backend must report CPU. Select Small English if higher recognition accuracy is needed; no automatic Tiny substitution occurs.
5. Test cancellation during preparation/transcription, switch execution/model, and turn translation off. Retry and check that stale output does not reappear.
6. Run offline after initial installation. Explicit GPU should give guidance if unavailable; Auto should visibly fall back. Do not uninstall drivers to test: `node scripts/whisper-runtime-check.cjs` uses process-local CUDA device masking.
7. For identical-recording timing: `node scripts/whisper-benchmark.cjs --live`; legacy comparison additionally uses `--baseline` and the retained local baseline build. `node scripts/whisper-summarize.cjs` regenerates numerical summaries.
8. For new recordings: `npx electron scripts/whisper-live-test.cjs`. Five recordings are saved locally only. For camera contention, set `STORY_STUDIO_PROFILE=1`, run `node scripts/profiling/build.mjs`, set `PROFILE_VIDEO_SOURCE` to a 720p/30fps WebM, and run `node scripts/whisper-camera-benchmark.cjs`. The harness opens the default camera and records timing data; it does not record camera video or microphone sound.

Recorded speech accuracy on five phrases is useful regression evidence, not a general classroom accuracy guarantee. Longer lessons, accents, children speaking simultaneously and genuine background noise need a broader corpus.
