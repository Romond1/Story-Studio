# Phase 1 architecture

The supplied Phase 1 brief authorizes three bounded workstreams. Production
episodes are read-only; their hashes are recorded before work. Existing Phase 0
and undo/history changes remain in this checkout.

## 1A: isolated audio experiment

A separate browser harness uses Web Audio -> MediaStreamAudioDestinationNode ->
HTMLAudioElement.setSinkId. It does not import or alter production AudioController.
Official vendor documentation supplies candidate evidence; physical endpoint,
conferencing, signing and contractual acceptance remain explicitly manual/vendor
checks when they cannot be exercised here.

## 1B: one renderer authority

A serializable PresentationSession owns mode and stable story/section/booster/board
identities. Existing UI setter names become migration adapters into this model;
the story array index becomes a derived compatibility value, not live authority.
A pure resolver provides target/content/occurrence identities and capabilities.
Navigation and drawing validate explicit session/revision/occurrence tokens.
Persistent strokes remain content-scoped. Provider-owned card effects and rewards
remain rendering adapters, not a second source for navigation. Runtime metadata
never enters project.json. Viewport remains renderer-owned where effects require
it, with target validation at the boundary.

## 1C: distribution after verification

Moving all state to Main would enlarge the change. Instead Control remains the
single authority and Main relays validated, revisioned full student-safe snapshots.
Present has its own narrow preload and no project mutation or audio API. It shows
only static images; unsupported targets replace old content with an explicit
fallback message. Reopen/reload/gaps request the latest snapshot. Control loss
clears the old display. Main authority migration is a later step.

Engineering checks at 1B precede production Present wiring. Final manual teaching
and conferencing acceptance are the owner's checks, not claimed by automation.

## Boundaries

No schema migration, audio ownership change, driver installation, UI redesign or
Phase 2 parity. The normal stage remains available without opening Present.
