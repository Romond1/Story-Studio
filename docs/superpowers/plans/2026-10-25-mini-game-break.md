# Mini-game Break Implementation Plan

**Goal:** Add only a backward-compatible architectural foundation.
**Architecture:** Optional scene authoring data, central static registry, pure occurrence runtime, existing scene projection and surface placeholders.
**Tech stack:** TypeScript, React, node:test, existing Electron snapshot transport.

- [x] Add failing `miniGameBreak.test.ts` cases for absent Classic defaults, preservation and identity, invalid/unknown configs, deterministic transitions, occurrence isolation and projection parsing. Run `npm test` to confirm missing foundation exports.
- [x] Add `lesson/miniGameBreak.ts` for versioned authoring and registry and `lesson/miniGameRuntime.ts` for deterministic transitions and inert result intents.
- [x] Extend model, validation, episode/media whitelists and scene-copy reference remapping. Preserve unsupported bounded JSON for fallback.
- [x] Extend session cache/defaults/actions and scene projection/parser. Add minimal Inspector mode selector and shared logical-frame placeholder.
- [x] Run `npm test`, renderer/main builds and renderer TypeScript. Review diff and write architecture/validation report. Do not commit or push.
