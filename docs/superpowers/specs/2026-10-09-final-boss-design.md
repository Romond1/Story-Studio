# Final Boss Hero integration

The visible learning stages are Adventure → Discovery → Challenge → Mastery. Internal `story`, `activation`, `game`, and `mastery` identifiers remain compatible with existing lessons. Preserve navigation order, theme, and icons.

## Architecture

Register a maintained copy of Final Boss Hero as a second local Vite HTML entry. The existing GameHost provides selection, instructions, keyboard forwarding, launch, restart, exit, and lesson return. PresentGame mounts exactly one authoritative iframe. Restart creates a new instance and unloads the old document; Control never mounts the game or serializes its battle state.

A copied entry is preferable to a React component adapter because its global styles, Zustand state, assets, and listeners already assume an independent application. Embedding the original development server would require an external process and would fail in packaged Story Studio. No second launcher or host is needed.

## Preservation and compatibility

Copy current original source and Board Dash assets without modifying the source project. Preserve all five mini-games, battle effects/progression, native editor, settings, project import/export, media, and original animations. Adapt entry/handshake, local asset URLs, storage namespace, teardown, and responsive viewport CSS. Verification also requires fixes to imported draft synchronization, default card-assignment roundtrip, and resize observation/initial fitting in the copy. Use native rendering as Language Snake does so existing wheel/pan, pointer effects, keyboard input, and card geometry retain their accuracy. Narrow layouts must retain access to all controls through scrolling when necessary; normal laptop gameplay should fit without page zoom.

Control displays Final Boss instructions and the existing lifecycle buttons. Mouse gameplay, settings, native question/card editing, and project import/export stay in Present. Reuse instance/origin-fenced keyboard messages, extending optional Shift support only if required by original shortcuts. Input from form fields and browser shortcuts remains isolated.

Final Boss uses cards and its own versioned project format, not Story Studio scene cards. Retain its native configuration instead of inventing a conversion or new editor. Its original source has no synthesized game sound/music; imported cutscene videos can have audio and use Present's existing output. Dispose media and resources on unload; conferencing output requires an actual device check.

## Safety and verification

The starting branch is `story-studio-rebuild`, HEAD `f6f6fb5`. Preserve all earlier dirty work. A complete changed/untracked-file checkpoint and tracked binary patch are stored outside the repository at `D:\Temp\story-studio-final-boss-20261009`. Baseline: 427 tests, both production component builds, and eight real Electron host acceptance groups pass.

Verify registry isolation and session parsing, original source preservation, adapter fencing, teacher/student ownership, actual gameplay and scoring for all five mini-games, battle completion, restart/exit/reopen, settings/configuration, packaged assets, native responsive geometry, and video/audio disposal. Run TypeScript checks, normal tests/builds, Snake regression, and lesson workflow regression. Preserve screenshots and report checks that need manual teaching-machine validation.
