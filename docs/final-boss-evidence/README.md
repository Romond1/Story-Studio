# Final Boss Hero acceptance evidence

Run `node scripts/final-boss-smoke.cjs` after production renderer and main builds. The harness launches real Electron with a temporary profile and a newly generated two-scene lesson; it never opens or saves user lessons. Playwright is resolved from the repository, `STORY_STUDIO_PLAYWRIGHT`, or the bundled Codex runtime. FFmpeg creates a disposable VP8/Vorbis cutscene for the audio checks.

Gameplay uses real mouse, double-click, wheel, middle-button drag, and Control keyboard input. The original `render_game_to_text()` and `__battleStore.getState()` are used only to observe state. No game actions, `setState`, scores, random generator, or gameplay timers are injected. A native project fixture is imported through the existing file input; the existing editor changes the name, question, difficulty and HP. The OS folder picker and game Save As file-picker/write boundary are substituted, while the game serializer, import sanitizer, controls, host IPC and rendering remain real.

A separate fresh game tries the actual sandbox Save As download and native Load chooser without substituting either API. It observes both Playwright downloads and Electron's real `will-download` event, choosing a temporary destination through `DownloadItem.setSavePath`. It records the original editor status and console errors before classifying a result. If Save As remains pending, it closes the disposable Present window and tries Load independently in a fresh instance. OS picker selection that cannot be driven by these APIs remains a precise manual limitation, distinct from the substituted serializer/editor roundtrip.

`smoke-results.json` is written only after every assertion passes. `smoke-failure.json` records partial successes and the actual failed assertion. Screenshots include registry selection, each mini-game completion, laptop/narrow Present, desktop/narrow Control, and the restored dirty lesson.

`node scripts/final-boss-smoke.cjs --layout-preflight` is a separate diagnostic run. It selects each game through the native menu and records all fifteen desktop/laptop/narrow layouts in `layout-preflight.json`, with computed CSS, zoom, critical content bounds, and hidden wrapper scroll offsets. It continues collecting geometry after a failed layout and never writes `smoke-results.json`; the default full acceptance stops at the first failed assertion. The full run also checks all growing Memory Reveal rounds after real wheel zoom and Reset View.

`--host-preflight` separately checks imported cutscene playback, host lifecycle, lesson restoration and real file access without waiting for the five-game playthrough. It writes `host-preflight.json` with `diagnosticOnly: true`; it does not substitute for full acceptance.

`--dense-board-preflight` is a separate strict regression for supported 48- and 60-tile Board Dash projects imported through the native JSON editor input. It starts each board through the original controls, checks every tile and the projected board at all three sizes, then uses real wheel zoom and Reset View to verify fit restoration. From the final dense narrow board it returns through the native menu to Memory Reveal and Intro / Setup, verifying ordinary layouts recover their normal fit floor. At each size it uses the bounded native Setup scrollport, real wheel input, hero selection, vocabulary enlargement/Close and Start Battle clicks. A portrait card taller than the scrollport may be partially visible; its native click point must remain inside the port and hit-test to that control. Gameplay, tile and scrollport container bounds remain strict. `dense-board-results.json` is written only after every dense and recovery assertion passes; this test does not replay a 60-tile dice race or replace the five-game acceptance.

Reports record the actual loaded game JS/CSS URLs. Temporary CSS experiments are explicitly diagnostic, saved separately as `layout-preflight-css-experiment.json`; final `smoke-results.json`, `dense-board-results.json` and `layout-preflight.json` use the unchanged production build without injected styles.

Final validated assets: `finalBossHero-CqRSEr3q.js` and `finalBossHero-FG71rKIN.css`. All three runs completed with zero page errors, console errors or failed layout assertions.

| Run | Final result |
| --- | --- |
| Full acceptance | 15 pass groups; 33 game and 3 Control geometry checks; 37 total layout records |
| Dense board and Setup recovery | 20 geometry and 9 native control hit/bounds checks; 31 total layout records |
| Baseline layout preflight | All 15 game/viewport layouts pass; 17 total layout records |

The suite covers the shared host singleton, Control readiness and no Control iframe, all five original mini-games, scoring and intermissions, a genuine battle victory, original restart, stale input rejection, exit/reopen/Present close, independent lesson cursors, retained unsaved card edits, bundled Board Dash images, modifier forwarding, native zoom/pan mapping, and imported cutscene audio decoding and disposal. The imported content fixture assigns its cards to all mini-games through the game's supported project schema; Memory Reveal still uses its original four rounds.

Sample artwork retains the original `placehold.co` network dependency. Narrow Present intentionally scrolls peripheral fighter panels below the visible gameplay area. Physical audibility and conferencing output need a manual listening check; Chromium media observations prove decoding and runtime lifecycle, not speaker or conferencing setup.
