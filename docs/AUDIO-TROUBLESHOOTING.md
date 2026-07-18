# Story Studio Audio Setup and Troubleshooting

## Normal lesson setup

Use these four device selections:

- Story Studio **Microphone Input**: teacher microphone
- Story Studio **Monitor Output**: headphones
- Story Studio **Mix / Virtual Output**: CABLE Input (VB-Audio Virtual Cable)
- Zoom **Microphone**: CABLE Output (VB-Audio Virtual Cable)

Leave **Microphone Monitoring** off. The monitor then contains lesson media but not the teacher microphone. The Mix output contains both the microphone and lesson media for Zoom.

Do not also send Story Studio directly to the same physical output through Windows “Listen to this device,” OBS monitoring, or a second virtual-cable route. A second path can cause doubled, delayed, or wavy audio.

## Quick setup check

1. Open **Audio** in the top toolbar.
2. Select the teacher microphone, headphones, and CABLE Input.
3. Confirm Microphone Monitoring is off.
4. Speak and play one lesson sound. The Microphone, Media, Master, and Mix meters should move; the Monitor meter should move only for lesson media.
5. In Zoom, select CABLE Output as the microphone and verify its input meter moves for both speech and lesson audio.

## Reading the meters

- **Microphone moving, Master silent:** the microphone reached Story Studio, but a mixer mute/volume or graph connection is blocking it.
- **Master moving, Mix silent:** Story Studio's virtual-output route is muted, missing, or inactive.
- **Mix moving, Zoom silent:** check Windows, VB-Cable, and Zoom device selection. Story Studio has produced the mix.
- **Monitor moves while you speak with no media playing:** Microphone Monitoring is on. Turn it off unless testing.
- **Two active streams for one route or a duplicate-path warning:** reconnect devices or restart the audio engine before teaching.

## Common recovery actions

- If a saved device is missing, reconnect it, click **Reconnect Devices**, then select it again by name.
- If a route switch fails, Story Studio keeps the previous working route. Correct the device and retry.
- If the sound becomes doubled or wavy, make Monitor and Mix different physical destinations, disable Windows device listening, then click **Restart Audio Engine**.
- **Stop All Audio** mutes every bus but keeps the selected microphone route available. Unmute the required buses to resume.
- Use **Copy Diagnostics** when reporting a problem. It includes route counts, listener/callback counts, device state, meters, and the most recent stream error.

Audio preferences are stored in Story Studio's application settings, not inside episode `project.json` files. Opening an older episode therefore does not migrate or rewrite its saved JSON.
