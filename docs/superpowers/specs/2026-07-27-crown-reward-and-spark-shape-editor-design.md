# Crown Reward and Spark Shape Editor Design

## Summary

Story Studio will add a fourth reward, the crown, for competition wins. Crowns use the same active-student targeting and persistence model as the three existing Spark rewards, add to the student's overall reward total, and trigger from `P` in Teach mode. Their entrance is deliberately different: the crown drops from above and lands with a bounce.

The Badge settings will also turn the existing placeholder Spark Shape controls into a functional reward-appearance editor. Yellow, blue, pink, and crown will each support built-in shapes and an optional custom PNG. Badge-stage positioning and resizing will gain clearer selection, locked aspect ratios, compact size controls, and overlap management.

All additions are backward-compatible with existing project JSON. Missing crown and appearance fields receive safe runtime defaults, while existing counts, assets, sprite positions, and sprite dimensions remain unchanged.

## Goals

- Add crowns as a fourth per-student reward for competition wins.
- Award a crown to the active student with the `P` hotkey in Teach mode.
- Include crowns in the student's overall reward total while displaying the crown count separately.
- Give crowns a distinctive drop-and-bounce entrance.
- Make star, diamond, circle, heart, and crown built-in shapes functional.
- Allow a separate custom PNG for each of yellow, blue, pink, and crown.
- Make badge reward sprites easier to select, resize, and layer.
- Preserve existing project JSON and live-session behavior.

## Non-Goals

- Unlimited user-defined reward categories.
- User-configurable reward hotkeys.
- Vector editing or automatic removal of transparent padding inside uploaded PNGs.
- Renaming or recoloring the three existing reward variants.
- Changing unrelated Badge, Boost, audio, movement, relic, or story behavior.

## Chosen Approach

Extend the existing fixed reward model with one crown variant. This is smaller and safer than replacing the current reward fields with a configurable registry, and it avoids the duplicated state and rendering logic that a separate crown subsystem would create.

The four reward variants remain explicit and share common definitions for labels, count fields, default shapes, colors, hotkeys, and entrance styles. This central definition prevents the provider, hotkey handler, controls, badge renderer, and totals from drifting apart.

## Reward Behavior

### Crown Award

- Each student has a crown count.
- Pressing `P` in Teach mode awards one crown to the active student.
- The existing active-student selection behavior is unchanged.
- The hotkey is ignored when focus is in an input, textarea, or content-editable element.
- Existing yellow, blue, and pink hotkeys remain unchanged.
- Resetting the active student's rewards clears yellow, blue, pink, and crown counts.

### Totals

The overall reward total is:

`yellow + blue + pink + crowns`

The legacy `stars` field continues to hold the derived overall total for compatibility with existing consumers. Crown counts are also rendered separately anywhere variant-level scores are presented, so competition wins remain distinguishable from language rewards.

### Crown Entrance

The crown uses a dedicated entrance rather than the standard star burst:

1. The crown starts above the reward anchor.
2. It accelerates downward.
3. It overshoots slightly at the landing point.
4. It rebounds once and settles briefly.
5. Crown-colored particles and glow reinforce the landing.
6. The counter displays the active student's name and updated total using the existing timing configuration.

Reduced-motion support removes the large drop and uses a short fade/scale entrance while preserving the award feedback.

## Reward Appearance Editor

The existing “Spark Shapes (saved for future renderer support)” section becomes a functional “Reward Appearance” section.

Each reward has a compact card for:

- Reward label and preview thumbnail.
- Built-in shape selector: star, diamond, circle, heart, or crown.
- Upload PNG / Change PNG.
- Remove PNG.
- An indication of whether the built-in shape or custom PNG is active.

Each reward stores its built-in shape choice independently. A custom PNG takes precedence over the built-in shape. Removing the PNG immediately falls back to the selected built-in shape.

Existing uploaded yellow, blue, and pink badge PNG references retain their current meaning and remain connected after loading. The crown has a built-in crown fallback, so awarding crowns works before the teacher uploads a custom crown PNG.

Imported files use the existing media import and project asset pipeline. If a media selection contains no supported image, no reward setting changes. Canceling the picker also leaves the project unchanged.

## Badge-Stage Editing

### Selection and Visibility

- Editing-only outlines show the true sprite boxes, including boxes whose images contain transparent padding.
- Each outline displays the student and reward label.
- The selected sprite uses a stronger outline and visible resize handles.
- Editing guides never appear in Teach mode or child-facing final displays.
- A panel list lets the teacher select a sprite even when it is fully covered by another sprite.

### Resizing

- Aspect ratio is locked by default.
- Corner resizing changes width and height together.
- A compact size slider adjusts the selected sprite without requiring a large drag gesture.
- Existing saved width and height values are preserved as loaded.
- Once an existing sprite is resized, its current aspect ratio becomes the locked ratio; new sprites use the selected asset's natural ratio when available.
- Minimum and maximum dimensions keep handles usable and prevent a sprite from growing beyond the stage's practical editing bounds.

### Overlap Ordering

The selected sprite has forward and backward controls. These update its saved layer order in bounded steps. The panel selection list remains usable regardless of overlap, avoiding the need to click through invisible or covered boxes.

### Crown Sprite Creation

Existing badge sprites are not regenerated or repositioned. When crown support is first needed, a crown sprite is added for each visible student using a non-overlapping default offset derived from that student's existing reward group. Existing yellow, blue, and pink records retain their IDs, positions, dimensions, and layer values.

## Data and Compatibility

The project schema version remains unchanged. New fields are optional at the serialized boundary:

- `SparkStudent.crowns`
- Crown entries in reward shape and asset mappings
- Crown badge sprite variants

Project loading normalizes every student:

- Invalid or missing existing counts become their current safe values.
- Missing or invalid crown counts become `0`.
- The derived total is recalculated from all four variants.
- Existing IDs, names, visibility, and reward metadata are retained.

Configuration resolution merges stored partial settings with defaults instead of replacing an older object wholesale. This ensures older saves receive the crown default shape while retaining every stored animation, size, position, and shape choice.

Live-session snapshots containing older student objects receive the same normalization before restoration. Saving after loading an older project writes the normalized crown fields without discarding unknown or existing supported fields.

Missing or deleted custom image assets fall back to the configured built-in shape. They do not prevent the project from opening, awarding a reward, or rendering the Badge stage.

## Component Boundaries

### Shared Reward Model

A focused shared module owns:

- Reward variant definitions.
- Variant-to-student-count mapping.
- Student normalization.
- Overall total calculation.
- Shape and custom-asset fallback resolution.
- Badge sprite creation, aspect-ratio sizing, and layer-order updates.

These pure helpers are covered by Node tests and used by renderer components.

### Spark Provider

The provider awards all four variants through the same active-student path, updates the derived total, emits the appropriate animation event, and clears all four counts on reset.

### Hotkey Handler

The existing handler maps `P` to crown while retaining its Teach-mode and editable-target guards.

### Burst and Overlay Rendering

The burst renderer resolves either the reward's custom PNG or selected built-in SVG shape. Crown events select the drop-and-bounce entrance; other variants keep their existing entrance.

### Badge Panel

The panel owns appearance controls, media import actions, sprite selection, compact sizing, and layer controls. Pure calculations are delegated to the shared module.

### Badge Stage

The stage renders four variants per visible student when configured, exposes editing guides only in Edit mode, and continues to render clean child-facing output in Teach mode.

## Error Handling

- Ignore canceled media imports.
- Reject non-image selections without changing reward configuration.
- Fall back to built-in shapes for unresolved asset IDs.
- Clamp invalid sprite sizes and layer values at the interaction boundary.
- Ignore reward hotkeys when no active student exists.
- Preserve current state if a requested sprite or student no longer exists.

## Testing

Automated coverage will include:

- Normalizing a legacy student without crown data to zero crowns.
- Preserving legacy counts, badge assets, positions, and dimensions.
- Including crowns in the derived overall total.
- Awarding only the active student.
- Clearing crowns during reset.
- Mapping `P` to crown while editable targets remain protected.
- Resolving all five built-in SVG shapes.
- Preferring a valid custom PNG and falling back when its asset is missing.
- Adding crown sprites without modifying existing sprite records.
- Maintaining locked aspect ratios and enforcing size bounds.
- Moving selected sprites forward and backward predictably.
- TypeScript compilation and the full existing Node test suite.

Manual verification will cover:

- Loading an existing project JSON and comparing pre-existing reward data and layouts.
- Uploading, changing, and removing a PNG for every reward.
- Observing the crown drop entrance in Teach mode.
- Selecting a fully overlapped sprite from the panel.
- Resizing with the compact slider and stage handles.
- Confirming editing guides are absent in Teach mode.
- Confirming the final Badge display includes crown and overall totals.

## Success Criteria

- `P` awards one crown to the active student in Teach mode.
- The displayed overall total increases by one.
- The crown entrance is visibly distinct from star awards.
- All built-in shape choices render rather than acting as metadata-only placeholders.
- Every reward supports its own persistent custom PNG.
- Overlapped sprites remain selectable and layerable.
- Sprite resizing is aspect-ratio locked and practically bounded.
- Existing project JSON loads without lost counts, assets, layout, or settings.
- The full test suite and production build pass.
