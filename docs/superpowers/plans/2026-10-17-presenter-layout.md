# Presenter layout and Hero Dash polish

Use the existing camera and translation relays. Camera layout is normalized to the Presenter viewport and shared back to Control through a layout-only authenticated request. Edit mode exposes drag and resize handles; normal mode passes pointer input through. Presets reset free placement. Captions retain backward compatible defaults and use a validated style envelope, with live updates to published text. Hero Dash removes branding/course/progress overlays and places transparent name/point rows bottom left. A bounded moving sun shadow camera follows the racers.

- [x] Test layout bounds and backward compatibility; validate caption style values.
- [x] Implement normalized camera rectangle, edit toggle, Presenter pointer controls and layout-only relay.
- [x] Implement caption font/color/size/alignment/position/background/outline/spacing controls and live style relay.
- [x] Simplify race HUD and add directional sunlight with bounded shadows.
- [x] Run shared tests, builds and native Presenter interaction/screenshots; document results.

- [x] Move race camera tools above collapsible Browse images; display Prepared questions by default.
- [x] Preserve the chosen Blue/Red orbit target independently of rewards; Side/Overview orbit both racers. Verified with pure regression and native tests.
