# Phase 1A — Audio feasibility

Checked 2026-10-06. **SIMPLE PAIRED-ENDPOINT PATH REMAINS PREFERRED.** This is an engineering recommendation, not commercial clearance or a downstream capture PASS. No evidence found requires a raw PCM bridge. A purchasable, supportable OEM arrangement and actual Windows capture acceptance remain external dependencies.

## Isolated prototype

`prototypes/audio-feasibility/` is independent of production audio, Core, Present, and project files. No package dependencies, drivers, installers, or production settings were changed by this workstream. No vendor was contacted and no component was downloaded or redistributed.

Run from the repository root:

```powershell
node prototypes/audio-feasibility/serve.mjs
```

Open `http://127.0.0.1:5176` in desktop Chrome or Edge. Stop this standalone server with Ctrl+C. It serves only the four harness resources from a loopback listener. Files chosen in the browser are decoded locally; the harness does not upload or save audio.

The harness supports physical microphone selection, a quiet generated tone, separate local dialogue/music/SFX clips, and simultaneous playback. Music loops; the others play once. Audio extracted from video provides a video-equivalent signal without introducing a second video engine. Every source feeds:

```text
Web Audio source → mix gain → analyser → MediaStreamAudioDestinationNode
  → HTMLAudioElement.srcObject → setSinkId(selected playback endpoint)
```

There is no direct connection to `AudioContext.destination`. The route must be stopped before changing output. A failed sink selection stops the route instead of silently switching to speakers. Stop releases microphone tracks, sources, destination tracks, audio-element playback, and the context. Pending permissions/decodes cannot restart a stopped session. Producer diagnostics include context state/sample rate, device IDs, active sources, microphone/mix RMS, and route errors. Device names remain visible in selectors. These meters do not measure the paired capture endpoint.

## Evidence collected

- Six isolated lifecycle tests pass: mixing/cleanup, sink failure, stop during microphone permission, stop during decode, stop during sink selection, and individual clip cancellation during decode.
- Real Chromium Web Audio smoke passed: `setSinkId('')`, stream destination, audio-element playback, synthetic microphone plus tone and three decoded WAV sources simultaneously, nonzero mix meter, and zero sources/closed context after Stop. Desktop and narrow screenshots were inspected; no horizontal overflow or page exceptions occurred.
- This browser run deliberately used a synthetic microphone and muted browser output. It proves producer operation only. Sample rate observed: 44,100 Hz. Physical microphone audibility, installed vendor selection, capture fidelity, latency, crash silence, and conferencing reception were **not tested**.

Repeat lifecycle tests with:

```powershell
node --test prototypes/audio-feasibility/route.test.mjs
```

Optional browser test requires an already available Playwright installation and Chromium; it does not add a repository dependency. Set `PLAYWRIGHT_MODULE` to its module directory and optionally `CHROMIUM_PATH` to its browser executable, then run `node prototypes/audio-feasibility/browser-test.mjs`. The test prints its temporary screenshot directory. Default module resolution also works when Playwright is available externally.

## Candidate assessment

### Custom/OEM Virtual Audio Cable (Eugene Muzychenko)

**Public architecture:** VAC exposes connected playback/capture devices through a Windows driver; this is compatible in principle with an enumerated browser sink. The ordinary driver requires administrator installation. [VAC description](https://vac.muzychenko.net/en/description.htm)

**Public commercial/branding position:** Custom versions support customer vendor/product/device naming, distribution with a companion application, and an unlock key. A disconnected companion can produce noise or silence, according to the purchased configuration. Generic test builds have restricted evaluation distribution. These are documented options, not a Story Studio contract. [OEM/custom versions](https://vac.muzychenko.net/en/customversion.htm)

**Signing/install:** The installation manual describes a publisher-signed driver and conditional reboot. The glossary states VAC lacks a WHQL signature. These statements do not certify a future custom package under current Windows 11, Secure Boot, or memory integrity. Obtain build-specific signing and compatibility evidence before any installation. [Installation](https://vac.muzychenko.net/en/manual/install.htm), [signature explanation](https://vac.muzychenko.net/en/manual/glossary.htm)

**Vendor confirmation required:** Exact supported OS/architectures; signing chain and attestation; memory-integrity support; companion unlock API/lifetime and silence configuration; price, royalties, redistribution/rebranding grant, support and update obligations; coexistence, stable device IDs, repair/uninstall and upgrade/reboot behavior. A small native **control** helper may be needed for unlocking; that does not imply a native PCM transport bridge. This is an inference to validate with the vendor. Retail/business licenses alone are not evidence of custom redistribution rights. [VAC purchase options](https://vac.muzychenko.net/en/purchase.htm)

### VB-CABLE (VB-Audio)

**Public architecture/install:** CABLE Input is the playback side; CABLE Output is the recording side. The vendor documents ordinary Windows audio interfaces and administrator installation with a reboot. This fits the selected-sink architecture in principle. [VB-CABLE product](https://vb-audio.com/Cable/)

**Public commercial position:** Stock VB-CABLE bundling is conditional: visible attribution and an applicable donationware model, or purchased licenses for the specified professional distribution context. The public rules expressly exclude A+B/C+D from bundling. Stock terms do not establish Story Studio rebranding rights. Obtain a written agreement matching the intended installer and audience. [Licensing/distribution rules](https://vb-audio.com/Services/licensing.htm)

**Signing unknown:** No package was inspected; no signature, attestation, or security-compatibility PASS is claimed. Require vendor confirmation and verification of the exact deliverable under unchanged Windows security settings.

**Vendor confirmation required:** Stock redistribution grant and attribution, sublicensing/volume terms, whether any OEM/rebranding offering exists, supported OS/architectures, signed installer/driver delivery, silent install/repair/uninstall, coexistence and updates, support SLA, and idle/crash capture behavior. The vendor asks bundle inquiries to describe product and distribution context. [VB-Audio quotation guidance](https://vb-audio.com/Services/contact.htm)

## Feasibility acceptance matrix

| Required evidence | Current status / next proof |
| --- | --- |
| 1. Candidate playback endpoint selectable | Browser sink API exercised on default synthetic environment; select actual candidate in manual run. |
| 2. Capture endpoint appears as Windows microphone | Public paired-endpoint architecture; actual supported build enumeration pending. |
| 3. Physical microphone reaches capture | Harness supports it; external recording proof pending. |
| 4. Dialogue/music/SFX/video-equivalent preserved | Three browser decode/playback sources exercised; compare downstream recording manually. |
| 5. Simultaneous mic + media | Synthetic producer sources exercised together; physical downstream mixture pending. |
| 6. Stop/crash leaves no stale audio | Producer normal-stop cleanup tested; record Stop and forced producer termination externally. |
| 7. Idle silence | Capture device observation with no producer pending; confirm OEM unlock policy. |
| 8. Conferencing/recorder enumeration | Actual recorder and intended Zoom/Teams/Meet version pending. |
| 9. No security weakening | No settings changed; exact vendor build must pass with normal security enabled. |
| 10. Professional installer fit | Installer/contract/signature/upgrade evidence from vendor pending. |

## Compact manual/vendor gate

1. Obtain a legally usable, signed candidate from its vendor plus applicable terms. Confirm supported Windows version, normal Secure Boot/memory-integrity configuration, and installer lifecycle. Do not disable protection to make it load.
2. With headphones, choose physical mic and candidate playback endpoint in the harness. In an independent recorder choose its paired capture endpoint. Record mic, tone, dialogue, music, SFX, and their simultaneous mix. Note device names, sample rates, intelligibility, clipping, dropouts and latency; use short speech/music clips you may test.
3. Keep recording while pressing Stop, then restart and terminate only the dedicated producer browser process. Verify silence after each, then restart again and check recovery. Observe idle capture before starting the harness. Do not terminate the teaching app.
4. Verify the paired capture appears and transmits in the intended conferencing application. Record application versions and audio-processing settings; conferencing noise suppression may alter music/transients. This is the owner's acceptance gate, not an automated PASS.
5. Before commercial integration, obtain written answers to the named vendor questions. Do not ship the prototype or bundle a driver on the basis of public download availability.

Stop here for 1A. Keep the existing Story Studio AudioController and cable routing intact. Phase 2 audio ownership work should follow the selected candidate's evidence and the owner's acceptance, without adding PCM transport absent a specific measured need.
