# Speech bubble shapes, tails, timing and fitted text

Extend existing lesson bubble objects with optional four-way tail and appearance-delay metadata. Add local vector styles for oval speech and a plain rectangular no-tail box, retaining classic/thought/shout IDs and defaults. Avoid PNG imports and global legacy bubble-definition changes. Mirror only the vector and usable text rectangle, never the text itself. Shout and box do not expose tail controls.

Fit text in logical scene units before paint: use the font-size setting as a maximum, scale down with bubble geometry and binary-search measured wrapped text until it fits the usable text area. Use tight 1.05 line height, no cropping/ellipsis. Apply across Edit, Teach, Present and thumbnails.

Delay defaults to zero, maximum 60 seconds. Edit and passive timeline thumbnails show all bubbles. Teach and Present reveal delayed bubbles after entering each scene occurrence; revisit/restart resets, ordinary plan/geometry updates do not. Use one next-reveal timeout per surface with unmount cleanup; timing follows scene entry wall time, independent of video playback/pause.

Tests first for projection/strict validation/default compatibility and metadata round trips. Extend dependency and portable whitelists. Add native coverage for all shapes/tails, small/long text fitting, inspector undo, delay reset/cleanup, Teach/Present and save/reload. Run relevant unit/type/build checks; retain current uncommitted work and do not commit or push.
