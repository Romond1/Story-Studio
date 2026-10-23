# Media bin rename and removal

Add Rename bin and Remove bin alongside New bin, enabled for a selected user-created bin. Keep General / all media permanent. Rename changes only the bin label; retain IDs/references. Remove only the selected container, moving direct assets and child bins to its parent (or root). Keep descendants, physical files and scene references. Each mutation uses the existing project history and persistence. Removing content recursively is unnecessary and risks lost work; moving contents preserves the user's organization and data.

Test helpers first for nested/root removal, blank names, immutable undo snapshots and stable IDs. Implement shared helpers, reuse the lesson's inline bin form for renaming and the legacy pool's existing prompt pattern. Verify native rename/remove/undo/redo/save/reload and compact layouts; run focused tests/type checks/builds. No commits or pushes.
