# Bounded recovery retention

Keep autosave enabled in Edit and Teach and retain the existing dirty-state gate, so idle projects cause no disk writes. Use the same atomic project-file save. A single rotating backup would minimize storage but lose useful recovery choices; edit-only saving would leave pending authoring changes unprotected during Teach. Retain 30 metadata checkpoints per project/folder instead, skipping identical consecutive data regardless of save reason. Never copy media into these checkpoints.

1. Add a failing real-filesystem regression covering duplicate snapshots, old overgrown folders, retention and unrelated files.
2. Implement duplicate detection and pruning only after a completed durable checkpoint. Use monotonic filename timestamps to keep newest-first order deterministic for rapid saves.
3. Extend the actual autosave hook regression to verify repeated idle timer callbacks never write. Run persistence/lifecycle tests and main/renderer checks. Update recovery documentation; no commit or push.
