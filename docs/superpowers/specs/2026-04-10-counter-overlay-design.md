# Counter Overlay Design

Date: 2026-04-10

## Goal

Refine the standalone Electron 20 Questions overlay so it remains OBS-stable during use, adds configurable timers, improves live control during rounds, and introduces more polished visual feedback without turning it into a complex game-specific workflow.

## Scope

This spec covers the standalone counter overlay only. It remains separate from the Story Studio application workflow and window. The work modifies the overlay window UI, round/game state model, and related animations/feedback.

## Requirements

### Stable Layout

- The overlay outer frame must not significantly change structure or footprint when a round starts, stops, pauses, or finishes.
- The main stage, core buttons, and score display should keep the same layout to avoid disturbing OBS scene framing.
- The settings area should be a fixed-width right-side control rail.
- The control rail must collapse horizontally into a narrow tab on the right edge and re-expand from the same edge.
- Starting a round must not remove or relocate the main buttons or reflow the primary layout.

### Round Controls

- `Start Round` and `Stop Round` must live on the main display area instead of inside the setup rail.
- The control rail remains available before, during, and after rounds.
- `Reset Round` must prepare a fresh round using the currently selected settings.
- `Switch Player` remains manual.
- Winner assignment remains manual through `Red Won` and `Blue Won`.
- The application must not auto-award winners or auto-advance rounds based on timers or counter values.

### Shared Round Counter

- The round uses one shared question counter.
- The control rail must allow configuring the round question limit.
- The control rail must allow selecting counter direction:
  - count down from limit to zero
  - count up from zero to limit
- `Space` and `Enter` both advance the question counter by one step when the main UI is focused.
- Advancing the question counter must also reset the per-question timer when that timer is enabled.
- The counter must stop at its configured limit and not overflow past the end state.

### Topic

- The control rail must include a topic input field.
- The active topic must display on the main stage during the round.
- Topic examples include values such as `Animals`, `Food`, or `Places`.

### Timers

- The overlay must support two optional countdown timers:
  - per-question timer
  - overall round timer
- Each timer must have its own enable checkbox in the control rail.
- Each timer must have its own duration input in seconds.
- The user must be able to run:
  - no timers
  - only the per-question timer
  - only the overall round timer
  - both timers simultaneously
- Starting a round initializes any enabled timers.
- Advancing to the next question resets only the per-question timer.
- The overall timer runs continuously across the round and does not reset on question advance.
- The main display must include `Pause Timers` and `Resume Timers` controls.
- Timer pause and resume must affect both enabled timers together.
- If a timer reaches zero, the overlay only indicates that time is up visually. It must not stop the round, switch the player, or award a winner automatically.

### Opacity

- The control rail must include an opacity control for the overall overlay panel.
- The opacity control should adjust the glass panel transparency while preserving legibility.

### Visual Feedback and Motion

- The current frosted glass pill aesthetic should remain the baseline visual language.
- Button hover behavior should use soft, slow, low-amplitude motion rather than sharp or fast reactions.
- Counter and timer number changes should animate smoothly to feel deliberate and readable.
- Control rail collapse and expand should animate horizontally.
- Start, stop, pause, and resume transitions should rely on fades/glows rather than layout shifts.
- On `Red Won` or `Blue Won`, the overlay should play:
  - a short confetti burst
  - a temporary winner-colored wash or flash across the main display and ambient chrome
- Celebration visuals must not change the layout geometry.

## UI Structure

### Main Stage

The main stage remains the visual anchor and contains:

- topic display
- shared round counter
- per-question timer display
- overall timer display
- active player indicator
- red and blue game scores
- round action buttons:
  - start round
  - stop round
  - reset round
  - switch player
  - pause timers
  - resume timers
  - count
  - red won
  - blue won

These controls stay in consistent positions before, during, and after a round.

### Right Control Rail

The right rail contains editable settings and remains fixed to the right side of the window:

- collapse/expand arrow tab
- topic input
- question limit input
- counter direction selector
- per-question timer enable checkbox
- per-question timer seconds input
- overall timer enable checkbox
- overall timer seconds input
- opacity slider

The rail can be collapsed into a thin interactive tab but remains attached to the right edge.

## State Model

The existing counter game state should be extended with:

- topic string
- rail collapsed state
- overlay opacity value
- round running/stopped status
- timer configuration:
  - per-question enabled
  - per-question duration seconds
  - per-question remaining seconds
  - overall enabled
  - overall duration seconds
  - overall remaining seconds
  - timers paused flag
- celebration state:
  - winner color
  - active/inactive burst state

The game score remains persistent across rounds. Round reset updates the round-specific values but preserves red/blue scores.

## Behavior Details

### Starting a Round

- Applies the current settings from the rail.
- Initializes the counter based on direction and limit.
- Initializes enabled timers.
- Shows the topic on the main stage.
- Does not move or hide the main controls.

### Counting a Question

- Triggered by `Space`, `Enter`, or the `Count` button.
- Advances the shared question counter by one step if the round is active.
- Resets the per-question timer to its configured duration if enabled.
- Leaves the overall timer untouched.

### Pausing Timers

- `Pause Timers` freezes both timers if they are enabled.
- `Resume Timers` restarts countdown from the current remaining values.
- Round state and manual winner controls remain available while timers are paused.

### Stopping a Round

- Stops active round progression and timer countdown.
- Does not modify the red/blue game scores.
- Does not clear topic or score state.

### Awarding a Winner

- `Red Won` increments the red game score and triggers red celebration visuals.
- `Blue Won` increments the blue game score and triggers blue celebration visuals.
- Awarding a winner does not automatically start the next round.

## Error Handling

- Invalid numeric inputs should clamp to sensible values rather than breaking the UI.
- Timer inputs should reject negative values and normalize empty/invalid values to defaults.
- Countdown logic must not allow remaining values below zero.
- Keyboard shortcuts must not trigger counting while typing in inputs or selects.

## Testing

### Logic Tests

- round start initializes topic, limit, direction, and enabled timers
- counter advance updates question count correctly for both modes
- counter advance resets only the per-question timer
- overall timer continues across question advances
- timer pause/resume toggles countdown behavior
- stop round halts countdown without awarding a winner
- winner assignment increments the correct player and triggers finished round state

### UI Verification

- layout footprint remains stable before and after starting a round
- right rail collapses horizontally without shifting the main stage in a disruptive way
- topic is visible during active rounds
- opacity slider changes panel transparency while preserving readability
- red/blue win celebrations play without layout jumps

## Implementation Notes

- Keep the overlay as a separate Electron entry point and renderer, not part of Story Studio’s main app UI.
- Extend the existing shared counter state module rather than mixing timer rules directly into the React component.
- Prefer CSS transitions and lightweight DOM effects for hover, glow, collapse, and celebration behavior.
- If confetti requires custom rendering, keep it local to the overlay renderer and avoid adding broad dependencies unless necessary.
