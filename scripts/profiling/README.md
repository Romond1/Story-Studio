# Isolated live-pipeline profiling

These developer scripts are deliberately absent from package scripts, app imports,
and the normal Vite configuration. They do not modify application source files.
`build.mjs` transforms source **in memory** into an optimized diagnostic build in
the ignored `.tmp-face-profile-build` directory. `run.cjs` serves that build only
on loopback and launches a separate Electron instance with a disposable profile
and generated lesson. It opens the physical default camera, video only. It does
not record camera images or sound. Timing and numeric nose-motion samples stay in
`docs/performance-evidence`. Do not launch while someone else uses the benchmark
controls; the diagnostic harness makes camera controls inert during measurement.

PowerShell, from repository root (after normal main/test compilation and asset preparation):

```powershell
$env:STORY_STUDIO_PROFILE='1'
node scripts/profiling/build.mjs
node scripts/profiling/run.cjs
node scripts/profiling/summarize.cjs
node scripts/profiling/smoothing.cjs
node scripts/profiling/report-data.cjs
```

The follow-up suite repeats A–D, tests a drift-compensated 20 Hz target, and repeats
the video/drawing workload with a 90-second video:

```powershell
$env:PROFILE_SUITE='followup'
node scripts/profiling/run.cjs
```

`PROFILE_SUITE=video-idle` performs the additional camera-off static-scene versus
paused-video comparison. `PROFILE_VIDEO_SOURCE` optionally reuses a previously
generated benchmark WebM instead of encoding it again. Clear those variables to
return to the full suite. The saved 20 Hz target trial is named
`E-target20-compensated`; it achieved about 15 Hz, not 20. File `E-20Hz` is likewise
the nominal 50 ms gate experiment; use its measured rate, not its filename.

Both suites use 10 seconds of warm-up and at least 60 seconds of sampling per
configuration. `PROFILE_SECONDS` exists for harness debugging; shorter runs must
not be represented as full benchmarks. Required local tools: installed Electron,
Vite, FFmpeg, and bundled Playwright (path in run.cjs). No dependencies were added.

## Instrumentation boundaries

- Main-process `app.getAppMetrics()` reports this instance only; cumulative CPU
  seconds are differenced over measured wall time and divided by logical CPU count.
- A low-cost RAF observer measures callback opportunities, **not physical display
  scanout**. Camera `requestVideoFrameCallback` observes delivered video frames.
- Worker timing brackets `detectForVideo` itself. Admission-to-result timing also
  includes frame preparation, transfer, scheduling, and result delivery.
- First-paint timing ends after canvas commands are submitted, not at display
  scanout. Source timestamps refer to the admission RAF, not sensor exposure.
- GPU timer queries sample one camera upload/draw per second asynchronously;
  disjoint samples are discarded. No `gl.finish()` or pixel readbacks are used by
  diagnostics. Other compositor/raster/video GPU work is outside this query.
- The first suite's `overlay` samples include both tracking dispatch and drawing.
  The follow-up build adds `sampleCpu` to separate those operations, plus
  `drawingCpu` instrumentation for the existing lesson drawing canvas.
- Original cadence and smoothing remain the defaults. Experimental interval,
  compensation, and smoothing settings exist only in this diagnostic build.
- Raw snapshots retain actual settings, process IDs, viewport, errors, and device
  settings so mislabeled/changed configurations can be rejected.

There is no optimization or Phase 3 implementation in these scripts. To stop
using diagnostics, close the benchmark and use the normal app command. No source
rollback or production configuration change is required.
