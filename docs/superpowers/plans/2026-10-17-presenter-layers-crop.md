# Presenter layer order and off-screen camera crop

Keep all story/game/reward content in its isolated base stack, roster below camera, camera above content, translation above camera. Clip at the Presenter viewport. Hero Dash question images fit the viewport at normal size independently of camera/caption rectangles.

Camera rectangles use viewport proportions. Permit dimensions from 3% to 400% and off-screen origins while retaining a 1.5% visible strip for recovery. Dragging and four-corner resizing preserve the opposite corner, permit cropping beyond any edge, and use the same pure geometry helper for keyboard operations. Capture and chroma key remain unchanged. Reset in Control restores a visible default.

- [x] Write failing geometry/schema and image-fit regression tests.
- [x] Implement validated off-screen layout and four-corner pointer/keyboard controls.
- [x] Enforce layer order and remove image avoidance sizing.
- [x] Verify native overlap ordering, stable image size, corners, clipping, keyed camera and reset; inspect screenshots and run tests/builds.
