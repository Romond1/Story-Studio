# Media loading performance

Profile with isolated real Electron projects, actual media files and main IPC timings before changing behavior. Baseline 600 assets opens every one of 200 video thumbnail decoders; naming plus registry/dependency collection takes ~4 ms. Default local fixture startup is ~1 s and first preview ~1.47 s, not the user's full 5–6 s; do not claim exact reproduction. MediaRegistryCache withholds all usable URLs until all bounded resolution batches finish. Main copy/open handlers are only tens of ms in this fixture.

Keep file containment/grant checks and bounded concurrency. Add tested progressive immutable access snapshots after each checked batch, prioritizing current Edit/Live background assets. Expose partial physical previews immediately but retain pending until the complete catalogue is ready; derived-image generation and hosted editor catalogues must await complete access. Retired loads cannot publish.

Use shared IntersectionObserver groups for pool/timeline thumbnail proximity. Visible/nearby thumbnails load; offscreen videos unload/release resources. Timeline scene visuals mount only near the horizontal viewport, preserving cards, text labels, badges, selection and drag metadata. Avoid extra decoders and preserve pointer scrubbing when scrolled into view. Investigate lazy legacy entry imports only if independently measurable/straightforward.

Add failing tests for progressive publication, priority ordering, immutable snapshots and stale generations. Add native offscreen load/scroll/scrub/cleanup checks and compare before/after profile counters/timings. Run existing density/pool/trim/timing checks, unit/type checks/builds. No commit/push. Document fixture limits and physical-copy costs.
