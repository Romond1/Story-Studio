# Final Boss Episode Editor Implementation Plan

**Goal:** Author Final Boss in Present using shared episode assets and normal episode persistence.

**Architecture:** Extend the current validated module transport. Core imports/registers media and saves canonical state; the game owns previews and editing only.

**Tech Stack:** React, TypeScript, Zustand, Electron IPC, Node test runner.

- [x] Protocol: add editor-request/list/import/save and typed editor-response; test malformed and stale request handling in existing protocol/bridge tests.
- [x] Core: extend useEpisodeModuleHost with editor callbacks; LessonApp reuses importMedia, mergeLessonMediaImport, media registry and normal save/flush. Reject stale episode/run operations and surface cancellation/failure.
- [x] Projection/session: accept refreshed media maps, preserve stable IDs, retain rejected drafts and guard mode switches. Run hostedAdapter.test.cjs.
- [x] UI: add HostedMediaPanel and reusable assignment target; use existing upload callbacks for all authored media fields; responsive panel layout and explicit episode save status.
- [x] Compatibility: stage standalone import and unresolved-media recovery, keep standalone actions separate, leave gameplay unchanged.
- [x] Verification: run npm test, npm run check:games, renderer/main typechecks/builds; exercise editor import, save/reopen and package boundaries with evidence. Record limits honestly.

Do not commit. Work in the existing checkout to preserve and build on the user's extensive integration changes.
