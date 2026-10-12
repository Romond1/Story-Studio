# Phase 3 — local speech translation

Implemented 2026-10-12 on `codex/presenter-camera-phase1`. No commit, merge or push was made. The pre-edit tracked changes and nonignored untracked files are recoverable from `D:/AI/GitHub/Story-Studio-phase3-checkpoint-20261012` (HEAD, index patch, working patch, untracked manifest and copies).

## What changed

Both Teach architectures now have an optional Translation section: English text input, local push-to-talk, private transcript, editable translation, Japanese/Italian/Romanian selection, Japanese display modes, explicit publication and clearing. Auto-publish is off initially. Advanced controls provide Base/Small model choice, font size, caption position and Japanese reading corrections.

The existing AudioController remains the only microphone owner. Recognition records its clean input tracks, before lesson mixing and microphone gain/mute. It never calls getUserMedia, stops those tracks, changes the audible microphone processing, or connects another audible output. MediaRecorder output is decoded and resampled with OfflineAudioContext to mono 16 kHz. A 20-second cap, input-energy gate, track-ended/replacement handling, cancellation, native timeout and single-request queue bound the work.

Whisper runs as a supervised CPU process with two threads and GPU disabled. Mozilla translation and Japanese analysis run in a Node worker. Language replacement waits for disposal of the previous worker; cancellation also waits for native process closure before reusing its runtime. Idle edits preserve a warm model; disabling translation/unmounting unloads it. No inference model loads at app startup.

Presenter gains a separate React/DOM caption layer above the existing camera and story layers. Only a reconstructed published caption envelope crosses that IPC boundary. Drafts, source English, errors, status and teacher controls remain in Control. No lesson schemas, game/database systems, camera cadence or face-tracking cadence were changed by Phase 3.

## Models and dependencies

| Component | Selection | Download size |
|---|---|---:|
| Speech default | whisper.cpp v1.8.2 CPU + Whisper base.en | runtime 3.83 MB + model 147.96 MB |
| Optional speech | Whisper small.en | 487.61 MB; not downloaded during validation |
| English → Japanese | Mozilla released 3.0, base-memory, separate source/target vocabularies | 34.89 MB compressed; 49.60 MB expanded |
| English → Italian | Mozilla released 3.0, base-memory | 25.59 MB compressed; 36.51 MB expanded |
| English → Romanian | Mozilla released 3.0, tiny translation architecture | 13.53 MB compressed; 21.68 MB expanded |
| Translation runtime | @browsermt/bergamot-translator 0.4.9 WASM | bundled npm dependency |
| Japanese analyzer | Kuromoji 0.1.2 + IPADIC | bundled dictionary, loaded lazily |
| Model extraction | fzstd 0.1.1, extract-zip 2.0.1 | bundled npm dependencies |

Romanian's translation architecture name does not change the Whisper Base default. No fallback LLM or online inference provider was needed: all three Mozilla pairs ran with the packaged Bergamot engine.

The stable whisper.cpp version was selected because its official release supplies a small Windows x64 CPU binary archive. Native compilation is not required on the target machine. Automatic native runtime installation currently supports Windows x64 only.

Model provenance is pinned in [models.json](../src/main/translation/models.json), including Mozilla attachment and decompressed SHA-256 values. Runtime/model hashes for Whisper are in [whisper.cjs](../src/main/translation/whisper.cjs). Availability was checked against [Mozilla's current model registry](https://mozilla.github.io/translations/firefox-models/) and [Remote Settings records](https://firefox.settings.services.mozilla.com/v1/buckets/main/collections/translations-models-v2/records), rather than relying on the archived registry. The [official whisper.cpp release](https://github.com/ggml-org/whisper.cpp/releases/tag/v1.8.2) supplies the native archive.

Mozilla/Bergamot use MPL-2.0; Whisper code/models use MIT; Kuromoji uses Apache-2.0 with the IPADIC NAIST/ICOT notice. These permit commercial use subject to their terms. Full notices and source references are bundled under `dist/main/main/translation/`; see [third-party notices](../src/main/translation/THIRD_PARTY_NOTICES.md).

## Installation and offline behavior

The first Translate downloads only the selected language's model files. The first speech request installs the verified CPU helper and selected English Whisper model. Text-only translation does not install Whisper. Models are cached under Electron's `app.getPath('userData')/translation-models` (normally `%APPDATA%/story-studio/translation-models`). The test scripts use the ignored `.translation-cache/` instead.

Downloads use fixed official hosts and expected byte lengths. SHA-256 is checked on downloaded and cached files; compressed Mozilla files are checked again after decompression. Atomic, uniquely named temporary files prevent incomplete downloads becoming valid cache entries. Network failure, missing cache, corrupt model and native failure appear as recoverable Control status. Only the current target model is resident; installed other languages remain on disk.

Offline tests set `STORY_STUDIO_TRANSLATION_OFFLINE=1`, making cache misses fail before any model download attempt. Network is needed only for initial installation or repair; speech/text is never sent to an inference service. There are no API keys or per-translation charges. Japanese formatting uses the bundled dictionary offline.

## Actual translation examples

These are unedited local model outputs, not approved translations or human reference translations.

| English input | Japanese | Italian | Romanian |
|---|---|---|---|
| Don't open the door yet. | まだドアを開けないでください。 | Non aprire ancora la porta. | Nu deschide uşa încă. |
| Wait until I say go. | 私が行くと言うまで待ってください。 | Aspetta finché non ti dico di andare. | Aşteaptă până când spun să plec. |
| Move the red block to the left. | 赤いブロックを左に動かして。 | Spostati il blocco rosso a sinistra. | Mutați blocul roșu spre stânga. |
| Mia has the sword, and Yuki has the shield. | ミアは剣を持ち、ユキは盾を持っている。 | Mia ha la spada, e Yuki ha lo scudo. | Mia are sabia, iar Yuki are scutul. |
| Kage, can you find the hidden key? | ケイジ、隠し鍵が見つかるか? | Kage, riesci a trovare la chiave nascosta? | Kage, poţi găsi cheia ascunsă? |
| If you choose the wrong door, the dragon will wake up. | 間違ったドアを選ぶと、ドラゴンは目を覚ます。 | Se scegli la porta sbagliata, il drago si sveglierà. | Dacă alegi uşa greşită, dragonul se va trezi. |

Review findings: Japanese “Wait until I say go” changes the intended cue to a statement about the speaker going; Romanian also needs review for that sentence. Italian “Spostati il blocco…” has an awkward/incorrect verb form. Japanese renders Kage as ケイジ, which needs correction if the intended name is カゲ. Negation is retained in the first example, but this six-sentence sample does not establish general accuracy. **Translation quality has not been accepted by a native-language evaluator.** Teacher review remains necessary.

The synthetic speech fixture said “Do not open the door yet. Wait until I say go.” Whisper Base returned those words correctly. The Japanese downstream error persisted, demonstrating why the transcript is kept separate from translation.

## Japanese formatting

Standard mode preserves the translated/corrected text. Kana and furigana use one local morphological analysis of that same text, not fresh model translations. Kanji-bearing tokens receive hiragana readings; ordinary katakana is preserved. Furigana renders actual `ruby`, `rt` and `rp` elements, with no HTML injection.

Under caption settings, enter exact analyzer-token overrides such as `勇者=ゆうしゃ`, one per line. Overrides apply to both kana and furigana. Unknown names may remain unconverted; edit the draft or supply a reading. Kuromoji/IPADIC is mature but old, and context-dependent/name readings are not guaranteed. A translation glossary was not added in this phase.

## Files

New production modules:

- `src/shared/translation.ts`, `src/main/translationBroadcast.ts`.
- `src/main/translation/service.ts`, `cache.cjs`, `bergamot.cjs`, `inference.cjs`, `whisper.cjs`, `models.json`, third-party notices/license files.
- `src/renderer/translation/TranslationControls.tsx`, `CaptionLayer.tsx`, `capture.ts`, `globals.d.ts`, `translation.css`.
- `scripts/prepare-translation.mjs` copies worker assets/notices for development and packaged builds.

Modified integration points: `src/main/preload.ts`, `presentPreload.ts`, `presentWindow.ts`; `src/renderer/audio/AudioController.ts`; `TeachLiveControls.tsx`, `lesson/LessonTeachControls.tsx`, `present.tsx`; `package.json`, `package-lock.json`, `.gitignore`, `tsconfig.test.json`, and the existing Presenter test's module stub. Other preexisting camera/tracking/game changes in the working tree belong to the saved checkpoint, not this phase.

Tests/evidence: `src/shared/translation.test.ts`; `scripts/translation-{cache,capture,service}.test.cjs`; `translation-smoke.cjs`, `translation-speech-smoke.cjs`, `translation-electron-smoke.cjs`, `translation-package-smoke.cjs`; this report, `docs/phase3-evidence/`, and the Phase 3 plan.

## Automated validation and performance

The existing regression suite passed **440/440** tests and the game suite passed **33/33**. Phase 3 adds **17/17** passing focused cache, capture, service, lifecycle and IPC tests, including corruption refusal, cancellation during file preparation, native shutdown ordering, model disposal before switching, retry after worker failure, shared-track ownership, 20-second cap and private-field stripping. Renderer/main TypeScript checks and Vite production compilation passed. Vite retains its existing large-chunk advisory.

Windows unpacked packaging (`npx electron-builder --dir`) passed. The resulting `release/win-unpacked/Story Studio.exe` was launched with a disposable profile and passed offline translation for all three languages, bundled Japanese dictionary loading, and native Base English recognition followed by Japanese translation. [Packaged results](phase3-evidence/packaged-results.json) contain the actual outputs. Installer creation/signing was not part of this check; the executable is unsigned.

Real model smoke tests produced all 18 examples above, reloaded all three languages with downloads disabled, generated all Japanese modes, rejected silence, and cancelled a pending inference. Whisper Base recognized a synthesized English recording and successfully translated it again offline. These are executable inference tests, not mocked model output.

The [combined Electron acceptance report](phase3-evidence/electron-validation.md) records eight passing UI checks, desktop/narrow screenshots, one microphone acquisition and one camera acquisition, no renderer page errors, and no renderer HTTP(S) requests. A synthetic green-screen portrait, real MediaPipe model, synthetic microphone speech, active lesson and published captions were used. The speech sample is approximately 4.3 seconds long.

| Measurement | Baseline (60.41 s) | Whisper + Japanese translation (60.57 s) |
|---|---:|---:|
| Camera WebGL draw rate | 29.994 FPS | 30.014 FPS |
| Face-tracking result rate | 9.998 Hz | 10.005 Hz |
| Completed utterances | 0 | 7 |
| Sampled summed Electron CPU | 10.83% | 12.85% |
| Sampled summed Electron working set | 2325.9 MB | 2405.1 MB |

Across those seven utterances, Whisper model loading took **207–290 ms**, transcription **5.98–9.35 s**, warm translation **43–58 ms**, and audio-submit-to-translation **6.78–10.34 s**. This excludes the time spent speaking and teacher review; auto/manual caption publication is additional. Warm model verification/runtime preparation cost 686–942 ms per speech request. Isolated translation worker cold loads, including cache verification/decompression, measured 1.89 s Japanese, 0.93 s Italian, and 0.67 s Romanian in the saved six-sentence run.

Camera/tracking cadence remained stable in this test. Speech latency is a material limitation for rapid live interaction. Electron CPU/memory numbers exclude the native Whisper child, were sampled between inference calls, and working sets can double-count shared pages; they are not a complete peak process-tree resource budget. The baseline was already warmed with models resident. Other development processes remained open. Small English was not benchmarked.

A separate native-process resource sample measured approximately **297–298 MB** peak sampled working set and **1.29–1.89 CPU cores** during Whisper (16.1–23.6% of this machine's eight logical processors). These are interval averages/sample lower bounds, not instantaneous peaks. The separate run overlapped packaging work, so these resource values must not simply be added to the earlier Electron figures. Raw counters and qualifications are in the [native resource evidence](phase3-evidence/electron-native-resources.json).

Raw evidence: [local model outputs](phase3-evidence/local-model-results.json), [initial speech result](phase3-evidence/speech-result.json), [combined samples](phase3-evidence/electron-results.json). The earlier text-only run is retained separately and is not the definitive benchmark because its baseline overlapped build activity.

Reproduce with `npm test`, `npm run test:translation`, `npm run check:games`, `npx tsc --noEmit`, `npm run build:main`, `npm run build:renderer`; then `node scripts/translation-smoke.cjs`. Speech/combined scripts require the documented audio/camera fixtures, FFmpeg and the Playwright runtime. Run performance sampling without concurrent builds.

## Manual acceptance procedure

1. Run `npm run build:main` and `npm run build:renderer`, then launch Story Studio normally. Open a lesson, enter Teach, and open Presenter.
2. In Audio settings select/enable the teacher microphone using the existing routing. Keep lesson music/dialogue playing and retain the usual Zoom/Meet output route.
3. Enable camera, chroma key and face tracking. Enable Translation, choose Japanese, and first test a typed sentence. Allow the initial model installation to finish.
4. Hold **Hold to talk**, speak English for 2–10 seconds, and release. Alternatively use **Start listening / Stop listening**. Review the separate private English and translated draft; correct the draft and press **Publish translation**.
5. Confirm students see only the target caption, above the camera/story. Test font size/position, kana, furigana and a manual reading correction. Switch to Italian and Romanian and repeat.
6. Start another utterance or translation, then Clear/hide, Cancel, switch target, or disable translation before completion. Confirm the old caption never returns. Test disconnecting/changing the microphone while listening; reconnect and record again.
7. After each required language and Base are installed, disconnect the network/restart and repeat speech translation. A never-installed model should show an installation error without affecting the lesson.
8. Check physical mic recognition in the real room, with music/dialogue and actual Zoom/Meet sharing. Confirm no doubled voice, feedback, soundtrack recognition or unexpected microphone gain change. Check camera/tracking while speaking, video playback, drawing, navigation and games.
9. Have fluent Japanese, Italian and Romanian speakers evaluate the example set plus real lesson terminology and numbers before enabling auto-publish. Small English is optional and has not been benchmarked; do not assume it will fit the live CPU budget.

## Limits

- Physical microphone, real-room acoustic leakage, meeting audio and native-speaker quality acceptance require manual testing. Synthetic camera/audio tests do not certify those conditions.
- A simple audio-energy gate and Whisper's own decoding safeguards reduce silence hallucinations; they are not a full voice activity/noise classifier. Acoustic lesson audio picked up by a physical microphone can still be transcribed.
- Native helper support is presently Windows x64. Small English is selectable but unmeasured and was not downloaded just to populate settings.
- Temporary utterance WAV/JSON files are deleted on success, error and graceful cancellation. A process/OS crash may leave files under the local model cache; remove stale `utterance-*`/`.tmp` entries with the app closed if needed.
- Long captions wrap but are clipped to the caption area's bounded height. Split long instructions into short utterances or reduce font size.
- This phase does not add a glossary, continuous recognition, model cache management UI, or cloud fallback.
