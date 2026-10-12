type LayoutPlatform = Pick<typeof window, 'ResizeObserver' | 'requestAnimationFrame' | 'cancelAnimationFrame' | 'addEventListener' | 'removeEventListener'>;

/** Never change geometry during a ResizeObserver delivery. Coalesce work into a frame. */
export function observePlayArea(targets: Element[], update: () => void, platform: LayoutPlatform = window): () => void {
  let frame = 0;
  const schedule = () => {
    if (frame) return;
    frame = platform.requestAnimationFrame(() => { frame = 0; update(); });
  };
  const observer = new platform.ResizeObserver(schedule);
  targets.forEach(target => observer.observe(target));
  platform.addEventListener('resize', schedule);
  return () => {
    observer.disconnect();
    platform.removeEventListener('resize', schedule);
    if (frame) platform.cancelAnimationFrame(frame);
  };
}
