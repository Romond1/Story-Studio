# Edit video transport and frame visibility

The requested design is a persistent Edit preview transport beneath the timeline toolbar, at the boundary with preview/inspector. It controls the existing selected video element, not an additional decoder or the live session. Play/pause/stop and a labeled seek slider expose the selected video's playhead. Selection remains paused initially. Stop returns to trim-in. Native preview controls remain usable and synchronize the row through media events. Images show a select-video hint.

Keep frame previews passive. Their measured height collapses to 22px at the default timeline height, reducing a 16:9 frame to a tiny 39px-wide image. Reserve useful preview space and enough Edit timeline height for the added transport; Teach layout is unchanged.

- Add browser regressions for default-height frame thumbnail visibility and selected-video transport/Live isolation.
- Add a focused EditVideoTransport component using the mounted preview element; expose that element from MediaView and pass the transport row to LessonTimeline.
- Reserve frame preview height, adjust the Edit-only navigator minimum, and keep compact viewport scrolling usable.
- Run browser regressions, typecheck, tests and build; capture/inspect screenshots.

Alternative considered: a second video player in the timeline. Rejected because it would duplicate playback. Reusing Live transport would violate Edit/Live independence. No authored schema changes.
