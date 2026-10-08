# Card V2 C1–C4 completion report

2026-10-08. C0/C0.5 were accepted before this work. C1–C4 are implemented; optional C4.5 Story overlays are deferred. No migration or C5/C6 work was performed.

## Architecture and schema

`src/shared/cardsV2.ts` defines a bounded, independently versioned optional `ProjectData.cardsV2` module (`engine: card-v2`, `version: 1`). Cards contain stable-ID faces, labels, tags, template and style. Faces support text, image, image/text, image/prompt and supporting-text layouts. Sets contain ordered references to shared card definitions. Recall & Reveal activities contain a logical frame, independent instances, initial/reveal face references, concealment defaults and cycling permissions. Placements reference activities; explicit `cardActivityRef` booster items reference placements.

No A/B schema is repurposed. Unsupported versions, unknown fields and invalid references fail validation on load/save before disk writes. Opening a legacy library does not create a V2 module. Existing main-process legacy persistence keeps authored legacy blocks separate from normalized runtime data.

`CardSessionAuthority`, hosted only by Control through `useCardV2Session`, owns occurrence state. Tokens guard session, project, occurrence, navigation revision and command revision. Project/module changes invalidate runtime state. Re-entering an occurrence preserves that occurrence's state; another occurrence is independent. Runtime state is never saved as authored content.

## Authoring

Edit → **Cards / Sets** opens the project library. Templates include text, image/text, picture recall, question/answer/explanation and vocabulary. Authors can add, rename, reorder, duplicate and remove faces; referenced face deletion is blocked. Image assets use the existing project importer. Tags and search remain available.

Shared edits show usage information. **Duplicate and edit** creates independent definitions and face IDs. Set duplication preserves card references. Creating an activity copies Set membership into independent instances; subsequent Set membership edits do not rearrange existing activities. Activity duplication remaps placement/activity/instance IDs. Authors can add linked instances or independent copies, choose initial/reveal faces, set cycling behavior and use frame presets or custom dimensions.

The activity editor supports dragging, resize handles, numeric geometry and an 8-unit grid. Five style presets and five shapes provide bounded appearance controls. Auto-fit uses explicit line breaks, grapheme-safe wrapping, bounded font search and a bounded cache. Overflow produces an author warning without ellipsis; manual font sizing remains available. Emphasis applies to a whole text block rather than arbitrary rich HTML.

Fresh projects use V2 for forward card authoring. Legacy boards/overlays remain accessible for projects containing legacy cards.

## Runtime and Present

**Add to booster** creates an Activation item. Teach supports Start, select, named-face switching, previous/next face, selected/all reveal targets, selected conceal/uncover, reset face, reset activity and return to the story checkpoint. Face selection and concealment are independent. Circular cycling is opt-in. There is no scoring or answer interpretation.

`cardV2Render.ts` resolves visible faces into a student-safe render plan containing geometry, style, text lines, font metrics and image slots. Edit, Control and Present use the same `CardV2Scene` SVG primitive. SVG text advances and logical viewBox geometry remain fixed as windows resize; the scene scales uniformly instead of reflowing.

Present receives only the resolved projection. Concealed content and inactive faces are excluded. Present neither selects faces nor creates a session. Face transitions are short opacity changes, respect reduced motion and do not replay on initial mount/reload. The existing snapshot relay, asset-readiness reporting and recovery path are reused.

## Verification

- **290/290 tests passed**, compiled into `D:/Temp/story-card-v2-tests` to avoid replacing existing tracked test output.
- New domain coverage: validation, stable references, duplication, shape defaults, independent instances, stale commands, activation, cycling permissions and reset.
- New render coverage: multilingual/grapheme wrapping, explicit newlines, overflow/manual fit, bounded fit work/cache isolation, concealed data, safe media, malformed projection rejection and snapshot geometry.
- Integration coverage: booster target resolution, return checkpoints, missing placements, projection and recovery.
- Persistence coverage: V2 round-trip beside legacy data, current A/B saves, legacy story/section and booster refs, no implicit V2 creation, future versions/engines and invalid-save disk preservation.
- `npx tsc -p tsconfig.json --noEmit`, `npm run build:main`, `npm run build:renderer`: passed.
- `node scripts/card-v2-browser-test.mjs`: passed. Chromium exercises the actual renderer with mocked Electron IPC and synthetic project data, plus a separate passive Present page.
- `node docs/card-v2-implementation/audit-legacy.cjs`: passed for all six episodes. Every episode had **zero changed authored card blocks** after disposable-copy save/reopen; all six original source hashes were unchanged. Stop Condition B reproduction remains resolved. See `legacy-preservation-audit.json`.

Production Episodes 1–6 were read only. No production episode file or schema was modified. The working checkout already contained unrelated changes; these were preserved.

## Manual release checklist

Automated browser verification completed creation of four named faces, image selection, reorder, tags, numeric resize, drag and resize handles, frame selection, card/Set/activity duplication, linked instances, shared-content isolation, booster insertion, save, Edit/Teach switching, reveal/conceal/reset, independent state and return to story. Desktop/narrow library and landscape/portrait Present screenshots are in `evidence/`; `browser-results.json` records saved data and projection.

The following native Electron checks remain manual because the browser harness mocks the desktop bridge:

- [ ] Open a disposable Episode 7 folder in Electron; import an actual image and verify it on Control and the native Present window.
- [ ] Save, close and reopen that folder; confirm definitions, face references, image and geometry persist.
- [ ] Move native Present to a second monitor; resize/reload and confirm matching geometry and current face.
- [ ] Visually smoke-test disposable copies of Episodes 1–6, including existing legacy boards and overlays.

## Deferred scope and limits

Optional Story card overlays are prepared at the domain/render level but not connected to Story scenes: that requires host-scene geometry integration beyond the primary Booster slice. No separate Story renderer or runtime was introduced. Fonts use the configured system fallback stack; SVG fixes line advances, but exact glyph appearance can vary with installed fonts. Extremely dense content can still require author adjustment, surfaced by fit warnings.

C5/C6, migration tools, games, scoring, audio additions and richer document-like face content remain out of scope. Implementation stops here for review.
