# Language Snake adapter

The maintained gameplay copy comes from:

`D:\AI\SET OUT\TWIN STAR\GAME\LANGUAGE SNAKE\language-snake-duel-app\src`

The original project has not been modified. `gameLogic.js` and `effects.js` are byte-identical copies. `App.jsx` preserves gameplay, controls, settings, effects, and save-file format, with these integration changes:

- Device saves use `story-studio-language-snake-save-v1` to avoid sharing the original standalone application's save key.
- A hosted launch with `?instanceId=...` skips automatic device-save restoration. Restart therefore initializes a fresh game. The new **Load Saved State** buttons explicitly restore a device save; original JSON import/export remains available.
- Presentation classes adapt the layout to the actual window: full-width content, the board first in smaller windows, an aspect-ratio-preserving board height bound, and scrollable setup/question/result overlays.

`language-snake.html` is a Vite production entry. `main.jsx` mounts exactly one copied `App`, without React StrictMode remounts. The host creates this iframe only in Present. The Control window forwards input to that one authoritative game session rather than mounting a second game. Runtime state stays in the iframe; game snapshots are not copied between windows.

The Game Host fills Present with an unscaled iframe at its native client width and height. There is no fixed 1280 × 800 rendering surface, resolution cap, or letterboxing. Chromium renders the DOM/SVG board, text, and controls at the display's device-pixel density; the original confetti canvas already uses `devicePixelRatio`. Resizing changes layout within the existing iframe without restarting the game or resetting its camera. Pointer deltas use native coordinates.

The game viewport and interactive overlays hide their scrollbars while keeping wheel, trackpad, Page Up/Down, and focus scrolling available in Present. Movement arrows prevent browser scrolling outside editable fields, so direct play does not shift the view; field editing retains native arrow behavior. This keeps lower actions and setup panels reachable. The board retains its configured aspect ratio and is bounded by window height at the default camera; deliberate camera zoom/pan can still move parts of it outside the view. Audio initializes through the game's existing user interactions. Frame destruction and `pagehide` cleanup remove its React tree, listeners, music, and browsing context. Conferencing output routing still requires verification in the user's actual audio setup.

The host sends `{ channel: 'story-studio-game', type: 'input', instanceId, key, code, phase, repeat }`. The adapter accepts only its parent window, the same origin (including the packaged app's `null` file origin), the active instance ID, and valid keyboard phases. Modifier combinations are rejected. The adapter replies with the same channel and instance ID, `type: 'ready'` after mounting or `type: 'error'` with `detail` on failure.

Run bridge validation with:

```powershell
node --test games/language-snake/inputBridge.test.mjs
npm exec --yes --package=vitest@2.1.9 -- vitest run games/language-snake/gameLogic.test.js
```

The original `gameLogic.test.js` is copied unchanged. Its 52 tests pass using temporary `npm exec` Vitest, without adding Vitest to Story Studio's dependencies. The input bridge's seven Node tests also pass. Browser/Electron interaction checks are documented separately in the project's integration report.
