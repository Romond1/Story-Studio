# Language Snake implementation plan

> **For agentic workers:** Use subagent-driven development with independent file ownership and review.

**Goal:** Launch the original playable Language Snake from In Game with exactly one Present-owned runtime and preserve the lesson.

**Architecture:** Control owns selection/lifecycle; Present owns the sole interactive iframe. Immutable registered IDs and instance IDs cross the existing projection channel. Keyboard packets are authenticated and fenced by instance ID.

**Tech stack:** Existing React 18, TypeScript, Vite, Electron; locally copied Snake React source with Framer Motion and Lucide.

## Tasks

- [x] Vendor the three Snake runtime files under games/language-snake, add isolated iframe entry, parent readiness/error and input bridge, and a responsive viewport. Preserve mechanics and original source folder. Add the local Vite entry and dependencies. Verify build and original/copy differences.
- [x] Add src/shared/gameHost.ts registry/session/input types and tests. Extend src/shared/presentationSnapshot.ts with `{ kind: 'game', occurrenceId, gameId, instanceId }`. Reject unknown games, malformed IDs, and stale commands. Run test first and verify the expected rejection failure before adding the parser.
- [x] Extend authenticated Present IPC and preloads for keyboard forwarding and game lifecycle acknowledgements. Implement src/renderer/games/PresentGame.tsx, mounting exactly one iframe by instance ID. End game on Present close/crash/reload; never migrate or mount in Control. Verify unit tests and main build.
- [x] Implement src/renderer/games/GameHost.tsx and gameHost.css using existing studio tokens. Connect Beginning Game/Mastery and lesson phase navigation. Pause lesson media/audio while game is active, retain lesson state, suppress lesson shortcuts, restore projection on exit. Mastery uses the shared registry but has no available game yet.
- [x] Add scripts/game-host-smoke.cjs real Electron acceptance for sole runtime, launch, gameplay, keys, restart, close/reopen, errors, exit, lesson preservation, and desktop/narrow fit. Run `npm test`, `npx tsc --noEmit`, `npm run build:renderer`, `npm run build:main`, and existing regression smoke. Capture evidence in docs/game-host-evidence.
- [x] Review integration for spec compliance then code quality. Document architecture, changed files, preserved Snake behavior, exact launch workflow, ownership and input/audio limitations, checks and future registry additions in docs/game-host-verification.md.

No branch switching or unrelated commits. All code changes stay limited to the integration. No Final Boss work.

## Presentation size and resolution follow-up

- [x] Replace the fixed-size, transformed iframe with a full-width/full-height native viewport. Remove the registration's fixed render dimensions and the adapter's second scale.
- [x] Hide visible scrollbars while keeping lower controls and settings reachable. Adapt desktop/portrait layout and scrollable overlays, preserving board aspect ratio and game state during resize.
- [x] Verify actual Electron windowed/maximized geometry, sole retained session, native 1x/2x display density, full playfield, real camera dragging, and settings access. Preserve the failing fixed-resolution baseline and final screenshots.
