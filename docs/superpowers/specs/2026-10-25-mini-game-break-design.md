# Mini-game Break foundation

Phase 1 extends the current scene document used by both scene-v1 and episode-v2 lessons. Break occurrences reference scenes; independent duplication copies scenes/cards while linked duplication intentionally shares authoring. Existing legacy section Breaks keep their compatibility renderer.

Use an optional `breakExperience` on scenes, absent meaning Classic. A central, data-only registry declares the three planned games, validation, defaults and named surface slots; renderer component loading stays in the renderer. No actual engine or game UI is shipped. Invalid and unknown configurations remain preserved as bounded JSON but resolve to an unavailable placeholder.

Keep runtime separate on occurrence-scoped session state. A pure transition contract accepts explicit teacher-selected activity IDs, never generates random results in Present, and emits inert reward/effect intents. Sequence policy belongs to the adapter/configuration. Existing scene projection transports a minimal, validated placeholder descriptor through the existing snapshot protocol and renders it inside the existing logical frame.

Activities have local stable IDs and optional Card-definition references, avoiding copied question/reward content. Independent scene duplication regenerates activity IDs and remaps copied Card references; linked copies preserve authoring IDs. Missing references fail safely. No document version migration is needed for an optional field.

Validation covers old document loading, JSON round trips, independent/linked copies, malformed/unknown configs, deterministic runtime restore, occurrence isolation and projection parsing. Existing lesson, persistence and presentation tests and renderer/main builds remain regression checks. No commits, pushes, games, animations or reward execution.
