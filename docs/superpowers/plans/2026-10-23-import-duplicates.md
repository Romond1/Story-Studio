# Same-name media imports

Use case-insensitive original basenames including extension to identify import conflicts, across saved assets, unsaved pool imports and a single bulk/folder import. Follow the user's final preference to ask which file to retain, with Keep existing / Use incoming and an apply-to-all checkbox scoped to one batch. Do not hash or merge differently named files. The alternative of always skipping would hide deliberate updates; automatic newest selection could choose the wrong content.

Implement in the shared main importer used by files, folders and drops. Supply current renderer assets to include unsaved imports, falling back to saved metadata for older callers. Incoming replacement keeps asset ID and user display title/bin, writes a new UUID file, and returns explicit replacement metadata. Renderer merge functions validate and apply replacements as one undo revision; preserve previous bytes for Undo and references. Never rewrite source files. Match duplicate names within batches too and create only one scene wrapper for a newly imported item.

Tests first: repeated import, cross-folder same names, within-batch duplicates, keep-existing, incoming replacement, per-batch decisions, undo-safe old bytes, and all pool merge paths. Run unit tests, type checks/builds and native dialog/import checks. Preserve existing work and do not commit/push.
