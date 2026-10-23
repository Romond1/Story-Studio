# Playback position and bubble ranges

The Edit range toolbar already receives currentTime events but only renders trim endpoints. Add a distinct current/total readout with hundredths, retaining the existing selected-range output and decoder. Pause and seek events update the displayed position immediately.

Add optional disappearAtMs to existing bubble timing metadata. Inspector exposes Show from and optional Show until in source-video seconds (up to one hour), clearly indicating that empty end means stay visible. Validate end > start, retain defaults and legacy start-only data, extend projection/dependency/portable whitelists. Keep all bubbles visible while editing.

Use actual background-video time in Teach/Present, so pause, source-time seek, trim starts and replay control bubble windows. Image scenes retain scene-entry elapsed time. Use existing DOM video, no extra decoder; observe late video mounts, subscribe/clean media events and run an animation frame only while playing. Rerender at visibility boundaries, not every frame. For images schedule only the next start/end boundary. Reset per session/occurrence. Add pure range validation and actual native position/pause/seek/show/hide/replay/image/end-unset coverage. Run relevant tests, builds and native regressions; no commits/pushes.
