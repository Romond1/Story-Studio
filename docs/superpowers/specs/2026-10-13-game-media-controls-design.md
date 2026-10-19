# Game media and presentation controls

Both game sections expose Adventure, Discovery, Challenge and Mastery navigation. Leaving a running game flushes authored edits before switching. Control reuses the lesson media pool and camera/translation controls; Present retains its existing overlay layers and sole game runtime.

Selected pool images append cards to Mastery and select the Challenge background. Mastery video selection adds cutscenes. Asset references remain stable `asset:` IDs. Activity configuration exposes media selectors for existing cards and character media. Editing a running activity first returns to setup after flushing its changes, avoiding competing Control and Present authors.

Without a lesson, Control offers a draft and opening an existing lesson. Scene lessons use the existing conversion-to-copy flow to enable game settings. No portable package is required. Errors remain visible; unsupported selections do not silently alter configuration.

Verification covers media assignment, persistence validation, native Control navigation and shared pool, game launch, and desktop/narrow layouts.
