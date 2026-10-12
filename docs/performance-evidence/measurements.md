## Accepted benchmark results

Every row has 10 seconds of warm-up and at least 60 seconds of measurement. CPU means are time-weighted; p95/peak describe approximately one-second samples, not instantaneous spikes.

| Configuration | Seconds | CPU avg % | p95 % | Peak % | Private MiB avg | Working-set MiB avg |
| --- | --- | --- | --- | --- | --- | --- |
| A · Control only | 60.2 | 4.28 | 4.66 | 8.18 | 406 | 714 |
| B · Present / paused video | 60.4 | 16.66 | 22.28 | 24.84 | 576 | 931 |
| C · camera, no key | 60.2 | 16.33 | 17.94 | 18.37 | 625 | 969 |
| D · camera + key | 60.3 | 15.73 | 18.76 | 19.35 | 625 | 973 |
| E · tracking + hat | 60.4 | 20.41 | 22.10 | 23.37 | 830 | 1600 |
| F · video + drawing | 60.2 | 28.07 | 30.40 | 34.96 | 1182 | 1703 |
| F repeat · 13→26 strokes | 60.3 | 30.72 | 33.27 | 33.40 | 1244 | 1711 |

![Measured CPU and frame rates](performance-evidence/overview.svg)

Observed differences (percentage points): B−A 12.39, C−B -0.34, D−C -0.59, E−D 4.68, F−E 7.65. Negative camera/key deltas indicate measurement variability, **not speedups**. B had more CPU spikes; E/F were a separate instance. These are not precisely isolated component costs. Overall OS CPU including unrelated apps averaged 50.4–79.0% across these runs.

### Process CPU attribution

| Process | A % | B % | D % | E % | F repeat % |
| --- | --- | --- | --- | --- | --- |
| Main | 0.14 | 0.78 | 0.10 | 0.24 | 0.33 |
| Control | 1.73 | 3.36 | 2.98 | 3.08 | 4.74 |
| Presenter | — | 4.82 | 3.99 | 7.61 | 11.58 |
| GPU: GPU | 2.00 | 6.83 | 7.26 | 8.04 | 11.89 |
| Utility: network.mojom.NetworkService | 0.00 | 0.42 | 0.34 | 0.35 | 0.84 |
| Utility: audio.mojom.AudioService | 0.40 | 0.45 | 0.44 | 0.47 | 0.49 |
| Utility: video_capture.mojom.VideoCaptureService | 0.01 | 0.01 | 0.63 | 0.63 | 0.75 |

Initial E/F instance: main PID **43656**, Control **10616**, Presenter **44784**, GPU **44912**. Locked A–D/final-repeat instance: main **43688**, Control **43280**, Presenter **38960**, GPU **44628**. Static/paused-video comparison: main **28172**, Control **39476**, Presenter **26828**, GPU **36640**. Utility PIDs and available OS parent-chain snapshots are retained in the evidence. Dedicated inference workers belong to Presenter; CPU per worker thread was not separately measured.

### Frame rates and GPU timing

| Run | Camera delivery FPS | Camera processing FPS | Presenter RAF Hz | Inference Hz | GPU upload+draw mean / p95 ms |
| --- | --- | --- | --- | --- | --- |
| B | — | 0.00 | 59.86 | 0.00 | — / — |
| C | 30.00 | 30.00 | 59.99 | 0.00 | 1.43 / 4.06 |
| D | 30.00 | 30.01 | 59.97 | 0.00 | 1.28 / 3.51 |
| E | 30.00 | 29.99 | 59.74 | 9.98 | 1.35 / 3.53 |
| F | 30.00 | 30.00 | 59.86 | 10.00 | 0.56 / 2.01 |
| F-confirmed | 30.01 | 30.01 | 59.95 | 10.00 | 0.72 / 2.20 |

F repeat independently delivered **30.01 lesson-video FPS**, with p95 frame callback gap 33.5 ms, while drawing continued. RAF is not a scanout measurement. The first suite used an 8-second looping video; the repeat used a continuous 90-second video and began with 13 retained strokes, growing to 26.

### Tracking cadence and latency

Times are milliseconds. Result age ends at worker-message receipt; first-paint age ends after overlay command submission. Neither is sensor-to-screen latency or smoothing group delay.

| Setting / actual rate | CPU avg % | Infer mean / p95 | Result age mean / p95 | First-paint age p95 | All-paint age p95 | Face detected % |
| --- | --- | --- | --- | --- | --- | --- |
| 100 ms gate · 9.02 Hz | 23.61 | 37.3 / 55.1 | 54.3 / 86.3 | 120.4 | 175.2 | 87.2 |
| Original 80 ms / 45 ms smoothing · 9.85 Hz | 23.46 | 36.8 / 55.2 | 52.1 / 89.4 | 131.0 | 171.9 | 82.7 |
| 50 ms gate · 14.81 Hz | 24.97 | 32.6 / 42.7 | 45.4 / 60.4 | 84.0 | 105.7 | 100.0 |
| 20 Hz target / compensated · 14.90 Hz | 26.13 | 34.3 / 42.6 | 47.8 / 59.0 | 85.1 | 104.5 | 95.8 |
| 80 ms / smoothing disabled · 9.97 Hz | 23.10 | 33.7 / 45.4 | 47.6 / 63.8 | 75.4 | 138.3 | 97.5 |

### Main-thread stalls

| Run | Presenter long tasks ≥50 ms | Longest task ms | Max RAF gap ms | Control long tasks ≥50 ms |
| --- | --- | --- | --- | --- |
| B | 0 | — | 99.9 | 3 |
| E | 2 | 59.0 | 66.7 | 0 |
| F | 1 | 53.0 | 50.1 | 0 |
| E-10Hz | 6 | 112.0 | 100.0 | 2 |
| E-20Hz | 3 | 92.0 | 83.3 | 1 |
| E-repeat | 12 | 105.0 | 100.1 | 3 |
| F-confirmed | 0 | — | 33.5 | 2 |

### Focused paused-video comparison

| Camera-off condition, same instance | CPU avg / p95 % | Private MiB avg |
| --- | --- | --- |
| B-static | 5.65 / 6.42 | 445 |
| B-paused-video | 15.14 / 16.02 | 565 |