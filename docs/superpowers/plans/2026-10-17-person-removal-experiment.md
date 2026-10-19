# Lightweight person-removal experiment

Use the already pinned tasks-vision 0.10.32 runtime with Google's landscape selfie segmenter, local model and notices. Optional setting defaults off; worker inference uses CPU with one frame in flight and a 12Hz gate, dropping to 6Hz when slow. Reuse the captured video for face tracking and segmentation, never acquire a second stream. Composite a small person confidence mask into the existing WebGL shader at normal video rate. Hide the output until a fresh mask exists; errors must not reveal the original room.

- [x] Write tests for bounded scheduling, stale masks, slowdown/circuit-breaker and status validation.
- [x] Bundle hash-pinned model/card/license and classic offline segmentation worker.
- [x] Integrate session, shader mask, exclusive mode toggle and private performance status relay.
- [x] Run native actual-model test, mode/camera lifecycle checks and baseline vs combined game/tracking timing; inspect screenshots.
- [x] Run tests/builds, review and report measured results and limits.
