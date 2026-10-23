# Live lesson controls and saved preferences

Teach now includes per-track volume sliders for section music and break audio. Adjustments change the active mixer gain without restarting playback. Values are remembered per project and track on this computer, independently of authored Edit volumes; Q and subsequent Play use the live level.

Translation preferences save automatically, including language, Japanese display, reading overrides, speech settings, caption style/color/placement and auto-publish. Camera device, layout, tracking and appearance save automatically too. Both show saved status. Edit/Teach keeps the same translation/camera controls mounted, preserving active setup and translation draft. Leaving Teach cancels a recording and disables W while editing; it does not unload the enabled translation engine. After an app restart preferences restore, while camera acquisition and translation activation remain explicit.

Video playback defaults to manual. Teach offers “Autoplay videos when changing scenes” as a remembered preference. Space remains Play/Pause. Trim and seek behavior are unchanged.

Reward appearance in Teach offers four corners or center, 50–175% pop-up size and 0–200% effect intensity. Settings are remembered on this computer and apply to subsequent awards; the same configuration crosses the validated Present protocol. Intensity changes particles, glow, motion and celebration confetti.

Drawing mode keeps cards and native video controls clickable. Picture, text and video body areas still accept ink. The bottom native video control strip remains available. Fading marker metadata and original point timestamps survive both presentation transports, so rainbow/fading ink disappears in Control and Present together.

Changed areas: LessonApp and live audio owner/controls; AudioController gain update; translation preferences/controls; camera preference store and relay; reward appearance/model/renderer/Teach controls; SceneSurface pointer arbitration and presentationSnapshot fade parsing. Personal preferences are not added to portable lesson files.

Validation: 658 unit tests passed; focused preference, live gain, drawing and seek/autoplay regressions passed; renderer/main builds and TypeScript passed. Native isolated tests confirm actual mixer gain without restart, section/break volumes, stable translation DOM and saved settings across Edit/Save/Teach, clickable cards, actual Control/Present canvas fade, reward projection and video seek/trim/navigation. No commit or push.
