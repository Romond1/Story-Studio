# Language Snake integration and verification

Verified on 2026-10-09 on `story-studio-rebuild`. Existing uncommitted work was preserved. No branch switch or commit was made. The original Language Snake project and Final Boss were not changed.

## Authoritative session and architecture

**Present owns exactly one interactive game runtime. Control owns selection and lifecycle.** This is an explicit teacher-controlled presentation model. Control never mounts Snake, mirrors gameplay state, or restores a second runtime from a save payload.

The shared `GameHost` displays the registry library and teacher controls for In Game and Mastery. The registry currently contains only Language Snake, supported in In Game. Mastery uses the same host with an empty library.

The maintained Snake copy is separately bundled by Vite and mounted only by `PresentGame` in an isolated iframe. Its projection contains a registered `gameId` and fresh `instanceId`, with no board, player, score, timer, question, or save state. The registration determines the local entry; no arbitrary URL is accepted.

Launch atomically registers the projection and opens/focuses Present in main. Restart changes the instance ID and destroys the previous iframe. Keyboard IPC is authenticated to Control's main frame, validated, and fenced to the current instance. The adapter checks its parent, origin, and instance ID. Forwarding waits for readiness; lesson shortcuts are suspended in the game workspace.

Closing, reloading, or crashing Present ends the run. Main suppresses the terminated projection so reopening cannot resurrect it. Control returns to selection with a notice and restores the retained lesson projection. There is no migration or fallback runtime. Load errors remove the iframe and expose Restart recovery.

## Gameplay access and workflow

1. From Beginning, click **Game**; from an open lesson, click **In Game**.
2. Click **Launch Language Snake**. Present opens the original splash/setup.
3. In Present, configure the game, click **Continue**, then **Start Game**.
4. Use existing mouse controls/settings in Present, or click **Game keyboard controls** in Control to forward keys. **Focus Present** brings that window forward.
5. **Restart game** starts fresh; **Return to game selection** opens the library; **Return to lesson** restores the lesson. Without a lesson, the return control is **Back to Beginning**.

Default controls remain WASD, arrows, 8/4/5/6, and IJKL. Teacher shortcuts, custom bindings, and grading controls remain available. Mouse input goes directly to Present's sole game.

Present is resizable. The game fills its entire client area at the window's native resolution and display pixel density, with no fixed rendering size, scaling of the iframe, or letterboxing. Desktop/windowed views wider than 880 pixels keep the original side players; narrower views show the board first and players below. The board keeps its aspect ratio with a window-height bound. The visible scrollbar is removed while wheel/trackpad, Page Up/Down, and focus scrolling in Present keep lower controls and settings accessible. Direct movement arrows keep the view steady, and native arrow editing remains available in fields. Resize retains the same game instance and camera; browser zoom changes are unnecessary.

Game entry pauses lesson video and stops lesson audio. Return preserves authored data, unsaved edits, separate Edit/Teach cursors, selected cards, temporary lesson state, and the paused video position. Position is restored even on return to the library; the temporary handoff is consumed after final lesson return. Autoplay scene audio follows the existing lesson playback behavior when returning.

## Preserved gameplay and adaptations

`gameLogic.js` and `effects.js` are byte-identical to the originals. The App retains versus/co-op, 2–4 players, crystal questions/grading, scoring, rounds/bomb battle, crowns, villain, streaks/confetti, 3D camera, key/direction customization, uploaded backgrounds/audio, and JSON saves.

App changes are limited to a Story Studio save namespace, skipping auto-restore on hosted launch, explicit **Load Saved State** buttons, and presentation classes for native responsive layout and scrollable overlays. Device loading and the JSON format remain available. The adapter adds readiness/error/input communication, viewport styling, and teardown cleanup. The DOM/SVG visuals render at native display density; the original confetti canvas already uses device pixel ratio. See [adapter notes](../games/language-snake/README.md).

## Integration files

| Area | Added or modified files |
| --- | --- |
| Registry/session | `src/shared/gameHost.ts`, `gameHost.test.ts` |
| Projection/IPC | `src/shared/presentationSnapshot.ts` and its test, `src/main/presentWindow.ts`, `preload.ts`, `presentPreload.ts`, `src/renderer/vite-env.d.ts` |
| Shared surfaces | `src/renderer/games/GameHost.tsx`, `gameHost.css`, `PresentGame.tsx`, `src/renderer/present.tsx`, `present.css` |
| Existing workflows | `src/renderer/Beginning.tsx`, `src/renderer/lesson/LessonApp.tsx`, `src/renderer/usePresentationMedia.ts` |
| Local game/build | `games/language-snake/**`, `language-snake.html`, `vite.config.ts`, `package.json`, `package-lock.json`, `tsconfig.test.json` |
| Validation/docs | `scripts/game-host-smoke.cjs`, `scripts/game-present-native-smoke.cjs`, `scripts/game-media-smoke.cjs`, this report, design/plan, `docs/game-host-evidence/**` |

Dependencies match the original installed versions: Framer Motion 11.18.2 and Lucide React 0.468.0. Unrelated existing changes are excluded from this inventory. The pre-change tracked diff and touched-file baselines are at `D:\Temp\story-studio-language-snake-20261009`; HEAD remains `f6f6fb59c5fa74b2d2d6f5e4c9167d410839a530`.

The subsequent native size/resolution change has a separate touched-file checkpoint at `D:\Temp\story-studio-game-edge-20261009`. Setup/question/result overlays remain scrollable without visible bars; question flip faces grow to fit long authored prompts. A read-only browser geometry review verified default and long prompts at 390 and 600 pixels, preserving the flip/backface styles without text overlapping grading controls.

## Actual checks

| Check | Result |
| --- | --- |
| `npm test` | PASS: 427 tests, zero failures |
| `npx tsc --noEmit` | PASS |
| `npm run build:renderer` | PASS; main bundle exceeds Vite's 500 kB advisory threshold |
| `npm run build:main` | PASS |
| Node adapter input tests | PASS: 7/7 |
| Unchanged upstream gameplay helpers, temporary Vitest | PASS: 52/52 |
| `scripts/game-host-smoke.cjs`, production Electron | PASS: 8/8 groups, zero renderer errors |
| `scripts/game-present-native-smoke.cjs`, production Electron | PASS: native windowed, portrait, large and maximized views at 1× and 2× device pixel ratio; resize retains the same live game; hidden-scrollbar wheel/settings access |
| `scripts/game-media-smoke.cjs`, production Electron | PASS: 6/6 scenarios, zero renderer errors |
| Existing `scripts/reconstruction-smoke.cjs` | PASS: 9/9 groups, zero renderer errors |
| Independent spec and code/security review | PASS after fixing launch race, viewport layout, and media handoff |

Gameplay acceptance used original controls and a read-only observer, with no mutation of game state: mouse/forwarded movement, alternating turns, crystal growth, answer reveal, scoring, and restart. It checked sole ownership across windows, repeated Present opening, detached old frames, stale input rejection, dirty lesson/cursor retention, close/reopen, native reload, isolated renderer crash, and intentionally failed HTML loading followed by recovery.

Read-only Chromium WebAudio observation recorded running contexts, oscillator/gain creation, and context destruction. Display checks covered desktop/narrow Control and Present at 960 × 600, 600 × 900, 1920 × 1080 and native maximize, at both 1× and 2× device pixel ratio. Assertions verified no iframe/viewport scaling, no side gaps or horizontal overflow, no scrollbar width allocation, default full-playfield bounds, retained instance/live state, and genuine wheel/settings interaction. The 2× profile produced a 3824 × 2122 screenshot for a 1912 × 1061 CSS-pixel client viewport. Native camera dragging moved the pan exactly 30 pixels for a 30-pixel pointer drag. Control overflow/overlap audits passed. Native-resolution evidence, including the failing fixed-frame baseline, is in [native-resolution](game-host-evidence/native-resolution/).

Direct Present keyboard checks at both display densities moved the Teacher snake from (13, 9) to (13, 10) using Arrow Down without scrolling the viewport. Textarea Arrow Right moved the caret from 0 to 1; Page Down/Up and wheel retained settings navigation. The pre-fix 40-pixel movement-key scroll is preserved as RED evidence.

Video checks covered library-only visits, launch, restart, return in Edit, return to selection, and relaunch. Every case retained the same paused video position/scene and unchanged fixture JSON. Existing lesson regression covered editing/import, cards/bubbles, Present composition, rewards, Activation, video/overlays, separate cursors, undo/redo, drawing/transitions, and save/reopen.

Missing launch controls, narrow-layout defects, media handoff defects, and missing atomic launch were observed before fixes. Red evidence is retained alongside final JSON results, logs, and screenshots in [game-host-evidence](game-host-evidence/).

## Limitations and manual checks

- Closing, reloading, or crashing Present ends the run by design. Relaunch starts fresh; manual save loading remains available.
- Settings/mouse interaction use Present. Control provides lifecycle and keyboard controls, with no second interactive view.
- Snake audio uses its original Web Audio system in Present and that window's default output. It does not enter Story Studio's custom device mixer. Physical audibility, specific devices, and conferencing/system-audio capture need manual verification in the intended setup.
- Full co-op, 3–4 player sessions, all uploaded-media formats, and complete crown/villain/endgame paths were not exhaustively playtested. Their source systems are retained and helper tests pass; the two-player versus collection/question/scoring path was exercised in Electron.
- Renderer/main production outputs were tested. A packaged installer was not built or installed.

## Adding another game

Create a local HTML adapter implementing the same readiness/error and session-fenced input protocol, then add its Vite entry. Register its ID, title, description, entry, modes, and supported sections in `gameRegistry`. Games render within the native Present viewport and provide their own responsive layout and display-density-aware canvas sizing when needed. Choose `['mastery']` or both sections when appropriate. The same GameHost/PresentGame will launch it; add game-specific controls only when required. Do not register selectable placeholders. Chess and other games have not been added.
