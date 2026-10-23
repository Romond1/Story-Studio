# Playback, teaching shortcuts and drawing

Edit and Teach videos use one Play/Pause button. Space toggles the active video, including the clicked Media Pool video preview. Text inputs, menus and dialogs retain their normal keys. Holding a command key does not repeat its action.

In Edit, click or drag the white playhead in the upper part of the compact video bar to seek. The cyan handles underneath set the authored start/end range. Seeking does not create a project edit or alter the range. In Teach, drag Video position to seek the actual Present video. Both respect the selected range.

| Key | Action |
| --- | --- |
| Space | Play/Pause active video in Edit or Teach |
| A / D | Previous / next scene in Teach |
| 1 / 2 / 3 / 4 | Yellow / blue / pink / crown reward in Teach; number row only |
| F1 | Cycle the reward student in Teach |
| Q | Play the current section music or current break audio in Teach |
| W held | Capture translation speech; release to submit |
| E | Toggle drawing in Edit or Teach, retaining tool and appearance |
| R | Clear current scene drawings in Edit or Teach; undoable |

Select a scene belonging to a section, then use Section music in the inspector to choose imported audio, volume and looping. It continues across that section's scenes and stops when leaving the section, switching modes or changing projects. Breaks use their own existing audio settings. W requires translation to be enabled and ready with a microphone selected. Releasing W before readiness never starts a delayed capture; losing focus cancels capture.

Drawing supports sizes 1–100, rainbow ink and optional 1/2/3/5-second fading. Appearance is captured on each stroke and survives saving and portable export. Fading hides the ink without deleting authored drawing data.

Validation: 655 existing/unit tests, 18 focused controls/translation tests, TypeScript check and renderer/main builds passed. Native scene-video-trim acceptance checks actual mouse seek in Edit/Teach, unchanged trim, Space and E, A/D, save/reload, cleanup and narrow layouts. Tests use isolated temporary projects/profiles. No commit or push performed.
