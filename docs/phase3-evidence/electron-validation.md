# Electron combined acceptance — 2026-10-12

Executed `node scripts/translation-electron-smoke.cjs` after rebuilding the renderer. This is a production renderer running in Electron, using synthetic media: the public MediaPipe portrait animated into a green-screen camera fixture and Windows SAPI English speech played through Chromium's fake microphone. It does not establish physical-camera, physical-microphone, acoustic or Zoom behavior.

All eight acceptance checks passed with no renderer page errors and no attempted renderer HTTP(S) requests. Local inference workers ran in offline mode against previously downloaded model files. The control UI exercised Japanese draft review and manual publication, standard/kana-only/true ruby furigana, Italian and Romanian switching, and clear during in-flight translation. Before publication, Presenter had no caption. The active lesson, camera chroma key and real MediaPipe 478-landmark inference remained active throughout.

The Audio settings microphone picker and Hold to talk button were used with synthetic speech. Whisper produced “Wait until I say go. Do not open the door yet.” The microphone instrumentation recorded one acquisition and one still-live input track: recognition reused that input. Presenter likewise acquired its camera once.

## Combined performance

The final run used unchanged camera and face-tracking defaults (30 FPS / 10 Hz). Both samples retained the active lesson, keyed camera, real tracking, microphone stream and published Japanese caption. The baseline was warmed and idle; the active sample repeatedly submitted actual 16 kHz speech PCM to Whisper base.en and translated its result into Japanese.

| Measurement | Baseline | Speech + translation |
| --- | ---: | ---: |
| Sample duration | 60.41 s | 60.57 s |
| Camera WebGL draw rate | 29.994 FPS | 30.014 FPS |
| Face inference result rate | 9.998 Hz | 10.005 Hz |
| Completed utterances | 0 | 7 |
| Mean summed Electron CPU | 10.83% | 12.85% |
| Mean summed Electron working set | 2325.9 MB | 2405.1 MB |

Whisper transcription took 5.98–9.35 seconds per approximately 4.3-second recording; end-to-end local processing took 6.78–10.34 seconds. Warm translation itself took 43–58 ms. This supports smooth camera/tracking coexistence on this machine, but the speech latency is a noticeable limitation for rapid conversation.

CPU and memory come from Electron `app.getAppMetrics()`. They exclude the native whisper-cli child process, CPU is sampled between inference calls, and summed working sets can double-count shared pages. These are diagnostic Electron measurements, not total-system peak resource measurements. Draw calls measure submission cadence, not externally observed display presentation. Other existing development processes remained open; this is not an isolated hardware benchmark.

`electron-results.json` contains final raw samples, per-inference latency metrics, microphone counts, settings and pass results. `electron-text-results.json` retains the earlier successful text-only run; its baseline overlapped unrelated build activity and should not be used as the definitive baseline.

## Screenshots and reproduction

- `electron-control-desktop.png`, `electron-presenter-desktop.png`: desktop manual-review/published-caption views.
- `electron-presenter-furigana.png`: real ruby readings.
- `electron-control-narrow.png`, `electron-presenter-narrow.png`: 480 × 850 windows. Control panel has no horizontal overflow.

The harness requires compiled test lesson commands, main/renderer builds, `ffmpeg`, Electron, Playwright and the downloaded `.translation-cache`. Supply `STORY_STUDIO_FACE_FIXTURE` for a local MediaPipe portrait and `STORY_STUDIO_SPEECH_FIXTURE` for a short English WAV. Defaults refer to the local fixtures used for this validation. `STORY_STUDIO_TRANSLATION_SAMPLE_SECONDS` defaults to 60. Model-cache provisioning happens before offline inference; no model files or private recordings are committed as evidence.

## Separate native Whisper resource sample

To cover the native process omitted by Electron's API, two additional offline speech/translation calls were run standalone through the same TranslationService and base.en helper, polling `Get-Process whisper-cli` at nominal 200 ms. This resource-only follow-up was separate from the combined camera benchmark and overlapped unrelated packaging work; its latency is not a clean comparison.

| Helper PID | Observed interval | Observed CPU time | CPU (one core = 100%) | CPU / 8 logical processors | Sampled peak working set |
| --- | ---: | ---: | ---: | ---: | ---: |
| 16256 | 12.012 s | 15.469 s | 128.78% | 16.10% | 297.01 MB |
| 26512 | 4.958 s | 9.375 s | 189.09% | 23.64% | 297.90 MB |

Both calls completed successfully. The peak working set is a sampled lower bound; CPU rates are interval averages calculated from the first and last observed cumulative CPU counters and omit startup/exit edges. They are not instantaneous maximum CPU values. These results must not simply be added to the earlier Electron measurements, which used different timing and CPU reporting conventions. Raw samples and helper results are in `electron-native-resources.json` and `electron-native-stdout.log` (empty stderr).
