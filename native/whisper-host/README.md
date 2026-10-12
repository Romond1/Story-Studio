# Resident whisper.cpp host (Windows x64)

Resident recognition helper. Dynamically loads the existing verified whisper.cpp v1.8.2 CPU/CUDA runtime and retains one model and one inference state. No HTTP server, network listener, transcript history, or inference while idle.

## Build and provenance

The executable in `bin/win32-x64` uses the static MSVC runtime. End users need no compiler. Developers run `node scripts/whisper-host-build.cjs` from an x64 Visual Studio developer shell (VS2019 or later, Windows SDK). `manifest.json` contains its size and SHA-256. Rebuilding refreshes that manifest.

`vendor` contains unmodified headers and MIT license downloaded from https://github.com/ggml-org/whisper.cpp/tree/v1.8.2 . Header paths are `include/whisper.h` and `ggml/include/{ggml,ggml-cpu,ggml-backend,ggml-alloc}.h`; CLI defaults were checked against upstream `examples/cli/cli.cpp`. Runtime version must report exactly 1.8.2. Runtime/model integrity verification belongs to the existing application installer before host launch.

## Protocol v1

Launch with `--runtime-dir ABSOLUTE_RELEASE_DIRECTORY --model ABSOLUTE_MODEL_FILE --backend cpu|cuda --parent-pid POSITIVE_PID` and private stdin/stdout pipes. stderr carries native diagnostics. No shell is needed. The parent handle is opened before DLL/model initialization; parent death terminates only this host immediately, including during inference. Closing stdin or sending shutdown cancels, joins, and frees the model/state.

Each stdin frame has three little-endian uint32 fields: kind, request ID, sample count. Kind 1 is followed by count little-endian float32 mono PCM samples at 16 kHz. Count is bounded to 4800..320000 and samples must be finite in [-1,1]. Kind 2 cancels the matching active ID and requires count 0. Kind 3 shuts down and requires count 0. One request may be active; overlap receives an error. Malformed header/count ends the session because safe stream resynchronization is impossible. IDs should be unique per session.

stdout is newline-delimited JSON: `ready` (PID and metrics), `result` (id, text, metrics), `cancelled` (id), or `error` (id, error). Cancel of an unknown/completed ID has no response. Callers should ignore stale terminal messages for cancelled application requests. Cancellation is cooperative inside whisper callbacks; shutdown owners may enforce a final kill deadline.

`ready.metrics.dllLoadMs` measures DLL loading. `modelLoadMs` covers model parsing, weights and backend allocations; `backendInitMs` measures explicit whisper state/compute allocation. Neither is a pure CUDA initialization measurement. `prepareMs` includes both plus symbol resolution. `result.metrics.inferenceMs` is the full native call including any remaining lazy initialization. There is no silence warmup. First inference and subsequent inference must be measured separately.

Decode configuration matches v1.8.2 CLI with `-l en -t 2 -nt`: beam search/library default beam size, library default greedy best-of, flash attention on, temperature/fallback defaults, no non-speech suppression. `no_context=true` ensures a prior utterance cannot become a prompt; the library resets decode state inside each full call while reusing allocations. No quality-affecting model conversion or quantization occurs.

Segments with native no-speech probability at least 0.6 are omitted, preserving the application's existing transcript filter. The JavaScript adapter removes bracketed BLANK_AUDIO/SILENCE/MUSIC markers. Resident decoder random-number state can differ from a freshly launched process if temperature fallback is needed; decoding parameters are unchanged and real speech examples should still be compared in acceptance checks.

## Checks

`node --test scripts/whisper-host.test.cjs` checks packaging/argument failure without inference. `node scripts/whisper-host-probe.cjs cpu base.en` exercises repeated real WAV inference in one PID, cancellation, reuse and parent-death cleanup. Arguments also support `cuda` and `small.en`. Run probes sequentially, without competing benchmark processes. These require the repository's downloaded runtime/model cache and recorded evidence WAV.

