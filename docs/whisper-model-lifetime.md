# Whisper and translation model lifetime

## Inspected Phase 3.1 behavior

| Question | Evidence and behavior before this change |
|---|---|
| New process per push-to-talk? | Yes. `TranslationService.transcribe()` calls `spawn(whisper-cli.exe, ...)` for every audio request and waits for process exit. |
| Reload weights? | Yes. `-m modelPath` initializes the native model each time. Disk files and OS file caches may be warm; model objects and CUDA allocations do not survive process exit. |
| CUDA initialized per utterance? | Yes. The CUDA DLL/backend/context is initialized inside each fresh process. Logged model/backend initialization repeats. Driver-level caches can persist independently. |
| Persistent Whisper worker already? | No. The Node inference worker memoizes verified file paths, not a Whisper model. Native recognition is a separate short-lived process. |
| Base/Small switch? | UI invalidates and unloads the Node worker. The next utterance starts the selected CLI/model; there is no resident native model to switch. This also discards the translation model unnecessarily. |
| Japanese/Italian/Romanian switch? | The next request sees a new target and terminates/replaces the inference worker. Only one target is resident at once; revisiting a target reloads its cached files into a fresh worker. |
| Mozilla models cached? | `MozillaProvider.load()` loads once per target/worker. Subsequent `translate()` calls reuse the same engine/model and report zero translation load time. Verified downloaded files persist on disk. Inference results are not cached (`cacheSize: 0`). |
| Disable/Presenter close/exit? | Disable and Control unmount call unload; service cancellation kills an active CLI and terminates its worker. Control close/navigation/crash and `before-quit` reset translation. Presenter close/crash only resets camera in Phase 3.1: translation worker/caption can remain in Control. |

Enabling translation previously only changed UI state. Preparation occurred on the first utterance. Native model load timing included CUDA work; the prior logs do not isolate CUDA context creation into a separate measured duration.

Baseline source snapshots and newly repeated measurements are under `docs/whisper-lifetime-evidence`; the compiled baseline is retained in ignored `.translation-cache/lifetime-baseline`. Earlier Phase 3.1 evidence remains intact. No commits, merges or pushes are authorized.

## Decision criteria

Evaluate the existing pinned whisper.cpp 1.8.2 DLLs through a small resident native pipe host. The bundled HTTP server is also persistent, but its HTTP surface, request defaults and external process cleanup are additional integration concerns. A private host needs no listener, server configuration, inference framework or changed model format. Adoption depends on measured repeated-request benefit and lifecycle reliability, not merely a successful native build.

Source: [whisper.cpp 1.8.2 server](https://github.com/ggml-org/whisper.cpp/blob/v1.8.2/examples/server/server.cpp) and [CLI](https://github.com/ggml-org/whisper.cpp/blob/v1.8.2/examples/cli/cli.cpp). Local behavior is established from the saved application source and runtime evidence, not inferred from upstream documentation.

## Implemented behavior

Persistence was worthwhile and has been implemented. A small Windows x64 native host dynamically loads the existing pinned CPU/CUDA DLLs and retains one Whisper context and state. Private binary stdin frames carry bounded PCM; JSON stdout carries responses. There is no HTTP listener, inference framework replacement, continuous listening or idle inference. A native parent-process handle terminates the host if Electron disappears, including during inference. Normal shutdown frees state/model and awaits process closure; bounded cancellation/termination guards handle a stuck process.

The host uses the same English, two-thread, beam/best-of, thresholds, temperature fallback, flash attention and no-context defaults as the prior CLI. Each utterance clears decoding context while retaining allocations. Existing finite-sample clipping is preserved. Pinned headers, MIT license, source, a developer build script and the bundled host hash are included under `native/whisper-host`; teachers do not need a compiler. Upstream CUDA runtime/driver dependencies remain those documented in the Phase 3.1 report.

The UI now prepares on enable and shows PREPARING until native weights/backend and the selected Mozilla model are loaded. READY permits push-to-talk; the same native PID and translation worker are reused. Target changes replace only the Mozilla worker. Model/backend changes replace only the recognizer. Disable, Control owner loss, Presenter close/crash and normal application exit release resources. Idle or in-flight crashes invalidate READY; preparation can be retried. Auto preserves verified CUDA selection and can prepare an independent CPU engine after CUDA preparation or inference failure; forced GPU reports an actionable error.

`MozillaProvider`, model files, translation options and Japanese formatting algorithms are unchanged. A prepare-only worker message calls its existing `load(target)` method. Switching away still frees the old worker/model rather than accumulating all three languages in RAM. Revisiting a language reloads from its disk cache, while Whisper stays resident.

## Measurements

Hardware: Windows x64, i7-7700K (8 logical processors), RTX 4070 Ti 12 GB. The fresh before/after comparison uses the exact five previously recorded WAVs, one first request plus five warm requests per configuration. No outlier was removed. “Before” is the saved Phase 3.1 CUDA implementation, not the earlier CPU-only app. Background desktop apps remained running.

| Model/backend | Before warm transcription | Resident warm transcription | Before draft-ready total | Resident draft-ready total |
|---|---:|---:|---:|---:|
| Base CPU | 5.726 s | 4.645 s | 5.784 s | 4.688 s |
| Base CUDA | 0.985 s | 0.116 s | 1.164 s | 0.154 s |
| Small CPU | 18.339 s | 16.495 s | 18.401 s | 16.541 s |
| Small CUDA | 2.323 s | 1.626 s | 2.465 s | 1.716 s |

Base CUDA was 8.53× faster in this full run. Small CUDA's warm samples ranged from 0.624 to 2.490 seconds, despite an isolated repeated-request probe measuring 0.175 seconds; the full-run mean above retains this variability. Persistence removes repeated initialization but does not guarantee a particular inference latency under all desktop/GPU conditions. Exact causes of the Small variation are not established by these measurements.

All five CPU/GPU transcripts match their corresponding baseline text: Base 0/49 word errors, Small 1/49 (“helped” for “help”) before and after. Translation strings also match for this corpus. Retained decoder RNG state can affect temperature-fallback sampling on other audio, so this is regression evidence, not a promise of byte-identical outputs on every recording or a general classroom accuracy guarantee.

| Resident engine | Enable preparation total | Native DLL load | Native model/backend weights | Native state/compute setup | First transcription |
|---|---:|---:|---:|---:|---:|
| Base CPU | 2.151 s | 4 ms | 271 ms | 23 ms | 4.539 s |
| Base CUDA | 3.836 s | 86 ms | 326 ms | 10 ms | 0.468 s |
| Small CPU | 3.020 s | 4 ms | 537 ms | 23 ms | 14.619 s |
| Small CUDA | 5.812 s | 90 ms | 669 ms | 13 ms | 0.340 s |

Enable totals also include hash verification and Mozilla loading (1.12–1.25 s here), with files already cached. A fresh installation additionally downloads/extracts its model/runtime. Native initialization happens once per engine, and the measured PID stays constant across requests. CUDA context initialization is **not independently separable** from DLL/model/backend setup through this API; no number in this table is labelled pure CUDA initialization. A fresh process repeats those stages in the baseline; the resident engine does not. Some lazy compute/workspace allocation occurs on the first inference, so first and warmed requests are reported separately.

## Resident memory and idle cost

Ten-second idle windows were sampled before first inference and after the requests. Native RAM below is working set; VRAM is the **whole GPU**, including the desktop and other apps, because reliable per-process WDDM VRAM counters were unavailable.

| Engine | Native RAM at READY | Native RAM after requests, idle | Whole-GPU VRAM at READY / after requests | Native idle CPU |
|---|---:|---:|---:|---:|
| Base CPU | 204 MB | 296 MB | 1,129 / 1,119 MB | 0.00% |
| Base CUDA | 295 MB | 454 MB | 1,607 / 1,685 MB | 0.00% |
| Small CPU | 578 MB | 762 MB | 1,127 / 1,125 MB | 0.00% |
| Small CUDA | 295 MB | 456 MB | 2,035 / 2,373 MB | 0.00% |

CPU percentages are normalized over eight logical processors. The native host blocks on its input pipe when idle; it submits no inference work. System-wide GPU utilization varied approximately 5–29% even during idle windows, including the baseline with no Whisper process. It cannot be attributed to Whisper. The Node benchmark host including the retained Mozilla worker used roughly 577–588 MB RSS after resident requests versus 580–594 MB before; this is not standalone Mozilla-only RAM or complete Electron UI memory.

The baseline retained no native Whisper process between requests. Persistence deliberately retains the extra native RAM/VRAM until disable. Measured disable including actual native close and worker disposal was 47 ms Base CPU, 121 ms Base CUDA, 61 ms Small CPU and 135 ms Small CUDA. The baseline's sub-millisecond cancel return was fire-and-forget and is not a comparable resource-release measurement.

## Switching and reliability

Real-process checks measured Japanese→Italian 941 ms, Italian→Romanian 680 ms and Romanian→Japanese 1,186 ms, all with the same Whisper PID. Base→Small took 3,781 ms and Small→Base 2,551 ms, including verified preparation; the previous native PID was confirmed dead. A cancellation acknowledged in 12 ms retained the engine and succeeded on the next request. An intentionally killed host moved to error and recovered with a new PID in 489 ms using cached preparation.

Process-local CUDA device masking verified Auto's CPU fallback and forced-GPU error. Restoring the environment verified GPU recovery. No drivers or global device settings were changed. Native probes also verified parent death during inference and reuse after cooperative cancellation.

Evidence: `before.json`, `after.json`, `summary.json`, `lifecycle-runtime.json`, native probe logs and test/build logs under `docs/whisper-lifetime-evidence`. The baseline source and compiled snapshot remain available for repeatable comparison.

## Camera and lesson workload

The repeatable workload uses the existing moving portrait camera fixture at 1280×720/30 fps, real MediaPipe face tracking, chroma key, hat/marker overlays and a playing 720p lesson video. Each configuration runs for at least 60 seconds after warm-up. This verifies the full landmark/rendering workload, not physical classroom lighting or a live teacher.

| Workload | Camera draw / delivered fps | Tracking Hz | Face detections | Mean transcription | PCM-ready to caption |
|---|---:|---:|---:|---:|---:|
| Idle, no STT | 30.01 / 29.65 | 9.99 | 97.54% | — | — |
| Resident Base CUDA, 68 requests | 29.96 / 28.32 | 9.98 | 97.52% | 237 ms | 886 ms |
| Resident Small CUDA, 70 requests | 30.00 / 29.93 | 10.01 | 97.52% | 269 ms | 861 ms |

The native PID remained constant throughout each model's run. Presenter RAF p95 was 16.8 ms in all three runs; lesson video dropped zero frames. The first Base run had two Presenter long tasks and Control RAF p95 of 33.4 ms versus 16.8 ms idle/Small. Some lightweight validation overlapped that run, so this anomaly is retained and a separate quiet Base repeat is recorded under `camera-repeat`; it is not hidden behind an average.

The quiet repeat delivered **29.74 fps with Base CUDA versus 29.81 idle**, drew 29.99 versus 30.01 fps, and tracked at 10.00 Hz in both. Face detection stayed at 97.52–97.54%. Presenter RAF p95 was 16.8 ms; Control was 16.9 ms with STT versus 16.8 ms idle. Each run had one Presenter long task and zero Control long tasks. Across 75 speech requests, Base transcription averaged **204 ms**, PCM-to-caption **804 ms**, with no sustained camera/tracking responsiveness regression observed. This supports coexistence under the controlled workload without claiming zero stutter in every desktop condition.

Small's 70-request contention result confirms the much faster resident path can occur over a sustained workload, while the variable five-request benchmark remains part of the evidence. The earlier Phase 3.1 controlled-face Base CUDA comparison was 1.132 s transcription / 1.820 s PCM-to-caption; this is a separate run under the same fixture, not synchronized laboratory conditions.

## Validation and packaged application

Final suites: **440 app tests and 48 translation/native tests passed**. Main/renderer builds and renderer type checking passed. Native tests cover pinned executable integrity, invalid arguments, clipping/nonfinite input, stream framing/UTF-8, startup cancellation, stale readiness, inference/cancel deadlines, failed termination, retained PID, worker failure and fallback. Real tests cover language/model switches, cancellation/reuse, native crash/recovery, masked-CUDA fallback and parent death.

The isolated Windows directory package at `output/lifetime-release/win-unpacked` includes the host, manifest and license under unpacked translation resources. It passed offline CPU, GPU and Auto with two actual AudioController/MediaRecorder microphone captures per mode. Each mode retained its PID. Presenter close released both engines and reset Control to OFF; re-enable worked; application exit left **zero orphan native processes**. This is an unsigned directory-package validation, not an installer or signed-release test.

| Packaged Base mode | Release to visible transcript, two samples | Release to caption, two samples |
|---|---:|---:|
| CPU | 5.762 / 5.173 s | 5.798 / 5.180 s |
| GPU | 0.423 / 0.441 s | 0.430 / 0.448 s |
| Auto (CUDA) | 0.388 / 0.361 s | 0.395 / 0.367 s |

These UI samples include microphone stop/decode/resample, recognition, translation and renderer update. The private English field becomes visible only when the translated result returns, so “visible transcript” also includes translation time. A continuously looped recorded WAV supplies the fake microphone; intervals can straddle phrase boundaries. The exact-WAV service benchmark above is the accuracy comparison. Raw packaged evidence has no errors and an empty orphan-PID list.

The preserved Phase 3.1 package was also rerun with the same WAV/microphone harness to measure the previously unrecorded visible-transcript boundary: CPU **5.568 s**, GPU **1.226 s**, Auto **1.110 s**, with caption times 5.603 / 1.236 / 1.116 s respectively. These are single baseline UI samples versus two resident samples per mode, not five-trial averages. Evidence is in `baseline-ui/packaged-checks.json`; the old package was not rebuilt or overwritten. The final native probe independently reconfirmed retained PID, CUDA allocation evidence, cancellation/reuse and parent-death cleanup.

## Changed files and use

Production changes are confined to the native host; `translation/service.ts`, `whisper-session.cjs`, `whisper.cjs`, `inference.cjs`; translation shared types/preload/broadcast; the existing translation controls; and the translation reset hooks in `presentWindow.ts`. `bergamot.cjs`, Mozilla model records, audio capture/routing, Japanese formatting, camera/chroma/tracking, lesson schemas and game implementations are unchanged. Packaging copies and dependency notices include the small host; no new npm package or inference model is introduced.

Choose Teach → Translation → **Turn translation on** during setup. Wait for **Engine: READY** and the verified backend. Base and Auto remain defaults. Target language changes prepare only translation; Base/Small or CPU/GPU changes prepare recognition. If a worker fails, use **Prepare translation again**. Disable translation or close Presenter to release resources.

Repeat checks with `npm run test:translation`, `npm test`, `node scripts/whisper-lifetime-benchmark.cjs --baseline`, `node scripts/whisper-lifetime-benchmark.cjs`, `node scripts/whisper-lifetime-check.cjs` and `node scripts/whisper-lifetime-ui.cjs --packaged`. Benchmarks require the retained local recordings/cache. Build the native helper only for source changes with `node scripts/whisper-host-build.cjs` from an x64 Visual Studio developer environment, then rebuild the app; teachers use the bundled binary. The host manifest must match the final executable bytes, including any future signing modifications.

Automatic native support remains Windows x64; CUDA requires compatible NVIDIA hardware/drivers. CPU fallback does not depend on CUDA libraries. Other operating systems/backends were not added. All existing uncommitted work is preserved; nothing was committed, merged or pushed.
