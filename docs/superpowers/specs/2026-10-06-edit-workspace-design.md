# Edit workspace modernization

Retain the existing lesson/session authority, persistence format, authoring handlers and direct Stage interaction. Introduce a local-only modern/legacy layout switch. Modern Edit uses the existing fitted viewport and divider with a 60% preferred canvas, a contextual right workspace and a fixed 176px linear lesson timeline. Teach shares the same timeline with navigation-only capabilities.

Use React portals for existing editor controls so their owner state and command wiring remain intact. Inspector categories are Content, Presentation and Audio; lesson tools and structure are a separate workspace tab. Keep original structural controls available in that tab, with section jumps in the timeline. Preserve legacy rendering until production acceptance is complete. No schema changes, audio engines, docking framework or new structural semantics.

Verification: existing test suite, renderer/main builds, focused sequence/geometry tests, browser layout evidence and the feature inventory/manual acceptance document. Manual production persistence and separate Present checks must be reported as unverified unless exercised.
