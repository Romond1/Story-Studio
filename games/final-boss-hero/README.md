# Final Boss Hero in Story Studio

This is a maintained copy of the current working source at `D:\AI\SET OUT\TWIN STAR\GAME\Final Boss Hero`, whose Git HEAD was `f0aa8a1`. The original contained later uncommitted gameplay/editor changes when copied. The original directory was read only throughout integration. `upstream-manifest.json` records SHA256 and byte size for all 29 source files and seven public assets before adaptation.

## Hosting and controls

Choose **Mastery → Launch Final Boss Hero** in Control. The shared GameHost mounts one iframe in Present, using `final-boss-hero.html`. Mouse gameplay, setup, native editing, and media run there; Control contains information, Focus Present, Restart, exit, and the existing keyboard relay. Control never mounts the application or copies its Zustand battle state.

In Present use **Intro / Setup** in the Mini-Game selector or **Reset Battle** to pick a hero, review the cards, and start. The original starts with Memory Reveal visible; its setup screen remains available through those controls. Match Pairs accepts arrows, Enter/Space to select, and Escape to undo the first pick. Shift+M toggles pointer highlighting and Shift+N switches its palette. Wheel zoom and middle-button pan retain their original coordinates. Host-level Restart creates a fresh iframe/session, while the game's Reset Battle retains edited encounter content and clears battle progression.

## Preserved gameplay

All original mini-games, styles, card animations, pointer effects, dice, particle VFX, scoring, progression, cutscenes, and editor are retained.

| Game | Existing behavior |
| --- | --- |
| Memory Reveal | Four rounds, growing from three to six memorized cards; teacher advances preview/hide/guess/reveal and selects each side's answer. Correct guesses score one point. |
| Match Pairs | Alternating manual turns reveal two tiles. Matching duplicate cards award one point; play ends when every pair is found. Mouse and keyboard selection are available. |
| Lane Battle | Each side chooses and plays a card; the higher lane value wins one point. Spent hands refill between configured rounds. |
| Open the Box | Both sides choose different boxes and reveal together. Twelve boxes contain random gain, loss, steal, or empty outcomes; play continues until exhausted. |
| Board Dash | Alternating dice rolls race tokens around the board. Card tiles present oral questions, movement tiles show camera actions, and the teacher marks challenges complete. Bonus/back/steal/roll-again tiles remain intact. |

Mini-game results apply the encounter's HP/energy resolution rules, update cumulative scores, and show intermission. Default winning damage is 25 plus twice the score difference; draws damage both sides by six. Shields block damage. Intermission advances around the configured mini-game order until hero/boss HP reaches zero, producing victory, loss, or simultaneous draw.

## Existing educational configuration

**Switch to Edit Mode** exposes the original cards, front/back text and media, game assignments, Board Dash questions/actions, intro heroes, boss, backgrounds, cutscenes, rewards, power-ups, round settings, HP/energy, damage rules, and pointer settings. Save/Save As/Load use the original versioned `.fbh-project.json` format; local saves and **Load Last Local** remain available.

Story Studio lesson content is not automatically converted into the game's distinct card/encounter schema. Teachers use the retained editor and project import rather than a new question editor or curriculum system. The original `difficulty` setting is stored but unused by game mechanics; configured round count affects Lane Battle while Memory Reveal uses four rounds. These upstream behaviors were preserved.

## Integration changes

- `main.tsx`, `hostBridge.mjs`, and `final-boss-hero.html` replace the standalone bootstrap. The original unused `src/main.tsx` is retained for provenance. The game mounts once, reports ready/error to its owning Present, and reuses Language Snake's parent/origin/session-fenced input validator.
- `src/data/boardDashAssets.ts` imports the unchanged PNGs so Vite hashes/bundles them for HTTP and packaged file URLs. Asset URLs in `src/miniGames/plugins/boardDash.tsx` and `src/components/EditModeShell.tsx` use those imports.
- `src/store/battleStore.ts` namespaces its three localStorage prefixes under `story-studio.final-boss-hero.*`. Its import sanitizer also preserves omitted optional card game assignments as the original "all games" default; explicit empty assignments retain their distinct meaning. The project format and game logic remain unchanged.
- `src/components/EditModeShell.tsx` protects a newly imported/selected source from the previous card or cutscene draft. Upstream source-to-draft and draft-to-source effects could overwrite imported content or enter a React update loop; native editing/autosave remains available after import. Explicit empty game assignments also remain empty through native card edits; only omitted assignments default to all games.
- `src/components/BattleShell.tsx`, `src/components/zoomMath.ts`, and the added `observePlayArea.ts` fit initial/resized content using the original zoom model, then retain explicit teacher wheel/pan choices between resizes. A new game/setup starts measurement at its natural width so it can recover from a previous dense board's small zoom; same-game round/content changes retain manual choices. Dense imported Board Dash layouts can fit below the original .28 minimum; other mini-games retain that minimum, and wheel steps/max zoom remain unchanged. Geometry observers coalesce updates into animation frames and remain stable across view changes, avoiding synchronous layout feedback during observer delivery. Pending geometry work is cancelled on unmount.
- `viewport.css` adds native responsive layout, narrow-view scrolling, simultaneous memory choices/target and Lane Battle areas, and accessible overlay heights without altering upstream `src/styles.css` or applying a whole-game transform. Game frames use `overflow: clip` so browser focus cannot leave hidden scroll offsets that shift the entire playfield; visible information/editor scrolling remains available. Intro / Setup retains natural text width and its original vertical scrolling, bounded to the actual play viewport so every hero, vocabulary card, and Start Battle stays reachable. Open Box uses intrinsic row heights and a logical four-card width so the fixed text HUD remains readable while its portrait cards fit. Board Dash measures its complete board and projection space. `boardProjection.ts` derives horizontal/bottom gutters from the original perspective/tilt; its plugin exposes only those sizing variables, preserving the tile-size formula, board aspect ratio, perspective and dice. Original card and board aspect ratios remain intact.
- Pagehide removes adapter listeners, pauses/releases all audio/video sources, cancels document animations, clears this iframe's GSAP timeline, and unmounts React. Original hook cleanup disposes its timers/listeners and particle components.

The source copy is 560,467 bytes before adaptation. Its seven PNG assets total 1,994,991 bytes; the original duplicate `assets/` directory was not copied. Runtime dependencies actually used are React/React DOM, Zustand, GSAP, tsParticles React, and tsParticles slim/engine. Declared upstream dotlottie and `@gsap/react` packages are unused and were not introduced.

## Verification and limitations

Run `npm run check:games` for production TypeScript coverage and the game adapter regressions. The copied game includes host ownership/readiness/teardown tests, real store export/import checks, real React same-ID card/cutscene import followed by native input/autosave checks, observer scheduling/cleanup tests, initial/resized fitting/manual zoom checks, and Board Dash projection regressions tied to measured native 48/60-tile layouts. Each compatibility failure was reproduced before its fix. Upstream Vitest test files were copied for provenance but are excluded from this production-only typecheck and require the upstream test dependencies to run.

Run `node games/final-boss-hero/hiddenScroll.smoke.cjs` separately for the native Electron/Chromium focus-scroll regression. It needs Playwright installed, `STORY_STUDIO_PLAYWRIGHT` pointing to its package directory, or the bundled Codex runtime. It focuses a real game choice inside the copied frame styles and verifies that hidden containers cannot retain scroll offsets. Full native window resizing and gameplay are checked by `scripts/final-boss-smoke.cjs`.

Original sample artwork and cutscenes use remote `placehold.co` URLs, and the stylesheet requests a Google font. Those defaults retain the original network dependency; imported/uploaded images and bundled Board Dash art can be local. There is no synthesized music or sound-effect implementation in the original. Imported cutscene videos can carry audio through Present's existing output; portrait videos are muted. Actual conferencing audio routing needs a teaching-machine test.

At narrow widths gameplay sits above the fighter information, which can be reached by scrolling. Critical game content automatically fits using the original zoom system; teachers can still zoom/pan. Desktop/laptop gameplay uses native DOM layout. Production Electron acceptance passed all five mini-games through completion, battle victory/new battle, project roundtrip/editing, native setup scrolling and mouse controls, and media/lifecycle cleanup with zero page or console errors. Gameplay was checked at 1366×768, 800×600, and 390×844, including growing Memory rounds, 48/60-tile boards, wheel/Reset, and dense-board recovery to Memory and setup. The [verification report](../../docs/final-boss-verification.md) links native screenshots and lesson/Snake regression evidence. Actual OS save/load picker completion and conferencing audio routing remain manual checks.
