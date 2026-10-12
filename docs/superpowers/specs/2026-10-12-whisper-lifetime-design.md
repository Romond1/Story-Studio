# Whisper model lifetime

Preserve the uncommitted Phase 3.1 implementation and recorded audio. Current Whisper is a fresh CLI per utterance; MozillaProvider retains one target inside a worker, replaced when target changes. Presenter close currently does not reset translation. OFF must release both engines; PREPARING must verify/download files and load selected engines; READY permits serial push-to-talk requests while weights remain resident and idle.

Evaluate a small native stdin/stdout wrapper around the existing pinned whisper.cpp DLLs against bundled whisper-server. Prefer private pipes, parent-death cleanup, bounded audio, cancellation, no cross-utterance text context, and unchanged CLI decoding defaults. Keep the existing CLI if measured benefit is negligible. No HTTP/public service, alternate inference framework or quality downgrade is necessary for a wrapper.

Separate recognition lifetime from translation-worker lifetime. Target changes replace only Mozilla's worker. Recognition model/backend changes replace only recognition. Prepare on enable and configuration change, disable recording until ready, publish actual selected backend and errors. Disable, owner loss, Presenter close and app exit tear down resources. A crashed worker becomes not-ready and supports explicit retry without stale output. One request at a time. Cancellation aborts native inference with stale-result rejection; an unresponsive engine may be terminated and prepared again.

Measure the same five WAVs before/after: preparation, native model load and backend initialization where separable, request-to-transcript and UI release-to-caption, resident RAM and system VRAM, idle utilization, model/language switches, release time. Retest controlled full-face camera/chroma/video workload and packaged CPU/CUDA/Auto. Preserve exact Mozilla models and Japanese formatter. Report limitations of system VRAM and CUDA timing attribution.

No commit, merge or push. Stay in this working checkout because the prerequisite implementation is uncommitted. Scope is translation lifecycle and its native helper, IPC, tests and diagnostics only.
