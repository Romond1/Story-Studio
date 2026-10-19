# Final Boss Hero episode editor integration

## Architecture audit

The existing episode source of truth is `LessonApp`'s canonical document and `ProjectHistory`. `useEpisodeModuleHost` validates configuration revisions and commits authored activity configuration. Main-process `ModuleTransport` and `PresentGame` validate the active episode/run and relay commands; they do not create another persistent game document. Final Boss's hosted projection resolves media for the runtime and reverses that projection to stable asset references before proposing configuration.

Already connected before this work: hosted authored configuration, revision acknowledgements, normal save/export flushing, module asset dependency collection, scoped media resolution, and portable packaging. The shared dependency collector already covers character/intro media, card images, backgrounds, cutscenes, reward icons and power-ups. Discovery uses episode scene/card media; Challenge uses the same hosted module transport and media resolver. Runtime scores and reward-use state remain outside authored configuration.

Disconnected before this work: the editor refused hosted uploads, lacked a shared asset browser, received only initially referenced media, and exposed temporary preview URLs in fields. Standalone creation methods inserted remote placeholder images rejected by episode validation. Failed configuration acknowledgements could strand drafts; configuration export failure could dispose the editor. The standalone Save/Save As/Load/localStorage paths were separate and are still retained only for legacy standalone operation.

The chosen implementation extends these existing boundaries. A replacement game editor or an independent persistence/media store was rejected because either would duplicate working infrastructure and threaten gameplay compatibility.

## Delivered behavior

- Persistent Episode Media Pool in Present with search, media filters, thumbnails, selected state, preview, native import and refresh. Core catalogue changes also propagate to an active Present game.
- Desktop media/workspace/navigation layout; compact wrapping navigation and a collapsible media panel for smaller windows.
- Existing media fields retain their original update callbacks and now support typed assignment, drag/drop, import and clearing without deleting shared assets. This includes intro portraits/videos, both characters, card images/front/back, all backgrounds, cutscenes, power-ups and rewards. Board Dash retains its card references, medallions and action controls without adding unrelated media fields.
- Imports use Story Studio's native import service, episode asset registration, registry grants, history/dirty state and portable dependency infrastructure. Repeated assignments share one asset ID. Temporary and historic preview URLs are mapped back to stable IDs and never saved as authored media.
- Save episode in Present invokes the existing episode save path and waits for acknowledged configuration. Rejected drafts remain editable; unsafe mode/close transitions are guarded. Lost-ack revision recovery and nonfatal configuration-export errors support retry.
- Advanced standalone configuration import under Settings stages authoring separately from battle runtime. Unavailable references are shown and must be replaced or explicitly cleared before applying. The original episode is untouched until application; the source file is not modified.
- Missing physical media remains in the catalogue with a warning and can be reassigned. Failed and cancelled imports/saves are reported. Existing empty fields and built-in art remain supported.

## Verification

See `final-boss-episode-editor-evidence/results.json` and the repeatable native script `scripts/final-boss-episode-editor-smoke.cjs`.

Native Electron checks passed for existing asset assignment; importing image/video from Present; automatic catalogue updates after Control import; all media-consuming editor sections; card drag/drop; clearing without deletion; cancelled imports; 1440, 960 and 600px layouts with no horizontal document overflow; a real Memory Reveal round; Edit/Play and Present reopen; full application restart; portable export/import in a fresh offline profile with original source folders unavailable; injected atomic-save failure with byte-for-byte preservation of the prior disk file and successful retry; and missing-file warning/replacement. No page errors were recorded.

Unit/regression coverage includes strict protocol boundaries, matching responses and disposal, revision recovery, new-asset projection, historic URL recovery across imports, retained rejected drafts, runtime isolation, placeholder-free hosted creation, standalone-import staging, cancelled/stale/busy operations, and missing-media response validation. Renderer/main builds and TypeScript checks passed. Existing standalone editor-import tests remain passing.

Final gates: `npm test` passed 580/580; `npm run check:games` passed 59/59; the native editor script passed 14 workflow checks. Build output retains the existing Vite large-chunk advisory.

The independent reviewer found the lost-ack retry issue; it was reproduced, fixed and covered by a regression test. Subsequent native testing found the undefined-preview serialization issue for missing files; it was also reproduced and fixed with a regression test.

## Compatibility and scope

No gameplay algorithm, card-pairing rule, timing or battle-resolution rule was replaced. The native play check exercised Memory Reveal; the other mini-games rely on the existing regression suite rather than new exhaustive native playthroughs.

Existing scene-format lessons are prepared automatically in place when entering Mastery or Challenge. Episode schema is unchanged. Portable export retains its existing requirement for an adventure-definition snapshot. External/embedded standalone media is recovered explicitly rather than silently downloaded or discarded. The existing importer has no content-hash deduplication, so separately importing identical files can still create separate assets; reusing a registered asset never copies it.

The workspace's pre-existing uncommitted changes were preserved. No commits, merges or pushes were made.
# Direct Story Studio launch correction

Mastery and Challenge now prepare the current saved lesson in its existing folder and always launch the hosted game. The user no longer enables shared media, selects a conversion destination, or creates an activity before launching. A missing activity and occurrence are created automatically. Entering games without a project creates an ordinary draft, with the normal first-save location picker only when that draft is saved.

For existing scene lessons, the main process validates the active project identity, preserves the original project.json in the private migration-backups directory, and atomically writes the episode envelope in place. Media files and asset IDs remain unchanged. Unsaved authored lesson content is included. The renderer activates the upgraded project through the existing activation mechanism. This supersedes the earlier limitation below requiring manual scene conversion.

Verified through the actual saved-scene → Mastery → Launch Final Boss Hero route: shared media, edit/save in the same folder, restart, portable export/import, missing media recovery, and save-failure retry. All 15 native workflow checks passed with no page errors; all 581 shared tests passed; renderer/main builds and renderer type checking passed. Evidence: `docs/final-boss-direct-launch-evidence/results.json`.


