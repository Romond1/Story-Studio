# Boss editor usability design

Use the existing hosted editor, media registry and assignment callbacks. Expand drop acceptance to the entire media field and card previews, with hover feedback and type validation. Keep selection assignment as an accessible alternative. Label controls Media pool / Import / Clear with explanatory tooltips. Keep Import as the existing native importer.

Use a responsive image-first grid with large thumbnails, names in hover titles and accessible labels, small type badges, and a thumbnail size slider. Resize pool and navigation with pointer-captured, keyboard-accessible dividers, constrained to leave a usable center. Keep layout preferences only in UI memory.

Zoom currently mutates CSS dimensions on every wheel event and uses a fixed increment irrespective of wheel delta. Keep natural layout dimensions stable, scale the whole layer with transform, measure unscaled DOM dimensions, normalize wheel delta, and use a non-passive wheel listener. Preserve existing fit, reset and pan math.

Alternative of retaining dimension-based zoom perpetuates layout feedback; a new canvas renderer would be unnecessary scope. Verify actual native drag/drop into fields/previews, both divider interactions, clear/save, narrow screens, and zoom dimensions for all five games.
