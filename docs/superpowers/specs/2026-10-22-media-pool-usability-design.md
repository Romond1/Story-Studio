# Media Pool usability

Keep both existing Media Pool workflows, filters, bins, selection and drag payloads. Share naming, thumbnail content and a native modal preview between the scene and legacy pools. No changes to Teach or Present media ownership.

Derive `VID - Title` / `PIC - Title` from the original filename when an optional `displayTitle` is absent. Remove only identifiable export metadata and timestamp suffixes; retain meaningful words and numbers. Store a user rename as a bounded, plain title on the asset. Never modify IDs, filenames, paths or reference metadata. Existing documents need no write migration. Audio retains its existing attachment workflow and gets a readable title without an invented visual type.

Unmodified click/keyboard activation selects and opens visual media; modifier clicks retain multiselection. Double-click never inserts. Drag continues to use the same asset IDs. Cards contain a contained thumbnail, type badge, two-line title and video play glyph. Existing reference diagnostics and usage filters remain outside cards.

Use a native dialog for viewport confinement, background inertness and focus trapping. Escape, backdrop click and Close dismiss it and restore focus. Preview contains a single enlarged image or muted looping video with native controls, explicit Add to Sequence and inline Rename. No autoplay on pool thumbnails. Release preview video source on close. Close automatically if the asset disappears or the pool is hidden.

Verify naming with table-driven tests, persistence and portable package round trips, and browser/Electron interaction checks covering selection, drag, rename, opening/closing, cleanup and narrow layout. Leave all changes uncommitted.
