# Mini-game Break editor — Phase 2

## Implemented controls

The existing Break Inspector now offers Classic Break and Mini-Game Break. Its registry-backed game selector lists Spinning Wheel, Magic Hat and Mystery Cards. Only the wheel has an editor; the other two have a clear Coming Soon message.

Wheel controls include a title, activities to play, questions to play, the resulting event count, and alternating/randomized/teacher-selected sequence options. Alternating starts with a question; inconsistent quotas receive a draft warning. These options are authored settings only, not gameplay behavior.

The Activity pool lists questions and events independently of session length. Add/remove outcomes, give them optional labels, choose existing question Cards, create/edit Cards through the existing editor, and write event instructions. Each new outcome gets an initial segment, but segment assignment is separately editable: add/remove segments, associate each with any pool activity, and optionally override its label. Multiple segments may point to one activity without increasing plays. For example, 15 outcomes and 15 or 16 segments can still specify six activities, three questions and three events.

Draft messages identify missing Card selections, insufficient question/event outcomes assigned to the wheel, unused pool activities and incompatible alternating quotas. Drafts remain saveable. Removing a pool activity removes only its segments and sequence references; session length and source Cards are retained.

## Static preview and existing editing

The Edit canvas shows a static wheel and a session summary within the existing logical frame. It reflects title, labels, segments, pool size, session length and sequence choice. Labels are drawn radially; dense wheels above 24 segments keep per-segment SVG descriptions and summary counts instead of overlapping visible labels. There are no timers, random draws, spinning controls or effects.

The Edit review board / Wheel preview toggle retains access to normal scene editing. Edit Card opens the existing face/text/image editor and scene placement; Back to wheel preview returns to the wheel. Existing content is referenced by Card-definition ID, with no second question-text store. Editing a shared Card updates its existing uses, as explained beside the control. When a referenced Card has no placement in this Break, Edit Card adds a linked placement to use the same editor. New Card adds a standard Card and placement and assigns its reference in the same history transaction. Undo and independent scene duplication retain existing behavior.

## Architecture and compatibility

Phase 1 was inspected before implementation. Its selector replaced data on mode/game changes, its settings validator understood only a legacy explicit sequence, and its duplication logic had no segment or inactive-draft knowledge. These were the necessary integration changes.

- Wheel configuration version 2 stays in `MiniGameConfig.settings` and `activities`, using the existing registry. `WheelSettings` contains title, play count, question count, sequence mode and stable segment-to-activity references.
- Version 1 remains loadable/resolvable. Its wheel settings upgrade on explicit authoring changes; activities, labels, Card references and legacy sequence metadata are preserved. Phase 1 runtime regressions now explicitly construct version-1 fixtures, so they continue testing the original runtime contract even though new wheel defaults are version 2.
- `BreakExperience.savedMiniGames` stores inactive authoring drafts, including while Classic is selected. Mode changes and game changes restore the matching setup. Classic rendering ignores these saved drafts. No question content is copied into them; question activities continue to reference Cards.
- Independent duplication regenerates supported configurations' activity, segment and sequence identities and remaps references to Cards copied by the scene command. This applies to active and retained drafts, including while another game is selected. External Card definitions stay shared if they are not copied scene placements. Linked scene copies share authoring as before.
- Unknown types, future versions and malformed bounded JSON remain retained and show controlled fallback text. Unknown configuration internals are copied unchanged, without applying wheel-specific remapping. The editor validates structure before deriving a preview.
- Version-2 configurations deliberately cannot enter the version-1 gameplay runtime. The session action helper safely returns without applying actions when no compatible runtime is available. Teach/Present retain Phase 1 placeholders, rather than executing a runtime that would ignore the new session quotas.

## Files changed in this phase

New:

- `src/shared/lesson/spinningWheel.ts`: typed/validated wheel settings, explicit v1 authoring upgrade, pool operations, draft diagnostics, labels and supported-schema copy remapping.
- `src/renderer/lesson/MiniGameBreakEditor.tsx`: experience selector, registry choices, wheel setup, pool, segments and Card-editor links.
- `src/renderer/lesson/SpinningWheelPreview.tsx`: static editor-only SVG composition in `LogicalSceneFrame`.
- `src/renderer/lesson/miniGameEditor.css`: scoped styles using existing lesson colors, spacing, fields and controls.
- `src/shared/spinningWheelEditor.test.ts`: ten Phase 2 tests.
- `scripts/spinning-wheel-editor-smoke.cjs`: actual Electron authoring/save/reload/duplicate/undo/fallback checks and visual/control audit.
- This report, `docs/superpowers/specs/2026-10-25-mini-game-break-editor-design.md` and `docs/superpowers/plans/2026-10-25-mini-game-break-editor.md`.

Extended from Phase 1:

- `src/shared/lesson/miniGameBreak.ts`: wheel registry version/defaults/validation, retained drafts, non-destructive switches and copy helpers.
- `src/shared/lesson/commands.ts`: active/inactive draft duplication after copied Card identities are known.
- `src/shared/lesson/miniGameRuntime.ts`, `src/shared/lesson/session.ts`: prevent the legacy runtime from executing new settings; handle unavailable initialization safely.
- `src/renderer/lesson/SceneInspector.tsx`, `src/renderer/lesson/LessonApp.tsx`: editor integration, existing Card workflow, static preview and review-board toggle.
- `src/shared/miniGameBreak.test.ts`: explicitly retain version-1 fixtures for legacy runtime regressions.
- `tsconfig.test.json`: include the new test file in the existing runner.

Existing uncommitted Phase 1 changes were retained. No unrelated source systems were modified.

## Verification

- `npm test`: **678 passed, 0 failed**, including ten new Phase 2 tests and all 668 Phase 1/baseline tests.
- The new tests cover a 15-outcome/six-play/three-question model, independent segment count, removal behavior, draft diagnostics, mode/game restoration through JSON persistence, v1 upgrade, active/Classic/other-game duplication, unknown/future/malformed preservation, quota validation, deferred v2 gameplay and actual portable export/import of both active and inactive v2 settings, labels, events and Card references.
- `npm run build:renderer`: passed; Vite emits its large-bundle advisory.
- `npm run build:main`: passed.
- `npx tsc --noEmit -p tsconfig.json`: passed.
- `node scripts/spinning-wheel-editor-smoke.cjs`: passed. Covers native title/count/sequence editing, existing and new Card face text, labels/events/segment association, non-destructive mode/game switching, review-board access, duplicate/undo, save/reload, Classic and unknown/malformed fallback. No renderer page errors; the narrow editor has named controls, no panel overflow and no undersized inputs.
- `node scripts/mini-game-break-smoke.cjs`: passed, preserving Classic and existing Edit/Teach/Present placeholder behavior.
- Desktop and narrow screenshots inspected: `output/playwright/spinning-wheel-editor/{desktop,narrow,narrow-controls}.png`.
- Read-only review found two issues (malformed preview input and opaque future-config remapping); both were fixed with regressions. Re-review found no remaining clear correctness or data-loss issue.

## Remaining placeholders and issues for the next phase

Magic Hat and Mystery Cards configuration remain Coming Soon. Present still uses the existing safe placeholder. No spinning, outcome selection, reward application, animations, or complete gameplay is implemented.

The next runtime must explicitly implement session caps, quotas and sequence choices. Multiple segments for one activity may eventually affect selection chances, but the distinct activity still counts as used once; this phase stores the mapping without implementing probability. Reward idempotency and Card reveal behavior remain the Phase 1 extension decisions. Event instructions are ordinary authored text, with no executable action or reward payload.

No commits or pushes were made. Phase 3 was not started.
