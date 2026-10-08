# Edit workspace modernization — implementation and verification

## Delivered

- Modern Edit is the default layout. The top bar's **Legacy layout** switch preserves the existing layout for migration/parity comparison; the preference is local to the application, never the project.
- Shared fitted presentation viewport, interactive Stage and keyboard/pointer resizable divider. Edit defaults to 60% canvas; Teach keeps its separate split preference. Focus canvas reduces the right workspace temporarily.
- Content, Presentation and Audio inspector categories appear where relevant. Existing controls move via React portals, retaining their handlers and owner state. Portal pointer handling excludes controls outside the canvas boundary.
- Lesson tools exposes the existing Sections/structure, Boosters, Boards, Movement, Badges and Relics interfaces. The top-bar tool selector is replaced only in modern Edit. Import, project operations, Save, undo/redo, mode switching, Present and global audio/status stay reachable.
- Both modes use a vertically resizable lesson navigator (176px default). Following user feedback, expanding it packs slides into two or three rows within each section; read left to right across a row, then down. Compact height retains one row. Drag the horizontal separator above the timeline, or focus it and use Up/Down/Home/End. Edit and Teach remember separate heights. It follows section order and the existing slide order within sections; breaks are explicit and booster sequences use their actual item identities/types. Section jump, wheel/trackpad browsing, current/live labels and Edit multiselection use existing authority/commands.
- No project schema, lesson content semantics, audio engines or structural mutation commands were added or replaced.

## Existing capability destinations

| Existing capability | Modern destination |
| --- | --- |
| Image adjustments, video trim/playback, tags | Content |
| Selected bubble typography/template/text rectangle/lock/flips | Content (select a bubble first) |
| Story-attached boards and card overlay configuration | Content → Story Scene Attachments |
| Transitions, direction, duration, apply to slide/section | Presentation |
| Drawing controls, bubble add/list/duplicate/copy | Presentation; direct canvas interaction remains active |
| Dialogue, SFX, slide BGM, video audio, Section Music | Audio |
| Break title/questions/media/background/timer/music/duplicate | Content → existing Break Editor; Section Music also in Audio |
| Section/slide rename, reorder, delete, add section/break | Lesson tools → Sections / structure; original context-menu commands retained |
| Booster sequences and item authoring | Lesson tools → Boosters for sequence structure; Content for selected item |
| Boards and reusable cards | Lesson tools → Boards, existing central editor |
| Movement, Badges, Relics | Lesson tools; badge properties remain in Content |
| Project/media import, Save, undo/redo, Present, audio settings | Existing global toolbar and drop/context commands |

The complete source inventory and production acceptance checklist are in [edit-workspace-inventory.md](edit-workspace-inventory.md). Legacy layout is deliberately retained until that checklist is exercised on production data.

## Automated evidence

- `npm test`: 247 tests passed, zero failures.
- `npx tsc --noEmit`: passed.
- Renderer and main builds: passed.
- `scripts/edit-workspace-browser-test.mjs`: passed with a synthetic 16-slide/two-section/one-break fixture and mocked Electron IPC. Checks 17 timeline items on one row at compact height, denser rows and reduced scroll width after resizing in both modes, row-major ordering, fitted aspect ratio, tags/transition/bubble values reaching Save, video trim pointer input (synthetic duration metadata), break-thumbnail drag at canvas scale, contextual categories, lesson-tool access, focus, vertical timeline resizing in both modes, independent saved heights, keyboard resizing, mode switching, modern/legacy fallback switching, and narrow layout. Zero page errors and no document horizontal overflow at 390px.
- Browser script is optional and uses the existing Playwright installation via `PLAYWRIGHT_MODULE`, `CHROMIUM_PATH`, and `STORY_STUDIO_URL`. Run `npm test`, start `npm run dev:renderer`, then `node scripts/edit-workspace-browser-test.mjs` with those environment overrides if needed. Run from the repository root. It does not open or save production projects.
- Evidence is in `edit-workspace-evidence/`: desktop, presentation, break, video and narrow screenshots; JSON assertions; test/build logs. Narrow mode stacks canvas, inspector and timeline; the existing global toolbar scrolls horizontally.

## Acceptance limits

Browser Save checks inspect data passed to the mocked save boundary, not real disk persistence. Video trim uses synthetic metadata to isolate pointer wiring, not decoded production video. Production save/reopen, real audio devices, and a separate Electron Present window were not exercised here. These remain the manual acceptance gate. Existing legacy layout code remains available; no claim of full production parity is made.



## Edit video preview follow-up

Edit video playback now uses the existing local MediaView decoder regardless of the remembered Present canvas geometry. Only Teach receives the separate Present renderer's video stream. Switching to Edit clears the remote media intent and releases its receiver through the existing lifecycle; local video continues to use the shared audio manager and authored trim/audio settings.

Removed the Edit toolbar's Present preview button and obsolete normal-teaching recovery button. Present launch/status remain in Teach. No extra window is required for Edit video preview.

Verification: renderer typecheck, renderer build and all 247 tests pass. Browser regression decodes a generated WebM locally while Present is unavailable, repeats playback after a simulated Present-close event, and checks Teach-to-Edit recovery. The IPC lifecycle is mocked; this is not a real Electron window-close test. Existing trim-pointer/save checks also pass.
