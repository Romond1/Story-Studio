# Final Boss Hero integration and verification

Work is on `story-studio-rebuild`, starting at HEAD `f6f6fb5`. Existing dirty work was retained. A full changed/untracked-file checkpoint, tracked binary patch, status, and HEAD are stored at `D:\Temp\story-studio-final-boss-20261009`. No original lesson or original Final Boss project was edited. Source and asset SHA256 provenance is recorded in `games/final-boss-hero/upstream-manifest.json`.

## Result and workflow

The four visible stages are **Adventure → Discovery → Challenge → Mastery**, preserving original icons, order, theme, and internal `story`/`activation`/`game`/`mastery` identifiers. Existing lesson formats and authored scene names are preserved.

Open **Mastery**, then **Launch Final Boss Hero**. The same GameHost/registry used by Challenge and Language Snake launches one authoritative game iframe in Present. Control contains instructions, keyboard forwarding, Focus Present, Restart game, Return to game selection, and Return to lesson. Closing Present ends the run; restarting/reopening creates a fresh instance. No second game runs in Control and no battle state enters lesson saves.

In Present, select **Intro / Setup** or use **Reset Battle** to choose a hero/start the encounter. Mouse gameplay, questions, and native game settings remain in Present. Match Pairs supports arrows, Enter/Space, and Escape; default pointer shortcuts Shift+M/Shift+N also work from Control's keyboard area. Configured Ctrl/Alt/Command shortcuts use native Present input because the Control relay reserves browser modifiers.

**Switch to Edit Mode** opens the retained Final Boss content editor. Cards, question/action text, front/back media, heroes/boss, power-ups/rewards, HP/energy/damage, backgrounds/cutscenes, rounds, and settings are preserved. Native Save/Save As/Load and named local saves use the existing game project format. Story Studio scene cards and Final Boss cards use different schemas, so automatic lesson-content conversion is outside this phase; teachers use the existing game editor or load a game project.

## Files

| Area | Added or modified |
| --- | --- |
| Copied game | `games/final-boss-hero/**`: original source/tests, seven Board Dash PNGs, provenance manifest, entry, lifecycle bridge/tests, native viewport CSS, README |
| Bundling/checks | `final-boss-hero.html`, `vite.config.ts`, `tsconfig.final-boss.json`, `package.json`, `package-lock.json`; original used dependency versions, `check:games`, release-check coverage |
| Existing shared host | `src/shared/gameHost.ts`, `gameHost.test.ts`, `src/renderer/games/GameHost.tsx`, `gameHost.css`; registration, Control information, optional Shift input |
| Shared game input | `games/language-snake/inputBridge.mjs`, its tests, and `main.jsx`; backward-compatible Shift forwarding and updated visible Challenge label |
| Visible module copy | `src/renderer/Beginning.tsx`, `src/renderer/lesson/{LessonApp,LessonTimeline,SceneInspector,SceneMenus}.tsx`, `src/shared/lesson/commands.ts`, `src/renderer/audio/AudioSettingsWorkspace.tsx`, `README.md` |
| Acceptance/evidence | `scripts/final-boss-smoke.cjs`, existing module-selector smoke scripts, `docs/final-boss-evidence/**`, design/plan and this report |

## Automated verification

| Check | Evidence/result |
| --- | --- |
| Pre-change dependency baseline | 427 tests, both production builds, eight real Electron Snake host groups passed before modification |
| `npm test` | 428 tests passed, zero failures |
| Story Studio renderer TypeScript | `npx tsc --noEmit` passed |
| Copied game TypeScript | `npx tsc -p tsconfig.final-boss.json` passed |
| `npm run check:games` | 33 tests passed plus copied-game typecheck: input/lifecycle, native modifier preservation, default project roundtrip, real React same-ID card/cutscene import + subsequent editing, explicit no-game assignments through selection/edit/export, deferred resize observation/cleanup, automatic fitting/manual zoom preservation, and dense Board Dash projection/fit; regressions failed before fixes |
| `npm run check:release` | Passed all 428 shared and 33 game checks (461 total) plus both production builds; renderer rebuilt and game checks repeated after the final CSS-only setup adaptation |
| Hidden scroll regression | Standalone native Chromium check passed: focusing descendants cannot move the three clipped game frames; reproduced failing before the CSS repair |
| Production renderer and main builds | Passed; existing main-bundle size advisory remains |
| Original project preservation | Fresh SHA256 comparison of all 36 recorded original source/assets: zero mismatches |
| Independent review | Spec and quality review passed, including editor import/assignment repairs, lifecycle fencing, viewport fitting, dense-board projection math, game-context initialization, and the native setup scroll surface |
| Dense-board and setup recovery | Final packaged build passed 12 strict projected-board/every-tile audits for native 48/60-tile imports at three sizes before/after wheel + Reset; ordinary Memory and native setup recovery also passed, including real scrolling, hero selection, vocabulary enlargement/Close, and Start clicks. 31 layout records, zero page/console/layout errors in `docs/final-boss-evidence/dense-board-results.json` |
| Five-game layout preflight | Final packaged build passed all 15 desktop/laptop/narrow layouts, including every Board Dash tile; zero page/console/layout errors in `docs/final-boss-evidence/layout-preflight.json`, with no injected styles |
| Final Boss full Electron acceptance | 15 groups passed and 37 layout records at 1366×768, 800×600, and 390×844. All five games were completed through real mouse/keyboard controls with scoring, HP/intermission progression, genuine Hero victory and Start New Battle. Native wheel/pan, Control Shift shortcuts, audio decode/Close/restart cleanup, stale-input rejection, singleton ownership, exit/reopen/Present close, dirty edits and independent lesson cursors passed. Zero page/console/layout errors in `docs/final-boss-evidence/smoke-results.json` |
| Packaged assets | Final acceptance loaded `finalBossHero-CqRSEr3q.js` and `finalBossHero-FG71rKIN.css` through production file URLs for every game instance; all seven unchanged bundled Board Dash PNGs loaded |
| Snake host regression | Eight groups passed: gameplay/scoring, singleton ownership, restart/stale input, lesson state, close/reopen, reload/crash, failed-load recovery |
| Native Snake rendering | Passed at DPR 1 and 2, default/portrait/large/maximized windows; direct keys, mouse/settings, state retained on resize |
| Lesson media return | Six scenarios passed with paused video positions retained |
| Lesson reconstruction | Nine groups passed: scene cards/bubbles, rewards, Present composition, Discovery, editing/undo, live video, return, drawing/aspect/save/reopen |
| Authoring/teaching usability | Ten groups passed: sections/Breaks, splitters, pointers/drawing, live drag, reset, cross-phase copy/move, text editing, save/reopen |
| Timeline/selection regression | Twelve groups passed: media drags, sections, multiselect, ordered copy/cut/paste across Adventure/Discovery, transformed selection, intermediate Present drawings, save/reopen |
| Beginning/module workflow | Fifteen groups passed, including all four labels, direct authoring, imports, save, navigation, Present, and legacy guards; desktop/narrow launcher visual audit has no overflow/clipped cards |
| Theme/visual regression | Three groups passed; corrected a smoke timing race by waiting for the actual disabled CSS state rather than inspecting during its transition |

The copied game required compatibility repairs found during verification: stale editor drafts could overwrite imported cards/cutscenes and trigger a render loop; importing a default project could drop omitted all-game card assignments; selecting/editing a card assigned to no games could re-enable all assignments; synchronous layout observation could warn and leave gameplay clipped in smaller windows; hidden scroll containers could retain focus offsets after resize. The copy now protects new source identity, preserves optional and explicit-empty assignments through editing, defers geometry updates with automatic initial/resize fitting, and clips visual frames without browser scrolling. Reset restores automatic fitting after manual zoom. Game/setup transitions restore natural width before fitting so an earlier dense-board zoom cannot collapse the next game's controls; manual zoom remains available within a game. Intro / Setup retains its original scrolling inside a viewport-sized surface, with real hero, vocabulary and Start controls verified at all three sizes. Native Open Box rows preserve portrait card ratios without shrinking its HUD into a narrow column. Board Dash measures its complete projected board using gutters derived from its original perspective and tilt; large imported boards alone can automatically fit below the original minimum zoom. Tile count, tile dimensions, aspect ratio, perspective, scoring, and input coordinates are preserved. Native content editing and wheel/pan remain available. Independent spec and quality review approved these changes, and final production gameplay/resize/media acceptance passed. Earlier CSS experiments are explicitly diagnostic and do not contribute to the passing acceptance result.

## Audio and practical limits

Final Boss's upstream source has no synthesized music or sound effects. Uploaded cutscene videos can contain audio and play through Present's existing system output; portrait videos stay muted. The adapter pauses/releases media and tears down its isolated document on exit/restart. Actual conferencing/virtual-device routing and human listening require a teaching-machine check.

The original editor's JSON serializer, native file-input import, export/re-import, and subsequent editing are exercised automatically with only the operating-system save-picker/write boundary substituted. Separate attempts leave both picker APIs unmodified: Save As remained pending with unsaved status and no Electron/browser download event; native Load handled cancellation. Choosing an actual OS save destination and loading through that native picker remain manual checks. These attempts do not prove a successful native save or a download fallback.

The original sample artwork/cutscenes reference remote `placehold.co` URLs and the original stylesheet uses a Google font. Those defaults retain their network requirement; uploaded images and the bundled Board Dash art can be local. Original difficulty remains stored but mechanically unused; Memory Reveal has four fixed rounds and Lane Battle uses configured round count. Narrow windows keep native input geometry and require scrolling to lower fighter/settings panels. Large imported boards fit automatically, with native wheel/pan available for closer inspection. No browser zoom is required.

## Remaining work

Implementation and automated gameplay/regression verification are complete in the current checkout. The remaining manual checks are successful OS-picker Save As/Load selection and physical/conferencing audio output on the teaching machine. Files, configuration workflow, exact checks, screenshots and those limits are recorded above and in `docs/final-boss-evidence/README.md`.
