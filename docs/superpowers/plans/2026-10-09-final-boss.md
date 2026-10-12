# Final Boss Hero Implementation Plan

> **For agentic workers:** Use superpowers:subagent-driven-development for independent adapter work and review. Root owns shared host and labels; adapter worker owns copied game files.

**Goal:** Make Final Boss Hero playable in Present through Mastery, with Control information and the four renamed teaching stages.

**Architecture:** Extend the existing registry and Vite inputs. Copy and minimally adapt the original app in an isolated iframe, retaining one authoritative Present runtime and existing lifecycle/lesson handoff.

**Tech Stack:** Electron, React 18, TypeScript, Vite, existing Playwright Electron acceptance; original Zustand, GSAP, and tsParticles runtime dependencies.

## 1. Preserve and validate baseline

- [x] Save tracked patch, HEAD/status, and every changed/untracked file to the external checkpoint.
- [x] Run `npm test`, renderer/main builds, and `node scripts/game-host-smoke.cjs` before implementation: 427 tests and eight acceptance groups pass.
- [x] Inspect current original source, assets, gameplay, native editor, store, input, media, and responsive behavior without writes to original.

## 2. Extend shared registry and module copy

Files: `src/shared/gameHost.ts`, `gameHost.test.ts`, `src/renderer/games/GameHost.tsx`, `src/renderer/Beginning.tsx`, `src/renderer/lesson/{LessonApp,LessonTimeline,SceneInspector}.tsx`, existing smoke selectors.

- [x] First change registry test to expect `getGamesForSection('mastery').map(g => g.id)` equal `['final-boss-hero']`, and parse a registered Final Boss session while dropping copied gameplay state. Run the compiled gameHost test and observe the missing-registration failure.
- [x] Add `{ id: 'final-boss-hero', title: 'Final Boss Hero', entry: 'final-boss-hero.html', sections: ['mastery'], modes: ['Memory Reveal', 'Match Pairs', 'Lane Battle', 'Open Box', 'Board Dash'] }` with a concise battle description.
- [x] Use visible Adventure/Discovery/Challenge/Mastery labels and the requested descriptions while retaining all internal IDs and original icons. Update related timeline/context labels and stale smoke assertions, without editing legacy data structures.
- [x] Add Control instructions for native Present mouse gameplay, Episode Setup, Edit Mode/project configuration, mini-game keys and teacher shortcuts. Preserve existing host controls.
- [x] If needed, test optional `shiftKey` forwarding and modifier exclusion, then propagate it through the existing parser/forwarder/adapter without changing older packets.

## 3. Add maintained native game entry

Files: `games/final-boss-hero/**`, `final-boss-hero.html`, `vite.config.ts`, `tsconfig.final-boss.json`, package manifests.

- [x] Copy current original source and required Board Dash assets; record original hashes. Replace absolute `/board-dash/` asset references with bundled imports. Namespace storage under Story Studio.
- [x] Add `finalBossHero: path.resolve(__dirname, 'final-boss-hero.html')` to the existing Vite input list. Install original used versions only (Zustand, GSAP, tsParticles React/slim/engine).
- [x] Test the adapter's parent/origin/instance validation, readiness/error reporting, and teardown before implementing the entry. Reuse Snake input validation when practical.
- [x] Mount original App once through an error boundary and readiness effect. Keep media shutdown, React unmount, animation cleanup, and input listener disposal in pagehide.
- [x] Add native compatibility CSS that fits laptop layouts, retains card/board ratios, allows narrow views and overlays to scroll, and does not transform the iframe or entire app. Add standalone TypeScript coverage for copied source.
- [x] Document preserved gameplay/configuration and exactly which upstream files differ.

## 4. Verify real workflow and review

Files: `scripts/final-boss-smoke.cjs`, `docs/final-boss-evidence/**`, `docs/final-boss-verification.md`, `README.md`.

- [x] Build production renderer/main and run `npm test`, `npx tsc --noEmit`, and `npx tsc -p tsconfig.final-boss.json`.
- [x] Exercise actual Electron UI: select Mastery, launch, verify no Control runtime, play all five mini-games using native/forwarded input, verify scoring/intermission/victory, restart, exit, return, close/reopen, native editor and import/export.
- [x] Capture desktop/laptop/narrow Control and Present screenshots, inspect element overflow and packaged asset loading, test pointer wheel/pan and keyboard fencing, and video/audio resource disposal.
- [x] Update old Snake smoke's now-populated Mastery expectation and rerun game-host/native/game-media acceptance plus lesson reconstruction/usability checks.
- [x] Request independent spec and quality review against the checkpoint; fix concrete findings and rerun affected checks.
- [x] Write concise report with original-project immutability evidence, verification results, config workflow, file inventory, and manual device limitations. Leave the integrated work reviewable in the current checkout.
