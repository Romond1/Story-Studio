# Card and Booster workflow simplification — 8 October 2026

Implemented in the current workspace, preserving the existing uncommitted Card V2/Edit work. Changes are uncommitted for review.

The old ordinary path was Library → Card → Faces → Set → Recall Activity → Booster → separate layout editing. The new path is select a Story slide, Video overlay, Break, or supported Booster canvas → **+ Card** → type. Creation, attachment and selection happen together. Empty Booster sequences receive a Card canvas automatically. No Set, Library visit, Legacy Board or explicit activity setup is required.

The audit found that definitions, face authoring, Sets, validation, rendering/text fitting and session commands already existed. The missing piece was host attachment: Card V2 only rendered as a standalone Booster activity. The implementation adds compatible host references and optional instance appearance. A private placement/activity container uses the existing engine without creating another runtime. The library and Recall & Reveal remain available.

Canvas cards support pointer selection, bounded logical drag/resize, independent or linked duplication, clipboard copy/paste, removal and layer ordering. Clicking the canvas background returns to host controls. The contextual inspector edits face text, names, order, duplication, safe deletion, images, initial/reveal faces and interaction settings. Appearance defaults to this placement; shared content edits are labelled, and reused cards show a sharing notice with an independent-copy action. Face previews remain visible in Edit even when the authored card starts concealed.

Sets are optional through Add from Cards / Sets and the inspector's Set/group/activity controls. Linked duplicates retain content references and independent live instances. Independent duplicates and clipboard pastes receive new card, face and instance identities and preserve placement appearance/settings. Clipboard data is copied at Copy time. Independent Booster slide copies get separate slide/placement/activity/card/face identities while retaining portable asset references. They are stored with lesson slides, explicitly labelled independent, and leave the original unchanged. Legacy board references within a copied slide remain linked to their legacy library content.

Boosters use the normal Content / Presentation / Audio / Lesson tools shell. The sticky header exposes **+ Card**, the named Booster/item position and **Back to Story**. The chooser, previous/next controls and horizontal timeline support selection, insertion after the current item, duplicate, reorder and remove. Add Booster content offers Card canvases, imported images/videos, prompts, existing slides with reuse/independent choice, and existing Breaks. Placeholder game creation is hidden in the new ordinary workflow. Returning restores the retained Story location; Edit navigation never selects the live presentation.

The live Card V2 module stays frozen during Edit. Returning to Teach reconciles authored changes into the same occurrence authorities while retaining valid live faces, concealment and selection; authored geometry and layer order apply. Present receives only validated passive render plans, with scoped media URLs and readiness aggregation. Simple private card containers enable face controls automatically. Structured Set activities retain their existing start/reset workflow.

Verification passed:

- **323/323** existing and new tests (`npm test`). New coverage includes atomic host creation, invalid-ID rollback, linked/independent copies, face remapping, clipboard preservation, geometry bounds, Booster sequence commands, real save/open attachments/styles, live reconciliation and safe overlay projection/readiness.
- Renderer TypeScript (`npx tsc --noEmit -p tsconfig.json`), renderer build, main build and whitespace checks.
- Browser acceptance on disposable fixtures: Story and empty Activation quick-add; text/answer faces; drag/resize; independent duplication; Booster drag; clipboard across contexts; independent slide reuse; sequence duplicate/reorder/remove; image insertion; Prompt, Video and Break cards; undo/redo; save/reopen; Back to Story; Teach face changes and a separate passive Present renderer; live face isolation during Edit; invariant viewBox under resizing. Desktop and narrow screenshots are in `docs/card-booster-evidence`.
- Episodes 1–6 opened through the real main loader; all project-file hashes stayed unchanged. Existing legacy persistence and session tests passed. No production episode files were edited or converted.

No failing verification remains. Browser acceptance uses mocked application IPC and disposable media; final native Electron multiwindow/hardware-audio usability remains hands-on. The existing desktop toolbar still needs horizontal space at very narrow widths. No new Bubble editor, matching/ordering engine or multiselect card grouping was introduced. Set grouping currently acts on all cards in the current canvas; the library retains advanced individual Set editing.

Manual review checklist:

1. On an Episode 7 Story slide press **+ Card**, type a question, add/name Answer, and edit its text.
2. Drag/resize, try a placement style, duplicate independently, then undo/redo. Copy/paste onto another host.
3. Open Lesson tools → Boosters → Activation, add a Card, position it, then use the sticky **Back to Story** button.
4. Try Add Booster content → reuse a Story slide, then make an independent copy. Check the original, new copy and shared-card notices.
5. Save/reopen, switch to Teach, select a card and change its named face in Present. Change editing context and confirm the live target stays put.
6. Teach an existing legacy episode and verify its familiar controls/rendering.

Interaction references used briefly during the audit: [Canva element creation/duplication](https://www.canva.com/es_us/help/add-elements/), [Genially interactive question canvas/configuration flow](https://help.genially.com/en_us/how-to-add-interactive-open-ended-questions-in-genially-ry9CGSqB2), and the familiar PowerPoint selected-object canvas model. These informed the one-action creation and contextual editing approach.
