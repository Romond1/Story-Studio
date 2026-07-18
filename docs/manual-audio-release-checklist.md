# Monday Audio Release Checklist

Date: 2026-07-18<br>
Build/commit: `1093c0f` packaged as `release\Story Studio Setup 1.0.0.exe`<br>
Tester: ____________________

## Five episode compatibility

These are the latest substantial `project.json` candidates found in the five numbered episode folders. Confirm the paths before the final no-save launch test.

- [ ] Episode 1 — `D:\AI\SET OUT\TWIN STAR\EPISODE 1\WIN APP\Prod EP1\project.json`
- [ ] Episode 2 — `D:\AI\SET OUT\TWIN STAR\EPISODE 2\Ep2 Studio\project.json`
- [ ] Episode 3 — `D:\AI\SET OUT\TWIN STAR\EPISODE 3\STORY STUDIO\ep3 raw\project.json`
- [ ] Episode 4 — `D:\AI\SET OUT\TWIN STAR\EPISODE 4\STORY STUDIO\project.json`
- [ ] Episode 5 — `D:\AI\SET OUT\TWIN STAR\EPISODE 5\STORY STUDIO\project.json`

For each confirmed file: record SHA-256, open it in the packaged app, play media, verify the Mix meter, close without saving, and compare SHA-256. All five source hashes must remain unchanged.

Read-only packaged-app load result (no Save action): all five loaded successfully as version 4 projects, none contained an `audioSettings` field, and every before/after hash matched.

| Episode | Slides | Sections | Assets | SHA-256 |
| --- | ---: | ---: | ---: | --- |
| 1 | 112 | 16 | 169 | `3EDB23F264A0999F9E06BEAF2DBE8C0572F9269B7479E0AFFCFD6E4212823142` |
| 2 | 83 | 14 | 339 | `5F5DAD6DECAE528D704BCA93CAFE83D335A00C32CBC5B94CEEFE12AA4AEBC43A` |
| 3 | 80 | 14 | 216 | `1AF237BDE66E5601C4479C905F160DAA57AF636ACA70F66C98C1484314AFD6F7` |
| 4 | 90 | 10 | 174 | `1C23EF0F248E1E346480C745840F18E91E1C83EC7F6319404F15385BEB323D81` |
| 5 | 74 | 13 | 111 | `C4D07D47FDBD7B54071F80259A9350695E78848F8CCF09299CADBCB765E38235` |

## Physical routing acceptance

- [ ] Headphones as Monitor: lesson media is audible; teacher microphone is not audible with Microphone Monitoring off.
- [ ] Microphone Monitoring toggle: mic becomes audible only while the toggle is on and disappears immediately when off.
- [ ] Headphones as temporary Mix output: speech and lesson media are both audible once, with no doubling or waviness.
- [ ] VB-Cable + Zoom: Story Studio Mix is CABLE Input; Zoom microphone is CABLE Output; Zoom receives both speech and lesson media.
- [ ] Mute synchronization: microphone, media, master, monitor, and mix mute controls match in the full Audio workspace and compact stage menu.
- [ ] Stage controls persist: choose stage controls, restart the packaged app, and confirm the same compact controls return.
- [ ] Ten route switches: alternate Monitor and Mix devices ten times; the previous route is retained on any failed switch and sound never doubles.
- [ ] Five engine restarts: audio recovers each time; diagnostics remain exactly one mix stream, one monitor stream, one callback, and one device listener.
- [ ] Missing-device recovery: disconnect one selected device, confirm the warning, reconnect it, use Reconnect Devices, and restore the route.
- [ ] Stop All recovery: Stop All mutes every bus without losing the selected microphone; unmuting restores operation.
- [ ] Packaged-app relaunch: device choices, volumes, mutes, microphone-monitor setting, and stage controls return.

## Diagnostics evidence

After the VB-Cable/Zoom test, paste **Copy Diagnostics** here:

```text
Pending physical hardware test.
```

Expected stable counts:

- Active microphone streams: 1
- Active mix streams: 1
- Active monitor streams: 1
- Active callbacks: 1
- Active listeners: 1

Automated packaged-runtime routing check using the installed Windows devices:

- Monitor selected: `ヘッドホン (ATH-CKS50TW2 Stereo) (Bluetooth)`
- Mix selected: `CABLE Input (VB-Audio Virtual Cable)`
- Microphone Monitoring: off
- Engine state: active
- Streams: microphone 1, monitor 1, mix 1
- Callbacks/listeners: 1 / 1
- Stream errors, underruns, overruns, dropped buffers: none / 0 / 0 / 0
- Renderer exceptions: none

## Release result

- Automated gate: passed, 73 tests plus renderer and main builds
- Windows package: built successfully at `release\Story Studio Setup 1.0.0.exe`
- Five source hashes unchanged: passed for the five production candidates listed above after read-only packaged-app loads
- Physical hardware matrix: pending teacher microphone, headphones, VB-Cable, and Zoom

Do not mark the audio defect fixed or distribute the Monday build until every physical-routing checkbox passes.
