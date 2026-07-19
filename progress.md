# Story Studio Audio Repair Handoff

Last updated: 2026-07-19<br>
Branch: `rebuild-from-v20.1`<br>
Audio work: commits `95f427f` through `b3401b2`

## Goal

Route the teacher microphone and Story Studio lesson audio together to the Mix / Virtual Output for Zoom, while headphones monitor lesson audio without playing the teacher's microphone by default. Preserve all existing episode `project.json` files.

## Implemented

- One central Web Audio graph and lifecycle owner in `src/renderer/audio/AudioController.ts`.
- Broadcast mix contains microphone plus media. Monitor mix contains media, with microphone monitoring off by default.
- Transactional Monitor and Mix device replacement, duplicate-route prevention, restart/disposal, meters, warnings, diagnostics, and test tones.
- Versioned audio preferences stored in the application settings file, outside episode JSON.
- Full Audio workspace opened from the top toolbar.
- Configurable compact Audio controls in the stage sidebar.
- Custom in-window microphone, monitor, and mix device menus. Native Electron `<select>` popups were removed because they were unreliable.
- Device-choice feedback now shows `Connecting: [device]` immediately. A failed route shows the exact error instead of silently returning to System Default.
- `Stop All Audio` mutes every bus without destroying the selected microphone route.
- Packaged `file://` asset loading fixed with a relative Vite base.

## Main files

- `src/renderer/audio/AudioController.ts` — graph, routing, playback compatibility, meters, diagnostics, persistence commands.
- `src/renderer/audio/AudioSettingsWorkspace.tsx` — full Audio workspace and device selection UI.
- `src/renderer/audio/CompactAudioPanel.tsx` — configurable lesson-stage controls.
- `src/renderer/audio/audio.css` — Audio workspace and compact-panel styling.
- `src/shared/audioSettings.ts` — versioned settings and safe defaults.
- `src/shared/audioLifecycle.ts` — transactional route replacement and disposal.
- `src/shared/audioRoutingPlan.ts` — broadcast/monitor routing contract.
- `src/shared/audioDiagnostics.ts` — warning and engine-state derivation.
- `src/shared/audioDeviceMenu.ts` — stable device-menu option and pending-selection model.
- `src/main/main.ts` and `src/main/preload.ts` — application-level audio-settings persistence and IPC.
- `src/renderer/App.tsx` — toolbar Audio entry and compact-panel integration.

## Tests and evidence

- Latest automated gate: 76 tests passed; renderer and main builds passed.
- Packaged Windows build succeeded at `release/Story Studio Setup 1.0.0.exe`.
- Packaged runtime selected and persisted the real CABLE Input device ID; diagnostics reported the Mix stream active with samples flowing.
- A deliberately delayed route displayed `Connecting: ...` until success.
- A deliberately rejected route retained the previous route and displayed the exact device-open error.
- Five production episode candidates loaded read-only in the packaged app. Their before/after SHA-256 hashes were unchanged.
- Detailed paths, hashes, and hardware checklist are in `docs/manual-audio-release-checklist.md`.

## Still requiring physical confirmation

Do not treat the complete audio defect as physically accepted yet. The user must confirm this setup by listening and using Zoom:

1. Microphone Input: teacher microphone.
2. Monitor Output: headphones.
3. Mix / Virtual Output: `CABLE Input (VB-Audio Virtual Cable)`.
4. Zoom microphone: `CABLE Output (VB-Audio Virtual Cable)`.
5. `Monitor my microphone` must remain off during normal teaching.
6. Confirm headphones contain lesson audio but not the teacher's voice.
7. Confirm Zoom receives both teacher speech and lesson audio once, without doubling or waviness.

If device selection fails, copy the red `Could not use ...` message and the Audio diagnostics. Do not replace the selected device with System Default merely to hide the error.

## Important handoff notes for Claude

- Start with `git show 95f427f..b3401b2` and the two documents under `docs/superpowers/` listed below.
- Preserve the compatibility boundary: audio preferences must not be written into episode `project.json` files.
- Do not modify or discard unrelated uncommitted workspace changes. This handoff covers only the Audio implementation.
- Audio commits intentionally staged only Audio-related hunks where files overlapped unrelated work.
- Installed Story Studio and development Electron launches have used separate settings profiles (`%APPDATA%/story-studio` and `%APPDATA%/Electron`). Check which executable/profile is being tested before interpreting saved-device behavior.
- Run `npm run check:release` after any change. Run `npm run build` before handing over a Windows installer.

## Supporting documents

- `docs/superpowers/specs/2026-07-18-audio-engine-and-interface-redesign.md`
- `docs/superpowers/plans/2026-07-18-audio-engine-and-interface-redesign.md`
- `docs/AUDIO-TROUBLESHOOTING.md`
- `docs/manual-audio-release-checklist.md`
